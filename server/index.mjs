// Local bridge: Claude Code hooks  ->  this server  ->  WebSocket  ->  the office in your browser.
// Binds to 127.0.0.1 only: hook payloads contain your code, commands and file paths.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';
import { Office } from './office.mjs';
import { hookEvent } from './hook-events.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(here, '..', 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

// Only pages served from this machine may drive the office (approve/deny).
function localOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try {
    const h = new URL(o).hostname;
    return h === '127.0.0.1' || h === 'localhost';
  } catch { return false; }
}

function openFile(file) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
  spawn(opener, [file], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
}

function serveStatic(req, res) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<meta charset="utf-8"><body style="font:16px system-ui;padding:40px;background:#15132b;color:#eee">' +
      '<h2>Melon Office 服务已启动</h2><p>前端还没构建：运行 <code>npm run build</code>，或开发时用 <code>npm run dev</code> 后打开 Vite 地址。</p></body>');
    return;
  }
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(DIST, urlPath);
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

export async function startServer({ port = 7777, host = '127.0.0.1', demo = false, staff = 3 } = {}) {
  const office = new Office({ staff, remember: !demo });

  const server = http.createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://x');
    try {
      if (req.method === 'POST' && (pathname === '/hook' || pathname === '/hook/codex')) {
        const evt = hookEvent(await readBody(req), pathname === '/hook/codex' ? 'codex' : 'claude');
        if (evt.hook_event_name === 'PermissionRequest') {
          // installed as a passive hook too? just display it
          office.requestPermission(evt, { hold: false });
        } else {
          office.handle(evt);
        }
        return json(res, 200, {});
      }
      if (req.method === 'POST' && (pathname === '/hook/permission' || pathname === '/hook/codex/permission')) {
        const evt = hookEvent(await readBody(req), pathname === '/hook/codex/permission' ? 'codex' : 'claude', 'PermissionRequest');
        const decision = await office.requestPermission(evt, { hold: office.canHold() });
        if (!decision) return json(res, 200, {});
        return json(res, 200, { hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: decision } } });
      }
      if (pathname.startsWith('/api/')) {
        if (!localOrigin(req)) return json(res, 403, { error: 'forbidden' });
        if (req.method === 'GET' && pathname === '/api/state') return json(res, 200, office.snapshot());
        if (req.method === 'POST' && pathname === '/api/decision') {
          const { id, behavior } = await readBody(req);
          return json(res, 200, { ok: office.decide(id, behavior) });
        }
        if (req.method === 'POST' && pathname === '/api/approvals') {
          const { enabled } = await readBody(req);
          office.approvals.enabled = Boolean(enabled);
          office.changed();
          return json(res, 200, { ok: true });
        }
        if (req.method === 'POST' && pathname === '/api/settings') {
          const { officeName, reportDir } = await readBody(req);
          return json(res, 200, { ok: true, settings: office.setSettings({ officeName, reportDir }) });
        }
        if (req.method === 'POST' && pathname === '/api/report') {
          return json(res, 200, { ok: true, file: office.saveReport() });
        }
        // opens the last saved report in the default browser (never an arbitrary path from the page)
        if (req.method === 'POST' && pathname === '/api/report/open') {
          if (!office.lastReport) return json(res, 404, { error: 'no report yet' });
          openFile(office.lastReport);
          return json(res, 200, { ok: true });
        }
        return json(res, 404, { error: 'not found' });
      }
      if (req.method === 'GET') return serveStatic(req, res);
      res.writeHead(405); res.end();
    } catch (err) {
      json(res, 400, { error: String(err.message || err) });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/ws' || !localOrigin(req)) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  const countClients = () => { office.approvals.clients = wss.clients.size; };
  const send = (ws) => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'state', state: office.snapshot() }));

  wss.on('connection', (ws) => {
    countClients();
    office.changed();
    send(ws);
    ws.on('message', (buf) => {
      let msg;
      try { msg = JSON.parse(String(buf)); } catch { return; }
      if (msg.type === 'decision') office.decide(msg.id, msg.behavior);
      if (msg.type === 'approvals') { office.approvals.enabled = Boolean(msg.enabled); office.changed(); }
    });
    ws.on('close', () => { countClients(); office.changed(); });
  });

  let queued = false;
  office.on('change', () => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      for (const ws of wss.clients) send(ws);
    }, 40);
  });
  // keep "x 分钟" style timers fresh even when nothing happens
  setInterval(() => office.changed(), 15000).unref();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });

  if (demo) {
    const { runDemo } = await import('./demo.mjs');
    runDemo(office);
  }
  return { server, office, url: `http://${host}:${port}` };
}
