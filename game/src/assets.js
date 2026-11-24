import * as THREE from 'three';
// Loaded hero models replace procedural builds whenever they arrive
// A model that fails to fetch simply leaves the procedural visual
// No loader addon ships here, so a compact GLB reader lives below
// It understands the JSON and BIN chunks plus generic accessors
// covering float and integer kinds, scalar through four wide vectors,
// with stride honoured and a single embedded image
// Anything beyond that support throws, and the loader turns a throw
// into null so callers keep their fallback visual untouched
// Adding an asset later means dropping the file into the assets
// folder, registering it below, and asking for it where the
// procedural build gets created
// The parsing section comes first and never touches the renderer
const COMPONENTS_PER_TYPE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const GLB_MAGIC = 0x46546c67;
const COMPONENT_INFO = {
  5121: { bytes: 1, get: 'getUint8',
    Array: Uint8Array },
  5123: { bytes: 2, get: 'getUint16',
    Array: Uint16Array },
  5125: { bytes: 4, get: 'getUint32',
    Array: Uint32Array },
  5126: { bytes: 4, get: 'getFloat32',
    Array: Float32Array },
};
function headerMagicDiffers(viewIn) { return viewIn.getUint32(0, true) !== GLB_MAGIC; }
export function parseGLB(bufIn) {
  if (!bufIn || !(bufIn.byteLength >= 20)) throw new Error('GLB: too small');
  const view = new DataView(bufIn);
  if (headerMagicDiffers(view)) throw new Error('GLB: bad magic');
  if (view.getUint32(4, true) !== 2) throw new Error('GLB: not version 2');
  const declaredLen = view.getUint32(8, true);
  if (bufIn.byteLength < declaredLen) throw new Error('GLB: length exceeds buffer');
  let docJson = null; let binOffset = -1; let binSize = 0; let walkPos = 12;
  while (!(walkPos + 8 > declaredLen)) {
    const thisChunkLen = view.getUint32(walkPos, true);
    const thisChunkKind = view.getUint32(walkPos + 4, true);
    const payloadAt = walkPos + 8;
    if (thisChunkLen < 0 || declaredLen < payloadAt + thisChunkLen) throw new Error('GLB: chunk out of bounds');
    if (thisChunkKind === 0x4e4f534a) {
      docJson = JSON.parse(new TextDecoder('utf-8').decode(new Uint8Array(bufIn, payloadAt, thisChunkLen)));
    } else if (thisChunkKind === 0x004e4942) { binOffset = payloadAt; binSize = thisChunkLen; }
    walkPos = payloadAt + thisChunkLen; }
  if (!docJson) throw new Error('GLB: no JSON chunk');
  if (!(binOffset >= 0)) throw new Error('GLB: no BIN chunk');
  if (!Array.isArray(docJson.bufferViews) || !Array.isArray(docJson.accessors)) throw new Error('GLB: missing accessors/bufferViews');
  function accessorSpanCheck(accDef, viewDef, elemBytes, strideVal) {
    const startByte = binOffset + (viewDef.byteOffset || 0) + (accDef.byteOffset || 0);
    const spanTotal = accDef.count > 0 ? elemBytes + (accDef.count - 1) * strideVal : 0;
    if (startByte < binOffset || binOffset + binSize < startByte + spanTotal) throw new Error('GLB: accessor out of range');
    if (viewDef.byteLength !== undefined && viewDef.byteLength < (accDef.byteOffset || 0) + spanTotal) throw new Error('GLB: accessor exceeds bufferView');
    return { startByte: startByte, spanTotal: spanTotal }; }
  function decodeAccessor(accIndex) {
    const accDef = docJson.accessors[accIndex];
    if (!accDef) throw new Error('GLB: accessor missing');
    const compInfo = COMPONENT_INFO[accDef.componentType];
    const perElemCount = COMPONENTS_PER_TYPE[accDef.type];
    if (!compInfo || !perElemCount) throw new Error('GLB: unsupported accessor type');
    const viewDef = docJson.bufferViews[accDef.bufferView ?? 0];
    if (!viewDef || (viewDef.buffer ?? 0) !== 0) throw new Error('GLB: unsupported bufferView');
    const packedBytes = compInfo.bytes * perElemCount;
    const strideVal = viewDef.byteStride || packedBytes;
    if (packedBytes > strideVal) throw new Error('GLB: bad byteStride');
    const spanInfo = accessorSpanCheck(accDef, viewDef, packedBytes, strideVal);
    const outValues = new compInfo.Array(accDef.count * perElemCount);
    let elemCursor = 0;
    while (elemCursor < accDef.count) {
      const elemBase = spanInfo.startByte + elemCursor * strideVal;
      let partCursor = 0;
      while (partCursor < perElemCount) {
        outValues[elemCursor * perElemCount + partCursor] = view[compInfo.get](elemBase + partCursor * compInfo.bytes, true);
        partCursor++; }
      elemCursor++; }
    return outValues; }
  const geometryList = [];
  (docJson.meshes || []).forEach((meshDef) => {
    (meshDef.primitives || []).forEach((primDef) => {
      const attrMap = primDef.attributes || {};
      if (attrMap.POSITION === undefined) throw new Error('GLB: primitive without POSITION');
      const geomEntry = {};
      geomEntry.position = decodeAccessor(attrMap.POSITION);
      geomEntry.normal = attrMap.NORMAL !== undefined ? decodeAccessor(attrMap.NORMAL) : null;
      geomEntry.uv = attrMap.TEXCOORD_0 !== undefined ? decodeAccessor(attrMap.TEXCOORD_0) : null;
      geomEntry.index = primDef.indices !== undefined ? decodeAccessor(primDef.indices) : null;
      geometryList.push(geomEntry); }); });
  if (!(geometryList.length > 0)) throw new Error('GLB: no geometry');
  let embeddedImage = null;
  const firstImageDef = (docJson.images || [])[0];
  if (firstImageDef && firstImageDef.bufferView !== undefined) {
    const imageView = docJson.bufferViews[firstImageDef.bufferView];
    if (!imageView || (imageView.buffer ?? 0) !== 0) throw new Error('GLB: unsupported image bufferView');
    const imageAt = binOffset + (imageView.byteOffset || 0);
    if (imageAt < binOffset || binOffset + binSize < imageAt + imageView.byteLength) throw new Error('GLB: image out of range');
    embeddedImage = { mime: firstImageDef.mimeType || 'image/jpeg', bytes: new Uint8Array(bufIn, imageAt, imageView.byteLength).slice() }; }
  return { geometries: geometryList, image: embeddedImage }; }
