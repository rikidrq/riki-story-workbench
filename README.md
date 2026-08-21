# Riki剧情助手 1.2.0

Riki剧情助手是可导入 Tavern Helper 的完整剧情策划工具。1.2 以本地原版 `Riki剧情助手 2.2.0` 的真实 UI、README 与 `src/v0.5` 提示词为迁移基线，保留分支 Agent、模型连接与预设、主控/总纲/大章/小章/人物/格式编译、正式成果提案与版本、回收站、流式生成、日志、项目导入导出和世界书受控修改；明确移除 SP·数据库内核、数据库 Agent/模板/运行期、推进预设、灵感二创、生图、素材库、MVU 迁移和记忆引擎。

## 最方便的更新方式

电脑和手机的酒馆里都只保留同一个微型加载器。以后升级只改其中这一行：

```js
const RIKI_VERSION = '1.2.0';
```

加载器固定从以下不可移动版本标签读取：

```text
https://gcore.jsdelivr.net/gh/rikidrq/riki-story-workbench@v1.2.0/dist/releases/1.2.0/riki-workbench.js
```

每次发布都会保留旧版本目录和旧 Git 标签。新版异常时，把版本号改回 `1.0.0` 即可回退；不要移动或覆盖已发布标签。

## 电脑端导入

1. 下载 `dist/酒馆助手脚本-Riki剧情工作台-版本加载器.json`。
2. 打开 SillyTavern，进入 Tavern Helper / 酒馆助手的脚本管理。
3. 导入该 JSON，并确认脚本已启用。
4. 刷新酒馆页面。
5. 点击脚本按钮「打开 Riki 剧情工作台」，或点击页面右下角 `R`。
6. 第一次打开后进入右侧「配置」标签，点击「打开完整配置」，选择酒馆当前连接、Connection Manager profile 或独立 OpenAI-compatible API。

本地开发测试时运行：

```powershell
npm run build
npm run preview
```

然后导入 `dist/酒馆助手脚本-Riki剧情工作台-本地开发加载器.json`。本地加载器与正式加载器使用同一个稳定脚本 ID，不要同时启用两份。

## 手机端导入

手机浏览器中的 SillyTavern 导入步骤与电脑一致：

1. 把正式加载器 JSON 下载到手机“下载”目录，或从电脑传到手机。
2. 在手机酒馆的 Tavern Helper 脚本管理中选择“导入”，从文件选择器选中 JSON。
3. 启用脚本并刷新页面；右下角会出现 `R`。
4. 手机沿用原版交互：左上角汉堡按钮打开 Agent 对话抽屉，右上角齿轮打开七标签工作台；再次点击同一按钮回到聊天。
5. 点击右上角 `×` 会真正隐藏全屏遮罩；再次点击 `R` 可重开，生成中的任务不会因视觉关闭而被销毁。

手机第一次配置独立 API 时要特别注意：HTTPS 酒馆不能直接请求 HTTP API；服务端还必须允许浏览器跨域。出现 `Failed to fetch` 时，Riki 会明确提示跨域、HTTPS 混合内容或网络不可达，不会私自切换连接方式。

## 工作台区域

### 对话

- 左侧创建、重命名和删除 Agent 对话；右侧「偏好」可复制偏好到新对话。
- 每个分支拥有独立消息、工作流、偏好、世界书上下文和待确认候选；已确认成果由项目共享。
- 右侧「Agent」可查看并切换主控、总纲、大章、小章、人物和格式编译 Agent，也能设置总纲/大章/小章详细度。
- 用户消息支持编辑与删除；助手消息支持重 Roll、复制和删除。
- 生成实时显示；可停止。关闭工作台后允许后台继续，重开可看到结果。

### 三种工作流

- 详细版：先讨论和澄清，再明确生成正式候选并逐项确认。
- 粗略版：先产出结构骨架；人物先判断上/中/下档，中上档逐人确认后再生成精细人设。
- 懒人版：自动按总纲 → 大章 → 小章 → 人物执行，逐步保存断点；完成后统一确认，也可整批回滚到开始前。

### 成果

正式成果分为总纲、大章、小章和人物四类。模型输出先成为候选，不会自动写入项目事实。大章、小章和人物可逐项确认或打回；确认后保存连续版本、来源分支和基础版本。另一分支已保存新版时，旧候选会因基线过期而拒绝覆盖。

