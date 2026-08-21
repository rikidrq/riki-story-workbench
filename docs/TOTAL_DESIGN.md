# Riki 剧情工作台 · 总设计案

## 目标与非目标

目标是提供一个可导入 Tavern Helper 的轻量剧情工作台：读取与修改世界书、独立讨论剧情、预览变更、拒绝陈旧覆盖、撤销最近提交，并通过一个只改版本号的加载器获取版本化 bundle。

第一版不实现数据库、MVU、记忆引擎、角色卡改造、灵感二创、生图、真实 MCP/CLI Companion、角色卡封装、安装或发布。

## 项目类型与承载面

项目类型为 `hybrid`：交付边界是 Tavern Helper `component`，运行界面是挂载在 SillyTavern 宿主页面上的响应式工作台，代码通过版本化远程 ES module 加载。远程地址不可用时可切换本地开发服务器，旧项目不作为运行依赖。

## 四态决策账本

- confirmed：新建独立项目；1.0 与数据库/二创/记忆解耦；手机电脑双适配；只改酒馆版本号同步；世界书写入需 Diff 与确认。
- proposed：真实 MCP/CLI Companion 在 1.0 核心稳定并完成真机门后接入同一 Command Core。
- pending：实际安装的 ST/TH 版本、真实移动端手感。
- confirmed：GitHub 仓库固定为 `rikidrq/riki-story-workbench`；正式加载器使用不可移动 `v<version>` 标签读取 `dist/releases/<version>`，不执行可变 `main`。
- rejected：继续扩展旧 Riki/Cortex；跟随可变 `latest`；整本旧快照回滚覆盖；把自动测试当真实宿主验收。

## Core Spine

- 权威源：真实 Tavern Helper Worldbook API 返回的当前条目数组。
- 核心对象：Worldbook、WorldbookEntry、Patch、HistoryRecord、DiscussionConversation、CapabilityReport。
- 主循环：读取 → 选择上下文 → 讨论/编辑 → Diff → updater 内重验 → 写后重读 → 可撤销。
- 交付协议：稳定脚本 ID + 微型加载器 + `dist/releases/<version>/riki-workbench.js`。
- 最低宿主能力：`getWorldbookNames`、`getWorldbook`；写入额外要求 `updateWorldbookWith`；讨论额外要求 `generateRaw`。
- 并发边界：Riki 对自身写入使用每书队列，并在可用时使用 Web Locks；Tavern Helper 当前 API 无原子 CAS，外部编辑器同瞬间写入仍需真实宿主竞态验收。

## First Playable / First Usable

用户导入加载器，打开工作台，读取一本世界书，选择一个条目，修改正文并看到前后对照；确认后写入，外部内容变化时拒绝覆盖，成功后可撤销。用户还可选择条目作为上下文，在独立讨论室调用当前 Tavern Helper 连接讨论剧情，讨论不会创建主聊天楼层。

交付文件包括版本 bundle、CDN 版本加载器、本地开发加载器、静态预览、自动测试和操作说明。完成后停在真实酒馆导入门，不自动进入记忆或数据库路线。

## Growth Tracks

- 1.x：CLI/MCP Companion、流式讨论、更多世界书批量操作。
- 2.0：L0/L1 轻量公共剧情记忆。
- 2.5：MVU/SP/自定义角色卡适配器。
- 3.0：灵感、大纲、生图等 Creative Provider。
- 4.0：共享事件账本与每角色独立认知记忆。

## Parking Lot

- GitHub 自动创建 Release 的可选流程；当前以版本目录直接发布。
- 实际安装版本能力快照。
- 多 Agent 并发写入、跨设备同步、协作编辑。
- 数据库模板生成、角色卡重封和创意工坊。

## 前端适配结论

桌面采用世界书列表、条目列表、编辑/讨论区三段布局；窄屏改为底部导航与单页切换。所有触控按钮保持可点击尺寸，关键功能不依赖 hover，工作台使用宿主级固定层并处理安全区与软键盘高度。

## 验收账本

- automated：已通过 `npm run verify`（语法、构建、21 项测试）、component 格式验证与权威链验证。
- static-preview：已通过桌面 1440×900 与手机 320×700、375×812、430×900 检查，无横向溢出或页面错误。
- real-host：待真实 Tavern Helper 导入、加载、生成、写入、撤销、切聊天与移动端测试。
- driver：已授权执行，尚未验收成品。

## 下一道门

完成自动化和静态预览后，停止在“导入本地开发加载器并在一次性世界书中测试”的真实宿主门。
