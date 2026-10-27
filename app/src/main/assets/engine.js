/* Deterministic simulation shared by Canvas and Node. No DOM dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MeteorEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function hit(ax, ay, bx, by, radius) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(-(ax * dx + ay * dy) / (dx * dx + dy * dy || 1), 0, 1);
    return (ax + t * dx) ** 2 + (ay + t * dy) ** 2 <= radius ** 2;
  }
  class Game {
    constructor(random = Math.random, height = 640) {
      this.random = random; this.width = 360; this.height = height;
      this.reset(); this.state = 'ready';
    }
    reset() {
      this.player = { x: 180, y: this.height - 100, radius: 13 };
      this.target = { x: this.player.x, y: this.player.y };
      this.meteors = []; this.bullets = []; this.pickups = []; this.events = [];
      this.time = 0; this.passed = 0; this.kills = 0; this.score = 0;
      this.sector = 1; this.level = 1; this.xp = 0; this.xpNext = 12;
      this.maxHealth = 100; this.health = 100; this.maxShield = 60; this.shield = 30;
      this.damage = 1; this.fireInterval = 0.38; this.fireClock = 0;
      this.invulnerable = 0; this.spawnClock = 0.6;
      this.upgrades = { rate: 0, damage: 0, health: 0 };
    }
    start() { this.reset(); this.state = 'playing'; }
    pause() { if (this.state === 'playing') this.state = 'paused'; }
    resume() { if (this.state === 'paused') this.state = 'playing'; }
    move(x, y) {
      this.target.x = clamp(x, 26, 334);
      this.target.y = clamp(y, 158, this.height - 38);
    }
    resize(height) {
      const delta = height - this.height;
      this.height = height;
      this.player.y = clamp(this.player.y + delta, 158, height - 38);
      this.target.y = clamp(this.target.y + delta, 158, height - 38);
    }
    spawn() {
      const radius = 13 + this.random() * 23;
      const size = radius < 20 ? 1 : radius < 28 ? 2 : 3;
      const hp = [0, 2, 4, 7][size];
      const m = {
        x: radius + this.random() * (360 - 2 * radius), y: -radius - 4,
        radius, size, hp, maxHp: hp, flash: 0,
        speed: 72 + Math.min(this.sector - 1, 24) * 9 + this.random() * 35,
        drift: (this.random() - 0.5) * 22,
        angle: this.random() * Math.PI * 2, spin: (this.random() - 0.5) * 0.7,
        variant: Math.floor(this.random() * 3)
      };
      this.meteors.push(m); return m;
    }
    destroy(m, reward = true) {
      if (m.dead) return;
      m.dead = true;
      this.events.push({ type: 'explode', x: m.x, y: m.y, size: m.size, reward });
      if (!reward) return;
      this.kills++;
      for (let i = 0; i < m.size * 2; i++) {
        const angle = this.random() * Math.PI * 2;
        this.pickups.push({ type: 'xp', x: m.x, y: m.y,
          vx: Math.cos(angle) * 45, vy: Math.sin(angle) * 40, value: 2, age: 0 });
      }
      if (this.random() < 0.22) this.pickups.push({ type: 'shield', x: m.x,
        y: m.y, vx: 0, vy: 35, value: 20, age: 0 });
    }
    hurt(amount) {
      if (this.invulnerable > 0 || this.state !== 'playing') return false;
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      this.health = Math.max(0, this.health - (amount - absorbed));
      this.invulnerable = 1.15;
      this.events.push({ type: 'hurt', x: this.player.x, y: this.player.y, shield: absorbed > 0 });
      if (this.health === 0) this.state = 'over';
      return true;
    }
    addXp(value) {
      this.xp += value;
      if (this.state === 'playing' && this.xp >= this.xpNext) this.levelUp();
    }
    levelUp() {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = 12 + (this.level - 1) * 8;
      this.state = 'upgrade';
      this.target = { x: this.player.x, y: this.player.y };
    }
    chooseUpgrade(choice) {
      if (this.state !== 'upgrade' || !Object.prototype.hasOwnProperty.call(this.upgrades, choice)) return false;
      this.upgrades[choice]++;
      if (choice === 'rate') this.fireInterval = 0.1 + 0.28 * Math.pow(0.78, this.upgrades.rate);
      if (choice === 'damage') this.damage++;
      if (choice === 'health') { this.maxHealth += 25; this.health = Math.min(this.maxHealth, this.health + 25); }
      this.state = 'playing';
      if (this.xp >= this.xpNext) this.levelUp();
      return true;
    }
    drainEvents() { const events = this.events; this.events = []; return events; }
    step(seconds) {
      if (this.state !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
      const dt = Math.min(seconds, 0.05);
      this.time += dt; this.sector = 1 + Math.floor(this.time / 15);
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      const px = this.player.x, py = this.player.y;
      const dx = this.target.x - px, dy = this.target.y - py;
      const travel = Math.min(1, 640 * dt / (Math.hypot(dx, dy) || 1));
      this.player.x += dx * travel; this.player.y += dy * travel;
      this.fireClock -= dt;
      if (this.fireClock <= 0) {
        this.bullets.push({ x: this.player.x, y: this.player.y - 27, damage: this.damage });
        this.fireClock += this.fireInterval;
      }
      this.spawnClock -= dt;
      if (this.spawnClock <= 0) {
        this.spawn();
        this.spawnClock += Math.max(0.3, 0.95 - (this.sector - 1) * 0.04);
      }
      for (const m of this.meteors) {
        m.oldX = m.x; m.oldY = m.y;
        m.y += m.speed * dt;
        m.x = clamp(m.x + m.drift * dt, m.radius, 360 - m.radius);
        m.angle += m.spin * dt; m.flash = Math.max(0, m.flash - dt);
      }
      for (const b of this.bullets) {
        const oldY = b.y; b.y -= 550 * dt;
        // Select the first rock crossed, regardless of array/spawn order.
        let closest = null, closestY = -Infinity;
        for (const m of this.meteors) {
          if (!m.dead && hit(b.x - m.oldX, oldY - m.oldY,
            b.x - m.x, b.y - m.y, m.radius * 0.86 + 3) && m.y > closestY) {
            closest = m; closestY = m.y;
          }
        }
        if (closest) {
          b.dead = true; closest.hp = Math.max(0, closest.hp - b.damage); closest.flash = 0.1;
          this.events.push({ type: 'hit', x: b.x, y: closest.y + closest.radius * 0.6 });
          if (closest.hp === 0) this.destroy(closest);
        }
      }
      for (const m of this.meteors) {
        if (!m.dead && hit(m.oldX - px, m.oldY - py,
          m.x - this.player.x, m.y - this.player.y, this.player.radius + m.radius * 0.8)) {
          if (this.hurt([0, 18, 28, 40][m.size])) this.destroy(m, false);
          if (this.state === 'over') break;
        }
      }
      this.bullets = this.bullets.filter(b => !b.dead && b.y > -40);
      this.meteors = this.meteors.filter(m => {
        if (m.dead) return false;
        if (m.y - m.radius > this.height) { this.passed++; return false; }
        return true;
      });
      if (this.state === 'playing') {
        for (const p of this.pickups) {
          p.age += dt;
          const dx = this.player.x - p.x, dy = this.player.y - p.y;
          const distance = Math.hypot(dx, dy);
          // XP homes in automatically after a brief burst; shield must be approached.
          const magnet = p.type === 'xp' ? p.age > 0.4 : distance < 105;
          const speed = p.type === 'xp' ? 300 : 230;
          if (magnet) {
            const t = Math.min(1, speed * dt / (distance || 1));
            p.x += dx * t; p.y += dy * t;
          } else {
            p.x += p.vx * dt; p.y += (p.vy + 28) * dt;
            p.vx *= Math.max(0, 1 - 3 * dt);
          }
          if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < 23) {
            p.dead = true;
            if (p.type === 'xp') this.addXp(p.value);
            else { this.shield = Math.min(this.maxShield, this.shield + p.value);
              this.events.push({ type: 'shield', x: this.player.x, y: this.player.y }); }
            if (this.state === 'upgrade') break;
          }
        }
      }
      this.pickups = this.pickups.filter(p => !p.dead && p.age < 18 && p.y < this.height + 40);
      this.score = Math.floor(this.time * 10) + this.passed * 10 + this.kills * 30;
    }
  }
  return { Game, hit, clamp };
});
