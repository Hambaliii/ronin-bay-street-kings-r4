// cars.js — extruded side-profile car factory (HARD GATE 1), traffic, smoke
import * as THREE from 'three';
import { CARS } from './config.js';
import { rnd, rr, ri, pick } from './random.js';
import { groundH, glowSprite } from './world.js';
import { loadHeroAsset } from './assets.js';

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
  addUnderglow(grp, spec, opts);
  addBlobShadow(grp, spec);
  grp.userData.wheels = wheels; grp.userData.wheelR = wr;
  return grp;
}
// --- RBPD cruiser: npc-police GLB visual (assets/npc-police.glb) -----------
// Primary visual for police vehicles (spawned by police.js). `vehicle` is
// the object returned by spawnVehicle (the buildBody-equivalent here):
// { spec, specId, mesh, wheels, ... } where mesh is the makeCarMesh group
// whose userData carries { wheels, wheelR, tailMat, headMat } and, for
// lightbar specs, userData.lightbar = { red, blue, gr, gb } (the flashing
// barRed/barBlue pair is lightbar.red / lightbar.blue — there are no
// top-level barRed/barBlue refs in this build). The procedural body stays
// in the group, hidden, as the automatic fallback: if the GLB fails to
// load, loadHeroAsset resolves null and nothing is touched. The lightbar
// overlay, its glow sprites and the procedural wheels are KEPT (the GLB's
// baked wheels are static, so the kept wheels are re-seated into its
// arches and keep spinning via the existing wheel updates). Never throws.
export function applyNpcPoliceGlb(vehicle) {
  try {
    if (!vehicle || vehicle.glbSwapped) return;
    const grp = vehicle.mesh || vehicle; // vehicle object, or the group itself
    if (!grp || !grp.children || !grp.userData) return;
    vehicle.glbSwapped = true; // guard double-swap (incl. concurrent calls)
    if (grp !== vehicle) grp.userData.glbSwapped = true;
    loadHeroAsset('npcPolice').then((wrapper) => {
      try {
        if (!wrapper) { vehicle.glbSwapped = false; if (grp !== vehicle) grp.userData.glbSwapped = false; return; } // fallback stays
        const ud = grp.userData;
        // --- refs to KEEP visible -------------------------------------------
        const keep = new Set();
        const wheels = ud.wheels || vehicle.wheels || {};
        for (const w of Object.values(wheels)) if (w) keep.add(w);
        // Lightbar flash meshes: real refs are userData.lightbar.{red,blue,
        // gr,gb}; also honour top-level barRed/barBlue if a build exposes them.
        const lbParts = [];
        const lb = ud.lightbar || null;
        if (lb) for (const k of ['red', 'blue', 'gr', 'gb']) if (lb[k]) lbParts.push(lb[k]);
        if (ud.barRed) lbParts.push(ud.barRed);
        if (ud.barBlue) lbParts.push(ud.barBlue);
        for (const p of lbParts) keep.add(p);
        // Lightbar base box (not stored in userData): the un-kept mesh
        // sitting just under the red/blue pair at the same z.
        let lbBase = null;
        const refBar = lbParts.find((p) => p && p.position && p.geometry && p.geometry.type === 'BoxGeometry') || lbParts[0];
        if (refBar) {
          for (const c of grp.children) {
            if (keep.has(c) || !c.isMesh || !c.position) continue;
            if (Math.abs(c.position.z - refBar.position.z) < 0.01 && c.position.y < refBar.position.y && refBar.position.y - c.position.y < 0.2) { lbBase = c; break; }
          }
        }
        if (lbBase) keep.add(lbBase);
        // Glow sprites (incl. lightbar glow sprites) and the flat ground
        // planes (underglow / blob shadow: PlaneGeometry rotated flat).
        for (const c of grp.children) {
          if (c.isSprite) keep.add(c);
          else if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && Math.abs(c.rotation.x + Math.PI / 2) < 0.01) keep.add(c);
        }
        // --- hide the procedural BODY meshes (hide, never remove) -----------
        for (const c of [...grp.children]) if (!keep.has(c)) c.visible = false;
        // --- add the GLB wrapper (clone: the cached wrapper is shared) -----
        const clone = wrapper.clone ? wrapper.clone(true) : wrapper;
        clone.position.set(0, 0, 0);
        grp.add(clone);
        ud.npcPoliceGlb = clone;
        // --- re-seat the kept wheels into the GLB's wheel arches ------------
        // GLB wheel clusters: local z +0.27 front / -0.32 rear on a 4.85-long
        // body -> z +1.31 / -1.55, x +/-0.80. Front vs rear by current z sign.
        for (const w of Object.values(wheels)) {
          if (!w || !w.position) continue;
          const isFront = w.position.z >= 0;
          w.position.z = isFront ? 1.31 : -1.55;
          w.position.x = w.position.x < 0 ? -0.80 : 0.80;
          // y kept as-is (wheel radius / spin behaviour untouched)
        }
        // --- re-seat the lightbar assembly on the GLB roof (roof y = 1.42) --
        // Shift the whole assembly so the bar base sits at y ~ 1.40; flash
        // materials / behaviour untouched, tailMat/headMat refs left as-is.
        const assembly = lbBase ? [lbBase, ...lbParts] : lbParts;
        if (assembly.length) {
          let delta;
          if (lbBase) delta = 1.40 - lbBase.position.y;
          else if (refBar) delta = 1.48 - refBar.position.y; // bar mesh sits 0.08 above its base
          else delta = 0;
          if (delta) for (const p of assembly) if (p && p.position) p.position.y += delta;
        }
      } catch (e) { /* keep the procedural visual */ }
    }).catch(() => { vehicle.glbSwapped = false; });
  } catch (e) { /* keep the procedural visual */ }
}
// --- luminance tint: reuse a baked texture as detail only -----------------
// The npc-sedan GLB's baked texture is saturated electric blue over the
// whole body. This helper discards its hue entirely: each fragment's
// luminance (detail: dark glass stays dark, bright chrome/lights stay
// bright) is re-coloured by a single per-instance tint colour, so no trace
// of the original blue survives on any instance. Never throws by itself —
// callers wrap it like the other GLB swaps.
export function applyLuminanceTint(root, hex) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const applyOne = (orig) => {
      const mat = orig.clone();
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTint = { value: new THREE.Color(hex) };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uTint;')
          .replace('#include <map_fragment>', [
            '#include <map_fragment>',
            'float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));',
            'diffuseColor.rgb = uTint * (0.22 + 1.05 * lum);',
          ].join('\n'));
      };
      mat.customProgramCacheKey = () => 'npc-luminance-tint';
      return mat;
    };
    o.material = Array.isArray(o.material) ? o.material.map(applyOne) : applyOne(o.material);
  });
}
// --- NPC sedan: npc-sedan GLB visual for traffic sedans --------------------
// Mirrors applyNpcPoliceGlb above. The model's LENGTH IS ALONG X (nose at
// +X, bounds x +/-0.5, y 0..0.334, z +/-0.24), so the wrapper is rotated
// -90 deg about Y to map +X nose -> +Z forward (the loader grounds y at 0
// and centers x/z, so the rotation is about the car center — safe). The
// registry targetSize is expressed in the model's LOCAL axes. The baked
// electric-blue texture is treated as luminance/detail only via
// applyLuminanceTint with a per-instance realistic tint. The procedural
// body stays hidden as fallback: if the GLB fails to load, loadHeroAsset
// resolves null and nothing is touched. Kept procedural wheels are
// re-seated into the GLB's arches and keep spinning. Never throws.
export function applyNpcSedanGlb(vehicle, tintHex) {
  try {
    if (!vehicle || vehicle.glbSwapped) return;
    const grp = vehicle.mesh || vehicle; // vehicle object, or the group itself
    if (!grp || !grp.children || !grp.userData) return;
    vehicle.glbSwapped = true; // guard double-swap (incl. concurrent calls)
    if (grp !== vehicle) grp.userData.glbSwapped = true;
    loadHeroAsset('npcSedan').then((wrapper) => {
      try {
        if (!wrapper) { vehicle.glbSwapped = false; if (grp !== vehicle) grp.userData.glbSwapped = false; return; } // fallback stays
        const ud = grp.userData;
        // --- refs to KEEP visible (same keep-set as the police helper) ----
        const keep = new Set();
        const wheels = ud.wheels || vehicle.wheels || {};
        for (const w of Object.values(wheels)) if (w) keep.add(w);
        // Glow sprites and the flat ground planes (underglow / blob shadow:
        // PlaneGeometry rotated flat).
        for (const c of grp.children) {
          if (c.isSprite) keep.add(c);
          else if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && Math.abs(c.rotation.x + Math.PI / 2) < 0.01) keep.add(c);
        }
        // --- hide the procedural BODY meshes (hide, never remove) -----------
        for (const c of [...grp.children]) if (!keep.has(c)) c.visible = false;
        // --- add the GLB wrapper (clone: the cached wrapper is shared) -----
        const clone = wrapper.clone ? wrapper.clone(true) : wrapper;
        clone.position.set(0, 0, 0);
        clone.rotation.y = -Math.PI / 2; // model +X nose -> +Z forward
        applyLuminanceTint(clone, tintHex);
        grp.add(clone);
        ud.npcSedanGlb = clone;
        // --- re-seat the kept wheels into the GLB's wheel arches ------------
        // After the -90 deg rotation the model's wheel clusters (local x
        // +0.25 front / -0.35 rear, scaled by length 4.75) sit at game
        // z +1.19 front / -1.66 rear, x +/-0.80. Front vs rear by current
        // z sign; y kept as-is (wheel radius / spin behaviour untouched).
        for (const w of Object.values(wheels)) {
          if (!w || !w.position) continue;
          const isFront = w.position.z >= 0;
          w.position.z = isFront ? 1.19 : -1.66;
          w.position.x = w.position.x < 0 ? -0.80 : 0.80;
          // y kept as-is
        }
      } catch (e) { /* keep the procedural visual */ }
    }).catch(() => { vehicle.glbSwapped = false; });
  } catch (e) { /* keep the procedural visual */ }
}
// --- NPC taxi: npc-taxi GLB visual for traffic taxis -----------------------
// Mirrors applyNpcSedanGlb above MINUS the tint: the taxi GLB's baked
// texture is already the correct taxi yellow (roof sign included), so the
// clone is used as-is — no luminance recolor. The model's nose is already
// +Z (bounds x +/-0.261, y 0..0.43 incl. roof sign, z +/-0.5), so NO
// rotation is applied. The procedural body stays hidden as fallback: if
// the GLB fails to load, loadHeroAsset resolves null and nothing is
// touched (the fallback then shows in the spec's taxi-yellow 0xf2b21b).
// Kept procedural wheels are re-seated into the GLB's arches and keep
// spinning. Never throws.
export function applyNpcTaxiGlb(vehicle) {
  try {
    if (!vehicle || vehicle.glbSwapped) return;
    const grp = vehicle.mesh || vehicle; // vehicle object, or the group itself
    if (!grp || !grp.children || !grp.userData) return;
    vehicle.glbSwapped = true; // guard double-swap (incl. concurrent calls)
    if (grp !== vehicle) grp.userData.glbSwapped = true;
    loadHeroAsset('npcTaxi').then((wrapper) => {
      try {
        if (!wrapper) { vehicle.glbSwapped = false; if (grp !== vehicle) grp.userData.glbSwapped = false; return; } // fallback stays
        const ud = grp.userData;
        // --- refs to KEEP visible (same keep-set as the sedan helper) ----
        const keep = new Set();
        const wheels = ud.wheels || vehicle.wheels || {};
        for (const w of Object.values(wheels)) if (w) keep.add(w);
        // Glow sprites and the flat ground planes (underglow / blob shadow:
        // PlaneGeometry rotated flat).
        for (const c of grp.children) {
          if (c.isSprite) keep.add(c);
          else if (c.isMesh && c.geometry && c.geometry.type === 'PlaneGeometry' && Math.abs(c.rotation.x + Math.PI / 2) < 0.01) keep.add(c);
        }
        // --- hide the procedural BODY meshes (hide, never remove) -----------
        for (const c of [...grp.children]) if (!keep.has(c)) c.visible = false;
        // --- add the GLB wrapper (clone: the cached wrapper is shared) -----
        const clone = wrapper.clone ? wrapper.clone(true) : wrapper;
        clone.position.set(0, 0, 0);
        // no rotation — model nose already +Z; no tint — baked yellow kept
        grp.add(clone);
        ud.npcTaxiGlb = clone;
        // --- re-seat the kept wheels into the GLB's wheel arches ------------
        // Model wheel clusters: local z +0.25 front / -0.28 rear, scaled by
        // length 4.80 -> game z +1.20 front / -1.34 rear, x +/-0.80. Front
        // vs rear by current z sign; y kept as-is (wheel radius / spin
        // behaviour untouched).
        for (const w of Object.values(wheels)) {
          if (!w || !w.position) continue;
          const isFront = w.position.z >= 0;
          w.position.z = isFront ? 1.20 : -1.34;
          w.position.x = w.position.x < 0 ? -0.80 : 0.80;
          // y kept as-is
        }
      } catch (e) { /* keep the procedural visual */ }
    }).catch(() => { vehicle.glbSwapped = false; });
  } catch (e) { /* keep the procedural visual */ }
}
// Shared ground dressing for every car visual (procedural or GLB hero car):
// the additive underglow plane (when the spec/opts carry a glow colour) and
// the blob shadow. Kept in one place so both visuals sit identically.
function addUnderglow(grp, spec, opts) {
  const glowColor = opts && opts.glow !== undefined ? opts.glow : spec.glow;
  if (!glowColor) return;
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gg = gc.getContext('2d'); const gr2 = gg.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr2.addColorStop(0, 'rgba(255,255,255,.9)'); gr2.addColorStop(1, 'rgba(255,255,255,0)');
  gg.fillStyle = gr2; gg.fillRect(0, 0, 128, 128);
  // S33: size capped sanely — the old wid/len + 1.6 plane read as a giant
  // (6-8 m) coloured dome from a low camera at HQ. Now the glow hugs the
  // car's own footprint scaled by 1.25 on both axes (long axis = spec
  // length x 1.25, width proportional at spec width x 1.25), opacity 0.25
  // (<= 0.45), flat on the ground at y 0.06. This one helper serves every
  // path: procedural makeCarMesh and the GLB populate paths for the
  // heroCar / gtr35 / lamboSvj hero vehicles.
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid * 1.25, spec.len * 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: glowColor, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  gm.rotation.x = -Math.PI / 2; gm.position.y = 0.06; grp.add(gm);
}
function addBlobShadow(grp, spec) {
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid + 0.5, spec.len + 0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; grp.add(shadow);
}
// --- hero car: Tripo GLB visual for the Taiyo Supra nameplate --------------
// Specs 'taiyo' and 'hero-supra' use the real GLB (assets/hero-car.glb via
// assets.js) once it resolves; until then — and forever if it fails — they
// use the exact procedural mesh from makeCarMesh. The GLB has baked wheels
// (single mesh), so the visual carries four EMPTY wheel pivots at the axle
// positions purely so drive.js / traffic spin+steer code runs harmlessly,
// and tailMat/headMat are null (drive.js null-guards tailMat; nothing
// dereferences headMat) — the brake-light boost is simply skipped.
// One load is kicked off at module init; every spawn clones the wrapper.
const HERO_CAR_SPECS = new Set(['taiyo', 'hero-supra']);
let heroCarWrapper = null;   // resolved template wrapper (never added to a scene)
let heroCarSettled = false;  // load finished (success or failure)
const heroCarPending = [];   // { v, spec, glow } procedural spawns awaiting swap

