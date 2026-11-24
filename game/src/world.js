// world.js — RONIN BAY itu sendiri: kubah langit gradien, terrain,
// kisi jalan, bangunan, pantai, taman, HQ, pelabuhan dan pita touge,
// plus penyegaran waktu-hari per frame.
import * as THREE from 'three';
import { CFG, DISTRICTS, TOUGE_POINTS, VICE } from './config.js';
import { rnd, rr, ri, pick } from './random.js';
import { loadHeroAsset } from './assets.js';
let glowTexCache = null;
function getGlowTexture() {
  if (glowTexCache) return glowTexCache;
  const lembar = document.createElement('canvas'); lembar.width = lembar.height = 128;
  const sapu = lembar.getContext('2d');
  const gradasi = sapu.createRadialGradient(64, 64, 2, 64, 64, 64);
  gradasi.addColorStop(0, 'rgba(255,255,255,1)'); gradasi.addColorStop(0.4, 'rgba(255,255,255,.45)');
  gradasi.addColorStop(1, 'rgba(255,255,255,0)');
  sapu.fillStyle = gradasi; sapu.fillRect(0, 0, 128, 128);
  glowTexCache = new THREE.CanvasTexture(lembar);
  return glowTexCache; }
// ---- kubah langit gradien plus kabut hangat ---------------------------
const SKY_KEY_ROWS = [
  [0, '#060a18', '#0e1830', '#16233f', '#101a2e'], [5, '#060a18', '#0e1830', '#16233f', '#101a2e'],
  [7, '#3d6fb4', '#d9a06b', '#f2d5a0', '#e8c9a0'], [10.5, '#3a7bd5', '#8ec9e8', '#bfe3ef', '#cfe4ec'],
  [16.5, '#3a6db0', '#c9b49a', '#f7d99a', '#ecd3a4'], [17.8, '#35507a', '#e8763a', '#ffc46b', '#f2c99a'],
  [19.5, '#141e38', '#6a4a5a', '#c97a4a', '#7a5a4e'], [22, '#060a18', '#0e1830', '#16233f', '#101a2e'],
  [24, '#060a18', '#0e1830', '#16233f', '#101a2e'],
];
const SKY_KEYFRAMES = [];
for (const [jamBaris, hexAtas, hexTengah, hexHor, hexKabut] of SKY_KEY_ROWS) {
  const entriKunci = {};
  entriKunci.h = jamBaris; entriKunci.top = new THREE.Color(hexAtas); entriKunci.mid = new THREE.Color(hexTengah);
  entriKunci.hor = new THREE.Color(hexHor); entriKunci.fog = new THREE.Color(hexKabut);
  SKY_KEYFRAMES.push(entriKunci); }
const skyTopCol = new THREE.Color(), skyMidCol = new THREE.Color(), skyHorCol = new THREE.Color(), skyFogCol = new THREE.Color();
const skyWarmCol = new THREE.Color(0xffe0b8);
function computeSkyColors(hourVal) {
  // Telusuri tabel keyframe: idxKunci berakhir pada kunci terakhir
  // yang jamnya sudah dicapai (dibatasi pada kunci kedua terakhir).
  let idxKunci = 0;
  for (let idxPindai = 1; idxPindai < SKY_KEYFRAMES.length - 1; ++idxPindai) {
    if (SKY_KEYFRAMES[idxPindai].h > hourVal) break;
    idxKunci = idxPindai; }
  const kunciDari = SKY_KEYFRAMES[idxKunci], kunciKe = SKY_KEYFRAMES[idxKunci + 1];
  const campurMentah = (hourVal - kunciDari.h) / Math.max(0.001, kunciKe.h - kunciDari.h);
  const jumlahCampur = campurMentah < 0 ? 0 : campurMentah > 1 ? 1 : campurMentah;
  skyTopCol.lerpColors(kunciDari.top, kunciKe.top, jumlahCampur);
  skyMidCol.lerpColors(kunciDari.mid, kunciKe.mid, jumlahCampur);
  skyHorCol.lerpColors(kunciDari.hor, kunciKe.hor, jumlahCampur);
  skyFogCol.lerpColors(kunciDari.fog, kunciKe.fog, jumlahCampur); }
let skySheet = null, skyBrush = null, skyTextureObj = null, skyDome = null, skyLastHour = -10;
let glowSpritesList = [];
function paintSkyDome() {
  if (!skyBrush) return;
  const gradasi = skyBrush.createLinearGradient(0, 0, 0, 512);
  gradasi.addColorStop(0, '#' + skyTopCol.getHexString());
  gradasi.addColorStop(0.55, '#' + skyMidCol.getHexString());
  gradasi.addColorStop(1, '#' + skyHorCol.getHexString());
  skyBrush.fillStyle = gradasi; skyBrush.fillRect(0, 0, 16, 512);
  if (skyTextureObj) skyTextureObj.needsUpdate = true; }
export function glowSprite(tintVal, sizeVal) {
  const matSpr = new THREE.SpriteMaterial({ map: getGlowTexture(), color: tintVal, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
  const sprObj = new THREE.Sprite(matSpr);
  sprObj.scale.set(sizeVal, sizeVal, 1);
  return sprObj; }
export function groundH(x, z) {
  const geserX = x + 330, geserZ = z + 470;
  const jarakNorm = ((geserX * geserX) + (geserZ * geserZ)) / (330 * 330);
  let nilaiTinggi = 14 * Math.exp(-jarakNorm * 2.2);
  if (x > -140 || z > -180) nilaiTinggi *= Math.max(0, Math.min(1, ((-140 - x) / 120 + 1)));
  // Kisi kota tetap rata — bukit hanya naik di kuadran NW.
  if (x > -100 || z > -100) nilaiTinggi = 0;
  return nilaiTinggi; }
function makeCanvasTexture(wVal, hVal, drawFn) {
  const lembar = document.createElement('canvas'); lembar.width = wVal; lembar.height = hVal;
  drawFn(lembar.getContext('2d'), wVal, hVal);
  const texHasil = new THREE.CanvasTexture(lembar); texHasil.colorSpace = THREE.SRGBColorSpace; return texHasil; }
function buildGroundTexture() {
  // Tanah basis ialah permukaan terang hangat yang dirawat, tak
  // pernah cucian olive/tanah datar lama. Tekstur per zona di bawah
  // melakukan pekerjaan sesungguhnya; ini hanya tampil pada tepi
  // yang tak ditutupi bidang zona.
  return makeCanvasTexture(256, 256, (sapu) => {
    sapu.fillStyle = VICE.ground.base;
    sapu.fillRect(0, 0, 256, 256);
    for (let idxBintik = 0; idxBintik < 900; ++idxBintik) { sapu.fillStyle = `rgba(${190 + ri(0, 50)},${175 + ri(0, 45)},${140 + ri(0, 40)},.14)`; sapu.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    for (let idxTambal = 0; idxTambal < 26; ++idxTambal) { sapu.fillStyle = 'rgba(255,250,235,.06)'; sapu.fillRect(rnd() * 256, rnd() * 256, rr(18, 46), rr(12, 30)); }
    sapu.strokeStyle = 'rgba(120,110,90,.10)'; sapu.strokeRect(0, 0, 256, 256); }); }
// ---- perlakuan tanah: tekstur kanvas kecil, diubin ----------------
// (a) kisi lempeng paving untuk trotoar / plaza / Coral + downtown
const buildPavingTexture = () => {
  const texHasil = makeCanvasTexture(128, 128, (sapu) => {
    sapu.fillStyle = VICE.ground.paving;
    sapu.fillRect(0, 0, 128, 128);
    sapu.fillStyle = VICE.ground.pavingAlt;
    sapu.fillRect(64, 0, 64, 64); sapu.fillRect(0, 64, 64, 64);
    for (let idxBintik = 0; idxBintik < 260; ++idxBintik) { sapu.fillStyle = `rgba(${150 + ri(0, 60)},${145 + ri(0, 50)},${120 + ri(0, 40)},.13)`; sapu.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
    sapu.strokeStyle = VICE.ground.pavingGrout;
    sapu.lineWidth = 3;
    sapu.strokeRect(0, 0, 128, 128);
    sapu.beginPath();
    sapu.moveTo(64, 0); sapu.lineTo(64, 128); sapu.moveTo(0, 64); sapu.lineTo(128, 64);
    sapu.stroke(); });
  texHasil.wrapS = texHasil.wrapT = THREE.RepeatWrapping;
  return texHasil; };
// (b) rumput jenuh untuk taman / halaman Hoshino Heights + bukit
const buildGrassTexture = () => {
  const texHasil = makeCanvasTexture(128, 128, (sapu) => {
    sapu.fillStyle = VICE.ground.grass;
    sapu.fillRect(0, 0, 128, 128);
    for (let idxBilah = 0; idxBilah < 700; ++idxBilah) { sapu.fillStyle = rnd() < 0.5 ? VICE.ground.grassLight : VICE.ground.grassDark; sapu.globalAlpha = rr(0.12, 0.3); sapu.fillRect(rnd() * 128, rnd() * 128, 2, rr(2, 4)); }
    sapu.globalAlpha = 1;
  });
  texHasil.wrapS = texHasil.wrapT = THREE.RepeatWrapping;
  return texHasil; };
// (c) pasir hangat terang untuk jalur pantai yang sesungguhnya
const buildSandTexture = () => {
  const texHasil = makeCanvasTexture(128, 128, (sapu) => {
    sapu.fillStyle = VICE.ground.sand;
    sapu.fillRect(0, 0, 128, 128);
    for (let idxButir = 0; idxButir < 500; ++idxButir) { sapu.fillStyle = rnd() < 0.6 ? VICE.ground.sandSpeckle : '#fff3cf'; sapu.globalAlpha = rr(0.1, 0.28); sapu.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
    sapu.globalAlpha = 1;
  });
  texHasil.wrapS = texHasil.wrapT = THREE.RepeatWrapping;
  return texHasil; };
const makeGrassMat = (repX, repY) => {
  const texHasil = buildGrassTexture();
  texHasil.repeat.set(repX, repY);
  return new THREE.MeshStandardMaterial({ map: texHasil, roughness: 1 }); };
const makePavingMat = (repX, repY, tintVal) => {
  const texHasil = buildPavingTexture();
  texHasil.repeat.set(repX, repY);
  return new THREE.MeshStandardMaterial({ map: texHasil, color: tintVal || 0xffffff, roughness: 1 }); };
const LIT_WINDOW_TONES = [
  '#ffd9a0', '#ffc98a', '#fff3d0', '#ffe9b8', '#bfe0ff', '#9fd4ff',
];
const buildBuildingTexture = (baseColour, litChance) => makeCanvasTexture(128, 256, (sapu, wVal, hVal) => {
  sapu.fillStyle = baseColour; sapu.fillRect(0, 0, wVal, hVal);
  for (let barisY = 8; barisY < hVal - 8; barisY += 14) for (let kolomX = 6; kolomX < wVal - 6; kolomX += 14) {
    const menyalaFlag = rnd() < litChance;
    sapu.fillStyle = menyalaFlag ? LIT_WINDOW_TONES[Math.floor(rnd() * (rnd() < 0.72 ? 4 : 6))] : '#2c3844'; sapu.fillRect(kolomX, barisY, 9, 8);
    sapu.fillStyle = 'rgba(255,255,255,.15)'; sapu.fillRect(kolomX, barisY, 9, 2); } });
const buildSignTexture = (labelText, bgColour, fgColour) => makeCanvasTexture(256, 64, (sapu, wVal, hVal) => {
  sapu.fillStyle = bgColour; sapu.fillRect(0, 0, wVal, hVal);
  sapu.font = 'bold 34px sans-serif'; sapu.textAlign = 'center'; sapu.textBaseline = 'middle';
  sapu.shadowColor = fgColour; sapu.shadowBlur = 12; sapu.fillStyle = fgColour; sapu.fillText(labelText, wVal / 2, hVal / 2); });
export function makePalm(heightVal) {
  const grupPalem = new THREE.Group();
  const matBatang = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.95 });
  const kurvaBatang = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, heightVal * 0.55, 0), new THREE.Vector3(0.55, heightVal, 0));
  const meshBatang = new THREE.Mesh(new THREE.TubeGeometry(kurvaBatang, 6, 0.14, 6), matBatang);
  grupPalem.add(meshBatang);
  const titikMahkota = kurvaBatang.getPoint(1);
  const matDaun = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9 });
  for (let idxDaun = 0; idxDaun < 8; ++idxDaun) {
    const panjangDaun = rr(2.0, 2.4);
    const geoDaun = new THREE.PlaneGeometry(0.5, panjangDaun, 1, 6);
    const attrPos = geoDaun.attributes.position;
    const susunanWarna = [];
    const warnaDari = new THREE.Color(0x2e7d32);
    const warnaKe = new THREE.Color(0x66bb4a);
    const warnaKerja = new THREE.Color();
    for (let idxTitik = 0; idxTitik < attrPos.count; ++idxTitik) {
      const titikY = attrPos.getY(idxTitik);
      const fraksiVal = (titikY + (panjangDaun / 2)) / panjangDaun;
      attrPos.setZ(idxTitik, -Math.pow(fraksiVal, 2) * 0.9);
      attrPos.setX(idxTitik, attrPos.getX(idxTitik) * (1 - (fraksiVal * 0.7)));
      warnaKerja.copy(warnaDari).lerp(warnaKe, fraksiVal);
      susunanWarna.push(warnaKerja.r, warnaKerja.g, warnaKerja.b); }
    geoDaun.setAttribute('color', new THREE.Float32BufferAttribute(susunanWarna, 3));
    geoDaun.computeVertexNormals();
    const meshDaun = new THREE.Mesh(geoDaun, matDaun);
    meshDaun.position.copy(titikMahkota);
    meshDaun.rotation.order = 'YXZ';
    meshDaun.rotation.y = (idxDaun / 8) * 2 * Math.PI + rr(-0.2, 0.2);
    meshDaun.rotation.x = -Math.PI / 2 + rr(0.35, 0.6);
    meshDaun.translateY(panjangDaun / 2 - 0.1);
    grupPalem.add(meshDaun); }
  grupPalem.traverse((objNode) => { if (objNode.isMesh) objNode.castShadow = true; });
  return grupPalem; }
export function makeShadeTree(heightVal, canopyColour) {
  const grupPohon = new THREE.Group();
  const meshBatang = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, heightVal * 0.55, 7), new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }));
  meshBatang.position.y = heightVal * 0.275; grupPohon.add(meshBatang);
  const matKanopi = new THREE.MeshStandardMaterial({ color: canopyColour || 0x3d8b4f, roughness: 1, flatShading: true });
  for (let idxGumpal = 0; idxGumpal < 3; ++idxGumpal) {
    const radiusGumpal = heightVal * rr(0.28, 0.4);
    const meshGumpal = new THREE.Mesh(new THREE.IcosahedronGeometry(radiusGumpal, 1), matKanopi);
    meshGumpal.position.set(rr(-0.5, 0.5), heightVal * 0.55 + rr(0, heightVal * 0.3), rr(-0.5, 0.5));
    grupPohon.add(meshGumpal); }
  return grupPohon; }
// ---- rumah, RONIN MART, material bersama ---------------------------
const MARKET = {};
MARKET.x = -82.5; MARKET.z = -255; MARKET.name = 'RONIN MART';
const stdMatCache = new Map();
function sharedStdMat(colourVal, roughVal, metalVal) {
  const kunciCache = colourVal + '|' + (roughVal || 0.95) + '|' + (metalVal || 0);
  if (!stdMatCache.has(kunciCache)) stdMatCache.set(kunciCache, new THREE.MeshStandardMaterial({ color: colourVal, roughness: roughVal || 0.95, metalness: metalVal || 0 }));
  return stdMatCache.get(kunciCache); }
const tougeDistance = (x, z) => {
  let jarakTerbaik = 1e9;
  for (let idxSeg = 0; idxSeg < TOUGE_POINTS.length - 1; ++idxSeg) {
    const titikAx = TOUGE_POINTS[idxSeg][0], titikAz = TOUGE_POINTS[idxSeg][1], titikBx = TOUGE_POINTS[idxSeg + 1][0], titikBz = TOUGE_POINTS[idxSeg + 1][1];
    const segDx = titikBx - titikAx, segDz = titikBz - titikAz, segLenSq = (segDx * segDx) + (segDz * segDz) || 1;
    let proyeksiT = ((x - titikAx) * segDx + (z - titikAz) * segDz) / segLenSq;
    proyeksiT = Math.max(0, Math.min(1, proyeksiT));
    const nilaiJarak = Math.hypot(x - (titikAx + (segDx * proyeksiT)), z - (titikAz + (segDz * proyeksiT)));
    if (nilaiJarak < jarakTerbaik) jarakTerbaik = nilaiJarak; }
  return jarakTerbaik; };
function makePrismGeo(wVal, hVal, dVal) {
  const bentuk = new THREE.Shape();
  bentuk.moveTo(-wVal / 2, 0); bentuk.lineTo(wVal / 2, 0); bentuk.lineTo(0, hVal); bentuk.closePath();
  const geoHasil = new THREE.ExtrudeGeometry(bentuk, { depth: dVal, bevelEnabled: false });
  geoHasil.translate(0, 0, -dVal / 2);
  return geoHasil; }
