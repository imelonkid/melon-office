// Demo mode: replays a believable day at the office so you can record videos without real work running.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms) => ms * (0.7 + Math.random() * 0.6);

const CWD = '/Users/melonkid/Workspace/melon-shop';

function ev(session_id, hook_event_name, extra = {}) {
  return { session_id, hook_event_name, cwd: CWD, transcript_path: '', permission_mode: 'default', ...extra };
}
const tool = (sid, name, input, extra) => ev(sid, 'PreToolUse', { tool_name: name, tool_input: input, tool_use_id: Math.random().toString(36).slice(2), ...extra });

const SCRIPTS = {
  // 前端：改登录页，中途拉个实习生查资料
  a: [
    ['UserPromptSubmit'],
    ['tool', 'Read', { file_path: 'src/pages/LoginPage.tsx' }],
    ['tool', 'Grep', { pattern: 'useAuth' }],
    ['tool', 'Edit', { file_path: 'src/pages/LoginPage.tsx' }],
    ['sub', [
      ['tool', 'WebSearch', { query: 'OAuth 登录 最佳实践' }],
      ['tool', 'WebFetch', { url: 'https://developer.mozilla.org/docs/Web/Security' }],
      ['tool', 'Read', { file_path: 'docs/auth.md' }],
    ]],
    ['tool', 'Edit', { file_path: 'src/hooks/useAuth.ts' }],
    ['tool', 'Bash', { command: 'npm run test -- login' }],
    ['tool', 'Edit', { file_path: 'src/pages/LoginPage.tsx' }],
    ['Stop'],
  ],
  // 测试：复现 bug，跑挂一次
  b: [
    ['UserPromptSubmit'],
    ['tool', 'Grep', { pattern: 'login' }],
    ['tool', 'Read', { file_path: 'tests/login.spec.ts' }],
    ['tool', 'Bash', { command: 'pnpm vitest run login' }],
    ['fail', 'Bash'],
    ['tool', 'Edit', { file_path: 'tests/login.spec.ts' }],
    ['tool', 'Bash', { command: 'pnpm vitest run login' }],
    ['Stop'],
  ],
  // 文案：写 README，需要审批
  c: [
    ['UserPromptSubmit'],
    ['tool', 'WebSearch', { query: '竞品 落地页 文案' }],
    ['tool', 'Read', { file_path: 'README.md' }],
    ['perm', 'Write', { file_path: 'README.md' }],
    ['tool', 'Write', { file_path: 'README.md' }],
    ['tool', 'TodoWrite', {}],
    ['Stop'],
  ],
  // 运维：上线
  d: [
    ['UserPromptSubmit'],
    ['tool', 'Bash', { command: 'git pull --rebase' }],
    ['tool', 'Bash', { command: 'npm run build' }],
    ['perm', 'Bash', { command: 'npm run deploy --prod' }],
    ['tool', 'Bash', { command: 'npm run deploy --prod' }],
    ['Stop'],
  ],
};

async function play(office, sid, steps, extra = {}) {
  for (const step of steps) {
    const [kind, ...args] = step;
    if (kind === 'tool') {
      office.handle(tool(sid, args[0], args[1], extra));
      await sleep(jitter(3200));
      office.handle(ev(sid, 'PostToolUse', { tool_name: args[0], ...extra }));
    } else if (kind === 'fail') {
      office.handle(ev(sid, 'PostToolUseFailure', { tool_name: args[0], ...extra }));
      await sleep(jitter(2600));
    } else if (kind === 'perm') {
      await office.requestPermission(ev(sid, 'PermissionRequest', { tool_name: args[0], tool_input: args[1], ...extra }), { hold: true, autoAfterMs: 9000 });
      await sleep(800);
    } else if (kind === 'sub') {
      const agent_id = 'sub-' + Math.random().toString(36).slice(2, 7);
      office.handle(tool(sid, 'Task', { description: '调研登录最佳实践', subagent_type: 'general-purpose' }));
      office.handle(ev(sid, 'SubagentStart', { agent_id, agent_type: 'general-purpose' }));
      await sleep(1500);
      await play(office, sid, args[0], { agent_id, agent_type: 'general-purpose' });
      office.handle(ev(sid, 'SubagentStop', { agent_id, agent_type: 'general-purpose' }));
      await sleep(1200);
    } else if (kind === 'Stop') {
      office.handle(ev(sid, 'Stop', extra));
    } else {
      office.handle(ev(sid, kind, extra));
      await sleep(jitter(1800));
    }
  }
}

// a session does its script a few times with coffee breaks, ends, and after a while a new one starts,
// so the video shows people picking up work and going back to 摸鱼
async function employee(office, name, script, startDelay) {
  await sleep(startDelay);
  for (let n = 1; ; n++) {
    const sid = `demo-${name}-${n}`;
    office.handle(ev(sid, 'SessionStart', { source: 'startup' }));
    await sleep(4000);
    do {
      await play(office, sid, script);
      await sleep(jitter(16000)); // coffee break
    } while (Math.random() < 0.5);
    office.handle(ev(sid, 'SessionEnd', { reason: 'other' }));
    await sleep(jitter(30000));
  }
}

export function runDemo(office) {
  console.log('  演示模式：正在回放一天的大厂日常');
  employee(office, 'a', SCRIPTS.a, 3000);
  employee(office, 'b', SCRIPTS.b, 9000);
  employee(office, 'c', SCRIPTS.c, 16000);
  employee(office, 'd', SCRIPTS.d, 24000);
}
