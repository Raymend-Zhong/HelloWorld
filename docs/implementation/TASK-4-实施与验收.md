# TASK-4：适龄任务模板与独立任务池

## 范围与依赖

- 规格：`docs/specs/SPEC-HABIT-001-儿童习惯打卡积分平台.md`。
- 前置任务 #3 已关闭，记录了本地测试及 MatePad 真机验证。
- 用户已确认本票实现停用及任务数据保留；AC-08 的历史目标引用展示与禁止新目标引用由目标创建任务完成，本票不宣称完整覆盖 AC-08。
- 测试边界已确认：家庭习惯 `openSession` / `execute` / `inspect`、内部持久化合约、ArkUI 用户流程。
- 基线：`1a5b1ca`；分支：`codex/TASK-4-task-pool`。

## 实施切片

每个行为依次写测试、运行并确认目标行为缺失、最小实现、运行受影响测试与类型检查。审查阶段重构并保持绿色，最后运行全套测试。

| 顺序 | 行为与验收 | 实现位置 | 稳定测试选择器 |
| --- | --- | --- | --- |
| 1 | 列出两阶段基础任务，AC-53 | FamilyHabitModule 与内置模板 | TASK-4-S01 |
| 2 | 家长复制任务；独立编辑名称、描述和默认规则；孩子隔离，AC-06 | FamilyHabitModule | TASK-4-S02、TASK-4-S03 |
| 3 | 非法输入、越权、写入失败不改变任务 | FamilyHabitModule | TASK-4-S04、TASK-4-S05、TASK-4-S06 |
| 4 | 停用后保留任务标识、名称与规则，AC-08 部分 | FamilyHabitModule | TASK-4-S07 |
| 5 | 模式 1 确定升级至模式 2；追加模板种子升级不覆盖任务，AC-07 | FamilyHabitModule、ArkData 合约 | TASK-4-S08、TASK-4-S09 |
| 6 | 家长选择孩子、复制模板、编辑、停用、中文错误 | TaskPoolPanel、Index、ArkUI 自动化 | TASK-4-UI01 |

## 接口与数据

- 查询 `task-templates` 返回按年龄阶段筛选的模板快照。
- 查询 `task-pool` 返回指定孩子的任务池快照，孩子会话只能读取所属账套；孩子切换继续通过 `openSession`。
- 命令 `copy-task-template`、`edit-task-pool-task`、`disable-task-pool-task` 只允许家长执行。
- 规则使用完成积分、未完成处理、扣分值、连续奖励开关和可空上限；遵循规格的整数及非负约束。
- 内置种子版本从 1 开始，后续只能追加版本；模板和任务各保存独立规则副本。
- 模式 1 升级为模式 2 时保留孩子、密码材料与修订号；失败不覆盖旧数据。仍通过 ArkData 的单事务保存完整状态。
- 页面只保存表单草稿、会话和查询快照。

## 验证命令

```bash
node --import tsx --test --test-name-pattern='TASK-4-S01' tests/domain/task-pool.test.ts
node --import tsx --test tests/domain/task-pool.test.ts
npm run typecheck
npm test
```

HarmonyOS 主 HAP 和测试 HAP 使用本地 DevEco 工具构建；有可用设备时运行 ArkData 和 ArkUI 自动化。
