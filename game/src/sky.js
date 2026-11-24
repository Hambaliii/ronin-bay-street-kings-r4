// sky.js — billboard matahari, billboard awan yang melayang, dan
// satu pass grading senja ekstra berlapis di atas milik dunia
// sendiri. Grade itu menempel semata karena urutan panggil: loop
// utama membiarkan dunia menyegarkan diri lebih dulu dan menjalankan
// file ini sesudahnya, jadi nilai tarik kabut, angkat hemisphere,
// dan cangkang gradien apa pun yang ditulis di sinilah yang dipakai
// frame saat render. Semuanya menggantung pada jam bersama,
// tod = G.timeOfDay dalam jam: sudut matahari = ((tod - 6) / 12) * PI,
// daylight = clamp(sin(sudut), 0, 1), dan bobot senja hangat memuncak
// dekat 18.2 dengan gema lebih lemah dekat 6.2. Lapisan matahari dan
// awan mengikuti kamera di x/z; awan juga menumpang angin dan
// membungkus pada batas jangkar.
import * as THREE from 'three'; import { rr } from './random.js';
// Membangun tekstur jatuhan sprite matahari: bagian tengah putih
// membara, cincin hangat di sekelilingnya, dan pinggiran yang
// memudar sampai benar-benar bening.
function buildSunSpriteTexture() {
  const lembar = document.createElement('canvas'); lembar.width = lembar.height = 256;
  const sapu = lembar.getContext('2d');
  const gradasi = sapu.createRadialGradient(128, 128, 0, 128, 128, 128);
  const pasanganStop = [
    [0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,244,214,0.95)'], [0.34, 'rgba(255,214,140,0.55)'],
    [0.62, 'rgba(255,178,102,0.18)'], [1, 'rgba(255,170,90,0)'],
  ];
  for (const [posisiStop, warnaStop] of pasanganStop) gradasi.addColorStop(posisiStop, warnaStop);
  sapu.fillStyle = gradasi; sapu.fillRect(0, 0, 256, 256);
  const texJadi = new THREE.CanvasTexture(lembar); texJadi.colorSpace = THREE.SRGBColorSpace; return texJadi; }
// Membangun satu tekstur gugus awan: gumpalan radial lembut yang
// bertumpuk pada ubin lebar. Penempatan berjalan pada LCG privat
// yang disemai per varian, tak pernah pada RNG game bersama, supaya
// pembuatan tekstur tidak dapat mengganggu keacakan gameplay.
function buildCloudTexture(variantIdx) {
  const lembar = document.createElement('canvas'); lembar.height = 128; lembar.width = 256;
  const sapu = lembar.getContext('2d');
  let keadaanLcg = 1234567 + (variantIdx * 7919);
  const acakLanjut = () => { keadaanLcg = ((keadaanLcg * 1103515245) + 12345) & 0x7fffffff; return keadaanLcg / 0x7fffffff; };
  const banyakGumpal = 7 + Math.floor(acakLanjut() * 4);
  let urutGumpal = 0;
  while (urutGumpal < banyakGumpal) {
    const gxPos = 40 + (acakLanjut() * 176), gyPos = 48 + (acakLanjut() * 36), grRad = 22 + (acakLanjut() * 30);
    const gradGumpal = sapu.createRadialGradient(gxPos, gyPos, 0, gxPos, gyPos, grRad);
    gradGumpal.addColorStop(0, 'rgba(255,255,255,0.55)'); gradGumpal.addColorStop(0.6, 'rgba(255,255,255,0.28)');
    gradGumpal.addColorStop(1, 'rgba(255,255,255,0)');
    sapu.fillStyle = gradGumpal; sapu.beginPath(); sapu.arc(gxPos, gyPos, grRad, 0, 2 * Math.PI); sapu.fill(); ++urutGumpal; }
  const texJadi = new THREE.CanvasTexture(lembar); texJadi.colorSpace = THREE.SRGBColorSpace; return texJadi; }
