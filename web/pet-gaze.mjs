const step=Math.PI/8;
// Coordinates are screen DIP values, shared with Electron's content bounds.
export function gazeDirection(point,origin,previous=null,deadZone=14){
 if(!point||!origin||![point.x,point.y,origin.x,origin.y].every(Number.isFinite))return null;
 const dx=point.x-origin.x,dy=point.y-origin.y;if(Math.hypot(dx,dy)<deadZone)return null;
 let angle=Math.atan2(dx,-dy);if(angle<0)angle+=Math.PI*2;
 if(Number.isInteger(previous)&&previous>=0&&previous<16){const difference=Math.abs(Math.atan2(Math.sin(angle-previous*step),Math.cos(angle-previous*step)));if(difference<=step/2+.06)return previous;}
 return Math.round(angle/step)%16;
}
export function gazeFrame(direction,mode,{enabled=true,motion=true,reaction=false,recent=true}={}){
 if(!enabled||!motion||reaction||!Number.isInteger(direction)||direction<0||direction>15||!['idle','focus','waiting'].includes(mode)||mode!=='idle'&&!recent)return null;
 return {row:9+Math.floor(direction/8),column:direction%8};
}
