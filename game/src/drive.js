// Getting into and out of vehicles, plus the arcade driving model
import * as THREE from 'three'; import { CAST } from './config.js';
import { groundH } from './world.js'; import { makeFigure, poseSeated } from './player.js';
import { spawnSmokeAt, damageVehicle } from './cars.js'; import { loadHeroAsset } from './assets.js';
import { rnd, rr, pick } from './random.js';
// Roaming traffic meets the traffic lights in this module
// Traffic itself updates elsewhere and exposes no entry point
// into here, so one hook joins the updater list, which the
// main loop runs before traffic each frame, and trims cruise
// speed early while the traffic updater adds its own obstacle
// clamp, easing cars to the crossing edge, with green handing
// back the original cruise value
const CROSSING_HALF_WIDTH = 15;
function phaseForCar(carHeld, stateHeld) {
  const axisKey = carHeld.onX ? 'z' : 'x';
  return stateHeld.lightState(axisKey); }
function signForCar(carHeld) {
  const headingPart = carHeld.onX ? Math.cos(carHeld.angle) : Math.sin(carHeld.angle);
  const headingSign = (headingPart === 0) ? 0 : Math.sign(headingPart);
  return headingSign ? headingSign : (carHeld.dirSign || 1); }
function weighStopLine(carHeld, phaseHeld, travelSign, alongPos, lineAt, cruiseCell) {
  const edgeGap = ((travelSign * (lineAt + (-alongPos))) + (-CROSSING_HALF_WIDTH));
  const gapMatters = (edgeGap > 0) && !(edgeGap > 14);
  if (!gapMatters) return;
  const phaseHalts = (phaseHeld === 'red') || (edgeGap > 6);
  if (!phaseHalts) return;
  const slowShare = Math.min(1, Math.max(0, (edgeGap + (-2)) / 12));
  cruiseCell.value = Math.min(cruiseCell.value, carHeld._cruiseOrig * slowShare); }
function cruiseUnderLights(carHeld, stateHeld, phaseHeld) {
  const cruiseCell = { value: carHeld._cruiseOrig };
  const lineSet = carHeld.onX ? stateHeld.roadZ : stateHeld.roadX;
  const alongPos = carHeld.onX ? carHeld.z : carHeld.x;
  const travelSign = signForCar(carHeld);
  (lineSet || []).forEach((lineAt) => weighStopLine(carHeld, phaseHeld, travelSign, alongPos, lineAt, cruiseCell));
  return cruiseCell.value; }
function applyLightsToCar(carHeld, stateHeld) {
  const driverIsTraffic = (carHeld.driver === 'traffic');
  const cruisePresent = (carHeld.cruise != null);
  if (!driverIsTraffic || !cruisePresent) return;
  if (carHeld._cruiseOrig == null) carHeld._cruiseOrig = carHeld.cruise;
  const phaseHeld = phaseForCar(carHeld, stateHeld);
  const phaseHalts = (phaseHeld === 'red') || (phaseHeld === 'yellow');
  carHeld.cruise = phaseHalts ? cruiseUnderLights(carHeld, stateHeld, phaseHeld) : carHeld._cruiseOrig; }
function runLightEnforcement(stateHeld) {
  const trafficMissing = !stateHeld.traffic;
  const lightsMissing = (typeof stateHeld.lightState !== 'function');
  if (trafficMissing || lightsMissing) return;
  stateHeld.traffic.forEach((carHeld) => applyLightsToCar(carHeld, stateHeld)); }
function ensureLightHook(stateHeld) {
  const hookBlocked = !stateHeld || stateHeld._lightHook || !Array.isArray(stateHeld.updaters);
  if (hookBlocked) return;
  stateHeld._lightHook = true;
  stateHeld.updaters.push((stateInner) => { try { runLightEnforcement(stateInner); } catch (swallowed) {} }); }
// Scooter traffic and parked props form their own agent set
// The scooter model shows up with its rider baked in and
// becomes weaving traffic plus parked props with riders
// waiting; a failed load spawns nothing and builds no
// stand-in, because all of it is pure garnish
const SCOOTER_TINT_LIST = [0xffffff, 0xffd9c9, 0xfff3b0, 0xbfe3ff, 0xe6ccff, 0xffc4c4];
function retintMaterial(srcMat, tintVal) {
  const matClone = srcMat.clone();
  if (matClone.color) matClone.color.setHex(tintVal);
  return matClone; }
function retintMeshNode(nodeHeld, tintVal) {
  if (!nodeHeld.isMesh || !nodeHeld.material) return;
  nodeHeld.material = Array.isArray(nodeHeld.material) ? nodeHeld.material.map((srcMat) => retintMaterial(srcMat, tintVal)) : retintMaterial(nodeHeld.material, tintVal); }
