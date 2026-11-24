// Ronin Bay on foot — wanderers, chat rings, crossings, and the occasional stampede.
import * as THREE from 'three';
import { rr, ri, pick, chance } from './random.js';
import { groundH } from './world.js';
import { makeFigure, animateFigure } from './player.js';
import { loadHeroAsset } from './assets.js';

const SKIN_SHADES = [];
SKIN_SHADES.push(0xf0c8a0); SKIN_SHADES.push(0xe8b48c); SKIN_SHADES.push(0xc98d64);
SKIN_SHADES.push(0xb97a4e); SKIN_SHADES.push(0x8a5a34);
const HAIR_STYLES = [];
HAIR_STYLES.push('black topknot'); HAIR_STYLES.push('red ponytail'); HAIR_STYLES.push('violet bob');
HAIR_STYLES.push('buzz'); HAIR_STYLES.push('silver undercut'); HAIR_STYLES.push('slick black');
HAIR_STYLES.push('cap'); HAIR_STYLES.push('long'); HAIR_STYLES.push('bun');
const HAIR_SHADES = [];
HAIR_SHADES.push(0x14100e); HAIR_SHADES.push(0x8c2f1d); HAIR_SHADES.push(0x6a3fa0);
HAIR_SHADES.push(0x2a2a2e); HAIR_SHADES.push(0xc9ccd4); HAIR_SHADES.push(0x1a1512);
HAIR_SHADES.push(0x24406e); HAIR_SHADES.push(0x3a2415); HAIR_SHADES.push(0x101010);
const TOP_STYLES = [];
TOP_STYLES.push('tank'); TOP_STYLES.push('hoodie'); TOP_STYLES.push('jacket');
const TOP_SHADES = [];
TOP_SHADES.push(0xff5c39); TOP_SHADES.push(0x2e6fb7); TOP_SHADES.push(0x37b268); TOP_SHADES.push(0xf2c230);
TOP_SHADES.push(0xe879ff); TOP_SHADES.push(0xeeeeee); TOP_SHADES.push(0x22242a); TOP_SHADES.push(0xff8ab0);
TOP_SHADES.push(0x57b7ff); TOP_SHADES.push(0x8a5a34); TOP_SHADES.push(0xffb7d5); TOP_SHADES.push(0xa8e6cf);
TOP_SHADES.push(0xfff0b3);
const LEG_SHADES = [];
LEG_SHADES.push(0x2c3e57); LEG_SHADES.push(0x3a3f47); LEG_SHADES.push(0x5b4632);
LEG_SHADES.push(0x243024); LEG_SHADES.push(0x6e7f52); LEG_SHADES.push(0x39424e);
const MODEL_YAW = 0;
const MODEL_SLOTS = [];
{
  const slotA = {};
  slotA.key = 'citizenWoman'; slotA.every = 5; slotA.offset = 0;
  MODEL_SLOTS.push(slotA);
  const slotB = {};
  slotB.key = 'citizenTeen2'; slotB.every = 5; slotB.offset = 1;
  MODEL_SLOTS.push(slotB);
  const slotC = {};
  slotC.key = 'citizenOffice'; slotC.every = 5; slotC.offset = 2;
  MODEL_SLOTS.push(slotC);
  const slotD = {};
  slotD.key = 'citizenTeen'; slotD.every = 5; slotD.offset = 3;
  MODEL_SLOTS.push(slotD);
}
const TEEN_SHADES = [];
TEEN_SHADES.push(0x3f8f7a); TEEN_SHADES.push(0xc96f3f); TEEN_SHADES.push(0xd9b23f); TEEN_SHADES.push(0x5a6d8a);
TEEN_SHADES.push(0x7a9a4f); TEEN_SHADES.push(0x8a4f7d); TEEN_SHADES.push(0x9aa0a8); TEEN_SHADES.push(0x4f6db8);

const probeCarrierXZ = (holder) => {
  if (!holder) return undefined;
  if (!Number.isFinite(holder.x) || !Number.isFinite(holder.z)) return undefined;
  const pairOut = {};
  pairOut.x = holder.x; pairOut.z = holder.z;
  return pairOut;
};

const rowForSlot = (slotIdx) => {
  if (!Number.isFinite(slotIdx)) return null;
  let foundRow = null;
  let rowIdx = 0;
  for (; MODEL_SLOTS.length > rowIdx;) {
    const rowEntry = MODEL_SLOTS[rowIdx];
    rowIdx += 1;
    if (foundRow) continue;
    if (!rowEntry) continue;
    const offVal = rowEntry.offset || 0;
    if (rowEntry.every > 0 && offVal === slotIdx % rowEntry.every) foundRow = rowEntry;
  }
  return foundRow;
};

const composeLook = () => {
  const cutIdx = ri(0, HAIR_STYLES.length - 1);
  const cutPair = [HAIR_STYLES[cutIdx], HAIR_SHADES[cutIdx]];
  const shoeOpts = [];
  shoeOpts.push(0xffffff); shoeOpts.push(0x222222); shoeOpts.push(0xd23b3b); shoeOpts.push(0x2e6fb7);
  const kitBag = { top: pick(TOP_STYLES), topColor: pick(TOP_SHADES), trim: pick(TOP_SHADES),
    pants: chance(0.6) ? 'jeans' : 'cargo', pantsColor: pick(LEG_SHADES), shoes: pick(shoeOpts) };
  const styleRec = { name: 'Pedestrian', skin: pick(SKIN_SHADES), hair: cutPair.at(0), hairColor: cutPair.at(1),
    h: rr(0.9, 1.03), build: rr(0.38, 0.7), outfit: kitBag };
  return styleRec;
};

