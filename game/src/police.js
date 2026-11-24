// Bay law enforcement: heat level, chase steering, spike
// roadblocks and the orbiting searchlight helicopter.
import * as THREE from 'three';
import { loadHeroAsset } from './assets.js';
import { CAST } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { spawnVehicle, spawnSmokeAt, applyNpcPoliceGlb, damageVehicle } from './cars.js';
import { makeFigure, animateFigure } from './player.js';
const HQ_MARK_W = { x: -412.5, z: 412.5 };
void HQ_MARK_W;
function wrapDeltaW(desiredW, currentW) {
  let deltaW = desiredW + (-currentW);
  while (deltaW > Math.PI) deltaW = deltaW + (-(Math.PI * 2));
  while (-Math.PI > deltaW) deltaW = deltaW + (Math.PI * 2);
  return deltaW;
}
function spanXZW(xaW, zaW, xbW, zbW) { return Math.hypot(xaW + (-xbW), zaW + (-zbW)); }
function actorXYW(G) { const entW = G.car ? G.car : G.player; const outW = {}; outW.x = entW.x; outW.z = entW.z; return outW; }
function actorDirW(G) { const entW = G.car ?? G.player; return entW.angle; }
export function districtAt(px, pz) {
  let labelW = 0 > px ? 'Harborview' : 'Neon District';
  const probeRowsW = [];
  probeRowsW.push([Math.abs(px) < 200 && Math.abs(pz) < 200, 'Downtown']);
  probeRowsW.push([pz < -450, 'Touge Highlands']);
  probeRowsW.push([px > 250, 'Portside']);
  probeRowsW.push([pz > 380, 'Coral Bay']);
  probeRowsW.forEach((pairW) => { const [, nameW] = pairW; if (pairW[0]) labelW = nameW; });
  return labelW; }
