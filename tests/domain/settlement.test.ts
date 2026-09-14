import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '清算测试盐'; },
  async derive(password, salt) { return `${salt}:${password}`; },
  async verify(password, salt, digest) { return digest === `${salt}:${password}`; },
};

function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}

async function family(disk = new MemoryPersistenceAdapter()) {
  const module = await FamilyHabitModule.create(disk, hasher);
  const setup = value(await module.openSession({ entry: 'parent-setup' }));
  value(await module.execute(setup.token, { type: 'set-parent-password', password: '2468' }));
  const parent = value(await module.openSession({ entry: 'parent', password: '2468' }));
  const child = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  const mathTaskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-math',
  })).taskId!;
  const readingTaskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-reading',
  })).taskId!;
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '基础清算目标',
    description: '验证打卡和清算',
    threshold: 100,
    plannedDays: 30,
    reward: '周末活动',
    activityId: 'cat',
    tasks: [
      { taskId: mathTaskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } },
      { taskId: readingTaskId, weekdays: [1], rules: { completionPoints: 3, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: false, streakCap: null } },
    ],
  })).goalId!;
  return { module, parent, child, mathTaskId, readingTaskId, goalId, disk };
}

test('[TASK-6-S01][AC-13] 孩子和家长可以提交打卡且孩子可撤销未清算记录', async () => {
  const { module, parent, child, mathTaskId, readingTaskId } = await family();

  const childCheckin = value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  }));
  assert.match(childCheckin.checkinId!, /^checkin-/);

  const parentCheckin = value(await module.execute(parent.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: readingTaskId,
    businessDate: '2026-09-14',
  }));
  assert.match(parentCheckin.checkinId!, /^checkin-/);

  let day = value(await module.inspect(child.token, {
    type: 'child-day',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.deepEqual(day.tasks.map(task => [task.taskId, task.completedCount]), [
    [mathTaskId, 1],
    [readingTaskId, 1],
  ]);

  value(await module.execute(child.token, {
    type: 'revoke-checkin',
    childId: 'guoguo',
    checkinId: childCheckin.checkinId!,
  }));
  day = value(await module.inspect(child.token, {
    type: 'child-day',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.deepEqual(day.tasks.map(task => [task.taskId, task.completedCount]), [
    [mathTaskId, 0],
    [readingTaskId, 1],
  ]);
});

test('[TASK-6-S02][AC-15][AC-30] 清算审阅只把当天安排且未打卡任务列为未完成', async () => {
  const { module, parent, mathTaskId, readingTaskId, goalId } = await family();

  const sunday = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-13',
  }));
  assert.deepEqual(sunday.goals, []);

  const monday = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.equal(monday.childId, 'guoguo');
  assert.equal(monday.businessDate, '2026-09-14');
  assert.equal(monday.revision > 0, true);
  assert.deepEqual(monday.goals.map(goal => ({
    goalId: goal.goalId,
    results: goal.results.map(result => [result.taskId, result.status, result.pointsDelta]),
    netDelta: goal.netDelta,
    pointsAfter: goal.pointsAfter,
  })), [{
    goalId,
    results: [
      [mathTaskId, 'missed', 0],
      [readingTaskId, 'missed', -2],
    ],
    netDelta: -2,
    pointsAfter: 0,
  }]);
});

test('[TASK-6-S03][AC-16][AC-21] 按日期任务同日多条打卡在目标内最多产生一次完成积分', async () => {
  const { module, parent, child, mathTaskId, readingTaskId, goalId } = await family();
  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  }));
  value(await module.execute(parent.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  }));

  const preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.deepEqual(preview.goals.map(goal => ({
    goalId: goal.goalId,
    results: goal.results.map(result => [result.taskId, result.status, result.completedCount, result.pointsDelta]),
    netDelta: goal.netDelta,
    pointsAfter: goal.pointsAfter,
  })), [{
    goalId,
    results: [
      [mathTaskId, 'completed', 2, 5],
      [readingTaskId, 'missed', 0, -2],
    ],
    netDelta: 3,
    pointsAfter: 3,
  }]);
});

test('[TASK-6-S04][AC-26][AC-27][AC-29][AC-32] 家长确认清算后按目标合计奖扣并应用零分下限', async () => {
  const { module, parent, child, mathTaskId, readingTaskId, goalId } = await family();
  const secondGoalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '扣分下限目标',
    description: '验证目标积分不为负',
    threshold: 20,
    plannedDays: 30,
    reward: '看电影',
    activityId: 'tree',
    tasks: [{ taskId: readingTaskId, weekdays: [1], rules: { completionPoints: 1, missedPolicy: 'deduct', deductionPoints: 4, streakEnabled: false, streakCap: null } }],
  })).goalId!;

  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  }));

  const childConfirm = await module.execute(child.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: value(await module.inspect(parent.token, {
      type: 'settlement-preview',
      childId: 'guoguo',
      businessDate: '2026-09-14',
    })).revision,
  });
  assert.equal(childConfirm.ok, false);
  if (!childConfirm.ok) assert.equal(childConfirm.error.code, 'PERMISSION_DENIED');

  const confirmed = value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: value(await module.inspect(parent.token, {
      type: 'settlement-preview',
      childId: 'guoguo',
      businessDate: '2026-09-14',
    })).revision,
  }));
  assert.match(confirmed.settlementId!, /^settlement-/);

  const duplicatePreview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  const duplicate = await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: duplicatePreview.revision,
  });
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, 'DATE_ALREADY_SETTLED');

  const goals = value(await module.inspect(parent.token, {
    type: 'goal-list',
    childId: 'guoguo',
  })).goals;
  assert.deepEqual(goals.map(goal => [goal.id, goal.points, goal.highestPoints]), [
    [goalId, 3, 3],
    [secondGoalId, 0, 0],
  ]);
});

test('[TASK-6-S05][AC-13] 孩子不能撤销已清算日期的打卡记录', async () => {
  const { module, parent, child, mathTaskId } = await family();
  const checkinId = value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  })).checkinId!;
  const preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: preview.revision,
  }));

  const revoked = await module.execute(child.token, {
    type: 'revoke-checkin',
    childId: 'guoguo',
    checkinId,
  });
  assert.equal(revoked.ok, false);
  if (!revoked.ok) {
    assert.equal(revoked.error.code, 'DATE_ALREADY_SETTLED');
    assert.equal(revoked.error.message, '该日期已清算，请联系家长先撤销清算。');
  }
});

test('[TASK-6-S06][AC-32] 清算保存失败时所有目标积分保持不变', async () => {
  class FailingDisk extends MemoryPersistenceAdapter {
    fail = false;
    override async save(state: import('../../entry/src/main/ets/domain/FamilyHabitModule.js').FamilyState) {
      if (this.fail) throw new Error('模拟清算保存失败');
      await super.save(state);
    }
  }
  const disk = new FailingDisk();
  const { module, parent, child, mathTaskId } = await family(disk);
  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  }));
  const before = await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' });
  const preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  disk.fail = true;
  const failed = await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: preview.revision,
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, 'PERSISTENCE_FAILED');
  assert.deepEqual(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' }), before);

  disk.fail = false;
  value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: preview.revision,
  }));
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' })).goals[0]?.points, 3);
});
