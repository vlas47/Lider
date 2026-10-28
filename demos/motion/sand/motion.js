export const START_X=-20;
export const END_X=16;
export const DURATION=28;
export const SPEED=(END_X-START_X)/DURATION;
export const ENTRY_X=-2.3;
export const EXIT_X=3.7;
export const CAR_LENGTH=5.05;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const mix=(a,b,t)=>a+(b-a)*t;

export function depositAt(x){
  return heapAt(x).amount;
}
export function heapAt(x){
  const entered=smooth((x-SPEED*.4+CAR_LENGTH*.5-ENTRY_X)/CAR_LENGTH);
  const reformed=smooth((x+CAR_LENGTH*.5-EXIT_X)/CAR_LENGTH);
  const amount=Math.max(0,entered-reformed),begin=ENTRY_X-.3,end=EXIT_X-CAR_LENGTH*.5-.2;
  const roll=smooth((x-begin)/(end-begin)),centre=mix(ENTRY_X+.8,EXIT_X-.6,roll);
  const flow=roll*7+Math.max(0,x-end)*.65;
  return{amount,centre,phase:flow*1.1,flow,roll};
}
export function heapHeight(x,z,heap){
  if(!heap||heap.amount<.00001)return 0;
  const spread=Math.pow(heap.amount,.21),height=Math.pow(heap.amount,.58),dx=(x-heap.centre)/spread,dz=z/spread,p=heap.phase;
  let h=1.64*Math.exp(-((dx+.24*Math.sin(p))**2/3.7+(dz-.22*Math.cos(p*.8))**2/1.85));
  h+=.79*Math.exp(-((dx-.83-.23*Math.sin(p*.7))**2/1.1+(dz+.63+.19*Math.cos(p))**2/.82));
  h+=.63*Math.exp(-((dx+1.05+.24*Math.cos(p*.8))**2/1.2+(dz-.67-.22*Math.sin(p))**2/1.));
  h*=1+.105*Math.sin(dx*4.1+dz*2.3-p*1.7)*Math.sin(dz*3.7-dx*1.3+p)+.045*Math.sin(dx*9.3-dz*6.1+p*2.4);
  const mask=smooth((x-ENTRY_X)/.55)*(1-smooth((x-(EXIT_X-.55))/.57));
  return h*height*mask;
}
export function terrainHeight(x,z,heap=null){
  const ridge=.8-.018*z*z,dx=x-ridge,width=dx<0?6.8:4.5;
  let h=.07*Math.sin(x*.11+z*.17);
  h+=1.65*Math.exp(-(dx*dx/(width*width)+z*z/110));
  h+=.28*Math.exp(-((x+6.5)**2/90+(z-10)**2/100));
  h+=4.2*Math.exp(-((x+25)**2/220+(z+32)**2/150));
  h+=5.4*Math.exp(-((x-5)**2/260+(z+48)**2/190));
  h+=3.8*Math.exp(-((x-31)**2/240+(z+24)**2/160));
  return h+heapHeight(x,z,heap);
}

export const TERRAIN_GLSL=`
float heapHeight(vec2 p){
 if(uHeap.y<.00001)return 0.;float spread=pow(uHeap.y,.21),height=pow(uHeap.y,.58);float dx=(p.x-uHeap.x)/spread,dz=p.y/spread,phase=uHeap.z;
 float a=dx+.24*sin(phase),b=dz-.22*cos(phase*.8);float h=1.64*exp(-(a*a/3.7+b*b/1.85));
 a=dx-.83-.23*sin(phase*.7);b=dz+.63+.19*cos(phase);h+=.79*exp(-(a*a/1.1+b*b/.82));
 a=dx+1.05+.24*cos(phase*.8);b=dz-.67-.22*sin(phase);h+=.63*exp(-(a*a/1.2+b*b/1.));
 h*=1.+.105*sin(dx*4.1+dz*2.3-phase*1.7)*sin(dz*3.7-dx*1.3+phase)+.045*sin(dx*9.3-dz*6.1+phase*2.4);
 float mask=smoothstep(${ENTRY_X.toFixed(5)},${(ENTRY_X+.55).toFixed(5)},p.x)*(1.-smoothstep(${(EXIT_X-.55).toFixed(5)},${(EXIT_X+.02).toFixed(5)},p.x));return h*height*mask;
}
float duneHeight(vec2 p,float deposit){
 float x=p.x,z=p.y;float ridge=.8-.018*z*z;float dx=x-ridge;float w=dx<0.?6.8:4.5;
 float h=.07*sin(x*.11+z*.17);
 h+=1.65*exp(-(dx*dx/(w*w)+z*z/110.));
 h+=.28*exp(-((x+6.5)*(x+6.5)/90.+(z-10.)*(z-10.)/100.));
 h+=4.2*exp(-((x+25.)*(x+25.)/220.+(z+32.)*(z+32.)/150.));
 h+=5.4*exp(-((x-5.)*(x-5.)/260.+(z+48.)*(z+48.)/190.));
 h+=3.8*exp(-((x-31.)*(x-31.)/240.+(z+24.)*(z+24.)/160.));
 return h+heapHeight(p);
}`;

function rotate(p,pose){
  const y=pose.cr*p.y-pose.sr*p.z,z=pose.sr*p.y+pose.cr*p.z;
  return{x:pose.cp*p.x-pose.sp*y,y:pose.sp*p.x+pose.cp*y,z};
}

