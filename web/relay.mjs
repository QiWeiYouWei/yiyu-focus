import {defaultState,validateState} from './core.mjs';
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
const uid=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/i.test(v);
export function validateRelay(doc){
 if(!doc||doc.version!==1||typeof doc.owner!=='string'||!/^nutstore:[^\s@:]+@[^\s@]+$/.test(doc.owner)||!Array.isArray(doc.transfers)||doc.transfers.length>100)throw Error('接力记录格式有误');
 const ids=new Set();let offered=0;
 for(const t of doc.transfers){if(!t||!uid(t.id)||!uid(t.from)||ids.has(t.id)||!['offered','claimed','cancelled'].includes(t.status)||!Number.isFinite(t.created)||t.created<0||t.created>1e14||typeof t.label!=='string'||t.label.length>40||typeof t.position!=='string'||t.position.length>200||t.status==='claimed'&&(!uid(t.to)||t.to===t.from)||t.acknowledged!==undefined&&(typeof t.acknowledged!=='boolean'||t.status==='offered')||t.received!==undefined&&(typeof t.received!=='boolean'||t.status!=='claimed'))throw Error('接力内容无效');ids.add(t.id);if(t.status==='offered')offered++;validateState({...defaultState(),active:t.active});if(t.active?.kind!=='focus'||t.active.running||t.active.handoffId)throw Error('只能交接已经暂停的专注');}
 if(offered>1)throw Error('已有一段专注等待交接');return doc;
}
export function relayTransition(before,next,device){
 validateRelay(next);if(before){validateRelay(before);if(before.owner!==next.owner)throw Error('接力账号不同');}
 for(const t of before?.transfers||[]){const n=next.transfers.find(r=>r.id===t.id);if(!n){if(!canPrune(t))throw Error('不能移除尚未确认保存的接力');continue;}
 if(canonical(n)===canonical(t))continue;
 const identity=v=>({...v,status:t.status,to:undefined,acknowledged:undefined,received:undefined});
 if(canonical(identity(n))!==canonical(identity(t)))throw Error('不能改变接力内容');
 if(n.status!==t.status){if(t.status!=='offered'||n.acknowledged!==t.acknowledged||n.received!==t.received||!(n.status==='cancelled'&&t.from===device||n.status==='claimed'&&n.to===device&&t.from!==device))throw Error('接力状态已变化，请刷新后重试');}
 else if(n.to!==t.to||n.acknowledged!==t.acknowledged&&!(t.status!=='offered'&&n.acknowledged===true&&t.from===device)||n.received!==t.received&&!(t.status==='claimed'&&n.received===true&&t.to===device))throw Error('只能确认这台设备已保存的接力');}
 for(const n of next.transfers)if(!before?.transfers.some(t=>t.id===n.id)&&(n.from!==device||!['offered','cancelled'].includes(n.status)))throw Error('只能发送这台设备的专注');
 return next;
}
export const canPrune=t=>t.acknowledged===true&&(t.status==='cancelled'||t.status==='claimed'&&t.received===true);
export function compactRelay(doc){const next=structuredClone(doc);while(next.transfers.length>=100||new TextEncoder().encode(JSON.stringify(next)).length>900000){const index=next.transfers.findIndex(canPrune);if(index<0)throw Error('尚未确认保存的接力较多，请在另一台刷新接力后再试。');next.transfers.splice(index,1);}return next;}
export function offerRelay(doc,owner,device,active,position='',label='',now=Date.now()){
 if(doc?.transfers.some(t=>t.status==='offered'))throw Error('已有一段专注在等待接手，请先处理或撤回。');
 const copy=structuredClone(active);delete copy.handoffId;const transfer={id:crypto.randomUUID(),from:device,status:'offered',created:now,label,position,active:copy};
 const next=compactRelay({version:1,owner,transfers:[...(doc?.transfers||[]),transfer]});relayTransition(doc,next,device);return {doc:next,transfer};
}
export function settleRelay(doc,id,device,cancel=false){
 const next=structuredClone(doc),t=next.transfers.find(t=>t.id===id);if(!t||t.status!=='offered')throw Error('这段专注已被接手或撤回，请刷新。');t.status=cancel?'cancelled':'claimed';if(!cancel)t.to=device;relayTransition(doc,next,device);return next;
}
