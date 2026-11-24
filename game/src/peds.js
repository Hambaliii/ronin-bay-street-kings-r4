import * as THREE from 'three';
import { chance, pick, ri, rr } from './random.js';
import { groundH } from './world.js';
import { animateFigure, makeFigure } from './player.js';
import { loadHeroAsset } from './assets.js';
// Ronin Bay crowd logic sits in this module: the first wave of
// walkers, the standing chat rings, the kerb crossers, the later
// top-up figures around busy spots, and the horn startle.
const SKIN_SHADES = [0xf0c8a0, 0xe8b48c, 0xc98d64, 0xb97a4e, 0x8a5a34];
const HAIR_STYLES = ['black topknot', 'red ponytail', 'violet bob', 'buzz', 'silver undercut', 'slick black', 'cap', 'long', 'bun'];
const HAIR_SHADES = [0x14100e, 0x8c2f1d, 0x6a3fa0, 0x2a2a2e, 0xc9ccd4, 0x1a1512, 0x24406e, 0x3a2415, 0x101010];
const TOP_STYLES = ['tank', 'hoodie', 'jacket'];
const TOP_SHADES = [0xff5c39, 0x2e6fb7, 0x37b268, 0xf2c230, 0xe879ff, 0xeeeeee, 0x22242a, 0xff8ab0, 0x57b7ff, 0x8a5a34, 0xffb7d5, 0xa8e6cf, 0xfff0b3];
const LEG_SHADES = [0x2c3e57, 0x3a3f47, 0x5b4632, 0x243024, 0x6e7f52, 0x39424e];
// Model backed citizens draw spawn slots out of the table below,
// and one residue class is intentionally left unclaimed.
const MODEL_YAW = 0;
const MODEL_ROWS = [
  { offset: 0, every: 5, key: 'citizenWoman' },
  { offset: 1, every: 5, key: 'citizenTeen2' },
  { offset: 2, every: 5, key: 'citizenOffice' },
  { offset: 3, every: 5, key: 'citizenTeen' },
];
// Teen copies get one flat colour; textured rows never do.
const TEEN_COLORS = [0x3f8f7a, 0xc96f3f, 0xd9b23f, 0x5a6d8a, 0x7a9a4f, 0x8a4f7d, 0x9aa0a8, 0x4f6db8];
function shapeHasXZ(probeShape) {
  const xOk = probeShape && Number.isFinite(probeShape.x);
  const zOk = probeShape && Number.isFinite(probeShape.z);
  if (xOk && zOk) return { x: probeShape.x, z: probeShape.z };
  return undefined;
}
function rowForSpawn(spawnIdx) {
  const finiteFlag = Number.isFinite(spawnIdx);
  if (!finiteFlag) return null;
  let hitRow = null;
  let scanIdx = 0;
  while (!hitRow && (MODEL_ROWS.length > scanIdx)) {
    const rowEntry = MODEL_ROWS[scanIdx];
    scanIdx = (1 + scanIdx);
    const offVal = ((rowEntry || {}).offset || 0);
    const rowClaims = rowEntry && (rowEntry.every > 0) && (offVal === (spawnIdx % rowEntry.every));
    if (rowClaims) hitRow = rowEntry;
  }
  return hitRow;
}
function rollLook() {
  const hairIdx = ri(0, HAIR_STYLES.length - 1);
  const hairDuo = [HAIR_STYLES[hairIdx], HAIR_SHADES[hairIdx]];
  const clothes = {
    top: pick(TOP_STYLES),
    topColor: pick(TOP_SHADES),
    trim: pick(TOP_SHADES),
    pants: chance(0.6) ? 'jeans' : 'cargo',
    pantsColor: pick(LEG_SHADES),
    shoes: pick([0xffffff, 0x222222, 0xd23b3b, 0x2e6fb7]),
  };
  const lookRec = {
    name: 'Pedestrian',
    skin: pick(SKIN_SHADES),
    hair: hairDuo[0],
    hairColor: hairDuo[1],
    h: rr(0.9, 1.03),
    build: rr(0.38, 0.7),
    outfit: clothes,
  };
  return lookRec;
}
function scoreCandidate(gmRef, fromX, fromZ, isVert, lineCoord, offVal, alongCoord) {
  const candOut = {};
  candOut.vertical = isVert;
  candOut.line = lineCoord;
  candOut.off = offVal;
  candOut.x = isVert ? (offVal + lineCoord) : alongCoord;
  candOut.z = isVert ? alongCoord : (offVal + lineCoord);
  const dxVal = candOut.x - fromX;
  const dzVal = candOut.z - fromZ;
  candOut.dist = Math.hypot(dxVal, dzVal);
  return candOut;
}
function findPavementSpot(gmRef, fromX, fromZ, nearCap, farCap) {
  let attemptsLeft = 24;
  while (attemptsLeft > 0) {
    attemptsLeft = (attemptsLeft - 1);
    const isVert = chance(0.5);
    const lineCoord = isVert ? pick(gmRef.roadX) : pick(gmRef.roadZ);
    const offVal = ((chance(0.5) ? 1 : -1) * -17.2);
    const candOut = scoreCandidate(gmRef, fromX, fromZ, isVert, lineCoord, offVal, rr(-640, 640));
    const inBand = (!(nearCap > candOut.dist)) && (!(candOut.dist > farCap));
    if (inBand) {
      const spotOut = {};
      spotOut.vertical = candOut.vertical;
      spotOut.line = candOut.line;
      spotOut.off = candOut.off;
      spotOut.x = candOut.x;
      spotOut.z = candOut.z;
      return spotOut;
    }
  }
  const fbLine = pick(gmRef.roadX);
  const fbSpot = { vertical: true, line: fbLine, off: 17.2 };
  fbSpot.x = (fbLine + 17.2);
  fbSpot.z = rr(-300, 300);
  return fbSpot;
}
// Landmark payloads show up wrapped in several shapes, so this
// probe walks every plausible carrier without trusting any.
function probeLandmark(markIn) {
  try {
    if (!markIn) return null;
    const carriers = [markIn, markIn.pos, markIn.position, markIn.at];
    let carrierIdx = 0;
    while (carriers.length > carrierIdx) {
      const carrierItem = carriers[carrierIdx];
      carrierIdx = (carrierIdx + 1);
      const hitRec = shapeHasXZ(carrierItem);
      if (undefined !== hitRec) return hitRec;
    }
  } catch (swallowed) {}
  return null;
}
function findMarket(gmRef) {
  let foundPt = null;
  try {
    const marketRec = gmRef.landmarks && gmRef.landmarks.market;
    if (marketRec) foundPt = probeLandmark(marketRec);
  } catch (swallowed) {}
  return foundPt;
}
export function initPeds(gameState) {
  gameState.peds = [];
  const WAVE_COUNT = 44;
  const modelCache = {};
  function tintTeenClone(rootIn, paintIn) {
    rootIn.traverse((meshNode) => {
      const paintable = meshNode && meshNode.isMesh && meshNode.material && meshNode.material.color;
      if (paintable) {
        meshNode.material = meshNode.material.clone();
        meshNode.material.color.setHex(paintIn);
      }
    });
  }
  function shadowize(rootIn) {
    rootIn.traverse((meshNode) => { if (meshNode && meshNode.isMesh) meshNode.castShadow = true; });
  }
  function adoptModel(walker) {
    try {
      if (!walker || walker.figIsGlb || !walker.citizenKey) return;
      const tplIn = modelCache[walker.citizenKey];
      if (!tplIn) return;
      const wrapNode = new THREE.Group();
      wrapNode.rotation.y = MODEL_YAW;
      const cloneNode = tplIn.clone(true);
      if (walker.citizenKey === 'citizenTeen') {
        const paintSel = TEEN_COLORS[walker.idx % TEEN_COLORS.length];
        tintTeenClone(cloneNode, paintSel);
      }
      shadowize(wrapNode);
      wrapNode.add(cloneNode);
      if (walker.visual) walker.fig.remove(walker.visual);
      walker.fig.add(wrapNode);
      walker.visual = wrapNode;
      walker.glbInner = wrapNode;
      walker.figIsGlb = true;
    } catch (swallowed) {}
  }
  MODEL_ROWS.forEach((rowEntry) => {
    try {
      const loadJob = loadHeroAsset(rowEntry.key);
      if (loadJob && ('function' === typeof loadJob.then)) {
        loadJob.then((tplIn) => {
          try {
            if (!tplIn) return;
            modelCache[rowEntry.key] = tplIn;
            gameState.peds.forEach((walker) => adoptModel(walker));
          } catch (swallowed) {}
        }).catch(() => {});
      }
    } catch (swallowed) {}
  });
  function dropOnPavement(walker, spotIn) {
    walker.x = spotIn.x;
    walker.z = spotIn.z;
    walker.vertical = spotIn.vertical;
    walker.line = spotIn.line;
    walker.off = spotIn.off;
    walker.dir = chance(0.5) ? 1 : -1;
    const dirIsPos = (walker.dir > 0);
    walker.angle = walker.vertical ? (dirIsPos ? 0 : Math.PI) : (dirIsPos ? Math.PI / 2 : -Math.PI / 2);
  }
  function ringTheta(slotIdx, ringTotal) {
    const jitterAmt = rr(-0.25, 0.25);
    const sweepAmt = (slotIdx / ringTotal) * Math.PI * 2;
    return (sweepAmt + jitterAmt);
  }
  function dropInRing(walker, hubX, hubZ, slotIdx, ringTotal) {
    const thetaAmt = ringTheta(slotIdx, ringTotal);
    walker.x = hubX + (Math.sin(thetaAmt) * 1.25);
    walker.z = hubZ + (Math.cos(thetaAmt) * 1.25);
    walker.chatCx = hubX;
    walker.chatCz = hubZ;
    walker.chat = true;
    walker.idle = true;
    walker.angle = Math.atan2(hubX - walker.x, hubZ - walker.z);
  }
  function planCrossing(walker, cornerX, cornerZ, signX, signZ, snapIt) {
    walker.mode = 'cross';
    walker.crosser = true;
    const kerbX = cornerX + (signX * 17.2);
    const kerbZ = cornerZ + (signZ * 17.2);
    if (snapIt) { walker.x = kerbX; walker.z = kerbZ; }
    const farAway = (Math.hypot(kerbX - walker.x, kerbZ - walker.z) > 2);
    const crossPlan = {
      stage: farAway ? 'toCorner' : 'toCurb',
      cx: cornerX,
      cz: cornerZ,
      sx: signX,
      sz: signZ,
      waitT: 0,
      tx: farAway ? kerbX : (cornerX + (signX * 17.2)),
      tz: farAway ? kerbZ : (cornerZ + (signZ * 9)),
      faceAngle: Math.atan2(-signX, 0),
    };
    walker.cross = crossPlan;
    walker.angle = Math.atan2(crossPlan.tx - walker.x, crossPlan.tz - walker.z);
  }
  function rebuildWalkHere(walker) {
    let bestLine = gameState.roadX[0];
    let bestGap = Infinity;
    gameState.roadX.forEach((lineCoord) => {
      const gapVal = Math.abs(walker.x - lineCoord);
      if (bestGap > gapVal) { bestGap = gapVal; bestLine = lineCoord; }
    });
    walker.vertical = true;
    walker.line = bestLine;
    walker.off = THREE.MathUtils.clamp(walker.x - bestLine, -17.2, 17.2);
    if (13 > Math.abs(walker.off)) walker.off = (17.2 * ((walker.off < 0) ? -1 : 1));
    walker.x = (walker.off + bestLine);
    walker.dir = chance(0.5) ? 1 : -1;
    walker.mode = 'walk';
  }
  function modelBob(walker, bobVal, swayVal, leanVal, phaseVal) {
    walker.glbInner.position.y = Math.abs(Math.sin(phaseVal)) * bobVal;
    walker.glbInner.rotation.z = Math.sin(phaseVal) * swayVal;
    walker.glbInner.rotation.x = leanVal;
  }
  function walkVisual(walker, amtIn) {
    const usesModel = Boolean(walker.figIsGlb && walker.glbInner);
    if (!usesModel) { try { animateFigure(walker.visual, walker.phase, amtIn); } catch (swallowed) {} return; }
    try { modelBob(walker, (0.04 * (amtIn + amtIn)), 0.04, 0.05, walker.phase); } catch (swallowed) {}
  }
  function idleVisual(walker) {
    const usesModel = Boolean(walker.figIsGlb && walker.glbInner);
    if (!usesModel) { try { animateFigure(walker.visual, walker.sway * 0.7, 0.12); } catch (swallowed) {} return; }
    try {
      walker.glbInner.position.y = Math.sin((walker.sway * 1.5) + walker.idx) * 0.006;
      walker.glbInner.rotation.z = Math.sin((walker.sway * 0.9) + walker.idx) * 0.01;
      walker.glbInner.rotation.x = 0;
    } catch (swallowed) {}
  }
  function fillWalkerDefaults(walker, figureNode, idxVal, keyIn) {
    walker.fig = null;
    walker.visual = figureNode;
    walker.glbInner = null;
    walker.figIsGlb = false;
    walker.citizenKey = keyIn;
    walker.idx = idxVal;
    walker.angle = 0;
    walker.x = 0;
    walker.z = 0;
    walker.speed = rr(1.2, 1.8);
    walker.phase = rr(0, 10);
    walker.dir = 1;
    walker.vertical = true;
    walker.line = 0;
    walker.off = 17.2;
    walker.idle = false;
    walker.panicT = 0;
    walker.sway = rr(0, 6);
    walker.fleeDir = null;
    walker.startleT = 0;
    walker.fleeT = 0;
    walker.chat = false;
    walker.mode = 'walk';
    walker.follow = null;
    walker.scattered = false;
    walker.chatGroup = null;
    walker.crosser = false;
    walker.cross = null;
    walker.marketPlaced = false;
    return walker;
  }
  function freshWalkerShell(figureNode, idxVal, keyIn) {
    const shellNode = new THREE.Group();
    shellNode.add(figureNode);
    const walker = fillWalkerDefaults({}, figureNode, idxVal, keyIn);
    walker.fig = shellNode;
    return walker;
  }
  function pairHomes() {
    const homesOut = [];
    homesOut.push({ x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 }, { x: -330, z: -330 });
    homesOut.push({ x: -412.5, z: 412.5 }, { x: 0, z: 0 }, { x: 250, z: 420 }, { x: -480, z: -255 });
    return homesOut;
  }
  function strollHomes() {
    return [
      { x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 }, { x: -330, z: -330 },
      { x: -412.5, z: 412.5 }, { x: 0, z: 0 }, { x: 250, z: 420 }, { x: -480, z: -255 },
    ];
  }
  function attachPhone(figureIn) {
    try {
      const phoneNode = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.16, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.4, emissive: 0x2a4a6a, emissiveIntensity: 0.7 })
      );
      phoneNode.position.set(0.22, 1.05, 0.22);
      figureIn.add(phoneNode);
    } catch (swallowed) {}
  }
  let spawnIdx = 0;
  while (WAVE_COUNT > spawnIdx) {
    const idxVal = spawnIdx;
    spawnIdx = (1 + spawnIdx);
    let figureNode = null;
    try { figureNode = makeFigure(rollLook()); } catch (swallowed) { continue; }
    const claimedModel = rowForSpawn(idxVal);
    const walker = freshWalkerShell(figureNode, idxVal, claimedModel ? claimedModel.key : null);
    if (12 > idxVal) {
      walker.idle = true;
      if (3 > idxVal) dropInRing(walker, -410, 418, idxVal, 3);
      else if (6 > idxVal) dropInRing(walker, 330, -330, idxVal + -3, 3);
      else if (9 > idxVal) dropInRing(walker, 182.2, 147.8, idxVal + -6, 3);
      else {
        walker.chatGroup = 'market';
        const marketPt = findMarket(gameState);
        if (marketPt) { dropInRing(walker, marketPt.x + 13, marketPt.z + 9, idxVal + -9, 3); walker.marketPlaced = true; }
        else dropInRing(walker, -312.8, -147.8, idxVal + -9, 3);
      }
      if ((idxVal === 1) || (idxVal === 4)) attachPhone(figureNode);
    } else if (24 > idxVal) {
      if (0 === (idxVal % 2)) {
        const homeSel = pick(pairHomes());
        dropOnPavement(walker, findPavementSpot(gameState, homeSel.x, homeSel.z, 0, 190));
      } else {
        const leaderWalker = gameState.peds[gameState.peds.length - 1];
        walker.follow = leaderWalker || null;
        if (!leaderWalker) {
          const homeSel = pick(pairHomes());
          dropOnPavement(walker, findPavementSpot(gameState, homeSel.x, homeSel.z, 0, 190));
        } else {
          walker.x = ((leaderWalker.x - (Math.sin(leaderWalker.angle) * 2.3)) + (Math.cos(leaderWalker.angle) * 0.85));
          walker.z = ((leaderWalker.z - (Math.cos(leaderWalker.angle) * 2.3)) - (Math.sin(leaderWalker.angle) * 0.85));
          walker.angle = leaderWalker.angle;
          walker.speed = leaderWalker.speed;
        }
      }
    } else if (32 > idxVal) {
      const cornerX = pick([-330, -165, 0, 165, 330]);
      const cornerZ = pick([-330, -165, 0, 165, 330]);
      planCrossing(walker, cornerX, cornerZ, chance(0.5) ? 1 : -1, chance(0.5) ? 1 : -1, true);
    } else {
      const homeSel = pick(strollHomes());
      dropOnPavement(walker, findPavementSpot(gameState, homeSel.x, homeSel.z, 0, 190));
    }
    shadowize(walker.fig);
    walker.fig.position.set(walker.x, groundH(walker.x, walker.z), walker.z);
    walker.fig.rotation.y = walker.angle;
    gameState.scene.add(walker.fig);
    gameState.peds.push(walker);
    adoptModel(walker);
  }
  // The extra figures below stay procedural, never model backed.
  function spawnBonusPed() {
    let figureNode = null;
    try { figureNode = makeFigure(rollLook()); } catch (swallowed) { return null; }
    const shellNode = new THREE.Group();
    shellNode.add(figureNode);
    shadowize(shellNode);
    const walker = {};
    walker.fig = shellNode;
    walker.visual = figureNode;
    walker.glbInner = null;
    walker.figIsGlb = false;
    walker.citizenKey = null;
    walker.idx = gameState.peds.length;
    walker.angle = 0;
    walker.x = 0;
    walker.z = 0;
    walker.speed = rr(1.2, 1.8);
    walker.phase = rr(0, 10);
    walker.dir = 1;
    walker.vertical = true;
    walker.line = 0;
    walker.off = 17.2;
    walker.idle = false;
    walker.panicT = 0;
    walker.sway = rr(0, 6);
    walker.fleeDir = null;
    walker.startleT = 0;
    walker.fleeT = 0;
    walker.chat = false;
    walker.mode = 'walk';
    walker.follow = null;
    walker.scattered = false;
    walker.chatGroup = null;
    walker.crosser = false;
    walker.cross = null;
    walker.marketPlaced = false;
    return walker;
  }
  function finishBonusPed(walker) {
    if (!walker) return;
    walker.fig.position.set(walker.x, groundH(walker.x, walker.z), walker.z);
    walker.fig.rotation.y = walker.angle;
    gameState.scene.add(walker.fig);
    gameState.peds.push(walker);
  }
  function dropStanding(walker, standX, standZ, headingIn) {
    walker.x = standX;
    walker.z = standZ;
    walker.idle = true;
    walker.chat = true;
    walker.chatCx = standX + (Math.sin(headingIn) * 3);
    walker.chatCz = standZ + (Math.cos(headingIn) * 3);
    walker.angle = headingIn;
  }
  function dropLaneWalker(walker, laneOffIn, loIn, hiIn, dirIn) {
    walker.vertical = false;
    walker.line = 495;
    walker.off = laneOffIn;
    walker.x = rr(loIn, hiIn);
    walker.z = (laneOffIn + 495);
    walker.dir = dirIn;
    walker.angle = (dirIn > 0) ? Math.PI / 2 : -Math.PI / 2;
    walker.mode = 'walk';
    walker.idle = false;
  }
  const FALLBACK_SPOTS = [
    { x: 100, z: 511, ry: 0, stall: false }, { x: 300, z: 552, ry: 0, stall: false },
    { x: -60, z: -238, ry: 0, stall: false }, { x: -210, z: 481, ry: 0, stall: false },
  ];
  let gatheredList = null;
  try {
    const gsUsable = Array.isArray(gameState.gatherSpots) && gameState.gatherSpots.length;
    if (gsUsable) gatheredList = gameState.gatherSpots;
  } catch (swallowed) {}
  const activeSpots = gatheredList || FALLBACK_SPOTS;
  function spotFrame(spotIn) {
    const yawVal = Number.isFinite(spotIn.ry) ? spotIn.ry : 0;
    const frameOut = { yaw: yawVal, fwdX: Math.sin(yawVal), fwdZ: Math.cos(yawVal) };
    frameOut.sideX = Math.cos(yawVal);
    frameOut.sideZ = -Math.sin(yawVal);
    return frameOut;
  }
  activeSpots.forEach((spotIn) => {
    if (!spotIn || !Number.isFinite(spotIn.x) || !Number.isFinite(spotIn.z)) return;
    const frameOut = spotFrame(spotIn);
    const ringHubX = spotIn.x + (frameOut.sideX * 4.5);
    const ringHubZ = spotIn.z + (frameOut.sideZ * 4.5);
    let ringIdx = 0;
    while (3 > ringIdx) {
      const bonusWalker = spawnBonusPed();
      if (bonusWalker) { dropInRing(bonusWalker, ringHubX, ringHubZ, ringIdx, 3); finishBonusPed(bonusWalker); }
      ringIdx = (1 + ringIdx);
    }
    [-1, 1].forEach(function (sideAmt) {
      const bonusWalker = spawnBonusPed();
      if (bonusWalker) {
        dropStanding(bonusWalker, (spotIn.x - (frameOut.fwdX * 3.5)) + (frameOut.sideX * sideAmt * 2.2), (spotIn.z - (frameOut.fwdZ * 3.5)) + (frameOut.sideZ * sideAmt * 2.2), frameOut.yaw);
        finishBonusPed(bonusWalker);
      }
    });
    if (spotIn.stall) {
      [-1, 1].forEach(function (sideAmt) {
        const bonusWalker = spawnBonusPed();
        if (bonusWalker) {
          dropStanding(bonusWalker, (spotIn.x + (frameOut.fwdX * 1.9)) + (frameOut.sideX * sideAmt * 0.95), (spotIn.z + (frameOut.fwdZ * 1.9)) + (frameOut.sideZ * sideAmt * 0.95), frameOut.yaw + Math.PI);
          finishBonusPed(bonusWalker);
        }
      });
      const vendorWalker = spawnBonusPed();
      if (vendorWalker) { dropStanding(vendorWalker, spotIn.x - (frameOut.fwdX * 1.6), spotIn.z - (frameOut.fwdZ * 1.6), frameOut.yaw); finishBonusPed(vendorWalker); }
    }
  });
  activeSpots.forEach((spotIn) => {
    if (!spotIn || !spotIn.stall) return;
    if (!Number.isFinite(spotIn.x) || !Number.isFinite(spotIn.z)) return;
    const frameOut = spotFrame(spotIn);
    let queueIdx = 0;
    while (2 > queueIdx) {
      const queuedWalker = spawnBonusPed();
      if (queuedWalker) {
        const backStep = (1.9 + (0.9 * (queueIdx + 1)));
        const wobbleVal = (0 === queueIdx) ? -0.18 : 0.22;
        dropStanding(queuedWalker, (spotIn.x + (frameOut.fwdX * backStep)) + (frameOut.sideX * wobbleVal), (spotIn.z + (frameOut.fwdZ * backStep)) + (frameOut.sideZ * wobbleVal), frameOut.yaw + Math.PI);
        finishBonusPed(queuedWalker);
      }
      queueIdx = (1 + queueIdx);
    }
  });
  const LANE_TABLE = [
    { off: -9, n: 8, xMin: -420, xMax: 560 }, { off: 10, n: 7, xMin: -420, xMax: 560 },
    { off: 57, n: 5, xMin: -380, xMax: 600 },
  ];
  LANE_TABLE.forEach((laneRow) => {
    let laneIdx = 0;
    while (laneRow.n > laneIdx) {
      const laneWalker = spawnBonusPed();
      if (laneWalker) { dropLaneWalker(laneWalker, laneRow.off, laneRow.xMin, laneRow.xMax, (0 === (laneIdx % 2)) ? 1 : -1); finishBonusPed(laneWalker); }
      laneIdx = (1 + laneIdx);
    }
  });
  {
    let martIdx = 0;
    while (4 > martIdx) {
      const martWalker = spawnBonusPed();
      if (martWalker) { dropInRing(martWalker, -79.5, -251, martIdx, 4); finishBonusPed(martWalker); }
      martIdx = (1 + martIdx);
    }
  }
  {
    let dtIdx = 0;
    while (4 > dtIdx) {
      const dtWalker = spawnBonusPed();
      if (dtWalker) { dropOnPavement(dtWalker, findPavementSpot(gameState, 0, 0, 0, 70)); finishBonusPed(dtWalker); }
      dtIdx = (1 + dtIdx);
    }
  }
  {
    let dtMoreIdx = 0;
    while (4 > dtMoreIdx) {
      const dtMoreWalker = spawnBonusPed();
      if (dtMoreWalker) { dropOnPavement(dtMoreWalker, findPavementSpot(gameState, 0, 0, 0, 70)); finishBonusPed(dtMoreWalker); }
      dtMoreIdx = (1 + dtMoreIdx);
    }
  }
  // Gathering block anchored on the park spot.
  {
    let parkSpotRec = { x: 82, z: 415, stallX: (32 + 82), stallZ: (8 + 415) };
    try {
      const liveParkSpot = gameState.parkSpot;
      if (liveParkSpot && Number.isFinite(liveParkSpot.x) && Number.isFinite(liveParkSpot.z)) {
        const rebuiltSpot = {};
        rebuiltSpot.x = liveParkSpot.x;
        rebuiltSpot.z = liveParkSpot.z;
        rebuiltSpot.stallX = Number.isFinite(liveParkSpot.stallX) ? liveParkSpot.stallX : (32 + liveParkSpot.x);
        rebuiltSpot.stallZ = Number.isFinite(liveParkSpot.stallZ) ? liveParkSpot.stallZ : (8 + liveParkSpot.z);
        parkSpotRec = rebuiltSpot;
      }
    } catch (swallowed) {}
    const parkHubX = parkSpotRec.x;
    const parkHubZ = parkSpotRec.z;
    {
      let benchIdx = 0;
      while (3 > benchIdx) {
        const benchWalker = spawnBonusPed();
        if (benchWalker) { dropInRing(benchWalker, parkHubX + 10, parkHubZ + 6, benchIdx, 3); finishBonusPed(benchWalker); }
        benchIdx = (1 + benchIdx);
      }
    }
    {
      let benchMoreIdx = 0;
      while (3 > benchMoreIdx) {
        const benchMoreWalker = spawnBonusPed();
        if (benchMoreWalker) { dropInRing(benchMoreWalker, parkHubX - 10, parkHubZ - 6, benchMoreIdx, 3); finishBonusPed(benchMoreWalker); }
        benchMoreIdx = (1 + benchMoreIdx);
      }
    }
    const parkVendor = spawnBonusPed();
    if (parkVendor) { dropStanding(parkVendor, parkSpotRec.stallX + 0.9, parkSpotRec.stallZ, -Math.PI / 2); finishBonusPed(parkVendor); }
    [-1, 1].forEach(function (sideAmt) {
      const custWalker = spawnBonusPed();
      if (custWalker) { dropStanding(custWalker, parkSpotRec.stallX - 2.6, parkSpotRec.stallZ + (sideAmt * 0.95), Math.PI / 2); finishBonusPed(custWalker); }
    });
    const duoSpecs = [[16, 0, Math.PI / 2], [0, 16, 0]];
    duoSpecs.forEach((duoSpec) => {
      const [duoDx, duoDz] = duoSpec;
      const duoFacing = duoSpec[2];
      [-1, 1].forEach(function (sideAmt) {
        const duoWalker = spawnBonusPed();
        if (duoWalker) {
          const splitVal = (sideAmt * 0.85);
          dropStanding(duoWalker, (parkHubX + duoDx) + ((0 !== duoFacing) ? splitVal : 0), (parkHubZ + duoDz) + ((0 === duoFacing) ? splitVal : 0), duoFacing + ((sideAmt > 0) ? Math.PI : 0));
          finishBonusPed(duoWalker);
        }
      });
    });
    const walkSpecs = [[-1.5, -20, 1], [1.5, 18, -1]];
    walkSpecs.forEach((walkSpec) => {
      const strollerWalker = spawnBonusPed();
      const [walkOff, walkDz, walkDir] = walkSpec;
      if (strollerWalker) {
        strollerWalker.vertical = true;
        strollerWalker.line = parkHubX;
        strollerWalker.off = walkSpec[0];
        strollerWalker.x = parkHubX + walkOff;
        strollerWalker.z = parkHubZ + walkDz;
        strollerWalker.dir = walkDir;
        strollerWalker.angle = (walkDir > 0) ? 0 : Math.PI;
        strollerWalker.mode = 'walk';
        strollerWalker.idle = false;
        finishBonusPed(strollerWalker);
      }
    });
  }
  // Horn startle and stepping clear of the road, best effort.
  gameState.pedsStartle = function pedsStartle(hitX, hitZ, radiusIn) {
    try {
      if (!Array.isArray(gameState.peds) || !Number.isFinite(hitX) || !Number.isFinite(hitZ)) return;
      const reachVal = (Number.isFinite(radiusIn) && (radiusIn > 0)) ? radiusIn : 12;
      const nearAnyLine = (coordIn, linesIn) => Array.isArray(linesIn) && linesIn.some((lineCoord) => !(Math.abs(coordIn - lineCoord) > 20));
      gameState.peds.forEach((walker) => {
        if (!walker || walker.downed) return;
        const awayXVal = walker.x - hitX;
        const awayZVal = walker.z - hitZ;
        const distVal = Math.hypot(awayXVal, awayZVal);
        if (distVal > reachVal) return;
        walker.startleT = 0.25;
        const roadNear = nearAnyLine(walker.x, gameState.roadX) || nearAnyLine(walker.z, gameState.roadZ);
        if (roadNear || ((walker.fleeT > 0) && walker.fleeDir)) {
          const denomVal = (distVal > 0.001) ? distVal : 1;
          walker.fleeDir = (distVal > 0.001) ? { x: awayXVal / denomVal, z: awayZVal / denomVal } : { x: 1, z: 0 };
          walker.fleeT = Math.max(walker.fleeT || 0, 0.8);
        }
      });
    } catch (swallowed) {}
  };
  gameState.updaters.push((frameState, dtStep) => {
    const heroXVal = gameState.car ? gameState.car.x : gameState.player.x;
    const heroZVal = gameState.car ? gameState.car.z : gameState.player.z;
    const fastCar = gameState.car && gameState.flags.inCar && ((gameState.speedKmh || 0) > 40);
    function placeFigure(walker, hopIn) {
      walker.fig.position.set(walker.x, groundH(walker.x, walker.z) + hopIn, walker.z);
      walker.fig.rotation.y = walker.angle;
    }
    gameState.peds.forEach((walker) => {
      const heroGap = Math.hypot(walker.x - heroXVal, walker.z - heroZVal);
      let hopVal = 0;
      if (walker.startleT > 0) {
        walker.startleT = (walker.startleT - dtStep);
        const fracDone = Math.min(1, Math.max(0, 1 - (walker.startleT / 0.25)));
        hopVal = Math.sin(fracDone * Math.PI) * 0.14;
      }
      if (walker.downed) {
        walker.downedT = ((walker.downedT || 0) - dtStep);
        if (!(walker.downedT > 0)) {
          walker.downed = false;
          walker._tipped = false;
          walker.hp = 100;
          try { walker.fig.rotation.set(0, walker.angle, 0); } catch (swallowed) {}
          dropOnPavement(walker, findPavementSpot(gameState, heroXVal, heroZVal, 60, 180));
          walker.chat = false;
          walker.idle = false;
          walker.mode = 'walk';
          walker.follow = null;
          walker.scattered = false;
          walker.fig.position.set(walker.x, groundH(walker.x, walker.z), walker.z);
          walker.fig.rotation.y = walker.angle;
        }
        return;
      }
      if ((walker.fleeT > 0) && walker.fleeDir) {
        if (walker.chat) walker.scattered = true;
        walker.fleeT = (walker.fleeT - dtStep);
        walker.x = walker.x + ((walker.fleeDir.x * 3.4) * dtStep);
        walker.z = walker.z + ((walker.fleeDir.z * 3.4) * dtStep);
        walker.angle = Math.atan2(walker.fleeDir.x, walker.fleeDir.z);
        walker.phase = walker.phase + ((3.4 * dtStep) * 2.4);
        if (!(walker.figIsGlb && walker.glbInner)) {
          try { animateFigure(walker.visual, walker.phase, 1.6); } catch (swallowed) {}
        } else {
          try { modelBob(walker, 0.06, 0.05, 0.13, walker.phase); } catch (swallowed) {}
        }
        placeFigure(walker, hopVal);
        return;
      }
      if (walker.scattered) { walker.scattered = false; walker.chat = false; walker.idle = false; rebuildWalkHere(walker); }
      if ((heroGap > 350) && !walker.chat && !('cross' === walker.mode) && !walker.follow) {
        dropOnPavement(walker, findPavementSpot(gameState, heroXVal, heroZVal, 150, 250));
        walker.idle = false;
      }
      if (walker.idle) {
        walker.sway = (walker.sway + dtStep);
        if (walker.chat) {
          if (('market' === walker.chatGroup) && !walker.marketPlaced) {
            const marketPt = findMarket(gameState);
            if (marketPt) { dropInRing(walker, marketPt.x + 13, marketPt.z + 9, walker.idx % 3, 3); walker.marketPlaced = true; }
          }
          walker.angle = Math.atan2(walker.chatCx - walker.x, walker.chatCz - walker.z);
          const talkAmt = (0.5 + (0.5 * Math.sin((walker.sway * 0.33) + (walker.idx * 2.1))));
          if (!(walker.figIsGlb && walker.glbInner)) {
            try { animateFigure(walker.visual, walker.sway * 0.7, 0.12 + (talkAmt * 0.2)); } catch (swallowed) {}
          } else {
            try {
              walker.glbInner.position.y = (0.006 + (talkAmt * 0.008)) * Math.sin((walker.sway * 1.5) + walker.idx);
              walker.glbInner.rotation.z = (0.01 + (talkAmt * 0.014)) * Math.sin((walker.sway * 0.9) + walker.idx);
              walker.glbInner.rotation.x = 0;
            } catch (swallowed) {}
          }
          walker.fig.position.set(walker.x, groundH(walker.x, walker.z) + hopVal, walker.z);
          walker.fig.rotation.y = walker.angle + (Math.sin(walker.sway * 0.4) * 0.15);
          return;
        }
        if (!(walker.figIsGlb && walker.glbInner)) {
          try { animateFigure(walker.visual, walker.sway * 0.7, 0.12); } catch (swallowed) {}
        } else {
          try {
            walker.glbInner.position.y = Math.sin((walker.sway * 1.5) + walker.idx) * 0.006;
            walker.glbInner.rotation.z = Math.sin((walker.sway * 0.9) + walker.idx) * 0.01;
            walker.glbInner.rotation.x = 0;
          } catch (swallowed) {}
        }
        walker.fig.position.set(walker.x, groundH(walker.x, walker.z) + hopVal, walker.z);
        walker.fig.rotation.y = walker.angle + (Math.sin(walker.sway * 0.4) * 0.15);
        return;
      }
      if (walker.follow) {
        const leaderWalker = walker.follow;
        if (!leaderWalker || leaderWalker.downed) {
          walker.sway = (walker.sway + dtStep);
          idleVisual(walker);
          placeFigure(walker, hopVal);
          return;
        }
        const trailXVal = ((leaderWalker.x - (Math.sin(leaderWalker.angle) * 2.3)) + (Math.cos(leaderWalker.angle) * 0.85));
        const trailZVal = ((leaderWalker.z - (Math.cos(leaderWalker.angle) * 2.3)) - (Math.sin(leaderWalker.angle) * 0.85));
        const trailGapVal = Math.hypot(trailXVal - walker.x, trailZVal - walker.z);
        if (trailGapVal > 25) { walker.x = trailXVal; walker.z = trailZVal; }
        else {
          const easeAmt = Math.min(1, dtStep * 4.5);
          walker.x = walker.x + ((trailXVal - walker.x) * easeAmt);
          walker.z = walker.z + ((trailZVal - walker.z) * easeAmt);
        }
        walker.angle = leaderWalker.angle;
        walker.phase = leaderWalker.phase;
        if (trailGapVal > 0.25) walkVisual(walker, 0.55);
        placeFigure(walker, hopVal);
        return;
      }
      if (('cross' === walker.mode) && walker.cross) {
        const crossPlan = walker.cross;
        if ('wait' === crossPlan.stage) {
          crossPlan.waitT = (crossPlan.waitT - dtStep);
          walker.sway = (walker.sway + dtStep);
          idleVisual(walker);
          walker.fig.position.set(walker.x, groundH(walker.x, walker.z) + hopVal, walker.z);
          walker.fig.rotation.y = crossPlan.faceAngle + (Math.sin(walker.sway * 1.7) * 0.55);
          if (!(crossPlan.waitT > 0)) { crossPlan.stage = 'cross'; crossPlan.tx = crossPlan.cx - (crossPlan.sx * 17.2); crossPlan.tz = crossPlan.cz + (crossPlan.sz * 9); }
          return;
        }
        const stepXVal = crossPlan.tx - walker.x;
        const stepZVal = crossPlan.tz - walker.z;
        const stepGap = Math.hypot(stepXVal, stepZVal);
        const speedNow = walker.speed * (('cross' === crossPlan.stage) ? 1.2 : 1);
        if (0.35 > stepGap) {
          if ('toCorner' === crossPlan.stage) { crossPlan.stage = 'toCurb'; crossPlan.tx = crossPlan.cx + (crossPlan.sx * 17.2); crossPlan.tz = crossPlan.cz + (crossPlan.sz * 9); }
          else if ('toCurb' === crossPlan.stage) { crossPlan.stage = 'wait'; crossPlan.waitT = rr(1.4, 3.8); walker.sway = rr(0, 6); }
          else if ('cross' === crossPlan.stage) { crossPlan.stage = 'toWalk'; crossPlan.tx = crossPlan.cx - (crossPlan.sx * 17.2); crossPlan.tz = crossPlan.cz + (crossPlan.sz * 17.2); }
          else {
            walker.mode = 'walk';
            walker.vertical = true;
            walker.line = crossPlan.cx;
            walker.off = (-crossPlan.sx * 17.2);
            walker.x = crossPlan.cx + walker.off;
            walker.dir = (crossPlan.sz > 0) ? 1 : -1;
            walker.cross = null;
          }
        } else {
          const moveVal = Math.min(stepGap, speedNow * dtStep);
          walker.x = walker.x + ((stepXVal / stepGap) * moveVal);
          walker.z = walker.z + ((stepZVal / stepGap) * moveVal);
          walker.angle = Math.atan2(stepXVal, stepZVal);
          walker.phase = walker.phase + ((speedNow * dtStep) * 2.4);
          walkVisual(walker, 0.55);
        }
        placeFigure(walker, hopVal);
        return;
      }
      if (fastCar && (6 > heroGap)) walker.panicT = 0.9;
      let paceVal = walker.speed;
      let lateralVal = 0;
      if (walker.panicT > 0) {
        walker.panicT = (walker.panicT - dtStep);
        paceVal = (walker.speed * 2.1);
        const awaySignVal = Math.sign(((walker.x - heroXVal) * Math.cos(walker.angle)) - ((walker.z - heroZVal) * Math.sin(walker.angle))) || 1;
        lateralVal = (awaySignVal * 2.4);
      }
      if (walker.startleT > 0) paceVal = 0;
      const fwdVal = (walker.dir * paceVal) * dtStep;
      if (!walker.vertical) { walker.x = (walker.x + fwdVal); walker.z = (walker.line + walker.off) + ((lateralVal * dtStep) * 3); }
      else { walker.z = (walker.z + fwdVal); walker.x = (walker.line + walker.off) + ((lateralVal * dtStep) * 3); }
      walker.phase = walker.phase + ((paceVal * dtStep) * 2.4);
      const crossLineList = walker.vertical ? gameState.roadZ : gameState.roadX;
      const alongCoord = walker.vertical ? walker.z : walker.x;
      let replanned = false;
      for (const lineCoord of crossLineList) {
        if (walker.crosser && (1.2 > Math.abs(alongCoord - lineCoord)) && chance(0.30)) {
          if (walker.vertical) planCrossing(walker, walker.line, lineCoord, Math.sign(walker.off) || 1, walker.dir);
          else planCrossing(walker, lineCoord, walker.line, walker.dir, Math.sign(walker.off) || 1);
          replanned = true;
          break;
        }
        if ((1.2 > Math.abs(alongCoord - lineCoord)) && chance(0.012)) {
          const oldLine = walker.line;
          const oldOff = walker.off;
          walker.vertical = !walker.vertical;
          walker.line = lineCoord;
          walker.off = (17.2 * (chance(0.5) ? -1 : 1));
          walker.dir = chance(0.5) ? 1 : -1;
          if (!walker.vertical) { walker.z = walker.line + walker.off; walker.x = oldLine + oldOff; }
          else { walker.x = walker.line + walker.off; walker.z = oldLine + oldOff; }
          break;
        }
      }
      if (replanned) { placeFigure(walker, hopVal); return; }
      if ((walker.x > 640) || (-640 > walker.x) || (walker.z > 640) || (-640 > walker.z)) {
        walker.dir = (walker.dir * -1);
        walker.x = THREE.MathUtils.clamp(walker.x, -638, 638);
        walker.z = THREE.MathUtils.clamp(walker.z, -638, 638);
      }
      walker.angle = walker.vertical ? ((walker.dir > 0) ? 0 : Math.PI) : ((walker.dir > 0) ? Math.PI / 2 : -Math.PI / 2);
      if (!gameState.flags.inCar && (heroGap > 0.001) && (1.1 > heroGap)) {
        const pushVal = (((1.1 - heroGap) * 2.2) * dtStep);
        walker.x = walker.x + (((walker.x - heroXVal) / heroGap) * pushVal);
        walker.z = walker.z + (((walker.z - heroZVal) / heroGap) * pushVal);
      }
      if (!(walker.figIsGlb && walker.glbInner)) {
        try { animateFigure(walker.visual, walker.phase, (walker.panicT > 0) ? 1.6 : 0.55); } catch (swallowed) {}
      } else {
        try {
          const isPanic = (walker.panicT > 0);
          let bobVal = Math.abs(Math.sin(walker.phase)) * 0.04;
          if (isPanic) bobVal = bobVal + (Math.abs(Math.sin(walker.phase * 1.7)) * 0.06);
          walker.glbInner.position.y = bobVal;
          walker.glbInner.rotation.z = Math.sin(walker.phase) * (isPanic ? 0.05 : 0.04);
          walker.glbInner.rotation.x = isPanic ? 0.10 : 0.05;
        } catch (swallowed) {}
      }
      placeFigure(walker, hopVal);
    });
  });
}
