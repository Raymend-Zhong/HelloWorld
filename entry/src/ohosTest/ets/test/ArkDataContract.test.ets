import { UIAbility, Want } from '@kit.AbilityKit';
import { abilityDelegatorRegistry, Driver } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';

import { ArkDataPersistenceAdapter } from '../../../main/ets/infrastructure/ArkDataPersistenceAdapter';

const delegator = abilityDelegatorRegistry.getAbilityDelegator();

export default function arkDataContractTest(): void {
  describe('[TASK-3] ArkData持久化合约', () => {
    it('[TASK-3][AC-01][AC-04] 提交后重新打开数据库可读取完整状态', Level.LEVEL2, async (done: Function) => {
      try {
        const driver = Driver.create();
        const want: Want = {
          bundleName: abilityDelegatorRegistry.getArguments().bundleName,
          abilityName: 'EntryAbility',
        };
        await delegator.startAbility(want);
        await driver.waitForIdle(3000, 5000);
        const ability: UIAbility = await delegator.getCurrentTopAbility();

        const firstAdapter = await ArkDataPersistenceAdapter.open(ability.context);
        const initialState = await firstAdapter.load();
        expect(initialState === null).assertFalse();
        if (initialState === null) return;
        expect(initialState.children.length).assertEqual(2);

        await firstAdapter.save({
          schemaVersion: initialState.schemaVersion,
          revision: initialState.revision + 1,
          children: initialState.children,
          parentCredential: initialState.parentCredential,
        });
        const reopenedAdapter = await ArkDataPersistenceAdapter.open(ability.context);
        const restoredState = await reopenedAdapter.load();
        expect(restoredState?.revision).assertEqual(initialState.revision + 1);
        expect(restoredState?.children[0].id).assertEqual('guoguo');
        expect(restoredState?.children[1].id).assertEqual('yangyang');
      } finally {
        done();
      }
    });
  });
}
