// shots.js — screenshot staging
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated } from './player.js';
import { spawnVehicle } from './cars.js';

function placeFig(G, castId, x, z, angle) {
  const fig = makeFigure(CAST[castId]);
  fig.position.set(x, groundH(x, z), z); fig.rotation.y = angle || 0;
  G.scene.add(fig); return fig;
}
function cam(G, x, y, z, lx, ly, lz) {
  G.shotCam = () => {
    G.camera.position.set(x, y, z);
    G.camera.lookAt(lx, ly, lz);
  };
  G.shotCam();
}
export function setupShot(G, name) {
  G.shot = name;
  if (name === 'city') {
    const v = spawnVehicle(G, 'hero-supra', 150, -148, 0.85, { driver: 'parked' });
    if (G.player) {
      G.player.x = 153.2; G.player.z = -144.6; G.player.angle = 0.8;
      G.player.fig.position.set(153.2, groundH(153.2, -144.6), -144.6);
      G.player.fig.rotation.y = 0.8;
    }
    cam(G, 156.5, 1.35, -141.5, 150.5, 0.95, -148.5);
    void v;
  } else if (name === 'meet') {
    const ids = ['hachi', 'sora15', 'hoshi7', 'kaze'];
    const xs = [-434, -422, -410, -398];
    ids.forEach((id, i) => spawnVehicle(G, id, xs[i], 446, 0, { driver: 'parked' }));
    ['ren', 'ako', 'mika', 'jun'].forEach((cid, i) => placeFig(G, cid, xs[i] + 1.5, 451, 0));
    cam(G, -416, 1.9, 461, -416, 1.15, 445);
  } else if (name === 'chase') {
    const v = spawnVehicle(G, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
    v.speed = 22;
    const drv = makeFigure(CAST.ren); poseSeated(drv); drv.position.set(-0.4, 0.42, 0.15); v.mesh.add(drv);
    G.flags.flashCar = v; G.flags.forceFlash = 'car';
    const p1 = spawnVehicle(G, 'police', 86, 489, Math.PI / 2, { driver: 'cop' });
    const p2 = spawnVehicle(G, 'police', 82, 502, Math.PI / 2, { driver: 'cop' });
    p1.staged = true; p2.staged = true;
    G.cops.push(p1, p2);
    G.flags.heliStage = { x: 100, z: 495 };
    cam(G, 114, 2.6, 480, 97, 1.0, 496);
  } else if (name === 'hero') {
    const v = spawnVehicle(G, 'kaze', -300, -610, 2.2, { driver: 'parked' });
    cam(G, -291, groundH(-291, -600) + 2.0, -600, -300, groundH(-300, -610) + 0.8, -610);
    void v;
  } else if (name === 'lineup') {
    const all = ['hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra'];
    all.forEach((id, i) => spawnVehicle(G, id, -560 + i * 70, 560, Math.PI, { driver: 'parked' }));
    cam(G, -40, 10, 592, -40, 0.5, 556);
  } else if (name === 'chars') {
    ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop'].forEach((cid, i) => placeFig(G, cid, -436 + i * 8, 448, Math.PI));
    cam(G, -412, 1.5, 443.8, -412, 1.0, 448);
  } else if (name === 'mc') {
    if (G.player) {
      G.player.x = -412.5; G.player.z = 440; G.player.angle = Math.PI;
      G.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
      G.player.fig.rotation.y = Math.PI;
    }
    cam(G, -412.5, 1.1, 437.8, -412.5, 1.0, 440);
  } else if (name === 'smg') {
    // Close-up verify for the SMG GLB orientation (S13): same HQ apron
    // staging as 'mc', SMG equipped, camera 2.0 m in front. No forceFlash.
    if (G.player) {
      G.player.x = -412.5; G.player.z = 440; G.player.angle = Math.PI;
      G.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
      G.player.fig.rotation.y = Math.PI;
    }
    if (G.weapons && G.weapons.equip) G.weapons.equip('smg');
    cam(G, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
  } else if (name === 'bat') {
    // Close-up verify for the bat GLB orientation (S13): same staging.
    if (G.player) {
      G.player.x = -412.5; G.player.z = 440; G.player.angle = Math.PI;
      G.player.fig.position.set(-412.5, groundH(-412.5, 440), 440);
      G.player.fig.rotation.y = Math.PI;
    }
    if (G.weapons && G.weapons.equip) G.weapons.equip('bat');
    cam(G, -412.5, 1.25, 437.9, -412.5, 1.05, 440);
  } else if (name === 'shootout') {
    // Neon Mile (200,-200): player staged mid-street, pistol out, muzzle
    // flash held on; a downed figure, a fleeing figure and a frozen cop
    // car complete the scene. Dressing only — the police car is NOT
    // pushed to G.cops, so nothing chases.
    if (G.player) {
      G.player.x = 200; G.player.z = -200; G.player.angle = Math.atan2(-12, -8);
      G.player.fig.position.set(200, groundH(200, -200), -200);
      G.player.fig.rotation.y = G.player.angle;
      if (G.weapons && G.weapons.equip) G.weapons.equip('pistol');
    }
    G.flags.forceFlash = 'foot';
    const downed = placeFig(G, 'ren', 202.5, -197, 0.6);
    downed.rotation.x = -1.35; downed.position.y = groundH(202.5, -197) + 0.15;
    const fleeing = placeFig(G, 'mika', 206, -193, Math.atan2(6, 7));
    fleeing.rotation.x = 0.15;
    spawnVehicle(G, 'police', 188, -208, Math.atan2(12, 8), { driver: 'cop' });
    cam(G, 195.5, 1.7, -206.5, 200.5, 1.1, -199);
  } else if (name === 'heli') {
    spawnVehicle(G, 'taiyo', -200, 300, 0.4, { driver: 'parked' });
    spawnVehicle(G, 'police-suv', -192, 292, -2.4, { driver: 'cop' });
    G.flags.heliStage = { x: -200, z: 300 };
    cam(G, -186, 2.0, 314, -198, 1.2, 298);
  } else if (name === 'mapzoom') {
    if (G.player) { G.player.x = 300; G.player.z = -300; G.player.fig.position.set(300, groundH(300, -300), -300); }
    G.flags.mapZoom = true;
    cam(G, 285, 8, -322, 305, 0, -295);
  } else if (name === 'pausemap') {
    G.flags.openPauseMap = true;
    cam(G, 0, 30, -60, 0, 0, 0);
  }
  // hide player figure overlap in staged car shots except meet/chars/mc/mapzoom/city
  if (G.player && !['meet', 'chars', 'mc', 'mapzoom', 'city', 'shootout', 'smg', 'bat'].includes(name)) {
    G.player.x = -412.5; G.player.z = 470;
  }
}
export { THREE };
