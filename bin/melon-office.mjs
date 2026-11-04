#!/usr/bin/env node
// melon-office CLI
//   melon-office [--staff 3]         开工（= start）
//   melon-office demo                演示模式（回放假数据，方便录视频）
//   melon-office init [--project] [--port 7777] [--no-approvals]   写入 Claude Code hooks
//   melon-office status | update | uninstall [--project]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, uninstall, status, check, repair } from '../server/hooks-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('-') ? args[0] : 'start';
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const port = Number(opt('port', process.env.MELON_OFFICE_PORT || 7777));
const staff = Number(opt('staff', process.env.MELON_OFFICE_STAFF ?? 3));
const provider = opt('provider', flag('provider') ? '' : 'claude');
const codexHome = process.env.CODEX_HOME;
const hookOptions = { port, project: flag('project'), provider, codexHome };
const providerName = provider === 'codex' ? 'Codex' : 'Claude Code';

function openBrowser(url) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const argv = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(opener, argv, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

// people who cloned the repo and skipped `npm run build` still get an office
function ensureBuilt() {
  if (fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) return;
  if (!fs.existsSync(path.join(ROOT, 'node_modules', 'vite'))) {
    console.log('\n  首次运行，正在安装依赖…');
    const r = spawnSync('npm', ['install', '--no-fund', '--no-audit', '--loglevel=error'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) throw new Error('npm install 失败');
  }
  console.log('  正在构建工区…');
  const r = spawnSync('npm', ['run', 'build', '--silent'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) throw new Error('构建失败，试试在项目目录运行 npm run build 看看报错');
}

async function run() {
  if (!['claude', 'codex'].includes(provider)) throw new Error('--provider 只支持 claude 或 codex');
  switch (cmd) {
    case 'init': {
      const r = install({ ...hookOptions, approvals: !flag('no-approvals') });
      console.log(`\n  已写入 hooks → ${r.file}`);
      if (r.backup) console.log(`  原配置已备份 → ${r.backup}`);
      if (provider === 'codex') console.log('  请在 Codex 的 /hooks 或「设置 → Hooks」中审核并信任这些 hooks，再新开会话。');
      console.log(`  之后新开的 ${providerName} 会话会走进工区。\n`);
      break;
    }
    case 'uninstall': {
      const r = uninstall(hookOptions);
      console.log(r.changed ? `\n  已移除 ${providerName} 的 Melon Office hooks → ${r.file}` : '\n  没有找到需要移除的配置');
      console.log('  其他来源和原有配置保持不变。\n');
      break;
    }
    case 'status': {
      const c = check(hookOptions);
      console.log(`\n  ${providerName} 配置文件：${c.file}`);
      if (c.state === 'unreadable') console.log('  配置文件不是合法的 JSON，先修好它再接入\n');
      else {
        const r = status(hookOptions);
        if (r.events.length) {
          console.log(`  已接入事件：${r.events.join(', ')}`);
          console.log(c.state === 'stale' ? `  配置是旧版本或端口不同，运行 melon-office init --provider ${provider} 更新\n` : '');
          if (provider === 'codex') console.log('  配置已写入；是否信任请在 Codex 的 /hooks 或「设置 → Hooks」中检查。\n');
        } else console.log(`  还没有接入，先运行 melon-office init --provider ${provider}\n`);
      }
      break;
    }
    case 'update': {
      if (!fs.existsSync(path.join(ROOT, '.git'))) throw new Error('当前不是通过 git 安装的，没法自动更新');
      const r = spawnSync('bash', [path.join(ROOT, 'install.sh')], {
        stdio: 'inherit',
        env: { ...process.env, MELON_OFFICE_HOME: ROOT, MELON_OFFICE_NO_START: '1' },
      });
      process.exit(r.status ?? 1);
      break;
    }
    case 'start':
    case 'demo': {
      ensureBuilt();
      const { startServer } = await import('../server/index.mjs');
      const { url } = await startServer({ port, staff, demo: cmd === 'demo' });
      console.log(`\n  🍈 Melon Office 已开工 → ${url}`);
      // hooks left by an older version (or another port) are brought up to date; never installed stays that way
      if (cmd === 'start') {
        for (const source of ['claude', 'codex']) {
          try {
            const result = repair({ port, provider: source, codexHome });
            if (result.repaired) console.log(source === 'codex' ? '  已更新 Codex 接入配置，请重新审核并信任 hooks' : '  已更新 Claude Code 接入配置');
            if (result.state === 'unreadable') console.log(`  ${source} 接入配置无法读取，请修复 ${result.file}`);
          } catch (error) {
            // A failed hook repair must not stop the already-running office or the other provider.
            console.error(`  ${source} 接入未能更新：${error.message}`);
          }
        }
        if (['claude', 'codex'].every((source) => [false, true].every((project) => check({ port, provider: source, project, codexHome }).state === 'none'))) {
          console.log('  提示：另开终端运行 melon-office init --provider claude 或 melon-office init --provider codex');
        }
      }
      console.log('  按 Ctrl+C 下班\n');
      if (!flag('no-open')) openBrowser(url);
      break;
    }
    case 'help':
    case '--help':
    default:
      console.log(`
  用法：melon-office [命令]

    (无)        开工，等同 start
    demo        演示模式，回放一天的大厂日常
    init        接入所选来源（--provider claude|codex，默认 claude）
    status      查看接入状态
    update      更新到最新版
    uninstall   移除 hooks

  选项：--port 7777  --no-open  --staff 3（常驻人数，0–5）
  接入：--project 只接当前项目；--no-approvals 审批交回原应用
`);
  }
}

run().catch((err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  端口 ${port} 被占用了：工区可能已经开着，或者换个端口 --port 7788\n`);
  else console.error(`\n  ✗ ${err.message || err}\n`);
  process.exit(1);
});