function tintedClone(modelWrap, tintVal) {
  const rootClone = modelWrap.clone(true);
  rootClone.traverse((nodeHeld) => retintMeshNode(nodeHeld, tintVal));
  return rootClone; }
function assignNewRoute(stateHeld, agentHeld) {
  agentHeld.onX = (rnd() < 0.5);
  agentHeld.line = pick(agentHeld.onX ? stateHeld.roadX : stateHeld.roadZ);
  agentHeld.dirSign = (rnd() < 0.5) ? 1 : -1;
  agentHeld.along = rr(-600, 600);
  agentHeld.travel = 0; }
function poseOnRoad(agentHeld, lateralOff, headingHeld) {
  if (agentHeld.onX) {
    agentHeld.x = ((agentHeld.line + (agentHeld.dirSign * 5)) + lateralOff); agentHeld.z = agentHeld.along;
  } else { agentHeld.x = agentHeld.along; agentHeld.z = ((agentHeld.line + (-(agentHeld.dirSign * 5))) + lateralOff); }
  return headingHeld; }
function baseHeadingFor(agentHeld) {
  const facingPair = agentHeld.onX ? [0, Math.PI] : [(Math.PI / 2), (-Math.PI / 2)];
  const [leadFacing, trailFacing] = facingPair;
  return (agentHeld.dirSign > 0) ? leadFacing : trailFacing; }
function syncAgentPose(agentHeld) {
  agentHeld.group.position.set(agentHeld.x, (groundH(agentHeld.x, agentHeld.z) + 0.02), agentHeld.z);
  agentHeld.group.rotation.y = agentHeld.angle; }
function tickScooters(stateHeld, dtHeld) {
  if (!stateHeld._vespas || !dtHeld) return;
  const elapsedHeld = (stateHeld.elapsed || 0);
  stateHeld._vespas.forEach((scootHeld) => {
    scootHeld.travel += (scootHeld.speed * dtHeld);
    scootHeld.along += ((scootHeld.speed * dtHeld) * scootHeld.dirSign);
    const routeStale = (scootHeld.travel > 500) || (Math.abs(scootHeld.along) > 655);
    if (routeStale) assignNewRoute(stateHeld, scootHeld);
    const weavePhaseAt = ((elapsedHeld * 0.9) + scootHeld.weavePhase);
    const weaveOffset = (Math.sin(weavePhaseAt) * 0.8);
    const wobbleHeld = (Math.cos(weavePhaseAt) * 0.06);
    poseOnRoad(scootHeld, weaveOffset, 0);
    scootHeld.angle = (baseHeadingFor(scootHeld) + wobbleHeld);
    syncAgentPose(scootHeld); }); }
const PARKED_SCOOTER_PLACES = [
  { x: -405, z: 448, angle: 0.7, tint: 1 }, { x: 330, z: 470, angle: -Math.PI / 2, tint: 3 },
  { x: 155, z: -145, angle: 2.35, tint: 5 } ];
function spawnMovingScooters(stateHeld, modelWrap) {
  for (let spawnPos = 0; spawnPos < 4; spawnPos++) {
    const tintHeld = SCOOTER_TINT_LIST[spawnPos % SCOOTER_TINT_LIST.length];
    const scootGroup = tintedClone(modelWrap, tintHeld);
    stateHeld.scene.add(scootGroup);
    const scootHeld = { group: scootGroup, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, weavePhase: rr(0, 2 * Math.PI), speed: rr(11, 15) };
    assignNewRoute(stateHeld, scootHeld);
    const bornX = scootHeld.onX ? (scootHeld.line + (scootHeld.dirSign * 5)) : scootHeld.along;
    const bornZ = scootHeld.onX ? scootHeld.along : (scootHeld.line + (-(scootHeld.dirSign * 5)));
    scootGroup.position.set(bornX, 0, bornZ);
    scootGroup.position.y = (groundH(scootGroup.position.x, scootGroup.position.z) + 0.02);
    stateHeld._vespas.push(scootHeld); } }
function spawnStillScooters(stateHeld, modelWrap) {
  stateHeld._parkedVespas = [];
  PARKED_SCOOTER_PLACES.forEach((spotHeld) => {
    const tintHeld = SCOOTER_TINT_LIST[spotHeld.tint % SCOOTER_TINT_LIST.length];
    const parkedGroup = tintedClone(modelWrap, tintHeld);
    parkedGroup.position.set(spotHeld.x, (groundH(spotHeld.x, spotHeld.z) + 0.02), spotHeld.z);
    parkedGroup.rotation.y = spotHeld.angle;
    stateHeld.scene.add(parkedGroup);
    stateHeld._parkedVespas.push(parkedGroup); }); }
