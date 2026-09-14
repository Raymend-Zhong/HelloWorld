import { ChildId, FamilyHabitModule, TaskPoolTask } from '../domain/FamilyHabitModule';
import { TaskRules, TaskStage, TaskTemplate } from '../domain/TaskTemplates';

type PoolView = 'pool' | 'templates' | 'edit';

@Component
export struct TaskPoolPanel {
  module: FamilyHabitModule = AppStorage.get<FamilyHabitModule>('familyHabitModule') as FamilyHabitModule;
  parentToken: string = '';
  onBack: () => void = () => {};
  @State private childId: ChildId = 'guoguo';
  @State private childName: string = '果果';
  @State private tasks: TaskPoolTask[] = [];
  @State private templates: TaskTemplate[] = [];
  @State private stage: TaskStage = 'junior';
  @State private view: PoolView = 'pool';
  @State private busy: boolean = false;
  @State private message: string = '';
  @State private taskName: string = '';
  @State private description: string = '';
  @State private completionPoints: string = '1';
  @State private deductionPoints: string = '0';
  @State private deduct: boolean = false;
  @State private streakEnabled: boolean = false;
  @State private streakCap: string = '';
  @State private disabled: boolean = false;
  private editingId: string = '';

  aboutToAppear(): void {
    this.selectChild('guoguo');
  }

  private async refreshPool(): Promise<boolean> {
    const result = await this.module.inspect(this.parentToken, { type: 'task-pool', childId: this.childId });
    if (result.ok === false) {
      this.message = result.error.message;
      return false;
    }
    this.tasks = result.value.tasks;
    this.childName = result.value.currentChild.displayName;
    return true;
  }

  private async selectChild(childId: ChildId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.message = '';
    this.childId = childId;
    this.stage = childId === 'guoguo' ? 'junior' : 'kindergarten';
    await this.refreshPool();
    this.busy = false;
  }

