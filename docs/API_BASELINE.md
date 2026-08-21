# Tavern Helper API 基线

本项目不把移动分支文档当永久事实。当前实现采用固定声明快照，并在运行时逐项检测能力。

## 固定权威

- Tavern Helper / JS-Slash-Runner：`4.8.19`
- commit：`36d8889a99f1cf09d3d1f8aabd0eba33975dc64d`
- Worldbook 声明：`@types/function/worldbook.d.ts`
- Generation 声明：`@types/function/generate.d.ts`

## 敏感符号台账

| symbol | surface | applies_to | confidence | runtime check |
|---|---|---|---|---|
| `getWorldbookNames` | Tavern Helper | 4.8.19 固定声明 | medium，声明级 | 启动时 `typeof`；真实返回待验 |
| `getGlobalWorldbookNames` | Tavern Helper | 4.8.19 固定声明 | medium | 可选；缺失时不标全局绑定 |
| `getCharWorldbookNames('current')` | Tavern Helper | 4.8.19 固定声明 | medium | 可选；缺失时不标角色绑定 |
| `getChatWorldbookName('current')` | Tavern Helper | 4.8.19 固定声明 | medium | 可选；缺失时不标聊天绑定 |
| `getWorldbook(name)` | Tavern Helper | 4.8.19 固定声明 | medium | 启动时检测；真实数组字段待验 |
| `updateWorldbookWith(name, updater, {render})` | Tavern Helper | 4.8.19 固定声明 | medium | 缺失时强制只读；写入与持久化待验 |
| `generateRaw(config)` | Tavern Helper | 4.8.19 固定声明 | medium | 缺失时关闭剧情讨论；真实模型行为待验 |
| `getButtonEvent` + `eventOn` | Tavern Helper | 4.8.19 固定声明 | medium | 缺失时使用宿主悬浮 R 入口 |
| `stopGenerationById` | Tavern Helper | 4.8.19 固定声明 | medium | 可选；缺失时不显示可靠停止能力 |
| `ConnectionManagerRequestService.getSupportedProfiles` | SillyTavern Connection Manager | 目标宿主运行时 | medium | 仅保存 profile ID；真实列表待验 |
| `ConnectionManagerRequestService.sendRequest` | SillyTavern Connection Manager | 目标宿主运行时 | medium | async iterable 累积流、AbortSignal 与错误脱敏待真机验证 |
| `getPresetPrompts` / Preset Manager | Tavern Helper / SillyTavern | 目标宿主运行时 | medium | 只复制启用的 System 内容；多版本路径能力探测 |

## 运行边界

- `generateRaw` 返回文本不会被当成真实聊天楼层或 MVU 更新。
- 世界书条目以 `uid` 在单本世界书内定位，不跨书复用。
- 普通写入只走 `updateWorldbookWith`，updater 中重新核验完整条目 hash。
- 未找到固定声明中的必要函数时显示能力错误，不回退到 deprecated Lorebook API 或私有宿主 DOM。
- 模型设备配置只落 `extensionSettings` 或本地存储；项目聊天 metadata 不保存 API Key、profile secret 或完整设备配置库。
- 独立 API 默认浏览器直连；`Failed to fetch` 不静默改走酒馆后端或其他连接。
- 顶层控制台可见不证明 Tavern Helper 脚本 iframe 内可见；真实导入必须重新采集版本和能力。
