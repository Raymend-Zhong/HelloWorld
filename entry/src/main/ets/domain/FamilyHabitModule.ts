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

export interface FamilyState {
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
  | { type: 'manage-task-pool' }
  | { type: 'manage-goal' }
  | { type: 'exempt-task' }
  | { type: 'confirm-settlement' };

export interface ExecuteReceipt {
  revision: number;
}

export type InspectRequest =
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
  tasks: unknown[];
  goals: unknown[];
  revision: number;
}

export type InspectSnapshot = FamilyOverview | ChildHome;

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

function cloneState(state: FamilyState): FamilyState {
  return {
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
    const state: FamilyState = stored ?? {
      schemaVersion: 1,
      revision: 1,
      children: INITIAL_CHILDREN.map((child) => ({ ...child })),
      parentCredential: null,
    };
    if (stored === null) await persistence.save(state);
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

  async execute(
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
      session.role === 'child'
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
      await this.persistence.save(nextState);
      this.state = nextState;
      return { ok: true, value: { revision: nextState.revision } };
    }
    return {
      ok: false,
      error: { code: 'COMMAND_UNSUPPORTED', message: '暂不支持此操作。' },
    };
  }

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
          tasks: [],
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