const HOUSE_WALL_COLOURS = [
  '#f2e3c8', '#eec9b8', '#dfe8d8', '#f5d9e0',
  '#dcebf5', '#f7ecc9', '#e6d7f0', '#ffe8cc',
];
const HOUSE_ROOF_COLOURS = [
  0xb5523c, 0x8a4a3a, 0x5d6d7e, 0xa03d2d, 0x6b4a35, 0x44586a, 0xc96f4a,
];
const HOUSE_YARD_GREENS = [
  0x5d9a52, 0x67a35a, 0x548c4c, 0x71ab60,
];
const houseWinMat = new THREE.MeshStandardMaterial({ color: 0xbfe0ea, roughness: 0.25, metalness: 0.4, emissive: 0xffc873, emissiveIntensity: 0.35 });
let lastWallColour = null;
function constructHouse(G, scene, hx, hz, faceDir) {
  const grupRumah = new THREE.Group();
  grupRumah.position.set(hx, groundH(hx, hz), hz);
  grupRumah.rotation.y = faceDir > 0 ? 0 : Math.PI;
  const duaLantaiFlag = rnd() < 0.45;
  const lebarRumah = rr(9, 12), dalamRumah = rr(8, 10), tinggiDinding = duaLantaiFlag ? rr(5.2, 6) : rr(2.9, 3.4);
  const tinggiAtap = rr(1.8, 2.6);
  // Lempeng halaman ialah PAVING kini, bukan rumput — rumah duduk di
  // lot berpaving dengan driveway berpaving; hijau hanya bertahan
  // pada pagar tanaman plus satu taman pameran.
  const meshLot = new THREE.Mesh(new THREE.PlaneGeometry(30, 25), makePavingMat(6, 5));
  void HOUSE_YARD_GREENS;
  meshLot.rotation.x = -Math.PI / 2; meshLot.position.y = 0.03; grupRumah.add(meshLot);
  const meshDrive = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8.5), sharedStdMat(0x9a9a96, 1));
  meshDrive.rotation.x = -Math.PI / 2;
  meshDrive.position.set(-lebarRumah * 0.28, 0.05, (dalamRumah / 2) + 4.2);
  grupRumah.add(meshDrive);
  const matPagar = sharedStdMat(0x2e6b34, 1);
  const meshPagarBelakang = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 0.4), matPagar);
  meshPagarBelakang.position.set(0, 0.28, -12.3); grupRumah.add(meshPagarBelakang);
  [-1, 1].forEach((tandaSisi) => { const meshPagarSisi = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 25), matPagar); meshPagarSisi.position.set(tandaSisi * 14.8, 0.28, 0); grupRumah.add(meshPagarSisi); });
  let warnaDinding = pick(HOUSE_WALL_COLOURS);
  if (warnaDinding === lastWallColour) warnaDinding = HOUSE_WALL_COLOURS[(HOUSE_WALL_COLOURS.indexOf(warnaDinding) + 1) % HOUSE_WALL_COLOURS.length];
  lastWallColour = warnaDinding;
  const meshDinding = new THREE.Mesh(new THREE.BoxGeometry(lebarRumah, tinggiDinding, dalamRumah), sharedStdMat(new THREE.Color(warnaDinding).getHex(), 0.95));
  meshDinding.position.y = tinggiDinding / 2; grupRumah.add(meshDinding);
  const meshAtap = new THREE.Mesh(makePrismGeo(lebarRumah + 1.2, tinggiAtap, dalamRumah + 1), sharedStdMat(pick(HOUSE_ROOF_COLOURS), 0.9));
  meshAtap.position.y = tinggiDinding; grupRumah.add(meshAtap);
  const meshPintu = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), sharedStdMat(0x4a3220, 0.9));
  meshPintu.position.set(-lebarRumah * 0.28, 1.1, (dalamRumah / 2) + 0.06); grupRumah.add(meshPintu);
  const tinggiBarisJendela = duaLantaiFlag ? [1.9, 4.4] : [1.9];
  tinggiBarisJendela.forEach((barisY) => {
    [0, lebarRumah * 0.3].forEach((kolomX) => {
      const meshJendela = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), houseWinMat);
      meshJendela.position.set(kolomX, barisY, (dalamRumah / 2) + 0.06);
      grupRumah.add(meshJendela); }); });
  if (rnd() < 0.4) { const meshCerobong = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), sharedStdMat(0x8a7a6a, 1)); meshCerobong.position.set(lebarRumah * 0.3, tinggiDinding + (tinggiAtap * 0.55), 0); grupRumah.add(meshCerobong); }
  if (rnd() < 0.35) { const pohonHalaman = makeShadeTree(rr(2.6, 3.4), 0x3d8b4f); pohonHalaman.position.set(11, 0, -8); grupRumah.add(pohonHalaman); }
  // Rumah melempar bayangan (lempeng tanah menerima ketimbang melempar).
  grupRumah.traverse((objNode) => { if (objNode.isMesh) objNode.castShadow = true; });
  meshLot.castShadow = false; meshLot.receiveShadow = true;
  meshDrive.castShadow = false; meshDrive.receiveShadow = true;
  scene.add(grupRumah);
  G.addCollider(hx, hz, lebarRumah / 2, dalamRumah / 2, tinggiDinding + tinggiAtap); }
function constructResidentialBlock(G, scene, cx, cz) {
  [{ dz: -31, face: -1 }, { dz: 31, face: 1 }].forEach((specBaris) => {
    [-57, -19, 19, 57].forEach((lokalX) => {
      const rumahX = cx + lokalX + rr(-3, 3), rumahZ = cz + specBaris.dz + rr(-3, 3);
      if (tougeDistance(rumahX, rumahZ) < 16) return;
      if (G.roadX.some((nilaiJalan) => Math.abs(rumahX - nilaiJalan) < 26) || G.roadZ.some((nilaiJalan) => Math.abs(rumahZ - nilaiJalan) < 26)) return;
      constructHouse(G, scene, rumahX, rumahZ, specBaris.face); }); }); }
function constructParkedCar(paintVal) {
  const grupMobil = new THREE.Group();
  const meshBadan = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.55, 4.4), new THREE.MeshStandardMaterial({ color: paintVal, roughness: 0.45, metalness: 0.35 }));
  meshBadan.position.y = 0.55; grupMobil.add(meshBadan);
  const meshKabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), sharedStdMat(0x1c2733, 0.2, 0.6));
  meshKabin.position.set(0, 1.05, -0.15); grupMobil.add(meshKabin);
  const geoRoda = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
  const matRoda = sharedStdMat(0x17181a, 0.9);
  [-1, 1].forEach((sisiX) => {
    [-1, 1].forEach((sisiZ) => {
      const meshRoda = new THREE.Mesh(geoRoda, matRoda);
      meshRoda.rotation.z = Math.PI / 2;
      meshRoda.position.set(sisiX * 0.85, 0.33, sisiZ * 1.35);
      grupMobil.add(meshRoda); }); });
  return grupMobil; }
function constructMarket(G, scene) {
  const mx = MARKET.x, mz = MARKET.z;
  const grupMart = new THREE.Group();
  grupMart.position.set(mx, groundH(mx, mz), mz);
  scene.add(grupMart);
  const meshBlok = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), sharedStdMat(0xdfe3e6, 0.9));
  meshBlok.position.y = 4.5; grupMart.add(meshBlok);
  const meshLempeng = new THREE.Mesh(new THREE.BoxGeometry(48, 0.5, 24), sharedStdMat(0x3c4248, 0.9));
  meshLempeng.position.y = 9.25; grupMart.add(meshLempeng);
  [[-14, -6], [12, 5]].forEach(([acX, acZ]) => {
    const meshAc = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.6), sharedStdMat(0x707880, 0.8, 0.3));
    meshAc.position.set(acX, 10.05, acZ);
    grupMart.add(meshAc); });
  const meshPita = new THREE.Mesh(new THREE.BoxGeometry(34, 3.4, 0.4), sharedStdMat(0x12233f, 0.8));
  meshPita.position.set(0, 7.4, 11.1); grupMart.add(meshPita);
  const texTandaMart = makeCanvasTexture(1024, 160, (sapu, wVal, hVal) => {
    sapu.fillStyle = '#12233f'; sapu.fillRect(0, 0, wVal, hVal);
    sapu.fillStyle = '#d8232a'; sapu.fillRect(0, hVal - 18, wVal, 18);
    sapu.fillStyle = '#d8232a';
    sapu.beginPath(); sapu.arc(72, 72, 44, 0, 2 * Math.PI); sapu.fill();
    sapu.fillStyle = '#ffffff';
    sapu.font = 'bold 44px sans-serif'; sapu.textAlign = 'center'; sapu.textBaseline = 'middle';
    sapu.fillText('R', 72, 76);
    sapu.font = 'bold 96px sans-serif';
    sapu.textAlign = 'left';
    sapu.fillText('RONIN MART', 140, 76);
  });
  const meshTanda = new THREE.Mesh(new THREE.PlaneGeometry(32, 3.2), new THREE.MeshBasicMaterial({ map: texTandaMart }));
  meshTanda.position.set(0, 7.4, 11.32); grupMart.add(meshTanda);
  const pijarMart = glowSprite(0x9fd4ff, 17);
  pijarMart.position.set(0, 7.4, 12.4);
  pijarMart.material.opacity = 0;
  grupMart.add(pijarMart);
  glowSpritesList.push(pijarMart);
  const texKacaMart = makeCanvasTexture(512, 64, (sapu, wVal, hVal) => {
    const gradasi = sapu.createLinearGradient(0, 0, 0, hVal);
    gradasi.addColorStop(0, '#8fc3d4');
    gradasi.addColorStop(1, '#3d6d80');
    sapu.fillStyle = gradasi; sapu.fillRect(0, 0, wVal, hVal);
    sapu.fillStyle = 'rgba(20,30,38,.85)'; sapu.fillRect(wVal / 2 - 30, 6, 60, hVal - 6);
    sapu.strokeStyle = 'rgba(240,248,250,.9)';
    sapu.lineWidth = 3;
    for (let panelX = 0; panelX <= wVal; panelX += 42) { sapu.beginPath(); sapu.moveTo(panelX, 0); sapu.lineTo(panelX, hVal); sapu.stroke(); }
    sapu.strokeStyle = 'rgba(240,248,250,.95)'; sapu.strokeRect(wVal / 2 - 30, 6, 60, hVal - 6); });
  const meshKaca = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.1), new THREE.MeshStandardMaterial({ map: texKacaMart, roughness: 0.2, metalness: 0.5 }));
  meshKaca.position.set(0, 1.75, 11.06); grupMart.add(meshKaca);
  const meshKanopi = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 3), sharedStdMat(0x2c3138, 0.8));
  meshKanopi.position.set(0, 3.6, 12.4); grupMart.add(meshKanopi);
  const texPadMart = makeCanvasTexture(1024, 512, (sapu, wVal, hVal) => {
    sapu.fillStyle = '#3a3d40'; sapu.fillRect(0, 0, wVal, hVal);
    for (let idxBintik = 0; idxBintik < 2600; ++idxBintik) { const shadeVal = 46 + Math.floor(rnd() * 26); sapu.fillStyle = `rgba(${shadeVal},${shadeVal},${shadeVal + 3},.16)`; sapu.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); }
    sapu.strokeStyle = 'rgba(245,245,240,.9)';
    sapu.lineWidth = 5;
    for (let garisX = 40; garisX <= wVal - 40; garisX += 74) {
      sapu.beginPath();
      sapu.moveTo(garisX, 10); sapu.lineTo(garisX, 128); sapu.stroke();
      sapu.beginPath(); sapu.moveTo(garisX, hVal - 128); sapu.lineTo(garisX, hVal - 10); sapu.stroke(); }
    sapu.beginPath(); sapu.moveTo(40, 128); sapu.lineTo(wVal - 40, 128); sapu.stroke();
    sapu.beginPath(); sapu.moveTo(40, hVal - 128); sapu.lineTo(wVal - 40, hVal - 128); sapu.stroke(); });
  const meshPad = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), new THREE.MeshStandardMaterial({ map: texPadMart, roughness: 1 }));
  meshPad.rotation.x = -Math.PI / 2; meshPad.position.set(0, 0.04, 27); grupMart.add(meshPad);
  const meshDrive = new THREE.Mesh(new THREE.PlaneGeometry(9, 42), sharedStdMat(0x3a3d40, 1));
  meshDrive.rotation.x = -Math.PI / 2; meshDrive.position.set(0, 0.04, 64); grupMart.add(meshDrive);
  const warnaParkir = [0xc0c4c9, 0x3f8cff, 0xd95555, 0x44484e, 0xf2b21b, 0x5a7d4f];
  const titikParkir = [
    [-22, 19.5, Math.PI], [-14.5, 19.5, Math.PI], [6, 19.5, Math.PI], [18, 35, 0], [25.5, 19.5, Math.PI],
  ];
  titikParkir.forEach(([titikX, titikZ, titikRy], idxTitik) => {
    const meshParkir = constructParkedCar(warnaParkir[idxTitik % warnaParkir.length]);
    meshParkir.position.set(titikX, 0, titikZ);
    meshParkir.rotation.y = titikRy;
    grupMart.add(meshParkir); });
  const matRel = sharedStdMat(0xb0b6bc, 0.4, 0.7);
  [[-18, 31], [14, 16.5]].forEach(([relX, relZ]) => {
    [-1, 1].forEach((tandaSisi) => {
      const meshRel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.6), matRel);
      meshRel.position.set(relX + (tandaSisi * 0.9), 0.75, relZ);
      grupMart.add(meshRel);
      [-1, 1].forEach((tandaUjung) => { const meshTiang = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), matRel); meshTiang.position.set(relX + (tandaSisi * 0.9), 0.38, relZ + (tandaUjung * 1.8)); grupMart.add(meshTiang); }); });
    const meshTroli = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), matRel);
    meshTroli.position.set(relX, 0.45, relZ);
    grupMart.add(meshTroli); });
  const daftarWarnaPeti = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b];
  [-8.5, 8.5].forEach((rakX) => {
    const meshRak = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), sharedStdMat(0x6b4a2f, 0.95));
    meshRak.position.set(rakX, 0.45, 13.2); grupMart.add(meshRak);
    for (let idxPeti = 0; idxPeti < 3; ++idxPeti) {
      const meshPeti = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), sharedStdMat(daftarWarnaPeti[(idxPeti + (rakX > 0 ? 1 : 0)) % 4], 0.9));
      meshPeti.position.set(rakX - 1 + idxPeti, 1.18, 13.2);
      grupMart.add(meshPeti); } });
  const meshPilon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 8), matRel);
  meshPilon.position.set(24, 3.5, 52); grupMart.add(meshPilon);
  const meshTandaPilon = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.3, 0.35), new THREE.MeshBasicMaterial({ map: texTandaMart }));
  meshTandaPilon.position.set(24, 6.8, 52); grupMart.add(meshTandaPilon);
  G.addCollider(mx, mz, 23, 11, 9); }
// ---- hiasan pantai pesisir neon: boardwalk, palem, payung, kursi
// santai dan menara penjaga pantai di sepanjang pesisir selatan (z 549-640) --------------
function constructBeachStrip(G, scene) {
  const titikKenaBangunan = (x, z, nilaiPad) => G.colliders.some((objKol) => Math.abs(x - objKol.x) < objKol.hw + nilaiPad && Math.abs(z - objKol.z) < objKol.hd + nilaiPad);
  const texBoardwalk = makeCanvasTexture(256, 64, (sapu, wVal, hVal) => {
    sapu.fillStyle = '#a97e56'; sapu.fillRect(0, 0, wVal, hVal);
    sapu.strokeStyle = 'rgba(70,45,25,.55)';
    sapu.lineWidth = 3;
    for (let papanX = 0; papanX <= wVal; papanX += 32) { sapu.beginPath(); sapu.moveTo(papanX, 0); sapu.lineTo(papanX, hVal); sapu.stroke(); }
    sapu.strokeStyle = 'rgba(70,45,25,.35)';
    sapu.beginPath(); sapu.moveTo(0, 2); sapu.lineTo(wVal, 2); sapu.moveTo(0, hVal - 2); sapu.lineTo(wVal, hVal - 2); sapu.stroke(); });
  texBoardwalk.wrapS = texBoardwalk.wrapT = THREE.RepeatWrapping;
  texBoardwalk.repeat.set(30, 1);
  const meshBoardwalk = new THREE.Mesh(new THREE.BoxGeometry(1120, 0.1, 6), new THREE.MeshStandardMaterial({ map: texBoardwalk, roughness: 1 }));
  meshBoardwalk.position.set(100, 0.07, 556);
  meshBoardwalk.receiveShadow = true;
  scene.add(meshBoardwalk);
  for (let palemX = -440; palemX <= 640; palemX += 55) {
    const acakX = palemX + rr(-3, 3), acakZ = 549 + rr(-1, 1);
    if (titikKenaBangunan(acakX, acakZ, 1.5)) continue;
    const objPalem = makePalm(rr(4.5, 6.5));
    objPalem.position.set(acakX, 0, acakZ);
    objPalem.rotation.y = rr(0, 6.28);
    scene.add(objPalem); }
  const warnaPayung = [0xff5da2, 0xffb35c, 0x39d5ff, 0xffe14d, 0x7dffb0, 0xff5c39];
  for (let idxPayung = 0; idxPayung < 14; ++idxPayung) {
    let titikX = 0, titikZ = 0, terpasangFlag = false;
    for (let idxCoba = 0; idxCoba < 6 && !terpasangFlag; ++idxCoba) { titikX = rr(-420, 620); titikZ = rr(578, 636); terpasangFlag = !titikKenaBangunan(titikX, titikZ, 2); }
    if (!terpasangFlag) continue;
    const grupPayung = new THREE.Group();
    grupPayung.position.set(titikX, 0, titikZ);
    grupPayung.rotation.y = rr(0, 6.28);
    const meshTiang = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), sharedStdMat(0xd8d8d2, 0.7));
    meshTiang.position.y = 1.15; meshTiang.rotation.z = 0.12; grupPayung.add(meshTiang);
    const meshKanopi = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10), sharedStdMat(pick(warnaPayung), 0.85));
    meshKanopi.position.set(0.14, 2.35, 0); meshKanopi.rotation.z = 0.12; grupPayung.add(meshKanopi);
    for (let idxKursi = 0; idxKursi < 2; ++idxKursi) {
      if (rnd() < 0.3) continue;
      const grupKursi = new THREE.Group();
      grupKursi.position.set(rr(-1.6, 1.6), 0, rr(0.8, 1.8));
      grupKursi.rotation.y = rr(-0.5, 0.5);
      const meshDudukan = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.5), sharedStdMat(0xf2efe4, 0.9));
      meshDudukan.position.y = 0.28; grupKursi.add(meshDudukan);
      const meshSandaran = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.8), sharedStdMat(pick(warnaPayung), 0.9));
      meshSandaran.position.set(0, 0.5, -0.75); meshSandaran.rotation.x = -0.7; grupKursi.add(meshSandaran);
      grupPayung.add(grupKursi); }
    scene.add(grupPayung); }
  [-300, 100, 500].forEach((awalX) => {
    let menaraX = awalX;
    while (titikKenaBangunan(menaraX, 598, 2) && menaraX < awalX + 60) menaraX += 18;
    if (titikKenaBangunan(menaraX, 598, 2)) return;
    const grupMenara = new THREE.Group();
    grupMenara.position.set(menaraX, 0, 598);
    const matPutih = sharedStdMat(0xf2efe4, 0.85);
    const matMerah = sharedStdMat(0xd8232a, 0.85);
    [-1, 1].forEach((sisiX) => {
      [-1, 1].forEach((sisiZ) => {
        const meshKaki = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), matPutih);
        meshKaki.position.set(sisiX * 0.7, 1.1, sisiZ * 0.5);
        grupMenara.add(meshKaki); }); });
    const meshPlatform = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), matPutih);
    meshPlatform.position.y = 2.25; grupMenara.add(meshPlatform);
    const meshPanelBelakang = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.1), matPutih);
    meshPanelBelakang.position.set(0, 2.85, -0.6); grupMenara.add(meshPanelBelakang);
    const meshAtap = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.5), matMerah);
    meshAtap.position.y = 3.5; grupMenara.add(meshAtap);
    const meshRampa = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.6), matPutih);
    meshRampa.position.set(0, 1.1, -1.7); meshRampa.rotation.x = 0.72; grupMenara.add(meshRampa);
    scene.add(grupMenara);
    G.addCollider(menaraX, 598, 1, 0.8, 3.5); }); }
