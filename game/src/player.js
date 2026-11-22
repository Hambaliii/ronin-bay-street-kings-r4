// player.js — high-quality textured figure factory + on-foot player
// HARD GATE 2: ~7.5-head proportions, capsule/lathe parts, procedural clothing canvas textures.
import * as THREE from 'three';
import { CAST } from './config.js';
import { groundH } from './world.js';

// Deterministic texture noise (no Math.random — simple LCG local to texture gen)
function texRng(seed) { let s = seed * 7919 + 13; return () => { s = (s * 16807) % 2147483647; return (s & 0xffff) / 0xffff; }; }
function hexCss(hex) { return '#' + hex.toString(16).padStart(6, '0'); }
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }

// Clothing canvas texture. FRONT design centered at u=0.25, plain back at u=0.75.
// Lathe/cylinder UV: u wraps around circumference; with default geometry the seam is at back,
// so rotating the mesh Y by PI puts u=0.25 (front design) facing +Z. Parts below apply rotation.y = Math.PI where needed.
export function makeClothTexture(kind, topColor, trim, pantsColor) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); const R = texRng(topColor % 10000 + kind.length * 131);
  const base = hexCss(topColor);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  // fabric noise
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.05})`; g.fillRect(R() * 256, R() * 256, 2, 1); }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + R() * 0.04})`; g.fillRect(R() * 256, R() * 256, 2, 1); }
  // vertical shading gradient (front panel x ~ 0..128 is u 0..0.5)
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(0,0,0,.28)'); grad.addColorStop(0.25, 'rgba(255,255,255,.10)'); grad.addColorStop(0.5, 'rgba(0,0,0,.28)'); grad.addColorStop(0.75, 'rgba(255,255,255,.05)'); grad.addColorStop(1, 'rgba(0,0,0,.28)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const FX = 64; // front center x (u=0.25)
  if (kind === 'jeans' || kind === 'uniform-pants') {
    g.fillStyle = shade(topColor, 0.75); g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${0.03 + R() * 0.04})`; g.fillRect(R() * 256, R() * 256, 1, 3); }
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    g.beginPath(); g.arc(FX - 26, 44, 16, 0.2, 2.4); g.stroke();
    g.beginPath(); g.arc(FX + 26, 44, 16, 0.7, 2.9); g.stroke();
    g.strokeStyle = 'rgba(255,200,120,.5)'; g.beginPath(); g.moveTo(FX, 30); g.lineTo(FX, 120); g.stroke();
    // belt band
    g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 256, 22);
    g.fillStyle = '#c0c4c8'; g.fillRect(FX - 10, 4, 20, 14); g.fillStyle = '#3a2a1a'; g.fillRect(FX - 5, 7, 10, 8);
  } else if (kind === 'jacket' || kind === 'leather') {
    if (kind === 'leather') { const sg = g.createLinearGradient(0, 0, 256, 256); sg.addColorStop(0, 'rgba(255,255,255,.16)'); sg.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(0, 0, 256, 256); }
    // collar
    g.fillStyle = shade(topColor, 0.7); g.fillRect(0, 0, 256, 26);
    if (trim) { g.fillStyle = hexCss(trim); g.fillRect(0, 22, 256, 5); }
    // zipper (center front, or diagonal for leather)
    g.strokeStyle = '#14161a'; g.lineWidth = 4;
    g.beginPath();
    if (kind === 'leather') { g.moveTo(FX - 30, 26); g.lineTo(FX + 22, 200); } else { g.moveTo(FX, 26); g.lineTo(FX, 240); }
    g.stroke();
    g.strokeStyle = '#9aa0a6'; g.lineWidth = 1;
    for (let y = 30; y < 235; y += 7) { const t = (y - 26) / 210; const zx = kind === 'leather' ? FX - 30 + 52 * t : FX; g.beginPath(); g.moveTo(zx - 4, y); g.lineTo(zx + 4, y); g.stroke(); }
    // chest pocket flaps
    g.fillStyle = shade(topColor, 0.82); g.fillRect(FX - 52, 84, 34, 16); g.fillRect(FX + 18, 84, 34, 16);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(FX - 52, 98, 34, 3); g.fillRect(FX + 18, 98, 34, 3);
    if (trim) { g.fillStyle = hexCss(trim); g.fillRect(0, 218, 256, 8); }
  } else if (kind === 'hoodie') {
    g.fillStyle = shade(topColor, 0.78); g.fillRect(0, 0, 256, 34); // hood shading
    g.fillStyle = shade(topColor, 0.85); g.fillRect(FX - 38, 176, 76, 52); // kangaroo pocket
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(FX - 38, 176, 76, 52);
    g.strokeStyle = '#f2f2f2'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(FX - 8, 36); g.lineTo(FX - 12, 66); g.stroke();
    g.beginPath(); g.moveTo(FX + 8, 36); g.lineTo(FX + 12, 66); g.stroke();
  } else if (kind === 'tank') {
    g.fillStyle = 'rgba(0,0,0,.10)';
    g.beginPath(); g.ellipse(20, 128, 26, 90, 0, 0, 6.3); g.fill();
    g.beginPath(); g.ellipse(108, 128, 26, 90, 0, 0, 6.3); g.fill();
  } else if (kind === 'overalls') {
    g.fillStyle = shade(topColor, 0.88); g.fillRect(FX - 34, 60, 68, 90); // bib
    g.fillStyle = shade(topColor, 0.8); g.fillRect(FX - 40, 0, 14, 70); g.fillRect(FX + 26, 0, 14, 70); // straps
    g.fillStyle = '#d8b13c'; g.beginPath(); g.arc(FX - 30, 66, 5, 0, 6.3); g.fill(); g.beginPath(); g.arc(FX + 30, 66, 5, 0, 6.3); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.strokeRect(FX - 34, 60, 68, 90);
  } else if (kind === 'uniform') {
    g.strokeStyle = '#c8ccd2'; g.lineWidth = 2; g.beginPath(); g.moveTo(FX, 30); g.lineTo(FX, 240); g.stroke();
    g.fillStyle = '#e8e8e8'; for (let y = 44; y < 230; y += 26) { g.beginPath(); g.arc(FX, y, 3.4, 0, 6.3); g.fill(); }
    // gold badge left chest (figure's left = front-right in texture? badge at FX-30)
    g.fillStyle = hexCss(trim || 0xc8a028); g.beginPath(); g.arc(FX - 32, 66, 10, 0, 6.3); g.fill();
    g.fillStyle = '#7a5c10'; g.beginPath(); g.arc(FX - 32, 66, 5, 0, 6.3); g.fill();
    if (trim) { g.fillStyle = hexCss(trim); g.fillRect(0, 4, 256, 7); } // epaulette band hint at shoulders
  } else if (kind === 'cargo') {
    g.fillStyle = shade(topColor, 0.85); g.fillRect(8, 130, 44, 52); g.fillRect(76, 130, 44, 52);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(8, 130, 44, 52); g.strokeRect(76, 130, 44, 52);
    g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, 256, 20);
  } else if (kind === 'skirt') {
    g.fillStyle = shade(topColor, 0.9); g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 3, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function shoeTexture(color, stripes) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = hexCss(color); g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 88, 128, 40);
  if (stripes) { g.fillStyle = '#ffffff'; g.save(); g.translate(64, 54); g.rotate(-0.5); for (let i = -1; i <= 1; i++) g.fillRect(i * 22 - 5, -40, 10, 80); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function mat(color, rough) { return new THREE.MeshStandardMaterial({ color, roughness: rough == null ? 0.85 : rough }); }
function capsule(r, len, m) { const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m); mesh.castShadow = false; return mesh; }

export function makeFigure(o) {
  const H = 1.78 * (o.h || 1);
  const build = o.build || 0.55;
  const outfit = o.outfit;
  const skinMat = mat(o.skin, 0.65);
  const hairMat = mat(o.hairColor || 0x1a1a1a, 0.9);
  const longSleeve = ['jacket', 'leather', 'hoodie', 'uniform', 'overalls'].includes(outfit.top);
  const topTex = makeClothTexture(outfit.top === 'uniform' ? 'uniform' : outfit.top, outfit.topColor, outfit.trim, outfit.pantsColor);
  const topMat = new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.9 });
  const pantsKind = outfit.pants === 'jeans' ? 'jeans' : outfit.pants === 'uniform' ? 'jeans' : outfit.pants;
  const pantsTex = makeClothTexture(pantsKind === 'skirt+leggings' ? 'skirt' : pantsKind, outfit.pantsColor, outfit.trim, outfit.pantsColor);
  const pantsMat = new THREE.MeshStandardMaterial({ map: pantsTex, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ map: shoeTexture(outfit.shoes, outfit.shoeStripes), roughness: 0.8 });

  const fig = new THREE.Group();
  const legLen = H * 0.48, torsoH = H * 0.30, headR = H * 0.065;
  const hipY = legLen;
  // pelvis
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.145 * (0.8 + build * 0.5), 14, 10), pantsMat);
  pelvis.scale.set(1, 0.7, 0.85); pelvis.position.y = hipY; fig.add(pelvis);
  if (outfit.pants === 'skirt+leggings') {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.24, 14, 1, true), pantsMat);
    skirt.position.y = hipY - 0.08; fig.add(skirt);
  }
  // torso lathe: waist -> chest -> shoulder
  const torsoG = new THREE.Group(); torsoG.position.y = hipY; fig.add(torsoG);
  const cw = 0.13 + build * 0.055;
  const pts = [];
  pts.push(new THREE.Vector2(0.115, 0));
  pts.push(new THREE.Vector2(0.135, torsoH * 0.25));
  pts.push(new THREE.Vector2(cw, torsoH * 0.62));
  pts.push(new THREE.Vector2(cw * 0.92, torsoH * 0.88));
  pts.push(new THREE.Vector2(0.075, torsoH));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(pts, 16), topMat);
  torso.scale.z = 0.78; torso.rotation.y = Math.PI; // front design (u .25) faces +Z
  torsoG.add(torso);
  // neck + head
  const headG = new THREE.Group(); headG.position.y = torsoH + 0.03; torsoG.add(headG);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.07, 10), skinMat); neck.position.y = 0.01; headG.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), skinMat);
  head.scale.y = 1.12; head.position.y = 0.05 + headR; headG.add(head);
  const hy = 0.05 + headR;
  // face (+Z front)
  const eyeMat = mat(0x1a1210, 0.4);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMat); eye.position.set(s * 0.04 * (H / 1.78), hy + 0.012, headR * 0.92); headG.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.006, 0.006), hairMat); brow.position.set(s * 0.04 * (H / 1.78), hy + 0.038, headR * 0.94); brow.rotation.z = -s * 0.18; headG.add(brow);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), skinMat); ear.position.set(s * headR * 0.98, hy, 0); headG.add(ear);
  }
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 6), skinMat); nose.rotation.x = Math.PI / 2; nose.position.set(0, hy - 0.012, headR * 1.0); headG.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.004), mat(0x7a4038, 0.7)); mouth.position.set(0, hy - 0.052, headR * 0.93); headG.add(mouth);
  // hair
  const hairStyle = o.hair || 'buzz';
  const capGeo = new THREE.SphereGeometry(headR * 1.07, 16, 10, 0, Math.PI * 2, 0, 1.9);
  if (hairStyle === 'cap' || o.accessory === 'cap' || o.accessory === 'cap+badge') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.08, 14, 8, 0, Math.PI * 2, 0, 1.4), mat(o.hairColor || 0x24304a, 0.8)); dome.position.y = hy + 0.012; headG.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(headR * 1.25, headR * 1.3, 0.012, 14, 1, false, -0.7, 1.4), mat(o.hairColor || 0x24304a, 0.8)); brim.position.set(0, hy + 0.045, headR * 0.55); headG.add(brim);
  } else {
    const cap = new THREE.Mesh(capGeo, hairMat); cap.scale.y = 1.12; cap.position.set(0, hy + 0.012, -0.008); headG.add(cap);
    if (hairStyle.includes('topknot')) { const knot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), hairMat); knot.position.set(0, hy + headR * 1.05, -0.02); headG.add(knot); }
    if (hairStyle.includes('ponytail')) { const tail = capsule(0.032, 0.2, hairMat); tail.position.set(0, hy - 0.08, -headR - 0.03); tail.rotation.x = 0.25; headG.add(tail); }
    if (hairStyle.includes('bob')) { const bob = new THREE.Mesh(new THREE.SphereGeometry(headR * 1.14, 14, 10, 0, Math.PI * 2, 0, 2.4), hairMat); bob.scale.y = 1.25; bob.position.set(0, hy + 0.005, -0.006); headG.add(bob); }
  }
  // arms
  function makeArm(side) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * (cw + 0.03), torsoH - 0.05, 0); torsoG.add(shoulder);
    const upperMat = outfit.top === 'tank' ? skinMat : topMat;
    const upper = capsule(0.045, 0.17, upperMat); upper.position.y = -0.13; shoulder.add(upper);
    shoulder.rotation.z = side * 0.14;
    const elbow = new THREE.Group(); elbow.position.y = -0.27; shoulder.add(elbow);
    const foreMat = longSleeve ? topMat : skinMat;
    const fore = capsule(0.037, 0.16, foreMat); fore.position.y = -0.115; elbow.add(fore);
    const handMat = o.accessory === 'gloves' ? mat(outfit.topColor, 0.8) : skinMat;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), handMat); hand.scale.set(0.8, 1.15, 0.9); hand.position.y = -0.26; elbow.add(hand);
    elbow.rotation.x = -0.25;
    return { shoulder, elbow };
  }
  const aL = makeArm(-1), aR = makeArm(1);
  // legs
  function makeLeg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.085, hipY - 0.02, 0); fig.add(hip);
    const thighMat = outfit.pants === 'skirt+leggings' ? pantsMat : pantsMat;
    const thigh = capsule(0.068, 0.26, thighMat); thigh.position.y = -legLen * 0.25; hip.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -legLen * 0.5; hip.add(knee);
    const shinMat = outfit.pants === 'skirt+leggings' ? mat(outfit.pantsColor, 0.9) : pantsMat;
    const shin = capsule(0.052, 0.26, shinMat); shin.position.y = -legLen * 0.24; knee.add(shin);
    const shoe = new THREE.Group(); shoe.position.y = -legLen * 0.5 + 0.03; knee.add(shoe);
    const shoeMesh = capsule(0.05, 0.1, shoeMat); shoeMesh.rotation.x = Math.PI / 2; shoeMesh.scale.set(0.85, 1, 0.6); shoeMesh.position.set(0, -0.02, 0.045); shoe.add(shoeMesh);
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.022, 0.24), mat(0xf5f5f5, 0.7)); sole.position.set(0, -0.055, 0.04); shoe.add(sole);
    return { hip, knee };
  }
  const lL = makeLeg(-1), lR = makeLeg(1);
  // accessories
  if (o.accessory === 'glasses') {
    const frameMat = mat(0x14161a, 0.3);
    for (const s of [-1, 1]) { const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.055, 0.04), new THREE.MeshStandardMaterial({ color: 0x10151c, roughness: 0.1, metalness: 0.6 })); lens.position.set(s * 0.04, hy + 0.012, headR + 0.012); headG.add(lens); const fr = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.004), frameMat); fr.position.copy(lens.position); fr.position.y += 0.023; headG.add(fr); }
  }
  if (o.accessory === 'chain') { const chain = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 20), new THREE.MeshStandardMaterial({ color: 0xd8b13c, metalness: 0.9, roughness: 0.3 })); chain.position.set(0, torsoH - 0.02, 0.1); chain.rotation.x = 0.5; torsoG.add(chain); }
  if (o.accessory === 'phone') { const ph = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.07, 0.008), mat(0x14161c, 0.3)); ph.position.set(0, -0.27, 0.03); aR.elbow.add(ph); }
  if (o.accessory === 'cap+badge') { const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 12), new THREE.MeshStandardMaterial({ color: 0xc8a028, metalness: 0.9, roughness: 0.3 })); badge.rotation.x = Math.PI / 2; badge.position.set(-0.07, torsoH * 0.72, cw * 0.8); torsoG.add(badge); }
  // blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; fig.add(shadow);
  fig.userData = { legL: lL.hip, legR: lR.hip, kneeL: lL.knee, kneeR: lR.knee, armL: aL.shoulder, armR: aR.shoulder, foreL: aL.elbow, foreR: aR.elbow, headG, torsoG, H };
  return fig;
}
export function animateFigure(fig, phase, amt) {
  const u = fig.userData; if (!u.legL) return;
  const s = Math.sin(phase), c = Math.sin(phase + Math.PI);
  u.legL.rotation.x = s * 0.55 * amt; u.legR.rotation.x = c * 0.55 * amt;
  u.kneeL.rotation.x = Math.max(0, -c) * 0.6 * amt; u.kneeR.rotation.x = Math.max(0, -s) * 0.6 * amt;
  u.armL.rotation.x = c * 0.4 * amt; u.armR.rotation.x = s * 0.4 * amt;
  u.foreL.rotation.x = -0.25 - Math.max(0, s) * 0.3 * amt; u.foreR.rotation.x = -0.25 - Math.max(0, c) * 0.3 * amt;
  u.torsoG.position.y = (u.H * 0.48) + Math.abs(Math.sin(phase)) * 0.03 * amt + (amt < 0.05 ? Math.sin(phase * 0.35) * 0.006 : 0);
  u.headG.rotation.x = Math.sin(phase * 0.5) * 0.03;
}
export function poseSeated(fig) {
  const u = fig.userData; if (!u.legL) return;
  u.legL.rotation.x = -Math.PI / 2 + 0.12; u.legR.rotation.x = -Math.PI / 2 + 0.12;
  u.kneeL.rotation.x = Math.PI / 2 - 0.15; u.kneeR.rotation.x = Math.PI / 2 - 0.15;
  u.armL.rotation.x = -0.85; u.armR.rotation.x = -0.85;
  u.armL.rotation.z = 0.3; u.armR.rotation.z = -0.3;
  u.foreL.rotation.x = -0.35; u.foreR.rotation.x = -0.35;
  u.torsoG.position.y = u.H * 0.48;
}
export function createPlayer(G) {
  const fig = makeFigure(CAST.ren);
  const x = -412.5, z = 470;
  fig.position.set(x, groundH(x, z), z);
  G.scene.add(fig);
  const player = { fig, x, z, angle: Math.PI, speed: 0, phase: 0, health: 100 };
  G.player = player;
  return player;
}
export function updatePlayer(G, dt) {
  const p = G.player; if (!p || !p.fig.visible) return;
  const k = G.keys;
  let mx = 0, mz = 0;
  if (k['KeyW'] || k['ArrowUp']) mz += 1;
  if (k['KeyS'] || k['ArrowDown']) mz -= 1;
  if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
  if (k['KeyD'] || k['ArrowRight']) mx += 1;
  const moving = (mx !== 0 || mz !== 0);
  const run = (k['ShiftLeft'] || k['ShiftRight']) ? 9 : 6;
  if (moving) {
    const yaw = G.camYaw || 0;
    const wx = Math.sin(yaw) * mz + Math.cos(yaw) * mx;
    const wz = Math.cos(yaw) * mz - Math.sin(yaw) * mx;
    const len = Math.hypot(wx, wz) || 1;
    p.x += (wx / len) * run * dt; p.z += (wz / len) * run * dt;
    p.angle = Math.atan2(wx / len, wz / len);
    p.phase += dt * run * 1.9;
    p.speed = run;
  } else p.speed = 0;
  // collisions push-out
  for (const col of G.colliders) {
    const dx = p.x - col.x, dz = p.z - col.z;
    const px = col.hw + 0.45 - Math.abs(dx), pz = col.hd + 0.45 - Math.abs(dz);
    if (px > 0 && pz > 0) { if (px < pz) p.x += (dx >= 0 ? px : -px); else p.z += (dz >= 0 ? pz : -pz); }
  }
  p.x = Math.max(-655, Math.min(655, p.x)); p.z = Math.max(-655, Math.min(655, p.z));
  p.fig.position.set(p.x, groundH(p.x, p.z), p.z);
  p.fig.rotation.y = p.angle;
  animateFigure(p.fig, p.phase, moving ? 1 : 0.04);
}
