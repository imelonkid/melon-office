// Turns raw tool calls into "what the employee is doing", in plain Chinese.
//   humanize(tool, input) -> { text, gist, raw }
//   text: shown in the bubble          e.g. 新拉分支 docs/release-v0.14.0，再写段临时脚本
//   gist: same without names/paths    e.g. 新拉分支，再写段临时脚本      (record mode)
//   raw : short original command       e.g. git switch -q -c docs/release-v0.14.0
import path from 'node:path';

const clip = (s, n) => {
  const one = String(s || '').replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
};
const say = (g, d = '') => ({ g, d: d ? clip(d, 26) : '' });
// no space before Chinese or 「」 details, a space before Latin ones
const join = (g, d) => (!d ? g : /^[\u4e00-\u9fff「（]/.test(d) ? g + d : `${g} ${d}`);
const zhSpace = (s) => s.replace(/([\u4e00-\u9fff])([A-Za-z])/g, '$1 $2').replace(/([A-Za-z])([\u4e00-\u9fff])/g, '$1 $2');

// ---------------------------------------------------------------- file names -> 中文
const WORDS = [
  [/login|signin|sign-in/i, '登录'], [/logout|signout/i, '退出登录'], [/register|signup/i, '注册'],
  [/auth|oauth|token|session/i, '登录鉴权'], [/user|profile|account/i, '用户'], [/order/i, '订单'],
  [/pay|checkout|billing|invoice/i, '支付'], [/cart/i, '购物车'], [/home|landing/i, '首页'],
  [/search/i, '搜索'], [/setting|config|\.env|rc$/i, '配置'], [/router|route/i, '路由'],
  [/api|client|service|request/i, '接口'], [/store|state|redux|zustand/i, '状态管理'],
  [/style|\.css|\.scss|theme/i, '样式'], [/test|spec/i, '测试'], [/readme/i, '说明文档'],
  [/changelog|release/i, '更新日志'], [/package\.json|requirements|cargo\.toml|go\.mod|podfile/i, '依赖清单'],
  [/docker|compose/i, '容器配置'], [/\.ya?ml$/i, '配置'], [/migration|schema|\.sql$/i, '数据库'],
  [/index|main|app\./i, '入口'], [/\.md$/i, '文档'], [/scene|level|map/i, '场景'], [/player/i, '角色'],
  [/hook/i, '钩子'], [/util|helper/i, '工具函数'], [/component|widget/i, '组件'], [/page|view|screen/i, '页面'],
];
function fileMeaning(file) {
  const base = path.basename(file || '');
  const hits = [];
  for (const [re, zh] of WORDS) {
    if (re.test(base) && !hits.some((h) => h.includes(zh) || zh.includes(h))) hits.push(zh);
  }
  return { base, zh: hits.slice(0, 2).join('') };
}
function fileSay(verb, file) {
  const { base, zh } = fileMeaning(file);
  return zh ? say(`${verb}${zh}`, base) : say(verb, base);
}

// ---------------------------------------------------------------- shell commands
const NOISE = /^(cd|export|source|set|unset|echo|printf|sleep|true|false|clear|\.)$/;

const firstLine = (cmd) => String(cmd || '').split('\n')[0];

function words(seg) {
  return seg.trim().replace(/^[({\s]+|[)}\s]+$/g, '').split(/\s+/)
    .filter((w) => w && !/^\w+=/.test(w) && !/^\d*[<>]/.test(w));
}
const bin = (w) => path.basename(w || '').replace(/\.(app|exe)$/i, '');
const argAfter = (ws, flags) => {
  const i = ws.findIndex((w) => flags.includes(w));
  return i >= 0 ? ws[i + 1] : undefined;
};
const lastArg = (ws) => [...ws].reverse().find((w) => !w.startsWith('-'));

