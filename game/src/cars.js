// Vehicle factory: extruded body shells, canvas liveries, model swaps.
import * as THREE from 'three'; import { CARS } from './config.js';
import { rnd, rr, ri, pick } from './random.js'; import { groundH, glowSprite } from './world.js';
import { loadHeroAsset } from './assets.js';

const HEX_PAD_SIZE = 6;

export function hexCss(hexNum) { const rawTxt = hexNum.toString(16);
  const padTxt = rawTxt.padStart(HEX_PAD_SIZE, '0');
  const cssOut = `#${padTxt}`;
  return cssOut;
}

const ROOF_TALL_MAP = {};
ROOF_TALL_MAP['suv'] = 1.55;
ROOF_TALL_MAP['truck'] = 1.5;
ROOF_TALL_MAP['kei'] = 1.40;
const roofHLookup = (kindTxt) => {
  if (kindTxt === 'van') return ROOF_TALL_MAP.suv;
  return ROOF_TALL_MAP[kindTxt];
};
const topShellH = (specArg) => {
  const mappedVal = roofHLookup(specArg.body);
  if (mappedVal !== undefined) return mappedVal;
  let bonusVal;
  if (specArg.body === 'sedan' || specArg.body === 'wagon') bonusVal = 0.18;
  else bonusVal = 0;
  return bonusVal + 1.05;
};

const profileShapeSide = (specArg) => {
  const fullLen = specArg.len, halfLen = fullLen / 2;
  let hTop;
  hTop = topShellH(specArg);
  const yHood = 0.62 + specArg.hood * 0.28, yBelt = hTop * 0.72;
  const pathObj = new THREE.Shape();
  pathObj.moveTo(0.12 - halfLen, 0.18);
  pathObj.quadraticCurveTo(-0.02 - halfLen, 0.30, -halfLen, yBelt * 0.80);
  function drawFlatRoof() {
    pathObj.quadraticCurveTo(-halfLen, hTop * 0.97, 0.30 - halfLen, hTop);
    pathObj.lineTo(halfLen * (0.20 + specArg.cabin * 0.20), hTop);
    pathObj.quadraticCurveTo(halfLen * 0.75, hTop * 0.96, halfLen * 0.88, 0.10 + yHood);
  }
  function drawHatchRoof() {
    pathObj.quadraticCurveTo(0.05 - halfLen, hTop * 0.92, 0.35 - halfLen, hTop * 0.98);
    pathObj.quadraticCurveTo(
      fullLen * 0.28 - halfLen,
      hTop,
      fullLen * (0.32 + specArg.cabin * 0.18) - halfLen,
      hTop * 0.99,
    );
    pathObj.quadraticCurveTo(halfLen * 0.72, hTop * 0.9, halfLen * 0.86, 0.08 + yHood);
  }
  function drawFastRoof() {
    pathObj.bezierCurveTo(
      0.1 - halfLen,
      yBelt,
      fullLen * 0.3 - halfLen,
      hTop * 0.99,
      fullLen * (0.34 + specArg.cabin * 0.16) - halfLen,
      hTop,
    );
    pathObj.quadraticCurveTo(halfLen * 0.55, hTop * 0.97, halfLen * 0.84, 0.06 + yHood);
  }
  function drawPlainRoof() {
    pathObj.quadraticCurveTo(
      fullLen * 0.18 - halfLen,
      hTop * 0.99,
      fullLen * (0.3 + specArg.cabin * 0.16) - halfLen,
      hTop,
    );
    pathObj.quadraticCurveTo(halfLen * 0.45, hTop * 0.98, halfLen * 0.80, 0.1 + yHood);
    if (specArg.body === 'sedan' || specArg.body === 'roadster') {
      pathObj.quadraticCurveTo(halfLen * 0.9, 0.04 + yHood, halfLen * 0.94, yHood);
    }
  }
  let roofDrawer;
  if (specArg.roof === 'wagon' || specArg.body === 'van' || specArg.body === 'suv') roofDrawer = drawFlatRoof;
  else if (specArg.roof === 'hatch') roofDrawer = drawHatchRoof;
  else if (specArg.roof === 'fastback') roofDrawer = drawFastRoof;
  else roofDrawer = drawPlainRoof;
  roofDrawer();
  pathObj.quadraticCurveTo(0.04 + halfLen, yHood * 0.72, halfLen, 0.42);
  pathObj.quadraticCurveTo(-0.02 + halfLen, 0.2, halfLen - 0.3, 0.18);
  pathObj.lineTo(0.12 - halfLen, 0.18);
  pathObj.userData = {};
  pathObj.userData.tall = hTop;
  pathObj.userData.hoodY = yHood;
  pathObj.userData.beltY = yBelt;
  return pathObj;
};

const glassShape = (specArg) => {
  const fullLen = specArg.len;
  const halfLen = fullLen / 2;
  const kindTxt = specArg.body;
  let hTop;
  if (kindTxt === 'suv' || kindTxt === 'van') hTop = 1.55;
  else if (kindTxt === 'truck') hTop = 1.5;
  else if (kindTxt === 'kei') hTop = 1.40;
  else {
    let bonusVal;
    if (kindTxt === 'sedan' || kindTxt === 'wagon') bonusVal = 0.18;
    else bonusVal = 0;
    hTop = bonusVal + 1.05;
  }
  const yBelt = hTop * 0.72;
  const flatFlag = specArg.roof === 'wagon' || specArg.body === 'van' || specArg.body === 'suv';
  let xRear;
  if (flatFlag) xRear = 0.35 - halfLen;
  else if (specArg.roof === 'hatch') xRear = 0.55 - halfLen;
  else xRear = fullLen * (0.3 + specArg.cabin * 0.14) - halfLen;
  let xFront;
  if (specArg.roof === 'flat' && specArg.body !== 'kei') xFront = halfLen * 0.52;
  else xFront = halfLen * (0.35 + specArg.cabin * 0.15);
  const pathObj = new THREE.Shape();
  pathObj.moveTo(xRear, yBelt);
  pathObj.quadraticCurveTo(0.25 + xRear, hTop * 0.99, fullLen * 0.18 + xRear, hTop * 0.985);
  pathObj.quadraticCurveTo(xFront - 0.2, hTop * 0.97, xFront, 0.04 + yBelt);
  pathObj.lineTo(xRear, yBelt);
  return pathObj;
};

function sweepProfileGeo(pathObj, widthVal, thickBevel, sizeBevel) {
  const geoCfg = {};
  geoCfg.depth = Math.max(0.2, widthVal + -2 * sizeBevel);
  geoCfg.bevelEnabled = true;
  geoCfg.bevelThickness = thickBevel;
  geoCfg.bevelSize = sizeBevel;
  geoCfg.bevelSegments = 3;
  geoCfg.steps = 1;
  geoCfg.curveSegments = 12;
  const geoObj = new THREE.ExtrudeGeometry(pathObj, geoCfg);
  geoObj.translate(0, 0, sizeBevel - widthVal / 2);
  geoObj.rotateY(Math.PI / 2);
  return geoObj;
}

const liveryCanvasPaint = (kindTxt, fallbackVal) => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 512; canvasEl.height = 128;
  const ctxG = canvasEl.getContext('2d');
  ctxG.clearRect(0, 0, 512, 128);
  const paintersMap = {};
  paintersMap['police'] = function () { ctxG.fillStyle = '#f4f6f8';
      ctxG.fillRect(90, 18, 330, 78);
      ctxG.fillStyle = '#1c4f9c';
      ctxG.fillRect(0, 78, 512, 16);
      ctxG.fillStyle = '#14161a';
      ctxG.font = 'bold 52px sans-serif';
      ctxG.textAlign = 'center';
      ctxG.fillText('RBPD', 256, 72);
      ctxG.fillStyle = '#c8a028';
      ctxG.beginPath();
      ctxG.arc(120, 56, 20, 0, 6.3);
      ctxG.fill();
    };
  paintersMap['taxi'] = function () {
      for (let xCell = 0; xCell < 512; xCell += 24) {
        for (let yCell = 0; yCell < 2; ++yCell) {
          let cellCol;
          if ((xCell / 24 + yCell) % 2) cellCol = '#14161a';
          else cellCol = '#f4f6f8';
          ctxG.fillStyle = cellCol;
          ctxG.fillRect(xCell, 52 + yCell * 14, 24, 14);
        }
      }
    };
  paintersMap['hero-supra'] = function () { ctxG.fillStyle = '#14161a';
      ctxG.font = 'bold 26px sans-serif';
      ctxG.textAlign = 'center';
      ctxG.fillText('TEN-SECOND', 256, 66);
    };
  paintersMap['hero-gtr'] = function () { ctxG.fillStyle = '#c8ccd2';
      ctxG.fillRect(0, 56, 512, 14);
      ctxG.fillStyle = '#14161a';
      ctxG.font = 'bold 24px sans-serif';
      ctxG.textAlign = 'center';
      ctxG.fillText('BAYSIDE GHOST', 256, 46);
    };
  if (Object.prototype.hasOwnProperty.call(paintersMap, kindTxt)) paintersMap[kindTxt]();
  void fallbackVal;
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.colorSpace = THREE.SRGBColorSpace;
  return texObj;
};

