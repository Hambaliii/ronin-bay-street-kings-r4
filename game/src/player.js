// The player on foot, plus the factory that builds textured figures
// Bodies run to roughly seven and a half heads tall, assembled
// from capsule and lathe pieces dressed in procedural canvas cloth
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { loadHeroAsset } from './assets.js';
// A loaded model may step in as the hero visual, but the outer
// group remains the object the updater positions and turns
// Within it sits either the procedural figure or a clone of
// the loaded wrapper, riding an inner group that bobs, rocks
// and leans as it moves
// A failed load resolves null and swaps nothing, which leaves
// the procedural figure as the exact fallback, and a single
// constant decides the facing flip
const MC_FACING_OFFSET = 0;
let mcModelHeld = null;
let mcLoadBegun = false;
const mcWaitingSet = new Set();
function makeShadowDisc(radiusHeld) {
  const discHeld = new THREE.Mesh(new THREE.CircleGeometry(radiusHeld, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  discHeld.rotation.x = (-Math.PI / 2);
  discHeld.position.y = 0.02;
  return discHeld; }
function mcSwapPrevented(heroRec) {
  return !heroRec || !mcModelHeld || heroRec.figIsGlb; }
function attemptMcSwap(heroRec) {
  try {
    if (mcSwapPrevented(heroRec)) return false;
    const innerHeld = new THREE.Group();
    innerHeld.name = 'mc-glb-inner';
    innerHeld.rotation.y = MC_FACING_OFFSET;
    innerHeld.add(mcModelHeld.clone(true));
    if (heroRec.procFig) heroRec.fig.remove(heroRec.procFig);
    heroRec.fig.add(innerHeld);
    const discHeld = makeShadowDisc(0.42);
    heroRec.fig.add(discHeld);
    heroRec.glbInner = innerHeld;
    heroRec.glbShadow = discHeld;
    heroRec.visual = innerHeld;
    heroRec.figIsGlb = true;
    return true;
  } catch (swallowed) { return false; } }
function runMcLoadRound(roundsLeft) {
  try {
    loadHeroAsset('mc').then((modelNode) => {
      try {
        if (!modelNode) { if (roundsLeft > 0) setTimeout(() => runMcLoadRound(roundsLeft - 1), 1500); return; }
        mcModelHeld = modelNode;
        mcWaitingSet.forEach((waitingRec) => attemptMcSwap(waitingRec));
        mcWaitingSet.clear();
      } catch (swallowed) { /* the procedural fallback stays in place */ }
    }).catch(() => { if (roundsLeft > 0) setTimeout(() => runMcLoadRound(roundsLeft - 1), 1500); });
  } catch (swallowed) { /* the procedural fallback stays in place */ } }
function beginMcLoad() {
  if (mcLoadBegun) return;
  mcLoadBegun = true;
  // A null answer earns a retry rather than counting as final,
  // because loads racing at module init can lose the fetch
  // race and a cached null would strand every waiter on the
  // procedural figure for the whole session, while the asset
  // module drops nulls when a retry shows up
  runMcLoadRound(3); }
beginMcLoad();
// Cast figures use the same replacement pattern for loaded visuals
// The rival driver and the officer point at their own assets
// and both face forward, so a zero rotation lines up with the
// procedural facing exactly
// The factory hands back the outer group; its transform and
// animation stay untouched and only the inner visual changes
// once the model lands
const CAST_FACING_OFFSET = 0;
const CAST_ASSET_MAP = { shun: 'rivalDriver', cop: 'policeOfficer' };
const castModelMap = new Map();
const castBegunSet = new Set();
const castWaitingMap = new Map();
function stashProceduralChildren(figNode) {
  const stashHeld = new THREE.Group();
  stashHeld.name = 'cast-proc-visual';
  while (figNode.children.length) stashHeld.add(figNode.children[0]);
  return stashHeld; }
function attemptCastSwap(figNode, assetKey) {
  try {
    const templateHeld = castModelMap.get(assetKey);
    const blockedHeld = !figNode || !templateHeld || figNode.userData.figIsGlb;
    if (blockedHeld) return false;
    const innerHeld = new THREE.Group();
    innerHeld.name = 'cast-glb-inner';
    innerHeld.rotation.y = CAST_FACING_OFFSET;
    innerHeld.add(templateHeld.clone(true));
    const stashHeld = stashProceduralChildren(figNode);
    figNode.add(innerHeld);
    const discHeld = makeShadowDisc(0.42);
    figNode.add(discHeld);
    figNode.userData.procFig = stashHeld;
    figNode.userData.glbInner = innerHeld;
    figNode.userData.glbShadow = discHeld;
    figNode.userData.figIsGlb = true;
    if (figNode.userData.seated) innerHeld.position.y = -0.55;
    figNode.figIsGlb = true;
    return true;
  } catch (swallowed) { return false; } }
function handCastTemplate(assetKey, wrapNode) {
  castModelMap.set(assetKey, wrapNode);
  const waiterHeld = castWaitingMap.get(assetKey);
  if (waiterHeld) { waiterHeld.forEach((figNode) => attemptCastSwap(figNode, assetKey)); waiterHeld.clear(); } }
function beginCastLoad(assetKey) {
  if (castBegunSet.has(assetKey)) return;
  castBegunSet.add(assetKey);
  try {
    loadHeroAsset(assetKey).then((modelNode) => {
      try {
        if (!modelNode) return;
        handCastTemplate(assetKey, modelNode);
      } catch (swallowed) { /* the procedural fallback stays in place */ }
    }).catch(() => { /* the procedural fallback stays in place */ });
  } catch (swallowed) { /* the procedural fallback stays in place */ } }
export function applyCastFigureOverride(figNode, castKey) {
  try {
    if (!figNode || !castKey) return false;
    const assetKey = CAST_ASSET_MAP[castKey];
    if (!assetKey) return false;
    figNode.userData.castKey = castKey;
    if (figNode.userData.figIsGlb) return true;
    beginCastLoad(assetKey);
    if (attemptCastSwap(figNode, assetKey)) return true;
    if (!castWaitingMap.has(assetKey)) castWaitingMap.set(assetKey, new Set());
    castWaitingMap.get(assetKey).add(figNode);
    return true;
  } catch (swallowed) { return false; } }
// Texture noise stays deterministic through a tiny local generator
function seededNoise(seedHeld) {
  let cellHeld = ((seedHeld * 7919) + 13);
  const nextUnit = () => { cellHeld = ((cellHeld * 16807) % 2147483647); return ((cellHeld & 0xffff) / 0xffff); };
  return nextUnit; }
function toCssHex(colourHeld) {
  const hexBody = colourHeld.toString(16).padStart(6, '0');
  return ('#' + hexBody); }
function toCssHexScaled(colourHeld, scaleHeld) {
  const colourTmp = new THREE.Color(colourHeld);
  colourTmp.multiplyScalar(scaleHeld);
  return ('#' + colourTmp.getHexString()); }

// The clothing canvas texture
// The front design centres on a quarter of the wrap with the
// plain back at three quarters, while lathe and cylinder
// mapping wraps the circumference with the seam at the back
// by default, so turning a part half a turn brings the front
// around to face forward
function fleckDark(pen, nextNoise, noiseSrc) {
  let speckPos = 0;
  while (speckPos < 1400) { pen.fillStyle = `rgba(0,0,0,${0.03 + 0.05 * nextNoise()})`; pen.fillRect(256 * noiseSrc(), 256 * noiseSrc(), 2, 1); speckPos++; } }
function fleckLight(pen, nextNoise, noiseSrc) {
  let speckPos = 0;
  while (speckPos < 700) { pen.fillStyle = `rgba(255,255,255,${0.02 + 0.04 * nextNoise()})`; pen.fillRect(256 * noiseSrc(), 256 * noiseSrc(), 2, 1); speckPos++; } }
function drawPantsFront(ctxHeld, nextNoise, noiseSrc, topHeld, shadeHeld, frontX) {
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.75); ctxHeld.fillRect(0, 0, 256, 256);
  let speckPos = 0;
  while (speckPos < 1400) { ctxHeld.fillStyle = `rgba(255,255,255,${0.03 + 0.04 * nextNoise()})`; ctxHeld.fillRect(256 * noiseSrc(), 256 * noiseSrc(), 1, 3); speckPos++; }
  ctxHeld.fillStyle = shadeHeld; ctxHeld.fillRect(0, 0, 256, 256);
  ctxHeld.lineWidth = 2; ctxHeld.strokeStyle = 'rgba(0,0,0,.45)';
  ctxHeld.beginPath(); ctxHeld.arc((frontX + (-26)), 44, 16, 0.2, 2.4); ctxHeld.stroke();
  ctxHeld.beginPath(); ctxHeld.arc((frontX + 26), 44, 16, 0.7, 2.9); ctxHeld.stroke();
  ctxHeld.strokeStyle = 'rgba(255,200,120,.5)'; ctxHeld.beginPath(); ctxHeld.moveTo(frontX, 30); ctxHeld.lineTo(frontX, 120); ctxHeld.stroke();
  ctxHeld.fillStyle = '#3a2a1a'; ctxHeld.fillRect(0, 0, 256, 22);
  ctxHeld.fillStyle = '#c0c4c8'; ctxHeld.fillRect((frontX + (-10)), 4, 20, 14); ctxHeld.fillStyle = '#3a2a1a'; ctxHeld.fillRect((frontX + (-5)), 7, 10, 8); }
function drawJacketFront(ctxHeld, kindHeld, topHeld, trimHeld, frontX) {
  if (kindHeld === 'leather') { const sheenHeld = ctxHeld.createLinearGradient(0, 0, 256, 256); sheenHeld.addColorStop(0, 'rgba(255,255,255,.16)'); sheenHeld.addColorStop(0.5, 'rgba(255,255,255,0)'); ctxHeld.fillStyle = sheenHeld; ctxHeld.fillRect(0, 0, 256, 256); }
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.7); ctxHeld.fillRect(0, 0, 256, 26);
  if (trimHeld) { ctxHeld.fillStyle = toCssHex(trimHeld); ctxHeld.fillRect(0, 22, 256, 5); }
  ctxHeld.lineWidth = 4; ctxHeld.strokeStyle = '#14161a'; ctxHeld.beginPath();
  if (kindHeld === 'leather') { ctxHeld.moveTo((frontX + (-30)), 26); ctxHeld.lineTo((frontX + 22), 200); } else { ctxHeld.moveTo(frontX, 26); ctxHeld.lineTo(frontX, 240); }
  ctxHeld.stroke();
  ctxHeld.lineWidth = 1; ctxHeld.strokeStyle = '#9aa0a6';
  for (let yPos = 30; yPos < 235; yPos += 7) { const zipShare = ((yPos + (-26)) / 210); const zipX = (kindHeld === 'leather') ? ((frontX + (-30)) + (52 * zipShare)) : frontX; ctxHeld.beginPath(); ctxHeld.moveTo((zipX + (-4)), yPos); ctxHeld.lineTo((zipX + 4), yPos); ctxHeld.stroke(); }
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.82); ctxHeld.fillRect((frontX + (-52)), 84, 34, 16); ctxHeld.fillRect((frontX + 18), 84, 34, 16);
  ctxHeld.fillStyle = 'rgba(0,0,0,.35)'; ctxHeld.fillRect((frontX + (-52)), 98, 34, 3); ctxHeld.fillRect((frontX + 18), 98, 34, 3);
  if (trimHeld) { ctxHeld.fillStyle = toCssHex(trimHeld); ctxHeld.fillRect(0, 218, 256, 8); } }
