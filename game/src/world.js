// City builder: ground, roads, housing, market, beach and boulevard.
// Rebuilt with new helper splits; placement and draw order are unchanged.
import * as THREE from 'three';
import { CFG, DISTRICTS, TOUGE_POINTS, VICE } from './config.js';
import { rnd, rr, ri, pick } from './random.js';
import { loadHeroAsset } from './assets.js';

let glowTexCache = null;
function getGlowTexture() {
  if (glowTexCache) return glowTexCache;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 128;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  glowTexCache = new THREE.CanvasTexture(cnv); return glowTexCache;
}

const SKY_KEY_ROWS = [
  [0, '#060a18', '#0e1830', '#16233f', '#101a2e'], [5, '#060a18', '#0e1830', '#16233f', '#101a2e'],
  [7, '#3d6fb4', '#d9a06b', '#f2d5a0', '#e8c9a0'], [10.5, '#3a7bd5', '#8ec9e8', '#bfe3ef', '#cfe4ec'],
  [16.5, '#3a6db0', '#c9b49a', '#f7d99a', '#ecd3a4'], [17.8, '#35507a', '#e8763a', '#ffc46b', '#f2c99a'],
  [19.5, '#141e38', '#6a4a5a', '#c97a4a', '#7a5a4e'], [22, '#060a18', '#0e1830', '#16233f', '#101a2e'],
  [24, '#060a18', '#0e1830', '#16233f', '#101a2e'],
];
const SKY_KEYS = SKY_KEY_ROWS.map(([hourVal, topHex, midHex, horHex, fogHex]) => ({
  h: hourVal, top: new THREE.Color(topHex), mid: new THREE.Color(midHex),
  hor: new THREE.Color(horHex), fog: new THREE.Color(fogHex) }));
const skyTopTone = new THREE.Color(), skyMidTone = new THREE.Color(), skyHorTone = new THREE.Color();
const skyFogTone = new THREE.Color(), skyWarmTone = new THREE.Color(0xffe0b8);

function unitClampFrac(fracVal) {
  if (fracVal < 0) return 0;
  if (fracVal > 1) return 1;
  return fracVal; }
function computeSkyColors(hourVal) {
  let scanNo = SKY_KEYS.length - SKY_KEYS.length; let activeNo = scanNo; ++scanNo;
  while (scanNo < SKY_KEYS.length - 1) {
    if (SKY_KEYS[scanNo].h > hourVal) break;
    activeNo = scanNo;
    ++scanNo;
  }
  const keyFrom = SKY_KEYS[activeNo], keyTo = SKY_KEYS[activeNo + 1];
  const mixAmt = unitClampFrac((hourVal + (-keyFrom.h)) / Math.max(0.001, keyTo.h + (-keyFrom.h)));
  skyTopTone.lerpColors(keyFrom.top, keyTo.top, mixAmt); skyMidTone.lerpColors(keyFrom.mid, keyTo.mid, mixAmt);
  skyHorTone.lerpColors(keyFrom.hor, keyTo.hor, mixAmt); skyFogTone.lerpColors(keyFrom.fog, keyTo.fog, mixAmt);
}

let skyCnv = null, skyCtx = null, skyTexObj = null, skyDomeObj = null;
let skyHourPrev = -10;
let glowSpriteList = [];

function paintSkyDome() {
  if (!skyCtx) return;
  const grad = skyCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#' + skyTopTone.getHexString()); grad.addColorStop(0.55, '#' + skyMidTone.getHexString());
  grad.addColorStop(1, '#' + skyHorTone.getHexString());
  skyCtx.fillStyle = grad; skyCtx.fillRect(0, 0, 16, 512);
  if (skyTexObj) skyTexObj.needsUpdate = true;
}

export function glowSprite(tintVal, sizeVal) {
  const sprObj = new THREE.Sprite(new THREE.SpriteMaterial({
    map: getGlowTexture(), color: tintVal, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 }));
  sprObj.scale.set(sizeVal, sizeVal, 1); return sprObj;
}

export function groundH(xVal, zVal) {
  const offX = xVal + 330, offZ = zVal + 470;
  const normDist = ((offX * offX) + (offZ * offZ)) / (330 * 330);
  let heightVal = 14 * Math.exp(-2.2 * normDist);
  if (xVal > -140 || zVal > -180) heightVal *= Math.max(0, Math.min(1, 1 + ((-140 + (-xVal)) / 120)));
  if (xVal > -100 || zVal > -100) heightVal = 0;
  return heightVal;
}

function makeCanvasTexture(wVal, hVal, drawFn) {
  const cnv = document.createElement('canvas');
  cnv.width = wVal; cnv.height = hVal;
  drawFn(cnv.getContext('2d'), wVal, hVal);
  const texObj = new THREE.CanvasTexture(cnv);
  texObj.colorSpace = THREE.SRGBColorSpace; return texObj;
}

function buildGroundTexture() {
  return makeCanvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = VICE.ground.base; ctx.fillRect(0, 0, 256, 256);
    let dotNo = 0;
    while (dotNo < 900) {
      ctx.fillStyle = `rgba(${190 + ri(0, 50)},${175 + ri(0, 45)},${140 + ri(0, 40)},.14)`;
      ctx.fillRect(rnd() * 256, rnd() * 256, 2, 2); ++dotNo;
    }
    let patchNo = 0;
    while (patchNo < 26) {
      ctx.fillStyle = 'rgba(255,250,235,.06)';
      ctx.fillRect(rnd() * 256, rnd() * 256, rr(18, 46), rr(12, 30));
      ++patchNo;
    }
    ctx.strokeStyle = 'rgba(120,110,90,.10)';
    ctx.strokeRect(0, 0, 256, 256);
  });
}

const buildPavingTexture = () => {
  const texObj = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = VICE.ground.paving; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = VICE.ground.pavingAlt;
    ctx.fillRect(64, 0, 64, 64); ctx.fillRect(0, 64, 64, 64);
    let dotNo = 0;
    while (!(dotNo >= 260)) {
      ctx.fillStyle = `rgba(${150 + ri(0, 60)},${145 + ri(0, 50)},${120 + ri(0, 40)},.13)`;
      ctx.fillRect(rnd() * 128, rnd() * 128, 2, 2); ++dotNo;
    }
    ctx.strokeStyle = VICE.ground.pavingGrout; ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128);
    ctx.moveTo(0, 64); ctx.lineTo(128, 64); ctx.stroke();
  });
  texObj.wrapS = texObj.wrapT = THREE.RepeatWrapping;
  return texObj;
};

const buildGrassTexture = () => {
  const texObj = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = VICE.ground.grass; ctx.fillRect(0, 0, 128, 128);
    let bladeNo = 0;
    while (bladeNo < 700) {
      ctx.fillStyle = !(rnd() < 0.5) ? VICE.ground.grassDark : VICE.ground.grassLight;
      ctx.globalAlpha = rr(0.12, 0.3); ctx.fillRect(rnd() * 128, rnd() * 128, 2, rr(2, 4)); ++bladeNo;
    }
    ctx.globalAlpha = 1;
  });
  texObj.wrapS = texObj.wrapT = THREE.RepeatWrapping;
  return texObj;
};

const buildSandTexture = () => {
  const texObj = makeCanvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = VICE.ground.sand; ctx.fillRect(0, 0, 128, 128);
    let grainNo = 0;
    while (grainNo < 500) {
      ctx.fillStyle = !(rnd() < 0.6) ? '#fff3cf' : VICE.ground.sandSpeckle;
      ctx.globalAlpha = rr(0.1, 0.28); ctx.fillRect(rnd() * 128, rnd() * 128, 2, 2); ++grainNo;
    }
    ctx.globalAlpha = 1;
  });
  texObj.wrapS = texObj.wrapT = THREE.RepeatWrapping;
  return texObj;
};

const makeGrassMat = (repX, repY) => {
  const texObj = buildGrassTexture();
  texObj.repeat.set(repX, repY); return new THREE.MeshStandardMaterial({ map: texObj, roughness: 1 }); };
const makePavingMat = (repX, repY, tintVal) => {
  const texObj = buildPavingTexture();
  texObj.repeat.set(repX, repY);
  return new THREE.MeshStandardMaterial({ map: texObj, color: tintVal || 0xffffff, roughness: 1 }); };
const WINDOW_LIT_TONES = ['#ffd9a0', '#ffc98a', '#fff3d0', '#ffe9b8', '#bfe0ff', '#9fd4ff'];
const buildBuildingTexture = (baseTone, litChance) => makeCanvasTexture(128, 256, (ctx, wVal, hVal) => {
  ctx.fillStyle = baseTone; ctx.fillRect(0, 0, wVal, hVal);
  let rowY = 8;
  while (rowY < hVal - 8) {
    let colX = 6;
    while (colX < wVal - 6) {
      const litFlag = rnd() < litChance;
      ctx.fillStyle = litFlag ? WINDOW_LIT_TONES[Math.floor(rnd() * (rnd() < 0.72 ? 4 : 6))] : '#2c3844';
      ctx.fillRect(colX, rowY, 9, 8);
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(colX, rowY, 9, 2); colX += 14; }
    rowY += 14; }
});
const buildSignTexture = (labelTxt, bgTone, fgTone) => makeCanvasTexture(256, 64, (ctx, wVal, hVal) => {
  ctx.fillStyle = bgTone; ctx.fillRect(0, 0, wVal, hVal);
  ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = fgTone; ctx.shadowBlur = 12;
  ctx.fillStyle = fgTone; ctx.fillText(labelTxt, wVal / 2, hVal / 2);
});

export function makePalm(heightVal) {
  const rootGrp = new THREE.Group();
  const trunkCurveObj = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15, 0.55 * heightVal, 0),
    new THREE.Vector3(0.55, heightVal, 0));
  rootGrp.add(new THREE.Mesh(
    new THREE.TubeGeometry(trunkCurveObj, 6, 0.14, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.95 })));
  const crownPt = trunkCurveObj.getPoint(1);
  const frondMatObj = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.9,
  });
  for (let frondNo = 0; frondNo < 8; ++frondNo) {
    const frondLen = rr(2.0, 2.4);
    const frondGeoObj = new THREE.PlaneGeometry(0.5, frondLen, 1, 6);
    const posAttr = frondGeoObj.attributes.position;
    const rgbFlat = [];
    const toneFrom = new THREE.Color(0x2e7d32);
    const toneTo = new THREE.Color(0x66bb4a);
    const toneWork = new THREE.Color();
    for (let vertNo = 0; vertNo < posAttr.count; ++vertNo) {
      const vertY = posAttr.getY(vertNo);
      const fracVal = (vertY + (frondLen / 2)) / frondLen;
      posAttr.setZ(vertNo, -(0.9 * Math.pow(fracVal, 2)));
      posAttr.setX(vertNo, posAttr.getX(vertNo) * (1 + (-(0.7 * fracVal))));
      toneWork.copy(toneFrom).lerp(toneTo, fracVal);
      rgbFlat.push(toneWork.r, toneWork.g, toneWork.b);
    }
    frondGeoObj.setAttribute('color', new THREE.Float32BufferAttribute(rgbFlat, 3));
    frondGeoObj.computeVertexNormals();
    const frondMesh = new THREE.Mesh(frondGeoObj, frondMatObj);
    frondMesh.position.copy(crownPt); frondMesh.rotation.order = 'YXZ';
    frondMesh.rotation.y = rr(-0.2, 0.2) + ((frondNo / 8) * 2 * Math.PI);
    frondMesh.rotation.x = rr(0.35, 0.6) + (-Math.PI / 2);
    frondMesh.translateY(-0.1 + (frondLen / 2)); rootGrp.add(frondMesh);
  }
  rootGrp.traverse((nodeObj) => { if (nodeObj.isMesh) nodeObj.castShadow = true; });
  return rootGrp;
}

export function makeShadeTree(heightVal, canopyTone) {
  const grpTree = new THREE.Group();
  const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.55 * heightVal, 7),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }));
  trunkMesh.position.y = 0.275 * heightVal; grpTree.add(trunkMesh);
  const crownMat = new THREE.MeshStandardMaterial({ color: canopyTone || 0x3d8b4f, roughness: 1, flatShading: true });
  let puffNo = 0;
  while (!(puffNo >= 3)) {
    const puffMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.28, 0.4) * heightVal, 1), crownMat);
    puffMesh.position.set(rr(-0.5, 0.5), rr(0, 0.3 * heightVal) + (0.55 * heightVal), rr(-0.5, 0.5));
    grpTree.add(puffMesh); ++puffNo;
  }
  return grpTree;
}

const MARKET = { x: -82.5, z: -255, name: 'RONIN MART' };
const matCacheBag = new Map();
function sharedStdMat(toneVal, roughVal, metalVal) {
  const metalAmt = metalVal || 0; const roughAmt = roughVal || 0.95;
  const keyTxt = toneVal + '|' + roughAmt + '|' + metalAmt;
  if (!matCacheBag.has(keyTxt)) matCacheBag.set(keyTxt, new THREE.MeshStandardMaterial({ color: toneVal, roughness: roughVal || 0.95, metalness: metalAmt }));
  return matCacheBag.get(keyTxt);
}
const tougeDistance = (xVal, zVal) => {
  // Shortest distance from a point to the touge polyline.
  let bestDist = 1e9;
  TOUGE_POINTS.slice(0, -1).forEach((ptA, segNo) => {
    const ptB = TOUGE_POINTS[segNo + 1];
    const segDx = ptB[0] + (-ptA[0]), segDz = ptB[1] + (-ptA[1]);
    const lenSq = ((segDx * segDx) + (segDz * segDz)) || 1;
    let paramT = (((xVal + (-ptA[0])) * segDx) + ((zVal + (-ptA[1])) * segDz)) / lenSq;
    paramT = Math.max(0, Math.min(1, paramT));
    const candDist = Math.hypot(xVal + (-(ptA[0] + (segDx * paramT))), zVal + (-(ptA[1] + (segDz * paramT))));
    if (candDist < bestDist) bestDist = candDist; });
  return bestDist;
};
function makePrismGeo(wVal, hVal, dVal) {
  const outline = new THREE.Shape();
  outline.moveTo(-wVal / 2, 0); outline.lineTo(wVal / 2, 0); outline.lineTo(0, hVal); outline.closePath();
  const geoObj = new THREE.ExtrudeGeometry(outline, { depth: dVal, bevelEnabled: false });
  geoObj.translate(0, 0, -dVal / 2); return geoObj;
}
const HOUSE_WALL_COLOURS = ['#f2e3c8', '#eec9b8', '#dfe8d8', '#f5d9e0', '#dcebf5', '#f7ecc9', '#e6d7f0', '#ffe8cc'];
const HOUSE_ROOF_COLOURS = [0xb5523c, 0x8a4a3a, 0x5d6d7e, 0xa03d2d, 0x6b4a35, 0x44586a, 0xc96f4a];
const HOUSE_YARD_GREENS = [0x5d9a52, 0x67a35a, 0x548c4c, 0x71ab60];
const houseWinMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ea, roughness: 0.25, metalness: 0.4, emissive: 0xffc873, emissiveIntensity: 0.35 });
let lastWallColour = null;