function gitSay(ws, seg = '') {
  const sub = ws[1];
  const rest = ws.slice(2);
  switch (sub) {
    case 'switch': case 'checkout': {
      const nb = argAfter(rest, ['-c', '-b', '-B', '--create']);
      if (nb) return say('新拉分支', nb);
      const target = lastArg(rest);
      return target && !target.includes('.') ? say('切到分支', target) : say('撤回文件改动', target);
    }
    case 'branch': return say('看看有哪些分支');
    case 'add': return say('把改动放进暂存区');
    case 'commit': {
      const m = seg.match(/(?:\s-\w*m|--message)\s+(["'])(.*?)\1/) || seg.match(/(?:\s-\w*m|--message)\s+(\S+)/);
      const msg = m ? (m[2] ?? m[1]) : '';
      return say('提交代码', msg ? `「${clip(msg, 18)}」` : '');
    }
    case 'push': return say('推上去等 CR');
    case 'pull': case 'fetch': return say('同步最新代码');
    case 'merge': return say('合代码', lastArg(rest));
    case 'rebase': return say('变基整理提交');
    case 'cherry-pick': return say('挑个提交过来');
    case 'status': case 'diff': return say('看看改了些啥');
    case 'log': case 'show': case 'blame': return say('翻提交记录');
    case 'stash': return say('先把改动藏起来');
    case 'tag': return say('打版本标签', lastArg(rest));
    case 'clone': return say('拉代码仓库', lastArg(rest) && path.basename(lastArg(rest)).replace(/\.git$/, ''));
    case 'reset': case 'restore': return say('回滚改动');
    case 'worktree': return say('开个新工作区');
    default: return say('操作 Git', sub);
  }
}

function pkgSay(ws) {
  const tool = bin(ws[0]);
  const sub = ws[1] === 'run' ? ws[2] : ws[1];
  if (!sub || /^(i|install|add|ci)$/.test(sub)) return say('装依赖', ws[1] === 'add' ? ws[2] : '');
  if (/^(remove|uninstall|rm)$/.test(sub)) return say('删依赖', ws[2]);
  if (/build/.test(sub)) return say('打包构建');
  if (/test|vitest|jest/.test(sub)) return say('跑测试');
  if (/^(dev|start|serve|preview)/.test(sub)) return say('起本地服务');
  if (/lint|format|prettier|typecheck|tsc/.test(sub)) return say('代码检查');
  if (/deploy|release|publish/.test(sub)) return say('发布上线');
  if (/^(npx|pnpx|bunx)$/.test(tool) || ws[1] === 'exec' || ws[1] === 'dlx') return say('临时跑个工具', ws[1] === 'exec' || ws[1] === 'dlx' ? ws[2] : ws[1]);
  return say('跑项目脚本', sub);
}

const RULES = [
  [/^git$/, gitSay],
  [/^gh$/, (ws) => (ws[1] === 'pr' ? (ws[2] === 'create' ? say('提 PR，求 CR') : say('处理 PR')) : ws[1] === 'issue' ? say('看 issue') : say('操作 GitHub'))],
  [/^(npm|pnpm|yarn|bun|npx|pnpx|bunx)$/, pkgSay],
  [/^(vitest|jest|pytest|mocha|playwright)$/, () => say('跑测试')],
  [/^(tsc|eslint|prettier|ruff|black|mypy|swiftlint)$/, () => say('代码检查')],
  [/^(vite|webpack|rollup|esbuild|turbo|make|cmake|gradle|gradlew|mvn)$/, () => say('打包构建')],
  [/^(cargo|go|swift|dotnet)$/, (ws) => (/test/.test(ws[1]) ? say('跑测试') : /run/.test(ws[1]) ? say('把程序跑起来') : say('编译代码'))],
  [/^(xcodebuild|xcrun|fastlane)$/, () => say('编 iOS 包')],
  [/^(python|python3|node|deno|ruby|php|bash|sh|zsh|tsx|ts-node)$/, (ws) => {
    const script = ws.slice(1).find((w) => !w.startsWith('-'));
    if (!script || script === '-' || ws.includes('-c') || ws.includes('-e')) return say('写了段临时脚本');
    if (/^(pip|venv|http\.server)$/.test(script) || ws.includes('-m')) return say('跑个工具', ws[ws.indexOf('-m') + 1]);
    return say('跑脚本', path.basename(script));
  }],
  [/^(pip|pip3|uv|poetry|conda)$/, () => say('装 Python 依赖')],
  [/^(brew|apt|apt-get|yum)$/, (ws) => say('装工具', lastArg(ws.slice(2)))],
  [/^(docker|docker-compose|podman)$/, (ws) => (/build/.test(ws[1]) ? say('打容器镜像') : /up|run|start/.test(ws[1]) ? say('启动容器') : say('操作容器'))],
  [/^(kubectl|helm)$/, () => say('操作线上集群')],
  [/^(curl|wget|http|httpie)$/, (ws) => {
    const url = ws.find((w) => /^https?:/.test(w.replace(/^["']/, '')));
    let host = '';
    try { host = url ? new URL(url.replace(/^["']|["']$/g, '')).host : ''; } catch { /* ignore */ }
    return /localhost|127\.0\.0\.1/.test(host) ? say('自测一下本地接口') : say('调接口', host);
  }],
  [/^(ssh|scp|rsync)$/, (ws) => say('上服务器', ws.find((w) => w.includes('@')))],
  [/^(ls|tree|find|fd|du|pwd)$/, () => say('翻翻目录')],
  [/^(cat|head|tail|less|more|bat|wc|sed|awk|jq|sort|uniq|diff)$/, (ws) => say('看文件内容', lastArg(ws.slice(1)) && path.basename(lastArg(ws.slice(1))))],
  [/^(grep|rg|ag|ack)$/, () => say('全局搜代码')],
  [/^(mkdir|touch)$/, () => say('新建文件')],
  [/^(mv|cp|ln)$/, () => say('挪挪文件')],
  [/^(rm|rmdir|trash)$/, () => say('清理文件')],
  [/^(chmod|chown)$/, () => say('改文件权限')],
  [/^(tar|zip|unzip|gzip)$/, () => say('打包解压')],
  [/^(open|code|cursor)$/, () => say('打开个应用')],
  [/^(kill|pkill|killall|lsof|ps|top)$/, () => say('处理卡住的进程')],
  [/^(godot|godot4)$/i, () => say('启动游戏引擎')],
  [/^(unity|blender)$/i, (ws) => say('启动', bin(ws[0]))],
  [/^(ffmpeg|magick|convert|sips)$/, () => say('处理图片视频')],
  [/^(psql|mysql|sqlite3|redis-cli|mongosh)$/, () => say('查数据库')],
  [/^(claude)$/, () => say('摇了个 AI 同事帮忙')],
];

function commandSay(seg) {
  const ws = words(seg);
  if (!ws.length) return null;
  const b = bin(ws[0]);
  if (NOISE.test(b)) return null;
  for (const [re, fn] of RULES) if (re.test(b)) return fn(ws, seg);
  return null;
}

export function shortCommand(cmd = '') {
  const segs = firstLine(cmd).split(/&&|\|\||;|\|/).map((s) => s.trim()).filter(Boolean);
  const main = segs.find((s) => { const w = words(s); return w.length && !NOISE.test(bin(w[0])); }) || segs[0] || '';
  const ws = words(main).map((w) => w.replace(/^["']|["']$/g, ''))
    .map((w) => (w.includes('/') && !/^https?:/.test(w) && !/^(-|\w+\/[\w.-]+$)/.test(w) ? path.basename(w.replace(/\/+$/, '')) || w : w));
  return clip(ws.join(' '), 34);
}

function bashSay(input) {
  const segs = firstLine(input.command).split(/&&|\|\||;/).map((s) => s.split('|')[0]).filter((s) => s.trim());
  const parts = [];
  for (const s of segs) {
    const r = commandSay(s);
    if (r && !parts.some((p) => p.g === r.g)) parts.push(r);
  }
  // 暂存 is boring when something more meaningful happens in the same command
  if (parts.length > 1) parts.splice(0, parts.length, ...parts.filter((p) => p.g !== '把改动放进暂存区'));
  if (parts.length) {
    const top = parts.slice(0, 2);
    return {
      text: top.map((p) => join(p.g, p.d)).join('，再'),
      gist: top.map((p) => p.g).join('，再'),
    };
  }
  // Claude writes a short description for every shell command; better than guessing
  if (input.description) return { text: clip(input.description, 40), gist: '跑个命令' };
  return { text: '跑个命令', gist: '跑个命令' };
}

// ---------------------------------------------------------------- MCP / plugin tools
const SERVERS = [
  [/github|gitlab/i, 'GitHub'], [/slack/i, 'Slack'], [/notion/i, 'Notion'], [/figma/i, 'Figma'],
  [/linear|jira|asana/i, '任务系统'], [/gmail|mail/i, '邮箱'], [/calendar/i, '日历'], [/drive|docs/i, '云文档'],
  [/chrome|browser|playwright|puppeteer/i, '浏览器'], [/memory/i, '记事本'], [/filesystem|remote-devices/i, '电脑文件'],
  [/sentry|datadog|grafana/i, '监控'], [/postgres|mysql|supabase|db/i, '数据库'], [/feishu|lark/i, '飞书'], [/dingtalk/i, '钉钉'],
];
function mcpSay(tool) {
  const [, server = '', name = ''] = tool.split('__');
  const where = (SERVERS.find(([re]) => re.test(server)) || [])[1] || '';
  const n = name.toLowerCase();
  const act =
    /wrap_?up|finish|complete|done|summar/.test(n) ? '收个尾，写总结' :
    /screenshot|navigate|click|type|scroll|tab/.test(n) ? '操作浏览器' :
    /pull_?request|create_pr/.test(n) ? '提 PR，求 CR' :
    /search|query|find|lookup/.test(n) ? `查${where || '资料'}` :
    /send|post|reply|comment|message/.test(n) ? `在${where || '外部'}发消息` :
    /create|write|update|edit|insert|upload|set|add/.test(n) ? `更新${where || '外部数据'}` :
    /delete|remove|archive/.test(n) ? `清理${where || '外部数据'}` :
    /read|get|fetch|list|view|open/.test(n) ? `查看${where || '外部数据'}` :
    where ? `用${where}干活` : '用插件干活';
  return { text: zhSpace(act), gist: zhSpace(act) };
}

// ---------------------------------------------------------------- entry
export function humanize(tool = '', input = {}) {
  input = input || {};
  const file = input.file_path || input.notebook_path || input.path;
  let r;
  let raw = '';
  switch (tool) {
    case 'apply_patch': {
      const patch = typeof input === 'string' ? input : input.command || '';
      const match = patch.match(/\*\*\* (Update|Add|Delete) File: ([^\n]+)/);
      r = match ? fileSay(match[1] === 'Add' ? '写' : match[1] === 'Delete' ? '删除' : '改', match[2]) : say('修改代码');
      break;
    }
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': r = fileSay('改', file); raw = path.basename(file || ''); break;
    case 'Write': r = fileSay('写', file); raw = path.basename(file || ''); break;
    case 'Read': r = fileSay('看', file); raw = path.basename(file || ''); break;
    case 'Grep': r = say('全局搜', `「${clip(input.pattern, 16)}」`); raw = `grep ${clip(input.pattern, 24)}`; break;
    case 'Glob': case 'LS': r = say('找文件', clip(input.pattern || input.path, 20)); break;
    case 'Bash': {
      const b = bashSay(input);
      return { text: b.text, gist: b.gist, raw: input.command ? `$ ${shortCommand(input.command)}` : '' };
    }
    case 'BashOutput': case 'Monitor': r = say('盯着命令的输出'); break;
    case 'KillShell': case 'KillBash': r = say('停掉一个后台命令'); break;
    case 'WebSearch': r = say('上网搜', clip(input.query, 20)); break;
    case 'WebFetch': {
      let host = '';
      try { host = new URL(input.url).host; } catch { /* ignore */ }
      r = say('看网页', host);
      break;
    }
    case 'Task': case 'Agent':
      return { text: input.description ? join('拉实习生去', clip(input.description, 22)) : '拉了个实习生', gist: '拉了个实习生', raw: '' };
    case 'TodoWrite': case 'TaskCreate': case 'TaskUpdate': r = say('更新待办清单'); break;
    case 'Skill': r = say('翻操作手册', input.skill || input.command); break;
    case 'AskUserQuestion': r = say('老板，有个问题想问你'); break;
    case 'ExitPlanMode': r = say('方案写好了，等你拍板'); break;
    case 'EnterPlanMode': r = say('先出个方案'); break;
    case 'SendUserMessage': r = say('给你发了条消息'); break;
    default:
      if (tool.startsWith('mcp__')) return { ...mcpSay(tool), raw: tool.split('__').slice(1).join(' · ') };
      r = say(`用 ${tool} 干活`);
  }
  const text = join(r.g, r.d);
  return { text, gist: r.g, raw: raw && text.includes(raw) ? '' : raw };
}
