// Getting into and out of vehicles, plus the arcade driving model
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated } from './player.js';
import { spawnSmokeAt, damageVehicle } from './cars.js';
import { loadHeroAsset } from './assets.js';
import { rnd, rr, pick } from './random.js';
// Roaming traffic and traffic lights
// The traffic updater lives in another module and cannot be
// called from here, so a hook registers once on the updater
// list, which the main loop runs ahead of traffic each frame,
// and pre brakes by scaling cruise speed while the traffic
// updater applies its own obstacle clamp, easing cars to a
// stop before the crossing edge, with green restoring the
// original cruise value afterwards
const CROSSING_HALF = 15;
function trafficPhaseFor(carGiven, stateGiven) {
  const axisName = carGiven.onX ? 'z' : 'x';
  const phaseName = stateGiven.lightState(axisName);
  return phaseName; }
function trafficSignFor(carGiven) {
  const headingPart = carGiven.onX ? Math.cos(carGiven.angle) : Math.sin(carGiven.angle);
  const headingSign = (headingPart === 0) ? 0 : Math.sign(headingPart);
  const signFinal = headingSign ? headingSign : (carGiven.dirSign || 1);
  return signFinal; }
function lightCruiseFor(carGiven, stateGiven, phaseGiven) {
  let cruiseNow = carGiven._cruiseOrig;
  const linesSet = carGiven.onX ? stateGiven.roadZ : stateGiven.roadX;
  const alongNow = carGiven.onX ? carGiven.z : carGiven.x;
  const signTravel = trafficSignFor(carGiven);
  const weighLine = (lineAt) => {
    const gapEdge = ((signTravel * (lineAt + (-alongNow))) + (-CROSSING_HALF));
    const gapCounts = (gapEdge > 0) && !(gapEdge > 14);
    if (!gapCounts) return;
    const phaseHalts = (phaseGiven === 'red') || (gapEdge > 6);
    if (!phaseHalts) return;
    const shareSlow = Math.min(1, Math.max(0, (gapEdge + (-2)) / 12));
    cruiseNow = Math.min(cruiseNow, carGiven._cruiseOrig * shareSlow); };
  (linesSet || []).forEach(weighLine);
  return cruiseNow; }
function enforceLights(stateGiven) {
  const trafficMissing = !stateGiven.traffic;
  const lightsMissing = (typeof stateGiven.lightState !== 'function');
  if (trafficMissing || lightsMissing) return;
  stateGiven.traffic.forEach((carGiven) => {
    const driverTraffic = (carGiven.driver === 'traffic');
    const cruisePresent = (carGiven.cruise != null);
    if (!driverTraffic || !cruisePresent) return;
    if (carGiven._cruiseOrig == null) carGiven._cruiseOrig = carGiven.cruise;
    const phaseNow = trafficPhaseFor(carGiven, stateGiven);
    const phaseHalts = (phaseNow === 'red') || (phaseNow === 'yellow');
    carGiven.cruise = phaseHalts ? lightCruiseFor(carGiven, stateGiven, phaseNow) : carGiven._cruiseOrig; }); }
function installLightHook(stateGiven) {
  const hookBlocked = !stateGiven || stateGiven._lightHook || !Array.isArray(stateGiven.updaters);
  if (hookBlocked) return;
  stateGiven._lightHook = true;
  stateGiven.updaters.push((stateArg) => { try { enforceLights(stateArg); } catch (ignoredFault) {} }); }
// Scooter traffic and parked props make up their own agent set
// The scooter model, rider baked in, becomes weaving traffic
// plus parked props with riders waiting, and a failed load
// spawns nothing at all, with no procedural stand in, since it
// is pure garnish
const TINTS_SCOOTER = [0xffffff, 0xffd9c9, 0xfff3b0, 0xbfe3ff, 0xe6ccff, 0xffc4c4];
function materialRetinted(matGiven, tintGiven) {
  const cloneMat = matGiven.clone();
  if (cloneMat.color) cloneMat.color.setHex(tintGiven);
  return cloneMat; }
function cloneTintedWrap(wrapGiven, tintGiven) {
  const cloneRoot = wrapGiven.clone(true);
  cloneRoot.traverse((nodeGiven) => {
    if (!nodeGiven.isMesh || !nodeGiven.material) return;
    nodeGiven.material = Array.isArray(nodeGiven.material) ? nodeGiven.material.map((matGiven) => materialRetinted(matGiven, tintGiven)) : materialRetinted(nodeGiven.material, tintGiven); });
  return cloneRoot; }
