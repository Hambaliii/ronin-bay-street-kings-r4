import * as THREE from 'three';
// When a hero model finishes loading it takes the place of
// the procedural build; a model that never shows up leaves
// that fallback exactly as it was
// No loader addon comes with the vendored three, so the GLB
// reader below is hand written: it walks the JSON and BIN
// chunks and reads generic accessors over float and integer
// kinds, from scalar through four wide vectors, honouring
// stride and carrying one embedded image with it
// Anything past that support throws, and the loading layer
// turns a throw into null so callers keep their fallback
// To register a fresh asset later: drop the file into the
// assets folder, add it below, and ask for it where the
// procedural build gets made
// The parsing half comes first and never touches rendering
const WIDTH_BY_TYPE = {};
WIDTH_BY_TYPE.SCALAR = 1;
WIDTH_BY_TYPE.VEC2 = 2;
WIDTH_BY_TYPE.VEC3 = 3;
WIDTH_BY_TYPE.VEC4 = 4;
const MAGIC_AT_HEAD = 0x46546c67;
const KIND_BY_COMPONENT = {
  5121: { bytes: 1, get: 'getUint8', Array: Uint8Array },
  5123: { bytes: 2, get: 'getUint16', Array: Uint16Array },
  5125: { bytes: 4, get: 'getUint32', Array: Uint32Array },
  5126: { bytes: 4, get: 'getFloat32', Array: Float32Array },
};
function walkChunks(dvIn, rawIn, limitLen) {
  const foundHeld = { docHeld: null, binStart: -1, binSize: 0 };
  let walkPos = 12;
  while (!(walkPos + 8 > limitLen)) {
    const lenHere = dvIn.getUint32(walkPos, true);
    const typeHere = dvIn.getUint32(walkPos + 4, true);
    const dataAt = walkPos + 8;
    const overrunHere = (lenHere < 0) || (limitLen < (dataAt + lenHere));
    if (overrunHere)
      throw new Error('GLB: chunk out of bounds');
    if (typeHere === 0x4e4f534a) {
      const bytesHere = new Uint8Array(rawIn, dataAt, lenHere);
      foundHeld.docHeld = JSON.parse(new TextDecoder('utf-8').decode(bytesHere));
    } else if (typeHere === 0x004e4942) { foundHeld.binStart = dataAt; foundHeld.binSize = lenHere; }
    walkPos = dataAt + lenHere; }
  return foundHeld; }
function verifyHeader(rawIn, dvIn) {
  const headerShort = (!rawIn) || !(rawIn.byteLength >= 20);
  if (headerShort)
    throw new Error('GLB: too small');
  const magicHere = dvIn.getUint32(0, true);
  if (!(magicHere === MAGIC_AT_HEAD)) throw new Error('GLB: bad magic');
  const versionHere = dvIn.getUint32(4, true);
  if (versionHere !== 2) throw new Error('GLB: not version 2');
  const declaredHere = dvIn.getUint32(8, true);
  if (rawIn.byteLength < declaredHere) throw new Error('GLB: length exceeds buffer');
  return declaredHere; }