function constructHouse(G, scene, hx, hz, faceVal) {
  const rootGrp = new THREE.Group();
  rootGrp.position.set(hx, groundH(hx, hz), hz);
  rootGrp.rotation.y = faceVal > 0 ? 0 : Math.PI;
  const tallFlag = rnd() < 0.45;
  const widVal = rr(9, 12), depVal = rr(8, 10);
  const wallH = tallFlag ? rr(5.2, 6) : rr(2.9, 3.4), roofH = rr(1.8, 2.6);

  const lotMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 25), makePavingMat(6, 5));
  void HOUSE_YARD_GREENS;
  lotMesh.rotation.x = -Math.PI / 2;
  lotMesh.position.y = 0.03;
  rootGrp.add(lotMesh);
  const driveMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8.5), sharedStdMat(0x9a9a96, 1));
  driveMesh.rotation.x = -Math.PI / 2;
  driveMesh.position.set(-0.28 * widVal, 0.05, 4.2 + (depVal / 2));
  rootGrp.add(driveMesh);
  const hedgeMatObj = sharedStdMat(0x2e6b34, 1);
  const backHedge = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 0.4), hedgeMatObj);
  backHedge.position.set(0, 0.28, -12.3);
  rootGrp.add(backHedge);
  for (const signVal of [-1, 1]) {
    const sideHedge = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 25), hedgeMatObj);
    sideHedge.position.set(14.8 * signVal, 0.28, 0); rootGrp.add(sideHedge);
  }
  let wallTone = pick(HOUSE_WALL_COLOURS);
  if (wallTone === lastWallColour) wallTone = HOUSE_WALL_COLOURS[(HOUSE_WALL_COLOURS.indexOf(wallTone) + 1) % HOUSE_WALL_COLOURS.length];
  lastWallColour = wallTone;
  const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal, wallH, depVal),
    sharedStdMat(new THREE.Color(wallTone).getHex(), 0.95));
  wallMesh.position.y = wallH / 2; rootGrp.add(wallMesh);
  const roofMesh = new THREE.Mesh(makePrismGeo(1.2 + widVal, roofH, 1 + depVal),
    sharedStdMat(pick(HOUSE_ROOF_COLOURS), 0.9));
  roofMesh.position.y = wallH; rootGrp.add(roofMesh);
  const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), sharedStdMat(0x4a3220, 0.9));
  doorMesh.position.set(-0.28 * widVal, 1.1, 0.06 + (depVal / 2)); rootGrp.add(doorMesh);
  const winRows = tallFlag ? [1.9, 4.4] : [1.9];
  for (const rowY of winRows) for (const colX of [0, 0.3 * widVal]) {
    const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), houseWinMat);
    winMesh.position.set(colX, rowY, 0.06 + (depVal / 2)); rootGrp.add(winMesh);
  }
  if (rnd() < 0.4) {
    const chimneyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), sharedStdMat(0x8a7a6a, 1));
    chimneyMesh.position.set(0.3 * widVal, (0.55 * roofH) + wallH, 0); rootGrp.add(chimneyMesh);
  }
  if (rnd() < 0.35) {
    const yardTree = makeShadeTree(rr(2.6, 3.4), 0x3d8b4f);
    yardTree.position.set(11, 0, -8); rootGrp.add(yardTree);
  }
  rootGrp.traverse((nodeObj) => { if (nodeObj.isMesh) nodeObj.castShadow = true; });
  lotMesh.castShadow = false; lotMesh.receiveShadow = true;
  driveMesh.castShadow = false; driveMesh.receiveShadow = true;
  scene.add(rootGrp); G.addCollider(hx, hz, widVal / 2, depVal / 2, roofH + wallH);
}
function constructResidentialBlock(G, scene, cx, cz) {
  for (const rowBag of [{ dz: -31, face: -1 }, { dz: 31, face: 1 }]) {
    for (const localX of [-57, -19, 19, 57]) {
      const houseX = rr(-3, 3) + (cx + localX), houseZ = rr(-3, 3) + (cz + rowBag.dz);
      if (tougeDistance(houseX, houseZ) < 16) continue;
      if (G.roadX.some((roadVal) => Math.abs(houseX + (-roadVal)) < 26)
        || G.roadZ.some((roadVal) => Math.abs(houseZ + (-roadVal)) < 26)) continue;
      constructHouse(G, scene, houseX, houseZ, rowBag.face);
    }
  }
}
function constructParkedCar(paintVal) {
  // Simple kerbside car: box body, dark cabin, four cylinder wheels.
  const grpCar = new THREE.Group();
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.55, 4.4),
    new THREE.MeshStandardMaterial({ color: paintVal, roughness: 0.45, metalness: 0.35 }));
  bodyMesh.position.y = 0.55; grpCar.add(bodyMesh);
  const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), sharedStdMat(0x1c2733, 0.2, 0.6));
  cabinMesh.position.set(0, 1.05, -0.15); grpCar.add(cabinMesh);
  const wheelGeoObj = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10), wheelMatObj = sharedStdMat(0x17181a, 0.9);
  for (const signX of [-1, 1]) for (const signZ of [-1, 1]) {
    const wheelMesh = new THREE.Mesh(wheelGeoObj, wheelMatObj);
    wheelMesh.rotation.z = Math.PI / 2; wheelMesh.position.set(0.85 * signX, 0.33, 1.35 * signZ); grpCar.add(wheelMesh);
  }
  return grpCar;
}

function constructMarket(G, scene) {
  // Supermarket block: shell, roof plant, fascia sign, glazing, forecourt.
  const baseX = MARKET.x, baseZ = MARKET.z, grpMart = new THREE.Group();
  grpMart.position.set(baseX, groundH(baseX, baseZ), baseZ); scene.add(grpMart);
  const shellMesh = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), sharedStdMat(0xdfe3e6, 0.9));
  shellMesh.position.y = 4.5; grpMart.add(shellMesh);
  const capMesh = new THREE.Mesh(new THREE.BoxGeometry(48, 0.5, 24), sharedStdMat(0x3c4248, 0.9));
  capMesh.position.y = 9.25; grpMart.add(capMesh);
  const acSpots = [[-14, -6], [12, 5]];
  for (const [unitX, unitZ] of acSpots) {
    const unitMesh = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.6), sharedStdMat(0x707880, 0.8, 0.3));
    unitMesh.position.set(unitX, 10.05, unitZ); grpMart.add(unitMesh);
  }
  const fasciaMesh = new THREE.Mesh(new THREE.BoxGeometry(34, 3.4, 0.4), sharedStdMat(0x12233f, 0.8));
  fasciaMesh.position.set(0, 7.4, 11.1); grpMart.add(fasciaMesh);
  const fasciaTex = makeCanvasTexture(1024, 160, (pen, wdt, hgt) => {
    pen.fillStyle = '#12233f'; pen.fillRect(0, 0, wdt, hgt);
    pen.fillStyle = '#d8232a'; pen.fillRect(0, hgt + (-18), wdt, 18);
    pen.fillStyle = '#d8232a'; pen.beginPath(); pen.arc(72, 72, 44, 0, 2 * Math.PI); pen.fill();
    pen.fillStyle = '#ffffff'; pen.font = 'bold 44px sans-serif';
    pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText('R', 72, 76);
    pen.font = 'bold 96px sans-serif'; pen.textAlign = 'left'; pen.fillText('RONIN MART', 140, 76);
  });
  const fasciaSign = new THREE.Mesh(new THREE.PlaneGeometry(32, 3.2), new THREE.MeshBasicMaterial({ map: fasciaTex }));
  fasciaSign.position.set(0, 7.4, 11.32); grpMart.add(fasciaSign);
  const fasciaGlow = glowSprite(0x9fd4ff, 17);
  fasciaGlow.position.set(0, 7.4, 12.4); fasciaGlow.material.opacity = 0;
  grpMart.add(fasciaGlow); glowSpriteList.push(fasciaGlow);

  const glazingTex = makeCanvasTexture(512, 64, (pen, wdt, hgt) => {
    const fade = pen.createLinearGradient(0, 0, 0, hgt);
    fade.addColorStop(0, '#8fc3d4'); fade.addColorStop(1, '#3d6d80');
    pen.fillStyle = fade; pen.fillRect(0, 0, wdt, hgt);
    pen.fillStyle = 'rgba(20,30,38,.85)'; pen.fillRect((wdt / 2) + (-30), 6, 60, hgt + (-6));
    pen.strokeStyle = 'rgba(240,248,250,.9)'; pen.lineWidth = 3;
    let mullionX = 0;
    while (!(mullionX > wdt)) { pen.beginPath(); pen.moveTo(mullionX, 0); pen.lineTo(mullionX, hgt); pen.stroke(); mullionX += 42; }
    pen.strokeStyle = 'rgba(240,248,250,.95)'; pen.strokeRect((wdt / 2) + (-30), 6, 60, hgt + (-6));
  });
  const glazingMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.1),
    new THREE.MeshStandardMaterial({ map: glazingTex, roughness: 0.2, metalness: 0.5 }));
  glazingMesh.position.set(0, 1.75, 11.06); grpMart.add(glazingMesh);
  const entryCanopy = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 3), sharedStdMat(0x2c3138, 0.8));
  entryCanopy.position.set(0, 3.6, 12.4); grpMart.add(entryCanopy);

  const apronTex = makeCanvasTexture(1024, 512, (pen, wdt, hgt) => {
    pen.fillStyle = '#3a3d40'; pen.fillRect(0, 0, wdt, hgt);
    let fleckNo = 0;
    while (fleckNo < 2600) {
      const shadeValue = 46 + Math.floor(rnd() * 26);
      pen.fillStyle = `rgba(${shadeValue},${shadeValue},${shadeValue + 3},.16)`;
      pen.fillRect(rnd() * wdt, rnd() * hgt, 2, 2); ++fleckNo;
    }
    pen.strokeStyle = 'rgba(245,245,240,.9)'; pen.lineWidth = 5;
    let bayLineX = 40;
    while (!(bayLineX > wdt + (-40))) {
      pen.beginPath(); pen.moveTo(bayLineX, 10); pen.lineTo(bayLineX, 128); pen.stroke();
      pen.beginPath(); pen.moveTo(bayLineX, hgt + (-128)); pen.lineTo(bayLineX, hgt + (-10)); pen.stroke();
      bayLineX += 74;
    }
    pen.beginPath(); pen.moveTo(40, 128); pen.lineTo(wdt + (-40), 128); pen.stroke();
    pen.beginPath(); pen.moveTo(40, hgt + (-128)); pen.lineTo(wdt + (-40), hgt + (-128)); pen.stroke();
  });
  const apronMesh = new THREE.Mesh(new THREE.PlaneGeometry(64, 32),
    new THREE.MeshStandardMaterial({ map: apronTex, roughness: 1 }));
  apronMesh.rotation.x = -Math.PI / 2; apronMesh.position.set(0, 0.04, 27); grpMart.add(apronMesh);
  const driveLane = new THREE.Mesh(new THREE.PlaneGeometry(9, 42), sharedStdMat(0x3a3d40, 1));
  driveLane.rotation.x = -Math.PI / 2; driveLane.position.set(0, 0.04, 64); grpMart.add(driveLane);

  const bayPaints = [0xc0c4c9, 0x3f8cff, 0xd95555, 0x44484e, 0xf2b21b, 0x5a7d4f];
  const bayList = [[-22, 19.5, Math.PI], [-14.5, 19.5, Math.PI], [6, 19.5, Math.PI], [18, 35, 0], [25.5, 19.5, Math.PI]];
  bayList.forEach(([bayX, bayZ, bayRy], bayNo) => {
    const carObj = constructParkedCar(bayPaints[bayNo % bayPaints.length]);
    carObj.position.set(bayX, 0, bayZ); carObj.rotation.y = bayRy; grpMart.add(carObj);
  });
  const steelMat = sharedStdMat(0xb0b6bc, 0.4, 0.7);
  for (const [corralX, corralZ] of [[-18, 31], [14, 16.5]]) {
    for (const flankSign of [-1, 1]) {
      const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.6), steelMat);
      barMesh.position.set((flankSign * 0.9) + corralX, 0.75, corralZ); grpMart.add(barMesh);
      for (const tipSign of [-1, 1]) {
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), steelMat);
        legMesh.position.set((flankSign * 0.9) + corralX, 0.38, (tipSign * 1.8) + corralZ); grpMart.add(legMesh);
      }
    }
    const cartMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), steelMat);
    cartMesh.position.set(corralX, 0.45, corralZ); grpMart.add(cartMesh);
  }
  const crateTones = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b];
  for (const shelfX of [-8.5, 8.5]) {
    const shelfMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), sharedStdMat(0x6b4a2f, 0.95));
    shelfMesh.position.set(shelfX, 0.45, 13.2); grpMart.add(shelfMesh);
    let boxNo = 0;
    while (boxNo < 3) {
      const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9),
        sharedStdMat(crateTones[(boxNo + (shelfX > 0 ? 1 : 0)) % 4], 0.9));
      boxMesh.position.set((shelfX + (-1)) + boxNo, 1.18, 13.2); grpMart.add(boxMesh); ++boxNo;
    }
  }
  const poleMesh2 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 8), steelMat);
  poleMesh2.position.set(24, 3.5, 52); grpMart.add(poleMesh2);
  const poleSign = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.3, 0.35), new THREE.MeshBasicMaterial({ map: fasciaTex }));
  poleSign.position.set(24, 6.8, 52); grpMart.add(poleSign);
  G.addCollider(baseX, baseZ, 23, 11, 9);
}

