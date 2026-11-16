import * as THREE from './vendor/three.module.js';
import {site} from './site.js';

// Static scene construction: ground, roads, scenery and the breakable target building.
// Roads and neighbor buildings come from OpenStreetMap via dist/site.js.

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
 neighborEdge: new THREE.LineBasicMaterial({color: '#7f9b94'}),
 cycleway: mat('#8fa79a'),
 path: mat('#c4cfc0'),
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

const GROUND_SIZE = 240;
const ROAD_LIFT = {primary: 0, primary_link: .01, secondary: .02, tertiary: .03, residential: .04, service: .05, pedestrian: .06, footway: .07, cycleway: .08};

// Neighbor buildings are extruded from their OSM outlines, kept visually quieter than the target.
function addNeighbor(scene, neighbor) {
 const shape = new THREE.Shape(neighbor.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
 const geometry = new THREE.ExtrudeGeometry(shape, {depth: neighbor.height - neighbor.base, bevelEnabled: false});
 geometry.rotateX(-Math.PI / 2);
 geometry.translate(0, neighbor.base, 0);
 const mesh = new THREE.Mesh(geometry, materials.neighbor);
 mesh.castShadow = true;
 mesh.receiveShadow = true;
 scene.add(mesh);
 const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), materials.neighborEdge);
 scene.add(edges);
}

function addRoad(scene, road) {
 const half = GROUND_SIZE / 2;
 const y = -.25 + (ROAD_LIFT[road.kind] ?? 0);
 const surface = road.kind === 'cycleway' ? materials.cycleway : road.kind === 'footway' || road.kind === 'pedestrian' ? materials.path : materials.road;
 for (let i = 0; i < road.path.length - 1; i++) {
  const [x1, z1] = road.path[i];
  const [x2, z2] = road.path[i + 1];
  if (Math.max(Math.abs(x1), Math.abs(z1)) > half && Math.max(Math.abs(x2), Math.abs(z2)) > half) continue;
  const length = Math.hypot(x2 - x1, z2 - z1);
  // Extend each segment by the road width so consecutive segments overlap at bends.
  const segment = cube(scene, (x1 + x2) / 2, y, (z1 + z2) / 2, length + road.width, .3, road.width, surface);
  segment.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
  segment.castShadow = false;
 }
}

export function buildScenery(scene, B) {
 const m = materials;
 const width = B.columns * B.cell;
 const depth = B.depth * B.cell;
 cube(scene, 0, -1, 0, GROUND_SIZE, 1.5, GROUND_SIZE, mat('#a5bca6'));
 cube(scene, 0, -.13, 0, width + 18, .6, depth + 19.5, mat('#b7c9b3'));
 cube(scene, 0, .22, 0, width + 8, .15, depth + 9.5, mat('#d0d8c6'));

 for (const road of site.roads) addRoad(scene, road);
 for (const neighbor of site.neighbors) addNeighbor(scene, neighbor);

 // Trees and parked cars are decorative and not taken from map data.
 const crown = new THREE.IcosahedronGeometry(1.7, 1);
 const frontZ = depth / 2 + 5.5;
 for (let x = -width / 2; x <= width / 2 + .1; x += width / 5) {
  cube(scene, x, 1, frontZ, .25, 2, .25, m.bark);
  const tree = new THREE.Mesh(crown, m.leaf);
  tree.position.set(x, 3, frontZ);
  tree.scale.y = 1.3;
  tree.castShadow = true;
  scene.add(tree);
 }

 for (const x of [-width / 2 + 2, 4, width / 2 - 3]) {
  const z = depth / 2 + 10.5;
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
  const plates = Math.round(width / 3);
  const plateWidth = width / plates;
  for (let k = 0; k < plates; k++) addBlock((k - (plates - 1) / 2) * plateWidth, y - 1.07, 0, plateWidth - .04, .28, depth + .6, concrete, f);
 }

 const roofFloor = B.floors - 1;
 addBlock(0, top + .5, 0, width + 1, .5, depth + 1.5, trim, roofFloor);
 addBlock(-6, top + 1.5, -1, 4, 2, 3, dark, roofFloor);
 addBlock(1, top + 1.25, -2, 3, 1.5, 3, concrete, roofFloor);
 addBlock(0, top - .6, depth / 2 + .37, 11, .95, .15, signMaterial, roofFloor);
}
