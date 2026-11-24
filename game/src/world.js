// Ronin Bay world building: ground and streets laid first, then houses,
// the mart, the beach boardwalk and the boulevard shopfronts follow.
import * as THREE from
  'three';
import {
  CFG, DISTRICTS, TOUGE_POINTS, VICE } from './config.js';
import { pick, rnd, rr, ri } from './random.js';
import { loadHeroAsset }
  from './assets.js';

let glowTexCache = null;
const glowTextureGet = () => {
  null !== glowTexCache ? glowTexCache : null;
  if (null === glowTexCache) {
    let cnv_k;
    cnv_k = document.createElement('canvas');
    cnv_k.height = 128; cnv_k.width = cnv_k.height;
    let ctx_k;
    ctx_k = cnv_k.getContext('2d');
    let grad_k;
    grad_k = ctx_k.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad_k.addColorStop(0, 'rgba(255,255,255,1)');
    grad_k.addColorStop(0.4, 'rgba(255,255,255,.45)');
    grad_k.addColorStop(1, 'rgba(255,255,255,0)');
    ctx_k.fillStyle = grad_k; ctx_k.fillRect(0, 0, 128, 128);
    glowTexCache = new THREE.CanvasTexture(cnv_k);
  }
  return glowTexCache;
};

const SKY_ROWS_SRC = [];
SKY_ROWS_SRC.push([0, '#060a18', '#0e1830', '#16233f', '#101a2e']);
SKY_ROWS_SRC.push([5, '#060a18', '#0e1830', '#16233f', '#101a2e']);
SKY_ROWS_SRC.push([7, '#3d6fb4', '#d9a06b', '#f2d5a0', '#e8c9a0']);
SKY_ROWS_SRC.push([10.5, '#3a7bd5', '#8ec9e8', '#bfe3ef', '#cfe4ec']);
SKY_ROWS_SRC.push([16.5, '#3a6db0', '#c9b49a', '#f7d99a', '#ecd3a4']);
SKY_ROWS_SRC.push([17.8, '#35507a', '#e8763a', '#ffc46b', '#f2c99a']);
SKY_ROWS_SRC.push([19.5, '#141e38', '#6a4a5a', '#c97a4a', '#7a5a4e']);
SKY_ROWS_SRC.push([22, '#060a18', '#0e1830', '#16233f', '#101a2e'], [24, '#060a18', '#0e1830', '#16233f', '#101a2e']);
const SKY_KEYS = SKY_ROWS_SRC.map(([hr_k, topHex_k, midHex_k, horHex_k, fogHex_k]) => {
  const key_k = {};
  key_k.top = new THREE.Color(topHex_k); key_k.h = hr_k;
  key_k.mid = new THREE.Color(midHex_k);
  key_k.fog = new THREE.Color(fogHex_k);
  key_k.hor = new THREE.Color(horHex_k);
  return key_k;
});
const toneTopK = new THREE.Color(), toneMidK = new THREE.Color(), toneHorK = new THREE.Color();
const toneFogK = new THREE.Color(), toneWarmK = new THREE.Color(0xffe0b8);

const fracClampUnit = (frac_k) => {
  if (0 > frac_k) return 0;
  else if (1 < frac_k) return 1;
  else return frac_k;
};
const skyColorsCompute = (hr_k) => {
  let scan_k;
  scan_k = SKY_KEYS.length - SKY_KEYS.length;
  let active_k;
  active_k = scan_k; ++scan_k;
  for (; SKY_KEYS.length - 1 > scan_k;) {
    if (hr_k < SKY_KEYS[scan_k].h) break;
    active_k = scan_k; ++scan_k;
  }
  let from_k;
  from_k = SKY_KEYS[active_k];
  let to_k;
  to_k = SKY_KEYS[1 + active_k];
  let mix_k;
  mix_k = fracClampUnit((hr_k - from_k.h) / Math.max(0.001, to_k.h - from_k.h));
  toneTopK.lerpColors(from_k.top, to_k.top, mix_k);
  toneMidK.lerpColors(from_k.mid, to_k.mid, mix_k);
  toneHorK.lerpColors(from_k.hor, to_k.hor, mix_k);
  toneFogK.lerpColors(from_k.fog, to_k.fog, mix_k);
};

let glowSpritesList = [];
let skyHourPrev = -10;
let skyCnv = null, skyCtx = null, skyTex = null, skyDome = null;

const skyDomePaint = () => {
  null === skyCtx ? null : null;
  if (null !== skyCtx) {
    let grad_k;
    grad_k = skyCtx.createLinearGradient(0, 0, 0, 512);
    grad_k.addColorStop(0, `#${toneTopK.getHexString()}`);
    grad_k.addColorStop(0.55, `#${toneMidK.getHexString()}`);
    grad_k.addColorStop(1, `#${toneHorK.getHexString()}`);
    skyCtx.fillStyle = grad_k; skyCtx.fillRect(0, 0, 16, 512);
    skyTex ? skyTex.needsUpdate = true : null;
  }
};

export const glowSprite = (tint_k, size_k) => {
  let matOpts_k;
  matOpts_k = {};
  matOpts_k.depthWrite = false; matOpts_k.color = tint_k;
  matOpts_k.opacity = 0.85; matOpts_k.blending = THREE.AdditiveBlending;
  matOpts_k.map = glowTextureGet();
  matOpts_k.transparent = true;
  let spr_k;
  spr_k = new THREE.Sprite(new THREE.SpriteMaterial(matOpts_k));
  spr_k.scale.set(size_k, size_k, 1);
  return spr_k;
};

export const groundH = (x_k, z_k) => {
  let offX_k;
  offX_k = 330 + x_k;
  let offZ_k;
  offZ_k = 470 + z_k;
  let norm_k;
  norm_k = (offX_k * offX_k + offZ_k * offZ_k) / (330 * 330);
  let h_k = 14 * Math.exp(-2.2 * norm_k);
  (-140 < x_k || -180 < z_k) ? h_k *= Math.max(0, Math.min(1, 1 + (-140 - x_k) / 120)) : null;
  (-100 < x_k || -100 < z_k) ? h_k = 0 : null;
  return h_k;
};

const textureFromCanvas = (w_k, h_k, draw_k) => {
  let cnv_k;
  cnv_k = document.createElement('canvas');
  cnv_k.height = h_k; cnv_k.width = w_k;
  draw_k(cnv_k.getContext('2d'), w_k, h_k);
  let tex_k;
  tex_k = new THREE.CanvasTexture(cnv_k);
  tex_k.colorSpace = THREE.SRGBColorSpace;
  return tex_k;
};

const groundTextureBuild = () => {
  return textureFromCanvas(256, 256, (ctx_k) => {
    ctx_k.fillStyle = VICE.ground.base;
    ctx_k.fillRect(0, 0, 256, 256);
    let dot_k = 0;
    for (; 900 > dot_k;) {
      ctx_k.fillStyle = 'rgba(' + (190 + ri(0, 50)) + ',' + (175 + ri(0, 45)) + ',' + (140 + ri(0, 40)) + ',.14)';
      ctx_k.fillRect(256 * rnd(), 256 * rnd(), 2, 2);
      ++dot_k;
    }
    let patch_k = 0;
    for (; 26 > patch_k;) {
      ctx_k.fillStyle = 'rgba(255,250,235,.06)';
      ctx_k.fillRect(256 * rnd(), 256 * rnd(), rr(18, 46), rr(12, 30));
      ++patch_k;
    }
    ctx_k.strokeStyle = 'rgba(120,110,90,.10)';
    ctx_k.strokeRect(0, 0, 256, 256);
  });
};

function pavingTextureBuild() {
  let tex_k;
  tex_k = textureFromCanvas(128, 128, (ctx_k) => {
    ctx_k.fillStyle = VICE.ground.paving;
    ctx_k.fillRect(0, 0, 128, 128);
    ctx_k.fillStyle = VICE.ground.pavingAlt;
    ctx_k.fillRect(64, 0, 64, 64); ctx_k.fillRect(0, 64, 64, 64);
    let dot_k = 0;
    for (; 260 > dot_k;) {
      ctx_k.fillStyle = 'rgba(' + (150 + ri(0, 60)) + ',' + (145 + ri(0, 50)) + ',' + (120 + ri(0, 40)) + ',.13)';
      ctx_k.fillRect(128 * rnd(), 128 * rnd(), 2, 2);
      ++dot_k;
    }
    ctx_k.strokeStyle = VICE.ground.pavingGrout;
    ctx_k.lineWidth = 3;
    ctx_k.strokeRect(0, 0, 128, 128);
    ctx_k.beginPath();
    ctx_k.moveTo(64, 0); ctx_k.lineTo(64, 128);
    ctx_k.moveTo(0, 64); ctx_k.lineTo(128, 64);
    ctx_k.stroke();
  });
  tex_k.wrapS = THREE.RepeatWrapping; tex_k.wrapT = THREE.RepeatWrapping;
  return tex_k;
}

function grassTextureBuild() {
  let tex_k;
  tex_k = textureFromCanvas(128, 128, (ctx_k) => {
    ctx_k.fillStyle = VICE.ground.grass;
    ctx_k.fillRect(0, 0, 128, 128);
    let blade_k = 0;
    for (; 700 > blade_k;) {
      if (0.5 > rnd()) ctx_k.fillStyle = VICE.ground.grassLight;
      else ctx_k.fillStyle = VICE.ground.grassDark;
      ctx_k.globalAlpha = rr(0.12, 0.3);
      ctx_k.fillRect(128 * rnd(), 128 * rnd(), 2, rr(2, 4));
      ++blade_k;
    }
    ctx_k.globalAlpha = 1;
  });
  tex_k.wrapS = THREE.RepeatWrapping; tex_k.wrapT = THREE.RepeatWrapping;
  return tex_k;
}

function sandTextureBuild() {
  let tex_k;
  tex_k = textureFromCanvas(128, 128, (ctx_k) => {
    ctx_k.fillStyle = VICE.ground.sand;
    ctx_k.fillRect(0, 0, 128, 128);
    let grain_k = 0;
    for (; 500 > grain_k;) {
      if (0.6 > rnd()) ctx_k.fillStyle = VICE.ground.sandSpeckle;
      else ctx_k.fillStyle = '#fff3cf';
      ctx_k.globalAlpha = rr(0.1, 0.28);
      ctx_k.fillRect(128 * rnd(), 128 * rnd(), 2, 2);
      ++grain_k;
    }
    ctx_k.globalAlpha = 1;
  });
  tex_k.wrapS = THREE.RepeatWrapping; tex_k.wrapT = THREE.RepeatWrapping;
  return tex_k;
}

function grassMatMake(rx_k, ry_k) {
  let tex_k;
  tex_k = grassTextureBuild();
  tex_k.repeat.set(rx_k, ry_k);
  const matOpts_k = {};
  matOpts_k.map = tex_k; matOpts_k.roughness = 1;
  return new THREE.MeshStandardMaterial(matOpts_k);
}
function pavingMatMake(rx_k, ry_k, tint_k) {
  let tex_k;
  tex_k = pavingTextureBuild();
  tex_k.repeat.set(rx_k, ry_k);
  const matOpts_k = {};
  matOpts_k.map = tex_k; matOpts_k.roughness = 1;
  if (tint_k) matOpts_k.color = tint_k;
  else matOpts_k.color = 0xffffff;
  return new THREE.MeshStandardMaterial(matOpts_k);
}
const WINDOW_LIT_TONES = [];
WINDOW_LIT_TONES.push('#ffd9a0', '#ffc98a', '#fff3d0', '#ffe9b8', '#bfe0ff', '#9fd4ff');
function buildingTextureBuild(base_k, litChance_k) {
  return textureFromCanvas(128, 256, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = base_k;
    ctx_k.fillRect(0, 0, w_k, h_k);
    let rowY_k = 8;
    for (; h_k - 8 > rowY_k;) {
      let colX_k = 6;
      for (; w_k - 6 > colX_k;) {
        let lit_k;
        lit_k = rnd() < litChance_k;
        if (!lit_k) ctx_k.fillStyle = '#2c3844';
        else {
          let toneIdx_k;
          if (0.72 > rnd()) toneIdx_k = 4;
          else toneIdx_k = 6;
          ctx_k.fillStyle = WINDOW_LIT_TONES[Math.floor(rnd() * toneIdx_k)];
        }
        ctx_k.fillRect(colX_k, rowY_k, 9, 8);
        ctx_k.fillStyle = 'rgba(255,255,255,.15)';
        ctx_k.fillRect(colX_k, rowY_k, 9, 2);
        colX_k += 14;
      }
      rowY_k += 14;
    }
  });
}
function signTextureBuild(label_k, bg_k, fg_k) {
  return textureFromCanvas(256, 64, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = bg_k;
    ctx_k.fillRect(0, 0, w_k, h_k);
    ctx_k.font = 'bold 34px sans-serif';
    ctx_k.textAlign = 'center';
    ctx_k.textBaseline = 'middle';
    ctx_k.shadowColor = fg_k;
    ctx_k.shadowBlur = 12;
    ctx_k.fillStyle = fg_k;
    ctx_k.fillText(label_k, w_k / 2, h_k / 2);
  });
}

export const makePalm = (height_k) => {
  const root_k = new THREE.Group();
  const curve_k = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.15, height_k * 0.55, 0),
    new THREE.Vector3(0.55, height_k, 0),
  );
  root_k.add(new THREE.Mesh(
    new THREE.TubeGeometry(curve_k, 6, 0.14, 6),
    new THREE.MeshStandardMaterial({ roughness: 0.95, color: 0x8a6b4a }),
  ));
  let crown_k;
  crown_k = curve_k.getPoint(1);
  const frondMatOpts_k = {};
  frondMatOpts_k.side = THREE.DoubleSide; frondMatOpts_k.vertexColors = true;
  frondMatOpts_k.roughness = 0.9;
  const frondMat_k = new THREE.MeshStandardMaterial(frondMatOpts_k);
  let frond_k = 0;
  while (8 > frond_k) {
    let len_k;
    len_k = rr(2.0, 2.4);
    let geo_k;
    geo_k = new THREE.PlaneGeometry(0.5, len_k, 1, 6);
    const rgb_k = [];
    let pos_k;
    pos_k = geo_k.attributes.position;
    let toneFrom_k;
    toneFrom_k = new THREE.Color(0x2e7d32);
    let toneTo_k;
    toneTo_k = new THREE.Color(0x66bb4a);
    let toneWork_k;
    toneWork_k = new THREE.Color();
    let vert_k = 0;
    while (pos_k.count > vert_k) {
      const vy_k = pos_k.getY(vert_k);
      const frac_k = (vy_k + len_k / 2) / len_k;
      pos_k.setZ(vert_k, -(0.9 * Math.pow(frac_k, 2)));
      pos_k.setX(vert_k, pos_k.getX(vert_k) * (1 - frac_k * 0.7));
      const toneCopy_k = toneWork_k.copy(toneFrom_k);
      toneCopy_k.lerp(toneTo_k, frac_k);
      rgb_k.push(toneWork_k.r, toneWork_k.g, toneWork_k.b);
      ++vert_k;
    }
    geo_k.setAttribute('color', new THREE.Float32BufferAttribute(rgb_k, 3));
    geo_k.computeVertexNormals();
    const frond_k2 = new THREE.Mesh(geo_k, frondMat_k);
    frond_k2.position.copy(crown_k);
    frond_k2.rotation.order = 'YXZ';
    frond_k2.rotation.y = (frond_k / 8) * 2 * Math.PI + rr(-0.2, 0.2);
    frond_k2.rotation.x = -Math.PI / 2 + rr(0.35, 0.6);
    frond_k2.translateY(len_k / 2 + -0.1);
    root_k.add(frond_k2);
    ++frond_k;
  }
  root_k.traverse((node_k) => {
    node_k.isMesh ? node_k.castShadow = true : null;
  });
  return root_k;
};

export const makeShadeTree = (height_k, canopy_k) => {
  const grp_k = new THREE.Group();
  const trunk_k = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.2, height_k * 0.55, 7),
    new THREE.MeshStandardMaterial({ roughness: 1, color: 0x6b4a2f }),
  );
  trunk_k.position.y = height_k * 0.275;
  grp_k.add(trunk_k);
  const crownMatOpts_k = {};
  crownMatOpts_k.roughness = 1; crownMatOpts_k.flatShading = true;
  if (canopy_k) crownMatOpts_k.color = canopy_k;
  else crownMatOpts_k.color = 0x3d8b4f;
  const crownMat_k = new THREE.MeshStandardMaterial(crownMatOpts_k);
  let puff_k = 0;
  for (; 3 > puff_k;) {
    const puffMesh_k = new THREE.Mesh(
      new THREE.IcosahedronGeometry(height_k * rr(0.28, 0.4), 1), crownMat_k,
    );
    puffMesh_k.position.set(rr(-0.5, 0.5), height_k * 0.55 + rr(0, height_k * 0.3), rr(-0.5, 0.5));
    grp_k.add(puffMesh_k);
    ++puff_k;
  }
  return grp_k;
};

const MART_SITE = {};
MART_SITE.z = -255; MART_SITE.name = 'RONIN MART'; MART_SITE.x = -82.5;
const stdMatStore = new Map();
const stdMatShared = (tone_k, rough_k, metal_k) => {
  let roughAmt_k;
  if (rough_k) roughAmt_k = rough_k;
  else roughAmt_k = 0.95;
  let metalAmt_k;
  if (metal_k) metalAmt_k = metal_k;
  else metalAmt_k = 0;
  const key_k = `${tone_k}|${roughAmt_k}|${metalAmt_k}`;
  if (!stdMatStore.has(key_k)) {
    const matOpts_k = {};
    matOpts_k.color = tone_k; matOpts_k.metalness = metalAmt_k;
    if (rough_k) matOpts_k.roughness = rough_k;
    else matOpts_k.roughness = 0.95;
    stdMatStore.set(key_k, new THREE.MeshStandardMaterial(matOpts_k));
  }
  return stdMatStore.get(key_k);
};
function tougeDistCalc(x_k, z_k) {
  let best_k = 1e9;
  TOUGE_POINTS.slice(0, -1).forEach((ptA_k, seg_k) => {
    let ptB_k;
    ptB_k = TOUGE_POINTS[1 + seg_k];
    let dx_k;
    dx_k = ptB_k[0] - ptA_k[0];
    let dz_k;
    dz_k = ptB_k[1] - ptA_k[1];
    let lenSq_k;
    if (dx_k * dx_k + dz_k * dz_k) lenSq_k = dx_k * dx_k + dz_k * dz_k;
    else lenSq_k = 1;
    let t_k = ((x_k - ptA_k[0]) * dx_k + (z_k - ptA_k[1]) * dz_k) / lenSq_k;
    t_k = Math.min(1, Math.max(0, t_k));
    let cand_k;
    cand_k = Math.hypot(
      x_k - (ptA_k[0] + dx_k * t_k), z_k - (ptA_k[1] + dz_k * t_k),
    );
    best_k > cand_k ? best_k = cand_k : null;
  });
  return best_k;
}
const prismGeoMake = (w_k, h_k, d_k) => {
  let outline_k;
  outline_k = new THREE.Shape();
  outline_k.moveTo(-w_k / 2, 0);
  outline_k.lineTo(w_k / 2, 0);
  outline_k.lineTo(0, h_k);
  outline_k.closePath();
  const geoOpts_k = {};
  geoOpts_k.depth = d_k; geoOpts_k.bevelEnabled = false;
  let geo_k;
  geo_k = new THREE.ExtrudeGeometry(outline_k, geoOpts_k);
  geo_k.translate(0, 0, -d_k / 2);
  return geo_k;
};
const YARD_TONES_HOUSE = [];
YARD_TONES_HOUSE.push(0x5d9a52, 0x67a35a, 0x548c4c, 0x71ab60);
const ROOF_TONES_HOUSE = [];
ROOF_TONES_HOUSE.push(0xb5523c, 0x8a4a3a, 0x5d6d7e, 0xa03d2d, 0x6b4a35, 0x44586a, 0xc96f4a);
const WALL_TONES_HOUSE = [];
WALL_TONES_HOUSE.push('#f2e3c8', '#eec9b8', '#dfe8d8', '#f5d9e0');
WALL_TONES_HOUSE.push('#dcebf5', '#f7ecc9', '#e6d7f0', '#ffe8cc');
const houseWindowMatOpts = {};
houseWindowMatOpts.metalness = 0.4; houseWindowMatOpts.emissive = 0xffc873;
houseWindowMatOpts.color = 0xbfe0ea; houseWindowMatOpts.roughness = 0.25;
houseWindowMatOpts.emissiveIntensity = 0.35;
const houseWindowMaterial = new THREE.MeshStandardMaterial(houseWindowMatOpts);
let lastWallColour = null;

