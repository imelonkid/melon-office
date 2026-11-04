// The office brain for the Mac app. Bundled (see bundle.mjs) into one script that runs inside
// JavaScriptCore, so the native app and the Node server share office.mjs, translate.mjs and hooks-config.mjs.
// `native` is provided by Swift (MelonCore.swift): timers, files, and callbacks back into the app.
import { Office } from '../../server/office.mjs';
import { install, uninstall, status, check, repair } from '../../server/hooks-config.mjs';
import { hookEvent } from '../../server/hook-events.mjs';

let office;
let clients = 0;
let queued = false;

const emit = () => {
  if (queued) return;
  queued = true;
  setTimeout(() => {
    queued = false;
    native.stateChanged(JSON.stringify(office.snapshot()));
  }, 40);
};

function start(staff) {
  office?.dispose();
  office = new Office({ staff });
  office.approvals.clients = clients;
  office.on('change', emit);
  emit();
}

globalThis.MelonCore = {
  start,
  // passive hook events (a PermissionRequest sent here is only displayed)
  hook(json, provider = 'claude') {
    const evt = hookEvent(JSON.parse(json), provider);
    if (evt.hook_event_name === 'PermissionRequest') office.requestPermission(evt, { hold: false });
    else office.handle(evt);
    return true;
  },
  // the http PermissionRequest hook: calls native.permissionDone(ticket, 'allow' | 'deny' | '') when settled
  permission(json, ticket, provider = 'claude') {
    office.requestPermission(hookEvent(JSON.parse(json), provider, 'PermissionRequest'), { hold: office.canHold() })
      .then((d) => native.permissionDone(ticket, d || ''));
    return true;
  },
  decide: (id, behavior) => office.decide(id, behavior),
  setApprovals(enabled) { office.approvals.enabled = Boolean(enabled); office.changed(); },
  // open office pages + the app itself when it can show approval notifications
  setClients(n) { clients = n; office.approvals.clients = n; office.changed(); },
  snapshot: () => JSON.stringify(office.snapshot()),
  // settings: { officeName, reportDir } (shared with the CLI version via ~/.config/melon-office/settings.json)
  setSettings: (json) => JSON.stringify(office.setSettings(JSON.parse(json))),
  saveReport: () => office.saveReport(),
  hooksInstall: (port, approvals, provider = 'claude', codexHome) => JSON.stringify(install({ port, approvals, provider, codexHome })),
  hooksUninstall: (provider = 'claude', codexHome) => JSON.stringify(uninstall({ provider, codexHome })),
  hooksStatus: (provider = 'claude', codexHome) => JSON.stringify(status({ provider, codexHome })),
  // launch-time reconcile: { state: none | current | stale | unreadable, approvals, repaired }
  hooksCheck: (port, provider = 'claude', codexHome) => JSON.stringify(check({ port, provider, codexHome })),
  hooksRepair: (port, provider = 'claude', codexHome) => JSON.stringify(repair({ port, provider, codexHome })),
};

// keep "x 分钟" style timers fresh even when nothing happens
setInterval(() => office?.changed(), 15000);
