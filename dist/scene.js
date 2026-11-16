import * as THREE from './vendor/three.module.js';
export function createGameScene(viewport, makeRenderer=()=>new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})){
const scene=new THREE.Scene();scene.background=new THREE.Color('#c6d5c9');scene.fog=new THREE.Fog('#c6d5c9',110,240);
const camera=new THREE.PerspectiveCamera(38,1,.1,350);
let renderer;
try{renderer=makeRenderer();}catch(e){document.querySelector('#error').hidden=false;throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xf5fff0,0x536b61,2.6));
const sun=new THREE.DirectionalLight(0xfff3cf,3);sun.position.set(-35,70,25);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:160});sun.shadow.bias=-.0005;scene.add(sun);

return {scene,camera,renderer};
}