export function parseGLB(rawIn) {
  const dvIn = new DataView(rawIn);
  const limitLen = verifyHeader(rawIn, dvIn);
  const walked = walkChunks(dvIn, rawIn, limitLen);
  const docHeld = walked.docHeld;
  if (!docHeld) throw new Error('GLB: no JSON chunk');
  if (!(walked.binStart >= 0)) throw new Error('GLB: no BIN chunk');
  const viewsMissing = !Array.isArray(docHeld.bufferViews);
  const accessorsMissing = !Array.isArray(docHeld.accessors);
  if (viewsMissing || accessorsMissing) throw new Error('GLB: missing accessors/bufferViews');
  function spanOf(accHeld, viewHeld, elemSize, strideHeld) {
    const startHere = walked.binStart + ((viewHeld.byteOffset || 0) + (accHeld.byteOffset || 0));
    const tailHere = (accHeld.count > 0) ? (elemSize + ((accHeld.count - 1) * strideHeld)) : 0;
    const binEndHere = walked.binStart + walked.binSize;
    const startsEarly = startHere < walked.binStart;
    const endsLate = binEndHere < (startHere + tailHere);
    if (startsEarly || endsLate)
      throw new Error('GLB: accessor out of range');
    const viewOverflow = (viewHeld.byteLength !== undefined) && (viewHeld.byteLength < ((accHeld.byteOffset || 0) + tailHere));
    if (viewOverflow)
      throw new Error('GLB: accessor exceeds bufferView');
    return { startHere: startHere, tailHere: tailHere }; }
  function resolveAccessor(idxHeld) {
    const accHeld = docHeld.accessors[idxHeld];
    if (!accHeld) throw new Error('GLB: accessor missing');
    const kindHeld = KIND_BY_COMPONENT[accHeld.componentType];
    const widthHeld = WIDTH_BY_TYPE[accHeld.type];
    if (!kindHeld || !widthHeld)
      throw new Error('GLB: unsupported accessor type');
    const viewIdx = accHeld.bufferView ?? 0;
    const viewHeld = docHeld.bufferViews[viewIdx];
    const viewBad = !viewHeld || ((viewHeld.buffer ?? 0) !== 0);
    if (viewBad)
      throw new Error('GLB: unsupported bufferView');
    const packedSize = kindHeld.bytes * widthHeld;
    const strideHeld = viewHeld.byteStride || packedSize;
    if (packedSize > strideHeld) throw new Error('GLB: bad byteStride');
    const spanHeld = spanOf(accHeld, viewHeld, packedSize, strideHeld);
    return { accHeld: accHeld, kindHeld: kindHeld, widthHeld: widthHeld, strideHeld: strideHeld, spanHeld: spanHeld }; }
  function readAccessor(idxHeld) {
    const resolvedHeld = resolveAccessor(idxHeld);
    const valuesHeld = new resolvedHeld.kindHeld.Array(resolvedHeld.accHeld.count * resolvedHeld.widthHeld);
    for (let elemPos = 0; elemPos < resolvedHeld.accHeld.count; elemPos++) {
      const baseHere = resolvedHeld.spanHeld.startHere + (elemPos * resolvedHeld.strideHeld);
      for (let partPos = 0; partPos < resolvedHeld.widthHeld; partPos++) {
        const readHere = baseHere + (partPos * resolvedHeld.kindHeld.bytes);
        valuesHeld[(elemPos * resolvedHeld.widthHeld) + partPos] = dvIn[resolvedHeld.kindHeld.get](readHere, true); } }
    return valuesHeld; }
  function geometryFrom(primHeld) {
    const attrsHeld = primHeld.attributes || {};
    if (attrsHeld.POSITION === undefined)
      throw new Error('GLB: primitive without POSITION');
    const geoHeld = {};
    geoHeld.position = readAccessor(attrsHeld.POSITION);
    geoHeld.normal = (attrsHeld.NORMAL !== undefined) ? readAccessor(attrsHeld.NORMAL) : null;
    geoHeld.uv = (attrsHeld.TEXCOORD_0 !== undefined) ? readAccessor(attrsHeld.TEXCOORD_0) : null;
    geoHeld.index = (primHeld.indices !== undefined) ? readAccessor(primHeld.indices) : null;
    return geoHeld; }
  const geometriesHeld = [];
  const meshListHeld = docHeld.meshes || [];
  meshListHeld.forEach((meshHeld) => {
    const primListHeld = meshHeld.primitives || [];
    primListHeld.forEach((primHeld) => geometriesHeld.push(geometryFrom(primHeld))); });
  if (!(geometriesHeld.length > 0)) throw new Error('GLB: no geometry');
  function imageFromDoc() {
    const imagesHeld = docHeld.images || [];
    const [leadImage] = imagesHeld;
    if (!leadImage || (leadImage.bufferView === undefined)) return null;
    const imageView = docHeld.bufferViews[leadImage.bufferView];
    const imageViewBad = !imageView || ((imageView.buffer ?? 0) !== 0);
    if (imageViewBad)
      throw new Error('GLB: unsupported image bufferView');
    const imageAt = walked.binStart + (imageView.byteOffset || 0);
    const imageEarly = imageAt < walked.binStart;
    const binEndHere = walked.binStart + walked.binSize;
    const imageLate = binEndHere < (imageAt + imageView.byteLength);
    if (imageEarly || imageLate)
      throw new Error('GLB: image out of range');
    const imageBytes = new Uint8Array(rawIn, imageAt, imageView.byteLength).slice();
    return { mime: (leadImage.mimeType || 'image/jpeg'), bytes: imageBytes }; }
  return { geometries: geometriesHeld, image: imageFromDoc() }; }

