import { GoalPanel, localBusinessDate } from './GoalPanel';
import { Goal } from '../domain/Goals';
import { TaskPoolPanel } from './TaskPoolPanel';
import {
  ChildDay,
  ScheduledTask,
  ChildId,
  FamilyBackup,
  FamilyHabitModule,
  ParentSetupSession,
  SettlementPreview,
  SettlementGoalPreview,
  SettlementTaskResult,
  ChildProfile,
} from '../domain/FamilyHabitModule';
import { BackupFileAdapter } from '../infrastructure/BackupFileAdapter';

type Screen = 'entry' | 'child' | 'parent-auth' | 'parent' | 'task-pool' | 'goals' | 'settlement' | 'child-profile' | 'backup';

@Entry
@Component
struct Index {
  private module: FamilyHabitModule = AppStorage.get<FamilyHabitModule>(
    'familyHabitModule',
  ) as FamilyHabitModule;
  private backupFileAdapter: BackupFileAdapter | undefined = AppStorage.get<BackupFileAdapter>('backupFileAdapter');

  @State private screen: Screen = 'entry';
  @State private currentChildId: ChildId = 'guoguo';
  @State private currentChildName: string = '';
  @State private currentTheme: string = 'mature';
  @State private currentTeacher: string = 'calm';
  @State private password: string = '';
  @State private message: string = '';
  private parentToken: string = '';
  private childToken: string = '';
  @State private childTasks: ScheduledTask[] = [];
  @State private childGoals: Goal[] = [];
  @State private settlementChildId: ChildId = 'guoguo';
  @State private settlementDate: string = localBusinessDate();
  @State private settlementPreview: SettlementPreview | null = null;
  @State private familyChildren: ChildProfile[] = [];
  @State private profileChildId: ChildId = 'guoguo';
  @State private profileName: string = '果果';
  @State private profileAvatar: string = 'guoguo';
  @State private profileTheme: string = 'mature';
  @State private profileTeacher: string = 'calm';
  @State private backupSummary: string = '';
  @State private backupExportedAt: string = '';
  @State private backupChecksum: string = '';
  private pendingBackup: FamilyBackup | null = null;
  private parentSetupSession: ParentSetupSession | null = null;

  private async openChild(childId: ChildId): Promise<void> {
    const session = await this.module.openSession({ entry: 'child', childId });
    if (session.ok === false) {
      this.message = session.error.message;
      return;
    }
    if (session.value.role !== 'child') {
      this.message = '孩子入口状态异常。';
      return;
    }
    this.childToken = session.value.token;
    const home = await this.module.inspect(session.value.token, {
      type: 'child-day', childId, businessDate: localBusinessDate(),
    });
    if (home.ok === false) {
      this.message = home.error.message;
      return;
    }
    this.showChild(home.value);
  }

  private showChild(home: ChildDay): void {
    this.childTasks = home.tasks;
    this.childGoals = home.goals;
    this.currentChildId = home.currentChild.id;
    this.currentChildName = home.currentChild.displayName;
    this.currentTheme = home.currentChild.theme;
    this.currentTeacher = home.currentChild.teacher ?? 'calm';
    this.message = '';
    this.screen = 'child';
  }

  private async refreshChildDay(): Promise<void> {
    const home = await this.module.inspect(this.childToken, {
      type: 'child-day',
      childId: this.currentChildId,
      businessDate: localBusinessDate(),
    });
    if (home.ok === false) {
      this.message = home.error.message;
      return;
    }
    this.showChild(home.value);
  }

  private async submitCheckin(taskId: string): Promise<void> {
    const result = await this.module.execute(this.childToken, {
      type: 'submit-checkin',
      childId: this.currentChildId,
      taskId,
      businessDate: localBusinessDate(),
    });
    if (result.ok === false) {
      this.message = result.error.message;
      return;
    }
    this.message = '已打卡。';
    await this.refreshChildDay();
  }

  private async revokeCheckin(task: ScheduledTask): Promise<void> {
    const checkinId = task.checkinIds[task.checkinIds.length - 1];
    if (checkinId === undefined) return;
    const result = await this.module.execute(this.childToken, {
      type: 'revoke-checkin',
      childId: this.currentChildId,
      checkinId,
    });
    if (result.ok === false) {
      this.message = result.error.code === 'SETTLEMENT_PREVIEW_EXPIRED'
        ? '清算审阅已过期，请重新审阅。'
        : result.error.message;
      return;
    }
    this.message = '已撤销打卡。';
    await this.refreshChildDay();
  }

