// Boot, frame loop, cameras, wiring and shot mode live here.
import * as THREE from 'three'; import { CFG } from './config.js';
import { srand } from './random.js'; import { buildWorld, updateWorld, groundH, glowSprite } from './world.js';
import { initSky, updateSky } from './sky.js'; import { setupShot } from './shots.js';
import { spawnTraffic, updateTraffic, updateSmoke, spawnVehicle } from './cars.js'; import { createPlayer, updatePlayer } from './player.js';
import { updateDriving, enterCar, exitCar, initVespas } from './drive.js'; import { initSave } from './save.js';
import { initPeds } from './peds.js'; import { initPolice } from './police.js';
import { initMissions } from './missions.js'; import { initHUD } from './hud.js';
import { initAudio } from './audio.js'; import { initWeapons } from './weapons.js';
import { heroAssetsReady } from './assets.js';
const queryHeld = new URLSearchParams(location.search);
let SEED_DEFAULT;
SEED_DEFAULT = 1;
const readSeed = () => {
  let seedRaw;
  seedRaw = queryHeld.get('seed');
  let seedStr;
  seedStr = seedRaw || String(SEED_DEFAULT);
  const seedParsed = parseInt(seedStr, 10);
  if (seedParsed) return seedParsed; else return SEED_DEFAULT; };
const bootSeed = readSeed(); void bootSeed;
const shotRequested = queryHeld.get('shot'); srand(bootSeed);
const canvasEl = document.getElementById('gameCanvas');
// Boot numbers for the sun shadow are gathered in one place, so
// retuning shadows stays a one line change; the boot block below
// just reads from here.
const SHADOW_TUNING = {};
SHADOW_TUNING.bias = -0.0005;
SHADOW_TUNING.mapSize = 2048;
SHADOW_TUNING.far = 600;
SHADOW_TUNING.box = 110;
SHADOW_TUNING.normalBias = 0.5;
SHADOW_TUNING.near = 10;
const SUN_VEC = new THREE.Vector3();
const rendOpts = {};
rendOpts.antialias = true;
rendOpts.canvas = canvasEl;
const rendObj = new THREE.WebGLRenderer(rendOpts);
rendObj.shadowMap.enabled = true; rendObj.shadowMap.type = THREE.PCFSoftShadowMap;
const pixelRatioVal = Math.min(devicePixelRatio, 1.5);
rendObj.setPixelRatio(pixelRatioVal); rendObj.setSize(innerWidth, innerHeight);
const sceneObj = new THREE.Scene();
sceneObj.background = new THREE.Color(0x87c5eb);
sceneObj.fog = new THREE.Fog(0x87c5eb, 220, 900);
const camObj = new THREE.PerspectiveCamera(66, (innerWidth / innerHeight), 0.1, 3000);
camObj.position.set(-412, 4, 486);
const hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 0.9); sceneObj.add(hemiLight);
const sunLight = new THREE.DirectionalLight(0xfff2d8, 1.3);
sunLight.position.set(200, 260, 120); sceneObj.add(sunLight);
// Shadow setup plus the follow contract that comes with it: every
// shadow comes from the sun; the ortho box, map size and biases all
// come from the tuning above, set against acne on low poly facades.
// Three owners move the light later without touching those values:
// the world updater repositions from the time of day each frame and
// leaves the target alone, the main loop anchors position and
// target on the player or the car, and shot modes pin the light on
// their staged look point with a tighter box.
const setupShadows = () => {
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(SHADOW_TUNING.mapSize, SHADOW_TUNING.mapSize);
  const shadowCam = sunLight.shadow.camera;
  shadowCam.left = -SHADOW_TUNING.box; shadowCam.right = SHADOW_TUNING.box;
  shadowCam.top = SHADOW_TUNING.box; shadowCam.bottom = -SHADOW_TUNING.box;
  shadowCam.near = SHADOW_TUNING.near; shadowCam.far = SHADOW_TUNING.far;
  sunLight.shadow.normalBias = SHADOW_TUNING.normalBias;
  sunLight.shadow.bias = SHADOW_TUNING.bias; shadowCam.updateProjectionMatrix(); };
