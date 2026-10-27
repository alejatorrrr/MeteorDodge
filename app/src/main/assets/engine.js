/* Pure game simulation: shared by Canvas and the Node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeteorEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Swept circle collision in relative space prevents fast objects tunnelling.
  function hit(ax, ay, bx, by, radius) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return (ax + t * dx) ** 2 + (ay + t * dy) ** 2 <= radius ** 2;
  }

  class Game {
    constructor(random = Math.random, height = 640) {
      this.random = random;
      this.width = 360;
      this.height = height;
      this.state = 'ready';
      this.reset();
    }
    reset() {
      this.player = { x: 180, y: this.height - 100, radius: 11 };
      this.target = { x: this.player.x, y: this.player.y };
      this.meteors = [];
      this.time = 0;
      this.passed = 0;
      this.score = 0;
      this.level = 1;
      this.spawnClock = 0.65;
    }
    start() { this.reset(); this.state = 'playing'; }
    pause() { if (this.state === 'playing') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'playing'; }
    move(x, y) {
      this.target.x = clamp(x, 20, this.width - 20);
      this.target.y = clamp(y, 100, this.height - 30);
    }
    resize(height) {
      const delta = height - this.height;
      this.height = height;
      this.player.y = clamp(this.player.y + delta, 100, height - 30);
      this.target.y = clamp(this.target.y + delta, 100, height - 30);
    }
    spawn() {
      const r = 13 + this.random() * 19;
      this.meteors.push({
        x: r + this.random() * (360 - 2 * r), y: -r - 4, radius: r,
        speed: 125 + Math.min(this.level - 1, 24) * 13 + this.random() * 65,
        drift: (this.random() - 0.5) * 28,
        angle: this.random() * Math.PI * 2,
        spin: (this.random() - 0.5) * 2,
        shape: Array.from({ length: 9 }, () => 0.78 + this.random() * 0.22)
      });
    }
    step(seconds) {
      if (this.state !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
      const dt = Math.min(seconds, 0.05);
      this.time += dt;
      this.level = 1 + Math.floor(this.time / 12);
      const px = this.player.x, py = this.player.y;
      const dx = this.target.x - px, dy = this.target.y - py;
      const distance = Math.hypot(dx, dy);
      const travel = Math.min(1, 640 * dt / (distance || 1));
      this.player.x += dx * travel;
      this.player.y += dy * travel;
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) {
        this.spawn();
        this.spawnClock += Math.max(0.23, 0.88 - (this.level - 1) * 0.045);
      }
      for (const m of this.meteors) {
        const oldX = m.x, oldY = m.y;
        m.y += m.speed * dt;
        m.x = clamp(m.x + m.drift * dt, m.radius, 360 - m.radius);
        m.angle += m.spin * dt;
        if (hit(oldX - px, oldY - py,
          m.x - this.player.x, m.y - this.player.y,
          this.player.radius + m.radius * 0.84)) {
          this.state = 'over';
          break;
        }
      }
      this.meteors = this.meteors.filter(m => {
        if (m.y - m.radius > this.height) { this.passed++; return false; }
        return true;
      });
      this.score = Math.floor(this.time * 10) + this.passed * 10;
    }
  }
  return { Game, hit, clamp };
});
