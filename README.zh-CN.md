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
- **行为是真实的**：由 Claude Code hooks 驱动。`SessionStart` 推门入职，`PreToolUse` 开始干活，`PermissionRequest` 举手审批，`Stop` 之后去茶水间，`SessionEnd` 下班打卡。
- **显示器光晕按工具变色**：写代码绿、读和搜蓝、跑命令橙、等你审批红。
- **在工区里审批**：可选开启。只有工区页面开着时，才会挂起权限请求等你点按钮（最长约 55 秒）；否则立刻走终端里原本的确认流程，不会让 Claude 干等。
- **命令翻译成人话**：内置 git、npm/pnpm/yarn、测试、构建、curl、docker、MCP 插件等规则；没覆盖到的命令，用 Claude 给每条命令写的说明兜底。
- **OA 工作台**：待我审批、加班中、茶水间，外加一键生成「瓜老板的日报」：「今日带领团队交付 37 项，拉通对齐 5 次，赋能 3 位同学，沉淀方法论 1 套。」
- **大厂细节拉满**：「拥抱变化 · 使命必达」横幅、KPI 大屏、22:00 打车报销倒计时、行军床上的行政猫、外卖架、健身球。
- **演示模式**：回放一天的大厂日常，不用真跑任务也能录出热闹的视频。
- **美术全部由代码生成**：`tools/render_assets.py` 程序化绘制等距场景和角色，想换颜色、家具、造型，改完重新渲染即可。

## 快速开始

需要 Node 18+ 和 Claude Code。

```bash
git clone https://github.com/<you>/melon-office.git
cd melon-office
npm install
npm run build

node bin/melon-office.mjs init    # 往 ~/.claude/settings.json 写入 hooks（会先备份）
node bin/melon-office.mjs start   # 打开工区 http://127.0.0.1:7777
```

然后照常使用 Claude Code，新开的会话会自己走进工区。

只想先看看效果：

```bash
npm run build && node bin/melon-office.mjs demo
```

## 命令

| 命令 | 作用 |
|---|---|
| `init [--project] [--port 7777] [--no-approvals]` | 写入 hooks。`--project` 只写当前项目的 `.claude/settings.local.json`；`--no-approvals` 审批仍走终端 |
| `start [--port] [--no-open]` | 开工 |
| `demo [--port] [--no-open]` | 演示模式 |
| `status` | 查看接入了哪些事件 |
| `uninstall [--project]` | 移除 Melon Office 的 hooks，其它配置原样保留 |

页面参数：`?record` 录屏模式，`?caption=0` 关闭底部字幕。

## 工作原理

```
Claude Code 会话 ──hooks──▶ 本地桥接服务 127.0.0.1:7777 ──WebSocket──▶ 浏览器里的工区（Phaser）
```

- 被动事件用 `async` 的 command hook + `curl` 发送：不拖慢 Claude，工区没开时静默失败。
- `PermissionRequest` 用 http hook，这样工区才能回复「同意」或「驳回」。
- 服务只监听 `127.0.0.1`，审批接口和 WebSocket 只接受本机页面的请求。hook 里有你的代码和命令，不要把端口暴露到局域网。

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
