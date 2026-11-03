#!/usr/bin/env node
// melon-office CLI
//   melon-office init [--project] [--port 7777] [--no-approvals]   写入 Claude Code hooks
//   melon-office start [--port 7777] [--no-open]                    启动工区
//   melon-office demo  [--port 7777] [--no-open]                    演示模式（回放假数据，方便录视频）
//   melon-office status | uninstall [--project]
import { spawn } from 'node:child_process';
import { install, uninstall, status } from '../server/hooks-config.mjs';
import { startServer } from '../server/index.mjs';

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
  spawn(opener, argv, { stdio: 'ignore', detached: true }).unref();
}

async function run() {
  switch (cmd) {
    case 'init': {
      const r = install({ port, project: flag('project'), approvals: !flag('no-approvals') });
      console.log(`\n  已写入 hooks → ${r.file}`);
      if (r.backup) console.log(`  原配置已备份 → ${r.backup}`);
      console.log('\n  下一步：运行 `melon-office start`，然后正常使用 Claude Code。');
      console.log('  新开的 Claude Code 会话会自动出现在工区里。\n');
      break;
    }
    case 'uninstall': {
      const r = uninstall({ project: flag('project') });
      console.log(r.changed ? `\n  已移除 Melon Office hooks → ${r.file}\n` : '\n  没有找到需要移除的配置\n');
      break;
    }
    case 'status': {
      const r = status({ project: flag('project') });
      console.log(`\n  配置文件：${r.file}`);
      console.log(r.events.length ? `  已接入事件：${r.events.join(', ')}\n` : '  还没有接入，先运行 `melon-office init`\n');
      break;
    }
    case 'start':
    case 'demo': {
      const { url } = await startServer({ port, demo: cmd === 'demo' });
      console.log(`\n  🍈 Melon Office 已开工 → ${url}`);
      console.log('  按 Ctrl+C 下班\n');
      if (!flag('no-open')) openBrowser(url);
      break;
    }
    default:
      console.log('用法：melon-office [init|start|demo|status|uninstall] [--port 7777] [--project] [--no-open] [--no-approvals]');
  }
}

run().catch((err) => {
  if (err.code === 'EADDRINUSE') console.error(`\n  端口 ${port} 被占用了：工区可能已经开着，或者换个端口 --port 7788\n`);
  else console.error(err);
  process.exit(1);
});
