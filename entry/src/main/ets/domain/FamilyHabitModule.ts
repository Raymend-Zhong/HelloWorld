import { Goal, GoalInput, cloneGoal, validateGoal, validBusinessDate, GrowthActivity, builtInActivities } from './Goals.js';
import { builtInTemplates, validTaskRulePoints, validTaskRuleOptions, TEMPLATE_SEED_VERSION, TaskRules, TaskStage, TaskTemplate } from './TaskTemplates.js';

export type ChildId = 'guoguo' | 'yangyang';

export interface ChildProfile {
  id: ChildId;
  displayName: string;
  avatar: string;
  theme: string;
}

export interface ParentCredential {
  salt: string;
  digest: string;
}

export interface TaskPoolTask {
  id: string;
  childId: ChildId;
  sourceTemplateId: string;
  name: string;
  description: string;
  defaultRules: TaskRules;
  disabled: boolean;
}

export interface CheckinRecord {
  id: string;
  childId: ChildId;
  taskId: string;
  businessDate: string;
  active: boolean;
  submittedBy: 'child' | 'parent';
}

export interface SettlementRecord {
  id: string;
  childId: ChildId;
  businessDate: string;
  revision: number;
  goals: SettlementGoalPreview[];
  active: boolean;
}

export interface FamilyState {
  settlements?: SettlementRecord[];
  checkins?: CheckinRecord[];
  goals?: Goal[];
  templateSeedVersion?: number;
  taskTemplates?: TaskTemplate[];
  taskPool?: TaskPoolTask[];
  schemaVersion: number;
  revision: number;
  children: ChildProfile[];
  parentCredential: ParentCredential | null;
}

export interface PersistenceAdapter {
  load(): Promise<FamilyState | null>;
  save(state: FamilyState): Promise<void>;
}

export interface PasswordHasher {
  createSalt(): Promise<string>;
  derive(password: string, salt: string): Promise<string>;
  verify(password: string, salt: string, digest: string): Promise<boolean>;
}

export interface ParentSetupSession {
  token: string;
  role: 'parent-setup';
}

export interface ChildSession {
  token: string;
  role: 'child';
  childId: ChildId;
}

export interface ParentSession {
  token: string;
  role: 'parent';
}

export type Session = ParentSetupSession | ChildSession | ParentSession;

export interface DomainError {
  field?: string;
  code: string;
  message: string;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: DomainError };

export type OpenSessionRequest =
  | { entry: 'parent-setup' }
  | { entry: 'child'; childId: ChildId }
  | { entry: 'parent'; password: string };

export interface CreateGoalCommand extends GoalInput { type: 'create-goal'; childId: ChildId; businessDate: string; }
export interface EditGoalCommand extends GoalInput { type: 'edit-goal'; childId: ChildId; businessDate: string; goalId: string; }

export type DomainCommand =
  | EditGoalCommand
  | CreateGoalCommand
  | { type: 'revoke-checkin'; childId: ChildId; checkinId: string }
  | { type: 'submit-checkin'; childId: ChildId; taskId: string; businessDate: string }
  | { type: 'set-parent-password'; password: string }
  | { type: 'disable-task-pool-task'; childId: ChildId; taskId: string }
  | { type: 'edit-task-pool-task'; childId: ChildId; taskId: string; name: string; description: string; defaultRules: TaskRules }
  | { type: 'copy-task-template'; childId: ChildId; templateId: string }
  | { type: 'manage-task-pool' }
  | { type: 'manage-goal' }
  | { type: 'exempt-task' }
  | { type: 'confirm-settlement'; childId: ChildId; businessDate: string; expectedRevision: number };

export interface ExecuteReceipt {
  checkinId?: string;
  settlementId?: string;
  goalId?: string;
  taskId?: string;
  revision: number;
}

