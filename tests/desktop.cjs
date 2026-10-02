const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
(async()=>{
  const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'test-results','desktop-'+Date.now());
  await fs.mkdir(dataDir,{recursive:true});
  const env={...process.env,YIYU_FOCUS_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;
  const options=process.env.YIYU_TEST_EXE?{executablePath:process.env.YIYU_TEST_EXE,args:[],env}:{args:[root],env};let app;
  try{
    app=await electron.launch(options);let page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),dataDir);
    assert.equal(await app.evaluate(({app})=>app.isHardwareAccelerationEnabled()),false);
    await page.locator('#intention').fill('桌面保存与重启验证');await page.locator('#start').click();await page.waitForTimeout(1600);
    await page.locator('#pin').click();assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);
    await page.locator('#task-input').fill('持久化任务');await page.locator('#task-form .add-button').click();
    await app.evaluate(({powerMonitor})=>powerMonitor.emit('lock-screen'));
    await page.waitForFunction(()=>document.querySelector('#start').textContent.includes('继续'));
    await page.evaluate(()=>window.prepareToClose());
    const stored=JSON.parse(await fs.readFile(path.join(dataDir,'focus-data.json'),'utf8'));assert.equal(stored.active.running,false);assert.ok(stored.active.elapsed>=1000);assert.equal(stored.tasks.length,1);
    const closed=app.waitForEvent('close');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;
    app=await electron.launch(options);page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');assert.match(await page.locator('#start').innerText(),/继续/);assert.equal(await page.locator('#intention').inputValue(),'桌面保存与重启验证');
    const prefs=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.contextIsolation,true);assert.equal(prefs.sandbox,true);
    assert.equal(await page.evaluate(()=>typeof window.require),'undefined');
    await page.locator('#finish').click();await page.locator('#confirm-yes').click();await page.locator('#review-skip').click();await page.evaluate(()=>window.prepareToClose());
    const final=JSON.parse(await fs.readFile(path.join(dataDir,'focus-data.json'),'utf8'));assert.equal(final.sessions.length,1);assert.equal(final.active,null);
    await page.screenshot({path:path.join(root,'test-results','desktop.png')});
    await page.waitForTimeout(1500);
    const log=await fs.readFile(path.join(dataDir,'startup.log'),'utf8');assert.equal(log.includes('process-gone'),false);
    console.log('PASS: Electron software rendering, isolated native storage, pin, lock-screen pause, native close, restart recovery, completed persistence, sandbox and context isolation; no process crashes logged.');
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
