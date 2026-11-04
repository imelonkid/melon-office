# melon-office

把 Claude Code 会话画成一层大厂工区的可视化工具：每个会话是一个员工，干活、举手要审批、去茶水间摸鱼。给同时开好几个 Claude Code 会话的人用。**公开仓库**。

## 边界（强制）

Claude 在本项目里只做下面「负责」的事；越界的需求先停下来和用户确认，不要顺手改到别的项目里。

- **本项目负责**：
  - `server/`：工区核心（`office.mjs` 状态机、`translate.mjs` 命令翻译、`memory.mjs`、`report.mjs`、`settings.mjs`）、本机桥接服务（`index.mjs`）、Claude Code hooks 的安装 / 移除（`hooks-config.mjs`）
  - `web/`：网页版工区（Phaser + Vite），`tools/render_assets.py` 生成全部美术
  - `bin/melon-office.mjs`、`install.sh`：命令行版与一行安装
  - `mac/`：原生 macOS 菜单栏 App（SwiftUI / SpriteKit；`server/` 的核心经 `mac/core/` 打包进 JavaScriptCore 运行）
  - `scripts/`：CI 与（以后的）打包、发布脚本
- **本项目不负责**：
  - **Claude Code 本身**：只通过公开的 hooks 机制接入，只改 `~/.claude/settings.json`（或项目的 `.claude/settings.local.json`）里带 `X-Melon-Office` 标记 / 指向本机 `/hook/permission` 的那几条，别的配置一律不碰
  - **服务器**：纯本机工具，不部署到服务器，不登记运维注册表。安装包发布到对象存储下载站不算部署
  - **发布流水线本体**（→ `imelonkid/melon-ci`）与**门户登记**（→ 运维仓库 `$OPS_REPO/portal/config.json`）：本仓库只放调用它的表单；要改流水线或门户先和用户确认，在对应仓库改
- **与其他项目的关系**：依赖 Claude Code 的 hooks 协议、melon-ci 的流水线（`@v2`）；没有项目依赖本仓库
- **契约**：
  - hooks 协议：被动事件 `POST http://127.0.0.1:<端口>/hook`（command hook，`async`，带 `X-Melon-Office: 1`），审批 `PermissionRequest` → `http://127.0.0.1:<端口>/hook/permission`（http hook）；默认端口 7777。命令行版与 Mac 版共用同一套，改了要两边一起改、一起测
  - `~/.config/melon-office/settings.json`、`memory.json`：命令行版与 Mac 版共用，只增字段不改字段

## 运行

```bash
npm install
npm run dev            # 桥接 :7777 + Vite :5173 热更新
npm run demo           # 演示模式
npm test               # 单测（node --test）
scripts/ci-test.sh     # 与 PR 检查相同的一套
npm run mac            # → mac/build/Melon Office.app
```

- 命令行版和 Mac 版**不要同时跑**（都占 7777）
- 用户日常就开着 Melon Office：测 hooks 的安装 / 移除用测试里的临时 HOME，不要动用户真实的 `~/.claude/settings.json`

## 约定

- 业务逻辑放在 `server/` 的 JS 里，命令行版与 Mac 版（JavaScriptCore）共用；Swift 只做界面和系统集成，不重写逻辑
- hooks 不能拖慢 Claude：被动事件一律 `async` + 失败静默；审批只有工区页面开着时才挂起，否则立刻放行给终端
- 桥接只监听 `127.0.0.1`；hook 载荷里有代码和命令，不写日志、不外发
- 改代码同步改 `README.md` 与 `README.zh-CN.md`（面向用户）；运维内容写 `docs/MAINTAINING.md`，README 不引用它
- 发布与回滚一律走 tag，**只在内网门户上点**（GitHub「发布」表单兜底）；版本号：修 bug → patch，新功能 → minor，不兼容 → major。发布方式见 `docs/MAINTAINING.md`
- PR 一律以 `main` 为目标，不开叠加 PR
- 代码修改并通过验收后，主动提交并 Push，不等用户追问；若需要审批，主动发起审批。Push 后跟进该提交的 CI，失败则修复后再次 Push，直到通过或遇到需要用户决策的问题。不自动合并，不自动发布
- **PR 合并（或关闭）后这个分支就作废**：后续改动先 `git switch main && git pull`，再开新分支。已经在旧分支上提交了的，把新提交 `git cherry-pick` 到新分支再开 PR
- 公开仓库：不写主机地址、内网坐标与任何密钥；提交信息 `<类型>(<范围>): <中文描述>`
