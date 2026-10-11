const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'test-results','gaze-'+Date.now());await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(path.join(dataDir,'pet-preferences.json'),JSON.stringify({enabled:true,scale:1,clickThrough:false}));
 const env={...process.env,YIYU_FOCUS_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;let app;const errors=[];
 try{
  app=await electron.launch({args:[root],env});let page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('#start').waitFor();let pet=app.windows().find(p=>p.url().endsWith('/pet.html'))||await app.waitForEvent('window');pet.on('pageerror',e=>errors.push(e.message));await pet.locator('#pet-gaze').waitFor();assert.equal((await page.evaluate(()=>window.desktop.petPreferences())).cursorGaze,true);
  assert.match(await page.evaluate(()=>window.desktop.savePetPreferences({enabled:true,scale:1,clickThrough:false,cursorGaze:'yes'}).then(()=>'',e=>e.message)),/无效/);
  const minimizeMain=minimize=>app.evaluate(({BrowserWindow},minimize)=>{const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().endsWith('/index.html'));if(minimize)win.minimize();else win.restore();},minimize);
  await require('./gaze-scenario.cjs')({page,pet,root,minimizeMain});
  let closed=app.waitForEvent('close');await page.evaluate(()=>window.close());await closed;app=null;
  app=await electron.launch({args:[root],env});page=await app.firstWindow();await page.locator('#start').waitFor();pet=app.windows().find(p=>p.url().endsWith('/pet.html'))||await app.waitForEvent('window');await pet.locator('#pet-gaze[aria-pressed="false"]').waitFor();assert.equal((await page.evaluate(()=>window.desktop.petPreferences())).cursorGaze,false);assert.equal((await pet.evaluate(()=>window.companion.init())).cursor,null);assert.deepEqual(errors,[]);
  closed=app.waitForEvent('close');await page.evaluate(()=>window.close());await closed;app=null;console.log('PASS: legacy gaze default, validation, global cursor while main minimized, opt-out survives restart, clean exit.');
 }finally{await app?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
