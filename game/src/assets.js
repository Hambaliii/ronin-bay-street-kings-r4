import * as THREE from 'three';
// Hero models swap in for the procedural builds whenever one
// finishes loading, and a model that never arrives leaves the
// procedural visual exactly as it was
// The game ships no loader addon, so the GLB reader below is
// hand rolled: it walks the JSON and BIN chunks and reads
// generic accessors across float and integer kinds, from scalar
// up to four wide vectors, honouring stride and carrying one
// embedded image along
// Anything outside that support throws, and the loading layer
// converts a throw into null so callers keep their fallback
// To add an asset later, drop the file into the assets folder,
// register it below, and request it where the procedural build
// gets created
// Parsing comes first in this file and never touches the renderer
const WIDTH_BY_TYPE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const GLB_MAGIC = 0x46546c67;
const KIND_BY_COMPONENT = {};
KIND_BY_COMPONENT[5121] = { bytes: 1, get: 'getUint8', Array: Uint8Array };
KIND_BY_COMPONENT[5123] = { bytes: 2, get: 'getUint16', Array: Uint16Array };
KIND_BY_COMPONENT[5125] = { bytes: 4, get: 'getUint32', Array: Uint32Array };
KIND_BY_COMPONENT[5126] = { bytes: 4, get: 'getFloat32', Array: Float32Array };
function headMagicDiffers(viewGiven) {
  const headNow = viewGiven.getUint32(0, true);
  const differsNow = !(headNow === GLB_MAGIC);
  return differsNow; }
function scanChunks(viewGiven, bufferGiven, totalGiven) {
  let jsonFound = null; let binAt = -1; let binSize = 0;
  let cursorNow = 12;
  while (!(cursorNow + 8 > totalGiven)) {
    const lenChunk = viewGiven.getUint32(cursorNow, true);
    const typeChunk = viewGiven.getUint32((cursorNow + 4), true);
    const payloadNow = (cursorNow + 8);
    const chunkBad = (lenChunk < 0) || (totalGiven < (payloadNow + lenChunk));
    if (chunkBad) throw new Error('GLB: chunk out of bounds');
    if (typeChunk === 0x4e4f534a) {
      const rawBytes = new Uint8Array(bufferGiven, payloadNow, lenChunk);
      jsonFound = JSON.parse(new TextDecoder('utf-8').decode(rawBytes));
    } else if (typeChunk === 0x004e4942) { binAt = payloadNow; binSize = lenChunk; }
    cursorNow = (payloadNow + lenChunk); }
  const scanOut = { jsonDoc: jsonFound, binaryAt: binAt, binarySize: binSize };
  return scanOut; }
