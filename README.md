<div align="center">

# Melon Office

**Your Claude Code sessions, as a tiny big-tech office.**

Every session is an employee. They type away at dual monitors, raise a hand when they need your approval,
and sneak off to the pantry for coffee the moment the job is done. You're the boss.

English · [简体中文](./README.zh-CN.md)

<img src="./docs/demo.gif" alt="Melon Office: AI employees working, asking for approval and taking coffee breaks in an isometric office" width="860">

</div>

---

## Why

Running three or four Claude Code sessions at once is great, until you're tabbing between terminals to find
out which one is stuck waiting for you. Melon Office puts all of them in one room:

- **See everything at a glance.** Who's coding, who's running tests, who's done and on a coffee break.
- **Never miss a permission prompt.** The employee who needs you raises a hand. Click **Approve** right there in the office, and the decision goes straight back to Claude Code.
- **Read what they're doing, not what they're running.** `git switch -c docs/release-v0.14.0 && python3 - <<'EOF'` becomes *"Cut a new branch docs/release-v0.14.0, then wrote a quick script."*
- **Safe to share.** Record mode hides file names, commands and project names, so you can post a clip without leaking your work.

And it's a lot of fun to watch.

## Features

- **One session, one employee.** Subagents join as interns, follow their lead, and leave when their task is done.
- **The office is never empty.** A few residents (`--staff 3` by default, up to 5) hang around even with nothing running: scrolling their phones, gossiping in the pantry, petting the office cat. A new session is picked up by whoever is slacking, who puts the phone down and walks to their desk. When there are more sessions than residents, colleagues and numbered contractors walk in for the job and leave when it's done.
- **The boss notices.** When too many people are slacking, 瓜老板 walks out of the meeting room and gives a corporate-speak lecture (at most every 3 minutes). Everyone scrambles back to their desk and fakes it until he's gone, and somebody mutters "then give me some work".
- **Real behaviour, not a screensaver.** Driven by Claude Code hooks: employees walk in on `SessionStart`, work on `PreToolUse`, raise a hand on `PermissionRequest`, head to the pantry after `Stop`, and clock out on `SessionEnd`.
- **Monitor glow by tool.** Green for editing, blue for reading and searching, orange for shell commands, red when waiting on you.
- **Approve from the office.** Opt-in. Only when the page is open does the bridge hold a permission request for you (up to ~55 s); otherwise Claude falls back to the normal terminal prompt instantly.
- **Commands translated to plain words.** Built-in rules for git, npm/pnpm/yarn, test runners, build tools, curl, docker, MCP tools and more. Unknown commands fall back to the description Claude writes for every shell call.
- **OA dashboard.** Pending approvals, who's working overtime, who's in the pantry, plus an auto-generated "boss's daily report" you can copy and share.
- **Demo mode.** Replays a busy day at the office, so you can record a video without running real work.
- **Isometric art, generated in code.** Every pixel comes from `tools/render_assets.py`. Change colours, furniture or characters and re-render.

> The office copy is written in Chinese big-tech slang (拥抱变化, 拉通对齐, the 10 pm taxi-reimbursement countdown…). An English copy pack is on the roadmap.

## Quick start

One line. Requires Node 18+, git and Claude Code (macOS or Linux).

```bash
curl -fsSL https://raw.githubusercontent.com/imelonkid/melon-office/main/install.sh | bash
```

It downloads Melon Office to `~/.melon-office`, builds it, adds a `melon-office` command, connects the Claude Code hooks (your `settings.json` is backed up first) and opens the office at http://127.0.0.1:7777.

From then on:

```bash
melon-office          # open the office
melon-office demo     # a scripted day at the office, great for recording
```

Use Claude Code as usual. New sessions walk into the office on their own.

<details>
<summary>Prefer to install by hand?</summary>

```bash
git clone https://github.com/imelonkid/melon-office.git
cd melon-office
npm run setup         # npm install + build + connect hooks + open the office
```

</details>

## Commands

| Command | What it does |
|---|---|
| `melon-office` | Open the office (same as `start`) |
| `demo` | Open the office with a scripted day of work |
| `init [--project] [--no-approvals]` | Connect the hooks. `--project` writes to `.claude/settings.local.json` in the current repo only. `--no-approvals` keeps permission prompts in the terminal. |
| `status` | Show which hook events are connected |
| `update` | Update to the latest version |
| `uninstall [--project]` | Remove Melon Office's hooks and leave everything else untouched |

All of them take `--port 7777` and `--no-open`; `start` and `demo` also take `--staff 3` (residents who stay in the office without a session, 0–5). Page options: `?record` for record mode, `?caption=0` to hide the caption.

## How it works

```
Claude Code sessions ──hooks──▶ local bridge 127.0.0.1:7777 ──WebSocket──▶ the office in your browser (Phaser)
```

- Passive events (`SessionStart`, `PreToolUse`, `Stop`, `SubagentStart`, …) are sent by an `async` command hook with `curl`. They never slow Claude down and fail silently when the office is closed.
- `PermissionRequest` uses an `http` hook, so the office can answer with allow or deny.
- The bridge only listens on `127.0.0.1`, and the approval API and WebSocket only accept pages served from your machine. Hook payloads contain your code and commands, so don't expose the port to your network.

## Development

```bash
npm run dev        # bridge on :7777 + Vite on :5173 with hot reload
npm run dev:demo   # same, with demo data
npm run typecheck
npm run assets     # re-render the isometric art (Python 3 + Pillow)
```

```
bin/melon-office.mjs     CLI
server/index.mjs         HTTP + WebSocket bridge
server/office.mjs        hook events → employees (seat, status, what they say)
server/translate.mjs     tool calls → plain words
server/hooks-config.mjs  install / uninstall hooks
server/demo.mjs          demo script
web/src/scene.ts         isometric scene: walking, animation, speech bubbles, approve buttons
web/src/panel.ts         OA dashboard
tools/render_assets.py   procedural isometric art
```

## Roadmap

- [ ] Token and cost tracking from transcripts
- [ ] LLM-written daily reports and share cards
- [ ] LLM fallback for commands the rules don't cover, plus a task title above each desk
- [ ] One-click 16:9 / 9:16 video recording
- [ ] View on your phone with a pairing code
- [ ] English copy pack (*let's circle back*, *synergy*…)
- [ ] `npx melon-office`

Ideas and PRs are welcome, especially new command translations and office furniture.

## Credits

Inspired by [Pixel Agents](https://github.com/pablodelucca/pixel-agents), [Claude Office Visualizer](https://github.com/paulrobello/claude-office) and pixtuoid.
Built with [Phaser](https://phaser.io) and Claude Code hooks.

Made by [melonkid](https://melonkid.cn) at 甜瓜科技 (Melon Tech). MIT licensed.
