import * as THREE from 'three';
import { CFG, DISTRICTS, CARS, CAST, MISSIONS } from './config.js';
import { rr, ri, pick, chance } from './random.js';
import { groundH, glowSprite, roadRoute } from './world.js';
import { spawnVehicle } from './cars.js';
import { makeFigure } from './player.js';

// -------------------------------------------------------------- missions.js
// Campaign engine: givers, beacons, objective chains (meet / sprint /
// delivery / drift / race / timetrial / disable / jack / hold / pinkslip),
// dynamic rush events, district control, income, and the HQ garage.

const ANCHORS = {
  port: { x: -412.5, z: 470 },
  coral: { x: 495, z: 495 },
  neon: { x: 330, z: -330 },
  hoshino: { x: -90, z: -380 },
};
const RANK_THRESHOLDS = [0, 40, 110, 220, 380, 600, 900];
const GARAGE_PT = { x: -412.5, z: 455 };

function d2(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function playerPos(G) {
  return G.car && G.flags.inCar ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
}

// Sample a roadRoute into ~count checkpoints spaced along the path.
function makeCheckpoints(G, from, to, count) {
  const route = roadRoute(G, from, to) || [from, to];
  const pts = route.map((p) => ({ x: p.x, z: p.z }));
  if (!pts.length) return [{ x: to.x, z: to.z }];
  // Cumulative lengths.
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + d2(pts[i].x, pts[i].z, pts[i - 1].x, pts[i - 1].z));
  const total = cum[cum.length - 1] || 1;
  const out = [];
  const want = Math.max(1, count || Math.max(2, Math.round(total / 120)));
  for (let k = 1; k <= want; k++) {
    const target = (total * k) / want;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < target) i++;
    const segLen = (cum[i] - cum[i - 1]) || 1;
    const f = (target - cum[i - 1]) / segLen;
    out.push({
      x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f,
      z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * f,
    });
  }
  out[out.length - 1] = { x: to.x, z: to.z };
  return out;
}

function letterSprite(letter, color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color || '#ffd23f';
  g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
  g.lineWidth = 7; g.strokeStyle = '#14100a'; g.stroke();
  g.fillStyle = '#14100a';
  g.font = 'bold 64px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter || '!', 64, 68);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(3.2, 3.2, 1);
  return sp;
}

