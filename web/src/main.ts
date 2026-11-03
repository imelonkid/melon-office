import Phaser from 'phaser';
import './style.css';
import { OfficeScene } from './scene';
import { net } from './net';
import { mountPanel } from './panel';
import { SHOW_CAPTION, caption, taxiCountdown } from './copy';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: 1728,
  height: 1248,
  transparent: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [OfficeScene],
});

(window as unknown as { melonOffice: Phaser.Game }).melonOffice = game; // handy for debugging in devtools
mountPanel(document.getElementById('panel')!);
net.connect();

const $ = (id: string) => document.getElementById(id)!;
net.onStatus((online) => {
  $('live').classList.toggle('off', !online);
  $('live-text').textContent = online ? 'LIVE' : '连接中';
});

function tick() {
  const s = net.last;
  const live = s ? s.agents.filter((a) => a.status !== 'gone') : [];
  const working = live.filter((a) => a.status === 'working' || a.status === 'thinking' || a.status === 'waiting').length;
  $('headcount').textContent = `${working} / ${live.length}`;
  $('delivered').textContent = String(s?.stats.delivered ?? 0);
  if (s?.settings) {
    $('brand-name').textContent = s.settings.officeName;
    document.title = `Melon Office · ${s.settings.officeName}`;
  }
  const t = taxiCountdown();
  $('taxi').textContent = t ? `距打车报销 ${t}` : '打车可报销';
  const slacking = live.filter((a) => a.status === 'slacking').length;
  $('caption').textContent = SHOW_CAPTION ? caption(working, slacking, Boolean(s?.scold)) : '';
}
net.on(tick);
setInterval(tick, 10000);
tick();
