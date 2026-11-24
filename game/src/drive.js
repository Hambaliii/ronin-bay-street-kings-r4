// Behind the wheel — climbing in, climbing out, arcade handling, signals, horn and radio.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { poseSeated, makeFigure } from './player.js';
import { damageVehicle, spawnSmokeAt } from './cars.js';
import { loadHeroAsset } from './assets.js';
import { pick, rr, rnd } from './random.js';

let STOP_ZONE_HALF;
STOP_ZONE_HALF = 15;

const lampPhaseFor = (ride, gs) => {
  let axisPick;
  if (ride.onX) axisPick = 'z'; else axisPick = 'x';
  return gs.lightState(axisPick);
};

const travelSignFor = (ride) => {
  let slopePart;
  let slopeSign;
  if (ride.onX) slopePart = Math.cos(ride.angle); else slopePart = Math.sin(ride.angle);
  if (0 === slopePart) slopeSign = 0; else slopeSign = Math.sign(slopePart);
  return slopeSign || (ride.dirSign || 1);
};

const weighLineStop = (ride, lampPhase, dirSgn, alongAt, linePos, cellBox) => {
  const gapEdge = dirSgn * (linePos - alongAt) - STOP_ZONE_HALF;
  if (0 >= gapEdge || gapEdge > 14) return;
  if (!('red' === lampPhase || gapEdge > 6)) return;
  const shareSlow = Math.min(1, Math.max(0, (gapEdge - 2) / 12));
  cellBox.value = Math.min(cellBox.value, ride._cruiseOrig * shareSlow);
};

const cruisePastLights = (ride, gs, lampPhase) => {
  const cellBox = {};
  cellBox.value = ride._cruiseOrig;
  let linesArr;
  let alongAt;
  if (ride.onX) linesArr = gs.roadZ; else linesArr = gs.roadX;
  if (ride.onX) alongAt = ride.z; else alongAt = ride.x;
  const dirSgn = travelSignFor(ride);
  const safeLines = linesArr || [];
  for (const linePos of safeLines) weighLineStop(ride, lampPhase, dirSgn, alongAt, linePos, cellBox);
  return cellBox.value;
};

const applyLampsToCar = (ride, gs) => {
  if ('traffic' !== ride.driver || null == ride.cruise) return;
  if (null == ride._cruiseOrig) ride._cruiseOrig = ride.cruise;
  const lampPhase = lampPhaseFor(ride, gs);
  if ('red' === lampPhase || 'yellow' === lampPhase) ride.cruise = cruisePastLights(ride, gs, lampPhase);
  else ride.cruise = ride._cruiseOrig;
};

const sweepLightEnforcement = (gs) => {
  if (!gs.traffic || 'function' !== typeof gs.lightState) return;
  for (const ride of gs.traffic) applyLampsToCar(ride, gs);
};

const armLightHook = (gs) => {
  if (!gs || gs._lightHook || !Array.isArray(gs.updaters)) return;
  gs._lightHook = true;
  gs.updaters.push(function (stateIn2) { try { sweepLightEnforcement(stateIn2); } catch (skip) {} });
};

const MOPED_PAINTS = [];
MOPED_PAINTS.push(0xffffff);
MOPED_PAINTS.push(0xffd9c9);
MOPED_PAINTS.push(0xfff3b0);
MOPED_PAINTS.push(0xbfe3ff);
MOPED_PAINTS.push(0xe6ccff);
MOPED_PAINTS.push(0xffc4c4);

const tintedMaterialCopy = (matSrc, hueVal) => {
  const dupMat = matSrc.clone();
  if (dupMat.color) dupMat.color.setHex(hueVal);
  return dupMat;
};

const tintMeshNode = (nodeIn, hueVal) => {
  if (!nodeIn.isMesh || !nodeIn.material) return;
  if (!Array.isArray(nodeIn.material)) nodeIn.material = tintedMaterialCopy(nodeIn.material, hueVal);
  else nodeIn.material = nodeIn.material.map(function (matSrc) { return tintedMaterialCopy(matSrc, hueVal); });
};

