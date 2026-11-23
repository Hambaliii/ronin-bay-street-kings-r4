// main.js — boot, loop, camera, wiring, shot mode
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

const params = new URLSearchParams(location.search);
const DEFAULT_SEED = 1; // Vice V3 sweep: fallback world seed when ?seed= is absent/invalid
const seed = parseInt(params.get('seed') || String(DEFAULT_SEED), 10) || DEFAULT_SEED;
const shot = params.get('shot');
srand(seed);

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true; // V5 (B3): real sun shadows on
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5eb);
scene.fog = new THREE.Fog(0x87c5eb, 220, 900);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 3000);
camera.position.set(-412, 4, 486);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.3); sun.position.set(200, 260, 120); scene.add(sun);
// V5 (B3) shadow boot: the sun is the one shadow caster. Ortho box
// ±110 m around the light axis, 2048px map; bias/normalBias tuned
// conservatively so the low-poly facades don't acne. world.js'
// updateWorld repositions this light from the tod every frame (and
// never touches its target), so gameplay recentring works by moving
// sun.target + position together in the loop (G.shadowFollow, below),
// and shot modes tighten the box to ±85 around their look-at point
// (shots.js pinShadow).
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 10; sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.5;
sun.shadow.camera.updateProjectionMatrix();

const G = {
  scene, camera, renderer, canvas, mode: shot ? 'play' : 'menu', shot, seed,
  // Vice round: shot captures boot at dusk (17.9), not CFG.startHour's
  // flat noon. setupShot is deferred behind the assets-ready gate (up
  // to 6 s below), and modes that never set their own tod ('city' /
  // 'cover' among them) used to render — and could be captured — at
  // noon; every mode that needs another hour still overrides this in
  // setupShot ('chase' included: it sets 17.6 itself). Non-shot play
  // is untouched: the live clock still starts at CFG.startHour.
  keys: {}, timeOfDay: shot ? 17.9 : CFG.startHour,
  money: 500, rep: 0, rankIdx: 0, wanted: 0, speedKmh: 0,
  car: null, player: null, paused: false, shotCam: null,
  updaters: [], colliders: [],
  addCollider(x, z, hw, hd, h) { this.colliders.push({ x, z, hw, hd, h }); },
  roadX: [], roadZ: [], touge: [], missionIndex: 0, flags: {},
  districtState: { port: { control: 50, owner: 'ronin' }, coral: { control: 30, owner: 'neutral' }, neon: { control: 20, owner: 'rival' }, hoshino: { control: 10, owner: 'rival' } },
  audio: null, heli: null, cops: [], peds: [], vehicles: [], traffic: [],
  shadowFollow: true, // V5 (B3): loop keeps the sun's shadow box on the player (see loop)
  camYaw: Math.PI, camDist: 7, elapsed: 0, sun, hemi, hq: null, water: null,
  enterCar: null, exitCar: null, garage: ['hachi'], ownedCars: ['hachi'],
};
G.enterCar = (v) => enterCar(G, v);
G.exitCar = () => exitCar(G);
window.G = G;