function drawHoodieFront(ctxHeld, topHeld, frontX) {
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.78); ctxHeld.fillRect(0, 0, 256, 34);
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.85); ctxHeld.fillRect((frontX + (-38)), 176, 76, 52);
  ctxHeld.strokeStyle = 'rgba(0,0,0,.3)'; ctxHeld.strokeRect((frontX + (-38)), 176, 76, 52);
  ctxHeld.lineWidth = 3; ctxHeld.strokeStyle = '#f2f2f2';
  ctxHeld.beginPath(); ctxHeld.moveTo((frontX + (-8)), 36); ctxHeld.lineTo((frontX + (-12)), 66); ctxHeld.stroke();
  ctxHeld.beginPath(); ctxHeld.moveTo((frontX + 8), 36); ctxHeld.lineTo((frontX + 12), 66); ctxHeld.stroke(); }
function drawTankFront(ctxHeld) {
  ctxHeld.fillStyle = 'rgba(0,0,0,.10)'; ctxHeld.beginPath(); ctxHeld.ellipse(20, 128, 26, 90, 0, 0, 6.3); ctxHeld.fill();
  ctxHeld.beginPath(); ctxHeld.ellipse(108, 128, 26, 90, 0, 0, 6.3); ctxHeld.fill(); }
function drawOverallsFront(ctxHeld, topHeld, frontX) {
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.88); ctxHeld.fillRect((frontX + (-34)), 60, 68, 90);
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.8); ctxHeld.fillRect((frontX + (-40)), 0, 14, 70); ctxHeld.fillRect((frontX + 26), 0, 14, 70);
  ctxHeld.fillStyle = '#d8b13c'; ctxHeld.beginPath(); ctxHeld.arc((frontX + (-30)), 66, 5, 0, 6.3); ctxHeld.fill(); ctxHeld.beginPath(); ctxHeld.arc((frontX + 30), 66, 5, 0, 6.3); ctxHeld.fill();
  ctxHeld.strokeStyle = 'rgba(0,0,0,.3)'; ctxHeld.strokeRect((frontX + (-34)), 60, 68, 90); }
