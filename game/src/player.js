// The hero on foot, and the figure factory behind every body in Ronin Bay — cloth textures included.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { loadHeroAsset } from './assets.js';

const HERO_YAW_TRIM = 0;
let heroModel = null;
let heroLoadBegun = false;
const heroWaiters = new Set();

const buildShadowDisc = (radiusVal) => {
  const matCfg = {};
  matCfg.color = 0x000000; matCfg.transparent = true; matCfg.opacity = 0.3; matCfg.depthWrite = false;
  const discNode = new THREE.Mesh(new THREE.CircleGeometry(radiusVal, 16),
    new THREE.MeshBasicMaterial(matCfg));
  discNode.rotation.x = -Math.PI / 2;
  discNode.position.y = 0.02;
  return discNode;
};

const heroSwapBlocked = (heroRec) => {
  return !heroRec || !heroModel || heroRec.figIsGlb;
};

const tryHeroSwap = (heroRec) => {
  try { if (heroSwapBlocked(heroRec)) return false;
    const innerGrp = new THREE.Group();
    innerGrp.name = 'mc-glb-inner';
    innerGrp.rotation.y = HERO_YAW_TRIM;
    innerGrp.add(heroModel.clone(true));
    if (heroRec.procFig) heroRec.fig.remove(heroRec.procFig);
    heroRec.fig.add(innerGrp);
    const discNode = buildShadowDisc(0.42);
    heroRec.fig.add(discNode);
    heroRec.glbInner = innerGrp;
    heroRec.glbShadow = discNode;
    heroRec.visual = innerGrp;
    heroRec.figIsGlb = true; return true;
  } catch (skip) { return false; }
};

const runHeroLoadRound = (roundsNum) => {
  try { loadHeroAsset('mc').then(function (modelIn) {
      try { if (!modelIn) {
          if (roundsNum > 0) setTimeout(function () { runHeroLoadRound(roundsNum - 1); }, 1500); return;
        }
        heroModel = modelIn;
        for (const waiter of heroWaiters) tryHeroSwap(waiter);
        heroWaiters.clear();
      } catch (skip) {}
    }).catch(function () { if (roundsNum > 0) setTimeout(function () { runHeroLoadRound(roundsNum - 1); }, 1500); });
  } catch (skip) {}
};

const startHeroLoad = () => {
  if (heroLoadBegun) return;
  heroLoadBegun = true;
  runHeroLoadRound(3);
};
startHeroLoad();

const CAST_YAW_TRIM = 0;
const CAST_ASSET_TABLE = {};
CAST_ASSET_TABLE.shun = 'rivalDriver';
CAST_ASSET_TABLE.cop = 'policeOfficer';
const castModels = new Map();
const castStarted = new Set();
const castWaiters = new Map();

const stashProcChildren = (figIn) => {
  const stashGrp = new THREE.Group();
  stashGrp.name = 'cast-proc-visual';
  for (; figIn.children.length;) stashGrp.add(figIn.children[0]);
  return stashGrp;
};

const tryCastSwap = (figIn, assetId) => {
  try { const tplIn = castModels.get(assetId);
    if (!figIn || !tplIn || figIn.userData.figIsGlb) return false;
    const innerGrp = new THREE.Group();
    innerGrp.name = 'cast-glb-inner';
    innerGrp.rotation.y = CAST_YAW_TRIM;
    innerGrp.add(tplIn.clone(true));
    const stashGrp = stashProcChildren(figIn);
    figIn.add(innerGrp);
    const discNode = buildShadowDisc(0.42);
    figIn.add(discNode);
    figIn.userData.procFig = stashGrp;
    figIn.userData.glbInner = innerGrp;
    figIn.userData.glbShadow = discNode;
    figIn.userData.figIsGlb = true;
    if (figIn.userData.seated) innerGrp.position.y = -0.55;
    figIn.figIsGlb = true; return true;
  } catch (skip) { return false; }
};

const deliverCastTemplate = (assetId, wrapIn) => {
  castModels.set(assetId, wrapIn);
  const waiterSet = castWaiters.get(assetId);
  if (waiterSet) {
    for (const figIn of waiterSet) tryCastSwap(figIn, assetId);
    waiterSet.clear();
  }
};

const startCastLoad = (assetId) => {
  if (castStarted.has(assetId)) return;
  castStarted.add(assetId);
  try { loadHeroAsset(assetId).then(function (modelIn) {
      try { if (modelIn) deliverCastTemplate(assetId, modelIn); } catch (skip) {}
    }).catch(function () { return undefined; });
  } catch (skip) {}
};

export const applyCastFigureOverride = (figIn, castId) => {
  try { if (!figIn || !castId) return false;
    const assetId = CAST_ASSET_TABLE[castId];
    if (!assetId) return false;
    figIn.userData.castKey = castId;
    if (figIn.userData.figIsGlb) return true;
    startCastLoad(assetId);
    if (tryCastSwap(figIn, assetId)) return true;
    if (!castWaiters.has(assetId)) castWaiters.set(assetId, new Set());
    castWaiters.get(assetId).add(figIn); return true;
  } catch (skip) { return false; }
};

const makeNoiseFn = (seedVal) => {
  let cellVal = seedVal * 7919 + 13;
  function nextVal() {
    cellVal = (cellVal * 16807) % 2147483647;
    return (cellVal & 0xffff) / 0xffff;
  }
  return nextVal;
};

