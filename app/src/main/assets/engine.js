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
    { id: 'capacity', name: 'CAPACIDAD DE ESCUDO', text: '+20 de escudo máximo por rango. No recarga el escudo.' },
    { id: 'reactor', name: 'REACTOR DE ESCUDO', text: 'Regenera 1 punto de escudo/s por rango, hasta el máximo disponible.' },
    { id: 'critical', name: 'SOBRECARGA', text: 'Cada quinto disparo causa daño doble. Cada rango añade otro multiplicador.' }
  ];
  const SHIPS = [
    {id:'classic',name:'PIONERA',score:0,text:'La nave original. Sin ventaja inicial.'},
    {id:'orbit',name:'ESTELAR',score:10000,text:'Una estrella orbital daña las rocas al tocarlas.'},
    {id:'critical',name:'FULGOR',score:15000,text:'Sobrecarga de rango 1 desde el despegue.'},
    {id:'diagonal',name:'TRIDENTE',score:20000,text:'Disparo diagonal de rango 1 desde el despegue.'},
    {id:'burst',name:'TEMPESTAD',score:25000,text:'Superráfaga: cadencia triple durante 10 s. Recarga: 180 s.'}
  ];
  class Game {
    constructor(random = Math.random, height = 640) {
      this.random = random; this.width = 360; this.height = height;
      this.shipId = 'classic'; this.reset(); this.state = 'ready';
    }
    reset() {
      this.player = { x: 180, y: this.height - 100, radius: 13 };
      this.target = { x: this.player.x, y: this.player.y };
      this.meteors = []; this.bullets = []; this.pickups = []; this.events = [];
      this.revived = false; this.extraRewardCycle = -1; this.extraCredit = false; this.bonusSelection = false;
      this.time = 0; this.passed = 0; this.kills = 0; this.score = 0;
      this.sector = 1; this.sectorKills = 0; this.sectorGoal = 40;
      this.parts = { cannon: 0, armor: 0, engine: 0 }; this.workshop = false; this.workshopDue = false; this.rushClock = 13;
      this.boss = null; this.enemyBullets = []; this.specialChoices = []; this.pendingSpecial = false;
      this.perks = Object.fromEntries(PERKS.map(p => [p.id, 0]));
      this.burstTime = 0; this.burstCooldown = 0; this.orbitAngle = 0;
      this.orbit = {x:this.player.x+42,y:this.player.y};
      if (['critical','diagonal'].includes(this.shipId)) this.perks[this.shipId] = 1;
      this.weaponTime = 0; this.laserActive = false; this.aegisActive = false;
      this.volleyCount = 0; this.regenClock = 0;
      this.level = 1; this.xp = 0; this.xpNext = 80;
      this.maxHealth = 100; this.health = 100; this.maxShield = 20; this.shield = 0;
      this.damage = 1; this.fireInterval = 0.38; this.fireClock = 0;
      this.invulnerable = 0; this.spawnClock = 0.6;
      this.upgrades = { rate: 0, damage: 0, health: 0 };
    }
    start(shipId = this.shipId) {
      this.shipId = SHIPS.some(s=>s.id===shipId) ? shipId : 'classic';
      this.reset(); this.state = 'playing';
    }
    revive() {
      if(this.state!=='over' || this.revived) return false;
      this.revived=true; this.health=Math.ceil(this.maxHealth*.5); this.shield=0;
      this.meteors=[];this.enemyBullets=[];this.bullets=[];this.pickups=[];
      this.player.y=this.height-100;this.target={x:this.player.x,y:this.player.y};
      this.orbit={x:this.player.x+42,y:this.player.y};
      if(this.boss && !this.boss.dead) {this.boss.y=Math.min(this.boss.y,this.player.y-290);this.boss.shotClock=4;}
      this.invulnerable=3;this.spawnClock=2;this.rushClock=Math.max(3,this.rushClock);this.state='paused';return true;
    }
    canRewardExtra() {
      return this.state==='special' && !this.workshop && !this.bonusSelection && !this.extraCredit
        && this.extraRewardCycle!==Math.floor((this.sector-1)/6);
    }
    rewardExtra() {
      if(!this.canRewardExtra())return false;
      this.extraRewardCycle=Math.floor((this.sector-1)/6);this.extraCredit=true;return true;
    }
    activateBurst() {
      if(this.state !== 'playing' || this.shipId !== 'burst' || this.burstCooldown > 0) return false;
      this.burstTime=10; this.burstCooldown=180; this.fireClock=0; return true;
    }
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
      const roll = this.random();
      // 48% small, 27% medium and 25% large.
      const radius = roll < .48 ? 13 + roll / .48 * 7 : roll < .75 ? 20 + (roll - .48) / .27 * 8 : 28 + (roll - .75) / .25 * 8;
      const size = radius < 20 ? 1 : radius < 28 ? 2 : 3;
      const hp = Math.ceil([0, 3, 6, 10][size] * (1 + (this.sector - 1) * 0.36 + (this.sector - 1) ** 2 * 0.012));
      const m = {
        x: radius + this.random() * (360 - 2 * radius), y: -radius - 4,
        radius, size, hp, maxHp: hp, flash: 0,
        speed: (size === 1 ? 115 + this.random() * 80 : 72) + Math.min(this.sector - 1, 24) * 9 + this.random() * 35,
        drift: (this.random() - 0.5) * (size === 1 ? 75 : 22),
        angle: this.random() * Math.PI * 2, spin: (this.random() - 0.5) * 0.7,
        variant: (Math.floor(this.random() * 3) + this.sector - 1) % 3
      };
      this.meteors.push(m); return m;
    }
    spawnRush() {
      const m = this.spawn();
      const edge = Math.min(2, Math.floor(this.random() * 3));
      const x = edge === 0 ? 20 + this.random() * 320 : edge === 1 ? -20 : 380;
      // Side entries are always ahead of the ship, never from below/behind it.
      const y = edge === 0 ? -20 : 20 + this.random() * Math.max(0, this.player.y - 110);
      const dx = this.player.x - x, dy = this.player.y - y;
      const distance = Math.hypot(dx, dy);
      const velocity = 540 + Math.min(230, this.sector * 15);
      Object.assign(m, { x, y, radius: 16, size: 1, hp: 3 + this.sector,
        maxHp: 3 + this.sector, speed: dy / distance * velocity,
        drift: dx / distance * velocity, rush: true });
      return m;
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
      if (this.random() < (m.rush ? .90 : .08)) this.pickups.push({ type: 'shield', x: m.x,
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
      if (this.pendingSpecial || (this.sectorKills >= this.sectorGoal && this.sector % 6 !== 0)) {
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
      if (id === 'capacity') this.maxShield += 20;
      if(this.bonusSelection) {this.bonusSelection=false;this.specialChoices=[];this.state='playing';this.checkProgress();return true;}
      this.sector++; this.sectorKills = 0; this.pendingSpecial = false;
      this.specialChoices = []; this.boss = null; this.enemyBullets = []; this.meteors = []; this.bullets = [];
      this.weaponTime = 0; this.spawnClock = 1; this.state = 'playing';
      if(this.extraCredit) {
        this.extraCredit=false;this.bonusSelection=true;this.state='special';
        const pool=PERKS.filter(p=>p.id!==id);
        for(let i=0;i<3;i++)this.specialChoices.push(pool.splice(Math.min(pool.length-1,Math.floor(this.random()*pool.length)),1)[0].id);
      }
      this.checkProgress(); return true;
    }
    spawnBoss() {
      this.meteors = []; this.bullets = [];
      // Damage sets the scale; cadence remains a real advantage rather than
      // being cancelled by current-DPS scaling. Two offensive choices open
      // the damage window. Additional investment improves the margin.
      const p = this.perks;
      const volley = (1 + (p.diagonal ? 2 * (.55 + .15 * p.diagonal) : 0) + p.wingmen) * (1 + p.critical * .2);
      const investment = this.upgrades.damage + this.upgrades.rate;
      const preparation = 1 + Math.min(2, Math.max(0, investment - 1) * .16);
      const support = p.laser * 3 * 1.2 / 7 * .38;
      const hp = Math.ceil(this.damage * (volley + support) * 95
        * (1 + Math.max(0, this.sector / 6 - 1) * .08) / preparation);
      this.boss = { x: 180, y: -90, width: 420, height: 180,
        hp, maxHp: hp, shotClock: 3, speed: Math.max(5, (this.height - 45) / 32), flash: 0 };
      this.events.push({ type: 'boss-warning', x: 180, y: 200 });
    }
    fireBoss() {
      const x=40+this.random()*280,y=this.boss.y+96;
      const dx=this.player.x-x,dy=this.player.y-y,d=Math.hypot(dx,dy)||1;
      this.enemyBullets.push({x,y,vx:dx/d*185,vy:dy/d*185});
    }
    damageBoss(amount) {
      if (!this.boss || this.boss.dead) return;
      this.boss.hp = Math.max(0, this.boss.hp - amount); this.boss.flash = .08;
      if (this.boss.hp === 0) {
        this.boss.dead = true; this.enemyBullets = []; this.kills++; this.pendingSpecial = true; this.workshopDue = true;
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
      this.burstTime = Math.max(0, this.burstTime-dt); this.burstCooldown = Math.max(0, this.burstCooldown-dt);
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
      const travel = Math.min(1, (550 + this.parts.engine * 90) * dt / (Math.hypot(dx, dy) || 1));
      this.player.x += dx * travel; this.player.y += dy * travel;
      this.fireClock -= dt;
      if (this.fireClock <= 0) {
        this.fire();
        this.fireClock += this.fireInterval / (this.burstTime > 0 ? 3 : 1);
      }
      if (!this.boss && this.sectorKills < this.sectorGoal) {
        this.rushClock -= dt;
        if (this.rushClock <= 0) {
          this.spawnRush();
          this.rushClock = 12 + this.random() * 10;
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
        m.x = m.rush ? m.x + m.drift * dt : clamp(m.x + m.drift * dt, m.radius, 360 - m.radius);
        if (m.rush) {
          if(m.x < m.radius && m.drift < 0) { m.x=2*m.radius-m.x; m.drift=-m.drift; }
          if(m.x > 360-m.radius && m.drift > 0) { m.x=2*(360-m.radius)-m.x; m.drift=-m.drift; }
          m.dustClock=(m.dustClock || 0)+dt;
          if(m.dustClock>=.03) { m.dustClock=0; this.events.push({type:'dust',x:m.x,y:m.y}); }
        }
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
      if (this.shipId === 'orbit') {
        const old=this.orbit; this.orbitAngle += dt*3;
        this.orbit={x:this.player.x+Math.cos(this.orbitAngle)*42,y:this.player.y+Math.sin(this.orbitAngle)*42};
        for(const m of this.meteors) if(!m.dead && hit(old.x-m.oldX,old.y-m.oldY,this.orbit.x-m.x,this.orbit.y-m.y,m.radius+6)) {
          m.hp=Math.max(0,m.hp-12*dt); m.flash=.08;
          if(m.hp===0) this.destroy(m);
        }
        if(this.boss && !this.boss.dead && this.orbit.y-6<=this.boss.y+90 && this.orbit.y+6>=this.boss.y-90) this.damageBoss(12*dt);
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
        this.boss.shotClock -= dt;
        if(this.boss.shotClock<=0) { this.fireBoss(); this.boss.shotClock=4.5+this.random(); }
        if (this.boss.y + 90 >= this.player.y - this.player.radius) {
          this.health = 0; this.shield = 0; this.state = 'over';
          this.events.push({ type: 'hurt', x: this.player.x, y: this.player.y, shield: false });
        }
      }
      for(const b of this.enemyBullets) {
        const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
        if(hit(ox-px,oy-py,b.x-this.player.x,b.y-this.player.y,this.player.radius+5)) {this.hurt(14);b.dead=true;}
      }
      this.enemyBullets=this.enemyBullets.filter(b=>!b.dead && b.x>-20 && b.x<380 && b.y>-20 && b.y<this.height+20);
      for (const m of this.meteors) {
        if (this.aegisActive && !m.dead && Math.hypot(m.x - this.player.x, m.y - this.player.y) <= m.radius + 40) { this.destroy(m); continue; }
        if (!m.dead && hit(m.oldX - px, m.oldY - py,
          m.x - this.player.x, m.y - this.player.y, this.player.radius + m.radius * 0.8)) {
          if (this.hurt(m.size === 1 && this.shield === 0 ? 12 : [0, 26, 39, 56][m.size])) this.destroy(m, false);
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
  return { Game, hit, clamp, PERKS, SHIPS };
});
