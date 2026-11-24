// The mission chain of Ronin Bay — givers, beacons, checkpoints, rivals, the garage.
import * as THREE from 'three';
import { CFG, DISTRICTS, CARS, CAST, MISSIONS } from './config.js';
import { chance, pick, ri, rr } from './random.js';
import { roadRoute, glowSprite, groundH } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';

const portPt = {};
portPt.x = -412.5; portPt.z = 470;
const coralPt = {};
coralPt.x = 495; coralPt.z = 495;
const neonPt = {};
neonPt.x = 330; neonPt.z = -330;
const hoshinoPt = {};
hoshinoPt.x = -90; hoshinoPt.z = -380;
const SPOT_MAP = { port: portPt, coral: coralPt, neon: neonPt, hoshino: hoshinoPt };

const spotOf = (keyIn) => { return SPOT_MAP[keyIn] || SPOT_MAP.port; };

const REP_LADDER = [0, 40, 110, 220, 380, 600, 900];

const HQ_GARAGE = {};
HQ_GARAGE.x = -412.5;
HQ_GARAGE.z = 455;

const angleWrap = (wantAng, haveAng) => {
  let remVal = wantAng - haveAng;
  for (; remVal > Math.PI;) remVal -= Math.PI * 2;
  for (; -Math.PI > remVal;) remVal += Math.PI * 2;
  return remVal;
};

const spanBetween = (axIn, azIn, bxIn, bzIn) => { return Math.hypot(axIn - bxIn, azIn - bzIn); };

const MINUTE_SECS = 60;

const clockLabelM = (rawIn) => {
  const ceilVal = Math.max(0, Math.ceil(rawIn));
  const minsM = Math.floor(ceilVal / MINUTE_SECS);
  const secsM = String(ceilVal % MINUTE_SECS).padStart(2, '0'); return minsM + ':' + secsM;
};

const actorPoint = (G) => {
  let entIn;
  if (G.car && G.flags.inCar) entIn = G.car; else entIn = G.player;
  const ptOut = { x: entIn.x, z: entIn.z };
  return ptOut;
};

const makeBadgeSprite = (glyphIn, fillIn) => {
  const cvNode = document.createElement('canvas');
  cvNode.width = 128; cvNode.height = 128;
  const brush = cvNode.getContext('2d');
  brush.fillStyle = fillIn || '#ffd23f';
  brush.beginPath(); brush.arc(64, 64, 52, 0, Math.PI * 2); brush.fill();
  brush.lineWidth = 7; brush.strokeStyle = '#14100a'; brush.stroke();
  brush.fillStyle = '#14100a'; brush.font = 'bold 64px Arial, sans-serif';
  brush.textAlign = 'center'; brush.textBaseline = 'middle';
  brush.fillText(glyphIn || '!', 64, 68);
  const texNode = new THREE.CanvasTexture(cvNode);
  const matCfg = {};
  matCfg.map = texNode; matCfg.transparent = true; matCfg.depthTest = false;
  const sprNode = new THREE.Sprite(new THREE.SpriteMaterial(matCfg));
  sprNode.scale.set(3.2, 3.2, 1);
  return sprNode;
};

const arcLengths = (pathIn) => {
  const accArr = [0];
  let walkIdx = accArr.length;
  while (walkIdx < pathIn.length) {
    const herePt = pathIn[walkIdx]; const prevPt = pathIn[walkIdx - 1];
    accArr.push(accArr[walkIdx - 1] + spanBetween(herePt.x, herePt.z, prevPt.x, prevPt.z));
    walkIdx++;
  }
  return accArr;
};

const pointAtArcLen = (pathIn, accArr, wantDist) => {
  let segIdx = 1;
  for (; segIdx < accArr.length - 1 && accArr[segIdx] < wantDist;) segIdx++;
  const segLen = accArr[segIdx] - accArr[segIdx - 1] || 1;
  const fracVal = (wantDist - accArr[segIdx - 1]) / segLen;
  const fromPtIn = pathIn[segIdx - 1]; const toPtIn = pathIn[segIdx];
  const ptOut = { x: fromPtIn.x + (toPtIn.x - fromPtIn.x) * fracVal, z: fromPtIn.z + (toPtIn.z - fromPtIn.z) * fracVal };
  return ptOut;
};

