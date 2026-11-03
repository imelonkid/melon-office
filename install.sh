#!/usr/bin/env bash
# Melon Office one-line installer
#
#   curl -fsSL https://raw.githubusercontent.com/imelonkid/melon-office/main/install.sh | bash
#
# What it does: downloads (or updates) Melon Office into ~/.melon-office, installs dependencies,
# builds the office, puts a `melon-office` command on your PATH, adds the Claude Code hooks
# (your settings.json is backed up first) and opens the office.
#
# Options (environment variables):
#   MELON_OFFICE_MIRROR=cn     use the npmmirror registry (faster in mainland China)
#   MELON_OFFICE_NO_START=1    install only, don't open the office
#   MELON_OFFICE_HOME=<dir>    install somewhere else (default ~/.melon-office)
#   MELON_OFFICE_REPO=<url>    install from a fork
set -euo pipefail

REPO="${MELON_OFFICE_REPO:-https://github.com/imelonkid/melon-office.git}"
DIR="${MELON_OFFICE_HOME:-$HOME/.melon-office}"

green() { printf '\033[32m%s\033[0m\n' "$*"; }
gray()  { printf '\033[90m%s\033[0m\n' "$*"; }
fail()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
step()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

printf '\n\033[1;32m  Melon Office\033[0m  ·  甜瓜科技 AI 事业部\n'

# ---------------------------------------------------------------- prerequisites
command -v git  >/dev/null 2>&1 || fail "需要 git / git is required"
command -v node >/dev/null 2>&1 || fail "需要 Node.js 18+ / Node.js 18+ is required: https://nodejs.org"
command -v npm  >/dev/null 2>&1 || fail "需要 npm / npm is required"
command -v curl >/dev/null 2>&1 || fail "需要 curl（hooks 用它发事件）/ curl is required for the hooks"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 版本太低（$(node -v)），需要 18+ / Node.js 18+ is required"

NPM_ARGS=(--no-fund --no-audit --loglevel=error)
if [ "${MELON_OFFICE_MIRROR:-}" = "cn" ]; then
  NPM_ARGS+=(--registry=https://registry.npmmirror.com)
  gray "  使用 npmmirror 镜像"
fi

# ---------------------------------------------------------------- download / update
if [ -d "$DIR/.git" ]; then
  step "更新 Melon Office  ($DIR)"
  git -C "$DIR" pull --ff-only --quiet || fail "更新失败，可以删掉 $DIR 后重新安装"
elif [ -e "$DIR" ]; then
  fail "$DIR 已存在但不是 Melon Office 的安装目录，请先移走它，或设置 MELON_OFFICE_HOME"
else
  step "下载 Melon Office  →  $DIR"
  git clone --depth 1 --quiet "$REPO" "$DIR" || fail "下载失败，检查网络或仓库地址：$REPO"
fi

# ---------------------------------------------------------------- dependencies + build
step "安装依赖"
(cd "$DIR" && npm install "${NPM_ARGS[@]}") || fail "npm install 失败；国内网络可以加 MELON_OFFICE_MIRROR=cn 重试"

step "构建工区"
(cd "$DIR" && npm run build --silent >/dev/null) || fail "构建失败"

# ---------------------------------------------------------------- `melon-office` command
step "安装 melon-office 命令"
LAUNCHER_BODY="#!/usr/bin/env bash
exec node \"$DIR/bin/melon-office.mjs\" \"\$@\""
BIN_DIR=""
for d in "$HOME/.local/bin" "/usr/local/bin" "/opt/homebrew/bin"; do
  case ":$PATH:" in *":$d:"*) ;; *) continue ;; esac
  if [ -d "$d" ] && [ -w "$d" ]; then BIN_DIR="$d"; break; fi
done
if [ -z "$BIN_DIR" ]; then
  BIN_DIR="$HOME/.local/bin"
  mkdir -p "$BIN_DIR"
  NEED_PATH=1
fi
printf '%s\n' "$LAUNCHER_BODY" > "$BIN_DIR/melon-office"
chmod +x "$BIN_DIR/melon-office"
green "  ✓ $BIN_DIR/melon-office"
if [ "${NEED_PATH:-}" = "1" ]; then
  SHELL_RC="$HOME/.zshrc"
  case "${SHELL:-}" in *bash) SHELL_RC="$HOME/.bashrc" ;; esac
  if ! grep -qs 'melon-office: add ~/.local/bin' "$SHELL_RC"; then
    printf '\n# melon-office: add ~/.local/bin to PATH\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$SHELL_RC"
  fi
  gray "  已把 ~/.local/bin 加入 PATH（${SHELL_RC}），新开的终端里生效"
fi

# ---------------------------------------------------------------- hooks
step "接入 Claude Code"
node "$DIR/bin/melon-office.mjs" init

green "
  ✓ 安装完成 / Installed

  以后开工只要一条命令 / From now on, just run:

      melon-office

  其它：melon-office demo（演示模式）· status · uninstall
"

if [ "${MELON_OFFICE_NO_START:-}" != "1" ]; then
  exec node "$DIR/bin/melon-office.mjs" start
fi
