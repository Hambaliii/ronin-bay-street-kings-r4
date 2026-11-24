import * as THREE from 'three'; // hero model loading lives below
// Where a finished hero model exists it stands in for the
// procedural build it replaces; a model that never arrives leaves
// that fallback untouched. No loader addon ships with the vendored
// three, so the GLB reader below is hand written: it walks the JSON
// and BIN chunks and reads generic accessors over float and integer
// kinds, scalar through four wide vectors, honouring stride and
// carrying one embedded image along. Support beyond that throws,
// and the loading layer turns a throw into null so callers keep
// their fallback. Registering a fresh asset later means dropping
// the file into the assets folder, adding it below, and asking for
// it where the procedural build gets made. The parsing half comes
// first and never touches rendering.
const WIDTHS_BY_TYPE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const HEAD_MAGIC = 0x46546c67;
const KIND_TABLE = {};
KIND_TABLE[5126] = { bytes: 4, get: 'getFloat32', Array: Float32Array };
KIND_TABLE[5121] = { bytes: 1, get: 'getUint8', Array: Uint8Array };
KIND_TABLE[5123] = { bytes: 2, get: 'getUint16', Array: Uint16Array };
KIND_TABLE[5125] = { bytes: 4, get: 'getUint32', Array: Uint32Array };
const scanChunks = (viewGiven, bufGiven, lenGiven) => {
  const scanResult = {};
  scanResult.doc = null;
  scanResult.binAt = -1;
  scanResult.binLen = 0;
  let cursorPos = 12;
  for (; !(cursorPos + 8 > lenGiven);) {
    const chunkLen = viewGiven.getUint32(cursorPos, true);
    const chunkType = viewGiven.getUint32(cursorPos + 4, true);
    const dataPos = cursorPos + 8;
    const chunkBad = (chunkLen < 0) || (lenGiven < (dataPos + chunkLen));
    chunkBad && (() => { throw new Error('GLB: chunk out of bounds'); })();
    if (chunkType === 0x4e4f534a) {
      const bytesChunk = new Uint8Array(bufGiven, dataPos, chunkLen);
      scanResult.doc = JSON.parse(new TextDecoder('utf-8').decode(bytesChunk));
    }
    chunkType === 0x004e4942 ? (scanResult.binAt = dataPos, scanResult.binLen = chunkLen) : undefined;
    cursorPos = dataPos + chunkLen; }
  return scanResult; };
const checkHeader = (bufGiven, viewGiven) => {
  const tooShort = !bufGiven || (bufGiven.byteLength < 20);
  tooShort && (() => { throw new Error('GLB: too small'); })();
  const magicRead = viewGiven.getUint32(0, true);
  magicRead !== HEAD_MAGIC && (() => { throw new Error('GLB: bad magic'); })();
  const versionRead = viewGiven.getUint32(4, true);
  versionRead !== 2 && (() => { throw new Error('GLB: not version 2'); })();
  const lenDeclared = viewGiven.getUint32(8, true);
  bufGiven.byteLength < lenDeclared && (() => { throw new Error('GLB: length exceeds buffer'); })();
  return lenDeclared; };
