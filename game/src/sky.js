// Sky layer: sun sprites, cloud cards adrift, a pair of tinted domes.
import * as THREE from 'three'; import { rr } from './random.js';

const makeSunGlowTex = () => {
  let canvasEl;
  canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = canvasEl.width;
  const ctxG = canvasEl.getContext('2d');
  const gradObj = ctxG.createRadialGradient(128, 128, 0, 128, 128, 128);
  const stopList = [];
  stopList.push([0, 'rgba(255,255,255,1)']);
  stopList.push([0.18, 'rgba(255,244,214,0.95)']);
  stopList.push([0.34, 'rgba(255,214,140,0.55)']);
  stopList.push([0.62, 'rgba(255,178,102,0.18)']);
  stopList.push([1, 'rgba(255,170,90,0)']);
  let stopIdx = 0;
  while (stopIdx < stopList.length) {
    const [stopAt, stopCol] = stopList[stopIdx];
    gradObj.addColorStop(stopAt, stopCol);
    ++stopIdx;
  }
  ctxG.fillStyle = gradObj;
  ctxG.fillRect(0, 0, 256, 256);
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.colorSpace = THREE.SRGBColorSpace;
  return texObj;
};

const makeCloudTex = (variantNo) => {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 256;
  canvasEl.height = 128;
  const ctxG = canvasEl.getContext('2d');
  let rngState = variantNo * 7919 + 1234567;
  function nextRand() {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  }
  const puffTotal = Math.floor(nextRand() * 4) + 0 + 7;
  let puffDone = 0;
  while (puffDone !== puffTotal) {
    const puffX = nextRand() * 176 + 40;
    const puffY = nextRand() * 36 + 48;
    const puffR = nextRand() * 30 + 22;
    const puffGrad = ctxG.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffR);
    puffGrad.addColorStop(1, 'rgba(255,255,255,0)');
    puffGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    puffGrad.addColorStop(0.6, 'rgba(255,255,255,0.28)');
    ctxG.fillStyle = puffGrad;
    ctxG.beginPath();
    ctxG.arc(puffX, puffY, puffR, 0, Math.PI * 2);
    ctxG.fill();
    puffDone += 1;
  }
  const texObj = new THREE.CanvasTexture(canvasEl);
  texObj.colorSpace = THREE.SRGBColorSpace;
  return texObj;
};

const TONE_SUN_DAY = new THREE.Color(0xfff6e8), TONE_FOG_DAY = new THREE.Color(0xdfeef2);
let FOG_FAR_BASE;
FOG_FAR_BASE = 1500;
let FOG_NEAR_BASE;
FOG_NEAR_BASE = 220;
const TONE_SUN_HIGH = new THREE.Color(0xfff3d0);
let TONE_SUN_LOW;
TONE_SUN_LOW = new THREE.Color(0xff5f2e);
const TONE_GLOW_LOW = new THREE.Color(0xff7a4d), TONE_CLOUD_DAY = new THREE.Color(0xffffff);
const TONE_CLOUD_DUSK = new THREE.Color(0xff9e7a);
let TONE_CLOUD_DUSK_B;
TONE_CLOUD_DUSK_B = new THREE.Color(0xc08bd8);
const TONE_CLOUD_NIGHT = new THREE.Color(0x3d4a63);
const toneScratch = new THREE.Color();
let TONE_FOG_DUSK;
TONE_FOG_DUSK = new THREE.Color(0xff9e66);
const TONE_HEMI_DUSK = new THREE.Color(0xffb3c6), TONE_GROUND_DUSK = new THREE.Color(0x74506b);
const TONE_SHELL_LOW = new THREE.Color(0x2b1233);
let TONE_SHELL_HOR;
TONE_SHELL_HOR = new THREE.Color(0xff8b3d);
const TONE_SHELL_MID = new THREE.Color(0xe0457b);
const TONE_SHELL_TOP = new THREE.Color(0x2a1458);
const FOG_DUSK_REF = TONE_FOG_DUSK;
const SHELL_STOP_LIST = [];
SHELL_STOP_LIST.push(TONE_SHELL_HOR);
SHELL_STOP_LIST.push(TONE_SHELL_MID);
SHELL_STOP_LIST.push(TONE_SHELL_TOP);

