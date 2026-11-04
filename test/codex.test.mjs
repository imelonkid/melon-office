import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';
import { install, uninstall, check, repair, settingsPath, CODEX_EVENTS } from '../server/hooks-config.mjs';
import { hookEvent } from '../server/hook-events.mjs';
import { Office, classify, humanize } from '../server/office.mjs';
import { startServer } from '../server/index.mjs';

let home;
beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'melon-codex-test-'));
  process.env.HOME = home;
});
afterEach(() => fs.rmSync(home, { recursive: true, force: true }));
const options = { provider: 'codex' };
const read = () => JSON.parse(fs.readFileSync(settingsPath(options), 'utf8'));
const event = (provider, hook_event_name, extra = {}) => hookEvent({ session_id: 'same-session', cwd: '/work/project', hook_event_name, ...extra }, provider);

test('Codex install preserves other hooks, model/auth config and Claude connection; uninstall is independent', () => {
  install();
  const claude = fs.readFileSync(settingsPath(), 'utf8');
  const dir = path.join(home, '.codex');
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'config.toml'), 'model = "test-model"\n');
  fs.writeFileSync(path.join(dir, 'auth.json'), '{"fixture":true}');
  const original = { description: 'My hooks', hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] } };
  fs.writeFileSync(settingsPath(options), JSON.stringify(original));
  const first = install(options);
  const installed = read();
  install(options);
  assert.deepEqual(read(), installed);
  assert.deepEqual(JSON.parse(fs.readFileSync(first.backup)), original);
  assert.equal(check(options).state, 'current');
  assert.deepEqual(read().hooks.Stop[0], original.hooks.Stop[0]);
  assert.ok(CODEX_EVENTS.every((name) => read().hooks[name]));
  assert.equal(read().hooks.SessionEnd[0].hooks[0].async, false);
  assert.equal(read().hooks.SessionEnd[0].hooks[0].timeout, 3);
  assert.equal(read().hooks.PermissionRequest[0].hooks[0].type, 'command');
  assert.equal(read().hooks.PermissionRequest[0].hooks[0].async, false);
  assert.ok(!read().hooks.Notification && !read().hooks.PostToolUseFailure);
  uninstall(options);
  assert.deepEqual(read(), original);
  assert.equal(check(options).state, 'none');
  assert.equal(fs.readFileSync(settingsPath(), 'utf8'), claude);
  assert.equal(fs.readFileSync(path.join(dir, 'config.toml'), 'utf8'), 'model = "test-model"\n');
  assert.equal(fs.readFileSync(path.join(dir, 'auth.json'), 'utf8'), '{"fixture":true}');
});

test('Codex port repair retains terminal-only approvals and never enables an absent connection', () => {
  assert.equal(repair(options).repaired, false);
  assert.equal(fs.existsSync(settingsPath(options)), false);
  install({ ...options, approvals: false, port: 8123 });
  assert.equal(check({ ...options, port: 8123 }).approvals, false);
  assert.equal(check(options).state, 'stale');
  assert.equal(repair(options).repaired, true);
  assert.equal(check(options).approvals, false);
  assert.match(read().hooks.PermissionRequest[0].hooks[0].command, /\/hook\/codex >/);
});

test('Codex supports a custom home; malformed config is never overwritten', () => {
  const codexHome = path.join(home, 'custom-codex');
  install({ ...options, codexHome });
  assert.equal(settingsPath({ ...options, codexHome }), path.join(codexHome, 'hooks.json'));
  assert.equal(check({ ...options, codexHome }).state, 'current');
  for (const raw of ['{broken', '[]', '{"hooks":[]}']) {
    fs.writeFileSync(path.join(codexHome, 'hooks.json'), raw);
    assert.equal(check({ ...options, codexHome }).state, 'unreadable');
    assert.equal(repair({ ...options, codexHome }).repaired, false);
    assert.throws(() => install({ ...options, codexHome }));
    assert.equal(fs.readFileSync(path.join(codexHome, 'hooks.json'), 'utf8'), raw);
  }
});

