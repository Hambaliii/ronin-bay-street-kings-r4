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
  G.shotMode = name; // S35: hud.js' staged-radio path reads G.shotMode (never set before)
  if (name === 'city' || name === 'cover') {
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
    // S33: closer camera + late-morning tod so the garage front is lit.
    G.timeOfDay = 11.5;
    cam(G, -433, 1.7, 458, -415, 1.0, 447);
  } else if (name === 'chase') {
    // S28: dusk restage — heli searchlight (cone + ground pool) hard-tracks
    // the player car at wanted 4; the heliShot override drops the heli to
    // altitude 16 / radius 11 so heli + cone + pool + car share the frame.
    // S35: the player is SEATED in the staged taiyo BEFORE wanted is set.
    // The old staging never assigned G.car and never raised
    // G.flags.inCar, so hud.js' radio chip stayed dark (its show test is
    // (G.flags.inCar || (G.shotMode && G.car)) && G.radioName) and
    // police.js' chatter took the `!G.car` branch — "suspect on foot".
    // Seating is staging-local (mirrors drive.js enterCar's field writes,
    // without its audio/driverFig side effects): G.car = the taiyo,
    // flags.inCar = true, the on-foot figure hidden, driver = 'player'.
    G.timeOfDay = 17.6; // S35: brighter dusk (was 18.9)
    G.heliShot = { altitude: 16, radius: 11 };
    const v = spawnVehicle(G, 'taiyo', 100, 495, Math.PI / 2, { driver: 'parked' });
    // S34: move the player ENTITY onto the staged car so the live police /
    // heli systems target the car at (100,495), not the HQ spawn point.
    // ('chase' is in the hide-exclusion list at the bottom, so this sticks.)
    if (G.player) {
      G.player.x = 100; G.player.z = 495; G.player.angle = Math.PI / 2;
      G.player.fig.position.set(100, groundH(100, 495), 495);
      G.player.fig.rotation.y = Math.PI / 2;
      G.player.fig.visible = false; // seated: on-foot figure hidden, as in enterCar
    }
    v.driver = 'player';
    G.car = v;
    G.flags.inCar = true;
    // Shot-local pin: with G.car set, updateDriving now runs on the taiyo
    // each frame; re-pin its position to the staged point every frame so
    // drag/rollout cannot carry it out of the heli pool / frame (its speed
    // still decays naturally from 22, so wheels + smoke read as motion).
    G.updaters.push(() => {
      v.x = 100; v.z = 495; v.angle = Math.PI / 2;
      if (v.mesh) v.mesh.position.set(100, groundH(100, 495) + 0.02, 495);
    });
    G.wanted = 4; // set AFTER seating, so the first chatter line reads the car
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
    // S35 camera: pos (112,3.2,478), target (99,1.2,496). Subject taiyo at
    // (100,495): camera->car distance = sqrt(12^2 + 17^2) = 20.8 m (was
    // 34.2 m); staged cops at (86,489)/(82,502) are 26-30 m out in the
    // same westward view cone, heli orbits the car at radius 11 /
    // altitude 16 — car, cops, cone and pool all share the frame.
    cam(G, 112, 3.2, 478, 99, 1.2, 496);
  } else if (name === 'hero') {
    // S36: restaged — the touge version failed four captures four ways
    // (pickup wash, off-road, dark silhouette). Now the 'taiyo' hero car
    // SOLO on the coast road: front-3/4 beauty shot of the orange hero
    // GLB against the ocean at golden hour. Camera installed FIRST in
    // the block (S35 cam-first lesson), then tod, then the spawn.
    // F4: the hero shot is now the VICE-COAST proof — beach boulevard
    // (z=495 main) at SUNSET. At tod 18.0 the sky.js sun sits low over
    // the ocean toward (-x,+z), so the camera moves to the car's NE and
    // looks SW across it: boulevard, boardwalk palms, pastel deco
    // facades (cz=577.5 row) and the low sun over the water all share
    // the frame behind the hero car.
    cam(G, 114, 1.5, 479, 97, 0.9, 493);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip
    G.timeOfDay = 17.9; // Vice round: peak sunset band (was 18.0)
    const v = spawnVehicle(G, 'taiyo', 100, 491, 1.2, { driver: 'parked' });
    void v;
  } else if (name === 'svj') {
    // S31: front 3/4 of the HQ showcase SVJ (spawned in main.js at
    // (-430,452), angle 0.9) — glass canopy readable at tod 10.5.
    G.timeOfDay = 10.5;
    cam(G, -425.8, 1.05, 445.8, -430.2, 0.72, 452.3);
  } else if (name === 'svjrear') {
    // S31: rear 3/4 of the showcase SVJ — Y taillights readable. The GLB
    // swap is async, so arm the brake boost on the vehicle: swapToSvjCar
    // applies it to the real tailMat when the swap lands (if the GLB is
    // already in, boost the live tailMat directly).
    G.timeOfDay = 10.5;
    const sv = (G.vehicles || []).find((v) => v && v.specId === 'svj');
    if (sv) {
      sv._brakeStaged = true;
      if (sv.mesh && sv.mesh.userData.tailMat) sv.mesh.userData.tailMat.emissiveIntensity = 2.4;
    }
    cam(G, -435.2, 0.95, 447.8, -430.2, 0.72, 452.2);
  } else if (name === 'lineup') {
    // S34: the row sits on the real east-west road (centre z=495) at
    // z=487, angle PI/2 — facing +x/east, profile to the southern camera.
    // The old z=560 row is gone entirely.
    // S35 diagnosis: the row coordinates were correct, the CAMERA was
    // the defect. cam() is cam(G, px,py,pz, lx,ly,lz) = camera position,
    // then lookAt target (same pattern as every working mode). The old
    // call put the camera at (-584,4.5,522) — INSIDE the harbor field
    // (buildHarbor containers x -620..-480 / z 480..620, cranes at
    // (-560,540) and (-480,540)) — 43.6 m from the nearest row car
    // (-558,487) and looking at a target 264 m away (-320,490), so the
    // frame was dominated by port geometry and the row was a distant
    // receding line at the frame's edge. New camera looks ALONG the row
    // from its west end: pos (-545,2.2,468), target (-450,1,490).
    // Nearest car (-558,487): sqrt(13^2+19^2) = 23.0 m, just left of the
    // view axis; car 2 (-496,487) is 52.7 m out at ~6° off-axis and
    // car 3 (-434,487) 112.6 m at ~7° off-axis — the row reads as a
    // diagonal procession across the whole frame.
    const all = ['hachi','sora15','kei','sedan','wagon','van','suv','truck','taxi','police','police-suv','hatch','roadster','hoshi7','taiyo','kaze','hero-supra','gtr35','svj'];
    all.forEach((id, i) => spawnVehicle(G, id, -558 + i * 62, 487, Math.PI / 2, { driver: 'parked' }));
    cam(G, -545, 2.2, 468, -450, 1, 490);
  } else if (name === 'chars') {
    // S27: 'shun' added at the end of the row. Spacing tightened 8 -> 7
    // so the now-8-wide row stays centered on the camera target (-412):
    // span -436..-387, center -411.5.
    ['ren', 'ako', 'mika', 'jun', 'ryo', 'dante', 'cop', 'shun'].forEach((cid, i) => placeFig(G, cid, -436 + i * 7, 448, Math.PI));
    cam(G, -412, 1.5, 443.8, -412, 1.0, 448);
  } else if (name === 'versus') {
    // S35 restage: the whole staging moves OFF the HQ apron to the open
    // coast road at z=495 (the HQ wall filled the old frame behind the
    // GT-R). Ren + his hero taiyo on the left, Shun Arakawa (rivalDriver
    // GLB via the cast override) + his GT-R R35 on the right, drivers
    // standing between their cars; figures angle PI face north (-z),
    // toward the camera at z=478, which looks south along +z.
    // Camera (100,1.6,478) -> target (100,0.9,492): figures at z=494.5
    // are 16.5 m out, cars at z=491 are 13 m out, taiyo centre x=88 /
    // GT-R centre x=112 sit symmetric ±12 m around the view axis.
    G.timeOfDay = 17.8;
    spawnVehicle(G, 'taiyo', 88, 491, 1.2, { driver: 'parked' });
    if (G.player) {
      G.player.x = 97; G.player.z = 494.5; G.player.angle = Math.PI;
      G.player.fig.position.set(97, groundH(97, 494.5), 494.5);
      G.player.fig.rotation.y = Math.PI;
    }
    spawnVehicle(G, 'gtr35', 112, 491, 1.2, { driver: 'parked' });
    placeFig(G, 'shun', 104, 494.5, Math.PI);
    cam(G, 100, 1.6, 478, 100, 0.9, 492);
  } else if (name === 'mc') {
    // S35: Ren FACES the camera and the mission beacon is out of frame.
    // Old staging: figure at (-412.5,440) angle PI with the camera 2.2 m
    // NORTH of him — the GLB figure (MC_ROT_Y=0 in player.js) presented
    // its back. New staging shifts the figure 6.5 m east to (-406,440),
    // angle 0, and puts the camera 2.2 m SOUTH of him at (-406,442.2)
    // looking north: his front (+Z side) faces the camera. The first
    // mission's beacon pillar stands at ANCHORS.port (-412.5,470) —
    // from the new camera it is BEHIND the camera (z=470 > 442.2, view
    // direction is -z), so it cannot appear behind his head. HQ apron
    // setting kept (apron spans x -452..-372, z 440..470 south edge).
    if (G.player) {
      G.player.x = -406; G.player.z = 440; G.player.angle = 0;
      G.player.fig.position.set(-406, groundH(-406, 440), 440);
      G.player.fig.rotation.y = 0;
    }
    cam(G, -406, 1.1, 442.2, -406, 1.0, 440);
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
    // S35: camera installed FIRST, before any staging statement. In this
    // mode (and 'smoke'/'lineup' before this session) cam() was the LAST
    // statement of the block, so any throw in the staging above it left
    // G.shotCam unset and main.js fell back to its player-follow camera
    // (main.js loop: `if (G.shotCam) … else if (G.car) … else if
    // (G.player)`), framing wherever the player entity happened to sit
    // instead of the staged subjects — the subjects-as-specks frames.
    // Camera (197.2,1.6,-204.8) -> target (200.3,1.05,-199.3), and the
    // group is tightened toward the player (S35): player (200,-200)
    // 5.6 m out; downed (202,-197.5) 8.7 m; fleeing (203.5,-196)
    // 10.8 m; cop car centre (204.5,-195) 12.2 m with its near corner
    // ~10 m — every subject inside the near field, player centre-frame.
    cam(G, 197.2, 1.6, -204.8, 200.3, 1.05, -199.3);
    if (G.player) {
      G.player.x = 200; G.player.z = -200; G.player.angle = Math.atan2(-12, -8);
      G.player.fig.position.set(200, groundH(200, -200), -200);
      G.player.fig.rotation.y = G.player.angle;
      if (G.weapons && G.weapons.equip) G.weapons.equip('pistol');
    }
    G.flags.forceFlash = 'foot';
    const downed = placeFig(G, 'ren', 202, -197.5, 0.6);
    downed.rotation.x = -1.35; downed.position.y = groundH(202, -197.5) + 0.15;
    const fleeing = placeFig(G, 'mika', 203.5, -196, Math.atan2(6, 7));
    fleeing.rotation.x = 0.15;
    const copCar = spawnVehicle(G, 'police', 204.5, -195, -2.36, { driver: 'cop' });
    applyNpcPoliceGlb(copCar);
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
    // S25 verify: taiyo at HQ apron, plume pre-primed so it reads in the
    // first frame. S33: health 12 puts it in the darkest, fastest emission
    // band (<15) and primeDamageSmoke now spreads the pre-primed puffs'
    // pre-ages deterministically across 0..1.2 s, so a full readable
    // column exists at frame time.
    G.timeOfDay = 10.5;
    // S35: camera installed FIRST (same cam-last defect as 'shootout':
    // a throw in the spawn/prime below used to leave G.shotCam unset and
    // the frame fell back to the player-follow camera ~25 m south at the
    // player spawn, the staged car a speck with the beach/ocean side in
    // frame). The taiyo spawns at (-412.5,446) angle 0.6; its hood sits
    // ~1.4 m along its forward (sin0.6, cos0.6) from centre, i.e. at
    // (-411.7,447.2). Camera (-405.4,1.5,446.6) is 7.1 m from the car
    // centre (sqrt(7.1^2+0.6^2)), y 1.5, looking at the hood point at
    // height 0.9 — a front-3/4 close-up with the plume rising over it.
    cam(G, -405.4, 1.5, 446.6, -411.7, 0.9, 447.2);
    const v = spawnVehicle(G, 'taiyo', -412.5, 446, 0.6, { driver: 'parked' });
    v.health = 12;
    primeDamageSmoke(G, v, 12);
    // S34: the screenshot lands at the END of the virtual-time budget, so
    // the one-shot primed puffs (1.4 s life) are long dead by then. A
    // shot-local updater re-primes the plume every 0.9 s for as long as
    // the shot runs, so a live column always exists at frame time.
    let smokeAcc = 0;
    G.updaters.push((G2, dt) => {
      smokeAcc += dt || 0;
      if (smokeAcc >= 0.9) { smokeAcc = 0; primeDamageSmoke(G, v, 12); }
    });
  } else if (name === 'night') {
    // S25 verify: taiyo staged in-car on the avenue at night (tod 21.5,
    // D = 1) so headlight cones + glow rake across the asphalt.
    // F4: restaged onto the x=0 MAIN — F1's ~420 street lamps only line
    // the mains (x=0, x=330, z=0, z=495), so the old x=165 avenue frame
    // had no lamp rhythm to prove. Car on the x=0 carriageway, camera
    // behind it looking north down the main: lamp glow heads + ground
    // pools repeat ~45 m on both sides into the distance, downtown
    // facades (lit windows / neon) flanking. Player staged on the east
    // sidewalk as a night pedestrian (also keeps ambient traffic near).
    G.timeOfDay = 21.5;
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip (in-car)
    const v = spawnVehicle(G, 'taiyo', 5, -40, 0, { driver: 'parked' });
    const drv = makeFigure(CAST.ren); poseSeated(drv); drv.position.set(-0.4, 0.42, 0.15); v.mesh.add(drv);
    if (G.player) {
      G.player.x = 14; G.player.z = -26; G.player.angle = Math.PI;
      G.player.fig.position.set(14, groundH(14, -26), -26);
      G.player.fig.rotation.y = Math.PI;
    }
    cam(G, 13, 2.0, -18, 2, 0.7, -58);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
  } else if (name === 'markings') {
    // F4 proof (F1 road markings): low over the x=0 arterial looking
    // north to the (0,-165) intersection — yellow centre dashes, white
    // lane dividers at ±7.5 m and edge lines run through the foreground,
    // stop line + zebra crossing close the frame at the intersection.
    G.timeOfDay = 10.5;
    if (G.player) {
      G.player.x = 14; G.player.z = -92;
      G.player.fig.position.set(14, groundH(14, -92), -92);
    }
    cam(G, 5.5, 1.3, -126, -1, 0.3, -160);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
  } else if (name === 'sky') {
    // F4 proof (F2 sun + clouds): morning, tod 8.8 puts the sky.js sun
    // at ~39° elevation toward azimuth ~63° (sun dir cos/sin of
    // ((8.8-6)/12)*PI, z bias 0.38; lower + warmer than the 9.5 staging,
    // whose disc washed out against the noon-blue). Camera in the open
    // (0,0) intersection, tilted up ~36° along that azimuth: rooftops
    // sit low in frame, sun disc + cloud clusters (y 150-265,
    // camera-anchored) fill the blue above.
    G.timeOfDay = 8.8;
    if (G.player) {
      G.player.x = -34; G.player.z = -18;
      G.player.fig.position.set(-34, groundH(-34, -18), -18);
    }
    cam(G, -30, 1.8, -14, 17, 30, 10);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
  } else if (name === 'busy') {
    // F4 proof (F2 NPC life): downtown chat-group corner (182.2,147.8)
    // on the (165,165) intersection's NW sidewalk. The 3 chat peds face
    // each other there permanently (peds.js idx 6-8); staging adds the
    // player as a bystander, 3 relocated sidewalk walkers (two along
    // the z=147.8 sidewalk line, one up the x=182.2 line — same
    // line/off mirror as the 'city' cover staging) and a taxi held at
    // the corner on the x=165 carriageway for traffic. Ambient traffic
    // also routes through this intersection (player is local, so the
    // >500 m traffic respawn keeps vehicles near).
    G.timeOfDay = 11;
    if (G.player) {
      G.player.x = 176.5; G.player.z = 153.5; G.player.angle = Math.atan2(182.2 - 176.5, 147.8 - 153.5);
      G.player.fig.position.set(176.5, groundH(176.5, 153.5), 153.5);
      G.player.fig.rotation.y = G.player.angle;
    }
    try {
      const spots = [
        { x: 166, z: 147.8, vertical: false, dir: 1 },
        { x: 198, z: 147.8, vertical: false, dir: -1 },
        { x: 182.2, z: 158, vertical: true, dir: 1 },
      ];
      const pool = Array.isArray(G.peds) ? G.peds.filter((p) => p && p.fig && !p.downed && !p.chat && p.mode !== 'cross' && !p.follow) : [];
      const stagedPeds = [
        ...pool.filter((p) => p.figIsGlb),
        ...pool.filter((p) => !p.figIsGlb),
      ].slice(0, spots.length);
      stagedPeds.forEach((ped, i) => {
        const s = spots[i];
        ped.x = s.x; ped.z = s.z;
        ped.idle = false;
        ped.fleeT = 0; ped.fleeDir = null;
        ped.vertical = s.vertical;
        ped.off = (typeof ped.off === 'number' && ped.off !== 0) ? ped.off : 17.2;
        ped.line = (s.vertical ? s.x : s.z) - ped.off;
        ped.dir = s.dir;
        ped.angle = s.vertical ? (s.dir > 0 ? 0 : Math.PI) : (s.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        try {
          ped.fig.position.set(s.x, groundH(s.x, s.z), s.z);
          ped.fig.rotation.y = ped.angle;
        } catch (e) { /* updater repositions it next frame anyway */ }
      });
    } catch (e) { /* busy staging is dressing only — never break the shot */ }
    spawnVehicle(G, 'taxi', 205, 171, -Math.PI / 2, { driver: 'parked' });
    cam(G, 177.5, 1.6, 142.5, 183, 1.1, 149);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
  } else if (name === 'houses') {
    // F4 proof (F1 Hoshino Heights houses): the residential block at
    // (-412.5,-412.5) has a house row at z=-381.5 facing +z (fronts,
    // yards and driveways toward the z=-330 road). Camera stands on
    // that road looking south so the pitched-roof row fills the frame;
    // a wagon parked on the road anchors the foreground.
    G.timeOfDay = 10.5;
    if (G.player) {
      G.player.x = -424; G.player.z = -370; G.player.angle = Math.PI;
      G.player.fig.position.set(-424, groundH(-424, -370), -370);
      G.player.fig.rotation.y = Math.PI;
    }
    // Parked on the driveway of the neighbouring x=-393 house
    // (driveway aprons sit ~13 m in front of the front walls, +z side).
    spawnVehicle(G, 'wagon', -396, -367, 0, { driver: 'parked' });
    // Terrain here is NOT flat (heights/touge foothills): an absolute
    // y=1.8 camera sank under the ground plane on the first captures.
    // Anchor both camera and target heights to groundH. The row is
    // sparse (38 m spacing across open grass), so the camera stands
    // 15 m in front of the two-storey house at x=-431: its pitched
    // roof / yard / driveway fill the centre, neighbours at x=-469
    // and x=-393 (with the wagon) hold the frame edges.
    cam(G, -433, groundH(-433, -366) + 1.7, -366, -430, groundH(-430, -383) + 1.6, -383);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
  } else if (name === 'market') {
    // F4 proof (F1 RONIN MART): the store at (-82.5,-255) fronts +z
    // (sign band + glass at local z +11, parking pad in front, market
    // chat group gathered at (-69.5,-246)). Camera SE of the lot at
    // pad height for a front 3/4: sign, glass, canopy, parked cars on
    // the pad, cart corrals and the gathering group in one frame.
    // Player staged at the pad edge as a shopper.
    G.timeOfDay = 11;
    if (G.player) {
      G.player.x = -52; G.player.z = -232; G.player.angle = Math.atan2(-82.5 + 52, -255 + 232);
      G.player.fig.position.set(-52, groundH(-52, -232), -232);
      G.player.fig.rotation.y = G.player.angle;
    }
    cam(G, -42, 3.4, -212, -80, 3.2, -250);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4: pin shot camera against follow-cam pullback on slow captures
  } else if (name === 'vice') {
    // Vice round: CORAL STRIP WIDE — the dossier's Vice-City proof.
    // Camera high at the boulevard's east end looking WSW ALONG the
    // z=495 beach boulevard: pastel deco facades (cz=577.5 row) and
    // boardwalk palms fill the south side of the frame, the boulevard
    // with staged pastel traffic runs diagonally through it, and the
    // beach + ocean (z +610) close the background under the sunset
    // gradient (sky.js dome, tod forced 17.9). Player stands on the
    // boardwalk as a dusk pedestrian. Camera FIRST (S35 lesson), then
    // tod, then the spawns.
    cam(G, 205, 4.2, 458, 55, 1.2, 512);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4 camera pin
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip
    G.timeOfDay = 17.9;
    spawnVehicle(G, 'sedan', 150, 491, Math.PI / 2, { driver: 'parked' });
    spawnVehicle(G, 'roadster', 108, 491, Math.PI / 2, { driver: 'parked' });
    spawnVehicle(G, 'hatch', 62, 499, -Math.PI / 2, { driver: 'parked' });
    spawnVehicle(G, 'wagon', -18, 499, -Math.PI / 2, { driver: 'parked' });
    if (G.player) {
      G.player.x = 122; G.player.z = 528; G.player.angle = Math.PI;
      G.player.fig.position.set(122, groundH(122, 528), 528);
      G.player.fig.rotation.y = Math.PI;
    }
  } else if (name === 'vice-street') {
    // Vice round: STREET LEVEL on the Coral boulevard at tod 18.1 —
    // deep enough into dusk that the z=495 main's lamp rhythm (glow
    // heads + ground pools) and the facades' neon trim are fully on
    // (updateWorld's night factor is 1.0 by 18.1), while the sky.js
    // sunset dome still holds the pink-orange gradient overhead.
    // Low camera on the north sidewalk looking east along the
    // carriageway: staged pastel traffic in both lanes, lamps
    // repeating into the distance, deco facades behind the cars.
    cam(G, 38, 1.6, 481, 128, 1.1, 497);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4 camera pin
    G.radioName = 'WAVEFORM FM'; G._radioIdx = 0; // S26 amendment A: radio chip
    G.timeOfDay = 18.1;
    spawnVehicle(G, 'taiyo', 66, 492, 1.35, { driver: 'parked' });
    spawnVehicle(G, 'sedan', 102, 499, -Math.PI / 2, { driver: 'parked' });
    spawnVehicle(G, 'hatch', 142, 491, Math.PI / 2, { driver: 'parked' });
    if (G.player) {
      G.player.x = 52; G.player.z = 483; G.player.angle = Math.PI / 2;
      G.player.fig.position.set(52, groundH(52, 483), 483);
      G.player.fig.rotation.y = Math.PI / 2;
    }
  } else if (name === 'vice-markings') {
    // Vice round: road-markings close-up where the x=0 main crosses
    // the Coral boulevard (0,495) — the boulevard's own stop line +
    // zebra crossing, lane dashes running into the foreground, Coral
    // facades + palms behind the intersection. Same low over-the-
    // asphalt framing as F4 'markings', moved to the beachfront and
    // forced to tod 17.9 so the markings read under dusk light, not
    // the old mode's flat noon.
    cam(G, 7.5, 1.25, 460, -1.5, 0.3, 497);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4 camera pin
    G.timeOfDay = 17.9;
    if (G.player) {
      G.player.x = 16; G.player.z = 470;
      G.player.fig.position.set(16, groundH(16, 470), 470);
    }
  } else if (name === 'vice-houses') {
    // Vice round: Hoshino Heights at tod 17.8 — same house row as F4
    // 'houses' (z=-381.5 fronts facing +z), but the camera now stands
    // ON the paved z=-330 road instead of the grass verge at z=-366:
    // the foreground is asphalt + the parked wagon on the carriageway,
    // no dirt/grass apron under the frame. Heights anchored to
    // groundH (foothill terrain — the F4 lesson).
    cam(G, -436, groundH(-436, -336) + 1.7, -336, -429, groundH(-429, -383) + 1.6, -383);
    G.updaters.push(() => { if (G.shotCam) G.shotCam(); }); // F4 camera pin
    G.timeOfDay = 17.8;
    if (G.player) {
      G.player.x = -424; G.player.z = -352; G.player.angle = Math.PI;
      G.player.fig.position.set(-424, groundH(-424, -352), -352);
      G.player.fig.rotation.y = Math.PI;
    }
    spawnVehicle(G, 'wagon', -404, -342, Math.PI / 2, { driver: 'parked' });
  } else if (name === 'mapzoom') {
    if (G.player) { G.player.x = 300; G.player.z = -300; G.player.fig.position.set(300, groundH(300, -300), -300); }
    G.flags.mapZoom = true;
    cam(G, 285, 8, -322, 305, 0, -295);
  } else if (name === 'pausemap') {
    // S35: actually OPEN the big map the way the pause input does.
    // Diagnosis: G.flags.openPauseMap is consumed exactly once, inside
    // initHUD at boot (hud.js: `if (G.flags.openPauseMap && E.pauseMenu)
    // { …show + drawBigMap… }`) — and initHUD runs BEFORE this deferred
    // setupShot ever sets the flag, so nothing ever re-checked it and
    // the overlay never opened; the capture was just the 3D view from
    // the cam() below. The pause input path (main.js keydown) is:
    // G.paused = !G.paused, then G.togglePause(). togglePause (hud.js)
    // reads G.paused and, when true, sets #pauseMenu display='block',
    // drawBigMap()s the #bigmap canvas and fillLegend()s the legend.
    // initHUD has already run by the time setupShot is called (main.js
    // defers shots behind the assets-ready gate), so G.togglePause
    // exists here. Nothing closes it afterwards: no teardown touches
    // G.paused, the only other togglePause caller is the keydown
    // handler (no keys in a capture), and main.js' loop, while paused,
    // returns after renderer.render — the DOM overlay stays visible
    // over the rendered frame and the already-drawn bigmap canvas
    // persists (hud.js' per-frame redraw is an updater, which the
    // paused loop skips, but the canvas bitmap drawn here remains).
    G.flags.openPauseMap = true;
    G.paused = true;
    try { G.togglePause?.(); } catch (e) { /* overlay stays closed only if HUD failed */ }
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
    // S30: two RBPD officers (policeOfficer GLB via the 'cop' cast
    // override, procedural navy uniform figure as fallback) flanking
    // the player car, angled to face it at (165,-140).
    placeFig(G, 'cop', 162.8, -137.5, 2.42);
    placeFig(G, 'cop', 167.2, -142.5, -0.72);
    G.wanted = 4;
    try { G.hud?.showBusted?.(); } catch (e) {}
    cam(G, 176, 2.2, -128, 164, 1.0, -141);
  }
  // hide player figure overlap in staged car shots except meet/chars/mc/mapzoom/city
  if (G.player && !['meet', 'chars', 'mc', 'mapzoom', 'city', 'cover', 'shootout', 'smg', 'bat', 'wasted', 'busted', 'versus', 'chase', 'markings', 'sky', 'busy', 'houses', 'market', 'night', 'vice', 'vice-street', 'vice-markings', 'vice-houses'].includes(name)) {
    G.player.x = -412.5; G.player.z = 470;
  }
}
export { THREE };
