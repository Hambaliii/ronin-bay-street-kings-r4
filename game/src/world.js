// world.js — RONIN BAY city
import * as THREE from 'three';
import { CFG, DISTRICTS, TOUGE_POINTS } from './config.js';
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
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#b8b0a0'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${120 + ri(0, 60)},${110 + ri(0, 50)},${90 + ri(0, 40)},.16)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(90,80,60,.05)'; g.fillRect(rnd() * 256, rnd() * 256, rr(18, 46), rr(12, 30)); }
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.strokeRect(0, 0, 256, 256);
  });
}
function buildingTexture(base, litRatio) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 14) for (let x = 6; x < w - 6; x += 14) {
      const lit = rnd() < litRatio;
      g.fillStyle = lit ? '#ffd9a0' : '#2c3844'; g.fillRect(x, y, 9, 8);
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
  const land = new THREE.Mesh(new THREE.PlaneGeometry(1320, 1320), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
  land.rotation.x = -Math.PI / 2; scene.add(land);
  // hill mesh under touge
  const hillGeo = new THREE.PlaneGeometry(700, 700, 24, 24);
  { const p = hillGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) - 330, z = -(p.getY(i)) - 330; p.setZ(i, groundH(x, z)); } hillGeo.computeVertexNormals(); }
  const hill = new THREE.Mesh(hillGeo, new THREE.MeshStandardMaterial({ color: 0x6f8f5f, roughness: 1 }));
  hill.rotation.x = -Math.PI / 2; hill.position.set(-330, 0.02, -330); scene.add(hill);
  // water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x1d6fb8, transparent: true, opacity: 0.95, roughness: 0.3, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water); G.water = water;
  // beach
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(1320, 100), new THREE.MeshStandardMaterial({ color: 0xe3cf9e, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.03, 610); scene.add(beach);
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
  const roadMat = new THREE.MeshStandardMaterial({ map: dashTex, roughness: 0.95 });
  const plainRoadMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.95 });
  const swMat = new THREE.MeshStandardMaterial({ color: 0xcfc3ab, roughness: 1 });
  for (const x of G.roadX) {
    const t = dashTex.clone(); t.needsUpdate = true; t.repeat.set(1, 44);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, 1320), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, 0); scene.add(r);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), swMat); sw.position.set(x + s * (CFG.roadW / 2 + 1.5), 0.06, 0); scene.add(sw); }
  }
  for (const z of G.roadZ) {
    // rotation.z = PI/2 on these planes transposes the texture axes (plane
    // U runs along the road, V across), so rotate the texture back: with
    // rotation PI/2 about the centre, repeat (1,44) lands as 1 tile across
    // and 44 along the length — same density/orientation as the X roads.
    const t = dashTex.clone(); t.needsUpdate = true; t.center.set(0.5, 0.5); t.rotation = Math.PI / 2; t.repeat.set(1, 44);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1320, CFG.roadW), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, z); r.rotation.z = Math.PI / 2; scene.add(r);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), swMat); sw.position.set(0, 0.06, z + s * (CFG.roadW / 2 + 1.5)); scene.add(sw); }
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
  const bases = ['#8a8f96', '#a39a8b', '#7d7468', '#94867a', '#9a6a58', '#5a6d7d'];
  const signs = [['RAMEN', '#ff5c39'], ['CLUB NEON', '#e879ff'], ['TURBO PARTS', '#57b7ff'], ['HOTEL CORAL', '#ffb35c'], ['PAWN', '#ffe14d'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0']];
  const posters = ['RONIN KAI', 'TURBO MAX', 'BAY COLA'];
  for (let bx = 0; bx < 8; bx++) for (let bz = 0; bz < 8; bz++) {
    const cx = -577.5 + bx * 165, cz = -577.5 + bz * 165;
    const district = DISTRICTS.reduce((a, d) => ((cx - d.cx) ** 2 + (cz - d.cz) ** 2 < (cx - a.cx) ** 2 + (cz - a.cz) ** 2 ? d : a), DISTRICTS[0]);
    const n = ri(2, 4);
    for (let i = 0; i < n; i++) {
      const w = rr(22, 44), d = rr(22, 44);
      const tall = district.id === 'neon' ? rr(24, 60) : district.id === 'hoshino' ? rr(8, 22) : rr(10, 38);
      const x = cx + rr(-48, 48), z = cz + rr(-48, 48);
      if (Math.abs(x + 412.5) < 60 && Math.abs(z - 412.5) < 60) continue;
      const tex = buildingTexture(pick(bases), rr(0.18, 0.42)); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffc873, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.9 });
      mat.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98)); // subtle warm per-building tint
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, tall, d), mat);
      b.position.set(x, tall / 2 + groundH(x, z), z); scene.add(b);
      if (!G.buildingMats) G.buildingMats = []; G.buildingMats.push(mat);
      G.addCollider(x, z, w / 2, d / 2, tall);
      if (rnd() < 0.3) { // rooftop prop
        const prop = new THREE.Mesh(new THREE.BoxGeometry(rr(2, 4), rr(1, 2), rr(2, 4)), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
        prop.position.set(x + rr(-6, 6), tall + 0.8, z + rr(-6, 6)); scene.add(prop);
      }
      if (rnd() < 0.22) { // billboard
        const pt = signTexture(pick(posters), '#14161c', '#ffb35c');
        const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), new THREE.MeshBasicMaterial({ map: pt, side: THREE.DoubleSide }));
        bb.position.set(x, tall + 4, z); bb.rotation.y = rr(0, Math.PI); scene.add(bb);
      }
      // storefront on neon/coral ground floor
      if ((district.id === 'neon' || district.id === 'coral') && rnd() < 0.6) {
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
  // streetlights
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8, metalness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const addLight = (lx, lz) => {
    const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(lx, 3, lz); scene.add(p);
    const gl = glowSprite(0xffd9a0, 4); gl.position.set(lx, 6, lz); gl.material.opacity = 0; scene.add(gl); streetlights.push(gl);
  };
  for (const x of G.roadX) for (let z = -620; z <= 620; z += 82) {
    if (rnd() < 0.4) continue;
    addLight(x + 16, z);
  }
  // denser poles (~every 45m) on the two main streets: Coral z=495, Neon x=330
  for (let x = -630; x <= 630; x += 45) addLight(x, 495 + 16);
  for (let z = -600; z <= 100; z += 45) addLight(330 + 16, z);
  G.streetlightGlows = streetlights;
  G.signGlows = _signGlows;
  // HQ
  buildHQ(G, scene);
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
  // parks
  for (const [px, pz] of [[412, 412], [-412, -80]]) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x4d8a4a, roughness: 1 }));
    park.rotation.x = -Math.PI / 2; park.position.set(px, 0.04, pz); scene.add(park);
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
  if (G.hemi) { G.hemi.intensity = 0.25 + dayAmt * 0.65; if (G.hemi.color) G.hemi.color.copy(_skyTop).lerp(_warmTint, 0.3); if (G.hemi.groundColor) G.hemi.groundColor.set(0x8a7a66); }
  const night = 1 - dayAmt;
  if (G.buildingMats) for (const m of G.buildingMats) m.emissiveIntensity = night * 0.55;
  if (G.streetlightGlows) for (const s of G.streetlightGlows) s.material.opacity = night * 0.8;
  const signDark = Math.min(1, night * 0.85 + Math.min(1, Math.max(0, sunset)) * 0.35);
  for (const s of _signGlows) s.material.opacity = signDark * 0.55;
  if (G.water) G.water.position.y = -0.4 + Math.sin(G.elapsed || 0) * 0.03;
}
