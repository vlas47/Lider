import {THREE,GLTFLoader,MeshoptDecoder} from './vendor/scene.min.js';

// All motion is derived from one normalized timeline. Seeking and replaying are deterministic.
const $ = selector => document.querySelector(selector);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = $('#scene');
const DURATION = 24;
const ORIGIN = -2.05;
const DESTINATION = 2.1;
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b,v));
const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
const mix = (a,b,t) => a+(b-a)*t;
let progress=0, playing=false, elapsed=0, last=performance.now(), dirty=true, drawAt=0;
let renderer, scene, camera, vehicle, particles, particleUniforms, groundShadow, bodyShadow;
let yaw=0, yawTarget=0, elevation=0, elevationTarget=0, drag=null, ready=false, uiPhase=-1;
let seed=28481;
const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
const motionUniforms={uMode:{value:0},uBreak:{value:0},uBuild:{value:0},uCarX:{value:0}};
const phases=[
  ['Движение','У каждой формы есть свой путь.'],
  ['Распад','Кузов становится тысячами песчинок.'],
  ['Песок','Форма исчезла. Материал остался.'],
  ['Сборка','Песчинки снова находят своё место.'],
  ['Новый путь','Тот же характер. Новая точка отсчёта.']
];
function phaseAt(p){return p<.18?0:p<.39?1:p<.69?2:p<.88?3:4;}
function updateUI(){
  const phase=phaseAt(progress);
  if(phase!==uiPhase){uiPhase=phase;$('#status-index').textContent=String(phase+1).padStart(2,'0');$('#status-title').textContent=phases[phase][0];$('#status-copy').textContent=phases[phase][1];document.querySelectorAll('[data-time]').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===phase)));}
  $('#timeline').value=String(Math.round(progress*1000));
  $('#timeline').style.setProperty('--progress',`${progress*100}%`);
  $('#timeline').setAttribute('aria-valuetext',`${phases[phase][0]}, ${Math.round(progress*100)} процентов`);
  $('#time').textContent=`${String(Math.floor(progress*DURATION)).padStart(2,'0')} / 24 СЕК`;
  $('#pause').setAttribute('aria-pressed',String(!playing));
  $('#pause').setAttribute('aria-label',playing?'Приостановить анимацию':'Продолжить анимацию');
  $('#pause-label').textContent=playing?'ПАУЗА':'ПРОДОЛЖИТЬ';$('#pause-icon').textContent=playing?'Ⅱ':'▷';
  $('#play-label').textContent=progress>.01?'Повторить превращение':'Смотреть превращение';
  canvas.dataset.phase=String(phase);canvas.dataset.progress=progress.toFixed(3);
}
function seek(p,run=false){progress=clamp(p);elapsed=progress*DURATION;playing=run;dirty=true;updateUI();}
$('#play').addEventListener('click',()=>seek(0,true));
$('#pause').addEventListener('click',()=>{if(progress>=1)seek(0,true);else{playing=!playing;dirty=true;updateUI();}});
$('#timeline').addEventListener('input',event=>seek(Number(event.target.value)/1000));
document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>seek(Number(button.dataset.time))));
reduced.addEventListener('change',event=>{if(event.matches){playing=false;updateUI();}});
document.addEventListener('visibilitychange',()=>{last=performance.now();dirty=true;});
updateUI();canvas.dataset.status='loading';document.querySelectorAll('.control-deck button,.control-deck input').forEach(el=>el.disabled=true);

function showFallback(message){ready=false;playing=false;canvas.dataset.status='fallback';$('#loading').hidden=true;$('#fallback').hidden=false;$('#fallback p').innerText=message||'Интерактивная сцена требует поддержки WebGL 2.\nОткройте страницу в современном браузере.';document.querySelectorAll('.control-deck button,.control-deck input').forEach(el=>el.disabled=true);}