const buildCheckpoints = (G, fromPt, toPt, wantCount) => {
  const routeRaw = roadRoute(G, fromPt, toPt) || [fromPt, toPt];
  const cleanArr = [];
  routeRaw.forEach(function (rawPt) {
    const cleanPt = {};
    cleanPt.x = rawPt.x; cleanPt.z = rawPt.z;
    cleanArr.push(cleanPt);
  });
  if (!(cleanArr.length > 0)) {
    const onlyPt = {};
    onlyPt.x = toPt.x; onlyPt.z = toPt.z;
    return [onlyPt];
  }
  const lensArr = arcLengths(cleanArr);
  const totalLen = lensArr[lensArr.length - 1] || 1;
  const autoNum = Math.max(2, Math.round(totalLen / 120));
  const finalNum = Math.max(1, wantCount || autoNum);
  const pickedArr = [];
  let stepIdx = 1;
  while (stepIdx <= finalNum) { pickedArr.push(pointAtArcLen(cleanArr, lensArr, totalLen * stepIdx / finalNum)); stepIdx++; }
  const endPt = {};
  endPt.x = toPt.x; endPt.z = toPt.z;
  pickedArr[pickedArr.length - 1] = endPt;
  return pickedArr;
};

export const initMissions = (G) => {
  G.objective = null; G.missionIndex = G.missionIndex || 0;
  G.missionProg = ''; G.driftScore = 0;
  G.garageList = []; G.flags.garageOpen = !!G.flags.garageOpen;
  const S = {};
  S.phase = 'giver'; S.giverFig = null; S.giverMission = null; S.beacon = null; S.beaconLetter = null;
  S.chain = null; S.rush = null; S.rushTimer = 55; S.incomeT = 60; S.ePrev = false; S.numPrev = {};
  S.prevPX = 0; S.prevPZ = 0; S.currentCarId = (G.garage && G.garage[0]) || 'hachi'; S.zoneRing = null;

  const beaconMat = () => {
    const matIn = new THREE.MeshBasicMaterial();
    matIn.color = new THREE.Color(0xffd23f); matIn.transparent = true;
    matIn.opacity = 0.35; matIn.blending = THREE.AdditiveBlending;
    matIn.depthWrite = false; matIn.side = THREE.DoubleSide;
    return matIn;
  };

  const makeBeacon = () => {
    const rootGrp = new THREE.Group();
    const pillarMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 20, 1, true), beaconMat());
    pillarMesh.position.y = 7; rootGrp.add(pillarMesh);
    try { const haloNode = glowSprite(0xffd23f, 5.4);
      haloNode.position.y = 1.2; rootGrp.add(haloNode);
    } catch (skip) {}
    const letterNode = makeBadgeSprite('!', '#ffd23f');
    letterNode.position.y = 6.5; rootGrp.add(letterNode);
    rootGrp.visible = false; G.scene.add(rootGrp);
    S.beacon = rootGrp; S.beaconLetter = letterNode;
  };
  makeBeacon();

  const showBeacon = (wx, wz, glyphIn, colIn) => {
    if (!S.beacon) return; S.beacon.position.set(wx, groundH(wx, wz), wz); S.beacon.visible = true;
    if (glyphIn && S.beaconLetter) {
      const parentNode = S.beaconLetter.parent;
      const keepYVal = S.beaconLetter.position.y;
      parentNode.remove(S.beaconLetter);
      S.beaconLetter = makeBadgeSprite(glyphIn, colIn);
      S.beaconLetter.position.y = keepYVal; parentNode.add(S.beaconLetter);
    }
  };

  const concealBeacon = () => { if (S.beacon) S.beacon.visible = false; };

  const clearZoneRing = () => {
    if (S.zoneRing) { G.scene.remove(S.zoneRing); S.zoneRing = null; }
  };

  const buildZoneRing = (radiusVal, colIn) => {
    clearZoneRing();
    const matCfg = {};
    matCfg.color = colIn; matCfg.transparent = true; matCfg.opacity = 0.75;
    const matIn = new THREE.MeshBasicMaterial(matCfg);
    const torusMesh = new THREE.Mesh(new THREE.TorusGeometry(radiusVal, 0.35, 8, 48), matIn);
    torusMesh.rotation.x = Math.PI / 2; G.scene.add(torusMesh);
    S.zoneRing = torusMesh; return torusMesh;
  };

  const currentMissionDef = () => {
    if (MISSIONS.length > G.missionIndex) return MISSIONS[G.missionIndex];
    return null;
  };

  const clearGiverFig = () => {
    if (S.giverFig) { G.scene.remove(S.giverFig); S.giverFig = null; }
  };

  const makeGiverFigure = (defIn, anchorPt) => {
    const personM = CAST[defIn.giver];
    if (!personM) return personM; try { S.giverFig = makeFigure(personM);
      S.giverFig.position.set(anchorPt.x, groundH(anchorPt.x, anchorPt.z), anchorPt.z);
      S.giverFig.rotation.y = rr(0, Math.PI * 2); G.scene.add(S.giverFig);
    } catch (skip) { S.giverFig = null; } return personM;
  };

  const placeGiver = () => {
    clearGiverFig();
    const defM = currentMissionDef();
    if (!defM) { G.objective = null; G.missionProg = ''; concealBeacon(); return; }
    const anchorPt = spotOf(defM.district); S.giverMission = defM;
    const personM = makeGiverFigure(defM, anchorPt);
    const nameTrim = (personM?.name || defM.giver || '?').trim();
    const glyphIn = nameTrim.charAt(0).toUpperCase();
    G.objective = {};
    G.objective.x = anchorPt.x; G.objective.z = anchorPt.z;
    G.objective.label = defM.title + ' — talk to ' + (personM?.name || defM.giver);
    G.objective.letter = glyphIn; G.objective.giverId = defM.giver;
    G.missionProg = 'Go to the blip'; showBeacon(anchorPt.x, anchorPt.z, glyphIn, '#ffd23f'); S.phase = 'giver';
  };

  const routeSeconds = (fromPt, ptsArr) => {
    let sumVal = 0; let cursorPt = fromPt;
    ptsArr.forEach(function (cpPt) {
      sumVal = sumVal + spanBetween(cursorPt.x, cursorPt.z, cpPt.x, cpPt.z); cursorPt = cpPt;
    });
    return sumVal / 17;
  };

  const setupRival = (runM, defM, startPt) => {
    runM.checkpoints = buildCheckpoints(G, startPt, runM._dest, 4);
    runM.timer = routeSeconds(startPt, runM.checkpoints) + 60;
    let specIdVal = 'taiyo'; let driverIdVal = 'dante'; let paintVal = 0x7a1010;
    specIdVal = 'm12' === defM.id ? 'svj' : ('m11' === defM.id ? 'gtr35' : specIdVal);
    driverIdVal = 'm12' === defM.id ? 'ryo' : ('m11' === defM.id ? 'shun' : driverIdVal);
    paintVal = 'm12' === defM.id ? 0x30343c : ('m11' === defM.id ? 0x9aa0a6 : paintVal);
    runM.rubberF = rr(0.92, 1.08);
    let startAng;
    if (G.car) startAng = G.car.angle; else startAng = 0;
    const rivalOpts = {};
    rivalOpts.driver = driverIdVal; rivalOpts.color = paintVal;
    runM.rival = spawnVehicle(G, specIdVal, startPt.x + 6, startPt.z + 4, startAng, rivalOpts);
    runM.rivalSpeed = 0;
  };

  const tougeParTime = (runM) => {
    let lenVal = 0;
    let ciIdx = 1;
    while (ciIdx < runM.checkpoints.length) {
      lenVal = lenVal + spanBetween(runM.checkpoints[ciIdx].x, runM.checkpoints[ciIdx].z, runM.checkpoints[ciIdx - 1].x, runM.checkpoints[ciIdx - 1].z);
      ciIdx++;
    }
    return lenVal / 21;
  };

  const setupTimeTrial = (runM, defM, startPt, destPt) => {
    if (G.touge && G.touge.length > 2 && 'm6' === defM.id) {
      runM.checkpoints = G.touge.map(function (tpPt) { const cpObj = {}; cpObj.x = tpPt.x; cpObj.z = tpPt.z; return cpObj; });
      runM.par = tougeParTime(runM);
    } else { runM.checkpoints = buildCheckpoints(G, startPt, destPt, 5);
      runM.par = routeSeconds(startPt, runM.checkpoints) + 25;
    } runM.timer = 0;
  };

  const setupDisableRun = (runM, startPt) => {
    G.flags.noDecay = true; G.wanted = Math.max(3, G.wanted);
    const angVal = rr(0, Math.PI * 2);
    const txVal = startPt.x + Math.sin(angVal) * 55;
    const tzVal = startPt.z + Math.cos(angVal) * 55;
    const copOpts = {};
    copOpts.driver = 'cop'; copOpts.livery = 'police'; copOpts.lights = true;
    runM.target = spawnVehicle(G, 'police', txVal, tzVal, rr(0, 6), copOpts);
    if (runM.target) { runM.target.health = 90; G.cops?.push(runM.target); } runM.checkpoints = [];
  };

  const setupJackRun = (runM, defM, anchorPt) => {
    let specIdVal;
    if ('string' === typeof defM.need && CARS[defM.need]) specIdVal = defM.need; else specIdVal = 'sora15';
    const angVal = rr(0, Math.PI * 2);
    const jxVal = anchorPt.x + Math.sin(angVal) * 70;
    const jzVal = anchorPt.z + Math.cos(angVal) * 70;
    const jackOpts = {};
    jackOpts.driver = 'parked'; jackOpts.glow = true;
    runM.target = spawnVehicle(G, specIdVal, jxVal, jzVal, rr(0, 6), jackOpts);
    runM.stage = 'steal'; runM.checkpoints = [];
    const jackPt = {};
    jackPt.x = jxVal; jackPt.z = jzVal;
    runM.checkpoints.push(jackPt);
  };

  const setupHoldRun = (runM, destPt) => {
    runM.checkpoints = [destPt]; runM.holdT = 0;
    G.wanted = Math.max(2, G.wanted); runM.rivals = [];
    const holdKinds = [];
    holdKinds.push('hatch'); holdKinds.push('sedan'); holdKinds.push('kei');
    let hIdx = 0;
    while (hIdx < 2) {
      const angVal = rr(0, Math.PI * 2);
      const vehIn = spawnVehicle(G, pick(holdKinds),
        destPt.x + Math.sin(angVal) * 45, destPt.z + Math.cos(angVal) * 45, rr(0, 6), { driver: 'dante' });
      if (vehIn) runM.rivals.push(vehIn);
      hIdx++;
    }
  };

  const startChain = (defM) => {
    const anchorPt = spotOf(defM.district);
    const startPtVal = actorPoint(G);
    const destPtVal = {};
    destPtVal.x = anchorPt.x + rr(-60, 60); destPtVal.z = anchorPt.z + rr(-60, 60);
    let startHealthVal;
    if (G.car) startHealthVal = G.car.health ?? 100; else startHealthVal = 100;
    const runM = {};
    runM.m = defM; runM.type = defM.type; runM.idx = 0; runM.checkpoints = []; runM.timer = 0; runM.par = 0;
    runM.rival = null; runM.rivalIdx = 0; runM.target = null; runM.done = false;
    runM.startHealth = startHealthVal; runM.driftTarget = 2000; runM.holdT = 0; runM._dest = destPtVal;
    switch (defM.type) {
      case 'meet': runM.checkpoints = [destPtVal]; break;
      case 'sprint': runM.checkpoints = buildCheckpoints(G, startPtVal, destPtVal, 4);
        runM.timer = routeSeconds(startPtVal, runM.checkpoints) + 35;
        break;
      case 'delivery': runM.checkpoints = [destPtVal];
        runM.timer = Math.max(35, spanBetween(startPtVal.x, startPtVal.z, destPtVal.x, destPtVal.z) / 16 + 18);
        break;
      case 'drift': runM.checkpoints = [destPtVal];
        if ('number' === typeof defM.need && defM.need > 100) runM.driftTarget = defM.need; else runM.driftTarget = 2000;
        G.driftScore = 0;
        break;
      case 'race': setupRival(runM, defM, startPtVal); break;
      case 'pinkslip': setupRival(runM, defM, startPtVal); break;
      case 'timetrial': setupTimeTrial(runM, defM, startPtVal, destPtVal); break;
      case 'disable': setupDisableRun(runM, startPtVal); break;
      case 'jack': setupJackRun(runM, defM, anchorPt); break;
      case 'hold': setupHoldRun(runM, destPtVal); break;
      default: runM.checkpoints = [destPtVal]; break;
    }
    S.chain = runM; S.phase = 'active'; aimAtObjective();
  };

  const aimAtObjective = () => {
    const runM = S.chain; if (!runM) return; const defM = runM.m;
    if ('disable' === runM.type && runM.target) {
      G.objective = {};
      G.objective.x = runM.target.x; G.objective.z = runM.target.z;
      G.objective.label = defM.title + ' — disable the interceptor'; G.objective.letter = '!';
      showBeacon(runM.target.x, runM.target.z, '!', '#ff5c39'); return;
    }
    if ('jack' === runM.type && 'deliver' === runM.stage) {
      G.objective = {};
      G.objective.x = HQ_GARAGE.x; G.objective.z = HQ_GARAGE.z;
      G.objective.label = defM.title + ' — deliver to HQ garage'; G.objective.letter = 'G';
      showBeacon(HQ_GARAGE.x, HQ_GARAGE.z, 'G', '#7dffb0'); return;
    }
    const cpPt = runM.checkpoints[Math.min(runM.idx, runM.checkpoints.length - 1)];
    if (cpPt) {
      G.objective = {};
      G.objective.x = cpPt.x; G.objective.z = cpPt.z; G.objective.label = defM.title; G.objective.letter = '!';
      showBeacon(cpPt.x, cpPt.z, '!', '#ffd23f');
    }
  };

  const teardownChain = () => {
    const dyingRun = S.chain;
    if (!dyingRun) return;
    if ('disable' === dyingRun.type) { G.flags.noDecay = false;
      if (dyingRun.target && G.cops) {
        const idxVal = G.cops.indexOf(dyingRun.target);
        if (!(idxVal < 0)) G.cops.splice(idxVal, 1);
      }
    }
    clearZoneRing(); S.chain = null;
  };

  const failActiveChain = (reasonIn) => {
    const defM = S.chain?.m; teardownChain();
    G.toast?.(reasonIn || 'Mission failed — talk to the giver again');
    G.audio?.play?.('fail'); placeGiver(); if (defM) G.missionProg = 'Failed — go back to the blip';
  };

  const cashRewardFor = (runM, defM) => { let cashM = defM.reward?.money || 0;
    if ('delivery' === runM.type) {
      let healthVal;
      if (G.car) healthVal = G.car.health ?? 100; else healthVal = 100;
      cashM = cashM + Math.round(50 * (Math.max(0, healthVal) / 100));
    } return cashM;
  };

  const checkRankUp = () => { const titlesM = [];
    titlesM.push('Rookie'); titlesM.push('Runner'); titlesM.push('Drifter'); titlesM.push('Street Ace');
    titlesM.push('Night Captain'); titlesM.push('Bay Legend'); titlesM.push('Street King');
    let rankM = 0;
    for (const [idxVal, stepVal] of REP_LADDER.entries()) { if (G.rep >= stepVal) rankM = idxVal; }
    if (rankM > (G.rankIdx || 0)) { G.rankIdx = rankM; G.banner?.('Rank up — ' + titlesM[rankM]); }
  };

  const gainTurf = (defM) => {
    const zoneRec = G.districtState?.[defM.district];
    if (zoneRec) {
      zoneRec.control = Math.min(100, (zoneRec.control || 0) + 15);
      if (!(zoneRec.control < 60)) zoneRec.owner = 'ronin';
    }
  };

  const gainPinkslip = () => {
    if (!G.garage.includes('hero-gtr')) G.garage.push('hero-gtr'); if (!G.ownedCars.includes('hero-gtr')) G.ownedCars.push('hero-gtr');
    G.flags.gotGhost = true; G.banner?.('Pink slip won — GHOST GT-R is yours');
  };

  const finishChain = () => {
    const runM = S.chain; const defM = runM.m;
    const cashM = cashRewardFor(runM, defM); const repM = defM.reward?.rep || 0;
    G.money = (G.money || 0) + cashM; G.rep = (G.rep || 0) + repM;
    checkRankUp(); gainTurf(defM);
    if ('pinkslip' === defM.type) gainPinkslip();
    teardownChain(); G.missionIndex = G.missionIndex + 1;
    if (G.missionIndex >= MISSIONS.length) { G.flags.campaignDone = true;
      G.banner?.('CAMPAIGN COMPLETE — Street King of Ronin Bay'); G.objective = null; G.missionProg = ''; concealBeacon();
    } else { G.banner?.(defM.title + ' complete — +$' + cashM.toLocaleString('en-US')); placeGiver(); }
    G.toast?.('+$' + cashM.toLocaleString('en-US') + ' · +' + repM + ' REP'); G.audio?.play?.('complete'); G.saveGame?.();
  };

  const driveVehicleNpc = (Gw, vehIn, ptsArr, cellRec, stepM, paceVal) => {
    if (!vehIn || cellRec.i >= ptsArr.length) return;
    const goalPt = ptsArr[cellRec.i];
    const bearingVal = Math.atan2(goalPt.x - vehIn.x, goalPt.z - vehIn.z);
    const deltaVal = angleWrap(bearingVal, vehIn.angle);
    vehIn.angle = vehIn.angle + THREE.MathUtils.clamp(deltaVal, -1.9 * stepM, 1.9 * stepM);
    let goalPaceVal = paceVal;
    if (Math.abs(deltaVal) > 0.7) goalPaceVal *= 0.55;
    const paceNowVal = vehIn.speed || 0;
    vehIn.speed = THREE.MathUtils.clamp(paceNowVal + Math.sign(goalPaceVal - paceNowVal) * 10 * stepM, 0, goalPaceVal + 6);
    vehIn.x = vehIn.x + Math.sin(vehIn.angle) * vehIn.speed * stepM;
    vehIn.z = vehIn.z + Math.cos(vehIn.angle) * vehIn.speed * stepM;
    vehIn.mesh.position.set(vehIn.x, groundH(vehIn.x, vehIn.z), vehIn.z);
    vehIn.mesh.rotation.y = vehIn.angle;
    const udRec = vehIn.mesh.userData;
    if (udRec?.wheels) {
      const wDeltaVal = vehIn.speed * stepM / (udRec.wheelR || 0.34);
      const wheelArr = Object.values(udRec.wheels);
      wheelArr.forEach(function (wheelNode) {
        if (wheelNode) wheelNode.rotation.x = wheelNode.rotation.x + wDeltaVal;
      });
    }
    if (11 > spanBetween(vehIn.x, vehIn.z, goalPt.x, goalPt.z)) cellRec.i = cellRec.i + 1;
  };

  const refreshGarageList = () => {
    const rowsArr = [];
    Object.keys(CARS).forEach(function (keyIn) {
      const specRec = CARS[keyIn];
      const rowRec = {};
      rowRec.id = keyIn; rowRec.name = specRec.name || keyIn; rowRec.price = specRec.price || 0;
      rowRec.owned = G.garage.includes(keyIn); rowRec.current = keyIn === S.currentCarId;
      rowsArr.push(rowRec);
    });
    G.garageList = rowsArr;
  };
  refreshGarageList();

  const rollOutCar = (carIdIn) => {
    if (G.starterCar && G.starterCar !== G.car) { const oldCar = G.starterCar;
      if (oldCar.mesh) G.scene.remove(oldCar.mesh);
      if (G.vehicles) { const idxVal = G.vehicles.indexOf(oldCar);
        if (!(idxVal < 0)) G.vehicles.splice(idxVal, 1);
      }
    }
    if (G.flags.inCar) { try { G.exitCar?.(); } catch (skip) {} }
    const freshCar = spawnVehicle(G, carIdIn, HQ_GARAGE.x + 6, HQ_GARAGE.z + 8, Math.PI, { driver: 'parked' });
    if (freshCar) { G.starterCar = freshCar; S.currentCarId = carIdIn; }
    refreshGarageList(); G.saveGame?.();
  };

  const purchaseSlot = (entryM) => {
    G.money = G.money - entryM.price; G.garage.push(entryM.id);
    if (!G.ownedCars.includes(entryM.id)) G.ownedCars.push(entryM.id); rollOutCar(entryM.id);
    G.banner?.(entryM.name + ' — yours'); G.audio?.play?.('buy');
  };

  const chooseGarageSlot = (slotNum) => {
    const entryM = G.garageList[slotNum - 1]; if (!entryM) return;
    if (entryM.owned) { rollOutCar(entryM.id); G.toast?.(entryM.name + ' rolled out'); }
    else if ((G.money || 0) >= entryM.price) purchaseSlot(entryM); else G.toast?.('Need $' + entryM.price.toLocaleString('en-US') + ' for the ' + entryM.name);
    refreshGarageList();
  };

  const keyIsHeld = (keyIn) => {
    const keyMap = G.keys || {};
    const variantArr = [keyIn, keyIn.toLowerCase(), keyIn.toUpperCase()];
    return variantArr.some(function (variantIn) { return !!keyMap[variantIn]; });
  };

  const interactIsHeld = () => { return ['KeyE', 'e'].some(function (codeIn) { return keyIsHeld(codeIn); }); };

  placeGiver();

  const tickIncome = (step) => {
    S.incomeT = S.incomeT - step; if (S.incomeT > 0) return;
    S.incomeT = 60; let incomeM = 0; if (G.districtState) {
      DISTRICTS.forEach(function (dRec) {
        const stRec = G.districtState[dRec.id];
        if (stRec && 'ronin' === stRec.owner) incomeM = incomeM + Math.round((stRec.control || 0) / 10);
      });
    }
    if (incomeM > 0) { G.money = (G.money || 0) + incomeM; G.toast?.('District income +$' + incomeM); }
  };

  const tickRushSpawn = (step) => { if (S.chain || S.rush) return;
    S.rushTimer = S.rushTimer - step; if (S.rushTimer > 0) return;
    S.rushTimer = 90; if (chance(0.5)) {
      const rushXVal = pick(G.roadX) + rr(-8, 8);
      const rushZVal = pick(G.roadZ) + rr(-8, 8);
      S.rush = {};
      S.rush.x = THREE.MathUtils.clamp(rushXVal, -620, 620);
      S.rush.z = THREE.MathUtils.clamp(rushZVal, -620, 620); S.rush.t = 40;
      G.toast?.('Rush delivery — reach the pink blip in 40s for $150'); G.audio?.play?.('event');
    }
  };

  const tickRush = (step, posIn) => { if (!S.rush) return;
    S.rush.t = S.rush.t - step; if (!S.chain) {
      G.objective = {};
      G.objective.x = S.rush.x; G.objective.z = S.rush.z;
      G.objective.label = 'Rush delivery — ' + clockLabelM(S.rush.t); G.objective.letter = '$';
      showBeacon(S.rush.x, S.rush.z, '$', '#ff4fd8');
    }
    if (7 > spanBetween(posIn.x, posIn.z, S.rush.x, S.rush.z)) {
      G.money = (G.money || 0) + 150; G.toast?.('Rush delivered — +$150');
      G.audio?.play?.('complete'); S.rush = null;
      if (!S.chain) placeGiver();
    } else if (!(S.rush.t > 0)) { S.rush = null; if (!S.chain) placeGiver(); }
  };

  const tickGiver = (ePressedFlag, posIn) => {
    if ('giver' !== S.phase || S.rush) return;
    const defM = currentMissionDef(); if (!defM) return;
    const anchorPt = spotOf(defM.district);
    const gapVal = spanBetween(posIn.x, posIn.z, anchorPt.x, anchorPt.z);
    if ((ePressedFlag && 5 > gapVal) || (6 > gapVal && G.flags.inCar)) {
      if (6 > gapVal) {
        clearGiverFig();
        G.showBriefing?.(defM.giver, defM.blurb); G.audio?.play?.('brief'); startChain(defM);
      }
    }
  };

  G.updaters.push(function (frameIn, step) {
    const zoneRingFor = () => { const runM = S.chain;
      if (!S.zoneRing) { let ringSize; let ringCol;
        if ('drift' === runM.type) ringSize = 40; else ringSize = 26;
        if ('drift' === runM.type) ringCol = 0xe879ff; else ringCol = 0xff5c39;
        buildZoneRing(ringSize, ringCol);
      } return S.zoneRing;
    };
    const posIn = actorPoint(G);
    let velXVal;
    let velZVal;
    if (step > 0) velXVal = (posIn.x - S.prevPX) / step; else velXVal = 0;
    if (step > 0) velZVal = (posIn.z - S.prevPZ) / step; else velZVal = 0;
    S.prevPX = posIn.x; S.prevPZ = posIn.z;
    const eDownFlag = interactIsHeld();
    const ePressedFlag = eDownFlag && !S.ePrev;
    S.ePrev = eDownFlag;
    if (S.beacon?.visible) { S.beacon.rotation.y = S.beacon.rotation.y + step * 0.8;
      if (S.beaconLetter) S.beaconLetter.position.y = Math.sin(performance.now() * 0.003) * 0.5 + 6.5;
    }
    if (S.giverFig) S.giverFig.rotation.y = Math.sin(performance.now() * 0.001) * 0.0006 + S.giverFig.rotation.y;
    const nearGarageFlag = 7 > spanBetween(posIn.x, posIn.z, HQ_GARAGE.x, HQ_GARAGE.z);
    if (ePressedFlag && nearGarageFlag && 'active' !== S.phase) { G.flags.garageOpen = !G.flags.garageOpen;
      if (G.flags.garageOpen) refreshGarageList();
    } else if (ePressedFlag && G.flags.garageOpen) G.flags.garageOpen = false;
    if (G.flags.garageOpen) { let slotNum = 1;
      while (slotNum <= 9) {
        const downFlag = keyIsHeld(`Digit${slotNum}`) || keyIsHeld(String(slotNum));
        if (downFlag && !S.numPrev[slotNum]) chooseGarageSlot(slotNum);
        S.numPrev[slotNum] = downFlag;
        slotNum++;
      }
    }
    tickIncome(step); tickRushSpawn(step); tickRush(step, posIn); tickGiver(ePressedFlag, posIn);
    const runM = S.chain; if (runM) { const defM = runM.m;
      const cpPt = runM.checkpoints[Math.min(runM.idx, runM.checkpoints.length - 1)];
      switch (runM.type) {
        case 'disable': if (runM.target) {
            aimAtObjective();
            if (G.car && 5 > spanBetween(G.car.x, G.car.z, runM.target.x, runM.target.z) && (G.speedKmh || 0) > 25) {
              runM.target.health -= 22 * step * 3;
            } G.missionProg = 'Interceptor health ' + Math.max(0, Math.ceil(runM.target.health)) + '%'; G.wanted = Math.max(3, G.wanted);
            if (25 > runM.target.health) finishChain();
          }
          break;
        case 'drift': { const zonePt = runM.checkpoints[0];
          const ringNode = zoneRingFor();
          if (ringNode) ringNode.position.set(zonePt.x, groundH(zonePt.x, zonePt.z) + 0.4, zonePt.z);
          const insideM = 40 > spanBetween(posIn.x, posIn.z, zonePt.x, zonePt.z);
          if (insideM && G.car && G.flags.inCar && G.flags.drifting) { const headVelVal = Math.atan2(velXVal, velZVal);
            const slipVal = Math.abs(angleWrap(headVelVal, G.car.angle));
            const speedVal = Math.hypot(velXVal, velZVal);
            if (speedVal > 4) G.driftScore = G.driftScore + slipVal * speedVal * step * 9;
          }
          G.missionProg = 'Drift ' + Math.floor(G.driftScore).toLocaleString('en-US') + ' / ' + runM.driftTarget.toLocaleString('en-US') + (insideM ? '' : ' — get to the zone'); if (G.driftScore >= runM.driftTarget) finishChain();
          break; }
        case 'jack': if ('steal' === runM.stage) {
            aimAtObjective(); G.missionProg = 'Steal the marked car';
            if (runM.target && G.car === runM.target) { runM.stage = 'deliver'; aimAtObjective(); }
          } else { G.missionProg = 'Deliver it to the HQ garage';
            if (8 > spanBetween(posIn.x, posIn.z, HQ_GARAGE.x, HQ_GARAGE.z) && G.car === runM.target) finishChain();
          }
          break;
        case 'hold': { const zonePt = runM.checkpoints[0];
          const ringNode = zoneRingFor();
          if (ringNode) ringNode.position.set(zonePt.x, groundH(zonePt.x, zonePt.z) + 0.4, zonePt.z);
          const insideM = 26 > spanBetween(posIn.x, posIn.z, zonePt.x, zonePt.z);
          if (insideM) runM.holdT = runM.holdT + step; G.wanted = Math.max(2, G.wanted);
          const rivalArr = runM.rivals || [];
          rivalArr.forEach(function (hvVeh) {
            const cellRec = { i: 0 };
            const holdPt = {};
            holdPt.x = posIn.x; holdPt.z = posIn.z;
            driveVehicleNpc(G, hvVeh, [holdPt], cellRec, step, 7);
          });
          G.missionProg = 'Hold the zone ' + clockLabelM(45 + (-runM.holdT)); if (runM.holdT >= 45) finishChain();
          break; }
        default: { if (runM.timer > 0 && 'timetrial' !== runM.type) {
            runM.timer = runM.timer - step;
            if (!(runM.timer > 0)) { failActiveChain('Out of time — talk to the giver again'); return; }
          }
          if ('timetrial' === runM.type) runM.timer = runM.timer + step; if (runM.rival) {
            const capVal = (G.car?.spec?.topSpeed || 160) / 3.6 * 0.62;
            const myPaceVal = Math.max(6, Math.hypot(velXVal, velZVal));
            const rubberVal = THREE.MathUtils.clamp(myPaceVal * (runM.rubberF || 1), 6, capVal * 1.5);
            const cellRec = { i: runM.rivalIdx };
            driveVehicleNpc(G, runM.rival, runM.checkpoints, cellRec, step, rubberVal);
            runM.rivalIdx = cellRec.i;
            if (runM.rivalIdx >= runM.checkpoints.length) { failActiveChain('You lost the race — run it back'); return; }
          }
          if (cpPt && 9 > spanBetween(posIn.x, posIn.z, cpPt.x, cpPt.z)) {
            runM.idx = runM.idx + 1; G.audio?.play?.('checkpoint'); if (runM.idx >= runM.checkpoints.length) {
              if ('timetrial' === runM.type && runM.timer > runM.par) { failActiveChain('Too slow — par ' + clockLabelM(runM.par)); return; }
              finishChain(); return;
            }
            aimAtObjective();
          } const totalM = runM.checkpoints.length;
          if ('sprint' === runM.type || 'race' === runM.type || 'pinkslip' === runM.type) { G.missionProg = 'Checkpoint ' + Math.min(runM.idx + 1, totalM) + '/' + totalM + ' · ' + clockLabelM(runM.timer);
          } else if ('timetrial' === runM.type) { G.missionProg = 'Checkpoint ' + Math.min(runM.idx + 1, totalM) + '/' + totalM + ' · ' + clockLabelM(runM.timer) + ' / par ' + clockLabelM(runM.par);
          } else if ('delivery' === runM.type) { G.missionProg = 'Deliver in ' + clockLabelM(runM.timer) + ' — keep it clean';
          } else { G.missionProg = 'Reach the beacon'; }
          break; }
      }
      if (S.chain !== runM) return;
    }
  });
};
