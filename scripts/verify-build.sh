#!/usr/bin/env bash
# 打包后检查产物（项目基线「桌面应用」）：随应用分发的文件缺一个就不发布。
#   scripts/verify-build.sh <dist 目录>
set -euo pipefail
APP="${1:?dist 目录}/Melon Office.app"
fail=0
need() { [[ -e "$APP/Contents/$1" ]] && echo "  ✓ $1" || { echo "  ✗ 缺 $1" >&2; fail=1; }; }
echo "▸ 检查 $APP"
need MacOS/MelonOffice
need Info.plist
need Resources/core.js              # 工区核心（JavaScriptCore）
need Resources/AppIcon.icns
need Resources/assets               # 原生工区的美术
need Resources/dist/index.html      # 「在浏览器中打开」的网页版
arch="$(lipo -archs "$APP/Contents/MacOS/MelonOffice" 2>/dev/null || true)"
[[ "$arch" == *arm64* && "$arch" == *x86_64* ]] && echo "  ✓ universal（${arch}）" || { echo "  ✗ 不是 universal：${arch:-读不到}" >&2; fail=1; }
codesign --verify --strict "$APP" && echo "  ✓ 签名校验" || { echo "  ✗ 签名校验没通过" >&2; fail=1; }
# 核心里要有启动时对账 hooks 的入口（旧核心会让 App 启动后什么都不做）
grep -q 'hooksCheck' "$APP/Contents/Resources/core.js" && echo "  ✓ core.js 含 hooksCheck" || { echo "  ✗ core.js 里没有 hooksCheck" >&2; fail=1; }
exit $fail
