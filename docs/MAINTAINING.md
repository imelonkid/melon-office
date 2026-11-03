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
| 打包钩子 `scripts/package-desktop.sh`、发布脚本 `scripts/release-desktop.sh`、发布表单 `release-desktop.yml` | 待做 |
| 客户端检查更新（读 `latest.json`） | 待做 |
| 启动时对账 Claude Code hooks（缺了问、旧了修、拒绝过不再弹；`hooks-config.mjs` 的 `check()` / `repair()`，Mac 版与 `melon-office start` 共用） | ✓ |
| GitHub 设置（`github-apply.sh --kind desktop`）、production 环境 | 待做 |
| 对象存储下载站前缀、只写子账号 | 待做 |
| 门户登记（运维仓库 `portal/config.json`） | 待做 |

## 发布与回滚

接入发布流水线之前，Mac 版只能本机 `npm run mac` 构建（`NOTARY_PROFILE=<钥匙串配置> npm run mac` 同时公证），不对外分发安装包。

接入之后：门户应用页点「发布」→ melon-ci 门禁（发布窗口、main 的 CI 全绿）→ 打 `vX.Y.Z` → macOS 构建机打包、Developer ID 签名、公证 → 先传 dmg、最后传 `latest.json` → GitHub Release。回滚：把下载站的 `latest.json` 指回上一版（已装的客户端不会自动降级，只影响新下载与更新提示）。

## GitHub production 环境（接入发布后）

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
| 拒绝过的用户 | 弹窗点「以后再说」，或菜单里移除 | 再次打开不弹窗；菜单显示「接入 Claude Code（未接入）」 |
| 命令行版装过 | `melon-office init --no-approvals` | 打开 App 不弹窗、不改配置（已是当前版本），审批仍走终端 |
