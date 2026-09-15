import { TaskDraft, GoalTaskEditor } from './GoalTaskEditor';
import { ChildId, FamilyHabitModule, TaskPoolTask, CreateGoalCommand, EditGoalCommand } from '../domain/FamilyHabitModule';
import { Goal, GoalTask, GoalTaskInput, GrowthActivity } from '../domain/Goals';
import { TaskRules } from '../domain/TaskTemplates';

export function localBusinessDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

@Component
export struct GoalPanel {
  module: FamilyHabitModule = AppStorage.get<FamilyHabitModule>('familyHabitModule') as FamilyHabitModule;
  parentToken: string = '';
  onBack: () => void = () => {};
  @State private childId: ChildId = 'guoguo';
  @State private childName: string = '果果';
  @State private view: string = 'list';
  @State private tab: string = 'basic';
  @State private busy: boolean = false;
  @State private goals: Goal[] = [];
  @State private pool: TaskPoolTask[] = [];
  @State private activities: GrowthActivity[] = [];
  @State private detail: Goal | null = null;
  @State private name: string = '';
  @State private description: string = '';
  @State private threshold: string = '100';
  @State private plannedDays: string = '30';
  @State private reward: string = '';
  @State private activityId: string = '';
  @State private tasks: TaskDraft[] = [];
  @State private message: string = '';
  @State private errorField: string = '';
  private editingId: string = '';

  aboutToAppear(): void { this.load('guoguo'); }

