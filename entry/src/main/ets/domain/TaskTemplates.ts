export type TaskStage = 'junior' | 'kindergarten';

export interface TaskRules {
  completionPoints: number;
  missedPolicy: 'no-points' | 'deduct';
  deductionPoints: number;
  streakEnabled: boolean;
  streakCap: number | null;
}

export interface TaskTemplate {
  id: string;
  stage: TaskStage;
  name: string;
  description: string;
  defaultRules: TaskRules;
}

function template(id: string, stage: TaskStage, name: string): TaskTemplate {
  return {
    id, stage, name, description: name,
    defaultRules: {
      completionPoints: 1,
      missedPolicy: 'no-points',
      deductionPoints: 0,
      streakEnabled: false,
      streakCap: null,
    },
  };
}

// 后续版本追加种子变更，任务池始终保留复制时的独立内容。
export const TEMPLATE_SEED_VERSION = 1;
export function builtInTemplates(): TaskTemplate[] {
  return [
    template('junior-math', 'junior', '数学课外练习'),
    template('junior-english', 'junior', '英语课外练习'),
    template('junior-reading', 'junior', '语文阅读'),
    template('junior-brushing', 'junior', '刷牙'),
    template('junior-bedtime', 'junior', '目标时间前准备睡觉'),
    template('kindergarten-english', 'kindergarten', '英语打卡'),
    template('kindergarten-brushing', 'kindergarten', '刷牙'),
    template('kindergarten-breakfast', 'kindergarten', '在幼儿园吃早餐'),
    template('kindergarten-lunch', 'kindergarten', '在幼儿园吃午餐'),
    template('kindergarten-bedtime', 'kindergarten', '目标时间前准备睡觉'),
  ];
}
