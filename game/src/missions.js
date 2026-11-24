// Story jobs for the bay: beacon givers, every job shape,
// timed rush runs, turf income and the HQ garage roster.
import * as THREE from 'three';
import { CFG, DISTRICTS, CARS, CAST, MISSIONS } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite, roadRoute } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';
const SPOT_TABLE_W = {};
SPOT_TABLE_W.port = { x: -412.5, z: 470 }; SPOT_TABLE_W.coral = { x: 495, z: 495 };
SPOT_TABLE_W.neon = { x: 330, z: -330 }; SPOT_TABLE_W.hoshino = { x: -90, z: -380 };
function spotForW(keyW) { const hitW = SPOT_TABLE_W[keyW]; return hitW || SPOT_TABLE_W.port; }
const LADDER_W = []; LADDER_W.push(0, 40, 110, 220); LADDER_W.push(380, 600, 900);
const HOME_GARAGE_W = { x: -412.5, z: 455 };
function wrapGapW(wantW, haveW) {
  let remW = wantW + (-haveW);
  while (remW > Math.PI) remW = remW + (-(Math.PI * 2));
  while (-Math.PI > remW) remW = remW + (Math.PI * 2);
  return remW; }
function spanW(axW, azW, bxW, bzW) { return Math.hypot(axW + (-bxW), azW + (-bzW)); }
const MIN_LEN_W = 60;
function clockLabelW(rawW) {
  const ceilW = Math.max(0, Math.ceil(rawW));
  const minsW = Math.floor(ceilW / MIN_LEN_W); const secsW = String(ceilW % MIN_LEN_W).padStart(2, '0');
  return `${minsW}:${secsW}`; }
function actorPtW(G) {
  const seatedW = G.car && G.flags.inCar;
  const entW = seatedW ? G.car : G.player;
  const outW = {}; outW.x = entW.x; outW.z = entW.z; return outW; }
function badgeSpriteW(glyphW, fillW) {
  const cvW = document.createElement('canvas');
  cvW.width = 128; cvW.height = 128;
  const cxW = cvW.getContext('2d');
  cxW.fillStyle = fillW || '#ffd23f';
  cxW.beginPath(); cxW.arc(64, 64, 52, 0, Math.PI * 2); cxW.fill();
  cxW.lineWidth = 7; cxW.strokeStyle = '#14100a'; cxW.stroke();
  cxW.fillStyle = '#14100a'; cxW.font = 'bold 64px Arial, sans-serif';
  cxW.textAlign = 'center'; cxW.textBaseline = 'middle';
  cxW.fillText(glyphW || '!', 64, 68);
  const txW = new THREE.CanvasTexture(cvW);
  const sprW = new THREE.Sprite(new THREE.SpriteMaterial({ map: txW, transparent: true, depthTest: false }));
  sprW.scale.set(3.2, 3.2, 1);
  return sprW; }
function arcLensW(pathW) {
  const accW = [0];
  let walkW = accW.length;
  while (walkW < pathW.length) {
    const hereW = pathW[walkW]; const prevW = pathW[walkW - 1];
    accW.push(accW[walkW - 1] + spanW(hereW.x, hereW.z, prevW.x, prevW.z));
    walkW++; }
  return accW; }
function pointAtArcW(pathW, accW, wantW) {
  let segW = 1;
  while (segW < accW.length - 1 && accW[segW] < wantW) segW++;
  const spanSegW = (accW[segW] + (-accW[segW - 1])) || 1;
  const fracW = (wantW + (-accW[segW - 1])) / spanSegW;
  const fromW = pathW[segW - 1]; const toW = pathW[segW];
  const outW = {}; outW.x = fromW.x + ((toW.x + (-fromW.x)) * fracW); outW.z = fromW.z + ((toW.z + (-fromW.z)) * fracW);
  return outW; }
