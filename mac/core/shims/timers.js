// setTimeout / setInterval on top of the app's run loop (JavaScriptCore has no event loop of its own)
const wrap = (id) => ({ id, unref() { return this; }, ref() { return this; } });
const idOf = (t) => (t && typeof t === 'object' ? t.id : t);
globalThis.setTimeout = (fn, ms = 0, ...args) => wrap(native.setTimer(() => fn(...args), ms, false));
globalThis.setInterval = (fn, ms = 0, ...args) => wrap(native.setTimer(() => fn(...args), ms, true));
globalThis.clearTimeout = (t) => t != null && native.clearTimer(idOf(t));
globalThis.clearInterval = globalThis.clearTimeout;
globalThis.console = { log: (...a) => native.log(a.join(' ')), warn: (...a) => native.log(a.join(' ')), error: (...a) => native.log(a.join(' ')) };
