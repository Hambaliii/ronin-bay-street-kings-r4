import * as THREE from 'three';
import { rr, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { damageVehicle, spawnSmokeAt } from './cars.js';
import { loadHeroAsset, HERO_ASSETS } from './assets.js';
// Combat layer, self contained: a bat, a pistol and a micro
// SMG share this single module
// Nothing outside reaches in except through guarded hooks on
// the shared game state, so dropping the init call restores
// the older unarmed behaviour wholesale
// Real model files can replace the shapes built here; until
// one loads, the procedural stand-ins below keep working
// quietly
export const WEAPON_TABLE = {};
function registerWeapon(slotKey, specHeld) { WEAPON_TABLE[slotKey] = specHeld; }
registerWeapon('bat', { name: 'BASEBALL BAT', dmg: 55, interval: 0.55,
  auto: false, mag: Infinity, reload: 0, range: 2.4, melee: true });
registerWeapon('smg', { name: 'MICRO SMG', dmg: 15, interval: 0.085,
  auto: true, mag: 30, reload: 1.3, range: 110, spread: 0.02 });
registerWeapon('pistol', { name: 'PISTOL', dmg: 34, interval: 0.34,
  auto: false, mag: 12, reload: 0.9, range: 130, spread: 0.006 });
const SLOT_ORDER = ['pistol', 'smg', 'bat'];
const SLOT_ASSET_MAP = { pistol: 'weaponPistol', smg: 'weaponSmg', bat: 'weaponBat' };
// Orientation notes: the vendor models agree with none of
// the axes this game uses
// The grip root on the figure faces forward, and the pose
// table further down twists each model inside its own holder
// to match that root
// Procedural parts are never adjusted, which keeps the
// fallback exact when a model is missing, and the SMG mirror
// stays a one-constant edit
const SMG_YAW_FLIP = Math.PI;
export const WEAPON_POSE = {};
WEAPON_POSE.bat = { axisFrom: new THREE.Vector3(-0.775, -0.631, 0.001).normalize(), axisTo: new THREE.Vector3(0, -0.75, 0.66).normalize(),
  knobLocal: new THREE.Vector3(-0.49, 0.02, 0) };
WEAPON_POSE.smg = { rotY: SMG_YAW_FLIP, offset: new THREE.Vector3(0, -0.13, 0.03) };
WEAPON_POSE.pistol = { rotY: -Math.PI / 2, offset: new THREE.Vector3(0, -0.10, -0.02) };
// A loaded model sits inside an oriented holder, and that
// holder sits inside the per-weapon group
// Recoil nudges the group and the bat swing rotates it, so
// the model rides both motions exactly like the procedural
// mesh did
function batScaleNow() {
  const batEntryHeld = HERO_ASSETS.weaponBat;
  const scaleHeld = (batEntryHeld && batEntryHeld.scale) || 0.72;
  return scaleHeld; }
function mountBat(poseHeld, holderHeld, modelWrap) {
  const alignHeld = new THREE.Quaternion().setFromUnitVectors(poseHeld.axisFrom, poseHeld.axisTo);
  holderHeld.quaternion.copy(alignHeld);
  const knobLong = poseHeld.knobLocal.clone().multiplyScalar(batScaleNow());
  const knobPlaced = knobLong.applyQuaternion(alignHeld);
  holderHeld.position.copy(knobPlaced).negate();
  holderHeld.add(modelWrap); }
function mountGun(poseHeld, holderHeld, modelWrap) {
  modelWrap.rotation.y = poseHeld.rotY;
  modelWrap.position.copy(poseHeld.offset);
  holderHeld.add(modelWrap); }
function seatModel(slotKey, holderHeld, modelWrap) {
  const poseHeld = WEAPON_POSE[slotKey];
  if (!poseHeld) { holderHeld.add(modelWrap); return; }
  const isBatSlot = !(slotKey !== 'bat');
  if (isBatSlot) mountBat(poseHeld, holderHeld, modelWrap);
  else mountGun(poseHeld, holderHeld, modelWrap); }
function coordsOfVehicle(vehHeld) {
  // The car module mirrors its coordinates onto the record,
  // and the mesh position covers the cases where they are
  // absent
  const hasOwnPair = vehHeld && Number.isFinite(vehHeld.x) && Number.isFinite(vehHeld.z);
  if (hasOwnPair) { const yFromMesh = vehHeld.mesh ? vehHeld.mesh.position.y : 0;
    return { x: vehHeld.x, z: vehHeld.z, y: yFromMesh }; }
  const meshPos = vehHeld && vehHeld.mesh && vehHeld.mesh.position;
  if (meshPos) { return { x: vehHeld.mesh.position.x, z: vehHeld.mesh.position.z, y: vehHeld.mesh.position.y }; }
  return null; }
const STAR_PX = 128;
function drawSpokes(penHeld) {
  const spokeList = [[52, 0], [-52, 0], [0, 52], [0, -52], [34, 34], [-34, -34], [34, -34], [-34, 34]];
  for (const [dxHeld, dyHeld] of spokeList) {
    penHeld.beginPath(); penHeld.moveTo(64, 64); penHeld.lineTo((64 + dxHeld), (64 + dyHeld)); penHeld.stroke(); } }
function paintGlowBase(penHeld) {
  const glowGrad = penHeld.createRadialGradient(64, 64, 2, 64, 64, 64);
  glowGrad.addColorStop(0, 'rgba(255,240,200,1)');
  glowGrad.addColorStop(0.35, 'rgba(255,190,90,.75)');
  glowGrad.addColorStop(1, 'rgba(255,150,40,0)');
  penHeld.fillStyle = glowGrad; penHeld.fillRect(0, 0, 128, 128);
  penHeld.strokeStyle = 'rgba(255,230,170,.9)'; penHeld.lineWidth = 5; penHeld.lineCap = 'round'; }
function buildStarTexture() {
  const starCv = document.createElement('canvas');
  starCv.width = STAR_PX;
  starCv.height = STAR_PX;
  const starCtx = starCv.getContext('2d');
  paintGlowBase(starCtx);
  drawSpokes(starCtx);
  return new THREE.CanvasTexture(starCv); }
function makeBoxMaterial(toneHeld, metalHeld) {
  const metalUsed = (metalHeld == null) ? 0.6 : metalHeld;
  return new THREE.MeshStandardMaterial({ color: toneHeld, roughness: 0.45, metalness: metalUsed }); }
function buildBoxMesh(wHeld, hHeld, dHeld, toneHeld, metalHeld) {
  return new THREE.Mesh(new THREE.BoxGeometry(wHeld, hHeld, dHeld), makeBoxMaterial(toneHeld, metalHeld)); }
function attachBoxPart(grpHeld, wHeld, hHeld, dHeld, toneHeld, metalHeld, pxHeld, pyHeld, pzHeld, rxHeld) {
  const partHeld = buildBoxMesh(wHeld, hHeld, dHeld, toneHeld, metalHeld);
  partHeld.position.set(pxHeld, pyHeld, pzHeld);
  const hasTilt = !(rxHeld === undefined);
  if (hasTilt) partHeld.rotation.x = rxHeld;
  grpHeld.add(partHeld);
  return partHeld; }
function shapePistol(grpHeld, darkTone) {
  attachBoxPart(grpHeld, 0.055, 0.07, 0.24, darkTone, null, 0, 0.03, 0.05);
  attachBoxPart(grpHeld, 0.05, 0.13, 0.06, 0x111214, 0.3, 0, -0.05, -0.05, 0.25); }
function shapeSmg(grpHeld, darkTone) {
  attachBoxPart(grpHeld, 0.06, 0.09, 0.34, darkTone, null, 0, 0.02, 0.06, 0);
  attachBoxPart(grpHeld, 0.045, 0.16, 0.06, 0x24262b, null, 0, -0.08, 0.02, 0.15);
  const canHeld = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 10), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 }));
  canHeld.rotation.x = (Math.PI / 2); canHeld.position.set(0, 0.03, 0.29); grpHeld.add(canHeld); }
