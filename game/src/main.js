// Boot sequence, frame loop, camera work, wiring and shot mode
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
const queryParams = new URLSearchParams(location.search);
const FALLBACK_SEED = 1;
const pickedSeed = parseInt(queryParams.get('seed') || String(FALLBACK_SEED), 10) || FALLBACK_SEED;
const requestedShot = queryParams.get('shot');
srand(pickedSeed);
const canvasEl = document.getElementById('gameCanvas');
// Sun shadow boot numbers live in one place, so retuning the shadow
// setup stays a one line change and the boot block reads only here
const SHADOW_SETUP = { mapSize: 2048, box: 110, near: 10, far: 600, bias: -0.0005, normalBias: 0.5 };
const SUN_OFFSET_SCRATCH = new THREE.Vector3();
const glRenderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
glRenderer.shadowMap.enabled = true;
glRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
glRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
glRenderer.setSize(innerWidth, innerHeight);
const worldScene = new THREE.Scene();
worldScene.background = new THREE.Color(0x87c5eb);
worldScene.fog = new THREE.Fog(0x87c5eb, 220, 900);
const viewCamera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 3000);
viewCamera.position.set(-412, 4, 486);
const skyLight = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 0.9); worldScene.add(skyLight);
const sunLamp = new THREE.DirectionalLight(0xfff2d8, 1.3); sunLamp.position.set(200, 260, 120); worldScene.add(sunLamp);
// Shadow boot plus the follow contract around it
// The sun is the sole shadow caster, and its ortho box, map size and
// biases all come from the config above, tuned against acne on low
// poly facades, while three owners move the light afterwards and
// none retunes these values: the world updater repositions from
// time of day each frame without touching the target, the main loop
// anchors position and target on the player or car, and shot modes
// pin it on their staged look at point with a tighter box
sunLamp.castShadow = true;
sunLamp.shadow.mapSize.set(SHADOW_SETUP.mapSize, SHADOW_SETUP.mapSize);
sunLamp.shadow.camera.left = -SHADOW_SETUP.box; sunLamp.shadow.camera.right = SHADOW_SETUP.box;
sunLamp.shadow.camera.top = SHADOW_SETUP.box; sunLamp.shadow.camera.bottom = -SHADOW_SETUP.box;
sunLamp.shadow.camera.near = SHADOW_SETUP.near; sunLamp.shadow.camera.far = SHADOW_SETUP.far;
sunLamp.shadow.bias = SHADOW_SETUP.bias; sunLamp.shadow.normalBias = SHADOW_SETUP.normalBias;
sunLamp.shadow.camera.updateProjectionMatrix();
const G = { elapsed: 0, camDist: 7, camYaw: Math.PI,
  sun: sunLamp, hemi: skyLight, water: null, hq: null, shadowFollow: true,
  scene: worldScene, camera: viewCamera, renderer: glRenderer, canvas: canvasEl,
  mode: requestedShot ? 'play' : 'menu', shot: requestedShot, seed: pickedSeed, keys: {},
  timeOfDay: requestedShot ? 17.9 : CFG.startHour, money: 500, rep: 0, rankIdx: 0, wanted: 0, speedKmh: 0,
  car: null, player: null, paused: false, shotCam: null,
  flags: {}, updaters: [], colliders: [],
  addCollider(x, z, hw, hd, h) { this.colliders.push({ x, z, hw, hd, h }); },
  roadX: [], roadZ: [], touge: [], missionIndex: 0,
  districtState: { port: { control: 50, owner: 'ronin' },
    coral: { control: 30, owner: 'neutral' }, neon: { control: 20, owner: 'rival' },
    hoshino: { control: 10, owner: 'rival' } },
  audio: null, heli: null, cops: [], peds: [], vehicles: [], traffic: [],
  exitCar: null, enterCar: null,
  garage: ['hachi'], ownedCars: ['hachi'] };
G.enterCar = (vehIn) => enterCar(G, vehIn);
G.exitCar = () => exitCar(G); window.G = G; initSave(G);
// The world builder reads the anisotropy value guarded, so it has to
// exist before the world build runs
G.maxAniso = glRenderer.capabilities.getMaxAnisotropy();
buildWorld(G); initSky(G); createPlayer(G);
const starterVehicle = spawnVehicle(G, 'hachi', -412.5, 452, Math.PI, { driver: 'parked' });
G.starterCar = starterVehicle;
spawnVehicle(G, 'svj', -430, 452, 0.9, { driver: 'parked' });
spawnTraffic(G, 14);
spawnVehicle(G, 'sedan', 154, 300, 0,
  { driver: 'parked' });