// Turning parsed data into scene models
export async function loadGLBModel(urlIn) {
  try {
    const abortCtl = new AbortController();
    const abortTimer = setTimeout(() => abortCtl.abort(), 8000);
    let fetchedBytes;
    try {
      const response = await fetch(urlIn, { signal: abortCtl.signal });
      if (!response.ok) return null;
      fetchedBytes = await response.arrayBuffer();
    } finally { clearTimeout(abortTimer); }
    const parsed = parseGLB(fetchedBytes);
    let texture = null;
    if (parsed.image) {
      try {
        const imageBlob = new Blob([parsed.image.bytes], { type: parsed.image.mime });
        texture = await new THREE.TextureLoader().loadAsync(URL.createObjectURL(imageBlob));
        if (texture) { texture.flipY = false; texture.colorSpace = THREE.SRGBColorSpace; }
      } catch (err) { texture = null; } }
    const surfaceMat = texture
      ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, metalness: 0 })
      : new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.9, metalness: 0 });
    const modelRoot = new THREE.Group();
    parsed.geometries.forEach((geomDef) => {
      const bufferGeo = new THREE.BufferGeometry();
      bufferGeo.setAttribute('position', new THREE.BufferAttribute(geomDef.position, 3));
      if (geomDef.normal) bufferGeo.setAttribute('normal', new THREE.BufferAttribute(geomDef.normal, 3));
      if (geomDef.uv) bufferGeo.setAttribute('uv', new THREE.BufferAttribute(geomDef.uv, 2));
      if (geomDef.index) bufferGeo.setIndex(new THREE.BufferAttribute(geomDef.index, 1));
      if (!geomDef.normal) bufferGeo.computeVertexNormals();
      modelRoot.add(new THREE.Mesh(bufferGeo, surfaceMat)); });
    return modelRoot;
  } catch (err) { return null; } }
