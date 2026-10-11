export function setupPetUI({toast}){
 const $=selector=>document.querySelector(selector),api=window.desktop;
 let preferences,last='';
 const available=!!api?.petPreferences;$('#pet-settings').hidden=!available;$('#show-pet').hidden=!available;
 function reflect(value){preferences=value;$('#pet-enabled').checked=value.enabled;$('#pet-scale').value=String(value.scale);$('#pet-companionship').value=value.companionship||'gentle';$('#pet-cursor-gaze').checked=value.cursorGaze!==false;$('#pet-click-through').checked=value.clickThrough;$('#show-pet').setAttribute('aria-pressed',String(value.enabled));$('#pet-settings-status').textContent=value.enabled?(value.clickThrough?'Luna 正在陪伴 · 鼠标穿透已开启，请在这里调整位置或关闭穿透':'Luna 正在陪伴 · 摸摸她的头，或点“聊聊”获得回应'):'Luna 暂时休息 · 随时可以重新开启';}
 async function load(){if(available)try{reflect(await api.petPreferences());}catch(error){toast('桌宠设置暂时无法读取：'+error.message);}}
 if(available){
  api.onPetPreferences(reflect);load();
  $('#pet-settings-form').onsubmit=async event=>{event.preventDefault();try{reflect(await api.savePetPreferences({enabled:$('#pet-enabled').checked,scale:Number($('#pet-scale').value),clickThrough:$('#pet-click-through').checked,companionship:$('#pet-companionship').value,cursorGaze:$('#pet-cursor-gaze').checked}));toast('Luna 的陪伴偏好已保存。');}catch(error){toast('桌宠偏好未保存：'+error.message);}};
  $('#show-pet').onclick=async()=>{try{if(!preferences)await load();if(preferences)reflect(await api.savePetPreferences({...preferences,enabled:!preferences.enabled}));}catch(error){toast(error.message);}};
  $('#pet-reset-position').onclick=async()=>{try{reflect(await api.resetPetPosition());toast('Luna 已回到屏幕右下角。');}catch(error){toast(error.message);}};
 }
 return {
  load,
  publish(active,motion,context={}){if(!available)return;const value={mode:!active?'idle':active.kind==='break'?'rest':active.waiting?'waiting':active.running?'focus':'paused',title:active?.title||'',text:$('#timer').textContent,motion,context};const key=JSON.stringify(value);if(key!==last){last=key;api.publishPet(value);}},
  encourage:(kind,id)=>{if(available)api.encouragePet({kind,id});},
  celebrate:id=>{if(available)api.celebratePet(id);}
 };
}