function drawUniformFront(ctxHeld, trimHeld, frontX) {
  ctxHeld.strokeStyle = '#c8ccd2'; ctxHeld.lineWidth = 2; ctxHeld.beginPath(); ctxHeld.moveTo(frontX, 30); ctxHeld.lineTo(frontX, 240); ctxHeld.stroke();
  ctxHeld.fillStyle = '#e8e8e8'; for (let yPos = 44; yPos < 230; yPos += 26) { ctxHeld.beginPath(); ctxHeld.arc(frontX, yPos, 3.4, 0, 6.3); ctxHeld.fill(); }
  ctxHeld.fillStyle = toCssHex(trimHeld || 0xc8a028); ctxHeld.beginPath(); ctxHeld.arc((frontX + (-32)), 66, 10, 0, 6.3); ctxHeld.fill();
  ctxHeld.fillStyle = '#7a5c10'; ctxHeld.beginPath(); ctxHeld.arc((frontX + (-32)), 66, 5, 0, 6.3); ctxHeld.fill();
  if (trimHeld) { ctxHeld.fillStyle = toCssHex(trimHeld); ctxHeld.fillRect(0, 4, 256, 7); } }
function drawCargoFront(ctxHeld, topHeld) {
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.85); ctxHeld.fillRect(8, 130, 44, 52); ctxHeld.fillRect(76, 130, 44, 52);
  ctxHeld.strokeStyle = 'rgba(0,0,0,.4)'; ctxHeld.strokeRect(8, 130, 44, 52); ctxHeld.strokeRect(76, 130, 44, 52); ctxHeld.fillStyle = '#3a2a1a'; ctxHeld.fillRect(0, 0, 256, 20); }