// Dissolve the actual model as the corresponding sand grains leave its surface.
const dissolveHeader=`varying vec3 vSandWorld;uniform float uMode,uBreak,uBuild,uCarX;
float grainHash(vec3 p){return fract(sin(dot(floor(p*31.),vec3(12.9898,78.233,45.164)))*43758.5453);}`;
const dissolveFragment=`
vec3 localSand=vSandWorld-vec3(uCarX,0.,0.);
float noiseSand=grainHash(localSand);
float frontSand=clamp((2.55-localSand.x)/5.1,0.,1.)*.58+noiseSand*.08;
float backSand=clamp((localSand.x+2.55)/5.1,0.,1.)*.48+noiseSand*.08;
if(uMode>1.5&&uMode<2.5)discard;
if(uMode>.5&&uMode<1.5&&uBreak>frontSand)discard;
if(uMode>2.5&&uMode<3.5&&uBuild<backSand+.34)discard;
`;
function clipped(material){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,motionUniforms);
    shader.vertexShader='varying vec3 vSandWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSandWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=dissolveHeader+'\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+dissolveFragment);
  };
  material.customProgramCacheKey=()=>`sand-car-clip-v1-${material.type}`;
  return material;
}

async function loadVehicle(environment){
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf=await loader.loadAsync('./assets/bmw-m4.glb');
  const source=gltf.scene;source.updateMatrixWorld(true);
  let bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
  if(size.z>size.x)source.rotation.y+=Math.PI/2;
  source.updateMatrixWorld(true);bounds.setFromObject(source);size=bounds.getSize(new THREE.Vector3());
  const scale=5.05/size.x;source.scale.multiplyScalar(scale);source.updateMatrixWorld(true);
  bounds.setFromObject(source);const center=bounds.getCenter(new THREE.Vector3());source.position.add(new THREE.Vector3(-center.x,-bounds.min.y,-center.z));source.updateMatrixWorld(true);
  const root=new THREE.Group(),meshes=[],materials=new Map();
  const depth=clipped(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));
  function materialFor(original,nodeName){
    const key=original.uuid;if(materials.has(key))return materials.get(key);
    let mat=original.clone();const name=original.name.toLowerCase();
    if(name.includes('body151')||name.includes('livery')||name.includes('zx1'))mat=new THREE.MeshPhysicalMaterial({color:0x929ca8,metalness:.68,roughness:.32,clearcoat:.65,clearcoatRoughness:.25});
    else if(name.includes('windows'))mat=new THREE.MeshPhysicalMaterial({color:0x17232c,metalness:.25,roughness:.07,transparent:true,opacity:.78,depthWrite:false,clearcoat:1});
    else if(name.includes('m8rim001')){mat.color.set(0x16181b);mat.metalness=.04;mat.roughness=.9;}
    else if(name.includes('chrome')||name.includes('rim')){mat.color.set(0x717985);mat.metalness=.95;mat.roughness=.25;}
    else if(name.includes('black161')){mat.color.set(0x15171a);mat.metalness=.12;mat.roughness=.68;}
    else if(name.includes('led')){mat.emissive.set(0xdce9ff);mat.emissiveIntensity=.5;mat.roughness=.18;}
    else if(name.includes('redlight')){mat.emissive.set(0xdd2419);mat.emissiveIntensity=.35;}
    else if(!mat.transparent){mat.roughness=Math.max(mat.roughness,.3);mat.metalness=Math.max(mat.metalness,.18);}
    mat.name=original.name;mat.envMap=environment;mat.envMapIntensity=name.includes('windows')?1.1:1.7;clipped(mat);materials.set(key,mat);return mat;
  }
  source.traverse(object=>{
    if(!object.isMesh)return;
    if(!Array.isArray(object.material)&&object.material.name.toLowerCase().includes("livery"))return;
    const geometry=object.geometry.clone();
    // Quantized glTF attributes must become floats before applying world transforms.
    for(const name of ['position','normal'])if(geometry.attributes[name]){const old=geometry.attributes[name],values=new Float32Array(old.count*3);for(let i=0;i<old.count;i++){values[i*3]=old.getX(i);values[i*3+1]=old.getY(i);values[i*3+2]=old.getZ(i);}geometry.setAttribute(name,new THREE.BufferAttribute(values,3));}
    geometry.applyMatrix4(object.matrixWorld);geometry.computeBoundingSphere();
    const material=Array.isArray(object.material)?object.material.map(mat=>materialFor(mat,object.name)):materialFor(object.material,object.name);
    const mesh=new THREE.Mesh(geometry,material);mesh.name=object.name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;root.add(mesh);meshes.push(mesh);
  });
  root.updateMatrixWorld(true);const normalized=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  canvas.dataset.model='BMW M4 Competition';canvas.dataset.modelSize=normalized.toArray().map(v=>v.toFixed(2)).join(' / ');canvas.dataset.modelMeshes=String(meshes.length);
  return {root,meshes,wheels:[]};
}