const cssHexOf = (colourIn) => {
  return `#${colourIn.toString(16).padStart(6, '0')}`;
};

const cssHexScaledOf = (colourIn, scaleVal) => {
  const tmpCol = new THREE.Color(colourIn);
  tmpCol.multiplyScalar(scaleVal);
  return `#${tmpCol.getHexString()}`;
};

const fleckDark = (brush, nextNoise, noiseSrc) => {
  let speckIdx = 0;
  for (; speckIdx < 1400;) {
    brush.fillStyle = 'rgba(0,0,0,' + (0.03 + 0.05 * nextNoise()) + ')';
    brush.fillRect(256 * noiseSrc(), 256 * noiseSrc(), 2, 1);
    speckIdx++;
  }
};

const fleckLight = (brush, nextNoise, noiseSrc) => {
  let speckIdx = 0;
  for (; speckIdx < 700;) {
    brush.fillStyle = 'rgba(255,255,255,' + (0.02 + 0.04 * nextNoise()) + ')';
    brush.fillRect(256 * noiseSrc(), 256 * noiseSrc(), 2, 1);
    speckIdx++;
  }
};

const drawPantsFront = (brush, nextNoise, noiseSrc, topCol, shadeGrad, frontAt) => {
  brush.fillStyle = cssHexScaledOf(topCol, 0.75);
  brush.fillRect(0, 0, 256, 256);
  let speckIdx = 0;
  for (; speckIdx < 1400;) {
    brush.fillStyle = 'rgba(255,255,255,' + (0.03 + 0.04 * nextNoise()) + ')';
    brush.fillRect(256 * noiseSrc(), 256 * noiseSrc(), 1, 3);
    speckIdx++;
  }
  brush.fillStyle = shadeGrad;
  brush.fillRect(0, 0, 256, 256);
  brush.lineWidth = 2;
  brush.strokeStyle = 'rgba(0,0,0,.45)';
  brush.beginPath();
  brush.arc(frontAt - 26, 44, 16, 0.2, 2.4);
  brush.stroke();
  brush.beginPath();
  brush.arc(frontAt + 26, 44, 16, 0.7, 2.9);
  brush.stroke();
  brush.strokeStyle = 'rgba(255,200,120,.5)';
  brush.beginPath();
  brush.moveTo(frontAt, 30);
  brush.lineTo(frontAt, 120);
  brush.stroke();
  brush.fillStyle = '#3a2a1a';
  brush.fillRect(0, 0, 256, 22);
  brush.fillStyle = '#c0c4c8';
  brush.fillRect(frontAt - 10, 4, 20, 14);
  brush.fillStyle = '#3a2a1a';
  brush.fillRect(frontAt - 5, 7, 10, 8);
};

const drawJacketFront = (brush, kindIn, topCol, trimCol, frontAt) => {
  if ('leather' === kindIn) {
    const sheenGrad = brush.createLinearGradient(0, 0, 256, 256);
    sheenGrad.addColorStop(0, 'rgba(255,255,255,.16)');
    sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
    brush.fillStyle = sheenGrad;
    brush.fillRect(0, 0, 256, 256);
  }
  brush.fillStyle = cssHexScaledOf(topCol, 0.7);
  brush.fillRect(0, 0, 256, 26);
  if (trimCol) {
    brush.fillStyle = cssHexOf(trimCol);
    brush.fillRect(0, 22, 256, 5);
  }
  brush.lineWidth = 4;
  brush.strokeStyle = '#14161a';
  brush.beginPath();
  let pathStartX;
  let pathEndX;
  let pathEndY;
  let pathStartY;
  if ('leather' === kindIn) { pathStartX = frontAt - 30; pathEndX = frontAt + 22; pathEndY = 200; pathStartY = 26; }
  else { pathStartX = frontAt; pathEndX = frontAt; pathEndY = 240; pathStartY = 26; }
  brush.moveTo(pathStartX, pathStartY);
  brush.lineTo(pathEndX, pathEndY);
  brush.stroke();
  brush.lineWidth = 1;
  brush.strokeStyle = '#9aa0a6';
  let yIdx = 30;
  while (yIdx < 235) {
    const zipFrac = (yIdx - 26) / 210;
    let zipAt;
    if ('leather' === kindIn) zipAt = frontAt - 30 + 52 * zipFrac; else zipAt = frontAt;
    brush.beginPath();
    brush.moveTo(zipAt - 4, yIdx);
    brush.lineTo(zipAt + 4, yIdx);
    brush.stroke();
    yIdx += 7;
  }
  brush.fillStyle = cssHexScaledOf(topCol, 0.82);
  brush.fillRect(frontAt - 52, 84, 34, 16);
  brush.fillRect(frontAt + 18, 84, 34, 16);
  brush.fillStyle = 'rgba(0,0,0,.35)';
  brush.fillRect(frontAt - 52, 98, 34, 3);
  brush.fillRect(frontAt + 18, 98, 34, 3);
  if (trimCol) {
    brush.fillStyle = cssHexOf(trimCol);
    brush.fillRect(0, 218, 256, 8);
  }
};

