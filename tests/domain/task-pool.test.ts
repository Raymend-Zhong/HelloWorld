import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务池测试盐'; },
  async derive(password, salt) { return `${salt}:${password}`; },
  async verify(password, salt, digest) { return digest === `${salt}:${password}`; },
};
function value<T>(result: Result<T>): T {
  if (!result.ok) assert.fail(JSON.stringify(result.error));
  return result.value;
}
async function family(persistence = new MemoryPersistenceAdapter()) {
  const module = await FamilyHabitModule.create(persistence, hasher);
  const setup = value(await module.openSession({ entry: 'parent-setup' }));
  value(await module.execute(setup.token, { type: 'set-parent-password', password: '2468' }));
  const parent = value(await module.openSession({ entry: 'parent', password: '2468' }));
  return { module, parent, persistence };
}

test('[TASK-4-S01][AC-53] 家长可查看初中和幼儿园的基础学习与生活模板', async () => {
  const { module, parent } = await family();
  const junior = value(await module.inspect(parent.token, { type: 'task-templates', stage: 'junior' }));
  assert.deepEqual(junior.templates.map(item => item.name), [
    '数学课外练习', '英语课外练习', '语文阅读', '刷牙', '目标时间前准备睡觉',
  ]);
  const kindergarten = value(await module.inspect(parent.token, { type: 'task-templates', stage: 'kindergarten' }));
  assert.deepEqual(kindergarten.templates.map(item => item.name), [
    '英语打卡', '刷牙', '在幼儿园吃早餐', '在幼儿园吃午餐', '目标时间前准备睡觉',
  ]);
  assert.equal(new Set([...junior.templates, ...kindergarten.templates].map(item => item.id)).size, 10);
});

test('[TASK-4-S02][AC-06] 复制的任务只出现在指定孩子的任务池且快照不能修改领域数据', async () => {
  const { module, parent } = await family();
  const copied = value(await module.execute(parent.token, {
    type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math',
  }));
  const pool = value(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }));
  assert.equal(pool.tasks.length, 1);
  assert.equal(pool.tasks[0]?.id, copied.taskId);
  assert.equal(pool.tasks[0]?.name, '数学课外练习');
  assert.deepEqual(value(await module.inspect(parent.token, { type: 'task-pool', childId: 'yangyang' })).tasks, []);
  const guoguo = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  assert.deepEqual(value(await module.inspect(guoguo.token, { type: 'child-home' })).tasks, pool.tasks);
  pool.tasks[0]!.name = '污染快照';
  pool.tasks[0]!.defaultRules.completionPoints = 99;
  const again = value(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }));
  assert.equal(again.tasks[0]?.name, '数学课外练习');
  assert.equal(again.tasks[0]?.defaultRules.completionPoints, 1);
});

test('[TASK-4-S03][AC-06] 家长独立编辑副本的内容和默认规则不会改变模板或其他副本', async () => {
  const { module, parent } = await family();
  const first = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'yangyang', templateId: 'junior-math' }));
  const rules = { completionPoints: 5, missedPolicy: 'deduct' as const, deductionPoints: 2, streakEnabled: true, streakCap: 3 };
  value(await module.execute(parent.token, {
    type: 'edit-task-pool-task', childId: 'guoguo', taskId: first.taskId!,
    name: '数学练习十分钟', description: '完成一页练习', defaultRules: rules,
  }));
  rules.completionPoints = 100;
  const pool = value(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }));
  assert.equal(pool.tasks[0]?.name, '数学练习十分钟');
  assert.equal(pool.tasks[0]?.description, '完成一页练习');
  assert.deepEqual(pool.tasks[0]?.defaultRules, { completionPoints: 5, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: true, streakCap: 3 });
  const other = value(await module.inspect(parent.token, { type: 'task-pool', childId: 'yangyang' }));
  assert.equal(other.tasks[0]?.name, '数学课外练习');
  assert.equal(other.tasks[0]?.defaultRules.completionPoints, 1);
  const templates = value(await module.inspect(parent.token, { type: 'task-templates', stage: 'junior' }));
  assert.equal(templates.templates[0]?.name, '数学课外练习');
  assert.equal(templates.templates[0]?.defaultRules.completionPoints, 1);
});

