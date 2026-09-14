# TASK-6：按日期任务打卡与每日清算闭环

## 追踪与范围

- 任务：[GitHub #6](https://github.com/Raymend-Zhong/HelloWorld/issues/6)。
- 规格：[SPEC-HABIT-001](../specs/SPEC-HABIT-001-儿童习惯打卡积分平台.md)。
- 前置：#5 已关闭。
- 分支：`codex/TASK-6-date-checkins-settlement`。
- 提交：`1690e58f21a805dc956767f1c30f0542c0df6dca`。
- 不实现连续奖励、频率任务、豁免、历史清算撤销和完整动画反馈。

## 垂直切片与选择器

| 选择器 | AC / 要求 | 行为 |
| --- | --- | --- |
| TASK-6-S01 | AC-13 | 孩子和家长提交打卡，孩子撤销未清算记录，孩子今日视图显示完成次数 |
| TASK-6-S02 | AC-15、AC-30 | 未安排日期不进入清算审阅，已安排未打卡任务显示未完成 |
| TASK-6-S03 | AC-16、AC-21 | 同日多条打卡在一个按日期目标任务内最多计一次完成积分 |
| TASK-6-S04 | AC-26、AC-27、AC-29、AC-32 | 家长确认清算，按目标合计奖扣，应用零分下限，拒绝孩子确认和重复确认 |
| TASK-6-S05 | AC-13 | 已清算日期的打卡不能直接撤销 |
| TASK-6-S06 | AC-32 | 清算保存失败时目标积分和清算记录不半提交 |
| TASK-6-UI01 | AC-13、AC-29、AC-30 | ArkUI 暴露孩子打卡、撤销和家长清算稳定选择器 |
| TASK-6-DB01 | AC-13、AC-21、AC-32 | ArkData 合约测试覆盖打卡、清算和关闭重开后积分保留 |

## 实现记录

- 家庭习惯 Module 新增打卡记录、清算记录、清算审阅和确认清算命令。
- `child-day` 返回当天适用任务的有效打卡次数和打卡记录标识。
- 清算审阅只计算进行中目标在业务日期当天安排的按日期目标任务。
- 完成任务按目标任务规则计一次完成积分；未完成按规则不得分或扣一次分。
- 确认清算时一次保存清算记录和全部目标积分，保存失败不更新内存状态。
- 模式版本升级为 4，旧目标和任务池数据迁移时补齐打卡与清算集合。
- ArkUI 增加孩子打卡/撤销入口和家长每日清算审阅/确认入口。

## 验证结果

```bash
node --import tsx --test --test-name-pattern='TASK-6' tests/domain/settlement.test.ts tests/arkui-entry-contract.test.ts
npm test
npm run typecheck
git diff --check
```

结果：

- `npm test`：38/38 通过。
- `npm run typecheck`：通过。
- `git diff --check`：通过。
- `TASK-6` 选择器全部通过。

## 未完成的外部验证

- GitHub 当前无法稳定连接，分支未能推送，未创建 PR。
- hvigor 构建失败于本机 DevEco SDK 环境：`DEVECO_SDK_HOME` 或 SDK 版本路径不匹配。
- TASK-6-DB01 已补充到设备测试代码，但未在真机或模拟器实跑。

## 审查记录

- code-review 子代理因额度限制未能完成。
- 主线程按 Standards / Spec 双轴复查：未发现本票范围内需修复问题。
- 标准轴：仍通过家庭习惯 Module 的 `openSession`、`execute`、`inspect` 暴露能力，未绕过领域模块访问数据；错误提示为中文。
- 规格轴：覆盖 #6 声明的 AC-13、AC-15、AC-16、AC-21、AC-26、AC-27、AC-29、AC-30、AC-32；未实现非目标范围。

## 关闭决定

用户确认先不创建 PR；本地实现、提交和可运行验证已完成，按任务完成处理，可关闭 #6。
