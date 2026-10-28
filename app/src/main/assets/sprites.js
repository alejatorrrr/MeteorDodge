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
    { name: 'ROCA', glow: '#0c1e4a', base: '#020615', tint: [1, 1, 1], rock: '#65665b' },
    { name: 'BRASAS', glow: '#4b231f', base: '#160c12', tint: [1.45, .65, .48], rock: '#99513f' },
    { name: 'GLACIAR', glow: '#183d59', base: '#060e1b', tint: [.65, 1.18, 1.65], rock: '#527b99' },
    { name: 'ESPORAS', glow: '#24442b', base: '#07130f', tint: [.8, 1.4, .65], rock: '#608742' },
    { name: 'HIERRO', glow: '#422354', base: '#10091c', tint: [1.22, .72, 1.65], rock: '#85569a' },
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
    // Distinct silhouettes and materials, not just recolored crater textures.
    if (ti === 1) { // Magma plates and glowing lava seams.
      c.strokeStyle='#ffb533'; c.lineWidth=2; c.beginPath(); c.moveTo(12,3); c.lineTo(15,12); c.lineTo(8,19); c.lineTo(18,27); c.moveTo(15,12); c.lineTo(26,14); c.stroke();
    } else if (ti === 2) { // Faceted ice outgrowths.
      for (const [x,y] of [[7,8],[21,5],[24,21]]) { c.fillStyle='#3b92e5'; c.beginPath();c.moveTo(x-5,y+7);c.lineTo(x,y-6);c.lineTo(x+6,y+3);c.closePath();c.fill();c.fillStyle='#beffff';c.fillRect(x,y-5,2,10); }
    } else if (ti === 3) { // Organic purple core with green spore sacs.
      c.globalCompositeOperation='source-atop';c.fillStyle='#57265c88';c.fillRect(0,0,32,32);c.globalCompositeOperation='source-over';
      for (const [x,y] of [[6,9],[22,6],[25,22],[10,25]]) {c.fillStyle='#2c542c';c.fillRect(x-3,y-3,7,7);c.fillStyle='#88ce45';c.fillRect(x-2,y-2,5,5);c.fillStyle='#e6ff9a';c.fillRect(x-1,y-2,2,2);}
    } else if (ti === 4) { // Iron armor: riveted metal plates.
      for (const [x,y] of [[5,6],[17,7],[10,19]]) {c.fillStyle='#555d8b';c.fillRect(x,y,10,8);c.fillStyle='#b6cdf2';c.fillRect(x,y,10,2);c.fillStyle='#18243f';c.fillRect(x+2,y+4,2,2);}
    } else if (ti === 5) { // Solar sandstone: layered slabs and golden shards.
      for(let y=7;y<27;y+=5){c.fillStyle=y%2?'#ecb95d':'#73512f';c.fillRect(8,y,16,2);}c.fillStyle='#ffe48a';c.fillRect(5,13,4,8);c.fillRect(23,9,3,7);
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
  // Detailed top-view fleet, with separate silhouettes and metallic pixel panels.
  const ships={};
  const fleet={
    classic:{paint:'#e64250',shade:'#841c36',light:'#ffb7b0',wing:26,nose:3,pods:21},
    orbit:{paint:'#9561e8',shade:'#40265e',light:'#d9c2ff',wing:28,nose:5,pods:23},
    critical:{paint:'#efa32e',shade:'#8b4d24',light:'#ffe1a2',wing:22,nose:2,pods:20},
    diagonal:{paint:'#32cca9',shade:'#175b68',light:'#a3ffde',wing:29,nose:0,pods:25},
    burst:{paint:'#ed5a9d',shade:'#712147',light:'#ffc3e2',wing:27,nose:4,pods:24}
  };
  for(const [id,d] of Object.entries(fleet)) {
    const c=document.createElement('canvas');c.width=64;c.height=72;const x=c.getContext('2d');
    const rect=(a,b,w,h,color)=>{x.fillStyle=color;x.fillRect(a,b,w,h);};
    const poly=(points,color)=>{x.fillStyle=color;x.beginPath();points.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fill();};
    for(const sign of [-1,1]) {
      const p=pts=>pts.map(([a,b])=>[32+sign*a,b]);
      poly(p([[7,21],[d.wing,39],[d.wing,48],[13,46],[8,61],[3,58]]),'#101725');
      poly(p([[8,25],[d.wing-2,40],[d.wing-2,44],[12,42],[7,55],[5,52]]),d.paint);
      poly(p([[9,26],[d.wing-2,40],[18,39],[8,32]]),'#d8e6ed');
      poly(p([[12,43],[d.wing-2,44],[9,56],[7,55]]),d.shade);
      const ex=32+sign*d.pods-4;
      rect(ex,19,8,34,'#111b2b');rect(ex+1,21,6,29,d.paint);rect(ex+1,21,2,21,d.light);
      rect(ex+2,23,4,8,'#cfdae0');rect(ex+2,37,4,9,'#24364b');rect(ex+3,38,2,5,'#48dcff');
      rect(ex+1,52,6,5,'#ff973d');rect(ex+2,54,4,9,'#ffd77e');rect(ex+3,56,2,10,'#fff4d7');
      if(id==='diagonal')poly(p([[d.wing-1,7],[d.wing,31],[20,32],[21,13]]),d.light);
      if(id==='orbit' || id==='burst') {
        poly(p([[d.wing,13],[d.wing+2,23],[d.wing+1,48],[d.wing-4,56],[d.wing-2,28]]),d.paint);
        rect(32+sign*(d.wing-1)-1,24,2,19,d.light);
      }
      if(id==='critical'){rect(ex-1,27,10,17,'#444759');rect(ex,28,8,13,d.paint);rect(ex+2,30,4,3,d.light);}
    }
    poly([[32,d.nose],[38,11],[42,42],[40,61],[32,66],[24,61],[22,42],[26,11]],'#0e1728');
    poly([[32,d.nose+3],[36,12],[39,42],[37,59],[32,62],[27,59],[25,42],[28,12]],'#abb9c9');
    poly([[32,6],[32,58],[27,54],[26,40],[29,13]],'#e9eef0');
    poly([[33,12],[37,25],[38,43],[33,56]],'#697f96');
    rect(27,43,10,13,d.paint);rect(28,44,3,9,d.light);rect(32,46,4,8,d.shade);
    poly([[32,14],[36,24],[36,34],[32,39],[28,34],[28,24]],'#11243b');
    poly([[32,17],[34,25],[34,33],[31,35],[30,31],[30,23]],'#239bda');rect(30,22,2,9,'#b8f7ff');
    rect(28,58,8,5,'#182233');rect(29,59,6,2,'#70ecff');
    for(const y of [40,47,54]){rect(24,y,2,2,'#fff2c2');rect(38,y,2,2,'#526a80');}
    ships[id]=c;
  }
  window.MeteorSprites = { ship, ships, rocks, themes, themedRocks, planet };
})();
