// Boot, the frame loop, cameras, wiring and shot mode all live here
import * as THREE from 'three'; import { CFG } from './config.js';
import { srand } from './random.js'; import { buildWorld, updateWorld, groundH, glowSprite } from './world.js';
import { initSky, updateSky } from './sky.js'; import { setupShot } from './shots.js';
import { spawnTraffic, updateTraffic, updateSmoke, spawnVehicle } from './cars.js'; import { createPlayer, updatePlayer } from './player.js';
import { updateDriving, enterCar, exitCar, initVespas } from './drive.js'; import { initSave } from './save.js';
import { initPeds } from './peds.js'; import { initPolice } from './police.js';
import { initMissions } from './missions.js'; import { initHUD } from './hud.js';
import { initAudio } from './audio.js'; import { initWeapons } from './weapons.js';
import { heroAssetsReady } from './assets.js';
const searchHeld = new URLSearchParams(location.search);
const FALLBACK_SEED = 1;
function readSeed() {
  const rawHeld = searchHeld.get('seed');
  const textHeld = rawHeld || String(FALLBACK_SEED);
  const parsedHeld = parseInt(textHeld, 10);
  return parsedHeld ? parsedHeld : FALLBACK_SEED; }
const seedHeld = readSeed();
const shotHeld = searchHeld.get('shot');
srand(seedHeld);
const canvasNode = document.getElementById('gameCanvas');
// The sun shadow boot numbers are gathered in one spot, which
// keeps retuning shadows a one line change; the boot block
// underneath simply reads its values from here
const SHADOW_TUNING = { mapSize: 2048, box: 110, near: 10, far: 600, bias: -0.0005, normalBias: 0.5 };
const SUN_OFFSET_SCRATCH = new THREE.Vector3();
const rendererHeld = new THREE.WebGLRenderer({ canvas: canvasNode, antialias: true });
rendererHeld.shadowMap.enabled = true;
rendererHeld.shadowMap.type = THREE.PCFSoftShadowMap;
rendererHeld.setPixelRatio(Math.min(devicePixelRatio, 1.5));
rendererHeld.setSize(innerWidth, innerHeight);
const sceneHeld = new THREE.Scene();
sceneHeld.background = new THREE.Color(0x87c5eb);
sceneHeld.fog = new THREE.Fog(0x87c5eb, 220, 900);
const cameraHeld = new THREE.PerspectiveCamera(66, (innerWidth / innerHeight), 0.1, 3000);
cameraHeld.position.set(-412, 4, 486);
const hemiHeld = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 0.9);
sceneHeld.add(hemiHeld);
const sunHeld = new THREE.DirectionalLight(0xfff2d8, 1.3);
sunHeld.position.set(200, 260, 120);
sceneHeld.add(sunHeld);
// Shadow setup, plus the follow contract that comes with it
// Every shadow comes from the sun; the ortho box, the map
// size and the biases all come from the tuning above, set
// against acne on low poly facades, and three owners move
// the light later without touching those values: the world
// updater repositions from the time of day each frame and
// leaves the target alone, the main loop anchors position
// and target on the player or the car, and shot modes pin
// the light on their staged look point with a tighter box
function applyShadowTuning() {
  sunHeld.castShadow = true;
  sunHeld.shadow.mapSize.set(SHADOW_TUNING.mapSize, SHADOW_TUNING.mapSize);
  const camHeld = sunHeld.shadow.camera;
  camHeld.left = -SHADOW_TUNING.box;
  camHeld.right = SHADOW_TUNING.box;
  camHeld.top = SHADOW_TUNING.box;
  camHeld.bottom = -SHADOW_TUNING.box;
  camHeld.near = SHADOW_TUNING.near;
  camHeld.far = SHADOW_TUNING.far;
  sunHeld.shadow.bias = SHADOW_TUNING.bias;
  sunHeld.shadow.normalBias = SHADOW_TUNING.normalBias;
  camHeld.updateProjectionMatrix(); }
applyShadowTuning();
function districtRecord(controlHeld, ownerHeld) {
  return { control: controlHeld, owner: ownerHeld }; }
function freshDistrictState() {
  return {
    port: districtRecord(50, 'ronin'), coral: districtRecord(30, 'neutral'),
    neon: districtRecord(20, 'rival'), hoshino: districtRecord(10, 'rival'),
  }; }