export const makeCarMesh = (specArg, paintArg, optsArg) => {
  const optsBag = optsArg || {};
  let paintChosen;
  if (paintArg != null) paintChosen = paintArg;
  else paintChosen = specArg.color;
  const carRoot = new THREE.Group();
  const lengthVal = specArg.len,
    widthVal = specArg.wid;
  const isTruck = specArg.body === 'truck';
  let cabSpecObj;
  if (isTruck) cabSpecObj = { ...specArg, len: 2.2 };
  else cabSpecObj = specArg;
  const shellMatCfg = {};
  shellMatCfg.color = paintChosen;
  shellMatCfg.metalness = 0.55;
  shellMatCfg.roughness = 0.35;
  const shellMeshObj = new THREE.Mesh(
    sweepProfileGeo(profileShapeSide(cabSpecObj), widthVal, 0.09, 0.07),
    new THREE.MeshStandardMaterial(shellMatCfg),
  );
  const paintMatObj = shellMeshObj.material;
  carRoot.add(shellMeshObj);
  if (specArg.twoTone) {
    const bandMatCfg = {};
    bandMatCfg.color = 0x14161a;
    bandMatCfg.metalness = 0.4;
    bandMatCfg.roughness = 0.5;
    const bandMeshObj = new THREE.Mesh(
      new THREE.BoxGeometry(widthVal * 0.99, 0.34, lengthVal * 0.98),
      new THREE.MeshStandardMaterial(bandMatCfg));
    bandMeshObj.position.y = 0.3;
    carRoot.add(bandMeshObj);
  }
  if (isTruck) {
    const cargoMatCfg = {};
    cargoMatCfg.color = 0xd8d8d8;
    cargoMatCfg.roughness = 0.7;
    const cargoMeshObj = new THREE.Mesh(
      new THREE.BoxGeometry(widthVal, 2.1, 3.9),
      new THREE.MeshStandardMaterial(cargoMatCfg));
    cargoMeshObj.position.set(0, 1.45, -1.15);
    carRoot.add(cargoMeshObj);
    const panelMatCfg = {};
    panelMatCfg.color = 0x888888;
    panelMatCfg.transparent = true;
    panelMatCfg.opacity = 0.5;
    const panelMeshObj = new THREE.Mesh(
      new THREE.PlaneGeometry(widthVal * 0.7, 1.6),
      new THREE.MeshBasicMaterial(panelMatCfg));
    panelMeshObj.position.set(0, 1.45, -3.11);
    panelMeshObj.rotation.y = Math.PI;
    carRoot.add(panelMeshObj);
    shellMeshObj.position.z = lengthVal / 2 - 1.10;
  }
  const glassMatCfg = {};
  glassMatCfg.color = 0x10151c;
  glassMatCfg.metalness = 0.9;
  glassMatCfg.roughness = 0.12;
  const glassMeshObj = new THREE.Mesh(
    sweepProfileGeo(glassShape(cabSpecObj), widthVal * 0.86, 0.05, 0.04),
    new THREE.MeshStandardMaterial(glassMatCfg));
  if (isTruck) glassMeshObj.position.z = lengthVal / 2 - 1.1;
  carRoot.add(glassMeshObj);

  const trimMatCfg = {};
  trimMatCfg.color = 0x17181c;
  trimMatCfg.roughness = 0.7;
  const trimMatObj = new THREE.MeshStandardMaterial(trimMatCfg);
  const trimDarkAlias = trimMatObj;
  const paintAlias = paintMatObj;
  const rootAlias = carRoot;
  const specAliasObj = specArg;
  const lenAlias = lengthVal;
  const widAlias = widthVal;
  const optsAlias = optsBag;
  void trimDarkAlias;
  void paintAlias;
  void rootAlias;
  void specAliasObj;
  void lenAlias;
  void widAlias;
  void optsAlias;
  const sgnIterA = [-1, 1][Symbol.iterator]();
  let sgnStepA;
  while (!(sgnStepA = sgnIterA.next()).done) {
    const sgnVal = sgnStepA.value;
    const bumperMeshObj = new THREE.Mesh(
      new THREE.BoxGeometry(widthVal * 0.94, 0.2, 0.28),
      trimMatObj,
    );
    bumperMeshObj.position.set(0, 0.3, sgnVal * (lengthVal / 2 - 0.02));
    carRoot.add(bumperMeshObj);
    const skirtMeshObj = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.14, lengthVal * 0.55),
      trimMatObj,
    );
    skirtMeshObj.position.set(sgnVal * (widthVal / 2 - 0.01), 0.24, 0);
    carRoot.add(skirtMeshObj);
  }
  const sgnIterB = [-1, 1][Symbol.iterator]();
  let sgnStepB;
  while (!(sgnStepB = sgnIterB.next()).done) {
    const sgnVal = sgnStepB.value;
    const stalkMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), trimMatObj);
    stalkMeshObj.position.set(sgnVal * (0.04 + widthVal / 2), 1.0, lengthVal * 0.18);
    carRoot.add(stalkMeshObj);
    const mirrorMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), paintMatObj);
    mirrorMeshObj.position.set(sgnVal * (0.11 + widthVal / 2), 1.02, lengthVal * 0.18);
    carRoot.add(mirrorMeshObj);
  }

  const wheelKind = specArg.body;
  let tireRad;
  if (wheelKind === 'suv' || wheelKind === 'truck' || wheelKind === 'van') tireRad = 0.42;
  else if (wheelKind === 'kei') tireRad = 0.28;
  else if (wheelKind === 'sedan' || wheelKind === 'wagon') tireRad = 0.34;
  else tireRad = 0.33;
  const tireRadAlias = tireRad;
  void tireRadAlias;
  const baseLen = 0.62 * lengthVal;
  const tireGeo = new THREE.CylinderGeometry(tireRad, tireRad, 0.24, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const hubGeoObj = new THREE.CylinderGeometry(0.62 * tireRad, 0.62 * tireRad, 0.26, 12);
  hubGeoObj.rotateZ(Math.PI / 2);
  const tireMatCfg = {};
  tireMatCfg.color = 0x14161a;
  tireMatCfg.roughness = 0.9;
  const tireMat = new THREE.MeshStandardMaterial(tireMatCfg);
  const hubMatCfg = {};
  hubMatCfg.color = specArg.wheels || 0xc0c0c0;
  hubMatCfg.metalness = 0.85;
  hubMatCfg.roughness = 0.3;
  const hubMatObj = new THREE.MeshStandardMaterial(hubMatCfg);
  const pivotMap = {};
  const pivotAlias = pivotMap;
  void pivotAlias;
  const archGeoObj = new THREE.TorusGeometry(0.06 + tireRad, 0.045, 6, 14, Math.PI);
  const archMatCfg = {};
  archMatCfg.color = 0x0c0d0f;
  archMatCfg.roughness = 0.80;
  const archMatObj = new THREE.MeshStandardMaterial(archMatCfg);
  function mountWheel(keyName, sgnX, sgnZ) {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(sgnX * (widthVal / 2 - 0.02), tireRad, sgnZ * (baseLen / 2));
    carRoot.add(pivotGrp);
    pivotGrp.add(new THREE.Mesh(tireGeo, tireMat));
    pivotGrp.add(new THREE.Mesh(hubGeoObj, hubMatObj));
    for (let spokeIdx = 0; spokeIdx !== 5; spokeIdx += 1) {
      const spokeMeshObj = new THREE.Mesh(
        new THREE.BoxGeometry(0.27, tireRad * 0.16, tireRad * 0.9),
        hubMatObj,
      );
      spokeMeshObj.rotation.x = (spokeIdx / 5) * Math.PI;
      pivotGrp.add(spokeMeshObj);
    }
    const archMeshObj = new THREE.Mesh(archGeoObj, archMatObj);
    archMeshObj.position.set(sgnX * (0.03 + widthVal / 2), tireRad, sgnZ * (baseLen / 2));
    archMeshObj.rotation.y = Math.PI / 2;
    carRoot.add(archMeshObj);
    pivotMap[keyName] = pivotGrp;
    return pivotGrp;
  }
  const wheelSpecList = [];
  wheelSpecList.push(['fl', -1, 1]);
  wheelSpecList.push(['fr', 1, 1]);
  wheelSpecList.push(['rl', -1, -1]);
  wheelSpecList.push(['rr', 1, -1]);
  wheelSpecList.forEach(function (specPair) {
    const [keyName, sgnX, sgnZ] = specPair;
    mountWheel(keyName, sgnX, sgnZ);
  });

  const headMatCfg = {};
  headMatCfg.color = 0xfff2c0;
  headMatCfg.emissive = 0xffe9a0;
  headMatCfg.emissiveIntensity = 0.7;
  headMatCfg.roughness = 0.2;
  const headMatMain = new THREE.MeshStandardMaterial(headMatCfg);
  const headAlias = headMatMain;
  void headAlias;
  const signList = [-1, 1];
  const signAlias = signList;
  void signAlias;
  if (specArg.popups) {
    const sgnIterC = [-1, 1][Symbol.iterator]();
    let sgnStepC;
    while (!(sgnStepC = sgnIterC.next()).done) {
      const sgnVal = sgnStepC.value;
      const popupMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), headMatMain);
      popupMeshObj.position.set(sgnVal * widthVal * 0.28, 0.86, lengthVal / 2 - 0.32);
      popupMeshObj.rotation.x = -0.25;
      carRoot.add(popupMeshObj);
    }
  } else { const sgnIterD = [-1, 1][Symbol.iterator]();
    let sgnStepD;
    while (!(sgnStepD = sgnIterD.next()).done) {
      const sgnVal = sgnStepD.value;
      const lampMeshObj = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), headMatMain);
      lampMeshObj.scale.set(1.5, 0.55, 0.5);
      lampMeshObj.position.set(sgnVal * widthVal * 0.3, 0.72, lengthVal / 2 - 0.05);
      carRoot.add(lampMeshObj);
    }
  }
  const tailMatCfg = {};
  tailMatCfg.color = 0x881111;
  tailMatCfg.emissive = 0xff2222;
  tailMatCfg.emissiveIntensity = 0.80;
  const tailMatMain = new THREE.MeshStandardMaterial(tailMatCfg);
  const tailAlias = tailMatMain;
  void tailAlias;
  if (specArg.roundTail) {
    let unitCount;
    if (specArg.tail === 'quadWing') unitCount = 4;
    else unitCount = 2;
    let unitIdx = 0;
    while (unitIdx < unitCount) {
      const unitGeoObj = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12);
      unitGeoObj.rotateX(Math.PI / 2);
      const unitMeshObj = new THREE.Mesh(unitGeoObj, tailMatMain);
      unitMeshObj.position.set((unitIdx - (unitCount - 1) / 2) * 0.24, 0.78, -lengthVal / 2 - 0.02);
      carRoot.add(unitMeshObj);
      unitIdx += 1;
    }
  } else { const barMeshObj = new THREE.Mesh(
      new THREE.BoxGeometry(widthVal * 0.7, 0.09, 0.05),
      tailMatMain,
    );
    barMeshObj.position.set(0, 0.78, -lengthVal / 2 - 0.02);
    carRoot.add(barMeshObj);
  }
  carRoot.userData.tailMat = tailMatMain;
  carRoot.userData.headMat = headMatMain;

  const tailKindTxt = specArg.tail;
  const wingFlag = tailKindTxt === 'roundWing' || tailKindTxt === 'quadWing' || tailKindTxt === 'wing';
  if (wingFlag) {
    let bladeGeo;
    if (tailKindTxt === 'roundWing') bladeGeo = new THREE.TorusGeometry(widthVal * 0.42, 0.045, 6, 16, Math.PI);
    else bladeGeo = new THREE.BoxGeometry(widthVal * 0.88, 0.05, 0.3);
    const bladeMeshObj = new THREE.Mesh(bladeGeo, trimMatObj);
    if (tailKindTxt === 'roundWing') {
      bladeMeshObj.rotation.z = 0;
      bladeMeshObj.rotation.y = Math.PI / 2;
      bladeMeshObj.rotation.x = Math.PI;
      bladeMeshObj.scale.set(1, 1, 0.4);
      bladeMeshObj.position.set(0, 1.12, 0.1 + -lengthVal / 2);
    } else {
      bladeMeshObj.position.set(0, 1.18, 0.08 + -lengthVal / 2);
      bladeMeshObj.rotation.x = -0.12;
    }
    carRoot.add(bladeMeshObj);
    const sgnIterE = signList[Symbol.iterator]();
    let sgnStepE;
    while (!(sgnStepE = sgnIterE.next()).done) {
      const sgnVal = sgnStepE.value;
      const strutMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), trimMatObj);
      strutMeshObj.position.set(sgnVal * widthVal * 0.3, 1.0, 0.1 + -lengthVal / 2);
      carRoot.add(strutMeshObj);
    }
  } else if (tailKindTxt === 'ducktail' || tailKindTxt === 'lip') {
    let lipDepth;
    if (tailKindTxt === 'ducktail') lipDepth = 0.28;
    else lipDepth = 0.14;
    const lipMeshObj = new THREE.Mesh(
      new THREE.BoxGeometry(widthVal * 0.80, 0.06, lipDepth),
      paintMatObj,
    );
    lipMeshObj.position.set(0, 0.98, 0.08 + -lengthVal / 2);
    if (tailKindTxt === 'ducktail') lipMeshObj.rotation.x = -0.35;
    else lipMeshObj.rotation.x = -0.15;
    carRoot.add(lipMeshObj);
  }

  const liveryTxt = optsBag.livery || specArg.livery;
  if (liveryTxt) {
    let liveryArg;
    if (liveryTxt === 'hero-supra' || liveryTxt === 'hero-gtr') liveryArg = liveryTxt;
    else liveryArg = liveryTxt;
    const liveryTexObj = liveryCanvasPaint(liveryArg, paintChosen);
    const sgnIterF = signList[Symbol.iterator]();
    let sgnStepF;
    while (!(sgnStepF = sgnIterF.next()).done) {
      const sgnVal = sgnStepF.value;
      const decalMatCfg = {};
      decalMatCfg.map = liveryTexObj;
      decalMatCfg.transparent = true;
      const decalMeshObj = new THREE.Mesh(
        new THREE.PlaneGeometry(lengthVal * 0.72, 0.55),
        new THREE.MeshBasicMaterial(decalMatCfg),
      );
      decalMeshObj.position.set(sgnVal * (0.085 + widthVal / 2), 0.62, 0);
      if (sgnVal > 0) decalMeshObj.rotation.y = Math.PI / 2;
      else decalMeshObj.rotation.y = -Math.PI / 2;
      carRoot.add(decalMeshObj);
    }
    if (specArg.id === 'hero-supra' || liveryTxt === 'hero-supra') {
      const hoodMeshObj = new THREE.Mesh(
        new THREE.BoxGeometry(widthVal * 0.9, 0.03, lengthVal * 0.3),
        trimMatObj,
      );
      hoodMeshObj.position.set(0, 0.93, lengthVal * 0.28);
      carRoot.add(hoodMeshObj);
    }
  }
  if (specArg.lightbar) {
    const footMeshObj = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.3), trimMatObj);
    footMeshObj.position.set(0, 1.32, 0.1);
    carRoot.add(footMeshObj);
    const redMatCfg = {};
    redMatCfg.color = 0xff2222;
    redMatCfg.emissive = 0xff2222;
    redMatCfg.emissiveIntensity = 1.40;
    const redMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28),
      new THREE.MeshStandardMaterial(redMatCfg));
    redMeshObj.position.set(-0.28, 1.40, 0.1);
    carRoot.add(redMeshObj);
    const blueMatCfg = {};
    blueMatCfg.color = 0x2255ff;
    blueMatCfg.emissive = 0x2255ff;
    blueMatCfg.emissiveIntensity = 1.40;
    const blueMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28),
      new THREE.MeshStandardMaterial(blueMatCfg));
    blueMeshObj.position.set(0.28, 1.4, 0.1);
    carRoot.add(blueMeshObj);
    const glowRed = glowSprite(0xff3344, 2.4);
    glowRed.position.set(-0.28, 1.45, 0.1);
    carRoot.add(glowRed);
    const glowBlue = glowSprite(0x3366ff, 2.4);
    glowBlue.position.set(0.28, 1.45, 0.1);
    carRoot.add(glowBlue);
    carRoot.userData.lightbar = {};
    carRoot.userData.lightbar.red = redMeshObj;
    carRoot.userData.lightbar.blue = blueMeshObj;
    carRoot.userData.lightbar.gr = glowRed;
    carRoot.userData.lightbar.gb = glowBlue;
  }
  if (liveryTxt === 'taxi') {
    const signMatCfg = {};
    signMatCfg.color = 0xfff2c0;
    signMatCfg.emissive = 0xffe9a0;
    signMatCfg.emissiveIntensity = 0.9;
    const signMeshObj = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3),
      new THREE.MeshStandardMaterial(signMatCfg));
    signMeshObj.position.set(0, 1.36, 0.1);
    carRoot.add(signMeshObj);
  }
  underglowAdd(carRoot, specArg, optsBag);
  blobShadowAdd(carRoot, specArg);
  carRoot.userData.wheels = pivotMap;
  carRoot.userData.wheelR = tireRad;
  return carRoot;
};

