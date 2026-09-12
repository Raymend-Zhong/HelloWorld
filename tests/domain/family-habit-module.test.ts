import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const passwordHasher: PasswordHasher = {
  async createSalt(): Promise<string> {
    return 'test-salt';
  },
  async derive(password: string, salt: string): Promise<string> {
    return `${salt}:${[...password].reverse().join('')}`;
  },
  async verify(password: string, salt: string, digest: string): Promise<boolean> {
    return digest === `${salt}:${[...password].reverse().join('')}`;
  },
};

test('[TASK-3][AC-01] 首次初始化只存在两个固定孩子账套', async () => {
  const persistence = new MemoryPersistenceAdapter();
  const module = await FamilyHabitModule.create(persistence, passwordHasher);

  const setupSession = await module.openSession({ entry: 'parent-setup' });
  assert.equal(setupSession.ok, true);
  if (!setupSession.ok) return;

  const overview = await module.inspect(setupSession.value.token, {
    type: 'family-overview',
  });

  assert.equal(overview.ok, true);
  if (!overview.ok) return;
  assert.deepEqual(
    overview.value.children.map((child) => child.id),
    ['guoguo', 'yangyang'],
  );
  assert.equal(overview.value.canAddChild, false);
  assert.equal(overview.value.canDeleteChild, false);
});

test('[TASK-3][AC-04] 家长设置密码后只有正确密码可以进入家长端', async () => {
  const persistence = new MemoryPersistenceAdapter();
  const module = await FamilyHabitModule.create(persistence, passwordHasher);
  const setup = await module.openSession({ entry: 'parent-setup' });
  assert.equal(setup.ok, true);
  if (!setup.ok) return;

  const passwordSet = await module.execute(setup.value.token, {
    type: 'set-parent-password',
    password: '2468',
  });
  assert.equal(passwordSet.ok, true);

  const stored = await persistence.load();
  assert.notEqual(stored?.parentCredential, null);
  assert.equal(JSON.stringify(stored).includes('2468'), false);

  const wrongPassword = await module.openSession({
    entry: 'parent',
    password: '0000',
  });
  assert.equal(wrongPassword.ok, false);
  if (!wrongPassword.ok) {
    assert.equal(wrongPassword.error.code, 'PARENT_PASSWORD_INCORRECT');
    assert.equal(wrongPassword.error.message, '家长密码错误。');
  }

  const parent = await module.openSession({
    entry: 'parent',
    password: '2468',
  });
  assert.equal(parent.ok, true);
  if (parent.ok) assert.equal(parent.value.role, 'parent');
});

test('[TASK-3][AC-02][AC-03] 孩子免密码进入并切换到清楚标识的孩子账套', async () => {
  const module = await FamilyHabitModule.create(
    new MemoryPersistenceAdapter(),
    passwordHasher,
  );

  const guoguoSession = await module.openSession({
    entry: 'child',
    childId: 'guoguo',
  });
  assert.equal(guoguoSession.ok, true);
  if (!guoguoSession.ok) return;

  const guoguoHome = await module.inspect(guoguoSession.value.token, {
    type: 'child-home',
  });
  assert.equal(guoguoHome.ok, true);
  if (!guoguoHome.ok) return;
  const guoguoView = guoguoHome.value;
  assert.deepEqual(guoguoView.currentChild, {
    id: 'guoguo',
    displayName: '果果',
    avatar: 'guoguo',
    theme: 'mature',
  });
  assert.deepEqual(guoguoView.tasks, []);
  assert.deepEqual(guoguoView.goals, []);

  const yangyangSession = await module.openSession({
    entry: 'child',
    childId: 'yangyang',
  });
  assert.equal(yangyangSession.ok, true);
  if (!yangyangSession.ok) return;

  const yangyangHome = await module.inspect(yangyangSession.value.token, {
    type: 'child-home',
  });
  assert.equal(yangyangHome.ok, true);
  if (!yangyangHome.ok) return;
  const yangyangView = yangyangHome.value;
  assert.equal(yangyangView.currentChild.id, 'yangyang');
  assert.equal(yangyangView.currentChild.displayName, '阳阳');
  assert.equal(yangyangView.currentChild.theme, 'playful');
});

test('[TASK-3][AC-05] 孩子执行家长命令会被拒绝且领域状态不变', async () => {
  const module = await FamilyHabitModule.create(
    new MemoryPersistenceAdapter(),
    passwordHasher,
  );
  const child = await module.openSession({ entry: 'child', childId: 'guoguo' });
  assert.equal(child.ok, true);
  if (!child.ok) return;

  const before = await module.inspect(child.value.token, { type: 'family-overview' });
  assert.equal(before.ok, true);
  if (!before.ok) return;

  const privilegedCommands = [
    { type: 'manage-task-pool' },
    { type: 'manage-goal' },
    { type: 'exempt-task' },
    { type: 'confirm-settlement' },
  ] as const;
  for (const command of privilegedCommands) {
    const result = await module.execute(child.value.token, command);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'PERMISSION_DENIED');
      assert.equal(result.error.message, '这个操作需要家长来完成。');
    }
  }

  const after = await module.inspect(child.value.token, { type: 'family-overview' });
  assert.deepEqual(after, before);
});
