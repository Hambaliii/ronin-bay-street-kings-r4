// Boot, frame loop, cameras, wiring and shot mode live here
import * as THREE from 'three';
import { CFG } from './config.js';
import { srand } from './random.js';
import { buildWorld, updateWorld, groundH, glowSprite } from './world.js';
import { initSky, updateSky } from './sky.js';
import { spawnTraffic, updateTraffic, updateSmoke, spawnVehicle } from './cars.js';
import { createPlayer, updatePlayer } from './player.js';
import { updateDriving, enterCar, exitCar, initVespas } from './drive.js';
import { setupShot } from './shots.js';
import { initSave } from './save.js';
import { initPeds } from './peds.js';
import { initPolice } from './police.js';
import { initMissions } from './missions.js';
import { initHUD } from './hud.js';
import { initAudio } from './audio.js';
import { initWeapons } from './weapons.js';
import { heroAssetsReady } from './assets.js';
const paramsQuery = new URLSearchParams(location.search);
const SEED_FALLBACK = 1;
function seedViaQuery() {
  const rawGiven = paramsQuery.get('seed');
  const parseText = rawGiven || String(SEED_FALLBACK);
  const parsedNow = parseInt(parseText, 10);
  const seedPicked = parsedNow ? parsedNow : SEED_FALLBACK;
  return seedPicked; }
const seedActive = seedViaQuery();
const shotWanted = paramsQuery.get('shot');
srand(seedActive);
const canvasNode = document.getElementById('gameCanvas');
// Sun shadow boot numbers are gathered in a single spot so that
// retuning shadows stays a one line change and the boot block
// below simply reads from here
const SHADOW_SETUP = { mapSize: 2048, box: 110, near: 10, far: 600, bias: -0.0005, normalBias: 0.5 };
const SUN_SCRATCH = new THREE.Vector3();
const rendererBuilt = new THREE.WebGLRenderer({ canvas: canvasNode, antialias: true });
rendererBuilt.shadowMap.enabled = true;
rendererBuilt.shadowMap.type = THREE.PCFSoftShadowMap;
rendererBuilt.setPixelRatio(Math.min(devicePixelRatio, 1.5));
rendererBuilt.setSize(innerWidth, innerHeight);
const sceneBuilt = new THREE.Scene();
sceneBuilt.background = new THREE.Color(0x87c5eb);
sceneBuilt.fog = new THREE.Fog(0x87c5eb, 220, 900);
const cameraBuilt = new THREE.PerspectiveCamera(66, (innerWidth / innerHeight), 0.1, 3000);
cameraBuilt.position.set(-412, 4, 486);
const hemiBuilt = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 0.9); sceneBuilt.add(hemiBuilt);
const sunBuilt = new THREE.DirectionalLight(0xfff2d8, 1.3); sunBuilt.position.set(200, 260, 120); sceneBuilt.add(sunBuilt);
// Shadow boot and the follow contract that comes with it
// The sun is the only shadow caster, with its ortho box, map
// size and biases all taken from the config above, tuned against
// acne on low poly facades, and three owners move the light
// afterwards without retuning any of these values: the world
// updater repositions from time of day each frame and leaves the
// target alone, the main loop anchors position and target on the
// player or car, and shot modes pin it on their staged look at
// point with a tighter box
function applyShadowBoot() {
  sunBuilt.castShadow = true;
  sunBuilt.shadow.mapSize.set(SHADOW_SETUP.mapSize, SHADOW_SETUP.mapSize);
  const camShadow = sunBuilt.shadow.camera;
  camShadow.left = -SHADOW_SETUP.box;
  camShadow.right = SHADOW_SETUP.box;
  camShadow.top = SHADOW_SETUP.box;
  camShadow.bottom = -SHADOW_SETUP.box;
  camShadow.near = SHADOW_SETUP.near;
  camShadow.far = SHADOW_SETUP.far;
  sunBuilt.shadow.bias = SHADOW_SETUP.bias;
  sunBuilt.shadow.normalBias = SHADOW_SETUP.normalBias;
  camShadow.updateProjectionMatrix(); }
applyShadowBoot();
function makeDistrictState() {
  const districtFresh = {};
  districtFresh.port = { control: 50, owner: 'ronin' }; districtFresh.coral = { control: 30, owner: 'neutral' };
  districtFresh.neon = { control: 20, owner: 'rival' }; districtFresh.hoshino = { control: 10, owner: 'rival' };
  return districtFresh; }
