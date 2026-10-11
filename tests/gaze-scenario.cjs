const assert=require('node:assert/strict'),path=require('node:path'),cursor=require('./native-cursor.cjs');
module.exports=async({page,pet,root,minimizeMain})=>{
 const original=await cursor();
 try{
  await page.evaluate(async()=>{const pref=await window.desktop.petPreferences();await window.desktop.savePetPreferences({...pref,cursorGaze:true,clickThrough:false,scale:1});});
  await pet.waitForFunction(()=>!document.body.dataset.reaction&&document.body.dataset.mode==='idle');
  const origin=await pet.evaluate(async()=>{const {cursor}=await window.companion.init(),r=document.querySelector('canvas').getBoundingClientRect();return {x:cursor.bounds.x+r.left+r.width*.5,y:cursor.bounds.y+r.top+r.height*.3,dpr:devicePixelRatio};});
  async function move(dx,dy,direction){await cursor({x:(origin.x+dx)*origin.dpr,y:(origin.y+dy)*origin.dpr});await pet.waitForFunction(value=>document.querySelector('canvas').dataset.gaze===String(value),direction);}
  for(const [dx,dy,direction] of [[-180,0,12],[180,0,4],[0,-180,0],[0,180,8]])await move(dx,dy,direction);
  await pet.locator('#pet-gaze').click({force:true});await pet.waitForFunction(()=>document.querySelector('#pet-gaze').getAttribute('aria-pressed')==='false'&&document.querySelector('canvas').dataset.gaze==='');assert.equal((await page.evaluate(()=>window.desktop.petPreferences())).cursorGaze,false);
  await pet.locator('#pet-gaze').click({force:true});await pet.waitForFunction(()=>document.querySelector('#pet-gaze').getAttribute('aria-pressed')==='true');
  await page.locator('[data-page="settings"]').first().click();await page.locator('#pet-cursor-gaze').uncheck();await page.locator('#pet-settings-form .primary').click();await pet.waitForFunction(()=>document.querySelector('#pet-gaze').getAttribute('aria-pressed')==='false');
  await page.locator('#pet-cursor-gaze').check();await page.locator('#pet-click-through').check();await page.locator('#pet-settings-form .primary').click();await pet.waitForFunction(()=>document.querySelector('#pet-gaze').getAttribute('aria-pressed')==='true');
  if(minimizeMain)await minimizeMain(true);await move(-180,0,12);if(minimizeMain)await minimizeMain(false);
  const tracked=(await pet.evaluate(()=>window.companion.init())).cursor;assert.ok(tracked.point.x<tracked.bounds.x,'Actual cursor outside the pet window still drives gaze');
  await pet.screenshot({path:path.join(root,'test-results/luna-gaze-left.png'),omitBackground:true});
  await page.locator('#pet-click-through').uncheck();await page.locator('#pet-settings-form .primary').click();await page.waitForFunction(()=>!document.querySelector('#pet-click-through').checked);
  await page.locator('#pet-scale').selectOption('0.8');await page.locator('#pet-settings-form .primary').click();await pet.waitForTimeout(200);assert.ok(await pet.locator('.toolbar').evaluate(e=>[...e.children].every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})),'All four toolbar buttons fit the smallest size');
  await page.locator('#pet-scale').selectOption('1');await page.locator('#pet-settings-form .primary').click();await page.waitForTimeout(150);
  await page.locator('[data-page="focus"]').first().click();await page.locator('#intention').fill('读完下一小段');await page.locator('#start').click();await pet.waitForFunction(()=>document.body.dataset.mode==='focus');await move(180,0,4);await move(-180,0,12);await pet.waitForTimeout(1500);await pet.waitForFunction(()=>document.querySelector('canvas').dataset.row==='7'&&document.querySelector('canvas').dataset.gaze==='');
  await page.locator('#start').click();await pet.waitForFunction(()=>document.body.dataset.mode==='paused'&&document.querySelector('canvas').dataset.frame==='1');assert.equal((await pet.evaluate(()=>window.companion.init())).cursor,null);
  await page.locator('#finish').click();await page.locator('#confirm-yes').click();await page.locator('#review-skip').click();await pet.waitForFunction(()=>document.body.dataset.mode==='idle');await page.locator('[data-page="settings"]').first().click();
  await page.locator('#motion-toggle').click();await pet.waitForFunction(()=>document.body.dataset.motion==='off');await cursor({x:(origin.x-180)*origin.dpr,y:origin.y*origin.dpr});await pet.waitForTimeout(300);
  assert.equal(await pet.locator('canvas').getAttribute('data-gaze'),'');await page.locator('#motion-toggle').click();await pet.waitForFunction(()=>document.body.dataset.motion==='on');
  await pet.emulateMedia({reducedMotion:'reduce'});await pet.waitForFunction(()=>document.querySelector('canvas').dataset.gaze==='');await pet.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#pet-cursor-gaze').uncheck();await page.locator('#pet-settings-form .primary').click();await pet.waitForFunction(()=>document.querySelector('#pet-gaze').getAttribute('aria-pressed')==='false');
  console.log('PASS: real desktop cursor in four directions and outside the pet, toggle/settings, click-through, small toolbar, reduced motion and saved opt-out.');
 }finally{await cursor(original);}
};
