// The office model: turns Claude Code hook events into "employees" with a seat, a status and a line to say.
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { humanize } from './translate.mjs';
import { loadSettings, saveSettings } from './settings.mjs';
import { reportText, saveReport } from './report.mjs';
import { Memory } from './memory.mjs';
import { employeeProfile } from './employee-profile.mjs';

export const CAST = [
  { key: 'gua', name: '小瓜', role: '前端', level: 'P6' },
  { key: 'tian', name: '小甜', role: '测试', level: 'P5' },
  { key: 'zi', name: '小籽', role: '文案', level: 'P5' },
  { key: 'agua', name: '阿瓜', role: '运维', level: 'P6' },
  { key: 'pi', name: '小皮', role: '调研', level: 'P5' },
];
export const SEAT_COUNT = 6;
// sprites for people who only come in for one job (外包 / 实习生)
const GUESTS = ['g1', 'g2', 'g3', 'g4'];
const CHAT_PAIRS = 2; // spots in the pantry where two people can gossip

// what people do when there is nothing to do
const SLACK = {
  phone: ['刷到个好笑的视频', '看看基金，又绿了', '外卖还有 8 分钟到', '在群里抢红包', '刷一会儿小红书'],
  cat: ['猫主子今天不理我', '行政猫是不是又胖了', '撸猫解压，比开会管用', '咪咪，来给你挠挠'],
  coffee: ['带薪喝咖啡', '续杯，续命', '今天的零食又被抢光了', '茶水间补充一下能量'],
};
const GOSSIP = [
  ['听说隔壁组又要拆了', '真的假的，我们会被合并吗'],
  ['今年年终奖几个月？', '别问，问就是共克时艰'],
  ['你周报写了吗', '写了，全靠「持续推进」'],
  ['中午吃啥？', '楼下那家又涨价了'],
  ['老板说的抓手到底是啥', '不知道，先对齐一下'],
];