test('[TASK-4-S04][AC-06] 非法任务名称和计分配置返回中文错误且保留原数据', async () => {
  const { module, parent } = await family();
  const copied = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  const before = await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' });
  const rules = { completionPoints: 1, missedPolicy: 'no-points' as const, deductionPoints: 0, streakEnabled: false, streakCap: null };
  const invalid = [
    { name: '  ', defaultRules: rules },
    { name: '数学', defaultRules: { ...rules, completionPoints: 0 } },
    { name: '数学', defaultRules: { ...rules, completionPoints: 1.5 } },
    { name: '数学', defaultRules: { ...rules, completionPoints: Number.NaN } },
    { name: '数学', defaultRules: { ...rules, deductionPoints: -1 } },
    { name: '数学', defaultRules: { ...rules, streakCap: -1 } },
    { name: '数学', defaultRules: { ...rules, streakCap: 1.5 } },
  ];
  for (const input of invalid) {
    const result = await module.execute(parent.token, { type: 'edit-task-pool-task', childId: 'guoguo', taskId: copied.taskId!, description: '', ...input });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'VALIDATION_FAILED');
      assert.match(result.error.message, /名称|整数/);
    }
    assert.deepEqual(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }), before);
  }
});

test('[TASK-4-S05][AC-06] 未验证家长不能复制或编辑且孩子只可读取自己的任务池', async () => {
  const module = await FamilyHabitModule.create(new MemoryPersistenceAdapter(), hasher);
  const setup = value(await module.openSession({ entry: 'parent-setup' }));
  const child = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  for (const token of [setup.token, child.token]) {
    const result = await module.execute(token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, 'PERMISSION_DENIED');
  }
  const crossChild = await module.inspect(child.token, { type: 'task-pool', childId: 'yangyang' });
  assert.equal(crossChild.ok, false);
  if (!crossChild.ok) assert.equal(crossChild.error.code, 'PERMISSION_DENIED');
  assert.deepEqual(value(await module.inspect(child.token, { type: 'task-pool', childId: 'guoguo' })).tasks, []);
});

test('[TASK-4-S06][AC-06] 任务保存失败时返回中文错误且重试只新增一个完整任务', async () => {
  class UnavailableDisk extends MemoryPersistenceAdapter {
    fail = false;
    override async save(state: import('../../entry/src/main/ets/domain/FamilyHabitModule.js').FamilyState) {
      if (this.fail) throw new Error('模拟存储故障');
      return super.save(state);
    }
  }
  const disk = new UnavailableDisk();
  const { module, parent } = await family(disk);
  const before = await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' });
  disk.fail = true;
  const failed = await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' });
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.deepEqual(failed.error, { code: 'PERSISTENCE_FAILED', message: '保存失败，请稍后重试。' });
  assert.deepEqual(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }), before);
  disk.fail = false;
  value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  assert.equal(value(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' })).tasks.length, 1);
});

test('[TASK-4-S07][AC-08部分] 停用保留任务标识和完整内容并在重启后仍可查看', async () => {
  const { module, parent, persistence } = await family();
  const copied = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  const before = value(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }));
  value(await module.execute(parent.token, { type: 'disable-task-pool-task', childId: 'guoguo', taskId: copied.taskId! }));
  const restarted = await FamilyHabitModule.create(persistence, hasher);
  const session = value(await restarted.openSession({ entry: 'parent', password: '2468' }));
  const after = value(await restarted.inspect(session.token, { type: 'task-pool', childId: 'guoguo' }));
  assert.deepEqual(after.tasks, [{ ...before.tasks[0], disabled: true }]);
});