export interface ScheduledTask { taskId: string; name: string; description: string; goalIds: string[]; completedCount: number; checkinIds: string[]; }
export interface ChildDay { currentChild: ChildProfile; businessDate: string; tasks: ScheduledTask[]; goals: Goal[]; revision: number; }
export interface ActivitySnapshot { activities: GrowthActivity[]; }
export interface GoalList { goals: Goal[]; revision: number; }
export interface GoalDetail { goal: Goal; revision: number; }
export interface SettlementTaskResult {
  taskId: string;
  status: 'completed' | 'missed';
  completedCount: number;
  pointsDelta: number;
}
export interface SettlementGoalPreview {
  goalId: string;
  results: SettlementTaskResult[];
  netDelta: number;
  pointsBefore: number;
  pointsAfter: number;
}
export interface SettlementPreview {
  childId: ChildId;
  businessDate: string;
  goals: SettlementGoalPreview[];
  revision: number;
}

export type InspectRequest =
  | { type: 'settlement-preview'; childId: ChildId; businessDate: string }
  | { type: 'growth-activities' }
  | { type: 'child-day'; childId: ChildId; businessDate: string }
  | { type: 'goal-list'; childId: ChildId }
  | { type: 'goal-detail'; childId: ChildId; goalId: string }
  | { type: 'task-pool'; childId: ChildId }
  | { type: 'task-templates'; stage: TaskStage }
  | { type: 'family-overview' }
  | { type: 'child-home' };

export interface FamilyOverview {
  children: ChildProfile[];
  canAddChild: false;
  canDeleteChild: false;
  revision: number;
}

export interface ChildHome {
  currentChild: ChildProfile;
  tasks: TaskPoolTask[];
  goals: unknown[];
  revision: number;
}

export interface TemplateSnapshot {
  templates: TaskTemplate[];
}

export interface TaskPoolSnapshot {
  currentChild: ChildProfile;
  tasks: TaskPoolTask[];
  revision: number;
}

export type InspectSnapshot = ActivitySnapshot | ChildDay | GoalList | GoalDetail | SettlementPreview | FamilyOverview | ChildHome | TemplateSnapshot | TaskPoolSnapshot;

const INITIAL_CHILDREN: ChildProfile[] = [
  {
    id: 'guoguo',
    displayName: '果果',
    avatar: 'guoguo',
    theme: 'mature',
  },
  {
    id: 'yangyang',
    displayName: '阳阳',
    avatar: 'yangyang',
    theme: 'playful',
  },
];

function cloneTask(task: TaskPoolTask): TaskPoolTask {
  return { ...task, defaultRules: { ...task.defaultRules } };
}

function cloneCheckin(checkin: CheckinRecord): CheckinRecord {
  return { ...checkin };
}

function cloneSettlement(settlement: SettlementRecord): SettlementRecord {
  return {
    ...settlement,
    goals: settlement.goals.map(goal => ({
      ...goal,
      results: goal.results.map(result => ({ ...result })),
    })),
  };
}

function cloneState(state: FamilyState): FamilyState {
  return {
    settlements: (state.settlements ?? []).map(cloneSettlement),
    checkins: (state.checkins ?? []).map(cloneCheckin),
    goals: (state.goals ?? []).map(cloneGoal),
    templateSeedVersion: state.templateSeedVersion ?? 0,
    taskTemplates: (state.taskTemplates ?? []).map(item => ({ ...item, defaultRules: { ...item.defaultRules } })),
    taskPool: (state.taskPool ?? []).map(cloneTask),
    schemaVersion: state.schemaVersion,
    revision: state.revision,
    children: state.children.map((child) => ({ ...child })),
    parentCredential: state.parentCredential === null
      ? null
      : { ...state.parentCredential },
  };
}

export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private state: FamilyState | null = null;

  async load(): Promise<FamilyState | null> {
    return this.state === null ? null : cloneState(this.state);
  }

  async save(state: FamilyState): Promise<void> {
    this.state = cloneState(state);
  }
}

export class FamilyHabitModule {
  private readonly sessions = new Map<string, Session>();
  private nextSessionId = 1;
  private pendingCommand: Promise<void> = Promise.resolve();

