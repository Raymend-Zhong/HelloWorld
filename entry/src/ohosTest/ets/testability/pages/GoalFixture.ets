import { GoalPanel } from '../../../../main/ets/pages/GoalPanel';
import { FamilyHabitModule } from '../../../../main/ets/domain/FamilyHabitModule';

@Entry
@Component
struct GoalFixture {
  private module: FamilyHabitModule = AppStorage.get<FamilyHabitModule>('goalTestModule') as FamilyHabitModule;
  private token: string = AppStorage.get<string>('goalTestParent') as string;
  @State private finished: boolean = false;

  build() {
    if (this.finished) {
      Column() { Text('目标测试完成').id('goal-fixture-finished') }.width('100%').height('100%')
    } else {
      GoalPanel({ module: this.module, parentToken: this.token, onBack: () => this.finished = true })
    }
  }
}
