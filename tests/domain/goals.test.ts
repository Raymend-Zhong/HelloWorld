import assert from 'node:assert/strict';
import test from 'node:test';
import { FamilyHabitModule, MemoryPersistenceAdapter, type PasswordHasher, type Result } from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '目标测试盐'; },
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
  const taskId = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' })).taskId!;
  return { module, parent, taskId, disk };
}
function draft(taskId: string) {
  return { childId: 'guoguo' as const, businessDate: '2026-09-14', name: '一起养小猫', description: '坚持数学练习',
    threshold: 100, plannedDays: 30, reward: '周末去动物园', activityId: 'cat',
    tasks: [{ taskId, weekdays: [1, 3, 5] }] };
}

test('[TASK-5-S01][AC-10][AC-12] 有效目标立即进行中且详情保存目标信息和初始化规则', async () => {
  const { module, parent, taskId } = await family();
  const created = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) }));
  const detail = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId: created.goalId! }));
  assert.equal(detail.goal.name, '一起养小猫');
  assert.equal(detail.goal.description, '坚持数学练习');
  assert.equal(detail.goal.startDate, '2026-09-14');
  assert.equal(detail.goal.threshold, 100);
  assert.equal(detail.goal.plannedDays, 30);
  assert.equal(detail.goal.reward, '周末去动物园');
  assert.equal(detail.goal.activityId, 'cat');
  assert.equal(detail.goal.status, 'active');
  assert.equal(detail.goal.points, 0);
  assert.equal(detail.goal.highestPoints, 0);
  assert.deepEqual(detail.goal.tasks[0]?.rules, { completionPoints: 1, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null });
  assert.deepEqual(detail.goal.tasks[0]?.weekdays, [1, 3, 5]);
  assert.equal(detail.goal.tasks[0]?.taskId, taskId);
});

test('[TASK-5-S02][AC-09] 无效目标返回对应字段中文错误且不改变修订', async () => {
  const { module, parent, taskId } = await family();
  const otherTask = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'yangyang', templateId: 'kindergarten-english' })).taskId!;
  const before = await module.inspect(parent.token, { type: 'family-overview' });
  const valid = draft(taskId);
  const invalid = [
    { input: { ...valid, tasks: [] }, field: 'tasks' },
    { input: { ...valid, activityId: '' }, field: 'activityId' },
    { input: { ...valid, activityId: 'unknown' }, field: 'activityId' },
    { input: { ...valid, name: ' ' }, field: 'name' },
    { input: { ...valid, threshold: 0 }, field: 'threshold' },
    { input: { ...valid, threshold: 1.5 }, field: 'threshold' },
    { input: { ...valid, plannedDays: 0 }, field: 'plannedDays' },
    { input: { ...valid, reward: ' ' }, field: 'reward' },
    { input: { ...valid, businessDate: '2026-02-30' }, field: 'businessDate' },
    { input: { ...valid, tasks: [{ taskId: otherTask, weekdays: [1] }] }, field: 'tasks' },
    { input: { ...valid, tasks: [{ taskId: 'missing', weekdays: [1] }] }, field: 'tasks' },
    { input: { ...valid, tasks: [{ taskId, weekdays: [] }] }, field: 'tasks.0.weekdays' },
    { input: { ...valid, tasks: [{ taskId, weekdays: [0, 8] }] }, field: 'tasks.0.weekdays' },
    { input: { ...valid, tasks: [{ taskId, weekdays: [1, 1] }] }, field: 'tasks.0.weekdays' },
    { input: { ...valid, tasks: [valid.tasks[0]!, valid.tasks[0]!] }, field: 'tasks' },
    { input: { ...valid, tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 0, missedPolicy: 'deduct' as const, deductionPoints: 2, streakEnabled: true, streakCap: null } }] }, field: 'tasks.0.rules' },
  ];
  for (const item of invalid) {
    const result = await module.execute(parent.token, { type: 'create-goal', ...item.input });
    assert.equal(result.ok, false, item.field);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_FAILED');
      assert.equal(result.error.field, item.field);
      assert.match(result.error.message, /[\u4e00-\u9fff]/);
    }
    assert.deepEqual(await module.inspect(parent.token, { type: 'family-overview' }), before);
  }
});

