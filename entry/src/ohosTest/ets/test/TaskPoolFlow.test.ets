import { Want } from '@kit.AbilityKit';
import { abilityDelegatorRegistry, Driver, ON } from '@kit.TestKit';
import { describe, expect, it, Level } from '@ohos/hypium';

export default function taskPoolFlowTest(): void {
  describe('[TASK-4] 家长任务池', () => {
    it('[TASK-4-UI01][AC-06][AC-08部分] 复制编辑校验与停用', Level.LEVEL2, async (done: Function) => {
      try {
        const delegator = abilityDelegatorRegistry.getAbilityDelegator();
        const want: Want = { bundleName: abilityDelegatorRegistry.getArguments().bundleName, abilityName: 'EntryAbility' };
        await delegator.startAbility(want);
        const driver = Driver.create();
        await driver.waitForIdle(1000, 3000);
        await (await driver.findComponent(ON.id('entry-parent'))).click();
        await (await driver.findComponent(ON.id('parent-password-input'))).inputText('2468');
        await (await driver.findComponent(ON.id('parent-submit'))).click();
        await driver.assertComponentExist(ON.id('parent-screen'));
        await (await driver.findComponent(ON.id('parent-task-pool'))).click();
        await driver.assertComponentExist(ON.text('果果的任务池'));
        await (await driver.findComponent(ON.id('task-add-template'))).click();
        await (await driver.findComponent(ON.id('template-copy-junior-math'))).click();
        const taskName = `数学练习-${Date.now()}`;
        await (await driver.findComponent(ON.id('task-name'))).inputText(taskName);
        await (await driver.findComponent(ON.id('task-completion-points'))).inputText('0');
        await (await driver.findComponent(ON.id('task-save'))).click();
        await driver.assertComponentExist(ON.text('完成积分须为正整数，扣分值和连续奖励上限须为非负整数。'));
        await (await driver.findComponent(ON.id('task-completion-points'))).inputText('5');
        await (await driver.findComponent(ON.id('task-save'))).click();
        await driver.assertComponentExist(ON.text(taskName));
        await (await driver.findComponent(ON.id('pool-yangyang'))).click();
        await driver.assertComponentExist(ON.text('阳阳的任务池'));
        expect((await driver.findComponents(ON.text(taskName))).length).assertEqual(0);
        await (await driver.findComponent(ON.id('pool-guoguo'))).click();
        await (await driver.findComponent(ON.text(taskName))).click();
        await (await driver.findComponent(ON.id('task-disable'))).click();
        await (await driver.findComponent(ON.text(taskName))).click();
        await driver.assertComponentExist(ON.text('已停用，任务数据已保留。'));
        await (await driver.findComponent(ON.id('task-editor-back'))).click();
        await (await driver.findComponent(ON.id('task-pool-back'))).click();
        await (await driver.findComponent(ON.text('退出家长端'))).click();
      } finally {
        done();
      }
    });
  });
}