function rerollRoute(stateGiven, agentGiven) {
  agentGiven.onX = (rnd() < 0.5);
  agentGiven.line = pick(agentGiven.onX ? stateGiven.roadX : stateGiven.roadZ);
  agentGiven.dirSign = (rnd() < 0.5) ? 1 : -1;
  agentGiven.along = rr(-600, 600);
  agentGiven.travel = 0; }
function placeOnRoad(agentGiven, lateralGiven, headingGiven) {
  if (agentGiven.onX) {
    agentGiven.x = ((agentGiven.line + (agentGiven.dirSign * 5)) + lateralGiven); agentGiven.z = agentGiven.along;
  } else { agentGiven.x = agentGiven.along; agentGiven.z = ((agentGiven.line + (-(agentGiven.dirSign * 5))) + lateralGiven); }
  return headingGiven; }
function headingBaseFor(agentGiven) {
  const pairFacing = agentGiven.onX ? [0, Math.PI] : [(Math.PI / 2), (-Math.PI / 2)];
  const [facingPos, facingNeg] = pairFacing;
  const facingChosen = (agentGiven.dirSign > 0) ? facingPos : facingNeg;
  return facingChosen; }
function syncPose(agentGiven) {
  agentGiven.group.position.set(agentGiven.x, (groundH(agentGiven.x, agentGiven.z) + 0.02), agentGiven.z);
  agentGiven.group.rotation.y = agentGiven.angle; }
function stepScooters(stateGiven, dtGiven) {
  if (!stateGiven._vespas || !dtGiven) return;
  const elapsedNow = (stateGiven.elapsed || 0);
  stateGiven._vespas.forEach((scooterGiven) => {
    scooterGiven.travel += (scooterGiven.speed * dtGiven);
    scooterGiven.along += ((scooterGiven.speed * dtGiven) * scooterGiven.dirSign);
    const routeStale = (scooterGiven.travel > 500) || (Math.abs(scooterGiven.along) > 655);
    if (routeStale) rerollRoute(stateGiven, scooterGiven);
    const weaveAt = ((elapsedNow * 0.9) + scooterGiven.weavePhase);
    const weaveOff = (Math.sin(weaveAt) * 0.8);
    const wobbleValue = (Math.cos(weaveAt) * 0.06);
    placeOnRoad(scooterGiven, weaveOff, 0);
    scooterGiven.angle = (headingBaseFor(scooterGiven) + wobbleValue);
    syncPose(scooterGiven); }); }
const SPOTS_PARKED_SCOOTER = [
  { x: -405, z: 448, angle: 0.7, tint: 1 },
  { x: 330, z: 470, angle: -Math.PI / 2, tint: 3 },
  { x: 155, z: -145, angle: 2.35, tint: 5 } ];
function spawnRollingScooters(stateGiven, wrapGiven) {
  for (let idxSpawn = 0; idxSpawn < 4; idxSpawn++) {
    const tintNow = TINTS_SCOOTER[idxSpawn % TINTS_SCOOTER.length];
    const grpScooter = cloneTintedWrap(wrapGiven, tintNow);
    stateGiven.scene.add(grpScooter);
    const recordScooter = { group: grpScooter, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, weavePhase: rr(0, 2 * Math.PI), speed: rr(11, 15) };
    rerollRoute(stateGiven, recordScooter);
    const bornX = recordScooter.onX ? (recordScooter.line + (recordScooter.dirSign * 5)) : recordScooter.along;
    const bornZ = recordScooter.onX ? recordScooter.along : (recordScooter.line + (-(recordScooter.dirSign * 5)));
    grpScooter.position.set(bornX, 0, bornZ);
    grpScooter.position.y = (groundH(grpScooter.position.x, grpScooter.position.z) + 0.02);
    stateGiven._vespas.push(recordScooter); } }
function spawnParkedScooters(stateGiven, wrapGiven) {
  stateGiven._parkedVespas = [];
  SPOTS_PARKED_SCOOTER.forEach((spotGiven) => {
    const tintNow = TINTS_SCOOTER[spotGiven.tint % TINTS_SCOOTER.length];
    const grpParked = cloneTintedWrap(wrapGiven, tintNow);
    grpParked.position.set(spotGiven.x, (groundH(spotGiven.x, spotGiven.z) + 0.02), spotGiven.z);
    grpParked.rotation.y = spotGiven.angle;
    stateGiven.scene.add(grpParked);
    stateGiven._parkedVespas.push(grpParked); }); }