export function initVespas(stateHeld) {
  const initBlocked = !stateHeld || stateHeld._vespasInit || !Array.isArray(stateHeld.updaters);
  if (initBlocked) return;
  stateHeld._vespasInit = true;
  stateHeld._vespas = [];
  stateHeld.updaters.push((stateInner, dtInner) => { try { tickScooters(stateInner, dtInner); } catch (swallowed) {} });
  initSportbikes(stateHeld);
  loadHeroAsset('npcVespa').then((modelWrap) => { try {
      if (!modelWrap) return;
      spawnMovingScooters(stateHeld, modelWrap);
      spawnStillScooters(stateHeld, modelWrap);
    } catch (swallowed) { /* garnish only */ }
  }).catch(() => {}); }

// Sportbike traffic rides with the scooters and shares their
// road lane and respawn conventions, plus the same clone
// tint helper and hook style
// They hold a straight line along roads and respawn instead
// of turning at crossings, so the weave does their cornering
// for them and the lean banks them into it
// Garnish only once more: a null load spawns nothing at all
const BIKE_TINT_LIST = [0xffffff, 0xdfe8ff, 0xffe3f2, 0xe8ffe3];
function assembleBike(modelWrap, tintVal) {
  const outerHeld = new THREE.Group();
  const innerHeld = new THREE.Group();
  innerHeld.rotation.y = -Math.PI / 2;
  innerHeld.add(tintedClone(modelWrap, tintVal));
  outerHeld.add(innerHeld);
  outerHeld.userData.inner = innerHeld;
  return outerHeld; }
function tickBikes(stateHeld, dtHeld) {
  if (!stateHeld._sportbikes || !dtHeld) return;
  const elapsedHeld = (stateHeld.elapsed || 0);
  stateHeld._sportbikes.forEach((bikeHeld) => {
    bikeHeld.travel += (bikeHeld.speed * dtHeld);
    bikeHeld.along += ((bikeHeld.speed * dtHeld) * bikeHeld.dirSign);
    const routeStale = (bikeHeld.travel > 500) || (Math.abs(bikeHeld.along) > 655);
    if (routeStale) assignNewRoute(stateHeld, bikeHeld);
    const weavePhaseAt = ((elapsedHeld * 1.7) + bikeHeld.weavePhase);
    const lateralOff = (Math.sin(weavePhaseAt) * 1.1);
    const lateralRate = ((Math.cos(weavePhaseAt) * 1.1) * 1.7);
    const wobbleHeld = (Math.cos(weavePhaseAt) * 0.06);
    poseOnRoad(bikeHeld, lateralOff, 0);
    bikeHeld.angle = (baseHeadingFor(bikeHeld) + wobbleHeld);
    syncAgentPose(bikeHeld);
    if (bikeHeld.inner) bikeHeld.inner.rotation.z = THREE.MathUtils.clamp((lateralRate * -0.30), -0.38, 0.38); }); }
function spawnSingleBike(stateHeld, modelWrap, spawnPos) {
  const tintHeld = BIKE_TINT_LIST[spawnPos % BIKE_TINT_LIST.length];
  const bikeGrp = assembleBike(modelWrap, tintHeld);
  stateHeld.scene.add(bikeGrp);
  const bikeHeld = { group: bikeGrp, inner: bikeGrp.userData.inner, onX: false, line: 0, dirSign: 1, along: 0, travel: 0, x: 0, z: 0, angle: 0, weavePhase: rr(0, 2 * Math.PI), speed: rr(19, 26) };
  assignNewRoute(stateHeld, bikeHeld);
  const bornX = bikeHeld.onX ? (bikeHeld.line + (bikeHeld.dirSign * 5)) : bikeHeld.along;
  const bornZ = bikeHeld.onX ? bikeHeld.along : (bikeHeld.line + (-(bikeHeld.dirSign * 5)));
  bikeGrp.position.set(bornX, 0, bornZ);
  bikeGrp.position.y = (groundH(bikeGrp.position.x, bikeGrp.position.z) + 0.02);
  stateHeld._sportbikes.push(bikeHeld); }
