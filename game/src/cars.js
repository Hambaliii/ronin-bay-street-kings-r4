// cars.js — extruded side-profile car factory (HARD GATE 1), traffic, smoke
import * as THREE from 'three';
import { CARS } from './config.js';
import { rnd, rr, ri, pick } from './random.js';
import { groundH, glowSprite } from './world.js';

function hexCss(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
// Build side-profile Shape. x: -len/2 (tail) .. +len/2 (nose/front at +x before rotation). y: height.
function bodyProfile(spec) {
  const L = spec.len, hl = L / 2;
  const tall = spec.body === 'suv' || spec.body === 'van' ? 1.55 : spec.body === 'truck' ? 1.5 : spec.body === 'kei' ? 1.4 : 1.05 + (spec.body === 'sedan' || spec.body === 'wagon' ? 0.18 : 0);
  const hoodY = 0.62 + spec.hood * 0.28;
  const beltY = tall * 0.72;
  const s = new THREE.Shape();
  s.moveTo(-hl + 0.12, 0.18);
  s.quadraticCurveTo(-hl - 0.02, 0.3, -hl, beltY * 0.8); // tail face curve
  if (spec.roof === 'wagon' || spec.body === 'van' || spec.body === 'suv') {
    s.quadraticCurveTo(-hl, tall * 0.97, -hl + 0.3, tall);
    s.lineTo(hl * (0.2 + spec.cabin * 0.2), tall);
    s.quadraticCurveTo(hl * 0.75, tall * 0.96, hl * 0.88, hoodY + 0.1);
  } else if (spec.roof === 'hatch') {
    s.quadraticCurveTo(-hl + 0.05, tall * 0.92, -hl + 0.35, tall * 0.98);
    s.quadraticCurveTo(-hl + L * 0.28, tall, -hl + L * (0.32 + spec.cabin * 0.18), tall * 0.99);
    s.quadraticCurveTo(hl * 0.72, tall * 0.9, hl * 0.86, hoodY + 0.08);
  } else if (spec.roof === 'fastback') {
    s.bezierCurveTo(-hl + 0.1, beltY, -hl + L * 0.3, tall * 0.99, -hl + L * (0.34 + spec.cabin * 0.16), tall);
    s.quadraticCurveTo(hl * 0.55, tall * 0.97, hl * 0.84, hoodY + 0.06);
  } else { // coupe / flat sedan
    s.quadraticCurveTo(-hl + L * 0.18, tall * 0.99, -hl + L * (0.3 + spec.cabin * 0.16), tall);
    s.quadraticCurveTo(hl * 0.45, tall * 0.98, hl * 0.8, hoodY + 0.1);
    if (spec.body === 'sedan' || spec.body === 'roadster') s.quadraticCurveTo(hl * 0.9, hoodY + 0.04, hl * 0.94, hoodY);
  }
  s.quadraticCurveTo(hl + 0.04, hoodY * 0.72, hl, 0.42); // rounded nose
  s.quadraticCurveTo(hl - 0.02, 0.2, hl - 0.3, 0.18);
  s.lineTo(-hl + 0.12, 0.18);
  s.userData = { tall, hoodY, beltY };
  return s;
}
function glassProfile(spec) {
  const L = spec.len, hl = L / 2;
  const tall = spec.body === 'suv' || spec.body === 'van' ? 1.55 : spec.body === 'truck' ? 1.5 : spec.body === 'kei' ? 1.4 : 1.05 + (spec.body === 'sedan' || spec.body === 'wagon' ? 0.18 : 0);
  const beltY = tall * 0.72;
  const back = spec.roof === 'wagon' || spec.body === 'van' || spec.body === 'suv' ? -hl + 0.35 : spec.roof === 'hatch' ? -hl + 0.55 : -hl + L * (0.30 + spec.cabin * 0.14);
  const front = spec.roof === 'flat' && spec.body !== 'kei' ? hl * 0.52 : hl * (0.35 + spec.cabin * 0.15);
  const s = new THREE.Shape();
  s.moveTo(back, beltY);
  s.quadraticCurveTo(back + 0.25, tall * 0.99, back + L * 0.18, tall * 0.985);
  s.quadraticCurveTo(front - 0.2, tall * 0.97, front, beltY + 0.04);
  s.lineTo(back, beltY);
  return s;
}
function extrudeProfile(shape, width, bevelT, bevelS) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.2, width - bevelS * 2), bevelEnabled: true, bevelThickness: bevelT, bevelSize: bevelS, bevelSegments: 3, steps: 1, curveSegments: 12 });
  geo.translate(0, 0, -width / 2 + bevelS);
  // shape x = length, extrusion z = width -> rotate so length aligns +Z (forward), width along X
  geo.rotateY(Math.PI / 2);
  return geo;
}
function liveryTexture(kind, colorHex) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  if (kind === 'police') {
    g.fillStyle = '#f4f6f8'; g.fillRect(90, 18, 330, 78);
    g.fillStyle = '#1c4f9c'; g.fillRect(0, 78, 512, 16);
    g.fillStyle = '#14161a'; g.font = 'bold 52px sans-serif'; g.textAlign = 'center'; g.fillText('RBPD', 256, 72);
    g.fillStyle = '#c8a028'; g.beginPath(); g.arc(120, 56, 20, 0, 6.3); g.fill();
  } else if (kind === 'taxi') {
    for (let x = 0; x < 512; x += 24) for (let y = 0; y < 2; y++) { g.fillStyle = (x / 24 + y) % 2 ? '#14161a' : '#f4f6f8'; g.fillRect(x, 52 + y * 14, 24, 14); }
  } else if (kind === 'hero-supra') {
    g.fillStyle = '#14161a'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.fillText('TEN-SECOND', 256, 66);
  } else if (kind === 'hero-gtr') {
    g.fillStyle = '#c8ccd2'; g.fillRect(0, 56, 512, 14);
    g.fillStyle = '#14161a'; g.font = 'bold 24px sans-serif'; g.textAlign = 'center'; g.fillText('BAYSIDE GHOST', 256, 46);
  }
  void colorHex;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeCarMesh(spec, colorHex, opts) {
  opts = opts || {};
  const color = colorHex != null ? colorHex : spec.color;
  const grp = new THREE.Group();
  const L = spec.len, W = spec.wid;
  const isTruck = spec.body === 'truck';
  const cabSpec = isTruck ? { ...spec, len: 2.2 } : spec;
  const bodyGeo = extrudeProfile(bodyProfile(cabSpec), W, 0.09, 0.07);
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.35 });
  const body = new THREE.Mesh(bodyGeo, bodyMat); grp.add(body);
  if (spec.twoTone) {
    const lower = new THREE.Mesh(new THREE.BoxGeometry(W * 0.99, 0.34, L * 0.98), new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.4, roughness: 0.5 }));
    lower.position.y = 0.3; grp.add(lower);
  }
  if (isTruck) {
    const cargoMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 });
    const cargoGeo = new THREE.BoxGeometry(W, 2.1, 3.9);
    // bevel illusion: slightly smaller top box
    const cargo = new THREE.Mesh(cargoGeo, cargoMat); cargo.position.set(0, 1.45, -1.15); grp.add(cargo);
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.7, 1.6), new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 }));
    lines.position.set(0, 1.45, -3.11); lines.rotation.y = Math.PI; grp.add(lines);
    body.position.z = L / 2 - 1.1;
  }
  // greenhouse
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x10151c, metalness: 0.9, roughness: 0.12 });
  const glass = new THREE.Mesh(extrudeProfile(glassProfile(cabSpec), W * 0.86, 0.05, 0.04), glassMat);
  if (isTruck) glass.position.z = L / 2 - 1.1;
  grp.add(glass);
  // bumpers + skirts
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const bump = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.2, 0.28), darkMat);
    bump.position.set(0, 0.3, s * (L / 2 - 0.02)); grp.add(bump);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, L * 0.55), darkMat);
    skirt.position.set(s * (W / 2 - 0.01), 0.24, 0); grp.add(skirt);
  }
  // mirrors
  for (const s of [-1, 1]) {
    const stalk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), darkMat); stalk.position.set(s * (W / 2 + 0.04), 1.0, L * 0.18); grp.add(stalk);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), bodyMat); mir.position.set(s * (W / 2 + 0.11), 1.02, L * 0.18); grp.add(mir);
  }
  // wheel radius by class
  const wr = spec.body === 'suv' || spec.body === 'truck' || spec.body === 'van' ? 0.42 : spec.body === 'kei' ? 0.28 : spec.body === 'sedan' || spec.body === 'wagon' ? 0.34 : 0.33;
  const wb = L * 0.62;
  const tireGeo = new THREE.CylinderGeometry(wr, wr, 0.24, 20); tireGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wr * 0.62, wr * 0.62, 0.26, 12); rimGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const rimMat = new THREE.MeshStandardMaterial({ color: spec.wheels || 0xc0c0c0, metalness: 0.85, roughness: 0.3 });
  const spokeMat = rimMat;
  const wheels = {};
  const archGeo = new THREE.TorusGeometry(wr + 0.06, 0.045, 6, 14, Math.PI);
  const archMat = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.8 });
  function makeWheel(key, sx, sz) {
    const pivot = new THREE.Group(); pivot.position.set(sx * (W / 2 - 0.02), wr, sz * (wb / 2)); grp.add(pivot);
    const tire = new THREE.Mesh(tireGeo, tireMat); pivot.add(tire);
    const rim = new THREE.Mesh(rimGeo, rimMat); pivot.add(rim);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.27, wr * 0.16, wr * 0.9), spokeMat); sp.rotation.x = (i / 5) * Math.PI; pivot.add(sp); }
    const arch = new THREE.Mesh(archGeo, archMat); arch.position.set(sx * (W / 2 + 0.03), wr, sz * (wb / 2)); arch.rotation.y = Math.PI / 2; grp.add(arch);
    wheels[key] = pivot; return pivot;
  }
  makeWheel('fl', -1, 1); makeWheel('fr', 1, 1); makeWheel('rl', -1, -1); makeWheel('rr', 1, -1);
  // headlights
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.7, roughness: 0.2 });
  if (spec.popups) {
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), headMat); p.position.set(s * W * 0.28, 0.86, L / 2 - 0.32); p.rotation.x = -0.25; grp.add(p); }
  } else {
    for (const s of [-1, 1]) { const hgeo = new THREE.SphereGeometry(0.13, 10, 8); const h = new THREE.Mesh(hgeo, headMat); h.scale.set(1.5, 0.55, 0.5); h.position.set(s * W * 0.3, 0.72, L / 2 - 0.05); grp.add(h); }
  }
  // taillights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.8 });
  if (spec.roundTail) {
    const n = spec.tail === 'quadWing' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const tg = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12); tg.rotateX(Math.PI / 2);
      const t = new THREE.Mesh(tg, tailMat); t.position.set((i - (n - 1) / 2) * 0.24, 0.78, -L / 2 - 0.02); grp.add(t);
    }
  } else {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, 0.09, 0.05), tailMat); bar.position.set(0, 0.78, -L / 2 - 0.02); grp.add(bar);
  }
  grp.userData.tailMat = tailMat; grp.userData.headMat = headMat;
  // wings
  if (spec.tail === 'roundWing' || spec.tail === 'quadWing' || spec.tail === 'wing') {
    const bladeGeo = spec.tail === 'roundWing' ? new THREE.TorusGeometry(W * 0.42, 0.045, 6, 16, Math.PI) : new THREE.BoxGeometry(W * 0.88, 0.05, 0.3);
    const blade = new THREE.Mesh(bladeGeo, darkMat);
    if (spec.tail === 'roundWing') { blade.rotation.z = 0; blade.rotation.y = Math.PI / 2; blade.rotation.x = Math.PI; blade.scale.set(1, 1, 0.4); blade.position.set(0, 1.12, -L / 2 + 0.1); }
    else { blade.position.set(0, 1.18, -L / 2 + 0.08); blade.rotation.x = -0.12; }
    grp.add(blade);
    for (const s of [-1, 1]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), darkMat); strut.position.set(s * W * 0.3, 1.0, -L / 2 + 0.1); grp.add(strut); }
  } else if (spec.tail === 'ducktail' || spec.tail === 'lip') {
    const lip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.8, 0.06, spec.tail === 'ducktail' ? 0.28 : 0.14), bodyMat);
    lip.position.set(0, 0.98, -L / 2 + 0.08); lip.rotation.x = spec.tail === 'ducktail' ? -0.35 : -0.15; grp.add(lip);
  }
  // livery decals
  const livery = opts.livery || spec.livery;
  if (livery) {
    const tex = liveryTexture(livery === 'hero-supra' || livery === 'hero-gtr' ? livery : livery, color);
    for (const s of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.72, 0.55), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      plane.position.set(s * (W / 2 + 0.085), 0.62, 0); plane.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; grp.add(plane);
    }
    if (spec.id === 'hero-supra' || livery === 'hero-supra') {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 0.03, L * 0.3), darkMat); hood.position.set(0, 0.93, L * 0.28); grp.add(hood);
    }
  }
  if (spec.lightbar) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.3), darkMat); base.position.set(0, 1.32, 0.1); grp.add(base);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.4 })); red.position.set(-0.28, 1.4, 0.1); grp.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 1.4 })); blue.position.set(0.28, 1.4, 0.1); grp.add(blue);
    const gr = glowSprite(0xff3344, 3); gr.position.set(-0.28, 1.45, 0.1); grp.add(gr);
    const gb = glowSprite(0x3366ff, 3); gb.position.set(0.28, 1.45, 0.1); grp.add(gb);
    grp.userData.lightbar = { red, blue, gr, gb };
  }
  if (livery === 'taxi') {
    const signB = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 }));
    signB.position.set(0, 1.36, 0.1); grp.add(signB);
  }
  // underglow
  const glowColor = opts.glow !== undefined ? opts.glow : spec.glow;
  if (glowColor) {
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gg = gc.getContext('2d'); const gr2 = gg.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr2.addColorStop(0, 'rgba(255,255,255,.9)'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = gr2; gg.fillRect(0, 0, 128, 128);
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.6, L + 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: glowColor, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    gm.rotation.x = -Math.PI / 2; gm.position.y = 0.06; grp.add(gm);
  }
  // blob shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.5, L + 0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; grp.add(shadow);
  grp.userData.wheels = wheels; grp.userData.wheelR = wr;
  return grp;
}
export function spawnVehicle(G, specId, x, z, angle, opts) {
  opts = opts || {};
  const spec = { ...CARS[specId], id: specId };
  const mesh = makeCarMesh(spec, opts.color, opts);
  mesh.position.set(x, groundH(x, z) + 0.02, z); mesh.rotation.y = angle || 0;
  G.scene.add(mesh);
  const v = { spec, specId, mesh, angle: angle || 0, speed: 0, health: 100, driver: opts.driver || 'parked', color: opts.color != null ? opts.color : spec.color, wheels: mesh.userData.wheels, steerVis: 0, x, z, target: null, lane: opts.lane || 0, smokeT: 0 };
  if (!G.vehicles) G.vehicles = [];
  G.vehicles.push(v);
  return v;
}
// --- traffic ---
const TRAFFIC_COLORS = [0xb9c0c7, 0x3f8cff, 0xd95555, 0x44484e, 0xf2f2f2, 0x5a7d4f, 0xffd23f, 0x707880, 0x8a4fd0, 0x2a9d8f];
const TRAFFIC_IDS = ['sedan', 'hatch', 'suv', 'wagon', 'kei', 'hachi', 'van', 'sora15', 'roadster', 'taxi'];
export function spawnTraffic(G, n) {
  if (!G.traffic) G.traffic = [];
  for (let i = 0; i < n; i++) {
    const onX = rnd() < 0.5;
    const line = pick(onX ? G.roadX : G.roadZ);
    const along = rr(-600, 600);
    const dirSign = rnd() < 0.5 ? 1 : -1;
    const laneOff = 5 * dirSign;
    const x = onX ? line + laneOff : along;
    const z = onX ? along : line - laneOff;
    const angle = onX ? (dirSign > 0 ? 0 : Math.PI) : (dirSign > 0 ? Math.PI / 2 : -Math.PI / 2);
    const v = spawnVehicle(G, pick(TRAFFIC_IDS), x, z, angle, { color: pick(TRAFFIC_COLORS), driver: 'traffic' });
    v.onX = onX; v.line = line; v.dirSign = dirSign; v.cruise = rr(22, 38) / 3.6; v.speed = v.cruise;
    G.traffic.push(v);
  }
}
export function updateTraffic(G, dt) {
  if (!G.traffic) return;
  const px = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const pz = G.car ? G.car.z : (G.player ? G.player.z : 0);
  const night = G.timeOfDay > 18.5 || G.timeOfDay < 5.5;
  for (const v of G.traffic) {
    if (v.driver !== 'traffic') continue;
    const distP = Math.hypot(v.x - px, v.z - pz);
    if (distP > 500) { // respawn near player on a road
      const onX = rnd() < 0.5; const line = pick(onX ? G.roadX : G.roadZ);
      v.onX = onX; v.line = line; v.dirSign = rnd() < 0.5 ? 1 : -1;
      const along = Math.max(-640, Math.min(640, (onX ? pz : px) + rr(-260, 260)));
      v.x = onX ? line + 5 * v.dirSign : along; v.z = onX ? along : line - 5 * v.dirSign;
      v.speed = v.cruise;
    }
    // stop for vehicle ahead (same lane-ish)
    let blocked = false;
    for (const o of G.traffic) { if (o === v) continue; const dx = o.x - v.x, dz = o.z - v.z; const fwdX = Math.sin(v.angle), fwdZ = Math.cos(v.angle); const ahead = dx * fwdX + dz * fwdZ; const side = Math.abs(dx * fwdZ - dz * fwdX); if (ahead > 0 && ahead < 9 && side < 2.2) { blocked = true; break; } }
    if (G.car && G.car !== v) { const dx = G.car.x - v.x, dz = G.car.z - v.z; const ahead = dx * Math.sin(v.angle) + dz * Math.cos(v.angle); const side = Math.abs(dx * Math.cos(v.angle) - dz * Math.sin(v.angle)); if (ahead > 0 && ahead < 9 && side < 2.4) blocked = true; }
    const targetSpeed = blocked ? 0 : v.cruise;
    v.speed += Math.max(-8 * dt, Math.min(3 * dt, targetSpeed - v.speed));
    // advance along current axis; at intersection maybe turn
    v.x += Math.sin(v.angle) * v.speed * dt; v.z += Math.cos(v.angle) * v.speed * dt;
    const crossArr = v.onX ? G.roadZ : G.roadX;
    const alongPos = v.onX ? v.z : v.x;
    for (const c of crossArr) {
      if (Math.abs(alongPos - c) < 1.2 && Math.abs(v.speed) > 1 && rnd() < 0.35) {
        // turn onto cross road
        if (v.onX) { v.z = c; v.line = c; } else { v.x = c; v.line = c; }
        v.onX = !v.onX;
        v.dirSign = rnd() < 0.5 ? 1 : -1;
        if (v.onX) { v.x = v.line + 5 * v.dirSign; v.angle = v.dirSign > 0 ? 0 : Math.PI; }
        else { v.z = v.line - 5 * v.dirSign; v.angle = v.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2; }
        break;
      }
    }
    // keep lane offset & bounds bounce
    if (v.onX) v.x += ((v.line + 5 * v.dirSign) - v.x) * Math.min(1, dt * 2); else v.z += ((v.line - 5 * v.dirSign) - v.z) * Math.min(1, dt * 2);
    if (Math.abs(v.x) > 655 || Math.abs(v.z) > 655) { v.angle += Math.PI; v.dirSign *= -1; v.x = Math.max(-650, Math.min(650, v.x)); v.z = Math.max(-650, Math.min(650, v.z)); }
    v.mesh.position.set(v.x, groundH(v.x, v.z) + 0.02, v.z);
    v.mesh.rotation.y = v.angle;
    const spin = (v.speed * dt) / (v.mesh.userData.wheelR || 0.33);
    for (const kkey of ['fl', 'fr', 'rl', 'rr']) { const w = v.wheels[kkey]; if (w) w.rotation.x += spin / dt * dt; }
    for (const kkey of ['fl', 'fr', 'rl', 'rr']) { const w = v.wheels[kkey]; if (w) w.rotation.x = (w.rotation.x || 0) + 0; }
    // wheel spin (accumulate properly)
    for (const kkey of ['fl', 'fr', 'rl', 'rr']) { const w = v.wheels[kkey]; if (w) { w.userData.spin = (w.userData.spin || 0) + (v.speed * dt) / 0.33; w.rotation.set(w.userData.spin, 0, 0); } }
    if (night && !v.nightGlow) { const gl = glowSprite(0xffe9a0, 2.2); gl.position.set(0, 0.7, v.spec.len / 2 + 0.4); v.mesh.add(gl); v.nightGlow = gl; }
    if (!night && v.nightGlow) { v.mesh.remove(v.nightGlow); v.nightGlow = null; }
    if (v.health < 60) { v.smokeT -= dt; if (v.smokeT <= 0) { v.smokeT = 0.15; spawnSmokeAt(G, v.mesh.position, 1, v.health < 25); } }
  }
}
export function damageVehicle(G, v, amt) {
  v.health = Math.max(0, v.health - amt);
  spawnSmokeAt(G, v.mesh.position, 3, v.health < 25);
}
// --- smoke pool ---
let smokePool = null;
function ensureSmoke(G) {
  if (smokePool) return;
  smokePool = [];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  for (let i = 0; i < 60; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; G.scene.add(s);
    smokePool.push({ s, life: 0, max: 1, fire: false, vx: 0, vy: 0, vz: 0 });
  }
}
export function spawnSmokeAt(G, pos, n, fire) {
  ensureSmoke(G);
  let spawned = 0;
  for (const p of smokePool) {
    if (spawned >= n) break;
    if (p.life > 0) continue;
    p.life = p.max = rr(0.6, 1.3); p.fire = !!fire;
    p.s.position.set(pos.x + rr(-0.4, 0.4), pos.y + rr(0.5, 1), pos.z + rr(-0.4, 0.4));
    p.s.material.color.set(fire ? 0xff7a2a : 0x8a8f96);
    p.s.scale.set(0.7, 0.7, 1); p.s.visible = true;
    p.vx = rr(-0.3, 0.3); p.vy = rr(1, 2); p.vz = rr(-0.3, 0.3);
    spawned++;
  }
}
export function updateSmoke(G, dt) {
  if (!smokePool) return;
  for (const p of smokePool) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.s.visible = false; p.s.material.opacity = 0; continue; }
    const t = 1 - p.life / p.max;
    p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
    const sc = 0.7 + t * (p.fire ? 1.2 : 2.2); p.s.scale.set(sc, sc, 1);
    p.s.material.opacity = (p.fire ? 0.75 : 0.5) * (1 - t) * (p.fire ? (0.7 + rnd() * 0.5) : 1);
    if (p.fire) p.s.material.color.setHSL(0.06 + rnd() * 0.03, 1, 0.5);
  }
}
export { hexCss };
