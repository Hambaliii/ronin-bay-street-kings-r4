// Wave-8 pass: terrain, textures, housing, the market, beach and boulevard.
// Builders below were re-decomposed; placement and draw order are unchanged.
import * as THREE from 'three'; import {
  CFG, DISTRICTS, TOUGE_POINTS, VICE }
from './config.js'; import {
  rnd, rr, ri, pick }
from './random.js'; import {
  loadHeroAsset }
from './assets.js'; let zW8CacheTexPijar = null; function zW8GetGlowTexture() {
  if (zW8CacheTexPijar) return zW8CacheTexPijar; const zW8KanvasPijar = document.createElement('canvas'); zW8KanvasPijar.height = 128;
  zW8KanvasPijar.width = zW8KanvasPijar.height; const zW8KuasPijar = zW8KanvasPijar.getContext('2d');
  const zW8RadialPijar = zW8KuasPijar.createRadialGradient(64, 64, 2, 64, 64, 64); zW8RadialPijar.addColorStop(0, 'rgba(255,255,255,1)');
  zW8RadialPijar.addColorStop(0.4, 'rgba(255,255,255,.45)'); zW8RadialPijar.addColorStop(1, 'rgba(255,255,255,0)'); zW8KuasPijar.fillStyle = zW8RadialPijar;
  zW8KuasPijar.fillRect(0, 0, 128, 128); zW8CacheTexPijar = new THREE.CanvasTexture(zW8KanvasPijar); return zW8CacheTexPijar; }

const zW8SKY_KEY_ROWS = [[0, '#060a18', '#0e1830', '#16233f', '#101a2e'], [5, '#060a18', '#0e1830', '#16233f', '#101a2e'], [7, '#3d6fb4', '#d9a06b', '#f2d5a0', '#e8c9a0'], [10.5, '#3a7bd5', '#8ec9e8', '#bfe3ef', '#cfe4ec'], [16.5, '#3a6db0', '#c9b49a', '#f7d99a', '#ecd3a4'], [17.8, '#35507a', '#e8763a', '#ffc46b', '#f2c99a'], [19.5, '#141e38', '#6a4a5a', '#c97a4a', '#7a5a4e'], [22, '#060a18', '#0e1830', '#16233f', '#101a2e'], [24, '#060a18', '#0e1830', '#16233f', '#101a2e'],];
const zW8SKY_KEYFRAMES = []; zW8SKY_KEY_ROWS.forEach(([zW8JamBaris, zW8HexAtas, zW8HexTengah, zW8HexHor, zW8HexKabut]) => {
    const zW8RekKunci = {
  }; zW8RekKunci.h = zW8JamBaris; zW8RekKunci.top = new THREE.Color(zW8HexAtas); zW8RekKunci.mid = new THREE.Color(zW8HexTengah);
  zW8RekKunci.hor = new THREE.Color(zW8HexHor); zW8RekKunci.fog = new THREE.Color(zW8HexKabut); zW8SKY_KEYFRAMES.push(zW8RekKunci); });
const zW8WarnaLangitAtas = new THREE.Color(), zW8WarnaLangitTengah = new THREE.Color(), zW8WarnaLangitHor = new THREE.Color(), zW8WarnaKabutLangit = new THREE.Color();
const zW8WarnaLangitHangat = new THREE.Color(0xffe0b8); function zW8ComputeSkyColors(zW8JamNilai) {

  let zW8IdxKunciAktif = 0; let zW8IdxPindai = 1;
    while (zW8IdxPindai < zW8SKY_KEYFRAMES.length - 1) {
    if (zW8SKY_KEYFRAMES[zW8IdxPindai].h > zW8JamNilai) break; zW8IdxKunciAktif = zW8IdxPindai; ++ zW8IdxPindai; }
  const zW8KunciAwal = zW8SKY_KEYFRAMES[zW8IdxKunciAktif], zW8KunciTujuan = zW8SKY_KEYFRAMES[zW8IdxKunciAktif + 1];
  const zW8FraksiMentah = (zW8JamNilai - (zW8KunciAwal.h)) / Math.max(0.001, zW8KunciTujuan.h - (zW8KunciAwal.h));
  const zW8FraksiCampur = zW8FraksiMentah < 0 ? 0 : zW8FraksiMentah > 1 ? 1 : zW8FraksiMentah;
  zW8WarnaLangitAtas.lerpColors(zW8KunciAwal.top, zW8KunciTujuan.top, zW8FraksiCampur);
  zW8WarnaLangitTengah.lerpColors(zW8KunciAwal.mid, zW8KunciTujuan.mid, zW8FraksiCampur);
  zW8WarnaLangitHor.lerpColors(zW8KunciAwal.hor, zW8KunciTujuan.hor, zW8FraksiCampur);
  zW8WarnaKabutLangit.lerpColors(zW8KunciAwal.fog, zW8KunciTujuan.fog, zW8FraksiCampur); }
let zW8LembarLangit = null, zW8KuasLangit = null, zW8TexLangitObj = null, zW8KubahLangit = null, zW8JamLangitTerakhir = - 10; let zW8DaftarSpritePijar = [];
  function zW8PaintSkyDome() {
  if (! zW8KuasLangit) return; const zW8GradienLangit = zW8KuasLangit.createLinearGradient(0, 0, 0, 512);
  zW8GradienLangit.addColorStop(0, '#' + zW8WarnaLangitAtas.getHexString()); zW8GradienLangit.addColorStop(0.55, '#' + zW8WarnaLangitTengah.getHexString());
  zW8GradienLangit.addColorStop(1, '#' + zW8WarnaLangitHor.getHexString()); zW8KuasLangit.fillStyle = zW8GradienLangit; zW8KuasLangit.fillRect(0, 0, 16, 512);
  if (zW8TexLangitObj) zW8TexLangitObj.needsUpdate = true; }
  export function glowSprite(zW8NadaPijar, zW8UkuranPijar) {
    const zW8MatSpritePijar = new THREE.SpriteMaterial({
    map : zW8GetGlowTexture(), color : zW8NadaPijar, transparent : true, blending : THREE.AdditiveBlending, depthWrite : false, opacity : 0.85
  }); const zW8SpritePijarBaru = new THREE.Sprite(zW8MatSpritePijar); zW8SpritePijarBaru.scale.set (zW8UkuranPijar, zW8UkuranPijar, 1); return zW8SpritePijarBaru; }
  export function groundH(x, z) {
  const zW8OffsetX = 330 + x, zW8OffsetZ = 470 + z; const zW8JarakKuadratNorm = ((zW8OffsetX * zW8OffsetX) + (zW8OffsetZ * zW8OffsetZ)) / (330 * 330);
  let zW8TinggiTanah = Math.exp(- zW8JarakKuadratNorm * 2.2) * 14; if (x > - 140 || z > - 180) zW8TinggiTanah *= Math.max(0, Math.min(1, ((- 140 - (x)) / 120) + 1));

  if (x > - 100 || z > - 100) zW8TinggiTanah = 0; return zW8TinggiTanah; }
  function zW8MakeCanvasTexture(zW8LebarVal, zW8TinggiVal, zW8FungsiGambar) {
  const zW8KanvasBaru = document.createElement('canvas'); zW8KanvasBaru.width = zW8LebarVal; zW8KanvasBaru.height = zW8TinggiVal;
  zW8FungsiGambar(zW8KanvasBaru.getContext('2d'), zW8LebarVal, zW8TinggiVal); const zW8TexKanvas = new THREE.CanvasTexture(zW8KanvasBaru);
  zW8TexKanvas.colorSpace = THREE.SRGBColorSpace; return zW8TexKanvas; }
  function zW8BuildGroundTexture() {

    return zW8MakeCanvasTexture(256, 256, (zW8Kuas) => {
    zW8Kuas.fillStyle = VICE.ground.base; zW8Kuas.fillRect(0, 0, 256, 256);
      for (let zW8IdxBintik = 0; zW8IdxBintik < 900; ++ zW8IdxBintik) {
      zW8Kuas.fillStyle = `rgba(${190 + ri(0, 50)},${175 + ri(0, 45)},${140 + ri(0, 40)},.14)`;
      zW8Kuas.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
    let zW8IdxTambal = 0;
      while (zW8IdxTambal < 26) {
      zW8Kuas.fillStyle = 'rgba(255,250,235,.06)'; zW8Kuas.fillRect(rnd() * 256, rnd() * 256, rr(18, 46), rr(12, 30)); ++ zW8IdxTambal; }
    zW8Kuas.strokeStyle = 'rgba(120,110,90,.10)'; zW8Kuas.strokeRect(0, 0, 256, 256); }); }

  const zW8BuildPavingTexture = () => {
    const zW8TexPaving = zW8MakeCanvasTexture(128, 128, (zW8KuasQ) => {
    zW8KuasQ.fillStyle = VICE.ground.paving; zW8KuasQ.fillRect(0, 0, 128, 128); zW8KuasQ.fillStyle = VICE.ground.pavingAlt; zW8KuasQ.fillRect(64, 0, 64, 64);
    zW8KuasQ.fillRect(0, 64, 64, 64); for (let zW8IdxBintikQ = 0; ! (zW8IdxBintikQ >= 260); ++ zW8IdxBintikQ) {
      zW8KuasQ.fillStyle = `rgba(${150 + ri(0, 60)},${145 + ri(0, 50)},${120 + ri(0, 40)},.13)`;
      zW8KuasQ.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
    zW8KuasQ.strokeStyle = VICE.ground.pavingGrout; zW8KuasQ.lineWidth = 3; zW8KuasQ.strokeRect(0, 0, 128, 128); zW8KuasQ.beginPath(); zW8KuasQ.moveTo(64, 0);
    zW8KuasQ.lineTo(64, 128); zW8KuasQ.moveTo(0, 64); zW8KuasQ.lineTo(128, 64); zW8KuasQ.stroke();
  }); zW8TexPaving.wrapS = zW8TexPaving.wrapT = THREE.RepeatWrapping; return zW8TexPaving; };

  const zW8BuildGrassTexture = () => {
    const zW8TexRumput = zW8MakeCanvasTexture(128, 128, (zW8KuasQQ) => {
    zW8KuasQQ.fillStyle = VICE.ground.grass; zW8KuasQQ.fillRect(0, 0, 128, 128); for (let zW8IdxBilah = 0; zW8IdxBilah < 700; ++ zW8IdxBilah) {
      zW8KuasQQ.fillStyle = ! (rnd() < 0.5) ? VICE.ground.grassDark : VICE.ground.grassLight; zW8KuasQQ.globalAlpha = rr(0.12, 0.3);
      zW8KuasQQ.fillRect(rnd() * 128, rnd() * 128, 2, rr(2, 4)); }
    zW8KuasQQ.globalAlpha = 1;
  }); zW8TexRumput.wrapS = zW8TexRumput.wrapT = THREE.RepeatWrapping; return zW8TexRumput; };

  const zW8BuildSandTexture = () => {
    const zW8TexPasir = zW8MakeCanvasTexture(128, 128, (zW8KuasQQQ) => {
    zW8KuasQQQ.fillStyle = VICE.ground.sand; zW8KuasQQQ.fillRect(0, 0, 128, 128); for (let zW8IdxButir = 0; zW8IdxButir < 500; ++ zW8IdxButir) {
      zW8KuasQQQ.fillStyle = ! (rnd() < 0.6) ? '#fff3cf' : VICE.ground.sandSpeckle; zW8KuasQQQ.globalAlpha = rr(0.1, 0.28);
      zW8KuasQQQ.fillRect(rnd() * 128, rnd() * 128, 2, 2); }
    zW8KuasQQQ.globalAlpha = 1;
  }); zW8TexPasir.wrapS = zW8TexPasir.wrapT = THREE.RepeatWrapping; return zW8TexPasir;
}; const zW8MakeGrassMat = (zW8UlangX, zW8UlangY) => {
  const zW8TexRumputQ = zW8BuildGrassTexture(); zW8TexRumputQ.repeat.set (zW8UlangX, zW8UlangY); return new THREE.MeshStandardMaterial({
    map : zW8TexRumputQ, roughness : 1 });
}; const zW8MakePavingMat = (zW8UlangXQ, zW8UlangYQ, zW8NadaVal) => {
  const zW8TexPavingQ = zW8BuildPavingTexture(); zW8TexPavingQ.repeat.set (zW8UlangXQ, zW8UlangYQ); return new THREE.MeshStandardMaterial({
    map : zW8TexPavingQ, color : zW8NadaVal || 0xffffff, roughness : 1 });
}; const zW8LIT_WINDOW_TONES = ['#ffd9a0', '#ffc98a', '#fff3d0', '#ffe9b8', '#bfe0ff', '#9fd4ff',];
  const zW8BuildBuildingTexture = (zW8WarnaDasar, zW8PeluangNyala) => zW8MakeCanvasTexture(128, 256, (zW8KuasQQQQ, zW8LebarValQ, zW8TinggiValQ) => {
  zW8KuasQQQQ.fillStyle = zW8WarnaDasar; zW8KuasQQQQ.fillRect(0, 0, zW8LebarValQ, zW8TinggiValQ);
    for (let zW8BarisY = 8; zW8BarisY < zW8TinggiValQ - 8; zW8BarisY += 14) for (let zW8KolomX = 6; zW8KolomX < zW8LebarValQ - 6; zW8KolomX += 14) {
    const zW8IalahNyala = rnd() < zW8PeluangNyala; zW8KuasQQQQ.fillStyle = zW8IalahNyala ? zW8LIT_WINDOW_TONES[Math.floor(rnd() * (rnd() < 0.72 ? 4 : 6))] : '#2c3844';
    zW8KuasQQQQ.fillRect(zW8KolomX, zW8BarisY, 9, 8); zW8KuasQQQQ.fillStyle = 'rgba(255,255,255,.15)'; zW8KuasQQQQ.fillRect(zW8KolomX, zW8BarisY, 9, 2); }
}); const zW8BuildSignTexture = (zW8TeksLabel, zW8WarnaLatar, zW8WarnaDepan) => zW8MakeCanvasTexture(256, 64, (zW8KuasQQQQQ, zW8LebarValQQ, zW8TinggiValQQ) => {
  zW8KuasQQQQQ.fillStyle = zW8WarnaLatar; zW8KuasQQQQQ.fillRect(0, 0, zW8LebarValQQ, zW8TinggiValQQ); zW8KuasQQQQQ.font = 'bold 34px sans-serif';
  zW8KuasQQQQQ.textAlign = 'center'; zW8KuasQQQQQ.textBaseline = 'middle'; zW8KuasQQQQQ.shadowColor = zW8WarnaDepan; zW8KuasQQQQQ.shadowBlur = 12;
  zW8KuasQQQQQ.fillStyle = zW8WarnaDepan; zW8KuasQQQQQ.fillText(zW8TeksLabel, zW8LebarValQQ / 2, zW8TinggiValQQ / 2);
}); export function makePalm(zW8TinggiValQQQ) {
  const zW8GrupPalemBaru = new THREE.Group(); const zW8MatBatangPalem = new THREE.MeshStandardMaterial({
    color : 0x8a6b4a, roughness : 0.95 });
  const zW8KurvaBatangPalem = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, zW8TinggiValQQQ * 0.55, 0), new THREE.Vector3(0.55, zW8TinggiValQQQ, 0));
  const zW8MeshBatangPalem = new THREE.Mesh(new THREE.TubeGeometry(zW8KurvaBatangPalem, 6, 0.14, 6), zW8MatBatangPalem); zW8GrupPalemBaru.add(zW8MeshBatangPalem);
  const zW8TitikPuncak = zW8KurvaBatangPalem.getPoint(1); const zW8MatDaunPalem = new THREE.MeshStandardMaterial({
    vertexColors : true, side : THREE.DoubleSide, roughness : 0.9
  }); let zW8IdxDaun = 0;
    while (zW8IdxDaun < 8) {
    const zW8LenDaun = rr(2.0, 2.4); const zW8GeoDaunBaru = new THREE.PlaneGeometry(0.5, zW8LenDaun, 1, 6); const zW8AttrPosisi = zW8GeoDaunBaru.attributes.position;
    const zW8DaftarWarnaDaun = []; const zW8WarnaAwalDaun = new THREE.Color(0x2e7d32); const zW8WarnaAkhirDaun = new THREE.Color(0x66bb4a);
    const zW8WarnaCoretDaun = new THREE.Color(); for (let zW8IdxVertex = 0; zW8IdxVertex < zW8AttrPosisi.count; ++ zW8IdxVertex) {
      const zW8VertexY = zW8AttrPosisi.getY(zW8IdxVertex); const zW8FraksiDaun = (zW8VertexY + (zW8LenDaun / 2)) / zW8LenDaun;
      zW8AttrPosisi.setZ(zW8IdxVertex, - (Math.pow(zW8FraksiDaun, 2) * 0.9));
      zW8AttrPosisi.setX(zW8IdxVertex, zW8AttrPosisi.getX(zW8IdxVertex) * (1 - (zW8FraksiDaun * 0.7)));
      zW8WarnaCoretDaun.copy(zW8WarnaAwalDaun).lerp(zW8WarnaAkhirDaun, zW8FraksiDaun);
      zW8DaftarWarnaDaun.push(zW8WarnaCoretDaun.r, zW8WarnaCoretDaun.g, zW8WarnaCoretDaun.b); }
    zW8GeoDaunBaru.setAttribute('color', new THREE.Float32BufferAttribute(zW8DaftarWarnaDaun, 3)); zW8GeoDaunBaru.computeVertexNormals();
    const zW8MeshDaunBaru = new THREE.Mesh(zW8GeoDaunBaru, zW8MatDaunPalem); zW8MeshDaunBaru.position.copy(zW8TitikPuncak); zW8MeshDaunBaru.rotation.order = 'YXZ';
    zW8MeshDaunBaru.rotation.y = ((zW8IdxDaun / 8) * 2 * Math.PI) + rr(- 0.2, 0.2); zW8MeshDaunBaru.rotation.x = (- Math.PI / 2) + rr(0.35, 0.6);
    zW8MeshDaunBaru.translateY((zW8LenDaun / 2) - 0.1); zW8GrupPalemBaru.add(zW8MeshDaunBaru); ++ zW8IdxDaun; }
    zW8GrupPalemBaru.traverse((zW8ObjNode) => {
    if (zW8ObjNode.isMesh) zW8ObjNode.castShadow = true;
  }); return zW8GrupPalemBaru; }
  export function makeShadeTree(zW8TinggiValQQQQ, zW8WarnaKanopi) {
  const zW8GrupPohonBaru = new THREE.Group();
    const zW8MeshBatangPohon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, zW8TinggiValQQQQ * 0.55, 7), new THREE.MeshStandardMaterial({
    color : 0x6b4a2f, roughness : 1
  })); zW8MeshBatangPohon.position.y = zW8TinggiValQQQQ * 0.275; zW8GrupPohonBaru.add(zW8MeshBatangPohon); const zW8MatKanopiPohon = new THREE.MeshStandardMaterial({
    color : zW8WarnaKanopi || 0x3d8b4f, roughness : 1, flatShading : true
  }); for (let zW8IdxGumpal = 0; ! (zW8IdxGumpal >= 3); ++ zW8IdxGumpal) {
    const zW8RadiusGumpalBaru = rr(0.28, 0.4) * zW8TinggiValQQQQ;
    const zW8MeshGumpalBaru = new THREE.Mesh(new THREE.IcosahedronGeometry(zW8RadiusGumpalBaru, 1), zW8MatKanopiPohon);
    zW8MeshGumpalBaru.position.set (rr(- 0.5, 0.5), (zW8TinggiValQQQQ * 0.55) + rr(0, zW8TinggiValQQQQ * 0.3), rr(- 0.5, 0.5)); zW8GrupPohonBaru.add(zW8MeshGumpalBaru); }
  return zW8GrupPohonBaru; }

  const zW8MARKET = {
}; zW8MARKET.x = - 82.5; zW8MARKET.z = - 255; zW8MARKET.name = 'RONIN MART'; const zW8CacheMatStd = new Map();
  function zW8SharedStdMat(zW8WarnaVal, zW8KasarVal, zW8LogamVal) {
  const zW8KunciMat = zW8WarnaVal + '|' + (zW8KasarVal || 0.95) + '|' + (zW8LogamVal || 0);
    if (! zW8CacheMatStd.has(zW8KunciMat)) zW8CacheMatStd.set (zW8KunciMat, new THREE.MeshStandardMaterial({
    color : zW8WarnaVal, roughness : zW8KasarVal || 0.95, metalness : zW8LogamVal || 0
  })); return zW8CacheMatStd.get (zW8KunciMat); }
  const zW8TougeDistance = (x, z) => {
  let zW8JarakMinimum = 1e9; TOUGE_POINTS.slice(0, - 1).forEach((zW8TitikA, zW8IdxSeg) => {
    const zW8AxVal = zW8TitikA[0], zW8AzVal = zW8TitikA[1], zW8BxVal = TOUGE_POINTS[zW8IdxSeg + 1][0], zW8BzVal = TOUGE_POINTS[zW8IdxSeg + 1][1];
    const zW8DeltaSegX = zW8BxVal - (zW8AxVal), zW8DeltaSegZ = zW8BzVal - (zW8AzVal);
    const zW8PanjangSegKuadrat = ((zW8DeltaSegX * zW8DeltaSegX) + (zW8DeltaSegZ * zW8DeltaSegZ)) || 1;
    let zW8ParameterT = (((x - (zW8AxVal)) * zW8DeltaSegX) + ((z - (zW8AzVal)) * zW8DeltaSegZ)) / zW8PanjangSegKuadrat;
    zW8ParameterT = Math.max(0, Math.min(1, zW8ParameterT));
    const zW8JarakKandidat = Math.hypot(x + (- (zW8AxVal + (zW8DeltaSegX * zW8ParameterT))), z + (- (zW8AzVal + (zW8DeltaSegZ * zW8ParameterT))));
    if (zW8JarakKandidat < zW8JarakMinimum) zW8JarakMinimum = zW8JarakKandidat;
  }); return zW8JarakMinimum;
}; function zW8MakePrismGeo(zW8LebarValQQQ, zW8TinggiValQQQQQ, zW8DalamVal) {
  const zW8SiluetPrisma = new THREE.Shape(); zW8SiluetPrisma.moveTo(- zW8LebarValQQQ / 2, 0); zW8SiluetPrisma.lineTo(zW8LebarValQQQ / 2, 0);
  zW8SiluetPrisma.lineTo(0, zW8TinggiValQQQQQ); zW8SiluetPrisma.closePath(); const zW8GeoPrisma = new THREE.ExtrudeGeometry(zW8SiluetPrisma, {
    depth : zW8DalamVal, bevelEnabled : false
  }); zW8GeoPrisma.translate(0, 0, - zW8DalamVal / 2); return zW8GeoPrisma; }