const drawHoodieFront = (brush, topCol, frontAt) => {
  brush.fillStyle = cssHexScaledOf(topCol, 0.78);
  brush.fillRect(0, 0, 256, 34);
  brush.fillStyle = cssHexScaledOf(topCol, 0.85);
  brush.fillRect(frontAt - 38, 176, 76, 52);
  brush.strokeStyle = 'rgba(0,0,0,.3)';
  brush.strokeRect(frontAt - 38, 176, 76, 52);
  brush.lineWidth = 3;
  brush.strokeStyle = '#f2f2f2';
  brush.beginPath();
  brush.moveTo(frontAt - 8, 36);
  brush.lineTo(frontAt - 12, 66);
  brush.stroke();
  brush.beginPath();
  brush.moveTo(frontAt + 8, 36);
  brush.lineTo(frontAt + 12, 66);
  brush.stroke();
};

const drawTankFront = (brush) => {
  brush.fillStyle = 'rgba(0,0,0,.10)';
  brush.beginPath();
  brush.ellipse(20, 128, 26, 90, 0, 0, 6.3);
  brush.fill();
  brush.beginPath();
  brush.ellipse(108, 128, 26, 90, 0, 0, 6.3);
  brush.fill();
};

const drawOverallsFront = (brush, topCol, frontAt) => {
  brush.fillStyle = cssHexScaledOf(topCol, 0.88);
  brush.fillRect(frontAt - 34, 60, 68, 90);
  brush.fillStyle = cssHexScaledOf(topCol, 0.8);
  brush.fillRect(frontAt - 40, 0, 14, 70);
  brush.fillRect(frontAt + 26, 0, 14, 70);
  brush.fillStyle = '#d8b13c';
  brush.beginPath();
  brush.arc(frontAt - 30, 66, 5, 0, 6.3);
  brush.fill();
  brush.beginPath();
  brush.arc(frontAt + 30, 66, 5, 0, 6.3);
  brush.fill();
  brush.strokeStyle = 'rgba(0,0,0,.3)';
  brush.strokeRect(frontAt - 34, 60, 68, 90);
};

const drawUniformFront = (brush, trimCol, frontAt) => {
  brush.strokeStyle = '#c8ccd2';
  brush.lineWidth = 2;
  brush.beginPath();
  brush.moveTo(frontAt, 30);
  brush.lineTo(frontAt, 240);
  brush.stroke();
  brush.fillStyle = '#e8e8e8';
  let yIdx = 44;
  while (yIdx < 230) {
    brush.beginPath();
    brush.arc(frontAt, yIdx, 3.4, 0, 6.3);
    brush.fill();
    yIdx += 26;
  }
  brush.fillStyle = cssHexOf(trimCol || 0xc8a028);
  brush.beginPath();
  brush.arc(frontAt - 32, 66, 10, 0, 6.3);
  brush.fill();
  brush.fillStyle = '#7a5c10';
  brush.beginPath();
  brush.arc(frontAt - 32, 66, 5, 0, 6.3);
  brush.fill();
  if (trimCol) {
    brush.fillStyle = cssHexOf(trimCol);
    brush.fillRect(0, 4, 256, 7);
  }
};

const drawCargoFront = (brush, topCol) => {
  brush.fillStyle = cssHexScaledOf(topCol, 0.85);
  brush.fillRect(8, 130, 44, 52);
  brush.fillRect(76, 130, 44, 52);
  brush.strokeStyle = 'rgba(0,0,0,.4)';
  brush.strokeRect(8, 130, 44, 52);
  brush.strokeRect(76, 130, 44, 52);
  brush.fillStyle = '#3a2a1a';
  brush.fillRect(0, 0, 256, 20);
};

const drawSkirtFront = (brush, topCol) => {
  brush.fillStyle = cssHexScaledOf(topCol, 0.9);
  brush.fillRect(0, 0, 256, 256);
  brush.fillStyle = 'rgba(0,0,0,.2)';
  let xIdx = 0;
  while (xIdx < 256) { brush.fillRect(xIdx, 0, 3, 256); xIdx += 32; }
};

export const makeClothTexture = (kindIn, topCol, trimCol, pantsCol) => {
  const cvNode = document.createElement('canvas');
  cvNode.width = cvNode.height = 256;
  const brush = cvNode.getContext('2d');
  let noiseSrc;
  let nextNoise;
  noiseSrc = makeNoiseFn(kindIn.length * 131 + (topCol % 10000)); nextNoise = noiseSrc;
  brush.fillStyle = cssHexOf(topCol);
  brush.fillRect(0, 0, 256, 256);
  fleckDark(brush, nextNoise, noiseSrc);
  fleckLight(brush, nextNoise, noiseSrc);
  const shadeGrad = brush.createLinearGradient(0, 0, 256, 0);
  shadeGrad.addColorStop(0, 'rgba(0,0,0,.28)');
  shadeGrad.addColorStop(0.25, 'rgba(255,255,255,.10)');
  shadeGrad.addColorStop(0.5, 'rgba(0,0,0,.28)');
  shadeGrad.addColorStop(0.75, 'rgba(255,255,255,.05)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,.28)');
  brush.fillStyle = shadeGrad;
  brush.fillRect(0, 0, 256, 256);
  const FRONT_AT = 64;
  if ('jeans' === kindIn || 'uniform-pants' === kindIn) drawPantsFront(brush, nextNoise, noiseSrc, topCol, shadeGrad, FRONT_AT);
  else if ('jacket' === kindIn || 'leather' === kindIn) drawJacketFront(brush, kindIn, topCol, trimCol, FRONT_AT);
  else if ('hoodie' === kindIn) drawHoodieFront(brush, topCol, FRONT_AT);
  else if ('tank' === kindIn) drawTankFront(brush);
  else if ('overalls' === kindIn) drawOverallsFront(brush, topCol, FRONT_AT);
  else if ('uniform' === kindIn) drawUniformFront(brush, trimCol, FRONT_AT);
  else if ('cargo' === kindIn) drawCargoFront(brush, topCol);
  else if ('skirt' === kindIn) drawSkirtFront(brush, topCol);
  const texNode = new THREE.CanvasTexture(cvNode);
  texNode.colorSpace = THREE.SRGBColorSpace;
  return texNode;
};

