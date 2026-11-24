// Staging for screenshots lives in this module; each named mode
// arranges its scene exactly once, at the moment it is picked.
import * as THREE from 'three'; import { CAST } from './config.js';
import { groundH } from './world.js'; import { applyCastFigureOverride, makeFigure, poseSeated } from './player.js';
import { applyNpcPoliceGlb, primeDamageSmoke, spawnVehicle } from './cars.js'; // staging imports end here
// Clock readings at dusk, shared by the vice family of modes.
const DUSK_TIMES = {};
DUSK_TIMES.vice = 17.9;
DUSK_TIMES.street = 18.1;
DUSK_TIMES.markings = 17.9;
DUSK_TIMES.houses = 17.8;
// Clock readings at midday for the later density modes.
const DAY_TIMES = {};
DAY_TIMES.strip = 12.4;
DAY_TIMES.boulevard = 12.0;
DAY_TIMES.houses = 12.8;
DAY_TIMES.park = 12.2;
DAY_TIMES.markings = 11.6;
// A staged frame tightens the sun box through this shadow frustum.
const SHADOW_BOX = {};
SHADOW_BOX.box = 85;
SHADOW_BOX.far = 600;
SHADOW_BOX.near = 10;
const applyBox = (camGiven) => {
  camGiven.left = -SHADOW_BOX.box; camGiven.right = SHADOW_BOX.box;
  camGiven.top = SHADOW_BOX.box; camGiven.bottom = -SHADOW_BOX.box;
  // The edge setting helper is folded in here; it had no other
  // caller, and the frustum edges still land in the same order.
  camGiven.near = SHADOW_BOX.near; camGiven.far = SHADOW_BOX.far;
  camGiven.updateProjectionMatrix(); }
const aimSun = (sg, sunGiven, focusX, focusZ) => {
  const tgtGiven = sunGiven.target;
  tgtGiven.position.set(focusX, groundH(focusX, focusZ), focusZ);
  (sg.scene && !tgtGiven.parent) ? sg.scene.add(tgtGiven) : undefined;
  tgtGiven.updateMatrixWorld(); };
const pinShade = (sg, focusX, focusZ) => {
  const sunGiven = sg.sun;
  const camReady = sunGiven && sunGiven.shadow && sunGiven.shadow.camera; if (!camReady) return;
  try { applyBox(sunGiven.shadow.camera);
    if (sunGiven.target) aimSun(sg, sunGiven, focusX, focusZ);
  } catch (silenced) {} }
const placeCast = (sg, castKey, posX, posZ, headGiven) => {
  const figMade = makeFigure(CAST[castKey]); applyCastFigureOverride(figMade, castKey); figMade.position.set(posX, groundH(posX, posZ), posZ);
  let headVal;
  if (headGiven) headVal = headGiven; else headVal = 0;
  figMade.rotation.y = headVal; sg.scene.add(figMade); return figMade; };
const poseCam = (sg, camX, camY, camZ, lookX, lookY, lookZ) => {
  const camGiven = sg.camera; camGiven.fov = 60;
  camGiven.position.set(camX, camY, camZ);
  camGiven.lookAt(lookX, lookY, lookZ); camGiven.updateProjectionMatrix(); };
const pinCam = (sg, camX, camY, camZ, lookX, lookY, lookZ) => {
  function pinFn() { poseCam(sg, camX, camY, camZ, lookX, lookY, lookZ); }
  sg.shotCam = pinFn; const pinned = sg.shotCam; pinned(); };
