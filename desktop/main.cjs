const { app, BrowserWindow, ipcMain, Notification, dialog, powerMonitor, safeStorage, globalShortcut, screen, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
let win, writeQueue = Promise.resolve();
if(process.env.YIYU_FOCUS_DATA_DIR) app.setPath('userData',path.resolve(process.env.YIYU_FOCUS_DATA_DIR));
// This text-and-SVG interface does not need hardware acceleration. Software
// rendering avoids the GPU startup failures observed on this Windows machine.
app.disableHardwareAcceleration();
function diagnostic(type,details){
  const folder=app.getPath('userData');
  fs.mkdir(folder,{recursive:true}).then(()=>fs.appendFile(path.join(folder,'startup.log'),JSON.stringify({time:new Date().toISOString(),type,details})+'\n')).catch(()=>{});
}
app.on('child-process-gone',(_event,details)=>diagnostic('child-process-gone',details));
app.on('render-process-gone',(_event,contents,details)=>{
  diagnostic('render-process-gone',details);
  if(details.reason!=='clean-exit')dialog.showMessageBox({type:'error',message:'专注窗口意外中断',detail:'最近保存的记录仍然保留。请重新启动一隅 Focus。'}).catch(()=>{});
});
app.setAppUserModelId('local.yiyu.focus');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{ if(win){win.restore();win.show();win.focus();} });
  app.whenReady().then(async()=>{
    diagnostic('ready',{version:app.getVersion(),hardwareAcceleration:app.isHardwareAccelerationEnabled()});
    const { validateState } = await import('../web/core.mjs');
    const { validatePacket } = await import('../web/sync.mjs');
    await require('./sync-service.cjs').installSync({ipcMain,safeStorage,userData:app.getPath('userData'),validatePacket});
    const store=new (require('./data-store.cjs').DataStore)(app.getPath('userData'),validateState);
    const onlyMain=e=>{if(e.sender!==win?.webContents)throw Error('窗口无权访问');};
    ipcMain.handle('data:load',e=>{onlyMain(e);return store.load();});
    ipcMain.handle('data:save',(e,data)=>{onlyMain(e);return store.save(data);});
    ipcMain.handle('data:restore',(e,data)=>{onlyMain(e);return store.restore(data);});
    ipcMain.handle('backup:list',e=>{onlyMain(e);return store.list();});
    ipcMain.handle('backup:read',(e,id)=>{onlyMain(e);return store.readBackup(id);});
    ipcMain.handle('backup:now',(e,data)=>{onlyMain(e);return store.backupNow(data);});
    ipcMain.handle('material:choose',async e=>{onlyMain(e);const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'学习资料',extensions:['pdf','txt','md','docx','pptx','xlsx','png','jpg','mp4','html']}]});return result.canceled?'':result.filePaths[0];});
    ipcMain.handle('material:open',async(e,location)=>{onlyMain(e);if(typeof location!=='string'||location.length>2000)throw Error('资料位置无效');if(/^https?:\/\//i.test(location)){const url=new URL(location);await shell.openExternal(url.href);return;}if(!path.isAbsolute(location)||!['.pdf','.txt','.md','.docx','.pptx','.xlsx','.png','.jpg','.mp4','.html'].includes(path.extname(location).toLowerCase()))throw Error('请选择支持的学习资料文件或网页地址');if(!(await fs.stat(location)).isFile())throw Error('资料文件不存在');const error=await shell.openPath(location);if(error)throw Error('无法打开资料：'+error);});
    ipcMain.handle('window:pin',(e,pin)=>{onlyMain(e);win.show();win.setAlwaysOnTop(!!pin);return win.isAlwaysOnTop();});
    ipcMain.handle('notify',(_e,text)=>{if(Notification.isSupported()) new Notification({title:'一隅 Focus',body:String(text).slice(0,200)}).show();});
    ipcMain.handle('backup:export',async(_e,data)=>{
      validateState(data);
      const result=await dialog.showSaveDialog(win,{defaultPath:`一隅备份-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'JSON 备份',extensions:['json']}]});
      if(result.canceled) return false;
      await fs.writeFile(result.filePath,JSON.stringify(data,null,2));return true;
    });
    win = new BrowserWindow({width:1280,height:960,minWidth:800,minHeight:650,icon:path.join(__dirname,'../web/icon.png'),backgroundColor:'#f5f5f7',autoHideMenuBar:true,title:'一隅 Focus',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
    const floating=await require('./floating.cjs').installFloating({app,BrowserWindow,ipcMain,globalShortcut,screen,win,userData:app.getPath('userData')});
    await win.loadFile(path.join(__dirname,'../web/index.html'));
    const calendar=await require('./calendar-reminders.cjs').installCalendar({ipcMain,win,userData:app.getPath('userData'),Notification,load:()=>store.load()});
    win.on('closed',()=>{floating.stop();calendar.stop();});
    powerMonitor.on('suspend',()=>win?.webContents.send('system:pause'));
    powerMonitor.on('lock-screen',()=>win?.webContents.send('system:pause'));
    let closing=false;
    win.on('close',e=>{
      if(closing) return;
      e.preventDefault();
      win.webContents.executeJavaScript('window.prepareToClose ? window.prepareToClose() : Promise.resolve()').then(async()=>{await store.queue;if(!store.failed){const latest=await store.load();if(latest)await store.backupNow(latest,'退出时备份');}closing=true;win.close();}).catch(()=>dialog.showMessageBox(win,{type:'error',message:'数据尚未保存，请稍后重试关闭。'}));
    });
  }).catch(error=>{diagnostic('startup-error',{message:error.message});dialog.showErrorBox('一隅 Focus 启动失败',error.message);app.quit();});
  app.on('will-quit',()=>globalShortcut.unregisterAll());
  app.on('window-all-closed',()=>app.quit());
}
