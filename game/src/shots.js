// Screenshot staging lives here: every mode sets its scene once.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated, applyCastFigureOverride } from './player.js';
import { spawnVehicle, applyNpcPoliceGlb, primeDamageSmoke } from './cars.js';
// Shared dusk clock values for the vice family of modes.
const DUSK_BY_MODE = {};
DUSK_BY_MODE.vice = 17.9;
DUSK_BY_MODE.street = 18.1;
DUSK_BY_MODE.markings = 17.9;
DUSK_BY_MODE.houses = 17.8;
// Bright midday clock values for the later density modes.
const DAY_BY_MODE = {};
DAY_BY_MODE.strip = 12.4;
DAY_BY_MODE.boulevard = 12.0;
DAY_BY_MODE.houses = 12.8;
DAY_BY_MODE.markings = 11.6;
DAY_BY_MODE.park = 12.2;
// Shadow frustum used when a staged frame tightens the sun box.
const SHADOW_SPEC = {};
SHADOW_SPEC.box = 85;
SHADOW_SPEC.near = 10;
SHADOW_SPEC.far = 600;
function applyShadowBox(camObj) {
  const halfBox = SHADOW_SPEC.box;
  camObj.left = -halfBox;
  camObj.right = halfBox;
  camObj.top = halfBox;
  camObj.bottom = -halfBox;
  camObj.near = SHADOW_SPEC.near;
  camObj.far = SHADOW_SPEC.far;
  camObj.updateProjectionMatrix();
}
function aimSunTarget(gameRef, sunObj, focusX, focusZ) {
  sunObj.target.position.set(focusX, groundH(focusX, focusZ), focusZ);
  if (gameRef.scene && !(sunObj.target.parent)) gameRef.scene.add(sunObj.target);
  sunObj.target.updateMatrixWorld();
}
const pinShadowTo = (gameRef, focusX, focusZ) => {
  const sunObj = gameRef.sun;
  if (!(sunObj) || !(sunObj.shadow) || !(sunObj.shadow.camera)) return;
  try {
    applyShadowBox(sunObj.shadow.camera);
    if (sunObj.target) aimSunTarget(gameRef, sunObj, focusX, focusZ);
  } catch (ignoredErr) {}
};
function dropCastFigure(gameRef, castKeyVal, placeX, placeZ, headingVal) {
  const figObj = makeFigure(CAST[castKeyVal]);
  applyCastFigureOverride(figObj, castKeyVal);
  figObj.position.set(placeX, groundH(placeX, placeZ), placeZ);
  figObj.rotation.y = headingVal || 0;
  gameRef.scene.add(figObj);
  return figObj;
}
const fixCamera = (gameRef, camX, camY, camZ, lookX, lookY, lookZ) => {
  gameRef.shotCam = () => {
    const camObj = gameRef.camera;
    camObj.fov = 60;
    camObj.updateProjectionMatrix();
    camObj.position.set(camX, camY, camZ);
    camObj.lookAt(lookX, lookY, lookZ);
  };
  gameRef.shotCam();
};
export function setupShot(game, modeKey) {
  game.shot = modeKey;
  game.shotMode = modeKey;
  const repinCam = () => { if (game.shotCam) game.shotCam(); };
  switch (modeKey) {
    case 'city':
    case 'cover': {
      const stagedVehicle = spawnVehicle(game, 'hero-supra', 150, -148, 0.85, { driver: 'parked' });
      if (game.player) { game.player.x = 153.2;
        game.player.z = -144.6;
        game.player.angle = 0.8;
        game.player.fig.position.set(153.2, groundH(153.2, -144.6), -144.6);
        game.player.fig.rotation.y = 0.8;
      }
      fixCamera(game, 156.5, 1.35, -141.5, 150.5, 0.95, -148.5);
      void stagedVehicle;
      try {
        const spotList = [[140, -138], [146, -133], [136, -143]];
        const candidateList = Array.isArray(game.peds) ? game.peds.filter((pedObj) => pedObj && pedObj.fig && !(pedObj.downed)) : [];
        const pickedList = [...allPeds.filter((pedObj) => pedObj.figIsGlb), ...allPeds.filter((pedObj) => !(pedObj.figIsGlb))].slice(0, spotList.length);
        void candidateList;
        pickedList.forEach((pedObj, idxNow) => {
          const placeX = spotList[idxNow][0];
          const placeZ = spotList[idxNow][1];
          pedObj.x = placeX; pedObj.z = placeZ;
          pedObj.idle = false;
          pedObj.fleeT = 0;
          pedObj.fleeDir = null;
          pedObj.vertical = false;
          pedObj.off = (('number' === typeof pedObj.off) && (0 !== pedObj.off)) ? pedObj.off : 17.2;
          pedObj.line = placeZ - pedObj.off;
          pedObj.dir = 1;
          pedObj.angle = Math.PI / 2;
          try {
            pedObj.fig.position.set(placeX, groundH(placeX, placeZ), placeZ);
            pedObj.fig.rotation.y = pedObj.angle;
          } catch (ignoredErr) {}
        });
      } catch (ignoredErr) {}
      break; }
    case 'meet': {
      const carKeyList = ['hachi', 'sora15', 'hoshi7', 'kaze'];
      const carXList = [-434, -422, -410, -398];
      carKeyList.forEach((carKeyVal, idxNow) => spawnVehicle(game, carKeyVal, carXList[idxNow], 446, 0, { driver: 'parked' }));
      const castKeyList = ['ren', 'ako', 'mika', 'jun'];
      castKeyList.forEach((castKeyVal, idxNow) => dropCastFigure(game, castKeyVal, carXList[idxNow] + 1.5, 451, 0));
      game.timeOfDay = 11.5;
      fixCamera(game, -433, 1.7, 458, -415, 1.0, 447);
      break; }
    case 'chase': {
      game.timeOfDay = 17.6;
      game.heliShot = { altitude: 16, radius: 11 };
      const heroVehicle = spawnVehicle(game, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = 100;
        game.player.z = 495;
        game.player.angle = Math.PI / 2;
        game.player.fig.position.set(100, groundH(100, 495), 495);
        game.player.fig.rotation.y = Math.PI / 2;
        game.player.fig.visible = false;
      }
      heroVehicle.driver = 'player';
      game.car = heroVehicle;
      game.flags.inCar = true;
      game.updaters.push(() => {
        heroVehicle.x = 100;
        heroVehicle.z = 495;
        heroVehicle.angle = Math.PI / 2;
        if (heroVehicle.mesh) heroVehicle.mesh.position.set(100, groundH(100, 495) + 0.02, 495);
      });
      game.wanted = 4;
      heroVehicle.speed = 22;
      heroVehicle.health = 45;
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      const seatedFigure = makeFigure(CAST.ren);
      poseSeated(seatedFigure);
      seatedFigure.position.set(-0.4, 0.42, 0.15);
      heroVehicle.mesh.add(seatedFigure);
      game.flags.flashCar = heroVehicle;
      game.flags.forceFlash = 'car';
      const copVehicleA = spawnVehicle(game, 'police', 86, 489, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copVehicleA);
      const copVehicleB = spawnVehicle(game, 'police', 82, 502, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copVehicleB);
      copVehicleA.staged = true;
      copVehicleB.staged = true;
      game.cops.push(copVehicleA, copVehicleB);
      game.flags.heliStage = { x: 100, z: 495 };
      fixCamera(game, 112, 3.2, 478, 99, 1.2, 496);
      break; }
    case 'hero': {
      fixCamera(game, 114, 1.5, 479, 97, 0.9, 493);
      game.updaters.push(repinCam);
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = 17.9;
      const stagedVehicle = spawnVehicle(game, 'taiyo', 100, 491, 1.2, { driver: 'parked' });
      void stagedVehicle;
      break; }
    case 'svj': {
      game.timeOfDay = 10.5;
      fixCamera(game, -425.8, 1.05, 445.8, -430.2, 0.72, 452.3);
      break; }
    case 'svjrear': {
      game.timeOfDay = 10.5;
      const showcaseVehicle = (game.vehicles || []).find((vehObj) => vehObj && ('svj' === vehObj.specId));
      if (showcaseVehicle) {
        showcaseVehicle._brakeStaged = true;
        const tailMaterial = showcaseVehicle.mesh && showcaseVehicle.mesh.userData.tailMat;
        if (tailMaterial) tailMaterial.emissiveIntensity = 2.4;
      }
      fixCamera(game, -435.2, 0.95, 447.8, -430.2, 0.72, 452.2);
      break; }
    case 'lineup': {
      const rowKeyList = ['hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra','gtr35','svj'];
      rowKeyList.forEach((carKeyVal, idxNow) => spawnVehicle(game, carKeyVal, -558 + (62 * idxNow), 487, Math.PI / 2, { driver: 'parked' }));
      fixCamera(game, -545, 2.2, 468, -450, 1, 490);
      break; }
    case 'chars': {
      const castKeyList = ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop', 'shun'];
      castKeyList.forEach((castKeyVal, idxNow) => dropCastFigure(game, castKeyVal, -436 + (7 * idxNow), 448, Math.PI));
      fixCamera(game, -412, 1.5, 443.8, -412, 1.0, 448);
      break; }
    case 'versus': {
      game.timeOfDay = 17.8;
      spawnVehicle(game, 'taiyo', 88, 491, 1.2, { driver: 'parked' });
      if (game.player) { game.player.x = 97;
        game.player.z = 494.5;
        game.player.angle = Math.PI;
        game.player.fig.position.set(97, groundH(97, 494.5), 494.5);
        game.player.fig.rotation.y = Math.PI;
      }
      spawnVehicle(game, 'gtr35', 112, 491, 1.2, { driver: 'parked' });
      dropCastFigure(game, 'shun', 104, 494.5, Math.PI);
      fixCamera(game, 100, 1.6, 478, 100, 0.9, 492);
      break; }
    case 'mc': {
      if (game.player) { game.player.x = -406;
        game.player.z = 440;
        game.player.angle = 0;
        game.player.fig.position.set(-406, groundH(-406, 440), 440);
        game.player.fig.rotation.y = 0;
      }
      fixCamera(game, -406, 1.1, 442.2, -406, 1.0, 440);
      break; }
    case 'smg': {
      if (game.player) {
        game.player.x = -412.5;
        game.player.z = 440;
        game.player.angle = Math.PI;
        game.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        game.player.fig.rotation.y = Math.PI;
      }
      if (game.weapons && game.weapons.equip) game.weapons.equip('smg');
      fixCamera(game, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
      break; }
    case 'bat': {
      if (game.player) {
        game.player.x = -412.5;
        game.player.z = 440;
        game.player.angle = Math.PI;
        game.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        game.player.fig.rotation.y = Math.PI;
      }
      if (game.weapons && game.weapons.equip) game.weapons.equip('bat');
      fixCamera(game, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
      break; }
    case 'shootout': {
      fixCamera(game, 197.2, 1.6, -204.8, 200.3, 1.05, -199.3);
      if (game.player) { game.player.x = 200;
        game.player.z = -200;
        game.player.angle = Math.atan2(-12, -8);
        game.player.fig.position.set(200, groundH(200, -200), -200);
        game.player.fig.rotation.y = game.player.angle;
        if (game.weapons && game.weapons.equip) game.weapons.equip('pistol');
      }
      game.flags.forceFlash = 'foot';
      const fallenFigure = dropCastFigure(game, 'ren', 202, -197.5, 0.6);
      fallenFigure.rotation.x = -1.35;
      fallenFigure.position.y = groundH(202, -197.5) + 0.15;
      const runningFigure = dropCastFigure(game, 'mika', 203.5, -196, Math.atan2(6, 7));
      runningFigure.rotation.x = 0.15;
      const stagedCopVehicle = spawnVehicle(game, 'police', 204.5, -195, -2.36, { driver: 'cop' });
      applyNpcPoliceGlb(stagedCopVehicle);
      break; }
    case 'heli': {
      spawnVehicle(game, 'taiyo', -200, 300, 0.4, { driver: 'parked' });
      spawnVehicle(game, 'police-suv', -192, 292, -2.4, { driver: 'cop' });
      game.flags.heliStage = { x: -200, z: 300 };
      fixCamera(game, -186, 2.0, 314, -198, 1.2, 298);
      break; }
    case 'street': {
      game.timeOfDay = 10.5;
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      spawnVehicle(game, 'taiyo', 150, -128, Math.PI, { driver: 'parked' });
      fixCamera(game, 161, 1.7, -133, 149, 1.5, -156);
      break; }
    case 'smoke': {
      game.timeOfDay = 10.5;
      fixCamera(game, -405.4, 1.5, 446.6, -411.7, 0.9, 447.2);
      const smokingVehicle = spawnVehicle(game, 'taiyo', -412.5, 446, 0.6, { driver: 'parked' });
      smokingVehicle.health = 12;
      primeDamageSmoke(game, smokingVehicle, 12);
      let elapsedSecs = 0;
      game.updaters.push((frameGame, dtVal) => {
        elapsedSecs = elapsedSecs + (dtVal || 0);
        if (0.9 <= elapsedSecs) { elapsedSecs = 0; primeDamageSmoke(game, smokingVehicle, 12); }
      });
      break; }
    case 'night': {
      game.timeOfDay = 21.5;
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      const nightVehicle = spawnVehicle(game, 'taiyo', 5, -40, 0, { driver: 'parked' });
      const seatedFigure = makeFigure(CAST.ren);
      poseSeated(seatedFigure);
      seatedFigure.position.set(-0.4, 0.42, 0.15);
      nightVehicle.mesh.add(seatedFigure);
      if (game.player) { game.player.x = 14;
        game.player.z = -26;
        game.player.angle = Math.PI;
        game.player.fig.position.set(14, groundH(14, -26), -26);
        game.player.fig.rotation.y = Math.PI;
      }
      fixCamera(game, 13, 2.0, -18, 2, 0.7, -58);
      game.updaters.push(repinCam);
      break; }
    case 'markings': {
      game.timeOfDay = 10.5;
      if (game.player) { game.player.x = 14;
        game.player.z = -92;
        game.player.fig.position.set(14, groundH(14, -92), -92);
      }
      fixCamera(game, 5.5, 1.3, -126, -1, 0.3, -160);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      break; }
    case 'sky': {
      game.timeOfDay = 8.8;
      if (game.player) { game.player.x = -34;
        game.player.z = -18;
        game.player.fig.position.set(-34, groundH(-34, -18), -18);
      }
      fixCamera(game, -30, 1.8, -14, 17, 30, 10);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      break; }
    case 'busy': {
      game.timeOfDay = 11;
      if (game.player) { game.player.x = 176.5;
        game.player.z = 153.5;
        game.player.angle = Math.atan2(182.2 - 176.5, 147.8 - 153.5);
        game.player.fig.position.set(176.5, groundH(176.5, 153.5), 153.5);
        game.player.fig.rotation.y = game.player.angle;
      }
      try {
        const spotList = [{ x: 166, z: 147.8, vertical: false, dir: 1 }, { x: 198, z: 147.8, vertical: false, dir: -1 }, { x: 182.2, z: 158, vertical: true, dir: 1 }];
        const candidateList = Array.isArray(game.peds) ? game.peds.filter((pedObj) => pedObj && pedObj.fig && !(pedObj.downed) && !(pedObj.chat) && !('cross' === pedObj.mode) && !(pedObj.follow)) : [];
        const pickedList = [...pool.filter((pedObj) => pedObj.figIsGlb), ...pool.filter((pedObj) => !(pedObj.figIsGlb))].slice(0, spotList.length);
        void candidateList;
        pickedList.forEach((pedObj, idxNow) => {
          const spotObj = spotList[idxNow];
          pedObj.x = spotObj.x; pedObj.z = spotObj.z;
          pedObj.idle = false;
          pedObj.fleeT = 0;
          pedObj.fleeDir = null;
          pedObj.vertical = spotObj.vertical;
          pedObj.off = (('number' === typeof pedObj.off) && (0 !== pedObj.off)) ? pedObj.off : 17.2;
          pedObj.line = (spotObj.vertical ? spotObj.x : spotObj.z) - pedObj.off;
          pedObj.dir = spotObj.dir;
          pedObj.angle = spotObj.vertical ? ((0 < spotObj.dir) ? 0 : Math.PI) : ((0 < spotObj.dir) ? Math.PI / 2 : -Math.PI / 2);
          try {
            pedObj.fig.position.set(spotObj.x, groundH(spotObj.x, spotObj.z), spotObj.z);
            pedObj.fig.rotation.y = pedObj.angle;
          } catch (ignoredErr) {}
        });
      } catch (ignoredErr) {}
      spawnVehicle(game, 'taxi', 205, 171, -Math.PI / 2, { driver: 'parked' });
      fixCamera(game, 177.5, 1.6, 142.5, 183, 1.1, 149);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      break; }
    case 'houses': {
      game.timeOfDay = 10.5;
      if (game.player) { game.player.x = -424;
        game.player.z = -370;
        game.player.angle = Math.PI;
        game.player.fig.position.set(-424, groundH(-424, -370), -370);
        game.player.fig.rotation.y = Math.PI;
      }
      spawnVehicle(game, 'wagon', -396, -367, 0, { driver: 'parked' });
      fixCamera(game, -433, groundH(-433, -366) + 1.7, -366, -430, groundH(-430, -383) + 1.6, -383);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      break; }
    case 'market': {
      game.timeOfDay = 11;
      if (game.player) { game.player.x = -52;
        game.player.z = -232;
        game.player.angle = Math.atan2(-82.5 + 52, -255 + 232);
        game.player.fig.position.set(-52, groundH(-52, -232), -232);
        game.player.fig.rotation.y = game.player.angle;
      }
      fixCamera(game, -42, 3.4, -212, -80, 3.2, -250);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      break; }
    case 'vice': {
      fixCamera(game, 208, groundH(208, 493) + 3.8, 493, 40, groundH(40, 503) + 1.0, 503);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DUSK_BY_MODE.vice;
      spawnVehicle(game, 'sedan', 150, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'roadster', 108, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'hatch', 62, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'wagon', -18, 499, -Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = 122;
        game.player.z = 505;
        game.player.angle = Math.PI;
        game.player.fig.position.set(122, groundH(122, 505), 505);
        game.player.fig.rotation.y = Math.PI;
      }
      break; }
    case 'vice-street': {
      fixCamera(game, 38, 1.6, 488, 128, 1.1, 497);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DUSK_BY_MODE.street;
      spawnVehicle(game, 'taiyo', 66, 492, 1.35, { driver: 'parked' });
      spawnVehicle(game, 'sedan', 102, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'hatch', 142, 491, Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = 52;
        game.player.z = 483;
        game.player.angle = Math.PI / 2;
        game.player.fig.position.set(52, groundH(52, 483), 483);
        game.player.fig.rotation.y = Math.PI / 2;
      }
      break; }
    case 'vice-markings': {
      fixCamera(game, 7.5, 1.25, 460, -1.5, 0.3, 497);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      game.timeOfDay = DUSK_BY_MODE.markings;
      if (game.player) { game.player.x = 16;
        game.player.z = 470;
        game.player.fig.position.set(16, groundH(16, 470), 470);
      }
      break; }
    case 'vice-houses': {
      fixCamera(game, -436, groundH(-436, -336) + 1.7, -336, -429, groundH(-429, -383) + 1.6, -383);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } });
      game.timeOfDay = DUSK_BY_MODE.houses;
      if (game.player) { game.player.x = -424;
        game.player.z = -352;
        game.player.angle = Math.PI;
        game.player.fig.position.set(-424, groundH(-424, -352), -352);
        game.player.fig.rotation.y = Math.PI;
      }
      spawnVehicle(game, 'wagon', -404, -342, Math.PI / 2, { driver: 'parked' });
      break; }
    case 'v5-strip': {
      fixCamera(game, 128, groundH(128, 493) + 2.0, 493, 52, groundH(52, 500) + 1.4, 500);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } pinShadowTo(game, 52, 500); });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DAY_BY_MODE.strip;
      pinShadowTo(game, 52, 500);
      spawnVehicle(game, 'sedan', 88, 504, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'hatch', 64, 486, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'wagon', 150, 504, Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = 112;
        game.player.z = 503;
        game.player.angle = Math.atan2(128 - 112, 493 - 503);
        game.player.fig.position.set(112, groundH(112, 503), 503);
        game.player.fig.rotation.y = game.player.angle;
      }
      break; }
    case 'v5-boulevard': {
      fixCamera(game, 90, groundH(90, 502) + 1.6, 502, 101, groundH(101, 511) + 1.3, 511);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } pinShadowTo(game, 101, 511); });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DAY_BY_MODE.boulevard;
      pinShadowTo(game, 101, 511);
      spawnVehicle(game, 'roadster', 70, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'sedan', 128, 491, Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = 95;
        game.player.z = 505;
        game.player.angle = Math.atan2(100 - 95, 511 - 505);
        game.player.fig.position.set(95, groundH(95, 505), 505);
        game.player.fig.rotation.y = game.player.angle;
      }
      break; }
    case 'v5-houses': {
      fixCamera(game, -472, groundH(-472, -331) + 1.7, -331, -420, groundH(-420, -352) + 1.5, -352);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } pinShadowTo(game, -420, -352); });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DAY_BY_MODE.houses;
      pinShadowTo(game, -420, -352);
      spawnVehicle(game, 'wagon', -420, -341, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'sedan', -398, -352, -Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = -444;
        game.player.z = -350;
        game.player.angle = Math.atan2(-452 + 444, -334 + 350);
        game.player.fig.position.set(-444, groundH(-444, -350), -350);
        game.player.fig.rotation.y = game.player.angle;
      }
      break; }
    case 'v5-markings': {
      fixCamera(game, 10.5, groundH(10.5, 472) + 1.35, 472, -2, groundH(-2, 496) + 0.4, 496);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } pinShadowTo(game, -2, 496); });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DAY_BY_MODE.markings;
      pinShadowTo(game, -2, 496);
      spawnVehicle(game, 'hatch', -24, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(game, 'sedan', 30, 499, -Math.PI / 2, { driver: 'parked' });
      if (game.player) { game.player.x = 17;
        game.player.z = 479;
        game.player.angle = Math.atan2(10.5 - 17, 472 - 479);
        game.player.fig.position.set(17, groundH(17, 479), 479);
        game.player.fig.rotation.y = game.player.angle;
      }
      break; }
    case 'v5-park': {
      let parkRefObj = { x: 82, z: 415 };
      try {
        if (game.parkSpot && Number.isFinite(game.parkSpot.x) && Number.isFinite(game.parkSpot.z)) parkRefObj = game.parkSpot;
      } catch (ignoredErr) {}
      const parkXVal = parkRefObj.x;
      const parkZVal = parkRefObj.z;
      const parkGroundVal = groundH(parkXVal, parkZVal);
      fixCamera(game, parkXVal - 17, parkGroundVal + 2.1, parkZVal - 14, parkXVal + 2, parkGroundVal + 1.0, parkZVal + 2);
      game.updaters.push(() => { if (game.shotCam) { game.shotCam(); } pinShadowTo(game, parkXVal, parkZVal); });
      game.radioName = 'WAVEFORM FM';
      game._radioIdx = 0;
      game.timeOfDay = DAY_BY_MODE.park;
      pinShadowTo(game, parkXVal, parkZVal);
      if (game.player) { game.player.x = parkXVal + 6;
        game.player.z = parkZVal + 5;
        game.player.angle = Math.atan2(-17 - 6, -14 - 5);
        game.player.fig.position.set(parkXVal + 6, groundH(parkXVal + 6, parkZVal + 5), parkZVal + 5);
        game.player.fig.rotation.y = game.player.angle;
      }
      break; }
    case 'mapzoom': {
      if (game.player) { game.player.x = 300;
        game.player.z = -300;
        game.player.fig.position.set(300, groundH(300, -300), -300);
      }
      game.flags.mapZoom = true;
      fixCamera(game, 285, 8, -322, 305, 0, -295);
      break; }
    case 'pausemap': {
      game.flags.openPauseMap = true;
      game.paused = true;
      try { game.togglePause?.(); } catch (ignoredErr) {}
      fixCamera(game, 0, 30, -60, 0, 0, 0);
      break; }
    case 'wasted': {
      game.timeOfDay = 18.5;
      if (game.player) { game.player.x = 165;
        game.player.z = -140;
        game.player.angle = 0.6;
        game.player.fig.position.set(165, groundH(165, -140), -140);
        game.player.fig.rotation.y = 0.6;
      }
      try { game.hud?.showWasted?.('Downtown'); } catch (ignoredErr) {}
      fixCamera(game, 171, 1.7, -133, 164, 1.0, -141);
      break; }
    case 'busted': {
      const stagedVehicle = spawnVehicle(game, 'taiyo', 165, -140, 0.4, { driver: 'parked' });
      const seatedFigure = makeFigure(CAST.ren);
      poseSeated(seatedFigure);
      seatedFigure.position.set(-0.4, 0.42, 0.15);
      stagedVehicle.mesh.add(seatedFigure);
      const copVehicleA = spawnVehicle(game, 'police', 158, -148, 0.9, { driver: 'cop' });
      applyNpcPoliceGlb(copVehicleA);
      const copVehicleB = spawnVehicle(game, 'police', 173, -133, -2.2, { driver: 'cop' });
      applyNpcPoliceGlb(copVehicleB);
      copVehicleA.staged = true;
      copVehicleB.staged = true;
      game.cops.push(copVehicleA, copVehicleB);
      dropCastFigure(game, 'cop', 162.8, -137.5, 2.42);
      dropCastFigure(game, 'cop', 167.2, -142.5, -0.72);
      game.wanted = 4;
      try { game.hud?.showBusted?.(); } catch (ignoredErr) {}
      fixCamera(game, 176, 2.2, -128, 164, 1.0, -141);
      break; }
    default: break;
  }
  // Most staged frames hide the loose player figure; exceptions follow.
  const keepVisibleModes = ['meet', 'chars', 'mc', 'mapzoom', 'city', 'cover', 'shootout', 'smg', 'bat', 'wasted', 'busted', 'versus', 'chase', 'markings', 'sky', 'busy', 'houses', 'market', 'night', 'vice', 'vice-street', 'vice-markings', 'vice-houses', 'v5-strip', 'v5-boulevard', 'v5-houses', 'v5-markings', 'v5-park'];
  if (game.player && !(keepVisibleModes.includes(modeKey))) {
    game.player.x = -412.5;
    game.player.z = 470;
  }
}
export { THREE };