const zW8HOUSE_WALL_COLOURS = ['#f2e3c8', '#eec9b8', '#dfe8d8', '#f5d9e0', '#dcebf5', '#f7ecc9', '#e6d7f0', '#ffe8cc',];
const zW8HOUSE_ROOF_COLOURS = [0xb5523c, 0x8a4a3a, 0x5d6d7e, 0xa03d2d, 0x6b4a35, 0x44586a, 0xc96f4a,];
const zW8HOUSE_YARD_GREENS = [0x5d9a52, 0x67a35a, 0x548c4c, 0x71ab60,]; const zW8HouseWinMat = new THREE.MeshStandardMaterial({
  color : 0xbfe0ea, roughness : 0.25, metalness : 0.4, emissive : 0xffc873, emissiveIntensity : 0.35
}); let zW8WarnaDindingTerakhir = null; function zW8ConstructHouse(G, zW8Scene, zW8Hx, zW8Hz, zW8ArahHadap) {
  const zW8GrupRumahBaru = new THREE.Group(); zW8GrupRumahBaru.position.set (zW8Hx, groundH(zW8Hx, zW8Hz), zW8Hz);
  zW8GrupRumahBaru.rotation.y = zW8ArahHadap > 0 ? 0 : Math.PI; const zW8IalahDuaLantai = rnd() < 0.45;
  const zW8WidRumah = rr(9, 12), zW8DepRumah = rr(8, 10), zW8TinggiDindingRumah = zW8IalahDuaLantai ? rr(5.2, 6) : rr(2.9, 3.4); const zW8TinggiAtapRumah = rr(1.8, 2.6);

  const zW8MeshLotRumah = new THREE.Mesh(new THREE.PlaneGeometry(30, 25), zW8MakePavingMat(6, 5)); void zW8HOUSE_YARD_GREENS; zW8MeshLotRumah.rotation.x = - Math.PI / 2;
  zW8MeshLotRumah.position.y = 0.03; zW8GrupRumahBaru.add(zW8MeshLotRumah);
  const zW8MeshDriveRumah = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8.5), zW8SharedStdMat(0x9a9a96, 1)); zW8MeshDriveRumah.rotation.x = - Math.PI / 2;
  zW8MeshDriveRumah.position.set (zW8WidRumah * - 0.28, 0.05, (zW8DepRumah / 2) + 4.2); zW8GrupRumahBaru.add(zW8MeshDriveRumah);
  const zW8MatPagarRumah = zW8SharedStdMat(0x2e6b34, 1); const zW8MeshPagarBelakangRumah = new THREE.Mesh(new THREE.BoxGeometry(30, 0.55, 0.4), zW8MatPagarRumah);
  zW8MeshPagarBelakangRumah.position.set (0, 0.28, - 12.3); zW8GrupRumahBaru.add(zW8MeshPagarBelakangRumah); [- 1, 1].forEach((zW8TandaSisi) => {
    const zW8MeshPagarSisiRumah = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 25), zW8MatPagarRumah);
    zW8MeshPagarSisiRumah.position.set (zW8TandaSisi * 14.8, 0.28, 0); zW8GrupRumahBaru.add(zW8MeshPagarSisiRumah);
  }); let zW8WarnaDindingRumah = pick(zW8HOUSE_WALL_COLOURS);
  if (zW8WarnaDindingRumah === zW8WarnaDindingTerakhir) zW8WarnaDindingRumah = zW8HOUSE_WALL_COLOURS[(zW8HOUSE_WALL_COLOURS.indexOf(zW8WarnaDindingRumah) + 1) % zW8HOUSE_WALL_COLOURS.length];
  zW8WarnaDindingTerakhir = zW8WarnaDindingRumah;
  const zW8MeshDindingRumah = new THREE.Mesh(new THREE.BoxGeometry(zW8WidRumah, zW8TinggiDindingRumah, zW8DepRumah), zW8SharedStdMat(new THREE.Color(zW8WarnaDindingRumah).getHex(), 0.95));
  zW8MeshDindingRumah.position.y = zW8TinggiDindingRumah / 2; zW8GrupRumahBaru.add(zW8MeshDindingRumah);
  const zW8MeshAtapRumah = new THREE.Mesh(zW8MakePrismGeo(zW8WidRumah + 1.2, zW8TinggiAtapRumah, zW8DepRumah + 1), zW8SharedStdMat(pick(zW8HOUSE_ROOF_COLOURS), 0.9));
  zW8MeshAtapRumah.position.y = zW8TinggiDindingRumah; zW8GrupRumahBaru.add(zW8MeshAtapRumah);
  const zW8MeshPintuRumah = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), zW8SharedStdMat(0x4a3220, 0.9));
  zW8MeshPintuRumah.position.set (zW8WidRumah * - 0.28, 1.1, (zW8DepRumah / 2) + 0.06); zW8GrupRumahBaru.add(zW8MeshPintuRumah);
  const zW8DaftarBarisJendela = zW8IalahDuaLantai ? [1.9, 4.4] : [1.9]; zW8DaftarBarisJendela.forEach((zW8BarisYQ) => {
      [0, zW8WidRumah * 0.3].forEach((zW8KolomXQ) => {
      const zW8MeshJendelaRumah = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), zW8HouseWinMat);
      zW8MeshJendelaRumah.position.set (zW8KolomXQ, zW8BarisYQ, (zW8DepRumah / 2) + 0.06); zW8GrupRumahBaru.add(zW8MeshJendelaRumah); });
  }); if (rnd() < 0.4) {
    const zW8MeshCerobongRumah = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), zW8SharedStdMat(0x8a7a6a, 1));
    zW8MeshCerobongRumah.position.set (zW8WidRumah * 0.3, zW8TinggiDindingRumah + (zW8TinggiAtapRumah * 0.55), 0); zW8GrupRumahBaru.add(zW8MeshCerobongRumah); }
    if (rnd() < 0.35) {
    const zW8PohonHalamanRumah = makeShadeTree(rr(2.6, 3.4), 0x3d8b4f); zW8PohonHalamanRumah.position.set (11, 0, - 8); zW8GrupRumahBaru.add(zW8PohonHalamanRumah); }

    zW8GrupRumahBaru.traverse((zW8ObjNodeQ) => {
    if (zW8ObjNodeQ.isMesh) zW8ObjNodeQ.castShadow = true;
  }); zW8MeshLotRumah.castShadow = false; zW8MeshLotRumah.receiveShadow = true; zW8MeshDriveRumah.castShadow = false; zW8MeshDriveRumah.receiveShadow = true;
  zW8Scene.add(zW8GrupRumahBaru); G.addCollider(zW8Hx, zW8Hz, zW8WidRumah / 2, zW8DepRumah / 2, zW8TinggiDindingRumah + zW8TinggiAtapRumah); }
  function zW8ConstructResidentialBlock(G, zW8SceneQ, zW8Cx, zW8Cz) { [{
    dz : - 31, face : - 1 }, {
    dz : 31, face : 1
    }].forEach((zW8SpecBaris) => {
      [- 57, - 19, 19, 57].forEach((zW8LokalX) => {
      const zW8PosisiRumahX = (zW8Cx + zW8LokalX) + rr(- 3, 3), zW8PosisiRumahZ = (zW8Cz + zW8SpecBaris.dz) + rr(- 3, 3);
      if (zW8TougeDistance(zW8PosisiRumahX, zW8PosisiRumahZ) < 16) return;
      if (G.roadX.some((zW8NilaiJalan) => Math.abs(zW8PosisiRumahX - (zW8NilaiJalan)) < 26) || G.roadZ.some((zW8NilaiJalanQ) => Math.abs(zW8PosisiRumahZ - (zW8NilaiJalanQ)) < 26)) return;
      zW8ConstructHouse(G, zW8SceneQ, zW8PosisiRumahX, zW8PosisiRumahZ, zW8SpecBaris.face); }); }); }
  function zW8ConstructParkedCar(zW8WarnaCatVal) {
  const zW8GrupMobilParkir = new THREE.Group(); const zW8MeshBadanParkir = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.55, 4.4), new THREE.MeshStandardMaterial({
    color : zW8WarnaCatVal, roughness : 0.45, metalness : 0.35
  })); zW8MeshBadanParkir.position.y = 0.55; zW8GrupMobilParkir.add(zW8MeshBadanParkir);
  const zW8MeshKabinParkir = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), zW8SharedStdMat(0x1c2733, 0.2, 0.6)); zW8MeshKabinParkir.position.set (0, 1.05, - 0.15);
  zW8GrupMobilParkir.add(zW8MeshKabinParkir); const zW8GeoRodaParkir = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 10);
  const zW8MatRodaParkir = zW8SharedStdMat(0x17181a, 0.9); [- 1, 1].forEach((zW8SisiX) => {
      [- 1, 1].forEach((zW8SisiZ) => {
      const zW8MeshRodaParkir = new THREE.Mesh(zW8GeoRodaParkir, zW8MatRodaParkir); zW8MeshRodaParkir.rotation.z = Math.PI / 2;
      zW8MeshRodaParkir.position.set (zW8SisiX * 0.85, 0.33, zW8SisiZ * 1.35); zW8GrupMobilParkir.add(zW8MeshRodaParkir); });
  }); return zW8GrupMobilParkir; }
  function zW8ConstructMarket(G, zW8SceneQQ) {
  const zW8MartX = zW8MARKET.x, zW8MartZ = zW8MARKET.z; const zW8GrupMartBaru = new THREE.Group();
  zW8GrupMartBaru.position.set (zW8MartX, groundH(zW8MartX, zW8MartZ), zW8MartZ); zW8SceneQQ.add(zW8GrupMartBaru);
  const zW8MeshBlokMart = new THREE.Mesh(new THREE.BoxGeometry(46, 9, 22), zW8SharedStdMat(0xdfe3e6, 0.9)); zW8MeshBlokMart.position.y = 4.5;
  zW8GrupMartBaru.add(zW8MeshBlokMart); const zW8MeshLempengMart = new THREE.Mesh(new THREE.BoxGeometry(48, 0.5, 24), zW8SharedStdMat(0x3c4248, 0.9));
  zW8MeshLempengMart.position.y = 9.25; zW8GrupMartBaru.add(zW8MeshLempengMart); [[- 14, - 6], [12, 5]].forEach(([zW8PosisiAcX, zW8PosisiAcZ]) => {
    const zW8MeshAcMart = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.1, 2.6), zW8SharedStdMat(0x707880, 0.8, 0.3));
    zW8MeshAcMart.position.set (zW8PosisiAcX, 10.05, zW8PosisiAcZ); zW8GrupMartBaru.add(zW8MeshAcMart);
  }); const zW8MeshPitaMart = new THREE.Mesh(new THREE.BoxGeometry(34, 3.4, 0.4), zW8SharedStdMat(0x12233f, 0.8)); zW8MeshPitaMart.position.set (0, 7.4, 11.1);
  zW8GrupMartBaru.add(zW8MeshPitaMart); const zW8TexTandaMart = zW8MakeCanvasTexture(1024, 160, (zW8KuasQQQQQQ, zW8LebarValQQQQ, zW8TinggiValQQQQQQ) => {
    zW8KuasQQQQQQ.fillStyle = '#12233f'; zW8KuasQQQQQQ.fillRect(0, 0, zW8LebarValQQQQ, zW8TinggiValQQQQQQ); zW8KuasQQQQQQ.fillStyle = '#d8232a';
    zW8KuasQQQQQQ.fillRect(0, zW8TinggiValQQQQQQ - 18, zW8LebarValQQQQ, 18); zW8KuasQQQQQQ.fillStyle = '#d8232a'; zW8KuasQQQQQQ.beginPath();
    zW8KuasQQQQQQ.arc(72, 72, 44, 0, 2 * Math.PI); zW8KuasQQQQQQ.fill(); zW8KuasQQQQQQ.fillStyle = '#ffffff'; zW8KuasQQQQQQ.font = 'bold 44px sans-serif';
    zW8KuasQQQQQQ.textAlign = 'center'; zW8KuasQQQQQQ.textBaseline = 'middle'; zW8KuasQQQQQQ.fillText('R', 72, 76); zW8KuasQQQQQQ.font = 'bold 96px sans-serif';
    zW8KuasQQQQQQ.textAlign = 'left'; zW8KuasQQQQQQ.fillText('RONIN MART', 140, 76);
  }); const zW8MeshTandaMart = new THREE.Mesh(new THREE.PlaneGeometry(32, 3.2), new THREE.MeshBasicMaterial({
    map : zW8TexTandaMart
  })); zW8MeshTandaMart.position.set (0, 7.4, 11.32); zW8GrupMartBaru.add(zW8MeshTandaMart); const zW8PijarMartBaru = glowSprite(0x9fd4ff, 17);
  zW8PijarMartBaru.position.set (0, 7.4, 12.4); zW8PijarMartBaru.material.opacity = 0; zW8GrupMartBaru.add(zW8PijarMartBaru); zW8DaftarSpritePijar.push(zW8PijarMartBaru);
    const zW8TexKacaMart = zW8MakeCanvasTexture(512, 64, (zW8KuasQQQQQQQ, zW8LebarValQQQQQ, zW8TinggiValQQQQQQQ) => {
    const zW8GradienKaca = zW8KuasQQQQQQQ.createLinearGradient(0, 0, 0, zW8TinggiValQQQQQQQ); zW8GradienKaca.addColorStop(0, '#8fc3d4');
    zW8GradienKaca.addColorStop(1, '#3d6d80'); zW8KuasQQQQQQQ.fillStyle = zW8GradienKaca; zW8KuasQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQ, zW8TinggiValQQQQQQQ);
    zW8KuasQQQQQQQ.fillStyle = 'rgba(20,30,38,.85)'; zW8KuasQQQQQQQ.fillRect((zW8LebarValQQQQQ / 2) - 30, 6, 60, zW8TinggiValQQQQQQQ - 6);
    zW8KuasQQQQQQQ.strokeStyle = 'rgba(240,248,250,.9)'; zW8KuasQQQQQQQ.lineWidth = 3; for (let zW8PanelX = 0; ! (zW8PanelX > zW8LebarValQQQQQ); zW8PanelX += 42) {
      zW8KuasQQQQQQQ.beginPath(); zW8KuasQQQQQQQ.moveTo(zW8PanelX, 0); zW8KuasQQQQQQQ.lineTo(zW8PanelX, zW8TinggiValQQQQQQQ); zW8KuasQQQQQQQ.stroke(); }
    zW8KuasQQQQQQQ.strokeStyle = 'rgba(240,248,250,.95)'; zW8KuasQQQQQQQ.strokeRect((zW8LebarValQQQQQ / 2) - 30, 6, 60, zW8TinggiValQQQQQQQ - 6);
  }); const zW8MeshKacaMart = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.1), new THREE.MeshStandardMaterial({
    map : zW8TexKacaMart, roughness : 0.2, metalness : 0.5
  })); zW8MeshKacaMart.position.set (0, 1.75, 11.06); zW8GrupMartBaru.add(zW8MeshKacaMart);
  const zW8MeshKanopiMart = new THREE.Mesh(new THREE.BoxGeometry(11, 0.25, 3), zW8SharedStdMat(0x2c3138, 0.8)); zW8MeshKanopiMart.position.set (0, 3.6, 12.4);
  zW8GrupMartBaru.add(zW8MeshKanopiMart); const zW8TexPadMart = zW8MakeCanvasTexture(1024, 512, (zW8KuasQQQQQQQQ, zW8LebarValQQQQQQ, zW8TinggiValQQQQQQQQ) => {
    zW8KuasQQQQQQQQ.fillStyle = '#3a3d40'; zW8KuasQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQ, zW8TinggiValQQQQQQQQ);
      for (let zW8IdxBintikQQ = 0; zW8IdxBintikQQ < 2600; ++ zW8IdxBintikQQ) {
      const zW8ShadeVal = Math.floor(rnd() * 26) + 46;
      zW8KuasQQQQQQQQ.fillStyle = `rgba(${zW8ShadeVal},${zW8ShadeVal},${zW8ShadeVal + 3},.16)`;
      zW8KuasQQQQQQQQ.fillRect(rnd() * zW8LebarValQQQQQQ, rnd() * zW8TinggiValQQQQQQQQ, 2, 2); }
    zW8KuasQQQQQQQQ.strokeStyle = 'rgba(245,245,240,.9)'; zW8KuasQQQQQQQQ.lineWidth = 5;
      for (let zW8GarisX = 40; ! (zW8GarisX > zW8LebarValQQQQQQ - 40); zW8GarisX += 74) {
      zW8KuasQQQQQQQQ.beginPath(); zW8KuasQQQQQQQQ.moveTo(zW8GarisX, 10); zW8KuasQQQQQQQQ.lineTo(zW8GarisX, 128); zW8KuasQQQQQQQQ.stroke(); zW8KuasQQQQQQQQ.beginPath();
      zW8KuasQQQQQQQQ.moveTo(zW8GarisX, zW8TinggiValQQQQQQQQ - 128); zW8KuasQQQQQQQQ.lineTo(zW8GarisX, zW8TinggiValQQQQQQQQ - 10); zW8KuasQQQQQQQQ.stroke(); }
    zW8KuasQQQQQQQQ.beginPath(); zW8KuasQQQQQQQQ.moveTo(40, 128); zW8KuasQQQQQQQQ.lineTo(zW8LebarValQQQQQQ - 40, 128); zW8KuasQQQQQQQQ.stroke();
    zW8KuasQQQQQQQQ.beginPath(); zW8KuasQQQQQQQQ.moveTo(40, zW8TinggiValQQQQQQQQ - 128); zW8KuasQQQQQQQQ.lineTo(zW8LebarValQQQQQQ - 40, zW8TinggiValQQQQQQQQ - 128);
    zW8KuasQQQQQQQQ.stroke();
  }); const zW8MeshPadMart = new THREE.Mesh(new THREE.PlaneGeometry(64, 32), new THREE.MeshStandardMaterial({
    map : zW8TexPadMart, roughness : 1
  })); zW8MeshPadMart.rotation.x = - Math.PI / 2; zW8MeshPadMart.position.set (0, 0.04, 27); zW8GrupMartBaru.add(zW8MeshPadMart);
  const zW8MeshDriveMart = new THREE.Mesh(new THREE.PlaneGeometry(9, 42), zW8SharedStdMat(0x3a3d40, 1)); zW8MeshDriveMart.rotation.x = - Math.PI / 2;
  zW8MeshDriveMart.position.set (0, 0.04, 64); zW8GrupMartBaru.add(zW8MeshDriveMart);
  const zW8PaletParkirMart = [0xc0c4c9, 0x3f8cff, 0xd95555, 0x44484e, 0xf2b21b, 0x5a7d4f];
  const zW8DaftarTitikParkir = [[- 22, 19.5, Math.PI], [- 14.5, 19.5, Math.PI], [6, 19.5, Math.PI], [18, 35, 0], [25.5, 19.5, Math.PI],];
    zW8DaftarTitikParkir.forEach(([zW8TitikX, zW8TitikZ, zW8TitikRy], zW8IdxTitik) => {
    const zW8MobilParkirMart = zW8ConstructParkedCar(zW8PaletParkirMart[zW8IdxTitik % zW8PaletParkirMart.length]);
    zW8MobilParkirMart.position.set (zW8TitikX, 0, zW8TitikZ); zW8MobilParkirMart.rotation.y = zW8TitikRy; zW8GrupMartBaru.add(zW8MobilParkirMart);
  }); const zW8MatRelMart = zW8SharedStdMat(0xb0b6bc, 0.4, 0.7); [[- 18, 31], [14, 16.5]].forEach(([zW8RelX, zW8RelZ]) => {
      [- 1, 1].forEach((zW8TandaSisiQ) => {
      const zW8MeshRelBaru = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 3.6), zW8MatRelMart);
      zW8MeshRelBaru.position.set (zW8RelX + (zW8TandaSisiQ * 0.9), 0.75, zW8RelZ); zW8GrupMartBaru.add(zW8MeshRelBaru); [- 1, 1].forEach((zW8TandaUjung) => {
        const zW8MeshTiangRel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), zW8MatRelMart);
        zW8MeshTiangRel.position.set (zW8RelX + (zW8TandaSisiQ * 0.9), 0.38, zW8RelZ + (zW8TandaUjung * 1.8)); zW8GrupMartBaru.add(zW8MeshTiangRel); });
    }); const zW8MeshTroliMart = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.7), zW8MatRelMart); zW8MeshTroliMart.position.set (zW8RelX, 0.45, zW8RelZ);
    zW8GrupMartBaru.add(zW8MeshTroliMart);
  }); const zW8PaletPetiMart = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b]; [- 8.5, 8.5].forEach((zW8RakX) => {
    const zW8MeshRakMart = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 1.1), zW8SharedStdMat(0x6b4a2f, 0.95)); zW8MeshRakMart.position.set (zW8RakX, 0.45, 13.2);
    zW8GrupMartBaru.add(zW8MeshRakMart); for (let zW8IdxPeti = 0; zW8IdxPeti < 3; ++ zW8IdxPeti) {
      const zW8MeshPetiMart = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), zW8SharedStdMat(zW8PaletPetiMart[(zW8IdxPeti + (zW8RakX > 0 ? 1 : 0)) % 4], 0.9));
      zW8MeshPetiMart.position.set ((zW8RakX - 1) + zW8IdxPeti, 1.18, 13.2); zW8GrupMartBaru.add(zW8MeshPetiMart); }
  }); const zW8MeshPilonMart = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 7, 8), zW8MatRelMart); zW8MeshPilonMart.position.set (24, 3.5, 52);
  zW8GrupMartBaru.add(zW8MeshPilonMart); const zW8MeshTandaPilonMart = new THREE.Mesh(new THREE.BoxGeometry(7.5, 2.3, 0.35), new THREE.MeshBasicMaterial({
    map : zW8TexTandaMart
  })); zW8MeshTandaPilonMart.position.set (24, 6.8, 52); zW8GrupMartBaru.add(zW8MeshTandaPilonMart); G.addCollider(zW8MartX, zW8MartZ, 23, 11, 9); }

  function zW8ConstructBeachStrip(G, zW8SceneQQQ) {
  const zW8TitikMenabrakBangunan = (x, z, zW8NilaiPad) => G.colliders.some((zW8ObjKol) => Math.abs(x - (zW8ObjKol.x)) < zW8ObjKol.hw + zW8NilaiPad && Math.abs(z - (zW8ObjKol.z)) < zW8ObjKol.hd + zW8NilaiPad);
    const zW8TexJalurPapan = zW8MakeCanvasTexture(256, 64, (zW8KuasQQQQQQQQQ, zW8LebarValQQQQQQQ, zW8TinggiValQQQQQQQQQ) => {
    zW8KuasQQQQQQQQQ.fillStyle = '#a97e56'; zW8KuasQQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQQ, zW8TinggiValQQQQQQQQQ);
    zW8KuasQQQQQQQQQ.strokeStyle = 'rgba(70,45,25,.55)'; zW8KuasQQQQQQQQQ.lineWidth = 3; for (let zW8PapanX = 0; ! (zW8PapanX > zW8LebarValQQQQQQQ); zW8PapanX += 32) {
      zW8KuasQQQQQQQQQ.beginPath(); zW8KuasQQQQQQQQQ.moveTo(zW8PapanX, 0); zW8KuasQQQQQQQQQ.lineTo(zW8PapanX, zW8TinggiValQQQQQQQQQ); zW8KuasQQQQQQQQQ.stroke(); }
    zW8KuasQQQQQQQQQ.strokeStyle = 'rgba(70,45,25,.35)'; zW8KuasQQQQQQQQQ.beginPath(); zW8KuasQQQQQQQQQ.moveTo(0, 2); zW8KuasQQQQQQQQQ.lineTo(zW8LebarValQQQQQQQ, 2);
    zW8KuasQQQQQQQQQ.moveTo(0, zW8TinggiValQQQQQQQQQ - 2); zW8KuasQQQQQQQQQ.lineTo(zW8LebarValQQQQQQQ, zW8TinggiValQQQQQQQQQ - 2); zW8KuasQQQQQQQQQ.stroke();
  }); zW8TexJalurPapan.wrapS = zW8TexJalurPapan.wrapT = THREE.RepeatWrapping; zW8TexJalurPapan.repeat.set (30, 1);
    const zW8MeshJalurPapan = new THREE.Mesh(new THREE.BoxGeometry(1120, 0.1, 6), new THREE.MeshStandardMaterial({
    map : zW8TexJalurPapan, roughness : 1
  })); zW8MeshJalurPapan.position.set (100, 0.07, 556); zW8MeshJalurPapan.receiveShadow = true; zW8SceneQQQ.add(zW8MeshJalurPapan);
    for (let zW8PalemX = - 440; ! (zW8PalemX > 640); zW8PalemX += 55) {
    const zW8GeserAcakX = rr(- 3, 3) + zW8PalemX, zW8GeserAcakZ = rr(- 1, 1) + 549; if (zW8TitikMenabrakBangunan(zW8GeserAcakX, zW8GeserAcakZ, 1.5)) continue;
    const zW8PalemPantai = makePalm(rr(4.5, 6.5)); zW8PalemPantai.position.set (zW8GeserAcakX, 0, zW8GeserAcakZ); zW8PalemPantai.rotation.y = rr(0, 6.28);
    zW8SceneQQQ.add(zW8PalemPantai); }
  const zW8PaletPayung = [0xff5da2, 0xffb35c, 0x39d5ff, 0xffe14d, 0x7dffb0, 0xff5c39]; for (let zW8IdxPayung = 0; zW8IdxPayung < 14; ++ zW8IdxPayung) {
    let zW8CalonX = 0, zW8CalonZ = 0, zW8SudahTerpasang = false; for (let zW8IdxCoba = 0; zW8IdxCoba < 6 && ! zW8SudahTerpasang; ++ zW8IdxCoba) {
      zW8CalonX = rr(- 420, 620); zW8CalonZ = rr(578, 636); zW8SudahTerpasang = ! zW8TitikMenabrakBangunan(zW8CalonX, zW8CalonZ, 2); }
    if (! zW8SudahTerpasang) continue; const zW8GrupPayungBaru = new THREE.Group(); zW8GrupPayungBaru.position.set (zW8CalonX, 0, zW8CalonZ);
    zW8GrupPayungBaru.rotation.y = rr(0, 6.28); const zW8MeshTiangPayung = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 6), zW8SharedStdMat(0xd8d8d2, 0.7));
    zW8MeshTiangPayung.position.y = 1.15; zW8MeshTiangPayung.rotation.z = 0.12; zW8GrupPayungBaru.add(zW8MeshTiangPayung);
    const zW8MeshKanopiPayung = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.55, 10), zW8SharedStdMat(pick(zW8PaletPayung), 0.85));
    zW8MeshKanopiPayung.position.set (0.14, 2.35, 0); zW8MeshKanopiPayung.rotation.z = 0.12; zW8GrupPayungBaru.add(zW8MeshKanopiPayung);
      for (let zW8IdxKursi = 0; zW8IdxKursi < 2; ++ zW8IdxKursi) {
      if (rnd() < 0.3) continue; const zW8GrupKursiBaru = new THREE.Group(); zW8GrupKursiBaru.position.set (rr(- 1.6, 1.6), 0, rr(0.8, 1.8));
      zW8GrupKursiBaru.rotation.y = rr(- 0.5, 0.5); const zW8MeshDudukanKursi = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 1.5), zW8SharedStdMat(0xf2efe4, 0.9));
      zW8MeshDudukanKursi.position.y = 0.28; zW8GrupKursiBaru.add(zW8MeshDudukanKursi);
      const zW8MeshSandaranKursi = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.12, 0.8), zW8SharedStdMat(pick(zW8PaletPayung), 0.9));
      zW8MeshSandaranKursi.position.set (0, 0.5, - 0.75); zW8MeshSandaranKursi.rotation.x = - 0.7; zW8GrupKursiBaru.add(zW8MeshSandaranKursi);
      zW8GrupPayungBaru.add(zW8GrupKursiBaru); }
    zW8SceneQQQ.add(zW8GrupPayungBaru); }
    [- 300, 100, 500].forEach((zW8AwalX) => {
    let zW8PosisiMenaraX = zW8AwalX;
    while (zW8TitikMenabrakBangunan(zW8PosisiMenaraX, 598, 2) && zW8PosisiMenaraX < zW8AwalX + 60) zW8PosisiMenaraX += 18;
    if (zW8TitikMenabrakBangunan(zW8PosisiMenaraX, 598, 2)) return; const zW8GrupMenaraBaru = new THREE.Group();
    zW8GrupMenaraBaru.position.set (zW8PosisiMenaraX, 0, 598); const zW8MatPutihMenara = zW8SharedStdMat(0xf2efe4, 0.85);
    const zW8MatMerahMenara = zW8SharedStdMat(0xd8232a, 0.85); [- 1, 1].forEach((zW8SisiXQ) => {
        [- 1, 1].forEach((zW8SisiZQ) => {
        const zW8MeshKakiMenara = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), zW8MatPutihMenara);
        zW8MeshKakiMenara.position.set (zW8SisiXQ * 0.7, 1.1, zW8SisiZQ * 0.5); zW8GrupMenaraBaru.add(zW8MeshKakiMenara); });
    }); const zW8MeshPlatformMenara = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.3), zW8MatPutihMenara); zW8MeshPlatformMenara.position.y = 2.25;
    zW8GrupMenaraBaru.add(zW8MeshPlatformMenara); const zW8MeshPanelBelakangMenara = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 0.1), zW8MatPutihMenara);
    zW8MeshPanelBelakangMenara.position.set (0, 2.85, - 0.6); zW8GrupMenaraBaru.add(zW8MeshPanelBelakangMenara);
    const zW8MeshAtapMenara = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.5), zW8MatMerahMenara); zW8MeshAtapMenara.position.y = 3.5;
    zW8GrupMenaraBaru.add(zW8MeshAtapMenara); const zW8MeshRampaMenara = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 2.6), zW8MatPutihMenara);
    zW8MeshRampaMenara.position.set (0, 1.1, - 1.7); zW8MeshRampaMenara.rotation.x = 0.72; zW8GrupMenaraBaru.add(zW8MeshRampaMenara); zW8SceneQQQ.add(zW8GrupMenaraBaru);
    G.addCollider(zW8PosisiMenaraX, 598, 1, 0.8, 3.5); }); }