  private constructor(
    private readonly persistence: PersistenceAdapter,
    private readonly passwordHasher: PasswordHasher,
    private state: FamilyState,
  ) {}

  static async create(
    persistence: PersistenceAdapter,
    passwordHasher: PasswordHasher,
  ): Promise<FamilyHabitModule> {
    const stored = await persistence.load();
    if (stored !== null && (stored.schemaVersion < 1 || stored.schemaVersion > 4
      || (stored.templateSeedVersion ?? 0) > TEMPLATE_SEED_VERSION)) {
      throw new Error('家庭数据版本不兼容，请使用对应版本的应用。');
    }
    const state: FamilyState = stored === null ? {
      schemaVersion: 4,
      revision: 1,
      children: INITIAL_CHILDREN.map((child) => ({ ...child })),
      parentCredential: null,
    } : cloneState(stored);
    if (stored === null || state.schemaVersion < 4 || (state.templateSeedVersion ?? 0) < TEMPLATE_SEED_VERSION) {
      state.schemaVersion = 4;
      state.goals = state.goals ?? [];
      state.checkins = state.checkins ?? [];
      state.settlements = state.settlements ?? [];
      state.taskPool = state.taskPool ?? [];
      if ((state.templateSeedVersion ?? 0) < 1) {
        state.taskTemplates = builtInTemplates();
        state.templateSeedVersion = 1;
      }
      await persistence.save(state);
    }
    return new FamilyHabitModule(persistence, passwordHasher, state);
  }

  async openSession(request: OpenSessionRequest): Promise<Result<Session>> {
    const token = `session-${this.nextSessionId++}`;
    if (request.entry === 'child') {
      const child = this.state.children.find((item) => item.id === request.childId);
      if (child === undefined) {
        return {
          ok: false,
          error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' },
        };
      }
      const session: ChildSession = { token, role: 'child', childId: child.id };
      this.sessions.set(token, session);
      return { ok: true, value: session };
    }
    if (request.entry === 'parent') {
      const credential = this.state.parentCredential;
      const verified = credential !== null && await this.passwordHasher.verify(
        request.password,
        credential.salt,
        credential.digest,
      );
      if (!verified) {
        return {
          ok: false,
          error: {
            code: 'PARENT_PASSWORD_INCORRECT',
            message: '家长密码错误。',
          },
        };
      }
      const session: ParentSession = { token, role: 'parent' };
      this.sessions.set(token, session);
      return { ok: true, value: session };
    }
    if (this.state.parentCredential !== null) {
      return {
        ok: false,
        error: {
          code: 'PARENT_SETUP_COMPLETE',
          message: '家长密码已经设置，请使用密码进入。',
        },
      };
    }
    const session: ParentSetupSession = { token, role: 'parent-setup' };
    this.sessions.set(session.token, session);
    return { ok: true, value: session };
  }

  async execute(token: string, command: DomainCommand): Promise<Result<ExecuteReceipt>> {
    const submitted: DomainCommand = command.type === 'edit-task-pool-task'
      ? { ...command, defaultRules: { ...command.defaultRules } }
      : command.type === 'create-goal' || command.type === 'edit-goal'
        ? { ...command, tasks: command.tasks.map(task => task.rules === undefined
          ? { taskId: task.taskId, weekdays: [...task.weekdays] }
          : { taskId: task.taskId, weekdays: [...task.weekdays], rules: { ...task.rules } }) }
        : { ...command };
    const result = this.pendingCommand.then(() => this.executeCommand(token, submitted));
    this.pendingCommand = result.then(() => {}, () => {});
    return result;
  }

