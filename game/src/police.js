import * as THREE from 'three';
import { loadHeroAsset } from './assets.js';
import { CAST } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { spawnVehicle, spawnSmokeAt } from './cars.js';
import { makeFigure, animateFigure } from './player.js';

// ---------------------------------------------------------------- police.js
// RBPD pursuit system: wanted model, cop AI, roadblocks + spike strips,
// busted / wasted resets, and the rounded RBPD helicopter.

const HQ = { x: -412.5, z: 412.5 };

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function playerPos(G) {
  if (G.car) return { x: G.car.x, z: G.car.z };
  return { x: G.player.x, z: G.player.z };
}
function playerAngle(G) {
  if (G.car) return G.car.angle;
  return G.player.angle;
}

// --- RBPD decal texture -----------------------------------------------------
function rbpdTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 64);
  g.fillStyle = '#ffffff';
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('RBPD', 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

// --- GLB heli dressing (RBPD livery + spinning rotor overlays) ---------------
// Built once in GLB local units and added INSIDE the scaled hero wrapper, so
// it inherits the registry scale. The Tripo model has its rotors baked in
// static, so the overlays below are what the updater actually spins.
function heliSideDecalTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 256);
  // Dark navy cheatline band across the middle.
  g.fillStyle = '#16222e';
  g.fillRect(0, 64, 1024, 128);
  // Gold badge circle at the left.
  g.fillStyle = '#c9a227';
  g.beginPath(); g.arc(112, 128, 54, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#16222e';
  g.beginPath(); g.arc(112, 128, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9a227';
  g.font = 'bold 44px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('★', 112, 130);
  // Lettering.
  g.fillStyle = '#ffffff';
  g.font = 'bold 140px Arial, sans-serif';
  g.fillText('RBPD', 580, 118);
  g.font = 'bold 44px Arial, sans-serif';
  g.fillText('P O L I C E', 580, 172);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function heliRoofTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 512);
  g.fillStyle = '#16222e';
  g.font = 'bold 190px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('RBPD', 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

function makeHeliDressing() {
  const group = new THREE.Group();
  group.name = 'rbpd-dressing';

  // Side decals on the cabin flanks (cabin max half-width ~0.185 at z .1-.3).
  try {
    const tex = heliSideDecalTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    for (const side of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.095), mat);
      d.position.set(side * 0.192, 0.175, 0.16);
      d.rotation.y = side * Math.PI / 2;
      d.renderOrder = 2;
      group.add(d);
    }
  } catch (e) { /* headless: decals optional */ }

  // Roof marking, readable from behind/above.
  try {
    const tex = heliRoofTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 0.85, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.30), mat);
    roof.position.set(0, 0.318, 0.10);
    roof.rotation.x = -Math.PI / 2;
    roof.renderOrder = 2;
    group.add(roof);
  } catch (e) { /* headless: decals optional */ }

  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6, metalness: 0.3 });

  // Main rotor overlay at the mast top (local ~(0, 0.345, +0.10)).
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.35, 0.10);
  const bladeX = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.008, 0.055), bladeMat);
  rotor.add(bladeX);
  const bladeZ = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.95), bladeMat);
  bladeZ.rotation.y = 0.6;
  rotor.add(bladeZ);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.045, 10), bladeMat);
  rotor.add(hub);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(0.47, 40),
    new THREE.MeshBasicMaterial({ color: 0xcfd8e3, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  group.add(rotor);

  // Tail rotor overlay on the fin (local z -0.475), spins on X.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.035, 0.29, -0.475);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.02), bladeMat);
    b.rotation.x = i * Math.PI / 2;
    tailRotor.add(b);
  }
  group.add(tailRotor);

  return { group, rotor, tailRotor };
}

