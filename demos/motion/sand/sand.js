import {THREE} from './vendor/scene.min.js';
import {loadVehicle,sampleVehicle} from './vehicle.js';
import {START_X,END_X,DURATION,SPEED,ENTRY_X,EXIT_X,clamp,terrainHeight,depositAt,heapAt,createMotion,TERRAIN_GLSL} from './motion.js';

const canvas=document.querySelector('#scene'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,vehicle,motion,falling,rising,heapGrains,vortices,terrain,gateUniforms;
let elapsed=8.5,playing=!reduced.matches,last=performance.now(),lastDraw=0,ready=false,dirty=true;
let yaw=0,yawTarget=0,elevation=0,elevationTarget=0,drag=null,zoom=1;
let seed=29187;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
const shared={uHeap:{value:new THREE.Vector4(ENTRY_X+.8,0,0,0)},uDeposit:{value:0},uTime:{value:elapsed},uDistance:{value:0},uOffsets:{value:new THREE.Vector4()},uCarMatrix:{value:new THREE.Matrix4()},uPixel:{value:1}};
const portalHeader=`varying vec3 vPortalWorld;const float ENTRY=${ENTRY_X.toFixed(5)},EXIT=${EXIT_X.toFixed(5)};`;
function decorate(material,depth=false){
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vPortalWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPortalWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=portalHeader+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(vPortalWorld.x>ENTRY&&vPortalWorld.x<EXIT)discard;');
    if(!depth)shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat portalEdge=exp(-abs(vPortalWorld.x-ENTRY)*72.)+exp(-abs(vPortalWorld.x-EXIT)*72.);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.62,.38,.14),min(portalEdge*.55,.65));');
  };
  material.customProgramCacheKey=()=>`dune-portal-${depth?'depth':'surface'}-3`;
}