const makeShoeTexture = (colourIn, stripedFlag) => {
  const cvNode = document.createElement('canvas');
  cvNode.width = cvNode.height = 128;
  const brush = cvNode.getContext('2d');
  brush.fillStyle = cssHexOf(colourIn);
  brush.fillRect(0, 0, 128, 128);
  brush.fillStyle = 'rgba(0,0,0,.18)';
  brush.fillRect(0, 88, 128, 40);
  if (stripedFlag) {
    brush.fillStyle = '#ffffff';
    brush.save();
    brush.translate(64, 54);
    brush.rotate(-0.5);
    let stripeIdx = -1;
    while (stripeIdx <= 1) { brush.fillRect(stripeIdx * 22 - 5, -40, 10, 80); stripeIdx++; }
    brush.restore();
  }
  const texNode = new THREE.CanvasTexture(cvNode);
  texNode.colorSpace = THREE.SRGBColorSpace;
  return texNode;
};

const plainMaterial = (colourIn, roughIn) => {
  const matCfg = {};
  matCfg.color = colourIn; matCfg.roughness = roughIn ?? 0.85;
  return new THREE.MeshStandardMaterial(matCfg);
};

const makeLimbCapsule = (radiusVal, lenVal, matIn) => {
  const limbNode = new THREE.Mesh(new THREE.CapsuleGeometry(radiusVal, lenVal, 4, 10), matIn);
  limbNode.castShadow = false;
  return limbNode;
};

const torsoLathePoints = (torsoLenVal, chestHalfVal) => {
  const ptArr = [new THREE.Vector2(0.115, 0), new THREE.Vector2(0.135, torsoLenVal * 0.25),
    new THREE.Vector2(chestHalfVal, torsoLenVal * 0.62), new THREE.Vector2(chestHalfVal * 0.92, torsoLenVal * 0.88),
    new THREE.Vector2(0.075, torsoLenVal)];
  return ptArr;
};

const buildFaceFeatures = (headNode, skinMatIn, hairMatIn, faceYVal, headRVal, fullHVal) => {
  const eyeMatIn = plainMaterial(0x1a1210, 0.4);
  const signArr = [-1, 1];
  signArr.forEach(function (signVal) {
    const eyeNode = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMatIn);
    eyeNode.position.set(signVal * 0.04 * (fullHVal / 1.78), faceYVal + 0.012, headRVal * 0.92);
    headNode.add(eyeNode);
    const browNode = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), hairMatIn);
    browNode.position.set(signVal * 0.04 * (fullHVal / 1.78), faceYVal + 0.038, headRVal * 0.94);
    browNode.rotation.z = signVal * -0.18;
    headNode.add(browNode);
    const earNode = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skinMatIn);
    earNode.position.set(signVal * headRVal * 0.98, faceYVal, 0);
    headNode.add(earNode);
  });
  const noseNode = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 6), skinMatIn);
  noseNode.rotation.x = Math.PI / 2;
  noseNode.position.set(0, faceYVal - 0.012, headRVal * 1.0);
  headNode.add(noseNode);
  const mouthNode = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.004), plainMaterial(0x7a4038, 0.7));
  mouthNode.position.set(0, faceYVal - 0.052, headRVal * 0.93);
  headNode.add(mouthNode);
  return signArr;
};

const buildCapHair = (headNode, specIn, faceYVal, headRVal) => {
  const domeNode = new THREE.Mesh(
    new THREE.SphereGeometry(headRVal * 1.08, 14, 8, 0, 2 * Math.PI, 0, 1.4),
    plainMaterial(specIn.hairColor || 0x24304a, 0.8)
  );
  domeNode.position.y = faceYVal + 0.012;
  headNode.add(domeNode);
  const brimNode = new THREE.Mesh(
    new THREE.CylinderGeometry(headRVal * 1.25, headRVal * 1.3, 0.012, 14, 1, false, -0.7, 1.4),
    plainMaterial(specIn.hairColor || 0x24304a, 0.8)
  );
  brimNode.position.set(0, faceYVal + 0.045, headRVal * 0.55);
  headNode.add(brimNode);
};