function populateGlbCar(grp, spec, opts) {
  grp.add(heroCarWrapper.clone(true));
  addUnderglow(grp, spec, opts);
  addBlobShadow(grp, spec);
  const wheels = {};
  for (const [key, sx, sz] of [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.80, 0.34, sz * 1.42);
    grp.add(pivot);
    wheels[key] = pivot;
  }
  grp.userData.wheels = wheels;
  grp.userData.wheelR = 0.34;
  grp.userData.tailMat = null;
  grp.userData.headMat = null;
  grp.userData.visualMode = 'glb';
  return grp;
}
function makeGlbCarMesh(spec, opts) {
  return populateGlbCar(new THREE.Group(), spec, opts);
}
// Swap a still-alive procedural hero car to the GLB visual in place: the
// outer mesh group, position/rotation and ALL vehicle state are kept. Only
// the children makeCarMesh created at spawn (snapshotted in v._procChildren)
// are removed, so anything added later — seated driver figure, player
// spotlights, night glow — survives the swap. Never throws.
function swapToGlbCar(p) {
  try {
    const v = p.v;
    if (!v || !v.mesh || !v.mesh.parent) return; // vehicle gone
    if (v.mesh.userData.visualMode === 'glb') return;
    if (v._procChildren) {
      for (const c of [...v.mesh.children]) if (v._procChildren.has(c)) v.mesh.remove(c);
    } else {
      while (v.mesh.children.length) v.mesh.remove(v.mesh.children[0]);
    }
    populateGlbCar(v.mesh, p.spec, { glow: p.glow });
    v.wheels = v.mesh.userData.wheels;
    v._procChildren = null;
  } catch (e) { /* keep the procedural visual */ }
}
try {
  loadHeroAsset('heroCar').then((wrapper) => {
    try {
      heroCarSettled = true;
      if (!wrapper) { heroCarPending.length = 0; return; } // fallback stays
      heroCarWrapper = wrapper;
      for (const p of heroCarPending.splice(0)) swapToGlbCar(p);
    } catch (e) { /* keep the procedural visual */ }
  }).catch(() => { heroCarSettled = true; heroCarPending.length = 0; });
} catch (e) { heroCarSettled = true; }
// --- rival hero car: GT-R R35 GLB (assets/gtr35.glb) + Bosku livery --------
// Spec 'gtr35' follows the exact hero-car pattern above: real GLB once it
// resolves, exact procedural makeCarMesh fallback until then / on failure.
// Livery (silver upper / black lower kit / red stripe at the kit's top edge)
// is injected per-clone via onBeforeCompile height-band tinting in LOCAL
// model Y (model y range 0..0.311, before wrapper scaling).
function applyGtrLivery(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const applyOne = (orig) => {
      const mat = orig.clone();
      mat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
          .replace('#include <map_fragment>', [
            '#include <map_fragment>',
            'vec3 gtrBase = diffuseColor.rgb;',
            'vec3 gtrKit = mix(gtrBase * 0.25, vec3(0.012, 0.012, 0.014), 0.75);',
            'vec3 gtrStripe = vec3(0.85, 0.04, 0.05);',
            'vec3 gtrUpper = gtrBase * 1.18;',
            'float gtrToStripe = smoothstep(0.095 - 0.006, 0.095 + 0.006, vLocalY);',
            'float gtrToUpper = smoothstep(0.125 - 0.006, 0.125 + 0.006, vLocalY);',
            'diffuseColor.rgb = mix(mix(gtrKit, gtrStripe, gtrToStripe), gtrUpper, gtrToUpper);',
          ].join('\n'));
      };
      mat.customProgramCacheKey = () => 'gtr35-livery';
      return mat;
    };
    o.material = Array.isArray(o.material) ? o.material.map(applyOne) : applyOne(o.material);
  });
}
const GTR_SPECS = new Set(['gtr35']);
let gtrWrapper = null;
let gtrSettled = false;
const gtrPending = [];
function populateGtrCar(grp, spec, opts) {
  const clone = gtrWrapper.clone(true);
  // S34: the GT-R model's nose is -Z in wrapper space (every other hero
  // GLB faces +Z) — rotate the wrapper PI about Y so the nose aligns
  // with vehicle forward +Z like the hero car. GT-R only.
  clone.rotation.y = Math.PI;
  applyGtrLivery(clone);
  grp.add(clone);
  addUnderglow(grp, spec, opts);
  addBlobShadow(grp, spec);
  const wheels = {};
  for (const [key, sx, sz] of [['fl', -0.80, 1.41], ['fr', 0.80, 1.41], ['rl', -0.80, -1.55], ['rr', 0.80, -1.55]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.35, sz);
    grp.add(pivot);
    wheels[key] = pivot;
  }
  grp.userData.wheels = wheels;
  grp.userData.wheelR = 0.35;
  grp.userData.tailMat = null;
  grp.userData.headMat = null;
  grp.userData.visualMode = 'glb';
  return grp;
}
function makeGtrCarMesh(spec, opts) {
  return populateGtrCar(new THREE.Group(), spec, opts);
}
function swapToGtrCar(p) {
  try {
    const v = p.v;
    if (!v || !v.mesh || !v.mesh.parent) return;
    if (v.mesh.userData.visualMode === 'glb') return;
    if (v._procChildren) {
      for (const c of [...v.mesh.children]) if (v._procChildren.has(c)) v.mesh.remove(c);
    } else {
      while (v.mesh.children.length) v.mesh.remove(v.mesh.children[0]);
    }
    populateGtrCar(v.mesh, p.spec, { glow: p.glow });
    v.wheels = v.mesh.userData.wheels;
    v._procChildren = null;
  } catch (e) { /* keep the procedural visual */ }
}
try {
  loadHeroAsset('gtr35').then((wrapper) => {
    try {
      gtrSettled = true;
      if (!wrapper) { gtrPending.length = 0; return; } // fallback stays
      gtrWrapper = wrapper;
      for (const p of gtrPending.splice(0)) swapToGtrCar(p);
    } catch (e) { /* keep the procedural visual */ }
  }).catch(() => { gtrSettled = true; gtrPending.length = 0; });
} catch (e) { gtrSettled = true; }
// --- dream car: Lamborghini SVJ GLB (assets/lambo-svj.glb) -----------------
// Spec 'svj' follows the exact hero-car pattern above (third hero slot):
// real GLB once it resolves, exact procedural makeCarMesh fallback until
// then / on failure. Model bounds x +/-0.259, y 0..0.275, z +/-0.5 with
// the NOSE at +Z (wedge slopes down toward +z, tall rear deck + big wing
// at -z), so no rotation is needed. Bosku inspected the raw model and
// mandated three defect fixes, applied per-clone in applySvjTreatment:
// (1) no windshield -> tinted glass canopy over the cabin, (2) no
// taillights -> signature Y-shaped LED units (registered as the vehicle's
// tailMat so the brake-boost path can brighten them) + front DRL strips,
// (3) fragmented noise texture -> matte black paint treatment (texture
// kept only as low-influence detail over a near-black base, satin
// specular) + red brake discs picked out behind the wheels.
function svjTailTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 84;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 84);
  g.strokeStyle = '#ff1e1e'; g.lineWidth = 15; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = '#ff1e1e'; g.shadowBlur = 8;
  g.beginPath();
  g.moveTo(28, 8); g.lineTo(128, 46); // left arm of the Y
  g.moveTo(228, 8); g.lineTo(128, 46); // right arm of the Y
  g.moveTo(128, 46); g.lineTo(128, 76); // stem of the Y
  g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function applySvjTreatment(wrapper, vehicle) {
  const out = { tailMat: null, drlMat: null };
  if (!wrapper) return out;
  // (a) PAINT — matte black: baked texture survives only as subtle detail
  // (30% strength, mixed 78% toward near-black), satin finish on clones.
  wrapper.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const applyOne = (orig) => {
      const mat = orig.clone();
      mat.roughness = 0.58;
      mat.metalness = 0.30;
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <map_fragment>', [
            '#include <map_fragment>',
            'diffuseColor.rgb = mix(diffuseColor.rgb * 0.30, vec3(0.016, 0.016, 0.018), 0.78);',
          ].join('\n'));
      };
      mat.customProgramCacheKey = () => 'svj-matte';
      return mat;
    };
    o.material = Array.isArray(o.material) ? o.material.map(applyOne) : applyOne(o.material);
  });
  // (b) GLASS CANOPY — extruded side profile (z-y plane, GAME units)
  // following the cabin silhouette (local cabin z -0.2..+0.1, roof peak
  // y 0.275 -> game z -0.99..+0.49, roof y 1.14). The canopy base sinks
  // to y 0.74, inside the body, so only the tinted dome shows.
  const prof = new THREE.Shape();
  prof.moveTo(0.55, 0.80); // nose of glass
  prof.lineTo(-0.35, 1.10); // windshield top
  prof.lineTo(-1.05, 1.08); // roof rear
  prof.lineTo(-1.45, 0.82); // rear slope
  prof.lineTo(-1.45, 0.74);
  prof.lineTo(0.55, 0.74);
  prof.closePath();
  const canopyGeo = new THREE.ExtrudeGeometry(prof, { depth: 1.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, steps: 1 });
  canopyGeo.rotateY(-Math.PI / 2); // shape x -> game +Z, extrusion -> game X
  canopyGeo.translate(0.62, 0, 0); // center the 1.24 extrusion on x
  const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshPhongMaterial({ color: 0x0d1216, specular: 0xbdd3e0, shininess: 90, transparent: true, opacity: 0.97 }));
  wrapper.add(canopy);
  // (c) TAILLIGHTS — two Y-LED units on the rear face (z = -2.46). The
  // material is registered as the vehicle's tailMat: the brake-boost
  // path writes emissiveIntensity on tailMat, so base is 1.1 (S34:
  // enlarged Y units) and braking brightens the Y's. Small red glow
  // sprite behind each unit.
  const tailTex = svjTailTexture();
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tailTex, map: tailTex, transparent: true, emissiveIntensity: 1.1 });
  for (const s of [-1, 1]) {
    const unit = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.28), tailMat);
    unit.position.set(s * 0.56, 0.80, -2.46);
    unit.rotation.y = Math.PI; // face -Z
    wrapper.add(unit);
    const gl = glowSprite(0xff2a22, 1.1);
    gl.position.set(s * 0.56, 0.80, -2.52);
    wrapper.add(gl);
  }
  out.tailMat = tailMat;
  // Front DRL — thin emissive-white strips at the nose; the S25 system
  // (updateDamageFx) layers its headlight glows/cones on top at night.
  const drlMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf4f8ff, emissiveIntensity: 1.2, roughness: 0.3 });
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.07), drlMat);
    strip.position.set(s * 0.55, 0.52, 2.44); // faces +Z by default
    wrapper.add(strip);
  }
  out.drlMat = drlMat;
  // (d) BRAKE DISCS — bright red, one behind each wheel pivot.
  const discGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.06, 20); discGeo.rotateZ(Math.PI / 2); // axis along X
  const discMat = new THREE.MeshStandardMaterial({ color: 0xe02020, metalness: 0.2, roughness: 0.35 });
  for (const [sx, sz] of [[-0.86, 1.40], [0.86, 1.40], [-0.86, -1.75], [0.86, -1.75]]) {
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.set(sx, 0.36, sz);
    wrapper.add(disc);
  }
  if (vehicle) vehicle.svjTreatment = out;
  return out;
}
const SVJ_SPECS = new Set(['svj']);
let svjWrapper = null;
let svjSettled = false;
const svjPending = [];
function populateSvjCar(grp, spec, opts) {
  const clone = svjWrapper.clone(true);
  const treat = applySvjTreatment(clone, null);
  grp.add(clone);
  addUnderglow(grp, spec, opts);
  addBlobShadow(grp, spec);
  const wheels = {};
  for (const [key, sx, sz] of [['fl', -0.88, 1.40], ['fr', 0.88, 1.40], ['rl', -0.88, -1.75], ['rr', 0.88, -1.75]]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.36, sz);
    grp.add(pivot);
    wheels[key] = pivot;
  }
  grp.userData.wheels = wheels;
  grp.userData.wheelR = 0.36;
  grp.userData.tailMat = treat.tailMat;
  grp.userData.headMat = treat.drlMat;
  grp.userData.visualMode = 'glb';
  return grp;
}
function makeSvjCarMesh(spec, opts) {
  return populateSvjCar(new THREE.Group(), spec, opts);
}
function swapToSvjCar(p) {
  try {
    const v = p.v;
    if (!v || !v.mesh || !v.mesh.parent) return;
    if (v.mesh.userData.visualMode === 'glb') return;
    if (v._procChildren) {
      for (const c of [...v.mesh.children]) if (v._procChildren.has(c)) v.mesh.remove(c);
    } else {
      while (v.mesh.children.length) v.mesh.remove(v.mesh.children[0]);
    }
    populateSvjCar(v.mesh, p.spec, { glow: p.glow });
    v.wheels = v.mesh.userData.wheels;
    v._procChildren = null;
    // Shot staging (shots.js 'svjrear') can pre-arm the brake boost; the
    // swap is async, so apply it here once the real tailMat exists.
    if (v._brakeStaged && v.mesh.userData.tailMat) v.mesh.userData.tailMat.emissiveIntensity = 2.4;
  } catch (e) { /* keep the procedural visual */ }
}
try {
  loadHeroAsset('lamboSvj').then((wrapper) => {
    try {
      svjSettled = true;
      if (!wrapper) { svjPending.length = 0; return; } // fallback stays
      svjWrapper = wrapper;
      for (const p of svjPending.splice(0)) swapToSvjCar(p);
    } catch (e) { /* keep the procedural visual */ }
  }).catch(() => { svjSettled = true; svjPending.length = 0; });
} catch (e) { svjSettled = true; }

