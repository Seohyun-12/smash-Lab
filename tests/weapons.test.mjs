import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import { WEAPONS, createWeaponModel, affectedByWeapon } from '../dist/weapons.js';

// Headless logic harness: real Three.js geometry/raycasting, stub DOM and GPU renderer.
// This does not verify WebGL rendering, CSS, sound playback or browser interaction.
let clock = 10000;
globalThis.__smashTestNow = () => clock;
const elements = new Map();
function el(id) {
  if (!elements.has(id))
    elements.set(id, {
      textContent: '',
      style: {},
      hidden: true,
      dataset: {},
      classList: { toggle() {} },
      setAttribute() {},
      append() {},
      addEventListener() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 1200, height: 650 };
      },
    });
  return elements.get(id);
}
globalThis.document = {
  querySelector: el,
  querySelectorAll: () => [],
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      fillRect() {},
      fillText() {},
      createLinearGradient() {
        return { addColorStop() {} };
      },
    }),
  }),
};
globalThis.window = { addEventListener() {} };
globalThis.devicePixelRatio = 1;
globalThis.ResizeObserver = class {
  observe() {}
};
globalThis.requestAnimationFrame = () => {};
let src = await readFile(new URL('../dist/game.js', import.meta.url), 'utf8');
for (const path of [
  'vendor/three.module.js',
  'model.js',
  'building.js',
  'weapons.js',
  'physics.js',
  'effects.js',
  'scene.js',
  'ui.js',
  'view.js',
])
  src = src.replace(
    JSON.stringify('./' + path).replaceAll('"', "'"),
    JSON.stringify(new URL('../dist/' + path, import.meta.url).href),
  );
src = src.replace(
  'createGameScene(viewport)',
  'createGameScene(viewport,()=>({shadowMap:{},domElement:{},setPixelRatio(){},setSize(){},render(s,c){s.updateMatrixWorld(true);c.updateMatrixWorld(true);}}))',
);
src =
  'const performance={now:()=>globalThis.__smashTestNow()};const setTimeout=()=>0,clearTimeout=()=>{};\n' +
  src;
src +=
  '\nexport {reset,attack,selectWeapon,frame,updateHud,detach,impact,focusBuilding,setCameraMode,blocks,camera}; export const state=()=>({destroyed,points,initialCount,actions:actions.length,debris:debris.length,particles:particles.length,completed,containerIndex});';
const game = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
function advance(seconds) {
  for (let i = 0; i < Math.ceil(seconds / 0.04); i++) {
    clock += 40;
    game.frame(clock);
  }
}
function rebuild() {
  game.reset();
  advance(0.04);
}
function clickTarget() {
  const target = game.blocks.find(
    (o) => o.userData.alive && o.position.z > 5 && o.position.y > 10 && o.position.x > 0,
  );
  assert(target);
  const p = target.position.clone().project(game.camera);
  game.attack((p.x + 1) * 600, (1 - p.y) * 325);
}

test('every additional tool has a finite 3D prop, including all four containers', () => {
  for (const kind of ['mallet', 'ethanol', 'foodMixer', 'homoMixer', 'cosmetics'])
    for (let v = 0; v < (kind === 'cosmetics' ? 4 : 1); v++) {
      const model = createWeaponModel(kind, v);
      assert(model.children.length >= 3, kind);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      assert(Number.isFinite(bounds.max.y));
      assert(bounds.max.y > bounds.min.y);
    }
});
test('five tools damage the target, with delayed impact for animated tools', () => {
  for (const kind of Object.keys(WEAPONS)) {
    rebuild();
    game.selectWeapon(kind);
    clickTarget();
    if (WEAPONS[kind].animation) {
      assert.equal(game.state().destroyed, 0, kind + ' damage must wait');
      assert.equal(game.state().actions, 1);
      advance(1);
      assert.equal(game.state().actions, 0);
    }
    assert(game.state().destroyed > 0, kind + ' should damage');
    assert(game.state().points > 0, kind + ' should score');
  }
});
test('switching tools during flight preserves the thrown object and original damage shape', () => {
  rebuild();
  game.selectWeapon('foodMixer');
  clickTarget();
  game.selectWeapon('ethanol');
  advance(1);
  assert(game.state().destroyed > 0);
  assert.match(el('#toast').textContent, /푸드믹서/);
});
test('reset cancels every pending impact and clears particles, score and cooldown', () => {
  for (const kind of Object.keys(WEAPONS).filter((k) => WEAPONS[k].animation)) {
    rebuild();
    game.selectWeapon(kind);
    clickTarget();
    game.reset();
    advance(1);
    assert.equal(game.state().actions, 0);
    assert.equal(game.state().destroyed, 0);
    assert.equal(game.state().points, 0);
    assert.equal(game.state().particles, 0);
    clickTarget();
    assert.equal(game.state().actions, 1, kind + ' can be used after reset');
  }
});
test('repeated input is rate limited; cosmetics rotate across all four variants', () => {
  rebuild();
  game.selectWeapon('cosmetics');
  clickTarget();
  clickTarget();
  assert.equal(game.state().actions, 1);
  assert.equal(game.state().containerIndex, 1);
  for (let i = 0; i < 3; i++) {
    advance(0.32);
    clickTarget();
  }
  assert.equal(game.state().containerIndex, 4);
  advance(1);
  assert.equal(game.state().actions, 0);
  assert(game.state().destroyed > 0);
  advance(9);
  assert.equal(game.state().debris, 0);
  assert.equal(game.state().particles, 0);
});
test('homomixer cuts vertically; ethanol has a bounded wash radius', () => {
  const origin = new THREE.Vector3(),
    direction = new THREE.Vector3(0, 0, -1);
  assert(affectedByWeapon('homoMixer', new THREE.Vector3(0, 6, 0), origin, direction));
  assert(!affectedByWeapon('homoMixer', new THREE.Vector3(4, 0, 0), origin, direction));
  assert(!affectedByWeapon('ethanol', new THREE.Vector3(0, 6, 0), origin, direction));
});
test('completion requires all blocks, even when the rounded percentage would be 100', () => {
  rebuild();
  for (const b of game.blocks.slice(0, -1)) game.detach(b, new THREE.Vector3());
  game.updateHud();
  assert.equal(game.state().completed, false);
  assert.equal(el('#percent').textContent, '99%');
  game.detach(game.blocks.at(-1), new THREE.Vector3());
  game.updateHud();
  assert.equal(game.state().completed, true);
  assert.equal(el('#percent').textContent, '100%');
});

