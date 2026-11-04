import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Office } from '../server/office.mjs';

const layout = JSON.parse(readFileSync(new URL('../web/public/assets/layout.json', import.meta.url)));

test('idle employees scramble to fake work during a lecture and resume breaks afterwards', () => {
  const office = new Office({ staff: 3, remember: false });
  try {
    const employees = [...office.agents.values()];
    assert.ok(employees.every((a) => a.status === 'slacking'));
    assert.ok(employees.every((a) => ['phone', 'chat', 'cat', 'coffee'].includes(a.activity)));
    const now = Date.now();
    office.lastScold = now - 180000;
    assert.equal(office.maybeScold(now), true);
    assert.ok(office.scold.lines.length === 2);
    assert.ok(employees.every((a) => a.activity === 'fake' && !a.partner));
    assert.equal(office.maybeScold(now + 1), false);
    office.endScold();
    for (const a of employees) a.slackUntil = 0;
    office.shuffleSlack();
    assert.equal(office.scold, null);
    assert.ok(employees.every((a) => ['phone', 'chat', 'cat', 'coffee'].includes(a.activity)));
    assert.equal(office.maybeScold(now + 30000), false); // three-minute cooldown stays intact
    office.handle({ session_id: 'regression-job', hook_event_name: 'SessionStart' });
    const assigned = employees.find((a) => a.sessionId === 'regression-job');
    assert.equal(assigned.status, 'thinking');
    assert.equal(assigned.activity, null);
  } finally { office.dispose(); }
});

test('illustrated floor connects every seat, break spot and boss through the aisle graph', () => {
  const { nodes, next } = layout.navigation;
  const locate = (point) => nodes.findIndex((p) => p[0] === point[0] && p[1] === point[1]);
  const targets = [...layout.seats.map((s) => [s.x,s.y]), layout.spots.cat, layout.spots.boss, ...layout.spots.pantry];
  const entry = locate(layout.spots.entrance);
  assert.equal(layout.seats.length, 6);
  for (const target of targets) {
    let current = entry;
    const end = locate(target), visited = new Set();
    assert.ok(end >= 0);
    while (current !== end) {
      assert.ok(!visited.has(current), 'navigation may not loop');
      visited.add(current);
      const step = next[current][end];
      assert.ok(step >= 0 && step < nodes.length);
      current = step;
    }
  }
  assert.ok(layout.spots.boss[0] * 50 < 420, 'boss belongs in the left glass office');
  assert.ok(layout.spots.bossRoute.some(([x,y]) => x * 50 === 420 && y * 50 === 550), 'boss uses the glass doorway');
  for (const frame of ['sit_phone','sit_phone2','talk1','talk2','pet1','pet2','scold1','scold2']) assert.ok(layout.frames.includes(frame));
  assert.equal(layout.atlas.columns * layout.atlas.rows, layout.frames.length);
});

test('all runtime artwork is present and the live plate dimensions match the layout', () => {
  const png = readFileSync(new URL('../web/public/assets/illustration/office.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), layout.size[0]);
  assert.equal(png.readUInt32BE(20), layout.size[1]);
  for (const name of new Set(Object.values(layout.characters))) {
    const data = readFileSync(new URL(`../web/public/assets/illustration/${name}.png`, import.meta.url));
    assert.ok(data.readUInt32BE(16) >= 6 * 100);
    assert.ok(data.readUInt32BE(20) >= 3 * 100);
  }
});
