import {validSemester,semesterName,semesterTracks,removeSemester} from './courses.mjs';
export function setupSemesters({getState,commit,escape,toast,confirmAction}) {
  const $=s=>document.querySelector(s);let editing=null;
  $('#course-semester-toolbar').innerHTML=`<div class="semester-toolbar-main"><label>按学期查看<select id="course-semester-filter" aria-label="按学期查看课程"></select></label><button id="semester-manage" class="secondary">管理学期</button></div><p id="semester-current-label" class="micro-copy"></p>`;
  document.body.insertAdjacentHTML('beforeend',`<dialog id="semester-dialog" class="course-dialog" aria-labelledby="semester-title"><h2 id="semester-title">管理学期</h2><p class="micro-copy">自定义学期名称，例如“大二上”或“2026–2027 第一学期”。当前学期用于生成今日追赶任务，筛选只改变课程列表。</p><div id="semester-list" class="semester-list"></div><form id="semester-form"><h3 id="semester-form-title">新建学期</h3><label>学期名称<input id="semester-name" maxlength="40" required placeholder="例如：大二上"></label><label class="checkbox-label"><input id="semester-current" type="checkbox">设为当前学期</label><p id="semester-error" class="course-error" role="alert" hidden></p><div class="dialog-actions"><button type="button" id="semester-new" class="secondary">新建另一个学期</button><button class="primary" id="semester-save">保存学期</button></div></form><div class="dialog-actions"><button type="button" class="secondary" id="semester-close">完成</button></div></dialog>`);
  const semesters=()=>getState().courseSemesters||[];
  const options=selected=>'<option value="">未分类</option>'+semesters().map(s=>`<option value="${escape(s.id)}" ${selected===s.id?'selected':''}>${escape(s.name)}</option>`).join('');
  function renderList() {
    $('#semester-list').innerHTML=semesters().length?semesters().map(s=>`<div class="semester-item"><div><strong>${escape(s.name)}</strong><small>${semesterTracks(getState().courseTracks||[],s.id).length} 门课程${getState().currentCourseSemester===s.id?' · 当前学期':''}</small></div><div class="semester-actions"><button type="button" class="text-button" data-semester-edit="${escape(s.id)}">编辑</button><button type="button" class="text-button" data-semester-current="${escape(s.id)}" ${getState().currentCourseSemester===s.id?'disabled':''}>设为当前</button><button type="button" class="text-button" data-semester-delete="${escape(s.id)}">删除</button></div></div>`).join(''):'<p class="muted">还没有学期。先创建一个，再把课程分进去。</p>';
  }
  function render() {
    const state=getState(),tracks=state.courseTracks||[],filter=state.courseSemesterFilter||'all';
    $('#course-semester-filter').innerHTML=`<option value="all">全部学期 · ${tracks.length} 门</option><option value="unassigned">未分类 · ${semesterTracks(tracks,'unassigned').length} 门</option>`+semesters().map(s=>`<option value="${escape(s.id)}">${escape(s.name)} · ${semesterTracks(tracks,s.id).length} 门${state.currentCourseSemester===s.id?'（当前）':''}</option>`).join('');
    $('#course-semester-filter').value=filter;
    $('#semester-current-label').textContent='当前学期：'+semesterName(semesters(),state.currentCourseSemester)+' · 今日任务只推荐当前学期的课程';
    if($('#semester-dialog').open)renderList();
    if($('#course-editor').open){const old=$('#course-semester').value;$('#course-semester').innerHTML=options(old);$('#course-semester').value=semesters().some(s=>s.id===old)?old:'';}
  }
  function edit(s=null) {editing=s?.id||null;$('#semester-form-title').textContent=s?'编辑学期':'新建学期';$('#semester-name').value=s?.name||'';$('#semester-current').checked=s?getState().currentCourseSemester===s.id:!getState().currentCourseSemester;$('#semester-error').hidden=true;}
  function open(){edit();renderList();$('#semester-dialog').showModal();}
  $('#semester-manage').onclick=open;$('#semester-new').onclick=()=>edit();$('#semester-close').onclick=()=>$('#semester-dialog').close();
  $('#course-semester-filter').onchange=async()=>{try{await commit(null,undefined,{courseSemesterFilter:$('#course-semester-filter').value});}catch(error){toast(error.message);render();}};
  $('#semester-form').onsubmit=async e=>{e.preventDefault();try{const state=getState(),name=$('#semester-name').value.trim().replace(/\s+/g,' '),old=semesters().find(s=>s.id===editing),semester={id:old?.id||crypto.randomUUID(),name,updated:Date.now()};
    if(!validSemester(semester))throw Error('请填写 1–40 字的学期名称');
    if(semesters().some(s=>s.id!==semester.id&&s.name.trim().replace(/\s+/g,' ').toLocaleLowerCase()===name.toLocaleLowerCase()))throw Error('已有同名学期，请使用不同名称');
    if(!old&&semesters().length>=100)throw Error('最多保存 100 个学期');
    const current=$('#semester-current').checked?semester.id:state.currentCourseSemester===semester.id?'':state.currentCourseSemester||'';
    await commit(null,undefined,{courseSemesters:old?semesters().map(s=>s.id===semester.id?semester:s):[...semesters(),semester],currentCourseSemester:current,courseSemesterFilter:$('#semester-current').checked?semester.id:state.courseSemesterFilter||'all'});
    if(!old&&$('#course-editor').open)$('#course-semester').value=semester.id;
    edit(semester);renderList();toast('学期已保存。');
  }catch(error){$('#semester-error').textContent=error.message;$('#semester-error').hidden=false;}};
  $('#semester-list').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{
    if(b.dataset.semesterEdit){edit(semesters().find(s=>s.id===b.dataset.semesterEdit));$('#semester-name').focus();}
    else if(b.dataset.semesterCurrent){await commit(null,undefined,{currentCourseSemester:b.dataset.semesterCurrent,courseSemesterFilter:b.dataset.semesterCurrent});edit(semesters().find(s=>s.id===b.dataset.semesterCurrent));renderList();toast('已切换当前学期。');}
    else if(b.dataset.semesterDelete){const s=semesters().find(s=>s.id===b.dataset.semesterDelete);if(!s)return;if(!await confirmAction('删除“'+s.name+'”分类？','该学期的课程将移到“未分类”，知识点、掌握程度和专注记录都会保留。'))return;await commit(null,undefined,removeSemester(getState(),s.id));edit();renderList();toast('分类已删除，课程已移到未分类。');}
  }catch(error){toast(error.message);}};
  return {render,options,open,name:id=>semesterName(semesters(),id)};
}