const tintedModelClone = (wrapIn, hueVal) => {
  const dupRoot = wrapIn.clone(true);
  dupRoot.traverse(function (nodeIn) { tintMeshNode(nodeIn, hueVal); });
  return dupRoot;
};

const rerouteRider = (gs, rider) => {
  rider.onX = 0.5 > rnd();
  let linePick;
  if (rider.onX) linePick = gs.roadX; else linePick = gs.roadZ;
  rider.line = pick(linePick);
  if (0.5 > rnd()) rider.dirSign = 1; else rider.dirSign = -1;
  rider.travel = 0;
  rider.along = rr(-600, 600);
};

const placeRiderOnRoad = (rider, sideOff, yawQ) => {
  rider.x = rider.onX ? rider.line + rider.dirSign * 5 + sideOff : rider.along;
  rider.z = rider.onX ? rider.along : rider.line - rider.dirSign * 5 + sideOff;
  return yawQ;
};

const headingBaseFor = (rider) => {
  let pairFace;
  if (rider.onX) pairFace = [0, Math.PI]; else pairFace = [Math.PI / 2, -Math.PI / 2];
  const [faceLead, faceTrail] = pairFace;
  if (0 < rider.dirSign) return faceLead;
  return faceTrail;
};

const poseRider = (rider) => {
  rider.group.position.set(rider.x, 0.02 + groundH(rider.x, rider.z), rider.z);
  rider.group.rotation.y = rider.angle;
};

const tickMopeds = (gs, step) => {
  if (!gs._vespas || !step) return;
  const clockNow = gs.elapsed || 0;
  for (const moped of gs._vespas) {
    moped.travel = moped.travel + moped.speed * step;
    moped.along = moped.along + moped.speed * step * moped.dirSign;
    if (moped.travel > 500 || Math.abs(moped.along) > 655) rerouteRider(gs, moped);
    const weaveAt = clockNow * 0.9 + moped.weavePhase;
    placeRiderOnRoad(moped, Math.sin(weaveAt) * 0.8, 0);
    moped.angle = headingBaseFor(moped) + Math.cos(weaveAt) * 0.06;
    poseRider(moped);
  }
};

const PARKED_MOPED_SPOTS = [];
{
  const spotA = {};
  spotA.tint = 1; spotA.angle = 0.7; spotA.z = 448; spotA.x = -405;
  PARKED_MOPED_SPOTS.push(spotA);
  const spotB = {};
  spotB.tint = 3; spotB.angle = -Math.PI / 2; spotB.z = 470; spotB.x = 330;
  PARKED_MOPED_SPOTS.push(spotB);
  const spotC = {};
  spotC.tint = 5; spotC.angle = 2.35; spotC.z = -145; spotC.x = 155;
  PARKED_MOPED_SPOTS.push(spotC);
}

const launchMovingMopeds = (gs, wrapIn) => {
  let slot = 0;
  while (4 > slot) {
    const hueVal = MOPED_PAINTS[slot % MOPED_PAINTS.length];
    const grpNode = tintedModelClone(wrapIn, hueVal);
    gs.scene.add(grpNode);
    const moped = {};
    moped.group = grpNode; moped.onX = false; moped.line = 0; moped.dirSign = 1;
    moped.along = 0; moped.travel = 0; moped.x = 0; moped.z = 0; moped.angle = 0;
    moped.weavePhase = rr(0, 2 * Math.PI); moped.speed = rr(11, 15);
    rerouteRider(gs, moped);
    let startX;
    let startZ;
    if (moped.onX) startX = moped.line + moped.dirSign * 5; else startX = moped.along;
    if (moped.onX) startZ = moped.along; else startZ = moped.line - moped.dirSign * 5;
    grpNode.position.set(startX, 0, startZ);
    grpNode.position.y = 0.02 + groundH(grpNode.position.x, grpNode.position.z);
    gs._vespas.push(moped);
    slot++;
  }
};

