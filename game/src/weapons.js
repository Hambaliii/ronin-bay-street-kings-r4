import * as THREE from 'three';
import { rr, chance } from './random.js';
import { groundH, glowSprite } from './world.js';
import { damageVehicle, spawnSmokeAt } from './cars.js';
import { loadHeroAsset, HERO_ASSETS } from './assets.js';

// ---------------------------------------------------------------- weapons.js
// Free shooting system (S10): pistol / micro SMG / baseball bat.
// SEPARABLE layer: everything works through defensive hooks into existing
// state (G.wanted, G.peds, G.vehicles, damageVehicle, spawnSmokeAt). Remove
// the initWeapons(G) call in main.js and the game runs exactly as before.
// GLB weapon models are drop-ins: if the .glb files are absent, the
// procedural shapes below stay — silently.

export const WEAPON_TABLE = {
  pistol: { name: 'PISTOL', dmg: 34, interval: 0.34, auto: false, mag: 12, reload: 0.9, range: 130, spread: 0.006 },
  smg: { name: 'MICRO SMG', dmg: 15, interval: 0.085, auto: true, mag: 30, reload: 1.3, range: 110, spread: 0.02 },
  bat: { name: 'BASEBALL BAT', dmg: 55, interval: 0.55, auto: false, mag: Infinity, reload: 0, range: 2.4, melee: true },
};
const ORDER = ['pistol', 'smg', 'bat'];
const GLB_FOR = { pistol: 'weaponPistol', smg: 'weaponSmg', bat: 'weaponBat' };

// ---------------------------------------------------------- GLB orientation
// Tripo weapon GLBs do not share the game's axes (held root on the player
// fig sits at (0.24, 1.02, 0.28) and points +Z). WEAPON_POSE corrects each
// model INSIDE its per-weapon group, relative to that root. Procedural
// children are untouched, so the fallback is exact when a GLB is absent.
// SMG muzzle direction is the one uncertain call (see below): flipping it
// is this single constant.
const SMG_ROT_Y = Math.PI;
export const WEAPON_POSE = {
  // Pistol bounds x +-0.5, y 0..0.661, z +-0.266: barrel along X, muzzle
  // at +X, grip/rear at -X, up +Y. rotY -PI/2 maps +X -> +Z (forward).
  // Offset: model height 0.661 * scale 0.30 ~= 0.20 m; the hand grips the
  // rear-lower part, so shift the wrapper down/back by this amount in the
  // weapon group's local space.
  pistol: { rotY: -Math.PI / 2, offset: new THREE.Vector3(0, -0.10, -0.02) },
  // SMG bounds x +-0.068, y 0..0.703, z +-0.5: barrel along Z, muzzle
  // believed at -Z (tall thin front-sight slice at z -0.5, grip drops at
  // z -0.2..-0.1, long magazine drops to y=0 at z +0.2..+0.3, buttstock
  // at z +0.4..+0.5). rotY PI maps -Z -> +Z. Hand position: under the
  // receiver near the grip — after the PI flip the grip (model z
  // -0.2..-0.1, * scale 0.55 = -0.11..-0.055) lands at group z
  // +0.055..+0.11 and the receiver underside sits ~0.13 m above the hand
  // origin, hence offset (0, -0.13, +0.03) centres the grip in the palm.
  // Verify with the 'smg' shot mode; if the muzzle faces the player,
  // set SMG_ROT_Y = 0.
  smg: { rotY: SMG_ROT_Y, offset: new THREE.Vector3(0, -0.13, 0.03) },
  // Bat bounds x +-0.5, y 0..0.844, z +-0.074: posed diagonally in XY.
  // axisFrom A = barrel->knob principal axis; axisTo D is where A must
  // land so knob->barrel ends up ~(0, +0.75, -0.66) — up-and-back over
  // the shoulder, matching the procedural bat's rest pose. knobLocal is
  // the knob position in model space; the holder is then translated by
  // -R*(knobLocal * batScale) so the knob lands on the group origin.
  bat: {
    axisFrom: new THREE.Vector3(-0.775, -0.631, 0.001).normalize(),
    axisTo: new THREE.Vector3(0, -0.75, 0.66).normalize(),
    knobLocal: new THREE.Vector3(-0.49, 0.02, 0),
  },
};