// ---- ronde kepadatan --------------------------------------------------
// Uji titik / tapak terhadap daftar collider bersama, mencerminkan
// pola titikKenaBangunan milik constructBeachStrip.
const densityPointHit = (G, x, z, padVal) => G.colliders.some((objKol) => Math.abs(x - objKol.x) < objKol.hw + padVal && Math.abs(z - objKol.z) < objKol.hd + padVal);
const densityFootHit = (G, x, z, halfW, halfD, padVal) => G.colliders.some((objKol) => Math.abs(x - objKol.x) < (objKol.hw + halfW) + padVal && Math.abs(z - objKol.z) < (objKol.hd + halfD) + padVal);
const applyCastShadow = (rootObj) => { rootObj.traverse((objNode) => { if (objNode.isMesh) objNode.castShadow = true; }); return rootObj; };
// 1. FRONTASE CORAL: baris dekorasi kontinu pada kedua sisi jalan
// bulevar z=495, mengisi bentangan antar-blok yang kosong. Bidang
// fasad duduk pada z=470 (baris utara, menghadap +z/selatan ke jalan)
// dan z=518 (baris selatan, menghadap -z/utara), jadi koridor jalan
// tetap bersih sementara tak ada foto setinggi jalan di sepanjang
// bulevar yang kebanyakan tanah kosong.
function constructBoulevardFrontage(G, scene) {
  const hitunganSisi = { north: 0, south: 0 };
  const opsiTandaFrontase = [
    ['HOTEL CORAL', '#ffb35c'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'],
    ['CLUB NEON', '#e879ff'], ['RAMEN', '#ff5c39'], ['PAWN', '#ffe14d'],
  ];
  [{ key: 'north', facadeZ: 470, faceDir: 1 }, { key: 'south', facadeZ: 518, faceDir: -1 }].forEach((specSisi) => {
    let warnaTerakhir = null, warnaSebelumnya = null, kursorX = -560;
    while (kursorX < 640) {
      let lebarBentang = rr(18, 30);
      if (kursorX + lebarBentang > 640) lebarBentang = 640 - kursorX;
      if (lebarBentang < 10) break;
      const dalamBentang = rr(12, 18);
      const tinggiBentang = rr(10, 26);
      const pusatX = kursorX + (lebarBentang / 2), pusatZ = specSisi.facadeZ - (specSisi.faceDir * (dalamBentang / 2));
      // Koridor jalan melintang: lewati bentangan apa pun yang mengganggu jalan.
      const nilaiJalan = G.roadX.find((koordinatJalan) => pusatX - lebarBentang / 2 < koordinatJalan + 14 && pusatX + lebarBentang / 2 > koordinatJalan - 14);
      if (nilaiJalan !== undefined) { kursorX = nilaiJalan + 14 + rr(0.5, 2); continue; }
      if (densityFootHit(G, pusatX, pusatZ, lebarBentang / 2, dalamBentang / 2, 2)) { kursorX += lebarBentang + rr(1.5, 5); continue; }
      // Siklus pastel dengan aturan tanpa-ulang-berdampingan milik
      // loop tersemai — diperluas ke warna dua bangunan ke belakang (penjaga Coral).
      let warnaDasar = pick(VICE.coralPastels);
      if (warnaDasar === warnaTerakhir) warnaDasar = VICE.coralPastels[(VICE.coralPastels.indexOf(warnaDasar) + 1) % VICE.coralPastels.length];
      if (warnaDasar === warnaSebelumnya) warnaDasar = VICE.coralPastels[(VICE.coralPastels.indexOf(warnaDasar) + 1) % VICE.coralPastels.length];
      warnaSebelumnya = warnaTerakhir;
      warnaTerakhir = warnaDasar;
      const texFasad = buildBuildingTexture(warnaDasar, rr(0.25, 0.42));
      texFasad.wrapS = texFasad.wrapT = THREE.RepeatWrapping;
      const matFasad = new THREE.MeshStandardMaterial({
        map: texFasad, emissive: 0xffc873, emissiveMap: texFasad, emissiveIntensity: 0, roughness: 0.9,
      });
      matFasad.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
      if (!G.buildingMats) G.buildingMats = [];
      G.buildingMats.push(matFasad);
      const dasarY = groundH(pusatX, pusatZ);
      const meshBangunan = new THREE.Mesh(new THREE.BoxGeometry(lebarBentang, tinggiBentang, dalamBentang), matFasad);
      meshBangunan.position.set(pusatX, (tinggiBentang / 2) + dasarY, pusatZ);
      meshBangunan.castShadow = true;
      meshBangunan.receiveShadow = true;
      scene.add(meshBangunan);
      // Siluet dekorasi berundak, seperti baris pantai tersemai.
      const tinggiUndakan = rr(1.6, 3);
      const meshUndakan = new THREE.Mesh(new THREE.BoxGeometry(lebarBentang * 0.62, tinggiUndakan, dalamBentang * 0.62), matFasad);
      meshUndakan.position.set(pusatX, tinggiBentang + (tinggiUndakan / 2) + dasarY, pusatZ);
      meshUndakan.castShadow = true;
      scene.add(meshUndakan);
      // Trim neon, didaftarkan persis seperti bangunan Coral tersemai.
      const warnaNeon = pick(VICE.neonTrim);
      const matTrim = new THREE.MeshStandardMaterial({ color: warnaNeon, emissive: warnaNeon, emissiveIntensity: 0, roughness: 0.6 });
      const meshTrim = new THREE.Mesh(new THREE.BoxGeometry(lebarBentang + 0.35, 0.3, dalamBentang + 0.35), matTrim);
      meshTrim.position.set(pusatX, (tinggiBentang * 0.84) + dasarY, pusatZ);
      meshTrim.castShadow = true;
      scene.add(meshTrim);
      if (!G.neonTrimMats) G.neonTrimMats = [];
      G.neonTrimMats.push(matTrim);
      const pijarTrim = glowSprite(new THREE.Color(warnaNeon), 12);
      pijarTrim.position.set(pusatX, (tinggiBentang * 0.84) + dasarY, pusatZ);
      pijarTrim.material.opacity = 0;
      scene.add(pijarTrim);
      glowSpritesList.push(pijarTrim);
      // Tanda toko + tenda miring pada sisi yang menghadap bulevar.
      const garisFasadZ = specSisi.facadeZ;
      if (rnd() < 0.6) {
        const [teksTanda, warnaTanda] = pick(opsiTandaFrontase);
        const meshTanda = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, lebarBentang * 0.7), 3.4), new THREE.MeshBasicMaterial({ map: buildSignTexture(teksTanda, '#101018', warnaTanda) }));
        meshTanda.position.set(pusatX, 4.6 + dasarY, garisFasadZ + (specSisi.faceDir * 0.12));
        if (specSisi.faceDir < 0) meshTanda.rotation.y = Math.PI;
        scene.add(meshTanda);
        const pijarTanda = glowSprite(new THREE.Color(warnaTanda), 13);
        pijarTanda.position.set(pusatX, 4.6 + dasarY, garisFasadZ + (specSisi.faceDir * 0.05));
        pijarTanda.material.opacity = 0;
        scene.add(pijarTanda);
        glowSpritesList.push(pijarTanda); }
      // Aksen tenda bergantian menurut paritas indeks bangunan
      // (hitunganSisi[specSisi.key] ialah indeks bangunan ini pada
      // sisinya, dinaikkan pada akhir loop) — bangunan genap mengambil
      // aksen hangat, bangunan ganjil yang sejuk, jadi toko
      // bertetangga tak pernah berbagi keluarga aksen.
      const warnaTenda = hitunganSisi[specSisi.key] % 2 === 0 ? pick(['#ff5da2', '#ffb35c']) : pick(['#39d5ff', '#7dffb0']);
      const matTenda = new THREE.MeshStandardMaterial({ color: new THREE.Color(warnaTenda), roughness: 0.85 });
      const meshTenda = new THREE.Mesh(new THREE.BoxGeometry(Math.min(15, lebarBentang * 0.72), 0.15, 2.2), matTenda);
      meshTenda.position.set(pusatX, 3.6 + dasarY, garisFasadZ + (specSisi.faceDir * 1.05));
      meshTenda.rotation.x = specSisi.faceDir * 0.3;
      meshTenda.castShadow = true;
      scene.add(meshTenda);
      G.addCollider(pusatX, pusatZ, lebarBentang / 2, dalamBentang / 2, tinggiBentang);
      ++hitunganSisi[specSisi.key];
      kursorX += lebarBentang + rr(1.5, 5);
    } });
  G.frontageCounts = hitunganSisi;
  return hitunganSisi; }
// 2. Palem lebih rapat pada kedua trotoar bulevar (z=481 / z=509).
function constructBoulevardPalms(G, scene) {
  let jumlahTambah = 0;
  for (let palemX = -560; palemX <= 640; palemX += 20) {
    if (G.roadX.some((nilaiJalan) => Math.abs(palemX - nilaiJalan) < 16)) continue;
    [481, 509].forEach((trotoarZ) => {
      if (densityPointHit(G, palemX, trotoarZ, 1.5)) return;
      const objPalem = makePalm(rr(4.5, 6.5));
      objPalem.position.set(palemX, groundH(palemX, trotoarZ), trotoarZ);
      objPalem.rotation.y = rr(0, 6.28);
      scene.add(objPalem);
      ++jumlahTambah; }); }
  G.boulevardPalmsAdded = jumlahTambah;
  return jumlahTambah; }
// 2b. Palem berkotak penanam pada trotoar SELATAN bulevar, seperti
// bingkai konsep itu: tiap palem terbit dari kotak penanam beton
// pucat persegi (1.6 x 0.55 x 1.6 m) dengan gumpalan semak hijau kecil
// terselip pada dasarnya. Baris pada z=513 — antara tepi selatan
// jalan dan frontase selatan z=518 — tiap ~40 m dari x=-320 ke 520.
// Lewati: jalan melintang (|x-r|<13 untuk tiap jalan vertikal),
// collider apa pun dalam pad 2, dan tapak titik kumpul GS1
// (|x-100|<10) supaya gugus sosial mempertahankan lantai terbukanya.
function makePlanterPalmUnit() {
  const grupUnit = new THREE.Group();
  const meshKotak = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.6), sharedStdMat(0xd8d2c4, 1));
  meshKotak.position.y = 0.275; grupUnit.add(meshKotak);
  const meshTanah = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), sharedStdMat(0x4a3826, 1));
  meshTanah.position.y = 0.56; grupUnit.add(meshTanah);
  const matSemak = new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true });
  [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]].forEach(([sudutX, sudutZ]) => {
    const meshGumpal = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.22, 0.3), 1), matSemak);
    meshGumpal.position.set(sudutX, 0.68, sudutZ);
    grupUnit.add(meshGumpal); });
  const objPalem = makePalm(rr(4.5, 6));
  objPalem.position.y = 0.55;
  objPalem.rotation.y = rr(0, 6.28);
  grupUnit.add(objPalem);
  return applyCastShadow(grupUnit); }
function constructBoulevardPlanters(G, scene) {
  let jumlahTambah = 0;
  for (let penanamX = -320; penanamX <= 520; penanamX += 40) {
    if (G.roadX.some((nilaiJalan) => Math.abs(penanamX - nilaiJalan) < 13)) continue;
    if (Math.abs(penanamX - 100) < 10) continue;
    if (densityPointHit(G, penanamX, 513, 2)) continue;
    const objUnit = makePlanterPalmUnit();
    objUnit.position.set(penanamX, groundH(penanamX, 513), 513);
    scene.add(objUnit);
    ++jumlahTambah; }
  G.boulevardPlantersAdded = jumlahTambah;
  return jumlahTambah; }
// 3. Titik kumpul: bangku + penanam (plus kios vendor pada dua).
function makeBenchUnit() {
  const grupBangku = new THREE.Group();
  const matRangka = sharedStdMat(0x3a3f45, 0.6, 0.5), matKayu = sharedStdMat(0x8a6844, 0.95);
  [-1, 1].forEach((tandaSisi) => {
    const meshKakiDepan = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), matRangka);
    meshKakiDepan.position.set(tandaSisi * 0.95, 0.22, 0.28);
    grupBangku.add(meshKakiDepan);
    const meshKakiBelakang = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), matRangka);
    meshKakiBelakang.position.set(tandaSisi * 0.95, 0.42, -0.28);
    grupBangku.add(meshKakiBelakang); });
  for (let idxBilah = 0; idxBilah < 3; ++idxBilah) { const meshBilah = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.16), matKayu); meshBilah.position.set(0, 0.45, -0.2 + (idxBilah * 0.22)); grupBangku.add(meshBilah); }
  for (let idxSandaran = 0; idxSandaran < 2; ++idxSandaran) { const meshSandaran = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.05), matKayu); meshSandaran.position.set(0, 0.68 + (idxSandaran * 0.24), -0.32); meshSandaran.rotation.x = -0.18; grupBangku.add(meshSandaran); }
  return applyCastShadow(grupBangku); }
function makePlanterUnit() {
  const grupPenanam = new THREE.Group();
  const meshKotak = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), sharedStdMat(0x9a8a72, 1));
  meshKotak.position.y = 0.28; grupPenanam.add(meshKotak);
  const meshSemak = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true }));
  meshSemak.position.y = 0.85; grupPenanam.add(meshSemak);
  return applyCastShadow(grupPenanam); }
function makeStallUnit() {
  const grupKios = new THREE.Group();
  const matTiang = sharedStdMat(0x6b4a2f, 0.9);
  [-1, 1].forEach((sisiX) => {
    [-1, 1].forEach((sisiZ) => {
      const meshTiang = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), matTiang);
      meshTiang.position.set(sisiX * 1.5, 1.25, sisiZ * 0.9);
      grupKios.add(meshTiang); }); });
  // Kanopi bergaris: garis koral / putih, keluarga payung pantai.
  const texKanopiKios = makeCanvasTexture(128, 128, (sapu, wVal, hVal) => {
    for (let idxGaris = 0; idxGaris < 8; ++idxGaris) { sapu.fillStyle = idxGaris % 2 ? '#f7f2e6' : '#ff7a6b'; sapu.fillRect(idxGaris * (wVal / 8), 0, wVal / 8, hVal); } });
  texKanopiKios.wrapS = THREE.RepeatWrapping;
  texKanopiKios.wrapT = THREE.RepeatWrapping;
  const meshKanopi = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 2.4), new THREE.MeshStandardMaterial({ map: texKanopiKios, roughness: 0.9 }));
  meshKanopi.position.y = 2.55; meshKanopi.rotation.z = 0.06; grupKios.add(meshKanopi);
  const meshKonter = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.1), sharedStdMat(0xa97e56, 0.95));
  meshKonter.position.set(0, 0.45, 0.35); grupKios.add(meshKonter);
  const warnaPetiKios = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b];
  for (let idxPeti = 0; idxPeti < 4; ++idxPeti) {
    const meshPeti = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), sharedStdMat(warnaPetiKios[idxPeti % 4], 0.9));
    meshPeti.position.set(-1.1 + (idxPeti * 0.72), 1.1, 0.35);
    grupKios.add(meshPeti); }
  return applyCastShadow(grupKios); }
function constructGatherSpots(G, scene) {
  const kandidatTitik = [
    { x: 100, z: 511, ry: Math.PI, stall: true },
    { x: 300, z: 552, ry: 0, stall: true },
    { x: -60, z: -238, ry: Math.PI, stall: false },
    { x: -210, z: 481, ry: 0, stall: false },
  ];
  G.gatherSpots = [];
  kandidatTitik.forEach((objKandidat) => {
    let terpasangX = null;
    for (let idxLangkah = 0; idxLangkah <= 10 && terpasangX === null; ++idxLangkah) {
      const daftarGeser = idxLangkah === 0 ? [0] : [idxLangkah * 4, -idxLangkah * 4];
      for (const nilaiGeser of daftarGeser) {
        const cobaX = objKandidat.x + nilaiGeser;
        if (!densityPointHit(G, cobaX, objKandidat.z, 2.5)) { terpasangX = cobaX; break; } } }
    if (terpasangX === null) return;
    const grupTitik = new THREE.Group();
    grupTitik.position.set(terpasangX, groundH(terpasangX, objKandidat.z), objKandidat.z);
    grupTitik.rotation.y = objKandidat.ry;
    [-1.9, 1.9].forEach((bangkuX) => { const objBangku = makeBenchUnit(); objBangku.position.set(bangkuX, 0, 0); grupTitik.add(objBangku); });
    [-3.6, 3.6].forEach((penanamX) => { const objPenanam = makePlanterUnit(); objPenanam.position.set(penanamX, 0, 0.25); grupTitik.add(objPenanam); });
    if (objKandidat.stall) {
      const objKios = makeStallUnit();
      objKios.position.set(0, 0, -2.4);
      grupTitik.add(objKios);
      const kosRy = Math.cos(objKandidat.ry), sinRy = Math.sin(objKandidat.ry);
      const kiosDuniaX = terpasangX + ((0 * kosRy) + (-2.4 * sinRy)), kiosDuniaZ = objKandidat.z + ((-0 * sinRy) + (-2.4 * kosRy));
      G.addCollider(kiosDuniaX, kiosDuniaZ, 1.8, 1.2, 2.6);
    }
    scene.add(grupTitik);
    const rekTitik = {};
    rekTitik.x = terpasangX; rekTitik.z = objKandidat.z; rekTitik.ry = objKandidat.ry; rekTitik.stall = objKandidat.stall;
    G.gatherSpots.push(rekTitik); });
  return G.gatherSpots; }