export function parseGLB(bufferGiven) {
  const tooSmall = (!bufferGiven) || !(bufferGiven.byteLength >= 20);
  if (tooSmall) throw new Error('GLB: too small');
  const viewGiven = new DataView(bufferGiven);
  if (headMagicDiffers(viewGiven)) throw new Error('GLB: bad magic');
  const versionNow = viewGiven.getUint32(4, true);
  if (versionNow !== 2) throw new Error('GLB: not version 2');
  const declaredNow = viewGiven.getUint32(8, true);
  if (bufferGiven.byteLength < declaredNow) throw new Error('GLB: length exceeds buffer');
  const scanNow = scanChunks(viewGiven, bufferGiven, declaredNow);
  const docNow = scanNow.jsonDoc;
  if (!docNow) throw new Error('GLB: no JSON chunk');
  if (!(scanNow.binaryAt >= 0)) throw new Error('GLB: no BIN chunk');
  const viewsAbsent = !Array.isArray(docNow.bufferViews);
  const accessorsAbsent = !Array.isArray(docNow.accessors);
  if (viewsAbsent || accessorsAbsent) throw new Error('GLB: missing accessors/bufferViews');
  function checkSpan(accGiven, vwGiven, elemBytes, strideGiven) {
    const firstByte = (scanNow.binaryAt + ((vwGiven.byteOffset || 0) + (accGiven.byteOffset || 0)));
    const tailBytes = (accGiven.count > 0) ? (elemBytes + ((accGiven.count - 1) * strideGiven)) : 0;
    const startsBefore = (firstByte < scanNow.binaryAt);
    const binEnd = (scanNow.binaryAt + scanNow.binarySize);
    const endsAfter = (binEnd < (firstByte + tailBytes));
    if (startsBefore || endsAfter) throw new Error('GLB: accessor out of range');
    const vwOverflow = (vwGiven.byteLength !== undefined) && (vwGiven.byteLength < ((accGiven.byteOffset || 0) + tailBytes));
    if (vwOverflow) throw new Error('GLB: accessor exceeds bufferView');
    const spanOut = { startByte: firstByte, spanTotal: tailBytes };
    return spanOut; }
  function readAccessor(accIndex) {
    const accGiven = docNow.accessors[accIndex];
    if (!accGiven) throw new Error('GLB: accessor missing');
    const kindNow = KIND_BY_COMPONENT[accGiven.componentType];
    const widthNow = WIDTH_BY_TYPE[accGiven.type];
    if (!kindNow || !widthNow) throw new Error('GLB: unsupported accessor type');
    const vwIndex = (accGiven.bufferView ?? 0);
    const vwGiven = docNow.bufferViews[vwIndex];
    const vwBad = !vwGiven || ((vwGiven.buffer ?? 0) !== 0);
    if (vwBad) throw new Error('GLB: unsupported bufferView');
    const packedNow = (kindNow.bytes * widthNow);
    const strideNow = (vwGiven.byteStride || packedNow);
    if (packedNow > strideNow) throw new Error('GLB: bad byteStride');
    const spanNow = checkSpan(accGiven, vwGiven, packedNow, strideNow);
    const valuesOut = new kindNow.Array(accGiven.count * widthNow);
    let elemIdx = 0;
    while (elemIdx < accGiven.count) {
      const elemBase = (spanNow.startByte + (elemIdx * strideNow));
      let partIdx = 0;
      while (partIdx < widthNow) {
        const readAt = (elemBase + (partIdx * kindNow.bytes));
        valuesOut[(elemIdx * widthNow) + partIdx] = viewGiven[kindNow.get](readAt, true);
        partIdx++; }
      elemIdx++; }
    return valuesOut; }
  function geometryOf(primGiven) {
    const attrsNow = (primGiven.attributes || {});
    if (attrsNow.POSITION === undefined) throw new Error('GLB: primitive without POSITION');
    const geoOut = {};
    geoOut.position = readAccessor(attrsNow.POSITION);
    geoOut.normal = (attrsNow.NORMAL !== undefined) ? readAccessor(attrsNow.NORMAL) : null;
    geoOut.uv = (attrsNow.TEXCOORD_0 !== undefined) ? readAccessor(attrsNow.TEXCOORD_0) : null;
    geoOut.index = (primGiven.indices !== undefined) ? readAccessor(primGiven.indices) : null;
    return geoOut; }
  const geoList = [];
  (docNow.meshes || []).forEach((meshGiven) => {
    (meshGiven.primitives || []).forEach((primGiven) => geoList.push(geometryOf(primGiven))); });
  if (!(geoList.length > 0)) throw new Error('GLB: no geometry');
  function embeddedImage() {
    const imageList = (docNow.images || []);
    const [leadImage] = imageList;
    if (!leadImage || (leadImage.bufferView === undefined)) return null;
    const imgView = docNow.bufferViews[leadImage.bufferView];
    const imgViewBad = !imgView || ((imgView.buffer ?? 0) !== 0);
    if (imgViewBad) throw new Error('GLB: unsupported image bufferView');
    const imgAt = (scanNow.binaryAt + (imgView.byteOffset || 0));
    const imgEarly = (imgAt < scanNow.binaryAt);
    const imgEnd = (scanNow.binaryAt + scanNow.binarySize);
    const imgLate = (imgEnd < (imgAt + imgView.byteLength));
    if (imgEarly || imgLate) throw new Error('GLB: image out of range');
    const imgBytes = new Uint8Array(bufferGiven, imgAt, imgView.byteLength).slice();
    const imgOut = { mime: (leadImage.mimeType || 'image/jpeg'), bytes: imgBytes };
    return imgOut; }
  const parseOut = { geometries: geoList, image: embeddedImage() };
  return parseOut; }
// From parsed data to scene models
async function fetchBody(urlGiven, signalGiven) {
  const responseNow = await fetch(urlGiven, { signal: signalGiven });
  const responseBad = !responseNow.ok;
  if (responseBad) return null;
  const bodyNow = await responseNow.arrayBuffer();
  return bodyNow; }
async function textureOf(imageGiven) {
  try {
    const blobNow = new Blob([imageGiven.bytes], { type: imageGiven.mime });
    const texNow = await new THREE.TextureLoader().loadAsync(URL.createObjectURL(blobNow));
    if (texNow) { texNow.flipY = false; texNow.colorSpace = THREE.SRGBColorSpace; }
    return texNow;
  } catch (ignoredFault) { return null; } }
function materialOf(texGiven) {
  const specTextured = { map: texGiven, roughness: 0.9, metalness: 0 };
  const specPlain = { color: 0xb8bcc2, roughness: 0.9, metalness: 0 };
  const materialOut = new THREE.MeshStandardMaterial(texGiven ? specTextured : specPlain);
  return materialOut; }