const G = { elapsed: 0, camDist: 7, camYaw: Math.PI, sun: sunHeld,
  hemi: hemiHeld, water: null, hq: null, shadowFollow: true,
  scene: sceneHeld, camera: cameraHeld, renderer: rendererHeld, canvas: canvasNode,
  mode: shotHeld ? 'play' : 'menu', shot: shotHeld, seed: seedHeld, keys: {},
  timeOfDay: shotHeld ? 17.9 : CFG.startHour, money: 500, rep: 0, rankIdx: 0, wanted: 0, speedKmh: 0,
  car: null, player: null, paused: false, shotCam: null, flags: {}, updaters: [],
  colliders: [],
  addCollider(x, z, hw, hd, h) { this.colliders.push({ x, z, hw, hd, h }); },
  roadX: [], roadZ: [], touge: [], missionIndex: 0, districtState: freshDistrictState(),
  audio: null, heli: null, cops: [], peds: [], vehicles: [], traffic: [], exitCar: null,
  enterCar: null, garage: ['hachi'], ownedCars: ['hachi'] };
G.enterCar = (vehicleHeld) => enterCar(G, vehicleHeld); G.exitCar = () => exitCar(G);
window.G = G;
initSave(G);
// The world builder reads the anisotropy value guarded, so it
// has to exist before the world build runs
G.maxAniso = rendererHeld.capabilities.getMaxAnisotropy();
buildWorld(G); initSky(G);
createPlayer(G);
const starterCarHeld = spawnVehicle(G, 'hachi', -412.5, 452, Math.PI, { driver: 'parked' });
G.starterCar = starterCarHeld;
function placeParkedCar(modelKey, posX, posZ, headingHeld) {
  return spawnVehicle(G, modelKey, posX, posZ, headingHeld, { driver: 'parked' }); }
placeParkedCar('svj', -430, 452, 0.9); spawnTraffic(G, 14);
placeParkedCar('sedan', 154, 300, 0);
placeParkedCar('hatch', 176, -60, Math.PI);
placeParkedCar('wagon', -60, 484, Math.PI / 2);
placeParkedCar('suv', 60, 506, -Math.PI / 2);
placeParkedCar('kei', 319, -140, 0);
placeParkedCar('van', 341, -420, Math.PI);
placeParkedCar('roadster', -140, 319, Math.PI / 2);
placeParkedCar('sedan', 420, -341, -Math.PI / 2);
initVespas(G); initPeds(G);
initPolice(G);
initMissions(G);
initHUD(G);
initAudio(G);
initWeapons(G);

// A hospital marker stands at the wasted respawn corner: a
// single pole and a white sign carrying a red cross canvas
// texture, while the world module itself stays untouched
function drawCrossTexture() {
  const cvHeld = document.createElement('canvas');
  cvHeld.width = 128;
  cvHeld.height = 128;
  const penHeld = cvHeld.getContext('2d');
  penHeld.fillStyle = '#ffffff';
  penHeld.fillRect(0, 0, 128, 128);
  penHeld.fillStyle = '#d8232a';
  penHeld.fillRect(52, 24, 24, 80);
  penHeld.fillRect(24, 52, 80, 24);
  return new THREE.CanvasTexture(cvHeld); }
function buildHospitalMarker() {
  const spotX = 335, spotZ = -335;
  const poleHeld = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.6 }));
  poleHeld.position.set(spotX, (groundH(spotX, spotZ) + 2.5), spotZ);
  sceneHeld.add(poleHeld);
  const boardHeld = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.25), new THREE.MeshBasicMaterial({ map: drawCrossTexture() }));
  boardHeld.position.set(spotX, (groundH(spotX, spotZ) + 5.4), spotZ);
  boardHeld.rotation.y = (Math.PI / 4);
  sceneHeld.add(boardHeld); }
