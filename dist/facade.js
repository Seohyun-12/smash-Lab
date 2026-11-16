import * as THREE from './vendor/three.module.js';
import { claddingMaterial } from './architecture.js';

// Details observed in the published campus photograph. Face assignment, exact window
// counts and dimensions are an illustrative reconstruction, not a verified survey.
export const cladding = claddingMaterial();
const silver = new THREE.MeshStandardMaterial({
  color: '#d5d9d9',
  metalness: 0.65,
  roughness: 0.3,
});
const roundGlass = new THREE.MeshPhysicalMaterial({
  color: '#3d6470',
  metalness: 0.3,
  roughness: 0.12,
  clearcoat: 1,
});
const circle = new THREE.CircleGeometry(1, 32);
const ring = new THREE.TorusGeometry(1, 0.065, 8, 32);

export function photoFace(building) {
  const area = building.outline.reduce((sum, p, i) => {
    const q = building.outline[(i + 1) % building.outline.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  return building.outline
    .map((a, index) => {
      const b = building.outline[(index + 1) % building.outline.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      const outward = area > 0 ? 1 : -1;
      return {
        index,
        a,
        b,
        length,
        ux: dx / length,
        uz: dz / length,
        nx: (outward * dz) / length,
        nz: (-outward * dx) / length,
      };
    })
    .filter((face) => face.length > 8)
    .sort((a, b) => a.nz - b.nz)[0];
}

export function addPhotoDetails(building, addBlock, materials) {
  const face = photoFace(building);
  const rotation = -Math.atan2(face.uz, face.ux);
  const meta = { buildingId: building.id };
  const point = (along, y, out = 0.24) => [
    face.a[0] + face.ux * along + face.nx * out,
    y,
    face.a[1] + face.uz * along + face.nz * out,
  ];
  function piece(
    along,
    y,
    width,
    height,
    depth,
    material,
    floor = building.floors - 1,
    out = 0.24,
    details = {},
  ) {
    const [x, py, z] = point(along, y, out);
    const mesh = addBlock(x, py, z, width, height, depth, material, floor, { ...meta, ...details });
    mesh.rotation.y = rotation;
    return mesh;
  }

  // A segmented metal spine with circular windows mirrors the photo's distinctive motif.
  const spineWidth = building.id === 'E' ? 3.1 : 2.5;
  const spineAt = face.length - spineWidth / 2;
  for (let floor = 0; floor < building.floors; floor++) {
    const y = 0.5 + (floor + 0.5) * building.floorHeight;
    piece(spineAt, y, spineWidth, building.floorHeight - 0.03, 0.28, cladding, floor, 0.38);
    if ([3, 5, 6, 8].includes(floor)) {
      const radius = floor === 6 ? 0.38 : 0.5;
      const disk = piece(spineAt, y, radius, radius, 1, roundGlass, floor, 0.56, {
        geometry: circle,
        role: 'porthole',
      });
      disk.rotation.y = Math.atan2(face.nx, face.nz);
      const rim = piece(spineAt, y, radius, radius, radius, silver, floor, 0.575, {
        geometry: ring,
        role: 'porthole-rim',
      });
      rim.rotation.y = disk.rotation.y;
    }
  }

  // White side frames and rounded top corners, split into destructible segments.
  const radius = 1.25;
  const top = building.height + 0.75;
  for (const along of [0.12, face.length - 0.12]) {
    for (let floor = 0; floor < building.floors; floor++) {
      const bottom = 0.5 + floor * building.floorHeight;
      const height = Math.min(building.floorHeight, top - radius - bottom);
      if (height > 0)
        piece(along, bottom + height / 2, 0.34, height, 0.72, materials.trim, floor, 0.31);
    }
  }
  for (const left of [true, false]) {
    const cx = left ? radius : face.length - radius;
    for (let i = 0; i < 8; i++) {
      const thetaA = left ? Math.PI - (i * Math.PI) / 16 : Math.PI / 2 - (i * Math.PI) / 16;
      const thetaB = thetaA - Math.PI / 16;
      const a = [cx + radius * Math.cos(thetaA), top - radius + radius * Math.sin(thetaA)];
      const b = [cx + radius * Math.cos(thetaB), top - radius + radius * Math.sin(thetaB)];
      const mesh = piece(
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        Math.hypot(b[0] - a[0], b[1] - a[1]) + 0.03,
        0.34,
        0.72,
        materials.trim,
      );
      mesh.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  const horizontal = face.length - radius * 2;
  const segments = Math.ceil(horizontal / 3);
  for (let i = 0; i < segments; i++)
    piece(
      radius + ((i + 0.5) * horizontal) / segments,
      top,
      horizontal / segments + 0.02,
      0.34,
      0.72,
      materials.trim,
    );

  // Reconstructed glazed entrance and canopy, kept inside the building's damage system.
  const entry = face.length * 0.45;
  for (const delta of [-1.05, 0, 1.05]) {
    piece(entry + delta, 1.85, 1, 2.5, 0.12, materials.glass, 0, 0.55);
    piece(entry + delta - 0.5, 1.85, 0.06, 2.5, 0.2, silver, 0, 0.65);
  }
  piece(entry, 3.3, 5.2, 0.16, 2.9, silver, 1, 1.4);
  for (const delta of [-2.35, 2.35]) piece(entry + delta, 1.85, 0.1, 2.8, 0.1, silver, 0, 2.55);
  return face.index;
}
