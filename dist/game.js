import * as THREE from './vendor/three.module.js';
import {building as B} from './model.js';
const $=s=>document.querySelector(s), viewport=$('#viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#c6d5c9');scene.fog=new THREE.Fog('#c6d5c9',110,240);
const camera=new THREE.PerspectiveCamera(38,1,.1,350);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){$('#error').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xf5fff0,0x536b61,2.6));
const sun=new THREE.DirectionalLight(0xfff3cf,3);sun.position.set(-35,70,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:160});sun.shadow.bias=-.0005;scene.add(sun);
const mat=(color,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
const concrete=mat('#b7c4ba'), dark=mat('#354f52'), glass=mat('#618b8a',.3), lightGlass=mat('#82a4a0',.35), trim=mat('#d5dbce'), road=mat('#78918a');
const box=new THREE.BoxGeometry(1,1,1), pieceGeo=new THREE.IcosahedronGeometry(.24,0);
function cube(x,y,z,w,h,d,m,parent=scene){const o=new THREE.Mesh(box,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
cube(0,-1,0,95,1.5,75,mat('#a5bca6'));cube(0,-.13,0,39,.6,30,mat('#b7c9b3'));cube(0,.22,0,29,.15,20,mat('#d0d8c6'));
cube(0,-.25,25,110,.3,12,road);cube(-33,-.25,-5,12,.3,70,road);
for(let x=-50;x<55;x+=7)cube(x,-.07,25,3,.025,.15,trim);
for(let z=-37;z<29;z+=7)cube(-33,-.07,z,.15,.025,3,trim);
// Surrounding masses are fictional scenery, kept visually quieter than the target.
for(const [x,z,w,h,d] of [[-26,-24,13,13,13],[5,-30,20,11,11],[29,-17,12,18,16],[34,9,10,8,13]]){
 cube(x,h/2-.5,z,w,h,d,mat('#9eb2a7'));for(let y=2;y<h;y+=2.2)cube(x,y,z+d/2+.02,w-.6,.65,.08,mat('#7f9b94'));
}
const leaf=mat('#648a60'), bark=mat('#6c7964');
for(const [x,z] of [[-20,13],[-13,15],[-4,15],[6,15],[17,15],[21,5],[21,-5],[-21,-8],[-21,3]]){cube(x,1,z,.25,2,.25,bark);const t=new THREE.Mesh(new THREE.IcosahedronGeometry(1.7,1),leaf);t.position.set(x,3,z);t.scale.y=1.3;t.castShadow=true;scene.add(t);}
for(const [x,z] of [[-19,19],[14,20],[24,20]]){cube(x,.5,z,2.5,.8,1.15,mat('#e3d9b7'));cube(x,.95,z,1.3,.5,1.05,dark);}
const target=new THREE.Group();scene.add(target);
let blocks=[],debris=[],particles=[],initialCount=0, destroyed=0,points=0,weapon='hammer',sound=false,audioCtx,shake=0,combo=0,lastHit=0,completed=false;
let yaw=.68,pitch=.5,distance=75;
const center=new THREE.Vector3(0,9,0);
function label(){const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#d9e4d3';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#294b49';ctx.font='bold 59px sans-serif';ctx.textAlign='center';ctx.fillText('INNOVALLEY  /  E',512,85);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;return new THREE.MeshStandardMaterial({map:tx,roughness:.9});}
const signMat=label();
function addBlock(x,y,z,w,h,d,m,floor){const o=cube(x,y,z,w,h,d,m,target);o.userData={alive:true,floor};blocks.push(o);return o;}
function reset(){
 for(const o of [...blocks,...debris,...particles])o.removeFromParent();blocks=[];debris=[];particles=[];destroyed=0;points=0;combo=0;completed=false;
 const width=B.columns*B.cell,depth=B.depth*B.cell;
 for(let f=0;f<B.floors;f++){
  const y=f*B.floorHeight+1.65;
  for(let col=0;col<B.columns;col++)for(const side of [-1,1]){
   const x=(col-(B.columns-1)/2)*B.cell;
   addBlock(x,y,side*depth/2,1.43,1.92,.55,(col%4===0?trim:(col+f)%3===0?lightGlass:glass),f);
  }
  for(let col=0;col<B.depth-1;col++)for(const side of [-1,1])addBlock(side*width/2,y,(col-(B.depth-2)/2)*B.cell,.6,1.92,1.43,col%3===0?trim:glass,f);
  // Breakable floor plates, visible through holes in the façade.
  for(let k=0;k<7;k++)addBlock((k-3)*3,y-1.07,0,2.96,.28,depth+.6,concrete,f);
 }
 addBlock(0,B.floors*B.floorHeight+.5,0,22,.5,12,trim,B.floors-1);
 addBlock(-6,B.floors*B.floorHeight+1.5,-1,4,2,3,dark,B.floors-1);
 addBlock(1,B.floors*B.floorHeight+1.25,-2,3,1.5,3,concrete,B.floors-1);
 addBlock(0,B.floors*B.floorHeight-.6,5.62,11,.95,.15,signMat,B.floors-1);
 initialCount=blocks.length;updateHud();toast('무기를 고르고 건물을 클릭하세요');
}
function updateHud(){const percentage=Math.round(destroyed/initialCount*100);$('#score').textContent=String(points).padStart(5,'0');$('#percent').textContent=percentage+'%';$('#bar').style.width=percentage+'%';if(percentage===100&&!completed){completed=true;toast('100% 파괴 완료! 다시 세우고 한 판 더 ↗');}}
let toastTimer;function toast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(toastTimer);if(!completed)toastTimer=setTimeout(()=>$('#toast').style.opacity=.45,3500);}
function detach(o,origin,power=1){if(!o.userData.alive)return;o.userData.alive=false;destroyed++;points+=10;const dir=o.position.clone().sub(origin).normalize();dir.y=Math.abs(dir.y)+.3;o.userData.velocity=dir.multiplyScalar((3+Math.random()*5)*power);o.userData.spin=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(5);o.userData.age=0;debris.push(o);}
function audio(){if(!sound)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='sawtooth';osc.frequency.setValueAtTime(weapon==='laser'?450:100,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(25,audioCtx.currentTime+.22);g.gain.setValueAtTime(.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.25);osc.connect(g);g.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.27);}catch{sound=false;$('#sound').textContent='소리 사용 불가';}}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
function attack(clientX,clientY){
 const rect=viewport.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
 const hits=ray.intersectObjects(blocks.filter(o=>o.userData.alive));if(!hits.length){if(!completed)toast('E동의 외벽을 클릭해보세요');return;}
 const hit=hits[0].point;let count=0;
 const radius=weapon==='blast'?6.8:weapon==='hammer'?2.8:2;
 for(const o of blocks){if(!o.userData.alive)continue;const affected=weapon==='laser'?ray.ray.distanceToPoint(o.position)<2.2:o.position.distanceTo(hit)<radius;if(affected){detach(o,hit,weapon==='blast'?1.8:1);count++;}}
 // Floors lose support in an arcade cascade once most of their envelope is gone.
 const f=hits[0].object.userData.floor;
 const layer=blocks.filter(o=>o.userData.floor===f);
 if(layer.filter(o=>!o.userData.alive).length/layer.length>.65){for(const o of blocks)if(o.userData.alive&&o.userData.floor>=f){detach(o,hit,.5);count++;}}
 const now=performance.now();combo=now-lastHit<2200?combo+1:1;lastHit=now;points+=Math.min(combo,10)*count;shake=weapon==='blast'?1:.35;
 for(let i=0;i<25;i++){const p=new THREE.Mesh(pieceGeo, i%3===0?trim:concrete);p.position.copy(hit);p.userData={velocity:new THREE.Vector3(Math.random()-.5,Math.random()*.8,Math.random()-.5).multiplyScalar(14),age:0};scene.add(p);particles.push(p);}
 if(weapon==='laser'){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([camera.position.clone().add(new THREE.Vector3(0,-3,0)),hit.clone().add(ray.ray.direction.clone().multiplyScalar(24))]),new THREE.LineBasicMaterial({color:'#f8ff6d'}));line.userData={age:1.6,velocity:new THREE.Vector3(),line:true};scene.add(line);particles.push(line);}
 toast(count>60?'연쇄 붕괴! +'+count+' BLOCKS':combo>1?combo+' COMBO · '+count+'개 파괴':count+'개 블록 파괴!');audio();updateHud();
}
function selectWeapon(w){weapon=w;document.querySelectorAll('.weapon').forEach(b=>{const active=b.dataset.weapon===w;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});toast(({hammer:'해머 · 원하는 곳을 정확하게 타격',blast:'폭탄 · 넓은 범위를 한 번에 파괴',laser:'레이저 · 건물 뒤편까지 관통'})[w]);}
document.querySelectorAll('.weapon').forEach(b=>b.onclick=()=>selectWeapon(b.dataset.weapon));
$('#reset').onclick=reset;$('#home').onclick=()=>{yaw=.68;pitch=.5;distance=75;};$('#zoomIn').onclick=()=>distance=Math.max(38,distance-7);$('#zoomOut').onclick=()=>distance=Math.min(125,distance+7);
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent='소리 '+(sound?'ON':'OFF');$('#sound').setAttribute('aria-pressed',sound);if(sound)audio();};$('#info').onclick=()=>$('#details').showModal();
window.addEventListener('keydown',e=>{if(e.target.closest('button,dialog,input'))return;if(['1','2','3'].includes(e.key))selectWeapon(['hammer','blast','laser'][Number(e.key)-1]);if(e.key.toLowerCase()==='r')reset();});
let drag=null;
viewport.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){yaw-=(e.clientX-drag.lastX)*.007;pitch=THREE.MathUtils.clamp(pitch+(e.clientY-drag.lastY)*.006,.12,1.1);}drag.lastX=e.clientX;drag.lastY=e.clientY;});
viewport.addEventListener('pointerup',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.moved)attack(e.clientX,e.clientY);drag=null;});viewport.addEventListener('pointercancel',()=>drag=null);viewport.addEventListener('lostpointercapture',()=>drag=null);
viewport.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.045,38,125);},{passive:false});
function resize(){const {width,height}=viewport.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();}new ResizeObserver(resize).observe(viewport);
reset();resize();
let prev=performance.now();
function frame(now){const dt=Math.min((now-prev)/1000,.04);prev=now;
 camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance+9,Math.cos(yaw)*Math.cos(pitch)*distance);if(shake>.01){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake*=.86;}camera.lookAt(center);
 for(let i=debris.length-1;i>=0;i--){const o=debris[i],d=o.userData;d.age+=dt;d.velocity.y-=18*dt;o.position.addScaledVector(d.velocity,dt);o.rotation.x+=d.spin.x*dt;o.rotation.z+=d.spin.z*dt;const ground=Math.min(o.scale.x,o.scale.y,o.scale.z)*.5;if(o.position.y<ground){o.position.y=ground;d.velocity.y=Math.abs(d.velocity.y)*.2;d.velocity.x*=.85;d.velocity.z*=.85;d.spin.multiplyScalar(.8);}if(d.age>5)o.scale.multiplyScalar(Math.max(0,1-dt*2));if(d.age>7){o.removeFromParent();debris.splice(i,1);}}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],d=p.userData;d.age+=dt;if(d.age>1.8){p.removeFromParent();if(d.line){p.geometry.dispose();p.material.dispose();}particles.splice(i,1);continue;}d.velocity.y-=10*dt;p.position.addScaledVector(d.velocity,dt);if(!d.line)p.scale.setScalar(1-d.age/1.8);}
 renderer.render(scene,camera);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
