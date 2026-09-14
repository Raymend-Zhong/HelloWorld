import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务九测试盐'; },
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
  businessDate: string,
) {
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

test('[TASK-9-S01][AC-20] 日期任务豁免不奖扣且不推进或中断连续记录', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '连续数学',
    description: '验证日期豁免',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2, 3], rules: { completionPoints: 10, missedPolicy: 'deduct', deductionPoints: 4, streakEnabled: true, streakCap: null } }],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  await settle(module, parent.token, '2026-09-14');

  value(await module.execute(parent.token, {
    type: 'exempt-date-task',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-15',
  } as never));
  const exemptPreview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-15',
  }));
  assert.deepEqual(exemptPreview.goals, [{
    goalId,
    results: [{ taskId, status: 'exempted', completedCount: 0, pointsDelta: 0 }],
    netDelta: 0,
    pointsBefore: 10,
    pointsAfter: 10,
  }]);
  await settle(module, parent.token, '2026-09-15');

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-16' }));
  const nextPreview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-16',
  }));
  assert.equal(nextPreview.goals[0]?.results[0]?.pointsDelta, 11);
});

test('[TASK-9-S02][AC-20] 周期任务豁免覆盖整个自然周且不改变连续周期', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '每周练习',
    description: '验证周期豁免',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'tree',
    tasks: [{
      taskId,
      plan: { kind: 'weekly-frequency', requiredCount: 2 },
      rules: { completionPoints: 8, missedPolicy: 'deduct', deductionPoints: 3, streakEnabled: true, streakCap: null },
    }],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-15' }));
  await settle(module, parent.token, '2026-09-15');

  value(await module.execute(parent.token, {
    type: 'exempt-weekly-task',
    childId: 'guoguo',
    taskId,
    weekOf: '2026-09-21',
  } as never));
  const exemptPreview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-27',
  }));
  assert.deepEqual(exemptPreview.goals, [{
    goalId,
    results: [{ taskId, status: 'exempted', completedCount: 0, pointsDelta: 0 }],
    netDelta: 0,
    pointsBefore: 8,
    pointsAfter: 8,
  }]);
  await settle(module, parent.token, '2026-09-27');

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-28' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-29' }));
  const nextPreview = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-29',
  }));
  assert.equal(nextPreview.goals[0]?.results[0]?.pointsDelta, 9);
});

test('[TASK-9-S03][AC-31] 打卡、豁免或规则变化后旧清算审阅不能确认', async () => {
  const { module, parent, child, taskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '过期审阅目标',
    description: '验证修订保护',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2, 3], rules: { completionPoints: 5, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: false, streakCap: null } }],
  })).goalId!;

  const staleByCheckin = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId, businessDate: '2026-09-14' }));
  let stale = await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    expectedRevision: staleByCheckin.revision,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) {
    assert.equal(stale.error.code, 'SETTLEMENT_PREVIEW_EXPIRED');
    assert.equal(stale.error.message, '清算审阅已过期，请重新审阅。');
  }

  const staleByExemption = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-15',
  }));
  value(await module.execute(parent.token, {
    type: 'exempt-date-task',
    childId: 'guoguo',
    taskId,
    businessDate: '2026-09-15',
  } as never));
  stale = await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-15',
    expectedRevision: staleByExemption.revision,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, 'SETTLEMENT_PREVIEW_EXPIRED');

  const staleByRule = value(await module.inspect(parent.token, {
    type: 'settlement-preview',
    childId: 'guoguo',
    businessDate: '2026-09-16',
  }));
  value(await module.execute(parent.token, {
    type: 'edit-goal',
    childId: 'guoguo',
    goalId,
    businessDate: '2026-09-16',
    name: '过期审阅目标',
    description: '验证修订保护',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 2, 3], rules: { completionPoints: 6, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: false, streakCap: null } }],
  }));
  stale = await module.execute(parent.token, {
    type: 'confirm-settlement',
    childId: 'guoguo',
    businessDate: '2026-09-16',
    expectedRevision: staleByRule.revision,
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.error.code, 'SETTLEMENT_PREVIEW_EXPIRED');
});
