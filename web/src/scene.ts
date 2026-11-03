import Phaser from 'phaser';
import type { Agent, Layout, Pending, Scold, State, XY } from './types';
import { net } from './net';
import { askOf, lineOf, rawOf } from './copy';

const CAST_KEYS = ['boss', 'gua', 'tian', 'zi', 'agua', 'pi', 'g1', 'g2', 'g3', 'g4'];
const FONT = '"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif';
const MONO = 'Menlo,"SF Mono",Consolas,monospace';
const SPEED = 2.4; // floor units per second
const CAT_LANE = 7.9; // open floor between the row-2 desks and the cot, the way to the cat

// monitor-glow color per kind of work (pixtuoid-style), drawn as a halo around the seated employee
const GLOW: Record<string, number> = {
  edit: 0x9be29f, read: 0x7ec8f2, search: 0x7ec8f2, bash: 0xf2a65a, web: 0xc78be8,
  task: 0xffd27a, plan: 0xffd27a, think: 0xffd27a, wait: 0xff6b5e, fail: 0xff6b5e, other: 0x9be29f, idle: 0x9a93c2,
};
const CHIP: Record<string, [string, string]> = {
  gua: ['#DDF3D8', '#2F6B2A'], tian: ['#DDF0FB', '#22628C'], zi: ['#F1E2FA', '#6B3A8C'],
  agua: ['#FFE3C4', '#8A4B12'], pi: ['#ECEAF3', '#4A4560'], boss: ['#FFF0C7', '#7A5A10'],
  g1: ['#D6F1EE', '#1F6A62'], g2: ['#FCE1EA', '#8C2F52'], g3: ['#FFF0C7', '#7A5A10'], g4: ['#E3E8F7', '#3A4A80'],
};
const BOSS_LINES = [
  '这个需求，我们拉通对齐一下', '今天的抓手是什么？', 'Q4 要打出组合拳', '大家辛苦了，再冲一下', '把颗粒度再细一点',
];

type Variant = 'say' | 'term' | 'ask' | 'angry';