buildHospitalMarker();
// Pickups split into cash spots and health spots, and every
// one is a glow disc that spins and bobs where it sits
const PICKUP_SPOTS = [
  { type: 'cash', amount: 100, x: 174, z: -156 }, { type: 'cash', amount: 125, x: 165, z: 488 },
  { type: 'cash', amount: 150, x: 338, z: 420 }, { type: 'cash', amount: 150, x: 322, z: 545 },
  { type: 'cash', amount: 90, x: -174, z: 156 }, { type: 'cash', amount: 110, x: -488, z: -174 },
  { type: 'cash', amount: 150, x: -322, z: -590 }, { type: 'cash', amount: 75, x: -338, z: 338 },
  { type: 'health', amount: 30, x: 326, z: -322 }, { type: 'health', amount: 30, x: -404, z: 460 },
  { type: 'health', amount: 30, x: -156, z: -338 }, { type: 'health', amount: 30, x: 488, z: 488 },
  { type: 'health', amount: 30, x: 488, z: 404 }, { type: 'health', amount: 30, x: -276, z: -586 },
];
function makeGlyphTexture(glyphHeld, tintHeld) {
  const cvHeld = document.createElement('canvas');
  cvHeld.width = 128;
  cvHeld.height = 128;
  const penHeld = cvHeld.getContext('2d');
  penHeld.clearRect(0, 0, 128, 128);
  penHeld.fillStyle = tintHeld;
  penHeld.font = 'bold 84px Arial, sans-serif';
  penHeld.textAlign = 'center';
  penHeld.textBaseline = 'middle';
  penHeld.fillText(glyphHeld, 64, 70);
  return new THREE.CanvasTexture(cvHeld); }
