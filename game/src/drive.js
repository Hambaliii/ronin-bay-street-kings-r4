// Getting into and out of cars, plus the arcade driving itself
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated } from './player.js';
import { spawnSmokeAt, damageVehicle } from './cars.js';
import { loadHeroAsset } from './assets.js';
import { rnd, rr, pick } from './random.js';
// How roaming traffic obeys traffic lights
// The traffic updater sits in another module and cannot be called
// from here, so a hook registers once on the updater list, which the main
// loop runs ahead of traffic each frame, and pre brakes by scaling
// cruise speed while the traffic updater applies its own obstacle
// clamp, easing cars to a stop before the crossing edge, and green
// brings back the original cruise value
const CROSSING_HALF = 15;
function runLightCompliance(G) {
  if (!G.traffic || typeof G.lightState !== 'function') return;
  const halfSpan = CROSSING_HALF;
  G.traffic.forEach((trafficCar) => {
    if (trafficCar.driver !== 'traffic' || trafficCar.cruise == null) return;
    if (trafficCar._cruiseOrig == null) trafficCar._cruiseOrig = trafficCar.cruise;
    let effectiveCruise = trafficCar._cruiseOrig;
    const axisName = trafficCar.onX ? 'z' : 'x';
    const lightPhase = G.lightState(axisName);
    if (lightPhase === 'red' || lightPhase === 'yellow') {
      const stopLines = trafficCar.onX ? G.roadZ : G.roadX;
      const posAlong = trafficCar.onX ? trafficCar.z : trafficCar.x;
      const headingComp = trafficCar.onX ? Math.cos(trafficCar.angle) : Math.sin(trafficCar.angle);
      const travelSign = headingComp !== 0 ? Math.sign(headingComp) : (trafficCar.dirSign || 1);
      (stopLines || []).forEach((linePos) => {
        const gapToEdge = travelSign * (linePos - posAlong) - halfSpan;
        if (gapToEdge > 0 && !(gapToEdge > 14)) {
          if (lightPhase === 'red' || gapToEdge > 6) effectiveCruise = Math.min(effectiveCruise, trafficCar._cruiseOrig * Math.min(1, Math.max(0, gapToEdge - 2) / 12)); } });
    }
    trafficCar.cruise = effectiveCruise; }); }
function registerLightHook(G) {
  if (!G || G._lightHook || !Array.isArray(G.updaters)) return; G._lightHook = true;
  G.updaters.push((stateIn) => { try { runLightCompliance(stateIn); } catch (err) {} }); }
// Scooter traffic and parked props form their own small agent set
// The scooter model, with rider baked in, becomes weaving traffic plus
// parked props with riders waiting, and a failed load spawns nothing
// at all, with no procedural stand in, because it is pure garnish
const SCOOTER_PALETTE = [0xffffff, 0xffd9c9, 0xfff3b0, 0xbfe3ff, 0xe6ccff, 0xffc4c4];
function tintedCloneOf(sourceWrap, tintHex) {
  const cloneRoot = sourceWrap.clone(true);
  cloneRoot.traverse((nodeIn) => {
    if (!nodeIn.isMesh || !nodeIn.material) return;
    const retintOne = (matIn) => { const matClone = matIn.clone(); if (matClone.color) matClone.color.setHex(tintHex); return matClone; };
    nodeIn.material = Array.isArray(nodeIn.material) ? nodeIn.material.map(retintOne) : retintOne(nodeIn.material); });
  return cloneRoot; }
function rerollScooterRoute(G, scooter) {
  scooter.onX = rnd() < 0.5;
  scooter.line = pick(scooter.onX ? G.roadX : G.roadZ);
  scooter.dirSign = rnd() < 0.5 ? 1 : -1;
  scooter.along = rr(-600, 600);
  scooter.travel = 0; }
