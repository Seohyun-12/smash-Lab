import * as THREE from './vendor/three.module.js';

// Static scene construction: ground, roads, scenery and the breakable target building.

export function mat(color, roughness = .8) {
 return new THREE.MeshStandardMaterial({color, roughness});
}

export const materials = {
 concrete: mat('#b7c4ba'),
 dark: mat('#354f52'),
 glass: mat('#618b8a', .3),
 lightGlass: mat('#82a4a0', .35),
 trim: mat('#d5dbce'),
 road: mat('#78918a'),
 leaf: mat('#648a60'),
 bark: mat('#6c7964'),
 car: mat('#e3d9b7'),
 neighbor: mat('#9eb2a7'),
 neighborBand: mat('#7f9b94'),
};

const box = new THREE.BoxGeometry(1, 1, 1);

export function cube(parent, x, y, z, w, h, d, material) {
 const mesh = new THREE.Mesh(box, material);
 mesh.position.set(x, y, z);
 mesh.scale.set(w, h, d);
 mesh.castShadow = true;
 mesh.receiveShadow = true;
 parent.add(mesh);
 return mesh;
}

export function buildScenery(scene) {
 const m = materials;
 cube(scene, 0, -1, 0, 95, 1.5, 75, mat('#a5bca6'));
 cube(scene, 0, -.13, 0, 39, .6, 30, mat('#b7c9b3'));
 cube(scene, 0, .22, 0, 29, .15, 20, mat('#d0d8c6'));

 cube(scene, 0, -.25, 25, 110, .3, 12, m.road);
 cube(scene, -33, -.25, -5, 12, .3, 70, m.road);
 for (let x = -50; x < 55; x += 7) cube(scene, x, -.07, 25, 3, .025, .15, m.trim);
 for (let z = -37; z < 29; z += 7) cube(scene, -33, -.07, z, .15, .025, 3, m.trim);

 // Surrounding masses are fictional scenery, kept visually quieter than the target.
 for (const [x, z, w, h, d] of [[-26, -24, 13, 13, 13], [5, -30, 20, 11, 11], [29, -17, 12, 18, 16], [34, 9, 10, 8, 13]]) {
  cube(scene, x, h / 2 - .5, z, w, h, d, m.neighbor);
  for (let y = 2; y < h; y += 2.2) cube(scene, x, y, z + d / 2 + .02, w - .6, .65, .08, m.neighborBand);
 }

 const crown = new THREE.IcosahedronGeometry(1.7, 1);
 for (const [x, z] of [[-20, 13], [-13, 15], [-4, 15], [6, 15], [17, 15], [21, 5], [21, -5], [-21, -8], [-21, 3]]) {
  cube(scene, x, 1, z, .25, 2, .25, m.bark);
  const tree = new THREE.Mesh(crown, m.leaf);
  tree.position.set(x, 3, z);
  tree.scale.y = 1.3;
  tree.castShadow = true;
  scene.add(tree);
 }

 for (const [x, z] of [[-19, 19], [14, 20], [24, 20]]) {
  cube(scene, x, .5, z, 2.5, .8, 1.15, m.car);
  cube(scene, x, .95, z, 1.3, .5, 1.05, m.dark);
 }
}

export function createSignMaterial(text = 'INNOVALLEY  /  E') {
 const canvas = document.createElement('canvas');
 canvas.width = 1024;
 canvas.height = 128;
 const ctx = canvas.getContext('2d');
 ctx.fillStyle = '#d9e4d3';
 ctx.fillRect(0, 0, 1024, 128);
 ctx.fillStyle = '#294b49';
 ctx.font = 'bold 59px sans-serif';
 ctx.textAlign = 'center';
 ctx.fillText(text, 512, 85);
 const texture = new THREE.CanvasTexture(canvas);
 texture.colorSpace = THREE.SRGBColorSpace;
 return new THREE.MeshStandardMaterial({map: texture, roughness: .9});
}

// Calls addBlock(x, y, z, w, h, d, material, floor) for every breakable piece.
export function buildTarget(B, addBlock, signMaterial) {
 const {concrete, dark, glass, lightGlass, trim} = materials;
 const width = B.columns * B.cell;
 const depth = B.depth * B.cell;
 const top = B.floors * B.floorHeight;

 for (let f = 0; f < B.floors; f++) {
  const y = f * B.floorHeight + 1.65;

  // Front and back façades.
  for (let col = 0; col < B.columns; col++) {
   for (const side of [-1, 1]) {
    const x = (col - (B.columns - 1) / 2) * B.cell;
    const panel = col % 4 === 0 ? trim : (col + f) % 3 === 0 ? lightGlass : glass;
    addBlock(x, y, side * depth / 2, 1.43, 1.92, .55, panel, f);
   }
  }

  // Side façades.
  for (let col = 0; col < B.depth - 1; col++) {
   for (const side of [-1, 1]) {
    const z = (col - (B.depth - 2) / 2) * B.cell;
    addBlock(side * width / 2, y, z, .6, 1.92, 1.43, col % 3 === 0 ? trim : glass, f);
   }
  }

  // Breakable floor plates, visible through holes in the façade.
  for (let k = 0; k < 7; k++) addBlock((k - 3) * 3, y - 1.07, 0, 2.96, .28, depth + .6, concrete, f);
 }

 const roofFloor = B.floors - 1;
 addBlock(0, top + .5, 0, 22, .5, 12, trim, roofFloor);
 addBlock(-6, top + 1.5, -1, 4, 2, 3, dark, roofFloor);
 addBlock(1, top + 1.25, -2, 3, 1.5, 3, concrete, roofFloor);
 addBlock(0, top - .6, 5.62, 11, .95, .15, signMaterial, roofFloor);
}
