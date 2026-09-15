import { Goal, GoalInput, cloneGoal, clonePlan, normalizeTaskPlan, validateGoal, validBusinessDate, GrowthActivity, builtInActivities } from './Goals.js';
import { builtInTemplates, validTaskRulePoints, validTaskRuleOptions, TEMPLATE_SEED_VERSION, TaskRules, TaskStage, TaskTemplate } from './TaskTemplates.js';

export type ChildId = 'guoguo' | 'yangyang';

export interface ChildProfile {
  id: ChildId;
  displayName: string;
  avatar: string;
  theme: string;
  teacher?: string;
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
  taskRules?: Record<string, TaskRules>;
  active: boolean;
}

export type TaskExemption =
  | {
    id: string;
    childId: ChildId;
    taskId: string;
    kind: 'date';
    businessDate: string;
  }
  | {
    id: string;
    childId: ChildId;
    taskId: string;
    kind: 'weekly';
    weekStart: string;
    weekEnd: string;
  };

export interface FamilyState {
  exemptions?: TaskExemption[];
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
  | { type: 'exempt-date-task'; childId: ChildId; taskId: string; businessDate: string }
  | { type: 'exempt-date-tasks'; childId: ChildId; businessDate: string }
  | { type: 'exempt-weekly-task'; childId: ChildId; taskId: string; weekOf: string }
  | { type: 'revoke-checkin'; childId: ChildId; checkinId: string }
  | { type: 'submit-checkin'; childId: ChildId; taskId: string; businessDate: string }
  | { type: 'set-parent-password'; password: string }
  | { type: 'update-child-profile'; childId: ChildId; displayName: string; avatar: string; theme: string; teacher: string }
  | { type: 'disable-task-pool-task'; childId: ChildId; taskId: string }
  | { type: 'edit-task-pool-task'; childId: ChildId; taskId: string; name: string; description: string; defaultRules: TaskRules }
  | { type: 'copy-task-template'; childId: ChildId; templateId: string }
  | { type: 'manage-task-pool' }
  | { type: 'manage-goal' }
  | { type: 'exempt-task' }
  | { type: 'terminate-goal'; childId: ChildId; goalId: string }
  | { type: 'revoke-settlement'; childId: ChildId; businessDate: string }
  | { type: 'confirm-settlement'; childId: ChildId; businessDate: string; expectedRevision: number };

export interface ExecuteReceipt {
  checkinId?: string;
  settlementId?: string;
  goalId?: string;
  taskId?: string;
  revision: number;
}

export interface ScheduledTask { taskId: string; name: string; description: string; goalIds: string[]; completedCount: number; checkinIds: string[]; requiredCount?: number; }
export interface ChildDay { currentChild: ChildProfile; businessDate: string; tasks: ScheduledTask[]; goals: Goal[]; revision: number; }
export interface ActivitySnapshot { activities: GrowthActivity[]; }
export interface GoalList { goals: Goal[]; revision: number; }
export interface GrowthSnapshot {
  activityId: string;
  currentPoints: number;
  highestPoints: number;
  progressPercent: number;
}
export interface GoalDetail { goal: Goal; growth: GrowthSnapshot; revision: number; }
export interface SettlementTaskResult {
  taskId: string;
  planKind: 'date-weekdays' | 'weekly-frequency';
  status: 'completed' | 'missed' | 'exempted';
  completedCount: number;
  pointsDelta: number;
}
export interface SettlementGoalPreview {
  goalId: string;
  results: SettlementTaskResult[];
  netDelta: number;
  pointsBefore: number;
  pointsAfter: number;
  feedback?: SettlementFeedbackStep[] | undefined;
}
export interface SettlementFeedbackStep {
  kind: 'reward' | 'encouragement' | 'penalty' | 'discipline' | 'summary' | 'growth';
  text: string;
  once: boolean;
}
export interface SettlementPreview {
  childId: ChildId;
  businessDate: string;
  goals: SettlementGoalPreview[];
  revision: number;
}

export interface SettlementHistory {
  childId: ChildId;
  businessDate: string;
  settlements: SettlementRecord[];
  revision: number;
}

export type InspectRequest =
  | { type: 'settlement-history'; childId: ChildId; businessDate: string }
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

export type InspectSnapshot = ActivitySnapshot | ChildDay | GoalList | GoalDetail | SettlementPreview | SettlementHistory | FamilyOverview | ChildHome | TemplateSnapshot | TaskPoolSnapshot;

const INITIAL_CHILDREN: ChildProfile[] = [
  {
    id: 'guoguo',
    displayName: '果果',
    avatar: 'guoguo',
    theme: 'mature',
    teacher: 'calm',
  },
  {
    id: 'yangyang',
    displayName: '阳阳',
    avatar: 'yangyang',
    theme: 'playful',
    teacher: 'storybook',
  },
];

function cloneTask(task: TaskPoolTask): TaskPoolTask {
  return { ...task, defaultRules: { ...task.defaultRules } };
}

function cloneCheckin(checkin: CheckinRecord): CheckinRecord {
  return { ...checkin };
}

function cloneExemption(exemption: TaskExemption): TaskExemption {
  return { ...exemption };
}

function cloneGoalTaskInput<T extends GoalInput['tasks'][number]>(task: T): T {
  const plan = normalizeTaskPlan(task);
  const copy = {
    taskId: task.taskId,
    ...(plan?.kind === 'weekly-frequency'
      ? { plan: clonePlan(plan), weekdays: [] }
      : { plan: plan === null ? undefined : clonePlan(plan), weekdays: [...(plan?.weekdays ?? [])] }),
    ...(task.rules === undefined ? {} : { rules: { ...task.rules } }),
  };
  return copy as T;
}

function cloneSettlement(settlement: SettlementRecord): SettlementRecord {
  const copy: SettlementRecord = {
    ...settlement,
    goals: settlement.goals.map(goal => ({
      ...goal,
      results: goal.results.map(result => ({ ...result })),
      feedback: goal.feedback?.map(step => ({ ...step })),
    })),
  };
  if (settlement.taskRules !== undefined) {
    copy.taskRules = Object.fromEntries(Object.entries(settlement.taskRules).map(([taskId, rules]) => [taskId, { ...rules }]));
  }
  return copy;
}

function dateFromEpochDay(epochDay: number): string {
  return new Date(epochDay * 86400000).toISOString().slice(0, 10);
}

function weekBounds(businessDate: string): { start: string; end: string } {
  const date = new Date(`${businessDate}T00:00:00.000Z`);
  const weekday = date.getUTCDay() || 7;
  const epochDay = Math.floor(date.getTime() / 86400000);
  return {
    start: dateFromEpochDay(epochDay - weekday + 1),
    end: dateFromEpochDay(epochDay + (7 - weekday)),
  };
}

function activeCheckinsForTask(
  state: FamilyState,
  childId: ChildId,
  taskId: string,
  startDate: string,
  endDate: string,
): CheckinRecord[] {
  return (state.checkins ?? []).filter(checkin => checkin.active
    && checkin.childId === childId
    && checkin.taskId === taskId
    && checkin.businessDate >= startDate
    && checkin.businessDate <= endDate);
}

function cloneState(state: FamilyState): FamilyState {
  return {
    exemptions: (state.exemptions ?? []).map(cloneExemption),
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
    if (stored !== null && (stored.schemaVersion < 1 || stored.schemaVersion > 6
      || (stored.templateSeedVersion ?? 0) > TEMPLATE_SEED_VERSION)) {
      throw new Error('家庭数据版本不兼容，请使用对应版本的应用。');
    }
    const state: FamilyState = stored === null ? {
      schemaVersion: 6,
      revision: 1,
      children: INITIAL_CHILDREN.map((child) => ({ ...child })),
      parentCredential: null,
    } : cloneState(stored);
    for (const child of state.children) {
      child.teacher = child.teacher ?? (child.id === 'guoguo' ? 'calm' : 'storybook');
    }
    if (stored === null || state.schemaVersion < 6 || (state.templateSeedVersion ?? 0) < TEMPLATE_SEED_VERSION) {
      state.schemaVersion = 6;
      state.goals = state.goals ?? [];
      for (const goal of state.goals) {
        for (const task of goal.tasks) {
          task.streakCount = task.streakCount ?? 0;
          task.plan = task.plan ?? { kind: 'date-weekdays', weekdays: [...task.weekdays] };
        }
      }
      state.checkins = state.checkins ?? [];
      state.settlements = state.settlements ?? [];
      state.exemptions = state.exemptions ?? [];
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
        ? { ...command, tasks: command.tasks.map(cloneGoalTaskInput) }
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
    if (command.type === 'update-child-profile') {
      if (!this.state.children.some(child => child.id === command.childId)) {
        return { ok: false, error: { code: 'CHILD_NOT_FOUND', message: '没有找到这个孩子账套。' } };
      }
      if (command.displayName.trim().length === 0) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'displayName', message: '请输入孩子昵称。' } };
      }
      if (!['mature', 'playful', 'focus'].includes(command.theme)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'theme', message: '请选择内置主题。' } };
      }
      if (!['calm', 'storybook'].includes(command.teacher)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'teacher', message: '请选择内置老师形象。' } };
      }
      const nextState = cloneState(this.state);
      const child = nextState.children.find(item => item.id === command.childId)!;
      child.displayName = command.displayName.trim();
      child.avatar = command.avatar;
      child.theme = command.theme;
      child.teacher = command.teacher;
      nextState.revision += 1;
      return this.saveState(nextState);
    }
    if (command.type === 'revoke-checkin') {
      if (session.role === 'child' && session.childId !== command.childId) {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '请从对应孩子入口撤销打卡。' } };
      }
      const nextState = cloneState(this.state);
      const checkin = (nextState.checkins ?? []).find(item => item.id === command.checkinId && item.childId === command.childId);
      if (checkin === undefined) return { ok: false, error: { code: 'CHECKIN_NOT_FOUND', message: '没有找到这条打卡记录。' } };
      if (this.checkinBelongsToActiveSettlement(checkin)) {
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
        if (goal.points >= goal.threshold) goal.status = 'achieved';
        for (const result of goalPreview.results) {
          const goalTask = goal.tasks.find(task => task.taskId === result.taskId);
          if (goalTask === undefined || !goalTask.rules.streakEnabled) continue;
          if (result.status === 'exempted') continue;
          goalTask.streakCount = result.status === 'completed' ? (goalTask.streakCount ?? 0) + 1 : 0;
        }
      }
      const settlement: SettlementRecord = {
        id: `settlement-${nextState.revision}`,
        childId: command.childId,
        businessDate: command.businessDate,
        revision: nextState.revision,
        taskRules: this.settlementTaskRules(nextState, command.childId, preview.goals),
        goals: preview.goals.map(goal => ({
          ...goal,
          results: goal.results.map(result => ({ ...result })),
          feedback: this.buildSettlementFeedbackForPreview(nextState, command.childId, goal),
        })),
        active: true,
      };
      nextState.settlements = [...(nextState.settlements ?? []), settlement];
      this.recalculateActiveSettlements(nextState, command.childId);
      const saved = await this.saveState(nextState);
      if (!saved.ok) return saved;
      return { ok: true, value: { ...saved.value, settlementId: settlement.id } };
    }
    if (command.type === 'revoke-settlement') {
      if (!validBusinessDate(command.businessDate)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      }
      const nextState = cloneState(this.state);
      const settlement = (nextState.settlements ?? []).find(item => item.active
        && item.childId === command.childId
        && item.businessDate === command.businessDate);
      if (settlement === undefined) {
        return { ok: false, error: { code: 'SETTLEMENT_NOT_FOUND', message: '没有找到这一天的有效清算。' } };
      }
      settlement.active = false;
      nextState.revision += 1;
      this.recalculateActiveSettlements(nextState, command.childId);
      return this.saveState(nextState);
    }
    if (command.type === 'exempt-date-task') {
      if (!validBusinessDate(command.businessDate)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      }
      const task = (this.state.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      if (!this.hasApplicableTaskPlan(this.state, command.childId, command.taskId, command.businessDate, 'date-weekdays')) {
        return { ok: false, error: { code: 'PLAN_NOT_APPLICABLE', message: '该任务计划不能使用这种豁免方式。' } };
      }
      if ((this.state.settlements ?? []).some(settlement => settlement.active
        && settlement.childId === command.childId
        && settlement.businessDate === command.businessDate)) {
        return { ok: false, error: { code: 'DATE_ALREADY_SETTLED', message: '该日期已经清算。' } };
      }
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      nextState.exemptions = [...(nextState.exemptions ?? []).filter(exemption => !(exemption.childId === command.childId
        && exemption.taskId === command.taskId
        && exemption.kind === 'date'
        && exemption.businessDate === command.businessDate)), {
        id: `exemption-${nextState.revision}`,
        childId: command.childId,
        taskId: command.taskId,
        kind: 'date',
        businessDate: command.businessDate,
      }];
      return this.saveState(nextState);
    }
    if (command.type === 'exempt-date-tasks') {
      if (!validBusinessDate(command.businessDate)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      }
      if ((this.state.settlements ?? []).some(settlement => settlement.active
        && settlement.childId === command.childId
        && settlement.businessDate === command.businessDate)) {
        return { ok: false, error: { code: 'DATE_ALREADY_SETTLED', message: '该日期已经清算。' } };
      }
      const taskIds = this.applicableDateTaskIds(this.state, command.childId, command.businessDate);
      if (taskIds.length === 0) {
        return { ok: false, error: { code: 'PLAN_NOT_APPLICABLE', message: '这一天没有可豁免的按日期任务。' } };
      }
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      const existing = (nextState.exemptions ?? []).filter(exemption => !(exemption.childId === command.childId
        && exemption.kind === 'date'
        && exemption.businessDate === command.businessDate
        && taskIds.includes(exemption.taskId)));
      nextState.exemptions = [
        ...existing,
        ...taskIds.map(taskId => ({
          id: `exemption-${nextState.revision}-${taskId}`,
          childId: command.childId,
          taskId,
          kind: 'date' as const,
          businessDate: command.businessDate,
        })),
      ];
      return this.saveState(nextState);
    }
    if (command.type === 'exempt-weekly-task') {
      if (!validBusinessDate(command.weekOf)) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'weekOf', message: '请选择有效的业务日期。' } };
      }
      const task = (this.state.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      const bounds = weekBounds(command.weekOf);
      if (!this.hasApplicableTaskPlan(this.state, command.childId, command.taskId, command.weekOf, 'weekly-frequency')) {
        return { ok: false, error: { code: 'PLAN_NOT_APPLICABLE', message: '该任务计划不能使用这种豁免方式。' } };
      }
      if ((this.state.settlements ?? []).some(settlement => settlement.active
        && settlement.childId === command.childId
        && settlement.businessDate >= bounds.start
        && settlement.businessDate <= bounds.end)) {
        return { ok: false, error: { code: 'DATE_ALREADY_SETTLED', message: '该周期已有清算，请联系家长先撤销清算。' } };
      }
      const nextState = cloneState(this.state);
      nextState.revision += 1;
      nextState.exemptions = [...(nextState.exemptions ?? []).filter(exemption => !(exemption.childId === command.childId
        && exemption.taskId === command.taskId
        && exemption.kind === 'weekly'
        && exemption.weekStart === bounds.start
        && exemption.weekEnd === bounds.end)), {
        id: `exemption-${nextState.revision}`,
        childId: command.childId,
        taskId: command.taskId,
        kind: 'weekly',
        weekStart: bounds.start,
        weekEnd: bounds.end,
      }];
      return this.saveState(nextState);
    }
    if (command.type === 'create-goal' || command.type === 'edit-goal') {
      const previous = command.type === 'edit-goal' ? (this.state.goals ?? []).find(goal => goal.id === command.goalId && goal.childId === command.childId) : undefined;
      if (command.type === 'edit-goal' && previous === undefined) return { ok: false, error: { code: 'GOAL_NOT_FOUND', message: '没有找到这个打卡目标。' } };
      if (previous !== undefined && previous.status !== 'active') {
        return { ok: false, error: { code: 'GOAL_ENDED', message: '目标已结束，不能直接编辑历史目标。' } };
      }
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
          const existing = previous?.tasks.find(task => task.taskId === input.taskId);
          const plan = normalizeTaskPlan(input)!;
          return {
            taskId: input.taskId,
            weekdays: plan.kind === 'date-weekdays' ? [...plan.weekdays] : [],
            plan: clonePlan(plan),
            rules: { ...(input.rules ?? existing?.rules ?? source.defaultRules) },
            streakCount: existing?.streakCount ?? 0,
          };
        }),
      };
      if (goal.points >= goal.threshold) goal.status = 'achieved';
      nextState.goals = [...(nextState.goals ?? []).filter(item => item.id !== goal.id), goal];
      const saved = await this.saveState(nextState);
      if (!saved.ok) return saved;
      return { ok: true, value: { ...saved.value, goalId: goal.id } };
    }
    if (command.type === 'terminate-goal') {
      const nextState = cloneState(this.state);
      const goal = (nextState.goals ?? []).find(item => item.id === command.goalId && item.childId === command.childId);
      if (goal === undefined) return { ok: false, error: { code: 'GOAL_NOT_FOUND', message: '没有找到这个打卡目标。' } };
      if (goal.status !== 'active') return { ok: false, error: { code: 'GOAL_ENDED', message: '目标已结束，不能重复终止。' } };
      goal.status = 'terminated';
      nextState.revision += 1;
      return this.saveState(nextState);
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

  private checkinBelongsToActiveSettlement(checkin: CheckinRecord): boolean {
    for (const settlement of this.state.settlements ?? []) {
      if (!settlement.active || settlement.childId !== checkin.childId) continue;
      if (settlement.businessDate === checkin.businessDate) return true;
      const settledWeeklyTaskIds = settlement.goals.flatMap(goal => goal.results
        .filter(result => result.planKind === 'weekly-frequency')
        .map(result => result.taskId));
      if (!settledWeeklyTaskIds.includes(checkin.taskId)) continue;
      const bounds = weekBounds(settlement.businessDate);
      if (checkin.businessDate >= bounds.start && checkin.businessDate <= bounds.end) return true;
    }
    return false;
  }

  private buildSettlementPreview(childId: ChildId, businessDate: string, state: FamilyState): SettlementPreview {
    const weekday = new Date(`${businessDate}T00:00:00.000Z`).getUTCDay() || 7;
    const goals: SettlementGoalPreview[] = [];
    for (const goal of state.goals ?? []) {
      if (goal.childId !== childId || goal.status !== 'active' || goal.startDate > businessDate) continue;
      const results: SettlementTaskResult[] = [];
      for (const task of goal.tasks) {
        const plan = task.plan ?? { kind: 'date-weekdays' as const, weekdays: task.weekdays };
        if (plan.kind === 'date-weekdays') {
          if (!plan.weekdays.includes(weekday)) continue;
          if (this.hasDateExemption(state, childId, task.taskId, businessDate)) {
            results.push(this.buildExemptedTaskResult(task.taskId, plan.kind));
            continue;
          }
          const completedCount = (state.checkins ?? []).filter(checkin => checkin.active
            && checkin.childId === childId
            && checkin.taskId === task.taskId
            && checkin.businessDate === businessDate).length;
          results.push(this.buildTaskResult(task, plan.kind, completedCount > 0, completedCount));
          continue;
        }
        const bounds = weekBounds(businessDate);
        if (this.hasWeeklyExemption(state, childId, task.taskId, bounds.start, bounds.end)) {
          if (businessDate === bounds.end) {
            results.push(this.buildExemptedTaskResult(task.taskId, plan.kind));
          }
          continue;
        }
        const checkins = activeCheckinsForTask(state, childId, task.taskId, bounds.start, businessDate);
        if (checkins.length >= plan.requiredCount) {
          const beforeToday = checkins.filter(checkin => checkin.businessDate < businessDate).length;
          if (beforeToday < plan.requiredCount) {
            results.push(this.buildTaskResult(task, plan.kind, true, checkins.length));
          }
        } else if (businessDate === bounds.end) {
          results.push(this.buildTaskResult(task, plan.kind, false, checkins.length));
        }
      }
      if (results.length === 0) continue;
      const netDelta = results.reduce((sum, result) => sum + result.pointsDelta, 0);
      const pointsAfter = Math.max(0, goal.points + netDelta);
      goals.push({
        goalId: goal.id,
        results,
        netDelta,
        pointsBefore: goal.points,
        pointsAfter,
      });
    }
    return { childId, businessDate, goals, revision: state.revision };
  }

  private buildSettlementFeedback(
    state: FamilyState,
    childId: ChildId,
    goal: Goal,
    results: SettlementTaskResult[],
    netDelta: number,
    pointsAfter: number,
  ): SettlementFeedbackStep[] {
    const child = state.children.find(item => item.id === childId);
    const displayName = child?.displayName ?? '孩子';
    const activityName = builtInActivities().find(activity => activity.id === goal.activityId)?.name ?? '虚拟伙伴';
    const activitySubject = activityName.replace(/^(养|种)/, '');
    const taskName = (taskId: string): string => (state.taskPool ?? []).find(task => task.id === taskId && task.childId === childId)?.name ?? '任务';
    const feedback: SettlementFeedbackStep[] = [];
    const rewards = results.filter(result => result.pointsDelta > 0);
    const penalties = results.filter(result => result.pointsDelta < 0);
    for (const result of rewards) {
      feedback.push({
        kind: 'reward',
        once: false,
        text: `${taskName(result.taskId)}完成了，获得 ${result.pointsDelta} 分。`,
      });
    }
    if (rewards.length > 0) {
      feedback.push({
        kind: 'encouragement',
        once: true,
        text: `${displayName}保持得很稳，给${activitySubject}一次鼓励。`,
      });
    }
    for (const result of penalties) {
      feedback.push({
        kind: 'penalty',
        once: false,
        text: `${taskName(result.taskId)}没有完成，扣 ${Math.abs(result.pointsDelta)} 分。`,
      });
    }
    if (penalties.length > 0) {
      feedback.push({
        kind: 'discipline',
        once: true,
        text: `${displayName}需要记住这次后果，${activitySubject}接受一次提醒。`,
      });
    }
    const highestPoints = Math.max(goal.highestPoints, pointsAfter);
    feedback.push({
      kind: 'summary',
      once: false,
      text: `本次净变化 ${netDelta} 分，累计 ${pointsAfter} / ${goal.threshold} 分。`,
    });
    feedback.push({
      kind: 'growth',
      once: false,
      text: `虚拟成长进度 ${Math.min(100, Math.floor((highestPoints / goal.threshold) * 100))}%，最高积分 ${highestPoints} 分。`,
    });
    return feedback;
  }

  private buildSettlementFeedbackForPreview(
    state: FamilyState,
    childId: ChildId,
    preview: SettlementGoalPreview,
  ): SettlementFeedbackStep[] {
    const goal = (state.goals ?? []).find(item => item.id === preview.goalId && item.childId === childId);
    if (goal === undefined) return [];
    return this.buildSettlementFeedback(
      state,
      childId,
      goal,
      preview.results,
      preview.netDelta,
      preview.pointsAfter,
    );
  }

  private hasDateExemption(state: FamilyState, childId: ChildId, taskId: string, businessDate: string): boolean {
    return (state.exemptions ?? []).some(exemption => exemption.kind === 'date'
      && exemption.childId === childId
      && exemption.taskId === taskId
      && exemption.businessDate === businessDate);
  }

  private hasApplicableTaskPlan(
    state: FamilyState,
    childId: ChildId,
    taskId: string,
    businessDate: string,
    planKind: 'date-weekdays' | 'weekly-frequency',
  ): boolean {
    const weekday = new Date(`${businessDate}T00:00:00.000Z`).getUTCDay() || 7;
    return (state.goals ?? []).some(goal => goal.childId === childId
      && goal.status === 'active'
      && goal.startDate <= businessDate
      && goal.tasks.some(task => {
        if (task.taskId !== taskId) return false;
        const plan = task.plan ?? { kind: 'date-weekdays' as const, weekdays: task.weekdays };
        return plan.kind === planKind && (plan.kind === 'weekly-frequency' || plan.weekdays.includes(weekday));
      }));
  }

  private applicableDateTaskIds(state: FamilyState, childId: ChildId, businessDate: string): string[] {
    const weekday = new Date(`${businessDate}T00:00:00.000Z`).getUTCDay() || 7;
    return [...new Set((state.goals ?? [])
      .filter(goal => goal.childId === childId && goal.status === 'active' && goal.startDate <= businessDate)
      .flatMap(goal => goal.tasks)
      .filter(task => {
        const plan = task.plan ?? { kind: 'date-weekdays' as const, weekdays: task.weekdays };
        return plan.kind === 'date-weekdays' && plan.weekdays.includes(weekday);
      })
      .map(task => task.taskId))];
  }

  private hasWeeklyExemption(state: FamilyState, childId: ChildId, taskId: string, weekStart: string, weekEnd: string): boolean {
    return (state.exemptions ?? []).some(exemption => exemption.kind === 'weekly'
      && exemption.childId === childId
      && exemption.taskId === taskId
      && exemption.weekStart === weekStart
      && exemption.weekEnd === weekEnd);
  }

  private buildExemptedTaskResult(taskId: string, planKind: SettlementTaskResult['planKind']): SettlementTaskResult {
    return {
      taskId,
      planKind,
      status: 'exempted',
      completedCount: 0,
      pointsDelta: 0,
    };
  }

  private buildTaskResult(
    task: Goal['tasks'][number],
    planKind: SettlementTaskResult['planKind'],
    completed: boolean,
    completedCount: number,
  ): SettlementTaskResult {
    if (completed) {
      const streakBonus = task.rules.streakEnabled
        ? Math.min(
          task.rules.streakCap ?? Number.MAX_SAFE_INTEGER,
          task.streakCount ?? 0,
        )
        : 0;
      return {
        taskId: task.taskId,
        planKind,
        status: 'completed',
        completedCount,
        pointsDelta: task.rules.completionPoints + streakBonus,
      };
    }
    return {
      taskId: task.taskId,
      planKind,
      status: 'missed',
      completedCount,
      pointsDelta: task.rules.missedPolicy === 'deduct' ? -task.rules.deductionPoints : 0,
    };
  }

  private recalculateActiveSettlements(state: FamilyState, childId: ChildId): void {
    for (const goal of state.goals ?? []) {
      if (goal.childId !== childId) continue;
      goal.points = 0;
      goal.highestPoints = 0;
      if (goal.status === 'achieved') goal.status = 'active';
      for (const task of goal.tasks) task.streakCount = 0;
    }
    const settlements = (state.settlements ?? [])
      .filter(settlement => settlement.active && settlement.childId === childId)
      .sort((left, right) => left.businessDate.localeCompare(right.businessDate) || left.revision - right.revision);
    for (const settlement of settlements) {
      settlement.goals = settlement.goals.map(goalPreview => {
        const goal = (state.goals ?? []).find(item => item.id === goalPreview.goalId && item.childId === childId);
        const pointsBefore = goal?.points ?? goalPreview.pointsBefore;
        const results = goalPreview.results.map(result => {
          const goalTask = goal?.tasks.find(task => task.taskId === result.taskId);
          const rules = settlement.taskRules?.[this.settlementTaskRuleKey(goalPreview.goalId, result.taskId)] ?? goalTask?.rules;
          return {
            ...result,
            pointsDelta: rules === undefined
              ? result.pointsDelta
              : this.recalculateTaskPoints(result, goalTask?.streakCount ?? 0, rules),
          };
        });
        const netDelta = results.reduce((sum, result) => sum + result.pointsDelta, 0);
        return {
          ...goalPreview,
          netDelta,
          pointsBefore,
          pointsAfter: Math.max(0, pointsBefore + netDelta),
          results,
        };
      });
      for (const goalPreview of settlement.goals) {
        const goal = (state.goals ?? []).find(item => item.id === goalPreview.goalId && item.childId === childId);
        if (goal === undefined) continue;
        goal.points = goalPreview.pointsAfter;
        goal.highestPoints = Math.max(goal.highestPoints, goal.points);
        if (goal.points >= goal.threshold) goal.status = 'achieved';
        for (const result of goalPreview.results) {
          const goalTask = goal.tasks.find(task => task.taskId === result.taskId);
          if (goalTask === undefined || !goalTask.rules.streakEnabled || result.status === 'exempted') continue;
          goalTask.streakCount = result.status === 'completed' ? (goalTask.streakCount ?? 0) + 1 : 0;
        }
      }
    }
  }

  private settlementTaskRules(
    state: FamilyState,
    childId: ChildId,
    goals: SettlementGoalPreview[],
  ): Record<string, TaskRules> {
    const rules: Record<string, TaskRules> = {};
    for (const preview of goals) {
      const goal = (state.goals ?? []).find(item => item.id === preview.goalId && item.childId === childId);
      for (const result of preview.results) {
        const task = goal?.tasks.find(item => item.taskId === result.taskId);
        if (task !== undefined) rules[this.settlementTaskRuleKey(preview.goalId, result.taskId)] = { ...task.rules };
      }
    }
    return rules;
  }

  private settlementTaskRuleKey(goalId: string, taskId: string): string {
    return `${goalId}:${taskId}`;
  }

  private recalculateTaskPoints(
    result: SettlementTaskResult,
    streakCount: number,
    rules: TaskRules,
  ): number {
    if (result.status === 'exempted') return 0;
    if (result.status === 'missed') return rules.missedPolicy === 'deduct' ? -rules.deductionPoints : 0;
    const streakBonus = Math.min(rules.streakCap ?? Number.MAX_SAFE_INTEGER, streakCount);
    return rules.completionPoints + (rules.streakEnabled ? streakBonus : 0);
  }

  async inspect(token: string, request: { type: 'growth-activities' }): Promise<Result<ActivitySnapshot>>;
  async inspect(token: string, request: { type: 'settlement-history'; childId: ChildId; businessDate: string }): Promise<Result<SettlementHistory>>;
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
    if (request.type === 'goal-detail' || request.type === 'goal-list' || request.type === 'child-day' || request.type === 'settlement-preview' || request.type === 'settlement-history') {
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
    if (request.type === 'settlement-history') {
      if (session.role !== 'parent') {
        return { ok: false, error: { code: 'PERMISSION_DENIED', message: '这个操作需要家长来完成。' } };
      }
      if (!validBusinessDate(request.businessDate)) return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      return { ok: true, value: {
        childId: request.childId,
        businessDate: request.businessDate,
        settlements: (this.state.settlements ?? [])
          .filter(settlement => settlement.childId === request.childId && settlement.businessDate === request.businessDate)
          .sort((left, right) => left.revision - right.revision)
          .map(cloneSettlement),
        revision: this.state.revision,
      } };
    }
    if (request.type === 'child-day') {
      if (!validBusinessDate(request.businessDate)) return { ok: false, error: { code: 'VALIDATION_FAILED', field: 'businessDate', message: '请选择有效的业务日期。' } };
      const goals = (this.state.goals ?? []).filter(goal => goal.childId === request.childId);
      const weekday = new Date(`${request.businessDate}T00:00:00.000Z`).getUTCDay() || 7;
      const tasks: ScheduledTask[] = [];
      for (const goal of goals) {
        if (goal.status !== 'active' || goal.startDate > request.businessDate) continue;
        for (const task of goal.tasks) {
          const plan = task.plan ?? { kind: 'date-weekdays' as const, weekdays: task.weekdays };
          if (plan.kind === 'date-weekdays' && !plan.weekdays.includes(weekday)) continue;
          const existing = tasks.find(item => item.taskId === task.taskId);
          if (existing !== undefined) { existing.goalIds.push(goal.id); continue; }
          const source = (this.state.taskPool ?? []).find(item => item.id === task.taskId)!;
          const bounds = plan.kind === 'weekly-frequency'
            ? weekBounds(request.businessDate)
            : { start: request.businessDate, end: request.businessDate };
          const checkins = activeCheckinsForTask(this.state, request.childId, task.taskId, bounds.start, request.businessDate);
          tasks.push({
            taskId: task.taskId,
            name: source.name,
            description: source.description,
            goalIds: [goal.id],
            completedCount: checkins.length,
            checkinIds: checkins.map(checkin => checkin.id),
            ...(plan.kind === 'weekly-frequency' ? { requiredCount: plan.requiredCount } : {}),
          });
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
      return { ok: true, value: { goal: cloneGoal(goal), growth: this.buildGrowthSnapshot(goal), revision: this.state.revision } };
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

  private buildGrowthSnapshot(goal: Goal): GrowthSnapshot {
    return {
      activityId: goal.activityId,
      currentPoints: goal.points,
      highestPoints: goal.highestPoints,
      progressPercent: Math.min(100, Math.floor((goal.highestPoints / goal.threshold) * 100)),
    };
  }
}
