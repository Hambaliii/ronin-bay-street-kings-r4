// Vehicle factory: extruded shells, canvas liveries, GLB replacements.
// Rebuilt with new helper splits; the build sequence is unchanged.
import * as THREE from 'three'; import { CARS } from './config.js';
import { rnd, rr, ri, pick } from './random.js'; import { groundH, glowSprite } from './world.js';
import { loadHeroAsset } from './assets.js';

const HEX_PAD_LEN = 6;

const hexCss = (hexNum) => '#' + hexNum.toString(16).padStart(HEX_PAD_LEN, '0');

// Tall-body roof heights, with the van borrowing the suv figure.
const TALL_ROOF_MAP = { 'suv': 1.55, 'truck': 1.5, 'kei': 1.4 };
function roofHeightLookup(kindTxt) {
  return kindTxt === 'van' ? TALL_ROOF_MAP.suv : TALL_ROOF_MAP[kindTxt];
}
function shellTopHeight(specObj) {
  const mappedVal = roofHeightLookup(specObj.body);
  if (mappedVal !== undefined) return mappedVal;
  const bonusVal = (specObj.body === 'sedan' || specObj.body === 'wagon') ? 0.18 : 0;
  return 1.05 + bonusVal;
}

// Outer shell silhouette: nose, roof treatment chosen by lookup, tail.
function sideProfileShape(specObj) {
  const lenFull = specObj.len;
  const lenHalf = lenFull / 2;
  const topH = shellTopHeight(specObj);
  const hoodY = 0.62 + (specObj.hood * 0.28);
  const beltY = 0.72 * topH;
  const pathObj = new THREE.Shape();
  pathObj.moveTo(0.12 + (-lenHalf), 0.18);
  pathObj.quadraticCurveTo(-0.02 + (-lenHalf), 0.3, -lenHalf, beltY * 0.8);
  const paintFlatRoof = () => {
    pathObj.quadraticCurveTo(-lenHalf, topH * 0.97, 0.3 + (-lenHalf), topH);
    pathObj.lineTo(lenHalf * (0.2 + (specObj.cabin * 0.2)), topH);
    pathObj.quadraticCurveTo(lenHalf * 0.75, topH * 0.96, lenHalf * 0.88, 0.1 + hoodY);
  };
  const paintHatchRoof = () => {
    pathObj.quadraticCurveTo(0.05 + (-lenHalf), topH * 0.92, 0.35 + (-lenHalf), topH * 0.98);
    pathObj.quadraticCurveTo((lenFull * 0.28) + (-lenHalf), topH, (lenFull * (0.32 + (specObj.cabin * 0.18))) + (-lenHalf), topH * 0.99);
    pathObj.quadraticCurveTo(lenHalf * 0.72, topH * 0.9, lenHalf * 0.86, 0.08 + hoodY); };
  const paintFastRoof = () => {
    pathObj.bezierCurveTo(0.1 + (-lenHalf), beltY, (lenFull * 0.3) + (-lenHalf), topH * 0.99, (lenFull * (0.34 + (specObj.cabin * 0.16))) + (-lenHalf), topH);
    pathObj.quadraticCurveTo(lenHalf * 0.55, topH * 0.97, lenHalf * 0.84, 0.06 + hoodY); };
  const paintPlainRoof = () => {
    pathObj.quadraticCurveTo((lenFull * 0.18) + (-lenHalf), topH * 0.99, (lenFull * (0.3 + (specObj.cabin * 0.16))) + (-lenHalf), topH);
    pathObj.quadraticCurveTo(lenHalf * 0.45, topH * 0.98, lenHalf * 0.8, 0.1 + hoodY);
    if (specObj.body === 'sedan' || specObj.body === 'roadster') {
      pathObj.quadraticCurveTo(lenHalf * 0.9, 0.04 + hoodY, lenHalf * 0.94, hoodY);
    }
  };
  const roofPainterFn = (specObj.roof === 'wagon' || specObj.body === 'van' || specObj.body === 'suv') ? paintFlatRoof
    : specObj.roof === 'hatch' ? paintHatchRoof
    : specObj.roof === 'fastback' ? paintFastRoof
    : paintPlainRoof;
  roofPainterFn();
  pathObj.quadraticCurveTo(0.04 + lenHalf, hoodY * 0.72, lenHalf, 0.42);
  pathObj.quadraticCurveTo(-0.02 + lenHalf, 0.2, lenHalf + (-0.3), 0.18);
  pathObj.lineTo(0.12 + (-lenHalf), 0.18);
  pathObj.userData = { tall: topH, hoodY: hoodY, beltY: beltY };
  return pathObj;
}

// Window band outline nested inside the shell silhouette.
function glasshouseShape(specObj) {
  const lenFull = specObj.len;
  const lenHalf = lenFull / 2;
  const kindTxt = specObj.body;
  const topH = (kindTxt === 'suv' || kindTxt === 'van') ? 1.55
    : kindTxt === 'truck' ? 1.5
    : kindTxt === 'kei' ? 1.4
    : ((kindTxt === 'sedan' || kindTxt === 'wagon') ? 0.18 : 0) + 1.05;
  const beltY = 0.72 * topH;
  const isFlatKind = specObj.roof === 'wagon' || specObj.body === 'van' || specObj.body === 'suv';
  const rearX = isFlatKind ? 0.35 + (-lenHalf)
    : specObj.roof === 'hatch' ? 0.55 + (-lenHalf)
    : (lenFull * (0.30 + (specObj.cabin * 0.14))) + (-lenHalf);
  const frontX = (specObj.roof === 'flat' && specObj.body !== 'kei')
    ? lenHalf * 0.52
    : lenHalf * (0.35 + (specObj.cabin * 0.15));
  const pathObj = new THREE.Shape();
  pathObj.moveTo(rearX, beltY);
  pathObj.quadraticCurveTo(0.25 + rearX, topH * 0.99, (lenFull * 0.18) + rearX, topH * 0.985);
  pathObj.quadraticCurveTo(frontX + (-0.2), topH * 0.97, frontX, 0.04 + beltY);
  pathObj.lineTo(rearX, beltY);
  return pathObj;
}

// Extrudes a flat outline across the car width with bevelled edges.
const sweepProfile = (pathObj, widthVal, bevelThickVal, bevelSizeVal) => {
  const geoObj = new THREE.ExtrudeGeometry(pathObj, { depth: Math.max(0.2, widthVal + (-2 * bevelSizeVal)), bevelEnabled: true, bevelThickness: bevelThickVal, bevelSize: bevelSizeVal, bevelSegments: 3, steps: 1, curveSegments: 12 });
  geoObj.translate(0, 0, bevelSizeVal + (-(widthVal / 2))); geoObj.rotateY(Math.PI / 2);
  return geoObj;
};

// Side decal canvas for the police, taxi and hero paint schemes.
function paintLiveryCanvas(kindTxt, fallbackHex) {
  const cnv = document.createElement('canvas');
  cnv.width = 512; cnv.height = 128;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  const paintersByKind = {
    'police': () => {
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(90, 18, 330, 78);
      ctx.fillStyle = '#1c4f9c'; ctx.fillRect(0, 78, 512, 16);
      ctx.fillStyle = '#14161a'; ctx.font = 'bold 52px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('RBPD', 256, 72);
      ctx.fillStyle = '#c8a028'; ctx.beginPath(); ctx.arc(120, 56, 20, 0, 6.3); ctx.fill();
    },
    'taxi': () => {
      // Chequer band: two rows of alternating dark and light cells.
      let cellX = 0;
      while (cellX < 512) {
        let cellY = 0;
        while (cellY < 2) {
          ctx.fillStyle = !(((cellX / 24) + cellY) % 2) ? '#f4f6f8' : '#14161a';
          ctx.fillRect(cellX, 52 + (cellY * 14), 24, 14); ++cellY; }
        cellX += 24; }
    },
    'hero-supra': () => {
      ctx.fillStyle = '#14161a'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TEN-SECOND', 256, 66);
    },
    'hero-gtr': () => {
      ctx.fillStyle = '#c8ccd2'; ctx.fillRect(0, 56, 512, 14);
      ctx.fillStyle = '#14161a'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('BAYSIDE GHOST', 256, 46);
    },
  };
  if (Object.prototype.hasOwnProperty.call(paintersByKind, kindTxt)) paintersByKind[kindTxt]();
  void fallbackHex;
  const texOut = new THREE.CanvasTexture(cnv);
  texOut.colorSpace = THREE.SRGBColorSpace; return texOut;
}

