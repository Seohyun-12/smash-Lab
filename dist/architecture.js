import * as THREE from './vendor/three.module.js';
import { RGBELoader } from './vendor/RGBELoader.js';

// Procedural materials, not copied street-view images. Pattern details are illustrative.
const glassCache = new Map();
function windowTexture(color, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  // Keep the base restrained: photographed HDR lighting supplies the reflection.
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#1d3541';
  ctx.globalAlpha = 0.3;
  ctx.fillRect(6, 7, 116, 242);
  ctx.fillStyle = '#cbd2cd';
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 18; i++) ctx.fillRect(8, 20 + i * 4, 111, 1);
  ctx.fillStyle = '#162e37';
  ctx.globalAlpha = 0.4;
  ctx.fillRect(8, 190, 110, 54);
  ctx.fillStyle = options.frameColor ?? '#263c48';
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, 3, 256);
  ctx.fillRect(125, 0, 3, 256);
  ctx.fillRect(0, 0, 128, 5);
  ctx.fillRect(0, 249, 128, 7);
  ctx.fillRect(0, 85, 128, 2);
  ctx.fillRect(0, 170, 128, 2);
  ctx.fillRect(0, 191, 128, 3);
  ctx.fillRect(63, 0, 2, 256);
  ctx.fillStyle = '#bac9ce';
  ctx.fillRect(3, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function glassMaterial(color, tiled = false, options = {}) {
  const key = JSON.stringify([color, tiled, options]);
  if (glassCache.has(key)) return glassCache.get(key);
  const texture = windowTexture(color, options);
  if (tiled) texture.repeat.set(0.55, 0.42);
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    color: '#a8c3ca',
    roughness: 0.16,
    metalness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.15,
  });
  glassCache.set(key, material);
  return material;
}

export function claddingMaterial() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d2d4d3';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#b7bdbe';
  for (let y = 0; y < 256; y += 32) ctx.fillRect(0, y, 256, 1);
  ctx.fillRect(0, 0, 1, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: '#dfdfdc',
    metalness: 0.35,
    roughness: 0.42,
  });
}

export function loadPhotographicSky(scene, renderer) {
  // The CPU-only test renderer has no GPU texture support.
  if (!renderer.isWebGLRenderer) return;
  scene.userData.environmentStatus = 'loading';
  new RGBELoader().load(
    new URL('./assets/cloudy-sky-1k.hdr', import.meta.url).href,
    (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      const fallback = scene.background;
      scene.background = texture;
      scene.environment = texture;
      scene.backgroundBlurriness = 0.025;
      scene.backgroundIntensity = 0.8;
      scene.environmentIntensity = 0.75;
      scene.userData.environmentStatus = 'photographic';
      fallback?.dispose();
    },
    undefined,
    () => {
      scene.userData.environmentStatus = 'fallback';
    },
  );
}

export function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#739dbe');
  gradient.addColorStop(0.48, '#dbe5ec');
  gradient.addColorStop(0.55, '#d1d7d5');
  gradient.addColorStop(1, '#74857d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