function constructBeachStrip(G, scene) {
  // Boardwalk, palms, umbrellas and lifeguard towers along the sand.
  const spotBlocked = (px, pz, padAmt) => G.colliders.some(
    (cObj) => Math.abs(px + (-cObj.x)) < cObj.hw + padAmt && Math.abs(pz + (-cObj.z)) < cObj.hd + padAmt);
  const deckTex = makeCanvasTexture(256, 64, (pen, wdt, hgt) => {
    pen.fillStyle = '#a97e56'; pen.fillRect(0, 0, wdt, hgt);
    pen.strokeStyle = 'rgba(70,45,25,.55)'; pen.lineWidth = 3;
    let boardX = 0;
    while (!(boardX > wdt)) { pen.beginPath(); pen.moveTo(boardX, 0); pen.lineTo(boardX, hgt); pen.stroke(); boardX += 32; }
    pen.strokeStyle = 'rgba(70,45,25,.35)'; pen.beginPath();
    pen.moveTo(0, 2); pen.lineTo(wdt, 2); pen.moveTo(0, hgt + (-2)); pen.lineTo(wdt, hgt + (-2)); pen.stroke();
  });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping; deckTex.repeat.set(30, 1);
  const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(1120, 0.1, 6),
    new THREE.MeshStandardMaterial({ map: deckTex, roughness: 1 }));
  deckMesh.position.set(100, 0.07, 556); deckMesh.receiveShadow = true; scene.add(deckMesh);
  let shorePalmX = -440;
  while (!(shorePalmX > 640)) {
    const candX = rr(-3, 3) + shorePalmX, candZ = rr(-1, 1) + 549;
    if (!spotBlocked(candX, candZ, 1.5)) {
      const palmObj = makePalm(rr(4.5, 6.5));
      palmObj.position.set(candX, 0, candZ); palmObj.rotation.y = rr(0, 6.28); scene.add(palmObj);
    }
    shorePalmX += 55;
  }
  const shadeTones = [0xff5da2, 0xffb35c, 0x39d5ff, 0xffe14d, 0x7dffb0, 0xff5c39];
  let shadeNo = 0;
  while (shadeNo < 14) {
    ++shadeNo;
    let spotX = 0, spotZ = 0, okFlag = false, attemptNo = 0;
    while (attemptNo < 6 && !okFlag) {
      spotX = rr(-420, 620); spotZ = rr(578, 636); okFlag = !spotBlocked(spotX, spotZ, 2); ++attemptNo;
    }
    if (!okFlag) continue;
    const shadeGrp = new THREE.Group();
    shadeGrp.position.set(spotX, 0, spotZ); shadeGrp.rotation.y = rr(0, 6.28);
    const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), sharedStdMat(0xd8d8d2, 0.7));
    mastMesh.position.y = 1.15; mastMesh.rotation.z = 0.12; shadeGrp.add(mastMesh);
    const topMesh = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10), sharedStdMat(pick(shadeTones), 0.85));
    topMesh.position.set(0.14, 2.35, 0); topMesh.rotation.z = 0.12; shadeGrp.add(topMesh);
    let loungerNo = 0;
    while (loungerNo < 2) {
      ++loungerNo;
      if (rnd() < 0.3) continue;
      const loungerGrp = new THREE.Group();
      loungerGrp.position.set(rr(-1.6, 1.6), 0, rr(0.8, 1.8)); loungerGrp.rotation.y = rr(-0.5, 0.5);
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.5), sharedStdMat(0xf2efe4, 0.9));
      baseMesh.position.y = 0.28; loungerGrp.add(baseMesh);
      const restMesh = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.8), sharedStdMat(pick(shadeTones), 0.9));
      restMesh.position.set(0, 0.5, -0.75); restMesh.rotation.x = -0.7; loungerGrp.add(restMesh);
      shadeGrp.add(loungerGrp);
    }
    scene.add(shadeGrp);
  }
  for (const anchorX of [-300, 100, 500]) {
    let postX = anchorX;
    while (spotBlocked(postX, 598, 2) && postX < anchorX + 60) postX += 18;
    if (spotBlocked(postX, 598, 2)) continue;
    const postGrp = new THREE.Group(); postGrp.position.set(postX, 0, 598);
    const paleMat = sharedStdMat(0xf2efe4, 0.85), scarletMat = sharedStdMat(0xd8232a, 0.85);
    for (const flankX of [-1, 1]) for (const flankZ of [-1, 1]) {
      const strutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), paleMat);
      strutMesh.position.set(flankX * 0.7, 1.1, flankZ * 0.5); postGrp.add(strutMesh);
    }
    const deckMesh2 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), paleMat);
    deckMesh2.position.y = 2.25; postGrp.add(deckMesh2);
    const screenMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.1), paleMat);
    screenMesh.position.set(0, 2.85, -0.6); postGrp.add(screenMesh);
    const capMesh2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.5), scarletMat);
    capMesh2.position.y = 3.5; postGrp.add(capMesh2);
    const slopeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.6), paleMat);
    slopeMesh.position.set(0, 1.1, -1.7); slopeMesh.rotation.x = 0.72; postGrp.add(slopeMesh);
    scene.add(postGrp); G.addCollider(postX, 598, 1, 0.8, 3.5);
  }
}

// Shared collision probes and the shadow-flagging helper.
const densityPointHit = (G, px, pz, padAmt) => G.colliders.some(
  (cObj) => Math.abs(px + (-cObj.x)) < cObj.hw + padAmt && Math.abs(pz + (-cObj.z)) < cObj.hd + padAmt);
const densityFootHit = (G, px, pz, halfW, halfD, padAmt) => G.colliders.some(
  (cObj) => Math.abs(px + (-cObj.x)) < ((cObj.hw + halfW) + padAmt) && Math.abs(pz + (-cObj.z)) < ((cObj.hd + halfD) + padAmt));
const applyCastShadow = (rootObj) => {
  rootObj.traverse((nodeObj) => { if (nodeObj.isMesh) nodeObj.castShadow = true; });
  return rootObj;
};

function constructBoulevardFrontage(G, scene) {
  // Pastel shopfront row on both sides of the boulevard.
  const tallyPerSide = { north: 0, south: 0 };
  const signChoices = [
    ['HOTEL CORAL', '#ffb35c'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'],
    ['CLUB NEON', '#e879ff'], ['RAMEN', '#ff5c39'], ['PAWN', '#ffe14d'],
  ];
  for (const sideSpec of [{ key: 'north', facadeZ: 470, faceDir: 1 }, { key: 'south', facadeZ: 518, faceDir: -1 }]) {
    let prevTone = null, prevPrevTone = null, walkX = -560;
    while (walkX < 640) {
      let lotW = rr(18, 30);
      if (walkX + lotW > 640) lotW = 640 + (-walkX);
      if (lotW < 10) break;
      const lotD = rr(12, 18), lotH = rr(10, 26);
      const midX = (lotW / 2) + walkX, midZ = sideSpec.facadeZ + (-(sideSpec.faceDir * (lotD / 2)));
      const roadHit = G.roadX.find((roadCoord) => midX + (-(lotW / 2)) < roadCoord + 14 && midX + (lotW / 2) > roadCoord + (-14));
      if (roadHit !== undefined) { walkX = roadHit + 14 + rr(0.5, 2); continue; }
      if (densityFootHit(G, midX, midZ, lotW / 2, lotD / 2, 2)) { walkX += lotW + rr(1.5, 5); continue; }
      let wallTone = pick(VICE.coralPastels);
      if (wallTone === prevTone) wallTone = VICE.coralPastels[(VICE.coralPastels.indexOf(wallTone) + 1) % VICE.coralPastels.length];
      if (wallTone === prevPrevTone) wallTone = VICE.coralPastels[(VICE.coralPastels.indexOf(wallTone) + 1) % VICE.coralPastels.length];
      prevPrevTone = prevTone; prevTone = wallTone;
      const wallTex = buildBuildingTexture(wallTone, rr(0.25, 0.42));
      wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
      const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, emissive: 0xffc873, emissiveMap: wallTex, emissiveIntensity: 0, roughness: 0.9 });
      wallMat.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
      if (!G.buildingMats) G.buildingMats = [];
      G.buildingMats.push(wallMat);
      const groundY = groundH(midX, midZ);
      const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(lotW, lotH, lotD), wallMat);
      blockMesh.position.set(midX, (lotH / 2) + groundY, midZ);
      blockMesh.castShadow = true; blockMesh.receiveShadow = true; scene.add(blockMesh);
      const capH = rr(1.6, 3);
      const capMesh = new THREE.Mesh(new THREE.BoxGeometry(lotW * 0.62, capH, lotD * 0.62), wallMat);
      capMesh.position.set(midX, lotH + ((capH / 2) + groundY), midZ); capMesh.castShadow = true; scene.add(capMesh);
      const trimTone = pick(VICE.neonTrim);
      const trimMat = new THREE.MeshStandardMaterial({ color: trimTone, emissive: trimTone, emissiveIntensity: 0, roughness: 0.6 });
      const trimMesh = new THREE.Mesh(new THREE.BoxGeometry(lotW + 0.35, 0.3, lotD + 0.35), trimMat);
      trimMesh.position.set(midX, (lotH * 0.84) + groundY, midZ); trimMesh.castShadow = true; scene.add(trimMesh);
      if (!G.neonTrimMats) G.neonTrimMats = [];
      G.neonTrimMats.push(trimMat);
      const trimGlow = glowSprite(new THREE.Color(trimTone), 12);
      trimGlow.position.set(midX, (lotH * 0.84) + groundY, midZ); trimGlow.material.opacity = 0;
      scene.add(trimGlow); glowSpriteList.push(trimGlow);
      const frontZ = sideSpec.facadeZ;
      if (rnd() < 0.6) {
        const [signTxt, signTone] = pick(signChoices);
        const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, lotW * 0.7), 3.4),
          new THREE.MeshBasicMaterial({ map: buildSignTexture(signTxt, '#101018', signTone) }));
        signMesh.position.set(midX, 4.6 + groundY, frontZ + (sideSpec.faceDir * 0.12));
        if (sideSpec.faceDir < 0) signMesh.rotation.y = Math.PI;
        scene.add(signMesh);
        const signGlow = glowSprite(new THREE.Color(signTone), 13);
        signGlow.position.set(midX, 4.6 + groundY, frontZ + (sideSpec.faceDir * 0.05));
        signGlow.material.opacity = 0; scene.add(signGlow); glowSpriteList.push(signGlow);
      }
      const canopyTone = tallyPerSide[sideSpec.key] % 2 === 0 ? pick(['#ff5da2', '#ffb35c']) : pick(['#39d5ff', '#7dffb0']);
      const canopyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(canopyTone), roughness: 0.85 });
      const canopyMesh = new THREE.Mesh(new THREE.BoxGeometry(Math.min(15, lotW * 0.72), 0.15, 2.2), canopyMat);
      canopyMesh.position.set(midX, 3.6 + groundY, frontZ + (sideSpec.faceDir * 1.05));
      canopyMesh.rotation.x = sideSpec.faceDir * 0.3; canopyMesh.castShadow = true; scene.add(canopyMesh);
      G.addCollider(midX, midZ, lotW / 2, lotD / 2, lotH);
      ++tallyPerSide[sideSpec.key]; walkX += lotW + rr(1.5, 5);
    }
  }
  G.frontageCounts = tallyPerSide; return tallyPerSide;
}

function constructBoulevardPalms(G, scene) {
  // Palm row along both boulevard sidewalks, skipping road crossings.
  let addedPalms = 0, rowX = -560;
  while (!(rowX > 640)) {
    if (!G.roadX.some((roadCoord) => Math.abs(rowX + (-roadCoord)) < 16)) {
      for (const walkZ of [481, 509]) {
        if (densityPointHit(G, rowX, walkZ, 1.5)) continue;
        const palmObj = makePalm(rr(4.5, 6.5));
        palmObj.position.set(rowX, groundH(rowX, walkZ), walkZ); palmObj.rotation.y = rr(0, 6.28);
        scene.add(palmObj); ++addedPalms;
      }
    }
    rowX += 20;
  }
  G.boulevardPalmsAdded = addedPalms; return addedPalms;
}

function makePlanterPalmUnit() {
  const grpUnit = new THREE.Group();
  const tubMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.6), sharedStdMat(0xd8d2c4, 1));
  tubMesh.position.y = 0.275; grpUnit.add(tubMesh);
  const earthMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), sharedStdMat(0x4a3826, 1));
  earthMesh.position.y = 0.56; grpUnit.add(earthMesh);
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true });
  for (const [shrubX, shrubZ] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
    const shrubMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.22, 0.3), 1), shrubMat);
    shrubMesh.position.set(shrubX, 0.68, shrubZ); grpUnit.add(shrubMesh);
  }
  const palmObj = makePalm(rr(4.5, 6));
  palmObj.position.y = 0.55; palmObj.rotation.y = rr(0, 6.28); grpUnit.add(palmObj);
  return applyCastShadow(grpUnit);
}
function constructBoulevardPlanters(G, scene) {
  let addedPlanters = 0, tubX = -320;
  while (!(tubX > 520)) {
    const skipHere = G.roadX.some((roadCoord) => Math.abs(tubX + (-roadCoord)) < 13)
      || Math.abs(tubX + (-100)) < 10 || densityPointHit(G, tubX, 513, 2);
    if (!skipHere) {
      const unitObj = makePlanterPalmUnit();
      unitObj.position.set(tubX, groundH(tubX, 513), 513); scene.add(unitObj); ++addedPlanters;
    }
    tubX += 40;
  }
  G.boulevardPlantersAdded = addedPlanters; return addedPlanters;
}

