import * as THREE from 'three';
import { rr, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { damageVehicle, spawnSmokeAt } from './cars.js';
import { loadHeroAsset, HERO_ASSETS } from './assets.js';
// Shooting layer kept free standing: pistol plus micro SMG plus bat
// It reaches the wider game only through defensive hooks into shared
// state, so removing its init call restores the earlier behaviour
// Model files are drop in replacements, and while they are absent the
// procedural shapes below stay in silent use
export const WEAPON_TABLE = { bat: { name: 'BASEBALL BAT', dmg: 55,
    interval: 0.55, auto: false, mag: Infinity, reload: 0, range: 2.4, melee: true },
  smg: { name: 'MICRO SMG', dmg: 15,
    interval: 0.085, auto: true, mag: 30, reload: 1.3, range: 110, spread: 0.02 },
  pistol: { name: 'PISTOL', dmg: 34,
    interval: 0.34, auto: false, mag: 12, reload: 0.9, range: 130, spread: 0.006 } };
const SLOT_SEQUENCE = ['pistol', 'smg', 'bat'];
const ASSET_NAME_FOR_SLOT = { pistol: 'weaponPistol', smg: 'weaponSmg', bat: 'weaponBat' };
// Model orientation notes: vendor models share none of the game axes
// The held root on the figure points forward, and the pose table below
// corrects each model inside its own group relative to that root
// Procedural children never get touched, so a missing model leaves the
// fallback exact, and the SMG flip stays a single constant change
const SMG_FLIP_YAW = Math.PI;
export const WEAPON_POSE = { bat: { axisFrom: new THREE.Vector3(-0.775, -0.631, 0.001).normalize(),
    axisTo: new THREE.Vector3(0, -0.75, 0.66).normalize(),
    knobLocal: new THREE.Vector3(-0.49, 0.02, 0) },
  smg: { rotY: SMG_FLIP_YAW, offset: new THREE.Vector3(0, -0.13, 0.03) },
  pistol: { rotY: -Math.PI / 2,
    offset: new THREE.Vector3(0, -0.10, -0.02) } };
// Wrap one model in its oriented holder inside the per weapon group
// Recoil moving the group, and the bat swing rotating it, then carry
// the model exactly like the procedural mesh
function orientModelHolder(slotName, holderGroup, modelWrap) {
  const poseDef = WEAPON_POSE[slotName];
  if (!poseDef) { holderGroup.add(modelWrap); return; }
  if (slotName === 'bat') {
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(poseDef.axisFrom, poseDef.axisTo);
    holderGroup.quaternion.copy(alignQuat);
    const batScale = (HERO_ASSETS.weaponBat && HERO_ASSETS.weaponBat.scale) || 0.72;
    const knobOffset = poseDef.knobLocal.clone().multiplyScalar(batScale);
    holderGroup.position.copy(knobOffset.applyQuaternion(alignQuat)).negate();
    holderGroup.add(modelWrap);
  } else {
    modelWrap.rotation.y = poseDef.rotY; modelWrap.position.copy(poseDef.offset); holderGroup.add(modelWrap); } }
function coordsOfVehicle(vehIn) {
  // Coordinates mirror the mesh, because the car module keeps them in
  // sync, and the mesh position serves as fallback when they are absent
  const coordsPresent = vehIn && Number.isFinite(vehIn.x) && Number.isFinite(vehIn.z);
  if (coordsPresent) return { x: vehIn.x, z: vehIn.z, y: vehIn.mesh ? vehIn.mesh.position.y : 0 };
  if (vehIn && vehIn.mesh && vehIn.mesh.position) return { x: vehIn.mesh.position.x, z: vehIn.mesh.position.z, y: vehIn.mesh.position.y };
  return null; }
const STAR_CANVAS_SIZE = 128;
function buildStarTexture() {
  const canvasEl = document.createElement('canvas'); canvasEl.width = STAR_CANVAS_SIZE; canvasEl.height = STAR_CANVAS_SIZE;
  const ctx = canvasEl.getContext('2d');
  const radial = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  radial.addColorStop(0, 'rgba(255,240,200,1)'); radial.addColorStop(0.35, 'rgba(255,190,90,.75)'); radial.addColorStop(1, 'rgba(255,150,40,0)');
  ctx.fillStyle = radial; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = 'rgba(255,230,170,.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  [[52, 0], [-52, 0], [0, 52], [0, -52], [34, 34], [-34, -34], [34, -34], [-34, 34]].forEach(([spokeX, spokeY]) => {
    ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(64 + spokeX, 64 + spokeY); ctx.stroke(); });
  return new THREE.CanvasTexture(canvasEl); }
