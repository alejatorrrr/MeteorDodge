/* Original pixel sprites inspired by the supplied references. */
(() => {
  'use strict';
  const palette = { k: '#101421', w: '#eef7ee', s: '#a5bbc6', g: '#617584',
    b: '#328fc2', c: '#87e9ff', r: '#ee4c4c', d: '#962735', y: '#ffcf5b' };
  const rows = [
    '...........k...........', '..........kwk..........', '..........kwk..........',
    '.........kwswk.........', '.........kwbwk.........', '........kwbcbwk........',
    '........kwbcbwk........', '.......kkwbcbwkk.......', '......krkwbbbwkrk......',
    '......krkwssswkrk......', '.....krrkwssswkrrk.....', '.....krrkwssswkrrk.....',
    '....krrrkwssswkrrrk....', '...kwrrrkwssswkrrrwk...', '...krrrrkwssswkrrrrk...',
    '..kwrrrrkwssswkrrrrwk..', '.kwrrrrrkwsgswkrrrrrwk.', 'kwwrrrrrkwsgswkrrrrrwwk',
    'kkbbccrrkwsgswkrrccbbkk', '..kkbbcckwsgswkccbbkk..', '....kkkkkwsgswkkkkk....',
    '.....krdkwgggwkdrk.....', '....krrdkkkkkkkdrrk....', '....kkkk.kyyyk.kkkk....',
    '.........kyyyk.........', '..........kyk..........', '...........k...........'
  ];
  const ship = document.createElement('canvas'); ship.width = 23; ship.height = rows.length;
  const sctx = ship.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (palette[c]) { sctx.fillStyle = palette[c]; sctx.fillRect(x, y, 1, 1); }
  }));
  const rocks = [];
  for (let variant = 0; variant < 3; variant++) {
    rocks[variant] = [];
    for (let damage = 0; damage < 4; damage++) {
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
      const c = sprite.getContext('2d'); const mask = [];
      for (let y = 0; y < 32; y++) {
        mask[y] = [];
        for (let x = 0; x < 32; x++) {
          const dx = x - 15.5, dy = y - 15.5, a = Math.atan2(dy, dx);
          mask[y][x] = Math.hypot(dx, dy) < 14 + Math.sin(a * (5 + variant) + variant) * 1.1 + Math.cos(a * 9) * .65;
        }
      }
      const colors = ['#343a45', '#60616a', '#8c8b82', '#b5ae96', '#f2e1b6'];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        if (!mask[y][x]) continue;
        const edge = !mask[y - 1]?.[x] || !mask[y + 1]?.[x] || !mask[y][x - 1] || !mask[y][x + 1];
        const noise = ((x * 17 + y * 31 + variant * 13) % 19) / 19;
        const light = Math.max(0, Math.min(4, Math.floor(4 - (x + y) / 16 + noise * 1.1)));
        c.fillStyle = edge ? (x + y < 29 ? '#56c9ef' : '#151b33') : colors[light]; c.fillRect(x, y, 1, 1);
      }
      for (const [cx, cy, r] of [[10 + variant, 9, 4], [22, 18 - variant, 5], [10, 23, 3], [22, 6, 2]]) {
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r || !mask[cy + y]?.[cx + x]) continue;
          c.fillStyle = y > r - 2 ? '#e9d8b5' : y < -r + 2 ? '#252a3a' : '#42464a';
          c.fillRect(cx + x, cy + y, 1, 1);
        }
      }
      // Increasingly deep branching cracks, drawn in whole pixels.
      const branches = [ [[15, 0], [16, 6], [13, 11], [17, 15], [15, 21], [18, 31]],
        [[13, 11], [8, 14], [4, 13], [0, 17]], [[17, 15], [22, 12], [26, 14], [31, 11]] ];
      for (let b = 0; b < damage; b++) {
        const points = branches[b];
        for (let i = 1; i < points.length; i++) {
          const [ax, ay] = points[i - 1], [bx, by] = points[i];
          const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
          for (let n = 0; n <= steps; n++) {
            const x = Math.round(ax + (bx - ax) * n / steps), y = Math.round(ay + (by - ay) * n / steps);
            if (!mask[y]?.[x]) continue;
            c.fillStyle = '#171b20'; c.fillRect(x, y, damage === 3 ? 2 : 1, 1);
            if (damage === 3 && mask[y]?.[x - 1]) { c.fillStyle = '#d28a5d'; c.fillRect(x - 1, y, 1, 1); }
          }
        }
      }
      rocks[variant][damage] = sprite;
    }
  }
  const themes = [
    { name: 'CINTURÓN DE HIERRO', glow: '#0c1e4a', base: '#020615', tint: [1, 1, 1], rock: '#65665b' },
    { name: 'BRASAS', glow: '#4b231f', base: '#160c12', tint: [1.45, .65, .48], rock: '#99513f' },
    { name: 'GLACIAR', glow: '#183d59', base: '#060e1b', tint: [.65, 1.18, 1.65], rock: '#527b99' },
    { name: 'ESPORAS', glow: '#24442b', base: '#07130f', tint: [.8, 1.4, .65], rock: '#608742' },
    { name: 'NEBULOSA', glow: '#422354', base: '#10091c', tint: [1.22, .72, 1.65], rock: '#85569a' },
    { name: 'ARENAS SOLARES', glow: '#4a391e', base: '#151006', tint: [1.55, 1.2, .5], rock: '#9a813c' }
  ];
  const themedRocks = themes.map((theme, ti) => rocks.map(variants => variants.map(sprite => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
    const c = canvas.getContext('2d'); c.drawImage(sprite, 0, 0);
    const img = c.getImageData(0, 0, 32, 32);
    for (let i = 0; i < img.data.length; i += 4) {
      for (let j = 0; j < 3; j++) img.data[i + j] = Math.min(255, img.data[i + j] * theme.tint[j]);
    }
    c.putImageData(img, 0, 0);
    if (ti > 0) {
      c.fillStyle = ['#c3c0a7', '#ed915a', '#a0e3ff', '#c8f88d', '#dfadff', '#ffdb77'][ti];
      for (const [x, y] of [[8, 5], [24, 11], [6, 21]]) {
        c.fillRect(x, y, ti % 2 ? 2 : 3, 2); c.fillRect(x + 1, y - 2, 1, 2);
      }
    }
    return canvas;
  })));
  const planet = document.createElement('canvas'); planet.width = planet.height = 96;
  const pc = planet.getContext('2d');
  for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) {
    const dx = x - 48, dy = y - 48, distance = Math.hypot(dx, dy);
    if (distance > 46) continue;
    const rim = distance > 43;
    const stripe = Math.sin(y * .28 + x * .13) + Math.cos(x * .26 - y * .09);
    const light = Math.max(0, Math.min(4, Math.floor(3.1 - (x + y) / 55 + stripe * .7)));
    pc.fillStyle = rim && x + y < 100 ? '#30d6ee' : ['#060c28', '#111f58', '#1d3894', '#265bb6', '#3c94da'][light];
    pc.fillRect(x, y, 1, 1);
  }
  window.MeteorSprites = { ship, rocks, themes, themedRocks, planet };
})();
