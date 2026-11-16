import * as THREE from './vendor/three.module.js';

export const WEAPONS = {
 hammer: {name:'해머',key:'1',hint:'원하는 곳을 정확하게 타격',radius:2.8,power:1,cooldown:.13,shake:.35,color:'#d5dbce'},
 blast: {name:'폭탄',key:'2',hint:'넓은 범위를 한 번에 파괴',radius:6.8,power:1.8,cooldown:.35,shake:1,color:'#f0c16d'},
 laser: {name:'레이저',key:'3',hint:'건물 뒤편까지 관통',radius:2.2,power:1,cooldown:.18,shake:.35,color:'#f8ff6d'},
 mallet: {name:'고무망치',key:'4',hint:'커다란 고무망치로 위에서 쾅!',radius:3.6,power:.65,cooldown:.65,shake:.65,color:'#ffb38b',animation:'swing',duration:.7},
 ethanol: {name:'에탄올',key:'5',hint:'푸른 분사로 넓은 외벽을 씻어내기',radius:4.6,power:.35,cooldown:.3,shake:.08,color:'#8ae5ee',animation:'spray',duration:.38},
 foodMixer: {name:'푸드믹서',key:'6',hint:'통째로 던져 묵직한 범위 타격',radius:5.2,power:1.3,cooldown:.7,shake:.8,color:'#ffc6a1',animation:'throw',duration:.78,arc:8},
 homoMixer: {name:'호모믹서',key:'7',hint:'긴 샤프트로 세로로 길게 파괴',radius:3,power:1.1,cooldown:.65,shake:.6,color:'#c6c9f6',animation:'throw',duration:.7,arc:5},
 cosmetics: {name:'화장품 용기',key:'8',hint:'펌프병·크림통·튜브·스포이드병을 번갈아 던지기',radius:2.5,power:.8,cooldown:.28,shake:.25,color:'#f9a8d4',animation:'throw',duration:.6,arc:6},
};
export const CONTAINERS=['펌프병','크림통','튜브','스포이드병'];
export const CONTAINER_COLORS=['#f4afca','#c4a9ef','#f0d492','#9ed9c7'];
const geometry = {
 box: new THREE.BoxGeometry(1,1,1),
 cylinder: new THREE.CylinderGeometry(.5,.5,1,16),
 sphere: new THREE.SphereGeometry(.5,12,8),
};
const materials = new Map();
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:color==='#c9d6d7'?.28:.65,metalness:color==='#c9d6d7'?.65:0}));return materials.get(color);}
function part(group,shape,color,x,y,z,sx,sy,sz){const m=new THREE.Mesh(geometry[shape],material(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;group.add(m);return m;}

// Low-poly props use shared geometry/materials so repeated throws don't allocate GPU resources.
export function createWeaponModel(kind,variant=0){
 const g=new THREE.Group(),steel='#c9d6d7',ink='#33434a',pink='#ef8c7e';
 if(kind==='mallet'){
  part(g,'cylinder','#d0a56e',0,-1.3,0,.42,3.8,.42);
  const head=part(g,'cylinder',ink,0,1,0,1.65,3.3,1.65);head.rotation.z=Math.PI/2;
  for(const x of [-1.7,1.7]){const cap=part(g,'cylinder',pink,x,1,0,1.78,.18,1.78);cap.rotation.z=Math.PI/2;}
 }else if(kind==='foodMixer'){
  part(g,'box',pink,0,-1.4,0,2.4,.9,2);part(g,'cylinder',ink,0,-.8,0,1.6,.4,1.6);
  part(g,'cylinder','#a9d4d5',0,.5,0,1.8,2.4,1.8);part(g,'cylinder',ink,0,1.85,0,2,.3,2);
  part(g,'sphere','#f5d59d',0,.2,0,.7,.7,.7);part(g,'sphere','#e99691',.4,.9,.1,.6,.6,.6);
  part(g,'box',steel,1.2,.5,0,.3,1.7,.3);part(g,'box',steel,.9,1.2,0,.8,.25,.3);part(g,'sphere',ink,0,-1.4,1.03,.4,.4,.2);
 }else if(kind==='homoMixer'){
  part(g,'box','#798aa7',0,2,0,1.9,2.2,1.5);part(g,'box',ink,0,3.2,0,2.2,.25,1.8);
  for(const x of [-.5,0,.5])part(g,'box',ink,x,2,.78,.15,.85,.08);
  part(g,'cylinder',steel,0,-.5,0,.3,3.3,.3);part(g,'cylinder',steel,0,-2.4,0,1.1,.65,1.1);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;part(g,'box',ink,Math.sin(a)*.5,-2.4,Math.cos(a)*.5,.18,.4,.18);}
 }else if(kind==='ethanol'){
  part(g,'cylinder','#bce3e7',0,0,0,1,1.9,1);part(g,'box','#ecf6ea',0,0,.5,.65,.65,.04);
  part(g,'cylinder',ink,0,1.1,0,.4,.5,.4);part(g,'box','#79c3ce',.2,1.4,0,1,.3,.4);
  part(g,'box',ink,.2,1.1,0,.18,.65,.15);
 }else if(kind==='cosmetics'){
  const color=CONTAINER_COLORS[variant%4];
  if(variant%4===1){part(g,'cylinder',color,0,0,0,1.8,1.2,1.8);part(g,'cylinder',steel,0,.7,0,1.9,.3,1.9);}
  else if(variant%4===2){part(g,'box',color,0,0,0,1.2,2,.65);part(g,'box',steel,0,-1.15,0,1,.3,.7);part(g,'box',color,0,1.05,0,1.4,.15,.65);}
  else {part(g,'cylinder',color,0,0,0,1.1,2,1.1);part(g,'cylinder',steel,0,1.15,0,.5,.4,.5);
   if(variant%4===0){part(g,'box',ink,.25,1.5,0,1,.25,.3);part(g,'cylinder',ink,0,1.4,0,.25,.4,.25);}
   else part(g,'sphere',ink,0,1.65,0,.6,.8,.6);
  }
  part(g,'box','#f7f3e7',0,0,variant%4===2?.34:.56,.65,.5,.035);
 }
 return g;
}

export function affectedByWeapon(kind,position,hit,direction){
 const offset=position.clone().sub(hit),config=WEAPONS[kind];
 if(kind==='laser'){const along=offset.dot(direction);return offset.addScaledVector(direction,-along).length()<config.radius;}
 if(kind==='homoMixer')return Math.hypot(offset.x,offset.z)<2.5&&Math.abs(offset.y)<7;
 return offset.length()<config.radius;
}
