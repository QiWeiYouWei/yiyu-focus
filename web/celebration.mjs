import {stats,dayKey} from './core.mjs';
import {motionEnabled,icon} from './ui.mjs';
export function milestone(before,after,goal=60,now=Date.now()){
 const a=stats(before,now),b=stats(after,now);
 if(a.today<goal*60&&b.today>=goal*60)return {key:'goal:'+dayKey(now),text:'今天留给自己的时间，已经做到啦。'};
 for(const days of [3,7,14,30,60,100,200,365])if(a.streak<days&&b.streak>=days)return {key:'streak:'+days,text:'已经连续专注 '+days+' 天。每一次回来，都留下了积累。'};
 for(const hours of [1,10,25,50,100,200,500,1000])if(a.total<hours*3600&&b.total>=hours*3600)return {key:'hours:'+hours,text:'累计专注 '+hours+' 小时。这些时间，属于你。'};
 return null;
}
export function showCelebration(text,mode){
 if(mode==='off')return;const host=document.querySelector('#completion-feedback'),review=document.querySelector('#review-dialog[open]');if(review)review.prepend(host);else document.body.append(host);host.replaceChildren();host.hidden=false;const copy=document.createElement('p');copy.textContent=text;host.append(copy);
 if(motionEnabled()){if(mode==='confetti'){const colors=['#a4d58b','#35834b','#d4b86c','#b2bde5','#dfb8b0'];for(let i=0;i<30;i++){const piece=document.createElement('i');piece.className='completion-confetti';piece.style.setProperty('--x',((i*37)%100)+'%');piece.style.setProperty('--drift',((i%7)-3)*35+'px');piece.style.setProperty('--delay',(i%6)*40+'ms');piece.style.background=colors[i%colors.length];host.append(piece);}}else{const leaf=document.createElement('span');leaf.className='completion-leaf';leaf.innerHTML=icon('leaf');host.append(leaf);}}
 clearTimeout(showCelebration.timer);showCelebration.timer=setTimeout(()=>{host.hidden=true;host.replaceChildren();},3500);
}
