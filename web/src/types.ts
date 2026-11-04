// idle: the session is done and waiting for you; slacking: a resident with no session at all
export type Status = 'thinking' | 'working' | 'waiting' | 'idle' | 'slacking' | 'leaving' | 'gone';
export type Activity = 'phone' | 'chat' | 'cat' | 'coffee' | 'fake'; // fake: pretending to work while the boss is out

export interface EmployeeProfile {
  source: string;
  status: string;
  tenure: string;
  employment: string;
  recent: FeedItem[];
}

export interface Agent {
  profile?: EmployeeProfile;
  id: string;
  sessionId: string | null;
  provider: 'claude' | 'codex' | null;
  isSub: boolean;
  resident: boolean; // in the office even without a session
  parentName: string | null;
  cast: string;
  name: string;
  role: string;
  level: string;
  project: string;
  seat: number | null;
  status: Status;
  kind: string;
  tool: string;
  detail: string;
  line: string;   // what they're doing, in plain Chinese
  gist: string;   // same without file/branch names (record mode)
  raw: string;    // short original command / tool call
  activity: Activity | null; // what they do while slacking
  partner: string | null;    // who they're gossiping with
  toolCalls: number;
  startedAt: number;
  updatedAt: number;
}

export interface Pending {
  id: string;
  agentId: string;
  tool: string;
  detail: string; // what they want to do, in plain Chinese
  gist: string;
  raw: string;
  holding: boolean;
}

export interface Stats {
  delivered: number;
  toolCalls: number;
  approvals: number;
  prompts: number;
  failures: number;
  slack: number; // ms the residents spent slacking
  scoldings: number;
  since: number;
}

export interface FeedItem {
  t: number;
  agentId: string;
  name: string;
  text: string;
}

export interface State {
  agents: Agent[];
  pending: Pending[];
  stats: Stats;
  feed: FeedItem[];
  approvals: { enabled: boolean; active: boolean };
  scold: Scold | null; // 瓜老板 is out on the floor giving a speech
  settings: Settings;
  reportText: string; // 瓜老板的日报, one paragraph
  now: number;
}

export interface Settings {
  officeName: string; // shown top-left, e.g. 甜瓜科技 · AI 事业部
  reportDir: string;  // where the HTML daily report is saved
}

export interface Scold {
  id: string;
  startedAt: number;
  until: number;
  lines: string[];
}

export type XY = [number, number];

export interface Layout {
  atlas: { columns: number; rows: number };
  characters: Record<string, string>;
  boundary: XY[];
  foregrounds: { depth: number; points: XY[] }[];
  navigation: { nodes: XY[]; next: number[][] };
  size: XY;
  iso: { ox: number; oy: number; s: number };
  cell: { w: number; h: number; ax: number; ay: number };
  frames: string[];
  seats: { id: string; row: 'row1' | 'row2'; x: number; y: number; anchor: XY }[];
  spots: { entrance: XY; aisleEast: XY; pantryDoor: XY; pantry: XY[]; rack: XY; boss: XY; bossRoute: XY[]; cat: XY; chat: [XY, XY][] };
  wall: { banner: XY; clock: XY; projector: XY };
}