const gatherPoliceKeep = (rootIn, dataIn, wheelsFallback) => {
  const keepSetObj = new Set();
  const wheelMap = dataIn.wheels || wheelsFallback || {};
  const wheelIter = Object.values(wheelMap)[Symbol.iterator]();
  let wheelStep;
  while (!(wheelStep = wheelIter.next()).done) {
    const wheelItem = wheelStep.value;
    if (wheelItem) keepSetObj.add(wheelItem);
  }
  const barPartArr = [];
  const barObj = dataIn.lightbar || null;
  if (barObj) {
    const keyList = [];
    keyList.push('red');
    keyList.push('blue');
    keyList.push('gr');
    keyList.push('gb');
    const keyIter = keyList[Symbol.iterator]();
    let keyStep;
    while (!(keyStep = keyIter.next()).done) {
      const keyName = keyStep.value;
      if (barObj[keyName]) barPartArr.push(barObj[keyName]);
    }
  }
  if (dataIn.barRed) barPartArr.push(dataIn.barRed);
  if (dataIn.barBlue) barPartArr.push(dataIn.barBlue);
  const partIter = barPartArr[Symbol.iterator]();
  let partStep;
  while (!(partStep = partIter.next()).done) keepSetObj.add(partStep.value);
  let footMeshObj = null;
  const refMeshObj =
    barPartArr.find(function (partItem) {
      return partItem &&
        partItem.position &&
        partItem.geometry &&
        partItem.geometry.type === 'BoxGeometry';
    }) || barPartArr[0];
  if (refMeshObj) {
    const childIter = rootIn.children[Symbol.iterator]();
    let childStep;
    while (!(childStep = childIter.next()).done) {
      const childItem = childStep.value;
      if (keepSetObj.has(childItem) || !childItem.isMesh || !childItem.position) continue;
      const zMatch = Math.abs(childItem.position.z - refMeshObj.position.z) < 0.01;
      const underFlag =
        childItem.position.y < refMeshObj.position.y &&
        refMeshObj.position.y - childItem.position.y < 0.2;
      if (zMatch && underFlag) {
        footMeshObj = childItem; break;
      }
    }
  }
  if (footMeshObj) keepSetObj.add(footMeshObj);
  const childIterB = rootIn.children[Symbol.iterator]();
  let childStepB;
  while (!(childStepB = childIterB.next()).done) {
    const childItem = childStepB.value;
    childItem.isSprite
      ? keepSetObj.add(childItem)
      : childItem.isMesh && childItem.geometry && childItem.geometry.type === 'PlaneGeometry' && Math.abs(childItem.rotation.x + Math.PI / 2) < 0.01
        ? keepSetObj.add(childItem)
        : null;
  }
  const keepOut = {};
  keepOut.keepSet = keepSetObj;
  keepOut.wheelsByKey = wheelMap;
  keepOut.barPartList = barPartArr;
  keepOut.baseBoxMesh = footMeshObj;
  keepOut.refBarMesh = refMeshObj;
  return keepOut;
};

export const applyNpcPoliceGlb = (vehIn) => {
  try { if (!vehIn || vehIn.glbSwapped) return;
    const rootIn = vehIn.mesh || vehIn;
    if (!rootIn || !rootIn.children || !rootIn.userData) return;
    vehIn.glbSwapped = true;
    if (rootIn !== vehIn) rootIn.userData.glbSwapped = true;
    loadHeroAsset('npcPolice').then(function (wrapIn) {
        try { if (!wrapIn) {
            vehIn.glbSwapped = false;
            if (rootIn !== vehIn) rootIn.userData.glbSwapped = false; return;
          }
          const dataIn = rootIn.userData;
          const gatheredObj = gatherPoliceKeep(rootIn, dataIn, vehIn.wheels);
          const keepSetObj = gatheredObj.keepSet;
          const wheelMap = gatheredObj.wheelsByKey;
          const barPartArr = gatheredObj.barPartList;
          const footMeshObj = gatheredObj.baseBoxMesh;
          const refMeshObj = gatheredObj.refBarMesh;
          [...grp.children].forEach(function (childItem) {
            if (!keepSetObj.has(childItem)) childItem.visible = false;
          });
          let cloneIn;
          if (wrapIn.clone) cloneIn = wrapIn.clone(true);
          else cloneIn = wrapIn;
          cloneIn.position.set(0, 0, 0);
          rootIn.add(cloneIn);
          dataIn.npcPoliceGlb = cloneIn;
          const wheelIter = Object.values(wheelMap)[Symbol.iterator]();
          let wheelStep;
          while (!(wheelStep = wheelIter.next()).done) {
            const wheelItem = wheelStep.value;
            if (wheelItem && wheelItem.position) {
              const isFront = !(wheelItem.position.z < 0);
              if (isFront) wheelItem.position.z = 1.31;
              else wheelItem.position.z = -1.55;
              if (wheelItem.position.x < 0) wheelItem.position.x = -0.80;
              else wheelItem.position.x = 0.80;
            }
          }
          let liftArr;
          if (footMeshObj) liftArr = [footMeshObj, ...barPartArr];
          else liftArr = barPartArr;
          if (liftArr.length) {
            const liftYVal = footMeshObj ? 1.4 - footMeshObj.position.y : refMeshObj ? 1.48 - refMeshObj.position.y : 0;
            if (liftYVal) {
              const partIter = liftArr[Symbol.iterator]();
              let partStep;
              while (!(partStep = partIter.next()).done) {
                const partItem = partStep.value;
                if (partItem && partItem.position) partItem.position.y = partItem.position.y + liftYVal;
              }
            }
          }
        } catch (e) { void e; }
      }).catch(function () { vehIn.glbSwapped = false; });
  } catch (e) { void e; }
};

export const applyLuminanceTint = (rootIn, tintArg) => {
  if (!rootIn) return;
  function retintFn(matIn) {
    const matClone = matIn.clone();
    matClone.onBeforeCompile = function (shaderObj) {
      shaderObj.uniforms.uTint = { value: new THREE.Color(tintArg) };
      const fragParts = [];
      fragParts.push('#include <map_fragment>');
      fragParts.push('float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));');
      fragParts.push('diffuseColor.rgb = uTint * (0.22 + 1.05 * lum);');
      let fragTxt = shaderObj.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint;');
      fragTxt = fragTxt.replace('#include <map_fragment>', fragParts.join('\n'));
      shaderObj.fragmentShader = fragTxt;
    };
    matClone.customProgramCacheKey = function () { return 'npc-luminance-tint'; };
    return matClone;
  }
  rootIn.traverse(function (nodeItem) {
    if (!nodeItem.isMesh || !nodeItem.material) return;
    if (Array.isArray(nodeItem.material)) nodeItem.material = nodeItem.material.map(retintFn);
    else nodeItem.material = retintFn(nodeItem.material);
  });
};

