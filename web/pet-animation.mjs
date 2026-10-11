export const FRAME_WIDTH=192,FRAME_HEIGHT=208;
const times={idle:[280,110,110,140,140,320],focus:[120,120,120,120,120,220],waiting:[150,150,150,150,150,280],waving:[140,140,140,280],jumping:[140,140,140,140,280],pet:[200,200,300,250,250,400],tired:[220,220,240,260,300,240,200,300]};
function frame(durations,elapsed){const total=durations.reduce((a,b)=>a+b,0);let left=Math.max(0,elapsed)%total;for(let i=0;i<durations.length;i++){if(left<durations[i])return i;left-=durations[i];}return 0;}
// State comes from the real timer; frame selection stays pure and testable.
export function petFrame(mode,elapsed,motion=true,celebrationElapsed=null){
 if(celebrationElapsed!==null&&celebrationElapsed>=0&&celebrationElapsed<4000){
  const jumping=celebrationElapsed>=700;return {row:jumping?4:3,column:motion?frame(jumping?times.jumping:times.waving,Math.max(0,celebrationElapsed-700)):jumping?4:2,mode:'celebrate'};
 }
 if(mode==='rest'||mode==='paused')return {row:0,column:1,mode};
 if(mode==='focus')return {row:7,column:motion?frame(times.focus,elapsed):0,mode};
 if(mode==='waiting')return {row:8,column:motion?frame(times.waiting,elapsed):0,mode};
 return {row:0,column:motion?frame(times.idle,elapsed):0,mode:'idle'};
}
export function reactionFrame(kind,elapsed,motion=true){
 if(elapsed<0||elapsed>=2400)return null;
 if(kind==='pet')return {row:6,column:motion?frame(times.pet,elapsed):1};
 if(kind==='tired')return {row:5,column:motion?frame(times.tired,elapsed):4};
 if(['encourage','stuck','greeting','goodbye'].includes(kind))return {row:3,column:motion?frame(times.waving,elapsed):2};
 return null;
}