const buildStyledHair = (headNode, specIn, hairMatIn, faceYVal, headRVal, hairStyle) => {
  const capNode = new THREE.Mesh(new THREE.SphereGeometry(headRVal * 1.07, 16, 10, 0, 2 * Math.PI, 0, 1.9), hairMatIn);
  capNode.scale.y = 1.12;
  capNode.position.set(0, faceYVal + 0.012, -0.008);
  headNode.add(capNode);
  if (hairStyle.includes('topknot')) {
    const knotNode = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), hairMatIn);
    knotNode.position.set(0, faceYVal + headRVal * 1.05, -0.02);
    headNode.add(knotNode);
  }
  if (hairStyle.includes('ponytail')) {
    const tailNode = makeLimbCapsule(0.032, 0.2, hairMatIn);
    tailNode.position.set(0, faceYVal - 0.08, -headRVal - 0.03);
    tailNode.rotation.x = 0.25;
    headNode.add(tailNode);
  }
  if (hairStyle.includes('bob')) {
    const bobNode = new THREE.Mesh(new THREE.SphereGeometry(headRVal * 1.14, 14, 10, 0, 2 * Math.PI, 0, 2.4), hairMatIn);
    bobNode.scale.y = 1.25;
    bobNode.position.set(0, faceYVal + 0.005, -0.006);
    headNode.add(bobNode);
  }
};

