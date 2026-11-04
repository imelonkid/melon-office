// The OA 工作台 on the right: approvals, who is working, who is slacking, the daily report, and settings.
import layoutData from '../public/assets/layout.json';
import type { Agent, State } from './types';
import { net } from './net';
import { onEmployeeSelected, selectEmployee } from './selection';
import { ACTIVITY, RECORD, askOf, lineOf, projectOf, rawOf, since } from './copy';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const KIND_CLASS: Record<string, string> = { edit: 'k-edit', read: 'k-read', search: 'k-read', bash: 'k-bash', web: 'k-web', fail: 'k-fail' };

const characterAssets: Record<string,string> = layoutData.characters;
function avatar(a: Agent) {
  return `<div class="avatar" style="background-image:url(assets/illustration/${characterAssets[a.cast]}.png)"></div>`;
}

function card(a: Agent, now: number, right: string, sub: string, cls = '') {
  const proj = projectOf(a);
  const working = a.status === 'working' || a.status === 'thinking';
  const raw = working ? '' : rawOf(a.raw);
  return `<div class="card employee-link ${cls}" data-employee="${esc(a.id)}" role="button" tabindex="0" aria-label="查看${esc(a.name)}的员工档案">
    ${avatar(a)}
    <div class="card-body">
      <div class="card-top"><b>${esc(a.name)}</b><span class="muted">${esc(right || since(a.startedAt, now))}</span></div>
      <div class="card-line">${working ? '工作中<span class="work-dots" aria-label="进行中"><i></i><i></i><i></i></span>' : sub}</div>
      ${raw ? `<div class="card-sub ${KIND_CLASS[a.kind] || ''}">${esc(raw)}</div>` : ''}
      ${proj ? `<div class="card-proj">${esc(a.role)} · ${esc(proj)}</div>` : ''}
    </div>
  </div>`;
}

function profile(a: Agent | undefined, s: State) {
  const back = '<button class="profile-back" data-profile-back>← 返回工作台</button>';
  if (!a) return `${back}<div class="empty">这位员工已下班，返回工作台查看其他同事。</div>`;
  const p = a.profile;
  const pending = s.pending.filter((item) => item.agentId === a.id);
  const recent = p?.recent || [];
  const project = RECORD ? '录屏模式已隐藏' : projectOf(a) || '待分配';
  return `${back}
    <article class="employee-badge" aria-label="${esc(a.name)}的员工档案">
      <div class="badge-clip" aria-hidden="true"></div>
      <div class="badge-heading"><span>MELON OFFICE</span><b>员工档案</b></div>
      <div class="badge-identity">${avatar(a)}<div class="badge-identity-text"><h2>${esc(a.name)}</h2>
        <div class="badge-role">${esc([a.role, a.level].filter(Boolean).join(' · '))}</div>
        <span class="badge-provider">${esc(p?.source || (a.sessionId ? 'Claude Code' : '待分配'))}</span><div class="badge-department">AI 事业部</div>
      </div></div>
      <div class="badge-status ${a.status === 'waiting' ? 'needs-attention' : ''}"><i></i>${esc(p?.status || '在岗')}</div>
      <dl class="badge-facts"><div class="badge-project"><dt>当前项目</dt><dd>${esc(project)}</dd></div>
        <div><dt>本次在岗</dt><dd>${esc(p?.tenure || '—')}</dd></div><div><dt>工具调用</dt><dd>${a.toolCalls} 次</dd></div></dl>
      <div class="badge-task"><b>⌘ 正在做什么</b><p>${esc(lineOf(a))}</p>${rawOf(a.raw) ? `<code>${esc(rawOf(a.raw))}</code>` : ''}</div>
      <div class="badge-foot"><span>${esc(p?.employment || '员工')} · ${esc(s.settings.officeName)}</span><i aria-hidden="true"></i></div>
    </article>
    ${pending.map((item) => `<div class="card ask"><div class="card-body"><b>待你审批</b><div class="profile-ask">${esc(askOf(item))}</div>${item.holding ? `<div class="btns"><button class="ok" data-decide="allow" data-id="${esc(item.id)}">同意</button><button class="no" data-decide="deny" data-id="${esc(item.id)}">驳回</button></div>` : '<div class="muted">请在终端里确认</div>'}</div></div>`).join('')}
    <h3 class="profile-recent-title">最近动态</h3>
    ${RECORD ? '<div class="empty">录屏模式：已隐藏项目、命令和历史动态</div>' : recent.length ? `<ol class="profile-timeline">${recent.map((item) => `<li><time>${esc(since(item.t, s.now))}</time><span>${esc(item.text)}${item.raw ? `<code>${esc(item.raw)}</code>` : ''}</span></li>`).join('')}</ol>` : '<div class="empty">还没有工作动态，等待新任务。</div>'}`;
}

