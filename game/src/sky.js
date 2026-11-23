// sky.js — visible sun disc + drifting cloud layer (F2 fix round).
// Vice round (V2): this module now ALSO owns the sunset grade. Diagnosis
// of the flat orange-brown dusk wash: world.js' sky keyframes lerp from
// the 17.8 key (mid #e8763a / fog #f2c99a) toward the 19.5 key (mid
// #6a4a5a / horizon #c97a4a / fog #7a5a4e — brown-grey), so every tod in
// 17.9–18.4 sits partway into that muddy lerp; and world.js scales the
// hemisphere light by dayAmt, which is ~0.03 at 17.9, so ground and
// facades sink to brown-black. main.js' loop runs updateWorld BEFORE
// updateSky every frame, so the corrections below (sunset gradient dome
// overlay, fog pull-back, dusk hemisphere fill) win every frame without
// touching world.js. Everything else is positioned
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
// Vice dusk grade targets: fog pulled to the horizon's pink-orange, and a
// warm pink hemisphere fill so pastel facades keep their colour at dusk.
const DUSK_FOG = new THREE.Color(0xff9e66);
const DUSK_HEMI = new THREE.Color(0xffb3c6);
const DUSK_GROUND = new THREE.Color(0x74506b);
// Sunset gradient dome bands (vertex colours, bottom -> zenith).
const DOME_BOT = new THREE.Color(0x2b1233); // below-horizon dusk purple
const DOME_HOR = new THREE.Color(0xff8b3d); // orange horizon
const DOME_MID = new THREE.Color(0xe0457b); // magenta-pink mid band
const DOME_TOP = new THREE.Color(0x2a1458); // deep violet zenith

function smoothstep(a, b, x) {
  const f = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return f * f * (3 - 2 * f);
}

function sunsetDome() {
  // Large BackSide sphere with per-vertex colours forming the vertical
  // sunset gradient: violet zenith -> magenta/pink mid -> orange
  // horizon -> dusk purple below. Radius 1420 sits INSIDE world.js'
  // 1500 dome and OUTSIDE the sun sprites (dist 1150); renderOrder -1
  // (within the sky group) draws it before the additive sun glow so the
  // disc stays hot on top of the gradient. Opacity is driven per-frame
  // by the sunset factor in updateSky — invisible outside dusk.
  const geo = new THREE.SphereGeometry(1420, 32, 24);
  const pos = geo.attributes.position;
  const cols = [];
  const cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / 1420; // -1..1, 0 = horizon
    cc.lerpColors(DOME_BOT, DOME_HOR, smoothstep(-0.08, 0.015, h));
    cc.lerp(DOME_MID, smoothstep(0.03, 0.30, h));
    cc.lerp(DOME_TOP, smoothstep(0.26, 0.62, h));
    cols.push(cc.r, cc.g, cc.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  mesh.visible = false;
  return mesh;
}

let sky = null; // { group, sunGlow, sunCore, clouds: [{spr, speed}], mats, dome }

export function initSky(G) {
  try {
    const group = new THREE.Group();
    group.renderOrder = 1;

    // --- sunset gradient dome (Vice round) -------------------------------
    const dome = sunsetDome();
    group.add(dome);

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
    sky = { group, sunGlow, sunCore, glowMat, coreMat, clouds, variants, dome };
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

    // --- vice dusk grade ---------------------------------------------------
    // Runs AFTER world.js' updateWorld in main.js' loop, so these win
    // every frame (world.js re-writes fog/hemi/sun from its keyframes
    // first, then we correct them — no accumulation).
    if (sky.dome) {
      // Sunset gradient overlay: decisive by ~18.1, gone by day/night.
      const domeOp = Math.min(1, sunset * 1.15) * 0.92;
      sky.dome.material.opacity = domeOp;
      sky.dome.visible = domeOp > 0.02;
    }
    if (sunset > 0) {
      // Fog: pull world.js' brown-grey-bound lerp back to the horizon's
      // pink-orange so distance haze matches the gradient's horizon band.
      if (G.scene && G.scene.fog) G.scene.fog.color.lerp(DUSK_FOG, sunset * 0.85);
      // Hemisphere fill: world.js scales hemi by dayAmt (~0.03 at 17.9,
      // intensity ~0.27) — add a warm pink dusk fill and a mauve ground
      // bounce (replacing the brown-grey 0x8a7a66) so ground and pastel
      // facades keep their colour instead of sinking to brown-black.
      if (G.hemi) {
        G.hemi.intensity += sunset * 0.5;
        if (G.hemi.color) G.hemi.color.lerp(DUSK_HEMI, sunset * 0.45);
        if (G.hemi.groundColor) G.hemi.groundColor.lerp(DUSK_GROUND, sunset * 0.55);
      }
      // Key light: a little extra warm sun so the low disc's side of the
      // boulevard still models the cars/facades at dusk.
      if (G.sun) { G.sun.intensity += sunset * 0.3; G.sun.color.lerp(LOW_SUN, sunset * 0.45); }
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
        m.color.lerp(vi === 1 ? SUNSET_CLOUD_PURPLE : SUNSET_CLOUD, sunset * 0.9 * Math.max(dayAmt, 0.45));
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
