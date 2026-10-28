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
test('different rock sizes have 3, 6 and 10 hit points', () => {
  const small = new Game(() => 0).spawn(), mid = new Game(() => .5).spawn(), big = new Game(() => .99).spawn();
  assert.deepEqual([small.hp, mid.hp, big.hp], [3, 6, 10]);
});
test('repeated shots crack and destroy a rock exactly once', () => {
  const g = make(), m = rock(g, { hp: 2, maxHp: 2, size: 1 });
  shoot(g, m); assert.equal(m.hp, 1); assert.equal(g.kills, 0); assert.ok(m.flash > 0);
  shoot(g, m); assert.equal(g.kills, 1); assert.equal(g.meteors.length, 0);
  assert.equal(g.pickups.filter(p => p.type === 'xp').length, 1);
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
  assert.equal(g.shield, 0); assert.equal(g.health, 54);
  assert.equal(g.meteors.length, 0); assert.equal(g.pickups.length, 0); assert.equal(g.kills, 0);
});
test('XP homes toward the ship, is collected and pauses for a level choice', () => {
  const g = make(); g.xp = 78;
  g.pickups.push({ type: 'xp', x: 180, y: g.player.y - 28, vx: 0, vy: 0, value: 2, age: 1 });
  g.step(.05); assert.equal(g.state, 'upgrade'); assert.equal(g.level, 2); assert.equal(g.xp, 0);
  const time = g.time; g.step(.05); assert.equal(g.time, time);
  assert.equal(g.chooseUpgrade('bogus'), false);
  assert.equal(g.chooseUpgrade('damage'), true); assert.equal(g.damage, 2); assert.equal(g.state, 'playing');
});
test('all three upgrades work and XP overflow creates one choice per level', () => {
  const g = make(); g.addXp(200); assert.equal(g.state, 'upgrade');
  const interval = g.fireInterval; g.chooseUpgrade('rate');
  assert.ok(g.fireInterval < interval); assert.equal(g.state, 'upgrade');
  assert.equal(g.level, 3); assert.equal(g.xp, 10);
  g.health = 60; g.chooseUpgrade('health');
  assert.equal(g.maxHealth, 125); assert.equal(g.health, 85); assert.equal(g.state, 'playing');
  assert.equal(g.chooseUpgrade('health'), false);
});
test('shield drops are random, collectible and capped', () => {
  const g = new Game(() => .05); g.start(); g.spawnClock = 100;
  const m = rock(g); g.destroy(m);
  assert.equal(g.pickups.filter(p => p.type === 'shield').length, 1);
  g.pickups = [{ type: 'shield', x: g.player.x, y: g.player.y, vx: 0, vy: 0, age: 0, value: 20 }];
  g.shield = 15; g.step(.05); assert.equal(g.shield, 20); assert.equal(g.pickups.length, 0);
  const other = make(); other.destroy(rock(other));
  assert.equal(other.pickups.filter(p => p.type === 'shield').length, 0);
});
test('difficulty stays unchanged with elapsed time alone', () => {
  const g = make();
  for (let i = 0; i < 610; i++) { g.meteors = []; g.step(.05); }
  assert.equal(g.sector, 1); assert.equal(g.level, 1);
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

test('40 rewarded destructions unlock exactly three distinct special choices', () => {
  const g = make();
  for (let i = 0; i < 39; i++) g.destroy(rock(g));
  g.checkProgress(); assert.equal(g.state, 'playing'); assert.equal(g.sectorKills, 39);
  g.destroy(rock(g)); g.checkProgress();
  assert.equal(g.state, 'special'); assert.equal(g.sector, 1);
  assert.equal(g.specialChoices.length, 3); assert.equal(new Set(g.specialChoices).size, 3);
  assert.equal(g.chooseSpecial('missing'), false);
  const id = g.specialChoices[0]; assert.equal(g.chooseSpecial(id), true);
  assert.equal(g.perks[id], 1); assert.equal(g.sector, 2); assert.equal(g.sectorKills, 0);
  assert.equal(g.chooseSpecial(id), false);
});
test('unrewarded collisions and dodged rocks do not advance the sector', () => {
  const g = make(); g.destroy(rock(g), false);
  rock(g, { x: 30, y: 700 }); g.step(.05);
  assert.equal(g.sectorKills, 0); assert.equal(g.state, 'playing');
});
test('XP is much slower and harder sectors increase meteor durability', () => {
  const g = make(), a = rock(g); g.destroy(a);
  assert.equal(g.pickups.filter(p => p.type === 'xp').reduce((sum, p) => sum + p.value, 0), a.size);
  assert.equal(g.xpNext, 80);
  g.addXp(12); assert.equal(g.level, 1);
  g.sector = 5; const b = g.spawn(); assert.ok(b.hp > a.maxHp * 2);
});
test('special-choice pause freezes weapon and boss timers', () => {
  const g = make(); g.sectorKills = 40; g.checkProgress();
  const time = g.time, clock = g.weaponTime; g.step(.05);
  assert.equal(g.time, time); assert.equal(g.weaponTime, clock);
});
test('sector eight requires a boss victory before the special reward', () => {
  const g = make(); g.sector = 8; g.sectorKills = 40; g.checkProgress();
  assert.equal(g.state, 'playing'); assert.ok(g.boss); assert.equal(g.meteors.length, 0);
  const b = g.boss; g.checkProgress(); assert.equal(g.boss, b);
  assert.equal(g.chooseSpecial('laser'), false);
  g.damageBoss(b.hp); g.checkProgress(); assert.equal(g.state, 'special');
  assert.equal(g.workshop, true); g.chooseSpecial('cannon'); assert.equal(g.damage, 3); g.chooseSpecial(g.specialChoices[0]); assert.equal(g.sector, 9); assert.equal(g.boss, null);
});
test('boss spans every x position and kills through shields and invulnerability', () => {
  for (const x of [26, 180, 334]) {
    const g = make(); g.spawnBoss(); g.player.x = x; g.target.x = x;
    g.health = 999; g.shield = 999; g.invulnerable = 10; g.perks.aegis = 1;
    g.boss.y = g.player.y - 90 - g.player.radius;
    g.step(.05); assert.equal(g.state, 'over'); assert.equal(g.health, 0);
  }
});
test('boss can be shot at either side and is defeated before a lethal contact on the same frame', () => {
  const g = make(); g.spawnBoss(); g.boss.hp = 1;
  g.bullets.push({ x: 330, y: g.boss.y + 95, damage: 2 });
  g.step(.05); assert.equal(g.boss.dead, true); assert.equal(g.state, 'special');
});
test('no regular meteor spawns during the boss fight', () => {
  const g = make(); g.spawnBoss(); g.spawnClock = -100;
  for (let i = 0; i < 20; i++) g.step(.05);
  assert.equal(g.meteors.length, 0); assert.ok(g.boss.y > -90);
});
test('new weapons add diagonal, rear and drone projectiles with increasing power', () => {
  const g = make(); g.perks.diagonal = 1; g.perks.rear = 1; g.perks.wingmen = 1; g.fire();
  assert.equal(g.bullets.length, 6);
  assert.equal(g.bullets.filter(b => b.vx !== 0).length, 2);
  assert.equal(g.bullets.filter(b => b.vy > 0).length, 1);
  const damage = g.bullets.find(b => b.vx > 0).damage;
  g.perks.diagonal++; g.bullets = []; g.fire();
  assert.ok(g.bullets.find(b => b.vx > 0).damage > damage);
});
test('laser damages aligned rocks and boss; misses rocks outside the beam', () => {
  const g = make(); g.perks.laser = 1;
  const a = rock(g, { x: 180 }), b = rock(g, { x: 70 });
  g.fireClock = 100; g.step(.05);
  assert.ok(a.hp < a.maxHp); assert.equal(b.hp, b.maxHp);
  g.spawnBoss(); g.boss.y = 200; const hp = g.boss.hp;
  g.step(.05); assert.ok(g.boss.hp < hp);
});
test('demolition shield destroys nearby rocks but turns off after its active window', () => {
  const g = make(); g.perks.aegis = 1;
  rock(g, { x: g.player.x + 35, y: g.player.y });
  g.step(.05); assert.equal(g.kills, 1); assert.equal(g.health, 100);
  g.weaponTime = 5; g.step(.05); assert.equal(g.aegisActive, false);
});
test('shield reactor regenerates without exceeding the cap', () => {
  const g = make(); g.perks.reactor = 2; g.shield = 10;
  for (let i = 0; i < 21; i++) g.step(.05);
  assert.equal(g.shield, 12); g.shield = g.maxShield;
  for (let i = 0; i < 21; i++) g.step(.05);
  assert.equal(g.shield, g.maxShield);
});
test('overload boosts every fifth volley, not every shot', () => {
  const g = make(); g.perks.critical = 1;
  for (let i = 0; i < 5; i++) g.fire();
  assert.equal(g.bullets[3].damage, 1); assert.equal(g.bullets[4].damage, 2);
});
test('a pending XP upgrade survives a sector-special choice', () => {
  const g = make(); g.sectorKills = 40; g.checkProgress();
  g.addXp(80); g.chooseSpecial(g.specialChoices[0]);
  assert.equal(g.sector, 2); assert.equal(g.state, 'upgrade'); assert.equal(g.level, 2);
});
test('first boss defeats underprepared basic ships, but two offensive upgrades allow victory', () => {
  for (const height of [480, 640, 850]) {
    for(const choices of [[],['rate'],['damage'],['rate','rate'],['damage','damage'],['rate','damage']]) {
      const g=new Game(()=>.5,height);g.start();
      for(const choice of choices){g.state='upgrade';g.chooseUpgrade(choice);}
      g.player.y=height-38;g.target={...g.player};g.sector=8;g.sectorKills=40;g.spawnBoss();
      for(let i=0;i<900 && g.state==='playing';i++)g.step(.05);
      assert.equal(Boolean(g.boss.dead),choices.length>=2,`height ${height}, upgrades ${choices}`);
      if(choices.length<2)assert.equal(g.state,'over');
    }
  }
});
test('shield starts empty and capacity is a selectable sector reward without a free refill',()=>{
 const g=make();assert.equal(g.shield,0);assert.equal(g.maxShield,20);
 g.state='special';g.specialChoices=['capacity'];g.chooseSpecial('capacity');
 assert.equal(g.maxShield,40);assert.equal(g.shield,0);assert.equal(g.perks.capacity,1);
 g.state='special';g.specialChoices=['reactor'];g.chooseSpecial('reactor');assert.equal(g.maxShield,40);
});
test('shield loot probability is ten percent and small meteor frequency is 42 percent',()=>{
 let drops=0,small=0;
 for(let i=0;i<100;i++){
  const g=make();g.random=()=>(i+.5)/100;const m=g.spawn();if(m.size===1)small++;
  g.destroy(m);drops+=g.pickups.filter(p=>p.type==='shield').length;
 }
 assert.equal(drops,10);assert.equal(small,42);
});

test('small rocks deal reduced health damage only when shields are empty', () => {
 for(const [shield,health] of [[0,91],[30,100],[5,84]]) {const g=make();g.shield=shield;rock(g,{x:g.player.x,y:g.player.y,size:1});g.step(.05);assert.equal(g.health,health);}
});
test('rush meteors arrive without warning, faster, and pause freezes their timer', () => {
 const g=make();g.rushClock=.1;g.pause();g.step(.05);assert.equal(g.rushClock,.1);
 g.resume();g.step(.05);g.step(.05);const m=g.meteors.find(m=>m.rush);
 assert.ok(m);assert.ok(Math.hypot(m.speed,m.drift)>490);assert.equal(g.rushWarning,undefined);
});
test('rush trajectories enter from top, left and right, never behind; travel is straight', () => {
 for(const value of [.1,.5,.9]) {
  const g=make();g.random=()=>value;const m=g.spawnRush();
  assert.ok(m.y<g.player.y);assert.ok(m.speed>0);
  if(value===.1) assert.equal(m.y,-20);
  if(value===.5) assert.equal(m.x,-20);
  if(value===.9) assert.equal(m.x,380);
  const x=m.x,y=m.y,vx=m.drift,vy=m.speed;g.spawnClock=100;g.rushClock=100;g.fireClock=100;
  g.move(26,200);g.step(.05);
  assert.equal(m.x,x+vx*.05);assert.equal(m.y,y+vy*.05);
 }
});
test('rush meteors bounce on either side, emit dust and leave only at the bottom', () => {
 for(const sign of [-1,1]) {
  const g=make();const m=g.spawnRush();Object.assign(m,{x:sign<0?-45:405,y:250,drift:sign*500,speed:10});
  g.step(.05);assert.ok(g.meteors.includes(m));assert.equal(Math.sign(m.drift),-sign);assert.ok(m.x>=m.radius && m.x<=360-m.radius);assert.equal(g.passed,0);assert.ok(g.events.some(e=>e.type==='dust'));m.y=g.height+40;g.step(.05);assert.ok(!g.meteors.includes(m));assert.equal(g.passed,1);
 }
});

test('boss parts install once, repair and retain stats across sectors', () => {
 const g=make();g.sector=8;g.sectorKills=40;g.spawnBoss();g.damageBoss(g.boss.hp);g.checkProgress();g.health=10;
 assert.equal(g.workshop,true);g.chooseSpecial('armor');assert.equal(g.maxShield,50);assert.equal(g.health,100);assert.equal(g.parts.armor,1);assert.equal(g.workshop,false);
 g.chooseSpecial(g.specialChoices[0]);assert.equal(g.parts.armor,1);g.start();assert.equal(g.parts.armor,0);
});

test('ship perks reset once per run and do not leak into other ships',()=>{
 const g=make();g.start('critical');assert.equal(g.perks.critical,1);g.perks.critical=4;g.start();assert.equal(g.perks.critical,1);
 g.start('diagonal');assert.equal(g.perks.diagonal,1);assert.equal(g.perks.critical,0);g.fire();assert.equal(g.bullets.length,3);
 g.start('classic');assert.equal(g.perks.diagonal,0);assert.equal(g.burstTime,0);
});
test('superburst lasts ten seconds, triples firing and freezes cooldown when paused',()=>{
 const g=make();assert.equal(g.activateBurst(),false);g.start('burst');g.spawnClock=999;g.rushClock=999;
 assert.equal(g.activateBurst(),true);assert.equal(g.activateBurst(),false);
 for(let i=0;i<20;i++)g.step(.05);assert.ok(g.volleyCount>=8);assert.ok(g.burstTime<9.01);
 g.pause();const remaining=g.burstCooldown;g.step(.05);assert.equal(g.burstCooldown,remaining);g.resume();
 for(let i=0;i<201;i++)g.step(.05);assert.equal(g.burstTime,0);assert.ok(g.burstCooldown>160);
 g.burstCooldown=.01;g.step(.05);assert.equal(g.activateBurst(),true);
});
test('orbital star damages nearby rocks without hurting distant rocks',()=>{
 const g=make();g.start('orbit');g.spawnClock=999;g.fireClock=999;
 const near=rock(g,{x:g.player.x+42,y:g.player.y,radius:13,hp:10,maxHp:10});
 const far=rock(g,{x:30,y:200,hp:10,maxHp:10});g.step(.05);assert.ok(near.hp<10);assert.equal(far.hp,10);assert.equal(g.health,100);
});
test('late sector rock durability grows faster and small meteor speeds vary',()=>{
 const g=make();g.random=()=>.1;const early=g.spawn();g.sector=20;const late=g.spawn();assert.ok(late.hp>early.hp*10);
 g.sector=1;const speeds=new Set();for(let i=0;i<10;i++){let n=0;g.random=()=>++n===1?.1:i/10;speeds.add(g.spawn().speed);}assert.ok(speeds.size>5);
});