test('[TASK-5-S03][AC-11] 两个目标独立零分与配置且孩子只能查看所属账套', async () => {
  const { module, parent, taskId } = await family();
  const first = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) }));
  const second = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId), name: '种小树', activityId: 'tree', threshold: 50 }));
  assert.notEqual(first.goalId, second.goalId);
  const list = value(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' }));
  assert.deepEqual(list.goals.map(goal => [goal.name, goal.points, goal.threshold]), [['一起养小猫', 0, 100], ['种小树', 0, 50]]);
  assert.deepEqual(value(await module.inspect(parent.token, { type: 'goal-list', childId: 'yangyang' })).goals, []);
  const child = value(await module.openSession({ entry: 'child', childId: 'yangyang' }));
  const denied = await module.inspect(child.token, { type: 'goal-detail', childId: 'guoguo', goalId: first.goalId! });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.error.code, 'PERMISSION_DENIED');
  const deniedList = await module.inspect(child.token, { type: 'goal-list', childId: 'guoguo' });
  assert.equal(deniedList.ok, false);
  const deniedCreate = await module.execute(child.token, { type: 'create-goal', ...draft(taskId) });
  assert.equal(deniedCreate.ok, false);
  if (!deniedCreate.ok) assert.equal(deniedCreate.error.code, 'PERMISSION_DENIED');
  list.goals[0]!.tasks[0]!.rules.completionPoints = 99;
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId: first.goalId! })).goal.tasks[0]?.rules.completionPoints, 1);
});

test('[TASK-5-S04][AC-10] 日期视图只提供开始日起安排的任务且同一任务显示一次并列出关联目标', async () => {
  const { module, parent, taskId } = await family();
  const first = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) }));
  const second = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId), tasks: [{ taskId, weekdays: [1, 7] }] }));
  const day = (businessDate: string) => module.inspect(parent.token, { type: 'child-day', childId: 'guoguo', businessDate });
  const monday = value(await day('2026-09-14'));
  assert.deepEqual(monday.tasks.map(task => [task.taskId, task.name, task.goalIds]), [[taskId, '数学课外练习', [first.goalId, second.goalId]]]);
  assert.deepEqual(value(await day('2026-09-13')).tasks, []);
  assert.deepEqual(value(await day('2026-09-15')).tasks, []);
  assert.deepEqual(value(await day('2026-09-20')).tasks[0]?.goalIds, [second.goalId]);
  assert.equal(value(await day('2026-11-02')).tasks.length, 1);
  const invalid = await day('2026-02-30');
  assert.equal(invalid.ok, false);
  const child = value(await module.openSession({ entry: 'child', childId: 'yangyang' }));
  assert.equal((await module.inspect(child.token, { type: 'child-day', childId: 'guoguo', businessDate: '2026-09-14' })).ok, false);
});

test('[TASK-5-S05][AC-12][AC-11] 默认配置变化不影响已有目标且编辑只改变指定目标的规则与计划', async () => {
  const { module, parent, taskId } = await family();
  const first = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) })).goalId!;
  const second = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) })).goalId!;
  const rules = { completionPoints: 8, missedPolicy: 'deduct' as const, deductionPoints: 2, streakEnabled: true, streakCap: 3 };
  value(await module.execute(parent.token, { type: 'edit-task-pool-task', childId: 'guoguo', taskId, name: '新数学名称', description: '', defaultRules: rules }));
  const detail = (goalId: string) => module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId });
  assert.equal(value(await detail(first)).goal.tasks[0]?.rules.completionPoints, 1);
  value(await module.execute(parent.token, { type: 'edit-goal', ...draft(taskId), businessDate: '2026-09-15', goalId: first, name: '新的目标说明', threshold: 120, tasks: [{ taskId, weekdays: [2, 4], rules }] }));
  const edited = value(await detail(first)).goal;
  assert.equal(edited.name, '新的目标说明');
  assert.equal(edited.startDate, '2026-09-14');
  assert.deepEqual(edited.tasks[0]?.rules, rules);
  assert.deepEqual(edited.tasks[0]?.weekdays, [2, 4]);
  assert.equal(value(await detail(second)).goal.tasks[0]?.rules.completionPoints, 1);
  assert.equal(value(await detail(second)).goal.threshold, 100);
  const third = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) })).goalId!;
  assert.equal(value(await detail(third)).goal.tasks[0]?.rules.completionPoints, 8);
  const before = await detail(first);
  const child = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  assert.equal((await module.execute(child.token, { type: 'edit-goal', ...draft(taskId), goalId: first })).ok, false);
  assert.equal((await module.execute(parent.token, { type: 'edit-goal', ...draft(taskId), childId: 'yangyang', goalId: first })).ok, false);
  assert.deepEqual(await detail(first), before);
});