export function initMissions(G) {
  G.missionIndex = G.missionIndex || 0;
  G.missionProg = '';
  G.objective = null;
  G.driftScore = 0;
  G.garageList = [];
  G.flags.garageOpen = !!G.flags.garageOpen;

  const S = {
    phase: 'giver', // 'giver' | 'active'
    giverFig: null,
    giverMission: null,
    beacon: null,
    beaconLetter: null,
    chain: null, // active mission runtime
    rush: null,
    rushTimer: 55,
    incomeT: 60,
    ePrev: false,
    numPrev: {},
    prevPX: 0, prevPZ: 0,
    currentCarId: (G.garage && G.garage[0]) || 'hachi',
    zoneRing: null,
  };

  // --- beacon visuals -------------------------------------------------------
  function makeBeacon() {
    const grp = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.4, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    cyl.position.y = 13;
    grp.add(cyl);
    try {
      const glow = glowSprite(0xffd23f, 9);
      glow.position.y = 1.2;
      grp.add(glow);
    } catch (e) { /* optional */ }
    const letter = letterSprite('!', '#ffd23f');
    letter.position.y = 6.5;
    grp.add(letter);
    grp.visible = false;
    G.scene.add(grp);
    S.beacon = grp;
    S.beaconLetter = letter;
  }
  makeBeacon();

  function setBeacon(x, z, letter, color) {
    if (!S.beacon) return;
    S.beacon.position.set(x, groundH(x, z), z);
    S.beacon.visible = true;
    if (letter && S.beaconLetter) {
      const parent = S.beaconLetter.parent;
      const y = S.beaconLetter.position.y;
      parent.remove(S.beaconLetter);
      S.beaconLetter = letterSprite(letter, color);
      S.beaconLetter.position.y = y;
      parent.add(S.beaconLetter);
    }
  }
  function hideBeacon() { if (S.beacon) S.beacon.visible = false; }

  function makeZoneRing(radius, color) {
    removeZoneRing();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.35, 8, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = Math.PI / 2;
    G.scene.add(ring);
    S.zoneRing = ring;
    return ring;
  }
  function removeZoneRing() {
    if (S.zoneRing) { G.scene.remove(S.zoneRing); S.zoneRing = null; }
  }

  // --- giver management -------------------------------------------------------
  function currentMission() {
    return G.missionIndex < MISSIONS.length ? MISSIONS[G.missionIndex] : null;
  }
  function spawnGiver() {
    clearGiver();
    const m = currentMission();
    if (!m) { G.objective = null; G.missionProg = ''; hideBeacon(); return; }
    const anchor = ANCHORS[m.district] || ANCHORS.port;
    S.giverMission = m;
    const giver = CAST[m.giver];
    if (giver) {
      try {
        S.giverFig = makeFigure(giver);
        S.giverFig.position.set(anchor.x, groundH(anchor.x, anchor.z), anchor.z);
        S.giverFig.rotation.y = rr(0, Math.PI * 2);
        G.scene.add(S.giverFig);
      } catch (e) { S.giverFig = null; }
    }
    const initial = (giver?.name || m.giver || '?').trim().charAt(0).toUpperCase();
    G.objective = { x: anchor.x, z: anchor.z, label: `${m.title} — talk to ${giver?.name || m.giver}`, letter: initial, giverId: m.giver };
    G.missionProg = 'Go to the blip';
    setBeacon(anchor.x, anchor.z, initial, '#ffd23f');
    S.phase = 'giver';
  }
  function clearGiver() {
    if (S.giverFig) { G.scene.remove(S.giverFig); S.giverFig = null; }
  }

  // --- chain setup per type ---------------------------------------------------
  function startChain(m) {
    const anchor = ANCHORS[m.district] || ANCHORS.port;
    const start = playerPos(G);
    const chain = {
      m, type: m.type, idx: 0, checkpoints: [], timer: 0, par: 0,
      rival: null, rivalIdx: 0, target: null, done: false,
      startHealth: G.car ? (G.car.health ?? 100) : 100,
      driftTarget: 2000, holdT: 0,
    };
    const dest = { x: anchor.x + rr(-60, 60), z: anchor.z + rr(-60, 60) };
    switch (m.type) {
      case 'meet':
        chain.checkpoints = [dest];
        break;
      case 'sprint':
        chain.checkpoints = makeCheckpoints(G, start, dest, 4);
        chain.timer = routeTime(G, start, chain.checkpoints) + 35;
        break;
      case 'delivery':
        chain.checkpoints = [dest];
        chain.timer = Math.max(35, d2(start.x, start.z, dest.x, dest.z) / 16 + 18);
        break;
      case 'drift':
        chain.checkpoints = [dest];
        chain.driftTarget = typeof m.need === 'number' && m.need > 100 ? m.need : 2000;
        G.driftScore = 0;
        break;
      case 'race':
      case 'pinkslip': {
        chain.checkpoints = makeCheckpoints(G, start, dest, 4);
        chain.timer = routeTime(G, start, chain.checkpoints) + 60;
        const rivalSpec = m.id === 'm12' ? 'hero-gtr' : (m.id === 'm11' ? 'kaze' : 'taiyo');
        const rivalCast = m.id === 'm12' ? 'ryo' : 'dante';
        chain.rubberF = rr(0.92, 1.08);
        const rs = start;
        chain.rival = spawnVehicle(G, rivalSpec, rs.x + 6, rs.z + 4, G.car ? G.car.angle : 0,
          { driver: rivalCast, color: m.id === 'm12' ? 0x30343c : 0x7a1010 });
        chain.rivalSpeed = 0;
        break;
      }
      case 'timetrial': {
        if (m.id === 'm6' && G.touge && G.touge.length > 2) {
          chain.checkpoints = G.touge.map((p) => ({ x: p.x, z: p.z }));
          let len = 0;
          for (let i = 1; i < chain.checkpoints.length; i++) len += d2(chain.checkpoints[i].x, chain.checkpoints[i].z, chain.checkpoints[i - 1].x, chain.checkpoints[i - 1].z);
          chain.par = len / 21;
        } else {
          chain.checkpoints = makeCheckpoints(G, start, dest, 5);
          chain.par = routeTime(G, start, chain.checkpoints) + 25;
        }
        chain.timer = 0; // counts up
        break;
      }
      case 'disable': {
        G.flags.noDecay = true;
        G.wanted = Math.max(3, G.wanted);
        const a = rr(0, Math.PI * 2);
        const tx = start.x + Math.sin(a) * 55, tz = start.z + Math.cos(a) * 55;
        chain.target = spawnVehicle(G, 'police', tx, tz, rr(0, 6), { driver: 'cop', livery: 'police', lights: true });
        if (chain.target) { chain.target.health = 90; G.cops?.push(chain.target); }
        chain.checkpoints = [];
        break;
      }
      case 'jack': {
        const specId = typeof m.need === 'string' && CARS[m.need] ? m.need : 'sora15';
        const a = rr(0, Math.PI * 2);
        const jx = anchor.x + Math.sin(a) * 70, jz = anchor.z + Math.cos(a) * 70;
        chain.target = spawnVehicle(G, specId, jx, jz, rr(0, 6), { driver: 'parked', glow: true });
        chain.stage = 'steal';
        chain.checkpoints = [{ x: jx, z: jz }];
        break;
      }
      case 'hold': {
        chain.checkpoints = [dest];
        chain.holdT = 0;
        G.wanted = Math.max(2, G.wanted);
        chain.rivals = [];
        for (let i = 0; i < 2; i++) {
          const a = rr(0, Math.PI * 2);
          const rv = spawnVehicle(G, pick(['hatch', 'sedan', 'kei']), dest.x + Math.sin(a) * 45, dest.z + Math.cos(a) * 45, rr(0, 6), { driver: 'dante' });
          if (rv) chain.rivals.push(rv);
        }
        break;
      }
      default:
        chain.checkpoints = [dest];
    }
    S.chain = chain;
    S.phase = 'active';
    updateObjectiveFromChain();
  }

  function routeTime(G3, from, cps) {
    let len = 0, prev = from;
    for (const cp of cps) { len += d2(prev.x, prev.z, cp.x, cp.z); prev = cp; }
    return len / 17;
  }

  function updateObjectiveFromChain() {
    const chain = S.chain;
    if (!chain) return;
    const m = chain.m;
    if (chain.type === 'disable' && chain.target) {
      G.objective = { x: chain.target.x, z: chain.target.z, label: `${m.title} — disable the interceptor`, letter: '!' };
      setBeacon(chain.target.x, chain.target.z, '!', '#ff5c39');
      return;
    }
    if (chain.type === 'jack' && chain.stage === 'deliver') {
      G.objective = { x: GARAGE_PT.x, z: GARAGE_PT.z, label: `${m.title} — deliver to HQ garage`, letter: 'G' };
      setBeacon(GARAGE_PT.x, GARAGE_PT.z, 'G', '#7dffb0');
      return;
    }
    const cp = chain.checkpoints[Math.min(chain.idx, chain.checkpoints.length - 1)];
    if (cp) {
      G.objective = { x: cp.x, z: cp.z, label: m.title, letter: '!' };
      setBeacon(cp.x, cp.z, '!', '#ffd23f');
    }
  }

  function cleanupChain() {
    const chain = S.chain;
    if (!chain) return;
    if (chain.type === 'disable') {
      G.flags.noDecay = false;
      if (chain.target && G.cops) {
        const i = G.cops.indexOf(chain.target);
        if (i >= 0) G.cops.splice(i, 1);
      }
    }
    removeZoneRing();
    S.chain = null;
  }

  function failChain(reason) {
    const m = S.chain?.m;
    cleanupChain();
    G.toast?.(reason || 'Mission failed — talk to the giver again');
    G.audio?.play?.('fail');
    spawnGiver();
    if (m) G.missionProg = 'Failed — go back to the blip';
  }

  function completeMission() {
    const chain = S.chain;
    const m = chain.m;
    let money = m.reward?.money || 0;
    const rep = m.reward?.rep || 0;
    if (chain.type === 'delivery') {
      const health = G.car ? (G.car.health ?? 100) : 100;
      money += Math.round(50 * Math.max(0, health) / 100); // condition bonus
    }
    G.money = (G.money || 0) + money;
    G.rep = (G.rep || 0) + rep;
    // Rank from rep thresholds.
    let rank = 0;
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) if (G.rep >= RANK_THRESHOLDS[i]) rank = i;
    if (rank > (G.rankIdx || 0)) { G.rankIdx = rank; G.banner?.(`Rank up — ${['Rookie', 'Runner', 'Drifter', 'Street Ace', 'Night Captain', 'Bay Legend', 'Street King'][rank]}`); }
    // District control.
    const ds = G.districtState?.[m.district];
    if (ds) {
      ds.control = Math.min(100, (ds.control || 0) + 15);
      if (ds.control >= 60) ds.owner = 'ronin';
    }
    if (m.type === 'pinkslip') {
      if (!G.garage.includes('hero-gtr')) G.garage.push('hero-gtr');
      if (!G.ownedCars.includes('hero-gtr')) G.ownedCars.push('hero-gtr');
      G.flags.gotGhost = true;
      G.banner?.('Pink slip won — GHOST GT-R is yours');
    }
    cleanupChain();
    G.missionIndex += 1;
    if (G.missionIndex >= MISSIONS.length) {
      G.flags.campaignDone = true;
      G.banner?.('CAMPAIGN COMPLETE — Street King of Ronin Bay');
      G.objective = null; G.missionProg = '';
      hideBeacon();
    } else {
      G.banner?.(`${m.title} complete — +$${money.toLocaleString('en-US')}`);
      spawnGiver();
    }
    G.toast?.(`+$${money.toLocaleString('en-US')} · +${rep} REP`);
    G.audio?.play?.('complete');
    G.saveGame?.();
  }

  // --- rival / nudge-car driving ------------------------------------------------
  function driveRival(G3, v, cps, idxRef, dt, paceSpeed) {
    if (!v || idxRef.i >= cps.length) return;
    const cp = cps[idxRef.i];
    const desired = Math.atan2(cp.x - v.x, cp.z - v.z);
    const diff = angDiff(desired, v.angle);
    v.angle += THREE.MathUtils.clamp(diff, -1.9 * dt, 1.9 * dt);
    let target = paceSpeed;
    if (Math.abs(diff) > 0.7) target *= 0.55;
    v.speed = THREE.MathUtils.clamp((v.speed || 0) + Math.sign(target - (v.speed || 0)) * 10 * dt, 0, target + 6);
    v.x += Math.sin(v.angle) * v.speed * dt;
    v.z += Math.cos(v.angle) * v.speed * dt;
    v.mesh.position.set(v.x, groundH(v.x, v.z), v.z);
    v.mesh.rotation.y = v.angle;
    const ud = v.mesh.userData;
    if (ud?.wheels) {
      const spin = (v.speed * dt) / (ud.wheelR || 0.34);
      for (const w of Object.values(ud.wheels)) if (w) w.rotation.x += spin;
    }
    if (d2(v.x, v.z, cp.x, cp.z) < 11) idxRef.i += 1;
  }

  // --- garage ---------------------------------------------------------------------
  function refreshGarageList() {
    G.garageList = Object.keys(CARS).map((id) => {
      const spec = CARS[id];
      return {
        id, name: spec.name || id, price: spec.price || 0,
        owned: G.garage.includes(id), current: id === S.currentCarId,
      };
    });
  }
  refreshGarageList();

  function spawnGarageCar(id) {
    // Despawn the old player car if it is parked (not being driven).
    if (G.starterCar && G.starterCar !== G.car) {
      const old = G.starterCar;
      if (old.mesh) G.scene.remove(old.mesh);
      if (G.vehicles) { const i = G.vehicles.indexOf(old); if (i >= 0) G.vehicles.splice(i, 1); }
    }
    if (G.flags.inCar) { try { G.exitCar?.(); } catch (e) {} }
    const v = spawnVehicle(G, id, GARAGE_PT.x + 6, GARAGE_PT.z + 8, Math.PI, { driver: 'parked' });
    if (v) {
      G.starterCar = v;
      S.currentCarId = id;
    }
    refreshGarageList();
    G.saveGame?.();
  }

  function garageSelect(n) {
    const item = G.garageList[n - 1];
    if (!item) return;
    if (item.owned) {
      spawnGarageCar(item.id);
      G.toast?.(`${item.name} rolled out`);
    } else if ((G.money || 0) >= item.price) {
      G.money -= item.price;
      G.garage.push(item.id);
      if (!G.ownedCars.includes(item.id)) G.ownedCars.push(item.id);
      spawnGarageCar(item.id);
      G.banner?.(`${item.name} — yours`);
      G.audio?.play?.('buy');
    } else {
      G.toast?.(`Need $${item.price.toLocaleString('en-US')} for the ${item.name}`);
    }
    refreshGarageList();
  }

  // --- input helpers ------------------------------------------------------------------
  function keyDown(name) {
    const k = G.keys || {};
    return !!(k[name] || k[name.toLowerCase()] || k[name.toUpperCase()]);
  }
  function ePressed() { return keyDown('KeyE') || keyDown('e'); }

  spawnGiver();

  // --- main updater ---------------------------------------------------------------------
  G.updaters.push((G2, dt) => {
    const p = playerPos(G);
    const pvx = dt > 0 ? (p.x - S.prevPX) / dt : 0;
    const pvz = dt > 0 ? (p.z - S.prevPZ) / dt : 0;
    S.prevPX = p.x; S.prevPZ = p.z;
    const eNow = ePressed();
    const eEdge = eNow && !S.ePrev;
    S.ePrev = eNow;

    // Beacon bob.
    if (S.beacon?.visible) {
      S.beacon.rotation.y += dt * 0.8;
      if (S.beaconLetter) S.beaconLetter.position.y = 6.5 + Math.sin(performance.now() * 0.003) * 0.5;
    }
    if (S.giverFig) S.giverFig.rotation.y += Math.sin(performance.now() * 0.001) * 0.0006;

    // ---- garage interaction ----
    const nearGarage = d2(p.x, p.z, GARAGE_PT.x, GARAGE_PT.z) < 7;
    if (eEdge && nearGarage && S.phase !== 'active') {
      G.flags.garageOpen = !G.flags.garageOpen;
      if (G.flags.garageOpen) refreshGarageList();
    } else if (eEdge && G.flags.garageOpen) {
      G.flags.garageOpen = false;
    }
    if (G.flags.garageOpen) {
      for (let n = 1; n <= 9; n++) {
        const dn = keyDown('Digit' + n) || keyDown(String(n));
        if (dn && !S.numPrev[n]) garageSelect(n);
        S.numPrev[n] = dn;
      }
    }

    // ---- income tick ----
    S.incomeT -= dt;
    if (S.incomeT <= 0) {
      S.incomeT = 60;
      let income = 0;
      if (G.districtState) {
        for (const d of DISTRICTS) {
          const ds = G.districtState[d.id];
          if (ds && ds.owner === 'ronin') income += Math.round((ds.control || 0) / 10);
        }
      }
      if (income > 0) { G.money = (G.money || 0) + income; G.toast?.(`District income +$${income}`); }
    }

    // ---- rush dynamic events ----
    if (!S.chain && !S.rush) {
      S.rushTimer -= dt;
      if (S.rushTimer <= 0) {
        S.rushTimer = 90;
        if (chance(0.5)) {
          const rx = pick(G.roadX) + rr(-8, 8);
          const rz = pick(G.roadZ) + rr(-8, 8);
          S.rush = { x: THREE.MathUtils.clamp(rx, -620, 620), z: THREE.MathUtils.clamp(rz, -620, 620), t: 40 };
          G.toast?.('Rush delivery — reach the pink blip in 40s for $150');
          G.audio?.play?.('event');
        }
      }
    }
    if (S.rush) {
      S.rush.t -= dt;
      if (!S.chain) {
        G.objective = { x: S.rush.x, z: S.rush.z, label: `Rush delivery — ${fmtTime(S.rush.t)}`, letter: '$' };
        setBeacon(S.rush.x, S.rush.z, '$', '#ff4fd8');
      }
      if (d2(p.x, p.z, S.rush.x, S.rush.z) < 7) {
        G.money = (G.money || 0) + 150;
        G.toast?.('Rush delivered — +$150');
        G.audio?.play?.('complete');
        S.rush = null;
        if (!S.chain) spawnGiver();
      } else if (S.rush.t <= 0) {
        S.rush = null; // expires quietly
        if (!S.chain) spawnGiver();
      }
    }

    // ---- giver phase ----
    if (S.phase === 'giver' && !S.rush) {
      const m = currentMission();
      if (m) {
        const anchor = ANCHORS[m.district] || ANCHORS.port;
        const near = d2(p.x, p.z, anchor.x, anchor.z);
        if ((eEdge && near < 5) || near < 6 && G.flags.inCar) {
          if (near < 6) {
            clearGiver();
            G.showBriefing?.(m.giver, m.blurb);
            G.audio?.play?.('brief');
            startChain(m);
          }
        }
      }
    }

    // ---- active chain ----
    const chain = S.chain;
    if (chain) {
      const m = chain.m;
      const cp = chain.checkpoints[Math.min(chain.idx, chain.checkpoints.length - 1)];

      if (chain.type === 'disable' && chain.target) {
        updateObjectiveFromChain();
        // Ramming damages the target (collision events surface via crashTimer,
        // which police.js consumes; also apply proximity impact damage here).
        if (G.car && d2(G.car.x, G.car.z, chain.target.x, chain.target.z) < 5 && (G.speedKmh || 0) > 25) {
          chain.target.health -= 22 * dt * 3;
        }
        G.missionProg = `Interceptor health ${Math.max(0, Math.ceil(chain.target.health))}%`;
        G.wanted = Math.max(3, G.wanted);
        if (chain.target.health < 25) { completeMission(); return; }
      } else if (chain.type === 'drift') {
        const zone = chain.checkpoints[0];
        const ring = makeZoneRingOnce(zone);
        if (ring) { ring.position.set(zone.x, groundH(zone.x, zone.z) + 0.4, zone.z); }
        const inZone = d2(p.x, p.z, zone.x, zone.z) < 40;
        if (inZone && G.car && G.flags.inCar && G.flags.drifting) {
          const vAng = Math.atan2(pvx, pvz);
          const slip = Math.abs(angDiff(vAng, G.car.angle));
          const spd = Math.hypot(pvx, pvz);
          if (spd > 4) G.driftScore += slip * spd * dt * 9;
        }
        G.missionProg = `Drift ${Math.floor(G.driftScore).toLocaleString('en-US')} / ${chain.driftTarget.toLocaleString('en-US')}${inZone ? '' : ' — get to the zone'}`;
        if (G.driftScore >= chain.driftTarget) { completeMission(); return; }
      } else if (chain.type === 'jack') {
        if (chain.stage === 'steal') {
          updateObjectiveFromChain();
          G.missionProg = 'Steal the marked car';
          if (chain.target && G.car === chain.target) {
            chain.stage = 'deliver';
            updateObjectiveFromChain();
          }
        } else {
          G.missionProg = 'Deliver it to the HQ garage';
          if (d2(p.x, p.z, GARAGE_PT.x, GARAGE_PT.z) < 8 && G.car === chain.target) { completeMission(); return; }
        }
      } else if (chain.type === 'hold') {
        const zone = chain.checkpoints[0];
        const ring = makeZoneRingOnce(zone);
        if (ring) ring.position.set(zone.x, groundH(zone.x, zone.z) + 0.4, zone.z);
        const inZone = d2(p.x, p.z, zone.x, zone.z) < 26;
        if (inZone) chain.holdT += dt;
        G.wanted = Math.max(2, G.wanted);
        for (const rv of chain.rivals || []) {
          // Rivals circle the zone and nudge the player.
          const idxRef = { i: 0 };
          const cps = [{ x: p.x, z: p.z }];
          driveRival(G, rv, cps, idxRef, dt, 7);
        }
        G.missionProg = `Hold the zone ${fmtTime(45 - chain.holdT)}`;
        if (chain.holdT >= 45) { completeMission(); return; }
      } else {
        // Checkpoint-driven types: meet / sprint / delivery / race / pinkslip / timetrial.
        if (chain.timer > 0 && chain.type !== 'timetrial') {
          chain.timer -= dt;
          if (chain.timer <= 0) { failChain('Out of time — talk to the giver again'); return; }
        }
        if (chain.type === 'timetrial') chain.timer += dt;

        // Rival progress.
        if (chain.rival) {
          const pace = (G.car?.spec?.topSpeed || 160) / 3.6 * 0.62;
          const playerPace = Math.max(6, Math.hypot(pvx, pvz));
          const rubber = THREE.MathUtils.clamp(playerPace * (chain.rubberF || 1), 6, pace * 1.5);
          const idxRef = { i: chain.rivalIdx };
          driveRival(G, chain.rival, chain.checkpoints, idxRef, dt, rubber);
          chain.rivalIdx = idxRef.i;
          if (chain.rivalIdx >= chain.checkpoints.length) {
            failChain('You lost the race — run it back');
            return;
          }
        }

        if (cp && d2(p.x, p.z, cp.x, cp.z) < 9) {
          chain.idx += 1;
          G.audio?.play?.('checkpoint');
          if (chain.idx >= chain.checkpoints.length) {
            if (chain.type === 'timetrial' && chain.timer > chain.par) { failChain(`Too slow — par ${fmtTime(chain.par)}`); return; }
            completeMission();
            return;
          }
          updateObjectiveFromChain();
        }
        // Progress text.
        const total = chain.checkpoints.length;
        if (chain.type === 'sprint' || chain.type === 'race' || chain.type === 'pinkslip') {
          G.missionProg = `Checkpoint ${Math.min(chain.idx + 1, total)}/${total} · ${fmtTime(chain.timer)}`;
        } else if (chain.type === 'timetrial') {
          G.missionProg = `Checkpoint ${Math.min(chain.idx + 1, total)}/${total} · ${fmtTime(chain.timer)} / par ${fmtTime(chain.par)}`;
        } else if (chain.type === 'delivery') {
          G.missionProg = `Deliver in ${fmtTime(chain.timer)} — keep it clean`;
        } else {
          G.missionProg = 'Reach the beacon';
        }
      }
    }

    function makeZoneRingOnce(zone) {
      if (!S.zoneRing) makeZoneRing(chain.type === 'drift' ? 40 : 26, chain.type === 'drift' ? 0xe879ff : 0xff5c39);
      return S.zoneRing;
    }
  });
}