// From parsed data to scene models, the second half
async function requestBytes(urlIn, signalIn) {
  const responseHeld = await fetch(urlIn, { signal: signalIn });
  return (!responseHeld.ok) ? null : (await responseHeld.arrayBuffer()); }
async function buildTexture(imageHeld) {
  try {
    const blobHeld = new Blob([imageHeld.bytes], { type: imageHeld.mime });
    const texHeld = await new THREE.TextureLoader().loadAsync(URL.createObjectURL(blobHeld));
    if (texHeld) { texHeld.flipY = false; texHeld.colorSpace = THREE.SRGBColorSpace; }
    return texHeld;
  } catch (swallowed) { return null; } }
function buildMaterial(texHeld) {
  const specHeld = {};
  specHeld.yes = { map: texHeld, roughness: 0.9, metalness: 0 };
  specHeld.no = { color: 0xb8bcc2, roughness: 0.9, metalness: 0 };
  return new THREE.MeshStandardMaterial(texHeld ? specHeld.yes : specHeld.no); }
function buildMesh(geoHeld, materialHeld) {
  const bufferGeo = new THREE.BufferGeometry();
  const planHeld = [];
  planHeld.push(['position', geoHeld.position, 3]);
  if (geoHeld.normal) planHeld.push(['normal', geoHeld.normal, 3]);
  if (geoHeld.uv) planHeld.push(['uv', geoHeld.uv, 2]);
  for (const [nameHeld, dataHeld, widthHeld] of planHeld) {
    bufferGeo.setAttribute(nameHeld, new THREE.BufferAttribute(dataHeld, widthHeld)); }
  if (geoHeld.index) bufferGeo.setIndex(new THREE.BufferAttribute(geoHeld.index, 1));
  if (!geoHeld.normal) bufferGeo.computeVertexNormals();
  return new THREE.Mesh(bufferGeo, materialHeld); }
export async function loadGLBModel(urlIn) {
  try {
    const ctlHeld = new AbortController();
    const timerHeld = setTimeout(() => ctlHeld.abort(), 8000);
    let bodyHeld;
    try { bodyHeld = await requestBytes(urlIn, ctlHeld.signal);
    } finally { clearTimeout(timerHeld); }
    if (!bodyHeld) return null;
    const parsedHeld = parseGLB(bodyHeld);
    const texHeld = parsedHeld.image ? await buildTexture(parsedHeld.image) : null;
    const materialHeld = buildMaterial(texHeld);
    const groupHeld = new THREE.Group();
    parsedHeld.geometries.forEach((geoHeld) => { groupHeld.add(buildMesh(geoHeld, materialHeld)); });
    return groupHeld;
  } catch (swallowed) { return null; } }
