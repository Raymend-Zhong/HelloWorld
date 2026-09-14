import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务八测试盐'; },
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

test('[TASK-8-S01][AC-17] 每周三次频率任务允许同一天三次打卡并在第三条所属日期达标', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '每周爬山',
    description: '自然周内完成三次即可',
    threshold: 100,
    plannedDays: 30,
    reward: '周末露营',
    activityId: 'tree',
    tasks: [{
      taskId,
      plan: { kind: 'weekly-frequency', requiredCount: 3 },
      rules: {
        completionPoints: 9,
        missedPolicy: 'no-points',
        deductionPoints: 0,
        streakEnabled: true,
        streakCap: null,
      },
    }],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));

  const day = value(await module.inspect(child.token, {
    type: 'child-day',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.deepEqual(day.tasks.map(task => [task.taskId, task.completedCount, task.requiredCount]), [
    [taskId, 3, 3],
  ]);

  const preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  assert.deepEqual(preview.goals, [{
    goalId,
    results: [{ taskId, planKind: 'weekly-frequency', status: 'completed', completedCount: 3, pointsDelta: 9 }],
    netDelta: 9,
    pointsBefore: 0,
    pointsAfter: 9,
  }]);
});

test('[TASK-8-S02][AC-18] 频率任务达标前不计分且达标后本周期超额记录不重复计分', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '每周运动',
    description: '自然周两次达标',
    threshold: 100,
    plannedDays: 30,
    reward: '买运动贴纸',
    activityId: 'cat',
    tasks: [{
      taskId,
      plan: { kind: 'weekly-frequency', requiredCount: 2 },
      rules: {
        completionPoints: 6,
        missedPolicy: 'no-points',
        deductionPoints: 0,
        streakEnabled: false,
        streakCap: null,
      },
    }],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  assert.deepEqual(value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  })).goals, []);

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-16' }));
  const achieved = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-16',
  }));
  assert.deepEqual(achieved.goals, [{
    goalId,
    results: [{ taskId, planKind: 'weekly-frequency', status: 'completed', completedCount: 2, pointsDelta: 6 }],
    netDelta: 6,
    pointsBefore: 0,
    pointsAfter: 6,
  }]);
  value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-16',
    expectedRevision: achieved.revision,
  }));

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-18' }));
  assert.deepEqual(value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-18',
  })).goals, []);
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId })).goal.points, 6);
});

test('[TASK-8-S03][AC-19] 频率任务到周日仍未达标时产生一次未完成结果并中断连续周期', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '每周阅读',
    description: '自然周内两次达标',
    threshold: 100,
    plannedDays: 30,
    reward: '买书',
    activityId: 'tree',
    tasks: [{
      taskId,
      plan: { kind: 'weekly-frequency', requiredCount: 2 },
      rules: {
        completionPoints: 5,
        missedPolicy: 'deduct',
        deductionPoints: 2,
        streakEnabled: true,
        streakCap: null,
      },
    }],
  })).goalId!;

  for (const businessDate of ['2026-09-14', '2026-09-15']) {
    value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate }));
  }
  let preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-15',
  }));
  assert.equal(preview.goals[0]?.results[0]?.pointsDelta, 5);
  value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-15',
    expectedRevision: preview.revision,
  }));

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-21' }));
  preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-27',
  }));
  assert.deepEqual(preview.goals, [{
    goalId,
    results: [{ taskId, planKind: 'weekly-frequency', status: 'missed', completedCount: 1, pointsDelta: -2 }],
    netDelta: -2,
    pointsBefore: 5,
    pointsAfter: 3,
  }]);
  value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-27',
    expectedRevision: preview.revision,
  }));

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-28' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-29' }));
  preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-29',
  }));
  assert.equal(preview.goals[0]?.results[0]?.pointsDelta, 5);
});

test('[TASK-8-S04][AC-18] 已计入频率周期清算的早期打卡不能被孩子撤销', async () => {
  const { module, parent, child, taskId } = await family();
  value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '每周练习',
    description: '两次达标',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{
      taskId,
      plan: { kind: 'weekly-frequency', requiredCount: 2 },
      rules: {
        completionPoints: 6,
        missedPolicy: 'no-points',
        deductionPoints: 0,
        streakEnabled: false,
        streakCap: null,
      },
    }],
  }));
  const monday = value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' })).checkinId!;
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-16' }));
  const preview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-16',
  }));
  value(await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-16',
    expectedRevision: preview.revision,
  }));

  const revoked = await module.execute(child.token, {
    type: 'revoke-checkin',
    childId: 'guoguo',
    checkinId: monday,
  });
  assert.equal(revoked.ok, false);
  if (!revoked.ok) assert.equal(revoked.error.code, 'DATE_ALREADY_SETTLED');
});
