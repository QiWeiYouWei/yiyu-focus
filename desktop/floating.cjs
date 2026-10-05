const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const foreground=require('./window-focus.cjs');
exports.installFloating=async({app,BrowserWindow,ipcMain,globalShortcut,screen,win,userData})=>{
 await foreground.start();
 let mini=null,snapshot={text:'15:00',title:'先在专注空间选择一个小目标',course:'',running:false,active:false,waiting:false},collapsed=false,capturing=false,returnHandle='0',wasVisible=false,stopping=false,opening=false;
 const pending=new Map(),settingsPath=path.join(userData,'desktop-preferences.json');let preferences={capture:'Control+Alt+Space',floating:'Control+Alt+F',quick:'Control+Alt+Q',showOnStart:false};
 try{preferences={...preferences,...JSON.parse(await fs.readFile(settingsPath,'utf8'))};}catch{}
 const secure=w=>{w.webContents.setWindowOpenHandler(()=>({action:'deny'}));w.webContents.on('will-navigate',e=>e.preventDefault());};
 const resize=height=>{mini.setMinimumSize(0,0);mini.setSize(340,height);mini.setMinimumSize(0,0);};
 const send=()=>{if(mini&&!mini.isDestroyed())mini.webContents.send('mini:state',{...snapshot,collapsed,capturing});};
 async function ensure(){if(mini&&!mini.isDestroyed())return;const area=screen.getPrimaryDisplay().workArea;mini=new BrowserWindow({width:340,height:180,x:area.x+area.width-365,y:area.y+45,frame:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,backgroundColor:'#f7faf2',show:false,webPreferences:{preload:path.join(__dirname,'mini-preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});mini.setMinimumSize(0,0);secure(mini);mini.on('close',e=>{if(!stopping){e.preventDefault();if(capturing)closeCapture().then(()=>mini?.hide()).catch(()=>mini?.hide());else mini.hide();}});await mini.loadFile(path.join(__dirname,'../web/mini.html'));send();}
 async function toggle(){await ensure();if(capturing){await closeCapture();mini.hide();return false;}if(mini.isVisible())mini.hide();else mini.showInactive();return mini.isVisible();}
 async function capture(fromMini=false){if(opening||capturing)return;opening=true;try{returnHandle=fromMini?'0':await foreground.current();await ensure();wasVisible=mini.isVisible();capturing=true;resize(265);send();mini.show();mini.focus();}finally{opening=false;}}
 async function closeCapture(){capturing=false;mini&&resize(collapsed?54:snapshot.waiting?215:180);send();if(!wasVisible)mini?.hide();else mini?.blur();await foreground.restore(returnHandle);returnHandle='0';}
 function request(type,text){return new Promise((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('专注窗口暂时没有响应'));},180000);pending.set(id,{resolve,reject,timer});win.webContents.send('desktop:command',{id,type,text});});}
 ipcMain.on('desktop:result',(e,result)=>{if(e.sender!==win.webContents)return;const p=pending.get(result?.id);if(!p)return;clearTimeout(p.timer);pending.delete(result.id);result.ok?p.resolve(result.value):p.reject(Error(result.error||'操作未保存'));});
 ipcMain.on('mini:state',(e,data)=>{if(e.sender!==win.webContents||!data||typeof data.text!=='string'||typeof data.title!=='string'||data.title.length>200)return;snapshot=data;if(mini&&!mini.isDestroyed()&&!capturing&&!collapsed)resize(snapshot.waiting?215:180);send();});
 ipcMain.handle('mini:init',e=>{if(e.sender!==mini?.webContents)throw Error('窗口无权访问');return {...snapshot,collapsed,capturing};});
 ipcMain.handle('mini:action',async(e,{type,text}={})=>{if(e.sender!==mini?.webContents)throw Error('窗口无权访问');
  if(type==='hide'){if(capturing)await closeCapture();mini.hide();return;}
  if(type==='collapse'){if(capturing)return;collapsed=!collapsed;resize(collapsed?54:snapshot.waiting?215:180);send();return;}
  if(type==='capture'){await capture(true);return;}
  if(type==='cancel-capture'){await closeCapture();return;}
  if(type==='save-capture'){if(typeof text!=='string'||text.length>1000)throw Error('念头太长了');await request('capture',text);await closeCapture();return;}
  if(type==='show-main'){win.show();win.focus();return;}
  if(!['toggle','finish','extend','paragraph'].includes(type))throw Error('未知操作');if(type==='finish'){win.show();win.focus();}return await request(type);
 });
 let registrations={};function register(){globalShortcut.unregisterAll();registrations={};for(const key of ['capture','floating','quick']){const accelerator=preferences[key];if(accelerator==='off'){registrations[key]=false;continue;}try{registrations[key]=globalShortcut.register(accelerator,()=>{(key==='capture'?capture():key==='quick'?(win.restore(),win.show(),win.focus(),request('quick')):toggle()).catch(()=>{});});}catch{registrations[key]=false;}}return {...preferences,registrations};}
 const allowed={quick:['Control+Alt+Q','Control+Shift+F10','off'],capture:['Control+Alt+Space','Control+Shift+F8','off'],floating:['Control+Alt+F','Control+Shift+F9','off']};
 ipcMain.handle('desktop:preferences',e=>{if(e.sender!==win.webContents)throw Error('窗口无权访问');return {...preferences,registrations};});
 ipcMain.handle('desktop:preferences-save',async(e,value)=>{if(e.sender!==win.webContents||!value||!allowed.capture.includes(value.capture)||!allowed.floating.includes(value.floating)||(value.quick!==undefined&&!allowed.quick.includes(value.quick))||typeof value.showOnStart!=='boolean')throw Error('快捷键设置无效');preferences={capture:value.capture,floating:value.floating,quick:value.quick||preferences.quick,showOnStart:value.showOnStart};const result=register();await fs.writeFile(settingsPath,JSON.stringify(preferences));return result;});
 ipcMain.handle('desktop:capture',e=>{if(e.sender!==win.webContents)throw Error('窗口无权访问');return capture();});
 ipcMain.handle('desktop:toggle-mini',e=>{if(e.sender!==win.webContents)throw Error('窗口无权访问');return toggle();});
 register();if(preferences.showOnStart)await toggle();
 return {stop(){stopping=true;foreground.stop();globalShortcut.unregisterAll();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('专注窗口已关闭'));}pending.clear();mini?.destroy();},capture,toggle};
};