function makeBenchUnit() {
  // Slatted bench: two iron ends, seat slats, tilted back slats.
  const grpBench = new THREE.Group();
  const ironMat = sharedStdMat(0x3a3f45, 0.6, 0.5), timberMat = sharedStdMat(0x8a6844, 0.95);
  for (const endSign of [-1, 1]) {
    const legFront = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), ironMat);
    legFront.position.set(endSign * 0.95, 0.22, 0.28); grpBench.add(legFront);
    const legBack = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), ironMat);
    legBack.position.set(endSign * 0.95, 0.42, -0.28); grpBench.add(legBack);
  }
  let seatNo = 0;
  while (seatNo < 3) {
    const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.16), timberMat);
    seatMesh.position.set(0, 0.45, (seatNo * 0.22) + (-0.2)); grpBench.add(seatMesh); ++seatNo;
  }
  let backNo = 0;
  while (backNo < 2) {
    const backMesh2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.05), timberMat);
    backMesh2.position.set(0, (backNo * 0.24) + 0.68, -0.32); backMesh2.rotation.x = -0.18; grpBench.add(backMesh2); ++backNo;
  }
  return applyCastShadow(grpBench);
}
function makePlanterUnit() {
  const grpPlanter = new THREE.Group();
  const tubMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), sharedStdMat(0x9a8a72, 1));
  tubMesh.position.y = 0.28; grpPlanter.add(tubMesh);
  const shrubMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true }));
  shrubMesh.position.y = 0.85; grpPlanter.add(shrubMesh);
  return applyCastShadow(grpPlanter);
}
function makeStallUnit() {
  // Market stall: corner posts, striped canopy, counter, produce crates.
  const grpStall = new THREE.Group(), timberMat2 = sharedStdMat(0x6b4a2f, 0.9);
  for (const postX of [-1, 1]) for (const postZ of [-1, 1]) {
    const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), timberMat2);
    postMesh.position.set(postX * 1.5, 1.25, postZ * 0.9); grpStall.add(postMesh);
  }
  const stripeTex = makeCanvasTexture(128, 128, (pen, wdt, hgt) => {
    let bandNo = 0;
    while (bandNo < 8) {
      pen.fillStyle = bandNo % 2 ? '#f7f2e6' : '#ff7a6b';
      pen.fillRect(bandNo * (wdt / 8), 0, wdt / 8, hgt); ++bandNo;
    }
  });
  stripeTex.wrapS = THREE.RepeatWrapping; stripeTex.wrapT = THREE.RepeatWrapping;
  const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 2.4),
    new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.9 }));
  roofMesh.position.y = 2.55; roofMesh.rotation.z = 0.06; grpStall.add(roofMesh);
  const counterMesh2 = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.1), sharedStdMat(0xa97e56, 0.95));
  counterMesh2.position.set(0, 0.45, 0.35); grpStall.add(counterMesh2);
  const crateTones2 = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b];
  let crateNo = 0;
  while (crateNo < 4) {
    const crateMesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), sharedStdMat(crateTones2[crateNo % 4], 0.9));
    crateMesh.position.set((crateNo * 0.72) + (-1.1), 1.1, 0.35); grpStall.add(crateMesh); ++crateNo;
  }
  return applyCastShadow(grpStall);
}
function constructGatherSpots(G, scene) {
  // Bench/planter clusters, nudged sideways until a clear plot is found.
  const spotSpecs = [
    { x: 100, z: 511, ry: Math.PI, stall: true }, { x: 300, z: 552, ry: 0, stall: true },
    { x: -60, z: -238, ry: Math.PI, stall: false }, { x: -210, z: 481, ry: 0, stall: false },
  ];
  G.gatherSpots = [];
  for (const specObj of spotSpecs) {
    let settledX = null, stepNo = 0;
    while (!(stepNo > 10) && settledX === null) {
      const offsets = stepNo === 0 ? [0] : [stepNo * 4, -stepNo * 4];
      for (const offAmt of offsets) {
        if (!densityPointHit(G, specObj.x + offAmt, specObj.z, 2.5)) { settledX = specObj.x + offAmt; break; }
      }
      ++stepNo;
    }
    if (settledX === null) continue;
    const grpSpot = new THREE.Group();
    grpSpot.position.set(settledX, groundH(settledX, specObj.z), specObj.z); grpSpot.rotation.y = specObj.ry;
    for (const seatX of [-1.9, 1.9]) { const seatObj = makeBenchUnit(); seatObj.position.set(seatX, 0, 0); grpSpot.add(seatObj); }
    for (const tubX of [-3.6, 3.6]) { const tubObj = makePlanterUnit(); tubObj.position.set(tubX, 0, 0.25); grpSpot.add(tubObj); }
    if (specObj.stall) {
      const kioskObj = makeStallUnit(); kioskObj.position.set(0, 0, -2.4); grpSpot.add(kioskObj);
      const cosAmt = Math.cos(specObj.ry), sinAmt = Math.sin(specObj.ry);
      G.addCollider(((0 * cosAmt) + (-(2.4 * sinAmt))) + settledX, ((-0 * sinAmt) + (-(2.4 * cosAmt))) + specObj.z, 1.8, 1.2, 2.6);
    }
    scene.add(grpSpot);
    G.gatherSpots.push({ x: settledX, z: specObj.z, ry: specObj.ry, stall: specObj.stall });
  }
  return G.gatherSpots;
}

function constructHoshinoRows(G, scene) {
  // Two facing rows of houses in the Hoshino district.
  let addedHouses = 0;
  for (const rowSpec of [{ z: -378, face: 1 }, { z: -284, face: -1 }]) {
    let plotX = -520;
    while (!(plotX > -180)) {
      const gapHere = Math.abs(plotX + 495) < 15 || Math.abs(plotX + 330) < 15;
      if (!gapHere && !densityFootHit(G, plotX, rowSpec.z, 6, 5, 2)) { constructHouse(G, scene, plotX, rowSpec.z, rowSpec.face); ++addedHouses; }
      plotX += 24;
    }
  }
  G.hoshinoHousesAdded = addedHouses; return addedHouses;
}

const PARK_CENTRE_CANDIDATES = [[82, 415], [-82, 415], [82, 82], [-82, 82], [247, 82]];
function makeRoundTree(heightAmt, toneAmt) {
  const grpTree = new THREE.Group();
  const trunkMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, heightAmt * 0.45, 7), sharedStdMat(0x6b4a2f, 1));
  trunkMesh.position.y = heightAmt * 0.225; grpTree.add(trunkMesh);
  const crownMat = new THREE.MeshStandardMaterial({ color: toneAmt, roughness: 1, flatShading: true });
  for (const [puffX, puffY, puffZ, puffR] of [[0, 1, 0, 1.6], [0.95, 1.22, 0.3, 1.2], [-0.9, 1.18, -0.4, 1.05]]) {
    const puffMesh = new THREE.Mesh(new THREE.SphereGeometry(puffR, 10, 8), crownMat);
    puffMesh.scale.y = 0.75;
    puffMesh.position.set(puffX, (heightAmt * 0.45) + (puffY * (heightAmt * 0.28)), puffZ); grpTree.add(puffMesh);
  }
  return applyCastShadow(grpTree);
}
function constructPark(G, scene) {
  // Central park: first candidate plot that clears the density scan wins.
  let hubX = PARK_CENTRE_CANDIDATES[0][0], hubZ = PARK_CENTRE_CANDIDATES[0][1], hubFound = false;
  const rejectedList = [];
  for (const [tryX, tryZ] of PARK_CENTRE_CANDIDATES) {
    if (!densityFootHit(G, tryX, tryZ, 38, 38, 2)) { hubX = tryX; hubZ = tryZ; hubFound = true; break; }
    rejectedList.push([tryX, tryZ]);
  }
  G.parkScanSkipped = rejectedList; G.parkFallbackUsed = !hubFound;
  const grpPark = new THREE.Group();
  grpPark.position.set(hubX, groundH(hubX, hubZ), hubZ); scene.add(grpPark);
  const plazaMesh = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), makePavingMat(19, 19, 0xd8d2c2));
  plazaMesh.rotation.x = -Math.PI / 2; plazaMesh.position.y = 0.04; plazaMesh.receiveShadow = true; grpPark.add(plazaMesh);
  const walkNS = new THREE.Mesh(new THREE.PlaneGeometry(6, 76), makePavingMat(2, 19, 0xffffff));
  walkNS.rotation.x = -Math.PI / 2; walkNS.position.y = 0.07; walkNS.receiveShadow = true; grpPark.add(walkNS);
  const walkEW = new THREE.Mesh(new THREE.PlaneGeometry(76, 6), makePavingMat(19, 2, 0xffffff));
  walkEW.rotation.x = -Math.PI / 2; walkEW.position.y = 0.07; walkEW.receiveShadow = true; grpPark.add(walkEW);
  for (const quadX of [-1, 1]) for (const quadZ of [-1, 1]) {
    const lawnMesh = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), makeGrassMat(8, 8));
    lawnMesh.rotation.x = -Math.PI / 2; lawnMesh.position.set(quadX * 19.5, 0.055, quadZ * 19.5);
    lawnMesh.receiveShadow = true; grpPark.add(lawnMesh);
  }

  const grpFountain = new THREE.Group(); grpPark.add(grpFountain);
  const stoneMat = sharedStdMat(0xe6e0d0, 0.9);
  const basinMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 24), stoneMat);
  basinMesh.position.y = 0.4; grpFountain.add(basinMesh);
  const lipMesh = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 8, 24), stoneMat);
  lipMesh.rotation.x = Math.PI / 2; lipMesh.position.y = 0.82; grpFountain.add(lipMesh);
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x3fa7d6, transparent: true, opacity: 0.9, roughness: 0.15 });
  const poolMesh = new THREE.Mesh(new THREE.CircleGeometry(3.7, 24), poolMat);
  poolMesh.rotation.x = -Math.PI / 2; poolMesh.position.y = 0.72; grpFountain.add(poolMesh);
  const columnMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.5, 12), stoneMat);
  columnMesh.position.y = 1.4; grpFountain.add(columnMesh);
  const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.9, 0.35, 16), stoneMat);
  cupMesh.position.y = 2.25; grpFountain.add(cupMesh);
  const cupPool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), poolMat);
  cupPool.rotation.x = -Math.PI / 2; cupPool.position.y = 2.44; grpFountain.add(cupPool);
  applyCastShadow(grpFountain); G.addCollider(hubX, hubZ, 4.4, 4.4, 2.4);
  const treeSpots = [];
  for (const quadX of [-1, 1]) for (const quadZ of [-1, 1])
    treeSpots.push([quadX * 12, quadZ * 12], [quadX * 27, quadZ * 10], [quadX * 10, quadZ * 27]);
  treeSpots.push([-34, -34], [34, 34]);
  const crownTones = [0x3f9e4d, 0x359146, 0x4caf50];
  treeSpots.forEach(([spotX, spotZ], spotNo) => {
    const treeObj = spotNo % 3 === 2 ? makePalm(5 + (spotNo % 2)) : makeRoundTree(4.6 + ((spotNo % 3) * 0.5), crownTones[spotNo % 3]);
    treeObj.position.set(spotX, 0, spotZ); treeObj.rotation.y = (spotNo * 1.7) % 6.28; grpPark.add(treeObj);
  });
  for (const [seatX, seatZ] of [[10, 5.5], [-10, 5.5], [10, -5.5], [-10, -5.5], [5.5, 10], [-5.5, -10]]) {
    const seatObj = makeBenchUnit();
    seatObj.position.set(seatX, 0, seatZ); seatObj.rotation.y = Math.atan2(-seatX, -seatZ); grpPark.add(seatObj);
  }
  const kioskWorldX = hubX + 32, kioskWorldZ = hubZ + 8, kioskObj = makeStallUnit();
  kioskObj.position.set(32, 0, 8); kioskObj.rotation.y = Math.PI / 2; grpPark.add(kioskObj);
  G.addCollider(kioskWorldX, kioskWorldZ, 1.8, 1.8, 2.6);

  for (const [lampX, lampZ] of [[-35, -35], [35, -35], [-35, 35], [35, 35]]) {
    const grpLamp = new THREE.Group();
    const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5, 6), sharedStdMat(0x3a3f45, 0.8, 0.5));
    mastMesh.position.y = 2.5; grpLamp.add(mastMesh);
    const globeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc98a, emissiveIntensity: 0.4, roughness: 0.5 }));
    globeMesh.position.y = 5.05; grpLamp.add(globeMesh);
    grpLamp.position.set(lampX, 0, lampZ); applyCastShadow(grpLamp); grpPark.add(grpLamp);
  }
  const bloomTones = [0xff5da2, 0xffb35c, 0xffe14d, 0xff5da2];
  [[20, 4.4, 0], [-20, 4.4, 0], [20, -4.4, 0], [-4.4, -20, Math.PI / 2]].forEach(([bedX, bedZ, bedRy], bedNo) => {
    const grpBed = new THREE.Group();
    const bedBase = new THREE.Mesh(new THREE.BoxGeometry(4, 0.35, 1.2), sharedStdMat(0x9a8a72, 1));
    bedBase.position.y = 0.18; grpBed.add(bedBase);
    const bedCap = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 1.0),
      new THREE.MeshStandardMaterial({ color: bloomTones[bedNo], roughness: 0.9, flatShading: true }));
    bedCap.position.y = 0.42; grpBed.add(bedCap);
    grpBed.position.set(bedX, 0, bedZ); grpBed.rotation.y = bedRy; applyCastShadow(grpBed); grpPark.add(grpBed);
  });
  G.parkSpot = { x: hubX, z: hubZ, stallX: kioskWorldX, stallZ: kioskWorldZ };
  G.parkCounts = { trees: treeSpots.length, benches: 6, lamps: 4, flowerBeds: 4, stalls: 1, fountains: 1 };
  return G.parkSpot;
}

let streetlightGlowList = [];

