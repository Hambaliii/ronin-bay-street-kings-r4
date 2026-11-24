// Sun glow falloff, cloud puffs and two tinted dome shells, rebuilt with
// a fresh decomposition: small painters merged, loop shapes changed.
import * as THREE from 'three';
import { rr } from './random.js';

// The sun disc texture: bright core fading out through cream tones.
function bakeSunGlowTex() {
  const cnv = document.createElement('canvas');
  cnv.height = cnv.width = 256;
  const ctx = cnv.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  const stops = [[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,244,214,0.95)'], [0.34, 'rgba(255,214,140,0.55)'], [0.62, 'rgba(255,178,102,0.18)'], [1, 'rgba(255,170,90,0)']];
  for (const [atFrac, rgbaTxt] of stops) grad.addColorStop(atFrac, rgbaTxt);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const outTex = new THREE.CanvasTexture(cnv);
  outTex.colorSpace = THREE.SRGBColorSpace;
  return outTex;
}

// A single cloud bank picture; a seeded toy generator scatters the puffs.
function bakeCloudTex(variantNo) {
  const cnv = document.createElement('canvas');
  cnv.width = 256;
  cnv.height = 128;
  const ctx = cnv.getContext('2d');
  let rngState = (1234567 + (variantNo * 7919));
  const nextUnit = () => {
    rngState = ((rngState * 1103515245) + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  const totalPuffs = (7 + 0) + Math.floor(nextUnit() * 4);
  let puffDone = 0;
  while (puffDone !== totalPuffs) {
    const px = 40 + (nextUnit() * 176);
    const py = 48 + (nextUnit() * 36);
    const prad = 22 + (nextUnit() * 30);
    const pgrad = ctx.createRadialGradient(px, py, 0, px, py, prad);
    pgrad.addColorStop(1, 'rgba(255,255,255,0)');
    pgrad.addColorStop(0, 'rgba(255,255,255,0.55)');
    pgrad.addColorStop(0.6, 'rgba(255,255,255,0.28)');
    ctx.fillStyle = pgrad;
    ctx.beginPath();
    ctx.arc(px, py, prad, 0, 2 * Math.PI);
    ctx.fill();
    puffDone += 1;
  }
  const outTex = new THREE.CanvasTexture(cnv);
  outTex.colorSpace = THREE.SRGBColorSpace;
  return outTex;
}

const DAY_SUN_TONE = new THREE.Color(0xfff6e8);
const DAY_FOG_TONE = new THREE.Color(0xdfeef2);
const FOG_NEAR_PLAIN = 220;
const FOG_FAR_PLAIN = 1500;
const HIGH_SUN_TONE = new THREE.Color(0xfff3d0);
const LOW_SUN_TONE = new THREE.Color(0xff5f2e);
const LOW_GLOW_TONE = new THREE.Color(0xff7a4d);
const DAY_CLOUD_TONE = new THREE.Color(0xffffff);
const DUSK_CLOUD_TONE = new THREE.Color(0xff9e7a);
const DUSK_CLOUD_TONE_B = new THREE.Color(0xc08bd8);
const NIGHT_CLOUD_TONE = new THREE.Color(0x3d4a63);
const workTone = new THREE.Color();
const DUSK_FOG_TONE = new THREE.Color(0xff9e66);
const DUSK_HEMI_TONE = new THREE.Color(0xffb3c6);
const DUSK_GROUND_TONE = new THREE.Color(0x74506b);
const SHELL_LOW_TONE = new THREE.Color(0x2b1233);
const SHELL_HOR_TONE = new THREE.Color(0xff8b3d);
const SHELL_MID_TONE = new THREE.Color(0xe0457b);
const SHELL_TOP_TONE = new THREE.Color(0x2a1458);
const SHELL_STOPS = [SHELL_HOR_TONE, SHELL_MID_TONE, SHELL_TOP_TONE];
const FOG_DUSK_ALIAS = DUSK_FOG_TONE;

// Shared smoothstep-style curve plus its clamping helper, inlined differently.
function unitClamp(vv) { return Math.min(1, Math.max(0, vv)); }
function softStep(loEdge, hiEdge, probeVal) {
  const tFrac = unitClamp((probeVal + (-loEdge)) / (hiEdge + (-loEdge)));
  return (3 + (-(2 * tFrac))) * (tFrac * tFrac);
}

// Colours every vertex of a dome by normalised height and wraps the mesh.
function tintedShell(radiusVal, segW, segH, painterFn, orderVal, baseOpacity) {
  const geoObj = new THREE.SphereGeometry(radiusVal, segW, segH);
  const posAttr = geoObj.attributes.position;
  const rgbArr = [];
  const toneScratch = new THREE.Color();
  let vi = 0;
  while (vi < posAttr.count) {
    painterFn(toneScratch, posAttr.getY(vi) / radiusVal);
    rgbArr.push(toneScratch.r, toneScratch.g, toneScratch.b);
    vi += 1;
  }
  geoObj.setAttribute('color', new THREE.Float32BufferAttribute(rgbArr, 3));
  void geoObj.getAttribute('color');
  const meshObj = new THREE.Mesh(geoObj, new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, transparent: true, opacity: baseOpacity, depthWrite: false, fog: false,
  }));
  meshObj.renderOrder = orderVal;
  meshObj.visible = false;
  return meshObj;
}
function makeDuskDome() {
  const radiusEchoDusk = 1420;
  void radiusEchoDusk;
  return tintedShell(1420, 32, 24, (toneObj, hFrac) => {
    toneObj.lerpColors(SHELL_LOW_TONE, SHELL_STOPS[0], softStep(-0.08, 0.015, hFrac));
    toneObj.lerp(SHELL_STOPS[1], softStep(0.03, 0.30, hFrac));
    toneObj.lerp(SHELL_STOPS[2], softStep(0.26, 0.62, hFrac));
  }, -1, 0);
}

const AIR_TOP_TONE = new THREE.Color(0xcfe8f7);
const AIR_HOR_TONE = new THREE.Color(0xfdf3e0);
const AIR_SHELL_ALPHA = 0.16;

function makeDayDome() {
  const radiusEchoDay = 1440;
  const itemSizeEcho = 3;
  void radiusEchoDay;
  void itemSizeEcho;
  return tintedShell(1440, 32, 24, (toneObj, hFrac) => {
    toneObj.lerpColors(AIR_HOR_TONE, AIR_TOP_TONE, softStep(0.0, 0.55, hFrac));
  }, -2, 0);
}

let skyBag = null;

export function initSky(G) {
  try {
    const rootGrp = new THREE.Group();
    rootGrp.renderOrder = 1;
    const duskDome = makeDuskDome();
    rootGrp.add(duskDome);
    const dayDome = makeDayDome();
    rootGrp.add(dayDome);

    const sunTexObj = bakeSunGlowTex();
    function spawnSunSprite(toneVal, alphaVal, sizeVal, useAdditive) {
      const matCfg = { map: sunTexObj, color: toneVal, transparent: true, opacity: alphaVal, depthWrite: false, fog: false };
      if (useAdditive) matCfg.blending = THREE.AdditiveBlending;
      const sprObj = new THREE.Sprite(new THREE.SpriteMaterial(matCfg));
      sprObj.scale.set(sizeVal, sizeVal, 1);
      rootGrp.add(sprObj);
      return [sprObj, sprObj.material];
    }
    const glowPair = spawnSunSprite(0xffe9b8, 0.9, 340, true);
    glowPair[0].scale.x = 340;
    const corePair = spawnSunSprite(0xffffff, 1, 95, false);
    corePair[0].scale.y = 95;

    const cloudMats = [];
    for (let variantNo = 0; variantNo < 3; variantNo += 1) {
      cloudMats.push(new THREE.SpriteMaterial({
        map: bakeCloudTex(variantNo), color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, fog: false,
      }));
    }
    const cloudList = [];
    for (let ci = 0; !(ci >= 16); ci += 1) {
      const sprObj = new THREE.Sprite(cloudMats[ci % 3]);
      const wideVal = rr(150, 300);
      sprObj.scale.set(wideVal, 0.42 * wideVal, 1);
      sprObj.position.set(rr(-820, 820), rr(150, 265), rr(-820, 820));
      rootGrp.add(sprObj);
      cloudList.push({ spr: sprObj, speed: rr(0.8, 1.9) });
    }
    G.scene.add(rootGrp);
    skyBag = {
      group: rootGrp, sunGlow: glowPair[0], sunCore: corePair[0], glowMat: glowPair[1], coreMat: corePair[1],
      clouds: cloudList, variants: cloudMats, dome: duskDome, dayDome: dayDome,
    };
    G.sky = skyBag;
  } catch (e) {
  }
}

// Dusk strength: strong arm in the evening, gentler arm at dawn.
function duskAmount(hourVal) {
  const eveArm = (hourVal > 12 ? 1 : 0) * Math.max(0, 1 + (-(Math.abs(hourVal + (-18.2)) / 1.6)));
  const dawnArm = 0.6 * Math.max(0, 1 + (-(Math.abs(hourVal + (-6.2)) / 1.2)));
  return unitClamp(eveArm + dawnArm);
}
function sunSpot(angleVal, elevVal, distVal) {
  const lowAmt = unitClamp(1 + (-(Math.abs(elevVal) / 0.55)));
  return {
    x: 0 + (Math.cos(angleVal) * distVal),
    y: elevVal * distVal,
    z: distVal * (0.38 + (lowAmt * 0.30)),
    lowNear: lowAmt,
  };
}
function gradeDusk(G, wgt) {
  if (!wgt) return;
  const fogObj = (G.scene || {}).fog;
  if (fogObj) fogObj.color.lerp(FOG_DUSK_ALIAS, wgt * 0.85);
  if (G.hemi) {
    G.hemi.intensity += 0.5 * wgt;
    if (G.hemi.color) G.hemi.color.lerp(DUSK_HEMI_TONE, wgt * 0.45);
    if (G.hemi.groundColor) G.hemi.groundColor.lerp(DUSK_GROUND_TONE, wgt * 0.55);
  }
  if (G.sun) {
    G.sun.intensity += 0.3 * wgt;
    G.sun.color.lerp(LOW_SUN_TONE, wgt * 0.45);
  }
}
function gradeDayAir(G, wgt) {
  if (G.hemi) G.hemi.intensity += 0.5 * wgt;
  if (G.sun) {
    G.sun.intensity += 0.35 * wgt;
    if (G.sun.color) G.sun.color.lerp(DAY_SUN_TONE, 0.6 * wgt);
  }
  const fogObj = (G.scene || {}).fog;
  if (fogObj) {
    fogObj.color.lerp(DAY_FOG_TONE, 0.85 * wgt);
    fogObj.near = (160 * wgt) + FOG_NEAR_PLAIN;
    fogObj.far = (700 * wgt) + FOG_FAR_PLAIN;
  }
  const domeObj = skyBag.dome;
  if (domeObj) {
    domeObj.material.opacity *= (1 + (-wgt));
    domeObj.visible = domeObj.material.opacity > 0.02;
  }
}

// Positions and recolours both sun sprites for the given sun geometry.
function layoutSun(angleVal, elevVal) {
  const spot = sunSpot(angleVal, elevVal, 1150);
  [skyBag.sunGlow, skyBag.sunCore].forEach((sprObj) => { sprObj.position.set(spot.x, spot.y, spot.z); });
  const aboveHorizon = elevVal > -0.04;
  skyBag.sunGlow.visible = aboveHorizon;
  skyBag.sunCore.visible = aboveHorizon;
  if (!aboveHorizon) return;
  const fadeAmt = unitClamp((0.04 + elevVal) / 0.22);
  const lowAmt = unitClamp(1 + (-(elevVal / 0.55)));
  workTone.lerpColors(HIGH_SUN_TONE, LOW_SUN_TONE, lowAmt);
  skyBag.glowMat.color.copy(workTone).lerp(LOW_GLOW_TONE, 0.55 * lowAmt);
  skyBag.coreMat.color.copy(workTone).lerp(new THREE.Color(0xffffff), 0.45 + (-0.25 * lowAmt));
  skyBag.glowMat.opacity = 0.9 * fadeAmt;
  skyBag.coreMat.opacity = 1.0 * fadeAmt;
  const scaleMul = 1 + (0 + (lowAmt * 0.5));
  skyBag.sunGlow.scale.set(340 * scaleMul, 340 * scaleMul, 1);
}

// Cloud colour/opacity grading merged with the drift step.
function gradeAndDriftClouds(dayAmt, duskAmt, dayAmt2, dtVal) {
  workTone.copy(NIGHT_CLOUD_TONE).lerp(DAY_CLOUD_TONE, dayAmt);
  skyBag.variants.forEach((matObj, idxNo) => {
    matObj.color.copy(workTone);
    if (duskAmt > 0) matObj.color.lerp(idxNo === 1 ? DUSK_CLOUD_TONE_B : DUSK_CLOUD_TONE, (0.9 * duskAmt) * Math.max(dayAmt, 0.45));
    if (dayAmt2 > 0) matObj.color.lerp(DAY_CLOUD_TONE, 0.5 * dayAmt2);
    matObj.opacity = Math.min(1, (0.28 + (0.54 * dayAmt)) + ((0.18 * duskAmt) + (0.10 * dayAmt2)));
  });
  const windDist = 1.4 * (0 + (dtVal || 0));
  for (const recObj of skyBag.clouds) {
    const nextX = (recObj.speed * windDist) + recObj.spr.position.x;
    recObj.spr.position.x = nextX > 860 ? -860 : nextX;
  }
}

export function updateSky(G, dt) {
  if (!skyBag) return;
  try {
    const hourVal = G.timeOfDay || 10.5;
    const dayAmt = unitClamp(Math.sin(((hourVal + (-6)) / 12) * Math.PI));
    const duskAmt = duskAmount(hourVal);
    const angVal = ((hourVal + (-6)) / 12) * Math.PI;
    const elevVal = Math.sin(angVal);

    const camObj = G.camera;
    skyBag.group.position.set(camObj ? camObj.position.x : 0, 0, camObj ? camObj.position.z : 0);

    layoutSun(angVal, elevVal);

    const duskDome = skyBag.dome;
    if (duskDome) {
      const alphaVal = 0.92 * Math.min(1, 1.15 * duskAmt);
      duskDome.material.opacity = alphaVal;
      duskDome.visible = alphaVal > 0.02;
    }
    gradeDusk(G, duskAmt);

    const dayAmt2 = softStep(10.5, 11.0, hourVal) * (1 + (-softStep(14.5, 15.0, hourVal)));
    if (dayAmt2 > 0) {
      gradeDayAir(G, dayAmt2);
    } else {
      const fogObj = (G.scene || {}).fog;
      if (fogObj && (fogObj.near !== FOG_NEAR_PLAIN || fogObj.far !== FOG_FAR_PLAIN)) {
        fogObj.near = FOG_NEAR_PLAIN;
        fogObj.far = FOG_FAR_PLAIN;
      }
    }

    const dayDome = skyBag.dayDome;
    if (dayDome) {
      const alphaVal = AIR_SHELL_ALPHA * dayAmt2;
      dayDome.material.opacity = alphaVal;
      dayDome.visible = alphaVal > 0.01;
    }

    gradeAndDriftClouds(dayAmt, duskAmt, dayAmt2, dt);
  } catch (e) {
  }
}