test('F is an independently destructible target for all five tools', () => {
  for (const kind of Object.keys(WEAPONS)) {
    rebuild();
    game.focusBuilding('F');
    advance(0.04);
    game.selectWeapon(kind);
    const piece = game.blocks.find(
      (b) => b.userData.buildingId === 'F' && b.userData.floor === 4 && b.position.z > 8,
    );
    const point = piece.position.clone().project(game.camera);
    game.attack((point.x + 1) * 600, (1 - point.y) * 325);
    advance(1);
    assert(
      game.blocks.some((b) => b.userData.buildingId === 'F' && !b.userData.alive),
      kind,
    );
    assert(
      game.blocks.filter((b) => b.userData.buildingId === 'E').every((b) => b.userData.alive),
      kind + ' should not reach E from this aim',
    );
  }
  game.focusBuilding('all');
});

test('E support collapse never cascades through the F floor with the same number', () => {
  rebuild();
  const floor = game.blocks.filter((b) => b.userData.buildingId === 'E' && b.userData.floor === 0);
  for (const b of floor.slice(0, -1)) game.detach(b, new THREE.Vector3());
  const hit = floor.at(-1).position.clone();
  game.impact('mallet', hit, new THREE.Vector3(0, 0, -1), 0, 0, 'E');
  assert(game.blocks.filter((b) => b.userData.buildingId === 'E').every((b) => !b.userData.alive));
  assert(game.blocks.filter((b) => b.userData.buildingId === 'F').every((b) => b.userData.alive));
  assert.equal(el('#progressE').textContent, '100%');
  assert.equal(el('#progressF').textContent, '0%');
  assert.equal(game.state().completed, false);
});

test('floor tiles cover the actual E footprint without filling its slanted cutout', async () => {
  rebuild();
  const { buildings } = await import('../dist/model.js');
  for (const building of buildings) {
    const expected =
      Math.abs(
        building.outline.reduce((sum, p, i) => {
          const q = building.outline[(i + 1) % building.outline.length];
          return sum + p[0] * q[1] - q[0] * p[1];
        }, 0),
      ) / 2;
    const tiles = game.blocks.filter(
      (b) =>
        b.userData.buildingId === building.id &&
        b.userData.floor === 0 &&
        b.geometry.type === 'ExtrudeGeometry',
    );
    let area = 0;
    for (const tile of tiles) {
      const positions = tile.geometry.attributes.position,
        normals = tile.geometry.attributes.normal;
      for (let i = 0; i < positions.count; i += 3) {
        if (normals.getY(i) < 0.9) continue;
        const a = new THREE.Vector3().fromBufferAttribute(positions, i),
          b = new THREE.Vector3().fromBufferAttribute(positions, i + 1),
          c = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
        area += b.sub(a).cross(c.sub(a)).length() / 2;
      }
    }
    assert(
      Math.abs(area - expected) < 0.1,
      building.id + ' floor area must match its source polygon',
    );
  }
});

test('map and street cameras keep the same destructible site', () => {
  rebuild();
  const count = game.blocks.length;
  game.setCameraMode('map');
  advance(0.04);
  assert(game.camera.position.y > 70);
  game.setCameraMode('street');
  advance(0.04);
  assert(Math.abs(game.camera.position.y - 2.1) < 0.001);
  game.focusBuilding('F');
  advance(0.04);
  assert(Math.abs(game.camera.position.y - 2.1) < 0.001);
  assert.equal(game.blocks.length, count);
  assert.equal(game.state().destroyed, 0);
  game.setCameraMode('orbit');
  game.focusBuilding('all');
});

