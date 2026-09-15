import { common } from '@kit.AbilityKit';
import { picker, fileIo } from '@kit.CoreFileKit';

export interface BackupFileAdapter {
  saveBackup(fileName: string, content: string): Promise<string | null>;
  readBackup(): Promise<string | null>;
}

export class HarmonyBackupFileAdapter implements BackupFileAdapter {
  constructor(private readonly context: common.UIAbilityContext) {}

  async saveBackup(fileName: string, content: string): Promise<string | null> {
    const options = new picker.DocumentSaveOptions();
    options.newFileNames = [fileName];
    options.fileSuffixChoices = ['json'];
    const uris = await new picker.DocumentViewPicker(this.context).save(options);
    if (uris.length === 0) return null;
    const file = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
    try {
      fileIo.writeSync(file.fd, content);
    } finally {
      fileIo.closeSync(file);
    }
    return uris[0];
  }

  async readBackup(): Promise<string | null> {
    const options = new picker.DocumentSelectOptions();
    options.fileSuffixFilters = ['.json'];
    const uris = await new picker.DocumentViewPicker(this.context).select(options);
    if (uris.length === 0) return null;
    return fileIo.readTextSync(uris[0]);
  }
}