  private async openSettlement(): Promise<void> {
    this.settlementChildId = 'guoguo';
    this.settlementDate = localBusinessDate();
    await this.reviewSettlement();
    this.screen = 'settlement';
  }

  private async reviewSettlement(): Promise<void> {
    const preview = await this.module.inspect(this.parentToken, {
      type: 'settlement-preview',
      childId: this.settlementChildId,
      businessDate: this.settlementDate,
    });
    if (preview.ok === false) {
      this.message = preview.error.message;
      return;
    }
    this.settlementPreview = preview.value;
    this.message = '';
  }

  private async confirmSettlement(): Promise<void> {
    if (this.settlementPreview === null) return;
    const result = await this.module.execute(this.parentToken, {
      type: 'confirm-settlement',
      childId: this.settlementPreview.childId,
      businessDate: this.settlementPreview.businessDate,
      expectedRevision: this.settlementPreview.revision,
    });
    if (result.ok === false) {
      this.message = result.error.message;
      return;
    }
    this.message = '清算已确认。';
    const history = await this.module.inspect(this.parentToken, {
      type: 'settlement-history',
      childId: this.settlementPreview.childId,
      businessDate: this.settlementPreview.businessDate,
    });
    if (history.ok) {
      const active = history.value.settlements.find(item => item.active);
      if (active !== undefined) {
        this.settlementPreview = {
          childId: active.childId,
          businessDate: active.businessDate,
          goals: active.goals,
          revision: history.value.revision,
        };
      }
    }
  }

  private async exemptSettlementResult(result: SettlementTaskResult, weekly: boolean): Promise<void> {
    if (this.settlementPreview === null) return;
    const command = weekly
      ? {
        type: 'exempt-weekly-task' as const,
        childId: this.settlementPreview.childId,
        taskId: result.taskId,
        weekOf: this.settlementPreview.businessDate,
      }
      : {
        type: 'exempt-date-task' as const,
        childId: this.settlementPreview.childId,
        taskId: result.taskId,
        businessDate: this.settlementPreview.businessDate,
      };
    const saved = await this.module.execute(this.parentToken, command);
    if (saved.ok === false) {
      this.message = saved.error.message;
      return;
    }
    this.message = '已豁免，请重新审阅后确认清算。';
    await this.reviewSettlement();
  }

  private async exemptAllDateTasks(): Promise<void> {
    if (this.settlementPreview === null) return;
    const saved = await this.module.execute(this.parentToken, {
      type: 'exempt-date-tasks',
      childId: this.settlementPreview.childId,
      businessDate: this.settlementPreview.businessDate,
    });
    if (saved.ok === false) {
      this.message = saved.error.message;
      return;
    }
    this.message = '已豁免当天全部按日期任务，请重新审阅后确认清算。';
    await this.reviewSettlement();
  }

  private settlementResultLabel(result: SettlementTaskResult): string {
    if (result.status === 'completed') return '已完成';
    if (result.status === 'exempted') return '已豁免';
    return '未完成';
  }

  private async openChildProfile(): Promise<void> {
    const previousMessage = this.message;
    const overview = await this.module.inspect(this.parentToken, { type: 'family-overview' });
    if (overview.ok === false) {
      this.message = overview.error.message;
      return;
    }
    this.familyChildren = overview.value.children;
    this.pickProfileChild('guoguo');
    this.message = previousMessage;
    this.screen = 'child-profile';
  }

  private pickProfileChild(childId: ChildId): void {
    const child = this.familyChildren.find(item => item.id === childId);
    if (child === undefined) return;
    this.profileChildId = child.id;
    this.profileName = child.displayName;
    this.profileAvatar = child.avatar;
    this.profileTheme = child.theme;
    this.profileTeacher = child.teacher ?? (child.id === 'guoguo' ? 'calm' : 'storybook');
    this.message = '';
  }

  private async saveChildProfile(): Promise<void> {
    const result = await this.module.execute(this.parentToken, {
      type: 'update-child-profile',
      childId: this.profileChildId,
      displayName: this.profileName,
      avatar: this.profileAvatar,
      theme: this.profileTheme,
      teacher: this.profileTeacher,
    });
    if (result.ok === false) {
      this.message = result.error.message;
      return;
    }
    this.message = '孩子资料已保存。';
    await this.openChildProfile();
  }

