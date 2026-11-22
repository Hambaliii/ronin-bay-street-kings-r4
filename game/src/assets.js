import * as THREE from 'three';

// ---------------------------------------------------------------- assets.js
// Hero-asset system: real GLB models (Tripo etc.) that replace procedural
// builds, with the procedural version kept as the automatic fallback.
// No GLTFLoader addon ships with the repo, so parseGLB below is a minimal,
// bounds-checked GLB v2 reader: JSON + BIN chunks, generic accessors
// (float32 / uint16 / uint32, SCALAR/VEC2/VEC3/VEC4, byteStride respected),
// one embedded image. Anything unsupported throws — loadGLBModel catches
// and returns null, and callers keep the procedural visual.
//
// To add a future hero asset (hero car, main character, garage landmark):
// drop the .glb in game/assets/, add one HERO_ASSETS entry, and call
// loadHeroAsset('<name>') where the procedural build is created.

// --- GLB parsing (pure — no three.js usage) ----------------------------------

const COMP = {
  5121: { bytes: 1, get: 'getUint8', Array: Uint8Array },
  5123: { bytes: 2, get: 'getUint16', Array: Uint16Array },
  5125: { bytes: 4, get: 'getUint32', Array: Uint32Array },
  5126: { bytes: 4, get: 'getFloat32', Array: Float32Array },
};
const TYPE_COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function parseGLB(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 20) throw new Error('GLB: too small');
  const dv = new DataView(arrayBuffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('GLB: bad magic'); // 'glTF'
  if (dv.getUint32(4, true) !== 2) throw new Error('GLB: not version 2');
  const totalLen = dv.getUint32(8, true);
  if (totalLen > arrayBuffer.byteLength) throw new Error('GLB: length exceeds buffer');

  let json = null;
  let binStart = -1;
  let binLen = 0;
  let off = 12;
  while (off + 8 <= totalLen) {
    const chunkLen = dv.getUint32(off, true);
    const chunkType = dv.getUint32(off + 4, true);
    const dataStart = off + 8;
    if (chunkLen < 0 || dataStart + chunkLen > totalLen) throw new Error('GLB: chunk out of bounds');
    if (chunkType === 0x4e4f534a) { // 'JSON'
      json = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer, dataStart, chunkLen)));
    } else if (chunkType === 0x004e4942) { // 'BIN\0'
      binStart = dataStart;
      binLen = chunkLen;
    }
    off = dataStart + chunkLen;
  }
  if (!json) throw new Error('GLB: no JSON chunk');
  if (binStart < 0) throw new Error('GLB: no BIN chunk');
  if (!Array.isArray(json.accessors) || !Array.isArray(json.bufferViews)) {
    throw new Error('GLB: missing accessors/bufferViews');
  }

  function readAccessor(index) {
    const acc = json.accessors[index];
    if (!acc) throw new Error('GLB: accessor missing');
    const comp = COMP[acc.componentType];
    const nComp = TYPE_COMPS[acc.type];
    if (!comp || !nComp) throw new Error('GLB: unsupported accessor type');
    const bv = json.bufferViews[acc.bufferView ?? 0];
    if (!bv || (bv.buffer ?? 0) !== 0) throw new Error('GLB: unsupported bufferView');
    const packed = comp.bytes * nComp;
    const stride = bv.byteStride || packed;
    if (stride < packed) throw new Error('GLB: bad byteStride');
    const base = binStart + (bv.byteOffset || 0) + (acc.byteOffset || 0);
    const span = acc.count > 0 ? (acc.count - 1) * stride + packed : 0;
    if (base < binStart || base + span > binStart + binLen) throw new Error('GLB: accessor out of range');
    if (bv.byteLength !== undefined && (acc.byteOffset || 0) + span > bv.byteLength) {
      throw new Error('GLB: accessor exceeds bufferView');
    }
    const out = new comp.Array(acc.count * nComp);
    for (let i = 0; i < acc.count; i++) {
      const o = base + i * stride;
      for (let c = 0; c < nComp; c++) out[i * nComp + c] = dv[comp.get](o + c * comp.bytes, true);
    }
    return out;
  }

  const geometries = [];
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      const attrs = prim.attributes || {};
      if (attrs.POSITION === undefined) throw new Error('GLB: primitive without POSITION');
      geometries.push({
        position: readAccessor(attrs.POSITION),
        normal: attrs.NORMAL !== undefined ? readAccessor(attrs.NORMAL) : null,
        uv: attrs.TEXCOORD_0 !== undefined ? readAccessor(attrs.TEXCOORD_0) : null,
        index: prim.indices !== undefined ? readAccessor(prim.indices) : null,
      });
    }
  }
  if (!geometries.length) throw new Error('GLB: no geometry');

  let image = null;
  const img = (json.images || [])[0];
  if (img && img.bufferView !== undefined) {
    const bv = json.bufferViews[img.bufferView];
    if (!bv || (bv.buffer ?? 0) !== 0) throw new Error('GLB: unsupported image bufferView');
    const start = binStart + (bv.byteOffset || 0);
    if (start < binStart || start + bv.byteLength > binStart + binLen) {
      throw new Error('GLB: image out of range');
    }
    image = {
      mime: img.mimeType || 'image/jpeg',
      bytes: new Uint8Array(arrayBuffer, start, bv.byteLength).slice(),
    };
  }
  return { geometries, image };
}

