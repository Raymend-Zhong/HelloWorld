# 华为 MatePad 优先运行的轻量化技术架构调研

> **状态：已采纳。** 第一版技术形态已经确认，正式决定见 `docs/adr/0002-采用HarmonyOS原生本地优先架构.md`。

## 一、调研说明

- 调研问题：家庭儿童打卡积分系统未来主要在一台华为 MatePad 11.5 上运行，操作系统为 HarmonyOS 6.1.0；应选择网页、HarmonyOS 原生应用还是混合应用，以及是否需要服务端、数据库和中间件。
- 决策用途：为下一阶段架构决策记录和实施规格提供依据。
- 调研日期：2026-09-12。
- 资料范围：华为消费者官网、华为开发者官方文档、W3C 标准、Capacitor 与 Tauri 官方文档或官方源码仓库。
- 业务依据：`CONTEXT.md`、`docs/prd/prd.md`、`docs/prd/clarifications.md`。
- 与已有调研的关系：`docs/research/轻量化技术架构.md` 面向本地与在线、多设备同步的通用场景；本文根据“主要在一台 HarmonyOS 平板上使用”的新前提重新取舍。

本文用以下标记区分结论性质：

- **【用户输入】**：用户提供、本文没有独立验证的设备或使用信息。
- **【事实】**：来源直接陈述或可由官方资料直接验证。
- **【推断】**：由事实结合本项目场景推导。
- **【建议】**：面向本项目的架构取舍。

## 二、结论先行

**【建议】第一版采用 HarmonyOS 原生、单设备、本地优先架构：ArkTS + ArkUI（Stage 模型）+ ArkData 关系型数据库。应用和数据库都运行在 MatePad 上，不部署 Node.js 服务，不使用 Redis、消息队列、反向代理或云数据库。**

推荐拓扑如下：

```text
华为 MatePad 11.5
└── HarmonyOS 原生应用（单 HAP、单进程）
    ├── ArkUI：孩子端、家长端、清算动画、音效
    ├── ArkTS：领域规则与应用服务
    ├── ArkData relationalStore：唯一权威业务数据
    ├── Preferences：少量界面和设备设置
    ├── Core File Kit：JSON 备份导出与恢复导入
    └── BackupExtensionAbility：系统换机备份恢复（增强项）
```

这样选择的主要原因是：

