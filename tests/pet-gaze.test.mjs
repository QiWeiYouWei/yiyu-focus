import {test} from 'node:test';import assert from 'node:assert/strict';
import {gazeDirection,gazeFrame} from '../web/pet-gaze.mjs';
import {createRequire} from 'node:module';const {createPetCursor}=createRequire(import.meta.url)('../desktop/pet-cursor.cjs');
test('all sixteen gaze directions map clockwise from north, including negative desktop coordinates',()=>{
 const origin={x:-600,y:-200};for(let i=0;i<16;i++){const angle=i*Math.PI/8,point={x:origin.x+300*Math.sin(angle),y:origin.y-300*Math.cos(angle)};assert.equal(gazeDirection(point,origin),i);assert.deepEqual(gazeFrame(i,'idle'),{row:9+Math.floor(i/8),column:i%8});}
});
test('dead zone, invalid values and angular hysteresis prevent distracting eye jitter',()=>{
 assert.equal(gazeDirection({x:3,y:5},{x:0,y:0}),null);assert.equal(gazeDirection({x:Infinity,y:0},{x:0,y:0}),null);
 const point=angle=>({x:300*Math.sin(angle),y:-300*Math.cos(angle)}),origin={x:0,y:0};
 assert.equal(gazeDirection(point(Math.PI/16+.03),origin,0),0);assert.equal(gazeDirection(point(Math.PI/16+.08),origin,0),1);
 assert.equal(gazeDirection(point(-.05),origin,0),0);
});
test('gaze respects sleep, reactions and reduced motion; focused glances end after movement stops',()=>{
 for(const mode of ['rest','paused','celebrate'])assert.equal(gazeFrame(4,mode),null);
 for(const options of [{enabled:false},{motion:false},{reaction:true}])assert.equal(gazeFrame(4,'idle',options),null);
 assert.equal(gazeFrame(4,'focus',{recent:false}),null);assert.equal(gazeFrame(4,'waiting',{recent:false}),null);assert.equal(gazeFrame(4,'focus',{recent:true}).column,4);
 assert.ok(gazeFrame(4,'idle',{recent:false}));assert.equal(gazeFrame(16,'idle'),null);
});
test('desktop sampling suppresses unchanged points and stops while hidden or disabled',()=>{
 let active=true,visible=true,point={x:10,y:20},bounds={x:-400,y:20,width:240,height:320},clock=0,callback,schedules=0,clears=0;const sent=[];
 const win={isDestroyed:()=>false,isVisible:()=>visible,getContentBounds:()=>({...bounds}),webContents:{isLoadingMainFrame:()=>false}};
 const tracker=createPetCursor({screen:{getCursorScreenPoint:()=>({...point})},getWindow:()=>win,enabled:()=>active,send:value=>sent.push(value),now:()=>clock,setInterval:fn=>{callback=fn;schedules++;return 1;},clearInterval:()=>clears++});
 tracker.refresh();assert.equal(schedules,1);assert.equal(sent.length,1);clock=1000;tracker.refresh();callback();assert.equal(schedules,1);assert.equal(sent.length,1);assert.equal(tracker.value().movedAt,0,'Timer updates cannot renew a focused glance');
 bounds.x=100;callback();assert.equal(sent.length,2);assert.equal(tracker.value().bounds.x,100);point.x=40;callback();assert.equal(sent.length,3);
 active=false;tracker.refresh();assert.equal(clears,1);assert.equal(tracker.value(),null);assert.equal(sent.at(-1),null);
 active=true;tracker.refresh();visible=false;callback();assert.equal(clears,2);assert.equal(tracker.value(),null);tracker.stop();assert.equal(clears,2);
});