export function makeCarMesh(specObj, paintHexVal, optsIn) {
  // Full vehicle build: shell, glasshouse, trim, wheels, lights, aero.
  const oBag = optsIn || {};
  const paintVal = paintHexVal != null ? paintHexVal : specObj.color;
  const rootGrp = new THREE.Group();
  const lenVal = specObj.len, widVal = specObj.wid;
  const truckFlag = specObj.body === 'truck';
  const cabSpec = truckFlag ? { ...specObj, len: 2.2 } : specObj;
  const shellMesh = new THREE.Mesh(sweepProfile(sideProfileShape(cabSpec), widVal, 0.09, 0.07),
    new THREE.MeshStandardMaterial({ color: paintVal, metalness: 0.55, roughness: 0.35 }));
  const paintMatRef = shellMesh.material; rootGrp.add(shellMesh);
  if (specObj.twoTone) {
    const bandMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal * 0.99, 0.34, lenVal * 0.98),
      new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.4, roughness: 0.5 }));
    bandMesh.position.y = 0.3; rootGrp.add(bandMesh);
  }
  if (truckFlag) {
    const cargoMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal, 2.1, 3.9),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 }));
    cargoMesh.position.set(0, 1.45, -1.15); rootGrp.add(cargoMesh);
    const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(widVal * 0.7, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 }));
    panelMesh.position.set(0, 1.45, -3.11); panelMesh.rotation.y = Math.PI; rootGrp.add(panelMesh);
    shellMesh.position.z = (lenVal / 2) + (-1.1);
  }
  const glassMesh = new THREE.Mesh(sweepProfile(glasshouseShape(cabSpec), widVal * 0.86, 0.05, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x10151c, metalness: 0.9, roughness: 0.12 }));
  if (truckFlag) glassMesh.position.z = (lenVal / 2) + (-1.1);
  rootGrp.add(glassMesh);

  const trimMatRef = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.7 });
  const darkTrimMat = trimMatRef;
  const paintMat = paintMatRef;
  const carGroup = rootGrp;
  const spec = specObj;
  const specLen = lenVal;
  const specWid = widVal;
  const buildOpts = oBag;
  for (const signVal of [-1, 1]) {
    const bumperMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal * 0.94, 0.2, 0.28), trimMatRef);
    bumperMesh.position.set(0, 0.3, signVal * ((lenVal / 2) + (-0.02))); rootGrp.add(bumperMesh);
    const skirtMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, lenVal * 0.55), trimMatRef);
    skirtMesh.position.set(signVal * ((widVal / 2) + (-0.01)), 0.24, 0); rootGrp.add(skirtMesh);
  }
  for (const signVal of [-1, 1]) {
    const stalkMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), trimMatRef);
    stalkMesh.position.set(signVal * (0.04 + (widVal / 2)), 1.0, lenVal * 0.18); rootGrp.add(stalkMesh);
    const mirrorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), paintMatRef);
    mirrorMesh.position.set(signVal * (0.11 + (widVal / 2)), 1.02, lenVal * 0.18); rootGrp.add(mirrorMesh);
  }

  const kindForWheels = specObj.body;
  const tyreRad = (kindForWheels === 'suv' || kindForWheels === 'truck' || kindForWheels === 'van') ? 0.42
    : kindForWheels === 'kei' ? 0.28
    : (kindForWheels === 'sedan' || kindForWheels === 'wagon') ? 0.34
    : 0.33;
  const tyreRadius = tyreRad;
  const wheelBaseLen = 0.62 * lenVal;
  const tyreGeoObj = new THREE.CylinderGeometry(tyreRad, tyreRad, 0.24, 20);
  tyreGeoObj.rotateZ(Math.PI / 2);
  const hubGeoObj = new THREE.CylinderGeometry(0.62 * tyreRad, 0.62 * tyreRad, 0.26, 12);
  hubGeoObj.rotateZ(Math.PI / 2);
  const tyreMatObj = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const hubMatObj = new THREE.MeshStandardMaterial({ color: specObj.wheels || 0xc0c0c0, metalness: 0.85, roughness: 0.3 });
  const pivotsByKey = {};
  const wheelPivots = pivotsByKey;
  const archGeoObj = new THREE.TorusGeometry(0.06 + tyreRad, 0.045, 6, 14, Math.PI);
  const archMatObj = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.8 });
  const mountWheel = (keyTxt, signX, signZ) => {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(signX * ((widVal / 2) + (-0.02)), tyreRad, signZ * (wheelBaseLen / 2));
    rootGrp.add(pivotGrp);
    pivotGrp.add(new THREE.Mesh(tyreGeoObj, tyreMatObj));
    pivotGrp.add(new THREE.Mesh(hubGeoObj, hubMatObj));
    let spokeNo = 0;
    while (spokeNo !== 5) {
      const spokeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.27, tyreRad * 0.16, tyreRad * 0.9), hubMatObj);
      spokeMesh.rotation.x = (spokeNo / 5) * Math.PI;
      pivotGrp.add(spokeMesh);
      spokeNo += 1;
    }
    const archMesh = new THREE.Mesh(archGeoObj, archMatObj);
    archMesh.position.set(signX * (0.03 + (widVal / 2)), tyreRad, signZ * (wheelBaseLen / 2));
    archMesh.rotation.y = Math.PI / 2;
    rootGrp.add(archMesh);
    pivotsByKey[keyTxt] = pivotGrp;
    return pivotGrp; };
  [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]].forEach(([keyTxt, signX, signZ]) => mountWheel(keyTxt, signX, signZ));

  const headMatObj = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.7, roughness: 0.2 });
  const headMat = headMatObj;
  const sideSigns = [-1, 1];
  const decalSides = sideSigns;
  if (specObj.popups) {
    for (const signVal of [-1, 1]) {
      const popupMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), headMatObj);
      popupMesh.position.set(signVal * widVal * 0.28, 0.86, (lenVal / 2) + (-0.32));
      popupMesh.rotation.x = -0.25; rootGrp.add(popupMesh);
    } } else {
    for (const signVal of [-1, 1]) {
      const lampMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), headMatObj);
      lampMesh.scale.set(1.5, 0.55, 0.5);
      lampMesh.position.set(signVal * widVal * 0.3, 0.72, (lenVal / 2) + (-0.05)); rootGrp.add(lampMesh);
    }
  }
  const tailMatObj = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.8 });
  const tailMat = tailMatObj;
  if (specObj.roundTail) {
    const unitTotal = specObj.tail === 'quadWing' ? 4 : 2;
    for (let unitNo = 0; unitNo < unitTotal; unitNo += 1) {
      const unitGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12);
      unitGeo.rotateX(Math.PI / 2);
      const unitMesh = new THREE.Mesh(unitGeo, tailMatObj);
      unitMesh.position.set((unitNo + (-((unitTotal + (-1)) / 2))) * 0.24, 0.78, (-lenVal / 2) + (-0.02));
      rootGrp.add(unitMesh);
    } } else {
    const barMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal * 0.7, 0.09, 0.05), tailMatObj);
    barMesh.position.set(0, 0.78, (-lenVal / 2) + (-0.02));
    rootGrp.add(barMesh);
  }
  rootGrp.userData.tailMat = tailMatObj;
  rootGrp.userData.headMat = headMatObj;

  const tailKindTxt = specObj.tail;
  const hasWing = tailKindTxt === 'roundWing' || tailKindTxt === 'quadWing' || tailKindTxt === 'wing';
  if (hasWing) {
    const bladeMesh = new THREE.Mesh(tailKindTxt === 'roundWing'
      ? new THREE.TorusGeometry(widVal * 0.42, 0.045, 6, 16, Math.PI)
      : new THREE.BoxGeometry(widVal * 0.88, 0.05, 0.3), trimMatRef);
    if (tailKindTxt === 'roundWing') {
      bladeMesh.rotation.z = 0; bladeMesh.rotation.y = Math.PI / 2; bladeMesh.rotation.x = Math.PI;
      bladeMesh.scale.set(1, 1, 0.4); bladeMesh.position.set(0, 1.12, 0.1 + (-lenVal / 2));
    } else { /* flat blade */
      bladeMesh.position.set(0, 1.18, 0.08 + (-lenVal / 2)); bladeMesh.rotation.x = -0.12;
    }
    rootGrp.add(bladeMesh);
    for (const signVal of sideSigns) {
      const strutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), trimMatRef);
      strutMesh.position.set(signVal * widVal * 0.3, 1.0, 0.1 + (-lenVal / 2)); rootGrp.add(strutMesh);
    }
  } else if (tailKindTxt === 'ducktail' || tailKindTxt === 'lip') {
    const lipMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal * 0.8, 0.06, tailKindTxt === 'ducktail' ? 0.28 : 0.14), paintMatRef);
    lipMesh.position.set(0, 0.98, 0.08 + (-lenVal / 2));
    lipMesh.rotation.x = tailKindTxt === 'ducktail' ? -0.35 : -0.15; rootGrp.add(lipMesh);
  }

  const liveryVal = oBag.livery || specObj.livery;
  if (liveryVal) {
    const liveryTexObj = paintLiveryCanvas((liveryVal === 'hero-supra' || liveryVal === 'hero-gtr') ? liveryVal : liveryVal, paintVal);
    for (const signVal of sideSigns) {
      const decalMesh = new THREE.Mesh(new THREE.PlaneGeometry(lenVal * 0.72, 0.55),
        new THREE.MeshBasicMaterial({ map: liveryTexObj, transparent: true }));
      decalMesh.position.set(signVal * (0.085 + (widVal / 2)), 0.62, 0);
      decalMesh.rotation.y = signVal > 0 ? Math.PI / 2 : -Math.PI / 2; rootGrp.add(decalMesh);
    }
    if (specObj.id === 'hero-supra' || liveryVal === 'hero-supra') {
      const hoodMesh = new THREE.Mesh(new THREE.BoxGeometry(widVal * 0.9, 0.03, lenVal * 0.3), trimMatRef);
      hoodMesh.position.set(0, 0.93, lenVal * 0.28); rootGrp.add(hoodMesh); }
  }
  if (specObj.lightbar) {
    const footMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.3), trimMatRef);
    footMesh.position.set(0, 1.32, 0.1); rootGrp.add(footMesh);
    const redMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.4 }));
    redMesh.position.set(-0.28, 1.4, 0.1); rootGrp.add(redMesh);
    const blueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 1.4 }));
    blueMesh.position.set(0.28, 1.4, 0.1); rootGrp.add(blueMesh);
    const redGlow = glowSprite(0xff3344, 2.4);
    redGlow.position.set(-0.28, 1.45, 0.1); rootGrp.add(redGlow);
    const blueGlow = glowSprite(0x3366ff, 2.4);
    blueGlow.position.set(0.28, 1.45, 0.1); rootGrp.add(blueGlow);
    rootGrp.userData.lightbar = { red: redMesh, blue: blueMesh, gr: redGlow, gb: blueGlow }; }
  if (liveryVal === 'taxi') {
    const signMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 }));
    signMesh.position.set(0, 1.36, 0.1); rootGrp.add(signMesh); }
  addUnderglow(rootGrp, specObj, oBag); addBlobShadow(rootGrp, specObj);
  rootGrp.userData.wheels = pivotsByKey; rootGrp.userData.wheelR = tyreRad;
  return rootGrp; }