function drawSkirtFront(ctxHeld, topHeld) {
  ctxHeld.fillStyle = toCssHexScaled(topHeld, 0.9); ctxHeld.fillRect(0, 0, 256, 256);
  ctxHeld.fillStyle = 'rgba(0,0,0,.2)'; for (let xPos = 0; xPos < 256; xPos += 32) ctxHeld.fillRect(xPos, 0, 3, 256); }
export function makeClothTexture(kindHeld, topHeld, trimHeld, pantsHeld) {
  const cvHeld = document.createElement('canvas'); cvHeld.width = cvHeld.height = 256;
  const pen = cvHeld.getContext('2d');
  const noiseSrc = seededNoise((kindHeld.length * 131) + (topHeld % 10000));
  const nextNoise = noiseSrc;
  pen.fillStyle = toCssHex(topHeld); pen.fillRect(0, 0, 256, 256);
  fleckDark(pen, nextNoise, noiseSrc);
  fleckLight(pen, nextNoise, noiseSrc);
  const shadeHeld = pen.createLinearGradient(0, 0, 256, 0);
  shadeHeld.addColorStop(0, 'rgba(0,0,0,.28)'); shadeHeld.addColorStop(0.25, 'rgba(255,255,255,.10)');
  shadeHeld.addColorStop(0.5, 'rgba(0,0,0,.28)'); shadeHeld.addColorStop(0.75, 'rgba(255,255,255,.05)'); shadeHeld.addColorStop(1, 'rgba(0,0,0,.28)');
  pen.fillStyle = shadeHeld; pen.fillRect(0, 0, 256, 256);
  const FRONT_X = 64;
  switch (kindHeld) {
    case 'jeans': case 'uniform-pants': drawPantsFront(pen, nextNoise, noiseSrc, topHeld, shadeHeld, FRONT_X); break;
    case 'jacket': case 'leather': drawJacketFront(pen, kindHeld, topHeld, trimHeld, FRONT_X); break;
    case 'hoodie': drawHoodieFront(pen, topHeld, FRONT_X); break;
    case 'tank': drawTankFront(pen); break;
    case 'overalls': drawOverallsFront(pen, topHeld, FRONT_X); break;
    case 'uniform': drawUniformFront(pen, trimHeld, FRONT_X); break;
    case 'cargo': drawCargoFront(pen, topHeld); break;
    case 'skirt': drawSkirtFront(pen, topHeld); break;
  }
  const texHeld = new THREE.CanvasTexture(cvHeld); texHeld.colorSpace = THREE.SRGBColorSpace; return texHeld; }
function makeShoeTexture(colourHeld, stripedHeld) {
  const cvHeld = document.createElement('canvas'); cvHeld.width = cvHeld.height = 128;
  const pen = cvHeld.getContext('2d'); pen.fillStyle = toCssHex(colourHeld); pen.fillRect(0, 0, 128, 128);
  pen.fillStyle = 'rgba(0,0,0,.18)';
  pen.fillRect(0, 88, 128, 40);
  if (stripedHeld) { pen.fillStyle = '#ffffff'; pen.save(); pen.translate(64, 54); pen.rotate(-0.5); for (let stripePos = -1; stripePos <= 1; stripePos++) pen.fillRect(((stripePos * 22) + (-5)), -40, 10, 80); pen.restore(); }
  const texHeld = new THREE.CanvasTexture(cvHeld); texHeld.colorSpace = THREE.SRGBColorSpace; return texHeld; }
function plainMaterial(colourHeld, roughHeld) { const roughUsed = (roughHeld == null) ? 0.85 : roughHeld; return new THREE.MeshStandardMaterial({ color: colourHeld, roughness: roughUsed }); }
function makeLimbCapsule(radiusHeld, lengthHeld, materialHeld) { const limbHeld = new THREE.Mesh(new THREE.CapsuleGeometry(radiusHeld, lengthHeld, 4, 10), materialHeld); limbHeld.castShadow = false; return limbHeld; }

function torsoLathePoints(torsoLen, chestHalf) {
  const ptsHeld = [];
  ptsHeld.push(new THREE.Vector2(0.115, 0));
  ptsHeld.push(new THREE.Vector2(0.135, (torsoLen * 0.25)));
  ptsHeld.push(new THREE.Vector2(chestHalf, (torsoLen * 0.62)));
  ptsHeld.push(new THREE.Vector2((chestHalf * 0.92), (torsoLen * 0.88)));
  ptsHeld.push(new THREE.Vector2(0.075, torsoLen));
  return ptsHeld; }
function buildFaceFeatures(headGrp, skinMat, hairMat, faceY, headR, fullH) {
  const eyeMat = plainMaterial(0x1a1210, 0.4);
  const signsHeld = [-1, 1];
  for (const signHeld of signsHeld) {
    const eyeHeld = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMat); eyeHeld.position.set((signHeld * 0.04 * (fullH / 1.78)), (faceY + 0.012), (headR * 0.92)); headGrp.add(eyeHeld);
    const browHeld = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), hairMat); browHeld.position.set((signHeld * 0.04 * (fullH / 1.78)), (faceY + 0.038), (headR * 0.94)); browHeld.rotation.z = (signHeld * -0.18); headGrp.add(browHeld);
    const earHeld = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skinMat); earHeld.position.set((signHeld * headR * 0.98), faceY, 0); headGrp.add(earHeld); }
  const noseHeld = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 6), skinMat); noseHeld.rotation.x = (Math.PI / 2); noseHeld.position.set(0, (faceY + (-0.012)), (headR * 1.0)); headGrp.add(noseHeld);
  const mouthHeld = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.004), plainMaterial(0x7a4038, 0.7)); mouthHeld.position.set(0, (faceY + (-0.052)), (headR * 0.93)); headGrp.add(mouthHeld);
  return signsHeld; }
