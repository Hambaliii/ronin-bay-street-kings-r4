// The player on foot, plus the factory that builds textured figures
// Proportions sit near seven and a half heads tall, built from
// capsule and lathe parts with clothing from procedural canvases
import * as THREE from 'three'; import { CAST } from './config.js';
import { groundH } from './world.js'; import { loadHeroAsset } from './assets.js';
// The loaded model may take over as the hero visual, while the
// outer group remains the one the updater positions and rotates
// Inside sits either the procedural figure or a clone of the
// loaded wrapper, held by an inner group that bobs, rocks and
// leans as it moves
// A failed load resolves null and nothing swaps, so the
// procedural figure stays as the exact fallback, and a single
// constant flips facing
const MC_YAW_OFFSET = 0;
let templateMc = null; let loadMcStarted = false;
const waitersMc = new Set();
function shadowDiscMesh(radiusGiven) {
  const discMesh = new THREE.Mesh(new THREE.CircleGeometry(radiusGiven, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  discMesh.rotation.x = (-Math.PI / 2); discMesh.position.y = 0.02;
  return discMesh; }
function tryMcSwap(playerGiven) {
  try {
    const swapBlocked = !playerGiven || !templateMc || playerGiven.figIsGlb;
    if (swapBlocked) return false;
    const holderBuilt = new THREE.Group();
    holderBuilt.name = 'mc-glb-inner'; holderBuilt.rotation.y = MC_YAW_OFFSET;
    holderBuilt.add(templateMc.clone(true));
    if (playerGiven.procFig) playerGiven.fig.remove(playerGiven.procFig);
    playerGiven.fig.add(holderBuilt);
    const shadowBuilt = shadowDiscMesh(0.42);
    playerGiven.fig.add(shadowBuilt);
    playerGiven.glbInner = holderBuilt; playerGiven.glbShadow = shadowBuilt; playerGiven.visual = holderBuilt; playerGiven.figIsGlb = true;
    return true;
  } catch (ignoredFault) { return false; } }
function loadMcRound(roundsLeft) {
  try {
    loadHeroAsset('mc').then((wrapGiven) => {
      try {
        if (!wrapGiven) { if (roundsLeft > 0) setTimeout(() => loadMcRound(roundsLeft - 1), 1500); return; }
        templateMc = wrapGiven;
        waitersMc.forEach((waitingOne) => tryMcSwap(waitingOne));
        waitersMc.clear();
      } catch (ignoredFault) { /* procedural fallback stays */ }
    }).catch(() => { if (roundsLeft > 0) setTimeout(() => loadMcRound(roundsLeft - 1), 1500); });
  } catch (ignoredFault) { /* procedural fallback stays */ } }
function startMcLoad() {
  if (loadMcStarted) return;
  loadMcStarted = true;
  // A null result is retried rather than treated as final,
  // because racing loads at module init can lose the fetch race
  // and a cached null would strand every waiter on the
  // procedural figure for the whole session, while the asset
  // module evicts nulls when a retry comes
  loadMcRound(3); }
startMcLoad();
// Loaded visuals replacing cast figures follow the same pattern
// The rival driver and the officer each map to their own asset
// and both face forward, so zero rotation matches the procedural
// facing exactly
// The group the factory returns stays outer, its transform and
// animation untouched, and only the inner visual changes when
// the model arrives
const CAST_YAW_OFFSET = 0;
const CAST_TO_ASSET = { shun: 'rivalDriver', cop: 'policeOfficer' };
const templatesCast = new Map(); const startedCast = new Set(); const waitersCast = new Map();
function tryCastSwap(figureGiven, assetGiven) {
  try {
    const templateNow = templatesCast.get(assetGiven);
    const swapBlocked = !figureGiven || !templateNow || figureGiven.userData.figIsGlb;
    if (swapBlocked) return false;
    const holderBuilt = new THREE.Group();
    holderBuilt.name = 'cast-glb-inner'; holderBuilt.rotation.y = CAST_YAW_OFFSET;
    holderBuilt.add(templateNow.clone(true));
    const parkedProcedural = new THREE.Group();
    parkedProcedural.name = 'cast-proc-visual';
    while (figureGiven.children.length) parkedProcedural.add(figureGiven.children[0]);
    figureGiven.add(holderBuilt);
    const shadowBuilt = shadowDiscMesh(0.42);
    figureGiven.add(shadowBuilt);
    figureGiven.userData.procFig = parkedProcedural; figureGiven.userData.glbInner = holderBuilt; figureGiven.userData.glbShadow = shadowBuilt; figureGiven.userData.figIsGlb = true;
    if (figureGiven.userData.seated) holderBuilt.position.y = -0.55;
    figureGiven.figIsGlb = true;
    return true;
  } catch (ignoredFault) { return false; } }
function startCastLoad(assetGiven) {
  if (startedCast.has(assetGiven)) return;
  startedCast.add(assetGiven);
  try {
    loadHeroAsset(assetGiven).then((wrapGiven) => {
      try {
        if (!wrapGiven) return;
        templatesCast.set(assetGiven, wrapGiven);
        const waiterSet = waitersCast.get(assetGiven);
        if (waiterSet) { waiterSet.forEach((figureGiven) => tryCastSwap(figureGiven, assetGiven)); waiterSet.clear(); }
      } catch (ignoredFault) { /* procedural fallback stays */ }
    }).catch(() => { /* procedural fallback stays */ });
  } catch (ignoredFault) { /* procedural fallback stays */ } }
export function applyCastFigureOverride(figureGiven, castGiven) {
  try {
    if (!figureGiven || !castGiven) return false;
    const assetGiven = CAST_TO_ASSET[castGiven];
    if (!assetGiven) return false;
    figureGiven.userData.castKey = castGiven;
    if (figureGiven.userData.figIsGlb) return true;
    startCastLoad(assetGiven);
    if (tryCastSwap(figureGiven, assetGiven)) return true;
    if (!waitersCast.has(assetGiven)) waitersCast.set(assetGiven, new Set());
    waitersCast.get(assetGiven).add(figureGiven);
    return true;
  } catch (ignoredFault) { return false; } }
// Texture noise stays deterministic via a small local generator
function noiseFromSeed(seedGiven) {
  let cellValue = ((seedGiven * 7919) + 13);
  const nextUnit = () => { cellValue = ((cellValue * 16807) % 2147483647); return ((cellValue & 0xffff) / 0xffff); };
  return nextUnit; }
function cssHexOf(colourGiven) { const hexBody = colourGiven.toString(16).padStart(6, '0'); const cssOut = ('#' + hexBody); return cssOut; }
function cssHexScaledOf(colourGiven, scaleGiven) { const colourTmp = new THREE.Color(colourGiven); colourTmp.multiplyScalar(scaleGiven); const cssOut = ('#' + colourTmp.getHexString()); return cssOut; }

// The clothing canvas texture
// Its front design centres on a quarter of the wrap and the
// plain back sits at three quarters, while lathe and cylinder
// mapping wrap around the circumference with the seam at the
// back by default, so rotating a part by half a turn brings
// the front around to face forward
export function makeClothTexture(kindGiven, topGiven, trimGiven, pantsGiven) {
  const canvasBuilt = document.createElement('canvas'); canvasBuilt.width = canvasBuilt.height = 256;
  const penBuilt = canvasBuilt.getContext('2d');
  const noiseSource = noiseFromSeed((kindGiven.length * 131) + (topGiven % 10000));
  const nextNoise = noiseSource;
  penBuilt.fillStyle = cssHexOf(topGiven); penBuilt.fillRect(0, 0, 256, 256);
  for (let nIdx = 0; nIdx < 1400; nIdx++) { penBuilt.fillStyle = `rgba(0,0,0,${0.03 + 0.05 * nextNoise()})`; penBuilt.fillRect(256 * noiseSource(), 256 * noiseSource(), 2, 1); }
  for (let nIdx = 0; nIdx < 700; nIdx++) { penBuilt.fillStyle = `rgba(255,255,255,${0.02 + 0.04 * nextNoise()})`; penBuilt.fillRect(256 * noiseSource(), 256 * noiseSource(), 2, 1); }
  const shadeGrad = penBuilt.createLinearGradient(0, 0, 256, 0);
  shadeGrad.addColorStop(0, 'rgba(0,0,0,.28)'); shadeGrad.addColorStop(0.25, 'rgba(255,255,255,.10)');
  shadeGrad.addColorStop(0.5, 'rgba(0,0,0,.28)'); shadeGrad.addColorStop(0.75, 'rgba(255,255,255,.05)'); shadeGrad.addColorStop(1, 'rgba(0,0,0,.28)');
  penBuilt.fillStyle = shadeGrad; penBuilt.fillRect(0, 0, 256, 256);
  const FRONT_AT = 64;
  const pantsKind = (kindGiven === 'jeans') || (kindGiven === 'uniform-pants');
  const jacketKind = (kindGiven === 'jacket') || (kindGiven === 'leather');
  if (pantsKind) {
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.75); penBuilt.fillRect(0, 0, 256, 256);
    for (let nIdx = 0; nIdx < 1400; nIdx++) { penBuilt.fillStyle = `rgba(255,255,255,${0.03 + 0.04 * nextNoise()})`; penBuilt.fillRect(256 * noiseSource(), 256 * noiseSource(), 1, 3); }
    penBuilt.fillStyle = shadeGrad; penBuilt.fillRect(0, 0, 256, 256);
    penBuilt.lineWidth = 2; penBuilt.strokeStyle = 'rgba(0,0,0,.45)';
    penBuilt.beginPath(); penBuilt.arc((FRONT_AT + (-26)), 44, 16, 0.2, 2.4); penBuilt.stroke();
    penBuilt.beginPath(); penBuilt.arc((FRONT_AT + 26), 44, 16, 0.7, 2.9); penBuilt.stroke();
    penBuilt.strokeStyle = 'rgba(255,200,120,.5)'; penBuilt.beginPath(); penBuilt.moveTo(FRONT_AT, 30); penBuilt.lineTo(FRONT_AT, 120); penBuilt.stroke();
    penBuilt.fillStyle = '#3a2a1a'; penBuilt.fillRect(0, 0, 256, 22);
    penBuilt.fillStyle = '#c0c4c8'; penBuilt.fillRect((FRONT_AT + (-10)), 4, 20, 14); penBuilt.fillStyle = '#3a2a1a'; penBuilt.fillRect((FRONT_AT + (-5)), 7, 10, 8);
  } else if (jacketKind) {
    if (kindGiven === 'leather') { const sheenGrad = penBuilt.createLinearGradient(0, 0, 256, 256); sheenGrad.addColorStop(0, 'rgba(255,255,255,.16)'); sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0)'); penBuilt.fillStyle = sheenGrad; penBuilt.fillRect(0, 0, 256, 256); }
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.7); penBuilt.fillRect(0, 0, 256, 26);
    if (trimGiven) { penBuilt.fillStyle = cssHexOf(trimGiven); penBuilt.fillRect(0, 22, 256, 5); }
    penBuilt.lineWidth = 4; penBuilt.strokeStyle = '#14161a'; penBuilt.beginPath();
    if (kindGiven === 'leather') { penBuilt.moveTo((FRONT_AT + (-30)), 26); penBuilt.lineTo((FRONT_AT + 22), 200); } else { penBuilt.moveTo(FRONT_AT, 26); penBuilt.lineTo(FRONT_AT, 240); }
    penBuilt.stroke();
    penBuilt.lineWidth = 1; penBuilt.strokeStyle = '#9aa0a6';
    for (let yAt = 30; yAt < 235; yAt += 7) { const zipShare = ((yAt + (-26)) / 210); const zipAt = (kindGiven === 'leather') ? ((FRONT_AT + (-30)) + (52 * zipShare)) : FRONT_AT; penBuilt.beginPath(); penBuilt.moveTo((zipAt + (-4)), yAt); penBuilt.lineTo((zipAt + 4), yAt); penBuilt.stroke(); }
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.82); penBuilt.fillRect((FRONT_AT + (-52)), 84, 34, 16); penBuilt.fillRect((FRONT_AT + 18), 84, 34, 16);
    penBuilt.fillStyle = 'rgba(0,0,0,.35)'; penBuilt.fillRect((FRONT_AT + (-52)), 98, 34, 3); penBuilt.fillRect((FRONT_AT + 18), 98, 34, 3);
    if (trimGiven) { penBuilt.fillStyle = cssHexOf(trimGiven); penBuilt.fillRect(0, 218, 256, 8); }
  } else if (kindGiven === 'hoodie') {
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.78); penBuilt.fillRect(0, 0, 256, 34);
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.85); penBuilt.fillRect((FRONT_AT + (-38)), 176, 76, 52);
    penBuilt.strokeStyle = 'rgba(0,0,0,.3)'; penBuilt.strokeRect((FRONT_AT + (-38)), 176, 76, 52);
    penBuilt.lineWidth = 3; penBuilt.strokeStyle = '#f2f2f2';
    penBuilt.beginPath(); penBuilt.moveTo((FRONT_AT + (-8)), 36); penBuilt.lineTo((FRONT_AT + (-12)), 66); penBuilt.stroke();
    penBuilt.beginPath(); penBuilt.moveTo((FRONT_AT + 8), 36); penBuilt.lineTo((FRONT_AT + 12), 66); penBuilt.stroke();
  } else if (kindGiven === 'tank') {
    penBuilt.fillStyle = 'rgba(0,0,0,.10)'; penBuilt.beginPath(); penBuilt.ellipse(20, 128, 26, 90, 0, 0, 6.3); penBuilt.fill();
    penBuilt.beginPath(); penBuilt.ellipse(108, 128, 26, 90, 0, 0, 6.3); penBuilt.fill();
  } else if (kindGiven === 'overalls') {
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.88); penBuilt.fillRect((FRONT_AT + (-34)), 60, 68, 90);
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.8); penBuilt.fillRect((FRONT_AT + (-40)), 0, 14, 70); penBuilt.fillRect((FRONT_AT + 26), 0, 14, 70);
    penBuilt.fillStyle = '#d8b13c'; penBuilt.beginPath(); penBuilt.arc((FRONT_AT + (-30)), 66, 5, 0, 6.3); penBuilt.fill(); penBuilt.beginPath(); penBuilt.arc((FRONT_AT + 30), 66, 5, 0, 6.3); penBuilt.fill();
    penBuilt.strokeStyle = 'rgba(0,0,0,.3)'; penBuilt.strokeRect((FRONT_AT + (-34)), 60, 68, 90);
  } else if (kindGiven === 'uniform') {
    penBuilt.strokeStyle = '#c8ccd2'; penBuilt.lineWidth = 2; penBuilt.beginPath(); penBuilt.moveTo(FRONT_AT, 30); penBuilt.lineTo(FRONT_AT, 240); penBuilt.stroke();
    penBuilt.fillStyle = '#e8e8e8'; for (let yAt = 44; yAt < 230; yAt += 26) { penBuilt.beginPath(); penBuilt.arc(FRONT_AT, yAt, 3.4, 0, 6.3); penBuilt.fill(); }
    penBuilt.fillStyle = cssHexOf(trimGiven || 0xc8a028); penBuilt.beginPath(); penBuilt.arc((FRONT_AT + (-32)), 66, 10, 0, 6.3); penBuilt.fill();
    penBuilt.fillStyle = '#7a5c10'; penBuilt.beginPath(); penBuilt.arc((FRONT_AT + (-32)), 66, 5, 0, 6.3); penBuilt.fill();
    if (trimGiven) { penBuilt.fillStyle = cssHexOf(trimGiven); penBuilt.fillRect(0, 4, 256, 7); }
  } else if (kindGiven === 'cargo') {
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.85); penBuilt.fillRect(8, 130, 44, 52); penBuilt.fillRect(76, 130, 44, 52);
    penBuilt.strokeStyle = 'rgba(0,0,0,.4)'; penBuilt.strokeRect(8, 130, 44, 52); penBuilt.strokeRect(76, 130, 44, 52); penBuilt.fillStyle = '#3a2a1a'; penBuilt.fillRect(0, 0, 256, 20);
  } else if (kindGiven === 'skirt') {
    penBuilt.fillStyle = cssHexScaledOf(topGiven, 0.9); penBuilt.fillRect(0, 0, 256, 256);
    penBuilt.fillStyle = 'rgba(0,0,0,.2)'; for (let xAt = 0; xAt < 256; xAt += 32) penBuilt.fillRect(xAt, 0, 3, 256); }
  const texOut = new THREE.CanvasTexture(canvasBuilt); texOut.colorSpace = THREE.SRGBColorSpace; return texOut; }