G.pickups = [];
function placePickup(spotHeld) {
  const isCash = (spotHeld.type === 'cash');
  const groupHeld = new THREE.Group();
  const groundY = groundH(spotHeld.x, spotHeld.z);
  const discHeld = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24),
    new THREE.MeshBasicMaterial({ color: isCash ? 0x2eff7a : 0xff4b4b, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  discHeld.rotation.x = (-Math.PI / 2);
  discHeld.position.y = 0.12;
  groupHeld.add(discHeld);
  try { const haloHeld = glowSprite(isCash ? 0x2eff7a : 0xff4b4b, 4.2); haloHeld.position.y = 1.1; groupHeld.add(haloHeld); } catch (swallowed) {}
  const glyphHeld = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: makeGlyphTexture(isCash ? '$' : '+', isCash ? '#baffd2' : '#ffd2d2'), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  glyphHeld.position.y = 1.15;
  groupHeld.add(glyphHeld);
  groupHeld.position.set(spotHeld.x, groundY, spotHeld.z);
  sceneHeld.add(groupHeld);
  const phaseHeld = ((G.pickups.length * 1.93) % 6.28);
  G.pickups.push({ ...spotHeld, group: groupHeld, icon: glyphHeld, disc: discHeld, active: true, respawnT: 0, phase: phaseHeld }); }
PICKUP_SPOTS.forEach(placePickup);
function resetPickup(pickupHeld) {
  pickupHeld.group.visible = true;
  pickupHeld.active = true; }
function animatePickup(pickupHeld, dtHeld, elapsedHeld) {
  pickupHeld.icon.rotation.y += (dtHeld * 2.4);
  pickupHeld.disc.rotation.z += (dtHeld * 1.2);
  pickupHeld.icon.position.y = (1.15 + (Math.sin((elapsedHeld * 2.2) + pickupHeld.phase) * 0.18)); }
function awardPickup(stateArg, pickupObj) {
  pickupObj.active = false;
  pickupObj.group.visible = false; pickupObj.respawnT = 60;
  if (pickupObj.type === 'cash') { stateArg.money = ((stateArg.money || 0) + pickupObj.amount); stateArg.toast?.(`+$${pickupObj.amount}`); }
  else { stateArg.playerHealth = Math.min(100, ((stateArg.playerHealth ?? 100) + pickupObj.amount)); stateArg.toast?.(`+${pickupObj.amount} HP`); } }
function tickPickup(stateHeld, dtHeld, pickupHeld) {
  const actorHeld = (stateHeld.car || stateHeld.player);
  const elapsedHeld = (stateHeld.elapsed || 0);
  if (!pickupHeld.active) {
    pickupHeld.respawnT -= dtHeld;
    if (!(pickupHeld.respawnT > 0)) resetPickup(pickupHeld);
    return; }
  animatePickup(pickupHeld, dtHeld, elapsedHeld);
  if (!actorHeld || stateHeld.frozen) return;
  const gapHeld = Math.hypot((actorHeld.x + (-pickupHeld.x)), (actorHeld.z + (-pickupHeld.z)));
  if (!(gapHeld < 1.8)) return;
  const healthFull = ((stateHeld.playerHealth ?? 100) >= 100);
  if ((pickupHeld.type === 'health') && healthFull) return;
  awardPickup(stateHeld, pickupHeld); }
G.updaters.push((stateHeld, dtHeld) => { stateHeld.pickups.forEach((pickupHeld) => tickPickup(stateHeld, dtHeld, pickupHeld)); });
if (shotHeld) {
  // Shot staging holds off until hero asset loads settle or
  // a timeout gives up waiting, so model swaps land before
  // the staging and the capture happen
  // Gameplay boot never waits on any of this: every init
  // above already ran synchronously, and with no shot
  // requested this block never runs at all
  const stageShot = () => {
    setupShot(G, shotHeld);
    const menuNode = document.getElementById('menu'); if (menuNode) menuNode.style.display = 'none'; };
  const timeoutHeld = new Promise((resolveIt) => setTimeout(resolveIt, 6000));
  Promise.race([heroAssetsReady, timeoutHeld]).then(stageShot); }

// Keyboard input lives here
function closestEnterableCar() {
  let chosenHeld = null, chosenGap = 4.5;
  G.vehicles.forEach((vehicleHeld) => {
    if (vehicleHeld.driver === 'traffic') return;
    const gapHere = Math.hypot((vehicleHeld.x + (-G.player.x)), (vehicleHeld.z + (-G.player.z)));
    if (chosenGap > gapHere) { chosenGap = gapHere; chosenHeld = vehicleHeld; } });
  return chosenHeld; }
function flipEnterExit() {
  const inCarHeld = !!G.car;
  if (inCarHeld) exitCar(G);
  else if (G.player) { const targetHeld = closestEnterableCar(); if (targetHeld) enterCar(G, targetHeld); } }
function onPauseKey(codeHeld) {
  const pauseHeld = (codeHeld === 'KeyP') || (codeHeld === 'Escape');
  if (pauseHeld === true) { G.paused = !G.paused; if (G.togglePause) G.togglePause(G.paused); } }
function onMuteKey(codeHeld) {
  if (codeHeld === 'KeyM') { const audioHeld = G.audio; if (audioHeld && audioHeld.toggleMute) audioHeld.toggleMute(); } }
addEventListener('keydown', (eventHeld) => {
  G.keys[eventHeld.code] = true;
  onPauseKey(eventHeld.code);
  onMuteKey(eventHeld.code);
  if (eventHeld.code === 'KeyF') flipEnterExit();
  const swallowHeld = ['ArrowUp', 'ArrowDown', 'Space'];
  if (swallowHeld.includes(eventHeld.code)) eventHeld.preventDefault(); });
addEventListener('keyup', (eventHeld) => { G.keys[eventHeld.code] = false; });
function onResize() {
  const aspectHeld = (innerWidth / innerHeight);
  cameraHeld.aspect = aspectHeld;
  cameraHeld.updateProjectionMatrix();
  rendererHeld.setSize(innerWidth, innerHeight); }
addEventListener('resize', onResize);
const menuNodeMain = document.getElementById('menu');
if (menuNodeMain) menuNodeMain.addEventListener('click', () => { menuNodeMain.style.display = 'none'; G.mode = 'play'; });
let prevStamp = performance.now();
function nudgeFov(fovGoal, dtHeld) {
  const deltaHeld = (fovGoal + (-cameraHeld.fov));
  if (!(Math.abs(deltaHeld) > 0.05)) return;
  cameraHeld.fov += (deltaHeld * Math.min(1, (dtHeld * 3)));
  cameraHeld.fov = Math.max(45, Math.min(85, cameraHeld.fov));
  cameraHeld.updateProjectionMatrix(); }
function carCamera(dtHeld) {
  const drivenHeld = G.car;
  const distHeld = 8.5;
  const heightHeld = 3.2;
  const goalX = (drivenHeld.x + (-(Math.sin(drivenHeld.angle) * distHeld)));
  const goalZ = (drivenHeld.z + (-(Math.cos(drivenHeld.angle) * distHeld)));
  const blendHeld = Math.min(1, (dtHeld * 5));
  cameraHeld.position.x += ((goalX + (-cameraHeld.position.x)) * blendHeld);
  cameraHeld.position.z += ((goalZ + (-cameraHeld.position.z)) * blendHeld);
  cameraHeld.position.y += (((groundH(drivenHeld.x, drivenHeld.z) + heightHeld) + (-cameraHeld.position.y)) * blendHeld);
  cameraHeld.lookAt((drivenHeld.x + (Math.sin(drivenHeld.angle) * 6)), (groundH(drivenHeld.x, drivenHeld.z) + 1.4), (drivenHeld.z + (Math.cos(drivenHeld.angle) * 6)));
  G.camYaw = (drivenHeld.angle + Math.PI);
  const speedRatioHeld = Math.min(1, (Math.abs(drivenHeld.speed) / (drivenHeld.spec.topSpeed * 0.8)));
  const fovGoal = ((62 + (G.flags.nosActive ? 4 : 0)) + (speedRatioHeld * 10));
  nudgeFov(fovGoal, dtHeld); }
function wrapAngleDelta(deltaHeld) {
  let wrappedHeld = deltaHeld;
  while (wrappedHeld > Math.PI) wrappedHeld -= (Math.PI * 2);
  while (-Math.PI > wrappedHeld) wrappedHeld += (Math.PI * 2);
  return wrappedHeld; }
function walkerCamera(dtHeld) {
  const walkerHeld = G.player;
  const behindX = (walkerHeld.x + (-(Math.sin(G.camYaw) * 7)));
  const behindZ = (walkerHeld.z + (-(Math.cos(G.camYaw) * 7)));
  const blendHeld = Math.min(1, (dtHeld * 6));
  cameraHeld.position.x += ((behindX + (-cameraHeld.position.x)) * blendHeld);
  cameraHeld.position.z += ((behindZ + (-cameraHeld.position.z)) * blendHeld);
  cameraHeld.position.y += (((groundH(walkerHeld.x, walkerHeld.z) + 3) + (-cameraHeld.position.y)) * blendHeld);
  cameraHeld.lookAt(walkerHeld.x, (groundH(walkerHeld.x, walkerHeld.z) + 1.4), walkerHeld.z);
  nudgeFov(60, dtHeld);
  if (walkerHeld.speed > 0) {
    const yawGoal = (walkerHeld.angle + Math.PI);
    const yawDelta = wrapAngleDelta(yawGoal + (-G.camYaw));
    G.camYaw += (yawDelta * Math.min(1, (dtHeld * 1.6))); } }
function followSun() {
  // Shadow following: the world updater has just reset the
  // sun position to the pure time of day offset aimed at the
  // origin, so that vector is the sun direction, and pinning
  // it again on the player or car keeps direction and
  // elevation while the shadow box stays centred on the
  // action; shot modes stay exempt because their module pins
  // the target on the staged look point
  const followActive = G.shadowFollow && G.sun && !G.shotCam;
  if (!followActive) return;
  const anchorHeld = (G.car || G.player);
  if (!anchorHeld || !G.sun.target) return;
  const offsetHeld = SUN_OFFSET_SCRATCH.copy(G.sun.position);
  G.sun.target.position.set(anchorHeld.x, groundH(anchorHeld.x, anchorHeld.z), anchorHeld.z);
  G.sun.position.copy(G.sun.target.position).add(offsetHeld);
  if (!G.sun.target.parent) sceneHeld.add(G.sun.target);
  G.sun.target.updateMatrixWorld(); }
function stepPlay(dtHeld) {
  for (const updaterHeld of G.updaters) { try { updaterHeld(G, dtHeld); } catch (caughtFault) { console.error(caughtFault); } }
  if (G.frozen) return;
  if (G.car) updateDriving(G, dtHeld); else updatePlayer(G, dtHeld);
  updateTraffic(G, dtHeld); }
function chooseFrameCamera(dtHeld) {
  if (G.shotCam) { G.shotCam(); }
  else if (G.mode === 'play') { if (G.car) carCamera(dtHeld); else if (G.player) walkerCamera(dtHeld); }
  else { cameraHeld.position.set(-412, 6, 492); cameraHeld.lookAt(-412, 2, 440); } }
function tickFrame(stampHeld) {
  requestAnimationFrame(tickFrame);
  const rawStep = ((stampHeld + (-prevStamp)) / 1000);
  const stepDt = Math.max(0, Math.min(0.05, rawStep));
  prevStamp = stampHeld;
  if (G.paused) { rendererHeld.render(sceneHeld, cameraHeld); return; }
  G.elapsed += stepDt;
  if (!shotHeld) G.timeOfDay = ((G.timeOfDay + ((stepDt / CFG.dayLength) * 24)) % 24);
  if (G.mode === 'play') stepPlay(stepDt);
  updateSmoke(G, stepDt);
  updateWorld(G, stepDt);
  updateSky(G, stepDt);
  followSun();
  chooseFrameCamera(stepDt);
  rendererHeld.render(sceneHeld, cameraHeld); }
requestAnimationFrame(tickFrame);