function buildCapHair(headGrp, specHeld, faceY, headR) {
  const domeHeld = new THREE.Mesh(new THREE.SphereGeometry((headR * 1.08), 14, 8, 0, 2 * Math.PI, 0, 1.4), plainMaterial((specHeld.hairColor || 0x24304a), 0.8)); domeHeld.position.y = (faceY + 0.012); headGrp.add(domeHeld);
  const brimHeld = new THREE.Mesh(new THREE.CylinderGeometry((headR * 1.25), (headR * 1.3), 0.012, 14, 1, false, -0.7, 1.4), plainMaterial((specHeld.hairColor || 0x24304a), 0.8)); brimHeld.position.set(0, (faceY + 0.045), (headR * 0.55)); headGrp.add(brimHeld); }
function buildStyledHair(headGrp, specHeld, hairMat, faceY, headR, hairKind) {
  const capGeo = new THREE.SphereGeometry((headR * 1.07), 16, 10, 0, 2 * Math.PI, 0, 1.9);
  const capHeld = new THREE.Mesh(capGeo, hairMat); capHeld.scale.y = 1.12; capHeld.position.set(0, (faceY + 0.012), -0.008); headGrp.add(capHeld);
  if (hairKind.includes('topknot')) { const knotHeld = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), hairMat); knotHeld.position.set(0, (faceY + (headR * 1.05)), -0.02); headGrp.add(knotHeld); }
  if (hairKind.includes('ponytail')) { const tailHeld = makeLimbCapsule(0.032, 0.2, hairMat); tailHeld.position.set(0, (faceY + (-0.08)), ((-headR) + (-0.03))); tailHeld.rotation.x = 0.25; headGrp.add(tailHeld); }
  if (hairKind.includes('bob')) { const bobHeld = new THREE.Mesh(new THREE.SphereGeometry((headR * 1.14), 14, 10, 0, 2 * Math.PI, 0, 2.4), hairMat); bobHeld.scale.y = 1.25; bobHeld.position.set(0, (faceY + 0.005), -0.006); headGrp.add(bobHeld); } }
