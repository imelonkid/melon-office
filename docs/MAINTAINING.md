# 维护说明

面向维护者：项目基线（`.melon-baseline`）要求的运维内容放在这里，`README.md` 只写产品本身。

## 项目类型

按项目基线 v3 的「桌面应用（独立客户端，没有自己的服务端）」接入：

- **Mac 版**：原生菜单栏 App，安装包与版本清单放对象存储，发布走 melon-ci `desktop-release`
- **命令行版**：`install.sh` 一行安装（git clone 到 `~/.melon-office` 再构建），`melon-office update` 重新跑一遍；不经过发布流水线
- App 与本机桥接不部署到服务器；独立宣传页按下述静态宣传页基线注册和发布

## 技术选型例外

| 项 | 基线默认 | 本项目 | 原因 |
|---|---|---|---|
| 桌面端技术栈 | Electron + electron-builder | Swift 原生（SwiftUI / SpriteKit）+ JavaScriptCore 跑 `server/` 的核心 | 常驻菜单栏、系统通知里直接审批、置顶透明小窗，原生做得更轻；核心逻辑仍是 JS，与命令行版共用一份 |
| 打包 | electron-builder 出 dmg | `mac/build.sh`（以后由打包钩子 `scripts/package-desktop.sh` 调用） | 原生 App |
| 架构 | Mac arm64 先行 | universal（arm64 + x86_64） | Swift 编译 universal 没有额外成本 |
| `package.json` 的 `version` | 固定 `0.0.0`、构建时注入 | 保留真实版本号 | 命令行版从 git 安装、不经流水线，要靠它显示版本；Mac 版发布时以 tag 为准注入 `Info.plist` |

## 上线准入

| 项 | 状态 |
|---|---|
| `.melon-baseline`、`CLAUDE.md`（边界）、本文档 | ✓ |
| PR 检查：`.github/workflows/ci.yml` → melon-ci `pr-check@v2`，跑 `scripts/ci-test.sh` | ✓ |
| 单测：hooks 的安装 / 移除 / 状态（`test/`） | ✓ |
| 打包钩子 `scripts/package-desktop.sh`（调 `mac/build.sh`）、产物检查 `scripts/verify-build.sh`、发布脚本 `scripts/release-desktop.sh` + `lib-release.sh`、发布表单 `release-desktop.yml`（`manifest: oss`、`runner: macos-26`、`sign: true`） | ✓ |
| 客户端检查更新（`mac/Sources/MelonOffice/Updater.swift`：启动 10 秒后、每 6 小时、唤醒后读 `latest.json`；本机开发版不查） | ✓ |
| 启动时对账 Claude Code hooks（缺了问、旧了修、拒绝过不再弹；`hooks-config.mjs` 的 `check()` / `repair()`，Mac 版与 `melon-office start` 共用） | ✓ |
| GitHub 设置（`github-apply.sh --kind desktop`）、production 环境 | 待做 |
| 对象存储下载站前缀、只写子账号 | 待做 |
| 门户登记（运维仓库 `portal/config.json`） | 待做 |

## 发布与回滚

接入发布流水线之前，Mac 版只能本机 `npm run mac` 构建（`NOTARY_PROFILE=<钥匙串配置> npm run mac` 同时公证），不对外分发安装包。

发布：门户应用页点「发布」（GitHub Actions「发布」表单兜底）→ melon-ci 门禁（发布窗口、main 的 CI 全绿）→ 打 `vX.Y.Z` → macOS 26 构建机跑 `scripts/release-desktop.sh build`（`package-desktop.sh` → `mac/build.sh`，版本号注入 `Info.plist`，`verify-build.sh` 检查产物）→ 流水线签 dmg、公证、钉票据 → `publish`：先传 `MelonOffice-<版本>-universal.dmg`、最后传 `latest.json`（`files` / `sha256` 的 `arm64`、`x86_64` 都指向这个 universal 安装包）→ GitHub Release。

| 项 | 值 |
|---|---|
| 下载站 | `https://melon-download.oss-cn-beijing.aliyuncs.com/melon-office/desktop/`（写死在 `Updater.swift` 与 `release-desktop.sh` 的 `OSS_PREFIX`） |
| 本机试打包 | 提交后打一个只在本地的 tag（如 `git tag v9.9.9`），`scripts/release-desktop.sh build v9.9.9 <目录>`，用完 `git tag -d v9.9.9`；不签名（ad-hoc），不上传 |
| 版本号 | tag 为准；`package.json` 的 `version` 给命令行版显示用，发版后顺手改成同一个版本 |

