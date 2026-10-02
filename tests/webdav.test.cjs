const test=require('node:test'),assert=require('node:assert/strict');
const {Nutstore,parseListing,BASE}=require('../desktop/webdav.cjs');
const device='11111111-1111-4111-8111-111111111111',name=device+'.json';
const xml=(etag='&quot;v1&quot;',files=true)=>`<d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav/YiyuFocus/</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>${files?`<d:response><d:href>/dav/YiyuFocus/${name}</d:href><d:propstat><d:prop><d:getetag>${etag}</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`:''}</d:multistatus>`;
test('DAV parser rejects external entities and ignores foreign paths',()=>{
  assert.deepEqual(parseListing(xml()),[{name,etag:'"v1"'}]);assert.deepEqual(parseListing(xml().replace('/dav/YiyuFocus/'+name,'https://evil.example/'+name)),[]);
  assert.throws(()=>parseListing('<!DOCTYPE x><xml/>'));assert.throws(()=>parseListing('<error>no</error>'));
});
test('ETag caching avoids extra transfers and conditional PUT prevents overwrites',async()=>{
  const packet={version:1,entries:[]},requests=[];let version='v1';
  const fetcher=async(url,options)=>{requests.push({url,...options});if(options.method==='PROPFIND')return new Response(xml(`&quot;${version}&quot;`),{status:207});if(options.method==='GET')return new Response(JSON.stringify(packet),{headers:{etag:'"v1"'}});if(options.method==='PUT'){assert.equal(options.headers['If-Match'],'"v1"');version='v2';return new Response(null,{status:204,headers:{etag:'"v2"'}});}throw Error('unexpected');};
  const client=new Nutstore({username:'me@example.com',password:'app-password'},fetcher);const validate=()=>{};
  await client.read(validate);await client.read(validate);assert.equal(requests.filter(r=>r.method==='GET').length,1);
  assert.equal(await client.write(device,packet,validate),false);assert.equal(requests.filter(r=>r.method==='PUT').length,0);
  await client.write(device,{...packet,entries:[1]},validate);assert.equal(requests.filter(r=>r.method==='PUT').length,1);assert.ok(requests.every(r=>r.url.startsWith(BASE)&&r.redirect==='error'));
});
test('first upload cannot replace an existing file; authorization failures surface',async()=>{
  let seen=false;const client=new Nutstore({username:'me@example.com',password:'app-password'},async(_url,o)=>{
    if(o.method==='PROPFIND')return new Response(xml('',false),{status:207});seen=true;assert.equal(o.headers['If-None-Match'],'*');return new Response('',{status:412});
  });await client.read(()=>{});await assert.rejects(client.write(device,{version:1,entries:[]},()=>{}),/变化/);assert.ok(seen);
  const bad=new Nutstore({username:'me@example.com',password:'wrong'},async()=>new Response('',{status:401}));await assert.rejects(bad.connect(),/应用密码/);
});
test('network and malformed JSON never become a successful sync',async()=>{
  const offline=new Nutstore({username:'me@example.com',password:'x'},async()=>{throw Error('ENOTFOUND');});await assert.rejects(offline.connect(),/连接不到/);
  const broken=new Nutstore({username:'me@example.com',password:'x'},async(_url,o)=>new Response(o.method==='PROPFIND'?xml():'broken',{status:o.method==='PROPFIND'?207:200}));await assert.rejects(broken.read(()=>{}),/损坏/);
});