// Swap a heli's visual child from the procedural build to the GLB wrapper.
// Everything procedural hangs off heli.body (cone/spotlight live on the
// outer group / in the scene), so clearing body swaps only the visual.
// Flight state, orbit and spotlight are untouched. Never throws.
function applyGlbVisual(heli, wrapper, dressing) {
  try {
    if (!heli || !wrapper || heli.visualMode === 'glb') return false;
    if (dressing && dressing.group && dressing.group.parent !== wrapper) wrapper.add(dressing.group);
    while (heli.body.children.length) heli.body.remove(heli.body.children[0]);
    wrapper.position.set(0, -1.18, 0); // align skid base with the procedural skid bottom
    heli.body.add(wrapper);
    if (dressing) {
      if (dressing.rotor) heli.rotor = dressing.rotor;
      if (dressing.tailRotor) heli.tailRotor = dressing.tailRotor;
    }
    heli.visualMode = 'glb';
    return true;
  } catch (e) { return false; }
}

// --- Helicopter (rounded build — no plain-box body) --------------------------
function makeHeli(G) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paint = new THREE.MeshStandardMaterial({ color: 0x1d2735, metalness: 0.5, roughness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f5f8, metalness: 0.3, roughness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0d1218, metalness: 0.9, roughness: 0.1 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x22282f, metalness: 0.7, roughness: 0.35 });

  // Fuselage: rounded cabin pod (scaled sphere).
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 22), paint);
  cabin.scale.set(1.0, 0.92, 1.9);
  body.add(cabin);

  // White stripe band around the cabin.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.02, 0.34, 28, 1, true), white);
  band.rotation.x = Math.PI / 2;
  band.scale.set(1.0, 1.0, 0.92);
  band.position.z = -0.15;
  body.add(band);

  // Cockpit glass: partial sphere segment, front-upper pod.
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.94, 24, 16, -Math.PI / 3.2, Math.PI / 1.6, 0.35, 1.05),
    glassMat
  );
  glass.scale.set(1.0, 0.92, 1.9);
  glass.position.set(0, 0.12, 0.14);
  body.add(glass);

  // Belly fairing (flattened sphere) so the underside reads rounded too.
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 14), paint);
  belly.scale.set(0.9, 0.45, 1.5);
  belly.position.y = -0.55;
  body.add(belly);

  // Tail boom: tapered cylinder angled slightly up, from pod to fin.
  const boomLen = 3.4;
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.16, boomLen, 14), paint);
  boom.rotation.x = Math.PI / 2 - 0.10;
  boom.position.set(0, 0.22, -1.75 - boomLen / 2 + 0.35);
  body.add(boom);

  // Tail fin: flattened rounded shape (scaled sphere) at the boom end.
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), paint);
  fin.scale.set(0.16, 1.15, 0.62);
  fin.position.set(0, 0.62, -1.75 - boomLen + 0.35);
  body.add(fin);

  // Horizontal stabilizer near the fin (flattened capsule-ish scaled sphere).
  const stab = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), paint);
  stab.scale.set(1.5, 0.10, 0.42);
  stab.position.set(0, 0.30, -1.75 - boomLen + 0.55);
  body.add(stab);

  // Engine hump on top of the pod (rounded).
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), darkMetal);
  hump.scale.set(0.85, 0.5, 1.15);
  hump.position.set(0, 0.82, -0.25);
  body.add(hump);

  // Mast + main rotor.
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5, 10), darkMetal);
  mast.position.set(0, 1.05, -0.25);
  body.add(mast);

  const rotor = new THREE.Group();
  rotor.position.set(0, 1.32, -0.25);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), darkMetal);
  rotor.add(hub);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14181d, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.28), bladeMat);
    blade.rotation.y = i * Math.PI / 2;
    // Slightly tapered tips: scale a second thin tip segment.
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.035, 0.20), bladeMat);
    tip.position.set(2.75, 0, 0);
    const tipWrap = new THREE.Group();
    tipWrap.rotation.y = i * Math.PI / 2;
    tipWrap.add(tip);
    const tip2 = tip.clone(); tip2.position.x = -2.75;
    tipWrap.add(tip2);
    rotor.add(blade); rotor.add(tipWrap);
  }
  body.add(rotor);

  // Tail rotor: small 2-blade cross on the fin, spins on the X (side) axis.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.14, 0.62, -1.75 - boomLen + 0.35);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.95, 0.12), bladeMat);
    b.rotation.x = i * Math.PI / 2;
    tailRotor.add(b);
  }
  const trHub = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), darkMetal);
  tailRotor.add(trHub);
  body.add(tailRotor);

  // Skids: bent tubes (3-segment cylinders per run) + struts.
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x30363e, metalness: 0.7, roughness: 0.35 });
  for (const side of [-1, 1]) {
    const sx = side * 0.78;
    const pts = [
      new THREE.Vector3(sx, -1.05, 1.35),
      new THREE.Vector3(sx, -1.18, 0.4),
      new THREE.Vector3(sx, -1.18, -0.9),
      new THREE.Vector3(sx, -1.02, -1.55),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.055, 8), skidMat);
    body.add(tube);
    for (const sz of [0.75, -0.75]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), skidMat);
      strut.position.set(sx * 0.82, -0.82, sz);
      strut.rotation.z = side * 0.35;
      body.add(strut);
    }
  }

  // RBPD decals both sides.
  try {
    const tex = rbpdTexture();
    const decalMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    for (const side of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.38), decalMat);
      d.position.set(side * 1.01, 0.05, 0.25);
      d.rotation.y = side * Math.PI / 2;
      body.add(d);
    }
  } catch (e) { /* headless: decals optional */ }

  // Spotlight cone (visible beam) + lens glow. Apex at the heli, opening down.
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff3b0, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(7.5, 30, 20, 1, true), coneMat);
  cone.position.set(0, -15.5, 0.6); // apex up at the heli, base toward the ground
  group.add(cone);
  let lensGlow = null;
  try {
    lensGlow = glowSprite(0xfff2a8, 3.2);
    lensGlow.position.set(0, -0.8, 0.6);
    group.add(lensGlow);
  } catch (e) { /* optional */ }

  // Real spotlight aimed at the player. Kept in scene space (not parented to
  // the heli group) so position/target can be set in world coordinates.
  const spotlight = new THREE.SpotLight(0xfff2c0, 2.4, 90, 0.42, 0.45, 1.2);
  G.scene.add(spotlight);
  G.scene.add(spotlight.target);

  group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  G.scene.add(group);
  return { group, body, rotor, tailRotor, cone, spotlight, lensGlow, orbitA: rr(0, Math.PI * 2), leaveT: 0, visualMode: 'procedural' };
}

