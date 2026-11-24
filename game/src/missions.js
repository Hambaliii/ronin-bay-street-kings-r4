// Campaign engine for Ronin Bay: quest givers waiting at their beacons,
// the full spread of job shapes (meet, sprint, delivery, drift, race,
// timetrial, disable, jack, hold, pinkslip), opportunistic rush work,
// district control with its trickle of income, and the HQ garage.
import * as THREE from 'three';
import { CFG, DISTRICTS, CARS, CAST, MISSIONS } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite, roadRoute } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';
const ANCHOR_BY_ZONE = {};
ANCHOR_BY_ZONE.port = { x: -412.5, z: 470 }; ANCHOR_BY_ZONE.coral = { x: 495, z: 495 };
ANCHOR_BY_ZONE.neon = { x: 330, z: -330 }; ANCHOR_BY_ZONE.hoshino = { x: -90, z: -380 };
const REP_LADDER = [0, 40, 110, 220, 380, 600, 900];
const GARAGE_SPOT = { x: -412.5, z: 455 };
function wrapDelta(lead, trail) {
  let gap = lead - trail;
  while (gap > Math.PI) gap = gap - (Math.PI * 2);
  while (gap < -Math.PI) gap = gap + (Math.PI * 2);
  return gap;
}
const span2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const SECS_PER_MIN = 60;
const formatClock = (secsIn) => { const whole = Math.max(0, Math.ceil(secsIn)); return `${Math.floor(whole / SECS_PER_MIN)}:${String(whole % SECS_PER_MIN).padStart(2, '0')}`; };
function actorPos(G) {
  const seated = G.car && G.flags.inCar;
  const srcObj = seated ? G.car : G.player;
  const outPos = { x: srcObj.x, z: srcObj.z };
  return outPos;
}
function makeLetterSprite(glyphIn, fillIn) {
  const cvEl = document.createElement('canvas');
  cvEl.width = 128; cvEl.height = 128;
  const pen = cvEl.getContext('2d');
  pen.fillStyle = fillIn || '#ffd23f';
  pen.beginPath(); pen.arc(64, 64, 52, 0, Math.PI * 2); pen.fill();
  pen.lineWidth = 7; pen.strokeStyle = '#14100a'; pen.stroke();
  pen.fillStyle = '#14100a'; pen.font = 'bold 64px Arial, sans-serif';
  pen.textAlign = 'center'; pen.textBaseline = 'middle';
  pen.fillText(glyphIn || '!', 64, 68);
  const texObj = new THREE.CanvasTexture(cvEl);
  const sprObj = new THREE.Sprite(new THREE.SpriteMaterial({ map: texObj, transparent: true, depthTest: false }));
  sprObj.scale.set(3.2, 3.2, 1); return sprObj;
}
function cumulativeLens(ptsArr) {
  const lensArr = [0];
  let walkIdx = lensArr.length;
  while (walkIdx < ptsArr.length) {
    const curPt = ptsArr[walkIdx]; const prvPt = ptsArr[walkIdx - 1];
    lensArr.push(lensArr[walkIdx - 1] + span2d(curPt.x, curPt.z, prvPt.x, prvPt.z));
    walkIdx++;
  }
  return lensArr;
}
function sampleAtDist(ptsArr, lensArr, targetDist) {
  let segIdx = 1;
  while (segIdx < lensArr.length - 1 && lensArr[segIdx] < targetDist) segIdx++;
  const segSpan = (lensArr[segIdx] - lensArr[segIdx - 1]) || 1;
  const segFrac = (targetDist - lensArr[segIdx - 1]) / segSpan;
  const ptA = ptsArr[segIdx - 1]; const ptB = ptsArr[segIdx];
  const blended = { x: ptA.x + ((ptB.x - ptA.x) * segFrac), z: ptA.z + ((ptB.z - ptA.z) * segFrac) };
  return blended;
}
function planCheckpoints(G, startPt, endPt, countWanted) {
  const routeRaw = roadRoute(G, startPt, endPt) || [startPt, endPt];
  const routePts = [];
  routeRaw.forEach((rawPt) => { routePts.push({ x: rawPt.x, z: rawPt.z }); });
  if (!(routePts.length > 0)) return [{ x: endPt.x, z: endPt.z }];
  const arcLens = cumulativeLens(routePts);
  const totalLen = arcLens[arcLens.length - 1] || 1;
  const chosen = [];
  const autoN = Math.max(2, Math.round(totalLen / 120));
  const nWant = Math.max(1, countWanted || autoN);
  let kth = 1;
  while (kth <= nWant) { chosen.push(sampleAtDist(routePts, arcLens, (totalLen * kth) / nWant)); kth++; }
  chosen[chosen.length - 1] = { x: endPt.x, z: endPt.z }; return chosen;
}
export function initMissions(G) {
  G.objective = null; G.missionIndex = G.missionIndex || 0;
  G.missionProg = ''; G.driftScore = 0; G.garageList = [];
  G.flags.garageOpen = !!G.flags.garageOpen;
  const st = {};
  st.phase = 'giver'; st.giverFig = null; st.giverMission = null; st.beacon = null; st.beaconLetter = null;
  st.chain = null; st.rush = null; st.rushTimer = 55; st.incomeT = 60; st.ePrev = false; st.numPrev = {};
  st.prevPX = 0; st.prevPZ = 0; st.currentCarId = (G.garage && G.garage[0]) || 'hachi'; st.zoneRing = null;
  function assembleBeacon() {
    const rootGrp = new THREE.Group();
    const pillarMat = new THREE.MeshBasicMaterial();
    pillarMat.color = new THREE.Color(0xffd23f); pillarMat.transparent = true; pillarMat.opacity = 0.35;
    pillarMat.blending = THREE.AdditiveBlending; pillarMat.depthWrite = false; pillarMat.side = THREE.DoubleSide;
    const pillarMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 20, 1, true), pillarMat);
    pillarMesh.position.y = 7; rootGrp.add(pillarMesh);
    try { const haloSpr = glowSprite(0xffd23f, 5.4); haloSpr.position.y = 1.2; rootGrp.add(haloSpr); } catch (err) { /* decoration only */ }
    const letterSpr = makeLetterSprite('!', '#ffd23f');
    letterSpr.position.y = 6.5; rootGrp.add(letterSpr);
    rootGrp.visible = false; G.scene.add(rootGrp);
    st.beacon = rootGrp; st.beaconLetter = letterSpr;
  }
  assembleBeacon();
  function showBeaconAt(wx, wz, glyph, col) {
    if (st.beacon) {
      st.beacon.position.set(wx, groundH(wx, wz), wz); st.beacon.visible = true;
      if (glyph && st.beaconLetter) {
        const holderGrp = st.beaconLetter.parent; const savedY = st.beaconLetter.position.y;
        holderGrp.remove(st.beaconLetter);
        st.beaconLetter = makeLetterSprite(glyph, col); st.beaconLetter.position.y = savedY;
        holderGrp.add(st.beaconLetter);
      }
    }
  }
  const hideBeacon = () => { if (st.beacon) st.beacon.visible = false; };
  function buildZoneRing(radiusIn, colIn) {
    dropZoneRing();
    const ringMat = new THREE.MeshBasicMaterial({ color: colIn, transparent: true, opacity: 0.75 });
    const torusMesh = new THREE.Mesh(new THREE.TorusGeometry(radiusIn, 0.35, 8, 48), ringMat);
    torusMesh.rotation.x = Math.PI / 2; G.scene.add(torusMesh); st.zoneRing = torusMesh;
    return torusMesh;
  }
  function dropZoneRing() { if (st.zoneRing) { G.scene.remove(st.zoneRing); st.zoneRing = null; } }
  const activeDef = () => (MISSIONS.length > G.missionIndex ? MISSIONS[G.missionIndex] : null);
  function stageGiver() {
    removeGiverFig();
    const def = activeDef();
    if (!def) { G.objective = null; G.missionProg = ''; hideBeacon(); return; }
    const anchor = ANCHOR_BY_ZONE[def.district] || ANCHOR_BY_ZONE.port;
    st.giverMission = def;
    const person = CAST[def.giver];
    if (person) {
      try {
        st.giverFig = makeFigure(person);
        st.giverFig.position.set(anchor.x, groundH(anchor.x, anchor.z), anchor.z);
        st.giverFig.rotation.y = rr(0, Math.PI * 2); G.scene.add(st.giverFig);
      } catch (err) { st.giverFig = null; }
    }
    const rawName = (person?.name || def.giver || '?').trim();
    const glyph = rawName.charAt(0).toUpperCase();
    const objNew = {};
    objNew.x = anchor.x; objNew.z = anchor.z;
    objNew.label = `${def.title} — talk to ${person?.name || def.giver}`;
    objNew.letter = glyph; objNew.giverId = def.giver;
    G.objective = objNew; G.missionProg = 'Go to the blip';
    showBeaconAt(anchor.x, anchor.z, glyph, '#ffd23f'); st.phase = 'giver';
  }
  function removeGiverFig() { if (st.giverFig) { G.scene.remove(st.giverFig); st.giverFig = null; } }
  function launchChain(def) {
    const anchor = ANCHOR_BY_ZONE[def.district] || ANCHOR_BY_ZONE.port;
    const start = actorPos(G);
    const run = {};
    run.m = def; run.type = def.type; run.idx = 0; run.checkpoints = []; run.timer = 0; run.par = 0;
    run.rival = null; run.rivalIdx = 0; run.target = null; run.done = false;
    run.startHealth = G.car ? (G.car.health ?? 100) : 100; run.driftTarget = 2000; run.holdT = 0;
    const dest = {};
    dest.x = anchor.x + rr(-60, 60); dest.z = anchor.z + rr(-60, 60);
    const kind = def.type;
    if (kind === 'meet') { run.checkpoints = [dest]; }
    else if (kind === 'sprint') { run.checkpoints = planCheckpoints(G, start, dest, 4); run.timer = routeSeconds(G, start, run.checkpoints) + 35; }
    else if (kind === 'delivery') { run.checkpoints = [dest]; run.timer = Math.max(35, span2d(start.x, start.z, dest.x, dest.z) / 16 + 18); }
    else if (kind === 'drift') { run.checkpoints = [dest]; run.driftTarget = typeof def.need === 'number' && def.need > 100 ? def.need : 2000; G.driftScore = 0; }
    else if (kind === 'race' || kind === 'pinkslip') {
      run.checkpoints = planCheckpoints(G, start, dest, 4); run.timer = routeSeconds(G, start, run.checkpoints) + 60;
      let rivalSpec = 'taiyo'; let rivalName = 'dante'; let rivalPaint = 0x7a1010;
      if (def.id === 'm12') rivalSpec = 'svj'; else if (def.id === 'm11') rivalSpec = 'gtr35';
      if (def.id === 'm12') rivalName = 'ryo'; else if (def.id === 'm11') rivalName = 'shun';
      if (def.id === 'm12') rivalPaint = 0x30343c; else if (def.id === 'm11') rivalPaint = 0x9aa0a6;
      run.rubberF = rr(0.92, 1.08);
      const rivalLoc = start;
      const rivalOpts = { driver: rivalName, color: rivalPaint };
      run.rival = spawnVehicle(G, rivalSpec, rivalLoc.x + 6, rivalLoc.z + 4, G.car ? G.car.angle : 0, rivalOpts);
      run.rivalSpeed = 0;
    }
    else if (kind === 'timetrial') {
      if (G.touge && G.touge.length > 2 && def.id === 'm6') {
        run.checkpoints = [];
        G.touge.forEach((pt) => { run.checkpoints.push({ x: pt.x, z: pt.z }); });
        let courseLen = 0; let ci = 1;
        while (ci < run.checkpoints.length) { courseLen = courseLen + span2d(run.checkpoints[ci].x, run.checkpoints[ci].z, run.checkpoints[ci - 1].x, run.checkpoints[ci - 1].z); ci++; }
        run.par = courseLen / 21;
      } else { run.checkpoints = planCheckpoints(G, start, dest, 5); run.par = routeSeconds(G, start, run.checkpoints) + 25; }
      run.timer = 0;
    }
    else if (kind === 'disable') {
      G.flags.noDecay = true;
      G.wanted = Math.max(3, G.wanted);
      const ang2 = rr(0, Math.PI * 2);
      const tx = start.x + (Math.sin(ang2) * 55); const tz = start.z + (Math.cos(ang2) * 55);
      run.target = spawnVehicle(G, 'police', tx, tz, rr(0, 6), { driver: 'cop', livery: 'police', lights: true });
      if (run.target) { run.target.health = 90; G.cops?.push(run.target); }
      run.checkpoints = [];
    }
    else if (kind === 'jack') {
      const wantSpec = typeof def.need === 'string' && CARS[def.need] ? def.need : 'sora15';
      const angJ = rr(0, Math.PI * 2);
      const jx = anchor.x + (Math.sin(angJ) * 70); const jz = anchor.z + (Math.cos(angJ) * 70);
      run.target = spawnVehicle(G, wantSpec, jx, jz, rr(0, 6), { driver: 'parked', glow: true });
      run.stage = 'steal'; run.checkpoints = [{ x: jx, z: jz }];
    }
    else if (kind === 'hold') {
      run.checkpoints = [dest]; run.holdT = 0;
      G.wanted = Math.max(2, G.wanted);
      run.rivals = [];
      let hi = 0;
      while (hi < 2) {
        const angR = rr(0, Math.PI * 2);
        const rivalVeh = spawnVehicle(G, pick(['hatch', 'sedan', 'kei']), dest.x + (Math.sin(angR) * 45), dest.z + (Math.cos(angR) * 45), rr(0, 6), { driver: 'dante' });
        if (rivalVeh) run.rivals.push(rivalVeh);
        hi++;
      }
    }
    else { run.checkpoints = [dest]; }
    st.chain = run; st.phase = 'active'; aimObjective();
  }
  function routeSeconds(GG, fromPt, pts) {
    let totalDist = 0; let prevPt = fromPt;
    pts.forEach((cpPt) => { totalDist = totalDist + span2d(prevPt.x, prevPt.z, cpPt.x, cpPt.z); prevPt = cpPt; });
    return totalDist / 17;
  }
  function aimObjective() {
    const run = st.chain; if (!run) return;
    const def = run.m;
    if (run.type === 'disable' && run.target) {
      G.objective = { x: run.target.x, z: run.target.z, label: `${def.title} — disable the interceptor`, letter: '!' };
      showBeaconAt(run.target.x, run.target.z, '!', '#ff5c39'); return;
    }
    if (run.type === 'jack' && run.stage === 'deliver') {
      G.objective = { x: GARAGE_SPOT.x, z: GARAGE_SPOT.z, label: `${def.title} — deliver to HQ garage`, letter: 'G' };
      showBeaconAt(GARAGE_SPOT.x, GARAGE_SPOT.z, 'G', '#7dffb0'); return;
    }
    const nextCp = run.checkpoints[Math.min(run.idx, run.checkpoints.length - 1)];
    if (nextCp) { G.objective = { x: nextCp.x, z: nextCp.z, label: def.title, letter: '!' }; showBeaconAt(nextCp.x, nextCp.z, '!', '#ffd23f'); }
  }
  function dismantleChain() {
    const dyingRun = st.chain; if (!dyingRun) return;
    if (dyingRun.type === 'disable') {
      G.flags.noDecay = false;
      if (dyingRun.target && G.cops) { const idx = G.cops.indexOf(dyingRun.target); if (!(idx < 0)) G.cops.splice(idx, 1); }
    }
    dropZoneRing(); st.chain = null;
  }
  function failChain(reason) {
    const def = st.chain?.m;
    dismantleChain();
    G.toast?.(reason || 'Mission failed — talk to the giver again'); G.audio?.play?.('fail'); stageGiver();
    if (def) G.missionProg = 'Failed — go back to the blip';
  }
  function completeMission() {
    const run = st.chain; const def = run.m;
    let cash = def.reward?.money || 0; const repGain = def.reward?.rep || 0;
    if (run.type === 'delivery') { const healthLeft = G.car ? (G.car.health ?? 100) : 100; cash = cash + Math.round(50 * (Math.max(0, healthLeft) / 100)); }
    G.money = (G.money || 0) + cash; G.rep = (G.rep || 0) + repGain;
    const rankTitles = ['Rookie', 'Runner', 'Drifter', 'Street Ace', 'Night Captain', 'Bay Legend', 'Street King'];
    let rankReached = 0; let ladderIdx = +false;
    while (ladderIdx < REP_LADDER.length) { if (G.rep >= REP_LADDER[ladderIdx]) rankReached = ladderIdx; ladderIdx++; }
    if (rankReached > (G.rankIdx || 0)) { G.rankIdx = rankReached; G.banner?.(`Rank up — ${rankTitles[rankReached]}`); }
    const zone = G.districtState?.[def.district];
    if (zone) { zone.control = Math.min(100, (zone.control || 0) + 15); if (!(zone.control < 60)) zone.owner = 'ronin'; }
    if (def.type === 'pinkslip') {
      if (!G.garage.includes('hero-gtr')) G.garage.push('hero-gtr');
      if (!G.ownedCars.includes('hero-gtr')) G.ownedCars.push('hero-gtr');
      G.flags.gotGhost = true; G.banner?.('Pink slip won — GHOST GT-R is yours');
    }
    dismantleChain(); G.missionIndex = G.missionIndex + 1;
    if (G.missionIndex >= MISSIONS.length) {
      G.flags.campaignDone = true; G.banner?.('CAMPAIGN COMPLETE — Street King of Ronin Bay');
      G.objective = null; G.missionProg = ''; hideBeacon();
    } else { G.banner?.(`${def.title} complete — +$${cash.toLocaleString('en-US')}`); stageGiver(); }
    G.toast?.(`+$${cash.toLocaleString('en-US')} · +${repGain} REP`); G.audio?.play?.('complete'); G.saveGame?.();
  }
  function driveVehicle(GG, veh, pts, cell, dt, pace) {
    if (!veh || cell.i >= pts.length) return;
    const goal = pts[cell.i];
    const bearing = Math.atan2(goal.x - veh.x, goal.z - veh.z);
    const delta = wrapDelta(bearing, veh.angle);
    veh.angle = veh.angle + THREE.MathUtils.clamp(delta, -1.9 * dt, 1.9 * dt);
    let goalPace = pace;
    if (Math.abs(delta) > 0.7) goalPace = goalPace * 0.55;
    const nowPace = veh.speed || 0;
    veh.speed = THREE.MathUtils.clamp(nowPace + (Math.sign(goalPace - nowPace) * 10 * dt), 0, goalPace + 6);
    veh.x = veh.x + (Math.sin(veh.angle) * veh.speed * dt);
    veh.z = veh.z + (Math.cos(veh.angle) * veh.speed * dt);
    veh.mesh.position.set(veh.x, groundH(veh.x, veh.z), veh.z);
    veh.mesh.rotation.y = veh.angle;
    const ud = veh.mesh.userData;
    if (ud?.wheels) { const wd = (veh.speed * dt) / (ud.wheelR || 0.34); Object.values(ud.wheels).forEach((wheel) => { if (wheel) wheel.rotation.x = wheel.rotation.x + wd; }); }
    if (span2d(veh.x, veh.z, goal.x, goal.z) < 11) cell.i += 1;
  }
  function refreshGarageList() {
    const builtList = [];
    Object.keys(CARS).forEach((key) => { const spec = CARS[key]; builtList.push({ id: key, name: spec.name || key, price: spec.price || 0, owned: G.garage.includes(key), current: key === st.currentCarId }); });
    G.garageList = builtList;
  }
  refreshGarageList();
  function rollOutCar(carId) {
    if (G.starterCar && G.starterCar !== G.car) {
      const old = G.starterCar;
      if (old.mesh) G.scene.remove(old.mesh);
      if (G.vehicles) { const idx = G.vehicles.indexOf(old); if (!(idx < 0)) G.vehicles.splice(idx, 1); }
    }
    if (G.flags.inCar) { try { G.exitCar?.(); } catch (err) {} }
    const fresh = spawnVehicle(G, carId, GARAGE_SPOT.x + 6, GARAGE_SPOT.z + 8, Math.PI, { driver: 'parked' });
    if (fresh) { G.starterCar = fresh; st.currentCarId = carId; }
    refreshGarageList(); G.saveGame?.();
  }
  function chooseGarageSlot(slotNo) {
    const entry = G.garageList[slotNo - 1]; if (!entry) return;
    if (entry.owned) { rollOutCar(entry.id); G.toast?.(`${entry.name} rolled out`); }
    else if ((G.money || 0) >= entry.price) {
      G.money = G.money - entry.price; G.garage.push(entry.id);
      if (!G.ownedCars.includes(entry.id)) G.ownedCars.push(entry.id);
      rollOutCar(entry.id); G.banner?.(`${entry.name} — yours`); G.audio?.play?.('buy');
    } else G.toast?.(`Need $${entry.price.toLocaleString('en-US')} for the ${entry.name}`);
    refreshGarageList();
  }
  function keyHeld(keyName) {
    const keys = G.keys || {};
    const variants = [keyName, keyName.toLowerCase(), keyName.toUpperCase()];
    let heldFlag = false;
    variants.forEach((variant) => { if (keys[variant]) heldFlag = true; });
    return heldFlag;
  }
  const interactHeld = () => ['KeyE', 'e'].some((code) => keyHeld(code));
  stageGiver();
  G.updaters.push((ctxG, dt) => {
    function zoneRingFor(zonePt) {
      const run = st.chain;
      if (!st.zoneRing) buildZoneRing(run.type === 'drift' ? 40 : 26, run.type === 'drift' ? 0xe879ff : 0xff5c39);
      return st.zoneRing;
    }
    const pos = actorPos(G);
    const vx = dt > 0 ? (pos.x - st.prevPX) / dt : 0; const vz = dt > 0 ? (pos.z - st.prevPZ) / dt : 0;
    st.prevPX = pos.x; st.prevPZ = pos.z;
    const eDown = interactHeld(); const ePressed = eDown && !st.ePrev; st.ePrev = eDown;
    if (st.beacon?.visible) { st.beacon.rotation.y = st.beacon.rotation.y + (dt * 0.8); if (st.beaconLetter) st.beaconLetter.position.y = 6.5 + (Math.sin(performance.now() * 0.003) * 0.5); }
    if (st.giverFig) st.giverFig.rotation.y = st.giverFig.rotation.y + (Math.sin(performance.now() * 0.001) * 0.0006);
    const nearGar = span2d(pos.x, pos.z, GARAGE_SPOT.x, GARAGE_SPOT.z) < 7;
    if (ePressed && nearGar && st.phase !== 'active') { G.flags.garageOpen = !G.flags.garageOpen; if (G.flags.garageOpen) refreshGarageList(); }
    else if (ePressed && G.flags.garageOpen) G.flags.garageOpen = false;
    if (G.flags.garageOpen) {
      let slotN = 1;
      while (slotN <= 9) { const dDown = keyHeld('Digit' + slotN) || keyHeld(String(slotN)); if (dDown && !st.numPrev[slotN]) chooseGarageSlot(slotN); st.numPrev[slotN] = dDown; slotN++; }
    }
    st.incomeT = st.incomeT - dt;
    if (!(st.incomeT > 0)) {
      st.incomeT = 60; let income = 0;
      if (G.districtState) DISTRICTS.forEach((dEntry) => { const dState = G.districtState[dEntry.id]; if (dState && dState.owner === 'ronin') income = income + Math.round((dState.control || 0) / 10); });
      if (income > 0) { G.money = (G.money || 0) + income; G.toast?.(`District income +$${income}`); }
    }
    if (!st.chain && !st.rush) {
      st.rushTimer = st.rushTimer - dt;
      if (!(st.rushTimer > 0)) {
        st.rushTimer = 90;
        if (chance(0.5)) {
          const rx = pick(G.roadX) + rr(-8, 8); const rz = pick(G.roadZ) + rr(-8, 8);
          st.rush = { x: THREE.MathUtils.clamp(rx, -620, 620), z: THREE.MathUtils.clamp(rz, -620, 620), t: 40 };
          G.toast?.('Rush delivery — reach the pink blip in 40s for $150'); G.audio?.play?.('event');
        }
      }
    }
    if (st.rush) {
      st.rush.t = st.rush.t - dt;
      if (!st.chain) { G.objective = { x: st.rush.x, z: st.rush.z, label: `Rush delivery — ${formatClock(st.rush.t)}`, letter: '$' }; showBeaconAt(st.rush.x, st.rush.z, '$', '#ff4fd8'); }
      if (span2d(pos.x, pos.z, st.rush.x, st.rush.z) < 7) {
        G.money = (G.money || 0) + 150; G.toast?.('Rush delivered — +$150'); G.audio?.play?.('complete');
        st.rush = null; if (!st.chain) stageGiver();
      } else if (!(st.rush.t > 0)) { st.rush = null; if (!st.chain) stageGiver(); }
    }
    if (st.phase === 'giver' && !st.rush) {
      const def = activeDef();
      if (def) {
        const anchor = ANCHOR_BY_ZONE[def.district] || ANCHOR_BY_ZONE.port;
        const gapG = span2d(pos.x, pos.z, anchor.x, anchor.z);
        if ((ePressed && gapG < 5) || (gapG < 6 && G.flags.inCar)) {
          if (gapG < 6) { removeGiverFig(); G.showBriefing?.(def.giver, def.blurb); G.audio?.play?.('brief'); launchChain(def); }
        }
      }
    }
    const run = st.chain;
    if (run) {
      const def = run.m;
      const cpNow = run.checkpoints[Math.min(run.idx, run.checkpoints.length - 1)];
      switch (run.type) {
        case 'disable': {
          if (run.target) {
            aimObjective();
            if (G.car && span2d(G.car.x, G.car.z, run.target.x, run.target.z) < 5 && (G.speedKmh || 0) > 25) run.target.health = run.target.health - (22 * dt * 3);
            G.missionProg = `Interceptor health ${Math.max(0, Math.ceil(run.target.health))}%`; G.wanted = Math.max(3, G.wanted);
            if (run.target.health < 25) { completeMission(); return; }
          }
          break;
        }
        case 'drift': {
          const zone = run.checkpoints[0]; const ring = zoneRingFor(zone);
          if (ring) ring.position.set(zone.x, groundH(zone.x, zone.z) + 0.4, zone.z);
          const inside = span2d(pos.x, pos.z, zone.x, zone.z) < 40;
          if (inside && G.car && G.flags.inCar && G.flags.drifting) {
            const vHead = Math.atan2(vx, vz); const slip = Math.abs(wrapDelta(vHead, G.car.angle)); const speedMag = Math.hypot(vx, vz);
            if (speedMag > 4) G.driftScore = G.driftScore + (slip * speedMag * dt * 9);
          }
          G.missionProg = `Drift ${Math.floor(G.driftScore).toLocaleString('en-US')} / ${run.driftTarget.toLocaleString('en-US')}${inside ? '' : ' — get to the zone'}`;
          if (G.driftScore >= run.driftTarget) { completeMission(); return; }
          break;
        }
        case 'jack': {
          if (run.stage === 'steal') {
            aimObjective(); G.missionProg = 'Steal the marked car';
            if (run.target && G.car === run.target) { run.stage = 'deliver'; aimObjective(); }
          } else {
            G.missionProg = 'Deliver it to the HQ garage';
            if (span2d(pos.x, pos.z, GARAGE_SPOT.x, GARAGE_SPOT.z) < 8 && G.car === run.target) { completeMission(); return; }
          }
          break;
        }
        case 'hold': {
          const zone = run.checkpoints[0]; const ring = zoneRingFor(zone);
          if (ring) ring.position.set(zone.x, groundH(zone.x, zone.z) + 0.4, zone.z);
          const inside = span2d(pos.x, pos.z, zone.x, zone.z) < 26;
          if (inside) run.holdT = run.holdT + dt;
          G.wanted = Math.max(2, G.wanted);
          (run.rivals || []).forEach((hv) => { const cell = { i: 0 }; const chasePts = [{ x: pos.x, z: pos.z }]; driveVehicle(G, hv, chasePts, cell, dt, 7); });
          G.missionProg = `Hold the zone ${formatClock(45 - run.holdT)}`;
          if (run.holdT >= 45) { completeMission(); return; }
          break;
        }
        default: {
          if (run.timer > 0 && run.type !== 'timetrial') { run.timer = run.timer - dt; if (!(run.timer > 0)) { failChain('Out of time — talk to the giver again'); return; } }
          if (run.type === 'timetrial') run.timer = run.timer + dt;
          if (run.rival) {
            const capPace = (G.car?.spec?.topSpeed || 160) / 3.6 * 0.62;
            const myPace = Math.max(6, Math.hypot(vx, vz)); const rubber = THREE.MathUtils.clamp(myPace * (run.rubberF || 1), 6, capPace * 1.5);
            const cell = { i: run.rivalIdx }; driveVehicle(G, run.rival, run.checkpoints, cell, dt, rubber); run.rivalIdx = cell.i;
            if (run.rivalIdx >= run.checkpoints.length) { failChain('You lost the race — run it back'); return; }
          }
          if (cpNow && span2d(pos.x, pos.z, cpNow.x, cpNow.z) < 9) {
            run.idx += 1; G.audio?.play?.('checkpoint');
            if (run.idx >= run.checkpoints.length) {
              if (run.type === 'timetrial' && run.timer > run.par) { failChain(`Too slow — par ${formatClock(run.par)}`); return; }
              completeMission(); return;
            }
            aimObjective();
          }
          const cpCount = run.checkpoints.length;
          if (run.type === 'sprint' || run.type === 'race' || run.type === 'pinkslip') G.missionProg = `Checkpoint ${Math.min(run.idx + 1, cpCount)}/${cpCount} · ${formatClock(run.timer)}`;
          else if (run.type === 'timetrial') G.missionProg = `Checkpoint ${Math.min(run.idx + 1, cpCount)}/${cpCount} · ${formatClock(run.timer)} / par ${formatClock(run.par)}`;
          else if (run.type === 'delivery') G.missionProg = `Deliver in ${formatClock(run.timer)} — keep it clean`;
          else G.missionProg = 'Reach the beacon';
        }
      }
    }
  });
}