export function initSportbikes(stateHeld) {
  const initBlocked = !stateHeld || stateHeld._sportbikesInit || !Array.isArray(stateHeld.updaters);
  if (initBlocked) return;
  stateHeld._sportbikesInit = true;
  stateHeld._sportbikes = [];
  stateHeld.updaters.push((stateInner, dtInner) => { try { tickBikes(stateInner, dtInner); } catch (swallowed) {} });
  loadHeroAsset('npcSportbike').then((modelWrap) => { try {
      if (!modelWrap) return;
      for (let spawnPos = 0; spawnPos < 3; spawnPos++) spawnSingleBike(stateHeld, modelWrap, spawnPos);
    } catch (swallowed) { /* garnish only */ }
  }).catch(() => {}); }
// Radio state is mirrored onto shared state, which lets the
// HUD draw its chip without reaching into audio, and the
// choice survives from one drive into the next
function mirrorRadio(stateHeld, stationHeld) { try {
    const stationThere = !!stationHeld;
    stateHeld._radioOff = !stationThere;
    stateHeld.radioName = stationThere ? stationHeld.name : null;
    if (stationThere) stateHeld._radioIdx = stationHeld.index;
  } catch (swallowed) {} }
function beginRadioForDrive(stateHeld) {
  try {
    const radioThere = stateHeld.audio && stateHeld.audio.radio;
    if (radioThere && !stateHeld._radioOff) mirrorRadio(stateHeld, stateHeld.audio.radio.start(stateHeld._radioIdx || 0));
    else if (stateHeld._radioOff) { stateHeld.radioName = null; }
  } catch (swallowed) {} }
export function enterCar(stateHeld, carHeld) {
  ensureLightHook(stateHeld);
  if (!stateHeld.player) return;
  stateHeld.player.fig.visible = false;
  if (!carHeld.driverFig) {
    carHeld.driverFig = makeFigure(CAST.ren);
    poseSeated(carHeld.driverFig);
    carHeld.driverFig.scale.setScalar(0.96); }
  carHeld.driverFig.position.set((carHeld.spec.wid * -0.22), 0.42, 0.15);
  carHeld.driverFig.rotation.y = 0;
  carHeld.mesh.add(carHeld.driverFig);
  carHeld.driver = 'player';
  stateHeld.car = carHeld;
  stateHeld.flags.inCar = true;
  try { if (stateHeld.audio && stateHeld.audio.setEngine) stateHeld.audio.setEngine(true, 0.07); } catch (swallowed) {}
  beginRadioForDrive(stateHeld); }
function quietCarAudio(stateHeld) {
  try { if (stateHeld._hornActive && stateHeld.audio && stateHeld.audio.hornStop) stateHeld.audio.hornStop(); } catch (swallowed) {}
  stateHeld._hornActive = false; stateHeld._hornT = 0; stateHeld._hornWasDown = false;
  try { if (stateHeld.audio && stateHeld.audio.setEngine) stateHeld.audio.setEngine(false, 0); } catch (swallowed) {}
  try { if (stateHeld.audio && stateHeld.audio.screech) stateHeld.audio.screech(false, 0); } catch (swallowed) {}
  try { if (stateHeld.audio && stateHeld.audio.radio) stateHeld.audio.radio.stop(); } catch (swallowed) {}
  stateHeld.radioName = null; stateHeld._radioWasDown = false; }
export function exitCar(stateHeld) {
  const carHeld = stateHeld.car;
  if (!carHeld) return;
  quietCarAudio(stateHeld);
  if (carHeld.driverFig) carHeld.mesh.remove(carHeld.driverFig);
  carHeld.driver = 'parked'; carHeld.speed = 0;
  stateHeld.car = null; stateHeld.flags.inCar = false;
  stateHeld.speedKmh = 0;
  const heroRec = stateHeld.player;
  const exitReach = (carHeld.spec.wid / 2);
  heroRec.x = (carHeld.x + (Math.cos(carHeld.angle) * -(exitReach + 1.2)));
  heroRec.z = (carHeld.z + (Math.sin(carHeld.angle) * (exitReach + 1.2)));
  heroRec.x = (carHeld.x + (-(Math.cos(carHeld.angle) * (exitReach + 1.1))));
  heroRec.z = (carHeld.z + (Math.sin(carHeld.angle) * (exitReach + 1.1)));
  heroRec.angle = carHeld.angle;
  heroRec.fig.visible = true;
  heroRec.fig.position.set(heroRec.x, groundH(heroRec.x, heroRec.z), heroRec.z); }

function beginHorn(stateHeld, carHeld) {
  try { if (stateHeld.audio && stateHeld.audio.hornStart) stateHeld.audio.hornStart(); else if (stateHeld.audio && stateHeld.audio.horn) stateHeld.audio.horn(0.35); } catch (swallowed) {}
  stateHeld._hornActive = true; stateHeld._hornT = 0;
  try { if (typeof stateHeld.pedsStartle === 'function') stateHeld.pedsStartle(carHeld.x, carHeld.z, 12); } catch (swallowed) {} }
