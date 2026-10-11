const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),assets=path.join(root,'android/app/src/main/assets'),target=path.join(assets,'web');
 // Rebuild generated assets so desktop pet files cannot remain in Android.
 if(path.dirname(target)!==assets||path.basename(target)!=='web')throw Error('Invalid Android assets path');
 await fs.rm(target,{recursive:true,force:true});await fs.mkdir(target,{recursive:true});
 for(const name of await fs.readdir(path.join(root,'web'))){
  if(!/\.(html|css|mjs|svg|png)$/.test(name)||name.startsWith('mini.')||name.startsWith('pet')||name==='luna-companion.mjs')continue;
  await fs.copyFile(path.join(root,'web',name),path.join(target,name));
 }
 // Shared calls use this adapter; Android has no desktop companion APIs/assets.
 await fs.writeFile(path.join(target,'pet-ui.mjs'),`export function setupPetUI(){
  for(const id of ['pet-settings','show-pet'])document.getElementById(id)?.remove();
  return {load(){},publish(){},encourage(){},celebrate(){}};
 }\n`);
 console.log('Android assets copied; shared SVG icons unchanged; desktop pet omitted.');
})().catch(e=>{console.error(e);process.exitCode=1;});