const houseBuild = (G_k, scene_k, hx_k, hz_k, face_k) => {
  let root_k;
  root_k = new THREE.Group();
  root_k.position.set(hx_k, groundH(hx_k, hz_k), hz_k);
  if (0 < face_k) root_k.rotation.y = 0;
  else root_k.rotation.y = Math.PI;
  let tall_k;
  tall_k = 0.45 > rnd();
  let wid_k;
  wid_k = rr(9, 12);
  let dep_k;
  dep_k = rr(8, 10);
  let wallH_k;
  if (!tall_k) wallH_k = rr(2.9, 3.4);
  else wallH_k = rr(5.2, 6);
  let roofH_k;
  roofH_k = rr(1.8, 2.6);

  const lot_k = new THREE.Mesh(new THREE.PlaneGeometry(30, 25), pavingMatMake(6, 5));
  void YARD_TONES_HOUSE;
  lot_k.rotation.x = -Math.PI / 2;
  lot_k.position.y = 0.03;
  root_k.add(lot_k);
  const drive_k = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8.5), stdMatShared(0x9a9a96, 1));
  drive_k.rotation.x = -Math.PI / 2;
  drive_k.position.set(wid_k * -0.28, 0.05, dep_k / 2 + 4.2);
  root_k.add(drive_k);
  const hedgeMat_k = stdMatShared(0x2e6b34, 1);
  const backHedge_k = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 0.4), hedgeMat_k);
  backHedge_k.position.set(0, 0.28, -12.3);
  root_k.add(backHedge_k);
  const signList_k = [];
  signList_k.push(-1, 1);
  const signIter_k = signList_k[Symbol.iterator]();
  let signStep_k;
  while (!(signStep_k = signIter_k.next()).done) {
    const sign_k = signStep_k.value;
    const sideHedge_k = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 25), hedgeMat_k);
    sideHedge_k.position.set(sign_k * 14.8, 0.28, 0);
    root_k.add(sideHedge_k);
  }
  let wallTone_k = pick(WALL_TONES_HOUSE);
  lastWallColour === wallTone_k
    ? wallTone_k = WALL_TONES_HOUSE[(1 + WALL_TONES_HOUSE.indexOf(wallTone_k)) % WALL_TONES_HOUSE.length]
    : null;
  lastWallColour = wallTone_k;
  const wall_k = new THREE.Mesh(
    new THREE.BoxGeometry(wid_k, wallH_k, dep_k),
    stdMatShared(new THREE.Color(wallTone_k).getHex(), 0.95),
  );
  wall_k.position.y = wallH_k / 2;
  root_k.add(wall_k);
  const roof_k = new THREE.Mesh(
    prismGeoMake(wid_k + 1.2, roofH_k, dep_k + 1), stdMatShared(pick(ROOF_TONES_HOUSE), 0.9),
  );
  roof_k.position.y = wallH_k;
  root_k.add(roof_k);
  const door_k = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), stdMatShared(0x4a3220, 0.9));
  door_k.position.set(wid_k * -0.28, 1.1, dep_k / 2 + 0.06);
  root_k.add(door_k);
  let winRows_k;
  if (!tall_k) winRows_k = [1.9];
  else {
    winRows_k = [];
    winRows_k.push(1.9, 4.4);
  }
  const rowIter_k = winRows_k[Symbol.iterator]();
  let rowStep_k;
  while (!(rowStep_k = rowIter_k.next()).done) {
    const rowY_k = rowStep_k.value;
    const colList_k = [];
    colList_k.push(0, wid_k * 0.3);
    const colIter_k = colList_k[Symbol.iterator]();
    let colStep_k;
    while (!(colStep_k = colIter_k.next()).done) {
      const colX_k = colStep_k.value;
      const win_k = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), houseWindowMaterial);
      win_k.position.set(colX_k, rowY_k, dep_k / 2 + 0.06);
      root_k.add(win_k);
    }
  }
  0.4 > rnd() ? (() => {
    const chimney_k = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), stdMatShared(0x8a7a6a, 1));
    chimney_k.position.set(wid_k * 0.3, wallH_k + roofH_k * 0.55, 0);
    root_k.add(chimney_k);
  })() : null;
  0.35 > rnd() ? (() => {
    const yardTree_k = makeShadeTree(rr(2.6, 3.4), 0x3d8b4f);
    yardTree_k.position.set(11, 0, -8);
    root_k.add(yardTree_k);
  })() : null;
  root_k.traverse((node_k) => {
    node_k.isMesh ? node_k.castShadow = true : null;
  });
  lot_k.castShadow = false; lot_k.receiveShadow = true;
  drive_k.castShadow = false; drive_k.receiveShadow = true;
  scene_k.add(root_k);
  G_k.addCollider(hx_k, hz_k, wid_k / 2, dep_k / 2, wallH_k + roofH_k);
};
const residentialBlockBuild = (G_k, scene_k, cx_k, cz_k) => {
  const rowBagA_k = {};
  rowBagA_k.dz = -31; rowBagA_k.face = -1;
  const rowBagB_k = {};
  rowBagB_k.dz = 31; rowBagB_k.face = 1;
  const rowBags_k = [];
  rowBags_k.push(rowBagA_k, rowBagB_k);
  const rowIter_k = rowBags_k[Symbol.iterator]();
  let rowStep_k;
  while (!(rowStep_k = rowIter_k.next()).done) {
    const rowBag_k = rowStep_k.value;
    const localList_k = [];
    localList_k.push(-57, -19, 19, 57);
    const localIter_k = localList_k[Symbol.iterator]();
    let localStep_k;
    while (!(localStep_k = localIter_k.next()).done) {
      const localX_k = localStep_k.value;
      let houseX_k;
      houseX_k = (cx_k + localX_k) + rr(-3, 3);
      let houseZ_k;
      houseZ_k = (cz_k + rowBag_k.dz) + rr(-3, 3);
      if (16 > tougeDistCalc(houseX_k, houseZ_k)) continue;
      if (
        G_k.roadX.some((road_k) => 26 > Math.abs(houseX_k - road_k)) ||
        G_k.roadZ.some((road_k) => 26 > Math.abs(houseZ_k - road_k))
      )
        continue;
      houseBuild(G_k, scene_k, houseX_k, houseZ_k, rowBag_k.face);
    }
  }
};
const parkedCarBuild = (paint_k) => {
  const grp_k = new THREE.Group();
  const bodyMatOpts_k = {};
  bodyMatOpts_k.roughness = 0.45; bodyMatOpts_k.color = paint_k; bodyMatOpts_k.metalness = 0.35;
  const body_k = new THREE.Mesh(
    new THREE.BoxGeometry(1.78, 0.55, 4.4),
    new THREE.MeshStandardMaterial(bodyMatOpts_k),
  );
  body_k.position.y = 0.55;
  grp_k.add(body_k);
  const cabin_k = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), stdMatShared(0x1c2733, 0.2, 0.6));
  cabin_k.position.set(0, 1.05, -0.15);
  grp_k.add(cabin_k);
  let wheelGeo_k;
  wheelGeo_k = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
  let wheelMat_k;
  wheelMat_k = stdMatShared(0x17181a, 0.9);
  const signXList_k = [];
  signXList_k.push(-1, 1);
  const signXIter_k = signXList_k[Symbol.iterator]();
  let signXStep_k;
  while (!(signXStep_k = signXIter_k.next()).done) {
    const signX_k = signXStep_k.value;
    const signZList_k = [];
    signZList_k.push(-1, 1);
    const signZIter_k = signZList_k[Symbol.iterator]();
    let signZStep_k;
    while (!(signZStep_k = signZIter_k.next()).done) {
      const signZ_k = signZStep_k.value;
      const wheel_k = new THREE.Mesh(wheelGeo_k, wheelMat_k);
      wheel_k.rotation.z = Math.PI / 2;
      wheel_k.position.set(signX_k * 0.85, 0.33, signZ_k * 1.35);
      grp_k.add(wheel_k);
    }
  }
  return grp_k;
};

const marketBuild = (G_k, scene_k) => {
  let baseX_k;
  baseX_k = MART_SITE.x;
  let baseZ_k;
  baseZ_k = MART_SITE.z;
  let grp_k;
  grp_k = new THREE.Group();
  grp_k.position.set(baseX_k, groundH(baseX_k, baseZ_k), baseZ_k);
  scene_k.add(grp_k);
  let shell_k;
  shell_k = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), stdMatShared(0xdfe3e6, 0.9));
  shell_k.position.y = 4.5;
  grp_k.add(shell_k);
  let cap_k;
  cap_k = new THREE.Mesh(new THREE.BoxGeometry(48, 0.5, 24), stdMatShared(0x3c4248, 0.9));
  cap_k.position.y = 9.25;
  grp_k.add(cap_k);
  const acSpots_k = [];
  acSpots_k.push([-14, -6], [12, 5]);
  const acIter_k = acSpots_k[Symbol.iterator]();
  let acStep_k;
  while (!(acStep_k = acIter_k.next()).done) {
    const [acX, acZ] = acStep_k.value;
    const unit_k = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.6), stdMatShared(0x707880, 0.8, 0.3));
    unit_k.position.set(acX, 10.05, acZ);
    grp_k.add(unit_k);
  }
  const fascia_k = new THREE.Mesh(new THREE.BoxGeometry(34, 3.4, 0.4), stdMatShared(0x12233f, 0.8));
  fascia_k.position.set(0, 7.4, 11.1);
  grp_k.add(fascia_k);
  const fasciaTex_k = textureFromCanvas(1024, 160, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = '#12233f';
    ctx_k.fillRect(0, 0, w_k, h_k);
    ctx_k.fillStyle = '#d8232a';
    ctx_k.fillRect(0, h_k - 18, w_k, 18);
    ctx_k.fillStyle = '#d8232a';
    ctx_k.beginPath();
    ctx_k.arc(72, 72, 44, 0, Math.PI * 2);
    ctx_k.fill();
    ctx_k.fillStyle = '#ffffff';
    ctx_k.font = 'bold 44px sans-serif';
    ctx_k.textAlign = 'center';
    ctx_k.textBaseline = 'middle';
    ctx_k.fillText('R', 72, 76);
    ctx_k.font = 'bold 96px sans-serif';
    ctx_k.textAlign = 'left';
    ctx_k.fillText('RONIN MART', 140, 76);
  });
  const fasciaSignMatOpts_k = {};
  fasciaSignMatOpts_k.map = fasciaTex_k;
  const fasciaSign_k = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 3.2), new THREE.MeshBasicMaterial(fasciaSignMatOpts_k),
  );
  fasciaSign_k.position.set(0, 7.4, 11.32);
  grp_k.add(fasciaSign_k);
  const fasciaGlow_k = glowSprite(0x9fd4ff, 17);
  fasciaGlow_k.position.set(0, 7.4, 12.4);
  fasciaGlow_k.material.opacity = 0;
  grp_k.add(fasciaGlow_k);
  glowSpritesList.push(fasciaGlow_k);

  const glazingTex_k = textureFromCanvas(512, 64, (ctx_k, w_k, h_k) => {
    const fade_k = ctx_k.createLinearGradient(0, 0, 0, h_k);
    fade_k.addColorStop(0, '#8fc3d4');
    fade_k.addColorStop(1, '#3d6d80');
    ctx_k.fillStyle = fade_k;
    ctx_k.fillRect(0, 0, w_k, h_k);
    ctx_k.fillStyle = 'rgba(20,30,38,.85)';
    ctx_k.fillRect(w_k / 2 - 30, 6, 60, h_k - 6);
    ctx_k.strokeStyle = 'rgba(240,248,250,.9)';
    ctx_k.lineWidth = 3;
    let mullion_k = 0;
    for (; w_k >= mullion_k;) {
      ctx_k.beginPath();
      ctx_k.moveTo(mullion_k, 0);
      ctx_k.lineTo(mullion_k, h_k);
      ctx_k.stroke();
      mullion_k += 42;
    }
    ctx_k.strokeStyle = 'rgba(240,248,250,.95)';
    ctx_k.strokeRect(w_k / 2 - 30, 6, 60, h_k - 6);
  });
  const glazingMatOpts_k = {};
  glazingMatOpts_k.roughness = 0.2; glazingMatOpts_k.map = glazingTex_k; glazingMatOpts_k.metalness = 0.5;
  const glazing_k = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 3.1),
    new THREE.MeshStandardMaterial(glazingMatOpts_k),
  );
  glazing_k.position.set(0, 1.75, 11.06);
  grp_k.add(glazing_k);
  const canopy_k = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 3), stdMatShared(0x2c3138, 0.8));
  canopy_k.position.set(0, 3.6, 12.4);
  grp_k.add(canopy_k);

  const apronTex_k = textureFromCanvas(1024, 512, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = '#3a3d40';
    ctx_k.fillRect(0, 0, w_k, h_k);
    let fleck_k = 0;
    for (; 2600 > fleck_k;) {
      const shadeValue = 46 + Math.floor(26 * rnd());
      ctx_k.fillStyle = 'rgba(' + shadeValue + ',' + shadeValue + ',' + (shadeValue + 3) + ',.16)';
      ctx_k.fillRect(w_k * rnd(), h_k * rnd(), 2, 2);
      ++fleck_k;
    }
    ctx_k.strokeStyle = 'rgba(245,245,240,.9)';
    ctx_k.lineWidth = 5;
    let bayLine_k = 40;
    for (; w_k - 40 >= bayLine_k;) {
      ctx_k.beginPath();
      ctx_k.moveTo(bayLine_k, 10);
      ctx_k.lineTo(bayLine_k, 128);
      ctx_k.stroke();
      ctx_k.beginPath();
      ctx_k.moveTo(bayLine_k, h_k - 128);
      ctx_k.lineTo(bayLine_k, h_k - 10);
      ctx_k.stroke();
      bayLine_k += 74;
    }
    ctx_k.beginPath();
    ctx_k.moveTo(40, 128);
    ctx_k.lineTo(w_k - 40, 128);
    ctx_k.stroke();
    ctx_k.beginPath();
    ctx_k.moveTo(40, h_k - 128);
    ctx_k.lineTo(w_k - 40, h_k - 128);
    ctx_k.stroke();
  });
  const apronMatOpts_k = {};
  apronMatOpts_k.map = apronTex_k; apronMatOpts_k.roughness = 1;
  const apron_k = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 32), new THREE.MeshStandardMaterial(apronMatOpts_k),
  );
  apron_k.rotation.x = -Math.PI / 2;
  apron_k.position.set(0, 0.04, 27);
  grp_k.add(apron_k);
  const lane_k = new THREE.Mesh(new THREE.PlaneGeometry(9, 42), stdMatShared(0x3a3d40, 1));
  lane_k.rotation.x = -Math.PI / 2;
  lane_k.position.set(0, 0.04, 64);
  grp_k.add(lane_k);

  const bayPaints_k = [];
  bayPaints_k.push(0xc0c4c9, 0x3f8cff, 0xd95555, 0x44484e, 0xf2b21b, 0x5a7d4f);
  const bayList_k = [];
  bayList_k.push([-22, 19.5, Math.PI], [-14.5, 19.5, Math.PI], [6, 19.5, Math.PI]);
  bayList_k.push([18, 35, 0], [25.5, 19.5, Math.PI]);
  bayList_k.forEach(([bayX, bayZ, bayRy], bay_k) => {
    const car_k = parkedCarBuild(bayPaints_k[bay_k % bayPaints_k.length]);
    car_k.position.set(bayX, 0, bayZ);
    car_k.rotation.y = bayRy;
    grp_k.add(car_k);
  });
  const steelMat_k = stdMatShared(0xb0b6bc, 0.4, 0.7);
  const corralList_k = [];
  corralList_k.push([-18, 31], [14, 16.5]);
  const corralIter_k = corralList_k[Symbol.iterator]();
  let corralStep_k;
  while (!(corralStep_k = corralIter_k.next()).done) {
    const [corralX_k, corralZ_k] = corralStep_k.value;
    const flankList_k = [];
    flankList_k.push(-1, 1);
    const flankIter_k = flankList_k[Symbol.iterator]();
    let flankStep_k;
    while (!(flankStep_k = flankIter_k.next()).done) {
      const flank_k = flankStep_k.value;
      const bar_k = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.6), steelMat_k);
      bar_k.position.set(corralX_k + flank_k * 0.9, 0.75, corralZ_k);
      grp_k.add(bar_k);
      const tipList_k = [];
      tipList_k.push(-1, 1);
      const tipIter_k = tipList_k[Symbol.iterator]();
      let tipStep_k;
      while (!(tipStep_k = tipIter_k.next()).done) {
        const tip_k = tipStep_k.value;
        const leg_k = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), steelMat_k);
        leg_k.position.set(corralX_k + flank_k * 0.9, 0.38, corralZ_k + tip_k * 1.8);
        grp_k.add(leg_k);
      }
    }
    const cart_k = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), steelMat_k);
    cart_k.position.set(corralX_k, 0.45, corralZ_k);
    grp_k.add(cart_k);
  }
  const crateTones_k = [];
  crateTones_k.push(0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b);
  const shelfList_k = [];
  shelfList_k.push(-8.5, 8.5);
  const shelfIter_k = shelfList_k[Symbol.iterator]();
  let shelfStep_k;
  while (!(shelfStep_k = shelfIter_k.next()).done) {
    const shelfX_k = shelfStep_k.value;
    const shelf_k = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), stdMatShared(0x6b4a2f, 0.95));
    shelf_k.position.set(shelfX_k, 0.45, 13.2);
    grp_k.add(shelf_k);
    let box_k = 0;
    for (; 3 > box_k;) {
      let shelfOff_k;
      if (0 < shelfX_k) shelfOff_k = 1;
      else shelfOff_k = 0;
      const boxMesh_k = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.9),
        stdMatShared(crateTones_k[(box_k + shelfOff_k) % 4], 0.9),
      );
      boxMesh_k.position.set(box_k - 1 + shelfX_k, 1.18, 13.2);
      grp_k.add(boxMesh_k);
      ++box_k;
    }
  }
  const poleMeshK = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 8), steelMat_k);
  poleMeshK.position.set(24, 3.5, 52);
  grp_k.add(poleMeshK);
  const poleSignMatOpts_k = {};
  poleSignMatOpts_k.map = fasciaTex_k;
  const poleSign_k = new THREE.Mesh(
    new THREE.BoxGeometry(7.5, 2.3, 0.35), new THREE.MeshBasicMaterial(poleSignMatOpts_k),
  );
  poleSign_k.position.set(24, 6.8, 52);
  grp_k.add(poleSign_k);
  G_k.addCollider(baseX_k, baseZ_k, 23, 11, 9);
};

const beachStripBuild = (G_k, scene_k) => {
  function blocked_k(px_k, pz_k, pad_k) {
    return G_k.colliders.some(
      (c_k) =>
        c_k.hw + pad_k > Math.abs(px_k - c_k.x) &&
        c_k.hd + pad_k > Math.abs(pz_k - c_k.z),
    );
  }
  let deckTex_k;
  deckTex_k = textureFromCanvas(256, 64, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = '#a97e56';
    ctx_k.fillRect(0, 0, w_k, h_k);
    ctx_k.strokeStyle = 'rgba(70,45,25,.55)';
    ctx_k.lineWidth = 3;
    let board_k = 0;
    for (; w_k >= board_k;) {
      ctx_k.beginPath();
      ctx_k.moveTo(board_k, 0);
      ctx_k.lineTo(board_k, h_k);
      ctx_k.stroke();
      board_k += 32;
    }
    ctx_k.strokeStyle = 'rgba(70,45,25,.35)';
    ctx_k.beginPath();
    ctx_k.moveTo(0, 2);
    ctx_k.lineTo(w_k, 2);
    ctx_k.moveTo(0, h_k - 2);
    ctx_k.lineTo(w_k, h_k - 2);
    ctx_k.stroke();
  });
  deckTex_k.wrapS = THREE.RepeatWrapping; deckTex_k.wrapT = THREE.RepeatWrapping;
  deckTex_k.repeat.set(30, 1);
  const deckMatOpts_k = {};
  deckMatOpts_k.map = deckTex_k; deckMatOpts_k.roughness = 1;
  const deck_k = new THREE.Mesh(
    new THREE.BoxGeometry(1120, 0.1, 6), new THREE.MeshStandardMaterial(deckMatOpts_k),
  );
  deck_k.position.set(100, 0.07, 556);
  deck_k.receiveShadow = true;
  scene_k.add(deck_k);
  let shoreX_k = -440;
  for (; 640 >= shoreX_k;) {
    let candX_k;
    candX_k = shoreX_k + rr(-3, 3);
    let candZ_k;
    candZ_k = 549 + rr(-1, 1);
    !blocked_k(candX_k, candZ_k, 1.5) ? (() => {
      const palm_k = makePalm(rr(4.5, 6.5));
      palm_k.position.set(candX_k, 0, candZ_k);
      palm_k.rotation.y = rr(0, 6.28);
      scene_k.add(palm_k);
    })() : null;
    shoreX_k += 55;
  }
  const shadeTones_k = [];
  shadeTones_k.push(0xff5da2, 0xffb35c, 0x39d5ff, 0xffe14d, 0x7dffb0, 0xff5c39);
  let shade_k = 0;
  for (; 14 > shade_k;) {
    ++shade_k;
    let spotX_k = 0;
    let spotZ_k = 0;
    let ok_k = false;
    let attempt_k = 0;
    for (; 6 > attempt_k && !ok_k;) {
      spotX_k = rr(-420, 620);
      spotZ_k = rr(578, 636);
      ok_k = !blocked_k(spotX_k, spotZ_k, 2);
      ++attempt_k;
    }
    if (!ok_k) continue;
    const shadeGrp_k = new THREE.Group();
    shadeGrp_k.position.set(spotX_k, 0, spotZ_k);
    shadeGrp_k.rotation.y = rr(0, 6.28);
    const mast_k = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), stdMatShared(0xd8d8d2, 0.7));
    mast_k.position.y = 1.15;
    mast_k.rotation.z = 0.12;
    shadeGrp_k.add(mast_k);
    const top_k = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10), stdMatShared(pick(shadeTones_k), 0.85));
    top_k.position.set(0.14, 2.35, 0);
    top_k.rotation.z = 0.12;
    shadeGrp_k.add(top_k);
    let lounger_k = 0;
    for (; 2 > lounger_k;) {
      ++lounger_k;
      if (0.3 > rnd()) continue;
      const loungerGrp_k = new THREE.Group();
      loungerGrp_k.position.set(rr(-1.6, 1.6), 0, rr(0.8, 1.8));
      loungerGrp_k.rotation.y = rr(-0.5, 0.5);
      const base_k = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.5), stdMatShared(0xf2efe4, 0.9));
      base_k.position.y = 0.28;
      loungerGrp_k.add(base_k);
      const rest_k = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.8), stdMatShared(pick(shadeTones_k), 0.9));
      rest_k.position.set(0, 0.5, -0.75);
      rest_k.rotation.x = -0.7;
      loungerGrp_k.add(rest_k);
      shadeGrp_k.add(loungerGrp_k);
    }
    scene_k.add(shadeGrp_k);
  }
  const anchorList_k = [];
  anchorList_k.push(-300, 100, 500);
  const anchorIter_k = anchorList_k[Symbol.iterator]();
  let anchorStep_k;
  while (!(anchorStep_k = anchorIter_k.next()).done) {
    const anchorX_k = anchorStep_k.value;
    let postX_k = anchorX_k;
    for (; blocked_k(postX_k, 598, 2) && anchorX_k + 60 > postX_k;) postX_k += 18;
    if (blocked_k(postX_k, 598, 2)) continue;
    const postGrp_k = new THREE.Group();
    postGrp_k.position.set(postX_k, 0, 598);
    let paleMat_k;
    paleMat_k = stdMatShared(0xf2efe4, 0.85);
    let scarletMat_k;
    scarletMat_k = stdMatShared(0xd8232a, 0.85);
    const strutXList_k = [];
    strutXList_k.push(-1, 1);
    const strutXIter_k = strutXList_k[Symbol.iterator]();
    let strutXStep_k;
    while (!(strutXStep_k = strutXIter_k.next()).done) {
      const strutX_k = strutXStep_k.value;
      const strutZList_k = [];
      strutZList_k.push(-1, 1);
      const strutZIter_k = strutZList_k[Symbol.iterator]();
      let strutZStep_k;
      while (!(strutZStep_k = strutZIter_k.next()).done) {
        const strutZ_k = strutZStep_k.value;
        const strut_k = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), paleMat_k);
        strut_k.position.set(0.7 * strutX_k, 1.1, 0.5 * strutZ_k);
        postGrp_k.add(strut_k);
      }
    }
    const deckMeshK = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), paleMat_k);
    deckMeshK.position.y = 2.25;
    postGrp_k.add(deckMeshK);
    const screen_k = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.1), paleMat_k);
    screen_k.position.set(0, 2.85, -0.6);
    postGrp_k.add(screen_k);
    const capMeshK = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.5), scarletMat_k);
    capMeshK.position.y = 3.5;
    postGrp_k.add(capMeshK);
    const slope_k = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.6), paleMat_k);
    slope_k.position.set(0, 1.1, -1.7);
    slope_k.rotation.x = 0.72;
    postGrp_k.add(slope_k);
    scene_k.add(postGrp_k);
    G_k.addCollider(postX_k, 598, 1, 0.8, 3.5);
  }
};

