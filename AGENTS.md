# Riki 剧情工作台工程规则

- 本项目是独立的 Tavern Helper 剧情与世界书工作台，不修改相邻旧项目。
- 当前冻结范围为 Riki 2.2.0 的非数据库主体逐项同构：分支、常规/懒人策略、消息操作、四类策划成果、世界书、偏好、Agent 调度、日志、项目迁移、酒馆连接预设/模型/System 配置与响应式 UI。
- 数据库、MVU、记忆引擎、角色卡改造、灵感二创、生图和真实 MCP Companion 都不进入当前实现。
- `src/riki-workbench.js` 是运行时代码事实源；`dist/` 是构建产物。
- 世界书普通修改必须使用 updater 内重验，不以整书旧快照覆盖并发修改。
- Riki 自身写入必须按世界书串行化；宿主 API 无原子 CAS，不能宣称完全阻止外部并发覆盖。
- 不把 API Key、完整请求日志或私密聊天写入世界书、脚本 data 或导出产物。
- 保留 Tavern Helper 脚本稳定 ID、按钮、data 与 export_with 形状。
- 所有宿主 API 都要能力检测；固定声明快照不能冒充真实宿主验收。
- 运行 `npm run verify` 后才能交付本地产物。
- `docs/RIKI-2.2.0-INTERACTION-AUDIT.md` 是功能分母；不得用 README 推断或自创原版行为。
- Git、安装、发布、部署、真实外部写入和驾驶员验收都是独立授权门。