function shoeTextureOf(colourGiven, stripedGiven) {
  const canvasBuilt = document.createElement('canvas'); canvasBuilt.width = canvasBuilt.height = 128;
  const penBuilt = canvasBuilt.getContext('2d'); penBuilt.fillStyle = cssHexOf(colourGiven); penBuilt.fillRect(0, 0, 128, 128);
  penBuilt.fillStyle = 'rgba(0,0,0,.18)'; penBuilt.fillRect(0, 88, 128, 40);
  if (stripedGiven) { penBuilt.fillStyle = '#ffffff'; penBuilt.save(); penBuilt.translate(64, 54); penBuilt.rotate(-0.5); for (let nIdx = -1; nIdx <= 1; nIdx++) penBuilt.fillRect(((nIdx * 22) + (-5)), -40, 10, 80); penBuilt.restore(); }
  const texOut = new THREE.CanvasTexture(canvasBuilt); texOut.colorSpace = THREE.SRGBColorSpace; return texOut; }
function materialPlain(colourGiven, roughGiven) { const roughValue = (roughGiven == null) ? 0.85 : roughGiven; const matOut = new THREE.MeshStandardMaterial({ color: colourGiven, roughness: roughValue }); return matOut; }
function limbCapsuleOf(radiusGiven, lengthGiven, materialGiven) { const limbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(radiusGiven, lengthGiven, 4, 10), materialGiven); limbMesh.castShadow = false; return limbMesh; }

