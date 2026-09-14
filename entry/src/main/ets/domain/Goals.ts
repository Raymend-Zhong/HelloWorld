import { TaskRules, validTaskRulePoints, validTaskRuleOptions } from './TaskTemplates.js';

export interface GoalTaskInput {
  taskId: string;
  weekdays: number[];
  rules?: TaskRules;
}

export interface GoalInput {
  name: string;
  description: string;
  threshold: number;
  plannedDays: number;
  reward: string;
  activityId: string;
  tasks: GoalTaskInput[];
}

export interface GoalTask {
  taskId: string;
  weekdays: number[];
  rules: TaskRules;
}

export interface Goal extends GoalInput {
  id: string;
  childId: 'guoguo' | 'yangyang';
  startDate: string;
  status: 'active';
  points: number;
  highestPoints: number;
  tasks: GoalTask[];
}

export function cloneGoal(goal: Goal): Goal {
  return { ...goal, tasks: goal.tasks.map(task => ({ ...task, weekdays: [...task.weekdays], rules: { ...task.rules } })) };
}

export interface GoalValidationError {
  code: string;
  message: string;
  field: string;
}

export interface GrowthActivity {
  id: string;
  name: string;
}

export function builtInActivities(): GrowthActivity[] {
  return [{ id: 'cat', name: '养小猫' }, { id: 'tree', name: '种小树' }];
}

export function validBusinessDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function validateGoal(input: GoalInput, businessDate: string): GoalValidationError | null {
  let field = '';
  let message = '';
  if (input.name.trim() === '') { field = 'name'; message = '请输入目标名称。'; }
  else if (!Number.isSafeInteger(input.threshold) || input.threshold <= 0) { field = 'threshold'; message = '目标积分门槛须为正整数。'; }
  else if (!Number.isSafeInteger(input.plannedDays) || input.plannedDays <= 0) { field = 'plannedDays'; message = '计划时长须为正整数天。'; }
  else if (input.reward.trim() === '') { field = 'reward'; message = '请输入目标奖励。'; }
  else if (!validBusinessDate(businessDate)) { field = 'businessDate'; message = '请选择有效的业务日期。'; }
  else if (!builtInActivities().some(activity => activity.id === input.activityId)) { field = 'activityId'; message = '请选择一个内置虚拟养成活动。'; }
  else if (input.tasks.length === 0 || new Set(input.tasks.map(task => task.taskId)).size !== input.tasks.length) { field = 'tasks'; message = '请至少选择一个任务，同一任务不能重复加入目标。'; }
  if (field !== '') return { code: 'VALIDATION_FAILED', field, message };
  for (let index = 0; index < input.tasks.length; index += 1) {
    const task = input.tasks[index]!;
    if (task.weekdays.length === 0 || new Set(task.weekdays).size !== task.weekdays.length
      || task.weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) {
      return { code: 'VALIDATION_FAILED', field: `tasks.${index}.weekdays`, message: '请为任务选择不重复的星期一至星期日。' };
    }
    const rules = task.rules;
    if (rules !== undefined && (!validTaskRulePoints(rules) || !validTaskRuleOptions(rules))) {
      return { code: 'VALIDATION_FAILED', field: `tasks.${index}.rules`, message: '完成积分须为正整数，扣分值和奖励上限须为非负整数，请检查未完成处理与连续奖励设置。' };
    }
  }
  return null;
}