const launchParkedMopeds = (gs, wrapIn) => {
  gs._parkedVespas = [];
  for (const spotIn of PARKED_MOPED_SPOTS) {
    const hueVal = MOPED_PAINTS[spotIn.tint % MOPED_PAINTS.length];
    const grpNode = tintedModelClone(wrapIn, hueVal);
    grpNode.position.set(spotIn.x, 0.02 + groundH(spotIn.x, spotIn.z), spotIn.z);
    grpNode.rotation.y = spotIn.angle;
    gs.scene.add(grpNode);
    gs._parkedVespas.push(grpNode);
  }
};

export const initVespas = (gs) => {
  if (!gs || gs._vespasInit || !Array.isArray(gs.updaters)) return;
  gs._vespasInit = true;
  gs._vespas = [];
  gs.updaters.push(function (stateIn2, dtIn2) { try { tickMopeds(stateIn2, dtIn2); } catch (skip) {} });
  initSportbikes(gs);
  loadHeroAsset('npcVespa').then(function (wrapIn) {
    try {
      if (!wrapIn) return;
      launchMovingMopeds(gs, wrapIn);
      launchParkedMopeds(gs, wrapIn);
    } catch (skip) {}
  }).catch(function () {});
};

const BIKE_PAINTS = [];
BIKE_PAINTS.push(0xffffff);
BIKE_PAINTS.push(0xdfe8ff);
BIKE_PAINTS.push(0xffe3f2);
BIKE_PAINTS.push(0xe8ffe3);

const buildBikeShell = (wrapIn, hueVal) => {
  const shellOut = new THREE.Group();
  const shellIn = new THREE.Group();
  shellIn.rotation.y = -Math.PI / 2;
  shellIn.add(tintedModelClone(wrapIn, hueVal));
  shellOut.add(shellIn);
  shellOut.userData.inner = shellIn;
  return shellOut;
};

const tickSportbikes = (gs, step) => {
  if (!gs._sportbikes || !step) return;
  const clockNow = gs.elapsed || 0;
  for (const bike of gs._sportbikes) {
    bike.travel = bike.travel + bike.speed * step;
    bike.along = bike.along + bike.speed * step * bike.dirSign;
    if (bike.travel > 500 || Math.abs(bike.along) > 655) rerouteRider(gs, bike);
    const weaveAt = clockNow * 1.7 + bike.weavePhase;
    const swayRate = Math.cos(weaveAt) * 1.1 * 1.7;
    placeRiderOnRoad(bike, Math.sin(weaveAt) * 1.1, 0);
    bike.angle = headingBaseFor(bike) + Math.cos(weaveAt) * 0.06;
    poseRider(bike);
    if (bike.inner) bike.inner.rotation.z = THREE.MathUtils.clamp(swayRate * -0.30, -0.38, 0.38);
  }
};

const launchOneBike = (gs, wrapIn, slot) => {
  const hueVal = BIKE_PAINTS[slot % BIKE_PAINTS.length];
  const grpNode = buildBikeShell(wrapIn, hueVal);
  gs.scene.add(grpNode);
  const bike = {};
  bike.group = grpNode; bike.inner = grpNode.userData.inner; bike.onX = false; bike.line = 0;
  bike.dirSign = 1; bike.along = 0; bike.travel = 0; bike.x = 0; bike.z = 0; bike.angle = 0;
  bike.weavePhase = rr(0, 2 * Math.PI); bike.speed = rr(19, 26);
  rerouteRider(gs, bike);
  let startX;
  let startZ;
  if (bike.onX) startX = bike.line + bike.dirSign * 5; else startX = bike.along;
  if (bike.onX) startZ = bike.along; else startZ = bike.line - bike.dirSign * 5;
  grpNode.position.set(startX, 0, startZ);
  grpNode.position.y = 0.02 + groundH(grpNode.position.x, grpNode.position.z);
  gs._sportbikes.push(bike);
};