export function makeFigure(optsGiven) {
  const totalHeight = ((optsGiven.h || 1) * 1.78);
  const shareBuild = (optsGiven.build || 0.55);
  const outfitGiven = optsGiven.outfit;
  const matSkin = materialPlain(optsGiven.skin, 0.65);
  const matHair = materialPlain((optsGiven.hairColor || 0x1a1a1a), 0.9);
  const kindsLongSleeve = ['jacket', 'leather', 'hoodie', 'uniform', 'overalls'];
  const sleevesLong = kindsLongSleeve.includes(outfitGiven.top);
  const kindTopTex = (outfitGiven.top === 'uniform') ? 'uniform' : outfitGiven.top;
  const texTop = makeClothTexture(kindTopTex, outfitGiven.topColor, outfitGiven.trim, outfitGiven.pantsColor);
  const matTop = new THREE.MeshStandardMaterial({ map: texTop, roughness: 0.9 });
  const kindPantsRaw = (outfitGiven.pants === 'jeans') ? 'jeans' : ((outfitGiven.pants === 'uniform') ? 'jeans' : outfitGiven.pants);
  const kindPantsTex = (kindPantsRaw === 'skirt+leggings') ? 'skirt' : kindPantsRaw;
  const texPants = makeClothTexture(kindPantsTex, outfitGiven.pantsColor, outfitGiven.trim, outfitGiven.pantsColor);
  const matPants = new THREE.MeshStandardMaterial({ map: texPants, roughness: 0.95 });
  const matShoe = new THREE.MeshStandardMaterial({ map: shoeTextureOf(outfitGiven.shoes, outfitGiven.shoeStripes), roughness: 0.8 });
  const grpFigure = new THREE.Group();
  const lenLeg = (totalHeight * 0.48), lenTorso = (totalHeight * 0.30), radiusHead = (totalHeight * 0.065);
  const heightHip = lenLeg;
  const meshPelvis = new THREE.Mesh(new THREE.SphereGeometry((0.145 * ((shareBuild * 0.5) + 0.8)), 14, 10), matPants);
  meshPelvis.scale.set(1, 0.7, 0.85); meshPelvis.position.y = heightHip; grpFigure.add(meshPelvis);
  if (outfitGiven.pants === 'skirt+leggings') {
    const meshSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.24, 14, 1, true), matPants);
    meshSkirt.position.y = (heightHip + (-0.08)); grpFigure.add(meshSkirt); }
  const grpTorso = new THREE.Group(); grpTorso.position.y = heightHip; grpFigure.add(grpTorso);
  const halfChestW = ((shareBuild * 0.055) + 0.13);
  const ptsLathe = [];
  ptsLathe.push(new THREE.Vector2(0.115, 0));
  ptsLathe.push(new THREE.Vector2(0.135, (lenTorso * 0.25)));
  ptsLathe.push(new THREE.Vector2(halfChestW, (lenTorso * 0.62)));
  ptsLathe.push(new THREE.Vector2((halfChestW * 0.92), (lenTorso * 0.88)));
  ptsLathe.push(new THREE.Vector2(0.075, lenTorso));
  const meshTorso = new THREE.Mesh(new THREE.LatheGeometry(ptsLathe, 16), matTop);
  meshTorso.rotation.y = Math.PI; meshTorso.scale.z = 0.78;
  grpTorso.add(meshTorso);
  const grpHead = new THREE.Group(); grpHead.position.y = (lenTorso + 0.03); grpTorso.add(grpHead);
  const meshNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 10), matSkin); meshNeck.position.y = 0.01; grpHead.add(meshNeck);
  const meshHead = new THREE.Mesh(new THREE.SphereGeometry(radiusHead, 18, 14), matSkin);
  meshHead.scale.y = 1.12; meshHead.position.y = (radiusHead + 0.05); grpHead.add(meshHead);
  const heightFace = (radiusHead + 0.05);
  const matEye = materialPlain(0x1a1210, 0.4);
  const sidesList = [-1, 1];
  sidesList.forEach((sideSign) => {
    const meshEye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), matEye); meshEye.position.set((sideSign * 0.04 * (totalHeight / 1.78)), (heightFace + 0.012), (radiusHead * 0.92)); grpHead.add(meshEye);
    const meshBrow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), matHair); meshBrow.position.set((sideSign * 0.04 * (totalHeight / 1.78)), (heightFace + 0.038), (radiusHead * 0.94)); meshBrow.rotation.z = (sideSign * -0.18); grpHead.add(meshBrow);
    const meshEar = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), matSkin); meshEar.position.set((sideSign * radiusHead * 0.98), heightFace, 0); grpHead.add(meshEar); });
  const meshNose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 6), matSkin); meshNose.rotation.x = (Math.PI / 2); meshNose.position.set(0, (heightFace + (-0.012)), (radiusHead * 1.0)); grpHead.add(meshNose);
  const meshMouth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.004), materialPlain(0x7a4038, 0.7)); meshMouth.position.set(0, (heightFace + (-0.052)), (radiusHead * 0.93)); grpHead.add(meshMouth);
  const kindHair = (optsGiven.hair || 'buzz');
  const geoCap = new THREE.SphereGeometry((radiusHead * 1.07), 16, 10, 0, 2 * Math.PI, 0, 1.9);
  const capWorn = (kindHair === 'cap') || (optsGiven.accessory === 'cap') || (optsGiven.accessory === 'cap+badge');
  if (capWorn) {
    const meshDome = new THREE.Mesh(new THREE.SphereGeometry((radiusHead * 1.08), 14, 8, 0, 2 * Math.PI, 0, 1.4), materialPlain((optsGiven.hairColor || 0x24304a), 0.8)); meshDome.position.y = (heightFace + 0.012); grpHead.add(meshDome);
    const meshBrim = new THREE.Mesh(new THREE.CylinderGeometry((radiusHead * 1.25), (radiusHead * 1.3), 0.012, 14, 1, false, -0.7, 1.4), materialPlain((optsGiven.hairColor || 0x24304a), 0.8)); meshBrim.position.set(0, (heightFace + 0.045), (radiusHead * 0.55)); grpHead.add(meshBrim);
  } else {
    const meshCap = new THREE.Mesh(geoCap, matHair); meshCap.scale.y = 1.12; meshCap.position.set(0, (heightFace + 0.012), -0.008); grpHead.add(meshCap);
    if (kindHair.includes('topknot')) { const meshKnot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), matHair); meshKnot.position.set(0, (heightFace + (radiusHead * 1.05)), -0.02); grpHead.add(meshKnot); }
    if (kindHair.includes('ponytail')) { const meshTail = limbCapsuleOf(0.032, 0.2, matHair); meshTail.position.set(0, (heightFace + (-0.08)), ((-radiusHead) + (-0.03))); meshTail.rotation.x = 0.25; grpHead.add(meshTail); }
    if (kindHair.includes('bob')) { const meshBob = new THREE.Mesh(new THREE.SphereGeometry((radiusHead * 1.14), 14, 10, 0, 2 * Math.PI, 0, 2.4), matHair); meshBob.scale.y = 1.25; meshBob.position.set(0, (heightFace + 0.005), -0.006); grpHead.add(meshBob); } }
  function buildArm(sideSign) {
    const grpShoulder = new THREE.Group(); grpShoulder.position.set((sideSign * (halfChestW + 0.03)), (lenTorso + (-0.05)), 0); grpTorso.add(grpShoulder);
    const matUpper = (outfitGiven.top === 'tank') ? matSkin : matTop;
    const meshUpper = limbCapsuleOf(0.045, 0.17, matUpper); meshUpper.position.y = -0.13; grpShoulder.add(meshUpper);
    grpShoulder.rotation.z = (sideSign * 0.14);
    const grpElbow = new THREE.Group(); grpElbow.position.y = -0.27; grpShoulder.add(grpElbow);
    const matFore = sleevesLong ? matTop : matSkin;
    const meshFore = limbCapsuleOf(0.037, 0.16, matFore); meshFore.position.y = -0.115; grpElbow.add(meshFore);
    const matHand = (optsGiven.accessory === 'gloves') ? materialPlain(outfitGiven.topColor, 0.8) : matSkin;
    const meshHand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), matHand); meshHand.scale.set(0.8, 1.15, 0.9); meshHand.position.y = -0.26; grpElbow.add(meshHand);
    grpElbow.rotation.x = -0.25;
    const rigArm = { shoulder: grpShoulder, elbow: grpElbow };
    return rigArm; }
  const armLeft = buildArm(-1), armRight = buildArm(1);
  function buildLeg(sideSign) {
    const grpHip = new THREE.Group(); grpHip.position.set((sideSign * 0.085), (heightHip + (-0.02)), 0); grpFigure.add(grpHip);
    const matThigh = (outfitGiven.pants === 'skirt+leggings') ? matPants : matPants;
    const meshThigh = limbCapsuleOf(0.068, 0.26, matThigh); meshThigh.position.y = (lenLeg * -0.25); grpHip.add(meshThigh);
    const grpKnee = new THREE.Group(); grpKnee.position.y = (lenLeg * -0.5); grpHip.add(grpKnee);
    const matShin = (outfitGiven.pants === 'skirt+leggings') ? materialPlain(outfitGiven.pantsColor, 0.9) : matPants;
    const meshShin = limbCapsuleOf(0.052, 0.26, matShin); meshShin.position.y = (lenLeg * -0.24); grpKnee.add(meshShin);
    const grpShoe = new THREE.Group(); grpShoe.position.y = (0.03 + (-(lenLeg * 0.5))); grpKnee.add(grpShoe);
    const meshShoe = limbCapsuleOf(0.05, 0.1, matShoe); meshShoe.rotation.x = (Math.PI / 2); meshShoe.scale.set(0.85, 1, 0.6); meshShoe.position.set(0, -0.02, 0.045); grpShoe.add(meshShoe);
    const meshSole = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.24), materialPlain(0xf5f5f5, 0.7)); meshSole.position.set(0, -0.055, 0.04); grpShoe.add(meshSole);
    const rigLeg = { hip: grpHip, knee: grpKnee };
    return rigLeg; }
  const legLeft = buildLeg(-1), legRight = buildLeg(1);
  if (optsGiven.accessory === 'glasses') {
    const matFrame = materialPlain(0x14161a, 0.3);
    sidesList.forEach((sideSign) => { const meshLens = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.04), new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.1, metalness: 0.6 })); meshLens.position.set((sideSign * 0.04), (heightFace + 0.012), (radiusHead + 0.012)); grpHead.add(meshLens); const meshBar = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.004), matFrame); meshBar.position.copy(meshLens.position); meshBar.position.y += 0.023; grpHead.add(meshBar); }); }
  if (optsGiven.accessory === 'chain') { const meshChain = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20), new THREE.MeshStandardMaterial({ color: 0xd8b13c, metalness: 0.9, roughness: 0.3 })); meshChain.position.set(0, (lenTorso + (-0.02)), 0.1); meshChain.rotation.x = 0.5; grpTorso.add(meshChain); }
  if (optsGiven.accessory === 'phone') { const meshPhone = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), materialPlain(0x14161c, 0.3)); meshPhone.position.set(0, -0.27, 0.03); armRight.elbow.add(meshPhone); }
  if (optsGiven.accessory === 'cap+badge') { const meshBadge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0xc8a028, metalness: 0.9, roughness: 0.3 })); meshBadge.rotation.x = (Math.PI / 2); meshBadge.position.set(-0.07, (lenTorso * 0.72), (halfChestW * 0.8)); grpTorso.add(meshBadge); }
  const shadowGround = shadowDiscMesh(0.42);
  grpFigure.add(shadowGround);
  grpFigure.userData = { legL: legLeft.hip, legR: legRight.hip, kneeL: legLeft.knee, kneeR: legRight.knee, armL: armLeft.shoulder, armR: armRight.shoulder, foreL: armLeft.elbow, foreR: armRight.elbow, headG: grpHead, torsoG: grpTorso, H: totalHeight };
  // Callers pass the cast entry itself, so identity checks can
  // recover the cast key even where call sites never thread it
  // through, and a single hook covers rivals, dialogue staging
  // and seated drivers alike
  Object.keys(CAST_TO_ASSET).forEach((castKey) => {
    if (optsGiven === CAST[castKey]) applyCastFigureOverride(grpFigure, castKey); });
  return grpFigure; }

