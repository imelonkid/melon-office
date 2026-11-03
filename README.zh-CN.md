<div align="center">

# Melon Office · 甜瓜科技 AI 事业部

**我的 AI 员工入职大厂了。**

每个 Claude Code 会话都是一位员工：坐在双屏工位上敲代码，要权限时举手找你审批，
活一干完就溜去茶水间带薪喝咖啡。瓜老板就是你。

[English](./README.md) · 简体中文

<img src="./docs/demo.gif" alt="Melon Office：AI 员工在等距大厂工区里干活、举手审批、去茶水间摸鱼" width="860">

</div>

---

## 为什么做这个

同时开三四个 Claude Code 会话很爽，直到你在一堆终端之间来回切，只为了找出到底是哪个卡在等你确认。Melon Office 把它们都放进同一间办公室：

- **一眼看清全场**：谁在写代码、谁在跑测试、谁已经交付去摸鱼了。
- **审批不再漏**：需要你的员工会举手，在工区里直接点「同意」，结果立刻回传给 Claude Code。
- **看得懂在干嘛**：`git switch -c docs/release-v0.14.0 && python3 - <<'EOF'` 会显示成「新拉分支 docs/release-v0.14.0，再写了段临时脚本」。
- **放心录屏**：录屏模式自动隐藏文件名、命令和项目名，随手发小红书、发朋友圈都不怕泄露。

最重要的是：看 AI 加班，真的很解压。

## 功能

- **一个会话一个员工**：子 Agent 以实习生身份入职，跟着组长干活，交活就下班。
- **办公室从不空着**：没活的时候也有几位常驻员工在（默认 `--staff 3`，最多 5 位），刷手机、在茶水间聊八卦、去逗行政猫。新会话来了，正在摸鱼的同事放下手机回工位接活；会话比常驻员工多时，其他同事和编号的外包会进门帮忙，干完就走。
- **同一个活，同一个人**：续接的会话还交给上次那位，同一项目的新会话优先给最近在这个项目干活的人（「这个项目我熟，我来」），重启后也记得。负责人正忙时别人先顶上，但项目还算原负责人的。记录保留 7 天，存在 `~/.config/melon-office/memory.json`。
- **老板会训话**：摸鱼的人一多，瓜老板就走出会议室，在工区来一段大厂黑话训话（最多每 3 分钟一次）。大家赶紧回工位假装很忙，等老板走了，总有人嘀咕一句「那倒是给我派活啊」。
- **行为是真实的**：由 Claude Code hooks 驱动。`SessionStart` 推门入职，`PreToolUse` 开始干活，`PermissionRequest` 举手审批，`Stop` 之后去茶水间，`SessionEnd` 下班打卡。
- **显示器光晕按工具变色**：写代码绿、读和搜蓝、跑命令橙、等你审批红。
- **在工区里审批**：可选开启。只有工区页面开着时，才会挂起权限请求等你点按钮（最长约 55 秒）；否则立刻走终端里原本的确认流程，不会让 Claude 干等。
- **命令翻译成人话**：内置 git、npm/pnpm/yarn、测试、构建、curl、docker、MCP 插件等规则；没覆盖到的命令，用 Claude 给每条命令写的说明兜底。
- **OA 工作台**：待我审批、加班中、茶水间，外加一键生成「瓜老板的日报」：「今日带领团队交付 37 项，拉通对齐 5 次，赋能 3 位同学，沉淀方法论 1 套。」生成时还会存一份完整的 HTML 日报（数据、团队、最近动态），文件名是 `日报-日期.html`，默认放在 `~/Documents/Melon Office 日报`。
- **改成你自己的公司**：工作台右上角的 ⚙（Mac 版在菜单栏的「设置…」）可以改左上角的工区名称（默认「甜瓜科技 · AI 事业部」，也会印在日报抬头）和日报保存目录。设置存在 `~/.config/melon-office/settings.json`，命令行版和 Mac 版共用。
- **大厂细节拉满**：「拥抱变化 · 使命必达」横幅、KPI 大屏、22:00 打车报销倒计时、行军床上的行政猫、外卖架、健身球。
- **演示模式**：回放一天的大厂日常，不用真跑任务也能录出热闹的视频。
- **美术全部由代码生成**：`tools/render_assets.py` 程序化绘制等距场景和角色，想换颜色、家具、造型，改完重新渲染即可。

## 快速开始

一行命令装好。需要 Node 18+、git 和 Claude Code（macOS / Linux）。

```bash
curl -fsSL https://raw.githubusercontent.com/imelonkid/melon-office/main/install.sh | bash
```

国内网络慢的话，用 npm 镜像：

```bash
curl -fsSL https://raw.githubusercontent.com/imelonkid/melon-office/main/install.sh | MELON_OFFICE_MIRROR=cn bash
```