// ---------------------------------------------------------------- speech bubble
class Bubble extends Phaser.GameObjects.Container {
  private sig = '';
  bw = 0; // box size, used to keep bubbles from covering each other
  bh = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(1000);
  }

  show(name: string, cast: string, text: string, variant: Variant, pending?: Pending, raw = '') {
    const sig = JSON.stringify([name, text, variant, pending?.id, pending?.holding, raw]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.removeAll(true);
    const s = this.scene;
    const pad = 16;
    const tail = 14;
    const term = variant === 'term';
    const [chipBg, chipFg] = CHIP[cast] || CHIP.pi;

    const chip = s.add.text(0, 0, name, { fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: chipFg, backgroundColor: chipBg, padding: { x: 11, y: 5 } });
    const msg = s.add.text(0, 0, text, {
      fontFamily: FONT, fontSize: '25px', fontStyle: variant === 'ask' || variant === 'angry' ? 'bold' : 'normal',
      color: term ? '#F5F2FF' : '#2A2440', wordWrap: { width: 520, useAdvancedWrap: true },
    });
    const row1H = Math.max(chip.height, msg.height);
    let w = chip.width + 12 + msg.width;
    let h = row1H;
    const extra: Phaser.GameObjects.Text[] = [];
    const buttons: Phaser.GameObjects.Text[] = [];

    // the original command, small and quiet, for people who want to know exactly what ran
    if (raw && variant !== 'ask') {
      const sub = s.add.text(0, 0, raw, { fontFamily: MONO, fontSize: '18px', color: term ? '#6FE39A' : '#9A93B8' });
      extra.push(sub);
      w = Math.max(w, sub.width);
      h += 6 + sub.height;
    }

    if (variant === 'ask' && pending) {
      const sub = s.add.text(0, 0, `想要：${askOf(pending)}`, { fontFamily: FONT, fontSize: '21px', color: '#6E6890', wordWrap: { width: 520, useAdvancedWrap: true } });
      extra.push(sub);
      w = Math.max(w, sub.width);
      h += 10 + sub.height;
      if (pending.holding) {
        const mk = (label: string, bg: string, fg: string, behavior: 'allow' | 'deny') => {
          const b = s.add.text(0, 0, label, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: fg, backgroundColor: bg, padding: { x: 26, y: 8 } });
          b.setInteractive({ useHandCursor: true }).on('pointerdown', () => net.decide(pending.id, behavior));
          buttons.push(b);
          return b;
        };
        mk('同意', '#2A2440', '#9BE29F', 'allow');
        mk('驳回', '#F1EFF7', '#2A2440', 'deny');
        h += 12 + buttons[0].height;
      } else {
        const hint = s.add.text(0, 0, '请在终端里确认', { fontFamily: FONT, fontSize: '20px', color: '#A09AB8' });
        extra.push(hint);
        h += 8 + hint.height;
      }
    }

    w += pad * 2;
    h += 22;
    this.bw = w;
    this.bh = h + tail;
    const top = -h - tail;
    const g = s.add.graphics();
    g.fillStyle(0x000000, 0.25).fillRoundedRect(-w / 2, top + 7, w, h, 22);
    g.fillStyle(term ? 0x1e1c36 : 0xffffff, 1).fillRoundedRect(-w / 2, top, w, h, 22);
    g.fillTriangle(-13, -tail - 1, 13, -tail - 1, 0, 0);
    if (term) g.lineStyle(4, 0x6fe39a, 1).strokeRoundedRect(-w / 2, top, w, h, 22);
    if (variant === 'ask') g.lineStyle(5, 0xffd27a, 1).strokeRoundedRect(-w / 2, top, w, h, 22);
    if (variant === 'angry') g.lineStyle(5, 0xff6b5e, 1).strokeRoundedRect(-w / 2, top, w, h, 22);
    this.add(g);

    let x = -w / 2 + pad;
    let y = top + 11;
    chip.setPosition(x, y + (row1H - chip.height) / 2);
    msg.setPosition(x + chip.width + 12, y + (row1H - msg.height) / 2);
    this.add([chip, msg]);
    y += row1H;
    for (const e of extra) {
      y += 7;
      e.setPosition(x, y);
      this.add(e);
      y += e.height;
    }
    if (buttons.length) {
      y += 12;
      buttons[0].setPosition(x, y);
      buttons[1].setPosition(x + buttons[0].width + 12, y);
      this.add(buttons);
    }
    if (variant === 'ask') {
      const dot = s.add.circle(w / 2 - 4, top + 4, 15, 0xff6b5e);
      const bang = s.add.text(w / 2 - 4, top + 4, '!', { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
      s.tweens.add({ targets: [dot, bang], alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      this.add([dot, bang]);
    }
  }
}

// ---------------------------------------------------------------- one employee
type Spot = 'seat' | 'pantry' | 'chat' | 'cat';
type Place = Spot | 'walk';
type Target = Spot | 'exit';

class Worker {
  sprite: Phaser.GameObjects.Sprite;
  glow: Phaser.GameObjects.Ellipse;
  bubble: Bubble;
  pos = { x: 0, y: 0 };
  place: Place = 'walk';
  target: Target | null = null;
  path: XY[] = [];
  lastStep = 0;
  idleSince = 0;
  phase = Math.random() * 6;
  lastSx = 0;
  removed = false;
  chatSlot = 0; // 0 = the left one of a gossip pair, faces right

  // instant: the employee was already in the office when the page opened, so skip the walk-in
  constructor(private scene: OfficeScene, public agent: Agent, instant = false) {
    const [ex, ey] = scene.layout.spots.entrance;
    this.pos = { x: ex, y: ey };
    const [sx, sy] = scene.project(ex, ey);
    this.lastSx = sx;
    this.sprite = scene.add.sprite(sx, sy, agent.cast, scene.frame('stand')).setOrigin(0.5, 0.9).setAlpha(0).setDepth(60);
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 400 });
    this.glow = scene.add.ellipse(0, 0, 150, 110, 0xffffff, 0.22).setVisible(false);
    this.bubble = new Bubble(scene);
    if (agent.status === 'idle') this.idleSince = performance.now() - (instant ? 10000 : 0);
    this.decide();
    if (instant && this.path.length) {
      const [x, y] = this.path[this.path.length - 1];
      this.pos = { x, y };
      this.path = [];
      this.arrive();
    }
  }

  seat() {
    return this.agent.seat != null ? this.scene.layout.seats[this.agent.seat] : null;
  }

  update(agent: Agent) {
    const prev = this.agent;
    this.agent = agent;
    if (agent.status === 'idle' && prev.status !== 'idle') this.idleSince = performance.now();
    if (agent.partner !== prev.partner) this.target = null; // new gossip partner, find a new spot
    this.decide();
  }

  private decide() {
    const a = this.agent;
    let want: Target;
    if (a.status === 'leaving') want = 'exit';
    else if (a.status === 'slacking') {
      if (a.activity === 'chat' || a.activity === 'cat') want = a.activity;
      else if (a.activity === 'fake') want = this.seat() ? 'seat' : 'pantry';
      else want = a.activity === 'phone' && this.seat() ? 'seat' : 'pantry';
    } else if (!this.seat()) want = 'pantry';
    else if (a.status === 'idle') want = this.place === 'pantry' || performance.now() - this.idleSince > 5000 ? 'pantry' : 'seat';
    else want = 'seat';
    if (want !== this.target) {
      this.target = want;
      this.go();
    }
    this.pose();
  }

  private go() {
    this.scene.releaseSpots(this, this.target);
    const L = this.scene.layout;
    const lane = L.spots.aisleEast[0];
    let dest: XY;
    if (this.target === 'chat') {
      const spot = this.scene.claimChat(this);
      if (!spot) this.target = 'pantry';
      else dest = spot;
    }
    if (this.target === 'seat') dest = [this.seat()!.x, this.seat()!.y];
    else if (this.target === 'pantry') dest = this.scene.claimPantry(this);
    else if (this.target === 'cat') dest = L.spots.cat;
    else if (this.target === 'exit') dest = L.spots.entrance;

    let here: XY = [this.pos.x, this.pos.y];
    const pts: XY[] = [];
    // the cot is in the way: step back out to the open floor before heading anywhere
    if (here[0] < lane - 0.5 && here[1] > CAT_LANE + 0.05) {
      here = [here[0], CAT_LANE];
      pts.push(here);
    }
    // ...and come in to the cat the same way
    const via: XY[] = this.target === 'cat' ? [[dest![0], CAT_LANE]] : [];
    const aim = via[0] || dest!;
    if (Math.abs(here[0] - lane) > 0.05 && Math.abs(here[1] - aim[1]) > 0.05) pts.push([lane, here[1]]);
    if (Math.abs(here[1] - aim[1]) > 0.05) pts.push([lane, aim[1]]);
    pts.push(...via, dest!);

    this.place = 'walk';
    this.glow.setVisible(false);
    this.sprite.play(`${this.agent.cast}-walk`, true);
    this.path = pts;
    this.lastStep = performance.now();
  }

  // walk along the path using wall-clock time, so speed is the same even when the tab is throttled
  private step() {
    const now = performance.now();
    let budget = (Math.min(250, now - this.lastStep) / 1000) * SPEED;
    this.lastStep = now;
    while (budget > 0 && this.path.length) {
      const [tx, ty] = this.path[0];
      const dx = tx - this.pos.x;
      const dy = ty - this.pos.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        this.pos.x = tx;
        this.pos.y = ty;
        budget -= d;
        this.path.shift();
      } else {
        this.pos.x += (dx / d) * budget;
        this.pos.y += (dy / d) * budget;
        budget = 0;
      }
    }
    if (!this.path.length) this.arrive();
  }

  private arrive() {
    this.path = [];
    if (this.target === 'exit') {
      this.removed = true;
      this.scene.tweens.add({
        targets: [this.sprite, this.bubble], alpha: 0, duration: 500,
        onComplete: () => { this.sprite.destroy(); this.glow.destroy(); this.bubble.destroy(); },
      });
      this.scene.forget(this);
      return;
    }
    this.place = this.target!;
    this.sprite.setFlipX(this.place === 'chat' && this.chatSlot === 0);
    this.pose();
  }

  private pose() {
    if (this.place === 'walk') return;
    const a = this.agent;
    const k = a.cast;
    if (this.place === 'seat') {
      const s = this.seat();
      if (!s) return;
      this.sprite.setPosition(s.anchor[0], s.anchor[1]).setDepth(s.row === 'row1' ? 10 : 30);
      if (a.status === 'slacking' && a.activity !== 'fake') {
        this.glow.setVisible(false);
        this.sprite.play(`${k}-phone`, true);
        return;
      }
      const color = a.activity === 'fake' ? GLOW.other : GLOW[a.status === 'waiting' ? 'wait' : a.kind] ?? GLOW.other;
      this.glow.setPosition(s.anchor[0], s.anchor[1] - 80).setDepth(this.sprite.depth - 0.5).setFillStyle(color, 0.22).setVisible(true);
      if (a.status === 'waiting') this.sprite.play(`${k}-raise`, true);
      else if ((a.status === 'working' && a.kind !== 'fail') || a.activity === 'fake') this.sprite.play(`${k}-type`, true);
      else this.sprite.play(`${k}-think`, true);
    } else {
      this.glow.setVisible(false);
      const [x, y] = this.scene.project(this.pos.x, this.pos.y);
      this.sprite.setPosition(x, y).setDepth(this.scene.depthFor(this.pos.x, this.pos.y));
      const anim = this.place === 'chat' ? 'talk' : this.place === 'cat' ? 'pet' : a.status === 'waiting' || a.activity === 'fake' ? 'stand' : 'mug';
      this.sprite.play(`${k}-${anim}`, true);
    }
  }

  tick(time: number, pending?: Pending) {
    if (this.removed) return;
    if (this.place === 'walk') {
      this.step();
      if (this.removed) return;
    }
    if (this.place === 'walk') {
      const [x, y] = this.scene.project(this.pos.x, this.pos.y);
      if (Math.abs(x - this.lastSx) > 0.5) this.sprite.setFlipX(x < this.lastSx);
      this.lastSx = x;
      this.sprite.setPosition(x, y).setDepth(this.scene.depthFor(this.pos.x, this.pos.y));
    } else if (this.agent.status === 'idle' && this.place === 'seat' && performance.now() - this.idleSince > 5000) {
      this.decide();
    }
    const a = this.agent;
    const lift = this.place === 'seat' ? 122 : 150;
    this.bubble.setPosition(this.sprite.x, this.sprite.y - lift - 4 * Math.sin(time / 450 + this.phase));
    const variant: Variant = a.status === 'waiting' ? 'ask' : a.status === 'working' && a.kind === 'bash' ? 'term' : 'say';
    this.bubble.show(a.name, a.cast, lineOf(a), variant, pending, rawOf(a.raw));
  }
}

