import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { abilityDelegatorRegistry } from '@kit.TestKit';
import { Hypium } from '@ohos/hypium';

import testsuite from '../test/List.test';

export default class TestAbility extends UIAbility {
  onCreate(_want: Want, _launchParam: AbilityConstant.LaunchParam): void {
    Hypium.hypiumTest(
      abilityDelegatorRegistry.getAbilityDelegator(),
      abilityDelegatorRegistry.getArguments(),
      testsuite,
    );
  }

  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    await windowStage.loadContent('testability/pages/Index');
  }
}
