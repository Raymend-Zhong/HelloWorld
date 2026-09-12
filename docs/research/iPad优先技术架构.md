# 儿童习惯打卡平台 iPad 优先技术架构调研

> **状态：已被取代。** 目标设备后来确认为华为 MatePad 11.5，本调研不再作为架构依据。当前决定见 `docs/research/HarmonyOS平板优先技术架构.md` 和 `docs/adr/0002-采用HarmonyOS原生本地优先架构.md`。

## 一、调研说明

- 调研问题：打卡平台主要在 iPad 上使用时，应采用普通网页、主屏幕 Web App、Capacitor 封装还是原生 SwiftUI，以及是否需要调整既有轻量化架构。
- 决策用途：为系统架构 ADR 和实施规格提供依据。
- 调研日期：2026-09-12。
- 平台范围：重点评估 iPadOS 17 及以上，兼顾 iPadOS 26；更早版本只作为降级兼容对象。
- 业务依据：`CONTEXT.md`、`docs/prd/prd.md`、`docs/prd/clarifications.md` 和 `docs/research/轻量化技术架构.md`。
- 资料范围：Apple Developer、WebKit、W3C、Node.js、SvelteKit、Capacitor 官方文档与官方源码仓库。
- 本文只进行架构调研，不修改业务需求或业务代码。

本文用以下标记区分结论性质：

- **【事实】**：来源直接陈述或能由官方资料直接验证。
- **【推断】**：由平台事实结合本项目使用场景推导。
- **【建议】**：面向本项目的架构选择。
- **【限制】**：方案存在且需要在设计中明确接受的边界。

## 二、结论先行

**【建议】** 第一版仍采用既有的 `SvelteKit 2 + Svelte 5 + Node.js 24 LTS + SQLite + IndexedDB/Dexie + Service Worker` 架构，不因为主要设备变成 iPad 而改用 Capacitor 或 SwiftUI。

需要对既有方案做的调整是：

1. 将 iPad 上的首选入口明确为“添加到主屏幕”的 Web App，而不是长期使用 Safari 普通标签页。
2. 将 iPadOS 17 设为推荐最低版本，以获得 WebKit 完整的 Storage API；使用功能检测兼容更早版本。
3. 离线操作写入 IndexedDB，但不把 IndexedDB 当作唯一权威数据源；联网后由 SQLite 服务端统一接收、清算和留存历史。
4. 不依赖 Background Sync。同步由应用启动、回到前台、网络恢复、打卡后和清算前主动触发。
5. 在线部署优先使用 HTTPS。若服务器放在家庭局域网，iPad 也必须通过受信任的 HTTPS 地址访问，不能把普通局域网 HTTP 当作完整 PWA 运行环境。
6. Node.js 和 SQLite 运行在在线主机、家庭常开电脑或小型服务器上，不运行在 iPad 上。

**【推断】** 该方案保留了网页开发和发布的低维护成本，同时给 iPad 提供接近应用的主屏幕入口、离线启动和触控体验。项目只有一个家庭、两个孩子，不需要为 App Store 分发、原生后台任务或复杂设备能力承担原生工程维护成本。

## 三、iPad 使用场景带来的约束

### 3.1 主要交互特点

- 孩子会在 iPad 上频繁查看任务并点击完成，按钮必须适合触控。
- 家长会在同一台或另一台设备上管理目标、核对打卡并清算。
- 老师总结、虚拟养成、鼓励和惩罚反馈依赖流畅动画和简短音效。
- 断网时仍要能打开已缓存页面、查看当天任务、打卡和撤销；联网后再同步。
- 系统未来可能通过手机或电脑访问，因此不应只为 iPad 维护一套独立业务实现。

