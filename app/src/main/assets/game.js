/* global MeteorEngine */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const game = new MeteorEngine.Game();
  let best = 0, storageAvailable = true;
  try { best = Math.max(0, Math.floor(Number(localStorage.getItem('meteor-dodge-best')) || 0)); }
  catch (_) { storageAvailable = false; }
  let scale = 1, offsetY = 0, lastTime = 0, visualTime = 0, pointer = null;
  let lastPointer = null, particles = [], previousState = 'ready';
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
    if (game.state === 'playing') pause();
  }
  function hud() {
    $('score').textContent = format(game.score);
    $('best').textContent = format(Math.max(best, game.score));
    $('sector').textContent = String(game.level).padStart(2, '0');
    $('touch-hint').style.opacity = game.state === 'playing' && game.time < 4 ? '1' : '0';
  }
  function release() { pointer = null; lastPointer = null; keys.clear(); }
  function pause() {
    if (game.state !== 'playing') return;
    game.pause(); release();
    $('eyebrow').textContent = 'TÓMATE UN RESPIRO';
    $('title').textContent = 'PAUSA';
    $('message').textContent = 'Tu nave te espera. Continúa cuando quieras.';
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
  $('action').addEventListener('click', () => {
    if (game.state === 'paused') game.resume(); else game.start();
    previousState = 'playing'; lastTime = 0; particles = []; release();
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

  function drawShip(x, y) {
    ctx.save(); ctx.translate(x, y);
    const flame = 15 + Math.sin(visualTime * 35) * 5;
    ctx.fillStyle = '#ffb86b';
    ctx.beginPath(); ctx.moveTo(-6, 13); ctx.lineTo(0, 13 + flame); ctx.lineTo(6, 13); ctx.fill();
    ctx.shadowBlur = 16; ctx.shadowColor = '#70f4db70';
    ctx.fillStyle = '#70f4db';
    ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(19, 19); ctx.lineTo(0, 11); ctx.lineTo(-19, 19); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#5072bd';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
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
    for (const m of game.meteors) {
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.angle);
      ctx.fillStyle = '#665362'; ctx.strokeStyle = '#b89689'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      m.shape.forEach((r, i) => {
        const a = i / m.shape.length * Math.PI * 2;
        const x = Math.cos(a) * m.radius * r, y = Math.sin(a) * m.radius * r;
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#433d50';
      ctx.beginPath(); ctx.arc(-m.radius * .22, -m.radius * .12, m.radius * .22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(m.radius * .35, m.radius * .3, m.radius * .12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (game.state !== 'over') drawShip(game.player.x, game.player.y);
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * .8;
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 3, 3);
    }
    ctx.globalAlpha = 1; particles = particles.filter(p => p.life > 0);
  }
  function frame(time) {
    const dt = lastTime ? Math.min((time - lastTime) / 1000, .0333) : 0;
    lastTime = time;
    if (game.state !== 'paused') visualTime += dt;
    if (game.state === 'playing') {
      const x = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
      const y = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      if (x || y) game.move(game.target.x + x * 290 * dt, game.target.y + y * 290 * dt);
      game.step(dt);
      if (game.state === 'over' && previousState === 'playing') end();
    }
    previousState = game.state;
    draw(dt); hud();
    requestAnimationFrame(frame);
  }
  resize(); hud(); requestAnimationFrame(frame);
})();
