// Screenshot staging lives in this module; every named mode
// arranges its scene exactly once, at the moment it is picked.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { applyCastFigureOverride, makeFigure, poseSeated } from './player.js';
import { applyNpcPoliceGlb, primeDamageSmoke, spawnVehicle } from './cars.js';
// Dusk clock readings shared by the vice family of modes.
const DUSK_TIMES = { street: 18.1, vice: 17.9, houses: 17.8, markings: 17.9 };
// Midday clock readings for the later density modes.
const DAY_TIMES = { boulevard: 12.0, strip: 12.4, park: 12.2, houses: 12.8, markings: 11.6 };
// The shadow frustum a staged frame uses to tighten the sun box.
const SHADOW_BOX = { far: 600, box: 85, near: 10 };
function shadowBoxApply(camIn) {
  Object.assign(camIn, { near: SHADOW_BOX.near, far: SHADOW_BOX.far });
  // The edge-setting helper is folded in here; it had no other
  // caller, and the frustum edges still land in the same order.
  Object.assign(camIn, { left: -SHADOW_BOX.box, right: SHADOW_BOX.box, top: SHADOW_BOX.box, bottom: -SHADOW_BOX.box });
  camIn.updateProjectionMatrix(); }
function aimSun(stage, sunIn, focusX, focusZ) {
  const tgtIn = sunIn.target;
  tgtIn.position.set(focusX, groundH(focusX, focusZ), focusZ);
  if (stage.scene && !tgtIn.parent) stage.scene.add(tgtIn);
  tgtIn.updateMatrixWorld(); }
function shadowPin(stage, focusX, focusZ) {
  const sunIn = stage.sun;
  const camOk = sunIn && sunIn.shadow && sunIn.shadow.camera;
  if (!camOk) return;
  try { shadowBoxApply(sunIn.shadow.camera);
    if (sunIn.target) aimSun(stage, sunIn, focusX, focusZ); } catch (muteErr) {} }
function castDrop(stage, castId, pxVal, pzVal, headingVal) {
  const figOut = makeFigure(CAST[castId]);
  applyCastFigureOverride(figOut, castId);
  figOut.position.set(pxVal, groundH(pxVal, pzVal), pzVal);
  figOut.rotation.y = headingVal || 0;
  stage.scene.add(figOut);
  return figOut; }
function poseCamNow(stage, camX, camY, camZ, lookX, lookY, lookZ) {
  const camIn = stage.camera;
  Object.assign(camIn, { fov: 60 });
  camIn.position.set(camX, camY, camZ);
  camIn.lookAt(lookX, lookY, lookZ);
  camIn.updateProjectionMatrix(); }
function camFix(stage, camX, camY, camZ, lookX, lookY, lookZ) {
  stage.shotCam = () => poseCamNow(stage, camX, camY, camZ, lookX, lookY, lookZ);
  stage.shotCam(); }