setupShadows();
const districtRec = (controlGiven, ownerGiven) => { const recOut = {};
  recOut.owner = ownerGiven;
  recOut.control = controlGiven;
  return recOut; };
const seedDistricts = () => {
  const districtsBuilt = {};
  districtsBuilt.port = districtRec(50, 'ronin');
  districtsBuilt.coral = districtRec(30, 'neutral');
  districtsBuilt.neon = districtRec(20, 'rival');
  districtsBuilt.hoshino = districtRec(10, 'rival');
  return districtsBuilt; };
const G = {};
G.camDist = 7;
G.elapsed = 0;
G.sun = sunLight;
G.camYaw = Math.PI;
G.hemi = hemiLight;
G.water = null;
G.hq = null;
G.shadowFollow = true;
G.scene = sceneObj;
G.camera = camObj;
G.renderer = rendObj;
G.canvas = canvasEl;
if (shotRequested) G.mode = 'play'; else G.mode = 'menu';
G.shot = shotRequested;
G.seed = bootSeed;
G.keys = {};
if (shotRequested) G.timeOfDay = 17.9; else G.timeOfDay = CFG.startHour;
G.money = 500;
G.rep = 0;
G.rankIdx = 0;
G.wanted = 0;
G.speedKmh = 0;
G.car = null;
G.player = null;
G.paused = false;
G.shotCam = null;
G.flags = {};
G.updaters = [];
G.colliders = [];
G.addCollider = (x, z, hw, hd, h) => { const colRec = {};
  colRec.x = x;
  colRec.z = z;
  colRec.hw = hw;
  colRec.hd = hd;
  colRec.h = h;
  G.colliders.push(colRec); };
G.roadX = [];
G.roadZ = [];
G.touge = [];
G.missionIndex = 0;
G.districtState = seedDistricts();
G.audio = null;
G.heli = null;
G.cops = [];
G.peds = [];
G.vehicles = [];
G.traffic = [];
G.exitCar = null;
G.enterCar = null;
G.garage = ['hachi'];
G.ownedCars = ['hachi'];
G.enterCar = function (vehGiven) { return enterCar(G, vehGiven); };
G.exitCar = function () { return exitCar(G); };
window.G = G; initSave(G);
// The anisotropy value is read guarded by the world builder, so it
// has to exist before the world build runs.
G.maxAniso = rendObj.capabilities.getMaxAnisotropy();
buildWorld(G); initSky(G); createPlayer(G);
const firstCar = spawnVehicle(G, 'hachi', -412.5, 452, Math.PI, { driver: 'parked' }); G.starterCar = firstCar;
const parkRide = (carKey, atX, atZ, headingGiven) => {
  const parkedOut = spawnVehicle(G, carKey, atX, atZ, headingGiven, { driver: 'parked' }); return parkedOut; };
parkRide('svj', -430, 452, 0.9); spawnTraffic(G, 14);
parkRide('sedan', 154, 300, 0); parkRide('hatch', 176, -60, Math.PI);
parkRide('wagon', -60, 484, Math.PI / 2); parkRide('suv', 60, 506, -Math.PI / 2);
parkRide('kei', 319, -140, 0); parkRide('van', 341, -420, Math.PI);
parkRide('roadster', -140, 319, Math.PI / 2); parkRide('sedan', 420, -341, -Math.PI / 2);
initVespas(G); initPeds(G); initPolice(G);
initMissions(G); initHUD(G); initAudio(G); initWeapons(G);
// At the wasted respawn corner stands a hospital marker: one pole
// plus a white sign carrying a red cross canvas texture, while the
// world module itself stays untouched.
const crossTex = () => {
  const cvMade = document.createElement('canvas');
  cvMade.width = 128; cvMade.height = 128;
  const pen = cvMade.getContext('2d');
  pen.fillStyle = '#ffffff'; pen.fillRect(0, 0, 128, 128);
  pen.fillStyle = '#d8232a'; pen.fillRect(52, 24, 24, 80); pen.fillRect(24, 52, 80, 24);
  return new THREE.CanvasTexture(cvMade); };
