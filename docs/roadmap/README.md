# Riki 剧情工作台 · 后续版本路线索引

快速阅读版见 [每版约 300 字摘要](./ROADMAP-300.md)；本目录其余四份为保留的详细设计稿。

本目录记录 V1.1 之后的四个远期版本方向。它们是设计说明，不是已完成功能、发布日期承诺或真实宿主验收报告。当前实施权威仍是项目根目录的 `docs/TOTAL_DESIGN.md`、活动蓝图与 `NEXT.md`；路线文档只有在对应版本正式重开蓝图、经过驾驶员确认后，才能转成实施合同。

## 阅读顺序

1. [V2.0：轻量公共剧情记忆引擎](./V2.0-light-memory-engine.md)
   - 在 V1.1 剧情工作台上增加 L0/L1 公共剧情记忆。
   - 默认本地、确定性召回、少调用模型、每条可追溯可撤销。
   - 不做每角色主观认知，不做向量数据库和重型知识图谱。

2. [V2.5：角色卡模板迁移与统一标准](./V2.5-card-template-migration.md)
   - 以适配器读取 MVU、SP/其他数据库模板和普通脚本卡。
   - 迁到可审查的 `Riki Card Package` 中间标准，未知组件保留而非静默丢失。
   - 默认只读来源、沙箱预览、导出新文件，不原地覆盖角色卡。

3. [V3.0：多灵感二创与 Creative Provider 平台](./V3.0-creative-providers.md)
   - 接入多个文本灵感、视觉提示词和生图 Provider。
   - 统一任务、权限、费用、结果、素材和失败回退。
   - 创意输出默认只是候选，不自动成为剧情事实或覆盖角色资产。

4. [V4.0：每角色独立记忆生态](./V4.0-role-memory-ecology.md)
   - 在公共事件账本之上区分“世界发生”“角色感知”“角色相信”。
   - 支持秘密、传闻、误解、纠正、沉睡和角色视角胶囊。
   - 不宣称模拟意识，不让每个角色每轮都运行一个自主 Agent。

## 总体依赖关系

```text
V1.1 非数据库剧情工作台
  └─ V2.0 公共剧情记忆与稳定事件引用
       └─ V2.5 角色卡适配与统一组件/角色 ID
            └─ V3.0 多 Creative Provider 与受控素材去向
                 └─ V4.0 公共事件 + 每角色独立感知/信念
```

这个顺序表达数据和权限的依赖，不表示前一版所有功能都必须强制开启。V2.0 关闭时 V1.1 仍应完整可用；V2.5 迁移是用户显式任务；V3.0 Provider 可逐个禁用；V4.0 只对用户选择的项目与角色启用。

## 四份路线共同遵守的原则

- 不把路线写成“已经完成”。每个版本都要重新建立蓝图、实现、自动化、静态预览、真实 SillyTavern/Tavern Helper 和驾驶员验收证据。
- 不移动旧版本标签。正式发布继续使用不可变 `v<version>` 与 `dist/releases/<version>`，让用户通过加载器中的单一版本号升级或回退。
- API Key、cookie 和 Connection Manager 密钥只留在设备级安全配置；项目、日志、世界书、角色包和导出不携带密钥。
- 自动候选不等于事实。世界书修改、剧情成果、公共记忆、角色认知和创意素材各走自己的 Diff、确认、版本与撤销链。
- 手机不是桌面缩小版。320/375/430px 要逐按钮、逐弹窗、逐关闭路径验证，软键盘、安全区、后台恢复和触摸目标都进入发布门。
- 插件/Provider/适配器使用显式 capability、权限和 schema；不从未知远程 URL 动态执行代码，不把单个旧项目的私有全局函数变成核心依赖。
- 失败要可理解、可恢复。CORS、混合内容、认证、存储、schema、宿主能力和外部服务错误分别诊断，不静默换路、不伪造成功。

## 篇幅统计

统计口径：UTF-8 文本去除所有空白字符后的字符数；“汉字数”为 Unicode CJK Unified Ideographs 的近似计数。统计于 2026-08-21，后续修订应重新运行同一口径。

| 文件 | 总字符 | 非空白字符 | 近似汉字数 |
|---|---:|---:|---:|
| `V2.0-light-memory-engine.md` | 13,220 | 12,535 | 9,229 |
| `V2.5-card-template-migration.md` | 12,645 | 11,974 | 8,619 |
| `V3.0-creative-providers.md` | 13,151 | 12,289 | 8,212 |
| `V4.0-role-memory-ecology.md` | 13,661 | 12,929 | 8,938 |

PowerShell 复核命令：

```powershell
Get-ChildItem docs\roadmap\V*.md | Sort-Object Name | ForEach-Object {
  $text = Get-Content -Raw -Encoding UTF8 $_.FullName
  [pscustomobject]@{
    Name = $_.Name
    Chars = $text.Length
    Nonspace = ([regex]::Replace($text, '\s', '')).Length
    CJK = ([regex]::Matches($text, '[\p{IsCJKUnifiedIdeographs}]')).Count
  }
} | Format-Table -AutoSize
```

四份正文都超过九千个非空白字符，并以约一万字的产品/工程说明为目标。篇幅不是完成证据；真正进入对应版本时，应把路线拆成可验证的版本合同与分期蓝图，而不是直接照文档一次性堆功能。
