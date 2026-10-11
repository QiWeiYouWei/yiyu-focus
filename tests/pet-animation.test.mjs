import {test} from 'node:test';
import assert from 'node:assert/strict';
import {petFrame} from '../web/pet-animation.mjs';
test('timer modes use working, quiet closed eyes, review and idle frames',()=>{
 assert.equal(petFrame('focus',0).row,7);
 assert.notEqual(petFrame('focus',0).column,petFrame('focus',130).column);
 for(const mode of ['rest','paused'])assert.deepEqual(petFrame(mode,2000),{row:0,column:1,mode});
 assert.equal(petFrame('waiting',0).row,8);assert.equal(petFrame('idle',0).row,0);
});
test('one celebration waves, jumps and then returns to the current timer mode',()=>{
 assert.equal(petFrame('rest',0,true,100).row,3);
 assert.equal(petFrame('rest',0,true,1000).row,4);
 assert.equal(petFrame('rest',0,true,4000).mode,'rest');
 assert.equal(petFrame('focus',0,true,4001).mode,'focus');
});
test('reduced motion uses still poses even during completion feedback',()=>{
 assert.deepEqual(petFrame('focus',0,false),petFrame('focus',99999,false));
 assert.deepEqual(petFrame('idle',0,false),petFrame('idle',99999,false));
 assert.equal(petFrame('rest',0,false,1000).column,4);
});
