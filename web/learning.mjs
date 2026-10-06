import {sessionParts} from './time-records.mjs';
import {dayKey} from './core.mjs';
export const courseOf = record => (record.course || '').trim();
export const courseLabel = course => course || '未分类';
export function courseNames(state) {
  return [...new Set([...state.tasks,...state.sessions,...state.thoughts,...(state.events||[]),...(state.focusPresets||[]),...(state.courseHabits||[]),state.active,state.draft].filter(Boolean).map(courseOf).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
}
export function filterSessions(sessions, course=null) {
  return course===null ? sessions : sessions.filter(s=>courseOf(s)===course);
}
export function courseTotals(sessions) {
  const totals=new Map();
  for(const s of sessions){const course=courseOf(s),row=totals.get(course)||{course,seconds:0,count:0};row.seconds+=s.seconds;row.count++;totals.set(course,row);}
  return [...totals.values()].sort((a,b)=>b.seconds-a.seconds||a.course.localeCompare(b.course,'zh-CN'));
}
export function resumeTarget(state) {
  if(state.active?.kind==='focus')return {quantity:state.active.quantity,title:state.active.title,course:courseOf(state.active),context:'正在进行的这一段'};
  if(state.draft?.edited&&!state.draft.title.trim())return null;
  if(state.draft?.title.trim()&&!state.draft.sessionId)return {...state.draft,title:state.draft.title.trim(),course:courseOf(state.draft),context:'上次留下的小目标'};
  const latest=[...state.sessions].sort((a,b)=>b.ended-a.ended||b.id.localeCompare(a.id))[0];
  const planned=state.tasks.filter(t=>!t.done&&t.plannedAt).sort((a,b)=>b.plannedAt-a.plannedAt)[0];
  if(planned&&(!latest||planned.plannedAt>latest.ended))return {quantity:planned.quantity,title:planned.title,course:courseOf(planned),context:'周回顾里留下的下一步'};
  if(latest?.nextStep?.trim()&&!state.tasks.some(t=>t.done&&t.title===latest.nextStep&&courseOf(t)===courseOf(latest)))return {title:latest.nextStep.trim(),course:courseOf(latest),context:'上次学到：'+latest.title};
  const task=state.tasks.find(t=>!t.done);
  if(task)return {quantity:task.quantity,title:task.title,course:courseOf(task),context:'待办里的下一件小事'};
  return latest ? {title:latest.title,course:courseOf(latest),context:'接着最近一次学习'} : null;
}
export function weeklyReview(state, now=Date.now(), course=null) {
  const end=new Date(now),start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-6);
  const inRange=p=>p.day>=dayKey(start)&&p.day<=dayKey(end);const sessions=filterSessions(state.sessions,course).filter(s=>s.ended<=now&&sessionParts(s).some(inRange)).sort((a,b)=>b.ended-a.ended);
  const thoughts=state.thoughts.filter(t=>t.source==='focus'&&t.created>=start.getTime()&&t.created<=now&&(course===null||courseOf(t)===course));
  const groups=new Map();
  for(const t of thoughts){const text=t.text.trim().replace(/\s+/g,' '),key=text.toLocaleLowerCase();const row=groups.get(key)||{text,count:0,latest:0};row.count++;row.latest=Math.max(row.latest,t.created);groups.set(key,row);}
  const activities=new Map();
  for(const s of sessions){const key=JSON.stringify([courseOf(s),s.title]);const row=activities.get(key)||{title:s.title,course:courseOf(s),seconds:0,count:0};row.seconds+=sessionParts(s).filter(inRange).reduce((n,p)=>n+p.seconds,0);row.count++;activities.set(key,row);}
  return {start:dayKey(start),end:dayKey(end),sessions,seconds:sessions.reduce((sum,s)=>sum+sessionParts(s).filter(inRange).reduce((n,p)=>n+p.seconds,0),0),days:new Set(sessions.flatMap(s=>sessionParts(s).filter(p=>inRange(p)&&p.seconds>0).map(p=>p.day))).size,
    activities:[...activities.values()],notes:sessions.filter(s=>s.note.trim()),thoughtCount:thoughts.length,thoughts:[...groups.values()].sort((a,b)=>b.count-a.count||b.latest-a.latest)};
}