// Gathers the police-car pieces that stay visible after the GLB swap:
// wheels, lightbar bits, sprites and the flat ground shadow.
function collectPoliceKeepSet(rootObj, dataBag, fallbackWheels) {
  const keepSet = new Set();
  const wheelsMap = dataBag.wheels || fallbackWheels || {};
  for (const wheelObj of Object.values(wheelsMap)) if (wheelObj) keepSet.add(wheelObj);
  const barParts = [];
  const barBag = dataBag.lightbar || null;
  if (barBag) {
    for (const partKey of ['red', 'blue', 'gr', 'gb']) if (barBag[partKey]) barParts.push(barBag[partKey]); }
  if (dataBag.barRed) barParts.push(dataBag.barRed);
  if (dataBag.barBlue) barParts.push(dataBag.barBlue);
  for (const partObj of barParts) keepSet.add(partObj);
  let footMesh = null;
  const refMesh = barParts.find((partObj) => partObj && partObj.position && partObj.geometry && partObj.geometry.type === 'BoxGeometry') || barParts[0];
  if (refMesh) {
    for (const childObj of rootObj.children) {
      if (keepSet.has(childObj) || !childObj.isMesh || !childObj.position) continue;
      const sameZ = Math.abs(childObj.position.z + (-refMesh.position.z)) < 0.01;
      const justUnder = childObj.position.y < refMesh.position.y && (refMesh.position.y + (-childObj.position.y)) < 0.2;
      if (sameZ && justUnder) { footMesh = childObj; break; } }
  }
  if (footMesh) keepSet.add(footMesh);
  for (const childObj of rootObj.children) {
    if (childObj.isSprite) keepSet.add(childObj);
    else if (childObj.isMesh && childObj.geometry && childObj.geometry.type === 'PlaneGeometry' && Math.abs(childObj.rotation.x + Math.PI / 2) < 0.01) keepSet.add(childObj); }
  return { keepSet, wheelsByKey: wheelsMap, barPartList: barParts, baseBoxMesh: footMesh, refBarMesh: refMesh };
}

export function applyNpcPoliceGlb(vehRec) {
  try { if (!vehRec || vehRec.glbSwapped) return;
    const rootObj = vehRec.mesh || vehRec;
    if (!rootObj || !rootObj.children || !rootObj.userData) return;
    vehRec.glbSwapped = true;
    if (rootObj !== vehRec) rootObj.userData.glbSwapped = true;
    loadHeroAsset('npcPolice').then((wrapObj) => {
      try { if (!wrapObj) {
          vehRec.glbSwapped = false;
          if (rootObj !== vehRec) rootObj.userData.glbSwapped = false;
          return;
        }
        const dataBag = rootObj.userData;
        const gathered = collectPoliceKeepSet(rootObj, dataBag, vehRec.wheels);
        const keepSet = gathered.keepSet, wheelsMap = gathered.wheelsByKey;
        const barParts = gathered.barPartList, footMesh = gathered.baseBoxMesh, refMesh = gathered.refBarMesh;
        [...grp.children].forEach((childObj) => { if (!keepSet.has(childObj)) childObj.visible = false; });
        const cloneObj = wrapObj.clone ? wrapObj.clone(true) : wrapObj;
        cloneObj.position.set(0, 0, 0); rootObj.add(cloneObj); dataBag.npcPoliceGlb = cloneObj;
        for (const wheelObj of Object.values(wheelsMap)) {
          if (!wheelObj || !wheelObj.position) continue;
          const frontFlag = !(wheelObj.position.z < 0);
          wheelObj.position.z = frontFlag ? 1.31 : -1.55;
          wheelObj.position.x = wheelObj.position.x < 0 ? -0.80 : 0.80; }
        const liftList = footMesh ? [footMesh, ...barParts] : barParts;
        if (liftList.length) {
          let liftY;
          if (footMesh) liftY = 1.40 + (-footMesh.position.y);
          else if (refMesh) liftY = 1.48 + (-refMesh.position.y);
          else liftY = 0;
          if (liftY) for (const partObj of liftList)
            if (partObj && partObj.position) partObj.position.y += liftY; }
      } catch (e) { /* swap is best-effort */ }
    }).catch(() => { vehRec.glbSwapped = false; });
  } catch (e) { /* same */ } }

export function applyLuminanceTint(rootObj, tintVal) {
  if (!rootObj) return;
  const retintMat = (srcMat) => {
    const cloneMat = srcMat.clone();
    cloneMat.onBeforeCompile = (shaderBag) => {
      shaderBag.uniforms.uTint = { value: new THREE.Color(tintVal) };
      shaderBag.fragmentShader = shaderBag.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
        .replace('#include <map_fragment>', ['#include <map_fragment>', 'float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));', 'diffuseColor.rgb = uTint * (0.22 + 1.05 * lum);'].join('\n'));
    };
    cloneMat.customProgramCacheKey = () => 'npc-luminance-tint';
    return cloneMat; };
  rootObj.traverse((nodeObj) => {
    if (!nodeObj.isMesh || !nodeObj.material) return;
    nodeObj.material = Array.isArray(nodeObj.material) ? nodeObj.material.map(retintMat) : retintMat(nodeObj.material); }); }