export function initVespas(stateGiven) {
  const initBlocked = !stateGiven || stateGiven._vespasInit || !Array.isArray(stateGiven.updaters);
  if (initBlocked) return;
  stateGiven._vespasInit = true;
  stateGiven._vespas = [];
  stateGiven.updaters.push((stateArg, dtArg) => { try { stepScooters(stateArg, dtArg); } catch (ignoredFault) {} });
  initSportbikes(stateGiven);
  loadHeroAsset('npcVespa').then((wrapGiven) => { try {
      if (!wrapGiven) return;
      spawnRollingScooters(stateGiven, wrapGiven);
      spawnParkedScooters(stateGiven, wrapGiven);
    } catch (ignoredFault) { /* garnish only */ }
  }).catch(() => {}); }

// Sportbike traffic runs alongside the scooters, sharing road
// lane and respawn conventions plus the same clone tint helper
// and hook style
// They ride straight along roads and respawn instead of turning
// at crossings, so the weave is their cornering and the lean
// banks them in
// Garnish only again, so a null load spawns nothing at all
const TINTS_BIKE = [0xffffff, 0xdfe8ff, 0xffe3f2, 0xe8ffe3];
function assemblyBikeFrom(wrapGiven, tintGiven) {
  const grpOuter = new THREE.Group();
  const grpInner = new THREE.Group();
  grpInner.rotation.y = -Math.PI / 2;
  grpInner.add(cloneTintedWrap(wrapGiven, tintGiven));
  grpOuter.add(grpInner);
  grpOuter.userData.inner = grpInner;
  return grpOuter; }
function stepBikes(stateGiven, dtGiven) {
  if (!stateGiven._sportbikes || !dtGiven) return;
  const elapsedNow = (stateGiven.elapsed || 0);
  stateGiven._sportbikes.forEach((bikeGiven) => {
    bikeGiven.travel += (bikeGiven.speed * dtGiven);
    bikeGiven.along += ((bikeGiven.speed * dtGiven) * bikeGiven.dirSign);
    const routeStale = (bikeGiven.travel > 500) || (Math.abs(bikeGiven.along) > 655);
    if (routeStale) rerollRoute(stateGiven, bikeGiven);
    const weaveAt = ((elapsedNow * 1.7) + bikeGiven.weavePhase);
    const offLateral = (Math.sin(weaveAt) * 1.1);
    const rateLateral = ((Math.cos(weaveAt) * 1.1) * 1.7);
    const wobbleValue = (Math.cos(weaveAt) * 0.06);
    placeOnRoad(bikeGiven, offLateral, 0);
    bikeGiven.angle = (headingBaseFor(bikeGiven) + wobbleValue);
    syncPose(bikeGiven);
    if (bikeGiven.inner) bikeGiven.inner.rotation.z = THREE.MathUtils.clamp((rateLateral * -0.30), -0.38, 0.38); }); }
export function initSportbikes(stateGiven) {
  const initBlocked = !stateGiven || stateGiven._sportbikesInit || !Array.isArray(stateGiven.updaters);
  if (initBlocked) return;
  stateGiven._sportbikesInit = true;
  stateGiven._sportbikes = [];
  stateGiven.updaters.push((stateArg, dtArg) => { try { stepBikes(stateArg, dtArg); } catch (ignoredFault) {} });
  loadHeroAsset('npcSportbike').then((wrapGiven) => { try {
      if (!wrapGiven) return;
      for (let idxSpawn = 0; idxSpawn < 3; idxSpawn++) {
        const tintNow = TINTS_BIKE[idxSpawn % TINTS_BIKE.length];
        const grpBike = assemblyBikeFrom(wrapGiven, tintNow);
        stateGiven.scene.add(grpBike);
        const recordBike = { group: grpBike, inner: grpBike.userData.inner, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, weavePhase: rr(0, 2 * Math.PI), speed: rr(19, 26) };
        rerollRoute(stateGiven, recordBike);
        const bornX = recordBike.onX ? (recordBike.line + (recordBike.dirSign * 5)) : recordBike.along;
        const bornZ = recordBike.onX ? recordBike.along : (recordBike.line + (-(recordBike.dirSign * 5)));
        grpBike.position.set(bornX, 0, bornZ);
        grpBike.position.y = (groundH(grpBike.position.x, grpBike.position.z) + 0.02);
        stateGiven._sportbikes.push(recordBike); }
    } catch (ignoredFault) { /* garnish only */ }
  }).catch(() => {}); }
