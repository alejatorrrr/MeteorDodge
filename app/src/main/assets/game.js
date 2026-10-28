/* global MeteorEngine, MeteorSprites */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const game = new MeteorEngine.Game();
  let best = 0, storageAvailable = true;
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('meteor-dodge-best')) || 0)); }
  catch (_) { storageAvailable = false; }
  let selectedShip='classic', unlockBest=best;
  try { unlockBest=Math.max(best,Number(localStorage.getItem('meteor-unlock-best'))||0); selectedShip=localStorage.getItem('meteor-ship')||'classic'; } catch (_) {}
  if(!MeteorEngine.SHIPS.some(s=>s.id===selectedShip && s.score<=unlockBest)) selectedShip='classic';
  function shipSelection() {
    $('ship-options').replaceChildren();
    for(const ship of MeteorEngine.SHIPS) {
      const button=document.createElement('button'); button.className='ship-choice'; button.dataset.ship=ship.id;
      button.disabled=ship.score>unlockBest; button.setAttribute('aria-pressed',String(ship.id===selectedShip));
      const preview=document.createElement('canvas'); preview.width=46;preview.height=54;preview.className='fleet-preview'; preview.setAttribute('aria-hidden','true');
      const c=preview.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(MeteorSprites.ships[ship.id],0,0,46,54);
      const label=document.createElement('span');label.textContent=ship.name+' · '+(button.disabled?ship.score+' PUNTOS':ship.id===selectedShip?'SELECCIONADA':'ELEGIR');
      const desc=document.createElement('small');desc.textContent=ship.text;
      label.append(desc);button.append(preview,label);
      button.addEventListener('click',()=>{selectedShip=ship.id;try{localStorage.setItem('meteor-ship',selectedShip);}catch(_){}shipSelection();});
      $('ship-options').append(button);
    }
  }
  $('fleet-toggle').addEventListener('click',()=>{ $('fleet').hidden=!$('fleet').hidden;shipSelection(); });
  $('burst').addEventListener('click',()=>game.activateBurst());
  let scale = 1, offsetY = 0, lastTime = 0, visualTime = 0, pointer = null;
  let lastPointer = null, particles = [], rings = [], previousState = 'ready', hitFlash = 0;
  const keys = new Set();
  const stars = Array.from({ length: 85 }, () => ({
    x: Math.random() * 360, y: Math.random() * 1000,
    depth: 0.2 + Math.random() * 0.8, phase: Math.random() * 6.28
  }));
  const format = n => String(n).padStart(4, '0');
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    scale = rect.width / 360;
    game.resize(Math.max(480, rect.height / scale));
    offsetY = (rect.height - game.height * scale) / 2;
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, offsetY * dpr);
    ctx.imageSmoothingEnabled = false;
    if (game.state === 'playing') pause();
  }
  function hud() {
    $('stage').dataset.screen = game.state;
    if(game.score>unlockBest) {
      const before=unlockBest; unlockBest=game.score;
      if(MeteorEngine.SHIPS.some(s=>s.score>before && s.score<=unlockBest)) {
        try{localStorage.setItem('meteor-unlock-best',String(unlockBest));}catch(_){}
      }
    }
    $('burst').hidden=game.shipId!=='burst' || game.state!=='playing';
    $('burst').disabled=game.burstCooldown>0;
    $('burst').textContent=game.burstTime>0 ? 'RÁFAGA '+Math.ceil(game.burstTime)+' s' : game.burstCooldown>0 ? 'RECARGA '+Math.ceil(game.burstCooldown)+' s' : 'SUPERRÁFAGA';
    $('score').textContent = format(game.score);
    $('best').textContent = format(Math.max(best, game.score));
    $('sector').textContent = String(game.sector).padStart(2, '0');
    $('pilot-level').textContent = game.level;
    $('sector-count').textContent = game.sectorKills + ' / ' + game.sectorGoal;
    $('biome').textContent = MeteorSprites.themes[(game.sector - 1) % 6].name;
    $('boss-hud').hidden = !game.boss || game.boss.dead;
    if (game.boss) { $('boss-bar').max = game.boss.maxHp; $('boss-bar').value = game.boss.hp; }
    const perks = MeteorEngine.PERKS.filter(p => game.perks[p.id]);
    $('perk-status').textContent = perks.map(p => p.name + ' ' + game.perks[p.id]).join(' · ');
    for (const [name, value, max] of [['health', game.health, game.maxHealth], ['shield', game.shield, game.maxShield], ['xp', game.xp, game.xpNext]]) {
      $(name + '-bar').max = max; $(name + '-bar').value = value;
      $(name + '-text').textContent = value + ' / ' + max;
    }
    $('touch-hint').style.opacity = game.state === 'playing' && game.time < 4 ? '1' : '0';
  }
  function release() { pointer = null; lastPointer = null; keys.clear(); }
  function pause() {
    if (game.state !== 'playing') return;
    game.pause(); release();
    $('eyebrow').textContent = 'TÓMATE UN RESPIRO';
    $('title').textContent = 'PAUSA';
    $('message').textContent = 'Tu nave te espera. Continúa cuando quieras.';
    $('ship-preview').hidden = true;
    $('results').hidden = true;
    $('action').textContent = 'CONTINUAR ↗';
    $('hint').textContent = 'La partida se pausa al salir de la aplicación.';
    $('panel').hidden = false;
    $('pause').hidden = true;
  }
  function end() {
    const newRecord = game.score > best;
    best = Math.max(best, game.score);
    try { localStorage.setItem('meteor-dodge-best', String(best)); }
    catch (_) { storageAvailable = false; }
    release();
    $('ship-preview').hidden = true;
    $('eyebrow').textContent = 'MISIÓN TERMINADA';
    $('title').textContent = 'GAME OVER';
    $('message').textContent = 'FIN DE LA MISIÓN. TU PRÓXIMO VUELO TE ESPERA.';
    $('final-score').textContent = game.score;
    $('record-message').textContent = newRecord ? '¡NUEVO RÉCORD!' : 'Récord: ' + best;
    $('results').hidden = false;
    $('action').textContent = 'REINTENTAR';
    $('main-menu').hidden = false;
    $('hint').textContent = storageAvailable ? 'Tu récord se guarda en este dispositivo.' : 'El almacenamiento no está disponible: récord solo en esta sesión.';
    $('panel').hidden = false;
    $('pause').hidden = true;
    for (let i = 0; i < 35; i++) {
      const a = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 180;
      particles.push({ x: game.player.x, y: game.player.y, vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed, life: 1, color: i % 2 ? '#70f4db' : '#ffb86b' });
    }
  }
  function showUpgrade() {
    release();
    $('special-panel').hidden = true;
    $('upgrade-level').textContent = game.level;
    const nextInterval = 0.14 + 0.24 * Math.pow(0.88, game.upgrades.rate + 1);
    $('rate-description').textContent = (1 / game.fireInterval).toFixed(1) + ' → ' + (1 / nextInterval).toFixed(1) + ' disparos / s';
    $('damage-description').textContent = game.damage + ' → ' + (game.damage + 1) + ' de daño por disparo';
    for (const button of document.querySelectorAll('[data-upgrade]')) {
      const rank = game.upgrades[button.dataset.upgrade];
      button.querySelector('.attribute-rank').textContent = 'RANGO ' + rank + ' → ' + (rank + 1);
      button.querySelectorAll('.attribute-meter i').forEach((pip, i) => { pip.className = i < Math.min(rank, 9) ? 'filled' : i === Math.min(rank, 9) ? 'next' : ''; });
    }
    $('upgrade-panel').hidden = false;
    $('pause').hidden = true;
  }
  function showSpecial() {
    release(); $('upgrade-panel').hidden = true; $('pause').hidden = true;
    $('special-subtitle').textContent = 'Sector ' + game.sector + ' superado. Elige para entrar en el ' + (game.sector + 1) + '.';
    $('workshop-art').hidden = !game.workshop;
    $('special-panel').classList.toggle('workshop', game.workshop);
    $('special-title').textContent = game.workshop ? 'TALLER ESPACIAL' : 'VENTAJA ESPECIAL';
    if (game.workshop) $('special-subtitle').textContent = 'Botín del jefe: elige una pieza para instalar. Reparación de vida incluida.';
    $('special-options').replaceChildren();
    for (const id of game.specialChoices) {
      const perk = game.workshop ? { name: {cannon:'CAÑONES DE PLASMA',armor:'ALAS BLINDADAS',engine:'MOTORES IÓNICOS'}[id], text: {cannon:'+2 de daño. Instala cañones laterales.',armor:'+30 de escudo máximo y recarga. Cambia las alas.',engine:'+90 de velocidad de respuesta y +45 de velocidad con teclado. Nuevos propulsores.'}[id] } : MeteorEngine.PERKS.find(p => p.id === id);
      const button = document.createElement('button'); button.className = 'upgrade-option'; button.dataset.special = id;
      const icon = MeteorIcons.create(id); icon.classList.add('upgrade-icon');
      const text = document.createElement('span'), title = document.createElement('strong'), desc = document.createElement('small');
      title.textContent = perk.name + ' · RANGO ' + ((game.workshop ? game.parts[id] : game.perks[id]) + 1); desc.textContent = perk.text;
      text.append(title, desc); button.append(icon, text);
      button.addEventListener('click', () => {
        if (!game.chooseSpecial(id)) return;
        $('special-panel').hidden = true; lastTime = 0; release();
        if (game.state === 'special') showSpecial();
        else if (game.state === 'upgrade') showUpgrade();
        else { $('pause').hidden = false; if (document.hidden) pause(); }
        hud();
      });
      $('special-options').append(button);
    }
    $('special-panel').hidden = false;
  }
  document.querySelectorAll('[data-upgrade]').forEach(button => {
    button.querySelector('.upgrade-icon').replaceWith(MeteorIcons.create(button.dataset.upgrade));
    const meter = document.createElement('span'); meter.className = 'attribute-meter'; meter.setAttribute('aria-hidden', 'true');
    for (let i=0;i<10;i++) meter.append(document.createElement('i'));
    const rank = document.createElement('small'); rank.className = 'attribute-rank';
    button.children[1].append(meter, rank);
  });
  $('main-menu').addEventListener('click', () => {
    game.reset(); game.state = 'ready'; previousState = 'ready'; release(); particles=[]; rings=[];
    $('title').textContent = 'METEOR DODGE'; $('eyebrow').textContent = 'ARCADE ESPACIAL';
    $('message').textContent = 'Arrastra para pilotar. Tu nave dispara sola. Cada 40 rocas, un nuevo sector.';
    $('action').textContent = 'PULSA PARA DESPEGAR'; $('results').hidden = true; $('main-menu').hidden = true;
    $('hint').textContent = 'Sin conexión · Sin anuncios · Solo reflejos'; hud();
  });
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    if (!game.chooseUpgrade(button.dataset.upgrade)) return;
    release(); lastTime = 0;
    if (game.state === 'upgrade') showUpgrade();
    else if (game.state === 'special') { $('upgrade-panel').hidden = true; showSpecial(); }
    else {
      $('upgrade-panel').hidden = true;
      $('pause').hidden = false;
      if (document.hidden) pause();
    }
    hud();
  }));
  $('action').addEventListener('click', () => {
    $('fleet').hidden = true;
    $('main-menu').hidden = true;
    if (game.state === 'paused') game.resume(); else game.start(selectedShip);
    previousState = 'playing'; lastTime = 0; particles = []; rings = []; hitFlash = 0; release();
    $('panel').hidden = true;
    $('special-panel').hidden = true; $('upgrade-panel').hidden = true;
    $('pause').hidden = false;
    hud();
  });
  $('pause').addEventListener('click', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('blur', pause);
  window.addEventListener('app-pause', pause);
  window.addEventListener('resize', resize);

  function position(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top - offsetY) / scale };
  }
  canvas.addEventListener('pointerdown', e => {
    if (game.state !== 'playing' || pointer !== null) return;
    e.preventDefault(); pointer = e.pointerId;
    lastPointer = position(e);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== pointer || game.state !== 'playing') return;
    e.preventDefault();
    const p = position(e);
    game.move(game.target.x + p.x - lastPointer.x, game.target.y + p.y - lastPointer.y);
    lastPointer = p;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, e => { if (e.pointerId === pointer) release(); });
  }
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
    if (e.key === 'Escape' || e.key === ' ') { pause(); return; }
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  function burst(x, y, count, colors, force = 130) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, speed = 25 + Math.random() * force;
      particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        life: 0.6 + Math.random() * 0.4, color: colors[i % colors.length], size: 2 + Math.floor(Math.random() * 4) });
    }
    if (particles.length > 350) particles.splice(0, particles.length - 350);
  }
  function effects() {
    for (const e of game.drainEvents()) {
      if (e.type === 'explode') {
        burst(e.x, e.y, e.size * 10, ['#aaa18a', '#676b5e', '#ffbf75', '#df694f']);
        rings.push({ x: e.x, y: e.y, life: .4, max: .4, radius: e.size * 12, color: '#ffb86b' });
      } else if (e.type === 'hit') burst(e.x, e.y, 4, ['#ffe5ac', '#ff9366'], 65);
      else if (e.type === 'dust') { for(let i=0;i<3;i++) particles.push({x:e.x+(Math.random()-.5)*14,y:e.y+(Math.random()-.5)*14,vx:(Math.random()-.5)*18,vy:(Math.random()-.5)*18,life:.35+Math.random()*.3,color:i%2?'#86dbff':'#ffdc9a',size:1+Math.floor(Math.random()*2)}); }
      else if (e.type === 'hurt') {
        hitFlash = .2;
        burst(e.x, e.y, 16, e.shield ? ['#65cfff', '#d3f6ff'] : ['#ff7a87', '#ffb86b']);
      } else if (e.type === 'shield') rings.push({ x: e.x, y: e.y, life: .5, max: .5, radius: 30, color: '#65cfff' });
    }
  }
  function drawShip(x, y) {
    if (game.invulnerable > 0 && Math.floor(game.invulnerable * 12) % 2) return;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (game.shield > 0) {
      ctx.strokeStyle = '#65cfff'; ctx.globalAlpha = .2 + .35 * game.shield / game.maxShield;
      ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const a = i / 8 * Math.PI * 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 32);
        else ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 32);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    const flame = Math.floor(visualTime * 18) % 3;
    ctx.fillStyle = '#ed6933'; ctx.fillRect(-5, 21, 10, 8 + flame * 3);
    ctx.fillStyle = '#ffdb69'; ctx.fillRect(-2, 21, 4, 5 + flame * 2);
    ctx.drawImage(MeteorSprites.ships[game.shipId], -23, -27, 46, 54);
    if (game.parts.cannon) { ctx.fillStyle = '#c3edff'; ctx.fillRect(-18,-22,5,22); ctx.fillRect(13,-22,5,22); ctx.fillStyle='#eaa7ff'; ctx.fillRect(-17,-24,3,5); ctx.fillRect(14,-24,3,5); }
    if (game.parts.armor) { ctx.fillStyle='#55d4c8'; ctx.fillRect(-25,0,9,16); ctx.fillRect(16,0,9,16); ctx.fillStyle='#d5fff2'; ctx.fillRect(-25,0,9,3); ctx.fillRect(16,0,9,3); }
    if (game.parts.engine) { ctx.fillStyle='#4478c4'; ctx.fillRect(-16,14,7,13); ctx.fillRect(9,14,7,13); ctx.fillStyle='#aef6ff'; ctx.fillRect(-14,27,3,8+flame*2); ctx.fillRect(11,27,3,8+flame*2); }
    ctx.restore();
  }
  function draw(dt) {
    const h = game.height;
    const theme = MeteorSprites.themes[(game.sector - 1) % 6];
    ctx.fillStyle = theme.base; ctx.fillRect(0, 0, 360, h);
    const glow = ctx.createRadialGradient(270, h * 0.3, 0, 270, h * 0.3, 340);
    glow.addColorStop(0, theme.glow); glow.addColorStop(1, theme.base);
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 360, h);
    // Distant pixel planet: cached once and tinted by sector, behind all hazards.
    ctx.save(); ctx.globalAlpha = .5;
    const planetY = game.state === 'ready' ? h * .26 : h * .25 + Math.sin(visualTime * .03) * 16;
    ctx.drawImage(MeteorSprites.planet, 250, planetY, 190, 190);
    ctx.globalAlpha = .10; ctx.fillStyle = theme.glow;
    for (let i = 0; i < 10; i++) ctx.fillRect(24 + (i * 67) % 340, (i * 99 + visualTime * 4) % h, 30 + i * 5, 3);
    ctx.restore();
    for (const s of stars) {
      const y = (s.y + visualTime * 20 * s.depth) % (h + 10);
      ctx.globalAlpha = 0.25 + s.depth * 0.5 + Math.sin(visualTime + s.phase) * .1;
      const x = Math.floor(s.x / 2) * 2, sy = Math.floor(y / 2) * 2;
      ctx.fillStyle = s.depth > .85 ? '#c9faff' : '#3979d9'; ctx.fillRect(x, sy, 2, 2);
      if (s.depth > .94) {
        ctx.fillStyle = '#1646a5'; ctx.fillRect(x - 5, sy, 12, 2); ctx.fillRect(x, sy - 5, 2, 12);
        ctx.fillStyle = '#4ee7ff'; ctx.fillRect(x - 2, sy, 6, 2); ctx.fillRect(x, sy - 2, 2, 6);
        ctx.fillStyle = '#f1fcff'; ctx.fillRect(x, sy, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
    if (game.laserActive) {
      ctx.fillStyle = '#d379ff55'; ctx.fillRect(game.player.x - 9, 145, 18, Math.max(0, game.player.y - 170));
      ctx.fillStyle = '#f4dcff'; ctx.fillRect(game.player.x - 2, 145, 4, Math.max(0, game.player.y - 170));
    }
    if (game.aegisActive) {
      ctx.strokeStyle = '#ffcd6f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(game.player.x, game.player.y, 40, 0, Math.PI * 2); ctx.stroke();
    }
    if (game.perks.wingmen) for (const sign of [-1, 1]) {
      ctx.fillStyle = '#b2d8de'; ctx.fillRect(game.player.x + sign * 28 - 4, game.player.y - 8, 8, 14);
      ctx.fillStyle = '#ffba67'; ctx.fillRect(game.player.x + sign * 28 - 2, game.player.y + 6, 4, 5);
    }
    for (const b of game.bullets) {
      ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y)); ctx.rotate(Math.atan2(b.vx || 0, -(b.vy === undefined ? -550 : b.vy)));
      ctx.fillStyle = b.boosted ? '#ffc578' : '#4299a7'; ctx.fillRect(-3, 0, 6, 15);
      ctx.fillStyle = '#c4fff4'; ctx.fillRect(-1, 0, 2, 11); ctx.restore();
    }
    if (game.boss && !game.boss.dead) {
      const b = game.boss, top = b.y - 90;
      ctx.fillStyle = '#27212c'; ctx.fillRect(-20, top, 400, 180);
      ctx.fillStyle = theme.rock; ctx.fillRect(-16, top + 5, 392, 166);
      for (let i = 0; i < 11; i++) {
        const x = i * 36 + 5, y = top + 25 + (i % 3) * 36;
        ctx.fillStyle = '#171b27'; ctx.fillRect(x, y, 25, 18);
        ctx.fillStyle = '#ffffff22'; ctx.fillRect(x, y + 18, 25, 3);
        ctx.fillStyle = '#211a26'; ctx.fillRect(x + 6, y - 14, 4, 16);
      }
      const damage = 1 - b.hp / b.maxHp;
      ctx.strokeStyle = '#ff9366'; ctx.lineWidth = 3;
      for (let i = 0; i < Math.ceil(damage * 9); i++) {
        const x = 25 + i * 37; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - 12, top + 65); ctx.lineTo(x + 9, top + 110); ctx.lineTo(x, top + 180); ctx.stroke();
      }
      ctx.fillStyle = '#ff667d'; ctx.fillRect(0, top + 177, 360, 3);
      if (b.flash > 0) { ctx.fillStyle = '#fff0be33'; ctx.fillRect(0, top, 360, 175); }
    }
    for (const m of game.meteors) {
      ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.rotate(m.angle);
      const cracks = m.hp === m.maxHp ? 0 : Math.min(3, Math.ceil((1 - m.hp / m.maxHp) * 3));
      ctx.drawImage(MeteorSprites.themedRocks[(game.sector - 1) % 6][m.variant][cracks], -m.radius, -m.radius, m.radius * 2, m.radius * 2);
      if (m.flash > 0) { ctx.globalAlpha = .5; ctx.fillStyle = '#fff3bb'; ctx.fillRect(-5, -5, 10, 10); }
      ctx.restore();
    }
    for(const b of game.enemyBullets) {
      ctx.fillStyle='#8e2549';ctx.fillRect(Math.round(b.x)-7,Math.round(b.y)-7,14,14);
      ctx.fillStyle='#ff7657';ctx.fillRect(Math.round(b.x)-4,Math.round(b.y)-5,8,10);
      ctx.fillStyle='#fff3ac';ctx.fillRect(Math.round(b.x)-2,Math.round(b.y)-3,4,6);
    }
    for (const p of game.pickups) {
      ctx.save(); ctx.translate(Math.round(p.x), Math.round(p.y));
      if (p.type === 'xp') {
        ctx.fillStyle = '#6335a6'; ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = '#c58aff'; ctx.fillRect(-2, -3, 4, 6);
        ctx.fillStyle = '#edd4ff'; ctx.fillRect(-2, -3, 2, 2);
      } else {
        ctx.fillStyle = '#173e68'; ctx.fillRect(-8, -8, 16, 16);
        ctx.fillStyle = '#65cfff'; ctx.fillRect(-5, -5, 10, 8); ctx.fillRect(-3, 3, 6, 3);
        ctx.fillStyle = '#e1faff'; ctx.fillRect(-1, -4, 2, 7); ctx.fillRect(-3, -2, 6, 2);
      }
      ctx.restore();
    }
    if (game.state !== 'over') drawShip(game.player.x, game.player.y);
    if(game.shipId==='orbit') { const o=game.orbit; ctx.fillStyle='#ffcf60';ctx.fillRect(Math.round(o.x)-6,Math.round(o.y)-2,12,4);ctx.fillRect(Math.round(o.x)-2,Math.round(o.y)-6,4,12);ctx.fillStyle='#fff5cb';ctx.fillRect(Math.round(o.x)-2,Math.round(o.y)-2,4,4); }
    const effectDt = ['paused', 'upgrade', 'special'].includes(game.state) ? 0 : dt;
    for (const p of particles) {
      p.x += p.vx * effectDt; p.y += p.vy * effectDt; p.life -= effectDt * 1.4;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size || 3, p.size || 3);
    }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0);
    for (const r of rings) {
      r.life -= effectDt; ctx.globalAlpha = Math.max(0, r.life / r.max);
      ctx.strokeStyle = r.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.radius * (2 - r.life / r.max), 0, Math.PI * 2); ctx.stroke();
    }
    rings = rings.filter(r => r.life > 0); ctx.globalAlpha = 1;
    hitFlash = Math.max(0, hitFlash - effectDt);
    if (hitFlash > 0) { ctx.fillStyle = 'rgba(255, 100, 130, ' + hitFlash + ')'; ctx.fillRect(0, 0, 360, h); }
  }
  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .0333) : 0;
    lastTime = time;
    if (!['paused', 'upgrade', 'special'].includes(game.state)) visualTime += dt;
    if (game.state === 'playing') {
      const x = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
      const y = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      if (x || y) game.move(game.target.x + x * (250 + game.parts.engine * 45) * dt, game.target.y + y * (250 + game.parts.engine * 45) * dt);
      game.step(dt);
      effects();
      if (game.state === 'over' && previousState === 'playing') end();
      if (game.state === 'upgrade') showUpgrade();
      if (game.state === 'special') showSpecial();
    }
    previousState = game.state;
    draw(dt); hud();
    requestAnimationFrame(frame);
  }
  const preview = $('ship-preview').getContext('2d');
  preview.imageSmoothingEnabled = false;
  preview.drawImage(MeteorSprites.ship, 0, 0, 92, 108);
  resize(); hud(); requestAnimationFrame(frame);
})();