export function setupShot(stage, modeIn) {
  stage.shot = modeIn;
  stage.shotMode = modeIn;
  const repinShot = () => { if (stage.shotCam) stage.shotCam(); };
  function stageRearView() {
    stage.timeOfDay = 10.5;
    const rideArr = stage.vehicles || [];
    const showCar = rideArr.find((vehNode) => vehNode && ('svj' === vehNode.specId));
    if (showCar) showCar._brakeStaged = true;
    const tailMatNode = showCar && showCar.mesh && showCar.mesh.userData.tailMat;
    if (tailMatNode) tailMatNode.emissiveIntensity = 2.4;
    camFix(stage, -435.2, 0.95, 447.8, -430.2, 0.72, 452.2); }
  switch (modeIn) {
    case ('city'): case ('cover'): {
      const rideNode = spawnVehicle(stage, 'hero-supra', 150, -148, 0.85, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 153.2, z: -144.6, angle: 0.8 });
        heroNode.fig.position.set(153.2, groundH(153.2, -144.6), -144.6);
        heroNode.fig.rotation.y = 0.8; }
      camFix(stage, 156.5, 1.35, -141.5, 150.5, 0.95, -148.5);
      void rideNode;
      try { const spotList = [];
        spotList.push([140, -138], [146, -133], [136, -143]);
        const scoutList = Array.isArray(stage.peds) ? stage.peds.filter((pedIn) => pedIn && pedIn.fig && !pedIn.downed) : [];
        const pickedList = [...allPeds.filter((pedIn) => pedIn.figIsGlb), ...allPeds.filter((pedIn) => !pedIn.figIsGlb)].slice(0, spotList.length);
        void scoutList;
        pickedList.forEach((pedIn, pickIdx) => {
          const pxVal = spotList[pickIdx][0]; const pzVal = spotList[pickIdx][1];
          pedIn.x = pxVal; pedIn.z = pzVal;
          pedIn.idle = false; pedIn.fleeT = 0; pedIn.fleeDir = null;
          pedIn.vertical = false;
          pedIn.off = (('number' === typeof pedIn.off) && (0 !== pedIn.off)) ? pedIn.off : 17.2;
          pedIn.line = (pzVal + -pedIn.off);
          pedIn.dir = 1; pedIn.angle = Math.PI / 2;
          try { pedIn.fig.position.set(pxVal, groundH(pxVal, pzVal), pzVal);
            pedIn.fig.rotation.y = pedIn.angle; } catch (muteErr) {} }); } catch (muteErr) {}
      break; }
    case ('meet'): {
      const meetRideKeys = ['hachi', 'sora15', 'hoshi7', 'kaze'];
      const meetRideXs = [-434, -422, -410, -398];
      meetRideKeys.forEach((carKey, carIdx) => spawnVehicle(stage, carKey, meetRideXs[carIdx], 446, 0, { driver: 'parked' }));
      const meetCastKeys = ['ren', 'ako', 'mika', 'jun'];
      meetCastKeys.forEach((castIdVal, castIdx) => castDrop(stage, castIdVal, (1.5 + meetRideXs[castIdx]), 451, 0));
      stage.timeOfDay = 11.5;
      camFix(stage, -433, 1.7, 458, -415, 1.0, 447);
      break; }
    case ('chase'): {
      stage.timeOfDay = 17.6;
      stage.heliShot = { altitude: 16, radius: 11 };
      const chaseRide = spawnVehicle(stage, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 100, z: 495, angle: Math.PI / 2 });
        heroNode.fig.position.set(100, groundH(100, 495), 495);
        heroNode.fig.rotation.y = Math.PI / 2;
        heroNode.fig.visible = false; }
      chaseRide.driver = 'player';
      stage.car = chaseRide;
      stage.flags.inCar = true;
      stage.updaters.push(() => { chaseRide.x = 100; chaseRide.z = 495;
        chaseRide.angle = Math.PI / 2;
        if (chaseRide.mesh) chaseRide.mesh.position.set(100, (0.02 + groundH(100, 495)), 495); });
      stage.wanted = 4;
      chaseRide.speed = 22; chaseRide.health = 45;
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      const seatFig = makeFigure(CAST.ren);
      poseSeated(seatFig);
      seatFig.position.set(-0.4, 0.42, 0.15);
      chaseRide.mesh.add(seatFig);
      stage.flags.flashCar = chaseRide;
      stage.flags.forceFlash = 'car';
      const copRideA = spawnVehicle(stage, 'police', 86, 489, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copRideA);
      const copRideB = spawnVehicle(stage, 'police', 82, 502, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copRideB);
      copRideA.staged = true; copRideB.staged = true;
      stage.cops.push(copRideA, copRideB);
      stage.flags.heliStage = { x: 100, z: 495 };
      camFix(stage, 112, 3.2, 478, 99, 1.2, 496);
      break; }
    case ('hero'): {
      camFix(stage, 114, 1.5, 479, 97, 0.9, 493);
      stage.updaters.push(repinShot);
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = 17.9;
      const rideNode = spawnVehicle(stage, 'taiyo', 100, 491, 1.2, { driver: 'parked' });
      void rideNode;
      break; }
    case ('svj'): {
      stage.timeOfDay = 10.5;
      camFix(stage, -425.8, 1.05, 445.8, -430.2, 0.72, 452.3);
      break; }
    case ('svjrear'): {
      stageRearView();
      break; }
    case ('lineup'): {
      const lineupKeys = [];
      lineupKeys.push('hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra','gtr35','svj');
      lineupKeys.forEach((carKey, carIdx) => spawnVehicle(stage, carKey, ((62 * carIdx) + -558), 487, Math.PI / 2, { driver: 'parked' }));
      camFix(stage, -545, 2.2, 468, -450, 1, 490);
      break; }
    case ('chars'): {
      const charsCastKeys = [];
      charsCastKeys.push('ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop', 'shun');
      charsCastKeys.forEach((castIdVal, castIdx) => castDrop(stage, castIdVal, ((7 * castIdx) + -436), 448, Math.PI));
      camFix(stage, -412, 1.5, 443.8, -412, 1.0, 448);
      break; }
    case ('versus'): {
      stage.timeOfDay = 17.8;
      spawnVehicle(stage, 'taiyo', 88, 491, 1.2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 97, z: 494.5, angle: Math.PI });
        heroNode.fig.position.set(97, groundH(97, 494.5), 494.5);
        heroNode.fig.rotation.y = Math.PI; }
      spawnVehicle(stage, 'gtr35', 112, 491, 1.2, { driver: 'parked' });
      castDrop(stage, 'shun', 104, 494.5, Math.PI);
      camFix(stage, 100, 1.6, 478, 100, 0.9, 492);
      break; }
    case ('mc'): {
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -406, z: 440, angle: 0 });
        heroNode.fig.position.set(-406, groundH(-406, 440), 440);
        heroNode.fig.rotation.y = 0; }
      camFix(stage, -406, 1.1, 442.2, -406, 1.0, 440);
      break; }
    case ('smg'): {
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -412.5, z: 440, angle: Math.PI });
        heroNode.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        heroNode.fig.rotation.y = Math.PI; }
      if (stage.weapons && stage.weapons.equip) stage.weapons.equip('smg');
      camFix(stage, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
      break; }
    case ('bat'): {
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -412.5, z: 440, angle: Math.PI });
        heroNode.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        heroNode.fig.rotation.y = Math.PI; }
      if (stage.weapons && stage.weapons.equip) stage.weapons.equip('bat');
      camFix(stage, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
      break; }
    case ('shootout'): {
      camFix(stage, 197.2, 1.6, -204.8, 200.3, 1.05, -199.3);
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 200, z: -200, angle: Math.atan2(-12, -8) });
        heroNode.fig.position.set(200, groundH(200, -200), -200);
        heroNode.fig.rotation.y = heroNode.angle;
        if (stage.weapons && stage.weapons.equip) stage.weapons.equip('pistol'); }
      stage.flags.forceFlash = 'foot';
      const downFig = castDrop(stage, 'ren', 202, -197.5, 0.6);
      downFig.rotation.x = -1.35;
      downFig.position.y = (0.15 + groundH(202, -197.5));
      const runFig = castDrop(stage, 'mika', 203.5, -196, Math.atan2(6, 7));
      runFig.rotation.x = 0.15;
      const copRide = spawnVehicle(stage, 'police', 204.5, -195, -2.36, { driver: 'cop' });
      applyNpcPoliceGlb(copRide);
      break; }
    case ('heli'): {
      spawnVehicle(stage, 'taiyo', -200, 300, 0.4, { driver: 'parked' });
      spawnVehicle(stage, 'police-suv', -192, 292, -2.4, { driver: 'cop' });
      stage.flags.heliStage = { x: -200, z: 300 };
      camFix(stage, -186, 2.0, 314, -198, 1.2, 298);
      break; }
    case ('street'): {
      stage.timeOfDay = 10.5;
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      spawnVehicle(stage, 'taiyo', 150, -128, Math.PI, { driver: 'parked' });
      camFix(stage, 161, 1.7, -133, 149, 1.5, -156);
      break; }
    case ('smoke'): {
      stage.timeOfDay = 10.5;
      camFix(stage, -405.4, 1.5, 446.6, -411.7, 0.9, 447.2);
      const smokeRide = spawnVehicle(stage, 'taiyo', -412.5, 446, 0.6, { driver: 'parked' });
      smokeRide.health = 12;
      primeDamageSmoke(stage, smokeRide, 12);
      let smokeAgeVal = 0;
      stage.updaters.push((frameIn, dtIn) => { smokeAgeVal = (smokeAgeVal + (dtIn || 0));
        if (smokeAgeVal >= 0.9) { smokeAgeVal = 0; primeDamageSmoke(stage, smokeRide, 12); } });
      break; }
    case ('night'): {
      stage.timeOfDay = 21.5;
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      const nightCar = spawnVehicle(stage, 'taiyo', 5, -40, 0, { driver: 'parked' });
      const seatFig = makeFigure(CAST.ren);
      poseSeated(seatFig);
      seatFig.position.set(-0.4, 0.42, 0.15);
      nightCar.mesh.add(seatFig);
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 14, z: -26, angle: Math.PI });
        heroNode.fig.position.set(14, groundH(14, -26), -26);
        heroNode.fig.rotation.y = Math.PI; }
      camFix(stage, 13, 2.0, -18, 2, 0.7, -58);
      stage.updaters.push(repinShot);
      break; }
    case ('markings'): {
      stage.timeOfDay = 10.5;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 14, z: -92 });
        heroNode.fig.position.set(14, groundH(14, -92), -92); }
      camFix(stage, 5.5, 1.3, -126, -1, 0.3, -160);
      stage.updaters.push(repinShot);
      break; }
    case ('sky'): {
      stage.timeOfDay = 8.8;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -34, z: -18 });
        heroNode.fig.position.set(-34, groundH(-34, -18), -18); }
      camFix(stage, -30, 1.8, -14, 17, 30, 10);
      stage.updaters.push(repinShot);
      break; }
    case ('busy'): {
      stage.timeOfDay = 11;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 176.5, z: 153.5, angle: Math.atan2(182.2 + -176.5, 147.8 + -153.5) });
        heroNode.fig.position.set(176.5, groundH(176.5, 153.5), 153.5);
        heroNode.fig.rotation.y = heroNode.angle; }
      try { const spotList = [];
        spotList.push({ x: 166, z: 147.8, vertical: false, dir: 1 }, { x: 198, z: 147.8, vertical: false, dir: -1 }, { x: 182.2, z: 158, vertical: true, dir: 1 });
        const candList = Array.isArray(stage.peds) ? stage.peds.filter((pedIn) => pedIn && pedIn.fig && !pedIn.downed && !pedIn.chat && !('cross' === pedIn.mode) && !pedIn.follow) : [];
        const pickedList = [...pool.filter((pedIn) => pedIn.figIsGlb), ...pool.filter((pedIn) => !pedIn.figIsGlb)].slice(0, spotList.length);
        void candList;
        pickedList.forEach((pedIn, pickIdx) => {
          const spotNode = spotList[pickIdx];
          pedIn.x = spotNode.x; pedIn.z = spotNode.z;
          pedIn.idle = false; pedIn.fleeT = 0; pedIn.fleeDir = null;
          pedIn.vertical = spotNode.vertical;
          pedIn.off = (('number' === typeof pedIn.off) && (0 !== pedIn.off)) ? pedIn.off : 17.2;
          pedIn.line = ((spotNode.vertical ? spotNode.x : spotNode.z) + -pedIn.off);
          pedIn.dir = spotNode.dir;
          pedIn.angle = spotNode.vertical ? ((0 < spotNode.dir) ? 0 : Math.PI) : ((0 < spotNode.dir) ? Math.PI / 2 : -Math.PI / 2);
          try { pedIn.fig.position.set(spotNode.x, groundH(spotNode.x, spotNode.z), spotNode.z);
            pedIn.fig.rotation.y = pedIn.angle; } catch (muteErr) {} }); } catch (muteErr) {}
      spawnVehicle(stage, 'taxi', 205, 171, -Math.PI / 2, { driver: 'parked' });
      camFix(stage, 177.5, 1.6, 142.5, 183, 1.1, 149);
      stage.updaters.push(repinShot);
      break; }
    case ('houses'): {
      stage.timeOfDay = 10.5;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -424, z: -370, angle: Math.PI });
        heroNode.fig.position.set(-424, groundH(-424, -370), -370);
        heroNode.fig.rotation.y = Math.PI; }
      spawnVehicle(stage, 'wagon', -396, -367, 0, { driver: 'parked' });
      camFix(stage, -433, (1.7 + groundH(-433, -366)), -366, -430, (1.6 + groundH(-430, -383)), -383);
      stage.updaters.push(repinShot);
      break; }
    case ('market'): {
      stage.timeOfDay = 11;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -52, z: -232, angle: Math.atan2(-82.5 + 52, -255 + 232) });
        heroNode.fig.position.set(-52, groundH(-52, -232), -232);
        heroNode.fig.rotation.y = heroNode.angle; }
      camFix(stage, -42, 3.4, -212, -80, 3.2, -250);
      stage.updaters.push(repinShot);
      break; }
    case ('vice'): {
      camFix(stage, 208, (3.8 + groundH(208, 493)), 493, 40, (1.0 + groundH(40, 503)), 503);
      stage.updaters.push(repinShot);
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DUSK_TIMES.vice;
      spawnVehicle(stage, 'sedan', 150, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'roadster', 108, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'hatch', 62, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'wagon', -18, 499, -Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 122, z: 505, angle: Math.PI });
        heroNode.fig.position.set(122, groundH(122, 505), 505);
        heroNode.fig.rotation.y = Math.PI; }
      break; }
    case ('vice-street'): {
      camFix(stage, 38, 1.6, 488, 128, 1.1, 497);
      stage.updaters.push(repinShot);
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DUSK_TIMES.street;
      spawnVehicle(stage, 'taiyo', 66, 492, 1.35, { driver: 'parked' });
      spawnVehicle(stage, 'sedan', 102, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'hatch', 142, 491, Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 52, z: 483, angle: Math.PI / 2 });
        heroNode.fig.position.set(52, groundH(52, 483), 483);
        heroNode.fig.rotation.y = Math.PI / 2; }
      break; }
    case ('vice-markings'): {
      camFix(stage, 7.5, 1.25, 460, -1.5, 0.3, 497);
      stage.updaters.push(repinShot);
      stage.timeOfDay = DUSK_TIMES.markings;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 16, z: 470 });
        heroNode.fig.position.set(16, groundH(16, 470), 470); }
      break; }
    case ('vice-houses'): {
      camFix(stage, -436, (1.7 + groundH(-436, -336)), -336, -429, (1.6 + groundH(-429, -383)), -383);
      stage.updaters.push(repinShot);
      stage.timeOfDay = DUSK_TIMES.houses;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -424, z: -352, angle: Math.PI });
        heroNode.fig.position.set(-424, groundH(-424, -352), -352);
        heroNode.fig.rotation.y = Math.PI; }
      spawnVehicle(stage, 'wagon', -404, -342, Math.PI / 2, { driver: 'parked' });
      break; }
    case ('v5-strip'): {
      camFix(stage, 128, (2.0 + groundH(128, 493)), 493, 52, (1.4 + groundH(52, 500)), 500);
      stage.updaters.push(() => { repinShot(); shadowPin(stage, 52, 500); });
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DAY_TIMES.strip;
      shadowPin(stage, 52, 500);
      spawnVehicle(stage, 'sedan', 88, 504, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'hatch', 64, 486, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'wagon', 150, 504, Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 112, z: 503, angle: Math.atan2(128 + -112, 493 + -503) });
        heroNode.fig.position.set(112, groundH(112, 503), 503);
        heroNode.fig.rotation.y = heroNode.angle; }
      break; }
    case ('v5-boulevard'): {
      camFix(stage, 90, (1.6 + groundH(90, 502)), 502, 101, (1.3 + groundH(101, 511)), 511);
      stage.updaters.push(() => { repinShot(); shadowPin(stage, 101, 511); });
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DAY_TIMES.boulevard;
      shadowPin(stage, 101, 511);
      spawnVehicle(stage, 'roadster', 70, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'sedan', 128, 491, Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 95, z: 505, angle: Math.atan2(100 + -95, 511 + -505) });
        heroNode.fig.position.set(95, groundH(95, 505), 505);
        heroNode.fig.rotation.y = heroNode.angle; }
      break; }
    case ('v5-houses'): {
      camFix(stage, -472, (1.7 + groundH(-472, -331)), -331, -420, (1.5 + groundH(-420, -352)), -352);
      stage.updaters.push(() => { repinShot(); shadowPin(stage, -420, -352); });
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DAY_TIMES.houses;
      shadowPin(stage, -420, -352);
      spawnVehicle(stage, 'wagon', -420, -341, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'sedan', -398, -352, -Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: -444, z: -350, angle: Math.atan2(-452 + 444, -334 + 350) });
        heroNode.fig.position.set(-444, groundH(-444, -350), -350);
        heroNode.fig.rotation.y = heroNode.angle; }
      break; }
    case ('v5-markings'): {
      camFix(stage, 10.5, (1.35 + groundH(10.5, 472)), 472, -2, (0.4 + groundH(-2, 496)), 496);
      stage.updaters.push(() => { repinShot(); shadowPin(stage, -2, 496); });
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DAY_TIMES.markings;
      shadowPin(stage, -2, 496);
      spawnVehicle(stage, 'hatch', -24, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(stage, 'sedan', 30, 499, -Math.PI / 2, { driver: 'parked' });
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 17, z: 479, angle: Math.atan2(10.5 + -17, 472 + -479) });
        heroNode.fig.position.set(17, groundH(17, 479), 479);
        heroNode.fig.rotation.y = heroNode.angle; }
      break; }
    case ('v5-park'): {
      let parkSpotIn = { x: 82, z: 415 };
      try { if (stage.parkSpot && Number.isFinite(stage.parkSpot.x) && Number.isFinite(stage.parkSpot.z)) parkSpotIn = stage.parkSpot; } catch (muteErr) {}
      const parkXAmt = parkSpotIn.x; const parkZAmt = parkSpotIn.z;
      const parkGround = groundH(parkXAmt, parkZAmt);
      camFix(stage, (parkXAmt + -17), (2.1 + parkGround), (parkZAmt + -14), (2 + parkXAmt), (1.0 + parkGround), (2 + parkZAmt));
      stage.updaters.push(() => { repinShot(); shadowPin(stage, parkXAmt, parkZAmt); });
      stage.radioName = 'WAVEFORM FM'; stage._radioIdx = 0;
      stage.timeOfDay = DAY_TIMES.park;
      shadowPin(stage, parkXAmt, parkZAmt);
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: (6 + parkXAmt), z: (5 + parkZAmt), angle: Math.atan2(-17 + -6, -14 + -5) });
        heroNode.fig.position.set((parkXAmt + 6), groundH((parkXAmt + 6), (parkZAmt + 5)), (parkZAmt + 5));
        heroNode.fig.rotation.y = heroNode.angle; }
      break; }
    case ('mapzoom'): {
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 300, z: -300 });
        heroNode.fig.position.set(300, groundH(300, -300), -300); }
      stage.flags.mapZoom = true;
      camFix(stage, 285, 8, -322, 305, 0, -295);
      break; }
    case ('pausemap'): {
      stage.flags.openPauseMap = true;
      stage.paused = true;
      try { stage.togglePause?.(); } catch (muteErr) {}
      camFix(stage, 0, 30, -60, 0, 0, 0);
      break; }
    case ('wasted'): {
      stage.timeOfDay = 18.5;
      if (stage.player) { const heroNode = stage.player;
        Object.assign(heroNode, { x: 165, z: -140, angle: 0.6 });
        heroNode.fig.position.set(165, groundH(165, -140), -140);
        heroNode.fig.rotation.y = 0.6; }
      try { stage.hud?.showWasted?.('Downtown'); } catch (muteErr) {}
      camFix(stage, 171, 1.7, -133, 164, 1.0, -141);
      break; }
    case ('busted'): {
      const rideNode = spawnVehicle(stage, 'taiyo', 165, -140, 0.4, { driver: 'parked' });
      const seatFig = makeFigure(CAST.ren);
      poseSeated(seatFig);
      seatFig.position.set(-0.4, 0.42, 0.15);
      rideNode.mesh.add(seatFig);
      const copRideA = spawnVehicle(stage, 'police', 158, -148, 0.9, { driver: 'cop' });
      applyNpcPoliceGlb(copRideA);
      const copRideB = spawnVehicle(stage, 'police', 173, -133, -2.2, { driver: 'cop' });
      applyNpcPoliceGlb(copRideB);
      copRideA.staged = true; copRideB.staged = true;
      stage.cops.push(copRideA, copRideB);
      castDrop(stage, 'cop', 162.8, -137.5, 2.42);
      castDrop(stage, 'cop', 167.2, -142.5, -0.72);
      stage.wanted = 4;
      try { stage.hud?.showBusted?.(); } catch (muteErr) {}
      camFix(stage, 176, 2.2, -128, 164, 1.0, -141);
      break; }
    default: break; }
  // Most staged frames hide the loose player figure; the modes
  // named in the list below are the exceptions to that rule.
  const visibleKeepList = ['meet', 'chars', 'mc', 'mapzoom', 'city', 'cover', 'shootout', 'smg', 'bat', 'wasted', 'busted', 'versus',
    'chase', 'markings', 'sky', 'busy', 'houses', 'market', 'night', 'vice', 'vice-street', 'vice-markings', 'vice-houses',
    'v5-strip', 'v5-boulevard', 'v5-houses', 'v5-markings', 'v5-park'];
  if (stage.player && !(visibleKeepList.includes(modeIn))) { stage.player.x = -412.5;
    stage.player.z = 470; }
}
export { THREE };