export const setupShot = (sg, modeGiven) => {
  sg.shotMode = modeGiven; sg.shot = modeGiven;
  function repinFn() { sg.shotCam ? sg.shotCam() : undefined; }
  const stageRear = () => { sg.timeOfDay = 10.5;
    const ridesList = sg.vehicles || [];
    const showRide = ridesList.find(function (vehNode) { return vehNode && ('svj' === vehNode.specId); });
    showRide ? (showRide._brakeStaged = true) : undefined;
    const tailMaterial = showRide && showRide.mesh && showRide.mesh.userData.tailMat;
    tailMaterial ? (tailMaterial.emissiveIntensity = 2.4) : undefined;
    pinCam(sg, -435.2, 0.95, 447.8, -430.2, 0.72, 452.2); }
  switch (modeGiven) {
    case ('city'): case ('cover'): { const spawnedRide = spawnVehicle(sg, 'hero-supra', 150, -148, 0.85, { driver: 'parked' });
      if (sg.player) {
        sg.player.z = -144.6; sg.player.x = 153.2; sg.player.angle = 0.8;
        sg.player.fig.position.set(153.2, groundH(153.2, -144.6), -144.6);
        sg.player.fig.rotation.y = 0.8; }
      pinCam(sg, 156.5, 1.35, -141.5, 150.5, 0.95, -148.5); void spawnedRide; try {
        const spotsList = [[140, -138], [146, -133], [136, -143]];
        let scoutList;
        if (Array.isArray(sg.peds)) scoutList = sg.peds.filter(function (pedGiven) { return pedGiven && pedGiven.fig && !pedGiven.downed; }); else scoutList = [];
        const pickedList = [...allPeds.filter(function (pedGiven) { return pedGiven.figIsGlb; }), ...allPeds.filter(function (pedGiven) { return !pedGiven.figIsGlb; })].slice(0, spotsList.length);
        void scoutList;
        for (const [idxGiven, pedGiven] of pickedList.entries()) {
          const spotX = spotsList[idxGiven][0]; const spotZ = spotsList[idxGiven][1];
          pedGiven.z = spotZ; pedGiven.x = spotX;
          pedGiven.idle = false; pedGiven.fleeT = 0; pedGiven.fleeDir = null;
          pedGiven.vertical = false;
          if (('number' === typeof pedGiven.off) && (0 !== pedGiven.off)) pedGiven.off = pedGiven.off; else pedGiven.off = 17.2;
          pedGiven.line = (spotZ - pedGiven.off); pedGiven.dir = 1; pedGiven.angle = Math.PI / 2;
          try { pedGiven.fig.position.set(spotX, groundH(spotX, spotZ), spotZ);
            pedGiven.fig.rotation.y = pedGiven.angle;
          } catch (silenced) {} }
      } catch (silenced) {} break; }
    case ('meet'): { const meetKeys = ['hachi', 'sora15', 'hoshi7', 'kaze'];
      const meetPos = [-434, -422, -410, -398];
      for (const [idxGiven, keyGiven] of meetKeys.entries()) spawnVehicle(sg, keyGiven, meetPos[idxGiven], 446, 0, { driver: 'parked' });
      const meetIds = ['ren', 'ako', 'mika', 'jun'];
      for (const [idxGiven, idGiven] of meetIds.entries()) placeCast(sg, idGiven, (1.5 + meetPos[idxGiven]), 451, 0);
      sg.timeOfDay = 11.5; pinCam(sg, -433, 1.7, 458, -415, 1.0, 447); break; }
    case ('chase'): { sg.timeOfDay = 17.6; sg.heliShot = { radius: 11, altitude: 16 };
      const chaseRide = spawnVehicle(sg, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        sg.player.z = 495; sg.player.x = 100; sg.player.angle = Math.PI / 2;
        sg.player.fig.position.set(100, groundH(100, 495), 495);
        sg.player.fig.visible = false; sg.player.fig.rotation.y = Math.PI / 2; }
      chaseRide.driver = 'player'; sg.car = chaseRide; sg.flags.inCar = true;
      sg.updaters.push(function () {
        chaseRide.x = 100; chaseRide.z = 495; chaseRide.angle = Math.PI / 2;
        chaseRide.mesh ? chaseRide.mesh.position.set(100, (0.02 + groundH(100, 495)), 495) : undefined; });
      sg.wanted = 4; chaseRide.speed = 22; chaseRide.health = 45;
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0;
      const seatFig = makeFigure(CAST.ren); poseSeated(seatFig);
      seatFig.position.set(-0.4, 0.42, 0.15); chaseRide.mesh.add(seatFig);
      sg.flags.flashCar = chaseRide; sg.flags.forceFlash = 'car';
      const copOne = spawnVehicle(sg, 'police', 86, 489, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copOne);
      const copTwo = spawnVehicle(sg, 'police', 82, 502, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copTwo); copOne.staged = true; copTwo.staged = true;
      sg.cops.push(copOne, copTwo); sg.flags.heliStage = { x: 100, z: 495 };
      pinCam(sg, 112, 3.2, 478, 99, 1.2, 496); break; }
    case ('hero'): { pinCam(sg, 114, 1.5, 479, 97, 0.9, 493); sg.updaters.push(repinFn);
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = 17.9;
      const spawnedRide = spawnVehicle(sg, 'taiyo', 100, 491, 1.2, { driver: 'parked' });
      void spawnedRide; break; }
    case ('svj'): { sg.timeOfDay = 10.5; pinCam(sg, -425.8, 1.05, 445.8, -430.2, 0.72, 452.3); break; }
    case ('svjrear'): { stageRear(); break; }
    case ('lineup'): { const lineupKeys = ['hachi', 'sora15', 'kei', 'sedan', 'wagon', 'van', 'suv', 'truck', 'taxi', 'police', 'police-suv', 'hatch', 'roadster', 'hoshi7', 'taiyo', 'kaze', 'hero-supra', 'gtr35', 'svj'];
      for (const [idxGiven, keyGiven] of lineupKeys.entries()) spawnVehicle(sg, keyGiven, ((62 * idxGiven) - 558), 487, Math.PI / 2, { driver: 'parked' });
      pinCam(sg, -545, 2.2, 468, -450, 1, 490); break; }
    case ('chars'): { const charsIds = ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop', 'shun'];
      for (const [idxGiven, idGiven] of charsIds.entries()) placeCast(sg, idGiven, ((7 * idxGiven) - 436), 448, Math.PI);
      pinCam(sg, -412, 1.5, 443.8, -412, 1.0, 448); break; }
    case ('versus'): { sg.timeOfDay = 17.8; spawnVehicle(sg, 'taiyo', 88, 491, 1.2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 97; leadFig.z = 494.5; leadFig.angle = Math.PI;
        leadFig.fig.position.set(97, groundH(97, 494.5), 494.5);
        leadFig.fig.rotation.y = Math.PI; }
      spawnVehicle(sg, 'gtr35', 112, 491, 1.2, { driver: 'parked' });
      placeCast(sg, 'shun', 104, 494.5, Math.PI);
      pinCam(sg, 100, 1.6, 478, 100, 0.9, 492); break; }
    case ('mc'): { if (sg.player) {
        sg.player.z = 440; sg.player.x = -406; sg.player.angle = 0;
        sg.player.fig.position.set(-406, groundH(-406, 440), 440);
        sg.player.fig.rotation.y = 0; }
      pinCam(sg, -406, 1.1, 442.2, -406, 1.0, 440); break; }
    case ('smg'): { if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = -412.5; leadFig.z = 440; leadFig.angle = Math.PI;
        leadFig.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        leadFig.fig.rotation.y = Math.PI; }
      (sg.weapons && sg.weapons.equip) ? sg.weapons.equip('smg') : undefined;
      pinCam(sg, -412.5, 1.25, 437.9, -412.5, 1.05, 440); break; }
    case ('bat'): { if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = -412.5; leadFig.z = 440; leadFig.angle = Math.PI;
        leadFig.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        leadFig.fig.rotation.y = Math.PI; }
      (sg.weapons && sg.weapons.equip) ? sg.weapons.equip('bat') : undefined;
      pinCam(sg, -412.5, 1.25, 437.9, -412.5, 1.05, 440); break; }
    case ('shootout'): { pinCam(sg, 197.2, 1.6, -204.8, 200.3, 1.05, -199.3);
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 200; leadFig.z = -200; leadFig.angle = Math.atan2(-12, -8);
        leadFig.fig.position.set(200, groundH(200, -200), -200);
        leadFig.fig.rotation.y = leadFig.angle;
        (sg.weapons && sg.weapons.equip) ? sg.weapons.equip('pistol') : undefined; }
      sg.flags.forceFlash = 'foot';
      const floorFig = placeCast(sg, 'ren', 202, -197.5, 0.6);
      floorFig.rotation.x = -1.35; floorFig.position.y = (0.15 + groundH(202, -197.5));
      const sprintFig = placeCast(sg, 'mika', 203.5, -196, Math.atan2(6, 7));
      sprintFig.rotation.x = 0.15;
      const copCar = spawnVehicle(sg, 'police', 204.5, -195, -2.36, { driver: 'cop' });
      applyNpcPoliceGlb(copCar); break; }
    case ('heli'): { spawnVehicle(sg, 'taiyo', -200, 300, 0.4, { driver: 'parked' });
      spawnVehicle(sg, 'police-suv', -192, 292, -2.4, { driver: 'cop' });
      sg.flags.heliStage = { x: -200, z: 300 };
      pinCam(sg, -186, 2.0, 314, -198, 1.2, 298); break; }
    case ('street'): { sg.timeOfDay = 10.5; sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0;
      spawnVehicle(sg, 'taiyo', 150, -128, Math.PI, { driver: 'parked' });
      pinCam(sg, 161, 1.7, -133, 149, 1.5, -156); break; }
    case ('smoke'): { sg.timeOfDay = 10.5; pinCam(sg, -405.4, 1.5, 446.6, -411.7, 0.9, 447.2);
      const smokeCar = spawnVehicle(sg, 'taiyo', -412.5, 446, 0.6, { driver: 'parked' });
      smokeCar.health = 12; primeDamageSmoke(sg, smokeCar, 12);
      let smokeAge = 0;
      sg.updaters.push(function (frameGiven, dtGiven) {
        smokeAge += (dtGiven || 0);
        (smokeAge >= 0.9) ? (smokeAge = 0, primeDamageSmoke(sg, smokeCar, 12)) : undefined; }); break; }
    case ('night'): { sg.timeOfDay = 21.5; sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0;
      const nightCar = spawnVehicle(sg, 'taiyo', 5, -40, 0, { driver: 'parked' });
      const seatFig = makeFigure(CAST.ren); poseSeated(seatFig);
      seatFig.position.set(-0.4, 0.42, 0.15); nightCar.mesh.add(seatFig);
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 14; leadFig.z = -26; leadFig.angle = Math.PI;
        leadFig.fig.position.set(14, groundH(14, -26), -26);
        leadFig.fig.rotation.y = Math.PI; }
      pinCam(sg, 13, 2.0, -18, 2, 0.7, -58); sg.updaters.push(repinFn); break; }
    case ('markings'): { sg.timeOfDay = 10.5;
      if (sg.player) {
        sg.player.z = -92; sg.player.x = 14;
        sg.player.fig.position.set(14, groundH(14, -92), -92); }
      pinCam(sg, 5.5, 1.3, -126, -1, 0.3, -160); sg.updaters.push(repinFn); break; }
    case ('sky'): { sg.timeOfDay = 8.8;
      if (sg.player) {
        sg.player.z = -18; sg.player.x = -34;
        sg.player.fig.position.set(-34, groundH(-34, -18), -18); }
      pinCam(sg, -30, 1.8, -14, 17, 30, 10); sg.updaters.push(repinFn); break; }
    case ('busy'): { sg.timeOfDay = 11;
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 176.5; leadFig.z = 153.5; leadFig.angle = Math.atan2(182.2 - 176.5, 147.8 - 153.5);
        leadFig.fig.position.set(176.5, groundH(176.5, 153.5), 153.5);
        leadFig.fig.rotation.y = leadFig.angle; } try {
        const spotsList = [{ dir: 1, x: 166, vertical: false, z: 147.8 }, { dir: -1, x: 198, vertical: false, z: 147.8 }, { dir: 1, x: 182.2, vertical: true, z: 158 }];
        let candList;
        if (Array.isArray(sg.peds)) candList = sg.peds.filter(function (pedGiven) { return pedGiven && pedGiven.fig && !pedGiven.downed && !pedGiven.chat && !('cross' === pedGiven.mode) && !pedGiven.follow; }); else candList = [];
        const pickedList = [...pool.filter(function (pedGiven) { return pedGiven.figIsGlb; }), ...pool.filter(function (pedGiven) { return !pedGiven.figIsGlb; })].slice(0, spotsList.length);
        void candList;
        for (const [idxGiven, pedGiven] of pickedList.entries()) {
          const spotGiven = spotsList[idxGiven];
          pedGiven.z = spotGiven.z; pedGiven.x = spotGiven.x;
          pedGiven.idle = false; pedGiven.fleeT = 0; pedGiven.fleeDir = null;
          pedGiven.vertical = spotGiven.vertical;
          if (('number' === typeof pedGiven.off) && (0 !== pedGiven.off)) pedGiven.off = pedGiven.off; else pedGiven.off = 17.2;
          let lineBase;
          if (spotGiven.vertical) lineBase = spotGiven.x; else lineBase = spotGiven.z;
          pedGiven.line = (lineBase - pedGiven.off);
          pedGiven.dir = spotGiven.dir;
          if (spotGiven.vertical) { if (0 < spotGiven.dir) pedGiven.angle = 0; else pedGiven.angle = Math.PI; } else { if (0 < spotGiven.dir) pedGiven.angle = Math.PI / 2; else pedGiven.angle = -Math.PI / 2; }
          try { pedGiven.fig.position.set(spotGiven.x, groundH(spotGiven.x, spotGiven.z), spotGiven.z);
            pedGiven.fig.rotation.y = pedGiven.angle;
          } catch (silenced) {} }
      } catch (silenced) {}
      spawnVehicle(sg, 'taxi', 205, 171, -Math.PI / 2, { driver: 'parked' });
      pinCam(sg, 177.5, 1.6, 142.5, 183, 1.1, 149); sg.updaters.push(repinFn); break; }
    case ('houses'): { sg.timeOfDay = 10.5;
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = -424; leadFig.z = -370; leadFig.angle = Math.PI;
        leadFig.fig.position.set(-424, groundH(-424, -370), -370);
        leadFig.fig.rotation.y = Math.PI; }
      spawnVehicle(sg, 'wagon', -396, -367, 0, { driver: 'parked' });
      pinCam(sg, -433, (1.7 + groundH(-433, -366)), -366, -430, (1.6 + groundH(-430, -383)), -383);
      sg.updaters.push(repinFn); break; }
    case ('market'): { sg.timeOfDay = 11;
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = -52; leadFig.z = -232; leadFig.angle = Math.atan2(-82.5 + 52, -255 + 232);
        leadFig.fig.position.set(-52, groundH(-52, -232), -232);
        leadFig.fig.rotation.y = leadFig.angle; }
      pinCam(sg, -42, 3.4, -212, -80, 3.2, -250); sg.updaters.push(repinFn); break; }
    case ('vice'): { pinCam(sg, 208, (3.8 + groundH(208, 493)), 493, 40, (1.0 + groundH(40, 503)), 503);
      sg.updaters.push(repinFn); sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0;
      sg.timeOfDay = DUSK_TIMES.vice;
      spawnVehicle(sg, 'sedan', 150, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'roadster', 108, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'hatch', 62, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'wagon', -18, 499, -Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 122; leadFig.z = 505; leadFig.angle = Math.PI;
        leadFig.fig.position.set(122, groundH(122, 505), 505);
        leadFig.fig.rotation.y = Math.PI; } break; }
    case ('vice-street'): { pinCam(sg, 38, 1.6, 488, 128, 1.1, 497); sg.updaters.push(repinFn);
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = DUSK_TIMES.street;
      spawnVehicle(sg, 'taiyo', 66, 492, 1.35, { driver: 'parked' });
      spawnVehicle(sg, 'sedan', 102, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'hatch', 142, 491, Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 52; leadFig.z = 483; leadFig.angle = Math.PI / 2;
        leadFig.fig.position.set(52, groundH(52, 483), 483);
        leadFig.fig.rotation.y = Math.PI / 2; } break; }
    case ('vice-markings'): { pinCam(sg, 7.5, 1.25, 460, -1.5, 0.3, 497); sg.updaters.push(repinFn);
      sg.timeOfDay = DUSK_TIMES.markings;
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 16; leadFig.z = 470;
        leadFig.fig.position.set(16, groundH(16, 470), 470); } break; }
    case ('vice-houses'): { pinCam(sg, -436, (1.7 + groundH(-436, -336)), -336, -429, (1.6 + groundH(-429, -383)), -383);
      sg.updaters.push(repinFn); sg.timeOfDay = DUSK_TIMES.houses;
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = -424; leadFig.z = -352; leadFig.angle = Math.PI;
        leadFig.fig.position.set(-424, groundH(-424, -352), -352);
        leadFig.fig.rotation.y = Math.PI; }
      spawnVehicle(sg, 'wagon', -404, -342, Math.PI / 2, { driver: 'parked' }); break; }
    case ('v5-strip'): { pinCam(sg, 128, (2.0 + groundH(128, 493)), 493, 52, (1.4 + groundH(52, 500)), 500);
      sg.updaters.push(function () { repinFn(); pinShade(sg, 52, 500); });
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = DAY_TIMES.strip;
      pinShade(sg, 52, 500);
      spawnVehicle(sg, 'sedan', 88, 504, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'hatch', 64, 486, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'wagon', 150, 504, Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 112; leadFig.z = 503; leadFig.angle = Math.atan2(128 - 112, 493 - 503);
        leadFig.fig.position.set(112, groundH(112, 503), 503);
        leadFig.fig.rotation.y = leadFig.angle; } break; }
    case ('v5-boulevard'): { pinCam(sg, 90, (1.6 + groundH(90, 502)), 502, 101, (1.3 + groundH(101, 511)), 511);
      sg.updaters.push(function () { repinFn(); pinShade(sg, 101, 511); });
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = DAY_TIMES.boulevard;
      pinShade(sg, 101, 511);
      spawnVehicle(sg, 'roadster', 70, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'sedan', 128, 491, Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 95; leadFig.z = 505; leadFig.angle = Math.atan2(100 - 95, 511 - 505);
        leadFig.fig.position.set(95, groundH(95, 505), 505);
        leadFig.fig.rotation.y = leadFig.angle; } break; }
    case ('v5-houses'): { pinCam(sg, -472, (1.7 + groundH(-472, -331)), -331, -420, (1.5 + groundH(-420, -352)), -352);
      sg.updaters.push(function () { repinFn(); pinShade(sg, -420, -352); });
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = DAY_TIMES.houses;
      pinShade(sg, -420, -352);
      spawnVehicle(sg, 'wagon', -420, -341, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'sedan', -398, -352, -Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = -444; leadFig.z = -350; leadFig.angle = Math.atan2(-452 + 444, -334 + 350);
        leadFig.fig.position.set(-444, groundH(-444, -350), -350);
        leadFig.fig.rotation.y = leadFig.angle; } break; }
    case ('v5-markings'): { pinCam(sg, 10.5, (1.35 + groundH(10.5, 472)), 472, -2, (0.4 + groundH(-2, 496)), 496);
      sg.updaters.push(function () { repinFn(); pinShade(sg, -2, 496); });
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = DAY_TIMES.markings;
      pinShade(sg, -2, 496);
      spawnVehicle(sg, 'hatch', -24, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(sg, 'sedan', 30, 499, -Math.PI / 2, { driver: 'parked' });
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 17; leadFig.z = 479; leadFig.angle = Math.atan2(10.5 - 17, 472 - 479);
        leadFig.fig.position.set(17, groundH(17, 479), 479);
        leadFig.fig.rotation.y = leadFig.angle; } break; }
    case ('v5-park'): { let spotPark = {};
      spotPark.x = 82;
      spotPark.z = 415;
      try { if (sg.parkSpot && Number.isFinite(sg.parkSpot.x) && Number.isFinite(sg.parkSpot.z)) spotPark = sg.parkSpot;
      } catch (silenced) {}
      const pxPark = spotPark.x; const pzPark = spotPark.z; const groundPark = groundH(pxPark, pzPark);
      pinCam(sg, (pxPark - 17), (2.1 + groundPark), (pzPark - 14), (2 + pxPark), (1.0 + groundPark), (2 + pzPark));
      sg.updaters.push(function () { repinFn(); pinShade(sg, pxPark, pzPark); });
      sg.radioName = 'WAVEFORM FM'; sg._radioIdx = 0; sg.timeOfDay = DAY_TIMES.park;
      pinShade(sg, pxPark, pzPark);
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = (6 + pxPark); leadFig.z = (5 + pzPark); leadFig.angle = Math.atan2(-17 - 6, -14 - 5);
        leadFig.fig.position.set((pxPark + 6), groundH((pxPark + 6), (pzPark + 5)), (pzPark + 5));
        leadFig.fig.rotation.y = leadFig.angle; } break; }
    case ('mapzoom'): { if (sg.player) {
        sg.player.z = -300; sg.player.x = 300;
        sg.player.fig.position.set(300, groundH(300, -300), -300); }
      sg.flags.mapZoom = true; pinCam(sg, 285, 8, -322, 305, 0, -295); break; }
    case ('pausemap'): { sg.flags.openPauseMap = true; sg.paused = true;
      try { sg.togglePause?.(); } catch (silenced) {}
      pinCam(sg, 0, 30, -60, 0, 0, 0); break; }
    case ('wasted'): { sg.timeOfDay = 18.5;
      if (sg.player) {
        const leadFig = sg.player;
        leadFig.x = 165; leadFig.z = -140; leadFig.angle = 0.6;
        leadFig.fig.position.set(165, groundH(165, -140), -140);
        leadFig.fig.rotation.y = 0.6; }
      try { sg.hud?.showWasted?.('Downtown'); } catch (silenced) {}
      pinCam(sg, 171, 1.7, -133, 164, 1.0, -141); break; }
    case ('busted'): { const spawnedRide = spawnVehicle(sg, 'taiyo', 165, -140, 0.4, { driver: 'parked' });
      const seatFig = makeFigure(CAST.ren); poseSeated(seatFig);
      seatFig.position.set(-0.4, 0.42, 0.15); spawnedRide.mesh.add(seatFig);
      const copOne = spawnVehicle(sg, 'police', 158, -148, 0.9, { driver: 'cop' });
      applyNpcPoliceGlb(copOne);
      const copTwo = spawnVehicle(sg, 'police', 173, -133, -2.2, { driver: 'cop' });
      applyNpcPoliceGlb(copTwo); copOne.staged = true; copTwo.staged = true;
      sg.cops.push(copOne, copTwo);
      placeCast(sg, 'cop', 162.8, -137.5, 2.42); placeCast(sg, 'cop', 167.2, -142.5, -0.72);
      sg.wanted = 4;
      try { sg.hud?.showBusted?.(); } catch (silenced) {}
      pinCam(sg, 176, 2.2, -128, 164, 1.0, -141); break; } default: break; }
  // Most staged frames hide the loose player figure; the modes in
  // the list below are the exceptions to that rule.
  const visibleModes = [];
  visibleModes.push('meet', 'chars', 'mc', 'mapzoom', 'city', 'cover', 'shootout', 'smg', 'bat', 'wasted',
    'busted', 'versus', 'chase', 'markings', 'sky', 'busy', 'houses', 'market', 'night', 'vice',
    'vice-street', 'vice-markings', 'vice-houses', 'v5-strip', 'v5-boulevard', 'v5-houses', 'v5-markings', 'v5-park');
  (sg.player && !(visibleModes.includes(modeGiven))) ? (sg.player.x = -412.5, sg.player.z = 470) : undefined; }; export { THREE };