脚本会把 Melon Office 装到 `~/.melon-office`，构建好工区，添加 `melon-office` 命令，接入 Claude Code 的 hooks（会先备份你的 `settings.json`），然后打开 http://127.0.0.1:7777 。

以后开工只要：

```bash
melon-office          # 开工
melon-office demo     # 演示模式，录视频专用
```

照常使用 Claude Code，新开的会话会自己走进工区。

<details>
<summary>想手动安装？</summary>

```bash
git clone https://github.com/imelonkid/melon-office.git
cd melon-office
npm run setup         # 装依赖 + 构建 + 接入 hooks + 开工
```

</details>

## 命令

| 命令 | 作用 |
|---|---|
| `melon-office` | 开工（等同 `start`） |
| `demo` | 演示模式，回放一天的大厂日常 |
| `init [--project] [--no-approvals]` | 接入 Claude Code。`--project` 只写当前项目的 `.claude/settings.local.json`；`--no-approvals` 审批仍走终端 |
| `status` | 查看接入了哪些事件、配置是不是旧版本 |
| `update` | 更新到最新版 |
| `uninstall [--project]` | 移除 Melon Office 的 hooks，其它配置原样保留 |

都支持 `--port 7777` 和 `--no-open`；`start` 和 `demo` 还支持 `--staff 3`（没有会话时也在工区的常驻员工数，0–5）。页面参数：`?record` 录屏模式，`?caption=0` 关闭底部字幕。

## 工作原理

```
Claude Code 会话 ──hooks──▶ 本地桥接服务 127.0.0.1:7777 ──WebSocket──▶ 浏览器里的工区（Phaser）
```

- 被动事件用 `async` 的 command hook + `curl` 发送：不拖慢 Claude，工区没开时静默失败。
- `PermissionRequest` 用 http hook，这样工区才能回复「同意」或「驳回」。
- 服务只监听 `127.0.0.1`，审批接口和 WebSocket 只接受本机页面的请求。hook 里有你的代码和命令，不要把端口暴露到局域网。

## Mac 版

[`mac/`](mac) 里是原生 macOS 版：一个菜单栏 App，不需要 Node，也不用开浏览器。

- **菜单栏**：🍈 旁边显示几位员工在加班、几个审批在等你，直接在菜单里同意或驳回。
- **通知审批**：权限请求会弹出带「同意 / 驳回」按钮的系统通知，不开窗口也能在工区审批。
- **桌面小窗**：透明、置顶的迷你工区，放在屏幕一角像桌宠；空白处的点击会穿透到下面的窗口。
- **自己接好 Claude Code**：第一次打开会问一次要不要写入 hooks。之后每次启动都会检查：旧版本留下的（或端口不同的）hooks 会原地更新，是否在工区审批照旧；选了「以后再说」或从菜单里移除过，就不再弹窗，想接回来点菜单里的「接入 Claude Code」。
- **原生渲染**：工区用 SpriteKit 画，OA 工作台用 SwiftUI，美术和网页版是同一套。
- **同一个大脑**：`server/office.mjs`、`translate.mjs`、`hooks-config.mjs` 跑在 JavaScriptCore 里，App 在 7777 端口提供同样的 hook 接口，hooks 和浏览器版都不用改。命令行版和 App 不要同时开。

```bash
npm run mac        # → mac/build/Melon Office.app（universal，用你的 Developer ID 签名）
NOTARY_PROFILE=<钥匙串里的公证配置> npm run mac   # 顺便公证并 staple
```

需要 Xcode 15+、macOS 13+。

## 开发

```bash
npm run dev        # 桥接服务 :7777 + Vite :5173 热更新
npm run dev:demo   # 同上，带演示数据
npm run typecheck
npm run assets     # 重新渲染等距美术（Python 3 + Pillow）
```

## 路线图

- [ ] 从会话记录统计 Token 和花费
- [ ] 用 LLM 生成日报、周报和朋友圈分享卡片
- [ ] 规则翻译不了的命令用 LLM 兜底，工位上方显示任务标题
- [ ] 一键录制 16:9 / 9:16 视频
- [ ] 手机扫码看工区（带配对码）
- [ ] 英文黑话包（*let's circle back*、*synergy*…）
- [ ] `npx melon-office` 一行命令开工

欢迎提 Issue 和 PR，尤其是新的命令翻译规则和工区家具。

## 致谢

灵感来自 [Pixel Agents](https://github.com/pablodelucca/pixel-agents)、[Claude Office Visualizer](https://github.com/paulrobello/claude-office) 和 pixtuoid。
基于 [Phaser](https://phaser.io) 和 Claude Code hooks 构建。

由 [melonkid](https://melonkid.cn) · 甜瓜科技出品，MIT 协议开源。
