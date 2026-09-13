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


## 补充回归与页面选择器

- `TASK-4-S10`：并发复制不丢任务且标识不同。
- `TASK-4-S11`：不存在的孩子或模板被拒绝，跨孩子修改不改变任务。
- `TASK-4-S12`：未来模式版本被拒绝，不降级覆盖。
- `TASK-4-S13`：迁移保存失败保留旧数据，重试成功（持久化合约回归，现有迁移实现直接通过）。
- `TASK-4-S14`：命令排队时不随调用者后续草稿修改而变化。
- `TASK-4-UI02`：沿用仓库既有静态控件契约，验证任务池入口；不替代真实交互测试。
- `TASK-4-DB01`：真实 ArkData 旧模式升级、复制、编辑、停用、关闭重开。
- ArkUI 稳定控件：`parent-task-pool`、`pool-guoguo`、`pool-yangyang`、`task-add-template`、`templates-junior`、`templates-kindergarten`、`template-copy-<模板ID>`、`task-open-<任务ID>`、`task-name`、`task-description`、`task-completion-points`、`task-deduct-enabled`、`task-deduction-points`、`task-streak-enabled`、`task-streak-cap`、`task-save`、`task-disable`、`task-message`、`task-editor-back`、`task-pool-back`。

## 红—绿记录

| 选择器 | 已运行的失败原因 | 实现后的结果 |
| --- | --- | --- |
| S01 | 模板查询返回 QUERY_UNSUPPORTED | 通过 |
| S02、S03、S07 | 复制、编辑、停用返回 COMMAND_UNSUPPORTED | 通过 |
| S04 | 非法名称与积分配置被错误接受 | 通过 |
| S05 | 未验证家长可以复制任务 | 通过 |
| S06 | 保存失败直接抛出异常 | 通过 |
| S08 | 数据模式仍为 1 | 通过 |
| S09 | 种子版本未保存和升级 | 通过 |
| S10 | 并发任务得到同一标识 | 通过 |
| S11 | 不存在的孩子被错误接受 | 通过 |
| S12 | 未来版本没有被拒绝 | 通过 |
| S14 | 提交后变更草稿污染已排队命令 | 通过 |
| UI02 | 家长任务池入口控件缺失 | 通过 |

以上 S 编号均带 `TASK-4-` 前缀。UI01 首次尝试因锁屏未进入断言；用户解锁后已在真机通过。首次锁屏失败不计为功能红灯。

## 审查记录

- 规范轴：本地检查中文文档、注释、错误及模块边界；ArkUI 仅调用家庭习惯公共入口。抽取统一保存处理，消除密码和任务保存的重复错误处理。
- 规格轴：本地核对 AC-06、AC-07、AC-53 及已确认的 AC-08 部分范围。发现排队命令引用可变草稿的问题，新增 S14 并修复；不扩展目标能力。
- code-review 独立双轴审查首次因额度限制中断；重试后完成对 `1a5b1ca...97f0448` 完整变更的审查。规范轴 0 项可行动发现，规格轴 0 项可行动发现。规格轴依据已读取的任务票范围、规格和用户确认的 AC-08 划分。

## 真机验证

首次启动返回 `10106102`（平板锁屏）；用户解锁后运行以下命令：

```bash
/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc shell aa test -b com.raymend.familyhabit -m entry_test -s unittest OpenHarmonyTestRunner -w 60
```

结果：`Tests run: 4, Failure: 0, Error: 0, Pass: 4, Ignore: 0`，`TestFinished-ResultCode: 0`。

- `TASK-4-UI01`：复制、编辑、中文验证错误、孩子隔离、停用与保留展示通过。
- `TASK-4-DB01`：真实 ArkData 模式 1 升级、复制编辑停用、关闭重开、孩子隔离通过。
- TASK-3 入口与家长门禁、ArkData 重开持久化回归均通过。

此结果验证上述自动化流程，不等同于全规格的所有横竖屏、分屏及设备兼容验收。

不关闭任务 #4，不将 AC-08 标为完整通过，不提交本机自动签名配置。

## 最终本地验证

- `npm test`：21/21 通过，0 失败、0 跳过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。
- DevEco 主 HAP：构建及签名成功。
- DevEco 测试 HAP：构建及签名成功。
- 领域初始切片提交：`1e152cb`（AC-06、AC-07、AC-53、AC-08 部分）。
- 后续页面、回归修复及验收记录由含 `[TASK-4]` 的后续提交承载，可用 `git log 1a5b1ca..HEAD --oneline` 查询。
