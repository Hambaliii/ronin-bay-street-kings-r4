// Wave-8 pass: the dome, sun sprites and drifting cloud layer live here.
// Everything below was re-decomposed; the visible sky cycle is unchanged.
import * as THREE from 'three'; import {
  rr }
from './random.js';

  function zW8TeksturJatuhMatahari() {
  const zW8KanvasMth = document.createElement('canvas'); zW8KanvasMth.height = 256; zW8KanvasMth.width = zW8KanvasMth.height;
  const zW8KuasMth = zW8KanvasMth.getContext('2d'); const zW8RadialMth = zW8KuasMth.createRadialGradient(128, 128, 0, 128, 128, 128); const zW8DaftarHenti = [];
  zW8DaftarHenti.push([0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,244,214,0.95)']);
  zW8DaftarHenti.push([0.34, 'rgba(255,214,140,0.55)'], [0.62, 'rgba(255,178,102,0.18)']); zW8DaftarHenti.push([1, 'rgba(255,170,90,0)']);
  zW8DaftarHenti.forEach((zW8PasanganHenti) => zW8RadialMth.addColorStop(zW8PasanganHenti[0], zW8PasanganHenti[1])); zW8KuasMth.fillStyle = zW8RadialMth;
  zW8KuasMth.fillRect(0, 0, 256, 256); const zW8HasilMth = new THREE.CanvasTexture(zW8KanvasMth); zW8HasilMth.colorSpace = THREE.SRGBColorSpace; return zW8HasilMth; }

  function zW8TeksturGugusAwan(zW8IdxVarian) {
  const zW8KanvasAwn = document.createElement('canvas'); zW8KanvasAwn.width = 256; zW8KanvasAwn.height = 128; const zW8KuasAwn = zW8KanvasAwn.getContext('2d');
  let zW8StatusLcg = (zW8IdxVarian * 7919) + 1234567; const zW8UndiBerikut = () => {
    zW8StatusLcg = ((zW8StatusLcg * 1103515245) + 12345) & 0x7fffffff; return zW8StatusLcg / 0x7fffffff;
  }; const zW8JumlahGumpal = Math.floor(zW8UndiBerikut() * 4) + (7 + 0); let zW8UrutGumpal = 0;
  // Puffs are stamped one at a time until the per-variant quota is met.
  while (zW8UrutGumpal < zW8JumlahGumpal) {
    const zW8PusatGx = (zW8UndiBerikut() * 176) + 40, zW8PusatGy = (zW8UndiBerikut() * 36) + 48, zW8RadiusGr = (zW8UndiBerikut() * 30) + 22;
    const zW8RadialGumpal = zW8KuasAwn.createRadialGradient(zW8PusatGx, zW8PusatGy, 0, zW8PusatGx, zW8PusatGy, zW8RadiusGr);
    zW8RadialGumpal.addColorStop(1, 'rgba(255,255,255,0)'); zW8RadialGumpal.addColorStop(0, 'rgba(255,255,255,0.55)');
    zW8RadialGumpal.addColorStop(0.6, 'rgba(255,255,255,0.28)'); zW8KuasAwn.fillStyle = zW8RadialGumpal; zW8KuasAwn.beginPath();
    zW8KuasAwn.arc(zW8PusatGx, zW8PusatGy, zW8RadiusGr, 0, 2 * Math.PI); zW8KuasAwn.fill(); ++ zW8UrutGumpal; }
  const zW8HasilAwn = new THREE.CanvasTexture(zW8KanvasAwn); zW8HasilAwn.colorSpace = THREE.SRGBColorSpace; return zW8HasilAwn; }
const zW8WARNA_MTH_SIANG = new THREE.Color(0xfff6e8), zW8WARNA_KABUT_SIANG = new THREE.Color(0xdfeef2), zW8DASAR_DEKAT = 220, zW8DASAR_JAUH = 1500;
const zW8WARNA_MTH_TINGGI = new THREE.Color(0xfff3d0), zW8WARNA_MTH_RENDAH = new THREE.Color(0xff5f2e);
const zW8WARNA_PIJAR_RENDAH = new THREE.Color(0xff7a4d), zW8WARNA_AWAN_SIANG = new THREE.Color(0xffffff);

const zW8WARNA_AWAN_SENJA = new THREE.Color(0xff9e7a), zW8WARNA_AWAN_SENJA_UNGU = new THREE.Color(0xc08bd8);
const zW8WARNA_AWAN_MALAM = new THREE.Color(0x3d4a63), zW8WarnaCoret = new THREE.Color();

const zW8WARNA_KABUT_SENJA = new THREE.Color(0xff9e66), zW8WARNA_HEMI_SENJA = new THREE.Color(0xffb3c6), zW8WARNA_TANAH_SENJA = new THREE.Color(0x74506b);

const zW8WARNA_CANGKANG_BAWAH = new THREE.Color(0x2b1233), zW8WARNA_CANGKANG_HOR = new THREE.Color(0xff8b3d);
const zW8WARNA_CANGKANG_TENGAH = new THREE.Color(0xe0457b), zW8WARNA_CANGKANG_ATAS = new THREE.Color(0x2a1458);

const zW8DAFTAR_GRADIEN = [zW8WARNA_CANGKANG_HOR, zW8WARNA_CANGKANG_TENGAH, zW8WARNA_CANGKANG_ATAS], zW8REF_KABUT_SENJA = zW8WARNA_KABUT_SENJA;

  function zW8Jepit01(zW8NilaiMasukan) {
  return Math.max(0, Math.min(1, zW8NilaiMasukan)); }
  function zW8LangkahHalus(zW8TepiBawah, zW8TepiAtas, zW8NilaiUji) {
  const zW8RentangTepi = zW8TepiAtas - (zW8TepiBawah); const zW8PecahanMentah = zW8Jepit01((zW8NilaiUji - (zW8TepiBawah)) / zW8RentangTepi);
  const zW8KuadratPecahan = zW8PecahanMentah * zW8PecahanMentah; return zW8KuadratPecahan * (3 - (2 * zW8PecahanMentah)); }

  function zW8CatVertexCangkang(zW8GeoBola, zW8RadiusBola, zW8PewarnaFn) {
  const zW8AttrTitik = zW8GeoBola.attributes.position; const zW8SusunanRgb = [], zW8WarnaKerja = new THREE.Color(); Array.from ({
    length : zW8AttrTitik.count
    }).forEach((zW8KosongVal, zW8IdxTitik) => {
    zW8PewarnaFn(zW8WarnaKerja, zW8AttrTitik.getY(zW8IdxTitik) / zW8RadiusBola); zW8SusunanRgb.push(zW8WarnaKerja.r, zW8WarnaKerja.g, zW8WarnaKerja.b);
  }); return zW8SusunanRgb; }
  function zW8RakitMeshCangkang(zW8GeoBolaQ, zW8UrutanRender) {
    const zW8MatBola = new THREE.MeshBasicMaterial({
    vertexColors : true, side : THREE.BackSide, transparent : true, opacity : 0, depthWrite : false, fog : false
  }); const zW8MeshBola = new THREE.Mesh(zW8GeoBolaQ, zW8MatBola); zW8MeshBola.renderOrder = zW8UrutanRender; zW8MeshBola.visible = false; return zW8MeshBola; }
  function zW8BangunCangkangSenja() {
  const zW8GeoSenja = new THREE.SphereGeometry(1420, 32, 24); const zW8RgbSenja = zW8CatVertexCangkang(zW8GeoSenja, 1420, (zW8WarnaKerjaQ, zW8FraksiTinggi) => {
    zW8WarnaKerjaQ.lerpColors(zW8WARNA_CANGKANG_BAWAH, zW8DAFTAR_GRADIEN[0], zW8LangkahHalus(- 0.08, 0.015, zW8FraksiTinggi));
    zW8WarnaKerjaQ.lerp(zW8DAFTAR_GRADIEN[1], zW8LangkahHalus(0.03, 0.30, zW8FraksiTinggi));
    zW8WarnaKerjaQ.lerp(zW8DAFTAR_GRADIEN[2], zW8LangkahHalus(0.26, 0.62, zW8FraksiTinggi));
  }); zW8GeoSenja.setAttribute('color', new THREE.Float32BufferAttribute(zW8RgbSenja, 3)); return zW8RakitMeshCangkang(zW8GeoSenja, - 1); }

const zW8WARNA_UDARA_ATAS = new THREE.Color(0xcfe8f7), zW8WARNA_UDARA_HOR = new THREE.Color(0xfdf3e0), zW8OPASITAS_UDARA = 0.16;

  function zW8BangunCangkangUdaraSiang() {
  const zW8GeoUdara = new THREE.SphereGeometry(1440, 32, 24); const zW8RgbUdara = zW8CatVertexCangkang(zW8GeoUdara, 1440, (zW8WarnaKerjaQQ, zW8FraksiTinggiQ) => {
    zW8WarnaKerjaQQ.lerpColors(zW8WARNA_UDARA_HOR, zW8WARNA_UDARA_ATAS, zW8LangkahHalus(0.0, 0.55, zW8FraksiTinggiQ));
  }); zW8GeoUdara.setAttribute('color', new THREE.Float32BufferAttribute(zW8RgbUdara, 3)); return zW8RakitMeshCangkang(zW8GeoUdara, - 2); }
let zW8StatusLangit = null; export function initSky(G) {
    try {
    const zW8GrupLangitBaru = new THREE.Group(); zW8GrupLangitBaru.renderOrder = 1; const zW8KubahSenjaBaru = zW8BangunCangkangSenja();
    zW8GrupLangitBaru.add(zW8KubahSenjaBaru); const zW8KubahSiangBaru = zW8BangunCangkangUdaraSiang(); zW8GrupLangitBaru.add(zW8KubahSiangBaru);

    const zW8TexMthBaru = zW8TeksturJatuhMatahari(); const zW8BuatSpriteMth = (zW8WarnaSpr, zW8OpasSpr, zW8SkalaSpr, zW8AditifFlag) => {
        const zW8OpsiMat = {
        map : zW8TexMthBaru, color : zW8WarnaSpr, transparent : true, opacity : zW8OpasSpr, depthWrite : false, fog : false
      }; if (zW8AditifFlag) zW8OpsiMat.blending = THREE.AdditiveBlending; const zW8SprBaru = new THREE.Sprite(new THREE.SpriteMaterial(zW8OpsiMat));
      zW8SprBaru.scale.set (zW8SkalaSpr, zW8SkalaSpr, 1); zW8GrupLangitBaru.add(zW8SprBaru); return[zW8SprBaru, zW8SprBaru.material];
    }; const[zW8SprPijarBaru, zW8MatPijarBaru] = zW8BuatSpriteMth(0xffe9b8, 0.9, 340, true); zW8SprPijarBaru.scale.x = 340;
    const[zW8SprIntiBaru, zW8MatIntiBaru] = zW8BuatSpriteMth(0xffffff, 1, 95, false); zW8SprIntiBaru.scale.y = 95;

    const zW8DaftarMatVarian = []; let zW8IdxVarianAwal = 0;
      while (! (zW8IdxVarianAwal >= 3)) {
        zW8DaftarMatVarian.push(new THREE.SpriteMaterial({
        map : zW8TeksturGugusAwan(zW8IdxVarianAwal), color : 0xffffff, transparent : true, opacity : 0.82, depthWrite : false, fog : false
      })); ++ zW8IdxVarianAwal; }
    const zW8DaftarAwan = []; for (let zW8IdxAwanBaru = 0; zW8IdxAwanBaru < 16; ++ zW8IdxAwanBaru) {
      const zW8SprAwanBaru = new THREE.Sprite(zW8DaftarMatVarian[zW8IdxAwanBaru % 3]); const zW8LebarAwanBaru = rr(150, 300);
      zW8SprAwanBaru.scale.set (zW8LebarAwanBaru, zW8LebarAwanBaru * 0.42, 1); zW8SprAwanBaru.position.set (rr(- 820, 820), rr(150, 265), rr(- 820, 820));
      zW8GrupLangitBaru.add(zW8SprAwanBaru); const zW8RekAwanBaru = {
      }; zW8RekAwanBaru.spr = zW8SprAwanBaru; zW8RekAwanBaru.speed = rr(0.8, 1.9); zW8DaftarAwan.push(zW8RekAwanBaru); }
    G.scene.add(zW8GrupLangitBaru); const zW8RakitanBaru = {
    }; zW8RakitanBaru.group = zW8GrupLangitBaru; zW8RakitanBaru.sunGlow = zW8SprPijarBaru; zW8RakitanBaru.sunCore = zW8SprIntiBaru;
    zW8RakitanBaru.glowMat = zW8MatPijarBaru; zW8RakitanBaru.coreMat = zW8MatIntiBaru; zW8RakitanBaru.clouds = zW8DaftarAwan;
    zW8RakitanBaru.variants = zW8DaftarMatVarian; zW8RakitanBaru.dome = zW8KubahSenjaBaru; zW8RakitanBaru.dayDome = zW8KubahSiangBaru; zW8StatusLangit = zW8RakitanBaru;
    G.sky = zW8StatusLangit; } catch (e) {
 } }
  function zW8BobotSenjaUntuk(zW8JamNilai) {
  const zW8LenganPetang = Math.max(0, 1 + (- (Math.abs(zW8JamNilai - (18.2)) / 1.6))) * (! (zW8JamNilai > 12) ? 0 : 1);
  const zW8LenganFajar = Math.max(0, 1 + (- (Math.abs(zW8JamNilai - (6.2)) / 1.2))) * 0.6; return Math.max(0, Math.min(1, (zW8LenganPetang + zW8LenganFajar))); }
  function zW8PosisiMatahariUntuk(zW8SudutNilai, zW8ElevasiNilai, zW8JarakNilai) {
  const zW8KedekatanHorizon = Math.max(0, Math.min(1, 1 + (- (Math.abs(zW8ElevasiNilai) / 0.55)))); const zW8HasilPos = {
  }; zW8HasilPos.x = (Math.cos(zW8SudutNilai) * zW8JarakNilai) + 0; zW8HasilPos.y = zW8ElevasiNilai * zW8JarakNilai;
  zW8HasilPos.z = (0.38 + (zW8KedekatanHorizon * 0.30)) * zW8JarakNilai; zW8HasilPos.lowNear = zW8KedekatanHorizon; return zW8HasilPos; }
  function zW8TerapkanGradeSenja(G, zW8BobotNilai) {
  if (! zW8BobotNilai) return;

    const zW8KabutRef = (G.scene || {
  }).fog; if (zW8KabutRef) zW8KabutRef.color.lerp(zW8REF_KABUT_SENJA, zW8BobotNilai * 0.85);

    if (G.hemi) {
    G.hemi.intensity += zW8BobotNilai * 0.5; if (G.hemi.color) G.hemi.color.lerp(zW8WARNA_HEMI_SENJA, zW8BobotNilai * 0.45);
    if (G.hemi.groundColor) G.hemi.groundColor.lerp(zW8WARNA_TANAH_SENJA, zW8BobotNilai * 0.55); }

    if (G.sun) {
    G.sun.intensity += zW8BobotNilai * 0.3; G.sun.color.lerp(zW8WARNA_MTH_RENDAH, zW8BobotNilai * 0.45); } }
  function zW8TerapkanUdaraSiang(G, zW8BobotNilaiQ) {

  if (G.hemi) G.hemi.intensity += zW8BobotNilaiQ * 0.5;

    if (G.sun) {
    G.sun.intensity += zW8BobotNilaiQ * 0.35; if (G.sun.color) G.sun.color.lerp(zW8WARNA_MTH_SIANG, zW8BobotNilaiQ * 0.6); }
    const zW8KabutRefQ = (G.scene || {
  }).fog; if (zW8KabutRefQ) {

    zW8KabutRefQ.color.lerp(zW8WARNA_KABUT_SIANG, zW8BobotNilaiQ * 0.85); zW8KabutRefQ.near = zW8DASAR_DEKAT + (zW8BobotNilaiQ * 160);
    zW8KabutRefQ.far = zW8DASAR_JAUH + (zW8BobotNilaiQ * 700); }

  const zW8KubahSenjaRef = zW8StatusLangit.dome; if (zW8KubahSenjaRef) {
    zW8KubahSenjaRef.material.opacity *= (1 - (zW8BobotNilaiQ)); zW8KubahSenjaRef.visible = zW8KubahSenjaRef.material.opacity > 0.02; } }
  export function updateSky(G, zW8Dt) {
  if (! zW8StatusLangit) return; try {
    const zW8JamKini = G.timeOfDay || 10.5; const zW8TerangSiang = Math.max(0, Math.min(1, Math.sin(((zW8JamKini - (6)) / 12) * Math.PI)));
    const zW8BobotSenjaKini = zW8BobotSenjaUntuk(zW8JamKini); const zW8SudutKini = ((zW8JamKini - (6)) / 12) * Math.PI, zW8ElevasiKini = Math.sin(zW8SudutKini);

    const zW8KameraKini = G.camera; const zW8JangkarX = zW8KameraKini ? zW8KameraKini.position.x : 0, zW8JangkarZ = zW8KameraKini ? zW8KameraKini.position.z : 0;
    zW8StatusLangit.group.position.set (zW8JangkarX, 0, zW8JangkarZ);

    const zW8PosisiKini = zW8PosisiMatahariUntuk(zW8SudutKini, zW8ElevasiKini, 1150);
    [zW8StatusLangit.sunGlow, zW8StatusLangit.sunCore].forEach((zW8SprMth) => zW8SprMth.position.set (zW8PosisiKini.x, zW8PosisiKini.y, zW8PosisiKini.z));
    const zW8MasihTerlihat = zW8ElevasiKini > - 0.04; zW8StatusLangit.sunGlow.visible = zW8MasihTerlihat; zW8StatusLangit.sunCore.visible = zW8MasihTerlihat;
      if (zW8MasihTerlihat) {

      const zW8PudarKini = Math.max(0, Math.min(1, (zW8ElevasiKini + 0.04) / 0.22)); const zW8RendahKini = Math.max(0, Math.min(1, 1 + (- (zW8ElevasiKini / 0.55))));
      zW8WarnaCoret.lerpColors(zW8WARNA_MTH_TINGGI, zW8WARNA_MTH_RENDAH, zW8RendahKini);
      zW8StatusLangit.glowMat.color.copy(zW8WarnaCoret).lerp(zW8WARNA_PIJAR_RENDAH, zW8RendahKini * 0.55);
      zW8StatusLangit.coreMat.color.copy(zW8WarnaCoret).lerp(new THREE.Color(0xffffff), 0.45 + (zW8RendahKini * - 0.25));
      zW8StatusLangit.glowMat.opacity = zW8PudarKini * 0.9; zW8StatusLangit.coreMat.opacity = zW8PudarKini * 1.0;
      const zW8SkalaMembesar = (zW8RendahKini * 0.5) + (0 + 1); zW8StatusLangit.sunGlow.scale.set (zW8SkalaMembesar * 340, zW8SkalaMembesar * 340, 1); }

    const zW8KubahSenjaKini = zW8StatusLangit.dome; if (zW8KubahSenjaKini) {

      const zW8OpasKubahKini = Math.min(1, zW8BobotSenjaKini * 1.15) * 0.92; zW8KubahSenjaKini.material.opacity = zW8OpasKubahKini;
      zW8KubahSenjaKini.visible = zW8OpasKubahKini > 0.02; }
    zW8TerapkanGradeSenja(G, zW8BobotSenjaKini);

    const zW8BobotSiangKini = zW8LangkahHalus(10.5, 11.0, zW8JamKini) * (1 + (- zW8LangkahHalus(14.5, 15.0, zW8JamKini)));
    if (zW8BobotSiangKini > 0) zW8TerapkanUdaraSiang(G, zW8BobotSiangKini);
      else {
        const zW8KabutRefQQ = (G.scene || {
      }).fog; if (zW8KabutRefQQ && (zW8KabutRefQQ.near !== zW8DASAR_DEKAT || zW8KabutRefQQ.far !== zW8DASAR_JAUH)) {

        zW8KabutRefQQ.near = zW8DASAR_DEKAT; zW8KabutRefQQ.far = zW8DASAR_JAUH; } }

    const zW8KubahSiangKini = zW8StatusLangit.dayDome; if (zW8KubahSiangKini) {
      const zW8OpasUdaraKini = zW8BobotSiangKini * zW8OPASITAS_UDARA; zW8KubahSiangKini.material.opacity = zW8OpasUdaraKini;
      zW8KubahSiangKini.visible = zW8OpasUdaraKini > 0.01; }

    zW8WarnaCoret.copy(zW8WARNA_AWAN_MALAM).lerp(zW8WARNA_AWAN_SIANG, zW8TerangSiang); zW8StatusLangit.variants.forEach((zW8MatVarianKini, zW8IdxVarianKini) => {
      zW8MatVarianKini.color.copy(zW8WarnaCoret); if (zW8BobotSenjaKini > 0) {

        zW8MatVarianKini.color.lerp(! (zW8IdxVarianKini === 1) ? zW8WARNA_AWAN_SENJA : zW8WARNA_AWAN_SENJA_UNGU, (zW8BobotSenjaKini * 0.9) * Math.max(zW8TerangSiang, 0.45)); }

      if (zW8BobotSiangKini > 0) zW8MatVarianKini.color.lerp(zW8WARNA_AWAN_SIANG, zW8BobotSiangKini * 0.5);

      zW8MatVarianKini.opacity = Math.min(1, (0.28 + (zW8TerangSiang * 0.54)) + ((zW8BobotSenjaKini * 0.18) + (zW8BobotSiangKini * 0.10))); });

    const zW8LangkahAngin = ((zW8Dt || 0) * 1.4) + 0; zW8StatusLangit.clouds.forEach((zW8RekAwanKini) => {
      zW8RekAwanKini.spr.position.x += zW8RekAwanKini.speed * zW8LangkahAngin; if (zW8RekAwanKini.spr.position.x > 860) zW8RekAwanKini.spr.position.x = - 860; });
    } catch (e) {
 } }
