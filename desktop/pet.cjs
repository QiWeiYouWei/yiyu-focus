const fs=require('node:fs/promises'),path=require('node:path');
const SCALES=[0.8,1,1.25],MODES=['idle','focus','paused','rest','waiting'];
exports.installPet=async({app,BrowserWindow,ipcMain,screen,win,onlyMain,diagnostic})=>{
 const {lunaLifecycleContext}=await import('../web/luna-companion.mjs');
 const file=path.join(app.getPath('userData'),'pet-preferences.json');
 let preferences={enabled:true,scale:1,clickThrough:false,companionship:'gentle',cursorGaze:true},pet=null,opening=null,stopping=false,moveTimer,queue=Promise.resolve();
 let snapshot={mode:'idle',title:'',text:'',motion:true},celebration=null,lifecycle=null,farewellPending=null;
 function dismissFarewell(){if(!farewellPending)return;clearTimeout(farewellPending.timer);pet?.webContents.removeListener('render-process-gone',dismissFarewell);const resolve=farewellPending.resolve;farewellPending=null;resolve();}
 const seen=new Set();
 try{const saved=JSON.parse(await fs.readFile(file,'utf8'));for(const key of ['enabled','clickThrough','cursorGaze'])if(typeof saved[key]==='boolean')preferences[key]=saved[key];if(SCALES.includes(saved.scale))preferences.scale=saved.scale;if(['gentle','quiet'].includes(saved.companionship))preferences.companionship=saved.companionship;if(Number.isSafeInteger(saved.position?.x)&&Number.isSafeInteger(saved.position?.y))preferences.position=saved.position;}catch(error){if(error.code!=='ENOENT')diagnostic('pet-preferences-error',{message:error.message});}
 const save=()=>{const bytes=JSON.stringify(preferences);queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',bytes);await fs.rename(file+'.tmp',file);});return queue;};
 const view=()=>({preferences:{...preferences},state:{...snapshot},cursor:cursor.value(),celebration:celebration&&{id:celebration.id,remaining:Math.max(0,Math.min(4000,celebration.until-Date.now()))},lifecycle:lifecycle&&{...lifecycle,remaining:Math.max(0,lifecycle.until-Date.now())}});
 const cursor=require('./pet-cursor.cjs').createPetCursor({screen,getWindow:()=>pet,enabled:()=>preferences.enabled&&preferences.cursorGaze&&snapshot.motion&&!stopping&&!farewellPending&&['idle','focus','waiting'].includes(snapshot.mode),send:value=>{if(pet&&!pet.isDestroyed()&&!pet.webContents.isLoadingMainFrame())pet.webContents.send('pet:cursor',value);}});
 function send(){if(pet&&!pet.isDestroyed()&&!pet.webContents.isLoadingMainFrame())pet.webContents.send('pet:state',view());}
 function notifyPreferences(){if(!win.isDestroyed()&&!win.webContents.isLoadingMainFrame())win.webContents.send('pet:preferences-changed',{...preferences});}
 function bounds(reset=false){
  const width=Math.round(240*preferences.scale),height=Math.round(320*preferences.scale);
  const area=screen.getPrimaryDisplay().workArea;
  const point=!reset&&preferences.position?preferences.position:{x:area.x+area.width-width-24,y:area.y+area.height-height-24};
  const display=screen.getDisplayNearestPoint(point).workArea;
  return {x:Math.max(display.x,Math.min(point.x,display.x+Math.max(0,display.width-width))),y:Math.max(display.y,Math.min(point.y,display.y+Math.max(0,display.height-height))),width,height};
 }
 function move(){if(stopping||!pet||pet.isDestroyed())return;clearTimeout(moveTimer);moveTimer=setTimeout(()=>{if(!pet||pet.isDestroyed())return;const b=pet.getBounds();preferences.position={x:b.x,y:b.y};save().catch(error=>diagnostic('pet-position-error',{message:error.message}));},250);}
 async function ensure(){
  if(pet&&!pet.isDestroyed())return;if(opening)return opening;
  opening=(async()=>{
   pet=new BrowserWindow({...bounds(),frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,maximizable:false,minimizable:false,alwaysOnTop:true,skipTaskbar:true,focusable:false,show:false,title:'Luna · 一隅陪伴',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'pet-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
   pet.webContents.setWindowOpenHandler(()=>({action:'deny'}));pet.webContents.on('will-navigate',e=>e.preventDefault());pet.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
   pet.on('move',move);pet.on('close',event=>{if(!stopping){event.preventDefault();update({...preferences,enabled:false}).catch(error=>diagnostic('pet-hide-error',{message:error.message}));}});
   await pet.loadFile(path.join(__dirname,'../web/pet.html'));
   if(stopping)return;pet.setBounds(bounds());pet.setIgnoreMouseEvents(preferences.clickThrough,{forward:true});send();if(preferences.enabled){pet.showInactive();pet.setAlwaysOnTop(true,'pop-up-menu');}cursor.refresh();
  })();try{await opening;}finally{opening=null;}
 }
 async function update(value){
  if(!value||typeof value.enabled!=='boolean'||typeof value.clickThrough!=='boolean'||!SCALES.includes(value.scale)||value.companionship!==undefined&&!['gentle','quiet'].includes(value.companionship)||value.cursorGaze!==undefined&&typeof value.cursorGaze!=='boolean')throw Error('桌宠设置无效');
  const previous=preferences;preferences={...preferences,enabled:value.enabled,scale:value.scale,clickThrough:value.clickThrough,companionship:value.companionship||preferences.companionship,cursorGaze:value.cursorGaze??preferences.cursorGaze};
  try{await save();}catch(error){preferences=previous;throw error;}
  if(preferences.enabled){await ensure();pet.setBounds(bounds());pet.setIgnoreMouseEvents(preferences.clickThrough,{forward:true});pet.showInactive();}else{pet?.hide();dismissFarewell();}cursor.refresh();send();notifyPreferences();return {...preferences};
 }
 const onlyPet=event=>{if(event.sender!==pet?.webContents)throw Error('窗口无权访问');};
 ipcMain.handle('pet:preferences',event=>{onlyMain(event);return {...preferences};});
 ipcMain.handle('pet:preferences-save',(event,value)=>{onlyMain(event);return update(value);});
 ipcMain.handle('pet:reset',async event=>{onlyMain(event);preferences.position=undefined;pet?.setBounds(bounds(true));await save();return {...preferences};});
 ipcMain.handle('pet:init',event=>{onlyPet(event);return view();});
 ipcMain.handle('pet:action',async(event,action)=>{onlyPet(event);if(action==='finish-goodbye'){dismissFarewell();return;}if(farewellPending)return;if(action==='toggle-gaze')return update({...preferences,cursorGaze:!preferences.cursorGaze});if(action==='show-main'){win.restore();win.show();win.focus();return;}if(action==='hide')return update({...preferences,enabled:false});throw Error('未知桌宠操作');});
 ipcMain.on('pet:publish',(event,value)=>{
  if(lifecycle?.kind==='goodbye')return;
  if(event.sender!==win.webContents||!value||!MODES.includes(value.mode)||typeof value.title!=='string'||value.title.length>200||typeof value.text!=='string'||value.text.length>30||typeof value.motion!=='boolean')return;
  if(value.mode==='focus'&&snapshot.mode!=='focus')celebration=null;
  const context={};for(const key of ['name','course'])if(typeof value.context?.[key]==='string'&&value.context[key].length<=200)context[key]=value.context[key];
  for(const key of ['todaySeconds','streak','lastSeconds'])if(Number.isSafeInteger(value.context?.[key])&&value.context[key]>=0&&value.context[key]<=1e9)context[key]=value.context[key];
  if(typeof value.context?.completed==='boolean')context.completed=value.context.completed;
  snapshot={mode:value.mode,title:value.title,text:value.text,motion:value.motion,context};cursor.refresh();send();
 });
 ipcMain.on('pet:encourage',(event,value)=>{
  if(event.sender!==win.webContents||value?.kind!=='returned'||typeof value.id!=='string'||value.id.length>100||!preferences.enabled)return;
  pet?.webContents.send('pet:encouragement',{kind:'returned',id:value.id});
 });
 ipcMain.on('pet:celebrate',(event,id)=>{
  if(event.sender!==win.webContents||typeof id!=='string'||id.length>100||seen.has(id))return;
  seen.add(id);if(seen.size>100)seen.delete(seen.values().next().value);
  // Hidden pets do not replay a stale celebration when they are enabled later.
  if(preferences.enabled){celebration={id,until:Date.now()+4000};send();}
 });
 function reflow(){if(!pet||pet.isDestroyed())return;const b=bounds();pet.setBounds(b);preferences.position={x:b.x,y:b.y};save().catch(error=>diagnostic('pet-position-error',{message:error.message}));}
 screen.on('display-removed',reflow);screen.on('display-metrics-changed',reflow);
 return {
  async start(state){if(preferences.enabled){lifecycle={kind:'greeting',id:'open:'+Date.now(),context:lunaLifecycleContext(state),variant:Math.floor(Date.now()/1000)%3,until:Date.now()+11000};await ensure();send();}},
  dismissFarewell,
  async farewell(state){
   if(stopping||!preferences.enabled||preferences.companionship==='quiet'||!pet||pet.isDestroyed()||!pet.isVisible()||pet.webContents.isCrashed()||pet.webContents.isLoadingMainFrame())return;
   // The optional skip button must also work when ordinary companionship uses click-through.
   pet.setIgnoreMouseEvents(false);
   celebration=null;lifecycle={kind:'goodbye',id:'close:'+Date.now(),context:lunaLifecycleContext(state),variant:Math.floor(Date.now()/1000)%2,until:Date.now()+3000};
   await new Promise(resolve=>{farewellPending={resolve,timer:setTimeout(dismissFarewell,3000)};cursor.stop();pet.webContents.once('render-process-gone',dismissFarewell);send();});
  },
  async stop(){if(stopping)return queue;stopping=true;cursor.stop();dismissFarewell();clearTimeout(moveTimer);if(pet&&!pet.isDestroyed()){const b=pet.getBounds();preferences.position={x:b.x,y:b.y};pet.destroy();}screen.removeListener('display-removed',reflow);screen.removeListener('display-metrics-changed',reflow);await save();}
 };
};
