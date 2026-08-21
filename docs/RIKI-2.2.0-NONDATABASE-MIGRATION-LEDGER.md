# Riki 2.2.0 非数据库功能迁移账本

本账本是 Riki剧情助手 1.3.0 的迁移分母；逐项点击事实以 `docs/RIKI-2.2.0-INTERACTION-AUDIT.md` 为准。事实源为只读旧项目 `story-studio-database` 的源码与正式 2.2.0 发布包。迁移不是复制数据库内核；推进预设也按用户最新决定剔除。任何写有“剔除”的项目都不得以隐藏按钮或默认关闭的形式残留运行代码。

状态定义：

- `pending`：尚未实现或尚无当前证据；
- `implemented`：源码存在，但完整自动化尚未通过；
- `automated`：有针对该行为的自动化证据；
- `static`：自动化和桌面/手机静态宿主均通过；
- `real-host`：真实 SillyTavern/Tavern Helper 通过；
- `driver-accepted`：驾驶员实际使用后确认。

## A. 主工作台与分支会话

| ID | 旧版行为 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| A01 | 全屏三栏工作台 | 原版同构：左 Agent 对话、中聊天、右七标签 | static | 原版/新版实际渲染截图 + `src/riki-ui.js` |
| A02 | 手机响应式工作台 | 原版同构：汉堡对话抽屉 + 齿轮七标签抽屉，无底部导航 | static | 320/375/430px 点击回归 |
| A03 | 关闭与重开 | 触摸 × 真正隐藏 fixed 遮罩；R 可重开 | automated | `scripts/visual-check.cjs` RF-002 |
| A04 | 新建 Agent 对话 | 新分支有独立消息、模式、偏好、上下文、待确认候选 | automated | 项目核心 + UI 回归 |
| A05 | 复制偏好新建 | 复制偏好但不复制待确认候选和运行中请求 | automated | 项目核心测试 |
| A06 | 重命名分支 | 桌面和手机均可操作，空名称拒绝 | automated | 交互回归 |
| A07 | 删除分支 | 至少保留一条；活动分支安全切换 | automated | 负路径测试 |
| A08 | 切聊天隔离 | 不把旧聊天项目写入新聊天；进行中结果丢弃 | automated | mock + 真宿主 |

## B. 消息与生成生命周期

| ID | 旧版行为 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| B01 | 用户消息编辑 | 修改后截断该轮后续结果，再从同一点重跑 | automated | 项目核心/交互测试 |
| B02 | 用户消息删除 | 删除用户轮及对应助手结果，不留悬空候选 | automated | 项目核心测试 |
| B03 | 助手重 Roll | 复用前一条用户输入与模块，产生新结果 | automated | 模型 mock |
| B04 | 复制消息 | Clipboard 成功与失败提示 | automated | 浏览器回归 |
| B05 | 流式显示 | direct SSE、Connection Manager 累积流均实时更新 | automated | 模型单测 + 浏览器 mock |
| B06 | 停止生成 | AbortSignal/酒馆停止接口停止当前代，不污染下一轮 | automated | Abort 测试 |
| B07 | 关闭后后台继续 | 仅视觉关闭，不销毁当前生成；完成后重开可见 | automated | 浏览器回归 |
| B08 | 失败恢复 | 请求错误落成可读失败消息，可重 Roll | automated | 负路径测试 |

## C. 策划 Agent 与工作流

| ID | 模块/模式 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| C01 | 主控 Agent | 讨论、访谈、路由，不直接把对话当正式成果 | automated | `src/riki-planning.js` |
| C02 | 总纲 Agent | 总纲候选、题材/主线/伏笔/结局/自由边界 | automated | schema/prompt |
| C03 | 大章 Agent | 稳定 actId、目标/冲突/事件/结果/衔接 | automated | schema/prompt |
| C04 | 小章 Agent | 稳定 chapterId/actId、目标/人物/事件/状态/钩子 | automated | schema/prompt |
| C05 | 人物 Agent | 粗略分档与精细字段；稳定 characterId | automated | schema/prompt |
| C06 | 推进预设 Agent | 用户明确要求剔除；运行源码、预设、成果和 UI 均无此模块 | automated | 发布关键词审计 |
| C07 | 格式编译 Agent | 机械映射 source draft，不新增事实；继承目标模块模型配置 | automated | 模型集成测试 |
| C08 | 常规版 | 讨论 → 正文确认 → 正式候选 → 逐项确认 | automated | 端到端测试 |
| C09 | 粗略版旧状态 | 只保留旧项目迁移与继续，不作为新入口 | automated | 状态机测试 |
| C10 | 懒人版 | 总纲→大章→小章→人物，逐步 checkpoint、可停可恢复 | automated | 多轮模拟测试 |
| C11 | 主控路由 | 显式模块优先；关键词/阶段回退；不路由数据库或二创 | automated | `tests/planning-tests.mjs` |

## D. 正式成果、提案与版本

| ID | 旧版行为 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| D01 | 正式成果提案 | 对话输出与成果候选分离；候选不会自动保存 | automated | 项目核心 + 集成 |
| D02 | 子项确认/打回 | 大章、小章、人物逐项确认，打回项可定向重做 | automated | 项目核心测试 |
| D03 | 基线过期检查 | 其他分支保存新版后，旧 baseVersionId 拒绝确认 | automated | 并发分支测试 |
| D04 | 版本链 | 每类成果保存连续版本、base、来源分支与时间 | automated | 项目核心测试 |
| D05 | Diff | 任意版本字段级 Diff 与前后完整 JSON | automated | 项目核心/UI |
| D06 | 回收站 | 删除当前成果及下游依赖为整批；可恢复；永久清空 | automated | 项目核心测试 |
| D07 | 成果工作台编辑 | 只能基于当前版本创建新候选，不直接改历史版本 | automated | 交互负路径 |

