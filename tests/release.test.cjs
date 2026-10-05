const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto'),fs=require('node:fs');
const source=fs.readFileSync(path.join(__dirname,'../scripts/publish-release.cjs'),'utf8');
function simulate({existing='draft',corrupt=false}={}){
 const root=path.resolve(__dirname,'..'),files=new Map(),calls=[],sha=b=>crypto.createHash('sha256').update(b).digest('hex');
 const apk=Buffer.from('signed original apk'),exe=Buffer.from('windows executable');
 const put=(p,b)=>files.set(p,Buffer.isBuffer(b)?b:Buffer.from(b));
 put(path.join(root,'distribution/original.apk'),apk);
 put(path.join(root,'distribution/release.json'),JSON.stringify({version:'0.11.0',android:{file:'distribution/original.apk',bytes:apk.length,sha256:sha(apk)},notes:'docs/releases/0.11.0.md'}));
 put(path.join(root,'docs/releases/0.11.0.md'),'Release notes');
 put(path.join(root,'release/Yiyu-Focus-0.11.0-Windows.exe'),exe);
 let release=existing?{id:1,tag_name:'v0.11.0',draft:existing==='draft',assets:[],html_url:'https://github.com/example/release'}:null;
 const uploaded=new Map();
 const fakeFs={readFileSync(p,encoding){if(!files.has(p))throw Error('Missing fixture '+p);return encoding?files.get(p).toString():files.get(p);},statSync(p){return {size:this.readFileSync(p).length};},mkdirSync(){},copyFileSync(a,b){put(b,this.readFileSync(a));},writeFileSync:put,mkdtempSync(p){return p+'fixture';}};
 const cp={execFileSync(command,args){
  assert.equal(command,'gh');calls.push(args);
  if(args[0]==='api'){assert.ok(args.includes('--paginate'));assert.ok(args.includes('--slurp'));return JSON.stringify([release?[release]:[]]);}
  if(args[1]==='create'){assert.equal(release,null);assert.ok(args.includes('--draft'));release={id:1,tag_name:'v0.11.0',draft:true,assets:[],html_url:'https://github.com/example/release'};}
  else if(args[1]==='edit'){if(args.includes('--draft=false'))release.draft=false;else assert.ok(args.includes('--draft=true'),'metadata edits must explicitly retain draft status');}
  else if(args[1]==='upload'){assert.equal(release.draft,true);for(const file of args.slice(3,args.indexOf('--repo'))){const bytes=fakeFs.readFileSync(file);uploaded.set(path.basename(file),bytes);}release.assets=[...uploaded].map(([name,b])=>({name,size:b.length,digest:'sha256:'+sha(b)}));}
  else if(args[1]==='download'){assert.equal(release.draft,true);const dir=args[args.indexOf('--dir')+1];for(const [name,b]of uploaded)put(path.join(dir,name),corrupt&&name.endsWith('.exe')?Buffer.from('corrupted'):b);}
  else throw Error('Unexpected command '+args);
  return '';
 }};
 let error;
 try{vm.runInNewContext(source,{require(name){if(name==='node:fs')return fakeFs;if(name==='node:path')return path;if(name==='node:crypto')return crypto;if(name==='node:child_process')return cp;if(name==='../package.json')return{version:'0.11.0'};throw Error(name);},__dirname:path.join(root,'scripts'),process:{argv:[],env:{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'QiWeiYouWei/yiyu-focus',GH_TOKEN:'fixture',GITHUB_SHA:'a'.repeat(40)}},console:{log(){}}});}catch(e){error=e;}
 return{error,release,calls};
}
test('reuses an existing draft and publishes only after downloading verified bytes',()=>{const r=simulate();assert.equal(r.error,undefined);assert.equal(r.release.draft,false);assert.equal(r.release.assets.length,3);assert.ok(!r.calls.some(a=>a[1]==='create'));const publish=r.calls.findIndex(a=>a.includes('--draft=false'));assert.ok(publish>r.calls.findIndex(a=>a[1]==='download'));});
test('creates a missing release as a draft before uploading',()=>{const r=simulate({existing:null});assert.equal(r.error,undefined);assert.equal(r.release.draft,false);assert.equal(r.calls.filter(a=>a[1]==='create').length,1);});
test('corrupted downloadable bytes prevent publication',()=>{const r=simulate({corrupt:true});assert.match(r.error.message,/Downloaded artifact differs/);assert.equal(r.release.draft,true);assert.ok(!r.calls.some(a=>a.includes('--draft=false')));});
test('published releases are immutable',()=>{const r=simulate({existing:'published'});assert.match(r.error.message,/already published/);assert.ok(!r.calls.some(a=>a[0]==='release'));});
