import * as THREE from 'three'; import { rr, chance } from './random.js';
import { groundH, glowSprite } from './world.js'; import { damageVehicle, spawnSmokeAt } from './cars.js';
import { loadHeroAsset, HERO_ASSETS } from './assets.js';
// The shooting layer stands on its own: pistol plus micro SMG
// plus bat, all in one place
// It reaches the wider game only through defensive hooks into
// shared state, so removing its init call brings back the
// earlier behaviour
// Model files are drop in replacements, and while they are
// absent the procedural shapes below stay in silent use
export const WEAPON_TABLE = {};
WEAPON_TABLE.bat = { name: 'BASEBALL BAT', dmg: 55, interval: 0.55, auto: false, mag: Infinity, reload: 0,
  range: 2.4, melee: true };
WEAPON_TABLE.smg = { name: 'MICRO SMG', dmg: 15, interval: 0.085, auto: true, mag: 30, reload: 1.3,
  range: 110, spread: 0.02 };
WEAPON_TABLE.pistol = { name: 'PISTOL', dmg: 34, interval: 0.34, auto: false, mag: 12, reload: 0.9,
  range: 130, spread: 0.006 };
const ORDER_SLOTS = ['pistol', 'smg', 'bat'];
const ASSET_FOR_SLOT = { pistol: 'weaponPistol', smg: 'weaponSmg', bat: 'weaponBat' };
// Notes on model orientation: vendor models share none of the
// game axes at all
// The held root on the figure points forward, and the pose
// table below corrects each model inside its own group
// relative to that root
// Procedural children never get touched, so a missing model
// leaves the fallback exact, and the SMG flip remains a
// single constant change
const SMG_FLIP_YAW = Math.PI;
export const WEAPON_POSE = {};
WEAPON_POSE.bat = { axisFrom: new THREE.Vector3(-0.775, -0.631, 0.001).normalize(),
  axisTo: new THREE.Vector3(0, -0.75, 0.66).normalize(), knobLocal: new THREE.Vector3(-0.49, 0.02, 0) };
WEAPON_POSE.smg = { rotY: SMG_FLIP_YAW,
  offset: new THREE.Vector3(0, -0.13, 0.03) };
WEAPON_POSE.pistol = { rotY: -Math.PI / 2,
  offset: new THREE.Vector3(0, -0.10, -0.02) };
// One model gets wrapped in its oriented holder inside the per
// weapon group
// Recoil moving the group, and the bat swing rotating it,
// then carry the model exactly like the procedural mesh
function seatInHolder(slotGiven, holderGiven, wrapGiven) {
  const poseGiven = WEAPON_POSE[slotGiven];
  if (!poseGiven) { holderGiven.add(wrapGiven); return; }
  const batSlot = (slotGiven === 'bat');
  if (!batSlot) {
    wrapGiven.rotation.y = poseGiven.rotY; wrapGiven.position.copy(poseGiven.offset); holderGiven.add(wrapGiven);
    return; }
  const quatAlign = new THREE.Quaternion().setFromUnitVectors(poseGiven.axisFrom, poseGiven.axisTo);
  holderGiven.quaternion.copy(quatAlign);
  const entryBat = HERO_ASSETS.weaponBat;
  const factorBat = (entryBat && entryBat.scale) || 0.72;
  const knobScaled = poseGiven.knobLocal.clone().multiplyScalar(factorBat);
  const knobTurned = knobScaled.applyQuaternion(quatAlign);
  holderGiven.position.copy(knobTurned).negate();
  holderGiven.add(wrapGiven); }
function vehicleCoords(vehicleGiven) {
  // Coordinates mirror the mesh, because the car module keeps
  // them in sync, and the mesh position is the fallback when
  // they are absent
  const ownOk = vehicleGiven && Number.isFinite(vehicleGiven.x) && Number.isFinite(vehicleGiven.z);
  if (ownOk) return { x: vehicleGiven.x, z: vehicleGiven.z, y: vehicleGiven.mesh ? vehicleGiven.mesh.position.y : 0 };
  const meshThere = vehicleGiven && vehicleGiven.mesh && vehicleGiven.mesh.position;
  if (meshThere) return { x: vehicleGiven.mesh.position.x, z: vehicleGiven.mesh.position.z, y: vehicleGiven.mesh.position.y };
  return null; }
const STAR_TEX_SIZE = 128;
function strokeSpokes(penGiven) {
  const listSpokes = [[52, 0], [-52, 0], [0, 52], [0, -52], [34, 34], [-34, -34], [34, -34], [-34, 34]];
  for (const [spokeX, spokeY] of listSpokes) {
    penGiven.beginPath(); penGiven.moveTo(64, 64); penGiven.lineTo((64 + spokeX), (64 + spokeY)); penGiven.stroke(); } }