export function makeFigure(specHeld) {
  const fullH = ((specHeld.h || 1) * 1.78);
  const buildShare = (specHeld.build || 0.55);
  const outfitHeld = specHeld.outfit;
  const skinMat = plainMaterial(specHeld.skin, 0.65);
  const hairMat = plainMaterial((specHeld.hairColor || 0x1a1a1a), 0.9);
  const LONG_SLEEVE_KINDS = ['jacket', 'leather', 'hoodie', 'uniform', 'overalls'];
  const sleevesLong = LONG_SLEEVE_KINDS.includes(outfitHeld.top);
  const topKind = (outfitHeld.top === 'uniform') ? 'uniform' : outfitHeld.top;
  const topTex = makeClothTexture(topKind, outfitHeld.topColor, outfitHeld.trim, outfitHeld.pantsColor);
  const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.9 });
  const pantsKindRaw = (outfitHeld.pants === 'jeans') ? 'jeans' : ((outfitHeld.pants === 'uniform') ? 'jeans' : outfitHeld.pants);
  const pantsKind = (pantsKindRaw === 'skirt+leggings') ? 'skirt' : pantsKindRaw;
  const pantsTex = makeClothTexture(pantsKind, outfitHeld.pantsColor, outfitHeld.trim, outfitHeld.pantsColor);
  const pantsMat = new THREE.MeshStandardMaterial({ map: pantsTex, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ map: makeShoeTexture(outfitHeld.shoes, outfitHeld.shoeStripes), roughness: 0.8 });
  const figHeld = new THREE.Group();
  const legLen = (fullH * 0.48), torsoLen = (fullH * 0.30), headR = (fullH * 0.065);
  const hipY = legLen;
  const pelvisHeld = new THREE.Mesh(new THREE.SphereGeometry((0.145 * ((buildShare * 0.5) + 0.8)), 14, 10), pantsMat);
  pelvisHeld.scale.set(1, 0.7, 0.85); pelvisHeld.position.y = hipY; figHeld.add(pelvisHeld);
  if (outfitHeld.pants === 'skirt+leggings') {
    const skirtHeld = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.24, 14, 1, true), pantsMat);
    skirtHeld.position.y = (hipY + (-0.08)); figHeld.add(skirtHeld); }
  const torsoGrp = new THREE.Group(); torsoGrp.position.y = hipY; figHeld.add(torsoGrp);
  const chestHalf = ((buildShare * 0.055) + 0.13);
  const torsoHeld = new THREE.Mesh(new THREE.LatheGeometry(torsoLathePoints(torsoLen, chestHalf), 16), topMat);
  torsoHeld.rotation.y = Math.PI; torsoHeld.scale.z = 0.78;
  torsoGrp.add(torsoHeld);
  const headGrp = new THREE.Group(); headGrp.position.y = (torsoLen + 0.03); torsoGrp.add(headGrp);
  const neckHeld = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 10), skinMat); neckHeld.position.y = 0.01; headGrp.add(neckHeld);
  const headHeld = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), skinMat);
  headHeld.scale.y = 1.12; headHeld.position.y = (headR + 0.05); headGrp.add(headHeld);
  const faceY = (headR + 0.05);
  const signsHeld = buildFaceFeatures(headGrp, skinMat, hairMat, faceY, headR, fullH);
  const hairKind = (specHeld.hair || 'buzz');
  const capWorn = (hairKind === 'cap') || (specHeld.accessory === 'cap') || (specHeld.accessory === 'cap+badge');
  if (capWorn) buildCapHair(headGrp, specHeld, faceY, headR);
  else buildStyledHair(headGrp, specHeld, hairMat, faceY, headR, hairKind);
  function buildArm(signHeld) {
    const shoulderGrp = new THREE.Group(); shoulderGrp.position.set((signHeld * (chestHalf + 0.03)), (torsoLen + (-0.05)), 0); torsoGrp.add(shoulderGrp);
    const upperMat = (outfitHeld.top === 'tank') ? skinMat : topMat;
    const upperHeld = makeLimbCapsule(0.045, 0.17, upperMat); upperHeld.position.y = -0.13; shoulderGrp.add(upperHeld);
    shoulderGrp.rotation.z = (signHeld * 0.14);
    const elbowGrp = new THREE.Group(); elbowGrp.position.y = -0.27; shoulderGrp.add(elbowGrp);
    const foreMat = sleevesLong ? topMat : skinMat;
    const foreHeld = makeLimbCapsule(0.037, 0.16, foreMat); foreHeld.position.y = -0.115; elbowGrp.add(foreHeld);
    const handMat = (specHeld.accessory === 'gloves') ? plainMaterial(outfitHeld.topColor, 0.8) : skinMat;
    const handHeld = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), handMat); handHeld.scale.set(0.8, 1.15, 0.9); handHeld.position.y = -0.26; elbowGrp.add(handHeld);
    elbowGrp.rotation.x = -0.25;
    return { shoulder: shoulderGrp, elbow: elbowGrp }; }
  const armLHeld = buildArm(-1), armRHeld = buildArm(1);
  function buildLeg(signHeld) {
    const hipGrp = new THREE.Group(); hipGrp.position.set((signHeld * 0.085), (hipY + (-0.02)), 0); figHeld.add(hipGrp);
    const thighMat = (outfitHeld.pants === 'skirt+leggings') ? pantsMat : pantsMat;
    const thighHeld = makeLimbCapsule(0.068, 0.26, thighMat); thighHeld.position.y = (legLen * -0.25); hipGrp.add(thighHeld);
    const kneeGrp = new THREE.Group(); kneeGrp.position.y = (legLen * -0.5); hipGrp.add(kneeGrp);
    const shinMat = (outfitHeld.pants === 'skirt+leggings') ? plainMaterial(outfitHeld.pantsColor, 0.9) : pantsMat;
    const shinHeld = makeLimbCapsule(0.052, 0.26, shinMat); shinHeld.position.y = (legLen * -0.24); kneeGrp.add(shinHeld);
    const shoeGrp = new THREE.Group(); shoeGrp.position.y = (0.03 + (-(legLen * 0.5))); kneeGrp.add(shoeGrp);
    const shoeHeld = makeLimbCapsule(0.05, 0.1, shoeMat); shoeHeld.rotation.x = (Math.PI / 2); shoeHeld.scale.set(0.85, 1, 0.6); shoeHeld.position.set(0, -0.02, 0.045); shoeGrp.add(shoeHeld);
    const soleHeld = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.24), plainMaterial(0xf5f5f5, 0.7)); soleHeld.position.set(0, -0.055, 0.04); shoeGrp.add(soleHeld);
    return { hip: hipGrp, knee: kneeGrp }; }
  const legLHeld = buildLeg(-1), legRHeld = buildLeg(1);
  if (specHeld.accessory === 'glasses') {
    const frameMat = plainMaterial(0x14161a, 0.3);
    signsHeld.forEach((signHeld) => { const lensHeld = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.04), new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.1, metalness: 0.6 })); lensHeld.position.set((signHeld * 0.04), (faceY + 0.012), (headR + 0.012)); headGrp.add(lensHeld); const barHeld = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.004), frameMat); barHeld.position.copy(lensHeld.position); barHeld.position.y += 0.023; headGrp.add(barHeld); }); }
  if (specHeld.accessory === 'chain') { const chainHeld = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20), new THREE.MeshStandardMaterial({ color: 0xd8b13c, metalness: 0.9, roughness: 0.3 })); chainHeld.position.set(0, (torsoLen + (-0.02)), 0.1); chainHeld.rotation.x = 0.5; torsoGrp.add(chainHeld); }
  if (specHeld.accessory === 'phone') { const phoneHeld = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), plainMaterial(0x14161c, 0.3)); phoneHeld.position.set(0, -0.27, 0.03); armRHeld.elbow.add(phoneHeld); }
  if (specHeld.accessory === 'cap+badge') { const badgeHeld = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0xc8a028, metalness: 0.9, roughness: 0.3 })); badgeHeld.rotation.x = (Math.PI / 2); badgeHeld.position.set(-0.07, (torsoLen * 0.72), (chestHalf * 0.8)); torsoGrp.add(badgeHeld); }
  const groundShadow = makeShadowDisc(0.42);
  figHeld.add(groundShadow);
  figHeld.userData = { legL: legLHeld.hip, legR: legRHeld.hip, kneeL: legLHeld.knee, kneeR: legRHeld.knee, armL: armLHeld.shoulder, armR: armRHeld.shoulder, foreL: armLHeld.elbow, foreR: armRHeld.elbow, headG: headGrp, torsoG: torsoGrp, H: fullH };
  // Callers pass the cast entry itself, so identity checks can
  // get the cast key back even where call sites never thread
  // it through, and a single hook covers rivals, dialogue
  // staging and seated drivers alike
  Object.keys(CAST_ASSET_MAP).forEach((castKey) => {
    if (specHeld === CAST[castKey]) applyCastFigureOverride(figHeld, castKey); });
  return figHeld; }