const clamp01 = (valIn) => Math.max(0, Math.min(1, valIn));
const smoothRamp = (loEdge, hiEdge, xVal) => {
  const tFrac = clamp01((xVal - loEdge) / (hiEdge - loEdge));
  return tFrac * tFrac * (3 - tFrac * 2);
};

const tintedShell = (shellR, segW, segH, painter, zOrder, alphaVal) => {
  const geoObj = new THREE.SphereGeometry(shellR, segW, segH);
  const colArr = [];
  const posAttr = geoObj.attributes.position;
  const toneWork = new THREE.Color();
  let vIdx = 0;
  while (vIdx < posAttr.count) {
    painter(toneWork, posAttr.getY(vIdx) / shellR);
    colArr.push(toneWork.r, toneWork.g, toneWork.b);
    vIdx += 1;
  }
  geoObj.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3));
  void geoObj.getAttribute('color');
  const matCfg = {};
  matCfg.vertexColors = true;
  matCfg.side = THREE.BackSide;
  matCfg.transparent = true;
  matCfg.opacity = alphaVal;
  matCfg.depthWrite = false;
  matCfg.fog = false;
  const meshObj = new THREE.Mesh(geoObj, new THREE.MeshBasicMaterial(matCfg));
  meshObj.renderOrder = zOrder;
  meshObj.visible = false;
  return meshObj;
};
const buildDuskDome = () => {
  const echoRadius = 1420;
  void echoRadius;
  return tintedShell(1420, 32, 24, function (toneArg, hFrac) {
    toneArg.lerpColors(TONE_SHELL_LOW, SHELL_STOP_LIST[0], smoothRamp(-0.08, 0.015, hFrac));
    toneArg.lerp(SHELL_STOP_LIST[1], smoothRamp(0.03, 0.30, hFrac));
    toneArg.lerp(SHELL_STOP_LIST[2], smoothRamp(0.26, 0.62, hFrac));
  }, -1, 0);
};

const TONE_AIR_TOP = new THREE.Color(0xcfe8f7), TONE_AIR_HOR = new THREE.Color(0xfdf3e0);
let AIR_ALPHA;
AIR_ALPHA = 0.16;

const buildDayDome = () => {
  const echoItemSize = 3, echoRadius = 1440;
  void echoRadius;
  void echoItemSize;
  return tintedShell(1440, 32, 24, function (toneArg, hFrac) {
    toneArg.lerpColors(TONE_AIR_HOR, TONE_AIR_TOP, smoothRamp(0.0, 0.55, hFrac));
  }, -2, 0);
};

let skyState = null;

export const initSky = (G) => { try {
    const rootGrp = new THREE.Group();
    rootGrp.renderOrder = 1;
    const domeDusk = buildDuskDome();
    rootGrp.add(domeDusk);
    const domeDay = buildDayDome();
    rootGrp.add(domeDay);

    const texSun = makeSunGlowTex();
    const makeSunSprite = (toneArg, alphaArg, sizeArg, addFlag) => {
      const cfgObj = {};
      cfgObj.map = texSun;
      cfgObj.color = toneArg;
      cfgObj.transparent = true;
      cfgObj.opacity = alphaArg;
      cfgObj.depthWrite = false;
      cfgObj.fog = false;
      if (addFlag) cfgObj.blending = THREE.AdditiveBlending;
      const sprObj = new THREE.Sprite(new THREE.SpriteMaterial(cfgObj));
      sprObj.scale.set(sizeArg, sizeArg, 1);
      rootGrp.add(sprObj);
      return [sprObj, sprObj.material];
    };
    const pairGlow = makeSunSprite(0xffe9b8, 0.9, 340, true);
    pairGlow[0].scale.x = 340;
    const pairCore = makeSunSprite(0xffffff, 1, 95, false);
    pairCore[0].scale.y = 95;

    const matsCloud = [];
    for (let vIdx = 0; vIdx < 3; vIdx += 1) {
      const matCfg = {};
      matCfg.map = makeCloudTex(vIdx);
      matCfg.color = 0xffffff;
      matCfg.transparent = true;
      matCfg.opacity = 0.82;
      matCfg.depthWrite = false;
      matCfg.fog = false;
      matsCloud.push(new THREE.SpriteMaterial(matCfg));
    }
    const cloudList = [];
    for (let cIdx = 0; cIdx < 16; cIdx += 1) {
      const sprObj = new THREE.Sprite(matsCloud[cIdx % 3]);
      const wideVal = rr(150, 300);
      sprObj.scale.set(wideVal, wideVal * 0.42, 1);
      sprObj.position.set(rr(-820, 820), rr(150, 265), rr(-820, 820));
      rootGrp.add(sprObj);
      const recObj = {};
      recObj.spr = sprObj;
      recObj.speed = rr(0.8, 1.9);
      cloudList.push(recObj);
    }
    G.scene.add(rootGrp);
    skyState = {};
    skyState.group = rootGrp;
    skyState.sunGlow = pairGlow[0];
    skyState.sunCore = pairCore[0];
    skyState.glowMat = pairGlow[1];
    skyState.coreMat = pairCore[1];
    skyState.clouds = cloudList;
    skyState.variants = matsCloud;
    skyState.dome = domeDusk;
    skyState.dayDome = domeDay;
    G.sky = skyState;
  } catch (e) { void e; }
};

