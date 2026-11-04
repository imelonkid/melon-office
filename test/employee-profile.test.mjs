import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeProfile } from '../server/employee-profile.mjs';

const now = 1200000;
const agent = { id: 'staff:tian', name: '小甜', sessionId: 'session-a', startedAt: now - 180000, status: 'working', resident: true };

test('recent activity belongs to the employee and the current assignment only', () => {
  const feed = [
    { agentId: agent.id, t: now, text: '运行测试' },
    { agentId: 'other', t: now, text: '另一个项目的命令' },
    { agentId: agent.id, t: agent.startedAt - 1, text: '上一个会话的活动' },
    ...[1, 2, 3, 4].map((i) => ({ agentId: agent.id, t: now - i, text: `活动${i}` })),
  ];
  const profile = employeeProfile(agent, feed, now);
  assert.deepEqual(profile.recent.map((x) => x.text), ['运行测试', '活动1', '活动2']);
  assert.equal(profile.tenure, '3 分钟');
  assert.equal(profile.source, 'Claude Code');
});

test('unassigned residents do not pretend to have an active source or time on duty', () => {
  const p = employeeProfile({ ...agent, sessionId: null, status: 'slacking', activity: 'coffee' }, [], now);
  assert.equal(p.source, '待分配');
  assert.equal(p.status, '待分配 · 喝咖啡');
  assert.equal(p.tenure, '尚未接单');
  assert.equal(p.employment, '常驻员工');
});

test('waiting, departing and intern states remain distinct', () => {
  assert.equal(employeeProfile({ ...agent, status: 'waiting' }, [], now).status, '等待审批');
  assert.equal(employeeProfile({ ...agent, status: 'leaving' }, [], now).status, '正在下班');
  assert.equal(employeeProfile({ ...agent, isSub: true }, [], now).employment, '实习生');
  assert.equal(employeeProfile({ ...agent, startedAt: now + 1 }, [], now).tenure, '不足 1 分钟');
});
