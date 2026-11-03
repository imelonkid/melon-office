// Adds / removes Melon Office hooks in a Claude Code settings.json without touching anything else.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PASSIVE_EVENTS = [
  'SessionStart', 'SessionEnd', 'UserPromptSubmit',
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure',
  'Notification', 'Stop', 'SubagentStart', 'SubagentStop', 'PreCompact',
];
const MARKER = 'X-Melon-Office';

export function settingsPath({ project } = {}) {
  return project
    ? path.join(process.cwd(), '.claude', 'settings.local.json')
    : path.join(os.homedir(), '.claude', 'settings.json');
}

const passiveHook = (port) => ({
  type: 'command',
  // fire-and-forget: never slows Claude down, silently does nothing when the office is closed
  command: `curl -s -m 2 -X POST -H 'Content-Type: application/json' -H '${MARKER}: 1' --data-binary @- http://127.0.0.1:${port}/hook >/dev/null 2>&1 || true`,
  async: true,
  timeout: 5,
});
const permissionHook = (port) => ({
  type: 'http',
  url: `http://127.0.0.1:${port}/hook/permission`,
  timeout: 60,
});

const isOurs = (h) =>
  (h?.type === 'command' && typeof h.command === 'string' && h.command.includes(MARKER)) ||
  (h?.type === 'http' && typeof h.url === 'string' && /^http:\/\/127\.0\.0\.1:\d+\/hook\/permission$/.test(h.url));

function read(file) {
  if (!fs.existsSync(file)) return {};
  const raw = fs.readFileSync(file, 'utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

function strip(settings) {
  const hooks = settings.hooks || {};
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    hooks[ev] = hooks[ev]
      .map((group) => ({ ...group, hooks: (group.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((group) => group.hooks.length > 0);
    if (hooks[ev].length === 0) delete hooks[ev];
  }
  if (Object.keys(hooks).length === 0) delete settings.hooks;
  else settings.hooks = hooks;
  return settings;
}

export function install({ port = 7777, project = false, approvals = true } = {}) {
  const file = settingsPath({ project });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backup = file + '.melon-office.bak';
  if (fs.existsSync(file) && !fs.existsSync(backup)) fs.copyFileSync(file, backup);

  const settings = strip(read(file));
  settings.hooks = settings.hooks || {};
  for (const ev of PASSIVE_EVENTS) {
    (settings.hooks[ev] = settings.hooks[ev] || []).push({ hooks: [passiveHook(port)] });
  }
  if (approvals) {
    (settings.hooks.PermissionRequest = settings.hooks.PermissionRequest || []).push({ hooks: [permissionHook(port)] });
  }
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { file, backup: fs.existsSync(backup) ? backup : null };
}

export function uninstall({ project = false } = {}) {
  const file = settingsPath({ project });
  if (!fs.existsSync(file)) return { file, changed: false };
  const settings = strip(read(file));
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  return { file, changed: true };
}

export function status({ project = false } = {}) {
  const file = settingsPath({ project });
  const settings = read(file);
  const events = Object.entries(settings.hooks || {})
    .filter(([, groups]) => Array.isArray(groups) && groups.some((g) => (g.hooks || []).some(isOurs)))
    .map(([ev]) => ev);
  return { file, events };
}