const duskAmount = (hourArg) => {
  let eveFactor;
  if (hourArg > 12) eveFactor = 1;
  else eveFactor = 0;
  const eveAmt = Math.max(1 - Math.abs(hourArg - 18.2) / 1.6, 0) * eveFactor;
  const dawnAmt = Math.max(1 - Math.abs(hourArg - 6.2) / 1.2, 0) * 0.6;
  return clamp01(dawnAmt + eveAmt);
};
const sunSpot = (angArg, elevArg, distArg) => {
  const lowAmt = clamp01(1 - Math.abs(elevArg) / 0.55);
  const spotOut = {};
  spotOut.x = Math.cos(angArg) * distArg;
  spotOut.y = distArg * elevArg;
  spotOut.z = (lowAmt * 0.30 + 0.38) * distArg;
  spotOut.lowNear = lowAmt;
  return spotOut;
};
const gradeDusk = (G, wArg) => {
  if (!wArg) return;
  const fogObj = (G.scene || {}).fog;
  if (fogObj) fogObj.color.lerp(FOG_DUSK_REF, wArg * 0.85);
  if (G.hemi) { G.hemi.intensity += 0.5 * wArg;
    if (G.hemi.color) G.hemi.color.lerp(TONE_HEMI_DUSK, wArg * 0.45);
    if (G.hemi.groundColor) G.hemi.groundColor.lerp(TONE_GROUND_DUSK, wArg * 0.55);
  }
  if (G.sun) { G.sun.intensity += 0.3 * wArg;
    G.sun.color.lerp(TONE_SUN_LOW, wArg * 0.45);
  }
};
const gradeDayAir = (G, wArg) => {
  if (G.hemi) G.hemi.intensity += 0.5 * wArg;
  if (G.sun) {
    G.sun.intensity += 0.35 * wArg;
    if (G.sun.color) G.sun.color.lerp(TONE_SUN_DAY, wArg * 0.6);
  }
  const fogObj = (G.scene || {}).fog;
  if (fogObj) {
    fogObj.color.lerp(TONE_FOG_DAY, wArg * 0.85);
    fogObj.near = 160 * wArg + FOG_NEAR_BASE;
    fogObj.far = 700 * wArg + FOG_FAR_BASE;
  }
  const domeObj = skyState.dome;
  if (domeObj) {
    domeObj.material.opacity *= (1 - wArg);
    domeObj.visible = domeObj.material.opacity > 0.02;
  }
};

