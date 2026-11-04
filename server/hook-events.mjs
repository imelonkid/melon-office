// HTTP boundary shared by Node and JavaScriptCore. Provider identity comes from the route, not the payload.
export function hookEvent(value, provider, expectedEvent) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || typeof value.session_id !== 'string' || !value.session_id
      || typeof value.hook_event_name !== 'string' || !value.hook_event_name) {
    throw new Error('hook requires session_id and hook_event_name');
  }
  if (expectedEvent && value.hook_event_name !== expectedEvent) throw new Error(`expected ${expectedEvent} hook`);
  for (const key of ['agent_id', 'cwd', 'tool_name']) {
    if (value[key] != null && typeof value[key] !== 'string') throw new Error(`hook ${key} must be a string`);
  }
  return { ...value, provider };
}