// 4. Baris Hoshino: baris rumah kontinu mengapit jalan z=-330.
function constructHoshinoRows(G, scene) {
  let jumlahTambah = 0;
  const specBarisList = [{ z: -378, face: 1 }, { z: -284, face: -1 }];
  specBarisList.forEach((specBaris) => {
    for (let rumahX = -520; rumahX <= -180; rumahX += 24) {
      if (Math.abs(rumahX + 495) < 15 || Math.abs(rumahX + 330) < 15) continue;
      if (densityFootHit(G, rumahX, specBaris.z, 6, 5, 2)) continue;
      constructHouse(G, scene, rumahX, specBaris.z, specBaris.face);
      ++jumlahTambah; } });
  G.hoshinoHousesAdded = jumlahTambah;
  return jumlahTambah; }
// 5. TAMAN: SATU taman pameran yang disengaja — satu-satunya rumput
// baru di kota ini. Pusat kandidat dipindai DALAM URUTAN terhadap
// daftar collider saja (tak ada rnd() dalam pindai, jadi urutan RNG
// tersemai tiap pembangun lain tak tersentuh); pusat pertama yang
// tapak 76x76 m-nya bersih collider (pad 2) menang.
const PARK_CENTRE_CANDIDATES = [
  [82, 415], [-82, 415], [82, 82], [-82, 82], [247, 82],
];
function makeRoundTree(heightVal, colourVal) {
  const grupPohon = new THREE.Group();
  const meshBatang = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, heightVal * 0.45, 7), sharedStdMat(0x6b4a2f, 1));
  meshBatang.position.y = heightVal * 0.225; grupPohon.add(meshBatang);
  const matKanopi = new THREE.MeshStandardMaterial({ color: colourVal, roughness: 1, flatShading: true });
  const specGumpalList = [
    [0, 1, 0, 1.6], [0.95, 1.22, 0.3, 1.2], [-0.9, 1.18, -0.4, 1.05],
  ];
  specGumpalList.forEach(([gumpalX, gumpalY, gumpalZ, gumpalR]) => {
    const meshGumpal = new THREE.Mesh(new THREE.SphereGeometry(gumpalR, 10, 8), matKanopi);
    meshGumpal.scale.y = 0.75;
    meshGumpal.position.set(gumpalX, (heightVal * 0.45) + (gumpalY * (heightVal * 0.28)), gumpalZ);
    grupPohon.add(meshGumpal); });
  return applyCastShadow(grupPohon); }
function constructPark(G, scene) {
  let tamanX = PARK_CENTRE_CANDIDATES[0][0], tamanZ = PARK_CENTRE_CANDIDATES[0][1], ketemuFlag = false;
  const daftarLewati = [];
  for (const [kandidatX, kandidatZ] of PARK_CENTRE_CANDIDATES) {
    if (!densityFootHit(G, kandidatX, kandidatZ, 38, 38, 2)) { tamanX = kandidatX; tamanZ = kandidatZ; ketemuFlag = true; break; }
    daftarLewati.push([kandidatX, kandidatZ]); }
  G.parkScanSkipped = daftarLewati;
  G.parkFallbackUsed = !ketemuFlag;
  const dasarY = groundH(tamanX, tamanZ);
  const grupTaman = new THREE.Group();
  grupTaman.position.set(tamanX, dasarY, tamanZ);
  scene.add(grupTaman);
  // (a) basis plaza: 76x76 paving
  const meshPlaza = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), makePavingMat(19, 19, 0xd8d2c2));
  meshPlaza.rotation.x = -Math.PI / 2; meshPlaza.position.y = 0.04; meshPlaza.receiveShadow = true; grupTaman.add(meshPlaza);
  // (b) jalur silang: dua strip paving lebih terang 6 m melintasi pusat
  const meshJalurNS = new THREE.Mesh(new THREE.PlaneGeometry(6, 76), makePavingMat(2, 19, 0xffffff));
  meshJalurNS.rotation.x = -Math.PI / 2; meshJalurNS.position.y = 0.07; meshJalurNS.receiveShadow = true; grupTaman.add(meshJalurNS);
  const meshJalurEW = new THREE.Mesh(new THREE.PlaneGeometry(76, 6), makePavingMat(19, 2, 0xffffff));
  meshJalurEW.rotation.x = -Math.PI / 2; meshJalurEW.position.y = 0.07; meshJalurEW.receiveShadow = true; grupTaman.add(meshJalurEW);
  // (c) panel LAWN: empat sisipan kuadran antara jalur —
  // SATU-SATUNYA rumput baru yang ditambahkan ronde ini (hijau taman jenuh).
  [-1, 1].forEach((kuadranX) => {
    [-1, 1].forEach((kuadranZ) => {
      const meshLawn = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), makeGrassMat(8, 8));
      meshLawn.rotation.x = -Math.PI / 2;
      meshLawn.position.set(kuadranX * 19.5, 0.055, kuadranZ * 19.5);
      meshLawn.receiveShadow = true;
      grupTaman.add(meshLawn); }); });
  // (d) AIR MANCUR pada pusat persis
  const grupMancur = new THREE.Group();
  grupTaman.add(grupMancur);
  const matBeton = sharedStdMat(0xe6e0d0, 0.9);
  const meshCekungan = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 24), matBeton);
  meshCekungan.position.y = 0.4; grupMancur.add(meshCekungan);
  const meshBibir = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 8, 24), matBeton);
  meshBibir.rotation.x = Math.PI / 2; meshBibir.position.y = 0.82; grupMancur.add(meshBibir);
  const matAirMancur = new THREE.MeshStandardMaterial({ color: 0x3fa7d6, transparent: true, opacity: 0.9, roughness: 0.15 });
  const meshAir = new THREE.Mesh(new THREE.CircleGeometry(3.7, 24), matAirMancur);
  meshAir.rotation.x = -Math.PI / 2; meshAir.position.y = 0.72; grupMancur.add(meshAir);
  const meshPilar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.5, 12), matBeton);
  meshPilar.position.y = 1.4; grupMancur.add(meshPilar);
  const meshMangkuk = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.9, 0.35, 16), matBeton);
  meshMangkuk.position.y = 2.25; grupMancur.add(meshMangkuk);
  const meshAirMangkuk = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), matAirMancur);
  meshAirMangkuk.rotation.x = -Math.PI / 2; meshAirMangkuk.position.y = 2.44; grupMancur.add(meshAirMangkuk);
  applyCastShadow(grupMancur);
  G.addCollider(tamanX, tamanZ, 4.4, 4.4, 2.4);
  // (e) POHON: 14 — palem + pohon bundar pada kuadran lawn, palem
  // pada dua sudut plaza. Titik deterministik (tak ada rnd() di sini).
  const daftarTitikPohon = [];
  [-1, 1].forEach((kuadranX) => {
    [-1, 1].forEach((kuadranZ) => {
      daftarTitikPohon.push([kuadranX * 12, kuadranZ * 12], [kuadranX * 27, kuadranZ * 10], [kuadranX * 10, kuadranZ * 27]); }); });
  daftarTitikPohon.push([-34, -34], [34, 34]);
  const warnaPohonBundar = [0x3f9e4d, 0x359146, 0x4caf50];
  daftarTitikPohon.forEach(([titikX, titikZ], idxPohon) => {
    const objPohon = idxPohon % 3 === 2 ? makePalm(5 + (idxPohon % 2)) : makeRoundTree(4.6 + ((idxPohon % 3) * 0.5), warnaPohonBundar[idxPohon % 3]);
    objPohon.position.set(titikX, 0, titikZ);
    objPohon.rotation.y = (idxPohon * 1.7) % 6.28;
    grupTaman.add(objPohon); });
  // (f) BANGKU: 6 di sepanjang jalur, tiap diputar menghadap air mancur
  // (konstruksi bangku yang sama seperti titik kumpul — makeBenchUnit).
  [[10, 5.5], [-10, 5.5], [10, -5.5], [-10, -5.5], [5.5, 10], [-5.5, -10]].forEach(([bangkuX, bangkuZ]) => {
    const objBangku = makeBenchUnit();
    objBangku.position.set(bangkuX, 0, bangkuZ);
    objBangku.rotation.y = Math.atan2(-bangkuX, -bangkuZ);
    grupTaman.add(objBangku); });
  // (g) SATU kios vendor pada tepi plaza timur (pola titik kumpul)
  const kiosDuniaX = tamanX + 32;
  const kiosDuniaZ = tamanZ + 8;
  const objKios = makeStallUnit();
  objKios.position.set(32, 0, 8);
  objKios.rotation.y = Math.PI / 2;
  grupTaman.add(objKios);
  G.addCollider(kiosDuniaX, kiosDuniaZ, 1.8, 1.8, 2.6);
  // (h) 4 tiang lampu pada sudut plaza (visual saja, gaya lampu jalan)
  [[-35, -35], [35, -35], [-35, 35], [35, 35]].forEach(([lampuX, lampuZ]) => {
    const grupLampu = new THREE.Group();
    const meshTiang = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5, 6), sharedStdMat(0x3a3f45, 0.8, 0.5));
    meshTiang.position.y = 2.5; grupLampu.add(meshTiang);
    const meshKepala = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc98a, emissiveIntensity: 0.4, roughness: 0.5 }));
    meshKepala.position.y = 5.05; grupLampu.add(meshKepala);
    grupLampu.position.set(lampuX, 0, lampuZ);
    applyCastShadow(grupLampu);
    grupTaman.add(grupLampu); });
  // (i) petak bunga: 4 kotak rendah dalam warna terang di sepanjang jalur
  const daftarWarnaBunga = [0xff5da2, 0xffb35c, 0xffe14d, 0xff5da2];
  [[20, 4.4, 0], [-20, 4.4, 0], [20, -4.4, 0], [-4.4, -20, Math.PI / 2]].forEach(([petakX, petakZ, petakRy], idxPetak) => {
    const grupPetak = new THREE.Group();
    const meshKotakPetak = new THREE.Mesh(new THREE.BoxGeometry(4, 0.35, 1.2), sharedStdMat(0x9a8a72, 1));
    meshKotakPetak.position.y = 0.18; grupPetak.add(meshKotakPetak);
    const meshAtasPetak = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 1.0),
      new THREE.MeshStandardMaterial({ color: daftarWarnaBunga[idxPetak], roughness: 0.9, flatShading: true }));
    meshAtasPetak.position.y = 0.42; grupPetak.add(meshAtasPetak);
    grupPetak.position.set(petakX, 0, petakZ);
    grupPetak.rotation.y = petakRy;
    applyCastShadow(grupPetak);
    grupTaman.add(grupPetak); });
  const rekTitikTaman = {};
  rekTitikTaman.x = tamanX; rekTitikTaman.z = tamanZ; rekTitikTaman.stallX = kiosDuniaX; rekTitikTaman.stallZ = kiosDuniaZ;
  G.parkSpot = rekTitikTaman;
  const rekHitungTaman = {};
  rekHitungTaman.trees = daftarTitikPohon.length; rekHitungTaman.benches = 6; rekHitungTaman.lamps = 4;
  rekHitungTaman.flowerBeds = 4; rekHitungTaman.stalls = 1; rekHitungTaman.fountains = 1;
  G.parkCounts = rekHitungTaman;
  return G.parkSpot; }
