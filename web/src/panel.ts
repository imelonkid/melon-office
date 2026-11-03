// The OA 工作台 on the right: approvals, who is working, who is slacking, and the auto daily report.
import type { Agent, State } from './types';
import { net } from './net';
import { RECORD, askOf, dailyReport, lineOf, projectOf, rawOf, since } from './copy';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const KIND_CLASS: Record<string, string> = { edit: 'k-edit', read: 'k-read', search: 'k-read', bash: 'k-bash', web: 'k-web', fail: 'k-fail' };

function avatar(a: Agent) {
  return `<div class="avatar" style="background-image:url(assets/chars/${a.cast}.png)"></div>`;
}

function card(a: Agent, now: number, right: string, sub: string, cls = '') {
  const proj = projectOf(a);
  const raw = rawOf(a.raw);
  return `<div class="card ${cls}">
    ${avatar(a)}
    <div class="card-body">
      <div class="card-top"><b>${esc(a.isSub ? `${a.name}·实习` : a.name)}</b><span class="muted">${esc(right || since(a.startedAt, now))}</span></div>
      <div class="card-line">${sub}</div>
      ${raw ? `<div class="card-sub ${KIND_CLASS[a.kind] || ''}">${esc(raw)}</div>` : ''}
      ${proj ? `<div class="card-proj">${esc(a.role)} · ${esc(proj)}</div>` : ''}
    </div>
  </div>`;
}

export function mountPanel(el: HTMLElement) {
  let reportOpen = false;
  let last: State | undefined;

  let lastHtml = '';
  // pointerdown, not click: the panel re-renders often and a click can land on a replaced button
  el.addEventListener('pointerdown', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-decide]');
    if (!btn) return;
    net.decide(btn.dataset.id!, btn.dataset.decide as 'allow' | 'deny');
    btn.closest('.card')?.classList.add('done');
  });
  el.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-report]')) { reportOpen = true; if (last) render(last); }
    if (t.closest('[data-copy]')) {
      const text = el.querySelector('.report-text')?.textContent || '';
      navigator.clipboard?.writeText(text + '\n— 来自 Melon Office @melonkid');
      (t.closest('[data-copy]') as HTMLElement).textContent = '已复制';
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

    const html = `
      <div class="panel-head">
        <div class="panel-title">OA 工作台</div>
        <label class="switch" title="开启后，工区里可以直接同意/驳回 Claude 的权限请求">
          <input id="approvals" type="checkbox" ${s.approvals.enabled ? 'checked' : ''}>
          <span>在工区审批</span>
        </label>
      </div>

      <div class="section warn">待我审批 · ${waiting.length}</div>
      ${waiting.length ? waiting.map(({ p, a }) => `
        <div class="card ask">
          ${avatar(a)}
          <div class="card-body">
            <div class="card-top"><b>${esc(a.name)}</b></div>
            <div class="card-line">想要：${esc(askOf(p))}</div>
            ${p.holding
              ? `<div class="btns"><button class="ok" data-decide="allow" data-id="${p.id}">同意</button><button class="no" data-decide="deny" data-id="${p.id}">驳回</button></div>`
              : `<div class="card-sub muted">请在终端里确认</div>`}
          </div>
        </div>`).join('') : '<div class="empty">暂无审批，老板可以喝口茶</div>'}

      <div class="section ok">加班中 · ${busy.length}</div>
      ${busy.map((a) => card(a, now, a.toolCalls ? `${a.toolCalls} 次调用` : '', esc(lineOf(a)))).join('') || '<div class="empty">工位空空，AI 们都在摸鱼</div>'}

      <div class="section">茶水间 · ${chill.length}</div>
      ${chill.map((a) => card(a, now, a.status === 'leaving' ? '下班了' : '摸鱼中', esc(lineOf(a)), 'dim')).join('')}

      <div class="report">
        <div class="report-head"><b>瓜老板的日报</b><span class="muted">自动生成</span></div>
        ${reportOpen
          ? `<div class="report-text">${esc(dailyReport(s.stats, live.length))}</div>
             <div class="report-foot"><span class="muted">@melonkid · 甜瓜科技</span><button data-copy>复制分享</button></div>`
          : `<div class="report-foot"><span class="muted">今日交付 ${s.stats.delivered} 项 · 工具调用 ${s.stats.toolCalls} 次</span><button data-report>生成日报</button></div>`}
      </div>
      ${RECORD ? '<div class="rec-note">录屏模式：已隐藏文件名和命令</div>' : ''}
    `;
    if (html === lastHtml) return;
    lastHtml = html;
    el.innerHTML = html;
  }

  net.on(render);
}