  private async showTemplates(stage: TaskStage): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = await this.module.inspect(this.parentToken, { type: 'task-templates', stage });
    if (result.ok === false) {
      this.message = result.error.message;
    } else {
      this.templates = result.value.templates;
      this.stage = stage;
      this.message = '';
      this.view = 'templates';
    }
    this.busy = false;
  }

  private edit(task: TaskPoolTask): void {
    this.editingId = task.id;
    this.taskName = task.name;
    this.description = task.description;
    this.completionPoints = `${task.defaultRules.completionPoints}`;
    this.deductionPoints = `${task.defaultRules.deductionPoints}`;
    this.deduct = task.defaultRules.missedPolicy === 'deduct';
    this.streakEnabled = task.defaultRules.streakEnabled;
    this.streakCap = task.defaultRules.streakCap === null ? '' : `${task.defaultRules.streakCap}`;
    this.disabled = task.disabled;
    this.message = '';
    this.view = 'edit';
  }

  private async copy(templateId: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = await this.module.execute(this.parentToken, { type: 'copy-task-template', childId: this.childId, templateId });
    if (result.ok === false) {
      this.message = result.error.message;
    } else if (await this.refreshPool()) {
      const task = this.tasks.find(item => item.id === result.value.taskId);
      if (task !== undefined) this.edit(task);
    }
    this.busy = false;
  }

  private async save(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const defaultRules: TaskRules = {
      completionPoints: this.completionPoints.trim() === '' ? NaN : Number(this.completionPoints),
      missedPolicy: this.deduct ? 'deduct' : 'no-points',
      deductionPoints: this.deductionPoints.trim() === '' ? NaN : Number(this.deductionPoints),
      streakEnabled: this.streakEnabled,
      streakCap: this.streakCap.trim() === '' ? null : Number(this.streakCap),
    };
    const result = await this.module.execute(this.parentToken, {
      type: 'edit-task-pool-task', childId: this.childId, taskId: this.editingId,
      name: this.taskName, description: this.description, defaultRules,
    });
    if (result.ok === false) {
      this.message = result.error.message;
    } else if (await this.refreshPool()) {
      this.message = '任务已保存。';
      this.view = 'pool';
    }
    this.busy = false;
  }

  private async disable(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const result = await this.module.execute(this.parentToken, {
      type: 'disable-task-pool-task', childId: this.childId, taskId: this.editingId,
    });
    if (result.ok === false) {
      this.message = result.error.message;
    } else if (await this.refreshPool()) {
      this.message = '任务已停用，原有数据已保留。';
      this.view = 'pool';
    }
    this.busy = false;
  }

  @Builder
  private PoolList() {
    Row({ space: 12 }) {
      Button('果果').id('pool-guoguo').enabled(!this.busy && this.childId !== 'guoguo')
        .onClick(() => this.selectChild('guoguo'))
      Button('阳阳').id('pool-yangyang').enabled(!this.busy && this.childId !== 'yangyang')
        .onClick(() => this.selectChild('yangyang'))
      Blank()
      Button('从模板添加').id('task-add-template').enabled(!this.busy)
        .onClick(() => this.showTemplates(this.stage))
    }.width('100%')
    Scroll() {
      Column({ space: 12 }) {
        if (this.tasks.length === 0) {
          Text('任务池还是空的，从适龄模板添加第一项任务吧。').fontSize(18).padding(24)
        }
        ForEach(this.tasks, (task: TaskPoolTask) => {
          Column({ space: 8 }) {
            Button(task.name).fontSize(21).fontColor('#3E352F').backgroundColor('#F6EFE5')
              .id(`task-open-${task.id}`).width('100%').height(52).enabled(!this.busy)
              .onClick(() => this.edit(task))
            Text(`${task.disabled ? '已停用' : '使用中'} · 完成 ${task.defaultRules.completionPoints} 分`)
              .fontSize(16).fontColor('#65584F')
          }.width('100%').padding(12).backgroundColor('#FFFFFF').borderRadius(16)
        }, (task: TaskPoolTask) => task.id)
      }.width('100%')
    }.layoutWeight(1).width('100%')
    Button('返回家长管理').id('task-pool-back').enabled(!this.busy).onClick(() => this.onBack())
  }

  @Builder
  private TemplateList() {
    Row({ space: 12 }) {
      Button('初中模板').id('templates-junior').enabled(!this.busy && this.stage !== 'junior')
        .onClick(() => this.showTemplates('junior'))
      Button('幼儿园模板').id('templates-kindergarten').enabled(!this.busy && this.stage !== 'kindergarten')
        .onClick(() => this.showTemplates('kindergarten'))
    }
    Text(`复制到${this.childName}的任务池，之后可以独立修改。`).fontSize(17)
    Scroll() {
      Column({ space: 12 }) {
        ForEach(this.templates, (item: TaskTemplate) => {
          Button(`添加 · ${item.name}`).id(`template-copy-${item.id}`)
            .width('100%').height(56).fontSize(20).enabled(!this.busy)
            .onClick(() => this.copy(item.id))
        }, (item: TaskTemplate) => item.id)
      }.width('100%')
    }.layoutWeight(1).width('100%')
    Button('返回任务池').enabled(!this.busy).onClick(() => { this.message = ''; this.view = 'pool'; })
  }

  @Builder
  private Editor() {
    if (this.disabled) {
      Text('已停用，任务数据已保留。').fontSize(18).fontColor('#8A5C45')
    }
    Scroll() {
      Column({ space: 12 }) {
        Text('任务名称').fontSize(17)
        TextInput({ text: this.taskName, placeholder: '请输入任务名称' }).id('task-name')
          .onChange((text: string) => this.taskName = text)
        Text('任务描述').fontSize(17)
        TextInput({ text: this.description, placeholder: '给孩子的具体说明' }).id('task-description')
          .onChange((text: string) => this.description = text)
        Text('完成积分（正整数）').fontSize(17)
        TextInput({ text: this.completionPoints }).id('task-completion-points').type(InputType.Number)
          .onChange((text: string) => this.completionPoints = text)
        Row({ space: 16 }) {
          Text('未完成时扣分').fontSize(17)
          Toggle({ type: ToggleType.Switch, isOn: this.deduct }).id('task-deduct-enabled')
            .onChange((enabled: boolean) => this.deduct = enabled)
          Text(this.deduct ? '扣分' : '不得分').fontSize(16)
        }
        Text('扣分值（非负整数）').fontSize(17)
        TextInput({ text: this.deductionPoints }).id('task-deduction-points').type(InputType.Number)
          .onChange((text: string) => this.deductionPoints = text)
        Row({ space: 16 }) {
          Text('连续奖励').fontSize(17)
          Toggle({ type: ToggleType.Switch, isOn: this.streakEnabled }).id('task-streak-enabled')
            .onChange((enabled: boolean) => this.streakEnabled = enabled)
        }
        Text('连续奖励上限（留空表示不限）').fontSize(17)
        TextInput({ text: this.streakCap, placeholder: '不限' }).id('task-streak-cap').type(InputType.Number)
          .onChange((text: string) => this.streakCap = text)
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 20 })
    }.layoutWeight(1).width('100%')
    Row({ space: 16 }) {
      Button('返回任务池').id('task-editor-back').enabled(!this.busy)
        .onClick(() => { this.message = ''; this.view = 'pool'; })
      Button('保存任务').id('task-save').enabled(!this.busy).onClick(() => this.save())
      if (!this.disabled) {
        Button('停用任务').id('task-disable').enabled(!this.busy).backgroundColor('#8A5C45')
          .onClick(() => this.disable())
      }
    }
  }

  build() {
    Column({ space: 16 }) {
      Text(`${this.childName}的任务池`).fontSize(28).fontWeight(FontWeight.Bold).fontColor('#3E352F')
      if (this.message !== '') {
        Text(this.message).id('task-message').fontSize(17).fontColor('#8A5C45')
      }
      if (this.view === 'pool') {
        this.PoolList()
      } else if (this.view === 'templates') {
        this.TemplateList()
      } else {
        this.Editor()
      }
    }.width('100%').height('100%').padding(24).backgroundColor('#FFF9EF')
  }
}
