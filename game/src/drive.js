// drive.js — enter/exit + arcade driving
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated } from './player.js';
import { spawnSmokeAt, damageVehicle } from './cars.js';
import { loadHeroAsset } from './assets.js';
import { rnd, rr, pick } from './random.js';

// ---- S16 traffic-light compliance for NPC traffic ----
// drive.js cannot edit cars.js' updateTraffic, so this hook registers once
// on G.updaters (which main.js runs BEFORE updateTraffic each frame). It
// pre-brakes by scaling each traffic car's cruise speed: updateTraffic then
// applies its own obstacle-braking clamp (max -8*dt toward target speed) to
// ease the car to a stop 2 m before the intersection edge. On green the
// original cruise is restored and normal logic resumes.
function updateTrafficLights(G) {
  if (!G.traffic || typeof G.lightState !== 'function') return;
  const half = 15; // CFG.roadW / 2 — intersection box half-extent
  for (const v of G.traffic) {
    if (v.driver !== 'traffic' || v.cruise == null) continue;
    if (v._cruiseOrig == null) v._cruiseOrig = v.cruise;
    let target = v._cruiseOrig;
    const axis = v.onX ? 'z' : 'x'; // onX cars travel along z, and vice versa
    const st = G.lightState(axis);
    if (st === 'red' || st === 'yellow') {
      const crossArr = v.onX ? G.roadZ : G.roadX;
      const along = v.onX ? v.z : v.x;
      const dirRaw = v.onX ? Math.cos(v.angle) : Math.sin(v.angle);
      const dirS = dirRaw !== 0 ? Math.sign(dirRaw) : (v.dirSign || 1);
      for (const c of crossArr || []) {
        const dEdge = (c - along) * dirS - half; // distance to the near edge of the intersection
        if (dEdge > 0 && dEdge <= 14) { // approaching, not yet inside (inside => dEdge <= 0)
          if (st === 'red' || dEdge > 6) target = Math.min(target, v._cruiseOrig * Math.min(1, Math.max(0, dEdge - 2) / 12));
          break;
        }
      }
    }
    v.cruise = target;
  }
}
function ensureLightHook(G) {
  if (!G || G._lightHook || !Array.isArray(G.updaters)) return;
  G._lightHook = true;
  G.updaters.push((G2) => { try { updateTrafficLights(G2); } catch (e) {} });
}
// ---- S20 Vespa traffic + parked props -----------------------------------
// Independent small agent set (not the car traffic class): the npc-vespa
// GLB (scooter with rider baked in, nose +Z) runs as 4 weaving traffic
// scooters plus 3 parked waiting-rider props. Garnish only: if the GLB
// fails to load, loadHeroAsset resolves null and nothing spawns (no
// procedural fallback). Movement hooks G.updaters like the light hook.
const VESPA_TINTS = [0xffffff, 0xffd9c9, 0xfff3b0, 0xbfe3ff, 0xe6ccff, 0xffc4c4];
function makeVespaInstance(wrapper, tintHex) {
  // The cached wrapper is shared — always clone, then clone every material
  // before tinting so the shared template (and other instances) stay mint.
  // material.color multiplies the light mint-teal baked texture.
  const clone = wrapper.clone(true);
  clone.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const tintOne = (m) => { const c = m.clone(); if (c.color) c.color.setHex(tintHex); return c; };
    o.material = Array.isArray(o.material) ? o.material.map(tintOne) : tintOne(o.material);
  });
  return clone;
}
function placeVespaOnRoad(G, s) {
  // Same lane conventions as spawnTraffic/updateTraffic in cars.js:
  // roads on G.roadX run along z (onX), roads on G.roadZ run along x;
  // lane centre is 5 m from the road centre, side chosen by dirSign
  // (onX: x = line + 5*dirSign; cross: z = line - 5*dirSign).
  s.onX = rnd() < 0.5;
  s.line = pick(s.onX ? G.roadX : G.roadZ);
  s.dirSign = rnd() < 0.5 ? 1 : -1;
  s.along = rr(-600, 600);
  s.travel = 0;
}
function updateVespas(G, dt) {
  if (!G._vespas || !dt) return;
  const t = G.elapsed || 0;
  for (const s of G._vespas) {
    s.travel += s.speed * dt;
    s.along += s.dirSign * s.speed * dt;
    // Respawn at a random road after ~500 m travelled or at the map edge.
    if (s.travel > 500 || Math.abs(s.along) > 655) placeVespaOnRoad(G, s);
    const weave = Math.sin(t * 0.9 + s.weavePhase) * 0.8;
    const weaveYaw = Math.cos(t * 0.9 + s.weavePhase) * 0.06;
    let base;
    if (s.onX) {
      s.x = s.line + 5 * s.dirSign + weave; s.z = s.along;
      base = s.dirSign > 0 ? 0 : Math.PI;
    } else {
      s.x = s.along; s.z = s.line - 5 * s.dirSign + weave;
      base = s.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    s.angle = base + weaveYaw;
    s.group.position.set(s.x, groundH(s.x, s.z) + 0.02, s.z);
    s.group.rotation.y = s.angle;
  }
}
const VESPA_PARKED = [
  { x: -405, z: 448, angle: 0.7, tint: 1 },   // HQ apron edge
  { x: 330, z: 470, angle: -Math.PI / 2, tint: 3 }, // port gate
  { x: 155, z: -145, angle: 2.35, tint: 5 },  // downtown corner
];
export function initVespas(G) {
  if (!G || G._vespasInit || !Array.isArray(G.updaters)) return;
  G._vespasInit = true;
  G._vespas = [];
  G.updaters.push((G2, dt) => { try { updateVespas(G2, dt); } catch (e) {} });
  loadHeroAsset('npcVespa').then((wrapper) => {
    try {
      if (!wrapper) return; // garnish only — no fallback, spawn nothing
      for (let i = 0; i < 4; i++) {
        const group = makeVespaInstance(wrapper, VESPA_TINTS[i % VESPA_TINTS.length]);
        G.scene.add(group);
        const s = { group, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, speed: rr(11, 15), weavePhase: rr(0, Math.PI * 2) };
        placeVespaOnRoad(G, s);
        group.position.set(s.onX ? s.line + 5 * s.dirSign : s.along, 0, s.onX ? s.along : s.line - 5 * s.dirSign);
        group.position.y = groundH(group.position.x, group.position.z) + 0.02;
        G._vespas.push(s);
      }
      G._parkedVespas = [];
      for (const p of VESPA_PARKED) {
        const group = makeVespaInstance(wrapper, VESPA_TINTS[p.tint % VESPA_TINTS.length]);
        group.position.set(p.x, groundH(p.x, p.z) + 0.02, p.z);
        group.rotation.y = p.angle;
        G.scene.add(group);
        G._parkedVespas.push(group);
      }
    } catch (e) { /* garnish only — never break the game */ }
  }).catch(() => {});
}
// ---- S24 radio state sync ----------------------------------------------
// Mirrors G.audio.radio.current() onto G so hud.js can draw the chip
// without touching the audio module, and remembers the station / OFF
// choice across drives (G._radioIdx / G._radioOff).
function syncRadio(G, cur) {
  try {
    if (cur) { G._radioIdx = cur.index; G._radioOff = false; G.radioName = cur.name; }
    else { G._radioOff = true; G.radioName = null; }
  } catch (e) {}
}
export function enterCar(G, v) {
  ensureLightHook(G);
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
  // S24: engine on at idle, and the radio resumes the remembered station
  // (station 0 auto-starts on the very first drive; a player-chosen OFF
  // is respected). Radio plays only in the car.
  try { if (G.audio && G.audio.setEngine) G.audio.setEngine(true, 0.07); } catch (e) {}
  try {
    if (G.audio && G.audio.radio && !G._radioOff) {
      syncRadio(G, G.audio.radio.start(G._radioIdx || 0));
    } else if (G._radioOff) { G.radioName = null; }
  } catch (e) {}
}
export function exitCar(G) {
  const v = G.car; if (!v) return;
  // S23: never leave the horn sounding after stepping out.
  try { if (G._hornActive && G.audio && G.audio.hornStop) G.audio.hornStop(); } catch (e) {}
  G._hornActive = false; G._hornT = 0; G._hornWasDown = false;
  // S24: silence engine + screech and stop the radio on exit (the chosen
  // station / OFF state stays remembered on G for the next drive).
  try { if (G.audio && G.audio.setEngine) G.audio.setEngine(false, 0); } catch (e) {}
  try { if (G.audio && G.audio.screech) G.audio.screech(false, 0); } catch (e) {}
  try { if (G.audio && G.audio.radio) G.audio.radio.stop(); } catch (e) {}
  G.radioName = null; G._radioWasDown = false;
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
  ensureLightHook(G);
  const v = G.car; if (!v) return;
  const spec = v.spec; const k = G.keys;
  const healthBefore = (typeof v.health === 'number') ? v.health : null; // S24 crash-delta probe
  // ---- S23 car horn (H) --------------------------------------------------
  // G.keys is filled by main.js' keydown/keyup listeners (e.code), and
  // updateDriving only runs in play mode, unpaused, while in the car —
  // so H on foot / in menus does nothing. Press edge: start the horn and
  // startle peds ONCE. Short honk minimum 0.18 s even on a tap; holding H
  // sustains up to 1.2 s max; release (after the minimum) or the cap stops
  // it via hornStop's 0.08 s release envelope. 0.25 s cooldown between
  // honks; holding past the cap does not retrigger (edge-only).
  {
    const hornDown = !!(k && k['KeyH']);
    if (G._hornCooldown == null) G._hornCooldown = 0;
    if (G._hornCooldown > 0) G._hornCooldown -= dt;
    if (hornDown && !G._hornWasDown && !G._hornActive && G._hornCooldown <= 0) {
      try {
        if (G.audio && G.audio.hornStart) G.audio.hornStart();
        else if (G.audio && G.audio.horn) G.audio.horn(0.35);
      } catch (e) {}
      G._hornActive = true; G._hornT = 0;
      try { if (typeof G.pedsStartle === 'function') G.pedsStartle(v.x, v.z, 12); } catch (e) {}
    }
    if (G._hornActive) {
      G._hornT = (G._hornT || 0) + dt;
      if (G._hornT >= 1.2 || (!hornDown && G._hornT >= 0.18)) {
        try { if (G.audio && G.audio.hornStop) G.audio.hornStop(); } catch (e) {}
        G._hornActive = false; G._hornT = 0; G._hornCooldown = 0.25;
      }
    }
    G._hornWasDown = hornDown;
  }
  // ---- S24 car radio (R) -------------------------------------------------
  // Keydown edge only (no auto-repeat cycling). updateDriving only runs
  // in the car, so R on foot does nothing. Cycles station 0 -> 1 -> 2 ->
  // OFF; the choice is remembered for the next drive via syncRadio.
  {
    const radioDown = !!(k && k['KeyR']);
    if (radioDown && !G._radioWasDown) {
      try {
        if (G.audio && G.audio.radio) syncRadio(G, G.audio.radio.next());
      } catch (e) {}
    }
    G._radioWasDown = radioDown;
  }
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
  // S16: player running a red INTO an intersection box adds wanted heat.
  // weapons.js escalates via its internal addWanted() whose whole effect is
  // this clamp on G.wanted (it is not exported), so apply the same clamp.
  try {
    if (typeof G.lightState === 'function' && Math.abs(v.speed) > 6) {
      const inBox = (x, z) => {
        for (const cx of G.roadX) if (Math.abs(x - cx) < 12) for (const cz of G.roadZ) if (Math.abs(z - cz) < 12) return cx + ',' + cz;
        return null;
      };
      const nowBox = inBox(v.x, v.z);
      if (nowBox && !inBox(prevX, prevZ)) {
        const axis = Math.abs(Math.sin(v.angle)) > Math.abs(Math.cos(v.angle)) ? 'x' : 'z';
        if (G.lightState(axis) === 'red') {
          const now = G.elapsed || 0;
          if (G._lastRedKey !== nowBox || now - (G._lastRedT || -10) > 4) {
            G._lastRedKey = nowBox; G._lastRedT = now;
            G.wanted = Math.min(5, Math.max(0, (G.wanted || 0) + 0.15));
          }
        }
      }
    }
  } catch (e) {}
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
  // ---- S24 vehicle audio (per frame) -------------------------------------
  // Engine: explicit setEngine with speed fraction + throttle load (the
  // audio poll's 300 ms fallback only covers gaps in these calls).
  // Screech: active while drifting or handbrake-sliding above ~29 km/h,
  // intensity from slip (steer demand + handbrake at speed).
  // Crash: a health drop this frame is an impact — thud scaled by the
  // damage increment, 120 ms debounce (audio crashSound debounces too).
  try {
    if (G.audio) {
      const speedFrac = Math.min(1, Math.abs(v.speed) / Math.max(1, topMs));
      const load = accelIn > 0 ? 0.3 : (accelIn < 0 ? 0.12 : 0);
      if (G.audio.setEngine) G.audio.setEngine(true, Math.max(0.07, Math.min(1, speedFrac * 0.85 + load)));
      if (G.audio.screech) {
        const sliding = (handbrake || !!G.flags.drifting) && Math.abs(v.speed) > 8;
        const slip = Math.min(1, Math.abs(v.steerVis || 0) * 1.4 + (handbrake ? 0.45 : 0.15) + speedFrac * 0.25);
        G.audio.screech(sliding, sliding ? slip : 0);
      }
      if (G.audio.crash && healthBefore != null && typeof v.health === 'number' && v.health < healthBefore) {
        const now = G.elapsed || 0;
        if (now - (G._lastCrashSfxT || -10) > 0.12) {
          G._lastCrashSfxT = now;
          G.audio.crash(Math.min(1, (healthBefore - v.health) / 15));
        }
      }
    }
  } catch (e) {}
  // camera handled in main.js via G.car
  G.camTarget = { x: v.x, z: v.z, angle: v.angle, speed: v.speed };
}
