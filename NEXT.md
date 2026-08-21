# Riki 剧情工作台 · NEXT

## 当前权威

- 总设计案：`docs/TOTAL_DESIGN.md`
- 蓝图索引：`docs/BLUEPRINT_INDEX.md`
- 活动蓝图：`docs/blueprints/BP-01-first-usable.md`
- 当前阶段：BP-01 自动化与静态预览已完成，停在真实 Tavern Helper 导入门

## 已确认事实

- 驾驶员已明确说“按蓝图开跑第一版”。
- 交付模式冻结为 Tavern Helper `component`。
- 日常更新合同为只改加载器中的 `RIKI_VERSION`。
- 旧 Riki、Cortex、数据库和二创均不写。
- 真实 MCP/CLI Companion 不进入当前实现，但 Command Core 必须可复用。

## 最近证据

- TavernWeave Library 2026-08-18 路由已加载 A0/A2/A5/A6/B2/C1/D3/D5/E5。
- Tavern Helper 4.8.19 固定声明已核对 `generateRaw` 与 Worldbook API 形状。
- 项目写入门已由驾驶员确认。
- P1 权威链与零依赖工程骨架已创建，权威校验通过。
- `npm run verify` 已通过：语法、构建与 21 项测试全部通过。
- TavernWeave component 产物验证已通过，交付边界保持为 `component`，没有生成角色卡 JSON/PNG。
- 静态预览已通过桌面 1440×900 与手机 320×700、375×812、430×900 检查；无横向溢出、控制台错误或页面错误。
- 本地第一版实现已完成；真实 SillyTavern/Tavern Helper 导入、写入与移动端手感仍未验收。

## 开放风险

- 未取得真实安装的 ST/TH 版本与能力快照。
- 远程发布地址已固定为 `rikidrq/riki-story-workbench`；首次 GitHub 推送与 CDN 回读待完成。
- 动态 import、父页面挂载、世界书持久化和移动端键盘行为需真机验证。

## 下一道门

导入 `dist/酒馆助手脚本-Riki剧情工作台-本地开发加载器.json`，在一次性聊天和测试世界书中完成真实宿主验收。该门通过前不得标记 real-host 或 driver 为通过。

## 一句续接

从真实 Tavern Helper 导入清单继续，保持 `runtimePersistentBlueprintBudget = 0`，不要进入 Growth Tracks。