export function applyNpcSedanGlb(vehRec, tintVal) {
  try { if (!vehRec || vehRec.glbSwapped) return;
    const rootObj = vehRec.mesh || vehRec;
    if (!rootObj || !rootObj.children || !rootObj.userData) return;
    vehRec.glbSwapped = true;
    if (rootObj !== vehRec) rootObj.userData.glbSwapped = true;
    loadHeroAsset('npcSedan').then((wrapObj) => {
      try { if (!wrapObj) {
          vehRec.glbSwapped = false;
          if (rootObj !== vehRec) rootObj.userData.glbSwapped = false; return; }
        const dataBag = rootObj.userData, keepSet = new Set();
        const wheelsMap = dataBag.wheels || vehRec.wheels || {};
        for (const wheelObj of Object.values(wheelsMap)) if (wheelObj) keepSet.add(wheelObj);
        for (const childObj of rootObj.children) {
          if (childObj.isSprite) keepSet.add(childObj);
          else if (childObj.isMesh && childObj.geometry && childObj.geometry.type === 'PlaneGeometry' && Math.abs(childObj.rotation.x + Math.PI / 2) < 0.01) keepSet.add(childObj); }
        [...grp.children].forEach((childObj) => { if (!keepSet.has(childObj)) childObj.visible = false; });
        const cloneObj = wrapObj.clone ? wrapObj.clone(true) : wrapObj;
        cloneObj.position.set(0, 0, 0); cloneObj.rotation.y = -Math.PI / 2;
        applyLuminanceTint(cloneObj, tintVal);
        cloneObj.traverse((nodeObj) => { if (nodeObj && nodeObj.isMesh) nodeObj.castShadow = true; });
        rootObj.add(cloneObj); dataBag.npcSedanGlb = cloneObj;
        for (const wheelObj of Object.values(wheelsMap)) {
          if (!wheelObj || !wheelObj.position) continue;
          const frontFlag = !(wheelObj.position.z < 0);
          wheelObj.position.z = frontFlag ? 1.19 : -1.66;
          wheelObj.position.x = wheelObj.position.x < 0 ? -0.80 : 0.80; }
      } catch (e) { /* swap is best-effort */ }
    }).catch(() => { vehRec.glbSwapped = false; });
  } catch (e) { /* same */ } }

export function applyNpcTaxiGlb(vehRec) {
  try { if (!vehRec || vehRec.glbSwapped) return;
    const rootObj = vehRec.mesh || vehRec;
    if (!rootObj || !rootObj.children || !rootObj.userData) return;
    vehRec.glbSwapped = true;
    if (rootObj !== vehRec) rootObj.userData.glbSwapped = true;
    loadHeroAsset('npcTaxi').then((wrapObj) => {
      try { if (!wrapObj) {
          vehRec.glbSwapped = false;
          if (rootObj !== vehRec) rootObj.userData.glbSwapped = false; return; }
        const dataBag = rootObj.userData, keepSet = new Set();
        const wheelsMap = dataBag.wheels || vehRec.wheels || {};
        for (const wheelObj of Object.values(wheelsMap)) if (wheelObj) keepSet.add(wheelObj);
        for (const childObj of rootObj.children) {
          if (childObj.isSprite) keepSet.add(childObj);
          else if (childObj.isMesh && childObj.geometry && childObj.geometry.type === 'PlaneGeometry' && Math.abs(childObj.rotation.x + Math.PI / 2) < 0.01) keepSet.add(childObj); }
        [...grp.children].forEach((childObj) => { if (!keepSet.has(childObj)) childObj.visible = false; });
        const cloneObj = wrapObj.clone ? wrapObj.clone(true) : wrapObj;
        cloneObj.position.set(0, 0, 0);
        cloneObj.traverse((nodeObj) => { if (nodeObj && nodeObj.isMesh) nodeObj.castShadow = true; });
        rootObj.add(cloneObj); dataBag.npcTaxiGlb = cloneObj;
        for (const wheelObj of Object.values(wheelsMap)) {
          if (!wheelObj || !wheelObj.position) continue;
          const frontFlag = !(wheelObj.position.z < 0);
          wheelObj.position.z = frontFlag ? 1.20 : -1.34;
          wheelObj.position.x = wheelObj.position.x < 0 ? -0.80 : 0.80; }
      } catch (e) { /* swap is best-effort */ }
    }).catch(() => { vehRec.glbSwapped = false; });
  } catch (e) { /* same */ } }

// A soft tinted light pool under the car, on a radial-gradient plane.
function addUnderglow(rootGrp, specObj, oBag) {
  const tintVal = oBag && oBag.glow !== undefined ? oBag.glow : specObj.glow;
  if (!tintVal) return;
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 128;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(specObj.wid * 1.25, specObj.len * 1.25),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cnv), color: tintVal, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowMesh.rotation.x = -Math.PI / 2; glowMesh.position.y = 0.06; rootGrp.add(glowMesh);
}
function addBlobShadow(rootGrp, specObj) {
  const blobMesh = new THREE.Mesh(new THREE.PlaneGeometry(specObj.wid + 0.5, specObj.len + 0.5),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  blobMesh.rotation.x = -Math.PI / 2; blobMesh.position.y = 0.03; rootGrp.add(blobMesh);
}

const HERO_SPEC_IDS = new Set(['taiyo', 'hero-supra']);
let heroTemplate = null;
let heroLoadDone = false;
const heroWaitQueue = [];
const populateGlbCar = (rootGrp, specObj, oBag) => {
  rootGrp.add(heroTemplate.clone(true));
  addUnderglow(rootGrp, specObj, oBag);
  addBlobShadow(rootGrp, specObj);
  const pivotsByKey = {};
  for (const [keyTxt, signX, signZ] of [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]]) {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(0.80 * signX, 0.34, 1.42 * signZ);
    rootGrp.add(pivotGrp); pivotsByKey[keyTxt] = pivotGrp; }
  rootGrp.userData.wheels = pivotsByKey;
  rootGrp.userData.wheelR = 0.34;
  rootGrp.userData.tailMat = null; rootGrp.userData.headMat = null;
  rootGrp.userData.visualMode = 'glb';
  return rootGrp; };
const buildGlbCarMesh = (specObj, oBag) => populateGlbCar(new THREE.Group(), specObj, oBag);

const swapHeroCarToGlb = (queueItem) => {
  try { const vehRec = queueItem.v;
    if (!vehRec || !vehRec.mesh || !vehRec.mesh.parent) return;
    if (vehRec.mesh.userData.visualMode === 'glb') return;
    if (!vehRec._procChildren) {
      while (vehRec.mesh.children.length) vehRec.mesh.remove(vehRec.mesh.children[0]);
    } else { /* staged children only */ /* staged children only */
      for (const childObj of [...vehRec.mesh.children])
        if (vehRec._procChildren.has(childObj)) vehRec.mesh.remove(childObj); }
    populateGlbCar(vehRec.mesh, queueItem.spec, { glow: queueItem.glow });
    vehRec.wheels = vehRec.mesh.userData.wheels; vehRec._procChildren = null;
  } catch (e) { /* procedural mesh stays */ }
};
try { loadHeroAsset('heroCar').then((wrapObj) => {
    try { heroLoadDone = true;
      if (!wrapObj) { heroWaitQueue.length = 0; return; }
      heroTemplate = wrapObj;
      heroWaitQueue.splice(0).forEach((queueItem) => swapHeroCarToGlb(queueItem));
    } catch (e) { /* queue stays for the next attempt */ }
  }).catch(() => { heroLoadDone = true; heroWaitQueue.length = 0; });
} catch (e) { heroLoadDone = true; }

// GTR paint as a shader patch banded by local height: dark kit at the
// bottom, a red stripe through the middle, brighter panels on top.
function applyGtrPaint(rootObj) {
  if (!rootObj) return;
  const repaintMat = (srcMat) => {
    const cloneMat = srcMat.clone();
    cloneMat.onBeforeCompile = (shaderBag) => {
      shaderBag.vertexShader = shaderBag.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
      shaderBag.fragmentShader = shaderBag.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
        .replace('#include <map_fragment>', ['#include <map_fragment>', 'vec3 gtrBase = diffuseColor.rgb;', 'vec3 gtrKit = mix(gtrBase * 0.25, vec3(0.012, 0.012, 0.014), 0.75);', 'vec3 gtrStripe = vec3(0.85, 0.04, 0.05);', 'vec3 gtrUpper = gtrBase * 1.18;', 'float gtrToStripe = smoothstep(0.095 - 0.006, 0.095 + 0.006, vLocalY);', 'float gtrToUpper = smoothstep(0.125 - 0.006, 0.125 + 0.006, vLocalY);', 'diffuseColor.rgb = mix(mix(gtrKit, gtrStripe, gtrToStripe), gtrUpper, gtrToUpper);'].join('\n'));
    };
    cloneMat.customProgramCacheKey = () => 'gtr35-livery';
    return cloneMat; };
  rootObj.traverse((nodeObj) => {
    if (!nodeObj.isMesh || !nodeObj.material) return;
    nodeObj.material = Array.isArray(nodeObj.material) ? nodeObj.material.map(repaintMat) : repaintMat(nodeObj.material); }); }
