// Story jobs around the bay: beacon givers, every job shape,
// timed rush runs, turf income and the HQ garage roster.
import * as THREE from 'three';
import { CFG, DISTRICTS, CARS, CAST, MISSIONS } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite, roadRoute } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';
const SPOT_TABLE_M = {};
SPOT_TABLE_M.port = { x: -412.5, z: 470 }; SPOT_TABLE_M.coral = { x: 495, z: 495 };
SPOT_TABLE_M.neon = { x: 330, z: -330 }; SPOT_TABLE_M.hoshino = { x: -90, z: -380 };
function spotForM(keyM) { const hitM = SPOT_TABLE_M[keyM]; return hitM ? hitM : SPOT_TABLE_M.port; }
const LADDER_M = []; LADDER_M.push(0, 40, 110, 220); LADDER_M.push(380, 600, 900);
const HOME_GARAGE_M = { x: -412.5, z: 455 };
function wrapGapM(wantM, haveM) {
  let remM = wantM + (-haveM);
  while (remM > Math.PI) remM = remM + (-(Math.PI * 2));
  while (-Math.PI > remM) remM = remM + (Math.PI * 2);
  return remM; }
function spanM(axM, azM, bxM, bzM) { return Math.hypot(axM + (-bxM), azM + (-bzM)); }
const MIN_LEN_M = 60;
function clockLabelM(rawM) {
  const ceilM = Math.max(0, Math.ceil(rawM));
  const minsM = Math.floor(ceilM / MIN_LEN_M); const secsM = String(ceilM % MIN_LEN_M).padStart(2, '0');
  return `${minsM}:${secsM}`; }
function actorPtM(G) {
  const seatedM = G.car && G.flags.inCar; const entM = seatedM ? G.car : G.player;
  const ptM = {}; ptM.x = entM.x; ptM.z = entM.z; return ptM; }
function badgeSpriteM(glyphM, fillM) {
  const cvM = document.createElement('canvas'); cvM.width = 128; cvM.height = 128;
  const cxM = cvM.getContext('2d');
  cxM.fillStyle = fillM || '#ffd23f';
  cxM.beginPath(); cxM.arc(64, 64, 52, 0, Math.PI * 2); cxM.fill();
  cxM.lineWidth = 7; cxM.strokeStyle = '#14100a'; cxM.stroke();
  cxM.fillStyle = '#14100a'; cxM.font = 'bold 64px Arial, sans-serif';
  cxM.textAlign = 'center'; cxM.textBaseline = 'middle';
  cxM.fillText(glyphM || '!', 64, 68);
  const txM = new THREE.CanvasTexture(cvM);
  const sprM = new THREE.Sprite(new THREE.SpriteMaterial({ map: txM, transparent: true, depthTest: false }));
  sprM.scale.set(3.2, 3.2, 1);
  return sprM; }
function arcLensM(pathM) {
  const accM = [0];
  for (let walkM = accM.length; walkM < pathM.length; walkM++) {
    const hereM = pathM[walkM]; const prevM = pathM[walkM - 1];
    accM.push(accM[walkM - 1] + spanM(hereM.x, hereM.z, prevM.x, prevM.z)); }
  return accM; }
function pointAtArcM(pathM, accM, wantM) {
  let segM = 1;
  while (segM < accM.length - 1 && accM[segM] < wantM) segM++;
  const spanSegM = (accM[segM] + (-accM[segM - 1])) || 1;
  const fracM = (wantM + (-accM[segM - 1])) / spanSegM;
  const fromM = pathM[segM - 1]; const toM = pathM[segM];
  const ptM = {}; ptM.x = fromM.x + ((toM.x + (-fromM.x)) * fracM); ptM.z = fromM.z + ((toM.z + (-fromM.z)) * fracM);
  return ptM; }