const makeBoxMesh = (widthIn, heightIn, depthIn, colourIn, metalIn) => {
  const boxMat = new THREE.MeshStandardMaterial({ color: colourIn, roughness: 0.45, metalness: metalIn == null ? 0.6 : metalIn });
  const boxOut = new THREE.Mesh(new THREE.BoxGeometry(widthIn, heightIn, depthIn), boxMat);
  return boxOut; };
function buildProceduralWeapon(slotName) {
  const weaponGroup = new THREE.Group();
  const darkTone = 0x1a1c20;
  if (slotName === 'pistol') {
    const slideMesh = makeBoxMesh(0.055, 0.07, 0.24, darkTone); slideMesh.position.set(0, 0.03, 0.05); weaponGroup.add(slideMesh);
    const gripMesh = makeBoxMesh(0.05, 0.13, 0.06, 0x111214, 0.3); gripMesh.position.set(0, -0.05, -0.05); gripMesh.rotation.x = 0.25; weaponGroup.add(gripMesh);
  } else if (slotName === 'smg') {
    const bodyMesh = makeBoxMesh(0.06, 0.09, 0.34, darkTone); bodyMesh.position.set(0, 0.02, 0.06); weaponGroup.add(bodyMesh);
    const magMesh = makeBoxMesh(0.045, 0.16, 0.06, 0x24262b); magMesh.position.set(0, -0.08, 0.02); magMesh.rotation.x = 0.15; weaponGroup.add(magMesh);
    const suppressorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 }));
    suppressorMesh.rotation.x = Math.PI / 2; suppressorMesh.position.set(0, 0.03, 0.29); weaponGroup.add(suppressorMesh);
  } else {
    const batGeometry = new THREE.CylinderGeometry(0.032, 0.02, 0.85, 10);
    const batMesh = new THREE.Mesh(batGeometry, new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 0.7, metalness: 0.05 }));
    batMesh.rotation.x = Math.PI / 2 - 0.5; batMesh.position.set(0, 0.12, 0.18); weaponGroup.add(batMesh); }
  return weaponGroup; }
// Closest approach between a ray and a segment
// The result carries the ray parameter plus the height of the closest
// segment point above its base, and a ray passing behind yields null
function closestRaySegment(originIn, dirIn, segStart, segEnd) {
  const segmentDir = new THREE.Vector3().subVectors(segEnd, segStart);
  const originDelta = new THREE.Vector3().subVectors(originIn, segStart);
  const coeffAA = dirIn.dot(dirIn), coeffBB = dirIn.dot(segmentDir), coeffCC = segmentDir.dot(segmentDir), coeffDD = dirIn.dot(originDelta), coeffEE = segmentDir.dot(originDelta);
  const denomVal = coeffCC * coeffAA - coeffBB * coeffBB;
  let rayParam = 0, segParam = 0;
  if (Math.abs(denomVal) > 1e-8) {
    rayParam = (coeffEE * coeffBB - coeffDD * coeffCC) / denomVal; segParam = (coeffEE * coeffAA - coeffDD * coeffBB) / denomVal; }
  rayParam = Math.max(0, rayParam); segParam = Math.min(1, Math.max(0, segParam));
  const rayPoint = new THREE.Vector3().copy(originIn).addScaledVector(dirIn, rayParam);
  const segPoint = new THREE.Vector3().copy(segStart).addScaledVector(segmentDir, segParam);
  return { t: rayParam, dist: rayPoint.distanceTo(segPoint), h: segPoint.y - segStart.y, point: segPoint }; }
