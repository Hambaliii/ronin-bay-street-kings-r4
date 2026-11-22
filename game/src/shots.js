// shots.js — screenshot staging
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';
import { makeFigure, poseSeated, applyCastFigureOverride } from './player.js';
import { spawnVehicle, applyNpcPoliceGlb, primeDamageSmoke } from './cars.js';

function placeFig(G, castId, x, z, angle) {
  const fig = makeFigure(CAST[castId]);
  // Thread the cast key explicitly so GLB cast overrides (player.js
  // CAST_GLB_OVERRIDE, e.g. 'shun' -> rivalDriver GLB) apply on this
  // staging path too; makeFigure's CAST-identity hook already fired,
  // this call is idempotent and stamps fig.userData.castKey.
  applyCastFigureOverride(fig, castId);
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
    // S22 cover staging (city only): relocate 3 citizens onto the sidewalk
    // in the camera's view so the dossier cover shows peds mid-stride, not
    // an empty street. Prefer GLB-visual peds (figIsGlb) when knowable.
    // The ped system's own placement helper (placePed in peds.js) is a
    // closure inside initPeds and is not exported, so mirror it here: set
    // BOTH the ped's logical position (x/z) and its fig position, and give
    // it a live walk segment — horizontal along its staged z, with
    // line+off === z so the normal updater keeps it on that sidewalk line
    // and keeps walking (idle cleared, phase/speed untouched, not frozen).
    try {
      const spots = [[140, -138], [146, -133], [136, -143]];
      const allPeds = Array.isArray(G.peds) ? G.peds.filter((p) => p && p.fig && !p.downed) : [];
      const stagedPeds = [
        ...allPeds.filter((p) => p.figIsGlb),
        ...allPeds.filter((p) => !p.figIsGlb),
      ].slice(0, spots.length);
      stagedPeds.forEach((ped, i) => {
        const sx = spots[i][0];
        const sz = spots[i][1];
        ped.x = sx; ped.z = sz;
        ped.idle = false;
        ped.fleeT = 0; ped.fleeDir = null;
        ped.vertical = false;
        ped.off = (typeof ped.off === 'number' && ped.off !== 0) ? ped.off : 17.2;
        ped.line = sz - ped.off;
        ped.dir = 1;
        ped.angle = Math.PI / 2;
        try {
          ped.fig.position.set(sx, groundH(sx, sz), sz);
          ped.fig.rotation.y = ped.angle;
        } catch (e) { /* updater repositions it next frame anyway */ }
      });
    } catch (e) { /* cover staging is dressing only — never break the shot */ }
  } else if (name === 'meet') {
    const ids = ['hachi', 'sora15', 'hoshi7', 'kaze'];
    const xs = [-434, -422, -410, -398];
    ids.forEach((id, i) => spawnVehicle(G, id, xs[i], 446, 0, { driver: 'parked' }));
    ['ren', 'ako', 'mika', 'jun'].forEach((cid, i) => placeFig(G, cid, xs[i] + 1.5, 451, 0));
    cam(G, -436, 2.4, 464, -410, 1.0, 446);
  } else if (name === 'chase') {
    // S28: dusk restage — heli searchlight (cone + ground pool) hard-tracks
    // the player car at wanted 4; the heliShot override drops the heli to
    // altitude 16 / radius 11 so heli + cone + pool + car share the frame.
    G.timeOfDay = 18.9;
    G.wanted = 4;
    G.heliShot = { altitude: 16, radius: 11 };
    const v = spawnVehicle(G, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
    v.speed = 22;
    v.health = 45; // S26 amendment B: damage smoke trails from the hood (S25)
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip
    const drv = makeFigure(CAST.ren); poseSeated(drv); drv.position.set(-0.4, 0.42, 0.15); v.mesh.add(drv);
    G.flags.flashCar = v; G.flags.forceFlash = 'car';
    const p1 = spawnVehicle(G, 'police', 86, 489, Math.PI / 2, { driver: 'cop' });
    applyNpcPoliceGlb(p1);
    const p2 = spawnVehicle(G, 'police', 82, 502, Math.PI / 2, { driver: 'cop' });
    applyNpcPoliceGlb(p2);
    p1.staged = true; p2.staged = true;
    G.cops.push(p1, p2);
    G.flags.heliStage = { x: 100, z: 495 };
    cam(G, 121, 5.5, 468, 99, 1.5, 495);
  } else if (name === 'hero') {
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip
    const v = spawnVehicle(G, 'kaze', -300, -610, 2.2, { driver: 'parked' });
    cam(G, -291, groundH(-291, -600) + 2.0, -600, -300, groundH(-300, -610) + 0.8, -610);
    void v;
  } else if (name === 'lineup') {
    const all = ['hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra','gtr35'];
    all.forEach((id, i) => spawnVehicle(G, id, -561 + i * 66, 560, Math.PI, { driver: 'parked' }));
    cam(G, -40, 10, 592, -40, 0.5, 556);
  } else if (name === 'chars') {
    // S27: 'shun' added at the end of the row. Spacing tightened 8 -> 7
    // so the now-8-wide row stays centered on the camera target (-412):
    // span -436..-387, center -411.5.
    ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop', 'shun'].forEach((cid, i) => placeFig(G, cid, -436 + i * 7, 448, Math.PI));
    cam(G, -412, 1.5, 443.8, -412, 1.0, 448);
  } else if (name === 'versus') {
    // S27 versus shot (HQ apron, tod 10.5): Ren + his hero taiyo on the
    // left, Shun Arakawa (rivalDriver GLB via the cast override) + his
    // GT-R R35 on the right, drivers standing beside their cars.
    G.timeOfDay = 10.5;
    spawnVehicle(G, 'taiyo', -424, 446, 0.5, { driver: 'parked' });
    if (G.player) {
      G.player.x = -421.5; G.player.z = 447.5; G.player.angle = 2.6;
      G.player.fig.position.set(-421.5, groundH(-421.5, 447.5), 447.5);
      G.player.fig.rotation.y = 2.6;
    }
    spawnVehicle(G, 'gtr35', -401, 446, -0.5, { driver: 'parked' });
    placeFig(G, 'shun', -398.5, 447.5, 0.6);
    cam(G, -412, 2.0, 462, -412, 1.0, 445);
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
    const copCar = spawnVehicle(G, 'police', 207.5, -192.5, -2.36, { driver: 'cop' });
    applyNpcPoliceGlb(copCar);
    cam(G, 197.2, 1.6, -204.8, 200.3, 1.05, -199.3);
  } else if (name === 'heli') {
    spawnVehicle(G, 'taiyo', -200, 300, 0.4, { driver: 'parked' });
    spawnVehicle(G, 'police-suv', -192, 292, -2.4, { driver: 'cop' });
    G.flags.heliStage = { x: -200, z: 300 };
    cam(G, -186, 2.0, 314, -198, 1.2, 298);
  } else if (name === 'street') {
    // S16 verify: taiyo stopped at the (150,-150) intersection approach —
    // low corner view of the marked avenue, crosswalk and NE traffic light.
    // (150,-150) is the staging label; the actual grid point is (165,-165).
    G.timeOfDay = 10.5;
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip
    spawnVehicle(G, 'taiyo', 150, -128, Math.PI, { driver: 'parked' });
    cam(G, 161, 1.7, -133, 149, 1.5, -156);
  } else if (name === 'smoke') {
    // S25 verify: taiyo at HQ apron with health forced to 30 — steady gray
    // damage band (15..40), plume pre-primed so it reads in the first frame.
    G.timeOfDay = 10.5;
    const v = spawnVehicle(G, 'taiyo', -412.5, 446, 0.6, { driver: 'parked' });
    v.health = 30;
    primeDamageSmoke(G, v, 12);
    cam(G, -406, 1.8, 437, -412.5, 1.0, 446);
  } else if (name === 'night') {
    // S25 verify: taiyo staged in-car on the avenue at night (tod 21.5,
    // D = 1) so headlight cones + glow rake across the asphalt.
    G.timeOfDay = 21.5;
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip (in-car)
    const v = spawnVehicle(G, 'taiyo', 165, -120, 0, { driver: 'parked' });
    const drv = makeFigure(CAST.ren); poseSeated(drv); drv.position.set(-0.4, 0.42, 0.15); v.mesh.add(drv);
    cam(G, 172, 2.0, -104, 164, 0.8, -122);
  } else if (name === 'mapzoom') {
    if (G.player) { G.player.x = 300; G.player.z = -300; G.player.fig.position.set(300, groundH(300, -300), -300); }
    G.flags.mapZoom = true;
    cam(G, 285, 8, -322, 305, 0, -295);
  } else if (name === 'pausemap') {
    G.flags.openPauseMap = true;
    cam(G, 0, 30, -60, 0, 0, 0);
  } else if (name === 'wasted') {
    // S26: player on foot downtown at dusk, WASTED overlay shown directly.
    // STAGING GUARD (hud.js): in a shot mode the overlay displays but the
    // respawn timer never runs and the world never freezes/respawns.
    G.timeOfDay = 18.5;
    if (G.player) {
      G.player.x = 165; G.player.z = -140; G.player.angle = 0.6;
      G.player.fig.position.set(165, groundH(165, -140), -140);
      G.player.fig.rotation.y = 0.6;
    }
    try { G.hud?.showWasted?.('Downtown'); } catch (e) {}
    cam(G, 171, 1.7, -133, 164, 1.0, -141);
  } else if (name === 'busted') {
    // S26: player in a taiyo downtown, 2 staged cops, 4 stars, BUSTED
    // overlay shown directly (same staging guard as 'wasted').
    const v = spawnVehicle(G, 'taiyo', 165, -140, 0.4, { driver: 'parked' });
    const drv = makeFigure(CAST.ren); poseSeated(drv); drv.position.set(-0.4, 0.42, 0.15); v.mesh.add(drv);
    const p1 = spawnVehicle(G, 'police', 158, -148, 0.9, { driver: 'cop' });
    applyNpcPoliceGlb(p1);
    const p2 = spawnVehicle(G, 'police', 173, -133, -2.2, { driver: 'cop' });
    applyNpcPoliceGlb(p2);
    p1.staged = true; p2.staged = true;
    G.cops.push(p1, p2);
    G.wanted = 4;
    try { G.hud?.showBusted?.(); } catch (e) {}
    cam(G, 176, 2.2, -128, 164, 1.0, -141);
  }
  // hide player figure overlap in staged car shots except meet/chars/mc/mapzoom/city
  if (G.player && !['meet', 'chars', 'mc', 'mapzoom', 'city', 'shootout', 'smg', 'bat', 'wasted', 'busted', 'versus'].includes(name)) {
    G.player.x = -412.5; G.player.z = 470;
  }
}
export { THREE };
