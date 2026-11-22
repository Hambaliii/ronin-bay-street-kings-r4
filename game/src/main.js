// main.js — boot, loop, camera, wiring, shot mode
import * as THREE from 'three';
import { CFG } from './config.js';
import { srand } from './random.js';
import { buildWorld, updateWorld, groundH } from './world.js';
import { spawnTraffic, updateTraffic, updateSmoke, spawnVehicle } from './cars.js';
import { createPlayer, updatePlayer } from './player.js';
import { updateDriving, enterCar, exitCar } from './drive.js';
import { setupShot } from './shots.js';
import { initSave } from './save.js';
import { initPeds } from './peds.js';
import { initPolice } from './police.js';
import { initMissions } from './missions.js';
import { initHUD } from './hud.js';
import { initAudio } from './audio.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shot = params.get('shot');
srand(seed);

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87c5eb);
scene.fog = new THREE.Fog(0x87c5eb, 220, 900);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 3000);
camera.position.set(-412, 4, 486);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7f6a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.3); sun.position.set(200, 260, 120); scene.add(sun);

const G = {
  scene, camera, renderer, canvas, mode: shot ? 'play' : 'menu', shot, seed,
  keys: {}, timeOfDay: shot === 'chase' ? 17.8 : CFG.startHour,
  money: 500, rep: 0, rankIdx: 0, wanted: 0, speedKmh: 0,
  car: null, player: null, paused: false, shotCam: null,
  updaters: [], colliders: [],
  addCollider(x, z, hw, hd, h) { this.colliders.push({ x, z, hw, hd, h }); },
  roadX: [], roadZ: [], touge: [], missionIndex: 0, flags: {},
  districtState: { port: { control: 50, owner: 'ronin' }, coral: { control: 30, owner: 'neutral' }, neon: { control: 20, owner: 'rival' }, hoshino: { control: 10, owner: 'rival' } },
  audio: null, heli: null, cops: [], peds: [], vehicles: [], traffic: [],
  camYaw: Math.PI, camDist: 7, elapsed: 0, sun, hemi, hq: null, water: null,
  enterCar: null, exitCar: null, garage: ['hachi'], ownedCars: ['hachi'],
};
G.enterCar = (v) => enterCar(G, v);
G.exitCar = () => exitCar(G);
window.G = G;

initSave(G);
buildWorld(G);
createPlayer(G);
// starter car parked at HQ garage apron
const starter = spawnVehicle(G, 'hachi', -412.5, 452, Math.PI, { driver: 'parked' });
G.starterCar = starter;
spawnTraffic(G, 14);
initPeds(G);
initPolice(G);
initMissions(G);
initHUD(G);
initAudio(G);
if (shot) {
  setupShot(G, shot);
  const menu = document.getElementById('menu'); if (menu) menu.style.display = 'none';
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
    if (G.car) updateDriving(G, dt); else updatePlayer(G, dt);
    updateTraffic(G, dt);
  }
  updateSmoke(G, dt);
  updateWorld(G, dt);
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
      const targetFov = G.flags.nosActive ? 74 : 66;
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
    } else if (G.player) {
      const p = G.player;
      // mouse-free orbit: camYaw follows movement slowly; A/D handled in player relative to camYaw
      const tx = p.x - Math.sin(G.camYaw) * 7, tz = p.z - Math.cos(G.camYaw) * 7;
      camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 6);
      camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 6);
      camera.position.y += ((groundH(p.x, p.z) + 3) - camera.position.y) * Math.min(1, dt * 6);
      camera.lookAt(p.x, groundH(p.x, p.z) + 1.4, p.z);
      if (p.speed > 0) { const targetYaw = p.angle + Math.PI; let d = targetYaw - G.camYaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; G.camYaw += d * Math.min(1, dt * 1.6); }
    }
  } else {
    camera.position.set(-412, 6, 492); camera.lookAt(-412, 2, 440);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
