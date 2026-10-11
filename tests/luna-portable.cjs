const {chromium}=require('playwright'),{spawn}=require('node:child_process');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net');
(async()=>{
 const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'test-results','luna-portable-'+Date.now());await fs.mkdir(dataDir,{recursive:true});
 const env={...process.env,YIYU_FOCUS_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;let proc,browser;const errors=[];
 async function launch(){
  const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  proc=spawn(path.join(root,`release/Yiyu-Focus-${require('../package.json').version}-Windows.exe`),[`--remote-debugging-port=${port}`],{env,windowsHide:true,stdio:'ignore'});
  let ready=false;for(let i=0;i<160;i++){try{if((await fetch(`http://127.0.0.1:${port}/json/version`)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Portable EXE launches');
  browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  for(let i=0;i<80&&!browser.contexts()[0].pages().some(p=>p.url().endsWith('/index.html'));i++)await new Promise(r=>setTimeout(r,100));
  const page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/index.html'));assert.ok(page);page.on('pageerror',e=>errors.push(e.message));await page.locator('#start').waitFor();return page;
 }
 async function close(page,pet){const closed=page.waitForEvent('close',{timeout:15000});await page.evaluate(()=>window.close()).catch(()=>{});if(pet){await pet.waitForFunction(()=>document.body.dataset.response==='goodbye');await pet.screenshot({path:path.join(root,'test-results/luna-goodbye-portable.png'),omitBackground:true});}await closed;await browser.close();browser=null;if(proc.exitCode===null)await new Promise(r=>{const timeout=setTimeout(r,15000);proc.once('exit',()=>{clearTimeout(timeout);r();});});assert.notEqual(proc.exitCode,null,'Portable process exits without orphan');}
 try{
  let page=await launch();let pet=browser.contexts()[0].pages().find(p=>p.url().endsWith('/pet.html'));
  if(!pet)pet=await browser.contexts()[0].waitForEvent('page',{predicate:p=>p.url().endsWith('/pet.html')});pet.on('pageerror',e=>errors.push(e.message));await pet.locator('#pet-touch').waitFor();
  await pet.waitForFunction(()=>document.body.dataset.response==='greeting');
  await require('./luna-scenario.cjs')({page,pet,root});
  await require('./gaze-scenario.cjs')({page,pet,root});
  await close(page,pet);page=await launch();pet=browser.contexts()[0].pages().find(p=>p.url().endsWith('/pet.html'));if(!pet)pet=await browser.contexts()[0].waitForEvent('page');await pet.waitForFunction(()=>document.body.dataset.response==='greeting');
  await page.evaluate(async()=>{const pref=await window.desktop.petPreferences();await window.desktop.savePetPreferences({...pref,companionship:'quiet',scale:.8});});
  await close(page);const saved=JSON.parse(await fs.readFile(path.join(dataDir,'pet-preferences.json'),'utf8'));assert.equal(saved.companionship,'quiet');assert.equal(saved.scale,.8);
  page=await launch();assert.equal((await page.evaluate(()=>window.desktop.petPreferences())).companionship,'quiet');assert.equal((await page.evaluate(()=>window.desktop.petPreferences())).cursorGaze,false);
  pet=browser.contexts()[0].pages().find(p=>p.url().endsWith('/pet.html'));if(!pet)pet=await browser.contexts()[0].waitForEvent('page');await pet.locator('#pet-touch').waitFor();await pet.waitForFunction(()=>document.body.dataset.response==='');await pet.locator('#pet-touch').click({force:true});await pet.waitForFunction(()=>document.body.dataset.response==='pet');
  assert.deepEqual(errors,[]);await close(page);console.log('PASS: actual portable EXE Luna opening/farewell, interactions, quiet setting and size survive restart, isolated native data, successful exit.');
 }finally{if(browser){const page=browser.contexts()[0].pages().find(p=>p.url().endsWith('/index.html'));if(page&&!page.isClosed())await close(page).catch(()=>{});if(browser)await browser.close().catch(()=>{});}if(proc?.exitCode===null)proc.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
