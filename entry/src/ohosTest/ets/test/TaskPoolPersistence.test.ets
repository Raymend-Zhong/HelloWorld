import { UIAbility, Want } from '@kit.AbilityKit';
import { relationalStore } from '@kit.ArkData';
import { abilityDelegatorRegistry, Driver } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';
import { FamilyHabitModule, FamilyState, PasswordHasher } from '../../../main/ets/domain/FamilyHabitModule';
import { ArkDataPersistenceAdapter } from '../../../main/ets/infrastructure/ArkDataPersistenceAdapter';

const hasher: PasswordHasher = {
  async createSalt(): Promise<string> { return '任务池合约盐'; },
  async derive(password: string, salt: string): Promise<string> { return `${salt}:${password}`; },
  async verify(password: string, salt: string, digest: string): Promise<boolean> { return digest === `${salt}:${password}`; },
};

export default function taskPoolPersistenceTest(): void {
  describe('[TASK-4] 任务池持久化', () => {
    it('[TASK-4-DB01][AC-06][AC-07][AC-08部分] 旧模式升级后复制编辑停用并关闭重开', Level.LEVEL2, async (done: Function) => {
      let adapter: ArkDataPersistenceAdapter | null = null;
      let ability: UIAbility | null = null;
      const storeName = 'task_pool_contract_test.db';
      try {
        const delegator = abilityDelegatorRegistry.getAbilityDelegator();
        const want: Want = { bundleName: abilityDelegatorRegistry.getArguments().bundleName, abilityName: 'EntryAbility' };
        await delegator.startAbility(want);
        await Driver.create().waitForIdle(1000, 3000);
        ability = await delegator.getCurrentTopAbility();
        await relationalStore.deleteRdbStore(ability.context, storeName);
        adapter = await ArkDataPersistenceAdapter.open(ability.context, storeName);
        const old: FamilyState = {
          schemaVersion: 1, revision: 7,
          children: [
            { id: 'guoguo', displayName: '果果', avatar: 'guoguo', theme: 'mature' },
            { id: 'yangyang', displayName: '阳阳', avatar: 'yangyang', theme: 'playful' },
          ],
          parentCredential: { salt: '旧盐', digest: '旧盐:2468' },
        };
        await adapter.save(old);
        const module = await FamilyHabitModule.create(adapter, hasher);
        const parent = await module.openSession({ entry: 'parent', password: '2468' });
        expect(parent.ok).assertTrue();
        if (parent.ok === false) return;
        const copied = await module.execute(parent.value.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' });
        expect(copied.ok).assertTrue();
        if (copied.ok === false || copied.value.taskId === undefined) return;
        const taskId = copied.value.taskId;
        const edited = await module.execute(parent.value.token, {
          type: 'edit-task-pool-task', childId: 'guoguo', taskId,
          name: '每天数学一页', description: '完成后一起检查',
          defaultRules: { completionPoints: 5, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: true, streakCap: null },
        });
        expect(edited.ok).assertTrue();
        const disabled = await module.execute(parent.value.token, { type: 'disable-task-pool-task', childId: 'guoguo', taskId });
        expect(disabled.ok).assertTrue();
        adapter.close();
        adapter = await ArkDataPersistenceAdapter.open(ability.context, storeName);
        const restarted = await FamilyHabitModule.create(adapter, hasher);
        const session = await restarted.openSession({ entry: 'parent', password: '2468' });
        expect(session.ok).assertTrue();
        if (session.ok === false) return;
        const pool = await restarted.inspect(session.value.token, { type: 'task-pool', childId: 'guoguo' });
        expect(pool.ok).assertTrue();
        if (pool.ok === false) return;
        expect(pool.value.tasks.length).assertEqual(1);
        expect(pool.value.tasks[0].id).assertEqual(taskId);
        expect(pool.value.tasks[0].name).assertEqual('每天数学一页');
        expect(pool.value.tasks[0].description).assertEqual('完成后一起检查');
        expect(pool.value.tasks[0].disabled).assertTrue();
        expect(pool.value.tasks[0].defaultRules.completionPoints).assertEqual(5);
        expect(pool.value.tasks[0].defaultRules.streakCap).assertEqual(null);
        const other = await restarted.inspect(session.value.token, { type: 'task-pool', childId: 'yangyang' });
        expect(other.ok).assertTrue();
        if (other.ok) expect(other.value.tasks.length).assertEqual(0);
      } finally {
        adapter?.close();
        if (ability !== null) await relationalStore.deleteRdbStore(ability.context, storeName);
        done();
      }
    });
  });
}
