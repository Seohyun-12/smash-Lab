# 판교이노밸리 E동 — SMASH LAB

Buildless Three.js single-player destruction prototype. Serve `dist/` via HTTP.

Controls: click/tap to attack; drag to orbit; wheel or +/- buttons to zoom; 1/2/3 choose hammer, bomb, laser; R rebuilds. Sound is opt-in. No backend required.

## Building fidelity

Address confirmed as 경기 성남시 분당구 판교로 255 through https://www.activepost.co.kr/introduction/location/ . Exterior photos uniquely identifying E have not been verified. The model, its ten floors, dimensions, facade, roof and surrounding masses are provisional gameplay geometry, not an accurate reconstruction. This is disclosed in the UI. Update `dist/model.js` and the model builder in `dist/game.js` after obtaining verified exterior references. Cosmax factory is not implemented in this phase.

## Rendering and physics

Three.js 0.170.0 vendored locally (MIT, license in vendor/THREE-LICENSE.txt). Approximate ballistic debris and arcade floor-collapse rules; no structural engineering simulation. Debris expires in 7 seconds. Resizing and touch rotation are supported. Optional Google Fonts gracefully falls back to system fonts.