function endHorn(stateHeld) {
  try { if (stateHeld.audio && stateHeld.audio.hornStop) stateHeld.audio.hornStop(); } catch (swallowed) {}
  stateHeld._hornActive = false; stateHeld._hornT = 0; stateHeld._hornCooldown = 0.25; }
function tickHorn(stateHeld, carHeld, keysHeld, dtHeld) {
  // Horn handling: key events in the main module fill the
  // key map, and this updater runs only in play mode,
  // unpaused, inside a car, so on foot or in menus the horn
  // stays inert
  // The press edge starts the horn and startles pedestrians,
  // exactly once
  // A tap still sounds briefly; holding sustains up to a
  // cap; releasing past the minimum, or hitting the cap,
  // stops it, honks stay spaced apart, and holding past the
  // cap never retriggers
  const hornDown = !!(keysHeld && keysHeld['KeyH']);
  if (stateHeld._hornCooldown == null) stateHeld._hornCooldown = 0;
  if (stateHeld._hornCooldown > 0) stateHeld._hornCooldown -= dtHeld;
  const startAllowed = hornDown && !stateHeld._hornWasDown && !stateHeld._hornActive && !(stateHeld._hornCooldown > 0);
  if (startAllowed) beginHorn(stateHeld, carHeld);
  if (stateHeld._hornActive) {
    stateHeld._hornT = ((stateHeld._hornT || 0) + dtHeld);
    const hornOverCap = (stateHeld._hornT >= 1.2);
    const hornLetGo = !hornDown && (stateHeld._hornT >= 0.18);
    if (hornOverCap || hornLetGo) endHorn(stateHeld); }
  stateHeld._hornWasDown = hornDown; }
function tickRadioKeys(stateHeld, keysHeld) {
  // Radio handling: keydown edge only, so auto repeat can
  // never cycle it, and inert on foot because this updater
  // only ever runs inside a car
  // The cycle walks the stations and then off, and the
  // mirror helper keeps the choice ready for the next drive
  const radioDown = !!(keysHeld && keysHeld['KeyR']);
  if (radioDown && !stateHeld._radioWasDown) {
    try { if (stateHeld.audio && stateHeld.audio.radio) mirrorRadio(stateHeld, stateHeld.audio.radio.next()); } catch (swallowed) {} }
  stateHeld._radioWasDown = radioDown; }
function readThrottle(keysHeld, carHeld) {
  let throttleHeld = 0;
  if (keysHeld['KeyW'] || keysHeld['ArrowUp']) throttleHeld = 1;
  if (keysHeld['KeyS'] || keysHeld['ArrowDown']) throttleHeld = (carHeld.speed > 0.5) ? -1.6 : -0.55;
  return throttleHeld; }
function readSteer(keysHeld) {
  let steerHeld = 0;
  if (keysHeld['KeyA'] || keysHeld['ArrowLeft']) steerHeld = 1;
  if (keysHeld['KeyD'] || keysHeld['ArrowRight']) steerHeld = -1;
  return steerHeld; }
function junctionKeyAt(stateHeld, posX, posZ) {
  const foundHeld = { key: null };
  for (const lineX of stateHeld.roadX) if (Math.abs(posX + (-lineX)) < 12)
    for (const lineZ of stateHeld.roadZ) if (Math.abs(posZ + (-lineZ)) < 12) foundHeld.key = (lineX + ',' + lineZ);
  return foundHeld.key; }
function checkRedLightRun(stateHeld, carHeld, fromX, fromZ) {
  // Running a junction box on red heats the wanted level,
  // and the clamp here matches the shooting layer one
  try {
    const lightsThere = (typeof stateHeld.lightState === 'function');
    const movingFast = (Math.abs(carHeld.speed) > 6);
    if (!lightsThere || !movingFast) return;
    const junctionHeld = junctionKeyAt(stateHeld, carHeld.x, carHeld.z);
    const junctionBefore = junctionKeyAt(stateHeld, fromX, fromZ);
    if (!junctionHeld || junctionBefore) return;
    const axisKey = (Math.abs(Math.cos(carHeld.angle)) < Math.abs(Math.sin(carHeld.angle))) ? 'x' : 'z';
    if (stateHeld.lightState(axisKey) !== 'red') return;
    const elapsedHeld = (stateHeld.elapsed || 0);
    const sameJunction = (stateHeld._lastRedKey === junctionHeld);
    const flaggedLately = ((elapsedHeld + (-(stateHeld._lastRedT || -10))) > 4);
    if (!sameJunction || flaggedLately) {
      stateHeld._lastRedKey = junctionHeld; stateHeld._lastRedT = elapsedHeld;
      stateHeld.wanted = Math.min(5, Math.max(0, ((stateHeld.wanted || 0) + 0.15))); }
  } catch (swallowed) {} }
