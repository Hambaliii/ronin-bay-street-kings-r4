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
    const v = spawnVehicle(G, 'hero-supra', 165, -165, 0.6, { driver: 'parked' });
    placeFig(G, 'ren', 168.5, -161.5, -2.2);
    cam(G, 172, 1.6, -156, 165, 1.0, -165);
    void v;
  } else if (name === 'meet') {
    const ids = ['hachi', 'sora15', 'hoshi7', 'kaze'];
    ids.forEach((id, i) => spawnVehicle(G, id, -438 + i * 17, 448, Math.PI, { driver: 'parked' }));
    ['ren', 'ako', 'mika', 'jun'].forEach((cid, i) => placeFig(G, cid, -434 + i * 9, 441, Math.PI));
    cam(G, -412, 2.2, 428, -412, 1.1, 448);
  } else if (name === 'chase') {
    const v = spawnVehicle(G, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
    v.speed = 22;
    const drv = makeFigure(CAST.ren); poseSeated(drv); drv.position.set(-0.4, 0.42, 0.15); v.mesh.add(drv);
    const p1 = spawnVehicle(G, 'police', 84, 490, Math.PI / 2, { driver: 'cop' });
    const p2 = spawnVehicle(G, 'police', 80, 501, Math.PI / 2, { driver: 'cop' });
    G.cops.push(p1, p2);
    cam(G, 118, 3.2, 478, 96, 1, 496);
  } else if (name === 'hero') {
    const x = -300, z = -610, y = groundH(x, z);
    const v = spawnVehicle(G, 'kaze', x, z, 0.9, { driver: 'parked' });
    cam(G, x + 6, y + 2.2, z + 7, x, y + 0.9, z);
    void v;
  } else if (name === 'lineup') {
    const all = ['hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra'];
    all.forEach((id, i) => spawnVehicle(G, id, -560 + i * 70, 560, Math.PI, { driver: 'parked' }));
    cam(G, -40, 14, 600, -40, 0.5, 556);
  } else if (name === 'chars') {
    ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop'].forEach((cid, i) => placeFig(G, cid, -436 + i * 8, 448, Math.PI));
    cam(G, -412, 1.6, 439, -412, 1.0, 448);
  } else if (name === 'mc') {
    placeFig(G, 'ren', -412.5, 440, Math.PI);
    cam(G, -412.5, 1.1, 437.8, -412.5, 1.0, 440);
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
  // hide player figure overlap in staged car shots except meet/chars/mc/mapzoom
  if (G.player && !['meet', 'chars', 'mc', 'mapzoom'].includes(name)) {
    G.player.x = -412.5; G.player.z = 470;
  }
}
export { THREE };
