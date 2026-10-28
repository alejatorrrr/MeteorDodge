/* Original low-resolution UI symbols, drawn on integer pixels for crisp scaling. */
window.MeteorIcons = {
  create(id) {
    const canvas=document.createElement('canvas'); canvas.width=24; canvas.height=24;
    canvas.className='pixel-icon'; canvas.setAttribute('aria-hidden','true'); canvas.dataset.icon=id;
    const c=canvas.getContext('2d');
    const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);};
    const path=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();};
    const beam=(x,y,h)=>{rect(x,y,3,h,'#2496ff');rect(x+1,y,1,h,'#d9ffff');};
    const ship=(x,y)=>{path([[x,y],[x+4,y+8],[x-4,y+8]],'#65d6ff');rect(x-1,y+4,2,4,'#eefaff');rect(x-1,y+8,2,3,'#ff993c');};
    const shield=()=>{path([[3,4],[12,1],[21,4],[20,15],[12,23],[4,15]],'#d59a39');path([[6,6],[12,4],[18,6],[17,14],[12,19],[7,14]],'#248ddd');rect(10,6,3,10,'#7ff2ff');};
    const burst=()=>{path([[12,0],[14,8],[22,3],[17,11],[24,13],[16,15],[20,23],[12,18],[7,24],[8,16],[0,14],[7,10],[3,3],[10,7]],'#ff8c2d');path([[12,5],[14,10],[19,12],[14,15],[11,20],[9,14],[4,12],[10,10]],'#ffe895');rect(10,10,4,4,'#fffbed');};
    switch(id) {
      case 'health':
        path([[2,4],[5,2],[9,2],[12,5],[15,2],[19,2],[22,5],[22,11],[12,22],[2,11]],'#9e1e49');
        path([[3,5],[6,3],[9,4],[12,7],[16,3],[20,5],[20,10],[12,19],[4,11]],'#ff345d');rect(5,5,4,3,'#ff95af');break;
      case 'damage': burst();break;
      case 'rate':
        for(let i=0;i<3;i++)rect(1+i*2,5+i*6,8,2,'#31d5ff');
        path([[11,2],[16,2],[24,12],[16,22],[11,22],[18,12]],'#86f6ff');path([[8,6],[11,6],[16,12],[11,18],[8,18],[13,12]],'#268dff');break;
      case 'diagonal': ship(12,14);beam(11,1,8);path([[2,4],[5,3],[9,10],[6,12]],'#79efff');path([[22,4],[19,3],[15,10],[18,12]],'#79efff');break;
      case 'laser': rect(7,0,10,17,'#603da7');rect(10,0,4,19,'#d890ff');rect(11,0,2,19,'#fff4ff');rect(7,18,10,5,'#42b8e5');break;
      case 'rear': ship(12,2);beam(11,13,6);path([[7,18],[17,18],[12,24]],'#ffa347');break;
      case 'aegis': shield();for(const [x,y] of [[0,0],[20,19],[0,18]]){rect(x,y,4,4,'#db9575');rect(x+1,y,2,2,'#ffe5ac');}break;
      case 'wingmen': ship(5,7);ship(19,7);beam(4,0,4);beam(18,0,4);break;
      case 'capacity': shield();rect(14,13,9,3,'#e7ffff');rect(17,10,3,9,'#e7ffff');break;
      case 'reactor': shield();path([[12,5],[8,13],[12,13],[10,20],[17,10],[13,10],[16,5]],'#ffe792');break;
      case 'critical': burst();rect(10,5,4,9,'#fff');rect(10,16,4,3,'#fff');break;
      case 'cannon': for(const x of [4,15]){rect(x,3,5,16,'#5876a6');beam(x+1,0,12);rect(x-1,17,7,5,'#bdd9f5');}break;
      case 'armor': path([[0,7],[8,9],[12,18],[3,15]],'#ffbd65');path([[24,7],[16,9],[12,18],[21,15]],'#ffbd65');shield();break;
      case 'engine': rect(5,3,14,13,'#436ab0');rect(8,2,8,11,'#accce3');rect(9,5,6,8,'#1c3453');path([[6,16],[18,16],[16,21],[12,24],[8,21]],'#24bfff');rect(10,16,4,6,'#d4ffff');break;
      default: shield();
    }
    return canvas;
  }
};