// Radio state is mirrored onto shared state, so the HUD draws
// its chip without reaching into audio, and the choice survives
// from one drive to the next
function publishRadio(stateGiven, stationGiven) { try {
    const stationThere = !!stationGiven;
    stateGiven._radioOff = !stationThere;
    stateGiven.radioName = stationThere ? stationGiven.name : null;
    if (stationThere) stateGiven._radioIdx = stationGiven.index;
  } catch (ignoredFault) {} }
export function enterCar(stateGiven, vehicleGiven) {
  installLightHook(stateGiven);
  if (!stateGiven.player) return;
  stateGiven.player.fig.visible = false;
  if (!vehicleGiven.driverFig) {
    vehicleGiven.driverFig = makeFigure(CAST.ren);
    poseSeated(vehicleGiven.driverFig);
    vehicleGiven.driverFig.scale.setScalar(0.96); }
  vehicleGiven.driverFig.position.set((vehicleGiven.spec.wid * -0.22), 0.42, 0.15);
  vehicleGiven.driverFig.rotation.y = 0;
  vehicleGiven.mesh.add(vehicleGiven.driverFig);
  vehicleGiven.driver = 'player';
  stateGiven.car = vehicleGiven;
  stateGiven.flags.inCar = true;
  try { if (stateGiven.audio && stateGiven.audio.setEngine) stateGiven.audio.setEngine(true, 0.07); } catch (ignoredFault) {}
  try {
    const radioThere = stateGiven.audio && stateGiven.audio.radio;
    if (radioThere && !stateGiven._radioOff) publishRadio(stateGiven, stateGiven.audio.radio.start(stateGiven._radioIdx || 0));
    else if (stateGiven._radioOff) { stateGiven.radioName = null; }
  } catch (ignoredFault) {} }
export function exitCar(stateGiven) {
  const vehicleGiven = stateGiven.car;
  if (!vehicleGiven) return;
  try { if (stateGiven._hornActive && stateGiven.audio && stateGiven.audio.hornStop) stateGiven.audio.hornStop(); } catch (ignoredFault) {}
  stateGiven._hornActive = false; stateGiven._hornT = 0; stateGiven._hornWasDown = false;
  try { if (stateGiven.audio && stateGiven.audio.setEngine) stateGiven.audio.setEngine(false, 0); } catch (ignoredFault) {}
  try { if (stateGiven.audio && stateGiven.audio.screech) stateGiven.audio.screech(false, 0); } catch (ignoredFault) {}
  try { if (stateGiven.audio && stateGiven.audio.radio) stateGiven.audio.radio.stop(); } catch (ignoredFault) {}
  stateGiven.radioName = null; stateGiven._radioWasDown = false;
  if (vehicleGiven.driverFig) vehicleGiven.mesh.remove(vehicleGiven.driverFig);
  vehicleGiven.driver = 'parked'; vehicleGiven.speed = 0;
  stateGiven.car = null; stateGiven.flags.inCar = false;
  stateGiven.speedKmh = 0;
  const playerGiven = stateGiven.player;
  const reachExit = (vehicleGiven.spec.wid / 2);
  playerGiven.x = (vehicleGiven.x + (Math.cos(vehicleGiven.angle) * -(reachExit + 1.2)));
  playerGiven.z = (vehicleGiven.z + (Math.sin(vehicleGiven.angle) * (reachExit + 1.2)));
  playerGiven.x = (vehicleGiven.x + (-(Math.cos(vehicleGiven.angle) * (reachExit + 1.1))));
  playerGiven.z = (vehicleGiven.z + (Math.sin(vehicleGiven.angle) * (reachExit + 1.1)));
  playerGiven.angle = vehicleGiven.angle;
  playerGiven.fig.visible = true;
  playerGiven.fig.position.set(playerGiven.x, groundH(playerGiven.x, playerGiven.z), playerGiven.z); }

