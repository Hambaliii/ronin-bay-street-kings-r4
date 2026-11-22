// world.js — RONIN BAY city
import * as THREE from 'three';
import { CFG, DISTRICTS, TOUGE_POINTS } from './config.js';
import { rnd, rr, ri, pick } from './random.js';

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
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${120 + ri(0, 60)},${110 + ri(0, 50)},${90 + ri(0, 40)},.25)`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.strokeRect(0, 0, 256, 256);
  });
}
function buildingTexture(base, litRatio) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 18) for (let x = 8; x < w - 8; x += 20) {
      const lit = rnd() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : '#2a3442'; g.fillRect(x, y, 12, 10);
      g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, y, 12, 3);
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
  const dashTex = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#33373d'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e4d0'; g.fillRect(w / 2 - 2, 20, 4, 60); g.fillRect(w / 2 - 2, 150, 4, 60); });
  dashTex.wrapS = dashTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshStandardMaterial({ map: dashTex, roughness: 0.95 });
  const plainRoadMat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.95 });
  const swMat = new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 1 });
  for (const x of G.roadX) {
    const t = dashTex.clone(); t.needsUpdate = true; t.repeat.set(1, 44);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, 1320), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.05, 0); scene.add(r);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), swMat); sw.position.set(x + s * (CFG.roadW / 2 + 1.5), 0.06, 0); scene.add(sw); }
  }
  for (const z of G.roadZ) {
    const t = dashTex.clone(); t.needsUpdate = true; t.repeat.set(44, 1);
    const r = new THREE.Mesh(new THREE.PlaneGeometry(1320, CFG.roadW), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.05, z); r.rotation.z = Math.PI / 2; scene.add(r);
    for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), swMat); sw.position.set(0, 0.06, z + s * (CFG.roadW / 2 + 1.5)); scene.add(sw); }
  }
  void roadMat; void plainRoadMat;
  // buildings
  const bases = ['#8a7f72', '#6f7a86', '#9a8a7a', '#5f6b7a', '#7a6f8a'];
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
      const tex = buildingTexture(pick(bases), 0.25); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffc873, emissiveMap: tex, emissiveIntensity: 0, roughness: 0.9 });
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
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.4), new THREE.MeshBasicMaterial({ map: st }));
        sign.position.set(x, 4.2, z + d / 2 + 0.1); scene.add(sign);
        const awn = new THREE.Mesh(new THREE.BoxGeometry(11, 0.15, 2.2), new THREE.MeshStandardMaterial({ color: new THREE.Color(col) }));
        awn.position.set(x, 3.4, z + d / 2 + 1); awn.rotation.x = 0.3; scene.add(awn);
      }
    }
  }
  // streetlights
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8, metalness: 0.5 });
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  for (const x of G.roadX) for (let z = -620; z <= 620; z += 82) {
    if (rnd() < 0.4) continue;
    const p = new THREE.Mesh(poleGeo, poleMat); p.position.set(x + 16, 3, z); scene.add(p);
    const gl = glowSprite(0xffd9a0, 4); gl.position.set(x + 16, 6, z); gl.material.opacity = 0; scene.add(gl); streetlights.push(gl);
  }
  G.streetlightGlows = streetlights;
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
  // parks
  for (const [px, pz] of [[412, 412], [-412, -80]]) {
    const park = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ color: 0x4d8a4a, roughness: 1 }));
    park.rotation.x = -Math.PI / 2; park.position.set(px, 0.04, pz); scene.add(park);
    for (let i = 0; i < 4; i++) { const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x7a5a38 })); bench.position.set(px + rr(-35, 35), 0.3, pz + rr(-35, 35)); scene.add(bench); }
  }
}
function buildHQ(G, scene) {
  const hx = -412.5, hz = 412.5;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const hq = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 34), wallMat);
  hq.position.set(hx, 5, hz); scene.add(hq); G.addCollider(hx, hz, 35, 17, 10);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.6, metalness: 0.6 });
  for (let i = -1; i <= 1; i++) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), doorMat);
    door.position.set(hx + i * 20, 3, hz + 17.2); scene.add(door);
  }
  const st = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#14100c'; g.fillRect(0, 0, 512, 96); g.font = 'bold 58px sans-serif'; g.textAlign = 'center'; g.shadowColor = '#ff7a1a'; g.shadowBlur = 16; g.fillStyle = '#ff7a1a'; g.fillText('RONIN KAI', 256, 66); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial({ map: st }));
  sign.position.set(hx, 8.6, hz + 17.3); scene.add(sign);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb35c, emissiveIntensity: 0.6 });
  for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), winMat); w.position.set(hx - 28 + i * 14, 7.6, hz - 17.2); w.rotation.y = Math.PI; scene.add(w); }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(hx, 0.04, 455); scene.add(apron);
  G.hq = { x: hx, z: hz, garage: { x: hx, z: 455 } };
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
  const pts = TOUGE_POINTS.map(p => new THREE.Vector3(p[0], groundH(p[0], p[1]) + 0.08, p[1]));
  const mat = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.95 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf0ead0 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xb0b6bc, metalness: 0.7, roughness: 0.4 });
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(9, len), mat);
    seg.rotation.x = -Math.PI / 2; seg.rotation.z = Math.atan2(dir.x, dir.z);
    seg.position.copy(mid); seg.position.y = (a.y + b.y) / 2;
    seg.rotation.x = -Math.PI / 2 + Math.atan2(b.y - a.y, Math.hypot(dir.x, dir.z)) * Math.cos(seg.rotation.z) * 0; scene.add(seg);
    // guardrail posts outer edge
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    for (let t = 0; t <= 1; t += 0.34) {
      const px = a.x + dir.x * t + perp.x * 5, pz = a.z + dir.z * t + perp.z * 5;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), railMat);
      post.position.set(px, groundH(px, pz) + 0.5, pz); scene.add(post);
    }
    void edgeMat;
  }
  // cherry trees along touge
  for (let i = 0; i < pts.length - 1; i += 2) {
    const p = pts[i];
    const tree = makeShadeTree(rr(3, 4.5), 0xe8a0bf);
    tree.position.set(p.x + rr(-14, 14), groundH(p.x, p.z), p.z + rr(-14, 14)); scene.add(tree);
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
  const skyDay = new THREE.Color(0x87c5eb), skyNight = new THREE.Color(0x0b1026), skySet = new THREE.Color(0xff8c4a);
  const sky = skyNight.clone().lerp(skyDay, dayAmt).lerp(skySet, Math.min(0.7, sunset * 0.7));
  G.scene.background = sky;
  if (G.scene.fog) { G.scene.fog.color.copy(sky); }
  if (G.sun) { G.sun.intensity = 0.25 + dayAmt * 1.1; G.sun.color.setHSL(0.1, 0.5, 0.55 + dayAmt * 0.2); const ang = ((t - 6) / 12) * Math.PI; G.sun.position.set(Math.cos(ang) * 300, Math.max(20, Math.sin(ang) * 300), 120); }
  if (G.hemi) G.hemi.intensity = 0.25 + dayAmt * 0.65;
  const night = 1 - dayAmt;
  if (G.buildingMats) for (const m of G.buildingMats) m.emissiveIntensity = night * 0.55;
  if (G.streetlightGlows) for (const s of G.streetlightGlows) s.material.opacity = night * 0.8;
  if (G.water) G.water.position.y = -0.4 + Math.sin(G.elapsed || 0) * 0.03;
}
