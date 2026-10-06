// Exact new timer intervals; older records retain their original end-day totals.
export const sessionParts=s=>s.parts||[{day:s.day,seconds:s.seconds}];
const key=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
export function splitIntervals(segments,seconds){
 if(!Number.isInteger(seconds)||seconds<1||!validSegments(segments,segments.reduce((n,s)=>n+s.end-s.start,0)))throw Error('时间区间无效');
 const totals=new Map();
 for(const {start,end}of segments){let at=start;while(at<end){const midnight=new Date(at);midnight.setHours(24,0,0,0);const until=Math.min(end,+midnight);const day=key(at);totals.set(day,(totals.get(day)||0)+until-at);at=until;}}
 const rows=[...totals].map(([day,ms])=>({day,seconds:Math.floor(ms/1000),fraction:ms%1000}));
 let left=seconds-rows.reduce((n,r)=>n+r.seconds,0);if(left<0)throw Error('时长与区间不一致');for(const row of [...rows].sort((a,b)=>b.fraction-a.fraction||b.day.localeCompare(a.day))){if(left>0){row.seconds++;left--;}}
 if(left>0)throw Error('时间区间不足，无法分配记录');
 return rows.filter(r=>r.seconds>0).map(({day,seconds})=>({day,seconds}));
}
export function validSegments(segments,elapsed){
 return Array.isArray(segments)&&segments.length<=5000&&segments.every((s,i)=>s&&Number.isFinite(s.start)&&Number.isFinite(s.end)&&s.start>=0&&s.end>s.start&&s.end<=1e14&&(!i||s.start>=segments[i-1].end))&&Math.abs(segments.reduce((n,s)=>n+s.end-s.start,0)-elapsed)<1;
}
export function validParts(s){
 return s.parts===undefined||Array.isArray(s.parts)&&s.parts.length>0&&s.parts.length<=100&&new Set(s.parts.map(p=>p.day)).size===s.parts.length&&s.parts.every(p=>p&&/^\d{4}-\d{2}-\d{2}$/.test(p.day)&&key(+new Date(p.day+'T12:00:00'))===p.day&&p.day<=s.day&&Number.isInteger(p.seconds)&&p.seconds>0)&&s.parts.reduce((n,p)=>n+p.seconds,0)===s.seconds;
}
export function manualSession(values,old=null,now=Date.now()){
 const ended=Number(values.ended),seconds=Math.round(Number(values.minutes)*60),title=String(values.title||'').trim();
 if(!title||title.length>200||!Number.isFinite(ended)||ended>now||ended<seconds*1000||!Number.isInteger(seconds)||seconds<1||seconds>7200)throw Error('请填写目标、过去的结束时间及 1 秒至 120 分钟的时长。');
 const parts=splitIntervals([{start:ended-seconds*1000,end:ended}],seconds);
 return {...old,id:old?.id||crypto.randomUUID(),title,course:String(values.course||'').trim(),seconds,ended,day:key(ended),parts,completed:old?.completed??true,note:String(values.note||'').trim(),source:old?.source||'manual',editedAt:now,...(old?{corrected:true,original:old.original||{seconds:old.seconds,ended:old.ended,day:old.day,...(old.parts?{parts:old.parts}:{})}}:{})};
}
