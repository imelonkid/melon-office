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

// Our hooks as they are in the file, grouped by event (other people's hooks are left out).
function ours(settings) {
  const found = {};
  for (const [ev, groups] of Object.entries(settings.hooks || {})) {
    if (!Array.isArray(groups)) continue;
    const list = groups.flatMap((g) => (g.hooks || []).filter(isOurs));
    if (list.length) found[ev] = list;
  }
  return found;
}

// What install() would write for this port, grouped like ours().
function expected(port, approvals) {
  const want = {};
  for (const ev of PASSIVE_EVENTS) want[ev] = [passiveHook(port)];
  if (approvals) want.PermissionRequest = [permissionHook(port)];
  return want;
}

const sameHooks = (a, b) => {
  const norm = (o) => JSON.stringify(Object.keys(o).sort().map((ev) => [ev, o[ev]]));
  return norm(a) === norm(b);
};

// Is Melon Office connected, and is it connected the way this version would do it?
//   none:       none of our hooks (never installed, or removed)
//   current:    exactly what install() writes for this port
//   stale:      ours are there but differ (older version, missing events, other port, duplicates)
//   unreadable: settings.json is not valid JSON; leave it for the user to fix
// `approvals` is whether our PermissionRequest hook is there, so a repair keeps `--no-approvals`.
export function check({ port = 7777, project = false } = {}) {
  const file = settingsPath({ project });
  let settings;
  try {
    settings = read(file);
  } catch {
    return { file, state: 'unreadable', approvals: false };
  }
  const found = ours(settings);
  if (Object.keys(found).length === 0) return { file, state: 'none', approvals: false };
  const approvals = Boolean(found.PermissionRequest);
  return { file, state: sameHooks(found, expected(port, approvals)) ? 'current' : 'stale', approvals };
}

// Bring stale hooks up to date; anything else is left as it is. Returns check() plus `repaired`.
export function repair({ port = 7777, project = false } = {}) {
  const before = check({ port, project });
  if (before.state !== 'stale') return { ...before, repaired: false };
  install({ port, project, approvals: before.approvals });
  return { ...check({ port, project }), repaired: true };
}

export function status({ project = false } = {}) {
  const file = settingsPath({ project });
  const settings = read(file);
  const events = Object.entries(settings.hooks || {})
    .filter(([, groups]) => Array.isArray(groups) && groups.some((g) => (g.hooks || []).some(isOurs)))
    .map(([ev]) => ev);
  return { file, events };
}
