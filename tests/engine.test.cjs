const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Game, hit } = require('../app/src/main/assets/engine.js');

test('start, score, pause, resume and restart preserve the expected state', () => {
  const g = new Game(() => 0.5);
  assert.equal(g.state, 'ready');
  g.start();
  for (let i = 0; i < 10; i++) g.step(0.05);
  assert.equal(g.score, 4); // Floating point time is just below 0.5 seconds.
  g.pause();
  const time = g.time;
  g.step(0.05);
  assert.equal(g.time, time);
  g.resume();
  g.step(0.05);
  assert.ok(g.time > time);
  g.start();
  assert.equal(g.score, 0);
  assert.equal(g.meteors.length, 0);
  assert.equal(g.state, 'playing');
});

test('touch targets and ship movement stay within the play area', () => {
  const g = new Game(); g.start();
  g.move(-900, 9000);
  assert.deepEqual(g.target, { x: 20, y: 610 });
  for (let i = 0; i < 20; i++) g.step(0.05);
  assert.equal(g.player.x, 20);
  assert.equal(g.player.y, 610);
  g.resize(520);
  assert.ok(g.player.y <= 490);
});

test('a meteor hitting the ship ends the game and freezes the score', () => {
  const g = new Game(); g.start();
  g.meteors.push({ x: 180, y: 510, radius: 20, speed: 500, drift: 0, angle: 0, spin: 0 });
  g.step(0.05);
  assert.equal(g.state, 'over');
  const score = g.score;
  g.step(0.05);
  assert.equal(g.score, score);
});

test('swept collision detects fast crossing and ignores a near miss', () => {
  assert.equal(hit(0, -150, 0, 150, 20), true);
  assert.equal(hit(21, -150, 21, 150, 20), false);
  assert.equal(hit(0, 0, 0, 0, 20), true);
});

test('dodging a meteor awards points and removes it', () => {
  const g = new Game(); g.start();
  g.meteors.push({ x: 20, y: 660, radius: 10, speed: 100, drift: 0, angle: 0, spin: 0 });
  g.step(0.05);
  assert.equal(g.passed, 1);
  assert.equal(g.score, 10);
  assert.equal(g.meteors.length, 0);
});

test('difficulty increases over time and meteors spawn inside the screen', () => {
  const g = new Game(() => 0.5); g.start();
  for (let i = 0; i < 500; i++) {
    g.meteors = []; // Isolate progression from collision.
    g.step(0.05);
  }
  assert.equal(g.level, 3);
  g.spawn();
  const m = g.meteors.at(-1);
  assert.ok(m.speed > 180);
  assert.ok(m.x >= m.radius && m.x <= 360 - m.radius);
  assert.equal(m.shape.length, 9);
});

test('invalid frame deltas are ignored and large deltas are capped', () => {
  const g = new Game(); g.start();
  g.step(NaN); g.step(Infinity); g.step(-1);
  assert.equal(g.time, 0);
  g.step(600);
  assert.equal(g.time, 0.05);
});
