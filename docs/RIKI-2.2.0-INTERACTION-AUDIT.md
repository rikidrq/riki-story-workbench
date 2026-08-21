# Riki 2.2.0 非数据库逐项交互审计

本账本以本地只读原版 `story-studio-database/dist/酒馆助手脚本-Riki剧情助手2.2.0.json`、`src/v0.5/*.js` 和浏览器 mock 宿主的真实点击结果为依据。审计宿主由 `scripts/original-audit-server.mjs` 提供，只记录交互，不连接真实模型、不写真实酒馆。真实 SillyTavern/Tavern Helper 版本、密钥库和物理手机仍是独立验收门。

## 原版事实纠偏

- 新对话当前只显示「常规版 / 懒人版」两种总体策略；粗略版仅保留在旧状态兼容代码中，不是 2.2.0 新入口。
- 模型入口不是“酒馆当前连接”抽象。原版新建 API 后可选「引用酒馆连接预设（地址 + Key）」或「独立 OpenAI-compatible SSE」；数据库连接属于本项目排除项。
- 引用酒馆预设时，界面显示预设名、URL、密钥库引用状态、酒馆 Settings Preset；Riki 只保存 profile ID 和模型覆盖，不复制 Key 明文。
- 「通过当前连接获取模型」经酒馆 `/api/backends/chat-completions/status` 使用预设的 provider/source、URL 与 secret ID 拉取模型，也允许手填。选中模型并保存后，关闭再打开仍保留。
- 配置作用域为主控、次 Agent 默认、总纲、大章、小章、人物、格式编译；继承顺序是模块 → 默认 → 主控 → 设备全局。模块首次保存继承来的 API 时会复制为模块专属预设，不能改坏共享预设。

## 功能分母

| 区域 | 原版逐项入口 | 第一版对应要求 |
|---|---|---|
| 启动/关闭 | 魔术棒入口、关闭、后台生成后重开、手机汉堡/设置抽屉 | 保留 |
| 策略 | 常规版、懒人版；选择后锁定 | 保留；旧粗略版只迁移 |
| 分支 | 新建、复制偏好新建、切换、重命名、删除 | 保留 |
| 消息 | 发送、停止、编辑并截断后续、删除、重 Roll、复制 | 保留 |
| 成果 | 总纲/大章/小章/人物版本链、逐项确认/打回、整批确认、编辑 JSON、Diff、新修订、级联删除、回收/恢复/清空 | 保留四类；数据库/推进成果剔除 |
| 上下文 | 正文深度、搜索、启用/蓝灯/绿灯过滤、书级/条目级勾选、批量选择、刷新 | 保留 |
| 世界书修改 | 模型候选、讨论、Diff、确认写入、回读、拒绝、撤销 | 保留受控写入 |
| 配置 | 路由模式、作用域、API 库、酒馆 profile、URL/Key 引用说明、模型列表/手填、结构化输出、模型覆盖、System 导入/新建/编辑/保存/删除 | 保留 |
| 偏好 | 模型推测、用户确认、新增并确认、编辑、删除、全部确认、清空、复制到新分支 | 保留 |
| Agent | 主控调度状态、当前/待命 Agent、每模块生效 API/模型、请求轨迹、详细度 | 保留，不显示隐藏思维链 |
| 日志 | 完整输入、输出诊断、AI 原文、合并收发、复制、当前分支/全部导出与分别清空 | 保留；深层脱敏 |
| 项目迁移 | 导出/导入成果版本链、分支偏好、决策；排除 API Key | 保留 |
| 响应式 | 桌面三栏、手机主区/对话抽屉/七标签抽屉、关闭不留遮罩 | 保留 |
| 版本 | 版本明细与当前版本 | 保留 |

## 已执行的原版点击证据

本轮已在 `http://127.0.0.1:8179/` 启动原版 2.2.0 的完整 `src/v0.5`，使用只读 mock 酒馆逐项操作；不是从 README 猜测。

