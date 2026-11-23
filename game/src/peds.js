import * as THREE from 'three';
import { rr, ri, pick, chance } from './random.js';
import { groundH } from './world.js';
import { makeFigure, animateFigure } from './player.js';
import { loadHeroAsset } from './assets.js';

// ------------------------------------------------------------------ peds.js
// ~44 pedestrians living in Ronin Bay: sidewalk walkers, walking pairs,
// chat groups at gathering points, and crosswalk crossers who wait at the
// curb (timed — the city has no shared traffic-light phase) before
// crossing. All keep the panic / flee / downed reactions below.

const SKIN = [0xf0c8a0, 0xe8b48c, 0xc98d64, 0xb97a4e, 0x8a5a34];
const HAIR = ['black topknot', 'red ponytail', 'violet bob', 'buzz', 'silver undercut', 'slick black', 'cap', 'long', 'bun'];
const HAIR_COLORS = [0x14100e, 0x8c2f1d, 0x6a3fa0, 0x2a2a2e, 0xc9ccd4, 0x1a1512, 0x24406e, 0x3a2415, 0x101010];
const TOPS = ['tank', 'hoodie', 'jacket'];
const TOP_COLORS = [0xff5c39, 0x2e6fb7, 0x37b268, 0xf2c230, 0xe879ff, 0xeeeeee, 0x22242a, 0xff8ab0, 0x57b7ff, 0x8a5a34, 0xffb7d5, 0xa8e6cf, 0xfff0b3];
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
  if (!Number.isFinite(i)) return null; // Vice V3 sweep: bad index -> procedural ped, never a GLB entry
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

// A parallel session is adding G.landmarks (incl. a supermarket "market");
// it may land before or after peds spawn, so every access is conditional
// and the position shape is probed defensively ({x,z} / {pos} / Vector3).
function landmarkPos(lm) {
  try {
    if (!lm) return null;
    const cands = [lm, lm.pos, lm.position, lm.at];
    for (const c of cands) {
      if (c && Number.isFinite(c.x) && Number.isFinite(c.z)) return { x: c.x, z: c.z };
    }
  } catch (e) { /* no landmark */ }
  return null;
}
function marketPos(G) {
  try {
    if (G.landmarks && G.landmarks.market) return landmarkPos(G.landmarks.market);
  } catch (e) { /* not landed yet */ }
  return null;
}