const placeHospitalMarker = () => { let markX;
  markX = 335;
  let markZ;
  markZ = -335;
  const poleMatOpts = {};
  poleMatOpts.metalness = 0.6;
  poleMatOpts.color = 0x8a8f96;
  poleMatOpts.roughness = 0.6;
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.09, 5, 8);
  const poleMesh = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial(poleMatOpts));
  poleMesh.position.set(markX, (groundH(markX, markZ) + 2.5), markZ); sceneObj.add(poleMesh);
  const boardMatOpts = {};
  boardMatOpts.map = crossTex();
  const boardGeo = new THREE.BoxGeometry(2.6, 2.6, 0.25);
  const boardMesh = new THREE.Mesh(boardGeo, new THREE.MeshBasicMaterial(boardMatOpts));
  boardMesh.position.set(markX, (groundH(markX, markZ) + 5.4), markZ);
  boardMesh.rotation.y = (Math.PI / 4); sceneObj.add(boardMesh); };
placeHospitalMarker();
// Pickups split into cash spots and health spots; each one is a
// glow disc that spins and bobs where it sits.
const PICKUP_LIST = [];
PICKUP_LIST.push({ amount: 100, type: 'cash', z: -156, x: 174 });
PICKUP_LIST.push({ amount: 125, type: 'cash', z: 488, x: 165 });
PICKUP_LIST.push({ amount: 150, type: 'cash', z: 420, x: 338 });
PICKUP_LIST.push({ amount: 150, type: 'cash', z: 545, x: 322 });
PICKUP_LIST.push({ amount: 90, type: 'cash', z: 156, x: -174 });
PICKUP_LIST.push({ amount: 110, type: 'cash', z: -174, x: -488 });
PICKUP_LIST.push({ amount: 150, type: 'cash', z: -590, x: -322 });
PICKUP_LIST.push({ amount: 75, type: 'cash', z: 338, x: -338 });
PICKUP_LIST.push({ amount: 30, type: 'health', z: -322, x: 326 });
PICKUP_LIST.push({ amount: 30, type: 'health', z: 460, x: -404 });
PICKUP_LIST.push({ amount: 30, type: 'health', z: -338, x: -156 });
PICKUP_LIST.push({ amount: 30, type: 'health', z: 488, x: 488 });
PICKUP_LIST.push({ amount: 30, type: 'health', z: 404, x: 488 });
PICKUP_LIST.push({ amount: 30, type: 'health', z: -586, x: -276 });
const glyphTex = (glyphGiven, tintGiven) => {
  const cvMade = document.createElement('canvas');
  cvMade.width = 128; cvMade.height = 128;
  const pen = cvMade.getContext('2d');
  pen.clearRect(0, 0, 128, 128); pen.fillStyle = tintGiven; pen.font = 'bold 84px Arial, sans-serif';
  pen.textAlign = 'center'; pen.textBaseline = 'middle';
  pen.fillText(glyphGiven, 64, 70); return new THREE.CanvasTexture(cvMade); };
