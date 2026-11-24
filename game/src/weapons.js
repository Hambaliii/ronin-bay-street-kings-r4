import * as THREE from 'three'; import { rr, chance } from './random.js';
import { groundH, glowSprite } from './world.js'; import { damageVehicle, spawnSmokeAt } from './cars.js'; import { loadHeroAsset, HERO_ASSETS } from './assets.js';
export const WEAPON_TABLE = { }; const addWeapon = (keyW, specW) => { WEAPON_TABLE [keyW] = specW; };
let specBatW = { }; specBatW.name = 'BASEBALL BAT'; specBatW.dmg = 55; specBatW.interval = 0.55; specBatW.auto = false; specBatW.mag = Infinity; specBatW.reload = 0; specBatW.range = 2.4; specBatW.melee = true; addWeapon ('bat', specBatW);
let specSmgW = { }; specSmgW.name = 'MICRO SMG'; specSmgW.dmg = 15; specSmgW.interval = 0.085; specSmgW.auto = true; specSmgW.mag = 30; specSmgW.reload = 1.3; specSmgW.range = 110; specSmgW.spread = 0.02; addWeapon ('smg', specSmgW);
let specPistolW = { }; specPistolW.name = 'PISTOL'; specPistolW.dmg = 34; specPistolW.interval = 0.34; specPistolW.auto = false; specPistolW.mag = 12; specPistolW.reload = 0.9; specPistolW.range = 130; specPistolW.spread = 0.006; addWeapon ('pistol', specPistolW);
const SLOT_ORDER = []; SLOT_ORDER.push ('pistol'); SLOT_ORDER.push ('smg'); SLOT_ORDER.push ('bat');
let slotAssetMapW = { }; slotAssetMapW.pistol = 'weaponPistol'; slotAssetMapW.smg = 'weaponSmg'; slotAssetMapW.bat = 'weaponBat'; const SLOT_ASSET_MAP = slotAssetMapW;
let smgYawFlipW; smgYawFlipW = Math.PI; const SMG_YAW_FLIP = smgYawFlipW;
export const WEAPON_POSE = { bat : { axisFrom : new THREE.Vector3 (- 0.775, - 0.631, 0.001).normalize (), axisTo : new THREE.Vector3 (0, - 0.75, 0.66).normalize (), knobLocal : new THREE.Vector3 (- 0.49, 0.02, 0) }, smg : { rotY : SMG_YAW_FLIP, offset : new THREE.Vector3 (0, - 0.13, 0.03) }, pistol : { rotY : - Math.PI / 2, offset : new THREE.Vector3 (0, - 0.10, - 0.02) } }; const POSE_TABLE = WEAPON_POSE;
const batScaleVal = () => {
  let batEnt; batEnt = HERO_ASSETS.weaponBat;
  let batScl; batScl = (batEnt || { }).scale || 0.72;
  return batScl; };
const mountBat = (poseB, holdB, wrapB) => {
  let quatB; quatB = new THREE.Quaternion ().setFromUnitVectors (poseB.axisFrom, poseB.axisTo);
  holdB.quaternion.copy (quatB);
  let knobB; knobB = poseB.knobLocal.clone ().multiplyScalar (batScaleVal ()).applyQuaternion (quatB);
  holdB.position.copy (knobB).negate ();
  holdB.add (wrapB); };
const mountGun = (poseG, holdG, wrapG) => {
  wrapG.position.copy (poseG.offset);
  wrapG.rotation.y = poseG.rotY;
  holdG.add (wrapG); };
const seatModel = (keyS, holdS, wrapS) => {
  let poseS; poseS = WEAPON_POSE [keyS];
  if (! poseS) { holdS.add (wrapS); return; }
  if ('bat' === keyS) { mountBat (poseS, holdS, wrapS); } else { mountGun (poseS, holdS, wrapS); } };
const coordsOfVehicle = (vh) => {
  let hasPair; hasPair = vh && Number.isFinite (vh.x) && Number.isFinite (vh.z);
  if (hasPair) { let outPair = { }; outPair.x = vh.x; outPair.z = vh.z; outPair.y = vh.mesh ? vh.mesh.position.y : 0; return outPair; }
  let meshPos; meshPos = vh && vh.mesh && vh.mesh.position;
  if (! meshPos) { return null; }
  let outMesh = { }; outMesh.x = vh.mesh.position.x; outMesh.z = vh.mesh.position.z; outMesh.y = vh.mesh.position.y; return outMesh; };
let starPxW; starPxW = 128; const STAR_PX = starPxW;
const drawSpokes = (ctxS) => {
  let spokePairs; spokePairs = [];
  spokePairs.push ([52, 0]); spokePairs.push ([- 52, 0]); spokePairs.push ([0, 52]); spokePairs.push ([0, - 52]);
  spokePairs.push ([34, 34]); spokePairs.push ([- 34, - 34]); spokePairs.push ([34, - 34]); spokePairs.push ([- 34, 34]);
  let iterS; iterS = spokePairs [Symbol.iterator] (); let stepS; stepS = iterS.next ();
  while (! stepS.done) { const [offX, offY] = stepS.value; stepS = iterS.next (); ctxS.beginPath (); ctxS.moveTo (64, 64); ctxS.lineTo (64 + offX, 64 + offY); ctxS.stroke (); } };
const paintGlowBase = (ctxG) => {
  let gradG; gradG = ctxG.createRadialGradient (64, 64, 2, 64, 64, 64);
  ctxG.fillStyle = gradG;
  gradG.addColorStop (0, 'rgba(255,240,200,1)');
  gradG.addColorStop (0.35, 'rgba(255,190,90,.75)');
  gradG.addColorStop (1, 'rgba(255,150,40,0)');
  ctxG.fillRect (0, 0, 128, 128);
  ctxG.lineWidth = 5;
  ctxG.strokeStyle = 'rgba(255,230,170,.9)';
  ctxG.lineCap = 'round'; };