function animateLoadedHolder(holderNode, phaseHeld, amountHeld, yawTrim) {
  const movingHard = (amountHeld > 0.05);
  if (movingHard) {
    holderNode.position.y = (Math.abs(Math.sin(phaseHeld)) * 0.045);
    holderNode.rotation.z = (Math.sin(phaseHeld) * 0.035);
    holderNode.rotation.x = (Math.min(1, amountHeld) * 0.05);
  } else {
    holderNode.position.y = (Math.sin(phaseHeld * 0.35) * 0.008);
    holderNode.rotation.z = 0; holderNode.rotation.x = 0; }
  holderNode.rotation.y = yawTrim; }
export function animateFigure(figNode, phaseHeld, amountHeld) {
  const rigHeld = figNode.userData; if (!rigHeld) return;
  if (rigHeld.figIsGlb && rigHeld.glbInner) { animateLoadedHolder(rigHeld.glbInner, phaseHeld, amountHeld, CAST_FACING_OFFSET); return; }
  if (!rigHeld.legL) return;
  const swingLate = Math.sin((phaseHeld + Math.PI));
  const swingEarly = Math.sin(phaseHeld);
  const swingPairs = [[rigHeld.legL, swingEarly], [rigHeld.legR, swingLate]];
  for (const [jointNode, swingVal] of swingPairs) { jointNode.rotation.x = ((swingVal * 0.55) * amountHeld); }
  rigHeld.kneeL.rotation.x = ((Math.max(0, -swingLate) * 0.6) * amountHeld); rigHeld.kneeR.rotation.x = ((Math.max(0, -swingEarly) * 0.6) * amountHeld);
  rigHeld.armL.rotation.x = ((swingLate * 0.4) * amountHeld); rigHeld.armR.rotation.x = ((swingEarly * 0.4) * amountHeld);
  rigHeld.foreL.rotation.x = (-0.25 + (-((Math.max(0, swingEarly) * 0.3) * amountHeld))); rigHeld.foreR.rotation.x = (-0.25 + (-((Math.max(0, swingLate) * 0.3) * amountHeld)));
  const idleLift = (amountHeld < 0.05) ? (Math.sin(phaseHeld * 0.35) * 0.006) : 0;
  rigHeld.torsoG.position.y = (((rigHeld.H * 0.48) + ((Math.abs(Math.sin(phaseHeld)) * 0.03) * amountHeld)) + idleLift);
  rigHeld.headG.rotation.x = (Math.sin(phaseHeld * 0.5) * 0.03); }
export function poseSeated(figNode) {
  const rigHeld = figNode.userData; if (!rigHeld) return;
  rigHeld.seated = true;
  if (rigHeld.figIsGlb && rigHeld.glbInner) { rigHeld.glbInner.position.y = -0.55; return; }
  if (!rigHeld.legL) return;
  const hipBendHeld = (0.12 + (-(Math.PI / 2)));
  const kneeBendHeld = ((Math.PI / 2) + (-0.15));
  const hipsHeld = [rigHeld.legL, rigHeld.legR];
  hipsHeld.forEach((jointNode) => { jointNode.rotation.x = hipBendHeld; });
  const kneesHeld = [rigHeld.kneeL, rigHeld.kneeR];
  kneesHeld.forEach((jointNode) => { jointNode.rotation.x = kneeBendHeld; });
  const armsHeld = [rigHeld.armL, rigHeld.armR];
  armsHeld.forEach((jointNode) => { jointNode.rotation.x = -0.85; });
  rigHeld.armL.rotation.z = 0.3; rigHeld.armR.rotation.z = -0.3;
  const foresHeld = [rigHeld.foreL, rigHeld.foreR];
  foresHeld.forEach((jointNode) => { jointNode.rotation.x = -0.35; });
  rigHeld.torsoG.position.y = (rigHeld.H * 0.48); }