回滚：装到用户电脑上就收不回来，客户端只提示更新的版本。新版有问题 → 修好后发 patch；要让新下载先回到旧版，把旧版的 `latest.json`（GitHub Release 里有 dmg）重新传上去。

## GitHub production 环境

| 名称 | 类型 | 用途 |
|---|---|---|
| `OSS_BUCKET`、`OSS_ENDPOINT` | 变量 | 下载站对象存储 |
| `OSS_ACCESS_KEY_ID`、`OSS_ACCESS_KEY_SECRET` | Secret | 只能写本项目前缀、不能删的子账号 |
| `MACOS_CERT_P12_BASE64`、`MACOS_CERT_P12_PASSWORD` | Secret | Developer ID Application 证书 |
| `NOTARY_KEY_P8_BASE64`、`NOTARY_KEY_ID`、`NOTARY_ISSUER_ID` | Secret | App Store Connect API 密钥（公证） |

值存 1Password `ops/melon-office/prod`，由仓库所有者本人 `gh secret set … --env production` 写入。

## 已知限制

- 命令行版与 Mac 版都占 7777 端口，不能同时运行
- hooks 指向固定端口：改了端口要重新「接入 Claude Code」

## 手工验收：启动时接入 Claude Code（Mac 版）

单测覆盖了 `check()` / `repair()`；弹窗、通知、菜单要在真机上点。先备份 `~/.claude/settings.json`，`defaults delete cn.melonkid.melon-office hooksChoice` 清掉记住的选择。

| 场景 | 怎么准备 | 期望 |
|---|---|---|
| 全新用户 | `melon-office uninstall`，清掉 `hooksChoice` 与 `askedHooks` | 打开 App 弹「接入 Claude Code？」；点「接入」后 `melon-office status` 列出全部事件 |
| 已接入用户升级 | `melon-office init --port 8123`（模拟旧配置） | 打开 App 不弹窗，收到「已更新 Claude Code 接入」通知；`status` 不再提示过期 |
| 拒绝过的用户 | 弹窗点「以后再说」，或在设置中关闭接入 | 再次打开不弹窗；「设置 → 接入」的 Claude Code 开关保持关闭 |
| 命令行版装过 | `melon-office init --no-approvals` | 打开 App 不弹窗、不改配置（已是当前版本），审批仍走终端 |

## 平台侧（发第一个版本前，由仓库所有者做）

1. GitHub 设置：`github-apply.sh imelonkid/melon-office --kind desktop`（合并方式、main 分支保护、production 环境只允许 main）
2. 对象存储：`melon-download` 桶给 `melon-office/desktop/*` 开匿名只读；建子账号，策略按基线模板 `oss-ram-policy.json`（只能写这个前缀、不能删）
3. production 环境：上表的变量与 Secret（签名证书与公证密钥可与其他 App 共用同一份，Secret 按仓库各设一份）；`OSS_BUCKET=melon-download OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com OSS_ACCESS_KEY_ID=… OSS_ACCESS_KEY_SECRET=… scripts/release-desktop.sh oss-test` 先验证能写、公网能读
4. 门户：运维仓库 `portal/config.json` 加一条（基线模板 `portal-service.json`，`pipelines.release.use: desktop-release`，`online` 读上面的 `latest.json`，`paths` 写 `mac/`、`server/`、`web/`、`scripts/`，`"auto_release": false`），`portal/push.sh`；门户令牌的仓库范围加上本仓库
5. melon-ci：`v2` tag 目前还没包含「钉公证票据失败时重试」（main 上已合并），签名发布偶尔会因苹果 CloudKit 断连失败；挪 `v2` 之前遇到了就重跑

## 图标维护

Dock 图标由 `mac/make_icon.py` 用纯色色块生成（Python 3 + Pillow + macOS `iconutil`），运行 `python3 mac/make_icon.py` 后提交更新的 `mac/AppIcon.icns`。菜单栏由 `StatusIcon.swift` 绘制为模板图像，由系统适配深浅背景。修改后检查 Dock 的 16–1024px 产物及菜单栏三种状态，并编译 Mac 版。

## 场景资源与行为回归

运行时插画原稿和 6×3 角色动画图集位于 `web/public/assets/illustration/`。`npm run assets` 运行 `tools/build_illustrated_layout.mjs`，只重建座位、前景裁切多边形和全连通过道导航，不改原图。网页和 Mac 使用同一份 `layout.json`。`tools/render_assets.py` 保留为早期程序绘图工具，不再用于正式场景。