function meshOf(geoGiven, materialGiven) {
  const geoNow = new THREE.BufferGeometry();
  const attrPlan = [['position', geoGiven.position, 3]];
  if (geoGiven.normal) attrPlan.push(['normal', geoGiven.normal, 3]);
  if (geoGiven.uv) attrPlan.push(['uv', geoGiven.uv, 2]);
  attrPlan.forEach(([attrName, attrData, attrWidth]) => {
    geoNow.setAttribute(attrName, new THREE.BufferAttribute(attrData, attrWidth)); });
  if (geoGiven.index) geoNow.setIndex(new THREE.BufferAttribute(geoGiven.index, 1));
  if (!geoGiven.normal) geoNow.computeVertexNormals();
  const meshOut = new THREE.Mesh(geoNow, materialGiven);
  return meshOut; }
export async function loadGLBModel(urlGiven) {
  try {
    const abortCtl = new AbortController();
    const abortHandle = setTimeout(() => abortCtl.abort(), 8000);
    let bodyFetched;
    try { bodyFetched = await fetchBody(urlGiven, abortCtl.signal);
    } finally { clearTimeout(abortHandle); }
    if (!bodyFetched) return null;
    const parsedNow = parseGLB(bodyFetched);
    const texNow = parsedNow.image ? await textureOf(parsedNow.image) : null;
    const surfaceNow = materialOf(texNow);
    const rootNow = new THREE.Group();
    parsedNow.geometries.forEach((geoDef) => { rootNow.add(meshOf(geoDef, surfaceNow)); });
    return rootNow;
  } catch (ignoredFault) { return null; } }
// The hero asset registry
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
  weaponBat: { url: 'assets/weapon-bat.glb', scale: 0.72 } });
const inflightByName = new Map();
// One registered asset is fetched and handed back as a wrapper
// group scaled into game units, its origin on the model origin
// Scaling goes one of two ways: a plain uniform scale, or a per
// axis target size worked out from the unwrapped bounding box so
// the model lands at exact metre dimensions
// Failures resolve null, and results cache by name so repeat
// callers share a single fetch and a single wrapper
function axisFactor(targetGiven, boundsGiven) {
  const factorOut = (boundsGiven > 0) ? (targetGiven / boundsGiven) : 1;
  return factorOut; }
function wrapForGame(modelGiven, entryGiven) {
  const wrapNow = new THREE.Group();
  const applyScale = () => {
    if (entryGiven.targetSize) {
      const boundsBox = new THREE.Box3().setFromObject(modelGiven);
      const boundsVec = boundsBox.getSize(new THREE.Vector3());
      const targetVec = entryGiven.targetSize;
      wrapNow.scale.set(axisFactor(targetVec.x, boundsVec.x), axisFactor(targetVec.y, boundsVec.y), axisFactor(targetVec.z, boundsVec.z));
    } else { wrapNow.scale.setScalar(entryGiven.scale || 1); } };
  applyScale();
  wrapNow.add(modelGiven);
  return wrapNow; }
export async function loadHeroAsset(nameGiven) {
  const entryGiven = HERO_ASSETS[nameGiven];
  if (!entryGiven) return null;
  const alreadyFlying = inflightByName.has(nameGiven);
  if (!alreadyFlying) {
    const promiseNow = (async () => {
      let modelNow = await loadGLBModel(entryGiven.url);
      if (!modelNow) modelNow = await loadGLBModel(entryGiven.url);
      if (!modelNow) { inflightByName.delete(nameGiven); return null; }
      const wrappedNow = wrapForGame(modelNow, entryGiven);
      wrappedNow.name = 'hero:' + nameGiven;
      return wrappedNow;
    })().catch(() => null);
    inflightByName.set(nameGiven, promiseNow); }
  const sharedNow = inflightByName.get(nameGiven);
  return sharedNow; }
// Eager loading and the readiness gate
// All registry entries begin loading the moment this module
// evaluates, so every swap races from the same starting moment
// rather than from whenever a caller happens to ask, and the
// fallbacks stay unaffected because a failed load resolves null
function startAllAssets() {
  const keysAll = Object.keys(HERO_ASSETS);
  keysAll.forEach((keyNow) => { try { loadHeroAsset(keyNow); } catch (ignoredFault) { /* procedural fallback stays */ } }); }
startAllAssets();
export const heroAssetsReady = Promise.allSettled([...inflightByName.values()]);
export function whenHeroAssetsReady() {
  startAllAssets();
  const pendingList = Array.from(inflightByName.values());
  const settledOut = Promise.allSettled(pendingList);
  return settledOut; }