spawnVehicle(G, 'hatch', 176, -60, Math.PI,
  { driver: 'parked' });
spawnVehicle(G, 'wagon', -60, 484, Math.PI / 2,
  { driver: 'parked' });
spawnVehicle(G, 'suv', 60, 506, -Math.PI / 2,
  { driver: 'parked' });
spawnVehicle(G, 'kei', 319, -140, 0,
  { driver: 'parked' });
spawnVehicle(G, 'van', 341, -420, Math.PI,
  { driver: 'parked' });
spawnVehicle(G, 'roadster', -140, 319, Math.PI / 2,
  { driver: 'parked' });
spawnVehicle(G, 'sedan', 420, -341, -Math.PI / 2,
  { driver: 'parked' });
initVespas(G); initPeds(G); initPolice(G);
initMissions(G); initHUD(G); initAudio(G); initWeapons(G);
// Hospital marker at the wasted respawn corner: a pole plus a white
// sign carrying a red cross canvas texture, while the world module
// itself stays untouched
{ const markerX = 335, markerZ = -335;
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.6 }));
  signPole.position.set(markerX, groundH(markerX, markerZ) + 2.5, markerZ);
  worldScene.add(signPole);
  const crossCanvas = document.createElement('canvas'); crossCanvas.width = 128; crossCanvas.height = 128;
  const crossCtx = crossCanvas.getContext('2d');
  crossCtx.fillStyle = '#ffffff'; crossCtx.fillRect(0, 0, 128, 128);
  crossCtx.fillStyle = '#d8232a'; crossCtx.fillRect(52, 24, 24, 80); crossCtx.fillRect(24, 52, 80, 24);
  const crossTexture = new THREE.CanvasTexture(crossCanvas);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.25),
    new THREE.MeshBasicMaterial({ map: crossTexture }));
  signBoard.position.set(markerX, groundH(markerX, markerZ) + 5.4, markerZ);
  signBoard.rotation.y = Math.PI / 4;
  worldScene.add(signBoard); }
// Pickups: cash spots and health spots, each a glow disc that spins
// and bobs in place
const PICKUP_SPOTS = [
  { type: 'cash', amount: 100,
    x: 174, z: -156 },
  { type: 'cash', amount: 125,
    x: 165, z: 488 },
  { type: 'cash', amount: 150,
    x: 338, z: 420 },
  { type: 'cash', amount: 150,
    x: 322, z: 545 },
  { type: 'cash', amount: 90,
    x: -174, z: 156 },
  { type: 'cash', amount: 110,
    x: -488, z: -174 },
  { type: 'cash', amount: 150,
    x: -322, z: -590 },
  { type: 'cash', amount: 75,
    x: -338, z: 338 },
  { type: 'health', amount: 30,
    x: 326, z: -322 },
  { type: 'health', amount: 30,
    x: -404, z: 460 },
  { type: 'health', amount: 30,
    x: -156, z: -338 },
  { type: 'health', amount: 30,
    x: 488, z: 488 },
  { type: 'health', amount: 30,
    x: 488, z: 404 },
  { type: 'health', amount: 30,
    x: -276, z: -586 },
];
function makeGlyphTexture(glyphIn, tintIn) {
  const glyphCanvas = document.createElement('canvas'); glyphCanvas.width = 128; glyphCanvas.height = 128;
  const glyphCtx = glyphCanvas.getContext('2d');
  glyphCtx.clearRect(0, 0, 128, 128);
  glyphCtx.fillStyle = tintIn;
  glyphCtx.font = 'bold 84px Arial, sans-serif';
  glyphCtx.textAlign = 'center'; glyphCtx.textBaseline = 'middle';
  glyphCtx.fillText(glyphIn, 64, 70);
  return new THREE.CanvasTexture(glyphCanvas); }
