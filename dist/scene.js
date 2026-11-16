import {skyTexture} from './architecture.js';
import * as THREE from './vendor/three.module.js';
export function createGameScene(
  viewport,
  makeRenderer = () =>
    new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }),
) {
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.environment = scene.background;
  scene.fog = new THREE.Fog('#d1dce1', 180, 420);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 550);
  let renderer;
  try {
    renderer = makeRenderer();
  } catch (e) {
    document.querySelector('#error').hidden = false;
    throw e;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  viewport.append(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xe3f1ff, 0x85877d, 1.8));
  const sun = new THREE.DirectionalLight(0xfff5e6, 2.5);
  sun.position.set(-35, 70, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -60,
    right: 60,
    top: 60,
    bottom: -60,
    near: 1,
    far: 160,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  return { scene, camera, renderer };
}