export const applyNpcSedanGlb = (vehIn, tintArg) => {
  try { if (!vehIn || vehIn.glbSwapped) return;
    const rootIn = vehIn.mesh || vehIn;
    if (!rootIn || !rootIn.children || !rootIn.userData) return;
    vehIn.glbSwapped = true;
    if (rootIn !== vehIn) rootIn.userData.glbSwapped = true;
    loadHeroAsset('npcSedan').then(function (wrapIn) {
        try { if (!wrapIn) {
            vehIn.glbSwapped = false;
            if (rootIn !== vehIn) rootIn.userData.glbSwapped = false; return;
          }
          const dataIn = rootIn.userData;
          const keepSetObj = new Set();
          const wheelMap = dataIn.wheels || vehIn.wheels || {};
          const wheelIter = Object.values(wheelMap)[Symbol.iterator]();
          let wheelStep;
          while (!(wheelStep = wheelIter.next()).done) {
            const wheelItem = wheelStep.value;
            if (wheelItem) keepSetObj.add(wheelItem);
          }
          const childIter = rootIn.children[Symbol.iterator]();
          let childStep;
          while (!(childStep = childIter.next()).done) {
            const childItem = childStep.value;
            childItem.isSprite
              ? keepSetObj.add(childItem)
              : childItem.isMesh && childItem.geometry && childItem.geometry.type === 'PlaneGeometry' && Math.abs(childItem.rotation.x + Math.PI / 2) < 0.01
                ? keepSetObj.add(childItem)
                : null;
          }
          [...grp.children].forEach(function (childItem) {
            if (!keepSetObj.has(childItem)) childItem.visible = false;
          });
          let cloneIn;
          if (wrapIn.clone) cloneIn = wrapIn.clone(true);
          else cloneIn = wrapIn;
          cloneIn.position.set(0, 0, 0);
          cloneIn.rotation.y = -Math.PI / 2;
          applyLuminanceTint(cloneIn, tintArg);
          cloneIn.traverse(function (nodeItem) {
            if (nodeItem && nodeItem.isMesh) nodeItem.castShadow = true;
          });
          rootIn.add(cloneIn);
          dataIn.npcSedanGlb = cloneIn;
          const wheelIterB = Object.values(wheelMap)[Symbol.iterator]();
          let wheelStepB;
          while (!(wheelStepB = wheelIterB.next()).done) {
            const wheelItem = wheelStepB.value;
            if (wheelItem && wheelItem.position) {
              const isFront = !(wheelItem.position.z < 0);
              if (isFront) wheelItem.position.z = 1.19;
              else wheelItem.position.z = -1.66;
              if (wheelItem.position.x < 0) wheelItem.position.x = -0.80;
              else wheelItem.position.x = 0.80;
            }
          }
        } catch (e) { void e; }
      }).catch(function () { vehIn.glbSwapped = false; });
  } catch (e) { void e; }
};

export const applyNpcTaxiGlb = (vehIn) => {
  try { if (!vehIn || vehIn.glbSwapped) return;
    const rootIn = vehIn.mesh || vehIn;
    if (!rootIn || !rootIn.children || !rootIn.userData) return;
    vehIn.glbSwapped = true;
    if (rootIn !== vehIn) rootIn.userData.glbSwapped = true;
    loadHeroAsset('npcTaxi').then(function (wrapIn) {
        try { if (!wrapIn) {
            vehIn.glbSwapped = false;
            if (rootIn !== vehIn) rootIn.userData.glbSwapped = false; return;
          }
          const dataIn = rootIn.userData;
          const keepSetObj = new Set();
          const wheelMap = dataIn.wheels || vehIn.wheels || {};
          const wheelIter = Object.values(wheelMap)[Symbol.iterator]();
          let wheelStep;
          while (!(wheelStep = wheelIter.next()).done) {
            const wheelItem = wheelStep.value;
            if (wheelItem) keepSetObj.add(wheelItem);
          }
          const childIter = rootIn.children[Symbol.iterator]();
          let childStep;
          while (!(childStep = childIter.next()).done) {
            const childItem = childStep.value;
            childItem.isSprite
              ? keepSetObj.add(childItem)
              : childItem.isMesh && childItem.geometry && childItem.geometry.type === 'PlaneGeometry' && Math.abs(childItem.rotation.x + Math.PI / 2) < 0.01
                ? keepSetObj.add(childItem)
                : null;
          }
          [...grp.children].forEach(function (childItem) {
            if (!keepSetObj.has(childItem)) childItem.visible = false;
          });
          let cloneIn;
          if (wrapIn.clone) cloneIn = wrapIn.clone(true);
          else cloneIn = wrapIn;
          cloneIn.position.set(0, 0, 0);
          cloneIn.traverse(function (nodeItem) {
            if (nodeItem && nodeItem.isMesh) nodeItem.castShadow = true;
          });
          rootIn.add(cloneIn);
          dataIn.npcTaxiGlb = cloneIn;
          const wheelIterB = Object.values(wheelMap)[Symbol.iterator]();
          let wheelStepB;
          while (!(wheelStepB = wheelIterB.next()).done) {
            const wheelItem = wheelStepB.value;
            if (wheelItem && wheelItem.position) {
              const isFront = !(wheelItem.position.z < 0);
              if (isFront) wheelItem.position.z = 1.20;
              else wheelItem.position.z = -1.34;
              if (wheelItem.position.x < 0) wheelItem.position.x = -0.80;
              else wheelItem.position.x = 0.80;
            }
          }
        } catch (e) { void e; }
      }).catch(function () { vehIn.glbSwapped = false; });
  } catch (e) { void e; }
};

const underglowAdd = (rootIn, specArg, optsArg) => {
  let glowTint;
  if (optsArg && optsArg.glow !== undefined) glowTint = optsArg.glow;
  else glowTint = specArg.glow;
  if (!glowTint) return;
  const canvasEl = document.createElement('canvas');
  canvasEl.width = canvasEl.height = 128;
  const ctxG = canvasEl.getContext('2d');
  const gradObj = ctxG.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradObj.addColorStop(0, 'rgba(255,255,255,.9)');
  gradObj.addColorStop(1, 'rgba(255,255,255,0)');
  ctxG.fillStyle = gradObj;
  ctxG.fillRect(0, 0, 128, 128);
  const glowMatCfg = {};
  glowMatCfg.map = new THREE.CanvasTexture(canvasEl);
  glowMatCfg.color = glowTint;
  glowMatCfg.transparent = true;
  glowMatCfg.opacity = 0.25;
  glowMatCfg.blending = THREE.AdditiveBlending;
  glowMatCfg.depthWrite = false;
  const glowMeshObj = new THREE.Mesh(
    new THREE.PlaneGeometry(specArg.wid * 1.25, specArg.len * 1.25),
    new THREE.MeshBasicMaterial(glowMatCfg),
  );
  glowMeshObj.rotation.x = -Math.PI / 2;
  glowMeshObj.position.y = 0.06;
  rootIn.add(glowMeshObj);
};
const blobShadowAdd = (rootIn, specArg) => {
  const blobMatCfg = {};
  blobMatCfg.color = 0x000000;
  blobMatCfg.transparent = true;
  blobMatCfg.opacity = 0.32;
  blobMatCfg.depthWrite = false;
  const blobMeshObj = new THREE.Mesh(
    new THREE.PlaneGeometry(specArg.wid + 0.5, specArg.len + 0.5),
    new THREE.MeshBasicMaterial(blobMatCfg),
  );
  blobMeshObj.rotation.x = -Math.PI / 2;
  blobMeshObj.position.y = 0.03;
  rootIn.add(blobMeshObj);
};

const HERO_IDS_SET = new Set(['taiyo', 'hero-supra']);
const heroQueue = [];
let heroDoneFlag = false;
let heroTplObj = null;
function fillGlbCar(rootIn, specArg, optsArg) {
  rootIn.add(heroTplObj.clone(true));
  underglowAdd(rootIn, specArg, optsArg);
  blobShadowAdd(rootIn, specArg);
  const pivotMap = {};
  const pivotSpecs = [];
  pivotSpecs.push(['fl', -1, 1]);
  pivotSpecs.push(['fr', 1, 1]);
  pivotSpecs.push(['rl', -1, -1]);
  pivotSpecs.push(['rr', 1, -1]);
  const specIter = pivotSpecs[Symbol.iterator]();
  let specStep;
  while (!(specStep = specIter.next()).done) {
    const [keyName, sgnX, sgnZ] = specStep.value;
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(0.80 * sgnX, 0.34, 1.42 * sgnZ);
    rootIn.add(pivotGrp);
    pivotMap[keyName] = pivotGrp;
  }
  rootIn.userData.wheels = pivotMap;
  rootIn.userData.wheelR = 0.34;
  rootIn.userData.tailMat = null;
  rootIn.userData.headMat = null;
  rootIn.userData.visualMode = 'glb';
  return rootIn;
}
function makeGlbCarMesh(specArg, optsArg) { return fillGlbCar(new THREE.Group(), specArg, optsArg); }

function heroSwapGlb(itemIn) {
  try { const vehIn = itemIn.v;
    if (!vehIn || !vehIn.mesh || !vehIn.mesh.parent) return;
    if (vehIn.mesh.userData.visualMode === 'glb') return;
    if (!vehIn._procChildren) {
      for (; vehIn.mesh.children.length;) vehIn.mesh.remove(vehIn.mesh.children[0]);
    } else { const childIter = [...vehIn.mesh.children][Symbol.iterator]();
      let childStep;
      while (!(childStep = childIter.next()).done) {
        const childItem = childStep.value;
        if (vehIn._procChildren.has(childItem)) vehIn.mesh.remove(childItem);
      }
    }
    fillGlbCar(vehIn.mesh, itemIn.spec, { glow: itemIn.glow });
    vehIn.wheels = vehIn.mesh.userData.wheels;
    vehIn._procChildren = null;
  } catch (e) { void e; }
}
try { loadHeroAsset('heroCar').then(function (wrapIn) {
      try { heroDoneFlag = true;
        if (!wrapIn) { heroQueue.length = 0; return; }
        heroTplObj = wrapIn;
        heroQueue.splice(0).forEach(function (itemIn) { heroSwapGlb(itemIn); });
      } catch (e) { void e; }
    }).catch(function () { heroDoneFlag = true; heroQueue.length = 0; });
} catch (e) { heroDoneFlag = true; }

