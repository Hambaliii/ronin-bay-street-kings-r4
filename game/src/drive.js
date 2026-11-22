// drive.js — enter/exit + arcade driving
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated } from './player.js';
import { spawnSmokeAt, damageVehicle } from './cars.js';

export function enterCar(G, v) {
  if (!G.player) return;
  G.player.fig.visible = false;
  if (!v.driverFig) {
    v.driverFig = makeFigure(CAST.ren);
    poseSeated(v.driverFig);
    v.driverFig.scale.setScalar(0.96);
  }
  v.driverFig.position.set(-v.spec.wid * 0.22, 0.42, 0.15);
  v.driverFig.rotation.y = 0;
  v.mesh.add(v.driverFig);
  v.driver = 'player';
  G.car = v;
  G.flags.inCar = true;
}
export function exitCar(G) {
  const v = G.car; if (!v) return;
  if (v.driverFig) v.mesh.remove(v.driverFig);
  v.driver = 'parked'; v.speed = 0;
  G.car = null; G.flags.inCar = false; G.speedKmh = 0;
  const p = G.player;
  p.x = v.x + Math.cos(v.angle) * -(v.spec.wid / 2 + 1.2); p.z = v.z + Math.sin(v.angle) * (v.spec.wid / 2 + 1.2);
  // place beside driver door (left side)
  p.x = v.x - Math.cos(v.angle) * (v.spec.wid / 2 + 1.1); p.z = v.z + Math.sin(v.angle) * (v.spec.wid / 2 + 1.1);
  p.angle = v.angle;
  p.fig.visible = true;
  p.fig.position.set(p.x, groundH(p.x, p.z), p.z);
}
export function updateDriving(G, dt) {
  const v = G.car; if (!v) return;
  const spec = v.spec; const k = G.keys;
  const topMs = spec.topSpeed / 3.6;
  const nos = (k['ShiftLeft'] || k['ShiftRight']) && v.speed > 2;
  let accelIn = 0;
  if (k['KeyW'] || k['ArrowUp']) accelIn = 1;
  if (k['KeyS'] || k['ArrowDown']) accelIn = v.speed > 0.5 ? -1.6 : -0.55;
  const accelRate = 6 + spec.accel * 16;
  if (accelIn > 0) v.speed += accelRate * (nos ? 1.8 : 1) * (1 - Math.max(0, v.speed) / (topMs * (nos ? 1.15 : 1))) * dt;
  else if (accelIn < 0) v.speed += accelIn * 10 * dt;
  else v.speed -= v.speed * 0.35 * dt; // drag
  v.speed -= v.speed * 0.12 * dt;
  const revMax = -9;
  v.speed = Math.max(revMax, Math.min(topMs * 1.18, v.speed));
  if (Math.abs(v.speed) < 0.02 && accelIn === 0) v.speed = 0;
  // steering
  let steer = 0;
  if (k['KeyA'] || k['ArrowLeft']) steer = 1;
  if (k['KeyD'] || k['ArrowRight']) steer = -1;
  const handbrake = !!(k['Space']);
  const speedFactor = Math.min(1, Math.abs(v.speed) / 8 + 0.25);
  const steerRate = (1.15 * spec.grip + (handbrake ? spec.drift * 0.9 : 0)) * speedFactor;
  if (v.speed !== 0) v.angle += steer * steerRate * dt * Math.sign(v.speed) * (handbrake ? 1.25 : 1);
  v.steerVis += ((steer * 0.45) - v.steerVis) * Math.min(1, dt * 10);
  if (handbrake) v.speed -= v.speed * 1.1 * dt;
  // NOS flame (smoke system uses seeded rnd in cars.js)
  if (nos) { const bx = v.x - Math.sin(v.angle) * (spec.len / 2 + 0.3), bz = v.z - Math.cos(v.angle) * (spec.len / 2 + 0.3); spawnSmokeAt(G, { x: bx, y: groundH(v.x, v.z) + 0.4, z: bz }, 1, true); G.flags.nosActive = true; } else G.flags.nosActive = false;
  // drift smoke
  const lateral = Math.abs(steer) > 0 && Math.abs(v.speed) > 12;
  if ((handbrake && Math.abs(v.speed) > 5) || lateral && handbrake) spawnSmokeAt(G, v.mesh.position, 1, false);
  // move
  const prevX = v.x, prevZ = v.z;
  v.x += Math.sin(v.angle) * v.speed * dt;
  v.z += Math.cos(v.angle) * v.speed * dt;
  // collider slide (circle r1.6)
  for (const col of G.colliders) {
    const dx = v.x - col.x, dz = v.z - col.z;
    const px = col.hw + 1.6 - Math.abs(dx), pz = col.hd + 1.6 - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) v.x += (dx >= 0 ? px : -px); else v.z += (dz >= 0 ? pz : -pz);
      if (Math.abs(v.speed) > 6) { damageVehicle(G, v, Math.abs(v.speed) * 0.7); G.flags.crashTimer = 1; }
      v.speed *= -0.25;
    }
  }
  void prevX; void prevZ;
  // traffic collision
  if (G.traffic) for (const o of G.traffic) {
    if (o === v) continue;
    const d = Math.hypot(o.x - v.x, o.z - v.z);
    if (d < 2.6 && d > 0.01) {
      const push = (2.6 - d);
      o.x += ((o.x - v.x) / d) * push * 0.6; o.z += ((o.z - v.z) / d) * push * 0.6;
      o.speed = v.speed * 0.4;
      if (Math.abs(v.speed) > 5) { damageVehicle(G, o, 8); damageVehicle(G, v, 5); G.flags.crashTimer = 1; }
      v.speed *= 0.55;
    }
  }
  v.x = Math.max(-656, Math.min(656, v.x)); v.z = Math.max(-656, Math.min(656, v.z));
  const gy = groundH(v.x, v.z);
  v.mesh.position.set(v.x, gy + 0.02, v.z);
  // body roll/pitch visuals
  v.mesh.rotation.set(0, v.angle, 0);
  v.mesh.rotateX(THREE.MathUtils.clamp(-accelIn * 0.012, -0.02, 0.02));
  v.mesh.rotateZ(THREE.MathUtils.clamp(v.steerVis * Math.abs(v.speed) * 0.0012, -0.05, 0.05));
  // wheels
  const wr = v.mesh.userData.wheelR || 0.33;
  const spin = (v.speed * dt) / wr;
  for (const key of ['rl', 'rr']) { const w = v.wheels[key]; if (w) { w.userData.spin = (w.userData.spin || 0) + spin; w.rotation.set(w.userData.spin, 0, 0); } }
  for (const key of ['fl', 'fr']) { const w = v.wheels[key]; if (w) { w.userData.spin = (w.userData.spin || 0) + spin; w.rotation.set(w.userData.spin, v.steerVis, 0); } }
  G.speedKmh = Math.abs(v.speed) * 3.6;
  // brake light boost
  if (v.mesh.userData.tailMat) v.mesh.userData.tailMat.emissiveIntensity = (accelIn < 0 || handbrake) ? 2.2 : 0.8;
  // headlights (player car spotlights)
  const night = G.timeOfDay > 18.5 || G.timeOfDay < 5.5;
  if (!v.spotL) {
    v.spotL = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5); v.spotR = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
    v.mesh.add(v.spotL); v.mesh.add(v.spotR); v.mesh.add(v.spotL.target); v.mesh.add(v.spotR.target);
    v.spotL.position.set(-0.6, 0.8, spec.len / 2); v.spotR.position.set(0.6, 0.8, spec.len / 2);
    v.spotL.target.position.set(-1.2, 0, spec.len / 2 + 22); v.spotR.target.position.set(1.2, 0, spec.len / 2 + 22);
  }
  v.spotL.intensity = night ? 60 : 0; v.spotR.intensity = night ? 60 : 0;
  // camera handled in main.js via G.car
  G.camTarget = { x: v.x, z: v.z, angle: v.angle, speed: v.speed };
}