export const parseGLB = (bufGiven) => {
  const viewGiven = new DataView(bufGiven);
  const lenGiven = checkHeader(bufGiven, viewGiven);
  const walkResult = scanChunks(viewGiven, bufGiven, lenGiven);
  const docKept = walkResult.doc;
  !docKept && (() => { throw new Error('GLB: no JSON chunk'); })();
  !(walkResult.binAt >= 0) && (() => { throw new Error('GLB: no BIN chunk'); })();
  const viewsMissing = !Array.isArray(docKept.bufferViews);
  const accessorsMissing = !Array.isArray(docKept.accessors);
  (viewsMissing || accessorsMissing) && (() => { throw new Error('GLB: missing accessors/bufferViews'); })();
  const spanOf = (accGiven, viewKept, elemBytes, strideGiven) => {
    const startPos = walkResult.binAt + ((viewKept.byteOffset || 0) + (accGiven.byteOffset || 0));
    let tailLen;
    if (accGiven.count > 0) tailLen = elemBytes + ((accGiven.count - 1) * strideGiven); else tailLen = 0;
    const binEnd = walkResult.binAt + walkResult.binLen;
    const startsEarly = startPos < walkResult.binAt;
    const endsLate = binEnd < (startPos + tailLen);
    (startsEarly || endsLate) && (() => { throw new Error('GLB: accessor out of range'); })();
    const viewOverflow = (viewKept.byteLength !== undefined)
      && (viewKept.byteLength < ((accGiven.byteOffset || 0) + tailLen));
    viewOverflow && (() => { throw new Error('GLB: accessor exceeds bufferView'); })();
    const spanOut = {};
    spanOut.tailLen = tailLen;
    spanOut.startAt = startPos;
    return spanOut; };
  const resolveAccessor = (idxGiven) => {
    const accKept = docKept.accessors[idxGiven];
    !accKept && (() => { throw new Error('GLB: accessor missing'); })();
    const kindKept = KIND_TABLE[accKept.componentType];
    const widthKept = WIDTHS_BY_TYPE[accKept.type];
    (!kindKept || !widthKept) && (() => { throw new Error('GLB: unsupported accessor type'); })();
    const viewIdx = accKept.bufferView ?? 0;
    const viewKept = docKept.bufferViews[viewIdx];
    const viewBad = !viewKept || ((viewKept.buffer ?? 0) !== 0);
    viewBad && (() => { throw new Error('GLB: unsupported bufferView'); })();
    const packedBytes = kindKept.bytes * widthKept;
    const strideKept = viewKept.byteStride || packedBytes;
    packedBytes > strideKept && (() => { throw new Error('GLB: bad byteStride'); })();
    const spanKept = spanOf(accKept, viewKept, packedBytes, strideKept);
    const resolvedOut = {};
    resolvedOut.widthNow = widthKept;
    resolvedOut.accNow = accKept;
    resolvedOut.strideNow = strideKept;
    resolvedOut.kindNow = kindKept;
    resolvedOut.spanNow = spanKept;
    return resolvedOut; };
  const readAccessor = (idxGiven) => {
    const resolved = resolveAccessor(idxGiven);
    const valsOut = new resolved.kindNow.Array(resolved.accNow.count * resolved.widthNow);
    let elemIdx = 0;
    for (; elemIdx < resolved.accNow.count;) {
      const elemBase = resolved.spanNow.startAt + (elemIdx * resolved.strideNow);
      let partIdx = 0;
      for (; partIdx < resolved.widthNow;) {
        const readPos = elemBase + (partIdx * resolved.kindNow.bytes);
        valsOut[(elemIdx * resolved.widthNow) + partIdx] = viewGiven[resolved.kindNow.get](readPos, true);
        partIdx++; }
      elemIdx++; }
    return valsOut; };
  const geometryFrom = (primGiven) => {
    const attrsGiven = primGiven.attributes || {};
    attrsGiven.POSITION === undefined && (() => { throw new Error('GLB: primitive without POSITION'); })();
    let normalVal;
    if (attrsGiven.NORMAL !== undefined) normalVal = readAccessor(attrsGiven.NORMAL); else normalVal = null;
    let uvVal;
    if (attrsGiven.TEXCOORD_0 !== undefined) uvVal = readAccessor(attrsGiven.TEXCOORD_0); else uvVal = null;
    let indexVal;
    if (primGiven.indices !== undefined) indexVal = readAccessor(primGiven.indices); else indexVal = null;
    return { position: readAccessor(attrsGiven.POSITION), normal: normalVal, uv: uvVal, index: indexVal }; };
  const geoList = [];
  const meshesArr = docKept.meshes || [];
  for (const meshGiven of meshesArr) {
    const primsArr = meshGiven.primitives || [];
    for (const primGiven of primsArr) geoList.push(geometryFrom(primGiven)); }
  geoList.length === 0 && (() => { throw new Error('GLB: no geometry'); })();
  const embeddedImage = () => { const imagesArr = docKept.images || []; const [imgLead] = imagesArr;
    if (!imgLead || (imgLead.bufferView === undefined)) return null;
    const viewImg = docKept.bufferViews[imgLead.bufferView];
    const viewImgBad = !viewImg || ((viewImg.buffer ?? 0) !== 0);
    viewImgBad && (() => { throw new Error('GLB: unsupported image bufferView'); })();
    const imgPos = walkResult.binAt + (viewImg.byteOffset || 0);
    const imgEarly = imgPos < walkResult.binAt;
    const binEnd = walkResult.binAt + walkResult.binLen;
    const imgLate = binEnd < (imgPos + viewImg.byteLength);
    (imgEarly || imgLate) && (() => { throw new Error('GLB: image out of range'); })();
    const bytesImg = new Uint8Array(bufGiven, imgPos, viewImg.byteLength).slice();
    const imgOut = {};
    imgOut.bytes = bytesImg;
    imgOut.mime = (imgLead.mimeType || 'image/jpeg');
    return imgOut; };
  const parsedOut = {};
  parsedOut.image = embeddedImage();
  parsedOut.geometries = geoList;
  return parsedOut; };
