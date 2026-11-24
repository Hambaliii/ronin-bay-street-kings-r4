import * as THREE from 'three';
import { chance, pick, ri, rr } from './random.js';
import { groundH } from './world.js';
import { animateFigure, makeFigure } from './player.js';
import { loadHeroAsset } from './assets.js';
// All of Ronin Bay's foot traffic is directed from this module:
// the opening strollers, the gossip circles standing at kerbs,
// the crossing pedestrians, the extra crowds layered in around
// busy corners, and the flinch that a horn blast sets off.
const SKIN_TONES = [0xf0c8a0, 0xe8b48c, 0xc98d64,
  0xb97a4e, 0x8a5a34];
const HAIR_CUTS = ['black topknot', 'red ponytail', 'violet bob', 'buzz', 'silver undercut',
  'slick black', 'cap', 'long', 'bun'];
const HAIR_TONES = [0x14100e, 0x8c2f1d, 0x6a3fa0, 0x2a2a2e, 0xc9ccd4,
  0x1a1512, 0x24406e, 0x3a2415, 0x101010];
const TOP_KINDS = ['tank', 'hoodie', 'jacket'];
const TOP_TONES = [0xff5c39, 0x2e6fb7, 0x37b268, 0xf2c230, 0xe879ff, 0xeeeeee, 0x22242a,
  0xff8ab0, 0x57b7ff, 0x8a5a34, 0xffb7d5, 0xa8e6cf, 0xfff0b3];
const LEG_TONES = [0x2c3e57, 0x3a3f47, 0x5b4632, 0x243024, 0x6e7f52, 0x39424e];
// Model-backed citizens draw their spawn slot from the table
// below; one residue class is deliberately left unclaimed, so
// spawns landing on it keep their procedural figures instead.
const GLB_YAW = 0;
const GLB_SLOTS = [{ offset: 0, every: 5, key: 'citizenWoman' },
  { offset: 1, every: 5, key: 'citizenTeen2' }, { offset: 2, every: 5, key: 'citizenOffice' },
  { offset: 3, every: 5, key: 'citizenTeen' }];
const TEEN_PAINTS = [0x3f8f7a, 0xc96f3f, 0xd9b23f, 0x5a6d8a,
  0x7a9a4f, 0x8a4f7d, 0x9aa0a8, 0x4f6db8];
// Teen copies are repainted in one flat colour; textured rows
// never are, which is what the paint list above is for.
function probeXZShape(carrierArg) {
  if (!carrierArg) return undefined;
  const pairOk = Number.isFinite(carrierArg.x) && Number.isFinite(carrierArg.z);
  if (!pairOk) return undefined;
  const foundPair = {}; foundPair.x = carrierArg.x; foundPair.z = carrierArg.z;
  return foundPair; }
function slotRowFor(spawnIdx) {
  if (!Number.isFinite(spawnIdx)) return null;
  let hitRow = null; let rowPos = 0;
  while (GLB_SLOTS.length > rowPos) { const slotEntry = GLB_SLOTS[rowPos]; rowPos = (1 + rowPos);
    if (hitRow) continue;
    if (!slotEntry) continue;
    const offNum = (slotEntry.offset || 0);
    const matches = (slotEntry.every > 0) && (offNum === (spawnIdx % slotEntry.every));
    if (matches) hitRow = slotEntry; }
  return hitRow; }
function buildLook() {
  const cutIdx = ri(0, HAIR_CUTS.length - 1);
  const cutPair = [HAIR_CUTS[cutIdx], HAIR_TONES[cutIdx]];
  const kitRec = {}; kitRec.top = pick(TOP_KINDS);
  kitRec.topColor = pick(TOP_TONES); kitRec.trim = pick(TOP_TONES);
  kitRec.pants = chance(0.6) ? 'jeans' : 'cargo';
  kitRec.pantsColor = pick(LEG_TONES);
  kitRec.shoes = pick([0xffffff, 0x222222, 0xd23b3b, 0x2e6fb7]);
  const styleRec = {}; styleRec.name = 'Pedestrian';
  styleRec.skin = pick(SKIN_TONES);
  styleRec.hair = cutPair.at(0); styleRec.hairColor = cutPair.at(1);
  styleRec.h = rr(0.9, 1.03); styleRec.build = rr(0.38, 0.7);
  styleRec.outfit = kitRec;
  return styleRec; }
function huntPavement(gmArg, srcX, srcZ, nearCap, farCap) {
  let triesLeft = 24;
  while (triesLeft > 0) { triesLeft = (triesLeft - 1);
    const runsVertical = chance(0.5);
    const linePick = runsVertical ? pick(gmArg.roadX) : pick(gmArg.roadZ);
    const sideOff = ((chance(0.5) ? 1 : -1) * -17.2);
    const alongPick = rr(-640, 640);
    // Candidate scoring used to sit in a helper of its own; it
    // is inlined here now, where the candidate itself is built.
    const tryRec = { vertical: runsVertical, line: linePick, off: sideOff };
    tryRec.x = runsVertical ? (sideOff + linePick) : alongPick;
    tryRec.z = runsVertical ? alongPick : (sideOff + linePick);
    const gapX = (tryRec.x + -srcX); const gapZ = (tryRec.z + -srcZ);
    tryRec.dist = Math.hypot(gapX, gapZ);
    const inBand = (tryRec.dist >= nearCap) && (farCap >= tryRec.dist);
    if (inBand) { const spotOut = {};
      spotOut.vertical = tryRec.vertical; spotOut.line = tryRec.line;
      spotOut.off = tryRec.off; spotOut.x = tryRec.x; spotOut.z = tryRec.z;
      return spotOut; } }
  const fbSpot = {}; fbSpot.vertical = true;
  fbSpot.line = pick(gmArg.roadX); fbSpot.off = 17.2;
  fbSpot.x = (fbSpot.line + 17.2); fbSpot.z = rr(-300, 300);
  return fbSpot; }
