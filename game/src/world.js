// world.js — RONIN BAY city
import * as THREE from 'three';
import { CFG, DISTRICTS, TOUGE_POINTS, VICE } from './config.js';
import { rnd, rr, ri, pick } from './random.js';
import { loadHeroAsset } from './assets.js';

let _glowTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c); return _glowTex;
}
// ---- gradient sky dome + warm haze (S7a) ----
const SKY_KEYS = [
  { h: 0, top: '#060a18', mid: '#0e1830', hor: '#16233f', fog: '#101a2e' },
  { h: 5, top: '#060a18', mid: '#0e1830', hor: '#16233f', fog: '#101a2e' },
  { h: 7, top: '#3d6fb4', mid: '#d9a06b', hor: '#f2d5a0', fog: '#e8c9a0' },
  { h: 10.5, top: '#3a7bd5', mid: '#8ec9e8', hor: '#bfe3ef', fog: '#cfe4ec' },
  { h: 16.5, top: '#3a6db0', mid: '#c9b49a', hor: '#f7d99a', fog: '#ecd3a4' },
  { h: 17.8, top: '#35507a', mid: '#e8763a', hor: '#ffc46b', fog: '#f2c99a' },
  { h: 19.5, top: '#141e38', mid: '#6a4a5a', hor: '#c97a4a', fog: '#7a5a4e' },
  { h: 22, top: '#060a18', mid: '#0e1830', hor: '#16233f', fog: '#101a2e' },
  { h: 24, top: '#060a18', mid: '#0e1830', hor: '#16233f', fog: '#101a2e' },
].map(k => ({ h: k.h, top: new THREE.Color(k.top), mid: new THREE.Color(k.mid), hor: new THREE.Color(k.hor), fog: new THREE.Color(k.fog) }));
const _skyTop = new THREE.Color(), _skyMid = new THREE.Color(), _skyHor = new THREE.Color(), _skyFog = new THREE.Color();
const _warmTint = new THREE.Color(0xffe0b8);
function skyColorsAt(t) {
  let i = 0;
  while (i < SKY_KEYS.length - 2 && t >= SKY_KEYS[i + 1].h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1];
  const f = Math.max(0, Math.min(1, (t - a.h) / Math.max(0.001, b.h - a.h)));
  _skyTop.lerpColors(a.top, b.top, f); _skyMid.lerpColors(a.mid, b.mid, f);
  _skyHor.lerpColors(a.hor, b.hor, f); _skyFog.lerpColors(a.fog, b.fog, f);
}
let _skyCanvas = null, _skyCtx = null, _skyTex = null, _skyDome = null, _lastSkyT = -10;
let _signGlows = [];
function drawSkyDome() {
  if (!_skyCtx) return;
  const gr = _skyCtx.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#' + _skyTop.getHexString());
  gr.addColorStop(0.55, '#' + _skyMid.getHexString());
  gr.addColorStop(1, '#' + _skyHor.getHexString());
  _skyCtx.fillStyle = gr; _skyCtx.fillRect(0, 0, 16, 512);
  if (_skyTex) _skyTex.needsUpdate = true;
}
export function glowSprite(color, scale) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
  const s = new THREE.Sprite(m); s.scale.set(scale, scale, 1); return s;
}
export function groundH(x, z) {
  const dx = x + 330, dz = z + 470;
  const d2 = (dx * dx + dz * dz) / (330 * 330);
  let h = 14 * Math.exp(-d2 * 2.2);
  if (x > -140 || z > -180) h *= Math.max(0, Math.min(1, ((-140 - x) / 120 + 1)));
  // keep city grid flat: hill only in NW quadrant
  if (x > -100 || z > -100) h = 0;
  return h;
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function groundTexture() {
  // Vice round: base land is a bright warm treated surface, never the
  // old flat olive/dirt wash. Per-zone textures below do the real work;
  // this only shows at edges the zone planes do not cover.
  return canvasTex(256, 256, (g) => {
    g.fillStyle = VICE.ground.base; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${190 + ri(0, 50)},${175 + ri(0, 45)},${140 + ri(0, 40)},.14)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,250,235,.06)'; g.fillRect(rnd() * 256, rnd() * 256, rr(18, 46), rr(12, 30)); }
    g.strokeStyle = 'rgba(120,110,90,.10)'; g.strokeRect(0, 0, 256, 256);
  });
}
// ---- Vice round ground treatments: small canvas textures, tiled ----
// (a) paving-slab grid for sidewalks / plazas / Coral + downtown blocks
function pavingTexture() {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = VICE.ground.paving; g.fillRect(0, 0, 128, 128);
    g.fillStyle = VICE.ground.pavingAlt; g.fillRect(64, 0, 64, 64); g.fillRect(0, 64, 64, 64);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${150 + ri(0, 60)},${145 + ri(0, 50)},${120 + ri(0, 40)},.13)`; g.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
    g.strokeStyle = VICE.ground.pavingGrout; g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128);
    g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.moveTo(0, 64); g.lineTo(128, 64); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// (b) saturated grass for parks / Hoshino Heights yards + the hill
function grassTexture() {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = VICE.ground.grass; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < 0.5 ? VICE.ground.grassLight : VICE.ground.grassDark; g.globalAlpha = rr(0.12, 0.3); g.fillRect(rnd() * 128, rnd() * 128, 2, rr(2, 4)); }
    g.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// (c) bright warm sand for the beach strip
function sandTexture() {
  const t = canvasTex(128, 128, (g) => {
    g.fillStyle = VICE.ground.sand; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 500; i++) { g.fillStyle = rnd() < 0.6 ? VICE.ground.sandSpeckle : '#fff3cf'; g.globalAlpha = rr(0.1, 0.28); g.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
    g.globalAlpha = 1;
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function grassMat(repX, repY) {
  const t = grassTexture(); t.repeat.set(repX, repY);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 1 });
}
const LIT_TONES = ['#ffd9a0', '#ffc98a', '#fff3d0', '#ffe9b8', '#bfe0ff', '#9fd4ff']; // warm-heavy, some cool
function buildingTexture(base, litRatio) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 14) for (let x = 6; x < w - 6; x += 14) {
      const lit = rnd() < litRatio;
      g.fillStyle = lit ? LIT_TONES[Math.floor(rnd() * (rnd() < 0.72 ? 4 : 6))] : '#2c3844'; g.fillRect(x, y, 9, 8);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, y, 9, 2);
    }
  });
}
function signTexture(text, bg, fg) {
  return canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 12; g.fillStyle = fg; g.fillText(text, w / 2, h / 2);
  });
}
export function makePalm(hgt) {
  const grp = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.95 });
  const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, hgt * 0.55, 0), new THREE.Vector3(0.55, hgt, 0));
  const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.14, 6), trunkMat); grp.add(trunk);
  const top = curve.getPoint(1);
  const frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  for (let i = 0; i < 8; i++) {
    const len = rr(2.0, 2.4);
    const geo = new THREE.PlaneGeometry(0.5, len, 1, 6);
    const pos = geo.attributes.position; const col = [];
    const cBase = new THREE.Color(0x2e7d32), cTip = new THREE.Color(0x66bb4a), tmp = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v); const t = (y + len / 2) / len;
      pos.setZ(v, -Math.pow(t, 2) * 0.9); pos.setX(v, pos.getX(v) * (1 - t * 0.7));
      tmp.copy(cBase).lerp(cTip, t); col.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
    const frond = new THREE.Mesh(geo, frondMat);
    frond.position.copy(top); frond.rotation.order = 'YXZ';
    frond.rotation.y = (i / 8) * Math.PI * 2 + rr(-0.2, 0.2);
    frond.rotation.x = -Math.PI / 2 + rr(0.35, 0.6);
    frond.translateY(len / 2 - 0.1);
    grp.add(frond);
  }
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; }); // V5: palms cast
  return grp;
}
export function makeShadeTree(hgt, canopyColor) {
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, hgt * 0.55, 7), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }));
  trunk.position.y = hgt * 0.275; grp.add(trunk);
  const mat = new THREE.MeshStandardMaterial({ color: canopyColor || 0x3d8b4f, roughness: 1, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const r = hgt * rr(0.28, 0.4);
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
    blob.position.set(rr(-0.5, 0.5), hgt * 0.55 + rr(0, hgt * 0.3), rr(-0.5, 0.5)); grp.add(blob);
  }
  return grp;
}
// ---- F1: houses, RONIN MART, shared materials ----
const MARKET = { x: -82.5, z: -255, name: 'RONIN MART' };
const _matCache = new Map();
function stdMat(color, rough, metal) {
  const key = color + '|' + (rough || 0.95) + '|' + (metal || 0);
  if (!_matCache.has(key)) _matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough || 0.95, metalness: metal || 0 }));
  return _matCache.get(key);
}
function distToTouge(x, z) {
  let m = 1e9;
  for (let i = 0; i < TOUGE_POINTS.length - 1; i++) {
    const ax = TOUGE_POINTS[i][0], az = TOUGE_POINTS[i][1], bx = TOUGE_POINTS[i + 1][0], bz = TOUGE_POINTS[i + 1][1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / L2; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t));
    if (d < m) m = d;
  }
  return m;
}
function prismGeo(w, h, d) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return g;
}
const HOUSE_WALLS = ['#f2e3c8', '#eec9b8', '#dfe8d8', '#f5d9e0', '#dcebf5', '#f7ecc9', '#e6d7f0', '#ffe8cc'];
const HOUSE_ROOFS = [0xb5523c, 0x8a4a3a, 0x5d6d7e, 0xa03d2d, 0x6b4a35, 0x44586a, 0xc96f4a];
const HOUSE_YARDS = [0x5d9a52, 0x67a35a, 0x548c4c, 0x71ab60];
const _houseWinMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ea, roughness: 0.25, metalness: 0.4, emissive: 0xffc873, emissiveIntensity: 0.35 });
let _lastHouseWall = null;
function buildHouse(G, scene, x, z, face) {
  const grp = new THREE.Group();
  grp.position.set(x, groundH(x, z), z);
  grp.rotation.y = face > 0 ? 0 : Math.PI;
  const two = rnd() < 0.45;
  const w = rr(9, 12), d = rr(8, 10), wallH = two ? rr(5.2, 6) : rr(2.9, 3.4);
  const roofH = rr(1.8, 2.6);
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(30, 25), grassMat(4, 3)); // Vice: textured saturated grass, not a flat green slab
  void HOUSE_YARDS;
  yard.rotation.x = -Math.PI / 2; yard.position.y = 0.03; grp.add(yard);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8.5), stdMat(0x9a9a96, 1));
  drive.rotation.x = -Math.PI / 2; drive.position.set(-w * 0.28, 0.05, d / 2 + 4.2); grp.add(drive);
  const hedgeMat = stdMat(0x2e6b34, 1);
  const hedgeB = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 0.4), hedgeMat); hedgeB.position.set(0, 0.28, -12.3); grp.add(hedgeB);
  for (const s of [-1, 1]) { const hs = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 25), hedgeMat); hs.position.set(s * 14.8, 0.28, 0); grp.add(hs); }
  let wallCol = pick(HOUSE_WALLS);
  if (wallCol === _lastHouseWall) wallCol = HOUSE_WALLS[(HOUSE_WALLS.indexOf(wallCol) + 1) % HOUSE_WALLS.length];
  _lastHouseWall = wallCol;
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), stdMat(new THREE.Color(wallCol).getHex(), 0.95));
  walls.position.y = wallH / 2; grp.add(walls);
  const roof = new THREE.Mesh(prismGeo(w + 1.2, roofH, d + 1), stdMat(pick(HOUSE_ROOFS), 0.9));
  roof.position.y = wallH; grp.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), stdMat(0x4a3220, 0.9));
  door.position.set(-w * 0.28, 1.1, d / 2 + 0.06); grp.add(door);
  const winY = two ? [1.9, 4.4] : [1.9];
  for (const wy of winY) for (const wx of [0, w * 0.3]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), _houseWinMat);
    win.position.set(wx, wy, d / 2 + 0.06); grp.add(win);
  }
  if (rnd() < 0.4) { const ch = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), stdMat(0x8a7a6a, 1)); ch.position.set(w * 0.3, wallH + roofH * 0.55, 0); grp.add(ch); }
  if (rnd() < 0.35) { const tr = makeShadeTree(rr(2.6, 3.4), 0x3d8b4f); tr.position.set(11, 0, -8); grp.add(tr); }
  // V5: houses cast (yard/drive ground planes receive instead of casting)
  grp.traverse(o => { if (o.isMesh) o.castShadow = true; });
  yard.castShadow = false; yard.receiveShadow = true; drive.castShadow = false; drive.receiveShadow = true;
  scene.add(grp);
  G.addCollider(x, z, w / 2, d / 2, wallH + roofH);
}
function buildResidentialBlock(G, scene, cx, cz) {
  for (const row of [{ dz: -31, face: -1 }, { dz: 31, face: 1 }]) {
    for (const lx of [-57, -19, 19, 57]) {
      const x = cx + lx + rr(-3, 3), z = cz + row.dz + rr(-3, 3);
      if (distToTouge(x, z) < 16) continue;
      if (G.roadX.some(rx => Math.abs(x - rx) < 26) || G.roadZ.some(rz => Math.abs(z - rz) < 26)) continue;
      buildHouse(G, scene, x, z, row.face);
    }
  }
}
function buildParkedCar(color) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.55, 4.4), new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 }));
  body.position.y = 0.55; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), stdMat(0x1c2733, 0.2, 0.6));
  cabin.position.set(0, 1.05, -0.15); grp.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
  const wheelMat = stdMat(0x17181a, 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wh = new THREE.Mesh(wheelGeo, wheelMat);
    wh.rotation.z = Math.PI / 2; wh.position.set(sx * 0.85, 0.33, sz * 1.35); grp.add(wh);
  }
  return grp;
}
function buildMarket(G, scene) {
  const mx = MARKET.x, mz = MARKET.z;
  const grp = new THREE.Group(); grp.position.set(mx, groundH(mx, mz), mz); scene.add(grp);
  const block = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), stdMat(0xdfe3e6, 0.9));
  block.position.y = 4.5; grp.add(block);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(48, 0.5, 24), stdMat(0x3c4248, 0.9));
  slab.position.y = 9.25; grp.add(slab);
  for (const [ax, az] of [[-14, -6], [12, 5]]) {
    const ac = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.6), stdMat(0x707880, 0.8, 0.3));
    ac.position.set(ax, 10.05, az); grp.add(ac);
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(34, 3.4, 0.4), stdMat(0x12233f, 0.8));
  band.position.set(0, 7.4, 11.1); grp.add(band);
  const signTex = canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = '#12233f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8232a'; g.fillRect(0, h - 18, w, 18);
    g.fillStyle = '#d8232a'; g.beginPath(); g.arc(72, 72, 44, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('R', 72, 76);
    g.font = 'bold 96px sans-serif'; g.textAlign = 'left';
    g.fillText('RONIN MART', 140, 76);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(32, 3.2), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 7.4, 11.32); grp.add(sign);
  const mGlow = glowSprite(0x9fd4ff, 17); // landmark glow anchor at night
  mGlow.position.set(0, 7.4, 12.4); mGlow.material.opacity = 0; grp.add(mGlow); _signGlows.push(mGlow);
  const glassTex = canvasTex(512, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#8fc3d4'); gr.addColorStop(1, '#3d6d80');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(20,30,38,.85)'; g.fillRect(w / 2 - 30, 6, 60, h - 6);
    g.strokeStyle = 'rgba(240,248,250,.9)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 42) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(240,248,250,.95)'; g.strokeRect(w / 2 - 30, 6, 60, h - 6);
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.1), new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.2, metalness: 0.5 }));
  glass.position.set(0, 1.75, 11.06); grp.add(glass);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 3), stdMat(0x2c3138, 0.8));
  canopy.position.set(0, 3.6, 12.4); grp.add(canopy);
  const padTex = canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#3a3d40'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 46 + Math.floor(rnd() * 26); g.fillStyle = `rgba(${v},${v},${v + 3},.16)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.strokeStyle = 'rgba(245,245,240,.9)'; g.lineWidth = 5;
    for (let x = 40; x <= w - 40; x += 74) {
      g.beginPath(); g.moveTo(x, 10); g.lineTo(x, 128); g.stroke();
      g.beginPath(); g.moveTo(x, h - 128); g.lineTo(x, h - 10); g.stroke();
    }
    g.beginPath(); g.moveTo(40, 128); g.lineTo(w - 40, 128); g.stroke();
    g.beginPath(); g.moveTo(40, h - 128); g.lineTo(w - 40, h - 128); g.stroke();
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), new THREE.MeshStandardMaterial({ map: padTex, roughness: 1 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.04, 27); grp.add(pad);
  const driveStrip = new THREE.Mesh(new THREE.PlaneGeometry(9, 42), stdMat(0x3a3d40, 1));
  driveStrip.rotation.x = -Math.PI / 2; driveStrip.position.set(0, 0.04, 64); grp.add(driveStrip);
  const carCols = [0xc0c4c9, 0x3f8cff, 0xd95555, 0x44484e, 0xf2b21b, 0x5a7d4f];
  const carSpots = [[-22, 19.5, Math.PI], [-14.5, 19.5, Math.PI], [6, 19.5, Math.PI], [18, 35, 0], [25.5, 19.5, Math.PI]];
  carSpots.forEach(([px, pz, ry], i) => {
    const car = buildParkedCar(carCols[i % carCols.length]);
    car.position.set(px, 0, pz); car.rotation.y = ry; grp.add(car);
  });
  const railMat2 = stdMat(0xb0b6bc, 0.4, 0.7);
  for (const [qx, qz] of [[-18, 31], [14, 16.5]]) {
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.6), railMat2);
      rail.position.set(qx + s * 0.9, 0.75, qz); grp.add(rail);
      for (const e of [-1, 1]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), railMat2); post.position.set(qx + s * 0.9, 0.38, qz + e * 1.8); grp.add(post); }
    }
    const cart = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), railMat2);
    cart.position.set(qx, 0.45, qz); grp.add(cart);
  }
  const crateCols = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b];
  for (const rx of [-8.5, 8.5]) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), stdMat(0x6b4a2f, 0.95));
    rack.position.set(rx, 0.45, 13.2); grp.add(rack);
    for (let i = 0; i < 3; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), stdMat(crateCols[(i + (rx > 0 ? 1 : 0)) % 4], 0.9));
      crate.position.set(rx - 1 + i, 1.18, 13.2); grp.add(crate);
    }
  }
  const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 8), railMat2);
  pylon.position.set(24, 3.5, 52); grp.add(pylon);
  const pylonSign = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.3, 0.35), new THREE.MeshBasicMaterial({ map: signTex }));
  pylonSign.position.set(24, 6.8, 52); grp.add(pylonSign);
  G.addCollider(mx, mz, 23, 11, 9);
}
// ---- F1 neon-coast beach dressing: boardwalk, palms, umbrellas,
// loungers, lifeguard stands along the south shore (z 549-640) ----
function buildBeachStrip(G, scene) {
  const hitsBuilding = (x, z, pad) => G.colliders.some(c => Math.abs(x - c.x) < c.hw + pad && Math.abs(z - c.z) < c.hd + pad);
  const bwTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#a97e56'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,45,25,.55)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(70,45,25,.35)';
    g.beginPath(); g.moveTo(0, 2); g.lineTo(w, 2); g.moveTo(0, h - 2); g.lineTo(w, h - 2); g.stroke();
  });
  bwTex.wrapS = bwTex.wrapT = THREE.RepeatWrapping; bwTex.repeat.set(30, 1);
  const bw = new THREE.Mesh(new THREE.BoxGeometry(1120, 0.1, 6), new THREE.MeshStandardMaterial({ map: bwTex, roughness: 1 }));
  bw.position.set(100, 0.07, 556); bw.receiveShadow = true; scene.add(bw);
  for (let x = -440; x <= 640; x += 55) {
    const px2 = x + rr(-3, 3), pz2 = 549 + rr(-1, 1);
    if (hitsBuilding(px2, pz2, 1.5)) continue;
    const palm = makePalm(rr(4.5, 6.5));
    palm.position.set(px2, 0, pz2); palm.rotation.y = rr(0, 6.28); scene.add(palm);
  }
  const umbCols = [0xff5da2, 0xffb35c, 0x39d5ff, 0xffe14d, 0x7dffb0, 0xff5c39];
  for (let i = 0; i < 14; i++) {
    let ux = 0, uz = 0, ok = false;
    for (let t = 0; t < 6 && !ok; t++) { ux = rr(-420, 620); uz = rr(578, 636); ok = !hitsBuilding(ux, uz, 2); }
    if (!ok) continue;
    const grp = new THREE.Group(); grp.position.set(ux, 0, uz); grp.rotation.y = rr(0, 6.28);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), stdMat(0xd8d8d2, 0.7));
    pole.position.y = 1.15; pole.rotation.z = 0.12; grp.add(pole);
    const can = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10), stdMat(pick(umbCols), 0.85));
    can.position.set(0.14, 2.35, 0); can.rotation.z = 0.12; grp.add(can);
    for (let l = 0; l < 2; l++) {
      if (rnd() < 0.3) continue;
      const lg = new THREE.Group(); lg.position.set(rr(-1.6, 1.6), 0, rr(0.8, 1.8)); lg.rotation.y = rr(-0.5, 0.5);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.5), stdMat(0xf2efe4, 0.9)); seat.position.y = 0.28; lg.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.8), stdMat(pick(umbCols), 0.9));
      back.position.set(0, 0.5, -0.75); back.rotation.x = -0.7; lg.add(back);
      grp.add(lg);
    }
    scene.add(grp);
  }
  for (const lx0 of [-300, 100, 500]) {
    let lx = lx0;
    while (hitsBuilding(lx, 598, 2) && lx < lx0 + 60) lx += 18;
    if (hitsBuilding(lx, 598, 2)) continue;
    const grp = new THREE.Group(); grp.position.set(lx, 0, 598);
    const white = stdMat(0xf2efe4, 0.85), red = stdMat(0xd8232a, 0.85);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), white);
      leg.position.set(sx * 0.7, 1.1, sz * 0.5); grp.add(leg);
    }
    const plat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), white); plat.position.y = 2.25; grp.add(plat);
    const backP = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.1), white); backP.position.set(0, 2.85, -0.6); grp.add(backP);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.5), red); roof.position.y = 3.5; grp.add(roof);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.6), white);
    ramp.position.set(0, 1.1, -1.7); ramp.rotation.x = 0.72; grp.add(ramp);
    scene.add(grp);
    G.addCollider(lx, 598, 1, 0.8, 3.5);
  }
}
// ---- V5 density round (B1) ----
// Point / footprint tests against the shared collider list, mirroring
// buildBeachStrip's hitsBuilding pattern.
function v5HitsPoint(G, x, z, pad) {
  return G.colliders.some(c => Math.abs(x - c.x) < c.hw + pad && Math.abs(z - c.z) < c.hd + pad);
}
function v5HitsFootprint(G, x, z, hw, hd, pad) {
  return G.colliders.some(c => Math.abs(x - c.x) < c.hw + hw + pad && Math.abs(z - c.z) < c.hd + hd + pad);
}
function v5Cast(obj) { obj.traverse(o => { if (o.isMesh) o.castShadow = true; }); return obj; }
// 1. CORAL FRONTAGE: continuous deco rows on both sides of the z=495
// boulevard, filling the empty between-block stretches. Facade planes
// sit at z=470 (north row, faces +z/south to the road) and z=518
// (south row, faces -z/north), so the road corridor stays clear while
// no street-level photo along the boulevard is mostly empty ground.
function buildBoulevardFrontage(G, scene) {
  const counts = { north: 0, south: 0 };
  const signsLocal = [['HOTEL CORAL', '#ffb35c'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'], ['CLUB NEON', '#e879ff'], ['RAMEN', '#ff5c39'], ['PAWN', '#ffe14d']];
  for (const side of [{ key: 'north', facadeZ: 470, faceDir: 1 }, { key: 'south', facadeZ: 518, faceDir: -1 }]) {
    let lastCol = null, prevCol = null, x = -560;
    while (x < 640) {
      let w = rr(18, 30);
      if (x + w > 640) w = 640 - x;
      if (w < 10) break;
      const d = rr(12, 18), tall = rr(10, 26);
      const cx = x + w / 2, cz = side.facadeZ - side.faceDir * (d / 2);
      // cross-street corridor: skip any span that intrudes on a road
      const road = G.roadX.find(r => cx - w / 2 < r + 14 && cx + w / 2 > r - 14);
      if (road !== undefined) { x = road + 14 + rr(0.5, 2); continue; }
      if (v5HitsFootprint(G, cx, cz, w / 2, d / 2, 2)) { x += w + rr(1.5, 5); continue; }
      // pastel cycle with the seeded loop's no-adjacent-repeat rule,
      // extended to the colour two buildings back (same as Coral guard)
      let baseCol = pick(VICE.coralPastels);
      if (baseCol === lastCol) baseCol = VICE.coralPastels[(VICE.coralPastels.indexOf(baseCol) + 1) % VICE.coralPastels.length];
      if (baseCol === prevCol) baseCol = VICE.coralPastels[(VICE.coralPastels.indexOf(baseCol) + 1) % VICE.coralPastels.length];
      prevCol = lastCol; lastCol = baseCol;
      const tex = buildingTexture(baseCol, rr(0.25, 0.42)); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffc873, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.9 });
      mat.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
      if (!G.buildingMats) G.buildingMats = []; G.buildingMats.push(mat);
      const gy = groundH(cx, cz);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, tall, d), mat);
      b.position.set(cx, tall / 2 + gy, cz); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      // stepped deco silhouette, like the seeded beach row
      const sh = rr(1.6, 3);
      const step = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, sh, d * 0.62), mat);
      step.position.set(cx, tall + sh / 2 + gy, cz); step.castShadow = true; scene.add(step);
      // neon trim, registered exactly like the seeded Coral buildings
      const neonCol = pick(VICE.neonTrim);
      const trimMat = new THREE.MeshStandardMaterial({ color: neonCol, emissive: neonCol, emissiveIntensity: 0, roughness: 0.6 });
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.3, d + 0.35), trimMat);
      trim.position.set(cx, tall * 0.84 + gy, cz); trim.castShadow = true; scene.add(trim);
      if (!G.neonTrimMats) G.neonTrimMats = []; G.neonTrimMats.push(trimMat);
      const tg = glowSprite(new THREE.Color(neonCol), 12);
      tg.position.set(cx, tall * 0.84 + gy, cz); tg.material.opacity = 0; scene.add(tg); _signGlows.push(tg);
      // storefront sign + sloped awning on the boulevard-facing facade
      const fz = side.facadeZ;
      if (rnd() < 0.6) {
        const [txt, col] = pick(signsLocal);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, w * 0.7), 3.4), new THREE.MeshBasicMaterial({ map: signTexture(txt, '#101018', col) }));
        sign.position.set(cx, 4.6 + gy, fz + side.faceDir * 0.12);
        if (side.faceDir < 0) sign.rotation.y = Math.PI;
        scene.add(sign);
        const sg = glowSprite(new THREE.Color(col), 13); sg.position.set(cx, 4.6 + gy, fz + side.faceDir * 0.05); sg.material.opacity = 0; scene.add(sg); _signGlows.push(sg);
      }
      const awnMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(pick(['#ff5da2', '#39d5ff', '#ffb35c', '#7dffb0'])), roughness: 0.85 });
      const awn = new THREE.Mesh(new THREE.BoxGeometry(Math.min(15, w * 0.72), 0.15, 2.2), awnMat);
      awn.position.set(cx, 3.6 + gy, fz + side.faceDir * 1.05); awn.rotation.x = side.faceDir * 0.3; awn.castShadow = true; scene.add(awn);
      G.addCollider(cx, cz, w / 2, d / 2, tall);
      counts[side.key]++;
      x += w + rr(1.5, 5); // gaps between neighbours stay <= 5 m
    }
  }
  G.frontageCounts = counts;
  return counts;
}
// 2. Denser palms on both boulevard sidewalks (z=481 / z=509).
function buildBoulevardPalms(G, scene) {
  let added = 0;
  for (let x = -560; x <= 640; x += 20) {
    if (G.roadX.some(r => Math.abs(x - r) < 16)) continue;
    for (const z of [481, 509]) {
      if (v5HitsPoint(G, x, z, 1.5)) continue;
      const palm = makePalm(rr(4.5, 6.5));
      palm.position.set(x, groundH(x, z), z); palm.rotation.y = rr(0, 6.28);
      scene.add(palm); added++;
    }
  }
  G.boulevardPalmsAdded = added;
  return added;
}
// 3. Gather spots: benches + planters (+ vendor stalls on two).
function v5Bench() {
  const grp = new THREE.Group();
  const frameMat = stdMat(0x3a3f45, 0.6, 0.5), woodMat = stdMat(0x8a6844, 0.95);
  for (const s of [-1, 1]) {
    const legF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), frameMat); legF.position.set(s * 0.95, 0.22, 0.28); grp.add(legF);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), frameMat); legB.position.set(s * 0.95, 0.42, -0.28); grp.add(legB);
  }
  for (let i = 0; i < 3; i++) { const slat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.16), woodMat); slat.position.set(0, 0.45, -0.2 + i * 0.22); grp.add(slat); }
  for (let i = 0; i < 2; i++) { const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.05), woodMat); back.position.set(0, 0.68 + i * 0.24, -0.32); back.rotation.x = -0.18; grp.add(back); }
  return v5Cast(grp);
}
function v5Planter() {
  const grp = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), stdMat(0x9a8a72, 1)); box.position.y = 0.28; grp.add(box);
  const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true })); bush.position.y = 0.85; grp.add(bush);
  return v5Cast(grp);
}
function v5VendorStall() {
  const grp = new THREE.Group();
  const poleMat = stdMat(0x6b4a2f, 0.9);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), poleMat);
    pole.position.set(sx * 1.5, 1.25, sz * 0.9); grp.add(pole);
  }
  // striped canopy: coral / white stripes, beach-umbrella colour family
  const canTex = canvasTex(128, 128, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f7f2e6' : '#ff7a6b'; g.fillRect(i * (w / 8), 0, w / 8, h); }
  });
  canTex.wrapS = canTex.wrapT = THREE.RepeatWrapping;
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 2.4), new THREE.MeshStandardMaterial({ map: canTex, roughness: 0.9 }));
  canopy.position.y = 2.55; canopy.rotation.z = 0.06; grp.add(canopy);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.1), stdMat(0xa97e56, 0.95)); counter.position.set(0, 0.45, 0.35); grp.add(counter);
  const crateCols = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b];
  for (let i = 0; i < 4; i++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), stdMat(crateCols[i % 4], 0.9));
    crate.position.set(-1.1 + i * 0.72, 1.1, 0.35); grp.add(crate);
  }
  return v5Cast(grp);
}
function buildGatherSpots(G, scene) {
  const candidates = [
    { x: 100, z: 511, ry: Math.PI, stall: true },   // GS1 boulevard south sidewalk, faces road (-z)
    { x: 300, z: 552, ry: 0, stall: true },          // GS2 boardwalk, faces ocean (+z)
    { x: -60, z: -238, ry: Math.PI, stall: false },  // GS3 RONIN MART apron, faces the mart (-z)
    { x: -210, z: 481, ry: 0, stall: false },        // GS4 boulevard north sidewalk, faces road (+z)
  ];
  G.gatherSpots = [];
  for (const cand of candidates) {
    let placed = null;
    for (let step = 0; step <= 10 && !placed; step++) {
      for (const off of (step === 0 ? [0] : [step * 4, -step * 4])) {
        const x = cand.x + off;
        if (!v5HitsPoint(G, x, cand.z, 2.5)) { placed = x; break; }
      }
    }
    if (placed === null) continue; // no clear spot within +/-40 m: skipped
    const grp = new THREE.Group();
    grp.position.set(placed, groundH(placed, cand.z), cand.z); grp.rotation.y = cand.ry;
    for (const bx of [-1.9, 1.9]) { const bench = v5Bench(); bench.position.set(bx, 0, 0); grp.add(bench); }
    for (const px of [-3.6, 3.6]) { const planter = v5Planter(); planter.position.set(px, 0, 0.25); grp.add(planter); }
    if (cand.stall) {
      const stall = v5VendorStall(); stall.position.set(0, 0, -2.4); grp.add(stall);
      const cos = Math.cos(cand.ry), sin = Math.sin(cand.ry);
      const wx = placed + (0 * cos + -2.4 * sin), wz = cand.z + (-0 * sin + -2.4 * cos);
      G.addCollider(wx, wz, 1.8, 1.2, 2.6); // colliders for stalls only
    }
    scene.add(grp);
    G.gatherSpots.push({ x: placed, z: cand.z, ry: cand.ry, stall: cand.stall });
  }
  return G.gatherSpots;
}
// 4. Hoshino rows: continuous house rows flanking the z=-330 road.
function buildHoshinoRows(G, scene) {
  let added = 0;
  const rows = [{ z: -378, face: 1 }, { z: -284, face: -1 }];
  for (const row of rows) {
    for (let x = -520; x <= -180; x += 24) {
      if (Math.abs(x + 495) < 15 || Math.abs(x + 330) < 15) continue; // cross streets
      if (v5HitsFootprint(G, x, row.z, 6, 5, 2)) continue;
      buildHouse(G, scene, x, row.z, row.face);
      added++;
    }
  }
  G.hoshinoHousesAdded = added;
  return added;
}
let streetlights = [];
export function buildWorld(G) {
  const scene = G.scene;
  G.roadX = [-660, -495, -330, -165, 0, 165, 330, 495, 660];
  G.roadZ = [-660, -495, -330, -165, 0, 165, 330, 495, 660];
  G.touge = TOUGE_POINTS.map(p => ({ x: p[0], z: p[1] }));
  streetlights = [];
  _signGlows = []; _lastSkyT = -10;
  // gradient sky dome (redrawn cheaply by updateWorld when the hour moves)
  _skyCanvas = document.createElement('canvas'); _skyCanvas.width = 16; _skyCanvas.height = 512;
  _skyCtx = _skyCanvas.getContext('2d');
  _skyTex = new THREE.CanvasTexture(_skyCanvas); _skyTex.colorSpace = THREE.SRGBColorSpace;
  skyColorsAt(G.timeOfDay || 10.5); drawSkyDome();
  _skyDome = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), new THREE.MeshBasicMaterial({ map: _skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  _skyDome.renderOrder = -1; scene.add(_skyDome);
  scene.fog = new THREE.Fog(0xcfe4ec, 220, 1500);
  // land
  const gt = groundTexture(); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(40, 40);
  if (G.maxAniso) gt.anisotropy = G.maxAniso; // V5 anisotropy
  const land = new THREE.Mesh(new THREE.PlaneGeometry(1320, 1320), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
  land.rotation.x = -Math.PI / 2; land.receiveShadow = true; scene.add(land);
  // hill mesh under touge
  const hillGeo = new THREE.PlaneGeometry(700, 700, 24, 24);
  { const p = hillGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) - 330, z = -(p.getY(i)) - 330; p.setZ(i, groundH(x, z)); } hillGeo.computeVertexNormals(); }
  const hill = new THREE.Mesh(hillGeo, grassMat(28, 28)); // Vice: saturated grass hill, not olive
  hill.rotation.x = -Math.PI / 2; hill.position.set(-330, 0.02, -330); hill.receiveShadow = true; scene.add(hill);
  // water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x1d6fb8, transparent: true, opacity: 0.95, roughness: 0.3, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water); G.water = water;
  // beach — Vice: bright warm sand texture (boardwalk strip sits on top)
  const sandTex = sandTexture(); sandTex.repeat.set(66, 5);
  if (G.maxAniso) sandTex.anisotropy = G.maxAniso;
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1320, 100), new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.03, 610); beach.receiveShadow = true; scene.add(beach);
  // ---- Vice per-zone ground overlays (y .015-.02: above base land at 0,
  // below roads .05 / sidewalks .06 / markings .07+; layout + colliders
  // untouched). Coral + Neon Mile + Portside blocks read as paving-slab
  // plazas, Hoshino Heights as saturated grass — no camera-facing ground
  // is left as a flat dirt plane, beach boulevard foreground included.
  {
    const zonePlane = (cx, cz, mat) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(660, 660), mat);
      p.rotation.x = -Math.PI / 2; p.position.set(cx, 0.018, cz); p.receiveShadow = true; scene.add(p);
    };
    // Vice V3: repeat 55 over a 660 m plane = 12 m tiles / 6 m slabs —
    // huge at street level. 66 tightens that to 10 m tiles / 5 m slabs.
    const paveA = pavingTexture(); paveA.repeat.set(66, 66);
    if (G.maxAniso) paveA.anisotropy = G.maxAniso;
    zonePlane(330, 330, new THREE.MeshStandardMaterial({ map: paveA, roughness: 1 }));   // Coral Strip
    const paveB = pavingTexture(); paveB.repeat.set(66, 66);
    if (G.maxAniso) paveB.anisotropy = G.maxAniso;
    zonePlane(330, -330, new THREE.MeshStandardMaterial({ map: paveB, roughness: 1 }));  // Neon Mile / downtown
    const paveC = pavingTexture(); paveC.repeat.set(66, 66);
    if (G.maxAniso) paveC.anisotropy = G.maxAniso;
    zonePlane(-330, 330, new THREE.MeshStandardMaterial({ map: paveC, roughness: 1 }));  // Portside
    // Hoshino Heights needs no overlay: the hill mesh covers that whole
    // quadrant and now carries the grass texture, as do the house yards.
  }
  // roads
  // S16 marked asphalt: texture U = across the road, V = along its length.
  // 4-lane cross-section: solid edge lines, dashed lane dividers at U .25/.75
  // (dash fills 45% of the V tile, so it tiles seamlessly), double solid
  // pale-yellow centre lines. Speckle/crack noise over the base as before.
  const dashTex = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = '#33373c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const v = 40 + Math.floor(rnd() * 36); g.fillStyle = `rgba(${v},${v},${v + 4},.18)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    for (let i = 0; i < 130; i++) { g.fillStyle = 'rgba(255,255,255,.045)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = 1;
    for (let i = 0; i < 7; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let s = 0; s < 3; s++) { x += rr(-9, 9); y += rr(4, 14); g.lineTo(x, y); } g.stroke(); }
    const line = (u, col, wU) => { g.fillStyle = col; const lw = Math.max(1, w * wU); g.fillRect(w * u - lw / 2, 0, lw, h); };
    line(0.03, '#d8d8d2', 0.012); line(0.97, '#d8d8d2', 0.012); // edge lines
    line(0.478, '#e8d9a0', 0.008); line(0.522, '#e8d9a0', 0.008); // double centre
    g.fillStyle = '#ffffff'; // lane divider dashes: filled 45% of the V tile
    for (const u of [0.25, 0.75]) { const lw = Math.max(1, w * 0.010); g.fillRect(w * u - lw / 2, 0, lw, h * 0.45); }
  });
  dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
  if (G.maxAniso) dashTex.anisotropy = G.maxAniso; // clones below inherit it
  const roadMat = new THREE.MeshStandardMaterial({ map: dashTex, roughness: 0.95 });
  const plainRoadMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.95 });
  // Vice: sidewalks use the paving-slab texture, tiled along their length
  const swTexV = pavingTexture(); swTexV.repeat.set(1, 110);
  if (G.maxAniso) swTexV.anisotropy = G.maxAniso;
  const swMat = new THREE.MeshStandardMaterial({ map: swTexV, roughness: 1 });
  const swTexH = pavingTexture(); swTexH.repeat.set(110, 1);
  if (G.maxAniso) swTexH.anisotropy = G.maxAniso;
  const swMatH = new THREE.MeshStandardMaterial({ map: swTexH, roughness: 1 });
  for (const x of G.roadX) {
    const t = dashTex.clone(); t.needsUpdate = true; t.repeat.set(1, 44);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, 1320), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, 0); r.receiveShadow = true; scene.add(r);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), swMat); sw.position.set(x + s * (CFG.roadW / 2 + 1.5), 0.06, 0); sw.receiveShadow = true; scene.add(sw); }
  }
  for (const z of G.roadZ) {
    // rotation.z = PI/2 on these planes transposes the texture axes (plane
    // U runs along the road, V across), so rotate the texture back: with
    // rotation PI/2 about the centre, repeat (1,44) lands as 1 tile across
    // and 44 along the length — same density/orientation as the X roads.
    const t = dashTex.clone(); t.needsUpdate = true; t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 44);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1320, CFG.roadW), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, z); r.rotation.z = Math.PI / 2; r.receiveShadow = true; scene.add(r);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), swMatH); sw.position.set(0, 0.06, z + s * (CFG.roadW / 2 + 1.5)); sw.receiveShadow = true; scene.add(sw); }
  }
  void roadMat; void plainRoadMat;
  // crosswalks: one InstancedMesh of zebra bars at every grid intersection
  {
    const barsPerSide = 5, sides = 4;
    const count = G.roadX.length * G.roadZ.length * sides * barsPerSide;
    const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xf2efe4, roughness: 0.9 }), count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), v = new THREE.Vector3(), sc = new THREE.Vector3();
    const off = CFG.roadW / 2 + 3.5, span = CFG.roadW / 6;
    let idx = 0;
    for (const cx of G.roadX) for (const cz of G.roadZ) {
      for (let i = 0; i < barsPerSide; i++) {
        const s = -2 * span + i * span;
        v.set(cx + s, 0.07, cz - off); sc.set(2.4, 6, 1); inst.setMatrixAt(idx++, m4.compose(v, q, sc));
        v.set(cx + s, 0.07, cz + off); inst.setMatrixAt(idx++, m4.compose(v, q, sc));
        v.set(cx - off, 0.07, cz + s); sc.set(6, 2.4, 1); inst.setMatrixAt(idx++, m4.compose(v, q, sc));
        v.set(cx + off, 0.07, cz + s); inst.setMatrixAt(idx++, m4.compose(v, q, sc));
      }
    }
    inst.instanceMatrix.needsUpdate = true; scene.add(inst);
  }
  // ---- F1 road markings: flat geometry derived from the SAME grid +
  // touge data the roads and minimap use. Six InstancedMeshes total
  // (centre dashes, lane-divider dashes, edge lines, stop lines, touge
  // dashes, touge edge strips) in two shared materials, at y .08-.13 —
  // above the asphalt (.05) and the zebra bars (.07), so no z-fighting.
  {
    const HW = CFG.roadW / 2;
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.85 });
    const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf7d154, roughness: 0.85 });
    const centre = [], lane = [], edge = [], stop = [], tDash = [], tEdge = [];
    const nearInter = (v, arr) => arr.some(a => Math.abs(v - a) < HW + 9);
    for (const x of G.roadX) {
      for (let z = -648; z <= 648; z += 12) {
        if (nearInter(z, G.roadZ)) continue;
        centre.push({ x, z: z + 3, sx: 0.4, sy: 6 });
        lane.push({ x: x - 7.5, z: z + 2, sx: 0.3, sy: 4.5 });
        lane.push({ x: x + 7.5, z: z + 2, sx: 0.3, sy: 4.5 });
      }
      for (let i = 0; i < G.roadZ.length - 1; i++) {
        const z0 = G.roadZ[i] + HW, z1 = G.roadZ[i + 1] - HW;
        edge.push({ x: x - HW + 0.8, z: (z0 + z1) / 2, sx: 0.3, sy: z1 - z0 });
        edge.push({ x: x + HW - 0.8, z: (z0 + z1) / 2, sx: 0.3, sy: z1 - z0 });
      }
    }
    for (const z of G.roadZ) {
      for (let x = -648; x <= 648; x += 12) {
        if (nearInter(x, G.roadX)) continue;
        centre.push({ x: x + 3, z, sx: 6, sy: 0.4 });
        lane.push({ x: x + 2, z: z - 7.5, sx: 4.5, sy: 0.3 });
        lane.push({ x: x + 2, z: z + 7.5, sx: 4.5, sy: 0.3 });
      }
      for (let i = 0; i < G.roadX.length - 1; i++) {
        const x0 = G.roadX[i] + HW, x1 = G.roadX[i + 1] - HW;
        edge.push({ x: (x0 + x1) / 2, z: z - HW + 0.8, sx: x1 - x0, sy: 0.3 });
        edge.push({ x: (x0 + x1) / 2, z: z + HW - 0.8, sx: x1 - x0, sy: 0.3 });
      }
    }
    // stop lines on all four approaches of every (signalised) intersection,
    // just before the zebra band (bars at HW+3.5, half-span 3 -> outer 21.5)
    for (const cx of G.roadX) for (const cz of G.roadZ) {
      const o = HW + 8.5;
      stop.push({ x: cx - 7, z: cz + o, sx: 13, sy: 0.55 });
      stop.push({ x: cx + 7, z: cz - o, sx: 13, sy: 0.55 });
      stop.push({ x: cx + o, z: cz - 7, sx: 0.55, sy: 13 });
      stop.push({ x: cx - o, z: cz + 7, sx: 0.55, sy: 13 });
    }
    // touge: centre dashes + edge strips following the polyline segments
    for (let i = 0; i < G.touge.length - 1; i++) {
      const a = G.touge[i], b = G.touge[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 0.001;
      const ux = dx / len, uz = dz / len, px = -uz, pz = ux;
      const ry = Math.atan2(-ux, -uz);
      for (let dd = 4; dd < len; dd += 9) {
        const t = dd / len, x = a.x + dx * t, z = a.z + dz * t;
        tDash.push({ x, z, ry, sx: 0.35, sy: 3.2, y: groundH(x, z) + 0.12 });
      }
      for (const s of [-1, 1]) {
        const mx2 = (a.x + b.x) / 2 + px * s * 4.05, mz2 = (a.z + b.z) / 2 + pz * s * 4.05;
        const y0 = groundH(a.x + px * s * 4.05, a.z + pz * s * 4.05);
        const y1 = groundH(b.x + px * s * 4.05, b.z + pz * s * 4.05);
        tEdge.push({ x: mx2, z: mz2, ry: Math.atan2(ux, uz), sx: 0.28, sz: len, y: Math.max(y0, y1) + 0.13 });
      }
    }
    const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const mkPlanes = (list, mat) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      list.forEach((t, i) => {
        if (t.ry) { qy.setFromEuler(new THREE.Euler(0, t.ry, 0)); q.copy(qy).multiply(qFlat); } else q.copy(qFlat);
        inst.setMatrixAt(i, m4.compose(v.set(t.x, t.y || 0.08, t.z), q, sc.set(t.sx, t.sy, 1)));
      });
      inst.instanceMatrix.needsUpdate = true; scene.add(inst);
    };
    const mkBoxes = (list, mat) => {
      if (!list.length) return;
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      list.forEach((t, i) => {
        q.setFromEuler(new THREE.Euler(0, t.ry || 0, 0));
        inst.setMatrixAt(i, m4.compose(v.set(t.x, t.y || 0.08, t.z), q, sc.set(t.sx, 0.05, t.sz)));
      });
      inst.instanceMatrix.needsUpdate = true; scene.add(inst);
    };
    mkPlanes(centre, yellowMat);
    mkPlanes(lane, whiteMat);
    mkPlanes(edge, whiteMat);
    mkPlanes(stop, whiteMat);
    mkPlanes(tDash, whiteMat);
    mkBoxes(tEdge, whiteMat);
  }
  // ---- S16 traffic lights: two signal poles at diagonal corners of every
  // intersection (NE pole = X-axis head, discs facing +x; SW pole = Z-axis
  // head, discs facing +z). Poles: one merged geometry, one InstancedMesh.
  // Lamps: 12 InstancedMeshes (3 colours x on/off x 2 axes); the cycle only
  // toggles .visible at phase changes. Cycle: NS green 5.5s, NS yellow 1.5s,
  // all-red 0.75s, EW green 5.5s, EW yellow 1.5s, all-red 0.75s (15.5s loop).
  {
    const mergeGeos = (geos) => {
      let vtx = 0, idx = 0;
      for (const g of geos) { vtx += g.attributes.position.count; idx += g.index.count; }
      const pos = new Float32Array(vtx * 3), nor = new Float32Array(vtx * 3), uv = new Float32Array(vtx * 2);
      const ind = new Uint32Array(idx);
      let vo = 0, io = 0;
      for (const g of geos) {
        pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, vo * 2);
        for (let i = 0; i < g.index.count; i++) ind[io + i] = g.index.getX(i) + vo;
        vo += g.attributes.position.count; io += g.index.count;
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      out.setIndex(new THREE.BufferAttribute(ind, 1));
      return out;
    };
    // canonical pole: arm reaches toward +z, head box at its end
    const poleGeo = mergeGeos([
      new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8).translate(0, 2.3, 0),
      new THREE.BoxGeometry(0.12, 0.12, 1.0).translate(0, 4.5, 0.5),
      new THREE.BoxGeometry(0.34, 0.9, 0.3).translate(0, 4.15, 0.95),
    ]);
    const poleMat2 = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.6, metalness: 0.6 });
    const intersections = [];
    for (const cx of G.roadX) for (const cz of G.roadZ) intersections.push([cx, cz]);
    const poles = new THREE.InstancedMesh(poleGeo, poleMat2, intersections.length * 2);
    const lampGeo = new THREE.CircleGeometry(0.11, 12);
    const ON_COL = [0xff2a1e, 0xffb020, 0x2aff5a]; // red, yellow, green
    const lampMeshes = { x: [], z: [] }; // per colour: { on, off }
    for (const axis of ['x', 'z']) for (let ci = 0; ci < 3; ci++) {
      const on = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: ON_COL[ci] }), intersections.length);
      const off = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x1a1c1e }), intersections.length);
      lampMeshes[axis].push({ on, off }); scene.add(on); scene.add(off);
    }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
    let pi = 0;
    intersections.forEach(([cx, cz], ii) => {
      // [poleX, poleZ, rotY, axis] — rotY 0: arm/head toward +z; PI/2: toward +x
      for (const [px, pz, ry, axis] of [[cx + 13, cz + 13, Math.PI / 2, 'x'], [cx - 13, cz - 13, 0, 'z']]) {
        q.setFromEuler(e.set(0, ry, 0));
        poles.setMatrixAt(pi++, m4.compose(pv.set(px, 0, pz), q, one));
        const cos = Math.cos(ry), sin = Math.sin(ry);
        for (let ci = 0; ci < 3; ci++) {
          const ly = 4.15 + [0.28, 0, -0.28][ci], lz = 1.11; // lamp disc on the head face
          const wx = px + lz * sin, wz = pz + lz * cos; // RotY applied to (0, ly, lz)
          const lm = m4.compose(pv.set(wx, ly, wz), q, one);
          lampMeshes[axis][ci].on.setMatrixAt(ii, lm);
          lampMeshes[axis][ci].off.setMatrixAt(ii, lm);
        }
      }
    });
    poles.instanceMatrix.needsUpdate = true; scene.add(poles);
    for (const axis of ['x', 'z']) for (const s of lampMeshes[axis]) { s.on.instanceMatrix.needsUpdate = true; s.off.instanceMatrix.needsUpdate = true; }
    // cycle state
    let lightT = 0, phase = -1, curX = 'red', curZ = 'green';
    const applyLights = () => {
      for (const [axis, st] of [['x', curX], ['z', curZ]]) {
        const active = st === 'red' ? 0 : st === 'yellow' ? 1 : 2;
        lampMeshes[axis].forEach((s, ci) => { s.on.visible = ci === active; s.off.visible = ci !== active; });
      }
    };
    applyLights();
    G.lightState = (axis) => (axis === 'x' ? curX : curZ);
    G.updaters.push((G2, dt) => {
      lightT = (lightT + dt) % 15.5;
      let ph, nx = 'red', nz = 'red';
      if (lightT < 5.5) { ph = 0; nz = 'green'; }
      else if (lightT < 7) { ph = 1; nz = 'yellow'; }
      else if (lightT < 7.75) { ph = 2; }
      else if (lightT < 13.25) { ph = 3; nx = 'green'; }
      else if (lightT < 14.75) { ph = 4; nx = 'yellow'; }
      else { ph = 5; }
      if (ph !== phase) { phase = ph; curX = nx; curZ = nz; applyLights(); }
    });
  }
  // buildings
  const bases = ['#8d99ae', '#a39a8b', '#b08968', '#94867a', '#9c7bb5', '#6d8ea0']; // Vice: mid-tone fallback, no near-black
  const pastels = VICE.coralPastels; // Vice: HIGH-saturation beach deco pastels, a hue per building
  // per-district facade palettes (neighbors never repeat — see lastBase)
  const DISTRICT_PALS = {
    neon: VICE.downtown, // Vice: downtown lifted to varied mid-tone brick/glass/concrete
    coral: VICE.coralPastels, // Vice: Coral uses the same saturated pastel list as the beach row
    port: ['#8a7f6a', '#6b7a72', '#a08a68', '#5f8d7d', '#94867a', '#7f9bb3'],
    hoshino: ['#9aa0a6', '#a39a8b', '#7d9a7a', '#b09872', '#6d8ea0', '#9a8a72'],
  };
  let lastBase = null, prevBase = null; // no-repeat guard (extended below for Coral/beach)
  const signs = [['RAMEN', '#ff5c39'], ['CLUB NEON', '#e879ff'], ['TURBO PARTS', '#57b7ff'], ['HOTEL CORAL', '#ffb35c'], ['PAWN', '#ffe14d'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0']];
  const posters = ['RONIN KAI', 'TURBO MAX', 'BAY COLA'];
  for (let bx = 0; bx < 8; bx++) for (let bz = 0; bz < 8; bz++) {
    const cx = -577.5 + bx * 165, cz = -577.5 + bz * 165;
    const district = DISTRICTS.reduce((a, d) => ((cx - d.cx) ** 2 + (cz - d.cz) ** 2 < (cx - a.cx) ** 2 + (cz - a.cz) ** 2 ? d : a), DISTRICTS[0]);
    // F1: Hoshino Heights blocks near the district centre are residential —
    // houses instead of towers. Towers concentrate in Neon Mile (downtown);
    // Portside drops to mid-rise.
    if (district.id === 'hoshino' && Math.hypot(cx - district.cx, cz - district.cz) < 250) { buildResidentialBlock(G, scene, cx, cz); continue; }
    const isBeach = cz > 500; // F1: beachfront row = neon-coastal deco strip
    const n = ri(2, 4);
    for (let i = 0; i < n; i++) {
      const w = rr(22, 44), d = rr(22, 44);
      const tall = isBeach ? rr(8, 20) : district.id === 'neon' ? rr(24, 60) : district.id === 'hoshino' ? rr(8, 22) : district.id === 'port' ? rr(8, 20) : rr(10, 28);
      const x = cx + rr(-48, 48), z = cz + rr(-48, 48);
      if (Math.abs(x + 412.5) < 60 && Math.abs(z - 412.5) < 60) continue;
      if (Math.abs(x - MARKET.x) < 54 && Math.abs(z - MARKET.z) < 76) continue; // RONIN MART lot
      const palArr = isBeach ? pastels : (DISTRICT_PALS[district.id] || bases);
      let baseCol = pick(palArr);
      if (baseCol === lastBase) baseCol = palArr[(palArr.indexOf(baseCol) + 1) % palArr.length];
      // Vice guard extension: the check above DOES cover Coral (it runs for
      // every palette), but only against the single previous building and
      // beach rows share the Coral pastel list — so for Coral / beachfront
      // also reject the colour used two buildings ago, keeping neighbouring
      // pastel facades from ever matching in a run.
      if ((district.id === 'coral' || isBeach) && baseCol === prevBase) baseCol = palArr[(palArr.indexOf(baseCol) + 1) % palArr.length];
      prevBase = lastBase; lastBase = baseCol;
      const tex = buildingTexture(baseCol, rr(0.18, 0.42)); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffc873, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.9 });
      mat.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98)); // subtle warm per-building tint
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, tall, d), mat);
      b.position.set(x, tall / 2 + groundH(x, z), z); b.castShadow = true; b.receiveShadow = true; scene.add(b);
      if (!G.buildingMats) G.buildingMats = []; G.buildingMats.push(mat);
      G.addCollider(x, z, w / 2, d / 2, tall);
      if (isBeach) { // F1 deco dressing: stepped silhouette
        const sh = rr(1.6, 3);
        const step = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, sh, d * 0.62), mat);
        step.position.set(x, tall + sh / 2 + groundH(x, z), z); step.castShadow = true; scene.add(step);
      }
      if (isBeach || district.id === 'coral') { // Vice: neon trim on ALL Coral facades (cyan/magenta family)
        const neonCol = pick(VICE.neonTrim);
        const trimMat = new THREE.MeshStandardMaterial({ color: neonCol, emissive: neonCol, emissiveIntensity: 0, roughness: 0.6 });
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, 0.3, d + 0.35), trimMat);
        trim.position.set(x, tall * 0.84 + groundH(x, z), z); trim.castShadow = true; scene.add(trim);
        if (!G.neonTrimMats) G.neonTrimMats = []; G.neonTrimMats.push(trimMat); // updateWorld: dusk ramp from VICE.dusk.neonOnset, full by VICE.dusk.full
        const tg = glowSprite(new THREE.Color(neonCol), 12);
        tg.position.set(x, tall * 0.84 + groundH(x, z), z); tg.material.opacity = 0; scene.add(tg); _signGlows.push(tg);
      }
      if (rnd() < 0.3) { // rooftop prop
        const prop = new THREE.Mesh(new THREE.BoxGeometry(rr(2, 4), rr(1, 2), rr(2, 4)), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
        prop.position.set(x + rr(-6, 6), tall + 0.8, z + rr(-6, 6)); scene.add(prop);
      }
      if (rnd() < 0.22) { // billboard
        const pt = signTexture(pick(posters), '#14161c', '#ffb35c');
        // Vice V3 sign fix: a single DoubleSide plane showed the poster
        // MIRRORED from behind (the reversed "BAY COLA" in 4-hero.jpg).
        // Use two FrontSide panels back-to-back instead: the front panel
        // as before, plus a rear panel turned PI so its own front faces
        // the opposite way, nudged 0.06 behind along the front normal —
        // the text now reads correctly from BOTH sides, never reversed.
        const bbGeo = new THREE.PlaneGeometry(14, 4);
        const bbMat = new THREE.MeshBasicMaterial({ map: pt, side: THREE.FrontSide });
        const bbRot = rr(0, Math.PI);
        const bb = new THREE.Mesh(bbGeo, bbMat);
        bb.position.set(x, tall + 4, z); bb.rotation.y = bbRot; scene.add(bb);
        const bbBack = new THREE.Mesh(bbGeo, bbMat);
        bbBack.position.set(x - Math.sin(bbRot) * 0.06, tall + 4, z - Math.cos(bbRot) * 0.06);
        bbBack.rotation.y = bbRot + Math.PI; scene.add(bbBack);
      }
      // storefront on neon/coral ground floor (and the beach deco strip)
      if ((district.id === 'neon' || district.id === 'coral' || isBeach) && rnd() < (isBeach ? 0.75 : 0.6)) {
        const [txt, col] = pick(signs);
        const st = signTexture(txt, '#101018', col);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.4), new THREE.MeshBasicMaterial({ map: st }));
        sign.position.set(x, 4.6, z + d / 2 + 0.1); scene.add(sign);
        const sg = glowSprite(new THREE.Color(col), 13); sg.position.set(x, 4.6, z + d / 2 + 0.02); sg.material.opacity = 0; scene.add(sg); _signGlows.push(sg);
        const awn = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 2.2), new THREE.MeshStandardMaterial({ color: new THREE.Color(col) }));
        awn.position.set(x, 3.6, z + d / 2 + 1); awn.rotation.x = 0.3; scene.add(awn);
      }
    }
  }
  // streetlights — F7: dense citywide rhythm. Mains (x=0, x=330 Neon,
  // z=0, z=495 Coral boulevard) get BOTH sides every ~45 m; other
  // streets staggered single-side every ~55 m; plus a cool-white
  // boardwalk row on the beach strip. Poles / emissive heads / ground
  // pools are three InstancedMeshes total; glow sprites only on mains
  // + boardwalk. No real light sources added (lighting rig unchanged).
  {
    const lampPos = [];
    const skipInter = (v, arr) => arr.some(a => Math.abs(v - a) < 21);
    const hitsB = (x, z) => G.colliders.some(c => Math.abs(x - c.x) < c.hw + 1 && Math.abs(z - c.z) < c.hd + 1);
    for (const x of G.roadX) {
      const main = x === 0 || x === 330;
      let k = 0;
      for (let z = -615; z <= 615; z += main ? 45 : 55, k++) {
        if (skipInter(z, G.roadZ)) continue;
        if (main) { lampPos.push({ x: x - 17, z, glow: 1 }); lampPos.push({ x: x + 17, z: z + 22, glow: 1 }); }
        else lampPos.push({ x: x + (k % 2 === 0 ? 17 : -17), z, glow: 0 });
      }
    }
    for (const z of G.roadZ) {
      const main = z === 0 || z === 495;
      let k = 0;
      for (let x = -615; x <= 615; x += main ? 45 : 55, k++) {
        if (skipInter(x, G.roadX)) continue;
        if (main) { lampPos.push({ x, z: z - 17, glow: 1 }); lampPos.push({ x: x + 22, z: z + 17, glow: 1 }); }
        else lampPos.push({ x, z: z + (k % 2 === 0 ? 17 : -17), glow: 0 });
      }
    }
    for (let x = -440; x <= 640; x += 55) {
      if (hitsB(x, 552)) continue;
      lampPos.push({ x, z: 552, glow: 2 });
    }
    const nL = lampPos.length;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8, metalness: 0.5 });
    const m4 = new THREE.Matrix4();
    const poleInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat, nL);
    lampPos.forEach((p, i) => { m4.makeTranslation(p.x, 3, p.z); poleInst.setMatrixAt(i, m4); });
    poleInst.instanceMatrix.needsUpdate = true; scene.add(poleInst);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc98a, emissiveIntensity: 0.15, roughness: 0.5 });
    const headInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), headMat, nL);
    lampPos.forEach((p, i) => { m4.makeTranslation(p.x, 6.02, p.z); headInst.setMatrixAt(i, m4); });
    headInst.instanceMatrix.needsUpdate = true; scene.add(headInst);
    const poolMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const poolInst = new THREE.InstancedMesh(new THREE.CircleGeometry(5.5, 20), poolMat, nL);
    const qFlat2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const v3 = new THREE.Vector3(), one3 = new THREE.Vector3(1, 1, 1);
    lampPos.forEach((p, i) => { poolInst.setMatrixAt(i, m4.compose(v3.set(p.x, 0.09, p.z), qFlat2, one3)); });
    poolInst.instanceMatrix.needsUpdate = true; scene.add(poolInst);
    for (const p of lampPos) {
      if (!p.glow) continue;
      const gl = glowSprite(p.glow === 2 ? 0xcfe6ff : 0xffd9a0, p.glow === 2 ? 5 : 5.5);
      gl.position.set(p.x, 6, p.z); gl.material.opacity = 0; scene.add(gl); streetlights.push(gl);
    }
    G.lampHeadMat = headMat;
    G.lampPoolMat = poolMat;
  }
  G.streetlightGlows = streetlights;
  G.signGlows = _signGlows;
  // HQ
  buildHQ(G, scene);
  // F1: RONIN MART supermarket + landmarks for the pause map / minimap
  buildMarket(G, scene);
  buildBeachStrip(G, scene);
  G.landmarks = {
    market: { x: MARKET.x, z: MARKET.z, name: MARKET.name },
    garage: { x: G.hq.x, z: G.hq.garage.z, name: 'RONIN KAI HQ' },
    districts: [
      { name: 'Downtown', x: 0, z: 0 },
      { name: 'Portside', x: -330, z: 330 },
      { name: 'Coral Strip', x: 330, z: 330 },
      { name: 'Neon Mile', x: 330, z: -330 },
      { name: 'Hoshino Heights', x: -330, z: -330 },
      { name: 'Touge', x: -330, z: -470 },
    ],
  };
  // harbor
  buildHarbor(G, scene);
  // touge ribbon
  buildTouge(G, scene);
  // trees
  let treeCount = 0;
  for (let i = 0; i < 400 && treeCount < 250; i++) {
    const x = rr(-640, 640), z = rr(-640, 640);
    if (G.roadX.some(rx => Math.abs(x - rx) < 22) || G.roadZ.some(rz => Math.abs(z - rz) < 22)) continue;
    if (Math.abs(x + 412.5) < 55 && Math.abs(z - 412.5) < 55) continue;
    if (Math.abs(x - MARKET.x) < 58 && Math.abs(z - MARKET.z) < 78) continue; // RONIN MART lot
    const district = DISTRICTS.reduce((a, d) => ((x - d.cx) ** 2 + (z - d.cz) ** 2 < (x - a.cx) ** 2 + (z - a.cz) ** 2 ? d : a), DISTRICTS[0]);
    let tree;
    if (district.id === 'coral' || z > 520 || district.id === 'neon') tree = makePalm(rr(4.5, 6.5));
    else if (district.id === 'hoshino') tree = makeShadeTree(rr(3.5, 5), rnd() < 0.3 ? 0xe8a0bf : 0x3d8b4f);
    else tree = makeShadeTree(rr(3.5, 5.5), 0x3d8b4f);
    tree.position.set(x, groundH(x, z), z); tree.rotation.y = rr(0, 6.28); scene.add(tree); treeCount++;
  }
  // ---- S7a props density (seeded, off-road) ----
  {
    const palmOff = CFG.roadW / 2 + 3.8;
    let addedPalms = 0;
    for (let x = -600; x <= 600 && addedPalms < 72; x += 40) {
      for (const s of [-1, 1]) {
        const palm = makePalm(rr(4.5, 6.5));
        palm.position.set(x + rr(-2, 2), groundH(x, 495 + s * palmOff), 495 + s * palmOff);
        palm.rotation.y = rr(0, 6.28); scene.add(palm); addedPalms++;
      }
    }
    for (let z = -595; z <= 95 && addedPalms < 82; z += 70) {
      const palm = makePalm(rr(4.5, 6.5));
      palm.position.set(330 + palmOff, groundH(330 + palmOff, z), z + rr(-2, 2));
      palm.rotation.y = rr(0, 6.28); scene.add(palm); addedPalms++;
    }
    // port crates with hazard stripes
    const hazardTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#8a7a3a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#2b2b2b';
      for (let i = -2; i < 8; i++) { g.save(); g.translate(i * 32, 0); g.rotate(0.6); g.fillRect(0, -40, 14, h + 80); g.restore(); }
      g.fillStyle = 'rgba(255,255,255,.75)'; g.fillRect(14, 44, 100, 40);
      g.fillStyle = '#333'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('CARGO', 64, 72);
    });
    const crateMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 });
    const crateGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    for (let i = 0; i < 12; i++) {
      const cxp = -625 + (i % 4) * 36 + rr(-3, 3), czp = 532 + Math.floor(i / 4) * 30 + rr(-3, 3);
      const crate = new THREE.Mesh(crateGeo, crateMat); crate.position.set(cxp, 1.1, czp); crate.rotation.y = rr(0, 0.6); scene.add(crate);
      if (i % 3 === 0) { const top = new THREE.Mesh(crateGeo, crateMat); top.position.set(cxp, 3.3, czp); top.rotation.y = rr(0, 0.6); scene.add(top); }
    }
    // concrete barriers with orange stripe, along the harbor/HQ approach road
    const barrierTex = canvasTex(128, 32, (g, w, h) => { g.fillStyle = '#b8b4a8'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8762a'; g.fillRect(0, 12, w, 8); });
    const barrierMat = new THREE.MeshStandardMaterial({ map: barrierTex, roughness: 0.95 });
    for (let i = 0; i < 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.5), barrierMat);
      bar.position.set(-560 + i * 40, 0.5, 472); scene.add(bar);
    }
    // dumpsters in Neon Mile block interiors
    const dumpMat = new THREE.MeshStandardMaterial({ color: 0x2e4a34, roughness: 0.85, metalness: 0.2 });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0x223828, roughness: 0.8, metalness: 0.2 });
    for (const [dx, dz] of [[270, -40], [390, 40], [270, -200], [390, -260]]) {
      const dump = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), dumpMat); dump.position.set(dx, 0.7, dz); scene.add(dump);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.5), lidMat); lid.position.set(dx, 1.46, dz); scene.add(lid);
    }
  }
  // ---- V5 density round (B1): called LAST so the seeded RNG order of
  // every builder above is untouched. Frontage first (its colliders then
  // gate the boulevard palms and the gather-spot placement checks).
  buildBoulevardFrontage(G, scene);
  buildBoulevardPalms(G, scene);
  buildGatherSpots(G, scene);
  buildHoshinoRows(G, scene);
  // parks
  for (const [px, pz] of [[412, 412], [-412, -80]]) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x4d8a4a, roughness: 1 }));
    park.rotation.x = -Math.PI / 2; park.position.set(px, 0.04, pz); park.receiveShadow = true; scene.add(park);
    for (let i = 0; i < 4; i++) { const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x7a5a38 })); bench.position.set(px + rr(-35, 35), 0.3, pz + rr(-35, 35)); scene.add(bench); }
    for (let i = 0; i < 4; i++) {
      const planter = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.8), new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1 }));
      planter.position.set(px + rr(-38, 38), 0.3, pz + rr(-38, 38)); scene.add(planter);
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true }));
      bush.position.set(planter.position.x, 0.95, planter.position.z); scene.add(bush);
    }
  }
}
// Tripo garage GLB: its detailed facade (doors) is the model's -Z face and
// its other detailed side is +X. Rotating PI turns -Z to face south (+z,
// toward the apron / garage point / street) and +X to face west (-x,
// toward the harbor road).
const GARAGE_ROT_Y = Math.PI;
function buildHQ(G, scene) {
  const hx = -412.5, hz = 412.5;
  // All procedural HQ building visuals live in hqGroup so the GLB swap can
  // remove them in one step. The apron stays outside the group (below): it
  // is ground surface, not building visual, and must survive the swap.
  const hqGroup = new THREE.Group(); scene.add(hqGroup);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const hq = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 34), wallMat);
  hq.position.set(hx, 5, hz); hqGroup.add(hq);
  // Collider matches the GLB footprint (targetSize 30x30) so collision is
  // identical in procedural and GLB modes.
  G.addCollider(hx, hz, 15, 15, 10);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.6, metalness: 0.6 });
  for (let i = -1; i <= 1; i++) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), doorMat);
    door.position.set(hx + i * 20, 3, hz + 17.2); hqGroup.add(door);
  }
  const st = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#14100c'; g.fillRect(0, 0, 512, 96); g.font = 'bold 58px sans-serif'; g.textAlign = 'center'; g.shadowColor = '#ff7a1a'; g.shadowBlur = 16; g.fillStyle = '#ff7a1a'; g.fillText('RONIN KAI', 256, 66); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial({ map: st }));
  sign.position.set(hx, 8.6, hz + 17.3); hqGroup.add(sign);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb35c, emissiveIntensity: 0.6 });
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), winMat); w.position.set(hx - 28 + i * 14, 7.6, hz - 17.2); w.rotation.y = Math.PI; hqGroup.add(w); }
  // Apron (both modes, stays outside hqGroup): textured asphalt instead
  // of a flat colour — speckle, oil stains, and white parking stalls
  // along its south edge. Canvas note: the plane is rotated -PI/2 about
  // X, so canvas bottom (v=0) maps to the world-south edge of the apron.
  const apronTex = canvasTex(1024, 384, (g, w, h) => {
    g.fillStyle = '#6a6d70'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      const v = 96 + Math.floor(rnd() * 48);
      g.fillStyle = `rgba(${v},${v},${v + 4},.14)`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    for (const [ox, oy, orx, ory] of [[210, 120, 58, 20], [560, 210, 74, 26], [790, 90, 46, 16], [390, 290, 52, 18]]) {
      g.fillStyle = 'rgba(18,18,20,.20)';
      g.beginPath(); g.ellipse(ox, oy, orx, ory, 0.4, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(18,18,20,.12)';
      g.beginPath(); g.ellipse(ox + 14, oy + 6, orx * 0.6, ory * 0.6, 0.4, 0, Math.PI * 2); g.fill();
    }
    // Parking stalls along the south edge (canvas bottom).
    g.strokeStyle = 'rgba(245,245,240,.88)'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(0, h - 108); g.lineTo(w, h - 108); g.stroke();
    for (let x = 32; x <= w - 32; x += 96) {
      g.beginPath(); g.moveTo(x, h - 108); g.lineTo(x, h - 6); g.stroke();
    }
  });
  apronTex.wrapS = apronTex.wrapT = THREE.ClampToEdgeWrapping;
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({ map: apronTex, roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(hx, 0.04, 455); scene.add(apron);
  G.hq = { x: hx, z: hz, garage: { x: hx, z: 455 } };
  // Hero asset: Tripo garage GLB replaces the procedural HQ building when
  // it loads; on null/failure the procedural HQ above stays untouched.
  // S35: the swap is retried (a null load no longer ends it — assets.js
  // evicts null results from its cache, so a re-call refetches) and the
  // wrapper is CLONED like every other GLB swap site in the game (cars,
  // player, peds all clone the shared cached wrapper; this site used to
  // add the cached instance itself). The S13 neon dressing below is
  // untouched: it is added to `placement`, keyed off placement's own
  // position/rotation, never off the loaded wrapper.
  const attemptGarageSwap = (triesLeft) => {
    loadHeroAsset('garage').then((loaded) => {
      try {
        if (!loaded) {
          if (triesLeft > 0) setTimeout(() => attemptGarageSwap(triesLeft - 1), 1500);
          return; // procedural HQ stays until a load lands
        }
        scene.remove(hqGroup);
        const placement = new THREE.Group();
        placement.position.set(hx, groundH(hx, hz), hz);
        placement.rotation.y = GARAGE_ROT_Y;
        placement.add(loaded.clone ? loaded.clone(true) : loaded);
        // Club dressing (GLB mode only): the bare GLB reads as a dark
        // monolith and lost the RONIN KAI identity, so re-dress its
        // world-south face. Sign-side reasoning (verified): placement
        // rotation.y = PI maps a child-local point (x, z) to world
        // offset (-x, -z), so a child at placement-local z = -15.15 sits
        // at world z = hz + 15.15 — the SOUTH face (the wrapper's own
        // facade ended up facing world south through this same PI
        // rotation; the GLB targetSize is 30 deep, so its face is at
        // local |z| = 15 and the sign floats 0.15 proud of it). A plane's
        // front is its local +z; with the parent's PI rotation that
        // would face world north (into the building), so each dressing
        // plane gets rotation.y = PI of its own: its front then points
        // along placement-local -z, which the parent maps to world +z
        // (south, outward) — and the two PI turns cancel, so the sign
        // text reads unmirrored from the street.
        const signTex = (() => {
          const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
          const g = c.getContext('2d');
          g.clearRect(0, 0, 1024, 192);
          g.font = 'italic bold 118px sans-serif'; g.textAlign = 'center';
          g.shadowColor = '#ff4fd8'; g.shadowBlur = 34;
          g.fillStyle = '#ff4fd8';
          g.fillText('RONIN KAI', 512, 122);
          g.shadowBlur = 18; g.fillStyle = '#ff7a1a';
          g.fillRect(212, 148, 600, 14);
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
        })();
        const neonSign = new THREE.Mesh(
          new THREE.PlaneGeometry(14, 2.6),
          new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
        );
        neonSign.position.set(0, 10.8, -15.15); neonSign.rotation.y = Math.PI;
        placement.add(neonSign);
        const stripMat = new THREE.MeshBasicMaterial({ color: 0x39d5ff });
        for (const sx of [-13.5, 13.5]) {
          const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 8), stripMat);
          strip.position.set(sx, 6, -15.15); strip.rotation.y = Math.PI;
          placement.add(strip);
        }
        const signGlow = glowSprite(0xff4fd8, 16);
        signGlow.position.set(0, 10.8, -15.35); signGlow.material.opacity = 0.35;
        placement.add(signGlow);
        scene.add(placement);
      } catch (e) { /* keep procedural HQ */ }
    }).catch(() => { if (triesLeft > 0) setTimeout(() => attemptGarageSwap(triesLeft - 1), 1500); });
  };
  try { attemptGarageSwap(3); } catch (e) { /* keep procedural HQ */ }
}
function buildHarbor(G, scene) {
  const contCols = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98, 0xca6f1e];
  for (let i = 0; i < 26; i++) {
    const x = rr(-620, -480), z = rr(480, 620);
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.4), new THREE.MeshStandardMaterial({ color: pick(contCols), roughness: 0.8 }));
    c.position.set(x, 1.3 + (i % 3) * 2.6, z); c.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2; scene.add(c);
    if (i % 4 === 0) G.addCollider(x, z, 6, 2, 3);
  }
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd97c2b, roughness: 0.7, metalness: 0.4 });
  for (const cx of [-560, -480]) {
    const grp = new THREE.Group();
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), craneMat); leg.position.set(s * 8, 13, 0); grp.add(leg); }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 34), craneMat); boom.position.set(0, 26, 6); grp.add(boom);
    const top = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.4, 1.4), craneMat); top.position.y = 26; grp.add(top);
    grp.position.set(cx, 0, 540); scene.add(grp); G.addCollider(cx, 540, 9, 3, 26);
  }
  const bolMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), bolMat); b.position.set(-640 + i * 16, 0.4, 648); scene.add(b); }
}
function buildTouge(G, scene) {
  // S7a rebuild: every segment quad samples groundH at its OWN four corners,
  // so the ribbon hugs the hill instead of averaging endpoint heights into a slab.
  const raw = TOUGE_POINTS.map(p => ({ x: p[0], z: p[1] }));
  const W = 9, CENT = { x: -330, z: -470 };
  const roadTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#33373d'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    g.fillStyle = '#f0ead0'; g.fillRect(w * 0.03, 0, 3, h); g.fillRect(w * 0.97 - 3, 0, 3, h);
    g.fillRect(w / 2 - 2, 10, 4, 44); // one centre dash per tile (v tile = 8m of road)
  });
  roadTex.wrapS = THREE.ClampToEdgeWrapping; roadTex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb0b6bc, metalness: 0.7, roughness: 0.4 });
  const positions = [], uvs = [], indices = [], postPts = [];
  let cum = 0;
  for (let i = 0; i < raw.length - 1; i++) {
    const a = raw[i], b = raw[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 0.001;
    const ux = dx / len, uz = dz / len, px = -uz, pz = ux; // unit dir + perpendicular
    const corner = (pt, s) => { const cx = pt.x + px * s * (W / 2), cz = pt.z + pz * s * (W / 2); return { x: cx, z: cz, y: groundH(cx, cz) + 0.07 }; };
    const c00 = corner(a, 1), c01 = corner(a, -1), c10 = corner(b, 1), c11 = corner(b, -1);
    const base = positions.length / 3;
    for (const c of [c00, c01, c10, c11]) positions.push(c.x, c.y, c.z);
    uvs.push(0, cum / 8, 1, cum / 8, 0, (cum + len) / 8, 1, (cum + len) / 8);
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    // guardrail on the OUTER side (farther from the loop centroid)
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    const dPlus = Math.hypot(mx + px * 5 - CENT.x, mz + pz * 5 - CENT.z);
    const dMinus = Math.hypot(mx - px * 5 - CENT.x, mz - pz * 5 - CENT.z);
    const s = dPlus >= dMinus ? 1 : -1;
    const o0 = s > 0 ? c00 : c01, o1 = s > 0 ? c10 : c11;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, len), railMat);
    rail.position.set((o0.x + o1.x) / 2, (o0.y + o1.y) / 2 + 0.55, (o0.z + o1.z) / 2);
    rail.lookAt(o1.x, o1.y + 0.55, o1.z); scene.add(rail);
    for (let d = 0; d <= len; d += 8) {
      const t = d / len;
      const qx = a.x + dx * t + px * s * (W / 2 + 0.3), qz = a.z + dz * t + pz * s * (W / 2 + 0.3);
      postPts.push({ x: qx, z: qz, y: groundH(qx, qz) });
    }
    cum += len;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, mat));
  // guardrail posts as one InstancedMesh
  const postInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 6), railMat, Math.max(1, postPts.length));
  {
    const m4 = new THREE.Matrix4();
    postPts.forEach((p, i) => { m4.makeTranslation(p.x, p.y + 0.31, p.z); postInst.setMatrixAt(i, m4); });
    postInst.instanceMatrix.needsUpdate = true;
  }
  scene.add(postInst);
  // cherry trees along the route (12, alternating sides, own ground height)
  for (let k = 0; k < 12; k++) {
    const p = raw[k % raw.length];
    const nxt = raw[Math.min(k + 1, raw.length - 1)];
    const dx = nxt.x - p.x, dz = nxt.z - p.z, L = Math.hypot(dx, dz) || 1;
    const side = k % 2 === 0 ? 1 : -1;
    const tx = p.x + (-dz / L) * side * rr(10, 13), tz = p.z + (dx / L) * side * rr(10, 13);
    const tree = makeShadeTree(rr(3, 4.5), 0xe8a0bf);
    tree.position.set(tx, groundH(tx, tz), tz); tree.rotation.y = rr(0, 6.28); scene.add(tree);
  }
}
export function roadRoute(G, from, to) {
  const snap = (v, arr) => arr.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, arr[0]);
  const fx = snap(from.x, G.roadX), fz = snap(from.z, G.roadZ);
  const tx = snap(to.x, G.roadX), tz = snap(to.z, G.roadZ);
  const pts = [{ x: from.x, z: from.z }, { x: fx, z: from.z }, { x: fx, z: fz }];
  // choose shorter order: x-leg-first vs z-leg-first via corner points
  const cornerA = { x: tx, z: fz }, cornerB = { x: fx, z: tz };
  const dA = Math.abs(tx - fx) + Math.abs(tz - fz), dB = dA;
  void dB;
  pts.push(cornerA, { x: tx, z: tz }, { x: to.x, z: to.z });
  void cornerB;
  // dedupe consecutive
  return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 1);
}
export function updateWorld(G, dt) {
  const t = G.timeOfDay;
  const dayAmt = Math.max(0, Math.min(1, Math.sin(((t - 6) / 12) * Math.PI)));
  const sunset = Math.max(0, 1 - Math.abs(t - 18.2) / 1.6) * (t > 12 ? 1 : 0) + Math.max(0, 1 - Math.abs(t - 6.2) / 1.2) * 0.6;
  skyColorsAt(t);
  if (_skyDome) {
    if (Math.abs(t - _lastSkyT) > 0.05) { drawSkyDome(); _lastSkyT = t; }
  } else {
    G.scene.background = _skyHor;
  }
  if (G.scene.fog) { G.scene.fog.color.copy(_skyFog); }
  if (G.sun) { G.sun.intensity = 0.25 + dayAmt * 1.27; G.sun.color.set(0xffd9b0); const ang = ((t - 6) / 12) * Math.PI; G.sun.position.set(Math.cos(ang) * 300, Math.max(20, Math.sin(ang) * 300), 120); }
  if (G.hemi) { G.hemi.intensity = 0.25 + dayAmt * 0.65; if (G.hemi.color) G.hemi.color.copy(_skyTop).lerp(_warmTint, 0.3); if (G.hemi.groundColor) G.hemi.groundColor.set(0xb09a7a); }
  const night = 1 - dayAmt;
  // Vice dusk glow onset: every lamp pool / lit-window / neon ramp keys off
  // `glow`, which starts at VICE.dusk.onset (17.2, neon trim at 17.0) and
  // is FULL by VICE.dusk.full (17.8) — dusk reads lit, not night-only.
  // After full it stays on through the night; pre-dawn it follows `night`.
  const ramp = (from, to) => Math.max(0, Math.min(1, (t - from) / Math.max(0.001, to - from)));
  const duskGlow = t >= VICE.dusk.onset && t < 24 ? Math.max(ramp(VICE.dusk.onset, VICE.dusk.full), night) : night;
  const neonGlow = t >= VICE.dusk.neonOnset && t < 24 ? Math.max(ramp(VICE.dusk.neonOnset, VICE.dusk.full), night) : night;
  const glow = Math.max(night, duskGlow);
  if (G.buildingMats) for (const m of G.buildingMats) m.emissiveIntensity = glow * 0.7; // lit windows strong by 17.8
  if (G.neonTrimMats) for (const m of G.neonTrimMats) m.emissiveIntensity = neonGlow * 2.4; // Coral neon clearly ON by 17.8
  if (G.streetlightGlows) for (const s of G.streetlightGlows) s.material.opacity = glow * 0.85;
  if (G.lampHeadMat) G.lampHeadMat.emissiveIntensity = 0.15 + glow * 3.0;
  if (G.lampPoolMat) G.lampPoolMat.opacity = glow * 0.3; // pools visible at dusk, not just deep night
  const signDark = Math.min(1, glow * 0.9 + Math.min(1, Math.max(0, sunset)) * 0.35);
  for (const s of _signGlows) s.material.opacity = signDark * 0.9; // Vice: neon reads from dusk onward
  if (G.water) G.water.position.y = -0.4 + Math.sin(G.elapsed || 0) * 0.03;
}
