// Bay law enforcement: heat levels, pursuits, roadblocks, spikes, heli.
import * as THREE from 'three'; import { loadHeroAsset } from './assets.js';
import { CAST } from './config.js'; import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite } from './world.js'; import { spawnVehicle, spawnSmokeAt, applyNpcPoliceGlb, damageVehicle } from './cars.js';
import { makeFigure, animateFigure } from './player.js';

const HQ_MARK_Q = {};
HQ_MARK_Q.x = -412.5;
HQ_MARK_Q.z = 412.5;
void HQ_MARK_Q;

const gapAngleQ = (wantAng, haveAng) => {
  let gapVal = wantAng - haveAng;
  for (; gapVal > Math.PI;) gapVal -= Math.PI * 2;
  for (; -Math.PI > gapVal;) gapVal += Math.PI * 2;
  return gapVal;
};
const distXZQ = (xa, za, xb, zb) => {
  const dX = xa - xb;
  const dZ = za - zb;
  return Math.hypot(dX, dZ);
};
const heroPtQ = (G) => {
  let actorEnt;
  if (G.car) actorEnt = G.car;
  else actorEnt = G.player;
  const ptOut = { x: actorEnt.x, z: actorEnt.z };
  return ptOut;
};
const heroAngQ = (G) => {
  const actorEnt = G.car ?? G.player;
  return actorEnt.angle;
};
export const districtAt = (px, pz) => {
  let labelOut;
  if (px < 0) labelOut = 'Harborview';
  else labelOut = 'Neon District';
  const rowList = [
    [Math.abs(px) < 200 && Math.abs(pz) < 200, 'Downtown'],
    [pz < -450, 'Touge Highlands'],
    [px > 250, 'Portside'],
    [pz > 380, 'Coral Bay']];
  const rowIter = rowList[Symbol.iterator]();
  let rowStep;
  while (!(rowStep = rowIter.next()).done) {
    const [condFlag, nameTxt] = rowStep.value;
    if (condFlag) labelOut = nameTxt;
  }
  return labelOut;
};
const PAINT_TABLE_Q = [
  [0xff7a1a, 'orange'], [0xe33b3b, 'red'],
  [0xb01030, 'red'], [0x2e6fb7, 'blue'],
  [0x3f6d8e, 'blue'], [0x37c8ff, 'blue'],
  [0xffffff, 'white'], [0xf2f2f2, 'white'],
  [0x111111, 'black'], [0x1d2735, 'black'],
  [0xc0c0c0, 'silver'], [0x8a8a8a, 'gray'],
  [0xffd23f, 'yellow'], [0x2e9e4f, 'green'],
  [0x7a4fd0, 'purple'], [0xff4fd8, 'pink']];