G.pickups = [];
const placePickup = (spotGiven) => {
  const isCash = (spotGiven.type === 'cash');
  const grpMade = new THREE.Group();
  const yBase = groundH(spotGiven.x, spotGiven.z);
  let discColor;
  if (isCash) discColor = 0x2eff7a; else discColor = 0xff4b4b;
  const discMatOpts = {};
  discMatOpts.opacity = 0.55;
  discMatOpts.color = discColor;
  discMatOpts.transparent = true;
  discMatOpts.side = THREE.DoubleSide;
  const discGeo = new THREE.CircleGeometry(1.15, 24);
  const discMesh = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial(discMatOpts));
  discMesh.rotation.x = (-Math.PI / 2); discMesh.position.y = 0.12; grpMade.add(discMesh); try {
    let haloColor;
    if (isCash) haloColor = 0x2eff7a; else haloColor = 0xff4b4b;
    const haloSprite = glowSprite(haloColor, 4.2);
    haloSprite.position.y = 1.1; grpMade.add(haloSprite);
  } catch (swallowed) {}
  let glyphChar;
  if (isCash) glyphChar = '$'; else glyphChar = '+';
  let glyphTint;
  if (isCash) glyphTint = '#baffd2'; else glyphTint = '#ffd2d2';
  const glyphMatOpts = {};
  glyphMatOpts.depthWrite = false;
  glyphMatOpts.map = glyphTex(glyphChar, glyphTint);
  glyphMatOpts.transparent = true;
  glyphMatOpts.side = THREE.DoubleSide;
  const glyphGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const glyphMesh = new THREE.Mesh(glyphGeo, new THREE.MeshBasicMaterial(glyphMatOpts));
  glyphMesh.position.y = 1.15; grpMade.add(glyphMesh);
  grpMade.position.set(spotGiven.x, yBase, spotGiven.z); sceneObj.add(grpMade);
  const phaseVal = ((G.pickups.length * 1.93) % 6.28);
  const pickupRec = {};
  pickupRec.group = grpMade;
  Object.assign(pickupRec, spotGiven);
  pickupRec.disc = discMesh;
  pickupRec.icon = glyphMesh;
  pickupRec.respawnT = 0;
  pickupRec.active = true;
  pickupRec.phase = phaseVal;
  G.pickups.push(pickupRec); };
for (const spotHeld of PICKUP_LIST) placePickup(spotHeld);
const reviveSpot = (pickupGiven) => { pickupGiven.active = true; pickupGiven.group.visible = true; };
const spinSpot = (pickupGiven, dtGiven, elapsedGiven) => {
  pickupGiven.icon.rotation.y += (dtGiven * 2.4);
  pickupGiven.disc.rotation.z += (dtGiven * 1.2);
  pickupGiven.icon.position.y = (1.15 + (Math.sin((elapsedGiven * 2.2) + pickupGiven.phase) * 0.18)); };
const grantPickup = (stateGiven, pickupObj) => {
  pickupObj.respawnT = 60; pickupObj.group.visible = false; pickupObj.active = false;
  (pickupObj.type === 'cash') ? (stateGiven.money = pickupObj.amount + (stateGiven.money || 0),
    stateGiven.toast?.('+$' + pickupObj.amount + '')) : (stateGiven.playerHealth = Math.min(100, ((stateGiven.playerHealth ?? 100) + pickupObj.amount)),
    stateGiven.toast?.('+' + pickupObj.amount + ' HP')); };
const stepSpot = (stateGiven, dtGiven, pickupGiven) => {
  const actorHeld = (stateGiven.car || stateGiven.player);
  const elapsedVal = (stateGiven.elapsed || 0);
  if (!pickupGiven.active) {
    pickupGiven.respawnT -= dtGiven;
    (pickupGiven.respawnT > 0) ? undefined : reviveSpot(pickupGiven);
    return; }
  spinSpot(pickupGiven, dtGiven, elapsedVal);
  if (!actorHeld || stateGiven.frozen) return;
  const distVal = Math.hypot((actorHeld.x - pickupGiven.x), (actorHeld.z - pickupGiven.z)); if (!(distVal < 1.8)) return;
  const healthFull = ((stateGiven.playerHealth ?? 100) >= 100);
  if ((pickupGiven.type === 'health') && healthFull) return;
  grantPickup(stateGiven, pickupGiven); };
G.updaters.push(function (stateGiven, dtGiven) {
  for (const pickupGiven of stateGiven.pickups) stepSpot(stateGiven, dtGiven, pickupGiven); });
if (shotRequested) {
  // Shot staging waits for hero asset loads to settle, or for a
  // timeout that gives up waiting, so model swaps land before the
  // staging and the capture happen. Gameplay boot never waits on
  // any of this: every init above already ran synchronously, and
  // with no shot requested this block never runs at all.
  function stageNow() { setupShot(G, shotRequested);
    const menuNode = document.getElementById('menu');
    menuNode ? (menuNode.style.display = 'none') : undefined; }
  const timeoutWait = new Promise(function (resolveIt) { setTimeout(resolveIt, 6000); });
  const raceHeld = Promise.race([heroAssetsReady, timeoutWait]);
  raceHeld.then(stageNow); }
