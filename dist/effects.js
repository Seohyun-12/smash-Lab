import * as THREE from './vendor/three.module.js';
import { WEAPONS, CONTAINERS, createWeaponModel } from './weapons.js';
const pieceGeo = new THREE.IcosahedronGeometry(0.24, 0);
export function createWeaponEffects({ scene, camera, getParticles, onImpact, toast }) {
  const actions = [];
  const effectMaterials = new Map();
  function effectMaterial(color) {
    if (!effectMaterials.has(color))
      effectMaterials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    return effectMaterials.get(color);
  }
  function burst(hit, color, count = 25, spray = false) {
    const particles = getParticles();
    for (let i = 0; i < count; i++) {
      const p = new THREE.Mesh(pieceGeo, effectMaterial(color));
      p.position.copy(hit);
      p.userData = {
        velocity: new THREE.Vector3(
          Math.random() - 0.5,
          Math.random() * (spray ? 0.35 : 0.8),
          Math.random() - 0.5,
        ).multiplyScalar(spray ? 7 : 14),
        age: 0,
        liquid: spray,
      };
      scene.add(p);
      particles.push(p);
    }
  }
  function beam(hit, direction, color) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        camera.position.clone().add(new THREE.Vector3(0, -3, 0)),
        hit.clone().add(direction.clone().multiplyScalar(24)),
      ]),
      new THREE.LineBasicMaterial({ color }),
    );
    line.userData = { age: 1.6, velocity: new THREE.Vector3(), line: true };
    scene.add(line);
    getParticles().push(line);
  }
  function launch({ kind, hit, direction, floor, variant, buildingId,directBlock }) {
    const config = WEAPONS[kind];
    const model = createWeaponModel(kind, variant);
    scene.add(model);
    const start = camera.position
      .clone()
      .add(new THREE.Vector3(0, -5, 0))
      .addScaledVector(direction, 9);
    if (config.animation === 'swing') start.copy(hit).add(new THREE.Vector3(0, 7, 0));
    if (config.animation === 'spray') {
      start
        .copy(hit)
        .addScaledVector(direction, -9)
        .add(new THREE.Vector3(2, -1, 0));
      model.lookAt(hit);
    }
    model.position.copy(start);
    actions.push({
      model,
      kind,
      variant,
      hit,
      direction,
      floor,
      buildingId,
      directBlock,
      start,
      age: 0,
      impacted: false,
    });
    toast(
      config.animation === 'swing'
        ? '고무망치 내려치는 중!'
        : config.animation === 'spray'
          ? '에탄올 분사 중!'
          : (kind === 'cosmetics' ? CONTAINERS[variant] : config.name) + ' 날아가는 중!',
    );
  }
  function update(dt) {
    const particles = getParticles();
    for (let i = actions.length - 1; i >= 0; i--) {
      const a = actions[i],
        config = WEAPONS[a.kind];
      a.age += dt;
      const t = Math.min(a.age / config.duration, 1);
      if (config.animation === 'swing') {
        const swing = Math.min(t / 0.72, 1);
        a.model.position.copy(a.start).lerp(a.hit, swing * swing);
        a.model.rotation.z = -0.9 * (1 - swing);
        if (swing === 1) {
          a.model.scale.set(1, 1 - 0.2 * Math.sin(((t - 0.72) / 0.28) * Math.PI), 1);
          a.model.position.y += Math.max(0, t - 0.8) * 8;
        }
      } else if (config.animation === 'throw') {
        a.model.position.copy(a.start).lerp(a.hit, t);
        a.model.position.y += Math.sin(t * Math.PI) * config.arc;
        a.model.rotation.set(t * 5.5, t * 3, t * 2);
      } else {
        a.model.position.copy(a.start);
        a.model.rotation.z = Math.sin(t * 20) * 0.08;
        const drops = Math.max(1, Math.round(dt * 75));
        for (let j = 0; j < drops; j++) {
          const p = new THREE.Mesh(pieceGeo, effectMaterial(config.color));
          const progress = Math.random();
          p.position.copy(a.start).lerp(a.hit, progress);
          p.position.add(
            new THREE.Vector3(
              (Math.random() - 0.5) * progress * 3,
              (Math.random() - 0.5) * progress * 3,
              (Math.random() - 0.5) * progress * 3,
            ),
          );
          p.scale.setScalar(0.5);
          p.userData = { age: 1.1, velocity: a.direction.clone().multiplyScalar(20), liquid: true };
          scene.add(p);
          particles.push(p);
        }
      }
      const impactTime =
        config.animation === 'swing' ? 0.72 : config.animation === 'spray' ? 0.6 : 1;
      if (!a.impacted && t >= impactTime) {
        a.impacted = true;
        onImpact(a.kind, a.hit, a.direction, a.floor, a.variant, a.buildingId,a.directBlock);
      }
      if (t === 1) {
        a.model.removeFromParent();
        actions.splice(i, 1);
      }
    }
  }
  function clear() {
    for (const a of actions) a.model.removeFromParent();
    actions.length = 0;
  }
  return { actions, launch, update, clear, burst, beam };
}