function densityPtHit(G_k, px_k, pz_k, pad_k) {
  return G_k.colliders.some(
    (c_k) =>
      c_k.hw + pad_k > Math.abs(px_k - c_k.x) &&
      c_k.hd + pad_k > Math.abs(pz_k - c_k.z),
  );
}
function densityFtHit(G_k, px_k, pz_k, halfW_k, halfD_k, pad_k) {
  return G_k.colliders.some(
    (c_k) =>
      c_k.hw + halfW_k + pad_k > Math.abs(px_k - c_k.x) &&
      c_k.hd + halfD_k + pad_k > Math.abs(pz_k - c_k.z),
  );
}
function castShadowApply(root_k) {
  root_k.traverse((node_k) => {
    node_k.isMesh ? node_k.castShadow = true : null;
  });
  return root_k;
}

const boulevardFrontageBuild = (G_k, scene_k) => {
  const tally_k = {};
  tally_k.south = 0; tally_k.north = 0;
  const signChoices_k = [];
  signChoices_k.push(['HOTEL CORAL', '#ffb35c'], ['SUSHI-GO', '#7dffb0']);
  signChoices_k.push(['ARCADE', '#ff7ab0'], ['CLUB NEON', '#e879ff']);
  signChoices_k.push(['RAMEN', '#ff5c39'], ['PAWN', '#ffe14d']);
  const sideA_k = {};
  sideA_k.key = 'north'; sideA_k.faceDir = 1; sideA_k.facadeZ = 470;
  const sideB_k = {};
  sideB_k.key = 'south'; sideB_k.faceDir = -1; sideB_k.facadeZ = 518;
  const sideList_k = [];
  sideList_k.push(sideA_k, sideB_k);
  const sideIter_k = sideList_k[Symbol.iterator]();
  let sideStep_k;
  while (!(sideStep_k = sideIter_k.next()).done) {
    const side_k = sideStep_k.value;
    let prevTone_k = null;
    let prevPrevTone_k = null;
    let walkX_k = -560;
    for (; 640 > walkX_k;) {
      let lotW_k = rr(18, 30);
      640 < walkX_k + lotW_k ? lotW_k = 640 - walkX_k : null;
      if (10 > lotW_k) break;
      let lotD_k;
      lotD_k = rr(12, 18);
      let lotH_k;
      lotH_k = rr(10, 26);
      let midX_k;
      midX_k = walkX_k + lotW_k / 2;
      let midZ_k;
      midZ_k = side_k.facadeZ - side_k.faceDir * (lotD_k / 2);
      let roadHit_k;
      roadHit_k = G_k.roadX.find(
        (road_k) => road_k + 14 > midX_k - lotW_k / 2 && midX_k + lotW_k / 2 > road_k - 14,
      );
      if (undefined !== roadHit_k) {
        walkX_k = 14 + roadHit_k + rr(0.5, 2);
        continue;
      }
      if (densityFtHit(G_k, midX_k, midZ_k, lotW_k / 2, lotD_k / 2, 2)) {
        walkX_k += lotW_k + rr(1.5, 5);
        continue;
      }
      let wallTone_k = pick(VICE.coralPastels);
      prevTone_k === wallTone_k
        ? wallTone_k = VICE.coralPastels[(1 + VICE.coralPastels.indexOf(wallTone_k)) % VICE.coralPastels.length]
        : null;
      prevPrevTone_k === wallTone_k
        ? wallTone_k = VICE.coralPastels[(1 + VICE.coralPastels.indexOf(wallTone_k)) % VICE.coralPastels.length]
        : null;
      prevPrevTone_k = prevTone_k;
      prevTone_k = wallTone_k;
      let wallTex_k;
      wallTex_k = buildingTextureBuild(wallTone_k, rr(0.25, 0.42));
      wallTex_k.wrapS = THREE.RepeatWrapping; wallTex_k.wrapT = THREE.RepeatWrapping;
      const wallMatOpts_k = {};
      wallMatOpts_k.roughness = 0.9; wallMatOpts_k.emissiveMap = wallTex_k;
      wallMatOpts_k.emissive = 0xffc873; wallMatOpts_k.map = wallTex_k;
      wallMatOpts_k.emissiveIntensity = 0;
      const wallMat_k = new THREE.MeshStandardMaterial(wallMatOpts_k);
      wallMat_k.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
      !G_k.buildingMats ? G_k.buildingMats = [] : null;
      G_k.buildingMats.push(wallMat_k);
      let groundY_k;
      groundY_k = groundH(midX_k, midZ_k);
      const block_k = new THREE.Mesh(new THREE.BoxGeometry(lotW_k, lotH_k, lotD_k), wallMat_k);
      block_k.position.set(midX_k, groundY_k + lotH_k / 2, midZ_k);
      block_k.castShadow = true;
      block_k.receiveShadow = true;
      scene_k.add(block_k);
      const capH_k = rr(1.6, 3);
      const cap_k = new THREE.Mesh(new THREE.BoxGeometry(0.62 * lotW_k, capH_k, 0.62 * lotD_k), wallMat_k);
      cap_k.position.set(midX_k, groundY_k + (lotH_k + capH_k / 2), midZ_k);
      cap_k.castShadow = true;
      scene_k.add(cap_k);
      let trimTone_k;
      trimTone_k = pick(VICE.neonTrim);
      const trimMatOpts_k = {};
      trimMatOpts_k.roughness = 0.6; trimMatOpts_k.emissive = trimTone_k;
      trimMatOpts_k.color = trimTone_k; trimMatOpts_k.emissiveIntensity = 0;
      const trimMat_k = new THREE.MeshStandardMaterial(trimMatOpts_k);
      const trim_k = new THREE.Mesh(new THREE.BoxGeometry(0.35 + lotW_k, 0.3, 0.35 + lotD_k), trimMat_k);
      trim_k.position.set(midX_k, groundY_k + 0.84 * lotH_k, midZ_k);
      trim_k.castShadow = true;
      scene_k.add(trim_k);
      !G_k.neonTrimMats ? G_k.neonTrimMats = [] : null;
      G_k.neonTrimMats.push(trimMat_k);
      const trimGlow_k = glowSprite(new THREE.Color(trimTone_k), 12);
      trimGlow_k.position.set(midX_k, groundY_k + 0.84 * lotH_k, midZ_k);
      trimGlow_k.material.opacity = 0;
      scene_k.add(trimGlow_k);
      glowSpritesList.push(trimGlow_k);
      let frontZ_k;
      frontZ_k = side_k.facadeZ;
      if (0.6 > rnd()) {
        const [signText_k, signTint_k] = pick(signChoices_k);
        const signMatOpts_k = {};
        signMatOpts_k.map = signTextureBuild(signText_k, '#101018', signTint_k);
        const sign_k = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(14, 0.7 * lotW_k), 3.4),
          new THREE.MeshBasicMaterial(signMatOpts_k),
        );
        sign_k.position.set(midX_k, groundY_k + 4.6, 0.12 * side_k.faceDir + frontZ_k);
        0 > side_k.faceDir ? sign_k.rotation.y = Math.PI : null;
        scene_k.add(sign_k);
        const signGlow_k = glowSprite(new THREE.Color(signTint_k), 13);
        signGlow_k.position.set(midX_k, groundY_k + 4.6, 0.05 * side_k.faceDir + frontZ_k);
        signGlow_k.material.opacity = 0;
        scene_k.add(signGlow_k);
        glowSpritesList.push(signGlow_k);
      }
      let canopyTone_k;
      if (0 === tally_k[side_k.key] % 2) {
        const toneListA_k = [];
        toneListA_k.push('#ff5da2', '#ffb35c');
        canopyTone_k = pick(toneListA_k);
      } else {
        const toneListB_k = [];
        toneListB_k.push('#39d5ff', '#7dffb0');
        canopyTone_k = pick(toneListB_k);
      }
      const canopyMatOpts_k = {};
      canopyMatOpts_k.color = new THREE.Color(canopyTone_k); canopyMatOpts_k.roughness = 0.85;
      const canopyMat_k = new THREE.MeshStandardMaterial(canopyMatOpts_k);
      const canopy_k = new THREE.Mesh(
        new THREE.BoxGeometry(Math.min(15, 0.72 * lotW_k), 0.15, 2.2), canopyMat_k,
      );
      canopy_k.position.set(midX_k, groundY_k + 3.6, 1.05 * side_k.faceDir + frontZ_k);
      canopy_k.rotation.x = 0.3 * side_k.faceDir;
      canopy_k.castShadow = true;
      scene_k.add(canopy_k);
      G_k.addCollider(midX_k, midZ_k, lotW_k / 2, lotD_k / 2, lotH_k);
      ++tally_k[side_k.key];
      walkX_k += lotW_k + rr(1.5, 5);
    }
  }
  G_k.frontageCounts = tally_k;
  return tally_k;
};

const boulevardPalmsBuild = (G_k, scene_k) => {
  let added_k = 0;
  let rowX_k = -560;
  for (; 640 >= rowX_k;) {
    if (!G_k.roadX.some((road_k) => 16 > Math.abs(rowX_k - road_k))) {
      const walkList_k = [];
      walkList_k.push(481, 509);
      const walkIter_k = walkList_k[Symbol.iterator]();
      let walkStep_k;
      while (!(walkStep_k = walkIter_k.next()).done) {
        const walkZ_k = walkStep_k.value;
        if (densityPtHit(G_k, rowX_k, walkZ_k, 1.5)) continue;
        const palm_k = makePalm(rr(4.5, 6.5));
        palm_k.position.set(rowX_k, groundH(rowX_k, walkZ_k), walkZ_k);
        palm_k.rotation.y = rr(0, 6.28);
        scene_k.add(palm_k);
        ++added_k;
      }
    }
    rowX_k += 20;
  }
  G_k.boulevardPalmsAdded = added_k;
  return added_k;
};

const planterPalmUnitMake = () => {
  const grp_k = new THREE.Group();
  const tub_k = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.6), stdMatShared(0xd8d2c4, 1));
  tub_k.position.y = 0.275;
  grp_k.add(tub_k);
  const earth_k = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), stdMatShared(0x4a3826, 1));
  earth_k.position.y = 0.56;
  grp_k.add(earth_k);
  const shrubMatOpts_k = {};
  shrubMatOpts_k.roughness = 1; shrubMatOpts_k.color = 0x3d8b4f; shrubMatOpts_k.flatShading = true;
  const shrubMat_k = new THREE.MeshStandardMaterial(shrubMatOpts_k);
  const shrubList_k = [];
  shrubList_k.push([-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]);
  const shrubIter_k = shrubList_k[Symbol.iterator]();
  let shrubStep_k;
  while (!(shrubStep_k = shrubIter_k.next()).done) {
    const [shrubPx_k, shrubPz_k] = shrubStep_k.value;
    const shrub_k = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.22, 0.3), 1), shrubMat_k);
    shrub_k.position.set(shrubPx_k, 0.68, shrubPz_k);
    grp_k.add(shrub_k);
  }
  const palm_k = makePalm(rr(4.5, 6));
  palm_k.position.y = 0.55;
  palm_k.rotation.y = rr(0, 6.28);
  grp_k.add(palm_k);
  return castShadowApply(grp_k);
};
const boulevardPlantersBuild = (G_k, scene_k) => {
  let added_k = 0;
  let tubX_k = -320;
  for (; 520 >= tubX_k;) {
    const skip_k =
      G_k.roadX.some((road_k) => 13 > Math.abs(tubX_k - road_k)) ||
      10 > Math.abs(tubX_k - 100) ||
      densityPtHit(G_k, tubX_k, 513, 2);
    !skip_k ? (() => {
      const unit_k = planterPalmUnitMake();
      unit_k.position.set(tubX_k, groundH(tubX_k, 513), 513);
      scene_k.add(unit_k);
      ++added_k;
    })() : null;
    tubX_k += 40;
  }
  G_k.boulevardPlantersAdded = added_k;
  return added_k;
};

const benchUnitMake = () => {
  const grp_k = new THREE.Group();
  let ironMat_k;
  ironMat_k = stdMatShared(0x3a3f45, 0.6, 0.5);
  let timberMat_k;
  timberMat_k = stdMatShared(0x8a6844, 0.95);
  const endList_k = [];
  endList_k.push(-1, 1);
  const endIter_k = endList_k[Symbol.iterator]();
  let endStep_k;
  while (!(endStep_k = endIter_k.next()).done) {
    const end_k = endStep_k.value;
    const legFront_k = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), ironMat_k);
    legFront_k.position.set(0.95 * end_k, 0.22, 0.28);
    grp_k.add(legFront_k);
    const legBack_k = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), ironMat_k);
    legBack_k.position.set(0.95 * end_k, 0.42, -0.28);
    grp_k.add(legBack_k);
  }
  let seat_k = 0;
  for (; 3 > seat_k;) {
    const seatMesh_k = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.16), timberMat_k);
    seatMesh_k.position.set(0, 0.45, 0.22 * seat_k - 0.2);
    grp_k.add(seatMesh_k);
    ++seat_k;
  }
  let back_k = 0;
  for (; 2 > back_k;) {
    const backMeshK = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.05), timberMat_k);
    backMeshK.position.set(0, 0.68 + 0.24 * back_k, -0.32);
    backMeshK.rotation.x = -0.18;
    grp_k.add(backMeshK);
    ++back_k;
  }
  return castShadowApply(grp_k);
};
const planterUnitMake = () => {
  let grp_k;
  grp_k = new THREE.Group();
  const tub_k = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), stdMatShared(0x9a8a72, 1));
  tub_k.position.y = 0.28;
  grp_k.add(tub_k);
  const shrubMatOpts_k = {};
  shrubMatOpts_k.roughness = 1; shrubMatOpts_k.color = 0x3d8b4f; shrubMatOpts_k.flatShading = true;
  const shrub_k = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    new THREE.MeshStandardMaterial(shrubMatOpts_k),
  );
  shrub_k.position.y = 0.85;
  grp_k.add(shrub_k);
  return castShadowApply(grp_k);
};
const stallUnitMake = () => {
  let grp_k;
  grp_k = new THREE.Group();
  let timberMatK;
  timberMatK = stdMatShared(0x6b4a2f, 0.9);
  const postXList_k = [];
  postXList_k.push(-1, 1);
  const postXIter_k = postXList_k[Symbol.iterator]();
  let postXStep_k;
  while (!(postXStep_k = postXIter_k.next()).done) {
    const postX_k = postXStep_k.value;
    const postZList_k = [];
    postZList_k.push(-1, 1);
    const postZIter_k = postZList_k[Symbol.iterator]();
    let postZStep_k;
    while (!(postZStep_k = postZIter_k.next()).done) {
      const postZ_k = postZStep_k.value;
      const post_k = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), timberMatK);
      post_k.position.set(1.5 * postX_k, 1.25, 0.9 * postZ_k);
      grp_k.add(post_k);
    }
  }
  let stripeTex_k;
  stripeTex_k = textureFromCanvas(128, 128, (ctx_k, w_k, h_k) => {
    let band_k = 0;
    for (; 8 > band_k;) {
      if (band_k % 2) ctx_k.fillStyle = '#f7f2e6';
      else ctx_k.fillStyle = '#ff7a6b';
      ctx_k.fillRect(band_k * (w_k / 8), 0, w_k / 8, h_k);
      ++band_k;
    }
  });
  stripeTex_k.wrapT = THREE.RepeatWrapping;
  stripeTex_k.wrapS = THREE.RepeatWrapping;
  const roofMatOpts_k = {};
  roofMatOpts_k.map = stripeTex_k; roofMatOpts_k.roughness = 0.9;
  const roof_k = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.12, 2.4), new THREE.MeshStandardMaterial(roofMatOpts_k),
  );
  roof_k.position.y = 2.55;
  roof_k.rotation.z = 0.06;
  grp_k.add(roof_k);
  const counterK = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.1), stdMatShared(0xa97e56, 0.95));
  counterK.position.set(0, 0.45, 0.35);
  grp_k.add(counterK);
  const crateTonesK = [];
  crateTonesK.push(0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b);
  let crate_k = 0;
  for (; 4 > crate_k;) {
    const crateMesh_k = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.4, 0.55), stdMatShared(crateTonesK[crate_k % 4], 0.9),
    );
    crateMesh_k.position.set(0.72 * crate_k - 1.1, 1.1, 0.35);
    grp_k.add(crateMesh_k);
    ++crate_k;
  }
  return castShadowApply(grp_k);
};
const gatherSpotsBuild = (G_k, scene_k) => {
  const specA_k = {};
  specA_k.ry = Math.PI; specA_k.z = 511; specA_k.x = 100; specA_k.stall = true;
  const specB_k = {};
  specB_k.ry = 0; specB_k.z = 552; specB_k.x = 300; specB_k.stall = true;
  const specC_k = {};
  specC_k.ry = Math.PI; specC_k.z = -238; specC_k.x = -60; specC_k.stall = false;
  const specD_k = {};
  specD_k.ry = 0; specD_k.z = 481; specD_k.x = -210; specD_k.stall = false;
  const specs_k = [];
  specs_k.push(specA_k, specB_k, specC_k, specD_k);
  G_k.gatherSpots = [];
  const specIter_k = specs_k[Symbol.iterator]();
  let specStep_k;
  while (!(specStep_k = specIter_k.next()).done) {
    const spec_k = specStep_k.value;
    let settledX_k = null;
    let step_k = 0;
    for (; 10 >= step_k && null === settledX_k;) {
      let offsets_k;
      if (0 === step_k) offsets_k = [0];
      else {
        offsets_k = [];
        offsets_k.push(4 * step_k, -4 * step_k);
      }
      const offIter_k = offsets_k[Symbol.iterator]();
      let offStep_k;
      while (!(offStep_k = offIter_k.next()).done) {
        const off_k = offStep_k.value;
        if (!densityPtHit(G_k, spec_k.x + off_k, spec_k.z, 2.5)) {
          settledX_k = spec_k.x + off_k;
          break;
        }
      }
      ++step_k;
    }
    if (null === settledX_k) continue;
    const grp_k = new THREE.Group();
    grp_k.position.set(settledX_k, groundH(settledX_k, spec_k.z), spec_k.z);
    grp_k.rotation.y = spec_k.ry;
    const seatList_k = [];
    seatList_k.push(-1.9, 1.9);
    const seatIter_k = seatList_k[Symbol.iterator]();
    let seatStep_k;
    while (!(seatStep_k = seatIter_k.next()).done) {
      const seatX_k = seatStep_k.value;
      const seat_k = benchUnitMake();
      seat_k.position.set(seatX_k, 0, 0);
      grp_k.add(seat_k);
    }
    const tubList_k = [];
    tubList_k.push(-3.6, 3.6);
    const tubIter_k = tubList_k[Symbol.iterator]();
    let tubStep_k;
    while (!(tubStep_k = tubIter_k.next()).done) {
      const tubX_k = tubStep_k.value;
      const tub_k = planterUnitMake();
      tub_k.position.set(tubX_k, 0, 0.25);
      grp_k.add(tub_k);
    }
    if (spec_k.stall) {
      const kiosk_k = stallUnitMake();
      kiosk_k.position.set(0, 0, -2.4);
      grp_k.add(kiosk_k);
      let cos_k;
      cos_k = Math.cos(spec_k.ry);
      let sin_k;
      sin_k = Math.sin(spec_k.ry);
      G_k.addCollider(
        settledX_k + (0 * cos_k - 2.4 * sin_k),
        spec_k.z + (-0 * sin_k - 2.4 * cos_k),
        1.8, 1.2, 2.6,
      );
    }
    scene_k.add(grp_k);
    const spotRec_k = {};
    spotRec_k.z = spec_k.z; spotRec_k.x = settledX_k; spotRec_k.stall = spec_k.stall; spotRec_k.ry = spec_k.ry;
    G_k.gatherSpots.push(spotRec_k);
  }
  return G_k.gatherSpots;
};