export const initSportbikes = (gs) => {
  if (!gs || gs._sportbikesInit || !Array.isArray(gs.updaters)) return;
  gs._sportbikesInit = true;
  gs._sportbikes = [];
  gs.updaters.push(function (stateIn2, dtIn2) { try { tickSportbikes(stateIn2, dtIn2); } catch (skip) {} });
  loadHeroAsset('npcSportbike').then(function (wrapIn) {
    try {
      if (!wrapIn) return;
      let slot = 0;
      while (3 > slot) { launchOneBike(gs, wrapIn, slot); slot++; }
    } catch (skip) {}
  }).catch(function () {});
};

const reflectRadio = (gs, channel) => {
  try {
    gs._radioOff = !channel;
    if (channel) gs.radioName = channel.name; else gs.radioName = null;
    if (channel) gs._radioIdx = channel.index;
  } catch (skip) {}
};

const startRadioForDrive = (gs) => {
  try {
    const radioLive = gs.audio && gs.audio.radio;
    (radioLive && !gs._radioOff) ? reflectRadio(gs, gs.audio.radio.start(gs._radioIdx || 0)) : (gs._radioOff ? (gs.radioName = null) : null);
  } catch (skip) {}
};

export const enterCar = (gs, ride) => {
  armLightHook(gs);
  if (!gs.player) return;
  gs.player.fig.visible = false;
  if (!ride.driverFig) {
    ride.driverFig = makeFigure(CAST.ren);
    poseSeated(ride.driverFig);
    ride.driverFig.scale.setScalar(0.96);
  }
  ride.driverFig.position.set(ride.spec.wid * -0.22, 0.42, 0.15);
  ride.driverFig.rotation.y = 0;
  ride.mesh.add(ride.driverFig);
  ride.driver = 'player';
  gs.car = ride;
  gs.flags.inCar = true;
  try { if (gs.audio && gs.audio.setEngine) gs.audio.setEngine(true, 0.07); } catch (skip) {}
  startRadioForDrive(gs);
};

const silenceCarAudio = (gs) => {
  try { if (gs._hornActive && gs.audio && gs.audio.hornStop) gs.audio.hornStop(); } catch (skip) {}
  gs._hornActive = false;
  gs._hornT = 0; gs._hornWasDown = false;
  try { if (gs.audio && gs.audio.setEngine) gs.audio.setEngine(false, 0); } catch (skip) {}
  try { if (gs.audio && gs.audio.screech) gs.audio.screech(false, 0); } catch (skip) {}
  try { if (gs.audio && gs.audio.radio) gs.audio.radio.stop(); } catch (skip) {}
  gs.radioName = null;
  gs._radioWasDown = false;
};

export const exitCar = (gs) => {
  const ride = gs.car;
  if (!ride) return;
  silenceCarAudio(gs);
  if (ride.driverFig) ride.mesh.remove(ride.driverFig);
  ride.driver = 'parked';
  ride.speed = 0;
  gs.car = null;
  gs.flags.inCar = false;
  gs.speedKmh = 0;
  const heroFig = gs.player;
  const reachOut = ride.spec.wid / 2;
  heroFig.x = ride.x + Math.cos(ride.angle) * -(reachOut + 1.2);
  heroFig.z = ride.z + Math.sin(ride.angle) * (reachOut + 1.2);
  heroFig.x = ride.x - Math.cos(ride.angle) * (reachOut + 1.1);
  heroFig.z = ride.z + Math.sin(ride.angle) * (reachOut + 1.1);
  heroFig.angle = ride.angle;
  heroFig.fig.visible = true;
  heroFig.fig.position.set(heroFig.x, groundH(heroFig.x, heroFig.z), heroFig.z);
};