1. **【推断】单台固定平板没有跨设备同步需求，服务端不会增加用户价值，反而增加部署、网络、鉴权、备份和故障排查成本。**
2. **【事实】HarmonyOS 原生关系型数据库由 SQLite 组件提供，支持增删改查、SQL 和事务，平板从 API version 12 起可用；目标系统远高于该下限。**[华为：关系型数据库 API](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/arkts-apis-data-relationalstore)
3. **【推断】本项目的清算、撤销清算、连续奖励和修订历史需要事务，本地关系型数据库比浏览器存储更直接。**
4. **【事实】HarmonyOS 提供应用数据备份恢复扩展能力，也提供文件选择器保存和选择文档；原生方案可以同时实现系统迁移和用户可见的手工备份。**[华为：应用接入数据备份恢复](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-file-backup-extension)、[华为：文件选择器](https://developer.huawei.com/consumer/en/doc/harmonyos-references/js-apis-file-picker)
5. **【限制】HarmonyOS 6.1 平板上华为浏览器对 PWA、Service Worker、IndexedDB 的完整支持组合，没有找到华为官方逐项兼容声明。纯网页可以做，但必须先通过目标真机验证，不能把浏览器离线数据可靠性视作已确认事实。**

如果未来明确要求手机、电脑和平板共享同一份实时数据，再引入通用调研中的 SvelteKit + Node.js + SQLite 服务端；原生应用通过 HTTPS JSON API 同步。第一版不为这个尚未确认的场景提前承担服务端成本。

## 三、目标设备和版本基线

### 3.1 可确认内容

- **【用户输入】** 主要设备是华为 MatePad 11.5，系统显示版本为 HarmonyOS 6.1.0。
- **【事实】** 华为官网存在“HUAWEI MatePad 11.5 2026”产品页，部分功能注明平板需升级到 HarmonyOS 6.1.0.125SP11 及以上。[华为：HUAWEI MatePad 11.5 2026](https://consumer.huawei.com/cn/tablets/matepad-11-5-2026/)
- **【事实】** HarmonyOS 开发套件将 6.1.0 对应为 API 23；截至调研日官方版本导航同时列出 6.1.1（API 24）和更新的 26.0.0。[华为：HarmonyOS 开发套件版本](https://developer.huawei.com/consumer/cn/doc/harmonyos-releases/changelogs-600)

### 3.2 不能由公开信息确认的内容

- **【限制】** “MatePad 11.5”有不同年份和地区版本。用户没有提供完整型号或版本号，因此不能仅凭名称确认它是否就是 2026 款。
- **【限制】** 消费者页面的系统版本号与开发套件 API 版本是两个维度。实施时必须连接实机，在系统信息和 DevEco Studio 中确认设备实际 API level。
- **【建议】** 项目以 `compatibleSdkVersion` 覆盖实机 API 为硬条件，`compileSdkVersion` 和 `targetSdkVersion` 使用当时稳定开发套件；不为了使用最新 API 抬高最低兼容版本。本项目所需的 ArkUI、关系型数据库和文件选择器均已有较低 API 版本可用，无需依赖 API 23 的新特性。

## 四、三类方案比较

| 维度 | 纯网页 / PWA | HarmonyOS 原生应用 | ArkWeb 混合应用 |
| --- | --- | --- | --- |
| 平板日常入口 | 浏览器书签或桌面快捷方式 | 标准应用图标，可选服务卡片 | 标准应用图标 |
| 断网启动 | 依赖 Service Worker 和浏览器缓存 | 应用资源随 HAP 安装，天然可离线启动 | 本地 H5 可离线，仍需原生壳 |
| 权威数据 | IndexedDB | ArkData 关系型数据库 | IndexedDB 或原生数据库，需桥接 |
| 数据事务 | IndexedDB 事务，领域 SQL 不可直接复用 | 原生关系型事务和 SQL | 取决于存储位置，跨层调用更复杂 |
| 数据清理风险 | 受浏览器站点数据管理影响 | 由应用沙箱管理；卸载或清除应用数据会删除 | 同时面对站点数据和应用沙箱规则 |
| 安装更新 | 部署 HTTPS 后刷新即可更新 | HAP 必须签名；调试安装或应用市场更新 | 与原生应用相同 |
| 开发技能 | Web/TypeScript/CSS | ArkTS/ArkUI/DevEco Studio | Web + ArkTS + ArkWeb 桥接 |
| 跨平台复用 | 最好 | 最弱 | 中等 |
| 单设备运行维护 | 需要持续托管，或接受纯本地浏览器限制 | **最低：安装后不依赖服务器** | 低，但代码和调试层次更多 |
| 本项目第一版 | 可做验证原型或跨平台备选 | **推荐** | 不推荐 |

## 五、推荐方案：HarmonyOS 原生本地应用

### 5.1 应用层

- **【事实】** ArkTS 是 HarmonyOS 应用开发的官方高级语言，在 TypeScript 生态基础上扩展；华为官方建议 HarmonyOS 应用优先选择 ArkTS。[华为：ArkTS 开发入门](https://developer.huawei.com/consumer/cn/arkts/devstart/)、[华为：应用设计与开发](https://developer.huawei.com/consumer/cn/app/planning)
- **【事实】** ArkTS 运行时是 HarmonyOS 默认语言运行时，可运行 ArkTS、TS 和 JS 字节码。[华为：ArkTS 运行时概述](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/arkts-runtime-overview)
- **【事实】** Stage 模型是官方主推且长期演进的应用模型，UIAbility 负责有界面的用户交互。[华为：Stage 模型开发概述](https://developer.huawei.com/consumer/cn/arkui/arkui-stage)
- **【建议】** 使用一个 Entry HAP、一个 UIAbility、单进程。按孩子端、家长端、任务、目标、打卡、清算、虚拟养成、备份划分代码模块，但不拆 HSP、微服务或独立进程。
- **【建议】** 家长端和孩子端共用同一应用，通过入口选择与家长密码切换。固定一台家庭平板时，无需系统级多账户或远端身份服务。

### 5.2 界面层

- **【事实】** ArkUI 是 HarmonyOS 的声明式 UI 框架，ArkTS 与 ArkUI 结合提供声明式界面、状态管理和渲染控制。[华为：ArkUI](https://developer.huawei.com/consumer/cn/arkui/)、[华为：ArkTS](https://developer.huawei.com/consumer/cn/arkts/)
- **【事实】** 华为官方平板设计指南要求处理横竖屏、分屏、字体变化和安全区，建议使用断点、栅格、自适应及响应式布局，避免固定像素布局。[华为：布局基础](https://developer.huawei.com/consumer/cn/doc/doccenter-ux-design/design-layout-basics-0000001795579413)
- **【建议】** 第一版专注 11.5 英寸平板，仍同时验收横屏、竖屏和分屏。主要操作按钮的触控区域按平板触控设计；孩子端用大按钮和明确头像，家长端可采用双栏布局。
- **【建议】** 虚拟小猫、小树和老师反馈先使用 ArkUI 动画、序列帧或轻量矢量资源；音效使用内置短音频。无需游戏引擎、3D 引擎或视频播放器。
- **【建议】** 可以在后续添加一张桌面服务卡片，显示今日待完成数并跳入应用。卡片只是快捷入口，不承载清算和配置主流程。华为官方说明服务卡片可展示重要信息并实现轻量交互，Tablet 支持 ArkTS 卡片。[华为：创建服务卡片](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/ide-service-widget)

### 5.3 数据层

- **【事实】** `relationalStore` 基于 SQLite 提供本地关系型数据库，支持 SQL、结果集和事务；官方接口明确支持 Tablet，起始 API version 12。[华为：关系型数据库 API](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/arkts-apis-data-relationalstore)
- **【事实】** HarmonyOS 官方存储选型说明指出，Preferences 适合应用配置信息，会把文本数据全量加载到内存，不适合大量数据；关系型数据库适合有关联关系的业务数据。[华为：数据存储方案如何选择](https://developer.huawei.com/consumer/cn/doc/doccenter-dev-faq/faqs-local-database-management-38)
- **【建议】** 业务数据全部放入一个本地关系型数据库；Preferences 只保存当前孩子、主题、音效开关等少量设置。
- **【建议】** 数据库是唯一权威数据源，不再维护浏览器 IndexedDB 副本或同步队列。积分和成长进度均由数据库事实记录计算，界面状态不充当业务记录。
- **【建议】** 每次每日清算在一个事务内完成：读取当日打卡与规则快照、计算任务积分和连续奖励、写入清算版本及明细、更新目标积分和历史最高积分、判断目标状态。任何一步失败则整体回滚。
- **【建议】** 撤销清算通过新增修订版本和反向记录实现，不物理删除历史；重新计算受影响日期之后的连续状态。
- **【限制】** 官方建议单条关系型数据不超过 2 MB，单次查询不超过 5000 条；本项目的普通结构化记录远低于此限制，图片、动画和音效应作为应用资源或文件保存，不写入单条数据库记录。[华为：关系型数据库 API](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/api/arkts-apis-data-relationalstore)

建议的数据模块至少包括：

| 数据组 | 主要记录 |
| --- | --- |
| 孩子账套 | 孩子、昵称、头像、主题 |
| 任务池 | 任务、默认积分、未完成规则、停用状态 |
| 目标 | 目标、奖励、计划时长、状态、积分、历史最高积分、虚拟养成类型 |
| 目标任务 | 规则快照、计划、连续奖励开关及上限 |
| 打卡 | 业务日期、任务发生项、完成或撤销、操作时间 |
| 清算 | 清算批次、版本、奖扣明细、规则快照、撤销关系 |
| 数据库元信息 | 模式版本、应用数据版本 |

### 5.4 家长密码

- **【建议】** 第一版不需要账号服务。首次使用时在本机设置一个家长密码，数据库只保存带随机盐的密码派生结果，不保存明文。
- **【建议】** 家长验证状态只在短期会话内有效；退出家长端或应用进入后台较长时间后重新验证。
- **【推断】** 固定家庭平板上的本地密码主要用于防止孩子误入配置和清算页面，并不是对拥有设备控制权的攻击者建立高强度安全边界。

### 5.5 备份、恢复与换机

- **【事实】** HarmonyOS 卸载应用时会清除全部应用沙箱目录数据；公共目录文件对用户可见、可管理，并且不会随应用卸载删除。[华为：存储空间与文件生命周期](https://developer.huawei.com/consumer/cn/doc/doccenter-architecture/storage-usage-file-lifecycle)
- **【事实】** `BackupExtensionAbility` 允许应用定制系统备份和恢复行为；官方提供 HarmonyOS 6.0.0.115 及以上设备通过“数据克隆”验证应用数据迁移的流程。[华为：应用接入数据备份恢复](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-file-backup-extension)、[华为：备份恢复验证指导](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/app-file-backup-dataclone)
- **【事实】** 文件选择器的 `DocumentViewPicker` 可在 UIAbility 中选择或保存文档，Tablet 受支持。[华为：文件选择器](https://developer.huawei.com/consumer/en/doc/harmonyos-references/js-apis-file-picker)
- **【建议】** 第一版必须提供“导出家庭数据”和“从备份恢复”：把数据库内容导出为带模式版本、校验值和导出时间的 JSON 文件，通过文件选择器保存到用户选择的位置；恢复前先校验格式并自动备份当前数据。
- **【建议】** 系统备份恢复作为第二层保护接入，但不能代替手工导出。家长端首页显示最近备份时间，避免应用卸载或设备故障后才发现没有独立副本。
- **【建议】** 每次数据库模式升级都先创建内部备份，再在事务中执行迁移。发布版本不得自动丢弃无法识别的字段或历史记录。

### 5.6 安装和更新

- **【事实】** HarmonyOS 只有签名过的 HAP 才允许安装；调试可使用 DevEco Studio 自动签名。[华为：自动签名](https://developer.huawei.com/consumer/cn/doc/HarmonyOS-Guides/ide-signing-auto)
- **【事实】** 开发者可通过调试命令安装应用；面向普通终端用户，可上架应用市场后安装。更新需要提高 `versionCode` 并重新打包发布，应用市场或应用内检测可提示更新。[华为：应用安装、卸载与更新](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/application-package-install-uninstall)
- **【建议】** 家庭自用阶段使用 DevEco Studio 将签名 HAP 安装到这台平板，保管好签名材料；每次升级前导出备份。若以后希望无需连接开发电脑更新，再评估 AppGallery 发布。
- **【限制】** 原生方案的主要维护成本在开发侧：需要 DevEco Studio、HarmonyOS SDK、签名和真机调试。用户侧安装完成后不需要启动本地服务器，也不依赖公网。

## 六、为什么第一版不优先选择纯网页 / PWA

### 6.1 网页方案能够做到什么

- **【事实】** IndexedDB 标准定义了浏览器端的事务型键值数据库，面向 Web 应用离线保存大量对象的场景。[W3C：Indexed Database API 3.0](https://www.w3.org/TR/IndexedDB/)
- **【事实】** Service Worker 可拦截网络请求并支持离线资源，但规范要求 Service Worker 及其客户端位于安全上下文，常规部署意味着 HTTPS。[W3C：Service Workers](https://www.w3.org/TR/service-workers/)
- **【事实】** Web App Manifest 可声明应用名称、图标、启动地址、显示模式和屏幕方向，使浏览器有条件提供接近原生应用的启动体验；规范也明确具体用户代理可能要求额外条件。[W3C：Web Application Manifest](https://www.w3.org/TR/appmanifest/)
- **【事实】** 华为浏览器官方支持页面说明，手机和平板可以把网站添加到桌面；它还解释了某些 PWA 会通过快应用创建快捷方式。但该页面列出的适用系统最高到 HarmonyOS 4.3，没有列出 HarmonyOS 6.1。[华为：浏览器添加网站至桌面](https://consumer.huawei.com/cn/support/content/zh-cn00448896/)

### 6.2 在目标设备上的未确认项

- **【限制】** 没有找到华为官方针对 HarmonyOS 6.1 平板浏览器发布的 Web API 兼容矩阵，无法仅凭标准判断该浏览器是否完整支持 Service Worker、IndexedDB、Web App Manifest、持久存储请求及全部生命周期行为。
- **【限制】** “添加到桌面”可能只是网页快捷方式，也可能由快应用承载；官方页面明确表示路径和表现因系统、网页及设备而异。
- **【推断】** 如果把唯一业务数据放在浏览器站点存储中，清理浏览器数据、站点来源变化或浏览器升级行为都可能影响数据。即使真机测试通过，也仍需手工导出备份。
- **【推断】** 若网页部署在公网，开发和更新很方便，但断网首次启动、证书、域名和托管成为额外依赖；若直接双击本地 HTML，则不能可靠获得 Service Worker 运行所需的安全来源。

### 6.3 何时改选网页

满足以下条件时，可把网页方案提升为首选：

1. 已确认短期内需要 HarmonyOS 平板、手机和电脑同时使用；
2. 团队只具备成熟 Web 技术经验，原生学习成本会明显拖慢交付；
3. 可以接受 HTTPS 在线托管，或只把浏览器本地数据视为可恢复缓存；
4. 已在目标 MatePad 真机上完成离线启动、IndexedDB 持久化、清理策略、桌面入口、横竖屏和系统升级回归测试。

若选择网页，建议复用既有调研结论：Svelte 5 + SvelteKit 2 的响应式 PWA；单设备版使用 IndexedDB + Dexie，且强制 JSON 导入导出。需要多设备同步时再增加 Node.js 24 LTS + SQLite 服务端。**不建议让 Node.js 服务直接运行在 MatePad 上。**

## 七、为什么不选择 ArkWeb 混合方案

- **【事实】** HarmonyOS 内置 ArkWeb，Web 组件可在原生应用中显示网页，官方把“复用 Web 页面、降低开发和运维成本”列为适用场景。[华为：ArkWeb 简介](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/web-component-overview)
- **【事实】** ArkUI 官方也把 Web 组件列为承载 HTML5/Web 内容的能力。[华为：ArkUI](https://developer.huawei.com/consumer/cn/arkui/)
- **【推断】** 本项目没有既有网页代码可复用，也没有必须动态加载的远端页面。使用 ArkWeb 会同时引入 ArkTS 原生壳、Web 前端、JS 与原生通信、两套状态生命周期和两套调试工具。
- **【推断】** 如果业务数据放 IndexedDB，仍保留浏览器存储边界；如果放关系型数据库，则每次数据访问需要桥接，复杂度高于纯原生。
- **【建议】** 第一版不采用混合架构。只有在已有成熟 Web 界面需要移植，或未来网页端与 HarmonyOS 端必须复用绝大多数页面时再评估。

### 7.1 不采用 Capacitor 或 Tauri 作为捷径

- **【事实】** Capacitor 8 官方首页和文档提供的一等平台是 iOS、Android 和 Web，官方原生插件示例使用 Swift 与 Java/Kotlin；官方安装命令只列出 `@capacitor/ios` 和 `@capacitor/android`，没有 HarmonyOS 平台包。[Capacitor 官方文档](https://capacitorjs.com/docs)、[Capacitor 官方首页](https://capacitorjs.com/)
- **【事实】** Tauri 2 官方前置条件列出的桌面平台为 Linux、macOS、Windows，移动平台为 Android、iOS；官方配置文件也只列出这些平台，没有稳定版 HarmonyOS 目标。[Tauri：前置条件](https://v2.tauri.app/start/prerequisites/)、[Tauri：配置参考](https://v2.tauri.app/reference/config/)
- **【事实】** Tauri 官方仓库中 HarmonyOS/OpenHarmony 支持仍体现在功能请求和实验分支问题中；2026 年的相关问题使用 `feat/open-harmony` 分支并报告启动白屏，不属于稳定发布路径。[Tauri 官方仓库：OpenHarmony 白屏问题](https://github.com/tauri-apps/tauri/issues/15236)、[Tauri 官方仓库：HarmonyOS 功能请求](https://github.com/tauri-apps/tauri/issues/8375)
- **【建议】** 不以社区适配层或实验分支作为家庭数据应用的基础。它们没有比直接 ArkTS + ArkUI 更低的实际维护风险。

## 八、快应用和元服务的判断

- **【事实】** 华为快应用官方页面把支持平台标为 Android，并以快应用行业规范和快应用 IDE 为开发方式。[华为：快应用](https://developer.huawei.com/consumer/cn/quickApp/)
- **【建议】** 不把快应用作为 HarmonyOS 6.1 原生应用替代方案。
- **【事实】** HarmonyOS 元服务可以使用 ArkTS，并提供专用 Web 组件；其分发和包体规则不同于普通应用。[华为：元服务 Web 组件](https://developer.huawei.com/consumer/cn/doc/doccenter-atomic-service/atomicserviceweb-guidelines)、[华为：打包工具](https://developer.huawei.com/consumer/cn/doc/doccenter-capabilities/packing-tool)
- **【推断】** 本项目是固定家庭、固定设备、长期保存本地记录的完整应用，不需要元服务的免安装分发和场景化流量入口。普通 HarmonyOS 应用的安装、数据生命周期和备份边界更直观。
- **【建议】** 第一版使用普通 HarmonyOS 应用，不使用快应用或元服务。

## 九、未来联网扩展路径

**【建议】保持本地优先模型，但在代码边界上为同步留出口，不在第一版实现同步。**

1. 领域层只接收明确命令，例如“提交打卡”“清算日期”“撤销清算”，不让界面直接拼 SQL。
2. 每个核心实体使用稳定 UUID；所有打卡和清算记录包含家庭时区、业务日期、创建时间和修订版本。
3. 数据库迁移和 JSON 备份使用显式 `schemaVersion`。
4. 若未来联网，把本地数据库继续作为设备端副本，增加操作 outbox 和 HTTPS 同步适配器。
5. 服务端沿用已有调研推荐的模块化单体 Node.js + SQLite；只有出现多实例写入或多家庭规模后再评估 PostgreSQL。
6. HarmonyOS 原生界面无需重写，数据仓储接口由“仅本地”扩展为“本地提交 + 后台同步”。

此路径避免第一版部署服务端，也避免将来把领域规则完全绑死在页面组件中。

## 十、第一版明确不需要的组件

- 服务端运行时和家庭局域网服务器；
- Redis、消息队列、任务调度平台、API 网关；
- PostgreSQL、MySQL、云数据库；
- Docker、Kubernetes、Caddy 或 Nginx；
- Capacitor、Tauri、Electron 类跨平台容器；
- ArkWeb、双向 JavaScript 桥接；
- 分布式数据库和端云同步；
- 游戏引擎、3D 引擎、视频动画管线；
- 独立身份服务、短信登录和第三方账号系统。

## 十一、实施前验证清单

以下验证会影响工程配置，但不改变本文的首选架构：

1. 在目标平板“关于本机”记录完整产品型号、HarmonyOS 构建号和可用存储空间。
2. DevEco Studio 连接实机，确认设备 API level，以及调试签名和 HAP 安装路径。
3. 创建最小 ArkTS/ArkUI Stage 工程，在横屏、竖屏和分屏下运行。
4. 用 `relationalStore` 验证建库、事务提交、事务回滚、应用重启后数据保留和模式升级。
5. 验证家长密码锁、应用退到后台后的重新验证时机。
6. 通过 `DocumentViewPicker` 导出 JSON，再卸载并重装测试恢复；这一步会验证卸载数据清除后的灾难恢复能力。
7. 如接入系统备份，使用官方数据克隆流程在兼容设备间验证 `BackupExtensionAbility`。
8. 在正式升级 HAP 前检查签名一致性，并验证旧数据库可原地迁移。

## 十二、决策摘要

| 决策项 | 建议 |
| --- | --- |
| 产品形态 | 普通 HarmonyOS 原生应用 |
| 语言与 UI | ArkTS + ArkUI，Stage 模型 |
| 应用结构 | 单 HAP、单 UIAbility、模块化单体 |
| 业务数据库 | ArkData `relationalStore`，单个本地关系型数据库 |
| 简单设置 | Preferences |
| 服务端 | 第一版不需要 |
| 中间件 | 第一版不需要 |
| 离线能力 | 所有核心流程本地完成，默认断网可用 |
| 备份 | JSON 手工导入导出为必需；系统备份恢复为增强项 |
| 安装 | 家庭自用先由 DevEco Studio 签名安装；大众分发再上架 |
| 网页/PWA | 跨平台需求明确后再选；HarmonyOS 6.1 兼容性必须真机验证 |
| 混合框架 | 不采用 ArkWeb、Capacitor、Tauri |
| 未来多设备 | 增加 HTTPS 同步层和轻量单体服务，不重写领域模型 |

最终取舍是：**面向一台确定的 HarmonyOS 平板，轻量化应以“用户侧没有服务器、没有网络依赖、数据可备份恢复”为核心。原生 ArkTS + ArkUI + 本地关系型数据库比纯网页更符合这个运行前提。**