const rawPaintQ = (veh) => {
  let specObj;
  specObj = veh && veh.spec;
  const viaSpec = specObj && (specObj.color ?? specObj.paint);
  const viaSelf = veh && (veh.color ?? veh.paint);
  const outVal = viaSpec ?? viaSelf;
  return outVal;
};
const paintWordR = (veh) => { if (!veh || typeof veh !== 'object') return 'painted';
  const rawVal = rawPaintQ(veh);
  if (typeof rawVal === 'string') {
    if (rawVal.replace(/^#/, '').length === 6) return 'painted';
    return rawVal;
  }
  if (typeof rawVal !== 'number') return 'painted';
  let wordOut = 'painted';
  let bestSq = Infinity;
  const tableArr = PAINT_TABLE_Q;
  const tblIter = tableArr[Symbol.iterator]();
  let tblStep;
  while (!(tblStep = tblIter.next()).done) {
    const [hexVal, nameTxt] = tblStep.value;
    const diffR = ((hexVal >> 16) & 255) - ((rawVal >> 16) & 255);
    const diffG = ((hexVal >> 8) & 255) - ((rawVal >> 8) & 255);
    const diffB = (hexVal & 255) - (rawVal & 255);
    const sqVal = diffR * diffR + (diffG * diffG + diffB * diffB);
    if (bestSq > sqVal) { bestSq = sqVal; wordOut = nameTxt; }
  }
  return wordOut;
};
const rideDescQ = (G) => {
  if (G.car) {
    const specObj = G.car.spec;
    const modelR = (specObj && specObj.name) || G.car.specId || 'vehicle';
    const descTxt = paintWordR(G.car) + ' ' + modelR;
    return descTxt;
  }
  return 'suspect on foot';
};
const doorTexQ = () => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 64;
  const ctxG = canvasEl.getContext('2d');
  ctxG.clearRect(0, 0, 256, 64);
  ctxG.fillStyle = '#ffffff';
  ctxG.font = 'bold 44px Arial, sans-serif';
  ctxG.textAlign = 'center';
  ctxG.textBaseline = 'middle';
  ctxG.fillText('RBPD', 128, 34);
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.anisotropy = 4;
  return texObj;
};
const badgeFlankQ = (ctxG) => {
  ctxG.fillStyle = '#c9a227';
  ctxG.beginPath();
  ctxG.arc(112, 128, 54, 0, Math.PI * 2);
  ctxG.fill();
  ctxG.fillStyle = '#16222e';
  ctxG.beginPath();
  ctxG.arc(112, 128, 40, 0, Math.PI * 2);
  ctxG.fill();
  ctxG.fillStyle = '#c9a227';
  ctxG.font = 'bold 44px Arial, sans-serif';
  ctxG.textAlign = 'center';
  ctxG.textBaseline = 'middle';
  ctxG.fillText('★', 112, 130);
};
const flankTexQ = () => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 1024;
  canvasEl.height = 256;
  const ctxG = canvasEl.getContext('2d');
  ctxG.clearRect(0, 0, 1024, 256);
  ctxG.fillStyle = '#16222e';
  ctxG.fillRect(0, 64, 1024, 128);
  badgeFlankQ(ctxG);
  ctxG.fillStyle = '#ffffff';
  ctxG.font = 'bold 140px Arial, sans-serif';
  ctxG.fillText('RBPD', 580, 118);
  ctxG.font = 'bold 44px Arial, sans-serif';
  ctxG.fillText('P O L I C E', 580, 172);
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.anisotropy = 4;
  return texObj;
};
const roofTexQ = () => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 512;
  canvasEl.height = 512;
  const ctxG = canvasEl.getContext('2d');
  ctxG.clearRect(0, 0, 512, 512);
  ctxG.fillStyle = '#16222e';
  ctxG.font = 'bold 190px Arial, sans-serif';
  ctxG.textAlign = 'center';
  ctxG.textBaseline = 'middle';
  ctxG.fillText('RBPD', 256, 256);
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.anisotropy = 4;
  return texObj;
};
const poolTexQ = () => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 256;
  const ctxG = canvasEl.getContext('2d');
  const gradObj = ctxG.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradObj.addColorStop(0, 'rgba(255,246,205,1)');
  gradObj.addColorStop(0.35, 'rgba(255,240,190,0.75)');
  gradObj.addColorStop(0.7, 'rgba(255,232,160,0.28)');
  gradObj.addColorStop(1, 'rgba(255,230,150,0)');
  ctxG.fillStyle = gradObj;
  ctxG.fillRect(0, 0, 256, 256);
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.anisotropy = 4;
  return texObj;
};
const flankDecalsQ = (hostGrp) => {
  try { const matCfg = {};
    matCfg.map = flankTexQ();
    matCfg.transparent = true;
    matCfg.depthWrite = false;
    matCfg.polygonOffset = true;
    matCfg.polygonOffsetFactor = -2;
    const matObj = new THREE.MeshBasicMaterial(matCfg);
    const signList = [-1, 1];
    const sgnIter = signList[Symbol.iterator]();
    let sgnStep;
    while (!(sgnStep = sgnIter.next()).done) {
      const sgnVal = sgnStep.value;
      const plMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.095), matObj);
      plMesh.position.set(sgnVal * 0.192, 0.175, 0.16);
      plMesh.rotation.y = sgnVal * Math.PI / 2;
      plMesh.renderOrder = 2;
      hostGrp.add(plMesh);
    }
  } catch (swallowed) { }
};
const roofDecalQ = (hostGrp) => {
  try { const matCfg = {};
    matCfg.map = roofTexQ();
    matCfg.transparent = true;
    matCfg.opacity = 0.85;
    matCfg.depthWrite = false;
    matCfg.polygonOffset = true;
    matCfg.polygonOffsetFactor = -2;
    const matObj = new THREE.MeshBasicMaterial(matCfg);
    const plMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), matObj);
    plMesh.position.set(0, 0.318, 0.10);
    plMesh.rotation.x = -Math.PI / 2;
    plMesh.renderOrder = 2;
    hostGrp.add(plMesh);
  } catch (swallowed) { }
};
const dressingKitQ = () => {
  const allGrp = new THREE.Group();
  allGrp.name = 'rbpd-dressing';
  flankDecalsQ(allGrp);
  roofDecalQ(allGrp);
  const bladeMatCfg = {};
  bladeMatCfg.color = 0x14161a;
  bladeMatCfg.roughness = 0.6;
  bladeMatCfg.metalness = 0.3;
  const bladeMatObj = new THREE.MeshStandardMaterial(bladeMatCfg);
  const mainGrp = new THREE.Group();
  mainGrp.position.set(0, 0.35, 0.10);
  const barFirst = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.008, 0.055), bladeMatObj);
  mainGrp.add(barFirst);
  const barSecond = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.95), bladeMatObj);
  barSecond.rotation.y = 0.6;
  mainGrp.add(barSecond);
  const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.045, 10), bladeMatObj);
  mainGrp.add(hubMesh);
  const blurMatCfg = {};
  blurMatCfg.color = 0xcfd8e3;
  blurMatCfg.transparent = true;
  blurMatCfg.opacity = 0.10;
  blurMatCfg.side = THREE.DoubleSide;
  blurMatCfg.depthWrite = false;
  const blurMatObj = new THREE.MeshBasicMaterial(blurMatCfg);
  const discMesh = new THREE.Mesh(new THREE.CircleGeometry(0.47, 40), blurMatObj);
  discMesh.rotation.x = -Math.PI / 2;
  mainGrp.add(discMesh);
  allGrp.add(mainGrp);
  const tailGrp = new THREE.Group();
  tailGrp.position.set(0.035, 0.29, -0.475);
  let tPos = +false;
  while (tPos < 2) {
    const tbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.02), bladeMatObj);
    tbMesh.rotation.x = tPos * Math.PI / 2;
    tailGrp.add(tbMesh);
    ++tPos;
  }
  allGrp.add(tailGrp);
  const kitOut = { group: allGrp, rotor: mainGrp, tailRotor: tailGrp };
  return kitOut;
};
const swapGlbQ = (heliArg, wrapArg, kitArg) => {
  try { if (!heliArg || !wrapArg || heliArg.visualMode === 'glb') return false;
    if (kitArg && kitArg.group && kitArg.group.parent !== wrapArg) wrapArg.add(kitArg.group);
    for (; heliArg.body.children.length;) heliArg.body.remove(heliArg.body.children[0]);
    wrapArg.position.set(0, -1.18, 0);
    heliArg.body.add(wrapArg);
    if (kitArg) {
      if (kitArg.rotor) heliArg.rotor = kitArg.rotor;
      if (kitArg.tailRotor) heliArg.tailRotor = kitArg.tailRotor;
    }
    heliArg.visualMode = 'glb'; return true;
  } catch (swallowed) { return false;
  }
};
const heliMatsQ = () => {
  const hullCfg = {};
  hullCfg.color = 0x1d2735;
  hullCfg.metalness = 0.5;
  hullCfg.roughness = 0.4;
  const stripeCfg = {};
  stripeCfg.color = 0xf2f5f8;
  stripeCfg.metalness = 0.3;
  stripeCfg.roughness = 0.5;
  const glassCfg = {};
  glassCfg.color = 0x0d1218;
  glassCfg.metalness = 0.9;
  glassCfg.roughness = 0.1;
  const darkCfg = {};
  darkCfg.color = 0x22282f;
  darkCfg.metalness = 0.7;
  darkCfg.roughness = 0.35;
  const rotorCfg = {};
  rotorCfg.color = 0x14181d;
  rotorCfg.metalness = 0.6;
  rotorCfg.roughness = 0.4;
  const skidCfg = {};
  skidCfg.color = 0x30363e;
  skidCfg.metalness = 0.7;
  skidCfg.roughness = 0.35;
  const matsOut = {
    hull: new THREE.MeshStandardMaterial(hullCfg),
    stripe: new THREE.MeshStandardMaterial(stripeCfg),
    glass: new THREE.MeshStandardMaterial(glassCfg),
    dark: new THREE.MeshStandardMaterial(darkCfg),
    rotor: new THREE.MeshStandardMaterial(rotorCfg),
    skid: new THREE.MeshStandardMaterial(skidCfg),
  };
  return matsOut;
};
const addMeshQ = (hostGrp, geoObj, matObj, scX, scY, scZ, posX, posY, posZ) => {
  const meshOut = new THREE.Mesh(geoObj, matObj);
  if (scX !== null) meshOut.scale.set(scX, scY, scZ);
  if (posX !== null) meshOut.position.set(posX, posY, posZ);
  hostGrp.add(meshOut);
  return meshOut;
};
const heliFrontQ = (bodyGrp, matsObj) => {
  addMeshQ(bodyGrp, new THREE.SphereGeometry(1, 28, 22), matsObj.hull, 1.0, 0.92, 1.9, null, null, null);
  const stripeMesh = addMeshQ(bodyGrp, new THREE.CylinderGeometry(1.02, 1.02, 0.34, 28, 1, true), matsObj.stripe, null, null, null, null, null, null);
  stripeMesh.rotation.x = Math.PI / 2;
  stripeMesh.scale.set(1.0, 1.0, 0.92);
  stripeMesh.position.z = -0.15;
  const canopyMesh = addMeshQ(bodyGrp, new THREE.SphereGeometry(0.94, 24, 16, -Math.PI / 3.2, Math.PI / 1.6, 0.35, 1.05), matsObj.glass, 1.0, 0.92, 1.9, 0, 0.12, 0.14);
  void canopyMesh;
  const bellyMesh = addMeshQ(bodyGrp, new THREE.SphereGeometry(0.8, 20, 14), matsObj.hull, 0.9, 0.45, 1.5, null, null, null);
  bellyMesh.position.y = -0.55;
};
const heliRearQ = (bodyGrp, matsObj) => {
  const boomLenVal = 3.4;
  const boomMesh = addMeshQ(bodyGrp, new THREE.CylinderGeometry(0.07, 0.16, boomLenVal, 14), matsObj.hull, null, null, null, 0, 0.22, -1.75 - boomLenVal / 2 + 0.35);
  boomMesh.rotation.x = Math.PI / 2 - 0.10;
  addMeshQ(bodyGrp, new THREE.SphereGeometry(0.55, 18, 14), matsObj.hull, 0.16, 1.15, 0.62, 0, 0.62, -1.75 - boomLenVal + 0.35);
  addMeshQ(bodyGrp, new THREE.SphereGeometry(0.5, 16, 10), matsObj.hull, 1.5, 0.10, 0.42, 0, 0.30, -1.75 - boomLenVal + 0.55);
  addMeshQ(bodyGrp, new THREE.SphereGeometry(0.5, 18, 12), matsObj.dark, 0.85, 0.5, 1.15, 0, 0.82, -0.25);
  addMeshQ(bodyGrp, new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), matsObj.dark, null, null, null, 0, 1.05, -0.25);
  return boomLenVal;
};
const rotorMainQ = (bodyGrp, matsObj) => {
  const rotorGrp = new THREE.Group();
  rotorGrp.position.set(0, 1.32, -0.25);
  rotorGrp.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), matsObj.dark));
  let rPos = +false;
  while (rPos < 2) {
    const bladeMesh = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.28), matsObj.rotor);
    bladeMesh.rotation.y = rPos * Math.PI / 2;
    const tipMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.20), matsObj.rotor);
    tipMesh.position.set(2.75, 0, 0);
    const tipGrpObj = new THREE.Group();
    tipGrpObj.rotation.y = rPos * Math.PI / 2;
    tipGrpObj.add(tipMesh);
    const tipFarMesh = tipMesh.clone();
    tipFarMesh.position.x = -2.75;
    tipGrpObj.add(tipFarMesh);
    rotorGrp.add(bladeMesh);
    rotorGrp.add(tipGrpObj);
    ++rPos;
  }
  bodyGrp.add(rotorGrp);
  return rotorGrp;
};
const rotorTailQ = (bodyGrp, matsObj, boomLenVal) => {
  const tailGrp = new THREE.Group();
  tailGrp.position.set(0.14, 0.62, -1.75 - boomLenVal + 0.35);
  let tPos = +false;
  while (tPos < 2) {
    const tbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.12), matsObj.rotor);
    tbMesh.rotation.x = tPos * Math.PI / 2;
    tailGrp.add(tbMesh);
    ++tPos;
  }
  tailGrp.add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matsObj.dark));
  bodyGrp.add(tailGrp);
  return tailGrp;
};
const skidSideQ = (bodyGrp, matsObj, sgnVal) => {
  const xOff = sgnVal * 0.78;
  const ptList = [
    new THREE.Vector3(xOff, -1.05, 1.35),
    new THREE.Vector3(xOff, -1.18, 0.4),
    new THREE.Vector3(xOff, -1.18, -0.9),
    new THREE.Vector3(xOff, -1.02, -1.55)];
  const curveObj = new THREE.CatmullRomCurve3(ptList);
  bodyGrp.add(new THREE.Mesh(new THREE.TubeGeometry(curveObj, 20, 0.055, 8), matsObj.skid));
  const strutList = [0.75, -0.75];
  const strutIter = strutList[Symbol.iterator]();
  let strutStep;
  while (!(strutStep = strutIter.next()).done) {
    const zOff = strutStep.value;
    const strutMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), matsObj.skid);
    strutMesh.position.set(xOff * 0.82, -0.82, zOff);
    strutMesh.rotation.z = sgnVal * 0.35;
    bodyGrp.add(strutMesh);
  }
};
const heliSkidsQ = (bodyGrp, matsObj) => {
  const signList = [-1, 1];
  const sgnIter = signList[Symbol.iterator]();
  let sgnStep;
  while (!(sgnStep = sgnIter.next()).done) {
    skidSideQ(bodyGrp, matsObj, sgnStep.value);
  }
  try { const doorMatCfg = {};
    doorMatCfg.map = doorTexQ();
    doorMatCfg.transparent = true;
    doorMatCfg.side = THREE.DoubleSide;
    const doorMatObj = new THREE.MeshBasicMaterial(doorMatCfg);
    const doorSignList = [-1, 1];
    const doorIter = doorSignList[Symbol.iterator]();
    let doorStep;
    while (!(doorStep = doorIter.next()).done) {
      const sgnVal = doorStep.value;
      const plMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), doorMatObj);
      plMesh.position.set(sgnVal * 1.01, 0.05, 0.25);
      plMesh.rotation.y = sgnVal * Math.PI / 2;
      bodyGrp.add(plMesh);
    }
  } catch (swallowed) { }
};
const heliLightsQ = (G, rootGrp) => {
  const beamMatCfg = {};
  beamMatCfg.color = 0xfff3b0;
  beamMatCfg.transparent = true;
  beamMatCfg.opacity = 0.18;
  beamMatCfg.blending = THREE.AdditiveBlending;
  beamMatCfg.depthWrite = false;
  beamMatCfg.side = THREE.DoubleSide;
  const beamMatObj = new THREE.MeshBasicMaterial(beamMatCfg);
  const beamMesh = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 20, 1, true), beamMatObj);
  beamMesh.position.set(0, -15.5, 0.6);
  rootGrp.add(beamMesh);
  let glowSpr = null;
  try { glowSpr = glowSprite(0xfff2a8, 3.2);
    glowSpr.position.set(0, -0.8, 0.6);
    rootGrp.add(glowSpr);
  } catch (swallowed) { }
  const spotLight = new THREE.SpotLight(0xfff2c0, 2.4, 90, 0.42, 0.45, 1.2);
  G.scene.add(spotLight);
  G.scene.add(spotLight.target);
  let poolMesh = null;
  try { const poolMatCfg = {};
    poolMatCfg.map = poolTexQ();
    poolMatCfg.transparent = true;
    poolMatCfg.opacity = 0.55;
    poolMatCfg.blending = THREE.AdditiveBlending;
    poolMatCfg.depthWrite = false;
    const poolMatObj = new THREE.MeshBasicMaterial(poolMatCfg);
    poolMesh = new THREE.Mesh(new THREE.CircleGeometry(6.5, 40), poolMatObj);
    poolMesh.rotation.x = -Math.PI / 2;
    poolMesh.renderOrder = 5;
    G.scene.add(poolMesh);
  } catch (swallowed) { }
  const lightsOut = { beam: beamMesh, glow: glowSpr, spot: spotLight, pool: poolMesh };
  return lightsOut;
};
const buildHeliQ = (G) => {
  const rootGrp = new THREE.Group();
  const bodyGrp = new THREE.Group();
  rootGrp.add(bodyGrp);
  const matsObj = heliMatsQ();
  heliFrontQ(bodyGrp, matsObj);
  const boomLenVal = heliRearQ(bodyGrp, matsObj);
  const rotorObj = rotorMainQ(bodyGrp, matsObj);
  const tailObj = rotorTailQ(bodyGrp, matsObj, boomLenVal);
  heliSkidsQ(bodyGrp, matsObj);
  const lightsObj = heliLightsQ(G, rootGrp);
  rootGrp.traverse(function (nodeObj) {
    if (nodeObj.isMesh) {
      nodeObj.castShadow = false;
      nodeObj.receiveShadow = false;
    }
  });
  G.scene.add(rootGrp);
  const heliOut = {};
  heliOut.group = rootGrp;
  heliOut.body = bodyGrp;
  heliOut.rotor = rotorObj;
  heliOut.tailRotor = tailObj;
  heliOut.cone = lightsObj.beam;
  heliOut.spotlight = lightsObj.spot;
  heliOut.lensGlow = lightsObj.glow;
  heliOut.pool = lightsObj.pool;
  heliOut.trackX = null;
  heliOut.trackZ = null;
  heliOut.orbitA = rr(0, Math.PI * 2);
  heliOut.leaveT = 0;
  heliOut.visualMode = 'procedural';
  return heliOut;
};
const blinkBarQ = (veh, nowVal) => {
  const barObj = veh.mesh?.userData?.lightbar;
  if (!barObj) return;
  const onFlag = Math.floor(nowVal * 6) % 2 === 0;
  const hiVal = 3.2;
  const loVal = 0.15;
  try { let redVal;
    if (onFlag) redVal = hiVal;
    else redVal = loVal;
    if (barObj.red) barObj.red.emissiveIntensity = redVal;
    let blueVal;
    if (onFlag) blueVal = loVal;
    else blueVal = hiVal;
    if (barObj.blue) barObj.blue.emissiveIntensity = blueVal;
    if (barObj.gr) barObj.gr.visible = onFlag;
    if (barObj.gb) barObj.gb.visible = !onFlag;
  } catch (swallowed) { }
};
export const initPolice = (G) => { if (G.cops) G.cops = G.cops;
  else G.cops = [];
  G.heli = null;
  let kitBag = null;
  try { kitBag = dressingKitQ();
  } catch (swallowed) { kitBag = null;
  }
  try { if (G.flags) G.flags.heliDressing = kitBag;
  } catch (swallowed) { }
  try { loadHeroAsset('helicopter').then(function (wrapArg) {
      try { if (!wrapArg) return;
        if (G.flags) G.flags.heliAsset = wrapArg;
        if (G.heli) swapGlbQ(G.heli, wrapArg, kitBag);
      } catch (swallowed) { }
    }).catch(function () {});
  } catch (swallowed) { }
  const pState = {};
  pState.blocks = [];
  pState.t = 0;
  pState.speedHeatCd = 0;
  pState.driftHeatCd = 0;
  pState.decayAcc = 0;
  pState.spawnCd = 0;
  pState.blockCd = 8;
  pState.spikeT = 0;
  pState.prevWantedInt = 0;
  pState.chatterIdx = 0;
  pState.ramCd = 0;
  pState.prevPX = 0;
  pState.prevPZ = 0;
  pState.pvx = 0;
  pState.pvz = 0;
  pState.smokeCd = 0;
  pState.lastCrashSeen = 0;
  const quotaQ = () => {
    const tableList = [];
    tableList.push(0);
    tableList.push(1);
    tableList.push(2);
    tableList.push(3);
    tableList.push(4);
    tableList.push(6);
    if (!(G.wanted > 0.05)) return 0 + 0;
    return tableList[Math.min(5, Math.ceil(G.wanted))];
  };
  const nearestLineQ = (valIn, lineList) => {
    let bestLine = lineList[0];
    const lineIter = lineList[Symbol.iterator]();
    let lineStep;
    while (!(lineStep = lineIter.next()).done) {
      const lineVal = lineStep.value;
      if (Math.abs(bestLine - valIn) > Math.abs(lineVal - valIn)) bestLine = lineVal;
    }
    return bestLine;
  };
  const spawnPursuerQ = () => {
    const heroPos = heroPtQ(G);
    const angVal = rr(0, Math.PI * 2);
    const distVal = rr(120, 180);
    let sx = heroPos.x + Math.sin(angVal) * distVal;
    let sz = heroPos.z + Math.cos(angVal) * distVal;
    chance(0.5) ? (sx = nearestLineQ(sx, G.roadX)) : (sz = nearestLineQ(sz, G.roadZ));
    sx = THREE.MathUtils.clamp(sx, -640, 640); sz = THREE.MathUtils.clamp(sz, -640, 640);
    let specIdTxt;
    if (G.wanted >= 3 && G.cops.length % 2 === 1) specIdTxt = 'police-suv';
    else specIdTxt = 'police';
    const optsObj = {};
    optsObj.driver = 'cop';
    optsObj.livery = 'police';
    optsObj.lights = true;
    const copVeh = spawnVehicle(G, specIdTxt, sx, sz, rr(0, Math.PI * 2), optsObj);
    if (copVeh) applyNpcPoliceGlb(copVeh);
    if (copVeh) G.cops.push(copVeh);
    return copVeh;
  };
  const removeUnitQ = (veh) => {
    const copPos = G.cops.indexOf(veh);
    if (!(copPos < 0)) G.cops.splice(copPos, 1);
    let vehPos;
    if (G.vehicles) vehPos = G.vehicles.indexOf(veh);
    else vehPos = -1;
    if (!(vehPos < 0)) G.vehicles.splice(vehPos, 1);
    let trafPos;
    if (G.traffic) trafPos = G.traffic.indexOf(veh);
    else trafPos = -1;
    if (!(trafPos < 0)) G.traffic.splice(trafPos, 1);
    if (veh.mesh) { const meshObj = veh.mesh; G.scene.remove(meshObj); }
  };
  const blockCarsQ = (bx, bz, perpAng) => {
    const parkedList = [];
    const offList = [-8, 8];
    const offIter = offList[Symbol.iterator]();
    let offStep;
    while (!(offStep = offIter.next()).done) {
      const offVal = offStep.value;
      const cx = bx + Math.sin(perpAng) * offVal;
      const cz = bz + Math.cos(perpAng) * offVal;
      const optsObj = {};
      optsObj.driver = 'parked';
      optsObj.livery = 'police';
      optsObj.lights = true;
      const copVeh = spawnVehicle(G, 'police', cx, cz, perpAng + rr(-0.25, 0.25), optsObj);
      if (copVeh) applyNpcPoliceGlb(copVeh);
      if (copVeh) {
        parkedList.push(copVeh);
        G.cops.push(copVeh);
      }
    }
    return parkedList;
  };
  const blockStripQ = (bx, bz, perpAng) => {
    const stripGroup = new THREE.Group();
    const stripMatCfg = {};
    stripMatCfg.color = 0x181a1e;
    stripMatCfg.roughness = 0.9;
    stripMatCfg.metalness = 0.2;
    const stripMesh = new THREE.Mesh(new THREE.BoxGeometry(13, 0.06, 1.1),
      new THREE.MeshStandardMaterial(stripMatCfg));
    stripGroup.add(stripMesh);
    const spikeMatCfg = {};
    spikeMatCfg.color = 0xb9c0c9;
    spikeMatCfg.metalness = 0.9;
    spikeMatCfg.roughness = 0.25;
    const spikeMatObj = new THREE.MeshStandardMaterial(spikeMatCfg);
    let spPos = 0;
    while (spPos < 12) {
      const spMesh = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), spikeMatObj);
      spMesh.position.set(spPos - 5.5, 0.13, 0);
      stripGroup.add(spMesh);
      ++spPos;
    }
    stripGroup.position.set(bx, groundH(bx, bz) + 0.05, bz); stripGroup.rotation.y = perpAng;
    G.scene.add(stripGroup); return stripGroup;
  };
  const blockOfficersQ = (bx, bz, perpAng) => {
    const officerList = [];
    if (!CAST.cop) return officerList;
    const offList = [-11, 11];
    const offIter = offList[Symbol.iterator]();
    let offStep;
    while (!(offStep = offIter.next()).done) {
      const offVal = offStep.value;
      try { const figObj = makeFigure(CAST.cop);
        const ox = bx + Math.sin(perpAng) * offVal;
        const oz = bz + Math.cos(perpAng) * offVal + 2;
        figObj.position.set(ox, groundH(ox, oz), oz);
        figObj.rotation.y = perpAng + Math.PI;
        G.scene.add(figObj);
        const recObj = {};
        recObj.fig = figObj;
        recObj.phase = rr(0, 6);
        officerList.push(recObj);
      } catch (swallowed) { }
    }
    return officerList;
  };
  const setupBlockQ = () => {
    const heroPos = heroPtQ(G);
    const headAng = heroAngQ(G);
    const aheadDist = 105;
    let bx = heroPos.x + Math.sin(headAng) * aheadDist;
    let bz = heroPos.z + Math.cos(headAng) * aheadDist;
    const verticalFlag = Math.abs(Math.sin(headAng)) < Math.abs(Math.cos(headAng));
    verticalFlag ? (bx = nearestLineQ(bx, G.roadX)) : (bz = nearestLineQ(bz, G.roadZ));
    bx = THREE.MathUtils.clamp(bx, -620, 620); bz = THREE.MathUtils.clamp(bz, -620, 620);
    let roadAng;
    if (verticalFlag) roadAng = 0;
    else roadAng = Math.PI / 2;
    const perpAng = roadAng + Math.PI / 2;
    const parkedList = blockCarsQ(bx, bz, perpAng);
    const stripObj = blockStripQ(bx, bz, perpAng);
    const blockGrpObj = new THREE.Group();
    blockGrpObj.add(stripObj);
    void blockGrpObj;
    const officerList = blockOfficersQ(bx, bz, perpAng);
    const entryObj = {};
    entryObj.x = bx;
    entryObj.z = bz;
    entryObj.angle = perpAng;
    entryObj.cars = parkedList;
    entryObj.officers = officerList;
    entryObj.strip = stripObj;
    entryObj.spiked = false;
    pState.blocks.push(entryObj);
  };
  const teardownBlockQ = (blk) => {
    const blkIdx = pState.blocks.indexOf(blk);
    if (!(blkIdx < 0)) pState.blocks.splice(blkIdx, 1);
    const carsListCopy = [...blk.cars];
    const carIter = carsListCopy[Symbol.iterator]();
    let carStep;
    while (!(carStep = carIter.next()).done) {
      removeUnitQ(carStep.value);
    }
    const offIter = blk.officers[Symbol.iterator]();
    let offStep;
    while (!(offStep = offIter.next()).done) {
      G.scene.remove(offStep.value.fig);
    }
    if (blk.strip) { const stripObj = blk.strip; G.scene.remove(stripObj); }
  };
  const stageHeliQ = (heliArg, stagedFlag) => {
    const heroPos = heroPtQ(G);
    (stagedFlag || G.flags.heliStage) && G.flags.heliStage
      ? heliArg.group.position.set(G.flags.heliStage.x, groundH(G.flags.heliStage.x, G.flags.heliStage.z) + 28, G.flags.heliStage.z)
      : heliArg.group.position.set(heroPos.x + 20, groundH(heroPos.x, heroPos.z) + 28, heroPos.z);
  };
  const ensureHeliQ = (stagedFlag) => {
    if (G.heli) { return; }
    const heliObj = buildHeliQ(G);
    if (G.flags && G.flags.heliAsset) swapGlbQ(heliObj, G.flags.heliAsset, kitBag);
    stageHeliQ(heliObj, stagedFlag);
    G.heli = heliObj;
  };
  const dismissHeliQ = () => {
    const heliObj = G.heli;
    if (!heliObj) return;
    G.scene.remove(heliObj.group);
    if (heliObj.pool) G.scene.remove(heliObj.pool);
    if (heliObj.spotlight) {
      G.scene.remove(heliObj.spotlight);
      G.scene.remove(heliObj.spotlight.target);
    }
    G.heli = null; };
  if (G.shot === 'chase' || G.shot === 'heli') ensureHeliQ(G.shot === 'heli');
  const trackVelQ = (heroPos, dtVal) => {
    if (dtVal > 0) {
      pState.pvx = (heroPos.x - pState.prevPX) / dtVal;
      pState.pvz = (heroPos.z - pState.prevPZ) / dtVal;
      const velLen = Math.hypot(pState.pvx, pState.pvz);
      if (velLen > 60) {
        pState.pvx *= (60 / velLen);
        pState.pvz *= (60 / velLen);
      }
    }
    pState.prevPX = heroPos.x;
    pState.prevPZ = heroPos.z;
  };
  const dispatchLineQ = (lineTxt) => {
    try { G.dispatch?.(lineTxt);
    } catch (swallowed) { }
  };
  const dispatchFootQ = (roseFlag, zoneR, slotVal) => {
    const roseList = [];
    roseList.push('Dispatch: suspect on foot, ' + zoneR + ' — units respond.');
    roseList.push('Dispatch: all units, suspect on foot in ' + zoneR + '. Move in.');
    roseList.push('Dispatch: be advised, suspect fled on foot in ' + zoneR + '.');
    const calmList = [];
    calmList.push('All units: suspect lost visual, ' + zoneR + '. Stand down.');
    calmList.push('Dispatch: foot pursuit cooling off in ' + zoneR + ' — hold positions.');
    calmList.push('All units: be advised, the suspect on foot slipped away near ' + zoneR + '.');
    const lineTxt = roseFlag ? roseList[slotVal % 3] : calmList[slotVal % 3];
    dispatchLineQ(lineTxt);
  };
  const dispatchForQ = (wholeVal, roseFlag, heroPos) => {
    const zoneR = districtAt(heroPos.x, heroPos.z);
    const descR = rideDescQ(G);
    const slotVal = pState.chatterIdx;
    ++pState.chatterIdx;
    if (!G.car) {
      dispatchFootQ(roseFlag, zoneR, slotVal); return;
    }
    const highList = [];
    highList.push('Dispatch: roadblock authorized, ' + zoneR + '.');
    highList.push('Dispatch: air support and roadblocks authorized — suspect in a ' + descR + ', ' + zoneR + '.');
    highList.push('Dispatch: all units converge — suspect in ' + descR + ', ' + zoneR + '.');
    const roseList = [];
    roseList.push('Dispatch: suspect in a ' + descR + ', ' + zoneR + ' — units respond.');
    roseList.push('Dispatch: all units, ' + descR + ' spotted in ' + zoneR + '. Move to intercept.');
    roseList.push('Dispatch: be advised, a ' + descR + ' is raising hell in ' + zoneR + '.');
    const calmList = [];
    calmList.push('All units: suspect lost visual, ' + zoneR + '. Stand down.');
    calmList.push('Dispatch: pursuit cooling off in ' + zoneR + ' — hold positions.');
    calmList.push('All units: be advised, ' + descR + ' slipped away near ' + zoneR + '.');
    const lineTxt = roseFlag && wholeVal >= 4 ? highList[slotVal % 3] : roseFlag ? roseList[slotVal % 3] : calmList[slotVal % 3];
    if (lineTxt) dispatchLineQ(lineTxt);
  };
  const anyCopNearQ = (heroPos, rangeVal) => {
    let nearFlag = false;
    const copIter = G.cops[Symbol.iterator]();
    let copStep;
    while (!(copStep = copIter.next()).done) {
      const copVeh = copStep.value;
      if (rangeVal > distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z)) nearFlag = true;
    }
    return nearFlag;
  };
  const heatTickQ = (dtVal, heroPos, seatedFlag, kmhVal) => {
    pState.speedHeatCd = Math.max(0, pState.speedHeatCd - dtVal);
    pState.driftHeatCd = Math.max(0, pState.driftHeatCd - dtVal);
    const nearFlag = anyCopNearQ(heroPos, 60);
    if (seatedFlag && kmhVal > 110 && !(pState.speedHeatCd > 0)) {
      const copIter = G.cops[Symbol.iterator]();
      let copStep;
      while (!(copStep = copIter.next()).done) {
        const copVeh = copStep.value;
        if (40 > distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z) && !(pState.speedHeatCd > 0)) {
          G.wanted += 0.5;
          pState.speedHeatCd = 2.5;
        }
      }
    }
    if (G.flags.crashTimer && G.flags.crashTimer !== pState.lastCrashSeen) {
      pState.lastCrashSeen = G.flags.crashTimer;
      G.flags.crashTimer = 0; G.wanted += 0.4;
    }
    if (seatedFlag && G.flags.drifting && !(pState.driftHeatCd > 0)) {
      const copIter = G.cops[Symbol.iterator]();
      let copStep;
      while (!(copStep = copIter.next()).done) {
        const copVeh = copStep.value;
        if (45 > distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z) && !(pState.driftHeatCd > 0)) {
          G.wanted += 0.2;
          pState.driftHeatCd = 3;
        }
      }
    }
    if (!nearFlag && !G.flags.noDecay) {
      pState.decayAcc += dtVal;
      for (; pState.decayAcc >= 10;) {
        pState.decayAcc -= 10; G.wanted -= 0.1;
      }
    } else { pState.decayAcc = 0;
    }
    const clampedVal = THREE.MathUtils.clamp(G.wanted || 0, 0, 5);
    G.wanted = clampedVal;
    const wholeVal = Math.round(G.wanted || 0);
    if (wholeVal !== pState.prevWantedInt) {
      const roseFlag = wholeVal > pState.prevWantedInt;
      pState.prevWantedInt = wholeVal;
      dispatchForQ(wholeVal, roseFlag, heroPos);
    }
  };
  const spikeTickQ = (dtVal) => {
    if (pState.spikeT > 0) {
      pState.spikeT -= dtVal; G.flags.gripFactor = 0.5;
      if (G.car && 40 / 3.6 < G.car.speed) G.car.speed = Math.min(G.car.speed, 40 / 3.6);
      if (chance(0.3) && G.car) try { spawnSmokeAt(G, new THREE.Vector3(G.car.x, groundH(G.car.x, G.car.z) + 0.4, G.car.z), 1, false);
      } catch (swallowed) { }
      if (0 >= pState.spikeT) G.flags.gripFactor = 1;
    }
  };
  const inBlockQ = (copVeh) => {
    return pState.blocks.some(function (blk) { return blk.cars.includes(copVeh); });
  };
  const copAimQ = (copVeh, heroPos, gapVal, seatedFlag) => {
    let aimX = heroPos.x + pState.pvx * Math.min(1.2, gapVal / 30);
    let aimZ = heroPos.z + pState.pvz * Math.min(1.2, gapVal / 30);
    if (12 > gapVal && seatedFlag) {
      const headAng = heroAngQ(G);
      aimX = heroPos.x - Math.sin(headAng) * 2.5 + Math.cos(headAng) * 1.2;
      aimZ = heroPos.z - Math.cos(headAng) * 2.5 - Math.sin(headAng) * 1.2;
    }
    return { x: aimX, z: aimZ };
  };
  const copBiasQ = (copVeh) => {
    let biasVal = 0;
    if (G.colliders) { const probeX = copVeh.x + Math.sin(copVeh.angle) * 9;
      const probeZ = copVeh.z + Math.cos(copVeh.angle) * 9;
      const colIter = G.colliders[Symbol.iterator]();
      let colStep;
      while (!(colStep = colIter.next()).done) {
        if (biasVal !== 0) break;
        const colObj = colStep.value;
        if (colObj.x === undefined) continue;
        const radVal = colObj.r || 7;
        if (radVal + 2 > distXZQ(probeX, probeZ, colObj.x, colObj.z)) {
          const crossVal = Math.sin(copVeh.angle) * (colObj.z - copVeh.z) - Math.cos(copVeh.angle) * (colObj.x - copVeh.x);
          const mulVal = Math.sign(crossVal) || 1;
          biasVal = -mulVal * 0.8;
        }
      }
    }
    return biasVal;
  };
  const copPaceQ = (copVeh, gapHead, wreckedFlag, seatedFlag, gapVal, paceRef) => {
    let topVal = (copVeh.spec?.topSpeed || 190) / 3.6;
    topVal = !(G.wanted > 2) ? Math.min(topVal, paceRef * 0.93) : G.wanted >= 4 ? Math.max(topVal, paceRef) : topVal;
    let goalVal = Math.abs(gapHead) > 1.1 ? topVal * 0.45 : Math.abs(gapHead) > 0.5 ? topVal * 0.75 : topVal;
    if (wreckedFlag) goalVal = topVal * 0.4;
    if (!seatedFlag && 6 > gapVal) goalVal = 0;
    return { top: topVal, goal: goalVal };
  };
  const copSteerQ = (copVeh, dtVal, heroPos, seatedFlag, gapVal) => {
    const aimPt = copAimQ(copVeh, heroPos, gapVal, seatedFlag);
    const biasVal = copBiasQ(copVeh);
    const wantAng = Math.atan2(aimPt.x - copVeh.x, aimPt.z - copVeh.z) + biasVal;
    const gapHead = gapAngleQ(wantAng, copVeh.angle);
    const maxTurn = 2.1 * dtVal;
    copVeh.angle += THREE.MathUtils.clamp(gapHead, -maxTurn, maxTurn);
    return gapHead;
  };
  const copDriveQ = (copVeh, dtVal, paceObj) => {
    let accelVal;
    if (paceObj.goal > copVeh.speed) accelVal = 9;
    else accelVal = 16;
    const deltaVal = Math.sign(paceObj.goal - copVeh.speed) * accelVal * dtVal;
    copVeh.speed = THREE.MathUtils.clamp(copVeh.speed + deltaVal, 0, paceObj.top);
    copVeh.x += Math.sin(copVeh.angle) * copVeh.speed * dtVal;
    copVeh.z += Math.cos(copVeh.angle) * copVeh.speed * dtVal;
    copVeh.x = THREE.MathUtils.clamp(copVeh.x, -655, 655);
    copVeh.z = THREE.MathUtils.clamp(copVeh.z, -655, 655);
    copVeh.mesh.position.set(copVeh.x, groundH(copVeh.x, copVeh.z), copVeh.z);
    copVeh.mesh.rotation.y = copVeh.angle;
  };
  const copWheelsQ = (copVeh, dtVal) => {
    const udObj = copVeh.mesh.userData;
    if (udObj?.wheels) {
      const wDelta = (copVeh.speed * dtVal) / (udObj.wheelR || 0.34);
      const wheelList = Object.values(udObj.wheels);
      const wheelIter = wheelList[Symbol.iterator]();
      let wheelStep;
      while (!(wheelStep = wheelIter.next()).done) {
        const wheelObj = wheelStep.value;
        if (wheelObj) wheelObj.rotation.x += wDelta;
      }
    }
  };
  const copTickQ = (copVeh, dtVal, heroPos, seatedFlag, paceRef) => {
    const gapVal = distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z);
    const wreckedFlag = 30 > (copVeh.health ?? 100);
    const gapHead = copSteerQ(copVeh, dtVal, heroPos, seatedFlag, gapVal);
    const paceObj = copPaceQ(copVeh, gapHead, wreckedFlag, seatedFlag, gapVal, paceRef);
    copDriveQ(copVeh, dtVal, paceObj);
    if (seatedFlag && G.car && 3 > gapVal && (copVeh.speed || 0) > 8 && !(pState.ramCd > 0)) {
      damageVehicle(G, G.car, (copVeh.speed || 0) * 0.35);
      pState.ramCd = 0.6; G.flags.crashTimer = 1;
    }
    if (copVeh.steerVis !== undefined) copVeh.steerVis = THREE.MathUtils.clamp(gapHead, -0.5, 0.5);
    copWheelsQ(copVeh, dtVal);
    if (wreckedFlag) {
      pState.smokeCd -= dtVal;
      if (!(pState.smokeCd > 0)) {
        pState.smokeCd = 0.12;
        try { spawnSmokeAt(G, new THREE.Vector3(copVeh.x, groundH(copVeh.x, copVeh.z) + 0.9, copVeh.z), 1, false);
        } catch (swallowed) { }
      }
      if (!((copVeh.health ?? 100) > 0)) removeUnitQ(copVeh);
    }
  };
  const blockSpikeQ = (blk, heroPos, seatedFlag, kmhVal) => {
    if (blk.spiked || !seatedFlag || !G.car) return;
    const alongVal = Math.abs(Math.sin(blk.angle) * (heroPos.z - blk.z) - Math.cos(blk.angle) * (heroPos.x - blk.x));
    const perpVal = Math.abs(Math.cos(blk.angle) * (heroPos.z - blk.z) + Math.sin(blk.angle) * (heroPos.x - blk.x));
    const blkGap = distXZQ(blk.x, blk.z, heroPos.x, heroPos.z);
    if (8 > blkGap && 2.2 > perpVal && 7 > alongVal && kmhVal > 8) {
      blk.spiked = true; pState.spikeT = 6;
      G.toast?.('Spike strip! Tires shredded'); try { spawnSmokeAt(G, new THREE.Vector3(heroPos.x, groundH(heroPos.x, heroPos.z) + 0.3, heroPos.z), 6, false);
      } catch (swallowed) { }
    }
  };
  const blocksTickQ = (dtVal, heroPos, seatedFlag, kmhVal) => {
    pState.blockCd = Math.max(0, pState.blockCd - dtVal);
    let wantBlocks;
    if (5 > G.wanted) wantBlocks = 1;
    else wantBlocks = 2;
    if (G.wanted >= 3 && !(pState.blockCd > 0) && pState.blocks.length < wantBlocks && seatedFlag) {
      setupBlockQ();
      pState.blockCd = 25;
    }
    const blocksList = [...pState.blocks];
    const blkIter = blocksList[Symbol.iterator]();
    let blkStep;
    while (!(blkStep = blkIter.next()).done) {
      const blk = blkStep.value;
      const carIter = blk.cars[Symbol.iterator]();
      let carStep;
      while (!(carStep = carIter.next()).done) {
        blinkBarQ(carStep.value, pState.t);
      }
      const offIter = blk.officers[Symbol.iterator]();
      let offStep;
      while (!(offStep = offIter.next()).done) {
        const offRec = offStep.value;
        try { animateFigure(offRec.fig, offRec.phase + pState.t * 0.6, 0.15);
        } catch (swallowed) { }
      }
      blockSpikeQ(blk, heroPos, seatedFlag, kmhVal);
      const blkGap = distXZQ(blk.x, blk.z, heroPos.x, heroPos.z);
      if (blkGap > 250) teardownBlockQ(blk);
    }
  };
  const heliSpotQ = (heroPos, shotHeliFlag, hardFlag) => {
    const spotOut = { x: heroPos.x, z: heroPos.z };
    if (shotHeliFlag && G.flags.heliStage) {
      spotOut.x = G.flags.heliStage.x;
      spotOut.z = G.flags.heliStage.z;
    }
    G.flags.flashCar && shotHeliFlag
      ? (spotOut.x = G.flags.flashCar.x, spotOut.z = G.flags.flashCar.z)
      : hardFlag && G.car
        ? (spotOut.x = G.car.x, spotOut.z = G.car.z)
        : null;
    return spotOut;
  };
  const heliTickQ = (dtVal, heroPos, seatedFlag) => {
    const shotHeliFlag = G.shot === 'chase' || G.shot === 'heli';
    if (G.wanted >= 4 || shotHeliFlag) ensureHeliQ(false);
    if (!G.heli) { return; }
    const heliObj = G.heli;
    if (!shotHeliFlag && 3 > G.wanted) {
      heliObj.leaveT += dtVal;
      if (heliObj.leaveT > 10) dismissHeliQ();
    } else heliObj.leaveT = 0;
    if (!G.heli) { return; }
    heliObj.orbitA += dtVal * 0.35;
    let stagePt;
    if (G.flags.heliStage) stagePt = G.flags.heliStage;
    else stagePt = heroPos;
    const tuneObj = G.heliShot || null;
    let radVal;
    if (tuneObj && typeof tuneObj.radius === 'number') radVal = tuneObj.radius;
    else if (G.shot === 'heli') radVal = 6;
    else radVal = 20;
    let altVal;
    if (tuneObj && typeof tuneObj.altitude === 'number') altVal = tuneObj.altitude;
    else altVal = 29;
    const orbX = stagePt.x + Math.sin(heliObj.orbitA) * radVal;
    const orbZ = stagePt.z + Math.cos(heliObj.orbitA) * radVal;
    const orbY = groundH(orbX, orbZ) + altVal + Math.sin(pState.t * 0.9) * 1.6;
    const hardFlag = (G.wanted >= 3 && seatedFlag) || shotHeliFlag;
    const spotPt = heliSpotQ(heroPos, shotHeliFlag, hardFlag);
    let poolX = spotPt.x;
    let poolZ = spotPt.z;
    if (hardFlag) {
      if (heliObj.trackX === null || heliObj.trackX === undefined) {
        heliObj.trackX = spotPt.x;
        heliObj.trackZ = spotPt.z;
      }
      const blendVal = 1 - Math.exp(-2.2 * Math.max(0, dtVal));
      heliObj.trackX += (spotPt.x - heliObj.trackX) * blendVal;
      heliObj.trackZ += (spotPt.z - heliObj.trackZ) * blendVal;
      poolX = heliObj.trackX + Math.sin(pState.t * 0.6) * 2.2;
      poolZ = heliObj.trackZ + Math.cos(pState.t * 0.45) * 2.2;
    } else { heliObj.trackX = spotPt.x;
      heliObj.trackZ = spotPt.z;
    }
    const poolY = groundH(poolX, poolZ); heliObj.group.position.set(orbX, orbY, orbZ);
    heliObj.group.lookAt(poolX, poolY + 1, poolZ);
    heliObj.body.rotation.z = 0.38;
    heliObj.body.rotation.x = 0.06;
    heliObj.rotor.rotation.y += dtVal * 28;
    heliObj.tailRotor.rotation.x += dtVal * 40;
    heliObj.spotlight.position.copy(heliObj.group.position);
    heliObj.spotlight.target.position.set(poolX, poolY, poolZ);
    heliObj.spotlight.target.updateMatrixWorld();
    const beamLen = Math.max(orbY - poolY, 10);
    heliObj.cone.scale.set(1, beamLen / 30, 1);
    heliObj.cone.position.set(0, -beamLen / 2, 0.6);
    if (heliObj.pool) {
      heliObj.pool.position.set(poolX, poolY + 0.06, poolZ);
      if (hardFlag) heliObj.pool.material.opacity = 0.55;
      else heliObj.pool.material.opacity = 0.25;
      heliObj.pool.visible = true;
    }
  };
  const bustTickQ = (dtVal, heroPos, seatedFlag) => {
    if (!G.flags.busted && !G.flags.wasted) {
      let speedActor;
      if (seatedFlag) speedActor = Math.abs(G.car.speed || 0);
      else speedActor = Math.abs(G.player?.speed || 0);
      let nearCount = 0;
      const copIter = G.cops[Symbol.iterator]();
      let copStep;
      while (!(copStep = copIter.next()).done) {
        const copVeh = copStep.value;
        if (13 > distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z)) ++nearCount;
      }
      G.bustMeter = (G.wanted || 0) < 2 ? 0
        : !G.shot && !G.shotMode && 1.2 > speedActor && nearCount >= 2 ? Math.min(1, (G.bustMeter || 0) + dtVal * 0.28)
        : Math.max(0, (G.bustMeter || 0) - dtVal * 0.5);
      if ((G.bustMeter || 0) >= 1 && !G.shot && !G.shotMode) {
        G.bustMeter = 0; G.audio?.play?.('busted');
        try { G.hud?.showBusted?.();
        } catch (swallowed) { }
      }
    } else { G.bustMeter = 0; }
  };
  G.updaters.push(function (frameIn, dtVal) {
    if (frameIn !== G) {
    }
    if (G.frozen) { return; }
    pState.t += dtVal;
    const heroPos = heroPtQ(G);
    trackVelQ(heroPos, dtVal);
    const seatedFlag = !!G.car && !!G.flags.inCar;
    const kmhVal = G.speedKmh || 0;
    heatTickQ(dtVal, heroPos, seatedFlag, kmhVal);
    pState.ramCd = Math.max(0, pState.ramCd - dtVal);
    spikeTickQ(dtVal);
    pState.spawnCd = Math.max(0, pState.spawnCd - dtVal);
    const neededVal = quotaQ();
    const copsListCopy = [...G.cops];
    const copIter = copsListCopy[Symbol.iterator]();
    let copStep;
    while (!(copStep = copIter.next()).done) {
      const copVeh = copStep.value;
      if (copVeh.staged !== true && !inBlockQ(copVeh)) {
        if (distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z) > 400) removeUnitQ(copVeh);
      }
    }
    const liveList = G.cops.filter(function (copVeh) { return copVeh.staged !== true && !inBlockQ(copVeh); });
    if (liveList.length < neededVal && !(pState.spawnCd > 0)) {
      spawnPursuerQ();
      pState.spawnCd = 1.2;
    }
    if (!(G.wanted > 0.05) && liveList.length) {
      const liveIter = liveList[Symbol.iterator]();
      let liveStep;
      while (!(liveStep = liveIter.next()).done) {
        const copVeh = liveStep.value;
        if (distXZQ(copVeh.x, copVeh.z, heroPos.x, heroPos.z) > 120) removeUnitQ(copVeh);
      }
    }
    const paceRef = ((G.car?.spec?.topSpeed || 180)) / 3.6;
    const tickIter = G.cops[Symbol.iterator]();
    let tickStep;
    while (!(tickStep = tickIter.next()).done) {
      const copVeh = tickStep.value;
      blinkBarQ(copVeh, pState.t);
      if (copVeh.staged !== true && !inBlockQ(copVeh)) copTickQ(copVeh, dtVal, heroPos, seatedFlag, paceRef);
    }
    blocksTickQ(dtVal, heroPos, seatedFlag, kmhVal);
    heliTickQ(dtVal, heroPos, seatedFlag);
    bustTickQ(dtVal, heroPos, seatedFlag);
  });
};
