const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
(async()=>{
  const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'test-results','portable-'+Date.now());await fs.mkdir(dataDir,{recursive:true});
  const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});});
  const env={...process.env,YIYU_FOCUS_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;
  const version=require('../package.json').version;
  const proc=spawn(path.join(root,`release/Yiyu-Focus-${version}-Windows.exe`),[`--remote-debugging-port=${port}`],{env,windowsHide:true,stdio:'ignore'});let browser;
  try{
    let ready=false;for(let i=0;i<120;i++){try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'Portable executable did not launch');
    browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);const page=browser.contexts()[0].pages()[0];await page.locator('#start').waitFor();
    assert.equal(await page.evaluate(()=>typeof window.desktop.save),'function');
    await page.locator('#task-input').fill('便携版启动验证');await page.locator('#task-form .add-button').click();await page.evaluate(()=>window.prepareToClose());
    const data=JSON.parse(await fs.readFile(path.join(dataDir,'focus-data.json'),'utf8'));assert.equal(data.tasks[0].title,'便携版启动验证');
    const log=await fs.readFile(path.join(dataDir,'startup.log'),'utf8');assert.ok(log.includes('"hardwareAcceleration":false'));assert.ok(!log.includes('process-gone'));
    const closed=page.waitForEvent('close');await page.evaluate(()=>window.close()).catch(()=>{});await closed;
    console.log('PASS: final portable EXE extracts, launches, renders, persists native data and closes; software rendering enabled.');
  }finally{await browser?.close();if(proc.exitCode===null)proc.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