const hoshinoRowsBuild = (G_k, scene_k) => {
  let added_k = 0;
  const rowA_k = {};
  rowA_k.z = -378; rowA_k.face = 1;
  const rowB_k = {};
  rowB_k.z = -284; rowB_k.face = -1;
  const rowList_k = [];
  rowList_k.push(rowA_k, rowB_k);
  const rowIter_k = rowList_k[Symbol.iterator]();
  let rowStep_k;
  while (!(rowStep_k = rowIter_k.next()).done) {
    const row_k = rowStep_k.value;
    let plotX_k = -520;
    for (; -180 >= plotX_k;) {
      const gap_k = 15 > Math.abs(plotX_k + 495) || 15 > Math.abs(plotX_k + 330);
      if (!gap_k && !densityFtHit(G_k, plotX_k, row_k.z, 6, 5, 2)) {
        houseBuild(G_k, scene_k, plotX_k, row_k.z, row_k.face);
        ++added_k;
      }
      plotX_k += 24;
    }
  }
  G_k.hoshinoHousesAdded = added_k;
  return added_k;
};

const PARK_HUB_TRIES = [];
PARK_HUB_TRIES.push([82, 415], [-82, 415], [82, 82], [-82, 82], [247, 82]);
const roundTreeMake = (height_k, tone_k) => {
  let grp_k;
  grp_k = new THREE.Group();
  const trunk_k = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.26, 0.45 * height_k, 7), stdMatShared(0x6b4a2f, 1),
  );
  trunk_k.position.y = 0.225 * height_k;
  grp_k.add(trunk_k);
  const crownMatOpts_k = {};
  crownMatOpts_k.roughness = 1; crownMatOpts_k.color = tone_k; crownMatOpts_k.flatShading = true;
  const crownMat_k = new THREE.MeshStandardMaterial(crownMatOpts_k);
  const puffList_k = [];
  puffList_k.push([0, 1, 0, 1.6], [0.95, 1.22, 0.3, 1.2]);
  puffList_k.push([-0.9, 1.18, -0.4, 1.05]);
  const puffIter_k = puffList_k[Symbol.iterator]();
  let puffStep_k;
  while (!(puffStep_k = puffIter_k.next()).done) {
    const [puffPx_k, puffPy_k, puffPz_k, puffRad_k] = puffStep_k.value;
    const puff_k = new THREE.Mesh(new THREE.SphereGeometry(puffRad_k, 10, 8), crownMat_k);
    puff_k.scale.y = 0.75;
    puff_k.position.set(puffPx_k, 0.45 * height_k + puffPy_k * (0.28 * height_k), puffPz_k);
    grp_k.add(puff_k);
  }
  return castShadowApply(grp_k);
};
const parkBuild = (G_k, scene_k) => {
  let hubX_k = PARK_HUB_TRIES[0][0];
  let hubZ_k = PARK_HUB_TRIES[0][1];
  let hubFound_k = false;
  const rejected_k = [];
  const tryIter_k = PARK_HUB_TRIES[Symbol.iterator]();
  let tryStep_k;
  while (!(tryStep_k = tryIter_k.next()).done) {
    const [tryX, tryZ] = tryStep_k.value;
    if (!densityFtHit(G_k, tryX, tryZ, 38, 38, 2)) {
      hubX_k = tryX;
      hubZ_k = tryZ;
      hubFound_k = true;
      break;
    }
    rejected_k.push([tryX, tryZ]);
  }
  G_k.parkScanSkipped = rejected_k;
  G_k.parkFallbackUsed = !hubFound_k;
  const grp_k = new THREE.Group();
  grp_k.position.set(hubX_k, groundH(hubX_k, hubZ_k), hubZ_k);
  scene_k.add(grp_k);
  const plaza_k = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), pavingMatMake(19, 19, 0xd8d2c2));
  plaza_k.rotation.x = -Math.PI / 2;
  plaza_k.position.y = 0.04;
  plaza_k.receiveShadow = true;
  grp_k.add(plaza_k);
  const walkNS_k = new THREE.Mesh(new THREE.PlaneGeometry(6, 76), pavingMatMake(2, 19, 0xffffff));
  walkNS_k.rotation.x = -Math.PI / 2;
  walkNS_k.position.y = 0.07;
  walkNS_k.receiveShadow = true;
  grp_k.add(walkNS_k);
  const walkEW_k = new THREE.Mesh(new THREE.PlaneGeometry(76, 6), pavingMatMake(19, 2, 0xffffff));
  walkEW_k.rotation.x = -Math.PI / 2;
  walkEW_k.position.y = 0.07;
  walkEW_k.receiveShadow = true;
  grp_k.add(walkEW_k);
  const quadAList_k = [];
  quadAList_k.push(-1, 1);
  const quadAIter_k = quadAList_k[Symbol.iterator]();
  let quadAStep_k;
  while (!(quadAStep_k = quadAIter_k.next()).done) {
    const quadA_k = quadAStep_k.value;
    const quadBList_k = [];
    quadBList_k.push(-1, 1);
    const quadBIter_k = quadBList_k[Symbol.iterator]();
    let quadBStep_k;
    while (!(quadBStep_k = quadBIter_k.next()).done) {
      const quadB_k = quadBStep_k.value;
      const lawn_k = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), grassMatMake(8, 8));
      lawn_k.rotation.x = -Math.PI / 2;
      lawn_k.position.set(19.5 * quadA_k, 0.055, 19.5 * quadB_k);
      lawn_k.receiveShadow = true;
      grp_k.add(lawn_k);
    }
  }

  let grpFountain_k;
  grpFountain_k = new THREE.Group();
  grp_k.add(grpFountain_k);
  let stoneMat_k;
  stoneMat_k = stdMatShared(0xe6e0d0, 0.9);
  const basin_k = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 24), stoneMat_k);
  basin_k.position.y = 0.4;
  grpFountain_k.add(basin_k);
  const lip_k = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 8, 24), stoneMat_k);
  lip_k.rotation.x = Math.PI / 2;
  lip_k.position.y = 0.82;
  grpFountain_k.add(lip_k);
  const poolMatOpts_k = {};
  poolMatOpts_k.roughness = 0.15; poolMatOpts_k.transparent = true;
  poolMatOpts_k.color = 0x3fa7d6; poolMatOpts_k.opacity = 0.9;
  const poolMat_k = new THREE.MeshStandardMaterial(poolMatOpts_k);
  const pool_k = new THREE.Mesh(new THREE.CircleGeometry(3.7, 24), poolMat_k);
  pool_k.rotation.x = -Math.PI / 2;
  pool_k.position.y = 0.72;
  grpFountain_k.add(pool_k);
  const column_k = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.5, 12), stoneMat_k);
  column_k.position.y = 1.4;
  grpFountain_k.add(column_k);
  const cup_k = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.9, 0.35, 16), stoneMat_k);
  cup_k.position.y = 2.25;
  grpFountain_k.add(cup_k);
  const cupPool_k = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), poolMat_k);
  cupPool_k.rotation.x = -Math.PI / 2;
  cupPool_k.position.y = 2.44;
  grpFountain_k.add(cupPool_k);
  castShadowApply(grpFountain_k);
  G_k.addCollider(hubX_k, hubZ_k, 4.4, 4.4, 2.4);
  const treeSpots_k = [];
  const spotQuadAList_k = [];
  spotQuadAList_k.push(-1, 1);
  const spotQuadAIter_k = spotQuadAList_k[Symbol.iterator]();
  let spotQuadAStep_k;
  while (!(spotQuadAStep_k = spotQuadAIter_k.next()).done) {
    const quadA_k = spotQuadAStep_k.value;
    const spotQuadBList_k = [];
    spotQuadBList_k.push(-1, 1);
    const spotQuadBIter_k = spotQuadBList_k[Symbol.iterator]();
    let spotQuadBStep_k;
    while (!(spotQuadBStep_k = spotQuadBIter_k.next()).done) {
      const quadB_k = spotQuadBStep_k.value;
      treeSpots_k.push([12 * quadA_k, 12 * quadB_k], [27 * quadA_k, 10 * quadB_k], [10 * quadA_k, 27 * quadB_k]);
    }
  }
  treeSpots_k.push([-34, -34], [34, 34]);
  const crownTones_k = [];
  crownTones_k.push(0x3f9e4d, 0x359146, 0x4caf50);
  treeSpots_k.forEach(([treeX, treeZ], spot_k) => {
    let tree_k;
    if (2 === spot_k % 3) tree_k = makePalm((spot_k % 2) + 5);
    else tree_k = roundTreeMake((spot_k % 3) * 0.5 + 4.6, crownTones_k[spot_k % 3]);
    tree_k.position.set(treeX, 0, treeZ);
    tree_k.rotation.y = (1.7 * spot_k) % 6.28;
    grp_k.add(tree_k);
  });
  const benchList_k = [];
  benchList_k.push([10, 5.5], [-10, 5.5], [10, -5.5]);
  benchList_k.push([-10, -5.5], [5.5, 10], [-5.5, -10]);
  const benchIter_k = benchList_k[Symbol.iterator]();
  let benchStep_k;
  while (!(benchStep_k = benchIter_k.next()).done) {
    const [benchX_k, benchZ_k] = benchStep_k.value;
    const seat_k = benchUnitMake();
    seat_k.position.set(benchX_k, 0, benchZ_k);
    seat_k.rotation.y = Math.atan2(-benchX_k, -benchZ_k);
    grp_k.add(seat_k);
  }
  let kioskWorldX_k;
  kioskWorldX_k = 32 + hubX_k;
  let kioskWorldZ_k;
  kioskWorldZ_k = 8 + hubZ_k;
  let kiosk_k;
  kiosk_k = stallUnitMake();
  kiosk_k.position.set(32, 0, 8);
  kiosk_k.rotation.y = Math.PI / 2;
  grp_k.add(kiosk_k);
  G_k.addCollider(kioskWorldX_k, kioskWorldZ_k, 1.8, 1.8, 2.6);

  const lampList_k = [];
  lampList_k.push([-35, -35], [35, -35], [-35, 35], [35, 35]);
  const lampIter_k = lampList_k[Symbol.iterator]();
  let lampStep_k;
  while (!(lampStep_k = lampIter_k.next()).done) {
    const [lampPx_k, lampPz_k] = lampStep_k.value;
    const grpLamp_k = new THREE.Group();
    const mast_k = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 5, 6), stdMatShared(0x3a3f45, 0.8, 0.5),
    );
    mast_k.position.y = 2.5;
    grpLamp_k.add(mast_k);
    const globeMatOpts_k = {};
    globeMatOpts_k.roughness = 0.5; globeMatOpts_k.emissive = 0xffc98a;
    globeMatOpts_k.color = 0xffd9a0; globeMatOpts_k.emissiveIntensity = 0.4;
    const globe_k = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshStandardMaterial(globeMatOpts_k),
    );
    globe_k.position.y = 5.05;
    grpLamp_k.add(globe_k);
    grpLamp_k.position.set(lampPx_k, 0, lampPz_k);
    castShadowApply(grpLamp_k);
    grp_k.add(grpLamp_k);
  }
  const bloomTones_k = [];
  bloomTones_k.push(0xff5da2, 0xffb35c, 0xffe14d, 0xff5da2);
  const bedList_k = [];
  bedList_k.push([20, 4.4, 0], [-20, 4.4, 0], [20, -4.4, 0], [-4.4, -20, Math.PI / 2]);
  bedList_k.forEach(([bedPx, bedPz, bedYaw], bed_k) => {
    const grpBed_k = new THREE.Group();
    const bedBase_k = new THREE.Mesh(new THREE.BoxGeometry(4, 0.35, 1.2), stdMatShared(0x9a8a72, 1));
    bedBase_k.position.y = 0.18;
    grpBed_k.add(bedBase_k);
    const bedCapMatOpts_k = {};
    bedCapMatOpts_k.roughness = 0.9; bedCapMatOpts_k.color = bloomTones_k[bed_k]; bedCapMatOpts_k.flatShading = true;
    const bedCap_k = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.14, 1.0),
      new THREE.MeshStandardMaterial(bedCapMatOpts_k),
    );
    bedCap_k.position.y = 0.42;
    grpBed_k.add(bedCap_k);
    grpBed_k.position.set(bedPx, 0, bedPz);
    grpBed_k.rotation.y = bedYaw;
    castShadowApply(grpBed_k);
    grp_k.add(grpBed_k);
  });
  G_k.parkSpot = {};
  G_k.parkSpot.z = hubZ_k; G_k.parkSpot.x = hubX_k;
  G_k.parkSpot.stallZ = kioskWorldZ_k; G_k.parkSpot.stallX = kioskWorldX_k;
  G_k.parkCounts = {};
  G_k.parkCounts.fountains = 1; G_k.parkCounts.flowerBeds = 4; G_k.parkCounts.lamps = 4;
  G_k.parkCounts.benches = 6; G_k.parkCounts.trees = treeSpots_k.length; G_k.parkCounts.stalls = 1;
  return G_k.parkSpot;
};

let streetGlowList = [];