function makeStarTexture() {
  const canvasBuilt = document.createElement('canvas'); canvasBuilt.width = STAR_TEX_SIZE; canvasBuilt.height = STAR_TEX_SIZE;
  const penGiven = canvasBuilt.getContext('2d');
  const gradGlow = penGiven.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradGlow.addColorStop(0, 'rgba(255,240,200,1)'); gradGlow.addColorStop(0.35, 'rgba(255,190,90,.75)'); gradGlow.addColorStop(1, 'rgba(255,150,40,0)');
  penGiven.fillStyle = gradGlow; penGiven.fillRect(0, 0, 128, 128);
  penGiven.strokeStyle = 'rgba(255,230,170,.9)'; penGiven.lineWidth = 5; penGiven.lineCap = 'round';
  strokeSpokes(penGiven);
  const texOut = new THREE.CanvasTexture(canvasBuilt); return texOut; }
function makeBoxMesh(wGiven, hGiven, dGiven, colourGiven, metalGiven) {
  const metalValue = (metalGiven == null) ? 0.6 : metalGiven;
  const matBuilt = new THREE.MeshStandardMaterial({ color: colourGiven, roughness: 0.45, metalness: metalValue });
  const meshOut = new THREE.Mesh(new THREE.BoxGeometry(wGiven, hGiven, dGiven), matBuilt); return meshOut; }
function addBoxPart(grpGiven, wGiven, hGiven, dGiven, colourGiven, metalGiven, pxGiven, pyGiven, pzGiven, rxGiven) {
  const partBuilt = makeBoxMesh(wGiven, hGiven, dGiven, colourGiven, metalGiven);
  partBuilt.position.set(pxGiven, pyGiven, pzGiven);
  if (rxGiven !== undefined) partBuilt.rotation.x = rxGiven;
  grpGiven.add(partBuilt);
  return partBuilt; }
function proceduralFor(slotGiven) {
  const grpOut = new THREE.Group();
  const toneDark = 0x1a1c20;
  if (slotGiven === 'pistol') {
    addBoxPart(grpOut, 0.055, 0.07, 0.24, toneDark, null, 0, 0.03, 0.05);
    addBoxPart(grpOut, 0.05, 0.13, 0.06, 0x111214, 0.3, 0, -0.05, -0.05, 0.25);
  } else if (slotGiven === 'smg') {
    addBoxPart(grpOut, 0.06, 0.09, 0.34, toneDark, null, 0, 0.02, 0.06, 0);
    addBoxPart(grpOut, 0.045, 0.16, 0.06, 0x24262b, null, 0, -0.08, 0.02, 0.15);
    const meshSuppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 }));
    meshSuppressor.rotation.x = (Math.PI / 2); meshSuppressor.position.set(0, 0.03, 0.29); grpOut.add(meshSuppressor);
  } else {
    const geoBat = new THREE.CylinderGeometry(0.032, 0.02, 0.85, 10);
    const meshBat = new THREE.Mesh(geoBat, new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 0.7, metalness: 0.05 }));
    meshBat.rotation.x = ((Math.PI / 2) + (-0.5)); meshBat.position.set(0, 0.12, 0.18); grpOut.add(meshBat); }
  return grpOut; }

// Closest approach between a ray and a segment, computed here
// The result carries the ray parameter plus the height of the
// closest segment point above its base, and a ray passing
// behind yields null
function raySegmentClosest(originGiven, dirGiven, segFrom, segTo) {
  const vecSeg = new THREE.Vector3().subVectors(segTo, segFrom);
  const offOrigin = new THREE.Vector3().subVectors(originGiven, segFrom);
  const coefA = dirGiven.dot(dirGiven), coefB = dirGiven.dot(vecSeg), coefC = vecSeg.dot(vecSeg), coefD = dirGiven.dot(offOrigin), coefE = vecSeg.dot(offOrigin);
  const denomValue = ((coefC * coefA) + (-(coefB * coefB)));
  let rayTQ = 0, segTQ = 0;
  if (Math.abs(denomValue) > 1e-8) {
    rayTQ = (((coefE * coefB) + (-(coefD * coefC))) / denomValue);
    segTQ = (((coefE * coefA) + (-(coefD * coefB))) / denomValue); }
  rayTQ = Math.max(0, rayTQ); segTQ = Math.min(1, Math.max(0, segTQ));
  const ptRay = new THREE.Vector3().copy(originGiven).addScaledVector(dirGiven, rayTQ);
  const ptSeg = new THREE.Vector3().copy(segFrom).addScaledVector(vecSeg, segTQ);
  const gapNow = ptRay.distanceTo(ptSeg);
  const recordHit = { t: rayTQ, dist: gapNow, h: (ptSeg.y + (-segFrom.y)), point: ptSeg };
  return recordHit; }

