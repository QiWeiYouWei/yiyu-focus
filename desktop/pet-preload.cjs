const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{
 init:()=>ipcRenderer.invoke('pet:init'),
 action:action=>ipcRenderer.invoke('pet:action',action),
 onState:callback=>ipcRenderer.on('pet:state',(_event,state)=>callback(state)),
 onCursor:callback=>ipcRenderer.on('pet:cursor',(_event,value)=>callback(value)),
 onEncouragement:callback=>ipcRenderer.on('pet:encouragement',(_event,value)=>callback(value))
});
