#!/usr/bin/env node
// melon-office CLI
//   melon-office                     开工（= start）
//   melon-office demo                演示模式（回放假数据，方便录视频）
//   melon-office init [--project] [--port 7777] [--no-approvals]   写入 Claude Code hooks
//   melon-office status | update | uninstall [--project]
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { install, uninstall, status } from '../server/hooks-config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith('-') ? args[0] : 'start';
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const port = Number(opt('port', process.env.MELON_OFFICE_PORT || 7777));

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
  switch (cmd) {
    case 'init': {
      const r = install({ port, project: flag('project'), approvals: !flag('no-approvals') });
      console.log(`\n  已写入 hooks → ${r.file}`);
      if (r.backup) console.log(`  原配置已备份 → ${r.backup}`);
      console.log('  之后新开的 Claude Code 会话会自动走进工区。\n');
      break;
    }
    case 'uninstall': {
      const r = uninstall({ project: flag('project') });
      console.log(r.changed ? `\n  已移除 Melon Office hooks → ${r.file}` : '\n  没有找到需要移除的配置');
      console.log(`  如果还想删掉程序本身：rm -rf "${ROOT}"，以及 PATH 里的 melon-office 命令\n`);
      break;
    }
    case 'status': {
      const r = status({ project: flag('project') });
      console.log(`\n  配置文件：${r.file}`);
      console.log(r.events.length ? `  已接入事件：${r.events.join(', ')}\n` : '  还没有接入，先运行 `melon-office init`\n');
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
      const { url } = await startServer({ port, demo: cmd === 'demo' });
      console.log(`\n  🍈 Melon Office 已开工 → ${url}`);
      if (cmd === 'start' && status().events.length === 0 && status({ project: true }).events.length === 0) {
        console.log('  提示：还没接入 Claude Code，另开一个终端运行 `melon-office init`');
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
    init        接入 Claude Code（--project 只接当前项目，--no-approvals 审批仍走终端）
    status      查看接入状态
    update      更新到最新版
    uninstall   移除 hooks

  选项：--port 7777  --no-open
`);
  }
}

run().catch((err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  端口 ${port} 被占用了：工区可能已经开着，或者换个端口 --port 7788\n`);
  else console.error(`\n  ✗ ${err.message || err}\n`);
  process.exit(1);
});