export const makeFigure = (specIn) => {
  const fullHVal = (specIn.h || 1) * 1.78;
  const buildFrac = specIn.build || 0.55;
  const outfitRec = specIn.outfit;
  let skinMatIn;
  let hairMatIn;
  skinMatIn = plainMaterial(specIn.skin, 0.65);
  hairMatIn = plainMaterial(specIn.hairColor || 0x1a1a1a, 0.9);
  const LONG_SLEEVE_LIST = [];
  LONG_SLEEVE_LIST.push('jacket'); LONG_SLEEVE_LIST.push('leather'); LONG_SLEEVE_LIST.push('hoodie');
  LONG_SLEEVE_LIST.push('uniform'); LONG_SLEEVE_LIST.push('overalls');
  const longSleeved = LONG_SLEEVE_LIST.includes(outfitRec.top);
  let topKindVal;
  if ('uniform' === outfitRec.top) topKindVal = 'uniform'; else topKindVal = outfitRec.top;
  const topTexIn = makeClothTexture(topKindVal, outfitRec.topColor, outfitRec.trim, outfitRec.pantsColor);
  const topMatCfg = {};
  topMatCfg.map = topTexIn; topMatCfg.roughness = 0.9;
  const topMatIn = new THREE.MeshStandardMaterial(topMatCfg);
  let pantsKindBase;
  if ('jeans' === outfitRec.pants) pantsKindBase = 'jeans';
  else if ('uniform' === outfitRec.pants) pantsKindBase = 'jeans';
  else pantsKindBase = outfitRec.pants;
  let pantsKindVal;
  if ('skirt+leggings' === pantsKindBase) pantsKindVal = 'skirt'; else pantsKindVal = pantsKindBase;
  const pantsTexIn = makeClothTexture(pantsKindVal, outfitRec.pantsColor, outfitRec.trim, outfitRec.pantsColor);
  const pantsMatCfg = {};
  pantsMatCfg.map = pantsTexIn; pantsMatCfg.roughness = 0.95;
  const pantsMatIn = new THREE.MeshStandardMaterial(pantsMatCfg);
  const shoeMatCfg = {};
  shoeMatCfg.map = makeShoeTexture(outfitRec.shoes, outfitRec.shoeStripes); shoeMatCfg.roughness = 0.8;
  const shoeMatIn = new THREE.MeshStandardMaterial(shoeMatCfg);
  const figNode = new THREE.Group();
  const legLenVal = fullHVal * 0.48;
  const torsoLenVal = fullHVal * 0.30;
  const headRVal = fullHVal * 0.065;
  const hipYVal = legLenVal;
  const pelvisNode = new THREE.Mesh(new THREE.SphereGeometry(0.145 * (buildFrac * 0.5 + 0.8), 14, 10), pantsMatIn);
  pelvisNode.scale.set(1, 0.7, 0.85);
  pelvisNode.position.y = hipYVal;
  figNode.add(pelvisNode);
  if ('skirt+leggings' === outfitRec.pants) {
    const skirtNode = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.24, 14, 1, true), pantsMatIn);
    skirtNode.position.y = hipYVal - 0.08;
    figNode.add(skirtNode);
  }
  const torsoNode = new THREE.Group();
  torsoNode.position.y = hipYVal;
  figNode.add(torsoNode);
  const chestHalfVal = buildFrac * 0.055 + 0.13;
  const torsoMesh = new THREE.Mesh(new THREE.LatheGeometry(torsoLathePoints(torsoLenVal, chestHalfVal), 16), topMatIn);
  torsoMesh.rotation.y = Math.PI;
  torsoMesh.scale.z = 0.78;
  torsoNode.add(torsoMesh);
  const headNode = new THREE.Group();
  headNode.position.y = torsoLenVal + 0.03;
  torsoNode.add(headNode);
  const neckNode = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 10), skinMatIn);
  neckNode.position.y = 0.01;
  headNode.add(neckNode);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headRVal, 18, 14), skinMatIn);
  headMesh.scale.y = 1.12;
  headMesh.position.y = headRVal + 0.05;
  headNode.add(headMesh);
  const faceYVal = headRVal + 0.05;
  const signArr = buildFaceFeatures(headNode, skinMatIn, hairMatIn, faceYVal, headRVal, fullHVal);
  const hairStyle = specIn.hair || 'buzz';
  const capFlag = 'cap' === hairStyle || 'cap' === specIn.accessory || 'cap+badge' === specIn.accessory;
  if (capFlag) buildCapHair(headNode, specIn, faceYVal, headRVal);
  else buildStyledHair(headNode, specIn, hairMatIn, faceYVal, headRVal, hairStyle);

  const buildArm = (signVal) => {
    const shoulderNode = new THREE.Group();
    shoulderNode.position.set(signVal * (chestHalfVal + 0.03), torsoLenVal - 0.05, 0);
    torsoNode.add(shoulderNode);
    let upperMatIn;
    if ('tank' === outfitRec.top) upperMatIn = skinMatIn; else upperMatIn = topMatIn;
    const upperNode = makeLimbCapsule(0.045, 0.17, upperMatIn);
    upperNode.position.y = -0.13;
    shoulderNode.add(upperNode);
    shoulderNode.rotation.z = signVal * 0.14;
    const elbowNode = new THREE.Group();
    elbowNode.position.y = -0.27;
    shoulderNode.add(elbowNode);
    let foreMatIn;
    if (longSleeved) foreMatIn = topMatIn; else foreMatIn = skinMatIn;
    const foreNode = makeLimbCapsule(0.037, 0.16, foreMatIn);
    foreNode.position.y = -0.115;
    elbowNode.add(foreNode);
    let handMatIn;
    if ('gloves' === specIn.accessory) handMatIn = plainMaterial(outfitRec.topColor, 0.8); else handMatIn = skinMatIn;
    const handNode = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), handMatIn);
    handNode.scale.set(0.8, 1.15, 0.9);
    handNode.position.y = -0.26;
    elbowNode.add(handNode);
    elbowNode.rotation.x = -0.25;
    const armOut = {};
    armOut.shoulder = shoulderNode; armOut.elbow = elbowNode;
    return armOut;
  };
  let armLft;
  let armRgt;
  armLft = buildArm(-1); armRgt = buildArm(1);

  const buildLeg = (signVal) => {
    const hipNode = new THREE.Group();
    hipNode.position.set(signVal * 0.085, hipYVal - 0.02, 0);
    figNode.add(hipNode);
    let thighMatIn;
    if ('skirt+leggings' === outfitRec.pants) thighMatIn = pantsMatIn; else thighMatIn = pantsMatIn;
    const thighNode = makeLimbCapsule(0.068, 0.26, thighMatIn);
    thighNode.position.y = legLenVal * -0.25;
    hipNode.add(thighNode);
    const kneeNode = new THREE.Group();
    kneeNode.position.y = legLenVal * -0.5;
    hipNode.add(kneeNode);
    let shinMatIn;
    if ('skirt+leggings' === outfitRec.pants) shinMatIn = plainMaterial(outfitRec.pantsColor, 0.9); else shinMatIn = pantsMatIn;
    const shinNode = makeLimbCapsule(0.052, 0.26, shinMatIn);
    shinNode.position.y = legLenVal * -0.24;
    kneeNode.add(shinNode);
    const shoeNode = new THREE.Group();
    shoeNode.position.y = 0.03 - legLenVal * 0.5;
    kneeNode.add(shoeNode);
    const shoeMesh = makeLimbCapsule(0.05, 0.1, shoeMatIn);
    shoeMesh.rotation.x = Math.PI / 2;
    shoeMesh.scale.set(0.85, 1, 0.6);
    shoeMesh.position.set(0, -0.02, 0.045);
    shoeNode.add(shoeMesh);
    const soleNode = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.24), plainMaterial(0xf5f5f5, 0.7));
    soleNode.position.set(0, -0.055, 0.04);
    shoeNode.add(soleNode);
    const legOut = {};
    legOut.hip = hipNode; legOut.knee = kneeNode;
    return legOut;
  };
  let legLft;
  let legRgt;
  legLft = buildLeg(-1); legRgt = buildLeg(1);

  if ('glasses' === specIn.accessory) {
    const frameMatIn = plainMaterial(0x14161a, 0.3);
    for (const signVal of signArr) {
      const lensMatCfg = {};
      lensMatCfg.color = 0x10151c; lensMatCfg.roughness = 0.1; lensMatCfg.metalness = 0.6;
      const lensNode = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.04),
        new THREE.MeshStandardMaterial(lensMatCfg));
      lensNode.position.set(signVal * 0.04, faceYVal + 0.012, headRVal + 0.012);
      headNode.add(lensNode);
      const barNode = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.004), frameMatIn);
      barNode.position.copy(lensNode.position);
      barNode.position.y += 0.023;
      headNode.add(barNode);
    }
  }
  if ('chain' === specIn.accessory) {
    const chainMatCfg = {};
    chainMatCfg.color = 0xd8b13c; chainMatCfg.metalness = 0.9; chainMatCfg.roughness = 0.3;
    const chainNode = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20),
      new THREE.MeshStandardMaterial(chainMatCfg));
    chainNode.position.set(0, torsoLenVal - 0.02, 0.1);
    chainNode.rotation.x = 0.5;
    torsoNode.add(chainNode);
  }
  if ('phone' === specIn.accessory) {
    const phoneNode = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), plainMaterial(0x14161c, 0.3));
    phoneNode.position.set(0, -0.27, 0.03);
    armRgt.elbow.add(phoneNode);
  }
  if ('cap+badge' === specIn.accessory) {
    const badgeMatCfg = {};
    badgeMatCfg.color = 0xc8a028; badgeMatCfg.metalness = 0.9; badgeMatCfg.roughness = 0.3;
    const badgeNode = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12),
      new THREE.MeshStandardMaterial(badgeMatCfg));
    badgeNode.rotation.x = Math.PI / 2;
    badgeNode.position.set(-0.07, torsoLenVal * 0.72, chestHalfVal * 0.8);
    torsoNode.add(badgeNode);
  }
  figNode.add(buildShadowDisc(0.42));
  figNode.userData = {};
  figNode.userData.legL = legLft.hip; figNode.userData.legR = legRgt.hip;
  figNode.userData.kneeL = legLft.knee; figNode.userData.kneeR = legRgt.knee;
  figNode.userData.armL = armLft.shoulder; figNode.userData.armR = armRgt.shoulder;
  figNode.userData.foreL = armLft.elbow; figNode.userData.foreR = armRgt.elbow;
  figNode.userData.headG = headNode; figNode.userData.torsoG = torsoNode; figNode.userData.H = fullHVal;
  for (const castId of Object.keys(CAST_ASSET_TABLE)) {
    if (specIn === CAST[castId]) applyCastFigureOverride(figNode, castId);
  }
  return figNode;
};

