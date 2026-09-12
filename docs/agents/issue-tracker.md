# 事项管理：GitHub

事项和规格存放在 `Raymend-Zhong/HelloWorld` 的 GitHub Issues，
通过 `gh` CLI 操作。在仓库内执行命令时，从 Git 远程配置解析目标仓库。

## 常用操作

- 创建事项：`gh issue create --title "标题" --body-file <正文文件>`
- 读取事项及评论：`gh issue view <编号> --comments`
- 获取正文和标签：`gh issue view <编号> --json number,title,body,labels,comments`
- 列出事项：`gh issue list --state open --json number,title,body,labels`
- 添加评论：`gh issue comment <编号> --body-file <评论文件>`
- 添加标签：`gh issue edit <编号> --add-label "<标签>"`
- 移除标签：`gh issue edit <编号> --remove-label "<标签>"`
- 关闭事项：`gh issue close <编号>`

多行正文先写入临时文件，再通过 `--body-file` 传入。
标题、正文和评论使用中文。

技能要求“发布到事项管理系统”时，创建 GitHub Issue；
要求“获取相关任务”时，读取对应 Issue 及其评论和标签。

## 拉取请求

将 PR 作为需求入口：否。

GitHub Issues 和 PR 共用编号空间。编号类型不明确时，
先用 `gh pr view <编号>` 判断；确认不是 PR 后再读取 Issue。

## 任务导航约定

供使用任务导航流程的技能读取：

- 导航总览使用一个带 `wayfinder:map` 标签的 Issue，
  正文记录笔记、已有决策和待澄清问题。
- 子任务优先作为 GitHub 子事项关联到总览。
  不支持子事项时，在总览正文维护任务清单，
  并在子任务正文开头注明“所属总览：#<编号>”。
- 子任务类型标签为 `wayfinder:research`、
  `wayfinder:prototype`、`wayfinder:grilling` 或 `wayfinder:task`。
- 阻塞关系优先使用 GitHub 原生事项依赖。
  不支持时，在子任务正文开头记录“阻塞于：#<编号>”。
  所有阻塞事项关闭后，该任务才可开始。
- 选择下一任务时，按总览顺序选取首个未关闭、
  无未完成阻塞事项且无人认领的子任务。
- 认领任务：`gh issue edit <编号> --add-assignee @me`。
- 完成任务后，评论记录结果、关闭事项，
  并将结论摘要和链接补充到总览的已有决策中。
