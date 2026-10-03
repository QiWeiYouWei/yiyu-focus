import {checkpoint,elapsed,defaultState,validateState} from './core.mjs';
export function reachGoal(active,now=Date.now()){return {...checkpoint(active,now,true),waiting:true,paragraph:false,goalDuration:active.goalDuration||active.duration};}
export function extendFocus(active,minutes=5,paragraph=false,now=Date.now()){
 if(!active||active.kind!=='focus')throw Error('没有正在进行的专注');
 const next=checkpoint(active,now,true),duration=Math.min(120,active.duration+minutes);if(duration<=active.duration)throw Error('单次最多 120 分钟，请先保存这一段');
 return {...next,duration,goalDuration:active.goalDuration||active.duration,waiting:false,paragraph,running:true,anchor:now};
}
export function timerView(active,duration=15,now=Date.now()){
 const used=elapsed(active,now),paragraph=!!active?.paragraph,remaining=active?Math.max(0,active.duration*60000-used):duration*60000;
 const seconds=Math.ceil((paragraph?Math.max(0,used-(active.goalDuration||active.duration)*60000):remaining)/1000);
 return {text:(paragraph?'+':'')+String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'),waiting:!!active?.waiting,paragraph};
}
export function rememberHabit(state,values){
 const course=values.course.trim();if(!course)throw Error('请填写课程名称');const list=state.courseHabits||[],old=list.find(h=>h.course===course);
 const habit={id:old?.id||'course:'+course,minutes:15,material:'',position:'',...old,...values,course,updated:Date.now()};validateState({...state,courseHabits:[...list.filter(h=>h.id!==habit.id),habit]});state.courseHabits??=[];if(old)Object.assign(old,habit);else state.courseHabits.push(habit);return habit;
}
export function recycle(state,kind,id,now=Date.now()){
 const record=state[kind].find(r=>r.id===id);if(!record)return false;
 state.trash=[...(state.trash||[]).filter(t=>now-t.deleted<30*86400000),{id:crypto.randomUUID(),kind,record:structuredClone(record),deleted:now}].slice(-1000);state[kind]=state[kind].filter(r=>r.id!==id);return true;
}
export function recover(state,id){
 const item=(state.trash||[]).find(t=>t.id===id);if(!item||Date.now()-item.deleted>=30*86400000)throw Error('这条内容已不在回收站');if(state[item.kind].some(r=>r.id===item.record.id))throw Error('这条记录已经存在，不会覆盖');
 state[item.kind].push(structuredClone(item.record));state.trash=state.trash.filter(t=>t.id!==id);if(item.kind==='sessions')state.sessions.sort((a,b)=>a.ended-b.ended);return item;
}
