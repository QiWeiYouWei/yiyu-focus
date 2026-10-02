import {defaultState,validateState} from './core.mjs';
const groups=['profile','tasks','sessions','thoughts'];
const keyOf=e=>`${e.group}:${e.id}`;
const compare=(a,b)=>a.time-b.time || a.device.localeCompare(b.device);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function payload(state){return {version:1,profile:structuredClone(state.profile),tasks:structuredClone(state.tasks),sessions:structuredClone(state.sessions),thoughts:structuredClone(state.thoughts),active:null};}
function records(state){return [
  ...Object.entries(state.profile).map(([id,value])=>({group:'profile',id,value})),
  ...['tasks','sessions','thoughts'].flatMap(group=>state[group].map(value=>({group,id:value.id,value})))
];}
export function validatePacket(packet){
  if(!packet||packet.version!==1||!Array.isArray(packet.entries)||packet.entries.length>200000)throw Error('云端记录格式不兼容');
  const keys=new Set(),validProfile=Object.keys(defaultState().profile),state=defaultState();
  for(const e of packet.entries){
    if(!e||!groups.includes(e.group)||typeof e.id!=='string'||e.id.length>100||!e.clock||!Number.isSafeInteger(e.clock.time)||e.clock.time<0||typeof e.clock.device!=='string'||e.clock.device.length>100||!e.clock.device)throw Error('云端记录校验失败');
    const key=keyOf(e);if(keys.has(key))throw Error('云端有重复记录');keys.add(key);
    if(e.group==='profile'){if(!validProfile.includes(e.id)||e.value===null)throw Error('云端偏好格式错误');state.profile[e.id]=e.value;}
    else if(e.value!==null){if(e.value?.id!==e.id)throw Error('云端记录标识不一致');state[e.group].push(e.value);}
  }
  validateState(state);return packet;
}
export class SyncTracker {
  constructor(state,device){
    this.device=device;this.entries=new Map();this.clock=0;
    if(state.sync?.packet){for(const e of validatePacket(state.sync.packet).entries){this.entries.set(keyOf(e),structuredClone(e));this.clock=Math.max(this.clock,e.clock.time);}}
    if(!state.sync?.packet){const defaults=defaultState().profile;for(const [id,value] of Object.entries(state.profile)){if(equal(value,defaults[id]))this.entries.set('profile:'+id,{group:'profile',id,value,clock:{time:0,device:this.device}});}}
    this.observe(state);
  }
  stamp(){this.clock=Math.max(Date.now(),this.clock+1);return {time:this.clock,device:this.device};}
  observe(state){
    const live=new Set();let changed=false;
    for(const e of records(state)){const key=keyOf(e);live.add(key);const old=this.entries.get(key);if(!old||!equal(old.value,e.value)){this.entries.set(key,{...structuredClone(e),clock:this.stamp()});changed=true;}}
    for(const [key,e] of this.entries){if(!live.has(key)&&e.value!==null){this.entries.set(key,{...e,value:null,clock:this.stamp()});changed=true;}}
    return changed;
  }
  merge(packets){packets.forEach(validatePacket);let changed=false;for(const packet of packets){for(const e of packet.entries){this.clock=Math.max(this.clock,e.clock.time);const old=this.entries.get(keyOf(e));if(!old||compare(e.clock,old.clock)>0){this.entries.set(keyOf(e),structuredClone(e));changed=true;}}}return changed;}
  packet(){return {version:1,entries:[...this.entries.values()].sort((a,b)=>keyOf(a).localeCompare(keyOf(b)))};}
  apply(local){
    const result={...local,profile:{...local.profile},tasks:[],sessions:[],thoughts:[]};
    for(const e of this.entries.values()){if(e.value===null)continue;if(e.group==='profile')result.profile[e.id]=e.value;else result[e.group].push(structuredClone(e.value));}
    result.sessions.sort((a,b)=>a.ended-b.ended||a.id.localeCompare(b.id));result.thoughts.sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id));
    return validateState(result);
  }
}
