# 成长打卡

面向果果和阳阳的 HarmonyOS 本地习惯打卡积分应用。第一版采用 ArkTS、ArkUI Stage 模型和 ArkData 关系型数据库，目标设备为华为 MatePad 11.5（HarmonyOS 6.1 / API 23）。

## 当前切片

TASK-3 提供以下能力：

- 固定的果果、阳阳两个孩子入口；
- 孩子免密码进入并在两个账套间切换；
- 页面持续标识当前孩子；
- 首次设置家长密码，后续凭密码进入家长端；
- 孩子会话调用家长命令时由领域模块拒绝；
- ArkData 本地持久化和带随机盐的密码摘要。

TASK-4 增加以下能力：

- 初中、幼儿园各五项基础学习与生活任务模板；
- 家长按孩子复制模板，独立编辑名称、描述和默认计分配置；
- 家长停用任务后保留原任务标识、内容和规则；
- 孩子端可查看所属任务池，切换孩子后数据随之切换；
- 模式 1 原地升级为模式 2，模板种子升级不覆盖已复制任务；
- 并发命令串行保存，失败返回中文提示且保持原状态。

后续任务将加入目标、打卡、清算和虚拟养成。经确认，AC-08 中的历史目标引用展示及禁止新目标引用由目标创建任务完成。

详细切片、测试选择器和验证限制见 [TASK-4 实施与验收](docs/implementation/TASK-4-实施与验收.md)。

## 本地验证

```bash
npm install
npm test
npm run typecheck
```

HarmonyOS 工程需要安装带 HarmonyOS 6.1 SDK 的 DevEco Studio。用 DevEco Studio 打开仓库，配置调试签名后，可在模拟器或 MatePad 真机运行 `entry` 模块。当前自动化选择器包括：`entry-guoguo`、`entry-yangyang`、`entry-parent`、`child-current-name`、`switch-guoguo`、`switch-yangyang`、`parent-password-input`、`parent-submit` 和 `parent-screen`。