当前场景采用浅米黄墙面、偏灰地板，工区外保持纯黑。Mac 菜单只保留高频入口；设置中的本机选项通过 `OfficeStore.desktop` 读取实际状态，写操作由 `AppDelegate` 调用。Claude Code 与 Codex 各自读取 hooks 配置状态，不按勾选的默认值自动安装。验收接入使用临时 HOME，不修改日常配置。

Codex 通过官方 hooks.json 发送事件，配置读写和状态机与 Node 版共用。`/hook/codex` 与 `/hook/codex/permission` 在 Node / Swift 两个桥接端保持一致；`hook-events.mjs` 在边界校验载荷，提供可信来源。内部按来源、会话及子 Agent ID 建键，Claude 的历史记忆键保持不变。Codex 的原配置与登录、模型、信任记录不得改动，配置写入后必须由用户在 Codex 内审核并信任；更新端口/命令后需重新审核。本次按本机 `codex-cli 0.166.0` 和 [官方文档](https://learn.chatgpt.com/docs/hooks) 验证能力，不支持没有本机 hooks 的云端会话。

`test/codex.test.mjs` 覆盖独立安装/移除、备份、端口修复、混合会话/子 Agent、审批隔离、中断与实际生成命令的 HTTP 往返。Mac 验收须使用 `MelonCore(script:homeDirectory:)` 注入临时目录，并把测试进程的 `CODEX_HOME` 指向临时目录，禁止测试真实配置。

换素材须重新量取座位锚点、桌沿遮挡和通道，不能把包含员工的展示图直接作为背景。时钟由运行时覆盖；工位、玻璃办公室、茶水间与行政猫保持在原稿位置。角色帧顺序保留工作、举手、走路、喝咖啡、刷手机、聊天、撸猫及训话动作；访客复用同风格角色图集。检查 `test/office-behavior.test.mjs`，并验收两端的遮挡、寻路、审批及工卡。

工作表现：`working` 与 `thinking` 的场景气泡和列表展示固定「工作中」，独立三个点循环跳动，不显示工具调用；`waiting` 继续保留审批提示。`illustration/working.png` 为独立的六列两行背面打字图集，角色映射由 `layout.workAtlas` 提供；原图集与工卡头像不变。回到工位时清除走路翻转，打字帧与缓慢思考帧均朝电脑。工具操作仍在本地翻译，最近动态保留命令摘要，录屏模式继续隐藏详情；没有外部模型请求或新增接入设置。

原生停帧现场：关闭/最小化后重开工区，服务和 SwiftUI 工作台仍更新，场景时钟、气泡与人物停止；主线程采样未见阻塞。隔离的菜单栏模式测试已复现「关闭窗口 → 隐藏时接到工作任务 → 重新打开」后旧 SKView 不再出帧，单纯重新绑定场景仍未恢复。`OfficeRenderView` 在窗口可见性恢复、主窗口状态刷新及小窗轮询时检查 `OfficeScene.lastFrameTime`；可见性通知后先留出正常恢复时间，可见且超过两秒无帧才替换 SKView 并绑定原场景。保留原场景、任务、人物、路径及订阅，不重建业务模型或接入服务；同一末帧只恢复一次，避免持续故障下反复重试。原生验收确认同一 OfficeScene 在该关闭/重开流程后继续出帧，人物返回工位；后续验收须包含菜单栏模式、隐藏/恢复、停帧后接到工作任务及人物回座；`scripts/test-mac.sh` 覆盖恢复判定，Mac 上的基线检查会运行它。

宣传页在独立 `site/`，是无构建依赖的 HTML / CSS / 图片 / 预渲染视频 / 少量脚本，不调用工区服务或外部模型。按项目基线 v3「静态宣传页」使用 `scripts/deploy-page.sh`（模板只替换 NAME 为已登记的 `melon-office-page`，PAGE_DIR 为 `site`），采用独立 `page-v*` 标签，经环境变量 `PAGE_DEPLOY_SSH` 调用 TYPE=page 部署入口，由入口从 GitHub 取对应标签的页面并原子切换 current、保留版本以供回滚；不走门户、不起容器、不经 rsync，不添加 Dockerfile 或 /health。腾讯站注册表、部署入口/限定钥匙、反代、域名/证书与 Gatus 由 melon-ops 管理，实际发布状态以运维注册表和部署入口 `status` 为准；未经用户发布指令不打标签、不执行部署。静态页统一门户发布已记入 melon-ops 路线待办，Drip 与本项目后续一起接入。静态资源缓存较长，变更必须换文件名。`npm run promo:render` 在 macOS 离线生成海报、GIF、无声视频与 site/assets 下的版本化主图、头像和办公室循环视频；大媒体位于忽略的 `promo-output/`。详见 `docs/PROMO.md`。