// Build the oriented holder for one weapon's GLB wrapper. The holder is a
// child of the per-weapon group, so recoil (group position) and the bat
// swing (group rotation.x) carry the GLB exactly like the procedural mesh.
function orientWrapper(id, holder, wrapper) {
  const pose = WEAPON_POSE[id];
  if (!pose) { holder.add(wrapper); return; }
  if (id === 'bat') {
    const R = new THREE.Quaternion().setFromUnitVectors(pose.axisFrom, pose.axisTo);
    holder.quaternion.copy(R);
    const batScale = (HERO_ASSETS.weaponBat && HERO_ASSETS.weaponBat.scale) || 0.72;
    const knobScaled = pose.knobLocal.clone().multiplyScalar(batScale);
    holder.position.copy(knobScaled.applyQuaternion(R)).negate();
    holder.add(wrapper);
  } else {
    wrapper.rotation.y = pose.rotY;
    wrapper.position.copy(pose.offset);
    holder.add(wrapper);
  }
}

function vPos(v) {
  // Vehicle position: v.x/v.z mirror the mesh (verified in cars.js
  // spawnVehicle: v = { ..., x, z } and the traffic/drive updaters keep
  // them in sync); fall back to mesh.position when absent.
  if (v && Number.isFinite(v.x) && Number.isFinite(v.z)) return { x: v.x, z: v.z, y: v.mesh ? v.mesh.position.y : 0 };
  if (v && v.mesh && v.mesh.position) return { x: v.mesh.position.x, z: v.mesh.position.z, y: v.mesh.position.y };
  return null;
}

const STAR_TEX_SIZE = 128; // Vice V3 sweep: muzzle-star canvas size, named for starTexture()
function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = STAR_TEX_SIZE;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)');
  gr.addColorStop(0.35, 'rgba(255,190,90,.75)');
  gr.addColorStop(1, 'rgba(255,150,40,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,230,170,.9)'; g.lineWidth = 5; g.lineCap = 'round';
  for (const [dx, dy] of [[52, 0], [-52, 0], [0, 52], [0, -52], [34, 34], [-34, -34], [34, -34], [-34, 34]]) {
    g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + dx, 64 + dy); g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

function box(w, h, d, color, metal) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: metal == null ? 0.6 : metal })
  );
  return m;
}

function buildProcedural(id) {
  const grp = new THREE.Group();
  const dark = 0x1a1c20;
  if (id === 'pistol') {
    const slide = box(0.055, 0.07, 0.24, dark); slide.position.set(0, 0.03, 0.05); grp.add(slide);
    const grip = box(0.05, 0.13, 0.06, 0x111214, 0.3); grip.position.set(0, -0.05, -0.05); grip.rotation.x = 0.25; grp.add(grip);
  } else if (id === 'smg') {
    const body = box(0.06, 0.09, 0.34, dark); body.position.set(0, 0.02, 0.06); grp.add(body);
    const mag = box(0.045, 0.16, 0.06, 0x24262b); mag.position.set(0, -0.08, 0.02); mag.rotation.x = 0.15; grp.add(mag);
    const sup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7 })
    );
    sup.rotation.x = Math.PI / 2; sup.position.set(0, 0.03, 0.29); grp.add(sup);
  } else { // bat
    const geo = new THREE.CylinderGeometry(0.032, 0.02, 0.85, 10);
    const bat = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb08954, roughness: 0.7, metalness: 0.05 }));
    bat.rotation.x = Math.PI / 2 - 0.5; bat.position.set(0, 0.12, 0.18); grp.add(bat);
  }
  return grp;
}