// Landmark payloads arrive wrapped in assorted shapes, so this
// scan pokes every plausible carrier and trusts none of them.
function scanLandmark(markArg) {
  try { if (!markArg) return null;
    const carriersList = [markArg, markArg.pos, markArg.position, markArg.at];
    let probePos = 0;
    while (carriersList.length > probePos) { const carrierNode = carriersList[probePos]; probePos = (probePos + 1);
      const hitRec = probeXZShape(carrierNode);
      if (hitRec !== undefined) return hitRec; } } catch (muteErr) {}
  return null; }
function locateMarket(gmArg) {
  let foundPt = null;
  try { const marketRec = (gmArg.landmarks || {}).market;
    if (marketRec) foundPt = scanLandmark(marketRec); } catch (muteErr) {}
  return foundPt; }
export function initPeds(game) {
  game.peds = [];
  const WAVE_TOTAL = 44;
  const glbCache = {};
  function paintTeen(rootArg, paintVal) {
    rootArg.traverse((meshNode) => {
      if (!(meshNode && meshNode.isMesh)) return;
      if (!(meshNode.material && meshNode.material.color)) return;
      meshNode.material = meshNode.material.clone();
      meshNode.material.color.setHex(paintVal); }); }
  function armShadows(rootArg) {
    rootArg.traverse((meshNode) => {
      if (meshNode && meshNode.isMesh) meshNode.castShadow = true; }); }
  function graftModel(nomad) {
    try { if (!nomad || nomad.figIsGlb || !nomad.citizenKey) return;
      const tplNode = glbCache[nomad.citizenKey];
      if (!tplNode) return;
      const wrapNode = new THREE.Group(); wrapNode.rotation.y = GLB_YAW;
      const cloneNode = tplNode.clone(true);
      if ('citizenTeen' === nomad.citizenKey) { const paintSel = TEEN_PAINTS[(nomad.idx % TEEN_PAINTS.length)];
        paintTeen(cloneNode, paintSel); }
      armShadows(wrapNode); wrapNode.add(cloneNode);
      if (nomad.visual) nomad.fig.remove(nomad.visual);
      nomad.fig.add(wrapNode); nomad.visual = wrapNode;
      nomad.glbInner = wrapNode; nomad.figIsGlb = true; } catch (muteErr) {} }
  GLB_SLOTS.forEach((slotEntry) => {
    try { const loadJob = loadHeroAsset(slotEntry.key);
      if (!loadJob || ('function' !== typeof loadJob.then)) return;
      loadJob.then((tplNode) => {
        try { if (!tplNode) return;
          glbCache[slotEntry.key] = tplNode;
          game.peds.forEach((nomad) => graftModel(nomad)); } catch (muteErr) {}
      }).catch(() => {}); } catch (muteErr) {} });
  function placeOnPavement(nomad, spotIn) {
    nomad.x = spotIn.x; nomad.z = spotIn.z;
    nomad.vertical = spotIn.vertical; nomad.line = spotIn.line; nomad.off = spotIn.off;
    nomad.dir = chance(0.5) ? 1 : -1;
    const headingPositive = (nomad.dir > 0);
    if (nomad.vertical) nomad.angle = headingPositive ? 0 : Math.PI;
    else nomad.angle = headingPositive ? (Math.PI / 2) : (-Math.PI / 2); }
  function ringThetaAmt(slotNo, ringSize) {
    const jitterAmt = rr(-0.25, 0.25);
    const sweepAmt = ((slotNo / ringSize) * Math.PI) * 2;
    return (jitterAmt + sweepAmt); }
  function placeInRing(nomad, hubX, hubZ, slotNo, ringSize) {
    const thetaAmt = ringThetaAmt(slotNo, ringSize);
    nomad.x = hubX + (Math.sin(thetaAmt) * 1.25);
    nomad.z = hubZ + (Math.cos(thetaAmt) * 1.25);
    nomad.chatCx = hubX; nomad.chatCz = hubZ;
    nomad.chat = true; nomad.idle = true;
    nomad.angle = Math.atan2((hubX + -nomad.x), (hubZ + -nomad.z)); }
  function stageCrossing(nomad, cornerX, cornerZ, signX, signZ, snapFlag) {
    nomad.mode = 'cross'; nomad.crosser = true;
    const kerbX = (signX * 17.2) + cornerX;
    const kerbZ = (signZ * 17.2) + cornerZ;
    if (snapFlag) { nomad.x = kerbX; nomad.z = kerbZ; }
    const gapAmt = Math.hypot((kerbX + -nomad.x), (kerbZ + -nomad.z));
    const farFlag = (gapAmt > 2);
    const routeRec = {}; routeRec.stage = farFlag ? 'toCorner' : 'toCurb';
    routeRec.cx = cornerX; routeRec.cz = cornerZ;
    routeRec.sx = signX; routeRec.sz = signZ; routeRec.waitT = 0;
    routeRec.tx = farFlag ? kerbX : ((signX * 17.2) + cornerX);
    routeRec.tz = farFlag ? kerbZ : ((signZ * 9) + cornerZ);
    routeRec.faceAngle = Math.atan2(-signX, 0);
    nomad.cross = routeRec;
    nomad.angle = Math.atan2((routeRec.tx + -nomad.x), (routeRec.tz + -nomad.z)); }
  function resetWalkHere(nomad) {
    let bestLine = game.roadX[0]; let bestGap = Infinity;
    game.roadX.forEach((lineVal) => {
      const gapAmt = Math.abs((nomad.x + -lineVal));
      if (bestGap > gapAmt) { bestGap = gapAmt; bestLine = lineVal; } });
    nomad.vertical = true; nomad.line = bestLine;
    nomad.off = THREE.MathUtils.clamp((nomad.x + -bestLine), -17.2, 17.2);
    if (!(Math.abs(nomad.off) >= 13)) nomad.off = (17.2 * ((0 > nomad.off) ? -1 : 1));
    nomad.x = (bestLine + nomad.off);
    nomad.dir = chance(0.5) ? 1 : -1; nomad.mode = 'walk'; }
  function bobModel(nomad, bobAmt, swayAmt, leanAmt, phaseAmt) {
    nomad.glbInner.position.y = Math.abs(Math.sin(phaseAmt)) * bobAmt;
    nomad.glbInner.rotation.z = Math.sin(phaseAmt) * swayAmt;
    nomad.glbInner.rotation.x = leanAmt; }
  function paintWalk(nomad, amtVal) {
    const modelFlag = !(!(nomad.figIsGlb && nomad.glbInner));
    if (!modelFlag) { try { animateFigure(nomad.visual, nomad.phase, amtVal); } catch (muteErr) {}
      return; }
    try { bobModel(nomad, ((amtVal + amtVal) * 0.04), 0.04, 0.05, nomad.phase); } catch (muteErr) {} }
  function paintIdle(nomad) {
    const modelFlag = !(!(nomad.figIsGlb && nomad.glbInner));
    if (!modelFlag) { try { animateFigure(nomad.visual, (0.7 * nomad.sway), 0.12); } catch (muteErr) {}
      return; }
    try { const innerNode = nomad.glbInner;
      innerNode.position.y = (0.006 * Math.sin((nomad.idx + (nomad.sway * 1.5))));
      innerNode.rotation.z = (0.01 * Math.sin((nomad.idx + (nomad.sway * 0.9))));
      innerNode.rotation.x = 0; } catch (muteErr) {} }
  function seedPedFields(nomad, figNode, idxNo, keyVal) {
    nomad.fig = null; nomad.visual = figNode;
    nomad.glbInner = null; nomad.figIsGlb = false;
    nomad.citizenKey = keyVal; nomad.idx = idxNo;
    nomad.angle = 0; nomad.x = 0; nomad.z = 0;
    // The old standalone motion seeder is folded in here: gait
    // speed, phase and pavement defaults are all planted inline.
    nomad.speed = rr(1.2, 1.8); nomad.phase = rr(0, 10);
    nomad.dir = 1; nomad.vertical = true;
    nomad.line = 0; nomad.off = 17.2; nomad.sway = rr(0, 6);
    nomad.idle = false; nomad.panicT = 0;
    nomad.fleeDir = null; nomad.startleT = 0; nomad.fleeT = 0;
    nomad.chat = false; nomad.mode = 'walk';
    nomad.follow = null; nomad.scattered = false;
    nomad.chatGroup = null; nomad.crosser = false;
    nomad.cross = null; nomad.marketPlaced = false;
    return nomad; }
  function buildPedShell(figNode, idxNo, keyVal) {
    const nomad = seedPedFields({}, figNode, idxNo, keyVal);
    const shellGrp = new THREE.Group(); shellGrp.add(figNode);
    nomad.fig = shellGrp;
    return nomad; }
  function pairHomes() {
    const homesOut = [];
    homesOut.push({ x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 }, { x: -330, z: -330 });
    homesOut.push({ x: -412.5, z: 412.5 }, { x: 0, z: 0 }, { x: 250, z: 420 }, { x: -480, z: -255 });
    return homesOut; }
  function strollHomes() {
    return [{ x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 }, { x: -330, z: -330 },
      { x: -412.5, z: 412.5 }, { x: 0, z: 0 }, { x: 250, z: 420 }, { x: -480, z: -255 }]; }
  function mountPhone(figureArg) {
    try { const phoneGeo = new THREE.BoxGeometry(0.09, 0.16, 0.02);
      const phoneMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.4, emissive: 0x2a4a6a, emissiveIntensity: 0.7 });
      const phoneNode = new THREE.Mesh(phoneGeo, phoneMat);
      phoneNode.position.x = 0.22; phoneNode.position.y = 1.05; phoneNode.position.z = 0.22;
      figureArg.add(phoneNode); } catch (muteErr) {} }
  let spawnNo = 0;
  while (WAVE_TOTAL > spawnNo) { const idxNo = spawnNo; spawnNo = (spawnNo + 1);
    let figNode = null;
    try { figNode = makeFigure(buildLook()); } catch (muteErr) { continue; }
    const claimedRow = slotRowFor(idxNo);
    const nomad = buildPedShell(figNode, idxNo, claimedRow ? claimedRow.key : null);
    if (12 > idxNo) { nomad.idle = true;
      if (!(idxNo >= 3)) placeInRing(nomad, -410, 418, idxNo, 3);
      else if (!(idxNo >= 6)) placeInRing(nomad, 330, -330, (idxNo + -3), 3);
      else if (!(idxNo >= 9)) placeInRing(nomad, 182.2, 147.8, (idxNo + -6), 3);
      else { nomad.chatGroup = 'market';
        const marketPt = locateMarket(game);
        if (marketPt) { placeInRing(nomad, (13 + marketPt.x), (9 + marketPt.z), (idxNo + -9), 3); nomad.marketPlaced = true; }
        else placeInRing(nomad, -312.8, -147.8, (idxNo + -9), 3); }
      if ((1 === idxNo) || (4 === idxNo)) mountPhone(figNode);
    } else if (24 > idxNo) {
      if (0 === (idxNo % 2)) { const homeSel = pick(pairHomes());
        placeOnPavement(nomad, huntPavement(game, homeSel.x, homeSel.z, 0, 190));
      } else { const leaderRec = game.peds[(game.peds.length + -1)];
        nomad.follow = leaderRec || null;
        if (!leaderRec) { const homePick = pick(pairHomes());
          placeOnPavement(nomad, huntPavement(game, homePick.x, homePick.z, 0, 190));
        } else { nomad.x = ((leaderRec.x + -(Math.sin(leaderRec.angle) * 2.3)) + (Math.cos(leaderRec.angle) * 0.85));
          nomad.z = ((leaderRec.z + -(Math.cos(leaderRec.angle) * 2.3)) + -(Math.sin(leaderRec.angle) * 0.85));
          nomad.angle = leaderRec.angle; nomad.speed = leaderRec.speed; } }
    } else if (32 > idxNo) {
      const cornerX = pick([-330, -165, 0, 165, 330]);
      const cornerZ = pick([-330, -165, 0, 165, 330]);
      stageCrossing(nomad, cornerX, cornerZ, chance(0.5) ? 1 : -1, chance(0.5) ? 1 : -1, true);
    } else { const homeSel = pick(strollHomes());
      placeOnPavement(nomad, huntPavement(game, homeSel.x, homeSel.z, 0, 190)); }
    armShadows(nomad.fig);
    nomad.fig.position.set(nomad.x, groundH(nomad.x, nomad.z), nomad.z);
    nomad.fig.rotation.y = nomad.angle;
    game.scene.add(nomad.fig); game.peds.push(nomad);
    graftModel(nomad); }
  // The crowd topped up below never receives a model; those
  // figures stay procedural from creation through to placement.
  function spawnBonusPed() {
    let figNode = null;
    try { figNode = makeFigure(buildLook()); } catch (muteErr) { return null; }
    const shellNode = new THREE.Group(); shellNode.add(figNode);
    armShadows(shellNode);
    // Bonus figures spell their fields out longhand rather than
    // borrowing the wave seeder; the two crowds stay separate.
    const nomad = {}; nomad.fig = shellNode; nomad.visual = figNode;
    nomad.glbInner = null; nomad.figIsGlb = false; nomad.citizenKey = null;
    nomad.idx = game.peds.length;
    nomad.angle = 0; nomad.x = 0; nomad.z = 0;
    nomad.speed = rr(1.2, 1.8); nomad.phase = rr(0, 10);
    nomad.dir = 1; nomad.vertical = true;
    nomad.line = 0; nomad.off = 17.2;
    nomad.idle = false; nomad.panicT = 0; nomad.sway = rr(0, 6);
    nomad.fleeDir = null; nomad.startleT = 0; nomad.fleeT = 0;
    nomad.chat = false; nomad.mode = 'walk';
    nomad.follow = null; nomad.scattered = false;
    nomad.chatGroup = null; nomad.crosser = false;
    nomad.cross = null; nomad.marketPlaced = false;
    return nomad; }
  function placeBonusPed(nomad) {
    if (!nomad) return;
    nomad.fig.position.set(nomad.x, groundH(nomad.x, nomad.z), nomad.z);
    nomad.fig.rotation.y = nomad.angle;
    game.scene.add(nomad.fig); game.peds.push(nomad); }
  function placeStanding(nomad, standX, standZ, headingVal) {
    nomad.x = standX; nomad.z = standZ;
    nomad.idle = true; nomad.chat = true;
    nomad.chatCx = (Math.sin(headingVal) * 3) + standX;
    nomad.chatCz = (Math.cos(headingVal) * 3) + standZ;
    nomad.angle = headingVal; }
  function placeLaneWalker(nomad, laneOff, loVal, hiVal, dirVal) {
    nomad.vertical = false; nomad.line = 495; nomad.off = laneOff;
    nomad.x = rr(loVal, hiVal); nomad.z = (495 + laneOff);
    nomad.dir = dirVal;
    nomad.angle = (0 < dirVal) ? (Math.PI / 2) : (-Math.PI / 2);
    nomad.mode = 'walk'; nomad.idle = false; }
  const RESERVE_SPOTS = [{ x: 100, z: 511, ry: 0, stall: false },
    { x: 300, z: 552, ry: 0, stall: false }, { x: -60, z: -238, ry: 0, stall: false },
    { x: -210, z: 481, ry: 0, stall: false }];
  let gatheredList = null;
  try { if (Array.isArray(game.gatherSpots) && game.gatherSpots.length) gatheredList = game.gatherSpots; } catch (muteErr) {}
  const activeSpots = gatheredList || RESERVE_SPOTS;
  function frameForSpot(spotIn) {
    const yawAmt = Number.isFinite(spotIn.ry) ? spotIn.ry : 0;
    const basisRec = {}; basisRec.yaw = yawAmt;
    basisRec.fwdX = Math.sin(yawAmt); basisRec.fwdZ = Math.cos(yawAmt);
    basisRec.sideX = Math.cos(yawAmt); basisRec.sideZ = -Math.sin(yawAmt);
    return basisRec; }
  activeSpots.forEach((spotIn) => {
    if (!spotIn || !Number.isFinite(spotIn.x) || !Number.isFinite(spotIn.z)) return;
    const basisRec = frameForSpot(spotIn);
    const ringHubX = (basisRec.sideX * 4.5) + spotIn.x;
    const ringHubZ = (basisRec.sideZ * 4.5) + spotIn.z;
    let ringNo = 0;
    while (3 > ringNo) { const bonusPed = spawnBonusPed();
      if (bonusPed) { placeInRing(bonusPed, ringHubX, ringHubZ, ringNo, 3); placeBonusPed(bonusPed); }
      ringNo = (ringNo + 1); }
    [-1, 1].forEach((sideAmt) => {
      const bonusPed = spawnBonusPed();
      if (bonusPed) { placeStanding(bonusPed, (spotIn.x + -(basisRec.fwdX * 3.5)) + (basisRec.sideX * sideAmt * 2.2), (spotIn.z + -(basisRec.fwdZ * 3.5)) + (basisRec.sideZ * sideAmt * 2.2), basisRec.yaw);
        placeBonusPed(bonusPed); } });
    if (spotIn.stall) { [-1, 1].forEach((sideAmt) => {
        const bonusPed = spawnBonusPed();
        if (bonusPed) { placeStanding(bonusPed, (spotIn.x + (basisRec.fwdX * 1.9)) + (basisRec.sideX * sideAmt * 0.95), (spotIn.z + (basisRec.fwdZ * 1.9)) + (basisRec.sideZ * sideAmt * 0.95), (Math.PI + basisRec.yaw));
          placeBonusPed(bonusPed); } });
      const vendorPed = spawnBonusPed();
      if (vendorPed) { placeStanding(vendorPed, (spotIn.x + -(basisRec.fwdX * 1.6)), (spotIn.z + -(basisRec.fwdZ * 1.6)), basisRec.yaw); placeBonusPed(vendorPed); } } });
  activeSpots.forEach((spotIn) => {
    if (!spotIn || !spotIn.stall) return;
    if (!Number.isFinite(spotIn.x) || !Number.isFinite(spotIn.z)) return;
    const basisRec = frameForSpot(spotIn);
    let queueNo = 0;
    while (2 > queueNo) { const queuedPed = spawnBonusPed();
      if (queuedPed) { const backStep = ((0.9 * (queueNo + 1)) + 1.9);
        const wobbleAmt = (0 === queueNo) ? -0.18 : 0.22;
        placeStanding(queuedPed, (spotIn.x + (basisRec.fwdX * backStep)) + (basisRec.sideX * wobbleAmt), (spotIn.z + (basisRec.fwdZ * backStep)) + (basisRec.sideZ * wobbleAmt), (Math.PI + basisRec.yaw));
        placeBonusPed(queuedPed); }
      queueNo = (queueNo + 1); } });
  const LANE_ROWS = [{ off: -9, n: 8, xMin: -420, xMax: 560 },
    { off: 10, n: 7, xMin: -420, xMax: 560 }, { off: 57, n: 5, xMin: -380, xMax: 600 }];
  LANE_ROWS.forEach((laneRow) => {
    let laneNo = 0;
    while (laneRow.n > laneNo) { const lanePed = spawnBonusPed();
      if (lanePed) { placeLaneWalker(lanePed, laneRow.off, laneRow.xMin, laneRow.xMax, (0 === (laneNo % 2)) ? 1 : -1); placeBonusPed(lanePed); }
      laneNo = (laneNo + 1); } });
  let martNo = 0;
  while (4 > martNo) { const martPed = spawnBonusPed();
    if (martPed) { placeInRing(martPed, -79.5, -251, martNo, 4); placeBonusPed(martPed); }
    martNo = (martNo + 1); }
  let dtNo = 0;
  while (4 > dtNo) { const dtPed = spawnBonusPed();
    if (dtPed) { placeOnPavement(dtPed, huntPavement(game, 0, 0, 0, 70)); placeBonusPed(dtPed); }
    dtNo = (dtNo + 1); }
  let dtMoreNo = 0;
  while (4 > dtMoreNo) { const dtMorePed = spawnBonusPed();
    if (dtMorePed) { placeOnPavement(dtMorePed, huntPavement(game, 0, 0, 0, 70)); placeBonusPed(dtMorePed); }
    dtMoreNo = (dtMoreNo + 1); }
  // The get-together cluster that anchors itself on the park.
  { let parkSpotRec = { x: 82, z: 415, stallX: (32 + 82), stallZ: (8 + 415) };
    try { const liveParkSpot = game.parkSpot;
      if (liveParkSpot && Number.isFinite(liveParkSpot.x) && Number.isFinite(liveParkSpot.z)) {
        const rebuiltSpot = {}; rebuiltSpot.x = liveParkSpot.x; rebuiltSpot.z = liveParkSpot.z;
        rebuiltSpot.stallX = Number.isFinite(liveParkSpot.stallX) ? liveParkSpot.stallX : (32 + liveParkSpot.x);
        rebuiltSpot.stallZ = Number.isFinite(liveParkSpot.stallZ) ? liveParkSpot.stallZ : (8 + liveParkSpot.z);
        parkSpotRec = rebuiltSpot; } } catch (muteErr) {}
    const parkHubX = parkSpotRec.x; const parkHubZ = parkSpotRec.z;
    let benchNo = 0;
    while (3 > benchNo) { const benchPed = spawnBonusPed();
      if (benchPed) { placeInRing(benchPed, (10 + parkHubX), (6 + parkHubZ), benchNo, 3); placeBonusPed(benchPed); }
      benchNo = (benchNo + 1); }
    let benchMoreNo = 0;
    while (3 > benchMoreNo) { const benchMorePed = spawnBonusPed();
      if (benchMorePed) { placeInRing(benchMorePed, (parkHubX + -10), (parkHubZ + -6), benchMoreNo, 3); placeBonusPed(benchMorePed); }
      benchMoreNo = (benchMoreNo + 1); }
    const parkVendor = spawnBonusPed();
    if (parkVendor) { placeStanding(parkVendor, (0.9 + parkSpotRec.stallX), parkSpotRec.stallZ, (-Math.PI / 2)); placeBonusPed(parkVendor); }
    [-1, 1].forEach((sideAmt) => {
      const custPed = spawnBonusPed();
      if (custPed) { placeStanding(custPed, (parkSpotRec.stallX + -2.6), (parkSpotRec.stallZ + (sideAmt * 0.95)), (Math.PI / 2)); placeBonusPed(custPed); } });
    const duoSpecs = [[16, 0, Math.PI / 2], [0, 16, 0]];
    duoSpecs.forEach((duoSpec) => {
      const [duoDx, duoDz] = duoSpec; const duoFacing = duoSpec[2];
      [-1, 1].forEach((sideAmt) => {
        const duoPed = spawnBonusPed();
        if (duoPed) { const splitAmt = (sideAmt * 0.85);
          placeStanding(duoPed, ((duoDx + parkHubX) + ((duoFacing !== 0) ? splitAmt : 0)), ((duoDz + parkHubZ) + ((duoFacing === 0) ? splitAmt : 0)), (duoFacing + ((0 < sideAmt) ? Math.PI : 0)));
          placeBonusPed(duoPed); } }); });
    const walkSpecs = [[-1.5, -20, 1], [1.5, 18, -1]];
    walkSpecs.forEach((walkSpec) => {
      const strollerPed = spawnBonusPed();
      const [walkOff, walkDz, walkDir] = walkSpec;
      if (strollerPed) { strollerPed.vertical = true;
        strollerPed.line = parkHubX; strollerPed.off = walkSpec[0];
        strollerPed.x = (walkOff + parkHubX); strollerPed.z = (walkDz + parkHubZ);
        strollerPed.dir = walkDir;
        strollerPed.angle = (0 < walkDir) ? 0 : Math.PI;
        strollerPed.mode = 'walk'; strollerPed.idle = false;
        placeBonusPed(strollerPed); } }); }
  // A horn going off makes nearby standers jump, and whoever is
  // close to a road line runs from the sound; best effort only.
  game.pedsStartle = function pedsStartle(hitX, hitZ, radiusIn) {
    try { if (!Array.isArray(game.peds)) return;
      if (!Number.isFinite(hitX) || !Number.isFinite(hitZ)) return;
      const reachAmt = (Number.isFinite(radiusIn) && (0 < radiusIn)) ? radiusIn : 12;
      const nearLine = (coordVal, linesArr) => Array.isArray(linesArr) && linesArr.some((lineVal) => !(Math.abs((coordVal + -lineVal)) > 20));
      game.peds.forEach((nomad) => {
        if (!nomad || nomad.downed) return;
        const awayX = (nomad.x + -hitX); const awayZ = (nomad.z + -hitZ);
        const distAmt = Math.hypot(awayX, awayZ);
        if (distAmt > reachAmt) return;
        nomad.startleT = 0.25;
        const onRoad = nearLine(nomad.x, game.roadX) || nearLine(nomad.z, game.roadZ);
        const fleeing = (nomad.fleeT > 0) && nomad.fleeDir;
        if (!(onRoad || fleeing)) return;
        const denomAmt = (distAmt > 0.001) ? distAmt : 1;
        nomad.fleeDir = (distAmt > 0.001) ? { x: (awayX / denomAmt), z: (awayZ / denomAmt) } : { x: 1, z: 0 };
        nomad.fleeT = Math.max((nomad.fleeT || 0), 0.8); }); } catch (muteErr) {} };
  game.updaters.push((frameArg, dtAmt) => {
    const heroX = game.car ? game.car.x : game.player.x;
    const heroZ = game.car ? game.car.z : game.player.z;
    const fastCar = Boolean(game.car && game.flags.inCar && ((game.speedKmh || 0) > 40));
    function setFigPose(nomad, hopAmt) {
      nomad.fig.position.set(nomad.x, (hopAmt + groundH(nomad.x, nomad.z)), nomad.z);
      nomad.fig.rotation.y = nomad.angle; }
    // One pedestrian's whole per-frame decision tree, lifted out
    // of the sweep so the loop body below is nothing but a pass.
    function stepWalker(nomad) {
      const heroGap = Math.hypot((nomad.x + -heroX), (nomad.z + -heroZ));
      let hopAmt = 0;
      if (nomad.startleT > 0) { nomad.startleT = (nomad.startleT + -dtAmt);
        const fracDone = Math.min(1, Math.max(0, (1 + -(nomad.startleT / 0.25))));
        hopAmt = (0.14 * Math.sin(Math.PI * fracDone)); }
      if (nomad.downed) { nomad.downedT = ((nomad.downedT || 0) + -dtAmt);
        if (nomad.downedT > 0) return;
        nomad.downed = false; nomad._tipped = false; nomad.hp = 100;
        try { nomad.fig.rotation.set(0, nomad.angle, 0); } catch (muteErr) {}
        placeOnPavement(nomad, huntPavement(game, heroX, heroZ, 60, 180));
        nomad.chat = false; nomad.idle = false; nomad.mode = 'walk';
        nomad.follow = null; nomad.scattered = false;
        nomad.fig.position.set(nomad.x, groundH(nomad.x, nomad.z), nomad.z);
        nomad.fig.rotation.y = nomad.angle;
        return; }
      if ((nomad.fleeT > 0) && nomad.fleeDir) {
        if (nomad.chat) nomad.scattered = true;
        nomad.fleeT = (nomad.fleeT + -dtAmt);
        nomad.x = ((nomad.fleeDir.x * 3.4) * dtAmt) + nomad.x;
        nomad.z = ((nomad.fleeDir.z * 3.4) * dtAmt) + nomad.z;
        nomad.angle = Math.atan2(nomad.fleeDir.x, nomad.fleeDir.z);
        nomad.phase = (((3.4 * dtAmt) * 2.4) + nomad.phase);
        if (!(nomad.figIsGlb && nomad.glbInner)) { try { animateFigure(nomad.visual, nomad.phase, 1.6); } catch (muteErr) {}
        } else { try { bobModel(nomad, 0.06, 0.05, 0.13, nomad.phase); } catch (muteErr) {} }
        setFigPose(nomad, hopAmt);
        return; }
      if (nomad.scattered) { nomad.scattered = false;
        nomad.chat = false; nomad.idle = false;
        resetWalkHere(nomad); }
      if ((350 < heroGap) && !nomad.chat && ('cross' !== nomad.mode) && !nomad.follow) {
        placeOnPavement(nomad, huntPavement(game, heroX, heroZ, 150, 250));
        nomad.idle = false; }
      if (nomad.idle) { nomad.sway = (nomad.sway + dtAmt);
        if (nomad.chat) {
          if (('market' === nomad.chatGroup) && !nomad.marketPlaced) { const marketPt = locateMarket(game);
            if (marketPt) { placeInRing(nomad, (13 + marketPt.x), (9 + marketPt.z), (nomad.idx % 3), 3); nomad.marketPlaced = true; } }
          nomad.angle = Math.atan2((nomad.chatCx + -nomad.x), (nomad.chatCz + -nomad.z));
          const talkAmt = (0.5 + (0.5 * Math.sin(((nomad.idx * 2.1) + (nomad.sway * 0.33)))));
          if (!(nomad.figIsGlb && nomad.glbInner)) { try { animateFigure(nomad.visual, (0.7 * nomad.sway), ((talkAmt * 0.2) + 0.12)); } catch (muteErr) {}
          } else { try { nomad.glbInner.position.y = ((talkAmt * 0.008) + 0.006) * Math.sin(((nomad.sway * 1.5) + nomad.idx));
              nomad.glbInner.rotation.z = ((talkAmt * 0.014) + 0.01) * Math.sin(((nomad.sway * 0.9) + nomad.idx));
              nomad.glbInner.rotation.x = 0; } catch (muteErr) {} }
          nomad.fig.position.set(nomad.x, (hopAmt + groundH(nomad.x, nomad.z)), nomad.z);
          nomad.fig.rotation.y = ((Math.sin(nomad.sway * 0.4) * 0.15) + nomad.angle);
          return; }
        if (!(nomad.figIsGlb && nomad.glbInner)) { try { animateFigure(nomad.visual, (0.7 * nomad.sway), 0.12); } catch (muteErr) {}
        } else { try { nomad.glbInner.position.y = (0.006 * Math.sin(((nomad.sway * 1.5) + nomad.idx)));
            nomad.glbInner.rotation.z = (0.01 * Math.sin(((nomad.sway * 0.9) + nomad.idx)));
            nomad.glbInner.rotation.x = 0; } catch (muteErr) {} }
        nomad.fig.position.set(nomad.x, (hopAmt + groundH(nomad.x, nomad.z)), nomad.z);
        nomad.fig.rotation.y = ((Math.sin(nomad.sway * 0.4) * 0.15) + nomad.angle);
        return; }
      if (nomad.follow) { const leaderRec = nomad.follow;
        if (!leaderRec || leaderRec.downed) { nomad.sway = (nomad.sway + dtAmt);
          paintIdle(nomad); setFigPose(nomad, hopAmt);
          return; }
        const trailX = ((leaderRec.x + -(Math.sin(leaderRec.angle) * 2.3)) + (Math.cos(leaderRec.angle) * 0.85));
        const trailZ = ((leaderRec.z + -(Math.cos(leaderRec.angle) * 2.3)) + -(Math.sin(leaderRec.angle) * 0.85));
        const trailGap = Math.hypot((trailX + -nomad.x), (trailZ + -nomad.z));
        if (trailGap > 25) { nomad.x = trailX; nomad.z = trailZ; }
        else { const easeAmt = Math.min(1, (4.5 * dtAmt));
          nomad.x = (((trailX + -nomad.x) * easeAmt) + nomad.x);
          nomad.z = (((trailZ + -nomad.z) * easeAmt) + nomad.z); }
        nomad.angle = leaderRec.angle; nomad.phase = leaderRec.phase;
        if (trailGap > 0.25) paintWalk(nomad, 0.55);
        setFigPose(nomad, hopAmt);
        return; }
      if (('cross' === nomad.mode) && nomad.cross) { const routeRec = nomad.cross;
        if ('wait' === routeRec.stage) { routeRec.waitT = (routeRec.waitT + -dtAmt);
          nomad.sway = (nomad.sway + dtAmt); paintIdle(nomad);
          nomad.fig.position.set(nomad.x, (hopAmt + groundH(nomad.x, nomad.z)), nomad.z);
          nomad.fig.rotation.y = ((Math.sin(nomad.sway * 1.7) * 0.55) + routeRec.faceAngle);
          if (!(routeRec.waitT > 0)) { routeRec.stage = 'cross'; routeRec.tx = (routeRec.cx + -(routeRec.sx * 17.2)); routeRec.tz = ((routeRec.sz * 9) + routeRec.cz); }
          return; }
        const stepX = (routeRec.tx + -nomad.x); const stepZ = (routeRec.tz + -nomad.z);
        const stepGap = Math.hypot(stepX, stepZ);
        const speedNow = (('cross' === routeRec.stage) ? 1.2 : 1) * nomad.speed;
        if (stepGap < 0.35) {
          if ('toCorner' === routeRec.stage) { routeRec.stage = 'toCurb';
            routeRec.tx = ((routeRec.sx * 17.2) + routeRec.cx);
            routeRec.tz = ((routeRec.sz * 9) + routeRec.cz);
          } else if ('toCurb' === routeRec.stage) { routeRec.stage = 'wait';
            routeRec.waitT = rr(1.4, 3.8); nomad.sway = rr(0, 6);
          } else if ('cross' === routeRec.stage) { routeRec.stage = 'toWalk';
            routeRec.tx = (routeRec.cx + -(routeRec.sx * 17.2));
            routeRec.tz = ((routeRec.sz * 17.2) + routeRec.cz);
          } else { nomad.mode = 'walk'; nomad.vertical = true;
            nomad.line = routeRec.cx; nomad.off = (-routeRec.sx * 17.2);
            nomad.x = (nomad.off + routeRec.cx);
            nomad.dir = (0 < routeRec.sz) ? 1 : -1; nomad.cross = null; }
        } else { const moveAmt = Math.min(stepGap, (speedNow * dtAmt));
          nomad.x = (((stepX / stepGap) * moveAmt) + nomad.x);
          nomad.z = (((stepZ / stepGap) * moveAmt) + nomad.z);
          nomad.angle = Math.atan2(stepX, stepZ);
          nomad.phase = (((speedNow * dtAmt) * 2.4) + nomad.phase);
          paintWalk(nomad, 0.55); }
        setFigPose(nomad, hopAmt);
        return; }
      if (fastCar && (heroGap < 6)) nomad.panicT = 0.9;
      let paceAmt = nomad.speed; let lateralAmt = 0;
      if (nomad.panicT > 0) { nomad.panicT = (nomad.panicT + -dtAmt);
        paceAmt = (2.1 * nomad.speed);
        const awaySign = Math.sign((((nomad.x + -heroX) * Math.cos(nomad.angle)) + -((nomad.z + -heroZ) * Math.sin(nomad.angle)))) || 1;
        lateralAmt = (2.4 * awaySign); }
      if (nomad.startleT > 0) paceAmt = 0;
      const fwdAmt = (paceAmt * nomad.dir) * dtAmt;
      if (!nomad.vertical) { nomad.x = (fwdAmt + nomad.x); nomad.z = ((nomad.line + nomad.off) + ((lateralAmt * dtAmt) * 3)); }
      else { nomad.z = (fwdAmt + nomad.z); nomad.x = ((nomad.line + nomad.off) + ((lateralAmt * dtAmt) * 3)); }
      nomad.phase = (((paceAmt * dtAmt) * 2.4) + nomad.phase);
      const crossLines = nomad.vertical ? game.roadZ : game.roadX;
      const alongCoord = nomad.vertical ? nomad.z : nomad.x;
      let replanned = false;
      for (const lineVal of crossLines) {
        if (nomad.crosser && (Math.abs((alongCoord + -lineVal)) < 1.2) && chance(0.30)) {
          if (nomad.vertical) stageCrossing(nomad, nomad.line, lineVal, (Math.sign(nomad.off) || 1), nomad.dir);
          else stageCrossing(nomad, lineVal, nomad.line, nomad.dir, (Math.sign(nomad.off) || 1));
          replanned = true; break; }
        if ((Math.abs((alongCoord + -lineVal)) < 1.2) && chance(0.012)) {
          const oldLine = nomad.line; const oldOff = nomad.off;
          nomad.vertical = !(nomad.vertical); nomad.line = lineVal;
          nomad.off = ((chance(0.5) ? -1 : 1) * 17.2);
          nomad.dir = chance(0.5) ? 1 : -1;
          if (!nomad.vertical) { nomad.z = (nomad.off + nomad.line); nomad.x = (oldOff + oldLine); }
          else { nomad.x = (nomad.off + nomad.line); nomad.z = (oldOff + oldLine); }
          break; } }
      if (replanned) { setFigPose(nomad, hopAmt); return; }
      if ((nomad.x > 640) || (-640 > nomad.x) || (nomad.z > 640) || (-640 > nomad.z)) {
        nomad.dir = (-1 * nomad.dir);
        nomad.x = THREE.MathUtils.clamp(nomad.x, -638, 638);
        nomad.z = THREE.MathUtils.clamp(nomad.z, -638, 638); }
      if (nomad.vertical) nomad.angle = (0 < nomad.dir) ? 0 : Math.PI;
      else nomad.angle = (0 < nomad.dir) ? (Math.PI / 2) : (-Math.PI / 2);
      if (!game.flags.inCar && (heroGap > 0.001) && (heroGap < 1.1)) {
        const pushAmt = (((1.1 + -heroGap) * 2.2) * dtAmt);
        nomad.x = ((((nomad.x + -heroX) / heroGap) * pushAmt) + nomad.x);
        nomad.z = ((((nomad.z + -heroZ) / heroGap) * pushAmt) + nomad.z); }
      if (!(nomad.figIsGlb && nomad.glbInner)) { try { animateFigure(nomad.visual, nomad.phase, (nomad.panicT > 0) ? 1.6 : 0.55); } catch (muteErr) {}
      } else { try { const panicFlag = (nomad.panicT > 0);
          let bobAmt = (0.04 * Math.abs(Math.sin(nomad.phase)));
          if (panicFlag) bobAmt = ((Math.abs(Math.sin(nomad.phase * 1.7)) * 0.06) + bobAmt);
          nomad.glbInner.position.y = bobAmt;
          nomad.glbInner.rotation.z = (panicFlag ? 0.05 : 0.04) * Math.sin(nomad.phase);
          nomad.glbInner.rotation.x = panicFlag ? 0.10 : 0.05; } catch (muteErr) {} }
      setFigPose(nomad, hopAmt); }
    game.peds.forEach((nomad) => stepWalker(nomad)); });
}