const skyVertex=`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFragment=`varying vec3 vDirection;void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 horizon=vec3(.65,.58,.46),zenith=vec3(.29,.43,.50);vec3 color=mix(horizon,zenith,smoothstep(0.,.8,h));vec3 sun=normalize(vec3(-.5,.52,-.32));color+=vec3(1.,.82,.55)*pow(max(dot(d,sun),0.),26.)*.55;color+=vec3(2.8,2.4,1.7)*smoothstep(.9993,.9998,dot(d,sun));gl_FragColor=vec4(color,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function skyMaterial(){return new THREE.ShaderMaterial({vertexShader:skyVertex,fragmentShader:skyFragment,side:THREE.BackSide,depthWrite:false});}
function makeEnvironment(){
  const room=new THREE.Scene();room.background=new THREE.Color(0xb8c4c7);
  const dome=new THREE.Mesh(new THREE.SphereGeometry(80,32,16),skyMaterial());room.add(dome);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshBasicMaterial({color:0xb7a17d,side:THREE.DoubleSide}));ground.rotation.x=-Math.PI/2;ground.position.y=-2;room.add(ground);
  const generator=new THREE.PMREMGenerator(renderer),target=generator.fromScene(room,.04);generator.dispose();dome.geometry.dispose();dome.material.dispose();ground.geometry.dispose();ground.material.dispose();return target.texture;
}
function makeSandTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),pixels=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4,n=random(),ripple=Math.sin(y*.22+Math.sin(x*.025)*1.7)*5;pixels.data[i]=181+n*30+ripple;pixels.data[i+1]=170+n*28+ripple;pixels.data[i+2]=149+n*26+ripple;pixels.data[i+3]=255;}
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(85,85);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return texture;
}
function makeTerrain(){
  const divisions=innerWidth<701?180:300,geometry=new THREE.PlaneGeometry(190,190,divisions,divisions);geometry.rotateX(-Math.PI/2);
  const position=geometry.attributes.position,uv=geometry.attributes.uv,warp=Math.sinh(4);
  for(let i=0;i<position.count;i++){const x=Math.sinh(position.getX(i)/95*4)/warp*95,z=Math.sinh(position.getZ(i)/95*4)/warp*95;position.setXYZ(i,x,terrainHeight(x,z),z);uv.setXY(i,x/190+.5,z/190+.5);}
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const texture=makeSandTexture(),material=new THREE.MeshStandardMaterial({color:0xd2c9b8,map:texture,bumpMap:texture,bumpScale:.045,roughness:.98});
  material.onBeforeCompile=shader=>{
    shader.uniforms.uDeposit=shared.uDeposit;shader.uniforms.uHeap=shared.uHeap;shader.vertexShader='uniform float uDeposit;uniform vec4 uHeap;\n'+TERRAIN_GLSL+'\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\nfloat e=.04;float hx=(heapHeight(position.xz+vec2(e,0.))-heapHeight(position.xz-vec2(e,0.)))/(2.*e);float hz=(heapHeight(position.xz+vec2(0.,e))-heapHeight(position.xz-vec2(0.,e)))/(2.*e);objectNormal=normalize(vec3(objectNormal.x-hx*objectNormal.y,objectNormal.y,objectNormal.z-hz*objectNormal.y));`);
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=heapHeight(position.xz);');
  };
  material.customProgramCacheKey=()=> 'dune-ground-4';terrain=new THREE.Mesh(geometry,material);terrain.receiveShadow=true;terrain.castShadow=true;terrain.frustumCulled=false;
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});depth.onBeforeCompile=shader=>{shader.uniforms.uHeap=shared.uHeap;shader.vertexShader='uniform vec4 uHeap;\n'+TERRAIN_GLSL+'\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=heapHeight(position.xz);');};depth.customProgramCacheKey=()=> 'dune-depth-4';terrain.customDepthMaterial=depth;scene.add(terrain);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(145,48,24),skyMaterial());sky.frustumCulled=false;scene.add(sky);
}
function makeTracks(){
  const vertices=[];for(const z of[-.96,.96])for(let x=START_X-2;x<END_X+2;x+=.16){const left=z-.1,right=z+.1,next=x+.14;vertices.push(x,0,left,next,0,left,x,0,right,x,0,right,next,0,left,next,0,right);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uHeap:shared.uHeap,uDeposit:shared.uDeposit,uCarX:{value:START_X}},vertexShader:`uniform float uDeposit;uniform vec4 uHeap;varying vec3 vWorld;${TERRAIN_GLSL}void main(){vec3 p=position;p.y=duneHeight(p.xz,uDeposit)+.008;vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform float uCarX;varying vec3 vWorld;void main(){if(vWorld.x>uCarX+1.45||(vWorld.x>${ENTRY_X.toFixed(4)}&&vWorld.x<${EXIT_X.toFixed(4)}))discard;float groove=.6+.4*sin(vWorld.x*96.+vWorld.z*14.);gl_FragColor=vec4(.23,.16,.075,.11*groove);}`});
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);return material.uniforms.uCarX;
}
function makeGate(){
  gateUniforms={uTime:shared.uTime,uDeposit:shared.uDeposit,uHeap:shared.uHeap};
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:gateUniforms,vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,fragmentShader:`uniform float uTime,uDeposit,uOpacity;uniform vec4 uHeap;varying vec2 vUv;varying vec3 vWorld;${TERRAIN_GLSL}void main(){if(vWorld.y<duneHeight(vWorld.xz,uDeposit))discard;float border=pow(max(abs(vUv.x-.5)*2.,abs(vUv.y-.5)*2.),34.);float sweep=pow(.5+.5*sin(vUv.y*22.-uTime*.9),18.);float alpha=border*.48+.024+sweep*.025;gl_FragColor=vec4(.32,.54,.62,alpha*uOpacity);}`});
  for(const [x,opacityScale]of[[ENTRY_X,1],[EXIT_X,.8]]){const m=material.clone();m.uniforms={...gateUniforms,uOpacity:{value:opacityScale}};const mesh=new THREE.Mesh(new THREE.PlaneGeometry(4.4,3.3),m);mesh.rotation.y=Math.PI/2;mesh.position.set(x,terrainHeight(x,0)+1.4,0);mesh.renderOrder=3;scene.add(mesh);}
}

