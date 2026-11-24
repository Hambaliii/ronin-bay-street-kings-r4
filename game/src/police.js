// Law around the bay: heat, pursuit steering, spike strips,
// roadblocks and the searchlight helicopter overhead.
import * as THREE from 'three';
import { loadHeroAsset } from './assets.js';
import { CAST } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { spawnVehicle, spawnSmokeAt, applyNpcPoliceGlb, damageVehicle } from './cars.js';
import { makeFigure, animateFigure } from './player.js';
const HQ_MARK_R = { x: -412.5, z: 412.5 };
void HQ_MARK_R;
function angleGapR(wantR, haveR) {
  let gapR = wantR + (-haveR);
  while (gapR > Math.PI) gapR = gapR + (-(Math.PI * 2));
  while (-Math.PI > gapR) gapR = gapR + (Math.PI * 2);
  return gapR; }
function distXZR(xaR, zaR, xbR, zbR) {
  const dxR = xaR + (-xbR); const dzR = zaR + (-zbR);
  return Math.hypot(dxR, dzR); }
function heroPointR(G) {
  const entR = G.car ? G.car : G.player; const ptR = {};
  ptR.x = entR.x; ptR.z = entR.z; return ptR; }
function heroAngleR(G) { const entR = G.car ?? G.player; return entR.angle; }
export function districtAt(pxR, pzR) {
  let labelR = 0 > pxR ? 'Harborview' : 'Neon District';
  const probeRowsR = [];
  probeRowsR.push([Math.abs(pxR) < 200 && Math.abs(pzR) < 200, 'Downtown']);
  probeRowsR.push([pzR < -450, 'Touge Highlands']);
  probeRowsR.push([pxR > 250, 'Portside']);
  probeRowsR.push([pzR > 380, 'Coral Bay']);
  for (const pairR of probeRowsR) { const [condR, nameR] = pairR; if (condR) labelR = nameR; }
  return labelR; }
const PAINT_TABLE_R = [];
PAINT_TABLE_R.push([0xff7a1a, 'orange'], [0xe33b3b, 'red']);
PAINT_TABLE_R.push([0xb01030, 'red'], [0x2e6fb7, 'blue']);
PAINT_TABLE_R.push([0x3f6d8e, 'blue'], [0x37c8ff, 'blue']);
PAINT_TABLE_R.push([0xffffff, 'white'], [0xf2f2f2, 'white']);
PAINT_TABLE_R.push([0x111111, 'black'], [0x1d2735, 'black']);
PAINT_TABLE_R.push([0xc0c0c0, 'silver'], [0x8a8a8a, 'gray']);
PAINT_TABLE_R.push([0xffd23f, 'yellow'], [0x2e9e4f, 'green']);
PAINT_TABLE_R.push([0x7a4fd0, 'purple'], [0xff4fd8, 'pink']);
function rawPaintR(vehR) {
  const viaSpecR = vehR && vehR.spec && (vehR.spec.color ?? vehR.spec.paint);
  const viaSelfR = vehR && (vehR.color ?? vehR.paint);
  return viaSpecR ?? viaSelfR; }
