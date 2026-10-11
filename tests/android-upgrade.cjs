const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{execFile}=require('node:child_process'),{promisify}=require('node:util');
const run=promisify(execFile),root=path.resolve(__dirname,'..'),serial='emulator-5580',adb=async(...args)=>(await run(path.join(root,'.android-tools/sdk/platform-tools/adb.exe'),['-s',serial,...args],{maxBuffer:12*1024*1024})).stdout;
(async()=>{
 // Only the dedicated, root-capable test emulator. Never use a personal phone.
 await adb('wait-for-device');const before=JSON.parse(await adb('shell','cat','/data/data/local.yiyu.focus/files/focus-data.json'));assert.ok(before.sessions.length,'Run Android UI test before upgrade check');
 const fixture=path.join(root,'test-results/android-upgrade-fixture.json');await fs.writeFile(fixture,JSON.stringify(before));
 await adb('uninstall','local.yiyu.focus');await adb('install',path.join(root,'distribution/Yiyu-Focus-0.12.0-Android.apk'));await adb('shell','am','start','-n','local.yiyu.focus/.MainActivity');await new Promise(r=>setTimeout(r,2500));await adb('shell','am','force-stop','local.yiyu.focus');
 const owner=(await adb('shell','stat','-c','%u:%g','/data/data/local.yiyu.focus/files')).trim();assert.match(owner,/^\d+:\d+$/);
 await adb('push',fixture,'/data/data/local.yiyu.focus/files/focus-data.json');await adb('shell','chown',owner,'/data/data/local.yiyu.focus/files/focus-data.json');await adb('shell','am','start','-n','local.yiyu.focus/.MainActivity');await new Promise(r=>setTimeout(r,2500));
 const old=JSON.parse(await adb('shell','cat','/data/data/local.yiyu.focus/files/focus-data.json'));assert.deepEqual(old.sessions,before.sessions);
 const version=require('../package.json').version;await adb('install','-r',path.join(root,`release/Yiyu-Focus-${version}-Android.apk`));await adb('shell','am','start','-n','local.yiyu.focus/.MainActivity');await new Promise(r=>setTimeout(r,3000));
 const after=JSON.parse(await adb('shell','cat','/data/data/local.yiyu.focus/files/focus-data.json'));assert.deepEqual(after.sessions,before.sessions);assert.deepEqual(after.thoughts,before.thoughts);assert.deepEqual(after.profile,before.profile);
 assert.match(await adb('shell','dumpsys','package','local.yiyu.focus'),new RegExp('versionName='+version.replaceAll('.','\\.')));assert.ok((await adb('shell','pidof','local.yiyu.focus')).trim());
 await fs.writeFile(path.join(root,'test-results/android-release.png'),(await run(path.join(root,'.android-tools/sdk/platform-tools/adb.exe'),['-s',serial,'exec-out','screencap','-p'],{encoding:'buffer',maxBuffer:12*1024*1024})).stdout);
 console.log('PASS: signed 0.12.0 release runs with test records; same-signature release upgrade installs without uninstalling and preserves sessions, thoughts and profile; final release launches.');
})().catch(e=>{console.error(e);process.exitCode=1;});
