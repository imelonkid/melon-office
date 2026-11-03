// The office model: turns Claude Code hook events into "employees" with a seat, a status and a line to say.
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { humanize } from './translate.mjs';

export const CAST = [
  { key: 'gua', name: '小瓜', role: '前端', level: 'P6' },
  { key: 'tian', name: '小甜', role: '测试', level: 'P5' },
  { key: 'zi', name: '小籽', role: '文案', level: 'P5' },
  { key: 'agua', name: '阿瓜', role: '运维', level: 'P6' },
  { key: 'pi', name: '小皮', role: '调研', level: 'P5' },
];
export const SEAT_COUNT = 6;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clip = (s, n = 48) => {
  if (!s) return '';
  const one = String(s).replace(/\s+/g, ' ').trim();
  return one.length > n ? one.slice(0, n - 1) + '…' : one;
};

export function classify(tool = '') {
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) return 'edit';
  if (tool === 'Read') return 'read';
  if (/^(Grep|Glob|LS)$/.test(tool)) return 'search';
  if (/^(Bash|BashOutput|KillShell|KillBash|Monitor)$/.test(tool)) return 'bash';
  if (/^(WebSearch|WebFetch)$/.test(tool)) return 'web';
  if (/^(Task|Agent)$/.test(tool)) return 'task';
  if (/^(TodoWrite|TaskCreate|TaskUpdate|ExitPlanMode|EnterPlanMode)$/.test(tool)) return 'plan';
  return 'other';
}

// what the employee says while using a tool: see translate.mjs
export { humanize, shortCommand } from './translate.mjs';