// Keyboard input lives in this section.
const nearestRide = () => { let bestCar = null, bestRange = 4.5;
  for (const vehGiven of G.vehicles) {
    if (vehGiven.driver === 'traffic') continue;
    const distHere = Math.hypot((vehGiven.x - G.player.x), (vehGiven.z - G.player.z));
    (bestRange > distHere) ? (bestRange = distHere, bestCar = vehGiven) : undefined; }
  return bestCar; };
const toggleRide = () => { const inCar = !!G.car;
  const targetCar = (!inCar && G.player) ? nearestRide() : null;
  inCar ? exitCar(G) : (targetCar ? enterCar(G, targetCar) : undefined); };
const onPauseKey = (codeGiven) => {
  const isPause = (codeGiven === 'KeyP') || (codeGiven === 'Escape');
  (isPause === true) ? (G.paused = !G.paused, G.togglePause ? G.togglePause(G.paused) : undefined) : undefined; };
const onMuteKey = (codeGiven) => {
  const audioRef = G.audio;
  (codeGiven === 'KeyM') ? (audioRef && audioRef.toggleMute ? audioRef.toggleMute() : undefined) : undefined; };
addEventListener('keydown', function (evGiven) {
  G.keys[evGiven.code] = true; onPauseKey(evGiven.code); onMuteKey(evGiven.code);
  if (evGiven.code === 'KeyF') toggleRide();
  const swallowCodes = [];
  swallowCodes.push('ArrowUp');
  swallowCodes.push('ArrowDown');
  swallowCodes.push('Space');
  swallowCodes.includes(evGiven.code) ? evGiven.preventDefault() : undefined; });
addEventListener('keyup', function (evGiven) { G.keys[evGiven.code] = false; });
let lastStamp = performance.now();
const onResize = () => {
  camObj.aspect = (innerWidth / innerHeight);
  camObj.updateProjectionMatrix(); rendObj.setSize(innerWidth, innerHeight); };
addEventListener('resize', onResize);
const menuNodeMain = document.getElementById('menu');
menuNodeMain ? menuNodeMain.addEventListener('click', function () {
  menuNodeMain.style.display = 'none'; G.mode = 'play'; }) : undefined;
const easeFovTo = (fovTarget, dtGiven) => {
  const fovDelta = (fovTarget - camObj.fov); if (!(Math.abs(fovDelta) > 0.05)) return;
  camObj.fov += (fovDelta * Math.min(1, (dtGiven * 3)));
  camObj.fov = Math.max(45, Math.min(85, camObj.fov)); camObj.updateProjectionMatrix(); };
const driveCam = (dtGiven) => {
  const carHeld = G.car; const backDist = 8.5; const camHeight = 3.2;
  const goalX = (carHeld.x - (Math.sin(carHeld.angle) * backDist));
  const goalZ = (carHeld.z - (Math.cos(carHeld.angle) * backDist));
  const blendVal = Math.min(1, (dtGiven * 5));
  camObj.position.x += ((goalX - camObj.position.x) * blendVal);
  camObj.position.z += ((goalZ - camObj.position.z) * blendVal);
  camObj.position.y += (((groundH(carHeld.x, carHeld.z) + camHeight) - camObj.position.y) * blendVal);
  const lookX = (carHeld.x + (Math.sin(carHeld.angle) * 6));
  const lookY = (groundH(carHeld.x, carHeld.z) + 1.4);
  const lookZ = (carHeld.z + (Math.cos(carHeld.angle) * 6));
  camObj.lookAt(lookX, lookY, lookZ);
  G.camYaw = (carHeld.angle + Math.PI);
  const speedFrac = Math.min(1, (Math.abs(carHeld.speed) / (carHeld.spec.topSpeed * 0.8)));
  let nosBonus;
  if (G.flags.nosActive) nosBonus = 4; else nosBonus = 0;
  const fovTarget = ((62 + nosBonus) + (speedFrac * 10));
  easeFovTo(fovTarget, dtGiven); };
