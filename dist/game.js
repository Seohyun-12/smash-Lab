import { parkFacingYaw, parkOverview } from './view.js';
import { buildBridge, releaseUnsupportedBridge } from './bridge.js';
import { createUI, bindControls } from './ui.js';
import { createGameScene } from './scene.js';
import { createWeaponEffects } from './effects.js';
import { stepDebris, stepParticles } from './physics.js';
import * as THREE from './vendor/three.module.js';
import { buildings } from './model.js';
import { mat, materials, cube, buildScenery, buildTarget, createSignMaterial } from './building.js';
import { WEAPONS, CONTAINERS, CONTAINER_COLORS, affectedByWeapon } from './weapons.js';
const viewport = document.querySelector('#viewport');
const ui = createUI();
const { scene, camera, renderer } = createGameScene(viewport);
buildScenery(scene);
const target = new THREE.Group();
scene.add(target);
let blocks = [],
  debris = [],
  particles = [],
  initialCount = 0,
  destroyed = 0,
  points = 0,
  weapon = 'mallet',
  sound = false,
  audioCtx,
  shake = 0,
  combo = 0,
  lastHit = 0,
  completed = false;
let nextAttack = 0,
  containerIndex = 0;
let yaw = parkFacingYaw,
  pitch = 0.5,
  distance = 112;
const center = new THREE.Vector3(13, 10, 0);
let cameraView = 'all';
let cameraMode = 'orbit';
const signMaterials = new Map(
  buildings.map((b) => [
    b.id,
    createSignMaterial(b.exterior.signs[0].text, {
      subtitle: b.exterior.signs[0].subtitle,
      transparent: true,
    }),
  ]),
);
function addBlock(x, y, z, w, h, d, m, floor, details = {}) {
  const o = cube(target, x, y, z, w, h, d, m);
  const { geometry, ...metadata } = details;
  if (geometry) o.geometry = geometry;
  o.userData = { ...metadata, alive: true, floor };
  blocks.push(o);
  return o;
}
function reset() {
  effects.clear();
  nextAttack = 0;
  containerIndex = 0;
  lastHit = 0;
  shake = 0;
  for (const o of [...blocks, ...debris, ...particles]) {
    o.removeFromParent();
    if (o.userData.line) {
      o.geometry.dispose();
      o.material.dispose();
    }
  }
  blocks = [];
  debris = [];
  particles = [];
  destroyed = 0;
  points = 0;
  combo = 0;
  completed = false;
  for (const building of buildings) buildTarget(building, addBlock, signMaterials.get(building.id));
  buildBridge(buildings, addBlock, materials);
  initialCount = blocks.length;
  updateHud();
  toast('무기를 고르고 건물을 클릭하세요');
}
function updateHud() {
  const percentage =
    destroyed === initialCount ? 100 : Math.min(99, Math.round((destroyed / initialCount) * 100));
  ui.renderScore(points, percentage);
  for (const building of buildings) {
    const pieces = blocks.filter((b) => b.userData.buildingId === building.id);
    const broken = pieces.filter((b) => !b.userData.alive).length;
    const value =
      broken === pieces.length ? 100 : Math.min(99, Math.round((broken / pieces.length) * 100));
    ui.renderBuilding(building.id, value);
  }
  if (destroyed === initialCount && !completed) {
    completed = true;
    toast('100% 파괴 완료! 다시 세우고 한 판 더 ↗');
  }
}
function toast(message) {
  ui.toast(message, completed);
}
function detach(o, origin, power = 1) {
  if (!o.userData.alive) return;
  o.userData.alive = false;
  destroyed++;
  points += 10;
  const dir = o.position.clone().sub(origin).normalize();
  dir.y = Math.abs(dir.y) + 0.3;
  o.userData.velocity = dir.multiplyScalar((3 + Math.random() * 5) * power);
  o.userData.spin = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5,
  ).multiplyScalar(5);
  o.userData.age = 0;
  debris.push(o);
}
function audio(kind = weapon) {
  if (!sound) return;
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    const osc = audioCtx.createOscillator(),
      g = audioCtx.createGain();
    osc.type = kind === 'mallet' ? 'sine' : kind === 'ethanol' ? 'triangle' : 'sawtooth';
    osc.frequency.setValueAtTime(
      kind === 'ethanol' ? 750 : kind === 'mallet' ? 150 : 100,
      audioCtx.currentTime,
    );
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'ethanol' ? 200 : 25,
      audioCtx.currentTime + 0.22,
    );
    g.gain.setValueAtTime(0.08, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.27);
  } catch {
    sound = false;
    ui.renderSound(false, true);
  }
}
const ray = new THREE.Raycaster(),
  pointer = new THREE.Vector2();