## E. 模型连接与预设

| ID | 连接/配置 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| E01 | 引用酒馆连接预设 | 读取 profile URL/Key 引用与 Settings Preset，只保存 profile ID，可获取/选择/保存模型 | automated | 原版浏览器点击 + profile mock/真宿主 |
| E02 | Connection Manager | 仅保存 profile ID；通过 `sendRequest`；不复制酒馆密钥 | automated | 模型单测 |
| E03 | 独立 OpenAI-compatible | direct SSE；默认 `viaBackend=false`；Abort/超时 | automated | 模型单测 |
| E04 | Failed to fetch 诊断 | 明确 CORS、HTTPS 混合内容、不可达；不静默换传输 | automated | 负路径测试 |
| E05 | API 配置多套保存 | 新建/保存/切换/删除；内置当前连接不可误删 | automated | 配置测试 |
| E06 | 模型列表 | profile/direct 获取；失败时允许手填 | automated | mock HTTP |
| E07 | 主/默认/模块覆盖 | 模块→默认→主→设备全局继承；模型与 API 层级一致 | automated | 配置测试 |
| E08 | 格式编译继承 | 默认继承目标模块；自身显式覆盖优先 | automated | 配置测试 |
| E09 | System 预设 | controller/outline/act/chapter/character/format_guard；每项含原版职责级协议 | automated | 配置测试 + 关键词断言 |
| E10 | 酒馆 System 快照 | 复制当前启用的 System 内容为新预设 | automated | mock/真宿主 |
| E11 | 敏感信息边界 | Key 仅 extensionSettings/localStorage；日志/项目/metadata/世界书不得含 Key | automated | 深层扫描测试 |

## F. 世界书

| ID | 旧版行为 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| F01 | 库存与绑定标签 | 全部世界书；聊天/角色/全局排序与标签 | automated | 原 1.0 核心测试/预览 |
| F02 | 条目级选择 | 每分支独立选择，发送前有上下文字符预算 | automated | 新分支集成测试 |
| F03 | 原条目编辑 | 名称、启用、策略、关键词、位置、概率、正文 | automated | 原 1.0 核心测试 |
| F04 | Diff 二次确认 | 预览不写；仅当前 patchId 可确认 | automated | 原 1.0 核心测试 |
| F05 | 陈旧覆盖拒绝 | updater 内 hash 重验，外部变化拒绝 | automated | 原 1.0 核心测试 |
| F06 | 写后回读 | 返回值不等于目标则失败，不清历史 | automated | 原 1.0 核心测试 |
| F07 | 撤销 | 只恢复最近一次且同样做陈旧检查 | automated | 原 1.0 核心测试 |

## G. 日志、偏好、导入导出与 Command Core

| ID | 行为 | 1.2 要求 | 状态 | 证据 |
|---|---|---|---|---|
| G01 | 分支偏好 | 偏好值和来源/确认状态可保存、复制、导入 | automated | 项目核心测试 |
| G02 | 请求日志 | 路由、配置摘要、完整输入/输出、耗时、流式/错误；Key 脱敏 | automated | 模型集成测试 |
| G03 | 日志导出 | 单轮摘要、输入、输出诊断均可下载 | automated | 浏览器测试 |
| G04 | 项目导出 | 所有成果版本链、决策和分支偏好；不含 API 配置/Key | automated | 项目核心测试 |
| G05 | 项目导入 | schema 校验；已有成果必须明确替换；旧成果可恢复 | automated | 项目核心测试 |
| G06 | Command Core | status、项目/分支/成果/模型只读、世界书两阶段写、策划发送 | automated | API 测试 |

## H. 明确剔除清单

以下项目在 1.2 源码、产物、菜单、Command Core 和文档使用流程中都不得成为可运行能力：

- SP·数据库内核；
- 数据库设计 Agent、数据库审查 Agent；
- 十一张固定表、动态表、DDL、数据库模板编译/审查/试运行/修复；
- 安装数据库到聊天、数据库运行期推进/填表/章节判定；
- 数据库剧情浮窗、数据库更新监听与回放；
- 推进预设 Agent、成果、System 预设与运行期规则；
- 灵感二创、二创状态栏、事件/抽卡/特卖/换装；
- 生图双通道、素材库、智绘姬；
- 记忆引擎与 MVU 模板迁移（分别属于后续版本）。

发布前必须对 `src/` 与 `dist/releases/1.3.0/` 执行关键词和导出符号审计。文档谈论“被剔除”不算违规，但运行模块若出现对应实现或入口即判失败。

## 最终证据门

1. 所有 `pending/implemented` 项至少达到 `automated`；纯视觉项达到 `static`。
2. Node 单元/集成测试、构建、语法、组件格式、权限/敏感信息扫描全部通过。
3. Playwright 至少在桌面 1440×900、手机 320×700、375×812、430×900 跑完整点击巡检，而不只是截图。
4. 再运行三轮兼容模拟：常规版、旧粗略状态迁移、懒人版；新建对话只能看到常规版/懒人版。每轮生成 mock 成果、确认版本、修改、打回/重 Roll、导出再导入。
5. 真实酒馆与真机仍是独立门；未取得真实证据前不得把 `real-host` 或 `driver-accepted` 标为通过。