function shapeBat(grpHeld) {
  const batGeo = new THREE.CylinderGeometry(0.032, 0.02, 0.85, 10);
  const batHeld = new THREE.Mesh(batGeo, new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 0.7, metalness: 0.05 }));
  batHeld.rotation.x = ((Math.PI / 2) + (-0.5)); batHeld.position.set(0, 0.12, 0.18); grpHeld.add(batHeld); }
function proceduralShapeFor(slotKey) {
  const grpHeld = new THREE.Group();
  const darkTone = 0x1a1c20;
  const buildersBySlot = { pistol: () => shapePistol(grpHeld, darkTone), smg: () => shapeSmg(grpHeld, darkTone), bat: () => shapeBat(grpHeld) };
  const builderHeld = buildersBySlot[slotKey];
  if (builderHeld) builderHeld();
  return grpHeld; }

// Nearest approach of a ray to a segment, worked out locally
// The record handed back holds the ray parameter, the gap at
// the closest point and how high that segment point sits over
// its base; a ray pointing away still yields its clamped
// record
function closestRaySegment(originHeld, dirHeld, segFrom, segTo) {
  const segVec = new THREE.Vector3().subVectors(segTo, segFrom);
  const originVec = new THREE.Vector3().subVectors(originHeld, segFrom);
  const dotRR = dirHeld.dot(dirHeld);
  const dotRS = dirHeld.dot(segVec);
  const dotSS = segVec.dot(segVec);
  const dotRO = dirHeld.dot(originVec);
  const dotSO = segVec.dot(originVec);
  const denomHeld = ((dotRR * dotSS) + (-(dotRS * dotRS)));
  let rayParam = 0;
  let segParam = 0;
  const denomUsable = Math.abs(denomHeld) > 1e-8;
  if (denomUsable) {
    rayParam = (((dotRS * dotSO) + (-(dotSS * dotRO))) / denomHeld);
    segParam = (((dotRR * dotSO) + (-(dotRS * dotRO))) / denomHeld); }
  rayParam = Math.max(0, rayParam);
  segParam = Math.min(1, Math.max(0, segParam));
  const rayPt = new THREE.Vector3().copy(originHeld).addScaledVector(dirHeld, rayParam);
  const segPt = new THREE.Vector3().copy(segFrom).addScaledVector(segVec, segParam);
  const closestGap = rayPt.distanceTo(segPt);
  return { t: rayParam, dist: closestGap, h: (segPt.y + (-segFrom.y)), point: segPt }; }