function advanceScooters(G, dtIn) {
  if (!G._vespas || !dtIn) return;
  const elapsedNow = G.elapsed || 0;
  G._vespas.forEach((scooter) => {
    scooter.travel += scooter.speed * dtIn;
    scooter.along += (scooter.speed * dtIn) * scooter.dirSign;
    if (scooter.travel > 500 || Math.abs(scooter.along) > 655) rerollScooterRoute(G, scooter);
    const weaveOffset = Math.sin(elapsedNow * 0.9 + scooter.weavePhase) * 0.8;
    const headingWobble = Math.cos(elapsedNow * 0.9 + scooter.weavePhase) * 0.06;
    let headingBase;
    if (scooter.onX) {
      scooter.x = (scooter.line + scooter.dirSign * 5) + weaveOffset; scooter.z = scooter.along;
      headingBase = scooter.dirSign > 0 ? 0 : Math.PI;
    } else { scooter.x = scooter.along; scooter.z = (scooter.line - scooter.dirSign * 5) + weaveOffset;
      headingBase = scooter.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2; }
    scooter.angle = headingBase + headingWobble;
    scooter.group.position.set(scooter.x, groundH(scooter.x, scooter.z) + 0.02, scooter.z);
    scooter.group.rotation.y = scooter.angle; }); }
const SCOOTER_PARKED_SPOTS = [
  { x: -405, z: 448,
    angle: 0.7, tint: 1 },
  { x: 330, z: 470,
    angle: -Math.PI / 2, tint: 3 },
  { x: 155, z: -145,
    angle: 2.35, tint: 5 } ];
export function initVespas(G) {
  if (!G || G._vespasInit || !Array.isArray(G.updaters)) return;
  G._vespasInit = true;
  G._vespas = [];
  G.updaters.push((stateIn, dtIn) => { try { advanceScooters(stateIn, dtIn); } catch (err) {} });
  initSportbikes(G); loadHeroAsset('npcVespa').then((wrapIn) => { try {
      if (!wrapIn) return;
      for (let idx = 0; idx < 4; idx++) {
        const scooterGroup = tintedCloneOf(wrapIn, SCOOTER_PALETTE[idx % SCOOTER_PALETTE.length]);
        G.scene.add(scooterGroup);
        const scooter = { group: scooterGroup, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, weavePhase: rr(0, 2 * Math.PI), speed: rr(11, 15) };
        rerollScooterRoute(G, scooter);
        scooterGroup.position.set(scooter.onX ? scooter.line + scooter.dirSign * 5 : scooter.along, 0, scooter.onX ? scooter.along : scooter.line - scooter.dirSign * 5);
        scooterGroup.position.y = groundH(scooterGroup.position.x, scooterGroup.position.z) + 0.02;
        G._vespas.push(scooter); } G._parkedVespas = [];
      SCOOTER_PARKED_SPOTS.forEach((spotDef) => {
        const parkedGroup = tintedCloneOf(wrapIn, SCOOTER_PALETTE[spotDef.tint % SCOOTER_PALETTE.length]);
        parkedGroup.position.set(spotDef.x, groundH(spotDef.x, spotDef.z) + 0.02, spotDef.z);
        parkedGroup.rotation.y = spotDef.angle;
        G.scene.add(parkedGroup);
        G._parkedVespas.push(parkedGroup); });
    } catch (err) { /* garnish only */ }
  }).catch(() => {}); }
// Sportbike traffic runs with the scooters, sharing road lane and
// respawn conventions plus the same clone tint helper and hook style
// They ride straight along roads and respawn instead of turning at
// crossings, so the weave is their cornering and the lean banks in
// Garnish only again, so a null load spawns nothing
const BIKE_PALETTE = [0xffffff, 0xdfe8ff, 0xffe3f2, 0xe8ffe3];
function bikeAssemblyOf(sourceWrap, tintHex) {
  const outerGroup = new THREE.Group();
  const innerGroup = new THREE.Group();
  innerGroup.rotation.y = -Math.PI / 2;
  innerGroup.add(tintedCloneOf(sourceWrap, tintHex));
  outerGroup.add(innerGroup);
  outerGroup.userData.inner = innerGroup;
  return outerGroup; }
function advanceBikes(G, dtIn) {
  if (!G._sportbikes || !dtIn) return;
  const elapsedNow = G.elapsed || 0;
  G._sportbikes.forEach((bike) => {
    bike.travel += bike.speed * dtIn;
    bike.along += (bike.speed * dtIn) * bike.dirSign;
    if (bike.travel > 500 || Math.abs(bike.along) > 655) rerollScooterRoute(G, bike);
    const weavePhaseNow = elapsedNow * 1.7 + bike.weavePhase;
    const lateralOffset = Math.sin(weavePhaseNow) * 1.1;
    const lateralRate = Math.cos(weavePhaseNow) * 1.1 * 1.7;
    const headingWobble = Math.cos(weavePhaseNow) * 0.06;
    let headingBase;
    if (bike.onX) {
      bike.x = (bike.line + bike.dirSign * 5) + lateralOffset; bike.z = bike.along;
      headingBase = bike.dirSign > 0 ? 0 : Math.PI;
    } else { bike.x = bike.along; bike.z = (bike.line - bike.dirSign * 5) + lateralOffset;
      headingBase = bike.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2; }
    bike.angle = headingBase + headingWobble;
    bike.group.position.set(bike.x, groundH(bike.x, bike.z) + 0.02, bike.z); bike.group.rotation.y = bike.angle;
    if (bike.inner) bike.inner.rotation.z = THREE.MathUtils.clamp(lateralRate * -0.30, -0.38, 0.38); }); }
