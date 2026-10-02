const {XMLParser}=require('fast-xml-parser');
const ORIGIN='https://dav.jianguoyun.com';
const BASE=ORIGIN+'/dav/YiyuFocus/';
const MAX_BYTES=8*1024*1024;
const filename=/^[a-f0-9-]{36}\.json$/i;
const listBody='<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:resourcetype/></d:prop></d:propfind>';
function friendlyStatus(status){return ({401:'坚果云账号或应用密码不正确，请使用第三方应用密码。',403:'坚果云拒绝访问，请检查账号状态与 WebDAV 授权。',404:'同步文件夹暂时不存在，请重新连接。',409:'同步文件夹创建失败，请检查坚果云空间。',412:'云端文件刚刚有变化，请重新同步，避免覆盖。',429:'坚果云请求过于频繁，请稍后再试。',507:'坚果云流量或空间额度不足，请检查免费额度。'})[status]||`云端暂不可用（${status}），本地记录已保留。`;}
function parseListing(xml){
  if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('云端目录响应不符合预期');
  const data=new XMLParser({removeNSPrefix:true,parseTagValue:false,processEntities:true}).parse(xml);
  const response=data?.multistatus?.response;if(!response)throw Error('云端没有返回有效的 WebDAV 目录');
  const files=[];
  for(const item of Array.isArray(response)?response:[response]){
    if(typeof item.href!=='string')continue;
    const url=new URL(item.href,BASE);
    if(url.origin!==ORIGIN||!url.href.startsWith(BASE))continue;
    const name=url.pathname.slice(new URL(BASE).pathname.length);
    if(!filename.test(name))continue;
    const props=Array.isArray(item.propstat)?item.propstat:[item.propstat];
    const ok=props.find(p=>/\s200(?:\s|$)/.test(p?.status||''));if(!ok)continue;
    const etag=ok.prop?.getetag;if(typeof etag!=='string'||!etag)throw Error('云端缺少文件版本标识，已停止同步以避免覆盖');
    files.push({name,etag});
  }
  if(files.length>32)throw Error('同步设备文件超过 32 个，请先整理坚果云中的 YiyuFocus 文件夹');
  return files.sort((a,b)=>a.name.localeCompare(b.name));
}
class Nutstore {
  constructor({username,password},fetcher=fetch){
    if(typeof username!=='string'||!/^[^\s@:]+@[^\s@]+$/.test(username)||username.length>200||typeof password!=='string'||!password||password.length>500)throw Error('请填写坚果云邮箱和应用密码');
    this.username=username.toLowerCase();this.owner='nutstore:'+this.username;
    this.authorization='Basic '+Buffer.from(this.username+':'+password,'utf8').toString('base64');this.fetcher=fetcher;this.cache=new Map();this.versions=new Map();this.listed=false;
  }
  async request(name,method,body,extra={}){
    if(name&&!filename.test(name))throw Error('无效的同步文件名');
    let response;
    try{response=await this.fetcher(BASE+name,{method,headers:{Authorization:this.authorization,...extra},body,redirect:'error',signal:AbortSignal.timeout(15000)});}
    catch{throw Error('暂时连接不到坚果云。记录仍在本机，联网后会重试。');}
    return response;
  }
  async body(response){
    const length=Number(response.headers.get('content-length'));if(length>MAX_BYTES)throw Error('云端文件超过 8 MB 安全读取上限');
    const chunks=[];let total=0;const reader=response.body?.getReader();if(!reader)return '';
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>MAX_BYTES)throw Error('云端文件过大，已停止读取');chunks.push(Buffer.from(value));}}
    finally{await reader.cancel().catch(()=>{});}
    return Buffer.concat(chunks).toString('utf8');
  }
  async connect(){
    const response=await this.request('','MKCOL');if(![201,405].includes(response.status))throw Error(friendlyStatus(response.status));
    await response.body?.cancel();await this.list();
  }
  async list(){
    const response=await this.request('','PROPFIND',listBody,{Depth:'1','Content-Type':'application/xml; charset=utf-8'});
    if(response.status!==207){await response.body?.cancel();throw Error(friendlyStatus(response.status));}
    const files=parseListing(await this.body(response));this.versions=new Map(files.map(f=>[f.name,f.etag]));this.listed=true;return files;
  }
  async read(validatePacket){
    const files=await this.list(),packets=[];
    for(const file of files){
      const cached=this.cache.get(file.name);
      if(cached?.etag===file.etag){packets.push(cached.packet);continue;}
      const response=await this.request(file.name,'GET');if(response.status!==200){await response.body?.cancel();throw Error(friendlyStatus(response.status));}
      let packet;try{packet=JSON.parse(await this.body(response));}catch{throw Error('云端同步文件损坏，已保留本地记录，请检查坚果云历史版本');}
      validatePacket(packet);this.cache.set(file.name,{etag:response.headers.get('etag')||file.etag,packet});packets.push(packet);
    }
    for(const key of this.cache.keys())if(!this.versions.has(key))this.cache.delete(key);
    return structuredClone(packets);
  }
  async write(device,packet,validatePacket){
    validatePacket(packet);if(!this.listed)throw Error('请先读取云端，再提交同步');
    const name=device+'.json';if(!filename.test(name))throw Error('无效设备标识');
    const body=JSON.stringify(packet);if(Buffer.byteLength(body)>MAX_BYTES)throw Error('同步文件超过 8 MB，请先导出备份');
    const previous=this.versions.get(name);
    if(previous&&this.cache.get(name)?.etag===previous&&JSON.stringify(this.cache.get(name).packet)===body)return false;
    const response=await this.request(name,'PUT',body,{'Content-Type':'application/json; charset=utf-8',...(previous?{'If-Match':previous}:{'If-None-Match':'*'})});
    if(![200,201,204].includes(response.status)){await response.body?.cancel();throw Error(friendlyStatus(response.status));}
    const etag=response.headers.get('etag');await response.body?.cancel();
    if(etag){this.versions.set(name,etag);this.cache.set(name,{etag,packet:structuredClone(packet)});}else this.cache.delete(name);
    return true;
  }
}
module.exports={Nutstore,parseListing,BASE};
