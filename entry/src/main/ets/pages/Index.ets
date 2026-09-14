import { GoalPanel, localBusinessDate } from './GoalPanel';
import { Goal } from '../domain/Goals';
import { TaskPoolPanel } from './TaskPoolPanel';
import {
  ChildDay,
  ScheduledTask,
  ChildId,
  FamilyHabitModule,
  ParentSetupSession,
  SettlementPreview,
} from '../domain/FamilyHabitModule';

type Screen = 'entry' | 'child' | 'parent-auth' | 'parent' | 'task-pool' | 'goals' | 'settlement';

@Entry
@Component
struct Index {
  private module: FamilyHabitModule = AppStorage.get<FamilyHabitModule>(
    'familyHabitModule',
  ) as FamilyHabitModule;

  @State private screen: Screen = 'entry';
  @State private currentChildId: ChildId = 'guoguo';
  @State private currentChildName: string = '';
  @State private currentTheme: string = 'mature';
  @State private password: string = '';
  @State private message: string = '';
  private parentToken: string = '';
  private childToken: string = '';
  @State private childTasks: ScheduledTask[] = [];
  @State private childGoals: Goal[] = [];
  @State private settlementChildId: ChildId = 'guoguo';
  @State private settlementDate: string = localBusinessDate();
  @State private settlementPreview: SettlementPreview | null = null;
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
      this.message = result.error.message;
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
    await this.reviewSettlement();
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
        : '今天又能让小伙伴长大一点啦！')
        .fontSize(21)
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
                Text(`今日已打卡 ${task.completedCount} 次`).id(`checkin-count-${task.taskId}`).fontSize(16).fontColor('#65584F')
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
      }

      Text(this.message).id('settlement-message').fontSize(18).fontColor('#8A5C45')

      Scroll() {
        Column({ space: 12 }) {
          if (this.settlementPreview !== null && this.settlementPreview.goals.length === 0) {
            Text('这一天没有需要清算的按日期任务。').fontSize(20)
          }
          if (this.settlementPreview !== null) {
            ForEach(this.settlementPreview.goals, (goal) => {
              Column({ space: 8 }) {
                Text(`目标 ${goal.goalId}`).fontSize(20).fontWeight(FontWeight.Bold)
                ForEach(goal.results, (result) => {
                  Text(`${result.status === 'completed' ? '已完成' : '未完成'} · ${result.taskId} · ${result.pointsDelta} 分`)
                    .id(`settlement-result-${goal.goalId}-${result.taskId}`)
                    .fontSize(17)
                }, (result) => result.taskId)
                Text(`净变化 ${goal.netDelta} 分，清算后 ${goal.pointsAfter} 分`).id(`settlement-net-${goal.goalId}`).fontSize(18)
              }.width('100%').padding(14).backgroundColor(Color.White).borderRadius(12)
            }, (goal) => goal.goalId)
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
    } else if (this.screen === 'parent') {
      this.ParentPanel()
    } else {
      this.EntryPanel()
    }
  }
}