function buildCpsW(G, fromW, toW, wantCountW) {
  const rawRouteW = roadRoute(G, fromW, toW) || [fromW, toW];
  const cleanW = [];
  for (const rawW of rawRouteW) cleanW.push({ x: rawW.x, z: rawW.z });
  if (!(cleanW.length > 0)) return [{ x: toW.x, z: toW.z }];
  const lensW = arcLensW(cleanW);
  const totalW = lensW[lensW.length - 1] || 1;
  const autoW = Math.max(2, Math.round(totalW / 120));
  const finalW = Math.max(1, wantCountW || autoW);
  const pickedW = [];
  let stepW = 1;
  while (stepW <= finalW) { pickedW.push(pointAtArcW(cleanW, lensW, (totalW * stepW) / finalW)); stepW++; }
  pickedW[pickedW.length - 1] = { x: toW.x, z: toW.z };
  return pickedW; }
export function initMissions(G) {
  G.objective = null; G.missionIndex = G.missionIndex || 0;
  G.missionProg = ''; G.driftScore = 0; G.garageList = [];
  G.flags.garageOpen = !!G.flags.garageOpen;
  const S = { phase: 'giver', giverFig: null, giverMission: null, beacon: null, beaconLetter: null, chain: null, rush: null, rushTimer: 55, incomeT: 60, ePrev: false, numPrev: {}, prevPX: 0, prevPZ: 0, currentCarId: (G.garage && G.garage[0]) || 'hachi', zoneRing: null };
  function beaconMatW() {
    const matW = new THREE.MeshBasicMaterial();
    matW.color = new THREE.Color(0xffd23f); matW.transparent = true; matW.opacity = 0.35;
    matW.blending = THREE.AdditiveBlending; matW.depthWrite = false; matW.side = THREE.DoubleSide;
    return matW; }
  function buildBeaconW() {
    const rootW = new THREE.Group();
    const pillarW = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 20, 1, true), beaconMatW());
    pillarW.position.y = 7; rootW.add(pillarW);
    try { const haloW = glowSprite(0xffd23f, 5.4); haloW.position.y = 1.2; rootW.add(haloW); } catch (errW) { /* decoration only */ }
    const letterW = badgeSpriteW('!', '#ffd23f');
    letterW.position.y = 6.5; rootW.add(letterW);
    rootW.visible = false; G.scene.add(rootW);
    S.beacon = rootW; S.beaconLetter = letterW; }
  buildBeaconW();
  function showBeaconW(wxW, wzW, glyphW, colW) {
    if (!S.beacon) return;
    S.beacon.position.set(wxW, groundH(wxW, wzW), wzW); S.beacon.visible = true;
    if (glyphW && S.beaconLetter) {
      const parentW = S.beaconLetter.parent; const keepYW = S.beaconLetter.position.y;
      parentW.remove(S.beaconLetter);
      S.beaconLetter = badgeSpriteW(glyphW, colW); S.beaconLetter.position.y = keepYW;
      parentW.add(S.beaconLetter); } }
  function hideBeaconW() { if (S.beacon) S.beacon.visible = false; }
  function dropRingW() { if (S.zoneRing) { G.scene.remove(S.zoneRing); S.zoneRing = null; } }
  function buildRingW(radiusW, colW) {
    dropRingW();
    const matW = new THREE.MeshBasicMaterial({ color: colW, transparent: true, opacity: 0.75 });
    const torusW = new THREE.Mesh(new THREE.TorusGeometry(radiusW, 0.35, 8, 48), matW);
    torusW.rotation.x = Math.PI / 2; G.scene.add(torusW); S.zoneRing = torusW;
    return torusW; }
  function currentDefW() { return MISSIONS.length > G.missionIndex ? MISSIONS[G.missionIndex] : null; }
  function clearGiverW() { if (S.giverFig) { G.scene.remove(S.giverFig); S.giverFig = null; } }
  function giverFigureW(defW, anchorW) {
    const personW = CAST[defW.giver];
    if (!personW) return personW;
    try {
      S.giverFig = makeFigure(personW);
      S.giverFig.position.set(anchorW.x, groundH(anchorW.x, anchorW.z), anchorW.z);
      S.giverFig.rotation.y = rr(0, Math.PI * 2); G.scene.add(S.giverFig);
    } catch (errW) { S.giverFig = null; }
    return personW; }
  function stageGiverW() {
    clearGiverW();
    const defW = currentDefW();
    if (!defW) { G.objective = null; G.missionProg = ''; hideBeaconW(); return; }
    const anchorW = spotForW(defW.district);
    S.giverMission = defW;
    const personW = giverFigureW(defW, anchorW);
    const trimmedW = (personW?.name || defW.giver || '?').trim();
    const glyphW = trimmedW.charAt(0).toUpperCase();
    G.objective = { x: anchorW.x, z: anchorW.z, label: `${defW.title} — talk to ${personW?.name || defW.giver}`, letter: glyphW, giverId: defW.giver };
    G.missionProg = 'Go to the blip';
    showBeaconW(anchorW.x, anchorW.z, glyphW, '#ffd23f'); S.phase = 'giver'; }
  function routeSecsW(fromW, ptsW) {
    let sumW = 0; let cursorW = fromW;
    for (const cpW of ptsW) { sumW = sumW + spanW(cursorW.x, cursorW.z, cpW.x, cpW.z); cursorW = cpW; }
    return sumW / 17; }
  function rivalSetupW(runW, defW, startW) {
    runW.checkpoints = buildCpsW(G, startW, runW._dest, 4);
    runW.timer = routeSecsW(startW, runW.checkpoints) + 60;
    let specW = 'taiyo'; let driverW = 'dante'; let paintW = 0x7a1010;
    if (defW.id === 'm12') specW = 'svj'; else if (defW.id === 'm11') specW = 'gtr35';
    if (defW.id === 'm12') driverW = 'ryo'; else if (defW.id === 'm11') driverW = 'shun';
    if (defW.id === 'm12') paintW = 0x30343c; else if (defW.id === 'm11') paintW = 0x9aa0a6;
    runW.rubberF = rr(0.92, 1.08);
    runW.rival = spawnVehicle(G, specW, startW.x + 6, startW.z + 4, G.car ? G.car.angle : 0, { driver: driverW, color: paintW });
    runW.rivalSpeed = 0; }
  function setupTimetrialW(runW, defW, startW, destW) {
    if (G.touge && G.touge.length > 2 && defW.id === 'm6') {
      runW.checkpoints = G.touge.map((tpW) => ({ x: tpW.x, z: tpW.z }));
      let lenW = 0;
      let ciW = 1;
      while (ciW < runW.checkpoints.length) { lenW = lenW + spanW(runW.checkpoints[ciW].x, runW.checkpoints[ciW].z, runW.checkpoints[ciW - 1].x, runW.checkpoints[ciW - 1].z); ciW++; }
      runW.par = lenW / 21;
    } else { runW.checkpoints = buildCpsW(G, startW, destW, 5); runW.par = routeSecsW(startW, runW.checkpoints) + 25; }
    runW.timer = 0; }
  function setupDisableW(runW, startW) {
    G.flags.noDecay = true;
    G.wanted = Math.max(3, G.wanted);
    const angW = rr(0, Math.PI * 2);
    const txW = startW.x + (Math.sin(angW) * 55); const tzW = startW.z + (Math.cos(angW) * 55);
    runW.target = spawnVehicle(G, 'police', txW, tzW, rr(0, 6), { driver: 'cop', livery: 'police', lights: true });
    if (runW.target) { runW.target.health = 90; G.cops?.push(runW.target); }
    runW.checkpoints = []; }
  function setupJackW(runW, defW, anchorW) {
    const specW = typeof defW.need === 'string' && CARS[defW.need] ? defW.need : 'sora15';
    const angW = rr(0, Math.PI * 2);
    const jxW = anchorW.x + (Math.sin(angW) * 70); const jzW = anchorW.z + (Math.cos(angW) * 70);
    runW.target = spawnVehicle(G, specW, jxW, jzW, rr(0, 6), { driver: 'parked', glow: true });
    runW.stage = 'steal'; runW.checkpoints = [{ x: jxW, z: jzW }]; }
  function setupHoldW(runW, destW) {
    runW.checkpoints = [destW]; runW.holdT = 0;
    G.wanted = Math.max(2, G.wanted);
    runW.rivals = [];
    let hW = 0;
    while (hW < 2) {
      const angW = rr(0, Math.PI * 2);
      const vehW = spawnVehicle(G, pick(['hatch', 'sedan', 'kei']), destW.x + (Math.sin(angW) * 45), destW.z + (Math.cos(angW) * 45), rr(0, 6), { driver: 'dante' });
      if (vehW) runW.rivals.push(vehW);
      hW++; } }
  function launchChainW(defW) {
    const anchorW = spotForW(defW.district);
    const startW = actorPtW(G);
    const destW = { x: anchorW.x + rr(-60, 60), z: anchorW.z + rr(-60, 60) };
    const runW = { m: defW, type: defW.type, idx: 0, checkpoints: [], timer: 0, par: 0, rival: null, rivalIdx: 0, target: null, done: false, startHealth: G.car ? (G.car.health ?? 100) : 100, driftTarget: 2000, holdT: 0, _dest: destW };
    const kindW = defW.type;
    const dispatchW = {
      'meet': () => { runW.checkpoints = [destW]; },
      'sprint': () => { runW.checkpoints = buildCpsW(G, startW, destW, 4); runW.timer = routeSecsW(startW, runW.checkpoints) + 35; },
      'delivery': () => { runW.checkpoints = [destW]; runW.timer = Math.max(35, spanW(startW.x, startW.z, destW.x, destW.z) / 16 + 18); },
      'drift': () => { runW.checkpoints = [destW]; runW.driftTarget = typeof defW.need === 'number' && defW.need > 100 ? defW.need : 2000; G.driftScore = 0; },
      'race': () => rivalSetupW(runW, defW, startW),
      'pinkslip': () => rivalSetupW(runW, defW, startW),
      'timetrial': () => setupTimetrialW(runW, defW, startW, destW),
      'disable': () => setupDisableW(runW, startW),
      'jack': () => setupJackW(runW, defW, anchorW),
      'hold': () => setupHoldW(runW, destW),
    };
    const handlerW = dispatchW[kindW];
    if (handlerW) handlerW(); else runW.checkpoints = [destW];
    S.chain = runW; S.phase = 'active'; aimObjectiveW(); }
  function aimObjectiveW() {
    const runW = S.chain; if (!runW) return;
    const defW = runW.m;
    if (runW.type === 'disable' && runW.target) {
      G.objective = { x: runW.target.x, z: runW.target.z, label: `${defW.title} — disable the interceptor`, letter: '!' };
      showBeaconW(runW.target.x, runW.target.z, '!', '#ff5c39'); return; }
    if (runW.type === 'jack' && runW.stage === 'deliver') {
      G.objective = { x: HOME_GARAGE_W.x, z: HOME_GARAGE_W.z, label: `${defW.title} — deliver to HQ garage`, letter: 'G' };
      showBeaconW(HOME_GARAGE_W.x, HOME_GARAGE_W.z, 'G', '#7dffb0'); return; }
    const cpW = runW.checkpoints[Math.min(runW.idx, runW.checkpoints.length - 1)];
    if (cpW) { G.objective = { x: cpW.x, z: cpW.z, label: defW.title, letter: '!' }; showBeaconW(cpW.x, cpW.z, '!', '#ffd23f'); } }
  function dismantleW() {
    const dyingW = S.chain; if (!dyingW) return;
    if (dyingW.type === 'disable') {
      G.flags.noDecay = false;
      if (dyingW.target && G.cops) { const idxW = G.cops.indexOf(dyingW.target); if (!(idxW < 0)) G.cops.splice(idxW, 1); } }
    dropRingW(); S.chain = null; }
  function failChainW(reasonW) {
    const defW = S.chain?.m;
    dismantleW();
    G.toast?.(reasonW || 'Mission failed — talk to the giver again'); G.audio?.play?.('fail'); stageGiverW();
    if (defW) G.missionProg = 'Failed — go back to the blip'; }
  function rewardCashW(runW, defW) {
    let cashW = defW.reward?.money || 0;
    if (runW.type === 'delivery') { const healthW = G.car ? (G.car.health ?? 100) : 100; cashW = cashW + Math.round(50 * (Math.max(0, healthW) / 100)); }
    return cashW; }
  function rankCheckW() {
    const titlesW = ['Rookie', 'Runner', 'Drifter', 'Street Ace', 'Night Captain', 'Bay Legend', 'Street King'];
    let rankW = 0;
    LADDER_W.forEach((stepW, idxW) => { if (G.rep >= stepW) rankW = idxW; });
    if (rankW > (G.rankIdx || 0)) { G.rankIdx = rankW; G.banner?.(`Rank up — ${titlesW[rankW]}`); } }
  function turfGainW(defW) {
    const zoneW = G.districtState?.[defW.district];
    if (zoneW) { zoneW.control = Math.min(100, (zoneW.control || 0) + 15); if (!(zoneW.control < 60)) zoneW.owner = 'ronin'; } }
  function pinkslipGainW() {
    if (!G.garage.includes('hero-gtr')) G.garage.push('hero-gtr');
    if (!G.ownedCars.includes('hero-gtr')) G.ownedCars.push('hero-gtr');
    G.flags.gotGhost = true; G.banner?.('Pink slip won — GHOST GT-R is yours'); }
  function completeW() {
    const runW = S.chain; const defW = runW.m;
    const cashW = rewardCashW(runW, defW); const repW = defW.reward?.rep || 0;
    G.money = (G.money || 0) + cashW; G.rep = (G.rep || 0) + repW;
    rankCheckW();
    turfGainW(defW);
    if (defW.type === 'pinkslip') pinkslipGainW();
    dismantleW(); G.missionIndex = G.missionIndex + 1;
    if (G.missionIndex >= MISSIONS.length) {
      G.flags.campaignDone = true; G.banner?.('CAMPAIGN COMPLETE — Street King of Ronin Bay');
      G.objective = null; G.missionProg = ''; hideBeaconW();
    } else { G.banner?.(`${defW.title} complete — +$${cashW.toLocaleString('en-US')}`); stageGiverW(); }
    G.toast?.(`+$${cashW.toLocaleString('en-US')} · +${repW} REP`); G.audio?.play?.('complete'); G.saveGame?.(); }
  function driveVehW(GG, vehW, ptsW, cellW, dtW, paceW) {
    if (!vehW || cellW.i >= ptsW.length) return;
    const goalW = ptsW[cellW.i];
    const bearW = Math.atan2(goalW.x + (-vehW.x), goalW.z + (-vehW.z));
    const deltaW = wrapGapW(bearW, vehW.angle);
    vehW.angle = vehW.angle + THREE.MathUtils.clamp(deltaW, -1.9 * dtW, 1.9 * dtW);
    let goalPaceW = paceW;
    if (Math.abs(deltaW) > 0.7) goalPaceW = goalPaceW * 0.55;
    const paceNowW = vehW.speed || 0;
    vehW.speed = THREE.MathUtils.clamp(paceNowW + (Math.sign(goalPaceW + (-paceNowW)) * 10 * dtW), 0, goalPaceW + 6);
    vehW.x = vehW.x + (Math.sin(vehW.angle) * vehW.speed * dtW);
    vehW.z = vehW.z + (Math.cos(vehW.angle) * vehW.speed * dtW);
    vehW.mesh.position.set(vehW.x, groundH(vehW.x, vehW.z), vehW.z);
    vehW.mesh.rotation.y = vehW.angle;
    const udW = vehW.mesh.userData;
    if (udW?.wheels) { const wDeltaW = (vehW.speed * dtW) / (udW.wheelR || 0.34); Object.values(udW.wheels).forEach((wheelW) => { if (wheelW) wheelW.rotation.x = wheelW.rotation.x + wDeltaW; }); }
    if (11 > spanW(vehW.x, vehW.z, goalW.x, goalW.z)) cellW.i += 1; }
  function refreshGarageW() {
    const rowsW = [];
    for (const keyW of Object.keys(CARS)) { const specW = CARS[keyW]; rowsW.push({ id: keyW, name: specW.name || keyW, price: specW.price || 0, owned: G.garage.includes(keyW), current: keyW === S.currentCarId }); }
    G.garageList = rowsW; }
  refreshGarageW();
  function rollOutW(carIdW) {
    if (G.starterCar && G.starterCar !== G.car) {
      const oldW = G.starterCar;
      if (oldW.mesh) G.scene.remove(oldW.mesh);
      if (G.vehicles) { const idxW = G.vehicles.indexOf(oldW); if (!(idxW < 0)) G.vehicles.splice(idxW, 1); } }
    if (G.flags.inCar) { try { G.exitCar?.(); } catch (errW) {} }
    const freshW = spawnVehicle(G, carIdW, HOME_GARAGE_W.x + 6, HOME_GARAGE_W.z + 8, Math.PI, { driver: 'parked' });
    if (freshW) { G.starterCar = freshW; S.currentCarId = carIdW; }
    refreshGarageW(); G.saveGame?.(); }
  function buySlotW(entryW) {
    G.money = G.money + (-entryW.price); G.garage.push(entryW.id);
    if (!G.ownedCars.includes(entryW.id)) G.ownedCars.push(entryW.id);
    rollOutW(entryW.id); G.banner?.(`${entryW.name} — yours`); G.audio?.play?.('buy'); }
  function chooseSlotW(slotW) {
    const entryW = G.garageList[slotW - 1]; if (!entryW) return;
    if (entryW.owned) { rollOutW(entryW.id); G.toast?.(`${entryW.name} rolled out`); }
    else if ((G.money || 0) >= entryW.price) buySlotW(entryW);
    else G.toast?.(`Need $${entryW.price.toLocaleString('en-US')} for the ${entryW.name}`);
    refreshGarageW(); }
  function keyHeldW(keyW) {
    const keysW = G.keys || {};
    const variantsW = [keyW, keyW.toLowerCase(), keyW.toUpperCase()];
    return variantsW.some((varW) => !!keysW[varW]); }
  function interactHeldW() { return ['KeyE', 'e'].some((codeW) => keyHeldW(codeW)); }
  stageGiverW();
  function incomeTickW(dt) {
    S.incomeT -= dt;
    if (S.incomeT > 0) return;
    S.incomeT = 60; let incomeW = 0;
    if (G.districtState) DISTRICTS.forEach((dW) => { const stW = G.districtState[dW.id]; if (stW && stW.owner === 'ronin') incomeW = incomeW + Math.round((stW.control || 0) / 10); });
    if (incomeW > 0) { G.money = (G.money || 0) + incomeW; G.toast?.(`District income +$${incomeW}`); } }
  function rushSpawnTickW(dt) {
    if (S.chain || S.rush) return;
    S.rushTimer -= dt;
    if (S.rushTimer > 0) return;
    S.rushTimer = 90;
    if (chance(0.5)) {
      const rushXW = pick(G.roadX) + rr(-8, 8); const rushZW = pick(G.roadZ) + rr(-8, 8);
      S.rush = { x: THREE.MathUtils.clamp(rushXW, -620, 620), z: THREE.MathUtils.clamp(rushZW, -620, 620), t: 40 };
      G.toast?.('Rush delivery — reach the pink blip in 40s for $150'); G.audio?.play?.('event'); } }
  function rushTickW(dt, posW) {
    if (!S.rush) return;
    S.rush.t -= dt;
    if (!S.chain) { G.objective = { x: S.rush.x, z: S.rush.z, label: `Rush delivery — ${clockLabelW(S.rush.t)}`, letter: '$' }; showBeaconW(S.rush.x, S.rush.z, '$', '#ff4fd8'); }
    if (7 > spanW(posW.x, posW.z, S.rush.x, S.rush.z)) {
      G.money = (G.money || 0) + 150; G.toast?.('Rush delivered — +$150'); G.audio?.play?.('complete');
      S.rush = null; if (!S.chain) stageGiverW();
    } else if (!(S.rush.t > 0)) { S.rush = null; if (!S.chain) stageGiverW(); } }
  function giverTickW(ePressedW, posW) {
    if (S.phase !== 'giver' || S.rush) return;
    const defW = currentDefW();
    if (!defW) return;
    const anchorW = spotForW(defW.district);
    const gapW = spanW(posW.x, posW.z, anchorW.x, anchorW.z);
    if ((ePressedW && 5 > gapW) || (6 > gapW && G.flags.inCar)) {
      if (6 > gapW) { clearGiverW(); G.showBriefing?.(defW.giver, defW.blurb); G.audio?.play?.('brief'); launchChainW(defW); } } }
  G.updaters.push((frameW, dt) => {
    function ringForW() {
      const runW = S.chain;
      if (!S.zoneRing) buildRingW(runW.type === 'drift' ? 40 : 26, runW.type === 'drift' ? 0xe879ff : 0xff5c39);
      return S.zoneRing; }
    const posW = actorPtW(G);
    const velXW = dt > 0 ? (posW.x + (-S.prevPX)) / dt : 0; const velZW = dt > 0 ? (posW.z + (-S.prevPZ)) / dt : 0;
    S.prevPX = posW.x; S.prevPZ = posW.z;
    const eDownW = interactHeldW(); const ePressedW = eDownW && !S.ePrev; S.ePrev = eDownW;
    if (S.beacon?.visible) { S.beacon.rotation.y = S.beacon.rotation.y + (dt * 0.8); if (S.beaconLetter) S.beaconLetter.position.y = 6.5 + (Math.sin(performance.now() * 0.003) * 0.5); }
    if (S.giverFig) S.giverFig.rotation.y = S.giverFig.rotation.y + (Math.sin(performance.now() * 0.001) * 0.0006);
    const nearGarageW = 7 > spanW(posW.x, posW.z, HOME_GARAGE_W.x, HOME_GARAGE_W.z);
    if (ePressedW && nearGarageW && S.phase !== 'active') { G.flags.garageOpen = !G.flags.garageOpen; if (G.flags.garageOpen) refreshGarageW(); }
    else if (ePressedW && G.flags.garageOpen) G.flags.garageOpen = false;
    if (G.flags.garageOpen) {
      let slotW = 1;
      while (slotW <= 9) { const downW = keyHeldW('Digit' + slotW) || keyHeldW(String(slotW)); if (downW && !S.numPrev[slotW]) chooseSlotW(slotW); S.numPrev[slotW] = downW; slotW++; } }
    incomeTickW(dt);
    rushSpawnTickW(dt);
    rushTickW(dt, posW);
    giverTickW(ePressedW, posW);
    const runW = S.chain;
    if (runW) {
      const defW = runW.m;
      const cpW = runW.checkpoints[Math.min(runW.idx, runW.checkpoints.length - 1)];
      const handlersW = {
        'disable': () => {
          if (runW.target) {
            aimObjectiveW();
            if (G.car && 5 > spanW(G.car.x, G.car.z, runW.target.x, runW.target.z) && (G.speedKmh || 0) > 25) runW.target.health = runW.target.health + (-(22 * dt * 3));
            G.missionProg = `Interceptor health ${Math.max(0, Math.ceil(runW.target.health))}%`; G.wanted = Math.max(3, G.wanted);
            if (25 > runW.target.health) completeW(); } },
        'drift': () => {
          const zoneW = runW.checkpoints[0]; const ringW = ringForW();
          if (ringW) ringW.position.set(zoneW.x, groundH(zoneW.x, zoneW.z) + 0.4, zoneW.z);
          const insideW = 40 > spanW(posW.x, posW.z, zoneW.x, zoneW.z);
          if (insideW && G.car && G.flags.inCar && G.flags.drifting) {
            const headVelW = Math.atan2(velXW, velZW); const slipW = Math.abs(wrapGapW(headVelW, G.car.angle)); const speedW = Math.hypot(velXW, velZW);
            if (speedW > 4) G.driftScore = G.driftScore + (slipW * speedW * dt * 9); }
          G.missionProg = `Drift ${Math.floor(G.driftScore).toLocaleString('en-US')} / ${runW.driftTarget.toLocaleString('en-US')}${insideW ? '' : ' — get to the zone'}`;
          if (G.driftScore >= runW.driftTarget) completeW(); },
        'jack': () => {
          if (runW.stage === 'steal') {
            aimObjectiveW(); G.missionProg = 'Steal the marked car';
            if (runW.target && G.car === runW.target) { runW.stage = 'deliver'; aimObjectiveW(); }
          } else {
            G.missionProg = 'Deliver it to the HQ garage';
            if (8 > spanW(posW.x, posW.z, HOME_GARAGE_W.x, HOME_GARAGE_W.z) && G.car === runW.target) completeW(); } },
        'hold': () => {
          const zoneW = runW.checkpoints[0]; const ringW = ringForW();
          if (ringW) ringW.position.set(zoneW.x, groundH(zoneW.x, zoneW.z) + 0.4, zoneW.z);
          const insideW = 26 > spanW(posW.x, posW.z, zoneW.x, zoneW.z);
          if (insideW) runW.holdT = runW.holdT + dt;
          G.wanted = Math.max(2, G.wanted);
          (runW.rivals || []).forEach((hvW) => { const cellW = { i: 0 }; driveVehW(G, hvW, [{ x: posW.x, z: posW.z }], cellW, dt, 7); });
          G.missionProg = `Hold the zone ${clockLabelW(45 + (-runW.holdT))}`;
          if (runW.holdT >= 45) completeW(); },
      };
      const chosenW = handlersW[runW.type];
      if (chosenW) chosenW();
      else {
        if (runW.timer > 0 && runW.type !== 'timetrial') { runW.timer -= dt; if (!(runW.timer > 0)) { failChainW('Out of time — talk to the giver again'); return; } }
        if (runW.type === 'timetrial') runW.timer = runW.timer + dt;
        if (runW.rival) {
          const capW = (G.car?.spec?.topSpeed || 160) / 3.6 * 0.62;
          const myPaceW = Math.max(6, Math.hypot(velXW, velZW)); const rubberW = THREE.MathUtils.clamp(myPaceW * (runW.rubberF || 1), 6, capW * 1.5);
          const cellW = { i: runW.rivalIdx }; driveVehW(G, runW.rival, runW.checkpoints, cellW, dt, rubberW); runW.rivalIdx = cellW.i;
          if (runW.rivalIdx >= runW.checkpoints.length) { failChainW('You lost the race — run it back'); return; } }
        if (cpW && 9 > spanW(posW.x, posW.z, cpW.x, cpW.z)) {
          runW.idx += 1; G.audio?.play?.('checkpoint');
          if (runW.idx >= runW.checkpoints.length) {
            if (runW.type === 'timetrial' && runW.timer > runW.par) { failChainW(`Too slow — par ${clockLabelW(runW.par)}`); return; }
            completeW(); return; }
          aimObjectiveW(); }
        const totalW = runW.checkpoints.length;
        if (runW.type === 'sprint' || runW.type === 'race' || runW.type === 'pinkslip') G.missionProg = `Checkpoint ${Math.min(runW.idx + 1, totalW)}/${totalW} · ${clockLabelW(runW.timer)}`;
        else if (runW.type === 'timetrial') G.missionProg = `Checkpoint ${Math.min(runW.idx + 1, totalW)}/${totalW} · ${clockLabelW(runW.timer)} / par ${clockLabelW(runW.par)}`;
        else if (runW.type === 'delivery') G.missionProg = `Deliver in ${clockLabelW(runW.timer)} — keep it clean`;
        else G.missionProg = 'Reach the beacon'; }
      if (S.chain !== runW) return; }
  });
}