initSave(G);
// V5 (B3): world.js reads G.maxAniso (guarded) for its ground/road
// textures — it must be set BEFORE buildWorld runs.
G.maxAniso = renderer.capabilities.getMaxAnisotropy();
buildWorld(G);
initSky(G);
createPlayer(G);
// starter car parked at HQ garage apron
const starter = spawnVehicle(G, 'hachi', -412.5, 452, Math.PI, { driver: 'parked' });
G.starterCar = starter;
// S31 showcase: the dream car — a static SVJ Aventador on the HQ apron
// (GLB swap + matte-black/glass/Y-light treatment like any svj spawn).
spawnVehicle(G, 'svj', -430, 452, 0.9, { driver: 'parked' });
spawnTraffic(G, 14);
// Parked life: fixed street-edge cars (deterministic, never hero/police specs).
spawnVehicle(G, 'sedan', 154, 300, 0, { driver: 'parked' });
spawnVehicle(G, 'hatch', 176, -60, Math.PI, { driver: 'parked' });
spawnVehicle(G, 'wagon', -60, 484, Math.PI / 2, { driver: 'parked' });
spawnVehicle(G, 'suv', 60, 506, -Math.PI / 2, { driver: 'parked' });
spawnVehicle(G, 'kei', 319, -140, 0, { driver: 'parked' });
spawnVehicle(G, 'van', 341, -420, Math.PI, { driver: 'parked' });
spawnVehicle(G, 'roadster', -140, 319, Math.PI / 2, { driver: 'parked' });
spawnVehicle(G, 'sedan', 420, -341, -Math.PI / 2, { driver: 'parked' });
initVespas(G);
initPeds(G);
initPolice(G);
initMissions(G);
initHUD(G);
initAudio(G);
initWeapons(G);
// --- S26 hospital marker (world.js untouched): pole + white sign with a
// red-cross canvas texture at the WASTED respawn corner (330,-330). -------
{
  const hx = 335, hz = -335;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 5, 8),
    new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.6 })
  );
  pole.position.set(hx, groundH(hx, hz) + 2.5, hz);
  scene.add(pole);
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g2 = c.getContext('2d');
  g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 128, 128);
  g2.fillStyle = '#d8232a'; g2.fillRect(52, 24, 24, 80); g2.fillRect(24, 52, 80, 24);
  const signTex = new THREE.CanvasTexture(c);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.6, 0.25),
    new THREE.MeshBasicMaterial({ map: signTex })
  );
  sign.position.set(hx, groundH(hx, hz) + 5.4, hz);
  sign.rotation.y = Math.PI / 4;
  scene.add(sign);
}
// --- S26 pickups: 8 cash + 6 health, spinning/bobbing glow discs ---------
const PICKUP_SPOTS = [
  { type: 'cash', amount: 100, x: 174, z: -156 },   // Downtown intersection
  { type: 'cash', amount: 125, x: 165, z: 488 },    // Coral Bay road
  { type: 'cash', amount: 150, x: 338, z: 420 },    // Portside gate
  { type: 'cash', amount: 150, x: 322, z: 545 },    // Port south quay
  { type: 'cash', amount: 90, x: -174, z: 156 },    // Neon District
  { type: 'cash', amount: 110, x: -488, z: -174 },  // Harborview
  { type: 'cash', amount: 150, x: -322, z: -590 },  // Touge summit (S34: moved off the 'hero' shot frame)
  { type: 'cash', amount: 75, x: -338, z: 338 },    // Hoshino blocks
  { type: 'health', amount: 30, x: 326, z: -322 },  // Hospital corner
  { type: 'health', amount: 30, x: -404, z: 460 },  // HQ garage apron
  { type: 'health', amount: 30, x: -156, z: -338 }, // Downtown south
  { type: 'health', amount: 30, x: 488, z: 488 },   // Coral Bay east
  { type: 'health', amount: 30, x: 488, z: 404 },   // Portside east
  { type: 'health', amount: 30, x: -276, z: -586 }, // Touge lower bend
];
function pickupTexture(glyph, color) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g2 = c.getContext('2d');
  g2.clearRect(0, 0, 128, 128);
  g2.fillStyle = color;
  g2.font = 'bold 84px Arial, sans-serif';
  g2.textAlign = 'center'; g2.textBaseline = 'middle';
  g2.fillText(glyph, 64, 70);
  return new THREE.CanvasTexture(c);
}
G.pickups = [];
for (const s of PICKUP_SPOTS) {
  const isCash = s.type === 'cash';
  const grp = new THREE.Group();
  const gy = groundH(s.x, s.z);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 24),
    new THREE.MeshBasicMaterial({ color: isCash ? 0x2eff7a : 0xff4b4b, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
  );
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.12;
  grp.add(disc);
  try { const glow = glowSprite(isCash ? 0x2eff7a : 0xff4b4b, 4.2); glow.position.y = 1.1; grp.add(glow); } catch (e) {}
  const icon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: pickupTexture(isCash ? '$' : '+', isCash ? '#baffd2' : '#ffd2d2'), transparent: true, side: THREE.DoubleSide, depthWrite: false })
  );
  icon.position.y = 1.15;
  grp.add(icon);
  grp.position.set(s.x, gy, s.z);
  scene.add(grp);
  G.pickups.push({ ...s, group: grp, icon, disc, active: true, respawnT: 0, phase: (G.pickups.length * 1.93) % 6.28 });
}
G.updaters.push((G2, dt) => {
  const pp = G2.car || G2.player;
  const t = G2.elapsed || 0;
  for (const pk of G2.pickups) {
    if (!pk.active) {
      pk.respawnT -= dt;
      if (pk.respawnT <= 0) { pk.active = true; pk.group.visible = true; }
      continue;
    }
    pk.icon.rotation.y += dt * 2.4;
    pk.disc.rotation.z += dt * 1.2;
    pk.icon.position.y = 1.15 + Math.sin(t * 2.2 + pk.phase) * 0.18;
    if (!pp || G2.frozen) continue;
    if (Math.hypot(pp.x - pk.x, pp.z - pk.z) < 1.8) {
      if (pk.type === 'health' && (G2.playerHealth ?? 100) >= 100) continue; // leave it for when it matters
      pk.active = false; pk.group.visible = false; pk.respawnT = 60;
      if (pk.type === 'cash') { G2.money = (G2.money || 0) + pk.amount; G2.toast?.(`+$${pk.amount}`); }
      else { G2.playerHealth = Math.min(100, (G2.playerHealth ?? 100) + pk.amount); G2.toast?.(`+${pk.amount} HP`); }
    }
  }
});
if (shot) {
  // S34: defer ONLY the shot staging until the hero-asset loads settle
  // (6 s cap) so GLB swaps have landed before the scene is staged and
  // captured. Gameplay boot above is NOT delayed — every init ran
  // synchronously as before; without ?shot this block never runs.
  const applyShot = () => {
    setupShot(G, shot);
    const menu = document.getElementById('menu'); if (menu) menu.style.display = 'none';
  };
  const shotTimeout = new Promise((resolve) => setTimeout(resolve, 6000));
  Promise.race([heroAssetsReady, shotTimeout]).then(applyShot);
}

