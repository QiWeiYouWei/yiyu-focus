const {spawn}=require('node:child_process'),path=require('node:path');
let child,ready,buffer='',pending=[];
function start(){if(ready)return ready;ready=new Promise(resolve=>{
 if(process.platform!=='win32'){resolve(false);return;}
 const script=path.join(__dirname,'window-focus.ps1').replace('app.asar'+path.sep,'app.asar.unpacked'+path.sep);
 child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{windowsHide:true,stdio:['pipe','pipe','ignore']});
 let settled=false;const finish=value=>{if(!settled){settled=true;clearTimeout(timer);resolve(value);}};
 const timer=setTimeout(()=>{finish(false);child?.kill();},8000);
 child.stdout.on('data',chunk=>{buffer+=chunk.toString();let index;while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);if(line==='READY')finish(true);else pending.shift()?.(line);}});
 child.on('error',()=>finish(false));child.on('exit',()=>{finish(false);for(const done of pending.splice(0))done('');child=null;});
});return ready;}
async function run(command){if(!await start()||!child)return '';return new Promise(resolve=>{const done=value=>{clearTimeout(timer);resolve(value);};const timer=setTimeout(()=>{const index=pending.indexOf(done);if(index>=0)pending[index]=()=>{};resolve('');},3000);pending.push(done);child.stdin.write(command+'\n',error=>{if(error)done('');});});}
exports.start=start;
exports.current=async()=>{const value=await run('get');return /^\d+$/.test(value)?value:'0';};
exports.restore=async handle=>{if(/^\d+$/.test(String(handle))&&String(handle)!=='0')return await run('restore '+handle)==='True';return false;};
exports.stop=()=>{child?.kill();child=null;};