function makeEnvironment(){
  const room=new THREE.Scene();room.background=new THREE.Color(0x111318);
  const wall=new THREE.MeshBasicMaterial({color:0x1c2026,side:THREE.BackSide});room.add(new THREE.Mesh(new THREE.BoxGeometry(30,20,30),wall));
  const panels=[[[0,8,0],[15,.1,3.5],0xffffff],[[0,3,-12],[18,2,.1],0xdce8ff],[[-12,4,0],[.1,5,14],0x080a0e],[[12,3,0],[.1,2,16],0xe2ebff]];
  for(const [p,size,color]of panels){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({color}));mesh.position.set(...p);room.add(mesh);}
  const pmrem=new THREE.PMREMGenerator(renderer);const map=pmrem.fromScene(room,.04).texture;pmrem.dispose();room.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});return map;
}

function makeSandTexture(){
  const image=document.createElement('canvas');image.width=512;image.height=512;const c=image.getContext('2d');const data=c.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;const n=random(),ripple=Math.sin(y*.18+Math.sin(x*.021)*1.4)*3;data.data[i]=140+n*45+ripple;data.data[i+1]=140+n*45+ripple;data.data[i+2]=140+n*45+ripple;data.data[i+3]=255;}
  c.putImageData(data,0,0);const tex=new THREE.CanvasTexture(image);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(75,75);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);return tex;
}
function shadowTexture(){const image=document.createElement('canvas');image.width=128;image.height=128;const c=image.getContext('2d');const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(45,39,20,.56)');g.addColorStop(.45,'rgba(45,39,20,.30)');g.addColorStop(1,'rgba(45,39,20,0)');c.fillStyle=g;c.fillRect(0,0,128,128);return new THREE.CanvasTexture(image);}
function makeGround(){
  const geometry=new THREE.PlaneGeometry(140,140,200,200);geometry.rotateX(-Math.PI/2);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),distance=Math.sqrt(x*x+z*z),far=smooth((distance-10)/25);p.setY(i,-.018+Math.sin(x*.21+z*.12)*Math.sin(z*.17)*far*.35);}
  geometry.computeVertexNormals();const texture=makeSandTexture();
  const floor=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.045,roughness:.94,color:0x424344}));floor.receiveShadow=true;scene.add(floor);
  const shadow=shadowTexture();const sm=new THREE.MeshBasicMaterial({map:shadow,transparent:true,opacity:.65,depthWrite:false});groundShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),sm);groundShadow.rotation.x=-Math.PI/2;groundShadow.position.y=.009;groundShadow.scale.set(7,3,1);scene.add(groundShadow);
  bodyShadow=new THREE.Mesh(new THREE.PlaneGeometry(6.4,2.7),new THREE.MeshBasicMaterial({map:shadow,transparent:true,opacity:.6,depthWrite:false}));bodyShadow.rotation.x=-Math.PI/2;bodyShadow.position.y=.012;scene.add(bodyShadow);
  // Very faint tyre impressions anchor the first and last drive to the sand.
  const trackMaterial=new THREE.MeshBasicMaterial({color:0x12100d,transparent:true,opacity:.13,depthWrite:false});
  for(const [start,end]of[[-9,ORIGIN],[DESTINATION,10]])for(const z of[-1,1]){for(let x=start;x<end;x+=.16){const mark=new THREE.Mesh(new THREE.PlaneGeometry(.09,.21),trackMaterial);mark.rotation.x=-Math.PI/2;mark.position.set(x,.002,z);scene.add(mark);}}
}