const zW8DensityPointHit = (G, x, z, zW8PadVal) => G.colliders.some((zW8ObjKolQ) => Math.abs(x - (zW8ObjKolQ.x)) < zW8ObjKolQ.hw + zW8PadVal && Math.abs(z - (zW8ObjKolQ.z)) < zW8ObjKolQ.hd + zW8PadVal);
const zW8DensityFootHit = (G, x, z, zW8ParuhW, zW8ParuhD, zW8PadValQ) => G.colliders.some((zW8ObjKolQQ) => Math.abs(x - (zW8ObjKolQQ.x)) < ((zW8ObjKolQQ.hw + zW8ParuhW) + zW8PadValQ) && Math.abs(z - (zW8ObjKolQQ.z)) < ((zW8ObjKolQQ.hd + zW8ParuhD) + zW8PadValQ));
  const zW8ApplyCastShadow = (zW8AkarObj) => {
    zW8AkarObj.traverse((zW8ObjNodeQQ) => {
    if (zW8ObjNodeQQ.isMesh) zW8ObjNodeQQ.castShadow = true;
  }); return zW8AkarObj; };

  function zW8ConstructBoulevardFrontage(G, zW8SceneQQQQ) {
    const zW8HitunganPerSisi = {
    north : 0, south : 0 };
  const zW8OpsiTandaDepan = [['HOTEL CORAL', '#ffb35c'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'], ['CLUB NEON', '#e879ff'], ['RAMEN', '#ff5c39'], ['PAWN', '#ffe14d'],];
    [{
    key : 'north', facadeZ : 470, faceDir : 1 }, {
    key : 'south', facadeZ : 518, faceDir : - 1
    }].forEach((zW8SpecSisi) => {
    let zW8WarnaPalingAkhir = null, zW8WarnaDuaLalu = null, zW8PenandaX = - 560;
      while (zW8PenandaX < 640) {
      let zW8LebarSegmen = rr(18, 30); if (zW8PenandaX + zW8LebarSegmen > 640) zW8LebarSegmen = 640 - (zW8PenandaX); if (zW8LebarSegmen < 10) break;
      const zW8DalamSegmen = rr(12, 18); const zW8TinggiSegmen = rr(10, 26);
      const zW8TengahX = (zW8LebarSegmen / 2) + zW8PenandaX, zW8TengahZ = zW8SpecSisi.facadeZ + (- (zW8SpecSisi.faceDir * (zW8DalamSegmen / 2)));

      const zW8JalanPenghalang = G.roadX.find((zW8KoordinatJalan) => zW8TengahX - zW8LebarSegmen / 2 < zW8KoordinatJalan + 14 && zW8TengahX + zW8LebarSegmen / 2 > zW8KoordinatJalan - 14);
        if (zW8JalanPenghalang !== undefined) {
        zW8PenandaX = zW8JalanPenghalang + 14 + rr(0.5, 2); continue; }
        if (zW8DensityFootHit(G, zW8TengahX, zW8TengahZ, zW8LebarSegmen / 2, zW8DalamSegmen / 2, 2)) {
        zW8PenandaX += zW8LebarSegmen + rr(1.5, 5); continue; }

      let zW8WarnaFasad = pick(VICE.coralPastels);
      if (zW8WarnaFasad === zW8WarnaPalingAkhir) zW8WarnaFasad = VICE.coralPastels[(VICE.coralPastels.indexOf(zW8WarnaFasad) + 1) % VICE.coralPastels.length];
      if (zW8WarnaFasad === zW8WarnaDuaLalu) zW8WarnaFasad = VICE.coralPastels[(VICE.coralPastels.indexOf(zW8WarnaFasad) + 1) % VICE.coralPastels.length];
      zW8WarnaDuaLalu = zW8WarnaPalingAkhir; zW8WarnaPalingAkhir = zW8WarnaFasad; const zW8TexFasadDepan = zW8BuildBuildingTexture(zW8WarnaFasad, rr(0.25, 0.42));
      zW8TexFasadDepan.wrapS = zW8TexFasadDepan.wrapT = THREE.RepeatWrapping; const zW8MatFasadDepan = new THREE.MeshStandardMaterial({
        map : zW8TexFasadDepan, emissive : 0xffc873, emissiveMap : zW8TexFasadDepan, emissiveIntensity : 0, roughness : 0.9,
      }); zW8MatFasadDepan.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98)); if (! G.buildingMats) G.buildingMats = []; G.buildingMats.push(zW8MatFasadDepan);
      const zW8ElevasiDasar = groundH(zW8TengahX, zW8TengahZ);
      const zW8MeshGedungDepan = new THREE.Mesh(new THREE.BoxGeometry(zW8LebarSegmen, zW8TinggiSegmen, zW8DalamSegmen), zW8MatFasadDepan);
      zW8MeshGedungDepan.position.set (zW8TengahX, (zW8TinggiSegmen / 2) + zW8ElevasiDasar, zW8TengahZ); zW8MeshGedungDepan.castShadow = true;
      zW8MeshGedungDepan.receiveShadow = true; zW8SceneQQQQ.add(zW8MeshGedungDepan);

      const zW8TinggiUndak = rr(1.6, 3);
      const zW8MeshUndak = new THREE.Mesh(new THREE.BoxGeometry(zW8LebarSegmen * 0.62, zW8TinggiUndak, zW8DalamSegmen * 0.62), zW8MatFasadDepan);
      zW8MeshUndak.position.set (zW8TengahX, zW8TinggiSegmen + (zW8TinggiUndak / 2) + zW8ElevasiDasar, zW8TengahZ); zW8MeshUndak.castShadow = true;
      zW8SceneQQQQ.add(zW8MeshUndak);

      const zW8WarnaNeonDepan = pick(VICE.neonTrim); const zW8MatTrimDepan = new THREE.MeshStandardMaterial({
        color : zW8WarnaNeonDepan, emissive : zW8WarnaNeonDepan, emissiveIntensity : 0, roughness : 0.6
      }); const zW8MeshTrimDepan = new THREE.Mesh(new THREE.BoxGeometry(zW8LebarSegmen + 0.35, 0.3, zW8DalamSegmen + 0.35), zW8MatTrimDepan);
      zW8MeshTrimDepan.position.set (zW8TengahX, (zW8TinggiSegmen * 0.84) + zW8ElevasiDasar, zW8TengahZ); zW8MeshTrimDepan.castShadow = true;
      zW8SceneQQQQ.add(zW8MeshTrimDepan); if (! G.neonTrimMats) G.neonTrimMats = []; G.neonTrimMats.push(zW8MatTrimDepan);
      const zW8PijarTrimDepan = glowSprite(new THREE.Color(zW8WarnaNeonDepan), 12);
      zW8PijarTrimDepan.position.set (zW8TengahX, (zW8TinggiSegmen * 0.84) + zW8ElevasiDasar, zW8TengahZ); zW8PijarTrimDepan.material.opacity = 0;
      zW8SceneQQQQ.add(zW8PijarTrimDepan); zW8DaftarSpritePijar.push(zW8PijarTrimDepan);

      const zW8GarisFasadZ = zW8SpecSisi.facadeZ; if (rnd() < 0.6) {
        const[zW8TeksTanda, zW8WarnaTanda] = pick(zW8OpsiTandaDepan);
          const zW8MeshTandaDepan = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, zW8LebarSegmen * 0.7), 3.4), new THREE.MeshBasicMaterial({
          map : zW8BuildSignTexture(zW8TeksTanda, '#101018', zW8WarnaTanda)
        })); zW8MeshTandaDepan.position.set (zW8TengahX, 4.6 + zW8ElevasiDasar, zW8GarisFasadZ + (zW8SpecSisi.faceDir * 0.12));
        if (zW8SpecSisi.faceDir < 0) zW8MeshTandaDepan.rotation.y = Math.PI; zW8SceneQQQQ.add(zW8MeshTandaDepan);
        const zW8PijarTandaDepan = glowSprite(new THREE.Color(zW8WarnaTanda), 13);
        zW8PijarTandaDepan.position.set (zW8TengahX, 4.6 + zW8ElevasiDasar, zW8GarisFasadZ + (zW8SpecSisi.faceDir * 0.05)); zW8PijarTandaDepan.material.opacity = 0;
        zW8SceneQQQQ.add(zW8PijarTandaDepan); zW8DaftarSpritePijar.push(zW8PijarTandaDepan); }

      const zW8WarnaTendaDepan = zW8HitunganPerSisi[zW8SpecSisi.key] % 2 === 0 ? pick(['#ff5da2', '#ffb35c']) : pick(['#39d5ff', '#7dffb0']);
        const zW8MatTendaDepan = new THREE.MeshStandardMaterial({
        color : new THREE.Color(zW8WarnaTendaDepan), roughness : 0.85
      }); const zW8MeshTendaDepan = new THREE.Mesh(new THREE.BoxGeometry(Math.min(15, zW8LebarSegmen * 0.72), 0.15, 2.2), zW8MatTendaDepan);
      zW8MeshTendaDepan.position.set (zW8TengahX, 3.6 + zW8ElevasiDasar, zW8GarisFasadZ + (zW8SpecSisi.faceDir * 1.05));
      zW8MeshTendaDepan.rotation.x = zW8SpecSisi.faceDir * 0.3; zW8MeshTendaDepan.castShadow = true; zW8SceneQQQQ.add(zW8MeshTendaDepan);
      G.addCollider(zW8TengahX, zW8TengahZ, zW8LebarSegmen / 2, zW8DalamSegmen / 2, zW8TinggiSegmen); ++ zW8HitunganPerSisi[zW8SpecSisi.key];
      zW8PenandaX += zW8LebarSegmen + rr(1.5, 5); }
  }); G.frontageCounts = zW8HitunganPerSisi; return zW8HitunganPerSisi; }

  function zW8ConstructBoulevardPalms(G, zW8SceneQQQQQ) {
  let zW8HitungPalem = 0; for (let zW8PalemXQ = - 560; ! (zW8PalemXQ > 640); zW8PalemXQ += 20) {
    if (G.roadX.some((zW8NilaiJalanQQ) => Math.abs(zW8PalemXQ - (zW8NilaiJalanQQ)) < 16)) continue; [481, 509].forEach((zW8TrotoarZ) => {
      if (zW8DensityPointHit(G, zW8PalemXQ, zW8TrotoarZ, 1.5)) return; const zW8PalemTrotoar = makePalm(rr(4.5, 6.5));
      zW8PalemTrotoar.position.set (zW8PalemXQ, groundH(zW8PalemXQ, zW8TrotoarZ), zW8TrotoarZ); zW8PalemTrotoar.rotation.y = rr(0, 6.28);
      zW8SceneQQQQQ.add(zW8PalemTrotoar); ++ zW8HitungPalem; }); }
  G.boulevardPalmsAdded = zW8HitungPalem; return zW8HitungPalem; }

  function zW8MakePlanterPalmUnit() {
  const zW8GrupUnitPenanam = new THREE.Group(); const zW8MeshKotakPenanam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 1.6), zW8SharedStdMat(0xd8d2c4, 1));
  zW8MeshKotakPenanam.position.y = 0.275; zW8GrupUnitPenanam.add(zW8MeshKotakPenanam);
  const zW8MeshTanahPenanam = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 1.4), zW8SharedStdMat(0x4a3826, 1)); zW8MeshTanahPenanam.position.y = 0.56;
  zW8GrupUnitPenanam.add(zW8MeshTanahPenanam); const zW8MatSemakPenanam = new THREE.MeshStandardMaterial({
    color : 0x3d8b4f, roughness : 1, flatShading : true
  }); [[- 0.55, - 0.55], [0.55, - 0.55], [- 0.55, 0.55], [0.55, 0.55]].forEach(([zW8SudutX, zW8SudutZ]) => {
    const zW8MeshGumpalSemak = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(0.22, 0.3), 1), zW8MatSemakPenanam);
    zW8MeshGumpalSemak.position.set (zW8SudutX, 0.68, zW8SudutZ); zW8GrupUnitPenanam.add(zW8MeshGumpalSemak);
  }); const zW8PalemPenanam = makePalm(rr(4.5, 6)); zW8PalemPenanam.position.y = 0.55; zW8PalemPenanam.rotation.y = rr(0, 6.28); zW8GrupUnitPenanam.add(zW8PalemPenanam);
  return zW8ApplyCastShadow(zW8GrupUnitPenanam); }
  function zW8ConstructBoulevardPlanters(G, zW8SceneQQQQQQ) {
  let zW8HitungPenanam = 0; for (let zW8PenanamX = - 320; ! (zW8PenanamX > 520); zW8PenanamX += 40) {
    if (G.roadX.some((zW8NilaiJalanQQQ) => Math.abs(zW8PenanamX - (zW8NilaiJalanQQQ)) < 13)) continue; if (Math.abs(zW8PenanamX - 100) < 10) continue;
    if (zW8DensityPointHit(G, zW8PenanamX, 513, 2)) continue; const zW8UnitPenanam = zW8MakePlanterPalmUnit();
    zW8UnitPenanam.position.set (zW8PenanamX, groundH(zW8PenanamX, 513), 513); zW8SceneQQQQQQ.add(zW8UnitPenanam); ++ zW8HitungPenanam; }
  G.boulevardPlantersAdded = zW8HitungPenanam; return zW8HitungPenanam; }

  function zW8MakeBenchUnit() {
  const zW8GrupBangkuBaru = new THREE.Group(); const zW8MatRangkaBangku = zW8SharedStdMat(0x3a3f45, 0.6, 0.5), zW8MatKayuBangku = zW8SharedStdMat(0x8a6844, 0.95);
    [- 1, 1].forEach((zW8TandaSisiQQ) => {
    const zW8MeshKakiDepanBangku = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), zW8MatRangkaBangku);
    zW8MeshKakiDepanBangku.position.set (zW8TandaSisiQQ * 0.95, 0.22, 0.28); zW8GrupBangkuBaru.add(zW8MeshKakiDepanBangku);
    const zW8MeshKakiBelakangBangku = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.85, 0.12), zW8MatRangkaBangku);
    zW8MeshKakiBelakangBangku.position.set (zW8TandaSisiQQ * 0.95, 0.42, - 0.28); zW8GrupBangkuBaru.add(zW8MeshKakiBelakangBangku);
  }); for (let zW8IdxBilahQ = 0; zW8IdxBilahQ < 3; ++ zW8IdxBilahQ) {
    const zW8MeshBilahBangku = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.16), zW8MatKayuBangku);
    zW8MeshBilahBangku.position.set (0, 0.45, (zW8IdxBilahQ * 0.22) - 0.2); zW8GrupBangkuBaru.add(zW8MeshBilahBangku); }
    for (let zW8IdxSandaran = 0; zW8IdxSandaran < 2; ++ zW8IdxSandaran) {
    const zW8MeshSandaranBangku = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.05), zW8MatKayuBangku);
    zW8MeshSandaranBangku.position.set (0, (zW8IdxSandaran * 0.24) + 0.68, - 0.32); zW8MeshSandaranBangku.rotation.x = - 0.18;
    zW8GrupBangkuBaru.add(zW8MeshSandaranBangku); }
  return zW8ApplyCastShadow(zW8GrupBangkuBaru); }
  function zW8MakePlanterUnit() {
  const zW8GrupKotakBaru = new THREE.Group(); const zW8MeshKotakBaru = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.9), zW8SharedStdMat(0x9a8a72, 1));
  zW8MeshKotakBaru.position.y = 0.28; zW8GrupKotakBaru.add(zW8MeshKotakBaru);
    const zW8MeshSemakBaru = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshStandardMaterial({
    color : 0x3d8b4f, roughness : 1, flatShading : true
  })); zW8MeshSemakBaru.position.y = 0.85; zW8GrupKotakBaru.add(zW8MeshSemakBaru); return zW8ApplyCastShadow(zW8GrupKotakBaru); }
  function zW8MakeStallUnit() {
  const zW8GrupKiosBaru = new THREE.Group(); const zW8MatTiangKios = zW8SharedStdMat(0x6b4a2f, 0.9); [- 1, 1].forEach((zW8SisiXQQ) => {
      [- 1, 1].forEach((zW8SisiZQQ) => {
      const zW8MeshTiangKios = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5, 6), zW8MatTiangKios);
      zW8MeshTiangKios.position.set (zW8SisiXQQ * 1.5, 1.25, zW8SisiZQQ * 0.9); zW8GrupKiosBaru.add(zW8MeshTiangKios); }); });

    const zW8TexKanopiKios = zW8MakeCanvasTexture(128, 128, (zW8KuasQQQQQQQQQQ, zW8LebarValQQQQQQQQ, zW8TinggiValQQQQQQQQQQ) => {
      for (let zW8IdxGaris = 0; zW8IdxGaris < 8; ++ zW8IdxGaris) {
      zW8KuasQQQQQQQQQQ.fillStyle = zW8IdxGaris % 2 ? '#f7f2e6' : '#ff7a6b';
      zW8KuasQQQQQQQQQQ.fillRect(zW8IdxGaris * (zW8LebarValQQQQQQQQ / 8), 0, zW8LebarValQQQQQQQQ / 8, zW8TinggiValQQQQQQQQQQ); }
  }); zW8TexKanopiKios.wrapS = THREE.RepeatWrapping; zW8TexKanopiKios.wrapT = THREE.RepeatWrapping;
    const zW8MeshKanopiKios = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 2.4), new THREE.MeshStandardMaterial({
    map : zW8TexKanopiKios, roughness : 0.9
  })); zW8MeshKanopiKios.position.y = 2.55; zW8MeshKanopiKios.rotation.z = 0.06; zW8GrupKiosBaru.add(zW8MeshKanopiKios);
  const zW8MeshKonterKios = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.1), zW8SharedStdMat(0xa97e56, 0.95)); zW8MeshKonterKios.position.set (0, 0.45, 0.35);
  zW8GrupKiosBaru.add(zW8MeshKonterKios); const zW8PaletPetiKios = [0xe8762a, 0x3f9d4e, 0xd8b93a, 0xc0392b]; for (let zW8IdxPetiQ = 0; zW8IdxPetiQ < 4; ++ zW8IdxPetiQ) {
    const zW8MeshPetiKios = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), zW8SharedStdMat(zW8PaletPetiKios[zW8IdxPetiQ % 4], 0.9));
    zW8MeshPetiKios.position.set ((zW8IdxPetiQ * 0.72) - 1.1, 1.1, 0.35); zW8GrupKiosBaru.add(zW8MeshPetiKios); }
  return zW8ApplyCastShadow(zW8GrupKiosBaru); }
  function zW8ConstructGatherSpots(G, zW8SceneQQQQQQQ) {
    const zW8DaftarKandidatTitik = [{
    x : 100, z : 511, ry : Math.PI, stall : true }, {
    x : 300, z : 552, ry : 0, stall : true }, {
    x : - 60, z : - 238, ry : Math.PI, stall : false }, {
    x : - 210, z : 481, ry : 0, stall : false
  },]; G.gatherSpots = []; zW8DaftarKandidatTitik.forEach((zW8KandidatObj) => {
    let zW8PosisiPasangX = null; for (let zW8IdxLangkah = 0; ! (zW8IdxLangkah > 10) && zW8PosisiPasangX === null; ++ zW8IdxLangkah) {
      const zW8DaftarGeserCoba = zW8IdxLangkah === 0 ? [0] : [zW8IdxLangkah * 4, - zW8IdxLangkah * 4]; for (const zW8NilaiGeser of zW8DaftarGeserCoba) {
        const zW8CobaX = zW8KandidatObj.x + zW8NilaiGeser; if (! zW8DensityPointHit(G, zW8CobaX, zW8KandidatObj.z, 2.5)) {
          zW8PosisiPasangX = zW8CobaX; break; } } }
    if (zW8PosisiPasangX === null) return; const zW8GrupTitikBaru = new THREE.Group();
    zW8GrupTitikBaru.position.set (zW8PosisiPasangX, groundH(zW8PosisiPasangX, zW8KandidatObj.z), zW8KandidatObj.z); zW8GrupTitikBaru.rotation.y = zW8KandidatObj.ry;
      [- 1.9, 1.9].forEach((zW8BangkuX) => {
      const zW8BangkuBaru = zW8MakeBenchUnit(); zW8BangkuBaru.position.set (zW8BangkuX, 0, 0); zW8GrupTitikBaru.add(zW8BangkuBaru);
    }); [- 3.6, 3.6].forEach((zW8PenanamXQ) => {
      const zW8PenanamBaru = zW8MakePlanterUnit(); zW8PenanamBaru.position.set (zW8PenanamXQ, 0, 0.25); zW8GrupTitikBaru.add(zW8PenanamBaru);
    }); if (zW8KandidatObj.stall) {
      const zW8KiosBaru = zW8MakeStallUnit(); zW8KiosBaru.position.set (0, 0, - 2.4); zW8GrupTitikBaru.add(zW8KiosBaru);
      const zW8KosinusRy = Math.cos(zW8KandidatObj.ry), zW8SinusRy = Math.sin(zW8KandidatObj.ry);
      const zW8KiosDuniaX = ((0 * zW8KosinusRy) - (2.4 * zW8SinusRy)) + zW8PosisiPasangX, zW8KiosDuniaZ = ((- 0 * zW8SinusRy) - (2.4 * zW8KosinusRy)) + zW8KandidatObj.z;
      G.addCollider(zW8KiosDuniaX, zW8KiosDuniaZ, 1.8, 1.2, 2.6); }
    zW8SceneQQQQQQQ.add(zW8GrupTitikBaru); const zW8RekamanTitik = {
    }; zW8RekamanTitik.x = zW8PosisiPasangX; zW8RekamanTitik.z = zW8KandidatObj.z; zW8RekamanTitik.ry = zW8KandidatObj.ry; zW8RekamanTitik.stall = zW8KandidatObj.stall;
    G.gatherSpots.push(zW8RekamanTitik);
  }); return G.gatherSpots; }

  function zW8ConstructHoshinoRows(G, zW8SceneQQQQQQQQ) {
  let zW8HitungRumah = 0; const zW8DaftarSpecBaris = [{
    z : - 378, face : 1 }, {
    z : - 284, face : - 1
  }]; zW8DaftarSpecBaris.forEach((zW8SpecBarisQ) => {
      for (let zW8RumahX = - 520; ! (zW8RumahX > - 180); zW8RumahX += 24) {
      if (Math.abs(zW8RumahX + 495) < 15 || Math.abs(zW8RumahX + 330) < 15) continue; if (zW8DensityFootHit(G, zW8RumahX, zW8SpecBarisQ.z, 6, 5, 2)) continue;
      zW8ConstructHouse(G, zW8SceneQQQQQQQQ, zW8RumahX, zW8SpecBarisQ.z, zW8SpecBarisQ.face); ++ zW8HitungRumah; }
  }); G.hoshinoHousesAdded = zW8HitungRumah; return zW8HitungRumah; }

