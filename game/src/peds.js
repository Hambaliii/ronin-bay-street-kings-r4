import * as THREE from 'three';
import { rr, ri, pick, chance } from './random.js';
import { groundH } from './world.js';
import { makeFigure, animateFigure } from './player.js';
import { loadHeroAsset } from './assets.js';

// ------------------------------------------------------------------ peds.js
// ~26 pedestrians walking Ronin Bay's sidewalks, with panic reactions.

const SKIN = [0xf0c8a0, 0xe8b48c, 0xc98d64, 0xb97a4e, 0x8a5a34];
const HAIR = ['black topknot', 'red ponytail', 'violet bob', 'buzz', 'silver undercut', 'slick black', 'cap', 'long', 'bun'];
const HAIR_COLORS = [0x14100e, 0x8c2f1d, 0x6a3fa0, 0x2a2a2e, 0xc9ccd4, 0x1a1512, 0x24406e, 0x3a2415, 0x101010];
const TOPS = ['tank', 'hoodie', 'jacket'];
const TOP_COLORS = [0xff5c39, 0x2e6fb7, 0x37b268, 0xf2c230, 0xe879ff, 0xeeeeee, 0x22242a, 0xff8ab0, 0x57b7ff, 0x8a5a34];
const PANTS_COLORS = [0x2c3e57, 0x3a3f47, 0x5b4632, 0x243024, 0x6e7f52, 0x39424e];

// --- GLB citizen models (drop-in pattern) ------------------------------------
// Each entry designates an EXCLUSIVE subset of spawned peds: those whose
// spawn index satisfies idx % every === offset (offset defaults to 0). The
// first matching entry in array order wins, so subsets never overlap.
// Designated peds use that registered GLB instead of the procedural figure,
// once it loads. Procedural stays as the fallback for everyone (and forever,
// on load failure). To add citizen3..6 later: register the asset in
// assets.js and add one entry here with its own offset.
// The citizen GLBs face +Z already (toes extend +z), same as the game's
// heading convention, so no flip is needed; keep the constant so a future
// model that faces -Z is a one-line change.
const PED_GLB_ROT_Y = 0;
const CITIZEN_MODELS = [
  { key: 'citizenWoman', every: 5, offset: 0 },
  { key: 'citizenTeen2', every: 5, offset: 1 },
  { key: 'citizenOffice', every: 5, offset: 2 },
  { key: 'citizenTeen', every: 5, offset: 3 },
  // offset 4 of every 5: no entry — procedural figure (the fallback visual).
];

// citizen-teen.glb ships with NO texture/UVs/material, so its clones all
// share the loader's plain fallback material. Per Bosku's instruction we
// color it in-game pragmatically: ONE single-tone outfit tint per clone
// (no per-part painting), picked deterministically by ped idx from this
// palette so the teen crowd reads as varied hoodies/backpacks.
const TEEN_TINTS = [0x3f8f7a, 0xc96f3f, 0xd9b23f, 0x5a6d8a, 0x7a9a4f, 0x8a4f7d, 0x9aa0a8, 0x4f6db8];
// citizenOffice and citizenTeen2 have NO tint entry: their GLBs are
// textured (office: white shirt + dark trousers; teen2: face + dark hoodie
// + backpack, all baked in), so those clones keep the model's own texture —
// the tint branch in applyGlbVisual below matches citizenTeen only (exact
// key match, so 'citizenTeen2' is never tinted).

function citizenEntryForIndex(i) {
  for (const entry of CITIZEN_MODELS) {
    if (entry && entry.every > 0 && i % entry.every === (entry.offset || 0)) return entry;
  }
  return null;
}

function pedParams() {
  const hi = ri(0, HAIR.length - 1);
  return {
    name: 'Pedestrian',
    skin: pick(SKIN),
    hair: HAIR[hi],
    hairColor: HAIR_COLORS[hi],
    h: rr(0.9, 1.03),
    build: rr(0.38, 0.7),
    outfit: {
      top: pick(TOPS),
      topColor: pick(TOP_COLORS),
      trim: pick(TOP_COLORS),
      pants: chance(0.6) ? 'jeans' : 'cargo',
      pantsColor: pick(PANTS_COLORS),
      shoes: pick([0xffffff, 0x222222, 0xd23b3b, 0x2e6fb7]),
    },
  };
}