function ejectVehicle(stateHeld, carHeld, colliderHeld, offX, offZ, penX, penZ) {
  if (penZ > penX) carHeld.x += (0 <= offX) ? penX : -penX;
  else carHeld.z += (0 <= offZ) ? penZ : -penZ;
  if (Math.abs(carHeld.speed) > 6) { damageVehicle(stateHeld, carHeld, (Math.abs(carHeld.speed) * 0.7)); stateHeld.flags.crashTimer = 1; }
  carHeld.speed *= -0.25; }
function collideWithStatics(stateHeld, carHeld) {
  for (const colliderHeld of stateHeld.colliders) {
    const offX = (carHeld.x + (-colliderHeld.x)), offZ = (carHeld.z + (-colliderHeld.z));
    const penX = ((colliderHeld.hw + 1.6) + (-Math.abs(offX)));
    const penZ = ((colliderHeld.hd + 1.6) + (-Math.abs(offZ)));
    const touchingHeld = (penX > 0) && (penZ > 0);
    if (!touchingHeld) continue;
    ejectVehicle(stateHeld, carHeld, colliderHeld, offX, offZ, penX, penZ); } }
function collideWithTraffic(stateHeld, carHeld) {
  if (!stateHeld.traffic) return;
  stateHeld.traffic.forEach((otherHeld) => {
    if (otherHeld === carHeld) return;
    const gapHeld = Math.hypot((otherHeld.x + (-carHeld.x)), (otherHeld.z + (-carHeld.z)));
    const contactHeld = (gapHeld < 2.6) && (gapHeld > 0.01);
    if (!contactHeld) return;
    const pushSpan = (2.6 + (-gapHeld));
    otherHeld.x += (((otherHeld.x + (-carHeld.x)) / gapHeld) * pushSpan * 0.6);
    otherHeld.z += (((otherHeld.z + (-carHeld.z)) / gapHeld) * pushSpan * 0.6);
    otherHeld.speed = (carHeld.speed * 0.4);
    if (Math.abs(carHeld.speed) > 5) { damageVehicle(stateHeld, otherHeld, 8); damageVehicle(stateHeld, carHeld, 5); stateHeld.flags.crashTimer = 1; }
    carHeld.speed *= 0.55; }); }
function createHeadlights(carHeld, specHeld) {
  carHeld.spotL = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
  carHeld.spotR = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5);
  carHeld.mesh.add(carHeld.spotL); carHeld.mesh.add(carHeld.spotR);
  carHeld.mesh.add(carHeld.spotL.target); carHeld.mesh.add(carHeld.spotR.target);
  carHeld.spotL.position.set(-0.6, 0.8, specHeld.len / 2);
  carHeld.spotR.position.set(0.6, 0.8, specHeld.len / 2);
  carHeld.spotL.target.position.set(-1.2, 0, (specHeld.len / 2) + 22);
  carHeld.spotR.target.position.set(1.2, 0, (specHeld.len / 2) + 22); }
function refreshHeadlights(stateHeld, carHeld, specHeld) {
  const nightHeld = (stateHeld.timeOfDay > 18.5) || (stateHeld.timeOfDay < 5.5);
  if (!carHeld.spotL) createHeadlights(carHeld, specHeld);
  carHeld.spotL.intensity = nightHeld ? 60 : 0; carHeld.spotR.intensity = nightHeld ? 60 : 0;
  return nightHeld; }
function loadForEngine(speedShare, throttleHeld) {
  const extraLoad = (throttleHeld > 0) ? 0.3 : ((throttleHeld < 0) ? 0.12 : 0);
  return Math.max(0.07, Math.min(1, ((speedShare * 0.85) + extraLoad))); }
function shareForScreech(stateHeld, carHeld, brakeDown, speedShare) {
  return Math.min(1, ((Math.abs(carHeld.steerVis || 0) * 1.4) + (brakeDown ? 0.45 : 0.15) + (speedShare * 0.25))); }
function maybePlayCrash(stateHeld, carHeld, healthWas) {
  const crashHeard = stateHeld.audio.crash && (healthWas != null) && (typeof carHeld.health === 'number') && (carHeld.health < healthWas);
  if (crashHeard) {
    const elapsedHeld = (stateHeld.elapsed || 0);
    if ((elapsedHeld + (-(stateHeld._lastCrashSfxT || -10))) > 0.12) {
      stateHeld._lastCrashSfxT = elapsedHeld;
      stateHeld.audio.crash(Math.min(1, ((healthWas + (-carHeld.health)) / 15))); } } }