export function animateFigure(figureGiven, phaseGiven, amountGiven) {
  const rigGiven = figureGiven.userData; if (!rigGiven) return;
  if (rigGiven.figIsGlb && rigGiven.glbInner) {
    const holderGiven = rigGiven.glbInner;
    const movingHard = (amountGiven > 0.05);
    if (movingHard) {
      holderGiven.position.y = (Math.abs(Math.sin(phaseGiven)) * 0.045);
      holderGiven.rotation.z = (Math.sin(phaseGiven) * 0.035);
      holderGiven.rotation.x = (Math.min(1, amountGiven) * 0.05);
    } else {
      holderGiven.position.y = (Math.sin(phaseGiven * 0.35) * 0.008);
      holderGiven.rotation.z = 0; holderGiven.rotation.x = 0; }
    holderGiven.rotation.y = CAST_YAW_OFFSET;
    return; }
  if (!rigGiven.legL) return;
  const swingSecond = Math.sin((phaseGiven + Math.PI));
  const swingFirst = Math.sin(phaseGiven);
  const swingPlan = [[rigGiven.legL, swingFirst], [rigGiven.legR, swingSecond]];
  swingPlan.forEach(([jointGiven, swingGiven]) => { jointGiven.rotation.x = ((swingGiven * 0.55) * amountGiven); });
  rigGiven.kneeL.rotation.x = ((Math.max(0, -swingSecond) * 0.6) * amountGiven); rigGiven.kneeR.rotation.x = ((Math.max(0, -swingFirst) * 0.6) * amountGiven);
  rigGiven.armL.rotation.x = ((swingSecond * 0.4) * amountGiven); rigGiven.armR.rotation.x = ((swingFirst * 0.4) * amountGiven);
  rigGiven.foreL.rotation.x = (-0.25 + (-((Math.max(0, swingFirst) * 0.3) * amountGiven))); rigGiven.foreR.rotation.x = (-0.25 + (-((Math.max(0, swingSecond) * 0.3) * amountGiven)));
  const liftIdle = (amountGiven < 0.05) ? (Math.sin(phaseGiven * 0.35) * 0.006) : 0;
  rigGiven.torsoG.position.y = (((rigGiven.H * 0.48) + ((Math.abs(Math.sin(phaseGiven)) * 0.03) * amountGiven)) + liftIdle);
  rigGiven.headG.rotation.x = (Math.sin(phaseGiven * 0.5) * 0.03); }
