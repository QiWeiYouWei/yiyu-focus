import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,validateState,checkpoint,dailyTotals} from '../web/core.mjs';
import {splitIntervals,manualSession,validSegments} from '../web/time-records.mjs';
import {recurrenceDates,expandSeries,replaceFuture} from '../web/recurrence.mjs';
import {validateRelay,offerRelay,settleRelay,relayTransition,compactRelay} from '../web/relay.mjs';
import {weeklyReview} from '../web/learning.mjs';
import {weeklyInsights} from '../web/journey.mjs';
import {growthAnalysis} from '../web/growth.mjs';
import {SyncTracker} from '../web/sync.mjs';
import {Nutstore} from '../desktop/webdav.cjs';
const ts=s=>+new Date(s),owner='nutstore:test@example.com',devices=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const active=()=>({id:crypto.randomUUID(),kind:'focus',title:'第 3 节',course:'模电',duration:25,elapsed:0,anchor:ts('2026-10-05T23:58:00'),running:true,segments:[],quantity:{target:3,unit:'页'},eventId:'ev'});
const base=()=>({id:'event',title:'阅读',icon:'📚',date:'2026-10-05',endDate:'2026-10-06',time:'18:00',endTime:'19:00',deadline:'2026-10-07T20:00',notes:'',course:'模电',done:false,created:1,updated:1,reminder:{anchor:'start',minutes:60}});
test('tracked intervals exclude pauses and split midnight exactly, including second rounding',()=>{
 let a=checkpoint(active(),ts('2026-10-05T23:59:00'),true);a.anchor=ts('2026-10-06T00:01:00');a.running=true;a=checkpoint(a,ts('2026-10-06T00:03:00'),true);
 assert.equal(a.elapsed,180000);assert.ok(validSegments(a.segments,a.elapsed));assert.deepEqual(splitIntervals(a.segments,180),[{day:'2026-10-05',seconds:60},{day:'2026-10-06',seconds:120}]);
 assert.deepEqual(splitIntervals([{start:ts('2026-10-05T23:59:59.600'),end:ts('2026-10-06T00:00:00.600')}],1),[{day:'2026-10-06',seconds:1}]);
 const capped=checkpoint(active(),ts('2026-10-06T04:00:00'),true);assert.equal(capped.elapsed,1500000);assert.equal(splitIntervals(capped.segments,1500).reduce((n,p)=>n+p.seconds,0),1500);
 assert.throws(()=>splitIntervals(a.segments,100));assert.equal(validSegments([{start:2,end:1}],0),false);const legacy=active();delete legacy.segments;assert.equal(checkpoint(legacy,legacy.anchor+1000).segments,undefined);
});
test('manual records preserve original corrections and linked learning data through backups and sync',()=>{
 const now=ts('2026-10-07T12:00:00'),s=manualSession({title:'阅读',course:'模电',minutes:20,ended:ts('2026-10-06T00:10:00'),note:'收获'},null,now);
 assert.deepEqual(s.parts,[{day:'2026-10-05',seconds:600},{day:'2026-10-06',seconds:600}]);s.eventId='ev';s.quantity={target:3,unit:'页',actual:2};
 const changed=manualSession({title:s.title,course:s.course,minutes:10,ended:s.ended,note:s.note},s,now);const twice=manualSession({title:s.title,course:s.course,minutes:15,ended:s.ended,note:s.note},changed,now);
 assert.equal(twice.id,s.id);assert.equal(twice.original.seconds,1200);assert.equal(twice.eventId,'ev');assert.equal(twice.quantity.actual,2);assert.equal(twice.corrected,true);assert.equal(twice.source,'manual');
 const state=defaultState();state.sessions=[twice];validateState(JSON.parse(JSON.stringify(state)));const a=new SyncTracker(state,devices[0]),b=new SyncTracker(defaultState(),devices[1]);b.merge([a.packet()]);assert.deepEqual(b.apply(defaultState()).sessions,[twice]);
 for(const values of [{minutes:0},{minutes:121},{ended:now+1},{title:''}])assert.throws(()=>manualSession({title:'x',minutes:1,ended:now,note:'',...values},null,now));
 assert.throws(()=>validateState({...state,sessions:[{...twice,parts:[{day:twice.day,seconds:1}]}]}));
});
test('daily, weekly and course analytics reconcile only portions inside their date windows',()=>{
 const now=ts('2026-10-06T12:00:00'),s=manualSession({title:'跨日',course:'模电',minutes:20,ended:ts('2026-09-30T00:10:00'),note:''},null,now),state=defaultState();state.sessions=[s];
 assert.deepEqual(dailyTotals(state.sessions),{'2026-09-29':600,'2026-09-30':600});assert.equal(weeklyReview(state,now).seconds,600);assert.equal(weeklyInsights(state,now).courses[0].seconds,600);
 const data=growthAnalysis(state,{now,period:7});assert.equal(data.seconds,600);
});
test('recurrence expands local dates, deadlines and reminders and edits future instances without erasing history',()=>{
 assert.deepEqual(recurrenceDates('2026-10-05',{kind:'weekly',days:[1,3],until:'2026-10-12'}),['2026-10-05','2026-10-07','2026-10-12']);assert.equal(recurrenceDates('2026-10-05',{kind:'weekdays',days:[],until:'2026-10-11'}).length,5);
 assert.equal(recurrenceDates('2028-02-28',{kind:'daily',days:[],until:'2028-03-01'}).length,3);assert.throws(()=>recurrenceDates('2026-10-05',{kind:'daily',days:[],until:'2028-01-01'}));assert.throws(()=>recurrenceDates('2026-10-05',{kind:'weekly',days:[],until:'2026-10-12'}));
 const rule={kind:'daily',days:[],until:'2026-10-09'},rows=expandSeries(base(),rule);rows[0].done=true;rows[3].done=true;assert.equal(rows[1].endDate,'2026-10-07');assert.equal(rows[1].deadline,'2026-10-08T20:00');assert.equal(rows[1].reminder.minutes,60);
 const next=replaceFuture(rows,rows[2],{...rows[2],title:'新目标'}, {...rule,until:'2026-10-08'},2);assert.deepEqual(next.events.slice(0,2),rows.slice(0,2));assert.equal(next.events[2].id,rows[2].id);assert.equal(next.events[3].done,true);assert.equal(next.removed[0].id,rows[4].id);validateState({...defaultState(),events:next.events});
});
test('handoff preserves paused work and forbids source reclaim, changed payloads and forged devices',()=>{
 const a=checkpoint(active(),ts('2026-10-05T23:59:00'),true),offer=offerRelay(null,owner,devices[0],a,'第 18 页','Windows');validateRelay(offer.doc);
 assert.equal(offer.transfer.active.elapsed,60000);assert.equal(offer.transfer.active.quantity.target,3);assert.equal(offer.transfer.position,'第 18 页');assert.throws(()=>settleRelay(offer.doc,offer.transfer.id,devices[0]));assert.throws(()=>settleRelay(offer.doc,offer.transfer.id,devices[1],true));
 const claimed=settleRelay(offer.doc,offer.transfer.id,devices[1]);assert.throws(()=>settleRelay(claimed,offer.transfer.id,devices[2]));const bad=structuredClone(claimed);bad.transfers[0].active.elapsed++;assert.throws(()=>relayTransition(offer.doc,bad,devices[1]));
 assert.doesNotThrow(()=>relayTransition(offer.doc,{transfers:claimed.transfers,owner,version:1},devices[1]));assert.throws(()=>offerRelay(offer.doc,owner,devices[0],a));assert.throws(()=>validateRelay({...offer.doc,transfers:[{...offer.transfer,active:{...a,running:true}}]}));
});
test('native WebDAV uses compare-and-swap for simultaneous claims and ambiguous offer cancellation',async()=>{
 let doc=null,tag=null,sequence=0,lost=false;const transport=async(url,o)=>{assert.ok(url.endsWith('/handoff.json'));if(o.method==='GET')return new Response(doc?JSON.stringify(doc):null,{status:doc?200:404,headers:doc?{etag:tag}:{}});assert.equal(o.method,'PUT');const matches=tag===null?o.headers['If-None-Match']==='*':o.headers['If-Match']===tag;if(!matches)return new Response(null,{status:412});doc=JSON.parse(o.body);tag='"'+(++sequence)+'"';if(lost)throw Error('lost reply');return new Response(null,{status:204,headers:{etag:tag}});};
 const clients=devices.map(()=>new Nutstore({username:'test@example.com',password:'TEST-ONLY'},transport));const write=(client,device,remote,next)=>client.relayWrite(device,{owner,etag:remote.etag,doc:next},validateRelay,relayTransition);
 let remote=await clients[0].relayRead(validateRelay),offer=offerRelay(null,owner,devices[0],checkpoint(active(),ts('2026-10-05T23:59:00'),true));await write(clients[0],devices[0],remote,offer.doc);
 const [a,b]=await Promise.all([clients[1].relayRead(validateRelay),clients[2].relayRead(validateRelay)]);await write(clients[1],devices[1],a,settleRelay(a.doc,offer.transfer.id,devices[1]));await assert.rejects(write(clients[2],devices[2],b,settleRelay(b.doc,offer.transfer.id,devices[2])),/变化/);assert.equal(doc.transfers[0].to,devices[1]);
 remote=await clients[0].relayRead(validateRelay);offer=offerRelay(remote.doc,owner,devices[0],checkpoint(active(),ts('2026-10-05T23:59:00'),true));lost=true;await assert.rejects(write(clients[0],devices[0],remote,offer.doc),/连接不到/);lost=false;remote=await clients[0].relayRead(validateRelay);assert.equal(remote.doc.transfers.at(-1).status,'offered');await write(clients[0],devices[0],remote,settleRelay(remote.doc,offer.transfer.id,devices[0],true));assert.equal(doc.transfers.at(-1).status,'cancelled');
});
test('handoff recovery records are retained until both devices acknowledge local persistence',()=>{
 const offer=offerRelay(null,owner,devices[0],checkpoint(active(),ts('2026-10-05T23:59:00'),true)),claimed=settleRelay(offer.doc,offer.transfer.id,devices[1]);
 const ack=structuredClone(claimed);ack.transfers[0].acknowledged=true;assert.throws(()=>relayTransition(claimed,ack,devices[1]));assert.doesNotThrow(()=>relayTransition(claimed,ack,devices[0]));
 assert.throws(()=>relayTransition(ack,{...ack,transfers:[]},devices[0]));const received=structuredClone(ack);received.transfers[0].received=true;assert.doesNotThrow(()=>relayTransition(ack,received,devices[1]));assert.throws(()=>relayTransition(ack,received,devices[2]));assert.doesNotThrow(()=>relayTransition(received,{...received,transfers:[]},devices[0]));
 const many={version:1,owner,transfers:Array.from({length:100},(_,i)=>({...claimed.transfers[0],id:crypto.randomUUID()}))};assert.throws(()=>compactRelay(many));many.transfers[3]={...many.transfers[3],received:true,acknowledged:true};assert.equal(compactRelay(many).transfers.length,99);assert.equal(compactRelay(many).transfers.some(t=>t.id===many.transfers[3].id),false);
});
test('completion feedback uses recorded goal, streak and time crossings',async()=>{
 globalThis.matchMedia=()=>({matches:false});const {milestone}=await import('../web/celebration.mjs'),now=ts('2026-10-06T12:00:00');const s=manualSession({title:'学习',ended:now,minutes:5,note:''},null,now);
 assert.equal(milestone([], [s],5,now).key,'goal:2026-10-06');assert.equal(milestone([s],[s],5,now),null);const hour={...s,seconds:3600,parts:[{day:s.day,seconds:3600}]};assert.equal(milestone([],[hour],120,now).key,'hours:1');
});