export function initWeapons(stateHeld) { try {
    const bailEarly = !stateHeld || stateHeld.weapons;
    if (bailEarly) return;
    const kitHeld = { current: 'pistol', reloading: 0, equip,
      ammo: { pistol: { mag: 12, reserve: Infinity }, smg: { mag: 30, reserve: 240 }, bat: { mag: Infinity, reserve: Infinity } } };
    stateHeld.weapons = kitHeld;
    const sessionHeld = { firing: false, semiLatch: false, cooldown: 0, autoShots: 0, lastEsc: -10, swingT: 0, flashLife: 0, hitMarkT: 0, held: {}, tracers: [], flatVehicles: new Set(), slotDirty: true };
    // Held models hang off one root group on the figure
    const heldRoot = new THREE.Group();
    heldRoot.position.set(0.24, 1.02, 0.28);
    try { if (stateHeld.player && stateHeld.player.fig) stateHeld.player.fig.add(heldRoot); } catch (ignoredErr) {}
    function removeProceduralSiblings(grpHeld, holderHeld) {
      const childrenSnapshot = [...grpHeld.children];
      childrenSnapshot.forEach((childHeld) => { if (childHeld !== holderHeld) grpHeld.remove(childHeld); }); }
    function watchSlotModel(slotKey, grpHeld, holderHeld) {
      try { const pendingHeld = loadHeroAsset(SLOT_ASSET_MAP[slotKey]);
        const looksPromised = pendingHeld && (typeof pendingHeld.then === 'function');
        if (!looksPromised) return;
        pendingHeld.then((modelWrap) => {
          try { if (!modelWrap) return;
            removeProceduralSiblings(grpHeld, holderHeld);
            seatModel(slotKey, holderHeld, modelWrap);
          } catch (ignoredErr) { /* the procedural fallback stays in place */ }
        }).catch(() => {});
      } catch (ignoredErr) { /* the procedural fallback stays in place */ } }
    SLOT_ORDER.forEach((slotKey) => {
      const grpBuilt = proceduralShapeFor(slotKey);
      grpBuilt.visible = false;
      heldRoot.add(grpBuilt);
      sessionHeld.held[slotKey] = grpBuilt;
      const holderBuilt = new THREE.Group();
      holderBuilt.name = 'glbHolder:' + slotKey;
      grpBuilt.add(holderBuilt);
      watchSlotModel(slotKey, grpBuilt, holderBuilt); });
    // Muzzle flash furniture
    const flashGrp = new THREE.Group();
    try { const starTexture = buildStarTexture();
      const flashMaterial = new THREE.MeshBasicMaterial({ map: starTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffc873 });
      const flashQuadA = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMaterial);
      const flashQuadB = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMaterial);
      flashQuadB.rotation.z = (Math.PI / 4); flashQuadB.rotation.y = (Math.PI / 2);
      flashGrp.add(flashQuadA); flashGrp.add(flashQuadB);
      const flashHalo = glowSprite(0xffc873, 1.6); flashGrp.add(flashHalo);
    } catch (ignoredErr) {}
    const flashLamp = new THREE.PointLight(0xffc873, 0, 18);
    flashGrp.add(flashLamp);
    flashGrp.visible = false;
    try { stateHeld.scene.add(flashGrp); } catch (ignoredErr) {}
    for (let tracerSlot = 0; tracerSlot < 4; tracerSlot++) {
      const tracerNode = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      tracerNode.visible = false;
      try { stateHeld.scene.add(tracerNode); } catch (ignoredErr) {}
      sessionHeld.tracers.push({ mesh: tracerNode, life: 0 }); }
    let tracerPos = 0;
    // HUD fragments owned by this layer
    let crossNode = null, panelNode = null, nameNode = null, ammoNode = null;
    try { const styleNode = document.createElement('style');
      styleNode.textContent =
        '#crosshair{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:60;mix-blend-mode:difference;display:none}' +
        '#crosshair .ring{position:absolute;inset:0;border:2px solid #fff;border-radius:50%;opacity:.85}' +
        '#crosshair .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%}' + '#crosshair.hit .ring{border-color:#ff9a2a}#crosshair.hit .dot{background:#ff9a2a}' + '#crosshair.bat .ring{display:none}';
      document.head.appendChild(styleNode);
      crossNode = document.createElement('div'); crossNode.id = 'crosshair';
      crossNode.innerHTML = '<div class="ring"></div><div class="dot"></div>';
      document.body.appendChild(crossNode);
      panelNode = document.createElement('div'); panelNode.id = 'weaponSlot';
      panelNode.style.cssText = 'position:fixed;right:236px;bottom:18px;z-index:60;background:rgba(8,12,20,.72);border:1px solid rgba(0,245,212,.35);border-radius:12px;padding:8px 12px;font-family:system-ui,sans-serif;color:#e8f6ff;pointer-events:none;min-width:118px;text-align:right';
      panelNode.innerHTML = '<div id="wsName" style="font-size:11px;letter-spacing:.14em;color:#00f5d4"></div>' +
        '<div id="wsAmmo" style="font-size:22px;font-weight:700;line-height:1.15"></div>' + '<div style="font-size:10px;opacity:.65">[1][2][3] &middot; R reload</div>';
      document.body.appendChild(panelNode);
      nameNode = panelNode.querySelector('#wsName');
      ammoNode = panelNode.querySelector('#wsAmmo');
    } catch (ignoredErr) { /* the HUD here is best effort */ }
    function currentAmmoLabel() {
      const ammoRec = kitHeld.ammo[kitHeld.current];
      const specHeld = WEAPON_TABLE[kitHeld.current];
      if (specHeld.melee) return '\u221E';
      const reserveShown = !(ammoRec.reserve === Infinity) ? ammoRec.reserve : '\u221E';
      const partsLabel = [ammoRec.mag, reserveShown];
      return partsLabel.join(' / '); }
    function refreshHud() {
      if (!sessionHeld.slotDirty) return;
      sessionHeld.slotDirty = false;
      try { const reloadSuffix = (kitHeld.reloading > 0) ? ' \u00B7 RELOADING' : '';
        if (nameNode) nameNode.textContent = (WEAPON_TABLE[kitHeld.current].name + reloadSuffix);
        if (ammoNode) ammoNode.textContent = currentAmmoLabel();
        if (crossNode) crossNode.className = ((kitHeld.current === 'bat' ? 'bat' : '') + (sessionHeld.hitMarkT > 0 ? ' hit' : ''));
      } catch (ignoredErr) {} }
    function equip(slotKey) {
      if (!WEAPON_TABLE[slotKey]) return;
      kitHeld.current = slotKey; kitHeld.reloading = 0; sessionHeld.slotDirty = true;
      SLOT_ORDER.forEach((keyHeld) => { if (sessionHeld.held[keyHeld]) sessionHeld.held[keyHeld].visible = (keyHeld === slotKey); });
      refreshHud(); }
    // Small shared helpers first
    function shooterOrigin() {
      if (stateHeld.car) { const carCoords = coordsOfVehicle(stateHeld.car); if (carCoords) return carCoords; }
      if (stateHeld.player) return { x: stateHeld.player.x, z: stateHeld.player.z, y: 0 };
      return { x: 0, z: 0, y: 0 }; }
    function carMuzzle() {
      return stateHeld.car.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2)); }
    function playerMuzzle(heroRec) {
      const headingHeld = (heroRec.angle || 0);
      const groundHeld = groundH(heroRec.x, heroRec.z);
      const aheadX = (0.35 * Math.sin(headingHeld));
      const asideX = (0.18 * Math.cos(headingHeld));
      const aheadZ = (0.35 * Math.cos(headingHeld));
      const asideZ = (0.18 * Math.sin(headingHeld));
      return new THREE.Vector3((heroRec.x + (aheadX + asideX)), (groundHeld + 1.32), (heroRec.z + (aheadZ + (-asideZ)))); }
    function muzzlePosition() {
      try { if (stateHeld.car && stateHeld.car.mesh) return carMuzzle();
        const heroRec = stateHeld.player; if (!heroRec) return new THREE.Vector3();
        return playerMuzzle(heroRec);
      } catch (ignoredErr) { return new THREE.Vector3(); } }
    function playSfx(sfxName) { try { const audioRec = stateHeld.audio; if (audioRec && audioRec.play) audioRec.play(sfxName); } catch (ignoredErr) {} }
    function raiseWanted(amountHeld) {
      try { const stampHeld = (stateHeld.elapsed || 0);
        if ((stampHeld + (-sessionHeld.lastEsc)) < 0.4) return;
        sessionHeld.lastEsc = stampHeld;
        stateHeld.wanted = Math.min(5, Math.max(0, ((stateHeld.wanted || 0) + amountHeld)));
      } catch (ignoredErr) {} }
    function copNear(rangeHeld, fromX, fromZ) {
      const copPool = (stateHeld.cops || []);
      for (const copCar of copPool) { const copCoords = coordsOfVehicle(copCar); if (copCoords && (Math.hypot((copCoords.x + (-fromX)), (copCoords.z + (-fromZ))) < rangeHeld)) return true; }
      return false; }
    function pedNear(rangeHeld, fromX, fromZ) {
      const pedPool = (stateHeld.peds || []);
      for (const pedHeld of pedPool) { if (!pedHeld.downed && (Math.hypot((pedHeld.x + (-fromX)), (pedHeld.z + (-fromZ))) < rangeHeld)) return true; }
      return false; }
    function witnessNear(rangeCop, rangePed, fromX, fromZ) {
      try { if (copNear(rangeCop, fromX, fromZ)) return true;
        if (pedNear(rangePed, fromX, fromZ)) return true;
      } catch (ignoredErr) {}
      return false; }
    function beginFlee(pedHeld, fromX, fromZ, spanHeld) {
      const awayX = (pedHeld.x + (-fromX));
      const awayZ = (pedHeld.z + (-fromZ));
      const awayLen = (Math.hypot(awayX, awayZ) || 1);
      pedHeld.fleeDir = { x: (awayX / awayLen), z: (awayZ / awayLen) };
      pedHeld.fleeT = spanHeld; }
    function scatterCrowd(fromX, fromZ, rangeHeld, loHeld, hiHeld, oddsHeld) {
      try { const pedPool = (stateHeld.peds || []);
        for (const pedHeld of pedPool) {
          if (pedHeld.downed) continue;
          const inRange = (Math.hypot((pedHeld.x + (-fromX)), (pedHeld.z + (-fromZ))) < rangeHeld);
          const oddsPass = (oddsHeld == null) || chance(oddsHeld);
          if (inRange && oddsPass) beginFlee(pedHeld, fromX, fromZ, rr(loHeld, hiHeld)); }
      } catch (ignoredErr) {} }
    function dropPed(pedHeld) {
      pedHeld.downed = true; pedHeld.downedT = rr(6, 10); pedHeld._tipped = true; pedHeld.fleeT = 0;
      try { pedHeld.fig.rotation.x = -1.35;
        pedHeld.fig.position.y = (groundH(pedHeld.x, pedHeld.z) + 0.15);
      } catch (ignoredErr) {} }
    function hurtPed(pedHeld, damageHeld, flagBat, fromX, fromZ) {
      if (pedHeld.hp == null) pedHeld.hp = 100;
      pedHeld.hp -= damageHeld;
      const pedFell = !(pedHeld.hp > 0);
      if (pedFell || flagBat) { dropPed(pedHeld); return true; }
      beginFlee(pedHeld, fromX, fromZ, 1.6);
      return false; }
    function showFlash(posHeld) {
      try { flashGrp.position.copy(posHeld);
        flashGrp.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        flashGrp.visible = true; flashLamp.intensity = 26; sessionHeld.flashLife = 0.05;
      } catch (ignoredErr) {} }
    function showTracer(fromHeld, toHeld) {
      const tracerHeld = sessionHeld.tracers[tracerPos++ % sessionHeld.tracers.length];
      if (!tracerHeld) return;
      const spanLen = fromHeld.distanceTo(toHeld);
      if (!(spanLen >= 0.5)) return;
      const midVec = new THREE.Vector3().copy(fromHeld).add(toHeld).multiplyScalar(0.5);
      tracerHeld.mesh.position.copy(midVec);
      tracerHeld.mesh.lookAt(toHeld);
      tracerHeld.mesh.scale.set(1, 1, spanLen);
      tracerHeld.mesh.material.opacity = 0.85; tracerHeld.mesh.visible = true; tracerHeld.life = 0.04; }

    // Firing paths: reload, then bat swing, then hitscan shot
    function startReload() {
      const specHeld = WEAPON_TABLE[kitHeld.current];
      const ammoRec = kitHeld.ammo[kitHeld.current];
      const reloadBlocked = specHeld.melee || (kitHeld.reloading > 0);
      if (reloadBlocked) return;
      const magAlreadyFull = (ammoRec.mag >= specHeld.mag);
      const reserveDry = !(ammoRec.reserve > 0);
      if (magAlreadyFull || reserveDry) return;
      kitHeld.reloading = specHeld.reload; sessionHeld.slotDirty = true; playSfx('reload'); }
    function swingVsPeds(batSpec, srcHeld, faceX, faceZ) {
      let hitAny = false;
      try { const pedPool = (stateHeld.peds || []);
        pedPool.forEach((pedHeld) => {
          if (pedHeld.downed) return;
          const offX = (pedHeld.x + (-srcHeld.x));
          const offZ = (pedHeld.z + (-srcHeld.z));
          const distHeld = Math.hypot(offX, offZ);
          const reachOk = !(distHeld > batSpec.range) && (distHeld > 0.001);
          const facingDot = (((offX / distHeld) * faceX) + ((offZ / distHeld) * faceZ));
          if (reachOk && (facingDot > 0.4)) { hurtPed(pedHeld, batSpec.dmg, true, srcHeld.x, srcHeld.z); hitAny = true; } });
      } catch (ignoredErr) {}
      return hitAny; }
    function swingVsVehicles(batSpec, srcHeld) {
      let hitAny = false;
      try { const vehiclePool = [...(stateHeld.vehicles || []), ...(stateHeld.cops || []), ...(stateHeld.traffic || [])];
        vehiclePool.forEach((vehHeld) => {
          if (stateHeld.car && (vehHeld === stateHeld.car)) return;
          const vehPos = coordsOfVehicle(vehHeld); if (!vehPos) return;
          const vehGap = Math.hypot((vehPos.x + (-srcHeld.x)), (vehPos.z + (-srcHeld.z)));
          if (vehGap > (batSpec.range + 1.2)) return;
          try { damageVehicle(stateHeld, vehHeld, batSpec.dmg); } catch (ignoredErr) {}
          hitAny = true;
          const copClose = copNear(25, vehPos.x, vehPos.z);
          if (copClose) raiseWanted(0.4); });
      } catch (ignoredErr) {}
      return hitAny; }
    function doBatSwing() {
      const batSpec = WEAPON_TABLE.bat;
      sessionHeld.swingT = 0.22; playSfx('swing');
      const srcHeld = shooterOrigin();
      const headingHeld = stateHeld.car ? (stateHeld.car.angle || 0) : (stateHeld.player ? (stateHeld.player.angle || 0) : 0);
      const faceX = Math.sin(headingHeld);
      const faceZ = Math.cos(headingHeld);
      let hitAny = swingVsPeds(batSpec, srcHeld, faceX, faceZ);
      if (swingVsVehicles(batSpec, srcHeld)) hitAny = true;
      if (hitAny) {
        playSfx('thud'); scatterCrowd(srcHeld.x, srcHeld.z, 6, 1.2, 2.2, 0.4);
        sessionHeld.hitMarkT = 0.09; sessionHeld.slotDirty = true; } }
    function fallbackEndPoint(groundVec, originVec, dirVec, specHeld) {
      if (groundVec) return groundVec;
      return new THREE.Vector3().copy(originVec).addScaledVector(dirVec, specHeld.range); }
    function wheelForwardShare(fwdHeld, lenHeld, signHeld) {
  const shareHeld = (((0.32 * lenHeld) * signHeld) * fwdHeld);
  return shareHeld; }
    function scanPeds(rayFromVec, rayDirVec, probeHeld) {
      try { const pedPool = (stateHeld.peds || []);
        pedPool.forEach((pedHeld) => {
          if (pedHeld.downed) return;
          const baseYHeld = groundH(pedHeld.x, pedHeld.z);
          const segBottom = new THREE.Vector3(pedHeld.x, (baseYHeld + 0.2), pedHeld.z);
          const segTop = new THREE.Vector3(pedHeld.x, (baseYHeld + 1.6), pedHeld.z);
          const probeHit = closestRaySegment(rayFromVec, rayDirVec, segBottom, segTop);
          const countsHeld = probeHit && (probeHit.dist < 0.42) && (probeHit.t < probeHeld.nearestT);
          if (countsHeld) { probeHeld.nearestT = probeHit.t; probeHeld.nearestHit = { kind: 'ped', ped: pedHeld, point: probeHit.point, head: (probeHit.h > 1.45) }; } });
      } catch (ignoredErr) {} }
    function scanVehicles(rayFromVec, rayDirVec, probeHeld) {
      try { const vehiclePool = [...(stateHeld.vehicles || []), ...(stateHeld.cops || []), ...(stateHeld.traffic || [])];
        vehiclePool.forEach((vehHeld) => {
          if (stateHeld.car && (vehHeld === stateHeld.car)) return;
          const vehPos = coordsOfVehicle(vehHeld); if (!vehPos) return;
          const vehSpecHeld = (vehHeld.spec || {});
          const hitRadius = ((Math.max((vehSpecHeld.len || 4), (vehSpecHeld.wid || 1.8)) / 2) * 0.9);
          const centreVec = new THREE.Vector3(vehPos.x, ((vehPos.y || groundH(vehPos.x, vehPos.z)) + 0.55), vehPos.z);
          const relVec = new THREE.Vector3().subVectors(rayFromVec, centreVec);
          const projHeld = relVec.dot(rayDirVec);
          const restHeld = (relVec.lengthSq() + (-(hitRadius * hitRadius)));
          const discHeld = ((projHeld * projHeld) + (-restHeld));
          if (discHeld < 0) return;
          const hitParam = ((-projHeld) + (-Math.sqrt(discHeld)));
          const countsHeld = (hitParam > 0) && (hitParam < probeHeld.nearestT);
          if (countsHeld) {
            probeHeld.nearestT = hitParam;
            probeHeld.nearestHit = { kind: 'vehicle', v: vehHeld, point: new THREE.Vector3().copy(rayFromVec).addScaledVector(rayDirVec, hitParam) }; } });
      } catch (ignoredErr) {} }
    function checkWheelHit(hitHeld, vehPos, vehHeld) {
      try { const vehSpecHeld = (vehHeld.spec || {});
        const lenHeld = (vehSpecHeld.len || 4);
        const widHeld = (vehSpecHeld.wid || 1.8);
        const vehHeading = (vehHeld.angle || 0);
        const fwdX = Math.sin(vehHeading);
        const fwdZ = Math.cos(vehHeading);
        const sideX = Math.cos(vehHeading);
        const sideZ = -Math.sin(vehHeading);
        const lowEnough = ((hitHeld.point.y + (-groundH(vehPos.x, vehPos.z))) < 0.45);
        if (!lowEnough) return;
        for (const signFirst of [1, -1]) for (const signSecond of [1, -1]) {
          const wheelPosX = ((vehPos.x + (((0.32 * lenHeld) * signFirst) * fwdX)) + (((widHeld / 2) * signSecond) * sideX));
          const wheelPosZ = ((vehPos.z + wheelForwardShare(fwdZ, lenHeld, signFirst)) + (((widHeld / 2) * signSecond) * sideZ));
          const wheelGap = Math.hypot((hitHeld.point.x + (-wheelPosX)), (hitHeld.point.z + (-wheelPosZ)));
          if (wheelGap < 0.45) { vehHeld.tireFlat = 5; sessionHeld.flatVehicles.add(vehHeld); break; } }
      } catch (ignoredErr) {} }
    function handleEmptyMag(ammoRec) {
      if (ammoRec.reserve > 0) { startReload(); }
      else { playSfx('dry'); try { if (stateHeld.toast) stateHeld.toast('Out of ammo'); } catch (ignoredErr) {} } }
    function applyScatter(rayDirVec, specHeld) {
      const upPick = (Math.abs(rayDirVec.y) > 0.9) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const axisFirst = new THREE.Vector3().crossVectors(rayDirVec, upPick).normalize();
      const axisSecond = new THREE.Vector3().crossVectors(rayDirVec, axisFirst).normalize();
      rayDirVec.addScaledVector(axisFirst, rr(-specHeld.spread, specHeld.spread)).addScaledVector(axisSecond, rr(-specHeld.spread, specHeld.spread)).normalize(); }
    function groundPointFor(rayFromVec, rayDirVec, specHeld) {
      let groundVec = null;
      if (rayDirVec.y < -0.001) {
        const groundParam = ((-rayFromVec.y) / rayDirVec.y);
        const groundCounts = (groundParam > 0) && !(groundParam > specHeld.range);
        if (groundCounts) groundVec = new THREE.Vector3().copy(rayFromVec).addScaledVector(rayDirVec, groundParam); }
      return groundVec; }
    function settlePedHit(hitHeld, specHeld, srcHeld) {
      const dmgDone = (specHeld.dmg * (hitHeld.head ? 2 : 1));
      hurtPed(hitHeld.ped, dmgDone, false, srcHeld.x, srcHeld.z);
      sessionHeld.hitMarkT = 0.09; sessionHeld.slotDirty = true;
      raiseWanted(0.5);
      scatterCrowd(hitHeld.ped.x, hitHeld.ped.z, 14, 1.2, 2.2, null);
      return true; }
    function settleVehicleHit(hitHeld, specHeld) {
      const vehHit = hitHeld.v;
      try { damageVehicle(stateHeld, vehHit, specHeld.dmg); } catch (ignoredErr) {}
      try { spawnSmokeAt(stateHeld, hitHeld.point, 2, false); } catch (ignoredErr) {}
      sessionHeld.hitMarkT = 0.09; sessionHeld.slotDirty = true;
      const vehPos = coordsOfVehicle(vehHit);
      if (vehPos) checkWheelHit(hitHeld, vehPos, vehHit);
      const copPool = (stateHeld.cops || []);
      const copWasHit = (vehHit.driver === 'cop') || copPool.includes(vehHit);
      if (copWasHit) { raiseWanted(0.8); return true; }
      return false; }
    function escalateWitness(specHeld, srcHeld) {
      sessionHeld.autoShots++;
      const thresholdMet = (sessionHeld.autoShots >= 5) || !specHeld.auto;
      if (thresholdMet) {
        sessionHeld.autoShots = 0;
        if (witnessNear(70, 30, srcHeld.x, srcHeld.z)) raiseWanted(0.25); } }
    function fireShot() {
      const slotKey = kitHeld.current;
      const specHeld = WEAPON_TABLE[slotKey];
      const ammoRec = kitHeld.ammo[slotKey];
      if (!(ammoRec.mag > 0)) { handleEmptyMag(ammoRec); return; }
      ammoRec.mag--; sessionHeld.slotDirty = true;
      playSfx((slotKey === 'smg') ? 'smg' : 'shot');
      if (!stateHeld.car && stateHeld.player) { try { stateHeld.player.angle = stateHeld.camYaw; } catch (ignoredErr) {} }
      const rayFromVec = new THREE.Vector3();
      const rayDirVec = new THREE.Vector3();
      try { stateHeld.camera.getWorldPosition(rayFromVec); stateHeld.camera.getWorldDirection(rayDirVec);
      } catch (ignoredErr) { return; }
      if (specHeld.spread > 0) applyScatter(rayDirVec, specHeld);
      const muzzleVec = muzzlePosition();
      showFlash(muzzleVec);
      const srcHeld = shooterOrigin();
      const probeHeld = { nearestT: specHeld.range, nearestHit: null };
      scanPeds(rayFromVec, rayDirVec, probeHeld);
      scanVehicles(rayFromVec, rayDirVec, probeHeld);
      const groundVec = groundPointFor(rayFromVec, rayDirVec, specHeld);
      const endVec = probeHeld.nearestHit ? probeHeld.nearestHit.point : fallbackEndPoint(groundVec, rayFromVec, rayDirVec, specHeld);
      showTracer(muzzleVec, endVec);
      let crimeDone = false;
      const hitHeld = probeHeld.nearestHit;
      if (hitHeld && (hitHeld.kind === 'ped')) crimeDone = settlePedHit(hitHeld, specHeld, srcHeld);
      else if (hitHeld && (hitHeld.kind === 'vehicle')) crimeDone = settleVehicleHit(hitHeld, specHeld);
      else if (groundVec && (!hitHeld || !(probeHeld.nearestT < specHeld.range))) {
        try { spawnSmokeAt(stateHeld, groundVec, 2, false); } catch (ignoredErr) {} }
      if (!crimeDone) escalateWitness(specHeld, srcHeld);
      try { const heldHeld = sessionHeld.held[slotKey]; if (heldHeld) heldHeld.position.z = -0.03; } catch (ignoredErr) {} }
    function tryFire() {
      const fireBlocked = (stateHeld.mode !== 'play') || stateHeld.paused;
      if (fireBlocked) return;
      if ((kitHeld.reloading > 0) || (sessionHeld.cooldown > 0)) return;
      const specHeld = WEAPON_TABLE[kitHeld.current];
      sessionHeld.cooldown = specHeld.interval;
      if (specHeld.melee) doBatSwing(); else fireShot(); }
    // Pointer and keyboard input
    const canvasNode = stateHeld.canvas || (stateHeld.renderer && stateHeld.renderer.domElement) || null;
    function handlePointerDown(eventHeld) {
      if (eventHeld.button !== 0) return;
      const inputBlocked = (stateHeld.mode !== 'play') || stateHeld.paused;
      if (inputBlocked) return;
      sessionHeld.firing = true;
      const specHeld = WEAPON_TABLE[kitHeld.current];
      if (!specHeld.auto) {
        if (!sessionHeld.semiLatch) { sessionHeld.semiLatch = true; tryFire(); }
      } else tryFire(); }
    function handlePointerUp(eventHeld) { if (eventHeld.button === 0) { sessionHeld.firing = false; sessionHeld.semiLatch = false; } }
    try { if (canvasNode && canvasNode.addEventListener) canvasNode.addEventListener('pointerdown', handlePointerDown);
      else if (typeof window !== 'undefined') window.addEventListener('pointerdown', handlePointerDown);
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', handlePointerUp);
        window.addEventListener('blur', handlePointerUp); }
    } catch (ignoredErr) {}
    function handleWeaponKey(eventHeld) {
      const inputBlocked = (stateHeld.mode !== 'play') || stateHeld.paused;
      if (inputBlocked) return;
      const codeHeld = eventHeld.code;
      const slotByCode = { 'Digit1': 'pistol', 'Digit2': 'smg', 'Digit3': 'bat' };
      if (slotByCode[codeHeld]) equip(slotByCode[codeHeld]);
      else if (codeHeld === 'KeyQ') {
        const idxHeld = SLOT_ORDER.indexOf(kitHeld.current);
        equip(SLOT_ORDER[(idxHeld + 1) % SLOT_ORDER.length]);
      } else if (codeHeld === 'KeyR') startReload(); }
    try { window.addEventListener('keydown', handleWeaponKey); } catch (ignoredErr) {}
    equip('pistol');

    // Per frame updater for this layer
    function completeReload() {
      if (!(kitHeld.reloading > 0)) return;
      kitHeld.reloading = 0;
      const specHeld = WEAPON_TABLE[kitHeld.current];
      const ammoRec = kitHeld.ammo[kitHeld.current];
      const roundsShort = (specHeld.mag + (-ammoRec.mag));
      const roundsMoved = (ammoRec.reserve === Infinity) ? roundsShort : Math.min(roundsShort, ammoRec.reserve);
      ammoRec.mag += roundsMoved;
      if (ammoRec.reserve !== Infinity) ammoRec.reserve -= roundsMoved;
      sessionHeld.slotDirty = true; }
    function forcedFlashAt(stateAlt) {
      let pointHeld = null;
      const carFlashOk = (stateAlt.flags.forceFlash === 'car') && stateAlt.flags.flashCar && stateAlt.flags.flashCar.mesh;
      if (carFlashOk) pointHeld = stateAlt.flags.flashCar.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
      else pointHeld = muzzlePosition();
      return pointHeld; }
    function tickFlash(stateAlt) {
      const forcedHeld = stateAlt.flags && stateAlt.flags.forceFlash;
      if (forcedHeld) {
        try { const pointHeld = forcedFlashAt(stateAlt);
          flashGrp.position.copy(pointHeld); flashGrp.visible = true; flashLamp.intensity = 26;
        } catch (ignoredErr) {}
      } else if (sessionHeld.flashLife > 0) {
        sessionHeld.flashLife -= prevDtHeld;
        flashLamp.intensity = (26 * Math.max(0, (sessionHeld.flashLife / 0.05)));
        if (!(sessionHeld.flashLife > 0)) { flashGrp.visible = false; flashLamp.intensity = 0; }
      } else if (flashGrp.visible) { flashGrp.visible = false; flashLamp.intensity = 0; } }
    let prevDtHeld = 0;
    function tickTracers(dtHeld) {
      sessionHeld.tracers.forEach((tracerHeld) => {
        if (!(tracerHeld.life > 0)) return;
        tracerHeld.life -= dtHeld;
        tracerHeld.mesh.material.opacity = (0.85 * Math.max(0, (tracerHeld.life / 0.04)));
        if (!(tracerHeld.life > 0)) tracerHeld.mesh.visible = false; }); }
    function tickFlatTires(dtHeld) {
      if (!sessionHeld.flatVehicles.size) return;
      const flatSnapshot = [...sessionHeld.flatVehicles];
      for (const vehHeld of flatSnapshot) {
        try { if (vehHeld.tireFlat > 0) { vehHeld.tireFlat -= dtHeld; if (vehHeld.mesh) vehHeld.mesh.rotation.z = 0.03; }
          else { if (vehHeld.mesh) vehHeld.mesh.rotation.z = 0; sessionHeld.flatVehicles.delete(vehHeld); }
        } catch (ignoredErr) { sessionHeld.flatVehicles.delete(vehHeld); } } }
    function poseSwing(heldHeld, dtHeld) {
      if (sessionHeld.swingT > 0) {
        sessionHeld.swingT -= dtHeld;
        const swingShare = (1 + (-(Math.max(0, sessionHeld.swingT) / 0.22)));
        const earlySwing = (swingShare < 0.55);
        heldHeld.rotation.x = earlySwing ? (-0.4 + (-(1.5 * (swingShare / 0.55)))) : (-1.9 + (1.5 * ((swingShare + (-0.55)) / 0.45)));
      } else heldHeld.rotation.x = -0.4; }
    function tickHeld(stateAlt, dtHeld) {
      const onFootHeld = !stateAlt.car && (stateAlt.mode === 'play');
      const parentWrong = (heldRoot.parent !== (stateAlt.player && stateAlt.player.fig));
      if (parentWrong) { try { if (stateAlt.player && stateAlt.player.fig) stateAlt.player.fig.add(heldRoot); } catch (ignoredErr) {} }
      heldRoot.visible = !!onFootHeld;
      const heldHeld = sessionHeld.held[kitHeld.current];
      if (!heldHeld) return;
      heldHeld.position.z += ((0 + (-heldHeld.position.z)) * Math.min(1, (14 * dtHeld)));
      const batEquipped = !!WEAPON_TABLE[kitHeld.current].melee;
      if (batEquipped) poseSwing(heldHeld, dtHeld); }
    function tickHudVisibility(stateAlt) {
      try { if (crossNode) crossNode.style.display = ((stateAlt.mode === 'play') && !stateAlt.paused) ? 'block' : 'none';
        if (panelNode) panelNode.style.display = (stateAlt.mode === 'play') ? 'block' : 'none';
      } catch (ignoredErr) {} }
    stateHeld.updaters.push((stateAlt, dtHeld) => { try {
        prevDtHeld = dtHeld;
        if (sessionHeld.cooldown > 0) sessionHeld.cooldown -= dtHeld;
        if (kitHeld.reloading > 0) { kitHeld.reloading -= dtHeld; if (!(kitHeld.reloading > 0)) completeReload(); }
        const specCurrent = WEAPON_TABLE[kitHeld.current];
        if (sessionHeld.firing && specCurrent.auto) tryFire();
        if (sessionHeld.hitMarkT > 0) { sessionHeld.hitMarkT -= dtHeld; if (!(sessionHeld.hitMarkT > 0)) sessionHeld.slotDirty = true; }
        tickHeld(stateAlt, dtHeld);
        tickFlash(stateAlt);
        tickTracers(dtHeld);
        tickFlatTires(dtHeld);
        tickHudVisibility(stateAlt);
        refreshHud();
      } catch (ignoredErr) { /* this layer must never break the loop */ } });
  } catch (outerFault) {
    try { if (stateHeld && !stateHeld.weapons) stateHeld.weapons = null; } catch (ignoredErr) {} } }
