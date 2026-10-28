import {THREE,GLTFLoader,MeshoptDecoder} from './vendor/scene.min.js';

function bakeGeometry(object){
  const geometry=object.geometry.clone();
  for(const name of ['position','normal'])if(geometry.attributes[name]){
    const old=geometry.attributes[name],values=new Float32Array(old.count*3);
    for(let i=0;i<old.count;i++){values[i*3]=old.getX(i);values[i*3+1]=old.getY(i);values[i*3+2]=old.getZ(i);}
    geometry.setAttribute(name,new THREE.BufferAttribute(values,3));
  }
  geometry.applyMatrix4(object.matrixWorld);geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
const quadrant=(x,z)=>(x>0?2:0)+(z>0?1:0);
function splitWheels(geometry){
  const groups=[[],[],[],[]],position=geometry.attributes.position,index=geometry.index,n=index?index.count:position.count;
  for(let t=0;t<n;t+=3){const ids=[0,1,2].map(j=>index?index.getX(t+j):t+j);const x=ids.reduce((s,i)=>s+position.getX(i),0)/3,z=ids.reduce((s,i)=>s+position.getZ(i),0)/3;groups[quadrant(x,z)].push(...ids);}
  return groups.map(ids=>{
    const part=new THREE.BufferGeometry();
    for(const [name,attribute]of Object.entries(geometry.attributes)){
      if(!['position','normal','uv','uv1','tangent','color'].includes(name))continue;
      const values=new Float32Array(ids.length*attribute.itemSize);
      for(let i=0;i<ids.length;i++)for(let j=0;j<attribute.itemSize;j++)values[i*attribute.itemSize+j]=j===0?attribute.getX(ids[i]):j===1?attribute.getY(ids[i]):j===2?attribute.getZ(ids[i]):attribute.getW(ids[i]);
      part.setAttribute(name,new THREE.BufferAttribute(values,attribute.itemSize));
    }
    part.computeBoundingBox();part.computeBoundingSphere();return part;
  });
}

export async function loadVehicle(environment,decorate){
  const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf=await loader.loadAsync('./assets/bmw-m4.glb');
  const source=gltf.scene;source.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(source);let size=bounds.getSize(new THREE.Vector3());
  if(size.z>size.x)source.rotation.y+=Math.PI/2;
  source.updateMatrixWorld(true);bounds.setFromObject(source);size=bounds.getSize(new THREE.Vector3());
  source.scale.multiplyScalar(5.05/size.x);source.updateMatrixWorld(true);bounds.setFromObject(source);
  const center=bounds.getCenter(new THREE.Vector3());source.position.add(new THREE.Vector3(-center.x,-bounds.min.y,-center.z));source.updateMatrixWorld(true);
  const pieces=[],materials=new Map();
  function materialFor(original){
    if(materials.has(original.uuid))return materials.get(original.uuid);
    const name=original.name.toLowerCase();let material=original.clone();
    if(name.includes('body151')||name.includes('zx1'))material=new THREE.MeshPhysicalMaterial({color:0x6a7681,metalness:.7,roughness:.31,clearcoat:.7,clearcoatRoughness:.23});
    else if(name.includes('windows'))material=new THREE.MeshPhysicalMaterial({color:0x152029,metalness:.25,roughness:.09,transparent:true,opacity:.79,depthWrite:false,clearcoat:1});
    else if(name.includes('m8rim001')){material.color.set(0x15171a);material.metalness=.04;material.roughness=.91;}
    else if(name.includes('chrome')||name.includes('rim')){material.color.set(0x525b64);material.metalness=.72;material.roughness=.36;}
    else if(name.includes('black161')){material.color.set(0x15171a);material.metalness=.12;material.roughness=.7;}
    else if(name.includes('led')){material.emissive.set(0xdce9ff);material.emissiveIntensity=.45;material.roughness=.2;}
    else if(name.includes('redlight')){material.emissive.set(0xdd2419);material.emissiveIntensity=.3;}
    else if(!material.transparent){material.roughness=Math.max(material.roughness,.3);material.metalness=Math.max(material.metalness,.15);}
    material.name=original.name;material.envMap=environment;material.envMapIntensity=.95;decorate(material,false);materials.set(original.uuid,material);return material;
  }
  source.traverse(object=>{
    if(!object.isMesh||Array.isArray(object.material))return;
    if(object.material.name.toLowerCase().includes('livery'))return;
    pieces.push({geometry:bakeGeometry(object),material:materialFor(object.material),name:object.name,role:object.material.name.toLowerCase()});
  });
  const tyre=pieces.find(piece=>piece.role.includes('m8rim001'));
  if(!tyre)throw new Error('The source model has no tyre geometry');
  const tyreParts=splitWheels(tyre.geometry),wheels=tyreParts.map(part=>{
    const box=part.boundingBox,c=box.getCenter(new THREE.Vector3());
    return{x:c.x,y:c.y,z:c.z,radius:(box.max.y-box.min.y)*.5};
  });
  const root=new THREE.Group(),groups=wheels.map(w=>{const group=new THREE.Group();group.position.set(w.x,w.y,w.z);root.add(group);return group;}),meshes=[];
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});decorate(depth,true);
  function add(geometry,material,parent,name,wheelIndex=-1){
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=depth;mesh.userData.wheelIndex=wheelIndex;parent.add(mesh);meshes.push(mesh);
  }
  for(const piece of pieces){
    if(piece.role.includes('m8rim')){
      const parts=piece===tyre?tyreParts:splitWheels(piece.geometry);
      parts.forEach((part,i)=>{const w=wheels[i];part.translate(-w.x,-w.y,-w.z);add(part,piece.material,groups[i],`${piece.name}-wheel-${i}`,i);});
      piece.geometry.dispose();
    }else add(piece.geometry,piece.material,root,piece.name);
  }
  root.updateMatrixWorld(true);return{root,meshes,wheels,wheelGroups:groups};
}

export function sampleVehicle(meshes,count,random){
  const triangles=[];let total=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
  const totalTriangles=meshes.reduce((sum,mesh)=>sum+(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3,0),stride=Math.max(1,Math.ceil(totalTriangles/65000));
  const light=new THREE.Vector3(-.4,.9,.35).normalize();
  for(const mesh of meshes){const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
    for(let i=0;i<(index?index.count:p.count);i+=3*stride){
      a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(mesh.matrixWorld);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(mesh.matrixWorld);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(mesh.matrixWorld);
      n.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));const area=n.length()*.5;if(area<1e-8)continue;n.normalize();total+=area;
      triangles.push({end:total,a:a.clone(),b:b.clone(),c:c.clone(),color:mesh.material.color.clone().multiplyScalar(.78+.4*Math.max(0,n.dot(light))),wheel:mesh.userData.wheelIndex});
    }
  }
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),wheelIndices=new Int8Array(count),seeds=new Float32Array(count*4);
  for(let i=0;i<count;i++){
    const area=random()*total;let lo=0,hi=triangles.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].end<area)lo=mid+1;else hi=mid;}
    const triangle=triangles[lo],u=Math.sqrt(random()),v=random(),j=i*3;
    for(const [axis,k]of[['x',0],['y',1],['z',2]])positions[j+k]=triangle.a[axis]*(1-u)+triangle.b[axis]*u*(1-v)+triangle.c[axis]*u*v;
    colors.set(triangle.color.toArray(),j);wheelIndices[i]=triangle.wheel;seeds.set([random(),random(),random(),random()],i*4);
  }
  return{positions,colors,wheelIndices,seeds};
}
