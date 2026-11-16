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
    getContext: () => ({ fillRect() {}, fillText() {} }),
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
  '\nexport {reset,attack,selectWeapon,frame,updateHud,detach,impact,focusBuilding,blocks,camera}; export const state=()=>({destroyed,points,initialCount,actions:actions.length,debris:debris.length,particles:particles.length,completed,containerIndex});';
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
test('eight tools damage the target, with delayed impact for animated tools', () => {
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

test('F is an independently destructible target for all eight tools', () => {
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
  game.impact('hammer', hit, new THREE.Vector3(0, 0, -1), 0, 0, 'E');
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
