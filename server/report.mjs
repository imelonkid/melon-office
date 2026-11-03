// 瓜老板的日报: the one-paragraph summary shown in the office, and a full HTML page saved to disk.
import fs from 'node:fs';
import path from 'node:path';
import { expandHome } from './settings.mjs';

export function reportText(stats, headcount) {
  const align = Math.max(1, stats.prompts);
  const slack = Math.round((stats.slack || 0) / 60000);
  return `今日带领团队交付 ${stats.delivered} 项，调用工具 ${stats.toolCalls} 次，拉通对齐 ${align} 次，` +
    `过审批 ${stats.approvals} 次，赋能 ${headcount} 位同学` +
    (stats.failures ? `，复盘翻车 ${stats.failures} 次` : '') +
    (slack ? `，团队带薪摸鱼 ${slack} 分钟` : '') +
    (stats.scoldings ? `，开展作风整顿 ${stats.scoldings} 次` : '') +
    '。明日继续抓手落地，打出组合拳。';
}

const pad = (n) => String(n).padStart(2, '0');
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  working: '加班中', thinking: '思考中', waiting: '等审批', idle: '等验收', leaving: '下班了',
  slacking: '摸鱼中',
};
const ACTIVITY = { phone: '刷手机', chat: '聊八卦', cat: '撸猫', coffee: '喝咖啡', fake: '假装很忙' };

/** a self-contained page (no scripts, no external files) that reads well on screen and in print */
export function reportHtml(snap, settings, now = new Date()) {
  const s = snap.stats;
  const people = snap.agents.filter((a) => a.status !== 'gone');
  const stat = (label, value, unit = '') => `<div class="stat"><b>${esc(value)}</b><span>${esc(label)}${unit ? ` · ${esc(unit)}` : ''}</span></div>`;
  const rows = people.map((a) => `
      <tr>
        <td><b>${esc(a.name)}</b><small>${esc(a.role)} · ${esc(a.level)}</small></td>
        <td>${esc(a.status === 'slacking' ? ACTIVITY[a.activity] || STATUS.slacking : STATUS[a.status] || a.status)}</td>
        <td>${esc(a.line)}</td>
        <td class="num">${a.toolCalls}</td>
        <td>${esc(a.project || '—')}</td>
      </tr>`).join('');
  const feed = snap.feed.map((f) => `<li><time>${clock(new Date(f.t))}</time><b>${esc(f.name)}</b>${esc(f.text)}</li>`).join('');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(settings.officeName)} · 瓜老板的日报 · ${day(now)}</title>
<style>
  :root { --ink: #1c1b22; --muted: #77748a; --line: #e7e5ee; --accent: #3f9a3a; --paper: #fdfcf8; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f1f0ec; color: var(--ink); font: 15px/1.7 "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", system-ui, sans-serif; }
  main { max-width: 860px; margin: 40px auto; padding: 48px 56px; background: var(--paper); border-radius: 18px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; border-bottom: 2px solid var(--ink); padding-bottom: 16px; }
  h1 { font-size: 28px; margin: 4px 0 0; letter-spacing: 1px; }
  .org { color: var(--muted); font-size: 14px; }
  .date { text-align: right; color: var(--muted); font-size: 14px; white-space: nowrap; }
  .lead { font-size: 18px; margin: 28px 0; padding: 18px 22px; background: #f2f7ef; border-left: 4px solid var(--accent); border-radius: 0 10px 10px 0; }
  h2 { font-size: 16px; margin: 36px 0 12px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .stat { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; }
  .stat b { display: block; font-size: 26px; font-variant-numeric: tabular-nums; }
  .stat span { color: var(--muted); font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; font-size: 13px; }
  td small { display: block; color: var(--muted); font-size: 12px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  ol { list-style: none; padding: 0; margin: 0; }
  li { padding: 6px 0; border-bottom: 1px dashed var(--line); }
  li time { color: var(--muted); font-variant-numeric: tabular-nums; margin-right: 12px; }
  li b { margin-right: 8px; }
  .empty { color: var(--muted); }
  footer { margin-top: 40px; color: var(--muted); font-size: 12px; text-align: center; }
  @media (max-width: 640px) { main { margin: 0; border-radius: 0; padding: 28px 20px; } header { flex-direction: column; align-items: flex-start; } .date { text-align: left; } }
  @media print { body { background: none; } main { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
<main>
  <header>
    <div>
      <div class="org">${esc(settings.officeName)}</div>
      <h1>瓜老板的日报</h1>
    </div>
    <div class="date">${day(now)}<br>${clock(now)} 生成</div>
  </header>

  <p class="lead">${esc(reportText(s, people.length))}</p>

  <h2>今日数据</h2>
  <div class="stats">
    ${stat('交付', s.delivered, '项')}
    ${stat('工具调用', s.toolCalls, '次')}
    ${stat('拉通对齐', Math.max(1, s.prompts), '次')}
    ${stat('过审批', s.approvals, '次')}
    ${stat('复盘翻车', s.failures, '次')}
    ${stat('带薪摸鱼', Math.round((s.slack || 0) / 60000), '分钟')}
    ${stat('作风整顿', s.scoldings || 0, '次')}
  </div>

  <h2>团队 · ${people.length} 人</h2>
  ${people.length ? `<table>
    <thead><tr><th>员工</th><th>状态</th><th>在干什么</th><th class="num">调用</th><th>项目</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : '<p class="empty">工区空空如也</p>'}

  <h2>最近动态</h2>
  ${feed ? `<ol>${feed}</ol>` : '<p class="empty">今天还没有动静</p>'}

  <footer>由 Melon Office 自动生成 · 统计从工区开工时算起</footer>
</main>
</body>
</html>
`;
}

/** writes <reportDir>/日报-YYYY-MM-DD.html (one file per day, regenerated each time) and returns its path */
export function saveReport(snap, settings, now = new Date()) {
  const dir = expandHome(settings.reportDir);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `日报-${day(now)}.html`);
  fs.writeFileSync(file, reportHtml(snap, settings, now));
  return file;
}