  private stringifyBackup(backup: FamilyBackup): string {
    return JSON.stringify(backup, null, 2).replace(/[^\x00-\x7F]/g, (value: string) => {
      return `\\u${value.charCodeAt(0).toString(16).padStart(4, '0')}`;
    });
  }

  private describeBackup(backup: FamilyBackup): string {
    return `孩子 ${backup.summary.children} 个，任务 ${backup.summary.taskPoolTasks} 个，目标 ${backup.summary.goals} 个，打卡 ${backup.summary.checkins} 条，清算 ${backup.summary.settlements} 条。`;
  }

  private async exportBackup(): Promise<void> {
    if (this.backupFileAdapter === undefined) {
      this.message = '文件选择器不可用，请稍后重试。';
      return;
    }
    const backup = await this.module.inspect(this.parentToken, { type: 'backup-export' });
    if (backup.ok === false) {
      this.message = backup.error.message;
      return;
    }
    const saved = await this.backupFileAdapter.saveBackup(
      `family-habit-backup-${backup.value.exportedAt.slice(0, 10)}.json`,
      this.stringifyBackup(backup.value),
    );
    if (saved === null) {
      this.message = '已取消导出。';
      return;
    }
    this.message = '家庭数据备份已导出。';
    this.backupSummary = this.describeBackup(backup.value);
    this.backupExportedAt = backup.value.exportedAt;
    this.backupChecksum = backup.value.checksum;
  }

  private async chooseBackupForRestore(): Promise<void> {
    if (this.backupFileAdapter === undefined) {
      this.message = '文件选择器不可用，请稍后重试。';
      return;
    }
    const content = await this.backupFileAdapter.readBackup();
    if (content === null) {
      this.message = '已取消恢复。';
      return;
    }
    try {
      const backup = JSON.parse(content) as FamilyBackup;
      this.pendingBackup = backup;
      this.backupSummary = this.describeBackup(backup);
      this.backupExportedAt = backup.exportedAt;
      this.backupChecksum = backup.checksum;
      this.message = '请核对备份摘要，确认后再恢复。';
    } catch (_) {
      this.pendingBackup = null;
      this.message = '备份文件损坏，无法读取。';
    }
  }

  private async confirmRestoreBackup(): Promise<void> {
    if (this.pendingBackup === null) {
      this.message = '请先选择要恢复的备份。';
      return;
    }
    const result = await this.module.execute(this.parentToken, {
      type: 'restore-backup',
      backup: this.pendingBackup,
    });
    if (result.ok === false) {
      this.message = result.error.message;
      return;
    }
    this.pendingBackup = null;
    this.message = '家庭数据已恢复，当前设备家长密码保持不变。';
  }

  private async openParentEntry(): Promise<void> {
    const setup = await this.module.openSession({ entry: 'parent-setup' });
    if (setup.ok && setup.value.role === 'parent-setup') {
      this.parentSetupSession = setup.value;
      this.message = '第一次进入，请设置家长密码。';
    } else {
      this.parentSetupSession = null;
      this.message = '请输入家长密码。';
    }
    this.password = '';
    this.screen = 'parent-auth';
  }

  private async submitParentPassword(): Promise<void> {
    if (this.parentSetupSession !== null) {
      const saved = await this.module.execute(this.parentSetupSession.token, {
        type: 'set-parent-password',
        password: this.password,
      });
      if (saved.ok === false) {
        this.message = saved.error.message;
        return;
      }
    }
    const parent = await this.module.openSession({
      entry: 'parent',
      password: this.password,
    });
    if (parent.ok === false) {
      this.message = parent.error.message;
      return;
    }
    this.password = '';
    this.message = '';
    this.parentToken = parent.value.token;
    this.screen = 'parent';
  }