// --- three.js model building ---------------------------------------------------

export async function loadGLBModel(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let buf;
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      buf = await res.arrayBuffer();
    } finally {
      clearTimeout(timer);
    }
    const parsed = parseGLB(buf);

    let texture = null;
    if (parsed.image) {
      try {
        const blob = new Blob([parsed.image.bytes], { type: parsed.image.mime });
        texture = await new THREE.TextureLoader().loadAsync(URL.createObjectURL(blob));
        if (texture) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.flipY = false; // glTF UVs assume flipY=false (TextureLoader defaults true)
        }
      } catch (e) { texture = null; }
    }
    const material = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 })
      : new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.9, metalness: 0 });

    const group = new THREE.Group();
    for (const g of parsed.geometries) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.position, 3));
      if (g.normal) geo.setAttribute('normal', new THREE.BufferAttribute(g.normal, 3));
      if (g.uv) geo.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
      if (g.index) geo.setIndex(new THREE.BufferAttribute(g.index, 1));
      if (!g.normal) geo.computeVertexNormals();
      group.add(new THREE.Mesh(geo, material));
    }
    return group;
  } catch (e) {
    return null; // any failure -> caller keeps the procedural fallback
  }
}

// --- registry ------------------------------------------------------------------

export const HERO_ASSETS = {
  helicopter: { url: 'assets/helicopter.glb', scale: 11 },
  heroCar: { url: 'assets/hero-car.glb', targetSize: { x: 1.81, y: 1.275, z: 4.51 } },
  npcPolice: { url: 'assets/npc-police.glb', targetSize: { x: 1.82, y: 1.42, z: 4.85 } },
  npcSedan: { url: 'assets/npc-sedan.glb', targetSize: { x: 4.75, y: 1.45, z: 1.80 } },
  npcTaxi: { url: 'assets/npc-taxi.glb', targetSize: { x: 1.82, y: 1.50, z: 4.80 } },
  npcVespa: { url: 'assets/npc-vespa.glb', targetSize: { x: 0.75, y: 1.55, z: 1.95 } },
  gtr35: { url: 'assets/gtr35.glb', targetSize: { x: 1.89, y: 1.36, z: 4.71 } },
  mc: { url: 'assets/mc-ren.glb', scale: 1.78 },
  rivalDriver: { url: 'assets/rival-driver.glb', scale: 1.80 },
  garage: { url: 'assets/garage.glb', targetSize: { x: 30, y: 15, z: 30 } },
  citizenWoman: { url: 'assets/citizen-woman.glb', scale: 1.68 },
  // Untextured GLB (POSITION+NORMAL only, no UVs/material/image): parseGLB
  // returns uv:null, loadGLBModel skips the uv attribute and uses the plain
  // no-map material; peds.js tints each clone per-ped instead.
  citizenTeen: { url: 'assets/citizen-teen.glb', scale: 1.62 },
  // Textured GLB (face + dark hoodie + backpack baked in): peds.js uses it
  // as the primary teen — its clones keep the model's own texture, no tint.
  citizenTeen2: { url: 'assets/citizen-teen2.glb', scale: 1.62 },
  citizenOffice: { url: 'assets/citizen-office.glb', scale: 1.76 },
  weaponPistol: { url: 'assets/weapon-pistol.glb', scale: 0.30 },
  weaponSmg: { url: 'assets/weapon-smg.glb', scale: 0.55 },
  weaponBat: { url: 'assets/weapon-bat.glb', scale: 0.72 },
};

const _heroCache = new Map();

// Loads a registered hero asset and wraps it in a Group scaled into game
// units (wrapper origin = model origin). Two scaling modes:
//  - entry.scale: uniform scalar (helicopter).
//  - entry.targetSize {x,y,z}: per-axis scale so the model's local bbox
//    (measured on the UNWRAPPED model) lands exactly on the target size in
//    metres — needed for stylized models whose proportions are off.
// Resolves null on any failure. Cached per name: repeat calls share one
// fetch and one wrapper instance.
export async function loadHeroAsset(name) {
  const entry = HERO_ASSETS[name];
  if (!entry) return null;
  if (!_heroCache.has(name)) {
    const p = (async () => {
      const model = await loadGLBModel(entry.url);
      if (!model) return null;
      const wrapper = new THREE.Group();
      wrapper.name = 'hero:' + name;
      if (entry.targetSize) {
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        wrapper.scale.set(
          size.x > 0 ? entry.targetSize.x / size.x : 1,
          size.y > 0 ? entry.targetSize.y / size.y : 1,
          size.z > 0 ? entry.targetSize.z / size.z : 1
        );
      } else {
        wrapper.scale.setScalar(entry.scale || 1);
      }
      wrapper.add(model);
      return wrapper;
    })().catch(() => null);
    _heroCache.set(name, p);
  }
  return _heroCache.get(name);
}
