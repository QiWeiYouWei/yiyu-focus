import {setButton} from './ui.mjs';
import {SyncTracker} from './sync.mjs';
const $=s=>document.querySelector(s);
export async function setupSync({getState,applyState,saveLocal,confirmAction,toast}){
  const api=window.desktop;
  if(!api?.syncStatus){$('#sync-description').textContent='账号同步请使用 Windows 桌面版；此网页预览仍可离线使用。';$('#sync-connect-form').hidden=true;return null;}
  let status=await api.syncStatus(),running=false,pending=false,lastSync=getState().sync?.lastSync||0,message=status.error||'',timer;
  let tracker;try{tracker=new SyncTracker(getState(),status.device);}catch{message='本地同步索引校验失败，请导出备份后检查；专注记录仍保留在本机。';$('#sync-description').textContent=message;$('#sync-connect-form').hidden=true;return null;}
  const metadata=()=>({...getState().sync,version:1,packet:tracker.packet(),lastSync});
  const errorMessage=e=>String(e?.message||e).replace(/^Error invoking remote method '[^']+': Error: /,'').slice(0,220);
  function render(){
    $('#sync-connect-form').hidden=status.connected;$('#sync-connected').hidden=!status.connected;
    $('#sync-account').textContent=status.username;$('#sync-now').disabled=running;$('#sync-disconnect').disabled=running;$('#sync-connect-form button').disabled=running;
    $('#sync-state').textContent=running?'正在同步…':message||(!status.connected?'尚未连接 · 继续本地保存':pending?'已保存本机 · 等待同步':lastSync?'上次同步：'+new Date(lastSync).toLocaleString('zh-CN'):'已连接 · 等待首次同步');
    $('#sync-state').classList.toggle('sync-error',!!message);setButton($('#account-badge'),running?'同步中':status.connected?(pending?'待同步':'已连接'):'账号同步',running?'refresh':'cloud');$('#account-badge').classList.toggle('is-syncing',running);$('#account-badge').setAttribute('aria-busy',String(running));
    $('.local-status').textContent=status.connected?(pending?'已存本机 · 待同步':'已存本机 · 云端已连接'):'本地保存 · 属于你自己';
  }
  function observe(state){const changed=tracker.observe(state);state.sync=metadata();if(changed){pending=true;message='';}return changed;}
  function schedule(){if(!status.connected||running||!pending)return;clearTimeout(timer);timer=setTimeout(()=>sync(),15000);render();}
  async function sync(){
    if(running||!status.connected)return;clearTimeout(timer);running=true;message='';render();
    try{
      const state=getState();if(state.sync?.owner!==status.owner)throw Error('本机记录尚未绑定此账号，请断开后重新连接；不会上传到其他账号。');
      const remote=await api.syncRead();if(remote.owner!==status.owner)throw Error('同步账号已变化，已停止合并');
      // Observe again after the network read: edits made while awaiting it must
      // participate in this merge, never be replaced by an earlier snapshot.
      tracker.observe(getState());tracker.merge(remote.packets);
      const next=tracker.apply(getState());next.sync={...metadata(),owner:status.owner};applyState(next);
      await saveLocal();const outgoing=tracker.packet();
      await api.syncWrite({owner:status.owner,packet:outgoing});
      pending=JSON.stringify(outgoing)!==JSON.stringify(tracker.packet());lastSync=Date.now();getState().sync=metadata();await saveLocal();
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
