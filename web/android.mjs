import {validateState} from './core.mjs';
import {validatePacket} from './sync.mjs';
if(globalThis.YiyuAndroid){
 const pending=new Map();let next=0;
 globalThis.__yiyuReply=result=>{const p=pending.get(result.id);if(!p)return;clearTimeout(p.timer);pending.delete(result.id);result.ok?p.resolve(result.value):p.reject(Error(result.error||'操作未完成'));};
 function invoke(action,args=null){return new Promise((resolve,reject)=>{const id='android-'+(++next),timer=setTimeout(()=>{pending.delete(id);reject(Error('操作暂时没有响应，请保留当前窗口后重试'));},action==='backup:export'||action==='material:choose'?600000:120000);pending.set(id,{resolve,reject,timer});try{globalThis.YiyuAndroid.post(JSON.stringify({id,action,args}));}catch(error){clearTimeout(timer);pending.delete(id);reject(error);}});}
 window.desktop={platform:'android',
  load:async()=>{const data=await invoke('data:load');return data?validateState(data):null;},save:data=>invoke('data:save',validateState(data)),restore:data=>invoke('data:restore',validateState(data)),
  backups:()=>invoke('backup:list'),readBackup:async id=>validateState(await invoke('backup:read',id)),backupNow:data=>invoke('backup:now',validateState(data)),export:data=>invoke('backup:export',validateState(data)),
  chooseMaterial:()=>invoke('material:choose'),openMaterial:location=>invoke('material:open',location),notify:text=>invoke('notify',text),
  syncStatus:()=>invoke('sync:status'),syncConnect:data=>invoke('sync:connect',data),syncDisconnect:()=>invoke('sync:disconnect'),syncRead:async()=>{const result=await invoke('sync:read');result.packets.forEach(validatePacket);return result;},syncWrite:data=>invoke('sync:write',{owner:data.owner,packet:validatePacket(data.packet)})
 };
 document.documentElement.dataset.platform='android';
 for(const selector of ['#pin','#show-mini','#desktop-preferences'])document.querySelector(selector).hidden=true;
 document.querySelector('#today-date').hidden=true;
 document.querySelector('#habit-material').placeholder='网页地址，或选择手机里的学习资料';
 document.querySelector('#automatic-backups').closest('article').querySelector('.muted').textContent='手机自动保留最近 30 份备份，恢复前保护当前记录；回收站保留 30 天。';
 const hint=document.querySelector('#export').closest('article').querySelector('.micro-copy');hint.textContent='切到资料或锁屏后，计时继续到目标时长。重启手机会暂停；应用被系统强行停止时提醒可能失效。';
 const settings=document.querySelector('#page-settings'),card=document.createElement('article');card.className='settings-card';card.innerHTML='<h2>离开页面，也记得收尾。</h2><p class="muted" id="mobile-reminder-status">正在检查提醒设置…</p><div class="backup-actions"><button id="mobile-notifications" class="secondary">开启通知提醒</button><button id="mobile-exact" class="secondary">允许准时提醒</button></div><p class="micro-copy">计时不依赖页面一直打开。部分手机会限制后台提醒，可在系统设置中允许一隅后台运行。</p>';settings.insertBefore(card,document.querySelector('#desktop-preferences'));
 window.mobileRefresh=async()=>{try{const s=await invoke('mobile:status');document.querySelector('#mobile-reminder-status').textContent=(s.notifications?'通知已开启':'通知尚未开启')+' · '+(s.exact?'可准时提醒':'后台提醒可能延迟');document.querySelector('#mobile-exact').hidden=s.exact;}catch(error){document.querySelector('#mobile-reminder-status').textContent=error.message;}};
 document.querySelector('#mobile-notifications').onclick=()=>invoke('mobile:notifications').catch(()=>{});document.querySelector('#mobile-exact').onclick=()=>invoke('mobile:exact').catch(()=>{});
 window.mobileRefresh();
}
