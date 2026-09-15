import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FamilyHabitModule,
  type FamilyBackup,
  MemoryPersistenceAdapter,
  type PasswordHasher,
  type Result,
} from '../../entry/src/main/ets/domain/FamilyHabitModule.js';

const hasher: PasswordHasher = {
  async createSalt() { return '任务十二测试盐'; },
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
  return { module, parent };
}

test('[TASK-12-S01][AC-48][AC-55] 家长导出完整 JSON 备份且不包含家长凭证和会话数据', async () => {
  const { module, parent } = await family();
  const taskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-math',
  })).taskId!;
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '备份目标',
    description: '验证导出内容',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId, weekdays: [1] }],
  })).goalId!;

  const backup: FamilyBackup = value(await module.inspect(parent.token, { type: 'backup-export' }));
  assert.equal(backup.backupFormatVersion, 1);
  assert.equal(backup.schemaVersion, 6);
  assert.match(backup.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(backup.checksum, /^[0-9a-f]{8}$/);
  assert.equal(backup.summary.children, 2);
  assert.equal(backup.summary.taskPoolTasks, 1);
  assert.equal(backup.summary.goals, 1);
  assert.ok(backup.data.goals);
  assert.equal(backup.data.goals[0]?.id, goalId);

  const json = JSON.stringify(backup);
  assert.equal(json.includes('parentCredential'), false);
  assert.equal(json.includes('任务十二测试盐'), false);
  assert.equal(json.includes('2468'), false);
  assert.equal(json.includes('session-'), false);
});
