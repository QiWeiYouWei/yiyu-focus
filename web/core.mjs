import {dayKey,validQuantity,validEvent,validPreset} from './planning.mjs';
export {dayKey} from './planning.mjs';
export const defaultState = () => ({ version: 1, profile: { name: '学习中的你', motto: '慢慢来，每一次回来都算数。', goal: 60, duration: 15, breakMinutes: 5, sound: true }, tasks: [], sessions: [], thoughts: [], active: null, draft: {title: '', course: ''}, courseHabits: [], events: [], focusPresets: [], trash: [] });
export function elapsed(active, now = Date.now()) {
  if (!active) return 0;
  return Math.min(active.duration * 60000, Math.max(0, active.elapsed + (active.running ? Math.max(0, now-active.anchor) : 0)));
}
export function checkpoint(active, now = Date.now(), pause = false) {
  return active ? { ...active, elapsed: elapsed(active, now), anchor: now, running: pause ? false : active.running } : null;
}
export function dailyTotals(sessions) {
  const map = {};
  for (const s of sessions) map[s.day] = (map[s.day] || 0) + s.seconds;
  return map;
}
export function stats(sessions, now = Date.now()) {
  const days = dailyTotals(sessions);
  const keys = Object.keys(days).filter(k => days[k] >= 60).sort();
  let longestStreak = 0, run = 0, previous = null;
  for (const k of keys) {
    const d = new Date(k+'T12:00:00'); d.setDate(d.getDate()-1);
    run = dayKey(d) === previous ? run+1 : 1;
    longestStreak = Math.max(longestStreak,run); previous = k;
  }
  let streak = 0, d = new Date(now);
  if ((days[dayKey(d)] || 0) < 60) d.setDate(d.getDate()-1);
  while ((days[dayKey(d)] || 0) >= 60) { streak++; d.setDate(d.getDate()-1); }
  return { total: sessions.reduce((n,s)=>n+s.seconds,0), today: days[dayKey(now)] || 0, longest: Math.max(0,...sessions.map(s=>s.seconds)), streak, longestStreak, days };
}
export function validateState(s) {
  const finite = (v,min,max) => Number.isFinite(v) && v >= min && v <= max;
  const str = (v,max=2000) => typeof v === 'string' && v.length <= max;
  if (!s || s.version !== 1 || !s.profile || !['tasks','sessions','thoughts'].every(k=>Array.isArray(s[k]) && s[k].length <= 100000)) throw Error('不是有效的一隅备份文件');
  const optional=(value,max)=>value===undefined||str(value,max);
  const extra=r=>validQuantity(r.quantity)&&optional(r.course,40)&&optional(r.nextStep,200)&&optional(r.question,1000)&&optional(r.position,200)&&optional(r.eventId,100)&&optional(r.presetId,100)&&(r.reason===undefined||['thought','phone','difficult','tired','environment','other'].includes(r.reason))&&(r.questionResolved===undefined||typeof r.questionResolved==='boolean');
  if(s.draft!==undefined&&(!s.draft||!validQuantity(s.draft.quantity)||!str(s.draft.title,200)||!str(s.draft.course,40)||!optional(s.draft.sessionId,100)||!optional(s.draft.eventId,100)||!optional(s.draft.presetId,100)||(s.draft.edited!==undefined&&typeof s.draft.edited!=='boolean')))throw Error('下一步目标格式有误');
  const p=s.profile;
  if (!str(p.name,40) || !str(p.motto,120) || !finite(p.goal,5,720) || !finite(p.duration,1,120) || !finite(p.breakMinutes,1,30) || typeof p.sound !== 'boolean') throw Error('个人设置格式有误');
  if (!s.tasks.every(t=>str(t.id,100)&&str(t.title,200)&&extra(t)&&(t.plannedAt===undefined||finite(t.plannedAt,0,1e14))&&typeof t.done==='boolean')) throw Error('任务格式有误');
  if (!s.thoughts.every(t=>str(t.id,100)&&str(t.text,1000)&&extra(t)&&optional(t.sessionId,100)&&(t.source===undefined||['focus','inbox'].includes(t.source))&&typeof t.done==='boolean'&&finite(t.created,0,1e14))) throw Error('分心记录格式有误');
  if (!s.sessions.every(t=>str(t.id,100)&&str(t.title,200)&&str(t.note,2000)&&extra(t)&&finite(t.seconds,0,7200)&&finite(t.ended,0,1e14)&&typeof t.completed==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(t.day)&&dayKey(t.ended)===t.day)) throw Error('专注记录格式有误');
  if (s.active !== null) {
    const a=s.active;
    if (!a || !str(a.id,100)|| !str(a.title,200)||!extra(a)||!['focus','break'].includes(a.kind)||!finite(a.duration,1,120)||!finite(a.elapsed,0,a.duration*60000)||!finite(a.anchor,0,1e14)||typeof a.running!=='boolean'||(a.goalDuration!==undefined&&(!finite(a.goalDuration,1,a.duration)))||['waiting','paragraph'].some(key=>a[key]!==undefined&&typeof a[key]!=='boolean')) throw Error('计时状态格式有误');
  }
  if(s.courseHabits!==undefined&&(!Array.isArray(s.courseHabits)||s.courseHabits.length>2000||!s.courseHabits.every(h=>h&&str(h.id,100)&&str(h.course,40)&&h.course.trim()&&finite(h.minutes,1,120)&&str(h.material,2000)&&str(h.position,200)&&finite(h.updated,0,1e14))))throw Error('课程学习习惯格式有误');
  if(s.events!==undefined&&(!Array.isArray(s.events)||s.events.length>100000||!s.events.every(validEvent)||new Set(s.events.map(e=>e.id)).size!==s.events.length))throw Error('日历安排格式有误');
  if(s.focusPresets!==undefined&&(!Array.isArray(s.focusPresets)||s.focusPresets.length>2000||!s.focusPresets.every(validPreset)||new Set(s.focusPresets.map(p=>p.id)).size!==s.focusPresets.length))throw Error('快速专注事件格式有误');
  if(s.trash!==undefined){if(!Array.isArray(s.trash)||s.trash.length>1000)throw Error('回收站格式有误');for(const item of s.trash){if(!item||!str(item.id,100)||!['tasks','sessions','thoughts','events','focusPresets'].includes(item.kind)||!finite(item.deleted,0,1e14))throw Error('回收站格式有误');validateState({...defaultState(),[item.kind]:[item.record]});}}
  return s;
}