function sampleCar(meshes,count){
  const triangles=[];let total=0;const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3();const sun=new THREE.Vector3(-.35,.8,.5).normalize();
  const totalTriangles=meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3,0);const stride=Math.max(1,Math.ceil(totalTriangles/(innerWidth<701?40000:70000)));
  for(const mesh of meshes){const g=mesh.geometry,pos=g.attributes.position,index=g.index;for(let i=0;i<(index?index.count:pos.count);i+=3*stride){va.fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);vb.fromBufferAttribute(pos,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);vc.fromBufferAttribute(pos,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);ab.subVectors(vb,va);ac.subVectors(vc,va);normal.crossVectors(ab,ac);const area=normal.length()*.5;if(area<1e-8)continue;normal.normalize();total+=area;const color=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material).color.clone();const shade=.72+Math.max(normal.dot(sun),0)*.55;color.multiplyScalar(shade);triangles.push({end:total,a:va.clone(),b:vb.clone(),c:vc.clone(),color});}}
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),seeds=new Float32Array(count*4);
  for(let i=0;i<count;i++){const pick=random()*total;let lo=0,hi=triangles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<pick)lo=mid+1;else hi=mid;}const tri=triangles[lo],u=Math.sqrt(random()),v=random();positions[i*3]=tri.a.x*(1-u)+tri.b.x*u*(1-v)+tri.c.x*u*v;positions[i*3+1]=tri.a.y*(1-u)+tri.b.y*u*(1-v)+tri.c.y*u*v;positions[i*3+2]=tri.a.z*(1-u)+tri.b.z*u*(1-v)+tri.c.z*u*v;colors.set(tri.color.toArray(),i*3);seeds.set([random(),random(),random(),random()],i*4);}
  return{positions,colors,seeds};
}