  @Builder
  private EntryPanel() {
    Column({ space: 24 }) {
      Text('今天是谁来打卡？')
        .fontSize(34)
        .fontWeight(FontWeight.Bold)
        .fontColor('#3E352F')

      Row({ space: 24 }) {
        Button('果果 · 初中')
          .id('entry-guoguo')
          .fontSize(22)
          .height(104)
          .width(240)
          .backgroundColor('#F1A7B8')
          .onClick(() => this.openChild('guoguo'))
        Button('阳阳 · 幼儿园')
          .id('entry-yangyang')
          .fontSize(22)
          .height(104)
          .width(240)
          .backgroundColor('#7EC8A5')
          .onClick(() => this.openChild('yangyang'))
      }

      Button('家长入口')
        .id('entry-parent')
        .fontSize(18)
        .fontColor('#65584F')
        .backgroundColor('#EFE7DE')
        .onClick(() => this.openParentEntry())
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(40)
    .backgroundColor('#FFF9EF')
  }

  @Builder
  private ChildPanel() {
    Column({ space: 22 }) {
      Row() {
        Text(`${this.currentChildName}的成长打卡`)
          .id('child-current-name')
          .fontSize(32)
          .fontWeight(FontWeight.Bold)
          .fontColor('#3E352F')
        Blank()
        Button('返回入口')
          .onClick(() => this.screen = 'entry')
      }
      .width('100%')

      Text(this.currentTheme === 'mature'
        ? '今天也稳稳完成自己的计划吧。'
        : this.currentTheme === 'focus'
          ? '专注一点点，成长就会看得见。'
          : '今天又能让小伙伴长大一点啦！')
        .fontSize(21)
        .fontColor('#65584F')
      Text(this.currentTeacher === 'calm' ? '沉稳老师陪你复盘。' : '故事老师陪你闯关。')
        .id('child-teacher')
        .fontSize(18)
        .fontColor('#65584F')

      Row({ space: 16 }) {
        Button('切换到果果')
          .id('switch-guoguo')
          .enabled(this.currentChildId !== 'guoguo')
          .onClick(() => this.openChild('guoguo'))
        Button('切换到阳阳')
          .id('switch-yangyang')
          .enabled(this.currentChildId !== 'yangyang')
          .onClick(() => this.openChild('yangyang'))
      }

      Text('今天的任务与打卡目标').fontSize(18).fontColor('#8A7C72')
      Scroll() {
        Column({ space: 12 }) {
          if (this.childTasks.length === 0) {
            Text('今天没有安排任务，可以看看自己的目标。').fontSize(20)
          }
          ForEach(this.childTasks, (task: ScheduledTask) => {
            Row({ space: 12 }) {
              Column({ space: 4 }) {
                Text(task.name).fontSize(22)
                Text(task.requiredCount === undefined
                  ? `今日已打卡 ${task.completedCount} 次`
                  : `本周进度 ${task.completedCount} / ${task.requiredCount} 次`)
                  .id(`checkin-count-${task.taskId}`)
                  .fontSize(16)
                  .fontColor('#65584F')
              }.layoutWeight(1)
              Button('打卡').id(`checkin-submit-${task.taskId}`).onClick(() => this.submitCheckin(task.taskId))
              Button('撤销').id(`checkin-revoke-${task.taskId}`).enabled(task.completedCount > 0).onClick(() => this.revokeCheckin(task))
            }
            .width('100%')
            .padding(14)
            .backgroundColor(Color.White)
            .borderRadius(12)
          }, (task: ScheduledTask) => task.taskId)
          ForEach(this.childGoals, (goal: Goal) => {
            Column({ space: 8 }) {
              Text(goal.name).id(`child-goal-${goal.id}`).fontSize(24).fontWeight(FontWeight.Bold)
              Text(`${goal.points} / ${goal.threshold} 分 · ${goal.activityId === 'cat' ? '养小猫' : '种小树'}`).fontSize(20)
              Text(`虚拟成长进度 ${Math.min(100, Math.floor((goal.highestPoints / goal.threshold) * 100))}%`)
                .id(`child-growth-${goal.id}`)
                .fontSize(18)
              Text(`目标奖励：${goal.reward}`).fontSize(18)
            }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(16)
          }, (goal: Goal) => goal.id)
        }.width('100%')
      }.layoutWeight(1).width('100%')
    }
    .width('100%')
    .height('100%')
    .padding(44)
    .backgroundColor(this.currentTheme === 'mature' ? '#FFF3F6' : '#F1FBF5')
  }

  @Builder
  private ParentAuthPanel() {
    Column({ space: 20 }) {
      Text(this.parentSetupSession === null ? '家长验证' : '设置家长密码')
        .fontSize(30)
        .fontWeight(FontWeight.Bold)
      Text(this.message).fontSize(18).fontColor('#8A5C45')
      TextInput({ placeholder: '请输入家长密码', text: this.password })
        .id('parent-password-input')
        .type(InputType.Password)
        .width(360)
        .onChange((value: string) => this.password = value)
      Button(this.parentSetupSession === null ? '进入家长端' : '保存并进入')
        .id('parent-submit')
        .enabled(this.password.length > 0)
        .onClick(() => this.submitParentPassword())
      Button('返回').onClick(() => this.screen = 'entry')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#FFF9EF')
  }

  @Builder
  private ParentPanel() {
    Column({ space: 24 }) {
      Text('家长管理')
        .id('parent-screen')
        .fontSize(32)
        .fontWeight(FontWeight.Bold)
      Button('管理打卡目标').id('parent-goals').onClick(() => this.screen = 'goals')
      Button('管理任务池').id('parent-task-pool').onClick(() => this.screen = 'task-pool')
      Button('配置孩子主题与老师').id('parent-child-profile').onClick(() => this.openChildProfile())
      Button('数据备份与恢复').id('parent-backup').onClick(() => {
        this.message = '';
        this.backupSummary = '';
        this.backupExportedAt = '';
        this.backupChecksum = '';
        this.pendingBackup = null;
        this.screen = 'backup';
      })
      Text('为果果和阳阳分别安排适合的学习与生活任务。')
        .fontSize(19)
        .fontColor('#65584F')
      Button('每日清算').id('parent-settlement').onClick(() => this.openSettlement())
      Button('退出家长端').onClick(() => { this.parentToken = ''; this.screen = 'entry'; })
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#FFF9EF')
  }

  @Builder
  private BackupPanel() {
    Column({ space: 18 }) {
      Text('数据备份与恢复')
        .id('backup-screen')
        .fontSize(30)
        .fontWeight(FontWeight.Bold)
      Text(this.message).id('backup-message').fontSize(18).fontColor('#8A5C45')
      if (this.backupSummary.length > 0) {
        Text(this.backupSummary).id('backup-summary').fontSize(18).fontColor('#65584F')
        Text(`导出时间：${this.backupExportedAt}`).id('backup-exported-at').fontSize(16).fontColor('#65584F')
        Text(`完整性校验：${this.backupChecksum}`).id('backup-checksum').fontSize(16).fontColor('#65584F')
      }
      Row({ space: 16 }) {
        Button('导出 JSON 备份').id('backup-export').onClick(() => this.exportBackup())
        Button('选择备份文件').id('backup-choose-restore').onClick(() => this.chooseBackupForRestore())
        Button('确认恢复').id('backup-confirm-restore').enabled(this.pendingBackup !== null).onClick(() => this.confirmRestoreBackup())
      }
      Button('返回家长管理').id('backup-back').onClick(() => this.screen = 'parent')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(40)
    .backgroundColor('#FFF9EF')
  }

  @Builder
  private SettlementPanel() {
    Column({ space: 18 }) {
      Row() {
        Text('每日清算')
          .id('settlement-screen')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor('#3E352F')
        Blank()
        Button('返回').id('settlement-back').onClick(() => this.screen = 'parent')
      }.width('100%')

      Row({ space: 12 }) {
        Button('果果').id('settlement-guoguo').enabled(this.settlementChildId !== 'guoguo').onClick(async () => { this.settlementChildId = 'guoguo'; await this.reviewSettlement(); })
        Button('阳阳').id('settlement-yangyang').enabled(this.settlementChildId !== 'yangyang').onClick(async () => { this.settlementChildId = 'yangyang'; await this.reviewSettlement(); })
        TextInput({ text: this.settlementDate, placeholder: '业务日期' })
          .id('settlement-date')
          .width(180)
          .onChange((value: string) => this.settlementDate = value)
        Button('审阅').id('settlement-review').onClick(() => this.reviewSettlement())
        Button('全部任务豁免').id('settlement-exempt-all-date').onClick(() => this.exemptAllDateTasks())
      }

      Text(this.message).id('settlement-message').fontSize(18).fontColor('#8A5C45')

      Scroll() {
        Column({ space: 12 }) {
          if (this.settlementPreview !== null && this.settlementPreview.goals.length === 0) {
            Text('这一天没有需要清算的按日期任务。').fontSize(20)
          }
          if (this.settlementPreview !== null) {
            ForEach(this.settlementPreview.goals, (goal: SettlementGoalPreview) => {
              Column({ space: 8 }) {
                Text(`目标 ${goal.goalId}`).fontSize(20).fontWeight(FontWeight.Bold)
                ForEach(goal.results, (result: SettlementTaskResult) => {
                  Row({ space: 10 }) {
                    Text(`${this.settlementResultLabel(result)} · ${result.taskId} · ${result.pointsDelta} 分`)
                      .id(`settlement-result-${goal.goalId}-${result.taskId}`)
                      .fontSize(17)
                      .layoutWeight(1)
                    if (result.status === 'missed' && result.planKind === 'date-weekdays') {
                      Button('任务豁免')
                        .id(`settlement-exempt-date-${goal.goalId}-${result.taskId}`)
                        .onClick(() => this.exemptSettlementResult(result, false))
                    }
                    if (result.status === 'missed' && result.planKind === 'weekly-frequency') {
                      Button('周期任务豁免')
                        .id(`settlement-exempt-weekly-${goal.goalId}-${result.taskId}`)
                        .onClick(() => this.exemptSettlementResult(result, true))
                    }
                  }
                }, (result: SettlementTaskResult) => result.taskId)
                Text(`净变化 ${goal.netDelta} 分，清算后 ${goal.pointsAfter} 分`).id(`settlement-net-${goal.goalId}`).fontSize(18)
                Text('老师反馈').fontSize(18).fontWeight(FontWeight.Medium)
                ForEach(goal.feedback ?? [], (step) => {
                  Text(step.text)
                    .id(step.once ? `settlement-feedback-played-${goal.goalId}-${step.kind}` : `settlement-feedback-${goal.goalId}-${step.kind}`)
                    .fontSize(16)
                }, (step) => `${goal.goalId}-${step.kind}-${step.text}`)
              }.width('100%').padding(14).backgroundColor(Color.White).borderRadius(12)
            }, (goal: SettlementGoalPreview) => goal.goalId)
          }
        }.width('100%')
      }.layoutWeight(1).width('100%')

      Button('确认清算').id('settlement-confirm').enabled(this.settlementPreview !== null).onClick(() => this.confirmSettlement())
    }
    .width('100%')
    .height('100%')
    .padding(40)
    .backgroundColor('#FFF9EF')
  }

  @Builder
  private ChildProfilePanel() {
    Column({ space: 18 }) {
      Text('孩子主题与老师').fontSize(30).fontWeight(FontWeight.Bold)
      Row({ space: 12 }) {
        Button('果果').id('profile-guoguo').onClick(() => this.pickProfileChild('guoguo'))
        Button('阳阳').id('profile-yangyang').onClick(() => this.pickProfileChild('yangyang'))
      }
      TextInput({ text: this.profileName, placeholder: '孩子昵称' }).id('profile-name').onChange((value: string) => this.profileName = value)
      Row({ space: 12 }) {
        Button('成熟主题').id('profile-theme-mature').onClick(() => this.profileTheme = 'mature')
        Button('专注主题').id('profile-theme-focus').onClick(() => this.profileTheme = 'focus')
        Button('童趣主题').id('profile-theme-playful').onClick(() => this.profileTheme = 'playful')
      }
      Row({ space: 12 }) {
        Button('沉稳老师').id('profile-teacher-calm').onClick(() => this.profileTeacher = 'calm')
        Button('故事老师').id('profile-teacher-storybook').onClick(() => this.profileTeacher = 'storybook')
      }
      Text(this.message).id('profile-message').fontSize(18).fontColor('#8A5C45')
      Row({ space: 16 }) {
        Button('返回家长管理').id('profile-back').onClick(() => this.screen = 'parent')
        Button('保存').id('profile-save').onClick(() => this.saveChildProfile())
      }
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .padding(40)
    .backgroundColor('#FFF9EF')
  }

  build() {
    if (this.screen === 'entry') {
      this.EntryPanel()
    } else if (this.screen === 'child') {
      this.ChildPanel()
    } else if (this.screen === 'parent-auth') {
      this.ParentAuthPanel()
    } else if (this.screen === 'goals') {
      GoalPanel({ module: this.module, parentToken: this.parentToken, onBack: () => this.screen = 'parent' })
    } else if (this.screen === 'task-pool') {
      TaskPoolPanel({ module: this.module, parentToken: this.parentToken, onBack: () => this.screen = 'parent' })
    } else if (this.screen === 'settlement') {
      this.SettlementPanel()
    } else if (this.screen === 'child-profile') {
      this.ChildProfilePanel()
    } else if (this.screen === 'backup') {
      this.BackupPanel()
    } else if (this.screen === 'parent') {
      this.ParentPanel()
    } else {
      this.EntryPanel()
    }
  }
}
