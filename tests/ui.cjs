const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const path=require('node:path');
(async()=>{
  const server=spawn(process.execPath,[path.join(__dirname,'../scripts/serve.cjs')],{windowsHide:true,stdio:'pipe'});
  let browser;
  try{
    await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));});
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:1280,height:960},acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:4173');await page.locator('#start').waitFor();
    await page.locator('#start').click();assert.equal(await page.locator('#timer').innerText(),'15:00');
    await page.locator('#task-input').fill('读完第三节 <script>alert(1)</script>');await page.locator('#task-form .add-button').click();
    await page.locator('[data-use-task]').click();assert.match(await page.locator('#intention').inputValue(),/第三节/);
    await page.locator('[data-minutes="5"]').click();await page.locator('#start').click();
    await page.waitForTimeout(1200);await page.locator('#start').click();const paused=await page.locator('#timer').innerText();await page.waitForTimeout(1200);assert.equal(await page.locator('#timer').innerText(),paused);
    await page.reload();assert.match(await page.locator('#start').innerText(),/继续/);
    await page.locator('#start').click();await page.locator('#distracted').click();await page.locator('#distraction-input').fill('查一下车票');await page.locator('#distraction-form .primary').click();assert.equal(await page.locator('#inbox-count').innerText(),'1');
    await page.locator('#finish').click();await page.locator('#confirm-yes').click();await page.locator('#review-dialog').waitFor({state:'visible'});await page.locator('#review-note').fill('理解了反馈的作用');await page.locator('#review-form .primary').click();assert.match(await page.locator('#timer-mode').innerText(),/休息/);
    await page.locator('#finish').click();await page.locator('[data-page="history"]').first().click();assert.match(await page.locator('#history-list').innerText(),/反馈/);
    await page.locator('[data-page="inbox"]').first().click();await page.locator('[data-check-thought]').check();assert.equal(await page.locator('#inbox-count').innerText(),'0');
    await page.locator('[data-page="settings"]').first().click();await page.locator('[name="name"]').fill('Aromix');await page.locator('[name="goal"]').fill('90');await page.locator('#settings-form .primary').click();
    const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent;const backup=JSON.parse(await fs.readFile(await download.path(),'utf8'));assert.equal(backup.profile.name,'Aromix');assert.equal(backup.sessions.length,1);assert.equal(backup.sessions[0].note,'理解了反馈的作用');
    await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":2}')});await page.waitForTimeout(100);assert.match(await page.locator('#toast').innerText(),/无法恢复/);
    await page.locator('#import-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#confirm-yes').click();await page.waitForTimeout(100);
    await page.locator('[data-page="growth"]').first().click();assert.equal(await page.locator('#profile-name').innerText(),'Aromix');assert.ok(await page.locator('.heat-cell:not(.blank)').count()>=365);
    await fs.mkdir(path.join(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/growth.png'),fullPage:true,animations:"disabled"});
    await page.locator('[data-page="focus"]').first().click();await page.screenshot({path:path.join(__dirname,'../test-results/focus.png'),fullPage:true,animations:"disabled"});
    // Completion with deterministic clock: timer must record once, not on every tick.
    await page.locator('#custom-minutes').fill('1');await page.locator('#custom-minutes').dispatchEvent('change');await page.clock.install();await page.locator('#start').click();await page.clock.fastForward(61000);await page.locator('#review-dialog').waitFor({state:'visible'});await page.clock.fastForward(3000);await page.locator('#review-skip').click();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('yiyu-focus-v1')));assert.equal(saved.sessions.length,2);assert.equal(saved.sessions[1].seconds,60);assert.equal(saved.sessions[1].completed,true);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'../test-results/mobile.png'),fullPage:true,animations:"disabled"});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.clock.resume();
    await page.setViewportSize({width:1280,height:800});
    await page.locator('#zen').click();assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('zen-mode')),true);
    await page.keyboard.press('Escape');assert.equal(await page.locator('#zen').getAttribute('aria-pressed'),'false');
    await page.locator('[data-page="settings"]').first().click();await page.locator('#motion-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
    await page.reload();assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
    await page.locator('[data-page="settings"]').first().click();await page.locator('#motion-toggle').click();
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
    assert.equal(await page.locator('#motion-toggle').isDisabled(),true);assert.equal(await page.locator('html').getAttribute('data-motion'),'off');
    await page.locator('[data-page="focus"]').first().click();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:path.join(__dirname,'../test-results/compact.png'),fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[]);console.log('PASS: tasks, safe text, timer pause/resume/reload, distraction, finish, reflection, break, history, settings, backup import/export, completion once, responsive layout.');
    // Empty-state screenshot reflects actual first-launch experience.
    const clean=await browser.newPage({viewport:{width:1280,height:960}});await clean.goto('http://127.0.0.1:4173');await clean.screenshot({path:path.join(__dirname,'../test-results/first-launch.png'),fullPage:true,animations:"disabled"});
  } finally {await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
