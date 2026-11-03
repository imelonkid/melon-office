// Who worked on what, so a job goes back to the same person: a resumed session to whoever had it,
// a new session in a project to whoever worked there last. Kept on disk so it survives restarts
// (morning in one office run, afternoon in the next): ~/.config/melon-office/memory.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEEP_MS = 7 * 24 * 3600 * 1000;
const MAX = 300; // per map, newest kept

const file = () => path.join(os.homedir(), '.config', 'melon-office', 'memory.json');

export class Memory {
  // persist: false keeps it in memory only (demo mode shouldn't touch the real file)
  constructor({ persist = true } = {}) {
    this.persist = persist;
    this.sessions = {}; // session_id -> { cast, t }
    this.projects = {}; // cwd -> { cast, t }
    if (persist) try {
      if (fs.existsSync(file())) Object.assign(this, pick(JSON.parse(fs.readFileSync(file(), 'utf8'))));
    } catch { /* a broken file just means we start fresh */ }
    this.prune();
  }

  forSession(sid) { return this.sessions[sid]?.cast || null; }
  forProject(cwd) { return (cwd && this.projects[cwd]?.cast) || null; }

  // project: false records the session only, e.g. when someone just helps out while the owner is busy
  remember(sid, cwd, cast, { project = true } = {}) {
    const t = Date.now();
    this.sessions[sid] = { cast, t };
    if (cwd && project) this.projects[cwd] = { cast, t };
    this.prune();
    if (this.persist) try {
      fs.mkdirSync(path.dirname(file()), { recursive: true });
      fs.writeFileSync(file(), JSON.stringify({ sessions: this.sessions, projects: this.projects }) + '\n');
    } catch { /* remembering is best effort */ }
  }

  prune() {
    const cutoff = Date.now() - KEEP_MS;
    for (const map of [this.sessions, this.projects]) {
      const entries = Object.entries(map).filter(([, v]) => v && v.t > cutoff).sort((a, b) => b[1].t - a[1].t).slice(0, MAX);
      for (const k of Object.keys(map)) delete map[k];
      for (const [k, v] of entries) map[k] = v;
    }
  }
}

const pick = (d) => ({
  sessions: d && typeof d.sessions === 'object' ? d.sessions : {},
  projects: d && typeof d.projects === 'object' ? d.projects : {},
});
