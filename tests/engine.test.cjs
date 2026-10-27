const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, hit } = require('../app/src/main/assets/engine.js');
const make = () => { const g = new Game(() => .5); g.start(); g.spawnClock = 100; return g; };
const rock = (g, options = {}) => Object.assign(g.spawn(), { x: 180, y: 300, speed: 0, drift: 0 }, options);
const shoot = (g, m, damage = 1) => { g.bullets.push({ x: m.x, y: m.y + 25, damage }); g.fireClock = 10; g.step(.05); };

test('start, pause, resume and restart reset combat and XP', () => {
  const g = make(); g.step(.05); const time = g.time;
  g.pause(); g.step(.05); assert.equal(g.time, time);
  g.resume(); g.step(.05); assert.ok(g.time > time);
  g.health = 20; g.damage = 6; g.xp = 7; g.start();
  assert.equal(g.health, 100); assert.equal(g.damage, 1); assert.equal(g.xp, 0);
  assert.equal(g.state, 'playing'); assert.equal(g.pickups.length, 0);
});
test('ship movement and resize remain within play area', () => {
  const g = make(); g.move(-900, 9000);
  assert.deepEqual(g.target, { x: 26, y: 602 });
  for (let i = 0; i < 20; i++) g.step(.05);
  assert.equal(g.player.x, 26); assert.equal(g.player.y, 602);
  g.resize(520); assert.ok(g.player.y <= 482);
});
test('automatic fire follows cadence and pauses without firing', () => {
  const g = make();
  for (let i = 0; i < 10; i++) g.step(.05);
  assert.equal(g.bullets.length, 2);
  const bullets = JSON.stringify(g.bullets); g.pause(); g.step(.05);
  assert.equal(JSON.stringify(g.bullets), bullets);
});
test('different rock sizes have 2, 4 and 7 hit points', () => {
  const small = new Game(() => 0).spawn(), mid = new Game(() => .4).spawn(), big = new Game(() => .99).spawn();
  assert.deepEqual([small.hp, mid.hp, big.hp], [2, 4, 7]);
});
test('repeated shots crack and destroy a rock exactly once', () => {
  const g = make(), m = rock(g, { hp: 2, maxHp: 2, size: 1 });
  shoot(g, m); assert.equal(m.hp, 1); assert.equal(g.kills, 0); assert.ok(m.flash > 0);
  shoot(g, m); assert.equal(g.kills, 1); assert.equal(g.meteors.length, 0);
  assert.equal(g.pickups.filter(p => p.type === 'xp').length, 2);
  g.destroy(m); assert.equal(g.kills, 1);
  assert.equal(g.drainEvents().filter(e => e.type === 'explode').length, 1);
});
test('a bullet hits only the nearest of overlapping rocks', () => {
  const g = make(), far = rock(g, { y: 290 }), near = rock(g, { y: 320 });
  g.bullets.push({ x: 180, y: 346, damage: 1 }); g.fireClock = 10; g.step(.05);
  assert.equal(near.hp, near.maxHp - 1); assert.equal(far.hp, far.maxHp);
});
test('shield absorbs damage first, overflow reaches health and invulnerability prevents repeats', () => {
  const g = make(); g.shield = 10;
  assert.equal(g.hurt(28), true); assert.equal(g.shield, 0); assert.equal(g.health, 82);
  assert.equal(g.hurt(40), false); assert.equal(g.health, 82);
  g.invulnerable = 0; g.hurt(100); assert.equal(g.state, 'over'); assert.equal(g.health, 0);
});
test('rock impact hurts and explodes without granting XP or kill rewards', () => {
  const g = make(); rock(g, { y: g.player.y, size: 3 }); g.step(.05);
  assert.equal(g.shield, 0); assert.equal(g.health, 90);
  assert.equal(g.meteors.length, 0); assert.equal(g.pickups.length, 0); assert.equal(g.kills, 0);
});
test('XP homes toward the ship, is collected and pauses for a level choice', () => {
  const g = make(); g.xp = 10;
  g.pickups.push({ type: 'xp', x: 180, y: g.player.y - 28, vx: 0, vy: 0, value: 2, age: 1 });
  g.step(.05); assert.equal(g.state, 'upgrade'); assert.equal(g.level, 2); assert.equal(g.xp, 0);
  const time = g.time; g.step(.05); assert.equal(g.time, time);
  assert.equal(g.chooseUpgrade('bogus'), false);
  assert.equal(g.chooseUpgrade('damage'), true); assert.equal(g.damage, 2); assert.equal(g.state, 'playing');
});
test('all three upgrades work and XP overflow creates one choice per level', () => {
  const g = make(); g.addXp(40); assert.equal(g.state, 'upgrade');
  const interval = g.fireInterval; g.chooseUpgrade('rate');
  assert.ok(g.fireInterval < interval); assert.equal(g.state, 'upgrade');
  assert.equal(g.level, 3); assert.equal(g.xp, 8);
  g.health = 60; g.chooseUpgrade('health');
  assert.equal(g.maxHealth, 125); assert.equal(g.health, 85); assert.equal(g.state, 'playing');
  assert.equal(g.chooseUpgrade('health'), false);
});
test('shield drops are random, collectible and capped', () => {
  const g = new Game(() => .1); g.start(); g.spawnClock = 100;
  const m = rock(g); g.destroy(m);
  assert.equal(g.pickups.filter(p => p.type === 'shield').length, 1);
  g.pickups = [{ type: 'shield', x: g.player.x, y: g.player.y, vx: 0, vy: 0, age: 0, value: 20 }];
  g.shield = 55; g.step(.05); assert.equal(g.shield, 60); assert.equal(g.pickups.length, 0);
  const other = make(); other.destroy(rock(other));
  assert.equal(other.pickups.filter(p => p.type === 'shield').length, 0);
});
test('sector difficulty increases independently of pilot level', () => {
  const g = make();
  for (let i = 0; i < 610; i++) { g.meteors = []; g.step(.05); }
  assert.equal(g.sector, 3); assert.equal(g.level, 1); assert.ok(g.spawn().speed > 100);
});
test('swept collision detects crossings and rejects misses', () => {
  assert.equal(hit(0, -150, 0, 150, 20), true);
  assert.equal(hit(21, -150, 21, 150, 20), false);
  assert.equal(hit(0, 0, 0, 0, 20), true);
});
test('large and invalid deltas cannot skip the simulation', () => {
  const g = make(); g.step(NaN); g.step(Infinity); g.step(-1); assert.equal(g.time, 0);
  g.step(600); assert.equal(g.time, .05);
});
test('spent bullets, offscreen rocks and old pickups are cleaned up', () => {
  const g = make(); g.fireClock = 10;
  rock(g, { x: 30, y: 700 });
  g.bullets.push({ x: 20, y: -50, damage: 1 });
  g.pickups.push({ type: 'shield', x: 20, y: 200, vx: 0, vy: 0, value: 20, age: 19 });
  g.step(.05); assert.equal(g.passed, 1); assert.equal(g.score, 10);
  assert.equal(g.bullets.length, 0); assert.equal(g.pickups.length, 0);
});