test('[TASK-4-S08][AC-07] 模式1升级后保留家长和孩子并可以复制模板且再次打开不重复迁移', async () => {
  const disk = new MemoryPersistenceAdapter();
  await disk.save({ schemaVersion: 1, revision: 7,
    children: [
      { id: 'guoguo', displayName: '果果', avatar: 'guoguo', theme: 'mature' },
      { id: 'yangyang', displayName: '阳阳', avatar: 'yangyang', theme: 'playful' },
    ], parentCredential: { salt: '旧盐', digest: '旧盐:2468' },
  });
  const module = await FamilyHabitModule.create(disk, hasher);
  const parent = value(await module.openSession({ entry: 'parent', password: '2468' }));
  const overview = value(await module.inspect(parent.token, { type: 'family-overview' }));
  assert.equal(overview.revision, 7);
  assert.deepEqual(overview.children.map(child => child.id), ['guoguo', 'yangyang']);
  // 在已确认的持久化合约边界验证模式版本。
  assert.equal((await disk.load())?.schemaVersion, 2);
  value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'yangyang', templateId: 'kindergarten-english' }));
  const expected = await module.inspect(parent.token, { type: 'task-pool', childId: 'yangyang' });
  const restarted = await FamilyHabitModule.create(disk, hasher);
  const again = value(await restarted.openSession({ entry: 'parent', password: '2468' }));
  assert.deepEqual(await restarted.inspect(again.token, { type: 'task-pool', childId: 'yangyang' }), expected);
});

test('[TASK-4-S09][AC-07] 模板种子升级改变模板但不覆盖家长已修改及停用的任务', async () => {
  const { module, parent, persistence } = await family();
  const copied = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  value(await module.execute(parent.token, { type: 'edit-task-pool-task', childId: 'guoguo', taskId: copied.taskId!,
    name: '家长定制数学', description: '每天一页', defaultRules: { completionPoints: 8, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: true, streakCap: null } }));
  value(await module.execute(parent.token, { type: 'disable-task-pool-task', childId: 'guoguo', taskId: copied.taskId! }));
  const expected = await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' });
  // 持久化边界提供旧种子样本，不建立可供页面修改模板的入口。
  const old = (await persistence.load())!;
  old.templateSeedVersion = 0;
  old.taskTemplates = [{ id: 'junior-math', stage: 'junior', name: '旧数学模板', description: '旧描述',
    defaultRules: { completionPoints: 2, missedPolicy: 'no-points', deductionPoints: 0, streakEnabled: false, streakCap: null } }];
  await persistence.save(old);
  const restarted = await FamilyHabitModule.create(persistence, hasher);
  const session = value(await restarted.openSession({ entry: 'parent', password: '2468' }));
  assert.deepEqual(await restarted.inspect(session.token, { type: 'task-pool', childId: 'guoguo' }), expected);
  assert.equal((await persistence.load())?.templateSeedVersion, 1);
  const templates = value(await restarted.inspect(session.token, { type: 'task-templates', stage: 'junior' }));
  assert.equal(templates.templates[0]?.name, '数学课外练习');
  value(await restarted.execute(session.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  const tasks = value(await restarted.inspect(session.token, { type: 'task-pool', childId: 'guoguo' })).tasks;
  assert.equal(tasks[1]?.defaultRules.completionPoints, 1);
  assert.equal(tasks[0]?.defaultRules.completionPoints, 8);
});

test('[TASK-4-S10][AC-06] 同时复制到两个孩子时两个任务都保存且标识不同', async () => {
  const { module, parent, persistence } = await family();
  const copies = await Promise.all([
    module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }),
    module.execute(parent.token, { type: 'copy-task-template', childId: 'yangyang', templateId: 'kindergarten-english' }),
  ]);
  assert.notEqual(value(copies[0]!).taskId, value(copies[1]!).taskId);
  const restarted = await FamilyHabitModule.create(persistence, hasher);
  const session = value(await restarted.openSession({ entry: 'parent', password: '2468' }));
  assert.equal(value(await restarted.inspect(session.token, { type: 'task-pool', childId: 'guoguo' })).tasks.length, 1);
  assert.equal(value(await restarted.inspect(session.token, { type: 'task-pool', childId: 'yangyang' })).tasks.length, 1);
});