**【事实】** Apple 建议触控控件至少为 44 × 44 点，并要求页面适应屏幕而不横向滚动；iPad 的主要输入包括触控、Apple Pencil 和 Magic Keyboard。[Apple：界面设计注意事项](https://developer.apple.com/design/tips/)、[Apple：界面基础](https://developer.apple.com/documentation/technologyoverviews/interface-fundamentals)

**【建议】** 界面采用响应式布局，首要优化横屏与竖屏 iPad；手机和桌面保持同一组件体系。核心打卡按钮实际可点击区域至少按 44 × 44 CSS 像素设计，阳阳端宜进一步放大。

### 3.2 iPad 不是 Node.js 服务主机

**【事实】** Node.js 官方支持平台列表包含 GNU/Linux、Windows、macOS、AIX、FreeBSD 等，不包含 iOS 或 iPadOS；官方二进制平台也没有 iPadOS。[Node.js：支持平台](https://github.com/nodejs/node/blob/main/BUILDING.md#platform-list)

**【推断】** 不能把“本地部署”理解成在 iPad 上直接启动既有 SvelteKit Node 服务和 SQLite 文件。iPad 应作为客户端；服务端要运行在在线主机、Mac、Linux 小型主机或家庭 NAS 可支持的运行环境中。

**【限制】** iPad 访问 `localhost` 指向 iPad 自身，不会指向家庭电脑。家庭电脑上的服务需要一个 iPad 可访问的局域网或公网地址。

## 四、iPadOS Web 能力核对

### 4.1 添加到主屏幕与独立窗口

**【事实】** 在 iOS 和 iPadOS 16.4 中，带有 Web App Manifest 且 `display` 为 `standalone` 或 `fullscreen` 的站点，从主屏幕启动时会作为独立 Web App 打开，并在应用切换器中与 Safari 分开显示。[WebKit：iOS 和 iPadOS 主屏幕 Web App](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

**【事实】** iOS 和 iPadOS 26 默认把任何添加到主屏幕的网站作为 Web App 打开，用户可以关闭“作为 Web App 打开”；WebKit 同时明确说明 Manifest 仍能提供名称、图标等能力。[WebKit：Safari 26.0 的 Web App 变化](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#every-site-can-be-a-web-app-on-ios-and-ipados)

**【事实】** W3C Web App Manifest 定义 `name`、`icons`、`start_url`、`scope`、`display`、`theme_color` 等元数据；`standalone` 会隐藏标准浏览器地址栏，但仍可保留系统状态栏等界面。[W3C：Web Application Manifest](https://www.w3.org/TR/appmanifest/)

**【建议】** 即使目标 iPad 已升级到 iPadOS 26，仍应提供标准 Manifest、`apple-touch-icon`、稳定的 `id`、`start_url`、`scope`、主题色及 `display: standalone`。这样可以兼容 iPadOS 17 至 18，并保证图标与启动行为可控。

### 4.2 Service Worker 与离线启动

**【事实】** WebKit 从 iOS 11.3 起支持 Service Worker；其 Cache API 可持久保存请求和响应，官方将离线支持和网络缓存列为主要用途。Service Worker 在没有客户端后通常会被终止，并在发生 `fetch`、`postMessage` 等交互时重新启动。[WebKit：Workers at Your Service](https://webkit.org/blog/8090/workers-at-your-service/)

**【事实】** SvelteKit 会在存在 `src/service-worker.js` 或 `src/service-worker/index.js` 时打包并自动注册 Service Worker，并提供构建资源、静态资源和应用版本清单；官方示例可以预缓存应用资源，并在网络失败时回退到缓存。[SvelteKit：Service workers](https://svelte.dev/docs/kit/service-workers)

**【推断】** 只要 iPad 曾成功在线加载并缓存当前应用版本，主屏幕 Web App 可以在断网时打开应用壳、内置动画和音效，并从 IndexedDB 读取最近同步的当天任务。

**【限制】** 首次打开、缓存尚未完成、缓存被清除或应用升级资源不完整时，不能保证离线启动成功。界面需要显示“离线可用资源已准备好”状态，不能只以 Service Worker 已注册作为完成依据。

### 4.3 IndexedDB、存储持久性与系统清理

**【事实】** WebKit 的网站存储政策覆盖 IndexedDB、Cache API、Service Worker 和文件系统。自 Safari 17、iOS 17 和 iPadOS 17 起，浏览器应用的单来源配额最高可到磁盘空间的 60%，主屏幕 Web App 使用与浏览器应用相同的来源和总体配额。[WebKit：Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)

**【事实】** WebKit 默认采用尽力而为存储；在总体配额不足、系统存储压力或站点长期未使用时，数据可能按来源整体清理。页面可以通过 `navigator.storage.persist()` 请求持久模式，但 WebKit 根据启发式规则决定是否批准，是否作为主屏幕 Web App 打开是考虑因素之一。[WebKit：Storage Eviction 与 Storage API](https://webkit.org/blog/14403/updates-to-storage-policy/#storage-eviction)

**【事实】** Safari 17、iOS 17 和 iPadOS 17 起完整支持 Storage API，可用 `estimate()` 查询估算用量与配额，用 `persisted()` 检查持久状态并用 `persist()` 请求持久化；配额只是上限，写入仍需处理 `QuotaExceededError`。[WebKit：Storage API](https://webkit.org/blog/14403/updates-to-storage-policy/#storage-api)

**【建议】** iPad 端使用 IndexedDB/Dexie 保存：

- 最近同步的孩子资料、进行中目标和当天任务快照；
- 未同步的完成与撤销操作；
- 设备 ID、同步游标和资源版本；
- 仅用于展示的最近清算结果。

**【建议】** 首次稳定使用后请求持久存储，并在设置页显示“浏览器存储是否持久”“待同步操作数量”“最后同步时间”。即使持久请求成功，仍把 SQLite 和离机备份作为恢复依据。

### 4.4 后台执行与 Background Sync

**【事实】** WebKit 的 Service Worker 会在没有客户端后经过短暂宽限期终止，不是常驻后台进程。[WebKit：Service Worker 生命周期](https://webkit.org/blog/8090/workers-at-your-service/)

**【事实】** 截至调研日，WebKit 的 Background Sync API 功能请求仍处于 `NEW`、无人负责状态；问题描述明确指出 Safari on iOS 不能在页面关闭后依靠该 API恢复同步。[WebKit Bug 201866：Background Sync API](https://bugs.webkit.org/show_bug.cgi?id=201866)

**【推断】** iPad 主屏幕 Web App 退到后台或被系统挂起后，不能保证普通 JavaScript 或自定义同步循环继续运行。把“恢复网络后自动同步”设计成必然的后台行为会产生错误承诺。

**【建议】** 第一版采用前台可靠同步：

1. 用户打卡后立即尝试上传，失败则留在 IndexedDB outbox。
2. 应用启动、恢复可见、收到 `online` 事件和切换孩子账套时触发同步。
3. 家长进入清算页时强制同步并检查是否仍有待上传操作。
4. 应用保持前台时可做短间隔重试，但不要求用户一直打开页面。
5. 所有操作以 `operationId` 幂等写入服务端，重复上传不重复计分。

### 4.5 Web Push 与提醒

**【事实】** iOS 和 iPadOS 16.4 起，Web Push 只面向添加到主屏幕的 Web App。权限请求必须由用户直接操作触发；通知由系统通知中心管理，并使用 Apple Push Notification service，但不要求加入 Apple Developer Program。[WebKit：Web Push for Web Apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

**【事实】** WebKit 要求推送对用户可见，不允许把静默 Web Push 当作任意后台同步通道。[WebKit：Meet Web Push](https://webkit.org/blog/12945/meet-web-push/)

**【建议】** 第一版业务没有确认通知需求，因此不引入推送服务。以后若增加“晚间打卡提醒”，主屏幕 Web App 已具备技术路径；推送只用于可见提醒，不用于保证数据同步。

### 4.6 动画与音效

**【事实】** Safari 13.1、iOS 13.4 和 iPadOS 13.4 起支持 Web Animations API；WebKit 同时支持 CSS Animation 和 CSS Transition，并可利用浏览器渲染管线和可用的硬件加速。[WebKit：Web Animations in Safari 13.1](https://webkit.org/blog/10266/web-animations-in-safari-13-1/)

**【事实】** WebKit 在 iOS 上限制带声音媒体自动播放；由点击事件直接触发播放可以满足用户手势要求，而没有用户手势的带声音播放可能被拒绝。[WebKit：iOS 媒体播放政策](https://webkit.org/blog/6784/new-video-policies-for-ios/)

**【推断】** 老师形象、抚摸与惩罚等二维动画无需原生框架即可流畅实现；短音效也能满足需求，但应由家长点击“开始清算”或“查看总结”后播放。

**【建议】** 动画优先使用 CSS、Web Animations、SVG 或 Canvas，避免用大体积视频替代简单动作。提供静音开关，并尊重 `prefers-reduced-motion`；应用首次互动时统一解锁音频上下文，处理 `play()` 被拒绝的情况。

## 五、四种候选架构比较

| 方案 | 安装与启动 | 离线与本地数据 | 多设备与服务端 | 发布和维护 | 对本项目的判断 |
| --- | --- | --- | --- | --- | --- |
| Safari 普通网页 | 通过网址和标签页访问 | 可用 Service Worker 与 IndexedDB，但入口和持久性体验较弱 | 可直接访问同一后端 | 最轻 | 可保留为备用入口，不作为 iPad 首选体验 |
| 主屏幕 Web App | 主屏幕图标、独立窗口、可配置图标和主题 | Service Worker + Cache + IndexedDB；仍受 WebKit 清理策略影响 | 与普通网页共享同一 HTTPS 后端 | 仍是一次网页开发和部署 | **第一版推荐** |
| Capacitor iPad 应用 | 安装为原生应用，可上架或通过开发分发 | Web 资源打包进应用，可接原生文件、SQLite、后台及通知插件 | 若保留跨设备，仍需远端权威服务 | 增加 Xcode、签名、原生项目和发布流程 | 暂不采用，作为后续封装路径 |
| SwiftUI 原生应用 | 原生安装和系统整合最佳 | 可用 SwiftData、Core Data、SQLite 和原生后台能力 | 需另做服务端或 iCloud 同步 | 需要独立 Swift 代码和 Apple 发布维护 | 当前成本明显超过收益 |

### 5.1 普通网页

**【事实】** 普通 Safari 页面也可以注册 Service Worker 和使用 IndexedDB，前提是处于安全上下文。[W3C：Service Workers 安全要求](https://www.w3.org/TR/service-workers/#security-considerations)

**【推断】** 普通网页在核心能力上并不缺打卡、缓存或动画，但孩子每天要先打开 Safari、找到标签页，容易进入浏览器导航或其他网页。主屏幕入口更符合固定家庭工具的使用习惯。

**【建议】** 保留普通网址访问作为家长临时管理和故障恢复入口；在 iPad 首次访问时提供简短的“添加到主屏幕”引导。

### 5.2 主屏幕 Web App

**【推断】** 它与普通网页共享代码、后端和部署方式，却能提供独立图标、独立窗口、离线应用壳及更高的存储持久化获批概率，是当前需求下收益最高、额外成本最低的选择。

**【限制】** 它仍受 WebKit 生命周期和网站存储策略约束，不等同于拥有永久本地存储和自由后台执行能力。

### 5.3 Capacitor 封装

**【事实】** Capacitor 8 提供使用 `WKWebView` 的原生 iOS 运行时，可让 JavaScript 与 Swift 或 Objective-C 通信；当前官方文档要求 iOS 15 以上和 Xcode 26 以上。[Capacitor：iOS 文档](https://capacitorjs.com/docs/ios)

**【事实】** Capacitor 工作流需要构建 Web 代码，再运行 `npx cap sync` 将 Web bundle 复制到 iOS 原生项目并更新依赖，最后用 Xcode 或 CLI 生成签名的 IPA；Capacitor 应用按普通原生应用方式提交 App Store。[Capacitor：开发流程](https://capacitorjs.com/docs/basics/workflow)、[Capacitor：发布到 App Store](https://capacitorjs.com/docs/ios/deploying-to-app-store)

**【事实】** 调研日 Capacitor 最新稳定版为 8.5.0；9.0 仍为预发布版本。[Capacitor：官方发布页](https://github.com/ionic-team/capacitor/releases/tag/8.5.0)

**【推断】** Capacitor 可以复用 Svelte 前端，并可通过原生插件获得更稳定的本地文件、SQLite、触觉反馈、原生通知和有限后台任务。但当前需求不依赖相机、定位、蓝牙或持续后台处理；增加原生壳不会消除跨设备场景所需的服务端，反而形成 Web 存储、原生存储和服务端三层一致性问题。

**【建议】** 第一版不加入 Capacitor。保持浏览器代码只依赖标准 Web API，并隔离存储与设备能力接口，可以在以后用 Capacitor 封装，而不重写领域逻辑。

### 5.4 原生 SwiftUI

**【事实】** Apple 将 SwiftUI作为创建新 Apple 平台应用的优选界面技术；SwiftData 能以 Swift 模型持久化数据，并可选择在设备间同步。[Apple：SwiftUI apps](https://developer.apple.com/documentation/technologyoverviews/swiftui)、[Apple：SwiftData](https://developer.apple.com/documentation/swiftdata/)

**【事实】** Apple 平台还内置 Core Data 和 SQLite，可用于结构化持久化；SQLite 可直接用于所有 Apple 平台版本。[Apple：Structured data models](https://developer.apple.com/documentation/technologyoverviews/structured-data-models)

**【推断】** SwiftUI 能给 iPad 最完整的系统体验和本地数据控制，但会放弃现有的单一 TypeScript 网页代码路径。要继续支持手机、电脑和在线访问，还需要同时维护 Web 客户端或接受平台范围缩减。

**【建议】** 只有在产品明确变为 Apple 平台专用，并出现主屏幕 Web App 无法满足的原生需求时，才考虑 SwiftUI 重写。

## 六、推荐拓扑

### 6.1 在线单实例，首选运行方式

```text
iPad 主屏幕 Web App
├── Svelte 响应式界面
├── Web App Manifest 与主屏幕图标
├── Service Worker / Cache API：应用壳、图像、动画、音效
└── IndexedDB / Dexie：当天快照、离线操作、同步游标
              │
              │ HTTPS
              ▼
SvelteKit 模块化单体 / Node.js 24 LTS
├── 页面与同源 JSON API
├── 家长会话与家庭设备授权
├── 幂等同步、积分规则与每日清算
└── SQLite 单文件权威数据库
              │
              ├── 在线备份
              └── 主机外备份副本
```

**【建议】** 如果家庭接受联网使用，优先选一台支持持久磁盘的单实例主机并提供 HTTPS。iPad 只需第一次在 Safari 中打开地址并添加到主屏幕，此后按应用图标进入。

**【推断】** 这比局域网自签证书更容易维护，也能让手机、电脑和外出场景访问同一数据源。服务不可达时，孩子仍可在 iPad 离线打卡，恢复访问后前台同步。

### 6.2 家庭局域网单实例，可选运行方式

```text
iPad 主屏幕 Web App
        │
        │ 家庭 Wi-Fi + 受信任 HTTPS
        ▼
家庭常开 Mac / Linux 小主机 / 合适的 NAS
└── Node.js 单体 + SQLite + 定期备份
```

**【事实】** Service Worker 必须运行在安全上下文中，通常要求 HTTPS；标准只对 `localhost`、`127.0.0.0/8` 和 `::1/128` 等本机环回地址提供开发例外。[W3C：Secure Contexts](https://www.w3.org/TR/secure-contexts/#is-origin-trustworthy)、[W3C：Service Workers](https://www.w3.org/TR/service-workers/#secure-context)

**【推断】** iPad 通过 `http://192.168.x.x` 访问家庭服务器时，不能按完整 PWA 能力设计。局域网模式应使用 iPad 信任的 HTTPS 域名和证书；证书安装与续期会增加家庭维护工作。

**【建议】** 只有在“数据必须留在家里”高于“维护简单”时选择局域网模式。服务器需要常开，否则 iPad 只能使用缓存内容且无法同步或清算。

### 6.3 单 iPad、完全无服务端模式

**【推断】** 纯静态主屏幕 Web App加 IndexedDB 可以在一台 iPad 上完成多数业务功能，但会失去可靠多设备同步，并把唯一数据暴露于 WebKit 清理、用户清除网站数据、设备损坏和应用来源变化的风险。

**【建议】** 该模式只适合作为演示或短期原型，不作为家庭长期积分账本。若未来明确只用一台 iPad，且愿意频繁手工导出备份，可另写 ADR 接受该风险。

## 七、数据、同步与备份建议

### 7.1 数据权威边界

- **【建议】** SQLite 保存孩子账套、任务池、目标、目标任务快照、打卡原始操作、清算批次、清算修订和当前积分，是唯一权威数据源。
- **【建议】** IndexedDB 保存可重建缓存和尚未同步的 outbox；服务端确认接收前不得删除 outbox 操作。
- **【建议】** 每次打卡和撤销产生不可变的 `operationId`。服务端以唯一约束实现幂等，以既有澄清规则决定同一任务发生项的最终状态。
- **【建议】** 已清算日期收到迟到的 iPad 离线操作时，不静默改变积分；提示家长撤销并重新清算。

### 7.2 iPad 端状态提示

孩子端只需显示简单状态：

- 已保存在本机；
- 正在同步；
- 已同步；
- 同步失败，请保持页面打开后重试。

家长清算页需要额外显示：

- 当前设备是否有待同步操作；
- 服务端最后收到操作的时间；
- 当天是否存在清算后到达的变更。

**【推断】** 对孩子保持简单，对家长提供完整状态，可以避免三岁儿童理解网络状态，同时防止家长在数据未到齐时清算。

### 7.3 备份

- **【建议】** 延续既有研究的 SQLite Online Backup 方案，每日自动备份，并把至少一份副本放到运行主机之外。
- **【建议】** 家长端提供“一键导出家庭数据”和最近备份状态；导出文件不依赖 iPad IndexedDB。
- **【建议】** iPad 未同步 outbox 无法由服务端备份，因此应尽快在前台同步，清算前强制检查。
- **【建议】** 应用升级不得更换生产来源域名或路径范围，否则浏览器会把它视作不同来源或不同作用域，已有缓存和 IndexedDB 不能直接沿用。

## 八、版本策略

| 层次 | 建议基线 | 说明 |
| --- | --- | --- |
| iPadOS | 推荐最低 iPadOS 17；重点测试 iPadOS 26 当前稳定版 | iPadOS 17 起 Storage API 完整；iPadOS 26 简化主屏幕 Web App 安装行为 |
| Safari / WebKit | 跟随 iPadOS 系统版本 | 不按浏览器名称判断能力，使用 API 功能检测 |
| 前端 | Svelte 5 + SvelteKit 2 稳定补丁版 | 延续既有研究，锁定依赖版本 |
| 服务端 | Node.js 24 LTS | 运行于受支持的 macOS 或 Linux 主机，不运行于 iPad |
| 权威数据库 | SQLite 3.53.x 或驱动捆绑的同级稳定修复版 | 延续既有研究的单实例与事务设计 |
| 浏览器数据库 | IndexedDB + Dexie 4.x | Dexie 作为薄封装，不引入云同步产品 |
| 原生封装备选 | Capacitor 8.5.0 | 仅在触发条件成立后加入；不采用 Capacitor 9 预发布版 |

版本执行规则：

- **【建议】** 支持矩阵以真实 iPad 设备验证为准，不只依赖桌面 Safari 响应式模拟。
- **【建议】** 使用功能检测判断 Service Worker、Storage API、Web Push 和显示模式；缺失能力时提供中文降级提示。
- **【建议】** 框架、运行时和数据库主版本升级前先备份 SQLite，并回归离线启动、操作队列、清算重算及主屏幕升级流程。
- **【建议】** 第一版不为 iPadOS 16.4 以下提供完整 PWA 保证；若家庭现有 iPad 无法升级到 17，应先用实机探针决定是否降低最低版本。

## 九、iPad 交互与媒体适配

### 9.1 页面布局

- **【建议】** 默认支持竖屏和横屏，不锁定方向。
- **【建议】** 阳阳端优先采用大卡片、大图标、少文字和单层任务列表；果果端可以展示更多目标进度和连续记录。
- **【建议】** 主要操作放在拇指容易触达的页面下半区；清算确认与撤销保持明显间距，避免误触。
- **【建议】** 使用 CSS 安全区变量处理主屏幕模式下的顶部和底部区域。
- **【建议】** 兼容触控、键盘与鼠标，不把悬停作为唯一反馈，不依赖精确拖拽完成关键操作。

### 9.2 动画和音效

- **【建议】** 将老师、宠物、植物和短音效作为版本化静态资源，由 Service Worker 预缓存。
- **【建议】** 首次应用缓存控制在小体积范围，成长阶段资源按目标类型分包并按需缓存。
- **【建议】** 清算动画由家长点击后启动，奖励动画、惩罚动画和音效按已确认顺序播放。
- **【建议】** 动画中断、切到后台或音效播放失败时，积分结果仍必须立即持久化并可再次查看；表现层不得决定清算是否成功。
- **【建议】** 提供“跳过动画”“静音”和“减少动态效果”，避免清算流程被媒体能力阻塞。

## 十、何时升级到 Capacitor

只有出现下列一项或多项明确需求，才值得把现有 Web 前端加入 Capacitor 原生壳：

1. 必须通过 App Store 或受管理设备分发，不能依赖用户手动添加到主屏幕。
2. 必须把数据可靠保存在应用沙盒中的原生文件或 SQLite，而浏览器存储清理风险不可接受。
3. 必须使用原生本地通知、触觉反馈、受控后台任务、设备管理或其他标准 Web API 无法满足的能力。
4. 家庭长期处于无网环境，需要应用安装包内自带全部资源，并以 iPad 本地数据库为主要数据源。
5. 主屏幕 Web App 在目标 iPad 实机上出现无法规避的稳定性或性能问题。

**【建议】** 升级时继续保留 Svelte 领域界面和服务端 API，把 Capacitor 当作适配层；不要同时重写 SwiftUI。原生 SQLite 若只用作客户端缓存，仍以服务端 SQLite 为权威；若改为 iPad 本地权威，则必须重新设计多设备同步和备份，并另写 ADR。

## 十一、何时才考虑 SwiftUI

只有以下方向成为产品长期战略时，才考虑 SwiftUI：

- 产品明确只支持 Apple 平台，不再要求普通浏览器使用；
- 需要深度使用 iPad 多窗口、Apple Pencil、原生辅助功能、后台任务或系统级家庭设备能力；
- 有能力长期维护 Swift 客户端、服务端和数据同步协议；
- 对 App Store 品质、系统整合和原生性能的要求高于跨平台与低维护成本。

**【推断】** 当前项目的复杂度主要来自积分、任务周期、连续奖励、清算修订和离线同步，而不是绘图、音视频处理或硬件访问。原生重写不会减少这些领域复杂度，只会增加一套客户端技术栈。

## 十二、中间件取舍

第一版继续需要：

- SQLite：权威数据库和清算事务；
- Dexie：iPad IndexedDB 的轻量封装；
- Service Worker 与 Cache API：应用壳和媒体离线缓存；
- Caddy 或托管平台 TLS：公开部署或局域网可信 HTTPS；
- SvelteKit 服务端钩子：会话、权限和统一错误处理。

第一版仍不需要：

- Redis；
- 消息队列；
- PostgreSQL；
- 对象存储；
- 独立 API 网关；
- 原生推送服务；
- Capacitor 插件体系；
- SwiftData 或 CloudKit。

**【推断】** iPad 优先改变的是客户端交付和验证重点，不改变家庭级数据量、并发或领域事务边界，因此没有新增基础中间件的理由。

## 十三、主要风险与限制

| 风险或限制 | 对本项目的影响 | 建议措施 |
| --- | --- | --- |
| IndexedDB 或缓存被清理 | 未同步打卡和离线资源可能丢失 | 请求持久存储、显示同步状态、服务端权威、定期备份 |
| Background Sync 不可依赖 | Web App 关闭后不保证自动上传 | 启动、回前台、联网、操作后和清算前同步 |
| 家庭局域网使用普通 HTTP | Service Worker 等安全上下文能力不可用 | 使用受信任 HTTPS，或选择在线部署 |
| 家庭服务器关机 | iPad 只能使用缓存，不能同步与清算 | 使用常开主机，或优先在线单实例 |
| 音效自动播放被拦截 | 总结可能无声音 | 由家长点击触发、允许静音、处理播放失败 |
| 主屏幕 Web App 与 Safari 状态差异 | 测试结果可能不一致 | 两种入口都实测，以主屏幕模式为验收重点 |
| 服务端域名变化 | IndexedDB、缓存与安装身份无法自然迁移 | 生产来源保持稳定，迁移时提供导出和重新授权流程 |
| iPad 设备时钟不准 | 最后操作时间规则可能偏离真实顺序 | 保存服务端接收时间、检测明显时钟偏差、保留原操作 |

## 十四、实施前验证清单

在写 ADR 和完整实施规格前，建议用目标家庭 iPad 做以下技术探针：

1. 在 iPadOS 17 及目标最新 iPadOS 上，从 Safari 添加到主屏幕，验证名称、图标、独立窗口、竖屏和横屏。
2. 首次在线加载后断网，彻底关闭再重开主屏幕 Web App，验证应用壳、当天任务、内置图片、动画和音效可用。
3. 验证 IndexedDB 写入、关闭重开保留、`navigator.storage.persist()` 结果、存储用量查询和容量异常提示。
4. 离线连续完成和撤销多项任务，恢复网络并回到前台，验证 outbox 全部幂等上传。
5. 在打卡后立即切后台、锁屏、杀掉 Web App 和恢复网络，确认产品不会错误显示“已同步”。
6. 在两个设备离线修改同一任务，验证既有“较晚操作优先”和稳定决胜规则。
7. 家长进入清算页时，验证会先同步并阻止在未知待同步状态下直接清算。
8. 验证清算动画在奖励、扣分、奖扣并存和多个目标时的播放顺序；切后台再回来不重复计分。
9. 验证音效必须在家长操作后播放，静音、系统音量和播放失败时不会阻塞流程。
10. 验证触控目标、字号、横竖屏、安全区、分屏模式、外接键盘和鼠标基本操作。
11. 验证新 Service Worker 发布后，主屏幕 Web App 能安全更新；旧缓存和 IndexedDB 模式迁移失败时显示中文恢复提示。
12. 在线模式验证 HTTPS、会话 Cookie、设备授权和服务重启；局域网模式另行验证证书信任和续期。
13. 运行中备份 SQLite，从备份恢复到临时实例，并核对孩子、目标、最近打卡和清算修订历史。
14. 记录实机型号、iPadOS 版本、Safari/WebKit 版本、网络条件和每项结果，作为后续支持矩阵。

## 十五、建议写入 ADR 的决策

1. 第一版采用 iPad 主屏幕 Web App 作为主要客户端形态，普通网页作为兼容入口，不交付 Capacitor 或 SwiftUI 应用。
2. 延续 SvelteKit 模块化单体、Node.js 和 SQLite 服务端，IndexedDB 只作为离线缓存及操作队列。
3. 推荐最低 iPadOS 17；以真实家庭设备探针决定是否需要支持更早版本。
4. 第一版同步保证限定为“应用处于前台或重新回到前台后自动同步”，不承诺关闭应用后的 Background Sync。
5. 在线单实例作为首选部署拓扑；家庭局域网模式只有在能提供常开服务和受信任 HTTPS 时启用。

## 十六、最终建议

**【建议】** 对这个固定一个家庭、两个孩子、以 iPad 日常打卡为主且要求轻量维护的系统，最合适的架构是：

> iPad 主屏幕 Web App + SvelteKit 模块化单体 + Node.js 24 LTS + SQLite 权威数据库 + IndexedDB/Dexie 离线操作队列 + Service Worker 静态资源缓存。

该结论不推翻既有架构，只把 iPad 的主屏幕安装、存储清理、后台限制、触控与媒体行为提升为一等设计约束。应用在 iPad 上看起来和启动起来接近普通 App，但仍保持一套网页代码、一个轻量服务和一个 SQLite 文件。

Capacitor 是合理的第二阶段升级路径，而不是第一版默认选项。SwiftUI 只有在产品明确转为 Apple 专用并出现大量原生能力需求时才值得采用。

## 十七、主要一手来源

- [WebKit：Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit：Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [WebKit：Workers at Your Service](https://webkit.org/blog/8090/workers-at-your-service/)
- [WebKit：Safari 26.0 Web App 变化](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#every-site-can-be-a-web-app-on-ios-and-ipados)
- [WebKit Bug 201866：Background Sync API](https://bugs.webkit.org/show_bug.cgi?id=201866)
- [W3C：Service Workers](https://www.w3.org/TR/service-workers/)
- [W3C：Secure Contexts](https://www.w3.org/TR/secure-contexts/)
- [W3C：Web Application Manifest](https://www.w3.org/TR/appmanifest/)
- [SvelteKit：Service workers](https://svelte.dev/docs/kit/service-workers)
- [SvelteKit：Node servers](https://svelte.dev/docs/kit/adapter-node)
- [Node.js：支持平台](https://github.com/nodejs/node/blob/main/BUILDING.md#platform-list)
- [Capacitor：iOS 文档](https://capacitorjs.com/docs/ios)
- [Capacitor：开发流程](https://capacitorjs.com/docs/basics/workflow)
- [Apple：SwiftUI apps](https://developer.apple.com/documentation/technologyoverviews/swiftui)
- [Apple：SwiftData](https://developer.apple.com/documentation/swiftdata/)
- [Apple：界面设计注意事项](https://developer.apple.com/design/tips/)