const wrapAng = (deltaGiven) => {
  let wrappedVal = deltaGiven;
  for (; wrappedVal > Math.PI;) wrappedVal -= (Math.PI * 2);
  for (; -Math.PI > wrappedVal;) wrappedVal += (Math.PI * 2);
  return wrappedVal; };
const walkCam = (dtGiven) => {
  const walkerHeld = G.player;
  const behindX = (walkerHeld.x - (Math.sin(G.camYaw) * 7));
  const behindZ = (walkerHeld.z - (Math.cos(G.camYaw) * 7));
  const blendVal = Math.min(1, (dtGiven * 6));
  camObj.position.x += ((behindX - camObj.position.x) * blendVal);
  camObj.position.z += ((behindZ - camObj.position.z) * blendVal);
  camObj.position.y += (((groundH(walkerHeld.x, walkerHeld.z) + 3) - camObj.position.y) * blendVal);
  camObj.lookAt(walkerHeld.x, (groundH(walkerHeld.x, walkerHeld.z) + 1.4), walkerHeld.z);
  easeFovTo(60, dtGiven);
  const yawTarget = (walkerHeld.angle + Math.PI);
  const yawDelta = wrapAng(yawTarget - G.camYaw);
  (walkerHeld.speed > 0) ? (G.camYaw += (yawDelta * Math.min(1, (dtGiven * 1.6)))) : undefined; };
const followSun = () => {
  // Shadow following: the world updater has just reset the sun
  // position to the pure time of day offset aimed at the origin, so
  // that vector is the sun direction; pinning it again on the player
  // or car keeps direction and elevation while the shadow box stays
  // centred on the action. Shot modes stay exempt because their
  // module pins the target on the staged look point.
  const followOn = G.shadowFollow && G.sun && !G.shotCam; if (!followOn) return;
  const anchorHeld = (G.car || G.player);
  if (!anchorHeld || !G.sun.target) return;
  const offsetVec = SUN_VEC.copy(G.sun.position);
  G.sun.target.position.set(anchorHeld.x, groundH(anchorHeld.x, anchorHeld.z), anchorHeld.z);
  const sunPos = G.sun.position;
  sunPos.copy(G.sun.target.position);
  sunPos.add(offsetVec);
  G.sun.target.parent ? undefined : sceneObj.add(G.sun.target);
  G.sun.target.updateMatrixWorld(); };
const stepPlay = (dtGiven) => {
  const updaterIter = G.updaters[Symbol.iterator]();
  let updaterStep = updaterIter.next();
  while (!updaterStep.done) {
    const updaterGiven = updaterStep.value;
    try { updaterGiven(G, dtGiven); } catch (faultGiven) { console.error(faultGiven); }
    updaterStep = updaterIter.next(); }
  if (G.frozen) return;
  G.car ? updateDriving(G, dtGiven) : updatePlayer(G, dtGiven);
  updateTraffic(G, dtGiven); };
const frameCam = (dtGiven) => {
  G.shotCam ? G.shotCam() : ((G.mode === 'play') ? (G.car ? driveCam(dtGiven) : (G.player ? walkCam(dtGiven) : undefined)) : (camObj.position.set(-412, 6, 492), camObj.lookAt(-412, 2, 440))); };
const tickFrame = (stampGiven) => {
  requestAnimationFrame(tickFrame);
  const rawDt = ((stampGiven - lastStamp) / 1000);
  const dtVal = Math.max(0, Math.min(0.05, rawDt)); lastStamp = stampGiven;
  if (G.paused) { rendObj.render(sceneObj, camObj); return; }
  G.elapsed += dtVal;
  shotRequested ? undefined : (G.timeOfDay = ((G.timeOfDay + ((dtVal / CFG.dayLength) * 24)) % 24));
  (G.mode === 'play') ? stepPlay(dtVal) : undefined;
  updateSmoke(G, dtVal); updateWorld(G, dtVal);
  updateSky(G, dtVal); followSun(); frameCam(dtVal); rendObj.render(sceneObj, camObj); };
requestAnimationFrame(tickFrame);
