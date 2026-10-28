const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path');
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
    await route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':file.endsWith('.jpg')?'image/jpeg':'text/html'});
  });
  await page.goto('https://meteor.local/');
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.fonts.check('12px "Meteor Arcade"')),true);
  assert.ok(await page.locator('#brand-badge').evaluate(img=>img.complete && img.naturalWidth>0));
  assert.ok(await page.locator('.logo-art img').evaluate(img=>img.complete && img.naturalWidth>0));
  await page.locator('#action').click();
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(()=>__game.bullets.length>0));
  await page.locator('#pause').click();
  assert.equal(await page.evaluate(()=>__game.state),'paused');
  await page.locator('#action').click();
  await page.evaluate(()=>{__game.meteors=[];__game.spawnClock=100;__game.addXp(80);});
  // Engine normally changes state inside step, so trigger the overlay via a collected pickup.
  await page.evaluate(()=>{__game.state='playing';__game.level=1;__game.xpNext=80;__game.xp=78;__game.pickups=[{type:'xp',x:__game.player.x,y:__game.player.y,vx:0,vy:0,age:1,value:2}];});
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
  await page.evaluate(()=>{const g=__game;g.meteors=[];g.pickups=[];g.sectorKills=40;});
  await page.locator('#special-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('[data-special]').count(),3);
  await page.locator('[data-special]').first().click();
  assert.equal(await page.evaluate(()=>__game.sector),2);
  await page.evaluate(()=>{const g=__game;g.sector=8;g.sectorKills=40;g.meteors=[];g.bullets=[];g.pickups=[];});
  await page.locator('#boss-hud').waitFor({state:'visible'});
  await page.evaluate(()=>{__game.boss.y=200;__game.boss.hp=1;__game.bullets.push({x:180,y:300,damage:2});});
  await page.locator('#special-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#workshop-art').isVisible(),true);
  await page.locator('#workshop-art').evaluate(img=>img.decode());
  for (const size of [{width:320,height:568},{width:393,height:851}]) {
    await page.setViewportSize(size);
    await page.locator('[data-special]').last().scrollIntoViewIfNeeded();
    assert.ok((await page.locator('[data-special]').last().boundingBox()).height>=44);
    await page.locator('#special-title').scrollIntoViewIfNeeded();
    const art=await page.locator('#workshop-art').boundingBox();
    assert.ok(art.width>250 && art.height>140 && art.x>=0 && art.x+art.width<=size.width);
  }
  await page.screenshot({path:'/tmp/MeteorDodge-taller.png'});
  await page.locator('[data-special]').first().click();
  assert.equal(await page.locator('#workshop-art').isVisible(),false);
  await page.locator('[data-special]').first().click();
  assert.equal(await page.evaluate(()=>__game.sector),9);
  await page.evaluate(()=>{const g=__game;g.invulnerable=0;g.perks.aegis=0;g.shield=0;g.health=1;const m=g.spawn();Object.assign(m,{x:g.player.x,y:g.player.y,speed:0,drift:0,hp:99,maxHp:99,size:3});});
  await page.locator('#title').filter({hasText:'GAME OVER'}).waitFor();
  await page.locator('#action').click();
  assert.equal(await page.evaluate(()=>__game.health),100);
  await page.evaluate(()=>localStorage.setItem('meteor-dodge-best','1234'));
  await page.reload();
  assert.equal(await page.locator('#best').textContent(),'1234');
  await page.screenshot({path:'/tmp/MeteorDodge-inicio.png'});
  for (const size of [{width:320,height:568},{width:393,height:851},{width:560,height:900}]) {
    await page.setViewportSize(size);
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const logo=await page.locator('.logo-art').boundingBox();
    assert.ok(logo.x>=0 && logo.x+logo.width<=size.width);
    await page.locator('#action').scrollIntoViewIfNeeded();
    assert.ok((await page.locator('#action').boundingBox()).height>=44);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: mobile launch, automatic fire, pause/resume, XP selection, damage upgrade, rock destruction, game over, restart, persistent record; no JS errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
