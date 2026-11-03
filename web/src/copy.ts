// Text shown in the office. Record mode (?record) hides file names, commands and project names
// so a screen recording never leaks what you're working on.
import type { Agent, Stats } from './types';

const params = new URLSearchParams(location.search);
export const RECORD = params.has('record');
export const SHOW_CAPTION = params.get('caption') !== '0';

// the server already translates tool calls into plain Chinese; record mode uses the name-free gist
export function lineOf(a: Agent): string {
  return RECORD ? a.gist || a.line : a.line;
}

export function rawOf(raw: string): string {
  return RECORD ? '' : raw || '';
}

export function askOf(p: { detail: string; gist: string }): string {
  return RECORD ? p.gist || p.detail : p.detail;
}

export function projectOf(a: Agent): string {
  return RECORD ? '' : a.project;
}

export function since(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return '刚刚';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`;
}

export const ACTIVITY: Record<string, string> = { phone: '刷手机', chat: '聊八卦', cat: '撸猫', coffee: '喝咖啡' };

export function dailyReport(stats: Stats, headcount: number): string {
  const align = Math.max(1, stats.prompts);
  const slack = Math.round(stats.slack / 60000);
  return `今日带领团队交付 ${stats.delivered} 项，调用工具 ${stats.toolCalls} 次，拉通对齐 ${align} 次，` +
    `过审批 ${stats.approvals} 次，赋能 ${headcount} 位同学` +
    (stats.failures ? `，复盘翻车 ${stats.failures} 次` : '') +
    (slack ? `，团队带薪摸鱼 ${slack} 分钟` : '') +
    '。明日继续抓手落地，打出组合拳。';
}

export function caption(working: number, slacking = 0): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const h = now.getHours();
  if (h >= 22 || h < 5) return `${hh}:${mm}，打车能报销了，AI 还在卷`;
  if (h >= 21) return `${hh}:${mm}，再坚持一下就能报销打车`;
  if (h >= 12 && h < 14) return `午休时间，${working} 位 AI 同事还在工位上`;
  if (!working && slacking) return `没有需求，${slacking} 位 AI 同事在带薪摸鱼`;
  return `${working} 位 AI 同事正在为你打工`;
}

// minutes until the 22:00 taxi-reimbursement line
export function taxiCountdown(): string | null {
  const now = new Date();
  const line = new Date(now);
  line.setHours(22, 0, 0, 0);
  const diff = line.getTime() - now.getTime();
  if (diff <= 0 || now.getHours() < 5) return null;
  const m = Math.ceil(diff / 60000);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