G.pickups = []; PICKUP_SPOTS.forEach((spotDef) => {
  const cashKind = spotDef.type === 'cash';
  const spotGroup = new THREE.Group();
  const spotGroundY = groundH(spotDef.x, spotDef.z);
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 24),
    new THREE.MeshBasicMaterial({ color: cashKind ? 0x2eff7a : 0xff4b4b, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  glowDisc.rotation.x = -Math.PI / 2; glowDisc.position.y = 0.12;
  spotGroup.add(glowDisc);
  try { const haloSprite = glowSprite(cashKind ? 0x2eff7a : 0xff4b4b, 4.2); haloSprite.position.y = 1.1; spotGroup.add(haloSprite); } catch (err) {}
  const glyphIcon = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: makeGlyphTexture(cashKind ? '$' : '+', cashKind ? '#baffd2' : '#ffd2d2'), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  glyphIcon.position.y = 1.15;
  spotGroup.add(glyphIcon);
  spotGroup.position.set(spotDef.x, spotGroundY, spotDef.z);
  worldScene.add(spotGroup);
  G.pickups.push({ ...spotDef, group: spotGroup, icon: glyphIcon, disc: glowDisc, active: true, respawnT: 0, phase: (G.pickups.length * 1.93) % 6.28 }); });
G.updaters.push((G2, dtStep) => { const actorNow = G2.car || G2.player;
  const elapsedNow = G2.elapsed || 0;
  G2.pickups.forEach((pickupEntry) => {
    if (!pickupEntry.active) {
      pickupEntry.respawnT -= dtStep;
      if (!(pickupEntry.respawnT > 0)) { pickupEntry.group.visible = true; pickupEntry.active = true; }
      return; }
    pickupEntry.icon.rotation.y += dtStep * 2.4;
    pickupEntry.disc.rotation.z += dtStep * 1.2;
    pickupEntry.icon.position.y = 1.15 + Math.sin(elapsedNow * 2.2 + pickupEntry.phase) * 0.18;
    if (!actorNow || G2.frozen) return;
    if (Math.hypot(actorNow.x - pickupEntry.x, actorNow.z - pickupEntry.z) < 1.8) {
      if (pickupEntry.type === 'health' && (G2.playerHealth ?? 100) >= 100) return;
      pickupEntry.active = false; pickupEntry.group.visible = false; pickupEntry.respawnT = 60;
      if (pickupEntry.type === 'cash') { G2.money = (G2.money || 0) + pickupEntry.amount; G2.toast?.(`+$${pickupEntry.amount}`); }
      else { G2.playerHealth = Math.min(100, (G2.playerHealth ?? 100) + pickupEntry.amount); G2.toast?.(`+${pickupEntry.amount} HP`); } } }); });
if (requestedShot) {
  // Shot staging waits until hero asset loads settle, capped by a
  // timeout, so model swaps land before staging and capture happen
  // Gameplay boot is not delayed, because every init above already
  // ran synchronously, and without a shot request this never runs
  const runStaging = () => {
    setupShot(G, requestedShot);
    const menuNode = document.getElementById('menu'); if (menuNode) menuNode.style.display = 'none'; };
  const timeoutPromise = new Promise((resolveIt) => setTimeout(resolveIt, 6000));
  Promise.race([heroAssetsReady, timeoutPromise]).then(runStaging); }
// Keyboard input handling
addEventListener('keydown', (ev) => {
  G.keys[ev.code] = true;
  if (ev.code === 'KeyP' || ev.code === 'Escape') { G.paused = !G.paused; if (G.togglePause) G.togglePause(G.paused); }
  if (ev.code === 'KeyM') { const audioNow = G.audio; if (audioNow && audioNow.toggleMute) audioNow.toggleMute(); }
  if (ev.code === 'KeyF') {
    if (G.car) exitCar(G); else if (G.player) {
      let nearestVeh = null, nearestDist = 4.5;
      G.vehicles.forEach((vehEntry) => { if (vehEntry.driver === 'traffic') return; const distHere = Math.hypot(vehEntry.x - G.player.x, vehEntry.z - G.player.z); if (nearestDist > distHere) { nearestDist = distHere; nearestVeh = vehEntry; } });
      if (nearestVeh) enterCar(G, nearestVeh); } }
  if (['ArrowUp', 'ArrowDown', 'Space'].includes(ev.code)) ev.preventDefault(); });
addEventListener('keyup', (ev) => { G.keys[ev.code] = false; });
const onResize = () => {
  viewCamera.aspect = innerWidth / innerHeight;
  viewCamera.updateProjectionMatrix();
  glRenderer.setSize(innerWidth, innerHeight); };
addEventListener('resize', onResize);
const menuEl = document.getElementById('menu');
if (menuEl) menuEl.addEventListener('click', () => { menuEl.style.display = 'none'; G.mode = 'play'; });
let lastStamp = performance.now();
function tickFrame(stampIn) {
  requestAnimationFrame(tickFrame);
  let frameDt = Math.max(0, Math.min(0.05, (stampIn - lastStamp) / 1000)); lastStamp = stampIn;
  if (G.paused) { glRenderer.render(worldScene, viewCamera); return; }
  G.elapsed += frameDt;
  if (!requestedShot) G.timeOfDay = (G.timeOfDay + (frameDt / CFG.dayLength) * 24) % 24;
  if (G.mode === 'play') {
    G.updaters.forEach((updaterFn) => { try { updaterFn(G, frameDt); } catch (err) { console.error(err); } });
    if (!G.frozen) { if (G.car) updateDriving(G, frameDt); else updatePlayer(G, frameDt);
      updateTraffic(G, frameDt); } }
  updateSmoke(G, frameDt); updateWorld(G, frameDt); updateSky(G, frameDt);
  // Shadow following: the world updater has just reset the sun
  // position to the pure time of day offset aimed at the origin, so
  // that vector is the sun direction, and re anchoring it on the
  // player or car keeps direction and elevation while the shadow
  // box stays centred on the action, and shot modes stay exempt
  // because their module pins the target on the staged look point
  if (G.shadowFollow && G.sun && !G.shotCam) { const anchorObj = G.car || G.player;
    if (anchorObj && G.sun.target) {
      const sunOffset = SUN_OFFSET_SCRATCH.copy(G.sun.position);
      G.sun.target.position.set(anchorObj.x, groundH(anchorObj.x, anchorObj.z), anchorObj.z);
      G.sun.position.copy(G.sun.target.position).add(sunOffset);
      if (!G.sun.target.parent) worldScene.add(G.sun.target);
      G.sun.target.updateMatrixWorld(); } }
  if (G.shotCam) G.shotCam();
  else if (G.mode === 'play') {
    if (G.car) { const drivenCar = G.car;
      const followDist = 8.5, followHeight = 3.2;
      const targetX = drivenCar.x - Math.sin(drivenCar.angle) * followDist, targetZ = drivenCar.z - Math.cos(drivenCar.angle) * followDist;
      viewCamera.position.x += (targetX - viewCamera.position.x) * Math.min(1, frameDt * 5);
      viewCamera.position.z += (targetZ - viewCamera.position.z) * Math.min(1, frameDt * 5);
      viewCamera.position.y += ((groundH(drivenCar.x, drivenCar.z) + followHeight) - viewCamera.position.y) * Math.min(1, frameDt * 5);
      viewCamera.lookAt(drivenCar.x + Math.sin(drivenCar.angle) * 6, groundH(drivenCar.x, drivenCar.z) + 1.4, drivenCar.z + Math.cos(drivenCar.angle) * 6);
      G.camYaw = drivenCar.angle + Math.PI;
      const wantedFov = 62 + (G.flags.nosActive ? 4 : 0) + Math.min(1, Math.abs(drivenCar.speed) / (drivenCar.spec.topSpeed * 0.8)) * 10;
      const fovGap = wantedFov - viewCamera.fov;
      if (Math.abs(fovGap) > 0.05) { viewCamera.fov += fovGap * Math.min(1, frameDt * 3); viewCamera.fov = Math.max(45, Math.min(85, viewCamera.fov)); viewCamera.updateProjectionMatrix(); }
    } else if (G.player) { const walker = G.player;
      const backX = walker.x - Math.sin(G.camYaw) * 7, backZ = walker.z - Math.cos(G.camYaw) * 7;
      viewCamera.position.x += (backX - viewCamera.position.x) * Math.min(1, frameDt * 6);
      viewCamera.position.z += (backZ - viewCamera.position.z) * Math.min(1, frameDt * 6);
      viewCamera.position.y += ((groundH(walker.x, walker.z) + 3) - viewCamera.position.y) * Math.min(1, frameDt * 6);
      viewCamera.lookAt(walker.x, groundH(walker.x, walker.z) + 1.4, walker.z);
      const fovGap = 60 - viewCamera.fov;
      if (Math.abs(fovGap) > 0.05) { viewCamera.fov += fovGap * Math.min(1, frameDt * 3); viewCamera.fov = Math.max(45, Math.min(85, viewCamera.fov)); viewCamera.updateProjectionMatrix(); }
      if (walker.speed > 0) { const wantedYaw = walker.angle + Math.PI; let yawGap = wantedYaw - G.camYaw; while (yawGap > Math.PI) yawGap -= Math.PI * 2; while (-Math.PI > yawGap) yawGap += Math.PI * 2; G.camYaw += yawGap * Math.min(1, frameDt * 1.6); } } }
  else { viewCamera.position.set(-412, 6, 492); viewCamera.lookAt(-412, 2, 440); }
  glRenderer.render(worldScene, viewCamera); }
requestAnimationFrame(tickFrame);