function paintWordR(vehR) {
  if (!vehR || typeof vehR !== 'object') return 'painted';
  const rawR = rawPaintR(vehR);
  if (typeof rawR === 'string') return rawR.replace(/^#/, '').length === 6 ? 'painted' : rawR;
  if (typeof rawR !== 'number') return 'painted';
  let wordR = 'painted'; let bestR = Infinity;
  for (const [hexR, nameR] of PAINT_TABLE_R) {
    const drR = ((hexR >> 16) & 255) + (-((rawR >> 16) & 255));
    const dgR = ((hexR >> 8) & 255) + (-((rawR >> 8) & 255));
    const dbR = (hexR & 255) + (-(rawR & 255));
    const sqR = (drR * drR) + ((dgR * dgR) + (dbR * dbR));
    if (bestR > sqR) { bestR = sqR; wordR = nameR; } }
  return wordR; }
function rideDescR(G) {
  if (!G.car) return 'suspect on foot';
  const modelR = (G.car.spec && G.car.spec.name) || G.car.specId || 'vehicle';
  return `${paintWordR(G.car)} ${modelR}`; }
function doorTexR() {
  const cvR = document.createElement('canvas'); cvR.width = 256; cvR.height = 64;
  const cxR = cvR.getContext('2d'); cxR.clearRect(0, 0, 256, 64);
  cxR.fillStyle = '#ffffff'; cxR.font = 'bold 44px Arial, sans-serif';
  cxR.textAlign = 'center'; cxR.textBaseline = 'middle'; cxR.fillText('RBPD', 128, 34);
  const txR = new THREE.CanvasTexture(cvR); txR.anisotropy = 4; return txR; }
function badgeOnFlankR(cxR) {
  cxR.fillStyle = '#c9a227'; cxR.beginPath(); cxR.arc(112, 128, 54, 0, Math.PI * 2); cxR.fill();
  cxR.fillStyle = '#16222e'; cxR.beginPath(); cxR.arc(112, 128, 40, 0, Math.PI * 2); cxR.fill();
  cxR.fillStyle = '#c9a227'; cxR.font = 'bold 44px Arial, sans-serif'; cxR.textAlign = 'center'; cxR.textBaseline = 'middle'; cxR.fillText('★', 112, 130); }
function flankTexR() {
  const cvR = document.createElement('canvas'); cvR.width = 1024; cvR.height = 256;
  const cxR = cvR.getContext('2d'); cxR.clearRect(0, 0, 1024, 256);
  cxR.fillStyle = '#16222e'; cxR.fillRect(0, 64, 1024, 128);
  badgeOnFlankR(cxR);
  cxR.fillStyle = '#ffffff'; cxR.font = 'bold 140px Arial, sans-serif'; cxR.fillText('RBPD', 580, 118);
  cxR.font = 'bold 44px Arial, sans-serif'; cxR.fillText('P O L I C E', 580, 172);
  const txR = new THREE.CanvasTexture(cvR); txR.anisotropy = 4; return txR; }
function roofTexR() {
  const cvR = document.createElement('canvas'); cvR.width = 512; cvR.height = 512;
  const cxR = cvR.getContext('2d'); cxR.clearRect(0, 0, 512, 512);
  cxR.fillStyle = '#16222e'; cxR.font = 'bold 190px Arial, sans-serif';
  cxR.textAlign = 'center'; cxR.textBaseline = 'middle'; cxR.fillText('RBPD', 256, 256);
  const txR = new THREE.CanvasTexture(cvR); txR.anisotropy = 4; return txR; }
function poolTexR() {
  const cvR = document.createElement('canvas'); cvR.width = 256; cvR.height = 256;
  const cxR = cvR.getContext('2d');
  const gradR = cxR.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradR.addColorStop(0, 'rgba(255,246,205,1)'); gradR.addColorStop(0.35, 'rgba(255,240,190,0.75)');
  gradR.addColorStop(0.7, 'rgba(255,232,160,0.28)'); gradR.addColorStop(1, 'rgba(255,230,150,0)');
  cxR.fillStyle = gradR; cxR.fillRect(0, 0, 256, 256);
  const txR = new THREE.CanvasTexture(cvR); txR.anisotropy = 4; return txR; }
function sideDecalsR(grpR) {
  try { const matR = new THREE.MeshBasicMaterial({ map: flankTexR(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const signsR = [-1, 1];
    for (const sgnR of signsR) {
      const plR = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.095), matR);
      plR.position.set(sgnR * 0.192, 0.175, 0.16); plR.rotation.y = sgnR * Math.PI / 2; plR.renderOrder = 2; grpR.add(plR); }
  } catch (ignoredR) { /* decals are optional */ } }
function roofDecalR(grpR) {
  try { const matR = new THREE.MeshBasicMaterial({ map: roofTexR(), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const plR = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), matR);
    plR.position.set(0, 0.318, 0.10); plR.rotation.x = -Math.PI / 2; plR.renderOrder = 2; grpR.add(plR);
  } catch (ignoredR) { /* decals are optional */ } }
function dressingKitR() {
  const allR = new THREE.Group(); allR.name = 'rbpd-dressing';
  sideDecalsR(allR); roofDecalR(allR);
  const bladeMatR = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });
  const mainR = new THREE.Group(); mainR.position.set(0, 0.35, 0.10);
  const barAR = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.008, 0.055), bladeMatR); mainR.add(barAR);
  const barBR = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.95), bladeMatR); barBR.rotation.y = 0.6; mainR.add(barBR);
  const hubR = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.045, 10), bladeMatR); mainR.add(hubR);
  const blurMatR = new THREE.MeshBasicMaterial({ color: 0xcfd8e3, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
  const discR = new THREE.Mesh(new THREE.CircleGeometry(0.47, 40), blurMatR); discR.rotation.x = -Math.PI / 2; mainR.add(discR);
  allR.add(mainR);
  const tailR = new THREE.Group(); tailR.position.set(0.035, 0.29, -0.475);
  let tPosR = +false;
  while (tPosR < 2) { const tbR = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.02), bladeMatR); tbR.rotation.x = tPosR * Math.PI / 2; tailR.add(tbR); tPosR++; }
  allR.add(tailR);
  const kitR = {}; kitR.group = allR; kitR.rotor = mainR; kitR.tailRotor = tailR; return kitR; }
function swapToGlbR(heliR, wrapR, kitR) {
  try { if (!heliR || !wrapR || heliR.visualMode === 'glb') return false;
    if (kitR && kitR.group && kitR.group.parent !== wrapR) wrapR.add(kitR.group);
    while (heliR.body.children.length) heliR.body.remove(heliR.body.children[0]);
    wrapR.position.set(0, -1.18, 0); heliR.body.add(wrapR);
    if (kitR) { if (kitR.rotor) heliR.rotor = kitR.rotor; if (kitR.tailRotor) heliR.tailRotor = kitR.tailRotor; }
    heliR.visualMode = 'glb'; return true;
  } catch (ignoredR) { return false; } }
function heliMatsR() {
  const matsR = {};
  matsR.hull = new THREE.MeshStandardMaterial({ color: 0x1d2735, metalness: 0.5, roughness: 0.4 });
  matsR.stripe = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.3, roughness: 0.5 });
  matsR.glass = new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.9, roughness: 0.1 });
  matsR.dark = new THREE.MeshStandardMaterial({ color: 0x22282f, metalness: 0.7, roughness: 0.35 });
  matsR.rotor = new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.6, roughness: 0.4 });
  matsR.skid = new THREE.MeshStandardMaterial({ color: 0x30363e, metalness: 0.7, roughness: 0.35 });
  return matsR; }
function addMeshR(grpR, geoR, matR, sxR, syR, szR, pxR, pyR, pzR) {
  const mR = new THREE.Mesh(geoR, matR);
  if (sxR !== null) mR.scale.set(sxR, syR, szR);
  if (pxR !== null) mR.position.set(pxR, pyR, pzR);
  grpR.add(mR); return mR; }
