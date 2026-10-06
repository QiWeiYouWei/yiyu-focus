import {checkpoint} from './core.mjs';
import {validateRelay,offerRelay,settleRelay,compactRelay} from './relay.mjs';
export function setupRelay({getState,save,renderAll,toast,confirmAction,onReceived,escape}){
 const $=s=>document.querySelector(s);let busy=false,status=null,remote=null,message='',lastRead=0;
 const canUse=()=>!!window.desktop?.relayRead;
 function render(){
  const state=getState(),a=state.active;$('#relay-send').disabled=busy||!canUse()||!a||a.kind!=='focus'||a.waiting||!!a.handoffId;$('#relay-cancel').hidden=!a?.handoffId;$('#relay-cancel').disabled=busy;$('#relay-refresh').disabled=busy||!canUse();
  $('#relay-status').textContent=message||(!canUse()?'接力请使用 Windows 或安卓客户端，并连接同一坚果云账号。':a?.handoffId?'这一段已暂停，等待另一台接手。原设备不能继续或结束；可以刷新或撤回。':'暂停并发送后，在另一台设备刷新接力、确认接手。交接期间不累计时间。');
  const rows=(remote?.doc?.transfers||[]).filter(t=>t.status==='offered'&&t.from!==status?.device||t.status==='claimed'&&t.to===status?.device&&!(state.handoffReceipts||[]).includes(t.id)&&!state.sessions.some(s=>s.id===t.active.id));
  $('#relay-list').innerHTML=rows.map(t=>'<div class="relay-item"><strong>'+escape(t.active.title)+'</strong><small>'+escape(t.label||'另一台设备')+' · 已专注 '+Math.floor(t.active.elapsed/60000)+' 分钟'+(t.position?' · '+escape(t.position):'')+'</small><button class="secondary" data-relay-claim="'+t.id+'" '+(busy||!!a?'disabled':'')+'>'+(t.status==='claimed'?'恢复已接手的专注':'接手这一段')+'</button></div>').join('');
 }
 async function read(){
  status=await window.desktop.syncStatus();const state=getState();if(!status.connected)throw Error('请先在账号页连接坚果云。');if(state.sync?.owner!==status.owner)throw Error('这份本机数据尚未绑定当前账号，请先连接并同步。');
  remote=await window.desktop.relayRead();if(remote.owner!==status.owner)throw Error('接力账号发生变化');if(remote.doc)validateRelay(remote.doc);lastRead=Date.now();return remote;
 }
 async function repairSource(){
  const state=getState(),a=state.active;if(!a?.handoffId)return;const t=remote.doc?.transfers.find(t=>t.id===a.handoffId);if(!t||t.from!==status.device)return;
  if(t.status==='claimed'||t.status==='cancelled'){const before=structuredClone(a),pending=state.handoffPending;
   if(t.status==='claimed')state.active=null;else delete state.active.handoffId;delete state.handoffPending;
   try{await save();message=t.status==='claimed'?'另一台已接手，这台设备不再计时。':'接力已撤回，准备好可继续这一段。';}catch(e){state.active=before;state.handoffPending=pending;throw e;}
  }
 }
 async function acknowledge(){
  if(!remote?.doc)return;const state=getState(),doc=structuredClone(remote.doc);let changed=false;
  for(const t of doc.transfers){if(t.status==='offered')continue;if(t.from===status.device&&!t.acknowledged&&state.active?.handoffId!==t.id&&state.handoffPending?.id!==t.id&&(t.status==='cancelled'||state.active?.id!==t.active.id)){t.acknowledged=true;changed=true;}if(t.status==='claimed'&&t.to===status.device&&!t.received&&((state.handoffReceipts||[]).includes(t.id)||state.sessions.some(s=>s.id===t.active.id))){t.received=true;changed=true;}}
  if(changed){await window.desktop.relayWrite({owner:status.owner,etag:remote.etag,doc});await read();}
 }
 async function refresh(){if(busy||!canUse())return;busy=true;render();try{await read();message='';await repairSource();await acknowledge();}catch(error){message=error.message;}finally{busy=false;renderAll();}}
 $('#relay-refresh').onclick=refresh;
 $('#relay-send').onclick=async()=>{
  if(busy)return;let state=getState();const a=state.active;if(!a||a.kind!=='focus'||a.handoffId||a.waiting)return;
  if(!await confirmAction('暂停并交给另一台设备？','先保存当前进度，再发送接力。另一台需要连接同一账号并确认接手；交接时不累计专注。'))return;
  busy=true;render();try{await read();await acknowledge();state=getState();if(state.active?.id!==a.id)throw Error('当前专注已变化');state.active=checkpoint(state.active,Date.now(),true);await save();
   const position=state.active.position||state.courseHabits?.find(h=>h.course===state.active.course)?.position||'';
   const offered=offerRelay(remote.doc,status.owner,status.device,state.active,position,window.desktop.platform==='android'?'安卓设备':'Windows 设备');
   state.active.handoffId=offered.transfer.id;state.handoffPending=offered.transfer;await save();renderAll();
   await window.desktop.relayWrite({owner:status.owner,etag:remote.etag,doc:offered.doc});message='接力已发送。在另一台设备刷新并确认接手。';
  }catch(error){message=error.message+(state.active?.handoffId?' · 发送结果待确认，请刷新或撤回，原设备继续保持暂停。':'');}finally{busy=false;renderAll();}
 };
 $('#relay-cancel').onclick=async()=>{
  let state=getState();const id=state.active?.handoffId;if(busy||!id)return;if(!await confirmAction('撤回这段接力？','如果另一台已接手，会保留另一台的进度。撤回成功后，这台才能继续。'))return;
  busy=true;render();try{await read();state=getState();if(state.active?.handoffId!==id)throw Error('当前接力已变化');const t=remote.doc?.transfers.find(t=>t.id===id);
   if(t?.status==='claimed'||t?.status==='cancelled'){await repairSource();return;}
   let doc;if(t)doc=settleRelay(remote.doc,id,status.device,true);
   else{if(!state.handoffPending||state.handoffPending.id!==id)throw Error('接力凭据缺失，请保留备份后检查；未解除暂停');doc=compactRelay({version:1,owner:status.owner,transfers:[...(remote.doc?.transfers||[]),{...state.handoffPending,status:'cancelled'}]});}
   await window.desktop.relayWrite({owner:status.owner,etag:remote.etag,doc});await read();await repairSource();try{await acknowledge();}catch{}
  }catch(error){message=error.message;}finally{busy=false;renderAll();}
 };
 $('#relay-list').onclick=async e=>{
  const button=e.target.closest('[data-relay-claim]');if(!button||busy||getState().active)return;
  busy=true;render();try{await read();let t=remote.doc?.transfers.find(t=>t.id===button.dataset.relayClaim);if(!t||t.from===status.device||t.status==='cancelled'||t.status==='claimed'&&t.to!==status.device)throw Error('这段接力已变化，请刷新。');
   if(t.status==='offered'){const doc=settleRelay(remote.doc,t.id,status.device);await window.desktop.relayWrite({owner:status.owner,etag:remote.etag,doc});t=doc.transfers.find(r=>r.id===t.id);}
   const state=getState();if(state.active)throw Error('已有计时，先结束这一段再恢复接力。');if(state.sessions.some(s=>s.id===t.active.id))throw Error('这段专注已经完成，不会重复恢复。');
   const previous=structuredClone(state.handoffReceipts||[]);state.active={...structuredClone(t.active),running:false,anchor:Date.now(),position:t.position};state.handoffReceipts=[...new Set([...previous,t.id])].slice(-1000);
   try{await save();}catch(error){state.active=null;state.handoffReceipts=previous;throw error;}message='已接手并保存。准备好后点击继续这一段。';onReceived();toast(message);try{await read();await acknowledge();}catch{}
  }catch(error){message=error.message+' · 刷新可恢复已由这台设备接手的进度。';}finally{busy=false;renderAll();}
 };
 return {render,refresh,tick:()=>{if(getState().active?.handoffId&&Date.now()-lastRead>60000)refresh();}};
}