const GTR_SPEC_IDS = new Set(['gtr35']);
let gtrTemplate = null;
let gtrLoadDone = false;
const gtrWaitQueue = [];
const populateGtrCar = (rootGrp, specObj, oBag) => {
  const cloneObj = gtrTemplate.clone(true);
  cloneObj.rotation.y = 0; applyGtrPaint(cloneObj); rootGrp.add(cloneObj);
  addUnderglow(rootGrp, specObj, oBag); addBlobShadow(rootGrp, specObj);
  const pivotsByKey = {};
  for (const [keyTxt, posX, posZ] of [['fl', -0.80, 1.41], ['fr', 0.80, 1.41], ['rl', -0.80, -1.55], ['rr', 0.80, -1.55]]) {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(posX, 0.35, posZ); rootGrp.add(pivotGrp); pivotsByKey[keyTxt] = pivotGrp; }
  rootGrp.userData.wheels = pivotsByKey; rootGrp.userData.wheelR = 0.35;
  rootGrp.userData.tailMat = null; rootGrp.userData.headMat = null; rootGrp.userData.visualMode = 'glb';
  return rootGrp; };
const buildGtrCarMesh = (specObj, oBag) => populateGtrCar(new THREE.Group(), specObj, oBag);
const swapGtrCarToGlb = (queueItem) => {
  try { const vehRec = queueItem.v;
    if (!vehRec || !vehRec.mesh || !vehRec.mesh.parent) return;
    if (vehRec.mesh.userData.visualMode === 'glb') return;
    if (!vehRec._procChildren) {
      while (vehRec.mesh.children.length) vehRec.mesh.remove(vehRec.mesh.children[0]);
    } else {
      for (const childObj of [...vehRec.mesh.children])
        if (vehRec._procChildren.has(childObj)) vehRec.mesh.remove(childObj); }
    populateGtrCar(vehRec.mesh, queueItem.spec, { glow: queueItem.glow });
    vehRec.wheels = vehRec.mesh.userData.wheels; vehRec._procChildren = null;
  } catch (e) { /* procedural mesh stays */ }
};
try { loadHeroAsset('gtr35').then((wrapObj) => {
    try { gtrLoadDone = true;
      if (!wrapObj) { gtrWaitQueue.length = 0; return; }
      gtrTemplate = wrapObj;
      gtrWaitQueue.splice(0).forEach((queueItem) => swapGtrCarToGlb(queueItem));
    } catch (e) { /* queue stays for the next attempt */ }
  }).catch(() => { gtrLoadDone = true; gtrWaitQueue.length = 0; });
} catch (e) { gtrLoadDone = true; }

// Tail-light graphic for the SVJ: three glowing strokes forming a Y.
function buildSvjTailTexture() {
  const cnv = document.createElement('canvas');
  cnv.width = 256; cnv.height = 84;
  const ctx = cnv.getContext('2d');
  ctx.clearRect(0, 0, 256, 84);
  ctx.strokeStyle = '#ff1e1e'; ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.shadowColor = '#ff1e1e'; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(28, 8); ctx.lineTo(128, 46);
  ctx.moveTo(228, 8); ctx.lineTo(128, 46);
  ctx.moveTo(128, 46); ctx.lineTo(128, 76);
  ctx.stroke();
  const texOut = new THREE.CanvasTexture(cnv);
  texOut.colorSpace = THREE.SRGBColorSpace; return texOut;
}

// SVJ finishing kit: matte shader patch, canopy, Y tail lights, running
// light strips and red brake discs.
function applySvjFixes(wrapObj, vehRec, parentGrp) {
  const outcome = { tailMat: null, drlMat: null };
  if (!wrapObj) return outcome;
  const hostGrp = parentGrp || wrapObj;

  wrapObj.traverse((nodeObj) => {
    if (!nodeObj.isMesh || !nodeObj.material) return;
    const matteMat = (srcMat) => {
      const cloneMat = srcMat.clone();
      cloneMat.roughness = 0.58;
      cloneMat.metalness = 0.30;
      cloneMat.onBeforeCompile = (shaderBag) => {
        shaderBag.fragmentShader = shaderBag.fragmentShader.replace('#include <map_fragment>', ['#include <map_fragment>', 'diffuseColor.rgb = mix(diffuseColor.rgb * 0.30, vec3(0.016, 0.016, 0.018), 0.78);'].join('\n'));
      };
      cloneMat.customProgramCacheKey = () => 'svj-matte';
      return cloneMat; };
    nodeObj.material = Array.isArray(nodeObj.material) ? nodeObj.material.map(matteMat) : matteMat(nodeObj.material); });
  /* canopy and lights follow */

  const canopyPath = new THREE.Shape();
  canopyPath.moveTo(0.55, 0.80); canopyPath.lineTo(-0.35, 1.10); canopyPath.lineTo(-1.05, 1.08);
  canopyPath.lineTo(-1.45, 0.82); canopyPath.lineTo(-1.45, 0.74); canopyPath.lineTo(0.55, 0.74);
  canopyPath.closePath();
  const canopyGeoObj = new THREE.ExtrudeGeometry(canopyPath, { depth: 1.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, steps: 1 });
  canopyGeoObj.rotateY(-Math.PI / 2); canopyGeoObj.translate(0.62, 0, 0);
  hostGrp.add(new THREE.Mesh(canopyGeoObj, new THREE.MeshPhongMaterial({ color: 0x0d1216, specular: 0xbdd3e0, shininess: 90, transparent: true, opacity: 0.97 })));
  const tailTexObj = buildSvjTailTexture();
  const tailMatObj = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tailTexObj, map: tailTexObj, transparent: true, emissiveIntensity: 1.1 });
  for (const signVal of [-1, 1]) {
    const tailMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.28), tailMatObj);
    tailMesh.position.set(0.56 * signVal, 0.80, -2.46); tailMesh.rotation.y = Math.PI; hostGrp.add(tailMesh);
    const tailGlow = glowSprite(0xff2a22, 1.1);
    tailGlow.position.set(0.56 * signVal, 0.80, -2.52); hostGrp.add(tailGlow); }
  outcome.tailMat = tailMatObj;
  const drlMatObj = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf4f8ff, emissiveIntensity: 1.2, roughness: 0.3 });
  for (const signVal of [-1, 1]) {
    const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.07), drlMatObj);
    stripMesh.position.set(0.55 * signVal, 0.52, 2.44); hostGrp.add(stripMesh); }
  outcome.drlMat = drlMatObj;
  const discGeoObj = new THREE.CylinderGeometry(0.20, 0.20, 0.06, 20);
  discGeoObj.rotateZ(Math.PI / 2);
  const discMatObj = new THREE.MeshStandardMaterial({ color: 0xe02020, metalness: 0.2, roughness: 0.35 });
  for (const [posX, posZ] of [[-0.86, 1.40], [0.86, 1.40], [-0.86, -1.75], [0.86, -1.75]]) {
    const discMesh = new THREE.Mesh(discGeoObj, discMatObj);
    discMesh.position.set(posX, 0.36, posZ); hostGrp.add(discMesh); }
  if (vehRec) vehRec.svjTreatment = outcome;
  return outcome; }
const SVJ_SPEC_IDS = new Set(['svj']);
let svjTemplate = null;
let svjLoadDone = false;
const svjWaitQueue = [];
const populateSvjCar = (rootGrp, specObj, oBag) => {
  const cloneObj = svjTemplate.clone(true);
  const kitBag = applySvjFixes(cloneObj, null, rootGrp);
  rootGrp.add(cloneObj);
  addUnderglow(rootGrp, specObj, oBag);
  addBlobShadow(rootGrp, specObj);
  const pivotsByKey = {};
  for (const [keyTxt, posX, posZ] of [['fl', -0.88, 1.40], ['fr', 0.88, 1.40], ['rl', -0.88, -1.75], ['rr', 0.88, -1.75]]) {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(posX, 0.36, posZ); rootGrp.add(pivotGrp); pivotsByKey[keyTxt] = pivotGrp; }
  rootGrp.userData.wheels = pivotsByKey; rootGrp.userData.wheelR = 0.36;
  rootGrp.userData.tailMat = kitBag.tailMat; rootGrp.userData.headMat = kitBag.drlMat;
  rootGrp.userData.visualMode = 'glb';
  return rootGrp; };
