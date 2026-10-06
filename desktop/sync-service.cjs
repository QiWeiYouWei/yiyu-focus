const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {Nutstore}=require('./webdav.cjs');
exports.installSync=async({ipcMain,safeStorage,userData,validatePacket,validateRelay,relayTransition,onlyMain})=>{
  const credentialsPath=path.join(userData,'sync-credentials.enc'),devicePath=path.join(userData,'sync-device-id');
  await fs.mkdir(userData,{recursive:true});let device;
  try{device=(await fs.readFile(devicePath,'utf8')).trim();if(!/^[a-f0-9-]{36}$/.test(device))throw Error('bad device');}
  catch(e){if(e.code!=='ENOENT')throw Error('同步设备标识读取失败，请保留数据目录后检查');device=crypto.randomUUID();await fs.writeFile(devicePath,device,{flag:'wx'});}
  let client=null,startupError='',busy=false;
  try{const encrypted=await fs.readFile(credentialsPath);if(!safeStorage.isEncryptionAvailable())throw Error('系统凭证保护不可用，请重新连接');client=new Nutstore(JSON.parse(safeStorage.decryptString(encrypted)));}
  catch(e){if(e.code!=='ENOENT')startupError='保存的云端授权无法读取，请重新填写应用密码。本地记录未受影响。';}
  const status=()=>({device,connected:!!client,username:client?.username||'',owner:client?.owner||null,error:startupError});
  ipcMain.handle('sync:status',()=>status());
  ipcMain.handle('sync:connect',async(_event,credentials)=>{
    if(busy)throw Error('正在同步，请稍后连接');busy=true;
    try{if(!safeStorage.isEncryptionAvailable())throw Error('Windows 凭证保护暂不可用，未保存应用密码');
      const next=new Nutstore(credentials);await next.connect();
      const encrypted=safeStorage.encryptString(JSON.stringify({username:next.username,password:credentials.password}));
      await fs.writeFile(credentialsPath+'.tmp',encrypted);await fs.rename(credentialsPath+'.tmp',credentialsPath);client=next;startupError='';return status();
    }finally{busy=false;}
  });
  ipcMain.handle('sync:disconnect',async()=>{if(busy)throw Error('正在同步，请稍后断开');await fs.rm(credentialsPath,{force:true});client=null;startupError='';return status();});
  ipcMain.handle('sync:relay-read',async(event)=>{onlyMain(event);if(!client)throw Error('请先连接坚果云');if(busy)throw Error('正在同步，请稍后重试');busy=true;try{return await client.relayRead(validateRelay);}finally{busy=false;}});
  ipcMain.handle('sync:relay-write',async(event,value)=>{onlyMain(event);if(!client||value.owner!==client.owner)throw Error('接力账号已变化');if(busy)throw Error('正在同步，请稍后重试');busy=true;try{return await client.relayWrite(device,value,validateRelay,relayTransition);}finally{busy=false;}});
  ipcMain.handle('sync:read',async()=>{if(!client)throw Error('请先连接坚果云');if(busy)throw Error('正在同步，请稍后重试');busy=true;try{return {owner:client.owner,packets:await client.read(validatePacket)};}finally{busy=false;}});
  ipcMain.handle('sync:write',async(_event,{owner,packet})=>{if(!client||client.owner!==owner)throw Error('同步账号发生变化，已停止上传');if(busy)throw Error('正在同步，请稍后重试');busy=true;try{return await client.write(device,packet,validatePacket);}finally{busy=false;}});
};
