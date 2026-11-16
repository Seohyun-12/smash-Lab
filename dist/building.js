import {glassMaterial} from './architecture.js';
import * as THREE from './vendor/three.module.js';
import { site } from './site.js';

// Static scene construction: ground, roads, scenery and the breakable target building.
// Roads and neighbor buildings come from OpenStreetMap via dist/site.js.

export function mat(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

export const materials = {
  concrete: mat('#b7c4ba'),
  dark: mat('#354f52'),
  glass: glassMaterial('#8baebd'),
  lightGlass: glassMaterial('#a3bdc6'),
  trim: mat('#d5dbce'),
  road: mat('#626b70'),
  leaf: mat('#648a60'),
  bark: mat('#6c7964'),
  car: mat('#e3d9b7'),
  neighbor: mat('#bec3c2'),
  neighborEdge: new THREE.LineBasicMaterial({ color: '#7f9b94' }),
  cycleway: mat('#8fa79a'),
  path: mat('#c8c9c4'),
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
const ROAD_LIFT = {
  primary: 0,
  primary_link: 0.01,
  secondary: 0.02,
  tertiary: 0.03,
  residential: 0.04,
  service: 0.05,
  pedestrian: 0.06,
  footway: 0.07,
  cycleway: 0.08,
};

// Neighbor buildings are extruded from their OSM outlines, kept visually quieter than the target.
function addNeighbor(scene, neighbor) {
  const shape = new THREE.Shape(neighbor.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: neighbor.height - neighbor.base,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, neighbor.base, 0);
  const facade=glassMaterial(neighbor.height>20?'#879eae':'#9db2b9',true);
  const mesh = new THREE.Mesh(geometry, [materials.neighbor,facade]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 20),
    materials.neighborEdge,
  );
  scene.add(edges);
  // Rooftop equipment is illustrative, not surveyed.
  if(neighbor.height>8){const xs=neighbor.outline.map(p=>p[0]),zs=neighbor.outline.map(p=>p[1]);
    const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
    cube(scene,cx,neighbor.height+.8,cz,3,1.6,2,materials.concrete);
  }
}

function addRoad(scene, road) {
  if (road.tunnel) return;
  const half = GROUND_SIZE / 2;
  const y = -0.25 + (ROAD_LIFT[road.kind] ?? 0);
  const surface =
    road.kind === 'cycleway'
      ? materials.cycleway
      : road.kind === 'footway' || road.kind === 'pedestrian'
        ? materials.path
        : materials.road;
  for (let i = 0; i < road.path.length - 1; i++) {
    const [x1, z1] = road.path[i];
    const [x2, z2] = road.path[i + 1];
    if (Math.max(Math.abs(x1), Math.abs(z1)) > half && Math.max(Math.abs(x2), Math.abs(z2)) > half)
      continue;
    const length = Math.hypot(x2 - x1, z2 - z1);
    // Extend each segment by the road width so consecutive segments overlap at bends.
    const segment = cube(
      scene,
      (x1 + x2) / 2,
      y,
      (z1 + z2) / 2,
      length + road.width,
      0.3,
      road.width,
      surface,
    );
    segment.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    segment.castShadow = false;
    if (['primary','primary_link','secondary','tertiary','residential'].includes(road.kind)) {
      const sidewalk=cube(scene,(x1+x2)/2,y-.055,(z1+z2)/2,length+road.width,.18,road.width+1.5,materials.path);
      sidewalk.rotation.y=segment.rotation.y;
      sidewalk.castShadow=false;
      const dx=(x2-x1)/length,dz=(z2-z1)/length;
      if(length>1&&road.width>3)for(let offset=1;offset<length;offset+=4){
        const stripe=cube(scene,x1+dx*offset,y+.16,z1+dz*offset,1.8,.015,.08,materials.trim);
        stripe.rotation.y=segment.rotation.y;stripe.castShadow=false;
      }
    }
  }
}

export function buildScenery(scene) {
  cube(scene, 12, -1, 0, GROUND_SIZE, 1.5, GROUND_SIZE, mat('#a1ae9d'));
  for (const area of site.landAreas) {
    let ring = clipPolygon(area.outline, 0, -GROUND_SIZE / 2, true);
    ring = clipPolygon(ring, 0, GROUND_SIZE / 2, false);
    ring = clipPolygon(ring, 1, -GROUND_SIZE / 2, true);
    ring = clipPolygon(ring, 1, GROUND_SIZE / 2, false);
    if (ring.length < 3) continue;
    const shape = new THREE.Shape(ring.map(([x,z]) => new THREE.Vector2(x,-z)));
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    const surface = new THREE.Mesh(geometry, mat(area.kind === 'water' ? '#7dabb9' : '#809c78'));
    surface.position.y = area.kind === 'water' ? -.22 : -.235;
    surface.receiveShadow = true;
    scene.add(surface);
  }
  cube(scene, 12, -0.13, 0, 66, 0.6, 32, mat('#c2c4bd'));
  for (const road of site.roads) addRoad(scene, road);
  for (const neighbor of site.neighbors) addNeighbor(scene, neighbor);

  // Trees and parked cars are decorative, placed outside both map footprints.
  const crown = new THREE.IcosahedronGeometry(1.7, 1);
  for (const x of [-17, -8, 2, 12, 22, 33, 43]) {
    cube(scene, x, 1, 14, 0.25, 2, 0.25, materials.bark);
    const tree = new THREE.Mesh(crown, materials.leaf);
    tree.position.set(x, 3, 14);
    tree.scale.y = 1.3;
    tree.castShadow = true;
    scene.add(tree);
  }
  for (const x of [-10, 8, 28]) {
    cube(scene, x, 0.5, -14, 2.5, 0.8, 1.15, materials.car);
    cube(scene, x, 0.95, -14, 1.3, 0.5, 1.05, materials.dark);
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
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 });
}