export function buildWorld(G) {
  // World assembly: sky, terrain, water, roads, then every district builder.
  const scene = G.scene;
  G.roadX = [-660, -495, -330, -165, 0, 165, 330, 495, 660]; G.roadZ = [-660, -495, -330, -165, 0, 165, 330, 495, 660];
  G.touge = TOUGE_POINTS.map((ptArr) => ({ x: ptArr[0], z: ptArr[1] }));
  streetlightGlowList = []; glowSpriteList = []; skyHourPrev = -10;
  skyCnv = document.createElement('canvas'); skyCnv.width = 16; skyCnv.height = 512;
  skyCtx = skyCnv.getContext('2d'); skyTexObj = new THREE.CanvasTexture(skyCnv);
  skyTexObj.colorSpace = THREE.SRGBColorSpace;
  computeSkyColors(G.timeOfDay || 10.5); paintSkyDome();
  skyDomeObj = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12),
    new THREE.MeshBasicMaterial({ map: skyTexObj, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyDomeObj.renderOrder = -1; scene.add(skyDomeObj);
  scene.fog = new THREE.Fog(0xcfe4ec, 220, 1500);
  const groundTexObj = buildGroundTexture();
  groundTexObj.wrapS = groundTexObj.wrapT = THREE.RepeatWrapping; groundTexObj.repeat.set(40, 40);
  if (G.maxAniso) groundTexObj.anisotropy = G.maxAniso;
  const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(1320, 1320),
    new THREE.MeshStandardMaterial({ map: groundTexObj, roughness: 1 }));
  groundMesh.rotation.x = -Math.PI / 2; groundMesh.receiveShadow = true; scene.add(groundMesh);

  const hillGeoObj = new THREE.PlaneGeometry(700, 700, 24, 24);
  {
    const posAttr = hillGeoObj.attributes.position;
    let vertNo = 0;
    while (vertNo < posAttr.count) {
      const vertX = posAttr.getX(vertNo) + (-330), vertZ = -(posAttr.getY(vertNo)) + (-330);
      posAttr.setZ(vertNo, groundH(vertX, vertZ)); ++vertNo; }
    hillGeoObj.computeVertexNormals(); }
  const hillMesh = new THREE.Mesh(hillGeoObj, makeGrassMat(28, 28));
  hillMesh.rotation.x = -Math.PI / 2; hillMesh.position.set(-330, 0.02, -330);
  hillMesh.receiveShadow = true; scene.add(hillMesh);
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({ color: 0x1d6fb8, transparent: true, opacity: 0.95, roughness: 0.3, metalness: 0.2 }));
  seaMesh.rotation.x = -Math.PI / 2; seaMesh.position.y = -0.4; scene.add(seaMesh); G.water = seaMesh;
  const sandTexObj = buildSandTexture();
  sandTexObj.repeat.set(66, 5);
  if (G.maxAniso) sandTexObj.anisotropy = G.maxAniso;
  const beachMesh = new THREE.Mesh(new THREE.PlaneGeometry(1320, 100),
    new THREE.MeshStandardMaterial({ map: sandTexObj, roughness: 1 }));
  beachMesh.rotation.x = -Math.PI / 2; beachMesh.position.set(0, 0.03, 610);
  beachMesh.receiveShadow = true; scene.add(beachMesh);

  {
    const layZonePaving = (zoneX, zoneZ, zoneMat) => {
      const flatMesh = new THREE.Mesh(new THREE.PlaneGeometry(660, 660), zoneMat);
      flatMesh.rotation.x = -Math.PI / 2; flatMesh.position.set(zoneX, 0.018, zoneZ);
      flatMesh.receiveShadow = true; scene.add(flatMesh); };
    const paveTexA = buildPavingTexture();
    paveTexA.repeat.set(66, 66);
    if (G.maxAniso) paveTexA.anisotropy = G.maxAniso;
    layZonePaving(330, 330, new THREE.MeshStandardMaterial({ map: paveTexA, roughness: 1 }));
    const paveTexB = buildPavingTexture();
    paveTexB.repeat.set(66, 66);
    if (G.maxAniso) paveTexB.anisotropy = G.maxAniso;
    layZonePaving(330, -330, new THREE.MeshStandardMaterial({ map: paveTexB, roughness: 1 }));
    const paveTexC = buildPavingTexture();
    paveTexC.repeat.set(66, 66);
    if (G.maxAniso) paveTexC.anisotropy = G.maxAniso;
    layZonePaving(-330, 330, new THREE.MeshStandardMaterial({ map: paveTexC, roughness: 1 })); }

  const asphaltTexObj = makeCanvasTexture(64, 256, (ctx, wVal, hVal) => {
    ctx.fillStyle = '#33373c'; ctx.fillRect(0, 0, wVal, hVal);
    let fleckNo = 0;
    while (fleckNo < 700) {
      const shadeValue = 40 + Math.floor(rnd() * 36);
      ctx.fillStyle = `rgba(${shadeValue},${shadeValue},${shadeValue + 4},.18)`;
      ctx.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); ++fleckNo;
    }
    let glintNo = 0;
    while (glintNo < 130) { ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); ++glintNo; }
    ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = 1;
    let crackNo = 0;
    while (crackNo < 7) {
      ctx.beginPath();
      let crackX = rnd() * wVal, crackY = rnd() * hVal;
      ctx.moveTo(crackX, crackY);
      let segNo = 0;
      while (segNo < 3) { crackX += rr(-9, 9); crackY += rr(4, 14); ctx.lineTo(crackX, crackY); ++segNo; }
      ctx.stroke(); ++crackNo;
    }
    const paintRoadLine = (uPos, lineTone, widthFrac) => {
      ctx.fillStyle = lineTone;
      const lineW = Math.max(1, wVal * widthFrac);
      ctx.fillRect((wVal * uPos) + (-lineW / 2), 0, lineW, hVal);
    };
    paintRoadLine(0.03, '#d8d8d2', 0.012); paintRoadLine(0.97, '#d8d8d2', 0.012);
    paintRoadLine(0.478, '#e8d9a0', 0.008); paintRoadLine(0.522, '#e8d9a0', 0.008);
    ctx.fillStyle = '#ffffff';
    for (const uPos of [0.25, 0.75]) {
      const lineW = Math.max(1, wVal * 0.010);
      ctx.fillRect((wVal * uPos) + (-lineW / 2), 0, lineW, hVal * 0.45); }
  });
  asphaltTexObj.wrapS = asphaltTexObj.wrapT = THREE.RepeatWrapping;
  if (G.maxAniso) asphaltTexObj.anisotropy = G.maxAniso;
  const fullAsphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTexObj, roughness: 0.95 });
  const flatAsphaltMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.95 });

  const walkTexVert = buildPavingTexture();
  walkTexVert.repeat.set(1, 110);
  if (G.maxAniso) walkTexVert.anisotropy = G.maxAniso;
  const walkMatVert = new THREE.MeshStandardMaterial({ map: walkTexVert, roughness: 1 });
  const walkTexHorz = buildPavingTexture();
  walkTexHorz.repeat.set(110, 1);
  if (G.maxAniso) walkTexHorz.anisotropy = G.maxAniso;
  const walkMatHorz = new THREE.MeshStandardMaterial({ map: walkTexHorz, roughness: 1 });
  // Road strips run the full grid in both directions, sidewalks alongside.

  for (const roadXVal of G.roadX) {
    const texCopy = asphaltTexObj.clone();
    texCopy.needsUpdate = true; texCopy.repeat.set(1, 44);
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, 1320),
      new THREE.MeshStandardMaterial({ map: texCopy, roughness: 0.95 }));
    roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.set(roadXVal, 0.05, 0);
    roadMesh.receiveShadow = true; scene.add(roadMesh);
    for (const signVal of [-1, 1]) {
      const walkMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), walkMatVert);
      walkMesh.position.set(roadXVal + (signVal * (1.5 + (CFG.roadW / 2))), 0.06, 0);
      walkMesh.receiveShadow = true; scene.add(walkMesh);
    }
  }
  for (const roadZVal of G.roadZ) {
    const texCopy = asphaltTexObj.clone();
    texCopy.needsUpdate = true; texCopy.center.set(0.5, 0.5);
    texCopy.rotation = Math.PI / 2; texCopy.repeat.set(1, 44);
    const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(1320, CFG.roadW),
      new THREE.MeshStandardMaterial({ map: texCopy, roughness: 0.95 }));
    roadMesh.rotation.x = -Math.PI / 2; roadMesh.position.set(0, 0.05, roadZVal);
    roadMesh.rotation.z = Math.PI / 2; roadMesh.receiveShadow = true; scene.add(roadMesh);
    for (const signVal of [-1, 1]) {
      const walkMesh = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), walkMatHorz);
      walkMesh.position.set(0, 0.06, roadZVal + (signVal * (1.5 + (CFG.roadW / 2))));
      walkMesh.receiveShadow = true; scene.add(walkMesh);
    }
  }
  void fullAsphaltMat; void flatAsphaltMat;

  {
    // Zebra crossings: five bars on each of four sides per junction, instanced.
    const barsPerSide = 5, sidesPerCrossing = 4;
    const barTotal = sidesPerCrossing * barsPerSide * G.roadX.length * G.roadZ.length;
    const zebraInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0xf2efe4, roughness: 0.9 }), barTotal);
    const m4 = new THREE.Matrix4();
    const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const posV = new THREE.Vector3(), sclV = new THREE.Vector3();
    const crossOff = 3.5 + (CFG.roadW / 2), crossSpan = CFG.roadW / 6;
    let barAt = 0;
    for (const crossX of G.roadX) for (const crossZ of G.roadZ) {
      let barNo = 0;
      while (barNo < barsPerSide) {
        const barShift = (barNo * crossSpan) + (-(2 * crossSpan));
        posV.set(crossX + barShift, 0.07, crossZ + (-crossOff)); sclV.set(2.4, 6, 1);
        zebraInst.setMatrixAt(barAt++, m4.compose(posV, qFlat, sclV));
        posV.set(crossX + barShift, 0.07, crossZ + crossOff);
        zebraInst.setMatrixAt(barAt++, m4.compose(posV, qFlat, sclV));
        posV.set(crossX + (-crossOff), 0.07, crossZ + barShift); sclV.set(6, 2.4, 1);
        zebraInst.setMatrixAt(barAt++, m4.compose(posV, qFlat, sclV));
        posV.set(crossX + crossOff, 0.07, crossZ + barShift);
        zebraInst.setMatrixAt(barAt++, m4.compose(posV, qFlat, sclV)); ++barNo;
      }
    }
    zebraInst.instanceMatrix.needsUpdate = true; scene.add(zebraInst);
  }
  {
    // Paint lists: centre dashes, lane dashes, edge lines, stop lines.
    const halfRoadW = CFG.roadW / 2;
    const palePaintMat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.85 });
    const amberPaintMat = new THREE.MeshStandardMaterial({ color: 0xf7d154, roughness: 0.85 });
    const midDashes = [], laneDashes = [], edgeLines = [], stopLines = [], hillDashes = [], hillEdges = [];
    const closeToCrossing = (probeVal, roadArr) => roadArr.some((roadCoord) => Math.abs(probeVal + (-roadCoord)) < halfRoadW + 9);
    for (const roadXCoord of G.roadX) {
      let dashZ = -648;
      while (!(dashZ > 648)) {
        if (!closeToCrossing(dashZ, G.roadZ)) {
          midDashes.push({ x: roadXCoord, z: dashZ + 3, sx: 0.4, sy: 6 });
          laneDashes.push({ x: roadXCoord + (-7.5), z: dashZ + 2, sx: 0.3, sy: 4.5 });
          laneDashes.push({ x: roadXCoord + 7.5, z: dashZ + 2, sx: 0.3, sy: 4.5 });
        }
        dashZ += 12;
      }
      let segNo = 0;
      while (segNo < G.roadZ.length - 1) {
        const spanFromZ = G.roadZ[segNo] + halfRoadW, spanToZ = G.roadZ[segNo + 1] + (-halfRoadW);
        edgeLines.push({ x: (roadXCoord + (-halfRoadW)) + 0.8, z: (spanFromZ + spanToZ) / 2, sx: 0.3, sy: spanToZ + (-spanFromZ) });
        edgeLines.push({ x: (roadXCoord + halfRoadW) + (-0.8), z: (spanFromZ + spanToZ) / 2, sx: 0.3, sy: spanToZ + (-spanFromZ) });
        ++segNo;
      }
    }
    for (const roadZCoord of G.roadZ) {
      let dashX = -648;
      while (!(dashX > 648)) {
        if (!closeToCrossing(dashX, G.roadX)) {
          midDashes.push({ x: dashX + 3, z: roadZCoord, sx: 6, sy: 0.4 });
          laneDashes.push({ x: dashX + 2, z: roadZCoord + (-7.5), sx: 4.5, sy: 0.3 });
          laneDashes.push({ x: dashX + 2, z: roadZCoord + 7.5, sx: 4.5, sy: 0.3 });
        }
        dashX += 12;
      }
      let segNo = 0;
      while (segNo < G.roadX.length - 1) {
        const spanFromX = G.roadX[segNo] + halfRoadW, spanToX = G.roadX[segNo + 1] + (-halfRoadW);
        edgeLines.push({ x: (spanFromX + spanToX) / 2, z: (roadZCoord + (-halfRoadW)) + 0.8, sx: spanToX + (-spanFromX), sy: 0.3 });
        edgeLines.push({ x: (spanFromX + spanToX) / 2, z: (roadZCoord + halfRoadW) + (-0.8), sx: spanToX + (-spanFromX), sy: 0.3 });
        ++segNo;
      }
    }
    for (const crossX of G.roadX) for (const crossZ of G.roadZ) {
      const stopOff = halfRoadW + 8.5;
      stopLines.push({ x: crossX + (-7), z: stopOff + crossZ, sx: 13, sy: 0.55 });
      stopLines.push({ x: crossX + 7, z: crossZ + (-stopOff), sx: 13, sy: 0.55 });
      stopLines.push({ x: stopOff + crossX, z: crossZ + (-7), sx: 0.55, sy: 13 });
      stopLines.push({ x: crossX + (-stopOff), z: crossZ + 7, sx: 0.55, sy: 13 });
    }
    let hillSegNo = 0;
    while (hillSegNo < G.touge.length - 1) {
      const ptFrom = G.touge[hillSegNo], ptTo = G.touge[hillSegNo + 1];
      const spanDx = ptTo.x + (-ptFrom.x), spanDz = ptTo.z + (-ptFrom.z);
      const spanLen = Math.hypot(spanDx, spanDz) || 0.001;
      const dirX = spanDx / spanLen, dirZ = spanDz / spanLen, sideX = -dirZ, sideZ = dirX;
      const spanRotY = Math.atan2(-dirX, -dirZ);
      for (let dashAt = 4; dashAt < spanLen; dashAt += 9) {
        const fracAmt = dashAt / spanLen, dashX = (spanDx * fracAmt) + ptFrom.x, dashZ = (spanDz * fracAmt) + ptFrom.z;
        hillDashes.push({ x: dashX, z: dashZ, ry: spanRotY, sx: 0.35, sy: 3.2, y: groundH(dashX, dashZ) + 0.12 });
      }
      for (const flankSign of [-1, 1]) {
        const midEdgeX = ((ptFrom.x + ptTo.x) / 2) + (sideX * flankSign * 4.05);
        const midEdgeZ = ((ptFrom.z + ptTo.z) / 2) + (sideZ * flankSign * 4.05);
        const hFrom = groundH(ptFrom.x + sideX * flankSign * 4.05, ptFrom.z + sideZ * flankSign * 4.05);
        const hTo = groundH(ptTo.x + sideX * flankSign * 4.05, ptTo.z + sideZ * flankSign * 4.05);
        hillEdges.push({ x: midEdgeX, z: midEdgeZ, ry: Math.atan2(dirX, dirZ), sx: 0.28, sz: spanLen, y: Math.max(hFrom, hTo) + 0.13 });
      }
      ++hillSegNo;
    }
    const groundQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const stampPlanes = (rowsArr, matRef) => {
      if (!rowsArr.length) return;
      const instObj = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), matRef, rowsArr.length);
      const m4 = new THREE.Matrix4(), qMain = new THREE.Quaternion(), qYaw = new THREE.Quaternion();
      const posV = new THREE.Vector3(), sclV = new THREE.Vector3();
      rowsArr.forEach((rowObj, rowNo) => {
        if (rowObj.ry) { qYaw.setFromEuler(new THREE.Euler(0, rowObj.ry, 0)); qMain.copy(qYaw).multiply(groundQuat); }
        else qMain.copy(groundQuat);
        instObj.setMatrixAt(rowNo, m4.compose(posV.set(rowObj.x, rowObj.y || 0.08, rowObj.z), qMain, sclV.set(rowObj.sx, rowObj.sy, 1)));
      });
      instObj.instanceMatrix.needsUpdate = true; scene.add(instObj);
    };
    const stampBoxes = (rowsArr, matRef) => {
      if (!rowsArr.length) return;
      const instObj = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), matRef, rowsArr.length);
      const m4 = new THREE.Matrix4(), qMain = new THREE.Quaternion(), posV = new THREE.Vector3(), sclV = new THREE.Vector3();
      rowsArr.forEach((rowObj, rowNo) => {
        qMain.setFromEuler(new THREE.Euler(0, rowObj.ry || 0, 0));
        instObj.setMatrixAt(rowNo, m4.compose(posV.set(rowObj.x, rowObj.y || 0.08, rowObj.z), qMain, sclV.set(rowObj.sx, 0.05, rowObj.sz)));
      });
      instObj.instanceMatrix.needsUpdate = true; scene.add(instObj);
    };
    stampPlanes(midDashes, amberPaintMat); stampPlanes(laneDashes, palePaintMat);
    stampPlanes(edgeLines, palePaintMat); stampPlanes(stopLines, palePaintMat);
    stampPlanes(hillDashes, palePaintMat); stampBoxes(hillEdges, palePaintMat);
  }

  {
    // Weld several small geometries into one indexed buffer set.
    const mergeGeometries = (geoArr) => {
      let vertTotal = 0, idxTotal = 0;
      for (const geoObj of geoArr) { vertTotal += geoObj.attributes.position.count; idxTotal += geoObj.index.count; }
      const posBuf = new Float32Array(vertTotal * 3), nrmBuf = new Float32Array(vertTotal * 3);
      const uvBuf = new Float32Array(vertTotal * 2), idxBuf = new Uint32Array(idxTotal);
      let vertAt = 0, idxAt = 0;
      for (const geoObj of geoArr) {
        posBuf.set(geoObj.attributes.position.array, vertAt * 3);
        nrmBuf.set(geoObj.attributes.normal.array, vertAt * 3);
        if (geoObj.attributes.uv) uvBuf.set(geoObj.attributes.uv.array, vertAt * 2);
        let elemNo = 0;
        while (elemNo < geoObj.index.count) { idxBuf[idxAt + elemNo] = geoObj.index.getX(elemNo) + vertAt; ++elemNo; }
        vertAt += geoObj.attributes.position.count; idxAt += geoObj.index.count;
      }
      const weldedGeo = new THREE.BufferGeometry();
      weldedGeo.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));
      weldedGeo.setAttribute('normal', new THREE.BufferAttribute(nrmBuf, 3));
      weldedGeo.setAttribute('uv', new THREE.BufferAttribute(uvBuf, 2));
      weldedGeo.setIndex(new THREE.BufferAttribute(idxBuf, 1));
      return weldedGeo;
    };

    // Traffic signals: merged pole geometry, instanced lamp faces, timed cycle.
    const poleGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8).translate(0, 2.3, 0), new THREE.BoxGeometry(0.12, 0.12, 1.0).translate(0, 4.5, 0.5),
      new THREE.BoxGeometry(0.34, 0.9, 0.3).translate(0, 4.15, 0.95) ]);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.6, metalness: 0.6 });
    const junctionList = [];
    for (const jx of G.roadX) for (const jz of G.roadZ) junctionList.push([jx, jz]);
    const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, junctionList.length * 2);
    const faceGeo = new THREE.CircleGeometry(0.11, 12);
    const litTones = [0xff2a1e, 0xffb020, 0x2aff5a];
    const lampSets = { x: [], z: [] };
    for (const axisKey of ['x', 'z']) {
      let toneNo = 0;
      while (toneNo < 3) {
        const litObj = new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ color: litTones[toneNo] }), junctionList.length);
        const darkObj = new THREE.InstancedMesh(faceGeo, new THREE.MeshBasicMaterial({ color: 0x1a1c1e }), junctionList.length);
        lampSets[axisKey].push({ on: litObj, off: darkObj }); scene.add(litObj); scene.add(darkObj); ++toneNo;
      }
    }
    const m4 = new THREE.Matrix4(), qObj = new THREE.Quaternion(), eObj = new THREE.Euler();
    const oneScale = new THREE.Vector3(1, 1, 1), posV = new THREE.Vector3();
    let poleNo = 0;
    junctionList.forEach(([jX, jZ], jNo) => {
      for (const [pX, pZ, pRot, pAxis] of [[jX + 13, jZ + 13, Math.PI / 2, 'x'], [jX + (-13), jZ + (-13), 0, 'z']]) {
        qObj.setFromEuler(eObj.set(0, pRot, 0));
        poleInst.setMatrixAt(poleNo++, m4.compose(posV.set(pX, 0, pZ), qObj, oneScale));
        const cosAmt = Math.cos(pRot), sinAmt = Math.sin(pRot);
        let toneNo = 0;
        while (toneNo < 3) {
          const faceY = [0.28, 0, -0.28][toneNo] + 4.15, faceOff = 1.11;
          const faceMtx = m4.compose(posV.set((faceOff * sinAmt) + pX, faceY, (faceOff * cosAmt) + pZ), qObj, oneScale);
          lampSets[pAxis][toneNo].on.setMatrixAt(jNo, faceMtx);
          lampSets[pAxis][toneNo].off.setMatrixAt(jNo, faceMtx); ++toneNo;
        }
      }
    });
    poleInst.instanceMatrix.needsUpdate = true; scene.add(poleInst);
    for (const axisKey of ['x', 'z']) for (const pairObj of lampSets[axisKey]) {
      pairObj.on.instanceMatrix.needsUpdate = true; pairObj.off.instanceMatrix.needsUpdate = true;
    }
    let clockAmt = 0, phaseNo = -1, stateX = 'red', stateZ = 'green';
    const pushSignalStates = () => {
      for (const [axisKey, stateTxt] of [['x', stateX], ['z', stateZ]]) {
        const litNo = stateTxt === 'red' ? 0 : stateTxt === 'yellow' ? 1 : 2;
        lampSets[axisKey].forEach((pairObj, toneNo) => {
          pairObj.on.visible = toneNo === litNo; pairObj.off.visible = toneNo !== litNo;
        });
      }
    };
    pushSignalStates();
    G.lightState = (axisKey) => (axisKey === 'x' ? stateX : stateZ);
    G.updaters.push((GInner, dtInner) => {
      clockAmt = (clockAmt + dtInner) % 15.5;
      let nextPhase, wantX = 'red', wantZ = 'red';
      if (clockAmt < 5.5) { nextPhase = 0; wantZ = 'green'; }
      else if (clockAmt < 7) { nextPhase = 1; wantZ = 'yellow'; }
      else if (clockAmt < 7.75) nextPhase = 2;
      else if (clockAmt < 13.25) { nextPhase = 3; wantX = 'green'; }
      else if (clockAmt < 14.75) { nextPhase = 4; wantX = 'yellow'; }
      else nextPhase = 5;
      if (nextPhase !== phaseNo) { phaseNo = nextPhase; stateX = wantX; stateZ = wantZ; pushSignalStates(); }
    });
  }

  const fallbackPalette = ['#8d99ae', '#a39a8b', '#b08968', '#94867a', '#9c7bb5', '#6d8ea0'];
  // District building grid: nearest district decides palette and heights.
  const beachPastels = VICE.coralPastels;
  const tonesByDistrict = {
    neon: VICE.downtown, coral: VICE.coralPastels,
    port: ['#8a7f6a', '#6b7a72', '#a08a68', '#5f8d7d', '#94867a', '#7f9bb3'],
    hoshino: ['#9aa0a6', '#a39a8b', '#7d9a7a', '#b09872', '#6d8ea0', '#9a8a72'],
  };
  let prevWallTone = null, prevPrevWallTone = null;
  const shopSignChoices = [
    ['RAMEN', '#ff5c39'], ['CLUB NEON', '#e879ff'], ['TURBO PARTS', '#57b7ff'],
    ['HOTEL CORAL', '#ffb35c'], ['PAWN', '#ffe14d'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'],
  ];
  const posterChoices = ['RONIN KAI', 'TURBO MAX', 'BAY COLA'];
  let gridX = 0;
  while (gridX < 8) {
    let gridZ = 0;
    while (gridZ < 8) {
      const blockCentreX = (gridX * 165) + (-577.5), blockCentreZ = (gridZ * 165) + (-577.5);
      const blockDistrict = DISTRICTS.reduce(
        (bestObj, candObj) => ((blockCentreX + (-candObj.cx)) ** 2 + (blockCentreZ + (-candObj.cz)) ** 2
          < (blockCentreX + (-bestObj.cx)) ** 2 + (blockCentreZ + (-bestObj.cz)) ** 2 ? candObj : bestObj), DISTRICTS[0]);
      ++gridZ;
      if (blockDistrict.id === 'hoshino'
        && Math.hypot(blockCentreX + (-blockDistrict.cx), blockCentreZ + (-blockDistrict.cz)) < 250) {
        constructResidentialBlock(G, scene, blockCentreX, blockCentreZ); continue;
      }
      const beachBlock = blockCentreZ > 500, perBlock = ri(2, 4);
      let buildNo = 0;
      while (buildNo < perBlock) {
        ++buildNo;
        const boxW = rr(22, 44), boxD = rr(22, 44);
        const boxH = beachBlock ? rr(8, 20)
          : blockDistrict.id === 'neon' ? rr(24, 60)
          : blockDistrict.id === 'hoshino' ? rr(8, 22)
          : blockDistrict.id === 'port' ? rr(8, 20) : rr(10, 28);
        const boxX = rr(-48, 48) + blockCentreX, boxZ = rr(-48, 48) + blockCentreZ;
        if (Math.abs(boxX + 412.5) < 60 && Math.abs(boxZ + (-412.5)) < 60) continue;
        if (Math.abs(boxX + (-MARKET.x)) < 54 && Math.abs(boxZ + (-MARKET.z)) < 76) continue;
        const tonesArr = beachBlock ? beachPastels : (tonesByDistrict[blockDistrict.id] || fallbackPalette);
        let wallTone = pick(tonesArr);
        if (wallTone === prevWallTone) wallTone = tonesArr[(tonesArr.indexOf(wallTone) + 1) % tonesArr.length];
        if ((blockDistrict.id === 'coral' || beachBlock) && wallTone === prevPrevWallTone)
          wallTone = tonesArr[(tonesArr.indexOf(wallTone) + 1) % tonesArr.length];
        prevPrevWallTone = prevWallTone; prevWallTone = wallTone;
        const wallTex = buildBuildingTexture(wallTone, rr(0.18, 0.42));
        wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
        const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, emissive: 0xffc873, emissiveMap: wallTex, emissiveIntensity: 0, roughness: 0.9 });
        wallMat.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
        const blockMesh = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), wallMat);
        blockMesh.position.set(boxX, (boxH / 2) + groundH(boxX, boxZ), boxZ);
        blockMesh.castShadow = true; blockMesh.receiveShadow = true; scene.add(blockMesh);
        if (!G.buildingMats) G.buildingMats = [];
        G.buildingMats.push(wallMat);
        G.addCollider(boxX, boxZ, boxW / 2, boxD / 2, boxH);
        if (beachBlock) {
          const capH = rr(1.6, 3);
          const capMesh = new THREE.Mesh(new THREE.BoxGeometry(boxW * 0.62, capH, boxD * 0.62), wallMat);
          capMesh.position.set(boxX, (boxH + (capH / 2)) + groundH(boxX, boxZ), boxZ);
          capMesh.castShadow = true; scene.add(capMesh);
        }
        if (beachBlock || blockDistrict.id === 'coral') {
          const trimTone = pick(VICE.neonTrim);
          const trimMat = new THREE.MeshStandardMaterial({ color: trimTone, emissive: trimTone, emissiveIntensity: 0, roughness: 0.6 });
          const trimMesh = new THREE.Mesh(new THREE.BoxGeometry(boxW + 0.35, 0.3, boxD + 0.35), trimMat);
          trimMesh.position.set(boxX, (boxH * 0.84) + groundH(boxX, boxZ), boxZ);
          trimMesh.castShadow = true; scene.add(trimMesh);
          if (!G.neonTrimMats) G.neonTrimMats = [];
          G.neonTrimMats.push(trimMat);
          const trimGlow = glowSprite(new THREE.Color(trimTone), 12);
          trimGlow.position.set(boxX, (boxH * 0.84) + groundH(boxX, boxZ), boxZ);
          trimGlow.material.opacity = 0; scene.add(trimGlow); glowSpriteList.push(trimGlow);
        }
        if (rnd() < 0.3) {
          const roofBox = new THREE.Mesh(new THREE.BoxGeometry(rr(2, 4), rr(1, 2), rr(2, 4)),
            new THREE.MeshStandardMaterial({ color: 0x555a60 }));
          roofBox.position.set(rr(-6, 6) + boxX, boxH + 0.8, rr(-6, 6) + boxZ); scene.add(roofBox);
        }
        if (rnd() < 0.22) {
          const posterTex = buildSignTexture(pick(posterChoices), '#14161c', '#ffb35c');
          const panelGeo = new THREE.PlaneGeometry(14, 4);
          const panelMat = new THREE.MeshBasicMaterial({ map: posterTex, side: THREE.FrontSide });
          const panelRotY = rr(0, Math.PI);
          const panelFront = new THREE.Mesh(panelGeo, panelMat);
          panelFront.position.set(boxX, boxH + 4, boxZ); panelFront.rotation.y = panelRotY; scene.add(panelFront);
          const panelBack = new THREE.Mesh(panelGeo, panelMat);
          panelBack.position.set(boxX + (-(Math.sin(panelRotY) * 0.06)), boxH + 4, boxZ + (-(Math.cos(panelRotY) * 0.06)));
          panelBack.rotation.y = panelRotY + Math.PI; scene.add(panelBack);
        }
        if ((blockDistrict.id === 'neon' || blockDistrict.id === 'coral' || beachBlock)
          && rnd() < (beachBlock ? 0.75 : 0.6)) {
          const [signTxt, signTone] = pick(shopSignChoices);
          const signTex = buildSignTexture(signTxt, '#101018', signTone);
          const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.4), new THREE.MeshBasicMaterial({ map: signTex }));
          signMesh.position.set(boxX, 4.6, (boxD / 2) + 0.1 + boxZ); scene.add(signMesh);
          const signGlow = glowSprite(new THREE.Color(signTone), 13);
          signGlow.position.set(boxX, 4.6, (boxD / 2) + 0.02 + boxZ);
          signGlow.material.opacity = 0; scene.add(signGlow); glowSpriteList.push(signGlow);
          const canopyMesh = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 2.2),
            new THREE.MeshStandardMaterial({ color: new THREE.Color(signTone) }));
          canopyMesh.position.set(boxX, 3.6, (boxD / 2) + 1 + boxZ); canopyMesh.rotation.x = 0.3; scene.add(canopyMesh);
        }
      }
    }
    ++gridX;
  }

  {
    // Streetlights: collect pole spots, then instance pole, head and light pool.
    const lampSpots = [];
    const nearJunction = (probeVal, roadArr) => roadArr.some((roadCoord) => Math.abs(probeVal + (-roadCoord)) < 21);
    const spotHitsBlock = (px, pz) => G.colliders.some(
      (cObj) => Math.abs(px + (-cObj.x)) < cObj.hw + 1 && Math.abs(pz + (-cObj.z)) < cObj.hd + 1);
    for (const roadXCoord of G.roadX) {
      const mainRoad = roadXCoord === 0 || roadXCoord === 330;
      let altNo = 0;
      for (let lampZ = -615; !(lampZ > 615); lampZ += mainRoad ? 45 : 55, ++altNo) {
        if (nearJunction(lampZ, G.roadZ)) continue;
        if (mainRoad) {
          lampSpots.push({ x: roadXCoord + (-17), z: lampZ, glow: 1 });
          lampSpots.push({ x: roadXCoord + 17, z: lampZ + 22, glow: 1 });
        } else lampSpots.push({ x: roadXCoord + (altNo % 2 === 0 ? 17 : -17), z: lampZ, glow: 0 });
      }
    }
    for (const roadZCoord of G.roadZ) {
      const mainRoad = roadZCoord === 0 || roadZCoord === 495;
      let altNo = 0;
      for (let lampX = -615; !(lampX > 615); lampX += mainRoad ? 45 : 55, ++altNo) {
        if (nearJunction(lampX, G.roadX)) continue;
        if (mainRoad) {
          lampSpots.push({ x: lampX, z: roadZCoord + (-17), glow: 1 });
          lampSpots.push({ x: lampX + 22, z: roadZCoord + 17, glow: 1 });
        } else lampSpots.push({ x: lampX, z: roadZCoord + (altNo % 2 === 0 ? 17 : -17), glow: 0 });
      }
    }
    let boardX = -440;
    while (!(boardX > 640)) {
      if (!spotHitsBlock(boardX, 552)) lampSpots.push({ x: boardX, z: 552, glow: 2 });
      boardX += 55;
    }
    const spotTotal = lampSpots.length;
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8, metalness: 0.5 });
    const m4 = new THREE.Matrix4();
    const mastInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), mastMat, spotTotal);
    lampSpots.forEach((spotObj, spotNo) => { m4.makeTranslation(spotObj.x, 3, spotObj.z); mastInst.setMatrixAt(spotNo, m4); });
    mastInst.instanceMatrix.needsUpdate = true; scene.add(mastInst);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc98a, emissiveIntensity: 0.15, roughness: 0.5 });
    const headInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), headMat, spotTotal);
    lampSpots.forEach((spotObj, spotNo) => { m4.makeTranslation(spotObj.x, 6.02, spotObj.z); headInst.setMatrixAt(spotNo, m4); });
    headInst.instanceMatrix.needsUpdate = true; scene.add(headInst);
    const poolMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const poolInst = new THREE.InstancedMesh(new THREE.CircleGeometry(5.5, 20), poolMat, spotTotal);
    const groundQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const posV = new THREE.Vector3(), oneScale = new THREE.Vector3(1, 1, 1);
    lampSpots.forEach((spotObj, spotNo) => {
      poolInst.setMatrixAt(spotNo, m4.compose(posV.set(spotObj.x, 0.09, spotObj.z), groundQuat, oneScale));
    });
    poolInst.instanceMatrix.needsUpdate = true; scene.add(poolInst);
    for (const spotObj of lampSpots) {
      if (!spotObj.glow) continue;
      const glowObj = glowSprite(spotObj.glow === 2 ? 0xcfe6ff : 0xffd9a0, spotObj.glow === 2 ? 5 : 5.5);
      glowObj.position.set(spotObj.x, 6, spotObj.z); glowObj.material.opacity = 0;
      scene.add(glowObj); streetlightGlowList.push(glowObj);
    }
    G.lampHeadMat = headMat; G.lampPoolMat = poolMat;
  }
  G.streetlightGlows = streetlightGlowList; G.signGlows = glowSpriteList;
  constructHQ(G, scene); constructMarket(G, scene); constructBeachStrip(G, scene);
  G.landmarks = {
    market: { x: MARKET.x, z: MARKET.z, name: MARKET.name },
    garage: { x: G.hq.x, z: G.hq.garage.z, name: 'RONIN KAI HQ' },
    districts: [
      { name: 'Downtown', x: 0, z: 0 }, { name: 'Portside', x: -330, z: 330 },
      { name: 'Coral Strip', x: 330, z: 330 }, { name: 'Neon Mile', x: 330, z: -330 },
      { name: 'Hoshino Heights', x: -330, z: -330 }, { name: 'Touge', x: -330, z: -470 },
    ],
  };

  constructHarbor(G, scene); constructTouge(G, scene);

  // Scattered greenery: rejection-sampled spots, species by district.
  let plantedTrees = 0, attemptNo = 0;
  while (attemptNo < 400 && plantedTrees < 250) {
    ++attemptNo;
    const dropX = rr(-640, 640), dropZ = rr(-640, 640);
    const onRoad = G.roadX.some((roadCoord) => Math.abs(dropX + (-roadCoord)) < 22)
      || G.roadZ.some((roadCoord) => Math.abs(dropZ + (-roadCoord)) < 22);
    const nearPark = Math.abs(dropX + 412.5) < 55 && Math.abs(dropZ + (-412.5)) < 55;
    const nearMart = Math.abs(dropX + (-MARKET.x)) < 58 && Math.abs(dropZ + (-MARKET.z)) < 78;
    if (onRoad || nearPark || nearMart) continue;
    const homeDistrict = DISTRICTS.reduce(
      (bestObj, candObj) => ((dropX + (-candObj.cx)) ** 2 + (dropZ + (-candObj.cz)) ** 2
        < (dropX + (-bestObj.cx)) ** 2 + (dropZ + (-bestObj.cz)) ** 2 ? candObj : bestObj), DISTRICTS[0]);
    let treeObj;
    if (homeDistrict.id === 'coral' || dropZ > 520 || homeDistrict.id === 'neon') treeObj = makePalm(rr(4.5, 6.5));
    else if (homeDistrict.id === 'hoshino') treeObj = makeShadeTree(rr(3.5, 5), rnd() < 0.3 ? 0xe8a0bf : 0x3d8b4f);
    else treeObj = makeShadeTree(rr(3.5, 5.5), 0x3d8b4f);
    treeObj.position.set(dropX, groundH(dropX, dropZ), dropZ); treeObj.rotation.y = rr(0, 6.28);
    scene.add(treeObj); ++plantedTrees;
  }
  {
    const vergeOff = (CFG.roadW / 2) + 3.8;
    let vergePalms = 0, vergeX = -600;
    while (!(vergeX > 600) && vergePalms < 72) {
      for (const flankSign of [-1, 1]) {
        const palmObj = makePalm(rr(4.5, 6.5));
        palmObj.position.set(rr(-2, 2) + vergeX, groundH(vergeX, (flankSign * vergeOff) + 495), (flankSign * vergeOff) + 495);
        palmObj.rotation.y = rr(0, 6.28); scene.add(palmObj); ++vergePalms;
      }
      vergeX += 40;
    }
    let vergeZ = -595;
    while (!(vergeZ > 95) && vergePalms < 82) {
      const palmObj = makePalm(rr(4.5, 6.5));
      palmObj.position.set(vergeOff + 330, groundH(vergeOff + 330, vergeZ), rr(-2, 2) + vergeZ);
      palmObj.rotation.y = rr(0, 6.28); scene.add(palmObj); ++vergePalms; vergeZ += 70;
    }

    // Port-side dressing: hazard crates, barriers, dumpsters.
    const hazardTex = makeCanvasTexture(128, 128, (pen, wdt, hgt) => {
      pen.fillStyle = '#8a7a3a'; pen.fillRect(0, 0, wdt, hgt);
      pen.fillStyle = '#2b2b2b';
      let stripeNo = -2;
      while (stripeNo < 8) {
        pen.save(); pen.translate(stripeNo * 32, 0); pen.rotate(0.6);
        pen.fillRect(0, -40, 14, hgt + 80); pen.restore(); ++stripeNo;
      }
      pen.fillStyle = 'rgba(255,255,255,.75)'; pen.fillRect(14, 44, 100, 40);
      pen.fillStyle = '#333'; pen.font = 'bold 22px sans-serif'; pen.textAlign = 'center';
      pen.fillText('CARGO', 64, 72);
    });
    const crateMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 });
    const crateGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    let crateNo = 0;
    while (crateNo < 12) {
      const crateX = ((crateNo % 4) * 36) + rr(-3, 3) + (-625);
      const crateZ = (Math.floor(crateNo / 4) * 30) + rr(-3, 3) + 532;
      const crateMesh = new THREE.Mesh(crateGeo, crateMat);
      crateMesh.position.set(crateX, 1.1, crateZ); crateMesh.rotation.y = rr(0, 0.6); scene.add(crateMesh);
      if (crateNo % 3 === 0) {
        const upperCrate = new THREE.Mesh(crateGeo, crateMat);
        upperCrate.position.set(crateX, 3.3, crateZ); upperCrate.rotation.y = rr(0, 0.6); scene.add(upperCrate);
      }
      ++crateNo;
    }
    const barrierTex = makeCanvasTexture(128, 32, (pen, wdt, hgt) => {
      pen.fillStyle = '#b8b4a8'; pen.fillRect(0, 0, wdt, hgt);
      pen.fillStyle = '#e8762a'; pen.fillRect(0, 12, wdt, 8);
    });
    const barrierMat = new THREE.MeshStandardMaterial({ map: barrierTex, roughness: 0.95 });
    let barrierNo = 0;
    while (barrierNo < 6) {
      const barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.5), barrierMat);
      barrierMesh.position.set((barrierNo * 40) + (-560), 0.5, 472); scene.add(barrierMesh); ++barrierNo;
    }
    const binMat = new THREE.MeshStandardMaterial({ color: 0x2e4a34, roughness: 0.85, metalness: 0.2 });
    const binLidMat = new THREE.MeshStandardMaterial({ color: 0x223828, roughness: 0.8, metalness: 0.2 });
    for (const [binX, binZ] of [[270, -40], [390, 40], [270, -200], [390, -260]]) {
      const binMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), binMat);
      binMesh.position.set(binX, 0.7, binZ); scene.add(binMesh);
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.5), binLidMat);
      lidMesh.position.set(binX, 1.46, binZ); scene.add(lidMesh);
    }
  }

  constructBoulevardFrontage(G, scene); constructBoulevardPalms(G, scene);
  constructGatherSpots(G, scene); constructHoshinoRows(G, scene); constructBoulevardPlanters(G, scene);

  // Two paved plazas with loose furniture and proper bench/planter units.
  for (const [plazaX, plazaZ] of [[412, 412], [-412, -80]]) {
    const slabMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), makePavingMat(15, 15));
    slabMesh.rotation.x = -Math.PI / 2; slabMesh.position.set(plazaX, 0.04, plazaZ);
    slabMesh.receiveShadow = true; scene.add(slabMesh);
    let seatNo = 0;
    while (seatNo < 4) {
      const seatMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x7a5a38 }));
      seatMesh.position.set(rr(-35, 35) + plazaX, 0.3, rr(-35, 35) + plazaZ); scene.add(seatMesh); ++seatNo;
    }
    let tubNo = 0;
    while (tubNo < 4) {
      const tubMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1 }));
      tubMesh.position.set(rr(-38, 38) + plazaX, 0.3, rr(-38, 38) + plazaZ); scene.add(tubMesh);
      const shrubMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1),
        new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true }));
      shrubMesh.position.set(tubMesh.position.x, 0.95, tubMesh.position.z); scene.add(shrubMesh); ++tubNo;
    }
    const plazaBenchA = makeBenchUnit();
    plazaBenchA.position.set(plazaX + (-12), groundH(plazaX + (-12), plazaZ + 10), plazaZ + 10); plazaBenchA.rotation.y = 0.4; scene.add(plazaBenchA);
    const plazaBenchB = makeBenchUnit();
    plazaBenchB.position.set(plazaX + 14, groundH(plazaX + 14, plazaZ + (-8)), plazaZ + (-8)); plazaBenchB.rotation.y = -0.7; scene.add(plazaBenchB);
    const plazaPlanter = makePlanterUnit();
    plazaPlanter.position.set(plazaX + 4, groundH(plazaX + 4, plazaZ + 16), plazaZ + 16); scene.add(plazaPlanter);
  }

  constructPark(G, scene); }