export const buildWorld = (G_k) => {
  let scene_k;
  scene_k = G_k.scene;
  G_k.roadX = [];
  G_k.roadX.push(-660, -495, -330, -165, 0, 165, 330, 495, 660);
  G_k.roadZ = [];
  G_k.roadZ.push(-660, -495, -330, -165, 0, 165, 330, 495, 660);
  G_k.touge = TOUGE_POINTS.map((pt_k) => {
    const ptRec_k = {};
    ptRec_k.x = pt_k[0]; ptRec_k.z = pt_k[1];
    return ptRec_k;
  });
  glowSpritesList = [];
  streetGlowList = [];
  skyHourPrev = -10;
  skyCnv = document.createElement('canvas');
  skyCnv.height = 512;
  skyCnv.width = 16;
  skyCtx = skyCnv.getContext('2d');
  skyTex = new THREE.CanvasTexture(skyCnv);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  if (G_k.timeOfDay) skyColorsCompute(G_k.timeOfDay);
  else skyColorsCompute(10.5);
  skyDomePaint();
  const skyDomeMatOpts_k = {};
  skyDomeMatOpts_k.fog = false; skyDomeMatOpts_k.side = THREE.BackSide;
  skyDomeMatOpts_k.map = skyTex; skyDomeMatOpts_k.depthWrite = false;
  skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 12),
    new THREE.MeshBasicMaterial(skyDomeMatOpts_k),
  );
  skyDome.renderOrder = -1;
  scene_k.add(skyDome);
  scene_k.fog = new THREE.Fog(0xcfe4ec, 220, 1500);
  let groundTex_k;
  groundTex_k = groundTextureBuild();
  groundTex_k.wrapS = THREE.RepeatWrapping; groundTex_k.wrapT = THREE.RepeatWrapping;
  groundTex_k.repeat.set(40, 40);
  G_k.maxAniso ? groundTex_k.anisotropy = G_k.maxAniso : null;
  const groundMatOpts_k = {};
  groundMatOpts_k.map = groundTex_k; groundMatOpts_k.roughness = 1;
  const ground_k = new THREE.Mesh(
    new THREE.PlaneGeometry(1320, 1320), new THREE.MeshStandardMaterial(groundMatOpts_k),
  );
  ground_k.rotation.x = -Math.PI / 2;
  ground_k.receiveShadow = true;
  scene_k.add(ground_k);

  let hillGeo_k;
  hillGeo_k = new THREE.PlaneGeometry(700, 700, 24, 24);
  {
    let pos_k;
    pos_k = hillGeo_k.attributes.position;
    let vert_k = 0;
    for (; pos_k.count > vert_k;) {
      let vx_k;
      vx_k = pos_k.getX(vert_k) - 330;
      let vz_k;
      vz_k = -pos_k.getY(vert_k) - 330;
      pos_k.setZ(vert_k, groundH(vx_k, vz_k));
      ++vert_k;
    }
    hillGeo_k.computeVertexNormals();
  }
  const hill_k = new THREE.Mesh(hillGeo_k, grassMatMake(28, 28));
  hill_k.rotation.x = -Math.PI / 2;
  hill_k.position.set(-330, 0.02, -330);
  hill_k.receiveShadow = true;
  scene_k.add(hill_k);
  const seaMatOpts_k = {};
  seaMatOpts_k.metalness = 0.2; seaMatOpts_k.roughness = 0.3; seaMatOpts_k.transparent = true;
  seaMatOpts_k.color = 0x1d6fb8; seaMatOpts_k.opacity = 0.95;
  const sea_k = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial(seaMatOpts_k),
  );
  sea_k.rotation.x = -Math.PI / 2;
  sea_k.position.y = -0.4;
  scene_k.add(sea_k);
  G_k.water = sea_k;
  let sandTex_k;
  sandTex_k = sandTextureBuild();
  sandTex_k.repeat.set(66, 5);
  G_k.maxAniso ? sandTex_k.anisotropy = G_k.maxAniso : null;
  const beachMatOpts_k = {};
  beachMatOpts_k.map = sandTex_k; beachMatOpts_k.roughness = 1;
  const beach_k = new THREE.Mesh(
    new THREE.PlaneGeometry(1320, 100), new THREE.MeshStandardMaterial(beachMatOpts_k),
  );
  beach_k.rotation.x = -Math.PI / 2;
  beach_k.position.set(0, 0.03, 610);
  beach_k.receiveShadow = true;
  scene_k.add(beach_k);

  {
    function layPaving_k(zoneX_k, zoneZ_k, zoneMat_k) {
      const flat_k = new THREE.Mesh(new THREE.PlaneGeometry(660, 660), zoneMat_k);
      flat_k.rotation.x = -Math.PI / 2;
      flat_k.position.set(zoneX_k, 0.018, zoneZ_k);
      flat_k.receiveShadow = true;
      scene_k.add(flat_k);
    }
    let paveTexA_k;
    paveTexA_k = pavingTextureBuild();
    paveTexA_k.repeat.set(66, 66);
    G_k.maxAniso ? paveTexA_k.anisotropy = G_k.maxAniso : null;
    const paveMatOptsA_k = {};
    paveMatOptsA_k.map = paveTexA_k; paveMatOptsA_k.roughness = 1;
    layPaving_k(330, 330, new THREE.MeshStandardMaterial(paveMatOptsA_k));
    let paveTexB_k;
    paveTexB_k = pavingTextureBuild();
    paveTexB_k.repeat.set(66, 66);
    G_k.maxAniso ? paveTexB_k.anisotropy = G_k.maxAniso : null;
    const paveMatOptsB_k = {};
    paveMatOptsB_k.map = paveTexB_k; paveMatOptsB_k.roughness = 1;
    layPaving_k(330, -330, new THREE.MeshStandardMaterial(paveMatOptsB_k));
    let paveTexC_k;
    paveTexC_k = pavingTextureBuild();
    paveTexC_k.repeat.set(66, 66);
    G_k.maxAniso ? paveTexC_k.anisotropy = G_k.maxAniso : null;
    const paveMatOptsC_k = {};
    paveMatOptsC_k.map = paveTexC_k; paveMatOptsC_k.roughness = 1;
    layPaving_k(-330, 330, new THREE.MeshStandardMaterial(paveMatOptsC_k));
  }

  const asphaltTex_k = textureFromCanvas(64, 256, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = '#33373c';
    ctx_k.fillRect(0, 0, w_k, h_k);
    let fleck_k = 0;
    for (; 700 > fleck_k;) {
      const shadeValue = 40 + Math.floor(36 * rnd());
      ctx_k.fillStyle = 'rgba(' + shadeValue + ',' + shadeValue + ',' + (shadeValue + 4) + ',.18)';
      ctx_k.fillRect(w_k * rnd(), h_k * rnd(), 2, 2);
      ++fleck_k;
    }
    let glint_k = 0;
    for (; 130 > glint_k;) {
      ctx_k.fillStyle = 'rgba(255,255,255,.045)';
      ctx_k.fillRect(w_k * rnd(), h_k * rnd(), 2, 2);
      ++glint_k;
    }
    ctx_k.strokeStyle = 'rgba(0,0,0,.16)';
    ctx_k.lineWidth = 1;
    let crack_k = 0;
    for (; 7 > crack_k;) {
      ctx_k.beginPath();
      let crackX_k;
      crackX_k = w_k * rnd();
      let crackY_k;
      crackY_k = h_k * rnd();
      ctx_k.moveTo(crackX_k, crackY_k);
      let seg_k = 0;
      for (; 3 > seg_k;) {
        crackX_k += rr(-9, 9);
        crackY_k += rr(4, 14);
        ctx_k.lineTo(crackX_k, crackY_k);
        ++seg_k;
      }
      ctx_k.stroke();
      ++crack_k;
    }
    function paintLine_k(u_k, tone_k, widthFrac_k) {
      ctx_k.fillStyle = tone_k;
      let lineW_k;
      lineW_k = Math.max(1, widthFrac_k * w_k);
      ctx_k.fillRect(-lineW_k / 2 + w_k * u_k, 0, lineW_k, h_k);
    }
    paintLine_k(0.03, '#d8d8d2', 0.012);
    paintLine_k(0.97, '#d8d8d2', 0.012);
    paintLine_k(0.478, '#e8d9a0', 0.008);
    paintLine_k(0.522, '#e8d9a0', 0.008);
    ctx_k.fillStyle = '#ffffff';
    const uList_k = [];
    uList_k.push(0.25, 0.75);
    const uIter_k = uList_k[Symbol.iterator]();
    let uStep_k;
    while (!(uStep_k = uIter_k.next()).done) {
      const u_k = uStep_k.value;
      const lineW_k = Math.max(1, 0.010 * w_k);
      ctx_k.fillRect(-lineW_k / 2 + w_k * u_k, 0, lineW_k, 0.45 * h_k);
    }
  });
  asphaltTex_k.wrapS = THREE.RepeatWrapping; asphaltTex_k.wrapT = THREE.RepeatWrapping;
  G_k.maxAniso ? asphaltTex_k.anisotropy = G_k.maxAniso : null;
  const fullAsphaltMatOpts_k = {};
  fullAsphaltMatOpts_k.map = asphaltTex_k; fullAsphaltMatOpts_k.roughness = 0.95;
  const fullAsphaltMat_k = new THREE.MeshStandardMaterial(fullAsphaltMatOpts_k);
  const flatAsphaltMatOpts_k = {};
  flatAsphaltMatOpts_k.color = 0x33373d; flatAsphaltMatOpts_k.roughness = 0.95;
  const flatAsphaltMat_k = new THREE.MeshStandardMaterial(flatAsphaltMatOpts_k);

  let walkTexVert_k;
  walkTexVert_k = pavingTextureBuild();
  walkTexVert_k.repeat.set(1, 110);
  G_k.maxAniso ? walkTexVert_k.anisotropy = G_k.maxAniso : null;
  const walkMatVertOpts_k = {};
  walkMatVertOpts_k.map = walkTexVert_k; walkMatVertOpts_k.roughness = 1;
  const walkMatVert_k = new THREE.MeshStandardMaterial(walkMatVertOpts_k);
  let walkTexHorz_k;
  walkTexHorz_k = pavingTextureBuild();
  walkTexHorz_k.repeat.set(110, 1);
  G_k.maxAniso ? walkTexHorz_k.anisotropy = G_k.maxAniso : null;
  const walkMatHorzOpts_k = {};
  walkMatHorzOpts_k.map = walkTexHorz_k; walkMatHorzOpts_k.roughness = 1;
  const walkMatHorz_k = new THREE.MeshStandardMaterial(walkMatHorzOpts_k);

  const roadXIter_k = G_k.roadX[Symbol.iterator]();
  let roadXStep_k;
  while (!(roadXStep_k = roadXIter_k.next()).done) {
    const roadX_k = roadXStep_k.value;
    let texCopy_k;
    texCopy_k = asphaltTex_k.clone();
    texCopy_k.needsUpdate = true;
    texCopy_k.repeat.set(1, 44);
    const roadMatOpts_k = {};
    roadMatOpts_k.map = texCopy_k; roadMatOpts_k.roughness = 0.95;
    const road_k = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.roadW, 1320),
      new THREE.MeshStandardMaterial(roadMatOpts_k),
    );
    road_k.rotation.x = -Math.PI / 2;
    road_k.position.set(roadX_k, 0.05, 0);
    road_k.receiveShadow = true;
    scene_k.add(road_k);
    const signList_k = [];
    signList_k.push(-1, 1);
    const signIter_k = signList_k[Symbol.iterator]();
    let signStep_k;
    while (!(signStep_k = signIter_k.next()).done) {
      const sign_k = signStep_k.value;
      const walk_k = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), walkMatVert_k);
      walk_k.position.set(sign_k * (CFG.roadW / 2 + 1.5) + roadX_k, 0.06, 0);
      walk_k.receiveShadow = true;
      scene_k.add(walk_k);
    }
  }
  const roadZIter_k = G_k.roadZ[Symbol.iterator]();
  let roadZStep_k;
  while (!(roadZStep_k = roadZIter_k.next()).done) {
    const roadZ_k = roadZStep_k.value;
    let texCopy_k;
    texCopy_k = asphaltTex_k.clone();
    texCopy_k.needsUpdate = true;
    texCopy_k.center.set(0.5, 0.5);
    texCopy_k.rotation = Math.PI / 2;
    texCopy_k.repeat.set(1, 44);
    const roadMatOpts_k = {};
    roadMatOpts_k.map = texCopy_k; roadMatOpts_k.roughness = 0.95;
    const road_k = new THREE.Mesh(
      new THREE.PlaneGeometry(1320, CFG.roadW),
      new THREE.MeshStandardMaterial(roadMatOpts_k),
    );
    road_k.rotation.x = -Math.PI / 2;
    road_k.position.set(0, 0.05, roadZ_k);
    road_k.rotation.z = Math.PI / 2;
    road_k.receiveShadow = true;
    scene_k.add(road_k);
    const signList_k = [];
    signList_k.push(-1, 1);
    const signIter_k = signList_k[Symbol.iterator]();
    let signStep_k;
    while (!(signStep_k = signIter_k.next()).done) {
      const sign_k = signStep_k.value;
      const walk_k = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), walkMatHorz_k);
      walk_k.position.set(0, 0.06, sign_k * (CFG.roadW / 2 + 1.5) + roadZ_k);
      walk_k.receiveShadow = true;
      scene_k.add(walk_k);
    }
  }
  void fullAsphaltMat_k;
  void flatAsphaltMat_k;

  {
    let barsPerSide_k;
    barsPerSide_k = 5;
    let sidesPerCrossing_k;
    sidesPerCrossing_k = 4;
    let barTotal_k;
    barTotal_k = G_k.roadX.length * G_k.roadZ.length * sidesPerCrossing_k * barsPerSide_k;
    const zebraMatOpts_k = {};
    zebraMatOpts_k.color = 0xf2efe4; zebraMatOpts_k.roughness = 0.9;
    const zebra_k = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial(zebraMatOpts_k),
      barTotal_k,
    );
    let mat4K;
    mat4K = new THREE.Matrix4();
    const qFlat_k = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    let posK;
    posK = new THREE.Vector3();
    let sclK;
    sclK = new THREE.Vector3();
    let crossOff_k;
    crossOff_k = CFG.roadW / 2 + 3.5;
    let crossSpan_k;
    crossSpan_k = CFG.roadW / 6;
    let barAt_k = 0;
    const crossXIter_k = G_k.roadX[Symbol.iterator]();
    let crossXStep_k;
    while (!(crossXStep_k = crossXIter_k.next()).done) {
      const crossX_k = crossXStep_k.value;
      const crossZIter_k = G_k.roadZ[Symbol.iterator]();
      let crossZStep_k;
      while (!(crossZStep_k = crossZIter_k.next()).done) {
        const crossZ_k = crossZStep_k.value;
        let bar_k = 0;
        for (; barsPerSide_k > bar_k;) {
          const shift_k = bar_k * crossSpan_k - crossSpan_k * 2;
          posK.set(shift_k + crossX_k, 0.07, crossZ_k - crossOff_k);
          sclK.set(2.4, 6, 1);
          zebra_k.setMatrixAt(barAt_k++, mat4K.compose(posK, qFlat_k, sclK));
          posK.set(shift_k + crossX_k, 0.07, crossOff_k + crossZ_k);
          zebra_k.setMatrixAt(barAt_k++, mat4K.compose(posK, qFlat_k, sclK));
          posK.set(crossX_k - crossOff_k, 0.07, shift_k + crossZ_k);
          sclK.set(6, 2.4, 1);
          zebra_k.setMatrixAt(barAt_k++, mat4K.compose(posK, qFlat_k, sclK));
          posK.set(crossOff_k + crossX_k, 0.07, shift_k + crossZ_k);
          zebra_k.setMatrixAt(barAt_k++, mat4K.compose(posK, qFlat_k, sclK));
          ++bar_k;
        }
      }
    }
    zebra_k.instanceMatrix.needsUpdate = true;
    scene_k.add(zebra_k);
  }
  {
    let halfRoadW_k;
    halfRoadW_k = CFG.roadW / 2;
    const paleMatOpts_k = {};
    paleMatOpts_k.color = 0xf5f2e8; paleMatOpts_k.roughness = 0.85;
    const paleMat_k = new THREE.MeshStandardMaterial(paleMatOpts_k);
    const amberMatOpts_k = {};
    amberMatOpts_k.color = 0xf7d154; amberMatOpts_k.roughness = 0.85;
    const amberMat_k = new THREE.MeshStandardMaterial(amberMatOpts_k);
    const midDashes_k = [];
    const laneDashes_k = [];
    const edgeLines_k = [];
    const stopLines_k = [];
    const hillDashes_k = [];
    const hillEdges_k = [];
    function closeCross_k(probe_k, roads_k) {
      return roads_k.some((road_k) => 9 + halfRoadW_k > Math.abs(probe_k - road_k));
    }
    const dashRoadXIter_k = G_k.roadX[Symbol.iterator]();
    let dashRoadXStep_k;
    while (!(dashRoadXStep_k = dashRoadXIter_k.next()).done) {
      const roadX_k = dashRoadXStep_k.value;
      let dashZ_k = -648;
      for (; 648 >= dashZ_k;) {
        if (!closeCross_k(dashZ_k, G_k.roadZ)) {
          const midRec_k = {};
          midRec_k.sx = 0.4; midRec_k.z = 3 + dashZ_k; midRec_k.x = roadX_k; midRec_k.sy = 6;
          midDashes_k.push(midRec_k);
          const laneRecA_k = {};
          laneRecA_k.sx = 0.3; laneRecA_k.z = 2 + dashZ_k; laneRecA_k.x = roadX_k - 7.5; laneRecA_k.sy = 4.5;
          laneDashes_k.push(laneRecA_k);
          const laneRecB_k = {};
          laneRecB_k.sx = 0.3; laneRecB_k.z = 2 + dashZ_k; laneRecB_k.x = 7.5 + roadX_k; laneRecB_k.sy = 4.5;
          laneDashes_k.push(laneRecB_k);
        }
        dashZ_k += 12;
      }
      let seg_k = 0;
      for (; G_k.roadZ.length - 1 > seg_k;) {
        let fromZ_k;
        fromZ_k = halfRoadW_k + G_k.roadZ[seg_k];
        let toZ_k;
        toZ_k = G_k.roadZ[1 + seg_k] - halfRoadW_k;
        const edgeRecA_k = {};
        edgeRecA_k.sx = 0.3; edgeRecA_k.z = (fromZ_k + toZ_k) / 2;
        edgeRecA_k.x = roadX_k - halfRoadW_k + 0.8; edgeRecA_k.sy = toZ_k - fromZ_k;
        edgeLines_k.push(edgeRecA_k);
        const edgeRecB_k = {};
        edgeRecB_k.sx = 0.3; edgeRecB_k.z = (fromZ_k + toZ_k) / 2;
        edgeRecB_k.x = roadX_k + halfRoadW_k - 0.8; edgeRecB_k.sy = toZ_k - fromZ_k;
        edgeLines_k.push(edgeRecB_k);
        ++seg_k;
      }
    }
    const dashRoadZIter_k = G_k.roadZ[Symbol.iterator]();
    let dashRoadZStep_k;
    while (!(dashRoadZStep_k = dashRoadZIter_k.next()).done) {
      const roadZ_k = dashRoadZStep_k.value;
      let dashX_k = -648;
      for (; 648 >= dashX_k;) {
        if (!closeCross_k(dashX_k, G_k.roadX)) {
          const midRec_k = {};
          midRec_k.sx = 6; midRec_k.z = roadZ_k; midRec_k.x = 3 + dashX_k; midRec_k.sy = 0.4;
          midDashes_k.push(midRec_k);
          const laneRecA_k = {};
          laneRecA_k.sx = 4.5; laneRecA_k.z = roadZ_k - 7.5; laneRecA_k.x = 2 + dashX_k; laneRecA_k.sy = 0.3;
          laneDashes_k.push(laneRecA_k);
          const laneRecB_k = {};
          laneRecB_k.sx = 4.5; laneRecB_k.z = 7.5 + roadZ_k; laneRecB_k.x = 2 + dashX_k; laneRecB_k.sy = 0.3;
          laneDashes_k.push(laneRecB_k);
        }
        dashX_k += 12;
      }
      let seg_k = 0;
      for (; G_k.roadX.length - 1 > seg_k;) {
        let fromX_k;
        fromX_k = halfRoadW_k + G_k.roadX[seg_k];
        let toX_k;
        toX_k = G_k.roadX[1 + seg_k] - halfRoadW_k;
        const edgeRecA_k = {};
        edgeRecA_k.sx = toX_k - fromX_k; edgeRecA_k.z = roadZ_k - halfRoadW_k + 0.8;
        edgeRecA_k.x = (fromX_k + toX_k) / 2; edgeRecA_k.sy = 0.3;
        edgeLines_k.push(edgeRecA_k);
        const edgeRecB_k = {};
        edgeRecB_k.sx = toX_k - fromX_k; edgeRecB_k.z = roadZ_k + halfRoadW_k - 0.8;
        edgeRecB_k.x = (fromX_k + toX_k) / 2; edgeRecB_k.sy = 0.3;
        edgeLines_k.push(edgeRecB_k);
        ++seg_k;
      }
    }
    const stopXIter_k = G_k.roadX[Symbol.iterator]();
    let stopXStep_k;
    while (!(stopXStep_k = stopXIter_k.next()).done) {
      const crossX_k = stopXStep_k.value;
      const stopZIter_k = G_k.roadZ[Symbol.iterator]();
      let stopZStep_k;
      while (!(stopZStep_k = stopZIter_k.next()).done) {
        const crossZ_k = stopZStep_k.value;
        const stopOff_k = 8.5 + halfRoadW_k;
        const stopRecA_k = {};
        stopRecA_k.sx = 13; stopRecA_k.z = crossZ_k + stopOff_k; stopRecA_k.x = crossX_k - 7; stopRecA_k.sy = 0.55;
        stopLines_k.push(stopRecA_k);
        const stopRecB_k = {};
        stopRecB_k.sx = 13; stopRecB_k.z = crossZ_k - stopOff_k; stopRecB_k.x = 7 + crossX_k; stopRecB_k.sy = 0.55;
        stopLines_k.push(stopRecB_k);
        const stopRecC_k = {};
        stopRecC_k.sx = 0.55; stopRecC_k.z = crossZ_k - 7; stopRecC_k.x = crossX_k + stopOff_k; stopRecC_k.sy = 13;
        stopLines_k.push(stopRecC_k);
        const stopRecD_k = {};
        stopRecD_k.sx = 0.55; stopRecD_k.z = 7 + crossZ_k; stopRecD_k.x = crossX_k - stopOff_k; stopRecD_k.sy = 13;
        stopLines_k.push(stopRecD_k);
      }
    }
    let hillSeg_k = 0;
    for (; G_k.touge.length - 1 > hillSeg_k;) {
      let ptFrom_k;
      ptFrom_k = G_k.touge[hillSeg_k];
      let ptTo_k;
      ptTo_k = G_k.touge[1 + hillSeg_k];
      let dx_k;
      dx_k = ptTo_k.x - ptFrom_k.x;
      let dz_k;
      dz_k = ptTo_k.z - ptFrom_k.z;
      let len_k;
      if (Math.hypot(dx_k, dz_k)) len_k = Math.hypot(dx_k, dz_k);
      else len_k = 0.001;
      let dirX_k;
      dirX_k = dx_k / len_k;
      let dirZ_k;
      dirZ_k = dz_k / len_k;
      let sideX_k;
      sideX_k = -dirZ_k;
      let sideZ_k;
      sideZ_k = dirX_k;
      const rotY_k = Math.atan2(-dirX_k, -dirZ_k);
      let dashAt_k = 4;
      while (len_k > dashAt_k) {
        let frac_k;
        frac_k = dashAt_k / len_k;
        let dashX_k;
        dashX_k = ptFrom_k.x + dx_k * frac_k;
        let dashZ_k;
        dashZ_k = ptFrom_k.z + dz_k * frac_k;
        const hillRec_k = {};
        hillRec_k.sy = 3.2; hillRec_k.sx = 0.35; hillRec_k.ry = rotY_k;
        hillRec_k.z = dashZ_k; hillRec_k.x = dashX_k;
        hillRec_k.y = 0.12 + groundH(dashX_k, dashZ_k);
        hillDashes_k.push(hillRec_k);
        dashAt_k += 9;
      }
      const flankList_k = [];
      flankList_k.push(-1, 1);
      const flankIter_k = flankList_k[Symbol.iterator]();
      let flankStep_k;
      while (!(flankStep_k = flankIter_k.next()).done) {
        const flank_k = flankStep_k.value;
        const midEdgeX_k = sideX_k * flank_k * 4.05 + (ptFrom_k.x + ptTo_k.x) / 2;
        const midEdgeZ_k = sideZ_k * flank_k * 4.05 + (ptFrom_k.z + ptTo_k.z) / 2;
        const hFrom_k = groundH(
          sideX_k * flank_k * 4.05 + ptFrom_k.x, sideZ_k * flank_k * 4.05 + ptFrom_k.z,
        );
        const hTo_k = groundH(
          sideX_k * flank_k * 4.05 + ptTo_k.x, sideZ_k * flank_k * 4.05 + ptTo_k.z,
        );
        const edgeRec_k = {};
        edgeRec_k.y = 0.13 + Math.max(hFrom_k, hTo_k); edgeRec_k.sx = 0.28;
        edgeRec_k.ry = Math.atan2(dirX_k, dirZ_k);
        edgeRec_k.z = midEdgeZ_k; edgeRec_k.x = midEdgeX_k; edgeRec_k.sz = len_k;
        hillEdges_k.push(edgeRec_k);
      }
      ++hillSeg_k;
    }
    const groundQuat_k = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    function stampPlanes_k(rows_k, mat_k) {
      if (!rows_k.length) return;
      const inst_k = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat_k, rows_k.length);
      let mat4K;
      mat4K = new THREE.Matrix4();
      let qMain_k;
      qMain_k = new THREE.Quaternion();
      let qYaw_k;
      qYaw_k = new THREE.Quaternion();
      let posK;
      posK = new THREE.Vector3();
      let sclK;
      sclK = new THREE.Vector3();
      rows_k.forEach((row_k, rowNo_k) => {
        if (row_k.ry) {
          qYaw_k.setFromEuler(new THREE.Euler(0, row_k.ry, 0));
          const qCopy_k = qMain_k.copy(qYaw_k);
          qCopy_k.multiply(groundQuat_k);
        } else qMain_k.copy(groundQuat_k);
        let rowY_k;
        if (row_k.y) rowY_k = row_k.y;
        else rowY_k = 0.08;
        inst_k.setMatrixAt(
          rowNo_k,
          mat4K.compose(posK.set(row_k.x, rowY_k, row_k.z), qMain_k, sclK.set(row_k.sx, row_k.sy, 1)),
        );
      });
      inst_k.instanceMatrix.needsUpdate = true;
      scene_k.add(inst_k);
    }
    function stampBoxes_k(rows_k, mat_k) {
      if (!rows_k.length) return;
      const inst_k = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat_k, rows_k.length);
      let mat4K;
      mat4K = new THREE.Matrix4();
      let qMain_k;
      qMain_k = new THREE.Quaternion();
      let posK;
      posK = new THREE.Vector3();
      let sclK;
      sclK = new THREE.Vector3();
      rows_k.forEach((row_k, rowNo_k) => {
        let rowRy_k;
        if (row_k.ry) rowRy_k = row_k.ry;
        else rowRy_k = 0;
        qMain_k.setFromEuler(new THREE.Euler(0, rowRy_k, 0));
        let rowY_k;
        if (row_k.y) rowY_k = row_k.y;
        else rowY_k = 0.08;
        inst_k.setMatrixAt(
          rowNo_k,
          mat4K.compose(posK.set(row_k.x, rowY_k, row_k.z), qMain_k, sclK.set(row_k.sx, 0.05, row_k.sz)),
        );
      });
      inst_k.instanceMatrix.needsUpdate = true;
      scene_k.add(inst_k);
    }
    stampPlanes_k(midDashes_k, amberMat_k);
    stampPlanes_k(laneDashes_k, paleMat_k);
    stampPlanes_k(edgeLines_k, paleMat_k);
    stampPlanes_k(stopLines_k, paleMat_k);
    stampPlanes_k(hillDashes_k, paleMat_k);
    stampBoxes_k(hillEdges_k, paleMat_k);
  }

  {
    function mergeGeos_k(geoArr_k) {
      let vertTotal_k = 0;
      let idxTotal_k = 0;
      const geoIter_k = geoArr_k[Symbol.iterator]();
      let geoStep_k;
      while (!(geoStep_k = geoIter_k.next()).done) {
        const part_k = geoStep_k.value;
        vertTotal_k += part_k.attributes.position.count;
        idxTotal_k += part_k.index.count;
      }
      let posBuf_k;
      posBuf_k = new Float32Array(3 * vertTotal_k);
      let nrmBuf_k;
      nrmBuf_k = new Float32Array(3 * vertTotal_k);
      let uvBuf_k;
      uvBuf_k = new Float32Array(2 * vertTotal_k);
      let idxBuf_k;
      idxBuf_k = new Uint32Array(idxTotal_k);
      let vertAt_k = 0;
      let idxAt_k = 0;
      const partIter_k = geoArr_k[Symbol.iterator]();
      let partStep_k;
      while (!(partStep_k = partIter_k.next()).done) {
        const part_k = partStep_k.value;
        posBuf_k.set(part_k.attributes.position.array, 3 * vertAt_k);
        nrmBuf_k.set(part_k.attributes.normal.array, 3 * vertAt_k);
        part_k.attributes.uv ? uvBuf_k.set(part_k.attributes.uv.array, 2 * vertAt_k) : null;
        let elem_k = 0;
        for (; part_k.index.count > elem_k;) {
          idxBuf_k[idxAt_k + elem_k] = vertAt_k + part_k.index.getX(elem_k);
          ++elem_k;
        }
        vertAt_k += part_k.attributes.position.count;
        idxAt_k += part_k.index.count;
      }
      const welded_k = new THREE.BufferGeometry();
      welded_k.setAttribute('position', new THREE.BufferAttribute(posBuf_k, 3));
      welded_k.setAttribute('normal', new THREE.BufferAttribute(nrmBuf_k, 3));
      welded_k.setAttribute('uv', new THREE.BufferAttribute(uvBuf_k, 2));
      welded_k.setIndex(new THREE.BufferAttribute(idxBuf_k, 1));
      return welded_k;
    }
    const poleGeoParts_k = [];
    const poleCyl_k = new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8);
    poleGeoParts_k.push(poleCyl_k.translate(0, 2.3, 0));
    const poleBoxA_k = new THREE.BoxGeometry(0.12, 0.12, 1.0);
    poleGeoParts_k.push(poleBoxA_k.translate(0, 4.5, 0.5));
    const poleBoxB_k = new THREE.BoxGeometry(0.34, 0.9, 0.3);
    poleGeoParts_k.push(poleBoxB_k.translate(0, 4.15, 0.95));
    const poleGeo_k = mergeGeos_k(poleGeoParts_k);
    const poleMatOpts_k = {};
    poleMatOpts_k.roughness = 0.6; poleMatOpts_k.color = 0x22262a; poleMatOpts_k.metalness = 0.6;
    const poleMat_k = new THREE.MeshStandardMaterial(poleMatOpts_k);
    const junctions_k = [];
    const jxIter_k = G_k.roadX[Symbol.iterator]();
    let jxStep_k;
    while (!(jxStep_k = jxIter_k.next()).done) {
      const jx_k = jxStep_k.value;
      const jzIter_k = G_k.roadZ[Symbol.iterator]();
      let jzStep_k;
      while (!(jzStep_k = jzIter_k.next()).done) {
        const jz_k = jzStep_k.value;
        junctions_k.push([jx_k, jz_k]);
      }
    }
    const poleInst_k = new THREE.InstancedMesh(poleGeo_k, poleMat_k, 2 * junctions_k.length);
    const faceGeo_k = new THREE.CircleGeometry(0.11, 12);
    const litTones_k = [];
    litTones_k.push(0xff2a1e, 0xffb020, 0x2aff5a);
    const lampSets_k = {};
    lampSets_k.x = []; lampSets_k.z = [];
    const axisList_k = [];
    axisList_k.push('x', 'z');
    const axisIter_k = axisList_k[Symbol.iterator]();
    let axisStep_k;
    while (!(axisStep_k = axisIter_k.next()).done) {
      const axis_k = axisStep_k.value;
      let tone_k = 0;
      for (; 3 > tone_k;) {
        const litMatOpts_k = {};
        litMatOpts_k.color = litTones_k[tone_k];
        const lit_k = new THREE.InstancedMesh(
          faceGeo_k, new THREE.MeshBasicMaterial(litMatOpts_k), junctions_k.length,
        );
        const darkMatOpts_k = {};
        darkMatOpts_k.color = 0x1a1c1e;
        const dark_k = new THREE.InstancedMesh(
          faceGeo_k, new THREE.MeshBasicMaterial(darkMatOpts_k), junctions_k.length,
        );
        const pairRec_k = {};
        pairRec_k.on = lit_k; pairRec_k.off = dark_k;
        lampSets_k[axis_k].push(pairRec_k);
        scene_k.add(lit_k);
        scene_k.add(dark_k);
        ++tone_k;
      }
    }
    let mat4K;
    mat4K = new THREE.Matrix4();
    let qK;
    qK = new THREE.Quaternion();
    let eK;
    eK = new THREE.Euler();
    let oneScale_k;
    oneScale_k = new THREE.Vector3(1, 1, 1);
    let posK;
    posK = new THREE.Vector3();
    let pole_k = 0;
    junctions_k.forEach(([jxVal_k, jzVal_k], j_k) => {
      const poleList_k = [];
      poleList_k.push([13 + jxVal_k, 13 + jzVal_k, Math.PI / 2, 'x']);
      poleList_k.push([jxVal_k - 13, jzVal_k - 13, 0, 'z']);
      const poleIter_k = poleList_k[Symbol.iterator]();
      let poleStep_k;
      while (!(poleStep_k = poleIter_k.next()).done) {
        const [poleX_k, poleZ_k, poleRot_k, poleAxis_k] = poleStep_k.value;
        qK.setFromEuler(eK.set(0, poleRot_k, 0));
        poleInst_k.setMatrixAt(pole_k++, mat4K.compose(posK.set(poleX_k, 0, poleZ_k), qK, oneScale_k));
        let cos_k;
        cos_k = Math.cos(poleRot_k);
        let sin_k;
        sin_k = Math.sin(poleRot_k);
        let tone_k = 0;
        for (; 3 > tone_k;) {
          const faceOffList_k = [];
          faceOffList_k.push(0.28, 0, -0.28);
          let faceY_k;
          faceY_k = 4.15 + faceOffList_k[tone_k];
          let faceOff_k;
          faceOff_k = 1.11;
          const faceMtx_k = mat4K.compose(
            posK.set(poleX_k + faceOff_k * sin_k, faceY_k, poleZ_k + faceOff_k * cos_k), qK, oneScale_k,
          );
          lampSets_k[poleAxis_k][tone_k].on.setMatrixAt(j_k, faceMtx_k);
          lampSets_k[poleAxis_k][tone_k].off.setMatrixAt(j_k, faceMtx_k);
          ++tone_k;
        }
      }
    });
    poleInst_k.instanceMatrix.needsUpdate = true;
    scene_k.add(poleInst_k);
    const pairAxisList_k = [];
    pairAxisList_k.push('x', 'z');
    const pairAxisIter_k = pairAxisList_k[Symbol.iterator]();
    let pairAxisStep_k;
    while (!(pairAxisStep_k = pairAxisIter_k.next()).done) {
      const axis_k = pairAxisStep_k.value;
      const pairIter_k = lampSets_k[axis_k][Symbol.iterator]();
      let pairStep_k;
      while (!(pairStep_k = pairIter_k.next()).done) {
        const pair_k = pairStep_k.value;
        pair_k.on.instanceMatrix.needsUpdate = true;
        pair_k.off.instanceMatrix.needsUpdate = true;
      }
    }
    let clock_k = 0;
    let phase_k = -1;
    let stateX_k = 'red';
    let stateZ_k = 'green';
    function pushStates_k() {
      const stateList_k = [];
      stateList_k.push(['x', stateX_k], ['z', stateZ_k]);
      const stateIter_k = stateList_k[Symbol.iterator]();
      let stateStep_k;
      while (!(stateStep_k = stateIter_k.next()).done) {
        const [axis_k, stateTxt_k] = stateStep_k.value;
        let litNo_k;
        if ('red' === stateTxt_k) litNo_k = 0;
        else if ('yellow' === stateTxt_k) litNo_k = 1;
        else litNo_k = 2;
        lampSets_k[axis_k].forEach((pair_k, tone_k) => {
          pair_k.on.visible = litNo_k === tone_k;
          pair_k.off.visible = litNo_k !== tone_k;
        });
      }
    }
    pushStates_k();
    G_k.lightState = (axis_k) => {
      if ('x' === axis_k) return stateX_k;
      else return stateZ_k;
    };
    G_k.updaters.push((GInner_k, dtInner_k) => {
      clock_k = (dtInner_k + clock_k) % 15.5;
      let nextPhase_k, wantX_k = 'red', wantZ_k = 'red';
      if (5.5 > clock_k) {
        nextPhase_k = 0;
        wantZ_k = 'green';
      } else if (7 > clock_k) {
        nextPhase_k = 1;
        wantZ_k = 'yellow';
      } else if (7.75 > clock_k) nextPhase_k = 2;
      else if (13.25 > clock_k) {
        nextPhase_k = 3;
        wantX_k = 'green';
      } else if (14.75 > clock_k) {
        nextPhase_k = 4;
        wantX_k = 'yellow';
      } else nextPhase_k = 5;
      if (phase_k !== nextPhase_k) {
        phase_k = nextPhase_k;
        stateX_k = wantX_k;
        stateZ_k = wantZ_k;
        pushStates_k();
      }
    });
  }

  const fallbackPalette_k = [];
  fallbackPalette_k.push('#8d99ae', '#a39a8b', '#b08968', '#94867a', '#9c7bb5', '#6d8ea0');

  let beachPastels_k;
  beachPastels_k = VICE.coralPastels;
  const tonesByDistrict_k = {};
  const hoshinoTones_k = [];
  hoshinoTones_k.push('#9aa0a6', '#a39a8b', '#7d9a7a', '#b09872', '#6d8ea0', '#9a8a72');
  tonesByDistrict_k.hoshino = hoshinoTones_k;
  tonesByDistrict_k.neon = VICE.downtown;
  const portTones_k = [];
  portTones_k.push('#8a7f6a', '#6b7a72', '#a08a68', '#5f8d7d', '#94867a', '#7f9bb3');
  tonesByDistrict_k.port = portTones_k;
  tonesByDistrict_k.coral = VICE.coralPastels;
  let prevWallTone_k = null;
  let prevPrevWallTone_k = null;
  const shopSignChoices_k = [];
  shopSignChoices_k.push(['RAMEN', '#ff5c39'], ['CLUB NEON', '#e879ff'], ['TURBO PARTS', '#57b7ff'], ['HOTEL CORAL', '#ffb35c']);
  shopSignChoices_k.push(['PAWN', '#ffe14d'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0']);
  const posterChoices_k = [];
  posterChoices_k.push('RONIN KAI', 'TURBO MAX', 'BAY COLA');
  let gridX_k = 0;
  for (; 8 > gridX_k;) {
    let gridZ_k = 0;
    for (; 8 > gridZ_k;) {
      let centreX_k;
      centreX_k = 165 * gridX_k - 577.5;
      let centreZ_k;
      centreZ_k = 165 * gridZ_k - 577.5;
      const district_k = DISTRICTS.reduce(
        (best_k, cand_k) => {
          if (
            (centreX_k - best_k.cx) ** 2 + (centreZ_k - best_k.cz) ** 2 >
            (centreX_k - cand_k.cx) ** 2 + (centreZ_k - cand_k.cz) ** 2
          ) return cand_k;
          else return best_k;
        },
        DISTRICTS[0],
      );
      ++gridZ_k;
      if (
        'hoshino' === district_k.id &&
        250 > Math.hypot(centreX_k - district_k.cx, centreZ_k - district_k.cz)
      ) {
        residentialBlockBuild(G_k, scene_k, centreX_k, centreZ_k);
        continue;
      }
      let beachBlock_k;
      beachBlock_k = 500 < centreZ_k;
      let perBlock_k;
      perBlock_k = ri(2, 4);
      let build_k = 0;
      for (; perBlock_k > build_k;) {
        ++build_k;
        let boxW_k;
        boxW_k = rr(22, 44);
        let boxD_k;
        boxD_k = rr(22, 44);
        let boxH_k;
        if (beachBlock_k) boxH_k = rr(8, 20);
        else if (district_k.id === 'neon') boxH_k = rr(24, 60);
        else if (district_k.id === 'hoshino') boxH_k = rr(8, 22);
        else if (district_k.id === 'port') boxH_k = rr(8, 20);
        else boxH_k = rr(10, 28);
        let boxX_k;
        boxX_k = centreX_k + rr(-48, 48);
        let boxZ_k;
        boxZ_k = centreZ_k + rr(-48, 48);
        if (60 > Math.abs(boxX_k + 412.5) && 60 > Math.abs(boxZ_k - 412.5)) continue;
        if (54 > Math.abs(boxX_k - MART_SITE.x) && 76 > Math.abs(boxZ_k - MART_SITE.z)) continue;
        let tonesArr_k;
        if (!beachBlock_k) {
          if (tonesByDistrict_k[district_k.id]) tonesArr_k = tonesByDistrict_k[district_k.id];
          else tonesArr_k = fallbackPalette_k;
        } else tonesArr_k = beachPastels_k;
        let wallTone_k = pick(tonesArr_k);
        prevWallTone_k === wallTone_k
          ? wallTone_k = tonesArr_k[(1 + tonesArr_k.indexOf(wallTone_k)) % tonesArr_k.length]
          : null;
        if (('coral' === district_k.id || beachBlock_k) && prevPrevWallTone_k === wallTone_k)
          wallTone_k = tonesArr_k[(1 + tonesArr_k.indexOf(wallTone_k)) % tonesArr_k.length];
        prevPrevWallTone_k = prevWallTone_k;
        prevWallTone_k = wallTone_k;
        let wallTex_k;
        wallTex_k = buildingTextureBuild(wallTone_k, rr(0.18, 0.42));
        wallTex_k.wrapS = THREE.RepeatWrapping; wallTex_k.wrapT = THREE.RepeatWrapping;
        const wallMatOpts_k = {};
        wallMatOpts_k.roughness = 0.9; wallMatOpts_k.emissiveMap = wallTex_k;
        wallMatOpts_k.emissive = 0xffc873; wallMatOpts_k.map = wallTex_k; wallMatOpts_k.emissiveIntensity = 0;
        const wallMat_k = new THREE.MeshStandardMaterial(wallMatOpts_k);
        wallMat_k.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
        const block_k = new THREE.Mesh(new THREE.BoxGeometry(boxW_k, boxH_k, boxD_k), wallMat_k);
        block_k.position.set(boxX_k, groundH(boxX_k, boxZ_k) + boxH_k / 2, boxZ_k);
        block_k.castShadow = true;
        block_k.receiveShadow = true;
        scene_k.add(block_k);
        !G_k.buildingMats ? G_k.buildingMats = [] : null;
        G_k.buildingMats.push(wallMat_k);
        G_k.addCollider(boxX_k, boxZ_k, boxW_k / 2, boxD_k / 2, boxH_k);
        if (beachBlock_k) {
          const capH_k = rr(1.6, 3);
          const cap_k = new THREE.Mesh(
            new THREE.BoxGeometry(0.62 * boxW_k, capH_k, 0.62 * boxD_k), wallMat_k,
          );
          cap_k.position.set(boxX_k, groundH(boxX_k, boxZ_k) + boxH_k + capH_k / 2, boxZ_k);
          cap_k.castShadow = true;
          scene_k.add(cap_k);
        }
        if (beachBlock_k || 'coral' === district_k.id) {
          let trimTone_k;
          trimTone_k = pick(VICE.neonTrim);
          const trimMatOpts_k = {};
          trimMatOpts_k.roughness = 0.6; trimMatOpts_k.emissive = trimTone_k;
          trimMatOpts_k.color = trimTone_k; trimMatOpts_k.emissiveIntensity = 0;
          const trimMat_k = new THREE.MeshStandardMaterial(trimMatOpts_k);
          const trim_k = new THREE.Mesh(
            new THREE.BoxGeometry(0.35 + boxW_k, 0.3, 0.35 + boxD_k), trimMat_k,
          );
          trim_k.position.set(boxX_k, groundH(boxX_k, boxZ_k) + 0.84 * boxH_k, boxZ_k);
          trim_k.castShadow = true;
          scene_k.add(trim_k);
          !G_k.neonTrimMats ? G_k.neonTrimMats = [] : null;
          G_k.neonTrimMats.push(trimMat_k);
          const trimGlow_k = glowSprite(new THREE.Color(trimTone_k), 12);
          trimGlow_k.position.set(boxX_k, groundH(boxX_k, boxZ_k) + 0.84 * boxH_k, boxZ_k);
          trimGlow_k.material.opacity = 0;
          scene_k.add(trimGlow_k);
          glowSpritesList.push(trimGlow_k);
        }
        if (0.3 > rnd()) {
          const roofBoxMatOpts_k = {};
          roofBoxMatOpts_k.color = 0x555a60;
          const roofBox_k = new THREE.Mesh(
            new THREE.BoxGeometry(rr(2, 4), rr(1, 2), rr(2, 4)),
            new THREE.MeshStandardMaterial(roofBoxMatOpts_k),
          );
          roofBox_k.position.set(boxX_k + rr(-6, 6), 0.8 + boxH_k, boxZ_k + rr(-6, 6));
          scene_k.add(roofBox_k);
        }
        if (0.22 > rnd()) {
          const posterTex_k = signTextureBuild(pick(posterChoices_k), '#14161c', '#ffb35c');
          const panelGeo_k = new THREE.PlaneGeometry(14, 4);
          const panelMatOpts_k = {};
          panelMatOpts_k.map = posterTex_k; panelMatOpts_k.side = THREE.FrontSide;
          const panelMat_k = new THREE.MeshBasicMaterial(panelMatOpts_k);
          const panelRotY_k = rr(0, Math.PI);
          const panelFront_k = new THREE.Mesh(panelGeo_k, panelMat_k);
          panelFront_k.position.set(boxX_k, 4 + boxH_k, boxZ_k);
          panelFront_k.rotation.y = panelRotY_k;
          scene_k.add(panelFront_k);
          const panelBack_k = new THREE.Mesh(panelGeo_k, panelMat_k);
          panelBack_k.position.set(
            boxX_k - 0.06 * Math.sin(panelRotY_k), 4 + boxH_k, boxZ_k - 0.06 * Math.cos(panelRotY_k),
          );
          panelBack_k.rotation.y = Math.PI + panelRotY_k;
          scene_k.add(panelBack_k);
        }
        let signChance_k;
        if (beachBlock_k) signChance_k = 0.75;
        else signChance_k = 0.6;
        if (
          ('neon' === district_k.id || 'coral' === district_k.id || beachBlock_k) &&
          signChance_k > rnd()
        ) {
          const [signText_k, signTint_k] = pick(shopSignChoices_k);
          const signTex_k = signTextureBuild(signText_k, '#101018', signTint_k);
          const signMatOpts_k = {};
          signMatOpts_k.map = signTex_k;
          const sign_k = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 3.4), new THREE.MeshBasicMaterial(signMatOpts_k),
          );
          sign_k.position.set(boxX_k, 4.6, 0.1 + boxZ_k + boxD_k / 2);
          scene_k.add(sign_k);
          const signGlow_k = glowSprite(new THREE.Color(signTint_k), 13);
          signGlow_k.position.set(boxX_k, 4.6, 0.02 + boxZ_k + boxD_k / 2);
          signGlow_k.material.opacity = 0;
          scene_k.add(signGlow_k);
          glowSpritesList.push(signGlow_k);
          const canopyMatOpts_k = {};
          canopyMatOpts_k.color = new THREE.Color(signTint_k);
          const canopy_k = new THREE.Mesh(
            new THREE.BoxGeometry(15, 0.15, 2.2),
            new THREE.MeshStandardMaterial(canopyMatOpts_k),
          );
          canopy_k.position.set(boxX_k, 3.6, 1 + boxZ_k + boxD_k / 2);
          canopy_k.rotation.x = 0.3;
          scene_k.add(canopy_k);
        }
      }
    }
    ++gridX_k;
  }

  {
    const lampSpots_k = [];
    function nearJunction_k(probe_k, roads_k) {
      return roads_k.some((road_k) => 21 > Math.abs(probe_k - road_k));
    }
    function spotHitsBlock_k(px_k, pz_k) {
      return G_k.colliders.some(
        (c_k) => 1 + c_k.hw > Math.abs(px_k - c_k.x) && 1 + c_k.hd > Math.abs(pz_k - c_k.z),
      );
    }
    const lampRoadXIter_k = G_k.roadX[Symbol.iterator]();
    let lampRoadXStep_k;
    while (!(lampRoadXStep_k = lampRoadXIter_k.next()).done) {
      const roadX_k = lampRoadXStep_k.value;
      const mainRoad_k = 0 === roadX_k || 330 === roadX_k;
      let alt_k = 0;
      let lampStep_k;
      if (mainRoad_k) lampStep_k = 45;
      else lampStep_k = 55;
      let lampZ_k = -615;
      while (615 >= lampZ_k) {
        if (nearJunction_k(lampZ_k, G_k.roadZ)) {
          lampZ_k += lampStep_k; ++alt_k;
          continue;
        }
        if (mainRoad_k) {
          const spotRecA_k = {};
          spotRecA_k.z = lampZ_k; spotRecA_k.x = roadX_k - 17; spotRecA_k.glow = 1;
          lampSpots_k.push(spotRecA_k);
          const spotRecB_k = {};
          spotRecB_k.z = 22 + lampZ_k; spotRecB_k.x = 17 + roadX_k; spotRecB_k.glow = 1;
          lampSpots_k.push(spotRecB_k);
        } else {
          const spotRec_k = {};
          spotRec_k.z = lampZ_k;
          let altOff_k;
          if (0 === alt_k % 2) altOff_k = 17;
          else altOff_k = -17;
          spotRec_k.x = altOff_k + roadX_k; spotRec_k.glow = 0;
          lampSpots_k.push(spotRec_k);
        }
        lampZ_k += lampStep_k; ++alt_k;
      }
    }
    const lampRoadZIter_k = G_k.roadZ[Symbol.iterator]();
    let lampRoadZStep_k;
    while (!(lampRoadZStep_k = lampRoadZIter_k.next()).done) {
      const roadZ_k = lampRoadZStep_k.value;
      const mainRoad_k = 0 === roadZ_k || 495 === roadZ_k;
      let alt_k = 0;
      let lampStep_k;
      if (mainRoad_k) lampStep_k = 45;
      else lampStep_k = 55;
      let lampX_k = -615;
      while (615 >= lampX_k) {
        if (nearJunction_k(lampX_k, G_k.roadX)) {
          lampX_k += lampStep_k; ++alt_k;
          continue;
        }
        if (mainRoad_k) {
          const spotRecA_k = {};
          spotRecA_k.z = roadZ_k - 17; spotRecA_k.x = lampX_k; spotRecA_k.glow = 1;
          lampSpots_k.push(spotRecA_k);
          const spotRecB_k = {};
          spotRecB_k.z = 17 + roadZ_k; spotRecB_k.x = 22 + lampX_k; spotRecB_k.glow = 1;
          lampSpots_k.push(spotRecB_k);
        } else {
          const spotRec_k = {};
          spotRec_k.x = lampX_k;
          let altOff_k;
          if (0 === alt_k % 2) altOff_k = 17;
          else altOff_k = -17;
          spotRec_k.z = altOff_k + roadZ_k; spotRec_k.glow = 0;
          lampSpots_k.push(spotRec_k);
        }
        lampX_k += lampStep_k; ++alt_k;
      }
    }
    let boardX_k = -440;
    for (; 640 >= boardX_k;) {
      if (!spotHitsBlock_k(boardX_k, 552)) {
        const spotRec_k = {};
        spotRec_k.z = 552; spotRec_k.x = boardX_k; spotRec_k.glow = 2;
        lampSpots_k.push(spotRec_k);
      }
      boardX_k += 55;
    }
    let spotTotal_k;
    spotTotal_k = lampSpots_k.length;
    const mastMatOpts_k = {};
    mastMatOpts_k.roughness = 0.8; mastMatOpts_k.color = 0x3a3f45; mastMatOpts_k.metalness = 0.5;
    const mastMat_k = new THREE.MeshStandardMaterial(mastMatOpts_k);
    let mat4K;
    mat4K = new THREE.Matrix4();
    const mastInst_k = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.09, 0.12, 6, 6), mastMat_k, spotTotal_k,
    );
    lampSpots_k.forEach((spot_k, spotNo_k) => {
      mat4K.makeTranslation(spot_k.x, 3, spot_k.z);
      mastInst_k.setMatrixAt(spotNo_k, mat4K);
    });
    mastInst_k.instanceMatrix.needsUpdate = true;
    scene_k.add(mastInst_k);
    const headMatOpts_k = {};
    headMatOpts_k.roughness = 0.5; headMatOpts_k.emissive = 0xffc98a;
    headMatOpts_k.color = 0xffd9a0; headMatOpts_k.emissiveIntensity = 0.15;
    const headMat_k = new THREE.MeshStandardMaterial(headMatOpts_k);
    const headInst_k = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), headMat_k, spotTotal_k);
    lampSpots_k.forEach((spot_k, spotNo_k) => {
      mat4K.makeTranslation(spot_k.x, 6.02, spot_k.z);
      headInst_k.setMatrixAt(spotNo_k, mat4K);
    });
    headInst_k.instanceMatrix.needsUpdate = true;
    scene_k.add(headInst_k);
    const poolMatOpts_k = {};
    poolMatOpts_k.blending = THREE.AdditiveBlending; poolMatOpts_k.opacity = 0;
    poolMatOpts_k.transparent = true; poolMatOpts_k.color = 0xffc98a; poolMatOpts_k.depthWrite = false;
    const poolMat_k = new THREE.MeshBasicMaterial(poolMatOpts_k);
    const poolInst_k = new THREE.InstancedMesh(new THREE.CircleGeometry(5.5, 20), poolMat_k, spotTotal_k);
    const groundQuat_k = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    let posK;
    posK = new THREE.Vector3();
    let oneScale_k;
    oneScale_k = new THREE.Vector3(1, 1, 1);
    lampSpots_k.forEach((spot_k, spotNo_k) => {
      poolInst_k.setMatrixAt(
        spotNo_k, mat4K.compose(posK.set(spot_k.x, 0.09, spot_k.z), groundQuat_k, oneScale_k),
      );
    });
    poolInst_k.instanceMatrix.needsUpdate = true;
    scene_k.add(poolInst_k);
    const spotIter_k = lampSpots_k[Symbol.iterator]();
    let spotStep_k;
    while (!(spotStep_k = spotIter_k.next()).done) {
      const spot_k = spotStep_k.value;
      if (!spot_k.glow) continue;
      let glowTint_k;
      if (2 === spot_k.glow) glowTint_k = 0xcfe6ff;
      else glowTint_k = 0xffd9a0;
      let glowSize_k;
      if (2 === spot_k.glow) glowSize_k = 5;
      else glowSize_k = 5.5;
      const glow_k = glowSprite(glowTint_k, glowSize_k);
      glow_k.position.set(spot_k.x, 6, spot_k.z);
      glow_k.material.opacity = 0;
      scene_k.add(glow_k);
      streetGlowList.push(glow_k);
    }
    G_k.lampHeadMat = headMat_k;
    G_k.lampPoolMat = poolMat_k;
  }
  G_k.streetlightGlows = streetGlowList;
  G_k.signGlows = glowSpritesList;
  hqBuild(G_k, scene_k);
  marketBuild(G_k, scene_k);
  beachStripBuild(G_k, scene_k);
  G_k.landmarks = {};
  const districtRecA_k = {};
  districtRecA_k.x = 0; districtRecA_k.name = 'Downtown'; districtRecA_k.z = 0;
  const districtRecB_k = {};
  districtRecB_k.x = -330; districtRecB_k.name = 'Portside'; districtRecB_k.z = 330;
  const districtRecC_k = {};
  districtRecC_k.x = 330; districtRecC_k.name = 'Coral Strip'; districtRecC_k.z = 330;
  const districtRecD_k = {};
  districtRecD_k.x = 330; districtRecD_k.name = 'Neon Mile'; districtRecD_k.z = -330;
  const districtRecE_k = {};
  districtRecE_k.x = -330; districtRecE_k.name = 'Hoshino Heights'; districtRecE_k.z = -330;
  const districtRecF_k = {};
  districtRecF_k.x = -330; districtRecF_k.name = 'Touge'; districtRecF_k.z = -470;
  G_k.landmarks.districts = [];
  G_k.landmarks.districts.push(districtRecA_k, districtRecB_k, districtRecC_k);
  G_k.landmarks.districts.push(districtRecD_k, districtRecE_k, districtRecF_k);
  G_k.landmarks.market = {};
  G_k.landmarks.market.x = MART_SITE.x; G_k.landmarks.market.name = MART_SITE.name; G_k.landmarks.market.z = MART_SITE.z;
  G_k.landmarks.garage = {};
  G_k.landmarks.garage.x = G_k.hq.x; G_k.landmarks.garage.name = 'RONIN KAI HQ'; G_k.landmarks.garage.z = G_k.hq.garage.z;

  harborBuild(G_k, scene_k);
  tougeBuild(G_k, scene_k);

  let planted_k = 0;
  let attempt_k = 0;
  for (; 400 > attempt_k && 250 > planted_k;) {
    ++attempt_k;
    let dropX_k;
    dropX_k = rr(-640, 640);
    let dropZ_k;
    dropZ_k = rr(-640, 640);
    const onRoad_k =
      G_k.roadX.some((road_k) => 22 > Math.abs(dropX_k - road_k)) ||
      G_k.roadZ.some((road_k) => 22 > Math.abs(dropZ_k - road_k));
    const nearPark_k = 55 > Math.abs(dropX_k + 412.5) && 55 > Math.abs(dropZ_k - 412.5);
    const nearMart_k = 58 > Math.abs(dropX_k - MART_SITE.x) && 78 > Math.abs(dropZ_k - MART_SITE.z);
    if (onRoad_k || nearPark_k || nearMart_k) continue;
    const homeDistrict_k = DISTRICTS.reduce(
      (best_k, cand_k) => {
        if (
          (dropX_k - best_k.cx) ** 2 + (dropZ_k - best_k.cz) ** 2 >
          (dropX_k - cand_k.cx) ** 2 + (dropZ_k - cand_k.cz) ** 2
        ) return cand_k;
        else return best_k;
      },
      DISTRICTS[0],
    );
    let tree_k;
    if ('coral' === homeDistrict_k.id || 520 < dropZ_k || 'neon' === homeDistrict_k.id)
      tree_k = makePalm(rr(4.5, 6.5));
    else if ('hoshino' === homeDistrict_k.id) {
      let shadeTone_k;
      if (0.3 > rnd()) shadeTone_k = 0xe8a0bf;
      else shadeTone_k = 0x3d8b4f;
      tree_k = makeShadeTree(rr(3.5, 5), shadeTone_k);
    }
    else tree_k = makeShadeTree(rr(3.5, 5.5), 0x3d8b4f);
    tree_k.position.set(dropX_k, groundH(dropX_k, dropZ_k), dropZ_k);
    tree_k.rotation.y = rr(0, 6.28);
    scene_k.add(tree_k);
    ++planted_k;
  }
  {
    let vergeOff_k;
    vergeOff_k = 3.8 + CFG.roadW / 2;
    let vergePalms_k = 0;
    let vergeX_k = -600;
    for (; 600 >= vergeX_k && 72 > vergePalms_k;) {
      const flankList_k = [];
      flankList_k.push(-1, 1);
      const flankIter_k = flankList_k[Symbol.iterator]();
      let flankStep_k;
      while (!(flankStep_k = flankIter_k.next()).done) {
        const flank_k = flankStep_k.value;
        const palm_k = makePalm(rr(4.5, 6.5));
        palm_k.position.set(
          vergeX_k + rr(-2, 2), groundH(vergeX_k, 495 + flank_k * vergeOff_k), 495 + flank_k * vergeOff_k,
        );
        palm_k.rotation.y = rr(0, 6.28);
        scene_k.add(palm_k);
        ++vergePalms_k;
      }
      vergeX_k += 40;
    }
    let vergeZ_k = -595;
    for (; 95 >= vergeZ_k && 82 > vergePalms_k;) {
      const palm_k = makePalm(rr(4.5, 6.5));
      palm_k.position.set(330 + vergeOff_k, groundH(330 + vergeOff_k, vergeZ_k), vergeZ_k + rr(-2, 2));
      palm_k.rotation.y = rr(0, 6.28);
      scene_k.add(palm_k);
      ++vergePalms_k;
      vergeZ_k += 70;
    }

    const hazardTex_k = textureFromCanvas(128, 128, (ctx_k, w_k, h_k) => {
      ctx_k.fillStyle = '#8a7a3a';
      ctx_k.fillRect(0, 0, w_k, h_k);
      ctx_k.fillStyle = '#2b2b2b';
      let stripe_k = -2;
      for (; 8 > stripe_k;) {
        ctx_k.save();
        ctx_k.translate(32 * stripe_k, 0);
        ctx_k.rotate(0.6);
        ctx_k.fillRect(0, -40, 14, 80 + h_k);
        ctx_k.restore();
        ++stripe_k;
      }
      ctx_k.fillStyle = 'rgba(255,255,255,.75)';
      ctx_k.fillRect(14, 44, 100, 40);
      ctx_k.fillStyle = '#333';
      ctx_k.font = 'bold 22px sans-serif';
      ctx_k.textAlign = 'center';
      ctx_k.fillText('CARGO', 64, 72);
    });
    const crateMatOpts_k = {};
    crateMatOpts_k.map = hazardTex_k; crateMatOpts_k.roughness = 0.9;
    const crateMat_k = new THREE.MeshStandardMaterial(crateMatOpts_k);
    const crateGeo_k = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    let crate_k = 0;
    for (; 12 > crate_k;) {
      const crateX_k = rr(-3, 3) - 625 + 36 * (crate_k % 4);
      const crateZ_k = 532 + rr(-3, 3) + 30 * Math.floor(crate_k / 4);
      const crateMesh_k = new THREE.Mesh(crateGeo_k, crateMat_k);
      crateMesh_k.position.set(crateX_k, 1.1, crateZ_k);
      crateMesh_k.rotation.y = rr(0, 0.6);
      scene_k.add(crateMesh_k);
      if (0 === crate_k % 3) {
        const upper_k = new THREE.Mesh(crateGeo_k, crateMat_k);
        upper_k.position.set(crateX_k, 3.3, crateZ_k);
        upper_k.rotation.y = rr(0, 0.6);
        scene_k.add(upper_k);
      }
      ++crate_k;
    }
    const barrierTex_k = textureFromCanvas(128, 32, (ctx_k, w_k, h_k) => {
      ctx_k.fillStyle = '#b8b4a8';
      ctx_k.fillRect(0, 0, w_k, h_k);
      ctx_k.fillStyle = '#e8762a';
      ctx_k.fillRect(0, 12, w_k, 8);
    });
    const barrierMatOpts_k = {};
    barrierMatOpts_k.map = barrierTex_k; barrierMatOpts_k.roughness = 0.95;
    const barrierMat_k = new THREE.MeshStandardMaterial(barrierMatOpts_k);
    let barrier_k = 0;
    for (; 6 > barrier_k;) {
      const barrierMesh_k = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.5), barrierMat_k);
      barrierMesh_k.position.set(40 * barrier_k - 560, 0.5, 472);
      scene_k.add(barrierMesh_k);
      ++barrier_k;
    }
    const binMatOpts_k = {};
    binMatOpts_k.roughness = 0.85; binMatOpts_k.color = 0x2e4a34; binMatOpts_k.metalness = 0.2;
    const binMat_k = new THREE.MeshStandardMaterial(binMatOpts_k);
    const binLidMatOpts_k = {};
    binLidMatOpts_k.roughness = 0.8; binLidMatOpts_k.color = 0x223828; binLidMatOpts_k.metalness = 0.2;
    const binLidMat_k = new THREE.MeshStandardMaterial(binLidMatOpts_k);
    const binList_k = [];
    binList_k.push([270, -40], [390, 40], [270, -200], [390, -260]);
    const binIter_k = binList_k[Symbol.iterator]();
    let binStep_k;
    while (!(binStep_k = binIter_k.next()).done) {
      const [binPx_k, binPz_k] = binStep_k.value;
      const bin_k = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), binMat_k);
      bin_k.position.set(binPx_k, 0.7, binPz_k);
      scene_k.add(bin_k);
      const lid_k = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.5), binLidMat_k);
      lid_k.position.set(binPx_k, 1.46, binPz_k);
      scene_k.add(lid_k);
    }
  }

  boulevardFrontageBuild(G_k, scene_k);
  boulevardPalmsBuild(G_k, scene_k);
  gatherSpotsBuild(G_k, scene_k);
  hoshinoRowsBuild(G_k, scene_k);
  boulevardPlantersBuild(G_k, scene_k);

  const plazaList_k = [];
  plazaList_k.push([412, 412], [-412, -80]);
  const plazaIter_k = plazaList_k[Symbol.iterator]();
  let plazaStep_k;
  while (!(plazaStep_k = plazaIter_k.next()).done) {
    const [plazaPx_k, plazaPz_k] = plazaStep_k.value;
    const slab_k = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), pavingMatMake(15, 15));
    slab_k.rotation.x = -Math.PI / 2;
    slab_k.position.set(plazaPx_k, 0.04, plazaPz_k);
    slab_k.receiveShadow = true;
    scene_k.add(slab_k);
    let seat_k = 0;
    for (; 4 > seat_k;) {
      const seatMatOpts_k = {};
      seatMatOpts_k.color = 0x7a5a38;
      const seatMesh_k = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial(seatMatOpts_k),
      );
      seatMesh_k.position.set(plazaPx_k + rr(-35, 35), 0.3, plazaPz_k + rr(-35, 35));
      scene_k.add(seatMesh_k);
      ++seat_k;
    }
    let tub_k = 0;
    for (; 4 > tub_k;) {
      const tubMatOpts_k = {};
      tubMatOpts_k.color = 0x9a8a72; tubMatOpts_k.roughness = 1;
      const tubMesh_k = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.6, 1.8),
        new THREE.MeshStandardMaterial(tubMatOpts_k),
      );
      tubMesh_k.position.set(plazaPx_k + rr(-38, 38), 0.3, plazaPz_k + rr(-38, 38));
      scene_k.add(tubMesh_k);
      const shrubMatOpts_k = {};
      shrubMatOpts_k.roughness = 1; shrubMatOpts_k.color = 0x3d8b4f; shrubMatOpts_k.flatShading = true;
      const shrub_k = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.8, 1),
        new THREE.MeshStandardMaterial(shrubMatOpts_k),
      );
      shrub_k.position.set(tubMesh_k.position.x, 0.95, tubMesh_k.position.z);
      scene_k.add(shrub_k);
      ++tub_k;
    }
    const benchA_k = benchUnitMake();
    benchA_k.position.set(plazaPx_k - 12, groundH(plazaPx_k - 12, 10 + plazaPz_k), 10 + plazaPz_k);
    benchA_k.rotation.y = 0.4;
    scene_k.add(benchA_k);
    const benchB_k = benchUnitMake();
    benchB_k.position.set(14 + plazaPx_k, groundH(14 + plazaPx_k, plazaPz_k - 8), plazaPz_k - 8);
    benchB_k.rotation.y = -0.7;
    scene_k.add(benchB_k);
    const planter_k = planterUnitMake();
    planter_k.position.set(4 + plazaPx_k, groundH(4 + plazaPx_k, 16 + plazaPz_k), 16 + plazaPz_k);
    scene_k.add(planter_k);
  }

  parkBuild(G_k, scene_k);
};

