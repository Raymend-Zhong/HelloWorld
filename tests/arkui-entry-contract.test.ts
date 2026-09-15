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

test('[TASK-8-UI01][AC-17][AC-18] ArkUI 提供频率计划和周期进度稳定选择器', async () => {
  const index = await readFile(INDEX_PATH, 'utf8');
  const goalPanel = await readFile(new URL('../entry/src/main/ets/pages/GoalPanel.ets', import.meta.url), 'utf8');
  const taskEditor = await readFile(new URL('../entry/src/main/ets/pages/GoalTaskEditor.ets', import.meta.url), 'utf8');

  assert.match(index, /本周进度/);
  assert.match(goalPanel, /每周完成 \$\{task\.plan\.requiredCount\} 次/);
  for (const selector of [
    'goal-plan-date-',
    'goal-plan-weekly-',
    'goal-weekly-required-',
  ]) {
    assert.match(taskEditor, new RegExp(selector));
  }
});

test('[TASK-9-UI01][AC-20][AC-31] ArkUI 提供豁免与清算审阅过期处理稳定选择器', async () => {
  const source = await readFile(INDEX_PATH, 'utf8');
  const selectors = [
    'settlement-exempt-date-',
    'settlement-exempt-weekly-',
    'settlement-exempt-all-date',
    'settlement-message',
  ];

  assert.match(source, /已豁免/);
  assert.match(source, /全部任务豁免/);
  assert.match(source, /周期任务豁免/);
  assert.match(source, /清算审阅已过期/);
  for (const selector of selectors) {
    assert.match(source, new RegExp(selector));
  }
});

test('[TASK-11-UI01][AC-41][AC-42][AC-43][AC-44][AC-45][AC-54] ArkUI 提供虚拟成长、老师反馈和孩子配置稳定选择器', async () => {
  const index = await readFile(INDEX_PATH, 'utf8');
  const goalPanel = await readFile(new URL('../entry/src/main/ets/pages/GoalPanel.ets', import.meta.url), 'utf8');
  const selectors = [
    'parent-child-profile',
    'profile-guoguo',
    'profile-yangyang',
    'profile-theme-focus',
    'profile-teacher-calm',
    'profile-teacher-storybook',
    'profile-save',
    'settlement-feedback-',
    'settlement-feedback-played-',
    'child-teacher',
    'child-growth-',
    'goal-growth-',
  ];

  assert.match(index, /老师反馈/);
  assert.match(index, /虚拟成长进度/);
  assert.match(goalPanel, /虚拟成长进度/);
  for (const selector of selectors) {
    assert.match(`${index}\n${goalPanel}`, new RegExp(selector));
  }
});