const G = { elapsed: 0, camDist: 7, camYaw: Math.PI,
  sun: sunBuilt, hemi: hemiBuilt, water: null, hq: null, shadowFollow: true,
  scene: sceneBuilt, camera: cameraBuilt, renderer: rendererBuilt, canvas: canvasNode,
  mode: shotWanted ? 'play' : 'menu', shot: shotWanted, seed: seedActive, keys: {},
  timeOfDay: shotWanted ? 17.9 : CFG.startHour, money: 500, rep: 0, rankIdx: 0, wanted: 0, speedKmh: 0,
  car: null, player: null, paused: false, shotCam: null, flags: {}, updaters: [], colliders: [],
  addCollider(x, z, hw, hd, h) { this.colliders.push({ x, z, hw, hd, h }); },
  roadX: [], roadZ: [], touge: [], missionIndex: 0, districtState: makeDistrictState(),
  audio: null, heli: null, cops: [], peds: [], vehicles: [], traffic: [],
  exitCar: null, enterCar: null, garage: ['hachi'], ownedCars: ['hachi'] };
G.enterCar = (vehicleGiven) => enterCar(G, vehicleGiven);
G.exitCar = () => exitCar(G);
window.G = G;
initSave(G);
// The world builder reads the anisotropy value guarded, so the
// value has to exist before the world build runs
G.maxAniso = rendererBuilt.capabilities.getMaxAnisotropy();
buildWorld(G); initSky(G); createPlayer(G);
const carFirst = spawnVehicle(G, 'hachi', -412.5, 452, Math.PI, { driver: 'parked' });
G.starterCar = carFirst;
function parkCarAt(modelKey, posX, posZ, headingGiven) {
  const optsParked = { driver: 'parked' };
  const spawnedNow = spawnVehicle(G, modelKey, posX, posZ, headingGiven, optsParked);
  return spawnedNow; }
parkCarAt('svj', -430, 452, 0.9); spawnTraffic(G, 14);
parkCarAt('sedan', 154, 300, 0); parkCarAt('hatch', 176, -60, Math.PI);
parkCarAt('wagon', -60, 484, Math.PI / 2); parkCarAt('suv', 60, 506, -Math.PI / 2);
parkCarAt('kei', 319, -140, 0); parkCarAt('van', 341, -420, Math.PI);
parkCarAt('roadster', -140, 319, Math.PI / 2); parkCarAt('sedan', 420, -341, -Math.PI / 2);
initVespas(G); initPeds(G); initPolice(G);
initMissions(G); initHUD(G); initAudio(G); initWeapons(G);

// A hospital marker stands at the wasted respawn corner: a pole
// and a white sign carrying a red cross canvas texture, while
// the world module itself stays untouched
function raiseHospitalMarker() {
  const hospitalX = 335, hospitalZ = -335;
  const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5, 8), new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.6 }));
  poleMesh.position.set(hospitalX, (groundH(hospitalX, hospitalZ) + 2.5), hospitalZ);
  sceneBuilt.add(poleMesh);
  const crossCanvas = document.createElement('canvas'); crossCanvas.width = 128; crossCanvas.height = 128;
  const crossCtx = crossCanvas.getContext('2d');
  crossCtx.fillStyle = '#ffffff'; crossCtx.fillRect(0, 0, 128, 128);
  crossCtx.fillStyle = '#d8232a'; crossCtx.fillRect(52, 24, 24, 80); crossCtx.fillRect(24, 52, 80, 24);
  const crossTexture = new THREE.CanvasTexture(crossCanvas);
  const boardMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.25), new THREE.MeshBasicMaterial({ map: crossTexture }));
  boardMesh.position.set(hospitalX, (groundH(hospitalX, hospitalZ) + 5.4), hospitalZ);
  boardMesh.rotation.y = (Math.PI / 4);
  sceneBuilt.add(boardMesh); }
