// RBPD pursuit brain for Ronin Bay: how heat is earned and how it
// bleeds away, cruiser steering, roadblocks with spike strips, and
// the patrol helicopter with its searchlight.
import * as THREE from 'three';
import { loadHeroAsset } from './assets.js';
import { CAST } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { spawnVehicle, spawnSmokeAt, applyNpcPoliceGlb, damageVehicle } from './cars.js';
import { makeFigure, animateFigure } from './player.js';
const HQ_SPOT = { x: -412.5, z: 412.5 };
function wrapDelta(lead, trail) {
  let gap = lead - trail;
  while (gap > Math.PI) gap = gap - (Math.PI * 2);
  while (gap < -Math.PI) gap = gap + (Math.PI * 2);
  return gap;
}
const span2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function actorPos(G) { const srcObj = G.car ? G.car : G.player; const outPos = { x: srcObj.x, z: srcObj.z }; return outPos; }
function actorHeading(G) { const srcObj = G.car ?? G.player; return srcObj.angle; }
export function districtAt(px, pz) {
  let zoneName = px < 0 ? 'Harborview' : 'Neon District';
  const rules = [];
  rules.push([Math.abs(px) < 200 && Math.abs(pz) < 200, 'Downtown']);
  rules.push([pz < -450, 'Touge Highlands']);
  rules.push([px > 250, 'Portside']);
  rules.push([pz > 380, 'Coral Bay']);
  rules.forEach((rulePair) => { const [, label] = rulePair; if (rulePair[0]) zoneName = label; });
  return zoneName;
}
const PAINT_TABLE = [];
PAINT_TABLE.push([0xff7a1a, 'orange'], [0xe33b3b, 'red'], [0xb01030, 'red'], [0x2e6fb7, 'blue']);
PAINT_TABLE.push([0x3f6d8e, 'blue'], [0x37c8ff, 'blue'], [0xffffff, 'white'], [0xf2f2f2, 'white']);
PAINT_TABLE.push([0x111111, 'black'], [0x1d2735, 'black'], [0xc0c0c0, 'silver'], [0x8a8a8a, 'gray']);
PAINT_TABLE.push([0xffd23f, 'yellow'], [0x2e9e4f, 'green'], [0x7a4fd0, 'purple'], [0xff4fd8, 'pink']);
function paintWord(veh) {
  if (!veh || typeof veh !== 'object') return 'painted';
  const rawPaint = (veh && veh.spec && (veh.spec.color ?? veh.spec.paint)) ?? (veh && (veh.color ?? veh.paint));
  if (typeof rawPaint === 'string') return rawPaint.replace(/^#/, '').length === 6 ? 'painted' : rawPaint;
  if (typeof rawPaint === 'number') {
    let bestWord = 'painted'; let bestDist = Infinity;
    PAINT_TABLE.forEach(([hexVal, label]) => {
      const dr = ((hexVal >> 16) & 255) - ((rawPaint >> 16) & 255);
      const dg = ((hexVal >> 8) & 255) - ((rawPaint >> 8) & 255);
      const db = (hexVal & 255) - (rawPaint & 255);
      const distSq = (dr * dr) + ((dg * dg) + (db * db));
      if (distSq < bestDist) { bestDist = distSq; bestWord = label; }
    });
    return bestWord;
  }
  return 'painted';
}
function describeVehicle(G) { if (!G.car) return 'suspect on foot'; const model = (G.car.spec && G.car.spec.name) || G.car.specId || 'vehicle'; return `${paintWord(G.car)} ${model}`; }
function buildDoorTexture() {
  const cvEl = document.createElement('canvas'); cvEl.width = 256; cvEl.height = 64;
  const pen = cvEl.getContext('2d'); pen.clearRect(0, 0, 256, 64);
  pen.fillStyle = '#ffffff'; pen.font = 'bold 44px Arial, sans-serif';
  pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText('RBPD', 128, 34);
  const texObj = new THREE.CanvasTexture(cvEl); texObj.anisotropy = 4; return texObj;
}
function buildFlankTexture() {
  const cvEl = document.createElement('canvas'); cvEl.width = 1024; cvEl.height = 256;
  const pen = cvEl.getContext('2d'); pen.clearRect(0, 0, 1024, 256);
  pen.fillStyle = '#16222e'; pen.fillRect(0, 64, 1024, 128);
  pen.fillStyle = '#c9a227'; pen.beginPath(); pen.arc(112, 128, 54, 0, Math.PI * 2); pen.fill();
  pen.fillStyle = '#16222e'; pen.beginPath(); pen.arc(112, 128, 40, 0, Math.PI * 2); pen.fill();
  pen.fillStyle = '#c9a227'; pen.font = 'bold 44px Arial, sans-serif'; pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText('★', 112, 130);
  pen.fillStyle = '#ffffff'; pen.font = 'bold 140px Arial, sans-serif'; pen.fillText('RBPD', 580, 118);
  pen.font = 'bold 44px Arial, sans-serif'; pen.fillText('P O L I C E', 580, 172);
  const texObj = new THREE.CanvasTexture(cvEl); texObj.anisotropy = 4; return texObj;
}
function buildRoofTexture() {
  const cvEl = document.createElement('canvas'); cvEl.width = 512; cvEl.height = 512;
  const pen = cvEl.getContext('2d'); pen.clearRect(0, 0, 512, 512);
  pen.fillStyle = '#16222e'; pen.font = 'bold 190px Arial, sans-serif';
  pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText('RBPD', 256, 256);
  const texObj = new THREE.CanvasTexture(cvEl); texObj.anisotropy = 4; return texObj;
}
function assembleDressing() {
  const grp = new THREE.Group(); grp.name = 'rbpd-dressing';
  try {
    const texSide = buildFlankTexture();
    const matSide = new THREE.MeshBasicMaterial({ map: texSide, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    [-1, 1].forEach((flankSign) => {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.095), matSide);
      plane.position.set(flankSign * 0.192, 0.175, 0.16);
      plane.rotation.y = flankSign * Math.PI / 2; plane.renderOrder = 2; grp.add(plane);
    });
  } catch (err) { /* decals are optional in headless runs */ }
  try {
    const texRoof = buildRoofTexture();
    const matRoof = new THREE.MeshBasicMaterial({ map: texRoof, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const planeRoof = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), matRoof);
    planeRoof.position.set(0, 0.318, 0.10); planeRoof.rotation.x = -Math.PI / 2; planeRoof.renderOrder = 2; grp.add(planeRoof);
  } catch (err) { /* decals are optional in headless runs */ }
  const matBlade = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });
  const rotorMain = new THREE.Group(); rotorMain.position.set(0, 0.35, 0.10);
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.008, 0.055), matBlade); rotorMain.add(bladeA);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.95), matBlade); bladeB.rotation.y = 0.6; rotorMain.add(bladeB);
  const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.045, 10), matBlade); rotorMain.add(hubMesh);
  const matBlur = new THREE.MeshBasicMaterial({ color: 0xcfd8e3, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false });
  const discMesh = new THREE.Mesh(new THREE.CircleGeometry(0.47, 40), matBlur); discMesh.rotation.x = -Math.PI / 2; rotorMain.add(discMesh);
  grp.add(rotorMain);
  const grpTail = new THREE.Group(); grpTail.position.set(0.035, 0.29, -0.475);
  let tailIdx = +false;
  while (tailIdx < 2) { const bladeT = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.02), matBlade); bladeT.rotation.x = tailIdx * Math.PI / 2; grpTail.add(bladeT); tailIdx++; }
  grp.add(grpTail);
  const kitObj = { group: grp, rotor: rotorMain, tailRotor: grpTail };
  return kitObj;
}
function swapVisualToGlb(heli, wrap, kit) {
  try {
    if (!heli || !wrap || heli.visualMode === 'glb') return false;
    if (kit && kit.group && kit.group.parent !== wrap) wrap.add(kit.group);
    while (heli.body.children.length) heli.body.remove(heli.body.children[0]);
    wrap.position.set(0, -1.18, 0);
    heli.body.add(wrap);
    if (kit) { if (kit.rotor) heli.rotor = kit.rotor; if (kit.tailRotor) heli.tailRotor = kit.tailRotor; }
    heli.visualMode = 'glb'; return true;
  } catch (err) { return false; }
}
function buildPoolTexture() {
  const cvEl = document.createElement('canvas'); cvEl.width = 256; cvEl.height = 256;
  const pen = cvEl.getContext('2d');
  const grad = pen.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,246,205,1)'); grad.addColorStop(0.35, 'rgba(255,240,190,0.75)');
  grad.addColorStop(0.7, 'rgba(255,232,160,0.28)'); grad.addColorStop(1, 'rgba(255,230,150,0)');
  pen.fillStyle = grad; pen.fillRect(0, 0, 256, 256);
  const texObj = new THREE.CanvasTexture(cvEl); texObj.anisotropy = 4; return texObj;
}
function assembleHeli(G) {
  const heliRoot = new THREE.Group(); const heliBody = new THREE.Group(); heliRoot.add(heliBody);
  const matHull = new THREE.MeshStandardMaterial({ color: 0x1d2735, metalness: 0.5, roughness: 0.4 });
  const matStripe = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.3, roughness: 0.5 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.9, roughness: 0.1 });
  const matDark = new THREE.MeshStandardMaterial({ color: 0x22282f, metalness: 0.7, roughness: 0.35 });
  const podMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 22), matHull);
  podMesh.scale.set(1.0, 0.92, 1.9); heliBody.add(podMesh);
  const stripeMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.34, 28, 1, true), matStripe);
  stripeMesh.rotation.x = Math.PI / 2; stripeMesh.scale.set(1.0, 1.0, 0.92); stripeMesh.position.z = -0.15; heliBody.add(stripeMesh);
  const canopyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.94, 24, 16, -Math.PI / 3.2, Math.PI / 1.6, 0.35, 1.05), matGlass);
  canopyMesh.scale.set(1.0, 0.92, 1.9); canopyMesh.position.set(0, 0.12, 0.14); heliBody.add(canopyMesh);
  const bellyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), matHull);
  bellyMesh.scale.set(0.9, 0.45, 1.5); bellyMesh.position.y = -0.55; heliBody.add(bellyMesh);
  const boomLen = 3.4;
  const boomMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, boomLen, 14), matHull);
  boomMesh.rotation.x = Math.PI / 2 - 0.10; boomMesh.position.set(0, 0.22, -1.75 - boomLen / 2 + 0.35); heliBody.add(boomMesh);
  const finMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), matHull);
  finMesh.scale.set(0.16, 1.15, 0.62); finMesh.position.set(0, 0.62, -1.75 - boomLen + 0.35); heliBody.add(finMesh);
  const stabMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), matHull);
  stabMesh.scale.set(1.5, 0.10, 0.42); stabMesh.position.set(0, 0.30, -1.75 - boomLen + 0.55); heliBody.add(stabMesh);
  const humpMesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), matDark);
  humpMesh.scale.set(0.85, 0.5, 1.15); humpMesh.position.set(0, 0.82, -0.25); heliBody.add(humpMesh);
  const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), matDark);
  mastMesh.position.set(0, 1.05, -0.25); heliBody.add(mastMesh);
  const grpRotor = new THREE.Group(); grpRotor.position.set(0, 1.32, -0.25);
  const hubRotor = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), matDark); grpRotor.add(hubRotor);
  const matRotor = new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.6, roughness: 0.4 });
  let rotorIdx = +false;
  while (rotorIdx < 2) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.28), matRotor); blade.rotation.y = rotorIdx * Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.20), matRotor); tip.position.set(2.75, 0, 0);
    const grpTip = new THREE.Group(); grpTip.rotation.y = rotorIdx * Math.PI / 2; grpTip.add(tip);
    const tipFar = tip.clone(); tipFar.position.x = -2.75; grpTip.add(tipFar);
    grpRotor.add(blade); grpRotor.add(grpTip);
    rotorIdx++;
  }
  heliBody.add(grpRotor);
  const grpTailRotor = new THREE.Group(); grpTailRotor.position.set(0.14, 0.62, -1.75 - boomLen + 0.35);
  let tailRotorIdx = +false;
  while (tailRotorIdx < 2) { const bladeTail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.12), matRotor); bladeTail.rotation.x = tailRotorIdx * Math.PI / 2; grpTailRotor.add(bladeTail); tailRotorIdx++; }
  const hubTail = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matDark); grpTailRotor.add(hubTail); heliBody.add(grpTailRotor);
  const matSkid = new THREE.MeshStandardMaterial({ color: 0x30363e, metalness: 0.7, roughness: 0.35 });
  [-1, 1].forEach((flankSign) => {
    const offX = flankSign * 0.78;
    const pts = [new THREE.Vector3(offX, -1.05, 1.35), new THREE.Vector3(offX, -1.18, 0.4), new THREE.Vector3(offX, -1.18, -0.9), new THREE.Vector3(offX, -1.02, -1.55)];
    const path = new THREE.CatmullRomCurve3(pts);
    const skidMesh = new THREE.Mesh(new THREE.TubeGeometry(path, 20, 0.055, 8), matSkid); heliBody.add(skidMesh);
    [0.75, -0.75].forEach((offZ) => { const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), matSkid); strut.position.set(offX * 0.82, -0.82, offZ); strut.rotation.z = flankSign * 0.35; heliBody.add(strut); });
  });
  try {
    const texDoor = buildDoorTexture();
    const matDoor = new THREE.MeshBasicMaterial({ map: texDoor, transparent: true, side: THREE.DoubleSide });
    [-1, 1].forEach((flankSign) => { const planeDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), matDoor); planeDoor.position.set(flankSign * 1.01, 0.05, 0.25); planeDoor.rotation.y = flankSign * Math.PI / 2; heliBody.add(planeDoor); });
  } catch (err) { /* decals are optional in headless runs */ }
  const matBeam = new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamMesh = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 20, 1, true), matBeam); beamMesh.position.set(0, -15.5, 0.6); heliRoot.add(beamMesh);
  let lensGlowMesh = null;
  try { lensGlowMesh = glowSprite(0xfff2a8, 3.2); lensGlowMesh.position.set(0, -0.8, 0.6); heliRoot.add(lensGlowMesh); } catch (err) { /* the glow is optional */ }
  const spotLight = new THREE.SpotLight(0xfff2c0, 2.4, 90, 0.42, 0.45, 1.2); G.scene.add(spotLight); G.scene.add(spotLight.target);
  let poolMesh = null;
  try {
    const matPool = new THREE.MeshBasicMaterial({ map: buildPoolTexture(), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    poolMesh = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), matPool); poolMesh.rotation.x = -Math.PI / 2; poolMesh.renderOrder = 5; G.scene.add(poolMesh);
  } catch (err) { /* the pool is optional; the spotlight still lights the ground */ }
  heliRoot.traverse((nodeObj) => { if (nodeObj.isMesh) { nodeObj.castShadow = false; nodeObj.receiveShadow = false; } });
  G.scene.add(heliRoot);
  const heliObj = {};
  heliObj.group = heliRoot; heliObj.body = heliBody; heliObj.rotor = grpRotor; heliObj.tailRotor = grpTailRotor;
  heliObj.cone = beamMesh; heliObj.spotlight = spotLight; heliObj.lensGlow = lensGlowMesh; heliObj.pool = poolMesh;
  heliObj.trackX = null; heliObj.trackZ = null; heliObj.orbitA = rr(0, Math.PI * 2); heliObj.leaveT = 0; heliObj.visualMode = 'procedural';
  return heliObj;
}
function flashLightbar(veh, tNow) {
  const bar = veh.mesh?.userData?.lightbar; if (!bar) return;
  const phaseOn = Math.floor(tNow * 6) % 2 === 0;
  const hiLevel = 3.2; const loLevel = 0.15;
  try {
    if (bar.red) bar.red.emissiveIntensity = phaseOn ? hiLevel : loLevel;
    if (bar.blue) bar.blue.emissiveIntensity = phaseOn ? loLevel : hiLevel;
    if (bar.gr) bar.gr.visible = phaseOn;
    if (bar.gb) bar.gb.visible = !phaseOn;
  } catch (err) { /* an unfamiliar material shape is ignored */ }
}
export function initPolice(G) {
  G.cops = G.cops || []; G.heli = null;
  let kit = null;
  try { kit = assembleDressing(); } catch (err) { kit = null; }
  try { if (G.flags) G.flags.heliDressing = kit; } catch (err) { /* flags are optional */ }
  try {
    loadHeroAsset('helicopter').then((wrap) => { try { if (!wrap) return; if (G.flags) G.flags.heliAsset = wrap; if (G.heli) swapVisualToGlb(G.heli, wrap, kit); } catch (err) { /* the procedural visual stays */ } }).catch(() => {});
  } catch (err) { /* the procedural visual stays */ }
  const st = { t: 0, speedHeatCd: 0, driftHeatCd: 0, decayAcc: 0, spawnCd: 0, blockCd: 8, blocks: [], spikeT: 0, prevWantedInt: 0, chatterIdx: 0, ramCd: 0, prevPX: 0, prevPZ: 0, pvx: 0, pvz: 0, smokeCd: 0, lastCrashSeen: 0 };
  function unitQuota() { if (!(G.wanted > 0.05)) return 0; const table = [0, 1, 2, 3, 4, 6]; return table[Math.min(5, Math.ceil(G.wanted))]; }
  function nearestLine(val, lines) { let bestLine = lines[0]; lines.forEach((lineVal) => { if (Math.abs(lineVal - val) < Math.abs(bestLine - val)) bestLine = lineVal; }); return bestLine; }
  function spawnPursuer() {
    const pos = actorPos(G);
    const angSpawn = rr(0, Math.PI * 2); const distSpawn = rr(120, 180);
    let sx = pos.x + (Math.sin(angSpawn) * distSpawn); let sz = pos.z + (Math.cos(angSpawn) * distSpawn);
    if (chance(0.5)) sx = nearestLine(sx, G.roadX); else sz = nearestLine(sz, G.roadZ);
    sx = THREE.MathUtils.clamp(sx, -640, 640); sz = THREE.MathUtils.clamp(sz, -640, 640);
    const specPick = G.wanted >= 3 && G.cops.length % 2 === 1 ? 'police-suv' : 'police';
    const cop = spawnVehicle(G, specPick, sx, sz, rr(0, Math.PI * 2), { driver: 'cop', livery: 'police', lights: true });
    if (cop) applyNpcPoliceGlb(cop);
    if (cop) G.cops.push(cop);
    return cop;
  }
  function removeUnit(veh) {
    const copIdx = G.cops.indexOf(veh); if (!(copIdx < 0)) G.cops.splice(copIdx, 1);
    const vehIdx = G.vehicles ? G.vehicles.indexOf(veh) : -1; if (!(vehIdx < 0)) G.vehicles.splice(vehIdx, 1);
    const trafIdx = G.traffic ? G.traffic.indexOf(veh) : -1; if (!(trafIdx < 0)) G.traffic.splice(trafIdx, 1);
    if (veh.mesh) G.scene.remove(veh.mesh);
  }
  function setupRoadblock() {
    const pos = actorPos(G); const heading = actorHeading(G); const aheadDist = 105;
    let bx = pos.x + (Math.sin(heading) * aheadDist); let bz = pos.z + (Math.cos(heading) * aheadDist);
    const verticalRoad = Math.abs(Math.sin(heading)) < Math.abs(Math.cos(heading));
    if (verticalRoad) bx = nearestLine(bx, G.roadX); else bz = nearestLine(bz, G.roadZ);
    bx = THREE.MathUtils.clamp(bx, -620, 620); bz = THREE.MathUtils.clamp(bz, -620, 620);
    const angRoad = verticalRoad ? 0 : Math.PI / 2;
    const angPerp = Math.PI / 2 + angRoad;
    const grpBlock = new THREE.Group(); const parkedCars = [];
    [-8, 8].forEach((offVal) => {
      const cx = bx + (Math.sin(angPerp) * offVal); const cz = bz + (Math.cos(angPerp) * offVal);
      const cop = spawnVehicle(G, 'police', cx, cz, angPerp + rr(-0.25, 0.25), { driver: 'parked', livery: 'police', lights: true });
      if (cop) applyNpcPoliceGlb(cop);
      if (cop) { parkedCars.push(cop); G.cops.push(cop); }
    });
    const grpStrip = new THREE.Group();
    const stripMesh = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 1.1), new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.9, metalness: 0.2 }));
    grpStrip.add(stripMesh);
    const matSpike = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, metalness: 0.9, roughness: 0.25 });
    let spikeIdx = 0;
    while (spikeIdx < 12) { const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), matSpike); spike.position.set(-5.5 + spikeIdx, 0.13, 0); grpStrip.add(spike); spikeIdx++; }
    grpStrip.position.set(bx, groundH(bx, bz) + 0.05, bz); grpStrip.rotation.y = angPerp; G.scene.add(grpStrip); grpBlock.add(grpStrip);
    const officers = [];
    if (CAST.cop) {
      [-11, 11].forEach((offVal) => {
        try {
          const figMesh = makeFigure(CAST.cop);
          const ox = bx + (Math.sin(angPerp) * offVal); const oz = bz + (Math.cos(angPerp) * offVal) + 2;
          figMesh.position.set(ox, groundH(ox, oz), oz); figMesh.rotation.y = angPerp + Math.PI;
          G.scene.add(figMesh); officers.push({ fig: figMesh, phase: rr(0, 6) });
        } catch (err) { /* figures are optional */ }
      });
    }
    const blockRec = { x: bx, z: bz, angle: angPerp, cars: parkedCars, officers: officers, strip: grpStrip, spiked: false };
    st.blocks.push(blockRec);
  }
  function teardownRoadblock(blk) {
    const blkIdx = st.blocks.indexOf(blk); if (!(blkIdx < 0)) st.blocks.splice(blkIdx, 1);
    [...blk.cars].forEach((cop) => removeUnit(cop));
    blk.officers.forEach((officer) => G.scene.remove(officer.fig));
    if (blk.strip) G.scene.remove(blk.strip);
  }
  function ensureHeli(staged) {
    if (G.heli) return;
    const heli = assembleHeli(G);
    if (G.flags && G.flags.heliAsset) swapVisualToGlb(heli, G.flags.heliAsset, kit);
    if ((staged || G.flags.heliStage) && G.flags.heliStage) heli.group.position.set(G.flags.heliStage.x, groundH(G.flags.heliStage.x, G.flags.heliStage.z) + 28, G.flags.heliStage.z);
    else { const pos = actorPos(G); heli.group.position.set(pos.x + 20, groundH(pos.x, pos.z) + 28, pos.z); }
    G.heli = heli;
  }
  function dismissHeli() {
    if (!G.heli) return;
    G.scene.remove(G.heli.group);
    if (G.heli.spotlight) { G.scene.remove(G.heli.spotlight); G.scene.remove(G.heli.spotlight.target); }
    if (G.heli.pool) G.scene.remove(G.heli.pool);
    G.heli = null;
  }
  if (G.shot === 'chase' || G.shot === 'heli') ensureHeli(G.shot === 'heli');
  function trackVelocity(pos, dt) {
    if (dt > 0) {
      st.pvx = (pos.x - st.prevPX) / dt; st.pvz = (pos.z - st.prevPZ) / dt;
      const velLen = Math.hypot(st.pvx, st.pvz);
      if (velLen > 60) { st.pvx = st.pvx * (60 / velLen); st.pvz = st.pvz * (60 / velLen); }
    }
    st.prevPX = pos.x; st.prevPZ = pos.z;
  }
  G.updaters.push((ctxG, dt) => {
    if (ctxG !== G) { /* the identical object either way */ }
    if (G.frozen) return;
    st.t = st.t + dt;
    const pos = actorPos(G);
    trackVelocity(pos, dt);
    const inCar = !!G.car && !!G.flags.inCar; const kmh = G.speedKmh || 0;
    st.speedHeatCd = Math.max(0, st.speedHeatCd - dt); st.driftHeatCd = Math.max(0, st.driftHeatCd - dt);
    let copNear = false;
    G.cops.forEach((cop) => { if (span2d(cop.x, cop.z, pos.x, pos.z) < 60) copNear = true; });
    if (inCar && kmh > 110 && !(st.speedHeatCd > 0)) {
      G.cops.forEach((cop) => { if (span2d(cop.x, cop.z, pos.x, pos.z) < 40 && !(st.speedHeatCd > 0)) { G.wanted = G.wanted + 0.5; st.speedHeatCd = 2.5; } });
    }
    if (G.flags.crashTimer && G.flags.crashTimer !== st.lastCrashSeen) {
      st.lastCrashSeen = G.flags.crashTimer; G.flags.crashTimer = 0;
      G.wanted = G.wanted + 0.4;
    }
    if (inCar && G.flags.drifting && !(st.driftHeatCd > 0)) {
      G.cops.forEach((cop) => { if (span2d(cop.x, cop.z, pos.x, pos.z) < 45 && !(st.driftHeatCd > 0)) { G.wanted = G.wanted + 0.2; st.driftHeatCd = 3; } });
    }
    if (!copNear && !G.flags.noDecay) { st.decayAcc = st.decayAcc + dt; while (st.decayAcc >= 10) { st.decayAcc = st.decayAcc - 10; G.wanted = G.wanted - 0.1; } }
    else st.decayAcc = 0;
    G.wanted = THREE.MathUtils.clamp(G.wanted || 0, 0, 5);
    {
      const whole = Math.round(G.wanted || 0);
      if (whole !== st.prevWantedInt) {
        const up = whole > st.prevWantedInt; st.prevWantedInt = whole;
        const zone = districtAt(pos.x, pos.z); const desc = describeVehicle(G); const linePos = st.chatterIdx++;
        let line;
        if (!G.car) {
          line = up ? [`Dispatch: suspect on foot, ${zone} — units respond.`, `Dispatch: all units, suspect on foot in ${zone}. Move in.`, `Dispatch: be advised, suspect fled on foot in ${zone}.`][linePos % 3] : [`All units: suspect lost visual, ${zone}. Stand down.`, `Dispatch: foot pursuit cooling off in ${zone} — hold positions.`, `All units: be advised, the suspect on foot slipped away near ${zone}.`][linePos % 3];
          try { G.dispatch?.(line); } catch (err) {}
          line = null;
        }
        if (!G.car) { /* the on-foot line already went out overhead */ }
        else if (up && whole >= 4) line = [`Dispatch: roadblock authorized, ${zone}.`, `Dispatch: air support and roadblocks authorized — suspect in a ${desc}, ${zone}.`, `Dispatch: all units converge — suspect in ${desc}, ${zone}.`][linePos % 3];
        else if (up) line = [`Dispatch: suspect in a ${desc}, ${zone} — units respond.`, `Dispatch: all units, ${desc} spotted in ${zone}. Move to intercept.`, `Dispatch: be advised, a ${desc} is raising hell in ${zone}.`][linePos % 3];
        else line = [`All units: suspect lost visual, ${zone}. Stand down.`, `Dispatch: pursuit cooling off in ${zone} — hold positions.`, `All units: be advised, ${desc} slipped away near ${zone}.`][linePos % 3];
        if (line) { try { G.dispatch?.(line); } catch (err) {} }
      }
    }
    st.ramCd = Math.max(0, st.ramCd - dt);
    if (st.spikeT > 0) {
      st.spikeT = st.spikeT - dt; G.flags.gripFactor = 0.5;
      if (G.car && G.car.speed > 40 / 3.6) G.car.speed = 40 / 3.6;
      if (G.car && chance(0.3))
        try { spawnSmokeAt(G, new THREE.Vector3(G.car.x, groundH(G.car.x, G.car.z) + 0.4, G.car.z), 1, false); } catch (err) {}
      if (!(st.spikeT > 0)) G.flags.gripFactor = 1;
    }
    st.spawnCd = Math.max(0, st.spawnCd - dt);
    const needed = unitQuota();
    [...G.cops].forEach((cop) => {
      if (cop.staged === true) return;
      if (st.blocks.some((blk) => blk.cars.includes(cop))) return;
      if (span2d(cop.x, cop.z, pos.x, pos.z) > 400) removeUnit(cop);
    });
    const liveUnits = G.cops.filter((cop) => cop.staged !== true && !st.blocks.some((blk) => blk.cars.includes(cop)));
    if (liveUnits.length < needed && !(st.spawnCd > 0)) { spawnPursuer(); st.spawnCd = 1.2; }
    if (!(G.wanted > 0.05) && liveUnits.length) liveUnits.forEach((cop) => { if (span2d(cop.x, cop.z, pos.x, pos.z) > 120) removeUnit(cop); });
    const topRef = (G.car?.spec?.topSpeed || 180) / 3.6;
    G.cops.forEach((cop) => {
      flashLightbar(cop, st.t);
      if (cop.staged === true) return;
      if (st.blocks.some((blk) => blk.cars.includes(cop))) return;
      const gapDist = span2d(cop.x, cop.z, pos.x, pos.z); const wrecked = (cop.health ?? 100) < 30;
      let aimX = pos.x + (st.pvx * Math.min(1.2, gapDist / 30)); let aimZ = pos.z + (st.pvz * Math.min(1.2, gapDist / 30));
      if (gapDist < 12 && inCar) { const heading = actorHeading(G); aimX = pos.x - (Math.sin(heading) * 2.5) + (Math.cos(heading) * 1.2); aimZ = pos.z - (Math.cos(heading) * 2.5) - (Math.sin(heading) * 1.2); }
      let steerBias = 0;
      if (G.colliders) {
        const probeX = cop.x + (Math.sin(cop.angle) * 9); const probeZ = cop.z + (Math.cos(cop.angle) * 9);
        G.colliders.forEach((col) => {
          if (steerBias !== 0) return;
          if (col.x === undefined) return;
          const radCol = col.r || 7;
          if (span2d(probeX, probeZ, col.x, col.z) < radCol + 2) { const mul = Math.sign(Math.sin(cop.angle) * (col.z - cop.z) - Math.cos(cop.angle) * (col.x - cop.x)) || 1; steerBias = -mul * 0.8; }
        });
      }
      const wantHead = Math.atan2(aimX - cop.x, aimZ - cop.z) + steerBias;
      const gapHead = wrapDelta(wantHead, cop.angle); const maxTurn = 2.1 * dt;
      cop.angle = cop.angle + THREE.MathUtils.clamp(gapHead, -maxTurn, maxTurn);
      let topUnit = (cop.spec?.topSpeed || 190) / 3.6;
      if (!(G.wanted > 2)) topUnit = Math.min(topUnit, topRef * 0.93);
      else if (G.wanted >= 4) topUnit = Math.max(topUnit, topRef);
      let goalPace = topUnit;
      if (Math.abs(gapHead) > 1.1) goalPace = topUnit * 0.45;
      else if (Math.abs(gapHead) > 0.5) goalPace = topUnit * 0.75;
      if (wrecked) goalPace = topUnit * 0.4;
      if (!inCar && gapDist < 6) goalPace = 0;
      const accelRate = goalPace > cop.speed ? 9 : 16;
      cop.speed = THREE.MathUtils.clamp(cop.speed + (Math.sign(goalPace - cop.speed) * accelRate * dt), 0, topUnit);
      cop.x = cop.x + (Math.sin(cop.angle) * cop.speed * dt); cop.z = cop.z + (Math.cos(cop.angle) * cop.speed * dt);
      cop.x = THREE.MathUtils.clamp(cop.x, -655, 655); cop.z = THREE.MathUtils.clamp(cop.z, -655, 655);
      cop.mesh.position.set(cop.x, groundH(cop.x, cop.z), cop.z); cop.mesh.rotation.y = cop.angle;
      if (inCar && G.car && gapDist < 3 && (cop.speed || 0) > 8 && !(st.ramCd > 0)) { damageVehicle(G, G.car, (cop.speed || 0) * 0.35); st.ramCd = 0.6; G.flags.crashTimer = 1; }
      if (cop.steerVis !== undefined) cop.steerVis = THREE.MathUtils.clamp(gapHead, -0.5, 0.5);
      const ud = cop.mesh.userData;
      if (ud?.wheels) { const wd = (cop.speed * dt) / (ud.wheelR || 0.34); Object.values(ud.wheels).forEach((wheel) => { if (wheel) wheel.rotation.x = wheel.rotation.x + wd; }); }
      if (wrecked) {
        st.smokeCd = st.smokeCd - dt;
        if (!(st.smokeCd > 0)) { st.smokeCd = 0.12; try { spawnSmokeAt(G, new THREE.Vector3(cop.x, groundH(cop.x, cop.z) + 0.9, cop.z), 1, false); } catch (err) {} }
        if (!((cop.health ?? 100) > 0)) removeUnit(cop);
      }
    });
    st.blockCd = Math.max(0, st.blockCd - dt);
    if (G.wanted >= 3 && !(st.blockCd > 0) && st.blocks.length < (G.wanted >= 5 ? 2 : 1) && inCar) { setupRoadblock(); st.blockCd = 25; }
    [...st.blocks].forEach((blk) => {
      blk.cars.forEach((cop) => flashLightbar(cop, st.t));
      blk.officers.forEach((officer) => { try { animateFigure(officer.fig, officer.phase + (st.t * 0.6), 0.15); } catch (err) {} });
      const blkGap = span2d(blk.x, blk.z, pos.x, pos.z);
      if (!blk.spiked && inCar && G.car) {
        const alongOff = Math.abs(Math.sin(blk.angle) * (pos.z - blk.z) - Math.cos(blk.angle) * (pos.x - blk.x));
        const perpOff = Math.abs(Math.cos(blk.angle) * (pos.z - blk.z) + Math.sin(blk.angle) * (pos.x - blk.x));
        if (blkGap < 8 && perpOff < 2.2 && alongOff < 7 && kmh > 8) {
          blk.spiked = true; st.spikeT = 6; G.toast?.('Spike strip! Tires shredded');
          try { spawnSmokeAt(G, new THREE.Vector3(pos.x, groundH(pos.x, pos.z) + 0.3, pos.z), 6, false); } catch (err) {}
        }
      }
      if (blkGap > 250) teardownRoadblock(blk);
    });
    const shotHeli = G.shot === 'chase' || G.shot === 'heli';
    if (G.wanted >= 4 || shotHeli) ensureHeli(false);
    if (G.heli) {
      const heli = G.heli;
      if (!shotHeli && G.wanted < 3) { heli.leaveT = heli.leaveT + dt; if (heli.leaveT > 10) dismissHeli(); }
      else heli.leaveT = 0;
      if (G.heli) {
        heli.orbitA = heli.orbitA + (dt * 0.35);
        const stagePt = G.flags.heliStage ? G.flags.heliStage : pos;
        const tune = G.heliShot || null;
        const radOrbit = tune && typeof tune.radius === 'number' ? tune.radius : (G.shot === 'heli' ? 6 : 20);
        const hOrbit = tune && typeof tune.altitude === 'number' ? tune.altitude : 29;
        const orbX = stagePt.x + (Math.sin(heli.orbitA) * radOrbit); const orbZ = stagePt.z + (Math.cos(heli.orbitA) * radOrbit);
        const orbY = groundH(orbX, orbZ) + hOrbit + (Math.sin(st.t * 0.9) * 1.6);
        const hardTrack = (G.wanted >= 3 && inCar) || shotHeli;
        let sx = pos.x; let sz = pos.z;
        if (shotHeli && G.flags.heliStage) { sx = G.flags.heliStage.x; sz = G.flags.heliStage.z; }
        if (G.flags.flashCar && shotHeli) { sx = G.flags.flashCar.x; sz = G.flags.flashCar.z; }
        else if (hardTrack && G.car) { sx = G.car.x; sz = G.car.z; }
        let poolX = sx; let poolZ = sz;
        if (hardTrack) {
          if (heli.trackX === null || heli.trackX === undefined) { heli.trackX = sx; heli.trackZ = sz; }
          const facBlend = 1 - Math.exp(-2.2 * Math.max(0, dt));
          heli.trackX = heli.trackX + ((sx - heli.trackX) * facBlend); heli.trackZ = heli.trackZ + ((sz - heli.trackZ) * facBlend);
          poolX = heli.trackX + (Math.sin(st.t * 0.6) * 2.2); poolZ = heli.trackZ + (Math.cos(st.t * 0.45) * 2.2);
        } else { heli.trackX = sx; heli.trackZ = sz; }
        const poolY = groundH(poolX, poolZ);
        heli.group.position.set(orbX, orbY, orbZ); heli.group.lookAt(poolX, poolY + 1, poolZ);
        heli.body.rotation.z = 0.38;
        heli.body.rotation.x = 0.06;
        heli.rotor.rotation.y = heli.rotor.rotation.y + (dt * 28); heli.tailRotor.rotation.x = heli.tailRotor.rotation.x + (dt * 40);
        heli.spotlight.position.copy(heli.group.position); heli.spotlight.target.position.set(poolX, poolY, poolZ); heli.spotlight.target.updateMatrixWorld();
        const lenBeam = Math.max(10, orbY - poolY);
        heli.cone.scale.set(1, lenBeam / 30, 1); heli.cone.position.set(0, -lenBeam / 2, 0.6);
        if (heli.pool) { heli.pool.position.set(poolX, poolY + 0.06, poolZ); heli.pool.material.opacity = hardTrack ? 0.55 : 0.25; heli.pool.visible = true; }
      }
    }
    if (!G.flags.busted && !G.flags.wasted) {
      const speedActor = inCar ? Math.abs(G.car.speed || 0) : Math.abs(G.player?.speed || 0);
      let nearCount = 0;
      G.cops.forEach((cop) => { if (span2d(cop.x, cop.z, pos.x, pos.z) < 13) nearCount++; });
      if ((G.wanted || 0) < 2) G.bustMeter = 0;
      else if (!G.shot && !G.shotMode && speedActor < 1.2 && nearCount >= 2) G.bustMeter = Math.min(1, (G.bustMeter || 0) + (0.28 * dt));
      else G.bustMeter = Math.max(0, (G.bustMeter || 0) - (0.5 * dt));
      if (!G.shot && !G.shotMode && (G.bustMeter || 0) >= 1) {
        G.bustMeter = 0; G.audio?.play?.('busted');
        try { G.hud?.showBusted?.(); } catch (err) {}
      }
    } else G.bustMeter = 0;
  });
}
