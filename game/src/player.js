// On foot player plus the textured figure factory
// Proportions run near seven and a half heads, with capsule and
// lathe parts and clothing from procedural canvas textures
import * as THREE from 'three'; import { CAST } from './config.js';
import { groundH } from './world.js'; import { loadHeroAsset } from './assets.js';
// The hero visual may become the loaded model, while the outer group
// stays the one the updater positions and rotates
// Inside sits either the procedural figure or a clone of the loaded
// wrapper, held by an inner group that bobs, rocks and leans
// A failed load resolves null and nothing swaps, so the procedural
// figure remains the exact fallback, and one constant flips facing
const MC_YAW_CORRECTION = 0;
let mcTemplate = null; let mcLoadStarted = false;
const mcWaiters = new Set();
function groundShadowDisc(radiusIn) {
  const discMesh = new THREE.Mesh(new THREE.CircleGeometry(radiusIn, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  discMesh.rotation.x = -Math.PI / 2; discMesh.position.y = 0.02;
  return discMesh; }
function swapHeroToModel(plIn) {
  try {
    if (!plIn || !mcTemplate || plIn.figIsGlb) return false;
    const innerGroup = new THREE.Group();
    innerGroup.name = 'mc-glb-inner'; innerGroup.rotation.y = MC_YAW_CORRECTION;
    innerGroup.add(mcTemplate.clone(true));
    if (plIn.procFig) plIn.fig.remove(plIn.procFig);
    plIn.fig.add(innerGroup);
    const discMesh = groundShadowDisc(0.42);
    plIn.fig.add(discMesh);
    plIn.glbInner = innerGroup; plIn.glbShadow = discMesh; plIn.visual = innerGroup; plIn.figIsGlb = true;
    return true;
  } catch (err) { return false; } }
function startHeroLoad() {
  if (mcLoadStarted) return;
  mcLoadStarted = true;
  // A null result gets retried rather than treated as final, because
  // racing loads at module init can lose the fetch race, and a cached
  // null would strand every waiter on the procedural figure for the
  // whole session, while the asset module evicts nulls on retry
  const tryLoad = (attemptsLeft) => {
    try {
      loadHeroAsset('mc').then((wrapIn) => {
        try {
          if (!wrapIn) { if (attemptsLeft > 0) setTimeout(() => tryLoad(attemptsLeft - 1), 1500); return; }
          mcTemplate = wrapIn;
          mcWaiters.forEach((waitingPl) => swapHeroToModel(waitingPl));
          mcWaiters.clear();
        } catch (err) { /* procedural fallback stays */ }
      }).catch(() => { if (attemptsLeft > 0) setTimeout(() => tryLoad(attemptsLeft - 1), 1500); });
    } catch (err) { /* procedural fallback stays */ } };
  tryLoad(3); }
startHeroLoad();
// Cast figures replaced by loaded visuals follow the same pattern
// The rival driver and the officer each map to their own asset, and
// both face forward, so zero rotation matches the procedural facing
// The group the factory returns stays outer, with transform and
// animation untouched, and only the inner visual changes on arrival
const CAST_YAW_CORRECTION = 0;
const CAST_ASSET_MAP = { shun: 'rivalDriver', cop: 'policeOfficer' };
const castTemplateMap = new Map(); const castStartedSet = new Set(); const castWaiterMap = new Map();
function swapCastFigure(figIn, assetName) {
  try {
    const template = castTemplateMap.get(assetName);
    if (!figIn || !template || figIn.userData.figIsGlb) return false;
    const innerGroup = new THREE.Group();
    innerGroup.name = 'cast-glb-inner'; innerGroup.rotation.y = CAST_YAW_CORRECTION;
    innerGroup.add(template.clone(true));
    const heldProcedural = new THREE.Group();
    heldProcedural.name = 'cast-proc-visual';
    while (figIn.children.length) heldProcedural.add(figIn.children[0]);
    figIn.add(innerGroup);
    const discMesh = groundShadowDisc(0.42);
    figIn.add(discMesh);
    figIn.userData.procFig = heldProcedural; figIn.userData.glbInner = innerGroup; figIn.userData.glbShadow = discMesh; figIn.userData.figIsGlb = true;
    if (figIn.userData.seated) innerGroup.position.y = -0.55;
    figIn.figIsGlb = true;
    return true;
  } catch (err) { return false; } }
function startCastLoad(assetName) {
  if (castStartedSet.has(assetName)) return;
  castStartedSet.add(assetName);
  try {
    loadHeroAsset(assetName).then((wrapIn) => {
      try {
        if (!wrapIn) return;
        castTemplateMap.set(assetName, wrapIn);
        const waitingSet = castWaiterMap.get(assetName);
        if (waitingSet) { waitingSet.forEach((figIn) => swapCastFigure(figIn, assetName)); waitingSet.clear(); }
      } catch (err) { /* procedural fallback stays */ }
    }).catch(() => { /* procedural fallback stays */ });
  } catch (err) { /* procedural fallback stays */ } }
export function applyCastFigureOverride(figIn, castName) {
  try {
    if (!figIn || !castName) return false;
    const assetName = CAST_ASSET_MAP[castName];
    if (!assetName) return false;
    figIn.userData.castKey = castName;
    if (figIn.userData.figIsGlb) return true;
    startCastLoad(assetName);
    if (swapCastFigure(figIn, assetName)) return true;
    if (!castWaiterMap.has(assetName)) castWaiterMap.set(assetName, new Set());
    castWaiterMap.get(assetName).add(figIn);
    return true;
  } catch (err) { return false; } }
// Texture noise stays deterministic through a small local generator
function seededNoiseFrom(seedIn) { let stateWord = seedIn * 7919 + 13; return () => { stateWord = (stateWord * 16807) % 2147483647; return (stateWord & 0xffff) / 0xffff; }; }
function hexCssOf(hexIn) { return '#' + hexIn.toString(16).padStart(6, '0'); }
function hexCssScaledOf(hexIn, scaleIn) { const colour = new THREE.Color(hexIn); colour.multiplyScalar(scaleIn); return '#' + colour.getHexString(); }
// Clothing canvas texture
// The front design centres on one quarter of the wrap, and the plain
// back sits at three quarters, while lathe and cylinder mapping wrap
// around the circumference with the seam at the back by default, so
// rotating a part by half a turn brings the front to face forward
export function makeClothTexture(kindIn, topColour, trimColour, pantsColour) {
  const canvasEl = document.createElement('canvas'); canvasEl.width = canvasEl.height = 256;
  const ctx = canvasEl.getContext('2d'); const noiseNext = seededNoiseFrom(kindIn.length * 131 + topColour % 10000);
  ctx.fillStyle = hexCssOf(topColour); ctx.fillRect(0, 0, 256, 256);
  for (let n = 0; n < 1400; n++) { ctx.fillStyle = `rgba(0,0,0,${0.03 + 0.05 * noiseNext()})`; ctx.fillRect(256 * noiseNext(), 256 * noiseNext(), 2, 1); }
  for (let n = 0; n < 700; n++) { ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.04 * noiseNext()})`; ctx.fillRect(256 * noiseNext(), 256 * noiseNext(), 2, 1); }
  const shading = ctx.createLinearGradient(0, 0, 256, 0);
  shading.addColorStop(0, 'rgba(0,0,0,.28)'); shading.addColorStop(0.25, 'rgba(255,255,255,.10)'); shading.addColorStop(0.5, 'rgba(0,0,0,.28)'); shading.addColorStop(0.75, 'rgba(255,255,255,.05)'); shading.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = shading; ctx.fillRect(0, 0, 256, 256);
  const FRONT_CENTRE = 64;
  if (kindIn === 'jeans' || kindIn === 'uniform-pants') {
    ctx.fillStyle = hexCssScaledOf(topColour, 0.75); ctx.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 1400; n++) { ctx.fillStyle = `rgba(255,255,255,${0.03 + 0.04 * noiseNext()})`; ctx.fillRect(256 * noiseNext(), 256 * noiseNext(), 1, 3); }
    ctx.fillStyle = shading; ctx.fillRect(0, 0, 256, 256);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); ctx.arc(FRONT_CENTRE - 26, 44, 16, 0.2, 2.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(FRONT_CENTRE + 26, 44, 16, 0.7, 2.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,120,.5)'; ctx.beginPath(); ctx.moveTo(FRONT_CENTRE, 30); ctx.lineTo(FRONT_CENTRE, 120); ctx.stroke();
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, 256, 22);
    ctx.fillStyle = '#c0c4c8'; ctx.fillRect(FRONT_CENTRE - 10, 4, 20, 14); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(FRONT_CENTRE - 5, 7, 10, 8);
  } else if (kindIn === 'jacket' || kindIn === 'leather') {
    if (kindIn === 'leather') { const leatherSheen = ctx.createLinearGradient(0, 0, 256, 256); leatherSheen.addColorStop(0, 'rgba(255,255,255,.16)'); leatherSheen.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = leatherSheen; ctx.fillRect(0, 0, 256, 256); }
    ctx.fillStyle = hexCssScaledOf(topColour, 0.7); ctx.fillRect(0, 0, 256, 26);
    if (trimColour) { ctx.fillStyle = hexCssOf(trimColour); ctx.fillRect(0, 22, 256, 5); }
    ctx.lineWidth = 4; ctx.strokeStyle = '#14161a'; ctx.beginPath();
    if (kindIn === 'leather') { ctx.moveTo(FRONT_CENTRE - 30, 26); ctx.lineTo(FRONT_CENTRE + 22, 200); } else { ctx.moveTo(FRONT_CENTRE, 26); ctx.lineTo(FRONT_CENTRE, 240); }
    ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = '#9aa0a6';
    for (let yPos = 30; yPos < 235; yPos += 7) { const zipFrac = (yPos - 26) / 210; const zipXPos = kindIn === 'leather' ? FRONT_CENTRE - 30 + 52 * zipFrac : FRONT_CENTRE; ctx.beginPath(); ctx.moveTo(zipXPos - 4, yPos); ctx.lineTo(zipXPos + 4, yPos); ctx.stroke(); }
    ctx.fillStyle = hexCssScaledOf(topColour, 0.82); ctx.fillRect(FRONT_CENTRE - 52, 84, 34, 16); ctx.fillRect(FRONT_CENTRE + 18, 84, 34, 16);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(FRONT_CENTRE - 52, 98, 34, 3); ctx.fillRect(FRONT_CENTRE + 18, 98, 34, 3);
    if (trimColour) { ctx.fillStyle = hexCssOf(trimColour); ctx.fillRect(0, 218, 256, 8); }
  } else if (kindIn === 'hoodie') {
    ctx.fillStyle = hexCssScaledOf(topColour, 0.78); ctx.fillRect(0, 0, 256, 34);
    ctx.fillStyle = hexCssScaledOf(topColour, 0.85); ctx.fillRect(FRONT_CENTRE - 38, 176, 76, 52);
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeRect(FRONT_CENTRE - 38, 176, 76, 52);
    ctx.lineWidth = 3; ctx.strokeStyle = '#f2f2f2';
    ctx.beginPath(); ctx.moveTo(FRONT_CENTRE - 8, 36); ctx.lineTo(FRONT_CENTRE - 12, 66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(FRONT_CENTRE + 8, 36); ctx.lineTo(FRONT_CENTRE + 12, 66); ctx.stroke();
  } else if (kindIn === 'tank') {
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.beginPath(); ctx.ellipse(20, 128, 26, 90, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(108, 128, 26, 90, 0, 0, 6.3); ctx.fill();
  } else if (kindIn === 'overalls') {
    ctx.fillStyle = hexCssScaledOf(topColour, 0.88); ctx.fillRect(FRONT_CENTRE - 34, 60, 68, 90);
    ctx.fillStyle = hexCssScaledOf(topColour, 0.8); ctx.fillRect(FRONT_CENTRE - 40, 0, 14, 70); ctx.fillRect(FRONT_CENTRE + 26, 0, 14, 70);
    ctx.fillStyle = '#d8b13c'; ctx.beginPath(); ctx.arc(FRONT_CENTRE - 30, 66, 5, 0, 6.3); ctx.fill(); ctx.beginPath(); ctx.arc(FRONT_CENTRE + 30, 66, 5, 0, 6.3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.strokeRect(FRONT_CENTRE - 34, 60, 68, 90);
  } else if (kindIn === 'uniform') {
    ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(FRONT_CENTRE, 30); ctx.lineTo(FRONT_CENTRE, 240); ctx.stroke();
    ctx.fillStyle = '#e8e8e8'; for (let yPos = 44; yPos < 230; yPos += 26) { ctx.beginPath(); ctx.arc(FRONT_CENTRE, yPos, 3.4, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = hexCssOf(trimColour || 0xc8a028); ctx.beginPath(); ctx.arc(FRONT_CENTRE - 32, 66, 10, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#7a5c10'; ctx.beginPath(); ctx.arc(FRONT_CENTRE - 32, 66, 5, 0, 6.3); ctx.fill();
    if (trimColour) { ctx.fillStyle = hexCssOf(trimColour); ctx.fillRect(0, 4, 256, 7); }
  } else if (kindIn === 'cargo') {
    ctx.fillStyle = hexCssScaledOf(topColour, 0.85); ctx.fillRect(8, 130, 44, 52); ctx.fillRect(76, 130, 44, 52);
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.strokeRect(8, 130, 44, 52); ctx.strokeRect(76, 130, 44, 52); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, 256, 20);
  } else if (kindIn === 'skirt') {
    ctx.fillStyle = hexCssScaledOf(topColour, 0.9); ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(0,0,0,.2)'; for (let xPos = 0; xPos < 256; xPos += 32) ctx.fillRect(xPos, 0, 3, 256); }
  const textureOut = new THREE.CanvasTexture(canvasEl); textureOut.colorSpace = THREE.SRGBColorSpace; return textureOut; }
function makeShoeTexture(colourHex, stripedIn) {
  const canvasEl = document.createElement('canvas'); canvasEl.width = canvasEl.height = 128;
  const ctx = canvasEl.getContext('2d'); ctx.fillStyle = hexCssOf(colourHex); ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 88, 128, 40);
  if (stripedIn) { ctx.fillStyle = '#ffffff'; ctx.save(); ctx.translate(64, 54); ctx.rotate(-0.5); for (let n = -1; n <= 1; n++) ctx.fillRect(n * 22 - 5, -40, 10, 80); ctx.restore(); }
  const textureOut = new THREE.CanvasTexture(canvasEl); textureOut.colorSpace = THREE.SRGBColorSpace; return textureOut; }
const flatMaterialOf = (colourHex, roughnessIn) => new THREE.MeshStandardMaterial({ color: colourHex, roughness: roughnessIn == null ? 0.85 : roughnessIn });
function capsuleLimbOf(radiusIn, lengthIn, materialIn) { const limbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(radiusIn, lengthIn, 4, 10), materialIn); limbMesh.castShadow = false; return limbMesh; }
export function makeFigure(optsIn) {
  const heightTotal = (optsIn.h || 1) * 1.78;
  const buildFactor = optsIn.build || 0.55;
  const outfitDef = optsIn.outfit;
  const skinMat = flatMaterialOf(optsIn.skin, 0.65);
  const hairMat = flatMaterialOf(optsIn.hairColor || 0x1a1a1a, 0.9);
  const longSleeves = ['jacket', 'leather', 'hoodie', 'uniform', 'overalls'].includes(outfitDef.top);
  const topTexture = makeClothTexture(outfitDef.top === 'uniform' ? 'uniform' : outfitDef.top, outfitDef.topColor, outfitDef.trim, outfitDef.pantsColor);
  const topMat = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.9 });
  const pantsKindName = outfitDef.pants === 'jeans' ? 'jeans' : outfitDef.pants === 'uniform' ? 'jeans' : outfitDef.pants;
  const pantsTexture = makeClothTexture(pantsKindName === 'skirt+leggings' ? 'skirt' : pantsKindName, outfitDef.pantsColor, outfitDef.trim, outfitDef.pantsColor);
  const pantsMat = new THREE.MeshStandardMaterial({ map: pantsTexture, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ map: makeShoeTexture(outfitDef.shoes, outfitDef.shoeStripes), roughness: 0.8 });
  const figureRoot = new THREE.Group();
  const legLength = heightTotal * 0.48, torsoLength = heightTotal * 0.30, headRadius = heightTotal * 0.065;
  const hipHeight = legLength;
  const pelvisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.145 * (buildFactor * 0.5 + 0.8), 14, 10), pantsMat);
  pelvisMesh.scale.set(1, 0.7, 0.85); pelvisMesh.position.y = hipHeight; figureRoot.add(pelvisMesh);
  if (outfitDef.pants === 'skirt+leggings') {
    const skirtMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.24, 14, 1, true), pantsMat);
    skirtMesh.position.y = hipHeight - 0.08; figureRoot.add(skirtMesh); }
  const torsoGroup = new THREE.Group(); torsoGroup.position.y = hipHeight; figureRoot.add(torsoGroup);
  const chestHalfWidth = buildFactor * 0.055 + 0.13;
  const latheProfile = [];
  latheProfile.push(new THREE.Vector2(0.115, 0));
  latheProfile.push(new THREE.Vector2(0.135, torsoLength * 0.25));
  latheProfile.push(new THREE.Vector2(chestHalfWidth, torsoLength * 0.62));
  latheProfile.push(new THREE.Vector2(chestHalfWidth * 0.92, torsoLength * 0.88));
  latheProfile.push(new THREE.Vector2(0.075, torsoLength));
  const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(latheProfile, 16), topMat);
  torsoMesh.rotation.y = Math.PI; torsoMesh.scale.z = 0.78;
  torsoGroup.add(torsoMesh);
  const headGroup = new THREE.Group(); headGroup.position.y = torsoLength + 0.03; torsoGroup.add(headGroup);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 10), skinMat); neckMesh.position.y = 0.01; headGroup.add(neckMesh);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headRadius, 18, 14), skinMat);
  headMesh.scale.y = 1.12; headMesh.position.y = headRadius + 0.05; headGroup.add(headMesh);
  const faceHeight = headRadius + 0.05;
  const eyeMat = flatMaterialOf(0x1a1210, 0.4);
  [-1, 1].forEach((sideSign) => {
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMat); eyeMesh.position.set(sideSign * 0.04 * (heightTotal / 1.78), faceHeight + 0.012, headRadius * 0.92); headGroup.add(eyeMesh);
    const browMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), hairMat); browMesh.position.set(sideSign * 0.04 * (heightTotal / 1.78), faceHeight + 0.038, headRadius * 0.94); browMesh.rotation.z = sideSign * -0.18; headGroup.add(browMesh);
    const earMesh = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skinMat); earMesh.position.set(sideSign * headRadius * 0.98, faceHeight, 0); headGroup.add(earMesh); });
  const noseMesh = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 6), skinMat); noseMesh.rotation.x = Math.PI / 2; noseMesh.position.set(0, faceHeight - 0.012, headRadius * 1.0); headGroup.add(noseMesh);
  const mouthMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.004), flatMaterialOf(0x7a4038, 0.7)); mouthMesh.position.set(0, faceHeight - 0.052, headRadius * 0.93); headGroup.add(mouthMesh);
  const hairStyleName = optsIn.hair || 'buzz';
  const capGeometry = new THREE.SphereGeometry(headRadius * 1.07, 16, 10, 0, 2 * Math.PI, 0, 1.9);
  if (hairStyleName === 'cap' || optsIn.accessory === 'cap' || optsIn.accessory === 'cap+badge') {
    const domeMesh = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.08, 14, 8, 0, 2 * Math.PI, 0, 1.4), flatMaterialOf(optsIn.hairColor || 0x24304a, 0.8)); domeMesh.position.y = faceHeight + 0.012; headGroup.add(domeMesh);
    const brimMesh = new THREE.Mesh(new THREE.CylinderGeometry(headRadius * 1.25, headRadius * 1.3, 0.012, 14, 1, false, -0.7, 1.4), flatMaterialOf(optsIn.hairColor || 0x24304a, 0.8)); brimMesh.position.set(0, faceHeight + 0.045, headRadius * 0.55); headGroup.add(brimMesh);
  } else {
    const capMesh = new THREE.Mesh(capGeometry, hairMat); capMesh.scale.y = 1.12; capMesh.position.set(0, faceHeight + 0.012, -0.008); headGroup.add(capMesh);
    if (hairStyleName.includes('topknot')) { const knotMesh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), hairMat); knotMesh.position.set(0, faceHeight + headRadius * 1.05, -0.02); headGroup.add(knotMesh); }
    if (hairStyleName.includes('ponytail')) { const tailMesh = capsuleLimbOf(0.032, 0.2, hairMat); tailMesh.position.set(0, faceHeight - 0.08, -headRadius - 0.03); tailMesh.rotation.x = 0.25; headGroup.add(tailMesh); }
    if (hairStyleName.includes('bob')) { const bobMesh = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.14, 14, 10, 0, 2 * Math.PI, 0, 2.4), hairMat); bobMesh.scale.y = 1.25; bobMesh.position.set(0, faceHeight + 0.005, -0.006); headGroup.add(bobMesh); } }
  function buildArm(sideSign) {
    const shoulderGroup = new THREE.Group(); shoulderGroup.position.set(sideSign * (chestHalfWidth + 0.03), torsoLength - 0.05, 0); torsoGroup.add(shoulderGroup);
    const upperMat = outfitDef.top === 'tank' ? skinMat : topMat;
    const upperMesh = capsuleLimbOf(0.045, 0.17, upperMat); upperMesh.position.y = -0.13; shoulderGroup.add(upperMesh);
    shoulderGroup.rotation.z = sideSign * 0.14;
    const elbowGroup = new THREE.Group(); elbowGroup.position.y = -0.27; shoulderGroup.add(elbowGroup);
    const forearmMat = longSleeves ? topMat : skinMat;
    const forearmMesh = capsuleLimbOf(0.037, 0.16, forearmMat); forearmMesh.position.y = -0.115; elbowGroup.add(forearmMesh);
    const handMat = optsIn.accessory === 'gloves' ? flatMaterialOf(outfitDef.topColor, 0.8) : skinMat;
    const handMesh = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), handMat); handMesh.scale.set(0.8, 1.15, 0.9); handMesh.position.y = -0.26; elbowGroup.add(handMesh);
    elbowGroup.rotation.x = -0.25;
    return { shoulder: shoulderGroup, elbow: elbowGroup }; }
  const armLeft = buildArm(-1), armRight = buildArm(1);
  function buildLeg(sideSign) {
    const hipGroup = new THREE.Group(); hipGroup.position.set(sideSign * 0.085, hipHeight - 0.02, 0); figureRoot.add(hipGroup);
    const thighMat = outfitDef.pants === 'skirt+leggings' ? pantsMat : pantsMat;
    const thighMesh = capsuleLimbOf(0.068, 0.26, thighMat); thighMesh.position.y = legLength * -0.25; hipGroup.add(thighMesh);
    const kneeGroup = new THREE.Group(); kneeGroup.position.y = legLength * -0.5; hipGroup.add(kneeGroup);
    const shinMat = outfitDef.pants === 'skirt+leggings' ? flatMaterialOf(outfitDef.pantsColor, 0.9) : pantsMat;
    const shinMesh = capsuleLimbOf(0.052, 0.26, shinMat); shinMesh.position.y = legLength * -0.24; kneeGroup.add(shinMesh);
    const shoeGroup = new THREE.Group(); shoeGroup.position.y = 0.03 - legLength * 0.5; kneeGroup.add(shoeGroup);
    const shoeMesh = capsuleLimbOf(0.05, 0.1, shoeMat); shoeMesh.rotation.x = Math.PI / 2; shoeMesh.scale.set(0.85, 1, 0.6); shoeMesh.position.set(0, -0.02, 0.045); shoeGroup.add(shoeMesh);
    const soleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.24), flatMaterialOf(0xf5f5f5, 0.7)); soleMesh.position.set(0, -0.055, 0.04); shoeGroup.add(soleMesh);
    return { hip: hipGroup, knee: kneeGroup }; }
  const legLeft = buildLeg(-1), legRight = buildLeg(1);
  if (optsIn.accessory === 'glasses') {
    const frameMat = flatMaterialOf(0x14161a, 0.3);
    [-1, 1].forEach((sideSign) => { const lensMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.04), new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.1, metalness: 0.6 })); lensMesh.position.set(sideSign * 0.04, faceHeight + 0.012, headRadius + 0.012); headGroup.add(lensMesh); const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.004), frameMat); barMesh.position.copy(lensMesh.position); barMesh.position.y += 0.023; headGroup.add(barMesh); }); }
  if (optsIn.accessory === 'chain') { const chainMesh = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20), new THREE.MeshStandardMaterial({ color: 0xd8b13c, metalness: 0.9, roughness: 0.3 })); chainMesh.position.set(0, torsoLength - 0.02, 0.1); chainMesh.rotation.x = 0.5; torsoGroup.add(chainMesh); }
  if (optsIn.accessory === 'phone') { const phoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), flatMaterialOf(0x14161c, 0.3)); phoneMesh.position.set(0, -0.27, 0.03); armRight.elbow.add(phoneMesh); }
  if (optsIn.accessory === 'cap+badge') { const badgeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0xc8a028, metalness: 0.9, roughness: 0.3 })); badgeMesh.rotation.x = Math.PI / 2; badgeMesh.position.set(-0.07, torsoLength * 0.72, chestHalfWidth * 0.8); torsoGroup.add(badgeMesh); }
  const shadowDisc = groundShadowDisc(0.42);
  figureRoot.add(shadowDisc);
  figureRoot.userData = { legL: legLeft.hip, legR: legRight.hip, kneeL: legLeft.knee, kneeR: legRight.knee,
    armL: armLeft.shoulder, armR: armRight.shoulder, foreL: armLeft.elbow, foreR: armRight.elbow,
    headG: headGroup, torsoG: torsoGroup, H: heightTotal };
  // Callers pass the cast entry itself, so identity checks recover
  // the cast key even where call sites never thread it through, and
  // one hook covers rivals, dialogue staging and seated drivers alike
  Object.keys(CAST_ASSET_MAP).forEach((castName) => {
    if (optsIn === CAST[castName]) applyCastFigureOverride(figureRoot, castName); });
  return figureRoot; }
export function animateFigure(figIn, phaseIn, amountIn) {
  const rig = figIn.userData; if (!rig) return;
  if (rig.figIsGlb && rig.glbInner) {
    const innerGroup = rig.glbInner;
    if (amountIn > 0.05) {
      innerGroup.position.y = Math.abs(Math.sin(phaseIn)) * 0.045;
      innerGroup.rotation.z = Math.sin(phaseIn) * 0.035;
      innerGroup.rotation.x = Math.min(1, amountIn) * 0.05;
    } else {
      innerGroup.position.y = Math.sin(phaseIn * 0.35) * 0.008;
      innerGroup.rotation.z = 0; innerGroup.rotation.x = 0; }
    innerGroup.rotation.y = CAST_YAW_CORRECTION;
    return; }
  if (!rig.legL) return;
  const swingFirst = Math.sin(phaseIn), swingSecond = Math.sin(phaseIn + Math.PI);
  rig.legL.rotation.x = swingFirst * 0.55 * amountIn; rig.legR.rotation.x = swingSecond * 0.55 * amountIn;
  rig.kneeL.rotation.x = Math.max(0, -swingSecond) * 0.6 * amountIn; rig.kneeR.rotation.x = Math.max(0, -swingFirst) * 0.6 * amountIn;
  rig.armL.rotation.x = swingSecond * 0.4 * amountIn; rig.armR.rotation.x = swingFirst * 0.4 * amountIn;
  rig.foreL.rotation.x = -0.25 - Math.max(0, swingFirst) * 0.3 * amountIn; rig.foreR.rotation.x = -0.25 - Math.max(0, swingSecond) * 0.3 * amountIn;
  rig.torsoG.position.y = (rig.H * 0.48) + Math.abs(Math.sin(phaseIn)) * 0.03 * amountIn + (amountIn < 0.05 ? Math.sin(phaseIn * 0.35) * 0.006 : 0);
  rig.headG.rotation.x = Math.sin(phaseIn * 0.5) * 0.03; }
export function poseSeated(figIn) {
  const rig = figIn.userData; if (!rig) return;
  rig.seated = true;
  if (rig.figIsGlb && rig.glbInner) { rig.glbInner.position.y = -0.55; return; }
  if (!rig.legL) return;
  const seatedHipAngle = 0.12 - Math.PI / 2;
  const seatedKneeAngle = Math.PI / 2 - 0.15;
  [rig.legL, rig.legR].forEach((jointIn) => { jointIn.rotation.x = seatedHipAngle; });
  [rig.kneeL, rig.kneeR].forEach((jointIn) => { jointIn.rotation.x = seatedKneeAngle; });
  [rig.armL, rig.armR].forEach((jointIn) => { jointIn.rotation.x = -0.85; });
  rig.armL.rotation.z = 0.3; rig.armR.rotation.z = -0.3;
  [rig.foreL, rig.foreR].forEach((jointIn) => { jointIn.rotation.x = -0.35; });
  rig.torsoG.position.y = rig.H * 0.48; }
export function createPlayer(G) {
  startHeroLoad();
  const outerGroup = new THREE.Group();
  const proceduralVisual = makeFigure(CAST.ren);
  outerGroup.add(proceduralVisual);
  const spawnPosX = -412.5, spawnPosZ = 470;
  outerGroup.position.set(spawnPosX, groundH(spawnPosX, spawnPosZ), spawnPosZ);
  outerGroup.rotation.y = Math.PI;
  G.scene.add(outerGroup);
  const playerObj = { fig: outerGroup, procFig: proceduralVisual, visual: proceduralVisual, glbInner: null, glbShadow: null, figIsGlb: false, elapsed: 0, x: spawnPosX, z: spawnPosZ, angle: Math.PI, phase: 0, speed: 0, health: 100 };
  G.player = playerObj;
  if (!swapHeroToModel(playerObj)) mcWaiters.add(playerObj);
  return playerObj; }
export function updatePlayer(G, dt) {
  const pl = G.player; if (!pl || !pl.fig.visible) return;
  const keyMap = G.keys;
  let moveX = 0, moveZ = 0;
  if (keyMap['KeyW'] || keyMap['ArrowUp']) moveZ += 1;
  if (keyMap['KeyS'] || keyMap['ArrowDown']) moveZ -= 1;
  if (keyMap['KeyA'] || keyMap['ArrowLeft']) moveX -= 1;
  if (keyMap['KeyD'] || keyMap['ArrowRight']) moveX += 1;
  const movingNow = !(moveX === 0 && moveZ === 0);
  const paceRate = (keyMap['ShiftLeft'] || keyMap['ShiftRight']) ? 9 : 6;
  if (movingNow) {
    const cameraYaw = G.camYaw || 0;
    const worldMoveX = Math.cos(cameraYaw) * moveX + Math.sin(cameraYaw) * moveZ;
    const worldMoveZ = Math.cos(cameraYaw) * moveZ - Math.sin(cameraYaw) * moveX;
    const moveLen = Math.hypot(worldMoveX, worldMoveZ) || 1;
    pl.x += (worldMoveX / moveLen) * paceRate * dt; pl.z += (worldMoveZ / moveLen) * paceRate * dt;
    pl.angle = Math.atan2(worldMoveX / moveLen, worldMoveZ / moveLen);
    pl.phase += dt * paceRate * 1.9;
    pl.speed = paceRate;
  } else pl.speed = 0;
  G.colliders.forEach((collider) => {
    const deltaX = pl.x - collider.x, deltaZ = pl.z - collider.z;
    const penAlongX = collider.hw + 0.45 - Math.abs(deltaX), penAlongZ = collider.hd + 0.45 - Math.abs(deltaZ);
    if (penAlongX > 0 && penAlongZ > 0) { if (penAlongZ > penAlongX) pl.x += (deltaX >= 0 ? penAlongX : -penAlongX); else pl.z += (deltaZ >= 0 ? penAlongZ : -penAlongZ); } });
  pl.x = Math.max(-655, Math.min(655, pl.x)); pl.z = Math.max(-655, Math.min(655, pl.z));
  pl.fig.position.set(pl.x, groundH(pl.x, pl.z), pl.z);
  pl.fig.rotation.y = pl.angle;
  pl.elapsed = (pl.elapsed || 0) + dt;
  if (pl.figIsGlb && pl.glbInner) {
    const innerGroup = pl.glbInner;
    const paceFraction = Math.min(1, Math.abs(pl.speed || 0) / 9);
    if (movingNow) {
      innerGroup.position.y = Math.abs(Math.sin(pl.phase)) * 0.045;
      innerGroup.rotation.z = Math.sin(pl.phase) * 0.035;
      innerGroup.rotation.x = paceFraction * 0.05;
    } else {
      innerGroup.position.y = Math.sin(pl.elapsed * 1.6) * 0.008;
      innerGroup.rotation.z = 0; innerGroup.rotation.x = 0; }
    innerGroup.rotation.y = MC_YAW_CORRECTION;
  } else animateFigure(pl.procFig || pl.fig, pl.phase, movingNow ? 1 : 0.04); }
