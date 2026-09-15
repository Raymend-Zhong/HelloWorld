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

async function settledFamily() {
  const { module, parent } = await family();
  const child = value(await module.openSession({ entry: 'child', childId: 'guoguo' }));
  const guoguoTaskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-math',
  })).taskId!;
  const yangyangTaskId = value(await module.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'yangyang',
    templateId: 'kindergarten-english',
  })).taskId!;
  const goalId = value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'guoguo',
    businessDate: '2026-09-14',
    name: '恢复验证目标',
    description: '验证完整恢复',
    threshold: 100,
    plannedDays: 30,
    reward: '奖励',
    activityId: 'cat',
    tasks: [{ taskId: guoguoTaskId, weekdays: [1], rules: { completionPoints: 8, missedPolicy: 'deduct', deductionPoints: 2, streakEnabled: false, streakCap: null } }],
  })).goalId!;
  value(await module.execute(parent.token, {
    type: 'create-goal',
    childId: 'yangyang',
    businessDate: '2026-09-14',
    name: '阳阳目标',
    description: '验证另一个孩子',
    threshold: 20,
    plannedDays: 7,
    reward: '贴纸',
    activityId: 'tree',
    tasks: [{ taskId: yangyangTaskId, weekdays: [1] }],
  }));
  value(await module.execute(child.token, {
    type: 'submit-checkin',
    childId: 'guoguo',
    taskId: guoguoTaskId,
    businessDate: '2026-09-14',
  }));
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
  return { module, parent, goalId };
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

test('[TASK-12-S02][AC-49] 损坏、不兼容或违反领域不变量的备份被拒绝且当前数据保持不变', async () => {
  const { module, parent } = await family();
  const original: FamilyBackup = value(await module.inspect(parent.token, { type: 'backup-export' }));
  const attempts: Array<[string, FamilyBackup]> = [
    ['BACKUP_INVARIANT_BROKEN', {
      backupFormatVersion: 1,
      schemaVersion: 6,
      exportedAt: original.exportedAt,
      checksum: original.checksum,
      summary: original.summary,
    } as FamilyBackup],
    ['BACKUP_CHECKSUM_MISMATCH', {
      ...original,
      data: { ...original.data, revision: original.data.revision + 1 },
    }],
    ['BACKUP_VERSION_UNSUPPORTED', {
      ...original,
      backupFormatVersion: original.backupFormatVersion + 1,
    }],
    ['BACKUP_INVARIANT_BROKEN', {
      ...original,
      data: { ...original.data, children: original.data.children.slice(0, 1) },
      checksum: original.checksum,
    }],
    ['BACKUP_INVARIANT_BROKEN', {
      ...original,
      data: { ...original.data, goals: [{ ...original.data.goals?.[0], tasks: undefined }] as never },
      checksum: original.checksum,
    }],
  ];

  for (const [code, backup] of attempts) {
    const restored = await module.execute(parent.token, {
      type: 'restore-backup',
      backup,
    } as never);
    assert.equal(restored.ok, false, code);
    if (!restored.ok) assert.equal(restored.error.code, code);
    const after: FamilyBackup = value(await module.inspect(parent.token, { type: 'backup-export' }));
    assert.deepEqual(after.data, original.data);
  }
});

test('[TASK-12-S02B][AC-49] 家长选择备份后可在恢复前完成检查并获得摘要', async () => {
  const { module, parent } = await family();
  const backup: FamilyBackup = value(await module.inspect(parent.token, { type: 'backup-export' }));

  const checked = value(await module.inspect(parent.token, {
    type: 'backup-check',
    backup,
  }));
  assert.deepEqual(checked, {
    exportedAt: backup.exportedAt,
    checksum: backup.checksum,
    summary: backup.summary,
  });

  const invalid = await module.inspect(parent.token, {
    type: 'backup-check',
    backup: { ...backup, data: { ...backup.data, revision: backup.data.revision + 1 } },
  });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, 'BACKUP_CHECKSUM_MISMATCH');
});

test('[TASK-12-S03][AC-50][AC-55] 有效备份恢复完整领域数据且不覆盖当前设备家长密码', async () => {
  const source = await settledFamily();
  const backup: FamilyBackup = value(await source.module.inspect(source.parent.token, { type: 'backup-export' }));
  const expectedDetail = value(await source.module.inspect(source.parent.token, {
    type: 'goal-detail',
    childId: 'guoguo',
    goalId: source.goalId,
  }));

  const target = await FamilyHabitModule.create(new MemoryPersistenceAdapter(), hasher);
  const setup = value(await target.openSession({ entry: 'parent-setup' }));
  value(await target.execute(setup.token, { type: 'set-parent-password', password: '1357' }));
  const targetParent = value(await target.openSession({ entry: 'parent', password: '1357' }));
  value(await target.execute(targetParent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-reading',
  }));

  value(await target.execute(targetParent.token, {
    type: 'restore-backup',
    backup,
  } as never));

  assert.equal((await target.openSession({ entry: 'parent', password: '2468' })).ok, false);
  const restoredParent = value(await target.openSession({ entry: 'parent', password: '1357' }));
  const restoredBackup: FamilyBackup = value(await target.inspect(restoredParent.token, { type: 'backup-export' }));
  assert.deepEqual(restoredBackup.data, backup.data);
  assert.deepEqual(value(await target.inspect(restoredParent.token, {
    type: 'goal-detail',
    childId: 'guoguo',
    goalId: source.goalId,
  })), expectedDetail);
});

test('[TASK-12-S04][AC-49] 有效备份恢复写入失败时当前数据保持不变', async () => {
  class FailingPersistence extends MemoryPersistenceAdapter {
    fail = false;

    override async save(state: import('../../entry/src/main/ets/domain/FamilyHabitModule.js').FamilyState): Promise<void> {
      if (this.fail) throw new Error('模拟恢复写入失败');
      await super.save(state);
    }
  }

  const source = await settledFamily();
  const backup: FamilyBackup = value(await source.module.inspect(source.parent.token, { type: 'backup-export' }));
  const disk = new FailingPersistence();
  const target = await FamilyHabitModule.create(disk, hasher);
  const setup = value(await target.openSession({ entry: 'parent-setup' }));
  value(await target.execute(setup.token, { type: 'set-parent-password', password: '1357' }));
  const parent = value(await target.openSession({ entry: 'parent', password: '1357' }));
  value(await target.execute(parent.token, {
    type: 'copy-task-template',
    childId: 'guoguo',
    templateId: 'junior-reading',
  }));
  const before: FamilyBackup = value(await target.inspect(parent.token, { type: 'backup-export' }));

  disk.fail = true;
  const restored = await target.execute(parent.token, {
    type: 'restore-backup',
    backup,
  } as never);
  assert.equal(restored.ok, false);
  if (!restored.ok) assert.equal(restored.error.code, 'PERSISTENCE_FAILED');
  assert.deepEqual(value(await target.inspect(parent.token, { type: 'backup-export' })).data, before.data);
});