export function poseSeated(figureGiven) {
  const rigGiven = figureGiven.userData; if (!rigGiven) return;
  rigGiven.seated = true;
  if (rigGiven.figIsGlb && rigGiven.glbInner) { rigGiven.glbInner.position.y = -0.55; return; }
  if (!rigGiven.legL) return;
  const bendHip = (0.12 + (-(Math.PI / 2)));
  const bendKnee = ((Math.PI / 2) + (-0.15));
  const pairHip = [rigGiven.legL, rigGiven.legR];
  pairHip.forEach((jointGiven) => { jointGiven.rotation.x = bendHip; });
  const pairKnee = [rigGiven.kneeL, rigGiven.kneeR];
  pairKnee.forEach((jointGiven) => { jointGiven.rotation.x = bendKnee; });
  const pairArm = [rigGiven.armL, rigGiven.armR];
  pairArm.forEach((jointGiven) => { jointGiven.rotation.x = -0.85; });
  rigGiven.armL.rotation.z = 0.3; rigGiven.armR.rotation.z = -0.3;
  const pairFore = [rigGiven.foreL, rigGiven.foreR];
  pairFore.forEach((jointGiven) => { jointGiven.rotation.x = -0.35; });
  rigGiven.torsoG.position.y = (rigGiven.H * 0.48); }
