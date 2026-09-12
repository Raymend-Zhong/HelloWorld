import { UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

import { FamilyHabitModule } from '../domain/FamilyHabitModule';
import { ArkDataPersistenceAdapter } from '../infrastructure/ArkDataPersistenceAdapter';
import { HarmonyPasswordHasher } from '../infrastructure/HarmonyPasswordHasher';

export default class EntryAbility extends UIAbility {
  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    const persistence = await ArkDataPersistenceAdapter.open(this.context);
    const module = await FamilyHabitModule.create(
      persistence,
      new HarmonyPasswordHasher(),
    );
    AppStorage.setOrCreate<FamilyHabitModule>('familyHabitModule', module);
    await windowStage.loadContent('pages/Index');
  }
}