const soundHorn = (gs, ride) => {
  try {
    (gs.audio && gs.audio.hornStart) ? gs.audio.hornStart() : ((gs.audio && gs.audio.horn) ? gs.audio.horn(0.35) : undefined);
  } catch (skip) {}
  gs._hornActive = true;
  gs._hornT = 0;
  try { if ('function' === typeof gs.pedsStartle) gs.pedsStartle(ride.x, ride.z, 12); } catch (skip) {}
};

const muteHorn = (gs) => {
  try { if (gs.audio && gs.audio.hornStop) gs.audio.hornStop(); } catch (skip) {}
  gs._hornActive = false;
  gs._hornT = 0;
  gs._hornCooldown = 0.25;
};

const tickHorn = (gs, ride, keyMap, step) => {
  const hornHeld = !!(keyMap && keyMap['KeyH']);
  if (null == gs._hornCooldown) gs._hornCooldown = 0;
  if (gs._hornCooldown > 0) gs._hornCooldown = gs._hornCooldown - step;
  const mayStart = hornHeld && !gs._hornWasDown && !gs._hornActive && !(gs._hornCooldown > 0);
  if (mayStart) soundHorn(gs, ride);
  if (gs._hornActive) {
    gs._hornT = step + (gs._hornT || 0);
    if (gs._hornT >= 1.2 || (!hornHeld && gs._hornT >= 0.18)) muteHorn(gs);
  }
  gs._hornWasDown = hornHeld;
};

const tickRadioKeys = (gs, keyMap) => {
  const radioHeld = !!(keyMap && keyMap['KeyR']);
  if (radioHeld && !gs._radioWasDown) {
    try { if (gs.audio && gs.audio.radio) reflectRadio(gs, gs.audio.radio.next()); } catch (skip) {}
  }
  gs._radioWasDown = radioHeld;
};

const pedalFromKeys = (keyMap, ride) => {
  let pedal = 0;
  if (keyMap['KeyW'] || keyMap['ArrowUp']) pedal = 1;
  if (keyMap['KeyS'] || keyMap['ArrowDown']) {
    if (0.5 < ride.speed) pedal = -1.6; else pedal = -0.55;
  }
  return pedal;
};

const steerFromKeys = (keyMap) => {
  let steerIn = 0;
  if (keyMap['KeyA'] || keyMap['ArrowLeft']) steerIn = 1;
  if (keyMap['KeyD'] || keyMap['ArrowRight']) steerIn = -1;
  return steerIn;
};

const junctionKeyNear = (gs, px, pz) => {
  const hitBox = {};
  hitBox.key = null;
  gs.roadX.forEach(function (lineX) {
    if (12 > Math.abs(px - lineX)) {
      gs.roadZ.forEach(function (lineZ) {
        if (12 > Math.abs(pz - lineZ)) hitBox.key = `${lineX},${lineZ}`;
      });
    }
  });
  return hitBox.key;
};

const checkRedRun = (gs, ride, fromX, fromZ) => {
  try {
    if ('function' !== typeof gs.lightState || !(Math.abs(ride.speed) > 6)) return;
    const junction = junctionKeyNear(gs, ride.x, ride.z);
    if (!junction || junctionKeyNear(gs, fromX, fromZ)) return;
    let axisPick;
    if (Math.abs(Math.sin(ride.angle)) > Math.abs(Math.cos(ride.angle))) axisPick = 'x'; else axisPick = 'z';
    if ('red' !== gs.lightState(axisPick)) return;
    const clockNow = gs.elapsed || 0;
    const sameSpot = gs._lastRedKey === junction;
    const staleFlag = clockNow - (gs._lastRedT || -10) > 4;
    if (!sameSpot || staleFlag) {
      gs._lastRedKey = junction;
      gs._lastRedT = clockNow;
      gs.wanted = Math.min(5, Math.max(0, (gs.wanted || 0) + 0.15));
    }
  } catch (skip) {}
};