export function createPlayer(stateGiven) {
  startMcLoad();
  const grpOuter = new THREE.Group();
  const figureProc = makeFigure(CAST.ren);
  grpOuter.add(figureProc);
  const bornX = -412.5;
  const bornZ = 470;
  grpOuter.position.set(bornX, groundH(bornX, bornZ), bornZ);
  grpOuter.rotation.y = Math.PI;
  stateGiven.scene.add(grpOuter);
  const recordPlayer = { fig: grpOuter, procFig: figureProc, visual: figureProc, glbInner: null, glbShadow: null, figIsGlb: false, elapsed: 0, x: bornX, z: bornZ, angle: Math.PI, phase: 0, speed: 0, health: 100 };
  stateGiven.player = recordPlayer;
  const swappedNow = tryMcSwap(recordPlayer);
  if (!swappedNow) waitersMc.add(recordPlayer);
  return recordPlayer; }
function directionFromKeys(keysGiven) {
  let dirX = 0, dirZ = 0;
  if (keysGiven['KeyW'] || keysGiven['ArrowUp']) dirZ += 1;
  if (keysGiven['KeyS'] || keysGiven['ArrowDown']) dirZ -= 1;
  if (keysGiven['KeyA'] || keysGiven['ArrowLeft']) dirX -= 1;
  if (keysGiven['KeyD'] || keysGiven['ArrowRight']) dirX += 1;
  const dirOut = { inputX: dirX, inputZ: dirZ };
  return dirOut; }