const buildSvjCarMesh = (specObj, oBag) => populateSvjCar(new THREE.Group(), specObj, oBag);
const swapSvjCarToGlb = (queueItem) => {
  try { const vehRec = queueItem.v;
    if (!vehRec || !vehRec.mesh || !vehRec.mesh.parent) return;
    if (vehRec.mesh.userData.visualMode === 'glb') return;
    if (!vehRec._procChildren) {
      while (vehRec.mesh.children.length) vehRec.mesh.remove(vehRec.mesh.children[0]);
    } else {
      for (const childObj of [...vehRec.mesh.children])
        if (vehRec._procChildren.has(childObj)) vehRec.mesh.remove(childObj); }
    populateSvjCar(vehRec.mesh, queueItem.spec, { glow: queueItem.glow });
    vehRec.wheels = vehRec.mesh.userData.wheels; vehRec._procChildren = null;
    if (vehRec._brakeStaged && vehRec.mesh.userData.tailMat) vehRec.mesh.userData.tailMat.emissiveIntensity = 2.4;
  } catch (e) { /* procedural mesh stays */ }
};
try { loadHeroAsset('lamboSvj').then((wrapObj) => {
    try { svjLoadDone = true;
      if (!wrapObj) { svjWaitQueue.length = 0; return; }
      svjTemplate = wrapObj;
      svjWaitQueue.splice(0).forEach((queueItem) => swapSvjCarToGlb(queueItem));
    } catch (e) { /* queue stays for the next attempt */ }
  }).catch(() => { svjLoadDone = true; svjWaitQueue.length = 0; });
} catch (e) { svjLoadDone = true; }

const PARKED_PASTELS = [0xffb7d5, 0xb8e6c9, 0xfff3d6, 0xaed6f7, 0xffcf9f, 0xd5f5e3, 0xfdebd0, 0xd6eaf8, 0xd9c7ec, 0xfdf6b2, 0xf5a58d];

export function spawnVehicle(G, specIdTxt, bornX, bornZ, bornAngle, optsIn) {
  const oBag = optsIn || {};
  if (oBag.driver === 'parked' && oBag.color == null && !oBag.livery && rnd() < 0.7) {
    oBag.color = pick(PARKED_PASTELS);
  }
  const specFull = { ...CARS[specIdTxt], id: specIdTxt };
  const heroFlag = HERO_SPEC_IDS.has(specIdTxt);
  const gtrFlag = GTR_SPEC_IDS.has(specIdTxt);
  const svjFlag = SVJ_SPEC_IDS.has(specIdTxt);
  const meshObj = svjFlag && svjTemplate ? buildSvjCarMesh(specFull, oBag)
    : gtrFlag && gtrTemplate ? buildGtrCarMesh(specFull, oBag)
    : heroFlag && heroTemplate ? buildGlbCarMesh(specFull, oBag)
    : makeCarMesh(specFull, oBag.color, oBag);

  meshObj.traverse((nodeObj) => {
    if (nodeObj && nodeObj.isMesh && !(nodeObj.geometry && nodeObj.geometry.type === 'PlaneGeometry' && Math.abs(nodeObj.rotation.x + Math.PI / 2) < 0.01)) {
      nodeObj.castShadow = true;
    }
  });
  meshObj.position.set(bornX, groundH(bornX, bornZ) + 0.02, bornZ);
  meshObj.rotation.y = bornAngle || 0; G.scene.add(meshObj);
  const vehRec = { spec: specFull, specId: specIdTxt, mesh: meshObj, angle: bornAngle || 0, speed: 0, health: 100,
    driver: oBag.driver || 'parked', color: oBag.color != null ? oBag.color : specFull.color,
    wheels: meshObj.userData.wheels, steerVis: 0, x: bornX, z: bornZ, target: null, lane: oBag.lane || 0, smokeT: 0 };
  armFxHook(G);
  const maybeQueue = (flagVal, templateObj, doneFlag, queueList) => {
    if (flagVal && !templateObj && !doneFlag) {
      vehRec._procChildren = new Set(meshObj.children);
      queueList.push({ v: vehRec, spec: specFull, glow: oBag.glow }); }
  };
  maybeQueue(heroFlag, heroTemplate, heroLoadDone, heroWaitQueue);
  maybeQueue(gtrFlag, gtrTemplate, gtrLoadDone, gtrWaitQueue);
  maybeQueue(svjFlag, svjTemplate, svjLoadDone, svjWaitQueue);
  if (!G.vehicles) G.vehicles = [];
  G.vehicles.push(vehRec); return vehRec; }

const TRAFFIC_SPEC_IDS = ['sedan', 'hatch', 'suv', 'wagon', 'kei', 'hachi', 'van', 'sora15', 'roadster', 'taxi', 'sedan', 'hatch', 'suv', 'taxi'];

const TRAFFIC_PAINTS = [0xb9c0c7, 0x3f8cff, 0xd95555, 0x44484e, 0xf2f2f2, 0x5a7d4f, 0xffd23f, 0x707880, 0x8a4fd0, 0x2a9d8f, 0xffb7d5, 0xb8e6c9, 0xfff3d6, 0xaed6f7, 0xffcf9f, 0xd5f5e3, 0xfdebd0, 0xd6eaf8, 0xf5c6e0, 0xe8daef];

const SEDAN_TINT_LIST = [0xc0c4c8, 0xe9e9e6, 0x3a3d42, 0x6e1420, 0x44586e, 0x77694f, 0xe8a7bf, 0x9fc3e8];
let sedanSpawnIdx = 0;

export function spawnTraffic(G, wantCount) {
  if (!G.traffic) G.traffic = [];
  const totalToMake = Math.round((wantCount * 16) / 7);
  for (let madeNo = 0; madeNo < totalToMake; ++madeNo) {
    let alongXFlag = rnd() < 0.5;
    let lineCoord = pick(alongXFlag ? G.roadX : G.roadZ);

    if (rnd() < 0.45) {
      const mainPick = pick(['blvd', 'blvd', 'x0', 'z0']);
      if (mainPick === 'blvd' && Array.isArray(G.roadZ) && G.roadZ.includes(495)) {
        alongXFlag = false; lineCoord = 495;
      } else if (mainPick === 'x0' && Array.isArray(G.roadX) && G.roadX.includes(0)) {
        alongXFlag = true; lineCoord = 0;
      } else if (mainPick === 'z0' && Array.isArray(G.roadZ) && G.roadZ.includes(0)) {
        alongXFlag = false; lineCoord = 0; }
    }
    const alongCoord = rr(-600, 600);
    const signVal = rnd() < 0.5 ? 1 : -1;
    const laneOff = 5 * signVal;
    const bornX = alongXFlag ? lineCoord + laneOff : alongCoord;
    const bornZ = alongXFlag ? alongCoord : lineCoord + (-laneOff);
    const bornAngle = alongXFlag ? (signVal > 0 ? 0 : Math.PI) : (signVal > 0 ? Math.PI / 2 : -Math.PI / 2);
    const specPick = pick(TRAFFIC_SPEC_IDS);
    const vehRec = spawnVehicle(G, specPick, bornX, bornZ, bornAngle, { color: specPick === 'taxi' ? CARS.taxi.color : pick(TRAFFIC_PAINTS), driver: 'traffic' });
    if (specPick === 'sedan') {
      const tintVal = SEDAN_TINT_LIST[sedanSpawnIdx % SEDAN_TINT_LIST.length];
      ++sedanSpawnIdx; applyNpcSedanGlb(vehRec, tintVal); }
    if (specPick === 'taxi') applyNpcTaxiGlb(vehRec);
    vehRec.onX = alongXFlag; vehRec.line = lineCoord; vehRec.dirSign = signVal;
    vehRec.cruise = rr(22, 38) / 3.6;
    vehRec.speed = vehRec.cruise;
    G.traffic.push(vehRec);
  }
}

// Wheel spin bookkeeping in three sweeps, as the older build did it:
// step the rotation, re-add the current angle, then store total spin.
function spinTrafficWheels(vehRec, stepVal, dtVal) {
  for (const keyTxt of ['fl', 'fr', 'rl', 'rr']) {
    const wheelObj = vehRec.wheels[keyTxt];
    if (wheelObj) wheelObj.rotation.x += dtVal * (stepVal / dtVal); }
  for (const keyTxt of ['fl', 'fr', 'rl', 'rr']) {
    const wheelObj = vehRec.wheels[keyTxt];
    if (wheelObj) wheelObj.rotation.x = 0 + (wheelObj.rotation.x || 0); }
  for (const keyTxt of ['fl', 'fr', 'rl', 'rr']) {
    const wheelObj = vehRec.wheels[keyTxt];
    if (wheelObj) {
      wheelObj.userData.spin = (wheelObj.userData.spin || 0) + ((vehRec.speed * dtVal) / 0.33);
      wheelObj.rotation.set(wheelObj.userData.spin, 0, 0); } }
}

