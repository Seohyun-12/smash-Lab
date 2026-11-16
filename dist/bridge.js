import * as THREE from './vendor/three.module.js';

const wood = new THREE.MeshStandardMaterial({ color: '#8c7058', roughness: 0.82 });
const steel = new THREE.MeshStandardMaterial({ color: '#aeb9ba', metalness: 0.6, roughness: 0.35 });

function outlineXAtZ(building, z) {
  const xs = [];
  for (let i = 0; i < building.outline.length; i++) {
    const a = building.outline[i],
      b = building.outline[(i + 1) % building.outline.length];
    if (z < Math.min(a[1], b[1]) || z > Math.max(a[1], b[1]) || Math.abs(b[1] - a[1]) < 1e-7)
      continue;
    xs.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
  }
  return xs;
}

export function bridgePlan(buildings) {
  const e = buildings.find((b) => b.id === 'E'),
    f = buildings.find((b) => b.id === 'F');
  if (!e || !f || !e.exterior || !f.exterior) return null;
  const z = 5.5,
    start = Math.max(...outlineXAtZ(e, z)),
    end = Math.min(...outlineXAtZ(f, z));
  const y = Math.min(e.height, f.height) * 0.67 + 0.5;
  return {
    start,
    end,
    z,
    y,
    width: 4.8,
    supportFloors: {
      E: Math.floor((y - 0.5) / e.floorHeight),
      F: Math.floor((y - 0.5) / f.floorHeight),
    },
  };
}

export function buildBridge(buildings, addBlock, materials) {
  const plan = bridgePlan(buildings);
  if (!plan) return;
  const count = 6,
    width = (plan.end - plan.start) / count;
  const meta = { buildingId: 'E', role: 'bridge', supportFloors: plan.supportFloors };
  const floor = plan.supportFloors.E;
  function piece(x, y, z, w, h, d, material) {
    return addBlock(x, y, z, w, h, d, material, floor, meta);
  }
  for (let i = 0; i < count; i++) {
    const x = plan.start + (i + 0.5) * width;
    piece(x, plan.y, plan.z, width + 0.03, 0.22, plan.width, wood);
    piece(x, plan.y + 2.05, plan.z, width + 0.03, 0.16, plan.width, steel);
    for (const side of [-1, 1]) {
      piece(
        x,
        plan.y + 1.05,
        plan.z + (side * plan.width) / 2,
        width - 0.04,
        1.85,
        0.13,
        materials.glass,
      );
      piece(x - width / 2, plan.y + 1.05, plan.z + (side * plan.width) / 2, 0.07, 2, 0.18, steel);
    }
  }
}

export function releaseUnsupportedBridge(blocks, release) {
  const bridge = blocks.filter((b) => b.userData.role === 'bridge' && b.userData.alive);
  if (!bridge.length) return 0;
  const supports = bridge[0].userData.supportFloors;
  const failed = Object.entries(supports).some(([id, floor]) => {
    const anchor = blocks.filter(
      (b) =>
        b.userData.buildingId === id && b.userData.floor === floor && b.userData.role !== 'bridge',
    );
    return (
      anchor.length > 0 && anchor.filter((b) => b.userData.alive).length / anchor.length < 0.35
    );
  });
  if (!failed) return 0;
  for (const block of bridge) release(block);
  return bridge.length;
}