export function mountPanel(el: HTMLElement) {
  let reportOpen = false;
  let reportFile = '';
  let reportError = '';
  let last: State | undefined;
  let selected: string | null = null;

  // the head and the settings form stay put; only the body below them is re-rendered,
  // so typing in the form isn't wiped by state updates
  el.innerHTML = `
    <div class="panel-head">
      <div class="panel-title">OA 工作台</div>
      <div class="head-right">
        <label class="switch" title="开启后，工区里可以直接同意/驳回 Claude 的权限请求">
          <input id="approvals" type="checkbox" checked>
          <span>在工区审批</span>
        </label>
        <button class="gear" data-settings title="设置" aria-label="设置">⚙</button>
      </div>
    </div>
    <form class="settings" hidden>
      <label>工区名称<input name="officeName" maxlength="40" placeholder="甜瓜科技 · AI 事业部"></label>
      <label>日报保存目录<input name="reportDir" placeholder="~/Documents/Melon Office 日报"></label>
      <div class="settings-foot"><span class="muted" data-settings-note>保存在 ~/.config/melon-office/settings.json</span><button type="submit">保存</button></div>
    </form>
    <div class="panel-body"></div>`;
  const approvalsBox = el.querySelector<HTMLInputElement>('#approvals')!;
  const form = el.querySelector<HTMLFormElement>('.settings')!;
  const body = el.querySelector<HTMLElement>('.panel-body')!;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const field = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    const data = { officeName: field('officeName'), reportDir: field('reportDir') };
    const note = form.querySelector<HTMLElement>('[data-settings-note]')!;
    try {
      await net.api('/api/settings', data);
      note.textContent = '已保存';
      setTimeout(() => { form.hidden = true; }, 600);
    } catch {
      note.textContent = '保存失败，工区服务连上了吗？';
    }
  });

  async function makeReport() {
    try {
      const r = await net.api<{ file: string }>('/api/report');
      reportFile = r.file;
      reportError = '';
    } catch {
      reportError = 'HTML 没存上，检查一下日报保存目录';
    }
    reportOpen = true;
    if (last) render(last);
  }

  let lastHtml = '';
  // pointerdown, not click: the panel re-renders often and a click can land on a replaced button
  el.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement;
    const btn = t.closest<HTMLElement>('[data-decide]');
    if (btn) {
      net.decide(btn.dataset.id!, btn.dataset.decide as 'allow' | 'deny');
      btn.closest('.card')?.classList.add('done');
      return;
    }
    const employee = t.closest<HTMLElement>('[data-employee]');
    if (employee) { selectEmployee(employee.dataset.employee!); return; }
    if (t.closest('[data-profile-back]')) { selectEmployee(null); return; }
    if (t.closest('[data-report]')) makeReport();
    if (t.closest('[data-open-report]')) net.api('/api/report/open').catch(() => {});
    if (t.closest('[data-copy]')) {
      const text = el.querySelector('.report-text')?.textContent || '';
      navigator.clipboard?.writeText(`${text}\n— ${last?.settings.officeName ?? ''} · 来自 Melon Office`);
      (t.closest('[data-copy]') as HTMLElement).textContent = '已复制';
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as HTMLElement;
    if (t.matches('[data-employee]')) { e.preventDefault(); selectEmployee(t.dataset.employee!); }
    if (t.matches('[data-profile-back]')) { e.preventDefault(); selectEmployee(null); }
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-settings]')) {
      form.hidden = !form.hidden;
      if (!form.hidden && last) {
        (form.elements.namedItem('officeName') as HTMLInputElement).value = last.settings.officeName;
        (form.elements.namedItem('reportDir') as HTMLInputElement).value = last.settings.reportDir;
        form.querySelector<HTMLElement>('[data-settings-note]')!.textContent = '保存在 ~/.config/melon-office/settings.json';
      }
    }
  });
  el.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'approvals') net.setApprovals(t.checked);
  });

  function render(s: State) {
    last = s;
    const now = s.now;
    const live = s.agents.filter((a) => a.status !== 'gone');
    const byId = new Map(live.map((a) => [a.id, a]));
    const waiting = s.pending.map((p) => ({ p, a: byId.get(p.agentId) })).filter((x) => x.a) as { p: State['pending'][0]; a: Agent }[];
    const waitingIds = new Set(waiting.map((x) => x.a.id));
    const busy = live.filter((a) => !waitingIds.has(a.id) && (a.status === 'working' || a.status === 'thinking' || a.status === 'waiting'));
    const chill = live.filter((a) => a.status === 'idle' || a.status === 'leaving');
    const slacking = live.filter((a) => a.status === 'slacking');

    approvalsBox.checked = s.approvals.enabled;

    const employee = selected ? byId.get(selected) : undefined;
    const html = selected ? profile(employee, s) : `
      <div class="section warn">待我审批 · ${waiting.length}</div>
      ${waiting.length ? waiting.map(({ p, a }) => `
        <div class="card ask" data-employee="${esc(a.id)}">
          ${avatar(a)}
          <div class="card-body">
            <div class="card-top"><button class="employee-name" data-employee="${esc(a.id)}">${esc(a.name)}</button></div>
            <div class="card-line">想要：${esc(askOf(p))}</div>
            ${p.holding
              ? `<div class="btns"><button class="ok" data-decide="allow" data-id="${p.id}">同意</button><button class="no" data-decide="deny" data-id="${p.id}">驳回</button></div>`
              : `<div class="card-sub muted">请在终端里确认</div>`}
          </div>
        </div>`).join('') : '<div class="empty">暂无审批，老板可以喝口茶</div>'}

      <div class="section ok">加班中 · ${busy.length}</div>
      ${busy.map((a) => card(a, now, a.toolCalls ? `${a.toolCalls} 次调用` : '', esc(lineOf(a)))).join('') || '<div class="empty">工位空空，AI 们都在摸鱼</div>'}

      <div class="section">茶水间 · ${chill.length}</div>
      ${chill.map((a) => card(a, now, a.status === 'leaving' ? '下班了' : '等验收', esc(lineOf(a)), 'dim')).join('')}

      ${slacking.length ? `<div class="section">摸鱼中 · ${slacking.length}</div>` : ''}
      ${slacking.map((a) => card(a, now, ACTIVITY[a.activity || ''] || '摸鱼中', esc(lineOf(a)), 'dim')).join('')}

      <div class="report">
        <div class="report-head"><b>瓜老板的日报</b><span class="muted">自动生成</span></div>
        ${reportOpen
          ? `<div class="report-text">${esc(s.reportText)}</div>
             ${reportFile ? `<div class="report-file" title="${esc(reportFile)}">已保存：${esc(reportFile)}</div>` : ''}
             ${reportError ? `<div class="report-file warn">${esc(reportError)}</div>` : ''}
             <div class="report-foot"><span class="muted">${esc(s.settings.officeName)}</span>
               <span class="btns">${reportFile ? '<button data-open-report>打开</button>' : ''}<button data-report>更新</button><button data-copy>复制</button></span></div>`
          : `<div class="report-foot"><span class="muted">今日交付 ${s.stats.delivered} 项 · 工具调用 ${s.stats.toolCalls} 次</span><button data-report>生成日报</button></div>`}
      </div>
      ${RECORD ? '<div class="rec-note">录屏模式：已隐藏文件名和命令</div>' : ''}
    `;
    if (html === lastHtml) return;
    lastHtml = html;
    body.innerHTML = html;
  }

  onEmployeeSelected((id) => {
    selected = id;
    if (last) render(last);
    el.scrollTop = 0;
    if (id) body.querySelector<HTMLElement>('[data-profile-back]')?.focus();
  });
  net.on(render);
}
