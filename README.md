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

后续任务将加入任务池、目标、打卡、清算和虚拟养成。

## 本地验证

```bash
npm install
npm test
npm run typecheck
```

HarmonyOS 工程需要安装带 HarmonyOS 6.1 SDK 的 DevEco Studio。用 DevEco Studio 打开仓库，配置调试签名后，可在模拟器或 MatePad 真机运行 `entry` 模块。当前自动化选择器包括：`entry-guoguo`、`entry-yangyang`、`entry-parent`、`child-current-name`、`switch-guoguo`、`switch-yangyang`、`parent-password-input`、`parent-submit` 和 `parent-screen`。