export function updateTraffic(G, dtVal) {
  if (!G.traffic) return;
  const anchorX = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const anchorZ = G.car ? G.car.z : (G.player ? G.player.z : 0);
  const nightFlag = G.timeOfDay > 18.5 || G.timeOfDay < 5.5;
  for (const vehRec of G.traffic) {
    if (vehRec.driver !== 'traffic') continue;
    const distAway = Math.hypot(vehRec.x + (-anchorX), vehRec.z + (-anchorZ));
    if (distAway > 500) {
      const alongXFlag = rnd() < 0.5;
      const roadPick = pick(alongXFlag ? G.roadX : G.roadZ);
      vehRec.onX = alongXFlag;
      vehRec.line = roadPick;
      vehRec.dirSign = rnd() < 0.5 ? 1 : -1;
      const anchorCoord = alongXFlag ? anchorZ : anchorX;
      const alongCoord = Math.max(-640, Math.min(640, rr(-260, 260) + anchorCoord));
      vehRec.x = alongXFlag ? roadPick + (vehRec.dirSign * 5) : alongCoord;
      vehRec.z = alongXFlag ? alongCoord : roadPick + (-(vehRec.dirSign * 5));
      vehRec.speed = vehRec.cruise;
    }

    let blockedFlag = false;
    for (const otherRec of G.traffic) {
      if (otherRec === vehRec) continue;
      const gapX = otherRec.x + (-vehRec.x);
      const gapZ = otherRec.z + (-vehRec.z);
      const fwdX = Math.sin(vehRec.angle);
      const fwdZ = Math.cos(vehRec.angle);
      const aheadAmt = (gapX * fwdX) + (gapZ * fwdZ);
      const sideAmt = Math.abs((gapX * fwdZ) + (-(gapZ * fwdX)));
      if (aheadAmt > 0 && aheadAmt < 9 && sideAmt < 2.2) {
        blockedFlag = true;
        break;
      }
    }
    if (G.car && G.car !== vehRec) {
      const gapX = G.car.x + (-vehRec.x);
      const gapZ = G.car.z + (-vehRec.z);
      const aheadAmt = (gapX * Math.sin(vehRec.angle)) + (gapZ * Math.cos(vehRec.angle));
      const sideAmt = Math.abs((gapX * Math.cos(vehRec.angle)) + (-(gapZ * Math.sin(vehRec.angle))));
      if (aheadAmt > 0 && aheadAmt < 9 && sideAmt < 2.4) blockedFlag = true;
    }

    const goalSpeed = blockedFlag ? 0 : vehRec.cruise * (vehRec.health < 35 ? 0.72 : 1);
    vehRec.speed += Math.max(-8 * dtVal, Math.min(3 * dtVal, goalSpeed + (-vehRec.speed)));

    vehRec.x += dtVal * (Math.sin(vehRec.angle) * vehRec.speed);
    vehRec.z += dtVal * (Math.cos(vehRec.angle) * vehRec.speed);
    const crossingList = vehRec.onX ? G.roadZ : G.roadX;
    const alongCoord = vehRec.onX ? vehRec.z : vehRec.x;
    for (const crossCoord of crossingList) {
      if (Math.abs(alongCoord + (-crossCoord)) < 1.2 && Math.abs(vehRec.speed) > 1 && rnd() < 0.35) {
        if (vehRec.onX) {
          vehRec.z = crossCoord; vehRec.line = crossCoord;
        } else {
          vehRec.x = crossCoord;
          vehRec.line = crossCoord;
        }
        vehRec.onX = !vehRec.onX;
        vehRec.dirSign = rnd() < 0.5 ? 1 : -1;
        if (vehRec.onX) {
          vehRec.x = vehRec.line + (vehRec.dirSign * 5);
          vehRec.angle = vehRec.dirSign > 0 ? 0 : Math.PI;
        } else { /* heading along Z */
          vehRec.z = vehRec.line + (-(vehRec.dirSign * 5));
          vehRec.angle = vehRec.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        break;
      }
    }

    if (vehRec.onX) vehRec.x += ((vehRec.line + (vehRec.dirSign * 5)) + (-vehRec.x)) * Math.min(1, 2 * dtVal);
    else vehRec.z += ((vehRec.line + (-(vehRec.dirSign * 5))) + (-vehRec.z)) * Math.min(1, 2 * dtVal);
    if (Math.abs(vehRec.x) > 655 || Math.abs(vehRec.z) > 655) {
      vehRec.angle += Math.PI;
      vehRec.dirSign *= -1;
      vehRec.x = Math.max(-650, Math.min(650, vehRec.x));
      vehRec.z = Math.max(-650, Math.min(650, vehRec.z));
    }
    vehRec.mesh.position.set(vehRec.x, groundH(vehRec.x, vehRec.z) + 0.02, vehRec.z);
    vehRec.mesh.rotation.y = vehRec.angle;
    const stepVal = (vehRec.speed * dtVal) / (vehRec.mesh.userData.wheelR || 0.33);
    spinTrafficWheels(vehRec, stepVal, dtVal);
    if (nightFlag && !vehRec.nightGlow) {
      const glowSpr = glowSprite(0xffe9a0, 2.2);
      glowSpr.position.set(0, 0.7, 0.4 + (vehRec.spec.len / 2));
      vehRec.mesh.add(glowSpr); vehRec.nightGlow = glowSpr;
    }
    if (!nightFlag && vehRec.nightGlow) {
      vehRec.mesh.remove(vehRec.nightGlow); vehRec.nightGlow = null;
    }
  }
}

export function damageVehicle(G, vehRec, dmgVal) {
  vehRec.health = Math.max(0, vehRec.health + (-dmgVal)); armFxHook(G);
  const hitPos = hoodPosWorld(vehRec, new THREE.Vector3());
  spawnSmokeAt(G, hitPos, 3, vehRec.health < 25);
  let burstNo = 0;
  while (burstNo < 3) { spawnDamagePuff(G, vehRec, false); ++burstNo; } }

export function darknessFactor(G) {
  const hourVal = (G && typeof G.timeOfDay === 'number') ? G.timeOfDay : 10.5;
  const dayAmt = Math.max(0, Math.min(1, Math.sin(((hourVal + (-6)) / 12) * Math.PI)));
  return 1 + (-dayAmt); }
const hoodPosWorld = (vehRec, outVec) => {
  const specBag = vehRec.spec || {};
  const hoodH = specBag.hood != null ? 0.62 + (specBag.hood * 0.28) : 0.85;
  outVec.set(0, hoodH, (specBag.len || 4.4) * 0.32);
  if (vehRec.mesh && vehRec.mesh.localToWorld) {
    vehRec.mesh.updateMatrixWorld(true); vehRec.mesh.localToWorld(outVec);
  } else { outVec.add(vehRec.mesh.position); }
  return outVec; };

// Smoke look by damage band: thick and dark when wrecked, mid grey in
// between, and only a faint wisp when the damage is light.
const bandForHealth = (healthVal) => {
  const bandRows = [
    { limit: 15, band: { rate: 12, color: 0x232528, s0: 0.9, s1: 3.2, op: 0.65 } },
    { limit: 40, band: { rate: 6, color: 0x777c83, s0: 0.7, s1: 2.4, op: 0.45 } },
  ];
  const hitRow = bandRows.find((rowObj) => healthVal < rowObj.limit);
  return hitRow ? hitRow.band : { rate: 2, color: 0xb8bcc0, s0: 0.5, s1: 1.6, op: 0.28 }; };
const hoodWorkVec = new THREE.Vector3();

export function spawnDamagePuff(G, vehRec, warmFlag, forcedAge) {
  buildSmokePool(G); if (!smokePool) return;
  const bandObj = bandForHealth(vehRec.health);
  for (const puffRec of smokePool) {
    if (puffRec.life > 0) continue;
    hoodPosWorld(vehRec, hoodWorkVec);
    const ageStart = typeof forcedAge === 'number' ? forcedAge : (warmFlag ? rr(0, 1.1) : 0);
    puffRec.kind = 'dmg'; puffRec.fire = false;
    puffRec.max = 1.4;
    puffRec.life = 1.4 + (-ageStart);
    puffRec.s0 = bandObj.s0;
    puffRec.s1 = bandObj.s1;
    puffRec.op = bandObj.op;
    puffRec.s.material.color.set(bandObj.color);
    puffRec.s.position.set(
      (ageStart * 0.3) + (hoodWorkVec.x + rr(-0.15, 0.15)),
      hoodWorkVec.y + (ageStart * 1.2),
      hoodWorkVec.z + rr(-0.15, 0.15));
    puffRec.vx = 0.3 + rr(-0.08, 0.08);
    puffRec.vy = 1.2 + rr(-0.2, 0.2);
    puffRec.vz = rr(-0.08, 0.08);
    const scaleStart = puffRec.s0 + ((puffRec.s1 + (-puffRec.s0)) * (ageStart / 1.4));
    puffRec.s.scale.set(scaleStart, scaleStart, 1);
    puffRec.s.visible = true;
    return;
  }
}

export function primeDamageSmoke(G, vehRec, wantCount) {
  const totalToMake = wantCount || 10;
  for (let puffNo = 0; puffNo < totalToMake; ++puffNo) {
    spawnDamagePuff(G, vehRec, true, totalToMake > 1 ? (puffNo / (totalToMake + (-1))) * 1.2 : 0);
  }
}

const headConeGeo = new THREE.ConeGeometry(1.15, 7, 20, 1, true);
headConeGeo.translate(0, -3.5, 0);
const headConeMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
function buildHeadlights(vehRec) {
  if (vehRec._hl || !vehRec.mesh || !vehRec.spec) return;
  const specBag = vehRec.spec, widVal = specBag.wid, lenVal = specBag.len;
  const spawnGlow = (tintVal, sizeVal, posX, posY, posZ) => {
    const sprObj = glowSprite(tintVal, sizeVal);
    sprObj.position.set(posX, posY, posZ); sprObj.userData.s25Light = true;
    vehRec.mesh.add(sprObj); return sprObj; };
  const lightBag = {};
  lightBag.glowL = spawnGlow(0xffe9a0, 1.25, -0.32 * widVal, 0.62, 0.12 + (lenVal / 2));
  lightBag.glowR = spawnGlow(0xffe9a0, 1.25, 0.32 * widVal, 0.62, 0.12 + (lenVal / 2));
  lightBag.tailL = spawnGlow(0xff2a22, 0.85, -0.32 * widVal, 0.72, -0.1 + (lenVal / -2));
  lightBag.tailR = spawnGlow(0xff2a22, 0.85, 0.32 * widVal, 0.72, -0.1 + (lenVal / -2));
  lightBag.cones = [];
  for (const signVal of [-1, 1]) {
    const coneMesh = new THREE.Mesh(headConeGeo, headConeMat.clone());
    coneMesh.position.set(signVal * widVal * 0.32, 0.58, lenVal / 2);
    coneMesh.rotation.x = 0.07 + (-Math.PI / 2);
    coneMesh.visible = false; coneMesh.userData.s25Light = true;
    vehRec.mesh.add(coneMesh); lightBag.cones.push(coneMesh); }
  vehRec._hl = lightBag;
}
function buildPlayerSpot(vehRec) {
  if (vehRec._hlSpot || !vehRec.mesh) return;
  const lenVal = vehRec.spec.len;
  const spotObj = new THREE.SpotLight(0xffe6b8, 0, 40, 0.5, 0.6);
  spotObj.position.set(0, 0.7, lenVal / 2);
  spotObj.target.position.set(0, 0, 18 + (lenVal / 2));
  spotObj.userData.s25Light = true;
  vehRec.mesh.add(spotObj); vehRec.mesh.add(spotObj.target);
  vehRec._hlSpot = spotObj; }
let fxHookArmed = false;
const armFxHook = (G) => {
  if (fxHookArmed || !G || !Array.isArray(G.updaters)) return;
  fxHookArmed = true;
  G.updaters.push((GInner, dtVal) => {
    try { updateDamageFx(GInner, dtVal || 0.016);
    } catch (e) { /* fx hook stays quiet */ }
  }); };

export function updateDamageFx(G, dtVal) {
  if (!G || !Array.isArray(G.vehicles)) return;
  const darkAmt = darknessFactor(G);
  const anchorX = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const anchorZ = G.car ? G.car.z : (G.player ? G.player.z : 0);

  const hurtList = [];
  for (const vehRec of G.vehicles)
    if (vehRec && vehRec.health < 70 && vehRec.mesh) hurtList.push(vehRec);
  hurtList.sort((recA, recB) => (((recA.x + (-anchorX)) ** 2) + ((recA.z + (-anchorZ)) ** 2)) + (-(((recB.x + (-anchorX)) ** 2) + ((recB.z + (-anchorZ)) ** 2))));
  const emitterBag = new Set(hurtList.slice(0, 10));
  const lightsFlag = darkAmt > 0.25;
  for (const vehRec of G.vehicles) {
    if (!vehRec || !vehRec.mesh) continue;
    buildHeadlights(vehRec);
    const lightBag = vehRec._hl;
    if (!lightBag) continue;
    const brakingFlag = vehRec._prevSpeed != null && dtVal > 0 && ((vehRec._prevSpeed + (-(vehRec.speed || 0))) / dtVal) > 2;
    vehRec._prevSpeed = vehRec.speed || 0;
    for (const sprObj of [lightBag.glowL, lightBag.glowR]) {
      sprObj.visible = lightsFlag; sprObj.material.opacity = 0.85 * darkAmt; }
    for (const sprObj of [lightBag.tailL, lightBag.tailR]) {
      sprObj.visible = lightsFlag; sprObj.material.opacity = darkAmt * (brakingFlag ? 0.95 : 0.4); }
    for (const coneMesh of lightBag.cones) {
      coneMesh.visible = lightsFlag; coneMesh.material.opacity = 0.10 * darkAmt; }
    if (emitterBag.has(vehRec)) {
      vehRec._smokeAcc = (vehRec._smokeAcc || 0) + (dtVal * bandForHealth(vehRec.health).rate);
      while (!(vehRec._smokeAcc < 1)) {
        vehRec._smokeAcc -= 1;
        spawnDamagePuff(G, vehRec, false);
      }
    }
  }

  if (G.car && G.car.mesh) {
    buildPlayerSpot(G.car);
    if (G.car._hlSpot) G.car._hlSpot.intensity = 55 * darkAmt; } }

let smokePool = null;
function buildSmokePool(G) {
  if (smokePool) return;
  smokePool = [];
  const cnv = document.createElement('canvas');
  cnv.width = cnv.height = 64;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
  const puffTexObj = new THREE.CanvasTexture(cnv);
  let poolNo = 0;
  while (poolNo < 120) {
    const sprObj = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexObj, transparent: true, opacity: 0, depthWrite: false }));
    sprObj.visible = false; G.scene.add(sprObj);
    smokePool.push({ s: sprObj, life: 0, max: 1, fire: false, kind: 'legacy', vx: 0, vy: 0, vz: 0, s0: 0.7, s1: 2.9, op: 0.5 });
    ++poolNo; } }

