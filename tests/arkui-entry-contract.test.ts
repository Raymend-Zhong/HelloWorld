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