export function initSportbikes(G) {
  if (!G || G._sportbikesInit || !Array.isArray(G.updaters)) return;
  G._sportbikesInit = true;
  G._sportbikes = [];
  G.updaters.push((stateIn, dtIn) => { try { advanceBikes(stateIn, dtIn); } catch (err) {} });
  loadHeroAsset('npcSportbike').then((wrapIn) => { try {
      if (!wrapIn) return;
      for (let idx = 0; idx < 3; idx++) {
        const bikeGroup = bikeAssemblyOf(wrapIn, BIKE_PALETTE[idx % BIKE_PALETTE.length]);
        G.scene.add(bikeGroup);
        const bike = { group: bikeGroup, inner: bikeGroup.userData.inner, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, weavePhase: rr(0, 2 * Math.PI), speed: rr(19, 26) };
        rerollScooterRoute(G, bike);
        bikeGroup.position.set(bike.onX ? bike.line + bike.dirSign * 5 : bike.along, 0, bike.onX ? bike.along : bike.line - bike.dirSign * 5);
        bikeGroup.position.y = groundH(bikeGroup.position.x, bikeGroup.position.z) + 0.02;
        G._sportbikes.push(bike); }
    } catch (err) { /* garnish only */ }
  }).catch(() => {}); }
// Radio state mirrors onto shared state, so the HUD draws its chip
// without reaching into audio, and the choice survives across drives
const mirrorRadioState = (G, stationIn) => { try {
    const stationPresent = !!stationIn;
    G._radioOff = !stationPresent; G.radioName = stationPresent ? stationIn.name : null;
    if (stationPresent) G._radioIdx = stationIn.index;
  } catch (err) {} };
export function enterCar(G, veh) {
  registerLightHook(G); if (!G.player) return;
  G.player.fig.visible = false;
  if (!veh.driverFig) {
    veh.driverFig = makeFigure(CAST.ren); poseSeated(veh.driverFig);
    veh.driverFig.scale.setScalar(0.96); }
  veh.driverFig.position.set(veh.spec.wid * -0.22, 0.42, 0.15);
  veh.driverFig.rotation.y = 0; veh.mesh.add(veh.driverFig);
  veh.driver = 'player';
  G.car = veh;
  G.flags.inCar = true;
  try { if (G.audio && G.audio.setEngine) G.audio.setEngine(true, 0.07); } catch (err) {}
  try {
    if (G.audio && G.audio.radio && !G._radioOff) mirrorRadioState(G, G.audio.radio.start(G._radioIdx || 0));
    else if (G._radioOff) { G.radioName = null; }
  } catch (err) {} }
export function exitCar(G) { const veh = G.car; if (!veh) return;
  try { if (G._hornActive && G.audio && G.audio.hornStop) G.audio.hornStop(); } catch (err) {} G._hornActive = false; G._hornT = 0; G._hornWasDown = false;
  try { if (G.audio && G.audio.setEngine) G.audio.setEngine(false, 0); } catch (err) {}
  try { if (G.audio && G.audio.screech) G.audio.screech(false, 0); } catch (err) {}
  try { if (G.audio && G.audio.radio) G.audio.radio.stop(); } catch (err) {}
  G.radioName = null; G._radioWasDown = false; if (veh.driverFig) veh.mesh.remove(veh.driverFig);
  veh.driver = 'parked'; veh.speed = 0;
  G.car = null; G.flags.inCar = false;
  G.speedKmh = 0; const pl = G.player;
  pl.x = veh.x + Math.cos(veh.angle) * -(veh.spec.wid / 2 + 1.2);
  pl.z = veh.z + Math.sin(veh.angle) * (veh.spec.wid / 2 + 1.2);
  pl.x = veh.x - Math.cos(veh.angle) * (veh.spec.wid / 2 + 1.1);
  pl.z = veh.z + Math.sin(veh.angle) * (veh.spec.wid / 2 + 1.1);
  pl.angle = veh.angle;
  pl.fig.visible = true;
  pl.fig.position.set(pl.x, groundH(pl.x, pl.z), pl.z); }
