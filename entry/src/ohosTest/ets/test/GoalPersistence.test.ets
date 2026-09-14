import { UIAbility, Want } from '@kit.AbilityKit';
import { relationalStore } from '@kit.ArkData';
import { abilityDelegatorRegistry, Driver } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';
import { FamilyHabitModule, FamilyState, PasswordHasher } from '../../../main/ets/domain/FamilyHabitModule';
import { ArkDataPersistenceAdapter } from '../../../main/ets/infrastructure/ArkDataPersistenceAdapter';

const hasher: PasswordHasher = {
  async createSalt(): Promise<string> { return '目标合约盐'; },
  async derive(password: string, salt: string): Promise<string> { return `${salt}:${password}`; },
  async verify(password: string, salt: string, digest: string): Promise<boolean> { return digest === `${salt}:${password}`; },
};

export default function goalPersistenceTest(): void {
  describe('TASK5GoalPersistence', () => {
    it('[TASK-5-DB01][AC-08][AC-10][AC-12] 模式2升级与目标关系关闭重开', Level.LEVEL2, async () => {
      let adapter: ArkDataPersistenceAdapter | null = null;
      let ability: UIAbility | null = null;
      const storeName = 'goal_contract_test.db';
      try {
        const delegator = abilityDelegatorRegistry.getAbilityDelegator();
        const want: Want = { bundleName: abilityDelegatorRegistry.getArguments().bundleName, abilityName: 'EntryAbility' };
        await delegator.startAbility(want);
        await Driver.create().waitForIdle(1000, 3000);
        ability = await delegator.getCurrentTopAbility();
        await relationalStore.deleteRdbStore(ability.context, storeName);
        adapter = await ArkDataPersistenceAdapter.open(ability.context, storeName);
        const old: FamilyState = {
          schemaVersion: 2, revision: 8, templateSeedVersion: 1, taskTemplates: [],
          taskPool: [{ id: 'task-8', childId: 'guoguo', sourceTemplateId: 'junior-math', name: '数学练习', description: '一页', disabled: false,
            defaultRules: { completionPoints: 5, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: true, streakCap: 3 } }],
          children: [{ id: 'guoguo', displayName: '果果', avatar: 'guoguo', theme: 'mature' }, { id: 'yangyang', displayName: '阳阳', avatar: 'yangyang', theme: 'playful' }],
          parentCredential: { salt: '旧盐', digest: '旧盐:2468' },
        };
        await adapter.save(old);
        const module = await FamilyHabitModule.create(adapter, hasher);
        expect((await adapter.load())?.schemaVersion).assertEqual(4);
        const parent = await module.openSession({ entry: 'parent', password: '2468' });
        expect(parent.ok).assertTrue();
        if (parent.ok === false) return;
        const created = await module.execute(parent.value.token, { type: 'create-goal', childId: 'guoguo', businessDate: '2026-09-14',
          name: '养小猫', description: '数学目标', threshold: 100, plannedDays: 30, reward: '动物园', activityId: 'cat', tasks: [{ taskId: 'task-8', weekdays: [1, 3, 5] }] });
        expect(created.ok).assertTrue();
        if (created.ok === false || created.value.goalId === undefined) return;
        const goalId = created.value.goalId;
        const changed = await module.execute(parent.value.token, { type: 'edit-task-pool-task', childId: 'guoguo', taskId: 'task-8', name: '数学练习', description: '一页',
          defaultRules: { completionPoints: 10, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } });
        expect(changed.ok).assertTrue();
        expect((await module.execute(parent.value.token, { type: 'disable-task-pool-task', childId: 'guoguo', taskId: 'task-8' })).ok).assertTrue();
        adapter.close();
        adapter = await ArkDataPersistenceAdapter.open(ability.context, storeName);
        const restarted = await FamilyHabitModule.create(adapter, hasher);
        const session = await restarted.openSession({ entry: 'parent', password: '2468' });
        expect(session.ok).assertTrue();
        if (session.ok === false) return;
        const detail = await restarted.inspect(session.value.token, { type: 'goal-detail', childId: 'guoguo', goalId });
        expect(detail.ok).assertTrue();
        if (detail.ok === false) return;
        expect(detail.value.goal.status).assertEqual('active');
        expect(detail.value.goal.points).assertEqual(0);
        expect(detail.value.goal.activityId).assertEqual('cat');
        expect(detail.value.goal.tasks[0].rules.completionPoints).assertEqual(5);
        expect(detail.value.goal.tasks[0].rules.streakCap).assertEqual(3);
        expect(detail.value.goal.tasks[0].weekdays.join(',')).assertEqual('1,3,5');
        const day = await restarted.inspect(session.value.token, { type: 'child-day', childId: 'guoguo', businessDate: '2026-09-14' });
        expect(day.ok).assertTrue();
        if (day.ok) expect(day.value.tasks[0].name).assertEqual('数学练习');
        const other = await restarted.inspect(session.value.token, { type: 'goal-list', childId: 'yangyang' });
        expect(other.ok).assertTrue();
        if (other.ok) expect(other.value.goals.length).assertEqual(0);
      } finally {
        adapter?.close();
        if (ability !== null) await relationalStore.deleteRdbStore(ability.context, storeName);
      }
    });

    it('[TASK-6-DB01][AC-13][AC-21][AC-32] 打卡清算关闭重开后保留积分', Level.LEVEL2, async () => {
      let adapter: ArkDataPersistenceAdapter | null = null;
      let ability: UIAbility | null = null;
      const storeName = 'settlement_contract_test.db';
      try {
        const delegator = abilityDelegatorRegistry.getAbilityDelegator();
        const want: Want = { bundleName: abilityDelegatorRegistry.getArguments().bundleName, abilityName: 'EntryAbility' };
        await delegator.startAbility(want);
        await Driver.create().waitForIdle(1000, 3000);
        ability = await delegator.getCurrentTopAbility();
        await relationalStore.deleteRdbStore(ability.context, storeName);
        adapter = await ArkDataPersistenceAdapter.open(ability.context, storeName);
        const module = await FamilyHabitModule.create(adapter, hasher);
        const setup = await module.openSession({ entry: 'parent-setup' });
        expect(setup.ok).assertTrue();
        if (setup.ok === false) return;
        expect((await module.execute(setup.value.token, { type: 'set-parent-password', password: '2468' })).ok).assertTrue();
        const parent = await module.openSession({ entry: 'parent', password: '2468' });
        expect(parent.ok).assertTrue();
        if (parent.ok === false) return;
        const copied = await module.execute(parent.value.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' });
        expect(copied.ok).assertTrue();
        if (copied.ok === false || copied.value.taskId === undefined) return;
        const taskId = copied.value.taskId;
        const created = await module.execute(parent.value.token, { type: 'create-goal', childId: 'guoguo', businessDate: '2026-09-14',
          name: '清算目标', description: '真实持久化', threshold: 100, plannedDays: 30, reward: '奖励', activityId: 'cat',
          tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 6, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }] });
        expect(created.ok).assertTrue();
        if (created.ok === false || created.value.goalId === undefined) return;
        const child = await module.openSession({ entry: 'child', childId: 'guoguo' });
        expect(child.ok).assertTrue();
        if (child.ok === false) return;
        const checkin = await module.execute(child.value.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' });
        expect(checkin.ok).assertTrue();
        const preview = await module.inspect(parent.value.token, { type: 'settlement-preview', childId: 'guoguo', businessDate: '2026-09-14' });
        expect(preview.ok).assertTrue();
        if (preview.ok === false) return;
        const confirmed = await module.execute(parent.value.token, { type: 'confirm-settlement', childId: 'guoguo', businessDate: '2026-09-14', expectedRevision: preview.value.revision });
        expect(confirmed.ok).assertTrue();
        adapter.close();
        adapter = await ArkDataPersistenceAdapter.open(ability.context, storeName);
        const restarted = await FamilyHabitModule.create(adapter, hasher);
        const session = await restarted.openSession({ entry: 'parent', password: '2468' });
        expect(session.ok).assertTrue();
        if (session.ok === false) return;
        const detail = await restarted.inspect(session.value.token, { type: 'goal-detail', childId: 'guoguo', goalId: created.value.goalId });
        expect(detail.ok).assertTrue();
        if (detail.ok === false) return;
        expect(detail.value.goal.points).assertEqual(6);
        expect(detail.value.goal.highestPoints).assertEqual(6);
      } finally {
        adapter?.close();
        if (ability !== null) await relationalStore.deleteRdbStore(ability.context, storeName);
      }
    });
  });
}