const PAINT_TABLE_W = [];
PAINT_TABLE_W.push([0xff7a1a, 'orange'], [0xe33b3b, 'red'], [0xb01030, 'red'], [0x2e6fb7, 'blue'], [0x3f6d8e, 'blue'], [0x37c8ff, 'blue'], [0xffffff, 'white'], [0xf2f2f2, 'white']);
PAINT_TABLE_W.push([0x111111, 'black'], [0x1d2735, 'black'], [0xc0c0c0, 'silver'], [0x8a8a8a, 'gray'], [0xffd23f, 'yellow'], [0x2e9e4f, 'green'], [0x7a4fd0, 'purple'], [0xff4fd8, 'pink']);
function paintRawW(vehW) { return (vehW && vehW.spec && (vehW.spec.color ?? vehW.spec.paint)) ?? (vehW && (vehW.color ?? vehW.paint)); }
function paintNameW(vehW) {
  if (!vehW || typeof vehW !== 'object') return 'painted';
  const rawW = paintRawW(vehW);
  if (typeof rawW === 'string') return rawW.replace(/^#/, '').length === 6 ? 'painted' : rawW;
  if (typeof rawW !== 'number') return 'painted';
  let wordW = 'painted'; let bestW = Infinity;
  PAINT_TABLE_W.forEach(([hexW, nameW]) => {
    const drW = ((hexW >> 16) & 255) + (-((rawW >> 16) & 255));
    const dgW = ((hexW >> 8) & 255) + (-((rawW >> 8) & 255));
    const dbW = (hexW & 255) + (-(rawW & 255));
    const sqW = (drW * drW) + ((dgW * dgW) + (dbW * dbW));
    if (bestW > sqW) { bestW = sqW; wordW = nameW; }
  });
  return wordW; }
function describeRideW(G) { if (!G.car) return 'suspect on foot'; const modelW = (G.car.spec && G.car.spec.name) || G.car.specId || 'vehicle'; return `${paintNameW(G.car)} ${modelW}`; }
function doorTexW() {
  const cvDoorW = document.createElement('canvas'); cvDoorW.width = 256; cvDoorW.height = 64;
  const cxDoorW = cvDoorW.getContext('2d'); cxDoorW.clearRect(0, 0, 256, 64);
  cxDoorW.fillStyle = '#ffffff'; cxDoorW.font = 'bold 44px Arial, sans-serif';
  cxDoorW.textAlign = 'center'; cxDoorW.textBaseline = 'middle'; cxDoorW.fillText('RBPD', 128, 34);
  const txDoorW = new THREE.CanvasTexture(cvDoorW); txDoorW.anisotropy = 4; return txDoorW; }
function flankBadgeW(cxW) {
  cxW.fillStyle = '#c9a227'; cxW.beginPath(); cxW.arc(112, 128, 54, 0, Math.PI * 2); cxW.fill();
  cxW.fillStyle = '#16222e'; cxW.beginPath(); cxW.arc(112, 128, 40, 0, Math.PI * 2); cxW.fill();
  cxW.fillStyle = '#c9a227'; cxW.font = 'bold 44px Arial, sans-serif'; cxW.textAlign = 'center'; cxW.textBaseline = 'middle'; cxW.fillText('★', 112, 130); }
function flankTexW() {
  const cvFlankW = document.createElement('canvas'); cvFlankW.width = 1024; cvFlankW.height = 256;
  const cxFlankW = cvFlankW.getContext('2d'); cxFlankW.clearRect(0, 0, 1024, 256);
  cxFlankW.fillStyle = '#16222e'; cxFlankW.fillRect(0, 64, 1024, 128);
  flankBadgeW(cxFlankW);
  cxFlankW.fillStyle = '#ffffff'; cxFlankW.font = 'bold 140px Arial, sans-serif'; cxFlankW.fillText('RBPD', 580, 118);
  cxFlankW.font = 'bold 44px Arial, sans-serif'; cxFlankW.fillText('P O L I C E', 580, 172);
  const txFlankW = new THREE.CanvasTexture(cvFlankW); txFlankW.anisotropy = 4; return txFlankW; }
function roofTexW() {
  const cvRoofW = document.createElement('canvas'); cvRoofW.width = 512; cvRoofW.height = 512;
  const cxRoofW = cvRoofW.getContext('2d'); cxRoofW.clearRect(0, 0, 512, 512);
  cxRoofW.fillStyle = '#16222e'; cxRoofW.font = 'bold 190px Arial, sans-serif';
  cxRoofW.textAlign = 'center'; cxRoofW.textBaseline = 'middle'; cxRoofW.fillText('RBPD', 256, 256);
  const txRoofW = new THREE.CanvasTexture(cvRoofW); txRoofW.anisotropy = 4; return txRoofW; }
function poolTexW() {
  const cvPoolW = document.createElement('canvas'); cvPoolW.width = 256; cvPoolW.height = 256;
  const cxPoolW = cvPoolW.getContext('2d');
  const grPoolW = cxPoolW.createRadialGradient(128, 128, 0, 128, 128, 128);
  grPoolW.addColorStop(0, 'rgba(255,246,205,1)'); grPoolW.addColorStop(0.35, 'rgba(255,240,190,0.75)');
  grPoolW.addColorStop(0.7, 'rgba(255,232,160,0.28)'); grPoolW.addColorStop(1, 'rgba(255,230,150,0)');
  cxPoolW.fillStyle = grPoolW; cxPoolW.fillRect(0, 0, 256, 256);
  const txPoolW = new THREE.CanvasTexture(cvPoolW); txPoolW.anisotropy = 4; return txPoolW; }
function sideDecalsW(grpW) {
  try { const matW = new THREE.MeshBasicMaterial({ map: flankTexW(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const signsW = [-1, 1];
    for (const sgnW of signsW) {
      const plW = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.095), matW);
      plW.position.set(sgnW * 0.192, 0.175, 0.16);
      plW.rotation.y = sgnW * Math.PI / 2; plW.renderOrder = 2; grpW.add(plW);
    }
  } catch (errW) { /* optional decals */ }
}
function roofDecalW(grpW) {
  try { const matW = new THREE.MeshBasicMaterial({ map: roofTexW(), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const plW = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), matW);
    plW.position.set(0, 0.318, 0.10); plW.rotation.x = -Math.PI / 2; plW.renderOrder = 2; grpW.add(plW);
  } catch (errW) { /* optional decals */ }
}
function dressingKitW() {
  const allW = new THREE.Group(); allW.name = 'rbpd-dressing';
  sideDecalsW(allW);
  roofDecalW(allW);
  const bladeMatW = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });
  const mainW = new THREE.Group(); mainW.position.set(0, 0.35, 0.10);
  const b1W = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.008, 0.055), bladeMatW); mainW.add(b1W);
  const b2W = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.95), bladeMatW); b2W.rotation.y = 0.6; mainW.add(b2W);
  const hubW = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.045, 10), bladeMatW); mainW.add(hubW);
  const blurMatW = new THREE.MeshBasicMaterial({ color: 0xcfd8e3, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
  const discW = new THREE.Mesh(new THREE.CircleGeometry(0.47, 40), blurMatW); discW.rotation.x = -Math.PI / 2; mainW.add(discW);
  allW.add(mainW);
  const tailW = new THREE.Group();
  tailW.position.set(0.035, 0.29, -0.475);
  let tPosW = +false;
  while (tPosW < 2) { const tbW = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.02), bladeMatW); tbW.rotation.x = tPosW * Math.PI / 2; tailW.add(tbW); tPosW++; }
  allW.add(tailW);
  const kitW = {}; kitW.group = allW; kitW.rotor = mainW; kitW.tailRotor = tailW; return kitW;
}
function swapToGlbW(heliW, wrapW, kitW) {
  try { if (!heliW || !wrapW || heliW.visualMode === 'glb') return false;
    if (kitW && kitW.group && kitW.group.parent !== wrapW) wrapW.add(kitW.group);
    while (heliW.body.children.length) heliW.body.remove(heliW.body.children[0]);
    wrapW.position.set(0, -1.18, 0);
    heliW.body.add(wrapW);
    if (kitW) { if (kitW.rotor) heliW.rotor = kitW.rotor; if (kitW.tailRotor) heliW.tailRotor = kitW.tailRotor; }
    heliW.visualMode = 'glb'; return true;
  } catch (errW) { return false; }
}
function heliMatsW() {
  const matsW = {};
  matsW.hull = new THREE.MeshStandardMaterial({ color: 0x1d2735, metalness: 0.5, roughness: 0.4 });
  matsW.stripe = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.3, roughness: 0.5 });
  matsW.glass = new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.9, roughness: 0.1 });
  matsW.dark = new THREE.MeshStandardMaterial({ color: 0x22282f, metalness: 0.7, roughness: 0.35 });
  matsW.rotor = new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.6, roughness: 0.4 });
  matsW.skid = new THREE.MeshStandardMaterial({ color: 0x30363e, metalness: 0.7, roughness: 0.35 });
  return matsW;
}
function addMeshW(grpW, geoW, matW, sxW, syW, szW, pxW, pyW, pzW) {
  const mW = new THREE.Mesh(geoW, matW);
  if (sxW !== null) mW.scale.set(sxW, syW, szW);
  if (pxW !== null) mW.position.set(pxW, pyW, pzW);
  grpW.add(mW); return mW;
}
function heliShellW(bodyW, matsW) {
  addMeshW(bodyW, new THREE.SphereGeometry(1, 28, 22), matsW.hull, 1.0, 0.92, 1.9, null, null, null);
  const stripeW = addMeshW(bodyW, new THREE.CylinderGeometry(1.02, 1.02, 0.34, 28, 1, true), matsW.stripe, null, null, null, null, null, null);
  stripeW.rotation.x = Math.PI / 2; stripeW.scale.set(1.0, 1.0, 0.92); stripeW.position.z = -0.15;
  const canopyW = addMeshW(bodyW, new THREE.SphereGeometry(0.94, 24, 16, -Math.PI / 3.2, Math.PI / 1.6, 0.35, 1.05), matsW.glass, 1.0, 0.92, 1.9, 0, 0.12, 0.14);
  void canopyW;
  addMeshW(bodyW, new THREE.SphereGeometry(0.8, 20, 14), matsW.hull, 0.9, 0.45, 1.5, null, null, null).position.y = -0.55;
  const boomLenW = 3.4;
  const boomW = addMeshW(bodyW, new THREE.CylinderGeometry(0.07, 0.16, boomLenW, 14), matsW.hull, null, null, null, 0, 0.22, -1.75 - boomLenW / 2 + 0.35);
  boomW.rotation.x = Math.PI / 2 - 0.10;
  addMeshW(bodyW, new THREE.SphereGeometry(0.55, 18, 14), matsW.hull, 0.16, 1.15, 0.62, 0, 0.62, -1.75 - boomLenW + 0.35);
  addMeshW(bodyW, new THREE.SphereGeometry(0.5, 16, 10), matsW.hull, 1.5, 0.10, 0.42, 0, 0.30, -1.75 - boomLenW + 0.55);
  addMeshW(bodyW, new THREE.SphereGeometry(0.5, 18, 12), matsW.dark, 0.85, 0.5, 1.15, 0, 0.82, -0.25);
  addMeshW(bodyW, new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), matsW.dark, null, null, null, 0, 1.05, -0.25);
  return boomLenW;
}
function heliRotorSetW(bodyW, matsW, boomLenW) {
  const rotorW = new THREE.Group(); rotorW.position.set(0, 1.32, -0.25);
  rotorW.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), matsW.dark));
  let rPosW = +false;
  while (rPosW < 2) {
    const bladeW = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.28), matsW.rotor); bladeW.rotation.y = rPosW * Math.PI / 2;
    const tipW = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.20), matsW.rotor); tipW.position.set(2.75, 0, 0);
    const tipGrpW = new THREE.Group(); tipGrpW.rotation.y = rPosW * Math.PI / 2; tipGrpW.add(tipW);
    const tipFarW = tipW.clone(); tipFarW.position.x = -2.75; tipGrpW.add(tipFarW);
    rotorW.add(bladeW); rotorW.add(tipGrpW); rPosW++;
  }
  bodyW.add(rotorW);
  const tailRotorW = new THREE.Group(); tailRotorW.position.set(0.14, 0.62, -1.75 - boomLenW + 0.35);
  let tPosW = +false;
  while (tPosW < 2) { const tbW = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.12), matsW.rotor); tbW.rotation.x = tPosW * Math.PI / 2; tailRotorW.add(tbW); tPosW++; }
  tailRotorW.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matsW.dark)); bodyW.add(tailRotorW);
  const outW = {}; outW.rotor = rotorW; outW.tailRotor = tailRotorW; return outW;
}
function skidSideW(bodyW, matsW, sgnW) {
  const offXW = sgnW * 0.78;
  const ptsW = [new THREE.Vector3(offXW, -1.05, 1.35), new THREE.Vector3(offXW, -1.18, 0.4), new THREE.Vector3(offXW, -1.18, -0.9), new THREE.Vector3(offXW, -1.02, -1.55)];
  const curveW = new THREE.CatmullRomCurve3(ptsW);
  bodyW.add(new THREE.Mesh(new THREE.TubeGeometry(curveW, 20, 0.055, 8), matsW.skid));
  const strutZW = [0.75, -0.75];
  for (const offZW of strutZW) { const strutW = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), matsW.skid); strutW.position.set(offXW * 0.82, -0.82, offZW); strutW.rotation.z = sgnW * 0.35; bodyW.add(strutW); } }
