const {contextBridge,ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  load:()=>ipcRenderer.invoke('data:load'),
  save:data=>ipcRenderer.invoke('data:save',data),
  pin:pin=>ipcRenderer.invoke('window:pin',pin),
  notify:text=>ipcRenderer.invoke('notify',text),
  export:data=>ipcRenderer.invoke('backup:export',data),
  syncStatus:()=>ipcRenderer.invoke('sync:status'),
  syncConnect:credentials=>ipcRenderer.invoke('sync:connect',credentials),
  syncDisconnect:()=>ipcRenderer.invoke('sync:disconnect'),
  syncRead:()=>ipcRenderer.invoke('sync:read'),
  syncWrite:data=>ipcRenderer.invoke('sync:write',data),
  onPause:callback=>ipcRenderer.on('system:pause',()=>callback())
});
