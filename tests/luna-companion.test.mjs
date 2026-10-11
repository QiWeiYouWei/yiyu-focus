import {test} from 'node:test';
import assert from 'node:assert/strict';
import {lunaReply,createLunaCompanion,recordedTime,lunaLifecycleContext} from '../web/luna-companion.mjs';
import {reactionFrame} from '../web/pet-animation.mjs';
test('encouragement describes only recorded effort and actual course context',()=>{
 assert.match(lunaReply('start',{course:'信号与系统'}),/信号与系统/);
 assert.match(lunaReply('encourage',{todaySeconds:0}),/还没开始/);
 assert.match(lunaReply('encourage',{todaySeconds:125}),/2 分钟/);
 assert.match(lunaReply('completion',{lastSeconds:31,completed:false}),/31 秒.*提前结束/);
 assert.match(lunaReply('completion',{lastSeconds:600,completed:true}),/10 分钟.*击个掌/);
 assert.equal(recordedTime(0),'0 秒');
 assert.match(lunaReply('encourage',{streak:4},1),/连续 4 天/);
 assert.doesNotMatch(lunaReply('encourage',{streak:0},1),/连续/);
});
test('responses expire and timer updates cannot create repeated automatic messages',()=>{
 let time=0;const luna=createLunaCompanion(()=>time);
 assert.equal(luna.respond('returned',{}, {key:'thought:1'}),true);
 time=15000;assert.equal(luna.read(),null);
 assert.equal(luna.respond('returned',{}, {key:'thought:1'}),false);
 assert.equal(luna.respond('start',{}),true);
 time+=100;assert.equal(luna.respond('paused',{}),false);assert.equal(luna.read(),null);
 assert.equal(luna.respond('completion',{lastSeconds:12},{key:'session:1'}),true);
 assert.equal(luna.respond('completion',{lastSeconds:12},{key:'session:1'}),false);
});
test('quiet mode silences automatic encouragement, while explicit interaction remains available',()=>{
 let time=0;const luna=createLunaCompanion(()=>time);
 assert.equal(luna.respond('greeting',{}, {quiet:true}),false);assert.equal(luna.read(true),null);
 luna.respond('start',{});assert.equal(luna.read(true),null);
 assert.equal(luna.respond('pet',{}, {quiet:true,manual:true}),true);const first=luna.read(true).text;
 assert.equal(luna.respond('pet',{}, {manual:true}),false);
 assert.equal(luna.respond('tired',{}, {quiet:true,manual:true}),true,'Different explicit needs respond without waiting');
 time=1000;luna.respond('pet',{}, {quiet:true,manual:true});assert.notEqual(luna.read(true).text,first);
 time=15000;assert.equal(luna.read(true),null);
});
test('manual reactions use existing valid poses, finish promptly and respect reduced motion',()=>{
 for(const kind of ['pet','tired','encourage','stuck']){
  const pose=reactionFrame(kind,0,false);assert.deepEqual(reactionFrame(kind,2000,false),pose);
  assert.ok(pose.row<11&&pose.column<8);assert.equal(reactionFrame(kind,2400),null);
 }
 assert.equal(reactionFrame('invalid',0),null);
 assert.equal(reactionFrame('pet',0).row,6);assert.equal(reactionFrame('tired',0).row,5);
});
test('opening and farewell support absent history, recorded effort and resumable work without guilt',()=>{
 const now=new Date(2026,9,9,12).getTime();
 const empty=lunaLifecycleContext(null,now);assert.equal(empty.todaySeconds,0);assert.equal(empty.saved,false);assert.doesNotMatch(lunaReply('goodbye',empty),/已经保存|已记录/);
 const context=lunaLifecycleContext({profile:{name:'小七'},sessions:[{seconds:180,day:'2026-10-09',ended:now}],active:{kind:'focus',running:false}},now);
 assert.equal(context.todaySeconds,180);assert.equal(context.resumable,true);assert.match(lunaReply('greeting',context),/小七.*上次/);assert.match(lunaReply('goodbye',context),/已暂停.*下次/);
 assert.match(lunaReply('goodbye',{todaySeconds:180}),/3 分钟/);
 assert.match(lunaReply('goodbye',{todaySeconds:0}),/不必责备/);
});
test('farewell bypasses automatic cooldown and is delivered once, respecting quiet mode',()=>{
 let time=0;const luna=createLunaCompanion(()=>time);luna.respond('start',{});time=50;
 assert.equal(luna.respond('goodbye',{}, {key:'close:1'}),true);assert.equal(luna.read().kind,'goodbye');assert.equal(luna.respond('goodbye',{}, {key:'close:1'}),false);
 assert.equal(luna.respond('goodbye',{}, {key:'close:2',quiet:true}),false);
 assert.equal(reactionFrame('goodbye',0,false).row,3);assert.equal(reactionFrame('greeting',0,false).row,3);
});