// 瓜老板 comes out to give a speech when too many people are slacking
const SCOLD_MS = 15000;
const SCOLD_GAP = 180000; // at most once every 3 minutes
const SCOLD = [
  '我看到很多同学在摸鱼，我很痛心',
  '你的价值在哪里？护城河在哪里？',
  '今天最好的表现，是明天最低的要求',
  '都几点了还在刷手机？结果呢？抓手呢？',
  '我不看过程，我只看结果',
  '公司不养闲人，大家自己想想',
];
const FAKE_BUSY = ['在改了在改了', '马上马上', '我在对齐需求', '正在梳理方法论', '刚在想方案'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pad2 = (n) => String(n).padStart(2, '0');

export function classify(tool = '') {
  if (/^(Edit|Write|MultiEdit|NotebookEdit|apply_patch)$/.test(tool)) return 'edit';
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
  // staff: how many employees are in the office even when no session is running
  // remember: keep who-worked-on-what on disk (off for the demo)
  constructor({ staff = 3, remember = true } = {}) {
    super();
    this.agents = new Map();
    this.links = new Map(); // session key (session_id, or session_id:agent_id) -> agent id
    this.pending = new Map();
    this.feed = [];
    this.stats = { delivered: 0, toolCalls: 0, approvals: 0, prompts: 0, failures: 0, slack: 0, scoldings: 0, since: Date.now() };
    this.scold = null;
    this.lastScold = Date.now() - SCOLD_GAP + 60000; // first speech no sooner than a minute after opening
    this.approvals = { enabled: true, clients: 0 };
    this.settings = loadSettings();
    this.memory = new Memory({ persist: remember });
    this.lastReport = null;
    this.seq = 0;
    this.hired = { guest: 0, intern: 0, contractor: 0 };
    const n = Math.max(0, Math.min(CAST.length, Math.floor(Number(staff) || 0)));
    CAST.slice(0, n).forEach((c, i) => this.addResident(c, i));
    this.ticker = setInterval(() => this.shuffleSlack(), 4000);
    this.ticker.unref?.();
  }

  // stop the clock and let every held approval fall back to the terminal (used when the office is rebuilt)
  dispose() {
    clearInterval(this.ticker);
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.resolve(null); }
    this.pending.clear();
    this.removeAllListeners();
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

  // someone new walking in: a cast member who isn't in the office yet, else a numbered 外包 / 实习生.
  // Numbers only go up, so two people never share a name.
  // prefer: a cast key to bring back (the person who worked on this before)
  hire(isSub, prefer = null) {
    if (!isSub) {
      const present = new Set([...this.agents.values()].map((a) => a.cast));
      const free = CAST.find((c) => c.key === prefer && !present.has(c.key)) || CAST.find((c) => !present.has(c.key));
      if (free) return { ...free };
    }
    const cast = GUESTS[this.hired.guest++ % GUESTS.length];
    return isSub
      ? { key: cast, name: `实习${pad2(++this.hired.intern)}号`, role: '实习生', level: 'P4' }
      : { key: cast, name: `外包${pad2(++this.hired.contractor)}号`, role: '外包', level: 'P5' };
  }

  blank(id, cast, patch) {
    const now = Date.now();
    return {
      id, sessionId: null, provider: null, isSub: false, resident: false, parentName: null,
      cast: cast.key, name: cast.name, role: cast.role, level: cast.level,
      project: '', seat: null, status: 'thinking', kind: 'think', tool: '', detail: '',
      line: '', gist: '', raw: '', activity: null, partner: null, slackUntil: 0, slackSince: 0,
      toolCalls: 0, startedAt: now, updatedAt: now, ...patch,
    };
  }

  addResident(cast, seat) {
    const a = this.blank(`staff:${cast.key}`, cast, { resident: true, seat });
    this.agents.set(a.id, a);
    this.startSlacking(a);
  }

  ensure(evt) {
    const sid = evt.session_id;
    const provider = evt.provider || 'claude';
    const rootKey = JSON.stringify([provider, sid]);
    const key = evt.agent_id ? JSON.stringify([provider, sid, evt.agent_id]) : rootKey;
    const known = this.agents.get(this.links.get(key));
    if (known) return known;

    const project = evt.cwd ? path.basename(evt.cwd) : '';
    const isSub = Boolean(evt.agent_id);
    // the same job goes back to the same person: whoever had this session before (resumed),
    // else whoever worked in this project last. If they're busy, someone else takes it.
    // Retain existing Claude memory keys; Codex has a separate namespace.
    const memoryKey = provider === 'claude' ? sid : rootKey;
    const bySession = isSub ? null : this.memory.forSession(memoryKey);
    const owner = bySession || (isSub ? null : this.memory.forProject(evt.cwd));
    const welcomeBack = bySession ? '接着上次的活干' : '这个项目我熟，我来';
    // a resident with nothing to do takes the job; subagents are always fresh interns
    const slackers = isSub ? [] : [...this.agents.values()].filter((x) => x.resident && x.status === 'slacking');
    // an owner who isn't in the office (a colleague who came in for it last time) is called back in,
    // even when a resident is free
    const ownerAway = owner && ![...this.agents.values()].some((x) => x.cast === owner);
    let a = slackers.find((x) => owner && x.cast === owner) || (ownerAway ? null : slackers[0]) || null;
    if (a) {
      this.stopSlacking(a);
      const line = owner && a.cast === owner ? welcomeBack : '来活了，放下手机';
      this.set(a, { sessionId: sid, provider, project, status: 'thinking', kind: 'think', tool: '', detail: '', toolCalls: 0, startedAt: Date.now(), line });
    } else {
      const parent = isSub ? this.agents.get(this.links.get(rootKey)) : null;
      const cast = this.hire(isSub, owner);
      const line = isSub ? `实习生报到，跟着${parent?.name || '组长'}干` : owner && cast.key === owner ? welcomeBack : '新同学入职，先熟悉一下项目';
      a = this.blank(key, cast, {
        sessionId: sid, provider, isSub: Boolean(evt.agent_id), parentName: parent?.name || null,
        project, seat: this.freeSeat(), line, gist: line,
      });
      this.agents.set(a.id, a);
    }
    this.links.set(key, a.id);
    if (!isSub && CAST.some((c) => c.key === a.cast)) { // not the numbered 外包
      // helping out while the owner is busy elsewhere doesn't make you the project's owner
      const ownerBusy = owner && owner !== a.cast && [...this.agents.values()].some((x) => x.cast === owner && x.sessionId);
      this.memory.remember(memoryKey, evt.cwd, a.cast, { project: !ownerBusy });
    }
    this.log(a, a.line);
    return a;
  }

  unlink(a) {
    for (const [k, id] of this.links) if (id === a.id) this.links.delete(k);
  }

  // ---------- 摸鱼 ----------
  startSlacking(a, line) {
    this.clearPending(a);
    this.unlink(a);
    this.set(a, { sessionId: null, provider: null, project: '', status: 'slacking', kind: 'idle', tool: '', detail: '', toolCalls: 0, startedAt: Date.now(), slackSince: Date.now() });
    this.pickActivity(a);
    if (line) this.set(a, { line });
  }

  stopSlacking(a) {
    if (a.status === 'slacking') this.stats.slack += Date.now() - a.slackSince;
    const mate = a.partner && this.agents.get(a.partner);
    this.set(a, { status: 'thinking', activity: null, partner: null, slackUntil: 0 });
    if (mate && mate.partner === a.id) this.pickActivity(mate);
  }

  pickActivity(a) {
    const now = Date.now();
    const slackers = [...this.agents.values()].filter((x) => x.status === 'slacking');
    const chats = slackers.filter((x) => x.activity === 'chat').length / 2;
    const free = slackers.filter((x) => x !== a && !x.partner && x.activity !== 'fake');
    const mate = chats < CHAT_PAIRS && free.length && Math.random() < 0.5 ? pick(free) : null;
    const until = now + 25000 + Math.random() * 25000;
    if (mate) {
      const [first, second] = pick(GOSSIP);
      this.set(a, { activity: 'chat', partner: mate.id, slackUntil: until, line: first });
      this.set(mate, { activity: 'chat', partner: a.id, slackUntil: until, line: second });
      return;
    }
    const options = ['phone', 'phone', 'coffee'];
    if (a.seat == null) options.splice(0, 2, 'coffee');
    if (!slackers.some((x) => x !== a && x.activity === 'cat')) options.push('cat');
    const activity = pick(options);
    this.set(a, { activity, partner: null, slackUntil: until, line: pick(SLACK[activity]) });
  }

  shuffleSlack() {
    const now = Date.now();
    let moved = false;
    for (const a of this.agents.values()) {
      if (a.status !== 'slacking' || a.slackUntil > now) continue;
      const mate = a.partner && this.agents.get(a.partner);
      this.set(a, { activity: null, partner: null });
      if (mate && mate.partner === a.id) this.set(mate, { activity: null, partner: null });
      this.pickActivity(a);
      if (mate && mate.status === 'slacking' && !mate.activity) this.pickActivity(mate);
      moved = true;
    }
    if (this.maybeScold(now)) moved = true;
    if (moved) this.changed();
  }

  // ---------- 训话 ----------
  maybeScold(now) {
    if (this.scold || now - this.lastScold < SCOLD_GAP) return false;
    const live = [...this.agents.values()].filter((x) => x.status !== 'leaving');
    const slackers = live.filter((x) => x.status === 'slacking');
    if (slackers.length < 3 && !(slackers.length >= 2 && slackers.length / live.length >= 0.6)) return false;

    const lines = [...SCOLD].sort(() => Math.random() - 0.5).slice(0, 2);
    this.scold = { id: `s${++this.seq}`, startedAt: now, until: now + SCOLD_MS, lines };
    this.lastScold = now;
    this.stats.scoldings++;
    for (const a of slackers) {
      // everyone scrambles back to their desk and pretends to work until a little after he leaves
      this.set(a, { activity: 'fake', partner: null, slackUntil: now + SCOLD_MS + 2000 + Math.random() * 6000, line: pick(FAKE_BUSY) });
    }
    this.feed.unshift({ t: now, agentId: '', name: '瓜老板', text: '在工区训话' });
    setTimeout(() => this.endScold(), SCOLD_MS).unref?.();
    return true;
  }

  endScold() {
    this.scold = null;
    // somebody always mutters the obvious once he's gone
    const fakers = [...this.agents.values()].filter((x) => x.status === 'slacking' && x.activity === 'fake');
    const who = fakers.length ? pick(fakers) : null;
    if (who) this.set(who, { line: '那倒是给我派活啊', slackUntil: Math.max(who.slackUntil, Date.now() + 6000) });
    this.changed();
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
      this.unlink(a);
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
      const team = [...this.agents.values()].filter((x) => x.sessionId === evt.session_id && x.provider === (evt.provider || 'claude') && x.status !== 'leaving');
      for (const x of team) {
        if (x.resident) {
          this.log(x, '活干完了，回去摸鱼');
          this.startSlacking(x);
        } else {
          this.leave(x, x.isSub ? '活交了，实习生下班' : '下班打卡');
        }
      }
      this.changed();
      return;
    }
    const a = this.ensure(evt);

    switch (ev) {
      case 'SessionStart':
        this.set(a, { status: 'thinking', kind: 'think', line: evt.source === 'resume' ? '接着上次的活干' : evt.source === 'compact' ? '整理完工位，继续' : a.line });
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
      case 'Interrupt':
        this.clearPending(a);
        this.set(a, { status: 'idle', kind: 'idle', tool: '', detail: '', line: '任务已暂停，等你安排' });
        this.log(a, '任务中断');
        break;
      case 'PostCompact':
        this.set(a, { status: 'thinking', kind: 'think', line: '整理完工位，继续' });
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

  // ---------- settings & daily report ----------
  setSettings(patch) {
    this.settings = saveSettings({ ...this.settings, ...patch });
    this.changed();
    return this.settings;
  }

  /** saves the HTML daily report and returns its path */
  saveReport() {
    this.lastReport = saveReport({ ...this.snapshot(), feed: this.feed }, this.settings);
    return this.lastReport;
  }

  slackingNow() {
    const now = Date.now();
    let ms = 0;
    for (const a of this.agents.values()) if (a.status === 'slacking') ms += now - a.slackSince;
    return ms;
  }

  snapshot() {
    const now = Date.now();
    return {
      agents: [...this.agents.values()].map((a) => ({ ...a, profile: employeeProfile(a, this.feed, now) })),
      pending: [...this.pending.values()].map(({ id, agentId, tool, detail, gist, raw, holding }) => ({ id, agentId, tool, detail, gist, raw, holding })),
      stats: { ...this.stats, slack: this.stats.slack + this.slackingNow() },
      feed: this.feed.slice(0, 12),
      approvals: { enabled: this.approvals.enabled, active: this.canHold() },
      scold: this.scold,
      settings: this.settings,
      reportText: reportText(this.stats, [...this.agents.values()].filter((a) => a.status !== 'gone').length),
      now,
    };
  }
}
