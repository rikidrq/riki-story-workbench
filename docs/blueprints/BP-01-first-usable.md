# BP-01 · 第一版可用闭环

## 输入

已确认的第一版合同、Tavern Helper 4.8.19 固定声明、现有 Riki/Cortex 的只读复用证据、TavernWeave A0/A2/A5/A6/B2/C1/D3/D5/E5。

## 输出

- 版本化运行 bundle。
- 可导入 Tavern Helper 的 CDN/本地加载器。
- 世界书读取、受控修改、冲突检测、写后重读和撤销。
- 独立剧情讨论与响应式工作台。
- Command Core 运行时 API、静态预览、测试和用户说明。

## 允许修改范围

仅 `riki-story-workbench/` 新项目目录。旧 Riki、Cortex、数据库、插件、角色卡和真实 SillyTavern 安装目录全部只读。

## 禁止事项

不安装、不发布、不提交 Git、不触碰密钥、不调用付费 API、不写旧项目、不实现 Growth Tracks、不生成角色卡 JSON/PNG。

## 执行步骤

- P1：创建权威链、项目骨架和版本来源。
- P2：实现纯函数核心、宿主适配、世界书事务、历史和命令分发。
- P3：实现讨论、UI、响应式状态与生命周期清理。
- P4：构建版本目录、加载器、组件 spec、预览服务器和文档。
- P5：验证所有退出条件并更新 NEXT。

## 退出条件

- `npm run verify` 通过。
- TavernWeave 权威链验证通过。
- component 模式产物验证通过且没有卡 JSON/PNG。
- 加载器日常只需改一个 `RIKI_VERSION` 常量。
- mock 世界书覆盖读取、成功提交、陈旧冲突、撤销和讨论调用。
- 静态预览存在窄屏与桌面布局契约。
- 真实宿主未测边界明确列出。

## 失败回退

发生实现错误时只建立一条非持久问题支线，解决后返回当前步骤。宿主 API 无法静态确认时保留能力失败状态，不猜测私有 DOM 或旧 Lorebook API。

## 停止条件

需要外部安装/发布/密钥/付费调用；真实宿主与固定声明不兼容；或必须扩大 First Usable 才能继续。

## 下一道门

导入本地开发加载器，在一次性聊天和测试世界书中完成真实宿主验收。

## P5 结果证据

- `npm run verify`：通过，包含语法检查、构建与 21 项测试。
- 权威链：`validate-project-authority.mjs --automation` 通过。
- 组件：TavernWeave component 构建与验证通过，未生成角色卡 JSON/PNG。
- 静态预览：桌面 1440×900、手机 320×700 / 375×812 / 430×900 均通过，无横向溢出或页面错误。
- 真实宿主：未运行；BP-01 保持 active，等待真实 Tavern Helper 导入门。