let streetlampGlowList = [];
export function buildWorld(G) {
  const scene = G.scene;
  G.roadX = [
    -660, -495, -330, -165, 0, 165, 330, 495, 660,
  ];
  G.roadZ = [
    -660, -495, -330, -165, 0, 165, 330, 495, 660,
  ];
  G.touge = TOUGE_POINTS.map((objTitik) => ({ x: objTitik[0], z: objTitik[1] }));
  streetlampGlowList = [];
  glowSpritesList = [];
  skyLastHour = -10;
  // Kubah langit gradien (digambar ulang murah oleh updateWorld saat jam bergerak).
  skySheet = document.createElement('canvas');
  skySheet.width = 16;
  skySheet.height = 512;
  skyBrush = skySheet.getContext('2d');
  skyTextureObj = new THREE.CanvasTexture(skySheet);
  skyTextureObj.colorSpace = THREE.SRGBColorSpace;
  computeSkyColors(G.timeOfDay || 10.5);
  paintSkyDome();
  skyDome = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), new THREE.MeshBasicMaterial({ map: skyTextureObj, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyDome.renderOrder = -1;
  scene.add(skyDome);
  scene.fog = new THREE.Fog(0xcfe4ec, 220, 1500);
  // Basis tanah
  const texTanah = buildGroundTexture();
  texTanah.wrapS = texTanah.wrapT = THREE.RepeatWrapping;
  texTanah.repeat.set(40, 40);
  if (G.maxAniso) texTanah.anisotropy = G.maxAniso;
  const meshTanah = new THREE.Mesh(new THREE.PlaneGeometry(1320, 1320), new THREE.MeshStandardMaterial({ map: texTanah, roughness: 1 }));
  meshTanah.rotation.x = -Math.PI / 2;
  meshTanah.receiveShadow = true;
  scene.add(meshTanah);
  // Mesh bukit di bawah rute touge
  const geoBukit = new THREE.PlaneGeometry(700, 700, 24, 24);
  { const attrPos = geoBukit.attributes.position; for (let idxTitik = 0; idxTitik < attrPos.count; ++idxTitik) { const titikVx = attrPos.getX(idxTitik) - 330, titikVz = -(attrPos.getY(idxTitik)) - 330; attrPos.setZ(idxTitik, groundH(titikVx, titikVz)); } geoBukit.computeVertexNormals(); }
  const meshBukit = new THREE.Mesh(geoBukit, makeGrassMat(28, 28));
  meshBukit.rotation.x = -Math.PI / 2;
  meshBukit.position.set(-330, 0.02, -330);
  meshBukit.receiveShadow = true;
  scene.add(meshBukit);
  // Bidang air
  const meshAir = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: 0x1d6fb8, transparent: true, opacity: 0.95, roughness: 0.3, metalness: 0.2 }));
  meshAir.rotation.x = -Math.PI / 2;
  meshAir.position.y = -0.4;
  scene.add(meshAir);
  G.water = meshAir;
  // Pantai — tekstur pasir hangat terang (boardwalk duduk di atas)
  const texPasirPantai = buildSandTexture();
  texPasirPantai.repeat.set(66, 5);
  if (G.maxAniso) texPasirPantai.anisotropy = G.maxAniso;
  const meshPantai = new THREE.Mesh(new THREE.PlaneGeometry(1320, 100), new THREE.MeshStandardMaterial({ map: texPasirPantai, roughness: 1 }));
  meshPantai.rotation.x = -Math.PI / 2;
  meshPantai.position.set(0, 0.03, 610);
  meshPantai.receiveShadow = true;
  scene.add(meshPantai);
  // ---- overlay tanah per zona (y .015-.02: di atas tanah basis pada 0,
  // di bawah jalan .05 / trotoar .06 / marka .07+; tata letak dan
  // collider tak tersentuh). Blok Coral + Neon Mile + Portside terbaca
  // sebagai plaza lempeng paving, Hoshino Heights sebagai rumput
  // jenuh — tak ada tanah menghadap kamera yang dibiarkan sebagai
  // bidang tanah datar, latar depan bulevar pantai termasuk.
  {
    const tambahOverlayZona = (zonaX, zonaZ, matZona) => {
      const meshOverlay = new THREE.Mesh(new THREE.PlaneGeometry(660, 660), matZona);
      meshOverlay.rotation.x = -Math.PI / 2;
      meshOverlay.position.set(zonaX, 0.018, zonaZ);
      meshOverlay.receiveShadow = true;
      scene.add(meshOverlay); };
    // Ulang 66 di atas bidang 660 m = ubin 10 m / lempeng 5 m
    // (pengulangan 55 lebih awal terbaca sebagai ubin raksasa 12 m /
    // lempeng 6 m pada ketinggian jalan di sini).
    const zonaPaveA = buildPavingTexture(); zonaPaveA.repeat.set(66, 66);
    if (G.maxAniso) zonaPaveA.anisotropy = G.maxAniso;
    tambahOverlayZona(330, 330, new THREE.MeshStandardMaterial({ map: zonaPaveA, roughness: 1 }));
    const zonaPaveB = buildPavingTexture(); zonaPaveB.repeat.set(66, 66);
    if (G.maxAniso) zonaPaveB.anisotropy = G.maxAniso;
    tambahOverlayZona(330, -330, new THREE.MeshStandardMaterial({ map: zonaPaveB, roughness: 1 }));
    const zonaPaveC = buildPavingTexture(); zonaPaveC.repeat.set(66, 66);
    if (G.maxAniso) zonaPaveC.anisotropy = G.maxAniso;
    tambahOverlayZona(-330, 330, new THREE.MeshStandardMaterial({ map: zonaPaveC, roughness: 1 }));
    // Hoshino Heights tak butuh overlay: mesh bukit menutupi seluruh
    // kuadran itu dan kini membawa tekstur rumput, begitu juga halaman rumah di sini.
  }
  // Jalan
  // Aspal bermarka: tekstur U = melintasi jalan, V = sepanjang
  // panjangnya. Penampang 4 lajur: garis tepi solid, pembagi lajur
  // putus-putus duduk pada U .25/.75 (dash mengisi 45% ubin V, jadi
  // ia berubin mulus), garis pusat solid ganda kuning pucat.
  // Noise bintik/retak di atas basis seperti sebelumnya.
  const texAspal = makeCanvasTexture(64, 256, (sapu, wVal, hVal) => {
    sapu.fillStyle = '#33373c'; sapu.fillRect(0, 0, wVal, hVal);
    for (let idxBintik = 0; idxBintik < 700; ++idxBintik) { const shadeVal = 40 + Math.floor(rnd() * 36); sapu.fillStyle = `rgba(${shadeVal},${shadeVal},${shadeVal + 4},.18)`; sapu.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); }
    for (let idxKilau = 0; idxKilau < 130; ++idxKilau) { sapu.fillStyle = 'rgba(255,255,255,.045)'; sapu.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); }
    sapu.strokeStyle = 'rgba(0,0,0,.16)';
    sapu.lineWidth = 1;
    for (let idxRetak = 0; idxRetak < 7; ++idxRetak) { sapu.beginPath(); let retakX = rnd() * wVal, retakY = rnd() * hVal; sapu.moveTo(retakX, retakY); for (let idxSeg = 0; idxSeg < 3; ++idxSeg) { retakX += rr(-9, 9); retakY += rr(4, 14); sapu.lineTo(retakX, retakY); } sapu.stroke(); }
    const gambarGarisJalan = (posisiU, warnaGaris, fraksiLebar) => { sapu.fillStyle = warnaGaris; const lebarGaris = Math.max(1, wVal * fraksiLebar); sapu.fillRect(wVal * posisiU - lebarGaris / 2, 0, lebarGaris, hVal); };
    gambarGarisJalan(0.03, '#d8d8d2', 0.012);
    gambarGarisJalan(0.97, '#d8d8d2', 0.012);
    gambarGarisJalan(0.478, '#e8d9a0', 0.008);
    gambarGarisJalan(0.522, '#e8d9a0', 0.008);
    sapu.fillStyle = '#ffffff';
    [0.25, 0.75].forEach((posisiU) => { const lebarGaris = Math.max(1, wVal * 0.010); sapu.fillRect(wVal * posisiU - lebarGaris / 2, 0, lebarGaris, hVal * 0.45); }); });
  texAspal.wrapS = texAspal.wrapT = THREE.RepeatWrapping;
  if (G.maxAniso) texAspal.anisotropy = G.maxAniso;
  const matAspal = new THREE.MeshStandardMaterial({ map: texAspal, roughness: 0.95 });
  const matAspalPolos = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.95 });
  // Trotoar memakai tekstur lempeng paving, diubin sepanjang panjangnya.
  const texTrotoarV = buildPavingTexture();
  texTrotoarV.repeat.set(1, 110);
  if (G.maxAniso) texTrotoarV.anisotropy = G.maxAniso;
  const matTrotoarV = new THREE.MeshStandardMaterial({ map: texTrotoarV, roughness: 1 });
  const texTrotoarH = buildPavingTexture();
  texTrotoarH.repeat.set(110, 1);
  if (G.maxAniso) texTrotoarH.anisotropy = G.maxAniso;
  const matTrotoarH = new THREE.MeshStandardMaterial({ map: texTrotoarH, roughness: 1 });
  G.roadX.forEach((nilaiJalanX) => {
    const klonTex = texAspal.clone();
    klonTex.needsUpdate = true;
    klonTex.repeat.set(1, 44);
    const meshJalan = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, 1320), new THREE.MeshStandardMaterial({ map: klonTex, roughness: 0.95 }));
    meshJalan.rotation.x = -Math.PI / 2;
    meshJalan.position.set(nilaiJalanX, 0.05, 0);
    meshJalan.receiveShadow = true;
    scene.add(meshJalan);
    [-1, 1].forEach((tandaSisi) => { const meshTrotoar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), matTrotoarV); meshTrotoar.position.set(nilaiJalanX + tandaSisi * ((CFG.roadW / 2) + 1.5), 0.06, 0); meshTrotoar.receiveShadow = true; scene.add(meshTrotoar); }); });
  G.roadZ.forEach((nilaiJalanZ) => {
    // rotation.z = PI/2 pada bidang ini mentranspos sumbu tekstur
    // (bidang U berjalan sepanjang jalan, V melintas), jadi putar
    // tekstur kembali: dengan rotasi PI/2 terhadap pusat, repeat
    // (1,44) mendarat sebagai 1 ubin melintang dan 44 sepanjang
    // panjang — kepadatan dan orientasi yang sama seperti jalan X.
    const klonTex = texAspal.clone();
    klonTex.needsUpdate = true;
    klonTex.center.set(0.5, 0.5);
    klonTex.rotation = Math.PI / 2;
    klonTex.repeat.set(1, 44);
    const meshJalan = new THREE.Mesh(new THREE.PlaneGeometry(1320, CFG.roadW), new THREE.MeshStandardMaterial({ map: klonTex, roughness: 0.95 }));
    meshJalan.rotation.x = -Math.PI / 2;
    meshJalan.position.set(0, 0.05, nilaiJalanZ);
    meshJalan.rotation.z = Math.PI / 2;
    meshJalan.receiveShadow = true;
    scene.add(meshJalan);
    [-1, 1].forEach((tandaSisi) => { const meshTrotoar = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), matTrotoarH); meshTrotoar.position.set(0, 0.06, nilaiJalanZ + tandaSisi * ((CFG.roadW / 2) + 1.5)); meshTrotoar.receiveShadow = true; scene.add(meshTrotoar); }); });
  void matAspal; void matAspalPolos;
  // Penyeberangan: satu InstancedMesh batang zebra pada tiap persimpangan kisi.
  {
    const batangPerSisi = 5;
    const hitunganSisi = 4;
    const totalBatang = G.roadX.length * G.roadZ.length * hitunganSisi * batangPerSisi;
    const instZebra = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xf2efe4, roughness: 0.9 }), totalBatang);
    const mat4Sementara = new THREE.Matrix4(), quatSementara = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), vecSementara = new THREE.Vector3(), skalaSementara = new THREE.Vector3();
    const geserSilang = (CFG.roadW / 2) + 3.5;
    const rentangSilang = CFG.roadW / 6;
    let idxBatang = 0;
    G.roadX.forEach((silangX) => {
      G.roadZ.forEach((silangZ) => {
        for (let idxGaris = 0; idxGaris < batangPerSisi; ++idxGaris) {
          const geserGaris = -2 * rentangSilang + (idxGaris * rentangSilang);
          vecSementara.set(silangX + geserGaris, 0.07, silangZ - geserSilang); skalaSementara.set(2.4, 6, 1); instZebra.setMatrixAt(idxBatang++, mat4Sementara.compose(vecSementara, quatSementara, skalaSementara));
          vecSementara.set(silangX + geserGaris, 0.07, silangZ + geserSilang); instZebra.setMatrixAt(idxBatang++, mat4Sementara.compose(vecSementara, quatSementara, skalaSementara));
          vecSementara.set(silangX - geserSilang, 0.07, silangZ + geserGaris); skalaSementara.set(6, 2.4, 1); instZebra.setMatrixAt(idxBatang++, mat4Sementara.compose(vecSementara, quatSementara, skalaSementara));
          vecSementara.set(silangX + geserSilang, 0.07, silangZ + geserGaris); instZebra.setMatrixAt(idxBatang++, mat4Sementara.compose(vecSementara, quatSementara, skalaSementara)); } }); });
    instZebra.instanceMatrix.needsUpdate = true;
    scene.add(instZebra); }
  // ---- marka jalan: geometri rata yang diturunkan dari kisi + data
  // touge yang SAMA yang dipakai jalan dan minimap. Enam InstancedMesh
  // total (dash pusat, dash pembagi lajur, garis tepi, garis berhenti,
  // dash touge dan strip tepi touge) dalam dua material bersama, pada
  // y .08-.13 — di atas aspal (.05) dan batang zebra (.07), jadi tak ada z-fighting.
  {
    const setengahLebarJalan = CFG.roadW / 2;
    const matMarkaPutih = new THREE.MeshStandardMaterial({ color: 0xf5f2e8, roughness: 0.85 });
    const matMarkaKuning = new THREE.MeshStandardMaterial({ color: 0xf7d154, roughness: 0.85 });
    const daftarDashPusat = [], daftarDashLajur = [], daftarGarisTepi = [];
    const daftarGarisBerhenti = [], daftarDashTouge = [], daftarTepiTouge = [];
    const dekatPersimpangan = (nilaiUji, daftarJalan) => daftarJalan.some((nilaiJalan) => Math.abs(nilaiUji - nilaiJalan) < setengahLebarJalan + 9);
    G.roadX.forEach((nilaiJalanX) => {
      for (let dashZ = -648; dashZ <= 648; dashZ += 12) {
        if (dekatPersimpangan(dashZ, G.roadZ)) continue;
        daftarDashPusat.push({ x: nilaiJalanX, z: dashZ + 3, sx: 0.4, sy: 6 });
        daftarDashLajur.push({ x: nilaiJalanX - 7.5, z: dashZ + 2, sx: 0.3, sy: 4.5 });
        daftarDashLajur.push({ x: nilaiJalanX + 7.5, z: dashZ + 2, sx: 0.3, sy: 4.5 }); }
      for (let idxSeg = 0; idxSeg < G.roadZ.length - 1; ++idxSeg) {
        const awalSegZ = G.roadZ[idxSeg] + setengahLebarJalan, akhirSegZ = G.roadZ[idxSeg + 1] - setengahLebarJalan;
        daftarGarisTepi.push({ x: nilaiJalanX - setengahLebarJalan + 0.8, z: (awalSegZ + akhirSegZ) / 2, sx: 0.3, sy: akhirSegZ - awalSegZ });
        daftarGarisTepi.push({ x: nilaiJalanX + setengahLebarJalan - 0.8, z: (awalSegZ + akhirSegZ) / 2, sx: 0.3, sy: akhirSegZ - awalSegZ }); } });
    G.roadZ.forEach((nilaiJalanZ) => {
      for (let dashX = -648; dashX <= 648; dashX += 12) {
        if (dekatPersimpangan(dashX, G.roadX)) continue;
        daftarDashPusat.push({ x: dashX + 3, z: nilaiJalanZ, sx: 6, sy: 0.4 });
        daftarDashLajur.push({ x: dashX + 2, z: nilaiJalanZ - 7.5, sx: 4.5, sy: 0.3 });
        daftarDashLajur.push({ x: dashX + 2, z: nilaiJalanZ + 7.5, sx: 4.5, sy: 0.3 }); }
      for (let idxSeg = 0; idxSeg < G.roadX.length - 1; ++idxSeg) {
        const awalSegX = G.roadX[idxSeg] + setengahLebarJalan, akhirSegX = G.roadX[idxSeg + 1] - setengahLebarJalan;
        daftarGarisTepi.push({ x: (awalSegX + akhirSegX) / 2, z: nilaiJalanZ - setengahLebarJalan + 0.8, sx: akhirSegX - awalSegX, sy: 0.3 });
        daftarGarisTepi.push({ x: (awalSegX + akhirSegX) / 2, z: nilaiJalanZ + setengahLebarJalan - 0.8, sx: akhirSegX - awalSegX, sy: 0.3 }); } });
    // Garis berhenti pada keempat pendekatan tiap simpang
    // (bersinyal), tepat sebelum pita zebra (batang pada HW+3.5, setengah rentang 3 -> luar 21.5).
    G.roadX.forEach((silangX) => {
      G.roadZ.forEach((silangZ) => {
        const geserBerhenti = setengahLebarJalan + 8.5;
        daftarGarisBerhenti.push({ x: silangX - 7, z: silangZ + geserBerhenti, sx: 13, sy: 0.55 });
        daftarGarisBerhenti.push({ x: silangX + 7, z: silangZ - geserBerhenti, sx: 13, sy: 0.55 });
        daftarGarisBerhenti.push({ x: silangX + geserBerhenti, z: silangZ - 7, sx: 0.55, sy: 13 });
        daftarGarisBerhenti.push({ x: silangX - geserBerhenti, z: silangZ + 7, sx: 0.55, sy: 13 }); }); });
    // Touge: dash pusat + strip tepi mengikuti poliline.
    for (let idxSeg = 0; idxSeg < G.touge.length - 1; ++idxSeg) {
      const titikSegA = G.touge[idxSeg], titikSegB = G.touge[idxSeg + 1];
      const segDx = titikSegB.x - titikSegA.x, segDz = titikSegB.z - titikSegA.z;
      const panjangSeg = Math.hypot(segDx, segDz) || 0.001;
      const satuanX = segDx / panjangSeg, satuanZ = segDz / panjangSeg, tegakX = -satuanZ, tegakZ = satuanX;
      const rotSegY = Math.atan2(-satuanX, -satuanZ);
      for (let jarakDash = 4; jarakDash < panjangSeg; jarakDash += 9) {
        const dashT = jarakDash / panjangSeg, dashX = titikSegA.x + (segDx * dashT), dashZ = titikSegA.z + (segDz * dashT);
        daftarDashTouge.push({ x: dashX, z: dashZ, ry: rotSegY, sx: 0.35, sy: 3.2, y: groundH(dashX, dashZ) + 0.12 }); }
      [-1, 1].forEach((tandaSisi) => {
        const tengahX = ((titikSegA.x + titikSegB.x) / 2) + (tegakX * tandaSisi * 4.05), tengahZ = ((titikSegA.z + titikSegB.z) / 2) + (tegakZ * tandaSisi * 4.05);
        const tinggiTepiA = groundH(titikSegA.x + tegakX * tandaSisi * 4.05, titikSegA.z + tegakZ * tandaSisi * 4.05);
        const tinggiTepiB = groundH(titikSegB.x + tegakX * tandaSisi * 4.05, titikSegB.z + tegakZ * tandaSisi * 4.05);
        daftarTepiTouge.push({ x: tengahX, z: tengahZ, ry: Math.atan2(satuanX, satuanZ), sx: 0.28, sz: panjangSeg, y: Math.max(tinggiTepiA, tinggiTepiB) + 0.13 }); }); }
    const quatRata = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const bangunInstBidang = (daftarEntri, refMat) => {
      if (!daftarEntri.length) return;
      const meshInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), refMat, daftarEntri.length);
      const mat4Sementara = new THREE.Matrix4(), quatSementara = new THREE.Quaternion(), quatYSementara = new THREE.Quaternion(), vecSementara = new THREE.Vector3(), skalaSementara = new THREE.Vector3();
      daftarEntri.forEach((objEntri, idxEntri) => {
        if (objEntri.ry) { quatYSementara.setFromEuler(new THREE.Euler(0, objEntri.ry, 0)); quatSementara.copy(quatYSementara).multiply(quatRata); } else quatSementara.copy(quatRata);
        meshInst.setMatrixAt(idxEntri, mat4Sementara.compose(vecSementara.set(objEntri.x, objEntri.y || 0.08, objEntri.z), quatSementara, skalaSementara.set(objEntri.sx, objEntri.sy, 1))); });
      meshInst.instanceMatrix.needsUpdate = true;
      scene.add(meshInst); };
    const bangunInstKotak = (daftarEntri, refMat) => {
      if (!daftarEntri.length) return;
      const meshInst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), refMat, daftarEntri.length);
      const mat4Sementara = new THREE.Matrix4(), quatSementara = new THREE.Quaternion(), vecSementara = new THREE.Vector3(), skalaSementara = new THREE.Vector3();
      daftarEntri.forEach((objEntri, idxEntri) => {
        quatSementara.setFromEuler(new THREE.Euler(0, objEntri.ry || 0, 0));
        meshInst.setMatrixAt(idxEntri, mat4Sementara.compose(vecSementara.set(objEntri.x, objEntri.y || 0.08, objEntri.z), quatSementara, skalaSementara.set(objEntri.sx, 0.05, objEntri.sz))); });
      meshInst.instanceMatrix.needsUpdate = true;
      scene.add(meshInst); };
    bangunInstBidang(daftarDashPusat, matMarkaKuning);
    bangunInstBidang(daftarDashLajur, matMarkaPutih);
    bangunInstBidang(daftarGarisTepi, matMarkaPutih);
    bangunInstBidang(daftarGarisBerhenti, matMarkaPutih);
    bangunInstBidang(daftarDashTouge, matMarkaPutih);
    bangunInstKotak(daftarTepiTouge, matMarkaPutih); }
  // ---- lampu lalu lintas: dua tiang sinyal pada sudut diagonal
  // tiap persimpangan kisi (tiang NE = kepala sumbu X, cakram
  // menghadap +x; tiang SW = kepala sumbu Z, cakram menghadap +z).
  // Tiang: satu geometri gabungan, satu InstancedMesh. Lampu: 12
  // InstancedMesh (3 warna x nyala/mati x 2 sumbu); siklus hanya
  // mengalihkan .visible pada perubahan fase. Siklus: NS hijau 5.5s,
  // NS kuning 1.5s, semua-merah 0.75s, EW hijau 5.5s, EW kuning 1.5s,
  // semua-merah 0.75s (loop 15.5s).
  {
    const gabungDaftarGeo = (daftarGeo) => {
      let totalTitik = 0;
      let totalIndeks = 0;
      daftarGeo.forEach((objGeo) => { totalTitik += objGeo.attributes.position.count; totalIndeks += objGeo.index.count; });
      const susunanPos = new Float32Array(totalTitik * 3), susunanNor = new Float32Array(totalTitik * 3), susunanUv = new Float32Array(totalTitik * 2);
      const susunanIdx = new Uint32Array(totalIndeks);
      let geserTitik = 0;
      let geserIndeks = 0;
      daftarGeo.forEach((objGeo) => {
        susunanPos.set(objGeo.attributes.position.array, geserTitik * 3);
        susunanNor.set(objGeo.attributes.normal.array, geserTitik * 3);
        if (objGeo.attributes.uv) susunanUv.set(objGeo.attributes.uv.array, geserTitik * 2);
        for (let idxElem = 0; idxElem < objGeo.index.count; idxElem++) susunanIdx[geserIndeks + idxElem] = objGeo.index.getX(idxElem) + geserTitik;
        geserTitik += objGeo.attributes.position.count;
        geserIndeks += objGeo.index.count; });
      const geoGabungan = new THREE.BufferGeometry();
      geoGabungan.setAttribute('position', new THREE.BufferAttribute(susunanPos, 3));
      geoGabungan.setAttribute('normal', new THREE.BufferAttribute(susunanNor, 3));
      geoGabungan.setAttribute('uv', new THREE.BufferAttribute(susunanUv, 2));
      geoGabungan.setIndex(new THREE.BufferAttribute(susunanIdx, 1));
      return geoGabungan; };
    // Tiang kanonis: lengan mencapai menuju +z, kotak kepala pada ujungnya.
    const geoTiangSinyal = gabungDaftarGeo([
      new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8).translate(0, 2.3, 0),
      new THREE.BoxGeometry(0.12, 0.12, 1.0).translate(0, 4.5, 0.5),
      new THREE.BoxGeometry(0.34, 0.9, 0.3).translate(0, 4.15, 0.95),
    ]);
    const matTiangSinyal = new THREE.MeshStandardMaterial({ color: 0x22262a, roughness: 0.6, metalness: 0.6 });
    const daftarPersimpangan = [];
    G.roadX.forEach((silangX) => { G.roadZ.forEach((silangZ) => daftarPersimpangan.push([silangX, silangZ])); });
    const instTiang = new THREE.InstancedMesh(geoTiangSinyal, matTiangSinyal, daftarPersimpangan.length * 2);
    const geoMukaLampu = new THREE.CircleGeometry(0.11, 12);
    const daftarWarnaNyala = [0xff2a1e, 0xffb020, 0x2aff5a];
    const petaMeshLampu = { x: [], z: [] };
    ['x', 'z'].forEach((kunciSumbu) => {
      for (let idxWarna = 0; idxWarna < 3; ++idxWarna) {
        const meshNyala = new THREE.InstancedMesh(geoMukaLampu, new THREE.MeshBasicMaterial({ color: daftarWarnaNyala[idxWarna] }), daftarPersimpangan.length);
        const meshMati = new THREE.InstancedMesh(geoMukaLampu, new THREE.MeshBasicMaterial({ color: 0x1a1c1e }), daftarPersimpangan.length);
        const rekPasangan = {}; rekPasangan.on = meshNyala; rekPasangan.off = meshMati;
        petaMeshLampu[kunciSumbu].push(rekPasangan);
        scene.add(meshNyala);
        scene.add(meshMati); } });
    const mat4Sementara = new THREE.Matrix4(), quatSementara = new THREE.Quaternion(), eulerSementara = new THREE.Euler(), vecSkalaSatuan = new THREE.Vector3(1, 1, 1), vecPosSementara = new THREE.Vector3();
    let idxTiang = 0;
    daftarPersimpangan.forEach(([silangX, silangZ], idxSilang) => {
      [[silangX + 13, silangZ + 13, Math.PI / 2, 'x'], [silangX - 13, silangZ - 13, 0, 'z']].forEach(([tiangX, tiangZ, rotTiangY, sumbuTiang]) => {
        quatSementara.setFromEuler(eulerSementara.set(0, rotTiangY, 0));
        instTiang.setMatrixAt(idxTiang++, mat4Sementara.compose(vecPosSementara.set(tiangX, 0, tiangZ), quatSementara, vecSkalaSatuan));
        const kosRot = Math.cos(rotTiangY), sinRot = Math.sin(rotTiangY);
        for (let idxWarna = 0; idxWarna < 3; ++idxWarna) {
          const lampuY = 4.15 + [0.28, 0, -0.28][idxWarna], geserLampuZ = 1.11;
          const lampuDuniaX = tiangX + (geserLampuZ * sinRot), lampuDuniaZ = tiangZ + (geserLampuZ * kosRot);
          const matriksLampu = mat4Sementara.compose(vecPosSementara.set(lampuDuniaX, lampuY, lampuDuniaZ), quatSementara, vecSkalaSatuan);
          petaMeshLampu[sumbuTiang][idxWarna].on.setMatrixAt(idxSilang, matriksLampu);
          petaMeshLampu[sumbuTiang][idxWarna].off.setMatrixAt(idxSilang, matriksLampu); } }); });
    instTiang.instanceMatrix.needsUpdate = true;
    scene.add(instTiang);
    ['x', 'z'].forEach((kunciSumbu) => { petaMeshLampu[kunciSumbu].forEach((rekPasangan) => { rekPasangan.on.instanceMatrix.needsUpdate = true; rekPasangan.off.instanceMatrix.needsUpdate = true; }); });
    // Mesin status siklus
    let waktuSiklus = 0, idxFase = -1, statusSinyalX = 'red', statusSinyalZ = 'green';
    const terapkanStatusSinyal = () => {
      [['x', statusSinyalX], ['z', statusSinyalZ]].forEach(([kunciSumbu, nilaiStatus]) => {
        const idxAktif = nilaiStatus === 'red' ? 0 : nilaiStatus === 'yellow' ? 1 : 2;
        petaMeshLampu[kunciSumbu].forEach((rekPasangan, idxWarna) => { rekPasangan.on.visible = idxWarna === idxAktif; rekPasangan.off.visible = idxWarna !== idxAktif; }); }); };
    terapkanStatusSinyal();
    G.lightState = (kunciSumbu) => (kunciSumbu === 'x' ? statusSinyalX : statusSinyalZ);
    G.updaters.push((GInner, dtInner) => {
      waktuSiklus = (waktuSiklus + dtInner) % 15.5;
      let idxFaseBerikut;
      let statusBerikutX = 'red', statusBerikutZ = 'red';
      if (waktuSiklus < 5.5) { idxFaseBerikut = 0;
        statusBerikutZ = 'green'; }
      else if (waktuSiklus < 7) { idxFaseBerikut = 1;
        statusBerikutZ = 'yellow'; }
      else if (waktuSiklus < 7.75) { idxFaseBerikut = 2;
      }
      else if (waktuSiklus < 13.25) { idxFaseBerikut = 3;
        statusBerikutX = 'green'; }
      else if (waktuSiklus < 14.75) { idxFaseBerikut = 4;
        statusBerikutX = 'yellow'; }
      else { idxFaseBerikut = 5; }
      if (idxFaseBerikut !== idxFase) { idxFase = idxFaseBerikut; statusSinyalX = statusBerikutX; statusSinyalZ = statusBerikutZ; terapkanStatusSinyal(); } }); }
  // Loop bangunan
  const fallbackPalette = ['#8d99ae', '#a39a8b', '#b08968', '#94867a', '#9c7bb5', '#6d8ea0'];
  const beachPastels = VICE.coralPastels;
  // Palet fasad per distrik (tetangga tak pernah berulang — lihat
  // penjaga lastBaseColour)
  const districtPaletteMap = {
    neon: VICE.downtown,
    coral: VICE.coralPastels,
    port: [
      '#8a7f6a', '#6b7a72', '#a08a68', '#5f8d7d', '#94867a', '#7f9bb3',
    ],
    hoshino: [
      '#9aa0a6', '#a39a8b', '#7d9a7a', '#b09872', '#6d8ea0', '#9a8a72',
    ],
  };
  let lastBaseColour = null, prevBaseColour = null;
  const buildingSignOptions = [
    ['RAMEN', '#ff5c39'], ['CLUB NEON', '#e879ff'], ['TURBO PARTS', '#57b7ff'],
    ['HOTEL CORAL', '#ffb35c'], ['PAWN', '#ffe14d'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'],
  ];
  const posterTextOptions = [
    'RONIN KAI', 'TURBO MAX', 'BAY COLA',
  ];
  for (let blockX = 0; blockX < 8; blockX++)
    for (let blockZ = 0; blockZ < 8; ++blockZ) {
    const blockCentreX = -577.5 + blockX * 165, blockCentreZ = -577.5 + blockZ * 165;
    const districtObj = DISTRICTS.reduce((bestEntry, candEntry) => ((blockCentreX - candEntry.cx) ** 2 + (blockCentreZ - candEntry.cz) ** 2 < (blockCentreX - bestEntry.cx) ** 2 + (blockCentreZ - bestEntry.cz) ** 2 ? candEntry : bestEntry), DISTRICTS[0]);
    // Blok Hoshino Heights dekat pusat distrik ialah perumahan
    // — rumah alih-alih menara. Menara terkonsentrasi di Neon Mile
    // (downtown); Portside turun ke ketinggian menengah.
    if (districtObj.id === 'hoshino' && Math.hypot(blockCentreX - districtObj.cx, blockCentreZ - districtObj.cz) < 250) { constructResidentialBlock(G, scene, blockCentreX, blockCentreZ); continue; }
    const beachFlag = blockCentreZ > 500;
    const buildingsInBlock = ri(2, 4);
    for (let buildingIdx = 0; buildingIdx < buildingsInBlock; ++buildingIdx) {
      const spanW = rr(22, 44);
      const spanD = rr(22, 44);
      const spanTall = beachFlag ? rr(8, 20) : districtObj.id === 'neon' ? rr(24, 60) : districtObj.id === 'hoshino' ? rr(8, 22) : districtObj.id === 'port' ? rr(8, 20) : rr(10, 28);
      const bldX = blockCentreX + rr(-48, 48), bldZ = blockCentreZ + rr(-48, 48);
      if (Math.abs(bldX + 412.5) < 60 && Math.abs(bldZ - 412.5) < 60) continue;
      if (Math.abs(bldX - MARKET.x) < 54 && Math.abs(bldZ - MARKET.z) < 76) continue;
      const paletteList = beachFlag ? beachPastels : (districtPaletteMap[districtObj.id] || fallbackPalette);
      let baseColour = pick(paletteList);
      if (baseColour === lastBaseColour) baseColour = paletteList[(paletteList.indexOf(baseColour) + 1) % paletteList.length];
      // Perpanjangan penjaga: pemeriksaan di atas MEMANG mencakup
      // Coral (ia berjalan untuk tiap palet), tapi hanya terhadap
      // satu bangunan sebelumnya dan baris pantai berbagi daftar
      // pastel Coral — jadi untuk Coral / beachfront tolak juga
      // warna yang dipakai dua bangunan lalu, menjaga fasad pastel
      // bertetangga agar tak pernah cocok dalam satu lari.
      if ((districtObj.id === 'coral' || beachFlag) && baseColour === prevBaseColour) baseColour = paletteList[(paletteList.indexOf(baseColour) + 1) % paletteList.length];
      prevBaseColour = lastBaseColour;
      lastBaseColour = baseColour;
      const facadeTex = buildBuildingTexture(baseColour, rr(0.18, 0.42));
      facadeTex.wrapS = facadeTex.wrapT = THREE.RepeatWrapping;
      const facadeMat = new THREE.MeshStandardMaterial({ map: facadeTex, emissive: 0xffc873, emissiveMap: facadeTex, emissiveIntensity: 0, roughness: 0.9 });
      facadeMat.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
      const buildingMesh = new THREE.Mesh(new THREE.BoxGeometry(spanW, spanTall, spanD), facadeMat);
      buildingMesh.position.set(bldX, spanTall / 2 + groundH(bldX, bldZ), bldZ);
      buildingMesh.castShadow = true;
      buildingMesh.receiveShadow = true;
      scene.add(buildingMesh);
      if (!G.buildingMats) G.buildingMats = [];
      G.buildingMats.push(facadeMat);
      G.addCollider(bldX, bldZ, spanW / 2, spanD / 2, spanTall);
      if (beachFlag) {
        const stepHeight = rr(1.6, 3);
        const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(spanW * 0.62, stepHeight, spanD * 0.62), facadeMat);
        stepMesh.position.set(bldX, spanTall + stepHeight / 2 + groundH(bldX, bldZ), bldZ);
        stepMesh.castShadow = true;
        scene.add(stepMesh); }
      if (beachFlag || districtObj.id === 'coral') {
        const neonColour = pick(VICE.neonTrim);
        const trimMat = new THREE.MeshStandardMaterial({ color: neonColour, emissive: neonColour, emissiveIntensity: 0, roughness: 0.6 });
        const trimMesh = new THREE.Mesh(new THREE.BoxGeometry(spanW + 0.35, 0.3, spanD + 0.35), trimMat);
        trimMesh.position.set(bldX, spanTall * 0.84 + groundH(bldX, bldZ), bldZ);
        trimMesh.castShadow = true;
        scene.add(trimMesh);
        if (!G.neonTrimMats) G.neonTrimMats = [];
        G.neonTrimMats.push(trimMat);
        const trimGlow = glowSprite(new THREE.Color(neonColour), 12);
        trimGlow.position.set(bldX, spanTall * 0.84 + groundH(bldX, bldZ), bldZ);
        trimGlow.material.opacity = 0;
        scene.add(trimGlow);
        glowSpritesList.push(trimGlow); }
      if (rnd() < 0.3) {
        const propMesh = new THREE.Mesh(new THREE.BoxGeometry(rr(2, 4), rr(1, 2), rr(2, 4)), new THREE.MeshStandardMaterial({ color: 0x555a60 }));
        propMesh.position.set(bldX + rr(-6, 6), spanTall + 0.8, bldZ + rr(-6, 6));
        scene.add(propMesh); }
      if (rnd() < 0.22) {
        const posterTex = buildSignTexture(pick(posterTextOptions), '#14161c', '#ffb35c');
        // Perbaikan tanda: satu bidang DoubleSide menampilkan poster
        // TERBALIK dari belakang ("BAY COLA" terbalik dalam
        // 4-hero.jpg). Pakai dua panel FrontSide saling membelakangi
        // sebagai gantinya: panel depan bekerja seperti sebelumnya,
        // plus panel belakang diputar PI jadi mukanya sendiri
        // menghadap arah berlawanan, digeser 0.06 ke belakang
        // sepanjang normal depan — teks kini terbaca benar dari
        // KEDUA sisi, tak pernah terbalik.
        const boardGeo = new THREE.PlaneGeometry(14, 4);
        const boardMat = new THREE.MeshBasicMaterial({ map: posterTex, side: THREE.FrontSide });
        const boardRotY = rr(0, Math.PI);
        const boardMesh = new THREE.Mesh(boardGeo, boardMat);
        boardMesh.position.set(bldX, spanTall + 4, bldZ);
        boardMesh.rotation.y = boardRotY;
        scene.add(boardMesh);
        const boardBackMesh = new THREE.Mesh(boardGeo, boardMat);
        boardBackMesh.position.set(bldX - Math.sin(boardRotY) * 0.06, spanTall + 4, bldZ - Math.cos(boardRotY) * 0.06);
        boardBackMesh.rotation.y = boardRotY + Math.PI;
        scene.add(boardBackMesh); }
      // Toko pada lantai dasar neon/coral (dan strip pantai)
      if ((districtObj.id === 'neon' || districtObj.id === 'coral' || beachFlag) && rnd() < (beachFlag ? 0.75 : 0.6)) {
        const [signText, signColour] = pick(buildingSignOptions);
        const storefrontSignTex = buildSignTexture(signText, '#101018', signColour);
        const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.4), new THREE.MeshBasicMaterial({ map: storefrontSignTex }));
        signMesh.position.set(bldX, 4.6, bldZ + spanD / 2 + 0.1);
        scene.add(signMesh);
        const signGlow = glowSprite(new THREE.Color(signColour), 13);
        signGlow.position.set(bldX, 4.6, bldZ + spanD / 2 + 0.02);
        signGlow.material.opacity = 0;
        scene.add(signGlow);
        glowSpritesList.push(signGlow);
        const awningMesh = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 2.2), new THREE.MeshStandardMaterial({ color: new THREE.Color(signColour) }));
        awningMesh.position.set(bldX, 3.6, bldZ + spanD / 2 + 1);
        awningMesh.rotation.x = 0.3;
        scene.add(awningMesh); } } }
  // Lampu jalan — ritme rapat sekota. Jalan utama (x=0, x=330 Neon,
  // z=0, z=495 bulevar Coral) mendapat KEDUA sisi tiap ~45 m; jalan
  // lain berselang satu sisi tiap ~55 m; plus baris putih sejuk
  // boardwalk pada strip pantai. Tiang / kepala emisif / kolam tanah
  // ialah tiga InstancedMesh total; sprite pijar hanya pada jalan
  // utama + boardwalk. Tak ada sumber cahaya asli yang ditambahkan (rig tak berubah).
  {
    const lampSpotList = [];
    const crossingSkipTest = (probeVal, roadList) => roadList.some((roadVal) => Math.abs(probeVal - roadVal) < 21);
    const lampHitsBuilding = (x, z) => G.colliders.some((colObj) => Math.abs(x - colObj.x) < colObj.hw + 1 && Math.abs(z - colObj.z) < colObj.hd + 1);
    G.roadX.forEach((roadXVal) => {
      const mainFlag = roadXVal === 0 || roadXVal === 330;
      let staggerIdx = 0;
      for (let lampZ = -615; lampZ <= 615; lampZ += mainFlag ? 45 : 55, ++staggerIdx) {
        if (crossingSkipTest(lampZ, G.roadZ)) continue;
        if (mainFlag) { lampSpotList.push({ x: roadXVal - 17, z: lampZ, glow: 1 }); lampSpotList.push({ x: roadXVal + 17, z: lampZ + 22, glow: 1 }); }
        else lampSpotList.push({ x: roadXVal + (staggerIdx % 2 === 0 ? 17 : -17), z: lampZ, glow: 0 }); } });
    G.roadZ.forEach((roadZVal) => {
      const mainFlag = roadZVal === 0 || roadZVal === 495;
      let staggerIdx = 0;
      for (let lampX = -615; lampX <= 615; lampX += mainFlag ? 45 : 55, ++staggerIdx) {
        if (crossingSkipTest(lampX, G.roadX)) continue;
        if (mainFlag) { lampSpotList.push({ x: lampX, z: roadZVal - 17, glow: 1 }); lampSpotList.push({ x: lampX + 22, z: roadZVal + 17, glow: 1 }); }
        else lampSpotList.push({ x: lampX, z: roadZVal + (staggerIdx % 2 === 0 ? 17 : -17), glow: 0 }); } });
    for (let boardX = -440; boardX <= 640; boardX += 55) {
      if (lampHitsBuilding(boardX, 552)) continue;
      lampSpotList.push({ x: boardX, z: 552, glow: 2 });
    }
    const lampTotalCount = lampSpotList.length;
    const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8, metalness: 0.5 });
    const tmpMat4 = new THREE.Matrix4();
    const lampPoleInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), lampPoleMat, lampTotalCount);
    lampSpotList.forEach((spotObj, lampIdx) => { tmpMat4.makeTranslation(spotObj.x, 3, spotObj.z); lampPoleInst.setMatrixAt(lampIdx, tmpMat4); });
    lampPoleInst.instanceMatrix.needsUpdate = true;
    scene.add(lampPoleInst);
    const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc98a, emissiveIntensity: 0.15, roughness: 0.5 });
    const lampHeadInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), lampHeadMat, lampTotalCount);
    lampSpotList.forEach((spotObj, lampIdx) => { tmpMat4.makeTranslation(spotObj.x, 6.02, spotObj.z); lampHeadInst.setMatrixAt(lampIdx, tmpMat4); });
    lampHeadInst.instanceMatrix.needsUpdate = true;
    scene.add(lampHeadInst);
    const lampPoolMat = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const lampPoolInst = new THREE.InstancedMesh(new THREE.CircleGeometry(5.5, 20), lampPoolMat, lampTotalCount);
    const flatQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const tmpVec = new THREE.Vector3(), unitScaleVec = new THREE.Vector3(1, 1, 1);
    lampSpotList.forEach((spotObj, lampIdx) => { lampPoolInst.setMatrixAt(lampIdx, tmpMat4.compose(tmpVec.set(spotObj.x, 0.09, spotObj.z), flatQuat, unitScaleVec)); });
    lampPoolInst.instanceMatrix.needsUpdate = true;
    scene.add(lampPoolInst);
    lampSpotList.forEach((spotObj) => {
      if (!spotObj.glow) return;
      const lampGlow = glowSprite(spotObj.glow === 2 ? 0xcfe6ff : 0xffd9a0, spotObj.glow === 2 ? 5 : 5.5);
      lampGlow.position.set(spotObj.x, 6, spotObj.z);
      lampGlow.material.opacity = 0;
      scene.add(lampGlow);
      streetlampGlowList.push(lampGlow); });
    G.lampHeadMat = lampHeadMat;
    G.lampPoolMat = lampPoolMat; }
  G.streetlightGlows = streetlampGlowList;
  G.signGlows = glowSpritesList;
  // Blok HQ
  constructHQ(G, scene);
  // Supermarket RONIN MART + landmark untuk peta jeda / minimap
  constructMarket(G, scene);
  constructBeachStrip(G, scene);
  const landmarkRec = {};
  const marketRec = {}; marketRec.x = MARKET.x; marketRec.z = MARKET.z; marketRec.name = MARKET.name;
  landmarkRec.market = marketRec;
  const garageRec = {}; garageRec.x = G.hq.x; garageRec.z = G.hq.garage.z; garageRec.name = 'RONIN KAI HQ';
  landmarkRec.garage = garageRec;
  landmarkRec.districts = [
    { name: 'Downtown', x: 0, z: 0 }, { name: 'Portside', x: -330, z: 330 },
    { name: 'Coral Strip', x: 330, z: 330 }, { name: 'Neon Mile', x: 330, z: -330 },
    { name: 'Hoshino Heights', x: -330, z: -330 }, { name: 'Touge', x: -330, z: -470 },
  ];
  G.landmarks = landmarkRec;
  // Hiasan pelabuhan
  constructHarbor(G, scene);
  // Bangun pita touge
  constructTouge(G, scene);
  // Sebaran pohon
  let treeTotalCount = 0;
  for (let tryIdx = 0; tryIdx < 400 && treeTotalCount < 250; ++tryIdx) {
    const scatterX = rr(-640, 640), scatterZ = rr(-640, 640);
    if (G.roadX.some((roadVal) => Math.abs(scatterX - roadVal) < 22) || G.roadZ.some((roadVal) => Math.abs(scatterZ - roadVal) < 22)) continue;
    if (Math.abs(scatterX + 412.5) < 55 && Math.abs(scatterZ - 412.5) < 55) continue;
    if (Math.abs(scatterX - MARKET.x) < 58 && Math.abs(scatterZ - MARKET.z) < 78) continue;
    const districtObj = DISTRICTS.reduce((bestEntry, candEntry) => ((scatterX - candEntry.cx) ** 2 + (scatterZ - candEntry.cz) ** 2 < (scatterX - bestEntry.cx) ** 2 + (scatterZ - bestEntry.cz) ** 2 ? candEntry : bestEntry), DISTRICTS[0]);
    let treeObj;
    if (districtObj.id === 'coral' || scatterZ > 520 || districtObj.id === 'neon') treeObj = makePalm(rr(4.5, 6.5));
    else if (districtObj.id === 'hoshino') treeObj = makeShadeTree(rr(3.5, 5), rnd() < 0.3 ? 0xe8a0bf : 0x3d8b4f);
    else treeObj = makeShadeTree(rr(3.5, 5.5), 0x3d8b4f);
    treeObj.position.set(scatterX, groundH(scatterX, scatterZ), scatterZ);
    treeObj.rotation.y = rr(0, 6.28);
    scene.add(treeObj);
    ++treeTotalCount; }
  // ---- kepadatan prop (tersemai, di luar jalan) ----
  {
    const palmOffset = CFG.roadW / 2 + 3.8;
    let addedPalmCount = 0;
    for (let palmX = -600; palmX <= 600 && addedPalmCount < 72; palmX += 40) {
      [-1, 1].forEach((sideSign) => {
        const palmObj = makePalm(rr(4.5, 6.5));
        palmObj.position.set(palmX + rr(-2, 2), groundH(palmX, 495 + sideSign * palmOffset), 495 + sideSign * palmOffset);
        palmObj.rotation.y = rr(0, 6.28);
        scene.add(palmObj);
        ++addedPalmCount; }); }
    for (let palmZ = -595; palmZ <= 95 && addedPalmCount < 82; palmZ += 70) {
      const palmObj = makePalm(rr(4.5, 6.5));
      palmObj.position.set(330 + palmOffset, groundH(330 + palmOffset, palmZ), palmZ + rr(-2, 2));
      palmObj.rotation.y = rr(0, 6.28);
      scene.add(palmObj);
      ++addedPalmCount; }
    // Peti pelabuhan dengan garis bahaya padanya
    const hazardTex = makeCanvasTexture(128, 128, (brush, wVal, hVal) => {
      brush.fillStyle = '#8a7a3a'; brush.fillRect(0, 0, wVal, hVal);
      brush.fillStyle = '#2b2b2b';
      for (let stripeIdx = -2; stripeIdx < 8; ++stripeIdx) { brush.save(); brush.translate(stripeIdx * 32, 0); brush.rotate(0.6); brush.fillRect(0, -40, 14, hVal + 80); brush.restore(); }
      brush.fillStyle = 'rgba(255,255,255,.75)';
      brush.fillRect(14, 44, 100, 40);
      brush.fillStyle = '#333'; brush.font = 'bold 22px sans-serif'; brush.textAlign = 'center'; brush.fillText('CARGO', 64, 72); });
    const portCrateMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.9 });
    const portCrateGeo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    for (let crateIdx = 0; crateIdx < 12; ++crateIdx) {
      const crateX = -625 + (crateIdx % 4) * 36 + rr(-3, 3), crateZ = 532 + Math.floor(crateIdx / 4) * 30 + rr(-3, 3);
      const crateMesh = new THREE.Mesh(portCrateGeo, portCrateMat);
      crateMesh.position.set(crateX, 1.1, crateZ);
      crateMesh.rotation.y = rr(0, 0.6);
      scene.add(crateMesh);
      if (crateIdx % 3 === 0) { const topCrateMesh = new THREE.Mesh(portCrateGeo, portCrateMat); topCrateMesh.position.set(crateX, 3.3, crateZ); topCrateMesh.rotation.y = rr(0, 0.6); scene.add(topCrateMesh); } }
    // Penghalang beton dengan garis oranye, di sepanjang jalan pendekatan pelabuhan/HQ
    const barrierTex = makeCanvasTexture(128, 32, (brush, wVal, hVal) => { brush.fillStyle = '#b8b4a8'; brush.fillRect(0, 0, wVal, hVal); brush.fillStyle = '#e8762a'; brush.fillRect(0, 12, wVal, 8); });
    const barrierMat = new THREE.MeshStandardMaterial({ map: barrierTex, roughness: 0.95 });
    for (let barrierIdx = 0; barrierIdx < 6; ++barrierIdx) {
      const barrierMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.5), barrierMat);
      barrierMesh.position.set(-560 + barrierIdx * 40, 0.5, 472);
      scene.add(barrierMesh); }
    // Tempat sampah besar di interior blok Neon Mile
    const dumpsterMat = new THREE.MeshStandardMaterial({ color: 0x2e4a34, roughness: 0.85, metalness: 0.2 });
    const dumpsterLidMat = new THREE.MeshStandardMaterial({ color: 0x223828, roughness: 0.8, metalness: 0.2 });
    [[270, -40], [390, 40], [270, -200], [390, -260]].forEach(([dumpX, dumpZ]) => {
      const dumpsterMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), dumpsterMat);
      dumpsterMesh.position.set(dumpX, 0.7, dumpZ);
      scene.add(dumpsterMesh);
      const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.5), dumpsterLidMat);
      lidMesh.position.set(dumpX, 1.46, dumpZ);
      scene.add(lidMesh); }); }
  // ---- ronde kepadatan: dipanggil TERAKHIR supaya urutan RNG
  // tersemai tiap pembangun di atas tak tersentuh. Frontase dulu
  // (collider-nya lalu menggerbangi palem bulevar dan pemeriksaan
  // penempatan titik kumpul).
  constructBoulevardFrontage(G, scene);
  constructBoulevardPalms(G, scene);
  constructGatherSpots(G, scene);
  constructHoshinoRows(G, scene);
  constructBoulevardPlanters(G, scene);
  // Dua lot "taman" mandiri BUKAN lagi lempeng rumput — tiap kini
  // ialah plaza BERPAVING (tekstur paving) yang dihias bangku +
  // kotak penanam supaya terbaca sebagai permukaan terbangun.
  // (Tak satu pun lot duduk di dalam tapak taman pameran.)
  [[412, 412], [-412, -80]].forEach(([lotX, lotZ]) => {
    const lotMesh = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), makePavingMat(15, 15));
    lotMesh.rotation.x = -Math.PI / 2;
    lotMesh.position.set(lotX, 0.04, lotZ);
    lotMesh.receiveShadow = true;
    scene.add(lotMesh);
    for (let benchIdx = 0; benchIdx < 4; ++benchIdx) { const benchMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x7a5a38 })); benchMesh.position.set(lotX + rr(-35, 35), 0.3, lotZ + rr(-35, 35)); scene.add(benchMesh); }
    for (let planterIdx = 0; planterIdx < 4; ++planterIdx) {
      const planterMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.8), new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1 }));
      planterMesh.position.set(lotX + rr(-38, 38), 0.3, lotZ + rr(-38, 38));
      scene.add(planterMesh);
      const bushMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({ color: 0x3d8b4f, roughness: 1, flatShading: true }));
      bushMesh.position.set(planterMesh.position.x, 0.95, planterMesh.position.z);
      scene.add(bushMesh); }
    // Hiasan plaza: 2 bangku layak + 1 kotak penanam (para pembantu)
    const plazaBenchA = makeBenchUnit();
    plazaBenchA.position.set(lotX - 12, groundH(lotX - 12, lotZ + 10), lotZ + 10);
    plazaBenchA.rotation.y = 0.4;
    scene.add(plazaBenchA);
    const plazaBenchB = makeBenchUnit();
    plazaBenchB.position.set(lotX + 14, groundH(lotX + 14, lotZ - 8), lotZ - 8);
    plazaBenchB.rotation.y = -0.7;
    scene.add(plazaBenchB);
    const plazaPlanter = makePlanterUnit();
    plazaPlanter.position.set(lotX + 4, groundH(lotX + 4, lotZ + 16), lotZ + 16);
    scene.add(plazaPlanter); });
  // Taman pameran — dibangun PALING AKHIR dari semua supaya pindai
  // collider-nya melihat kota lengkap dan tak ada urutan RNG hulu yang bergeser.
  constructPark(G, scene); }
