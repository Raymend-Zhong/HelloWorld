import { TaskPoolTask } from '../domain/FamilyHabitModule';
import { GoalTask } from '../domain/Goals';

@Observed
export class TaskDraft {
  taskId: string;
  name: string;
  disabled: boolean;
  selected: boolean;
  weekdays: number[];
  completion: string;
  deduction: string;
  deduct: boolean;
  streak: boolean;
  cap: string;

  constructor(task: TaskPoolTask, existing?: GoalTask) {
    const rules = existing?.rules ?? task.defaultRules;
    this.taskId = task.id;
    this.name = task.name;
    this.disabled = task.disabled;
    this.selected = existing !== undefined;
    this.weekdays = existing === undefined ? [1, 2, 3, 4, 5, 6, 7] : [...existing.weekdays];
    this.completion = `${rules.completionPoints}`;
    this.deduction = `${rules.deductionPoints}`;
    this.deduct = rules.missedPolicy === 'deduct';
    this.streak = rules.streakEnabled;
    this.cap = rules.streakCap === null ? '' : `${rules.streakCap}`;
  }
}

@Component
export struct GoalTaskEditor {
  @ObjectLink task: TaskDraft;
  onChange: () => void = () => {};
  private weekdays: number[] = [1, 2, 3, 4, 5, 6, 7];

  private weekdayName(day: number): string { return ['一', '二', '三', '四', '五', '六', '日'][day - 1]; }

  private selectDay(day: number): void {
    this.task.weekdays = this.task.weekdays.includes(day) ? this.task.weekdays.filter(item => item !== day) : [...this.task.weekdays, day].sort();
    this.onChange();
  }

  build() {
    Column({ space: 12 }) {
      Button(`${this.task.selected ? '已选择' : '选择'} · ${this.task.name}${this.task.disabled ? '（已停用，保留引用）' : ''}`)
        .id(`goal-select-${this.task.taskId}`).width('100%').height(48)
        .backgroundColor(this.task.selected ? '#467B64' : '#E8E1D7').fontColor(this.task.selected ? '#FFFFFF' : '#3E352F')
        .onClick(() => { this.task.selected = !this.task.selected; this.onChange(); })
      if (this.task.selected) {
        Text('每周完成日期').fontSize(17)
        Flex({ wrap: FlexWrap.Wrap }) {
          ForEach(this.weekdays, (day: number) => {
            Button(`周${this.weekdayName(day)}`).id(`goal-day-${this.task.taskId}-${day}`).margin(4)
              .backgroundColor(this.task.weekdays.includes(day) ? '#467B64' : '#E8E1D7')
              .fontColor(this.task.weekdays.includes(day) ? '#FFFFFF' : '#3E352F')
              .onClick(() => this.selectDay(day))
          }, (day: number) => `${day}`)
        }
        Text('完成积分 / 未完成扣分值').fontSize(17)
        Row({ space: 12 }) {
          TextInput({ text: this.task.completion }).id(`goal-completion-${this.task.taskId}`).type(InputType.Number).layoutWeight(1)
            .onChange((text: string) => { this.task.completion = text; this.onChange(); })
          TextInput({ text: this.task.deduction }).id(`goal-deduction-${this.task.taskId}`).type(InputType.Number).layoutWeight(1)
            .onChange((text: string) => { this.task.deduction = text; this.onChange(); })
        }
        Row({ space: 16 }) {
          Text('未完成时扣分').fontSize(17)
          Toggle({ type: ToggleType.Switch, isOn: this.task.deduct }).id(`goal-deduct-${this.task.taskId}`)
            .onChange((enabled: boolean) => { this.task.deduct = enabled; this.onChange(); })
          Text(this.task.deduct ? '扣分' : '不得分').fontSize(16)
        }
        Row({ space: 16 }) {
          Text('连续奖励').fontSize(17)
          Toggle({ type: ToggleType.Switch, isOn: this.task.streak }).id(`goal-streak-${this.task.taskId}`)
            .onChange((enabled: boolean) => { this.task.streak = enabled; this.onChange(); })
        }
        TextInput({ text: this.task.cap, placeholder: '连续奖励上限，留空表示不限' }).id(`goal-cap-${this.task.taskId}`).type(InputType.Number)
          .onChange((text: string) => { this.task.cap = text; this.onChange(); })
      }
    }.width('100%').padding(16).backgroundColor(Color.White).borderRadius(16)
  }
}