function tickVehicleAudio(stateHeld, carHeld, throttleHeld, brakeDown, topEff, healthWas) {
  // Vehicle audio per frame: engine load follows the speed
  // fraction and throttle, screech follows drifting or
  // handbrake slides past a speed threshold with intensity
  // from the slip, and any health drop inside the frame
  // counts as a crash, scaled by the damage dealt
  try {
    if (!stateHeld.audio) return;
    const speedShare = Math.min(1, (Math.abs(carHeld.speed) / Math.max(1, topEff)));
    if (stateHeld.audio.setEngine) stateHeld.audio.setEngine(true, loadForEngine(speedShare, throttleHeld));
    if (stateHeld.audio.screech) {
      const slidingHeld = (brakeDown || !!stateHeld.flags.drifting) && (Math.abs(carHeld.speed) > 8);
      stateHeld.audio.screech(slidingHeld, slidingHeld ? shareForScreech(stateHeld, carHeld, brakeDown, speedShare) : 0); }
    maybePlayCrash(stateHeld, carHeld, healthWas);
  } catch (swallowed) {} }
function applyThrottleInput(stateHeld, carHeld, throttleHeld, accelRate, topEff, nosDown, dtHeld) {
  if (throttleHeld > 0) carHeld.speed += ((accelRate * dtHeld) * (nosDown ? 1.8 : 1) * (1 + (-(Math.max(0, carHeld.speed) / (topEff * (nosDown ? 1.15 : 1))))));
  else if (throttleHeld < 0) carHeld.speed += ((throttleHeld * 10) * dtHeld);
  else carHeld.speed = (carHeld.speed + (-(carHeld.speed * 0.35 * dtHeld)));
  carHeld.speed = (carHeld.speed + (-(carHeld.speed * 0.12 * dtHeld)));
  const reverseFloor = -9;
  const cappedSpeed = Math.min((topEff * 1.18), carHeld.speed);
  carHeld.speed = Math.max(reverseFloor, cappedSpeed);
  if ((Math.abs(carHeld.speed) < 0.02) && (throttleHeld === 0)) carHeld.speed = 0; }
function applySteerInput(carHeld, steerHeld, brakeDown, specHeld, dtHeld) {
  const speedShare = Math.min(1, ((Math.abs(carHeld.speed) / 8) + 0.25));
  const steerRate = (speedShare * ((specHeld.grip * 1.15) + (brakeDown ? (specHeld.drift * 0.9) : 0)));
  if (carHeld.speed !== 0) carHeld.angle += (((steerHeld * steerRate) * dtHeld) * Math.sign(carHeld.speed) * (brakeDown ? 1.25 : 1));
  carHeld.steerVis += (((steerHeld * 0.45) + (-carHeld.steerVis)) * Math.min(1, (dtHeld * 10)));
  if (brakeDown) carHeld.speed -= ((carHeld.speed * 1.1) * dtHeld); }
function emitSmoke(stateHeld, carHeld, specHeld, brakeDown, steerHeld, nosDown) {
  if (nosDown) {
    const exhaustX = (carHeld.x + (-(Math.sin(carHeld.angle) * ((specHeld.len / 2) + 0.3))));
    const exhaustZ = (carHeld.z + (-(Math.cos(carHeld.angle) * ((specHeld.len / 2) + 0.3))));
    spawnSmokeAt(stateHeld, { x: exhaustX, y: (groundH(carHeld.x, carHeld.z) + 0.4), z: exhaustZ }, 1, true);
    stateHeld.flags.nosActive = true;
  } else stateHeld.flags.nosActive = false;
  const slideWide = (Math.abs(steerHeld) !== 0) && (Math.abs(carHeld.speed) > 12);
  if ((brakeDown && (Math.abs(carHeld.speed) > 5)) || slideWide && brakeDown) spawnSmokeAt(stateHeld, carHeld.mesh.position, 1, false); }