raiseHospitalMarker();
// Pickups come in cash spots and health spots, each one a glow
// disc that spins and bobs in place
const PICKUP_SPOTS = [
  { type: 'cash', amount: 100, x: 174, z: -156 }, { type: 'cash', amount: 125, x: 165, z: 488 },
  { type: 'cash', amount: 150, x: 338, z: 420 }, { type: 'cash', amount: 150, x: 322, z: 545 },
  { type: 'cash', amount: 90, x: -174, z: 156 }, { type: 'cash', amount: 110, x: -488, z: -174 },
  { type: 'cash', amount: 150, x: -322, z: -590 }, { type: 'cash', amount: 75, x: -338, z: 338 },
  { type: 'health', amount: 30, x: 326, z: -322 }, { type: 'health', amount: 30, x: -404, z: 460 },
  { type: 'health', amount: 30, x: -156, z: -338 }, { type: 'health', amount: 30, x: 488, z: 488 },
  { type: 'health', amount: 30, x: 488, z: 404 }, { type: 'health', amount: 30, x: -276, z: -586 }];
function glyphTextureFor(glyphGiven, tintGiven) {
  const glyphCanvas = document.createElement('canvas'); glyphCanvas.width = 128; glyphCanvas.height = 128;
  const glyphCtx = glyphCanvas.getContext('2d');
  glyphCtx.clearRect(0, 0, 128, 128);
  glyphCtx.fillStyle = tintGiven;
  glyphCtx.font = 'bold 84px Arial, sans-serif';
  glyphCtx.textAlign = 'center'; glyphCtx.textBaseline = 'middle';
  glyphCtx.fillText(glyphGiven, 64, 70);
  const glyphTexture = new THREE.CanvasTexture(glyphCanvas);
  return glyphTexture; }