function stepHorn(stateGiven, vehicleGiven, keysGiven, dtGiven) {
  // Horn handling: the key map fills from key events in the
  // main module, and this updater only runs in play mode,
  // unpaused, inside a car, so the horn stays inert on foot or
  // in menus
  // The press edge starts the horn and startles pedestrians,
  // once only
  // A tap still sounds briefly, holding sustains up to a cap,
  // and releasing past the minimum, or hitting the cap, stops
  // it, while honks stay spaced apart, and holding past the
  // cap never retriggers
  const hornDown = !!(keysGiven && keysGiven['KeyH']);
  if (stateGiven._hornCooldown == null) stateGiven._hornCooldown = 0;
  if (stateGiven._hornCooldown > 0) stateGiven._hornCooldown -= dtGiven;
  const startAllowed = hornDown && !stateGiven._hornWasDown && !stateGiven._hornActive && !(stateGiven._hornCooldown > 0);
  if (startAllowed) {
    try { if (stateGiven.audio && stateGiven.audio.hornStart) stateGiven.audio.hornStart(); else if (stateGiven.audio && stateGiven.audio.horn) stateGiven.audio.horn(0.35); } catch (ignoredFault) {}
    stateGiven._hornActive = true; stateGiven._hornT = 0;
    try { if (typeof stateGiven.pedsStartle === 'function') stateGiven.pedsStartle(vehicleGiven.x, vehicleGiven.z, 12); } catch (ignoredFault) {} }
  if (stateGiven._hornActive) {
    stateGiven._hornT = ((stateGiven._hornT || 0) + dtGiven);
    const hornOverCap = (stateGiven._hornT >= 1.2);
    const hornLetGo = !hornDown && (stateGiven._hornT >= 0.18);
    if (hornOverCap || hornLetGo) {
      try { if (stateGiven.audio && stateGiven.audio.hornStop) stateGiven.audio.hornStop(); } catch (ignoredFault) {}
      stateGiven._hornActive = false; stateGiven._hornT = 0; stateGiven._hornCooldown = 0.25; } }
  stateGiven._hornWasDown = hornDown; }
function stepRadioKeys(stateGiven, keysGiven) {
  // Radio handling: keydown edge only, so auto repeat never
  // cycles it, and inert on foot because this updater is car
  // only
  // The cycle runs through the stations and then off, and the
  // mirror helper keeps the choice ready for the next drive
  const radioDown = !!(keysGiven && keysGiven['KeyR']);
  if (radioDown && !stateGiven._radioWasDown) {
    try { if (stateGiven.audio && stateGiven.audio.radio) publishRadio(stateGiven, stateGiven.audio.radio.next()); } catch (ignoredFault) {} }
  stateGiven._radioWasDown = radioDown; }
function throttleFromKeys(keysGiven, vehicleGiven) {
  let throttleOut = 0;
  if (keysGiven['KeyW'] || keysGiven['ArrowUp']) throttleOut = 1;
  if (keysGiven['KeyS'] || keysGiven['ArrowDown']) throttleOut = (vehicleGiven.speed > 0.5) ? -1.6 : -0.55;
  return throttleOut; }
function steerFromKeys(keysGiven) {
  let steerOut = 0;
  if (keysGiven['KeyA'] || keysGiven['ArrowLeft']) steerOut = 1;
  if (keysGiven['KeyD'] || keysGiven['ArrowRight']) steerOut = -1;
  return steerOut; }
function junctionKeyNear(stateGiven, posX, posZ) {
  for (const lineX of stateGiven.roadX) if (Math.abs(posX + (-lineX)) < 12)
    for (const lineZ of stateGiven.roadZ) if (Math.abs(posZ + (-lineZ)) < 12) return (lineX + ',' + lineZ);
  return null; }
function checkRedRun(stateGiven, vehicleGiven, fromX, fromZ) {
  // Crossing a junction box on red heats the wanted level, and
  // the clamp here matches the one the shooting layer uses
  try {
    const lightsThere = (typeof stateGiven.lightState === 'function');
    const movingFast = (Math.abs(vehicleGiven.speed) > 6);
    if (!lightsThere || !movingFast) return;
    const junctionNow = junctionKeyNear(stateGiven, vehicleGiven.x, vehicleGiven.z);
    const junctionBefore = junctionKeyNear(stateGiven, fromX, fromZ);
    if (!junctionNow || junctionBefore) return;
    const axisName = (Math.abs(Math.cos(vehicleGiven.angle)) < Math.abs(Math.sin(vehicleGiven.angle))) ? 'x' : 'z';
    if (stateGiven.lightState(axisName) !== 'red') return;
    const elapsedNow = (stateGiven.elapsed || 0);
    const sameJunction = (stateGiven._lastRedKey === junctionNow);
    const flaggedLately = ((elapsedNow + (-(stateGiven._lastRedT || -10))) > 4);
    if (!sameJunction || flaggedLately) {
      stateGiven._lastRedKey = junctionNow; stateGiven._lastRedT = elapsedNow;
      stateGiven.wanted = Math.min(5, Math.max(0, ((stateGiven.wanted || 0) + 0.15))); }
  } catch (ignoredFault) {} }
