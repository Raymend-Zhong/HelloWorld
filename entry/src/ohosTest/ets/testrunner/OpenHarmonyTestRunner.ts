import { abilityDelegatorRegistry, TestRunner } from '@kit.TestKit';

export default class OpenHarmonyTestRunner implements TestRunner {
  onPrepare(): void {}

  async onRun(): Promise<void> {
    const argumentsValue = abilityDelegatorRegistry.getArguments();
    const delegator = abilityDelegatorRegistry.getAbilityDelegator();
    const command = `aa start -d 0 -a TestAbility -b ${argumentsValue.bundleName}`;
    await delegator.executeShellCommand(command);
  }
}