G.pickups = [];
function erectPickup(spotGiven) {
  const cashKind = (spotGiven.type === 'cash');
  const grpBuilt = new THREE.Group();
  const baseY = groundH(spotGiven.x, spotGiven.z);
  const discMesh = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24), new THREE.MeshBasicMaterial({ color: cashKind ? 0x2eff7a : 0xff4b4b, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  discMesh.rotation.x = (-Math.PI / 2); discMesh.position.y = 0.12;
  grpBuilt.add(discMesh);
  try { const haloMesh = glowSprite(cashKind ? 0x2eff7a : 0xff4b4b, 4.2); haloMesh.position.y = 1.1; grpBuilt.add(haloMesh); } catch (ignoredFault) {}
  const glyphMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: glyphTextureFor(cashKind ? '$' : '+', cashKind ? '#baffd2' : '#ffd2d2'), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  glyphMesh.position.y = 1.15;
  grpBuilt.add(glyphMesh);
  grpBuilt.position.set(spotGiven.x, baseY, spotGiven.z);
  sceneBuilt.add(grpBuilt);
  const phaseValue = ((G.pickups.length * 1.93) % 6.28);
  G.pickups.push({ ...spotGiven, group: grpBuilt, icon: glyphMesh, disc: discMesh, active: true, respawnT: 0, phase: phaseValue }); }
PICKUP_SPOTS.forEach(erectPickup);
function stepOnePickup(stateGiven, dtGiven, pickupGiven) {
  const pickupObj = pickupGiven;
  const actorNow = (stateGiven.car || stateGiven.player);
  const elapsedNow = (stateGiven.elapsed || 0);
  if (!pickupGiven.active) {
    pickupGiven.respawnT -= dtGiven;
    if (!(pickupGiven.respawnT > 0)) { pickupGiven.group.visible = true; pickupGiven.active = true; }
    return; }
  pickupGiven.icon.rotation.y += (dtGiven * 2.4);
  pickupGiven.disc.rotation.z += (dtGiven * 1.2);
  pickupGiven.icon.position.y = (1.15 + (Math.sin((elapsedNow * 2.2) + pickupGiven.phase) * 0.18));
  if (!actorNow || stateGiven.frozen) return;
  const gapToActor = Math.hypot((actorNow.x + (-pickupGiven.x)), (actorNow.z + (-pickupGiven.z)));
  if (!(gapToActor < 1.8)) return;
  const healthTopped = ((stateGiven.playerHealth ?? 100) >= 100);
  if ((pickupGiven.type === 'health') && healthTopped) return;
  pickupGiven.active = false; pickupGiven.group.visible = false; pickupGiven.respawnT = 60;
  if (pickupGiven.type === 'cash') { stateGiven.money = ((stateGiven.money || 0) + pickupGiven.amount); stateGiven.toast?.(`+$${pickupObj.amount}`); }
  else { stateGiven.playerHealth = Math.min(100, ((stateGiven.playerHealth ?? 100) + pickupGiven.amount)); stateGiven.toast?.(`+${pickupObj.amount} HP`); } }
G.updaters.push((stateGiven, dtGiven) => { stateGiven.pickups.forEach((pickupGiven) => stepOnePickup(stateGiven, dtGiven, pickupGiven)); });
if (shotWanted) {
  // Shot staging waits for hero asset loads to settle, capped
  // by a timeout, so model swaps land before staging and the
  // capture happen
  // Gameplay boot is not delayed, because every init above has
  // already run synchronously, and without a shot request this
  // block never runs
  const stageNow = () => {
    setupShot(G, shotWanted);
    const menuNode = document.getElementById('menu'); if (menuNode) menuNode.style.display = 'none'; };
  const timeoutPromise = new Promise((resolveIt) => setTimeout(resolveIt, 6000));
  Promise.race([heroAssetsReady, timeoutPromise]).then(stageNow); }

// Handling for keyboard input
function nearestEnterableCar() {
  let pickedCar = null, pickedGap = 4.5;
  G.vehicles.forEach((vehicleGiven) => {
    if (vehicleGiven.driver === 'traffic') return;
    const gapHere = Math.hypot((vehicleGiven.x + (-G.player.x)), (vehicleGiven.z + (-G.player.z)));
    if (pickedGap > gapHere) { pickedGap = gapHere; pickedCar = vehicleGiven; } });
  return pickedCar; }
function toggleEnterExit() {
  const inCarNow = !!G.car;
  if (inCarNow) exitCar(G);
  else if (G.player) { const carTarget = nearestEnterableCar(); if (carTarget) enterCar(G, carTarget); } }
addEventListener('keydown', (eventGiven) => {
  G.keys[eventGiven.code] = true;
  const pausePressed = (eventGiven.code === 'KeyP') || (eventGiven.code === 'Escape');
  if (pausePressed === true) { G.paused = !G.paused; if (G.togglePause) G.togglePause(G.paused); }
  if (eventGiven.code === 'KeyM') { const audioNow = G.audio; if (audioNow && audioNow.toggleMute) audioNow.toggleMute(); }
  if (eventGiven.code === 'KeyF') toggleEnterExit();
  const swallowList = ['ArrowUp', 'ArrowDown', 'Space'];
  if (swallowList.includes(eventGiven.code)) eventGiven.preventDefault(); });
addEventListener('keyup', (eventGiven) => { G.keys[eventGiven.code] = false; });
function handleResize() {
  cameraBuilt.aspect = (innerWidth / innerHeight);
  cameraBuilt.updateProjectionMatrix();
  rendererBuilt.setSize(innerWidth, innerHeight); }
addEventListener('resize', handleResize);
const menuNodeMain = document.getElementById('menu');
if (menuNodeMain) menuNodeMain.addEventListener('click', () => { menuNodeMain.style.display = 'none'; G.mode = 'play'; });
let stampLast = performance.now();
function chaseCameraCar(dtGiven) {
  const carDriven = G.car;
  const chaseDist = 8.5;
  const chaseHeight = 3.2;
  const goalX = (carDriven.x + (-(Math.sin(carDriven.angle) * chaseDist)));
  const goalZ = (carDriven.z + (-(Math.cos(carDriven.angle) * chaseDist)));
  const blendQuick = Math.min(1, (dtGiven * 5));
  cameraBuilt.position.x += ((goalX + (-cameraBuilt.position.x)) * blendQuick);
  cameraBuilt.position.z += ((goalZ + (-cameraBuilt.position.z)) * blendQuick);
  cameraBuilt.position.y += (((groundH(carDriven.x, carDriven.z) + chaseHeight) + (-cameraBuilt.position.y)) * blendQuick);
  cameraBuilt.lookAt((carDriven.x + (Math.sin(carDriven.angle) * 6)), (groundH(carDriven.x, carDriven.z) + 1.4), (carDriven.z + (Math.cos(carDriven.angle) * 6)));
  G.camYaw = (carDriven.angle + Math.PI);
  const speedShare = Math.min(1, (Math.abs(carDriven.speed) / (carDriven.spec.topSpeed * 0.8)));
  const fovGoal = ((62 + (G.flags.nosActive ? 4 : 0)) + (speedShare * 10));
  easeFovToward(fovGoal, dtGiven); }
function easeFovToward(fovGoal, dtGiven) {
  const fovDelta = (fovGoal + (-cameraBuilt.fov));
  if (!(Math.abs(fovDelta) > 0.05)) return;
  cameraBuilt.fov += (fovDelta * Math.min(1, (dtGiven * 3)));
  cameraBuilt.fov = Math.max(45, Math.min(85, cameraBuilt.fov));
  cameraBuilt.updateProjectionMatrix(); }
function chaseCameraWalker(dtGiven) {
  const walkerGiven = G.player;
  const behindX = (walkerGiven.x + (-(Math.sin(G.camYaw) * 7)));
  const behindZ = (walkerGiven.z + (-(Math.cos(G.camYaw) * 7)));
  const blendWalk = Math.min(1, (dtGiven * 6));
  cameraBuilt.position.x += ((behindX + (-cameraBuilt.position.x)) * blendWalk);
  cameraBuilt.position.z += ((behindZ + (-cameraBuilt.position.z)) * blendWalk);
  cameraBuilt.position.y += (((groundH(walkerGiven.x, walkerGiven.z) + 3) + (-cameraBuilt.position.y)) * blendWalk);
  cameraBuilt.lookAt(walkerGiven.x, (groundH(walkerGiven.x, walkerGiven.z) + 1.4), walkerGiven.z);
  easeFovToward(60, dtGiven);
  if (walkerGiven.speed > 0) {
    const yawGoal = (walkerGiven.angle + Math.PI);
    let yawDelta = (yawGoal + (-G.camYaw));
    while (yawDelta > Math.PI) yawDelta -= (Math.PI * 2);
    while (-Math.PI > yawDelta) yawDelta += (Math.PI * 2);
    G.camYaw += (yawDelta * Math.min(1, (dtGiven * 1.6))); } }
function anchorSun() {
  // Following with the shadow: the world updater has just reset
  // the sun position to the pure time of day offset aimed at the
  // origin, so that vector is the sun direction, and anchoring
  // it again on the player or car keeps direction and elevation
  // while the shadow box stays centred on the action, and shot
  // modes stay exempt because their module pins the target on
  // the staged look point
  const followActive = G.shadowFollow && G.sun && !G.shotCam;
  if (!followActive) return;
  const anchorGiven = (G.car || G.player);
  if (!anchorGiven || !G.sun.target) return;
  const offsetHeld = SUN_SCRATCH.copy(G.sun.position);
  G.sun.target.position.set(anchorGiven.x, groundH(anchorGiven.x, anchorGiven.z), anchorGiven.z);
  G.sun.position.copy(G.sun.target.position).add(offsetHeld);
  if (!G.sun.target.parent) sceneBuilt.add(G.sun.target);
  G.sun.target.updateMatrixWorld(); }
function runPlayStep(dtGiven) {
  for (const updaterGiven of G.updaters) { try { updaterGiven(G, dtGiven); } catch (caughtFault) { console.error(caughtFault); } }
  if (G.frozen) return;
  if (G.car) updateDriving(G, dtGiven); else updatePlayer(G, dtGiven);
  updateTraffic(G, dtGiven); }
function frameTick(stampGiven) {
  requestAnimationFrame(frameTick);
  const stepRaw = ((stampGiven + (-stampLast)) / 1000);
  const stepDt = Math.max(0, Math.min(0.05, stepRaw));
  stampLast = stampGiven;
  if (G.paused) { rendererBuilt.render(sceneBuilt, cameraBuilt); return; }
  G.elapsed += stepDt;
  if (!shotWanted) G.timeOfDay = ((G.timeOfDay + ((stepDt / CFG.dayLength) * 24)) % 24);
  if (G.mode === 'play') runPlayStep(stepDt);
  updateSmoke(G, stepDt); updateWorld(G, stepDt); updateSky(G, stepDt);
  anchorSun();
  if (G.shotCam) { G.shotCam(); }
  else if (G.mode === 'play') { if (G.car) chaseCameraCar(stepDt); else if (G.player) chaseCameraWalker(stepDt); }
  else { cameraBuilt.position.set(-412, 6, 492); cameraBuilt.lookAt(-412, 2, 440); }
  rendererBuilt.render(sceneBuilt, cameraBuilt); }
requestAnimationFrame(frameTick);