// Clip the footprint into independently breakable floor tiles, preserving slanted edges.
function clipPolygon(points, axis, bound, keepGreater) {
  const result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    const insideA = keepGreater ? a[axis] >= bound : a[axis] <= bound;
    const insideB = keepGreater ? b[axis] >= bound : b[axis] <= bound;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (bound - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

const prismCache = new Map();
function floorTiles(outline) {
  const key = JSON.stringify(outline);
  if (prismCache.has(key)) return prismCache.get(key);
  const xs = outline.map((p) => p[0]),
    zs = outline.map((p) => p[1]);
  const tiles = [];
  for (let x = Math.min(...xs); x < Math.max(...xs); x += 4.5) {
    for (let z = Math.min(...zs); z < Math.max(...zs); z += 4.5) {
      let ring = clipPolygon(outline, 0, x, true);
      ring = clipPolygon(ring, 0, x + 4.5, false);
      ring = clipPolygon(ring, 1, z, true);
      ring = clipPolygon(ring, 1, z + 4.5, false);
      if (ring.length < 3) continue;
      const area =
        Math.abs(
          ring.reduce((sum, p, i) => {
            const q = ring[(i + 1) % ring.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2;
      if (area < 0.05) continue;
      const cx = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
      const cz = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
      const shape = new THREE.Shape(ring.map(([px, pz]) => new THREE.Vector2(px - cx, -pz + cz)));
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, -0.5, 0);
      tiles.push({ x: cx, z: cz, geometry });
    }
  }
  prismCache.set(key, tiles);
  return tiles;
}

// Keep each piece's position in the site frame so hit tests, fragments and both targets agree.
export function buildTarget(B, addBlock, signMaterial) {
  const tiles = floorTiles(B.outline);
  const meta = { buildingId: B.id };
  for (let floor = 0; floor < B.floors; floor++) {
    const y = 0.5 + (floor + 0.5) * B.floorHeight;
    for (let edge = 0; edge < B.outline.length; edge++) {
      const a = B.outline[edge],
        b = B.outline[(edge + 1) % B.outline.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz);
      const panels = Math.max(1, Math.ceil(length / 1.8));
      const panelWidth = length / panels;
      for (let i = 0; i < panels; i++) {
        const t = (i + 0.5) / panels;
        const material =
          floor === 0
            ? materials.dark
            : (i + floor) % 4 === 0
              ? materials.lightGlass
              : materials.glass;
        const mesh = addBlock(
          a[0] + dx * t,
          y,
          a[1] + dz * t,
          panelWidth - 0.025,
          B.floorHeight - 0.16,
          0.32,
          material,
          floor,
          meta,
        );
        mesh.rotation.y = -Math.atan2(dz, dx);
      }
    }
    for (const tile of tiles)
      addBlock(tile.x, 0.5 + floor * B.floorHeight, tile.z, 1, 0.22, 1, materials.concrete, floor, {
        ...meta,
        geometry: tile.geometry,
      });
  }
  for (const tile of tiles)
    addBlock(tile.x, B.height + 0.5, tile.z, 1, 0.32, 1, materials.trim, B.floors - 1, {
      ...meta,
      geometry: tile.geometry,
    });
  // Top and end trims are segmented so the full outline remains destructible.
  for (let edge = 0; edge < B.outline.length; edge++) {
    const a = B.outline[edge],
      b = B.outline[(edge + 1) % B.outline.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      count = Math.max(1, Math.ceil(length / 3));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const mesh = addBlock(
        a[0] + dx * t,
        B.height + 0.75,
        a[1] + dz * t,
        length / count,
        0.42,
        0.55,
        materials.trim,
        B.floors - 1,
        meta,
      );
      mesh.rotation.y = -Math.atan2(dz, dx);
    }
  }
  const frontZ = Math.max(...B.outline.map((p) => p[1]));
  addBlock(
    B.center[0],
    3.5,
    frontZ + 0.3,
    Math.min(10, B.footprintMeters[0] * site.scale * 0.7),
    1.2,
    0.2,
    signMaterial,
    1,
    meta,
  );
}