const GARAGE_ROT_Y = Math.PI;
function constructHQ(G, scene) {
  // Ronin Kai garage block, replaced by the GLB garage when it loads.
  const baseX = -412.5, baseZ = 412.5, grpHQ = new THREE.Group();
  scene.add(grpHQ);
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const shellMesh = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 34), shellMat);
  shellMesh.position.set(baseX, 5, baseZ); grpHQ.add(shellMesh);
  G.addCollider(baseX, baseZ, 15, 15, 10);
  const shutterMat = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.6, metalness: 0.6 });
  let shutterNo = -1;
  while (!(shutterNo > 1)) {
    const shutterMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), shutterMat);
    shutterMesh.position.set((shutterNo * 20) + baseX, 3, baseZ + 17.2); grpHQ.add(shutterMesh); ++shutterNo;
  }
  const fasciaTex = (() => {
    const cnv = document.createElement('canvas');
    cnv.width = 512; cnv.height = 96;
    const pen = cnv.getContext('2d');
    pen.fillStyle = '#14100c'; pen.fillRect(0, 0, 512, 96);
    pen.font = 'bold 58px sans-serif'; pen.textAlign = 'center';
    pen.shadowColor = '#ff7a1a'; pen.shadowBlur = 16;
    pen.fillStyle = '#ff7a1a'; pen.fillText('RONIN KAI', 256, 66);
    const texObj = new THREE.CanvasTexture(cnv);
    texObj.colorSpace = THREE.SRGBColorSpace; return texObj;
  })();
  const fasciaMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial({ map: fasciaTex }));
  fasciaMesh.position.set(baseX, 8.6, baseZ + 17.3); grpHQ.add(fasciaMesh);
  const litWinMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb35c, emissiveIntensity: 0.6 });
  let winNo = 0;
  while (winNo < 5) {
    const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), litWinMat);
    winMesh.position.set((winNo * 14) + baseX + (-28), 7.6, baseZ + (-17.2));
    winMesh.rotation.y = Math.PI; grpHQ.add(winMesh); ++winNo; }

  const forecourtTex = makeCanvasTexture(1024, 384, (pen, wdt, hgt) => {
    pen.fillStyle = '#6a6d70'; pen.fillRect(0, 0, wdt, hgt);
    let fleckNo = 0;
    while (fleckNo < 5200) {
      const shadeValue = 96 + Math.floor(rnd() * 48);
      pen.fillStyle = `rgba(${shadeValue},${shadeValue},${shadeValue + 4},.14)`;
      pen.fillRect(rnd() * wdt, rnd() * hgt, 2, 2); ++fleckNo;
    }
    for (const [stainX, stainY, stainRx, stainRy] of [[210, 120, 58, 20], [560, 210, 74, 26], [790, 90, 46, 16], [390, 290, 52, 18]]) {
      pen.fillStyle = 'rgba(18,18,20,.20)'; pen.beginPath();
      pen.ellipse(stainX, stainY, stainRx, stainRy, 0.4, 0, 2 * Math.PI); pen.fill();
      pen.fillStyle = 'rgba(18,18,20,.12)'; pen.beginPath();
      pen.ellipse(stainX + 14, stainY + 6, stainRx * 0.6, stainRy * 0.6, 0.4, 0, 2 * Math.PI); pen.fill();
    }
    pen.strokeStyle = 'rgba(245,245,240,.88)'; pen.lineWidth = 5;
    pen.beginPath(); pen.moveTo(0, hgt + (-108)); pen.lineTo(wdt, hgt + (-108)); pen.stroke();
    let bayLineX = 32;
    while (!(bayLineX > wdt + (-32))) {
      pen.beginPath(); pen.moveTo(bayLineX, hgt + (-108)); pen.lineTo(bayLineX, hgt + (-6)); pen.stroke(); bayLineX += 96; }
  });
  forecourtTex.wrapS = forecourtTex.wrapT = THREE.ClampToEdgeWrapping;
  const forecourtMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 30),
    new THREE.MeshStandardMaterial({ map: forecourtTex, roughness: 1 }));
  forecourtMesh.rotation.x = -Math.PI / 2; forecourtMesh.position.set(baseX, 0.04, 455); scene.add(forecourtMesh);
  G.hq = { x: baseX, z: baseZ, garage: { x: baseX, z: 455 } };

  const attemptGarageSwap = (triesLeft) => {
    loadHeroAsset('garage').then((wrapObj) => {
      try {
        if (!wrapObj) {
          if (triesLeft > 0) setTimeout(() => attemptGarageSwap(triesLeft - 1), 1500);
          return;
        }
        scene.remove(grpHQ);
        const grpPlaced = new THREE.Group();
        grpPlaced.position.set(baseX, groundH(baseX, baseZ), baseZ); grpPlaced.rotation.y = GARAGE_ROT_Y;
        grpPlaced.add(wrapObj.clone ? wrapObj.clone(true) : wrapObj);
        const neonTex = (() => {
          const cnv = document.createElement('canvas');
          cnv.width = 1024; cnv.height = 192;
          const pen = cnv.getContext('2d');
          pen.clearRect(0, 0, 1024, 192);
          pen.font = 'italic bold 118px sans-serif'; pen.textAlign = 'center';
          pen.shadowColor = '#ff4fd8'; pen.shadowBlur = 34;
          pen.fillStyle = '#ff4fd8'; pen.fillText('RONIN KAI', 512, 122);
          pen.shadowBlur = 18; pen.fillStyle = '#ff7a1a'; pen.fillRect(212, 148, 600, 14);
          const texObj = new THREE.CanvasTexture(cnv);
          texObj.colorSpace = THREE.SRGBColorSpace; return texObj;
        })();
        const neonMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6),
          new THREE.MeshBasicMaterial({ map: neonTex, transparent: true }));
        neonMesh.position.set(0, 10.8, -15.15); neonMesh.rotation.y = Math.PI; grpPlaced.add(neonMesh);
        const stripMat = new THREE.MeshBasicMaterial({ color: 0x39d5ff });
        for (const stripX of [-13.5, 13.5]) {
          const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 8), stripMat);
          stripMesh.position.set(stripX, 6, -15.15); stripMesh.rotation.y = Math.PI; grpPlaced.add(stripMesh);
        }
        const neonGlow = glowSprite(0xff4fd8, 16);
        neonGlow.position.set(0, 10.8, -15.35); neonGlow.material.opacity = 0.35; grpPlaced.add(neonGlow);
        scene.add(grpPlaced);
      } catch (errObj) { /* swap stays optional: the block building remains */ }
    }).catch(() => {
      if (triesLeft > 0) setTimeout(() => attemptGarageSwap(triesLeft - 1), 1500); });
  };
  try { attemptGarageSwap(3); } catch (errObj) { /* same fallback as above */ }
}