const grainVertex=`
attribute vec3 aColor;attribute vec4 aSeed,aFall,aRise,aWheel;attribute vec2 aVelocity;attribute float aWheelIndex;
uniform float uTime,uDeposit,uDistance,uPixel,uKind;uniform mat4 uCarMatrix;uniform vec4 uOffsets,uHeap;
varying vec3 vColor;varying float vAlpha;
${TERRAIN_GLSL}
const float ENTRY=${ENTRY_X.toFixed(5)},EXIT=${EXIT_X.toFixed(5)};
float ease(float v){v=clamp(v,0.,1.);return v*v*(3.-2.*v);}
vec3 currentPoint(){vec3 p=position;if(aWheel.w>0.){float angle=-uDistance/aWheel.w,c=cos(angle),s=sin(angle);vec2 q=p.xy-aWheel.xy;p.xy=aWheel.xy+mat2(c,s,-s,c)*q;p.y+=uOffsets[int(aWheelIndex)];}return(uCarMatrix*vec4(p,1.)).xyz;}
void main(){
 vec3 p;float alpha=0.,sand=1.;
 if(uKind<.5){float age=uTime-aFall.x;vec3 start=vec3(ENTRY,aFall.y,aFall.z);float a=max(age,0.);p=start+vec3(max(.035,aVelocity.x*.48)*a,min(.02,aVelocity.y)*a-4.905*a*a,(aSeed.y-.5)*a*.22);
 float base=duneHeight(vec2(ENTRY,aFall.z),0.);float impact=clamp(sqrt(max(.005,aFall.y-base)*2./9.81),.07,.8);float settled=max(0.,age-impact);float follow=ease(settled/.95);float spread=pow(max(uHeap.y,.00001),.21);
 vec2 goal=vec2(uHeap.x+(aSeed.x-.5)*2.8*spread,(aSeed.y-.5)*2.0*spread);p.xz=mix(p.xz,goal,follow);float h=duneHeight(p.xz,uDeposit)+.01;p.y=max(p.y,h);alpha=smoothstep(0.,.035,age)*(1.-smoothstep(3.6,4.5,settled))*smoothstep(0.,.035,uHeap.y);alpha*=mix(1.,.10,ease(settled/.35));sand=ease(age*8.);}

 else{float riseTime=aRise.w,t=(uTime-(aRise.x-riseTime))/riseTime;float e=ease(t);vec3 start=vec3(EXIT-.23+(aSeed.x-.5)*.3,0.,aRise.z+(aSeed.y-.5)*.40);start.y=duneHeight(start.xz,uDeposit)+.006;vec3 target=vec3(EXIT,aRise.y,aRise.z);p=mix(start,target,e);p.x+=sin(clamp(t,0.,1.)*3.14159)*(aSeed.z-.5)*.1;p.z+=sin(clamp(t,0.,1.)*3.14159)*(aSeed.x-.5)*.12;alpha=smoothstep(0.,.07,t)*(1.-smoothstep(.96,1.04,t));if(t>1.)p=currentPoint();sand=1.-ease((t-.8)/.2);}
 vec3 sandColor=mix(vec3(.23,.13,.045),vec3(.64,.43,.19),aSeed.z)*(.8+aSeed.w*.35);vColor=mix(aColor,sandColor,sand);vAlpha=alpha;
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uPixel*(16.+aSeed.z*13.)/max(-mv.z,1.),.7,3.);if(alpha<.001)gl_Position=vec4(2.,2.,2.,1.);
}`;
const grainFragment=`varying vec3 vColor;varying float vAlpha;void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.||vAlpha<.001)discard;gl_FragColor=vec4(vColor*(.8+.2*sqrt(max(0.,1.-r))),vAlpha*(1.-smoothstep(.7,1.,r)));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function makeGrains(){
  const count=innerWidth<701?38000:105000,data=sampleVehicle(vehicle.meshes,count,random);
  const fall=new Float32Array(count*4),rise=new Float32Array(count*4),velocities=new Float32Array(count*2),wheelData=new Float32Array(count*4),wheelIndex=new Float32Array(count);
  for(let i=0;i<count;i++){
    const point={x:data.positions[i*3],y:data.positions[i*3+1],z:data.positions[i*3+2]},wi=data.wheelIndices[i],a=motion.crossing(point,wi,ENTRY_X),b=motion.crossing(point,wi,EXIT_X);
    const h=terrainHeight(EXIT_X,b.z);
    fall.set([a.time,a.y,a.z,a.vx],i*4);rise.set([b.time,b.y,b.z,clamp(Math.sqrt(Math.max(.02,b.y-h)*2/9.81)*1.7+.22,.35,1.15)],i*4);velocities.set([a.vx,a.vy],i*2);
    if(wi>=0){const w=vehicle.wheels[wi];wheelData.set([w.x,w.y,w.z,w.radius],i*4);wheelIndex[i]=wi;}
  }
  const geometry=new THREE.BufferGeometry();for(const [name,values,size]of[['position',data.positions,3],['aColor',data.colors,3],['aSeed',data.seeds,4],['aFall',fall,4],['aRise',rise,4],['aVelocity',velocities,2],['aWheel',wheelData,4],['aWheelIndex',wheelIndex,1]])geometry.setAttribute(name,new THREE.BufferAttribute(values,size));
  function points(kind){const material=new THREE.ShaderMaterial({vertexShader:grainVertex,fragmentShader:grainFragment,uniforms:{...shared,uKind:{value:kind}},transparent:true,depthWrite:true});const mesh=new THREE.Points(geometry,material);mesh.frustumCulled=false;scene.add(mesh);return mesh;}
  falling=points(0);rising=points(1);canvas.dataset.grains=String(count);
}

function makeHeapGrains(){
  const count=innerWidth<701?5000:14000,geometry=new THREE.BufferGeometry(),seeds=new Float32Array(count*4);
  for(let i=0;i<seeds.length;i++)seeds[i]=random();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
  const material=new THREE.ShaderMaterial({uniforms:shared,transparent:true,depthWrite:true,vertexShader:`attribute vec4 aSeed;uniform vec4 uHeap;uniform float uDeposit,uPixel;varying vec3 vColor;varying float vAlpha;${TERRAIN_GLSL}
