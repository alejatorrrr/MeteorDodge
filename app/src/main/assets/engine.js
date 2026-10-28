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
  const PERKS = [
    { id: 'diagonal', name: 'DISPARO DIAGONAL', text: 'Dos proyectiles oblicuos. Cada rango aumenta su daño.' },
    { id: 'laser', name: 'LÁSER PULSANTE', text: 'Un rayo atraviesa rocas durante 1,2 s cada 7 s. Más rangos, más daño.' },
    { id: 'rear', name: 'DISPARO TRASERO', text: 'Dispara también hacia atrás. Cada rango aumenta su daño.' },
    { id: 'aegis', name: 'ESCUDO DEMOLEDOR', text: 'Destruye rocas al contacto durante 4 s cada 20 s. +1 s por rango (máx. 12 s). No detiene al jefe.' },
    { id: 'wingmen', name: 'DRONES ESCOLTA', text: 'Dos drones añaden disparos frontales. Más rangos, más daño.' },
    { id: 'reactor', name: 'REACTOR DE ESCUDO', text: '+20 de escudo máximo, recupera 20 y regenera 1 punto/s por rango.' },
    { id: 'critical', name: 'SOBRECARGA', text: 'Cada quinto disparo causa daño doble. Cada rango añade otro multiplicador.' }
  ];
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
      this.sector = 1; this.sectorKills = 0; this.sectorGoal = 40;
      this.parts = { cannon: 0, armor: 0, engine: 0 }; this.workshop = false; this.workshopDue = false; this.rushClock = 13; this.rushWarning = null;
      this.boss = null; this.specialChoices = []; this.pendingSpecial = false;
      this.perks = Object.fromEntries(PERKS.map(p => [p.id, 0]));
      this.weaponTime = 0; this.laserActive = false; this.aegisActive = false;
      this.volleyCount = 0; this.regenClock = 0;
      this.level = 1; this.xp = 0; this.xpNext = 80;
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
      const hp = Math.ceil([0, 3, 6, 10][size] * (1 + (this.sector - 1) * 0.28));
      const m = {
        x: radius + this.random() * (360 - 2 * radius), y: -radius - 4,
        radius, size, hp, maxHp: hp, flash: 0,
        speed: (size === 1 ? 105 : 72) + Math.min(this.sector - 1, 24) * 9 + this.random() * 35,
        drift: (this.random() - 0.5) * 22,
        angle: this.random() * Math.PI * 2, spin: (this.random() - 0.5) * 0.7,
        variant: (Math.floor(this.random() * 3) + this.sector - 1) % 3
      };
      this.meteors.push(m); return m;
    }
    destroy(m, reward = true) {
      if (m.dead) return;
      m.dead = true;
      this.events.push({ type: 'explode', x: m.x, y: m.y, size: m.size, reward });
      if (!reward) return;
      this.kills++;
      this.sectorKills = Math.min(this.sectorGoal, this.sectorKills + 1);
      for (let i = 0; i < m.size; i++) {
        const angle = this.random() * Math.PI * 2;
        this.pickups.push({ type: 'xp', x: m.x, y: m.y,
          vx: Math.cos(angle) * 45, vy: Math.sin(angle) * 40, value: 1, age: 0 });
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
      this.xpNext = 80 + (this.level - 1) * 30;
      this.state = 'upgrade';
      this.target = { x: this.player.x, y: this.player.y };
    }
    chooseUpgrade(choice) {
      if (this.state !== 'upgrade' || !Object.prototype.hasOwnProperty.call(this.upgrades, choice)) return false;
      this.upgrades[choice]++;
      if (choice === 'rate') this.fireInterval = 0.14 + 0.24 * Math.pow(0.88, this.upgrades.rate);
      if (choice === 'damage') this.damage++;
      if (choice === 'health') { this.maxHealth += 25; this.health = Math.min(this.maxHealth, this.health + 25); }
      this.state = 'playing';
      this.checkProgress();
      return true;
    }
    checkProgress() {
      if (this.state !== 'playing') return;
      if (this.workshopDue) {
        this.workshop = true; this.state = 'special'; this.specialChoices = ['cannon', 'armor', 'engine']; return;
      }
      if (this.pendingSpecial || (this.sectorKills >= this.sectorGoal && this.sector % 8 !== 0)) {
        this.pendingSpecial = true;
        const pool = PERKS.slice(); this.specialChoices = [];
        for (let i = 0; i < 3; i++) this.specialChoices.push(pool.splice(Math.min(pool.length - 1, Math.floor(this.random() * pool.length)), 1)[0].id);
        this.state = 'special';
        this.target = { x: this.player.x, y: this.player.y };
      } else if (this.sectorKills >= this.sectorGoal && !this.boss) this.spawnBoss();
      if (this.state === 'playing' && this.xp >= this.xpNext) this.levelUp();
    }
    chooseSpecial(id) {
      if (this.state !== 'special' || !this.specialChoices.includes(id)) return false;
      if (this.workshop) {
        this.parts[id]++;
        if (id === 'cannon') this.damage += 2;
        if (id === 'armor') { this.maxShield += 30; this.shield = this.maxShield; }
        this.health = this.maxHealth;
        this.workshop = false; this.workshopDue = false; this.state = 'playing';
        this.checkProgress(); return true;
      }
      this.perks[id]++;
      if (id === 'reactor') { this.maxShield += 20; this.shield = Math.min(this.maxShield, this.shield + 20); }
      this.sector++; this.sectorKills = 0; this.pendingSpecial = false;
      this.specialChoices = []; this.boss = null; this.meteors = []; this.bullets = [];
      this.weaponTime = 0; this.spawnClock = 1; this.state = 'playing';
      this.checkProgress(); return true;
    }
    spawnBoss() {
      this.meteors = []; this.bullets = []; this.rushWarning = null;
      // About 30 seconds to the bottom. HP is based on current theoretical DPS,
      // leaving a margin for travel time and movement; the fight is still lethal.
      const p = this.perks;
      const volley = 1 + (p.diagonal ? 2 * (.55 + .15 * p.diagonal) : 0) + p.wingmen;
      const dps = this.damage / this.fireInterval * volley * (1 + p.critical * .2)
        + this.damage * p.laser * 3 * 1.2 / 7;
      const hp = Math.max(45, Math.ceil(dps * 20 * (1 + (this.sector / 8 - 1) * .08)));
      this.boss = { x: 180, y: -90, width: 420, height: 180,
        hp, maxHp: hp, speed: Math.max(5, (this.height - 45) / 32), flash: 0 };
      this.events.push({ type: 'boss-warning', x: 180, y: 200 });
    }
    damageBoss(amount) {
      if (!this.boss || this.boss.dead) return;
      this.boss.hp = Math.max(0, this.boss.hp - amount); this.boss.flash = .08;
      if (this.boss.hp === 0) {
        this.boss.dead = true; this.kills++; this.pendingSpecial = true; this.workshopDue = true;
        this.events.push({ type: 'explode', x: 180, y: this.boss.y + 60, size: 8, reward: true });
        this.shield = this.maxShield;
      }
    }
    fire() {
      this.volleyCount++;
      const boosted = this.perks.critical && this.volleyCount % 5 === 0;
      const damage = this.damage * (boosted ? 1 + this.perks.critical : 1);
      const add = (x, vx, vy, power) => this.bullets.push({ x, y: this.player.y - (vy < 0 ? 27 : -24), vx, vy, damage: power, boosted });
      add(this.player.x, 0, -550, damage);
      if (this.perks.diagonal) for (const sign of [-1, 1]) add(this.player.x, sign * 240, -490, damage * (.55 + .15 * this.perks.diagonal));
      if (this.perks.rear) add(this.player.x, 0, 480, damage * (.5 + .25 * this.perks.rear));
      if (this.perks.wingmen) for (const sign of [-1, 1]) add(clamp(this.player.x + sign * 28, 5, 355), 0, -550, damage * .5 * this.perks.wingmen);
    }
    drainEvents() { const events = this.events; this.events = []; return events; }
    step(seconds) {
      if (this.state !== 'playing' || !Number.isFinite(seconds) || seconds <= 0) return;
      const dt = Math.min(seconds, 0.05);
      this.time += dt; this.weaponTime += dt;
      this.laserActive = this.perks.laser > 0 && this.weaponTime % 7 < 1.2;
      this.aegisActive = this.perks.aegis > 0 && this.weaponTime % 20 < Math.min(12, 3 + this.perks.aegis);
      if (this.perks.reactor) {
        this.regenClock += dt * this.perks.reactor;
        const points = Math.floor(this.regenClock); this.regenClock -= points;
        this.shield = Math.min(this.maxShield, this.shield + points);
      }
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      const px = this.player.x, py = this.player.y;
      const dx = this.target.x - px, dy = this.target.y - py;
      const travel = Math.min(1, (640 + this.parts.engine * 90) * dt / (Math.hypot(dx, dy) || 1));
      this.player.x += dx * travel; this.player.y += dy * travel;
      this.fireClock -= dt;
      if (this.fireClock <= 0) {
        this.fire();
        this.fireClock += this.fireInterval;
      }
      if (!this.boss && this.sectorKills < this.sectorGoal) {
        this.rushClock -= dt;
        if (!this.rushWarning && this.rushClock <= 0) this.rushWarning = { x: this.player.x, time: .85 };
        if (this.rushWarning) {
          this.rushWarning.time -= dt;
          if (this.rushWarning.time <= 0) {
            const m = this.spawn(); Object.assign(m, { x: this.rushWarning.x, radius: 16, size: 1, hp: 3 + this.sector, maxHp: 3 + this.sector, speed: 420 + Math.min(180, this.sector * 12), drift: 0, rush: true });
            this.rushWarning = null; this.rushClock = 12 + this.random() * 10;
          }
        }
      }
      this.spawnClock -= dt;
      if (this.spawnClock <= 0 && !this.boss && this.sectorKills < this.sectorGoal) {
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
        const oldX = b.x, oldY = b.y;
        b.x += (b.vx || 0) * dt; b.y += (b.vy === undefined ? -550 : b.vy) * dt;
        if (this.boss && !this.boss.dead) {
          const front = this.boss.y + 90;
          if (Math.min(oldY, b.y) <= front && Math.max(oldY, b.y) >= this.boss.y - 90) {
            this.damageBoss(b.damage); b.dead = true; continue;
          }
        }
        // Select the first rock crossed, regardless of array/spawn order.
        let closest = null, closestDistance = Infinity;
        for (const m of this.meteors) {
          if (!b.dead && !m.dead && hit(oldX - m.oldX, oldY - m.oldY,
            b.x - m.x, b.y - m.y, m.radius * 0.86 + 3) && Math.hypot(m.oldX - oldX, m.oldY - oldY) < closestDistance) {
            closest = m; closestDistance = Math.hypot(m.oldX - oldX, m.oldY - oldY);
          }
        }
        if (closest) {
          b.dead = true; closest.hp = Math.max(0, closest.hp - b.damage); closest.flash = 0.1;
          this.events.push({ type: 'hit', x: b.x, y: closest.y + closest.radius * 0.6 });
          if (closest.hp === 0) this.destroy(closest);
        }
      }
      if (this.laserActive) {
        for (const m of this.meteors) if (!m.dead && m.y < this.player.y && Math.abs(m.x - this.player.x) < m.radius + 6) {
          m.hp = Math.max(0, m.hp - this.damage * this.perks.laser * 3 * dt); m.flash = .06;
          if (m.hp === 0) this.destroy(m);
        }
        if (this.boss && this.boss.y + 90 < this.player.y) this.damageBoss(this.damage * this.perks.laser * 3 * dt);
      }
      if (this.boss && !this.boss.dead) {
        this.boss.y += this.boss.speed * dt; this.boss.flash = Math.max(0, this.boss.flash - dt);
        if (this.boss.y + 90 >= this.player.y - this.player.radius) {
          this.health = 0; this.shield = 0; this.state = 'over';
          this.events.push({ type: 'hurt', x: this.player.x, y: this.player.y, shield: false });
        }
      }
      for (const m of this.meteors) {
        if (this.aegisActive && !m.dead && Math.hypot(m.x - this.player.x, m.y - this.player.y) <= m.radius + 40) { this.destroy(m); continue; }
        if (!m.dead && hit(m.oldX - px, m.oldY - py,
          m.x - this.player.x, m.y - this.player.y, this.player.radius + m.radius * 0.8)) {
          if (this.hurt(m.size === 1 && this.shield === 0 ? 7 : [0, 18, 28, 40][m.size])) this.destroy(m, false);
          if (this.state === 'over') break;
        }
      }
      this.bullets = this.bullets.filter(b => !b.dead && b.y > -40 && b.y < this.height + 40 && b.x > -40 && b.x < 400);
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
      this.checkProgress();
    }
  }
  return { Game, hit, clamp, PERKS };
});