// GLB garasi Tripo: fasad detailnya (pintu) ialah muka -Z model
// sendiri dan sisi detail lainnya ialah +X. Memutar PI membalik -Z
// menghadap selatan (+z, menuju apron / titik garasi / jalan) dan
// +X menghadap barat (-x, menuju jalan pelabuhan).
const GARAGE_ROT_Y = Math.PI;
function constructHQ(G, scene) {
  const hqX = -412.5;
  const hqZ = 412.5;
  // Semua visual bangunan HQ prosedural hidup dalam hqGrp supaya
  // pertukaran GLB dapat membuang mereka dalam satu langkah. Apron
  // tetap di luar grup (di bawah): ia permukaan tanah, bukan visual
  // bangunan, dan harus selamat dari pertukaran.
  const hqGrp = new THREE.Group();
  scene.add(hqGrp);
  const hqWallMat = new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 0.9 });
  const hqBlockMesh = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 34), hqWallMat);
  hqBlockMesh.position.set(hqX, 5, hqZ);
  hqGrp.add(hqBlockMesh);
  // Collider cocok dengan tapak GLB (targetSize 30x30) jadi tabrakan
  // identik dalam mode prosedural dan GLB.
  G.addCollider(hqX, hqZ, 15, 15, 10);
  const hqDoorMat = new THREE.MeshStandardMaterial({ color: 0x707880, roughness: 0.6, metalness: 0.6 });
  for (let doorIdx = -1; doorIdx <= 1; ++doorIdx) {
    const doorMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), hqDoorMat);
    doorMesh.position.set(hqX + doorIdx * 20, 3, hqZ + 17.2);
    hqGrp.add(doorMesh); }
  const hqSignTex = (() => {
    const sheet = document.createElement('canvas');
    sheet.width = 512;
    sheet.height = 96;
    const brush = sheet.getContext('2d');
    brush.fillStyle = '#14100c';
    brush.fillRect(0, 0, 512, 96);
    brush.font = 'bold 58px sans-serif';
    brush.textAlign = 'center';
    brush.shadowColor = '#ff7a1a';
    brush.shadowBlur = 16;
    brush.fillStyle = '#ff7a1a';
    brush.fillText('RONIN KAI', 256, 66);
    const tex = new THREE.CanvasTexture(sheet);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex; })();
  const hqSignMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial({ map: hqSignTex }));
  hqSignMesh.position.set(hqX, 8.6, hqZ + 17.3);
  hqGrp.add(hqSignMesh);
  const hqWinMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb35c, emissiveIntensity: 0.6 });
  for (let winIdx = 0; winIdx < 5; ++winIdx) { const winMesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), hqWinMat); winMesh.position.set(hqX - 28 + winIdx * 14, 7.6, hqZ - 17.2); winMesh.rotation.y = Math.PI; hqGrp.add(winMesh); }
  // Apron (kedua mode, tetap di luar hqGrp): aspal bertekstur
  // alih-alih warna datar — bintik, noda minyak, dan petak parkir
  // putih di sepanjang tepi selatannya. Catatan kanvas: bidang
  // diputar -PI/2 terhadap X, jadi bawah kanvas (v=0) memetakan ke
  // tepi selatan-dunia apron.
  const hqApronTex = makeCanvasTexture(1024, 384, (brush, wVal, hVal) => {
    brush.fillStyle = '#6a6d70'; brush.fillRect(0, 0, wVal, hVal);
    for (let speckIdx = 0; speckIdx < 5200; ++speckIdx) {
      const shadeVal = 96 + Math.floor(rnd() * 48);
      brush.fillStyle = `rgba(${shadeVal},${shadeVal},${shadeVal + 4},.14)`;
      brush.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); }
    [[210, 120, 58, 20], [560, 210, 74, 26], [790, 90, 46, 16], [390, 290, 52, 18]].forEach(([stainX, stainY, stainRx, stainRy]) => {
      brush.fillStyle = 'rgba(18,18,20,.20)';
      brush.beginPath(); brush.ellipse(stainX, stainY, stainRx, stainRy, 0.4, 0, 2 * Math.PI); brush.fill();
      brush.fillStyle = 'rgba(18,18,20,.12)';
      brush.beginPath(); brush.ellipse(stainX + 14, stainY + 6, stainRx * 0.6, stainRy * 0.6, 0.4, 0, 2 * Math.PI); brush.fill(); });
    // Petak parkir di sepanjang tepi selatan (bawah kanvas).
    brush.strokeStyle = 'rgba(245,245,240,.88)'; brush.lineWidth = 5;
    brush.beginPath(); brush.moveTo(0, hVal - 108); brush.lineTo(wVal, hVal - 108); brush.stroke();
    for (let stallX = 32; stallX <= wVal - 32; stallX += 96) {
      brush.beginPath(); brush.moveTo(stallX, hVal - 108); brush.lineTo(stallX, hVal - 6); brush.stroke(); } });
  hqApronTex.wrapS = hqApronTex.wrapT = THREE.ClampToEdgeWrapping;
  const apronMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({ map: hqApronTex, roughness: 1 }));
  apronMesh.rotation.x = -Math.PI / 2;
  apronMesh.position.set(hqX, 0.04, 455);
  scene.add(apronMesh);
  const hqRec = {};
  hqRec.x = hqX; hqRec.z = hqZ;
  const garagePt = {}; garagePt.x = hqX; garagePt.z = 455;
  hqRec.garage = garagePt;
  G.hq = hqRec;
  // Aset hero: GLB garasi Tripo menggantikan bangunan HQ prosedural
  // saat ia dimuat; pada null/kegagalan HQ prosedural di atas tetap
  // tak tersentuh. Pertukaran dicoba ulang (pemuatan null tak lagi
  // mengakhirinya — assets.js mengusir hasil null dari cache-nya,
  // jadi panggilan ulang mengambil lagi) dan pembungkus DIKLON
  // seperti tiap situs pertukaran GLB lain dalam game (mobil,
  // pemain, pejalan semua mengklon pembungkus cache bersama; situs
  // ini dulu menambahkan instans cache itu sendiri). Hiasan neon di
  // bawah tak tersentuh: ia ditambahkan ke grup penempatan, dikunci
  // pada posisi/rotasi penempatan sendiri, tak pernah pada pembungkus yang dimuat.
  const attemptGarageSwap = (attemptsLeft) => {
    loadHeroAsset('garage').then((loadedWrap) => {
      try {
        if (!loadedWrap) {
          if (attemptsLeft > 0) setTimeout(() => attemptGarageSwap(attemptsLeft - 1), 1500);
          return;
        }
        scene.remove(hqGrp);
        const placementGrp = new THREE.Group();
        placementGrp.position.set(hqX, groundH(hqX, hqZ), hqZ);
        placementGrp.rotation.y = GARAGE_ROT_Y;
        placementGrp.add(loadedWrap.clone ? loadedWrap.clone(true) : loadedWrap);
        // Hiasan klub (mode GLB saja): GLB polos terbaca sebagai
        // monolit gelap dan kehilangan identitas RONIN KAI, jadi
        // hias ulang muka selatan-dunianya. Penalaran sisi tanda
        // (terverifikasi): rotasi penempatan.y = PI memetakan titik
        // lokal anak (x, z) ke offset dunia (-x, -z), jadi anak pada
        // z lokal penempatan = -15.15 duduk pada z dunia = hz +
        // 15.15 — muka SELATAN (fasad pembungkus sendiri berakhir
        // menghadap selatan dunia lewat rotasi PI yang sama ini;
        // targetSize GLB ialah 30 dalam, jadi mukanya pada |z| lokal
        // = 15 dan tanda mengambang 0.15 bangga padanya). Muka depan
        // bidang ialah +z lokalnya; dengan rotasi PI induk itu akan
        // menghadap utara dunia (ke dalam bangunan), jadi tiap
        // bidang hiasan mendapat rotation.y = PI sendiri: mukanya
        // lalu menunjuk sepanjang -z lokal penempatan, yang dipetakan
        // induk ke +z dunia (selatan, keluar) — dan dua putaran PI
        // membatalkan, jadi teks tanda terbaca tak terbalik dari jalan.
        const neonArtTex = (() => {
          const sheet = document.createElement('canvas');
          sheet.width = 1024;
          sheet.height = 192;
          const brush = sheet.getContext('2d');
          brush.clearRect(0, 0, 1024, 192);
          brush.font = 'italic bold 118px sans-serif';
          brush.textAlign = 'center';
          brush.shadowColor = '#ff4fd8';
          brush.shadowBlur = 34;
          brush.fillStyle = '#ff4fd8';
          brush.fillText('RONIN KAI', 512, 122);
          brush.shadowBlur = 18;
          brush.fillStyle = '#ff7a1a';
          brush.fillRect(212, 148, 600, 14);
          const tex = new THREE.CanvasTexture(sheet); tex.colorSpace = THREE.SRGBColorSpace; return tex; })();
        const neonSignMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(14, 2.6),
          new THREE.MeshBasicMaterial({ map: neonArtTex, transparent: true }));
        neonSignMesh.position.set(0, 10.8, -15.15);
        neonSignMesh.rotation.y = Math.PI;
        placementGrp.add(neonSignMesh);
        const neonStripMat = new THREE.MeshBasicMaterial({ color: 0x39d5ff });
        [-13.5, 13.5].forEach((stripX) => {
          const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 8), neonStripMat);
          stripMesh.position.set(stripX, 6, -15.15);
          stripMesh.rotation.y = Math.PI;
          placementGrp.add(stripMesh); });
        const neonGlow = glowSprite(0xff4fd8, 16);
        neonGlow.position.set(0, 10.8, -15.35);
        neonGlow.material.opacity = 0.35;
        placementGrp.add(neonGlow);
        scene.add(placementGrp);
      } catch (e) { /* pertahankan HQ prosedural */ }
    }).catch(() => { if (attemptsLeft > 0) setTimeout(() => attemptGarageSwap(attemptsLeft - 1), 1500); }); };
  try { attemptGarageSwap(3); } catch (e) { /* pertahankan HQ prosedural */ } }