const SUN_TINT_DAY = new THREE.Color(0xfff6e8), FOG_DAY = new THREE.Color(0xdfeef2), NEAR_BASE = 220, FAR_BASE = 1500;
const COL_SUN_HIGH = new THREE.Color(0xfff3d0), COL_SUN_LOW = new THREE.Color(0xff5f2e);
const COL_GLOW_LOW = new THREE.Color(0xff7a4d), COL_CLOUD_DAY = new THREE.Color(0xffffff);
// Palet senja pesisir neon: awan pink-oranye, satu varian ungu, dan
// matahari panas yang rendah dekat horizon.
const COL_CLOUD_DUSK = new THREE.Color(0xff9e7a), COL_CLOUD_DUSK_VIOLET = new THREE.Color(0xc08bd8);
const COL_CLOUD_NIGHT = new THREE.Color(0x3d4a63), scratchCol = new THREE.Color();
// Ke mana grade senja membidik: kabut menuju pink-oranye, isi
// hemisphere pink hangat, supaya dinding pastel mempertahankan
// warnanya saat cahaya memudar.
const COL_FOG_DUSK = new THREE.Color(0xff9e66), COL_HEMI_DUSK = new THREE.Color(0xffb3c6), COL_GROUND_DUSK = new THREE.Color(0x74506b);
// Pita vertex cangkang senja, dari bawah horizon ke atas.
const COL_SHELL_BELOW = new THREE.Color(0x2b1233), COL_SHELL_HOR = new THREE.Color(0xff8b3d);
const COL_SHELL_MID = new THREE.Color(0xe0457b), COL_SHELL_TOP = new THREE.Color(0x2a1458);
// Trio gradien ke atas plus nada kabut senja, dipakai bersama antara
// pembangun cangkang dan pembaruan per frame.
const GRADIENT_STOPS = [COL_SHELL_HOR, COL_SHELL_MID, COL_SHELL_TOP], FOG_DUSK_REF = COL_FOG_DUSK;
// Bidik hari cerah: kabut pucat lapang dan matahari tinggi putih
// hangat. Basis near/far kabut mencerminkan nilai pembuatan scene
// (Fog 220..1500); pass dunia mewarnai ulang kabut per frame tapi
// tak pernah menyentuh near/far sesudah pembuatan, jadi file ini
// boleh menetapkan dua nilai itu secara langsung.
const clamp01 = (masukan) => Math.min(1, Math.max(0, masukan));
function smoothstepFn(loEdge, hiEdge, val) { const pecahan = clamp01((val - loEdge) / (hiEdge - loEdge)); return (pecahan * pecahan) * (3 - (2 * pecahan)); }
// Cangkang senja: bola BackSide yang dicat vertex sebagai gradien
// senja vertikal — ungu di atas kepala, magenta, oranye, lalu ungu
// senja di bawah horizon. Radius 1420 bersarang di dalam cangkang
// dunia 1500 namun di luar sprite matahari pada 1150, dan
// renderOrder -1 di dalam grup langit menggambarnya mendahului
// pijar aditif matahari supaya cakram tetap panas di atasnya.
// Opacity mengikuti bobot senja tiap frame, yang menyembunyikan
// cangkang di luar jendela matahari terbenam.
function buildSunsetShell() {
  const geoBola = new THREE.SphereGeometry(1420, 32, 24), titikPos = geoBola.attributes.position;
  const daftarWarna = [], colSementara = new THREE.Color();
  for (let idxTitik = 0; idxTitik < titikPos.count; ++idxTitik) {
    const fraksiTinggi = titikPos.getY(idxTitik) / 1420;
    colSementara.lerpColors(COL_SHELL_BELOW, GRADIENT_STOPS[0], smoothstepFn(-0.08, 0.015, fraksiTinggi));
    colSementara.lerp(GRADIENT_STOPS[1], smoothstepFn(0.03, 0.30, fraksiTinggi)); colSementara.lerp(GRADIENT_STOPS[2], smoothstepFn(0.26, 0.62, fraksiTinggi));
    daftarWarna.push(colSementara.r, colSementara.g, colSementara.b); }
  geoBola.setAttribute('color', new THREE.Float32BufferAttribute(daftarWarna, 3));
  const matBola = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const meshBola = new THREE.Mesh(geoBola, matBola); meshBola.renderOrder = -1; meshBola.visible = false; return meshBola; }
