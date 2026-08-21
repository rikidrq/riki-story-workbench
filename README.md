# Riki 剧情工作台 1.0.0

一个与数据库、记忆引擎和灵感二创完全独立的 Tavern Helper 剧情工作台。第一版只负责世界书读取/受控修改、独立剧情讨论、Diff、冲突拒绝、撤销，以及手机/电脑双适配。

## 最方便的更新方式

酒馆里只保留一个很小的加载器。第一次配置好固定发布地址后，以后每次更新只改：

```js
const RIKI_VERSION = '1.0.1';
```

加载器会请求：

```text
<RIKI_RELEASE_BASE>@v<RIKI_VERSION>/dist/releases/<RIKI_VERSION>/riki-workbench.js
```

每个版本使用独立目录，因此不用追踪 `latest`，也不需要为同一 URL 清 CDN 缓存。

固定发布仓库：<https://github.com/rikidrq/riki-story-workbench>

当前构建提供两个加载器：

- `dist/酒馆助手脚本-Riki剧情工作台-本地开发加载器.json`：立即用于本地测试，地址固定为 `http://127.0.0.1:8178/releases`。
- `dist/酒馆助手脚本-Riki剧情工作台-版本加载器.json`：GitHub/jsDelivr 正式加载器，发布地址已经固定，以后酒馆内只改版本号。

每次发布必须使用新的版本目录和同名不可移动标签，例如版本 `1.0.1` 对应 Git 标签 `v1.0.1`。正式加载器从这个标签读取代码，不执行可变的 `main` 分支。

## 后续版本发布

以后修改功能时按以下顺序处理：

1. 修改 `package.json` 中的版本，例如从 `1.0.0` 改成 `1.0.1`。
2. 运行 `npm run verify`，构建器会生成 `dist/releases/1.0.1/riki-workbench.js` 和同步版本号的加载器。
3. 提交并推送到 GitHub `main`，再创建并推送不可移动标签 `v1.0.1`。
4. 等 GitHub 和 jsDelivr 都能读取该标签后，在酒馆加载器中只把 `RIKI_VERSION` 改成 `1.0.1`。

不要删除旧版本目录，也不要移动或重建已经发布的版本标签。旧版本是回退点；如果新版异常，把酒馆中的版本号改回旧版本即可。

## 本地首次使用

在项目目录运行：

```powershell
npm run verify
npm run preview
```

保持预览服务器窗口开启，然后在 Tavern Helper 中导入：

```text
dist/酒馆助手脚本-Riki剧情工作台-本地开发加载器.json
```

导入后可以通过两种入口打开：

- Tavern Helper 脚本按钮「打开 Riki 剧情工作台」；
- 酒馆页面右下角的 `R` 悬浮入口。

不要同时启用 CDN 加载器和本地加载器。两个产物使用同一稳定脚本 ID，正常导入时应替换彼此。

## 世界书工作流

1. 打开工作台，左侧显示全部世界书。
2. 「聊天」「角色」「全局」标签表示当前绑定来源。
3. 选择世界书，再选择条目。
4. 编辑名称、启用状态、激活策略、概率、关键词、插入位置、深度、顺序或正文。
5. 点击「预览 Diff」。此时不会写入。
6. 确认后，工作台通过 `updateWorldbookWith` 读取最新条目数组，并重新校验当前条目 hash。
7. 如果外部已经修改该条目，本次提交会被拒绝，不会静默覆盖。
8. 写入后再次校验返回值；成功的修改可用「撤销最近修改」恢复。

Riki 会串行化自身发起的同一本世界书写入；支持 Web Locks 的宿主还会在同源页面之间加锁。但 Tavern Helper 当前世界书 API 没有原子 CAS，因此无法完全阻止其他扩展或编辑器在同一瞬间覆盖。真实宿主验收必须包含并发编辑测试，重要修改前仍建议保留世界书备份。

撤销记录保存在浏览器本机 `localStorage`，最多保留 20 条，不写入世界书或聊天。撤销前也会检查当前内容是否仍等于工作台刚写入的版本。

## 独立剧情讨论

条目列表右侧的 `+` 用于把条目加入讨论上下文。进入「剧情讨论」后：

- 讨论使用 Tavern Helper 当前连接和 `generateRaw`；
- 不创建主聊天楼层，不自动触发 MVU 或数据库；
- 只发送用户选中的世界书条目与独立讨论历史；
- 模型若返回 `<riki_worldbook_patch>`，只会显示「载入编辑器审查」，绝不自动写入。

独立讨论历史按当前角色/聊天保存在浏览器本机 `localStorage`，最多 40 条消息。

## 手机与电脑

- 桌面：世界书、条目和工作台三栏并列。
- 手机：底部「世界书 / 条目 / 工作台」导航，每次只显示一层。
- 已提供 320、375、430px 和桌面静态检查。
- 软键盘、真实 ST 主题、移动浏览器地址栏和宿主生命周期仍需真实酒馆验收。

## Command Core

运行后，宿主页面暴露：

```js
window.RikiStoryWorkbench
```

只读示例：

```js
await window.RikiStoryWorkbench.dispatch('status');
await window.RikiStoryWorkbench.dispatch('worldbook.list');
await window.RikiStoryWorkbench.dispatch('worldbook.read', { bookName: '世界书名' });
```

两阶段写入：

```js
const patch = await window.RikiStoryWorkbench.dispatch('worldbook.previewPatch', {
  bookName: '世界书名',
  entryUid: 1,
  changes: { content: '完整新正文' },
});

await window.RikiStoryWorkbench.dispatch('worldbook.applyPatch', {
  patch,
  confirmationId: patch.patchId,
});
```

这个 API 是未来 CLI/MCP Companion 的正式入口，但当前没有开放任意 JavaScript 执行、局域网端口或远程写入服务。

## 数据边界

| 数据 | 保存位置 |
|---|---|
| 世界书事实 | Tavern Helper / SillyTavern 原世界书 |
| 最近撤销记录 | 浏览器 `localStorage` |
| 独立讨论记录与上下文选择 | 浏览器 `localStorage`，按聊天隔离 |
| API Key | 本项目不读取、不保存 |
| 构建日志 | 本地 `dist/build-report.json`，不含聊天正文 |

## 开发与验证

```powershell
npm run build
npm test
npm run verify
npm run preview
```

可选视觉检查需要本机已有 Playwright 包和 Chrome/Edge，不会自动安装浏览器：

```powershell
$env:RIKI_PLAYWRIGHT_PATH='Playwright包路径'
$env:RIKI_BROWSER_EXECUTABLE='浏览器exe路径'
npm run check:visual
```

## 当前证据边界

- 自动化：构建、语法、21 项核心测试和 TavernWeave component 验证已在本地通过。
- 静态预览：桌面与 320/375/430px 响应式检查可完成。
- 远程发布：公开仓库、`main`、`v1.0.0` 标签和 GitHub Actions 已建立；jsDelivr bundle 已与本地 SHA-256 核对一致。
- 真实宿主：尚未安装或导入到你的实际 SillyTavern/Tavern Helper。
- 驾驶员：尚未进行真实使用验收。

真实宿主步骤见 [真实酒馆验收清单](docs/REAL_HOST_CHECKLIST.md)。