const HQ_GARAGE_YAW = Math.PI;
const hqBuild = (G_k, scene_k) => {
  let baseX_k;
  baseX_k = -412.5;
  let baseZ_k;
  baseZ_k = 412.5;
  let grp_k;
  grp_k = new THREE.Group();
  scene_k.add(grp_k);
  const shellMatOpts_k = {};
  shellMatOpts_k.color = 0x4a4038; shellMatOpts_k.roughness = 0.9;
  const shellMat_k = new THREE.MeshStandardMaterial(shellMatOpts_k);
  const shell_k = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 34), shellMat_k);
  shell_k.position.set(baseX_k, 5, baseZ_k);
  grp_k.add(shell_k);
  G_k.addCollider(baseX_k, baseZ_k, 15, 15, 10);
  const shutterMatOpts_k = {};
  shutterMatOpts_k.roughness = 0.6; shutterMatOpts_k.color = 0x707880; shutterMatOpts_k.metalness = 0.6;
  const shutterMat_k = new THREE.MeshStandardMaterial(shutterMatOpts_k);
  let shutter_k = -1;
  for (; 1 >= shutter_k;) {
    const shutterMesh_k = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), shutterMat_k);
    shutterMesh_k.position.set(baseX_k + 20 * shutter_k, 3, 17.2 + baseZ_k);
    grp_k.add(shutterMesh_k);
    ++shutter_k;
  }
  const fasciaTex_k = (() => {
    const cnv_k = document.createElement('canvas');
    cnv_k.width = 512;
    cnv_k.height = 96;
    const ctx_k = cnv_k.getContext('2d');
    ctx_k.fillStyle = '#14100c';
    ctx_k.fillRect(0, 0, 512, 96);
    ctx_k.font = 'bold 58px sans-serif';
    ctx_k.textAlign = 'center';
    ctx_k.shadowColor = '#ff7a1a';
    ctx_k.shadowBlur = 16;
    ctx_k.fillStyle = '#ff7a1a';
    ctx_k.fillText('RONIN KAI', 256, 66);
    const tex_k = new THREE.CanvasTexture(cnv_k);
    tex_k.colorSpace = THREE.SRGBColorSpace;
    return tex_k;
  })();
  const fasciaMatOpts_k = {};
  fasciaMatOpts_k.map = fasciaTex_k;
  const fascia_k = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial(fasciaMatOpts_k),
  );
  fascia_k.position.set(baseX_k, 8.6, 17.3 + baseZ_k);
  grp_k.add(fascia_k);
  const litWinMatOpts_k = {};
  litWinMatOpts_k.emissive = 0xffb35c; litWinMatOpts_k.color = 0xffd9a0; litWinMatOpts_k.emissiveIntensity = 0.6;
  const litWinMat_k = new THREE.MeshStandardMaterial(litWinMatOpts_k);
  let win_k = 0;
  for (; 5 > win_k;) {
    const winMesh_k = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), litWinMat_k);
    winMesh_k.position.set(baseX_k - 28 + 14 * win_k, 7.6, baseZ_k - 17.2);
    winMesh_k.rotation.y = Math.PI;
    grp_k.add(winMesh_k);
    ++win_k;
  }

  const forecourtTex_k = textureFromCanvas(1024, 384, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = '#6a6d70';
    ctx_k.fillRect(0, 0, w_k, h_k);
    let fleck_k = 0;
    for (; 5200 > fleck_k;) {
      const shadeValue = 96 + Math.floor(48 * rnd());
      ctx_k.fillStyle = 'rgba(' + shadeValue + ',' + shadeValue + ',' + (shadeValue + 4) + ',.14)';
      ctx_k.fillRect(w_k * rnd(), h_k * rnd(), 2, 2);
      ++fleck_k;
    }
    const stainList_k = [];
    stainList_k.push([210, 120, 58, 20], [560, 210, 74, 26]);
    stainList_k.push([790, 90, 46, 16], [390, 290, 52, 18]);
    const stainIter_k = stainList_k[Symbol.iterator]();
    let stainStep_k;
    while (!(stainStep_k = stainIter_k.next()).done) {
      const [stainPx_k, stainPy_k, stainRadX_k, stainRadY_k] = stainStep_k.value;
      ctx_k.fillStyle = 'rgba(18,18,20,.20)';
      ctx_k.beginPath();
      ctx_k.ellipse(stainPx_k, stainPy_k, stainRadX_k, stainRadY_k, 0.4, 0, Math.PI * 2);
      ctx_k.fill();
      ctx_k.fillStyle = 'rgba(18,18,20,.12)';
      ctx_k.beginPath();
      ctx_k.ellipse(14 + stainPx_k, 6 + stainPy_k, 0.6 * stainRadX_k, 0.6 * stainRadY_k, 0.4, 0, Math.PI * 2);
      ctx_k.fill();
    }
    ctx_k.strokeStyle = 'rgba(245,245,240,.88)';
    ctx_k.lineWidth = 5;
    ctx_k.beginPath();
    ctx_k.moveTo(0, h_k - 108);
    ctx_k.lineTo(w_k, h_k - 108);
    ctx_k.stroke();
    let bayLine_k = 32;
    for (; w_k - 32 >= bayLine_k;) {
      ctx_k.beginPath();
      ctx_k.moveTo(bayLine_k, h_k - 108);
      ctx_k.lineTo(bayLine_k, h_k - 6);
      ctx_k.stroke();
      bayLine_k += 96;
    }
  });
  forecourtTex_k.wrapS = THREE.ClampToEdgeWrapping; forecourtTex_k.wrapT = THREE.ClampToEdgeWrapping;
  const forecourtMatOpts_k = {};
  forecourtMatOpts_k.map = forecourtTex_k; forecourtMatOpts_k.roughness = 1;
  const forecourt_k = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial(forecourtMatOpts_k),
  );
  forecourt_k.rotation.x = -Math.PI / 2;
  forecourt_k.position.set(baseX_k, 0.04, 455);
  scene_k.add(forecourt_k);
  G_k.hq = {};
  G_k.hq.z = baseZ_k; G_k.hq.x = baseX_k;
  G_k.hq.garage = {};
  G_k.hq.garage.x = baseX_k; G_k.hq.garage.z = 455;

  function attemptSwap_k(tries_k) {
    loadHeroAsset('garage')
      .then((wrap_k) => {
        try {
          if (!wrap_k) {
            0 < tries_k ? setTimeout(() => attemptSwap_k(tries_k - 1), 1500) : null;
            return;
          }
          scene_k.remove(grp_k);
          let grpPlaced_k;
          grpPlaced_k = new THREE.Group();
          grpPlaced_k.position.set(baseX_k, groundH(baseX_k, baseZ_k), baseZ_k);
          grpPlaced_k.rotation.y = HQ_GARAGE_YAW;
          if (wrap_k.clone) grpPlaced_k.add(wrap_k.clone(true));
          else grpPlaced_k.add(wrap_k);
          const neonTex_k = (() => {
            const cnv_k = document.createElement('canvas');
            cnv_k.width = 1024;
            cnv_k.height = 192;
            const ctx_k = cnv_k.getContext('2d');
            ctx_k.clearRect(0, 0, 1024, 192);
            ctx_k.font = 'italic bold 118px sans-serif';
            ctx_k.textAlign = 'center';
            ctx_k.shadowColor = '#ff4fd8';
            ctx_k.shadowBlur = 34;
            ctx_k.fillStyle = '#ff4fd8';
            ctx_k.fillText('RONIN KAI', 512, 122);
            ctx_k.shadowBlur = 18;
            ctx_k.fillStyle = '#ff7a1a';
            ctx_k.fillRect(212, 148, 600, 14);
            const tex_k = new THREE.CanvasTexture(cnv_k);
            tex_k.colorSpace = THREE.SRGBColorSpace;
            return tex_k;
          })();
          const neonMatOpts_k = {};
          neonMatOpts_k.map = neonTex_k; neonMatOpts_k.transparent = true;
          const neon_k = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 2.6),
            new THREE.MeshBasicMaterial(neonMatOpts_k),
          );
          neon_k.position.set(0, 10.8, -15.15);
          neon_k.rotation.y = Math.PI;
          grpPlaced_k.add(neon_k);
          const stripMatOpts_k = {};
          stripMatOpts_k.color = 0x39d5ff;
          const stripMat_k = new THREE.MeshBasicMaterial(stripMatOpts_k);
          const stripList_k = [];
          stripList_k.push(-13.5, 13.5);
          const stripIter_k = stripList_k[Symbol.iterator]();
          let stripStep_k;
          while (!(stripStep_k = stripIter_k.next()).done) {
            const stripX_k = stripStep_k.value;
            const strip_k = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 8), stripMat_k);
            strip_k.position.set(stripX_k, 6, -15.15);
            strip_k.rotation.y = Math.PI;
            grpPlaced_k.add(strip_k);
          }
          const neonGlow_k = glowSprite(0xff4fd8, 16);
          neonGlow_k.position.set(0, 10.8, -15.35);
          neonGlow_k.material.opacity = 0.35;
          grpPlaced_k.add(neonGlow_k);
          scene_k.add(grpPlaced_k);
        } catch (errCaught_k) {}
      })
      .catch(() => {
        0 < tries_k ? setTimeout(() => attemptSwap_k(tries_k - 1), 1500) : null;
      });
  }
  try {
    attemptSwap_k(3);
  } catch (errCaught_k) {}
};

