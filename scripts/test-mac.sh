#!/usr/bin/env bash
# Deterministic native regression checks; no GUI, real hooks or user settings.
set -euo pipefail
cd "$(dirname "$0")/.."
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
swiftc mac/Sources/MelonOffice/FrameRecovery.swift mac/Tests/FrameRecoveryTests.swift -o "$test_dir/frame-recovery"
"$test_dir/frame-recovery"