// The hero asset registry, assembled with one assign
export const HERO_ASSETS = {};
Object.assign(HERO_ASSETS, {
  helicopter: { url: 'assets/helicopter.glb', scale: 11 },
  garage: { url: 'assets/garage.glb', targetSize: { x: 30, y: 15, z: 30 } },
  heroCar: { url: 'assets/hero-car.glb', targetSize: { x: 1.81, y: 1.275, z: 4.51 } },
  npcPolice: { url: 'assets/npc-police.glb', targetSize: { x: 1.82, y: 1.42, z: 4.85 } },
  npcSedan: { url: 'assets/npc-sedan.glb', targetSize: { x: 4.75, y: 1.45, z: 1.80 } },
  npcTaxi: { url: 'assets/npc-taxi.glb', targetSize: { x: 1.82, y: 1.50, z: 4.80 } },
  npcVespa: { url: 'assets/npc-vespa.glb', targetSize: { x: 0.75, y: 1.55, z: 1.95 } },
  npcSportbike: { url: 'assets/npc-sportbike.glb', targetSize: { x: 2.05, y: 1.15, z: 0.80 } },
  gtr35: { url: 'assets/gtr35.glb', targetSize: { x: 1.89, y: 1.36, z: 4.71 } },
  lamboSvj: { url: 'assets/lambo-svj.glb', targetSize: { x: 2.10, y: 1.14, z: 4.94 } },
  mc: { url: 'assets/mc-ren.glb', scale: 1.78 },
  rivalDriver: { url: 'assets/rival-driver.glb', scale: 1.80 },
  policeOfficer: { url: 'assets/police-officer.glb', scale: 1.78 },
  citizenWoman: { url: 'assets/citizen-woman.glb', scale: 1.68 },
  citizenTeen: { url: 'assets/citizen-teen.glb', scale: 1.62 },
  citizenTeen2: { url: 'assets/citizen-teen2.glb', scale: 1.62 },
  citizenOffice: { url: 'assets/citizen-office.glb', scale: 1.76 },
  weaponPistol: { url: 'assets/weapon-pistol.glb', scale: 0.30 },
  weaponSmg: { url: 'assets/weapon-smg.glb', scale: 0.55 },
  weaponBat: { url: 'assets/weapon-bat.glb', scale: 0.72 },
});
const pendingByName = new Map();
// One registered asset is fetched and returned as a wrapper
// group scaled into game units, origin on the model origin
// Scaling goes one of two ways: a plain uniform scale, or a
// per axis target size worked out from the unwrapped bounds
// so the model lands at exact metre dimensions
// Failures resolve null, and results cache by name so repeat
// callers share a single fetch and a single wrapper
function ratioForAxis(targetHeld, boundsHeld) {
  const usableHeld = boundsHeld > 0;
  return usableHeld ? (targetHeld / boundsHeld) : 1; }
function scaleWrapToTarget(wrapHeld, modelHeld, targetHeld) {
  const boxHeld = new THREE.Box3().setFromObject(modelHeld);
  const sizeHeld = boxHeld.getSize(new THREE.Vector3());
  wrapHeld.scale.set(ratioForAxis(targetHeld.x, sizeHeld.x), ratioForAxis(targetHeld.y, sizeHeld.y), ratioForAxis(targetHeld.z, sizeHeld.z)); }
function wrapModel(modelHeld, entryHeld) {
  const wrapHeld = new THREE.Group();
  if (entryHeld.targetSize) scaleWrapToTarget(wrapHeld, modelHeld, entryHeld.targetSize);
  else { wrapHeld.scale.setScalar(entryHeld.scale || 1); }
  wrapHeld.add(modelHeld);
  return wrapHeld; }
async function loadEntryOnce(nameHeld, entryHeld) {
  let modelHeld = await loadGLBModel(entryHeld.url);
  if (!modelHeld) modelHeld = await loadGLBModel(entryHeld.url);
  if (!modelHeld) { pendingByName.delete(nameHeld); return null; }
  const wrappedHeld = wrapModel(modelHeld, entryHeld);
  wrappedHeld.name = 'hero:' + nameHeld;
  return wrappedHeld; }
export async function loadHeroAsset(nameHeld) {
  const entryHeld = HERO_ASSETS[nameHeld];
  if (!entryHeld) return null;
  if (!pendingByName.has(nameHeld)) {
    const promiseHeld = loadEntryOnce(nameHeld, entryHeld).catch(() => null);
    pendingByName.set(nameHeld, promiseHeld); }
  return pendingByName.get(nameHeld); }
// Eager loading and the readiness gate
// Each registry entry begins loading the moment this module
// evaluates, so every swap races from the same starting
// moment rather than from whenever a caller happens to ask,
// and fallbacks stay unaffected because failures give null
function kickOffLoads() {
  for (const keyHeld of Object.keys(HERO_ASSETS)) {
    try { loadHeroAsset(keyHeld); } catch (swallowed) { /* the procedural fallback stays in place */ } } }
kickOffLoads();
export const heroAssetsReady = Promise.allSettled([...pendingByName.values()]);
export function whenHeroAssetsReady() {
  kickOffLoads();
  return Promise.allSettled(Array.from(pendingByName.values())); }
