#!/usr/bin/env bash
# Deterministic native regression checks; no GUI, real hooks or user settings.
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
swiftc mac/Sources/MelonOffice/FrameRecovery.swift mac/Tests/FrameRecoveryTests.swift -o "$test_dir/frame-recovery"
"$test_dir/frame-recovery"

# Explicit opt-in: needs a logged-in macOS graphical session. Never starts AppDelegate.
if [[ "${1:-}" == --ui ]]; then
  app="$test_dir/RenderLifecycleTests.app"
  mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
  ln -s "$PWD/web/public/assets" "$app/Contents/Resources/assets"
  cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>RenderLifecycleTests</string>
<key>CFBundleIdentifier</key><string>cn.melonkid.office.render-tests</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
  sources=()
  for source in mac/Sources/MelonOffice/*.swift; do
    [[ "$source" == */main.swift ]] || sources+=("$source")
  done
  swiftc "${sources[@]}" mac/Tests/RenderLifecycleTests.swift -o "$app/Contents/MacOS/RenderLifecycleTests"
  "$app/Contents/MacOS/RenderLifecycleTests"
fi