function syncCarMesh(stateHeld, carHeld, throttleHeld, brakeDown, dtHeld) {
  const groundY = groundH(carHeld.x, carHeld.z);
  carHeld.mesh.position.set(carHeld.x, (groundY + 0.02), carHeld.z);
  carHeld.mesh.rotation.set(0, carHeld.angle, 0);
  carHeld.mesh.rotateX(THREE.MathUtils.clamp((throttleHeld * -0.012), -0.02, 0.02));
  carHeld.mesh.rotateZ(THREE.MathUtils.clamp(((carHeld.steerVis * Math.abs(carHeld.speed)) * 0.0012), -0.05, 0.05));
  const wheelRadius = (carHeld.mesh.userData.wheelR || 0.33);
  const spinStep = ((carHeld.speed * dtHeld) / wheelRadius);
  const spinOneWheel = (wheelHeld, steerAng) => {
    if (!wheelHeld) return;
    wheelHeld.userData.spin = ((wheelHeld.userData.spin || 0) + spinStep);
    wheelHeld.rotation.set(wheelHeld.userData.spin, steerAng, 0); };
  spinOneWheel(carHeld.wheels.rl, 0); spinOneWheel(carHeld.wheels.rr, 0);
  spinOneWheel(carHeld.wheels.fl, carHeld.steerVis); spinOneWheel(carHeld.wheels.fr, carHeld.steerVis);
  stateHeld.speedKmh = (Math.abs(carHeld.speed) * 3.6);
  if (carHeld.mesh.userData.tailMat) carHeld.mesh.userData.tailMat.emissiveIntensity = ((throttleHeld < 0) || brakeDown) ? 2.2 : 0.8; }
function applyImpactDamage(stateHeld, carHeld, healthWas, dtHeld) {
  // Driver health from impacts: every collision path in
  // this frame funnels through car health, which makes the
  // frame delta the impact measure, and a big enough delta
  // hurts the driver as well
  if ((healthWas != null) && (typeof carHeld.health === 'number')) {
    const healthDrop = (healthWas + (-carHeld.health));
    if (healthDrop > 7) { try { stateHeld.damagePlayer?.(((healthDrop + (-6)) * 1.6)); } catch (swallowed) {} } }
  const atEdge = (Math.abs(carHeld.x) >= 655) || (Math.abs(carHeld.z) >= 655);
  if (atEdge) { try { stateHeld.damagePlayer?.((dtHeld * 18)); } catch (swallowed) {} } }
export function updateDriving(stateHeld, dtHeld) {
  ensureLightHook(stateHeld);
  const carHeld = stateHeld.car;
  if (!carHeld) return;
  const specHeld = carHeld.spec;
  const keysHeld = stateHeld.keys;
  const healthWas = (typeof carHeld.health === 'number') ? carHeld.health : null;
  tickHorn(stateHeld, carHeld, keysHeld, dtHeld);
  tickRadioKeys(stateHeld, keysHeld);
  // A battered car loses pace: for this frame only, the
  // effective top speed and acceleration scale down; the
  // spec itself is never mutated, and the clamp below reads
  // the scaled top speed
  const batteredShare = ((typeof carHeld.health === 'number') && (carHeld.health < 35)) ? 0.72 : 1;
  const topEff = (batteredShare * (specHeld.topSpeed / 3.6));
  const nosDown = (keysHeld['ShiftLeft'] || keysHeld['ShiftRight']) && (carHeld.speed > 2);
  const throttleHeld = readThrottle(keysHeld, carHeld);
  const accelRate = (batteredShare * ((specHeld.accel * 16) + 6));
  applyThrottleInput(stateHeld, carHeld, throttleHeld, accelRate, topEff, nosDown, dtHeld);
  const steerHeld = readSteer(keysHeld);
  const brakeDown = !!keysHeld['Space'];
  applySteerInput(carHeld, steerHeld, brakeDown, specHeld, dtHeld);
  emitSmoke(stateHeld, carHeld, specHeld, brakeDown, steerHeld, nosDown);
  const fromX = carHeld.x, fromZ = carHeld.z;
  carHeld.x += ((carHeld.speed * dtHeld) * Math.sin(carHeld.angle));
  carHeld.z += ((carHeld.speed * dtHeld) * Math.cos(carHeld.angle));
  collideWithStatics(stateHeld, carHeld);
  checkRedLightRun(stateHeld, carHeld, fromX, fromZ);
  collideWithTraffic(stateHeld, carHeld);
  carHeld.x = Math.max(-656, Math.min(656, carHeld.x));
  carHeld.z = Math.max(-656, Math.min(656, carHeld.z));
  syncCarMesh(stateHeld, carHeld, throttleHeld, brakeDown, dtHeld);
  refreshHeadlights(stateHeld, carHeld, specHeld);
  tickVehicleAudio(stateHeld, carHeld, throttleHeld, brakeDown, topEff, healthWas);
  applyImpactDamage(stateHeld, carHeld, healthWas, dtHeld);
  stateHeld.camTarget = { x: carHeld.x, z: carHeld.z, angle: carHeld.angle, speed: carHeld.speed }; }