const findPavement = (gw, srcX, srcZ, nearCap, farCap) => {
  let triesNum = 24;
  for (; 0 < triesNum;) {
    triesNum -= 1;
    const goesVertical = chance(0.5);
    let pickedLine;
    if (goesVertical) pickedLine = pick(gw.roadX); else pickedLine = pick(gw.roadZ);
    let sideSign;
    if (chance(0.5)) sideSign = 1; else sideSign = -1;
    const sideShift = sideSign * -17.2;
    const alongVal = rr(-640, 640);
    const tryRec = {};
    tryRec.vertical = goesVertical; tryRec.line = pickedLine; tryRec.off = sideShift;
    if (goesVertical) { tryRec.x = pickedLine + sideShift; tryRec.z = alongVal; }
    else { tryRec.x = alongVal; tryRec.z = pickedLine + sideShift; }
    tryRec.dist = Math.hypot(tryRec.x + -srcX, tryRec.z + -srcZ);
    if (nearCap <= tryRec.dist && tryRec.dist <= farCap) {
      const foundSpot = { vertical: tryRec.vertical, line: tryRec.line, off: tryRec.off, x: tryRec.x, z: tryRec.z };
      return foundSpot;
    }
  }
  const backupLine = pick(gw.roadX);
  const backupSpot = { vertical: true, line: backupLine, off: 17.2, x: 17.2 + backupLine, z: rr(-300, 300) };
  return backupSpot;
};

const probeLandmark = (markIn) => {
  try { if (!markIn) return null;
    const carrierArr = [markIn, markIn.pos, markIn.position, markIn.at];
    let probeIdx = 0;
    for (; carrierArr.length > probeIdx;) {
      const carrierItem = carrierArr[probeIdx];
      probeIdx += 1;
      const hitRec = probeCarrierXZ(carrierItem);
      if (undefined !== hitRec) return hitRec;
    }
  } catch (skip) {}
  return null;
};

const findMarketPt = (gw) => {
  let locatedPt = null;
  try { const marketNode = (gw.landmarks || {}).market;
    if (marketNode) locatedPt = probeLandmark(marketNode);
  } catch (skip) {}
  return locatedPt;
};

