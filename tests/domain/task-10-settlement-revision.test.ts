import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
  type SettlementHistory,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务十测试盐'; },
  async derive(password, salt) { return `${salt}:${password}`; },
  async verify(password, salt, digest) { return digest === `${salt}:${password}`; },
};

function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(`领域命令失败：${JSON.stringify(result.error)}`);
  return result.value;
}

async function family() {
  const module = await FamilyHabitModule.create(new MemoryPersistenceAdapter(), hasher);
  const setup = value(await module.openSession({ entry: 'parent-setup' }));
  value(await module.execute(setup.token, { type: 'set-parent-password', password: '2468' }));
  const parent = value(await module.openSession({ entry: 'parent', password: '2468' }));
  const child = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  const taskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-math',
  })).taskId!;
  return { module, parent, child, taskId };
}

async function settle(module: FamilyHabitModule, parentToken: string, businessDate: string) {
  const preview = value(await module.inspect(parentToken, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate,
  }));
  return value(await module.execute(parentToken, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate,
    expectedRevision: preview.revision,
  }));
}

async function settlementHistory(
  module: FamilyHabitModule,
  parentToken: string,
  businessDate: string,
): Promise<SettlementHistory> {
  return value(await module.inspect(parentToken, {
    type: 'settlement-history',
    childId: 'guoguo',
    businessDate,
  }));
}

test('[TASK-10-S01][AC-33] 家长撤销清算后才可修正并重新清算已清算日期', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '历史纠错目标',
    description: '验证撤销后修正',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: false, streakCap: null } }],
  })).goalId!;

  const checkinId = value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-14',
  })).checkinId!;
  await settle(module, parent.token, '2026-09-14');
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal.points, 5);

  const blocked = await module.execute(parent.token, {
    type: 'revoke-checkin',
    childId: 'guoguo',
    checkinId,
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.error.code, 'DATE_ALREADY_SETTLED');

  value(await module.execute(parent.token, {
    type: 'revoke-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  } as never));
  value(await module.execute(parent.token, {
    type: 'revoke-checkin',
    childId: 'guoguo',
    checkinId,
  }));
  await settle(module, parent.token, '2026-09-14');

  assert.equal(value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal.points, 0);
});

test('[TASK-10-S02][AC-34] 家长可查看清算修订历史且孩子只看到当前有效结果', async () => {
  const { module, parent, child, taskId } = await family();
  value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '修订历史目标',
    description: '验证历史版本',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: false, streakCap: null } }],
  }));

  const checkinId = value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-14',
  })).checkinId!;
  const first = await settle(module, parent.token, '2026-09-14');
  value(await module.execute(parent.token, { type: 'revoke-settlement', childId: 'guoguo', businessDate: '2026-09-14' } as never));
  value(await module.execute(parent.token, { type: 'revoke-checkin', childId: 'guoguo', checkinId }));
  const second = await settle(module, parent.token, '2026-09-14');

  const childHistory = await module.inspect(child.token, {
    type: 'settlement-history',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  } as never);
  assert.equal(childHistory.ok, false);
  if (!childHistory.ok) assert.equal(childHistory.error.code, 'PERMISSION_DENIED');

  const history = await settlementHistory(module, parent.token, '2026-09-14');
  assert.deepEqual(history.settlements.map((item: { id: string; active: boolean; goals: unknown[] }) => [
    item.id,
    item.active,
    item.goals.length,
  ]), [
    [first.settlementId, false, 1],
    [second.settlementId, true, 1],
  ]);
});

test('[TASK-10-S03][AC-35] 撤销较早日期会按业务日期重算后续积分和连续记录', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '连续重算目标',
    description: '验证后续清算重算',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2, 3], rules: { completionPoints: 10, missedPolicy: 'deduct', deductionPoints: 3, streakEnabled: true, streakCap: null } }],
  })).goalId!;

  const mondayCheckin = value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' })).checkinId!;
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-15' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-16' }));
  await settle(module, parent.token, '2026-09-14');
  await settle(module, parent.token, '2026-09-15');
  await settle(module, parent.token, '2026-09-16');
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal.points, 33);

  value(await module.execute(parent.token, { type: 'revoke-settlement', childId: 'guoguo', businessDate: '2026-09-14' } as never));
  value(await module.execute(parent.token, { type: 'revoke-checkin', childId: 'guoguo', checkinId: mondayCheckin }));
  await settle(module, parent.token, '2026-09-14');

  const goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal;
  assert.equal(goal.points, 21);

  const history = await settlementHistory(module, parent.token, '2026-09-15');
  assert.equal(history.settlements[0]?.goals[0]?.pointsBefore, 0);
  assert.equal(history.settlements[0]?.goals[0]?.pointsAfter, 10);
});

test('[TASK-10-S04][AC-36] 重算使已达成目标低于门槛时恢复为进行中', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '恢复目标',
    description: '验证达成后恢复',
    threshold: 10,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2], rules: { completionPoints: 10, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }],
  })).goalId!;

  const checkinId = value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-14',
  })).checkinId!;
  await settle(module, parent.token, '2026-09-14');
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal.status, 'achieved');

  value(await module.execute(parent.token, { type: 'revoke-settlement', childId: 'guoguo', businessDate: '2026-09-14' } as never));
  value(await module.execute(parent.token, { type: 'revoke-checkin', childId: 'guoguo', checkinId }));
  await settle(module, parent.token, '2026-09-14');

  const goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal;
  assert.equal(goal.points, 0);
  assert.equal(goal.status, 'active');
  assert.deepEqual(value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-15',
  })).goals.map(item => item.goalId), [goalId]);
});

test('[TASK-10-S05][AC-37] 补录并清算过去日期后连续奖励按业务日期重算', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '过去日期目标',
    description: '验证补录日期顺序',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2], rules: { completionPoints: 10, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: true, streakCap: null } }],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-15' }));
  await settle(module, parent.token, '2026-09-15');

  value(await module.execute(parent.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  await settle(module, parent.token, '2026-09-14');

  const goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal;
  assert.equal(goal.points, 21);
  assert.equal(goal.tasks[0]?.streakCount, 2);

  const laterHistory = await settlementHistory(module, parent.token, '2026-09-15');
  assert.equal(laterHistory.settlements[0]?.goals[0]?.pointsBefore, 10);
  assert.equal(laterHistory.settlements[0]?.goals[0]?.pointsAfter, 21);
});