export function createMotion(wheels){
  if(wheels.length!==4)throw new Error('Four independent road wheels are required');
  const front=wheels.filter(w=>w.x>0),rear=wheels.filter(w=>w.x<0);
  const positive=wheels.filter(w=>w.z>0),negative=wheels.filter(w=>w.z<0);
  const avg=values=>values.reduce((sum,n)=>sum+n,0)/values.length;
  const wheelbase=avg(front.map(w=>w.x))-avg(rear.map(w=>w.x));
  const track=avg(positive.map(w=>w.z))-avg(negative.map(w=>w.z));
  const arcCount=2048,arcStep=(END_X-START_X+8)/arcCount,arcStart=START_X-4;
  const arc=new Float64Array(arcCount+1);
  for(let i=1;i<=arcCount;i++){const a=arcStart+(i-1)*arcStep,b=a+arcStep;arc[i]=arc[i-1]+Math.hypot(arcStep,terrainHeight(b,0)-terrainHeight(a,0));}
  function distanceAt(x){const q=clamp((x-arcStart)/arcStep,0,arcCount-.00001),i=Math.floor(q);return mix(arc[i],arc[i+1],q-i);}
  const zeroDistance=distanceAt(START_X);
  function poseAt(x){
    const heights=wheels.map(w=>terrainHeight(x+w.x,w.z));
    const wheelHeight=w=>heights[wheels.indexOf(w)];
    const pitch=Math.atan2(avg(front.map(wheelHeight))-avg(rear.map(wheelHeight)),wheelbase);
    const roll=-Math.atan2(avg(positive.map(wheelHeight))-avg(negative.map(wheelHeight)),track);
    const pose={x,y:0,pitch,roll,cp:Math.cos(pitch),sp:Math.sin(pitch),cr:Math.cos(roll),sr:Math.sin(roll),distance:distanceAt(x)-zeroDistance,offsets:[0,0,0,0]};
    const rotated=wheels.map(w=>rotate(w,pose));
    pose.y=avg(wheels.map((w,i)=>terrainHeight(x+rotated[i].x,rotated[i].z)+w.radius-rotated[i].y));
    pose.offsets=wheels.map((w,i)=>clamp((terrainHeight(x+rotated[i].x,rotated[i].z)+w.radius-pose.y-rotated[i].y)/(pose.cp*pose.cr),-.075,.075));
    return pose;
  }
  // Event sampling uses a precomputed terrain-following pose table, not repeated
  // terrain evaluation for every grain's boundary search.
  const tableCount=2048,tableStart=START_X-3,tableStep=(END_X-START_X+6)/tableCount;
  const table=Array.from({length:tableCount+1},(_,i)=>poseAt(tableStart+i*tableStep));
  function sampledPose(x){
    const q=clamp((x-tableStart)/tableStep,0,tableCount-.000001),i=Math.floor(q),t=q-i,a=table[i],b=table[i+1];
    return{x,y:mix(a.y,b.y,t),cp:mix(a.cp,b.cp,t),sp:mix(a.sp,b.sp,t),cr:mix(a.cr,b.cr,t),sr:mix(a.sr,b.sr,t),distance:mix(a.distance,b.distance,t),offsets:a.offsets.map((v,j)=>mix(v,b.offsets[j],t))};
  }
  function worldPoint(point,wheelIndex,x,sampled=false){
    const pose=sampled?sampledPose(x):poseAt(x);let local={...point};
    if(wheelIndex>=0){const w=wheels[wheelIndex],angle=-pose.distance/w.radius,c=Math.cos(angle),s=Math.sin(angle),qx=point.x-w.x,qy=point.y-w.y;local={x:w.x+c*qx-s*qy,y:w.y+s*qx+c*qy+pose.offsets[wheelIndex],z:point.z};}
    const p=rotate(local,pose);return{x:p.x+x,y:p.y+pose.y,z:p.z};
  }
  function sampledPoint(point,wheelIndex,x,out){
    const q=clamp((x-tableStart)/tableStep,0,tableCount-.000001),i=Math.floor(q),t=q-i,a=table[i],b=table[i+1];
    const cp=mix(a.cp,b.cp,t),sp=mix(a.sp,b.sp,t),cr=mix(a.cr,b.cr,t),sr=mix(a.sr,b.sr,t);
    let px=point.x,py=point.y;
    if(wheelIndex>=0){const w=wheels[wheelIndex],angle=-mix(a.distance,b.distance,t)/w.radius,c=Math.cos(angle),s=Math.sin(angle),dx=px-w.x,dy=py-w.y;px=w.x+c*dx-s*dy;py=w.y+s*dx+c*dy+mix(a.offsets[wheelIndex],b.offsets[wheelIndex],t);}
    const ry=cr*py-sr*point.z;out.x=x+cp*px-sp*ry;out.y=mix(a.y,b.y,t)+sp*px+cp*ry;out.z=sr*py+cr*point.z;
    return out;
  }
  function crossing(point,wheelIndex,plane){
    let lo=plane-point.x-1.4,hi=plane-point.x+1.4;const position={},before={},after={};
    for(let i=0;i<11;i++){const mid=(lo+hi)*.5;if(sampledPoint(point,wheelIndex,mid,position).x<plane)lo=mid;else hi=mid;}
    const x=(lo+hi)*.5;sampledPoint(point,wheelIndex,x,position);sampledPoint(point,wheelIndex,x-.012,before);sampledPoint(point,wheelIndex,x+.012,after);
    return{time:(x-START_X)/SPEED,x:plane,y:position.y,z:position.z,vx:(after.x-before.x)/.024*SPEED,vy:(after.y-before.y)/.024*SPEED};
  }
  return{wheels,poseAt,worldPoint,crossing,distanceAt:x=>distanceAt(x)-zeroDistance};
}