function constructHarbor(G, scene) {
  // Container stacks, two gantry cranes and a bollard row at the port.
  const boxTones = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98, 0xca6f1e];
  Array.from({ length: 26 }).forEach((_skipVal, boxNo) => {
    const boxX = rr(-620, -480), boxZ = rr(480, 620);
    const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.4),
      new THREE.MeshStandardMaterial({ color: pick(boxTones), roughness: 0.8 }));
    boxMesh.position.set(boxX, ((boxNo % 3) * 2.6) + 1.3, boxZ);
    boxMesh.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2; scene.add(boxMesh);
    if (boxNo % 4 === 0) G.addCollider(boxX, boxZ, 6, 2, 3); });
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd97c2b, roughness: 0.7, metalness: 0.4 });
  for (const craneX of [-560, -480]) {
    const grpCrane = new THREE.Group();
    for (const flankSign of [-1, 1]) {
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), craneMat);
      legMesh.position.set(flankSign * 8, 13, 0); grpCrane.add(legMesh);
    }
    const jibMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 34), craneMat);
    jibMesh.position.set(0, 26, 6); grpCrane.add(jibMesh);
    const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.4, 1.4), craneMat);
    beamMesh.position.y = 26; grpCrane.add(beamMesh);
    grpCrane.position.set(craneX, 0, 540); scene.add(grpCrane);
    G.addCollider(craneX, 540, 9, 3, 26); }
  const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  let postNo = 0;
  while (postNo < 10) {
    const postMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), postMat);
    postMesh.position.set((postNo * 16) + (-640), 0.4, 648); scene.add(postMesh); ++postNo; }
}

