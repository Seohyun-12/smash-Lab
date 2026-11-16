import { site } from './site.js';
import { buildings } from './model.js';

const park = site.landAreas.find((area) => area.name === '우주공원');
export const parkOutline = park?.outline ?? [];
const boundsCenter = (points) => [
  (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2,
  (Math.min(...points.map((p) => p[1])) + Math.max(...points.map((p) => p[1]))) / 2,
];
const buildingCenter = boundsCenter(buildings.flatMap((building) => building.outline));
const parkCenter = park ? boundsCenter(park.outline) : [buildingCenter[0], -50];
const nearestParkDistance = Math.min(
  ...parkOutline.map(([x, z]) => Math.hypot(x - buildingCenter[0], z - buildingCenter[1])),
);
// Frame the near edge of the park, retaining the buildings as the main subject.
// The full park remains in the scene and can be inspected by zooming out.
export const parkForeground = parkOutline.filter(
  ([x, z]) => Math.hypot(x - buildingCenter[0], z - buildingCenter[1]) < nearestParkDistance + 13,
);

// The camera stands on the park side, with the buildings behind the foreground park.
export const parkFacingYaw = Math.atan2(
  parkCenter[0] - buildingCenter[0],
  parkCenter[1] - buildingCenter[1],
);

export function parkOverview(aspect, fov) {
  const points = buildings.flatMap((building) =>
    building.outline.flatMap(([x, z]) => [
      [x, 0, z],
      [x, building.height + 1, z],
    ]),
  );
  points.push(...parkForeground.map(([x, z]) => [x, 0, z]));
  const center = [
    (Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2,
    8,
    (Math.min(...points.map((p) => p[2])) + Math.max(...points.map((p) => p[2]))) / 2,
  ];
  const yaw = parkFacingYaw;
  const pitch = 0.46;
  const tan = Math.tan((fov * Math.PI) / 360);
  let distance = 50;
  for (const point of points) {
    const [x, y, z] = point.map((n, i) => n - center[i]);
    const horizontal = x * Math.cos(yaw) - z * Math.sin(yaw);
    const vertical =
      -x * Math.sin(yaw) * Math.sin(pitch) +
      y * Math.cos(pitch) -
      z * Math.cos(yaw) * Math.sin(pitch);
    const depth =
      x * Math.sin(yaw) * Math.cos(pitch) +
      y * Math.sin(pitch) +
      z * Math.cos(yaw) * Math.cos(pitch);
    distance = Math.max(
      distance,
      depth + Math.max(Math.abs(horizontal) / (tan * aspect), Math.abs(vertical) / tan) * 1.12,
    );
  }
  return { center, yaw, pitch, distance };
}