function collideStatics(stateGiven, vehicleGiven) {
  for (const colliderGiven of stateGiven.colliders) {
    const offX = (vehicleGiven.x + (-colliderGiven.x)), offZ = (vehicleGiven.z + (-colliderGiven.z));
    const penX = ((colliderGiven.hw + 1.6) + (-Math.abs(offX)));
    const penZ = ((colliderGiven.hd + 1.6) + (-Math.abs(offZ)));
    const touching = (penX > 0) && (penZ > 0);
    if (!touching) continue;
    if (penZ > penX) vehicleGiven.x += (0 <= offX) ? penX : -penX;
    else vehicleGiven.z += (0 <= offZ) ? penZ : -penZ;
    if (Math.abs(vehicleGiven.speed) > 6) { damageVehicle(stateGiven, vehicleGiven, (Math.abs(vehicleGiven.speed) * 0.7)); stateGiven.flags.crashTimer = 1; }
    vehicleGiven.speed *= -0.25; } }
function collideTraffic(stateGiven, vehicleGiven) {
  if (!stateGiven.traffic) return;
  stateGiven.traffic.forEach((otherGiven) => {
    if (otherGiven === vehicleGiven) return;
    const gapNow = Math.hypot((otherGiven.x + (-vehicleGiven.x)), (otherGiven.z + (-vehicleGiven.z)));
    const contactNow = (gapNow < 2.6) && (gapNow > 0.01);
    if (!contactNow) return;
    const spanPush = (2.6 + (-gapNow));
    otherGiven.x += (((otherGiven.x + (-vehicleGiven.x)) / gapNow) * spanPush * 0.6);
    otherGiven.z += (((otherGiven.z + (-vehicleGiven.z)) / gapNow) * spanPush * 0.6);
    otherGiven.speed = (vehicleGiven.speed * 0.4);
    if (Math.abs(vehicleGiven.speed) > 5) { damageVehicle(stateGiven, otherGiven, 8); damageVehicle(stateGiven, vehicleGiven, 5); stateGiven.flags.crashTimer = 1; }
    vehicleGiven.speed *= 0.55; }); }
function ensureHeadlights(stateGiven, vehicleGiven, specGiven) {
  const nightNow = (stateGiven.timeOfDay > 18.5) || (stateGiven.timeOfDay < 5.5);
  if (!vehicleGiven.spotL) {
    vehicleGiven.spotL = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
    vehicleGiven.spotR = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
    vehicleGiven.mesh.add(vehicleGiven.spotL); vehicleGiven.mesh.add(vehicleGiven.spotR);
    vehicleGiven.mesh.add(vehicleGiven.spotL.target); vehicleGiven.mesh.add(vehicleGiven.spotR.target);
    vehicleGiven.spotL.position.set(-0.6, 0.8, specGiven.len / 2);
    vehicleGiven.spotR.position.set(0.6, 0.8, specGiven.len / 2);
    vehicleGiven.spotL.target.position.set(-1.2, 0, (specGiven.len / 2) + 22);
    vehicleGiven.spotR.target.position.set(1.2, 0, (specGiven.len / 2) + 22); }
  vehicleGiven.spotL.intensity = nightNow ? 60 : 0; vehicleGiven.spotR.intensity = nightNow ? 60 : 0;
  return nightNow; }