- 点击魔术棒入口、关闭、重新打开；桌面三栏与手机抽屉分别检查。
- 逐项点击成果、上下文、配置、偏好、Agent、日志、版本七个标签并记录 DOM。
- 新建 API，切到「引用酒馆连接预设（地址 + Key）」，选择酒馆 profile；确认界面展示 URL、隐藏的 Key 引用和 Settings Preset。
- 点击「通过当前连接获取模型」，选择 `story-model-c`，保存 API；关闭重开后 profile/model 仍保留。
- 发送一条真实 mock Agent 请求；确认用户/助手头像消息流、Markdown 正文容器、请求详情、编辑、删除、重 Roll、复制和 Agent 调度轨迹出现。
- 点击用户消息编辑；原版进入内联编辑态，按钮是「取消 / 保存并重新生成」。
- 手动新增偏好并确认；确认原版行内显示名称、值、约束状态、保存、删除、全部确认和清空。
- 点击「复制偏好到新分支」、重命名、新建空白分支并切换；复制分支保留偏好，空白分支不带偏好，策略需重新选择。
- 在空白分支点击懒人版；原版先插入主控说明，不立即启动流水线，必须先讨论，信息足够后才出现「开始自动生成」。
- 上下文页实际读取正文深度、标题/uid/关键词/正文搜索、启用/蓝灯/绿灯过滤、五种批量选择和书/条目勾选。
- 日志页在产生请求后实际出现四类内容：完整输入、输出诊断、AI 原文、合并收发；当前分支与全部的导出/清空范围分离。
- 原版常规版存在独立的「确认正文后格式转换」动作；1.3 已实现 `awaiting_content_confirmation` 状态、回主控讨论和手动确认编译，不再把两次模型请求静默连跑。
- 原版成果逐项门存在「只重做被打回项」和人物槽位回填；1.3 已补回受限重做合并，以及 `{{HIGHn}} / {{MIDn}}` 到人物姓名的版本化回填。
- 原版上下文页存在「独立项目书 / 直写角色原世界书」切换；1.3 已实现创建/绑定/回读、只管理 `Riki·` 前缀、迁移、回滚与 Command Core 同步入口。
- 原版导出先预览；1.3 的项目与日志导出已补回完整预览、复制、确认和取消。

## 原版视觉与 LLM 输出契约

- 字体使用系统无衬线中文栈；品牌、阶段、正文、辅助信息至少四级，不用整页同字号。
- 中央消息不是大块聊天卡：采用 `32px` 头像 + 无外框正文流；用户为深灰头像，Riki 为紫色渐变头像。
- 消息头包含作者、Agent 模块徽标、状态和时间；操作按钮默认弱化，悬停或触屏时显现。
- 模型输出支持标题、段落、列表、引用、行内代码和代码块；所有内容先转义/净化，禁止把模型 HTML 直接插入 DOM。
- 流式输出追加紫色闪烁光标；上滑离开底部后不抢滚动，提供返回底部入口。
- 请求失败使用独立红色诊断卡，不把错误伪装成正常正文；请求详情折叠展示且不含 Key。
- 配置页在窄右栏采用纵向字段、42px 控件和分节卡，不再用两列压缩长中文标签。
- 手机 320/375/430px 必须可关闭、可滚动、无残留遮罩；关闭按钮、抽屉按钮和发送按钮保留触控面积。

## 明确排除

SP·数据库、数据库设计/审查、数据库模板安装与运行期、推进预设、灵感二创、状态栏、生图、智绘姬、素材库、记忆引擎和 MVU 迁移不进入第一版；其按钮、成果、提示词、路由和持久化形状均不得作为隐藏功能残留。

## API 证据

```text
symbol: ConnectionManagerRequestService.getSupportedProfiles / sendRequest
surface: SillyTavern Connection Manager as exposed in Tavern Helper script context
applies_to: local Riki 2.2.0 source; installed runtime version pending
provenance: story-studio-database/src/v0.5/api.js
confidence: high for original source behavior; medium for unknown installed runtime
runtime_check: mock host passed; real Tavern Helper check pending

symbol: /api/backends/chat-completions/status
surface: SillyTavern core backend
applies_to: local Riki 2.2.0 source; installed runtime version pending
provenance: story-studio-database/src/v0.5/api.js
confidence: high for original source behavior; medium for unknown installed runtime
runtime_check: mock endpoint passed; real backend check pending
```

本文件是后续发布审计的功能分母。README 或截图不能替代这里的逐项交互与自动测试。

## 真实宿主只读证据

- 真实 SillyTavern：`1.18.0 release (244e79ff5)`，地址 `http://127.0.0.1:8000/`。
- Tavern Helper 已装脚本实际打开为 `Riki剧情助手 1.2.0`，仍显示详细版/粗略版/懒人版和酒馆当前连接，证明用户截图来自旧发布，不是 1.3 开发版。
- 在真实宿主点击关闭后，Riki 根节点回读为 `hidden=true`、`display:none`，桌面关闭链通过。
- 未经安装门授权，没有用 1.3 覆盖真实脚本，没有读取 profile 密钥、发送模型请求或写真实世界书；1.3 的真实 profile、写入和手机验收保持待办。
