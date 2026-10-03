import './android.mjs';
import {dayKey,defaultState,elapsed,checkpoint,stats,validateState} from './core.mjs';
import {icon,setButton,setText,initializeUI,entrance,feedback} from './ui.mjs';
import {setupSync} from './sync-ui.mjs';
import {reachGoal,extendFocus,timerView,rememberHabit,recycle,recover} from './workflow.mjs';
import {courseOf,courseLabel,courseNames,filterSessions,courseTotals,resumeTarget,weeklyReview} from './learning.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID();
let state=defaultState(), page='focus', duration=15, reviewId=null, pinned=false, loadFailed=false, toastTimeout, lastSaved=0, syncUI=null, reviewIsEdit=false, selectedDay=null, draftTimer, lastMini='';
const storageKey='yiyu-focus-v1';
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').hidden=true,3500);}
async function saveLocal(){
  if(loadFailed) throw Error('数据尚未正确载入，已停止写入以保护原文件');
  state.trash=(state.trash||[]).filter(item=>Date.now()-item.deleted<30*86400000);$('#save-state').textContent='保存中…';const snapshot=structuredClone(state);
  try {if(window.desktop) await window.desktop.save(snapshot);else localStorage.setItem(storageKey,JSON.stringify(snapshot));$('#save-error').hidden=true;$('#save-state').textContent='已存本机';$('#save-state').title='最近保存：'+new Date().toLocaleTimeString('zh-CN');}
  catch(e){$('#save-state').textContent='尚未保存';$('#save-error').textContent='保存失败：'+e.message+'。请导出备份，保留当前窗口。';$('#save-error').hidden=false;throw e;}
}
async function save(){const changed=syncUI?.observe(state);await saveLocal();if(changed)syncUI.schedule();}
function persist(){return save().catch(()=>{});}
function pretty(seconds){if(seconds<60)return `${Math.floor(seconds)} 秒`;if(seconds<3600)return `${Math.floor(seconds/60)} 分钟`;return `${Math.floor(seconds/3600)} 小时 ${Math.floor(seconds%3600/60)} 分钟`;}
function formatDate(time){return new Date(time).toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function empty(icon,title,subtitle){return `<div class="empty-state"><span>${icon}</span>${title}<small>${subtitle}</small></div>`;}
function confirmAction(title,body){return new Promise(resolve=>{
  $('#confirm-title').textContent=title;$('#confirm-body').textContent=body;const dialog=$('#confirm-dialog');
  let settled=false;const done=result=>{if(settled)return;settled=true;dialog.close();resolve(result);};
  $('#confirm-yes').onclick=()=>done(true);$('#confirm-no').onclick=()=>done(false);dialog.oncancel=()=>done(false);dialog.showModal();
});}
function setZen(enabled){document.body.classList.toggle('zen-mode',enabled);setButton($('#zen'),enabled?'退出沉浸':'沉浸',enabled?'collapse':'expand');$('#zen').setAttribute('aria-pressed',String(enabled));}
function navigate(next){
  page=next;document.body.dataset.page=page;$$('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);$$('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));
  $('#breadcrumb').innerHTML='我的空间 <span>/</span> '+({focus:'专注',growth:'成长',inbox:'念头暂存',history:'学习足迹',settings:'偏好',account:'账号'}[page]);
  $$('.nav[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(page!=='focus')setZen(false);render();window.scrollTo({top:0,behavior:'instant'});entrance($('#page-'+page));
}
function sessionHTML(s){return `<article class="record"><div class="record-head"><strong>${escape(s.title)}</strong><span class="record-time">${pretty(s.seconds)} · ${s.completed?'已完成':'提前结束'}</span></div><div class="record-meta"><span class="course-badge">${escape(courseLabel(courseOf(s)))}</span><span class="muted">${formatDate(s.ended)}</span></div>${s.note?`<p>${escape(s.note)}</p>`:''}${s.question?`<div class="record-question ${s.questionResolved?'resolved':''}"><span>${s.questionResolved?'已解决':'待解决'}</span><p>${escape(s.question)}</p><button class="text-button" data-resolve-question="${escape(s.id)}">${s.questionResolved?'重新记为待解决':'标记已解决'}</button></div>`:''}${s.nextStep?`<div class="record-next"><span>下一步</span> ${escape(s.nextStep)}</div>`:''}<button class="text-button" data-edit-note="${escape(s.id)}">编辑收获与课程 ↗</button><button class="text-button record-delete" data-delete-session="${escape(s.id)}">移入回收站</button></article>`;}
function selectedCourse(selector){const value=$(selector).value;return value==='all'||!value?null:JSON.parse(value);}
function renderCourses(){
  const names=courseNames(state);$('#course-suggestions').innerHTML=names.map(name=>`<option value="${escape(name)}"></option>`).join('');
  for(const selector of ['#growth-course','#history-course']){const el=$(selector),value=el.value||'all';el.innerHTML='<option value="all">全部课程</option>'+['',...names].map(name=>`<option value="${escape(JSON.stringify(name))}">${escape(courseLabel(name))}</option>`).join('');el.value=[...el.options].some(o=>o.value===value)?value:'all';}
}
function rememberDraft(){
  if(state.active)return;
  state.draft={title:$('#intention').value.trim(),course:$('#focus-course').value.trim(),edited:true};clearTimeout(draftTimer);draftTimer=setTimeout(()=>persist(),400);renderResume();
}
function setDraft(target){if(!target||state.active)return;state.draft={title:target.title,course:target.course||'',edited:true};$('#intention').value=target.title;$('#focus-course').value=target.course||'';persist();renderResume();}
function renderResume(){
  const target=resumeTarget(state),a=state.active;if(!a&&!state.draft?.edited){$('#intention').value=target?.title||'';$('#focus-course').value=target?.course||'';}
  $('#resume-heading').textContent=a?.kind==='focus'?'回来，只做这一件事':target?'接着上次的一小步':'从容易开始的一步出发';
  $('#resume-context').textContent=target?.context||'';$('#resume-target').textContent=target?.title||'写下一个小目标，再留给它 5 分钟。';
  $('#resume-course').hidden=!target;$('#resume-course').textContent=courseLabel(target?.course||'');
  $('#quick-resume').disabled=loadFailed||!!a&&(a.running||a.kind==='break');$('#quick-resume').textContent=a?(a.kind==='break'?'休息后再开始':a.running?'正在专注':'继续当前这一段 →'):'先做 5 分钟 →';
}
function renderDay(){
  const course=selectedCourse('#growth-course'),records=filterSessions(state.sessions,course).filter(s=>s.day===selectedDay).sort((a,b)=>b.ended-a.ended);
  $('#day-title').textContent=selectedDay+' 的学习';$('#detail-date').value=selectedDay;
  $('#day-summary').textContent=`${course===null?'全部课程':courseLabel(course)} · ${records.length} 次专注 · ${pretty(records.reduce((sum,s)=>sum+s.seconds,0))}`;
  $('#day-records').innerHTML=records.length?records.map(sessionHTML).join(''):'<p class="detail-empty">这一天还没有'+(course===null?'':escape(courseLabel(course))+'的')+'专注记录。留白也没关系。</p>';
}
function openDay(day){selectedDay=day;renderDay();if(!$('#day-dialog').open)$('#day-dialog').showModal();}
function renderCourseTotals(){
  const sessions=$('#course-period').value==='all'?state.sessions:weeklyReview(state).sessions,rows=courseTotals(sessions),max=Math.max(1,...rows.map(r=>r.seconds));
  $('#course-totals').innerHTML=rows.length?rows.map(row=>`<button class="course-total" data-course-filter="${escape(JSON.stringify(row.course))}"><span class="course-total-top"><strong>${escape(courseLabel(row.course))}</strong><span>${pretty(row.seconds)} · ${row.count} 次</span></span><progress value="${row.seconds}" max="${max}" aria-label="${escape(courseLabel(row.course))}投入时长"></progress></button>`).join(''):'<p class="muted">这里会显示你实际投入过的课程。</p>';
}
function renderWeekReview(){
  const review=weeklyReview(state,Date.now(),selectedCourse('#growth-course'));
  $('#review-range').textContent=review.start+' — '+review.end;
  $('#week-overview').textContent=review.sessions.length?`这 7 天，你在 ${review.days} 天里留下了 ${pretty(review.seconds)}，一共 ${review.sessions.length} 次专注。`:'最近 7 天还没有这部分记录。从一个小目标开始就好。';
  $('#week-activities').innerHTML=review.activities.length?review.activities.slice(0,6).map(r=>`<div class="review-item"><strong>${escape(r.title)}</strong><small>${escape(courseLabel(r.course))} · ${pretty(r.seconds)} · ${r.count} 次</small></div>`).join('')+(review.activities.length>6?'<p class="muted">还有 '+(review.activities.length-6)+' 个目标，可在学习足迹查看。</p>':''):'<p class="muted">认真做过的小事会出现在这里。</p>';
  $('#week-notes').innerHTML=review.notes.length?review.notes.slice(0,3).map(s=>`<div class="review-item"><p>${escape(s.note)}</p><small>${escape(s.title)} · ${s.day}</small></div>`).join(''):'<p class="muted">下次结束时，留一句收获就好。</p>';
  const questions=review.sessions.filter(s=>s.question&&!s.questionResolved);$('#week-questions').innerHTML=questions.length?questions.slice(0,4).map(s=>`<div class="review-item"><p>${escape(s.question)}</p><small>${escape(s.title)} · ${escape(courseLabel(courseOf(s)))}</small></div>`).join(''):'<p class="muted">没有留下待解决的问题。</p>';
  $('#week-thoughts').innerHTML=review.thoughts.length?review.thoughts.slice(0,4).map(t=>`<div class="review-item thought-summary"><p>${escape(t.text)}</p><small>${t.count} 次暂存</small></div>`).join(''):'<p class="muted">这 7 天没有专注时暂存的念头。旧版念头仍可在“念头暂存”查看。</p>';
}
function render(){renderHabitContext();renderCourses();renderTimer();renderResume();renderToday();renderTasks();renderThoughts();if(page==='growth')renderGrowth();if(page==='history')renderHistory();if(page==='settings')renderSettings();if($('#day-dialog').open)renderDay();}
function renderTimer(){
  const a=state.active, remaining=a?Math.max(0,a.duration*60000-elapsed(a)):duration*60000;
  const view=timerView(a,duration);$('#timer').textContent=view.text;$('#soft-end').hidden=!view.waiting;$('#start').hidden=view.waiting;
  $('#ring-progress').style.strokeDashoffset=String(791.682*(a?elapsed(a)/(a.duration*60000):0));
  document.body.dataset.timerState=a?(a.running?'running':'paused'):'idle';const isBreak=a?.kind==='break';document.body.classList.toggle('is-break',isBreak);
  setText($('#timer-mode'),isBreak?'休息时间':'专注时间');setText($('#timer-overline'),a?(isBreak?'给注意力充充电':a.running?'此刻，正在向前':'慢一点，也没关系'):'留一小段时间给自己');
  $('#timer-caption').textContent=a?.waiting?'时间到了，由你决定怎样收尾':a?.paragraph?'慢慢读完，结束时点“这段读完了”':a?(a.running?(isBreak?'起身走走，看看远处':'你只需要专注于眼前这一步'):'已经暂停，准备好再继续'):'从一小步开始，就很好';
  setButton($('#start'),a?(a.running?'暂停片刻':'继续这一段'):'开始专注',a?.running?'pause':'play');
  $('#finish').hidden=!a;$('#finish').textContent=isBreak?'结束休息':a?.paragraph?'这段读完了':a?.waiting?'现在结束':'提前结束';
  $('#intention').disabled=!!a;$('#focus-course').disabled=!!a;if(a?.kind==='focus'){$('#intention').value=a.title;$('#focus-course').value=courseOf(a);}
  $$('[data-minutes]').forEach(el=>{el.disabled=!!a;el.setAttribute('aria-pressed',String(Number(el.dataset.minutes)===duration));el.classList.toggle('selected',Number(el.dataset.minutes)===duration);});$('#custom-minutes').disabled=!!a;
  setButton($('#sound'),'提示音 '+(state.profile.sound?'开':'关'),state.profile.sound?'sound':'mute');$('#sound').setAttribute('aria-pressed',String(state.profile.sound));
  $('#gentle-tip').textContent=isBreak?'休息也是学习的一部分。放松肩膀，让眼睛离开屏幕。':'把手机放远一点，给注意力留一点空间。';
  publishMini();document.title=a?`${$('#timer').textContent} · ${isBreak?'休息':'专注'} — 一隅 Focus`:'一隅 Focus';
}
function renderToday(){const s=stats(state.sessions);$('#today-minutes').textContent=Math.floor(s.today/60);$('#daily-goal').textContent=state.profile.goal;$('#goal-progress').max=state.profile.goal;$('#goal-progress').value=s.today/60;$('#today-sessions').textContent=state.sessions.filter(r=>r.day===dayKey()).length;$('#today-streak').textContent=s.streak;$('#goal-copy').textContent=s.today>=state.profile.goal*60?'今天的约定，已经做到啦。':s.today>0?`还差 ${Math.ceil(state.profile.goal-s.today/60)} 分钟，一小步一小步来。`:'第一段专注，从现在开始。';}
function renderTasks(){
  const open=state.tasks.filter(t=>!t.done);$('#task-count').textContent=`${open.length} 项待办`;
  $('#task-list').innerHTML=state.tasks.length?state.tasks.map(t=>`<div class="task-row ${t.done?'done':''}"><input class="task-check" type="checkbox" data-check-task="${escape(t.id)}" ${t.done?'checked':''} aria-label="完成 ${escape(t.title)}"><button class="task-title" data-use-task="${escape(t.id)}" title="带入专注">${escape(t.title)}<small class="task-course">${escape(courseLabel(courseOf(t)))}</small></button><button class="delete" data-delete-task="${escape(t.id)}" aria-label="删除 ${escape(t.title)}">×</button></div>`).join(''):'<p class="micro-copy">暂时没有目标。写一件小事就好。</p>';
}
function renderThoughts(){
  const open=state.thoughts.filter(t=>!t.done);$('#inbox-count').textContent=open.length;
  $('#thought-list').innerHTML=state.thoughts.length?[...state.thoughts].reverse().sort((a,b)=>Number(a.done)-Number(b.done)).map(t=>`<article class="thought ${t.done?'done':''}"><input type="checkbox" class="task-check" data-check-thought="${escape(t.id)}" ${t.done?'checked':''} aria-label="标记念头已处理"><div><p>${escape(t.text)}</p><small class="muted">${formatDate(t.created)} · ${t.done?'已处理':'等专注结束再看看'}</small></div><button class="delete" data-delete-thought="${escape(t.id)}" aria-label="删除念头">×</button></article>`).join(''):empty(icon('leaf'),'脑海里的小事，也有安放的地方。','有了分心的念头，记在这里，然后轻轻回到眼前。');
}
function renderHistory(){
  const q=$('#history-search').value.trim().toLowerCase();
  const records=filterSessions(state.sessions,selectedCourse('#history-course')).filter(s=>(!$('#unresolved-only').checked||s.question&&!s.questionResolved)&&(s.title+' '+s.note+' '+courseOf(s)+' '+(s.nextStep||'')+' '+(s.question||'')).toLowerCase().includes(q)).sort((a,b)=>b.ended-a.ended);
  $('#history-count').textContent=records.length+' 条记录';
  $('#history-list').innerHTML=records.length?records.map(sessionHTML).join(''):empty(icon('history'),q||selectedCourse('#history-course')!==null?'还没有找到匹配的记录。':'你的第一段专注，即将发生。',q?'试试其他关键词。':'每一段认真度过的时间，都会留在这里。');
}
function renderGrowth(){
  const s=stats(filterSessions(state.sessions,selectedCourse('#growth-course')));$('#profile-name').textContent=state.profile.name;$('#profile-motto').textContent=state.profile.motto;
  $('#stat-strip').innerHTML=[[pretty(s.total),'累计专注'],[pretty(Math.max(0,...Object.values(s.days))),'单日最高'],[pretty(s.longest),'最长一次'],[s.streak+' 天','当前连续'],[s.longestStreak+' 天','最长连续']].map(([v,l])=>`<div class="stat"><strong>${v}</strong><span>${l}</span></div>`).join('');
  const currentYear=new Date().getFullYear(), previousYear=Number($('#heatmap-year').value)||currentYear;
  const years=[...new Set([currentYear,...state.sessions.map(r=>Number(r.day.slice(0,4)))])].sort((a,b)=>b-a);
  $('#heatmap-year').innerHTML=years.map(y=>`<option value="${y}" ${y===previousYear?'selected':''}>${y} 年</option>`).join('');
  const year=Number($('#heatmap-year').value);let d=new Date(year,0,1,12),cells='';
  for(let i=0;i<(d.getDay()+6)%7;i++)cells+='<span class="heat-cell blank"></span>';
  while(d.getFullYear()===year){const key=dayKey(d),seconds=s.days[key]||0,level=seconds===0?0:seconds<900?1:seconds<1800?2:seconds<3600?3:4;cells+=`<button class="heat-cell level-${level}" data-day="${key}" title="${key} · ${pretty(seconds)}" aria-label="${key}，专注 ${pretty(seconds)}"></button>`;d.setDate(d.getDate()+1);}
  $('#heatmap').innerHTML=cells;$('#heatmap-months').innerHTML=Array.from({length:12},(_,i)=>`<span>${i+1}月</span>`).join('');
  $('#active-days').textContent=Object.entries(s.days).filter(([k,v])=>k.startsWith(year+'')&&v>=60).length;
  const week=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {day:d.toLocaleDateString('zh-CN',{weekday:'short'}),value:s.days[dayKey(d)]||0};});const max=Math.max(60,...week.map(d=>d.value));
  $('#week-chart').innerHTML=week.map(d=>`<div class="chart-col"><span>${Math.floor(d.value/60)} 分</span><div class="chart-bar" data-height="${Math.max(3,d.value/max*90)}"></div><span>${d.day}</span></div>`).join('');$$('.chart-bar').forEach(el=>el.style.height=el.dataset.height+'px');
  renderCourseTotals();renderWeekReview();const total=week.reduce((n,d)=>n+d.value,0);$('#weekly-summary').textContent=total?`最近 7 天，你为重要的事情留下了 ${pretty(total)}。不必和别人比较，这些时间属于你。`:'这里会慢慢长出你的专注轨迹。从一小段时间开始，让积累自然发生。';
}
function renderSettings(){for(const key of ['name','motto','goal','duration','breakMinutes'])$('#settings-form').elements[key].value=state.profile[key];renderTrash();refreshBackups();loadDesktopPreferences();}
async function notify(text){if(window.desktop)await window.desktop.notify(text).catch(()=>{});if(!state.profile.sound)return;try{const context=new AudioContext();const oscillator=context.createOscillator(),gain=context.createGain();oscillator.connect(gain);gain.connect(context.destination);oscillator.type='sine';oscillator.frequency.value=659;gain.gain.setValueAtTime(.1,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+1.3);oscillator.start();oscillator.stop(context.currentTime+1.3);oscillator.onended=()=>context.close();}catch{}}
function start(){
  if(state.active?.waiting){toast('选择读完这一段、延长或结束就好。');return;}
  if(state.active){state.active=checkpoint(state.active);state.active.running=!state.active.running;state.active.anchor=Date.now();}
  else {const title=$('#intention').value.trim();if(!title){toast('先写下一个小目标，专注更有方向。');$('#intention').focus();return;}const course=$('#focus-course').value.trim();state.draft={title,course,edited:true};state.active={id:id(),kind:'focus',title,course,duration,elapsed:0,anchor:Date.now(),running:true};}
  persist();renderTimer();renderResume();
}
function pause(){if(state.active){state.active=checkpoint(state.active,Date.now(),true);renderTimer();renderResume();return persist();}return Promise.resolve();}
window.prepareForBackground=async()=>{if(loadFailed)return;clearTimeout(draftTimer);if(state.active)state.active=checkpoint(state.active);await save();};
window.resumeFromMobile=async()=>{if(loadFailed)return;const current=await window.desktop.load();if(current){state.active=current.active;if(state.active?.running&&elapsed(state.active)>=state.active.duration*60000){if(state.active.kind==='focus')state.active=reachGoal(state.active);else state.active=null;}await save();render();}window.mobileRefresh?.();};
window.mobileBack=()=>{const dialog=$('dialog[open]');if(dialog){if(dialog.id==='review-dialog')saveReview(!reviewIsEdit);else if(dialog.id==='confirm-dialog')$('#confirm-no').click();else dialog.close();return true;}if(page!=='focus'){navigate('focus');return true;}if(document.body.classList.contains('zen-mode')){setZen(false);return true;}return false;};
window.prepareToClose=async()=>{if(loadFailed)return;clearTimeout(draftTimer);if(state.active)state.active=checkpoint(state.active,Date.now(),true);await save();};
function openReview(session,edit=false){
  reviewId=session.id;reviewIsEdit=edit;
  $('#review-title').textContent=edit?'为这段学习，补一点记录。':session.completed?'这一段，认真度过了。':'已经付出的时间，都算数。';
  $('#review-description').textContent=`${session.title} · 专注了 ${pretty(session.seconds)}`;$('#review-note').value=session.note;$('#review-question').value=session.question||'';$('#review-question').closest('details').open=!!session.question;$('#review-position').value=session.position||state.courseHabits?.find(h=>h.course===courseOf(session))?.position||'';$('#review-next-step').value=session.nextStep||'';$('#review-course').value=courseOf(session);
  $('#review-dialog .dialog-symbol').innerHTML=icon(session.completed?'check':'leaf');$('#review-dialog').dataset.completed=String(session.completed&&!edit);
  $('#review-skip').textContent=edit?'取消':'回到空间';$('#review-submit').textContent=edit?'保存修改':'保存收获，休息一下 →';$('#review-dialog').showModal();
}
function finish(){
  const a=state.active;if(!a)return;
  const used=elapsed(a),completed=used>=(a.goalDuration||a.duration)*60000;state.active=null;
  if(a.kind==='break'){persist();render();toast('休息结束。准备好了，再开始下一小段。');notify('休息结束，准备好再开始下一段。');return;}
  const seconds=Math.floor(used/1000);
  if(seconds<1){persist();render();toast('这一段已取消，还没有产生专注时间。');return;}
  const ended=Date.now();const session={id:a.id,title:a.title,seconds,ended,day:dayKey(ended),completed,note:'',course:courseOf(a),nextStep:''};
  state.sessions.push(session);persist();render();
  if($('#thought-dialog').open)$('#thought-dialog').close();
  if($('#confirm-dialog').open)$('#confirm-no').click();
  openReview(session);if(completed)notify('这一段专注完成了。留下收获，休息一下吧。');
}
function saveReview(saveChanges=true){
  const s=state.sessions.find(s=>s.id===reviewId),editing=reviewIsEdit;
  if(s&&saveChanges){const previous={title:s.nextStep||s.title,course:courseOf(s)};const latest=state.sessions.every(other=>other.ended<=s.ended);s.note=$('#review-note').value.trim();const question=$('#review-question').value.trim();if(question!==s.question)s.questionResolved=false;s.question=question;s.position=$('#review-position').value.trim();s.course=$('#review-course').value.trim();s.nextStep=$('#review-next-step').value.trim();if(s.course&&state.sessions.every(other=>courseOf(other)!==s.course||other.ended<=s.ended)){const habit=state.courseHabits?.find(h=>h.course===s.course);rememberHabit(state,{course:s.course,minutes:habit?.minutes||state.profile.duration,material:habit?.material||'',position:s.position});}
    for(const thought of state.thoughts){if(thought.sessionId===s.id)thought.course=s.course;}
    if(!state.active&&(!editing||latest&&(!state.draft?.title||(state.draft.title===previous.title&&courseOf(state.draft)===previous.course)))){const title=s.nextStep||s.title;state.draft={title,course:s.course,sessionId:s.id};$('#intention').value=title;$('#focus-course').value=s.course;}
    persist();
  }
  $('#review-dialog').close();reviewId=null;reviewIsEdit=false;render();
}
function addThought(text,source='inbox'){
  const a=state.active,thought={id:id(),text:text.trim()||'刚刚走神了，已经重新回来。',created:Date.now(),done:false,source:source==='focus'&&a?.kind==='focus'?'focus':'inbox',course:source==='focus'&&a?.kind==='focus'?courseOf(a):'',...(source==='focus'&&a?.kind==='focus'?{sessionId:a.id}:{})};
  state.thoughts.push(thought);return save().then(()=>{renderThoughts();toast('已经放好了。现在，回到眼前这一小步。');}).catch(error=>{state.thoughts=state.thoughts.filter(t=>t.id!==thought.id);throw error;});
}
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.page)));
$('.brand').addEventListener('click',e=>{e.preventDefault();navigate('focus');});
$('#start').onclick=start;
$$('[data-minutes]').forEach(el=>el.onclick=()=>{if(state.active)return;duration=Number(el.dataset.minutes);$('#custom-minutes').value='';renderTimer();});
$('#custom-minutes').onchange=()=>{if(state.active)return;const value=Number($('#custom-minutes').value);if(!Number.isInteger(value)||value<1||value>120){toast('请输入 1–120 之间的整数分钟。');$('#custom-minutes').value='';return;}duration=value;renderTimer();};
$('#finish').onclick=async()=>{const a=state.active;if(!a)return;if(a.kind==='break')return finish();if(await confirmAction('要结束这一段吗？','已经专注的时间会保留。也可以取消后继续，或暂停片刻。')){if(state.active?.id===a.id)finish();}};
$('#sound').onclick=()=>{state.profile.sound=!state.profile.sound;persist();renderTimer();};
$('#pin').onclick=async()=>{if(!window.desktop){toast('置顶功能请在 Windows 桌面版使用。');return;}pinned=await window.desktop.pin(!pinned);setButton($('#pin'),pinned?'已置顶':'置顶','pin');$('#pin').setAttribute('aria-pressed',String(pinned));};
$('#zen').onclick=()=>{const enabled=!document.body.classList.contains('zen-mode');navigate('focus');setZen(enabled);};
$('#task-form').onsubmit=e=>{e.preventDefault();const input=$('#task-input');if(!input.value.trim())return;state.tasks.push({id:id(),title:input.value.trim(),course:$('#task-course').value.trim(),done:false});input.value='';persist();renderCourses();renderTasks();renderResume();feedback($('#task-list').lastElementChild);};
$('#task-list').onclick=async e=>{
  const el=e.target.closest('button');if(!el)return;if(el.dataset.useTask){if(state.active){toast('先完成当前这一段，再切换目标。');return;}const task=state.tasks.find(t=>t.id===el.dataset.useTask);if(task){setDraft({title:task.title,course:courseOf(task)});applyHabit();}$('#intention').focus();}
  if(el.dataset.deleteTask&&await confirmAction('把这个目标移入回收站？','30 天内可在偏好设置中恢复，专注记录仍然保留。')){const deleted=state.tasks.find(t=>t.id===el.dataset.deleteTask);recycle(state,'tasks',el.dataset.deleteTask);if(!state.active&&deleted&&state.draft?.title===deleted.title&&courseOf(state.draft)===courseOf(deleted)){state.draft={title:'',course:''};const next=resumeTarget(state);$('#intention').value=next?.title||'';$('#focus-course').value=next?.course||'';}persist();renderCourses();renderTasks();renderResume();}
};
$('#task-list').onchange=e=>{const t=state.tasks.find(t=>t.id===e.target.dataset.checkTask);if(t){t.done=e.target.checked;if(t.done&&!state.active&&state.draft?.title===t.title&&courseOf(state.draft)===courseOf(t)){state.draft={title:'',course:''};const next=resumeTarget(state);$('#intention').value=next?.title||'';$('#focus-course').value=next?.course||'';}persist();renderTasks();renderResume();}};
$('#distracted').onclick=()=>{$('#distraction-input').value='';$('#return-cue').hidden=state.active?.kind!=='focus';$('#return-target').textContent=state.active?.kind==='focus'?state.active.title:'';$('#thought-dialog p').textContent=state.active?.running?'先把念头放下，不用现在解决。计时继续进行。':'先把念头放下，不用现在解决。';$('#thought-dialog').showModal();$('#distraction-input').focus();};
$('#distraction-form').onsubmit=async e=>{e.preventDefault();try{await addThought($('#distraction-input').value,'focus');$('#thought-dialog').close();}catch(error){toast('未能保存：'+error.message);}};
$$('[data-close]').forEach(el=>el.onclick=()=>$('#'+el.dataset.close).close());
$('#thought-form').onsubmit=async e=>{e.preventDefault();const input=$('#thought-input');if(!input.value.trim())return;try{await addThought(input.value);input.value='';}catch(error){toast('未能保存：'+error.message);}};
$('#thought-list').onchange=e=>{const t=state.thoughts.find(t=>t.id===e.target.dataset.checkThought);if(t){t.done=e.target.checked;persist();renderThoughts();}};
$('#thought-list').onclick=async e=>{if(e.target.dataset.deleteThought&&await confirmAction('把这个念头移入回收站？','30 天内可在偏好设置中恢复。')){recycle(state,'thoughts',e.target.dataset.deleteThought);persist();renderThoughts();}};
$('#review-form').onsubmit=e=>{e.preventDefault();const editing=reviewIsEdit;saveReview();if(!editing&&!state.active){state.active={id:id(),kind:'break',title:'休息一下，让注意力重新充电',duration:state.profile.breakMinutes,elapsed:0,anchor:Date.now(),running:true};persist();navigate('focus');}};
$('#review-skip').onclick=()=>saveReview(!reviewIsEdit);
$('#review-dialog').addEventListener('cancel',e=>{e.preventDefault();saveReview(!reviewIsEdit);});
$('#history-search').oninput=renderHistory;$('#unresolved-only').onchange=renderHistory;
$('#history-list').onclick=recordAction;
$('#heatmap-year').onchange=renderGrowth;
$('#heatmap').onclick=e=>{const cell=e.target.closest('[data-day]');if(cell)openDay(cell.dataset.day);};
$('#settings-form').onsubmit=e=>{e.preventDefault();const form=e.target.elements;for(const key of ['name','motto'])state.profile[key]=form[key].value.trim();for(const key of ['goal','duration','breakMinutes'])state.profile[key]=Number(form[key].value);if(!state.active)duration=state.profile.duration;persist();renderToday();toast('偏好已保存。按自己的节奏来。');};
$('#export').onclick=async()=>{try{const data=structuredClone(state);data.active=checkpoint(data.active,Date.now(),true);if(window.desktop){if(await window.desktop.export(data))toast('备份已导出。');}else{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`一隅备份-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('备份已导出。');}}catch(e){toast('导出失败：'+e.message);}};
$('#import').onclick=()=>{if(state.active){toast('请先结束当前计时，再恢复备份。');return;}$('#import-file').click();};
$('#import-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try {if(file.size>20*1024*1024)throw Error('文件超过 20 MB');const imported=validateState(JSON.parse(await file.text()));
    if(await confirmAction('用备份替换当前记录？',`备份包含 ${imported.sessions.length} 次专注、${imported.tasks.length} 个目标。当前记录将被替换，请先确认已经导出需要保留的数据。`)){
      imported.active=imported.active?{...imported.active,running:false,anchor:Date.now()}:null;imported.sync=state.sync;const previous=state,previousFailure=loadFailed;state=imported;loadFailed=false;
      try{if(window.desktop?.restore)await window.desktop.restore(state);await save();$('#start').disabled=false;duration=state.active?.kind==='focus'?state.active.duration:state.profile.duration;const target=resumeTarget(state);if(!state.active){$('#intention').value=target?.title||'';$('#focus-course').value=target?.course||'';}render();if(!state.active)applyHabit();toast('备份已恢复。');}catch(error){state=previous;loadFailed=previousFailure;throw error;}
    }
  }catch(error){toast('无法恢复：'+error.message);}finally{e.target.value='';}
};
window.desktop?.onPause?.(()=>pause().then(()=>toast('电脑休息了，专注也已暂停。')));
window.addEventListener('beforeunload',()=>{if(!window.desktop&&!loadFailed){clearTimeout(draftTimer);if(state.active)state.active=checkpoint(state.active,Date.now(),true);persist();}});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&page==='focus'&&!['INPUT','TEXTAREA','BUTTON','SELECT'].includes(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();start();}if(e.key==='Escape'){setZen(false);}});

$('#intention').addEventListener('input',rememberDraft);$('#focus-course').addEventListener('input',rememberDraft);
$('#quick-resume').onclick=()=>{if(state.active){if(!state.active.running&&state.active.kind==='focus')start();return;}const title=$('#intention').value.trim();const target=title?{title,course:$('#focus-course').value.trim()}:resumeTarget(state);if(!target){toast('先写下一件小事，再给它 5 分钟。');$('#intention').focus();return;}setDraft(target);duration=5;$('#custom-minutes').value='';start();};
$('#growth-course').onchange=()=>{const course=selectedCourse('#growth-course');$('#week-plan-course').value=course||'';renderGrowth();};
$('#history-course').onchange=renderHistory;$('#course-period').onchange=renderCourseTotals;
$('#course-totals').onclick=e=>{const button=e.target.closest('[data-course-filter]');if(button){$('#growth-course').value=button.dataset.courseFilter;$('#week-plan-course').value=JSON.parse(button.dataset.courseFilter);renderGrowth();}};
$('#detail-date').onchange=()=>{const date=$('#detail-date').value;if(/^\d{4}-\d{2}-\d{2}$/.test(date)){selectedDay=date;renderDay();}};
$('#day-records').onclick=recordAction;
$('#week-plan-form').onsubmit=e=>{e.preventDefault();if(state.active){toast('先结束当前计时，再安排下一步。');return;}const title=$('#week-plan-title').value.trim(),course=$('#week-plan-course').value.trim();if(!title)return;const planned=state.tasks.find(t=>!t.done&&t.title===title&&courseOf(t)===course);if(planned)planned.plannedAt=Date.now();else state.tasks.push({id:id(),title,course,done:false,plannedAt:Date.now()});setDraft({title,course});$('#week-plan-title').value='';navigate('focus');toast('下一步已放好。准备好就开始 5 分钟。');};

function publishMini(){if(!window.desktop?.publishMini)return;const a=state.active,data={text:$('#timer').textContent,title:a?.title||$('#intention').value.trim()||'先在专注空间选择一个小目标',course:a?courseOf(a):$('#focus-course').value.trim(),running:!!a?.running,active:!!a,waiting:!!a?.waiting};const key=JSON.stringify(data);if(key!==lastMini){lastMini=key;window.desktop.publishMini(data);}}
function softReached(){state.active=reachGoal(state.active);persist();render();notify('计时到了。可以读完这一段、延长 5 分钟，或现在结束。');}
function continueFocus(paragraph=false){try{state.active=extendFocus(state.active,paragraph?30:5,paragraph);persist();render();}catch(error){toast(error.message);}}
function renderHabitContext(){const course=state.active?.kind==='focus'?courseOf(state.active):$('#focus-course').value.trim(),habit=state.courseHabits?.find(h=>h.course===course);$('#course-position').textContent=habit?.position?'上次学到：'+habit.position:'';$('#open-material').hidden=!habit?.material;}
function applyHabit(){renderHabitContext();if(state.active)return;const habit=state.courseHabits?.find(h=>h.course===$('#focus-course').value.trim());if(habit){duration=habit.minutes;$('#custom-minutes').value='';renderTimer();}}
function openHabit(){const course=$('#focus-course').value.trim(),habit=state.courseHabits?.find(h=>h.course===course);$('#habit-course').value=course;$('#habit-minutes').value=habit?.minutes||state.profile.duration;$('#habit-material').value=habit?.material||'';$('#habit-position').value=habit?.position||'';$('#habit-dialog').showModal();}
function renderTrash(){const rows=(state.trash||[]).filter(t=>Date.now()-t.deleted<30*86400000).sort((a,b)=>b.deleted-a.deleted);$('#recycle-bin').innerHTML=rows.length?rows.map(t=>`<div class="backup-row"><div><strong>${escape(t.record.title||t.record.text)}</strong><small>${({tasks:'目标',thoughts:'念头',sessions:'专注记录'})[t.kind]} · ${formatDate(t.deleted)}</small></div><button class="secondary" data-recover="${escape(t.id)}">恢复</button></div>`).join(''):'<p class="muted">暂时没有删除的内容。</p>';}
async function recordAction(e){const el=e.target.closest('button');if(!el)return;const session=state.sessions.find(s=>s.id===(el.dataset.editNote||el.dataset.resolveQuestion||el.dataset.deleteSession));if(!session)return;if(el.dataset.editNote)openReview(session,true);else if(el.dataset.resolveQuestion){session.questionResolved=!session.questionResolved;await persist();render();}else if(await confirmAction('把这段记录移入回收站？','统计会随之更新，30 天内可以在偏好设置恢复。')){recycle(state,'sessions',session.id);await persist();render();}}
async function refreshBackups(){if(!window.desktop?.backups){$('#automatic-backups').innerHTML='<p class="muted">自动备份在 Windows 桌面版可用。</p>';$('#backup-now').disabled=true;return;}try{const rows=await window.desktop.backups();$('#automatic-backups').innerHTML=rows.length?rows.map(row=>`<div class="backup-row"><div><strong>${row.invalid?'无法读取的备份':escape(formatDate(row.created))}</strong><small>${row.invalid?'未用于恢复，原文件保留':escape(row.reason)+' · '+row.sessions+' 次专注'}</small></div><button class="secondary" data-restore-backup="${escape(row.id)}" ${row.invalid?'disabled':''}>恢复此版本</button></div>`).join(''):'<p class="muted">开始使用后会自动保存备份。</p>';}catch(error){$('#automatic-backups').textContent='备份暂时无法读取：'+error.message;}}
async function loadDesktopPreferences(){if(!window.desktop?.preferences){$('#desktop-preferences').querySelectorAll('input,select,button').forEach(el=>el.disabled=true);return;}const pref=await window.desktop.preferences();$('#capture-shortcut').value=pref.capture;$('#floating-shortcut').value=pref.floating;$('#mini-on-start').checked=pref.showOnStart;const busy=['capture','floating'].filter(key=>pref[key]!=='off'&&!pref.registrations[key]);$('#shortcut-status').textContent=busy.length?'部分快捷键已被其他程序使用，请换一组。':'快捷键已生效。记完念头会返回原来的学习窗口。';}
$('#test-capture').onclick=()=>window.desktop?.capture();
$('#show-mini').onclick=async()=>{if(!window.desktop?.toggleMini){toast('独立悬浮窗请在 Windows 桌面版使用。');return;}await window.desktop.toggleMini();publishMini();};
$('#soft-extend').onclick=()=>continueFocus();$('#soft-paragraph').onclick=()=>continueFocus(true);$('#soft-finish').onclick=finish;
$('#focus-course').addEventListener('change',applyHabit);$('#edit-habit').onclick=openHabit;
$('#habit-form').onsubmit=async e=>{e.preventDefault();const previous=structuredClone(state.courseHabits||[]);try{rememberHabit(state,{course:$('#habit-course').value,minutes:Number($('#habit-minutes').value),material:$('#habit-material').value.trim(),position:$('#habit-position').value.trim()});await save();$('#habit-dialog').close();renderCourses();applyHabit();toast('这门课的学习习惯已保存。');}catch(error){state.courseHabits=previous;toast(error.message);}};
$('#choose-material').onclick=async()=>{if(!window.desktop?.chooseMaterial){toast('选择本机资料请使用桌面版。');return;}const location=await window.desktop.chooseMaterial();if(location)$('#habit-material').value=location;};
$('#open-material').onclick=async()=>{const course=state.active?.kind==='focus'?courseOf(state.active):$('#focus-course').value.trim(),habit=state.courseHabits?.find(h=>h.course===course);try{if(!window.desktop?.openMaterial)throw Error('打开资料请使用桌面版');await window.desktop.openMaterial(habit.material);}catch(error){toast(error.message);}};
$('#desktop-preferences').onsubmit=async e=>{e.preventDefault();try{await window.desktop.savePreferences({capture:$('#capture-shortcut').value,floating:$('#floating-shortcut').value,showOnStart:$('#mini-on-start').checked});await loadDesktopPreferences();toast('桌面偏好已保存。');}catch(error){toast(error.message);}};
$('#backup-now').onclick=async()=>{try{await saveLocal();await window.desktop.backupNow(state);await refreshBackups();toast('当前记录已备份。');}catch(error){toast('备份失败：'+error.message);}};
$('#recycle-bin').onclick=async e=>{const button=e.target.closest('[data-recover]');if(!button)return;try{recover(state,button.dataset.recover);await save();render();toast('已恢复，账号连接时也会同步这次恢复。');}catch(error){toast(error.message);}};
$('#automatic-backups').onclick=async e=>{const button=e.target.closest('[data-restore-backup]');if(!button)return;if(state.active){toast('先结束当前计时，再恢复备份。');return;}try{const imported=await window.desktop.readBackup(button.dataset.restoreBackup);if(!await confirmAction('恢复这个备份版本？','包含 '+imported.sessions.length+' 次专注。恢复前会保护当前文件；账号连接时恢复也会同步。'))return;const old=state,previousFailure=loadFailed;imported.active=imported.active?{...imported.active,running:false,anchor:Date.now()}:null;imported.sync=state.sync;state=imported;loadFailed=false;try{await window.desktop.restore(state);await save();$('#start').disabled=false;duration=state.active?.duration||state.profile.duration;const target=resumeTarget(state);$('#intention').value=target?.title||'';$('#focus-course').value=target?.course||'';render();toast('备份已恢复。');}catch(error){state=old;loadFailed=previousFailure;throw error;}}catch(error){toast('恢复失败：'+error.message);}};
window.desktop?.onCommand?.(async command=>{if(command.type==='capture'){await addThought(command.text,'focus');return true;}if(command.type==='toggle'){start();await save();return true;}if(command.type==='extend'){continueFocus();await save();return true;}if(command.type==='paragraph'){continueFocus(true);await save();return true;}if(command.type==='finish'){if(state.active?.waiting)finish();else await $('#finish').onclick();await save();return true;}throw Error('未知桌面操作');});

async function init(){
  initializeUI();document.body.dataset.page='focus';setZen(false);setButton($('#pin'),'置顶','pin');setButton($('#account-badge'),'账号同步','cloud');
  try{const data=window.desktop?await window.desktop.load():JSON.parse(localStorage.getItem(storageKey)||'null');if(data)state=validateState(data);}
  catch(e){loadFailed=true;$('#save-error').hidden=false;$('#save-error').textContent=e.message+'。为保护原文件，已停用写入，请检查本地数据。';$('#start').disabled=true;}
  if(state.active&&window.desktop?.platform!=='android'){state.active={...state.active,running:false,anchor:Date.now()};toast('上次的专注已暂停，准备好后可以继续。');}else if(state.active?.running&&elapsed(state.active)>=state.active.duration*60000){if(state.active.kind==='focus')state.active=reachGoal(state.active);else state.active=null;}
  duration=state.active?.kind==='focus'?state.active.duration:state.profile.duration;const target=resumeTarget(state);if(!state.active&&target){$('#intention').value=target.title;$('#focus-course').value=target.course;}$('#today-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});render();if(!state.active)applyHabit();
  if(!loadFailed){try{syncUI=await setupSync({getState:()=>state,applyState:next=>{state=next;if(!state.active)duration=state.profile.duration;if(page==='settings'){renderTimer();renderToday();}else{render();if(!state.active)applyHabit();}},saveLocal,confirmAction,toast});}catch(e){$('#sync-description').textContent='账号同步暂不可用：'+e.message+'；本地专注不受影响。';}}
  setInterval(()=>{
    if(state.active?.running){if(elapsed(state.active)>=state.active.duration*60000){if(state.active.kind==='break')finish();else softReached();return;}if(Date.now()-lastSaved>5000){state.active=checkpoint(state.active);persist();lastSaved=Date.now();}}
    renderTimer();renderToday();
  },500);
}
init();
