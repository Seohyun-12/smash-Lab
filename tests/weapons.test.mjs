import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import {WEAPONS,createWeaponModel,affectedByWeapon} from '../dist/weapons.js';

// Headless logic harness: real Three.js geometry/raycasting, stub DOM and GPU renderer.
// This does not verify WebGL rendering, CSS, sound playback or browser interaction.
let clock=10000;
globalThis.__smashTestNow=()=>clock;
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{textContent:'',style:{},hidden:true,dataset:{},classList:{toggle(){}},setAttribute(){},append(){},addEventListener(){},getBoundingClientRect(){return {left:0,top:0,width:1200,height:650};}});return elements.get(id);}
globalThis.document={querySelector:el,querySelectorAll:()=>[],createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
globalThis.window={addEventListener(){}};
globalThis.devicePixelRatio=1;
globalThis.ResizeObserver=class{observe(){}};
globalThis.requestAnimationFrame=()=>{};
let src=await readFile(new URL('../dist/game.js',import.meta.url),'utf8');
for(const path of ['vendor/three.module.js','model.js','building.js','weapons.js'])src=src.replace(JSON.stringify('./'+path).replaceAll('"',"'"),JSON.stringify(new URL('../dist/'+path,import.meta.url).href));
src=src.replace("new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})","({shadowMap:{},domElement:{},setPixelRatio(){},setSize(){},render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true);}})");
src='const performance={now:()=>globalThis.__smashTestNow()};const setTimeout=()=>0,clearTimeout=()=>{};\n'+src;
src+='\nexport {reset,attack,selectWeapon,frame,updateHud,detach,blocks,camera}; export const state=()=>({destroyed,points,initialCount,actions:actions.length,debris:debris.length,particles:particles.length,completed,containerIndex});';
const game=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
function advance(seconds){for(let i=0;i<Math.ceil(seconds/.04);i++){clock+=40;game.frame(clock);}}
function rebuild(){game.reset();advance(.04);}
function clickTarget(){const target=game.blocks.find(o=>o.userData.alive&&o.position.z>5&&o.position.y>10&&o.position.x>0);assert(target);const p=target.position.clone().project(game.camera);game.attack((p.x+1)*600,(1-p.y)*325);}

test('every additional tool has a finite 3D prop, including all four containers',()=>{
 for(const kind of ['mallet','ethanol','foodMixer','homoMixer','cosmetics'])for(let v=0;v<(kind==='cosmetics'?4:1);v++){
  const model=createWeaponModel(kind,v);assert(model.children.length>=3,kind);model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);assert(Number.isFinite(bounds.max.y));assert(bounds.max.y>bounds.min.y);
 }
});
test('eight tools damage the target, with delayed impact for animated tools',()=>{
 for(const kind of Object.keys(WEAPONS)){
  rebuild();game.selectWeapon(kind);clickTarget();
  if(WEAPONS[kind].animation){assert.equal(game.state().destroyed,0,kind+' damage must wait');assert.equal(game.state().actions,1);advance(1);assert.equal(game.state().actions,0);}
  assert(game.state().destroyed>0,kind+' should damage');assert(game.state().points>0,kind+' should score');
 }
});
test('switching tools during flight preserves the thrown object and original damage shape',()=>{
 rebuild();game.selectWeapon('foodMixer');clickTarget();game.selectWeapon('ethanol');advance(1);
 assert(game.state().destroyed>0);assert.match(el('#toast').textContent,/푸드믹서/);
});
test('reset cancels every pending impact and clears particles, score and cooldown',()=>{
 for(const kind of Object.keys(WEAPONS).filter(k=>WEAPONS[k].animation)){
  rebuild();game.selectWeapon(kind);clickTarget();game.reset();advance(1);
  assert.equal(game.state().actions,0);assert.equal(game.state().destroyed,0);assert.equal(game.state().points,0);assert.equal(game.state().particles,0);
  clickTarget();assert.equal(game.state().actions,1,kind+' can be used after reset');
 }
});
test('repeated input is rate limited; cosmetics rotate across all four variants',()=>{
 rebuild();game.selectWeapon('cosmetics');clickTarget();clickTarget();assert.equal(game.state().actions,1);assert.equal(game.state().containerIndex,1);
 for(let i=0;i<3;i++){advance(.32);clickTarget();}assert.equal(game.state().containerIndex,4);
 advance(1);assert.equal(game.state().actions,0);assert(game.state().destroyed>0);advance(9);assert.equal(game.state().debris,0);assert.equal(game.state().particles,0);
});
test('homomixer cuts vertically; ethanol has a bounded wash radius',()=>{
 const origin=new THREE.Vector3(),direction=new THREE.Vector3(0,0,-1);
 assert(affectedByWeapon('homoMixer',new THREE.Vector3(0,6,0),origin,direction));
 assert(!affectedByWeapon('homoMixer',new THREE.Vector3(4,0,0),origin,direction));
 assert(!affectedByWeapon('ethanol',new THREE.Vector3(0,6,0),origin,direction));
});
test('completion requires all blocks, even when the rounded percentage would be 100',()=>{
 rebuild();for(const b of game.blocks.slice(0,-1))game.detach(b,new THREE.Vector3());game.updateHud();
 assert.equal(game.state().completed,false);assert.equal(el('#percent').textContent,'99%');
 game.detach(game.blocks.at(-1),new THREE.Vector3());game.updateHud();assert.equal(game.state().completed,true);assert.equal(el('#percent').textContent,'100%');
});