export function spawnSmokeAt(G, posVec, wantCount, fireFlag) {
  buildSmokePool(G); let madeCount = 0;
  for (const puffRec of smokePool) {
    if (madeCount >= wantCount) break;
    if (puffRec.life > 0) continue;
    puffRec.life = puffRec.max = rr(0.6, 1.3);
    puffRec.fire = !!fireFlag; puffRec.kind = 'legacy';
    puffRec.s.position.set(posVec.x + rr(-0.4, 0.4), posVec.y + rr(0.5, 1), posVec.z + rr(-0.4, 0.4));
    puffRec.s.material.color.set(fireFlag ? 0xff7a2a : 0x8a8f96);
    puffRec.s.scale.set(0.7, 0.7, 1);
    puffRec.s.visible = true;
    puffRec.vx = rr(-0.3, 0.3);
    puffRec.vy = rr(1, 2);
    puffRec.vz = rr(-0.3, 0.3);
    ++madeCount; } }

export function updateSmoke(G, dtVal) {
  if (smokePool) {
    for (const puffRec of smokePool) {
      if (!(puffRec.life > 0)) continue;
      puffRec.life -= dtVal;
      if (!(puffRec.life > 0)) {
        puffRec.s.visible = false;
        puffRec.s.material.opacity = 0;
        continue;
      }
      const ageFrac = 1 + (-(puffRec.life / puffRec.max));
      puffRec.s.position.x += dtVal * puffRec.vx;
      puffRec.s.position.y += dtVal * puffRec.vy;
      puffRec.s.position.z += dtVal * puffRec.vz;
      if (puffRec.kind === 'dmg') {
        const scaleNow = puffRec.s0 + ((puffRec.s1 + (-puffRec.s0)) * ageFrac);
        puffRec.s.scale.set(scaleNow, scaleNow, 1);
        puffRec.s.material.opacity = puffRec.op * (1 + (-ageFrac));
        continue;
      }
      const scaleNow = 0.7 + ((puffRec.fire ? 1.2 : 2.2) * ageFrac);
      puffRec.s.scale.set(scaleNow, scaleNow, 1);
      puffRec.s.material.opacity = (puffRec.fire ? 0.75 : 0.5) * (1 + (-ageFrac)) * (puffRec.fire ? 0.7 + (rnd() * 0.5) : 1);
      if (puffRec.fire) puffRec.s.material.color.setHSL(0.06 + (rnd() * 0.03), 1, 0.5); }
  } }

export { hexCss };