void main(){float q=fract(aSeed.x+uHeap.w*.13),spread=pow(max(uHeap.y,.00001),.21);vec3 p=vec3(uHeap.x+(q-.5)*5.*spread,0.,(aSeed.y-.5)*3.5*spread);float height=heapHeight(p.xz);p.y=duneHeight(p.xz,uDeposit)+.012;vAlpha=smoothstep(.015,.07,height)*smoothstep(0.,.08,q)*(1.-smoothstep(.92,1.,q))*.24;float e=.035;vec3 normal=normalize(vec3(-(heapHeight(p.xz+vec2(e,0.))-heapHeight(p.xz-vec2(e,0.)))/(2.*e),1.,-(heapHeight(p.xz+vec2(0.,e))-heapHeight(p.xz-vec2(0.,e)))/(2.*e)));float light=.45+.55*max(dot(normal,normalize(vec3(-14.,20.,-10.))),0.);vColor=mix(vec3(.15,.10,.05),vec3(.40,.30,.17),aSeed.z)*light;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uPixel*(15.+aSeed.w*8.)/max(1.,-mv.z),.7,2.2);}`,fragmentShader:grainFragment});
  heapGrains=new THREE.Points(geometry,material);heapGrains.frustumCulled=false;scene.add(heapGrains);
}

function makeVortices(){
  const count=innerWidth<701?9000:28000,geometry=new THREE.BufferGeometry(),seeds=new Float32Array(count*4);
  for(let i=0;i<seeds.length;i++)seeds[i]=random();
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,4));
  const material=new THREE.ShaderMaterial({uniforms:shared,transparent:true,depthWrite:false,vertexShader:`
