# TASK-5：按日期计划的打卡目标

## 追踪与范围

- 任务：[GitHub #5](https://github.com/Raymend-Zhong/HelloWorld/issues/5)。
- 规格：[SPEC-HABIT-001](../specs/SPEC-HABIT-001-儿童习惯打卡积分平台.md)。
- 前置 #4 已于 2026-09-13 关闭；关闭记录明确将 AC-08 的目标引用保留和禁止新目标引用移交本票。
- 基线：`d0a90937e344a7a6976d2d6abc64c18d3f07ad40`。
- 分支：`codex/TASK-5-date-goals`。
- 用户确认测试边界：家庭习惯 `openSession` / `execute` / `inspect`、内部持久化合约、ArkUI 用户流程。
- 不实现频率计划、打卡、清算、终止与反馈演出。

## 垂直切片与选择器

| 选择器 | AC / 要求 | 行为 | 已运行的红灯原因 |
| --- | --- | --- | --- |
| TASK-5-S01 | AC-10、AC-12 | 创建有效目标、详情、初始独立规则 | COMMAND_UNSUPPORTED |
| TASK-5-S02 | AC-09 | 必填、活动、同孩子引用、星期及规则校验 | 空任务目标被接受 |
| TASK-5-S03 | AC-11 | 多目标独立零分、门槛与孩子隔离 | QUERY_UNSUPPORTED |
| TASK-5-S04 | AC-10 | 开始日起按指定星期提供任务，同任务合并显示关联目标 | QUERY_UNSUPPORTED |
| TASK-5-S05 | AC-12、AC-11 | 修改默认配置不污染已有目标；编辑只改变指定目标 | COMMAND_UNSUPPORTED |
| TASK-5-S06 | AC-08 | 停用保留已有目标引用与日期要求，禁止新增引用 | 停用任务被新目标接受 |
| TASK-5-S07 | 迁移、AC-10、AC-12 | 模式 2 升级并重开保留目标关系、状态、规则 | 模式版本仍为 2 |
| TASK-5-S08 | AC-12 | 排队草稿隔离、并发创建保留全部目标 | 提交后的星期修改污染命令 |
| TASK-5-S09 | 存储失败处理 | 迁移与写入失败保留原状态、重试成功 | 现有事务实现直接通过，属于回归验证 |
| TASK-5-S10 | AC-09 | 查询稳定的内置养成活动与副本隔离 | QUERY_UNSUPPORTED |
| TASK-5-DB01 | AC-08、AC-10、AC-12 | 真实 ArkData 模式 2 升级、目标快照与停用引用重开 | 原适配器返回 Capability not support |
| TASK-5-UI01 | AC-09、AC-10、AC-12 | 创建、字段错误、编辑、详情及孩子切换 | 独立测试入口尚未连接目标页面，goal-new 不存在 |

AC-11 本票验证目标各自初始零分、配置和身份独立；清算后的积分独立属于后续清算票，不在本票伪造积分写入接口。

## 实现约定

- 目标保存名称、描述、积分门槛、以天录入的计划时长、奖励、开始业务日期及内置活动标识。
- `create-goal` 与 `edit-goal` 由家长调用；页面传入当前家庭本地日期，内核不读取系统时钟。
- `goal-list`、`goal-detail`、`child-day` 返回快照，孩子只能读取所属账套。
- `growth-activities` 返回内置 `cat`（养小猫）与 `tree`（种小树）标识。
- 未覆盖规则的目标任务从任务默认配置初始化；已有目标编辑未提供规则时保留自己的快照。
- 模式 2 到 3 添加目标集合，保留任务池、孩子、家长凭证和修订号。
- 目标引用任务即使被停用，仍在原目标按计划提供要求。

## 发现的前置基础问题

设备测试最初沿用 `async (done) => { try ... finally { done(); } }`。本地 Hypium 1.0.21 源码显示 `done()` 会先 resolve，之后的异步异常无法再使测试失败。新增测试改为无回调参数的 async 函数，由框架等待 Promise 并记录错误。修正前的设备通过结果不作为本票验收证据。

真实合约随后暴露普通 RDB 适配器调用了向量数据库的 `execute(sql, txId)`、`beginTrans()` 和按事务 ID 提交接口，返回能力不支持。修正为普通 RDB 的 `executeSql`、`beginTransaction`、`commit`、`rollBack`，继续在一个事务内保存完整状态。依据：[华为向量数据库接口说明](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/data-persistence-by-vector-store)及本地 SDK 定义。

修正后 TASK-5-DB01 在真实设备通过。页面测试改用仅测试 HAP 包含的 GoalTestAbility，通过公共接口准备内存账套和家长会话，再操作正式 GoalPanel。测试入口未连接页面时 goal-new 缺失，接入后同一测试通过。输入后使用回车键结束输入；先前密码入口、截图路径及键盘操作失败不计为功能红灯。

## 验证命令

```bash
node --import tsx --test --test-name-pattern='TASK-5-S01' tests/domain/goals.test.ts
node --import tsx --test tests/domain/goals.test.ts tests/domain/task-pool.test.ts
npm run typecheck
npm test
```

HarmonyOS 主包和测试包分别使用 DevEco Studio 的 hvigor，产品 default，模块 entry@default / entry@ohosTest，任务 assembleHap。

设备测试：

```bash
hdc shell aa test -b com.raymend.familyhabit -m entry_test -s unittest OpenHarmonyTestRunner -s class TASK5GoalUI,TASK5GoalPersistence -s timeout 60000 -w 60
```

当前连接设备报告 HarmonyOS `7.0.0.105`、API `26`，不是规格记录的 HarmonyOS 6.1；真机结果只证明此次实际环境，不能等同于已完成 6.1 兼容验收。

## 当前状态

本地全套 31/31 通过（含目标领域 10 项）；最终类型检查、主 HAP 与测试 HAP 编译通过。TASK-5-UI01 和 TASK-5-DB01 在任务选择刷新修复后真机 2/2 通过。随后仅整理测试格式、文档，并在打开详情时清除旧错误字段；最终重跑时 hdc 无连接设备，因此这项错误字段清理未再次在真机运行。独立双轴审查与提交待完成。


## 页面与稳定控件

- 家长通过 `parent-goals` 进入列表；`goals-guoguo`、`goals-yangyang` 切换账套。
- `goal-new` 创建，`goal-open-<目标ID>` 查看，`goal-edit` 编辑，`goal-save` 保存。
- 基本字段：`goal-name`、`goal-description`、`goal-threshold`、`goal-planned-days`、`goal-reward`。
- 活动：`goal-activity-cat`、`goal-activity-tree`。
- 任务：`goal-select-<任务ID>`、`goal-day-<任务ID>-<星期>`、`goal-completion-<任务ID>`、`goal-deduction-<任务ID>`、`goal-deduct-<任务ID>`、`goal-streak-<任务ID>`、`goal-cap-<任务ID>`。
- 错误：`goal-error-<字段>`；表单滚动：`goal-editor-scroll`；详情：`goal-detail`。
- 孩子端通过 child-day 显示当日任务和目标，控件 `child-goal-<目标ID>`。
- 测试套件筛选：`-s class TASK5GoalUI,TASK5GoalPersistence`；测试入口只编入测试 HAP，不改变正式应用家长门禁。


## 页面状态回归

在 UI01 中补充“已选择”和“每周完成日期”断言后出现红灯：任务选择只改变草稿数据，未刷新规则控件。改为 `@Observed` 草稿配合 `@ObjectLink` 的 GoalTaskEditor，保持表单和领域快照分离。

最终验证只将 TASK-5 的两个无 done 回调测试作为可信设备证据；旧 TASK-3 / TASK-4 设备测试仍有 finally 调用 done 的历史写法，本票不据其汇总通过数字宣称门禁回归已通过。