// --- lightbar flashing -------------------------------------------------------
function flashLightbar(v, t) {
  const lb = v.mesh?.userData?.lightbar;
  if (!lb) return;
  const phase = Math.floor(t * 6) % 2 === 0;
  const hi = 3.2, lo = 0.15;
  try {
    if (lb.red) lb.red.emissiveIntensity = phase ? hi : lo;
    if (lb.blue) lb.blue.emissiveIntensity = phase ? lo : hi;
    if (lb.gr) lb.gr.visible = phase;
    if (lb.gb) lb.gb.visible = !phase;
  } catch (e) { /* material shape differs — ignore */ }
}

export function initPolice(G) {
  G.cops = G.cops || [];
  G.heli = null;

  // Hero GLB heli: kick the load off once and build the RBPD dressing once.
  // When the asset lands it swaps the visual of a flying heli in place, or
  // is picked up by ensureHeli on first spawn. Any failure (404, parse,
  // unsupported) resolves null and the procedural heli runs exactly as before.
  let heliDressing = null;
  try { heliDressing = makeHeliDressing(); } catch (e) { heliDressing = null; }
  try { if (G.flags) G.flags.heliDressing = heliDressing; } catch (e) { /* flags optional */ }
  try {
    loadHeroAsset('helicopter').then((wrapper) => {
      try {
        if (!wrapper) return;
        if (G.flags) G.flags.heliAsset = wrapper;
        if (G.heli) applyGlbVisual(G.heli, wrapper, heliDressing);
      } catch (e) { /* keep the procedural visual */ }
    }).catch(() => {});
  } catch (e) { /* keep the procedural visual */ }

  const S = {
    t: 0,
    speedHeatCd: 0,
    driftHeatCd: 0,
    decayAcc: 0,
    spawnCd: 0,
    blockCd: 8,
    blocks: [],
    spikeT: 0,
    bustT: 0,
    bustResetT: -1,
    wastedResetT: -1,
    prevPX: 0, prevPZ: 0,
    pvx: 0, pvz: 0,
    smokeCd: 0,
    lastCrashSeen: 0,
  };

  function desiredUnits() {
    if (G.wanted <= 0.05) return 0;
    const table = [0, 1, 2, 3, 4, 6];
    return table[Math.min(5, Math.ceil(G.wanted))];
  }

  function spawnCop() {
    const p = playerPos(G);
    const a = rr(0, Math.PI * 2);
    const d = rr(120, 180);
    let x = p.x + Math.sin(a) * d;
    let z = p.z + Math.cos(a) * d;
    // Snap to the nearest road line so spawns sit on streets.
    const snap = (v, lines) => lines.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best), lines[0]);
    if (chanceSnap()) x = snap(x, G.roadX); else z = snap(z, G.roadZ);
    x = THREE.MathUtils.clamp(x, -640, 640);
    z = THREE.MathUtils.clamp(z, -640, 640);
    const specId = G.wanted >= 3 && G.cops.length % 2 === 1 ? 'police-suv' : 'police';
    const v = spawnVehicle(G, specId, x, z, rr(0, Math.PI * 2), { driver: 'cop', livery: 'police', lights: true });
    if (v) G.cops.push(v);
    return v;
  }
  function chanceSnap() { return chance(0.5); }

  function removeCop(v) {
    const i = G.cops.indexOf(v);
    if (i >= 0) G.cops.splice(i, 1);
    const j = G.vehicles ? G.vehicles.indexOf(v) : -1;
    if (j >= 0) G.vehicles.splice(j, 1);
    const k = G.traffic ? G.traffic.indexOf(v) : -1;
    if (k >= 0) G.traffic.splice(k, 1);
    if (v.mesh) G.scene.remove(v.mesh);
  }

  // --- roadblocks ------------------------------------------------------------
  function spawnRoadblock() {
    const p = playerPos(G);
    const pa = playerAngle(G);
    const ahead = 105;
    let bx = p.x + Math.sin(pa) * ahead;
    let bz = p.z + Math.cos(pa) * ahead;
    // Put it on the player's current road line: snap the cross axis.
    const onVertical = Math.abs(Math.sin(pa)) < Math.abs(Math.cos(pa)); // heading mostly along z => vertical road (constant x)
    const snap = (v, lines) => lines.reduce((best, l) => (Math.abs(l - v) < Math.abs(best - v) ? l : best), lines[0]);
    if (onVertical) bx = snap(bx, G.roadX); else bz = snap(bz, G.roadZ);
    bx = THREE.MathUtils.clamp(bx, -620, 620);
    bz = THREE.MathUtils.clamp(bz, -620, 620);
    const roadAngle = onVertical ? 0 : Math.PI / 2; // direction of travel along the road
    const perp = roadAngle + Math.PI / 2;

    const grp = new THREE.Group();
    const cars = [];
    for (const off of [-8, 8]) {
      const cx = bx + Math.sin(perp) * off;
      const cz = bz + Math.cos(perp) * off;
      const v = spawnVehicle(G, 'police', cx, cz, perp + rr(-0.25, 0.25), { driver: 'parked', livery: 'police', lights: true });
      if (v) { cars.push(v); G.cops.push(v); }
    }
    // Spike strip between the cars.
    const strip = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(13, 0.06, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x181a1e, roughness: 0.9, metalness: 0.2 })
    );
    strip.add(base);
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c9, metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 12; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), spikeMat);
      cone.position.set(-5.5 + i, 0.13, 0);
      strip.add(cone);
    }
    strip.position.set(bx, groundH(bx, bz) + 0.05, bz);
    strip.rotation.y = perp;
    G.scene.add(strip);
    grp.add(strip);
    // Officers standing by.
    const officers = [];
    if (CAST.cop) {
      for (const off of [-11, 11]) {
        try {
          const fig = makeFigure(CAST.cop);
          const ox = bx + Math.sin(perp) * off;
          const oz = bz + Math.cos(perp) * off + 2;
          fig.position.set(ox, groundH(ox, oz), oz);
          fig.rotation.y = perp + Math.PI;
          G.scene.add(fig);
          officers.push({ fig, phase: rr(0, 6) });
        } catch (e) { /* figure optional */ }
      }
    }
    S.blocks.push({ x: bx, z: bz, angle: perp, cars, officers, strip, spiked: false });
  }

  function removeRoadblock(b) {
    const i = S.blocks.indexOf(b);
    if (i >= 0) S.blocks.splice(i, 1);
    for (const v of [...b.cars]) removeCop(v);
    for (const o of b.officers) G.scene.remove(o.fig);
    if (b.strip) G.scene.remove(b.strip);
  }

  // --- resets ------------------------------------------------------------------
  function teleportHome(withCar) {
    const hx = HQ.x, hz = HQ.z + 12;
    if (G.player?.fig) {
      G.player.x = hx; G.player.z = hz;
      G.player.fig.position.set(hx, groundH(hx, hz), hz);
    }
    if (withCar && G.car) {
      G.car.x = hx + 4; G.car.z = hz + 4; G.car.speed = 0; G.car.angle = 0;
      G.car.mesh.position.set(G.car.x, groundH(G.car.x, G.car.z), G.car.z);
      G.car.mesh.rotation.y = G.car.angle;
    }
  }

  function doBustedReset() {
    const fine = Math.floor((G.money || 0) * 0.10);
    G.money = Math.max(0, (G.money || 0) - fine);
    G.wanted = 0;
    teleportHome(true);
    for (const v of [...G.cops]) removeCop(v);
    for (const b of [...S.blocks]) removeRoadblock(b);
    G.flags.busted = false;
    S.bustT = 0;
    G.toast?.(`Busted — fined $${fine.toLocaleString('en-US')}`);
    G.saveGame?.();
  }

  function doWastedReset() {
    G.money = Math.max(0, (G.money || 0) - 150);
    if (G.car) G.car.health = 100;
    G.wanted = 0;
    teleportHome(true);
    for (const v of [...G.cops]) removeCop(v);
    for (const b of [...S.blocks]) removeRoadblock(b);
    G.flags.wasted = false;
    G.toast?.('Wasted — hospital bill $150, car repaired');
    G.saveGame?.();
  }

  // --- helicopter lifecycle ------------------------------------------------------
  function ensureHeli(atStage) {
    if (G.heli) return;
    const h = makeHeli(G);
    if (G.flags && G.flags.heliAsset) applyGlbVisual(h, G.flags.heliAsset, heliDressing);
    if ((atStage || G.flags.heliStage) && G.flags.heliStage) {
      h.group.position.set(G.flags.heliStage.x, groundH(G.flags.heliStage.x, G.flags.heliStage.z) + 28, G.flags.heliStage.z);
    } else {
      const p = playerPos(G);
      h.group.position.set(p.x + 20, groundH(p.x, p.z) + 28, p.z);
    }
    G.heli = h;
  }
  function removeHeli() {
    if (!G.heli) return;
    G.scene.remove(G.heli.group);
    if (G.heli.spotlight) { G.scene.remove(G.heli.spotlight); G.scene.remove(G.heli.spotlight.target); }
    G.heli = null;
  }
  if (G.shot === 'chase' || G.shot === 'heli') ensureHeli(G.shot === 'heli');

  // --- main updater ---------------------------------------------------------------
  G.updaters.push((G2, dt) => {
    if (G2 !== G) { /* same object */ }
    S.t += dt;
    const p = playerPos(G);
    // Player velocity estimate (for intercept lead).
    if (dt > 0) {
      S.pvx = (p.x - S.prevPX) / dt; S.pvz = (p.z - S.prevPZ) / dt;
      const pvLen = Math.hypot(S.pvx, S.pvz);
      if (pvLen > 60) { S.pvx *= 60 / pvLen; S.pvz *= 60 / pvLen; }
    }
    S.prevPX = p.x; S.prevPZ = p.z;
    const inCar = !!G.car && !!G.flags.inCar;
    const pSpeedKmh = G.speedKmh || 0;

    // ---- wanted sources ----
    S.speedHeatCd = Math.max(0, S.speedHeatCd - dt);
    S.driftHeatCd = Math.max(0, S.driftHeatCd - dt);
    let anyCopNear60 = false;
    for (const v of G.cops) if (dist2d(v.x, v.z, p.x, p.z) < 60) { anyCopNear60 = true; break; }

    if (inCar && pSpeedKmh > 110 && S.speedHeatCd <= 0) {
      for (const v of G.cops) {
        if (dist2d(v.x, v.z, p.x, p.z) < 40) { G.wanted += 0.5; S.speedHeatCd = 2.5; break; }
      }
    }
    if (G.flags.crashTimer && G.flags.crashTimer !== S.lastCrashSeen) {
      S.lastCrashSeen = G.flags.crashTimer;
      G.flags.crashTimer = 0; // consumed
      G.wanted += 0.4;
    }
    if (inCar && G.flags.drifting && S.driftHeatCd <= 0) {
      for (const v of G.cops) {
        if (dist2d(v.x, v.z, p.x, p.z) < 45) { G.wanted += 0.2; S.driftHeatCd = 3; break; }
      }
    }
    // Decay.
    if (!anyCopNear60 && !G.flags.noDecay) {
      S.decayAcc += dt;
      while (S.decayAcc >= 10) { S.decayAcc -= 10; G.wanted -= 0.1; }
    } else {
      S.decayAcc = 0;
    }
    G.wanted = THREE.MathUtils.clamp(G.wanted || 0, 0, 5);

    // Spike effect timer.
    if (S.spikeT > 0) {
      S.spikeT -= dt;
      G.flags.gripFactor = 0.5;
      if (G.car && G.car.speed > 40 / 3.6) G.car.speed = 40 / 3.6;
      if (G.car && chance(0.3)) {
        try { spawnSmokeAt(G, new THREE.Vector3(G.car.x, groundH(G.car.x, G.car.z) + 0.4, G.car.z), 1, false); } catch (e) {}
      }
      if (S.spikeT <= 0) G.flags.gripFactor = 1;
    }

    // ---- pursuit population ----
    S.spawnCd = Math.max(0, S.spawnCd - dt);
    const want = desiredUnits();
    // Despawn far units first.
    for (const v of [...G.cops]) {
      if (v.staged === true) continue; // staged shot units are never despawned
      if (S.blocks.some((b) => b.cars.includes(v))) continue;
      if (dist2d(v.x, v.z, p.x, p.z) > 400) removeCop(v);
    }
    const activeCops = G.cops.filter((v) => v.staged !== true && !S.blocks.some((b) => b.cars.includes(v)));
    if (activeCops.length < want && S.spawnCd <= 0) {
      spawnCop();
      S.spawnCd = 1.2;
    }
    if (G.wanted <= 0.05 && activeCops.length) {
      for (const v of activeCops) if (dist2d(v.x, v.z, p.x, p.z) > 120) removeCop(v);
    }

    // ---- cop AI ----
    const playerTop = (G.car?.spec?.topSpeed || 180) / 3.6;
    for (const v of G.cops) {
      flashLightbar(v, S.t);
      if (v.staged === true) continue; // staged shot units: lightbar flashes, AI/movement frozen
      if (S.blocks.some((b) => b.cars.includes(v))) continue; // roadblock cars stay parked
      const d = dist2d(v.x, v.z, p.x, p.z);
      const wrecked = (v.health ?? 100) < 30;
      // Target: intercept lead, or rear-quarter when close enough to ram.
      let tx = p.x + S.pvx * Math.min(1.2, d / 30);
      let tz = p.z + S.pvz * Math.min(1.2, d / 30);
      if (d < 12 && inCar) {
        const pa = playerAngle(G);
        tx = p.x - Math.sin(pa) * 2.5 + Math.cos(pa) * 1.2;
        tz = p.z - Math.cos(pa) * 2.5 - Math.sin(pa) * 1.2;
      }
      // Coarse collider avoidance: probe ahead-left/right, steer away.
      let avoid = 0;
      if (G.colliders) {
        const fx = v.x + Math.sin(v.angle) * 9, fz = v.z + Math.cos(v.angle) * 9;
        for (const c of G.colliders) {
          if (c.x === undefined) continue;
          const r = c.r || 7;
          if (dist2d(fx, fz, c.x, c.z) < r + 2) {
            const side = Math.sign(Math.sin(v.angle) * (c.z - v.z) - Math.cos(v.angle) * (c.x - v.x)) || 1;
            avoid = -side * 0.8;
            break;
          }
        }
      }
      const desired = Math.atan2(tx - v.x, tz - v.z) + avoid;
      const diff = angDiff(desired, v.angle);
      const maxTurn = 2.1 * dt;
      v.angle += THREE.MathUtils.clamp(diff, -maxTurn, maxTurn);
      // Speed: scale with wanted; wrecked units fall back.
      let top = (v.spec?.topSpeed || 190) / 3.6;
      if (G.wanted <= 2) top = Math.min(top, playerTop * 0.93);
      else if (G.wanted >= 4) top = Math.max(top, playerTop);
      let target = top;
      if (Math.abs(diff) > 1.1) target = top * 0.45;
      else if (Math.abs(diff) > 0.5) target = top * 0.75;
      if (wrecked) target = top * 0.4;
      if (!inCar && d < 6) target = 0; // officer stops by the suspect on foot
      const accel = target > v.speed ? 9 : 16;
      v.speed = THREE.MathUtils.clamp(v.speed + Math.sign(target - v.speed) * accel * dt, 0, top);
      v.x += Math.sin(v.angle) * v.speed * dt;
      v.z += Math.cos(v.angle) * v.speed * dt;
      v.x = THREE.MathUtils.clamp(v.x, -655, 655);
      v.z = THREE.MathUtils.clamp(v.z, -655, 655);
      v.mesh.position.set(v.x, groundH(v.x, v.z), v.z);
      v.mesh.rotation.y = v.angle;
      if (v.steerVis !== undefined) v.steerVis = THREE.MathUtils.clamp(diff, -0.5, 0.5);
      const ud = v.mesh.userData;
      if (ud?.wheels) {
        const spin = (v.speed * dt) / (ud.wheelR || 0.34);
        for (const w of Object.values(ud.wheels)) if (w) w.rotation.x += spin;
      }
      // Wrecked units smoke and fall back.
      if (wrecked) {
        S.smokeCd -= dt;
        if (S.smokeCd <= 0) {
          S.smokeCd = 0.12;
          try { spawnSmokeAt(G, new THREE.Vector3(v.x, groundH(v.x, v.z) + 0.9, v.z), 1, false); } catch (e) {}
        }
        if ((v.health ?? 100) <= 0) removeCop(v);
      }
    }

    // ---- roadblocks ----
    S.blockCd = Math.max(0, S.blockCd - dt);
    if (G.wanted >= 3 && S.blockCd <= 0 && S.blocks.length < (G.wanted >= 5 ? 2 : 1) && inCar) {
      spawnRoadblock();
      S.blockCd = 25;
    }
    for (const b of [...S.blocks]) {
      for (const v of b.cars) flashLightbar(v, S.t);
      for (const o of b.officers) { try { animateFigure(o.fig, o.phase + S.t * 0.6, 0.15); } catch (e) {} }
      const d = dist2d(b.x, b.z, p.x, p.z);
      // Spike strip crossing.
      if (!b.spiked && inCar && G.car) {
        const local = Math.abs(Math.sin(b.angle) * (p.z - b.z) - Math.cos(b.angle) * (p.x - b.x)); // along-strip offset magnitude approx
        const perpD = Math.abs(Math.cos(b.angle) * (p.z - b.z) + Math.sin(b.angle) * (p.x - b.x));
        if (d < 8 && perpD < 2.2 && local < 7 && pSpeedKmh > 8) {
          b.spiked = true;
          S.spikeT = 6;
          G.toast?.('Spike strip! Tires shredded');
          try { spawnSmokeAt(G, new THREE.Vector3(p.x, groundH(p.x, p.z) + 0.3, p.z), 6, false); } catch (e) {}
        }
      }
      if (d > 250) removeRoadblock(b);
    }

    // ---- helicopter ----
    const shotHeli = G.shot === 'chase' || G.shot === 'heli';
    if (G.wanted >= 4 || shotHeli) ensureHeli(false);
    if (G.heli) {
      const h = G.heli;
      if (!shotHeli && G.wanted < 3) {
        h.leaveT += dt;
        if (h.leaveT > 10) removeHeli();
      } else h.leaveT = 0;
      if (G.heli) {
        h.orbitA += dt * 0.35;
        const stage = G.flags.heliStage ? G.flags.heliStage : p;
        const radius = G.shot === 'heli' ? 6 : 20;
        const hx = stage.x + Math.sin(h.orbitA) * radius;
        const hz = stage.z + Math.cos(h.orbitA) * radius;
        const hy = groundH(hx, hz) + 29 + Math.sin(S.t * 0.9) * 1.6;
        h.group.position.set(hx, hy, hz);
        h.group.lookAt(p.x, groundH(p.x, p.z) + 1, p.z);
        h.body.rotation.z = 0.38; // banking roll into the orbit
        h.body.rotation.x = 0.06;
        h.rotor.rotation.y += dt * 28;
        h.tailRotor.rotation.x += dt * 40;
        // Spotlight tracks the player.
        h.spotlight.position.copy(h.group.position);
        h.spotlight.target.position.set(p.x, groundH(p.x, p.z), p.z);
        h.spotlight.target.updateMatrixWorld();
        // Beam cone: stretch from heli toward the ground under the player.
        const beamLen = Math.max(10, hy - groundH(p.x, p.z));
        h.cone.scale.set(1, beamLen / 30, 1);
        h.cone.position.set(0, -beamLen / 2, 0.6);
      }
    }

    // ---- busted ----
    let busting = false;
    if (!G.flags.busted && !G.flags.wasted) {
      if (inCar && pSpeedKmh < 3) {
        for (const v of G.cops) if (dist2d(v.x, v.z, p.x, p.z) < 4) { busting = true; break; }
      } else if (!inCar && G.wanted > 0) {
        for (const v of G.cops) if (dist2d(v.x, v.z, p.x, p.z) < 2.5) { busting = true; break; }
      }
    }
    if (busting) {
      S.bustT += dt;
      const need = inCar ? 2.5 : 2.0;
      if (S.bustT >= need && S.bustResetT < 0) {
        G.flags.busted = true;
        S.bustResetT = 2.2;
        G.audio?.play?.('busted');
      }
    } else {
      S.bustT = Math.max(0, S.bustT - dt * 1.5);
    }
    if (S.bustResetT >= 0) {
      S.bustResetT -= dt;
      if (S.bustResetT < 0) doBustedReset();
    }

    // ---- wasted ----
    if (G.car && (G.car.health ?? 100) <= 0 && !G.flags.wasted && S.wastedResetT < 0) {
      G.flags.wasted = true;
      S.wastedResetT = 2.2;
      G.audio?.play?.('wasted');
    }
    if (S.wastedResetT >= 0) {
      S.wastedResetT -= dt;
      if (S.wastedResetT < 0) doWastedReset();
    }
  });
}
