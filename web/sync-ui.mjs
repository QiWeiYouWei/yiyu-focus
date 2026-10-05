import {setButton} from './ui.mjs';
import {SyncTracker,validConflict} from './sync.mjs';
const $=s=>document.querySelector(s);
export async function setupSync({getState,applyState,saveLocal,confirmAction,toast}){
  const api=window.desktop;
  if(!api?.syncStatus){$('#sync-description').textContent='账号同步请使用 Windows 桌面版；此网页预览仍可离线使用。';$('#sync-connect-form').hidden=true;return null;}
  let status=await api.syncStatus(),running=false,pending=false,lastSync=getState().sync?.lastSync||0,message=status.error||'',timer;
  let conflicts=(Array.isArray(getState().sync?.conflicts)?getState().sync.conflicts:[]).filter(validConflict).slice(-100);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function versionText(entry){const v=entry.value;if(v===null)return '已删除';if(typeof v!=='object')return String(v);const names={title:'名称',text:'念头',course:'课程',minutes:'专注分钟',focusMinutes:'专注分钟',date:'开始日期',endDate:'结束日期',time:'开始时间',endTime:'结束时间',deadline:'截止日期',notes:'备注',note:'收获',nextStep:'下一步',question:'问题',position:'学习位置',material:'资料',seconds:'专注秒数',icon:'图标'};const lines=Object.entries(names).filter(([key])=>v[key]!==undefined&&v[key]!=='').map(([key,label])=>label+'：'+v[key]);if(v.quantity)lines.push('学习量：'+(v.quantity.actual!==undefined?v.quantity.actual+' / ':'')+v.quantity.target+' '+v.quantity.unit);if(v.done!==undefined)lines.push(v.done?'已完成':'待完成');if(v.pinned!==undefined)lines.push(v.pinned?'已置顶':'未置顶');if(v.reminder)lines.push('提醒：'+(v.reminder.anchor==='deadline'?'截止日期':'开始时间')+'前 '+v.reminder.minutes+' 分钟');return lines.join('\n');}
  let tracker;try{tracker=new SyncTracker(getState(),status.device);}catch{message='本地同步索引校验失败，请导出备份后检查；专注记录仍保留在本机。';$('#sync-description').textContent=message;$('#sync-connect-form').hidden=true;return null;}
  pending=tracker.dirty.size>0;
  const metadata=()=>({...getState().sync,version:1,packet:tracker.packet(),lastSync,dirty:[...tracker.dirty],bases:[...tracker.bases.values()],conflicts});
  const errorMessage=e=>String(e?.message||e).replace(/^Error invoking remote method '[^']+': Error: /,'').slice(0,220);
  function render(){
    $('#sync-connect-form').hidden=status.connected;$('#sync-connected').hidden=!status.connected;
    $('#sync-account').textContent=status.username;$('#sync-now').disabled=running;$('#sync-disconnect').disabled=running;$('#sync-connect-form button').disabled=running;
    $('#sync-state').textContent=running?'正在同步…':message||(!status.connected?'尚未连接 · 继续本地保存':pending?'已保存本机 · 等待同步':lastSync?'上次同步：'+new Date(lastSync).toLocaleString('zh-CN'):'已连接 · 等待首次同步');
    $('#sync-last-success').textContent=lastSync?'最近成功同步：'+new Date(lastSync).toLocaleString('zh-CN'):'尚未完成过同步。';
    $('#sync-conflicts').innerHTML=conflicts.length?conflicts.map(c=>{const label={profile:'偏好',events:'日历安排',focusPresets:'常用事件',sessions:'专注记录',tasks:'待办',thoughts:'念头',courseHabits:'课程习惯'}[c.group];const name=c.local.value?.title||c.remote.value?.title||c.local.value?.text||c.recordId;return '<div class="conflict-card"><strong>'+esc(label+' · '+name)+'</strong><details><summary>查看两个版本</summary><p>这台设备（'+esc(new Date(c.local.clock.time).toLocaleString('zh-CN'))+ '）</p><pre>'+esc(versionText(c.local))+'</pre><p>另一台设备（'+esc(new Date(c.remote.clock.time).toLocaleString('zh-CN'))+'）</p><pre>'+esc(versionText(c.remote))+'</pre></details><div class="backup-actions"><button class="secondary" data-conflict="'+esc(c.id)+'" data-side="local" '+(running?'disabled':'')+'>保留这台设备版本</button><button class="secondary" data-conflict="'+esc(c.id)+'" data-side="remote" '+(running?'disabled':'')+'>保留另一台设备版本</button><button class="text-button" data-conflict-dismiss="'+esc(c.id)+'" '+(running?'disabled':'')+'>保持当前结果</button></div></div>';}).join(''):'<p class="muted">暂时没有需要选择的版本。</p>';
    $('#sync-state').classList.toggle('sync-error',!!message);setButton($('#account-badge'),running?'同步中':status.connected?(pending?'待同步':'已连接'):'账号同步',running?'refresh':'cloud');$('#account-badge').classList.toggle('is-syncing',running);$('#account-badge').setAttribute('aria-busy',String(running));
    $('.local-status').textContent=status.connected?(pending||message?'已存本机 · 待同步':lastSync?'本机与云端已同步':'已存本机 · 等待首次同步'):'本地保存 · 属于你自己';
  }
  function observe(state){const changed=tracker.observe(state);state.sync=metadata();if(changed){pending=true;message='';render();}return changed;}
  function schedule(){if(!status.connected||running||!pending)return;clearTimeout(timer);timer=setTimeout(()=>sync(),15000);render();}
  async function sync(){
    if(running||!status.connected)return;clearTimeout(timer);running=true;message='';render();
    try{
      const state=getState();if(state.sync?.owner!==status.owner)throw Error('本机记录尚未绑定此账号，请断开后重新连接；不会上传到其他账号。');
      const remote=await api.syncRead();if(remote.owner!==status.owner)throw Error('同步账号已变化，已停止合并');
      // Observe again after the network read: edits made while awaiting it must
      // participate in this merge, never be replaced by an earlier snapshot.
      tracker.observe(getState());tracker.merge(remote.packets);for(const c of tracker.takeConflicts()){if(!conflicts.some(old=>old.id===c.id))conflicts.push(c);}conflicts=conflicts.slice(-100);
      const next=tracker.apply(getState());next.sync={...metadata(),owner:status.owner};applyState(next);
      await saveLocal();const outgoing=tracker.packet();
      await api.syncWrite({owner:status.owner,packet:outgoing});
      tracker.settled(outgoing);pending=JSON.stringify(outgoing)!==JSON.stringify(tracker.packet());lastSync=Date.now();getState().sync=metadata();await saveLocal();
    }catch(e){message=errorMessage(e);pending=true;}
    finally{running=false;render();if(pending&&!message)schedule();}
  }
  $('#sync-connect-form').onsubmit=async e=>{
    e.preventDefault();if(running)return;
    const username=$('#sync-username').value.trim().toLowerCase(),password=$('#sync-password').value.trim(),owner='nutstore:'+username;
    if(getState().sync?.owner&&getState().sync.owner!==owner){toast('这些记录已绑定其他坚果云账号，请使用原账号，以免混入另一份记录。');return;}
    if(!await confirmAction('连接坚果云并同步记录？','将本机的专注记录、任务、念头和偏好与此坚果云账号合并保存。正在进行的计时仅保留在当前设备。'))return;
    running=true;message='';render();
    try{status=await api.syncConnect({username,password});getState().sync={...metadata(),owner:status.owner};await saveLocal();pending=true;toast('账号已连接，正在合并云端记录。');}
    catch(error){message=errorMessage(error);}
    finally{$('#sync-password').value='';running=false;render();}
    if(status.connected&&!message)await sync();
  };
  $('#sync-conflicts').onclick=async e=>{const button=e.target.closest('button');if(!button||running)return;const conflict=conflicts.find(c=>c.id===(button.dataset.conflict||button.dataset.conflictDismiss));if(!conflict)return;const before=structuredClone(getState()),oldConflicts=conflicts.slice();try{if(button.dataset.side){const entry=conflict[button.dataset.side];if(!await confirmAction('保留这个版本？',entry.value===null?'这个版本已删除此内容。保留后会再次同步删除。':'选中的内容会作为一次新的修改同步到其他设备。'))return;const state=getState();if(entry.group==='profile')state.profile[entry.id]=structuredClone(entry.value);else {state[entry.group]=(state[entry.group]||[]).filter(r=>r.id!==entry.id);if(entry.value!==null)state[entry.group].push(structuredClone(entry.value));}observe(state);}conflicts=conflicts.filter(c=>c.id!==conflict.id);getState().sync=metadata();await saveLocal();applyState(getState());render();schedule();toast('版本选择已保存在本机。');}catch(error){conflicts=oldConflicts;applyState(before);tracker=new SyncTracker(before,status.device);render();toast('未能保存：'+errorMessage(error));}};
  $('#sync-now').onclick=()=>sync();
  $('#sync-disconnect').onclick=async()=>{
    if(running)return;if(!await confirmAction('断开这台设备的云同步？',pending?'还有记录尚未同步。断开后仍保留本机记录，可以稍后重新连接原账号。':'本机和云端记录都会保留，这台设备保存的应用密码会被移除。'))return;
    clearTimeout(timer);try{status=await api.syncDisconnect();message='';toast('已断开云同步，继续在本机保存。');}catch(e){message=errorMessage(e);}render();
  };
  window.addEventListener('online',()=>{if(status.connected)sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&status.connected&&Date.now()-lastSync>120000)sync();});
  // Poll directory versions only every five minutes. Unchanged files are cached
  // by ETag; timer checkpoints never cause uploads.
  setInterval(()=>{if(status.connected)sync();},300000);
  render();if(status.connected){pending=true;setTimeout(()=>sync(),2000);}
  return {observe,schedule,flush:async()=>{clearTimeout(timer);/* Offline shutdown must never wait for the network. */},get pending(){return pending;}};
}
