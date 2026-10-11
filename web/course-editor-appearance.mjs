import {courseIcons,courseIcon,importanceLabels,urgencyLabels,prepareCourseCover} from './course-appearance.mjs';
export function setupCourseAppearance() {
  const $=s=>document.querySelector(s);let chosenIcon='',cover='',loading=false,request=0;
  $('#course-topics').closest('label').insertAdjacentHTML('beforebegin',`<section class="course-appearance" aria-label="课程外观和优先级"><div id="course-visual-preview" class="course-visual-preview"><img id="course-cover-preview" alt="课程封面预览" hidden><span id="course-icon-preview" class="course-icon-tile"></span><span class="course-preview-caption">课程外观预览</span></div><div class="course-cover-actions"><button type="button" id="course-cover-choose" class="secondary">上传 / 替换封面</button><button type="button" id="course-cover-remove" class="text-button">移除封面</button><input id="course-cover-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></div><p id="course-cover-status" class="micro-copy" role="status">可选 JPG、PNG、WebP。图片会居中裁成横向封面。</p><details id="course-icon-options"><summary>选择课程图标</summary><div id="course-icon-grid" class="course-icon-grid" role="group" aria-label="课程图标"></div></details><div class="course-priority-fields"><label>重要程度<select id="course-importance">${importanceLabels.map((label,i)=>`<option value="${i}">${label}</option>`).join('')}</select></label><label>紧急程度<select id="course-urgency">${urgencyLabels.map((label,i)=>`<option value="${i}">${label}</option>`).join('')}</select></label></div><p class="micro-copy">重要：这门课对你有多关键。紧急：你希望多快处理。两项会参与今日任务排序。</p></section>`);
  function render() {
    $('#course-icon-preview').innerHTML=courseIcon({icon:chosenIcon||undefined,course:$('#course-name').value});
    $('#course-cover-preview').hidden=!cover;if(cover)$('#course-cover-preview').src=cover;else $('#course-cover-preview').removeAttribute('src');
    $('#course-visual-preview').classList.toggle('has-cover',!!cover);$('#course-cover-remove').disabled=!cover&&!loading;
    $('#course-icon-grid').innerHTML=`<button type="button" data-course-icon="" aria-pressed="${!chosenIcon}"><span>${courseIcon({course:$('#course-name').value})}</span><small>自动</small></button>`+courseIcons.map(i=>`<button type="button" data-course-icon="${i.id}" aria-label="${i.label}图标" aria-pressed="${chosenIcon===i.id}"><span>${courseIcon({icon:i.id})}</span><small>${i.label}</small></button>`).join('');
  }
  function stopLoading(){++request;loading=false;$('#course-cover-file').value='';$('#course-editor-form .primary').disabled=false;}
  $('#course-editor').addEventListener('close',stopLoading);
  $('#course-name').addEventListener('input',()=>{if(!chosenIcon)render();});
  $('#course-icon-grid').onclick=e=>{const button=e.target.closest('[data-course-icon]');if(!button)return;chosenIcon=button.dataset.courseIcon;render();};
  $('#course-cover-choose').onclick=()=>$('#course-cover-file').click();
  $('#course-cover-file').onchange=async()=>{const file=$('#course-cover-file').files[0];if(!file)return;const ticket=++request;loading=true;$('#course-editor-form .primary').disabled=true;$('#course-cover-status').textContent='正在准备封面…';
    try{const prepared=await prepareCourseCover(file);if(ticket!==request||!$('#course-editor').open)return;cover=prepared;render();$('#course-cover-status').textContent='封面已准备好，保存课程后生效。';}
    catch(error){if(ticket===request)$('#course-cover-status').textContent=error.message;}
    finally{if(ticket===request){loading=false;$('#course-cover-file').value='';$('#course-editor-form .primary').disabled=false;}}
  };
  $('#course-cover-remove').onclick=()=>{stopLoading();cover='';render();$('#course-cover-status').textContent='已移除封面，保存课程后生效。';};
  return {open(c){stopLoading();chosenIcon=c?.icon||'';cover=c?.cover||'';$('#course-importance').value=String(c?.importance||0);$('#course-urgency').value=String(c?.urgency||0);$('#course-icon-options').open=false;$('#course-cover-status').textContent='可选 JPG、PNG、WebP。图片会居中裁成横向封面。';render();},
    values(){if(loading)throw Error('封面正在准备，请稍候');return {icon:chosenIcon||undefined,cover,importance:Number($('#course-importance').value),urgency:Number($('#course-urgency').value)};}};
}
