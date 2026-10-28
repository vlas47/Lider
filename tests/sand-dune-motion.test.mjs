import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotion,terrainHeight,heapAt,heapHeight,START_X,SPEED,ENTRY_X,EXIT_X} from '../demos/motion/sand/motion.js';

const wheels=[{x:-1.48,y:.38,z:-.96,radius:.38},{x:-1.48,y:.38,z:.96,radius:.38},{x:1.43,y:.4,z:-.96,radius:.4},{x:1.43,y:.4,z:.96,radius:.4}];
const motion=createMotion(wheels);
test('four rolling wheels remain on the dune, including the slope and crest',()=>{
  for(let x=-10;x<=10;x+=.25){
    for(let i=0;i<4;i++){
      const w=wheels[i],center=motion.worldPoint(w,i,x),ground=terrainHeight(center.x,center.z);
      assert.ok(Math.abs(center.y-w.radius-ground)<.035,`wheel ${i} at ${x}: contact error ${center.y-w.radius-ground}`);
    }
  }
});
test('rolling distance is continuous and wheel rotation follows travelled arc length',()=>{
  let previous=motion.distanceAt(START_X);
  for(let x=START_X+.1;x<13;x+=.1){const d=motion.distanceAt(x);assert.ok(d>previous);assert.ok(d-previous<.12);previous=d;}
  assert.ok(motion.distanceAt(8)-motion.distanceAt(-8)>16,'dune arc must exceed horizontal distance');
});
test('surface samples detach and reconnect exactly at their respective spatial planes',()=>{
  for(const [point,index]of[[{x:1.8,y:1.1,z:.7},-1],[{x:-1.8,y:.7,z:-.8},-1],[{x:-1.48,y:.76,z:.96},1],[{x:1.43,y:.4,z:-.96},2]]){
    const a=motion.crossing(point,index,ENTRY_X),b=motion.crossing(point,index,EXIT_X);
    assert.ok(b.time>a.time);
    for(const [event,plane]of[[a,ENTRY_X],[b,EXIT_X]]){const p=motion.worldPoint(point,index,START_X+event.time*SPEED);assert.ok(Math.abs(p.x-plane)<.006);assert.ok(Math.abs(p.y-event.y)<.003);}
  }
});
test('the rolling heap grows and recedes continuously with no volume or position jumps',()=>{
  assert.equal(heapAt(-10).amount,0);assert.equal(heapAt(10).amount,0);assert.ok(heapAt(.9).amount>.99);
  let before=heapAt(-8);
  for(let x=-7.99;x<9;x+=.01){const next=heapAt(x);assert.ok(next.amount>=0&&next.amount<=1);assert.ok(Math.abs(next.amount-before.amount)<.01);assert.ok(Math.abs(next.centre-before.centre)<.03);before=next;}
});
test('the heap has a bounded irregular surface and remains inside the transformation area',()=>{
  const heap=heapAt(.8),height=heapHeight(heap.centre,0,heap);
  assert.ok(height>1.5&&height<3.1,'full sand mass must be taller than the car');
  assert.notEqual(heapHeight(heap.centre,.45,heap),heapHeight(heap.centre,-.45,heap));
  assert.equal(heapHeight(ENTRY_X-.1,0,heap),0);assert.equal(heapHeight(EXIT_X+.1,0,heap),0);
  assert.equal(heapHeight(heap.centre,0,heapAt(-10)),0);
});