function heliSkidsDecalsW(bodyW, matsW) {
  const signsW = [-1, 1];
  for (const sgnW of signsW) skidSideW(bodyW, matsW, sgnW);
  try { const doorMatW = new THREE.MeshBasicMaterial({ map: doorTexW(), transparent: true, side: THREE.DoubleSide });
    const doorSignsW = [-1, 1];
    for (const sgnW of doorSignsW) { const plW = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), doorMatW); plW.position.set(sgnW * 1.01, 0.05, 0.25); plW.rotation.y = sgnW * Math.PI / 2; bodyW.add(plW); }
  } catch (errW) { /* optional decals */ }
}
function heliLightsW(G, rootW) {
  const beamMatW = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamW = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 20, 1, true), beamMatW); beamW.position.set(0, -15.5, 0.6); rootW.add(beamW);
  let glowW = null;
  try { glowW = glowSprite(0xfff2a8, 3.2); glowW.position.set(0, -0.8, 0.6); rootW.add(glowW); } catch (errW) { /* optional glow */ }
  const spotW = new THREE.SpotLight(0xfff2c0, 2.4, 90, 0.42, 0.45, 1.2); G.scene.add(spotW); G.scene.add(spotW.target);
  let poolW = null;
  try {
    const poolMatW = new THREE.MeshBasicMaterial({ map: poolTexW(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    poolW = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), poolMatW); poolW.rotation.x = -Math.PI / 2; poolW.renderOrder = 5; G.scene.add(poolW);
  } catch (errW) { /* pool optional */ }
  const outW = {}; outW.beam = beamW; outW.glow = glowW; outW.spot = spotW; outW.pool = poolW; return outW;
}
function buildHeliW(G) {
  const rootW = new THREE.Group(); const bodyW = new THREE.Group(); rootW.add(bodyW);
  const matsW = heliMatsW();
  const boomLenW = heliShellW(bodyW, matsW);
  const rotorsW = heliRotorSetW(bodyW, matsW, boomLenW);
  heliSkidsDecalsW(bodyW, matsW);
  const lightsW = heliLightsW(G, rootW);
  rootW.traverse((nodeW) => { if (nodeW.isMesh) { nodeW.castShadow = false; nodeW.receiveShadow = false; } });
  G.scene.add(rootW);
  const outW = { group: rootW, body: bodyW, rotor: rotorsW.rotor, tailRotor: rotorsW.tailRotor, cone: lightsW.beam, spotlight: lightsW.spot, lensGlow: lightsW.glow, pool: lightsW.pool, trackX: null, trackZ: null, orbitA: rr(0, Math.PI * 2), leaveT: 0, visualMode: 'procedural' };
  return outW;
}
function blinkBarW(vehW, nowW) {
  const barW = vehW.mesh?.userData?.lightbar; if (!barW) return;
  const onW = Math.floor(nowW * 6) % 2 === 0;
  const hiW = 3.2; const loW = 0.15;
  try {
    if (barW.red) barW.red.emissiveIntensity = onW ? hiW : loW;
    if (barW.blue) barW.blue.emissiveIntensity = onW ? loW : hiW;
    if (barW.gr) barW.gr.visible = onW;
    if (barW.gb) barW.gb.visible = !onW;
  } catch (errW) { /* unknown material shape */ }
}
export function initPolice(G) {
  G.cops = G.cops || []; G.heli = null;
  let kitW = null;
  try { kitW = dressingKitW(); } catch (errW) { kitW = null; }
  try { if (G.flags) G.flags.heliDressing = kitW; } catch (errW) { /* flags optional */ }
  try {
    loadHeroAsset('helicopter').then((wrapW) => { try { if (!wrapW) return; if (G.flags) G.flags.heliAsset = wrapW; if (G.heli) swapToGlbW(G.heli, wrapW, kitW); } catch (errW) { /* keep procedural */ } }).catch(() => {});
  } catch (errW) { /* keep procedural */ }
  const S = { t: 0, speedHeatCd: 0, driftHeatCd: 0, decayAcc: 0, spawnCd: 0, blockCd: 8, blocks: [] };
  Object.assign(S, { spikeT: 0, prevWantedInt: 0, chatterIdx: 0, ramCd: 0, prevPX: 0, prevPZ: 0, pvx: 0, pvz: 0, smokeCd: 0, lastCrashSeen: 0 });
  function quotaW() { if (!(G.wanted > 0.05)) return 0; const tableW = [0, 1, 2, 3, 4, 6]; return tableW[Math.min(5, Math.ceil(G.wanted))]; }
  function nearestLineW(valW, linesW) { let bestW = linesW[0]; for (const lineW of linesW) { if (Math.abs(bestW + (-valW)) > Math.abs(lineW + (-valW))) bestW = lineW; } return bestW; }
  function spawnPursuerW() {
    const posW = actorXYW(G);
    const angW = rr(0, Math.PI * 2); const distW = rr(120, 180);
    let sxW = posW.x + (Math.sin(angW) * distW); let szW = posW.z + (Math.cos(angW) * distW);
    if (chance(0.5)) sxW = nearestLineW(sxW, G.roadX); else szW = nearestLineW(szW, G.roadZ);
    sxW = THREE.MathUtils.clamp(sxW, -640, 640); szW = THREE.MathUtils.clamp(szW, -640, 640);
    const specW = G.wanted >= 3 && G.cops.length % 2 === 1 ? 'police-suv' : 'police';
    const copW = spawnVehicle(G, specW, sxW, szW, rr(0, Math.PI * 2), { driver: 'cop', livery: 'police', lights: true });
    if (copW) applyNpcPoliceGlb(copW);
    if (copW) G.cops.push(copW);
    return copW;
  }
  function removeUnitW(vehW) {
    const copIdxW = G.cops.indexOf(vehW); if (!(copIdxW < 0)) G.cops.splice(copIdxW, 1);
    const vehIdxW = G.vehicles ? G.vehicles.indexOf(vehW) : -1; if (!(vehIdxW < 0)) G.vehicles.splice(vehIdxW, 1);
    const trafIdxW = G.traffic ? G.traffic.indexOf(vehW) : -1; if (!(trafIdxW < 0)) G.traffic.splice(trafIdxW, 1);
    if (vehW.mesh) G.scene.remove(vehW.mesh);
  }
  function blockCarsW(bxW, bzW, perpAngW) {
    const parkedW = [];
    const offsW = [-8, 8];
    for (const offW of offsW) {
      const cxW = bxW + (Math.sin(perpAngW) * offW); const czW = bzW + (Math.cos(perpAngW) * offW);
      const copW = spawnVehicle(G, 'police', cxW, czW, perpAngW + rr(-0.25, 0.25), { driver: 'parked', livery: 'police', lights: true });
      if (copW) applyNpcPoliceGlb(copW);
      if (copW) { parkedW.push(copW); G.cops.push(copW); }
    }
    return parkedW; }
  function blockStripW(bxW, bzW, perpAngW) {
    const stripGrpW = new THREE.Group();
    const stripMeshW = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 1.1), new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.9, metalness: 0.2 }));
    stripGrpW.add(stripMeshW);
    const spikeMatW = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, metalness: 0.9, roughness: 0.25 });
    let spPosW = 0;
    while (spPosW < 12) { const spW = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), spikeMatW); spW.position.set(-5.5 + spPosW, 0.13, 0); stripGrpW.add(spW); spPosW++; }
    stripGrpW.position.set(bxW, groundH(bxW, bzW) + 0.05, bzW); stripGrpW.rotation.y = perpAngW; G.scene.add(stripGrpW);
    return stripGrpW; }
  function blockOfficersW(bxW, bzW, perpAngW) {
    const officersW = [];
    if (!CAST.cop) return officersW;
    const offsW = [-11, 11];
    for (const offW of offsW) {
      try {
        const figW = makeFigure(CAST.cop);
        const oxW = bxW + (Math.sin(perpAngW) * offW); const ozW = bzW + (Math.cos(perpAngW) * offW) + 2;
        figW.position.set(oxW, groundH(oxW, ozW), ozW); figW.rotation.y = perpAngW + Math.PI;
        G.scene.add(figW); officersW.push({ fig: figW, phase: rr(0, 6) });
      } catch (errW) { /* figures optional */ }
    }
    return officersW; }
  function setupBlockW() {
    const posW = actorXYW(G); const headW = actorDirW(G); const aheadW = 105;
    let bxW = posW.x + (Math.sin(headW) * aheadW); let bzW = posW.z + (Math.cos(headW) * aheadW);
    const verticalW = Math.abs(Math.sin(headW)) < Math.abs(Math.cos(headW));
    if (verticalW) bxW = nearestLineW(bxW, G.roadX); else bzW = nearestLineW(bzW, G.roadZ);
    bxW = THREE.MathUtils.clamp(bxW, -620, 620); bzW = THREE.MathUtils.clamp(bzW, -620, 620);
    const roadAngW = verticalW ? 0 : Math.PI / 2; const perpAngW = Math.PI / 2 + roadAngW;
    const parkedW = blockCarsW(bxW, bzW, perpAngW);
    const stripGrpW = blockStripW(bxW, bzW, perpAngW);
    const blockGrpW = new THREE.Group(); blockGrpW.add(stripGrpW);
    void blockGrpW;
    const officersW = blockOfficersW(bxW, bzW, perpAngW);
    S.blocks.push({ x: bxW, z: bzW, angle: perpAngW, cars: parkedW, officers: officersW, strip: stripGrpW, spiked: false });
  }
  function teardownBlockW(blkW) {
    const idxW = S.blocks.indexOf(blkW); if (!(idxW < 0)) S.blocks.splice(idxW, 1);
    const carsCopyW = [...blkW.cars];
    for (const copW of carsCopyW) removeUnitW(copW);
    blkW.officers.forEach((offW) => G.scene.remove(offW.fig));
    if (blkW.strip) G.scene.remove(blkW.strip);
  }
  function ensureHeliW(stagedW) {
    if (G.heli) { return; }
    const heliW = buildHeliW(G);
    if (G.flags && G.flags.heliAsset) swapToGlbW(heliW, G.flags.heliAsset, kitW);
    if ((stagedW || G.flags.heliStage) && G.flags.heliStage) heliW.group.position.set(G.flags.heliStage.x, groundH(G.flags.heliStage.x, G.flags.heliStage.z) + 28, G.flags.heliStage.z);
    else { const posW = actorXYW(G); heliW.group.position.set(posW.x + 20, groundH(posW.x, posW.z) + 28, posW.z); }
    G.heli = heliW;
  }
  function dismissHeliW() {
    if (!G.heli) { return; }
    G.scene.remove(G.heli.group); if (G.heli.pool) G.scene.remove(G.heli.pool);
    if (G.heli.spotlight) { G.scene.remove(G.heli.spotlight); G.scene.remove(G.heli.spotlight.target); }
    G.heli = null; }
  if (G.shot === 'chase' || G.shot === 'heli') ensureHeliW(G.shot === 'heli');
  function trackVelW(posW, dtW) {
    if (dtW > 0) {
      S.pvx = (posW.x + (-S.prevPX)) / dtW; S.pvz = (posW.z + (-S.prevPZ)) / dtW;
      const lenW = Math.hypot(S.pvx, S.pvz);
      if (lenW > 60) { S.pvx = S.pvx * (60 / lenW); S.pvz = S.pvz * (60 / lenW); }
    }
    S.prevPX = posW.x; S.prevPZ = posW.z;
  }
  function dispatchFootW(roseW, zoneW, slotW) {
    let lineW;
    if (roseW) lineW = [`Dispatch: suspect on foot, ${zoneW} — units respond.`, `Dispatch: all units, suspect on foot in ${zoneW}. Move in.`, `Dispatch: be advised, suspect fled on foot in ${zoneW}.`][slotW % 3];
    else lineW = [`All units: suspect lost visual, ${zoneW}. Stand down.`, `Dispatch: foot pursuit cooling off in ${zoneW} — hold positions.`, `All units: be advised, the suspect on foot slipped away near ${zoneW}.`][slotW % 3];
    try { G.dispatch?.(lineW); } catch (errW) {} }
  function dispatchForW(wholeW, roseW, posW) {
    const zoneW = districtAt(posW.x, posW.z); const descW = describeRideW(G); const slotW = S.chatterIdx++;
    if (!(G.car)) { dispatchFootW(roseW, zoneW, slotW); return; }
    let lineW;
    if (roseW && wholeW >= 4) lineW = [`Dispatch: roadblock authorized, ${zoneW}.`, `Dispatch: air support and roadblocks authorized — suspect in a ${descW}, ${zoneW}.`, `Dispatch: all units converge — suspect in ${descW}, ${zoneW}.`][slotW % 3];
    else if (roseW) lineW = [`Dispatch: suspect in a ${descW}, ${zoneW} — units respond.`, `Dispatch: all units, ${descW} spotted in ${zoneW}. Move to intercept.`, `Dispatch: be advised, a ${descW} is raising hell in ${zoneW}.`][slotW % 3];
    else lineW = [`All units: suspect lost visual, ${zoneW}. Stand down.`, `Dispatch: pursuit cooling off in ${zoneW} — hold positions.`, `All units: be advised, ${descW} slipped away near ${zoneW}.`][slotW % 3];
    if (lineW) { try { G.dispatch?.(lineW); } catch (errW) {} }
  }
  function heatTickW(dtW, posW, seatedW, kmhW) {
    S.speedHeatCd = Math.max(0, S.speedHeatCd - dtW);
    S.driftHeatCd = Math.max(0, S.driftHeatCd - dtW);
    let nearW = false;
    for (const copW of G.cops) { if (60 > spanXZW(copW.x, copW.z, posW.x, posW.z)) nearW = true; }
    if (seatedW && kmhW > 110 && !(S.speedHeatCd > 0)) {
      for (const copW of G.cops) { if (40 > spanXZW(copW.x, copW.z, posW.x, posW.z) && !(S.speedHeatCd > 0)) { G.wanted = G.wanted + 0.5; S.speedHeatCd = 2.5; } }
    }
    if (G.flags.crashTimer && G.flags.crashTimer !== S.lastCrashSeen) {
      S.lastCrashSeen = G.flags.crashTimer, G.flags.crashTimer = 0; G.wanted += 0.4;
    }
    if (seatedW && G.flags.drifting && !(S.driftHeatCd > 0)) {
      G.cops.forEach((copW) => { if (45 > spanXZW(copW.x, copW.z, posW.x, posW.z) && !(S.driftHeatCd > 0)) { G.wanted = G.wanted + 0.2; S.driftHeatCd = 3; } });
    }
    if (!nearW && !G.flags.noDecay) { S.decayAcc = S.decayAcc + dtW; while (S.decayAcc >= 10) { S.decayAcc = S.decayAcc + (-10); G.wanted = G.wanted + (-0.1); } } else { S.decayAcc = 0; }
    const clampedW = THREE.MathUtils.clamp(G.wanted || 0, 0, 5); G.wanted = clampedW;
    const wholeW = Math.round(G.wanted || 0);
    if (wholeW !== S.prevWantedInt) { const roseW = wholeW > S.prevWantedInt; S.prevWantedInt = wholeW; dispatchForW(wholeW, roseW, posW); } }
  function spikeTickW(dtW) {
    if (S.spikeT > 0) { S.spikeT -= dtW; G.flags.gripFactor = 0.5;
      if (G.car && G.car.speed > 40 / 3.6) G.car.speed = Math.min(G.car.speed, 40 / 3.6);
      if (chance(0.3) && G.car)
        try { spawnSmokeAt(G, new THREE.Vector3(G.car.x, groundH(G.car.x, G.car.z) + 0.4, G.car.z), 1, false); } catch (errW) {}
      if (0 >= S.spikeT) G.flags.gripFactor = 1;
    } }
  function inBlockW(copW) { return S.blocks.some((blkW) => blkW.cars.includes(copW)); }
  function copAimW(copW, posW, gapW, seatedW) {
    let aimXW = posW.x + (S.pvx * Math.min(1.2, gapW / 30)); let aimZW = posW.z + (S.pvz * Math.min(1.2, gapW / 30));
    if (12 > gapW && seatedW) { const headW = actorDirW(G); aimXW = posW.x + (-(Math.sin(headW) * 2.5)) + (Math.cos(headW) * 1.2); aimZW = posW.z + (-(Math.cos(headW) * 2.5)) + (-(Math.sin(headW) * 1.2)); }
    const outW = {}; outW.x = aimXW; outW.z = aimZW; return outW; }
  function copBiasW(copW) {
    let biasW = 0;
    if (G.colliders) {
      const probeXW = copW.x + (Math.sin(copW.angle) * 9); const probeZW = copW.z + (Math.cos(copW.angle) * 9);
      for (const colW of G.colliders) {
        if (biasW !== 0) break;
        if (colW.x === undefined) continue;
        const radW = colW.r || 7;
        if (radW + 2 > spanXZW(probeXW, probeZW, colW.x, colW.z)) { const mulW = Math.sign(Math.sin(copW.angle) * (colW.z + (-copW.z)) - Math.cos(copW.angle) * (colW.x + (-copW.x))) || 1; biasW = -mulW * 0.8; }
      }
    }
    return biasW; }
  function copSpeedW(copW, gapHeadW, wreckedW, seatedW, gapW, paceRefW) {
    let topW = (copW.spec?.topSpeed || 190) / 3.6;
    if (!(G.wanted > 2)) topW = Math.min(topW, paceRefW * 0.93);
    else if (G.wanted >= 4) topW = Math.max(topW, paceRefW);
    let goalW = topW;
    if (Math.abs(gapHeadW) > 1.1) goalW = topW * 0.45;
    else if (Math.abs(gapHeadW) > 0.5) goalW = topW * 0.75;
    if (wreckedW) goalW = topW * 0.4;
    if (!seatedW && 6 > gapW) goalW = 0;
    const outW = {}; outW.top = topW; outW.goal = goalW; return outW; }
  function copTickW(copW, dtW, posW, seatedW, paceRefW) {
    const gapW = spanXZW(copW.x, copW.z, posW.x, posW.z); const wreckedW = 30 > (copW.health ?? 100);
    const aimW = copAimW(copW, posW, gapW, seatedW);
    const biasW = copBiasW(copW);
    const wantW = Math.atan2(aimW.x + (-copW.x), aimW.z + (-copW.z)) + biasW;
    const gapHeadW = wrapDeltaW(wantW, copW.angle); const maxTurnW = 2.1 * dtW;
    copW.angle = copW.angle + THREE.MathUtils.clamp(gapHeadW, -maxTurnW, maxTurnW);
    const paceW = copSpeedW(copW, gapHeadW, wreckedW, seatedW, gapW, paceRefW);
    const accelW = paceW.goal > copW.speed ? 9 : 16;
    copW.speed = THREE.MathUtils.clamp(copW.speed + (Math.sign(paceW.goal + (-copW.speed)) * accelW * dtW), 0, paceW.top);
    copW.x = copW.x + (Math.sin(copW.angle) * copW.speed * dtW); copW.z = copW.z + (Math.cos(copW.angle) * copW.speed * dtW);
    copW.x = THREE.MathUtils.clamp(copW.x, -655, 655); copW.z = THREE.MathUtils.clamp(copW.z, -655, 655);
    copW.mesh.position.set(copW.x, groundH(copW.x, copW.z), copW.z); copW.mesh.rotation.y = copW.angle;
    if (seatedW && G.car && 3 > gapW && (copW.speed || 0) > 8 && !(S.ramCd > 0)) { damageVehicle(G, G.car, (copW.speed || 0) * 0.35); S.ramCd = 0.6; G.flags.crashTimer = 1; }
    if (copW.steerVis !== undefined) copW.steerVis = THREE.MathUtils.clamp(gapHeadW, -0.5, 0.5);
    const udW = copW.mesh.userData;
    if (udW?.wheels) { const wDeltaW = (copW.speed * dtW) / (udW.wheelR || 0.34); Object.values(udW.wheels).forEach((wheelW) => { if (wheelW) wheelW.rotation.x = wheelW.rotation.x + wDeltaW; }); }
    if (wreckedW) {
      S.smokeCd -= dtW;
      if (!(S.smokeCd > 0)) { S.smokeCd = 0.12; try { spawnSmokeAt(G, new THREE.Vector3(copW.x, groundH(copW.x, copW.z) + 0.9, copW.z), 1, false); } catch (errW) {} }
      if (!((copW.health ?? 100) > 0)) removeUnitW(copW);
    } }
  function blocksTickW(dtW, posW, seatedW, kmhW) {
    S.blockCd = Math.max(0, S.blockCd - dtW);
    if (G.wanted >= 3 && !(S.blockCd > 0) && S.blocks.length < (G.wanted >= 5 ? 2 : 1) && seatedW) { setupBlockW(); S.blockCd = 25; }
    const blocksCopyW = [...S.blocks];
    for (const blkW of blocksCopyW) {
      blkW.cars.forEach((copW) => blinkBarW(copW, S.t));
      blkW.officers.forEach((offW) => { try { animateFigure(offW.fig, offW.phase + (S.t * 0.6), 0.15); } catch (errW) {} });
      const blkGapW = spanXZW(blkW.x, blkW.z, posW.x, posW.z);
      if (!blkW.spiked && seatedW && G.car) {
        const alongW = Math.abs(Math.sin(blkW.angle) * (posW.z + (-blkW.z)) - Math.cos(blkW.angle) * (posW.x + (-blkW.x)));
        const perpW = Math.abs(Math.cos(blkW.angle) * (posW.z + (-blkW.z)) + Math.sin(blkW.angle) * (posW.x + (-blkW.x)));
        if (8 > blkGapW && 2.2 > perpW && 7 > alongW && kmhW > 8) {
          blkW.spiked = true; S.spikeT = 6; G.toast?.('Spike strip! Tires shredded');
          try { spawnSmokeAt(G, new THREE.Vector3(posW.x, groundH(posW.x, posW.z) + 0.3, posW.z), 6, false); } catch (errW) {}
        }
      }
      if (blkGapW > 250) teardownBlockW(blkW);
    } }
  function heliTickW(dtW, posW, seatedW) {
    const shotHeliW = G.shot === 'chase' || G.shot === 'heli';
    if (G.wanted >= 4 || shotHeliW) ensureHeliW(false);
    if (!G.heli) return;
    const heliW = G.heli;
    if (!shotHeliW && 3 > G.wanted) { heliW.leaveT = heliW.leaveT + dtW; if (heliW.leaveT > 10) dismissHeliW(); }
    else heliW.leaveT = 0;
    if (!G.heli) return;
    heliW.orbitA = heliW.orbitA + (dtW * 0.35);
    const stageW = G.flags.heliStage ? G.flags.heliStage : posW;
    const tuneW = G.heliShot || null;
    const radW = tuneW && typeof tuneW.radius === 'number' ? tuneW.radius : (G.shot === 'heli' ? 6 : 20);
    const altW = tuneW && typeof tuneW.altitude === 'number' ? tuneW.altitude : 29;
    const orbXW = stageW.x + (Math.sin(heliW.orbitA) * radW); const orbZW = stageW.z + (Math.cos(heliW.orbitA) * radW);
    const orbYW = groundH(orbXW, orbZW) + altW + (Math.sin(S.t * 0.9) * 1.6);
    const hardW = (G.wanted >= 3 && seatedW) || shotHeliW;
    let spotXW = posW.x; let spotZW = posW.z;
    if (shotHeliW && G.flags.heliStage) { spotXW = G.flags.heliStage.x; spotZW = G.flags.heliStage.z; }
    if (G.flags.flashCar && shotHeliW) { spotXW = G.flags.flashCar.x; spotZW = G.flags.flashCar.z; }
    else if (hardW && G.car) { spotXW = G.car.x; spotZW = G.car.z; }
    let poolXW = spotXW; let poolZW = spotZW;
    if (hardW) {
      if (heliW.trackX === null || heliW.trackX === undefined) { heliW.trackX = spotXW; heliW.trackZ = spotZW; }
      const blendW = 1 - Math.exp(-2.2 * Math.max(0, dtW));
      heliW.trackX = heliW.trackX + ((spotXW + (-heliW.trackX)) * blendW); heliW.trackZ = heliW.trackZ + ((spotZW + (-heliW.trackZ)) * blendW);
      poolXW = heliW.trackX + (Math.sin(S.t * 0.6) * 2.2); poolZW = heliW.trackZ + (Math.cos(S.t * 0.45) * 2.2);
    } else { heliW.trackX = spotXW; heliW.trackZ = spotZW; }
    const poolYW = groundH(poolXW, poolZW);
    heliW.group.position.set(orbXW, orbYW, orbZW); heliW.group.lookAt(poolXW, poolYW + 1, poolZW);
    heliW.body.rotation.z = 0.38;
    heliW.body.rotation.x = 0.06;
    heliW.rotor.rotation.y = heliW.rotor.rotation.y + (dtW * 28); heliW.tailRotor.rotation.x = heliW.tailRotor.rotation.x + (dtW * 40);
    heliW.spotlight.position.copy(heliW.group.position); heliW.spotlight.target.position.set(poolXW, poolYW, poolZW); heliW.spotlight.target.updateMatrixWorld();
    const beamLenW = Math.max(10, orbYW + (-poolYW));
    heliW.cone.scale.set(1, beamLenW / 30, 1); heliW.cone.position.set(0, -beamLenW / 2, 0.6);
    if (heliW.pool) { heliW.pool.position.set(poolXW, poolYW + 0.06, poolZW); heliW.pool.material.opacity = hardW ? 0.55 : 0.25; heliW.pool.visible = true; } }
  function bustTickW(dtW, posW, seatedW) {
    if (!(G.flags.busted || G.flags.wasted)) {
      const speedActorW = seatedW ? Math.abs(G.car.speed || 0) : Math.abs(G.player?.speed || 0);
      let nearCountW = 0;
      G.cops.forEach((copW) => { if (13 > spanXZW(copW.x, copW.z, posW.x, posW.z)) nearCountW++; });
      if (2 > (G.wanted || 0)) G.bustMeter = 0;
      else if (!G.shot && !G.shotMode && 1.2 > speedActorW && nearCountW >= 2) G.bustMeter = Math.min(1, (G.bustMeter || 0) + (dtW * 0.28));
      else G.bustMeter = Math.max(0, (G.bustMeter || 0) - (dtW * 0.5));
      if (!G.shot && !G.shotMode && (G.bustMeter || 0) >= 1) {
        G.bustMeter = 0; G.audio?.play?.('busted');
        try { G.hud?.showBusted?.(); } catch (errW) {}
      }
    } else { G.bustMeter = 0; } }
  G.updaters.push((frameW, dt) => {
    if (frameW !== G) { /* same object */ }
    if (G.frozen) { return; }
    S.t += dt; const posW = actorXYW(G);
    trackVelW(posW, dt);
    const seatedW = !!G.car && !!G.flags.inCar; const kmhW = G.speedKmh || 0;
    heatTickW(dt, posW, seatedW, kmhW);
    S.ramCd = Math.max(0, S.ramCd - dt);
    spikeTickW(dt);
    S.spawnCd = Math.max(0, S.spawnCd - dt);
    const neededW = quotaW();
    const copsCopyW = [...G.cops];
    for (const copW of copsCopyW) {
      if (copW.staged === true) continue;
      if (inBlockW(copW)) continue;
      if (spanXZW(copW.x, copW.z, posW.x, posW.z) > 400) removeUnitW(copW);
    }
    const liveW = G.cops.filter((copW) => copW.staged !== true && !inBlockW(copW));
    if (liveW.length < neededW && !(S.spawnCd > 0)) { spawnPursuerW(); S.spawnCd = 1.2; }
    if (!(G.wanted > 0.05) && liveW.length) liveW.forEach((copW) => { if (spanXZW(copW.x, copW.z, posW.x, posW.z) > 120) removeUnitW(copW); });
    const paceRefW = (G.car?.spec?.topSpeed || 180) / 3.6;
    G.cops.forEach((copW) => {
      blinkBarW(copW, S.t);
      if (copW.staged === true) return;
      if (inBlockW(copW)) return;
      copTickW(copW, dt, posW, seatedW, paceRefW);
    });
    blocksTickW(dt, posW, seatedW, kmhW);
    heliTickW(dt, posW, seatedW);
    bustTickW(dt, posW, seatedW);
  });
}