const zW8PARK_CENTRE_CANDIDATES = [[82, 415], [- 82, 415], [82, 82], [- 82, 82], [247, 82],]; function zW8MakeRoundTree(zW8TinggiValQQQQQQQQQQQ, zW8WarnaValQ) {
  const zW8GrupPohonBundar = new THREE.Group();
  const zW8MeshBatangBundar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, zW8TinggiValQQQQQQQQQQQ * 0.45, 7), zW8SharedStdMat(0x6b4a2f, 1));
  zW8MeshBatangBundar.position.y = zW8TinggiValQQQQQQQQQQQ * 0.225; zW8GrupPohonBundar.add(zW8MeshBatangBundar);
    const zW8MatKanopiBundar = new THREE.MeshStandardMaterial({
    color : zW8WarnaValQ, roughness : 1, flatShading : true
  }); const zW8DaftarSpecGumpal = [[0, 1, 0, 1.6], [0.95, 1.22, 0.3, 1.2], [- 0.9, 1.18, - 0.4, 1.05],];
    zW8DaftarSpecGumpal.forEach(([zW8GumpalX, zW8GumpalY, zW8GumpalZ, zW8GumpalR]) => {
    const zW8MeshGumpalBundar = new THREE.Mesh(new THREE.SphereGeometry(zW8GumpalR, 10, 8), zW8MatKanopiBundar); zW8MeshGumpalBundar.scale.y = 0.75;
    zW8MeshGumpalBundar.position.set (zW8GumpalX, (zW8TinggiValQQQQQQQQQQQ * 0.45) + (zW8GumpalY * (zW8TinggiValQQQQQQQQQQQ * 0.28)), zW8GumpalZ);
    zW8GrupPohonBundar.add(zW8MeshGumpalBundar);
  }); return zW8ApplyCastShadow(zW8GrupPohonBundar); }
  function zW8ConstructPark(G, zW8SceneQQQQQQQQQ) {
  let zW8PusatTamanX = zW8PARK_CENTRE_CANDIDATES[0][0], zW8PusatTamanZ = zW8PARK_CENTRE_CANDIDATES[0][1], zW8SudahKetemu = false; const zW8DaftarKandidatLewati = [];
    for (const[zW8KandidatX, zW8KandidatZ] of zW8PARK_CENTRE_CANDIDATES) {
      if (! zW8DensityFootHit(G, zW8KandidatX, zW8KandidatZ, 38, 38, 2)) {
      zW8PusatTamanX = zW8KandidatX; zW8PusatTamanZ = zW8KandidatZ; zW8SudahKetemu = true; break; }
    zW8DaftarKandidatLewati.push([zW8KandidatX, zW8KandidatZ]); }
  G.parkScanSkipped = zW8DaftarKandidatLewati; G.parkFallbackUsed = ! zW8SudahKetemu; const zW8ElevasiTaman = groundH(zW8PusatTamanX, zW8PusatTamanZ);
  const zW8GrupTamanBaru = new THREE.Group(); zW8GrupTamanBaru.position.set (zW8PusatTamanX, zW8ElevasiTaman, zW8PusatTamanZ); zW8SceneQQQQQQQQQ.add(zW8GrupTamanBaru);

  const zW8MeshPlazaBaru = new THREE.Mesh(new THREE.PlaneGeometry(76, 76), zW8MakePavingMat(19, 19, 0xd8d2c2)); zW8MeshPlazaBaru.rotation.x = - Math.PI / 2;
  zW8MeshPlazaBaru.position.y = 0.04; zW8MeshPlazaBaru.receiveShadow = true; zW8GrupTamanBaru.add(zW8MeshPlazaBaru);

  const zW8MeshJalurNS = new THREE.Mesh(new THREE.PlaneGeometry(6, 76), zW8MakePavingMat(2, 19, 0xffffff)); zW8MeshJalurNS.rotation.x = - Math.PI / 2;
  zW8MeshJalurNS.position.y = 0.07; zW8MeshJalurNS.receiveShadow = true; zW8GrupTamanBaru.add(zW8MeshJalurNS);
  const zW8MeshJalurEW = new THREE.Mesh(new THREE.PlaneGeometry(76, 6), zW8MakePavingMat(19, 2, 0xffffff)); zW8MeshJalurEW.rotation.x = - Math.PI / 2;
  zW8MeshJalurEW.position.y = 0.07; zW8MeshJalurEW.receiveShadow = true; zW8GrupTamanBaru.add(zW8MeshJalurEW);

    [- 1, 1].forEach((zW8KuadranX) => {
      [- 1, 1].forEach((zW8KuadranZ) => {
      const zW8MeshLawnKuadran = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), zW8MakeGrassMat(8, 8)); zW8MeshLawnKuadran.rotation.x = - Math.PI / 2;
      zW8MeshLawnKuadran.position.set (zW8KuadranX * 19.5, 0.055, zW8KuadranZ * 19.5); zW8MeshLawnKuadran.receiveShadow = true; zW8GrupTamanBaru.add(zW8MeshLawnKuadran); });
  });

  const zW8GrupMancurBaru = new THREE.Group(); zW8GrupTamanBaru.add(zW8GrupMancurBaru); const zW8MatBetonMancur = zW8SharedStdMat(0xe6e0d0, 0.9);
  const zW8MeshCekunganMancur = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.8, 24), zW8MatBetonMancur); zW8MeshCekunganMancur.position.y = 0.4;
  zW8GrupMancurBaru.add(zW8MeshCekunganMancur); const zW8MeshBibirMancur = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 8, 24), zW8MatBetonMancur);
  zW8MeshBibirMancur.rotation.x = Math.PI / 2; zW8MeshBibirMancur.position.y = 0.82; zW8GrupMancurBaru.add(zW8MeshBibirMancur);
    const zW8MatAirMancur = new THREE.MeshStandardMaterial({
    color : 0x3fa7d6, transparent : true, opacity : 0.9, roughness : 0.15
  }); const zW8MeshAirMancur = new THREE.Mesh(new THREE.CircleGeometry(3.7, 24), zW8MatAirMancur); zW8MeshAirMancur.rotation.x = - Math.PI / 2;
  zW8MeshAirMancur.position.y = 0.72; zW8GrupMancurBaru.add(zW8MeshAirMancur);
  const zW8MeshPilarMancur = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 1.5, 12), zW8MatBetonMancur); zW8MeshPilarMancur.position.y = 1.4;
  zW8GrupMancurBaru.add(zW8MeshPilarMancur); const zW8MeshMangkukMancur = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 0.9, 0.35, 16), zW8MatBetonMancur);
  zW8MeshMangkukMancur.position.y = 2.25; zW8GrupMancurBaru.add(zW8MeshMangkukMancur);
  const zW8MeshAirMangkukMancur = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), zW8MatAirMancur); zW8MeshAirMangkukMancur.rotation.x = - Math.PI / 2;
  zW8MeshAirMangkukMancur.position.y = 2.44; zW8GrupMancurBaru.add(zW8MeshAirMangkukMancur); zW8ApplyCastShadow(zW8GrupMancurBaru);
  G.addCollider(zW8PusatTamanX, zW8PusatTamanZ, 4.4, 4.4, 2.4);

  const zW8DaftarTitikPohon = []; [- 1, 1].forEach((zW8KuadranXQ) => {
      [- 1, 1].forEach((zW8KuadranZQ) => {
      zW8DaftarTitikPohon.push([zW8KuadranXQ * 12, zW8KuadranZQ * 12], [zW8KuadranXQ * 27, zW8KuadranZQ * 10], [zW8KuadranXQ * 10, zW8KuadranZQ * 27]); });
  }); zW8DaftarTitikPohon.push([- 34, - 34], [34, 34]); const zW8PaletPohonBundar = [0x3f9e4d, 0x359146, 0x4caf50];
    zW8DaftarTitikPohon.forEach(([zW8TitikXQ, zW8TitikZQ], zW8IdxPohon) => {
    const zW8PohonBaru = zW8IdxPohon % 3 === 2 ? makePalm(5 + (zW8IdxPohon % 2)) : zW8MakeRoundTree(4.6 + ((zW8IdxPohon % 3) * 0.5), zW8PaletPohonBundar[zW8IdxPohon % 3]);
    zW8PohonBaru.position.set (zW8TitikXQ, 0, zW8TitikZQ); zW8PohonBaru.rotation.y = (zW8IdxPohon * 1.7) % 6.28; zW8GrupTamanBaru.add(zW8PohonBaru); });

    [[10, 5.5], [- 10, 5.5], [10, - 5.5], [- 10, - 5.5], [5.5, 10], [- 5.5, - 10]].forEach(([zW8BangkuXQ, zW8BangkuZ]) => {
    const zW8BangkuTaman = zW8MakeBenchUnit(); zW8BangkuTaman.position.set (zW8BangkuXQ, 0, zW8BangkuZ);
    zW8BangkuTaman.rotation.y = Math.atan2(- zW8BangkuXQ, - zW8BangkuZ); zW8GrupTamanBaru.add(zW8BangkuTaman); });

  const zW8KiosTamanX = zW8PusatTamanX + 32; const zW8KiosTamanZ = zW8PusatTamanZ + 8; const zW8KiosTaman = zW8MakeStallUnit(); zW8KiosTaman.position.set (32, 0, 8);
  zW8KiosTaman.rotation.y = Math.PI / 2; zW8GrupTamanBaru.add(zW8KiosTaman); G.addCollider(zW8KiosTamanX, zW8KiosTamanZ, 1.8, 1.8, 2.6);

    [[- 35, - 35], [35, - 35], [- 35, 35], [35, 35]].forEach(([zW8LampuX, zW8LampuZ]) => {
    const zW8GrupLampuTaman = new THREE.Group();
    const zW8MeshTiangLampuTaman = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5, 6), zW8SharedStdMat(0x3a3f45, 0.8, 0.5));
    zW8MeshTiangLampuTaman.position.y = 2.5; zW8GrupLampuTaman.add(zW8MeshTiangLampuTaman);
      const zW8MeshKepalaLampuTaman = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshStandardMaterial({
      color : 0xffd9a0, emissive : 0xffc98a, emissiveIntensity : 0.4, roughness : 0.5
    })); zW8MeshKepalaLampuTaman.position.y = 5.05; zW8GrupLampuTaman.add(zW8MeshKepalaLampuTaman); zW8GrupLampuTaman.position.set (zW8LampuX, 0, zW8LampuZ);
    zW8ApplyCastShadow(zW8GrupLampuTaman); zW8GrupTamanBaru.add(zW8GrupLampuTaman); });

  const zW8PaletBungaTaman = [0xff5da2, 0xffb35c, 0xffe14d, 0xff5da2];
    [[20, 4.4, 0], [- 20, 4.4, 0], [20, - 4.4, 0], [- 4.4, - 20, Math.PI / 2]].forEach(([zW8PetakX, zW8PetakZ, zW8PetakRy], zW8IdxPetak) => {
    const zW8GrupPetakBaru = new THREE.Group(); const zW8MeshKotakPetakBaru = new THREE.Mesh(new THREE.BoxGeometry(4, 0.35, 1.2), zW8SharedStdMat(0x9a8a72, 1));
    zW8MeshKotakPetakBaru.position.y = 0.18; zW8GrupPetakBaru.add(zW8MeshKotakPetakBaru);
      const zW8MeshAtasPetakBaru = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.14, 1.0), new THREE.MeshStandardMaterial({
      color : zW8PaletBungaTaman[zW8IdxPetak], roughness : 0.9, flatShading : true
    })); zW8MeshAtasPetakBaru.position.y = 0.42; zW8GrupPetakBaru.add(zW8MeshAtasPetakBaru); zW8GrupPetakBaru.position.set (zW8PetakX, 0, zW8PetakZ);
    zW8GrupPetakBaru.rotation.y = zW8PetakRy; zW8ApplyCastShadow(zW8GrupPetakBaru); zW8GrupTamanBaru.add(zW8GrupPetakBaru);
  }); const zW8RekamanTaman = {
  }; zW8RekamanTaman.x = zW8PusatTamanX; zW8RekamanTaman.z = zW8PusatTamanZ; zW8RekamanTaman.stallX = zW8KiosTamanX; zW8RekamanTaman.stallZ = zW8KiosTamanZ;
  G.parkSpot = zW8RekamanTaman; const zW8HitunganTaman = {
  }; zW8HitunganTaman.trees = zW8DaftarTitikPohon.length; zW8HitunganTaman.benches = 6; zW8HitunganTaman.lamps = 4; zW8HitunganTaman.flowerBeds = 4;
  zW8HitunganTaman.stalls = 1; zW8HitunganTaman.fountains = 1; G.parkCounts = zW8HitunganTaman; return G.parkSpot; }