const gtrPaintApply = (rootIn) => {
  if (!rootIn) return;
  function repaintFn(matIn) {
    const matClone = matIn.clone();
    matClone.onBeforeCompile = function (shaderObj) {
      let vertTxt = shaderObj.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;');
      vertTxt = vertTxt.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
      shaderObj.vertexShader = vertTxt;
      const fragParts = [];
      fragParts.push('#include <map_fragment>');
      fragParts.push('vec3 gtrBase = diffuseColor.rgb;');
      fragParts.push('vec3 gtrKit = mix(gtrBase * 0.25, vec3(0.012, 0.012, 0.014), 0.75);');
      fragParts.push('vec3 gtrStripe = vec3(0.85, 0.04, 0.05);');
      fragParts.push('vec3 gtrUpper = gtrBase * 1.18;');
      fragParts.push('float gtrToStripe = smoothstep(0.095 - 0.006, 0.095 + 0.006, vLocalY);');
      fragParts.push('float gtrToUpper = smoothstep(0.125 - 0.006, 0.125 + 0.006, vLocalY);');
      fragParts.push('diffuseColor.rgb = mix(mix(gtrKit, gtrStripe, gtrToStripe), gtrUpper, gtrToUpper);');
      let fragTxt = shaderObj.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;');
      fragTxt = fragTxt.replace('#include <map_fragment>', fragParts.join('\n'));
      shaderObj.fragmentShader = fragTxt;
    };
    matClone.customProgramCacheKey = function () { return 'gtr35-livery'; };
    return matClone;
  }
  rootIn.traverse(function (nodeItem) {
    if (!nodeItem.isMesh || !nodeItem.material) return;
    if (Array.isArray(nodeItem.material)) nodeItem.material = nodeItem.material.map(repaintFn);
    else nodeItem.material = repaintFn(nodeItem.material);
  });
};
const GTR_IDS_SET = new Set(['gtr35']);
const gtrQueue = [];
let gtrDoneFlag = false;
let gtrTplObj = null;
function fillGtrCar(rootIn, specArg, optsArg) {
  const cloneIn = gtrTplObj.clone(true);
  cloneIn.rotation.y = 0;
  gtrPaintApply(cloneIn);
  rootIn.add(cloneIn);
  underglowAdd(rootIn, specArg, optsArg);
  blobShadowAdd(rootIn, specArg);
  const pivotMap = {};
  const pivotSpecs = [];
  pivotSpecs.push(['fl', -0.80, 1.41]);
  pivotSpecs.push(['fr', 0.80, 1.41]);
  pivotSpecs.push(['rl', -0.8, -1.55]);
  pivotSpecs.push(['rr', 0.8, -1.55]);
  const specIter = pivotSpecs[Symbol.iterator]();
  let specStep;
  while (!(specStep = specIter.next()).done) {
    const [keyName, xPos, zPos] = specStep.value;
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(xPos, 0.35, zPos);
    rootIn.add(pivotGrp);
    pivotMap[keyName] = pivotGrp;
  }
  rootIn.userData.wheels = pivotMap;
  rootIn.userData.wheelR = 0.35;
  rootIn.userData.tailMat = null;
  rootIn.userData.headMat = null;
  rootIn.userData.visualMode = 'glb';
  return rootIn;
}
function makeGtrCarMesh(specArg, optsArg) { return fillGtrCar(new THREE.Group(), specArg, optsArg); }
function gtrSwapGlb(itemIn) {
  try { const vehIn = itemIn.v;
    if (!vehIn || !vehIn.mesh || !vehIn.mesh.parent) return;
    if (vehIn.mesh.userData.visualMode === 'glb') return;
    if (!vehIn._procChildren) {
      for (; vehIn.mesh.children.length;) vehIn.mesh.remove(vehIn.mesh.children[0]);
    } else { const childIter = [...vehIn.mesh.children][Symbol.iterator]();
      let childStep;
      while (!(childStep = childIter.next()).done) {
        const childItem = childStep.value;
        if (vehIn._procChildren.has(childItem)) vehIn.mesh.remove(childItem);
      }
    }
    fillGtrCar(vehIn.mesh, itemIn.spec, { glow: itemIn.glow });
    vehIn.wheels = vehIn.mesh.userData.wheels;
    vehIn._procChildren = null;
  } catch (e) { void e; }
}
try { loadHeroAsset('gtr35').then(function (wrapIn) {
      try { gtrDoneFlag = true;
        if (!wrapIn) { gtrQueue.length = 0; return; }
        gtrTplObj = wrapIn;
        gtrQueue.splice(0).forEach(function (itemIn) { gtrSwapGlb(itemIn); });
      } catch (e) { void e; }
    }).catch(function () { gtrDoneFlag = true; gtrQueue.length = 0; });
} catch (e) { gtrDoneFlag = true; }

const svjTailTextureBuild = () => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256; canvasEl.height = 84;
  const ctxG = canvasEl.getContext('2d');
  ctxG.clearRect(0, 0, 256, 84);
  ctxG.strokeStyle = '#ff1e1e';
  ctxG.lineWidth = 15;
  ctxG.lineCap = 'round';
  ctxG.lineJoin = 'round';
  ctxG.shadowColor = '#ff1e1e';
  ctxG.shadowBlur = 8;
  ctxG.beginPath();
  ctxG.moveTo(28, 8);
  ctxG.lineTo(128, 46);
  ctxG.moveTo(228, 8);
  ctxG.lineTo(128, 46);
  ctxG.moveTo(128, 46);
  ctxG.lineTo(128, 76);
  ctxG.stroke();
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.colorSpace = THREE.SRGBColorSpace;
  return texObj;
};

const svjFixesApply = (wrapIn, vehIn, parentIn) => {
  const outcomeObj = {};
  outcomeObj.tailMat = null;
  outcomeObj.drlMat = null;
  if (!wrapIn) return outcomeObj;
  const hostGrpObj = parentIn || wrapIn;

  wrapIn.traverse(function (nodeItem) {
    if (!nodeItem.isMesh || !nodeItem.material) return;
    function matteFn(matIn) {
      const matClone = matIn.clone();
      matClone.roughness = 0.58;
      matClone.metalness = 0.3;
      matClone.onBeforeCompile = function (shaderObj) {
        shaderObj.fragmentShader = shaderObj.fragmentShader.replace('#include <map_fragment>', [
            '#include <map_fragment>', 'diffuseColor.rgb = mix(diffuseColor.rgb * 0.30, vec3(0.016, 0.016, 0.018), 0.78);',
          ].join('\n'));
      };
      matClone.customProgramCacheKey = function () { return 'svj-matte'; };
      return matClone;
    }
    if (Array.isArray(nodeItem.material)) nodeItem.material = nodeItem.material.map(matteFn);
    else nodeItem.material = matteFn(nodeItem.material);
  });

  const canopyPathObj = new THREE.Shape();
  canopyPathObj.moveTo(0.55, 0.8);
  canopyPathObj.lineTo(-0.35, 1.1);
  canopyPathObj.lineTo(-1.05, 1.08);
  canopyPathObj.lineTo(-1.45, 0.82);
  canopyPathObj.lineTo(-1.45, 0.74);
  canopyPathObj.lineTo(0.55, 0.74);
  canopyPathObj.closePath();
  const canopyGeoCfg = {};
  canopyGeoCfg.depth = 1.24;
  canopyGeoCfg.bevelEnabled = true;
  canopyGeoCfg.bevelThickness = 0.03;
  canopyGeoCfg.bevelSize = 0.03;
  canopyGeoCfg.bevelSegments = 2;
  canopyGeoCfg.steps = 1;
  const canopyGeoObj = new THREE.ExtrudeGeometry(canopyPathObj, canopyGeoCfg);
  canopyGeoObj.rotateY(-Math.PI / 2);
  canopyGeoObj.translate(0.62, 0, 0);
  const canopyMatCfg = {};
  canopyMatCfg.color = 0x0d1216;
  canopyMatCfg.specular = 0xbdd3e0;
  canopyMatCfg.shininess = 90;
  canopyMatCfg.transparent = true;
  canopyMatCfg.opacity = 0.97;
  hostGrpObj.add(new THREE.Mesh(canopyGeoObj, new THREE.MeshPhongMaterial(canopyMatCfg)));
  const tailTexObj = svjTailTextureBuild();
  const tailMatCfg = {};
  tailMatCfg.color = 0x000000;
  tailMatCfg.emissive = 0xffffff;
  tailMatCfg.emissiveMap = tailTexObj;
  tailMatCfg.map = tailTexObj;
  tailMatCfg.transparent = true;
  tailMatCfg.emissiveIntensity = 1.1;
  const tailMatMain = new THREE.MeshStandardMaterial(tailMatCfg);
  const sgnIterA = [-1, 1][Symbol.iterator]();
  let sgnStepA;
  while (!(sgnStepA = sgnIterA.next()).done) {
    const sgnVal = sgnStepA.value;
    const tailMeshObj = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.28), tailMatMain);
    tailMeshObj.position.set(0.56 * sgnVal, 0.8, -2.46);
    tailMeshObj.rotation.y = Math.PI;
    hostGrpObj.add(tailMeshObj);
    const glowTail = glowSprite(0xff2a22, 1.1);
    glowTail.position.set(0.56 * sgnVal, 0.8, -2.52);
    hostGrpObj.add(glowTail);
  }
  outcomeObj.tailMat = tailMatMain;
  const drlMatCfg = {};
  drlMatCfg.color = 0x111111;
  drlMatCfg.emissive = 0xf4f8ff;
  drlMatCfg.emissiveIntensity = 1.2;
  drlMatCfg.roughness = 0.3;
  const drlMatMain = new THREE.MeshStandardMaterial(drlMatCfg);
  const sgnIterB = [-1, 1][Symbol.iterator]();
  let sgnStepB;
  while (!(sgnStepB = sgnIterB.next()).done) {
    const sgnVal = sgnStepB.value;
    const stripMeshObj = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.07), drlMatMain);
    stripMeshObj.position.set(0.55 * sgnVal, 0.52, 2.44);
    hostGrpObj.add(stripMeshObj);
  }
  outcomeObj.drlMat = drlMatMain;
  const discGeoObj = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20);
  discGeoObj.rotateZ(Math.PI / 2);
  const discMatCfg = {};
  discMatCfg.color = 0xe02020;
  discMatCfg.metalness = 0.2;
  discMatCfg.roughness = 0.35;
  const discMatObj = new THREE.MeshStandardMaterial(discMatCfg);
  const discPosList = [];
  discPosList.push([-0.86, 1.4]);
  discPosList.push([0.86, 1.4]);
  discPosList.push([-0.86, -1.75]);
  discPosList.push([0.86, -1.75]);
  const discIter = discPosList[Symbol.iterator]();
  let discStep;
  while (!(discStep = discIter.next()).done) {
    const [xPos, zPos] = discStep.value;
    const discMeshObj = new THREE.Mesh(discGeoObj, discMatObj);
    discMeshObj.position.set(xPos, 0.36, zPos);
    hostGrpObj.add(discMeshObj);
  }
  if (vehIn) vehIn.svjTreatment = outcomeObj;
  return outcomeObj;
};
const SVJ_IDS_SET = new Set(['svj']);
let svjDoneFlag = false;
const svjQueue = [];
let svjTplObj = null;
function fillSvjCar(rootIn, specArg, optsArg) {
  const cloneIn = svjTplObj.clone(true);
  const kitObj = svjFixesApply(cloneIn, null, rootIn);
  rootIn.add(cloneIn);
  underglowAdd(rootIn, specArg, optsArg);
  blobShadowAdd(rootIn, specArg);
  const pivotMap = {};
  const pivotSpecs = [];
  pivotSpecs.push(['fl', -0.88, 1.4]);
  pivotSpecs.push(['fr', 0.88, 1.4]);
  pivotSpecs.push(['rl', -0.88, -1.75]);
  pivotSpecs.push(['rr', 0.88, -1.75]);
  const specIter = pivotSpecs[Symbol.iterator]();
  let specStep;
  while (!(specStep = specIter.next()).done) {
    const [keyName, xPos, zPos] = specStep.value;
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(xPos, 0.36, zPos);
    rootIn.add(pivotGrp);
    pivotMap[keyName] = pivotGrp;
  }
  rootIn.userData.wheels = pivotMap;
  rootIn.userData.wheelR = 0.36;
  rootIn.userData.tailMat = kitObj.tailMat;
  rootIn.userData.headMat = kitObj.drlMat;
  rootIn.userData.visualMode = 'glb';
  return rootIn;
}
function makeSvjCarMesh(specArg, optsArg) { return fillSvjCar(new THREE.Group(), specArg, optsArg); }
function svjSwapGlb(itemIn) {
  try { const vehIn = itemIn.v;
    if (!vehIn || !vehIn.mesh || !vehIn.mesh.parent) return;
    if (vehIn.mesh.userData.visualMode === 'glb') return;
    if (!vehIn._procChildren) {
      for (; vehIn.mesh.children.length;) vehIn.mesh.remove(vehIn.mesh.children[0]);
    } else { const childIter = [...vehIn.mesh.children][Symbol.iterator]();
      let childStep;
      while (!(childStep = childIter.next()).done) {
        const childItem = childStep.value;
        if (vehIn._procChildren.has(childItem)) vehIn.mesh.remove(childItem);
      }
    }
    fillSvjCar(vehIn.mesh, itemIn.spec, { glow: itemIn.glow });
    vehIn.wheels = vehIn.mesh.userData.wheels;
    vehIn._procChildren = null;
    if (vehIn._brakeStaged && vehIn.mesh.userData.tailMat)
      vehIn.mesh.userData.tailMat.emissiveIntensity = 2.4;
  } catch (e) { void e; }
}
try { loadHeroAsset('lamboSvj').then(function (wrapIn) {
      try { svjDoneFlag = true;
        if (!wrapIn) { svjQueue.length = 0; return; }
        svjTplObj = wrapIn;
        svjQueue.splice(0).forEach(function (itemIn) { svjSwapGlb(itemIn); });
      } catch (e) { void e; }
    }).catch(function () { svjDoneFlag = true; svjQueue.length = 0; });
} catch (e) { svjDoneFlag = true; }