// Registry of hero assets
export const HERO_ASSETS = {};
HERO_ASSETS.helicopter = { url: 'assets/helicopter.glb', scale: 11 };
HERO_ASSETS.garage = { url: 'assets/garage.glb', targetSize: { x: 30, y: 15, z: 30 } };
HERO_ASSETS.heroCar = { url: 'assets/hero-car.glb', targetSize: { x: 1.81, y: 1.275, z: 4.51 } };
HERO_ASSETS.npcPolice = { url: 'assets/npc-police.glb', targetSize: { x: 1.82, y: 1.42, z: 4.85 } };
HERO_ASSETS.npcSedan = { url: 'assets/npc-sedan.glb', targetSize: { x: 4.75, y: 1.45, z: 1.80 } };
HERO_ASSETS.npcTaxi = { url: 'assets/npc-taxi.glb', targetSize: { x: 1.82, y: 1.50, z: 4.80 } };
HERO_ASSETS.npcVespa = { url: 'assets/npc-vespa.glb', targetSize: { x: 0.75, y: 1.55, z: 1.95 } };
HERO_ASSETS.npcSportbike = { url: 'assets/npc-sportbike.glb', targetSize: { x: 2.05, y: 1.15, z: 0.80 } };
HERO_ASSETS.gtr35 = { url: 'assets/gtr35.glb', targetSize: { x: 1.89, y: 1.36, z: 4.71 } };
HERO_ASSETS.lamboSvj = { url: 'assets/lambo-svj.glb', targetSize: { x: 2.10, y: 1.14, z: 4.94 } };
HERO_ASSETS.mc = { url: 'assets/mc-ren.glb', scale: 1.78 };
HERO_ASSETS.rivalDriver = { url: 'assets/rival-driver.glb', scale: 1.80 };
HERO_ASSETS.policeOfficer = { url: 'assets/police-officer.glb', scale: 1.78 };
HERO_ASSETS.citizenWoman = { url: 'assets/citizen-woman.glb', scale: 1.68 };
HERO_ASSETS.citizenTeen = { url: 'assets/citizen-teen.glb', scale: 1.62 };
HERO_ASSETS.citizenTeen2 = { url: 'assets/citizen-teen2.glb', scale: 1.62 };
HERO_ASSETS.citizenOffice = { url: 'assets/citizen-office.glb', scale: 1.76 };
HERO_ASSETS.weaponPistol = { url: 'assets/weapon-pistol.glb', scale: 0.30 };
HERO_ASSETS.weaponSmg = { url: 'assets/weapon-smg.glb', scale: 0.55 };
HERO_ASSETS.weaponBat = { url: 'assets/weapon-bat.glb', scale: 0.72 };
const inFlightByName = new Map();
// Fetch one registered asset and hand back a wrapper group scaled
// into game units, with its origin on the model origin
// Two scaling routes exist: a plain uniform scale, or a per axis
// target size derived from the unwrapped bounding box so the model
// lands at exact metre dimensions
// Failures resolve null, and results cache by name so repeat callers
// share one fetch and one wrapper
export async function loadHeroAsset(nameIn) {
  const registryEntry = HERO_ASSETS[nameIn];
  if (!registryEntry) return null;
  if (!inFlightByName.has(nameIn)) {
    const pendingLoad = (async () => {
      let loadedModel = await loadGLBModel(registryEntry.url);
      if (!loadedModel) loadedModel = await loadGLBModel(registryEntry.url);
      if (!loadedModel) { inFlightByName.delete(nameIn); return null; }
      const wrapper = new THREE.Group();
      wrapper.name = 'hero:' + nameIn;
      if (registryEntry.targetSize) {
        const boundsSize = new THREE.Box3().setFromObject(loadedModel).getSize(new THREE.Vector3());
        wrapper.scale.set(
          boundsSize.x > 0 ? registryEntry.targetSize.x / boundsSize.x : 1,
          boundsSize.y > 0 ? registryEntry.targetSize.y / boundsSize.y : 1,
          boundsSize.z > 0 ? registryEntry.targetSize.z / boundsSize.z : 1);
      } else { wrapper.scale.setScalar(registryEntry.scale || 1); }
      wrapper.add(loadedModel);
      return wrapper;
    })().catch(() => null);
    inFlightByName.set(nameIn, pendingLoad); }
  return inFlightByName.get(nameIn); }
// Eager loading plus the readiness gate
// Every registry entry starts loading when this module evaluates, so
// each swap races from the same moment rather than from whenever a
// caller happens to ask, and fallbacks stay unaffected because a
// failed load still resolves null
Object.keys(HERO_ASSETS).forEach((assetName) => { try { loadHeroAsset(assetName); } catch (err) { /* procedural fallback stays */ } });
export const heroAssetsReady = Promise.allSettled([...inFlightByName.values()]);
export function whenHeroAssetsReady() {
  Object.keys(HERO_ASSETS).forEach((assetName) => { try { loadHeroAsset(assetName); } catch (err) { /* procedural fallback stays */ } });
  return Promise.allSettled(Array.from(inFlightByName.values())); }
