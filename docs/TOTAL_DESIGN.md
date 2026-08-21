# Riki 剧情工作台 · 总设计案

## 目标与非目标

目标是提供一个可导入 Tavern Helper 的完整剧情策划助手：以 `Riki剧情助手 2.2.0` 的真实 UI、README 和非数据库策划源码为行为基线，保留模型连接与预设、主控路由、分支会话、策划 Agent、正式成果提案与版本、回收站、流式讨论、项目导入导出、世界书读取与受控修改，并通过一个只改版本号的加载器获取版本化 bundle。

第一版明确不实现 SP·数据库内核、数据库设计/审查 Agent、固定表或动态表、数据库模板编译/安装/运行期推进、推进预设、数据库剧情浮窗、灵感二创、生图、素材库、智绘姬、MVU 迁移、记忆引擎、真实 MCP/CLI Companion 或角色卡封装。

## 项目类型与承载面

项目类型为 `hybrid`：交付边界是 Tavern Helper `component`，运行界面是挂载在 SillyTavern 宿主页面上的响应式工作台，代码通过版本化远程 ES module 加载。远程地址不可用时可切换本地开发服务器，旧项目不作为运行依赖。

## 四态决策账本

- confirmed：新建独立项目；第一版与数据库/二创/记忆解耦；手机电脑双适配；只改酒馆版本号同步；世界书写入需 Diff 与确认。
- confirmed：驾驶员于 2026-08-21 重开 BP-01 范围；第一版必须与旧 `Riki剧情助手 2.2.0` 的非数据库主体一致，不能以“世界书 + 简单讨论”作为完成标准。
- proposed：真实 MCP/CLI Companion 在 1.0 核心稳定并完成真机门后接入同一 Command Core。
- pending：实际安装的 ST/TH 版本、真实移动端手感。
- confirmed：GitHub 仓库固定为 `rikidrq/riki-story-workbench`；正式加载器使用不可移动 `v<version>` 标签读取 `dist/releases/<version>`，不执行可变 `main`。
- rejected：继续扩展旧 Riki/Cortex；跟随可变 `latest`；整本旧快照回滚覆盖；把自动测试当真实宿主验收。

## Core Spine

- 权威源：真实 Tavern Helper Worldbook API 返回的当前条目数组。
- 核心对象：ProjectState、AgentConversation、PlanningArtifact、ArtifactProposal、ArtifactVersion、RecycleBatch、ModelPreset、SystemPreset、ModuleBinding、Worldbook、WorldbookEntry、Patch、HistoryRecord、RequestLog、CapabilityReport。
- 主循环：选择模式与模块 → 读取世界书上下文 → 主控/确定性路由 → 流式策划 → 形成候选 → 逐项确认 → 保存版本/回收站 → 可选原世界书 Diff 写回。
- 交付协议：稳定脚本 ID + 微型加载器 + `dist/releases/<version>/riki-workbench.js`。
- 模型连接：酒馆当前连接、Connection Manager profile、独立 OpenAI-compatible API；API 密钥仅保存到设备级设置/本地存储，聊天 metadata、项目导出、日志和世界书均不得包含密钥。
- 模块体系：主控、总纲、大章、小章、人物、格式编译；主 Agent 默认配置可被模块级 API、模型和 System 预设覆盖。
- 最低宿主能力：只读策划可在模型连接可用时运行；世界书库存要求 `getWorldbookNames/getWorldbook`；写入额外要求 `updateWorldbookWith`；酒馆当前连接要求 `generateRaw`；Connection Manager 仅保存 profile ID。
- 并发边界：Riki 对自身写入使用每书队列，并在可用时使用 Web Locks；Tavern Helper 当前 API 无原子 CAS，外部编辑器同瞬间写入仍需真实宿主竞态验收。

## First Playable / First Usable

用户导入加载器后可在原版同构的全屏三栏工作台中创建、复制偏好、重命名和删除 Agent 分支会话；选择详细版、粗略版或懒人版；由主控路由到总纲、大章、小章或人物 Agent；流式查看、停止、编辑、删除、重 Roll 与复制消息；把模型输出转成可逐项确认的正式成果候选，并在版本链、Diff 和回收站中管理成果。

用户可配置酒馆当前连接、Connection Manager profile 或独立 OpenAI-compatible API，保存多套 API/System 预设，为主 Agent 和各模块设置覆盖，并运行模型列表获取或手填模型。格式编译 Agent 默认继承目标模块配置。

世界书继续提供库存、绑定标签、条目级上下文选择、原条目编辑、Diff、陈旧写入拒绝、写后重读和撤销。所有讨论与策划都不创建主聊天楼层，不触发数据库或二创运行时。

交付文件包括版本 bundle、CDN 版本加载器、本地开发加载器、静态预览、自动测试和操作说明。完成后停在真实酒馆导入门，不自动进入记忆或数据库路线。

## Growth Tracks

- 1.x：真实 CLI/MCP Companion 与更多世界书批量操作。
- 2.0：L0/L1 轻量公共剧情记忆。
- 2.5：MVU/SP/自定义角色卡适配器。
- 3.0：灵感、大纲、生图等 Creative Provider。
- 4.0：共享事件账本与每角色独立认知记忆。

## Parking Lot

- GitHub 自动创建 Release 的可选流程；当前以版本目录直接发布。
- 实际安装版本能力快照。
- 多 Agent 并发写入、跨设备同步、协作编辑。
- 数据库模板生成、角色卡重封和创意工坊仍属于后续版本，不得回流到 BP-01。

## 前端适配结论

桌面严格沿用原版三栏：左侧 Agent 对话，中间消息与输入，右侧成果/上下文/配置/偏好/Agent/日志/版本七标签；窄屏改为单主区，左上汉堡打开对话抽屉，右上齿轮打开七标签抽屉，不使用底部导航。所有触控按钮保持至少约 44px 的可点击尺寸，关键功能不依赖 hover；关闭必须让宿主根节点真正 `display:none`，右下角入口可重新打开；工作台处理动态视口、安全区和软键盘高度。

## 验收账本

- automated：1.2 已通过 21 项旧世界书、49 项项目状态机、28 项模型连接、9 项策划契约、9 项运行模拟、80 action 合同和发布审计；推进预设排除、1.1 升级剔除、角色绑定世界书默认选择、近期正文预算和模型主控歧义路由均有专门断言。
- static-preview：已通过桌面 1440×900 与手机 320×700、375×812、430×900 的完整点击旅程；覆盖移动关闭/重开、汉堡/齿轮抽屉、模型配置、世界书写入/撤销、成果版本/回收站、导入导出和诊断。
- real-host：待真实 Tavern Helper 导入、加载、生成、写入、撤销、切聊天与移动端测试。
- driver：已授权执行，尚未验收成品。

## 下一道门

完成自动化和静态预览后，停止在“导入本地开发加载器并在一次性世界书中测试”的真实宿主门。
