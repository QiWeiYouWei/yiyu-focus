export const dayKey = (time = Date.now()) => {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const defaultState = () => ({ version: 1, profile: { name: '学习中的你', motto: '慢慢来，每一次回来都算数。', goal: 60, duration: 15, breakMinutes: 5, sound: true }, tasks: [], sessions: [], thoughts: [], active: null });
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
  const p=s.profile;
  if (!str(p.name,40) || !str(p.motto,120) || !finite(p.goal,5,720) || !finite(p.duration,1,120) || !finite(p.breakMinutes,1,30) || typeof p.sound !== 'boolean') throw Error('个人设置格式有误');
  if (!s.tasks.every(t=>str(t.id,100)&&str(t.title,200)&&typeof t.done==='boolean')) throw Error('任务格式有误');
  if (!s.thoughts.every(t=>str(t.id,100)&&str(t.text,1000)&&typeof t.done==='boolean'&&finite(t.created,0,1e14))) throw Error('分心记录格式有误');
  if (!s.sessions.every(t=>str(t.id,100)&&str(t.title,200)&&str(t.note,2000)&&finite(t.seconds,0,7200)&&finite(t.ended,0,1e14)&&typeof t.completed==='boolean'&&/^\d{4}-\d{2}-\d{2}$/.test(t.day)&&dayKey(t.ended)===t.day)) throw Error('专注记录格式有误');
  if (s.active !== null) {
    const a=s.active;
    if (!a || !str(a.id,100)|| !str(a.title,200)||!['focus','break'].includes(a.kind)||!finite(a.duration,1,120)||!finite(a.elapsed,0,a.duration*60000)||!finite(a.anchor,0,1e14)||typeof a.running!=='boolean') throw Error('计时状态格式有误');
  }
  return s;
}