const shoveOutOfBox = (gs, ride, boxHit, offX, offZ, penX, penZ) => {
  let pushX;
  let pushZ;
  if (0 <= offX) pushX = penX; else pushX = -penX;
  if (0 <= offZ) pushZ = penZ; else pushZ = -penZ;
  penX < penZ ? (ride.x += pushX) : (ride.z += pushZ);
  if (Math.abs(ride.speed) > 6) {
    damageVehicle(gs, ride, Math.abs(ride.speed) * 0.7);
    gs.flags.crashTimer = 1;
  }
  ride.speed = ride.speed * -0.25;
};

const hitStatics = (gs, ride) => {
  gs.colliders.forEach(function (boxHit) {
    const offX = ride.x - boxHit.x, offZ = ride.z - boxHit.z;
    const penX = boxHit.hw + 1.6 - Math.abs(offX);
    const penZ = boxHit.hd + 1.6 - Math.abs(offZ);
    if (0 < penX && 0 < penZ) shoveOutOfBox(gs, ride, boxHit, offX, offZ, penX, penZ);
  });
};

const hitTraffic = (gs, ride) => {
  if (!gs.traffic) return;
  for (const otherRide of gs.traffic) {
    if (otherRide === ride) continue;
    const gapDist = Math.hypot(otherRide.x - ride.x, otherRide.z - ride.z);
    if (!(2.6 > gapDist) || !(gapDist > 0.01)) continue;
    const pushSpan = 2.6 - gapDist;
    otherRide.x = otherRide.x + (otherRide.x - ride.x) / gapDist * pushSpan * 0.6;
    otherRide.z = otherRide.z + (otherRide.z - ride.z) / gapDist * pushSpan * 0.6;
    otherRide.speed = ride.speed * 0.4;
    if (Math.abs(ride.speed) > 5) {
      damageVehicle(gs, otherRide, 8);
      damageVehicle(gs, ride, 5);
      gs.flags.crashTimer = 1;
    }
    ride.speed = ride.speed * 0.55;
  }
};

const mountHeadlights = (ride, specSheet) => {
  ride.spotL = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
  ride.spotR = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
  ride.mesh.add(ride.spotL); ride.mesh.add(ride.spotR);
  ride.mesh.add(ride.spotL.target); ride.mesh.add(ride.spotR.target);
  ride.spotL.position.set(-0.6, 0.8, specSheet.len / 2);
  ride.spotR.position.set(0.6, 0.8, specSheet.len / 2);
  ride.spotL.target.position.set(-1.2, 0, specSheet.len / 2 + 22);
  ride.spotR.target.position.set(1.2, 0, specSheet.len / 2 + 22);
};

const updateHeadlights = (gs, ride, specSheet) => {
  const nightNow = gs.timeOfDay > 18.5 || 5.5 > gs.timeOfDay;
  if (!ride.spotL) mountHeadlights(ride, specSheet);
  if (nightNow) ride.spotL.intensity = 60; else ride.spotL.intensity = 0;
  if (nightNow) ride.spotR.intensity = 60; else ride.spotR.intensity = 0;
  return nightNow;
};

const engineLoad = (paceShare, pedal) => {
  let bonusLoad;
  if (0 < pedal) bonusLoad = 0.3; else if (0 > pedal) bonusLoad = 0.12; else bonusLoad = 0;
  return Math.max(0.07, Math.min(1, paceShare * 0.85 + bonusLoad));
};

const screechShare = (gs, ride, brakeHeld, paceShare) => {
  let brakePart;
  if (brakeHeld) brakePart = 0.45; else brakePart = 0.15;
  return Math.min(1, Math.abs(ride.steerVis || 0) * 1.4 + brakePart + paceShare * 0.25);
};