function heliShellFrontR(bodyR, matsR) {
  addMeshR(bodyR, new THREE.SphereGeometry(1, 28, 22), matsR.hull, 1.0, 0.92, 1.9, null, null, null);
  const stripeR = addMeshR(bodyR, new THREE.CylinderGeometry(1.02, 1.02, 0.34, 28, 1, true), matsR.stripe, null, null, null, null, null, null);
  stripeR.rotation.x = Math.PI / 2; stripeR.scale.set(1.0, 1.0, 0.92); stripeR.position.z = -0.15;
  const canopyR = addMeshR(bodyR, new THREE.SphereGeometry(0.94, 24, 16, -Math.PI / 3.2, Math.PI / 1.6, 0.35, 1.05), matsR.glass, 1.0, 0.92, 1.9, 0, 0.12, 0.14);
  void canopyR;
  const bellyR = addMeshR(bodyR, new THREE.SphereGeometry(0.8, 20, 14), matsR.hull, 0.9, 0.45, 1.5, null, null, null);
  bellyR.position.y = -0.55; }
function heliShellRearR(bodyR, matsR) {
  const boomLenR = 3.4;
  const boomR = addMeshR(bodyR, new THREE.CylinderGeometry(0.07, 0.16, boomLenR, 14), matsR.hull, null, null, null, 0, 0.22, -1.75 - boomLenR / 2 + 0.35);
  boomR.rotation.x = Math.PI / 2 - 0.10;
  addMeshR(bodyR, new THREE.SphereGeometry(0.55, 18, 14), matsR.hull, 0.16, 1.15, 0.62, 0, 0.62, -1.75 - boomLenR + 0.35);
  addMeshR(bodyR, new THREE.SphereGeometry(0.5, 16, 10), matsR.hull, 1.5, 0.10, 0.42, 0, 0.30, -1.75 - boomLenR + 0.55);
  addMeshR(bodyR, new THREE.SphereGeometry(0.5, 18, 12), matsR.dark, 0.85, 0.5, 1.15, 0, 0.82, -0.25);
  addMeshR(bodyR, new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), matsR.dark, null, null, null, 0, 1.05, -0.25);
  return boomLenR; }
function mainRotorR(bodyR, matsR) {
  const rotorR = new THREE.Group(); rotorR.position.set(0, 1.32, -0.25);
  rotorR.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), matsR.dark));
  let rPosR = +false;
  while (rPosR < 2) {
    const bladeR = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.28), matsR.rotor); bladeR.rotation.y = rPosR * Math.PI / 2;
    const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.20), matsR.rotor); tipR.position.set(2.75, 0, 0);
    const tipGrpR = new THREE.Group(); tipGrpR.rotation.y = rPosR * Math.PI / 2; tipGrpR.add(tipR);
    const tipFarR = tipR.clone(); tipFarR.position.x = -2.75; tipGrpR.add(tipFarR);
    rotorR.add(bladeR); rotorR.add(tipGrpR); rPosR++; }
  bodyR.add(rotorR); return rotorR; }
function tailRotorR(bodyR, matsR, boomLenR) {
  const tailRotorR2 = new THREE.Group(); tailRotorR2.position.set(0.14, 0.62, -1.75 - boomLenR + 0.35);
  let tPosR = +false;
  while (tPosR < 2) { const tbR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.12), matsR.rotor); tbR.rotation.x = tPosR * Math.PI / 2; tailRotorR2.add(tbR); tPosR++; }
  tailRotorR2.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matsR.dark)); bodyR.add(tailRotorR2);
  return tailRotorR2; }
function skidSideR(bodyR, matsR, sgnR) {
  const offXR = sgnR * 0.78;
  const ptsR = [];
  ptsR.push(new THREE.Vector3(offXR, -1.05, 1.35)); ptsR.push(new THREE.Vector3(offXR, -1.18, 0.4));
  ptsR.push(new THREE.Vector3(offXR, -1.18, -0.9)); ptsR.push(new THREE.Vector3(offXR, -1.02, -1.55));
  const curveR = new THREE.CatmullRomCurve3(ptsR);
  bodyR.add(new THREE.Mesh(new THREE.TubeGeometry(curveR, 20, 0.055, 8), matsR.skid));
  const strutZR = [0.75, -0.75];
  for (const offZR of strutZR) { const strutR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), matsR.skid); strutR.position.set(offXR * 0.82, -0.82, offZR); strutR.rotation.z = sgnR * 0.35; bodyR.add(strutR); } }
function heliSkidsDecalsR(bodyR, matsR) {
  const signsR = [-1, 1];
  for (const sgnR of signsR) skidSideR(bodyR, matsR, sgnR);
  try { const doorMatR = new THREE.MeshBasicMaterial({ map: doorTexR(), transparent: true, side: THREE.DoubleSide });
    const doorSignsR = [-1, 1];
    for (const sgnR of doorSignsR) { const plR = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), doorMatR); plR.position.set(sgnR * 1.01, 0.05, 0.25); plR.rotation.y = sgnR * Math.PI / 2; bodyR.add(plR); }
  } catch (ignoredR) { /* decals are optional */ } }
function heliLightsR(G, rootR) {
  const beamMatR = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamR = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 20, 1, true), beamMatR); beamR.position.set(0, -15.5, 0.6); rootR.add(beamR);
  let glowR = null;
  try { glowR = glowSprite(0xfff2a8, 3.2); glowR.position.set(0, -0.8, 0.6); rootR.add(glowR); } catch (ignoredR) { /* glow is optional */ }
  const spotR = new THREE.SpotLight(0xfff2c0, 2.4, 90, 0.42, 0.45, 1.2); G.scene.add(spotR); G.scene.add(spotR.target);
  let poolR = null;
  try {
    const poolMatR = new THREE.MeshBasicMaterial({ map: poolTexR(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    poolR = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), poolMatR); poolR.rotation.x = -Math.PI / 2; poolR.renderOrder = 5; G.scene.add(poolR);
  } catch (ignoredR) { /* pool is optional */ }
  const lightsR = {}; lightsR.beam = beamR; lightsR.glow = glowR; lightsR.spot = spotR; lightsR.pool = poolR; return lightsR; }
