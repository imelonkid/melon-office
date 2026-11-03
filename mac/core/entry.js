// The office brain for the Mac app. Bundled (see bundle.mjs) into one script that runs inside
// JavaScriptCore, so the native app and the Node server share office.mjs, translate.mjs and hooks-config.mjs.
// `native` is provided by Swift (MelonCore.swift): timers, files, and callbacks back into the app.
import { Office } from '../../server/office.mjs';
import { install, uninstall, status, check, repair } from '../../server/hooks-config.mjs';

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
  hook(json) {
    const evt = JSON.parse(json);
    if (evt.hook_event_name === 'PermissionRequest') office.requestPermission(evt, { hold: false });
    else office.handle(evt);
  },
  // the http PermissionRequest hook: calls native.permissionDone(ticket, 'allow' | 'deny' | '') when settled
  permission(json, ticket) {
    office.requestPermission(JSON.parse(json), { hold: office.canHold() })
      .then((d) => native.permissionDone(ticket, d || ''));
  },
  decide: (id, behavior) => office.decide(id, behavior),
  setApprovals(enabled) { office.approvals.enabled = Boolean(enabled); office.changed(); },
  // open office pages + the app itself when it can show approval notifications
  setClients(n) { clients = n; office.approvals.clients = n; office.changed(); },
  snapshot: () => JSON.stringify(office.snapshot()),
  // settings: { officeName, reportDir } (shared with the CLI version via ~/.config/melon-office/settings.json)
  setSettings: (json) => JSON.stringify(office.setSettings(JSON.parse(json))),
  saveReport: () => office.saveReport(),
  hooksInstall: (port, approvals) => JSON.stringify(install({ port, approvals })),
  hooksUninstall: () => JSON.stringify(uninstall()),
  hooksStatus: () => JSON.stringify(status()),
  // launch-time reconcile: { state: none | current | stale | unreadable, approvals, repaired }
  hooksCheck: (port) => JSON.stringify(check({ port })),
  hooksRepair: (port) => JSON.stringify(repair({ port })),
};

// keep "x 分钟" style timers fresh even when nothing happens
setInterval(() => office?.changed(), 15000);
