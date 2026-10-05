import {orderedPresets} from './journey.mjs';
import {eventIcons,validPreset,validQuantity,quantityLabel} from './planning.mjs';

export function setupQuickFocus({getState,getPage,isBlocked,save,renderAll,startPreset,toast,confirmAction,recycle,escape,icon,onPresetsChanged}) {
  const $=selector=>document.querySelector(selector);
  let editing=null,selectedIcon='📚',saving=false;
  const ordered=()=>orderedPresets(getState().focusPresets||[]);
  const meta=p=>[p.minutes+' 分钟',p.course,p.quantity?quantityLabel(p.quantity):''].filter(Boolean).map(escape).join(' · ');

  function updateBusy() {
    const busy=!!getState().active;
    $('#preset-busy').hidden=!busy;
    for(const button of document.querySelectorAll('[data-start-preset]'))button.disabled=busy||isBlocked();
  }
  function render() {
    const presets=ordered();
    $('#quick-focus-list').innerHTML=presets.length?presets.slice(0,4).map(p=>
      '<button class="quick-launch" data-start-preset="'+escape(p.id)+'" aria-label="开始 '+escape(p.title)+'，'+p.minutes+' 分钟"><span class="preset-icon" aria-hidden="true">'+p.icon+'</span><span class="quick-launch-copy"><strong>'+escape(p.title)+'</strong><small>'+meta(p)+'</small></span><span class="quick-play" aria-hidden="true">'+icon('play')+'</span></button>'
    ).join(''):'<p class="muted">把背单词、阅读、做题等常做的事存下来。</p><button class="secondary" data-create-preset>＋ 添加第一个常用事件</button>';
    if(getPage()==='quick') {
      $('#preset-count').textContent=presets.length+' 个常用事件';
      $('#preset-list').innerHTML=presets.length?presets.map(p=>
        '<article class="card preset-card"><div class="preset-card-top"><span class="preset-icon" aria-hidden="true">'+p.icon+'</span><div><h2>'+escape(p.title)+(p.pinned?'<span class="preset-pin">置顶</span>':'')+'</h2><div class="preset-meta">'+meta(p)+'</div></div></div><div class="preset-card-actions"><button class="primary" data-start-preset="'+escape(p.id)+'">开始专注 →</button><button class="text-button" data-edit-preset="'+escape(p.id)+'" aria-label="编辑 '+escape(p.title)+'">编辑</button><button class="text-button" data-delete-preset="'+escape(p.id)+'" aria-label="删除 '+escape(p.title)+'">删除</button></div><div class="preset-extra-actions"><button class="secondary" data-pin-preset="'+escape(p.id)+'">'+(p.pinned?'取消置顶':'置顶')+'</button><button class="secondary" data-copy-preset="'+escape(p.id)+'">复制</button><button class="secondary" data-move-preset="'+escape(p.id)+'" data-direction="-1" aria-label="上移 '+escape(p.title)+'">上移</button><button class="secondary" data-move-preset="'+escape(p.id)+'" data-direction="1" aria-label="下移 '+escape(p.title)+'">下移</button>'+(window.desktop?.platform==='android'?'<button class="secondary" data-shortcut-preset="'+escape(p.id)+'">添加到手机桌面</button>':'')+'</div></article>'
      ).join(''):'<article class="card preset-empty"><span class="preset-icon" aria-hidden="true">🎯</span><h2>给常做的事，一个快捷入口。</h2><p>例如：背单词 10 分钟、阅读 15 分钟、做题 25 分钟。<br>名称、图标、课程和学习量都可以自己设定。</p><button class="primary" data-create-preset>＋ 添加常用事件</button></article>';
    }
    updateBusy();
  }
  function renderIcons() {
    $('#preset-icons').innerHTML=eventIcons.map(([value,label])=>'<button type="button" data-preset-icon="'+escape(value)+'" aria-label="'+label+'图标" aria-pressed="'+(value===selectedIcon)+'">'+value+'</button>').join('');
  }
  function open(preset=null) {
    editing=preset?.id||null;selectedIcon=preset?.icon||'📚';
    $('#preset-dialog-title').textContent=preset?'编辑常用事件':'添加常用事件';
    $('#preset-title').value=preset?.title||'';
    $('#preset-minutes').value=preset?.minutes||15;
    $('#preset-course').value=preset?.course||'';
    $('#preset-target').value=preset?.quantity?.target??'';
    $('#preset-unit').value=preset?.quantity?.unit||'个单词';
    $('#preset-quantity').open=!!preset?.quantity;
    $('#preset-error').hidden=true;renderIcons();
    $('#preset-dialog').showModal();$('#preset-title').focus();
  }
  $('#preset-add').onclick=()=>open();
  $('#preset-icons').onclick=e=> {
    const button=e.target.closest('[data-preset-icon]');if(!button)return;
    selectedIcon=button.dataset.presetIcon;renderIcons();
    $('#preset-icons [data-preset-icon="'+selectedIcon+'"]').focus();
  };
  $('#preset-form').onsubmit=async e=> {
    e.preventDefault();if(saving)return;
    const state=getState(),old=(state.focusPresets||[]).find(p=>p.id===editing),now=Date.now();
    if(editing&&!old){toast('这项常用事件已在其他设备删除，请重新添加。');return;}
    const target=$('#preset-target').value;
    const quantity=target?{target:Number(target),unit:$('#preset-unit').value.trim()}:undefined;
    const preset={id:editing||crypto.randomUUID(),title:$('#preset-title').value.trim(),icon:selectedIcon,course:$('#preset-course').value.trim(),minutes:Number($('#preset-minutes').value),...(quantity?{quantity}:{}),...(old?.pinned!==undefined?{pinned:old.pinned}:{}),...(old?.order!==undefined?{order:old.order}:{}),created:old?.created??now,updated:now};
    if(!validQuantity(quantity)||!validPreset(preset)) {
      $('#preset-error').textContent='请填写事件名称、1–120 的整数分钟，以及有效的学习量和单位。';$('#preset-error').hidden=false;return;
    }
    const before=structuredClone(state.focusPresets||[]),submit=$('#preset-form .primary');
    saving=true;submit.disabled=true;state.focusPresets??=[];
    if(old)state.focusPresets[state.focusPresets.indexOf(old)]=preset;else state.focusPresets.push(preset);
    try{await save();$('#preset-dialog').close();renderAll();toast('常用事件已保存，下次一点就开始。');}
    catch(error){state.focusPresets=before;toast('保存失败：'+error.message);}
    finally{saving=false;submit.disabled=false;}
  };
  async function action(e) {
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-create-preset')){open();return;}
    const state=getState(),preset=(state.focusPresets||[]).find(p=>p.id===(button.dataset.startPreset||button.dataset.editPreset||button.dataset.deletePreset||button.dataset.pinPreset||button.dataset.copyPreset||button.dataset.movePreset||button.dataset.shortcutPreset));if(!preset)return;
    if(button.dataset.startPreset){startPreset(preset);return;}
    if(button.dataset.editPreset){open(preset);return;}
    if(button.dataset.shortcutPreset){try{const result=await window.desktop.pinPreset(preset.id);toast(result?'已请求添加，请在系统窗口中确认。':'当前桌面不支持固定快捷入口。');}catch(error){toast(error.message);}return;}
    if(button.dataset.pinPreset||button.dataset.copyPreset||button.dataset.movePreset){
      const before=structuredClone(state.focusPresets),now=Date.now();
      if(button.dataset.pinPreset){preset.pinned=!preset.pinned;preset.updated=now;}
      else if(button.dataset.copyPreset){if(state.focusPresets.length>=2000){toast('常用事件数量已达上限。');return;}const copy={...structuredClone(preset),id:crypto.randomUUID(),title:(preset.title.slice(0,194)+' 副本'),created:now,updated:now,pinned:false,order:now};state.focusPresets.push(copy);}
      else {const rows=ordered().filter(p=>!!p.pinned===!!preset.pinned),index=rows.findIndex(p=>p.id===preset.id),next=index+Number(button.dataset.direction);if(next<0||next>=rows.length)return;[rows[index],rows[next]]=[rows[next],rows[index]];rows.forEach((p,i)=>{p.order=i;p.updated=now;});}
      try{await save();renderAll();onPresetsChanged?.();}catch(error){state.focusPresets=before;renderAll();toast('保存失败：'+error.message);}return;
    }
    if(button.dataset.deletePreset) {
      if(!await confirmAction('删除这个常用事件？','已有专注记录仍保留。30 天内可在偏好中恢复，删除和恢复也会同步。'))return;
      const before=structuredClone(state.focusPresets),trash=structuredClone(state.trash||[]);
      recycle(state,'focusPresets',preset.id);
      try{await save();renderAll();toast('常用事件已移入回收站。');}
      catch(error){state.focusPresets=before;state.trash=trash;renderAll();toast('保存失败：'+error.message);}
    }
  }
  $('#quick-focus-list').onclick=action;$('#preset-list').onclick=action;
  return {render,updateBusy};
}
