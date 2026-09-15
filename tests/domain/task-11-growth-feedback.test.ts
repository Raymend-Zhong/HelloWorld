import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务十一测试盐'; },
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
  return { module, parent, child, mathTaskId, readingTaskId };
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

test('[TASK-11-S01][AC-41] 虚拟成长按历史最高积分推进且扣分不倒退', async () => {
  const { module, parent, child, mathTaskId } = await family();
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '成长不倒退目标',
    description: '验证历史最高积分驱动成长',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{
      taskId: mathTaskId,
      weekdays: [1, 2, 3],
      rules: { completionPoints: 80, missedPolicy: 'deduct', deductionPoints: 15, streakEnabled: false, streakCap: null },
    }],
  })).goalId!;

  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: mathTaskId,
    businessDate: '2026-09-14',
  }));
  await settle(module, parent.token, '2026-09-14');
  await settle(module, parent.token, '2026-09-15');
  const detail = value(await module.inspect(parent.token, {
    type: 'goal-detail',
    childId: 'guoguo',
    goalId,
  }));
  assert.equal(detail.goal.points, 65);
  assert.equal(detail.goal.highestPoints, 80);
  assert.equal(detail.growth.activityId, 'cat');
  assert.equal(detail.growth.currentPoints, 65);
  assert.equal(detail.growth.highestPoints, 80);
  assert.equal(detail.growth.progressPercent, 80);
});

test('[TASK-11-S02][AC-42][AC-43][AC-44][AC-45] 清算生成逐项老师反馈且表现失败不影响文字结果', async () => {
  const { module, parent, child, mathTaskId, readingTaskId } = await family();
  const brushTaskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-brushing',
  })).taskId!;
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '混合反馈目标',
    description: '验证老师反馈顺序',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'tree',
    tasks: [
      { taskId: mathTaskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } },
      { taskId: readingTaskId, weekdays: [1], rules: { completionPoints: 6, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } },
      { taskId: brushTaskId, weekdays: [1], rules: { completionPoints: 1, missedPolicy: 'deduct', deductionPoints: 3, streakEnabled: false, streakCap: null } },
    ],
  })).goalId!;

  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId: mathTaskId, businessDate: '2026-09-14' }));
  value(await module.execute(child.token, { type: 'submit-checkin', childId: 'guoguo', taskId: readingTaskId, businessDate: '2026-09-14' }));
  const receipt = await settle(module, parent.token, '2026-09-14');

  const history = value(await module.inspect(parent.token, {
    type: 'settlement-history',
    childId: 'guoguo',
    businessDate: '2026-09-14',
  }));
  const settlement = history.settlements.find(item => item.id === receipt.settlementId);
  assert.ok(settlement);
  const feedback = settlement.goals.find(goal => goal.goalId === goalId)?.feedback;
  assert.deepEqual(feedback?.map(item => [item.kind, item.once, item.text]), [
    ['reward', false, '数学课外练习完成了，获得 5 分。'],
    ['reward', false, '语文阅读完成了，获得 6 分。'],
    ['encouragement', true, '果果保持得很稳，给小树一次鼓励。'],
    ['penalty', false, '刷牙没有完成，扣 3 分。'],
    ['discipline', true, '果果需要记住这次后果，小树接受一次提醒。'],
    ['summary', false, '本次净变化 8 分，累计 8 / 100 分。'],
    ['growth', false, '虚拟成长进度 8%，最高积分 8 分。'],
  ]);
  assert.equal(settlement.goals[0]?.pointsAfter, 8);
});

test('[TASK-11-S03][AC-54] 家长分别更换孩子主题和老师形象且孩子端随之使用', async () => {
  const { module, parent } = await family();

  value(await module.execute(parent.token, {
    type: 'update-child-profile',
    childId: 'guoguo',
    displayName: '果果',
    avatar: 'guoguo',
    theme: 'focus',
    teacher: 'calm',
  } as never));
  value(await module.execute(parent.token, {
    type: 'update-child-profile',
    childId: 'yangyang',
    displayName: '阳阳',
    avatar: 'yangyang',
    theme: 'playful',
    teacher: 'storybook',
  } as never));

  const guoguo = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  const yangyang = value(await module.openSession({ entry: 'child', childId: 'yangyang' }));
  const guoguoHome = value(await module.inspect(guoguo.token, { type: 'child-day', childId: 'guoguo', businessDate: '2026-09-14' }));
  const yangyangHome = value(await module.inspect(yangyang.token, { type: 'child-day', childId: 'yangyang', businessDate: '2026-09-14' }));

  assert.equal(guoguoHome.currentChild.theme, 'focus');
  assert.equal(guoguoHome.currentChild.teacher, 'calm');
  assert.equal(yangyangHome.currentChild.theme, 'playful');
  assert.equal(yangyangHome.currentChild.teacher, 'storybook');

  const childDenied = await module.execute(guoguo.token, {
    type: 'update-child-profile',
    childId: 'guoguo',
    displayName: '果果',
    avatar: 'guoguo',
    theme: 'playful',
    teacher: 'storybook',
  } as never);
  assert.equal(childDenied.ok, false);
  if (!childDenied.ok) assert.equal(childDenied.error.code, 'PERMISSION_DENIED');
});
