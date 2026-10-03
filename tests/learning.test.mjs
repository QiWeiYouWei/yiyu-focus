import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultState,validateState,dayKey} from '../web/core.mjs';
import {resumeTarget,courseNames,courseTotals,filterSessions,weeklyReview} from '../web/learning.mjs';
import {SyncTracker,validatePacket} from '../web/sync.mjs';
const record=(id,date,extra={})=>({id,title:'读第 3 节',note:'理解了反馈',seconds:900,ended:date.getTime(),day:dayKey(date),completed:true,...extra});
test('old records remain readable, while optional learning fields are validated',()=>{
 const s=defaultState();delete s.draft;s.sessions=[record('old',new Date(2026,9,3,12))];s.tasks=[{id:'t',title:'旧任务',done:false}];s.thoughts=[{id:'i',text:'旧念头',created:1,done:false}];
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))),s);
 for(const extra of [{course:2},{course:'x'.repeat(41)},{nextStep:[]},{nextStep:'x'.repeat(201)}])assert.throws(()=>validateState({...s,sessions:[{...s.sessions[0],...extra}]}));
 assert.throws(()=>validateState({...s,draft:{title:'x',course:[]}}));
 assert.throws(()=>validateState({...s,thoughts:[{...s.thoughts[0],source:'guessed'}]}));
});
test('next-step recovery prefers paused work, then a local draft, and uses synced next steps on a fresh device',()=>{
 const s=defaultState();s.sessions=[record('last',new Date(2026,9,3,12),{course:'模电',nextStep:'做第一道题'})];
 assert.equal(resumeTarget(s).title,'做第一道题');assert.equal(resumeTarget(s).course,'模电');
 s.draft={title:'看第 18 页',course:'英语'};assert.equal(resumeTarget(s).title,'看第 18 页');
 s.active={kind:'focus',title:'当前题目',course:'数学'};assert.equal(resumeTarget(s).title,'当前题目');
 s.active=null;s.draft={title:'',course:''};s.tasks=[{id:'done',title:'做第一道题',course:'模电',done:true},{id:'next',title:'新的小目标',done:false}];assert.equal(resumeTarget(s).title,'新的小目标');
});
test('course totals preserve uncategorized time, trimmed labels and independent courses with the same title',()=>{
 const s=defaultState(),date=new Date(2026,9,3,12);s.sessions=[record('a',date,{course:' 模电 ',seconds:600}),record('b',date,{course:'模电',seconds:300}),record('c',date,{seconds:120}),record('d',date,{course:'英语',seconds:60})];
 assert.deepEqual(courseTotals(s.sessions),[{course:'模电',seconds:900,count:2},{course:'',seconds:120,count:1},{course:'英语',seconds:60,count:1}]);
 assert.equal(filterSessions(s.sessions,'').length,1);assert.equal(filterSessions(s.sessions,'模电').length,2);assert.equal(filterSessions(s.sessions).length,4);assert.deepEqual(courseNames(s),['模电','英语']);
});
test('weekly review spans seven local calendar days, excludes future/outside records, and counts only captured focus thoughts',()=>{
 const now=new Date(2026,0,3,12).getTime(),s=defaultState();
 s.sessions=[record('edge',new Date(2025,11,28,0)),record('inside',new Date(2026,0,3,11)),record('outside',new Date(2025,11,27,23,59)),record('future',new Date(2026,0,3,13))];
 s.thoughts=[{id:'a',text:'查  车票',created:now-1,done:false,source:'focus',course:'英语'},{id:'b',text:'查 车票',created:now-2,done:true,source:'focus',course:'英语'},{id:'c',text:'购物',created:now-1,done:false,source:'inbox'},{id:'d',text:'旧念头',created:now-1,done:false}];
 const r=weeklyReview(s,now);assert.equal(r.start,'2025-12-28');assert.equal(r.end,'2026-01-03');assert.equal(r.sessions.length,2);assert.equal(r.seconds,1800);assert.equal(r.days,2);assert.equal(r.thoughtCount,2);assert.equal(r.thoughts[0].count,2);assert.equal(r.activities.length,1);
 assert.equal(weeklyReview(s,now,'').thoughtCount,0);assert.equal(weeklyReview(s,now,'英语').thoughtCount,2);
});
test('new learning fields round-trip through backups and two-device merge without syncing device drafts or timers',()=>{
 const a=defaultState(),b=defaultState();a.draft={title:'仅此设备的草稿',course:'模电'};a.tasks=[{id:'t',title:'下一题',course:'模电',done:false}];a.sessions=[record('s',new Date(2026,9,3,12),{course:'模电',nextStep:'从第 18 页继续'})];a.thoughts=[{id:'i',text:'查车票',created:1,done:false,source:'focus',course:'模电',sessionId:'s'}];
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(a))),a);
 const ta=new SyncTracker(a,'a'),tb=new SyncTracker(b,'b');validatePacket(ta.packet());tb.merge([ta.packet()]);const merged=tb.apply(b);
 assert.equal(merged.sessions[0].nextStep,'从第 18 页继续');assert.equal(merged.tasks[0].course,'模电');assert.equal(merged.thoughts[0].source,'focus');assert.equal(merged.draft.title,'');assert.equal(resumeTarget(merged).title,'从第 18 页继续');
 merged.sessions[0].course='信号与系统';tb.observe(merged);ta.merge([tb.packet()]);assert.equal(ta.apply(a).sessions[0].course,'信号与系统');assert.equal(ta.apply(a).draft.title,'仅此设备的草稿');
});

test('synced progress replaces generated recovery hints while explicit local drafts and deliberately blank targets survive',()=>{
 const s=defaultState();s.sessions=[record('old',new Date(2026,9,2,12),{nextStep:'旧下一步'}),record('new',new Date(2026,9,3,12),{course:'英语',nextStep:'新下一步'})];s.draft={title:'旧下一步',course:'模电',sessionId:'old'};assert.equal(resumeTarget(s).title,'新下一步');
 s.draft={title:'我手动选的目标',course:'数学',edited:true};assert.equal(resumeTarget(s).title,'我手动选的目标');
 s.draft={title:'',course:'数学',edited:true};assert.equal(resumeTarget(s),null);assert.doesNotThrow(()=>validateState(s));
 assert.throws(()=>validateState({...s,draft:{...s.draft,edited:'yes'}}));
});

test('weekly next-step plans remain the next target after cross-device sync and stop being suggested once completed',()=>{
 const a=defaultState(),b=defaultState(),ended=new Date(2026,9,3,10).getTime();a.sessions=[record('old',new Date(ended),{nextStep:'旧下一步'})];a.tasks=[{id:'planned',title:'读第 4 节',course:'英语',done:false,plannedAt:ended+1000}];const remote=new SyncTracker(a,'a'),local=new SyncTracker(b,'b');local.merge([remote.packet()]);const merged=local.apply(b);assert.equal(resumeTarget(merged).title,'读第 4 节');merged.tasks[0].done=true;assert.equal(resumeTarget(merged).title,'旧下一步');assert.throws(()=>validateState({...merged,tasks:[{...merged.tasks[0],plannedAt:'tomorrow'}]}));
});