// ---------------------------------------------------------------- the office
export class OfficeScene extends Phaser.Scene {
  layout!: Layout;
  workers = new Map<string, Worker>();
  pantryUse = new Map<number, Worker>();
  chatUse = new Map<string, Worker>(); // "pair:slot" -> who stands there
  pendingByAgent = new Map<string, Pending>();
  seenFirstState = false;
  bossBubble!: Bubble;
  boss!: Phaser.GameObjects.Sprite;
  bossLine = BOSS_LINES[0];
  // the boss walks out to the floor for a speech and back to the meeting room after
  bossPos: XY = [0, 0];
  bossPath: XY[] = [];
  bossGoal: 'room' | 'floor' = 'room';
  bossLastStep = 0;
  bossLastSx = 0;
  scold: Scold | null = null;
  clockSkew = 0; // server time - local time
  wallTex!: Phaser.Textures.CanvasTexture;

  constructor() {
    super('office');
  }

  preload() {
    this.load.json('layout', 'assets/layout.json');
    for (const k of ['bg_a', 'bg_b', 'row1', 'row2']) this.load.image(k, `assets/${k}.png`);
    for (const k of CAST_KEYS) this.load.spritesheet(k, `assets/chars/${k}.png`, { frameWidth: 180, frameHeight: 240 });
  }