function constructHarbor(G, scene) {
  const containerColourList = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98, 0xca6f1e];
  Array.from({ length: 26 }).forEach((unusedVal, contIdx) => {
    const contX = rr(-620, -480), contZ = rr(480, 620);
    const contMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.4), new THREE.MeshStandardMaterial({ color: pick(containerColourList), roughness: 0.8 }));
    contMesh.position.set(contX, 1.3 + (contIdx % 3) * 2.6, contZ);
    contMesh.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2;
    scene.add(contMesh);
    if (contIdx % 4 === 0) G.addCollider(contX, contZ, 6, 2, 3); });
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd97c2b, roughness: 0.7, metalness: 0.4 });
  [-560, -480].forEach((craneX) => {
    const craneGrp = new THREE.Group();
    [-1, 1].forEach((sideSign) => { const legMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), craneMat); legMesh.position.set(sideSign * 8, 13, 0); craneGrp.add(legMesh); });
    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 34), craneMat);
    boomMesh.position.set(0, 26, 6);
    craneGrp.add(boomMesh);
    const topBarMesh = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.4, 1.4), craneMat);
    topBarMesh.position.y = 26;
    craneGrp.add(topBarMesh);
    craneGrp.position.set(craneX, 0, 540);
    scene.add(craneGrp);
    G.addCollider(craneX, 540, 9, 3, 26); });
  const bollardMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  for (let bolIdx = 0; bolIdx < 10; ++bolIdx) { const bollardMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), bollardMat); bollardMesh.position.set(-640 + bolIdx * 16, 0.4, 648); scene.add(bollardMesh); } }