function buildHeliR(G) {
  const rootR = new THREE.Group(); const bodyR = new THREE.Group(); rootR.add(bodyR);
  const matsR = heliMatsR();
  heliShellFrontR(bodyR, matsR);
  const boomLenR = heliShellRearR(bodyR, matsR);
  const rotorR = mainRotorR(bodyR, matsR); const tailRotorR2 = tailRotorR(bodyR, matsR, boomLenR);
  heliSkidsDecalsR(bodyR, matsR);
  const lightsR = heliLightsR(G, rootR);
  rootR.traverse((nodeR) => { if (nodeR.isMesh) { nodeR.castShadow = false; nodeR.receiveShadow = false; } });
  G.scene.add(rootR);
  const heliR = { group: rootR, body: bodyR, rotor: rotorR, tailRotor: tailRotorR2, cone: lightsR.beam, spotlight: lightsR.spot, lensGlow: lightsR.glow, pool: lightsR.pool, trackX: null, trackZ: null, orbitA: rr(0, Math.PI * 2), leaveT: 0, visualMode: 'procedural' };
  return heliR; }
function blinkBarR(vehR, nowR) {
  const barR = vehR.mesh?.userData?.lightbar; if (!barR) return;
  const onR = Math.floor(nowR * 6) % 2 === 0; const hiR = 3.2; const loR = 0.15;
  try {
    if (barR.red) barR.red.emissiveIntensity = onR ? hiR : loR;
    if (barR.blue) barR.blue.emissiveIntensity = onR ? loR : hiR;
    if (barR.gr) barR.gr.visible = onR;
    if (barR.gb) barR.gb.visible = !onR;
  } catch (ignoredR) { /* unknown material shape */ } }
