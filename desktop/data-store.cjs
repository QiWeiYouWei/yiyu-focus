const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
class DataStore{
 constructor(folder,validate){this.folder=folder;this.file=path.join(folder,'focus-data.json');this.backups=path.join(folder,'backups');this.validate=validate;this.queue=Promise.resolve();this.lastBackup=0;this.failed=false;}
 async load(){try{return this.validate(JSON.parse(await fs.readFile(this.file,'utf8')));}catch(e){if(e.code==='ENOENT')return null;this.failed=true;throw Error('本地数据读取失败，原文件已保留。可以从自动备份恢复。');}}
 enqueue(action){const next=this.queue.catch(()=>{}).then(action);this.queue=next;return next;}
 async snapshot(state,reason='自动备份'){
  this.validate(state);await fs.mkdir(this.backups,{recursive:true});const id=Date.now()+'-'+crypto.randomUUID();const paused=structuredClone(state);if(paused.active)paused.active.running=false;
  const backup={format:1,created:Date.now(),reason,data:paused};await fs.writeFile(path.join(this.backups,id+'.json'),JSON.stringify(backup),'utf8');this.lastBackup=Date.now();
  const names=(await fs.readdir(this.backups)).filter(n=>/^\d+-[a-f0-9-]{36}\.json$/.test(n)).sort((a,b)=>b.localeCompare(a));for(const name of names.slice(30))await fs.unlink(path.join(this.backups,name));return id;
 }
 save(state){this.validate(state);const data=structuredClone(state);return this.enqueue(async()=>{if(this.failed)throw Error('原文件尚未恢复，已停止自动写入');await fs.mkdir(this.folder,{recursive:true});if(Date.now()-this.lastBackup>=30*60000){const old=await this.load();await this.snapshot(old||data);}
  await fs.writeFile(this.file+'.tmp',JSON.stringify(data),'utf8');await fs.rename(this.file+'.tmp',this.file);
 });}
 backupNow(state,reason='手动备份'){return this.enqueue(()=>this.snapshot(structuredClone(state),reason));}
 async list(){await this.queue.catch(()=>{});let names;try{names=await fs.readdir(this.backups);}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const rows=[];for(const name of names.filter(n=>/^\d+-[a-f0-9-]{36}\.json$/.test(n)).sort((a,b)=>b.localeCompare(a))){try{const b=JSON.parse(await fs.readFile(path.join(this.backups,name),'utf8'));this.validate(b.data);rows.push({id:name.slice(0,-5),created:b.created,reason:b.reason,sessions:b.data.sessions.length,tasks:b.data.tasks.length});}catch{rows.push({id:name.slice(0,-5),invalid:true});}}return rows;
 }
 async readBackup(id){if(typeof id!=='string'||!/^\d+-[a-f0-9-]{36}$/.test(id))throw Error('备份标识无效');const b=JSON.parse(await fs.readFile(path.join(this.backups,id+'.json'),'utf8'));return this.validate(b.data);}
 restore(state){this.validate(state);const data=structuredClone(state);return this.enqueue(async()=>{await fs.mkdir(this.folder,{recursive:true});
  try{const old=await this.load();if(old)await this.snapshot(old,'恢复前保护');}catch{try{await fs.copyFile(this.file,path.join(this.folder,'focus-data-corrupt-'+Date.now()+'.json'));}catch(e){if(e.code!=='ENOENT')throw e;}}
  await fs.writeFile(this.file+'.tmp',JSON.stringify(data),'utf8');await fs.rename(this.file+'.tmp',this.file);this.failed=false;await this.snapshot(data,'恢复后备份');
 });}
}
module.exports={DataStore};