const harborBuild = (G_k, scene_k) => {
  const boxTones_k = [];
  boxTones_k.push(0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98, 0xca6f1e);
  const harborLenOpts_k = {};
  harborLenOpts_k.length = 26;
  Array.from(harborLenOpts_k).forEach((_skip_k, box_k) => {
    let boxX_k;
    boxX_k = rr(-620, -480);
    let boxZ_k;
    boxZ_k = rr(480, 620);
    const boxMatOpts_k = {};
    boxMatOpts_k.color = pick(boxTones_k); boxMatOpts_k.roughness = 0.8;
    const boxMesh_k = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.6, 2.4),
      new THREE.MeshStandardMaterial(boxMatOpts_k),
    );
    boxMesh_k.position.set(boxX_k, 1.3 + 2.6 * (box_k % 3), boxZ_k);
    if (0.5 > rnd()) boxMesh_k.rotation.y = 0;
    else boxMesh_k.rotation.y = Math.PI / 2;
    scene_k.add(boxMesh_k);
    0 === box_k % 4 ? G_k.addCollider(boxX_k, boxZ_k, 6, 2, 3) : null;
  });
  const craneMatOpts_k = {};
  craneMatOpts_k.roughness = 0.7; craneMatOpts_k.color = 0xd97c2b; craneMatOpts_k.metalness = 0.4;
  const craneMat_k = new THREE.MeshStandardMaterial(craneMatOpts_k);
  const craneList_k = [];
  craneList_k.push(-560, -480);
  const craneIter_k = craneList_k[Symbol.iterator]();
  let craneStep_k;
  while (!(craneStep_k = craneIter_k.next()).done) {
    const craneX_k = craneStep_k.value;
    const grpCrane_k = new THREE.Group();
    const flankList_k = [];
    flankList_k.push(-1, 1);
    const flankIter_k = flankList_k[Symbol.iterator]();
    let flankStep_k;
    while (!(flankStep_k = flankIter_k.next()).done) {
      const flank_k = flankStep_k.value;
      const leg_k = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), craneMat_k);
      leg_k.position.set(8 * flank_k, 13, 0);
      grpCrane_k.add(leg_k);
    }
    const jib_k = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 34), craneMat_k);
    jib_k.position.set(0, 26, 6);
    grpCrane_k.add(jib_k);
    const beam_k = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.4, 1.4), craneMat_k);
    beam_k.position.y = 26;
    grpCrane_k.add(beam_k);
    grpCrane_k.position.set(craneX_k, 0, 540);
    scene_k.add(grpCrane_k);
    G_k.addCollider(craneX_k, 540, 9, 3, 26);
  }
  const postMatOpts_k = {};
  postMatOpts_k.color = 0x333333;
  const postMat_k = new THREE.MeshStandardMaterial(postMatOpts_k);
  let post_k = 0;
  for (; 10 > post_k;) {
    const postMesh_k = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), postMat_k);
    postMesh_k.position.set(16 * post_k - 640, 0.4, 648);
    scene_k.add(postMesh_k);
    ++post_k;
  }
};

