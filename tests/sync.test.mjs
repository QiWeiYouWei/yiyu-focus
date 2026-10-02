import test from 'node:test';
import assert from 'node:assert/strict';
import {SyncTracker,validatePacket} from '../web/sync.mjs';
import {defaultState,dayKey} from '../web/core.mjs';
const task=(id,title)=>({id,title,done:false});
test('two offline devices merge additions without duplicating sessions',()=>{
  const a=defaultState(),b=defaultState();a.tasks.push(task('a','电脑'));b.tasks.push(task('b','手机'));
  const ended=Date.now(),s={id:'same',title:'study',note:'',seconds:60,ended,day:dayKey(ended),completed:true};a.sessions.push(s);b.sessions.push(s);
  const ta=new SyncTracker(a,'a'),tb=new SyncTracker(b,'b');ta.merge([tb.packet()]);tb.merge([ta.packet()]);
  assert.deepEqual(ta.packet(),tb.packet());assert.equal(ta.apply(a).tasks.length,2);assert.equal(ta.apply(a).sessions.length,1);
});
test('deleted records do not return from stale devices; later edits converge',()=>{
  const a=defaultState();a.tasks=[task('one','旧任务')];const ta=new SyncTracker(a,'a');
  const b=structuredClone(a);b.sync={packet:ta.packet()};const tb=new SyncTracker(b,'b');
  a.tasks=[];ta.observe(a);tb.merge([ta.packet()]);assert.equal(tb.apply(b).tasks.length,0);
  const stale=new SyncTracker({...b,sync:{packet:tb.packet()}},'c'); // intentional restoration is a newer local edit
  ta.merge([stale.packet()]);assert.equal(ta.apply(a).tasks.length,1);
});
test('fresh device does not overwrite existing preferences; timer stays local',()=>{
  const remote=defaultState();remote.profile.name='Aromix';remote.profile.goal=90;const r=new SyncTracker(remote,'remote');
  const local=defaultState();local.active={id:'timer',kind:'focus',title:'现在',duration:15,elapsed:100,anchor:Date.now(),running:true};const l=new SyncTracker(local,'local');l.merge([r.packet()]);const merged=l.apply(local);
  assert.equal(merged.profile.name,'Aromix');assert.equal(merged.profile.goal,90);assert.equal(merged.active.id,'timer');assert.ok(!JSON.stringify(l.packet()).includes('timer'));
});
test('invalid packets fail atomically and poisoned profile keys are rejected',()=>{
  const state=defaultState(),tracker=new SyncTracker(state,'local'),before=structuredClone(tracker.packet());
  const other=defaultState();other.tasks=[task('new','remote')];
  assert.throws(()=>tracker.merge([new SyncTracker(other,'remote').packet(),{version:2}]));assert.deepEqual(tracker.packet(),before);
  assert.throws(()=>validatePacket({version:1,entries:[{group:'profile',id:'__proto__',value:{},clock:{time:1,device:'x'}}]}));
});
test('checkpoints alone do not mark the cloud document dirty; metadata survives restart',()=>{
  const state=defaultState(),t=new SyncTracker(state,'one');state.active={id:'run'};assert.equal(t.observe(state),false);state.sync={packet:t.packet()};assert.deepEqual(new SyncTracker(state,'one').packet(),t.packet());
});