test('an exact roof hit breaks a tile even at the corner between tile centers', async () => {
  rebuild();
  game.setCameraMode('map');
  advance(0.04);
  game.selectWeapon('mallet');
  const { buildings } = await import('../dist/model.js');
  const e = buildings[0];
  const x = Math.min(...e.outline.map((p) => p[0])) + 4.5 * 3;
  const z = Math.min(...e.outline.map((p) => p[1])) + 4.5 * 2;
  const point = new THREE.Vector3(x, e.height + 0.67, z).project(game.camera);
  game.attack((point.x + 1) * 600, (1 - point.y) * 325);
  advance(1);
  assert(game.state().destroyed > 0, 'direct ray hit on roof tile must cause damage');
  game.setCameraMode('orbit');
  game.focusBuilding('all');
});

test('only the five requested tools remain with consecutive shortcuts', () => {
  assert.deepEqual(Object.keys(WEAPONS), [
    'mallet',
    'ethanol',
    'foodMixer',
    'homoMixer',
    'cosmetics',
  ]);
  assert.deepEqual(
    Object.values(WEAPONS).map((w) => w.key),
    ['1', '2', '3', '4', '5'],
  );
});

test('home view places Space Park before both buildings on wide and phone screens', async () => {
  const { parkOverview, parkForeground, parkFacingYaw } = await import('../dist/view.js');
  const { buildings } = await import('../dist/model.js');
  for (const aspect of [1200 / 650, 390 / 510]) {
    const view = parkOverview(aspect, 38);
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 550);
    camera.position.set(
      view.center[0] + Math.sin(view.yaw) * Math.cos(view.pitch) * view.distance,
      view.center[1] + Math.sin(view.pitch) * view.distance,
      view.center[2] + Math.cos(view.yaw) * Math.cos(view.pitch) * view.distance,
    );
    camera.lookAt(new THREE.Vector3(...view.center));
    camera.updateMatrixWorld(true);
    const points = [
      ...parkForeground.map(([x, z]) => [x, 0, z]),
      ...buildings.flatMap((b) => b.outline.map(([x, z]) => [x, b.height, z])),
    ];
    for (const point of points) {
      const ndc = new THREE.Vector3(...point).project(camera);
      assert(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, 'park and roofs must fit');
    }
    assert(Math.cos(parkFacingYaw) < 0, 'camera must be on the park side of the buildings');
  }
});

test('photo-inspired circular windows belong to each target and rebuild without residue', () => {
  rebuild();
  const original = game.blocks.length;
  for (const id of ['E', 'F']) {
    const windows = game.blocks.filter(
      (b) => b.userData.buildingId === id && b.userData.role === 'porthole',
    );
    assert.equal(windows.length, 4);
    const window = windows[0];
    game.detach(window, window.position.clone());
    assert.equal(window.userData.alive, false);
  }
  game.reset();
  assert.equal(game.blocks.length, original);
  assert(game.blocks.every((b) => b.userData.alive));
});

test('rounded frames occupy both long faces and circular windows stay on end faces', () => {
  rebuild();
  for (const id of ['E', 'F']) {
    const frames = game.blocks.filter(
      (b) => b.userData.buildingId === id && b.userData.role === 'frame',
    );
    assert.deepEqual([...new Set(frames.map((b) => b.userData.face))].sort(), ['+z', '-z']);
    const windows = game.blocks.filter(
      (b) => b.userData.buildingId === id && b.userData.role === 'porthole',
    );
    assert(windows.every((b) => b.userData.face === '-x'));
    assert(
      frames.some((b) => b.userData.floor < 3),
      'bottom frame must be supported by its real floor',
    );
  }
});

test('matching facade material settings share GPU resources across rebuilds', async () => {
  const { glassMaterial } = await import('../dist/architecture.js');
  const first = glassMaterial('#6f9fb4', false, { frameColor: '#4a4f52' });
  rebuild();
  assert.equal(first, glassMaterial('#6f9fb4', false, { frameColor: '#4a4f52' }));
});

test('projecting glazed boxes and colored strips belong only to the documented road face', () => {
  rebuild();
  const boxes=game.blocks.filter(b=>b.userData.role==='glass-box');
  const accents=game.blocks.filter(b=>b.userData.role==='accent-band');
  assert(boxes.length>0);
  assert.equal(accents.length,3);
  for(const piece of [...boxes,...accents]){
    assert.equal(piece.userData.buildingId,'E');
    assert.equal(piece.userData.face,'+z');
    assert(piece.position.z>9,'the projections must stand in front of the road face');
  }
  const count=game.blocks.length;
  game.detach(boxes[0],boxes[0].position.clone());
  game.reset();
  assert.equal(game.blocks.length,count);
});