// Second half: scene models are built from the parsed data.
const fetchBytes = async (urlGiven, signalGiven) => {
  const respGiven = await fetch(urlGiven, { signal: signalGiven });
  let bodyOrNull;
  if (!respGiven.ok) bodyOrNull = null; else bodyOrNull = await respGiven.arrayBuffer();
  return bodyOrNull; };
const textureFromImage = async (imageGiven) => { try {
    const blobGiven = new Blob([imageGiven.bytes], { type: imageGiven.mime });
    const blobUrl = URL.createObjectURL(blobGiven);
    const loaderHeld = new THREE.TextureLoader();
    const texMade = await loaderHeld.loadAsync(blobUrl);
    texMade ? (texMade.flipY = false, texMade.colorSpace = THREE.SRGBColorSpace) : undefined;
    return texMade;
  } catch (swallowed) { return null; } };
const materialFor = (texGiven) => { const specTable = { tex: { map: texGiven, roughness: 0.9, metalness: 0 }, plain: { color: 0xb8bcc2, roughness: 0.9, metalness: 0 } };
  let chosenSpec;
  if (texGiven) chosenSpec = specTable.tex; else chosenSpec = specTable.plain;
  return new THREE.MeshStandardMaterial(chosenSpec); };
const meshFromGeo = (geoGiven, matGiven) => {
  const bufGeo = new THREE.BufferGeometry();
  const planList = [['position', geoGiven.position, 3]];
  geoGiven.normal ? planList.push(['normal', geoGiven.normal, 3]) : undefined;
  geoGiven.uv ? planList.push(['uv', geoGiven.uv, 2]) : undefined;
  for (const planEntry of planList) {
    const [attrName, attrData, attrWidth] = planEntry;
    bufGeo.setAttribute(attrName, new THREE.BufferAttribute(attrData, attrWidth)); }
  geoGiven.index ? bufGeo.setIndex(new THREE.BufferAttribute(geoGiven.index, 1)) : undefined;
  geoGiven.normal ? undefined : bufGeo.computeVertexNormals();
  return new THREE.Mesh(bufGeo, matGiven); };
export const loadGLBModel = async (urlGiven) => { try {
    const ctlGiven = new AbortController();
    const abortFn = () => ctlGiven.abort();
    const timerGiven = setTimeout(abortFn, 8000);
    let bodyGot;
    try { bodyGot = await fetchBytes(urlGiven, ctlGiven.signal); } finally { clearTimeout(timerGiven); }
    if (!bodyGot) return null;
    const parsedGot = parseGLB(bodyGot);
    let texGot;
    if (parsedGot.image) texGot = await textureFromImage(parsedGot.image); else texGot = null;
    const matGot = materialFor(texGot);
    const groupBuilt = new THREE.Group();
    for (const geoGiven of parsedGot.geometries) { groupBuilt.add(meshFromGeo(geoGiven, matGot)); }
    return groupBuilt;
  } catch (swallowed) { return null; } };
