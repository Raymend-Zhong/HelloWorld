import {
  ChildHome,
  ChildId,
  FamilyHabitModule,
  ParentSetupSession,
} from '../domain/FamilyHabitModule';

@Entry
@Component
struct Index {
  private module: FamilyHabitModule = AppStorage.get<FamilyHabitModule>(
    'familyHabitModule',
  ) as FamilyHabitModule;

  @State private screen: string = 'entry';
  @State private currentChildId: ChildId = 'guoguo';
  @State private currentChildName: string = '';
  @State private currentTheme: string = 'mature';
  @State private password: string = '';
  @State private message: string = '';
  private parentSetupSession: ParentSetupSession | null = null;

  private async openChild(childId: ChildId): Promise<void> {
    const session = await this.module.openSession({ entry: 'child', childId });
    if (!session.ok || session.value.role !== 'child') {
      this.message = session.ok ? '孩子入口状态异常。' : session.error.message;
      return;
    }
    const home = await this.module.inspect(session.value.token, {
      type: 'child-home',
    });
    if (!home.ok) {
      this.message = home.error.message;
      return;
    }
    this.showChild(home.value);
  }

  private showChild(home: ChildHome): void {
    this.currentChildId = home.currentChild.id;
    this.currentChildName = home.currentChild.displayName;
    this.currentTheme = home.currentChild.theme;
    this.message = '';
    this.screen = 'child';
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
      if (!saved.ok) {
        this.message = saved.error.message;
        return;
      }
    }
    const parent = await this.module.openSession({
      entry: 'parent',
      password: this.password,
    });
    if (!parent.ok) {
      this.message = parent.error.message;
      return;
    }
    this.password = '';
    this.message = '';
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

      Text('今天的任务会在后续任务中加入。')
        .fontSize(18)
        .fontColor('#8A7C72')
        .margin({ top: 40 })
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
      Text('已通过家长密码验证。后续任务将在这里加入管理和每日清算。')
        .fontSize(19)
        .fontColor('#65584F')
      Button('退出家长端').onClick(() => this.screen = 'entry')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .backgroundColor('#FFF9EF')
  }

  build() {
    if (this.screen === 'entry') {
      this.EntryPanel()
    } else if (this.screen === 'child') {
      this.ChildPanel()
    } else if (this.screen === 'parent-auth') {
      this.ParentAuthPanel()
    } else {
      this.ParentPanel()
    }
  }
}
