// A small, local icon and motion layer. No network assets or animation runtime.
const paths={
  focus:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/>',
  growth:'<rect x="3" y="13" width="4" height="7" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="17" y="3" width="4" height="17" rx="1"/>',
  leaf:'<path d="M19.5 4.5c-8-1-15 1-15 8a6 6 0 0 0 6 6c7 0 10-7 9-14Z"/><path d="M4 21 15 10m-5 5v-4m0 4h4"/>',
  history:'<path d="M4 7a9 9 0 1 1-1 8M4 3v5h5m3-1v5l3 2"/>',
  settings:'<path d="m9.5 4 .5-2h4l.5 2 2 1.2 2-.6 2 3.5-1.5 1.4v2.4l1.5 1.4-2 3.5-2-.6-2 1.2-.5 2h-4l-.5-2-2-1.2-2 .6-2-3.5L5 11.5V9.1L3.5 7.7l2-3.5 2 .6Z" transform="translate(0 1)"/><circle cx="12" cy="11.3" r="3"/>',
  cloud:'<path d="M7 18H6a4 4 0 0 1-1-7.9A7 7 0 0 1 18.5 8a5 5 0 0 1 .5 10h-2m-5-6v9m-3-3 3 3 3-3"/>',
  pin:'<path d="m9 3 9 3-3 4 1 5-5-1-4 3-2-2 3-4-1-5Zm1 11-6 7"/>',
  expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  collapse:'<path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5"/>',
  play:'<path d="m9 5 10 7-10 7Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute:'<path d="m11 4-6 5H2v6h3l6 5Zm5 5 6 6m0-6-6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  refresh:'<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5m-3 9a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',
};
export function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.leaf}</svg>`;}
export function setButton(el,label,name){
  if(el.dataset.label===label&&el.dataset.iconName===name)return;
  el.dataset.label=label;el.dataset.iconName=name;el.innerHTML=icon(name);
  const span=document.createElement('span');span.className='button-label';span.textContent=label;el.append(span);
}
export function setText(el,value){const text=String(value);if(el.textContent!==text)el.textContent=text;}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let motionWanted=true;try{motionWanted=localStorage.getItem('yiyu-motion')!=='off';}catch{}
export const motionEnabled=()=>motionWanted&&!reduced.matches;
export function entrance(el){if(!motionEnabled()||!el)return;el.getAnimations().forEach(a=>a.cancel());el.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});}
export function feedback(el){if(!motionEnabled()||!el)return;el.animate([{backgroundColor:'#e3eed9',transform:'translateY(4px)',opacity:.5},{backgroundColor:'transparent',transform:'translateY(0)',opacity:1}],{duration:380,easing:'ease-out'});}
export function initializeUI(){
  document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
  const toggle=document.querySelector('#motion-toggle');
  function update(){
    document.documentElement.dataset.motion=motionEnabled()?'on':'off';
    toggle.setAttribute('aria-pressed',String(motionEnabled()));toggle.disabled=reduced.matches;
    toggle.textContent=reduced.matches?'已跟随系统关闭':motionEnabled()?'已开启':'已关闭';
    if(!motionEnabled())document.getAnimations().forEach(a=>a.cancel());
  }
  toggle.onclick=()=>{motionWanted=!motionWanted;try{localStorage.setItem('yiyu-motion',motionWanted?'on':'off');}catch{}update();};
  reduced.addEventListener('change',update);update();
  const visibility=()=>document.body.classList.toggle('window-hidden',document.hidden);
  document.addEventListener('visibilitychange',visibility);visibility();
}