  frame(name: string) {
    return Math.max(0, this.layout.frames.indexOf(name));
  }

  project(x: number, y: number, z = 0): XY {
    const { ox, oy, s } = this.layout.iso;
    return [ox + (x - y) * s, oy + ((x + y) * s) / 2 - z * s];
  }

  // painter's order for anyone standing / walking on the floor
  depthFor(x: number, y: number) {
    if (x > 9) return 50 + y;
    if (y < 2.2) return 15;   // behind row-1 desks
    if (y < 4.3) return 25;   // between the rows
    if (y < 5.4) return 35;   // behind row-2 desks
    return 50 + y;
  }

  claimPantry(w: Worker): XY {
    const spots = this.layout.spots.pantry;
    for (let i = 0; i < spots.length; i++) {
      if (!this.pantryUse.has(i) || this.pantryUse.get(i) === w) {
        this.pantryUse.set(i, w);
        return spots[i];
      }
    }
    const [x, y] = spots[Math.floor(Math.random() * spots.length)];
    return [x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.6];
  }

  // a gossip spot: next to the partner if they already found one, else an empty pair; null when all are taken
  claimChat(w: Worker): XY | null {
    const pairs = this.layout.spots.chat;
    const at = (key: string) => {
      const [p, s] = key.split(':').map(Number);
      this.chatUse.set(key, w);
      w.chatSlot = s;
      return pairs[p][s];
    };
    for (const [key, v] of this.chatUse) if (v === w) return at(key);
    for (const [key, v] of this.chatUse) {
      if (v.agent.id !== w.agent.partner) continue;
      const [p, s] = key.split(':').map(Number);
      if (!this.chatUse.has(`${p}:${1 - s}`)) return at(`${p}:${1 - s}`);
    }
    for (let p = 0; p < pairs.length; p++) {
      if (!this.chatUse.has(`${p}:0`) && !this.chatUse.has(`${p}:1`)) return at(`${p}:0`);
    }
    return null;
  }

