// Shared presentation data for the web and native employee badge. No disk writes.
const STATUS = { thinking: '思考中', working: '在岗 · 工作中', waiting: '等待审批', idle: '等待验收', slacking: '待分配', leaving: '正在下班', gone: '已下班' };
const ACTIVITY = { phone: '刷手机', chat: '聊八卦', cat: '撸猫', coffee: '喝咖啡', fake: '假装很忙' };

export function employeeProfile(agent, feed, now) {
  const assigned = Boolean(agent.sessionId);
  const minutes = Math.max(0, Math.floor((now - agent.startedAt) / 60000));
  return {
    source: assigned ? (agent.provider === 'codex' ? 'Codex' : 'Claude Code') : '待分配',
    status: agent.status === 'slacking' ? `待分配 · ${ACTIVITY[agent.activity] || '休息中'}` : STATUS[agent.status] || '在岗',
    tenure: assigned ? (minutes < 1 ? '不足 1 分钟' : `${minutes} 分钟`) : '尚未接单',
    employment: agent.isSub ? '实习生' : agent.resident ? '常驻员工' : '项目员工',
    recent: feed.filter((item) => item.agentId === agent.id && item.t >= agent.startedAt).slice(0, 3),
  };
}