test('CLI uses CODEX_HOME and never silently treats an unknown provider as Claude', () => {
  const codexHome = path.join(home, 'cli-codex');
  const run = (args) => spawnSync(process.execPath, ['bin/melon-office.mjs', ...args], { encoding: 'utf8', env: { ...process.env, CODEX_HOME: codexHome } });
  const installed = run(['init', '--provider', 'codex', '--no-approvals']);
  assert.equal(installed.status, 0, installed.stderr);
  assert.match(installed.stdout, /信任/);
  assert.equal(fs.existsSync(path.join(codexHome, 'hooks.json')), true);
  assert.equal(fs.existsSync(settingsPath()), false);
  assert.notEqual(run(['init', '--provider', 'typo']).status, 0);
  assert.notEqual(run(['init', '--provider']).status, 0);
  assert.equal(fs.existsSync(settingsPath()), false);
  assert.equal(run(['uninstall', '--provider', 'codex']).status, 0);
  assert.equal(check({ ...options, codexHome }).state, 'none');
});

test('HTTP hook boundary rejects malformed identities and assigns source from its route', () => {
  for (const value of [null, [], {}, { session_id: 1, hook_event_name: 'Stop' }, { session_id: 'x', hook_event_name: 'Stop', agent_id: {} }]) {
    assert.throws(() => hookEvent(value, 'codex'));
  }
  assert.equal(hookEvent({ session_id: 'x', hook_event_name: 'Stop', provider: 'claude' }, 'codex').provider, 'codex');
  assert.throws(() => hookEvent({ session_id: 'x', hook_event_name: 'Stop' }, 'codex', 'PermissionRequest'));
});

test('Codex --project changes only the selected project hooks file', () => {
  const cli = path.resolve('bin/melon-office.mjs');
  const result = spawnSync(process.execPath, [cli, 'init', '--provider', 'codex', '--project'], {
    cwd: home, env: { ...process.env, CODEX_HOME: path.join(home, 'global-codex') }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(fs.readFileSync(path.join(home, '.codex/hooks.json'))).hooks.SessionStart);
  assert.equal(fs.existsSync(path.join(home, 'global-codex')), false);
  assert.equal(fs.existsSync(path.join(home, '.claude')), false);
});

test('same project/session IDs get separate employees, interns and independent session endings', () => {
  const office = new Office({ staff: 2, remember: false });
  try {
    for (const source of ['claude', 'codex']) office.handle(event(source, 'SessionStart'));
    const roots = office.snapshot().agents.filter((a) => a.sessionId);
    assert.equal(roots.length, 2);
    assert.equal(new Set(roots.map((a) => a.name)).size, 2);
    assert.deepEqual(roots.map((a) => a.profile.source), ['Claude Code', 'Codex']);
    assert.ok(roots.every((a) => !/Claude|Codex/.test(a.name)));
    for (const source of ['claude', 'codex']) office.handle(event(source, 'SubagentStart', { agent_id: 'same-child' }));
    const interns = office.snapshot().agents.filter((a) => a.isSub);
    assert.equal(interns.length, 2);
    for (const a of interns) assert.equal(a.parentName, roots.find((r) => r.provider === a.provider).name);
    office.handle(event('codex', 'SessionEnd'));
    const remaining = office.snapshot().agents.filter((a) => a.sessionId && a.status !== 'leaving');
    assert.equal(remaining.length, 2);
    assert.ok(remaining.every((a) => a.provider === 'claude'));
    assert.equal(office.memory.forSession('same-session'), roots[0].cast);
  } finally { office.dispose(); }
});

test('approval decisions, interrupts and timeout fallback remain isolated between providers', async () => {
  const office = new Office({ staff: 2, remember: false });
  try {
    const promises = ['claude', 'codex'].map((source) => office.requestPermission(event(source, 'PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'npm test' } }), { hold: true }));
    const requests = [...office.pending.values()];
    assert.notEqual(requests[0].agentId, requests[1].agentId);
    office.decide(requests[1].id, 'deny');
    assert.equal(await promises[1], 'deny');
    assert.equal(office.pending.has(requests[0].id), true);
    office.decide(requests[0].id, 'allow');
    assert.equal(await promises[0], 'allow');
    office.handle(event('codex', 'Interrupt'));
    assert.equal(office.stats.delivered, 0);
    assert.equal(office.snapshot().agents.find((a) => a.provider === 'claude').status, 'working');
    office.handle(event('codex', 'Stop'));
    assert.equal(office.stats.delivered, 1);
    assert.equal(await office.requestPermission(event('codex', 'PermissionRequest', { tool_name: 'Bash' }), { hold: true, timeoutMs: 1 }), null);
  } finally { office.dispose(); }
});

test('Codex patches use the existing edit activity and keep raw patch bodies out of badges', () => {
  const input = { command: '*** Begin Patch\n*** Update File: src/login.ts\n@@\n+fixture\n*** End Patch' };
  assert.equal(classify('apply_patch'), 'edit');
  const h = humanize('apply_patch', input);
  assert.match(h.text, /login.ts/);
  assert.equal(h.raw.includes('fixture'), false);
  assert.equal(h.gist.includes('login.ts'), false);
});

function executeHook(command, input) {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command]);
    let out = '', err = '';
    child.stdout.on('data', (x) => out += x);
    child.stderr.on('data', (x) => err += x);
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(out) : reject(new Error(`hook exited ${code}: ${err}`)));
    child.stdin.end(JSON.stringify(input));
  });
}