function buildCpsM(G, fromM, toM, wantCountM) {
  const rawRouteM = roadRoute(G, fromM, toM) || [fromM, toM];
  const cleanM = [];
  for (const rawM of rawRouteM) cleanM.push({ x: rawM.x, z: rawM.z });
  if (!(cleanM.length > 0)) return [{ x: toM.x, z: toM.z }];
  const lensM = arcLensM(cleanM);
  const totalM = lensM[lensM.length - 1] || 1;
  const autoM = Math.max(2, Math.round(totalM / 120));
  const finalM = Math.max(1, wantCountM || autoM);
  const pickedM = [];
  for (let stepM = 1; stepM <= finalM; stepM++) pickedM.push(pointAtArcM(cleanM, lensM, (totalM * stepM) / finalM));
  pickedM[pickedM.length - 1] = { x: toM.x, z: toM.z };
  return pickedM; }
export function initMissions(G) {
  G.objective = null; G.missionIndex = G.missionIndex || 0;
  G.missionProg = ''; G.driftScore = 0; G.garageList = [];
  G.flags.garageOpen = !!G.flags.garageOpen;
  const S = { phase: 'giver', giverFig: null, giverMission: null, beacon: null, beaconLetter: null, chain: null, rush: null, rushTimer: 55, incomeT: 60, ePrev: false, numPrev: {}, prevPX: 0, prevPZ: 0, currentCarId: (G.garage && G.garage[0]) || 'hachi', zoneRing: null };
  function beaconMaterialM() {
    const matM = new THREE.MeshBasicMaterial();
    matM.color = new THREE.Color(0xffd23f); matM.transparent = true; matM.opacity = 0.35;
    matM.blending = THREE.AdditiveBlending; matM.depthWrite = false; matM.side = THREE.DoubleSide;
    return matM; }
  function buildBeaconM() {
    const rootM = new THREE.Group();
    const pillarM = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 20, 1, true), beaconMaterialM());
    pillarM.position.y = 7; rootM.add(pillarM);
    try { const haloM = glowSprite(0xffd23f, 5.4); haloM.position.y = 1.2; rootM.add(haloM); } catch (ignoredM) { /* decoration only */ }
    const letterM = badgeSpriteM('!', '#ffd23f');
    letterM.position.y = 6.5; rootM.add(letterM);
    rootM.visible = false; G.scene.add(rootM);
    S.beacon = rootM; S.beaconLetter = letterM; }
  buildBeaconM();
  function showBeaconM(wxM, wzM, glyphM, colM) {
    if (!S.beacon) return;
    S.beacon.position.set(wxM, groundH(wxM, wzM), wzM); S.beacon.visible = true;
    if (glyphM && S.beaconLetter) {
      const parentM = S.beaconLetter.parent; const keepYM = S.beaconLetter.position.y;
      parentM.remove(S.beaconLetter);
      S.beaconLetter = badgeSpriteM(glyphM, colM); S.beaconLetter.position.y = keepYM;
      parentM.add(S.beaconLetter); } }
  function hideBeaconM() { if (S.beacon) S.beacon.visible = false; }
  function dropRingM() { if (S.zoneRing) { G.scene.remove(S.zoneRing); S.zoneRing = null; } }
  function buildRingM(radiusM, colM) {
    dropRingM();
    const matM = new THREE.MeshBasicMaterial({ color: colM, transparent: true, opacity: 0.75 });
    const torusM = new THREE.Mesh(new THREE.TorusGeometry(radiusM, 0.35, 8, 48), matM);
    torusM.rotation.x = Math.PI / 2; G.scene.add(torusM); S.zoneRing = torusM;
    return torusM; }
  function currentDefM() { return MISSIONS.length > G.missionIndex ? MISSIONS[G.missionIndex] : null; }
  function clearGiverM() { if (S.giverFig) { G.scene.remove(S.giverFig); S.giverFig = null; } }
  function giverFigureM(defM, anchorM) {
    const personM = CAST[defM.giver];
    if (!personM) return personM;
    try {
      S.giverFig = makeFigure(personM);
      S.giverFig.position.set(anchorM.x, groundH(anchorM.x, anchorM.z), anchorM.z);
      S.giverFig.rotation.y = rr(0, Math.PI * 2); G.scene.add(S.giverFig);
    } catch (ignoredM) { S.giverFig = null; }
    return personM; }
  function stageGiverM() {
    clearGiverM();
    const defM = currentDefM();
    if (!defM) { G.objective = null; G.missionProg = ''; hideBeaconM(); return; }
    const anchorM = spotForM(defM.district);
    S.giverMission = defM;
    const personM = giverFigureM(defM, anchorM);
    const trimmedM = (personM?.name || defM.giver || '?').trim();
    const glyphM = trimmedM.charAt(0).toUpperCase();
    G.objective = { x: anchorM.x, z: anchorM.z, label: `${defM.title} — talk to ${personM?.name || defM.giver}`, letter: glyphM, giverId: defM.giver };
    G.missionProg = 'Go to the blip';
    showBeaconM(anchorM.x, anchorM.z, glyphM, '#ffd23f'); S.phase = 'giver'; }
  function routeSecsM(fromM, ptsM) {
    let sumM = 0; let cursorM = fromM;
    for (const cpM of ptsM) { sumM = sumM + spanM(cursorM.x, cursorM.z, cpM.x, cpM.z); cursorM = cpM; }
    return sumM / 17; }
  function rivalSetupM(runM, defM, startM) {
    runM.checkpoints = buildCpsM(G, startM, runM._dest, 4);
    runM.timer = routeSecsM(startM, runM.checkpoints) + 60;
    let specM = 'taiyo'; let driverM = 'dante'; let paintM = 0x7a1010;
    if (defM.id === 'm12') specM = 'svj'; else if (defM.id === 'm11') specM = 'gtr35';
    if (defM.id === 'm12') driverM = 'ryo'; else if (defM.id === 'm11') driverM = 'shun';
    if (defM.id === 'm12') paintM = 0x30343c; else if (defM.id === 'm11') paintM = 0x9aa0a6;
    runM.rubberF = rr(0.92, 1.08);
    runM.rival = spawnVehicle(G, specM, startM.x + 6, startM.z + 4, G.car ? G.car.angle : 0, { driver: driverM, color: paintM });
    runM.rivalSpeed = 0; }
  function tougeParM(runM) {
    let lenM = 0;
    for (let ciM = 1; ciM < runM.checkpoints.length; ciM++) lenM = lenM + spanM(runM.checkpoints[ciM].x, runM.checkpoints[ciM].z, runM.checkpoints[ciM - 1].x, runM.checkpoints[ciM - 1].z);
    return lenM / 21; }
  function setupTimetrialM(runM, defM, startM, destM) {
    if (G.touge && G.touge.length > 2 && defM.id === 'm6') {
      runM.checkpoints = G.touge.map((tpM) => ({ x: tpM.x, z: tpM.z }));
      runM.par = tougeParM(runM);
    } else { runM.checkpoints = buildCpsM(G, startM, destM, 5); runM.par = routeSecsM(startM, runM.checkpoints) + 25; }
    runM.timer = 0; }
  function setupDisableM(runM, startM) {
    G.flags.noDecay = true;
    G.wanted = Math.max(3, G.wanted);
    const angM = rr(0, Math.PI * 2);
    const txM = startM.x + (Math.sin(angM) * 55); const tzM = startM.z + (Math.cos(angM) * 55);
    runM.target = spawnVehicle(G, 'police', txM, tzM, rr(0, 6), { driver: 'cop', livery: 'police', lights: true });
    if (runM.target) { runM.target.health = 90; G.cops?.push(runM.target); }
    runM.checkpoints = []; }
  function setupJackM(runM, defM, anchorM) {
    const specM = typeof defM.need === 'string' && CARS[defM.need] ? defM.need : 'sora15';
    const angM = rr(0, Math.PI * 2);
    const jxM = anchorM.x + (Math.sin(angM) * 70); const jzM = anchorM.z + (Math.cos(angM) * 70);
    runM.target = spawnVehicle(G, specM, jxM, jzM, rr(0, 6), { driver: 'parked', glow: true });
    runM.stage = 'steal'; runM.checkpoints = [{ x: jxM, z: jzM }]; }
  function setupHoldM(runM, destM) {
    runM.checkpoints = [destM]; runM.holdT = 0;
    G.wanted = Math.max(2, G.wanted);
    runM.rivals = [];
    for (let hM = 0; hM < 2; hM++) {
      const angM = rr(0, Math.PI * 2);
      const vehM = spawnVehicle(G, pick(['hatch', 'sedan', 'kei']), destM.x + (Math.sin(angM) * 45), destM.z + (Math.cos(angM) * 45), rr(0, 6), { driver: 'dante' });
      if (vehM) runM.rivals.push(vehM); } }
  function launchChainM(defM) {
    const anchorM = spotForM(defM.district);
    const startM = actorPtM(G);
    const destM = { x: anchorM.x + rr(-60, 60), z: anchorM.z + rr(-60, 60) };
    const runM = { m: defM, type: defM.type, idx: 0, checkpoints: [], timer: 0, par: 0, rival: null, rivalIdx: 0, target: null, done: false, startHealth: G.car ? (G.car.health ?? 100) : 100, driftTarget: 2000, holdT: 0, _dest: destM };
    const kindM = defM.type;
    const dispatchM = {
      'meet': () => { runM.checkpoints = [destM]; },
      'sprint': () => { runM.checkpoints = buildCpsM(G, startM, destM, 4); runM.timer = routeSecsM(startM, runM.checkpoints) + 35; },
      'delivery': () => { runM.checkpoints = [destM]; runM.timer = Math.max(35, spanM(startM.x, startM.z, destM.x, destM.z) / 16 + 18); },
      'drift': () => { runM.checkpoints = [destM]; runM.driftTarget = typeof defM.need === 'number' && defM.need > 100 ? defM.need : 2000; G.driftScore = 0; },
      'race': () => rivalSetupM(runM, defM, startM),
      'pinkslip': () => rivalSetupM(runM, defM, startM),
      'timetrial': () => setupTimetrialM(runM, defM, startM, destM),
      'disable': () => setupDisableM(runM, startM),
      'jack': () => setupJackM(runM, defM, anchorM),
      'hold': () => setupHoldM(runM, destM),
    };
    const handlerM = dispatchM[kindM];
    if (handlerM) handlerM(); else runM.checkpoints = [destM];
    S.chain = runM; S.phase = 'active'; aimObjectiveM(); }
  function aimObjectiveM() {
    const runM = S.chain; if (!runM) return;
    const defM = runM.m;
    if (runM.type === 'disable' && runM.target) {
      G.objective = { x: runM.target.x, z: runM.target.z, label: `${defM.title} — disable the interceptor`, letter: '!' };
      showBeaconM(runM.target.x, runM.target.z, '!', '#ff5c39'); return; }
    if (runM.type === 'jack' && runM.stage === 'deliver') {
      G.objective = { x: HOME_GARAGE_M.x, z: HOME_GARAGE_M.z, label: `${defM.title} — deliver to HQ garage`, letter: 'G' };
      showBeaconM(HOME_GARAGE_M.x, HOME_GARAGE_M.z, 'G', '#7dffb0'); return; }
    const cpM = runM.checkpoints[Math.min(runM.idx, runM.checkpoints.length - 1)];
    if (cpM) { G.objective = { x: cpM.x, z: cpM.z, label: defM.title, letter: '!' }; showBeaconM(cpM.x, cpM.z, '!', '#ffd23f'); } }
  function dismantleM() {
    const dyingM = S.chain; if (!dyingM) return;
    if (dyingM.type === 'disable') {
      G.flags.noDecay = false;
      if (dyingM.target && G.cops) { const idxM = G.cops.indexOf(dyingM.target); if (!(idxM < 0)) G.cops.splice(idxM, 1); } }
    dropRingM(); S.chain = null; }
  function failChainM(reasonM) {
    const defM = S.chain?.m;
    dismantleM();
    G.toast?.(reasonM || 'Mission failed — talk to the giver again'); G.audio?.play?.('fail'); stageGiverM();
    if (defM) G.missionProg = 'Failed — go back to the blip'; }
  function rewardCashM(runM, defM) {
    let cashM = defM.reward?.money || 0;
    if (runM.type === 'delivery') { const healthM = G.car ? (G.car.health ?? 100) : 100; cashM = cashM + Math.round(50 * (Math.max(0, healthM) / 100)); }
    return cashM; }
  function rankCheckM() {
    const titlesM = ['Rookie', 'Runner', 'Drifter', 'Street Ace', 'Night Captain', 'Bay Legend', 'Street King'];
    let rankM = 0;
    LADDER_M.forEach((stepM, idxM) => { if (G.rep >= stepM) rankM = idxM; });
    if (rankM > (G.rankIdx || 0)) { G.rankIdx = rankM; G.banner?.(`Rank up — ${titlesM[rankM]}`); } }
  function turfGainM(defM) {
    const zoneM = G.districtState?.[defM.district];
    if (zoneM) { zoneM.control = Math.min(100, (zoneM.control || 0) + 15); if (!(zoneM.control < 60)) zoneM.owner = 'ronin'; } }
  function pinkslipGainM() {
    if (!G.garage.includes('hero-gtr')) G.garage.push('hero-gtr');
    if (!G.ownedCars.includes('hero-gtr')) G.ownedCars.push('hero-gtr');
    G.flags.gotGhost = true; G.banner?.('Pink slip won — GHOST GT-R is yours'); }
  function completeM() {
    const runM = S.chain; const defM = runM.m;
    const cashM = rewardCashM(runM, defM); const repM = defM.reward?.rep || 0;
    G.money = (G.money || 0) + cashM; G.rep = (G.rep || 0) + repM;
    rankCheckM(); turfGainM(defM);
    if (defM.type === 'pinkslip') pinkslipGainM();
    dismantleM(); G.missionIndex = G.missionIndex + 1;
    if (G.missionIndex >= MISSIONS.length) {
      G.flags.campaignDone = true; G.banner?.('CAMPAIGN COMPLETE — Street King of Ronin Bay');
      G.objective = null; G.missionProg = ''; hideBeaconM();
    } else { G.banner?.(`${defM.title} complete — +$${cashM.toLocaleString('en-US')}`); stageGiverM(); }
    G.toast?.(`+$${cashM.toLocaleString('en-US')} · +${repM} REP`); G.audio?.play?.('complete'); G.saveGame?.(); }
  function driveVehM(GG, vehM, ptsM, cellM, dtM, paceM) {
    if (!vehM || cellM.i >= ptsM.length) return;
    const goalM = ptsM[cellM.i];
    const bearM = Math.atan2(goalM.x + (-vehM.x), goalM.z + (-vehM.z));
    const deltaM = wrapGapM(bearM, vehM.angle);
    vehM.angle = vehM.angle + THREE.MathUtils.clamp(deltaM, -1.9 * dtM, 1.9 * dtM);
    let goalPaceM = paceM;
    if (Math.abs(deltaM) > 0.7) goalPaceM = goalPaceM * 0.55;
    const paceNowM = vehM.speed || 0;
    vehM.speed = THREE.MathUtils.clamp(paceNowM + (Math.sign(goalPaceM + (-paceNowM)) * 10 * dtM), 0, goalPaceM + 6);
    vehM.x = vehM.x + (Math.sin(vehM.angle) * vehM.speed * dtM);
    vehM.z = vehM.z + (Math.cos(vehM.angle) * vehM.speed * dtM);
    vehM.mesh.position.set(vehM.x, groundH(vehM.x, vehM.z), vehM.z);
    vehM.mesh.rotation.y = vehM.angle;
    const udM = vehM.mesh.userData;
    if (udM?.wheels) { const wDeltaM = (vehM.speed * dtM) / (udM.wheelR || 0.34); const wheelsM = Object.values(udM.wheels); for (const wheelM of wheelsM) { if (wheelM) wheelM.rotation.x = wheelM.rotation.x + wDeltaM; } }
    if (11 > spanM(vehM.x, vehM.z, goalM.x, goalM.z)) cellM.i += 1; }
  function refreshGarageM() {
    const rowsM = [];
    for (const keyM of Object.keys(CARS)) { const specM = CARS[keyM]; rowsM.push({ id: keyM, name: specM.name || keyM, price: specM.price || 0, owned: G.garage.includes(keyM), current: keyM === S.currentCarId }); }
    G.garageList = rowsM; }
  refreshGarageM();
  function rollOutM(carIdM) {
    if (G.starterCar && G.starterCar !== G.car) {
      const oldM = G.starterCar;
      if (oldM.mesh) G.scene.remove(oldM.mesh);
      if (G.vehicles) { const idxM = G.vehicles.indexOf(oldM); if (!(idxM < 0)) G.vehicles.splice(idxM, 1); } }
    if (G.flags.inCar) { try { G.exitCar?.(); } catch (ignoredM) {} }
    const freshM = spawnVehicle(G, carIdM, HOME_GARAGE_M.x + 6, HOME_GARAGE_M.z + 8, Math.PI, { driver: 'parked' });
    if (freshM) { G.starterCar = freshM; S.currentCarId = carIdM; }
    refreshGarageM(); G.saveGame?.(); }
  function buySlotM(entryM) {
    G.money = G.money + (-entryM.price); G.garage.push(entryM.id);
    if (!G.ownedCars.includes(entryM.id)) G.ownedCars.push(entryM.id);
    rollOutM(entryM.id); G.banner?.(`${entryM.name} — yours`); G.audio?.play?.('buy'); }
  function chooseSlotM(slotM) {
    const entryM = G.garageList[slotM - 1]; if (!entryM) return;
    if (entryM.owned) { rollOutM(entryM.id); G.toast?.(`${entryM.name} rolled out`); }
    else if ((G.money || 0) >= entryM.price) buySlotM(entryM);
    else G.toast?.(`Need $${entryM.price.toLocaleString('en-US')} for the ${entryM.name}`);
    refreshGarageM(); }
  function keyHeldM(keyM) {
    const keysM = G.keys || {};
    const variantsM = [keyM, keyM.toLowerCase(), keyM.toUpperCase()];
    return variantsM.some((varM) => !!keysM[varM]); }
  function interactHeldM() { return ['KeyE', 'e'].some((codeM) => keyHeldM(codeM)); }
  stageGiverM();
  function incomeTickM(dt) {
    S.incomeT -= dt;
    if (S.incomeT > 0) return;
    S.incomeT = 60; let incomeM = 0;
    if (G.districtState) { for (const dM of DISTRICTS) { const stM = G.districtState[dM.id]; if (stM && stM.owner === 'ronin') incomeM = incomeM + Math.round((stM.control || 0) / 10); } }
    if (incomeM > 0) { G.money = (G.money || 0) + incomeM; G.toast?.(`District income +$${incomeM}`); } }
  function rushSpawnTickM(dt) {
    if (S.chain || S.rush) return;
    S.rushTimer -= dt;
    if (S.rushTimer > 0) return;
    S.rushTimer = 90;
    if (chance(0.5)) {
      const rushXM = pick(G.roadX) + rr(-8, 8); const rushZM = pick(G.roadZ) + rr(-8, 8);
      S.rush = { x: THREE.MathUtils.clamp(rushXM, -620, 620), z: THREE.MathUtils.clamp(rushZM, -620, 620), t: 40 };
      G.toast?.('Rush delivery — reach the pink blip in 40s for $150'); G.audio?.play?.('event'); } }
  function rushTickM(dt, posM) {
    if (!S.rush) return;
    S.rush.t -= dt;
    if (!S.chain) { G.objective = { x: S.rush.x, z: S.rush.z, label: `Rush delivery — ${clockLabelM(S.rush.t)}`, letter: '$' }; showBeaconM(S.rush.x, S.rush.z, '$', '#ff4fd8'); }
    if (7 > spanM(posM.x, posM.z, S.rush.x, S.rush.z)) {
      G.money = (G.money || 0) + 150; G.toast?.('Rush delivered — +$150'); G.audio?.play?.('complete');
      S.rush = null; if (!S.chain) stageGiverM();
    } else if (!(S.rush.t > 0)) { S.rush = null; if (!S.chain) stageGiverM(); } }
  function giverTickM(ePressedM, posM) {
    if (S.phase !== 'giver' || S.rush) return;
    const defM = currentDefM();
    if (!defM) return;
    const anchorM = spotForM(defM.district);
    const gapM = spanM(posM.x, posM.z, anchorM.x, anchorM.z);
    if ((ePressedM && 5 > gapM) || (6 > gapM && G.flags.inCar)) {
      if (6 > gapM) { clearGiverM(); G.showBriefing?.(defM.giver, defM.blurb); G.audio?.play?.('brief'); launchChainM(defM); } } }
  G.updaters.push((frameM, dt) => {
    function ringForM() {
      const runM = S.chain;
      if (!S.zoneRing) buildRingM(runM.type === 'drift' ? 40 : 26, runM.type === 'drift' ? 0xe879ff : 0xff5c39);
      return S.zoneRing; }
    const posM = actorPtM(G);
    const velXM = dt > 0 ? (posM.x + (-S.prevPX)) / dt : 0; const velZM = dt > 0 ? (posM.z + (-S.prevPZ)) / dt : 0;
    S.prevPX = posM.x; S.prevPZ = posM.z;
    const eDownM = interactHeldM(); const ePressedM = eDownM && !S.ePrev; S.ePrev = eDownM;
    if (S.beacon?.visible) { S.beacon.rotation.y = S.beacon.rotation.y + (dt * 0.8); if (S.beaconLetter) S.beaconLetter.position.y = 6.5 + (Math.sin(performance.now() * 0.003) * 0.5); }
    if (S.giverFig) S.giverFig.rotation.y = S.giverFig.rotation.y + (Math.sin(performance.now() * 0.001) * 0.0006);
    const nearGarageM = 7 > spanM(posM.x, posM.z, HOME_GARAGE_M.x, HOME_GARAGE_M.z);
    if (ePressedM && nearGarageM && S.phase !== 'active') { G.flags.garageOpen = !G.flags.garageOpen; if (G.flags.garageOpen) refreshGarageM(); }
    else if (ePressedM && G.flags.garageOpen) G.flags.garageOpen = false;
    if (G.flags.garageOpen) {
      for (let slotM = 1; slotM <= 9; slotM++) { const downM = keyHeldM('Digit' + slotM) || keyHeldM(String(slotM)); if (downM && !S.numPrev[slotM]) chooseSlotM(slotM); S.numPrev[slotM] = downM; } }
    incomeTickM(dt); rushSpawnTickM(dt); rushTickM(dt, posM); giverTickM(ePressedM, posM);
    const runM = S.chain;
    if (runM) {
      const defM = runM.m;
      const cpM = runM.checkpoints[Math.min(runM.idx, runM.checkpoints.length - 1)];
      const handlersM = {
        'disable': () => {
          if (runM.target) {
            aimObjectiveM();
            if (G.car && 5 > spanM(G.car.x, G.car.z, runM.target.x, runM.target.z) && (G.speedKmh || 0) > 25) runM.target.health = runM.target.health + (-(22 * dt * 3));
            G.missionProg = `Interceptor health ${Math.max(0, Math.ceil(runM.target.health))}%`; G.wanted = Math.max(3, G.wanted);
            if (25 > runM.target.health) completeM(); } },
        'drift': () => {
          const zoneM = runM.checkpoints[0]; const ringM = ringForM();
          if (ringM) ringM.position.set(zoneM.x, groundH(zoneM.x, zoneM.z) + 0.4, zoneM.z);
          const insideM = 40 > spanM(posM.x, posM.z, zoneM.x, zoneM.z);
          if (insideM && G.car && G.flags.inCar && G.flags.drifting) {
            const headVelM = Math.atan2(velXM, velZM); const slipM = Math.abs(wrapGapM(headVelM, G.car.angle)); const speedM = Math.hypot(velXM, velZM);
            if (speedM > 4) G.driftScore = G.driftScore + (slipM * speedM * dt * 9); }
          G.missionProg = `Drift ${Math.floor(G.driftScore).toLocaleString('en-US')} / ${runM.driftTarget.toLocaleString('en-US')}${insideM ? '' : ' — get to the zone'}`;
          if (G.driftScore >= runM.driftTarget) completeM(); },
        'jack': () => {
          if (runM.stage === 'steal') {
            aimObjectiveM(); G.missionProg = 'Steal the marked car';
            if (runM.target && G.car === runM.target) { runM.stage = 'deliver'; aimObjectiveM(); }
          } else {
            G.missionProg = 'Deliver it to the HQ garage';
            if (8 > spanM(posM.x, posM.z, HOME_GARAGE_M.x, HOME_GARAGE_M.z) && G.car === runM.target) completeM(); } },
        'hold': () => {
          const zoneM = runM.checkpoints[0]; const ringM = ringForM();
          if (ringM) ringM.position.set(zoneM.x, groundH(zoneM.x, zoneM.z) + 0.4, zoneM.z);
          const insideM = 26 > spanM(posM.x, posM.z, zoneM.x, zoneM.z);
          if (insideM) runM.holdT = runM.holdT + dt;
          G.wanted = Math.max(2, G.wanted);
          const rivalsM = runM.rivals || [];
          for (const hvM of rivalsM) { const cellM = { i: 0 }; driveVehM(G, hvM, [{ x: posM.x, z: posM.z }], cellM, dt, 7); }
          G.missionProg = `Hold the zone ${clockLabelM(45 + (-runM.holdT))}`;
          if (runM.holdT >= 45) completeM(); },
      };
      const chosenM = handlersM[runM.type];
      if (chosenM) chosenM();
      else {
        if (runM.timer > 0 && runM.type !== 'timetrial') { runM.timer -= dt; if (!(runM.timer > 0)) { failChainM('Out of time — talk to the giver again'); return; } }
        if (runM.type === 'timetrial') runM.timer = runM.timer + dt;
        if (runM.rival) {
          const capM = (G.car?.spec?.topSpeed || 160) / 3.6 * 0.62;
          const myPaceM = Math.max(6, Math.hypot(velXM, velZM)); const rubberM = THREE.MathUtils.clamp(myPaceM * (runM.rubberF || 1), 6, capM * 1.5);
          const cellM = { i: runM.rivalIdx }; driveVehM(G, runM.rival, runM.checkpoints, cellM, dt, rubberM); runM.rivalIdx = cellM.i;
          if (runM.rivalIdx >= runM.checkpoints.length) { failChainM('You lost the race — run it back'); return; } }
        if (cpM && 9 > spanM(posM.x, posM.z, cpM.x, cpM.z)) {
          runM.idx += 1; G.audio?.play?.('checkpoint');
          if (runM.idx >= runM.checkpoints.length) {
            if (runM.type === 'timetrial' && runM.timer > runM.par) { failChainM(`Too slow — par ${clockLabelM(runM.par)}`); return; }
            completeM(); return; }
          aimObjectiveM(); }
        const totalM = runM.checkpoints.length;
        if (runM.type === 'sprint' || runM.type === 'race' || runM.type === 'pinkslip') G.missionProg = `Checkpoint ${Math.min(runM.idx + 1, totalM)}/${totalM} · ${clockLabelM(runM.timer)}`;
        else if (runM.type === 'timetrial') G.missionProg = `Checkpoint ${Math.min(runM.idx + 1, totalM)}/${totalM} · ${clockLabelM(runM.timer)} / par ${clockLabelM(runM.par)}`;
        else if (runM.type === 'delivery') G.missionProg = `Deliver in ${clockLabelM(runM.timer)} — keep it clean`;
        else G.missionProg = 'Reach the beacon'; }
      if (S.chain !== runM) return; }
  });
}
