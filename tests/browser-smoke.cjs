const { chromium } = require('playwright');
const fs = require('node:fs'); const http = require('node:http'); const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../app/src/main/assets');
(async () => {
 const browser = await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:393,height:851},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(() => {
   Object.defineProperty(window,'MeteorEngine',{configurable:true,set(api){
    const Base=api.Game; api.Game=class extends Base { constructor(...args){ super(...args);window.__game=this;} };
    Object.defineProperty(window,'MeteorEngine',{value:api});
   }});
  });
  await page.route('https://meteor.local/**', async route => {
    const pathname=new URL(route.request().url()).pathname;
    const file=path.join(root,pathname==='/'?'index.html':pathname);
    await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html'});
  });
  await page.goto('https://meteor.local/');
  await page.locator('#action').click();
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(()=>__game.bullets.length>0));
  await page.locator('#pause').click();
  assert.equal(await page.evaluate(()=>__game.state),'paused');
  await page.locator('#action').click();
  await page.evaluate(()=>{__game.meteors=[];__game.spawnClock=100;__game.addXp(12);});
  // Engine normally changes state inside step, so trigger the overlay via a collected pickup.
  await page.evaluate(()=>{__game.state='playing';__game.level=1;__game.xpNext=12;__game.xp=10;__game.pickups=[{type:'xp',x:__game.player.x,y:__game.player.y,vx:0,vy:0,age:1,value:2}];});
  await page.locator('#upgrade-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('.upgrade-option').count(),3);
  await page.screenshot({path:'/tmp/MeteorDodge-upgrades.png'});
  await page.locator('[data-upgrade="damage"]').click();
  assert.equal(await page.evaluate(()=>__game.damage),2);
  assert.equal(await page.evaluate(()=>__game.state),'playing');
  await page.evaluate(()=>{
   const g=__game;g.meteors=[];g.shield=0;g.health=100;
   const m=g.spawn();Object.assign(m,{x:160,y:280,speed:0,drift:0,hp:1,maxHp:7});
   g.bullets.push({x:160,y:310,damage:2});
  });
  await page.waitForTimeout(150);
  assert.ok(await page.evaluate(()=>__game.kills>0));
  await page.screenshot({path:'/tmp/MeteorDodge-combate.png'});
  await page.evaluate(()=>{const g=__game;g.invulnerable=0;g.shield=0;g.health=1;const m=g.spawn();Object.assign(m,{x:g.player.x,y:g.player.y,speed:0,drift:0,hp:99,maxHp:99,size:3});});
  await page.locator('#title').filter({hasText:'GAME OVER'}).waitFor();
  await page.locator('#action').click();
  assert.equal(await page.evaluate(()=>__game.health),100);
  await page.evaluate(()=>localStorage.setItem('meteor-dodge-best','1234'));
  await page.reload();
  assert.equal(await page.locator('#best').textContent(),'1234');
  await page.screenshot({path:'/tmp/MeteorDodge-inicio.png'});
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile launch, automatic fire, pause/resume, XP selection, damage upgrade, rock destruction, game over, restart, persistent record; no JS errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
