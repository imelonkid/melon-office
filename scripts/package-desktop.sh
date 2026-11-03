#!/usr/bin/env bash
# 打包钩子（项目基线「桌面应用」：走技术选型例外的原生 App 用它；模板 melon-skills project-init templates/desktop/package-desktop.sh）。
# scripts/release-desktop.sh build 在 tag 的内容里调用（那里没有 .git，版本号由这里传入）：
#
#   scripts/package-desktop.sh <版本号 X.Y.Z> <tag vX.Y.Z> <输出目录>
#
# 产出 <输出目录>/Melon Office.app。构建步骤就是本机的 mac/build.sh（网页版 + JavaScriptCore 核心 + Swift universal）；
# Info.plist 的 CFBundleShortVersionString = 版本号、CFBundleVersion = tag。
# 环境变量 SIGN_IDENTITY 有值（发布表单 sign: true）就用 Developer ID 签名（hardened runtime + 时间戳），没有就 ad-hoc；
# 公证与 dmg 由流水线 / release-desktop.sh 做，这里不管。
set -euo pipefail
VER="${1:?版本号}"; TAG="${2:?tag}"; OUT="${3:?输出目录}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▸ 工具链：$(swift --version 2>&1 | head -1)；node $(node -v)；$(xcrun --show-sdk-version 2>/dev/null | sed 's/^/macOS SDK /')"
npm ci --no-fund --no-audit --loglevel=error || { echo "✗ npm ci 失败" >&2; exit 1; }

MELON_VERSION="$VER" MELON_BUILD="$TAG" MELON_SIGN_IDENTITY="${SIGN_IDENTITY:--}" MELON_NO_ZIP=1 \
  MELON_SWIFT_BUILD="${MELON_SWIFT_BUILD:-$HOME/Library/Caches/melon-office/swift-release}" \
  bash mac/build.sh || { echo "✗ mac/build.sh 失败" >&2; exit 1; }

APP="$ROOT/mac/build/Melon Office.app"
got="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
[[ "$got" == "$VER" ]] || { echo "✗ Info.plist 的 CFBundleShortVersionString 是 ${got}，应为 ${VER}" >&2; exit 1; }
got="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$APP/Contents/Info.plist")"
[[ "$got" == "$TAG" ]] || { echo "✗ Info.plist 的 CFBundleVersion 是 ${got}，应为 ${TAG}" >&2; exit 1; }

mkdir -p "$OUT"
rm -rf "$OUT/Melon Office.app"
ditto "$APP" "$OUT/Melon Office.app"   # ditto 保留签名与扩展属性
echo "✓ $OUT/Melon Office.app（${TAG}）"