test('[TASK-4-S11][AC-06] 不存在的孩子或模板不能产生孤立任务且跨孩子修改被拒绝', async () => {
  const { module, parent } = await family();
  const invalidChild = await module.execute(parent.token, { type: 'copy-task-template', childId: 'missing' as 'guoguo', templateId: 'junior-math' });
  assert.equal(invalidChild.ok, false);
  if (!invalidChild.ok) assert.equal(invalidChild.error.code, 'CHILD_NOT_FOUND');
  const invalidTemplate = await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'missing' });
  assert.equal(invalidTemplate.ok, false);
  const copied = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  const before = await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' });
  const wrongChild = await module.execute(parent.token, { type: 'disable-task-pool-task', childId: 'yangyang', taskId: copied.taskId! });
  assert.equal(wrongChild.ok, false);
  assert.deepEqual(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' }), before);
});

test('[TASK-4-S12][AC-07] 不支持的未来数据版本被拒绝而不是降级覆盖', async () => {
  const { persistence } = await family();
  const future = (await persistence.load())!;
  future.schemaVersion = 99;
  await persistence.save(future);
  await assert.rejects(FamilyHabitModule.create(persistence, hasher), /版本/);
  assert.deepEqual(await persistence.load(), future);
});

test('[TASK-4-S13][AC-07] 升级保存失败保留旧模式且重试可以恢复', async () => {
  class FailingUpgrade extends MemoryPersistenceAdapter {
    fail = false;
    override async save(state: import('../../entry/src/main/ets/domain/FamilyHabitModule.js').FamilyState) {
      if (this.fail) throw new Error('模拟升级失败');
      await super.save(state);
    }
  }
  const disk = new FailingUpgrade();
  await disk.save({ schemaVersion: 1, revision: 7, children: [
    { id: 'guoguo', displayName: '果果', avatar: 'guoguo', theme: 'mature' },
    { id: 'yangyang', displayName: '阳阳', avatar: 'yangyang', theme: 'playful' },
  ], parentCredential: { salt: '旧盐', digest: '旧盐:2468' } });
  const before = await disk.load();
  disk.fail = true;
  await assert.rejects(FamilyHabitModule.create(disk, hasher), /模拟升级失败/);
  assert.deepEqual(await disk.load(), before);
  disk.fail = false;
  const restarted = await FamilyHabitModule.create(disk, hasher);
  const parent = value(await restarted.openSession({ entry: 'parent', password: '2468' }));
  assert.equal(value(await restarted.inspect(parent.token, { type: 'task-templates', stage: 'junior' })).templates.length, 5);
});

test('[TASK-4-S14][AC-06] 已提交编辑命令不随调用者后续修改草稿而改变', async () => {
  const { module, parent } = await family();
  const copied = value(await module.execute(parent.token, { type: 'copy-task-template', childId: 'guoguo', templateId: 'junior-math' }));
  const command = { type: 'edit-task-pool-task' as const, childId: 'guoguo' as const, taskId: copied.taskId!, name: '提交时的数学', description: '',
    defaultRules: { completionPoints: 5, missedPolicy: 'no-points' as const, deductionPoints: 0, streakEnabled: false, streakCap: null } };
  const saving = module.execute(parent.token, command);
  command.name = '随后修改的草稿';
  command.defaultRules.completionPoints = 20;
  value(await saving);
  const task = value(await module.inspect(parent.token, { type: 'task-pool', childId: 'guoguo' })).tasks[0]!;
  assert.equal(task.name, '提交时的数学');
  assert.equal(task.defaultRules.completionPoints, 5);
});