  private async load(childId: ChildId): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const list = await this.module.inspect(this.parentToken, { type: 'goal-list', childId });
    const pool = await this.module.inspect(this.parentToken, { type: 'task-pool', childId });
    const activities = await this.module.inspect(this.parentToken, { type: 'growth-activities' });
    if (list.ok && pool.ok && activities.ok) {
      this.childId = childId;
      this.childName = pool.value.currentChild.displayName;
      this.goals = list.value.goals;
      this.pool = pool.value.tasks;
      this.activities = activities.value.activities;
      this.message = '';
    } else {
      this.message = '读取目标失败，请返回后重试。';
    }
    this.busy = false;
  }

  private activityName(id: string): string {
    return this.activities.find(activity => activity.id === id)?.name ?? '养成活动';
  }

  private taskName(id: string): string {
    const task = this.pool.find(item => item.id === id);
    return task === undefined ? '任务已变化' : `${task.name}${task.disabled ? '（已停用，保留引用）' : ''}`;
  }

  private weekdayName(day: number): string { return ['一', '二', '三', '四', '五', '六', '日'][day - 1]; }

  private statusName(goal: Goal): string {
    if (goal.status === 'achieved') return '已达成';
    if (goal.status === 'terminated') return '已终止';
    return '进行中';
  }

  private beginEdit(goal: Goal | null): void {
    this.editingId = goal?.id ?? '';
    this.name = goal?.name ?? '';
    this.description = goal?.description ?? '';
    this.threshold = `${goal?.threshold ?? 100}`;
    this.plannedDays = `${goal?.plannedDays ?? 30}`;
    this.reward = goal?.reward ?? '';
    this.activityId = goal?.activityId ?? '';
    this.tasks = this.pool.filter(task => !task.disabled || goal?.tasks.some(item => item.taskId === task.id))
      .map(task => new TaskDraft(task, goal?.tasks.find(item => item.taskId === task.id)));
    this.tab = 'basic';
    this.message = '';
    this.errorField = '';
    this.view = 'edit';
  }

  private async showDetail(goalId: string): Promise<void> {
    const result = await this.module.inspect(this.parentToken, { type: 'goal-detail', childId: this.childId, goalId });
    if (result.ok === false) { this.message = result.error.message; return; }
    this.detail = result.value.goal;
    this.errorField = '';
    this.message = '';
    this.view = 'detail';
  }

  private number(text: string): number { return text.trim() === '' ? NaN : Number(text); }

  private async save(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const selected: GoalTaskInput[] = this.tasks.filter(task => task.selected).map(task => {
      const rules: TaskRules = { completionPoints: this.number(task.completion), deductionPoints: this.number(task.deduction),
        missedPolicy: task.deduct ? 'deduct' : 'no-points', streakEnabled: task.streak,
        streakCap: task.cap.trim() === '' ? null : Number(task.cap) };
      const input: GoalTaskInput = task.planKind === 'weekly-frequency'
        ? { taskId: task.taskId, plan: { kind: 'weekly-frequency', requiredCount: this.number(task.requiredCount) }, rules }
        : { taskId: task.taskId, weekdays: [...task.weekdays], rules };
      return input;
    });
    const creating: CreateGoalCommand = { type: 'create-goal', childId: this.childId, businessDate: localBusinessDate(),
      name: this.name, description: this.description, threshold: this.number(this.threshold), plannedDays: this.number(this.plannedDays),
      reward: this.reward, activityId: this.activityId, tasks: selected };
    const editing: EditGoalCommand = { type: 'edit-goal', childId: this.childId, businessDate: creating.businessDate,
      goalId: this.editingId, name: this.name, description: this.description, threshold: creating.threshold,
      plannedDays: creating.plannedDays, reward: this.reward, activityId: this.activityId, tasks: selected };
    const result = await this.module.execute(this.parentToken, this.editingId === '' ? creating : editing);
    this.busy = false;
    if (result.ok === false) {
      this.message = result.error.message;
      this.errorField = result.error.field ?? '';
      if (this.errorField.startsWith('tasks')) { this.tab = 'tasks'; }
      else this.tab = 'basic';
      return;
    }
    await this.load(this.childId);
    if (result.value.goalId !== undefined) await this.showDetail(result.value.goalId);
  }

  private async terminateGoal(): Promise<void> {
    if (this.detail === null || this.busy) return;
    this.busy = true;
    const result = await this.module.execute(this.parentToken, {
      type: 'terminate-goal',
      childId: this.childId,
      goalId: this.detail.id,
    });
    this.busy = false;
    if (result.ok === false) {
      this.message = result.error.message;
      return;
    }
    await this.load(this.childId);
    await this.showDetail(this.detail.id);
  }

  @Builder
  private Error(field: string) {
    if (this.errorField === field) {
      Text(this.message).id(`goal-error-${field}`).fontSize(16).fontColor('#B13932')
    }
  }

  @Builder
  private GoalList() {
    Row({ space: 12 }) {
      Button('果果').id('goals-guoguo').enabled(!this.busy).onClick(() => this.load('guoguo'))
      Button('阳阳').id('goals-yangyang').enabled(!this.busy).onClick(() => this.load('yangyang'))
      Blank()
      Button('创建目标').id('goal-new').enabled(!this.busy).onClick(() => this.beginEdit(null))
    }.width('100%')
    Scroll() {
      Column({ space: 16 }) {
        if (this.goals.length === 0) { Text('还没有打卡目标，和孩子一起定一个小目标吧。').padding(24).fontSize(20) }
        ForEach(this.goals, (goal: Goal) => {
          Column({ space: 8 }) {
            Button(goal.name).id(`goal-open-${goal.id}`).width('100%').height(52)
              .fontSize(22).backgroundColor('#F4E9DB').fontColor('#3E352F').onClick(() => this.showDetail(goal.id))
            Text(`${this.statusName(goal)} · ${goal.points} / ${goal.threshold} 分`).id(`goal-status-${goal.id}`).fontSize(18)
            Text(`${this.activityName(goal.activityId)} · 奖励：${goal.reward}`).fontSize(17)
          }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(16)
        }, (goal: Goal) => goal.id)
      }.width('100%')
    }.layoutWeight(1).width('100%')
    Button('返回家长管理').id('goals-back').enabled(!this.busy).onClick(() => this.onBack())
  }

  @Builder
  private BasicEditor() {
    Text('目标名称').fontSize(18)
    TextInput({ text: this.name, placeholder: '例如：一起养小猫' }).id('goal-name').onChange((text: string) => this.name = text)
    this.Error('name')
    Text('目标描述').fontSize(18)
    TextInput({ text: this.description, placeholder: '给孩子的具体说明' }).id('goal-description').onChange((text: string) => this.description = text)
    Text('积分门槛 / 计划天数').fontSize(18)
    Row({ space: 12 }) {
      TextInput({ text: this.threshold, placeholder: '目标积分' }).id('goal-threshold').type(InputType.Number).layoutWeight(1).onChange((text: string) => this.threshold = text)
      TextInput({ text: this.plannedDays, placeholder: '计划天数' }).id('goal-planned-days').type(InputType.Number).layoutWeight(1).onChange((text: string) => this.plannedDays = text)
    }
    this.Error('threshold')
    this.Error('plannedDays')
    Text('目标奖励').fontSize(18)
    TextInput({ text: this.reward, placeholder: '达成后可以获得什么？' }).id('goal-reward').onChange((text: string) => this.reward = text)
    this.Error('reward')
    Text('选择一个虚拟养成活动').fontSize(18)
    Row({ space: 16 }) {
      ForEach(this.activities, (activity: GrowthActivity) => {
        Button(`${this.activityId === activity.id ? '✓ ' : ''}${activity.name}`).id(`goal-activity-${activity.id}`)
          .backgroundColor(this.activityId === activity.id ? '#467B64' : '#E8E1D7')
          .fontColor(this.activityId === activity.id ? '#FFFFFF' : '#3E352F')
          .onClick(() => this.activityId = activity.id)
      }, (activity: GrowthActivity) => activity.id)
    }
    this.Error('activityId')
    Text('保存后立即开始。计划天数用于参考，超过天数仍可继续。').fontSize(16).fontColor('#78685A')
  }

  @Builder
  private Editor() {
    Row({ space: 16 }) {
      Button('基本信息').id('goal-basic-tab').onClick(() => this.tab = 'basic')
      Button(`目标任务（${this.tasks.filter(task => task.selected).length}）`).id('goal-tasks-tab').onClick(() => this.tab = 'tasks')
    }
    Scroll() {
      Column({ space: 12 }) {
        if (this.tab === 'basic') { this.BasicEditor() }
        else {
          this.Error('tasks')
          if (this.errorField.startsWith('tasks.')) { Text(this.message).id(`goal-error-${this.errorField}`).fontColor('#B13932').fontSize(17) }
          if (this.tasks.length === 0) { Text('没有可选任务，请先在任务池中添加。').fontSize(18) }
          ForEach(this.tasks, (task: TaskDraft) => { GoalTaskEditor({ task, onChange: () => this.tasks = [...this.tasks] }) }, (task: TaskDraft) => task.taskId)
        }
      }.width('100%').alignItems(HorizontalAlign.Start).padding({ bottom: 24 })
    }.id('goal-editor-scroll').layoutWeight(1).width('100%')
    Row({ space: 16 }) {
      Button('取消').id('goal-cancel').enabled(!this.busy).onClick(() => { this.view = 'list'; this.message = ''; })
      Button('保存目标').id('goal-save').enabled(!this.busy).onClick(() => this.save())
    }
  }

  @Builder
  private GoalDetail(goal: Goal) {
    Scroll() {
      Column({ space: 16 }) {
        Text(goal.name).id('goal-detail').fontSize(28).fontWeight(FontWeight.Bold)
        Text(`${this.statusName(goal)} · ${goal.points} / ${goal.threshold} 分`).id(`goal-status-${goal.id}`).fontSize(23)
        Text(goal.description).fontSize(18)
        Text(`开始日期：${goal.startDate} · 计划 ${goal.plannedDays} 天`).fontSize(18)
        Text(`目标奖励：${goal.reward}`).fontSize(21)
        Text(this.activityName(goal.activityId)).fontSize(22)
        Text(`历史最高积分：${goal.highestPoints}`).fontSize(17)
        Text(`虚拟成长进度：${Math.min(100, Math.floor((goal.highestPoints / goal.threshold) * 100))}%`)
          .id(`goal-growth-${goal.id}`)
          .fontSize(17)
        ForEach(goal.tasks, (task: GoalTask) => {
          Column({ space: 8 }) {
            Text(this.taskName(task.taskId)).fontSize(21)
            Text(task.plan.kind === 'weekly-frequency'
              ? `每周完成 ${task.plan.requiredCount} 次`
              : `每周${task.weekdays.map(day => this.weekdayName(day)).join('、')}`)
              .fontSize(17)
            Text(`完成 ${task.rules.completionPoints} 分 · 未完成${task.rules.missedPolicy === 'deduct' ? `扣 ${task.rules.deductionPoints} 分` : '不得分'}`).fontSize(17)
            Text(task.rules.streakEnabled ? `连续奖励开启 · 已连续 ${task.streakCount} 次 · 上限${task.rules.streakCap === null ? '不限' : task.rules.streakCap}` : '连续奖励关闭')
              .id(`goal-streak-${goal.id}-${task.taskId}`)
              .fontSize(17)
          }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(16)
        }, (task: GoalTask) => task.taskId)
      }.width('100%').padding({ bottom: 24 })
    }.layoutWeight(1).width('100%')
    Row({ space: 16 }) {
      Button('返回目标列表').id('goal-detail-back').onClick(() => this.view = 'list')
      Button('编辑目标').id('goal-edit').enabled(goal.status === 'active').onClick(() => this.beginEdit(goal))
      Button('终止目标').id(`goal-terminate-${goal.id}`).enabled(!this.busy && goal.status === 'active').onClick(() => this.terminateGoal())
    }
  }

  @Builder
  private Detail() {
    if (this.detail !== null) {
      this.GoalDetail(this.detail)
    }
  }

  build() {
    Column({ space: 16 }) {
      Text(`${this.childName}的打卡目标`).fontSize(28).fontWeight(FontWeight.Bold).fontColor('#3E352F')
      if (this.message !== '' && this.errorField === '') { Text(this.message).id('goal-message').fontSize(17).fontColor('#B13932') }
      if (this.view === 'list') { this.GoalList() }
      else if (this.view === 'detail') { this.Detail() }
      else { this.Editor() }
    }.width('100%').height('100%').padding(24).backgroundColor('#FFF9EF')
  }
}