const buildStarTexture = () => { let canvasS; canvasS = document.createElement ('canvas');
  canvasS.height = STAR_PX;
  canvasS.width = STAR_PX;
  let ctxT; ctxT = canvasS.getContext ('2d');
  paintGlowBase (ctxT);
  drawSpokes (ctxT);
  return new THREE.CanvasTexture (canvasS); };
const makeBoxMaterial = (toneM, metalM) => {
  let metalVal; if (metalM == null) { metalVal = 0.6; } else { metalVal = metalM; }
  let matM = { }; matM.color = toneM; matM.roughness = 0.45; matM.metalness = metalVal;
  return new THREE.MeshStandardMaterial (matM); };
const buildBoxMesh = (bw, bh, bd, toneB, metalB) => {
  let geoB; geoB = new THREE.BoxGeometry (bw, bh, bd);
  return new THREE.Mesh (geoB, makeBoxMaterial (toneB, metalB)); };
const attachBoxPart = (grpA, widA, heiA, depA, toneA, metalA, posX, posY, posZ, rotX) => {
  let partA; partA = buildBoxMesh (widA, heiA, depA, toneA, metalA);
  partA.position.set (posX, posY, posZ);
  rotX !== undefined ? partA.rotation.x = rotX : null;
  grpA.add (partA);
  return partA; };
const shapePistol = (grpP, darkP) => {
  attachBoxPart (grpP, 0.055, 0.07, 0.24, darkP, null, 0, 0.03, 0.05);
  attachBoxPart (grpP, 0.05, 0.13, 0.06, 0x111214, 0.3, 0, - 0.05, - 0.05, 0.25); };
const shapeSmg = (grpSm, darkS) => {
  attachBoxPart (grpSm, 0.06, 0.09, 0.34, darkS, null, 0, 0.02, 0.06, 0);
  attachBoxPart (grpSm, 0.045, 0.16, 0.06, 0x24262b, null, 0, - 0.08, 0.02, 0.15);
  let cylMat = { }; cylMat.color = 0x2a2d33; cylMat.roughness = 0.4; cylMat.metalness = 0.7;
  let cylS; cylS = new THREE.Mesh (new THREE.CylinderGeometry (0.028, 0.028, 0.14, 10), new THREE.MeshStandardMaterial (cylMat));
  cylS.position.set (0, 0.03, 0.29);
  cylS.rotation.x = (Math.PI / 2);
  grpSm.add (cylS); };
const shapeBat = (grpBt) => {
  let batMat = { }; batMat.color = 0xb08954; batMat.roughness = 0.7; batMat.metalness = 0.05;
  let meshB; meshB = new THREE.Mesh (new THREE.CylinderGeometry (0.032, 0.02, 0.85, 10), new THREE.MeshStandardMaterial (batMat));
  meshB.position.set (0, 0.12, 0.18);
  meshB.rotation.x = ((Math.PI / 2) - 0.5);
  grpBt.add (meshB); };
const proceduralShapeFor = (keyF) => {
  let grpF; grpF = new THREE.Group ();
  let darkF; darkF = 0x1a1c20;
  let buildMap = { }; buildMap.pistol = () => shapePistol (grpF, darkF); buildMap.smg = () => shapeSmg (grpF, darkF); buildMap.bat = () => shapeBat (grpF);
  let buildFn; buildFn = buildMap [keyF];
  buildFn ? buildFn () : null;
  return grpF; };
const closestRaySegment = (orgP, dirV, segP, segQ) => {
  let svec; svec = new THREE.Vector3 ().subVectors (segQ, segP);
  let ovec; ovec = new THREE.Vector3 ().subVectors (orgP, segP);
  let qRR; qRR = dirV.dot (dirV); let qRS; qRS = dirV.dot (svec); let qSS; qSS = svec.dot (svec);
  let qRO; qRO = dirV.dot (ovec); let qSO; qSO = svec.dot (ovec);
  let denomQ; denomQ = ((qRR * qSS) - (qRS * qRS));
  let rayT; rayT = 0; let segT; segT = 0;
  if (Math.abs (denomQ) > 1e-8) { rayT = (((qRS * qSO) - (qSS * qRO)) / denomQ); segT = (((qRR * qSO) - (qRS * qRO)) / denomQ); }
  segT = Math.min (1, Math.max (0, segT));
  rayT = Math.max (0, rayT);
  let ptS; ptS = new THREE.Vector3 ().copy (segP).addScaledVector (svec, segT);
  let ptR; ptR = new THREE.Vector3 ().copy (orgP).addScaledVector (dirV, rayT);
  let outSeg = { }; outSeg.t = rayT; outSeg.dist = ptR.distanceTo (ptS); outSeg.h = (ptS.y - segP.y); outSeg.point = ptS; return outSeg; };
