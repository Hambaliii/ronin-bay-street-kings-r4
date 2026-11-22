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
  const gm = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid + 1.6, spec.len + 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), color: glowColor, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
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

export function spawnVehicle(G, specId, x, z, angle, opts) {
  opts = opts || {};
  const spec = { ...CARS[specId], id: specId };
  const isHeroCar = HERO_CAR_SPECS.has(specId);
  const isGtrCar = GTR_SPECS.has(specId);
  const mesh = isGtrCar && gtrWrapper ? makeGtrCarMesh(spec, opts) : isHeroCar && heroCarWrapper ? makeGlbCarMesh(spec, opts) : makeCarMesh(spec, opts.color, opts);
  mesh.position.set(x, groundH(x, z) + 0.02, z); mesh.rotation.y = angle || 0;
  G.scene.add(mesh);
  const v = { spec, specId, mesh, angle: angle || 0, speed: 0, health: 100, driver: opts.driver || 'parked', color: opts.color != null ? opts.color : spec.color, wheels: mesh.userData.wheels, steerVis: 0, x, z, target: null, lane: opts.lane || 0, smokeT: 0 };
  if (isHeroCar && !heroCarWrapper && !heroCarSettled) {
    v._procChildren = new Set(mesh.children); // snapshot for the in-place swap
    heroCarPending.push({ v, spec, glow: opts.glow });
  }
  if (isGtrCar && !gtrWrapper && !gtrSettled) {
    v._procChildren = new Set(mesh.children); // snapshot for the in-place swap
    gtrPending.push({ v, spec, glow: opts.glow });
  }
  if (!G.vehicles) G.vehicles = [];
  G.vehicles.push(v);
  return v;
}
// --- traffic ---
const TRAFFIC_COLORS = [0xb9c0c7, 0x3f8cff, 0xd95555, 0x44484e, 0xf2f2f2, 0x5a7d4f, 0xffd23f, 0x707880, 0x8a4fd0, 0x2a9d8f];
const TRAFFIC_IDS = ['sedan', 'hatch', 'suv', 'wagon', 'kei', 'hachi', 'van', 'sora15', 'roadster', 'taxi'];
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
    const v = spawnVehicle(G, specId, x, z, angle, { color: pick(TRAFFIC_COLORS), driver: 'traffic' });
    if (specId === 'sedan') {
      const tintHex = NPC_SEDAN_TINTS[npcSedanSpawnIndex % NPC_SEDAN_TINTS.length];
      npcSedanSpawnIndex++;
      applyNpcSedanGlb(v, tintHex);
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
