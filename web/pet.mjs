import {petFrame,reactionFrame,FRAME_WIDTH,FRAME_HEIGHT} from './pet-animation.mjs';
import {createLunaCompanion} from './luna-companion.mjs';
import {gazeDirection,gazeFrame} from './pet-gaze.mjs';
const canvas=document.querySelector('#pet-canvas'),ctx=canvas.getContext('2d'),sheet=new Image(),status=document.querySelector('#pet-status'),timer=document.querySelector('#pet-timer');
let payload={state:{mode:'idle',motion:true},preferences:{enabled:true}},started=performance.now(),painted='',animationTimer,celebrating=null,reaction=null,initialized=false,lastLifecycle='',departing=false;
const companion=createLunaCompanion(),menu=document.querySelector('#pet-chat-menu');
const context=()=>({...payload.state.context,title:payload.state.title});
const quiet=()=>payload.preferences.companionship==='quiet';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let cursorState=null,lastGazeDirection=null;
function receive(next){
 const previous=payload.state.mode,changed=next.state.mode!==previous;
 if(changed){started=performance.now();if(!(companion.read()?.kind==='greeting'&&next.state.mode==='paused'))companion.clearAutomatic();reaction=null;}
 const newCelebration=next.celebration&&next.celebration.remaining>0&&next.celebration.id!==celebrating?.id;
 if(!next.celebration||next.celebration.remaining<=0)celebrating=null;else if(newCelebration)celebrating={id:next.celebration.id,started:performance.now(),duration:next.celebration.remaining};
 payload=next;
 cursorState=next.cursor||null;
 const gazeButton=document.querySelector('#pet-gaze');gazeButton.setAttribute('aria-pressed',String(next.preferences.cursorGaze!==false));gazeButton.title='光标注视：'+(next.preferences.cursorGaze!==false?'已开启，点击关闭':'已关闭，点击开启');gazeButton.setAttribute('aria-label',gazeButton.title);
 if(!initialized)initialized=true;
 else if(changed&&next.state.mode!=='idle'&&!(companion.read()?.kind==='greeting'&&next.state.mode==='paused')&&!departing){const kind=next.state.mode==='focus'?(previous==='paused'?'resume':'start'):next.state.mode;companion.respond(kind,context(),{quiet:quiet()});}
 if(newCelebration)companion.respond('completion',context(),{key:'completion:'+next.celebration.id,quiet:quiet()});
 if(next.lifecycle?.remaining>0&&next.lifecycle.id!==lastLifecycle){
  lastLifecycle=next.lifecycle.id;
  if(companion.respond(next.lifecycle.kind,next.lifecycle.context,{key:lastLifecycle,quiet:quiet(),variant:next.lifecycle.variant})){reaction={kind:next.lifecycle.kind,started:performance.now()};}
  if(next.lifecycle.kind==='goodbye'){departing=true;menu.hidden=true;document.querySelector('#pet-chat').setAttribute('aria-expanded','false');document.querySelector('#pet-goodbye').hidden=false;document.querySelectorAll('#pet-home,#pet-chat,#pet-gaze,#pet-hide,#pet-touch').forEach(button=>button.disabled=true);}
 }
 painted='';paint();schedule();
}
function paint(){
 const motion=payload.state.motion&&!reduced.matches;
 const elapsed=celebrating&&performance.now()-celebrating.started<celebrating.duration?4000-celebrating.duration+performance.now()-celebrating.started:null;
 const chosen=petFrame(payload.state.mode,performance.now()-started,motion,quiet()?null:elapsed);
 const pose=reaction&&reactionFrame(reaction.kind,performance.now()-reaction.started,motion);
 if(pose){chosen.row=pose.row;chosen.column=pose.column;}else reaction=null;
 const r=canvas.getBoundingClientRect(),origin=cursorState&&{x:cursorState.bounds.x+r.left+r.width*.5,y:cursorState.bounds.y+r.top+r.height*.3};
 const direction=gazeDirection(cursorState?.point,origin,lastGazeDirection,Math.max(14,r.width*.08));
 lastGazeDirection=direction;
 const gaze=gazeFrame(direction,chosen.mode,{enabled:payload.preferences.cursorGaze!==false,motion,reaction:!!pose||departing||chosen.mode==='idle'&&[1,4].includes(chosen.column),recent:cursorState&&Date.now()-cursorState.movedAt<1400});
 if(gaze){chosen.row=gaze.row;chosen.column=gaze.column;}
 canvas.dataset.gaze=gaze?String(direction):'';
 document.body.dataset.mode=chosen.mode;document.body.dataset.motion=motion?'on':'off';canvas.dataset.row=String(chosen.row);canvas.dataset.frame=String(chosen.column);
 const captions={idle:'陪你，从一小步开始',focus:'我在这里，陪你专注',paused:'慢一点，准备好再继续',rest:'一起休息，充充电',waiting:'读完这一段，再收尾',celebrate:'这一段，认真度过了！'};
 const reply=companion.read(quiet()),text=reply?.text||captions[chosen.mode];
 if(status.textContent!==text)status.textContent=text;
 document.body.dataset.response=reply?.kind||'';document.body.dataset.reaction=reaction?.kind||'';
 canvas.setAttribute('aria-label','Luna · '+text);timer.textContent=!departing&&['focus','rest','paused'].includes(chosen.mode)?payload.state.text||'':'';
 const dpr=devicePixelRatio||1,width=Math.round(r.width*dpr),height=Math.round(r.height*dpr),key=[chosen.row,chosen.column,width,height].join(':');
 if(!sheet.complete||!sheet.naturalWidth||painted===key)return;
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(sheet,chosen.column*FRAME_WIDTH,chosen.row*FRAME_HEIGHT,FRAME_WIDTH,FRAME_HEIGHT,0,0,canvas.width,canvas.height);painted=key;
}
function schedule(){clearTimeout(animationTimer);if(!payload.preferences.enabled)return;animationTimer=setTimeout(()=>{paint();schedule();},payload.state.motion&&!reduced.matches?70:400);}
sheet.onload=()=>{if(sheet.naturalWidth!==1536||sheet.naturalHeight!==2288){document.querySelector('#pet-error').hidden=false;return;}painted='';paint();};
sheet.onerror=()=>{document.querySelector('#pet-error').hidden=false;};sheet.src='pets/luna/spritesheet.png';
window.companion.onState(receive);window.companion.init().then(receive).catch(()=>{status.textContent='陪伴暂时未连接';});
window.companion.onCursor(value=>{cursorState=value;paint();});
document.querySelector('#pet-gaze').onclick=async()=>{const button=document.querySelector('#pet-gaze');button.disabled=true;try{await window.companion.action('toggle-gaze');}catch(error){button.title='注视设置未保存：'+error.message;}finally{if(!departing)button.disabled=false;}};
window.companion.onEncouragement(value=>{if(value.kind==='returned'&&!departing){companion.respond('returned',context(),{key:'returned:'+value.id,quiet:quiet()});paint();}});
function interact(kind){if(companion.respond(kind,context(),{manual:true})){reaction={kind,started:performance.now()};painted='';paint();}menu.hidden=true;document.querySelector('#pet-chat').setAttribute('aria-expanded','false');}
document.querySelector('#pet-touch').onclick=()=>interact('pet');
document.querySelector('#pet-goodbye-skip').onclick=()=>window.companion.action('finish-goodbye').catch(()=>{});
document.querySelector('#pet-chat').onclick=()=>{menu.hidden=!menu.hidden;document.querySelector('#pet-chat').setAttribute('aria-expanded',String(!menu.hidden));};
document.querySelectorAll('[data-luna-reply]').forEach(button=>button.onclick=()=>interact(button.dataset.lunaReply));
document.querySelector('#pet-chat-close').onclick=()=>{menu.hidden=true;document.querySelector('#pet-chat').setAttribute('aria-expanded','false');};
document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.hidden=true;document.querySelector('#pet-chat').setAttribute('aria-expanded','false');}});
document.querySelector('#pet-home').onclick=()=>window.companion.action('show-main');document.querySelector('#pet-hide').onclick=()=>window.companion.action('hide');
new ResizeObserver(()=>{painted='';paint();}).observe(canvas);reduced.addEventListener('change',()=>{painted='';paint();schedule();});
