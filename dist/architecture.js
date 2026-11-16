import * as THREE from './vendor/three.module.js';

// Procedural materials, not copied street-view images. Pattern details are illustrative.
function windowTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 128, 256);
  sky.addColorStop(0, '#d8e9ef');
  sky.addColorStop(.35, color);
  sky.addColorStop(1, '#426879');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#d8e5e6';
  ctx.globalAlpha = .25;
  for (let i=0;i<9;i++) ctx.fillRect(8, 20+i*5, 111, 2);
  ctx.globalAlpha = .16;
  ctx.fillStyle = '#eef7f8';
  ctx.fillRect(70, 0, 20, 256);
  ctx.fillStyle = '#263c48';
  ctx.globalAlpha = 1;
  ctx.fillRect(0,0,3,256);
  ctx.fillRect(125,0,3,256);
  ctx.fillRect(0,0,128,5);
  ctx.fillRect(0,249,128,7);
  ctx.fillStyle = '#bac9ce';
  ctx.fillRect(3,0,2,256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function glassMaterial(color, tiled = false) {
  const texture = windowTexture(color);
  if (tiled) texture.repeat.set(.55, .42);
  return new THREE.MeshStandardMaterial({
    map:texture, color:'#d8e4e8', roughness:.3, metalness:.3, envMapIntensity:.65,
  });
}

export function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0,0,0,512);
  gradient.addColorStop(0,'#739dbe');
  gradient.addColorStop(.48,'#dbe5ec');
  gradient.addColorStop(.55,'#d1d7d5');
  gradient.addColorStop(1,'#74857d');
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,1024,512);
  const texture=new THREE.CanvasTexture(canvas);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
