// User settings, shared by the CLI office and the Mac app: ~/.config/melon-office/settings.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULTS = {
  officeName: '甜瓜科技 · AI 事业部',            // shown top-left and on the daily report
  reportDir: '~/Documents/Melon Office 日报',     // where 生成日报 saves its HTML
};

export const settingsFile = () => path.join(os.homedir(), '.config', 'melon-office', 'settings.json');

export const expandHome = (p) => (p === '~' || String(p).startsWith('~/') ? path.join(os.homedir(), String(p).slice(2)) : String(p));

export function loadSettings() {
  try {
    const raw = fs.existsSync(settingsFile()) ? JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) : {};
    return clean({ ...DEFAULTS, ...raw });
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  const s = clean(settings);
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2) + '\n');
  return s;
}

// blank or oversized values fall back to the defaults
function clean(s) {
  const name = String(s.officeName ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const dir = String(s.reportDir ?? '').trim();
  return { officeName: name || DEFAULTS.officeName, reportDir: dir || DEFAULTS.reportDir };
}