const PASTEL_PARKED_LIST = [];
PASTEL_PARKED_LIST.push(0xffb7d5);
PASTEL_PARKED_LIST.push(0xb8e6c9);
PASTEL_PARKED_LIST.push(0xfff3d6);
PASTEL_PARKED_LIST.push(0xaed6f7);
PASTEL_PARKED_LIST.push(0xffcf9f);
PASTEL_PARKED_LIST.push(0xd5f5e3);
PASTEL_PARKED_LIST.push(0xfdebd0);
PASTEL_PARKED_LIST.push(0xd6eaf8);
PASTEL_PARKED_LIST.push(0xd9c7ec);
PASTEL_PARKED_LIST.push(0xfdf6b2);
PASTEL_PARKED_LIST.push(0xf5a58d);

export const spawnVehicle = (G, specIdTxt, xBorn, zBorn, angBorn, optsArg) => {
  const optsBag = optsArg || {};
  if (optsBag.driver === 'parked' && optsBag.color == null && !optsBag.livery && rnd() < 0.7) {
    optsBag.color = pick(PASTEL_PARKED_LIST);
  }
  const specObj = { ...CARS[specIdTxt], id: specIdTxt };
  const isHero = HERO_IDS_SET.has(specIdTxt);
  const isGtr = GTR_IDS_SET.has(specIdTxt);
  const isSvj = SVJ_IDS_SET.has(specIdTxt);
  let meshMain;
  if (isSvj && svjTplObj) meshMain = makeSvjCarMesh(specObj, optsBag);
  else if (isGtr && gtrTplObj) meshMain = makeGtrCarMesh(specObj, optsBag);
  else if (isHero && heroTplObj) meshMain = makeGlbCarMesh(specObj, optsBag);
  else meshMain = makeCarMesh(specObj, optsBag.color, optsBag);

  meshMain.traverse(function (nodeItem) {
    if (nodeItem && nodeItem.isMesh && !(nodeItem.geometry && nodeItem.geometry.type === 'PlaneGeometry' && Math.abs(nodeItem.rotation.x + Math.PI / 2) < 0.01)) {
      nodeItem.castShadow = true;
    }
  });
  meshMain.position.set(xBorn, groundH(xBorn, zBorn) + 0.02, zBorn);
  meshMain.rotation.y = angBorn || 0;
  G.scene.add(meshMain);
  let colorVal;
  if (optsBag.color != null) colorVal = optsBag.color;
  else colorVal = specObj.color;
  const vehOut = {};
  vehOut.spec = specObj;
  vehOut.specId = specIdTxt;
  vehOut.mesh = meshMain;
  vehOut.angle = angBorn || 0;
  vehOut.speed = 0;
  vehOut.health = 100;
  vehOut.driver = optsBag.driver || 'parked';
  vehOut.color = colorVal;
  vehOut.wheels = meshMain.userData.wheels;
  vehOut.steerVis = 0;
  vehOut.x = xBorn;
  vehOut.z = zBorn;
  vehOut.target = null;
  vehOut.lane = optsBag.lane || 0;
  vehOut.smokeT = 0;
  fxHookArm(G);
  function queueMaybe(flagIn, tplIn, doneIn, queueIn) {
    if (flagIn && !tplIn && !doneIn) {
      vehOut._procChildren = new Set(meshMain.children);
      queueIn.push({ v: vehOut, spec: specObj, glow: optsBag.glow });
    }
  }
  queueMaybe(isHero, heroTplObj, heroDoneFlag, heroQueue);
  queueMaybe(isGtr, gtrTplObj, gtrDoneFlag, gtrQueue);
  queueMaybe(isSvj, svjTplObj, svjDoneFlag, svjQueue);
  if (!G.vehicles) G.vehicles = []; G.vehicles.push(vehOut);
  return vehOut;
};

const TRAFFIC_IDS_LIST = [];
TRAFFIC_IDS_LIST.push('sedan');
TRAFFIC_IDS_LIST.push('hatch');
TRAFFIC_IDS_LIST.push('suv');
TRAFFIC_IDS_LIST.push('wagon');
TRAFFIC_IDS_LIST.push('kei');
TRAFFIC_IDS_LIST.push('hachi');
TRAFFIC_IDS_LIST.push('van');
TRAFFIC_IDS_LIST.push('sora15');
TRAFFIC_IDS_LIST.push('roadster');
TRAFFIC_IDS_LIST.push('taxi');
TRAFFIC_IDS_LIST.push('sedan');
TRAFFIC_IDS_LIST.push('hatch');
TRAFFIC_IDS_LIST.push('suv');
TRAFFIC_IDS_LIST.push('taxi');

const TRAFFIC_PAINT_LIST = [];
TRAFFIC_PAINT_LIST.push(0xb9c0c7);
TRAFFIC_PAINT_LIST.push(0x3f8cff);
TRAFFIC_PAINT_LIST.push(0xd95555);
TRAFFIC_PAINT_LIST.push(0x44484e);
TRAFFIC_PAINT_LIST.push(0xf2f2f2);
TRAFFIC_PAINT_LIST.push(0x5a7d4f);
TRAFFIC_PAINT_LIST.push(0xffd23f);
TRAFFIC_PAINT_LIST.push(0x707880);
TRAFFIC_PAINT_LIST.push(0x8a4fd0);
TRAFFIC_PAINT_LIST.push(0x2a9d8f);
TRAFFIC_PAINT_LIST.push(0xffb7d5);
TRAFFIC_PAINT_LIST.push(0xb8e6c9);
TRAFFIC_PAINT_LIST.push(0xfff3d6);
TRAFFIC_PAINT_LIST.push(0xaed6f7);
TRAFFIC_PAINT_LIST.push(0xffcf9f);
TRAFFIC_PAINT_LIST.push(0xd5f5e3);
TRAFFIC_PAINT_LIST.push(0xfdebd0);
TRAFFIC_PAINT_LIST.push(0xd6eaf8);
TRAFFIC_PAINT_LIST.push(0xf5c6e0);
TRAFFIC_PAINT_LIST.push(0xe8daef);

const SEDAN_TINT_ARR = [];
SEDAN_TINT_ARR.push(0xc0c4c8);
SEDAN_TINT_ARR.push(0xe9e9e6);
SEDAN_TINT_ARR.push(0x3a3d42);
SEDAN_TINT_ARR.push(0x6e1420);
SEDAN_TINT_ARR.push(0x44586e);
SEDAN_TINT_ARR.push(0x77694f);
SEDAN_TINT_ARR.push(0xe8a7bf);
SEDAN_TINT_ARR.push(0x9fc3e8);
let sedanIdxCtr = 0;

export const spawnTraffic = (G, countWant) => {
  if (!G.traffic) G.traffic = []; const makeTotal = Math.round((countWant * 16) / 7);
  let madeIdx = 0;
  while (madeIdx < makeTotal) {
    let xAlongFlag = rnd() < 0.5;
    let coordLine;
    if (xAlongFlag) coordLine = pick(G.roadX);
    else coordLine = pick(G.roadZ);

    if (rnd() < 0.45) { const pickList = [];
      pickList.push('blvd');
      pickList.push('blvd');
      pickList.push('x0');
      pickList.push('z0');
      const pickMain = pick(pickList);
      pickMain === 'blvd' && Array.isArray(G.roadZ) && G.roadZ.includes(495)
        ? (xAlongFlag = false, coordLine = 495)
        : pickMain === 'x0' && Array.isArray(G.roadX) && G.roadX.includes(0)
          ? (xAlongFlag = true, coordLine = 0)
          : pickMain === 'z0' && Array.isArray(G.roadZ) && G.roadZ.includes(0)
            ? (xAlongFlag = false, coordLine = 0)
            : null;
    }
    const coordAlong = rr(-600, 600);
    let sgnVal;
    if (rnd() < 0.5) sgnVal = 1;
    else sgnVal = -1;
    const offLane = 5 * sgnVal;
    let xBorn;
    if (xAlongFlag) xBorn = coordLine + offLane;
    else xBorn = coordAlong;
    let zBorn;
    if (xAlongFlag) zBorn = coordAlong;
    else zBorn = coordLine - offLane;
    let angBorn;
    if (xAlongFlag) {
      if (sgnVal > 0) angBorn = 0;
      else angBorn = Math.PI;
    } else {
      if (sgnVal > 0) angBorn = Math.PI / 2;
      else angBorn = -Math.PI / 2;
    }
    const pickSpec = pick(TRAFFIC_IDS_LIST);
    let spawnColor;
    if (pickSpec === 'taxi') spawnColor = CARS.taxi.color;
    else spawnColor = pick(TRAFFIC_PAINT_LIST);
    const spawnOpts = {};
    spawnOpts.color = spawnColor;
    spawnOpts.driver = 'traffic';
    const vehOut = spawnVehicle(G, pickSpec, xBorn, zBorn, angBorn, spawnOpts);
    if (pickSpec === 'sedan') {
      const tintArg = SEDAN_TINT_ARR[sedanIdxCtr % SEDAN_TINT_ARR.length];
      ++sedanIdxCtr;
      applyNpcSedanGlb(vehOut, tintArg);
    }
    if (pickSpec === 'taxi') applyNpcTaxiGlb(vehOut);
    vehOut.onX = xAlongFlag;
    vehOut.line = coordLine;
    vehOut.dirSign = sgnVal;
    vehOut.cruise = rr(22, 38) / 3.6;
    vehOut.speed = vehOut.cruise;
    G.traffic.push(vehOut);
    ++madeIdx;
  }
};

const trafficWheelsSpin = (vehIn, stepIn, dtIn) => {
  const keyListA = [];
  keyListA.push('fl');
  keyListA.push('fr');
  keyListA.push('rl');
  keyListA.push('rr');
  const keyIterA = keyListA[Symbol.iterator]();
  let keyStepA;
  while (!(keyStepA = keyIterA.next()).done) {
    const keyName = keyStepA.value;
    const wheelItem = vehIn.wheels[keyName];
    if (wheelItem) wheelItem.rotation.x = wheelItem.rotation.x + dtIn * (stepIn / dtIn);
  }
  const keyListB = [];
  keyListB.push('fl');
  keyListB.push('fr');
  keyListB.push('rl');
  keyListB.push('rr');
  const keyIterB = keyListB[Symbol.iterator]();
  let keyStepB;
  while (!(keyStepB = keyIterB.next()).done) {
    const keyName = keyStepB.value;
    const wheelItem = vehIn.wheels[keyName];
    if (wheelItem) wheelItem.rotation.x = 0 + (wheelItem.rotation.x || 0);
  }
  const keyListC = [];
  keyListC.push('fl');
  keyListC.push('fr');
  keyListC.push('rl');
  keyListC.push('rr');
  const keyIterC = keyListC[Symbol.iterator]();
  let keyStepC;
  while (!(keyStepC = keyIterC.next()).done) {
    const keyName = keyStepC.value;
    const wheelItem = vehIn.wheels[keyName];
    if (wheelItem) {
      wheelItem.userData.spin =
        (wheelItem.userData.spin || 0) + (vehIn.speed * dtIn) / 0.33;
      wheelItem.rotation.set(wheelItem.userData.spin, 0, 0);
    }
  }
};

