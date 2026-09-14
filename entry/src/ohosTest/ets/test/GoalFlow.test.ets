import { Want } from '@kit.AbilityKit';
import { abilityDelegatorRegistry, Driver, ON } from '@kit.TestKit';
import { describe, it, Level } from '@ohos/hypium';

async function finishInput(driver: Driver): Promise<void> {
  // 通过回车完成输入，避免设备输入法覆盖表单操作区。
  await driver.triggerKey(2054);
  await driver.waitForIdle(1000, 3000);
}

export default function goalFlowTest(): void {
  describe('TASK5GoalUI', () => {
    it('[TASK-5-UI01][AC-09][AC-10][AC-12] 创建字段校验编辑与详情', Level.LEVEL2, async () => {
      const delegator = abilityDelegatorRegistry.getAbilityDelegator();
      const want: Want = { bundleName: abilityDelegatorRegistry.getArguments().bundleName, abilityName: 'GoalTestAbility' };
      await delegator.startAbility(want);
      const driver = Driver.create();
      await driver.waitForIdle(1000, 3000);
      const taskName = '数学课外练习';
      await driver.assertComponentExist(ON.id('goal-new'));
      await (await driver.findComponent(ON.id('goal-new'))).click();
      await (await driver.findComponent(ON.id('goal-save'))).click();
      await driver.assertComponentExist(ON.id('goal-error-name'));
      const goalName = `养猫目标-${Date.now()}`;
      await (await driver.findComponent(ON.id('goal-name'))).inputText(goalName);
      await finishInput(driver);
      await (await (await driver.findComponent(ON.id('goal-editor-scroll'))).scrollSearch(ON.id('goal-reward'))).inputText('去动物园');
      await finishInput(driver);
      await (await driver.findComponent(ON.id('goal-save'))).click();
      await driver.assertComponentExist(ON.id('goal-error-activityId'));
      await (await driver.findComponent(ON.id('goal-activity-cat'))).click();
      await (await driver.findComponent(ON.id('goal-save'))).click();
      await driver.assertComponentExist(ON.id('goal-error-tasks'));
      await (await driver.findComponent(ON.id('goal-tasks-tab'))).click();
      await (await driver.findComponent(ON.text(`选择 · ${taskName}`))).click();
      await driver.assertComponentExist(ON.text(`已选择 · ${taskName}`));
      await driver.assertComponentExist(ON.text('每周完成日期'));
      await (await driver.findComponent(ON.id('goal-plan-weekly-task-3'))).click();
      const weeklyRequired = await driver.findComponent(ON.id('goal-weekly-required-task-3'));
      await weeklyRequired.inputText('3');
      await finishInput(driver);
      await (await driver.findComponent(ON.id('goal-save'))).click();
      await driver.assertComponentExist(ON.id('goal-detail'));
      await driver.assertComponentExist(ON.text(goalName));
      await driver.assertComponentExist(ON.text('进行中 · 0 / 100 分'));
      await driver.assertComponentExist(ON.text('每周完成 3 次'));
      await (await driver.findComponent(ON.id('goal-edit'))).click();
      await (await driver.findComponent(ON.id('goal-name'))).inputText(`${goalName}已编辑`);
      await finishInput(driver);
      await (await driver.findComponent(ON.id('goal-save'))).click();
      await driver.assertComponentExist(ON.text(`${goalName}已编辑`));
      await (await driver.findComponent(ON.id('goal-detail-back'))).click();
      await (await driver.findComponent(ON.id('goals-yangyang'))).click();
      await driver.assertComponentExist(ON.text('阳阳的打卡目标'));
      await (await driver.findComponent(ON.id('goals-back'))).click();
      await driver.assertComponentExist(ON.id('goal-fixture-finished'));

    });
  });
}