const animateLoadedHolder = (holderIn, phaseIn, amtIn, yawTrimIn) => {
  const loadedMoving = amtIn > 0.05;
  holderIn.position.y = loadedMoving ? Math.abs(Math.sin(phaseIn)) * 0.045 : Math.sin(phaseIn * 0.35) * 0.008;
  holderIn.rotation.z = loadedMoving ? Math.sin(phaseIn) * 0.035 : 0;
  holderIn.rotation.x = loadedMoving ? Math.min(1, amtIn) * 0.05 : 0;
  holderIn.rotation.y = yawTrimIn;
};

export const animateFigure = (figIn, phaseIn, amtIn) => {
  const rigData = figIn.userData;
  if (!rigData) return;
  if (rigData.figIsGlb && rigData.glbInner) {
    animateLoadedHolder(rigData.glbInner, phaseIn, amtIn, CAST_YAW_TRIM);
    return;
  }
  if (!rigData.legL) return;
  const swingB = Math.sin(phaseIn + Math.PI);
  const swingA = Math.sin(phaseIn);
  const swingArr = [[rigData.legL, swingA], [rigData.legR, swingB]];
  swingArr.forEach(function ([jointIn, swingAmt]) {
    jointIn.rotation.x = swingAmt * 0.55 * amtIn;
  });
  rigData.kneeL.rotation.x = Math.max(0, -swingB) * 0.6 * amtIn;
  rigData.kneeR.rotation.x = Math.max(0, -swingA) * 0.6 * amtIn;
  rigData.armL.rotation.x = swingB * 0.4 * amtIn;
  rigData.armR.rotation.x = swingA * 0.4 * amtIn;
  rigData.foreL.rotation.x = -0.25 - Math.max(0, swingA) * 0.3 * amtIn;
  rigData.foreR.rotation.x = -0.25 - Math.max(0, swingB) * 0.3 * amtIn;
  let idleLiftVal;
  if (0.05 > amtIn) idleLiftVal = Math.sin(phaseIn * 0.35) * 0.006; else idleLiftVal = 0;
  rigData.torsoG.position.y = rigData.H * 0.48 + Math.abs(Math.sin(phaseIn)) * 0.03 * amtIn + idleLiftVal;
  rigData.headG.rotation.x = Math.sin(phaseIn * 0.5) * 0.03;
};

export const poseSeated = (figIn) => {
  const rigData = figIn.userData;
  if (!rigData) return;
  rigData.seated = true;
  if (rigData.figIsGlb && rigData.glbInner) {
    rigData.glbInner.position.y = -0.55;
    return;
  }
  if (!rigData.legL) return;
  const hipBendVal = 0.12 - Math.PI / 2;
  const kneeBendVal = Math.PI / 2 - 0.15;
  for (const jointIn of [rigData.legL, rigData.legR]) jointIn.rotation.x = hipBendVal;
  for (const jointIn of [rigData.kneeL, rigData.kneeR]) jointIn.rotation.x = kneeBendVal;
  for (const jointIn of [rigData.armL, rigData.armR]) jointIn.rotation.x = -0.85;
  rigData.armL.rotation.z = 0.3;
  rigData.armR.rotation.z = -0.3;
  for (const jointIn of [rigData.foreL, rigData.foreR]) jointIn.rotation.x = -0.35;
  rigData.torsoG.position.y = rigData.H * 0.48;
};

