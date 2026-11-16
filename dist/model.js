import { site } from './site.js';

// OSM defines both masses in a shared local frame. Façade details remain simplified.
export const buildings = site.targets.map((target) => ({
  ...target,
  floors: target.levels,
  floorHeight: target.height / target.levels,
  verifiedExterior: false,
  address: '경기 성남시 분당구 판교로 255',
}));

export const building = buildings[0];
