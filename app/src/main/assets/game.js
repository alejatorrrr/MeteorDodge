/* global MeteorEngine, MeteorSprites */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const game = new MeteorEngine.Game();
  let best = 0, storageAvailable = true;
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('meteor-dodge-best')) || 0)); }
  catch (_) { storageAvailable = false; }
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
    $('score').textContent = format(game.score);
    $('best').textContent = format(Math.max(best, game.score));
    $('sector').textContent = String(game.sector).padStart(2, '0');
    $('pilot-level').textContent = game.level;
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
    $('message').textContent = 'Cada vuelo es una nueva oportunidad.';
    $('final-score').textContent = game.score;
    $('record-message').textContent = newRecord ? '¡NUEVO RÉCORD!' : 'Récord: ' + best;
    $('results').hidden = false;
    $('action').textContent = 'VOLVER A VOLAR ↗';
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
    $('upgrade-level').textContent = game.level;
    const nextInterval = 0.1 + 0.28 * Math.pow(0.78, game.upgrades.rate + 1);
    $('rate-description').textContent = (1 / game.fireInterval).toFixed(1) + ' → ' + (1 / nextInterval).toFixed(1) + ' disparos / s';
    $('damage-description').textContent = game.damage + ' → ' + (game.damage + 1) + ' de daño por disparo';
    $('upgrade-panel').hidden = false;
    $('pause').hidden = true;
  }
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => {
    if (!game.chooseUpgrade(button.dataset.upgrade)) return;
    release(); lastTime = 0;
    if (game.state === 'upgrade') showUpgrade();
    else {
      $('upgrade-panel').hidden = true;
      $('pause').hidden = false;
      if (document.hidden) pause();
    }
    hud();
  }));
  $('action').addEventListener('click', () => {
    if (game.state === 'paused') game.resume(); else game.start();
    previousState = 'playing'; lastTime = 0; particles = []; rings = []; hitFlash = 0; release();
    $('panel').hidden = true;
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
    ctx.drawImage(MeteorSprites.ship, -23, -27, 46, 54);
    ctx.restore();
  }
  function draw(dt) {
    const h = game.height;
    ctx.fillStyle = '#060a19'; ctx.fillRect(0, 0, 360, h);
    const glow = ctx.createRadialGradient(270, h * 0.3, 0, 270, h * 0.3, 340);
    glow.addColorStop(0, '#162249'); glow.addColorStop(1, '#060a19');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, 360, h);
    for (const s of stars) {
      const y = (s.y + visualTime * 20 * s.depth) % (h + 10);
      ctx.globalAlpha = 0.25 + s.depth * 0.5 + Math.sin(visualTime + s.phase) * .1;
      ctx.fillStyle = '#b9d3ff'; ctx.fillRect(s.x, y, s.depth * 1.7, s.depth * 2.2);
    }
    ctx.globalAlpha = 1;
    for (const b of game.bullets) {
      ctx.fillStyle = '#4299a7'; ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y), 6, 15);
      ctx.fillStyle = '#c4fff4'; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y), 2, 11);
    }
    for (const m of game.meteors) {
      ctx.save(); ctx.translate(Math.round(m.x), Math.round(m.y)); ctx.rotate(m.angle);
      const cracks = m.hp === m.maxHp ? 0 : Math.min(3, Math.ceil((1 - m.hp / m.maxHp) * 3));
      ctx.drawImage(MeteorSprites.rocks[m.variant][cracks], -m.radius, -m.radius, m.radius * 2, m.radius * 2);
      if (m.flash > 0) { ctx.globalAlpha = .5; ctx.fillStyle = '#fff3bb'; ctx.fillRect(-5, -5, 10, 10); }
      ctx.restore();
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
    const effectDt = ['paused', 'upgrade'].includes(game.state) ? 0 : dt;
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
    if (!['paused', 'upgrade'].includes(game.state)) visualTime += dt;
    if (game.state === 'playing') {
      const x = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
      const y = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      if (x || y) game.move(game.target.x + x * 290 * dt, game.target.y + y * 290 * dt);
      game.step(dt);
      effects();
      if (game.state === 'over' && previousState === 'playing') end();
      if (game.state === 'upgrade') showUpgrade();
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