const tougeBuild = (G_k, scene_k) => {
  const routePts_k = TOUGE_POINTS.map((pt_k) => {
    const ptRec_k = {};
    ptRec_k.x = pt_k[0]; ptRec_k.z = pt_k[1];
    return ptRec_k;
  });
  let roadW_k;
  roadW_k = 9;
  const hubPt_k = {};
  hubPt_k.x = -330; hubPt_k.z = -470;
  let asphaltTex_k;
  asphaltTex_k = textureFromCanvas(128, 128, (ctx_k, w_k, h_k) => {
    ctx_k.fillStyle = '#33373d';
    ctx_k.fillRect(0, 0, w_k, h_k);
    let grain_k = 0;
    for (; 260 > grain_k;) {
      ctx_k.fillStyle = 'rgba(255,255,255,.05)';
      ctx_k.fillRect(w_k * rnd(), h_k * rnd(), 2, 2);
      ++grain_k;
    }
    ctx_k.fillStyle = '#f0ead0';
    ctx_k.fillRect(0.03 * w_k, 0, 3, h_k);
    ctx_k.fillRect(0.97 * w_k - 3, 0, 3, h_k);
    ctx_k.fillRect(w_k / 2 - 2, 10, 4, 44);
  });
  asphaltTex_k.wrapT = THREE.RepeatWrapping;
  asphaltTex_k.wrapS = THREE.ClampToEdgeWrapping;
  const asphaltMatOpts_k = {};
  asphaltMatOpts_k.polygonOffsetFactor = -1; asphaltMatOpts_k.polygonOffset = true;
  asphaltMatOpts_k.roughness = 0.95; asphaltMatOpts_k.map = asphaltTex_k; asphaltMatOpts_k.polygonOffsetUnits = -1;
  const asphaltMat_k = new THREE.MeshStandardMaterial(asphaltMatOpts_k);
  const railMatOpts_k = {};
  railMatOpts_k.metalness = 0.7; railMatOpts_k.color = 0xb0b6bc; railMatOpts_k.roughness = 0.4;
  const railMat_k = new THREE.MeshStandardMaterial(railMatOpts_k);
  const posArr_k = [];
  const uvArr_k = [];
  const idxArr_k = [];
  const postSpots_k = [];
  let travelled_k = 0;
  let seg_k = 0;
  for (; routePts_k.length - 1 > seg_k;) {
    let ptFrom_k;
    ptFrom_k = routePts_k[seg_k];
    let ptTo_k;
    ptTo_k = routePts_k[1 + seg_k];
    let dx_k;
    dx_k = ptTo_k.x - ptFrom_k.x;
    let dz_k;
    dz_k = ptTo_k.z - ptFrom_k.z;
    let len_k;
    if (Math.hypot(dx_k, dz_k)) len_k = Math.hypot(dx_k, dz_k);
    else len_k = 0.001;
    let dirX_k;
    dirX_k = dx_k / len_k;
    let dirZ_k;
    dirZ_k = dz_k / len_k;
    let sideX_k;
    sideX_k = -dirZ_k;
    let sideZ_k;
    sideZ_k = dirX_k;
    function edgeAt_k(pt_k, flank_k) {
      let edgeX_k;
      edgeX_k = pt_k.x + sideX_k * flank_k * (roadW_k / 2);
      let edgeZ_k;
      edgeZ_k = pt_k.z + sideZ_k * flank_k * (roadW_k / 2);
      const edgeRec_k = {};
      edgeRec_k.z = edgeZ_k; edgeRec_k.x = edgeX_k;
      edgeRec_k.y = 0.07 + groundH(edgeX_k, edgeZ_k);
      return edgeRec_k;
    }
    let edgeAPlus_k;
    edgeAPlus_k = edgeAt_k(ptFrom_k, 1);
    let edgeAMinus_k;
    edgeAMinus_k = edgeAt_k(ptFrom_k, -1);
    let edgeBPlus_k;
    edgeBPlus_k = edgeAt_k(ptTo_k, 1);
    let edgeBMinus_k;
    edgeBMinus_k = edgeAt_k(ptTo_k, -1);
    const vertBase_k = posArr_k.length / 3;
    const edgeList_k = [];
    edgeList_k.push(edgeAPlus_k, edgeAMinus_k, edgeBPlus_k, edgeBMinus_k);
    const edgeIter_k = edgeList_k[Symbol.iterator]();
    let edgeStep_k;
    while (!(edgeStep_k = edgeIter_k.next()).done) {
      const edge_k = edgeStep_k.value;
      posArr_k.push(edge_k.x, edge_k.y, edge_k.z);
    }
    uvArr_k.push(
      0, travelled_k / 8, 1, travelled_k / 8, 0, (spanLenPush_k => spanLenPush_k)(travelled_k + len_k) / 8, 1, (travelled_k + len_k) / 8,
    );
    idxArr_k.push(vertBase_k, 2 + vertBase_k, 1 + vertBase_k, 1 + vertBase_k, 2 + vertBase_k, 3 + vertBase_k);
    let midX_k;
    midX_k = (ptFrom_k.x + ptTo_k.x) / 2;
    let midZ_k;
    midZ_k = (ptFrom_k.z + ptTo_k.z) / 2;
    const distPlus_k = Math.hypot(5 * sideX_k + midX_k - hubPt_k.x, 5 * sideZ_k + midZ_k - hubPt_k.z);
    const distMinus_k = Math.hypot(midX_k - 5 * sideX_k - hubPt_k.x, midZ_k - 5 * sideZ_k - hubPt_k.z);
    let outerSign_k;
    if (distMinus_k > distPlus_k) outerSign_k = -1;
    else outerSign_k = 1;
    let outerFrom_k;
    if (0 < outerSign_k) outerFrom_k = edgeAPlus_k;
    else outerFrom_k = edgeAMinus_k;
    let outerTo_k;
    if (0 < outerSign_k) outerTo_k = edgeBPlus_k;
    else outerTo_k = edgeBMinus_k;
    const rail_k = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, len_k), railMat_k);
    rail_k.position.set(
      (outerFrom_k.x + outerTo_k.x) / 2, 0.55 + (outerFrom_k.y + outerTo_k.y) / 2, (outerFrom_k.z + outerTo_k.z) / 2,
    );
    rail_k.lookAt(outerTo_k.x, 0.55 + outerTo_k.y, outerTo_k.z);
    scene_k.add(rail_k);
    let postAt_k = 0;
    for (; len_k >= postAt_k;) {
      const frac_k = postAt_k / len_k;
      const postX_k = ptFrom_k.x + dx_k * frac_k + sideX_k * outerSign_k * (0.3 + roadW_k / 2);
      const postZ_k = ptFrom_k.z + dz_k * frac_k + sideZ_k * outerSign_k * (0.3 + roadW_k / 2);
      const postRec_k = {};
      postRec_k.z = postZ_k; postRec_k.x = postX_k; postRec_k.y = groundH(postX_k, postZ_k);
      postSpots_k.push(postRec_k);
      postAt_k += 8;
    }
    travelled_k += len_k;
    ++seg_k;
  }
  const ribbonGeo_k = new THREE.BufferGeometry();
  ribbonGeo_k.setAttribute('position', new THREE.Float32BufferAttribute(posArr_k, 3));
  ribbonGeo_k.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr_k, 2));
  ribbonGeo_k.setIndex(idxArr_k);
  ribbonGeo_k.computeVertexNormals();
  scene_k.add(new THREE.Mesh(ribbonGeo_k, asphaltMat_k));
  const postInst_k = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.62, 6), railMat_k, Math.max(1, postSpots_k.length),
  );
  {
    let mat4K;
    mat4K = new THREE.Matrix4();
    postSpots_k.forEach((post_k, postNo_k) => {
      mat4K.makeTranslation(post_k.x, 0.31 + post_k.y, post_k.z);
      postInst_k.setMatrixAt(postNo_k, mat4K);
    });
    postInst_k.instanceMatrix.needsUpdate = true;
  }
  scene_k.add(postInst_k);
  let tree_k = 0;
  for (; 12 > tree_k;) {
    const anchorPt_k = routePts_k[tree_k % routePts_k.length];
    const nextPt_k = routePts_k[Math.min(1 + tree_k, routePts_k.length - 1)];
    let stepDx_k;
    stepDx_k = nextPt_k.x - anchorPt_k.x;
    let stepDz_k;
    stepDz_k = nextPt_k.z - anchorPt_k.z;
    let stepLen_k;
    if (Math.hypot(stepDx_k, stepDz_k)) stepLen_k = Math.hypot(stepDx_k, stepDz_k);
    else stepLen_k = 1;
    let flank_k;
    if (0 === tree_k % 2) flank_k = 1;
    else flank_k = -1;
    const treeX_k = anchorPt_k.x + (-stepDz_k / stepLen_k) * flank_k * rr(10, 13);
    const treeZ_k = anchorPt_k.z + (stepDx_k / stepLen_k) * flank_k * rr(10, 13);
    const cherry_k = makeShadeTree(rr(3, 4.5), 0xe8a0bf);
    cherry_k.position.set(treeX_k, groundH(treeX_k, treeZ_k), treeZ_k);
    cherry_k.rotation.y = rr(0, 6.28);
    scene_k.add(cherry_k);
    ++tree_k;
  }
};

export const roadRoute = (G_k, fromPt_k, toPt_k) => {
  function snap_k(probe_k, roads_k) {
    return roads_k.reduce(
      (best_k, cand_k) => {
        if (Math.abs(best_k - probe_k) > Math.abs(cand_k - probe_k)) return cand_k;
        else return best_k;
      },
      roads_k[0],
    );
  }
  let fromSnapX_k;
  fromSnapX_k = snap_k(fromPt_k.x, G_k.roadX);
  let fromSnapZ_k;
  fromSnapZ_k = snap_k(fromPt_k.z, G_k.roadZ);
  let toSnapX_k;
  toSnapX_k = snap_k(toPt_k.x, G_k.roadX);
  let toSnapZ_k;
  toSnapZ_k = snap_k(toPt_k.z, G_k.roadZ);
  const routeRecA_k = {};
  routeRecA_k.x = fromPt_k.x; routeRecA_k.z = fromPt_k.z;
  const routeRecB_k = {};
  routeRecB_k.x = fromSnapX_k; routeRecB_k.z = fromPt_k.z;
  const routeRecC_k = {};
  routeRecC_k.x = fromSnapX_k; routeRecC_k.z = fromSnapZ_k;
  const route_k = [];
  route_k.push(routeRecA_k, routeRecB_k, routeRecC_k);
  const cornerA_k = {};
  cornerA_k.x = toSnapX_k; cornerA_k.z = fromSnapZ_k;
  const cornerB_k = {};
  cornerB_k.x = fromSnapX_k; cornerB_k.z = toSnapZ_k;
  const legSpanA_k = Math.abs(fromSnapX_k - toSnapX_k) + Math.abs(fromSnapZ_k - toSnapZ_k);
  const legSpanB_k = legSpanA_k;
  void legSpanB_k;
  const routeRecD_k = {};
  routeRecD_k.x = toSnapX_k; routeRecD_k.z = toSnapZ_k;
  const routeRecE_k = {};
  routeRecE_k.x = toPt_k.x; routeRecE_k.z = toPt_k.z;
  route_k.push(cornerA_k, routeRecD_k, routeRecE_k);
  void cornerB_k;
  return route_k.filter(
    (pt_k, ptNo_k) =>
      0 === ptNo_k ||
      1 < Math.hypot(pt_k.x - route_k[ptNo_k - 1].x, pt_k.z - route_k[ptNo_k - 1].z),
  );
};

const duskGlowApply = (G_k, neon_k, combined_k, signDark_k) => {
  if (G_k.buildingMats) {
    const matIter_k = G_k.buildingMats[Symbol.iterator]();
    let matStep_k;
    while (!(matStep_k = matIter_k.next()).done) {
      const matItem = matStep_k.value;
      matItem.emissiveIntensity = combined_k * 0.7;
    }
  }
  if (G_k.neonTrimMats) {
    const trimIter_k = G_k.neonTrimMats[Symbol.iterator]();
    let trimStep_k;
    while (!(trimStep_k = trimIter_k.next()).done) {
      const matItem = trimStep_k.value;
      matItem.emissiveIntensity = neon_k * 2.4;
    }
  }
  if (G_k.streetlightGlows) {
    const sprIter_k = G_k.streetlightGlows[Symbol.iterator]();
    let sprStep_k;
    while (!(sprStep_k = sprIter_k.next()).done) {
      const sprItem = sprStep_k.value;
      sprItem.material.opacity = combined_k * 0.85;
    }
  }
  G_k.lampHeadMat ? G_k.lampHeadMat.emissiveIntensity = 0.15 + 3.0 * combined_k : null;
  G_k.lampPoolMat ? G_k.lampPoolMat.opacity = combined_k * 0.3 : null;
  const glowIter_k = glowSpritesList[Symbol.iterator]();
  let glowStep_k;
  while (!(glowStep_k = glowIter_k.next()).done) {
    const sprItem = glowStep_k.value;
    sprItem.material.opacity = signDark_k * 0.9;
  }
};

export const updateWorld = (G_k, dt_k) => {
  let hr_k;
  hr_k = G_k.timeOfDay;
  let day_k;
  day_k = Math.min(1, Math.max(0, Math.sin(((hr_k - 6) / 12) * Math.PI)));
  let duskFlag_k;
  if (12 < hr_k) duskFlag_k = 1;
  else duskFlag_k = 0;
  const dusk_k =
    duskFlag_k * Math.max(0, 1 - Math.abs(hr_k - 18.2) / 1.6) +
    0.6 * Math.max(0, 1 - Math.abs(hr_k - 6.2) / 1.2);
  skyColorsCompute(hr_k);
  skyDome ? (() => {
    0.05 < Math.abs(hr_k - skyHourPrev) ? (() => {
      skyDomePaint();
      skyHourPrev = hr_k;
    })() : null;
  })() : G_k.scene.background = toneHorK;
  G_k.scene.fog ? G_k.scene.fog.color.copy(toneFogK) : null;
  if (G_k.sun) {
    G_k.sun.intensity = 1.27 * day_k + 0.25;
    G_k.sun.color.set(0xffd9b0);
    let sunAng_k;
    sunAng_k = ((hr_k - 6) / 12) * Math.PI;
    G_k.sun.position.set(300 * Math.cos(sunAng_k), Math.max(20, 300 * Math.sin(sunAng_k)), 120);
  }
  if (G_k.hemi) {
    G_k.hemi.intensity = 0.65 * day_k + 0.25;
    if (G_k.hemi.color) {
      const hemiCopy_k = G_k.hemi.color.copy(toneTopK);
      hemiCopy_k.lerp(toneWarmK, 0.3);
    }
    G_k.hemi.groundColor ? G_k.hemi.groundColor.set(0xb09a7a) : null;
  }
  const night_k = 1 - day_k;
  function ramp_k(lo_k, hi_k) {
    return Math.min(1, Math.max(0, (hr_k - lo_k) / Math.max(0.001, hi_k - lo_k)));
  }
  let duskGlow_k;
  if (24 > hr_k && hr_k >= VICE.dusk.onset)
    duskGlow_k = Math.max(ramp_k(VICE.dusk.onset, VICE.dusk.full), night_k);
  else duskGlow_k = night_k;
  let neonGlow_k;
  if (24 > hr_k && hr_k >= VICE.dusk.neonOnset)
    neonGlow_k = Math.max(ramp_k(VICE.dusk.neonOnset, VICE.dusk.full), night_k);
  else neonGlow_k = night_k;
  const combined_k = Math.max(duskGlow_k, night_k);
  const signDark_k = Math.min(1, combined_k * 0.9 + 0.35 * Math.min(1, Math.max(0, dusk_k)));
  duskGlowApply(G_k, neonGlow_k, combined_k, signDark_k);
  if (G_k.water) {
    let elapsedVal_k;
    if (G_k.elapsed) elapsedVal_k = G_k.elapsed;
    else elapsedVal_k = 0;
    const sway_k = Math.sin(elapsedVal_k) * 0.03;
    G_k.water.position.y = sway_k - 0.4;
  }
};
