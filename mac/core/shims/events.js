// the bit of node:events that Office uses
export class EventEmitter {
  constructor() { this._on = new Map(); }
  on(ev, fn) { (this._on.get(ev) || this._on.set(ev, []).get(ev)).push(fn); return this; }
  emit(ev, ...args) { for (const fn of this._on.get(ev) || []) fn(...args); return true; }
  removeAllListeners() { this._on.clear(); return this; }
}
export default { EventEmitter };