  releaseSpots(w: Worker, keep?: Target | null) {
    if (keep !== 'pantry') for (const [i, v] of this.pantryUse) if (v === w) this.pantryUse.delete(i);
    if (keep !== 'chat') for (const [k, v] of this.chatUse) if (v === w) this.chatUse.delete(k);
  }

  forget(w: Worker) {
    this.releaseSpots(w);
    this.workers.delete(w.agent.id);
  }

  create() {
    this.layout = this.cache.json.get('layout');
    this.add.image(0, 0, 'bg_a').setOrigin(0).setDepth(0);
    const bgB = this.add.image(0, 0, 'bg_b').setOrigin(0).setDepth(0.1).setAlpha(0);
    this.time.addEvent({ delay: 700, loop: true, callback: () => bgB.setAlpha(bgB.alpha ? 0 : 1) });
    this.add.image(0, 0, 'row1').setOrigin(0).setDepth(20);
    this.add.image(0, 0, 'row2').setOrigin(0).setDepth(40);

    const f = (n: string) => ({ key: '', frame: this.frame(n) });
    for (const k of CAST_KEYS) {
      const fr = (names: string[]) => names.map((n) => ({ ...f(n), key: k }));
      this.anims.create({ key: `${k}-type`, frames: fr(['sit', 'sit_type']), frameRate: 5, repeat: -1 });
      this.anims.create({ key: `${k}-raise`, frames: fr(['sit_raise', 'sit_raise2']), frameRate: 3, repeat: -1 });
      this.anims.create({ key: `${k}-think`, frames: fr(['sit', 'sit', 'sit', 'sit', 'sit', 'sit_blink']), frameRate: 4, repeat: -1 });
      this.anims.create({ key: `${k}-walk`, frames: fr(['walk1', 'walk2']), frameRate: 7, repeat: -1 });
      this.anims.create({ key: `${k}-mug`, frames: fr(['mug', 'mug', 'mug', 'mug2']), frameRate: 2, repeat: -1 });
      this.anims.create({ key: `${k}-stand`, frames: fr(['stand']), frameRate: 1, repeat: -1 });
      this.anims.create({ key: `${k}-phone`, frames: fr(['sit_phone', 'sit_phone', 'sit_phone', 'sit_phone2']), frameRate: 2, repeat: -1 });
      this.anims.create({ key: `${k}-talk`, frames: fr(['talk1', 'talk2', 'talk1', 'talk2', 'talk1', 'talk1']), frameRate: 4, repeat: -1 });
      this.anims.create({ key: `${k}-pet`, frames: fr(['pet1', 'pet2']), frameRate: 2, repeat: -1 });
      this.anims.create({ key: `${k}-scold`, frames: fr(['scold1', 'scold2', 'scold1', 'scold2', 'scold2', 'scold1']), frameRate: 4, repeat: -1 });
    }

    this.wallTex = this.textures.createCanvas('walltext', this.layout.size[0], this.layout.size[1])!;
    this.add.image(0, 0, 'walltext').setOrigin(0).setDepth(0.2);
    this.drawWall();
    this.time.addEvent({ delay: 20000, loop: true, callback: () => this.drawWall() });

    // 瓜老板 = you. He lives in the meeting room and nags when something needs your approval.
    this.bossPos = [...this.layout.spots.boss];
    const [bx, by] = this.project(...this.bossPos);
    this.boss = this.add.sprite(bx, by, 'boss', this.frame('stand')).setOrigin(0.5, 0.9).setDepth(60);
    this.boss.play('boss-stand');
    this.bossBubble = new Bubble(this);
    let i = 0;
    this.time.addEvent({ delay: 9000, loop: true, callback: () => { this.bossLine = BOSS_LINES[++i % BOSS_LINES.length]; } });

    net.on((s) => this.applyState(s));
  }

