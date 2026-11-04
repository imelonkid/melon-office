# 维护说明

面向维护者：项目基线（`.melon-baseline`）要求的运维内容放在这里，`README.md` 只写产品本身。

## 项目类型

按项目基线 v3 的「桌面应用（独立客户端，没有自己的服务端）」接入：

- **Mac 版**：原生菜单栏 App，安装包与版本清单放对象存储，发布走 melon-ci `desktop-release`
- **命令行版**：`install.sh` 一行安装（git clone 到 `~/.melon-office` 再构建），`melon-office update` 重新跑一遍；不经过发布流水线
- 不部署到服务器，不登记运维注册表

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

当前场景采用浅米黄墙面、偏灰地板，工区外保持纯黑。Mac 菜单只保留高频入口；设置中的本机选项通过 `OfficeStore.desktop` 读取实际状态，写操作仍由 `AppDelegate` 调用原有实现。Claude 接入开关以 hooks 检查结果为准，不按勾选的默认值自动写配置；Codex 未实现采集前仅显示不可用说明。验收接入开关使用临时 HOME，不修改日常配置。

换素材须重新量取座位锚点、桌沿遮挡和通道，不能把包含员工的展示图直接作为背景。时钟由运行时覆盖；工位、玻璃办公室、茶水间与行政猫保持在原稿位置。角色帧顺序保留工作、举手、走路、喝咖啡、刷手机、聊天、撸猫及训话动作；访客复用同风格角色图集。检查 `test/office-behavior.test.mjs`，并验收两端的遮挡、寻路、审批及工卡。