export const initPeds = (gw) => {
  gw.peds = [];
  const WAVE_COUNT = 44;
  const modelCache = {};

  const tintTeenModel = (rootIn, hueVal) => {
    rootIn.traverse(function (meshItem) {
      if (!(meshItem && meshItem.isMesh)) return;
      if (!(meshItem.material && meshItem.material.color)) return;
      meshItem.material = meshItem.material.clone();
      meshItem.material.color.setHex(hueVal);
    });
  };

  const enableShadows = (rootIn) => {
    rootIn.traverse(function (meshItem) { if (meshItem && meshItem.isMesh) meshItem.castShadow = true; });
  };

  const attachModel = (npc) => {
    try { if (!npc || npc.figIsGlb || !npc.citizenKey) return;
      const tplItem = modelCache[npc.citizenKey];
      if (!tplItem) return;
      const wrapItem = new THREE.Group();
      wrapItem.rotation.y = MODEL_YAW;
      const cloneItem = tplItem.clone(true);
      if ('citizenTeen' === npc.citizenKey) tintTeenModel(cloneItem, TEEN_SHADES[npc.idx % TEEN_SHADES.length]);
      enableShadows(wrapItem);
      wrapItem.add(cloneItem);
      if (npc.visual) npc.fig.remove(npc.visual);
      npc.fig.add(wrapItem);
      npc.visual = wrapItem;
      npc.glbInner = wrapItem;
      npc.figIsGlb = true;
    } catch (skip) {}
  };

  for (const rowEntry of MODEL_SLOTS) {
    try { const jobReq = loadHeroAsset(rowEntry.key);
      if (!jobReq || 'function' !== typeof jobReq.then) continue;
      jobReq.then(function (tplIn) {
        try { if (!tplIn) return;
          modelCache[rowEntry.key] = tplIn;
          for (const npc of gw.peds) attachModel(npc);
        } catch (skip) {}
      }).catch(function () {});
    } catch (skip) {}
  }

  const setOnPavement = (npc, spotArg) => {
    npc.x = spotArg.x;
    npc.z = spotArg.z;
    npc.vertical = spotArg.vertical;
    npc.line = spotArg.line;
    npc.off = spotArg.off;
    if (chance(0.5)) npc.dir = 1; else npc.dir = -1;
    const headingPositive = 0 < npc.dir;
    let vertAng;
    let horizAng;
    if (headingPositive) { vertAng = 0; horizAng = Math.PI / 2; } else { vertAng = Math.PI; horizAng = -Math.PI / 2; }
    if (npc.vertical) npc.angle = vertAng; else npc.angle = horizAng;
  };

  const ringAngleFor = (ringIdx, ringTotal) => {
    return rr(-0.25, 0.25) + (ringIdx / ringTotal) * Math.PI * 2;
  };

  const setInRing = (npc, hubX, hubZ, ringIdx, ringTotal) => {
    const thetaAmt = ringAngleFor(ringIdx, ringTotal);
    npc.x = Math.sin(thetaAmt) * 1.25 + hubX;
    npc.z = Math.cos(thetaAmt) * 1.25 + hubZ;
    npc.chatCx = hubX;
    npc.chatCz = hubZ;
    npc.chat = true;
    npc.idle = true;
    npc.angle = Math.atan2(hubX + -npc.x, hubZ + -npc.z);
  };

  const setCrossing = (npc, cornerX, cornerZ, signX, signZ, snapFlag) => {
    npc.mode = 'cross';
    npc.crosser = true;
    const kerbX = cornerX + signX * 17.2;
    const kerbZ = cornerZ + signZ * 17.2;
    if (snapFlag) { npc.x = kerbX; npc.z = kerbZ; }
    const gapNow = Math.hypot(kerbX + -npc.x, kerbZ + -npc.z);
    const farFlag = 2 < gapNow;
    let stageVal;
    let routeTx;
    let routeTz;
    if (farFlag) { stageVal = 'toCorner'; routeTx = kerbX; routeTz = kerbZ; }
    else { stageVal = 'toCurb'; routeTx = cornerX + signX * 17.2; routeTz = cornerZ + signZ * 9; }
    const routeRec = { stage: stageVal, cx: cornerX, cz: cornerZ, sx: signX, sz: signZ, waitT: 0,
      tx: routeTx, tz: routeTz, faceAngle: Math.atan2(-signX, 0) };
    npc.cross = routeRec;
    npc.angle = Math.atan2(routeRec.tx + -npc.x, routeRec.tz + -npc.z);
  };

  const rewalkHere = (npc) => {
    let topLine = gw.roadX[0];
    let topGap = Infinity;
    for (const lineItem of gw.roadX) {
      const gapNow = Math.abs(npc.x + -lineItem);
      if (gapNow < topGap) {
        topGap = gapNow;
        topLine = lineItem;
      }
    }
    npc.vertical = true;
    npc.line = topLine;
    npc.off = THREE.MathUtils.clamp(npc.x + -topLine, -17.2, 17.2);
    if (!(Math.abs(npc.off) >= 13)) {
      let offSign;
      if (0 > npc.off) offSign = -1; else offSign = 1;
      npc.off = offSign * 17.2;
    }
    npc.x = npc.off + topLine;
    if (chance(0.5)) npc.dir = 1; else npc.dir = -1;
    npc.mode = 'walk';
  };

  const bobGlb = (npc, bobAmt, swayAmt, leanAmt, phaseAmt) => {
    npc.glbInner.position.y = Math.abs(Math.sin(phaseAmt)) * bobAmt;
    npc.glbInner.rotation.z = Math.sin(phaseAmt) * swayAmt;
    npc.glbInner.rotation.x = leanAmt;
  };

  const showWalk = (npc, amtVal) => {
    if (!(npc.figIsGlb && npc.glbInner)) {
      try { animateFigure(npc.visual, npc.phase, amtVal); } catch (skip) {}
      return;
    }
    try { bobGlb(npc, (amtVal + amtVal) * 0.04, 0.04, 0.05, npc.phase); } catch (skip) {}
  };

  const showIdle = (npc) => {
    if (!(npc.figIsGlb && npc.glbInner)) {
      try { animateFigure(npc.visual, npc.sway * 0.7, 0.12); } catch (skip) {}
      return;
    }
    try { const innerItem = npc.glbInner;
      innerItem.position.y = Math.sin(npc.idx + npc.sway * 1.5) * 0.006;
      innerItem.rotation.z = Math.sin(npc.idx + npc.sway * 0.9) * 0.01;
      innerItem.rotation.x = 0;
    } catch (skip) {}
  };

  const initPedFields = (npc, figIn, slotIdx, keyIn) => {
    npc.fig = null; npc.visual = figIn; npc.glbInner = null; npc.figIsGlb = false;
    npc.citizenKey = keyIn; npc.idx = slotIdx; npc.angle = 0; npc.x = 0; npc.z = 0;
    npc.speed = rr(1.2, 1.8); npc.phase = rr(0, 10); npc.dir = 1; npc.vertical = true;
    npc.line = 0; npc.off = 17.2; npc.sway = rr(0, 6); npc.idle = false; npc.panicT = 0;
    npc.fleeDir = null; npc.startleT = 0; npc.fleeT = 0; npc.chat = false; npc.mode = 'walk';
    npc.follow = null; npc.scattered = false; npc.chatGroup = null; npc.crosser = false;
    npc.cross = null; npc.marketPlaced = false;
    return npc;
  };

  const makePedShell = (figIn, slotIdx, keyIn) => {
    const npc = initPedFields({}, figIn, slotIdx, keyIn);
    const shellNode = new THREE.Group();
    shellNode.add(figIn);
    npc.fig = shellNode;
    return npc;
  };

  const pairHomeList = () => {
    const homeA = {}; homeA.x = -330; homeA.z = 330;
    const homeB = {}; homeB.x = 330; homeB.z = 330;
    const homeC = {}; homeC.x = 330; homeC.z = -330;
    const homeD = {}; homeD.x = -330; homeD.z = -330;
    const homeE = {}; homeE.x = -412.5; homeE.z = 412.5;
    const homeF = {}; homeF.x = 0; homeF.z = 0;
    const homeG = {}; homeG.x = 250; homeG.z = 420;
    const homeH = {}; homeH.x = -480; homeH.z = -255;
    const homesArr = [homeA, homeB, homeC, homeD, homeE, homeF, homeG, homeH];
    return homesArr;
  };

  const strollHomeList = () => {
    const homesArr = [];
    const strollA = {}; strollA.x = -330; strollA.z = 330; homesArr.push(strollA);
    const strollB = {}; strollB.x = 330; strollB.z = 330; homesArr.push(strollB);
    const strollC = {}; strollC.x = 330; strollC.z = -330; homesArr.push(strollC);
    const strollD = {}; strollD.x = -330; strollD.z = -330; homesArr.push(strollD);
    const strollE = {}; strollE.x = -412.5; strollE.z = 412.5; homesArr.push(strollE);
    const strollF = {}; strollF.x = 0; strollF.z = 0; homesArr.push(strollF);
    const strollG = {}; strollG.x = 250; strollG.z = 420; homesArr.push(strollG);
    const strollH = {}; strollH.x = -480; strollH.z = -255; homesArr.push(strollH);
    return homesArr;
  };

  const attachPhone = (figIn) => {
    try { const handsetGeo = new THREE.BoxGeometry(0.09, 0.16, 0.02);
      const handsetCfg = {};
      handsetCfg.color = 0x111318; handsetCfg.roughness = 0.4; handsetCfg.metalness = 0.4;
      handsetCfg.emissive = 0x2a4a6a; handsetCfg.emissiveIntensity = 0.7;
      const handsetMat = new THREE.MeshStandardMaterial(handsetCfg);
      const handsetNode = new THREE.Mesh(handsetGeo, handsetMat);
      handsetNode.position.x = 0.22;
      handsetNode.position.y = 1.05;
      handsetNode.position.z = 0.22;
      figIn.add(handsetNode);
    } catch (skip) {}
  };

  let spawnIdx = 0;
  for (; WAVE_COUNT > spawnIdx;) {
    const slotIdx = spawnIdx;
    spawnIdx += 1;
    let figIn = null;
    try { figIn = makeFigure(composeLook()); } catch (skip) { continue; }
    const claimedRow = rowForSlot(slotIdx);
    let citizenKeyVal;
    if (claimedRow) citizenKeyVal = claimedRow.key; else citizenKeyVal = null;
    const npc = makePedShell(figIn, slotIdx, citizenKeyVal);
    if (12 > slotIdx) {
      npc.idle = true;
      if (!(slotIdx >= 3)) setInRing(npc, -410, 418, slotIdx, 3);
      else if (!(slotIdx >= 6)) setInRing(npc, 330, -330, slotIdx + -3, 3);
      else if (!(slotIdx >= 9)) setInRing(npc, 182.2, 147.8, slotIdx + -6, 3);
      else { npc.chatGroup = 'market';
        const marketLoc = findMarketPt(gw);
        if (marketLoc) {
          setInRing(npc, marketLoc.x + 13, marketLoc.z + 9, slotIdx + -9, 3);
          npc.marketPlaced = true;
        } else setInRing(npc, -312.8, -147.8, slotIdx + -9, 3);
      }
      if (1 === slotIdx || 4 === slotIdx) attachPhone(figIn);
    } else if (24 > slotIdx) {
      if (0 === slotIdx % 2) {
        const homeSel = pick(pairHomeList());
        setOnPavement(npc, findPavement(gw, homeSel.x, homeSel.z, 0, 190));
      } else { const leaderNpc = gw.peds[gw.peds.length + -1];
        npc.follow = leaderNpc || null;
        if (!leaderNpc) {
          const homePick = pick(pairHomeList());
          setOnPavement(npc, findPavement(gw, homePick.x, homePick.z, 0, 190));
        } else { npc.x = leaderNpc.x + -(Math.sin(leaderNpc.angle) * 2.3) + Math.cos(leaderNpc.angle) * 0.85;
          npc.z = leaderNpc.z + -(Math.cos(leaderNpc.angle) * 2.3) + -(Math.sin(leaderNpc.angle) * 0.85);
          npc.angle = leaderNpc.angle;
          npc.speed = leaderNpc.speed;
        }
      }
    } else if (32 > slotIdx) {
      const cnrOptsX = [];
      cnrOptsX.push(-330); cnrOptsX.push(-165); cnrOptsX.push(0); cnrOptsX.push(165); cnrOptsX.push(330);
      const cnrX = pick(cnrOptsX);
      const cnrOptsZ = [];
      cnrOptsZ.push(-330); cnrOptsZ.push(-165); cnrOptsZ.push(0); cnrOptsZ.push(165); cnrOptsZ.push(330);
      const cnrZ = pick(cnrOptsZ);
      let crossSignX;
      let crossSignZ;
      if (chance(0.5)) crossSignX = 1; else crossSignX = -1;
      if (chance(0.5)) crossSignZ = 1; else crossSignZ = -1;
      setCrossing(npc, cnrX, cnrZ, crossSignX, crossSignZ, true);
    } else { const homeSel = pick(strollHomeList());
      setOnPavement(npc, findPavement(gw, homeSel.x, homeSel.z, 0, 190));
    }
    enableShadows(npc.fig);
    npc.fig.position.set(npc.x, groundH(npc.x, npc.z), npc.z);
    npc.fig.rotation.y = npc.angle;
    gw.scene.add(npc.fig);
    gw.peds.push(npc);
    attachModel(npc);
  }

  const makeBonusPed = () => {
    let figIn = null;
    try { figIn = makeFigure(composeLook()); } catch (skip) { return null; }
    const bonusShell = new THREE.Group();
    bonusShell.add(figIn);
    enableShadows(bonusShell);
    const npc = { fig: bonusShell, visual: figIn, glbInner: null, figIsGlb: false,
      citizenKey: null, idx: gw.peds.length, angle: 0, x: 0, z: 0,
      speed: rr(1.2, 1.8), phase: rr(0, 10), dir: 1, vertical: true,
      line: 0, off: 17.2, idle: false, panicT: 0, sway: rr(0, 6),
      fleeDir: null, startleT: 0, fleeT: 0, chat: false, mode: 'walk',
      follow: null, scattered: false, chatGroup: null, crosser: false,
      cross: null, marketPlaced: false };
    return npc;
  };

  const mountBonusPed = (npc) => {
    if (!npc) return;
    npc.fig.position.set(npc.x, groundH(npc.x, npc.z), npc.z);
    npc.fig.rotation.y = npc.angle;
    gw.scene.add(npc.fig);
    gw.peds.push(npc);
  };

  const setStanding = (npc, standX, standZ, headingVal) => {
    npc.x = standX;
    npc.z = standZ;
    npc.idle = true;
    npc.chat = true;
    npc.chatCx = Math.sin(headingVal) * 3 + standX;
    npc.chatCz = Math.cos(headingVal) * 3 + standZ;
    npc.angle = headingVal;
  };

  const setLaneWalker = (npc, laneOff, loVal, hiVal, dirVal) => {
    npc.vertical = false;
    npc.line = 495;
    npc.off = laneOff;
    npc.x = rr(loVal, hiVal);
    npc.z = laneOff + 495;
    npc.dir = dirVal;
    if (0 < dirVal) npc.angle = Math.PI / 2; else npc.angle = -Math.PI / 2;
    npc.mode = 'walk';
    npc.idle = false;
  };

  const FALLBACK_SPOTS = [];
  {
    const fbA = {}; fbA.stall = false; fbA.ry = 0; fbA.z = 511; fbA.x = 100; FALLBACK_SPOTS.push(fbA);
    const fbB = {}; fbB.stall = false; fbB.ry = 0; fbB.z = 552; fbB.x = 300; FALLBACK_SPOTS.push(fbB);
    const fbC = {}; fbC.stall = false; fbC.ry = 0; fbC.z = -238; fbC.x = -60; FALLBACK_SPOTS.push(fbC);
    const fbD = {}; fbD.stall = false; fbD.ry = 0; fbD.z = 481; fbD.x = -210; FALLBACK_SPOTS.push(fbD);
  }

  let spotList = null;
  try { if (Array.isArray(gw.gatherSpots) && gw.gatherSpots.length) spotList = gw.gatherSpots; } catch (skip) {}
  const activeSpots = spotList || FALLBACK_SPOTS;

  const frameOfSpot = (spotArg) => {
    let yawNow;
    if (Number.isFinite(spotArg.ry)) yawNow = spotArg.ry; else yawNow = 0;
    const frameBasis = { yaw: yawNow, fwdX: Math.sin(yawNow), fwdZ: Math.cos(yawNow),
      sideX: Math.cos(yawNow), sideZ: -Math.sin(yawNow) };
    return frameBasis;
  };

  for (const spotArg of activeSpots) {
    if (!spotArg || !Number.isFinite(spotArg.x) || !Number.isFinite(spotArg.z)) continue;
    const frameBasis = frameOfSpot(spotArg);
    const ringHubX = frameBasis.sideX * 4.5 + spotArg.x;
    const ringHubZ = frameBasis.sideZ * 4.5 + spotArg.z;
    let ringCnt = 0;
    for (; 3 > ringCnt;) {
      const extraNpc = makeBonusPed();
      if (extraNpc) {
        setInRing(extraNpc, ringHubX, ringHubZ, ringCnt, 3);
        mountBonusPed(extraNpc);
      }
      ringCnt += 1;
    }
    for (const sideVal of [-1, 1]) {
      const extraNpc = makeBonusPed();
      if (extraNpc) {
        setStanding(extraNpc,
          spotArg.x + -(frameBasis.fwdX * 3.5) + frameBasis.sideX * sideVal * 2.2,
          spotArg.z + -(frameBasis.fwdZ * 3.5) + frameBasis.sideZ * sideVal * 2.2,
          frameBasis.yaw);
        mountBonusPed(extraNpc);
      }
    }
    if (spotArg.stall) {
      for (const sideVal of [-1, 1]) {
        const extraNpc = makeBonusPed();
        if (extraNpc) {
          setStanding(extraNpc,
            spotArg.x + frameBasis.fwdX * 1.9 + frameBasis.sideX * sideVal * 0.95,
            spotArg.z + frameBasis.fwdZ * 1.9 + frameBasis.sideZ * sideVal * 0.95,
            frameBasis.yaw + Math.PI);
          mountBonusPed(extraNpc);
        }
      }
      const vendorNpc = makeBonusPed();
      if (vendorNpc) {
        setStanding(vendorNpc, spotArg.x + -(frameBasis.fwdX * 1.6), spotArg.z + -(frameBasis.fwdZ * 1.6), frameBasis.yaw);
        mountBonusPed(vendorNpc);
      }
    }
  }

  for (const spotArg of activeSpots) {
    if (!spotArg || !spotArg.stall) continue;
    if (!Number.isFinite(spotArg.x) || !Number.isFinite(spotArg.z)) continue;
    const frameBasis = frameOfSpot(spotArg);
    let queueIdx = 0;
    for (; 2 > queueIdx;) {
      const queueNpc = makeBonusPed();
      if (queueNpc) {
        const backDist = 0.9 * (queueIdx + 1) + 1.9;
        let wobbleVal;
        if (0 === queueIdx) wobbleVal = -0.18; else wobbleVal = 0.22;
        setStanding(queueNpc,
          spotArg.x + frameBasis.fwdX * backDist + frameBasis.sideX * wobbleVal,
          spotArg.z + frameBasis.fwdZ * backDist + frameBasis.sideZ * wobbleVal,
          frameBasis.yaw + Math.PI);
        mountBonusPed(queueNpc);
      }
      queueIdx += 1;
    }
  }

  const LANE_SPECS = [];
  {
    const laneA = {}; laneA.n = 8; laneA.off = -9; laneA.xMax = 560; laneA.xMin = -420; LANE_SPECS.push(laneA);
    const laneB = {}; laneB.n = 7; laneB.off = 10; laneB.xMax = 560; laneB.xMin = -420; LANE_SPECS.push(laneB);
    const laneC = {}; laneC.n = 5; laneC.off = 57; laneC.xMax = 600; laneC.xMin = -380; LANE_SPECS.push(laneC);
  }
  for (const laneSpec of LANE_SPECS) {
    let laneIdx = 0;
    for (; laneSpec.n > laneIdx;) {
      const laneNpc = makeBonusPed();
      if (laneNpc) {
        let laneDir;
        if (0 === laneIdx % 2) laneDir = 1; else laneDir = -1;
        setLaneWalker(laneNpc, laneSpec.off, laneSpec.xMin, laneSpec.xMax, laneDir);
        mountBonusPed(laneNpc);
      }
      laneIdx += 1;
    }
  }

  let martIdx = 0;
  for (; 4 > martIdx;) {
    const martNpc = makeBonusPed();
    if (martNpc) {
      setInRing(martNpc, -79.5, -251, martIdx, 4);
      mountBonusPed(martNpc);
    }
    martIdx += 1;
  }

  let dtIdx = 0;
  for (; 4 > dtIdx;) {
    const dtNpc = makeBonusPed();
    if (dtNpc) {
      setOnPavement(dtNpc, findPavement(gw, 0, 0, 0, 70));
      mountBonusPed(dtNpc);
    }
    dtIdx += 1;
  }

  let dtMoreIdx = 0;
  for (; 4 > dtMoreIdx;) {
    const dtMoreNpc = makeBonusPed();
    if (dtMoreNpc) {
      setOnPavement(dtMoreNpc, findPavement(gw, 0, 0, 0, 70));
      mountBonusPed(dtMoreNpc);
    }
    dtMoreIdx += 1;
  }

  {
    const parkRec = {};
    parkRec.x = 82; parkRec.z = 415; parkRec.stallX = 32 + 82; parkRec.stallZ = 8 + 415;
    let liveParkRec = parkRec;
    try { const liveRec = gw.parkSpot;
      if (liveRec && Number.isFinite(liveRec.x) && Number.isFinite(liveRec.z)) {
        let stallXVal;
        let stallZVal;
        if (Number.isFinite(liveRec.stallX)) stallXVal = liveRec.stallX; else stallXVal = liveRec.x + 32;
        if (Number.isFinite(liveRec.stallZ)) stallZVal = liveRec.stallZ; else stallZVal = liveRec.z + 8;
        liveParkRec = { x: liveRec.x, z: liveRec.z, stallX: stallXVal, stallZ: stallZVal };
      }
    } catch (skip) {}
    const parkHubX = liveParkRec.x;
    const parkHubZ = liveParkRec.z;
    let benchIdx = 0;
    for (; 3 > benchIdx;) {
      const benchNpc = makeBonusPed();
      if (benchNpc) {
        setInRing(benchNpc, parkHubX + 10, parkHubZ + 6, benchIdx, 3);
        mountBonusPed(benchNpc);
      }
      benchIdx += 1;
    }
    let benchMoreIdx = 0;
    for (; 3 > benchMoreIdx;) {
      const benchMoreNpc = makeBonusPed();
      if (benchMoreNpc) {
        setInRing(benchMoreNpc, parkHubX + -10, parkHubZ + -6, benchMoreIdx, 3);
        mountBonusPed(benchMoreNpc);
      }
      benchMoreIdx += 1;
    }
    const parkVendorNpc = makeBonusPed();
    if (parkVendorNpc) {
      setStanding(parkVendorNpc, liveParkRec.stallX + 0.9, liveParkRec.stallZ, -Math.PI / 2);
      mountBonusPed(parkVendorNpc);
    }
    for (const sideVal of [-1, 1]) {
      const custNpc = makeBonusPed();
      if (custNpc) {
        setStanding(custNpc, liveParkRec.stallX + -2.6, sideVal * 0.95 + liveParkRec.stallZ, Math.PI / 2);
        mountBonusPed(custNpc);
      }
    }
    const duoSpecArr = [];
    duoSpecArr.push([16, 0, Math.PI / 2]);
    duoSpecArr.push([0, 16, 0]);
    for (const duoItem of duoSpecArr) {
      const [duoOffX, duoOffZ] = duoItem;
      const duoYaw = duoItem[2];
      for (const sideVal of [-1, 1]) {
        const duoNpc = makeBonusPed();
        if (duoNpc) {
          const splitVal = sideVal * 0.85;
          let addX;
          let addZ;
          let yawAdd;
          if (duoYaw !== 0) addX = splitVal; else addX = 0;
          if (duoYaw === 0) addZ = splitVal; else addZ = 0;
          if (0 < sideVal) yawAdd = Math.PI; else yawAdd = 0;
          setStanding(duoNpc,
            addX + duoOffX + parkHubX,
            addZ + duoOffZ + parkHubZ,
            duoYaw + yawAdd);
          mountBonusPed(duoNpc);
        }
      }
    }
    const walkSpecArr = [];
    walkSpecArr.push([-1.5, -20, 1]);
    walkSpecArr.push([1.5, 18, -1]);
    for (const walkItem of walkSpecArr) {
      const walkerNpc = makeBonusPed();
      const [walkOffX, walkOffZ, walkDirVal] = walkItem;
      if (walkerNpc) {
        walkerNpc.vertical = true;
        walkerNpc.line = parkHubX;
        walkerNpc.off = walkItem[0];
        walkerNpc.x = parkHubX + walkOffX;
        walkerNpc.z = parkHubZ + walkOffZ;
        walkerNpc.dir = walkDirVal;
        if (0 < walkDirVal) walkerNpc.angle = 0; else walkerNpc.angle = Math.PI;
        walkerNpc.mode = 'walk';
        walkerNpc.idle = false;
        mountBonusPed(walkerNpc);
      }
    }
  }

  gw.pedsStartle = (hitPX, hitPZ, radiusArg) => {
    try { if (!Array.isArray(gw.peds)) return;
      if (!Number.isFinite(hitPX) || !Number.isFinite(hitPZ)) return;
      let reachNow;
      if (Number.isFinite(radiusArg) && 0 < radiusArg) reachNow = radiusArg; else reachNow = 12;
      function nearLineFn(coordIn, lineArr) {
        return Array.isArray(lineArr) && lineArr.some(function (lineItem) { return !(Math.abs(coordIn + -lineItem) > 20); });
      }
      for (const npc of gw.peds) {
        if (!npc || npc.downed) continue;
        const awayX = npc.x + -hitPX;
        const awayZ = npc.z + -hitPZ;
        const distNow = Math.hypot(awayX, awayZ);
        if (distNow > reachNow) continue;
        npc.startleT = 0.25;
        const onRoadFlag = nearLineFn(npc.x, gw.roadX) || nearLineFn(npc.z, gw.roadZ);
        const fleeFlag = npc.fleeT > 0 && npc.fleeDir;
        if (!(onRoadFlag || fleeFlag)) continue;
        const denomNow = distNow > 0.001 ? distNow : 1;
        if (distNow > 0.001) {
          const fleeVec = {};
          fleeVec.x = awayX / denomNow; fleeVec.z = awayZ / denomNow;
          npc.fleeDir = fleeVec;
        } else {
          const fleeVec = {};
          fleeVec.x = 1; fleeVec.z = 0;
          npc.fleeDir = fleeVec;
        }
        npc.fleeT = Math.max(npc.fleeT || 0, 0.8);
      }
    } catch (skip) {}
  };

  gw.updaters.push(function (frameIn, stepAmt) {
    let heroX;
    let heroZ;
    if (gw.car) { heroX = gw.car.x; heroZ = gw.car.z; } else { heroX = gw.player.x; heroZ = gw.player.z; }
    const fastCar = Boolean(gw.car && gw.flags.inCar && (gw.speedKmh || 0) > 40);

    const poseFig = (npc, hopVal) => {
      npc.fig.position.set(npc.x, hopVal + groundH(npc.x, npc.z), npc.z);
      npc.fig.rotation.y = npc.angle;
    };

    const advanceNpc = (npc) => {
      const heroDist = Math.hypot(npc.x + -heroX, npc.z + -heroZ);
      let hopVal = 0;
      if (npc.startleT > 0) {
        npc.startleT = npc.startleT + -stepAmt;
        const fracNow = Math.min(1, Math.max(0, 1 + -(npc.startleT / 0.25)));
        hopVal = Math.sin(Math.PI * fracNow) * 0.14;
      }
      if (npc.downed) {
        npc.downedT = (npc.downedT || 0) + -stepAmt;
        if (npc.downedT > 0) return;
        npc.downed = false;
        npc._tipped = false;
        npc.hp = 100;
        try { npc.fig.rotation.set(0, npc.angle, 0); } catch (skip) {}
        setOnPavement(npc, findPavement(gw, heroX, heroZ, 60, 180));
        npc.chat = false;
        npc.idle = false;
        npc.mode = 'walk';
        npc.follow = null;
        npc.scattered = false;
        npc.fig.position.set(npc.x, groundH(npc.x, npc.z), npc.z);
        npc.fig.rotation.y = npc.angle; return;
      }
      if (npc.fleeT > 0 && npc.fleeDir) {
        if (npc.chat) npc.scattered = true;
        npc.fleeT = npc.fleeT + -stepAmt;
        npc.x = npc.fleeDir.x * 3.4 * stepAmt + npc.x;
        npc.z = npc.fleeDir.z * 3.4 * stepAmt + npc.z;
        npc.angle = Math.atan2(npc.fleeDir.x, npc.fleeDir.z);
        npc.phase = 3.4 * stepAmt * 2.4 + npc.phase;
        if (!(npc.figIsGlb && npc.glbInner)) {
          try { animateFigure(npc.visual, npc.phase, 1.6); } catch (skip) {}
        } else { try { bobGlb(npc, 0.06, 0.05, 0.13, npc.phase); } catch (skip) {} }
        poseFig(npc, hopVal); return;
      }
      if (npc.scattered) {
        npc.scattered = false;
        npc.chat = false;
        npc.idle = false;
        rewalkHere(npc);
      }
      if (350 < heroDist && !npc.chat && 'cross' !== npc.mode && !npc.follow) {
        setOnPavement(npc, findPavement(gw, heroX, heroZ, 150, 250));
        npc.idle = false;
      }
      if (npc.idle) {
        npc.sway = npc.sway + stepAmt;
        if (npc.chat) {
          if ('market' === npc.chatGroup && !npc.marketPlaced) {
            const marketLoc = findMarketPt(gw);
            if (marketLoc) {
              setInRing(npc, marketLoc.x + 13, marketLoc.z + 9, npc.idx % 3, 3);
              npc.marketPlaced = true;
            }
          }
          npc.angle = Math.atan2(npc.chatCx + -npc.x, npc.chatCz + -npc.z);
          const talkAmt = 0.5 + 0.5 * Math.sin(npc.idx * 2.1 + npc.sway * 0.33);
          if (!(npc.figIsGlb && npc.glbInner)) {
            try { animateFigure(npc.visual, npc.sway * 0.7, talkAmt * 0.2 + 0.12); } catch (skip) {}
          } else { try {
              npc.glbInner.position.y = (talkAmt * 0.008 + 0.006) * Math.sin(npc.sway * 1.5 + npc.idx);
              npc.glbInner.rotation.z = (talkAmt * 0.014 + 0.01) * Math.sin(npc.sway * 0.9 + npc.idx);
              npc.glbInner.rotation.x = 0;
            } catch (skip) {} }
          npc.fig.position.set(npc.x, hopVal + groundH(npc.x, npc.z), npc.z);
          npc.fig.rotation.y = Math.sin(npc.sway * 0.4) * 0.15 + npc.angle; return;
        }
        if (!(npc.figIsGlb && npc.glbInner)) {
          try { animateFigure(npc.visual, npc.sway * 0.7, 0.12); } catch (skip) {}
        } else { try {
            npc.glbInner.position.y = Math.sin(npc.sway * 1.5 + npc.idx) * 0.006;
            npc.glbInner.rotation.z = Math.sin(npc.sway * 0.9 + npc.idx) * 0.01;
            npc.glbInner.rotation.x = 0;
          } catch (skip) {} }
        npc.fig.position.set(npc.x, hopVal + groundH(npc.x, npc.z), npc.z);
        npc.fig.rotation.y = Math.sin(npc.sway * 0.4) * 0.15 + npc.angle; return;
      }
      if (npc.follow) {
        const leaderNpc = npc.follow;
        if (!leaderNpc || leaderNpc.downed) {
          npc.sway = npc.sway + stepAmt;
          showIdle(npc);
          poseFig(npc, hopVal); return;
        }
        const trailX = leaderNpc.x + -(Math.sin(leaderNpc.angle) * 2.3) + Math.cos(leaderNpc.angle) * 0.85;
        const trailZ = leaderNpc.z + -(Math.cos(leaderNpc.angle) * 2.3) + -(Math.sin(leaderNpc.angle) * 0.85);
        const trailDist = Math.hypot(trailX + -npc.x, trailZ + -npc.z);
        if (25 < trailDist) {
          npc.x = trailX;
          npc.z = trailZ;
        } else { const easeNow = Math.min(1, stepAmt * 4.5);
          npc.x = (trailX + -npc.x) * easeNow + npc.x;
          npc.z = (trailZ + -npc.z) * easeNow + npc.z;
        }
        npc.angle = leaderNpc.angle;
        npc.phase = leaderNpc.phase;
        if (trailDist > 0.25) showWalk(npc, 0.55);
        poseFig(npc, hopVal); return;
      }
      if ('cross' === npc.mode && npc.cross) {
        const routeRec = npc.cross;
        if ('wait' === routeRec.stage) {
          routeRec.waitT = routeRec.waitT + -stepAmt;
          npc.sway = npc.sway + stepAmt;
          showIdle(npc);
          npc.fig.position.set(npc.x, hopVal + groundH(npc.x, npc.z), npc.z);
          npc.fig.rotation.y = Math.sin(npc.sway * 1.7) * 0.55 + routeRec.faceAngle;
          if (!(routeRec.waitT > 0)) {
            routeRec.stage = 'cross';
            routeRec.tx = routeRec.cx + -(routeRec.sx * 17.2);
            routeRec.tz = routeRec.sz * 9 + routeRec.cz;
          }
          return;
        }
        const stepDX = routeRec.tx + -npc.x;
        const stepDZ = routeRec.tz + -npc.z;
        const stepDist = Math.hypot(stepDX, stepDZ);
        let paceMul;
        if ('cross' === routeRec.stage) paceMul = 1.2; else paceMul = 1;
        const paceNow = paceMul * npc.speed;
        if (0.35 > stepDist) {
          if ('toCorner' === routeRec.stage) {
            routeRec.stage = 'toCurb';
            routeRec.tx = routeRec.sx * 17.2 + routeRec.cx;
            routeRec.tz = routeRec.sz * 9 + routeRec.cz;
          } else if ('toCurb' === routeRec.stage) {
            routeRec.stage = 'wait';
            routeRec.waitT = rr(1.4, 3.8);
            npc.sway = rr(0, 6);
          } else if ('cross' === routeRec.stage) {
            routeRec.stage = 'toWalk';
            routeRec.tx = routeRec.cx + -(routeRec.sx * 17.2);
            routeRec.tz = routeRec.sz * 17.2 + routeRec.cz;
          } else { npc.mode = 'walk';
            npc.vertical = true;
            npc.line = routeRec.cx;
            npc.off = -routeRec.sx * 17.2;
            npc.x = npc.off + routeRec.cx;
            if (0 < routeRec.sz) npc.dir = 1; else npc.dir = -1;
            npc.cross = null;
          }
        } else { const moveAmt = Math.min(stepDist, paceNow * stepAmt);
          npc.x = (stepDX / stepDist) * moveAmt + npc.x;
          npc.z = (stepDZ / stepDist) * moveAmt + npc.z;
          npc.angle = Math.atan2(stepDX, stepDZ);
          npc.phase = paceNow * stepAmt * 2.4 + npc.phase;
          showWalk(npc, 0.55);
        }
        poseFig(npc, hopVal); return;
      }
      if (fastCar && 6 > heroDist) npc.panicT = 0.9;
      let paceWalk = npc.speed;
      let sideDrift = 0;
      if (npc.panicT > 0) {
        npc.panicT = npc.panicT + -stepAmt;
        paceWalk = npc.speed * 2.1;
        const awaySign = Math.sign((npc.x + -heroX) * Math.cos(npc.angle) + -((npc.z + -heroZ) * Math.sin(npc.angle))) || 1;
        sideDrift = awaySign * 2.4;
      }
      if (npc.startleT > 0) paceWalk = 0;
      const fwdAmt = paceWalk * npc.dir * stepAmt;
      if (!npc.vertical) {
        npc.x = fwdAmt + npc.x;
        npc.z = npc.line + npc.off + sideDrift * stepAmt * 3;
      } else { npc.z = fwdAmt + npc.z;
        npc.x = npc.line + npc.off + sideDrift * stepAmt * 3;
      }
      npc.phase = paceWalk * stepAmt * 2.4 + npc.phase;
      let crossArr;
      let alongVal;
      if (npc.vertical) { crossArr = gw.roadZ; alongVal = npc.z; } else { crossArr = gw.roadX; alongVal = npc.x; }
      let replannedFlag = false;
      const crossIter = crossArr[Symbol.iterator]();
      let crossStep = crossIter.next();
      while (!crossStep.done) {
        const lineItem = crossStep.value;
        if (npc.crosser && 1.2 > Math.abs(alongVal + -lineItem) && chance(0.30)) {
          if (npc.vertical) setCrossing(npc, npc.line, lineItem, Math.sign(npc.off) || 1, npc.dir);
          else setCrossing(npc, lineItem, npc.line, npc.dir, Math.sign(npc.off) || 1);
          replannedFlag = true; break;
        }
        if (1.2 > Math.abs(alongVal + -lineItem) && chance(0.012)) {
          const prevLine = npc.line;
          const prevOff = npc.off;
          npc.vertical = !npc.vertical;
          npc.line = lineItem;
          let offSign;
          if (chance(0.5)) offSign = -1; else offSign = 1;
          npc.off = offSign * 17.2;
          if (chance(0.5)) npc.dir = 1; else npc.dir = -1;
          if (!npc.vertical) {
            npc.z = npc.off + npc.line;
            npc.x = prevOff + prevLine;
          } else { npc.x = npc.off + npc.line;
            npc.z = prevOff + prevLine;
          } break;
        }
        crossStep = crossIter.next();
      }
      if (replannedFlag) {
        poseFig(npc, hopVal); return;
      }
      if (npc.x > 640 || -640 > npc.x || npc.z > 640 || -640 > npc.z) {
        npc.dir = -1 * npc.dir;
        npc.x = THREE.MathUtils.clamp(npc.x, -638, 638);
        npc.z = THREE.MathUtils.clamp(npc.z, -638, 638);
      }
      let vertAng;
      let horizAng;
      if (0 < npc.dir) vertAng = 0; else vertAng = Math.PI;
      if (0 < npc.dir) horizAng = Math.PI / 2; else horizAng = -Math.PI / 2;
      if (npc.vertical) npc.angle = vertAng; else npc.angle = horizAng;
      if (!gw.flags.inCar && heroDist > 0.001 && 1.1 > heroDist) {
        const pushNow = (1.1 + -heroDist) * 2.2 * stepAmt;
        npc.x = (npc.x + -heroX) / heroDist * pushNow + npc.x;
        npc.z = (npc.z + -heroZ) / heroDist * pushNow + npc.z;
      }
      if (!(npc.figIsGlb && npc.glbInner)) {
        let walkAmt;
        if (npc.panicT > 0) walkAmt = 1.6; else walkAmt = 0.55;
        try { animateFigure(npc.visual, npc.phase, walkAmt); } catch (skip) {}
      } else { try {
          const panicNow = npc.panicT > 0;
          let bobNow = Math.abs(Math.sin(npc.phase)) * 0.04;
          if (panicNow) bobNow = Math.abs(Math.sin(npc.phase * 1.7)) * 0.06 + bobNow;
          npc.glbInner.position.y = bobNow;
          let swayNow;
          let leanNow;
          if (panicNow) { swayNow = 0.05; leanNow = 0.10; } else { swayNow = 0.04; leanNow = 0.05; }
          npc.glbInner.rotation.z = swayNow * Math.sin(npc.phase);
          npc.glbInner.rotation.x = leanNow;
        } catch (skip) {} }
      poseFig(npc, hopVal);
    };

    for (const npc of gw.peds) advanceNpc(npc);
  });
};
