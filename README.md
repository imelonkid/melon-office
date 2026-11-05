<div align="center">

# Melon Office

**Your Claude Code and Codex sessions, as a tiny big-tech office.**

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
- **Same job, same person.** A resumed session goes back to whoever had it, and a new session in a project goes to whoever worked there last ("这个项目我熟，我来"), even after a restart. If they're busy, someone else helps out without taking over the project. Remembered for 7 days in `~/.config/melon-office/memory.json`.
- **The boss notices.** When too many people are slacking, 瓜老板 walks out of the meeting room and gives a corporate-speak lecture (at most every 3 minutes). Everyone scrambles back to their desk and fakes it until he's gone, and somebody mutters "then give me some work".
- **Real behaviour, not a screensaver.** Driven by Claude Code hooks: employees walk in on `SessionStart`, work on `PreToolUse`, raise a hand on `PermissionRequest`, head to the pantry after `Stop`, and clock out on `SessionEnd`.
- **Monitor glow by tool.** Green for editing, blue for reading and searching, orange for shell commands, red when waiting on you.
- **Approve from the office.** Opt-in. Only when the page is open does the bridge hold a permission request for you (up to ~55 s); otherwise Claude falls back to the normal terminal prompt instantly.
- **Commands translated to plain words.** Built-in rules for git, npm/pnpm/yarn, test runners, build tools, curl, docker, MCP tools and more. Unknown commands fall back to the description Claude writes for every shell call.
- **Isometric office**: a pure black backdrop, light cream walls, gray floor tiles, individual wood desks, and a glass office for the boss. The boss walks through its doorway to lecture the team; phone breaks, coffee, gossip, cat visits, and pretending to work remain animated. The wall carries the brand, live clock, and slogan; a mint ring marks the selected employee.
- **Employee profiles**: click a character, a speech-bubble name, or an employee card to open a work badge with their role, source, current task, time on duty, and recent activity. Return to the dashboard with one button. The Mac desk widget opens profiles in the main window. Recording mode hides projects, commands, and activity history.
- **OA dashboard.** Pending approvals, who's working overtime, who's in the pantry, plus an auto-generated "boss's daily report" you can copy and share. Generating it also saves a full HTML report (stats, team, recent activity) as `日报-YYYY-MM-DD.html`, by default in `~/Documents/Melon Office 日报`.
- **Make it your office.** The ⚙ in the dashboard (or 设置… in the Mac menu bar) sets the company name shown top-left and on reports, and where reports are saved. Settings live in `~/.config/melon-office/settings.json`, shared by the CLI and the Mac app.
- **Demo mode.** Replays a busy day at the office, so you can record a video without running real work.
- **Isometric art, generated in code.** Every pixel comes from `tools/render_assets.py`. Change colours, furniture or characters and re-render.

> The office copy is written in Chinese big-tech slang (拥抱变化, 拉通对齐, the 10 pm taxi-reimbursement countdown…). An English copy pack is on the roadmap.

## Quick start

### Promotional page and media

The static `site/` Hero introduces the AI office and its employee badges, with Chinese/English copy, a silent looping office video and a separate foreground employee badge. Its English headline is “You hired AI. Now take a break.” It never connects to the bridge or reads sessions. Downloads prefer the latest universal DMG from Alibaba Cloud OSS, with GitHub Release as the fallback if metadata or the installer cannot be validated. Run `npm run promo:preview` and open `http://127.0.0.1:5175/`, or open `site/index.html` directly. The page is buildless and independent of the app. On macOS with FFmpeg installed, `npm run promo:render` produces posters, covers, 20-second silent landscape/portrait videos and a looping GIF in `promo-output/`, plus the office preview video in `site/assets/`. See [the media guide](docs/PROMO.md). Nothing is automatically published.

### Connect Codex

On Mac, enable Codex in Settings → 接入. With the CLI already installed, run:

```bash
melon-office init --provider codex
melon-office status --provider codex
melon-office uninstall --provider codex  # leaves Claude Code connected
```

Then **review and trust** the new hooks in Codex Settings → Hooks or CLI `/hooks`, and start a new session. The switch reports configuration, not trust. This supports local Codex CLI and desktop sessions with official hooks, not cloud execution. It does not read transcripts, credentials or model settings. See the [official Codex hooks documentation](https://learn.chatgpt.com/docs/hooks).

Both providers can run in the same office with independent connections. Even identical project/session IDs get different employees; source appears on the badge, never appended to names. Codex starts disabled and existing Claude choices are preserved. Patches use edit activity; interruptions pause work without counting a delivery. If approval times out, office approvals are off, or the office is unavailable, Codex handles its own approval.

Codex uses `~/.codex/hooks.json` (or `CODEX_HOME`). `--project` uses the current project's `.codex/hooks.json`; `--no-approvals` keeps decisions in the original app. Only Melon Office hooks are changed, existing files are backed up, and trust records are never modified. Updated hooks require another review.

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
| `status` | Show which hook events are connected, and whether they're out of date |
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

## Mac app

A native macOS version lives in [`mac/`](mac): a menu bar app that runs the office without Node or a browser.

- **Matching icons**: a flat workstation and employee badge on white in the Dock, with a monochrome monitor in the menu bar that adapts to light and dark backgrounds. A dash means idle, two eyes mean working, and an exclamation mark means approvals need attention or the server has a problem. Working and approval counts remain beside it; approve or deny right from the menu.
- **Approval notifications**: requests show up as macOS notifications with 同意 / 驳回 buttons, so the office can hold them even with no window open.
- **Desk widget**: an always-on-top, transparent mini office for a corner of your screen. Clicks pass through the empty corners.
- **Compact menu and settings**: the menu keeps Open Office, Desk Widget, Settings, Check for Updates and Quit. Widget size, resident staff and recording mode live in Settings → 工区; login, office name and report directory in 通用; connections and approvals in 接入.
- **Independent Claude Code and Codex connections**: first launch asks once about Claude Code and preserves the choice; existing hooks are updated in place. Codex is a separate, initially disabled switch in Settings → 接入. Review and trust it in Codex after enabling. Both sources share the office, approval controls and recording rules while keeping separate employees.
- **Native rendering**: the office is drawn with SpriteKit and the OA panel with SwiftUI, from the same art as the web version.
- **Quiet work mode**: employees with active tasks face their monitors and type. Their bubbles and overview cards show “工作中” with three bouncing dots; operation details and recent command summaries live in the employee badge. Approval prompts, breaks and the boss's speeches keep their existing behavior. Everything runs locally without an external model.
- **Stalled scene recovery**: reopening or restoring a window checks rendering. A visible scene that stopped rendering gets a new render view while retaining its original scene, tasks, characters and paths, in both the main window and widget. The bridge keeps running. Hidden windows are left alone, and recovery does not loop until a new frame is produced.
- **Same brain**: `server/office.mjs`, `translate.mjs` and `hooks-config.mjs` run inside JavaScriptCore, and the app serves the same hook endpoints on port 7777, so the hooks and the browser version work unchanged. Don't run the CLI and the app at the same time.

- **Updates**: the app checks for a new version in the background and offers the download (检查更新… in the menu checks right away).

Download the signed and notarized `.dmg` from [the latest release](https://github.com/imelonkid/melon-office/releases/latest), open it and drag Melon Office into Applications. Or build it yourself:

```bash
npm run mac        # → mac/build/Melon Office.app (universal, signed with your Developer ID)
NOTARY_PROFILE=<keychain profile> npm run mac   # also notarize and staple
```

Needs Xcode 15+ and macOS 13+.

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