成果工作台可查看历史版本、完整 JSON 和 Diff，也能基于当前版本创建修改候选。删除上游成果会把依赖的下游成果作为一批放进回收站；可整批恢复或永久清空。

### 世界书

1. 读取全部世界书，并显示聊天/角色/全局绑定标签。
2. 按条目选择要发送给策划 Agent 的上下文。
3. 编辑原条目名称、启用状态、策略、关键词、位置、深度、概率和正文。
4. 点击「预览 Diff」时不会写入。
5. 确认后，Riki 在 `updateWorldbookWith` 的 updater 内重读并校验条目 hash。
6. 外部已改动时拒绝覆盖；成功后写后回读，并允许撤销最近一次修改。

### 模型与预设

支持三条连接：

- 酒馆当前连接：调用 Tavern Helper `generateRaw`，不创建主聊天楼层。
- Connection Manager：只保存 profile ID，不复制酒馆密钥或 secret ID。
- 独立 OpenAI-compatible：支持 SSE 流式、停止、超时、有限重试和模型列表；默认浏览器直连，`viaBackend` 默认关闭。

可保存多套 API 配置和 Agent System 预设；可从酒馆当前预设复制已启用的 System 内容。配置继承顺序为模块覆盖 → 次 Agent 默认 → 主控 → 设备全局。格式编译默认继承目标模块的 API 与模型，也可单独覆盖。

API Key 和完整配置库只存设备级 `extensionSettings` / `localStorage`。项目 metadata 只保留非敏感 preset ID、模型覆盖和项目状态；日志、项目导出、世界书与消息都不会写入 API Key。

### 诊断与导入导出

请求日志记录路由、传输、模型、完整输入/输出、状态、耗时和错误，但会深层移除 Key、Authorization、token、private key 与 Connection Manager secret。可查看或导出单轮摘要、输入和输出。

项目导出包含四类成果的完整版本链、决策和分支偏好，不包含模型配置、Key、请求日志或聊天消息。导入前校验格式；当前项目已有成果时必须明确选择替换，旧成果会先进入回收站。

## Command Core

运行后宿主页面暴露：

```js
window.RikiStoryWorkbench
```

常用只读调用：

```js
await RikiStoryWorkbench.dispatch('status');
await RikiStoryWorkbench.dispatch('conversation.list');
await RikiStoryWorkbench.dispatch('artifact.current', { kind: 'outline' });
await RikiStoryWorkbench.dispatch('model.resolve', { moduleId: 'outline' });
await RikiStoryWorkbench.dispatch('worldbook.list');
```

世界书写入继续采用两阶段合同：

```js
const patch = await RikiStoryWorkbench.dispatch('worldbook.previewPatch', {
  bookName: '世界书名',
  entryUid: 1,
  changes: { content: '完整新正文' },
});

await RikiStoryWorkbench.dispatch('worldbook.applyPatch', {
  patch,
  confirmationId: patch.patchId,
});
```

Command Core 是未来 MCP/CLI Companion 的入口，但 1.2 不开放局域网端口、远程任意执行或无确认写入。

## 开发与验证

```powershell
npm run check:syntax
npm test
npm run build
npm run verify
npm run verify:full
```

`npm test` 当前依次运行旧世界书回归、项目状态机、模型连接、策划契约、详细/粗略/懒人模拟和 UI action 合同。`verify:full` 另运行 Playwright 桌面 1440×900 与手机 320×700、375×812、430×900 真点击巡检。

视觉检查使用本机已有 Playwright 与 Chrome/Edge：

```powershell
$env:RIKI_PLAYWRIGHT_PATH='Playwright 包目录'
$env:RIKI_BROWSER_EXECUTABLE='Chrome 或 Edge exe 路径'
npm run verify:full
```

自动化、静态预览、真实 SillyTavern/Tavern Helper、手机真机和驾驶员验收是五道不同证据门。真实宿主尚未完成前，不把本地通过冒充真机通过。清单见 [真实酒馆验收清单](docs/REAL_HOST_CHECKLIST.md)。

## 后续版本

快速摘要见 [后续版本 300 字说明](docs/roadmap/ROADMAP-300.md)，详细设计见 [路线索引](docs/roadmap/README.md)。