export function initWeapons(G) { try { if (!G || G.weapons) return;
    const weaponState = {
      current: 'pistol',
      ammo: { pistol: { mag: 12, reserve: Infinity },
        smg: { mag: 30, reserve: 240 },
        bat: { mag: Infinity, reserve: Infinity } }, reloading: 0, equip };
    G.weapons = weaponState;
    const session = { firing: false, semiLatch: false, cooldown: 0, autoShots: 0, lastEsc: -10, swingT: 0, flashLife: 0, hitMarkT: 0,
      held: {}, tracers: [], flatVehicles: new Set(), slotDirty: true };
    // Held models and their root on the figure
    const heldRootGroup = new THREE.Group();
    heldRootGroup.position.set(0.24, 1.02, 0.28);
    try { if (G.player && G.player.fig) G.player.fig.add(heldRootGroup); } catch (err) {}
    SLOT_SEQUENCE.forEach((slotName) => {
      const weaponGroup = buildProceduralWeapon(slotName);
      weaponGroup.visible = false;
      heldRootGroup.add(weaponGroup);
      session.held[slotName] = weaponGroup;
      const glbHolder = new THREE.Group();
      glbHolder.name = 'glbHolder:' + slotName;
      weaponGroup.add(glbHolder);
      try {
        const pendingWrap = loadHeroAsset(ASSET_NAME_FOR_SLOT[slotName]);
        if (pendingWrap && typeof pendingWrap.then === 'function') {
          pendingWrap.then((wrapIn) => {
            try {
              if (!wrapIn) return;
              [...weaponGroup.children].forEach((childIn) => {
                if (childIn !== glbHolder) weaponGroup.remove(childIn); });
              orientModelHolder(slotName, glbHolder, wrapIn);
            } catch (err) { /* procedural fallback stays */ }
          }).catch(() => {}); }
      } catch (err) { /* procedural fallback stays */ } });
    // Muzzle flash visuals
    const flashGroup = new THREE.Group(); try {
      const starTexture = buildStarTexture();
      const flashMaterial = new THREE.MeshBasicMaterial({ map: starTexture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffc873 });
      const flashPlaneA = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMaterial);
      const flashPlaneB = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMaterial); flashPlaneB.rotation.z = Math.PI / 4; flashPlaneB.rotation.y = Math.PI / 2;
      flashGroup.add(flashPlaneA); flashGroup.add(flashPlaneB);
      const flashGlow = glowSprite(0xffc873, 1.6); flashGroup.add(flashGlow);
    } catch (err) {}
    const flashLamp = new THREE.PointLight(0xffc873, 0, 18);
    flashGroup.add(flashLamp);
    flashGroup.visible = false;
    try { G.scene.add(flashGroup); } catch (err) {}
    for (let idx = 0; idx < 4; idx++) {
      const tracerMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      tracerMesh.visible = false;
      try { G.scene.add(tracerMesh); } catch (err) {}
      session.tracers.push({ mesh: tracerMesh, life: 0 }); }
    let tracerIdx = 0;
    // HUD pieces owned by this layer
    let crosshairEl = null, slotPanelEl = null, slotNameEl = null, slotAmmoEl = null; try {
      const styleNode = document.createElement('style');
      styleNode.textContent =
        '#crosshair{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:60;mix-blend-mode:difference;display:none}' + '#crosshair .ring{position:absolute;inset:0;border:2px solid #fff;border-radius:50%;opacity:.85}' +
        '#crosshair .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%}' + '#crosshair.hit .ring{border-color:#ff9a2a}#crosshair.hit .dot{background:#ff9a2a}' +
        '#crosshair.bat .ring{display:none}';
      document.head.appendChild(styleNode);
      crosshairEl = document.createElement('div'); crosshairEl.id = 'crosshair';
      crosshairEl.innerHTML = '<div class="ring"></div><div class="dot"></div>';
      document.body.appendChild(crosshairEl);
      slotPanelEl = document.createElement('div'); slotPanelEl.id = 'weaponSlot';
      slotPanelEl.style.cssText = 'position:fixed;right:236px;bottom:18px;z-index:60;background:rgba(8,12,20,.72);border:1px solid rgba(0,245,212,.35);border-radius:12px;padding:8px 12px;font-family:system-ui,sans-serif;color:#e8f6ff;pointer-events:none;min-width:118px;text-align:right';
      slotPanelEl.innerHTML = '<div id="wsName" style="font-size:11px;letter-spacing:.14em;color:#00f5d4"></div>' + '<div id="wsAmmo" style="font-size:22px;font-weight:700;line-height:1.15"></div>' +
        '<div style="font-size:10px;opacity:.65">[1][2][3] &middot; R reload</div>';
      document.body.appendChild(slotPanelEl);
      slotNameEl = slotPanelEl.querySelector('#wsName');
      slotAmmoEl = slotPanelEl.querySelector('#wsAmmo');
    } catch (err) { /* the HUD here is best effort */ }
    function currentAmmoLabel() {
      const ammoNow = weaponState.ammo[weaponState.current];
      if (WEAPON_TABLE[weaponState.current].melee) return '\u221E';
      return ammoNow.mag + ' / ' + (ammoNow.reserve === Infinity ? '\u221E' : ammoNow.reserve); }
    function syncHud() {
      if (!session.slotDirty) return;
      session.slotDirty = false;
      try {
        if (slotNameEl) slotNameEl.textContent = WEAPON_TABLE[weaponState.current].name + (weaponState.reloading > 0 ? ' \u00B7 RELOADING' : '');
        if (slotAmmoEl) slotAmmoEl.textContent = currentAmmoLabel();
        if (crosshairEl) crosshairEl.className = (weaponState.current === 'bat' ? 'bat' : '') + (session.hitMarkT > 0 ? ' hit' : '');
      } catch (err) {} }
    function equip(slotName) {
      if (!WEAPON_TABLE[slotName]) return;
      weaponState.current = slotName; weaponState.reloading = 0; session.slotDirty = true;
      SLOT_SEQUENCE.forEach((keyName) => { if (session.held[keyName]) session.held[keyName].visible = (keyName === slotName); });
      syncHud(); }
    // Small shared helpers first
    function shooterOrigin() {
      if (G.car) { const carCoords = coordsOfVehicle(G.car); if (carCoords) return carCoords; }
      if (G.player) return { x: G.player.x, z: G.player.z, y: 0 };
      return { x: 0, z: 0, y: 0 }; }
    function muzzlePosition() {
      try {
        if (G.car && G.car.mesh) return G.car.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
        const pl = G.player; if (!pl) return new THREE.Vector3();
        const headingAngle = pl.angle || 0;
        const groundLevel = groundH(pl.x, pl.z);
        return new THREE.Vector3(
          pl.x + (0.35 * Math.sin(headingAngle) + 0.18 * Math.cos(headingAngle)),
          groundLevel + 1.32,
          pl.z + (0.35 * Math.cos(headingAngle) - 0.18 * Math.sin(headingAngle)));
      } catch (err) { return new THREE.Vector3(); } }
    function emitSfx(sfxName) { try { const audioNow = G.audio; if (audioNow && audioNow.play) audioNow.play(sfxName); } catch (err) {} }
    function escalateWanted(amountIn) {
      try {
        const stampNow = G.elapsed || 0;
        if (stampNow - session.lastEsc < 0.4) return;
        session.lastEsc = stampNow;
        G.wanted = Math.min(5, Math.max(0, (G.wanted || 0) + amountIn));
      } catch (err) {} }
    function anyWitnessNear(copRadius, pedRadius, srcX, srcZ) {
      try {
        for (const copVeh of G.cops || []) { const copCoords = coordsOfVehicle(copVeh); if (copCoords && Math.hypot(copCoords.x - srcX, copCoords.z - srcZ) < copRadius) return true; }
        for (const pedIn of G.peds || []) { if (!pedIn.downed && Math.hypot(pedIn.x - srcX, pedIn.z - srcZ) < pedRadius) return true; }
      } catch (err) {}
      return false; }
    function startPedFleeing(pedIn, fromX, fromZ, durationIn) {
      const awayX = pedIn.x - fromX, awayZ = pedIn.z - fromZ;
      const awayLen = Math.hypot(awayX, awayZ) || 1;
      pedIn.fleeDir = { x: awayX / awayLen, z: awayZ / awayLen };
      pedIn.fleeT = durationIn; }
    function disperseCrowd(fromX, fromZ, radiusIn, timeLo, timeHi, probIn) {
      try {
        (G.peds || []).forEach((pedIn) => {
          if (pedIn.downed) return;
          if (Math.hypot(pedIn.x - fromX, pedIn.z - fromZ) < radiusIn && (probIn == null || chance(probIn))) startPedFleeing(pedIn, fromX, fromZ, rr(timeLo, timeHi)); });
      } catch (err) {} }
    function topplePed(pedIn) {
      pedIn.downed = true; pedIn.downedT = rr(6, 10); pedIn._tipped = true; pedIn.fleeT = 0;
      try {
        pedIn.fig.rotation.x = -1.35;
        pedIn.fig.position.y = groundH(pedIn.x, pedIn.z) + 0.15;
      } catch (err) {} }
    function injurePed(pedIn, damageIn, batHit, srcX, srcZ) {
      if (pedIn.hp == null) pedIn.hp = 100;
      pedIn.hp -= damageIn;
      if (!(pedIn.hp > 0) || batHit) { topplePed(pedIn); return true; }
      startPedFleeing(pedIn, srcX, srcZ, 1.6);
      return false; }
    function showFlashAt(posIn) {
      try {
        flashGroup.position.copy(posIn);
        flashGroup.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        flashGroup.visible = true; flashLamp.intensity = 26; session.flashLife = 0.05;
      } catch (err) {} }
    function drawTracer(fromVec, toVec) {
      const tracerSlot = session.tracers[tracerIdx++ % session.tracers.length];
      if (!tracerSlot) return;
      const spanLen = fromVec.distanceTo(toVec);
      if (!(spanLen >= 0.5)) return;
      tracerSlot.mesh.position.copy(fromVec).add(toVec).multiplyScalar(0.5);
      tracerSlot.mesh.lookAt(toVec);
      tracerSlot.mesh.scale.set(1, 1, spanLen);
      tracerSlot.mesh.material.opacity = 0.85; tracerSlot.mesh.visible = true; tracerSlot.life = 0.04; }
    // Firing paths: reload, then bat swing, then hitscan shot
    function startReload() {
      const specNow = WEAPON_TABLE[weaponState.current];
      const ammoNow = weaponState.ammo[weaponState.current];
      if (specNow.melee || weaponState.reloading > 0) return;
      if (ammoNow.mag >= specNow.mag || !(ammoNow.reserve > 0)) return;
      weaponState.reloading = specNow.reload; session.slotDirty = true; emitSfx('reload'); }
    function swingBatNow() {
      const batSpec = WEAPON_TABLE.bat;
      session.swingT = 0.22; emitSfx('swing');
      const srcPos = shooterOrigin();
      const headingAngle = G.car ? (G.car.angle || 0) : (G.player ? G.player.angle || 0 : 0);
      const forwardX = Math.sin(headingAngle), forwardZ = Math.cos(headingAngle);
      let hitSomething = false;
      try {
        (G.peds || []).forEach((pedIn) => {
          if (pedIn.downed) return;
          const deltaX = pedIn.x - srcPos.x, deltaZ = pedIn.z - srcPos.z;
          const distNow = Math.hypot(deltaX, deltaZ);
          if (!(distNow > batSpec.range) && distNow > 0.001 && (deltaX / distNow) * forwardX + (deltaZ / distNow) * forwardZ > 0.4) {
            injurePed(pedIn, batSpec.dmg, true, srcPos.x, srcPos.z); hitSomething = true; } });
      } catch (err) {}
      try {
        [...(G.vehicles || []), ...(G.cops || []), ...(G.traffic || [])].forEach((vehIn) => {
          if (G.car && vehIn === G.car) return;
          const vehCoords = coordsOfVehicle(vehIn); if (!vehCoords) return;
          if (!(Math.hypot(vehCoords.x - srcPos.x, vehCoords.z - srcPos.z) > batSpec.range + 1.2)) {
            try { damageVehicle(G, vehIn, batSpec.dmg); } catch (err) {}
            hitSomething = true;
            let copNearby = false;
            for (const copVeh of G.cops || []) { const copCoords = coordsOfVehicle(copVeh); if (copCoords && Math.hypot(copCoords.x - vehCoords.x, copCoords.z - vehCoords.z) < 25) { copNearby = true; break; } }
            if (copNearby) escalateWanted(0.4); } });
      } catch (err) {}
      if (hitSomething) {
        emitSfx('thud'); disperseCrowd(srcPos.x, srcPos.z, 6, 1.2, 2.2, 0.4);
        session.hitMarkT = 0.09; session.slotDirty = true; } }
    function fallbackEndPoint(groundVec, originVec, dirVec, specNow) {
      return groundVec || new THREE.Vector3().copy(originVec).addScaledVector(dirVec, specNow.range); }
    function forwardComponent(fComp, lenVal, signIn) { return 0.32 * lenVal * signIn * fComp; }
    function fireGunNow() {
      const slotName = weaponState.current;
      const specNow = WEAPON_TABLE[slotName];
      const ammoNow = weaponState.ammo[slotName];
      if (!(ammoNow.mag > 0)) {
        if (ammoNow.reserve > 0) { startReload(); }
        else { emitSfx('dry'); try { if (G.toast) G.toast('Out of ammo'); } catch (err) {} }
        return; }
      ammoNow.mag--; session.slotDirty = true;
      emitSfx(slotName === 'smg' ? 'smg' : 'shot');
      if (!G.car && G.player) { try { G.player.angle = G.camYaw; } catch (err) {} }
      const rayOriginVec = new THREE.Vector3();
      const rayDirVec = new THREE.Vector3();
      try {
        G.camera.getWorldPosition(rayOriginVec); G.camera.getWorldDirection(rayDirVec);
      } catch (err) { return; }
      if (specNow.spread > 0) {
        const upChoice = Math.abs(rayDirVec.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const spreadAxisA = new THREE.Vector3().crossVectors(rayDirVec, upChoice).normalize();
        const spreadAxisB = new THREE.Vector3().crossVectors(rayDirVec, spreadAxisA).normalize();
        rayDirVec.addScaledVector(spreadAxisA, rr(-specNow.spread, specNow.spread)).addScaledVector(spreadAxisB, rr(-specNow.spread, specNow.spread)).normalize(); }
      const muzzleVec = muzzlePosition();
      showFlashAt(muzzleVec);
      const srcPos = shooterOrigin();
      let nearestT = specNow.range, nearestHit = null;
      try {
        (G.peds || []).forEach((pedIn) => {
          if (pedIn.downed) return;
          const baseGroundY = groundH(pedIn.x, pedIn.z);
          const segLower = new THREE.Vector3(pedIn.x, baseGroundY + 0.2, pedIn.z);
          const segUpper = new THREE.Vector3(pedIn.x, baseGroundY + 1.6, pedIn.z);
          const probe = closestRaySegment(rayOriginVec, rayDirVec, segLower, segUpper);
          if (probe && probe.dist < 0.42 && probe.t < nearestT) { nearestT = probe.t; nearestHit = { kind: 'ped', ped: pedIn, point: probe.point, head: probe.h > 1.45 }; } });
      } catch (err) {}
      try {
        const allVehicles = [...(G.vehicles || []), ...(G.cops || []), ...(G.traffic || [])];
        allVehicles.forEach((vehIn) => {
          if (G.car && vehIn === G.car) return;
          const vehCoords = coordsOfVehicle(vehIn); if (!vehCoords) return;
          const vehSpec = vehIn.spec || {};
          const hitRadius = Math.max(vehSpec.len || 4, vehSpec.wid || 1.8) / 2 * 0.9;
          const centreVec = new THREE.Vector3(vehCoords.x, (vehCoords.y || groundH(vehCoords.x, vehCoords.z)) + 0.55, vehCoords.z);
          const relVec = new THREE.Vector3().subVectors(rayOriginVec, centreVec);
          const projVal = relVec.dot(rayDirVec);
          const remainder = relVec.lengthSq() - hitRadius * hitRadius;
          const discriminant = projVal * projVal - remainder;
          if (discriminant < 0) return;
          const hitParam = -projVal - Math.sqrt(discriminant);
          if (hitParam > 0 && hitParam < nearestT) {
            nearestT = hitParam;
            nearestHit = { kind: 'vehicle', v: vehIn, point: new THREE.Vector3().copy(rayOriginVec).addScaledVector(rayDirVec, hitParam) }; } });
      } catch (err) {}
      let groundHitVec = null;
      if (rayDirVec.y < -0.001) {
        const groundParam = -rayOriginVec.y / rayDirVec.y;
        if (groundParam > 0 && !(groundParam > specNow.range)) groundHitVec = new THREE.Vector3().copy(rayOriginVec).addScaledVector(rayDirVec, groundParam); }
      const endVec = nearestHit ? nearestHit.point : (fallbackEndPoint(groundHitVec, rayOriginVec, rayDirVec, specNow));
      drawTracer(muzzleVec, endVec);
      let crimeFlagged = false;
      if (nearestHit && nearestHit.kind === 'ped') {
        const damageDealt = specNow.dmg * (nearestHit.head ? 2 : 1);
        injurePed(nearestHit.ped, damageDealt, false, srcPos.x, srcPos.z);
        session.hitMarkT = 0.09; session.slotDirty = true;
        escalateWanted(0.5); crimeFlagged = true;
        disperseCrowd(nearestHit.ped.x, nearestHit.ped.z, 14, 1.2, 2.2, null);
      } else if (nearestHit && nearestHit.kind === 'vehicle') {
        const vehHit = nearestHit.v;
        try { damageVehicle(G, vehHit, specNow.dmg); } catch (err) {}
        try { spawnSmokeAt(G, nearestHit.point, 2, false); } catch (err) {}
        session.hitMarkT = 0.09; session.slotDirty = true;
        try {
          const vehCoords = coordsOfVehicle(vehHit);
          const vehSpec = vehHit.spec || {};
          const lenNow = vehSpec.len || 4, widNow = vehSpec.wid || 1.8;
          const vehHeading = vehHit.angle || 0;
          const fwdX = Math.sin(vehHeading), fwdZ = Math.cos(vehHeading), sideX = Math.cos(vehHeading), sideZ = -Math.sin(vehHeading);
          if (nearestHit.point.y - groundH(vehCoords.x, vehCoords.z) < 0.45) {
            for (const signA of [1, -1]) for (const signB of [1, -1]) {
              const wheelX = vehCoords.x + 0.32 * lenNow * signA * fwdX + (widNow / 2) * signB * sideX;
              const wheelZ = vehCoords.z + forwardComponent(fwdZ, lenNow, signA) + (widNow / 2) * signB * sideZ;
              if (Math.hypot(nearestHit.point.x - wheelX, nearestHit.point.z - wheelZ) < 0.45) { vehHit.tireFlat = 5; session.flatVehicles.add(vehHit); break; } } }
        } catch (err) {}
        const copVehicleHit = vehHit.driver === 'cop' || (G.cops || []).includes(vehHit);
        if (copVehicleHit) { escalateWanted(0.8); crimeFlagged = true; }
      } else if (groundHitVec && (!nearestHit || !(nearestT < specNow.range))) {
        try { spawnSmokeAt(G, groundHitVec, 2, false); } catch (err) {} }
      if (!crimeFlagged) {
        session.autoShots++;
        if (session.autoShots >= 5 || !specNow.auto) {
          session.autoShots = 0;
          if (anyWitnessNear(70, 30, srcPos.x, srcPos.z)) escalateWanted(0.25); } }
      try { const heldGroup = session.held[slotName]; if (heldGroup) heldGroup.position.z = -0.03; } catch (err) {} }
    function tryFire() {
      if (G.mode !== 'play' || G.paused) return;
      if (weaponState.reloading > 0 || session.cooldown > 0) return;
      const specNow = WEAPON_TABLE[weaponState.current];
      session.cooldown = specNow.interval;
      if (specNow.melee) swingBatNow(); else fireGunNow(); }
    // Pointer and keyboard input
    const canvasTarget = G.canvas || (G.renderer && G.renderer.domElement) || null;
    function onPointerDown(evIn) {
      if (evIn.button !== 0) return;
      if (G.mode !== 'play' || G.paused) return;
      session.firing = true;
      if (!WEAPON_TABLE[weaponState.current].auto) {
        if (!session.semiLatch) { session.semiLatch = true; tryFire(); }
      } else tryFire(); }
    function onPointerUp(evIn) { if (evIn.button === 0) { session.firing = false; session.semiLatch = false; } }
    try {
      if (canvasTarget && canvasTarget.addEventListener) canvasTarget.addEventListener('pointerdown', onPointerDown);
      else if (typeof window !== 'undefined') window.addEventListener('pointerdown', onPointerDown);
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('blur', onPointerUp); }
    } catch (err) {}
    try {
      window.addEventListener('keydown', (evIn) => {
        if (G.mode !== 'play' || G.paused) return;
        const codeIn = evIn.code;
        if (codeIn === 'Digit1') equip('pistol');
        else if (codeIn === 'Digit2') equip('smg');
        else if (codeIn === 'Digit3') equip('bat');
        else if (codeIn === 'KeyQ') {
          const currentIdx = SLOT_SEQUENCE.indexOf(weaponState.current);
          equip(SLOT_SEQUENCE[(currentIdx + 1) % SLOT_SEQUENCE.length]);
        } else if (codeIn === 'KeyR') startReload(); });
    } catch (err) {}
    equip('pistol');
    // Per frame updater for this layer
    G.updaters.push((G2, dtStep) => { try {
        if (session.cooldown > 0) session.cooldown -= dtStep;
        if (weaponState.reloading > 0) {
          weaponState.reloading -= dtStep;
          if (!(weaponState.reloading > 0)) {
            weaponState.reloading = 0;
            const specNow = WEAPON_TABLE[weaponState.current];
            const ammoNow = weaponState.ammo[weaponState.current];
            const roundsNeeded = specNow.mag - ammoNow.mag;
            const roundsTaken = ammoNow.reserve === Infinity ? roundsNeeded : Math.min(roundsNeeded, ammoNow.reserve);
            ammoNow.mag += roundsTaken;
            if (ammoNow.reserve !== Infinity) ammoNow.reserve -= roundsTaken;
            session.slotDirty = true; } }
        if (session.firing && WEAPON_TABLE[weaponState.current].auto) tryFire();
        if (session.hitMarkT > 0) { session.hitMarkT -= dtStep; if (!(session.hitMarkT > 0)) session.slotDirty = true; }
        const onFootActive = !G.car && G.mode === 'play';
        if (heldRootGroup.parent !== (G.player && G.player.fig)) {
          try { if (G.player && G.player.fig) G.player.fig.add(heldRootGroup); } catch (err) {} }
        heldRootGroup.visible = !!onFootActive;
        const heldGroupNow = session.held[weaponState.current];
        if (heldGroupNow) {
          heldGroupNow.position.z += (0 - heldGroupNow.position.z) * Math.min(1, 14 * dtStep);
          if (weaponState.current === 'bat') {
            if (session.swingT > 0) {
              session.swingT -= dtStep;
              const swingPhase = 1 - Math.max(0, session.swingT) / 0.22;
              heldGroupNow.rotation.x = swingPhase < 0.55 ? -0.4 - 1.5 * (swingPhase / 0.55) : -1.9 + 1.5 * ((swingPhase - 0.55) / 0.45);
            } else heldGroupNow.rotation.x = -0.4; } }
        const forcedFlash = G.flags && G.flags.forceFlash;
        if (forcedFlash) {
          try {
            let flashPos = null;
            if (forcedFlash === 'car' && G.flags.flashCar && G.flags.flashCar.mesh) {
              flashPos = G.flags.flashCar.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
            } else flashPos = muzzlePosition();
            flashGroup.position.copy(flashPos); flashGroup.visible = true; flashLamp.intensity = 26;
          } catch (err) {}
        } else if (session.flashLife > 0) {
          session.flashLife -= dtStep;
          flashLamp.intensity = 26 * Math.max(0, session.flashLife / 0.05);
          if (!(session.flashLife > 0)) { flashGroup.visible = false; flashLamp.intensity = 0; }
        } else if (flashGroup.visible) { flashGroup.visible = false; flashLamp.intensity = 0; }
        session.tracers.forEach((tracerSlot) => {
          if (tracerSlot.life > 0) {
            tracerSlot.life -= dtStep;
            tracerSlot.mesh.material.opacity = 0.85 * Math.max(0, tracerSlot.life / 0.04);
            if (!(tracerSlot.life > 0)) tracerSlot.mesh.visible = false; } });
        if (session.flatVehicles.size) {
          [...session.flatVehicles].forEach((vehIn) => {
            try {
              if (vehIn.tireFlat > 0) { vehIn.tireFlat -= dtStep; if (vehIn.mesh) vehIn.mesh.rotation.z = 0.03; }
              else { if (vehIn.mesh) vehIn.mesh.rotation.z = 0; session.flatVehicles.delete(vehIn); }
            } catch (err) { session.flatVehicles.delete(vehIn); } }); }
        try {
          if (crosshairEl) crosshairEl.style.display = (G.mode === 'play' && !G.paused) ? 'block' : 'none';
          if (slotPanelEl) slotPanelEl.style.display = (G.mode === 'play') ? 'block' : 'none';
        } catch (err) {}
        syncHud();
      } catch (err) { /* this layer must never break the loop */ } });
  } catch (err) {
    try { if (G && !G.weapons) G.weapons = null; } catch (err2) {} } }