const playCrashIfAny = (gs, ride, hpBefore) => {
  const heardCrash = gs.audio.crash && null != hpBefore && 'number' === typeof ride.health && hpBefore > ride.health;
  if (!heardCrash) return;
  const clockNow = gs.elapsed || 0;
  if (clockNow - (gs._lastCrashSfxT || -10) > 0.12) {
    gs._lastCrashSfxT = clockNow;
    gs.audio.crash(Math.min(1, (hpBefore - ride.health) / 15));
  }
};

const tickCarAudio = (gs, ride, pedal, brakeHeld, topNow, hpBefore) => {
  try {
    if (!gs.audio) return;
    const paceShare = Math.min(1, Math.abs(ride.speed) / Math.max(1, topNow));
    if (gs.audio.setEngine) gs.audio.setEngine(true, engineLoad(paceShare, pedal));
    if (gs.audio.screech) {
      const slidingNow = (brakeHeld || !!gs.flags.drifting) && Math.abs(ride.speed) > 8;
      let screechVal;
      if (slidingNow) screechVal = screechShare(gs, ride, brakeHeld, paceShare); else screechVal = 0;
      gs.audio.screech(slidingNow, screechVal);
    }
    playCrashIfAny(gs, ride, hpBefore);
  } catch (skip) {}
};

const pushPedal = (gs, ride, pedal, accelNow, topNow, nosHeld, step) => {
  let nosMul;
  let nosTop;
  if (nosHeld) { nosMul = 1.8; nosTop = 1.15; } else { nosMul = 1; nosTop = 1; }
  ride.speed = 0 < pedal ? ride.speed + accelNow * step * nosMul * (1 - Math.max(0, ride.speed) / (topNow * nosTop)) : (0 > pedal ? ride.speed + pedal * 10 * step : ride.speed - ride.speed * 0.35 * step);
  ride.speed -= ride.speed * 0.12 * step;
  ride.speed = Math.max(-9, Math.min(topNow * 1.18, ride.speed));
  if (0.02 > Math.abs(ride.speed) && 0 === pedal) ride.speed = 0;
};

const pushSteer = (ride, steerIn, brakeHeld, specSheet, step) => {
  const paceShare = Math.min(1, Math.abs(ride.speed) / 8 + 0.25);
  let driftPart;
  let brakeMul;
  if (brakeHeld) { driftPart = specSheet.drift * 0.9; brakeMul = 1.25; } else { driftPart = 0; brakeMul = 1; }
  const turnRate = paceShare * (specSheet.grip * 1.15 + driftPart);
  if (0 !== ride.speed) ride.angle += steerIn * turnRate * step * Math.sign(ride.speed) * brakeMul;
  ride.steerVis = ride.steerVis + (steerIn * 0.45 - ride.steerVis) * Math.min(1, step * 10);
  if (brakeHeld) ride.speed = ride.speed - ride.speed * 1.1 * step;
};

const puffSmoke = (gs, ride, specSheet, brakeHeld, steerIn, nosHeld) => {
  if (nosHeld) {
    const tailX = ride.x - Math.sin(ride.angle) * (specSheet.len / 2 + 0.3);
    const tailZ = ride.z - Math.cos(ride.angle) * (specSheet.len / 2 + 0.3);
    const smokePt = {};
    smokePt.x = tailX; smokePt.y = 0.4 + groundH(ride.x, ride.z); smokePt.z = tailZ;
    spawnSmokeAt(gs, smokePt, 1, true);
    gs.flags.nosActive = true;
  } else gs.flags.nosActive = false;
  const wideSlide = 0 !== Math.abs(steerIn) && Math.abs(ride.speed) > 12;
  if ((brakeHeld && Math.abs(ride.speed) > 5) || wideSlide && brakeHeld) spawnSmokeAt(gs, ride.mesh.position, 1, false);
};

