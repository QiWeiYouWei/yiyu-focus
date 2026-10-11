// Written, local companionship. Only recorded time and explicit actions inform replies.
import {stats} from './core.mjs';
const short=(value,max=14)=>String(value||'').replace(/\s+/g,' ').slice(0,max);
export function lunaLifecycleContext(state,now=Date.now()){
 return {name:state?.profile?.name||'',todaySeconds:stats(state?.sessions||[],now).today,resumable:state?.active?.kind==='focus',saved:!!state};
}
export function recordedTime(seconds){return seconds>=60?`${Math.floor(seconds/60)} 分钟`:`${Math.floor(seconds||0)} 秒`;}
export function lunaReply(kind,context={},variant=0){
 const course=short(context.course),target=short(context.title),name=short(context.name,8);
 const replies={
  greeting:[`${name?name+'，':''}欢迎回来。${context.resumable?'上次那一小步还在，准备好了再继续。':'不用一下追上所有进度，先迈一小步就好。'}`,`${name?name+'，':''}很高兴又见到你。先读一行，也是在向前。`,'今天的开始，不需要完美。留一点时间给自己吧。'],
  goodbye:context.saved===false?['今天先到这里。慢慢来，每一次回来都算数。','照顾好自己，准备好了再迈一小步。下次见。']:context.resumable?['这一段已暂停。下次从这里继续，今天先照顾好自己。','记录已经保存，没做完也没关系。准备好了，再接着来。']:context.todaySeconds>0?[`今天已记录 ${recordedTime(context.todaySeconds)}。这些努力都算数，安心休息，下次见。`,'今天先到这里。已经迈出的小步不会消失，给自己一点休息。']:['今天先到这里。还没开始也不必责备自己，下次从一小步开始。','休息也是照顾自己。慢慢来，每一次回来都算数。'],
  start:[`${course?'一起学 '+course+'。':'好，我们开始啦。'}先做好眼前这一小步。`,`${target?'先做「'+target+'」。':'先专注这一小段。'}不用一次解决全部。`],
  resume:['回来就很好。我们从刚才停下的地方继续。','走神也没关系，愿意回来就是新的开始。'],
  paused:['先缓一缓。暂停不会抹掉已经付出的努力。','节奏可以慢一点，准备好了再继续。'],
  rest:['这一小段辛苦啦。松松肩膀，也让眼睛歇一歇。','现在可以安心休息，下一段等你准备好。'],
  waiting:['已经到点啦。读完这一段，或现在收尾，都可以。'],
  returned:['念头已经安放好了。回来这一步，也值得肯定。','分心不代表失败。先把注意力放回眼前这一行。'],
  completion:[`这一段投入了 ${recordedTime(context.lastSeconds)}。${context.completed?'认真走完一小段，给你击个掌！':'即使提前结束，这些投入也算数。'}`],
  pet:['收到摸摸啦 ♡ 给认真生活的你一个小小的击掌。','嘿嘿，充到一点电啦。你也可以对自己温柔一点。','在呢。歇一口气，再决定下一步就好。'],
  encourage:[context.todaySeconds>0?`今天已经记录了 ${recordedTime(context.todaySeconds)}。这些小步，都是真实的。`:'还没开始也没关系。先打开资料，读一行就好。',context.streak>1?`已连续 ${context.streak} 天留下专注记录。今天也按自己的节奏来。`:'不必等状态完美。做一点点，也是在向前。','你不需要靠一整天的高效率，才值得被肯定。'],
  tired:['有点累了呀。松松肩膀，喝口水；休息也是照顾自己。','今天可以少做一点。先照顾身体，再决定要不要继续。'],
  stuck:['没跟上会着急，但进度不等于你的价值。先选一个知识点就好。','卡住时，把问题缩小：哪一步不懂？我们先把它记下来。','暂时不会很正常。先看一个例题，再试着写第一步。']
 };
 const choices=replies[kind]||replies.encourage;return choices[Math.abs(variant)%choices.length];
}
export function createLunaCompanion(now=()=>Date.now()){
 let message=null,lastAuto=-Infinity,lastManual=-Infinity,lastManualKind;const variants=new Map(),seen=new Set();
 return {
  respond(kind,context,{manual=false,key,quiet=false,variant:chosenVariant}={}){
   const time=now();if(key&&seen.has(key))return false;
   if(quiet&&!manual)return false;
   if(manual&&kind===lastManualKind&&time-lastManual<600)return false;
   if(!manual&&!['completion','greeting','goodbye'].includes(kind)&&time-lastAuto<3000){if(!message?.manual)message=null;return false;}
   if(key){seen.add(key);if(seen.size>100)seen.delete(seen.values().next().value);}
   const variant=chosenVariant??variants.get(kind)??0;variants.set(kind,variant+1);
   message={kind,text:lunaReply(kind,context,variant),manual,until:time+(manual?14000:11000)};
   if(manual){lastManual=time;lastManualKind=kind;}else if(kind!=='greeting')lastAuto=time;
   return true;
  },
  read(quiet=false){if(message&&(now()>=message.until||quiet&&!message.manual))message=null;return message;},
  clearAutomatic(){if(!message?.manual)message=null;}
 };
}