  private drawWall() {
    const ctx = this.wallTex.getContext();
    const { s } = this.layout.iso;
    ctx.clearRect(0, 0, this.layout.size[0], this.layout.size[1]);
    const skewed = (at: XY, draw: () => void) => {
      ctx.save();
      ctx.setTransform(1, 0.5, 0, 1, at[0], at[1]); // wall A runs along the floor x axis: skewY(atan .5)
      draw();
      ctx.restore();
    };
    skewed(this.layout.wall.banner, () => {
      ctx.font = `900 25px ${FONT}`;
      ctx.fillStyle = '#FFE9A8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('拥 抱 变 化  ·  使 命 必 达', (6.9 * s) / 2, (0.57 * s) / 2);
    });
    skewed(this.layout.wall.clock, () => {
      const d = new Date();
      ctx.font = `bold 24px ${MONO}`;
      ctx.fillStyle = '#FF8A5E';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, (1.2 * s) / 2, (0.6 * s) / 2);
    });
    skewed(this.layout.wall.projector, () => {
      ctx.font = `bold 18px ${FONT}`;
      ctx.fillStyle = '#2A2440';
      ctx.textBaseline = 'top';
      ctx.fillText('Q4 增长复盘', 0, 6);
    });
    this.wallTex.refresh();
  }

  applyState(s: State) {
    this.scold = s.scold;
    this.clockSkew = s.now - Date.now();
    this.walkBoss(s.scold ? 'floor' : 'room');
    this.pendingByAgent = new Map(s.pending.map((p) => [p.agentId, p]));
    const first = !this.seenFirstState;
    const alive = new Set<string>();
    for (const a of s.agents) {
      if (a.status === 'gone') continue;
      alive.add(a.id);
      const w = this.workers.get(a.id);
      if (w) w.update(a);
      else {
        const nw = new Worker(this, a, first);
        if (!nw.removed) this.workers.set(a.id, nw);
      }
    }
    for (const [id, w] of this.workers) {
      if (!alive.has(id) && w.agent.status !== 'leaving') w.update({ ...w.agent, status: 'leaving' });
    }
    this.seenFirstState = true;
  }

  // meeting room -> through the glass door -> the aisle between the two rows of desks
  private walkBoss(goal: 'room' | 'floor') {
    if (goal === this.bossGoal) return;
    this.bossGoal = goal;
    const route: XY[] = [[9.3, 3.5], [9.3, 3.0], [8.6, 3.0], [8.6, 3.75], [5.2, 3.75]];
    const [rx, ry] = this.layout.spots.boss;
    this.bossPath = goal === 'floor' ? route : [...route.slice(0, -1).reverse(), [rx, 3.5], [rx, ry]];
    this.bossLastStep = performance.now();
    this.boss.play('boss-walk', true);
  }

  private stepBoss() {
    const now = performance.now();
    let budget = (Math.min(250, now - this.bossLastStep) / 1000) * SPEED;
    this.bossLastStep = now;
    while (budget > 0 && this.bossPath.length) {
      const [tx, ty] = this.bossPath[0];
      const d = Math.hypot(tx - this.bossPos[0], ty - this.bossPos[1]);
      if (d <= budget) {
        this.bossPos = [tx, ty];
        budget -= d;
        this.bossPath.shift();
      } else {
        this.bossPos = [this.bossPos[0] + ((tx - this.bossPos[0]) / d) * budget, this.bossPos[1] + ((ty - this.bossPos[1]) / d) * budget];
        budget = 0;
      }
    }
    const [x, y] = this.project(...this.bossPos);
    if (Math.abs(x - this.bossLastSx) > 0.5) this.boss.setFlipX(x < this.bossLastSx);
    this.bossLastSx = x;
    this.boss.setPosition(x, y).setDepth(this.depthFor(...this.bossPos));
    if (!this.bossPath.length) {
      this.boss.setFlipX(false);
      this.boss.play(this.bossGoal === 'floor' ? 'boss-scold' : 'boss-stand', true);
    }
  }

  update(time: number) {
    for (const w of this.workers.values()) w.tick(time, this.pendingByAgent.get(w.agent.id));
    if (this.bossPath.length) this.stepBoss();
    const holding = [...this.pendingByAgent.values()].filter((p) => p.holding).length;
    let line = holding ? `有 ${holding} 个审批等你，点「同意」就行` : this.bossLine;
    let variant: Variant = 'say';
    let shake = 0;
    if (this.scold) {
      const half = (this.scold.until - this.scold.startedAt) / 2;
      line = this.scold.lines[Date.now() + this.clockSkew - this.scold.startedAt < half ? 0 : 1] || this.scold.lines[0];
      variant = 'angry';
      shake = this.bossPath.length ? 0 : 3 * Math.sin(time / 25);
    }
    this.bossBubble.setPosition(this.boss.x + shake, this.boss.y - 150 - 4 * Math.sin(time / 500));
    this.bossBubble.show('瓜老板（你）', 'boss', line, variant);
    this.unstack();
  }

  // push overlapping bubbles upward, starting from the ones lowest on screen
  private unstack() {
    const list: Bubble[] = [this.bossBubble];
    for (const w of this.workers.values()) if (!w.removed) list.push(w.bubble);
    list.sort((a, b) => b.y - a.y);
    const placed: Bubble[] = [];
    for (const b of list) {
      for (let pass = 0; pass < 6; pass++) {
        const hit = placed.find((p) =>
          Math.abs(b.x - p.x) < (b.bw + p.bw) / 2 + 8 && b.y - b.bh < p.y && b.y > p.y - p.bh);
        if (!hit) break;
        b.y = hit.y - hit.bh - 6;
      }
      placed.push(b);
    }
  }
}