attribute vec4 aSeed;uniform vec4 uHeap;uniform float uTime,uDeposit,uPixel;varying vec3 vColor;varying float vAlpha;
${TERRAIN_GLSL}
void main(){
 float mass=pow(max(uHeap.y,.00001),.4),cluster=floor(aSeed.x*7.),direction=mod(cluster,2.)*2.-1.;
 float life=fract(aSeed.y+uTime*(.18+.027*cluster)),envelope=sin(life*3.141593);
 float centreAngle=cluster*2.39996+sin(uTime*.53+cluster)*.34;
 vec2 centre=vec2(uHeap.x,0.)+vec2(cos(centreAngle)*1.2,sin(centreAngle)*1.05)*mass;
 float angle=aSeed.z*6.283185+direction*(life*8.+uTime*(1.1+.14*cluster));
 float radius=(.14+life*(.65+aSeed.w*.95))*mass;
 vec2 offset=vec2(cos(angle)*radius,sin(angle)*radius*.78);
 vec3 p=vec3(centre.x+offset.x,0.,centre.y+offset.y);
 p.x+=sin(life*5.+cluster)*life*.3*mass;
 p.y=duneHeight(p.xz,uDeposit)+(.025+envelope*(.28+aSeed.w*.85)+life*.26)*mass;
 float field=smoothstep(${(ENTRY_X-.15).toFixed(4)},${(ENTRY_X+.4).toFixed(4)},p.x)*(1.-smoothstep(${(EXIT_X-.35).toFixed(4)},${(EXIT_X+.3).toFixed(4)},p.x));
 vAlpha=pow(envelope,.8)*smoothstep(0.,.15,uHeap.y)*field*(.17+aSeed.w*.36);
 float light=.78+.22*cos(angle-1.);vColor=mix(vec3(.24,.16,.075),vec3(.60,.46,.28),aSeed.w)*light;
 vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
 gl_PointSize=clamp(uPixel*(15.+aSeed.z*19.)/max(1.,-mv.z),.75,3.1);
 if(vAlpha<.002)gl_Position=vec4(2.,2.,2.,1.);
}`,fragmentShader:grainFragment});
  vortices=new THREE.Points(geometry,material);vortices.frustumCulled=false;vortices.renderOrder=2;scene.add(vortices);
}

let tracks,trailX=START_X;
function setScene(){
  const x=START_X+elapsed*SPEED,heap=heapAt(x),deposit=heap.amount,pose=motion.poseAt(x);
  shared.uDeposit.value=deposit;shared.uHeap.value.set(heap.centre,heap.amount,heap.phase,heap.flow);shared.uTime.value=elapsed;shared.uDistance.value=pose.distance;shared.uOffsets.value.set(...pose.offsets);
  vehicle.root.position.set(x,pose.y,0);vehicle.root.rotation.set(pose.roll,0,pose.pitch,'ZYX');
  vehicle.wheelGroups.forEach((group,i)=>{const wheel=vehicle.wheels[i];group.position.y=wheel.y+pose.offsets[i];group.rotation.z=-pose.distance/wheel.radius;});
  vehicle.root.updateMatrixWorld(true);shared.uCarMatrix.value.copy(vehicle.root.matrixWorld);
  heapGrains.visible=vortices.visible=heap.amount>.00002;falling.visible=heap.amount>.00001&&x+2.6>ENTRY_X;rising.visible=x+2.6>EXIT_X-SPEED*1.2&&x-2.6<EXIT_X+SPEED*.2;trailX=Math.max(trailX,x);tracks.value=trailX;
  canvas.dataset.time=elapsed.toFixed(3);canvas.dataset.carX=x.toFixed(3);canvas.dataset.wheelAngle=vehicle.wheelGroups[0].rotation.z.toFixed(3);canvas.dataset.deposit=deposit.toFixed(3);
  let contactError=0;for(let i=0;i<4;i++){const centre=vehicle.wheelGroups[i].getWorldPosition(new THREE.Vector3());if(centre.x<ENTRY_X||centre.x>EXIT_X)contactError=Math.max(contactError,Math.abs(centre.y-vehicle.wheels[i].radius-terrainHeight(centre.x,centre.z,heap)));}canvas.dataset.contactError=contactError.toFixed(4);canvas.dataset.heapX=heap.centre.toFixed(3);canvas.dataset.heapAmount=heap.amount.toFixed(3);
  canvas.dataset.phase=x+2.525<ENTRY_X?'drive':x-2.525<ENTRY_X?'dissolve':x+2.525<EXIT_X?'absorbed':x-2.525<EXIT_X?'reform':'drive-out';
}
function resize(){
  if(!renderer)return;const mobile=innerWidth<701;renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.25:1.6));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.fov=mobile?49:37;camera.updateProjectionMatrix();shared.uPixel.value=renderer.getPixelRatio();dirty=true;
}
function updateCamera(){
  yaw+=(yawTarget-yaw)*.08;elevation+=(elevationTarget-elevation)*.08;
  const mobile=innerWidth<701,angle=(mobile?.95:.30)+yaw,distance=(mobile?27:21)*zoom;
  camera.position.set(Math.sin(angle)*distance,(mobile?9.5:7.5)+elevation,Math.cos(angle)*distance);camera.lookAt(.6,1.2,0);
}
function fallback(){ready=false;document.body.classList.remove('loading');document.querySelector('#poster').hidden=false;canvas.dataset.status='fallback';}
async function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.98;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color(0xc9bba2);scene.fog=new THREE.Fog(0xc9bba2,33,115);camera=new THREE.PerspectiveCamera(37,1,.1,220);
  scene.add(new THREE.HemisphereLight(0xd8e8ee,0xa17f50,1.85));const sun=new THREE.DirectionalLight(0xffe6ba,3.3);sun.position.set(-14,20,-10);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<701?1024:2048,innerWidth<701?1024:2048);Object.assign(sun.shadow.camera,{left:-19,right:19,top:14,bottom:-14,near:.1,far:65});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.025;sun.shadow.bias=-.0001;scene.add(sun);
  makeTerrain();vehicle=await loadVehicle(makeEnvironment(),decorate);scene.add(vehicle.root);motion=createMotion(vehicle.wheels);makeGrains();makeHeapGrains();makeVortices();tracks=makeTracks();makeGate();
  resize();updateCamera();setScene();renderer.render(scene,camera);ready=true;canvas.dataset.status='ready';canvas.dataset.wheels=String(vehicle.wheels.length);document.body.classList.remove('loading');last=performance.now();requestAnimationFrame(tick);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();});
 }catch(error){console.warn('Dune scene unavailable:',error.message);fallback();}
}
function tick(now){
 requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);last=now;if(!ready||document.hidden)return;
 if(playing){elapsed=(elapsed+dt)%DURATION;dirty=true;}
 const moving=Math.abs(yaw-yawTarget)+Math.abs(elevation-elevationTarget)>.001;
 if(innerWidth<701&&now-lastDraw<32)return;
 if(dirty||moving){setScene();updateCamera();renderer.render(scene,camera);lastDraw=now;dirty=false;}
}
document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;});
reduced.addEventListener('change',event=>{playing=!event.matches;dirty=true;});
addEventListener('resize',resize,{passive:true});
canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,yaw:yawTarget,elevation:elevationTarget,distance:0};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag)return;drag.distance=Math.max(drag.distance,Math.hypot(event.clientX-drag.x,event.clientY-drag.y));yawTarget=clamp(drag.yaw+(event.clientX-drag.x)*.004,-.65,.65);elevationTarget=clamp(drag.elevation+(event.clientY-drag.y)*.015,-2,5);dirty=true;});
canvas.addEventListener('pointerup',()=>{if(drag&&drag.distance<5){playing=!playing;dirty=true;}drag=null;});canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('dblclick',()=>{yawTarget=elevationTarget=0;zoom=1;dirty=true;});
canvas.addEventListener('wheel',event=>{if(event.ctrlKey)return;event.preventDefault();zoom=clamp(zoom+event.deltaY*.00035,.82,1.3);dirty=true;},{passive:false});
canvas.addEventListener('keydown',event=>{
  if(event.code==='Space'){event.preventDefault();playing=!playing;dirty=true;}
  if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();playing=false;if(event.key==='Home')elapsed=0;else if(event.key==='End')elapsed=DURATION-.01;else elapsed=clamp(elapsed+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?5:1),0,DURATION-.01);dirty=true;}
});
init();