function constructTouge(G, scene) {
  // Mountain loop: extruded road ribbon, outer guardrail, cherry trees.
  const routePts = TOUGE_POINTS.map((ptArr) => ({ x: ptArr[0], z: ptArr[1] }));
  const roadW = 9, hubPt = { x: -330, z: -470 };
  const asphaltTex = makeCanvasTexture(128, 128, (pen, wdt, hgt) => {
    pen.fillStyle = '#33373d'; pen.fillRect(0, 0, wdt, hgt);
    let grainNo = 0;
    while (grainNo < 260) { pen.fillStyle = 'rgba(255,255,255,.05)'; pen.fillRect(rnd() * wdt, rnd() * hgt, 2, 2); ++grainNo; }
    pen.fillStyle = '#f0ead0';
    pen.fillRect(wdt * 0.03, 0, 3, hgt);
    pen.fillRect((wdt * 0.97) + (-3), 0, 3, hgt);
    pen.fillRect((wdt / 2) + (-2), 10, 4, 44);
  });
  asphaltTex.wrapS = THREE.ClampToEdgeWrapping; asphaltTex.wrapT = THREE.RepeatWrapping;
  const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb0b6bc, metalness: 0.7, roughness: 0.4 });
  const posArr = [], uvArr = [], idxArr = [], postSpots = [];
  let travelled = 0, segNo = 0;
  while (segNo < routePts.length - 1) {
    const ptFrom = routePts[segNo], ptTo = routePts[segNo + 1];
    const spanDx = ptTo.x + (-ptFrom.x), spanDz = ptTo.z + (-ptFrom.z);
    const spanLen = Math.hypot(spanDx, spanDz) || 0.001;
    const dirX = spanDx / spanLen, dirZ = spanDz / spanLen, sideX = -dirZ, sideZ = dirX;
    const edgeAt = (ptObj, flankSign) => {
      const edgeX = (sideX * flankSign * (roadW / 2)) + ptObj.x;
      const edgeZ = (sideZ * flankSign * (roadW / 2)) + ptObj.z;
      return { x: edgeX, z: edgeZ, y: groundH(edgeX, edgeZ) + 0.07 };
    };
    const edgeAPlus = edgeAt(ptFrom, 1), edgeAMinus = edgeAt(ptFrom, -1);
    const edgeBPlus = edgeAt(ptTo, 1), edgeBMinus = edgeAt(ptTo, -1);
    const vertBase = posArr.length / 3;
    for (const edgeObj of [edgeAPlus, edgeAMinus, edgeBPlus, edgeBMinus]) posArr.push(edgeObj.x, edgeObj.y, edgeObj.z);
    uvArr.push(0, travelled / 8, 1, travelled / 8, 0, (travelled + spanLen) / 8, 1, (travelled + spanLen) / 8);
    idxArr.push(vertBase, vertBase + 2, vertBase + 1, vertBase + 1, vertBase + 2, vertBase + 3);
    const midX = (ptFrom.x + ptTo.x) / 2, midZ = (ptFrom.z + ptTo.z) / 2;
    const distPlus = Math.hypot((midX + sideX * 5) + (-hubPt.x), (midZ + sideZ * 5) + (-hubPt.z));
    const distMinus = Math.hypot((midX + (-(sideX * 5))) + (-hubPt.x), (midZ + (-(sideZ * 5))) + (-hubPt.z));
    const outerSign = distPlus >= distMinus ? 1 : -1;
    const outerFrom = outerSign > 0 ? edgeAPlus : edgeAMinus, outerTo = outerSign > 0 ? edgeBPlus : edgeBMinus;
    const railMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, spanLen), railMat);
    railMesh.position.set((outerFrom.x + outerTo.x) / 2, ((outerFrom.y + outerTo.y) / 2) + 0.55, (outerFrom.z + outerTo.z) / 2);
    railMesh.lookAt(outerTo.x, outerTo.y + 0.55, outerTo.z); scene.add(railMesh);
    let postAt = 0;
    while (!(postAt > spanLen)) {
      const fracAmt = postAt / spanLen;
      const postX = (spanDx * fracAmt) + ptFrom.x + sideX * outerSign * ((roadW / 2) + 0.3);
      const postZ = (spanDz * fracAmt) + ptFrom.z + sideZ * outerSign * ((roadW / 2) + 0.3);
      postSpots.push({ x: postX, z: postZ, y: groundH(postX, postZ) }); postAt += 8;
    }
    travelled += spanLen; ++segNo;
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  ribbonGeo.setIndex(idxArr); ribbonGeo.computeVertexNormals(); scene.add(new THREE.Mesh(ribbonGeo, asphaltMat));
  const postInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 6), railMat, Math.max(1, postSpots.length));
  {
    const m4 = new THREE.Matrix4();
    postSpots.forEach((postObj, postNo) => { m4.makeTranslation(postObj.x, postObj.y + 0.31, postObj.z); postInst.setMatrixAt(postNo, m4); });
    postInst.instanceMatrix.needsUpdate = true; }
  scene.add(postInst);
  let treeNo = 0;
  while (treeNo < 12) {
    const anchorPt = routePts[treeNo % routePts.length];
    const nextPt = routePts[Math.min(treeNo + 1, routePts.length - 1)];
    const stepDx = nextPt.x + (-anchorPt.x), stepDz = nextPt.z + (-anchorPt.z);
    const stepLen = Math.hypot(stepDx, stepDz) || 1;
    const flankSign = treeNo % 2 === 0 ? 1 : -1;
    const treeX = ((-stepDz / stepLen) * flankSign * rr(10, 13)) + anchorPt.x;
    const treeZ = ((stepDx / stepLen) * flankSign * rr(10, 13)) + anchorPt.z;
    const cherryObj = makeShadeTree(rr(3, 4.5), 0xe8a0bf);
    cherryObj.position.set(treeX, groundH(treeX, treeZ), treeZ); cherryObj.rotation.y = rr(0, 6.28);
    scene.add(cherryObj); ++treeNo;
  }
}

export function roadRoute(G, fromPt, toPt) {
  // Grid route: snap both ends to the nearest road lines, walk the corners.
  const snapToRoad = (probeVal, roadArr) => roadArr.reduce(
    (bestA, candB) => Math.abs(candB + (-probeVal)) < Math.abs(bestA + (-probeVal)) ? candB : bestA, roadArr[0]);
  const fromSnapX = snapToRoad(fromPt.x, G.roadX), fromSnapZ = snapToRoad(fromPt.z, G.roadZ);
  const toSnapX = snapToRoad(toPt.x, G.roadX), toSnapZ = snapToRoad(toPt.z, G.roadZ);
  const routeList = [
    { x: fromPt.x, z: fromPt.z }, { x: fromSnapX, z: fromPt.z }, { x: fromSnapX, z: fromSnapZ } ];
  const cornerA = { x: toSnapX, z: fromSnapZ }, cornerB = { x: fromSnapX, z: toSnapZ };
  const legSpanA = Math.abs(toSnapX + (-fromSnapX)) + Math.abs(toSnapZ + (-fromSnapZ));
  const legSpanB = legSpanA;
  void legSpanB;
  routeList.push(cornerA, { x: toSnapX, z: toSnapZ }, { x: toPt.x, z: toPt.z });
  void cornerB;
  return routeList.filter((ptObj, ptNo) => ptNo === 0
    || Math.hypot(ptObj.x + (-routeList[ptNo - 1].x), ptObj.z + (-routeList[ptNo - 1].z)) > 1);
}

function applyDuskGlow(G, neonAmt, combinedAmt, signDarkAmt) {
  // Dusk fade-in for emissives, lamp heads, light pools and sign glows.
  if (G.buildingMats) for (const matObj of G.buildingMats) matObj.emissiveIntensity = 0.7 * combinedAmt;
  if (G.neonTrimMats) for (const matObj of G.neonTrimMats) matObj.emissiveIntensity = 2.4 * neonAmt;
  if (G.streetlightGlows) for (const sprObj of G.streetlightGlows) sprObj.material.opacity = 0.85 * combinedAmt;
  if (G.lampHeadMat) G.lampHeadMat.emissiveIntensity = (3.0 * combinedAmt) + 0.15;
  if (G.lampPoolMat) G.lampPoolMat.opacity = 0.3 * combinedAmt;
  for (const sprObj of glowSpriteList) sprObj.material.opacity = 0.9 * signDarkAmt;
}

export function updateWorld(G, dt) {
  const hourVal = G.timeOfDay;
  const dayAmt = Math.max(0, Math.min(1, Math.sin(((hourVal + (-6)) / 12) * Math.PI)));
  const duskAmt = (Math.max(0, 1 + (-(Math.abs(hourVal + (-18.2)) / 1.6))) * (hourVal > 12 ? 1 : 0))
    + (Math.max(0, 1 + (-(Math.abs(hourVal + (-6.2)) / 1.2))) * 0.6);
  computeSkyColors(hourVal);
  if (skyDomeObj) {
    if (Math.abs(hourVal + (-skyHourPrev)) > 0.05) { paintSkyDome(); skyHourPrev = hourVal; }
  } else G.scene.background = skyHorTone;
  if (G.scene.fog) G.scene.fog.color.copy(skyFogTone);
  if (G.sun) {
    G.sun.intensity = 0.25 + (1.27 * dayAmt); G.sun.color.set(0xffd9b0);
    const sunAng = ((hourVal + (-6)) / 12) * Math.PI;
    G.sun.position.set(300 * Math.cos(sunAng), Math.max(20, 300 * Math.sin(sunAng)), 120);
  }
  if (G.hemi) {
    G.hemi.intensity = 0.25 + (0.65 * dayAmt);
    if (G.hemi.color) G.hemi.color.copy(skyTopTone).lerp(skyWarmTone, 0.3);
    if (G.hemi.groundColor) G.hemi.groundColor.set(0xb09a7a);
  }
  const nightAmt = 1 + (-dayAmt);
  const rampBetween = (loBound, hiBound) => Math.max(0, Math.min(1, (hourVal + (-loBound)) / Math.max(0.001, hiBound + (-loBound))));
  const duskGlowAmt = hourVal >= VICE.dusk.onset && hourVal < 24
    ? Math.max(rampBetween(VICE.dusk.onset, VICE.dusk.full), nightAmt) : nightAmt;
  const neonGlowAmt = hourVal >= VICE.dusk.neonOnset && hourVal < 24
    ? Math.max(rampBetween(VICE.dusk.neonOnset, VICE.dusk.full), nightAmt) : nightAmt;
  const combinedAmt = Math.max(nightAmt, duskGlowAmt);
  const signDarkAmt = Math.min(1, (0.9 * combinedAmt) + (0.35 * Math.min(1, Math.max(0, duskAmt))));
  applyDuskGlow(G, neonGlowAmt, combinedAmt, signDarkAmt);
  if (G.water) { const swayVal = 0.03 * Math.sin(G.elapsed || 0); G.water.position.y = swayVal + (-0.4); }
}