export function spawnVehicle(G, specId, x, z, angle, opts) {
  opts = opts || {};
  const spec = { ...CARS[specId], id: specId };
  const isHeroCar = HERO_CAR_SPECS.has(specId);
  const isGtrCar = GTR_SPECS.has(specId);
  const isSvjCar = SVJ_SPECS.has(specId);
  const mesh = isSvjCar && svjWrapper ? makeSvjCarMesh(spec, opts) : isGtrCar && gtrWrapper ? makeGtrCarMesh(spec, opts) : isHeroCar && heroCarWrapper ? makeGlbCarMesh(spec, opts) : makeCarMesh(spec, opts.color, opts);
  mesh.position.set(x, groundH(x, z) + 0.02, z); mesh.rotation.y = angle || 0;
  G.scene.add(mesh);
  const v = { spec, specId, mesh, angle: angle || 0, speed: 0, health: 100, driver: opts.driver || 'parked', color: opts.color != null ? opts.color : spec.color, wheels: mesh.userData.wheels, steerVis: 0, x, z, target: null, lane: opts.lane || 0, smokeT: 0 };
  ensureFxHook(G);
  if (isHeroCar && !heroCarWrapper && !heroCarSettled) {
    v._procChildren = new Set(mesh.children); // snapshot for the in-place swap
    heroCarPending.push({ v, spec, glow: opts.glow });
  }
  if (isGtrCar && !gtrWrapper && !gtrSettled) {
    v._procChildren = new Set(mesh.children); // snapshot for the in-place swap
    gtrPending.push({ v, spec, glow: opts.glow });
  }
  if (isSvjCar && !svjWrapper && !svjSettled) {
    v._procChildren = new Set(mesh.children); // snapshot for the in-place swap
    svjPending.push({ v, spec, glow: opts.glow });
  }
  if (!G.vehicles) G.vehicles = [];
  G.vehicles.push(v);
  return v;
}
// --- traffic ---
const TRAFFIC_COLORS = [0xb9c0c7, 0x3f8cff, 0xd95555, 0x44484e, 0xf2f2f2, 0x5a7d4f, 0xffd23f, 0x707880, 0x8a4fd0, 0x2a9d8f];
const TRAFFIC_IDS = ['sedan', 'hatch', 'suv', 'wagon', 'kei', 'hachi', 'van', 'sora15', 'roadster', 'taxi', 'sedan', 'hatch', 'suv', 'taxi'];
// Realistic per-instance tints for GLB traffic sedans (luminance recolor —
// the GLB's baked electric blue never survives). Cycled deterministically
// by sedan spawn index.
const NPC_SEDAN_TINTS = [0xc0c4c8, 0xe9e9e6, 0x3a3d42, 0x6e1420, 0x44586e, 0x77694f];
let npcSedanSpawnIndex = 0;
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
    const specId = pick(TRAFFIC_IDS);
    const v = spawnVehicle(G, specId, x, z, angle, { color: specId === 'taxi' ? CARS.taxi.color : pick(TRAFFIC_COLORS), driver: 'traffic' });
    if (specId === 'sedan') {
      const tintHex = NPC_SEDAN_TINTS[npcSedanSpawnIndex % NPC_SEDAN_TINTS.length];
      npcSedanSpawnIndex++;
      applyNpcSedanGlb(v, tintHex);
    }
    if (specId === 'taxi') {
      applyNpcTaxiGlb(v);
    }
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
    // S25 perf drop: a wrecked NPC (health < 35) cruises at 72% like the player.
    const targetSpeed = blocked ? 0 : v.cruise * (v.health < 35 ? 0.72 : 1);
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
    // S25: hood damage smoke is emitted centrally by updateDamageFx (below).
  }
}
export function damageVehicle(G, v, amt) {
  v.health = Math.max(0, v.health - amt);
  ensureFxHook(G);
  // S25: impact burst comes off the hood, not the car centre.
  const hp = hoodWorldPos(v, new THREE.Vector3());
  spawnSmokeAt(G, hp, 3, v.health < 25);
  for (let i = 0; i < 3; i++) spawnDamagePuff(G, v, false);
}
// --- S25 damage smoke + night headlights ----------------------------------
// Darkness factor D (0 day .. 1 night): same signal world.js updateWorld
// uses for the S7a sign glows — dayAmt = clamp(sin((t-6)/12*PI),0,1),
// night = 1 - dayAmt. Recomputed here from G.timeOfDay so cars.js needs
// no new import.
export function darknessFactor(G) {
  const t = (G && typeof G.timeOfDay === 'number') ? G.timeOfDay : 10.5;
  const dayAmt = Math.max(0, Math.min(1, Math.sin(((t - 6) / 12) * Math.PI)));
  return 1 - dayAmt;
}
function hoodWorldPos(v, out) {
  const spec = v.spec || {};
  const hoodH = spec.hood != null ? 0.62 + spec.hood * 0.28 : 0.85;
  out.set(0, hoodH, (spec.len || 4.4) * 0.32);
  if (v.mesh && v.mesh.localToWorld) { v.mesh.updateMatrixWorld(true); v.mesh.localToWorld(out); } else out.add(v.mesh.position);
  return out;
}
// Damage bands: rate (puffs/s), tint, start size, grown size, opacity.
function damageBand(health) {
  if (health < 15) return { rate: 12, color: 0x232528, s0: 0.9, s1: 3.2, op: 0.65 };
  if (health < 40) return { rate: 6, color: 0x777c83, s0: 0.7, s1: 2.4, op: 0.45 };
  return { rate: 2, color: 0xb8bcc0, s0: 0.5, s1: 1.6, op: 0.28 }; // 40..70 light wisps
}
const _hoodV = new THREE.Vector3();
export function spawnDamagePuff(G, v, prewarm, ageOverride) {
  ensureSmoke(G);
  if (!smokePool) return;
  const band = damageBand(v.health);
  for (const p of smokePool) {
    if (p.life > 0) continue;
    hoodWorldPos(v, _hoodV);
    const age = typeof ageOverride === 'number' ? ageOverride : (prewarm ? rr(0, 1.1) : 0);
    p.kind = 'dmg'; p.fire = false;
    p.max = 1.4; p.life = 1.4 - age;
    p.s0 = band.s0; p.s1 = band.s1; p.op = band.op;
    p.s.material.color.set(band.color);
    p.s.position.set(_hoodV.x + rr(-0.15, 0.15) + 0.3 * age, _hoodV.y + 1.2 * age, _hoodV.z + rr(-0.15, 0.15));
    p.vx = 0.3 + rr(-0.08, 0.08); p.vy = 1.2 + rr(-0.2, 0.2); p.vz = rr(-0.08, 0.08);
    const sc = p.s0 + (p.s1 - p.s0) * (age / 1.4); p.s.scale.set(sc, sc, 1);
    p.s.visible = true;
    return;
  }
}
// Pre-form a plume over a damaged car (shot staging).
// S33: pre-ages are spread deterministically across 0..1.2 s (oldest puff
// first) so a full column — not a random clump — exists at frame time.
export function primeDamageSmoke(G, v, n) {
  const count = n || 10;
  for (let i = 0; i < count; i++) spawnDamagePuff(G, v, true, count > 1 ? (i / (count - 1)) * 1.2 : 0);
}
// --- headlights -------------------------------------------------------------
// Glow sprites are THREE.Sprite children: every GLB swap helper in this
// file keeps isSprite children visible, so glows survive swaps untouched.
// Cones are Meshes (a helper WOULD hide them if it ran after they were
// added), so updateDamageFx re-asserts cone visibility every frame — a
// swap can hide a cone for at most one frame. Hero/GTR swaps only remove
// the _procChildren snapshot taken at spawn, so these later children are
// never removed there either.
const _coneGeo = new THREE.ConeGeometry(1.15, 7, 20, 1, true);
_coneGeo.translate(0, -3.5, 0); // apex at origin, base 7 m out along -Y
const _coneMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
function ensureHeadlights(v) {
  if (v._hl || !v.mesh || !v.spec) return;
  const spec = v.spec, W = spec.wid, L = spec.len;
  const mk = (color, scale, x, y, z) => { const s = glowSprite(color, scale); s.position.set(x, y, z); s.userData.s25Light = true; v.mesh.add(s); return s; };
  const hl = {};
  hl.glowL = mk(0xffe9a0, 1.25, -W * 0.32, 0.62, L / 2 + 0.12);
  hl.glowR = mk(0xffe9a0, 1.25, W * 0.32, 0.62, L / 2 + 0.12);
  hl.tailL = mk(0xff2a22, 0.85, -W * 0.32, 0.72, -L / 2 - 0.1);
  hl.tailR = mk(0xff2a22, 0.85, W * 0.32, 0.72, -L / 2 - 0.1);
  hl.cones = [];
  for (const s of [-1, 1]) {
    const cone = new THREE.Mesh(_coneGeo, _coneMat.clone());
    cone.position.set(s * W * 0.32, 0.58, L / 2);
    cone.rotation.x = -Math.PI / 2 + 0.07; // -Y (base) -> +Z forward, slight down-tilt
    cone.visible = false; cone.userData.s25Light = true;
    v.mesh.add(cone); hl.cones.push(cone);
  }
  v._hl = hl;
}
function ensurePlayerSpot(v) {
  if (v._hlSpot || !v.mesh) return;
  const L = v.spec.len;
  const spot = new THREE.SpotLight(0xffe6b8, 0, 40, 0.5, 0.6);
  spot.position.set(0, 0.7, L / 2);
  spot.target.position.set(0, 0, L / 2 + 18);
  spot.userData.s25Light = true;
  v.mesh.add(spot); v.mesh.add(spot.target);
  v._hlSpot = spot;
}
let _fxHooked = false;
function ensureFxHook(G) {
  if (_fxHooked || !G || !Array.isArray(G.updaters)) return;
  _fxHooked = true;
  G.updaters.push((G2, dt) => { try { updateDamageFx(G2, dt || 0.016); } catch (e) {} });
}
export function updateDamageFx(G, dt) {
  if (!G || !Array.isArray(G.vehicles)) return;
  const D = darknessFactor(G);
  const px = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const pz = G.car ? G.car.z : (G.player ? G.player.z : 0);
  // smoke emitters: nearest 10 damaged vehicles to the player
  const damaged = [];
  for (const v of G.vehicles) if (v && v.health < 70 && v.mesh) damaged.push(v);
  damaged.sort((a, b) => ((a.x - px) ** 2 + (a.z - pz) ** 2) - ((b.x - px) ** 2 + (b.z - pz) ** 2));
  const emitters = new Set(damaged.slice(0, 10));
  const showLights = D > 0.25;
  for (const v of G.vehicles) {
    if (!v || !v.mesh) continue;
    ensureHeadlights(v);
    const hl = v._hl; if (!hl) continue;
    const braking = v._prevSpeed != null && dt > 0 && (v._prevSpeed - (v.speed || 0)) / dt > 2;
    v._prevSpeed = v.speed || 0;
    for (const g of [hl.glowL, hl.glowR]) { g.visible = showLights; g.material.opacity = 0.85 * D; }
    for (const g of [hl.tailL, hl.tailR]) { g.visible = showLights; g.material.opacity = (braking ? 0.95 : 0.4) * D; }
    for (const c of hl.cones) { c.visible = showLights; c.material.opacity = 0.10 * D; }
    if (emitters.has(v)) {
      v._smokeAcc = (v._smokeAcc || 0) + damageBand(v.health).rate * dt;
      while (v._smokeAcc >= 1) { v._smokeAcc -= 1; spawnDamagePuff(G, v, false); }
    }
  }
  // player-only real spotlight (55 ~ drive.js' legacy pair at 60, sun 1.52)
  if (G.car && G.car.mesh) {
    ensurePlayerSpot(G.car);
    if (G.car._hlSpot) G.car._hlSpot.intensity = 55 * D;
  }
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
  for (let i = 0; i < 120; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    s.visible = false; G.scene.add(s);
    smokePool.push({ s, life: 0, max: 1, fire: false, kind: 'legacy', vx: 0, vy: 0, vz: 0, s0: 0.7, s1: 2.9, op: 0.5 });
  }
}
export function spawnSmokeAt(G, pos, n, fire) {
  ensureSmoke(G);
  let spawned = 0;
  for (const p of smokePool) {
    if (spawned >= n) break;
    if (p.life > 0) continue;
    p.life = p.max = rr(0.6, 1.3); p.fire = !!fire; p.kind = 'legacy';
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
    if (p.kind === 'dmg') {
      const sc = p.s0 + (p.s1 - p.s0) * t; p.s.scale.set(sc, sc, 1);
      p.s.material.opacity = p.op * (1 - t);
      continue;
    }
    const sc = 0.7 + t * (p.fire ? 1.2 : 2.2); p.s.scale.set(sc, sc, 1);
    p.s.material.opacity = (p.fire ? 0.75 : 0.5) * (1 - t) * (p.fire ? (0.7 + rnd() * 0.5) : 1);
    if (p.fire) p.s.material.color.setHSL(0.06 + rnd() * 0.03, 1, 0.5);
  }
}
export { hexCss };