function pushOutOfColliders(stateGiven, playerGiven) {
  for (const colliderGiven of stateGiven.colliders) {
    const offX = (playerGiven.x + (-colliderGiven.x)), offZ = (playerGiven.z + (-colliderGiven.z));
    const penX = ((colliderGiven.hw + 0.45) + (-Math.abs(offX)));
    const penZ = ((colliderGiven.hd + 0.45) + (-Math.abs(offZ)));
    const touching = (penX > 0) && (penZ > 0);
    if (!touching) continue;
    if (penZ > penX) playerGiven.x += (offX >= 0) ? penX : -penX;
    else playerGiven.z += (offZ >= 0) ? penZ : -penZ; } }
function animatePlayerFigure(stateGiven, playerGiven, movingGiven) {
  if (playerGiven.figIsGlb && playerGiven.glbInner) {
    const holderGiven = playerGiven.glbInner;
    const sharePace = Math.min(1, (Math.abs(playerGiven.speed || 0) / 9));
    if (movingGiven) {
      holderGiven.position.y = (Math.abs(Math.sin(playerGiven.phase)) * 0.045);
      holderGiven.rotation.z = (Math.sin(playerGiven.phase) * 0.035);
      holderGiven.rotation.x = (sharePace * 0.05);
    } else {
      holderGiven.position.y = (Math.sin(playerGiven.elapsed * 1.6) * 0.008);
      holderGiven.rotation.z = 0; holderGiven.rotation.x = 0; }
    holderGiven.rotation.y = MC_YAW_OFFSET;
  } else animateFigure((playerGiven.procFig || playerGiven.fig), playerGiven.phase, movingGiven ? 1 : 0.04); }
