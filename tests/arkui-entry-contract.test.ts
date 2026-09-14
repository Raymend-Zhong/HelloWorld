import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const INDEX_PATH = new URL(
  '../entry/src/main/ets/pages/Index.ets',
  import.meta.url,
);

test('[TASK-3][AC-01][AC-02][AC-03][AC-04] ArkUI 入口暴露稳定自动化选择器', async () => {
  const source = await readFile(INDEX_PATH, 'utf8');
  const selectors = [
    'entry-guoguo',
    'entry-yangyang',
    'entry-parent',
    'child-current-name',
    'switch-guoguo',
    'switch-yangyang',
    'parent-password-input',
    'parent-submit',
    'parent-screen',
  ];

  for (const selector of selectors) {
    assert.match(source, new RegExp(`\\.id\\('${selector}'\\)`));
  }
});

test('[TASK-4-UI02][AC-06] 家长管理提供任务池入口', async () => {
  const source = await readFile(INDEX_PATH, 'utf8');
  assert.match(source, /\.id\('parent-task-pool'\)/);
});

test('[TASK-6-UI01][AC-13][AC-29][AC-30] ArkUI 提供打卡撤销与每日清算稳定选择器', async () => {
  const source = await readFile(INDEX_PATH, 'utf8');
  const selectors = [
    'checkin-count-',
    'checkin-submit-',
    'checkin-revoke-',
    'parent-settlement',
    'settlement-screen',
    'settlement-guoguo',
    'settlement-yangyang',
    'settlement-date',
    'settlement-review',
    'settlement-confirm',
    'settlement-message',
    'settlement-result-',
    'settlement-net-',
    'settlement-back',
  ];

  for (const selector of selectors) {
    assert.match(source, new RegExp(selector));
  }
});

test('[TASK-7-UI01][AC-38][AC-40] ArkUI 提供目标结束状态和终止操作稳定选择器', async () => {
  const source = await readFile(new URL('../entry/src/main/ets/pages/GoalPanel.ets', import.meta.url), 'utf8');
  const selectors = [
    'goal-status-',
    'goal-streak-',
    'goal-terminate-',
    'goal-edit',
  ];

  for (const selector of selectors) {
    assert.match(source, new RegExp(selector));
  }
});