// The hero asset registry, written out in full.
export const HERO_ASSETS = {
  helicopter: { scale: 11, url: 'assets/helicopter.glb' },
  garage: { targetSize: { x: 30, y: 15, z: 30 }, url: 'assets/garage.glb' },
  heroCar: { targetSize: { x: 1.81, y: 1.275, z: 4.51 }, url: 'assets/hero-car.glb' },
  npcPolice: { targetSize: { x: 1.82, y: 1.42, z: 4.85 }, url: 'assets/npc-police.glb' },
  npcSedan: { targetSize: { x: 4.75, y: 1.45, z: 1.80 }, url: 'assets/npc-sedan.glb' },
  npcTaxi: { targetSize: { x: 1.82, y: 1.50, z: 4.80 }, url: 'assets/npc-taxi.glb' },
  npcVespa: { targetSize: { x: 0.75, y: 1.55, z: 1.95 }, url: 'assets/npc-vespa.glb' },
  npcSportbike: { targetSize: { x: 2.05, y: 1.15, z: 0.80 }, url: 'assets/npc-sportbike.glb' },
  gtr35: { targetSize: { x: 1.89, y: 1.36, z: 4.71 }, url: 'assets/gtr35.glb' },
  lamboSvj: { targetSize: { x: 2.10, y: 1.14, z: 4.94 }, url: 'assets/lambo-svj.glb' },
  mc: { scale: 1.78, url: 'assets/mc-ren.glb' },
  rivalDriver: { scale: 1.80, url: 'assets/rival-driver.glb' },
  policeOfficer: { scale: 1.78, url: 'assets/police-officer.glb' },
  citizenWoman: { scale: 1.68, url: 'assets/citizen-woman.glb' },
  citizenTeen: { scale: 1.62, url: 'assets/citizen-teen.glb' },
  citizenTeen2: { scale: 1.62, url: 'assets/citizen-teen2.glb' },
  citizenOffice: { scale: 1.76, url: 'assets/citizen-office.glb' },
  weaponPistol: { scale: 0.30, url: 'assets/weapon-pistol.glb' },
  weaponSmg: { scale: 0.55, url: 'assets/weapon-smg.glb' },
  weaponBat: { scale: 0.72, url: 'assets/weapon-bat.glb' } };
const pendingLoads = new Map();
// Once fetched, a registered asset is handed back as a wrapper
// group scaled into game units, origin on the model origin. Scaling
// goes one of two ways: a plain uniform scale, or a per axis target
// size worked out from the unwrapped bounds so the model lands at
// exact metre dimensions. Failures resolve null, and results cache
// by name so repeat callers share one fetch and one wrapper.
const axisRatio = (targetGiven, boundsGiven) => {
  const noBounds = !(boundsGiven > 0);
  let ratioOut;
  if (noBounds) ratioOut = 1; else ratioOut = (targetGiven / boundsGiven);
  return ratioOut; };
const fitWrapToTarget = (wrapGiven, modelGiven, targetGiven) => {
  const boxKept = new THREE.Box3();
  boxKept.setFromObject(modelGiven);
  const sizeVec = new THREE.Vector3();
  const sizeKept = boxKept.getSize(sizeVec);
  const ratioX = axisRatio(targetGiven.x, sizeKept.x);
  const ratioY = axisRatio(targetGiven.y, sizeKept.y);
  const ratioZ = axisRatio(targetGiven.z, sizeKept.z);
  wrapGiven.scale.set(ratioX, ratioY, ratioZ); };
const wrapModel = (modelGiven, entryGiven) => {
  const wrapBuilt = new THREE.Group();
  entryGiven.targetSize ? fitWrapToTarget(wrapBuilt, modelGiven, entryGiven.targetSize) : wrapBuilt.scale.setScalar(entryGiven.scale || 1);
  wrapBuilt.add(modelGiven); return wrapBuilt; };
const loadEntryOnce = async (nameGiven, entryGiven) => {
  let modelKept = await loadGLBModel(entryGiven.url);
  modelKept = modelKept ? modelKept : await loadGLBModel(entryGiven.url);
  if (modelKept) { /* loaded below */ } else { pendingLoads.delete(nameGiven); return null; }
  const wrappedBuilt = wrapModel(modelKept, entryGiven);
  wrappedBuilt.name = `hero:${nameGiven}`; return wrappedBuilt; };
export const loadHeroAsset = async (nameGiven) => {
  const entryKept = HERO_ASSETS[nameGiven];
  if (entryKept) {
    if (!pendingLoads.has(nameGiven)) {
      const promiseKept = loadEntryOnce(nameGiven, entryKept).catch(() => null);
      pendingLoads.set(nameGiven, promiseKept); }
    return pendingLoads.get(nameGiven); }
  return null; };
// The readiness gate and eager loading: every registry entry
// starts loading the moment this module evaluates, so each swap
// races from the same starting moment instead of whenever a
// caller happens to ask, and fallbacks stay unaffected because
// failures give null.
const startAllLoads = () => { const keyList = Object.keys(HERO_ASSETS);
  for (const keyKept of keyList) {
    try { loadHeroAsset(keyKept); } catch (swallowed) { /* the procedural fallback stays in place */ } } };
startAllLoads(); export const heroAssetsReady = Promise.allSettled([...pendingLoads.values()]);
export const whenHeroAssetsReady = () => { startAllLoads(); return Promise.allSettled(Array.from(pendingLoads.values())); };