function stepVehicleAudio(stateGiven, vehicleGiven, throttleGiven, brakeGiven, topEff, healthWas) {
  // Vehicle audio per frame: engine load follows speed fraction
  // and throttle, while screech follows drifting or handbrake
  // slides past a speed threshold, with intensity from the
  // slip, and any health drop inside the frame counts as a
  // crash, scaled by the damage done
  try {
    if (!stateGiven.audio) return;
    const shareSpeed = Math.min(1, (Math.abs(vehicleGiven.speed) / Math.max(1, topEff)));
    const extraLoad = (throttleGiven > 0) ? 0.3 : ((throttleGiven < 0) ? 0.12 : 0);
    if (stateGiven.audio.setEngine) stateGiven.audio.setEngine(true, Math.max(0.07, Math.min(1, ((shareSpeed * 0.85) + extraLoad))));
    if (stateGiven.audio.screech) {
      const slidingNow = (brakeGiven || !!stateGiven.flags.drifting) && (Math.abs(vehicleGiven.speed) > 8);
      const shareSlip = Math.min(1, ((Math.abs(vehicleGiven.steerVis || 0) * 1.4) + (brakeGiven ? 0.45 : 0.15) + (shareSpeed * 0.25)));
      stateGiven.audio.screech(slidingNow, slidingNow ? shareSlip : 0); }
    const crashHeard = stateGiven.audio.crash && (healthWas != null) && (typeof vehicleGiven.health === 'number') && (vehicleGiven.health < healthWas);
    if (crashHeard) {
      const elapsedNow = (stateGiven.elapsed || 0);
      if ((elapsedNow + (-(stateGiven._lastCrashSfxT || -10))) > 0.12) {
        stateGiven._lastCrashSfxT = elapsedNow;
        stateGiven.audio.crash(Math.min(1, ((healthWas + (-vehicleGiven.health)) / 15))); } }
  } catch (ignoredFault) {} }
