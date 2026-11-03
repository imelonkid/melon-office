// hooks-config: adds / removes our hooks in a Claude Code settings.json and leaves everything else alone.
// Every test runs against a throwaway HOME, never the real ~/.claude.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { install, uninstall, status, check, repair, settingsPath, PASSIVE_EVENTS } from '../server/hooks-config.mjs';

let home;
const file = () => path.join(home, '.claude', 'settings.json');
const read = () => JSON.parse(fs.readFileSync(file(), 'utf8'));
const write = (obj) => {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(obj, null, 2));
};

// somebody else's hooks and settings that must survive install / uninstall
const theirs = {
  model: 'opus',
  permissions: { allow: ['Bash(git status)'] },
  hooks: {
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'echo mine' }] }],
    Stop: [{ hooks: [{ type: 'http', url: 'http://127.0.0.1:9000/elsewhere' }] }],
  },
};

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'melon-office-test-'));
  process.env.HOME = home;
});

test('settingsPath points at the temporary HOME', () => {
  assert.equal(settingsPath(), file());
});

test('install into a fresh HOME connects every event', () => {
  const r = install();
  assert.equal(r.file, file());
  assert.equal(r.backup, null);
  const s = read();
  for (const ev of PASSIVE_EVENTS) {
    assert.equal(s.hooks[ev].length, 1, ev);
    const h = s.hooks[ev][0].hooks[0];
    assert.equal(h.type, 'command');
    assert.equal(h.async, true);
    assert.match(h.command, /X-Melon-Office: 1/);
    assert.match(h.command, /http:\/\/127\.0\.0\.1:7777\/hook /);
  }
  assert.deepEqual(s.hooks.PermissionRequest, [
    { hooks: [{ type: 'http', url: 'http://127.0.0.1:7777/hook/permission', timeout: 60 }] },
  ]);
  assert.deepEqual(status().events.sort(), [...PASSIVE_EVENTS, 'PermissionRequest'].sort());
});

test('install keeps other settings and hooks, and backs up the original once', () => {
  write(theirs);
  const original = fs.readFileSync(file(), 'utf8');
  const r = install();
  assert.equal(fs.readFileSync(r.backup, 'utf8'), original);

  const s = read();
  assert.equal(s.model, 'opus');
  assert.deepEqual(s.permissions, theirs.permissions);
  assert.deepEqual(s.hooks.PreToolUse[0], theirs.hooks.PreToolUse[0]);
  assert.deepEqual(s.hooks.Stop[0], theirs.hooks.Stop[0]);
  assert.equal(s.hooks.PreToolUse.length, 2);

  // a second install must not overwrite the backup with our own output
  install();
  assert.equal(fs.readFileSync(r.backup, 'utf8'), original);
});

test('installing twice does not duplicate hooks', () => {
  install();
  const once = read();
  install();
  assert.deepEqual(read(), once);
});

test('port goes into both the passive and the permission hook', () => {
  install({ port: 8123 });
  const s = read();
  assert.match(s.hooks.SessionStart[0].hooks[0].command, /127\.0\.0\.1:8123\/hook /);
  assert.equal(s.hooks.PermissionRequest[0].hooks[0].url, 'http://127.0.0.1:8123/hook/permission');
  // re-installing on another port replaces, not adds
  install({ port: 7777 });
  assert.equal(read().hooks.SessionStart.length, 1);
  assert.match(read().hooks.SessionStart[0].hooks[0].command, /:7777\//);
});

test('approvals: false leaves permission prompts in the terminal', () => {
  install();
  install({ approvals: false });
  const s = read();
  assert.equal(s.hooks.PermissionRequest, undefined);
  assert.ok(!status().events.includes('PermissionRequest'));
  assert.equal(status().events.length, PASSIVE_EVENTS.length);
});

test('uninstall removes only our hooks', () => {
  write(theirs);
  install();
  const r = uninstall();
  assert.equal(r.changed, true);
  assert.deepEqual(read(), theirs);
  assert.deepEqual(status().events, []);
});

test('uninstall drops the hooks key when nothing else is left', () => {
  write({ model: 'opus' });
  install();
  uninstall();
  assert.deepEqual(read(), { model: 'opus' });
});

test('uninstall without a settings file changes nothing', () => {
  assert.deepEqual(uninstall(), { file: file(), changed: false });
  assert.equal(fs.existsSync(file()), false);
});

test('status on a missing or empty file reports nothing connected', () => {
  assert.deepEqual(status().events, []);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), '\n');
  assert.deepEqual(status().events, []);
});

test('--project writes .claude/settings.local.json in the current directory', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'melon-office-repo-'));
  const cwd = process.cwd();
  process.chdir(repo);
  try {
    install({ project: true });
    const local = path.join(fs.realpathSync(repo), '.claude', 'settings.local.json');
    assert.equal(fs.realpathSync(settingsPath({ project: true })), local);
    assert.ok(status({ project: true }).events.includes('SessionStart'));
    assert.equal(fs.existsSync(file()), false, 'user settings untouched');
    uninstall({ project: true });
    assert.deepEqual(status({ project: true }).events, []);
  } finally {
    process.chdir(cwd);
  }
});

// —— check() / repair(): what the Mac app and `melon-office start` run on every launch ——

test('check: nothing installed is none, and repair leaves it alone', () => {
  assert.equal(check().state, 'none');
  write(theirs);
  assert.equal(check().state, 'none');
  const r = repair();
  assert.equal(r.repaired, false);
  assert.deepEqual(read(), theirs);
});

test('check: a fresh install is current, with or without approvals', () => {
  install();
  assert.deepEqual(check(), { file: file(), state: 'current', approvals: true });
  install({ approvals: false });
  assert.deepEqual(check(), { file: file(), state: 'current', approvals: false });
  assert.equal(repair().repaired, false);
});

test('check: hooks for another port are stale, repair moves them and keeps approvals off', () => {
  install({ port: 8123, approvals: false });
  assert.equal(check({ port: 7777 }).state, 'stale');
  const r = repair({ port: 7777 });
  assert.equal(r.repaired, true);
  assert.equal(r.state, 'current');
  assert.equal(r.approvals, false);
  assert.match(read().hooks.Stop[0].hooks[0].command, /:7777\//);
  assert.equal(read().hooks.PermissionRequest, undefined);
});

test('check: an older install missing events or with an old command is stale, repair fixes it', () => {
  write(theirs);
  install();
  const s = read();
  delete s.hooks.PreCompact;                                         // event added in a later version
  s.hooks.SessionStart[0].hooks[0].command = "curl -s -H 'X-Melon-Office: 1' http://127.0.0.1:7777/hook"; // old command
  write(s);
  assert.equal(check().state, 'stale');
  assert.equal(repair().repaired, true);
  assert.equal(check().state, 'current');
  // other people's hooks are still there, once
  assert.deepEqual(read().hooks.PreToolUse.filter((g) => g.matcher === 'Bash'), theirs.hooks.PreToolUse);
  assert.deepEqual(read().hooks.Stop[0], theirs.hooks.Stop[0]);
});

test('check: duplicated hooks are stale, repair leaves one of each', () => {
  install();
  const s = read();
  s.hooks.Stop.push(s.hooks.Stop[0]);
  write(s);
  assert.equal(check().state, 'stale');
  repair();
  assert.equal(read().hooks.Stop.length, 1);
});

test('check: invalid JSON is unreadable and repair never overwrites it', () => {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), '{ "hooks": ');
  assert.equal(check().state, 'unreadable');
  assert.equal(repair().repaired, false);
  assert.equal(fs.readFileSync(file(), 'utf8'), '{ "hooks": ');
});
