import { UIAbility, Want } from '@kit.AbilityKit';
import { relationalStore } from '@kit.ArkData';
import { abilityDelegatorRegistry, Driver } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';

import { FamilyHabitModule, PasswordHasher } from '../../../main/ets/domain/FamilyHabitModule';
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
  });
}