let zW8DaftarPijarLampuJalan = []; export function buildWorld(G) {
  const zW8SceneQQQQQQQQQQ = G.scene; G.roadX = [- 660, - 495, - 330, - 165, 0, 165, 330, 495, 660,]; G.roadZ = [- 660, - 495, - 330, - 165, 0, 165, 330, 495, 660,];
    G.touge = TOUGE_POINTS.map((zW8TitikObj) => ({
    x : zW8TitikObj[0], z : zW8TitikObj[1]
  })); zW8DaftarPijarLampuJalan = []; zW8DaftarSpritePijar = []; zW8JamLangitTerakhir = - 10;

  zW8LembarLangit = document.createElement('canvas'); zW8LembarLangit.width = 16; zW8LembarLangit.height = 512; zW8KuasLangit = zW8LembarLangit.getContext('2d');
  zW8TexLangitObj = new THREE.CanvasTexture(zW8LembarLangit); zW8TexLangitObj.colorSpace = THREE.SRGBColorSpace; zW8ComputeSkyColors(G.timeOfDay || 10.5);
  zW8PaintSkyDome(); zW8KubahLangit = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 12), new THREE.MeshBasicMaterial({
    map : zW8TexLangitObj, side : THREE.BackSide, fog : false, depthWrite : false
  })); zW8KubahLangit.renderOrder = - 1; zW8SceneQQQQQQQQQQ.add(zW8KubahLangit); zW8SceneQQQQQQQQQQ.fog = new THREE.Fog(0xcfe4ec, 220, 1500);

  const zW8TexTanahDasar = zW8BuildGroundTexture(); zW8TexTanahDasar.wrapS = zW8TexTanahDasar.wrapT = THREE.RepeatWrapping; zW8TexTanahDasar.repeat.set (40, 40);
  if (G.maxAniso) zW8TexTanahDasar.anisotropy = G.maxAniso; const zW8MeshTanahDasar = new THREE.Mesh(new THREE.PlaneGeometry(1320, 1320), new THREE.MeshStandardMaterial({
    map : zW8TexTanahDasar, roughness : 1
  })); zW8MeshTanahDasar.rotation.x = - Math.PI / 2; zW8MeshTanahDasar.receiveShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshTanahDasar);

  const zW8GeoBukitDasar = new THREE.PlaneGeometry(700, 700, 24, 24); {
    const zW8AttrPosisiBukit = zW8GeoBukitDasar.attributes.position; for (let zW8IdxTitikQ = 0; zW8IdxTitikQ < zW8AttrPosisiBukit.count; ++ zW8IdxTitikQ) {
      const zW8VxBukit = zW8AttrPosisiBukit.getX(zW8IdxTitikQ) - 330, zW8VzBukit = - (zW8AttrPosisiBukit.getY(zW8IdxTitikQ)) - 330;
      zW8AttrPosisiBukit.setZ(zW8IdxTitikQ, groundH(zW8VxBukit, zW8VzBukit)); }
    zW8GeoBukitDasar.computeVertexNormals(); }
  const zW8MeshBukitTouge = new THREE.Mesh(zW8GeoBukitDasar, zW8MakeGrassMat(28, 28)); zW8MeshBukitTouge.rotation.x = - Math.PI / 2;
  zW8MeshBukitTouge.position.set (- 330, 0.02, - 330); zW8MeshBukitTouge.receiveShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshBukitTouge);

    const zW8MeshBidangAir = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({
    color : 0x1d6fb8, transparent : true, opacity : 0.95, roughness : 0.3, metalness : 0.2
  })); zW8MeshBidangAir.rotation.x = - Math.PI / 2; zW8MeshBidangAir.position.y = - 0.4; zW8SceneQQQQQQQQQQ.add(zW8MeshBidangAir); G.water = zW8MeshBidangAir;

  const zW8TexPasirPantai = zW8BuildSandTexture(); zW8TexPasirPantai.repeat.set (66, 5); if (G.maxAniso) zW8TexPasirPantai.anisotropy = G.maxAniso;
    const zW8MeshPantaiBaru = new THREE.Mesh(new THREE.PlaneGeometry(1320, 100), new THREE.MeshStandardMaterial({
    map : zW8TexPasirPantai, roughness : 1
  })); zW8MeshPantaiBaru.rotation.x = - Math.PI / 2; zW8MeshPantaiBaru.position.set (0, 0.03, 610); zW8MeshPantaiBaru.receiveShadow = true;
  zW8SceneQQQQQQQQQQ.add(zW8MeshPantaiBaru);
 {
      const zW8PasangOverlayZona = (zW8ZonaX, zW8ZonaZ, zW8MatZona) => {
      const zW8MeshOverlayZona = new THREE.Mesh(new THREE.PlaneGeometry(660, 660), zW8MatZona); zW8MeshOverlayZona.rotation.x = - Math.PI / 2;
      zW8MeshOverlayZona.position.set (zW8ZonaX, 0.018, zW8ZonaZ); zW8MeshOverlayZona.receiveShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshOverlayZona); };

    const zW8ZonaPaveA = zW8BuildPavingTexture(); zW8ZonaPaveA.repeat.set (66, 66); if (G.maxAniso) zW8ZonaPaveA.anisotropy = G.maxAniso;
      zW8PasangOverlayZona(330, 330, new THREE.MeshStandardMaterial({
      map : zW8ZonaPaveA, roughness : 1
    })); const zW8ZonaPaveB = zW8BuildPavingTexture(); zW8ZonaPaveB.repeat.set (66, 66); if (G.maxAniso) zW8ZonaPaveB.anisotropy = G.maxAniso;
      zW8PasangOverlayZona(330, - 330, new THREE.MeshStandardMaterial({
      map : zW8ZonaPaveB, roughness : 1
    })); const zW8ZonaPaveC = zW8BuildPavingTexture(); zW8ZonaPaveC.repeat.set (66, 66); if (G.maxAniso) zW8ZonaPaveC.anisotropy = G.maxAniso;
      zW8PasangOverlayZona(- 330, 330, new THREE.MeshStandardMaterial({
      map : zW8ZonaPaveC, roughness : 1
    }));
 }

    const zW8TexAspalJalan = zW8MakeCanvasTexture(64, 256, (zW8KuasQQQQQQQQQQQ, zW8LebarValQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQ) => {
    zW8KuasQQQQQQQQQQQ.fillStyle = '#33373c'; zW8KuasQQQQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQ);
      for (let zW8IdxBintikQQQ = 0; zW8IdxBintikQQQ < 700; ++ zW8IdxBintikQQQ) {
      const zW8ShadeValQ = Math.floor(rnd() * 36) + 40;
      zW8KuasQQQQQQQQQQQ.fillStyle = `rgba(${zW8ShadeValQ},${zW8ShadeValQ},${zW8ShadeValQ + 4},.18)`;
      zW8KuasQQQQQQQQQQQ.fillRect(rnd() * zW8LebarValQQQQQQQQQ, rnd() * zW8TinggiValQQQQQQQQQQQQ, 2, 2); }
      for (let zW8IdxKilau = 0; zW8IdxKilau < 130; ++ zW8IdxKilau) {
      zW8KuasQQQQQQQQQQQ.fillStyle = 'rgba(255,255,255,.045)'; zW8KuasQQQQQQQQQQQ.fillRect(rnd() * zW8LebarValQQQQQQQQQ, rnd() * zW8TinggiValQQQQQQQQQQQQ, 2, 2); }
    zW8KuasQQQQQQQQQQQ.strokeStyle = 'rgba(0,0,0,.16)'; zW8KuasQQQQQQQQQQQ.lineWidth = 1; for (let zW8IdxRetak = 0; zW8IdxRetak < 7; ++ zW8IdxRetak) {
      zW8KuasQQQQQQQQQQQ.beginPath(); let zW8RetakX = rnd() * zW8LebarValQQQQQQQQQ, zW8RetakY = rnd() * zW8TinggiValQQQQQQQQQQQQ;
      zW8KuasQQQQQQQQQQQ.moveTo(zW8RetakX, zW8RetakY); for (let zW8IdxSegQ = 0; zW8IdxSegQ < 3; ++ zW8IdxSegQ) {
        zW8RetakX += rr(- 9, 9); zW8RetakY += rr(4, 14); zW8KuasQQQQQQQQQQQ.lineTo(zW8RetakX, zW8RetakY); }
      zW8KuasQQQQQQQQQQQ.stroke(); }
      const zW8LukisGarisJalan = (zW8PosisiU, zW8WarnaGaris, zW8FraksiLebar) => {
      zW8KuasQQQQQQQQQQQ.fillStyle = zW8WarnaGaris; const zW8LebarGaris = Math.max(1, zW8LebarValQQQQQQQQQ * zW8FraksiLebar);
      zW8KuasQQQQQQQQQQQ.fillRect((zW8LebarValQQQQQQQQQ * zW8PosisiU) - zW8LebarGaris / 2, 0, zW8LebarGaris, zW8TinggiValQQQQQQQQQQQQ);
    }; zW8LukisGarisJalan(0.03, '#d8d8d2', 0.012); zW8LukisGarisJalan(0.97, '#d8d8d2', 0.012); zW8LukisGarisJalan(0.478, '#e8d9a0', 0.008);
    zW8LukisGarisJalan(0.522, '#e8d9a0', 0.008); zW8KuasQQQQQQQQQQQ.fillStyle = '#ffffff'; [0.25, 0.75].forEach((zW8PosisiUQ) => {
      const zW8LebarGarisQ = Math.max(1, zW8LebarValQQQQQQQQQ * 0.010);
      zW8KuasQQQQQQQQQQQ.fillRect((zW8LebarValQQQQQQQQQ * zW8PosisiUQ) - zW8LebarGarisQ / 2, 0, zW8LebarGarisQ, zW8TinggiValQQQQQQQQQQQQ * 0.45); });
  }); zW8TexAspalJalan.wrapS = zW8TexAspalJalan.wrapT = THREE.RepeatWrapping; if (G.maxAniso) zW8TexAspalJalan.anisotropy = G.maxAniso;
    const zW8MatAspalPenuh = new THREE.MeshStandardMaterial({
    map : zW8TexAspalJalan, roughness : 0.95
  }); const zW8MatAspalDatar = new THREE.MeshStandardMaterial({
    color : 0x33373d, roughness : 0.95 });

  const zW8TexTrotoarVert = zW8BuildPavingTexture(); zW8TexTrotoarVert.repeat.set (1, 110); if (G.maxAniso) zW8TexTrotoarVert.anisotropy = G.maxAniso;
    const zW8MatTrotoarVert = new THREE.MeshStandardMaterial({
    map : zW8TexTrotoarVert, roughness : 1
  }); const zW8TexTrotoarHorz = zW8BuildPavingTexture(); zW8TexTrotoarHorz.repeat.set (110, 1); if (G.maxAniso) zW8TexTrotoarHorz.anisotropy = G.maxAniso;
    const zW8MatTrotoarHorz = new THREE.MeshStandardMaterial({
    map : zW8TexTrotoarHorz, roughness : 1
  }); G.roadX.forEach((zW8NilaiJalanX) => {
    const zW8KlonTexJalan = zW8TexAspalJalan.clone(); zW8KlonTexJalan.needsUpdate = true; zW8KlonTexJalan.repeat.set (1, 44);
      const zW8MeshJalanBaru = new THREE.Mesh(new THREE.PlaneGeometry(CFG.roadW, 1320), new THREE.MeshStandardMaterial({
      map : zW8KlonTexJalan, roughness : 0.95
    })); zW8MeshJalanBaru.rotation.x = - Math.PI / 2; zW8MeshJalanBaru.position.set (zW8NilaiJalanX, 0.05, 0); zW8MeshJalanBaru.receiveShadow = true;
    zW8SceneQQQQQQQQQQ.add(zW8MeshJalanBaru); [- 1, 1].forEach((zW8TandaSisiQQQ) => {
      const zW8MeshTrotoarBaru = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1320), zW8MatTrotoarVert);
      zW8MeshTrotoarBaru.position.set (zW8TandaSisiQQQ * ((CFG.roadW / 2) + 1.5) + zW8NilaiJalanX, 0.06, 0); zW8MeshTrotoarBaru.receiveShadow = true;
      zW8SceneQQQQQQQQQQ.add(zW8MeshTrotoarBaru); });
  }); G.roadZ.forEach((zW8NilaiJalanZ) => {

    const zW8KlonTexJalanQ = zW8TexAspalJalan.clone(); zW8KlonTexJalanQ.needsUpdate = true; zW8KlonTexJalanQ.center.set (0.5, 0.5);
    zW8KlonTexJalanQ.rotation = Math.PI / 2; zW8KlonTexJalanQ.repeat.set (1, 44);
      const zW8MeshJalanBaruQ = new THREE.Mesh(new THREE.PlaneGeometry(1320, CFG.roadW), new THREE.MeshStandardMaterial({
      map : zW8KlonTexJalanQ, roughness : 0.95
    })); zW8MeshJalanBaruQ.rotation.x = - Math.PI / 2; zW8MeshJalanBaruQ.position.set (0, 0.05, zW8NilaiJalanZ); zW8MeshJalanBaruQ.rotation.z = Math.PI / 2;
    zW8MeshJalanBaruQ.receiveShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshJalanBaruQ); [- 1, 1].forEach((zW8TandaSisiQQQQ) => {
      const zW8MeshTrotoarBaruQ = new THREE.Mesh(new THREE.BoxGeometry(1320, 0.12, 3), zW8MatTrotoarHorz);
      zW8MeshTrotoarBaruQ.position.set (0, 0.06, zW8TandaSisiQQQQ * ((CFG.roadW / 2) + 1.5) + zW8NilaiJalanZ); zW8MeshTrotoarBaruQ.receiveShadow = true;
      zW8SceneQQQQQQQQQQ.add(zW8MeshTrotoarBaruQ); });
  }); void zW8MatAspalPenuh; void zW8MatAspalDatar;
 {
    const zW8BatangPerSisiZebra = 5; const zW8SisiPerSimpang = 4; const zW8TotalBatangZebra = G.roadX.length * G.roadZ.length * zW8SisiPerSimpang * zW8BatangPerSisiZebra;
      const zW8InstZebraBaru = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({
      color : 0xf2efe4, roughness : 0.9
    }), zW8TotalBatangZebra);
    const zW8Mat4Zebra = new THREE.Matrix4(), zW8QuatZebra = new THREE.Quaternion().setFromEuler(new THREE.Euler(- Math.PI / 2, 0, 0)), zW8VecZebra = new THREE.Vector3(), zW8SkalaZebra = new THREE.Vector3();
    const zW8GeserSilangZebra = (CFG.roadW / 2) + 3.5; const zW8RentangSilangZebra = CFG.roadW / 6; let zW8PenandaBatang = 0; G.roadX.forEach((zW8SilangX) => {
        G.roadZ.forEach((zW8SilangZ) => {
          for (let zW8IdxGarisQ = 0; zW8IdxGarisQ < zW8BatangPerSisiZebra; ++ zW8IdxGarisQ) {
          const zW8GeserGaris = (zW8IdxGarisQ * zW8RentangSilangZebra) - (2 * zW8RentangSilangZebra);
          zW8VecZebra.set (zW8GeserGaris + zW8SilangX, 0.07, zW8SilangZ - zW8GeserSilangZebra); zW8SkalaZebra.set (2.4, 6, 1);
          zW8InstZebraBaru.setMatrixAt(zW8PenandaBatang ++, zW8Mat4Zebra.compose(zW8VecZebra, zW8QuatZebra, zW8SkalaZebra));
          zW8VecZebra.set (zW8GeserGaris + zW8SilangX, 0.07, zW8GeserSilangZebra + zW8SilangZ);
          zW8InstZebraBaru.setMatrixAt(zW8PenandaBatang ++, zW8Mat4Zebra.compose(zW8VecZebra, zW8QuatZebra, zW8SkalaZebra));
          zW8VecZebra.set (zW8SilangX - zW8GeserSilangZebra, 0.07, zW8GeserGaris + zW8SilangZ); zW8SkalaZebra.set (6, 2.4, 1);
          zW8InstZebraBaru.setMatrixAt(zW8PenandaBatang ++, zW8Mat4Zebra.compose(zW8VecZebra, zW8QuatZebra, zW8SkalaZebra));
          zW8VecZebra.set (zW8GeserSilangZebra + zW8SilangX, 0.07, zW8GeserGaris + zW8SilangZ);
          zW8InstZebraBaru.setMatrixAt(zW8PenandaBatang ++, zW8Mat4Zebra.compose(zW8VecZebra, zW8QuatZebra, zW8SkalaZebra)); } });
    }); zW8InstZebraBaru.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8InstZebraBaru); }
 {
    const zW8ParuhLebarJalan = CFG.roadW / 2; const zW8MatMarkaPutihBaru = new THREE.MeshStandardMaterial({
      color : 0xf5f2e8, roughness : 0.85
    }); const zW8MatMarkaKuningBaru = new THREE.MeshStandardMaterial({
      color : 0xf7d154, roughness : 0.85
    }); const zW8ListDashPusat = [], zW8ListDashLajur = [], zW8ListGarisTepi = []; const zW8ListGarisBerhenti = [], zW8ListDashTouge = [], zW8ListTepiTouge = [];
    const zW8DekatSimpang = (zW8NilaiUji, zW8DaftarJalan) => zW8DaftarJalan.some((zW8NilaiJalanQQQQ) => Math.abs(zW8NilaiUji - (zW8NilaiJalanQQQQ)) < zW8ParuhLebarJalan + 9);
      G.roadX.forEach((zW8NilaiJalanXQ) => {
        for (let zW8DashZ = - 648; ! (zW8DashZ > 648); zW8DashZ += 12) {
        if (zW8DekatSimpang(zW8DashZ, G.roadZ)) continue; zW8ListDashPusat.push({
          x : zW8NilaiJalanXQ, z : zW8DashZ + 3, sx : 0.4, sy : 6
        }); zW8ListDashLajur.push({
          x : zW8NilaiJalanXQ - 7.5, z : zW8DashZ + 2, sx : 0.3, sy : 4.5
        }); zW8ListDashLajur.push({
          x : zW8NilaiJalanXQ + 7.5, z : zW8DashZ + 2, sx : 0.3, sy : 4.5 }); }
        for (let zW8IdxSegQQ = 0; zW8IdxSegQQ < G.roadZ.length - 1; ++ zW8IdxSegQQ) {
        const zW8SegAwalZ = G.roadZ[zW8IdxSegQQ] + zW8ParuhLebarJalan, zW8SegAkhirZ = G.roadZ[zW8IdxSegQQ + 1] - zW8ParuhLebarJalan; zW8ListGarisTepi.push({
          x : (zW8NilaiJalanXQ - zW8ParuhLebarJalan) + 0.8, z : (zW8SegAwalZ + zW8SegAkhirZ) / 2, sx : 0.3, sy : zW8SegAkhirZ - zW8SegAwalZ
        }); zW8ListGarisTepi.push({
          x : (zW8NilaiJalanXQ + zW8ParuhLebarJalan) - 0.8, z : (zW8SegAwalZ + zW8SegAkhirZ) / 2, sx : 0.3, sy : zW8SegAkhirZ - zW8SegAwalZ }); }
    }); G.roadZ.forEach((zW8NilaiJalanZQ) => {
        for (let zW8DashX = - 648; ! (zW8DashX > 648); zW8DashX += 12) {
        if (zW8DekatSimpang(zW8DashX, G.roadX)) continue; zW8ListDashPusat.push({
          x : zW8DashX + 3, z : zW8NilaiJalanZQ, sx : 6, sy : 0.4
        }); zW8ListDashLajur.push({
          x : zW8DashX + 2, z : zW8NilaiJalanZQ - 7.5, sx : 4.5, sy : 0.3
        }); zW8ListDashLajur.push({
          x : zW8DashX + 2, z : zW8NilaiJalanZQ + 7.5, sx : 4.5, sy : 0.3 }); }
        for (let zW8IdxSegQQQ = 0; zW8IdxSegQQQ < G.roadX.length - 1; ++ zW8IdxSegQQQ) {
        const zW8SegAwalX = G.roadX[zW8IdxSegQQQ] + zW8ParuhLebarJalan, zW8SegAkhirX = G.roadX[zW8IdxSegQQQ + 1] - zW8ParuhLebarJalan; zW8ListGarisTepi.push({
          x : (zW8SegAwalX + zW8SegAkhirX) / 2, z : (zW8NilaiJalanZQ - zW8ParuhLebarJalan) + 0.8, sx : zW8SegAkhirX - zW8SegAwalX, sy : 0.3
        }); zW8ListGarisTepi.push({
          x : (zW8SegAwalX + zW8SegAkhirX) / 2, z : (zW8NilaiJalanZQ + zW8ParuhLebarJalan) - 0.8, sx : zW8SegAkhirX - zW8SegAwalX, sy : 0.3 }); } });

      G.roadX.forEach((zW8SilangXQ) => {
        G.roadZ.forEach((zW8SilangZQ) => {
        const zW8GeserBerhentiMarka = zW8ParuhLebarJalan + 8.5; zW8ListGarisBerhenti.push({
          x : zW8SilangXQ - 7, z : zW8GeserBerhentiMarka + zW8SilangZQ, sx : 13, sy : 0.55
        }); zW8ListGarisBerhenti.push({
          x : zW8SilangXQ + 7, z : zW8SilangZQ - zW8GeserBerhentiMarka, sx : 13, sy : 0.55
        }); zW8ListGarisBerhenti.push({
          x : zW8GeserBerhentiMarka + zW8SilangXQ, z : zW8SilangZQ - 7, sx : 0.55, sy : 13
        }); zW8ListGarisBerhenti.push({
          x : zW8SilangXQ - zW8GeserBerhentiMarka, z : zW8SilangZQ + 7, sx : 0.55, sy : 13 }); }); });

      for (let zW8IdxSegQQQQ = 0; zW8IdxSegQQQQ < G.touge.length - 1; ++ zW8IdxSegQQQQ) {
      const zW8TitikSegA = G.touge[zW8IdxSegQQQQ], zW8TitikSegB = G.touge[zW8IdxSegQQQQ + 1];
      const zW8DeltaSegXQ = zW8TitikSegB.x - zW8TitikSegA.x, zW8DeltaSegZQ = zW8TitikSegB.z - zW8TitikSegA.z;
      const zW8PanjangSegTouge = Math.hypot(zW8DeltaSegXQ, zW8DeltaSegZQ) || 0.001;
      const zW8SatuanSegX = zW8DeltaSegXQ / zW8PanjangSegTouge, zW8SatuanSegZ = zW8DeltaSegZQ / zW8PanjangSegTouge, zW8TegakSegX = - zW8SatuanSegZ, zW8TegakSegZ = zW8SatuanSegX;
      const zW8RotSegTougeY = Math.atan2(- zW8SatuanSegX, - zW8SatuanSegZ); for (let zW8JarakDash = 4; zW8JarakDash < zW8PanjangSegTouge; zW8JarakDash += 9) {
        const zW8FraksiDash = zW8JarakDash / zW8PanjangSegTouge, zW8DashTougeX = (zW8DeltaSegXQ * zW8FraksiDash) + zW8TitikSegA.x, zW8DashTougeZ = (zW8DeltaSegZQ * zW8FraksiDash) + zW8TitikSegA.z;
          zW8ListDashTouge.push({
          x : zW8DashTougeX, z : zW8DashTougeZ, ry : zW8RotSegTougeY, sx : 0.35, sy : 3.2, y : groundH(zW8DashTougeX, zW8DashTougeZ) + 0.12 }); }
        [- 1, 1].forEach((zW8TandaSisiQQQQQ) => {
        const zW8TengahTepiX = ((zW8TitikSegA.x + zW8TitikSegB.x) / 2) + (zW8TegakSegX * zW8TandaSisiQQQQQ * 4.05), zW8TengahTepiZ = ((zW8TitikSegA.z + zW8TitikSegB.z) / 2) + (zW8TegakSegZ * zW8TandaSisiQQQQQ * 4.05);
        const zW8TinggiTepiTougeA = groundH(zW8TitikSegA.x + zW8TegakSegX * zW8TandaSisiQQQQQ * 4.05, zW8TitikSegA.z + zW8TegakSegZ * zW8TandaSisiQQQQQ * 4.05);
        const zW8TinggiTepiTougeB = groundH(zW8TitikSegB.x + zW8TegakSegX * zW8TandaSisiQQQQQ * 4.05, zW8TitikSegB.z + zW8TegakSegZ * zW8TandaSisiQQQQQ * 4.05);
          zW8ListTepiTouge.push({
          x : zW8TengahTepiX, z : zW8TengahTepiZ, ry : Math.atan2(zW8SatuanSegX, zW8SatuanSegZ), sx : 0.28, sz : zW8PanjangSegTouge, y : Math.max(zW8TinggiTepiTougeA, zW8TinggiTepiTougeB) + 0.13
        }); }); }
    const zW8QuatDatarMarka = new THREE.Quaternion().setFromEuler(new THREE.Euler(- Math.PI / 2, 0, 0)); const zW8RakitInstBidang = (zW8DaftarEntri, zW8RefMat) => {
      if (! zW8DaftarEntri.length) return; const zW8MeshInstBaru = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), zW8RefMat, zW8DaftarEntri.length);
      const zW8Mat4Marka = new THREE.Matrix4(), zW8QuatMarka = new THREE.Quaternion(), zW8QuatYMarka = new THREE.Quaternion(), zW8VecMarka = new THREE.Vector3(), zW8SkalaMarka = new THREE.Vector3();
        zW8DaftarEntri.forEach((zW8EntriObj, zW8IdxEntri) => {
          if (zW8EntriObj.ry) {
          zW8QuatYMarka.setFromEuler(new THREE.Euler(0, zW8EntriObj.ry, 0)); zW8QuatMarka.copy(zW8QuatYMarka).multiply(zW8QuatDatarMarka);
        } else zW8QuatMarka.copy(zW8QuatDatarMarka);
        zW8MeshInstBaru.setMatrixAt(zW8IdxEntri, zW8Mat4Marka.compose(zW8VecMarka.set (zW8EntriObj.x, zW8EntriObj.y || 0.08, zW8EntriObj.z), zW8QuatMarka, zW8SkalaMarka.set (zW8EntriObj.sx, zW8EntriObj.sy, 1)));
      }); zW8MeshInstBaru.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8MeshInstBaru);
    }; const zW8RakitInstKotak = (zW8DaftarEntriQ, zW8RefMatQ) => {
      if (! zW8DaftarEntriQ.length) return; const zW8MeshInstBaruQ = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), zW8RefMatQ, zW8DaftarEntriQ.length);
      const zW8Mat4MarkaQ = new THREE.Matrix4(), zW8QuatMarkaQ = new THREE.Quaternion(), zW8VecMarkaQ = new THREE.Vector3(), zW8SkalaMarkaQ = new THREE.Vector3();
        zW8DaftarEntriQ.forEach((zW8EntriObjQ, zW8IdxEntriQ) => {
        zW8QuatMarkaQ.setFromEuler(new THREE.Euler(0, zW8EntriObjQ.ry || 0, 0));
        zW8MeshInstBaruQ.setMatrixAt(zW8IdxEntriQ, zW8Mat4MarkaQ.compose(zW8VecMarkaQ.set (zW8EntriObjQ.x, zW8EntriObjQ.y || 0.08, zW8EntriObjQ.z), zW8QuatMarkaQ, zW8SkalaMarkaQ.set (zW8EntriObjQ.sx, 0.05, zW8EntriObjQ.sz)));
      }); zW8MeshInstBaruQ.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8MeshInstBaruQ);
    }; zW8RakitInstBidang(zW8ListDashPusat, zW8MatMarkaKuningBaru); zW8RakitInstBidang(zW8ListDashLajur, zW8MatMarkaPutihBaru);
    zW8RakitInstBidang(zW8ListGarisTepi, zW8MatMarkaPutihBaru); zW8RakitInstBidang(zW8ListGarisBerhenti, zW8MatMarkaPutihBaru);
    zW8RakitInstBidang(zW8ListDashTouge, zW8MatMarkaPutihBaru); zW8RakitInstKotak(zW8ListTepiTouge, zW8MatMarkaPutihBaru); }
 {
      const zW8GabungkanGeometri = (zW8DaftarGeo) => {
      let zW8JumlahTitikTotal = 0; let zW8JumlahIndeksTotal = 0; zW8DaftarGeo.forEach((zW8GeoObj) => {
        zW8JumlahTitikTotal += zW8GeoObj.attributes.position.count; zW8JumlahIndeksTotal += zW8GeoObj.index.count; });
      const zW8LarikPosisi = new Float32Array(zW8JumlahTitikTotal * 3), zW8LarikNormal = new Float32Array(zW8JumlahTitikTotal * 3), zW8LarikUv = new Float32Array(zW8JumlahTitikTotal * 2);
      const zW8LarikIndeks = new Uint32Array(zW8JumlahIndeksTotal); let zW8PenandaTitik = 0; let zW8PenandaIndeks = 0; zW8DaftarGeo.forEach((zW8GeoObjQ) => {
        zW8LarikPosisi.set (zW8GeoObjQ.attributes.position.array, zW8PenandaTitik * 3); zW8LarikNormal.set (zW8GeoObjQ.attributes.normal.array, zW8PenandaTitik * 3);
        if (zW8GeoObjQ.attributes.uv) zW8LarikUv.set (zW8GeoObjQ.attributes.uv.array, zW8PenandaTitik * 2);
        for (let zW8IdxElem = 0; zW8IdxElem < zW8GeoObjQ.index.count; zW8IdxElem ++) zW8LarikIndeks[zW8PenandaIndeks + zW8IdxElem] = zW8GeoObjQ.index.getX(zW8IdxElem) + zW8PenandaTitik;
        zW8PenandaTitik += zW8GeoObjQ.attributes.position.count; zW8PenandaIndeks += zW8GeoObjQ.index.count;
      }); const zW8GeoGabungBaru = new THREE.BufferGeometry(); zW8GeoGabungBaru.setAttribute('position', new THREE.BufferAttribute(zW8LarikPosisi, 3));
      zW8GeoGabungBaru.setAttribute('normal', new THREE.BufferAttribute(zW8LarikNormal, 3));
      zW8GeoGabungBaru.setAttribute('uv', new THREE.BufferAttribute(zW8LarikUv, 2)); zW8GeoGabungBaru.setIndex(new THREE.BufferAttribute(zW8LarikIndeks, 1));
      return zW8GeoGabungBaru; };

    const zW8GeoTiangSinyalBaru = zW8GabungkanGeometri([new THREE.CylinderGeometry(0.07, 0.09, 4.6, 8).translate(0, 2.3, 0), new THREE.BoxGeometry(0.12, 0.12, 1.0).translate(0, 4.5, 0.5), new THREE.BoxGeometry(0.34, 0.9, 0.3).translate(0, 4.15, 0.95),]);
      const zW8MatTiangSinyalBaru = new THREE.MeshStandardMaterial({
      color : 0x22262a, roughness : 0.6, metalness : 0.6
    }); const zW8ListSimpang = []; G.roadX.forEach((zW8SilangXQQ) => {
      G.roadZ.forEach((zW8SilangZQQ) => zW8ListSimpang.push([zW8SilangXQQ, zW8SilangZQQ]));
    }); const zW8InstTiangSinyal = new THREE.InstancedMesh(zW8GeoTiangSinyalBaru, zW8MatTiangSinyalBaru, zW8ListSimpang.length * 2);
    const zW8GeoMukaLampuBaru = new THREE.CircleGeometry(0.11, 12); const zW8PaletWarnaNyala = [0xff2a1e, 0xffb020, 0x2aff5a]; const zW8PetaLampuSinyal = {
      x : [], z : []
    }; ['x', 'z'].forEach((zW8KunciSumbu) => {
        for (let zW8IdxWarna = 0; zW8IdxWarna < 3; ++ zW8IdxWarna) {
          const zW8InstNyala = new THREE.InstancedMesh(zW8GeoMukaLampuBaru, new THREE.MeshBasicMaterial({
          color : zW8PaletWarnaNyala[zW8IdxWarna]
        }), zW8ListSimpang.length); const zW8InstMati = new THREE.InstancedMesh(zW8GeoMukaLampuBaru, new THREE.MeshBasicMaterial({
          color : 0x1a1c1e
        }), zW8ListSimpang.length); const zW8PasanganBaru = {
        }; zW8PasanganBaru.on = zW8InstNyala; zW8PasanganBaru.off = zW8InstMati; zW8PetaLampuSinyal[zW8KunciSumbu].push(zW8PasanganBaru);
        zW8SceneQQQQQQQQQQ.add(zW8InstNyala); zW8SceneQQQQQQQQQQ.add(zW8InstMati); } });
    const zW8Mat4Sinyal = new THREE.Matrix4(), zW8QuatSinyal = new THREE.Quaternion(), zW8EulerSinyal = new THREE.Euler(), zW8VecSkalaSatu = new THREE.Vector3(1, 1, 1), zW8VecPosSinyal = new THREE.Vector3();
    let zW8PenandaTiang = 0; zW8ListSimpang.forEach(([zW8SilangXQQQ, zW8SilangZQQQ], zW8IdxSilang) => {
        [[zW8SilangXQQQ + 13, zW8SilangZQQQ + 13, Math.PI / 2, 'x'], [zW8SilangXQQQ - 13, zW8SilangZQQQ - 13, 0, 'z']].forEach(([zW8TiangX, zW8TiangZ, zW8RotTiangY, zW8SumbuTiang]) => {
        zW8QuatSinyal.setFromEuler(zW8EulerSinyal.set (0, zW8RotTiangY, 0));
        zW8InstTiangSinyal.setMatrixAt(zW8PenandaTiang ++, zW8Mat4Sinyal.compose(zW8VecPosSinyal.set (zW8TiangX, 0, zW8TiangZ), zW8QuatSinyal, zW8VecSkalaSatu));
        const zW8KosinusRot = Math.cos(zW8RotTiangY), zW8SinusRot = Math.sin(zW8RotTiangY); for (let zW8IdxWarnaQ = 0; zW8IdxWarnaQ < 3; ++ zW8IdxWarnaQ) {
          const zW8LampuPosY = [0.28, 0, - 0.28][zW8IdxWarnaQ] + 4.15, zW8GeserMukaZ = 1.11;
          const zW8LampuDuniaX = (zW8GeserMukaZ * zW8SinusRot) + zW8TiangX, zW8LampuDuniaZ = (zW8GeserMukaZ * zW8KosinusRot) + zW8TiangZ;
          const zW8MatriksLampuBaru = zW8Mat4Sinyal.compose(zW8VecPosSinyal.set (zW8LampuDuniaX, zW8LampuPosY, zW8LampuDuniaZ), zW8QuatSinyal, zW8VecSkalaSatu);
          zW8PetaLampuSinyal[zW8SumbuTiang][zW8IdxWarnaQ].on.setMatrixAt(zW8IdxSilang, zW8MatriksLampuBaru);
          zW8PetaLampuSinyal[zW8SumbuTiang][zW8IdxWarnaQ].off.setMatrixAt(zW8IdxSilang, zW8MatriksLampuBaru); } });
    }); zW8InstTiangSinyal.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8InstTiangSinyal); ['x', 'z'].forEach((zW8KunciSumbuQ) => {
        zW8PetaLampuSinyal[zW8KunciSumbuQ].forEach((zW8PasanganBaruQ) => {
        zW8PasanganBaruQ.on.instanceMatrix.needsUpdate = true; zW8PasanganBaruQ.off.instanceMatrix.needsUpdate = true; }); });

    let zW8JamSiklusSinyal = 0, zW8FaseSinyal = - 1, zW8StatusSumbuX = 'red', zW8StatusSumbuZ = 'green'; const zW8PasangStatusSinyal = () => {
        [['x', zW8StatusSumbuX], ['z', zW8StatusSumbuZ]].forEach(([zW8KunciSumbuQQ, zW8NilaiStatus]) => {
        const zW8IdxWarnaAktif = zW8NilaiStatus === 'red' ? 0 : zW8NilaiStatus === 'yellow' ? 1 : 2;
          zW8PetaLampuSinyal[zW8KunciSumbuQQ].forEach((zW8PasanganBaruQQ, zW8IdxWarnaQQ) => {
          zW8PasanganBaruQQ.on.visible = zW8IdxWarnaQQ === zW8IdxWarnaAktif; zW8PasanganBaruQQ.off.visible = zW8IdxWarnaQQ !== zW8IdxWarnaAktif; }); });
    }; zW8PasangStatusSinyal(); G.lightState = (zW8KunciSumbuQQQ) => (zW8KunciSumbuQQQ === 'x' ? zW8StatusSumbuX : zW8StatusSumbuZ);
      G.updaters.push((zW8GInner, zW8DtInner) => {
      zW8JamSiklusSinyal = (zW8JamSiklusSinyal + zW8DtInner) % 15.5; let zW8FaseBerikutnya; let zW8StatusBaruX = 'red', zW8StatusBaruZ = 'red';
        if (zW8JamSiklusSinyal < 5.5) {
        zW8FaseBerikutnya = 0; zW8StatusBaruZ = 'green';
        } else if (zW8JamSiklusSinyal < 7) {
        zW8FaseBerikutnya = 1; zW8StatusBaruZ = 'yellow';
        } else if (zW8JamSiklusSinyal < 7.75) {
        zW8FaseBerikutnya = 2;
        } else if (zW8JamSiklusSinyal < 13.25) {
        zW8FaseBerikutnya = 3; zW8StatusBaruX = 'green';
        } else if (zW8JamSiklusSinyal < 14.75) {
        zW8FaseBerikutnya = 4; zW8StatusBaruX = 'yellow'; } else {
        zW8FaseBerikutnya = 5; }
        if (zW8FaseBerikutnya !== zW8FaseSinyal) {
        zW8FaseSinyal = zW8FaseBerikutnya; zW8StatusSumbuX = zW8StatusBaruX; zW8StatusSumbuZ = zW8StatusBaruZ; zW8PasangStatusSinyal(); } }); }

  const zW8PaletCadangan = ['#8d99ae', '#a39a8b', '#b08968', '#94867a', '#9c7bb5', '#6d8ea0']; const zW8PastelPantai = VICE.coralPastels;

    const zW8PetaPaletDistrik = {
    neon : VICE.downtown, coral : VICE.coralPastels, port : ['#8a7f6a', '#6b7a72', '#a08a68', '#5f8d7d', '#94867a', '#7f9bb3',], hoshino : ['#9aa0a6', '#a39a8b', '#7d9a7a', '#b09872', '#6d8ea0', '#9a8a72',],
  }; let zW8WarnaDasarTerakhir = null, zW8WarnaDasarSebelumnya = null;
  const zW8OpsiTandaGedung = [['RAMEN', '#ff5c39'], ['CLUB NEON', '#e879ff'], ['TURBO PARTS', '#57b7ff'], ['HOTEL CORAL', '#ffb35c'], ['PAWN', '#ffe14d'], ['SUSHI-GO', '#7dffb0'], ['ARCADE', '#ff7ab0'],];
  const zW8OpsiTeksPoster = ['RONIN KAI', 'TURBO MAX', 'BAY COLA',]; for (let zW8BlokX = 0; zW8BlokX < 8; zW8BlokX ++)
    for (let zW8BlokZ = 0; zW8BlokZ < 8; ++ zW8BlokZ) {
    const zW8PusatBlokX = (zW8BlokX * 165) - 577.5, zW8PusatBlokZ = (zW8BlokZ * 165) - 577.5;
    const zW8DistrikBlok = DISTRICTS.reduce((zW8Terbaik, zW8Kandidat) => ((zW8PusatBlokX - zW8Kandidat.cx) ** 2 + (zW8PusatBlokZ - zW8Kandidat.cz) ** 2 < (zW8PusatBlokX - zW8Terbaik.cx) ** 2 + (zW8PusatBlokZ - zW8Terbaik.cz) ** 2 ? zW8Kandidat : zW8Terbaik), DISTRICTS[0]);

      if (zW8DistrikBlok.id === 'hoshino' && Math.hypot(zW8PusatBlokX - zW8DistrikBlok.cx, zW8PusatBlokZ - zW8DistrikBlok.cz) < 250) {
      zW8ConstructResidentialBlock(G, zW8SceneQQQQQQQQQQ, zW8PusatBlokX, zW8PusatBlokZ); continue; }
    const zW8IalahPantai = zW8PusatBlokZ > 500; const zW8JumlahGedungBlok = ri(2, 4); for (let zW8IdxGedung = 0; zW8IdxGedung < zW8JumlahGedungBlok; ++ zW8IdxGedung) {
      const zW8BentangLebar = rr(22, 44); const zW8BentangDalam = rr(22, 44);
      const zW8BentangTinggi = zW8IalahPantai ? rr(8, 20) : zW8DistrikBlok.id === 'neon' ? rr(24, 60) : zW8DistrikBlok.id === 'hoshino' ? rr(8, 22) : zW8DistrikBlok.id === 'port' ? rr(8, 20) : rr(10, 28);
      const zW8GedungX = rr(- 48, 48) + zW8PusatBlokX, zW8GedungZ = rr(- 48, 48) + zW8PusatBlokZ;
      if (Math.abs(zW8GedungX + 412.5) < 60 && Math.abs(zW8GedungZ - 412.5) < 60) continue;
      if (Math.abs(zW8GedungX - zW8MARKET.x) < 54 && Math.abs(zW8GedungZ - zW8MARKET.z) < 76) continue;
      const zW8DaftarPalet = zW8IalahPantai ? zW8PastelPantai : (zW8PetaPaletDistrik[zW8DistrikBlok.id] || zW8PaletCadangan); let zW8WarnaGedung = pick(zW8DaftarPalet);
      if (zW8WarnaGedung === zW8WarnaDasarTerakhir) zW8WarnaGedung = zW8DaftarPalet[(zW8DaftarPalet.indexOf(zW8WarnaGedung) + 1) % zW8DaftarPalet.length];
      if ((zW8DistrikBlok.id === 'coral' || zW8IalahPantai) && zW8WarnaGedung === zW8WarnaDasarSebelumnya) zW8WarnaGedung = zW8DaftarPalet[(zW8DaftarPalet.indexOf(zW8WarnaGedung) + 1) % zW8DaftarPalet.length];
      zW8WarnaDasarSebelumnya = zW8WarnaDasarTerakhir; zW8WarnaDasarTerakhir = zW8WarnaGedung;
      const zW8TexFasadGedung = zW8BuildBuildingTexture(zW8WarnaGedung, rr(0.18, 0.42)); zW8TexFasadGedung.wrapS = zW8TexFasadGedung.wrapT = THREE.RepeatWrapping;
        const zW8MatFasadGedung = new THREE.MeshStandardMaterial({
        map : zW8TexFasadGedung, emissive : 0xffc873, emissiveMap : zW8TexFasadGedung, emissiveIntensity : 0, roughness : 0.9
      }); zW8MatFasadGedung.color.setRGB(rr(0.92, 1), rr(0.9, 1), rr(0.87, 0.98));
      const zW8MeshGedungBaru = new THREE.Mesh(new THREE.BoxGeometry(zW8BentangLebar, zW8BentangTinggi, zW8BentangDalam), zW8MatFasadGedung);
      zW8MeshGedungBaru.position.set (zW8GedungX, (zW8BentangTinggi / 2) + groundH(zW8GedungX, zW8GedungZ), zW8GedungZ); zW8MeshGedungBaru.castShadow = true;
      zW8MeshGedungBaru.receiveShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshGedungBaru); if (! G.buildingMats) G.buildingMats = [];
      G.buildingMats.push(zW8MatFasadGedung); G.addCollider(zW8GedungX, zW8GedungZ, zW8BentangLebar / 2, zW8BentangDalam / 2, zW8BentangTinggi); if (zW8IalahPantai) {
        const zW8TinggiUndakGedung = rr(1.6, 3);
        const zW8MeshUndakGedung = new THREE.Mesh(new THREE.BoxGeometry(zW8BentangLebar * 0.62, zW8TinggiUndakGedung, zW8BentangDalam * 0.62), zW8MatFasadGedung);
        zW8MeshUndakGedung.position.set (zW8GedungX, (zW8BentangTinggi + (zW8TinggiUndakGedung / 2)) + groundH(zW8GedungX, zW8GedungZ), zW8GedungZ);
        zW8MeshUndakGedung.castShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshUndakGedung); }
        if (zW8IalahPantai || zW8DistrikBlok.id === 'coral') {
        const zW8WarnaNeonGedung = pick(VICE.neonTrim); const zW8MatTrimGedung = new THREE.MeshStandardMaterial({
          color : zW8WarnaNeonGedung, emissive : zW8WarnaNeonGedung, emissiveIntensity : 0, roughness : 0.6
        }); const zW8MeshTrimGedung = new THREE.Mesh(new THREE.BoxGeometry(zW8BentangLebar + 0.35, 0.3, zW8BentangDalam + 0.35), zW8MatTrimGedung);
        zW8MeshTrimGedung.position.set (zW8GedungX, (zW8BentangTinggi * 0.84) + groundH(zW8GedungX, zW8GedungZ), zW8GedungZ); zW8MeshTrimGedung.castShadow = true;
        zW8SceneQQQQQQQQQQ.add(zW8MeshTrimGedung); if (! G.neonTrimMats) G.neonTrimMats = []; G.neonTrimMats.push(zW8MatTrimGedung);
        const zW8PijarTrimGedung = glowSprite(new THREE.Color(zW8WarnaNeonGedung), 12);
        zW8PijarTrimGedung.position.set (zW8GedungX, (zW8BentangTinggi * 0.84) + groundH(zW8GedungX, zW8GedungZ), zW8GedungZ); zW8PijarTrimGedung.material.opacity = 0;
        zW8SceneQQQQQQQQQQ.add(zW8PijarTrimGedung); zW8DaftarSpritePijar.push(zW8PijarTrimGedung); }
        if (rnd() < 0.3) {
          const zW8MeshPropAtap = new THREE.Mesh(new THREE.BoxGeometry(rr(2, 4), rr(1, 2), rr(2, 4)), new THREE.MeshStandardMaterial({
          color : 0x555a60
        })); zW8MeshPropAtap.position.set (rr(- 6, 6) + zW8GedungX, zW8BentangTinggi + 0.8, rr(- 6, 6) + zW8GedungZ); zW8SceneQQQQQQQQQQ.add(zW8MeshPropAtap); }
        if (rnd() < 0.22) {
        const zW8TexPosterGedung = zW8BuildSignTexture(pick(zW8OpsiTeksPoster), '#14161c', '#ffb35c');

        const zW8GeoPapanPoster = new THREE.PlaneGeometry(14, 4); const zW8MatPapanPoster = new THREE.MeshBasicMaterial({
          map : zW8TexPosterGedung, side : THREE.FrontSide
        }); const zW8RotPapanY = rr(0, Math.PI); const zW8MeshPapanDepan = new THREE.Mesh(zW8GeoPapanPoster, zW8MatPapanPoster);
        zW8MeshPapanDepan.position.set (zW8GedungX, zW8BentangTinggi + 4, zW8GedungZ); zW8MeshPapanDepan.rotation.y = zW8RotPapanY;
        zW8SceneQQQQQQQQQQ.add(zW8MeshPapanDepan); const zW8MeshPapanBelakang = new THREE.Mesh(zW8GeoPapanPoster, zW8MatPapanPoster);
        zW8MeshPapanBelakang.position.set (zW8GedungX - Math.sin(zW8RotPapanY) * 0.06, zW8BentangTinggi + 4, zW8GedungZ - Math.cos(zW8RotPapanY) * 0.06);
        zW8MeshPapanBelakang.rotation.y = zW8RotPapanY + Math.PI; zW8SceneQQQQQQQQQQ.add(zW8MeshPapanBelakang); }

        if ((zW8DistrikBlok.id === 'neon' || zW8DistrikBlok.id === 'coral' || zW8IalahPantai) && rnd() < (zW8IalahPantai ? 0.75 : 0.6)) {
        const[zW8TeksTandaToko, zW8WarnaTandaToko] = pick(zW8OpsiTandaGedung);
        const zW8TexTandaToko = zW8BuildSignTexture(zW8TeksTandaToko, '#101018', zW8WarnaTandaToko);
          const zW8MeshTandaToko = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.4), new THREE.MeshBasicMaterial({
          map : zW8TexTandaToko
        })); zW8MeshTandaToko.position.set (zW8GedungX, 4.6, (zW8BentangDalam / 2) + 0.1 + zW8GedungZ); zW8SceneQQQQQQQQQQ.add(zW8MeshTandaToko);
        const zW8PijarTandaToko = glowSprite(new THREE.Color(zW8WarnaTandaToko), 13);
        zW8PijarTandaToko.position.set (zW8GedungX, 4.6, (zW8BentangDalam / 2) + 0.02 + zW8GedungZ); zW8PijarTandaToko.material.opacity = 0;
        zW8SceneQQQQQQQQQQ.add(zW8PijarTandaToko); zW8DaftarSpritePijar.push(zW8PijarTandaToko);
          const zW8MeshTendaToko = new THREE.Mesh(new THREE.BoxGeometry(15, 0.15, 2.2), new THREE.MeshStandardMaterial({
          color : new THREE.Color(zW8WarnaTandaToko)
        })); zW8MeshTendaToko.position.set (zW8GedungX, 3.6, (zW8BentangDalam / 2) + 1 + zW8GedungZ); zW8MeshTendaToko.rotation.x = 0.3;
        zW8SceneQQQQQQQQQQ.add(zW8MeshTendaToko); } } }
 {
    const zW8ListTitikLampu = [];
    const zW8UjiLewatiSimpang = (zW8NilaiUjiQ, zW8DaftarJalanQ) => zW8DaftarJalanQ.some((zW8NilaiJalanQQQQQ) => Math.abs(zW8NilaiUjiQ - (zW8NilaiJalanQQQQQ)) < 21);
    const zW8LampuKenaGedung = (x, z) => G.colliders.some((zW8ObjKolQQQ) => Math.abs(x - (zW8ObjKolQQQ.x)) < zW8ObjKolQQQ.hw + 1 && Math.abs(z - (zW8ObjKolQQQ.z)) < zW8ObjKolQQQ.hd + 1);
      G.roadX.forEach((zW8NilaiJalanXQQ) => {
      const zW8IalahUtama = zW8NilaiJalanXQQ === 0 || zW8NilaiJalanXQQ === 330; let zW8IdxSelang = 0;
        for (let zW8LampuZQ = - 615; ! (zW8LampuZQ > 615); zW8LampuZQ += zW8IalahUtama ? 45 : 55, ++ zW8IdxSelang) {
        if (zW8UjiLewatiSimpang(zW8LampuZQ, G.roadZ)) continue; if (zW8IalahUtama) {
            zW8ListTitikLampu.push({
            x : zW8NilaiJalanXQQ - 17, z : zW8LampuZQ, glow : 1
          }); zW8ListTitikLampu.push({
            x : zW8NilaiJalanXQQ + 17, z : zW8LampuZQ + 22, glow : 1 });
          } else zW8ListTitikLampu.push({
          x : zW8NilaiJalanXQQ + (zW8IdxSelang % 2 === 0 ? 17 : - 17), z : zW8LampuZQ, glow : 0 }); }
    }); G.roadZ.forEach((zW8NilaiJalanZQQ) => {
      const zW8IalahUtamaQ = zW8NilaiJalanZQQ === 0 || zW8NilaiJalanZQQ === 495; let zW8IdxSelangQ = 0;
        for (let zW8LampuXQ = - 615; ! (zW8LampuXQ > 615); zW8LampuXQ += zW8IalahUtamaQ ? 45 : 55, ++ zW8IdxSelangQ) {
        if (zW8UjiLewatiSimpang(zW8LampuXQ, G.roadX)) continue; if (zW8IalahUtamaQ) {
            zW8ListTitikLampu.push({
            x : zW8LampuXQ, z : zW8NilaiJalanZQQ - 17, glow : 1
          }); zW8ListTitikLampu.push({
            x : zW8LampuXQ + 22, z : zW8NilaiJalanZQQ + 17, glow : 1 });
          } else zW8ListTitikLampu.push({
          x : zW8LampuXQ, z : zW8NilaiJalanZQQ + (zW8IdxSelangQ % 2 === 0 ? 17 : - 17), glow : 0 }); }
    }); for (let zW8PapanXQ = - 440; ! (zW8PapanXQ > 640); zW8PapanXQ += 55) {
      if (zW8LampuKenaGedung(zW8PapanXQ, 552)) continue; zW8ListTitikLampu.push({
        x : zW8PapanXQ, z : 552, glow : 2 }); }
    const zW8TotalTitikLampu = zW8ListTitikLampu.length; const zW8MatTiangLampuJalan = new THREE.MeshStandardMaterial({
      color : 0x3a3f45, roughness : 0.8, metalness : 0.5
    }); const zW8Mat4Lampu = new THREE.Matrix4();
    const zW8InstTiangLampu = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), zW8MatTiangLampuJalan, zW8TotalTitikLampu);
      zW8ListTitikLampu.forEach((zW8TitikObjQ, zW8IdxLampu) => {
      zW8Mat4Lampu.makeTranslation(zW8TitikObjQ.x, 3, zW8TitikObjQ.z); zW8InstTiangLampu.setMatrixAt(zW8IdxLampu, zW8Mat4Lampu);
    }); zW8InstTiangLampu.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8InstTiangLampu); const zW8MatKepalaLampu = new THREE.MeshStandardMaterial({
      color : 0xffd9a0, emissive : 0xffc98a, emissiveIntensity : 0.15, roughness : 0.5
    }); const zW8InstKepalaLampu = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), zW8MatKepalaLampu, zW8TotalTitikLampu);
      zW8ListTitikLampu.forEach((zW8TitikObjQQ, zW8IdxLampuQ) => {
      zW8Mat4Lampu.makeTranslation(zW8TitikObjQQ.x, 6.02, zW8TitikObjQQ.z); zW8InstKepalaLampu.setMatrixAt(zW8IdxLampuQ, zW8Mat4Lampu);
    }); zW8InstKepalaLampu.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8InstKepalaLampu); const zW8MatKolamLampu = new THREE.MeshBasicMaterial({
      color : 0xffc98a, transparent : true, opacity : 0, blending : THREE.AdditiveBlending, depthWrite : false
    }); const zW8InstKolamLampu = new THREE.InstancedMesh(new THREE.CircleGeometry(5.5, 20), zW8MatKolamLampu, zW8TotalTitikLampu);
    const zW8QuatDatarLampu = new THREE.Quaternion().setFromEuler(new THREE.Euler(- Math.PI / 2, 0, 0));
    const zW8VecLampu = new THREE.Vector3(), zW8VecSkalaSatuLampu = new THREE.Vector3(1, 1, 1); zW8ListTitikLampu.forEach((zW8TitikObjQQQ, zW8IdxLampuQQ) => {
      zW8InstKolamLampu.setMatrixAt(zW8IdxLampuQQ, zW8Mat4Lampu.compose(zW8VecLampu.set (zW8TitikObjQQQ.x, 0.09, zW8TitikObjQQQ.z), zW8QuatDatarLampu, zW8VecSkalaSatuLampu));
    }); zW8InstKolamLampu.instanceMatrix.needsUpdate = true; zW8SceneQQQQQQQQQQ.add(zW8InstKolamLampu); zW8ListTitikLampu.forEach((zW8TitikObjQQQQ) => {
      if (! zW8TitikObjQQQQ.glow) return; const zW8PijarLampuBaru = glowSprite(zW8TitikObjQQQQ.glow === 2 ? 0xcfe6ff : 0xffd9a0, zW8TitikObjQQQQ.glow === 2 ? 5 : 5.5);
      zW8PijarLampuBaru.position.set (zW8TitikObjQQQQ.x, 6, zW8TitikObjQQQQ.z); zW8PijarLampuBaru.material.opacity = 0; zW8SceneQQQQQQQQQQ.add(zW8PijarLampuBaru);
      zW8DaftarPijarLampuJalan.push(zW8PijarLampuBaru);
    }); G.lampHeadMat = zW8MatKepalaLampu; G.lampPoolMat = zW8MatKolamLampu; }
  G.streetlightGlows = zW8DaftarPijarLampuJalan; G.signGlows = zW8DaftarSpritePijar;

  zW8ConstructHQ(G, zW8SceneQQQQQQQQQQ);

  zW8ConstructMarket(G, zW8SceneQQQQQQQQQQ); zW8ConstructBeachStrip(G, zW8SceneQQQQQQQQQQ); const zW8RekamanLandmark = {
  }; const zW8RekamanMarket = {
  }; zW8RekamanMarket.x = zW8MARKET.x; zW8RekamanMarket.z = zW8MARKET.z; zW8RekamanMarket.name = zW8MARKET.name; zW8RekamanLandmark.market = zW8RekamanMarket;
    const zW8RekamanGarasi = {
  }; zW8RekamanGarasi.x = G.hq.x; zW8RekamanGarasi.z = G.hq.garage.z; zW8RekamanGarasi.name = 'RONIN KAI HQ'; zW8RekamanLandmark.garage = zW8RekamanGarasi;
    zW8RekamanLandmark.districts = [{
    name : 'Downtown', x : 0, z : 0 }, {
    name : 'Portside', x : - 330, z : 330 }, {
    name : 'Coral Strip', x : 330, z : 330 }, {
    name : 'Neon Mile', x : 330, z : - 330 }, {
    name : 'Hoshino Heights', x : - 330, z : - 330 }, {
    name : 'Touge', x : - 330, z : - 470
  },]; G.landmarks = zW8RekamanLandmark;

  zW8ConstructHarbor(G, zW8SceneQQQQQQQQQQ);

  zW8ConstructTouge(G, zW8SceneQQQQQQQQQQ);

  let zW8HitungPohonSebar = 0; for (let zW8IdxCobaQ = 0; zW8IdxCobaQ < 400 && zW8HitungPohonSebar < 250; ++ zW8IdxCobaQ) {
    const zW8SebarX = rr(- 640, 640), zW8SebarZ = rr(- 640, 640);
    if (G.roadX.some((zW8NilaiJalanQQQQQQ) => Math.abs(zW8SebarX - (zW8NilaiJalanQQQQQQ)) < 22) || G.roadZ.some((zW8NilaiJalanQQQQQQQ) => Math.abs(zW8SebarZ - (zW8NilaiJalanQQQQQQQ)) < 22)) continue;
    if (Math.abs(zW8SebarX + 412.5) < 55 && Math.abs(zW8SebarZ - 412.5) < 55) continue;
    if (Math.abs(zW8SebarX - zW8MARKET.x) < 58 && Math.abs(zW8SebarZ - zW8MARKET.z) < 78) continue;
    const zW8DistrikSebar = DISTRICTS.reduce((zW8TerbaikQ, zW8KandidatQ) => ((zW8SebarX - zW8KandidatQ.cx) ** 2 + (zW8SebarZ - zW8KandidatQ.cz) ** 2 < (zW8SebarX - zW8TerbaikQ.cx) ** 2 + (zW8SebarZ - zW8TerbaikQ.cz) ** 2 ? zW8KandidatQ : zW8TerbaikQ), DISTRICTS[0]);
    let zW8PohonSebar; if (zW8DistrikSebar.id === 'coral' || zW8SebarZ > 520 || zW8DistrikSebar.id === 'neon') zW8PohonSebar = makePalm(rr(4.5, 6.5));
    else if (zW8DistrikSebar.id === 'hoshino') zW8PohonSebar = makeShadeTree(rr(3.5, 5), rnd() < 0.3 ? 0xe8a0bf : 0x3d8b4f);
    else zW8PohonSebar = makeShadeTree(rr(3.5, 5.5), 0x3d8b4f); zW8PohonSebar.position.set (zW8SebarX, groundH(zW8SebarX, zW8SebarZ), zW8SebarZ);
    zW8PohonSebar.rotation.y = rr(0, 6.28); zW8SceneQQQQQQQQQQ.add(zW8PohonSebar); ++ zW8HitungPohonSebar; }
 {
    const zW8GeserPalemTepi = (CFG.roadW / 2) + 3.8; let zW8HitungPalemTepi = 0;
      for (let zW8PalemXQQ = - 600; ! (zW8PalemXQQ > 600) && zW8HitungPalemTepi < 72; zW8PalemXQQ += 40) {
        [- 1, 1].forEach((zW8TandaSisiQQQQQQ) => {
        const zW8PalemTepi = makePalm(rr(4.5, 6.5));
        zW8PalemTepi.position.set (rr(- 2, 2) + zW8PalemXQQ, groundH(zW8PalemXQQ, (zW8TandaSisiQQQQQQ * zW8GeserPalemTepi) + 495), (zW8TandaSisiQQQQQQ * zW8GeserPalemTepi) + 495);
        zW8PalemTepi.rotation.y = rr(0, 6.28); zW8SceneQQQQQQQQQQ.add(zW8PalemTepi); ++ zW8HitungPalemTepi; }); }
      for (let zW8PalemZ = - 595; ! (zW8PalemZ > 95) && zW8HitungPalemTepi < 82; zW8PalemZ += 70) {
      const zW8PalemTepiQ = makePalm(rr(4.5, 6.5));
      zW8PalemTepiQ.position.set (zW8GeserPalemTepi + 330, groundH(zW8GeserPalemTepi + 330, zW8PalemZ), rr(- 2, 2) + zW8PalemZ); zW8PalemTepiQ.rotation.y = rr(0, 6.28);
      zW8SceneQQQQQQQQQQ.add(zW8PalemTepiQ); ++ zW8HitungPalemTepi; }

      const zW8TexBahayaPeti = zW8MakeCanvasTexture(128, 128, (zW8KuasQQQQQQQQQQQQ, zW8LebarValQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQ) => {
      zW8KuasQQQQQQQQQQQQ.fillStyle = '#8a7a3a'; zW8KuasQQQQQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQ);
      zW8KuasQQQQQQQQQQQQ.fillStyle = '#2b2b2b'; for (let zW8IdxGarisQQ = - 2; zW8IdxGarisQQ < 8; ++ zW8IdxGarisQQ) {
        zW8KuasQQQQQQQQQQQQ.save(); zW8KuasQQQQQQQQQQQQ.translate(zW8IdxGarisQQ * 32, 0); zW8KuasQQQQQQQQQQQQ.rotate(0.6);
        zW8KuasQQQQQQQQQQQQ.fillRect(0, - 40, 14, zW8TinggiValQQQQQQQQQQQQQ + 80); zW8KuasQQQQQQQQQQQQ.restore(); }
      zW8KuasQQQQQQQQQQQQ.fillStyle = 'rgba(255,255,255,.75)'; zW8KuasQQQQQQQQQQQQ.fillRect(14, 44, 100, 40); zW8KuasQQQQQQQQQQQQ.fillStyle = '#333';
      zW8KuasQQQQQQQQQQQQ.font = 'bold 22px sans-serif'; zW8KuasQQQQQQQQQQQQ.textAlign = 'center'; zW8KuasQQQQQQQQQQQQ.fillText('CARGO', 64, 72);
    }); const zW8MatPetiPelabuhan = new THREE.MeshStandardMaterial({
      map : zW8TexBahayaPeti, roughness : 0.9
    }); const zW8GeoPetiPelabuhan = new THREE.BoxGeometry(2.2, 2.2, 2.2); for (let zW8IdxPetiQQ = 0; zW8IdxPetiQQ < 12; ++ zW8IdxPetiQQ) {
      const zW8PetiX = ((zW8IdxPetiQQ % 4) * 36) + rr(- 3, 3) - 625, zW8PetiZ = (Math.floor(zW8IdxPetiQQ / 4) * 30) + rr(- 3, 3) + 532;
      const zW8MeshPetiBaru = new THREE.Mesh(zW8GeoPetiPelabuhan, zW8MatPetiPelabuhan); zW8MeshPetiBaru.position.set (zW8PetiX, 1.1, zW8PetiZ);
      zW8MeshPetiBaru.rotation.y = rr(0, 0.6); zW8SceneQQQQQQQQQQ.add(zW8MeshPetiBaru); if (zW8IdxPetiQQ % 3 === 0) {
        const zW8MeshPetiAtas = new THREE.Mesh(zW8GeoPetiPelabuhan, zW8MatPetiPelabuhan); zW8MeshPetiAtas.position.set (zW8PetiX, 3.3, zW8PetiZ);
        zW8MeshPetiAtas.rotation.y = rr(0, 0.6); zW8SceneQQQQQQQQQQ.add(zW8MeshPetiAtas); } }

      const zW8TexPenghalang = zW8MakeCanvasTexture(128, 32, (zW8KuasQQQQQQQQQQQQQ, zW8LebarValQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQ) => {
      zW8KuasQQQQQQQQQQQQQ.fillStyle = '#b8b4a8'; zW8KuasQQQQQQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQ);
      zW8KuasQQQQQQQQQQQQQ.fillStyle = '#e8762a'; zW8KuasQQQQQQQQQQQQQ.fillRect(0, 12, zW8LebarValQQQQQQQQQQQ, 8);
    }); const zW8MatPenghalang = new THREE.MeshStandardMaterial({
      map : zW8TexPenghalang, roughness : 0.95
    }); for (let zW8IdxPenghalang = 0; zW8IdxPenghalang < 6; ++ zW8IdxPenghalang) {
      const zW8MeshPenghalang = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 0.5), zW8MatPenghalang);
      zW8MeshPenghalang.position.set ((zW8IdxPenghalang * 40) - 560, 0.5, 472); zW8SceneQQQQQQQQQQ.add(zW8MeshPenghalang); }

      const zW8MatBakSampah = new THREE.MeshStandardMaterial({
      color : 0x2e4a34, roughness : 0.85, metalness : 0.2
    }); const zW8MatTutupSampah = new THREE.MeshStandardMaterial({
      color : 0x223828, roughness : 0.8, metalness : 0.2
    }); [[270, - 40], [390, 40], [270, - 200], [390, - 260]].forEach(([zW8SampahX, zW8SampahZ]) => {
      const zW8MeshBakSampah = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 1.4), zW8MatBakSampah); zW8MeshBakSampah.position.set (zW8SampahX, 0.7, zW8SampahZ);
      zW8SceneQQQQQQQQQQ.add(zW8MeshBakSampah); const zW8MeshTutupSampah = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 1.5), zW8MatTutupSampah);
      zW8MeshTutupSampah.position.set (zW8SampahX, 1.46, zW8SampahZ); zW8SceneQQQQQQQQQQ.add(zW8MeshTutupSampah); }); }

  zW8ConstructBoulevardFrontage(G, zW8SceneQQQQQQQQQQ); zW8ConstructBoulevardPalms(G, zW8SceneQQQQQQQQQQ); zW8ConstructGatherSpots(G, zW8SceneQQQQQQQQQQ);
  zW8ConstructHoshinoRows(G, zW8SceneQQQQQQQQQQ); zW8ConstructBoulevardPlanters(G, zW8SceneQQQQQQQQQQ);

    [[412, 412], [- 412, - 80]].forEach(([zW8LotX, zW8LotZ]) => {
    const zW8MeshLotPlaza = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), zW8MakePavingMat(15, 15)); zW8MeshLotPlaza.rotation.x = - Math.PI / 2;
    zW8MeshLotPlaza.position.set (zW8LotX, 0.04, zW8LotZ); zW8MeshLotPlaza.receiveShadow = true; zW8SceneQQQQQQQQQQ.add(zW8MeshLotPlaza);
      for (let zW8IdxBangkuLot = 0; zW8IdxBangkuLot < 4; ++ zW8IdxBangkuLot) {
        const zW8MeshBangkuLot = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.6), new THREE.MeshStandardMaterial({
        color : 0x7a5a38
      })); zW8MeshBangkuLot.position.set (rr(- 35, 35) + zW8LotX, 0.3, rr(- 35, 35) + zW8LotZ); zW8SceneQQQQQQQQQQ.add(zW8MeshBangkuLot); }
      for (let zW8IdxPenanamLot = 0; zW8IdxPenanamLot < 4; ++ zW8IdxPenanamLot) {
        const zW8MeshPenanamLot = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 1.8), new THREE.MeshStandardMaterial({
        color : 0x9a8a72, roughness : 1
      })); zW8MeshPenanamLot.position.set (rr(- 38, 38) + zW8LotX, 0.3, rr(- 38, 38) + zW8LotZ); zW8SceneQQQQQQQQQQ.add(zW8MeshPenanamLot);
        const zW8MeshSemakLot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), new THREE.MeshStandardMaterial({
        color : 0x3d8b4f, roughness : 1, flatShading : true
      })); zW8MeshSemakLot.position.set (zW8MeshPenanamLot.position.x, 0.95, zW8MeshPenanamLot.position.z); zW8SceneQQQQQQQQQQ.add(zW8MeshSemakLot); }

    const zW8BangkuPlazaA = zW8MakeBenchUnit(); zW8BangkuPlazaA.position.set (zW8LotX - 12, groundH(zW8LotX - 12, zW8LotZ + 10), zW8LotZ + 10);
    zW8BangkuPlazaA.rotation.y = 0.4; zW8SceneQQQQQQQQQQ.add(zW8BangkuPlazaA); const zW8BangkuPlazaB = zW8MakeBenchUnit();
    zW8BangkuPlazaB.position.set (zW8LotX + 14, groundH(zW8LotX + 14, zW8LotZ - 8), zW8LotZ - 8); zW8BangkuPlazaB.rotation.y = - 0.7;
    zW8SceneQQQQQQQQQQ.add(zW8BangkuPlazaB); const zW8PenanamPlaza = zW8MakePlanterUnit();
    zW8PenanamPlaza.position.set (zW8LotX + 4, groundH(zW8LotX + 4, zW8LotZ + 16), zW8LotZ + 16); zW8SceneQQQQQQQQQQ.add(zW8PenanamPlaza); });

  zW8ConstructPark(G, zW8SceneQQQQQQQQQQ); }