// Closest approach between a ray (o + t*d, t>=0) and a segment a..b.
// Returns { t, h } where h is the height of the closest point on the segment
// above the segment base, or null when the ray passes behind.
function raySegment(o, d, a, b) {
  const u = new THREE.Vector3().subVectors(b, a);
  const w0 = new THREE.Vector3().subVectors(o, a);
  const A = d.dot(d), B = d.dot(u), C = u.dot(u), D = d.dot(w0), E = u.dot(w0);
  const den = A * C - B * B;
  let t = 0, s = 0;
  if (Math.abs(den) > 1e-8) {
    t = (B * E - C * D) / den;
    s = (A * E - B * D) / den;
  }
  t = Math.max(0, t); s = Math.min(1, Math.max(0, s));
  const pRay = new THREE.Vector3().copy(o).addScaledVector(d, t);
  const pSeg = new THREE.Vector3().copy(a).addScaledVector(u, s);
  return { t, dist: pRay.distanceTo(pSeg), h: pSeg.y - a.y, point: pSeg };
}

export function initWeapons(G) {
  try {
    if (!G || G.weapons) return;
    const W = {
      current: 'pistol',
      ammo: {
        pistol: { mag: 12, reserve: Infinity },
        smg: { mag: 30, reserve: 240 },
        bat: { mag: Infinity, reserve: Infinity },
      },
      reloading: 0,
      equip,
    };
    G.weapons = W;

    const S = {
      firing: false, semiLatch: false, cooldown: 0, autoShots: 0,
      lastEsc: -10, swingT: 0, flashLife: 0, hitMarkT: 0,
      held: {}, tracers: [], flatVehicles: new Set(), slotDirty: true,
    };

    // ------------------------------------------------------------ held models
    const heldRoot = new THREE.Group();
    heldRoot.position.set(0.24, 1.02, 0.28);
    try { if (G.player && G.player.fig) G.player.fig.add(heldRoot); } catch (e) {}
    for (const id of ORDER) {
      const grp = buildProcedural(id);
      grp.visible = false;
      heldRoot.add(grp);
      S.held[id] = grp;
      // Oriented holder for the GLB drop-in: a child of the per-weapon
      // group (so swing/recoil on the group carries it). Empty — and
      // therefore invisible — while the procedural fallback is in use.
      const holder = new THREE.Group();
      holder.name = 'glbHolder:' + id;
      grp.add(holder);
      // GLB drop-in: swap children when (if) the model arrives. Remove
      // the procedural children only (keep the holder), then put the
      // wrapper into the holder with its WEAPON_POSE orientation.
      try {
        const p = loadHeroAsset(GLB_FOR[id]);
        if (p && typeof p.then === 'function') {
          p.then((wrapper) => {
            try {
              if (!wrapper) return;
              for (const child of [...grp.children]) {
                if (child !== holder) grp.remove(child);
              }
              orientWrapper(id, holder, wrapper);
            } catch (e) { /* procedural stays */ }
          }).catch(() => {});
        }
      } catch (e) { /* procedural stays */ }
    }

    // ------------------------------------------------------------ muzzle FX
    const flash = new THREE.Group();
    try {
      const tex = starTexture();
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: 0xffc873 });
      const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), mat);
      const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), mat); p2.rotation.z = Math.PI / 4; p2.rotation.y = Math.PI / 2;
      flash.add(p1); flash.add(p2);
      const glow = glowSprite(0xffc873, 1.6); flash.add(glow);
    } catch (e) {}
    const flashLight = new THREE.PointLight(0xffc873, 0, 18);
    flash.add(flashLight);
    flash.visible = false;
    try { G.scene.add(flash); } catch (e) {}

    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.02, 1),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.visible = false;
      try { G.scene.add(m); } catch (e) {}
      S.tracers.push({ mesh: m, life: 0 });
    }
    let tracerIdx = 0;

    // ------------------------------------------------------------ DOM
    let crossEl = null, slotEl = null, slotName = null, slotAmmo = null;
    try {
      const style = document.createElement('style');
      style.textContent =
        '#crosshair{position:fixed;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;pointer-events:none;z-index:60;mix-blend-mode:difference;display:none}' +
        '#crosshair .ring{position:absolute;inset:0;border:2px solid #fff;border-radius:50%;opacity:.85}' +
        '#crosshair .dot{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#fff;border-radius:50%}' +
        '#crosshair.hit .ring{border-color:#ff9a2a}#crosshair.hit .dot{background:#ff9a2a}' +
        '#crosshair.bat .ring{display:none}';
      document.head.appendChild(style);
      crossEl = document.createElement('div'); crossEl.id = 'crosshair';
      crossEl.innerHTML = '<div class="ring"></div><div class="dot"></div>';
      document.body.appendChild(crossEl);
      slotEl = document.createElement('div'); slotEl.id = 'weaponSlot';
      slotEl.style.cssText = 'position:fixed;right:236px;bottom:18px;z-index:60;background:rgba(8,12,20,.72);border:1px solid rgba(0,245,212,.35);border-radius:12px;padding:8px 12px;font-family:system-ui,sans-serif;color:#e8f6ff;pointer-events:none;min-width:118px;text-align:right';
      slotEl.innerHTML = '<div id="wsName" style="font-size:11px;letter-spacing:.14em;color:#00f5d4"></div>' +
        '<div id="wsAmmo" style="font-size:22px;font-weight:700;line-height:1.15"></div>' +
        '<div style="font-size:10px;opacity:.65">[1][2][3] &middot; R reload</div>';
      document.body.appendChild(slotEl);
      slotName = slotEl.querySelector('#wsName');
      slotAmmo = slotEl.querySelector('#wsAmmo');
    } catch (e) { /* HUD is best-effort */ }

    function fmtAmmo() {
      const a = W.ammo[W.current];
      if (!WEAPON_TABLE[W.current].melee) return a.mag + ' / ' + (a.reserve === Infinity ? '\u221E' : a.reserve);
      return '\u221E';
    }
    function refreshSlot() {
      if (!S.slotDirty) return;
      S.slotDirty = false;
      try {
        if (slotName) slotName.textContent = WEAPON_TABLE[W.current].name + (W.reloading > 0 ? ' \u00B7 RELOADING' : '');
        if (slotAmmo) slotAmmo.textContent = fmtAmmo();
        if (crossEl) crossEl.className = (W.current === 'bat' ? 'bat' : '') + (S.hitMarkT > 0 ? ' hit' : '');
      } catch (e) {}
    }

    function equip(id) {
      if (!WEAPON_TABLE[id]) return;
      W.current = id;
      W.reloading = 0;
      S.slotDirty = true;
      for (const k of ORDER) if (S.held[k]) S.held[k].visible = (k === id);
      refreshSlot();
    }

    // ------------------------------------------------------------ helpers
    function shooterPos() {
      if (G.car) { const p = vPos(G.car); if (p) return p; }
      if (G.player) return { x: G.player.x, z: G.player.z, y: 0 };
      return { x: 0, z: 0, y: 0 };
    }
    function muzzlePos() {
      try {
        if (G.car && G.car.mesh) return G.car.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
        const p = G.player; if (!p) return new THREE.Vector3();
        const a = p.angle || 0;
        const gy = groundH(p.x, p.z);
        return new THREE.Vector3(
          p.x + Math.sin(a) * 0.35 + Math.cos(a) * 0.18,
          gy + 1.32,
          p.z + Math.cos(a) * 0.35 - Math.sin(a) * 0.18
        );
      } catch (e) { return new THREE.Vector3(); }
    }
    function play(name) { try { if (G.audio && G.audio.play) G.audio.play(name); } catch (e) {} }

    function addWanted(amount) {
      try {
        const now = G.elapsed || 0;
        if (now - S.lastEsc < 0.4) return; // 0.4s escalation cooldown
        S.lastEsc = now;
        G.wanted = Math.min(5, Math.max(0, (G.wanted || 0) + amount));
      } catch (e) {}
    }
    function anyWitness(rCop, rPed, sx, sz) {
      try {
        for (const c of G.cops || []) { const p = vPos(c); if (p && Math.hypot(p.x - sx, p.z - sz) < rCop) return true; }
        for (const pd of G.peds || []) { if (!pd.downed && Math.hypot(pd.x - sx, pd.z - sz) < rPed) return true; }
      } catch (e) {}
      return false;
    }
    function fleePed(ped, fromX, fromZ, t) {
      const dx = ped.x - fromX, dz = ped.z - fromZ;
      const len = Math.hypot(dx, dz) || 1;
      ped.fleeDir = { x: dx / len, z: dz / len };
      ped.fleeT = t;
    }
    function witnessesFlee(fromX, fromZ, radius, tMin, tMax, prob) {
      try {
        for (const pd of G.peds || []) {
          if (pd.downed) continue;
          if (Math.hypot(pd.x - fromX, pd.z - fromZ) < radius && (prob == null || chance(prob))) {
            fleePed(pd, fromX, fromZ, rr(tMin, tMax));
          }
        }
      } catch (e) {}
    }
    function downPed(ped) {
      ped.downed = true;
      ped.downedT = rr(6, 10);
      ped._tipped = true;
      ped.fleeT = 0;
      try {
        ped.fig.rotation.x = -1.35;
        ped.fig.position.y = groundH(ped.x, ped.z) + 0.15;
      } catch (e) {}
    }
    function damagePed(ped, dmg, isBat, sx, sz) {
      if (ped.hp == null) ped.hp = 100;
      ped.hp -= dmg;
      if (ped.hp <= 0 || isBat) { downPed(ped); return true; }
      fleePed(ped, sx, sz, 1.6);
      return false;
    }

    function showFlash(pos) {
      try {
        flash.position.copy(pos);
        flash.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        flash.visible = true;
        flashLight.intensity = 26;
        S.flashLife = 0.05;
      } catch (e) {}
    }
    function showTracer(from, to) {
      const tr = S.tracers[tracerIdx++ % S.tracers.length];
      if (!tr) return;
      const len = from.distanceTo(to);
      if (len < 0.5) return;
      tr.mesh.position.copy(from).add(to).multiplyScalar(0.5);
      tr.mesh.lookAt(to);
      tr.mesh.scale.set(1, 1, len);
      tr.mesh.material.opacity = 0.85;
      tr.mesh.visible = true;
      tr.life = 0.04;
    }

    // ------------------------------------------------------------ shooting
    function startReload() {
      const spec = WEAPON_TABLE[W.current];
      const a = W.ammo[W.current];
      if (spec.melee || W.reloading > 0) return;
      if (a.mag >= spec.mag || a.reserve <= 0) return;
      W.reloading = spec.reload;
      S.slotDirty = true;
      play('reload');
    }

    function fireBat() {
      const spec = WEAPON_TABLE.bat;
      S.swingT = 0.22;
      play('swing');
      const sp = shooterPos();
      const a = G.car ? (G.car.angle || 0) : (G.player ? G.player.angle || 0 : 0);
      const fx = Math.sin(a), fz = Math.cos(a);
      let hitSomething = false;
      try {
        for (const ped of G.peds || []) {
          if (ped.downed) continue;
          const dx = ped.x - sp.x, dz = ped.z - sp.z;
          const d = Math.hypot(dx, dz);
          if (d <= spec.range && d > 0.001 && (dx / d) * fx + (dz / d) * fz > 0.4) {
            damagePed(ped, spec.dmg, true, sp.x, sp.z);
            hitSomething = true;
          }
        }
      } catch (e) {}
      try {
        for (const v of [...(G.vehicles || []), ...(G.cops || []), ...(G.traffic || [])]) {
          if (G.car && v === G.car) continue;
          const p = vPos(v); if (!p) continue;
          if (Math.hypot(p.x - sp.x, p.z - sp.z) <= spec.range + 1.2) {
            try { damageVehicle(G, v, spec.dmg); } catch (e) {}
            hitSomething = true;
            // Bat is silent unless a cop is close to the hit.
            let copNear = false;
            for (const c of G.cops || []) { const cp = vPos(c); if (cp && Math.hypot(cp.x - p.x, cp.z - p.z) < 25) { copNear = true; break; } }
            if (copNear) addWanted(0.4);
          }
        }
      } catch (e) {}
      if (hitSomething) {
        play('thud');
        witnessesFlee(sp.x, sp.z, 6, 1.2, 2.2, 0.4);
        S.hitMarkT = 0.09; S.slotDirty = true;
      }
    }

    function fireGun() {
      const id = W.current;
      const spec = WEAPON_TABLE[id];
      const a = W.ammo[id];
      if (a.mag <= 0) {
        if (a.reserve > 0) { startReload(); }
        else { play('dry'); try { if (G.toast) G.toast('Out of ammo'); } catch (e) {} }
        return;
      }
      a.mag--;
      S.slotDirty = true;
      play(id === 'smg' ? 'smg' : 'shot');
      if (!G.car && G.player) { try { G.player.angle = G.camYaw; } catch (e) {} }

      const origin = new THREE.Vector3();
      const dir = new THREE.Vector3();
      try {
        G.camera.getWorldPosition(origin);
        G.camera.getWorldDirection(dir);
      } catch (e) { return; }
      // Spread: jitter the direction on its perpendicular plane.
      if (spec.spread > 0) {
        const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
        const r1 = new THREE.Vector3().crossVectors(dir, up).normalize();
        const r2 = new THREE.Vector3().crossVectors(dir, r1).normalize();
        dir.addScaledVector(r1, rr(-spec.spread, spec.spread)).addScaledVector(r2, rr(-spec.spread, spec.spread)).normalize();
      }
      const muzzle = muzzlePos();
      showFlash(muzzle);
      const sp = shooterPos();

      // --- hitscan: peds ---
      let bestT = spec.range, bestHit = null;
      try {
        for (const ped of G.peds || []) {
          if (ped.downed) continue;
          const gy = groundH(ped.x, ped.z);
          const segA = new THREE.Vector3(ped.x, gy + 0.2, ped.z);
          const segB = new THREE.Vector3(ped.x, gy + 1.6, ped.z);
          const r = raySegment(origin, dir, segA, segB);
          if (r && r.dist < 0.42 && r.t < bestT) { bestT = r.t; bestHit = { kind: 'ped', ped, point: r.point, head: r.h > 1.45 }; }
        }
      } catch (e) {}
      // --- hitscan: vehicles ---
      try {
        const all = [...(G.vehicles || []), ...(G.cops || []), ...(G.traffic || [])];
        for (const v of all) {
          if (G.car && v === G.car) continue;
          const p = vPos(v); if (!p) continue;
          const specV = v.spec || {};
          const rad = Math.max(specV.len || 4, specV.wid || 1.8) / 2 * 0.9;
          const centre = new THREE.Vector3(p.x, (p.y || groundH(p.x, p.z)) + 0.55, p.z);
          const oc = new THREE.Vector3().subVectors(origin, centre);
          const b = oc.dot(dir);
          const c = oc.lengthSq() - rad * rad;
          const disc = b * b - c;
          if (disc < 0) continue;
          const t = -b - Math.sqrt(disc);
          if (t > 0 && t < bestT) {
            bestT = t;
            bestHit = { kind: 'vehicle', v, point: new THREE.Vector3().copy(origin).addScaledVector(dir, t) };
          }
        }
      } catch (e) {}
      // --- ground plane ---
      let groundPoint = null;
      if (dir.y < -0.001) {
        const t = -origin.y / dir.y;
        if (t > 0 && t <= spec.range) groundPoint = new THREE.Vector3().copy(origin).addScaledVector(dir, t);
      }
      const endPoint = bestHit ? bestHit.point : (groundPoint || new THREE.Vector3().copy(origin).addScaledVector(dir, spec.range));
      showTracer(muzzle, endPoint);

      // --- resolve hit ---
      let hitPedOrCop = false;
      if (bestHit && bestHit.kind === 'ped') {
        const dmg = spec.dmg * (bestHit.head ? 2 : 1);
        damagePed(bestHit.ped, dmg, false, sp.x, sp.z);
        S.hitMarkT = 0.09; S.slotDirty = true;
        addWanted(0.5); hitPedOrCop = true;
        witnessesFlee(bestHit.ped.x, bestHit.ped.z, 14, 1.2, 2.2, null);
      } else if (bestHit && bestHit.kind === 'vehicle') {
        const v = bestHit.v;
        try { damageVehicle(G, v, spec.dmg); } catch (e) {}
        try { spawnSmokeAt(G, bestHit.point, 2, false); } catch (e) {}
        S.hitMarkT = 0.09; S.slotDirty = true;
        // Tire check: low hit near a wheel approximation flattens a tire.
        try {
          const p = vPos(v);
          const specV = v.spec || {};
          const len = specV.len || 4, wid = specV.wid || 1.8;
          const va = v.angle || 0;
          const fx = Math.sin(va), fz = Math.cos(va), rx = Math.cos(va), rz = -Math.sin(va);
          if (bestHit.point.y - groundH(p.x, p.z) < 0.45) {
            for (const s1 of [1, -1]) for (const s2 of [1, -1]) {
              const wx = p.x + fx * len * 0.32 * s1 + rx * (wid / 2) * s2;
              const wz = p.z + fz * len * 0.32 * s1 + rz * (wid / 2) * s2;
              if (Math.hypot(bestHit.point.x - wx, bestHit.point.z - wz) < 0.45) { v.tireFlat = 5; S.flatVehicles.add(v); break; }
            }
          }
        } catch (e) {}
        const isCop = (v.driver === 'cop') || (G.cops || []).includes(v);
        if (isCop) { addWanted(0.8); hitPedOrCop = true; }
      } else if (groundPoint && (!bestHit || bestT >= spec.range)) {
        try { spawnSmokeAt(G, groundPoint, 2, false); } catch (e) {}
      }
      // Witnessed gunfire escalates even on a miss.
      if (!hitPedOrCop) {
        S.autoShots++;
        if (S.autoShots >= 5 || !spec.auto) {
          S.autoShots = 0;
          if (anyWitness(70, 30, sp.x, sp.z)) addWanted(0.25);
        }
      }
      // Recoil kick on the held model.
      try { const grp = S.held[id]; if (grp) grp.position.z = -0.03; } catch (e) {}
    }

    function tryFire() {
      if (G.mode !== 'play' || G.paused) return;
      if (W.reloading > 0 || S.cooldown > 0) return;
      const spec = WEAPON_TABLE[W.current];
      S.cooldown = spec.interval;
      if (spec.melee) fireBat(); else fireGun();
    }

    // ------------------------------------------------------------ input
    const canvas = G.canvas || (G.renderer && G.renderer.domElement) || null;
    function onDown(e) {
      if (e.button !== 0) return;
      if (G.mode !== 'play' || G.paused) return;
      S.firing = true;
      if (!WEAPON_TABLE[W.current].auto) {
        if (!S.semiLatch) { S.semiLatch = true; tryFire(); }
      } else tryFire();
    }
    function onUp(e) { if (e.button === 0) { S.firing = false; S.semiLatch = false; } }
    try {
      if (canvas && canvas.addEventListener) canvas.addEventListener('pointerdown', onDown);
      else if (typeof window !== 'undefined') window.addEventListener('pointerdown', onDown);
      if (typeof window !== 'undefined') {
        window.addEventListener('pointerup', onUp);
        window.addEventListener('blur', onUp);
      }
    } catch (e) {}
    try {
      window.addEventListener('keydown', (e) => {
        if (G.mode !== 'play' || G.paused) return;
        if (e.code === 'Digit1') equip('pistol');
        else if (e.code === 'Digit2') equip('smg');
        else if (e.code === 'Digit3') equip('bat');
        else if (e.code === 'KeyQ') {
          const i = ORDER.indexOf(W.current);
          equip(ORDER[(i + 1) % ORDER.length]);
        } else if (e.code === 'KeyR') startReload();
      });
    } catch (e) {}

    equip('pistol');

    // ------------------------------------------------------------ updater
    G.updaters.push((G2, dt) => {
      try {
        if (S.cooldown > 0) S.cooldown -= dt;
        if (W.reloading > 0) {
          W.reloading -= dt;
          if (W.reloading <= 0) {
            W.reloading = 0;
            const spec = WEAPON_TABLE[W.current];
            const a = W.ammo[W.current];
            const need = spec.mag - a.mag;
            const take = a.reserve === Infinity ? need : Math.min(need, a.reserve);
            a.mag += take;
            if (a.reserve !== Infinity) a.reserve -= take;
            S.slotDirty = true;
          }
        }
        if (S.firing && WEAPON_TABLE[W.current].auto) tryFire();
        if (S.hitMarkT > 0) { S.hitMarkT -= dt; if (S.hitMarkT <= 0) S.slotDirty = true; }

        // Held weapon visibility: on foot only.
        const onFoot = !G.car && G.mode === 'play';
        if (heldRoot.parent !== (G.player && G.player.fig)) {
          try { if (G.player && G.player.fig) G.player.fig.add(heldRoot); } catch (e) {}
        }
        heldRoot.visible = !!onFoot;
        // Recoil decay + bat swing animation.
        const grp = S.held[W.current];
        if (grp) {
          grp.position.z += (0 - grp.position.z) * Math.min(1, dt * 14);
          if (W.current === 'bat') {
            if (S.swingT > 0) {
              S.swingT -= dt;
              const ph = 1 - Math.max(0, S.swingT) / 0.22; // 0..1
              grp.rotation.x = ph < 0.55 ? -0.4 - (ph / 0.55) * 1.5 : -1.9 + ((ph - 0.55) / 0.45) * 1.5;
            } else grp.rotation.x = -0.4;
          }
        }

        // Muzzle flash decay / screenshot hold.
        const ff = G.flags && G.flags.forceFlash;
        if (ff) {
          try {
            let pos = null;
            if (ff === 'car' && G.flags.flashCar && G.flags.flashCar.mesh) {
              pos = G.flags.flashCar.mesh.localToWorld(new THREE.Vector3(0.55, 0.8, 0.2));
            } else pos = muzzlePos();
            flash.position.copy(pos);
            flash.visible = true;
            flashLight.intensity = 26;
          } catch (e) {}
        } else if (S.flashLife > 0) {
          S.flashLife -= dt;
          flashLight.intensity = Math.max(0, S.flashLife / 0.05) * 26;
          if (S.flashLife <= 0) { flash.visible = false; flashLight.intensity = 0; }
        } else if (flash.visible) { flash.visible = false; flashLight.intensity = 0; }

        // Tracers.
        for (const tr of S.tracers) {
          if (tr.life > 0) {
            tr.life -= dt;
            tr.mesh.material.opacity = Math.max(0, tr.life / 0.04) * 0.85;
            if (tr.life <= 0) tr.mesh.visible = false;
          }
        }
        // Flat tires: tilt while active, restore after.
        if (S.flatVehicles.size) {
          for (const v of [...S.flatVehicles]) {
            try {
              if (v.tireFlat > 0) { v.tireFlat -= dt; if (v.mesh) v.mesh.rotation.z = 0.03; }
              else { if (v.mesh) v.mesh.rotation.z = 0; S.flatVehicles.delete(v); }
            } catch (e) { S.flatVehicles.delete(v); }
          }
        }
        // Crosshair visibility.
        try {
          if (crossEl) crossEl.style.display = (G.mode === 'play' && !G.paused) ? 'block' : 'none';
          if (slotEl) slotEl.style.display = (G.mode === 'play') ? 'block' : 'none';
        } catch (e) {}
        refreshSlot();
      } catch (e) { /* weapons must never break the loop */ }
    });
  } catch (e) {
    // Separable layer: on any init failure the game continues unarmed.
    try { if (G && !G.weapons) G.weapons = null; } catch (e2) {}
  }
}
