import {dayKey} from './core.mjs';
import {courseOf,courseLabel,filterSessions} from './learning.mjs';
import {distractionReasons} from './journey.mjs';

// Calendar days use local midnight; timer records belong to their end date.
export function growthAnalysis(state,{now=Date.now(),period=30,course=null}={}){
  period=[7,30,90].includes(Number(period))?Number(period):30;
  const today=new Date(now);today.setHours(0,0,0,0);
  const dates=Array.from({length:period},(_,i)=>{const d=new Date(today);d.setDate(d.getDate()-period+1+i);return d;});
  const start=dates[0].getTime(),days=dates.map(d=>({day:dayKey(d),seconds:0,count:0})),byDay=new Map(days.map(d=>[d.day,d]));
  const sessions=filterSessions(state.sessions,course).filter(s=>s.ended>=start&&s.ended<=now);
  const courses=new Map(),units=new Map();
  for(const s of sessions){
    const day=byDay.get(dayKey(s.ended));if(!day)continue;
    day.seconds+=s.seconds;day.count++;
    const key=courseOf(s),c=courses.get(key)||{course:key,label:courseLabel(key),seconds:0,count:0};c.seconds+=s.seconds;c.count++;courses.set(key,c);
    const q=s.quantity;if(!q)continue;
    const u=units.get(q.unit)||{unit:q.unit,target:0,actual:0,recorded:0,missing:0,days:days.map(d=>({day:d.day,target:0,actual:0,count:0}))};
    if(q.actual===undefined){u.missing++;}else{u.recorded++;u.target+=q.target;u.actual+=q.actual;const d=u.days[days.indexOf(day)];d.target+=q.target;d.actual+=q.actual;d.count++;}units.set(q.unit,u);
  }
  const causes=new Map();
  for(const t of state.thoughts){if(t.source!=='focus'||t.created<start||t.created>now||(course!==null&&courseOf(t)!==course))continue;
    const reason=distractionReasons.some(([key])=>key===t.reason)?t.reason:'unrecorded';
    const c=causes.get(reason)||{reason,label:distractionReasons.find(([key])=>key===reason)?.[1]||'未填写原因',count:0};c.count++;causes.set(reason,c);
  }
  const seconds=days.reduce((sum,d)=>sum+d.seconds,0),thoughtCount=[...causes.values()].reduce((sum,c)=>sum+c.count,0);
  return {period,course,start,now,days,sessions: sessions.length,seconds,activeDays:days.filter(d=>d.seconds>=60).length,average:seconds/period,
    courses:[...courses.values()].sort((a,b)=>b.seconds-a.seconds||a.label.localeCompare(b.label)).map(c=>({...c,share:seconds?c.seconds/seconds:0})),
    units:[...units.values()].sort((a,b)=>a.unit.localeCompare(b.unit)),causes:[...causes.values()].sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason)).map(c=>({...c,share:thoughtCount?c.count/thoughtCount:0})),thoughtCount};
}

export function quantityBuckets(unit,period){
  if(!unit)return [];
  const size=period<=7?1:7;
  const buckets=[];
  for(let i=0;i<unit.days.length;i+=size){const days=unit.days.slice(i,i+size);buckets.push({from:days[0].day,to:days.at(-1).day,target:days.reduce((n,d)=>n+d.target,0),actual:days.reduce((n,d)=>n+d.actual,0),count:days.reduce((n,d)=>n+d.count,0)});}
  return buckets;
}
