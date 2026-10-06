import {dayKey,validEvent,validDate} from './planning.mjs';
const date=v=>new Date(v+'T12:00:00');
const offset=(a,b)=>Math.round((date(b)-date(a))/86400000);
const plus=(v,n)=>{const d=date(v);d.setDate(d.getDate()+n);return dayKey(d);};
export function recurrenceDates(start,rule){
 if(!validDate(start)||!rule||!validDate(rule.until)||rule.until<start||offset(start,rule.until)>366||!['daily','weekdays','weekly'].includes(rule.kind)||!Array.isArray(rule.days)||rule.days.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(rule.days).size!==rule.days.length||rule.kind==='weekly'&&!rule.days.length)throw Error('重复安排需要有效的日期和星期，结束日期最多在一年后。');
 const days=[];for(let current=start;current<=rule.until;current=plus(current,1)){const weekday=date(current).getDay()||7;if(rule.kind==='daily'||rule.kind==='weekdays'&&weekday<=5||rule.kind==='weekly'&&rule.days.includes(weekday))days.push(current);}
 if(!days.length)throw Error('此日期范围内没有符合条件的安排。');return days;
}
export function expandSeries(base,rule,seriesId=crypto.randomUUID()){
 return recurrenceDates(base.date,rule).map(current=>{const e={...structuredClone(base),id:seriesId+':'+current,seriesId,repeat:structuredClone(rule),date:current,endDate:plus(current,offset(base.date,base.endDate)),deadline:base.deadline?plus(current,offset(base.date,base.deadline.slice(0,10)))+base.deadline.slice(10):''};if(!validEvent(e))throw Error('重复安排超出有效日期范围。');return e;});
}
export function replaceFuture(events,old,base,rule,now=Date.now()){
 if(!old.seriesId)throw Error('这项安排不属于重复系列');
 const upcoming=events.filter(e=>e.seriesId===old.seriesId&&e.date>=old.date),past=events.filter(e=>!upcoming.includes(e));
 const next=rule?expandSeries(base,rule,old.seriesId):[{...base,id:old.id,seriesId:old.seriesId}];
 for(const e of next){const prior=upcoming.find(p=>p.id===e.id)||upcoming.find(p=>p.date===e.date);if(prior){e.id=prior.id;e.created=prior.created;e.done=prior.id===old.id?base.done:prior.done;}e.updated=now;}
 return {events:[...past,...next],removed:upcoming.filter(e=>!next.some(n=>n.id===e.id))};
}
