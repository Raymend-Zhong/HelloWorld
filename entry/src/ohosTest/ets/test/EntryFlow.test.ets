import { Want } from '@kit.AbilityKit';
import { abilityDelegatorRegistry, Driver, ON } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';

const delegator = abilityDelegatorRegistry.getAbilityDelegator();

export default function entryFlowTest(): void {
  describe('[TASK-3] ArkUI入口流程', () => {
    it('[TASK-3][AC-01][AC-02][AC-03][AC-04] 孩子切换与家长门禁', Level.LEVEL2, async (done: Function) => {
      try {
        const driver = Driver.create();
        const want: Want = {
          bundleName: abilityDelegatorRegistry.getArguments().bundleName,
          abilityName: 'EntryAbility',
        };
        await delegator.startAbility(want);
        await driver.waitForIdle(3000, 5000);

        await (await driver.findComponent(ON.id('entry-guoguo'))).click();
        await driver.waitForIdle(1000, 3000);
        const childName = await driver.findComponent(ON.id('child-current-name'));
        expect(await childName.getText()).assertEqual('果果的成长打卡');

        await (await driver.findComponent(ON.id('switch-yangyang'))).click();
        await driver.waitForIdle(1000, 3000);
        const switchedChildName = await driver.findComponent(ON.id('child-current-name'));
        expect(await switchedChildName.getText()).assertEqual('阳阳的成长打卡');

        await (await driver.findComponent(ON.text('返回入口'))).click();
        await (await driver.findComponent(ON.id('entry-parent'))).click();
        const password = await driver.findComponent(ON.id('parent-password-input'));
        await password.inputText('2468');
        await (await driver.findComponent(ON.id('parent-submit'))).click();
        await driver.assertComponentExist(ON.id('parent-screen'));

        await (await driver.findComponent(ON.text('退出家长端'))).click();
        await (await driver.findComponent(ON.id('entry-parent'))).click();
        await (await driver.findComponent(ON.id('parent-password-input'))).inputText('0000');
        await (await driver.findComponent(ON.id('parent-submit'))).click();
        await driver.assertComponentExist(ON.text('家长密码错误。'));
      } finally {
        done();
      }
    });
  });
}