test('[TASK-5-S06][AC-08] 停用任务保留已有目标引用与日期要求但不能加入新目标或另一已有目标', async () => {
  const { module, parent, taskId } = await family();
  const first = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) })).goalId!;
  const secondTask = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' })).taskId!;
  const second = value(await module.execute(parent.token, { type: 'create-goal', ...draft(secondTask) })).goalId!;
  value(await module.execute(parent.token, { type: 'disable-task-pool-task', childId: 'guoguo', taskId }));
  const failed = await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.field, 'tasks');
  assert.equal((await module.execute(parent.token, { type: 'edit-goal', ...draft(taskId), goalId: second })).ok, false);
  value(await module.execute(parent.token, { type: 'edit-goal', ...draft(taskId), goalId: first, name: '保留旧引用' }));
  const goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId: first })).goal;
  assert.equal(goal.tasks[0]?.taskId, taskId);
  const tasks = value(await module.inspect(parent.token, { type: 'child-day', childId: 'guoguo', businessDate: '2026-09-14' })).tasks;
  assert.equal(tasks.find(task => task.taskId === taskId)?.name, '数学课外练习');
  assert.deepEqual(tasks.find(task => task.taskId === taskId)?.goalIds, [first]);
});

test('[TASK-5-S07][AC-10][AC-12] 模式2升级保留任务和凭证并在重开后保持目标关系与快照', async () => {
  const { disk, taskId } = await family();
  const old = (await disk.load())!;
  old.schemaVersion = 2;
  delete old.goals;
  await disk.save(old);
  const module = await FamilyHabitModule.create(disk, hasher);
  assert.equal((await disk.load())?.schemaVersion, 4);
  const parent = value(await module.openSession({ entry: 'parent', password: '2468' }));
  assert.equal(value(await module.inspect(parent.token, { type: 'family-overview' })).revision, old.revision);
  const created = value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) }));
  const expected = await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId: created.goalId! });
  const restarted = await FamilyHabitModule.create(disk, hasher);
  const session = value(await restarted.openSession({ entry: 'parent', password: '2468' }));
  assert.deepEqual(await restarted.inspect(session.token, { type: 'goal-detail', childId: 'guoguo', goalId: created.goalId! }), expected);
});

test('[TASK-5-S08][AC-12] 排队创建目标使用提交时草稿且并发目标不会丢失', async () => {
  const { module, parent, taskId } = await family();
  const command = { type: 'create-goal' as const, ...draft(taskId), tasks: [{ taskId, weekdays: [1], rules: { completionPoints: 5, missedPolicy: 'no-points' as const, deductionPoints: 0, streakEnabled: false, streakCap: null } }] };
  const first = module.execute(parent.token, command);
  command.tasks[0]!.weekdays.push(2);
  command.tasks[0]!.rules.completionPoints = 90;
  const second = module.execute(parent.token, { type: 'create-goal', ...draft(taskId) });
  const id = value(await first).goalId!;
  assert.notEqual(id, value(await second).goalId);
  const goal = value(await module.inspect(parent.token, { type: 'goal-detail', childId: 'guoguo', goalId: id })).goal;
  assert.deepEqual(goal.tasks[0]?.weekdays, [1]);
  assert.equal(goal.tasks[0]?.rules.completionPoints, 5);
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' })).goals.length, 2);
});

test('[TASK-5-S09] 迁移或目标写入失败保留旧状态且重试不重复创建', async () => {
  class FailingDisk extends MemoryPersistenceAdapter {
    fail = false;
    override async save(state: import('../../entry/src/main/ets/domain/FamilyHabitModule.js').FamilyState) {
      if (this.fail) throw new Error('模拟磁盘失败');
      await super.save(state);
    }
  }
  const disk = new FailingDisk();
  const { module, parent, taskId } = await family(disk);
  const before = await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' });
  disk.fail = true;
  const failed = await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, 'PERSISTENCE_FAILED');
  assert.deepEqual(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' }), before);
  disk.fail = false;
  value(await module.execute(parent.token, { type: 'create-goal', ...draft(taskId) }));
  assert.equal(value(await module.inspect(parent.token, { type: 'goal-list', childId: 'guoguo' })).goals.length, 1);
  const old = (await disk.load())!;
  old.schemaVersion = 2;
  delete old.goals;
  await disk.save(old);
  const savedOld = await disk.load();
  disk.fail = true;
  await assert.rejects(FamilyHabitModule.create(disk, hasher), /模拟磁盘失败/);
  assert.deepEqual(await disk.load(), savedOld);
  disk.fail = false;
  await FamilyHabitModule.create(disk, hasher);
  assert.equal((await disk.load())?.schemaVersion, 4);
});

test('[TASK-5-S10][AC-09] 目标编辑可查询稳定内置活动标识且返回副本', async () => {
  const { module, parent } = await family();
  const activities = value(await module.inspect(parent.token, { type: 'growth-activities' })).activities;
  assert.deepEqual(activities, [{ id: 'cat', name: '养小猫' }, { id: 'tree', name: '种小树' }]);
  activities[0]!.id = 'changed';
  assert.equal(value(await module.inspect(parent.token, { type: 'growth-activities' })).activities[0]?.id, 'cat');
});