  private async executeCommand(
    token: string,
    command: DomainCommand,
  ): Promise<Result<ExecuteReceipt>> {
    const session = this.sessions.get(token);
    if (session === undefined) {
      return {
        ok: false,
        error: { code: 'SESSION_INVALID', message: '会话无效，请重新进入。' },
      };
    }
    if (
      session.role !== 'parent'
      && command.type !== 'submit-checkin'
      && command.type !== 'revoke-checkin'
      && command.type !== 'set-parent-password'
    ) {
      return {
        ok: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: '这个操作需要家长来完成。',
        },
      };
    }
    if (command.type === 'set-parent-password') {
      if (session.role !== 'parent-setup') {
        return {
          ok: false,
          error: { code: 'PERMISSION_DENIED', message: '当前入口不能设置家长密码。' },
        };
      }
      if (this.state.parentCredential !== null) {
        return {
          ok: false,
          error: {
            code: 'PARENT_SETUP_COMPLETE',
            message: '家长密码已经设置，请使用密码进入。',
          },
        };
      }
      if (command.password.length === 0) {
        return {
          ok: false,
          error: { code: 'VALIDATION_FAILED', message: '请输入家长密码。' },
        };
      }
      const salt = await this.passwordHasher.createSalt();
      const digest = await this.passwordHasher.derive(command.password, salt);
      const nextState: FamilyState = {
        ...cloneState(this.state),
        revision: this.state.revision + 1,
        parentCredential: { salt, digest },
      };
      return this.saveState(nextState);
    }
    if (command.type === 'submit-checkin') {
      if (session.role === 'child' && session.childId !== command.childId) {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '请从对应孩子入口打卡。' } };
      }
      if (!validBusinessDate(command.businessDate)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      }
      const task = (this.state.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      const checkin: CheckinRecord = {
        id: `checkin-${nextState.revision}`,
        childId: command.childId,
        taskId: command.taskId,
        businessDate: command.businessDate,
        active: true,
        submittedBy: session.role === 'parent' ? 'parent' : 'child',
      };
      nextState.checkins = [...(nextState.checkins ?? []), checkin];
      const saved = await this.saveState(nextState);
      if (!saved.ok) return saved;
      return { ok: true, value: { ...saved.value, checkinId: checkin.id } };
    }
    if (command.type === 'revoke-checkin') {
      if (session.role === 'child' && session.childId !== command.childId) {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '请从对应孩子入口撤销打卡。' } };
      }
      const nextState = cloneState(this.state);
      const checkin = (nextState.checkins ?? []).find(item => item.id === command.checkinId && item.childId === command.childId);
      if (checkin === undefined) return { ok: false, error: { code: 'CHECKIN_NOT_FOUND', message: '没有找到这条打卡记录。' } };
      if ((this.state.settlements ?? []).some(settlement => settlement.active
        && settlement.childId === command.childId
        && settlement.businessDate === checkin.businessDate)) {
        return { ok: false, error: { code: 'DATE_ALREADY_SETTLED', message: '该日期已清算，请联系家长先撤销清算。' } };
      }
      checkin.active = false;
      nextState.revision += 1;
      return this.saveState(nextState);
    }
    if (command.type === 'confirm-settlement') {
      if (!validBusinessDate(command.businessDate)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      }
      if ((this.state.settlements ?? []).some(settlement => settlement.active
        && settlement.childId === command.childId
        && settlement.businessDate === command.businessDate)) {
        return { ok: false, error: { code: 'DATE_ALREADY_SETTLED', message: '该日期已经清算。' } };
      }
      if (command.expectedRevision !== this.state.revision) {
        return { ok: false, error: { code: 'SETTLEMENT_PREVIEW_EXPIRED', message: '清算审阅已过期，请重新审阅。' } };
      }
      const preview = this.buildSettlementPreview(command.childId, command.businessDate, this.state);
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      for (const goalPreview of preview.goals) {
        const goal = (nextState.goals ?? []).find(item => item.id === goalPreview.goalId && item.childId === command.childId);
        if (goal === undefined) continue;
        goal.points = goalPreview.pointsAfter;
        goal.highestPoints = Math.max(goal.highestPoints, goal.points);
      }
      const settlement: SettlementRecord = {
        id: `settlement-${nextState.revision}`,
        childId: command.childId,
        businessDate: command.businessDate,
        revision: nextState.revision,
        goals: preview.goals.map(goal => ({
          ...goal,
          results: goal.results.map(result => ({ ...result })),
        })),
        active: true,
      };
      nextState.settlements = [...(nextState.settlements ?? []), settlement];
      const saved = await this.saveState(nextState);
      if (!saved.ok) return saved;
      return { ok: true, value: { ...saved.value, settlementId: settlement.id } };
    }
    if (command.type === 'create-goal' || command.type === 'edit-goal') {
      const previous = command.type === 'edit-goal' ? (this.state.goals ?? []).find(goal => goal.id === command.goalId && goal.childId === command.childId) : undefined;
      if (command.type === 'edit-goal' && previous === undefined) return { ok: false, error: { code: 'GOAL_NOT_FOUND', message: '没有找到这个打卡目标。' } };
      const invalid = validateGoal(command, command.businessDate);
      if (invalid !== null) return { ok: false, error: invalid };
      if (!this.state.children.some(child => child.id === command.childId)) {
        return { ok: false, error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' } };
      }
      if (command.tasks.some(input => !(this.state.taskPool ?? []).some(task => task.id === input.taskId && task.childId === command.childId
        && (!task.disabled || previous?.tasks.some(existing => existing.taskId === task.id))))) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'tasks', message: '请选择当前孩子任务池中未停用的任务；已有目标可保留原引用。' } };
      }
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      const goal: Goal = {
        id: previous?.id ?? `goal-${nextState.revision}`, childId: command.childId,
        name: command.name, description: command.description, threshold: command.threshold,
        plannedDays: command.plannedDays, reward: command.reward, activityId: command.activityId,
        startDate: previous?.startDate ?? command.businessDate, status: 'active', points: previous?.points ?? 0, highestPoints: previous?.highestPoints ?? 0,
        tasks: command.tasks.map(input => {
          const source = (this.state.taskPool ?? []).find(task => task.id === input.taskId)!;
          return { taskId: input.taskId, weekdays: [...input.weekdays], rules: { ...(input.rules ?? previous?.tasks.find(task => task.taskId === input.taskId)?.rules ?? source.defaultRules) } };
        }),
      };
      nextState.goals = [...(nextState.goals ?? []).filter(item => item.id !== goal.id), goal];
      const saved = await this.saveState(nextState);
      if (!saved.ok) return saved;
      return { ok: true, value: { ...saved.value, goalId: goal.id } };
    }
    if (command.type === 'disable-task-pool-task') {
      const nextState = cloneState(this.state);
      const task = (nextState.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      task.disabled = true;
      nextState.revision += 1;
      return this.saveState(nextState, task.id);
    }
    if (command.type === 'edit-task-pool-task') {
      if (command.name.trim().length === 0) return { ok: false, error: { code: 'VALIDATION_FAILED', message: '请输入任务名称。' } };
      const rules = command.defaultRules;
      if (!validTaskRulePoints(rules)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', message: '完成积分须为正整数，扣分值和连续奖励上限须为非负整数。' } };
      }
      if (!validTaskRuleOptions(rules)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', message: '请选择有效的未完成处理和连续奖励设置。' } };
      }
      const nextState = cloneState(this.state);
      const task = (nextState.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      task.name = command.name.trim();
      task.description = command.description;
      task.defaultRules = { ...command.defaultRules };
      nextState.revision += 1;
      return this.saveState(nextState, task.id);
    }
    if (command.type === 'copy-task-template') {
      if (!this.state.children.some(child => child.id === command.childId)) {
        return { ok: false, error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' } };
      }
      const source = (this.state.taskTemplates ?? []).find(item => item.id === command.templateId);
      if (source === undefined) return { ok: false, error: { code: 'TEMPLATE_NOT_FOUND', message: '没有找到这个任务模板。' } };
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      const task: TaskPoolTask = {
        id: `task-${nextState.revision}`, childId: command.childId,
        sourceTemplateId: source.id, name: source.name, description: source.description,
        defaultRules: { ...source.defaultRules }, disabled: false,
      };
      nextState.taskPool = [...(nextState.taskPool ?? []), task];
      return this.saveState(nextState, task.id);
    }
    return {
      ok: false,
      error: { code: 'COMMAND_UNSUPPORTED', message: '暂不支持此操作。' },
    };
  }

  private async saveState(nextState: FamilyState, taskId?: string): Promise<Result<ExecuteReceipt>> {
    try {
      await this.persistence.save(nextState);
    } catch (_) {
      return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '保存失败，请稍后重试。' } };
    }
    this.state = nextState;
    const receipt: ExecuteReceipt = { revision: nextState.revision };
    if (taskId !== undefined) receipt.taskId = taskId;
    return { ok: true, value: receipt };
  }

  private buildSettlementPreview(childId: ChildId, businessDate: string, state: FamilyState): SettlementPreview {
    const weekday = new Date(`${businessDate}T00:00:00.000Z`).getUTCDay() || 7;
    const goals: SettlementGoalPreview[] = [];
    for (const goal of state.goals ?? []) {
      if (goal.childId !== childId || goal.status !== 'active' || goal.startDate > businessDate) continue;
      const results: SettlementTaskResult[] = [];
      for (const task of goal.tasks) {
        if (!task.weekdays.includes(weekday)) continue;
        const completedCount = (state.checkins ?? []).filter(checkin => checkin.active
          && checkin.childId === childId
          && checkin.taskId === task.taskId
          && checkin.businessDate === businessDate).length;
        if (completedCount > 0) {
          results.push({
            taskId: task.taskId,
            status: 'completed',
            completedCount,
            pointsDelta: task.rules.completionPoints,
          });
        } else {
          results.push({
            taskId: task.taskId,
            status: 'missed',
            completedCount: 0,
            pointsDelta: task.rules.missedPolicy === 'deduct' ? -task.rules.deductionPoints : 0,
          });
        }
      }
      if (results.length === 0) continue;
      const netDelta = results.reduce((sum, result) => sum + result.pointsDelta, 0);
      goals.push({
        goalId: goal.id,
        results,
        netDelta,
        pointsBefore: goal.points,
        pointsAfter: Math.max(0, goal.points + netDelta),
      });
    }
    return { childId, businessDate, goals, revision: state.revision };
  }

  async inspect(token: string, request: { type: 'growth-activities' }): Promise<Result<ActivitySnapshot>>;
  async inspect(token: string, request: { type: 'settlement-preview'; childId: ChildId; businessDate: string }): Promise<Result<SettlementPreview>>;
  async inspect(token: string, request: { type: 'child-day'; childId: ChildId; businessDate: string }): Promise<Result<ChildDay>>;
  async inspect(token: string, request: { type: 'goal-list'; childId: ChildId }): Promise<Result<GoalList>>;
  async inspect(token: string, request: { type: 'goal-detail'; childId: ChildId; goalId: string }): Promise<Result<GoalDetail>>;
  async inspect(
    token: string,
    request: { type: 'task-pool'; childId: ChildId },
  ): Promise<Result<TaskPoolSnapshot>>;
  async inspect(
    token: string,
    request: { type: 'task-templates'; stage: TaskStage },
  ): Promise<Result<TemplateSnapshot>>;
  async inspect(
    token: string,
    request: { type: 'family-overview' },
  ): Promise<Result<FamilyOverview>>;
  async inspect(
    token: string,
    request: { type: 'child-home' },
  ): Promise<Result<ChildHome>>;
  async inspect(token: string, request: InspectRequest): Promise<Result<InspectSnapshot>> {
    const session = this.sessions.get(token);
    if (session === undefined) {
      return {
        ok: false,
        error: { code: 'SESSION_INVALID', message: '会话无效，请重新进入。' },
      };
    }
    if (request.type === 'growth-activities') return { ok: true, value: { activities: builtInActivities() } };
    if (request.type === 'goal-detail' || request.type === 'goal-list' || request.type === 'child-day' || request.type === 'settlement-preview') {
      if (session.role !== 'parent' && (session.role !== 'child' || session.childId !== request.childId)) {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '请从对应孩子入口查看目标。' } };
      }
      if (!this.state.children.some(child => child.id === request.childId)) {
        return { ok: false, error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' } };
      }
    }
    if (request.type === 'settlement-preview') {
      if (session.role !== 'parent') {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '这个操作需要家长来完成。' } };
      }
      if (!validBusinessDate(request.businessDate)) return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      return { ok: true, value: this.buildSettlementPreview(request.childId, request.businessDate, this.state) };
    }
    if (request.type === 'child-day') {
      if (!validBusinessDate(request.businessDate)) return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      const goals = (this.state.goals ?? []).filter(goal => goal.childId === request.childId);
      const weekday = new Date(`${request.businessDate}T00:00:00.000Z`).getUTCDay() || 7;
      const tasks: ScheduledTask[] = [];
      for (const goal of goals) {
        if (goal.status !== 'active' || goal.startDate > request.businessDate) continue;
        for (const task of goal.tasks) {
          if (!task.weekdays.includes(weekday)) continue;
          const existing = tasks.find(item => item.taskId === task.taskId);
          if (existing !== undefined) { existing.goalIds.push(goal.id); continue; }
          const source = (this.state.taskPool ?? []).find(item => item.id === task.taskId)!;
          const checkins = (this.state.checkins ?? []).filter(checkin => checkin.active
            && checkin.childId === request.childId
            && checkin.taskId === task.taskId
            && checkin.businessDate === request.businessDate);
          tasks.push({ taskId: task.taskId, name: source.name, description: source.description, goalIds: [goal.id], completedCount: checkins.length, checkinIds: checkins.map(checkin => checkin.id) });
        }
      }
      return { ok: true, value: { currentChild: { ...this.state.children.find(child => child.id === request.childId)! }, businessDate: request.businessDate, tasks, goals: goals.map(cloneGoal), revision: this.state.revision } };
    }
    if (request.type === 'goal-list') {
      return { ok: true, value: { goals: (this.state.goals ?? []).filter(goal => goal.childId === request.childId).map(cloneGoal), revision: this.state.revision } };
    }
    if (request.type === 'goal-detail') {
      const goal = (this.state.goals ?? []).find(item => item.id === request.goalId && item.childId === request.childId);
      if (goal === undefined) return { ok: false, error: { code: 'GOAL_NOT_FOUND', message: '没有找到这个打卡目标。' } };
      return { ok: true, value: { goal: cloneGoal(goal), revision: this.state.revision } };
    }
    if (request.type === 'task-pool') {
      if (session.role !== 'parent' && (session.role !== 'child' || session.childId !== request.childId)) {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '请从对应孩子入口查看任务池。' } };
      }
      const child = this.state.children.find(item => item.id === request.childId);
      if (child === undefined) return { ok: false, error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' } };
      return { ok: true, value: {
        currentChild: { ...child }, revision: this.state.revision,
        tasks: (this.state.taskPool ?? []).filter(item => item.childId === child.id).map(cloneTask),
      } };
    }
    if (request.type === 'task-templates') {
      return { ok: true, value: { templates: (this.state.taskTemplates ?? []).filter(item => item.stage === request.stage).map(item => ({ ...item, defaultRules: { ...item.defaultRules } })) } };
    }
    if (request.type === 'family-overview') {
      return {
        ok: true,
        value: {
          children: this.state.children.map((child) => ({ ...child })),
          canAddChild: false,
          canDeleteChild: false,
          revision: this.state.revision,
        },
      };
    }
    if (request.type === 'child-home' && session.role === 'child') {
      const child = this.state.children.find((item) => item.id === session.childId);
      if (child === undefined) {
        return {
          ok: false,
          error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' },
        };
      }
      return {
        ok: true,
        value: {
          currentChild: { ...child },
          tasks: (this.state.taskPool ?? []).filter(item => item.childId === child.id).map(cloneTask),
          goals: [],
          revision: this.state.revision,
        },
      };
    }
    return {
      ok: false,
      error: { code: 'QUERY_UNSUPPORTED', message: '暂不支持此查询。' },
    };
  }
}
