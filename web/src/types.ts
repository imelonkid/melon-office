export type Status = 'thinking' | 'working' | 'waiting' | 'idle' | 'leaving' | 'gone';

export interface Agent {
  id: string;
  sessionId: string;
  isSub: boolean;
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
  now: number;
}

export type XY = [number, number];

export interface Layout {
  size: XY;
  iso: { ox: number; oy: number; s: number };
  cell: { w: number; h: number; ax: number; ay: number };
  frames: string[];
  seats: { id: string; row: 'row1' | 'row2'; x: number; y: number; anchor: XY }[];
  spots: { entrance: XY; aisleEast: XY; pantryDoor: XY; pantry: XY[]; rack: XY; boss: XY };
  wall: { banner: XY; clock: XY; projector: XY };
}
