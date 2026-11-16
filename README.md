# 판교이노밸리 E동 — SMASH LAB

Buildless Three.js single-player destruction prototype. Serve `dist/` via HTTP.

Controls: click/tap to attack; drag to orbit; wheel or +/- buttons to zoom; 1–8 choose a tool; R rebuilds. Sound is opt-in. No backend required.

## Tools

| Key | Tool | Behavior |
| --- | --- | --- |
| 1 | Hammer | Immediate local hit |
| 2 | Bomb | Immediate wide blast |
| 3 | Laser | Immediate beam through the building |
| 4 | Rubber mallet | Animated overhead swing and downward knockback |
| 5 | Ethanol spray | Blue spray and gentle arcade wash-away damage; no ignition |
| 6 | Food mixer | Spinning appliance thrown along an arc, wide impact |
| 7 | Homomixer | Motor, long shaft and rotor head thrown with tall vertical damage |
| 8 | Cosmetic containers | Cycles pump bottle, cream jar, tube, dropper bottle; colored splashes |

Thrown props deal damage on arrival. In-flight props retain their original tool behavior when switching tools. Rebuilding cancels every pending impact. `dist/weapons.js` holds weapon configuration, procedural models and hit shapes. Effects reuse shared GPU resources and expire automatically.

Run logic checks with `node --experimental-default-type=module tests/weapons.test.mjs`. The harness uses real Three.js geometry and raycasting with a stubbed DOM/renderer; visual appearance and actual WebGL/audio still need browser verification.

## Building fidelity and map data

Address 경기 성남시 분당구 판교로 255 confirmed through https://www.activepost.co.kr/introduction/location/ .

Footprint, height and surroundings come from OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0):

- Target: way 684716463 "판교이노밸리클러스터 E동" — ≈57 × 35.5 m, 10 levels, 44 m. `dist/model.js` uses 20 × 12 cells of 1.5 units and 2.3-unit floors (≈0.52 units per meter).
- Neighbor buildings and roads within ~150 m are extruded/drawn from OSM outlines in `dist/site.js`.
- Regenerate with `python3 tools/osm_site.py > dist/site.js` (fetches the OSM API).

Not verified: façade colors, window pattern, roof equipment, sign. Trees and cars are decorative. Google Maps imagery is intentionally not used (its terms forbid extracting imagery or deriving models). Cosmax factory is not implemented in this phase.

## Rendering and physics

Three.js 0.170.0 vendored locally (MIT, license in vendor/THREE-LICENSE.txt). Approximate ballistic debris and arcade floor-collapse rules; no structural engineering simulation. Debris expires in 7 seconds. Resizing and touch rotation are supported. Optional Google Fonts gracefully falls back to system fonts.