export function updateDriving(stateGiven, dtGiven) {
  installLightHook(stateGiven);
  const vehicleGiven = stateGiven.car;
  if (!vehicleGiven) return;
  const specGiven = vehicleGiven.spec;
  const keysGiven = stateGiven.keys;
  const healthWas = (typeof vehicleGiven.health === 'number') ? vehicleGiven.health : null;
  stepHorn(stateGiven, vehicleGiven, keysGiven, dtGiven);
  stepRadioKeys(stateGiven, keysGiven);
  // A battered car loses pace: for this frame only, the
  // effective top speed and acceleration scale down, while the
  // spec itself is never mutated, and the clamp below reads
  // the scaled top speed
  const shareBattered = ((typeof vehicleGiven.health === 'number') && (vehicleGiven.health < 35)) ? 0.72 : 1;
  const topEff = (shareBattered * (specGiven.topSpeed / 3.6));
  const nosDown = (keysGiven['ShiftLeft'] || keysGiven['ShiftRight']) && (vehicleGiven.speed > 2);
  const throttleGiven = throttleFromKeys(keysGiven, vehicleGiven);
  const rateAccel = (shareBattered * ((specGiven.accel * 16) + 6));
  if (throttleGiven > 0) vehicleGiven.speed += ((rateAccel * dtGiven) * (nosDown ? 1.8 : 1) * (1 + (-(Math.max(0, vehicleGiven.speed) / (topEff * (nosDown ? 1.15 : 1))))));
  else if (throttleGiven < 0) vehicleGiven.speed += ((throttleGiven * 10) * dtGiven);
  else vehicleGiven.speed = (vehicleGiven.speed + (-(vehicleGiven.speed * 0.35 * dtGiven)));
  vehicleGiven.speed = (vehicleGiven.speed + (-(vehicleGiven.speed * 0.12 * dtGiven)));
  const floorReverse = -9;
  const speedCapped = Math.min((topEff * 1.18), vehicleGiven.speed);
  vehicleGiven.speed = Math.max(floorReverse, speedCapped);
  if ((Math.abs(vehicleGiven.speed) < 0.02) && (throttleGiven === 0)) vehicleGiven.speed = 0;
  const steerGiven = steerFromKeys(keysGiven);
  const brakeDown = !!keysGiven['Space'];
  const shareSpeed = Math.min(1, ((Math.abs(vehicleGiven.speed) / 8) + 0.25));
  const rateSteer = (shareSpeed * ((specGiven.grip * 1.15) + (brakeDown ? (specGiven.drift * 0.9) : 0)));
  if (vehicleGiven.speed !== 0) vehicleGiven.angle += (((steerGiven * rateSteer) * dtGiven) * Math.sign(vehicleGiven.speed) * (brakeDown ? 1.25 : 1));
  vehicleGiven.steerVis += (((steerGiven * 0.45) + (-vehicleGiven.steerVis)) * Math.min(1, (dtGiven * 10)));
  if (brakeDown) vehicleGiven.speed -= ((vehicleGiven.speed * 1.1) * dtGiven);
  if (nosDown) {
    const exhaustX = (vehicleGiven.x + (-(Math.sin(vehicleGiven.angle) * ((specGiven.len / 2) + 0.3))));
    const exhaustZ = (vehicleGiven.z + (-(Math.cos(vehicleGiven.angle) * ((specGiven.len / 2) + 0.3))));
    spawnSmokeAt(stateGiven, { x: exhaustX, y: (groundH(vehicleGiven.x, vehicleGiven.z) + 0.4), z: exhaustZ }, 1, true);
    stateGiven.flags.nosActive = true;
  } else stateGiven.flags.nosActive = false;
  const slideWide = (Math.abs(steerGiven) !== 0) && (Math.abs(vehicleGiven.speed) > 12);
  if ((brakeDown && (Math.abs(vehicleGiven.speed) > 5)) || slideWide && brakeDown) spawnSmokeAt(stateGiven, vehicleGiven.mesh.position, 1, false);
  const fromX = vehicleGiven.x, fromZ = vehicleGiven.z;
  vehicleGiven.x += ((vehicleGiven.speed * dtGiven) * Math.sin(vehicleGiven.angle));
  vehicleGiven.z += ((vehicleGiven.speed * dtGiven) * Math.cos(vehicleGiven.angle));
  collideStatics(stateGiven, vehicleGiven);
  checkRedRun(stateGiven, vehicleGiven, fromX, fromZ);
  collideTraffic(stateGiven, vehicleGiven);
  vehicleGiven.x = Math.max(-656, Math.min(656, vehicleGiven.x));
  vehicleGiven.z = Math.max(-656, Math.min(656, vehicleGiven.z));
  const groundY = groundH(vehicleGiven.x, vehicleGiven.z);
  vehicleGiven.mesh.position.set(vehicleGiven.x, (groundY + 0.02), vehicleGiven.z);
  vehicleGiven.mesh.rotation.set(0, vehicleGiven.angle, 0);
  vehicleGiven.mesh.rotateX(THREE.MathUtils.clamp((throttleGiven * -0.012), -0.02, 0.02));
  vehicleGiven.mesh.rotateZ(THREE.MathUtils.clamp(((vehicleGiven.steerVis * Math.abs(vehicleGiven.speed)) * 0.0012), -0.05, 0.05));
  const radiusWheel = (vehicleGiven.mesh.userData.wheelR || 0.33);
  const stepSpin = ((vehicleGiven.speed * dtGiven) / radiusWheel);
  const spinWheel = (wheelGiven, angleSteer) => {
    if (!wheelGiven) return;
    wheelGiven.userData.spin = ((wheelGiven.userData.spin || 0) + stepSpin);
    wheelGiven.rotation.set(wheelGiven.userData.spin, angleSteer, 0); };
  spinWheel(vehicleGiven.wheels.rl, 0); spinWheel(vehicleGiven.wheels.rr, 0);
  spinWheel(vehicleGiven.wheels.fl, vehicleGiven.steerVis); spinWheel(vehicleGiven.wheels.fr, vehicleGiven.steerVis);
  stateGiven.speedKmh = (Math.abs(vehicleGiven.speed) * 3.6);
  if (vehicleGiven.mesh.userData.tailMat) vehicleGiven.mesh.userData.tailMat.emissiveIntensity = ((throttleGiven < 0) || brakeDown) ? 2.2 : 0.8;
  ensureHeadlights(stateGiven, vehicleGiven, specGiven);
  stepVehicleAudio(stateGiven, vehicleGiven, throttleGiven, brakeDown, topEff, healthWas);
  // Driver health from impacts: every collision path in this
  // frame funnels through car health, so the frame delta is
  // the impact measure, and a large enough delta hurts the
  // driver as well
  if ((healthWas != null) && (typeof vehicleGiven.health === 'number')) {
    const dropHealth = (healthWas + (-vehicleGiven.health));
    if (dropHealth > 7) { try { stateGiven.damagePlayer?.(((dropHealth + (-6)) * 1.6)); } catch (ignoredFault) {} } }
  const atEdge = (Math.abs(vehicleGiven.x) >= 655) || (Math.abs(vehicleGiven.z) >= 655);
  if (atEdge) { try { stateGiven.damagePlayer?.((dtGiven * 18)); } catch (ignoredFault) {} }
  stateGiven.camTarget = { x: vehicleGiven.x, z: vehicleGiven.z, angle: vehicleGiven.angle, speed: vehicleGiven.speed }; }