export function initWeapons(stateGiven) { try {
    const alreadyInit = !stateGiven || stateGiven.weapons;
    if (alreadyInit) return;
    const wHeld = {
      current: 'pistol',
      ammo: { pistol: { mag: 12, reserve: Infinity }, smg: { mag: 30, reserve: 240 }, bat: { mag: Infinity, reserve: Infinity } }, reloading: 0, equip };
    stateGiven.weapons = wHeld;
    const sHeld = { firing: false, semiLatch: false, cooldown: 0, autoShots: 0, lastEsc: -10, swingT: 0, flashLife: 0, hitMarkT: 0, held: {}, tracers: [], flatVehicles: new Set(), slotDirty: true };
    // Held models and their root on the figure
    const grpHeldRoot = new THREE.Group();
    grpHeldRoot.position.set(0.24, 1.02, 0.28);
    try { if (stateGiven.player && stateGiven.player.fig) stateGiven.player.fig.add(grpHeldRoot); } catch (ignoredFault) {}
    function hookSlotModel(slotGiven, grpGiven, holderGiven) {
      try {
        const wrapPending = loadHeroAsset(ASSET_FOR_SLOT[slotGiven]);
        const wrapIsPromise = wrapPending && (typeof wrapPending.then === 'function');
        if (!wrapIsPromise) return;
        wrapPending.then((wrapGiven) => {
          try {
            if (!wrapGiven) return;
            const snapshotChildren = [...grpGiven.children];
            snapshotChildren.forEach((childGiven) => { if (childGiven !== holderGiven) grpGiven.remove(childGiven); });
            seatInHolder(slotGiven, holderGiven, wrapGiven);
          } catch (ignoredFault) { /* procedural fallback stays */ }
        }).catch(() => {});
      } catch (ignoredFault) { /* procedural fallback stays */ } }
    ORDER_SLOTS.forEach((slotGiven) => {
      const grpQ = proceduralFor(slotGiven);
      grpQ.visible = false;
      grpHeldRoot.add(grpQ);
      sHeld.held[slotGiven] = grpQ;
      const holderQ = new THREE.Group();
      holderQ.name = 'glbHolder:' + slotGiven;
      grpQ.add(holderQ);
      hookSlotModel(slotGiven, grpQ, holderQ); });
    // Muzzle flash visuals
    const grpFlash = new THREE.Group();
    try {
      const texStar = makeStarTexture();
      const matFlash = new THREE.MeshBasicMaterial({ map: texStar, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffc873 });
      const planeFlashOne = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), matFlash);
      const planeFlashTwo = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), matFlash);
      planeFlashTwo.rotation.z = (Math.PI / 4); planeFlashTwo.rotation.y = (Math.PI / 2);
      grpFlash.add(planeFlashOne); grpFlash.add(planeFlashTwo);
      const glowFlash = glowSprite(0xffc873, 1.6); grpFlash.add(glowFlash);
    } catch (ignoredFault) {}
    const lightFlash = new THREE.PointLight(0xffc873, 0, 18);
    grpFlash.add(lightFlash);
    grpFlash.visible = false;
    try { stateGiven.scene.add(grpFlash); } catch (ignoredFault) {}
    for (let idxTracer = 0; idxTracer < 4; idxTracer++) {
      const meshTracer = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      meshTracer.visible = false;
      try { stateGiven.scene.add(meshTracer); } catch (ignoredFault) {}
      sHeld.tracers.push({ mesh: meshTracer, life: 0 }); }
    let nextTracer = 0;
    // HUD pieces owned by this layer
    let elCross = null, elPanel = null, elName = null, elAmmo = null;
    try {
      const elStyle = document.createElement('style');
      elStyle.textContent =
        '#crosshair{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:60;mix-blend-mode:difference;display:none}' +
        '#crosshair .ring{position:absolute;inset:0;border:2px solid #fff;border-radius:50%;opacity:.85}' + '#crosshair .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%}' + '#crosshair.hit .ring{border-color:#ff9a2a}#crosshair.hit .dot{background:#ff9a2a}' + '#crosshair.bat .ring{display:none}';
      document.head.appendChild(elStyle);
      elCross = document.createElement('div'); elCross.id = 'crosshair';
      elCross.innerHTML = '<div class="ring"></div><div class="dot"></div>';
      document.body.appendChild(elCross);
      elPanel = document.createElement('div'); elPanel.id = 'weaponSlot';
      elPanel.style.cssText = 'position:fixed;right:236px;bottom:18px;z-index:60;background:rgba(8,12,20,.72);border:1px solid rgba(0,245,212,.35);border-radius:12px;padding:8px 12px;font-family:system-ui,sans-serif;color:#e8f6ff;pointer-events:none;min-width:118px;text-align:right';
      elPanel.innerHTML = '<div id="wsName" style="font-size:11px;letter-spacing:.14em;color:#00f5d4"></div>' + '<div id="wsAmmo" style="font-size:22px;font-weight:700;line-height:1.15"></div>' +
        '<div style="font-size:10px;opacity:.65">[1][2][3] &middot; R reload</div>';
      document.body.appendChild(elPanel);
      elName = elPanel.querySelector('#wsName');
      elAmmo = elPanel.querySelector('#wsAmmo');
    } catch (ignoredFault) { /* the HUD here is best effort */ }
    function ammoLabelNow() {
      const ammoQ = wHeld.ammo[wHeld.current];
      const specQ = WEAPON_TABLE[wHeld.current];
      if (specQ.melee) return '\u221E';
      const reserveShown = (ammoQ.reserve === Infinity) ? '\u221E' : ammoQ.reserve;
      const labelOut = (ammoQ.mag + ' / ' + reserveShown);
      return labelOut; }
    function paintHud() {
      if (!sHeld.slotDirty) return;
      sHeld.slotDirty = false;
      try {
        const suffixReload = (wHeld.reloading > 0) ? ' \u00B7 RELOADING' : '';
        if (elName) elName.textContent = (WEAPON_TABLE[wHeld.current].name + suffixReload);
        if (elAmmo) elAmmo.textContent = ammoLabelNow();
        if (elCross) elCross.className = ((wHeld.current === 'bat' ? 'bat' : '') + (sHeld.hitMarkT > 0 ? ' hit' : ''));
      } catch (ignoredFault) {} }
    function equip(slotGiven) {
      if (!WEAPON_TABLE[slotGiven]) return;
      wHeld.current = slotGiven; wHeld.reloading = 0; sHeld.slotDirty = true;
      ORDER_SLOTS.forEach((keyGiven) => { if (sHeld.held[keyGiven]) sHeld.held[keyGiven].visible = (keyGiven === slotGiven); });
      paintHud(); }
    // Small shared helpers first
    function originShooter() {
      if (stateGiven.car) { const coordsCar = vehicleCoords(stateGiven.car); if (coordsCar) return coordsCar; }
      if (stateGiven.player) return { x: stateGiven.player.x, z: stateGiven.player.z, y: 0 };
      return { x: 0, z: 0, y: 0 }; }
    function positionMuzzle() {
      try {
        if (stateGiven.car && stateGiven.car.mesh) return stateGiven.car.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
        const playerQ = stateGiven.player; if (!playerQ) return new THREE.Vector3();
        const headQ = (playerQ.angle || 0);
        const groundQ = groundH(playerQ.x, playerQ.z);
        const fwdX = (0.35 * Math.sin(headQ)), sideX = (0.18 * Math.cos(headQ));
        const fwdZ = (0.35 * Math.cos(headQ)), sideZ = (0.18 * Math.sin(headQ));
        const vecMuzzle = new THREE.Vector3((playerQ.x + (fwdX + sideX)), (groundQ + 1.32), (playerQ.z + (fwdZ + (-sideZ))));
        return vecMuzzle;
      } catch (ignoredFault) { return new THREE.Vector3(); } }
    function emitSfx(sfxGiven) { try { const audioQ = stateGiven.audio; if (audioQ && audioQ.play) audioQ.play(sfxGiven); } catch (ignoredFault) {} }
    function bumpWanted(amountGiven) {
      try {
        const stampQ = (stateGiven.elapsed || 0);
        if ((stampQ + (-sHeld.lastEsc)) < 0.4) return;
        sHeld.lastEsc = stampQ;
        stateGiven.wanted = Math.min(5, Math.max(0, ((stateGiven.wanted || 0) + amountGiven)));
      } catch (ignoredFault) {} }
    function anyWitness(rangeCop, rangePed, fromX, fromZ) {
      try {
        const copsQ = (stateGiven.cops || []);
        for (const carCop of copsQ) { const coordsCop = vehicleCoords(carCop); if (coordsCop && (Math.hypot((coordsCop.x + (-fromX)), (coordsCop.z + (-fromZ))) < rangeCop)) return true; }
        const pedsQ = (stateGiven.peds || []);
        for (const pedQ of pedsQ) { if (!pedQ.downed && (Math.hypot((pedQ.x + (-fromX)), (pedQ.z + (-fromZ))) < rangePed)) return true; }
      } catch (ignoredFault) {}
      return false; }
    function startFlee(pedGiven, fromX, fromZ, spanGiven) {
      const awayX = (pedGiven.x + (-fromX)), awayZ = (pedGiven.z + (-fromZ));
      const lenAway = (Math.hypot(awayX, awayZ) || 1);
      pedGiven.fleeDir = { x: (awayX / lenAway), z: (awayZ / lenAway) };
      pedGiven.fleeT = spanGiven; }
    function disperseCrowd(fromX, fromZ, rangeGiven, loGiven, hiGiven, oddsGiven) {
      try {
        const pedsQ = (stateGiven.peds || []);
        pedsQ.forEach((pedQ) => {
          if (pedQ.downed) return;
          const insideRange = (Math.hypot((pedQ.x + (-fromX)), (pedQ.z + (-fromZ))) < rangeGiven);
          const oddsPass = (oddsGiven == null) || chance(oddsGiven);
          if (insideRange && oddsPass) startFlee(pedQ, fromX, fromZ, rr(loGiven, hiGiven)); });
      } catch (ignoredFault) {} }
    function floorPed(pedGiven) {
      pedGiven.downed = true; pedGiven.downedT = rr(6, 10); pedGiven._tipped = true; pedGiven.fleeT = 0;
      try {
        pedGiven.fig.rotation.x = -1.35;
        pedGiven.fig.position.y = (groundH(pedGiven.x, pedGiven.z) + 0.15);
      } catch (ignoredFault) {} }
    function woundPed(pedGiven, damageGiven, flagBat, fromX, fromZ) {
      if (pedGiven.hp == null) pedGiven.hp = 100;
      pedGiven.hp -= damageGiven;
      const pedFell = !(pedGiven.hp > 0);
      if (pedFell || flagBat) { floorPed(pedGiven); return true; }
      startFlee(pedGiven, fromX, fromZ, 1.6);
      return false; }
    function flashAt(posGiven) {
      try {
        grpFlash.position.copy(posGiven);
        grpFlash.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        grpFlash.visible = true; lightFlash.intensity = 26; sHeld.flashLife = 0.05;
      } catch (ignoredFault) {} }
    function drawTracer(fromGiven, toGiven) {
      const slotTracer = sHeld.tracers[nextTracer++ % sHeld.tracers.length];
      if (!slotTracer) return;
      const lenSpan = fromGiven.distanceTo(toGiven);
      if (!(lenSpan >= 0.5)) return;
      const vecMid = new THREE.Vector3().copy(fromGiven).add(toGiven).multiplyScalar(0.5);
      slotTracer.mesh.position.copy(vecMid);
      slotTracer.mesh.lookAt(toGiven);
      slotTracer.mesh.scale.set(1, 1, lenSpan);
      slotTracer.mesh.material.opacity = 0.85; slotTracer.mesh.visible = true; slotTracer.life = 0.04; }

    // Firing paths: reload, then bat swing, then hitscan shot
    function beginReload() {
      const specQ = WEAPON_TABLE[wHeld.current];
      const ammoQ = wHeld.ammo[wHeld.current];
      const haltReload = specQ.melee || (wHeld.reloading > 0);
      if (haltReload) return;
      const magFull = (ammoQ.mag >= specQ.mag);
      const reserveEmpty = !(ammoQ.reserve > 0);
      if (magFull || reserveEmpty) return;
      wHeld.reloading = specQ.reload; sHeld.slotDirty = true; emitSfx('reload'); }
    function batSwing() {
      const specBat = WEAPON_TABLE.bat;
      sHeld.swingT = 0.22; emitSfx('swing');
      const srcQ = originShooter();
      const headQ = stateGiven.car ? (stateGiven.car.angle || 0) : (stateGiven.player ? (stateGiven.player.angle || 0) : 0);
      const faceX = Math.sin(headQ), faceZ = Math.cos(headQ);
      let hitAny = false;
      try {
        const pedsQ = (stateGiven.peds || []);
        pedsQ.forEach((pedQ) => {
          if (pedQ.downed) return;
          const offX = (pedQ.x + (-srcQ.x)), offZ = (pedQ.z + (-srcQ.z));
          const distQ = Math.hypot(offX, offZ);
          const reachOk = !(distQ > specBat.range) && (distQ > 0.001);
          const dotFacing = (((offX / distQ) * faceX) + ((offZ / distQ) * faceZ));
          if (reachOk && (dotFacing > 0.4)) { woundPed(pedQ, specBat.dmg, true, srcQ.x, srcQ.z); hitAny = true; } });
      } catch (ignoredFault) {}
      try {
        const vehiclesQ = [...(stateGiven.vehicles || []), ...(stateGiven.cops || []), ...(stateGiven.traffic || [])];
        vehiclesQ.forEach((vehQ) => {
          if (stateGiven.car && (vehQ === stateGiven.car)) return;
          const coordsVeh = vehicleCoords(vehQ); if (!coordsVeh) return;
          const gapVeh = Math.hypot((coordsVeh.x + (-srcQ.x)), (coordsVeh.z + (-srcQ.z)));
          if (gapVeh > (specBat.range + 1.2)) return;
          try { damageVehicle(stateGiven, vehQ, specBat.dmg); } catch (ignoredFault) {}
          hitAny = true;
          let copNear = false;
          const copsQ = (stateGiven.cops || []);
          for (const carCop of copsQ) { const coordsCop = vehicleCoords(carCop); if (coordsCop && (Math.hypot((coordsCop.x + (-coordsVeh.x)), (coordsCop.z + (-coordsVeh.z))) < 25)) { copNear = true; break; } }
          if (copNear) bumpWanted(0.4); });
      } catch (ignoredFault) {}
      if (hitAny) {
        emitSfx('thud'); disperseCrowd(srcQ.x, srcQ.z, 6, 1.2, 2.2, 0.4);
        sHeld.hitMarkT = 0.09; sHeld.slotDirty = true; } }
    function fallbackPoint(groundGiven, originGiven, dirGiven, specGiven) {
      if (groundGiven) return groundGiven;
      const ptFar = new THREE.Vector3().copy(originGiven).addScaledVector(dirGiven, specGiven.range);
      return ptFar; }
    function wheelShareFwd(fwdGiven, lenGiven, signGiven) { const shareOut = (((0.32 * lenGiven) * signGiven) * fwdGiven); return shareOut; }
    function probePeds(rayFromQ, rayDirQ, probeQ) {
      try {
        const pedsQ = (stateGiven.peds || []);
        pedsQ.forEach((pedQ) => {
          if (pedQ.downed) return;
          const baseYQ = groundH(pedQ.x, pedQ.z);
          const segLoQ = new THREE.Vector3(pedQ.x, (baseYQ + 0.2), pedQ.z);
          const segHiQ = new THREE.Vector3(pedQ.x, (baseYQ + 1.6), pedQ.z);
          const probeHit = raySegmentClosest(rayFromQ, rayDirQ, segLoQ, segHiQ);
          const probeCounts = probeHit && (probeHit.dist < 0.42) && (probeHit.t < probeQ.nearestT);
          if (probeCounts) { probeQ.nearestT = probeHit.t; probeQ.nearestHit = { kind: 'ped', ped: pedQ, point: probeHit.point, head: (probeHit.h > 1.45) }; } });
      } catch (ignoredFault) {} }
    function probeVehicles(rayFromQ, rayDirQ, probeQ) {
      try {
        const vehiclesQ = [...(stateGiven.vehicles || []), ...(stateGiven.cops || []), ...(stateGiven.traffic || [])];
        vehiclesQ.forEach((vehQ) => {
          if (stateGiven.car && (vehQ === stateGiven.car)) return;
          const coordsVeh = vehicleCoords(vehQ); if (!coordsVeh) return;
          const specVeh = (vehQ.spec || {});
          const radiusHit = ((Math.max((specVeh.len || 4), (specVeh.wid || 1.8)) / 2) * 0.9);
          const vecCentre = new THREE.Vector3(coordsVeh.x, ((coordsVeh.y || groundH(coordsVeh.x, coordsVeh.z)) + 0.55), coordsVeh.z);
          const vecRel = new THREE.Vector3().subVectors(rayFromQ, vecCentre);
          const projValue = vecRel.dot(rayDirQ);
          const restValue = (vecRel.lengthSq() + (-(radiusHit * radiusHit)));
          const discValue = ((projValue * projValue) + (-restValue));
          if (discValue < 0) return;
          const hitTQ = ((-projValue) + (-Math.sqrt(discValue)));
          const hitCounts = (hitTQ > 0) && (hitTQ < probeQ.nearestT);
          if (hitCounts) {
            probeQ.nearestT = hitTQ;
            probeQ.nearestHit = { kind: 'vehicle', v: vehQ, point: new THREE.Vector3().copy(rayFromQ).addScaledVector(rayDirQ, hitTQ) }; } });
      } catch (ignoredFault) {} }
    function probeWheel(hitGiven, coordsVeh, vehicleGiven) {
      try {
        const specVeh = (vehicleGiven.spec || {});
        const lenQ = (specVeh.len || 4), widQ = (specVeh.wid || 1.8);
        const headingVeh = (vehicleGiven.angle || 0);
        const fwdX = Math.sin(headingVeh), fwdZ = Math.cos(headingVeh), sideX = Math.cos(headingVeh), sideZ = -Math.sin(headingVeh);
        const lowOk = ((hitGiven.point.y + (-groundH(coordsVeh.x, coordsVeh.z))) < 0.45);
        if (!lowOk) return;
        for (const signAQ of [1, -1]) for (const signBQ of [1, -1]) {
          const wheelX = ((coordsVeh.x + (((0.32 * lenQ) * signAQ) * fwdX)) + (((widQ / 2) * signBQ) * sideX));
          const wheelZ = ((coordsVeh.z + wheelShareFwd(fwdZ, lenQ, signAQ)) + (((widQ / 2) * signBQ) * sideZ));
          const gapWheel = Math.hypot((hitGiven.point.x + (-wheelX)), (hitGiven.point.z + (-wheelZ)));
          if (gapWheel < 0.45) { vehicleGiven.tireFlat = 5; sHeld.flatVehicles.add(vehicleGiven); break; } }
      } catch (ignoredFault) {} }
    function shotFire() {
      const slotQ = wHeld.current;
      const specQ = WEAPON_TABLE[slotQ];
      const ammoQ = wHeld.ammo[slotQ];
      if (!(ammoQ.mag > 0)) {
        if (ammoQ.reserve > 0) { beginReload(); }
        else { emitSfx('dry'); try { if (stateGiven.toast) stateGiven.toast('Out of ammo'); } catch (ignoredFault) {} }
        return; }
      ammoQ.mag--; sHeld.slotDirty = true;
      emitSfx((slotQ === 'smg') ? 'smg' : 'shot');
      if (!stateGiven.car && stateGiven.player) { try { stateGiven.player.angle = stateGiven.camYaw; } catch (ignoredFault) {} }
      const rayFromQ = new THREE.Vector3();
      const rayDirQ = new THREE.Vector3();
      try {
        stateGiven.camera.getWorldPosition(rayFromQ); stateGiven.camera.getWorldDirection(rayDirQ);
      } catch (ignoredFault) { return; }
      if (specQ.spread > 0) {
        const upPickQ = (Math.abs(rayDirQ.y) > 0.9) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const axisAQ = new THREE.Vector3().crossVectors(rayDirQ, upPickQ).normalize();
        const axisBQ = new THREE.Vector3().crossVectors(rayDirQ, axisAQ).normalize();
        rayDirQ.addScaledVector(axisAQ, rr(-specQ.spread, specQ.spread)).addScaledVector(axisBQ, rr(-specQ.spread, specQ.spread)).normalize(); }
      const vecMuzzle = positionMuzzle();
      flashAt(vecMuzzle);
      const srcQ = originShooter();
      const probeQ = { nearestT: specQ.range, nearestHit: null };
      probePeds(rayFromQ, rayDirQ, probeQ);
      probeVehicles(rayFromQ, rayDirQ, probeQ);
      let vecGround = null;
      if (rayDirQ.y < -0.001) {
        const groundTQ = ((-rayFromQ.y) / rayDirQ.y);
        const groundCounts = (groundTQ > 0) && !(groundTQ > specQ.range);
        if (groundCounts) vecGround = new THREE.Vector3().copy(rayFromQ).addScaledVector(rayDirQ, groundTQ); }
      const vecEnd = probeQ.nearestHit ? probeQ.nearestHit.point : fallbackPoint(vecGround, rayFromQ, rayDirQ, specQ);
      drawTracer(vecMuzzle, vecEnd);
      let crimeQ = false;
      const hitQ = probeQ.nearestHit;
      if (hitQ && (hitQ.kind === 'ped')) {
        const dmgDoneQ = (specQ.dmg * (hitQ.head ? 2 : 1));
        woundPed(hitQ.ped, dmgDoneQ, false, srcQ.x, srcQ.z);
        sHeld.hitMarkT = 0.09; sHeld.slotDirty = true;
        bumpWanted(0.5); crimeQ = true;
        disperseCrowd(hitQ.ped.x, hitQ.ped.z, 14, 1.2, 2.2, null);
      } else if (hitQ && (hitQ.kind === 'vehicle')) {
        const vehHitQ = hitQ.v;
        try { damageVehicle(stateGiven, vehHitQ, specQ.dmg); } catch (ignoredFault) {}
        try { spawnSmokeAt(stateGiven, hitQ.point, 2, false); } catch (ignoredFault) {}
        sHeld.hitMarkT = 0.09; sHeld.slotDirty = true;
        const coordsVeh = vehicleCoords(vehHitQ);
        if (coordsVeh) probeWheel(hitQ, coordsVeh, vehHitQ);
        const copsQ = (stateGiven.cops || []);
        const copHit = (vehHitQ.driver === 'cop') || copsQ.includes(vehHitQ);
        if (copHit) { bumpWanted(0.8); crimeQ = true; }
      } else if (vecGround && (!hitQ || !(probeQ.nearestT < specQ.range))) {
        try { spawnSmokeAt(stateGiven, vecGround, 2, false); } catch (ignoredFault) {} }
      if (!crimeQ) {
        sHeld.autoShots++;
        const threshQ = (sHeld.autoShots >= 5) || !specQ.auto;
        if (threshQ) {
          sHeld.autoShots = 0;
          if (anyWitness(70, 30, srcQ.x, srcQ.z)) bumpWanted(0.25); } }
      try { const heldQ = sHeld.held[slotQ]; if (heldQ) heldQ.position.z = -0.03; } catch (ignoredFault) {} }
    function attemptFire() {
      const haltFire = (stateGiven.mode !== 'play') || stateGiven.paused;
      if (haltFire) return;
      if ((wHeld.reloading > 0) || (sHeld.cooldown > 0)) return;
      const specQ = WEAPON_TABLE[wHeld.current];
      sHeld.cooldown = specQ.interval;
      if (specQ.melee) batSwing(); else shotFire(); }
    // Pointer and keyboard input
    const elCanvas = stateGiven.canvas || (stateGiven.renderer && stateGiven.renderer.domElement) || null;
    function onPointerDown(eventGiven) {
      if (eventGiven.button !== 0) return;
      const haltInput = (stateGiven.mode !== 'play') || stateGiven.paused;
      if (haltInput) return;
      sHeld.firing = true;
      const specQ = WEAPON_TABLE[wHeld.current];
      if (!specQ.auto) {
        if (!sHeld.semiLatch) { sHeld.semiLatch = true; attemptFire(); }
      } else attemptFire(); }
    function onPointerUp(eventGiven) { if (eventGiven.button === 0) { sHeld.firing = false; sHeld.semiLatch = false; } }
    try {
      if (elCanvas && elCanvas.addEventListener) elCanvas.addEventListener('pointerdown', onPointerDown);
      else if (typeof window !== 'undefined') window.addEventListener('pointerdown', onPointerDown);
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('blur', onPointerUp); }
    } catch (ignoredFault) {}
    function onWeaponKey(eventGiven) {
      const haltInput = (stateGiven.mode !== 'play') || stateGiven.paused;
      if (haltInput) return;
      const codeQ = eventGiven.code;
      const mapSlots = { 'Digit1': 'pistol', 'Digit2': 'smg', 'Digit3': 'bat' };
      if (mapSlots[codeQ]) equip(mapSlots[codeQ]);
      else if (codeQ === 'KeyQ') {
        const idxQ = ORDER_SLOTS.indexOf(wHeld.current);
        equip(ORDER_SLOTS[(idxQ + 1) % ORDER_SLOTS.length]);
      } else if (codeQ === 'KeyR') beginReload(); }
    try { window.addEventListener('keydown', onWeaponKey); } catch (ignoredFault) {}
    equip('pistol');

    // Per frame updater for this layer
    function finishReload() {
      if (!(wHeld.reloading > 0)) return;
      wHeld.reloading = 0;
      const specQ = WEAPON_TABLE[wHeld.current];
      const ammoQ = wHeld.ammo[wHeld.current];
      const roundsWanted = (specQ.mag + (-ammoQ.mag));
      const roundsMoved = (ammoQ.reserve === Infinity) ? roundsWanted : Math.min(roundsWanted, ammoQ.reserve);
      ammoQ.mag += roundsMoved;
      if (ammoQ.reserve !== Infinity) ammoQ.reserve -= roundsMoved;
      sHeld.slotDirty = true; }
    function stepFlash(stateAlt) {
      const forcedQ = stateAlt.flags && stateAlt.flags.forceFlash;
      if (forcedQ) {
        try {
          let atFlash = null;
          const carFlashOk = (forcedQ === 'car') && stateAlt.flags.flashCar && stateAlt.flags.flashCar.mesh;
          if (carFlashOk) atFlash = stateAlt.flags.flashCar.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
          else atFlash = positionMuzzle();
          grpFlash.position.copy(atFlash); grpFlash.visible = true; lightFlash.intensity = 26;
        } catch (ignoredFault) {}
      } else if (sHeld.flashLife > 0) {
        sHeld.flashLife -= dtLastHeld;
        lightFlash.intensity = (26 * Math.max(0, (sHeld.flashLife / 0.05)));
        if (!(sHeld.flashLife > 0)) { grpFlash.visible = false; lightFlash.intensity = 0; }
      } else if (grpFlash.visible) { grpFlash.visible = false; lightFlash.intensity = 0; } }
    let dtLastHeld = 0;
    function stepTracers(dtGiven) {
      for (const slotTracer of sHeld.tracers) {
        if (!(slotTracer.life > 0)) continue;
        slotTracer.life -= dtGiven;
        slotTracer.mesh.material.opacity = (0.85 * Math.max(0, (slotTracer.life / 0.04)));
        if (!(slotTracer.life > 0)) slotTracer.mesh.visible = false; } }
    function stepFlat(dtGiven) {
      if (!sHeld.flatVehicles.size) return;
      const snapshotFlat = [...sHeld.flatVehicles];
      for (const vehQ of snapshotFlat) {
        try {
          if (vehQ.tireFlat > 0) { vehQ.tireFlat -= dtGiven; if (vehQ.mesh) vehQ.mesh.rotation.z = 0.03; }
          else { if (vehQ.mesh) vehQ.mesh.rotation.z = 0; sHeld.flatVehicles.delete(vehQ); }
        } catch (ignoredFault) { sHeld.flatVehicles.delete(vehQ); } } }
    function stepHeld(stateAlt, dtGiven) {
      const onFootQ = !stateAlt.car && (stateAlt.mode === 'play');
      const parentWrong = (grpHeldRoot.parent !== (stateAlt.player && stateAlt.player.fig));
      if (parentWrong) { try { if (stateAlt.player && stateAlt.player.fig) stateAlt.player.fig.add(grpHeldRoot); } catch (ignoredFault) {} }
      grpHeldRoot.visible = !!onFootQ;
      const heldQ = sHeld.held[wHeld.current];
      if (!heldQ) return;
      heldQ.position.z += ((0 + (-heldQ.position.z)) * Math.min(1, (14 * dtGiven)));
      const batCurrent = (wHeld.current === 'bat');
      if (!batCurrent) return;
      if (sHeld.swingT > 0) {
        sHeld.swingT -= dtGiven;
        const shareSwing = (1 + (-(Math.max(0, sHeld.swingT) / 0.22)));
        const swingEarly = (shareSwing < 0.55);
        heldQ.rotation.x = swingEarly ? (-0.4 + (-(1.5 * (shareSwing / 0.55)))) : (-1.9 + (1.5 * ((shareSwing + (-0.55)) / 0.45)));
      } else heldQ.rotation.x = -0.4; }
    stateGiven.updaters.push((stateAlt, dtGiven) => { try {
        dtLastHeld = dtGiven;
        if (sHeld.cooldown > 0) sHeld.cooldown -= dtGiven;
        if (wHeld.reloading > 0) { wHeld.reloading -= dtGiven; if (!(wHeld.reloading > 0)) finishReload(); }
        const specCurrent = WEAPON_TABLE[wHeld.current];
        if (sHeld.firing && specCurrent.auto) attemptFire();
        if (sHeld.hitMarkT > 0) { sHeld.hitMarkT -= dtGiven; if (!(sHeld.hitMarkT > 0)) sHeld.slotDirty = true; }
        stepHeld(stateAlt, dtGiven);
        stepFlash(stateAlt);
        stepTracers(dtGiven);
        stepFlat(dtGiven);
        try {
          if (elCross) elCross.style.display = ((stateAlt.mode === 'play') && !stateAlt.paused) ? 'block' : 'none';
          if (elPanel) elPanel.style.display = (stateAlt.mode === 'play') ? 'block' : 'none';
        } catch (ignoredFault) {}
        paintHud();
      } catch (ignoredFault) { /* this layer must never break the loop */ } });
  } catch (outerFault) {
    try { if (stateGiven && !stateGiven.weapons) stateGiven.weapons = null; } catch (ignoredFault) {} } }
