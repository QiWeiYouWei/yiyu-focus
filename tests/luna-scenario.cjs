const assert=require('node:assert/strict'),path=require('node:path');
module.exports=async({page,pet,root})=>{
 await pet.locator('#pet-touch').click({force:true});await pet.waitForFunction(()=>document.body.dataset.response==='pet'&&document.querySelector('canvas').dataset.row==='6');
 const first=await pet.locator('#pet-status').innerText();await pet.waitForTimeout(700);await pet.locator('#pet-touch').click({force:true});assert.notEqual(await pet.locator('#pet-status').innerText(),first);
 await pet.waitForTimeout(700);await pet.locator('#pet-chat').click({force:true});await pet.locator('[data-luna-reply="tired"]').click({force:true});await pet.waitForFunction(()=>document.body.dataset.response==='tired'&&document.querySelector('canvas').dataset.row==='5');
 assert.equal((await page.evaluate(()=>window.desktop.load())).active,null,'An emotional check-in never starts or pauses the timer');
 await pet.screenshot({path:path.join(root,'test-results/luna-comfort.png'),omitBackground:true});
 await page.evaluate(async()=>{const pref=await window.desktop.petPreferences();await window.desktop.savePetPreferences({...pref,scale:.8});});
 await pet.locator('#pet-chat').click({force:true});await pet.waitForTimeout(300);
 assert.ok(await pet.locator('#pet-chat-menu').evaluate(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}),'Chat controls fit the smallest companion');
 await pet.screenshot({path:path.join(root,'test-results/luna-chat-small.png'),omitBackground:true});
 await pet.locator('[data-luna-reply="stuck"]').click({force:true});await pet.waitForFunction(()=>document.body.dataset.response==='stuck');assert.match(await pet.locator('#pet-status').innerText(),/价值|问题|例题/);
 assert.ok(await pet.locator('.message').evaluate(e=>e.getBoundingClientRect().bottom<innerHeight),'Long comfort message fits');
 await page.evaluate(async()=>{const pref=await window.desktop.petPreferences();await window.desktop.savePetPreferences({...pref,scale:1});});
 await page.locator('#intention').fill('先理解一个卷积例题');await page.locator('#focus-course').fill('信号与系统');await page.locator('#start').click();
 await pet.waitForFunction(()=>document.body.dataset.response==='start');assert.match(await pet.locator('#pet-status').innerText(),/信号与系统/);
 const activeId=(await page.evaluate(()=>window.desktop.load())).active.id;
 await pet.waitForTimeout(3500);await page.locator('#distracted').click();await page.locator('#distraction-input').fill('担心课程落后');await page.locator('#distraction-form .primary').click();await pet.waitForFunction(()=>document.body.dataset.response==='returned');await page.locator('#return-continue').click();
 const before=await pet.locator('#pet-status').innerText();await pet.waitForTimeout(1100);assert.equal(await pet.locator('#pet-status').innerText(),before,'Timer ticks do not replace a supportive reply');
 assert.equal((await page.evaluate(()=>window.desktop.load())).active.id,activeId);
 await page.evaluate(async()=>{const pref=await window.desktop.petPreferences();await window.desktop.savePetPreferences({...pref,companionship:'quiet'});window.desktop.encouragePet({kind:'returned',id:'quiet-check'});});
 await pet.waitForFunction(()=>document.body.dataset.response==='');await pet.waitForTimeout(700);await pet.locator('#pet-chat').click({force:true});await pet.locator('[data-luna-reply="encourage"]').click({force:true});await pet.waitForFunction(()=>document.body.dataset.response==='encourage');
 assert.equal((await page.evaluate(()=>window.desktop.load())).active.id,activeId);assert.equal((await page.evaluate(()=>window.desktop.load())).active.running,true);
 // Cancel the scenario's active session in the isolated test data, retaining no personal history.
 await page.locator('#finish').click();await page.locator('#confirm-yes').click();await page.locator('#review-skip').click();
 await page.evaluate(async()=>{const pref=await window.desktop.petPreferences();await window.desktop.savePetPreferences({...pref,companionship:'gentle'});});
 console.log('PASS: Luna head touch, varied replies, fatigue/anxiety support, small-window menu, contextual course encouragement, distraction return, timer stability and quiet/manual modes.');
};