const poseCarMesh = (gs, ride, pedal, brakeHeld, step) => {
  ride.mesh.position.set(ride.x, 0.02 + groundH(ride.x, ride.z), ride.z);
  ride.mesh.rotation.set(0, ride.angle, 0);
  ride.mesh.rotateX(THREE.MathUtils.clamp(pedal * -0.012, -0.02, 0.02));
  ride.mesh.rotateZ(THREE.MathUtils.clamp(ride.steerVis * Math.abs(ride.speed) * 0.0012, -0.05, 0.05));
  const rimRadius = ride.mesh.userData.wheelR || 0.33;
  const spinStep = ride.speed * step / rimRadius;
  function spinRim(rimNode, rimYaw) {
    if (!rimNode) return;
    rimNode.userData.spin = spinStep + (rimNode.userData.spin || 0);
    rimNode.rotation.set(rimNode.userData.spin, rimYaw, 0);
  }
  spinRim(ride.wheels.rl, 0); spinRim(ride.wheels.rr, 0);
  spinRim(ride.wheels.fl, ride.steerVis); spinRim(ride.wheels.fr, ride.steerVis);
  gs.speedKmh = Math.abs(ride.speed) * 3.6;
  if (ride.mesh.userData.tailMat) {
    if (0 > pedal || brakeHeld) ride.mesh.userData.tailMat.emissiveIntensity = 2.2;
    else ride.mesh.userData.tailMat.emissiveIntensity = 0.8;
  }
};

const hurtFromImpact = (gs, ride, hpBefore, step) => {
  if (null != hpBefore && 'number' === typeof ride.health) {
    const hpDrop = hpBefore - ride.health;
    if (hpDrop > 7) {
      try { gs.damagePlayer?.((hpDrop - 6) * 1.6); } catch (skip) {}
    }
  }
  if (Math.abs(ride.x) >= 655 || Math.abs(ride.z) >= 655) {
    try { gs.damagePlayer?.(step * 18); } catch (skip) {}
  }
};

export const updateDriving = (gs, step) => {
  armLightHook(gs);
  const ride = gs.car;
  if (!ride) return;
  const specSheet = ride.spec;
  const keyMap = gs.keys;
  let hpBefore;
  if ('number' === typeof ride.health) hpBefore = ride.health; else hpBefore = null;
  tickHorn(gs, ride, keyMap, step);
  tickRadioKeys(gs, keyMap);
  let wreckShare;
  if ('number' === typeof ride.health && 35 > ride.health) wreckShare = 0.72; else wreckShare = 1;
  const topNow = wreckShare * (specSheet.topSpeed / 3.6);
  const nosHeld = (keyMap['ShiftLeft'] || keyMap['ShiftRight']) && ride.speed > 2;
  const pedal = pedalFromKeys(keyMap, ride);
  const accelNow = wreckShare * (specSheet.accel * 16 + 6);
  pushPedal(gs, ride, pedal, accelNow, topNow, nosHeld, step);
  const steerIn = steerFromKeys(keyMap);
  const brakeHeld = !!keyMap['Space'];
  pushSteer(ride, steerIn, brakeHeld, specSheet, step);
  puffSmoke(gs, ride, specSheet, brakeHeld, steerIn, nosHeld);
  const prevX = ride.x, prevZ = ride.z;
  ride.x = ride.x + ride.speed * step * Math.sin(ride.angle);
  ride.z = ride.z + ride.speed * step * Math.cos(ride.angle);
  hitStatics(gs, ride);
  checkRedRun(gs, ride, prevX, prevZ);
  hitTraffic(gs, ride);
  ride.x = Math.max(-656, Math.min(656, ride.x));
  ride.z = Math.max(-656, Math.min(656, ride.z));
  poseCarMesh(gs, ride, pedal, brakeHeld, step);
  updateHeadlights(gs, ride, specSheet);
  tickCarAudio(gs, ride, pedal, brakeHeld, topNow, hpBefore);
  hurtFromImpact(gs, ride, hpBefore, step);
  gs.camTarget = {};
  gs.camTarget.x = ride.x; gs.camTarget.z = ride.z; gs.camTarget.angle = ride.angle; gs.camTarget.speed = ride.speed;
};