export const createPlayer = (gs) => {
  startHeroLoad();
  const outerGrp = new THREE.Group();
  const procFig = makeFigure(CAST.ren);
  outerGrp.add(procFig);
  let spawnXVal;
  let spawnZVal;
  spawnXVal = -412.5; spawnZVal = 470;
  outerGrp.position.set(spawnXVal, groundH(spawnXVal, spawnZVal), spawnZVal);
  outerGrp.rotation.y = Math.PI;
  gs.scene.add(outerGrp);
  const heroRec = {};
  heroRec.fig = outerGrp; heroRec.procFig = procFig; heroRec.visual = procFig; heroRec.glbInner = null;
  heroRec.glbShadow = null; heroRec.figIsGlb = false;
  heroRec.elapsed = 0; heroRec.x = spawnXVal; heroRec.z = spawnZVal; heroRec.angle = Math.PI;
  heroRec.phase = 0; heroRec.speed = 0; heroRec.health = 100;
  gs.player = heroRec;
  if (!tryHeroSwap(heroRec)) heroWaiters.add(heroRec);
  return heroRec;
};

const eitherKeyDown = (keyMap, codeA, codeB) => {
  return !!(keyMap[codeA] || keyMap[codeB]);
};

const readDirection = (keyMap) => {
  let stepXVal = 0, stepZVal = 0;
  if (eitherKeyDown(keyMap, 'KeyW', 'ArrowUp')) stepZVal += 1;
  if (eitherKeyDown(keyMap, 'KeyS', 'ArrowDown')) stepZVal -= 1;
  if (eitherKeyDown(keyMap, 'KeyA', 'ArrowLeft')) stepXVal -= 1;
  if (eitherKeyDown(keyMap, 'KeyD', 'ArrowRight')) stepXVal += 1;
  const dirOut = {};
  dirOut.inputX = stepXVal; dirOut.inputZ = stepZVal;
  return dirOut;
};

const resolveColliders = (gs, heroRec) => {
  gs.colliders.forEach(function (boxHit) {
    const offX = heroRec.x - boxHit.x, offZ = heroRec.z - boxHit.z;
    const penXVal = boxHit.hw + 0.45 - Math.abs(offX);
    const penZVal = boxHit.hd + 0.45 - Math.abs(offZ);
    if (!(penXVal > 0 && penZVal > 0)) return;
    let pushX;
    let pushZ;
    if (0 <= offX) pushX = penXVal; else pushX = -penXVal;
    if (0 <= offZ) pushZ = penZVal; else pushZ = -penZVal;
    penZVal > penXVal ? (heroRec.x = heroRec.x + pushX) : (heroRec.z = heroRec.z + pushZ);
  });
};

const animateHeroFigure = (gs, heroRec, movingFlag) => {
  if (heroRec.figIsGlb && heroRec.glbInner) {
    const holderIn = heroRec.glbInner;
    const paceFrac = Math.min(1, Math.abs(heroRec.speed || 0) / 9);
    holderIn.position.y = movingFlag ? Math.abs(Math.sin(heroRec.phase)) * 0.045 : Math.sin(heroRec.elapsed * 1.6) * 0.008;
    holderIn.rotation.z = movingFlag ? Math.sin(heroRec.phase) * 0.035 : 0;
    holderIn.rotation.x = movingFlag ? paceFrac * 0.05 : 0;
    holderIn.rotation.y = HERO_YAW_TRIM;
  } else {
    let amtVal;
    if (movingFlag) amtVal = 1; else amtVal = 0.04;
    animateFigure(heroRec.procFig || heroRec.fig, heroRec.phase, amtVal);
  }
};

const moveHeroStep = (gs, heroRec, dirIn, step) => {
  const sprintFlag = gs.keys['ShiftLeft'] || gs.keys['ShiftRight'];
  let paceVal;
  if (sprintFlag) paceVal = 9; else paceVal = 6;
  const camYawVal = gs.camYaw || 0;
  const worldXVal = Math.cos(camYawVal) * dirIn.inputX + Math.sin(camYawVal) * dirIn.inputZ;
  const worldZVal = Math.cos(camYawVal) * dirIn.inputZ - Math.sin(camYawVal) * dirIn.inputX;
  const dirLenVal = Math.hypot(worldXVal, worldZVal) || 1;
  heroRec.x = heroRec.x + worldXVal / dirLenVal * paceVal * step;
  heroRec.z = heroRec.z + worldZVal / dirLenVal * paceVal * step;
  heroRec.angle = Math.atan2(worldXVal / dirLenVal, worldZVal / dirLenVal);
  heroRec.phase = heroRec.phase + step * paceVal * 1.9;
  heroRec.speed = paceVal;
  return paceVal;
};

export const updatePlayer = (gs, step) => {
  const heroRec = gs.player;
  if (!heroRec || !heroRec.fig.visible) return;
  const dirIn = readDirection(gs.keys);
  const movingFlag = !(0 === dirIn.inputX && 0 === dirIn.inputZ);
  movingFlag ? moveHeroStep(gs, heroRec, dirIn, step) : (heroRec.speed = 0);
  resolveColliders(gs, heroRec);
  heroRec.x = Math.max(-655, Math.min(655, heroRec.x));
  heroRec.z = Math.max(-655, Math.min(655, heroRec.z));
  heroRec.fig.position.set(heroRec.x, groundH(heroRec.x, heroRec.z), heroRec.z);
  heroRec.fig.rotation.y = heroRec.angle;
  heroRec.elapsed = (heroRec.elapsed || 0) + step;
  animateHeroFigure(gs, heroRec, movingFlag);
};
