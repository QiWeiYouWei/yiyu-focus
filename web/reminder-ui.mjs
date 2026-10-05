import {reminderTime} from './journey.mjs';
export function setupReminders({getState,toast,navigate,showEvent}){
 const $=s=>document.querySelector(s);let current=null,last='',queue=Promise.resolve(),seen={};try{seen=JSON.parse(localStorage.getItem('yiyu-reminders-v1')||'{}');}catch{}
 const mark=(key,value)=>{seen[key]=value;const keys=Object.keys(seen);if(keys.length>1000)for(const k of keys.slice(0,keys.length-1000))delete seen[k];localStorage.setItem('yiyu-reminders-v1',JSON.stringify(seen));};
 function show(eventId){const event=(getState().events||[]).find(e=>e.id===eventId);if(!event||event.done)return;current=event;$('#reminder-event-title').textContent=event.title;if(!document.querySelector('dialog[open]'))$('#reminder-dialog').showModal();else toast('日历提醒：'+event.title);}
 async function schedule(){const events=getState().events||[],key=JSON.stringify(events);if(key===last)return;last=key;try{if(window.desktop?.calendarSchedule){queue=queue.catch(()=>{}).then(()=>window.desktop.calendarSchedule(events));await queue;}}catch(error){if(last===key)last='';toast('安排已保存，但提醒设置未成功：'+error.message);}}
 function tick(){if(window.desktop?.calendarSchedule)return;for(const event of getState().events||[]){const time=reminderTime(event);if(time===null)continue;const key=event.id+':'+time,stored=seen[key];if(stored==='done')continue;const at=typeof stored==='number'?stored:time;if(at<=Date.now()&&Date.now()-at<86400000){mark(key,'done');show(event.id);}}}
 $('#reminder-dismiss').onclick=()=>$('#reminder-dialog').close();$('#reminder-open').onclick=()=>{if(!current)return;$('#reminder-dialog').close();navigate('calendar');showEvent(current.id);};$('#reminder-snooze').onclick=async()=>{if(!current)return;try{if(window.desktop?.calendarSnooze)await window.desktop.calendarSnooze(current.id);else mark(current.id+':'+reminderTime(current),Date.now()+600000);$('#reminder-dialog').close();toast('10 分钟后再提醒。');}catch(error){toast(error.message);}};
 window.desktop?.onReminder?.(id=>show(id));
 return {schedule,tick,show};
}