// Stop cangkang udara siang: biru pucat hampir putih di puncak
// melarut menjadi krem hangat di horizon — udara siang yang terang.
const COL_SHELL_DAY_TOP = new THREE.Color(0xcfe8f7), COL_SHELL_DAY_HOR = new THREE.Color(0xfdf3e0), SHELL_DAY_OPACITY = 0.16;
// Cangkang gradien pendamping dalam tumpukan overlay yang sama:
// bola BackSide, krem di horizon yang naik menjadi biru pucat di
// zenit (di bawah horizon ia sekadar mempertahankan nada horizon,
// yang toh disembunyikan tanah). Radius 1440 duduk di dalam
// cangkang dunia 1500 dan di luar cangkang senja pada 1420;
// renderOrder -2 menggambarnya paling dulu, tepat di atas kubah
// dunia dan di bawah grade senja, jadi saat senja cangkang senja
// menutupinya — dan opacity-nya nol di sana, karena jendela siang
// dan senja tak pernah tumpang tindih.
function buildDayAirShell() {
  const geoBola = new THREE.SphereGeometry(1440, 32, 24), titikPos = geoBola.attributes.position;
  const daftarWarna = [], colSementara = new THREE.Color();
  let idxTitik = 0;
  while (idxTitik < titikPos.count) {
    const fraksiTinggi = titikPos.getY(idxTitik) / 1440;
    colSementara.lerpColors(COL_SHELL_DAY_HOR, COL_SHELL_DAY_TOP, smoothstepFn(0.0, 0.55, fraksiTinggi));
    daftarWarna.push(colSementara.r, colSementara.g, colSementara.b); ++idxTitik; }
  geoBola.setAttribute('color', new THREE.Float32BufferAttribute(daftarWarna, 3));
  const matBola = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false });
  const meshBola = new THREE.Mesh(geoBola, matBola); meshBola.renderOrder = -2; meshBola.visible = false; return meshBola; }