// input
addEventListener('keydown', (e) => {
  G.keys[e.code] = true;
  if (e.code === 'KeyP' || e.code === 'Escape') { G.paused = !G.paused; if (G.togglePause) G.togglePause(G.paused); }
  if (e.code === 'KeyM') { if (G.audio && G.audio.toggleMute) G.audio.toggleMute(); }
  if (e.code === 'KeyF') {
    if (G.car) exitCar(G);
    else if (G.player) {
      let best = null, bd = 4.5;
      for (const v of G.vehicles) { if (v.driver === 'traffic') continue; const d = Math.hypot(v.x - G.player.x, v.z - G.player.z); if (d < bd) { bd = d; best = v; } }
      if (best) enterCar(G, best);
    }
  }
  if (['ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { G.keys[e.code] = false; });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
const menuEl = document.getElementById('menu');
if (menuEl) menuEl.addEventListener('click', () => { G.mode = 'play'; menuEl.style.display = 'none'; });

let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.paused) { renderer.render(scene, camera); return; }
  G.elapsed += dt;
  if (!shot) G.timeOfDay = (G.timeOfDay + (dt / CFG.dayLength) * 24) % 24;
  if (G.mode === 'play') {
    for (const u of G.updaters) { try { u(G, dt); } catch (err) { console.error(err); } }
    // S26 freeze: during a WASTED/BUSTED overlay the player + traffic halt
    // (cop AI halts inside police.js); updaters keep running so the HUD
    // respawn timer can tick the world back in.
    if (!G.frozen) {
      if (G.car) updateDriving(G, dt); else updatePlayer(G, dt);
      updateTraffic(G, dt);
    }
  }
  updateSmoke(G, dt);
  updateWorld(G, dt);
  updateSky(G, dt);
  // V5 (B3) shadow follow: updateWorld has just reset sun.position to
  // the pure tod offset (aimed at the origin), so that vector IS the
  // sun direction — re-anchor it on the player/car: target moves to
  // the anchor, position becomes anchor + tod offset, direction and
  // tod elevation are preserved exactly and the ±110 shadow box stays
  // centred on the action instead of the map origin. Shot modes are
  // exempt: shots.js pins sun.target on the staged look-at point.
  if (G.shadowFollow && G.sun && !G.shotCam) {
    const anchor = G.car || G.player;
    if (anchor && G.sun.target) {
      const off = G.sun.position.clone();
      G.sun.target.position.set(anchor.x, groundH(anchor.x, anchor.z), anchor.z);
      G.sun.position.copy(G.sun.target.position).add(off);
      if (!G.sun.target.parent) scene.add(G.sun.target);
      G.sun.target.updateMatrixWorld();
    }
  }
  // camera
  if (G.shotCam) { G.shotCam(); }
  else if (G.mode === 'play') {
    if (G.car) {
      const v = G.car;
      const back = 8.5, h = 3.2;
      const tx = v.x - Math.sin(v.angle) * back, tz = v.z - Math.cos(v.angle) * back;
      camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 5);
      camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 5);
      camera.position.y += ((groundH(v.x, v.z) + h) - camera.position.y) * Math.min(1, dt * 5);
      camera.lookAt(v.x + Math.sin(v.angle) * 6, groundH(v.x, v.z) + 1.4, v.z + Math.cos(v.angle) * 6);
      G.camYaw = v.angle + Math.PI;
      const targetFov = 62 + 10 * Math.min(1, Math.abs(v.speed) / (v.spec.topSpeed * 0.8)) + (G.flags.nosActive ? 4 : 0);
      const fovDelta = targetFov - camera.fov;
      if (Math.abs(fovDelta) > 0.05) { camera.fov += fovDelta * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    } else if (G.player) {
      const p = G.player;
      // mouse-free orbit: camYaw follows movement slowly; A/D handled in player relative to camYaw
      const tx = p.x - Math.sin(G.camYaw) * 7, tz = p.z - Math.cos(G.camYaw) * 7;
      camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 6);
      camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 6);
      camera.position.y += ((groundH(p.x, p.z) + 3) - camera.position.y) * Math.min(1, dt * 6);
      camera.lookAt(p.x, groundH(p.x, p.z) + 1.4, p.z);
      const footFovDelta = 60 - camera.fov;
      if (Math.abs(footFovDelta) > 0.05) { camera.fov += footFovDelta * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
      if (p.speed > 0) { const targetYaw = p.angle + Math.PI; let d = targetYaw - G.camYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; G.camYaw += d * Math.min(1, dt * 1.6); }
    }
  } else {
    camera.position.set(-412, 6, 492); camera.lookAt(-412, 2, 440);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
