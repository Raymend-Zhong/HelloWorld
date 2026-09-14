import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务七测试盐'; },
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

async function settle(
  module: FamilyHabitModule,
  parentToken: string,
  childId: 'guoguo',
  businessDate: string,
) {
  const preview = value(await module.inspect(parentToken, {
    type: 'settlement-preview',
    childId,
    businessDate,
  }));
  return value(await module.execute(parentToken, {
    type: 'confirm-settlement',
    childId,
    businessDate,
    expectedRevision: preview.revision,
  }));
}

test('[TASK-7-S01][AC-14][AC-25] 一条打卡记录按多个目标各自规则解释且连续记录互不共享', async () => {
  const { module, parent, child, taskId } = await family();
  const first = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '数学基础',
    description: '基础目标',
    threshold: 100,
    plannedDays: 30,
    reward: '基础奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: true, streakCap: null } }],
  })).goalId!;
  const second = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '数学冲刺',
    description: '冲刺目标',
    threshold: 100,
    plannedDays: 30,
    reward: '冲刺奖励',
    activityId: 'tree',
    tasks: [{ taskId, weekdays: [1, 3], rules: { completionPoints: 8, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: true, streakCap: null } }],
  })).goalId!;

  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-14',
  }));

  const preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.deepEqual(preview.goals.map(goal => [goal.goalId, goal.results[0]?.pointsDelta, goal.netDelta, goal.pointsAfter]), [
    [first, 5, 5, 5],
    [second, 8, 8, 8],
  ]);

  value(await module.execute(parent.token, {
    type: 'edit-goal',
    childId: 'guoguo',
    goalId: second,
    businessDate: '2026-09-14',
    name: '数学冲刺',
    description: '冲刺目标',
    threshold: 100,
    plannedDays: 30,
    reward: '冲刺奖励',
    activityId: 'tree',
    tasks: [{ taskId, weekdays: [1, 3], rules: { completionPoints: 8, missedPolicy: 'deduct', deductionPoints: 4, streakEnabled: true, streakCap: null } }],
  }));
  await settle(module, parent.token, 'guoguo', '2026-09-14');

  await settle(module, parent.token, 'guoguo', '2026-09-16');
  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-28',
  }));
  const thirdMonday = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-28',
  }));
  assert.deepEqual(thirdMonday.goals.map(goal => [goal.goalId, goal.results[0]?.pointsDelta]), [
    [first, 6],
    [second, 8],
  ]);
});

test('[TASK-7-S02][AC-22][AC-23][AC-24] 连续奖励递增、受上限限制并在未完成后重新起算', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '连续数学',
    description: '验证连续奖励',
    threshold: 100,
    plannedDays: 30,
    reward: '连续奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2, 3, 4, 5], rules: { completionPoints: 10, missedPolicy: 'deduct', deductionPoints: 3, streakEnabled: true, streakCap: 1 } }],
  })).goalId!;

  for (const businessDate of ['2026-09-14', '2026-09-15', '2026-09-16']) {
    value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate }));
    await settle(module, parent.token, 'guoguo', businessDate);
  }
  let goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal;
  assert.equal(goal.points, 32);

  await settle(module, parent.token, 'guoguo', '2026-09-17');
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-18' }));
  const afterMiss = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-18',
  }));
  assert.deepEqual(afterMiss.goals, [{
    goalId,
    results: [{ taskId, status: 'completed', completedCount: 1, pointsDelta: 10 }],
    netDelta: 10,
    pointsBefore: 29,
    pointsAfter: 39,
  }]);
});

test('[TASK-7-S03][AC-28][AC-38][AC-39][AC-40] 目标超额达成、到期继续并可终止进入只读历史', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '短期数学',
    description: '验证目标生命周期',
    threshold: 100,
    plannedDays: 1,
    reward: '短期奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2], rules: { completionPoints: 95, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  await settle(module, parent.token, 'guoguo', '2026-09-14');
  let goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal;
  assert.equal(goal.status, 'active');
  assert.equal(goal.points, 95);

  value(await module.execute(parent.token, {
    type: 'edit-goal',
    childId: 'guoguo',
    goalId,
    businessDate: '2026-09-15',
    name: '短期数学',
    description: '验证目标生命周期',
    threshold: 100,
    plannedDays: 1,
    reward: '短期奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2], rules: { completionPoints: 10, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }],
  }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-15' }));
  await settle(module, parent.token, 'guoguo', '2026-09-15');
  goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal;
  assert.equal(goal.points, 105);
  assert.equal(goal.highestPoints, 105);
  assert.equal(goal.status, 'achieved');

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-21' }));
  assert.deepEqual(value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-21',
  })).goals, []);

  const endedEdit = await module.execute(parent.token, {
    type: 'edit-goal',
    childId: 'guoguo',
    goalId,
    businessDate: '2026-09-21',
    name: '不能编辑已达成目标',
    description: '只读历史',
    threshold: 120,
    plannedDays: 1,
    reward: '不可修改',
    activityId: 'tree',
    tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 1, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }],
  });
  assert.equal(endedEdit.ok, false);
  if (!endedEdit.ok) assert.equal(endedEdit.error.code, 'GOAL_ENDED');

  const terminatedId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-21',
    name: '可终止目标',
    description: '验证提前终止',
    threshold: 50,
    plannedDays: 30,
    reward: '终止奖励',
    activityId: 'tree',
    tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }],
  })).goalId!;
  value(await module.execute(parent.token, {
    type: 'terminate-goal',
    childId: 'guoguo',
    goalId: terminatedId,
  }));
  const goals = value(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' })).goals;
  assert.deepEqual(goals.map(item => [item.id, item.status]), [
    [goalId, 'achieved'],
    [terminatedId, 'terminated'],
  ]);
});
