// Screenshot staging lives in this module; each named mode
// arranges its scene a single time when it gets selected.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { applyCastFigureOverride, makeFigure, poseSeated } from './player.js';
import { applyNpcPoliceGlb, primeDamageSmoke, spawnVehicle } from './cars.js';
// Dusk clock values shared by the vice family of modes.
const DUSK_TIMES = { street: 18.1, vice: 17.9, houses: 17.8, markings: 17.9 };
// Midday clock values for the later density modes.
const DAY_TIMES = { boulevard: 12.0, strip: 12.4, park: 12.2, houses: 12.8, markings: 11.6 };
// Shadow frustum used when a staged frame tightens the sun box.
const SHADOW_BOX = { far: 600, box: 85, near: 10 };
function setShadowEdges(camNode, halfVal) {
  camNode.left = -halfVal;
  camNode.right = halfVal;
  camNode.top = halfVal;
  camNode.bottom = -halfVal;
}
function applyShadowBox(camNode) {
  setShadowEdges(camNode, SHADOW_BOX.box);
  camNode.near = SHADOW_BOX.near;
  camNode.far = SHADOW_BOX.far;
  camNode.updateProjectionMatrix();
}
function aimSunTarget(stageRef, sunNode, focusXIn, focusZIn) {
  sunNode.target.position.set(focusXIn, groundH(focusXIn, focusZIn), focusZIn);
  if (stageRef.scene && !sunNode.target.parent) stageRef.scene.add(sunNode.target);
  sunNode.target.updateMatrixWorld();
}
function pinShadowTo(stageRef, focusXIn, focusZIn) {
  const sunNode = stageRef.sun;
  if (!sunNode || !sunNode.shadow || !sunNode.shadow.camera) return;
  try {
    applyShadowBox(sunNode.shadow.camera);
    if (sunNode.target) aimSunTarget(stageRef, sunNode, focusXIn, focusZIn);
  } catch (swallowed) {}
}
function dropCastFigure(stageRef, castIn, pxIn, pzIn, headingIn) {
  const figureNode = makeFigure(CAST[castIn]);
  applyCastFigureOverride(figureNode, castIn);
  figureNode.position.set(pxIn, groundH(pxIn, pzIn), pzIn);
  figureNode.rotation.y = headingIn || 0;
  stageRef.scene.add(figureNode);
  return figureNode;
}
function fixCamera(stageRef, camXIn, camYIn, camZIn, lookXIn, lookYIn, lookZIn) {
  stageRef.shotCam = () => {
    const camNode = stageRef.camera;
    camNode.fov = 60;
    camNode.updateProjectionMatrix();
    camNode.position.set(camXIn, camYIn, camZIn);
    camNode.lookAt(lookXIn, lookYIn, lookZIn);
  };
  stageRef.shotCam();
}
export function setupShot(shotGame, modeIn) {
  shotGame.shot = modeIn;
  shotGame.shotMode = modeIn;
  const repinShot = () => { if (shotGame.shotCam) shotGame.shotCam(); };
  function stageSvjRear() {
    shotGame.timeOfDay = 10.5;
    const showRide = (shotGame.vehicles || []).find((vehItem) => vehItem && ('svj' === vehItem.specId));
    if (showRide) {
      showRide._brakeStaged = true;
      const tailMat = showRide.mesh && showRide.mesh.userData.tailMat;
      if (tailMat) tailMat.emissiveIntensity = 2.4;
    }
    fixCamera(shotGame, -435.2, 0.95, 447.8, -430.2, 0.72, 452.2);
  }
  switch (modeIn) {
    case 'city':
    case 'cover': {
      const stagedRide = spawnVehicle(shotGame, 'hero-supra', 150, -148, 0.85, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 153.2;
        shotGame.player.z = -144.6;
        shotGame.player.angle = 0.8;
        shotGame.player.fig.position.set(153.2, groundH(153.2, -144.6), -144.6);
        shotGame.player.fig.rotation.y = 0.8;
      }
      fixCamera(shotGame, 156.5, 1.35, -141.5, 150.5, 0.95, -148.5);
      void stagedRide;
      try {
        const spotArr = [[140, -138], [146, -133], [136, -143]];
        const candArr = Array.isArray(shotGame.peds) ? shotGame.peds.filter((walker) => walker && walker.fig && !walker.downed) : [];
        const pickedArr = [...allPeds.filter((walker) => walker.figIsGlb), ...allPeds.filter((walker) => !walker.figIsGlb)].slice(0, spotArr.length);
        void candArr;
        pickedArr.forEach((walker, idxVal) => {
          const pxIn = spotArr[idxVal][0];
          const pzIn = spotArr[idxVal][1];
          walker.x = pxIn;
          walker.z = pzIn;
          walker.idle = false;
          walker.fleeT = 0;
          walker.fleeDir = null;
          walker.vertical = false;
          walker.off = (('number' === typeof walker.off) && (0 !== walker.off)) ? walker.off : 17.2;
          walker.line = pzIn - walker.off;
          walker.dir = 1;
          walker.angle = Math.PI / 2;
          try {
            walker.fig.position.set(pxIn, groundH(pxIn, pzIn), pzIn);
            walker.fig.rotation.y = walker.angle;
          } catch (swallowed) {}
        });
      } catch (swallowed) {}
      break;
    }
    case 'meet': {
      const meetRideKeys = ['hachi', 'sora15', 'hoshi7', 'kaze'];
      const meetRideXs = [-434, -422, -410, -398];
      meetRideKeys.forEach((carName, idxVal) => spawnVehicle(shotGame, carName, meetRideXs[idxVal], 446, 0, { driver: 'parked' }));
      const meetCastKeys = ['ren', 'ako', 'mika', 'jun'];
      meetCastKeys.forEach((castName, idxVal) => dropCastFigure(shotGame, castName, meetRideXs[idxVal] + 1.5, 451, 0));
      shotGame.timeOfDay = 11.5;
      fixCamera(shotGame, -433, 1.7, 458, -415, 1.0, 447);
      break;
    }
    case 'chase': {
      shotGame.timeOfDay = 17.6;
      shotGame.heliShot = { altitude: 16, radius: 11 };
      const heroRide = spawnVehicle(shotGame, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 100;
        shotGame.player.z = 495;
        shotGame.player.angle = Math.PI / 2;
        shotGame.player.fig.position.set(100, groundH(100, 495), 495);
        shotGame.player.fig.rotation.y = Math.PI / 2;
        shotGame.player.fig.visible = false;
      }
      heroRide.driver = 'player';
      shotGame.car = heroRide;
      shotGame.flags.inCar = true;
      shotGame.updaters.push(() => {
        heroRide.x = 100;
        heroRide.z = 495;
        heroRide.angle = Math.PI / 2;
        if (heroRide.mesh) heroRide.mesh.position.set(100, groundH(100, 495) + 0.02, 495);
      });
      shotGame.wanted = 4;
      heroRide.speed = 22;
      heroRide.health = 45;
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      const seatedFigure = makeFigure(CAST.ren);
      poseSeated(seatedFigure);
      seatedFigure.position.set(-0.4, 0.42, 0.15);
      heroRide.mesh.add(seatedFigure);
      shotGame.flags.flashCar = heroRide;
      shotGame.flags.forceFlash = 'car';
      const copRideA = spawnVehicle(shotGame, 'police', 86, 489, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copRideA);
      const copRideB = spawnVehicle(shotGame, 'police', 82, 502, Math.PI / 2, { driver: 'cop' });
      applyNpcPoliceGlb(copRideB);
      copRideA.staged = true;
      copRideB.staged = true;
      shotGame.cops.push(copRideA, copRideB);
      shotGame.flags.heliStage = { x: 100, z: 495 };
      fixCamera(shotGame, 112, 3.2, 478, 99, 1.2, 496);
      break;
    }
    case 'hero': {
      fixCamera(shotGame, 114, 1.5, 479, 97, 0.9, 493);
      shotGame.updaters.push(repinShot);
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = 17.9;
      const stagedRide = spawnVehicle(shotGame, 'taiyo', 100, 491, 1.2, { driver: 'parked' });
      void stagedRide;
      break;
    }
    case 'svj': {
      shotGame.timeOfDay = 10.5;
      fixCamera(shotGame, -425.8, 1.05, 445.8, -430.2, 0.72, 452.3);
      break;
    }
    case 'svjrear': {
      stageSvjRear();
      break;
    }
    case 'lineup': {
      const lineupKeys = ['hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra','gtr35','svj'];
      lineupKeys.forEach((carName, idxVal) => spawnVehicle(shotGame, carName, -558 + (62 * idxVal), 487, Math.PI / 2, { driver: 'parked' }));
      fixCamera(shotGame, -545, 2.2, 468, -450, 1, 490);
      break;
    }
    case 'chars': {
      const charsCastKeys = ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop', 'shun'];
      charsCastKeys.forEach((castName, idxVal) => dropCastFigure(shotGame, castName, -436 + (7 * idxVal), 448, Math.PI));
      fixCamera(shotGame, -412, 1.5, 443.8, -412, 1.0, 448);
      break;
    }
    case 'versus': {
      shotGame.timeOfDay = 17.8;
      spawnVehicle(shotGame, 'taiyo', 88, 491, 1.2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 97;
        shotGame.player.z = 494.5;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(97, groundH(97, 494.5), 494.5);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      spawnVehicle(shotGame, 'gtr35', 112, 491, 1.2, { driver: 'parked' });
      dropCastFigure(shotGame, 'shun', 104, 494.5, Math.PI);
      fixCamera(shotGame, 100, 1.6, 478, 100, 0.9, 492);
      break;
    }
    case 'mc': {
      if (shotGame.player) {
        shotGame.player.x = -406;
        shotGame.player.z = 440;
        shotGame.player.angle = 0;
        shotGame.player.fig.position.set(-406, groundH(-406, 440), 440);
        shotGame.player.fig.rotation.y = 0;
      }
      fixCamera(shotGame, -406, 1.1, 442.2, -406, 1.0, 440);
      break;
    }
    case 'smg': {
      if (shotGame.player) {
        shotGame.player.x = -412.5;
        shotGame.player.z = 440;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      if (shotGame.weapons && shotGame.weapons.equip) shotGame.weapons.equip('smg');
      fixCamera(shotGame, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
      break;
    }
    case 'bat': {
      if (shotGame.player) {
        shotGame.player.x = -412.5;
        shotGame.player.z = 440;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      if (shotGame.weapons && shotGame.weapons.equip) shotGame.weapons.equip('bat');
      fixCamera(shotGame, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
      break;
    }
    case 'shootout': {
      fixCamera(shotGame, 197.2, 1.6, -204.8, 200.3, 1.05, -199.3);
      if (shotGame.player) {
        shotGame.player.x = 200;
        shotGame.player.z = -200;
        shotGame.player.angle = Math.atan2(-12, -8);
        shotGame.player.fig.position.set(200, groundH(200, -200), -200);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
        if (shotGame.weapons && shotGame.weapons.equip) shotGame.weapons.equip('pistol');
      }
      shotGame.flags.forceFlash = 'foot';
      const fallenFigure = dropCastFigure(shotGame, 'ren', 202, -197.5, 0.6);
      fallenFigure.rotation.x = -1.35;
      fallenFigure.position.y = groundH(202, -197.5) + 0.15;
      const runnerFigure = dropCastFigure(shotGame, 'mika', 203.5, -196, Math.atan2(6, 7));
      runnerFigure.rotation.x = 0.15;
      const copRide = spawnVehicle(shotGame, 'police', 204.5, -195, -2.36, { driver: 'cop' });
      applyNpcPoliceGlb(copRide);
      break;
    }
    case 'heli': {
      spawnVehicle(shotGame, 'taiyo', -200, 300, 0.4, { driver: 'parked' });
      spawnVehicle(shotGame, 'police-suv', -192, 292, -2.4, { driver: 'cop' });
      shotGame.flags.heliStage = { x: -200, z: 300 };
      fixCamera(shotGame, -186, 2.0, 314, -198, 1.2, 298);
      break;
    }
    case 'street': {
      shotGame.timeOfDay = 10.5;
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      spawnVehicle(shotGame, 'taiyo', 150, -128, Math.PI, { driver: 'parked' });
      fixCamera(shotGame, 161, 1.7, -133, 149, 1.5, -156);
      break;
    }
    case 'smoke': {
      shotGame.timeOfDay = 10.5;
      fixCamera(shotGame, -405.4, 1.5, 446.6, -411.7, 0.9, 447.2);
      const smokeRide = spawnVehicle(shotGame, 'taiyo', -412.5, 446, 0.6, { driver: 'parked' });
      smokeRide.health = 12;
      primeDamageSmoke(shotGame, smokeRide, 12);
      let elapsedVal = 0;
      shotGame.updaters.push((frameState, dtStep) => {
        elapsedVal = elapsedVal + (dtStep || 0);
        if (elapsedVal >= 0.9) { elapsedVal = 0; primeDamageSmoke(shotGame, smokeRide, 12); }
      });
      break;
    }
    case 'night': {
      shotGame.timeOfDay = 21.5;
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      const nightRide = spawnVehicle(shotGame, 'taiyo', 5, -40, 0, { driver: 'parked' });
      const seatedFigure = makeFigure(CAST.ren);
      poseSeated(seatedFigure);
      seatedFigure.position.set(-0.4, 0.42, 0.15);
      nightRide.mesh.add(seatedFigure);
      if (shotGame.player) {
        shotGame.player.x = 14;
        shotGame.player.z = -26;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(14, groundH(14, -26), -26);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      fixCamera(shotGame, 13, 2.0, -18, 2, 0.7, -58);
      shotGame.updaters.push(repinShot);
      break;
    }
    case 'markings': {
      shotGame.timeOfDay = 10.5;
      if (shotGame.player) {
        shotGame.player.x = 14;
        shotGame.player.z = -92;
        shotGame.player.fig.position.set(14, groundH(14, -92), -92);
      }
      fixCamera(shotGame, 5.5, 1.3, -126, -1, 0.3, -160);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      break;
    }
    case 'sky': {
      shotGame.timeOfDay = 8.8;
      if (shotGame.player) {
        shotGame.player.x = -34;
        shotGame.player.z = -18;
        shotGame.player.fig.position.set(-34, groundH(-34, -18), -18);
      }
      fixCamera(shotGame, -30, 1.8, -14, 17, 30, 10);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      break;
    }
    case 'busy': {
      shotGame.timeOfDay = 11;
      if (shotGame.player) {
        shotGame.player.x = 176.5;
        shotGame.player.z = 153.5;
        shotGame.player.angle = Math.atan2(182.2 + -176.5, 147.8 + -153.5);
        shotGame.player.fig.position.set(176.5, groundH(176.5, 153.5), 153.5);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      try {
        const spotArr = [{ x: 166, z: 147.8, vertical: false, dir: 1 }, { x: 198, z: 147.8, vertical: false, dir: -1 }, { x: 182.2, z: 158, vertical: true, dir: 1 }];
        const candArr = Array.isArray(shotGame.peds) ? shotGame.peds.filter((walker) => walker && walker.fig && !walker.downed && !walker.chat && !('cross' === walker.mode) && !walker.follow) : [];
        const pickedArr = [...pool.filter((walker) => walker.figIsGlb), ...pool.filter((walker) => !walker.figIsGlb)].slice(0, spotArr.length);
        void candArr;
        pickedArr.forEach((walker, idxVal) => {
          const spotItem = spotArr[idxVal];
          walker.x = spotItem.x;
          walker.z = spotItem.z;
          walker.idle = false;
          walker.fleeT = 0;
          walker.fleeDir = null;
          walker.vertical = spotItem.vertical;
          walker.off = (('number' === typeof walker.off) && (0 !== walker.off)) ? walker.off : 17.2;
          walker.line = (spotItem.vertical ? spotItem.x : spotItem.z) - walker.off;
          walker.dir = spotItem.dir;
          walker.angle = spotItem.vertical ? ((spotItem.dir > 0) ? 0 : Math.PI) : ((spotItem.dir > 0) ? Math.PI / 2 : -Math.PI / 2);
          try {
            walker.fig.position.set(spotItem.x, groundH(spotItem.x, spotItem.z), spotItem.z);
            walker.fig.rotation.y = walker.angle;
          } catch (swallowed) {}
        });
      } catch (swallowed) {}
      spawnVehicle(shotGame, 'taxi', 205, 171, -Math.PI / 2, { driver: 'parked' });
      fixCamera(shotGame, 177.5, 1.6, 142.5, 183, 1.1, 149);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      break;
    }
    case 'houses': {
      shotGame.timeOfDay = 10.5;
      if (shotGame.player) {
        shotGame.player.x = -424;
        shotGame.player.z = -370;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(-424, groundH(-424, -370), -370);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      spawnVehicle(shotGame, 'wagon', -396, -367, 0, { driver: 'parked' });
      fixCamera(shotGame, -433, groundH(-433, -366) + 1.7, -366, -430, groundH(-430, -383) + 1.6, -383);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      break;
    }
    case 'market': {
      shotGame.timeOfDay = 11;
      if (shotGame.player) {
        shotGame.player.x = -52;
        shotGame.player.z = -232;
        shotGame.player.angle = Math.atan2(-82.5 + 52, -255 + 232);
        shotGame.player.fig.position.set(-52, groundH(-52, -232), -232);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      fixCamera(shotGame, -42, 3.4, -212, -80, 3.2, -250);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      break;
    }
    case 'vice': {
      fixCamera(shotGame, 208, groundH(208, 493) + 3.8, 493, 40, groundH(40, 503) + 1.0, 503);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DUSK_TIMES.vice;
      spawnVehicle(shotGame, 'sedan', 150, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'roadster', 108, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'hatch', 62, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'wagon', -18, 499, -Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 122;
        shotGame.player.z = 505;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(122, groundH(122, 505), 505);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      break;
    }
    case 'vice-street': {
      fixCamera(shotGame, 38, 1.6, 488, 128, 1.1, 497);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DUSK_TIMES.street;
      spawnVehicle(shotGame, 'taiyo', 66, 492, 1.35, { driver: 'parked' });
      spawnVehicle(shotGame, 'sedan', 102, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'hatch', 142, 491, Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 52;
        shotGame.player.z = 483;
        shotGame.player.angle = Math.PI / 2;
        shotGame.player.fig.position.set(52, groundH(52, 483), 483);
        shotGame.player.fig.rotation.y = Math.PI / 2;
      }
      break;
    }
    case 'vice-markings': {
      fixCamera(shotGame, 7.5, 1.25, 460, -1.5, 0.3, 497);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      shotGame.timeOfDay = DUSK_TIMES.markings;
      if (shotGame.player) {
        shotGame.player.x = 16;
        shotGame.player.z = 470;
        shotGame.player.fig.position.set(16, groundH(16, 470), 470);
      }
      break;
    }
    case 'vice-houses': {
      fixCamera(shotGame, -436, groundH(-436, -336) + 1.7, -336, -429, groundH(-429, -383) + 1.6, -383);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } });
      shotGame.timeOfDay = DUSK_TIMES.houses;
      if (shotGame.player) {
        shotGame.player.x = -424;
        shotGame.player.z = -352;
        shotGame.player.angle = Math.PI;
        shotGame.player.fig.position.set(-424, groundH(-424, -352), -352);
        shotGame.player.fig.rotation.y = Math.PI;
      }
      spawnVehicle(shotGame, 'wagon', -404, -342, Math.PI / 2, { driver: 'parked' });
      break;
    }
    case 'v5-strip': {
      fixCamera(shotGame, 128, groundH(128, 493) + 2.0, 493, 52, groundH(52, 500) + 1.4, 500);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } pinShadowTo(shotGame, 52, 500); });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DAY_TIMES.strip;
      pinShadowTo(shotGame, 52, 500);
      spawnVehicle(shotGame, 'sedan', 88, 504, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'hatch', 64, 486, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'wagon', 150, 504, Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 112;
        shotGame.player.z = 503;
        shotGame.player.angle = Math.atan2(128 + -112, 493 + -503);
        shotGame.player.fig.position.set(112, groundH(112, 503), 503);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      break;
    }
    case 'v5-boulevard': {
      fixCamera(shotGame, 90, groundH(90, 502) + 1.6, 502, 101, groundH(101, 511) + 1.3, 511);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } pinShadowTo(shotGame, 101, 511); });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DAY_TIMES.boulevard;
      pinShadowTo(shotGame, 101, 511);
      spawnVehicle(shotGame, 'roadster', 70, 499, -Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'sedan', 128, 491, Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 95;
        shotGame.player.z = 505;
        shotGame.player.angle = Math.atan2(100 + -95, 511 + -505);
        shotGame.player.fig.position.set(95, groundH(95, 505), 505);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      break;
    }
    case 'v5-houses': {
      fixCamera(shotGame, -472, groundH(-472, -331) + 1.7, -331, -420, groundH(-420, -352) + 1.5, -352);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } pinShadowTo(shotGame, -420, -352); });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DAY_TIMES.houses;
      pinShadowTo(shotGame, -420, -352);
      spawnVehicle(shotGame, 'wagon', -420, -341, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'sedan', -398, -352, -Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = -444;
        shotGame.player.z = -350;
        shotGame.player.angle = Math.atan2(-452 + 444, -334 + 350);
        shotGame.player.fig.position.set(-444, groundH(-444, -350), -350);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      break;
    }
    case 'v5-markings': {
      fixCamera(shotGame, 10.5, groundH(10.5, 472) + 1.35, 472, -2, groundH(-2, 496) + 0.4, 496);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } pinShadowTo(shotGame, -2, 496); });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DAY_TIMES.markings;
      pinShadowTo(shotGame, -2, 496);
      spawnVehicle(shotGame, 'hatch', -24, 491, Math.PI / 2, { driver: 'parked' });
      spawnVehicle(shotGame, 'sedan', 30, 499, -Math.PI / 2, { driver: 'parked' });
      if (shotGame.player) {
        shotGame.player.x = 17;
        shotGame.player.z = 479;
        shotGame.player.angle = Math.atan2(10.5 + -17, 472 + -479);
        shotGame.player.fig.position.set(17, groundH(17, 479), 479);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      break;
    }
    case 'v5-park': {
      let parkSpotIn = { x: 82, z: 415 };
      try {
        if (shotGame.parkSpot && Number.isFinite(shotGame.parkSpot.x) && Number.isFinite(shotGame.parkSpot.z)) parkSpotIn = shotGame.parkSpot;
      } catch (swallowed) {}
      const parkXVal = parkSpotIn.x;
      const parkZVal = parkSpotIn.z;
      const parkGround = groundH(parkXVal, parkZVal);
      fixCamera(shotGame, parkXVal + -17, parkGround + 2.1, parkZVal + -14, parkXVal + 2, parkGround + 1.0, parkZVal + 2);
      shotGame.updaters.push(() => { if (shotGame.shotCam) { shotGame.shotCam(); } pinShadowTo(shotGame, parkXVal, parkZVal); });
      shotGame.radioName = 'WAVEFORM FM';
      shotGame._radioIdx = 0;
      shotGame.timeOfDay = DAY_TIMES.park;
      pinShadowTo(shotGame, parkXVal, parkZVal);
      if (shotGame.player) {
        shotGame.player.x = parkXVal + 6;
        shotGame.player.z = parkZVal + 5;
        shotGame.player.angle = Math.atan2(-17 + -6, -14 + -5);
        shotGame.player.fig.position.set(parkXVal + 6, groundH(parkXVal + 6, parkZVal + 5), parkZVal + 5);
        shotGame.player.fig.rotation.y = shotGame.player.angle;
      }
      break;
    }
    case 'mapzoom': {
      if (shotGame.player) {
        shotGame.player.x = 300;
        shotGame.player.z = -300;
        shotGame.player.fig.position.set(300, groundH(300, -300), -300);
      }
      shotGame.flags.mapZoom = true;
      fixCamera(shotGame, 285, 8, -322, 305, 0, -295);
      break;
    }
    case 'pausemap': {
      shotGame.flags.openPauseMap = true;
      shotGame.paused = true;
      try { shotGame.togglePause?.(); } catch (swallowed) {}
      fixCamera(shotGame, 0, 30, -60, 0, 0, 0);
      break;
    }
    case 'wasted': {
      shotGame.timeOfDay = 18.5;
      if (shotGame.player) {
        shotGame.player.x = 165;
        shotGame.player.z = -140;
        shotGame.player.angle = 0.6;
        shotGame.player.fig.position.set(165, groundH(165, -140), -140);
        shotGame.player.fig.rotation.y = 0.6;
      }
      try { shotGame.hud?.showWasted?.('Downtown'); } catch (swallowed) {}
      fixCamera(shotGame, 171, 1.7, -133, 164, 1.0, -141);
      break;
    }
    case 'busted': {
      const stagedRide = spawnVehicle(shotGame, 'taiyo', 165, -140, 0.4, { driver: 'parked' });
      const seatedFigure = makeFigure(CAST.ren);
      poseSeated(seatedFigure);
      seatedFigure.position.set(-0.4, 0.42, 0.15);
      stagedRide.mesh.add(seatedFigure);
      const copRideA = spawnVehicle(shotGame, 'police', 158, -148, 0.9, { driver: 'cop' });
      applyNpcPoliceGlb(copRideA);
      const copRideB = spawnVehicle(shotGame, 'police', 173, -133, -2.2, { driver: 'cop' });
      applyNpcPoliceGlb(copRideB);
      copRideA.staged = true;
      copRideB.staged = true;
      shotGame.cops.push(copRideA, copRideB);
      dropCastFigure(shotGame, 'cop', 162.8, -137.5, 2.42);
      dropCastFigure(shotGame, 'cop', 167.2, -142.5, -0.72);
      shotGame.wanted = 4;
      try { shotGame.hud?.showBusted?.(); } catch (swallowed) {}
      fixCamera(shotGame, 176, 2.2, -128, 164, 1.0, -141);
      break;
    }
    default: break;
  }
  // Most staged frames hide the loose player figure; the modes
  // named in the list below are the exceptions.
  const visibleKeepAll = ['meet', 'chars', 'mc', 'mapzoom', 'city', 'cover', 'shootout', 'smg', 'bat', 'wasted', 'busted', 'versus', 'chase', 'markings', 'sky', 'busy', 'houses', 'market', 'night', 'vice', 'vice-street', 'vice-markings', 'vice-houses', 'v5-strip', 'v5-boulevard', 'v5-houses', 'v5-markings', 'v5-park'];
  if (shotGame.player && (visibleKeepAll.includes(modeIn) === false)) {
    shotGame.player.x = -412.5;
    shotGame.player.z = 470;
  }
}
export { THREE };