export function initPeds(G) {
  G.peds = [];
  const N = 44;

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
      inner.traverse((o) => { if (o && o.isMesh) o.castShadow = true; });
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

  // Chat group: stand the ped on a small ring around (cx, cz), facing in.
  function placeChat(ped, cx, cz, slot, slots) {
    const a = (slot / slots) * Math.PI * 2 + rr(-0.25, 0.25);
    ped.x = cx + Math.sin(a) * 1.25;
    ped.z = cz + Math.cos(a) * 1.25;
    ped.chatCx = cx; ped.chatCz = cz;
    ped.chat = true; ped.idle = true;
    ped.angle = Math.atan2(cx - ped.x, cz - ped.z);
  }

  // Crosswalk plan: corner -> curb (wait, look) -> across -> far sidewalk.
  // Spawned crossers snap to the corner; re-armed walkers keep their
  // position and walk to the corner first (stage 'toCorner').
  function setupCross(ped, cx, cz, sx, sz, snap) {
    ped.mode = 'cross';
    ped.crosser = true;
    const kx = cx + sx * 17.2, kz = cz + sz * 17.2;
    if (snap) { ped.x = kx; ped.z = kz; }
    const far = Math.hypot(kx - ped.x, kz - ped.z) > 2;
    ped.cross = {
      stage: far ? 'toCorner' : 'toCurb', cx, cz, sx, sz, waitT: 0,
      tx: far ? kx : cx + sx * 17.2, tz: far ? kz : cz + sz * 9,
      faceAngle: Math.atan2(-sx, 0),
    };
    ped.angle = Math.atan2(ped.cross.tx - ped.x, ped.cross.tz - ped.z);
  }

  // After a chat ped scatters (flee), re-derive a sidewalk walk from
  // wherever it ended up so it rejoins pedestrian flow instead of
  // standing frozen at the flee spot forever.
  function deriveWalk(ped) {
    let line = G.roadX[0], best = Infinity;
    for (const lx of G.roadX) { const d = Math.abs(ped.x - lx); if (d < best) { best = d; line = lx; } }
    ped.vertical = true; ped.line = line;
    ped.off = THREE.MathUtils.clamp(ped.x - line, -17.2, 17.2);
    if (Math.abs(ped.off) < 13) ped.off = (ped.off < 0 ? -1 : 1) * 17.2;
    ped.x = line + ped.off;
    ped.dir = chance(0.5) ? 1 : -1;
    ped.mode = 'walk';
  }

  // Shared walk/idle visual step for the new activity branches (pairs,
  // crossers): same GLB-vs-procedural split as the main walk below.
  function stepVisual(ped, amt) {
    if (ped.figIsGlb && ped.glbInner) {
      try {
        ped.glbInner.position.y = Math.abs(Math.sin(ped.phase)) * 0.04 * amt * 2;
        ped.glbInner.rotation.z = Math.sin(ped.phase) * 0.04;
        ped.glbInner.rotation.x = 0.05;
      } catch (e) {}
    } else {
      try { animateFigure(ped.visual, ped.phase, amt); } catch (e) {}
    }
  }
  function idleVisual(ped) {
    if (ped.figIsGlb && ped.glbInner) {
      try {
        ped.glbInner.position.y = 0.006 * Math.sin(ped.sway * 1.5 + ped.idx);
        ped.glbInner.rotation.z = 0.01 * Math.sin(ped.sway * 0.9 + ped.idx);
        ped.glbInner.rotation.x = 0;
      } catch (e) {}
    } else {
      try { animateFigure(ped.visual, ped.sway * 0.7, 0.12); } catch (e) {}
    }
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
      startleT: 0, fleeT: 0, fleeDir: null,
      mode: 'walk', follow: null, chat: false, scattered: false,
      crosser: false, cross: null, chatGroup: null, marketPlaced: false,
    };
    if (i < 12) {
      // CHAT GROUPS (idx 0-11): four stationary groups of 3 at gathering
      // points — HQ garage apron, Neon Mile corner, a downtown corner, and
      // the supermarket (G.landmarks.market when the parallel world build
      // has landed; a harbour corner until then — the updater relocates
      // this group if the market appears later, see chatGroup 'market').
      ped.idle = true;
      if (i < 3) placeChat(ped, -410, 418, i, 3);
      else if (i < 6) placeChat(ped, 330, -330, i - 3, 3);
      else if (i < 9) placeChat(ped, 182.2, 147.8, i - 6, 3);
      else {
        ped.chatGroup = 'market';
        const mp = marketPos(G);
        if (mp) { placeChat(ped, mp.x + 13, mp.z + 9, i - 9, 3); ped.marketPlaced = true; }
        else placeChat(ped, -312.8, -147.8, i - 9, 3);
      }
      if (i === 1 || i === 4) {
        // One phone accessory in each of the first two groups.
        try {
          const phone = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 0.16, 0.02),
            new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4, metalness: 0.4, emissive: 0x2a4a6a, emissiveIntensity: 0.7 })
          );
          phone.position.set(0.22, 1.05, 0.22);
          procFig.add(phone);
        } catch (e) { /* optional */ }
      }
    } else if (i < 24) {
      // PAIRS (idx 12-23): six walking pairs — even idx leads on a normal
      // sidewalk path, odd idx follows at a small offset behind/beside.
      const anchors = [
        { x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 },
        { x: -330, z: -330 }, { x: -412.5, z: 412.5 }, { x: 0, z: 0 },
        { x: 250, z: 420 }, { x: -480, z: -255 },
      ];
      if (i % 2 === 0) {
        const a = pick(anchors);
        placePed(ped, sidewalkPoint(G, a.x, a.z, 0, 190));
      } else {
        const leader = G.peds[G.peds.length - 1];
        ped.follow = leader || null;
        if (leader) {
          ped.x = leader.x - Math.sin(leader.angle) * 2.3 + Math.cos(leader.angle) * 0.85;
          ped.z = leader.z - Math.cos(leader.angle) * 2.3 - Math.sin(leader.angle) * 0.85;
          ped.angle = leader.angle;
          ped.speed = leader.speed;
        } else {
          const a = pick(anchors);
          placePed(ped, sidewalkPoint(G, a.x, a.z, 0, 190));
        }
      }
    } else if (i < 32) {
      // CROSSERS (idx 24-31): start at an intersection corner, walk to the
      // curb, wait (timed — no shared traffic-light phase exists), cross
      // the street on the crosswalk line, then join sidewalk flow.
      const cx = pick([-330, -165, 0, 165, 330]);
      const cz = pick([-330, -165, 0, 165, 330]);
      setupCross(ped, cx, cz, chance(0.5) ? 1 : -1, chance(0.5) ? 1 : -1, true);
    } else {
      // Plain sidewalk walkers near district centers / HQ / parks.
      const anchors = [
        { x: -330, z: 330 }, { x: 330, z: 330 }, { x: 330, z: -330 },
        { x: -330, z: -330 }, { x: -412.5, z: 412.5 }, { x: 0, z: 0 },
        { x: 250, z: 420 }, { x: -480, z: -255 },
      ];
      const a = pick(anchors);
      placePed(ped, sidewalkPoint(G, a.x, a.z, 0, 190));
    }
    fig.traverse((o) => { if (o && o.isMesh) o.castShadow = true; });
    fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
    fig.rotation.y = ped.angle;
    G.scene.add(fig);
    G.peds.push(ped);
    // If the GLB somehow resolved before this ped spawned, use it at once.
    applyGlbVisual(ped);
  }

  // ---- V5 density round: crowd 44 -> 92 --------------------------------
  // HARD PERF RULE (Bosku's density round): every ped added below is a
  // PROCEDURAL figure — spawnExtraPed never assigns a citizenKey, so the
  // GLB citizen clones (woman / teen / office / teen2) keep exactly their
  // original counts from the 44 above and applyGlbVisual skips these peds
  // forever. All spawns happen AFTER the original loop, so the seeded RNG
  // order (and therefore the placement) of the existing cast is unchanged.
  // Breakdown: social clusters 5/spot (+3 at stall spots) + 20 boulevard /
  // boardwalk walkers + 4 at the RONIN MART front + 4 downtown = +48.
  function spawnExtraPed() {
    let procFig = null;
    try { procFig = makeFigure(pedParams()); } catch (e) { return null; }
    const fig = new THREE.Group();
    fig.add(procFig);
    fig.traverse((o) => { if (o && o.isMesh) o.castShadow = true; });
    return {
      fig,
      visual: procFig,
      glbInner: null,
      figIsGlb: false,
      citizenKey: null, // procedural only — never a GLB citizen clone
      idx: G.peds.length,
      x: 0, z: 0, angle: 0,
      speed: rr(1.2, 1.8),
      phase: rr(0, 10),
      vertical: true, line: 0, off: 17.2, dir: 1,
      panicT: 0, idle: false, sway: rr(0, 6),
      startleT: 0, fleeT: 0, fleeDir: null,
      mode: 'walk', follow: null, chat: false, scattered: false,
      crosser: false, cross: null, chatGroup: null, marketPlaced: false,
    };
  }
  function finishExtraPed(ped) {
    if (!ped) return;
    ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
    ped.fig.rotation.y = ped.angle;
    G.scene.add(ped.fig);
    G.peds.push(ped);
  }
  // Standing ped facing a fixed heading. chat=true pins it in place (chat
  // peds are exempt from the far-respawn shuffle, so clusters persist for
  // staged shots); the chat centre sits 3 m along the facing, which is
  // what the updater's chat branch turns the ped toward every frame.
  function placeStand(ped, x, z, faceAngle) {
    ped.x = x; ped.z = z;
    ped.idle = true; ped.chat = true;
    ped.chatCx = x + Math.sin(faceAngle) * 3;
    ped.chatCz = z + Math.cos(faceAngle) * 3;
    ped.angle = faceAngle;
  }
  // Horizontal lane walker on the boulevard road line (z=495): off is the
  // sidewalk offset from that line, so z=486 -> -9, z=505 -> +10 and the
  // boardwalk z=552 -> +57. Directions alternate so both ways flow.
  function placeLaneWalker(ped, off, xMin, xMax, dirSign) {
    ped.vertical = false; ped.line = 495; ped.off = off;
    ped.x = rr(xMin, xMax); ped.z = 495 + off;
    ped.dir = dirSign;
    ped.angle = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    ped.mode = 'walk'; ped.idle = false;
  }

  // 1) SOCIAL CLUSTERS at the world's gathering spots. world.js is built
  // by a parallel session and G.gatherSpots may not exist (or may land
  // after peds init in some load order), so it is read defensively right
  // here at spawn time — the same pattern marketPos() uses for landmarks.
  // Missing/malformed spots fall back to the boulevard / boardwalk /
  // harbour coords from the round brief.
  const FALLBACK_SPOTS = [
    { x: 100, z: 511, ry: 0, stall: false },
    { x: 300, z: 552, ry: 0, stall: false },
    { x: -60, z: -238, ry: 0, stall: false },
    { x: -210, z: 481, ry: 0, stall: false },
  ];
  let liveSpots = null;
  try {
    if (Array.isArray(G.gatherSpots) && G.gatherSpots.length) liveSpots = G.gatherSpots;
  } catch (e) { /* gatherSpots not landed — fallback below */ }
  const clusterSpots = liveSpots || FALLBACK_SPOTS;
  for (const rawSpot of clusterSpots) {
    if (!rawSpot || !Number.isFinite(rawSpot.x) || !Number.isFinite(rawSpot.z)) continue;
    const ry = Number.isFinite(rawSpot.ry) ? rawSpot.ry : 0;
    const fwdX = Math.sin(ry), fwdZ = Math.cos(ry);   // spot facing
    const perpX = Math.cos(ry), perpZ = -Math.sin(ry); // spot sideways
    // Chatting circle of 3, offset sideways so bench / stall stay clear.
    const ccx = rawSpot.x + perpX * 4.5, ccz = rawSpot.z + perpZ * 4.5;
    for (let s = 0; s < 3; s++) {
      const ped = spawnExtraPed();
      if (ped) { placeChat(ped, ccx, ccz, s, 3); finishExtraPed(ped); }
    }
    // 2 peds at the benches, behind the circle, facing the spot heading.
    for (const sgn of [-1, 1]) {
      const ped = spawnExtraPed();
      if (ped) {
        placeStand(ped,
          rawSpot.x - fwdX * 3.5 + perpX * sgn * 2.2,
          rawSpot.z - fwdZ * 3.5 + perpZ * sgn * 2.2, ry);
        finishExtraPed(ped);
      }
    }
    // Stall spots: 2 customers at the counter facing in + 1 vendor
    // behind the counter facing out.
    if (rawSpot.stall) {
      for (const sgn of [-1, 1]) {
        const ped = spawnExtraPed();
        if (ped) {
          placeStand(ped,
            rawSpot.x + fwdX * 1.9 + perpX * sgn * 0.95,
            rawSpot.z + fwdZ * 1.9 + perpZ * sgn * 0.95, ry + Math.PI);
          finishExtraPed(ped);
        }
      }
      const vendor = spawnExtraPed();
      if (vendor) {
        placeStand(vendor, rawSpot.x - fwdX * 1.6, rawSpot.z - fwdZ * 1.6, ry);
        finishExtraPed(vendor);
      }
    }
  }

  // 1b) STALL QUEUES (V5 B4 second pass): 2 more procedural peds per stall
  // spot, queued in line BEHIND B2's counter customers. B2's customers
  // stand at spot + fwd*1.9 facing the stall (ry + PI); the queue extends
  // that same line away from the counter in ~0.9 m steps (fwd*2.8 and
  // fwd*3.7), with a small sideways jitter so the line reads human, not
  // ruler-straight. Same facing as the customers, pinned via placeStand
  // (chat=true, so the far-respawn shuffle never dissolves the queue).
  // Uses the exact same defensive clusterSpots read as section 1, so a
  // missing/malformed G.gatherSpots just falls back the same way.
  for (const rawSpot of clusterSpots) {
    if (!rawSpot || !rawSpot.stall) continue;
    if (!Number.isFinite(rawSpot.x) || !Number.isFinite(rawSpot.z)) continue;
    const ry = Number.isFinite(rawSpot.ry) ? rawSpot.ry : 0;
    const fwdX = Math.sin(ry), fwdZ = Math.cos(ry);   // spot facing
    const perpX = Math.cos(ry), perpZ = -Math.sin(ry); // spot sideways
    for (let q = 0; q < 2; q++) {
      const ped = spawnExtraPed();
      if (ped) {
        const back = 1.9 + 0.9 * (q + 1); // 2.8 m, then 3.7 m from the spot
        const jit = (q === 0 ? -0.18 : 0.22); // slight line wobble
        placeStand(ped,
          rawSpot.x + fwdX * back + perpX * jit,
          rawSpot.z + fwdZ * back + perpZ * jit, ry + Math.PI);
        finishExtraPed(ped);
      }
    }
  }

  // 2) WALKERS: +20 concentrated on the Coral boulevard sidewalks and the
  // boardwalk — 8 on the z=486 lane, 7 on z=505 (both x -420..560), 5 on
  // the z=552 boardwalk (x -380..600), directions alternating.
  const LANE_PLAN = [
    { off: -9, n: 8, xMin: -420, xMax: 560 },  // z = 486
    { off: 10, n: 7, xMin: -420, xMax: 560 },  // z = 505
    { off: 57, n: 5, xMin: -380, xMax: 600 },  // z = 552 boardwalk
  ];
  for (const lane of LANE_PLAN) {
    for (let s = 0; s < lane.n; s++) {
      const ped = spawnExtraPed();
      if (ped) {
        placeLaneWalker(ped, lane.off, lane.xMin, lane.xMax, s % 2 === 0 ? 1 : -1);
        finishExtraPed(ped);
      }
    }
  }

  // 3) RONIN MART front: a second chatting circle of 4 near (-82.5,-255),
  // in addition to the existing market chat group from the first 44.
  for (let s = 0; s < 4; s++) {
    const ped = spawnExtraPed();
    if (ped) { placeChat(ped, -79.5, -251, s, 4); finishExtraPed(ped); }
  }

  // 4) Downtown: +4 plain sidewalk walkers around the (0,0) crossing.
  for (let s = 0; s < 4; s++) {
    const ped = spawnExtraPed();
    if (ped) { placePed(ped, sidewalkPoint(G, 0, 0, 0, 70)); finishExtraPed(ped); }
  }

  // 4b) Downtown second pass (V5 B4): +4 more sidewalk walkers around
  // (0,0), same helper and radius as section 4 — the central crossing is
  // the one downtown spot every staged drive passes, so it earns the
  // extra foot traffic. Total crowd this round: 92 + 4 stall-queue +
  // 4 downtown = 100 procedural-inclusive peds.
  for (let s = 0; s < 4; s++) {
    const ped = spawnExtraPed();
    if (ped) { placePed(ped, sidewalkPoint(G, 0, 0, 0, 70)); finishExtraPed(ped); }
  }

  // ---- S23 horn reaction -------------------------------------------------
  // Called by drive.js once per honk start with the car position. Every
  // non-downed ped within r: (a) startles — startleT pauses walking for
  // 0.25 s and adds a tiny hop via the fig/bob offset in the updater; and
  // (b) if on/near a road (within 20 m of a road centre line: road half
  // width is 15, sidewalks sit at 17.2), steps aside by reusing the exact
  // flee machinery weapons.js uses (fleeDir away from the car + fleeT),
  // with a short 0.8 s timer. Fleeing peds just get flee refreshed away
  // from the car; downed peds are skipped, so flee/downed can't break.
  G.pedsStartle = function pedsStartle(x, z, r) {
    try {
      if (!Array.isArray(G.peds) || !Number.isFinite(x) || !Number.isFinite(z)) return;
      const rad = Number.isFinite(r) && r > 0 ? r : 12;
      const nearRoadLine = (v, arr) => Array.isArray(arr) && arr.some((line) => Math.abs(v - line) <= 20);
      for (const ped of G.peds) {
        if (!ped || ped.downed) continue;
        const dx = ped.x - x, dz = ped.z - z;
        const d = Math.hypot(dx, dz);
        if (d > rad) continue;
        ped.startleT = 0.25;
        const nearRoad = nearRoadLine(ped.x, G.roadX) || nearRoadLine(ped.z, G.roadZ);
        if (nearRoad || (ped.fleeT > 0 && ped.fleeDir)) {
          const len = d > 0.001 ? d : 1;
          ped.fleeDir = d > 0.001 ? { x: dx / len, z: dz / len } : { x: 1, z: 0 };
          ped.fleeT = Math.max(ped.fleeT || 0, 0.8);
        }
      }
    } catch (e) { /* horn reaction is best-effort */ }
  };

  G.updaters.push((G2, dt) => {
    const px = G.car ? G.car.x : G.player.x;
    const pz = G.car ? G.car.z : G.player.z;
    const carThreat = G.car && G.flags.inCar && (G.speedKmh || 0) > 40;

    for (const ped of G.peds) {
      const dPlayer = Math.hypot(ped.x - px, ped.z - pz);
      // S23 startle: tick the timer (downed peds return below before any
      // movement, so their startle simply expires harmlessly on recovery).
      let startleHop = 0;
      if (ped.startleT > 0) {
        ped.startleT -= dt;
        const f = Math.min(1, Math.max(0, 1 - ped.startleT / 0.25));
        startleHop = Math.sin(f * Math.PI) * 0.14;
      }

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
          ped.chat = false; ped.mode = 'walk'; ped.follow = null; ped.scattered = false;
          ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
          ped.fig.rotation.y = ped.angle;
        }
        continue;
      }
      if (ped.fleeT > 0 && ped.fleeDir) {
        if (ped.chat) ped.scattered = true; // chat groups scatter when danger hits
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
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
        ped.fig.rotation.y = ped.angle;
        continue;
      }

      // A scattered chat ped rejoins sidewalk flow once the flee ends.
      if (ped.scattered) {
        ped.scattered = false; ped.chat = false; ped.idle = false;
        deriveWalk(ped);
      }

      // Respawn far peds near the action. Chat groups, crossers and pair
      // followers are exempt: gatherings must persist, crossers are
      // mid-plan, and followers are tied to their leader.
      if (dPlayer > 350 && !ped.chat && ped.mode !== 'cross' && !ped.follow) {
        placePed(ped, sidewalkPoint(G, px, pz, 150, 250));
        ped.idle = false;
      }

      if (ped.idle) {
        ped.sway += dt;
        if (ped.chat) {
          // Supermarket gathering point: if the market landmark landed
          // after spawn, move this group onto it exactly once.
          if (ped.chatGroup === 'market' && !ped.marketPlaced) {
            const mp = marketPos(G);
            if (mp) {
              placeChat(ped, mp.x + 13, mp.z + 9, ped.idx % 3, 3);
              ped.marketPlaced = true;
            }
          }
          // Face the group centre; a slow "talk" cycle swells the gesture
          // amplitude so members read as taking turns chatting.
          ped.angle = Math.atan2(ped.chatCx - ped.x, ped.chatCz - ped.z);
          const talk = 0.5 + 0.5 * Math.sin(ped.sway * 0.33 + ped.idx * 2.1);
          if (ped.figIsGlb && ped.glbInner) {
            try {
              ped.glbInner.position.y = (0.006 + talk * 0.008) * Math.sin(ped.sway * 1.5 + ped.idx);
              ped.glbInner.rotation.z = (0.01 + talk * 0.014) * Math.sin(ped.sway * 0.9 + ped.idx);
              ped.glbInner.rotation.x = 0;
            } catch (e) {}
          } else {
            try { animateFigure(ped.visual, ped.sway * 0.7, 0.12 + talk * 0.2); } catch (e) {}
          }
          ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
          ped.fig.rotation.y = ped.angle + Math.sin(ped.sway * 0.4) * 0.15;
          continue;
        }
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
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
        ped.fig.rotation.y = ped.angle + Math.sin(ped.sway * 0.4) * 0.15;
        continue;
      }

      // PAIR FOLLOWER: trail the leader at a small offset, same heading
      // and phase, so the pair reads as walking together.
      if (ped.follow) {
        const L = ped.follow;
        if (!L || L.downed) {
          ped.sway += dt;
          idleVisual(ped);
          ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
          ped.fig.rotation.y = ped.angle;
          continue;
        }
        const fx = L.x - Math.sin(L.angle) * 2.3 + Math.cos(L.angle) * 0.85;
        const fz = L.z - Math.cos(L.angle) * 2.3 - Math.sin(L.angle) * 0.85;
        const fd = Math.hypot(fx - ped.x, fz - ped.z);
        if (fd > 25) { ped.x = fx; ped.z = fz; } // leader teleported (respawn)
        else {
          const k = Math.min(1, dt * 4.5);
          ped.x += (fx - ped.x) * k;
          ped.z += (fz - ped.z) * k;
        }
        ped.angle = L.angle;
        ped.phase = L.phase;
        if (fd > 0.25) stepVisual(ped, 0.55);
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
        ped.fig.rotation.y = ped.angle;
        continue;
      }

      // CROSSWALK CROSSER: corner -> curb wait (look both ways) -> cross
      // -> far sidewalk, then convert to a normal walker on that side.
      if (ped.mode === 'cross' && ped.cross) {
        const c = ped.cross;
        if (c.stage === 'wait') {
          c.waitT -= dt;
          ped.sway += dt;
          idleVisual(ped);
          ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
          // Head-scan toward/away from traffic while waiting at the curb.
          ped.fig.rotation.y = c.faceAngle + Math.sin(ped.sway * 1.7) * 0.55;
          if (c.waitT <= 0) {
            c.stage = 'cross';
            c.tx = c.cx - c.sx * 17.2; c.tz = c.cz + c.sz * 9;
          }
          continue;
        }
        const dx = c.tx - ped.x, dz = c.tz - ped.z;
        const dd = Math.hypot(dx, dz);
        const spd = ped.speed * (c.stage === 'cross' ? 1.2 : 1);
        if (dd < 0.35) {
          if (c.stage === 'toCorner') {
            c.stage = 'toCurb';
            c.tx = c.cx + c.sx * 17.2; c.tz = c.cz + c.sz * 9;
          } else if (c.stage === 'toCurb') {
            c.stage = 'wait';
            c.waitT = rr(1.4, 3.8); // timed curb wait (no traffic-light phase exists)
            ped.sway = rr(0, 6);
          } else if (c.stage === 'cross') {
            c.stage = 'toWalk';
            c.tx = c.cx - c.sx * 17.2; c.tz = c.cz + c.sz * 17.2;
          } else { // toWalk: arrived — join sidewalk flow on the far side
            ped.mode = 'walk';
            ped.vertical = true; ped.line = c.cx; ped.off = -c.sx * 17.2;
            ped.x = c.cx + ped.off;
            ped.dir = c.sz > 0 ? 1 : -1;
            ped.cross = null;
          }
        } else {
          ped.x += (dx / dd) * Math.min(dd, spd * dt);
          ped.z += (dz / dd) * Math.min(dd, spd * dt);
          ped.angle = Math.atan2(dx, dz);
          ped.phase += spd * dt * 2.4;
          stepVisual(ped, 0.55);
        }
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
        ped.fig.rotation.y = ped.angle;
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
      // S23 startle: brief speed pause while startleT is live (flee/idle
      // branches above are unaffected — flee keeps moving them aside).
      if (ped.startleT > 0) moveSpeed = 0;

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

      // Random turn at intersections (crossing road lines). Crossers
      // sometimes re-arm a full curb-wait + crossing at an intersection
      // instead of turning, so crossing activity never dies out.
      const crossLines = ped.vertical ? G.roadZ : G.roadX;
      const along = ped.vertical ? ped.z : ped.x;
      let reCrossed = false;
      for (const cl of crossLines) {
        if (ped.crosser && Math.abs(along - cl) < 1.2 && chance(0.30)) {
          if (ped.vertical) setupCross(ped, ped.line, cl, Math.sign(ped.off) || 1, ped.dir);
          else setupCross(ped, cl, ped.line, ped.dir, Math.sign(ped.off) || 1);
          reCrossed = true;
          break;
        }
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
      if (reCrossed) {
        ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
        ped.fig.rotation.y = ped.angle;
        continue;
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
      ped.fig.position.set(ped.x, groundH(ped.x, ped.z) + startleHop, ped.z);
      ped.fig.rotation.y = ped.angle;
    }
  });
}