function constructTouge(G, scene) {
  // Bangun ulang: tiap quad segmen mencicipi groundH pada EMPAT
  // sudutnya SENDIRI, jadi pita memeluk bukit alih-alih merata-rata
  // tinggi ujung menjadi lempeng.
  const routePtsRaw = TOUGE_POINTS.map((ptObj) => ({ x: ptObj[0], z: ptObj[1] }));
  const ribbonWidth = 9, loopCentrePt = { x: -330, z: -470 };
  const ribbonTex = makeCanvasTexture(128, 128, (brush, wVal, hVal) => {
    brush.fillStyle = '#33373d'; brush.fillRect(0, 0, wVal, hVal);
    for (let speckIdx = 0; speckIdx < 260; ++speckIdx) { brush.fillStyle = 'rgba(255,255,255,.05)'; brush.fillRect(rnd() * wVal, rnd() * hVal, 2, 2); }
    brush.fillStyle = '#f0ead0'; brush.fillRect(wVal * 0.03, 0, 3, hVal); brush.fillRect(wVal * 0.97 - 3, 0, 3, hVal);
    brush.fillRect(wVal / 2 - 2, 10, 4, 44);
  });
  ribbonTex.wrapS = THREE.ClampToEdgeWrapping;
  ribbonTex.wrapT = THREE.RepeatWrapping;
  const ribbonMat = new THREE.MeshStandardMaterial({ map: ribbonTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const guardRailMat = new THREE.MeshStandardMaterial({ color: 0xb0b6bc, metalness: 0.7, roughness: 0.4 });
  const ribbonPosArr = [], ribbonUvArr = [], ribbonIdxArr = [], railPostPts = [];
  let cumulativeLen = 0;
  for (let segIdx = 0; segIdx < routePtsRaw.length - 1; ++segIdx) {
    const segPtA = routePtsRaw[segIdx], segPtB = routePtsRaw[segIdx + 1];
    const segDx = segPtB.x - segPtA.x, segDz = segPtB.z - segPtA.z;
    const segLen = Math.hypot(segDx, segDz) || 0.001;
    const unitX = segDx / segLen, unitZ = segDz / segLen, perpX = -unitZ, perpZ = unitX;
    const cornerPointAt = (ptObj, sideSign) => { const cornerX = ptObj.x + perpX * sideSign * (ribbonWidth / 2), cornerZ = ptObj.z + perpZ * sideSign * (ribbonWidth / 2); return { x: cornerX, z: cornerZ, y: groundH(cornerX, cornerZ) + 0.07 }; };
    const corner00 = cornerPointAt(segPtA, 1), corner01 = cornerPointAt(segPtA, -1), corner10 = cornerPointAt(segPtB, 1), corner11 = cornerPointAt(segPtB, -1);
    const vertBase = ribbonPosArr.length / 3;
    [corner00, corner01, corner10, corner11].forEach((cornerObj) => ribbonPosArr.push(cornerObj.x, cornerObj.y, cornerObj.z));
    ribbonUvArr.push(0, cumulativeLen / 8, 1, cumulativeLen / 8, 0, (cumulativeLen + segLen) / 8, 1, (cumulativeLen + segLen) / 8);
    ribbonIdxArr.push(vertBase, vertBase + 2, vertBase + 1, vertBase + 1, vertBase + 2, vertBase + 3);
    // Pagar pengaman pada sisi LUAR (lebih jauh dari sentroid loop)
    const midPtX = (segPtA.x + segPtB.x) / 2, midPtZ = (segPtA.z + segPtB.z) / 2;
    const distPlusSide = Math.hypot(midPtX + perpX * 5 - loopCentrePt.x, midPtZ + perpZ * 5 - loopCentrePt.z);
    const distMinusSide = Math.hypot(midPtX - perpX * 5 - loopCentrePt.x, midPtZ - perpZ * 5 - loopCentrePt.z);
    const outerSideSign = distPlusSide >= distMinusSide ? 1 : -1;
    const outerPt0 = outerSideSign > 0 ? corner00 : corner01, outerPt1 = outerSideSign > 0 ? corner10 : corner11;
    const railMesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, segLen), guardRailMat);
    railMesh.position.set((outerPt0.x + outerPt1.x) / 2, (outerPt0.y + outerPt1.y) / 2 + 0.55, (outerPt0.z + outerPt1.z) / 2);
    railMesh.lookAt(outerPt1.x, outerPt1.y + 0.55, outerPt1.z);
    scene.add(railMesh);
    for (let postDist = 0; postDist <= segLen; postDist += 8) {
      const postT = postDist / segLen;
      const postX = segPtA.x + segDx * postT + perpX * outerSideSign * (ribbonWidth / 2 + 0.3), postZ = segPtA.z + segDz * postT + perpZ * outerSideSign * (ribbonWidth / 2 + 0.3);
      railPostPts.push({ x: postX, z: postZ, y: groundH(postX, postZ) }); }
    cumulativeLen += segLen; }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.Float32BufferAttribute(ribbonPosArr, 3));
  ribbonGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ribbonUvArr, 2));
  ribbonGeo.setIndex(ribbonIdxArr);
  ribbonGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(ribbonGeo, ribbonMat));
  // Tiang pagar pengaman sebagai satu InstancedMesh
  const postInstMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 6), guardRailMat, Math.max(1, railPostPts.length));
  {
    const tmpMat4 = new THREE.Matrix4();
    railPostPts.forEach((postObj, postIdx) => { tmpMat4.makeTranslation(postObj.x, postObj.y + 0.31, postObj.z); postInstMesh.setMatrixAt(postIdx, tmpMat4); });
    postInstMesh.instanceMatrix.needsUpdate = true; }
  scene.add(postInstMesh);
  // Pohon ceri di sepanjang rute (12, sisi bergantian, tiap pada tinggi tanahnya sendiri)
  for (let treeIdx = 0; treeIdx < 12; ++treeIdx) {
    const routePt = routePtsRaw[treeIdx % routePtsRaw.length];
    const nextPt = routePtsRaw[Math.min(treeIdx + 1, routePtsRaw.length - 1)];
    const segDx = nextPt.x - routePt.x, segDz = nextPt.z - routePt.z, segLen = Math.hypot(segDx, segDz) || 1;
    const sideSign = treeIdx % 2 === 0 ? 1 : -1;
    const treeX = routePt.x + (-segDz / segLen) * sideSign * rr(10, 13), treeZ = routePt.z + (segDx / segLen) * sideSign * rr(10, 13);
    const cherryTree = makeShadeTree(rr(3, 4.5), 0xe8a0bf);
    cherryTree.position.set(treeX, groundH(treeX, treeZ), treeZ);
    cherryTree.rotation.y = rr(0, 6.28);
    scene.add(cherryTree); } }
export function roadRoute(G, fromPt, toPt) {
  const snapCoordTo = (probeVal, roadList) => roadList.reduce((candA, candB) => Math.abs(candB - probeVal) < Math.abs(candA - probeVal) ? candB : candA, roadList[0]);
  const fromSnapX = snapCoordTo(fromPt.x, G.roadX), fromSnapZ = snapCoordTo(fromPt.z, G.roadZ);
  const toSnapX = snapCoordTo(toPt.x, G.roadX), toSnapZ = snapCoordTo(toPt.z, G.roadZ);
  const routePtList = [{ x: fromPt.x, z: fromPt.z }, { x: fromSnapX, z: fromPt.z }, { x: fromSnapX, z: fromSnapZ }];
  // Pilih urutan lebih pendek: kaki-x-dulu vs kaki-z-dulu via sudut
  const cornerPtA = { x: toSnapX, z: fromSnapZ }, cornerPtB = { x: fromSnapX, z: toSnapZ };
  const legDistA = Math.abs(toSnapX - fromSnapX) + Math.abs(toSnapZ - fromSnapZ), legDistB = legDistA;
  void legDistB;
  routePtList.push(cornerPtA, { x: toSnapX, z: toSnapZ }, { x: toPt.x, z: toPt.z });
  void cornerPtB;
  // Dedup titik berurutan
  return routePtList.filter((ptObj, ptIdx) => ptIdx === 0 || Math.hypot(ptObj.x - routePtList[ptIdx - 1].x, ptObj.z - routePtList[ptIdx - 1].z) > 1); }
function terapkanPijarSenja(G, jumlahNeon, jumlahGabungan, jumlahGelapTanda) {
  if (G.buildingMats) G.buildingMats.forEach((refMat) => { refMat.emissiveIntensity = jumlahGabungan * 0.7; });
  if (G.neonTrimMats) G.neonTrimMats.forEach((refMat) => { refMat.emissiveIntensity = jumlahNeon * 2.4; });
  if (G.streetlightGlows) G.streetlightGlows.forEach((objSpr) => { objSpr.material.opacity = jumlahGabungan * 0.85; });
  if (G.lampHeadMat) G.lampHeadMat.emissiveIntensity = 0.15 + jumlahGabungan * 3.0;
  if (G.lampPoolMat) G.lampPoolMat.opacity = jumlahGabungan * 0.3;
  glowSpritesList.forEach((objSpr) => { objSpr.material.opacity = jumlahGelapTanda * 0.9; }); }
export function updateWorld(G, dt) {
  const todVal = G.timeOfDay;
  const dayLevel = Math.max(0, Math.min(1, Math.sin(((todVal - 6) / 12) * Math.PI)));
  const duskAmt = Math.max(0, 1 - Math.abs(todVal - 18.2) / 1.6) * (todVal > 12 ? 1 : 0) + Math.max(0, 1 - Math.abs(todVal - 6.2) / 1.2) * 0.6;
  computeSkyColors(todVal);
  if (skyDome) {
    if (Math.abs(todVal - skyLastHour) > 0.05) { paintSkyDome(); skyLastHour = todVal; }
  } else {
    G.scene.background = skyHorCol; }
  if (G.scene.fog) { G.scene.fog.color.copy(skyFogCol); }
  if (G.sun) { G.sun.intensity = 0.25 + dayLevel * 1.27; G.sun.color.set(0xffd9b0); const sunAngle = ((todVal - 6) / 12) * Math.PI; G.sun.position.set(Math.cos(sunAngle) * 300, Math.max(20, Math.sin(sunAngle) * 300), 120); }
  if (G.hemi) { G.hemi.intensity = 0.25 + dayLevel * 0.65; if (G.hemi.color) G.hemi.color.copy(skyTopCol).lerp(skyWarmCol, 0.3); if (G.hemi.groundColor) G.hemi.groundColor.set(0xb09a7a); }
  const nightAmt = 1 - dayLevel;
  // Onset pijar senja: tiap kolam lampu / jendela menyala / ramp
  // neon berangkat dari `combinedGlowAmt`, yang mulai pada
  // VICE.dusk.onset (17.2, trim neon pada 17.0) dan PENUH pada
  // VICE.dusk.full (17.8) — senja terbaca menyala, bukan hanya malam.
  // Sesudah penuh ia tetap menyala sepanjang malam; pra-fajar ia mengikuti `nightAmt`.
  const rampBetween = (rangeFrom, rangeTo) => Math.max(0, Math.min(1, (todVal - rangeFrom) / Math.max(0.001, rangeTo - rangeFrom)));
  const duskGlowAmt = todVal >= VICE.dusk.onset && todVal < 24 ? Math.max(rampBetween(VICE.dusk.onset, VICE.dusk.full), nightAmt) : nightAmt;
  const neonGlowAmt = todVal >= VICE.dusk.neonOnset && todVal < 24 ? Math.max(rampBetween(VICE.dusk.neonOnset, VICE.dusk.full), nightAmt) : nightAmt;
  const combinedGlowAmt = Math.max(nightAmt, duskGlowAmt);
  const signDarkAmt = Math.min(1, combinedGlowAmt * 0.9 + Math.min(1, Math.max(0, duskAmt)) * 0.35);
  terapkanPijarSenja(G, neonGlowAmt, combinedGlowAmt, signDarkAmt);
  if (G.water) G.water.position.y = -0.4 + Math.sin(G.elapsed || 0) * 0.03; }
