// Course positions are confirmed by the learner; time never implies mastery.
import {validAppearance} from './course-appearance.mjs';
export const levelLabels = ['尚未学习', '看过，仍需理解', '能跟着例题做', '能独立做题'];
export const sourceLabels = {textbook:'教材章节',ppt:'PPT 页码',platform:'课程平台'};
const str = (v,max) => typeof v==='string' && v.length<=max;
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const validLocation = value => {try{return !value || ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
export function validTrack(c) {
  return !!c && str(c.id,100) && !!c.id && str(c.course,40) && !!c.course.trim()
    && validAppearance(c)
    && (c.semesterId===undefined || str(c.semesterId,100))
    && Array.isArray(c.topics) && c.topics.length<=500
    && new Set(c.topics.map(t=>t?.id)).size===c.topics.length
    && c.topics.every(t=>t && str(t.id,100) && !!t.id && str(t.title,120) && !!t.title.trim()
      && Number.isInteger(t.level) && t.level>=0 && t.level<=3
      && Number.isInteger(t.minutes) && t.minutes>=5 && t.minutes<=480
      && ['textbook','ppt','platform'].every(k=>str(t[k],300)) && str(t.nextStep,200)
      && str(t.due,10) && (!t.due || validDate(t.due)))
    && (c.schoolIndex===null || Number.isInteger(c.schoolIndex) && c.schoolIndex>=0 && c.schoolIndex<=c.topics.length)
    && !!c.source && Object.hasOwn(sourceLabels,c.source.kind) && str(c.source.label,200)
    && str(c.source.location,2000) && validLocation(c.source.location)
    && Number.isFinite(c.source.confirmedAt) && c.source.confirmedAt>=0 && c.source.confirmedAt<=1e14
    && Number.isFinite(c.updated) && c.updated>=0 && c.updated<=1e14;
}
export function emptyTrack(course,id,semesterId='') {
  return {id,course,semesterId,topics:[],schoolIndex:null,source:{kind:'textbook',label:'',location:'',confirmedAt:0},updated:0};
}
export function validSemester(s) {
  return !!s && str(s.id,100) && !!s.id && !['all','unassigned'].includes(s.id)
    && str(s.name,40) && !!s.name.trim() && Number.isFinite(s.updated) && s.updated>=0 && s.updated<=1e14;
}
export function validateCourseOrganization(state) {
  const semesters=state.courseSemesters||[];
  if(state.courseSemesters!==undefined&&(!Array.isArray(state.courseSemesters)||semesters.length>100||!semesters.every(validSemester)||new Set(semesters.map(s=>s.id)).size!==semesters.length))throw Error('学期分类格式有误');
  const ids=new Set(semesters.map(s=>s.id));
  if((state.courseTracks||[]).some(c=>c.semesterId&&!ids.has(c.semesterId)))throw Error('课程所属学期不存在');
  if(state.currentCourseSemester!==undefined&&(!str(state.currentCourseSemester,100)||state.currentCourseSemester&&!ids.has(state.currentCourseSemester)))throw Error('当前学期格式有误');
  if(state.courseSemesterFilter!==undefined&&!['all','unassigned',...ids].includes(state.courseSemesterFilter))throw Error('学期筛选格式有误');
}
export function semesterName(semesters,id) {
  return semesters.find(s=>s.id===id)?.name || '未分类';
}
export function semesterTracks(tracks,filter='all') {
  return filter==='all'?tracks:tracks.filter(c=>(c.semesterId||'')===(filter==='unassigned'?'':filter));
}
export function currentSemesterTracks(state) {
  return semesterTracks(state.courseTracks||[],state.currentCourseSemester||'unassigned');
}
export function removeSemester(state,id,now=Date.now()) {
  return {courseSemesters:(state.courseSemesters||[]).filter(s=>s.id!==id),
    courseTracks:(state.courseTracks||[]).map(c=>c.semesterId===id?{...c,semesterId:'',updated:now}:c),
    currentCourseSemester:state.currentCourseSemester===id?'':state.currentCourseSemester||'',
    courseSemesterFilter:state.courseSemesterFilter===id?'unassigned':state.courseSemesterFilter||'all'};
}
export function parseTopics(text,previous=[],makeId=()=>crypto.randomUUID()) {
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length>500)throw Error('每门课最多 500 个知识点');
  const used=new Set();
  return lines.map((line,i)=>{
    const parts=line.split('|').map(s=>s.trim());
    if(parts.length>7)throw Error('第 '+(i+1)+' 行超过 7 列，请按格式填写');
    const [title,textbook='',ppt='',platform='',duration='',due='',nextStep='']=parts;
    const old=previous.find(t=>t.title===title&&!used.has(t.id));if(old)used.add(old.id);
    const topic={id:old?.id||makeId(),title,textbook,ppt,platform,minutes:duration?Number(duration):25,due,nextStep,level:old?.level||0};
    if(!validTrack({...emptyTrack('校验','validation'),topics:[topic]}))throw Error('第 '+(i+1)+' 行有误：名称必填，预计时长为 5–480 的整数，日期用 YYYY-MM-DD');
    return topic;
  });
}
export function topicsText(topics) {
  return topics.map(t=>[t.title,t.textbook,t.ppt,t.platform,t.minutes,t.due,t.nextStep].join(' | ')).join('\n');
}
export function remainingMinutes(t) {
  return t.level===3?0:Math.max(5,Math.ceil(t.minutes*[1,.8,.45,0][t.level]));
}
export function trackSummary(c,now=Date.now()) {
  const taught=c.schoolIndex===null?[]:c.topics.slice(0,c.schoolIndex);
  const missing=taught.filter(t=>t.level<3);
  return {known:c.schoolIndex!==null,missing,remaining:missing.reduce((n,t)=>n+remainingMinutes(t),0),
    learned:c.topics.filter(t=>t.level>=1).length,mastered:c.topics.filter(t=>t.level===3).length,
    stale:c.schoolIndex!==null&&(!c.source.confirmedAt||now-c.source.confirmedAt>7*86400000)};
}
export function catchupPlan(tracks,budget=60,now=Date.now()) {
  let left=Math.max(0,Math.floor(budget));const rows=[];
  const candidates=tracks.flatMap(c=>{
    const summary=trackSummary(c,now),topic=summary.missing[0];
    // The recorded course order is used to avoid skipping the first gap.
    return topic?[{track:c,topic,summary}]:[];
  }).sort((a,b)=>compareCoursePriority(a.track,b.track,a.topic.due,b.topic.due,now) || b.summary.remaining-a.summary.remaining || a.track.id.localeCompare(b.track.id));
  for(const row of candidates){if(left<5)break;const estimate=remainingMinutes(row.topic),minutes=Math.min(25,estimate,left);
    rows.push({...row,minutes,estimate,partial:minutes<estimate});left-=minutes;
  }
  return {rows,minutes:budget-left,unused:left};
}
export function coursePriority(c,due='',now=Date.now()) {
  const today=new Date(now);today.setHours(0,0,0,0);
  const deadline=due?new Date(due+'T00:00:00'):null,days=deadline?Math.round((deadline-today)/86400000):Infinity;
  return {immediate:days<=0,urgency:Math.max(c.urgency||0,days<=3?2:days<=7?1:0),importance:c.importance||0,due:due||'9999'};
}
export function compareCoursePriority(a,b,aDue='',bDue='',now=Date.now()) {
  const x=coursePriority(a,aDue,now),y=coursePriority(b,bDue,now);
  return Number(y.immediate)-Number(x.immediate) || y.urgency-x.urgency || y.importance-x.importance || x.due.localeCompare(y.due);
}