export const updateTraffic = (G, dtIn) => {
  if (!G.traffic) { return; }
  let xAnchor;
  if (G.car) xAnchor = G.car.x;
  else if (G.player) xAnchor = G.player.x;
  else xAnchor = 0;
  let zAnchor;
  if (G.car) zAnchor = G.car.z;
  else if (G.player) zAnchor = G.player.z;
  else zAnchor = 0;
  const isNight = G.timeOfDay > 18.5 || G.timeOfDay < 5.5;
  const trafIter = G.traffic[Symbol.iterator]();
  let trafStep;
  while (!(trafStep = trafIter.next()).done) {
    const vehOut = trafStep.value;
    if (vehOut.driver === 'traffic') {
    const awayDist = Math.hypot(vehOut.x - xAnchor, vehOut.z - zAnchor);
    if (awayDist > 500) {
      const xAlongFlag = rnd() < 0.5;
      let pickRoad;
      if (xAlongFlag) pickRoad = pick(G.roadX);
      else pickRoad = pick(G.roadZ);
      vehOut.onX = xAlongFlag;
      vehOut.line = pickRoad;
      if (rnd() < 0.5) vehOut.dirSign = 1;
      else vehOut.dirSign = -1;
      let coordAnchor;
      if (xAlongFlag) coordAnchor = zAnchor;
      else coordAnchor = xAnchor;
      const coordAlong = Math.max(-640, Math.min(640, rr(-260, 260) + coordAnchor));
      if (xAlongFlag) vehOut.x = pickRoad + vehOut.dirSign * 5;
      else vehOut.x = coordAlong;
      if (xAlongFlag) vehOut.z = coordAlong;
      else vehOut.z = pickRoad - vehOut.dirSign * 5;
      vehOut.speed = vehOut.cruise;
    }

    let isBlocked = false;
    const otherIter = G.traffic[Symbol.iterator]();
    let otherStep;
    while (!(otherStep = otherIter.next()).done) {
      const otherVeh = otherStep.value;
      if (otherVeh === vehOut) continue;
      const xGap = otherVeh.x - vehOut.x;
      const zGap = otherVeh.z - vehOut.z;
      const xFwd = Math.sin(vehOut.angle);
      const zFwd = Math.cos(vehOut.angle);
      const amtAhead = xGap * xFwd + zGap * zFwd;
      const amtSide = Math.abs(xGap * zFwd - zGap * xFwd);
      if (amtAhead > 0 && amtAhead < 9 && amtSide < 2.2) {
        isBlocked = true; break;
      }
    }
    if (G.car && G.car !== vehOut) {
      const xGap = G.car.x - vehOut.x;
      const zGap = G.car.z - vehOut.z;
      const amtAhead = xGap * Math.sin(vehOut.angle) + zGap * Math.cos(vehOut.angle);
      const amtSide = Math.abs(
        xGap * Math.cos(vehOut.angle) - zGap * Math.sin(vehOut.angle),
      );
      if (amtAhead > 0 && amtAhead < 9 && amtSide < 2.4) isBlocked = true;
    }

    let speedGoal;
    if (isBlocked) speedGoal = 0;
    else if (vehOut.health < 35) speedGoal = vehOut.cruise * 0.72;
    else speedGoal = vehOut.cruise * 1;
    vehOut.speed = vehOut.speed + Math.max(-8 * dtIn, Math.min(3 * dtIn, speedGoal - vehOut.speed));

    vehOut.x = vehOut.x + dtIn * (Math.sin(vehOut.angle) * vehOut.speed);
    vehOut.z = vehOut.z + dtIn * (Math.cos(vehOut.angle) * vehOut.speed);
    let crossList;
    if (vehOut.onX) crossList = G.roadZ;
    else crossList = G.roadX;
    let coordAlong;
    if (vehOut.onX) coordAlong = vehOut.z;
    else coordAlong = vehOut.x;
    const crossIter = crossList[Symbol.iterator]();
    let crossStep;
    while (!(crossStep = crossIter.next()).done) {
      const coordCross = crossStep.value;
      if (Math.abs(coordAlong - coordCross) < 1.2 && Math.abs(vehOut.speed) > 1 && rnd() < 0.35) {
        vehOut.onX ? (vehOut.z = coordCross, vehOut.line = coordCross) : (vehOut.x = coordCross, vehOut.line = coordCross);
        vehOut.onX = !vehOut.onX;
        if (rnd() < 0.5) vehOut.dirSign = 1;
        else vehOut.dirSign = -1;
        if (vehOut.onX) {
          vehOut.x = vehOut.line + vehOut.dirSign * 5;
          if (vehOut.dirSign > 0) vehOut.angle = 0;
          else vehOut.angle = Math.PI;
        } else {
          vehOut.z = vehOut.line - vehOut.dirSign * 5;
          if (vehOut.dirSign > 0) vehOut.angle = Math.PI / 2;
          else vehOut.angle = -Math.PI / 2;
        } break;
      }
    }

    vehOut.onX
      ? (vehOut.x = vehOut.x + (vehOut.line + vehOut.dirSign * 5 - vehOut.x) * Math.min(1, 2 * dtIn))
      : (vehOut.z = vehOut.z + (vehOut.line - vehOut.dirSign * 5 - vehOut.z) * Math.min(1, 2 * dtIn));
    if (Math.abs(vehOut.x) > 655 || Math.abs(vehOut.z) > 655) {
      vehOut.angle = vehOut.angle + Math.PI;
      vehOut.dirSign = vehOut.dirSign * -1;
      vehOut.x = Math.max(-650, Math.min(650, vehOut.x));
      vehOut.z = Math.max(-650, Math.min(650, vehOut.z));
    }
    vehOut.mesh.position.set(vehOut.x, groundH(vehOut.x, vehOut.z) + 0.02, vehOut.z);
    vehOut.mesh.rotation.y = vehOut.angle;
    const stepIn = (vehOut.speed * dtIn) / (vehOut.mesh.userData.wheelR || 0.33);
    trafficWheelsSpin(vehOut, stepIn, dtIn);
    if (isNight && !vehOut.nightGlow) {
      const sprGlow = glowSprite(0xffe9a0, 2.2);
      sprGlow.position.set(0, 0.7, 0.4 + vehOut.spec.len / 2);
      vehOut.mesh.add(sprGlow);
      vehOut.nightGlow = sprGlow;
    }
    if (!isNight && vehOut.nightGlow) {
      vehOut.mesh.remove(vehOut.nightGlow);
      vehOut.nightGlow = null;
    }
    }
  }
};

export const damageVehicle = (G, vehIn, dmgIn) => {
  vehIn.health = Math.max(0, vehIn.health - dmgIn);
  fxHookArm(G);
  const posHit = hoodWorldPos(vehIn, new THREE.Vector3());
  spawnSmokeAt(G, posHit, 3, vehIn.health < 25);
  for (let burstIdx = 0; burstIdx < 3; ++burstIdx) {
    spawnDamagePuff(G, vehIn, false);
  }
};

export const darknessFactor = (G) => { let hourIn;
  if (G && typeof G.timeOfDay === 'number') hourIn = G.timeOfDay;
  else hourIn = 10.5;
  const amtDay = Math.max(0, Math.min(1, Math.sin(((hourIn - 6) / 12) * Math.PI)));
  return 1 - amtDay;
};
function hoodWorldPos(vehIn, vecOut) {
  const specObj = vehIn.spec || {};
  let hHood;
  if (specObj.hood != null) hHood = 0.62 + specObj.hood * 0.28;
  else hHood = 0.85;
  vecOut.set(0, hHood, (specObj.len || 4.4) * 0.32);
  vehIn.mesh && vehIn.mesh.localToWorld
    ? (vehIn.mesh.updateMatrixWorld(true), vehIn.mesh.localToWorld(vecOut))
    : vecOut.add(vehIn.mesh.position);
  return vecOut;
}

function healthBand(healthIn) {
  const bandA = {};
  bandA.rate = 12;
  bandA.color = 0x232528;
  bandA.s0 = 0.9;
  bandA.s1 = 3.2;
  bandA.op = 0.65;
  const bandB = {};
  bandB.rate = 6;
  bandB.color = 0x777c83;
  bandB.s0 = 0.7;
  bandB.s1 = 2.4;
  bandB.op = 0.45;
  const rowA = {};
  rowA.limit = 15;
  rowA.band = bandA;
  const rowB = {};
  rowB.limit = 40;
  rowB.band = bandB;
  const rowList = [rowA, rowB];
  const rowHit = rowList.find(function (rowItem) { return healthIn < rowItem.limit; });
  if (rowHit) return rowHit.band;
  const bandC = {};
  bandC.rate = 2;
  bandC.color = 0xb8bcc0;
  bandC.s0 = 0.5;
  bandC.s1 = 1.6;
  bandC.op = 0.28;
  return bandC;
}
const hoodVecShared = new THREE.Vector3();

export const spawnDamagePuff = (G, vehIn, warmIn, ageForced) => {
  smokePoolBuild(G);
  if (!poolSmokeArr) return;
  const bandMain = healthBand(vehIn.health);
  const puffIter = poolSmokeArr[Symbol.iterator]();
  let puffStep;
  while (!(puffStep = puffIter.next()).done) {
    const puffItem = puffStep.value;
    if (puffItem.life > 0) continue;
    hoodWorldPos(vehIn, hoodVecShared);
    let ageStartVal;
    if (typeof ageForced === 'number') ageStartVal = ageForced;
    else if (warmIn) ageStartVal = rr(0, 1.1);
    else ageStartVal = 0;
    puffItem.kind = 'dmg';
    puffItem.fire = false;
    puffItem.max = 1.4;
    puffItem.life = 1.4 - ageStartVal;
    puffItem.s0 = bandMain.s0;
    puffItem.s1 = bandMain.s1;
    puffItem.op = bandMain.op;
    puffItem.s.material.color.set(bandMain.color);
    puffItem.s.position.set(
      ageStartVal * 0.3 + (hoodVecShared.x + rr(-0.15, 0.15)),
      hoodVecShared.y + ageStartVal * 1.2,
      hoodVecShared.z + rr(-0.15, 0.15),
    );
    puffItem.vx = 0.3 + rr(-0.08, 0.08);
    puffItem.vy = 1.2 + rr(-0.2, 0.2);
    puffItem.vz = rr(-0.08, 0.08);
    const scaleStartVal = puffItem.s0 + (puffItem.s1 - puffItem.s0) * (ageStartVal / 1.4);
    puffItem.s.scale.set(scaleStartVal, scaleStartVal, 1);
    puffItem.s.visible = true; return;
  }
};

