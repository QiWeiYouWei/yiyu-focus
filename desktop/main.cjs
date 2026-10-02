const { app, BrowserWindow, ipcMain, Notification, dialog, powerMonitor, safeStorage } = require('electron');
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
    const dataPath = path.join(app.getPath('userData'),'focus-data.json');
    ipcMain.handle('data:load', async()=>{
      try { return validateState(JSON.parse(await fs.readFile(dataPath,'utf8'))); }
      catch(e) { if(e.code==='ENOENT') return null; throw Error('本地数据读取失败。原文件已保留，请先备份后再处理。'); }
    });
    ipcMain.handle('data:save', (_e,data)=>{
      validateState(data);
      const json = JSON.stringify(data);
      const next = writeQueue.catch(()=>{}).then(async()=>{
        await fs.mkdir(path.dirname(dataPath),{recursive:true});
        await fs.writeFile(dataPath+'.tmp',json,'utf8');
        await fs.rename(dataPath+'.tmp',dataPath);
      }); writeQueue=next; return next;
    });
    ipcMain.handle('window:pin',(_e,pin)=>{win.setAlwaysOnTop(!!pin);return win.isAlwaysOnTop();});
    ipcMain.handle('notify',(_e,text)=>{if(Notification.isSupported()) new Notification({title:'一隅 Focus',body:String(text).slice(0,200)}).show();});
    ipcMain.handle('backup:export',async(_e,data)=>{
      validateState(data);
      const result=await dialog.showSaveDialog(win,{defaultPath:`一隅备份-${new Date().toISOString().slice(0,10)}.json`,filters:[{name:'JSON 备份',extensions:['json']}]});
      if(result.canceled) return false;
      await fs.writeFile(result.filePath,JSON.stringify(data,null,2));return true;
    });
    win = new BrowserWindow({width:1280,height:960,minWidth:800,minHeight:650,icon:path.join(__dirname,'../web/icon.png'),backgroundColor:'#f8f9f5',autoHideMenuBar:true,title:'一隅 Focus',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));
    await win.loadFile(path.join(__dirname,'../web/index.html'));
    powerMonitor.on('suspend',()=>win?.webContents.send('system:pause'));
    powerMonitor.on('lock-screen',()=>win?.webContents.send('system:pause'));
    let closing=false;
    win.on('close',e=>{
      if(closing) return;
      e.preventDefault();
      win.webContents.executeJavaScript('window.prepareToClose ? window.prepareToClose() : Promise.resolve()').then(async()=>{await writeQueue;closing=true;win.close();}).catch(()=>dialog.showMessageBox(win,{type:'error',message:'数据尚未保存，请稍后重试关闭。'}));
    });
  }).catch(error=>{diagnostic('startup-error',{message:error.message});dialog.showErrorBox('一隅 Focus 启动失败',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
}
