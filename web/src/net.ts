import type { State } from './types';

type Listener = (s: State) => void;

class Net {
  private ws?: WebSocket;
  private listeners: Listener[] = [];
  private statusListeners: ((online: boolean) => void)[] = [];
  last?: State;

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => this.statusListeners.forEach((f) => f(true));
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'state') {
          this.last = msg.state;
          this.listeners.forEach((f) => f(msg.state));
        }
      } catch { /* ignore */ }
    };
    ws.onclose = () => {
      this.statusListeners.forEach((f) => f(false));
      setTimeout(() => this.connect(), 1500);
    };
  }

  on(f: Listener) {
    this.listeners.push(f);
    if (this.last) f(this.last);
  }

  onStatus(f: (online: boolean) => void) {
    this.statusListeners.push(f);
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  decide(id: string, behavior: 'allow' | 'deny') {
    this.send({ type: 'decision', id, behavior });
  }

  setApprovals(enabled: boolean) {
    this.send({ type: 'approvals', enabled });
  }
}

export const net = new Net();
