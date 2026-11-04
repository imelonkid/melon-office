#!/usr/bin/env bash
# 项目基线 · CI 测试入口（melon-ci pr-check：scripts/ci-test.sh 存在就跑；本机也能跑）。
# 只跑不需要图形界面的检查与测试，不碰外网和真实数据（hooks 测试用临时 HOME）。
# Mac 版（Swift）只能在 macOS 编译，交给发布流水线。
set -euo pipefail
cd "$(dirname "$0")/.."
echo "▸ 安装依赖"
npm ci --no-fund --no-audit --loglevel=error
echo "▸ 语法检查"
for f in bin/*.mjs server/*.mjs mac/core/*.mjs; do node --check "$f"; done
for f in scripts/*.sh mac/build.sh install.sh; do bash -n "$f"; done
echo "▸ 类型检查"
npm run --silent typecheck
echo "▸ 构建网页版"
npm run --silent build >/dev/null
echo "▸ 打包 Mac 版核心（JavaScriptCore 用）"
node mac/core/bundle.mjs "$(mktemp -d)/core.js"
echo "▸ 测试"
npm test
if [[ "$(uname -s)" == Darwin ]]; then
  echo "▸ Mac 原生回归"
  bash scripts/test-mac.sh
fi