export function createPlayer(stateHeld) {
  beginMcLoad();
  const outerHeld = new THREE.Group();
  const procHeld = makeFigure(CAST.ren);
  outerHeld.add(procHeld);
  const spawnX = -412.5, spawnZ = 470;
  outerHeld.position.set(spawnX, groundH(spawnX, spawnZ), spawnZ);
  outerHeld.rotation.y = Math.PI;
  stateHeld.scene.add(outerHeld);
  const heroRec = { fig: outerHeld, procFig: procHeld, visual: procHeld, glbInner: null, glbShadow: null, figIsGlb: false, elapsed: 0, x: spawnX, z: spawnZ, angle: Math.PI, phase: 0, speed: 0, health: 100 };
  stateHeld.player = heroRec;
  const swappedHeld = attemptMcSwap(heroRec);
  if (!swappedHeld) mcWaitingSet.add(heroRec);
  return heroRec; }
function eitherKeyDown(keysHeld, codeMain, codeAlt) {
  return !!(keysHeld[codeMain] || keysHeld[codeAlt]); }
function readDirection(keysHeld) {
  let stepX = 0, stepZ = 0;
  if (eitherKeyDown(keysHeld, 'KeyW', 'ArrowUp')) stepZ += 1;
  if (eitherKeyDown(keysHeld, 'KeyS', 'ArrowDown')) stepZ -= 1;
  if (eitherKeyDown(keysHeld, 'KeyA', 'ArrowLeft')) stepX -= 1;
  if (eitherKeyDown(keysHeld, 'KeyD', 'ArrowRight')) stepX += 1;
  return { inputX: stepX, inputZ: stepZ }; }
function resolveColliders(stateHeld, heroRec) {
  for (const colliderHeld of stateHeld.colliders) {
    const offX = (heroRec.x + (-colliderHeld.x)), offZ = (heroRec.z + (-colliderHeld.z));
    const penX = ((colliderHeld.hw + 0.45) + (-Math.abs(offX)));
    const penZ = ((colliderHeld.hd + 0.45) + (-Math.abs(offZ)));
    const touchingHeld = (penX > 0) && (penZ > 0);
    if (!touchingHeld) continue;
    if (penZ > penX) heroRec.x += (offX >= 0) ? penX : -penX;
    else heroRec.z += (offZ >= 0) ? penZ : -penZ; } }
function animateHeroFigure(stateHeld, heroRec, movingHeld) {
  if (heroRec.figIsGlb && heroRec.glbInner) {
    const holderNode = heroRec.glbInner;
    const paceShare = Math.min(1, (Math.abs(heroRec.speed || 0) / 9));
    if (movingHeld) {
      holderNode.position.y = (Math.abs(Math.sin(heroRec.phase)) * 0.045);
      holderNode.rotation.z = (Math.sin(heroRec.phase) * 0.035);
      holderNode.rotation.x = (paceShare * 0.05);
    } else {
      holderNode.position.y = (Math.sin(heroRec.elapsed * 1.6) * 0.008);
      holderNode.rotation.z = 0; holderNode.rotation.x = 0; }
    holderNode.rotation.y = MC_FACING_OFFSET;
  } else animateFigure((heroRec.procFig || heroRec.fig), heroRec.phase, movingHeld ? 1 : 0.04); }
function moveHeroStep(stateHeld, heroRec, dirHeld, dtHeld) {
  const sprintHeld = (stateHeld.keys['ShiftLeft'] || stateHeld.keys['ShiftRight']);
  const paceHeld = sprintHeld ? 9 : 6;
  const camYawHeld = (stateHeld.camYaw || 0);
  const worldX = ((Math.cos(camYawHeld) * dirHeld.inputX) + (Math.sin(camYawHeld) * dirHeld.inputZ));
  const worldZ = ((Math.cos(camYawHeld) * dirHeld.inputZ) + (-(Math.sin(camYawHeld) * dirHeld.inputX)));
  const dirLen = (Math.hypot(worldX, worldZ) || 1);
  heroRec.x += (((worldX / dirLen) * paceHeld) * dtHeld);
  heroRec.z += (((worldZ / dirLen) * paceHeld) * dtHeld);
  heroRec.angle = Math.atan2((worldX / dirLen), (worldZ / dirLen));
  heroRec.phase += ((dtHeld * paceHeld) * 1.9);
  heroRec.speed = paceHeld;
  return paceHeld; }
export function updatePlayer(stateHeld, dtHeld) {
  const heroRec = stateHeld.player;
  const playerGone = !heroRec || !heroRec.fig.visible;
  if (playerGone) return;
  const dirHeld = readDirection(stateHeld.keys);
  const movingHeld = !(dirHeld.inputX === 0 && dirHeld.inputZ === 0);
  if (movingHeld) moveHeroStep(stateHeld, heroRec, dirHeld, dtHeld);
  else heroRec.speed = 0;
  resolveColliders(stateHeld, heroRec);
  heroRec.x = Math.max(-655, Math.min(655, heroRec.x));
  heroRec.z = Math.max(-655, Math.min(655, heroRec.z));
  heroRec.fig.position.set(heroRec.x, groundH(heroRec.x, heroRec.z), heroRec.z);
  heroRec.fig.rotation.y = heroRec.angle;
  heroRec.elapsed = ((heroRec.elapsed || 0) + dtHeld);
  animateHeroFigure(stateHeld, heroRec, movingHeld); }