const sandVertex=`
attribute vec3 aColor;attribute vec4 aSeed;
uniform float uProgress,uTime,uPixel;
varying vec3 vColor;varying float vAlpha;
float sat(float v){return clamp(v,0.,1.);}float ease(float v){v=sat(v);return v*v*(3.-2.*v);}
void main(){
 float p=uProgress;vec3 original=position;float threshold=clamp((2.55-original.x)/5.1,0.,1.)*.58+aSeed.w*.08;
 float radius=sqrt(aSeed.x),angle=aSeed.y*6.2831853;
 vec3 heap=vec3(cos(angle)*radius*2.65,.035+pow(1.-radius,1.25)*(.72+aSeed.z*.30),sin(angle)*radius*1.23);
 vec3 a=heap+vec3(-2.05,0.,0.);vec3 b=heap+vec3(2.1,0.,-.24);
 vec3 pos=original+vec3(-2.05,0.,0.);float alpha=0.;float sand=0.;
 if(p>=.18&&p<.39){float d=(p-.18)/.21;float t=sat((d-threshold)/max(.98-threshold,.1));alpha=smoothstep(0.,.018,t);vec3 start=original+vec3(-2.05,0.,0.);pos=mix(start,a,vec3(ease(t),t*t,ease(t)));pos.x+=sin(t*3.14159)*(aSeed.z-.3)*.65;pos.y+=sin(t*3.14159)*(.12+aSeed.w*.6);pos.z+=sin(t*3.14159)*(aSeed.y-.5)*.7;sand=ease(t*2.2);}
 else if(p>=.39&&p<.46){pos=a;alpha=1.;sand=1.;}
 else if(p>=.46&&p<.65){float t=sat(((p-.46)/.19-aSeed.z*.11)/.89);float e=ease(t);pos=mix(a,b,e);float wave=sin(t*3.14159);pos.y+=wave*(.2+aSeed.w*.75);pos.x+=wave*sin(t*8.+aSeed.y*6.283)*.28;pos.z+=wave*sin(t*7.+aSeed.y*6.283)*.6;alpha=1.;sand=1.;}
 else if(p>=.65&&p<.69){pos=b;alpha=1.;sand=1.;}
 else if(p>=.69&&p<.88){float r=(p-.69)/.19;float delay=clamp((original.x+2.55)/5.1,0.,1.)*.48+aSeed.w*.08;float t=sat((r-delay)/.36);float e=ease(t);vec3 target=original+vec3(2.1,0.,-.24);pos=mix(b,target,e);pos.y+=sin(t*3.14159)*(.15+aSeed.z*.45);pos.z+=sin(t*3.14159)*sin(aSeed.y*6.283)*.35;alpha=1.-smoothstep(.88,1.,t);sand=1.-ease((t-.60)/.4);}
 vec3 sandColor=mix(vec3(.32,.20,.075),vec3(.74,.55,.29),aSeed.z);sandColor*=.72+aSeed.w*.45;
 vColor=mix(aColor,sandColor,sand);vAlpha=alpha;
 vec4 mv=modelViewMatrix*vec4(pos,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(uPixel*(17.+aSeed.z*12.)/max(-mv.z,1.),.65,4.5);
}`;
const sandFragment=`
varying vec3 vColor;varying float vAlpha;
void main(){vec2 p=gl_PointCoord*2.-1.;float r=dot(p,p);if(r>1.||vAlpha<.01)discard;float light=.74+.26*sqrt(max(0.,1.-r));gl_FragColor=vec4(vColor*light,vAlpha*(1.-smoothstep(.7,1.,r)));
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
function makeParticles(meshes){
  const count=innerWidth<701?52000:145000;const data=sampleCar(meshes,count);const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));geometry.setAttribute('aColor',new THREE.BufferAttribute(data.colors,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(data.seeds,4));
  particleUniforms={uProgress:{value:0},uTime:{value:0},uPixel:{value:renderer.getPixelRatio()}};
  const material=new THREE.ShaderMaterial({vertexShader:sandVertex,fragmentShader:sandFragment,uniforms:particleUniforms,transparent:true,depthWrite:true,depthTest:true});particles=new THREE.Points(geometry,material);particles.frustumCulled=false;scene.add(particles);
  canvas.dataset.grains=String(count);
}

function setScene(p){
  const phase=phaseAt(p);let carX=ORIGIN,mode=0,d=0,r=0;
  if(p<.18)carX=mix(innerWidth<701?-3.3:-4.4,ORIGIN,smooth(p/.18));
  else if(p<.39){mode=1;d=(p-.18)/.21;}
  else if(p<.69){mode=2;carX=p<.55?ORIGIN:DESTINATION;}
  else if(p<.88){mode=3;r=(p-.69)/.19;carX=DESTINATION;}
  else carX=mix(DESTINATION,3.15,smooth((p-.88)/.12));
  vehicle.root.position.set(carX,0,p>=.55?-.24:0);
  for(const wheel of vehicle.wheels)wheel.rotation.z=phase===0?-(carX-ORIGIN)/.455:phase===4?-(carX-DESTINATION)/.455:0;
  motionUniforms.uMode.value=mode;motionUniforms.uBreak.value=d;motionUniforms.uBuild.value=r;motionUniforms.uCarX.value=carX;
  vehicle.root.visible=mode!==2;particles.visible=p>=.18&&p<=.88;particleUniforms.uProgress.value=p;
  const pile=p<.39?smooth((p-.20)/.19):p<.69?1:1-smooth((p-.69)/.19);
  const transfer=smooth((p-.46)/.19);groundShadow.position.x=mix(ORIGIN,DESTINATION,transfer);groundShadow.position.z=-.24*transfer;groundShadow.material.opacity=pile*.42;groundShadow.scale.set(mix(6.3,7.5,Math.sin(transfer*Math.PI)),3.6,1);
  bodyShadow.position.x=carX;bodyShadow.position.z=vehicle.root.position.z;bodyShadow.material.opacity=.55*(phase===1?1-smooth(d/.8):phase===2?0:phase===3?smooth((r-.4)/.6):1);
}
function resize(){
  if(!renderer)return;const w=innerWidth,h=$('#experience').clientHeight;const mobile=w<701;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.35:1.6));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=mobile?43:34;camera.updateProjectionMatrix();particleUniforms.uPixel.value=renderer.getPixelRatio();dirty=true;
}
function updateCamera(){
  yaw+=(yawTarget-yaw)*.08;elevation+=(elevationTarget-elevation)*.08;
  const mobile=innerWidth<701;const framing=smooth((progress-.38)/.5);const angle=.69+yaw;const distance=mobile?29:11.9+framing*2.7;
  camera.position.set(Math.sin(angle)*distance,(mobile?6.4:3.8+framing*1.6)+elevation,Math.cos(angle)*distance);
  camera.lookAt(.15,mobile?1.05:1.65-framing*.3,0);
  if(mobile)camera.setViewOffset(innerWidth,$('#experience').clientHeight,0,-65,innerWidth,$('#experience').clientHeight);else camera.clearViewOffset();
}

async function init(){
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setClearColor(0x14171a,1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color(0x14171a);scene.fog=new THREE.Fog(0x14171a,19,55);camera=new THREE.PerspectiveCamera(34,1,.1,130);
  scene.add(new THREE.HemisphereLight(0xe6edff,0x302c27,1.3));
  const sun=new THREE.DirectionalLight(0xffeee0,3.0);sun.position.set(-5,11,7);sun.castShadow=true;sun.shadow.mapSize.set(innerWidth<701?1024:2048,innerWidth<701?1024:2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.camera.far=35;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=4;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xc4d8ff,2.1);fill.position.set(2,4,-7);scene.add(fill);
  makeGround();vehicle=await loadVehicle(makeEnvironment());scene.add(vehicle.root);makeParticles(vehicle.meshes);resize();updateCamera();setScene(0);
  renderer.render(scene,camera);ready=true;canvas.dataset.status='ready';$('#loading').hidden=true;document.querySelectorAll('.control-deck button,.control-deck input').forEach(el=>el.disabled=false);
  // Play once after the visitor has seen the intact vehicle. Reduced motion starts paused.
  if(!reduced.matches){playing=true;elapsed=-1.5;}updateUI();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();showFallback('Сцена остановлена. Обновите страницу, чтобы продолжить.');});
  requestAnimationFrame(tick);
 }catch(error){console.warn('Sand scene unavailable:',error.message);showFallback();}
}
function tick(now){
 requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.06);last=now;if(!ready||document.hidden)return;
 const movingCamera=Math.abs(yaw-yawTarget)+Math.abs(elevation-elevationTarget)>.001;
 if(playing){elapsed+=dt;progress=clamp(elapsed/DURATION);if(progress>=1)playing=false;dirty=true;updateUI();}
 if(innerWidth<701&&now-drawAt<32)return;
 if(dirty||movingCamera){updateCamera();setScene(progress);particleUniforms.uTime.value=now/1000;renderer.render(scene,camera);dirty=false;drawAt=now;}
}
addEventListener('resize',resize,{passive:true});
canvas.addEventListener('pointerdown',event=>{drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:yawTarget,elevation:elevationTarget};canvas.setPointerCapture(event.pointerId);$('#stage').classList.add('dragging');});
canvas.addEventListener('pointermove',event=>{if(!drag)return;yawTarget=clamp(drag.yaw+(event.clientX-drag.x)*.006,-.9,.9);elevationTarget=clamp(drag.elevation+(event.clientY-drag.y)*.015,-1.5,3);dirty=true;});
function endDrag(){drag=null;$('#stage').classList.remove('dragging');}canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('dblclick',()=>{yawTarget=0;elevationTarget=0;dirty=true;});
init();