export function initPolice(G) {
  G.cops = G.cops ? G.cops : []; G.heli = null;
  let kitR = null;
  try { kitR = dressingKitR(); } catch (ignoredR) { kitR = null; }
  try { if (G.flags) G.flags.heliDressing = kitR; } catch (ignoredR) { /* flags are optional */ }
  try {
    loadHeroAsset('helicopter').then((wrapR) => { try { if (!wrapR) return; if (G.flags) G.flags.heliAsset = wrapR; if (G.heli) swapToGlbR(G.heli, wrapR, kitR); } catch (ignoredR) { /* keep the procedural build */ } }).catch(() => {});
  } catch (ignoredR) { /* keep the procedural build */ }
  const S = { blocks: [] };
  S.t = 0; S.speedHeatCd = 0; S.driftHeatCd = 0; S.decayAcc = 0;
  S.spawnCd = 0; S.blockCd = 8; S.spikeT = 0; S.prevWantedInt = 0;
  S.chatterIdx = 0; S.ramCd = 0; S.prevPX = 0; S.prevPZ = 0;
  S.pvx = 0; S.pvz = 0; S.smokeCd = 0; S.lastCrashSeen = 0;
  function quotaR() { if (!(G.wanted > 0.05)) return 0 + 0; const tableR = [0, 1, 2, 3, 4, 6]; return tableR[Math.min(5, Math.ceil(G.wanted))]; }
  function nearestLineR(valR, linesR) {
    let bestR = linesR[0];
    linesR.forEach((lineR) => { if (Math.abs(bestR + (-valR)) > Math.abs(lineR + (-valR))) bestR = lineR; });
    return bestR; }
  function spawnPursuerR() {
    const posR = heroPointR(G);
    const angR = rr(0, Math.PI * 2); const distR = rr(120, 180);
    let sxR = posR.x + (Math.sin(angR) * distR); let szR = posR.z + (Math.cos(angR) * distR);
    if (chance(0.5)) sxR = nearestLineR(sxR, G.roadX); else szR = nearestLineR(szR, G.roadZ);
    sxR = THREE.MathUtils.clamp(sxR, -640, 640); szR = THREE.MathUtils.clamp(szR, -640, 640);
    const specR = G.wanted >= 3 && G.cops.length % 2 === 1 ? 'police-suv' : 'police';
    const copR = spawnVehicle(G, specR, sxR, szR, rr(0, Math.PI * 2), { driver: 'cop', livery: 'police', lights: true });
    if (copR) applyNpcPoliceGlb(copR);
    if (copR) G.cops.push(copR);
    return copR; }
  function removeUnitR(vehR) {
    const copIdxR = G.cops.indexOf(vehR); if (!(copIdxR < 0)) G.cops.splice(copIdxR, 1);
    const vehIdxR = G.vehicles ? G.vehicles.indexOf(vehR) : -1; if (!(vehIdxR < 0)) G.vehicles.splice(vehIdxR, 1);
    const trafIdxR = G.traffic ? G.traffic.indexOf(vehR) : -1; if (!(trafIdxR < 0)) G.traffic.splice(trafIdxR, 1);
    if (vehR.mesh) G.scene.remove(vehR.mesh); }
  function blockCarsR(bxR, bzR, perpAngR) {
    const parkedR = []; const offsR = [-8, 8];
    for (const offR of offsR) {
      const cxR = bxR + (Math.sin(perpAngR) * offR); const czR = bzR + (Math.cos(perpAngR) * offR);
      const copR = spawnVehicle(G, 'police', cxR, czR, perpAngR + rr(-0.25, 0.25), { driver: 'parked', livery: 'police', lights: true });
      if (copR) applyNpcPoliceGlb(copR);
      if (copR) { parkedR.push(copR); G.cops.push(copR); } }
    return parkedR; }
  function blockStripR(bxR, bzR, perpAngR) {
    const stripGrpR = new THREE.Group();
    const stripMeshR = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 1.1), new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.9, metalness: 0.2 }));
    stripGrpR.add(stripMeshR);
    const spikeMatR = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, metalness: 0.9, roughness: 0.25 });
    let spPosR = 0;
    while (spPosR < 12) { const spR = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), spikeMatR); spR.position.set(-5.5 + spPosR, 0.13, 0); stripGrpR.add(spR); spPosR++; }
    stripGrpR.position.set(bxR, groundH(bxR, bzR) + 0.05, bzR); stripGrpR.rotation.y = perpAngR; G.scene.add(stripGrpR);
    return stripGrpR; }
  function blockOfficersR(bxR, bzR, perpAngR) {
    const officersR = [];
    if (!CAST.cop) return officersR;
    const offsR = [-11, 11];
    for (const offR of offsR) {
      try {
        const figR = makeFigure(CAST.cop);
        const oxR = bxR + (Math.sin(perpAngR) * offR); const ozR = bzR + (Math.cos(perpAngR) * offR) + 2;
        figR.position.set(oxR, groundH(oxR, ozR), ozR); figR.rotation.y = perpAngR + Math.PI;
        G.scene.add(figR); officersR.push({ fig: figR, phase: rr(0, 6) });
      } catch (ignoredR) { /* figures are optional */ } }
    return officersR; }
  function setupBlockR() {
    const posR = heroPointR(G); const headR = heroAngleR(G); const aheadR = 105;
    let bxR = posR.x + (Math.sin(headR) * aheadR); let bzR = posR.z + (Math.cos(headR) * aheadR);
    const verticalR = Math.abs(Math.sin(headR)) < Math.abs(Math.cos(headR));
    if (verticalR) bxR = nearestLineR(bxR, G.roadX); else bzR = nearestLineR(bzR, G.roadZ);
    bxR = THREE.MathUtils.clamp(bxR, -620, 620); bzR = THREE.MathUtils.clamp(bzR, -620, 620);
    const roadAngR = verticalR ? 0 : Math.PI / 2; const perpAngR = Math.PI / 2 + roadAngR;
    const parkedR = blockCarsR(bxR, bzR, perpAngR);
    const stripGrpR = blockStripR(bxR, bzR, perpAngR);
    const blockGrpR = new THREE.Group(); blockGrpR.add(stripGrpR); void blockGrpR;
    const officersR = blockOfficersR(bxR, bzR, perpAngR);
    const entryR = { x: bxR, z: bzR, angle: perpAngR, cars: parkedR, officers: officersR, strip: stripGrpR, spiked: false };
    S.blocks.push(entryR); }
  function teardownBlockR(blkR) {
    const idxR = S.blocks.indexOf(blkR); if (!(idxR < 0)) S.blocks.splice(idxR, 1);
    const carsCopyR = [...blkR.cars];
    for (const copR of carsCopyR) removeUnitR(copR);
    for (const offR of blkR.officers) G.scene.remove(offR.fig);
    if (blkR.strip) G.scene.remove(blkR.strip); }
  function stageHeliAtR(heliR, stagedR) {
    if ((stagedR || G.flags.heliStage) && G.flags.heliStage) heliR.group.position.set(G.flags.heliStage.x, groundH(G.flags.heliStage.x, G.flags.heliStage.z) + 28, G.flags.heliStage.z);
    else { const posR = heroPointR(G); heliR.group.position.set(posR.x + 20, groundH(posR.x, posR.z) + 28, posR.z); } }
  function ensureHeliR(stagedR) {
    if (G.heli) return;
    const heliR = buildHeliR(G);
    if (G.flags && G.flags.heliAsset) swapToGlbR(heliR, G.flags.heliAsset, kitR);
    stageHeliAtR(heliR, stagedR);
    G.heli = heliR; }
  function dismissHeliR() {
    const heliR = G.heli; if (!heliR) return;
    G.scene.remove(heliR.group); if (heliR.pool) G.scene.remove(heliR.pool);
    if (heliR.spotlight) { G.scene.remove(heliR.spotlight); G.scene.remove(heliR.spotlight.target); }
    G.heli = null; }
  if (G.shot === 'chase' || G.shot === 'heli') ensureHeliR(G.shot === 'heli');
  function trackVelR(posR, dtR) {
    if (dtR > 0) {
      S.pvx = (posR.x + (-S.prevPX)) / dtR; S.pvz = (posR.z + (-S.prevPZ)) / dtR;
      const lenR = Math.hypot(S.pvx, S.pvz);
      if (lenR > 60) { S.pvx = S.pvx * (60 / lenR); S.pvz = S.pvz * (60 / lenR); } }
    S.prevPX = posR.x; S.prevPZ = posR.z; }
  function dispatchLineR(lineR) { try { G.dispatch?.(lineR); } catch (ignoredR) {} }
  function dispatchFootR(roseR, zoneR, slotR) {
    let lineR;
    if (roseR) lineR = [`Dispatch: suspect on foot, ${zoneR} — units respond.`, `Dispatch: all units, suspect on foot in ${zoneR}. Move in.`, `Dispatch: be advised, suspect fled on foot in ${zoneR}.`][slotR % 3];
    else lineR = [`All units: suspect lost visual, ${zoneR}. Stand down.`, `Dispatch: foot pursuit cooling off in ${zoneR} — hold positions.`, `All units: be advised, the suspect on foot slipped away near ${zoneR}.`][slotR % 3];
    dispatchLineR(lineR); }
  function dispatchForR(wholeR, roseR, posR) {
    const zoneR = districtAt(posR.x, posR.z); const descR = rideDescR(G); const slotR = S.chatterIdx++;
    if (!(G.car)) { dispatchFootR(roseR, zoneR, slotR); return; }
    let lineR;
    if (roseR && wholeR >= 4) lineR = [`Dispatch: roadblock authorized, ${zoneR}.`, `Dispatch: air support and roadblocks authorized — suspect in a ${descR}, ${zoneR}.`, `Dispatch: all units converge — suspect in ${descR}, ${zoneR}.`][slotR % 3];
    else if (roseR) lineR = [`Dispatch: suspect in a ${descR}, ${zoneR} — units respond.`, `Dispatch: all units, ${descR} spotted in ${zoneR}. Move to intercept.`, `Dispatch: be advised, a ${descR} is raising hell in ${zoneR}.`][slotR % 3];
    else lineR = [`All units: suspect lost visual, ${zoneR}. Stand down.`, `Dispatch: pursuit cooling off in ${zoneR} — hold positions.`, `All units: be advised, ${descR} slipped away near ${zoneR}.`][slotR % 3];
    if (lineR) dispatchLineR(lineR); }
  function anyCopNearR(posR, rangeR) {
    let nearR = false;
    for (const copR of G.cops) { if (rangeR > distXZR(copR.x, copR.z, posR.x, posR.z)) nearR = true; }
    return nearR; }
  function heatTickR(dtR, posR, seatedR, kmhR) {
    S.speedHeatCd = Math.max(0, S.speedHeatCd - dtR); S.driftHeatCd = Math.max(0, S.driftHeatCd - dtR);
    const nearR = anyCopNearR(posR, 60);
    if (seatedR && kmhR > 110 && !(S.speedHeatCd > 0)) {
      for (const copR of G.cops) { if (40 > distXZR(copR.x, copR.z, posR.x, posR.z) && !(S.speedHeatCd > 0)) { G.wanted = G.wanted + 0.5; S.speedHeatCd = 2.5; } } }
    if (G.flags.crashTimer && G.flags.crashTimer !== S.lastCrashSeen) { S.lastCrashSeen = G.flags.crashTimer; G.flags.crashTimer = 0; G.wanted += 0.4; }
    if (seatedR && G.flags.drifting && !(S.driftHeatCd > 0)) {
      for (const copR of G.cops) { if (45 > distXZR(copR.x, copR.z, posR.x, posR.z) && !(S.driftHeatCd > 0)) { G.wanted = G.wanted + 0.2; S.driftHeatCd = 3; } } }
    if (!nearR && !G.flags.noDecay) { S.decayAcc = S.decayAcc + dtR; while (S.decayAcc >= 10) { S.decayAcc = S.decayAcc + (-10); G.wanted = G.wanted + (-0.1); } } else { S.decayAcc = 0; }
    const clampedR = THREE.MathUtils.clamp(G.wanted || 0, 0, 5); G.wanted = clampedR;
    const wholeR = Math.round(G.wanted || 0);
    if (wholeR !== S.prevWantedInt) { const roseR = wholeR > S.prevWantedInt; S.prevWantedInt = wholeR; dispatchForR(wholeR, roseR, posR); } }
  function spikeTickR(dtR) {
    if (S.spikeT > 0) { S.spikeT -= dtR; G.flags.gripFactor = 0.5;
      if (G.car && G.car.speed > 40 / 3.6) G.car.speed = Math.min(G.car.speed, 40 / 3.6);
      if (chance(0.3) && G.car) try { spawnSmokeAt(G, new THREE.Vector3(G.car.x, groundH(G.car.x, G.car.z) + 0.4, G.car.z), 1, false); } catch (ignoredR) {}
      if (0 >= S.spikeT) G.flags.gripFactor = 1; } }
  function inBlockR(copR) { return S.blocks.some((blkR) => blkR.cars.includes(copR)); }
  function copAimR(copR, posR, gapR, seatedR) {
    let aimXR = posR.x + (S.pvx * Math.min(1.2, gapR / 30)); let aimZR = posR.z + (S.pvz * Math.min(1.2, gapR / 30));
    if (12 > gapR && seatedR) { const headR = heroAngleR(G); aimXR = posR.x + (-(Math.sin(headR) * 2.5)) + (Math.cos(headR) * 1.2); aimZR = posR.z + (-(Math.cos(headR) * 2.5)) + (-(Math.sin(headR) * 1.2)); }
    const aimR = {}; aimR.x = aimXR; aimR.z = aimZR; return aimR; }
  function copBiasR(copR) {
    let biasR = 0;
    if (G.colliders) {
      const probeXR = copR.x + (Math.sin(copR.angle) * 9); const probeZR = copR.z + (Math.cos(copR.angle) * 9);
      for (const colR of G.colliders) {
        if (biasR !== 0) break;
        if (colR.x === undefined) continue;
        const radR = colR.r || 7;
        if (radR + 2 > distXZR(probeXR, probeZR, colR.x, colR.z)) { const crossR = Math.sin(copR.angle) * (colR.z + (-copR.z)) - Math.cos(copR.angle) * (colR.x + (-copR.x)); const mulR = Math.sign(crossR) || 1; biasR = -mulR * 0.8; } } }
    return biasR; }
  function copPaceR(copR, gapHeadR, wreckedR, seatedR, gapR, paceRefR) {
    let topR = (copR.spec?.topSpeed || 190) / 3.6;
    if (!(G.wanted > 2)) topR = Math.min(topR, paceRefR * 0.93); else if (G.wanted >= 4) topR = Math.max(topR, paceRefR);
    let goalR = topR;
    if (Math.abs(gapHeadR) > 1.1) goalR = topR * 0.45; else if (Math.abs(gapHeadR) > 0.5) goalR = topR * 0.75;
    if (wreckedR) goalR = topR * 0.4;
    if (!seatedR && 6 > gapR) goalR = 0;
    const paceR = {}; paceR.top = topR; paceR.goal = goalR; return paceR; }
  function copSteerR(copR, dtR, posR, seatedR, gapR) {
    const aimR = copAimR(copR, posR, gapR, seatedR); const biasR = copBiasR(copR);
    const wantR = Math.atan2(aimR.x + (-copR.x), aimR.z + (-copR.z)) + biasR;
    const gapHeadR = angleGapR(wantR, copR.angle); const maxTurnR = 2.1 * dtR;
    copR.angle = copR.angle + THREE.MathUtils.clamp(gapHeadR, -maxTurnR, maxTurnR);
    return gapHeadR; }
  function copDriveR(copR, dtR, paceR) {
    const accelR = paceR.goal > copR.speed ? 9 : 16;
    const deltaR = Math.sign(paceR.goal + (-copR.speed)) * accelR * dtR;
    copR.speed = THREE.MathUtils.clamp(copR.speed + deltaR, 0, paceR.top);
    copR.x = copR.x + (Math.sin(copR.angle) * copR.speed * dtR); copR.z = copR.z + (Math.cos(copR.angle) * copR.speed * dtR);
    copR.x = THREE.MathUtils.clamp(copR.x, -655, 655); copR.z = THREE.MathUtils.clamp(copR.z, -655, 655);
    copR.mesh.position.set(copR.x, groundH(copR.x, copR.z), copR.z); copR.mesh.rotation.y = copR.angle; }
  function copWheelsR(copR, dtR) {
    const udR = copR.mesh.userData;
    if (udR?.wheels) { const wDeltaR = (copR.speed * dtR) / (udR.wheelR || 0.34); const wheelsR = Object.values(udR.wheels); for (const wheelR of wheelsR) { if (wheelR) wheelR.rotation.x = wheelR.rotation.x + wDeltaR; } } }
  function copTickR(copR, dtR, posR, seatedR, paceRefR) {
    const gapR = distXZR(copR.x, copR.z, posR.x, posR.z); const wreckedR = 30 > (copR.health ?? 100);
    const gapHeadR = copSteerR(copR, dtR, posR, seatedR, gapR);
    const paceR = copPaceR(copR, gapHeadR, wreckedR, seatedR, gapR, paceRefR);
    copDriveR(copR, dtR, paceR);
    if (seatedR && G.car && 3 > gapR && (copR.speed || 0) > 8 && !(S.ramCd > 0)) { damageVehicle(G, G.car, (copR.speed || 0) * 0.35); S.ramCd = 0.6; G.flags.crashTimer = 1; }
    if (copR.steerVis !== undefined) copR.steerVis = THREE.MathUtils.clamp(gapHeadR, -0.5, 0.5);
    copWheelsR(copR, dtR);
    if (wreckedR) {
      S.smokeCd -= dtR;
      if (!(S.smokeCd > 0)) { S.smokeCd = 0.12; try { spawnSmokeAt(G, new THREE.Vector3(copR.x, groundH(copR.x, copR.z) + 0.9, copR.z), 1, false); } catch (ignoredR) {} }
      if (!((copR.health ?? 100) > 0)) removeUnitR(copR); } }
  function blockSpikeCheckR(blkR, posR, seatedR, kmhR) {
    if (blkR.spiked || !seatedR || !G.car) return;
    const alongR = Math.abs(Math.sin(blkR.angle) * (posR.z + (-blkR.z)) - Math.cos(blkR.angle) * (posR.x + (-blkR.x)));
    const perpR = Math.abs(Math.cos(blkR.angle) * (posR.z + (-blkR.z)) + Math.sin(blkR.angle) * (posR.x + (-blkR.x)));
    const blkGapR = distXZR(blkR.x, blkR.z, posR.x, posR.z);
    if (8 > blkGapR && 2.2 > perpR && 7 > alongR && kmhR > 8) {
      blkR.spiked = true; S.spikeT = 6; G.toast?.('Spike strip! Tires shredded');
      try { spawnSmokeAt(G, new THREE.Vector3(posR.x, groundH(posR.x, posR.z) + 0.3, posR.z), 6, false); } catch (ignoredR) {} } }
  function blocksTickR(dtR, posR, seatedR, kmhR) {
    S.blockCd = Math.max(0, S.blockCd - dtR);
    const wantBlocksR = G.wanted >= 5 ? 2 : 1;
    if (G.wanted >= 3 && !(S.blockCd > 0) && S.blocks.length < wantBlocksR && seatedR) { setupBlockR(); S.blockCd = 25; }
    const blocksCopyR = [...S.blocks];
    for (const blkR of blocksCopyR) {
      for (const copR of blkR.cars) blinkBarR(copR, S.t);
      for (const offR of blkR.officers) { try { animateFigure(offR.fig, offR.phase + (S.t * 0.6), 0.15); } catch (ignoredR) {} }
      blockSpikeCheckR(blkR, posR, seatedR, kmhR);
      const blkGapR = distXZR(blkR.x, blkR.z, posR.x, posR.z);
      if (blkGapR > 250) teardownBlockR(blkR); } }
  function heliSpotR(posR, shotHeliR, hardR) {
    const spotR = {}; spotR.x = posR.x; spotR.z = posR.z;
    if (shotHeliR && G.flags.heliStage) { spotR.x = G.flags.heliStage.x; spotR.z = G.flags.heliStage.z; }
    if (G.flags.flashCar && shotHeliR) { spotR.x = G.flags.flashCar.x; spotR.z = G.flags.flashCar.z; }
    else if (hardR && G.car) { spotR.x = G.car.x; spotR.z = G.car.z; }
    return spotR; }
  function heliTickR(dtR, posR, seatedR) {
    const shotHeliR = G.shot === 'chase' || G.shot === 'heli';
    if (G.wanted >= 4 || shotHeliR) ensureHeliR(false);
    if (!G.heli) return;
    const heliR = G.heli;
    if (!shotHeliR && 3 > G.wanted) { heliR.leaveT = heliR.leaveT + dtR; if (heliR.leaveT > 10) dismissHeliR(); } else heliR.leaveT = 0;
    if (!G.heli) return;
    heliR.orbitA = heliR.orbitA + (dtR * 0.35);
    const stageR = G.flags.heliStage ? G.flags.heliStage : posR;
    const tuneR = G.heliShot || null;
    const radR = tuneR && typeof tuneR.radius === 'number' ? tuneR.radius : (G.shot === 'heli' ? 6 : 20);
    const altR = tuneR && typeof tuneR.altitude === 'number' ? tuneR.altitude : 29;
    const orbXR = stageR.x + (Math.sin(heliR.orbitA) * radR); const orbZR = stageR.z + (Math.cos(heliR.orbitA) * radR);
    const orbYR = groundH(orbXR, orbZR) + altR + (Math.sin(S.t * 0.9) * 1.6);
    const hardR = (G.wanted >= 3 && seatedR) || shotHeliR;
    const spotR = heliSpotR(posR, shotHeliR, hardR);
    let poolXR = spotR.x; let poolZR = spotR.z;
    if (hardR) {
      if (heliR.trackX === null || heliR.trackX === undefined) { heliR.trackX = spotR.x; heliR.trackZ = spotR.z; }
      const blendR = 1 - Math.exp(-2.2 * Math.max(0, dtR));
      heliR.trackX = heliR.trackX + ((spotR.x + (-heliR.trackX)) * blendR); heliR.trackZ = heliR.trackZ + ((spotR.z + (-heliR.trackZ)) * blendR);
      poolXR = heliR.trackX + (Math.sin(S.t * 0.6) * 2.2); poolZR = heliR.trackZ + (Math.cos(S.t * 0.45) * 2.2);
    } else { heliR.trackX = spotR.x; heliR.trackZ = spotR.z; }
    const poolYR = groundH(poolXR, poolZR);
    heliR.group.position.set(orbXR, orbYR, orbZR); heliR.group.lookAt(poolXR, poolYR + 1, poolZR);
    heliR.body.rotation.z = 0.38; heliR.body.rotation.x = 0.06;
    heliR.rotor.rotation.y = heliR.rotor.rotation.y + (dtR * 28); heliR.tailRotor.rotation.x = heliR.tailRotor.rotation.x + (dtR * 40);
    heliR.spotlight.position.copy(heliR.group.position); heliR.spotlight.target.position.set(poolXR, poolYR, poolZR); heliR.spotlight.target.updateMatrixWorld();
    const beamLenR = Math.max(10, orbYR + (-poolYR));
    heliR.cone.scale.set(1, beamLenR / 30, 1); heliR.cone.position.set(0, -beamLenR / 2, 0.6);
    if (heliR.pool) { heliR.pool.position.set(poolXR, poolYR + 0.06, poolZR); heliR.pool.material.opacity = hardR ? 0.55 : 0.25; heliR.pool.visible = true; } }
  function bustTickR(dtR, posR, seatedR) {
    if (!(G.flags.busted || G.flags.wasted)) {
      const speedActorR = seatedR ? Math.abs(G.car.speed || 0) : Math.abs(G.player?.speed || 0);
      let nearCountR = 0;
      for (const copR of G.cops) { if (13 > distXZR(copR.x, copR.z, posR.x, posR.z)) nearCountR++; }
      if (2 > (G.wanted || 0)) G.bustMeter = 0;
      else if (!G.shot && !G.shotMode && 1.2 > speedActorR && nearCountR >= 2) G.bustMeter = Math.min(1, (G.bustMeter || 0) + (dtR * 0.28));
      else G.bustMeter = Math.max(0, (G.bustMeter || 0) - (dtR * 0.5));
      if (!G.shot && !G.shotMode && (G.bustMeter || 0) >= 1) { G.bustMeter = 0; G.audio?.play?.('busted'); try { G.hud?.showBusted?.(); } catch (ignoredR) {} }
    } else G.bustMeter = 0; }
  G.updaters.push((frameR, dt) => {
    if (frameR !== G) { /* same object */ }
    if (G.frozen) return;
    S.t += dt; const posR = heroPointR(G);
    trackVelR(posR, dt);
    const seatedR = !!G.car && !!G.flags.inCar; const kmhR = G.speedKmh || 0;
    heatTickR(dt, posR, seatedR, kmhR);
    S.ramCd = Math.max(0, S.ramCd - dt); spikeTickR(dt); S.spawnCd = Math.max(0, S.spawnCd - dt);
    const neededR = quotaR();
    const copsCopyR = [...G.cops];
    for (const copR of copsCopyR) {
      if (copR.staged === true) continue;
      if (inBlockR(copR)) continue;
      if (distXZR(copR.x, copR.z, posR.x, posR.z) > 400) removeUnitR(copR); }
    const liveR = G.cops.filter((copR) => copR.staged !== true && !inBlockR(copR));
    if (liveR.length < neededR && !(S.spawnCd > 0)) { spawnPursuerR(); S.spawnCd = 1.2; }
    if (!(G.wanted > 0.05) && liveR.length) { for (const copR of liveR) { if (distXZR(copR.x, copR.z, posR.x, posR.z) > 120) removeUnitR(copR); } }
    const paceRefR = (G.car?.spec?.topSpeed || 180) / 3.6;
    for (const copR of G.cops) {
      blinkBarR(copR, S.t);
      if (copR.staged === true) continue;
      if (inBlockR(copR)) continue;
      copTickR(copR, dt, posR, seatedR, paceRefR); }
    blocksTickR(dt, posR, seatedR, kmhR); heliTickR(dt, posR, seatedR); bustTickR(dt, posR, seatedR);
  });
}
