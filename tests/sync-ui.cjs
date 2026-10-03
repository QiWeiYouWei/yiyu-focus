const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..'),dataDir=path.join(root,'test-results','sync-ui-'+Date.now());await fs.mkdir(dataDir,{recursive:true});
  const env={...process.env,YIYU_FOCUS_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;
  let app;try{
    app=await electron.launch({args:[root],env});
    await app.evaluate(()=>{
      globalThis.mockFiles={};globalThis.mockWrites=0;globalThis.mockOffline=false;globalThis.holdRead=false;
      globalThis.fetch=async(url,options)=>{
        if(globalThis.mockOffline)throw Error('offline');
        const name=new URL(url).pathname.split('/').pop();
        if(options.method==='MKCOL')return new Response(null,{status:201});
        if(options.method==='PROPFIND'){
          if(globalThis.holdRead){globalThis.holdRead=false;await new Promise(resolve=>globalThis.releaseRead=resolve);}
          const items=Object.entries(globalThis.mockFiles).map(([name,f])=>`<d:response><d:href>/dav/YiyuFocus/${name}</d:href><d:propstat><d:prop><d:getetag>&quot;${f.version}&quot;</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('');
          return new Response(`<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/YiyuFocus/</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>${items}</d:multistatus>`,{status:207});
        }
        if(options.method==='GET'){const f=globalThis.mockFiles[name];return new Response(JSON.stringify(f.packet),{headers:{etag:`"${f.version}"`}});}
        if(options.method==='PUT'){
          const old=globalThis.mockFiles[name];if(old&&options.headers['If-Match']!==`"${old.version}"`)return new Response(null,{status:412});
          globalThis.mockWrites++;globalThis.mockFiles[name]={version:globalThis.mockWrites,packet:JSON.parse(options.body)};
          return new Response(null,{status:201,headers:{etag:`"${globalThis.mockWrites}"`}});
        }
        throw Error('unexpected request');
      };
    });
    const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');await page.waitForTimeout(200);
    await page.locator('#task-course').fill('英语');await page.locator('#task-input').fill('本机任务');await page.locator('#task-form .add-button').click();
    await page.locator('#account-badge').click();await page.locator('#sync-username').fill('test@example.com');await page.locator('#sync-password').fill('test-app-password-NOT-REAL');await page.locator('#sync-connect-form .primary').click();await page.locator('#confirm-yes').click();
    await page.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('上次同步'));
    const encrypted=await fs.readFile(path.join(dataDir,'sync-credentials.enc'));assert.ok(!encrypted.toString('utf8').includes('test-app-password'));assert.equal(await page.locator('#sync-password').inputValue(),'');
    const {SyncTracker}=await import('../web/sync.mjs'),{defaultState,dayKey}=await import('../web/core.mjs');const remote=defaultState();remote.profile.name='另一台设备';remote.tasks=[{id:'remote-task',title:'远端任务',course:'模电',done:false}];const ended=Date.now()-1000;remote.sessions=[{id:'remote-study',title:'读第 3 节',note:'理解了反馈',nextStep:'从第 18 页继续',course:'模电',question:'为什么可以虚短？',questionResolved:false,position:'第 18 页',ended,day:dayKey(ended),seconds:900,completed:true}];remote.thoughts=[{id:'remote-thought',text:'查车票',created:ended,source:'focus',course:'模电',sessionId:'remote-study',done:false}];remote.courseHabits=[{id:'course:模电',course:'模电',minutes:25,material:'https://example.com/course',position:'第 18 页',updated:ended}];const packet=new SyncTracker(remote,'remote').packet();
    await app.evaluate((_electron,packet)=>{globalThis.mockFiles['22222222-2222-4222-8222-222222222222.json']={version:99,packet};globalThis.holdRead=true;},packet);
    await page.locator('#sync-now').click();await page.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('正在同步'));
    await page.locator('[data-page="focus"]').first().click();await page.locator('#task-input').fill('网络请求期间新建');await page.locator('#task-form .add-button').click();
    await app.evaluate(()=>globalThis.releaseRead());await page.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('上次同步'));
    assert.equal(await page.locator('.task-row').count(),3);assert.match(await page.locator('#task-list').innerText(),/远端任务/);const cloudEntries=await app.evaluate(()=>Object.values(globalThis.mockFiles).flatMap(f=>f.packet.entries));assert.ok(cloudEntries.some(e=>e.group==='tasks'&&e.value?.title==='本机任务'&&e.value.course==='英语'));const learned=await page.evaluate(()=>window.desktop.load());assert.equal(learned.sessions[0].nextStep,'从第 18 页继续');assert.equal(learned.sessions[0].question,'为什么可以虚短？');assert.equal(learned.courseHabits[0].minutes,25);assert.equal(learned.courseHabits[0].position,'第 18 页');assert.equal(await page.locator('#timer').innerText(),'25:00');assert.equal(learned.thoughts[0].source,'focus');assert.equal(learned.thoughts[0].course,'模电');assert.equal(await page.locator('#intention').inputValue(),'从第 18 页继续');assert.equal(await page.locator('#focus-course').inputValue(),'模电');
    await app.evaluate(()=>globalThis.mockOffline=true);await page.locator('#task-input').fill('离线记录');await page.locator('#task-form .add-button').click();await page.locator('#account-badge').click();await page.locator('#sync-now').click();await page.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('连接不到'));
    let saved=JSON.parse(await fs.readFile(path.join(dataDir,'focus-data.json'),'utf8'));assert.ok(saved.tasks.some(t=>t.title==='离线记录'));
    await app.evaluate(()=>globalThis.mockOffline=false);await page.locator('#sync-now').click();await page.waitForFunction(()=>document.querySelector('#sync-state').textContent.includes('上次同步'));
    await page.screenshot({path:path.join(root,'test-results','account-sync.png')});
    const status=await page.evaluate(()=>window.desktop.syncStatus());assert.equal(status.owner,'nutstore:test@example.com');assert.ok(!JSON.stringify(status).includes('password'));
    saved=JSON.parse(await fs.readFile(path.join(dataDir,'focus-data.json'),'utf8'));assert.ok(!JSON.stringify(saved).includes('test-app-password'));
    await page.locator('#sync-disconnect').click();await page.locator('#confirm-yes').click();await page.locator('#sync-connect-form').waitFor({state:'visible'});await assert.rejects(fs.stat(path.join(dataDir,'sync-credentials.enc')),/ENOENT/);
    await page.locator('#sync-username').fill('different@example.com');await page.locator('#sync-password').fill('another-fake-password');await page.locator('#sync-connect-form .primary').click();assert.match(await page.locator('#toast').innerText(),/其他坚果云账号/);
    console.log('PASS: native encrypted credentials, account binding, cloud merge, edits during in-flight read, offline persistence and retry, no credentials in exports, disconnect erases local authorization. Cloud transport mocked; no real account used.');
  }finally{await app?.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
