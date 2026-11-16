import * as THREE from './vendor/three.module.js';

const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
const equipment = new THREE.MeshStandardMaterial({
  color: '#c4c9c7',
  metalness: 0.5,
  roughness: 0.5,
});
const fan = new THREE.MeshStandardMaterial({ color: '#39494b', metalness: 0.6, roughness: 0.4 });
const garden = new THREE.MeshStandardMaterial({ color: '#75896a', roughness: 1 });
const greenGlass = new THREE.MeshPhysicalMaterial({
  color: '#51786d',
  roughness: 0.2,
  metalness: 0.3,
  clearcoat: 1,
});

function bounds(building) {
  const xs = building.outline.map((p) => p[0]),
    zs = building.outline.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
}

export function roofOpening(building) {
  if (building.exterior?.roof.type !== 'cooling-courtyard') return null;
  const b = bounds(building),
    cx = b.minX + b.width * 0.4,
    cz = b.minZ + b.depth * 0.42;
  return {
    minX: cx - b.width * 0.18,
    maxX: cx + b.width * 0.18,
    minZ: cz - b.depth * 0.14,
    maxZ: cz + b.depth * 0.14,
    minFloor: building.floors - 4,
  };
}

export function addRoofDetails(building, addBlock, materials) {
  const b = bounds(building),
    top = building.height + 0.5,
    floor = building.floors - 1;
  function piece(x, y, z, w, h, d, material, role = 'roof-equipment', details = {}) {
    return addBlock(x, y, z, w, h, d, material, floor, {
      buildingId: building.id,
      role,
      ...details,
    });
  }
  function unit(x, z, w = 2, h = 1, d = 2, role = 'roof-equipment') {
    piece(x, top + h / 2, z, w, h, d, equipment, role);
    piece(x, top + h + 0.04, z, w * 0.65, 0.08, d * 0.65, fan, role);
  }
  if (building.exterior?.roof.type === 'equipment-garden') {
    for (let i = 0; i < 6; i++)
      unit(b.minX + 2 + ((b.width - 4) * i) / 5, b.maxZ - 1.8, 2, 1.05, 1.7, 'roof-equipment-row');
    for (let i = 0; i < 5; i++)
      for (const z of [-2.4, 1.3])
        unit(b.minX + 2 + i * 2.1, z, 1.5, 0.9, 2.4, 'roof-equipment-array');
    piece(
      b.minX + b.width * 0.78,
      top + 0.04,
      0,
      b.width * 0.34,
      0.06,
      b.depth * 0.58,
      garden,
      'roof-garden',
    );
    piece(b.minX + b.width * 0.72, top + 0.2, 2, 3.15, 0.28, 1.57, materials.dark, 'roof-skylight');
    for (const dz of [-0.82, 0.82])
      piece(
        b.minX + b.width * 0.72,
        top + 0.37,
        2 + dz,
        3.3,
        0.08,
        0.08,
        materials.trim,
        'roof-skylight',
      );
    piece(
      b.minX + b.width * 0.49,
      top + 0.45,
      -0.4,
      0.12,
      0.9,
      b.depth * 0.6,
      equipment,
      'roof-partition',
    );
  } else if (building.exterior?.roof.type === 'cooling-courtyard') {
    for (let i = 0; i < 2; i++) {
      const x = b.minX + b.width * (0.58 + i * 0.24),
        z = b.maxZ - 2.2;
      unit(x, z, 3, 1.2, 3, 'cooling-tower');
      piece(x, top + 1.32, z, 2.5, 0.12, 2.5, fan, 'cooling-fan', { geometry: cylinder });
      for (let blade = 0; blade < 4; blade++) {
        const mesh = piece(x, top + 1.4, z, 0.16, 0.04, 2.3, equipment, 'cooling-fan-blade');
        mesh.rotation.y = (blade * Math.PI) / 4;
      }
    }
    piece(
      b.minX + b.width * 0.72,
      top + 0.3,
      b.minZ + b.depth * 0.25,
      2.4,
      0.5,
      2.2,
      greenGlass,
      'roof-green-skylight',
    );
    const hole = roofOpening(building);
    // Four upper levels open to the sky, with a real lower atrium floor.
    for (let level = hole.minFloor; level < building.floors; level++) {
      const y = 0.5 + (level + 0.5) * building.floorHeight;
      for (const x of [hole.minX, hole.maxX])
        addBlock(
          x,
          y,
          (hole.minZ + hole.maxZ) / 2,
          0.12,
          building.floorHeight,
          hole.maxZ - hole.minZ,
          materials.lightGlass,
          level,
          { buildingId: building.id, role: 'courtyard-wall' },
        );
      for (const z of [hole.minZ, hole.maxZ])
        addBlock(
          (hole.minX + hole.maxX) / 2,
          y,
          z,
          hole.maxX - hole.minX,
          building.floorHeight,
          0.12,
          materials.lightGlass,
          level,
          { buildingId: building.id, role: 'courtyard-wall' },
        );
    }
  }
}
