import { UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';

import { FamilyHabitModule } from '../domain/FamilyHabitModule';
import { ArkDataPersistenceAdapter } from '../infrastructure/ArkDataPersistenceAdapter';
import { HarmonyBackupFileAdapter } from '../infrastructure/BackupFileAdapter';
import { HarmonyPasswordHasher } from '../infrastructure/HarmonyPasswordHasher';

export default class EntryAbility extends UIAbility {
  async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
    try {
      const persistence = await ArkDataPersistenceAdapter.open(this.context);
      const module = await FamilyHabitModule.create(
        persistence,
        new HarmonyPasswordHasher(),
      );
      AppStorage.setOrCreate<FamilyHabitModule>('familyHabitModule', module);
      AppStorage.setOrCreate<HarmonyBackupFileAdapter>(
        'backupFileAdapter',
        new HarmonyBackupFileAdapter(this.context),
      );
      await windowStage.loadContent('pages/Index');
    } catch (_error) {
      await windowStage.loadContent('pages/StartupError');
    }
  }
}
