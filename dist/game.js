import * as THREE from './vendor/three.module.js';
import {building as B} from './model.js';
import {mat,cube,buildScenery,buildTarget,createSignMaterial} from './building.js';
import {WEAPONS,CONTAINERS,CONTAINER_COLORS,createWeaponModel,affectedByWeapon} from './weapons.js';
const $=s=>document.querySelector(s), viewport=$('#viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#c6d5c9');scene.fog=new THREE.Fog('#c6d5c9',110,240);
const camera=new THREE.PerspectiveCamera(38,1,.1,350);
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){$('#error').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xf5fff0,0x536b61,2.6));
const sun=new THREE.DirectionalLight(0xfff3cf,3);sun.position.set(-35,70,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:160});sun.shadow.bias=-.0005;scene.add(sun);
const pieceGeo=new THREE.IcosahedronGeometry(.24,0);
buildScenery(scene,B);
const target=new THREE.Group();scene.add(target);
let blocks=[],debris=[],particles=[],initialCount=0, destroyed=0,points=0,weapon='hammer',sound=false,audioCtx,shake=0,combo=0,lastHit=0,completed=false;
let actions=[],nextAttack=0,containerIndex=0;
let yaw=.32,pitch=.5,distance=75;
const center=new THREE.Vector3(0,9,0);
const signMat=createSignMaterial();
function addBlock(x,y,z,w,h,d,m,floor){const o=cube(target,x,y,z,w,h,d,m);o.userData={alive:true,floor};blocks.push(o);return o;}
function reset(){
 for(const a of actions)a.model.removeFromParent();actions=[];nextAttack=0;containerIndex=0;lastHit=0;shake=0;
 for(const o of [...blocks,...debris,...particles]){o.removeFromParent();if(o.userData.line){o.geometry.dispose();o.material.dispose();}}blocks=[];debris=[];particles=[];destroyed=0;points=0;combo=0;completed=false;
 buildTarget(B,addBlock,signMat);
 initialCount=blocks.length;updateHud();toast('무기를 고르고 건물을 클릭하세요');
}
function updateHud(){const percentage=destroyed===initialCount?100:Math.min(99,Math.round(destroyed/initialCount*100));$('#score').textContent=String(points).padStart(5,'0');$('#percent').textContent=percentage+'%';$('#bar').style.width=percentage+'%';if(destroyed===initialCount&&!completed){completed=true;toast('100% 파괴 완료! 다시 세우고 한 판 더 ↗');}}
let toastTimer;function toast(s){$('#toast').textContent=s;$('#toast').style.opacity=1;clearTimeout(toastTimer);if(!completed)toastTimer=setTimeout(()=>$('#toast').style.opacity=.45,3500);}
function detach(o,origin,power=1){if(!o.userData.alive)return;o.userData.alive=false;destroyed++;points+=10;const dir=o.position.clone().sub(origin).normalize();dir.y=Math.abs(dir.y)+.3;o.userData.velocity=dir.multiplyScalar((3+Math.random()*5)*power);o.userData.spin=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(5);o.userData.age=0;debris.push(o);}
function audio(kind=weapon){if(!sound)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();audioCtx.resume();const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type=kind==='mallet'?'sine':kind==='ethanol'?'triangle':'sawtooth';osc.frequency.setValueAtTime(kind==='laser'?450:kind==='ethanol'?750:kind==='mallet'?150:100,audioCtx.currentTime);osc.frequency.exponentialRampToValueAtTime(kind==='ethanol'?200:25,audioCtx.currentTime+.22);g.gain.setValueAtTime(.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.25);osc.connect(g);g.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+.27);}catch{sound=false;$('#sound').textContent='소리 사용 불가';}}
const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();
const effectMaterials=new Map();
function effectMaterial(color){if(!effectMaterials.has(color))effectMaterials.set(color,mat(color));return effectMaterials.get(color);}
function burst(hit,color,count=25,spray=false){for(let i=0;i<count;i++){const p=new THREE.Mesh(pieceGeo,effectMaterial(color));p.position.copy(hit);p.userData={velocity:new THREE.Vector3(Math.random()-.5,Math.random()*(spray?.35:.8),Math.random()-.5).multiplyScalar(spray?7:14),age:0,liquid:spray};scene.add(p);particles.push(p);}}
function impact(kind,hit,direction,floor,variant=0){
 const config=WEAPONS[kind];let count=0;
 for(const o of blocks){if(o.userData.alive&&affectedByWeapon(kind,o.position,hit,direction)){detach(o,hit,config.power);if(kind==='mallet')o.userData.velocity.y=-9;count++;}}
 if(!count)return;
 // The spray has a gentle arcade wash-away effect; it doesn't ignite or trigger a collapse.
 const layer=blocks.filter(o=>o.userData.floor===floor);
 if(kind!=='ethanol'&&layer.filter(o=>!o.userData.alive).length/layer.length>.65){for(const o of blocks)if(o.userData.alive&&o.userData.floor>=floor){detach(o,hit,.5);count++;}}
 const now=performance.now();combo=now-lastHit<2200?combo+1:1;lastHit=now;points+=Math.min(combo,10)*count;shake=Math.max(shake,config.shake);
 const color=kind==='cosmetics'?CONTAINER_COLORS[variant%4]:config.color;
 burst(hit,color,kind==='ethanol'?42:25,kind==='ethanol'||kind==='cosmetics');
 if(kind==='laser'){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([camera.position.clone().add(new THREE.Vector3(0,-3,0)),hit.clone().add(direction.clone().multiplyScalar(24))]),new THREE.LineBasicMaterial({color:config.color}));line.userData={age:1.6,velocity:new THREE.Vector3(),line:true};scene.add(line);particles.push(line);}
 const name=kind==='cosmetics'?CONTAINERS[variant%4]:config.name;
 toast(count>60?'연쇄 붕괴! +'+count+' BLOCKS':name+' · '+count+'개 파괴'+(combo>1?' · '+combo+' COMBO':''));audio(kind);updateHud();
}
function attack(clientX,clientY){
 const now=performance.now();if(now<nextAttack)return;
 const rect=viewport.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
 const hits=ray.intersectObjects(blocks.filter(o=>o.userData.alive));if(!hits.length){if(!completed)toast('E동의 외벽을 클릭해보세요');return;}
 const kind=weapon,config=WEAPONS[kind],hit=hits[0].point.clone(),direction=ray.ray.direction.clone(),floor=hits[0].object.userData.floor;
 nextAttack=now+config.cooldown*1000;
 const variant=kind==='cosmetics'?containerIndex++%4:0;
 if(!config.animation){impact(kind,hit,direction,floor,variant);return;}
 const model=createWeaponModel(kind,variant);scene.add(model);
 const start=camera.position.clone().add(new THREE.Vector3(0,-5,0)).addScaledVector(direction,9);
 if(config.animation==='swing')start.copy(hit).add(new THREE.Vector3(0,7,0));
 if(config.animation==='spray'){start.copy(hit).addScaledVector(direction,-9).add(new THREE.Vector3(2,-1,0));model.lookAt(hit);}
 model.position.copy(start);
 actions.push({model,kind,variant,hit,direction,floor,start,age:0,impacted:false});
 toast(config.animation==='swing'?'고무망치 내려치는 중!':config.animation==='spray'?'에탄올 분사 중!':(kind==='cosmetics'?CONTAINERS[variant]:config.name)+' 날아가는 중!');
}
function updateActions(dt){
 for(let i=actions.length-1;i>=0;i--){const a=actions[i],config=WEAPONS[a.kind];a.age+=dt;const t=Math.min(a.age/config.duration,1);
  if(config.animation==='swing'){const swing=Math.min(t/.72,1);a.model.position.copy(a.start).lerp(a.hit,swing*swing);a.model.rotation.z=-.9*(1-swing);if(swing===1){a.model.scale.set(1,1-.2*Math.sin((t-.72)/.28*Math.PI),1);a.model.position.y+=Math.max(0,t-.8)*8;}}
  else if(config.animation==='throw'){a.model.position.copy(a.start).lerp(a.hit,t);a.model.position.y+=Math.sin(t*Math.PI)*config.arc;a.model.rotation.set(t*5.5,t*3,t*2);}
  else {a.model.position.copy(a.start);a.model.rotation.z=Math.sin(t*20)*.08;const drops=Math.max(1,Math.round(dt*75));for(let j=0;j<drops;j++){const p=new THREE.Mesh(pieceGeo,effectMaterial(config.color));const progress=Math.random();p.position.copy(a.start).lerp(a.hit,progress);p.position.add(new THREE.Vector3((Math.random()-.5)*progress*3,(Math.random()-.5)*progress*3,(Math.random()-.5)*progress*3));p.scale.setScalar(.5);p.userData={age:1.1,velocity:a.direction.clone().multiplyScalar(20),liquid:true};scene.add(p);particles.push(p);}}
  const impactTime=config.animation==='swing'?.72:config.animation==='spray'?.6:1;
  if(!a.impacted&&t>=impactTime){a.impacted=true;impact(a.kind,a.hit,a.direction,a.floor,a.variant);}
  if(t===1){a.model.removeFromParent();actions.splice(i,1);}
 }
}
function selectWeapon(w){if(!WEAPONS[w])return;weapon=w;document.querySelectorAll('.weapon').forEach(b=>{const active=b.dataset.weapon===w;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',active);});$('#weaponHint').textContent=WEAPONS[w].hint;toast(WEAPONS[w].name+' · '+WEAPONS[w].hint);}
document.querySelectorAll('.weapon').forEach(b=>b.onclick=()=>selectWeapon(b.dataset.weapon));
$('#reset').onclick=reset;$('#home').onclick=()=>{yaw=.32;pitch=.5;distance=75;};$('#zoomIn').onclick=()=>distance=Math.max(38,distance-7);$('#zoomOut').onclick=()=>distance=Math.min(125,distance+7);
$('#sound').onclick=()=>{sound=!sound;$('#sound').textContent='소리 '+(sound?'ON':'OFF');$('#sound').setAttribute('aria-pressed',sound);if(sound)audio();};$('#info').onclick=()=>$('#details').showModal();
window.addEventListener('keydown',e=>{if(e.target.closest('button,dialog,input,textarea,select')||e.repeat)return;const chosen=Object.entries(WEAPONS).find(([,v])=>v.key===e.key);if(chosen)selectWeapon(chosen[0]);if(e.key.toLowerCase()==='r')reset();});
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
 updateActions(dt);
 for(let i=debris.length-1;i>=0;i--){const o=debris[i],d=o.userData;d.age+=dt;d.velocity.y-=18*dt;o.position.addScaledVector(d.velocity,dt);o.rotation.x+=d.spin.x*dt;o.rotation.z+=d.spin.z*dt;const ground=Math.min(o.scale.x,o.scale.y,o.scale.z)*.5;if(o.position.y<ground){o.position.y=ground;d.velocity.y=Math.abs(d.velocity.y)*.2;d.velocity.x*=.85;d.velocity.z*=.85;d.spin.multiplyScalar(.8);}if(d.age>5)o.scale.multiplyScalar(Math.max(0,1-dt*2));if(d.age>7){o.removeFromParent();debris.splice(i,1);}}
 for(let i=particles.length-1;i>=0;i--){const p=particles[i],d=p.userData;d.age+=dt;if(d.age>1.8){p.removeFromParent();if(d.line){p.geometry.dispose();p.material.dispose();}particles.splice(i,1);continue;}d.velocity.y-=10*dt;p.position.addScaledVector(d.velocity,dt);if(!d.line)p.scale.setScalar(1-d.age/1.8);}
 renderer.render(scene,camera);requestAnimationFrame(frame);
}requestAnimationFrame(frame);
