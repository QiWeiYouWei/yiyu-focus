import {dayKey,defaultState,elapsed,checkpoint,stats,validateState} from './core.mjs';
import {icon,setButton,setText,initializeUI,entrance,feedback} from './ui.mjs';
import {setupSync} from './sync-ui.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID();
let state=defaultState(), page='focus', duration=15, reviewId=null, pinned=false, loadFailed=false, toastTimeout, lastSaved=0, syncUI=null;
const storageKey='yiyu-focus-v1';
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').hidden=true,3500);}
async function saveLocal(){
  if(loadFailed) throw Error('数据尚未正确载入，已停止写入以保护原文件');
  const snapshot=structuredClone(state);
  try {if(window.desktop) await window.desktop.save(snapshot);else localStorage.setItem(storageKey,JSON.stringify(snapshot));$('#save-error').hidden=true;}
  catch(e){$('#save-error').textContent='保存失败：'+e.message+'。请导出备份，保留当前窗口。';$('#save-error').hidden=false;throw e;}
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
  $$('.nav[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(page!=='focus')setZen(false);render();entrance($('#page-'+page));
}
function render(){renderTimer();renderToday();renderTasks();renderThoughts();if(page==='growth')renderGrowth();if(page==='history')renderHistory();if(page==='settings')renderSettings();}
function renderTimer(){
  const a=state.active, remaining=a?Math.max(0,a.duration*60000-elapsed(a)):duration*60000;
  const seconds=Math.ceil(remaining/1000);$('#timer').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  $('#ring-progress').style.strokeDashoffset=String(791.682*(a?elapsed(a)/(a.duration*60000):0));
  document.body.dataset.timerState=a?(a.running?'running':'paused'):'idle';const isBreak=a?.kind==='break';document.body.classList.toggle('is-break',isBreak);
  setText($('#timer-mode'),isBreak?'休息时间':'专注时间');setText($('#timer-overline'),a?(isBreak?'给注意力充充电':a.running?'此刻，正在向前':'慢一点，也没关系'):'留一小段时间给自己');
  $('#timer-caption').textContent=a?(a.running?(isBreak?'起身走走，看看远处':'你只需要专注于眼前这一步'):'已经暂停，准备好再继续'):'从一小步开始，就很好';
  setButton($('#start'),a?(a.running?'暂停片刻':'继续这一段'):'开始专注',a?.running?'pause':'play');
  $('#finish').hidden=!a;$('#finish').textContent=isBreak?'结束休息':'提前结束';
  $('#intention').disabled=!!a; if(a?.kind==='focus')$('#intention').value=a.title;
  $$('[data-minutes]').forEach(el=>{el.disabled=!!a;el.setAttribute('aria-pressed',String(Number(el.dataset.minutes)===duration));el.classList.toggle('selected',Number(el.dataset.minutes)===duration);});$('#custom-minutes').disabled=!!a;
  setButton($('#sound'),'提示音 '+(state.profile.sound?'开':'关'),state.profile.sound?'sound':'mute');$('#sound').setAttribute('aria-pressed',String(state.profile.sound));
  $('#gentle-tip').textContent=isBreak?'休息也是学习的一部分。放松肩膀，让眼睛离开屏幕。':'把手机放远一点，给注意力留一点空间。';
  document.title=a?`${$('#timer').textContent} · ${isBreak?'休息':'专注'} — 一隅 Focus`:'一隅 Focus';
}
function renderToday(){const s=stats(state.sessions);$('#today-minutes').textContent=Math.floor(s.today/60);$('#daily-goal').textContent=state.profile.goal;$('#goal-progress').max=state.profile.goal;$('#goal-progress').value=s.today/60;$('#today-sessions').textContent=state.sessions.filter(r=>r.day===dayKey()).length;$('#today-streak').textContent=s.streak;$('#goal-copy').textContent=s.today>=state.profile.goal*60?'今天的约定，已经做到啦。':s.today>0?`还差 ${Math.ceil(state.profile.goal-s.today/60)} 分钟，一小步一小步来。`:'第一段专注，从现在开始。';}
function renderTasks(){
  const open=state.tasks.filter(t=>!t.done);$('#task-count').textContent=`${open.length} 项待办`;
  $('#task-list').innerHTML=state.tasks.length?state.tasks.map(t=>`<div class="task-row ${t.done?'done':''}"><input class="task-check" type="checkbox" data-check-task="${escape(t.id)}" ${t.done?'checked':''} aria-label="完成 ${escape(t.title)}"><button class="task-title" data-use-task="${escape(t.id)}" title="带入专注">${escape(t.title)}</button><button class="delete" data-delete-task="${escape(t.id)}" aria-label="删除 ${escape(t.title)}">×</button></div>`).join(''):'<p class="micro-copy">暂时没有目标。写一件小事就好。</p>';
}
function renderThoughts(){
  const open=state.thoughts.filter(t=>!t.done);$('#inbox-count').textContent=open.length;
  $('#thought-list').innerHTML=state.thoughts.length?[...state.thoughts].reverse().sort((a,b)=>Number(a.done)-Number(b.done)).map(t=>`<article class="thought ${t.done?'done':''}"><input type="checkbox" class="task-check" data-check-thought="${escape(t.id)}" ${t.done?'checked':''} aria-label="标记念头已处理"><div><p>${escape(t.text)}</p><small class="muted">${formatDate(t.created)} · ${t.done?'已处理':'等专注结束再看看'}</small></div><button class="delete" data-delete-thought="${escape(t.id)}" aria-label="删除念头">×</button></article>`).join(''):empty(icon('leaf'),'脑海里的小事，也有安放的地方。','有了分心的念头，记在这里，然后轻轻回到眼前。');
}
function renderHistory(){
  const q=$('#history-search').value.trim().toLowerCase();
  const records=[...state.sessions].reverse().filter(s=>(s.title+' '+s.note).toLowerCase().includes(q));
  $('#history-list').innerHTML=records.length?records.map(s=>`<article class="record"><div class="record-head"><strong>${escape(s.title)}</strong><span class="record-time">${pretty(s.seconds)} · ${s.completed?'已完成':'提前结束'}</span></div><div class="muted">${formatDate(s.ended)}</div>${s.note?`<p>${escape(s.note)}</p>`:''}<button class="text-button" data-edit-note="${escape(s.id)}">${s.note?'编辑收获':'补一句收获'} ↗</button></article>`).join(''):empty(icon('history'),q?'还没有找到匹配的记录。':'你的第一段专注，即将发生。',q?'试试其他关键词。':'每一段认真度过的时间，都会留在这里。');
}
function renderGrowth(){
  const s=stats(state.sessions);$('#profile-name').textContent=state.profile.name;$('#profile-motto').textContent=state.profile.motto;
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
  const total=week.reduce((n,d)=>n+d.value,0);$('#weekly-summary').textContent=total?`最近 7 天，你为重要的事情留下了 ${pretty(total)}。不必和别人比较，这些时间属于你。`:'这里会慢慢长出你的专注轨迹。从一小段时间开始，让积累自然发生。';
}
function renderSettings(){for(const key of ['name','motto','goal','duration','breakMinutes'])$('#settings-form').elements[key].value=state.profile[key];}
async function notify(text){if(window.desktop)await window.desktop.notify(text).catch(()=>{});if(!state.profile.sound)return;try{const context=new AudioContext();const oscillator=context.createOscillator(),gain=context.createGain();oscillator.connect(gain);gain.connect(context.destination);oscillator.type='sine';oscillator.frequency.value=659;gain.gain.setValueAtTime(.1,context.currentTime);gain.gain.exponentialRampToValueAtTime(.001,context.currentTime+1.3);oscillator.start();oscillator.stop(context.currentTime+1.3);oscillator.onended=()=>context.close();}catch{}}
function start(){
  if(state.active){state.active=checkpoint(state.active);state.active.running=!state.active.running;state.active.anchor=Date.now();}
  else {const title=$('#intention').value.trim();if(!title){toast('先写下一个小目标，专注更有方向。');$('#intention').focus();return;}state.active={id:id(),kind:'focus',title,duration,elapsed:0,anchor:Date.now(),running:true};}
  persist();renderTimer();
}
function pause(){if(state.active){state.active=checkpoint(state.active,Date.now(),true);renderTimer();return persist();}return Promise.resolve();}
window.prepareToClose=async()=>{if(loadFailed)return;if(state.active)state.active=checkpoint(state.active,Date.now(),true);await save();};
function openReview(session){reviewId=session.id;$('#review-title').textContent=session.completed?'这一段，认真度过了。':'已经付出的时间，都算数。';$('#review-description').textContent=`${session.title} · 专注了 ${pretty(session.seconds)}`;$('#review-note').value=session.note;$('#review-dialog .dialog-symbol').innerHTML=icon(session.completed?'check':'leaf');$('#review-dialog').dataset.completed=String(session.completed);$('#review-dialog').showModal();}
function finish(){
  const a=state.active;if(!a)return;
  const used=elapsed(a),completed=used>=a.duration*60000;state.active=null;
  if(a.kind==='break'){persist();render();toast('休息结束。准备好了，再开始下一小段。');notify('休息结束，准备好再开始下一段。');return;}
  const seconds=Math.floor(used/1000);
  if(seconds<1){persist();render();toast('这一段已取消，还没有产生专注时间。');return;}
  const ended=Date.now();const session={id:a.id,title:a.title,seconds,ended,day:dayKey(ended),completed,note:''};
  state.sessions.push(session);persist();render();
  if($('#thought-dialog').open)$('#thought-dialog').close();
  if($('#confirm-dialog').open)$('#confirm-no').click();
  openReview(session);if(completed)notify('这一段专注完成了。留下收获，休息一下吧。');
}
function saveReview(){const s=state.sessions.find(s=>s.id===reviewId);if(s)s.note=$('#review-note').value.trim();persist();$('#review-dialog').close();render();}
function addThought(text){state.thoughts.push({id:id(),text:text.trim()||'刚刚走神了，已经重新回来。',created:Date.now(),done:false});persist();renderThoughts();toast('已经放好了。现在，回到眼前这一小步。');}
$$('[data-page]').forEach(el=>el.addEventListener('click',()=>navigate(el.dataset.page)));
$('.brand').addEventListener('click',e=>{e.preventDefault();navigate('focus');});
$('#start').onclick=start;
$$('[data-minutes]').forEach(el=>el.onclick=()=>{if(state.active)return;duration=Number(el.dataset.minutes);$('#custom-minutes').value='';renderTimer();});
$('#custom-minutes').onchange=()=>{if(state.active)return;const value=Number($('#custom-minutes').value);if(!Number.isInteger(value)||value<1||value>120){toast('请输入 1–120 之间的整数分钟。');$('#custom-minutes').value='';return;}duration=value;renderTimer();};
$('#finish').onclick=async()=>{const a=state.active;if(!a)return;if(a.kind==='break')return finish();if(await confirmAction('要结束这一段吗？','已经专注的时间会保留。也可以取消后继续，或暂停片刻。')){if(state.active?.id===a.id)finish();}};
$('#sound').onclick=()=>{state.profile.sound=!state.profile.sound;persist();renderTimer();};
$('#pin').onclick=async()=>{if(!window.desktop){toast('置顶功能请在 Windows 桌面版使用。');return;}pinned=await window.desktop.pin(!pinned);setButton($('#pin'),pinned?'已置顶':'置顶','pin');$('#pin').setAttribute('aria-pressed',String(pinned));};
$('#zen').onclick=()=>{const enabled=!document.body.classList.contains('zen-mode');navigate('focus');setZen(enabled);};
$('#task-form').onsubmit=e=>{e.preventDefault();const input=$('#task-input');if(!input.value.trim())return;state.tasks.push({id:id(),title:input.value.trim(),done:false});input.value='';persist();renderTasks();feedback($('#task-list').lastElementChild);};
$('#task-list').onclick=async e=>{
  const el=e.target;if(el.dataset.useTask){if(state.active){toast('先完成当前这一段，再切换目标。');return;}$('#intention').value=state.tasks.find(t=>t.id===el.dataset.useTask).title;$('#intention').focus();}
  if(el.dataset.deleteTask&&await confirmAction('删除这个目标？','已完成的专注记录仍然保留。')){state.tasks=state.tasks.filter(t=>t.id!==el.dataset.deleteTask);persist();renderTasks();}
};
$('#task-list').onchange=e=>{const t=state.tasks.find(t=>t.id===e.target.dataset.checkTask);if(t){t.done=e.target.checked;persist();renderTasks();}};
$('#distracted').onclick=()=>{$('#distraction-input').value='';$('#thought-dialog p').textContent=state.active?.running?'先把念头放下，不用现在解决。计时继续进行。':'先把念头放下，不用现在解决。';$('#thought-dialog').showModal();$('#distraction-input').focus();};
$('#distraction-form').onsubmit=e=>{e.preventDefault();addThought($('#distraction-input').value);$('#thought-dialog').close();};
$$('[data-close]').forEach(el=>el.onclick=()=>$('#'+el.dataset.close).close());
$('#thought-form').onsubmit=e=>{e.preventDefault();const input=$('#thought-input');if(input.value.trim())addThought(input.value);input.value='';};
$('#thought-list').onchange=e=>{const t=state.thoughts.find(t=>t.id===e.target.dataset.checkThought);if(t){t.done=e.target.checked;persist();renderThoughts();}};
$('#thought-list').onclick=async e=>{if(e.target.dataset.deleteThought&&await confirmAction('删除这个念头？','删除后无法恢复。')){state.thoughts=state.thoughts.filter(t=>t.id!==e.target.dataset.deleteThought);persist();renderThoughts();}};
$('#review-form').onsubmit=e=>{e.preventDefault();saveReview();if(!state.active){state.active={id:id(),kind:'break',title:'休息一下，让注意力重新充电',duration:state.profile.breakMinutes,elapsed:0,anchor:Date.now(),running:true};persist();navigate('focus');}};
$('#review-skip').onclick=saveReview;
$('#review-dialog').addEventListener('cancel',()=>saveReview());
$('#history-search').oninput=renderHistory;
$('#history-list').onclick=e=>{if(e.target.dataset.editNote){const s=state.sessions.find(s=>s.id===e.target.dataset.editNote);if(s)openReview(s);}};
$('#heatmap-year').onchange=renderGrowth;
$('#heatmap').onclick=e=>{if(e.target.dataset.day)toast(`${e.target.dataset.day} · 专注 ${pretty(stats(state.sessions).days[e.target.dataset.day]||0)}`);};
$('#settings-form').onsubmit=e=>{e.preventDefault();const form=e.target.elements;for(const key of ['name','motto'])state.profile[key]=form[key].value.trim();for(const key of ['goal','duration','breakMinutes'])state.profile[key]=Number(form[key].value);if(!state.active)duration=state.profile.duration;persist();renderToday();toast('偏好已保存。按自己的节奏来。');};
$('#export').onclick=async()=>{try{const data=structuredClone(state);data.active=checkpoint(data.active,Date.now(),true);if(window.desktop){if(await window.desktop.export(data))toast('备份已导出。');}else{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`一隅备份-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('备份已导出。');}}catch(e){toast('导出失败：'+e.message);}};
$('#import').onclick=()=>{if(state.active){toast('请先结束当前计时，再恢复备份。');return;}$('#import-file').click();};
$('#import-file').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try {if(file.size>20*1024*1024)throw Error('文件超过 20 MB');const imported=validateState(JSON.parse(await file.text()));
    if(await confirmAction('用备份替换当前记录？',`备份包含 ${imported.sessions.length} 次专注、${imported.tasks.length} 个目标。当前记录将被替换，请先确认已经导出需要保留的数据。`)){
      imported.active=imported.active?{...imported.active,running:false,anchor:Date.now()}:null;imported.sync=state.sync;const previous=state;state=imported;
      try{await save();duration=state.profile.duration;render();toast('备份已恢复。');}catch(error){state=previous;throw error;}
    }
  }catch(error){toast('无法恢复：'+error.message);}finally{e.target.value='';}
};
window.desktop?.onPause(()=>pause().then(()=>toast('电脑休息了，专注也已暂停。')));
window.addEventListener('beforeunload',()=>{if(!window.desktop&&!loadFailed&&state.active){state.active=checkpoint(state.active,Date.now(),true);persist();}});
document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat&&page==='focus'&&!['INPUT','TEXTAREA','BUTTON','SELECT'].includes(document.activeElement.tagName)&&!$('dialog[open]')){e.preventDefault();start();}if(e.key==='Escape'){setZen(false);}});
async function init(){
  initializeUI();document.body.dataset.page='focus';setZen(false);setButton($('#pin'),'置顶','pin');setButton($('#account-badge'),'账号同步','cloud');
  try{const data=window.desktop?await window.desktop.load():JSON.parse(localStorage.getItem(storageKey)||'null');if(data)state=validateState(data);}
  catch(e){loadFailed=true;$('#save-error').hidden=false;$('#save-error').textContent=e.message+'。为保护原文件，已停用写入，请检查本地数据。';$('#start').disabled=true;}
  if(state.active){state.active={...state.active,running:false,anchor:Date.now()};toast('上次的专注已暂停，准备好后可以继续。');}
  duration=state.profile.duration;$('#today-date').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});render();
  if(!loadFailed){try{syncUI=await setupSync({getState:()=>state,applyState:next=>{state=next;if(!state.active)duration=state.profile.duration;if(page==='settings'){renderTimer();renderToday();}else render();},saveLocal,confirmAction,toast});}catch(e){$('#sync-description').textContent='账号同步暂不可用：'+e.message+'；本地专注不受影响。';}}
  setInterval(()=>{
    if(state.active?.running){if(elapsed(state.active)>=state.active.duration*60000){finish();return;}if(Date.now()-lastSaved>5000){state.active=checkpoint(state.active);persist();lastSaved=Date.now();}}
    renderTimer();renderToday();
  },500);
}
init();
