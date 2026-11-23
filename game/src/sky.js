// sky.js — visible sun disc + drifting cloud layer (F2 fix round).
// Layers ON TOP of world.js' gradient sky dome / haze: nothing here touches
// the dome, fog or the G.sun directional light. Everything is positioned
// from the SAME time-of-day state world.js uses:
//   t = G.timeOfDay (hours 0..24)
//   sun angle ang = ((t - 6) / 12) * PI  (world.js updateWorld positions
//     G.sun at (cos(ang)*300, sin(ang)*300, 120) — we mirror that direction)
//   dayAmt = clamp(sin(((t - 6) / 12) * PI), 0, 1)
//   sunset = warm factor peaking at ~18.2 (and a weaker one at ~6.2)
// Sun + clouds follow the camera in x/z so the sky reads correctly anywhere
// in the 1320 m city; clouds additionally drift with the wind in world
// space relative to that anchor and wrap at the bounds.
import * as THREE from 'three';
import { rr } from './random.js';

function sunTexture() {
  // Soft radial glow: hot white core -> warm halo -> transparent.
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, 'rgba(255,244,214,0.95)');
  gr.addColorStop(0.34, 'rgba(255,214,140,0.55)');
  gr.addColorStop(0.62, 'rgba(255,178,102,0.18)');
  gr.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function cloudTexture(seed) {
  // One cloud cluster: several overlapping radial puffs on a wide canvas.
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  // Deterministic per-variant puff layout (seeded by variant index, not by
  // the game RNG — textures must not consume gameplay random draws).
  let s = 1234567 + seed * 7919;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const puffs = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < puffs; i++) {
    const px = 40 + rnd() * 176, py = 48 + rnd() * 36, pr = 22 + rnd() * 30;
    const gr = g.createRadialGradient(px, py, 0, px, py, pr);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.28)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(px, py, pr, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const DAY_CLOUD = new THREE.Color(0xffffff);
// Neon-coastal sunset palette (Bosku, 23 Nov): saturated pink-orange
// clouds with a purple variant, and a hot pink-orange low sun.
const SUNSET_CLOUD = new THREE.Color(0xff9e7a);
const SUNSET_CLOUD_PURPLE = new THREE.Color(0xc08bd8);
const NIGHT_CLOUD = new THREE.Color(0x3d4a63);
const DAY_SUN = new THREE.Color(0xfff3d0);
const LOW_SUN = new THREE.Color(0xff5f2e);
const LOW_GLOW = new THREE.Color(0xff7a4d);
const _c = new THREE.Color();

let sky = null; // { group, sunGlow, sunCore, clouds: [{spr, speed}], mats }

export function initSky(G) {
  try {
    const group = new THREE.Group();
    group.renderOrder = 1;

    // --- sun: one glow sprite + one smaller hot core sprite -------------
    const sunTex = sunTexture();
    const glowMat = new THREE.SpriteMaterial({ map: sunTex, color: 0xffe9b8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const sunGlow = new THREE.Sprite(glowMat); sunGlow.scale.set(340, 340, 1);
    const coreMat = new THREE.SpriteMaterial({ map: sunTex, color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, fog: false });
    const sunCore = new THREE.Sprite(coreMat); sunCore.scale.set(95, 95, 1);
    group.add(sunGlow); group.add(sunCore);

    // --- clouds: ~16 cluster sprites across 3 shared texture variants ---
    // Materials are shared per variant so the per-frame time-of-day tint
    // touches 3 materials, not every sprite.
    const variants = [];
    for (let v = 0; v < 3; v++) {
      variants.push(new THREE.SpriteMaterial({ map: cloudTexture(v), color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, fog: false }));
    }
    const clouds = [];
    for (let i = 0; i < 16; i++) {
      const spr = new THREE.Sprite(variants[i % 3]);
      const w = rr(150, 300);
      spr.scale.set(w, w * 0.42, 1);
      spr.position.set(rr(-820, 820), rr(150, 265), rr(-820, 820));
      group.add(spr);
      clouds.push({ spr, speed: rr(0.8, 1.9) });
    }

    G.scene.add(group);
    sky = { group, sunGlow, sunCore, glowMat, coreMat, clouds, variants };
    G.sky = sky;
  } catch (e) { /* sky dressing is best-effort — the dome still renders */ }
}

export function updateSky(G, dt) {
  if (!sky) return;
  try {
    const t = G.timeOfDay || 10.5;
    const dayAmt = Math.max(0, Math.min(1, Math.sin(((t - 6) / 12) * Math.PI)));
    const sunset = Math.max(0, Math.min(1,
      Math.max(0, 1 - Math.abs(t - 18.2) / 1.6) * (t > 12 ? 1 : 0) +
      Math.max(0, 1 - Math.abs(t - 6.2) / 1.2) * 0.6));
    const ang = ((t - 6) / 12) * Math.PI;
    const elev = Math.sin(ang); // -1..1, <0 = below horizon

    // Anchor the sky group to the camera so sun direction / cloud cover
    // are consistent anywhere in the city.
    const cam = G.camera;
    const ax = cam ? cam.position.x : 0, az = cam ? cam.position.z : 0;
    sky.group.position.set(ax, 0, az);

    // --- sun disc ---------------------------------------------------------
    // Same azimuth/elevation family as world.js' G.sun light (z tilted
    // toward +120/300 so the disc sits over the city, not on the axis).
    // The beach/ocean edge is the +Z side of the world (beach plane at
    // z +610 in world.js), so as the sun gets low the z bias grows: the
    // rising/setting sun hangs out over the water, not over the city.
    const dist = 1150;
    const lowAmt0 = Math.max(0, Math.min(1, 1 - Math.abs(elev) / 0.55));
    const sx = Math.cos(ang) * dist;
    const sy = elev * dist;
    const sz = (0.38 + lowAmt0 * 0.30) * dist;
    sky.sunGlow.position.set(sx, sy, sz);
    sky.sunCore.position.set(sx, sy, sz);
    const above = elev > -0.04;
    sky.sunGlow.visible = above; sky.sunCore.visible = above;
    if (above) {
      // Fade in/out right at the horizon line; warm as it gets low.
      const horizonFade = Math.max(0, Math.min(1, (elev + 0.04) / 0.22));
      const lowAmt = Math.max(0, Math.min(1, 1 - elev / 0.55));
      _c.lerpColors(DAY_SUN, LOW_SUN, lowAmt);
      sky.glowMat.color.copy(_c).lerp(LOW_GLOW, lowAmt * 0.55);
      sky.coreMat.color.copy(_c).lerp(new THREE.Color(0xffffff), 0.45 - lowAmt * 0.25);
      sky.glowMat.opacity = 0.9 * horizonFade;
      sky.coreMat.opacity = 1.0 * horizonFade;
      const grow = 1 + lowAmt * 0.5; // sun swells a little at sunset
      sky.sunGlow.scale.set(340 * grow, 340 * grow, 1);
    }

    // --- clouds ------------------------------------------------------------
    // Tint: white by day -> pink/orange at sunset -> dim blue-grey at night.
    _c.copy(NIGHT_CLOUD).lerp(DAY_CLOUD, dayAmt);
    for (let vi = 0; vi < sky.variants.length; vi++) {
      const m = sky.variants[vi];
      m.color.copy(_c);
      if (sunset > 0) {
        // Middle variant leans purple; the others go saturated
        // pink-orange — together they read as a neon-coastal sunset.
        m.color.lerp(vi === 1 ? SUNSET_CLOUD_PURPLE : SUNSET_CLOUD, sunset * 0.8 * Math.max(dayAmt, 0.45));
      }
      // Faint at night, full by day, with a sunset lift so the pink
      // clouds stay readable against the warm grade.
      m.opacity = 0.28 + dayAmt * 0.54 + sunset * 0.18;
    }
    // Slow wind drift (+x), wrapping around the camera-anchored bounds.
    const step = (dt || 0) * 1.4;
    for (const cl of sky.clouds) {
      cl.spr.position.x += cl.speed * step;
      if (cl.spr.position.x > 860) cl.spr.position.x = -860;
    }
  } catch (e) { /* never break the frame on sky dressing */ }
}