let skyState = null;
export function initSky(G) { try {
    const grupLangit = new THREE.Group(); grupLangit.renderOrder = 1;
    const kubahSenja = buildSunsetShell(); grupLangit.add(kubahSenja);
    const kubahSiang = buildDayAirShell(); grupLangit.add(kubahSiang);
    // Matahari adalah dua billboard: satu pijar lebar, satu inti panas yang rapat.
    const texMatahari = buildSunSpriteTexture();
    const matPijarMth = new THREE.SpriteMaterial({ map: texMatahari, color: 0xffe9b8, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const sprPijarMth = new THREE.Sprite(matPijarMth); sprPijarMth.scale.set(340, 340, 1);
    const matIntiMth = new THREE.SpriteMaterial({ map: texMatahari, color: 0xffffff, transparent: true, opacity: 1, depthWrite: false, fog: false });
    const sprIntiMth = new THREE.Sprite(matIntiMth); sprIntiMth.scale.set(95, 95, 1);
    grupLangit.add(sprPijarMth); grupLangit.add(sprIntiMth);
    // Sekitar enam belas billboard awan berbagi tiga varian tekstur,
    // jadi penulisan nada per frame menyentuh tiga material, bukan sprite.
    const matVarianList = [];
    for (let idxVarian = 0; idxVarian < 3; ++idxVarian)
      matVarianList.push(new THREE.SpriteMaterial({ map: buildCloudTexture(idxVarian), color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, fog: false }));
    const awanList = [];
    for (let idxAwan = 0; idxAwan < 16; ++idxAwan) {
      const sprAwan = new THREE.Sprite(matVarianList[idxAwan % 3]);
      const lebarAwan = rr(150, 300);
      sprAwan.scale.set(lebarAwan, lebarAwan * 0.42, 1);
      sprAwan.position.set(rr(-820, 820), rr(150, 265),
        rr(-820, 820));
      grupLangit.add(sprAwan);
      const rekAwan = {}; rekAwan.spr = sprAwan; rekAwan.speed = rr(0.8, 1.9); awanList.push(rekAwan); }
    G.scene.add(grupLangit);
    const rakitanLangit = {};
    rakitanLangit.group = grupLangit; rakitanLangit.sunGlow = sprPijarMth; rakitanLangit.sunCore = sprIntiMth;
    rakitanLangit.glowMat = matPijarMth; rakitanLangit.coreMat = matIntiMth; rakitanLangit.clouds = awanList;
    rakitanLangit.variants = matVarianList; rakitanLangit.dome = kubahSenja; rakitanLangit.dayDome = kubahSiang;
    skyState = rakitanLangit; G.sky = skyState;
  } catch (e) { /* hiasan langit boleh gagal dalam diam; kubah dasar tetap muncul */ } }
function duskWeightFor(jamTod) {
  const bagianPetang = Math.max(0, 1 - (Math.abs(jamTod - 18.2) / 1.6)) * (jamTod > 12 ? 1 : 0);
  const bagianFajar = Math.max(0, 1 - (Math.abs(jamTod - 6.2) / 1.2)) * 0.6;
  return Math.min(1, Math.max(0, (bagianPetang + bagianFajar))); }
function sunPositionFor(sudutMth, elevasiMth, jarakMth) {
  const kedekatanRendah = Math.min(1, Math.max(0, 1 - (Math.abs(elevasiMth) / 0.55)));
  const hasilPosisi = {};
  hasilPosisi.x = Math.cos(sudutMth) * jarakMth; hasilPosisi.y = elevasiMth * jarakMth;
  hasilPosisi.z = (0.38 + (kedekatanRendah * 0.30)) * jarakMth; hasilPosisi.lowNear = kedekatanRendah;
  return hasilPosisi; }
function applyDuskGrade(G, bobotSenja) {
  if (!bobotSenja) return;
  // Kabut: tarik campuran yang sedang menuju cokelat-abu itu kembali
  // ke pink-oranye horizon, supaya kabut kejauhan cocok dengan pita
  // horizon gradien.
  if (G.scene && G.scene.fog) G.scene.fog.color.lerp(FOG_DUSK_REF,
    bobotSenja * 0.85);
  // Isi hemisphere: pass dunia menskalakan hemi menurut daylight
  // (sekitar 0.03 pada 17.9, intensitas dekat 0.27) — gantikan isi
  // senja pink hangat dan pantulan tanah mauve untuk cokelat-abu
  // itu, supaya tanah dan dinding pastel memegang warna alih-alih menggelap.
  if (G.hemi) { G.hemi.intensity += bobotSenja * 0.5;
    if (G.hemi.color) G.hemi.color.lerp(COL_HEMI_DUSK, bobotSenja * 0.45);
    if (G.hemi.groundColor) G.hemi.groundColor.lerp(COL_GROUND_DUSK, bobotSenja * 0.55); }
  // Cahaya kunci: sentuhan lagi matahari hangat, supaya sisi
  // bulevar pada sisi cakram rendah tetap memodelkan mobil dan dinding saat senja.
  if (G.sun) { G.sun.intensity += bobotSenja * 0.3;
    G.sun.color.lerp(COL_SUN_LOW, bobotSenja * 0.45); } }
function applyDayAir(G, bobotSiang) {
  // Isi hemisphere: nilai tengah hari dunia adalah 0.25 + 0.65 =
  // 0.90; angkat +0.5 itulah yang membuat dinding pastel dan jalan
  // pucat terbaca terang dan lapang ketimbang datar tengah hari.
  if (G.hemi) G.hemi.intensity += 0.5 * bobotSiang;
  // Matahari tinggi: lebih kuat, dinadakan putih hangat (tak pernah oranye pada tengah hari).
  if (G.sun) { G.sun.intensity += 0.35 * bobotSiang;
    if (G.sun.color) G.sun.color.lerp(SUN_TINT_DAY, bobotSiang * 0.6); }
  if (G.scene && G.scene.fog) {
    // Kabut pucat lapang, didorong jauh ke luar supaya bulevar tetap tajam.
    G.scene.fog.color.lerp(FOG_DAY, bobotSiang * 0.85);
    G.scene.fog.near = NEAR_BASE + (bobotSiang * 160); G.scene.fog.far = FAR_BASE + (bobotSiang * 700); }
  // Hari yang terang tak boleh sekali-kali tercuci pink oleh cangkang senja.
  if (skyState.dome) { skyState.dome.material.opacity *= (1 - bobotSiang);
    skyState.dome.visible = skyState.dome.material.opacity > 0.02; } }
export function updateSky(G, dt) { if (!skyState) return; try {
    const jamTod = G.timeOfDay || 10.5;
    const terangHari = Math.min(1, Math.max(0, Math.sin(((jamTod - 6) / 12) * Math.PI)));
    const bobotSenja = duskWeightFor(jamTod);
    const sudutMth = ((jamTod - 6) / 12) * Math.PI, elevasiMth = Math.sin(sudutMth);
    // Pasang seluruh grup langit pada kamera, supaya arah matahari
    // dan tutupan awan terbaca sama dari mana pun di dalam kota.
    const kameraRef = G.camera, titikJangkarX = kameraRef ? kameraRef.position.x : 0, titikJangkarZ = kameraRef ? kameraRef.position.z : 0, titikJangkarY = 0;
    skyState.group.position.set(titikJangkarX, titikJangkarY, titikJangkarZ);
    // Cakram matahari meminjam keluarga azimut/elevasi cahaya
    // matahari dunia sendiri (z dimiringkan menuju +120/300, jadi
    // cakram menggantung di atas atap ketimbang duduk pada sumbu).
    // Laut terletak pada sisi +Z dunia (bidang pantai pada z +610),
    // jadi bias z membesar saat matahari tenggelam: matahari yang
    // rendah berakhir di atas perairan ketimbang di belakang skyline.
    const jarakMth = 1150, posisiMth = sunPositionFor(sudutMth, elevasiMth, jarakMth);
    skyState.sunGlow.position.set(posisiMth.x, posisiMth.y, posisiMth.z); skyState.sunCore.position.set(posisiMth.x, posisiMth.y, posisiMth.z);
    const masihDiAtas = elevasiMth > -0.04; skyState.sunGlow.visible = masihDiAtas; skyState.sunCore.visible = masihDiAtas;
    if (masihDiAtas) {
      // Cakram memudar tepat pada horizon dan menghangat saat ia tenggelam.
      const pudarHorizon = Math.min(1, Math.max(0, (elevasiMth + 0.04) / 0.22));
      const bobotRendah = Math.min(1, Math.max(0, 1 - (elevasiMth / 0.55)));
      scratchCol.lerpColors(COL_SUN_HIGH, COL_SUN_LOW, bobotRendah);
      skyState.glowMat.color.copy(scratchCol).lerp(COL_GLOW_LOW, bobotRendah * 0.55);
      skyState.coreMat.color.copy(scratchCol).lerp(new THREE.Color(0xffffff), 0.45 - (bobotRendah * 0.25));
      skyState.glowMat.opacity = 0.9 * pudarHorizon; skyState.coreMat.opacity = 1.0 * pudarHorizon;
      const faktorMembesar = 0 + 1 + (bobotRendah * 0.5);
      skyState.sunGlow.scale.set(340 * faktorMembesar, 340 * faktorMembesar, 1); }
    // Grade senja berjalan sesudah pass dunia sendiri dalam loop
    // utama, jadi koreksi inilah yang bertahan sampai render: dunia
    // menulis kabut/hemi/matahari dari keyframe-nya lebih dulu, pass
    // ini menyesuaikannya, dan tidak ada yang terakumulasi.
    if (skyState.dome) {
      // Overlay matahari terbenam: menentukan dekat 18.1, lenyap pada siang dan pada malam.
      const opasitasKubah = Math.min(1, bobotSenja * 1.15) * 0.92;
      skyState.dome.material.opacity = opasitasKubah; skyState.dome.visible = opasitasKubah > 0.02; }
    applyDuskGrade(G, bobotSenja);
    // Udara siang yang terang dan lapang. Jendela halus di atas
    // tod [10.5, 15]: nol di luar, merangkak masuk pada 11.0, ditahan
    // pada satu melintasi [11, 14.5] dan lenyap pada 15.0. Bobot
    // senja hanya bukan nol dari sekitar 16.6 (puncak 18.2, lebar
    // 1.6) dan yang pagi berakhir dekat 7.4, jadi dua jendela itu tak
    // pernah tumpang tindih atau bertarung memperebutkan kontrol yang sama.
    const bobotSiang = smoothstepFn(10.5, 11.0, jamTod) * (1 - smoothstepFn(14.5, 15.0, jamTod));
    if (bobotSiang > 0) applyDayAir(G, bobotSiang);
    else if (G.scene && G.scene.fog &&
        (G.scene.fog.near !== NEAR_BASE || G.scene.fog.far !== FAR_BASE)) {
      // Di luar jendela siang, kembalikan jarak kabut kepada nilai
      // basis (grade senja hanya pernah menyentuh warna kabut, jadi
      // tidak ada di sini yang berkonflik dengannya).
      G.scene.fog.near = NEAR_BASE; G.scene.fog.far = FAR_BASE; }
    // Overlay udara siang: opacity mengikuti jendela siang dengan
    // tepat — 0.16 pada siang penuh; pada bobot nol cangkang
    // tersembunyi sepenuhnya, yang membiarkan jalur malam dan senja tak tersentuh.
    if (skyState.dayDome) {
      const opasitasUdara = SHELL_DAY_OPACITY * bobotSiang;
      skyState.dayDome.material.opacity = opasitasUdara; skyState.dayDome.visible = opasitasUdara > 0.01; }
    // Nada awan: putih dalam cahaya siang, pink/oranye pada senja,
    // dan biru-abu redup begitu malam jatuh.
    scratchCol.copy(COL_CLOUD_NIGHT).lerp(COL_CLOUD_DAY, terangHari);
    for (let idxVarian = 0; idxVarian < skyState.variants.length; ++idxVarian) {
      const matVarian = skyState.variants[idxVarian];
      matVarian.color.copy(scratchCol);
      if (bobotSenja > 0) {
        // Varian tengah condong ke ungu sementara sisanya pergi ke
        // pink-oranye jenuh; bersama-sama mereka terbaca sebagai
        // matahari terbenam pesisir neon.
        matVarian.color.lerp(idxVarian === 1 ? COL_CLOUD_DUSK_VIOLET : COL_CLOUD_DUSK, (bobotSenja * 0.9) * Math.max(terangHari, 0.45)); }
      // Pada siang penuh, tarik nada sisa perjalanan menuju putih
      // murni dan angkat opacity sedikit, supaya sprite terbaca
      // putih terang melawan cangkang udara siang yang pucat
      // ketimbang campuran lebih abu yang akan ditinggalkan bobot siang sendirian.
      if (bobotSiang > 0) matVarian.color.lerp(COL_CLOUD_DAY, bobotSiang * 0.5);
      // Samar pada malam, penuh pada siang, dengan angkat senja
      // supaya awan pink tetap terbaca melawan grade hangat.
      matVarian.opacity = Math.min(1,
        0.28 + (terangHari * 0.54) + (bobotSenja * 0.18) + (bobotSiang * 0.10)); }
    // Awan hanyut perlahan searah angin (+x) dan membungkus pada
    // batas yang berjangkar kepada kamera.
    const langkahHanyut = (dt || 0) * 1.4;
    for (const rekAwan of skyState.clouds) { rekAwan.spr.position.x += rekAwan.speed * langkahHanyut;
      if (rekAwan.spr.position.x > 860) rekAwan.spr.position.x = -860; }
  } catch (e) { /* kegagalan langit tak boleh sekali-kali mematahkan frame */ } }