const effects = createWeaponEffects({
  scene,
  camera,
  getParticles: () => particles,
  onImpact: impact,
  toast,
});
const actions = effects.actions;
function impact(kind, hit, direction, floor, variant = 0, buildingId, directBlock) {
  const config = WEAPONS[kind];
  let count = 0;
  for (const o of blocks) {
    if (
      o.userData.alive &&
      (o === directBlock || affectedByWeapon(kind, o.position, hit, direction))
    ) {
      detach(o, hit, config.power);
      if (kind === 'mallet') o.userData.velocity.y = -9;
      count++;
    }
  }
  if (!count) return;
  // The spray has a gentle arcade wash-away effect; it doesn't ignite or trigger a collapse.
  const layer = blocks.filter(
    (o) =>
      o.userData.buildingId === buildingId &&
      o.userData.floor === floor &&
      o.userData.role !== 'bridge',
  );
  if (kind !== 'ethanol' && layer.filter((o) => !o.userData.alive).length / layer.length > 0.65) {
    for (const o of blocks)
      if (o.userData.alive && o.userData.buildingId === buildingId && o.userData.floor >= floor) {
        detach(o, hit, 0.5);
        count++;
      }
  }
  count += releaseUnsupportedBridge(blocks, (block) => detach(block, hit, 0.5));
  const now = performance.now();
  combo = now - lastHit < 2200 ? combo + 1 : 1;
  lastHit = now;
  points += Math.min(combo, 10) * count;
  shake = Math.max(shake, config.shake);
  const color = kind === 'cosmetics' ? CONTAINER_COLORS[variant % 4] : config.color;
  effects.burst(
    hit,
    color,
    kind === 'ethanol' ? 42 : 25,
    kind === 'ethanol' || kind === 'cosmetics',
  );
  const name = kind === 'cosmetics' ? CONTAINERS[variant % 4] : config.name;
  toast(
    count > 60
      ? '연쇄 붕괴! +' + count + ' BLOCKS'
      : name + ' · ' + count + '개 파괴' + (combo > 1 ? ' · ' + combo + ' COMBO' : ''),
  );
  audio(kind);
  updateHud();
}
function attack(clientX, clientY) {
  const now = performance.now();
  if (now < nextAttack) return;
  const rect = viewport.getBoundingClientRect();
  pointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    (-(clientY - rect.top) / rect.height) * 2 + 1,
  );
  ray.setFromCamera(pointer, camera);
  const hits = ray.intersectObjects(blocks.filter((o) => o.userData.alive));
  if (!hits.length) {
    if (!completed) toast('E동 또는 F동의 외벽을 클릭해보세요');
    return;
  }
  const kind = weapon,
    config = WEAPONS[kind],
    hit = hits[0].point.clone(),
    direction = ray.ray.direction.clone(),
    floor = hits[0].object.userData.floor,
    buildingId = hits[0].object.userData.buildingId;
  nextAttack = now + config.cooldown * 1000;
  const variant = kind === 'cosmetics' ? containerIndex++ % 4 : 0;
  if (!config.animation) {
    impact(kind, hit, direction, floor, variant, buildingId, hits[0].object);
    return;
  }
  effects.launch({ kind, hit, direction, floor, variant, buildingId, directBlock: hits[0].object });
}

function selectWeapon(w) {
  if (!WEAPONS[w]) return;
  weapon = w;
  ui.renderWeapon(w);
  toast(WEAPONS[w].name + ' · ' + WEAPONS[w].hint);
}
function toggleSound() {
  sound = !sound;
  ui.renderSound(sound);
  if (sound) audio();
}
bindControls({
  viewport,
  attack,
  reset,
  selectWeapon,
  toggleSound,
  home() {
    cameraMode = 'orbit';
    focusBuilding('all');
  },
  focus: focusBuilding,
  mode: setCameraMode,
  zoom(delta) {
    distance = THREE.MathUtils.clamp(distance + delta, 34, 260);
  },
  orbit(dx, dy) {
    yaw -= dx * 0.007;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.006, -0.18, 1.54);
  },
});

function setCameraMode(mode) {
  if (!['orbit', 'street', 'map','road'].includes(mode)) return;
  cameraMode = mode;
  focusBuilding(cameraView);
}
function focusBuilding(id = 'all') {
  cameraView = id;
  const chosen = buildings.find((b) => b.id === id);
  const shown = chosen ? [chosen] : buildings;
  const xs = shown.flatMap((b) => b.outline.map((p) => p[0]));
  const zs = shown.flatMap((b) => b.outline.map((p) => p[1]));
  const width = Math.max(...xs) - Math.min(...xs),
    depth = Math.max(...zs) - Math.min(...zs);
  const height = Math.max(...shown.map((b) => b.height));
  center.set(
    (Math.min(...xs) + Math.max(...xs)) / 2,
    height * 0.45,
    (Math.min(...zs) + Math.max(...zs)) / 2,
  );
  yaw = parkFacingYaw;
  pitch = 0.46;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  distance =
    Math.max((width + depth * 0.35) / (2 * tan * camera.aspect), height / (2 * tan)) * 1.25 +
    depth * 0.65;
  distance = THREE.MathUtils.clamp(distance, 50, 250);
  if (cameraMode === 'map') {
    yaw = 0;
    pitch = 1.54;
    distance = THREE.MathUtils.clamp(
      (Math.max(width / camera.aspect, depth) / (2 * tan)) * 1.45 + height,
      50,
      250,
    );
  } else if(cameraMode==='road'){
    yaw=.18;pitch=.3;
  } else if (cameraMode === 'street') {
    yaw = parkFacingYaw;
    pitch = Math.asin((2.1 - center.y) / distance);
  }
  if (id === 'all' && cameraMode === 'orbit') {
    const overview = parkOverview(camera.aspect, camera.fov);
    center.fromArray(overview.center);
    yaw = overview.yaw;
    pitch = overview.pitch;
    distance = overview.distance;
  }
  ui.renderView(id);
  ui.renderMode(cameraMode);
}
function resize() {
  const { width, height } = viewport.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  focusBuilding(cameraView);
}
new ResizeObserver(resize).observe(viewport);
reset();
resize();
let prev = performance.now();
function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.04);
  prev = now;
  camera.position.set(
    center.x + Math.sin(yaw) * Math.cos(pitch) * distance,
    Math.sin(pitch) * distance + center.y,
    center.z + Math.cos(yaw) * Math.cos(pitch) * distance,
  );
  if (shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= 0.86;
  }
  camera.lookAt(center);
  effects.update(dt);
  stepDebris(debris, dt);
  stepParticles(particles, dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