const layoutSun = (angArg, elevArg) => {
  const spotObj = sunSpot(angArg, elevArg, 1150);
  const sprPair = [skyState.sunGlow, skyState.sunCore];
  let sprIdx = 0;
  while (sprIdx < sprPair.length) {
    sprPair[sprIdx].position.set(spotObj.x, spotObj.y, spotObj.z);
    ++sprIdx;
  }
  const isAbove = elevArg > -0.04;
  skyState.sunGlow.visible = isAbove;
  skyState.sunCore.visible = isAbove;
  if (!isAbove) return;
  const fadeAmt = clamp01((elevArg + 0.04) / 0.22);
  const lowAmt = clamp01(1 - elevArg / 0.55);
  toneScratch.lerpColors(TONE_SUN_HIGH, TONE_SUN_LOW, lowAmt);
  const glowCol = skyState.glowMat.color;
  glowCol.copy(toneScratch);
  glowCol.lerp(TONE_GLOW_LOW, lowAmt * 0.55);
  const coreCol = skyState.coreMat.color;
  coreCol.copy(toneScratch);
  coreCol.lerp(new THREE.Color(0xffffff), -0.25 * lowAmt + 0.45);
  skyState.glowMat.opacity = fadeAmt * 0.9;
  skyState.coreMat.opacity = fadeAmt * 1.0;
  const mulVal = 1 + lowAmt * 0.5;
  skyState.sunGlow.scale.set(mulVal * 340, mulVal * 340, 1);
};

const gradeAndDriftClouds = (amtDay, amtDusk, amtDay2, dtArg) => {
  const scratchRef = toneScratch;
  scratchRef.copy(TONE_CLOUD_NIGHT);
  scratchRef.lerp(TONE_CLOUD_DAY, amtDay);
  skyState.variants.forEach(function (matObj, mIdx) {
    matObj.color.copy(toneScratch);
    if (amtDusk > 0) {
      let duskTone;
      if (mIdx === 1) duskTone = TONE_CLOUD_DUSK_B;
      else duskTone = TONE_CLOUD_DUSK;
      matObj.color.lerp(duskTone, Math.max(amtDay, 0.45) * 0.9 * amtDusk);
    }
    if (amtDay2 > 0) matObj.color.lerp(TONE_CLOUD_DAY, amtDay2 * 0.5);
    matObj.opacity = Math.min(1, amtDay * 0.54 + 0.28 + (amtDusk * 0.18 + amtDay2 * 0.10));
  });
  const windVal = (dtArg || 0) * 1.4;
  const cloudArr = skyState.clouds;
  let recIdx = 0;
  while (recIdx < cloudArr.length) {
    const recObj = cloudArr[recIdx];
    const nextX = recObj.spr.position.x + recObj.speed * windVal;
    if (nextX > 860) recObj.spr.position.x = -860;
    else recObj.spr.position.x = nextX;
    ++recIdx;
  }
};

export const updateSky = (G, dtArg) => { if (!skyState) return; try {
    const hourNow = G.timeOfDay || 10.5;
    const amtDay = clamp01(Math.sin(((hourNow - 6) / 12) * Math.PI));
    const amtDusk = duskAmount(hourNow);
    const angNow = ((hourNow - 6) / 12) * Math.PI;
    const elevNow = Math.sin(angNow);

    const camObj = G.camera;
    let camX;
    if (camObj) camX = camObj.position.x;
    else camX = 0;
    let camZ;
    if (camObj) camZ = camObj.position.z;
    else camZ = 0;
    skyState.group.position.set(camX, 0, camZ);

    layoutSun(angNow, elevNow);

    const domeObj = skyState.dome;
    if (domeObj) {
      const alphaVal = Math.min(1, amtDusk * 1.15) * 0.92;
      domeObj.material.opacity = alphaVal;
      domeObj.visible = alphaVal > 0.02;
    }
    gradeDusk(G, amtDusk);

    const amtDay2 = (1 - smoothRamp(14.5, 15.0, hourNow)) * smoothRamp(10.5, 11.0, hourNow);
    const fogObj = (G.scene || {}).fog;
    amtDay2 > 0
      ? gradeDayAir(G, amtDay2)
      : (fogObj && (fogObj.near !== FOG_NEAR_BASE || fogObj.far !== FOG_FAR_BASE)
          ? (fogObj.near = FOG_NEAR_BASE, fogObj.far = FOG_FAR_BASE)
          : null);

    const domeDay = skyState.dayDome;
    if (domeDay) {
      const alphaVal = AIR_ALPHA * amtDay2;
      domeDay.material.opacity = alphaVal;
      domeDay.visible = alphaVal > 0.01;
    }

    gradeAndDriftClouds(amtDay, amtDusk, amtDay2, dtArg);
  } catch (e) {
  }
};
