import * as THREE from 'three';
import { rr, ri, pick, chance } from './random.js';
import { groundH } from './world.js';
import { makeFigure, animateFigure } from './player.js';
import { loadHeroAsset } from './assets.js';
// Crowd life for Ronin Bay lives here. Opening cast, chat rings,
// kerb crossers, later density additions, plus fright reactions.
const SKIN_TONES = [0xf0c8a0, 0xe8b48c, 0xc98d64, 0xb97a4e, 0x8a5a34];
const HAIR_KINDS = ['black topknot', 'red ponytail', 'violet bob', 'buzz', 'silver undercut', 'slick black', 'cap', 'long', 'bun'];
const HAIR_TONES = [0x14100e, 0x8c2f1d, 0x6a3fa0, 0x2a2a2e, 0xc9ccd4, 0x1a1512, 0x24406e, 0x3a2415, 0x101010];
const TOP_KINDS = ['tank', 'hoodie', 'jacket'];
const TOP_TONES = [0xff5c39, 0x2e6fb7, 0x37b268, 0xf2c230, 0xe879ff, 0xeeeeee, 0x22242a, 0xff8ab0, 0x57b7ff, 0x8a5a34, 0xffb7d5, 0xa8e6cf, 0xfff0b3];
const BOTTOM_TONES = [0x2c3e57, 0x3a3f47, 0x5b4632, 0x243024, 0x6e7f52, 0x39424e];
// Model-backed citizens claim spawn slices through these rows.
const GLB_YAW = 0;
const GLB_ROWS = [];
GLB_ROWS.push({ key: 'citizenWoman', every: 5, offset: 0 }, { key: 'citizenTeen2', every: 5, offset: 1 });
GLB_ROWS.push({ key: 'citizenOffice', every: 5, offset: 2 }, { key: 'citizenTeen', every: 5, offset: 3 });
// One residue class stays unclaimed on purpose.
// Teen clones need one flat tint each; textured rows skip tinting.
const TEEN_PAINTS = [0x3f8f7a, 0xc96f3f, 0xd9b23f, 0x5a6d8a, 0x7a9a4f, 0x8a4f7d, 0x9aa0a8, 0x4f6db8];
function rowForSpawn(spawnIdx) {
  if (!(Number.isFinite(spawnIdx))) return null;
  let cursorRow = 0;
  while (cursorRow < GLB_ROWS.length) {
    const candidateRow = GLB_ROWS[cursorRow];
    cursorRow = (cursorRow + 1);
    const offVal = ((candidateRow || {}).offset || 0);
    const claimsIt = candidateRow && (0 < candidateRow.every) && ((spawnIdx % candidateRow.every) === offVal);
    if (claimsIt) return candidateRow;
  }
  return null;
}
function rollHairBits() {
  const hairIdxPick = ri(0, HAIR_KINDS.length - 1);
  return [HAIR_KINDS[hairIdxPick], HAIR_TONES[hairIdxPick]];
}
function rollLook() {
  const hairPair = rollHairBits();
  const outfitBits = {};
  outfitBits.top = pick(TOP_KINDS);
  outfitBits.topColor = pick(TOP_TONES);
  outfitBits.trim = pick(TOP_TONES);
  outfitBits.pants = chance(0.6) ? 'jeans' : 'cargo';
  outfitBits.pantsColor = pick(BOTTOM_TONES);
  outfitBits.shoes = pick([0xffffff, 0x222222, 0xd23b3b, 0x2e6fb7]);
  const personLook = {};
  personLook.name = 'Pedestrian';
  personLook.skin = pick(SKIN_TONES);
  personLook.hair = hairPair[0];
  personLook.hairColor = hairPair[1];
  personLook.h = rr(0.9, 1.03);
  personLook.build = rr(0.38, 0.7);
  personLook.outfit = outfitBits;
  return personLook;
}
function candidatePoint(gameRef, anchorX, anchorZ) {
  const verticalFlag = chance(0.5);
  const chosenLine = verticalFlag ? pick(gameRef.roadX) : pick(gameRef.roadZ);
  const sideOffset = ((chance(0.5) ? 1 : -1) * -17.2);
  const alongCoord = rr(-640, 640);
  const candX = verticalFlag ? (chosenLine + sideOffset) : alongCoord;
  const candZ = verticalFlag ? alongCoord : (chosenLine + sideOffset);
  return { x: candX, z: candZ, vertical: verticalFlag, line: chosenLine, off: sideOffset, dist: Math.hypot(candX - anchorX, candZ - anchorZ) };
}
function findPavementSpot(gameRef, anchorX, anchorZ, nearGap, farGap) {
  let attemptsLeft = 24;
  while (0 < attemptsLeft) {
    attemptsLeft = (attemptsLeft - 1);
    const cand = candidatePoint(gameRef, anchorX, anchorZ);
    const insideBand = (nearGap <= cand.dist) && (!(cand.dist > farGap));
    if (insideBand) return { x: cand.x, z: cand.z, vertical: cand.vertical, line: cand.line, off: cand.off };
  }
  const fallbackLine = pick(gameRef.roadX);
  return { x: (fallbackLine + 17.2), z: rr(-300, 300), vertical: true, line: fallbackLine, off: 17.2 };
}
// Landmark shapes vary; probing stays defensive.
function probeLandmark(markObj) {
  try {
    if (!(markObj)) return null;
    const shapeList = [];
    shapeList.push(markObj, markObj.pos, markObj.position, markObj.at);
    let shapeCursor = 0;
    while (shapeCursor < shapeList.length) {
      const shapeItem = shapeList[shapeCursor];
      shapeCursor = (shapeCursor + 1);
      if (shapeItem && Number.isFinite(shapeItem.x) && Number.isFinite(shapeItem.z)) return { x: shapeItem.x, z: shapeItem.z };
    }
  } catch (ignoredErr) {}
  return null;
}
function findMarket(gameRef) {
  let located = null;
  try {
    if (gameRef.landmarks && gameRef.landmarks.market) located = probeLandmark(gameRef.landmarks.market);
  } catch (ignoredErr) {}
  return located;
}
export function initPeds(game) {
  game.peds = [];
  const FIRST_WAVE = 44;
  const readyTemplates = {};
  function tintTeenClone(cloneRoot, paintHex) {
    cloneRoot.traverse((meshNode) => {
      if (meshNode && meshNode.isMesh && meshNode.material && meshNode.material.color) {
        meshNode.material = meshNode.material.clone();
        meshNode.material.color.setHex(paintHex);
      }
    });
  }
  function shadowize(rootObj) {
    rootObj.traverse((meshNode) => { if (meshNode && meshNode.isMesh) meshNode.castShadow = true; });
  }
  function adoptModel(person) {
    try {
      if (!(person) || person.figIsGlb || !(person.citizenKey)) return;
      const templateObj = readyTemplates[person.citizenKey];
      if (!(templateObj)) return;
      const wrapperGroup = new THREE.Group();
      wrapperGroup.rotation.y = GLB_YAW;
      const clonedModel = templateObj.clone(true);
      if ('citizenTeen' === person.citizenKey) {
        const chosenPaint = TEEN_PAINTS[person.idx % TEEN_PAINTS.length];
        tintTeenClone(clonedModel, chosenPaint);
      }
      shadowize(wrapperGroup);
      wrapperGroup.add(clonedModel);
      if (person.visual) person.fig.remove(person.visual);
      person.fig.add(wrapperGroup);
      person.visual = wrapperGroup;
      person.glbInner = wrapperGroup;
      person.figIsGlb = true;
    } catch (ignoredErr) {}
  }
  for (const rowEntry of GLB_ROWS) {
    try {
      const pendingLoad = loadHeroAsset(rowEntry.key);
      if (pendingLoad && ('function' === typeof pendingLoad.then)) {
        pendingLoad.then((loadedTpl) => {
          try {
            if (!(loadedTpl)) return;
            readyTemplates[rowEntry.key] = loadedTpl;
            game.peds.forEach((eachPerson) => adoptModel(eachPerson));
          } catch (ignoredErr) {}
        }).catch(() => {});
      }
    } catch (ignoredErr) {}
  }
  function dropOnPavement(person, spotObj) {
    person.x = spotObj.x;
    person.z = spotObj.z;
    person.vertical = spotObj.vertical;
    person.line = spotObj.line;
    person.off = spotObj.off;
    person.dir = chance(0.5) ? 1 : -1;
    const positiveDir = (0 < person.dir);
    person.angle = person.vertical ? (positiveDir ? 0 : Math.PI) : (positiveDir ? Math.PI / 2 : -Math.PI / 2);
  }
  function dropInRing(person, centreX, centreZ, slotIdx, ringCount) {
    const thetaVal = ((slotIdx / ringCount) * Math.PI * 2) + rr(-0.25, 0.25);
    person.x = centreX + (Math.sin(thetaVal) * 1.25);
    person.z = centreZ + (Math.cos(thetaVal) * 1.25);
    person.chatCx = centreX;
    person.chatCz = centreZ;
    person.chat = true;
    person.idle = true;
    person.angle = Math.atan2(centreX - person.x, centreZ - person.z);
  }
  function planCrossing(person, cornerX, cornerZ, signX, signZ, snapToKerb) {
    person.mode = 'cross';
    person.crosser = true;
    const kerbCoordX = cornerX + (signX * 17.2);
    const kerbCoordZ = cornerZ + (signZ * 17.2);
    if (snapToKerb) { person.x = kerbCoordX; person.z = kerbCoordZ; }
    const farStart = (2 < Math.hypot(kerbCoordX - person.x, kerbCoordZ - person.z));
    const planObj = {};
    planObj.stage = farStart ? 'toCorner' : 'toCurb';
    planObj.cx = cornerX;
    planObj.cz = cornerZ;
    planObj.sx = signX;
    planObj.sz = signZ;
    planObj.waitT = 0;
    planObj.tx = farStart ? kerbCoordX : (cornerX + (signX * 17.2));
    planObj.tz = farStart ? kerbCoordZ : (cornerZ + (signZ * 9));
    planObj.faceAngle = Math.atan2(-signX, 0);
    person.cross = planObj;
    person.angle = Math.atan2(planObj.tx - person.x, planObj.tz - person.z);
  }
  function rebuildWalkHere(person) {
    let closestLine = game.roadX[0];
    let closestGap = Infinity;
    for (const lineCandidate of game.roadX) {
      const gapVal = Math.abs(person.x - lineCandidate);
      if (gapVal < closestGap) { closestGap = gapVal; closestLine = lineCandidate; }
    }
    person.vertical = true;
    person.line = closestLine;
    person.off = THREE.MathUtils.clamp(person.x - closestLine, -17.2, 17.2);
    if (13 > Math.abs(person.off)) person.off = (17.2 * ((person.off < 0) ? -1 : 1));
    person.x = (closestLine + person.off);
    person.dir = chance(0.5) ? 1 : -1;
    person.mode = 'walk';
  }
  function modelBob(person, bobScale, swayScale, leanVal, phaseVal) {
    person.glbInner.position.y = Math.abs(Math.sin(phaseVal)) * bobScale;
    person.glbInner.rotation.z = Math.sin(phaseVal) * swayScale;
    person.glbInner.rotation.x = leanVal;
  }
  function walkVisual(person, amountVal) {
    const usingModel = Boolean(person.figIsGlb && person.glbInner);
    if (!(usingModel)) { try { animateFigure(person.visual, person.phase, amountVal); } catch (ignoredErr) {} return; }
    try { modelBob(person, (0.04 * (amountVal + amountVal)), 0.04, 0.05, person.phase); } catch (ignoredErr) {}
  }
  function idleVisual(person) {
    const usingModel = Boolean(person.figIsGlb && person.glbInner);
    if (!(usingModel)) { try { animateFigure(person.visual, person.sway * 0.7, 0.12); } catch (ignoredErr) {} return; }
    try {
      person.glbInner.position.y = Math.sin((person.sway * 1.5) + person.idx) * 0.006;
      person.glbInner.rotation.z = Math.sin((person.sway * 0.9) + person.idx) * 0.01;
      person.glbInner.rotation.x = 0;
    } catch (ignoredErr) {}
  }
  function freshWalkerShell(builtFig, idxVal, citizenKeyVal) {
    const outerGroup = new THREE.Group();
    outerGroup.add(builtFig);
    const person = {};
    person.fig = outerGroup;
    person.visual = builtFig;
    person.glbInner = null;
    person.figIsGlb = false;
    person.citizenKey = citizenKeyVal;
    person.idx = idxVal;
    person.x = 0; person.z = 0; person.angle = 0;
    person.speed = rr(1.2, 1.8);
    person.phase = rr(0, 10);
    person.vertical = true; person.line = 0; person.off = 17.2; person.dir = 1;
    person.panicT = 0; person.idle = false;
    person.sway = rr(0, 6);
    person.startleT = 0; person.fleeT = 0; person.fleeDir = null;
    person.mode = 'walk'; person.follow = null; person.chat = false; person.scattered = false;
    person.crosser = false; person.cross = null; person.chatGroup = null; person.marketPlaced = false;
    return person;
  }
  function pairHomeList() {
    const homesArr = [];
    homesArr.push({ x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 }, { x: -330, z: -330 });
    homesArr.push({ x: -412.5, z: 412.5 }, { x: 0, z: 0 }, { x: 250, z: 420 }, { x: -480, z: -255 });
    return homesArr;
  }
  function strollHomeList() {
    const strollArr = [];
    strollArr.push({ x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 }, { x: -330, z: -330 });
    strollArr.push({ x: -412.5, z: 412.5 }, { x: 0, z: 0 }, { x: 250, z: 420 }, { x: -480, z: -255 });
    return strollArr;
  }
  let spawnCounter = 0;
  while (spawnCounter < FIRST_WAVE) {
    const idxNow = spawnCounter;
    spawnCounter = (spawnCounter + 1);
    let builtFig = null;
    try { builtFig = makeFigure(rollLook()); } catch (ignoredErr) { continue; }
    const claimedRow = rowForSpawn(idxNow);
    const person = freshWalkerShell(builtFig, idxNow, claimedRow ? claimedRow.key : null);
    if (idxNow < 12) {
      person.idle = true;
      if (idxNow < 3) dropInRing(person, -410, 418, idxNow, 3);
      else if (idxNow < 6) dropInRing(person, 330, -330, idxNow - 3, 3);
      else if (idxNow < 9) dropInRing(person, 182.2, 147.8, idxNow - 6, 3);
      else {
        person.chatGroup = 'market';
        const marketSpot = findMarket(game);
        if (marketSpot) { dropInRing(person, marketSpot.x + 13, marketSpot.z + 9, idxNow - 9, 3); person.marketPlaced = true; }
        else dropInRing(person, -312.8, -147.8, idxNow - 9, 3);
      }
      if ((1 === idxNow) || (4 === idxNow)) {
        try {
          const phoneMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.16, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.4, emissive: 0x2a4a6a, emissiveIntensity: 0.7 })
          );
          phoneMesh.position.set(0.22, 1.05, 0.22);
          builtFig.add(phoneMesh);
        } catch (ignoredErr) {}
      }
    } else if (idxNow < 24) {
      if (0 === (idxNow % 2)) {
        const chosenHome = pick(pairHomeList());
        dropOnPavement(person, findPavementSpot(game, chosenHome.x, chosenHome.z, 0, 190));
      } else {
        const leaderPerson = game.peds[game.peds.length - 1];
        person.follow = leaderPerson || null;
        if (!(leaderPerson)) {
          const chosenHome = pick(pairHomeList());
          dropOnPavement(person, findPavementSpot(game, chosenHome.x, chosenHome.z, 0, 190));
        } else {
          person.x = ((leaderPerson.x - (Math.sin(leaderPerson.angle) * 2.3)) + (Math.cos(leaderPerson.angle) * 0.85));
          person.z = ((leaderPerson.z - (Math.cos(leaderPerson.angle) * 2.3)) - (Math.sin(leaderPerson.angle) * 0.85));
          person.angle = leaderPerson.angle;
          person.speed = leaderPerson.speed;
        }
      }
    } else if (idxNow < 32) {
      const cornerPickX = pick([-330, -165, 0, 165, 330]);
      const cornerPickZ = pick([-330, -165, 0, 165, 330]);
      planCrossing(person, cornerPickX, cornerPickZ, chance(0.5) ? 1 : -1, chance(0.5) ? 1 : -1, true);
    } else {
      const chosenHome = pick(strollHomeList());
      dropOnPavement(person, findPavementSpot(game, chosenHome.x, chosenHome.z, 0, 190));
    }
    shadowize(person.fig);
    person.fig.position.set(person.x, groundH(person.x, person.z), person.z);
    person.fig.rotation.y = person.angle;
    game.scene.add(person.fig);
    game.peds.push(person);
    adoptModel(person);
  }
  // Density additions follow; every extra figure stays procedural.
  function spawnBonusPed() {
    let builtFig = null;
    try { builtFig = makeFigure(rollLook()); } catch (ignoredErr) { return null; }
    const outerGroup = new THREE.Group();
    outerGroup.add(builtFig);
    shadowize(outerGroup);
    const person = {};
    person.fig = outerGroup;
    person.visual = builtFig;
    person.glbInner = null;
    person.figIsGlb = false;
    person.citizenKey = null;
    person.idx = game.peds.length;
    person.x = 0; person.z = 0; person.angle = 0;
    person.speed = rr(1.2, 1.8);
    person.phase = rr(0, 10);
    person.vertical = true; person.line = 0; person.off = 17.2; person.dir = 1;
    person.panicT = 0; person.idle = false;
    person.sway = rr(0, 6);
    person.startleT = 0; person.fleeT = 0; person.fleeDir = null;
    person.mode = 'walk'; person.follow = null; person.chat = false; person.scattered = false;
    person.crosser = false; person.cross = null; person.chatGroup = null; person.marketPlaced = false;
    return person;
  }
  function finishBonusPed(person) {
    if (!(person)) return;
    person.fig.position.set(person.x, groundH(person.x, person.z), person.z);
    person.fig.rotation.y = person.angle;
    game.scene.add(person.fig);
    game.peds.push(person);
  }
  function dropStanding(person, placeX, placeZ, headingVal) {
    person.x = placeX;
    person.z = placeZ;
    person.idle = true;
    person.chat = true;
    person.chatCx = placeX + (Math.sin(headingVal) * 3);
    person.chatCz = placeZ + (Math.cos(headingVal) * 3);
    person.angle = headingVal;
  }
  function dropLaneWalker(person, laneOffVal, loBound, hiBound, dirSignVal) {
    person.vertical = false;
    person.line = 495;
    person.off = laneOffVal;
    person.x = rr(loBound, hiBound);
    person.z = (495 + laneOffVal);
    person.dir = dirSignVal;
    person.angle = (0 < person.dir) ? Math.PI / 2 : -Math.PI / 2;
    person.mode = 'walk';
    person.idle = false;
  }
  const SPARE_SPOTS = [];
  SPARE_SPOTS.push({ x: 100, z: 511, ry: 0, stall: false }, { x: 300, z: 552, ry: 0, stall: false });
  SPARE_SPOTS.push({ x: -60, z: -238, ry: 0, stall: false }, { x: -210, z: 481, ry: 0, stall: false });
  let gatheredSpots = null;
  try { if (Array.isArray(game.gatherSpots) && game.gatherSpots.length) gatheredSpots = game.gatherSpots; } catch (ignoredErr) {}
  const spotsInUse = gatheredSpots || SPARE_SPOTS;
  function spotFrame(spotObj) {
    const yawVal = Number.isFinite(spotObj.ry) ? spotObj.ry : 0;
    return { yaw: yawVal, fwdX: Math.sin(yawVal), fwdZ: Math.cos(yawVal), sideX: Math.cos(yawVal), sideZ: -Math.sin(yawVal) };
  }
  for (const spotObj of spotsInUse) {
    if (!(spotObj) || !(Number.isFinite(spotObj.x)) || !(Number.isFinite(spotObj.z))) continue;
    const frame = spotFrame(spotObj);
    const circleX = spotObj.x + (frame.sideX * 4.5);
    const circleZ = spotObj.z + (frame.sideZ * 4.5);
    let ringCounter = 0;
    while (ringCounter < 3) {
      const extraPerson = spawnBonusPed();
      if (extraPerson) { dropInRing(extraPerson, circleX, circleZ, ringCounter, 3); finishBonusPed(extraPerson); }
      ringCounter = (ringCounter + 1);
    }
    for (const sideSign of [-1, 1]) {
      const extraPerson = spawnBonusPed();
      if (extraPerson) {
        dropStanding(extraPerson, (spotObj.x - (frame.fwdX * 3.5)) + (frame.sideX * sideSign * 2.2), (spotObj.z - (frame.fwdZ * 3.5)) + (frame.sideZ * sideSign * 2.2), frame.yaw);
        finishBonusPed(extraPerson);
      }
    }
    if (spotObj.stall) {
      for (const sideSign of [-1, 1]) {
        const extraPerson = spawnBonusPed();
        if (extraPerson) {
          dropStanding(extraPerson, (spotObj.x + (frame.fwdX * 1.9)) + (frame.sideX * sideSign * 0.95), (spotObj.z + (frame.fwdZ * 1.9)) + (frame.sideZ * sideSign * 0.95), frame.yaw + Math.PI);
          finishBonusPed(extraPerson);
        }
      }
      const vendorPerson = spawnBonusPed();
      if (vendorPerson) { dropStanding(vendorPerson, spotObj.x - (frame.fwdX * 1.6), spotObj.z - (frame.fwdZ * 1.6), frame.yaw); finishBonusPed(vendorPerson); }
    }
  }
  for (const spotObj of spotsInUse) {
    if (!(spotObj) || !(spotObj.stall)) continue;
    if (!(Number.isFinite(spotObj.x)) || !(Number.isFinite(spotObj.z))) continue;
    const frame = spotFrame(spotObj);
    let queueCounter = 0;
    while (queueCounter < 2) {
      const queuedPerson = spawnBonusPed();
      if (queuedPerson) {
        const backStep = (1.9 + (0.9 * (queueCounter + 1)));
        const wobbleVal = (0 === queueCounter) ? -0.18 : 0.22;
        dropStanding(queuedPerson, (spotObj.x + (frame.fwdX * backStep)) + (frame.sideX * wobbleVal), (spotObj.z + (frame.fwdZ * backStep)) + (frame.sideZ * wobbleVal), frame.yaw + Math.PI);
        finishBonusPed(queuedPerson);
      }
      queueCounter = (queueCounter + 1);
    }
  }
  const LANE_ROWS = [];
  LANE_ROWS.push({ off: -9, n: 8, xMin: -420, xMax: 560 }, { off: 10, n: 7, xMin: -420, xMax: 560 });
  LANE_ROWS.push({ off: 57, n: 5, xMin: -380, xMax: 600 });
  for (const laneRow of LANE_ROWS) {
    let laneCounter = 0;
    while (laneCounter < laneRow.n) {
      const lanePerson = spawnBonusPed();
      if (lanePerson) { dropLaneWalker(lanePerson, laneRow.off, laneRow.xMin, laneRow.xMax, (0 === (laneCounter % 2)) ? 1 : -1); finishBonusPed(lanePerson); }
      laneCounter = (laneCounter + 1);
    }
  }
  {
    let martCounter = 0;
    while (martCounter < 4) {
      const martPerson = spawnBonusPed();
      if (martPerson) { dropInRing(martPerson, -79.5, -251, martCounter, 4); finishBonusPed(martPerson); }
      martCounter = (martCounter + 1);
    }
  }
  {
    let dtCounter = 0;
    while (dtCounter < 4) {
      const dtPerson = spawnBonusPed();
      if (dtPerson) { dropOnPavement(dtPerson, findPavementSpot(game, 0, 0, 0, 70)); finishBonusPed(dtPerson); }
      dtCounter = (dtCounter + 1);
    }
  }
  {
    let dtAgainCounter = 0;
    while (dtAgainCounter < 4) {
      const dtAgainPerson = spawnBonusPed();
      if (dtAgainPerson) { dropOnPavement(dtAgainPerson, findPavementSpot(game, 0, 0, 0, 70)); finishBonusPed(dtAgainPerson); }
      dtAgainCounter = (dtAgainCounter + 1);
    }
  }
  // Park crowd block.
  {
    let parkInfo = { x: 82, z: 415, stallX: 82 + 32, stallZ: 415 + 8 };
    try {
      const liveParkSpot = game.parkSpot;
      if (liveParkSpot && Number.isFinite(liveParkSpot.x) && Number.isFinite(liveParkSpot.z)) {
        const rebuiltPark = {};
        rebuiltPark.x = liveParkSpot.x;
        rebuiltPark.z = liveParkSpot.z;
        rebuiltPark.stallX = Number.isFinite(liveParkSpot.stallX) ? liveParkSpot.stallX : (liveParkSpot.x + 32);
        rebuiltPark.stallZ = Number.isFinite(liveParkSpot.stallZ) ? liveParkSpot.stallZ : (liveParkSpot.z + 8);
        parkInfo = rebuiltPark;
      }
    } catch (ignoredErr) {}
    const parkCentreX = parkInfo.x;
    const parkCentreZ = parkInfo.z;
    {
      let benchCounter = 0;
      while (benchCounter < 3) {
        const benchPerson = spawnBonusPed();
        if (benchPerson) { dropInRing(benchPerson, parkCentreX + 10, parkCentreZ + 6, benchCounter, 3); finishBonusPed(benchPerson); }
        benchCounter = (benchCounter + 1);
      }
    }
    {
      let benchAgainCounter = 0;
      while (benchAgainCounter < 3) {
        const benchAgainPerson = spawnBonusPed();
        if (benchAgainPerson) { dropInRing(benchAgainPerson, parkCentreX - 10, parkCentreZ - 6, benchAgainCounter, 3); finishBonusPed(benchAgainPerson); }
        benchAgainCounter = (benchAgainCounter + 1);
      }
    }
    const parkVendor = spawnBonusPed();
    if (parkVendor) { dropStanding(parkVendor, parkInfo.stallX + 0.9, parkInfo.stallZ, -Math.PI / 2); finishBonusPed(parkVendor); }
    for (const sideSign of [-1, 1]) {
      const custPerson = spawnBonusPed();
      if (custPerson) { dropStanding(custPerson, parkInfo.stallX - 2.6, parkInfo.stallZ + (sideSign * 0.95), Math.PI / 2); finishBonusPed(custPerson); }
    }
    const pairSpecs = [[16, 0, Math.PI / 2], [0, 16, 0]];
    for (const pairSpec of pairSpecs) {
      const [pairDx, pairDz] = pairSpec;
      const pairFacing = pairSpec[2];
      for (const sideSign of [-1, 1]) {
        const pairPerson = spawnBonusPed();
        if (pairPerson) {
          const splitAmount = (0.85 * sideSign);
          dropStanding(pairPerson, (parkCentreX + pairDx) + ((0 !== pairFacing) ? splitAmount : 0), (parkCentreZ + pairDz) + ((0 === pairFacing) ? splitAmount : 0), pairFacing + ((0 < sideSign) ? Math.PI : 0));
          finishBonusPed(pairPerson);
        }
      }
    }
    const pathSpecs = [[-1.5, -20, 1], [1.5, 18, -1]];
    for (const pathSpec of pathSpecs) {
      const strollerPerson = spawnBonusPed();
      const [pathOffVal, pathDzVal, pathDirVal] = pathSpec;
      if (strollerPerson) {
        strollerPerson.vertical = true;
        strollerPerson.line = parkCentreX;
        strollerPerson.off = pathSpec[0];
        strollerPerson.x = parkCentreX + pathOffVal;
        strollerPerson.z = parkCentreZ + pathDzVal;
        strollerPerson.dir = pathDirVal;
        strollerPerson.angle = (0 < pathDirVal) ? 0 : Math.PI;
        strollerPerson.mode = 'walk';
        strollerPerson.idle = false;
        finishBonusPed(strollerPerson);
      }
    }
  }
  // Horn startle plus road step-aside, best effort only.
  game.pedsStartle = function pedsStartle(posX, posZ, radiusVal) {
    try {
      if (!(Array.isArray(game.peds)) || !(Number.isFinite(posX)) || !(Number.isFinite(posZ))) return;
      const reachVal = (Number.isFinite(radiusVal) && (0 < radiusVal)) ? radiusVal : 12;
      const nearAnyLine = (coordVal, lineArr) => Array.isArray(lineArr) && lineArr.some((lineEntry) => !(Math.abs(coordVal - lineEntry) > 20));
      for (const person of game.peds) {
        if (!(person) || person.downed) continue;
        const awayVecX = person.x - posX;
        const awayVecZ = person.z - posZ;
        const distFromCar = Math.hypot(awayVecX, awayVecZ);
        if (reachVal < distFromCar) continue;
        person.startleT = 0.25;
        const roadNear = nearAnyLine(person.x, game.roadX) || nearAnyLine(person.z, game.roadZ);
        if (roadNear || ((0 < person.fleeT) && person.fleeDir)) {
          const normDenom = (0.001 < distFromCar) ? distFromCar : 1;
          person.fleeDir = (0.001 < distFromCar) ? { x: awayVecX / normDenom, z: awayVecZ / normDenom } : { x: 1, z: 0 };
          person.fleeT = Math.max(person.fleeT || 0, 0.8);
        }
      }
    } catch (ignoredErr) {}
  };
  game.updaters.push((frameGame, dtVal) => {
    const heroPosX = game.car ? game.car.x : game.player.x;
    const heroPosZ = game.car ? game.car.z : game.player.z;
    const fastCarFlag = game.car && game.flags.inCar && (40 < (game.speedKmh || 0));
    function placeFigure(person, hopVal) {
      person.fig.position.set(person.x, groundH(person.x, person.z) + hopVal, person.z);
      person.fig.rotation.y = person.angle;
    }
    for (const person of game.peds) {
      const heroDistance = Math.hypot(person.x - heroPosX, person.z - heroPosZ);
      let hopOffset = 0;
      if (0 < person.startleT) {
        person.startleT = (person.startleT - dtVal);
        const doneFrac = Math.min(1, Math.max(0, 1 - (person.startleT / 0.25)));
        hopOffset = Math.sin(doneFrac * Math.PI) * 0.14;
      }
      if (person.downed) {
        person.downedT = ((person.downedT || 0) - dtVal);
        if (!(person.downedT > 0)) {
          person.downed = false;
          person._tipped = false;
          person.hp = 100;
          try { person.fig.rotation.set(0, person.angle, 0); } catch (ignoredErr) {}
          dropOnPavement(person, findPavementSpot(game, heroPosX, heroPosZ, 60, 180));
          person.idle = false; person.chat = false; person.mode = 'walk';
          person.follow = null; person.scattered = false;
          person.fig.position.set(person.x, groundH(person.x, person.z), person.z);
          person.fig.rotation.y = person.angle;
        }
        continue;
      }
      if ((0 < person.fleeT) && person.fleeDir) {
        if (person.chat) person.scattered = true;
        person.fleeT = (person.fleeT - dtVal);
        person.x = person.x + ((person.fleeDir.x * 3.4) * dtVal);
        person.z = person.z + ((person.fleeDir.z * 3.4) * dtVal);
        person.angle = Math.atan2(person.fleeDir.x, person.fleeDir.z);
        person.phase = person.phase + ((3.4 * dtVal) * 2.4);
        if (!(person.figIsGlb && person.glbInner)) {
          try { animateFigure(person.visual, person.phase, 1.6); } catch (ignoredErr) {}
        } else {
          try { modelBob(person, 0.06, 0.05, 0.13, person.phase); } catch (ignoredErr) {}
        }
        placeFigure(person, hopOffset);
        continue;
      }
      if (person.scattered) { person.scattered = false; person.chat = false; person.idle = false; rebuildWalkHere(person); }
      if ((350 < heroDistance) && !(person.chat) && !('cross' === person.mode) && !(person.follow)) {
        dropOnPavement(person, findPavementSpot(game, heroPosX, heroPosZ, 150, 250));
        person.idle = false;
      }
      if (person.idle) {
        person.sway = (person.sway + dtVal);
        if (person.chat) {
          if (('market' === person.chatGroup) && !(person.marketPlaced)) {
            const marketSpot = findMarket(game);
            if (marketSpot) { dropInRing(person, marketSpot.x + 13, marketSpot.z + 9, person.idx % 3, 3); person.marketPlaced = true; }
          }
          person.angle = Math.atan2(person.chatCx - person.x, person.chatCz - person.z);
          const talkAmount = (0.5 + (0.5 * Math.sin((person.sway * 0.33) + (person.idx * 2.1))));
          if (!(person.figIsGlb && person.glbInner)) {
            try { animateFigure(person.visual, person.sway * 0.7, 0.12 + (talkAmount * 0.2)); } catch (ignoredErr) {}
          } else {
            try {
              person.glbInner.position.y = (0.006 + (talkAmount * 0.008)) * Math.sin((person.sway * 1.5) + person.idx);
              person.glbInner.rotation.z = (0.01 + (talkAmount * 0.014)) * Math.sin((person.sway * 0.9) + person.idx);
              person.glbInner.rotation.x = 0;
            } catch (ignoredErr) {}
          }
          person.fig.position.set(person.x, groundH(person.x, person.z) + hopOffset, person.z);
          person.fig.rotation.y = person.angle + (Math.sin(person.sway * 0.4) * 0.15);
          continue;
        }
        if (!(person.figIsGlb && person.glbInner)) {
          try { animateFigure(person.visual, person.sway * 0.7, 0.12); } catch (ignoredErr) {}
        } else {
          try {
            person.glbInner.position.y = Math.sin((person.sway * 1.5) + person.idx) * 0.006;
            person.glbInner.rotation.z = Math.sin((person.sway * 0.9) + person.idx) * 0.01;
            person.glbInner.rotation.x = 0;
          } catch (ignoredErr) {}
        }
        person.fig.position.set(person.x, groundH(person.x, person.z) + hopOffset, person.z);
        person.fig.rotation.y = person.angle + (Math.sin(person.sway * 0.4) * 0.15);
        continue;
      }
      if (person.follow) {
        const leaderPerson = person.follow;
        if (!(leaderPerson) || leaderPerson.downed) {
          person.sway = (person.sway + dtVal);
          idleVisual(person);
          placeFigure(person, hopOffset);
          continue;
        }
        const trailTargetX = ((leaderPerson.x - (Math.sin(leaderPerson.angle) * 2.3)) + (Math.cos(leaderPerson.angle) * 0.85));
        const trailTargetZ = ((leaderPerson.z - (Math.cos(leaderPerson.angle) * 2.3)) - (Math.sin(leaderPerson.angle) * 0.85));
        const trailGap = Math.hypot(trailTargetX - person.x, trailTargetZ - person.z);
        if (25 < trailGap) { person.x = trailTargetX; person.z = trailTargetZ; }
        else {
          const easeFactor = Math.min(1, dtVal * 4.5);
          person.x = person.x + ((trailTargetX - person.x) * easeFactor);
          person.z = person.z + ((trailTargetZ - person.z) * easeFactor);
        }
        person.angle = leaderPerson.angle;
        person.phase = leaderPerson.phase;
        if (0.25 < trailGap) walkVisual(person, 0.55);
        placeFigure(person, hopOffset);
        continue;
      }
      if (('cross' === person.mode) && person.cross) {
        const planObj = person.cross;
        if ('wait' === planObj.stage) {
          planObj.waitT = (planObj.waitT - dtVal);
          person.sway = (person.sway + dtVal);
          idleVisual(person);
          person.fig.position.set(person.x, groundH(person.x, person.z) + hopOffset, person.z);
          person.fig.rotation.y = planObj.faceAngle + (Math.sin(person.sway * 1.7) * 0.55);
          if (!(planObj.waitT > 0)) { planObj.stage = 'cross'; planObj.tx = planObj.cx - (planObj.sx * 17.2); planObj.tz = planObj.cz + (planObj.sz * 9); }
          continue;
        }
        const stepVecX = planObj.tx - person.x;
        const stepVecZ = planObj.tz - person.z;
        const stepDistance = Math.hypot(stepVecX, stepVecZ);
        const currentSpeed = person.speed * (('cross' === planObj.stage) ? 1.2 : 1);
        if (stepDistance < 0.35) {
          if ('toCorner' === planObj.stage) { planObj.stage = 'toCurb'; planObj.tx = planObj.cx + (planObj.sx * 17.2); planObj.tz = planObj.cz + (planObj.sz * 9); }
          else if ('toCurb' === planObj.stage) { planObj.stage = 'wait'; planObj.waitT = rr(1.4, 3.8); person.sway = rr(0, 6); }
          else if ('cross' === planObj.stage) { planObj.stage = 'toWalk'; planObj.tx = planObj.cx - (planObj.sx * 17.2); planObj.tz = planObj.cz + (planObj.sz * 17.2); }
          else {
            person.mode = 'walk';
            person.vertical = true;
            person.line = planObj.cx;
            person.off = (-planObj.sx * 17.2);
            person.x = planObj.cx + person.off;
            person.dir = (0 < planObj.sz) ? 1 : -1;
            person.cross = null;
          }
        } else {
          const moveAmount = Math.min(stepDistance, currentSpeed * dtVal);
          person.x = person.x + ((stepVecX / stepDistance) * moveAmount);
          person.z = person.z + ((stepVecZ / stepDistance) * moveAmount);
          person.angle = Math.atan2(stepVecX, stepVecZ);
          person.phase = person.phase + ((currentSpeed * dtVal) * 2.4);
          walkVisual(person, 0.55);
        }
        placeFigure(person, hopOffset);
        continue;
      }
      if (fastCarFlag && (heroDistance < 6)) person.panicT = 0.9;
      let paceCurrent = person.speed;
      let lateralStep = 0;
      if (0 < person.panicT) {
        person.panicT = (person.panicT - dtVal);
        paceCurrent = (2.1 * person.speed);
        const awaySign = Math.sign(((person.x - heroPosX) * Math.cos(person.angle)) - ((person.z - heroPosZ) * Math.sin(person.angle))) || 1;
        lateralStep = (2.4 * awaySign);
      }
      if (0 < person.startleT) paceCurrent = 0;
      const forwardStep = (person.dir * paceCurrent) * dtVal;
      if (!(person.vertical)) { person.x = (person.x + forwardStep); person.z = (person.line + person.off) + ((lateralStep * dtVal) * 3); }
      else { person.z = (person.z + forwardStep); person.x = (person.line + person.off) + ((lateralStep * dtVal) * 3); }
      person.phase = person.phase + ((paceCurrent * dtVal) * 2.4);
      const crossingLines = person.vertical ? game.roadZ : game.roadX;
      const alongCoord = person.vertical ? person.z : person.x;
      let replannedFlag = false;
      for (const lineEntry of crossingLines) {
        if (person.crosser && (1.2 > Math.abs(alongCoord - lineEntry)) && chance(0.30)) {
          if (person.vertical) planCrossing(person, person.line, lineEntry, Math.sign(person.off) || 1, person.dir);
          else planCrossing(person, lineEntry, person.line, person.dir, Math.sign(person.off) || 1);
          replannedFlag = true;
          break;
        }
        if ((1.2 > Math.abs(alongCoord - lineEntry)) && chance(0.012)) {
          const previousLine = person.line;
          const previousOff = person.off;
          person.vertical = !(person.vertical);
          person.line = lineEntry;
          person.off = (17.2 * (chance(0.5) ? -1 : 1));
          person.dir = chance(0.5) ? 1 : -1;
          if (!(person.vertical)) { person.z = person.line + person.off; person.x = previousLine + previousOff; }
          else { person.x = person.line + person.off; person.z = previousLine + previousOff; }
          break;
        }
      }
      if (replannedFlag) { placeFigure(person, hopOffset); continue; }
      if ((640 < person.x) || (person.x < -640) || (640 < person.z) || (person.z < -640)) {
        person.dir = (person.dir * -1);
        person.x = THREE.MathUtils.clamp(person.x, -638, 638);
        person.z = THREE.MathUtils.clamp(person.z, -638, 638);
      }
      person.angle = person.vertical ? ((0 < person.dir) ? 0 : Math.PI) : ((0 < person.dir) ? Math.PI / 2 : -Math.PI / 2);
      if (!(game.flags.inCar) && (1.1 > heroDistance) && (0.001 < heroDistance)) {
        const pushAmount = (((1.1 - heroDistance) * 2.2) * dtVal);
        person.x = person.x + (((person.x - heroPosX) / heroDistance) * pushAmount);
        person.z = person.z + (((person.z - heroPosZ) / heroDistance) * pushAmount);
      }
      if (!(person.figIsGlb && person.glbInner)) {
        try { animateFigure(person.visual, person.phase, (0 < person.panicT) ? 1.6 : 0.55); } catch (ignoredErr) {}
      } else {
        try {
          const panickingNow = (0 < person.panicT);
          let bobAmount = Math.abs(Math.sin(person.phase)) * 0.04;
          if (panickingNow) bobAmount = bobAmount + (Math.abs(Math.sin(person.phase * 1.7)) * 0.06);
          person.glbInner.position.y = bobAmount;
          person.glbInner.rotation.z = Math.sin(person.phase) * (panickingNow ? 0.05 : 0.04);
          person.glbInner.rotation.x = panickingNow ? 0.10 : 0.05;
        } catch (ignoredErr) {}
      }
      placeFigure(person, hopOffset);
    }
  });
}