export class Office extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.pending = new Map();
    this.feed = [];
    this.stats = { delivered: 0, toolCalls: 0, approvals: 0, prompts: 0, failures: 0, since: Date.now() };
    this.approvals = { enabled: true, clients: 0 };
    this.seq = 0;
  }

  // ---------- helpers ----------
  changed() { this.emit('change'); }

  log(agent, text) {
    this.feed.unshift({ t: Date.now(), agentId: agent.id, name: agent.name, text });
    this.feed.length = Math.min(this.feed.length, 30);
  }

  freeSeat() {
    const used = new Set([...this.agents.values()].filter((a) => a.status !== 'gone').map((a) => a.seat));
    for (let i = 0; i < SEAT_COUNT; i++) if (!used.has(i)) return i;
    return null;
  }

  freeCast() {
    const used = new Set([...this.agents.values()].map((a) => a.cast));
    const free = CAST.find((c) => !used.has(c.key));
    if (free) return { ...free };
    const base = CAST[this.agents.size % CAST.length];
    return { ...base, name: `${base.name}${this.agents.size + 1}号` };
  }

  ensure(evt) {
    const sid = evt.session_id;
    const id = evt.agent_id ? `${sid}:${evt.agent_id}` : sid;
    let a = this.agents.get(id);
    if (!a) {
      const cast = this.freeCast();
      const parent = evt.agent_id ? this.agents.get(sid) : null;
      a = {
        id,
        sessionId: sid,
        isSub: Boolean(evt.agent_id),
        parentName: parent?.name || null,
        cast: cast.key,
        name: cast.name,
        role: evt.agent_id ? '实习生' : cast.role,
        level: evt.agent_id ? 'P4' : cast.level,
        project: evt.cwd ? path.basename(evt.cwd) : '',
        seat: this.freeSeat(),
        status: 'thinking',
        kind: 'think',
        tool: '',
        detail: '',
        line: evt.agent_id ? `实习生报到，跟着${parent?.name || '组长'}干` : '新同学入职，先熟悉一下项目',
        toolCalls: 0,
        startedAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.agents.set(id, a);
      this.log(a, a.line);
    }
    return a;
  }

  set(a, patch) {
    // a line that doesn't come from a tool has nothing to hide and no raw command
    if ('line' in patch && !('gist' in patch)) patch.gist = patch.line;
    if ('line' in patch && !('raw' in patch)) patch.raw = '';
    Object.assign(a, patch, { updatedAt: Date.now() });
  }

  leave(a, line) {
    this.set(a, { status: 'leaving', line, kind: 'idle' });
    this.log(a, line);
    setTimeout(() => {
      a.status = 'gone';
      this.agents.delete(a.id);
      this.changed();
    }, 9000);
  }

  clearPending(a) {
    for (const [pid, p] of this.pending) {
      if (p.agentId === a.id) {
        clearTimeout(p.timer);
        p.resolve(null);
        this.pending.delete(pid);
      }
    }
  }

  // ---------- hook events ----------
  handle(evt) {
    if (!evt || !evt.session_id || !evt.hook_event_name) return;
    const ev = evt.hook_event_name;
    if (ev === 'SessionEnd') {
      const subs = [...this.agents.values()].filter((x) => x.sessionId === evt.session_id);
      subs.forEach((x) => this.leave(x, '下班打卡'));
      this.changed();
      return;
    }
    const a = this.ensure(evt);

    switch (ev) {
      case 'SessionStart':
        this.set(a, { status: 'thinking', kind: 'think', line: evt.source === 'resume' ? '接着昨天的活干' : evt.source === 'compact' ? '整理完工位，继续' : a.line });
        break;
      case 'UserPromptSubmit':
        this.stats.prompts++;
        this.clearPending(a);
        this.set(a, { status: 'thinking', kind: 'think', line: pick(['收到，马上对齐', '好的老板，这就安排', '明白，我先拆解一下']) });
        this.log(a, '接到新需求');
        break;
      case 'PreToolUse': {
        const h = humanize(evt.tool_name, evt.tool_input);
        this.clearPending(a);
        a.toolCalls++;
        this.stats.toolCalls++;
        this.set(a, { status: 'working', kind: classify(evt.tool_name), tool: evt.tool_name, detail: h.raw, line: h.text, gist: h.gist, raw: h.raw });
        this.log(a, h.text);
        break;
      }
      case 'PostToolUse':
        if (a.status === 'waiting') { this.clearPending(a); this.set(a, { status: 'working' }); }
        break;
      case 'PostToolUseFailure':
        this.stats.failures++;
        this.set(a, { status: 'working', kind: 'fail', line: pick(['翻车了，再来一次', '这个不符合预期，复盘一下']) });
        this.log(a, '翻车了');
        break;
      case 'Notification':
        if (evt.notification_type === 'permission_prompt' || /permission/i.test(evt.message || '')) {
          if (a.status !== 'waiting') this.set(a, { status: 'waiting', kind: 'wait', line: '老板，终端里有个审批等你' });
        } else if (evt.notification_type === 'idle_prompt' || /waiting for your input/i.test(evt.message || '')) {
          this.set(a, { status: 'idle', kind: 'idle', line: '老板，在吗？' });
        }
        break;
      case 'Stop':
        this.stats.delivered++;
        this.clearPending(a);
        this.set(a, { status: 'idle', kind: 'idle', tool: '', detail: '', line: pick(['交付了，等你验收', '搞定，带薪喝杯咖啡', '闭环了，去茶水间回回血']) });
        this.log(a, '交付');
        break;
      case 'SubagentStart':
        // the subagent itself is created by ensure() when agent_id is present
        if (!evt.agent_id) this.set(a, { line: '拉了个实习生一起干' });
        break;
      case 'SubagentStop':
        if (evt.agent_id) {
          this.stats.delivered++;
          this.leave(a, '活交了，实习生下班');
        }
        break;
      case 'PreCompact':
        this.set(a, { kind: 'think', line: '记性不够用了，整理下工位' });
        break;
      default:
        break;
    }
    this.changed();
  }

  // PermissionRequest: optionally hold the hook open until someone clicks 同意/驳回 in the office.
  requestPermission(evt, { hold, timeoutMs = 55000, autoAfterMs = 0 } = {}) {
    const a = this.ensure(evt);
    const h = humanize(evt.tool_name, evt.tool_input);
    const detail = h.text;
    const id = `p${++this.seq}`;
    this.set(a, { status: 'waiting', kind: 'wait', tool: evt.tool_name || '', detail: h.raw, line: '老板，有个审批要你过一下' });
    this.log(a, `申请：${h.text}`);
    return new Promise((resolve) => {
      if (!hold) {
        // just show it; the terminal prompt handles the decision
        resolve(null);
        this.pending.set(id, { id, agentId: a.id, tool: evt.tool_name, detail, gist: h.gist, raw: h.raw, holding: false, resolve: () => {}, timer: null });
        this.changed();
        return;
      }
      const finish = (decision) => {
        if (!this.pending.has(id)) return;
        const p = this.pending.get(id);
        clearTimeout(p.timer);
        this.pending.delete(id);
        if (decision) {
          this.stats.approvals++;
          this.set(a, { status: 'working', line: decision === 'allow' ? '收到，马上执行' : '好的，换个方案' });
          this.log(a, decision === 'allow' ? '审批通过' : '被驳回');
        }
        this.changed();
        resolve(decision);
      };
      const timer = setTimeout(() => finish(autoAfterMs ? 'allow' : null), autoAfterMs || timeoutMs);
      this.pending.set(id, { id, agentId: a.id, tool: evt.tool_name, detail, gist: h.gist, raw: h.raw, holding: true, resolve: finish, timer });
      this.changed();
    });
  }

  decide(id, behavior) {
    const p = this.pending.get(id);
    if (!p || !p.holding) return false;
    p.resolve(behavior === 'deny' ? 'deny' : 'allow');
    return true;
  }

  canHold() {
    return this.approvals.enabled && this.approvals.clients > 0;
  }

  snapshot() {
    return {
      agents: [...this.agents.values()],
      pending: [...this.pending.values()].map(({ id, agentId, tool, detail, gist, raw, holding }) => ({ id, agentId, tool, detail, gist, raw, holding })),
      stats: this.stats,
      feed: this.feed.slice(0, 12),
      approvals: { enabled: this.approvals.enabled, active: this.canHold() },
      now: Date.now(),
    };
  }
}
