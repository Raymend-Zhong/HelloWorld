import { UIAbility } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { FamilyHabitModule, MemoryPersistenceAdapter, PasswordHasher } from '../../../main/ets/domain/FamilyHabitModule';

const hasher: PasswordHasher = {
  async createSalt(): Promise<string> { return '页面测试盐'; },
  async derive(password: string, salt: string): Promise<string> { return `${salt}:${password}`; },
  async verify(password: string, salt: string, digest: string): Promise<boolean> { return digest === `${salt}:${password}`; },
};

export default class GoalTestAbility extends UIAbility {
  async onWindowStageCreate(stage: window.WindowStage): Promise<void> {
    const module = await FamilyHabitModule.create(new MemoryPersistenceAdapter(), hasher);
    const setup = await module.openSession({ entry: 'parent-setup' });
    if (setup.ok === false) throw new Error('准备测试会话失败。');
    const saved = await module.execute(setup.value.token, { type: 'set-parent-password', password: '2468' });
    if (saved.ok === false) throw new Error('准备测试家长失败。');
    const parent = await module.openSession({ entry: 'parent', password: '2468' });
    if (parent.ok === false) throw new Error('准备测试家长失败。');
    const task = await module.execute(parent.value.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' });
    if (task.ok === false) throw new Error('准备目标任务失败。');
    AppStorage.setOrCreate<FamilyHabitModule>('goalTestModule', module);
    AppStorage.setOrCreate<string>('goalTestParent', parent.value.token);
    await stage.loadContent('testability/pages/GoalFixture');
  }
}
