#!/usr/bin/env bash
# Build "Melon Office.app" (universal, signed) into mac/build/.
#
#   bash mac/build.sh                 build + sign with the first "Developer ID Application" identity
#   NOTARY_PROFILE=<name> bash mac/build.sh
#                                     also notarize and staple (profile made with `xcrun notarytool store-credentials`)
#
# Options (environment variables):
#   MELON_SIGN_IDENTITY=<name|hash>   signing identity; "-" signs ad hoc (only runs on this Mac)
#   MELON_SWIFT_BUILD=<dir>           SwiftPM build directory (default mac/.build)
#   MELON_VERSION=<X.Y.Z>             CFBundleShortVersionString (default: package.json version)
#   MELON_BUILD=<tag>                 CFBundleVersion (default: commit count; releases pass the tag)
#   MELON_NO_ZIP=1                    skip the zip (scripts/package-desktop.sh makes a dmg instead)
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=mac/build
APP="$OUT/Melon Office.app"
SWIFT_BUILD="${MELON_SWIFT_BUILD:-mac/.build}"
VERSION="${MELON_VERSION:-$(node -p "require('./package.json').version")}"
BUILD="${MELON_BUILD:-dev-$(git rev-list --count HEAD 2>/dev/null || echo 0)}"   # dev-…: local builds don't check for updates
IDENTITY="${MELON_SIGN_IDENTITY:-$(security find-identity -v -p codesigning | grep -m1 'Developer ID Application' | sed -E 's/.*"(.*)"/\1/' || true)}"
IDENTITY="${IDENTITY:--}"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }

step "构建网页版和办公室核心"
[ -d node_modules ] || npm install --no-fund --no-audit --loglevel=error
npm run build --silent >/dev/null
mkdir -p "$OUT"
node mac/core/bundle.mjs "$OUT/core.js"

step "编译 Swift（universal）"
swift build -c release --package-path mac --scratch-path "$SWIFT_BUILD" --arch arm64 --arch x86_64
BIN="$(swift build -c release --package-path mac --scratch-path "$SWIFT_BUILD" --arch arm64 --arch x86_64 --show-bin-path)/MelonOffice"

step "组装 $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/MelonOffice"
sed -e "s/__VERSION__/$VERSION/" -e "s/__BUILD__/$BUILD/" mac/Info.plist > "$APP/Contents/Info.plist"
cp mac/AppIcon.icns "$OUT/core.js" "$APP/Contents/Resources/"
cp -R web/public/assets "$APP/Contents/Resources/assets"   # art for the native office
cp -R dist "$APP/Contents/Resources/dist"                   # web version, for 「在浏览器中打开」

step "签名（${IDENTITY}）"
TIMESTAMP=(--timestamp); [ "$IDENTITY" = "-" ] && TIMESTAMP=()   # ad hoc signatures can't be timestamped
codesign --force --options runtime "${TIMESTAMP[@]+"${TIMESTAMP[@]}"}" --entitlements mac/MelonOffice.entitlements --sign "$IDENTITY" "$APP"
codesign --verify --strict --verbose=1 "$APP"

if [ -n "${NOTARY_PROFILE:-}" ]; then
  step "公证"
  ditto -c -k --keepParent "$APP" "$OUT/MelonOffice-notarize.zip"
  xcrun notarytool submit "$OUT/MelonOffice-notarize.zip" --keychain-profile "$NOTARY_PROFILE" --wait
  xcrun stapler staple "$APP"
  rm "$OUT/MelonOffice-notarize.zip"
fi

if [ -n "${MELON_NO_ZIP:-}" ]; then printf '\n\033[32m✓ %s\033[0m\n' "$APP"; exit 0; fi
ditto -c -k --keepParent "$APP" "$OUT/MelonOffice-$VERSION.zip"
printf '\n\033[32m✓ %s\033[0m\n  %s\n' "$APP" "$OUT/MelonOffice-$VERSION.zip"
