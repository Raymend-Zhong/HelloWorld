import { UIAbility, Want } from '@kit.AbilityKit';
import { relationalStore } from '@kit.ArkData';
import { abilityDelegatorRegistry, Driver } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';

import { FamilyBackup, FamilyHabitModule, PasswordHasher } from '../../../main/ets/domain/FamilyHabitModule';
import { ArkDataPersistenceAdapter } from '../../../main/ets/infrastructure/ArkDataPersistenceAdapter';

const delegator = abilityDelegatorRegistry.getAbilityDelegator();
const TEST_STORE = 'family_habit_contract_test.db';
const passwordHasher: PasswordHasher = {
  async createSalt(): Promise<string> {
    return 'test-salt';
  },
  async derive(password: string, salt: string): Promise<string> {
    return `${salt}:${password.split('').reverse().join('')}`;
  },
  async verify(password: string, salt: string, digest: string): Promise<boolean> {
    return digest === `${salt}:${password.split('').reverse().join('')}`;
  },
};

export default function arkDataContractTest(): void {
  describe('[TASK-3] ArkData持久化合约', () => {
    it('[TASK-3][AC-01][AC-04] 提交后重新打开数据库可读取完整状态', Level.LEVEL2, async (done: Function) => {
      let firstAdapter: ArkDataPersistenceAdapter | null = null;
      let reopenedAdapter: ArkDataPersistenceAdapter | null = null;
      let ability: UIAbility | null = null;
      try {
        const driver = Driver.create();
        const want: Want = {
          bundleName: abilityDelegatorRegistry.getArguments().bundleName,
          abilityName: 'EntryAbility',
        };
        await delegator.startAbility(want);
        await driver.waitForIdle(3000, 5000);
        ability = await delegator.getCurrentTopAbility();

        await relationalStore.deleteRdbStore(ability.context, TEST_STORE);
        firstAdapter = await ArkDataPersistenceAdapter.open(
          ability.context,
          TEST_STORE,
        );
        const firstModule = await FamilyHabitModule.create(firstAdapter, passwordHasher);
        const setup = await firstModule.openSession({ entry: 'parent-setup' });
        expect(setup.ok).assertTrue();
        if (!setup.ok) return;
        const overview = await firstModule.inspect(setup.value.token, {
          type: 'family-overview',
        });
        expect(overview.ok).assertTrue();
        if (!overview.ok) return;
        expect(overview.value.children.length).assertEqual(2);
        const passwordSaved = await firstModule.execute(setup.value.token, {
          type: 'set-parent-password',
          password: '2468',
        });
        expect(passwordSaved.ok).assertTrue();
        firstAdapter.close();
        firstAdapter = null;

        reopenedAdapter = await ArkDataPersistenceAdapter.open(
          ability.context,
          TEST_STORE,
        );
        const restartedModule = await FamilyHabitModule.create(
          reopenedAdapter,
          passwordHasher,
        );
        const parent = await restartedModule.openSession({
          entry: 'parent',
          password: '2468',
        });
        expect(parent.ok).assertTrue();
        if (!parent.ok) return;
        const restoredOverview = await restartedModule.inspect(parent.value.token, {
          type: 'family-overview',
        });
        expect(restoredOverview.ok).assertTrue();
        if (restoredOverview.ok) {
          expect(restoredOverview.value.children[0].id).assertEqual('guoguo');
          expect(restoredOverview.value.children[1].id).assertEqual('yangyang');
        }
      } finally {
        firstAdapter?.close();
        reopenedAdapter?.close();
        if (ability !== null) {
          await relationalStore.deleteRdbStore(ability.context, TEST_STORE);
        }
        done();
      }
    });

    it('[TASK-12-DB01][AC-48][AC-50][AC-55] JSON备份恢复后关闭重开保持完整领域数据且保留当前密码', Level.LEVEL2, async (done: Function) => {
      let sourceAdapter: ArkDataPersistenceAdapter | null = null;
      let targetAdapter: ArkDataPersistenceAdapter | null = null;
      let reopenedAdapter: ArkDataPersistenceAdapter | null = null;
      let ability: UIAbility | null = null;
      const sourceStore = 'backup_source_contract_test.db';
      const targetStore = 'backup_target_contract_test.db';
      try {
        const driver = Driver.create();
        const want: Want = {
          bundleName: abilityDelegatorRegistry.getArguments().bundleName,
          abilityName: 'EntryAbility',
        };
        await delegator.startAbility(want);
        await driver.waitForIdle(3000, 5000);
        ability = await delegator.getCurrentTopAbility();

        await relationalStore.deleteRdbStore(ability.context, sourceStore);
        await relationalStore.deleteRdbStore(ability.context, targetStore);
        sourceAdapter = await ArkDataPersistenceAdapter.open(ability.context, sourceStore);
        const sourceModule = await FamilyHabitModule.create(sourceAdapter, passwordHasher);
        const sourceSetup = await sourceModule.openSession({ entry: 'parent-setup' });
        expect(sourceSetup.ok).assertTrue();
        if (sourceSetup.ok === false) return;
        expect((await sourceModule.execute(sourceSetup.value.token, { type: 'set-parent-password', password: '2468' })).ok).assertTrue();
        const sourceParent = await sourceModule.openSession({ entry: 'parent', password: '2468' });
        expect(sourceParent.ok).assertTrue();
        if (sourceParent.ok === false) return;
        const copied = await sourceModule.execute(sourceParent.value.token, {
          type: 'copy-task-template',
          childId: 'guoguo',
          templateId: 'junior-math',
        });
        expect(copied.ok).assertTrue();
        if (copied.ok === false || copied.value.taskId === undefined) return;
        const created = await sourceModule.execute(sourceParent.value.token, {
          type: 'create-goal',
          childId: 'guoguo',
          businessDate: '2026-09-14',
          name: '备份恢复目标',
          description: '真实数据库恢复',
          threshold: 100,
          plannedDays: 30,
          reward: '奖励',
          activityId: 'cat',
          tasks: [{ taskId: copied.value.taskId, weekdays: [1], rules: { completionPoints: 6, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }],
        });
        expect(created.ok).assertTrue();
        if (created.ok === false || created.value.goalId === undefined) return;
        const backupResult = await sourceModule.inspect(sourceParent.value.token, { type: 'backup-export' });
        expect(backupResult.ok).assertTrue();
        if (backupResult.ok === false) return;
        const backup: FamilyBackup = backupResult.value;
        sourceAdapter.close();
        sourceAdapter = null;

        targetAdapter = await ArkDataPersistenceAdapter.open(ability.context, targetStore);
        const targetModule = await FamilyHabitModule.create(targetAdapter, passwordHasher);
        const targetSetup = await targetModule.openSession({ entry: 'parent-setup' });
        expect(targetSetup.ok).assertTrue();
        if (targetSetup.ok === false) return;
        expect((await targetModule.execute(targetSetup.value.token, { type: 'set-parent-password', password: '1357' })).ok).assertTrue();
        const targetParent = await targetModule.openSession({ entry: 'parent', password: '1357' });
        expect(targetParent.ok).assertTrue();
        if (targetParent.ok === false) return;
        expect((await targetModule.execute(targetParent.value.token, { type: 'restore-backup', backup })).ok).assertTrue();
        targetAdapter.close();
        targetAdapter = null;

        reopenedAdapter = await ArkDataPersistenceAdapter.open(ability.context, targetStore);
        const restarted = await FamilyHabitModule.create(reopenedAdapter, passwordHasher);
        const oldPassword = await restarted.openSession({ entry: 'parent', password: '2468' });
        expect(oldPassword.ok).assertFalse();
        const restoredParent = await restarted.openSession({ entry: 'parent', password: '1357' });
        expect(restoredParent.ok).assertTrue();
        if (restoredParent.ok === false) return;
        const restored = await restarted.inspect(restoredParent.value.token, { type: 'backup-export' });
        expect(restored.ok).assertTrue();
        if (restored.ok) {
          expect(JSON.stringify(restored.value.data)).assertEqual(JSON.stringify(backup.data));
        }
      } finally {
        sourceAdapter?.close();
        targetAdapter?.close();
        reopenedAdapter?.close();
        if (ability !== null) {
          await relationalStore.deleteRdbStore(ability.context, sourceStore);
          await relationalStore.deleteRdbStore(ability.context, targetStore);
        }
        done();
      }
    });
  });
}