export const initWeapons = (S) => { try {
    if (! S || S.weapons) { return; }
    let kitW = { }; kitW.current = 'pistol'; kitW.reloading = 0;
    let ammoPistolW = { }; ammoPistolW.mag = 12; ammoPistolW.reserve = Infinity;
    let ammoSmgW = { }; ammoSmgW.mag = 30; ammoSmgW.reserve = 240;
    let ammoBatW = { }; ammoBatW.mag = Infinity; ammoBatW.reserve = Infinity;
    let ammoAllW = { }; ammoAllW.pistol = ammoPistolW; ammoAllW.smg = ammoSmgW; ammoAllW.bat = ammoBatW; kitW.ammo = ammoAllW;
    S.weapons = kitW;
    let stW = { }; stW.firing = false; stW.semiLatch = false; stW.cooldown = 0; stW.autoShots = 0; stW.lastEsc = - 10; stW.swingT = 0; stW.flashLife = 0; stW.hitMarkT = 0; stW.held = { }; stW.tracers = []; stW.flatVehicles = new Set (); stW.slotDirty = true;
    let heldGrp; heldGrp = new THREE.Group ();
    heldGrp.position.set (0.24, 1.02, 0.28);
    try { if (S.player && S.player.fig) S.player.fig.add (heldGrp); } catch (e) { }
    const stripKids = (grpK, holdK) => {
      let kidsK; kidsK = [...grpK.children];
      let iterK; iterK = kidsK [Symbol.iterator] (); let stepK; stepK = iterK.next ();
      while (! stepK.done) { const kidK = stepK.value; stepK = iterK.next (); if (kidK !== holdK) grpK.remove (kidK); } };
    const watchModel = (keyM, grpM, holdM) => {
      try {
        let pendingM; pendingM = loadHeroAsset (SLOT_ASSET_MAP [keyM]);
        if (! (pendingM && ('function' === typeof pendingM.then))) return;
        pendingM.then ((wrapM) => {
          try { if (! wrapM) return; stripKids (grpM, holdM); seatModel (keyM, holdM, wrapM); } catch (e) { }
        }).catch (() => { return; });
      } catch (e) { } };
    SLOT_ORDER.forEach ((keyL) => {
      const grpL = proceduralShapeFor (keyL);
      grpL.visible = false;
      stW.held [keyL] = grpL;
      heldGrp.add (grpL);
      const holdL = new THREE.Group ();
      holdL.name = 'glbHolder:' + keyL;
      grpL.add (holdL);
      watchModel (keyL, grpL, holdL); });
    let flashGrp; flashGrp = new THREE.Group ();
    try {
      let texF; texF = buildStarTexture ();
      let matSpecF = { }; matSpecF.map = texF; matSpecF.transparent = true; matSpecF.blending = THREE.AdditiveBlending; matSpecF.depthWrite = false; matSpecF.side = THREE.DoubleSide; matSpecF.color = 0xffc873;
      let matF; matF = new THREE.MeshBasicMaterial (matSpecF);
      let quadA; quadA = new THREE.Mesh (new THREE.PlaneGeometry (0.55, 0.55), matF);
      let quadB; quadB = new THREE.Mesh (new THREE.PlaneGeometry (0.55, 0.55), matF);
      quadB.rotation.y = (Math.PI / 2); quadB.rotation.z = (Math.PI / 4);
      flashGrp.add (quadA);
      flashGrp.add (quadB);
      flashGrp.add (glowSprite (0xffc873, 1.6));
    } catch (e) { }
    let flashLt; flashLt = new THREE.PointLight (0xffc873, 0, 18);
    flashGrp.add (flashLt);
    flashGrp.visible = false;
    try { S.scene.add (flashGrp); } catch (e) { }
    for (let ti = 0; ti < 4; ti++) {
      let matSpecT = { }; matSpecT.color = 0xffd9a0; matSpecT.transparent = true; matSpecT.opacity = 0; matSpecT.blending = THREE.AdditiveBlending; matSpecT.depthWrite = false;
      let nodeT; nodeT = new THREE.Mesh (new THREE.BoxGeometry (0.02, 0.02, 1), new THREE.MeshBasicMaterial (matSpecT));
      nodeT.visible = false;
      try { S.scene.add (nodeT); } catch (e) { }
      let recT = { }; recT.mesh = nodeT; recT.life = 0; stW.tracers.push (recT); }
    let trIdx = 0;
    let crossNode = null; let panelNode = null; let nameNode = null; let ammoNode = null;
    try {
      let styleNode; styleNode = document.createElement ('style');
      styleNode.textContent = '#crosshair{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:60;mix-blend-mode:difference;display:none}' + '#crosshair .ring{position:absolute;inset:0;border:2px solid #fff;border-radius:50%;opacity:.85}' + '#crosshair .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%}' + '#crosshair.hit .ring{border-color:#ff9a2a}#crosshair.hit .dot{background:#ff9a2a}' + '#crosshair.bat .ring{display:none}';
      document.head.appendChild (styleNode);
      crossNode = document.createElement ('div');
      crossNode.id = 'crosshair';
      crossNode.innerHTML = '<div class="ring"></div><div class="dot"></div>';
      document.body.appendChild (crossNode);
      panelNode = document.createElement ('div');
      panelNode.id = 'weaponSlot';
      panelNode.style.cssText = 'position:fixed;right:236px;bottom:18px;z-index:60;background:rgba(8,12,20,.72);border:1px solid rgba(0,245,212,.35);border-radius:12px;padding:8px 12px;font-family:system-ui,sans-serif;color:#e8f6ff;pointer-events:none;min-width:118px;text-align:right';
      panelNode.innerHTML = '<div id="wsName" style="font-size:11px;letter-spacing:.14em;color:#00f5d4"></div>' + '<div id="wsAmmo" style="font-size:22px;font-weight:700;line-height:1.15"></div>' + '<div style="font-size:10px;opacity:.65">[1][2][3] &middot; R reload</div>';
      document.body.appendChild (panelNode);
      ammoNode = panelNode.querySelector ('#wsAmmo');
      nameNode = panelNode.querySelector ('#wsName');
    } catch (e) { }
    const ammoLabelNow = () => {
      let recA; recA = kitW.ammo [kitW.current];
      if (WEAPON_TABLE [kitW.current].melee) return '\u221E';
      let resTxt; if (recA.reserve !== Infinity) { resTxt = recA.reserve; } else { resTxt = '\u221E'; }
      return [recA.mag, resTxt].join (' / '); };
    const refreshPanel = () => {
      if (! stW.slotDirty) return;
      stW.slotDirty = false;
      try {
        let suffixR; if (kitW.reloading > 0) { suffixR = ' \u00B7 RELOADING'; } else { suffixR = ''; }
        if (nameNode) nameNode.textContent = (WEAPON_TABLE [kitW.current].name + suffixR);
        if (ammoNode) ammoNode.textContent = ammoLabelNow ();
        let clsR; if ('bat' === kitW.current) { clsR = 'bat'; } else { clsR = ''; }
        let clsHit; if (stW.hitMarkT > 0) { clsHit = ' hit'; } else { clsHit = ''; }
        if (crossNode) crossNode.className = (clsR + clsHit);
      } catch (e) { } };
    const equip = (keyE) => {
      if (! WEAPON_TABLE [keyE]) return;
      kitW.current = keyE;
      kitW.reloading = 0;
      stW.slotDirty = true;
      let iterE; iterE = SLOT_ORDER [Symbol.iterator] (); let stepE; stepE = iterE.next ();
      while (! stepE.done) { const keyEcho = stepE.value; stepE = iterE.next (); if (stW.held [keyEcho]) stW.held [keyEcho].visible = (keyEcho === keyE); }
      refreshPanel (); };
    kitW.equip = equip;
    const originOfShooter = () => {
      if (S.car) { const ccO = coordsOfVehicle (S.car); if (ccO) return ccO; }
      if (! S.player) { let outNone = { }; outNone.x = 0; outNone.z = 0; outNone.y = 0; return outNone; }
      let outPl = { }; outPl.x = S.player.x; outPl.z = S.player.z; outPl.y = 0; return outPl; };
    const muzzlePos = () => { try {
        if (S.car && S.car.mesh) { return S.car.mesh.localToWorld (new THREE.Vector3 (0.55, 0.8, 0.2)); }
        let heroM; heroM = S.player;
        if (! heroM) return new THREE.Vector3 ();
        let hdM; hdM = (heroM.angle || 0); let gyM; gyM = groundH (heroM.x, heroM.z);
        return new THREE.Vector3 ((heroM.x + ((0.35 * Math.sin (hdM)) + (0.18 * Math.cos (hdM)))), (gyM + 1.32), (heroM.z + ((0.35 * Math.cos (hdM)) - (0.18 * Math.sin (hdM)))));
      } catch (e) { return (new THREE.Vector3 ()); } };
    const sfxPlay = (nm) => {
      try { const auP = S.audio; if (auP && auP.play) auP.play (nm); } catch (e) { } };
    const bumpWanted = (amtB) => {
      try {
        let stampB; stampB = (S.elapsed || 0);
        if ((stampB - stW.lastEsc) < 0.4) return;
        stW.lastEsc = stampB;
        S.wanted = Math.min (5, Math.max (0, ((S.wanted || 0) + amtB)));
      } catch (e) { } };
    const copWithin = (rangeC, fxC, fzC) => {
      let copsC; copsC = (S.cops || []);
      let iterC; iterC = copsC [Symbol.iterator] (); let stepC; stepC = iterC.next ();
      while (! stepC.done) { const copC = stepC.value; stepC = iterC.next (); const ccC = coordsOfVehicle (copC); if (ccC && (Math.hypot ((ccC.x - fxC), (ccC.z - fzC)) < rangeC)) return true; } return false; };
    const pedWithin = (rangeP, fxP, fzP) => {
      let pedsP; pedsP = (S.peds || []);
      let iterP; iterP = pedsP [Symbol.iterator] (); let stepP; stepP = iterP.next ();
      while (! stepP.done) { const pedP = stepP.value; stepP = iterP.next (); if (! pedP.downed && (Math.hypot ((pedP.x - fxP), (pedP.z - fzP)) < rangeP)) return true; } return false; };
    const witnessWithin = (rangeCopW, rangePedW, fxW, fzW) => {
      try { return copWithin (rangeCopW, fxW, fzW) || pedWithin (rangePedW, fxW, fzW); } catch (e) { } return false; };
    const startFlee = (pedFl, fxF, fzF, spanF) => {
      let axF; axF = (pedFl.x - fxF); let azF; azF = (pedFl.z - fzF); let lenF; lenF = (Math.hypot (axF, azF) || 1);
      let dirF = { }; dirF.x = (axF / lenF); dirF.z = (azF / lenF); pedFl.fleeDir = dirF;
      pedFl.fleeT = spanF; };
    const scatterPeds = (fxSc, fzSc, rangeSc, loSc, hiSc, oddsSc) => {
      try {
        let pedsSc; pedsSc = (S.peds || []);
        let iterSc; iterSc = pedsSc [Symbol.iterator] (); let stepSc; stepSc = iterSc.next ();
        while (! stepSc.done) {
          const pedSc = stepSc.value; stepSc = iterSc.next ();
          if (pedSc.downed) continue;
          const inRangeSc = (Math.hypot ((pedSc.x - fxSc), (pedSc.z - fzSc)) < rangeSc);
          if (inRangeSc && ((oddsSc == null) || chance (oddsSc))) startFlee (pedSc, fxSc, fzSc, rr (loSc, hiSc));
        }
      } catch (e) { } };
    const downPed = (pedD) => {
      pedD.downed = true;
      pedD.downedT = rr (6, 10);
      pedD.fleeT = 0;
      pedD._tipped = true;
      try { pedD.fig.rotation.x = - 1.35; pedD.fig.position.y = (groundH (pedD.x, pedD.z) + 0.15); } catch (e) { } };
    const woundPed = (pedWd, dmgW, isBatW, fxWd, fzWd) => {
      if (pedWd.hp == null) pedWd.hp = 100;
      pedWd.hp = pedWd.hp - dmgW;
      if (! (pedWd.hp > 0) || isBatW) { downPed (pedWd); return true; }
      startFlee (pedWd, fxWd, fzWd, 1.6);
      return false; };
    const flashShow = (posFl) => {
      try {
        flashGrp.position.copy (posFl);
        flashGrp.rotation.set (rr (0, 3), rr (0, 3), rr (0, 3));
        stW.flashLife = 0.05;
        flashLt.intensity = 26;
        flashGrp.visible = true;
      } catch (e) { } };
    const tracerShow = (fromTr, toTr) => { const tr = stW.tracers [trIdx++ % stW.tracers.length];
      if (! tr) { return; }
      let spanTr; spanTr = fromTr.distanceTo (toTr);
      if (! (spanTr >= 0.5)) return;
      let midTr; midTr = new THREE.Vector3 (); midTr.copy (fromTr); midTr.add (toTr); midTr.multiplyScalar (0.5);
      tr.mesh.position.copy (midTr);
      tr.mesh.lookAt (toTr);
      tr.mesh.scale.set (1, 1, spanTr);
      tr.life = 0.04; tr.mesh.material.opacity = 0.85; tr.mesh.visible = true; };
    const reloadStart = () => {
      let specR; specR = WEAPON_TABLE [kitW.current]; let recR; recR = kitW.ammo [kitW.current];
      if (specR.melee || (kitW.reloading > 0)) return;
      if ((recR.mag >= specR.mag) || ! (recR.reserve > 0)) return;
      kitW.reloading = specR.reload;
      stW.slotDirty = true;
      sfxPlay ('reload'); };
    const swingPeds = (specSw, srcSw, faceXSw, faceZSw) => {
      let anySw = false;
      try {
        let pedsSw; pedsSw = (S.peds || []);
        let iterSw; iterSw = pedsSw [Symbol.iterator] (); let stepSw; stepSw = iterSw.next ();
        while (! stepSw.done) {
          const pedSw = stepSw.value; stepSw = iterSw.next ();
          if (pedSw.downed) continue;
          const oxSw = (pedSw.x - srcSw.x), ozSw = (pedSw.z - srcSw.z), distSw = Math.hypot (oxSw, ozSw);
          const reachOkSw = ! (distSw > specSw.range) && (distSw > 0.001);
          const dotSw = (((oxSw / distSw) * faceXSw) + ((ozSw / distSw) * faceZSw));
          if (reachOkSw && (dotSw > 0.4)) { woundPed (pedSw, specSw.dmg, true, srcSw.x, srcSw.z); anySw = true; }
        }
      } catch (e) { }
      return anySw; };
    const swingVehicles = (specSv, srcSv) => {
      let anySv = false;
      try {
        let allSv = []; allSv = allSv.concat ((S.vehicles || []), (S.cops || []), (S.traffic || []));
        let iterSv; iterSv = allSv [Symbol.iterator] (); let stepSv; stepSv = iterSv.next ();
        while (! stepSv.done) {
          const vehSv = stepSv.value; stepSv = iterSv.next ();
          if (S.car && (vehSv === S.car)) continue;
          const vpSv = coordsOfVehicle (vehSv);
          if (! vpSv) continue;
          if (Math.hypot ((vpSv.x - srcSv.x), (vpSv.z - srcSv.z)) > (specSv.range + 1.2)) continue;
          try { damageVehicle (S, vehSv, specSv.dmg); } catch (e) { }
          anySv = true;
          if (copWithin (25, vpSv.x, vpSv.z)) bumpWanted (0.4);
        }
      } catch (e) { }
      return anySv; };
    const batSwing = () => {
      let specB; specB = WEAPON_TABLE.bat;
      stW.swingT = 0.22;
      sfxPlay ('swing');
      let srcB; srcB = originOfShooter ();
      let hdB; if (S.car) { hdB = (S.car.angle || 0); } else if (S.player) { hdB = (S.player.angle || 0); } else { hdB = 0; }
      let anyB; anyB = swingPeds (specB, srcB, Math.sin (hdB), Math.cos (hdB));
      anyB = swingVehicles (specB, srcB) || anyB;
      if (anyB) {
        sfxPlay ('thud');
        scatterPeds (srcB.x, srcB.z, 6, 1.2, 2.2, 0.4);
        stW.hitMarkT = 0.09;
        stW.slotDirty = true; } };
    const scanPedSegs = (fromPs, dirPs, probePs) => {
      try {
        let pedsPs; pedsPs = (S.peds || []);
        let iterPs; iterPs = pedsPs [Symbol.iterator] (); let stepPs; stepPs = iterPs.next ();
        while (! stepPs.done) {
          const pedPs = stepPs.value; stepPs = iterPs.next ();
          if (pedPs.downed) continue;
          let baseYPs; baseYPs = groundH (pedPs.x, pedPs.z);
          let segLo; segLo = new THREE.Vector3 (pedPs.x, (baseYPs + 0.2), pedPs.z);
          let segHi; segHi = new THREE.Vector3 (pedPs.x, (baseYPs + 1.6), pedPs.z);
          let hitPs; hitPs = closestRaySegment (fromPs, dirPs, segLo, segHi);
          if (hitPs && (hitPs.dist < 0.42) && (hitPs.t < probePs.nearestT)) {
            probePs.nearestT = hitPs.t;
            let hitRecPs = { }; hitRecPs.kind = 'ped'; hitRecPs.ped = pedPs; hitRecPs.point = hitPs.point; hitRecPs.head = (hitPs.h > 1.45); probePs.nearestHit = hitRecPs;
          }
        }
      } catch (e) { } };
    const scanVehSegs = (fromVs, dirVs, probeVs) => {
      try {
        let allVs = []; allVs = allVs.concat ((S.vehicles || []), (S.cops || []), (S.traffic || []));
        let iterVs; iterVs = allVs [Symbol.iterator] (); let stepVs; stepVs = iterVs.next ();
        while (! stepVs.done) {
          const vehVs = stepVs.value; stepVs = iterVs.next ();
          if (S.car && (vehVs === S.car)) continue;
          const vpVs = coordsOfVehicle (vehVs);
          if (! vpVs) continue;
          const vsVs = (vehVs.spec || { });
          const radiusVs = ((Math.max ((vsVs.len || 4), (vsVs.wid || 1.8)) / 2) * 0.9);
          const centreVs = new THREE.Vector3 (vpVs.x, ((vpVs.y || groundH (vpVs.x, vpVs.z)) + 0.55), vpVs.z);
          const relVs = new THREE.Vector3 ().subVectors (fromVs, centreVs);
          const projVs = relVs.dot (dirVs);
          const discVs = ((projVs * projVs) - (relVs.lengthSq () - (radiusVs * radiusVs)));
          if (discVs < 0) continue;
          const tHitVs = ((- projVs) - Math.sqrt (discVs));
          if ((tHitVs > 0) && (tHitVs < probeVs.nearestT)) {
            probeVs.nearestT = tHitVs;
            let hitRecVs = { }; hitRecVs.kind = 'vehicle'; hitRecVs.v = vehVs; hitRecVs.point = new THREE.Vector3 ().copy (fromVs).addScaledVector (dirVs, tHitVs); probeVs.nearestHit = hitRecVs;
          }
        }
      } catch (e) { } };
    const wheelCheck = (hitWh, vpWh, vehWh) => {
      try {
        let vsWh; vsWh = (vehWh.spec || { });
        let lenWh; lenWh = (vsWh.len || 4); let widWh; widWh = (vsWh.wid || 1.8); let hdWh; hdWh = (vehWh.angle || 0);
        let fxWh; fxWh = Math.sin (hdWh); let fzWh; fzWh = Math.cos (hdWh); let sxWh; sxWh = Math.cos (hdWh); let szWh; szWh = - Math.sin (hdWh);
        if (! ((hitWh.point.y - groundH (vpWh.x, vpWh.z)) < 0.45)) return;
        let signsFirstWh = [1, - 1];
        let signsSecondWh = [1, - 1];
        let foundWh = false;
        let iterFirstWh; iterFirstWh = signsFirstWh [Symbol.iterator] (); let stepFirstWh; stepFirstWh = iterFirstWh.next ();
        while (! stepFirstWh.done && ! foundWh) {
          const sFirstWh = stepFirstWh.value; stepFirstWh = iterFirstWh.next ();
          let iterSecondWh; iterSecondWh = signsSecondWh [Symbol.iterator] (); let stepSecondWh; stepSecondWh = iterSecondWh.next ();
          while (! stepSecondWh.done && ! foundWh) {
            const sSecondWh = stepSecondWh.value; stepSecondWh = iterSecondWh.next ();
            const wxWh = ((vpWh.x + (((0.32 * lenWh) * sFirstWh) * fxWh)) + (((widWh / 2) * sSecondWh) * sxWh));
            const wzWh = ((vpWh.z + (((0.32 * lenWh) * sFirstWh) * fzWh)) + (((widWh / 2) * sSecondWh) * szWh));
            if (Math.hypot ((hitWh.point.x - wxWh), (hitWh.point.z - wzWh)) < 0.45) { vehWh.tireFlat = 5; stW.flatVehicles.add (vehWh); foundWh = true; }
          }
        }
      } catch (e) { } };
    const emptyMag = (recEm) => {
      if (! (recEm.reserve > 0)) {
        sfxPlay ('dry');
        try { if (S.toast) S.toast ('Out of ammo'); } catch (e) { } } else reloadStart (); };
    const scatterDir = (dirSd, specSd) => {
      let upSc; if (Math.abs (dirSd.y) > 0.9) { upSc = new THREE.Vector3 (1, 0, 0); } else { upSc = new THREE.Vector3 (0, 1, 0); }
      let axASc; axASc = new THREE.Vector3 ().crossVectors (dirSd, upSc).normalize ();
      let axBSc; axBSc = new THREE.Vector3 ().crossVectors (dirSd, axASc).normalize ();
      dirSd.addScaledVector (axASc, rr (- specSd.spread, specSd.spread)).addScaledVector (axBSc, rr (- specSd.spread, specSd.spread)).normalize (); };
    const groundPoint = (fromGp, dirGp, specGp) => {
      let outGp = null;
      if (dirGp.y < - 0.001) {
        const tGp = ((- fromGp.y) / dirGp.y);
        if ((tGp > 0) && ! (tGp > specGp.range)) outGp = new THREE.Vector3 ().copy (fromGp).addScaledVector (dirGp, tGp);
      } return outGp; };
    const pedHitSettle = (hitPh, specPh, srcPh) => {
      let multPh; if (hitPh.head) { multPh = 2; } else { multPh = 1; }
      woundPed (hitPh.ped, (specPh.dmg * multPh), false, srcPh.x, srcPh.z);
      stW.hitMarkT = 0.09;
      stW.slotDirty = true;
      bumpWanted (0.5);
      scatterPeds (hitPh.ped.x, hitPh.ped.z, 14, 1.2, 2.2, null); return true; };
    const vehHitSettle = (hitVh, specVh) => {
      let vehVh; vehVh = hitVh.v;
      try { damageVehicle (S, vehVh, specVh.dmg); } catch (e) { }
      try { spawnSmokeAt (S, hitVh.point, 2, false); } catch (e) { }
      stW.hitMarkT = 0.09;
      stW.slotDirty = true;
      let vpVh; vpVh = coordsOfVehicle (vehVh);
      if (vpVh) wheelCheck (hitVh, vpVh, vehVh);
      if ((vehVh.driver === 'cop') || (S.cops || []).includes (vehVh)) { bumpWanted (0.8); return true; } else { return false; } };
    const witnessEscalate = (specWe, srcWe) => {
      stW.autoShots++;
      if ((stW.autoShots >= 5) || ! specWe.auto) {
        stW.autoShots = 0;
        if (witnessWithin (70, 30, srcWe.x, srcWe.z)) bumpWanted (0.25); } };
    const shotFire = () => {
      let keySh; keySh = kitW.current; let specSh; specSh = WEAPON_TABLE [keySh]; let recSh; recSh = kitW.ammo [keySh];
      if (! (recSh.mag > 0)) { emptyMag (recSh); return; }
      recSh.mag--;
      stW.slotDirty = true;
      let sfxNameSh; if ('smg' === keySh) { sfxNameSh = 'smg'; } else { sfxNameSh = 'shot'; } sfxPlay (sfxNameSh); if (! S.car && S.player) { try { S.player.angle = S.camYaw; } catch (e) { } }
      let fromSh; fromSh = new THREE.Vector3 (); let dirSh; dirSh = new THREE.Vector3 ();
      try { S.camera.getWorldPosition (fromSh); S.camera.getWorldDirection (dirSh); } catch (e) { return; }
      if (specSh.spread > 0) scatterDir (dirSh, specSh);
      let muzzleSh; muzzleSh = muzzlePos ();
      flashShow (muzzleSh);
      let srcSh; srcSh = originOfShooter ();
      let probeSh = { }; probeSh.nearestT = specSh.range; probeSh.nearestHit = null;
      scanPedSegs (fromSh, dirSh, probeSh);
      scanVehSegs (fromSh, dirSh, probeSh);
      let groundPtSh; groundPtSh = groundPoint (fromSh, dirSh, specSh);
      let endSh; if (probeSh.nearestHit) { endSh = probeSh.nearestHit.point; } else if (groundPtSh) { endSh = groundPtSh; } else { endSh = new THREE.Vector3 ().copy (fromSh).addScaledVector (dirSh, specSh.range); }
      tracerShow (muzzleSh, endSh);
      let crimeSh = false;
      let hitSh; hitSh = probeSh.nearestHit;
      if (hitSh && ('ped' === hitSh.kind)) crimeSh = pedHitSettle (hitSh, specSh, srcSh);
      else if (hitSh && ('vehicle' === hitSh.kind)) crimeSh = vehHitSettle (hitSh, specSh);
      else if (groundPtSh && (! hitSh || ! (probeSh.nearestT < specSh.range))) { try { spawnSmokeAt (S, groundPtSh, 2, false); } catch (e) { } }
      if (! crimeSh) witnessEscalate (specSh, srcSh);
      try { const heldSh = stW.held [keySh]; if (heldSh) heldSh.position.z = - 0.03; } catch (e) { } };
    const fireTry = () => {
      if (S.paused || (S.mode !== 'play')) return;
      if ((kitW.reloading > 0) || (stW.cooldown > 0)) return;
      let specFt; specFt = WEAPON_TABLE [kitW.current];
      stW.cooldown = specFt.interval;
      specFt.melee ? batSwing () : shotFire (); };
    let canvasNode; canvasNode = S.canvas || (S.renderer && S.renderer.domElement) || null;
    const ptrDown = (evD) => {
      if (evD.button !== 0) return;
      if ((S.mode !== 'play') || S.paused) { return; }
      stW.firing = true;
      if (WEAPON_TABLE [kitW.current].auto) fireTry ();
      else if (! stW.semiLatch) { stW.semiLatch = true; fireTry (); } };
    const ptrUp = (evU) => {
      if (evU.button === 0) { stW.firing = false; stW.semiLatch = false; } };
    try {
      if (canvasNode && canvasNode.addEventListener) canvasNode.addEventListener ('pointerdown', ptrDown);
      else if ('undefined' !== typeof window) window.addEventListener ('pointerdown', ptrDown);
      if ('undefined' !== typeof window) { window.addEventListener ('pointerup', ptrUp); window.addEventListener ('blur', ptrUp); }
    } catch (e) { }
    const keyWeapon = (evK) => {
      if (S.mode !== 'play') return;
      if (S.paused) return;
      let byCodeK = { }; byCodeK ['Digit1'] = 'pistol'; byCodeK ['Digit2'] = 'smg'; byCodeK ['Digit3'] = 'bat';
      if (byCodeK [evK.code]) equip (byCodeK [evK.code]);
      else if (evK.code === 'KeyQ') { const idxK = SLOT_ORDER.indexOf (kitW.current); equip (SLOT_ORDER [(idxK + 1) % SLOT_ORDER.length]); }
      else if (evK.code === 'KeyR') reloadStart (); };
    try { window.addEventListener ('keydown', keyWeapon); } catch (e) { }
    equip ('pistol');
    const reloadFinish = () => {
      if (! (kitW.reloading > 0)) return;
      kitW.reloading = 0;
      let specRf; specRf = WEAPON_TABLE [kitW.current]; let recRf; recRf = kitW.ammo [kitW.current];
      let shortRf; shortRf = (specRf.mag - recRf.mag);
      let movedRf; if (recRf.reserve === Infinity) { movedRf = shortRf; } else { movedRf = Math.min (shortRf, recRf.reserve); }
      recRf.mag = recRf.mag + movedRf;
      if (recRf.reserve !== Infinity) recRf.reserve = recRf.reserve - movedRf;
      stW.slotDirty = true; };
    let prevDtW = 0;
    const flashTick = (altFl) => {
      let forcedFl; forcedFl = altFl.flags && altFl.flags.forceFlash;
      if (forcedFl) {
        try {
          let ptFl = null;
          if ((altFl.flags.forceFlash === 'car') && altFl.flags.flashCar && altFl.flags.flashCar.mesh) ptFl = altFl.flags.flashCar.mesh.localToWorld (new THREE.Vector3 (0.55, 0.8, 0.2));
          else ptFl = muzzlePos ();
          flashGrp.position.copy (ptFl);
          flashGrp.visible = true;
          flashLt.intensity = 26;
        } catch (e) { }
      } else if (stW.flashLife > 0) {
        stW.flashLife = stW.flashLife - prevDtW;
        flashLt.intensity = (26 * Math.max (0, (stW.flashLife / 0.05)));
        if (! (stW.flashLife > 0)) { flashGrp.visible = false; flashLt.intensity = 0; }
      } else if (flashGrp.visible) { flashGrp.visible = false; flashLt.intensity = 0; } };
    const tracerTick = (dtTt) => {
      let iterTt; iterTt = stW.tracers [Symbol.iterator] (); let stepTt; stepTt = iterTt.next ();
      while (! stepTt.done) {
        const trTt = stepTt.value; stepTt = iterTt.next ();
        if (! (trTt.life > 0)) continue;
        trTt.life = trTt.life - dtTt;
        trTt.mesh.material.opacity = (0.85 * Math.max (0, (trTt.life / 0.04)));
        if (! (trTt.life > 0)) trTt.mesh.visible = false;
      } };
    const flatTick = (dtFlB) => {
      if (! stW.flatVehicles.size) return;
      let flatListFl; flatListFl = [...stW.flatVehicles];
      let iterFl; iterFl = flatListFl [Symbol.iterator] (); let stepFl; stepFl = iterFl.next ();
      while (! stepFl.done) {
        const vehFl = stepFl.value; stepFl = iterFl.next ();
        try {
          if (vehFl.tireFlat > 0) { vehFl.tireFlat = vehFl.tireFlat - dtFlB; if (vehFl.mesh) vehFl.mesh.rotation.z = 0.03; }
          else { if (vehFl.mesh) vehFl.mesh.rotation.z = 0; stW.flatVehicles.delete (vehFl); }
        } catch (e) { stW.flatVehicles.delete (vehFl); } } };
    const swingPose = (heldSwB, dtSw) => {
      if (stW.swingT > 0) {
        stW.swingT = stW.swingT - dtSw;
        let shareSw; shareSw = (1 - (Math.max (0, stW.swingT) / 0.22));
        if (shareSw < 0.55) { heldSwB.rotation.x = (- 0.4 - (1.5 * (shareSw / 0.55))); } else { heldSwB.rotation.x = (- 1.9 + (1.5 * ((shareSw - 0.55) / 0.45))); }
      } else heldSwB.rotation.x = - 0.4; };
    const heldTick = (altHt, dtHt) => {
      let onFootHt; onFootHt = ! altHt.car && ('play' === altHt.mode);
      if (heldGrp.parent !== (altHt.player && altHt.player.fig)) {
        try { if (altHt.player && altHt.player.fig) altHt.player.fig.add (heldGrp); } catch (e) { }
      }
      heldGrp.visible = ! ! onFootHt;
      let heldHt; heldHt = stW.held [kitW.current];
      if (! heldHt) return;
      heldHt.position.z = heldHt.position.z + ((0 - heldHt.position.z) * Math.min (1, (14 * dtHt)));
      WEAPON_TABLE [kitW.current].melee ? swingPose (heldHt, dtHt) : null; };
    const hudVisTick = (altHv) => {
      try {
        if (crossNode) { if (('play' === altHv.mode) && ! altHv.paused) { crossNode.style.display = 'block'; } else { crossNode.style.display = 'none'; } }
        if (panelNode) { if ('play' === altHv.mode) { panelNode.style.display = 'block'; } else { panelNode.style.display = 'none'; } }
      } catch (e) { } };
    S.updaters.push ((altUp, dtUp) => {
      try {
        prevDtW = dtUp;
        if (stW.cooldown > 0) stW.cooldown = stW.cooldown - dtUp;
        if (kitW.reloading > 0) { kitW.reloading = kitW.reloading - dtUp; if (! (kitW.reloading > 0)) reloadFinish (); }
        if (stW.firing && WEAPON_TABLE [kitW.current].auto) fireTry ();
        if (stW.hitMarkT > 0) { stW.hitMarkT = stW.hitMarkT - dtUp; if (! (stW.hitMarkT > 0)) stW.slotDirty = true; }
        heldTick (altUp, dtUp);
        flashTick (altUp);
        tracerTick (dtUp);
        flatTick (dtUp);
        hudVisTick (altUp);
        refreshPanel ();
      } catch (e) { }
    });
  } catch (outer) { try { if (S && ! S.weapons) S.weapons = null; } catch (e) { } } };
