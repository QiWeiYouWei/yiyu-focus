// Sample the desktop cursor rather than relying on pointer events inside the pet.
exports.createPetCursor=({screen,getWindow,enabled,send,now=Date.now,setInterval:repeat=setInterval,clearInterval:clear=clearInterval})=>{
 let timer=null,last=null;
 function available(){const win=getWindow();return enabled()&&win&&!win.isDestroyed()&&win.isVisible()&&!win.webContents.isLoadingMainFrame();}
 function tick(){if(!available()){stop();return;}const win=getWindow(),point=screen.getCursorScreenPoint(),bounds=win.getContentBounds();
  if(last&&point.x===last.point.x&&point.y===last.point.y&&['x','y','width','height'].every(key=>bounds[key]===last.bounds[key]))return;
  last={point,bounds,movedAt:now()};send(last);
 }
 function stop(){if(timer!==null){clear(timer);timer=null;}if(last){last=null;send(null);}}
 return {value:()=>last,refresh(){if(!available()){stop();return;}if(timer===null){tick();timer=repeat(tick,100);}},stop};
};