function sidewalkPoint(G, nearX, nearZ, minD, maxD) {
  // Pick a random road line + offset, at a random spot along it, biased to be
  // minD..maxD from (nearX, nearZ).
  for (let tries = 0; tries < 24; tries++) {
    const vertical = chance(0.5);
    const line = vertical ? pick(G.roadX) : pick(G.roadZ);
    const off = (chance(0.5) ? -1 : 1) * 17.2;
    const along = rr(-640, 640);
    const x = vertical ? line + off : along;
    const z = vertical ? along : line + off;
    const d = Math.hypot(x - nearX, z - nearZ);
    if (d >= minD && d <= maxD) return { x, z, vertical, line, off };
  }
  const line = pick(G.roadX);
  return { x: line + 17.2, z: rr(-300, 300), vertical: true, line, off: 17.2 };
}

export function initPeds(G) {
  G.peds = [];
  const N = 26;

  // Resolved GLB wrapper templates, by citizen-model key. Filled in async;
  // designated peds are swapped in place whenever a template arrives.
  const citizenTemplates = {};

  function applyGlbVisual(ped) {
    try {
      if (!ped || ped.figIsGlb || !ped.citizenKey) return;
      const template = citizenTemplates[ped.citizenKey];
      if (!template) return;
      const inner = new THREE.Group();
      inner.rotation.y = PED_GLB_ROT_Y;
      const clone = template.clone(true);
      if (ped.citizenKey === 'citizenTeen') {
        // Untextured model: give THIS clone its own material instance(s)
        // tinted with its deterministic outfit hue. (The woman, office and
        // teen2 models have real textures — their clones are never tinted;
        // the exact 'citizenTeen' match above keeps teen2 out of here.)
        const tint = TEEN_TINTS[ped.idx % TEEN_TINTS.length];
        clone.traverse((obj) => {
          if (obj && obj.isMesh && obj.material && obj.material.color) {
            obj.material = obj.material.clone();
            obj.material.color.setHex(tint);
          }
        });
      }
      inner.add(clone);
      if (ped.visual) ped.fig.remove(ped.visual);
      ped.fig.add(inner);
      ped.visual = inner;
      ped.glbInner = inner;
      ped.figIsGlb = true;
    } catch (e) { /* keep the procedural visual */ }
  }

  // Kick off the citizen-model load(s); procedural figures are the fallback
  // until (and unless) each promise resolves with a model.
  for (const entry of CITIZEN_MODELS) {
    try {
      const p = loadHeroAsset(entry.key);
      if (p && typeof p.then === 'function') {
        p.then((wrapper) => {
          try {
            if (!wrapper) return;
            citizenTemplates[entry.key] = wrapper;
            for (const ped of G.peds) applyGlbVisual(ped);
          } catch (e) { /* fallback stays */ }
        }).catch(() => {});
      }
    } catch (e) { /* fallback stays */ }
  }

  function placePed(ped, spot) {
    ped.x = spot.x; ped.z = spot.z;
    ped.vertical = spot.vertical;
    ped.line = spot.line;
    ped.off = spot.off;
    ped.dir = chance(0.5) ? 1 : -1;
    ped.angle = ped.vertical ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  for (let i = 0; i < N; i++) {
    let procFig = null;
    try { procFig = makeFigure(pedParams()); } catch (e) { continue; }
    // Outer group: all walk/idle/panic logic positions and rotates this.
    // The visual child (procedural figure or GLB clone) lives inside it.
    const fig = new THREE.Group();
    fig.add(procFig);
    const citizenEntry = citizenEntryForIndex(i);
    const ped = {
      fig,
      visual: procFig,
      glbInner: null,
      figIsGlb: false,
      citizenKey: citizenEntry ? citizenEntry.key : null,
      idx: i,
      x: 0, z: 0, angle: 0,
      speed: rr(1.2, 1.8),
      phase: rr(0, 10),
      vertical: true, line: 0, off: 17.2, dir: 1,
      panicT: 0, idle: false, sway: rr(0, 6),
    };
    if (i < 6) {
      // Idle groups: HQ apron + Neon Mile corner.
      ped.idle = true;
      if (i < 3) { ped.x = -412.5 + rr(-14, 14); ped.z = 412.5 + rr(-10, 16); }
      else { ped.x = 330 + rr(-16, 16); ped.z = -330 + rr(-16, 16); }
      ped.angle = rr(0, Math.PI * 2);
      if (i === 1 || i === 4) {
        // One phone accessory in each group.
        try {
          const phone = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.16, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.4, emissive: 0x2a4a6a, emissiveIntensity: 0.7 })
          );
          phone.position.set(0.22, 1.05, 0.22);
          procFig.add(phone);
        } catch (e) { /* optional */ }
      }
    } else {
      // Spawn near district centers / HQ / parks so streets feel lived-in.
      const anchors = [
        { x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 },
        { x: -330, z: -330 }, { x: -412.5, z: 412.5 }, { x: 0, z: 0 },
        { x: 250, z: 420 }, { x: -480, z: -255 },
      ];
      const a = pick(anchors);
      placePed(ped, sidewalkPoint(G, a.x, a.z, 0, 190));
    }
    fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
    fig.rotation.y = ped.angle;
    G.scene.add(fig);
    G.peds.push(ped);
    // If the GLB somehow resolved before this ped spawned, use it at once.
    applyGlbVisual(ped);
  }

  G.updaters.push((G2, dt) => {
    const px = G.car ? G.car.x : G.player.x;
    const pz = G.car ? G.car.z : G.player.z;
    const carThreat = G.car && G.flags.inCar && (G.speedKmh || 0) > 40;

    for (const ped of G.peds) {
      const dPlayer = Math.hypot(ped.x - px, ped.z - pz);

      // S10 weapons hooks: downed peds lie tipped until they recover, then
      // teleport to a fresh sidewalk spawn; fleeing peds run from danger.
      if (ped.downed) {
        ped.downedT = (ped.downedT || 0) - dt;
        if (ped.downedT <= 0) {
          ped.downed = false;
          ped._tipped = false;
          ped.hp = 100;
          try { ped.fig.rotation.set(0, ped.angle, 0); } catch (e) {}
          placePed(ped, sidewalkPoint(G, px, pz, 60, 180));
          ped.idle = false;
          ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
          ped.fig.rotation.y = ped.angle;
        }
        continue;
      }
      if (ped.fleeT > 0 && ped.fleeDir) {
        ped.fleeT -= dt;
        ped.x += ped.fleeDir.x * 3.4 * dt;
        ped.z += ped.fleeDir.z * 3.4 * dt;
        ped.angle = Math.atan2(ped.fleeDir.x, ped.fleeDir.z);
        ped.phase += 3.4 * dt * 2.4;
        if (ped.figIsGlb && ped.glbInner) {
          // GLB flee: same walk cycle as the normal GLB walk below, but
          // scaled up for the flee speed — bigger/faster bob (phase already
          // advances at flee pace), wider sway, and a much stronger forward
          // lean (rotation.x tips the top of the +Z-facing model forward).
          try {
            ped.glbInner.position.y = Math.abs(Math.sin(ped.phase)) * 0.06;
            ped.glbInner.rotation.z = Math.sin(ped.phase) * 0.05;
            ped.glbInner.rotation.x = 0.13;
          } catch (e) {}
        } else {
          try { animateFigure(ped.visual, ped.phase, 1.6); } catch (e) {}
        }
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
        ped.fig.rotation.y = ped.angle;
        continue;
      }

      // Respawn far peds near the action.
      if (dPlayer > 350) {
        placePed(ped, sidewalkPoint(G, px, pz, 150, 250));
        ped.idle = false;
      }

      if (ped.idle) {
        ped.sway += dt;
        if (ped.figIsGlb && ped.glbInner) {
          // GLB idle: gentle whole-body bob (ped.sway is accumulated time),
          // with any walk/flee lean and sway relaxed back to neutral.
          try {
            ped.glbInner.position.y = 0.006 * Math.sin(ped.sway * 1.5 + ped.idx);
            ped.glbInner.rotation.z = 0.01 * Math.sin(ped.sway * 0.9 + ped.idx);
            ped.glbInner.rotation.x = 0;
          } catch (e) {}
        } else {
          try { animateFigure(ped.visual, ped.sway * 0.7, 0.12); } catch (e) {}
        }
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
        ped.fig.rotation.y = ped.angle + Math.sin(ped.sway * 0.4) * 0.15;
        continue;
      }

      // Panic reaction to a fast car closing in.
      if (carThreat && dPlayer < 6) ped.panicT = 0.9;
      let moveSpeed = ped.speed;
      let perpSidestep = 0;
      if (ped.panicT > 0) {
        ped.panicT -= dt;
        moveSpeed = ped.speed * 2.1;
        // Sidestep away from the car, perpendicular to travel.
        const away = Math.sign((ped.x - px) * Math.cos(ped.angle) - (ped.z - pz) * Math.sin(ped.angle)) || 1;
        perpSidestep = away * 2.4;
      }

      // Advance along the sidewalk line.
      const alongDelta = ped.dir * moveSpeed * dt;
      if (ped.vertical) {
        ped.z += alongDelta;
        ped.x = ped.line + ped.off + perpSidestep * dt * 3;
      } else {
        ped.x += alongDelta;
        ped.z = ped.line + ped.off + perpSidestep * dt * 3;
      }
      ped.phase += moveSpeed * dt * 2.4;

      // Random turn at intersections (crossing road lines).
      const crossLines = ped.vertical ? G.roadZ : G.roadX;
      const along = ped.vertical ? ped.z : ped.x;
      for (const cl of crossLines) {
        if (Math.abs(along - cl) < 1.2 && chance(0.012)) {
          // Turn onto the crossing road.
          const oldLine = ped.line, oldOff = ped.off;
          ped.vertical = !ped.vertical;
          ped.line = cl;
          ped.off = (chance(0.5) ? -1 : 1) * 17.2;
          ped.dir = chance(0.5) ? 1 : -1;
          if (ped.vertical) { ped.x = ped.line + ped.off; ped.z = oldLine + oldOff; }
          else { ped.z = ped.line + ped.off; ped.x = oldLine + oldOff; }
          break;
        }
      }
      // Bounce at the island edge.
      if (ped.x > 640 || ped.x < -640 || ped.z > 640 || ped.z < -640) {
        ped.dir *= -1;
        ped.x = THREE.MathUtils.clamp(ped.x, -638, 638);
        ped.z = THREE.MathUtils.clamp(ped.z, -638, 638);
      }
      ped.angle = ped.vertical
        ? (ped.dir > 0 ? 0 : Math.PI)
        : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);

      // Soft push vs the on-foot player.
      if (!G.flags.inCar && dPlayer < 1.1 && dPlayer > 0.001) {
        const push = (1.1 - dPlayer) * 2.2 * dt;
        ped.x += ((ped.x - px) / dPlayer) * push;
        ped.z += ((ped.z - pz) / dPlayer) * push;
      }

      if (ped.figIsGlb && ped.glbInner) {
        // GLB walk: the static GLB mesh must read as WALKING, not gliding —
        // whole-body vertical bob + lateral sway (rotation.z) + a slight
        // forward lean (rotation.x) on the inner wrapper, all on the same
        // phase the procedural call would have used, and scaled by the
        // ped's current speed state: panic (moveSpeed ~2.1x, see above)
        // bobs higher, sways wider and leans further; the flee branch
        // above leans/bobs harder still. While panicking, the extra hop
        // spike stands in for the procedural arm-flail (which reads the
        // figure's userData parts and must never run on a GLB visual).
        try {
          const panicking = ped.panicT > 0;
          let bobY = Math.abs(Math.sin(ped.phase)) * 0.04;
          if (panicking) bobY += Math.abs(Math.sin(ped.phase * 1.7)) * 0.06;
          ped.glbInner.position.y = bobY;
          ped.glbInner.rotation.z = Math.sin(ped.phase) * (panicking ? 0.05 : 0.04);
          ped.glbInner.rotation.x = panicking ? 0.10 : 0.05;
        } catch (e) {}
      } else {
        try { animateFigure(ped.visual, ped.phase, ped.panicT > 0 ? 1.6 : 0.55); } catch (e) {}
      }
      ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
      ped.fig.rotation.y = ped.angle;
    }
  });
}