export function updatePlayer(stateGiven, dtGiven) {
  const playerGiven = stateGiven.player;
  const playerGone = !playerGiven || !playerGiven.fig.visible;
  if (playerGone) return;
  const keysGiven = stateGiven.keys;
  const dirGiven = directionFromKeys(keysGiven);
  const movingNow = !(dirGiven.inputX === 0 && dirGiven.inputZ === 0);
  const sprintHeld = (keysGiven['ShiftLeft'] || keysGiven['ShiftRight']);
  const speedPace = sprintHeld ? 9 : 6;
  if (movingNow) {
    const yawCam = (stateGiven.camYaw || 0);
    const worldDirX = ((Math.cos(yawCam) * dirGiven.inputX) + (Math.sin(yawCam) * dirGiven.inputZ));
    const worldDirZ = ((Math.cos(yawCam) * dirGiven.inputZ) + (-(Math.sin(yawCam) * dirGiven.inputX)));
    const lenDir = (Math.hypot(worldDirX, worldDirZ) || 1);
    playerGiven.x += (((worldDirX / lenDir) * speedPace) * dtGiven);
    playerGiven.z += (((worldDirZ / lenDir) * speedPace) * dtGiven);
    playerGiven.angle = Math.atan2((worldDirX / lenDir), (worldDirZ / lenDir));
    playerGiven.phase += ((dtGiven * speedPace) * 1.9);
    playerGiven.speed = speedPace;
  } else playerGiven.speed = 0;
  pushOutOfColliders(stateGiven, playerGiven);
  playerGiven.x = Math.max(-655, Math.min(655, playerGiven.x));
  playerGiven.z = Math.max(-655, Math.min(655, playerGiven.z));
  playerGiven.fig.position.set(playerGiven.x, groundH(playerGiven.x, playerGiven.z), playerGiven.z);
  playerGiven.fig.rotation.y = playerGiven.angle;
  playerGiven.elapsed = ((playerGiven.elapsed || 0) + dtGiven);
  animatePlayerFigure(stateGiven, playerGiven, movingNow); }
