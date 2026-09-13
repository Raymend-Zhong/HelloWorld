import { builtInTemplates, TEMPLATE_SEED_VERSION, TaskRules, TaskStage, TaskTemplate } from './TaskTemplates.js';

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

export interface FamilyState {
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

export type DomainCommand =
  | { type: 'set-parent-password'; password: string }
  | { type: 'disable-task-pool-task'; childId: ChildId; taskId: string }
  | { type: 'edit-task-pool-task'; childId: ChildId; taskId: string; name: string; description: string; defaultRules: TaskRules }
  | { type: 'copy-task-template'; childId: ChildId; templateId: string }
  | { type: 'manage-task-pool' }
  | { type: 'manage-goal' }
  | { type: 'exempt-task' }
  | { type: 'confirm-settlement' };

export interface ExecuteReceipt {
  taskId?: string;
  revision: number;
}

export type InspectRequest =
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

export type InspectSnapshot = FamilyOverview | ChildHome | TemplateSnapshot | TaskPoolSnapshot;

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

function cloneState(state: FamilyState): FamilyState {
  return {
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
    if (stored !== null && (stored.schemaVersion < 1 || stored.schemaVersion > 2
      || (stored.templateSeedVersion ?? 0) > TEMPLATE_SEED_VERSION)) {
      throw new Error('家庭数据版本不兼容，请使用对应版本的应用。');
    }
    const state: FamilyState = stored === null ? {
      schemaVersion: 2,
      revision: 1,
      children: INITIAL_CHILDREN.map((child) => ({ ...child })),
      parentCredential: null,
    } : cloneState(stored);
    if (stored === null || state.schemaVersion === 1 || (state.templateSeedVersion ?? 0) < TEMPLATE_SEED_VERSION) {
      state.schemaVersion = 2;
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
    const result = this.pendingCommand.then(() => this.executeCommand(token, command));
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
      try {
        await this.persistence.save(nextState);
      } catch (_error) {
        return {
          ok: false,
          error: {
            code: 'PERSISTENCE_FAILED',
            message: '保存失败，请稍后重试。',
          },
        };
      }
      this.state = nextState;
      return { ok: true, value: { revision: nextState.revision } };
    }
    if (command.type === 'disable-task-pool-task') {
      const nextState = cloneState(this.state);
      const task = (nextState.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      task.disabled = true;
      nextState.revision += 1;
      return this.saveTaskState(nextState, task.id);
    }
    if (command.type === 'edit-task-pool-task') {
      if (command.name.trim().length === 0) return { ok: false, error: { code: 'VALIDATION_FAILED', message: '请输入任务名称。' } };
      const rules = command.defaultRules;
      if (!Number.isSafeInteger(rules.completionPoints) || rules.completionPoints <= 0
        || !Number.isSafeInteger(rules.deductionPoints) || rules.deductionPoints < 0
        || (rules.streakCap !== null && (!Number.isSafeInteger(rules.streakCap) || rules.streakCap < 0))) {
        return { ok: false, error: { code: 'VALIDATION_FAILED', message: '完成积分须为正整数，扣分值和连续奖励上限须为非负整数。' } };
      }
      if ((rules.missedPolicy !== 'no-points' && rules.missedPolicy !== 'deduct') || typeof rules.streakEnabled !== 'boolean') {
        return { ok: false, error: { code: 'VALIDATION_FAILED', message: '请选择有效的未完成处理和连续奖励设置。' } };
      }
      const nextState = cloneState(this.state);
      const task = (nextState.taskPool ?? []).find(item => item.id === command.taskId && item.childId === command.childId);
      if (task === undefined) return { ok: false, error: { code: 'TASK_NOT_FOUND', message: '没有找到这个任务池任务。' } };
      task.name = command.name.trim();
      task.description = command.description;
      task.defaultRules = { ...command.defaultRules };
      nextState.revision += 1;
      return this.saveTaskState(nextState, task.id);
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
      return this.saveTaskState(nextState, task.id);
    }
    return {
      ok: false,
      error: { code: 'COMMAND_UNSUPPORTED', message: '暂不支持此操作。' },
    };
  }

  private async saveTaskState(nextState: FamilyState, taskId: string): Promise<Result<ExecuteReceipt>> {
    try {
      await this.persistence.save(nextState);
    } catch (_) {
      return { ok: false, error: { code: 'PERSISTENCE_FAILED', message: '保存失败，请稍后重试。' } };
    }
    this.state = nextState;
    return { ok: true, value: { revision: nextState.revision, taskId } };
  }

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
