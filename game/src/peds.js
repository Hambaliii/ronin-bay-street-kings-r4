import * as THREE from 'three';
import { rr, ri, pick, chance } from './random.js';
import { groundH } from './world.js';
import { makeFigure, animateFigure } from './player.js';

// ------------------------------------------------------------------ peds.js
// ~26 pedestrians walking Ronin Bay's sidewalks, with panic reactions.

const SKIN = [0xf0c8a0, 0xe8b48c, 0xc98d64, 0xb97a4e, 0x8a5a34];
const HAIR = ['black topknot', 'red ponytail', 'violet bob', 'buzz', 'silver undercut', 'slick black', 'cap', 'long', 'bun'];
const HAIR_COLORS = [0x14100e, 0x8c2f1d, 0x6a3fa0, 0x2a2a2e, 0xc9ccd4, 0x1a1512, 0x24406e, 0x3a2415, 0x101010];
const TOPS = ['tank', 'hoodie', 'jacket'];
const TOP_COLORS = [0xff5c39, 0x2e6fb7, 0x37b268, 0xf2c230, 0xe879ff, 0xeeeeee, 0x22242a, 0xff8ab0, 0x57b7ff, 0x8a5a34];
const PANTS_COLORS = [0x2c3e57, 0x3a3f47, 0x5b4632, 0x243024, 0x6e7f52, 0x39424e];

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

  function placePed(ped, spot) {
    ped.x = spot.x; ped.z = spot.z;
    ped.vertical = spot.vertical;
    ped.line = spot.line;
    ped.off = spot.off;
    ped.dir = chance(0.5) ? 1 : -1;
    ped.angle = ped.vertical ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  for (let i = 0; i < N; i++) {
    let fig = null;
    try { fig = makeFigure(pedParams()); } catch (e) { continue; }
    const ped = {
      fig,
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
          fig.add(phone);
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
  }

  G.updaters.push((G2, dt) => {
    const px = G.car ? G.car.x : G.player.x;
    const pz = G.car ? G.car.z : G.player.z;
    const carThreat = G.car && G.flags.inCar && (G.speedKmh || 0) > 40;

    for (const ped of G.peds) {
      const dPlayer = Math.hypot(ped.x - px, ped.z - pz);

      // Respawn far peds near the action.
      if (dPlayer > 350) {
        placePed(ped, sidewalkPoint(G, px, pz, 150, 250));
        ped.idle = false;
      }

      if (ped.idle) {
        ped.sway += dt;
        try { animateFigure(ped.fig, ped.sway * 0.7, 0.12); } catch (e) {}
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

      try { animateFigure(ped.fig, ped.phase, ped.panicT > 0 ? 1.6 : 0.55); } catch (e) {}
      ped.fig.position.set(ped.x, groundH(ped.x, ped.z), ped.z);
      ped.fig.rotation.y = ped.angle;
    }
  });
}