export function updateDriving(G, dt) { registerLightHook(G);
  const veh = G.car; if (!veh) return;
  const spec = veh.spec; const keyMap = G.keys;
  const healthBefore = typeof veh.health === 'number' ? veh.health : null;
  // Horn handling: the key map fills from key events in the main
  // module, and this updater only runs in play mode, unpaused, inside a
  // car, so the horn stays inert on foot or in menus
  // The press edge starts the horn and startles pedestrians, once
  // A tap still sounds briefly, holding sustains up to a cap, and
  // releasing past the minimum, or hitting the cap, stops it, while
  // honks stay spaced apart, and holding past the cap never retriggers
  {
    const hornHeld = !!(keyMap && keyMap['KeyH']);
    if (G._hornCooldown == null) G._hornCooldown = 0;
    if (G._hornCooldown > 0) G._hornCooldown -= dt;
    if (hornHeld && !G._hornWasDown && !G._hornActive && !(G._hornCooldown > 0)) {
      try { if (G.audio && G.audio.hornStart) G.audio.hornStart(); else if (G.audio && G.audio.horn) G.audio.horn(0.35); } catch (err) {}
      G._hornActive = true; G._hornT = 0;
      try { if (typeof G.pedsStartle === 'function') G.pedsStartle(veh.x, veh.z, 12); } catch (err) {} }
    if (G._hornActive) { G._hornT = (G._hornT || 0) + dt;
      if (G._hornT >= 1.2 || (!hornHeld && G._hornT >= 0.18)) {
        try { if (G.audio && G.audio.hornStop) G.audio.hornStop(); } catch (err) {}
        G._hornActive = false; G._hornT = 0; G._hornCooldown = 0.25; } }
    G._hornWasDown = hornHeld; }
  // Radio handling: keydown edge only, so auto repeat never cycles,
  // and inert on foot because this updater is car only
  // The cycle runs through the stations then off, and the mirror
  // helper keeps the choice ready for the next drive
  {
    const radioHeld = !!(keyMap && keyMap['KeyR']);
    if (radioHeld && !G._radioWasDown) {
      try { if (G.audio && G.audio.radio) mirrorRadioState(G, G.audio.radio.next()); } catch (err) {} }
    G._radioWasDown = radioHeld; }
  // A battered car loses pace: for this frame only, the effective top
  // speed and acceleration scale down, while the spec itself is never
  // mutated, and the clamp below reads the scaled top speed
  const batteredFactor = typeof veh.health === 'number' && veh.health < 35 ? 0.72 : 1;
  const effectiveTop = batteredFactor * (spec.topSpeed / 3.6);
  const nosHeld = (keyMap['ShiftLeft'] || keyMap['ShiftRight']) && veh.speed > 2;
  let throttleIn = 0;
  if (keyMap['KeyW'] || keyMap['ArrowUp']) throttleIn = 1;
  if (keyMap['KeyS'] || keyMap['ArrowDown']) throttleIn = veh.speed > 0.5 ? -1.6 : -0.55;
  const accelRate = batteredFactor * ((spec.accel * 16) + 6);
  if (throttleIn > 0) veh.speed += accelRate * dt * (nosHeld ? 1.8 : 1) * (1 - Math.max(0, veh.speed) / (effectiveTop * (nosHeld ? 1.15 : 1)));
  else if (throttleIn < 0) veh.speed += throttleIn * 10 * dt;
  else veh.speed = veh.speed - veh.speed * 0.35 * dt;
  veh.speed = veh.speed - veh.speed * 0.12 * dt;
  const reverseCap = -9;
  const clampedSpeed = Math.min(effectiveTop * 1.18, veh.speed);
  veh.speed = Math.max(reverseCap, clampedSpeed);
  if (Math.abs(veh.speed) < 0.02 && throttleIn === 0) veh.speed = 0;
  let steerIn = 0;
  if (keyMap['KeyA'] || keyMap['ArrowLeft']) steerIn = 1;
  if (keyMap['KeyD'] || keyMap['ArrowRight']) steerIn = -1;
  const handbrakeHeld = !!keyMap['Space'];
  const speedFactor = Math.min(1, Math.abs(veh.speed) / 8 + 0.25);
  const steerRate = speedFactor * (spec.grip * 1.15 + (handbrakeHeld ? spec.drift * 0.9 : 0));
  if (veh.speed !== 0) veh.angle += steerIn * steerRate * dt * Math.sign(veh.speed) * (handbrakeHeld ? 1.25 : 1);
  veh.steerVis += ((steerIn * 0.45) - veh.steerVis) * Math.min(1, dt * 10);
  if (handbrakeHeld) veh.speed -= veh.speed * 1.1 * dt;
  if (nosHeld) { const exhaustX = veh.x - Math.sin(veh.angle) * (spec.len / 2 + 0.3), exhaustZ = veh.z - Math.cos(veh.angle) * (spec.len / 2 + 0.3); spawnSmokeAt(G, { x: exhaustX, y: groundH(veh.x, veh.z) + 0.4, z: exhaustZ }, 1, true); G.flags.nosActive = true; } else G.flags.nosActive = false;
  const wideSlideNow = Math.abs(steerIn) !== 0 && Math.abs(veh.speed) > 12;
  if ((handbrakeHeld && Math.abs(veh.speed) > 5) || wideSlideNow && handbrakeHeld) spawnSmokeAt(G, veh.mesh.position, 1, false);
  const startX = veh.x, startZ = veh.z;
  veh.x += veh.speed * dt * Math.sin(veh.angle); veh.z += veh.speed * dt * Math.cos(veh.angle);
  G.colliders.forEach((collider) => {
    const deltaX = veh.x - collider.x, deltaZ = veh.z - collider.z;
    const penAlongX = collider.hw + 1.6 - Math.abs(deltaX), penAlongZ = collider.hd + 1.6 - Math.abs(deltaZ);
    if (penAlongX > 0 && penAlongZ > 0) {
      if (penAlongZ > penAlongX) veh.x += 0 <= deltaX ? penAlongX : -penAlongX; else veh.z += 0 <= deltaZ ? penAlongZ : -penAlongZ;
      if (Math.abs(veh.speed) > 6) { damageVehicle(G, veh, Math.abs(veh.speed) * 0.7); G.flags.crashTimer = 1; }
      veh.speed *= -0.25; } });
  // Crossing a junction box on red heats the wanted level, and the
  // clamp here matches the one used by the shooting layer
  try {
    if (typeof G.lightState === 'function' && Math.abs(veh.speed) > 6) {
      const junctionKeyOf = (px, pz) => {
        for (const lineX of G.roadX) if (Math.abs(px - lineX) < 12)
          for (const lineZ of G.roadZ) if (Math.abs(pz - lineZ) < 12) return lineX + ',' + lineZ;
        return null; };
      const junctionNow = junctionKeyOf(veh.x, veh.z);
      if (junctionNow && !junctionKeyOf(startX, startZ)) {
        const axisName = Math.abs(Math.cos(veh.angle)) < Math.abs(Math.sin(veh.angle)) ? 'x' : 'z';
        if (G.lightState(axisName) === 'red') {
          const elapsedNow = G.elapsed || 0;
          if (G._lastRedKey !== junctionNow || elapsedNow - (G._lastRedT || -10) > 4) {
            G._lastRedKey = junctionNow; G._lastRedT = elapsedNow;
            G.wanted = Math.min(5, Math.max(0, (G.wanted || 0) + 0.15)); } } } }
  } catch (err) {}
  if (G.traffic) G.traffic.forEach((otherCar) => {
    if (otherCar === veh) return;
    const gapDist = Math.hypot(otherCar.x - veh.x, otherCar.z - veh.z);
    if (gapDist < 2.6 && gapDist > 0.01) {
      const pushAmount = (2.6 - gapDist);
      otherCar.x += ((otherCar.x - veh.x) / gapDist) * pushAmount * 0.6; otherCar.z += ((otherCar.z - veh.z) / gapDist) * pushAmount * 0.6;
      otherCar.speed = veh.speed * 0.4;
      if (Math.abs(veh.speed) > 5) { damageVehicle(G, otherCar, 8); damageVehicle(G, veh, 5); G.flags.crashTimer = 1; }
      veh.speed *= 0.55; } });
  veh.x = Math.max(-656, Math.min(656, veh.x));
  veh.z = Math.max(-656, Math.min(656, veh.z));
  const surfaceY = groundH(veh.x, veh.z);
  veh.mesh.position.set(veh.x, surfaceY + 0.02, veh.z);
  veh.mesh.rotation.set(0, veh.angle, 0);
  veh.mesh.rotateX(THREE.MathUtils.clamp(throttleIn * -0.012, -0.02, 0.02));
  veh.mesh.rotateZ(THREE.MathUtils.clamp(veh.steerVis * Math.abs(veh.speed) * 0.0012, -0.05, 0.05));
  const wheelRadius = veh.mesh.userData.wheelR || 0.33;
  const spinDelta = (veh.speed * dt) / wheelRadius;
  const applyWheelSpin = (wheelObj, steerAngle) => {
    if (!wheelObj) return;
    wheelObj.userData.spin = (wheelObj.userData.spin || 0) + spinDelta;
    wheelObj.rotation.set(wheelObj.userData.spin, steerAngle, 0); };
  applyWheelSpin(veh.wheels.rl, 0); applyWheelSpin(veh.wheels.rr, 0);
  applyWheelSpin(veh.wheels.fl, veh.steerVis); applyWheelSpin(veh.wheels.fr, veh.steerVis);
  G.speedKmh = Math.abs(veh.speed) * 3.6;
  if (veh.mesh.userData.tailMat) veh.mesh.userData.tailMat.emissiveIntensity = (throttleIn < 0 || handbrakeHeld) ? 2.2 : 0.8;
  const nightActive = G.timeOfDay > 18.5 || G.timeOfDay < 5.5;
  if (!veh.spotL) {
    veh.spotL = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
    veh.spotR = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
    veh.mesh.add(veh.spotL); veh.mesh.add(veh.spotR);
    veh.mesh.add(veh.spotL.target); veh.mesh.add(veh.spotR.target);
    veh.spotL.position.set(-0.6, 0.8, spec.len / 2);
    veh.spotR.position.set(0.6, 0.8, spec.len / 2);
    veh.spotL.target.position.set(-1.2, 0, spec.len / 2 + 22);
    veh.spotR.target.position.set(1.2, 0, spec.len / 2 + 22); }
  veh.spotL.intensity = nightActive ? 60 : 0; veh.spotR.intensity = nightActive ? 60 : 0;
  // Vehicle audio per frame: engine load follows speed fraction and
  // throttle, while screech follows drifting or handbrake slides past
  // a speed threshold, with intensity from the slip, and any health
  // drop inside the frame counts as a crash, scaled by damage done
  try {
    if (G.audio) {
      const speedFraction = Math.min(1, Math.abs(veh.speed) / Math.max(1, effectiveTop));
      const loadAmount = throttleIn > 0 ? 0.3 : (throttleIn < 0 ? 0.12 : 0);
      if (G.audio.setEngine) G.audio.setEngine(true, Math.max(0.07, Math.min(1, speedFraction * 0.85 + loadAmount)));
      if (G.audio.screech) {
        const slidingNow = (handbrakeHeld || !!G.flags.drifting) && Math.abs(veh.speed) > 8;
        const slipAmount = Math.min(1, Math.abs(veh.steerVis || 0) * 1.4 + (handbrakeHeld ? 0.45 : 0.15) + speedFraction * 0.25);
        G.audio.screech(slidingNow, slidingNow ? slipAmount : 0); }
      if (G.audio.crash && healthBefore != null && typeof veh.health === 'number' && veh.health < healthBefore) {
        const elapsedNow = G.elapsed || 0;
        if (elapsedNow - (G._lastCrashSfxT || -10) > 0.12) {
          G._lastCrashSfxT = elapsedNow;
          G.audio.crash(Math.min(1, (healthBefore - veh.health) / 15)); } } }
  } catch (err) {}
  // Driver health from impacts: every collision path in this frame
  // funnels through car health, so the frame delta measures impact,
  // and a large enough delta hurts the driver as well
  if (healthBefore != null && typeof veh.health === 'number') {
    const healthLoss = healthBefore - veh.health;
    if (healthLoss > 7) { try { G.damagePlayer?.((healthLoss - 6) * 1.6); } catch (err) {} } }
  if (Math.abs(veh.x) >= 655 || Math.abs(veh.z) >= 655) { try { G.damagePlayer?.(dt * 18); } catch (err) {} }
  G.camTarget = { x: veh.x, z: veh.z,
    angle: veh.angle, speed: veh.speed }; }