test('generated Codex commands deliver real HTTP events, return approvals, and fail open when closed', async () => {
  const { server, office } = await startServer({ port: 0, staff: 2 });
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const post = (url, body) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await once(ws, 'open');
  install({ ...options, port });
  const command = (name) => read().hooks[name][0].hooks[0].command;
  const data = (name, extra = {}) => ({ session_id: 'same-session', cwd: '/work/project', hook_event_name: name, ...extra });
  const start = command('SessionStart'), permission = command('PermissionRequest');
  try {
    assert.equal((await post('/hook', data('SessionStart'))).status, 200);
    assert.deepEqual(JSON.parse(await executeHook(start, data('SessionStart'))), {});
    assert.equal(office.snapshot().agents.filter((a) => a.sessionId).length, 2);
    const changed = once(office, 'change');
    const reply = executeHook(permission, data('PermissionRequest', { tool_name: 'Bash', tool_input: { command: 'npm test' } }));
    await changed;
    const request = [...office.pending.values()][0];
    assert.equal(office.agents.get(request.agentId).provider, 'codex');
    assert.equal((await post('/api/decision', { id: request.id, behavior: 'allow' })).status, 200);
    assert.equal(JSON.parse(await reply).hookSpecificOutput.decision.behavior, 'allow');
    assert.equal((await post('/hook/codex', {})).status, 400);
    assert.equal((await post('/hook/codex/permission', data('Stop'))).status, 400);
    assert.equal(office.pending.size, 0);
    await executeHook(command('SessionEnd'), data('SessionEnd'));
    assert.equal(office.snapshot().agents.find((a) => a.provider === 'claude').status, 'thinking');
    assert.equal(office.snapshot().agents.filter((a) => a.provider === 'codex' && a.sessionId).length, 0);
    const closed = once(ws, 'close'); ws.close(); await closed;
    const fallback = JSON.parse(await executeHook(permission, data('PermissionRequest', { tool_name: 'Bash' })));
    assert.deepEqual(fallback, {});
  } finally {
    ws.terminate();
    office.dispose();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  assert.deepEqual(JSON.parse(await executeHook(start, data('SessionStart'))), {});
  assert.deepEqual(JSON.parse(await executeHook(permission, data('PermissionRequest'))), {});
});