const zW8GARAGE_ROT_Y = Math.PI; function zW8ConstructHQ(G, zW8SceneQQQQQQQQQQQ) {
  const zW8PosisiHqX = - 412.5; const zW8PosisiHqZ = 412.5;

  const zW8GrupHq = new THREE.Group(); zW8SceneQQQQQQQQQQQ.add(zW8GrupHq); const zW8MatDindingHq = new THREE.MeshStandardMaterial({
    color : 0x4a4038, roughness : 0.9
  }); const zW8MeshBlokHq = new THREE.Mesh(new THREE.BoxGeometry(70, 10, 34), zW8MatDindingHq); zW8MeshBlokHq.position.set (zW8PosisiHqX, 5, zW8PosisiHqZ);
  zW8GrupHq.add(zW8MeshBlokHq);

  G.addCollider(zW8PosisiHqX, zW8PosisiHqZ, 15, 15, 10); const zW8MatPintuHq = new THREE.MeshStandardMaterial({
    color : 0x707880, roughness : 0.6, metalness : 0.6
  }); for (let zW8IdxPintu = - 1; ! (zW8IdxPintu > 1); ++ zW8IdxPintu) {
    const zW8MeshPintuHq = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), zW8MatPintuHq);
    zW8MeshPintuHq.position.set ((zW8IdxPintu * 20) + zW8PosisiHqX, 3, zW8PosisiHqZ + 17.2); zW8GrupHq.add(zW8MeshPintuHq); }
    const zW8TexTandaHq = (() => {
    const zW8LembarTanda = document.createElement('canvas'); zW8LembarTanda.width = 512; zW8LembarTanda.height = 96; const zW8KuasTanda = zW8LembarTanda.getContext('2d');
    zW8KuasTanda.fillStyle = '#14100c'; zW8KuasTanda.fillRect(0, 0, 512, 96); zW8KuasTanda.font = 'bold 58px sans-serif'; zW8KuasTanda.textAlign = 'center';
    zW8KuasTanda.shadowColor = '#ff7a1a'; zW8KuasTanda.shadowBlur = 16; zW8KuasTanda.fillStyle = '#ff7a1a'; zW8KuasTanda.fillText('RONIN KAI', 256, 66);
    const zW8TexTanda = new THREE.CanvasTexture(zW8LembarTanda); zW8TexTanda.colorSpace = THREE.SRGBColorSpace; return zW8TexTanda;
  })(); const zW8MeshTandaHq = new THREE.Mesh(new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial({
    map : zW8TexTandaHq
  })); zW8MeshTandaHq.position.set (zW8PosisiHqX, 8.6, zW8PosisiHqZ + 17.3); zW8GrupHq.add(zW8MeshTandaHq); const zW8MatJendelaHq = new THREE.MeshStandardMaterial({
    color : 0xffd9a0, emissive : 0xffb35c, emissiveIntensity : 0.6
  }); for (let zW8IdxJendela = 0; zW8IdxJendela < 5; ++ zW8IdxJendela) {
    const zW8MeshJendelaHq = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.4), zW8MatJendelaHq);
    zW8MeshJendelaHq.position.set ((zW8IdxJendela * 14) + zW8PosisiHqX - 28, 7.6, zW8PosisiHqZ - 17.2); zW8MeshJendelaHq.rotation.y = Math.PI;
    zW8GrupHq.add(zW8MeshJendelaHq); }

    const zW8TexApronHq = zW8MakeCanvasTexture(1024, 384, (zW8KuasQQQQQQQQQQQQQQ, zW8LebarValQQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQQ) => {
    zW8KuasQQQQQQQQQQQQQQ.fillStyle = '#6a6d70'; zW8KuasQQQQQQQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQQ);
      for (let zW8IdxBintikQQQQ = 0; zW8IdxBintikQQQQ < 5200; ++ zW8IdxBintikQQQQ) {
      const zW8ShadeValQQ = Math.floor(rnd() * 48) + 96;
      zW8KuasQQQQQQQQQQQQQQ.fillStyle = `rgba(${zW8ShadeValQQ},${zW8ShadeValQQ},${zW8ShadeValQQ + 4},.14)`;
      zW8KuasQQQQQQQQQQQQQQ.fillRect(rnd() * zW8LebarValQQQQQQQQQQQQ, rnd() * zW8TinggiValQQQQQQQQQQQQQQQ, 2, 2); }
      [[210, 120, 58, 20], [560, 210, 74, 26], [790, 90, 46, 16], [390, 290, 52, 18]].forEach(([zW8NodaX, zW8NodaY, zW8NodaRx, zW8NodaRy]) => {
      zW8KuasQQQQQQQQQQQQQQ.fillStyle = 'rgba(18,18,20,.20)'; zW8KuasQQQQQQQQQQQQQQ.beginPath();
      zW8KuasQQQQQQQQQQQQQQ.ellipse(zW8NodaX, zW8NodaY, zW8NodaRx, zW8NodaRy, 0.4, 0, 2 * Math.PI); zW8KuasQQQQQQQQQQQQQQ.fill();
      zW8KuasQQQQQQQQQQQQQQ.fillStyle = 'rgba(18,18,20,.12)'; zW8KuasQQQQQQQQQQQQQQ.beginPath();
      zW8KuasQQQQQQQQQQQQQQ.ellipse(zW8NodaX + 14, zW8NodaY + 6, zW8NodaRx * 0.6, zW8NodaRy * 0.6, 0.4, 0, 2 * Math.PI); zW8KuasQQQQQQQQQQQQQQ.fill(); });

    zW8KuasQQQQQQQQQQQQQQ.strokeStyle = 'rgba(245,245,240,.88)'; zW8KuasQQQQQQQQQQQQQQ.lineWidth = 5; zW8KuasQQQQQQQQQQQQQQ.beginPath();
    zW8KuasQQQQQQQQQQQQQQ.moveTo(0, zW8TinggiValQQQQQQQQQQQQQQQ - 108); zW8KuasQQQQQQQQQQQQQQ.lineTo(zW8LebarValQQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQQ - 108);
    zW8KuasQQQQQQQQQQQQQQ.stroke(); for (let zW8PetakXQ = 32; ! (zW8PetakXQ > zW8LebarValQQQQQQQQQQQQ - 32); zW8PetakXQ += 96) {
      zW8KuasQQQQQQQQQQQQQQ.beginPath(); zW8KuasQQQQQQQQQQQQQQ.moveTo(zW8PetakXQ, zW8TinggiValQQQQQQQQQQQQQQQ - 108);
      zW8KuasQQQQQQQQQQQQQQ.lineTo(zW8PetakXQ, zW8TinggiValQQQQQQQQQQQQQQQ - 6); zW8KuasQQQQQQQQQQQQQQ.stroke(); }
  }); zW8TexApronHq.wrapS = zW8TexApronHq.wrapT = THREE.ClampToEdgeWrapping;
    const zW8MeshApronHq = new THREE.Mesh(new THREE.PlaneGeometry(80, 30), new THREE.MeshStandardMaterial({
    map : zW8TexApronHq, roughness : 1
  })); zW8MeshApronHq.rotation.x = - Math.PI / 2; zW8MeshApronHq.position.set (zW8PosisiHqX, 0.04, 455); zW8SceneQQQQQQQQQQQ.add(zW8MeshApronHq); const zW8RekamanHq = {
  }; zW8RekamanHq.x = zW8PosisiHqX; zW8RekamanHq.z = zW8PosisiHqZ; const zW8TitikGarasiHq = {
  }; zW8TitikGarasiHq.x = zW8PosisiHqX; zW8TitikGarasiHq.z = 455; zW8RekamanHq.garage = zW8TitikGarasiHq; G.hq = zW8RekamanHq;

    const zW8CobaTukarGarasi = (zW8SisaPercobaan) => {
      loadHeroAsset('garage').then((zW8BungkusDimuat) => {
        try {
          if (! zW8BungkusDimuat) {
          if (zW8SisaPercobaan > 0) setTimeout(() => zW8CobaTukarGarasi(zW8SisaPercobaan - 1), 1500); return; }
        zW8SceneQQQQQQQQQQQ.remove(zW8GrupHq); const zW8GrupPenempatan = new THREE.Group();
        zW8GrupPenempatan.position.set (zW8PosisiHqX, groundH(zW8PosisiHqX, zW8PosisiHqZ), zW8PosisiHqZ); zW8GrupPenempatan.rotation.y = zW8GARAGE_ROT_Y;
        zW8GrupPenempatan.add(zW8BungkusDimuat.clone ? zW8BungkusDimuat.clone(true) : zW8BungkusDimuat);

          const zW8TexSeniNeon = (() => {
          const zW8LembarNeon = document.createElement('canvas'); zW8LembarNeon.width = 1024; zW8LembarNeon.height = 192;
          const zW8KuasNeon = zW8LembarNeon.getContext('2d'); zW8KuasNeon.clearRect(0, 0, 1024, 192); zW8KuasNeon.font = 'italic bold 118px sans-serif';
          zW8KuasNeon.textAlign = 'center'; zW8KuasNeon.shadowColor = '#ff4fd8'; zW8KuasNeon.shadowBlur = 34; zW8KuasNeon.fillStyle = '#ff4fd8';
          zW8KuasNeon.fillText('RONIN KAI', 512, 122); zW8KuasNeon.shadowBlur = 18; zW8KuasNeon.fillStyle = '#ff7a1a'; zW8KuasNeon.fillRect(212, 148, 600, 14);
          const zW8TexNeon = new THREE.CanvasTexture(zW8LembarNeon); zW8TexNeon.colorSpace = THREE.SRGBColorSpace; return zW8TexNeon;
        })(); const zW8MeshTandaNeon = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({
          map : zW8TexSeniNeon, transparent : true
        })); zW8MeshTandaNeon.position.set (0, 10.8, - 15.15); zW8MeshTandaNeon.rotation.y = Math.PI; zW8GrupPenempatan.add(zW8MeshTandaNeon);
          const zW8MatStripNeon = new THREE.MeshBasicMaterial({
          color : 0x39d5ff
        }); [- 13.5, 13.5].forEach((zW8StripX) => {
          const zW8MeshStripNeon = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 8), zW8MatStripNeon); zW8MeshStripNeon.position.set (zW8StripX, 6, - 15.15);
          zW8MeshStripNeon.rotation.y = Math.PI; zW8GrupPenempatan.add(zW8MeshStripNeon);
        }); const zW8PijarNeonHq = glowSprite(0xff4fd8, 16); zW8PijarNeonHq.position.set (0, 10.8, - 15.35); zW8PijarNeonHq.material.opacity = 0.35;
        zW8GrupPenempatan.add(zW8PijarNeonHq); zW8SceneQQQQQQQQQQQ.add(zW8GrupPenempatan); } catch (e) {
 }
      }).catch (() => {
      if (zW8SisaPercobaan > 0) setTimeout(() => zW8CobaTukarGarasi(zW8SisaPercobaan - 1), 1500); });
  }; try {
    zW8CobaTukarGarasi(3); } catch (e) {
 } }
  function zW8ConstructHarbor(G, zW8SceneQQQQQQQQQQQQ) {
  const zW8PaletKontainer = [0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98, 0xca6f1e]; Array.from ({
    length : 26
    }).forEach((zW8NilaiTakPakai, zW8IdxKontainer) => {
    const zW8KontainerX = rr(- 620, - 480), zW8KontainerZ = rr(480, 620);
      const zW8MeshKontainer = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.4), new THREE.MeshStandardMaterial({
      color : pick(zW8PaletKontainer), roughness : 0.8
    })); zW8MeshKontainer.position.set (zW8KontainerX, ((zW8IdxKontainer % 3) * 2.6) + 1.3, zW8KontainerZ); zW8MeshKontainer.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2;
    zW8SceneQQQQQQQQQQQQ.add(zW8MeshKontainer); if (zW8IdxKontainer % 4 === 0) G.addCollider(zW8KontainerX, zW8KontainerZ, 6, 2, 3);
  }); const zW8MatDerek = new THREE.MeshStandardMaterial({
    color : 0xd97c2b, roughness : 0.7, metalness : 0.4
  }); [- 560, - 480].forEach((zW8DerekX) => {
    const zW8GrupDerek = new THREE.Group(); [- 1, 1].forEach((zW8TandaSisiQQQQQQQ) => {
      const zW8MeshKakiDerek = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), zW8MatDerek); zW8MeshKakiDerek.position.set (zW8TandaSisiQQQQQQQ * 8, 13, 0);
      zW8GrupDerek.add(zW8MeshKakiDerek);
    }); const zW8MeshBoomDerek = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 34), zW8MatDerek); zW8MeshBoomDerek.position.set (0, 26, 6);
    zW8GrupDerek.add(zW8MeshBoomDerek); const zW8MeshPalangAtasDerek = new THREE.Mesh(new THREE.BoxGeometry(17.4, 1.4, 1.4), zW8MatDerek);
    zW8MeshPalangAtasDerek.position.y = 26; zW8GrupDerek.add(zW8MeshPalangAtasDerek); zW8GrupDerek.position.set (zW8DerekX, 0, 540);
    zW8SceneQQQQQQQQQQQQ.add(zW8GrupDerek); G.addCollider(zW8DerekX, 540, 9, 3, 26);
  }); const zW8MatBollard = new THREE.MeshStandardMaterial({
    color : 0x333333
  }); for (let zW8IdxBollard = 0; zW8IdxBollard < 10; ++ zW8IdxBollard) {
    const zW8MeshBollard = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.8, 8), zW8MatBollard);
    zW8MeshBollard.position.set ((zW8IdxBollard * 16) - 640, 0.4, 648); zW8SceneQQQQQQQQQQQQ.add(zW8MeshBollard); } }
  function zW8ConstructTouge(G, zW8SceneQQQQQQQQQQQQQ) {

    const zW8TitikRuteMentah = TOUGE_POINTS.map((zW8TitikObjQQQQQ) => ({
    x : zW8TitikObjQQQQQ[0], z : zW8TitikObjQQQQQ[1]
  })); const zW8LebarPita = 9, zW8PusatLoopTouge = {
    x : - 330, z : - 470
  }; const zW8TexPitaTouge = zW8MakeCanvasTexture(128, 128, (zW8KuasQQQQQQQQQQQQQQQ, zW8LebarValQQQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQQQ) => {
    zW8KuasQQQQQQQQQQQQQQQ.fillStyle = '#33373d'; zW8KuasQQQQQQQQQQQQQQQ.fillRect(0, 0, zW8LebarValQQQQQQQQQQQQQ, zW8TinggiValQQQQQQQQQQQQQQQQ);
      for (let zW8IdxBintikQQQQQ = 0; zW8IdxBintikQQQQQ < 260; ++ zW8IdxBintikQQQQQ) {
      zW8KuasQQQQQQQQQQQQQQQ.fillStyle = 'rgba(255,255,255,.05)';
      zW8KuasQQQQQQQQQQQQQQQ.fillRect(rnd() * zW8LebarValQQQQQQQQQQQQQ, rnd() * zW8TinggiValQQQQQQQQQQQQQQQQ, 2, 2); }
    zW8KuasQQQQQQQQQQQQQQQ.fillStyle = '#f0ead0'; zW8KuasQQQQQQQQQQQQQQQ.fillRect(zW8LebarValQQQQQQQQQQQQQ * 0.03, 0, 3, zW8TinggiValQQQQQQQQQQQQQQQQ);
    zW8KuasQQQQQQQQQQQQQQQ.fillRect((zW8LebarValQQQQQQQQQQQQQ * 0.97) - 3, 0, 3, zW8TinggiValQQQQQQQQQQQQQQQQ);
    zW8KuasQQQQQQQQQQQQQQQ.fillRect((zW8LebarValQQQQQQQQQQQQQ / 2) - 2, 10, 4, 44);
  }); zW8TexPitaTouge.wrapS = THREE.ClampToEdgeWrapping; zW8TexPitaTouge.wrapT = THREE.RepeatWrapping; const zW8MatPitaTouge = new THREE.MeshStandardMaterial({
    map : zW8TexPitaTouge, roughness : 0.95, polygonOffset : true, polygonOffsetFactor : - 1, polygonOffsetUnits : - 1
  }); const zW8MatRelPengaman = new THREE.MeshStandardMaterial({
    color : 0xb0b6bc, metalness : 0.7, roughness : 0.4
  }); const zW8LarikPosPita = [], zW8LarikUvPita = [], zW8LarikIdxPita = [], zW8TitikTiangRel = []; let zW8PanjangKumulatif = 0;
    for (let zW8IdxSegQQQQQ = 0; zW8IdxSegQQQQQ < zW8TitikRuteMentah.length - 1; ++ zW8IdxSegQQQQQ) {
    const zW8SegTitikA = zW8TitikRuteMentah[zW8IdxSegQQQQQ], zW8SegTitikB = zW8TitikRuteMentah[zW8IdxSegQQQQQ + 1];
    const zW8DeltaSegXQQ = zW8SegTitikB.x - zW8SegTitikA.x, zW8DeltaSegZQQ = zW8SegTitikB.z - zW8SegTitikA.z;
    const zW8PanjangSegPita = Math.hypot(zW8DeltaSegXQQ, zW8DeltaSegZQQ) || 0.001;
    const zW8SatuanPitaX = zW8DeltaSegXQQ / zW8PanjangSegPita, zW8SatuanPitaZ = zW8DeltaSegZQQ / zW8PanjangSegPita, zW8TegakPitaX = - zW8SatuanPitaZ, zW8TegakPitaZ = zW8SatuanPitaX;
      const zW8TitikSudutPada = (zW8TitikObjQQQQQQ, zW8TandaSisiQQQQQQQQ) => {
      const zW8SudutXQ = (zW8TegakPitaX * zW8TandaSisiQQQQQQQQ * (zW8LebarPita / 2)) + zW8TitikObjQQQQQQ.x, zW8SudutZQ = (zW8TegakPitaZ * zW8TandaSisiQQQQQQQQ * (zW8LebarPita / 2)) + zW8TitikObjQQQQQQ.z;
        return {
        x : zW8SudutXQ, z : zW8SudutZQ, y : groundH(zW8SudutXQ, zW8SudutZQ) + 0.07 }; };
    const zW8Sudut00 = zW8TitikSudutPada(zW8SegTitikA, 1), zW8Sudut01 = zW8TitikSudutPada(zW8SegTitikA, - 1), zW8Sudut10 = zW8TitikSudutPada(zW8SegTitikB, 1), zW8Sudut11 = zW8TitikSudutPada(zW8SegTitikB, - 1);
    const zW8DasarVerteks = zW8LarikPosPita.length / 3;
    [zW8Sudut00, zW8Sudut01, zW8Sudut10, zW8Sudut11].forEach((zW8SudutObj) => zW8LarikPosPita.push(zW8SudutObj.x, zW8SudutObj.y, zW8SudutObj.z));
    zW8LarikUvPita.push(0, zW8PanjangKumulatif / 8, 1, zW8PanjangKumulatif / 8, 0, (zW8PanjangKumulatif + zW8PanjangSegPita) / 8, 1, (zW8PanjangKumulatif + zW8PanjangSegPita) / 8);
    zW8LarikIdxPita.push(zW8DasarVerteks, zW8DasarVerteks + 2, zW8DasarVerteks + 1, zW8DasarVerteks + 1, zW8DasarVerteks + 2, zW8DasarVerteks + 3);

    const zW8TengahSegX = (zW8SegTitikA.x + zW8SegTitikB.x) / 2, zW8TengahSegZ = (zW8SegTitikA.z + zW8SegTitikB.z) / 2;
    const zW8JarakSisiPlus = Math.hypot((zW8TengahSegX + zW8TegakPitaX * 5) - zW8PusatLoopTouge.x, (zW8TengahSegZ + zW8TegakPitaZ * 5) - zW8PusatLoopTouge.z);
    const zW8JarakSisiMinus = Math.hypot((zW8TengahSegX - zW8TegakPitaX * 5) - zW8PusatLoopTouge.x, (zW8TengahSegZ - zW8TegakPitaZ * 5) - zW8PusatLoopTouge.z);
    const zW8TandaSisiLuar = zW8JarakSisiPlus >= zW8JarakSisiMinus ? 1 : - 1;
    const zW8TitikLuar0 = zW8TandaSisiLuar > 0 ? zW8Sudut00 : zW8Sudut01, zW8TitikLuar1 = zW8TandaSisiLuar > 0 ? zW8Sudut10 : zW8Sudut11;
    const zW8MeshRelBaruQ = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, zW8PanjangSegPita), zW8MatRelPengaman);
    zW8MeshRelBaruQ.position.set ((zW8TitikLuar0.x + zW8TitikLuar1.x) / 2, ((zW8TitikLuar0.y + zW8TitikLuar1.y) / 2) + 0.55, (zW8TitikLuar0.z + zW8TitikLuar1.z) / 2);
    zW8MeshRelBaruQ.lookAt(zW8TitikLuar1.x, zW8TitikLuar1.y + 0.55, zW8TitikLuar1.z); zW8SceneQQQQQQQQQQQQQ.add(zW8MeshRelBaruQ);
      for (let zW8JarakTiang = 0; ! (zW8JarakTiang > zW8PanjangSegPita); zW8JarakTiang += 8) {
      const zW8FraksiTiang = zW8JarakTiang / zW8PanjangSegPita;
      const zW8TiangXQ = (zW8DeltaSegXQQ * zW8FraksiTiang) + zW8SegTitikA.x + zW8TegakPitaX * zW8TandaSisiLuar * ((zW8LebarPita / 2) + 0.3), zW8TiangZQ = (zW8DeltaSegZQQ * zW8FraksiTiang) + zW8SegTitikA.z + zW8TegakPitaZ * zW8TandaSisiLuar * ((zW8LebarPita / 2) + 0.3);
        zW8TitikTiangRel.push({
        x : zW8TiangXQ, z : zW8TiangZQ, y : groundH(zW8TiangXQ, zW8TiangZQ) }); }
    zW8PanjangKumulatif += zW8PanjangSegPita; }
  const zW8GeoPitaTouge = new THREE.BufferGeometry(); zW8GeoPitaTouge.setAttribute('position', new THREE.Float32BufferAttribute(zW8LarikPosPita, 3));
  zW8GeoPitaTouge.setAttribute('uv', new THREE.Float32BufferAttribute(zW8LarikUvPita, 2)); zW8GeoPitaTouge.setIndex(zW8LarikIdxPita);
  zW8GeoPitaTouge.computeVertexNormals(); zW8SceneQQQQQQQQQQQQQ.add(new THREE.Mesh(zW8GeoPitaTouge, zW8MatPitaTouge));

  const zW8InstTiangRel = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.62, 6), zW8MatRelPengaman, Math.max(1, zW8TitikTiangRel.length)); {
    const zW8Mat4Tiang = new THREE.Matrix4(); zW8TitikTiangRel.forEach((zW8TiangObj, zW8IdxTiang) => {
      zW8Mat4Tiang.makeTranslation(zW8TiangObj.x, zW8TiangObj.y + 0.31, zW8TiangObj.z); zW8InstTiangRel.setMatrixAt(zW8IdxTiang, zW8Mat4Tiang);
    }); zW8InstTiangRel.instanceMatrix.needsUpdate = true; }
  zW8SceneQQQQQQQQQQQQQ.add(zW8InstTiangRel);

    for (let zW8IdxPohonQ = 0; zW8IdxPohonQ < 12; ++ zW8IdxPohonQ) {
    const zW8TitikRute = zW8TitikRuteMentah[zW8IdxPohonQ % zW8TitikRuteMentah.length];
    const zW8TitikBerikut = zW8TitikRuteMentah[Math.min(zW8IdxPohonQ + 1, zW8TitikRuteMentah.length - 1)];
    const zW8DeltaPohonX = zW8TitikBerikut.x - zW8TitikRute.x, zW8DeltaPohonZ = zW8TitikBerikut.z - zW8TitikRute.z, zW8PanjangPohon = Math.hypot(zW8DeltaPohonX, zW8DeltaPohonZ) || 1;
    const zW8TandaSisiPohon = zW8IdxPohonQ % 2 === 0 ? 1 : - 1;
    const zW8PohonX = ((- zW8DeltaPohonZ / zW8PanjangPohon) * zW8TandaSisiPohon * rr(10, 13)) + zW8TitikRute.x, zW8PohonZ = ((zW8DeltaPohonX / zW8PanjangPohon) * zW8TandaSisiPohon * rr(10, 13)) + zW8TitikRute.z;
    const zW8PohonCeri = makeShadeTree(rr(3, 4.5), 0xe8a0bf); zW8PohonCeri.position.set (zW8PohonX, groundH(zW8PohonX, zW8PohonZ), zW8PohonZ);
    zW8PohonCeri.rotation.y = rr(0, 6.28); zW8SceneQQQQQQQQQQQQQ.add(zW8PohonCeri); } }
  export function roadRoute(G, zW8TitikAsal, zW8TitikTujuan) {
  const zW8JepretKoordinat = (zW8NilaiUjiQQ, zW8DaftarJalanQQ) => zW8DaftarJalanQQ.reduce((zW8KandidatA, zW8KandidatB) => Math.abs(zW8KandidatB - zW8NilaiUjiQQ) < Math.abs(zW8KandidatA - zW8NilaiUjiQQ) ? zW8KandidatB : zW8KandidatA, zW8DaftarJalanQQ[0]);
  const zW8AsalJepretX = zW8JepretKoordinat(zW8TitikAsal.x, G.roadX), zW8AsalJepretZ = zW8JepretKoordinat(zW8TitikAsal.z, G.roadZ);
  const zW8TujuanJepretX = zW8JepretKoordinat(zW8TitikTujuan.x, G.roadX), zW8TujuanJepretZ = zW8JepretKoordinat(zW8TitikTujuan.z, G.roadZ); const zW8DaftarTitikRute = [{
    x : zW8TitikAsal.x, z : zW8TitikAsal.z }, {
    x : zW8AsalJepretX, z : zW8TitikAsal.z }, {
    x : zW8AsalJepretX, z : zW8AsalJepretZ
  }];

    const zW8TitikSudutA = {
    x : zW8TujuanJepretX, z : zW8AsalJepretZ
    }, titikSudutB = {
    x : zW8AsalJepretX, z : zW8TujuanJepretZ
  }; const zW8JarakKakiA = Math.abs(zW8TujuanJepretX - zW8AsalJepretX) + Math.abs(zW8TujuanJepretZ - zW8AsalJepretZ), jarakKakiB = zW8JarakKakiA; void jarakKakiB;
    zW8DaftarTitikRute.push(zW8TitikSudutA, {
    x : zW8TujuanJepretX, z : zW8TujuanJepretZ }, {
    x : zW8TitikTujuan.x, z : zW8TitikTujuan.z
  }); void titikSudutB;

  return zW8DaftarTitikRute.filter((zW8TitikObjQQQQQQQ, zW8IdxTitikQQ) => zW8IdxTitikQQ === 0 || Math.hypot(zW8TitikObjQQQQQQQ.x - zW8DaftarTitikRute[zW8IdxTitikQQ - 1].x, zW8TitikObjQQQQQQQ.z - zW8DaftarTitikRute[zW8IdxTitikQQ - 1].z) > 1);
}
  function zW8TerapkanPijarSenja(G, zW8NilaiNeon, zW8NilaiGabungan, zW8NilaiGelapTanda) {
    if (G.buildingMats) G.buildingMats.forEach((zW8MatRef) => {
    zW8MatRef.emissiveIntensity = zW8NilaiGabungan * 0.7;
  }); if (G.neonTrimMats) G.neonTrimMats.forEach((zW8MatRefQ) => {
    zW8MatRefQ.emissiveIntensity = zW8NilaiNeon * 2.4;
  }); if (G.streetlightGlows) G.streetlightGlows.forEach((zW8SpriteObj) => {
    zW8SpriteObj.material.opacity = zW8NilaiGabungan * 0.85;
  }); if (G.lampHeadMat) G.lampHeadMat.emissiveIntensity = 0.15 + (zW8NilaiGabungan * 3.0); if (G.lampPoolMat) G.lampPoolMat.opacity = zW8NilaiGabungan * 0.3;
    zW8DaftarSpritePijar.forEach((zW8SpriteObjQ) => {
    zW8SpriteObjQ.material.opacity = zW8NilaiGelapTanda * 0.9; }); }
  export function updateWorld(G, zW8Dt) {
  const zW8JamSekarang = G.timeOfDay; const zW8LevelSiang = Math.max(0, Math.min(1, Math.sin(((zW8JamSekarang - 6) / 12) * Math.PI)));
  const zW8NilaiSenja = (Math.max(0, 1 - Math.abs(zW8JamSekarang - 18.2) / 1.6) * (zW8JamSekarang > 12 ? 1 : 0)) + (Math.max(0, 1 - Math.abs(zW8JamSekarang - 6.2) / 1.2) * 0.6);
  zW8ComputeSkyColors(zW8JamSekarang); if (zW8KubahLangit) {
      if (Math.abs(zW8JamSekarang - zW8JamLangitTerakhir) > 0.05) {
      zW8PaintSkyDome(); zW8JamLangitTerakhir = zW8JamSekarang; } } else {
    G.scene.background = zW8WarnaLangitHor; }
    if (G.scene.fog) {
    G.scene.fog.color.copy(zW8WarnaKabutLangit); }
    if (G.sun) {
    G.sun.intensity = (zW8LevelSiang * 1.27) + 0.25; G.sun.color.set (0xffd9b0); const zW8SudutMatahari = ((zW8JamSekarang - 6) / 12) * Math.PI;
    G.sun.position.set (Math.cos(zW8SudutMatahari) * 300, Math.max(20, Math.sin(zW8SudutMatahari) * 300), 120); }
    if (G.hemi) {
    G.hemi.intensity = (zW8LevelSiang * 0.65) + 0.25; if (G.hemi.color) G.hemi.color.copy(zW8WarnaLangitAtas).lerp(zW8WarnaLangitHangat, 0.3);
    if (G.hemi.groundColor) G.hemi.groundColor.set (0xb09a7a); }
  const zW8NilaiMalam = 1 - zW8LevelSiang;

  const zW8RampaAntara = (zW8BatasAwal, zW8BatasAkhir) => Math.max(0, Math.min(1, (zW8JamSekarang - zW8BatasAwal) / Math.max(0.001, zW8BatasAkhir - zW8BatasAwal)));
  const zW8PijarSenjaAmt = zW8JamSekarang >= VICE.dusk.onset && zW8JamSekarang < 24 ? Math.max(zW8RampaAntara(VICE.dusk.onset, VICE.dusk.full), zW8NilaiMalam) : zW8NilaiMalam;
  const zW8PijarNeonAmt = zW8JamSekarang >= VICE.dusk.neonOnset && zW8JamSekarang < 24 ? Math.max(zW8RampaAntara(VICE.dusk.neonOnset, VICE.dusk.full), zW8NilaiMalam) : zW8NilaiMalam;
  const zW8PijarGabungan = Math.max(zW8NilaiMalam, zW8PijarSenjaAmt);
  const zW8GelapTandaAmt = Math.min(1, (zW8PijarGabungan * 0.9) + (Math.min(1, Math.max(0, zW8NilaiSenja)) * 0.35));
  zW8TerapkanPijarSenja(G, zW8PijarNeonAmt, zW8PijarGabungan, zW8GelapTandaAmt); if (G.water) {
  const zW8AyunAir = Math.sin(G.elapsed || 0) * 0.03; G.water.position.y = zW8AyunAir - 0.4; } }
