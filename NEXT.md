# Riki 剧情工作台 · NEXT

## 当前权威

- 总设计案：`docs/TOTAL_DESIGN.md`
- 蓝图索引：`docs/BLUEPRINT_INDEX.md`
- 活动蓝图：`docs/blueprints/BP-01-first-usable.md`
- 当前阶段：1.1.0 自动化与静态点击证据完成，停在真实 Tavern Helper / 手机真机验收门

## 已确认事实

- 驾驶员已明确说“按蓝图开跑第一版”。
- 交付模式冻结为 Tavern Helper `component`。
- 日常更新合同为只改加载器中的 `RIKI_VERSION`。
- 旧 Riki、Cortex、数据库和二创均不写。
- 真实 MCP/CLI Companion 不进入当前实现，但 Command Core 必须可复用。
- 第一版完成标准改为：与 `Riki剧情助手 2.2.0` 的非数据库主体一致；不再接受“世界书 + 简单讨论”作为完成。
- 模型连接/API 预设/System 预设/模块覆盖、分支会话、策划 Agent、成果版本、流式交互、日志与项目导入导出均进入 1.1.0。

## 最近证据

- TavernWeave Library 2026-08-18 路由已加载 A0/A5/B1/B2/C1/C2/C3/C9/C10/C11/C12/C13/D3/D7。
- Tavern Helper 4.8.19 固定声明已核对 `generateRaw` 与 Worldbook API 形状。
- 项目写入门已由驾驶员确认。
- P1 权威链与零依赖工程骨架已创建，权威校验通过。
- `npm run verify` 已通过：语法、五模块构建与 114 项逻辑回归全部通过。
- TavernWeave component 产物验证已通过，交付边界保持为 `component`，没有生成角色卡 JSON/PNG。
- 静态点击旅程已通过桌面 1440×900 与手机 320×700、375×812、430×900；无横向溢出、控制台错误或页面错误。
- 78 个渲染 action 全部有处理器；浏览器实走了分支、偏好、模型/System、模块绑定、世界书 Diff/写入/撤销、成果确认/修改/回收站、项目导入导出、消息编辑/重 Roll/复制、日志导出与移动关闭/重开。
- 七项运行模拟覆盖详细版、粗略人物→精细人设、懒人五步→回滚→重跑、后台生成、Command Core 和格式编译最近草稿。
- 发布审计确认 1.1 产物不含数据库/二创运行符号、无字面密钥，构建 SHA-256 精确，已发布 `v1.0.0` 字节未变化。
- 2.0/2.5/3.0/4.0 每版约 300 字摘要与详细设计均已写入 `docs/roadmap/`。
- GitHub 公开仓库 `rikidrq/riki-story-workbench` 已创建，`main` 与不可移动标签 `v1.0.0` 已推送。
- GitHub Actions Verify 已通过；GitHub raw、标签 raw 与 jsDelivr bundle 的 SHA-256 已和本地逐字节核对一致。

## 开放风险

- 未取得真实安装的 ST/TH 版本与能力快照。
- 正式远程地址和 `v1.0.0` 标签已发布；后续版本必须新建 `v<version>` 标签，不能移动旧标签。
- 动态 import、父页面挂载、世界书持久化和移动端键盘行为需真机验证。
- Connection Manager 实际 profile 流、酒馆当前连接事件、extensionSettings 落盘、软键盘与横竖屏仍需真实宿主/真机验证。

## 下一道门

导入 `dist/酒馆助手脚本-Riki剧情工作台-本地开发加载器.json`，在一次性聊天、测试世界书和手机真机完成 `docs/REAL_HOST_CHECKLIST.md`。该门通过前不得标记 real-host 或 driver 为通过。

## 一句续接

从 1.1.0 真实 Tavern Helper 导入验收继续；保持 `runtimePersistentBlueprintBudget = 0`，不要进入 2.0 实现。