export const primeDamageSmoke = (G, vehIn, countWant) => {
  const makeTotal = countWant || 10;
  let puffIdx = 0;
  while (puffIdx < makeTotal) {
    let ageArg;
    if (makeTotal > 1) ageArg = (puffIdx / (makeTotal - 1)) * 1.2;
    else ageArg = 0;
    spawnDamagePuff(G, vehIn, true, ageArg);
    ++puffIdx;
  }
};

const coneGeoShared = new THREE.ConeGeometry(1.15, 7, 20, 1, true);
coneGeoShared.translate(0, -3.5, 0);
const coneMatCfg = {};
coneMatCfg.color = 0xffe2a8;
coneMatCfg.transparent = true;
coneMatCfg.opacity = 0;
coneMatCfg.blending = THREE.AdditiveBlending;
coneMatCfg.depthWrite = false;
coneMatCfg.side = THREE.DoubleSide;
coneMatCfg.fog = false;
const coneMatShared = new THREE.MeshBasicMaterial(coneMatCfg);
const headlightsBuild = (vehIn) => {
  if (vehIn._hl || !vehIn.mesh || !vehIn.spec) return;
  const specObj = vehIn.spec,
    widthVal = specObj.wid,
    lengthVal = specObj.len;
  function makeGlow(tintIn, sizeIn, xPos, yPos, zPos) {
    const sprItem = glowSprite(tintIn, sizeIn);
    sprItem.position.set(xPos, yPos, zPos);
    sprItem.userData.s25Light = true;
    vehIn.mesh.add(sprItem);
    return sprItem;
  }
  const bagLights = {
    glowL: makeGlow(0xffe9a0, 1.25, -0.32 * widthVal, 0.62, 0.12 + lengthVal / 2),
    glowR: makeGlow(0xffe9a0, 1.25, 0.32 * widthVal, 0.62, 0.12 + lengthVal / 2),
    tailL: makeGlow(0xff2a22, 0.85, -0.32 * widthVal, 0.72, -0.1 + lengthVal / -2),
    tailR: makeGlow(0xff2a22, 0.85, 0.32 * widthVal, 0.72, -0.1 + lengthVal / -2),
    cones: [],
  };
  const sgnIter = [-1, 1][Symbol.iterator]();
  let sgnStep;
  while (!(sgnStep = sgnIter.next()).done) {
    const sgnVal = sgnStep.value;
    const coneMeshObj = new THREE.Mesh(coneGeoShared, coneMatShared.clone());
    coneMeshObj.position.set(sgnVal * widthVal * 0.32, 0.58, lengthVal / 2);
    coneMeshObj.rotation.x = 0.07 + -Math.PI / 2;
    coneMeshObj.visible = false;
    coneMeshObj.userData.s25Light = true;
    vehIn.mesh.add(coneMeshObj);
    bagLights.cones.push(coneMeshObj);
  }
  vehIn._hl = bagLights;
};
const playerSpotBuild = (vehIn) => {
  if (vehIn._hlSpot || !vehIn.mesh) return;
  const lengthVal = vehIn.spec.len;
  const spotMain = new THREE.SpotLight(0xffe6b8, 0, 40, 0.5, 0.6);
  spotMain.position.set(0, 0.7, lengthVal / 2);
  spotMain.target.position.set(0, 0, 18 + lengthVal / 2);
  spotMain.userData.s25Light = true;
  vehIn.mesh.add(spotMain);
  vehIn.mesh.add(spotMain.target);
  vehIn._hlSpot = spotMain;
};
let fxArmedFlag = false;
function fxHookArm(G) {
  if (fxArmedFlag || !G || !Array.isArray(G.updaters)) return;
  fxArmedFlag = true;
  G.updaters.push(function (gIn, dtIn) {
    try { updateDamageFx(gIn, dtIn || 0.016);
    } catch (e) { void e; }
  });
}

export const updateDamageFx = (G, dtIn) => {
  if (!(G && Array.isArray(G.vehicles))) return;
  const amtDark = darknessFactor(G);
  let xAnchor;
  if (G.car) xAnchor = G.car.x;
  else if (G.player) xAnchor = G.player.x;
  else xAnchor = 0;
  let zAnchor;
  if (G.car) zAnchor = G.car.z;
  else if (G.player) zAnchor = G.player.z;
  else zAnchor = 0;

  const listHurt = [];
  const vehIter = G.vehicles[Symbol.iterator]();
  let vehStep;
  while (!(vehStep = vehIter.next()).done) {
    const vehOut = vehStep.value;
    if (vehOut && vehOut.health < 70 && vehOut.mesh) listHurt.push(vehOut);
  }
  listHurt.sort(function (vehA, vehB) {
    return (vehA.x - xAnchor) ** 2 +
      (vehA.z - zAnchor) ** 2 -
      ((vehB.x - xAnchor) ** 2 + (vehB.z - zAnchor) ** 2);
  });
  const bagEmitters = new Set(listHurt.slice(0, 10));
  const lightsOn = amtDark > 0.25;
  const vehIterB = G.vehicles[Symbol.iterator]();
  let vehStepB;
  while (!(vehStepB = vehIterB.next()).done) {
    const vehOut = vehStepB.value;
    if (vehOut && vehOut.mesh) {
    headlightsBuild(vehOut);
    const bagLights = vehOut._hl;
    if (bagLights) {
    const isBraking =
      vehOut._prevSpeed != null &&
      dtIn > 0 &&
      (vehOut._prevSpeed - (vehOut.speed || 0)) / dtIn > 2;
    vehOut._prevSpeed = vehOut.speed || 0;
    const glowIter = [bagLights.glowL, bagLights.glowR][Symbol.iterator]();
    let glowStep;
    while (!(glowStep = glowIter.next()).done) {
      const sprItem = glowStep.value;
      sprItem.visible = lightsOn;
      sprItem.material.opacity = 0.85 * amtDark;
    }
    let tailOp;
    if (isBraking) tailOp = amtDark * 0.95;
    else tailOp = amtDark * 0.4;
    const tailIter = [bagLights.tailL, bagLights.tailR][Symbol.iterator]();
    let tailStep;
    while (!(tailStep = tailIter.next()).done) {
      const sprItem = tailStep.value;
      sprItem.visible = lightsOn;
      sprItem.material.opacity = tailOp;
    }
    const coneIter = bagLights.cones[Symbol.iterator]();
    let coneStep;
    while (!(coneStep = coneIter.next()).done) {
      const coneMeshObj = coneStep.value;
      coneMeshObj.visible = lightsOn;
      coneMeshObj.material.opacity = 0.1 * amtDark;
    }
    if (bagEmitters.has(vehOut)) {
      vehOut._smokeAcc = (vehOut._smokeAcc || 0) + dtIn * healthBand(vehOut.health).rate;
      for (; !(vehOut._smokeAcc < 1);) {
        vehOut._smokeAcc -= 1;
        spawnDamagePuff(G, vehOut, false);
      }
    }
    }
    }
  }

  if (G.car && G.car.mesh) { playerSpotBuild(G.car);
    if (G.car._hlSpot) G.car._hlSpot.intensity = 55 * amtDark;
  }
};

let poolSmokeArr = null;
const smokePoolBuild = (G) => {
  if (poolSmokeArr) return;
  poolSmokeArr = [];
  const canvasEl = document.createElement('canvas');
  canvasEl.width = canvasEl.height = 64;
  const ctxG = canvasEl.getContext('2d');
  const gradObj = ctxG.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradObj.addColorStop(0, 'rgba(255,255,255,.85)');
  gradObj.addColorStop(1, 'rgba(255,255,255,0)');
  ctxG.fillStyle = gradObj;
  ctxG.fillRect(0, 0, 64, 64);
  const texPuff = new THREE.CanvasTexture(canvasEl);
  for (let poolIdx = 0; poolIdx < 120; ++poolIdx) {
    const sprMatCfg = {};
    sprMatCfg.map = texPuff;
    sprMatCfg.transparent = true;
    sprMatCfg.opacity = 0;
    sprMatCfg.depthWrite = false;
    const sprItem = new THREE.Sprite(new THREE.SpriteMaterial(sprMatCfg));
    sprItem.visible = false;
    G.scene.add(sprItem);
    const recObj = {};
    recObj.s = sprItem;
    recObj.life = 0;
    recObj.max = 1;
    recObj.fire = false;
    recObj.kind = 'legacy';
    recObj.vx = 0;
    recObj.vy = 0;
    recObj.vz = 0;
    recObj.s0 = 0.7;
    recObj.s1 = 2.9;
    recObj.op = 0.5;
    poolSmokeArr.push(recObj);
  }
};

export const spawnSmokeAt = (G, vecPos, countWant, fireIn) => {
  smokePoolBuild(G);
  let madeTotal = 0;
  const puffIter = poolSmokeArr[Symbol.iterator]();
  let puffStep;
  while (!(puffStep = puffIter.next()).done) {
    const puffItem = puffStep.value;
    if (madeTotal >= countWant) break;
    if (puffItem.life > 0) continue;
    puffItem.life = puffItem.max = rr(0.6, 1.3);
    puffItem.fire = !!fireIn;
    puffItem.kind = 'legacy';
    puffItem.s.position.set(
      vecPos.x + rr(-0.4, 0.4),
      vecPos.y + rr(0.5, 1),
      vecPos.z + rr(-0.4, 0.4),
    );
    if (fireIn) puffItem.s.material.color.set(0xff7a2a);
    else puffItem.s.material.color.set(0x8a8f96);
    puffItem.s.scale.set(0.7, 0.7, 1);
    puffItem.s.visible = true;
    puffItem.vx = rr(-0.3, 0.3);
    puffItem.vy = rr(1, 2);
    puffItem.vz = rr(-0.3, 0.3);
    ++madeTotal;
  }
};

export const updateSmoke = (G, dtIn) => {
  if (poolSmokeArr) {
    const puffIter = poolSmokeArr[Symbol.iterator]();
    let puffStep;
    while (!(puffStep = puffIter.next()).done) {
      const puffItem = puffStep.value;
      if (puffItem.life > 0) {
      puffItem.life = puffItem.life - dtIn;
      if (!(puffItem.life > 0)) {
        puffItem.s.visible = false;
        puffItem.s.material.opacity = 0;
      } else {
      const fracAge = 1 - puffItem.life / puffItem.max;
      puffItem.s.position.x = puffItem.s.position.x + dtIn * puffItem.vx;
      puffItem.s.position.y = puffItem.s.position.y + dtIn * puffItem.vy;
      puffItem.s.position.z = puffItem.s.position.z + dtIn * puffItem.vz;
      if (puffItem.kind === 'dmg') {
        const scaleCur = puffItem.s0 + (puffItem.s1 - puffItem.s0) * fracAge;
        puffItem.s.scale.set(scaleCur, scaleCur, 1);
        puffItem.s.material.opacity = puffItem.op * (1 - fracAge);
      } else {
      let spreadVal;
      if (puffItem.fire) spreadVal = 1.2;
      else spreadVal = 2.2;
      const scaleCur = 0.7 + spreadVal * fracAge;
      puffItem.s.scale.set(scaleCur, scaleCur, 1);
      let opBase;
      if (puffItem.fire) opBase = 0.75;
      else opBase = 0.5;
      let opMul;
      if (puffItem.fire) opMul = 0.7 + rnd() * 0.5;
      else opMul = 1;
      puffItem.s.material.opacity =
        opBase * (1 - fracAge) * opMul;
      if (puffItem.fire) puffItem.s.material.color.setHSL(0.06 + rnd() * 0.03, 1, 0.5);
      }
      }
      }
    }
  }
};
