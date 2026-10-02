import test from 'node:test';
import assert from 'node:assert/strict';
import {dayKey,elapsed,checkpoint,stats,validateState,defaultState} from '../web/core.mjs';
test('timer measures wall time, excludes pauses and clamps at completion',()=>{
  const a={duration:1,elapsed:10000,anchor:100000,running:true};
  assert.equal(elapsed(a,105000),15000);
  const paused=checkpoint(a,105000,true);
  assert.equal(elapsed(paused,200000),15000);
  assert.equal(elapsed({...paused,anchor:200000,running:true},220000),35000);
  assert.equal(elapsed(a,300000),60000);
  assert.equal(elapsed(a,0),10000);
});
test('streaks handle yesterday, missing days and sub-minute sessions',()=>{
  const sessions=[['2026-09-21',60],['2026-09-22',90],['2026-09-23',60],['2026-09-25',60],['2026-09-26',30],['2026-09-26',30],['2026-09-27',20]].map(([day,seconds])=>({day,seconds}));
  const s=stats(sessions,new Date('2026-09-27T12:00:00'));
  assert.equal(s.streak,2);assert.equal(s.longestStreak,3);assert.equal(s.today,20);assert.equal(s.total,350);assert.equal(s.longest,90);
  assert.equal(stats([],Date.now()).longest,0);
});
test('local day keys and year boundaries',()=>{
  assert.equal(dayKey(new Date(2026,0,1,0,1)),'2026-01-01');
  assert.equal(stats([{day:'2025-12-31',seconds:60},{day:'2026-01-01',seconds:60}],new Date(2026,0,1,12)).streak,2);
});
test('backup rejects corrupt structures, accepts complete round trip',()=>{
  const data=defaultState();assert.deepEqual(validateState(JSON.parse(JSON.stringify(data))),data);
  assert.throws(()=>validateState({...data,version:2}));
  assert.throws(()=>validateState({...data,active:{duration:1}}));
  assert.throws(()=>validateState({...data,profile:{...data.profile,duration:Infinity}}));
  assert.throws(()=>validateState({...data,sessions:[{seconds:-1}]}));
  assert.throws(()=>validateState({...data,tasks:[{id:4,title:'x',done:false}]}));
});
