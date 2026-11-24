// cars.js — pabrik yang mengekstrusi badan mobil dari bentuk profil
// samping, pertukaran visual GLB untuk kendaraan polisi / sedan /
// taksi / hero, arus lalu lintas, asap kerusakan, dan rig lampu
// depan malam hari.
import * as THREE from 'three'; import { CARS } from './config.js';
import { rnd, rr, ri, pick } from './random.js'; import { groundH, glowSprite } from './world.js';
import { loadHeroAsset } from './assets.js';
const HEX_DIGITS = 6;
// Memformat warna numerik menjadi string css '#rrggbb' (HEX_DIGITS
// ialah hitungan digit yang dibawa string semacam itu).
const hexCss = (angkaHex) => '#' + angkaHex.toString(16).padStart(HEX_DIGITS, '0');
// Siluet samping sebuah badan mobil. x lokal berjalan dari -len/2
// (ekor) ke +len/2 (hidung, di +x sebelum rotasi); y ialah tinggi.
function tinggiBadanUntuk(specRef) {
  const kelas = specRef.body;
  if (kelas === 'suv' || kelas === 'van') return 1.55;
  if (kelas === 'truck') return 1.5;
  if (kelas === 'kei') return 1.4;
  const tambahanSedan = (kelas === 'sedan' || kelas === 'wagon') ? 0.18 : 0;
  return 1.05 + tambahanSedan; }
function bodyOutline(specRef) {
  const panjangPenuh = specRef.len, setengahPanjang = panjangPenuh / 2;
  const tinggiBadan = tinggiBadanUntuk(specRef);
  const garisKap = 0.62 + (specRef.hood * 0.28), garisSabuk = tinggiBadan * 0.72;
  const bentuk = new THREE.Shape();
  bentuk.moveTo(-setengahPanjang + 0.12, 0.18);
  bentuk.quadraticCurveTo(-setengahPanjang + -0.02, 0.3, -setengahPanjang, garisSabuk * 0.8);
  const atapDatarFlag = specRef.roof === 'wagon' || specRef.body === 'van' || specRef.body === 'suv';
  if (atapDatarFlag) {
    bentuk.quadraticCurveTo(-setengahPanjang, tinggiBadan * 0.97, -setengahPanjang + 0.3, tinggiBadan);
    bentuk.lineTo(setengahPanjang * (0.2 + (specRef.cabin * 0.2)), tinggiBadan);
    bentuk.quadraticCurveTo(setengahPanjang * 0.75, tinggiBadan * 0.96, setengahPanjang * 0.88, garisKap + 0.1);
  } else if (specRef.roof === 'hatch') {
    bentuk.quadraticCurveTo(-setengahPanjang + 0.05, tinggiBadan * 0.92, -setengahPanjang + 0.35, tinggiBadan * 0.98);
    bentuk.quadraticCurveTo(-setengahPanjang + (panjangPenuh * 0.28), tinggiBadan, -setengahPanjang + (panjangPenuh * (0.32 + (specRef.cabin * 0.18))), tinggiBadan * 0.99);
    bentuk.quadraticCurveTo(setengahPanjang * 0.72, tinggiBadan * 0.9, setengahPanjang * 0.86, garisKap + 0.08);
  } else if (specRef.roof === 'fastback') {
    bentuk.bezierCurveTo(-setengahPanjang + 0.1, garisSabuk, -setengahPanjang + (panjangPenuh * 0.3), tinggiBadan * 0.99, -setengahPanjang + (panjangPenuh * (0.34 + (specRef.cabin * 0.16))), tinggiBadan);
    bentuk.quadraticCurveTo(setengahPanjang * 0.55, tinggiBadan * 0.97, setengahPanjang * 0.84, garisKap + 0.06);
  } else {
    bentuk.quadraticCurveTo(-setengahPanjang + (panjangPenuh * 0.18), tinggiBadan * 0.99, -setengahPanjang + (panjangPenuh * (0.3 + (specRef.cabin * 0.16))), tinggiBadan);
    bentuk.quadraticCurveTo(setengahPanjang * 0.45, tinggiBadan * 0.98, setengahPanjang * 0.8, garisKap + 0.1);
    if (specRef.body === 'sedan' || specRef.body === 'roadster') bentuk.quadraticCurveTo(setengahPanjang * 0.9, garisKap + 0.04, setengahPanjang * 0.94, garisKap); }
  bentuk.quadraticCurveTo(setengahPanjang + 0.04, garisKap * 0.72, setengahPanjang, 0.42);
  bentuk.quadraticCurveTo(setengahPanjang + -0.02, 0.2, setengahPanjang - 0.3, 0.18);
  bentuk.lineTo(-setengahPanjang + 0.12, 0.18);
  const dataDim = {}; dataDim.tall = tinggiBadan; dataDim.hoodY = garisKap; dataDim.beltY = garisSabuk;
  bentuk.userData = dataDim;
  return bentuk; }
// Siluet rumah kaca, berbagi matematika tinggi dengan badan.
function glassOutline(specRef) {
  const panjangPenuh = specRef.len, setengahPanjang = panjangPenuh / 2;
  const tinggiBadan = specRef.body === 'suv' || specRef.body === 'van' ? 1.55
    : specRef.body === 'truck' ? 1.5
    : specRef.body === 'kei' ? 1.4
    : 1.05 + (specRef.body === 'sedan' || specRef.body === 'wagon' ? 0.18 : 0);
  const garisSabuk = tinggiBadan * 0.72;
  const tepiBelakangX = (specRef.roof === 'wagon' || specRef.body === 'van' || specRef.body === 'suv') ? -setengahPanjang + 0.35
    : specRef.roof === 'hatch' ? -setengahPanjang + 0.55
    : -setengahPanjang + (panjangPenuh * (0.30 + (specRef.cabin * 0.14)));
  const tepiDepanX = (specRef.roof === 'flat' && !(specRef.body === 'kei')) ? setengahPanjang * 0.52 : setengahPanjang * (0.35 + (specRef.cabin * 0.15));
  const bentuk = new THREE.Shape();
  bentuk.moveTo(tepiBelakangX, garisSabuk);
  bentuk.quadraticCurveTo(tepiBelakangX + 0.25, tinggiBadan * 0.99, tepiBelakangX + (panjangPenuh * 0.18), tinggiBadan * 0.985);
  bentuk.quadraticCurveTo(tepiDepanX - 0.2, tinggiBadan * 0.97, tepiDepanX, garisSabuk + 0.04);
  bentuk.lineTo(tepiBelakangX, garisSabuk);
  return bentuk; }
// Mengekstrusi garis samping melintasi lebar mobil, lalu memutar
// hasilnya supaya x bentuk (panjang) menunjuk sepanjang +Z (maju)
// dan lebar ekstrusi terletak sepanjang X.
const extrudeProfile = (bentukProfil, nilaiLebar, tebalBevel, ukuranBevel) => {
  const kedalaman = Math.max(0.2, nilaiLebar - (ukuranBevel * 2));
  const geoHasil = new THREE.ExtrudeGeometry(bentukProfil, { depth: kedalaman, bevelEnabled: true, bevelThickness: tebalBevel, bevelSize: ukuranBevel, bevelSegments: 3, steps: 1, curveSegments: 12 });
  geoHasil.translate(0, 0, -nilaiLebar / 2 + ukuranBevel); geoHasil.rotateY(Math.PI / 2);
  return geoHasil; };
// Mengecat livery sisi (tulisan polisi / taksi / hero) ke tekstur
// kanvas transparan.
function buildLiveryTexture(jenisLivery, hexCatTakDipakai) {
  const kanvas = document.createElement('canvas'); kanvas.width = 512; kanvas.height = 128;
  const kuas = kanvas.getContext('2d');
  kuas.clearRect(0, 0, 512, 128);
  const lukisPolisi = () => {
    kuas.fillStyle = '#f4f6f8'; kuas.fillRect(90, 18, 330, 78);
    kuas.fillStyle = '#1c4f9c'; kuas.fillRect(0, 78, 512, 16);
    kuas.fillStyle = '#14161a'; kuas.font = 'bold 52px sans-serif'; kuas.textAlign = 'center'; kuas.fillText('RBPD', 256, 72);
    kuas.fillStyle = '#c8a028'; kuas.beginPath(); kuas.arc(120, 56, 20, 0, 6.3); kuas.fill(); };
  const lukisTaksi = () => {
    for (let selX = 0; selX < 512; selX += 24) for (let selY = 0; selY < 2; ++selY) { kuas.fillStyle = !((selX / 24 + selY) % 2) ? '#f4f6f8' : '#14161a'; kuas.fillRect(selX, 52 + (selY * 14), 24, 14); } };
  const lukisMenurutJenis = {
    'police': lukisPolisi,
    'taxi': lukisTaksi,
    'hero-supra': () => { kuas.fillStyle = '#14161a'; kuas.font = 'bold 26px sans-serif'; kuas.textAlign = 'center'; kuas.fillText('TEN-SECOND', 256, 66); },
    'hero-gtr': () => { kuas.fillStyle = '#c8ccd2'; kuas.fillRect(0, 56, 512, 14); kuas.fillStyle = '#14161a'; kuas.font = 'bold 24px sans-serif'; kuas.textAlign = 'center'; kuas.fillText('BAYSIDE GHOST', 256, 46); },
  };
  if (lukisMenurutJenis[jenisLivery]) lukisMenurutJenis[jenisLivery]();
  void hexCatTakDipakai;
  const hasilTex = new THREE.CanvasTexture(kanvas); hasilTex.colorSpace = THREE.SRGBColorSpace; return hasilTex; }
export function makeCarMesh(spec, paintHex, opts) {
  opts = opts || {};
  const warnaCat = paintHex != null ? paintHex : spec.color;
  const grupMobil = new THREE.Group();
  const panjangSpec = spec.len, lebarSpec = spec.wid;
  const trukFlag = spec.body === 'truck';
  const varianKab = trukFlag ? { ...spec, len: 2.2 } : spec;
  const geoBadan = extrudeProfile(bodyOutline(varianKab), lebarSpec, 0.09, 0.07);
  const matCatBadan = new THREE.MeshStandardMaterial({ color: warnaCat, metalness: 0.55, roughness: 0.35 });
  const meshBadan = new THREE.Mesh(geoBadan, matCatBadan);
  grupMobil.add(meshBadan);
  if (spec.twoTone) {
    const geoTrim = new THREE.BoxGeometry(lebarSpec * 0.99, 0.34, panjangSpec * 0.98);
    const meshTrim = new THREE.Mesh(geoTrim, new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.4, roughness: 0.5 }));
    meshTrim.position.y = 0.3; grupMobil.add(meshTrim); }
  if (trukFlag) {
    const matKargo = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.7 });
    const geoKargo = new THREE.BoxGeometry(lebarSpec, 2.1, 3.9);
    // Kotak atas yang sedikit lebih kecil memalsukan bevel pada blok kargo.
    const meshKargo = new THREE.Mesh(geoKargo, matKargo);
    meshKargo.position.set(0, 1.45, -1.15); grupMobil.add(meshKargo);
    const geoGaris = new THREE.PlaneGeometry(lebarSpec * 0.7, 1.6);
    const meshGaris = new THREE.Mesh(geoGaris, new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.5 }));
    meshGaris.position.set(0, 1.45, -3.11); meshGaris.rotation.y = Math.PI; grupMobil.add(meshGaris);
    meshBadan.position.z = (panjangSpec / 2) + -1.1; }
  // Rumah kaca (berwarna gelap).
  const matKaca = new THREE.MeshStandardMaterial({ color: 0x10151c, metalness: 0.9, roughness: 0.12 });
  const meshKaca = new THREE.Mesh(extrudeProfile(glassOutline(varianKab), lebarSpec * 0.86, 0.05, 0.04), matKaca);
  if (trukFlag) meshKaca.position.z = (panjangSpec / 2) + -1.1;
  grupMobil.add(meshKaca);
  // Bemper plus skirt samping, dalam satu material trim gelap bersama.
  const matTrim = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.7 });
  const pasangBemperSkirt = (tandaSisi) => {
    const meshBemper = new THREE.Mesh(new THREE.BoxGeometry(lebarSpec * 0.94, 0.2, 0.28), matTrim);
    meshBemper.position.set(0, 0.3, tandaSisi * ((panjangSpec / 2) - 0.02)); grupMobil.add(meshBemper);
    const meshSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, panjangSpec * 0.55), matTrim);
    meshSkirt.position.set(tandaSisi * ((lebarSpec / 2) - 0.01), 0.24, 0); grupMobil.add(meshSkirt); };
  pasangBemperSkirt(-1); pasangBemperSkirt(1);
  // Spion yang dibawa tangkai.
  const pasangSpion = (tandaSisi) => {
    const meshTangkai = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), matTrim);
    meshTangkai.position.set(tandaSisi * ((lebarSpec / 2) + 0.04), 1.0, panjangSpec * 0.18); grupMobil.add(meshTangkai);
    const meshCermin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), matCatBadan);
    meshCermin.position.set(tandaSisi * ((lebarSpec / 2) + 0.11), 1.02, panjangSpec * 0.18); grupMobil.add(meshCermin); };
  pasangSpion(-1); pasangSpion(1);
  // Radius roda ditetapkan oleh kelas badan.
  const radiusRoda = (spec.body === 'suv' || spec.body === 'truck' || spec.body === 'van') ? 0.42
    : spec.body === 'kei' ? 0.28
    : (spec.body === 'sedan' || spec.body === 'wagon') ? 0.34 : 0.33;
  const rentangPoros = 0.62 * panjangSpec;
  const geoBan = new THREE.CylinderGeometry(radiusRoda, radiusRoda, 0.24, 20); geoBan.rotateZ(Math.PI / 2);
  const geoHub = new THREE.CylinderGeometry(radiusRoda * 0.62, radiusRoda * 0.62, 0.26, 12); geoHub.rotateZ(Math.PI / 2);
  const matBan = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const matHub = new THREE.MeshStandardMaterial({ color: spec.wheels || 0xc0c0c0, metalness: 0.85, roughness: 0.3 });
  const matJari = matHub;
  const petaRoda = {};
  const geoLengkung = new THREE.TorusGeometry(radiusRoda + 0.06, 0.045, 6, 14, Math.PI);
  const matLengkung = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.8 });
  const rakitRoda = (kunciRoda, sisiX, sisiZ) => {
    const grupPivot = new THREE.Group();
    grupPivot.position.set(sisiX * ((lebarSpec / 2) - 0.02), radiusRoda, sisiZ * (rentangPoros / 2));
    grupMobil.add(grupPivot);
    grupPivot.add(new THREE.Mesh(geoBan, matBan)); grupPivot.add(new THREE.Mesh(geoHub, matHub));
    let urutJari = 0;
    while (urutJari < 5) {
      const meshJari = new THREE.Mesh(new THREE.BoxGeometry(0.27, radiusRoda * 0.16, radiusRoda * 0.9), matJari);
      meshJari.rotation.x = (urutJari / 5) * Math.PI;
      grupPivot.add(meshJari);
      ++urutJari; }
    const meshLengkung = new THREE.Mesh(geoLengkung, matLengkung);
    meshLengkung.position.set(sisiX * ((lebarSpec / 2) + 0.03), radiusRoda, sisiZ * (rentangPoros / 2));
    meshLengkung.rotation.y = Math.PI / 2; grupMobil.add(meshLengkung);
    petaRoda[kunciRoda] = grupPivot;
    return grupPivot; };
  const penempatanRoda = [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]];
  for (const [kunciRoda, sisiX, sisiZ] of penempatanRoda) rakitRoda(kunciRoda, sisiX, sisiZ);
  // Lampu depan: unit popup bila spec memintanya, lampu elipsoid bila tidak.
  const matLampuDepan = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.7, roughness: 0.2 });
  if (spec.popups) {
    [-1, 1].forEach((tandaSisi) => { const meshPopup = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), matLampuDepan); meshPopup.position.set(tandaSisi * lebarSpec * 0.28, 0.86, (panjangSpec / 2) - 0.32); meshPopup.rotation.x = -0.25; grupMobil.add(meshPopup); });
  } else {
    [-1, 1].forEach((tandaSisi) => { const geoLampu = new THREE.SphereGeometry(0.13, 10, 8); const meshLampu = new THREE.Mesh(geoLampu, matLampuDepan); meshLampu.scale.set(1.5, 0.55, 0.5); meshLampu.position.set(tandaSisi * lebarSpec * 0.3, 0.72, (panjangSpec / 2) - 0.05); grupMobil.add(meshLampu); }); }
  // Lampu belakang: unit bundar, atau satu batang selebar penuh.
  const matLampuBelakang = new THREE.MeshStandardMaterial({ color: 0x881111, emissive: 0xff2222, emissiveIntensity: 0.8 });
  if (spec.roundTail) {
    const banyakLampu = spec.tail === 'quadWing' ? 4 : 2;
    for (let idxLampu = 0; idxLampu < banyakLampu; ++idxLampu) {
      const geoEkor = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12); geoEkor.rotateX(Math.PI / 2);
      const meshLampuEkor = new THREE.Mesh(geoEkor, matLampuBelakang);
      meshLampuEkor.position.set((idxLampu - ((banyakLampu - 1) / 2)) * 0.24, 0.78, -panjangSpec / 2 + -0.02);
      grupMobil.add(meshLampuEkor); }
  } else {
    const meshBatangEkor = new THREE.Mesh(new THREE.BoxGeometry(lebarSpec * 0.7, 0.09, 0.05), matLampuBelakang);
    meshBatangEkor.position.set(0, 0.78, -panjangSpec / 2 + -0.02); grupMobil.add(meshBatangEkor); }
  grupMobil.userData.tailMat = matLampuBelakang;
  grupMobil.userData.headMat = matLampuDepan;
  // Sayap dan bibir belakang pada ekor.
  if (spec.tail === 'roundWing' || spec.tail === 'quadWing' || spec.tail === 'wing') {
    const geoBilah = spec.tail === 'roundWing' ? new THREE.TorusGeometry(lebarSpec * 0.42, 0.045, 6, 16, Math.PI) : new THREE.BoxGeometry(lebarSpec * 0.88, 0.05, 0.3);
    const meshBilah = new THREE.Mesh(geoBilah, matTrim);
    if (spec.tail === 'roundWing') { meshBilah.rotation.z = 0; meshBilah.rotation.y = Math.PI / 2; meshBilah.rotation.x = Math.PI; meshBilah.scale.set(1, 1, 0.4); meshBilah.position.set(0, 1.12, -panjangSpec / 2 + 0.1); }
    else { meshBilah.position.set(0, 1.18, -panjangSpec / 2 + 0.08); meshBilah.rotation.x = -0.12; }
    grupMobil.add(meshBilah);
    [-1, 1].forEach((tandaSisi) => { const meshStrut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), matTrim); meshStrut.position.set(tandaSisi * lebarSpec * 0.3, 1.0, -panjangSpec / 2 + 0.1); grupMobil.add(meshStrut); });
  } else if (spec.tail === 'ducktail' || spec.tail === 'lip') {
    const meshBibir = new THREE.Mesh(new THREE.BoxGeometry(lebarSpec * 0.8, 0.06, spec.tail === 'ducktail' ? 0.28 : 0.14), matCatBadan);
    meshBibir.position.set(0, 0.98, -panjangSpec / 2 + 0.08);
    meshBibir.rotation.x = spec.tail === 'ducktail' ? -0.35 : -0.15;
    grupMobil.add(meshBibir); }
  // Stiker livery di kedua sisi.
  const jenisSisi = opts.livery || spec.livery;
  if (jenisSisi) {
    const texSisi = buildLiveryTexture(jenisSisi === 'hero-supra' || jenisSisi === 'hero-gtr' ? jenisSisi : jenisSisi, warnaCat);
    [-1, 1].forEach((tandaSisi) => {
      const meshStiker = new THREE.Mesh(new THREE.PlaneGeometry(panjangSpec * 0.72, 0.55), new THREE.MeshBasicMaterial({ map: texSisi, transparent: true }));
      meshStiker.position.set(tandaSisi * ((lebarSpec / 2) + 0.085), 0.62, 0);
      meshStiker.rotation.y = tandaSisi > 0 ? Math.PI / 2 : -Math.PI / 2;
      grupMobil.add(meshStiker); });
    if (spec.id === 'hero-supra' || jenisSisi === 'hero-supra') {
      const meshPanelKap = new THREE.Mesh(new THREE.BoxGeometry(lebarSpec * 0.9, 0.03, panjangSpec * 0.3), matTrim);
      meshPanelKap.position.set(0, 0.93, panjangSpec * 0.28); grupMobil.add(meshPanelKap); } }
  if (spec.lightbar) {
    const meshDasarBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.3), matTrim);
    meshDasarBar.position.set(0, 1.32, 0.1); grupMobil.add(meshDasarBar);
    const meshLampuMerah = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.4 }));
    meshLampuMerah.position.set(-0.28, 1.4, 0.1); grupMobil.add(meshLampuMerah);
    const meshLampuBiru = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28), new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 1.4 }));
    meshLampuBiru.position.set(0.28, 1.4, 0.1); grupMobil.add(meshLampuBiru);
    const pijarMerah = glowSprite(0xff3344, 2.4); pijarMerah.position.set(-0.28, 1.45, 0.1); grupMobil.add(pijarMerah);
    const pijarBiru = glowSprite(0x3366ff, 2.4); pijarBiru.position.set(0.28, 1.45, 0.1); grupMobil.add(pijarBiru);
    const refBar = {}; refBar.red = meshLampuMerah; refBar.blue = meshLampuBiru; refBar.gr = pijarMerah; refBar.gb = pijarBiru;
    grupMobil.userData.lightbar = refBar; }
  if (jenisSisi === 'taxi') {
    const meshTandaTaksi = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 }));
    meshTandaTaksi.position.set(0, 1.36, 0.1); grupMobil.add(meshTandaTaksi); }
  addUnderglow(grupMobil, spec, opts); addBlobShadow(grupMobil, spec);
  grupMobil.userData.wheels = petaRoda; grupMobil.userData.wheelR = radiusRoda;
  return grupMobil; }
// --- Mobil patroli RBPD: visual GLB npc-police (assets/npc-police.glb) ---
// Ini visual utama kendaraan polisi (dimunculkan oleh police.js).
// Argumen kendaraannya ialah rekaman yang dikembalikan spawnVehicle:
// { spec, specId, mesh, wheels, ... } di mana mesh ialah grup
// makeCarMesh yang userData-nya memegang { wheels, wheelR, tailMat,
// headMat } dan, untuk spec lightbar, userData.lightbar = { red,
// blue, gr, gb } (pasangan berkedip ialah lightbar.red /
// lightbar.blue — build ini tak punya ref barRed / barBlue tingkat
// atas). Badan prosedural tetap di grup, tersembunyi, sebagai
// fallback otomatis: bila GLB gagal dimuat, loadHeroAsset
// menyelesaikan null dan tak ada yang disentuh. Overlay lightbar,
// sprite pijarnya, dan roda prosedural DIPERTAHANKAN (roda bawaan
// GLB statis, jadi roda yang dipertahankan didudukkan ulang ke
// lengkungnya dan terus berputar lewat pembaruan roda yang ada).
// Tak pernah melempar.
function kumpulkanSetPertahanPolisi(akarVeh, dataPengguna, rodaCadangan) {
  const setPertahan = new Set();
  const rodaPerKunci = dataPengguna.wheels || rodaCadangan || {};
  Object.values(rodaPerKunci).forEach((objRoda) => { if (objRoda) setPertahan.add(objRoda); });
  const daftarBagianBar = new Array();
  const objBar = dataPengguna.lightbar || null;
  if (objBar) ['red', 'blue', 'gr', 'gb'].forEach((kunciBagian) => { if (objBar[kunciBagian]) daftarBagianBar.push(objBar[kunciBagian]); });
  if (dataPengguna.barRed) daftarBagianBar.push(dataPengguna.barRed);
  if (dataPengguna.barBlue) daftarBagianBar.push(dataPengguna.barBlue);
  daftarBagianBar.forEach((objBagian) => setPertahan.add(objBagian));
  let meshKotakDasar = null;
  const meshBarRef = daftarBagianBar.find((objBagian) => objBagian && objBagian.position && objBagian.geometry && objBagian.geometry.type === 'BoxGeometry') || daftarBagianBar[0];
  if (meshBarRef) {
    for (const objAnak of akarVeh.children) {
      if (setPertahan.has(objAnak) || !objAnak.isMesh || !objAnak.position) continue;
      if (Math.abs(objAnak.position.z - meshBarRef.position.z) < 0.01 && objAnak.position.y < meshBarRef.position.y && meshBarRef.position.y - objAnak.position.y < 0.2) { meshKotakDasar = objAnak; break; } } }
  if (meshKotakDasar) setPertahan.add(meshKotakDasar);
  akarVeh.children.forEach((objAnak) => {
    if (objAnak.isSprite) setPertahan.add(objAnak);
    else if (objAnak.isMesh && objAnak.geometry && objAnak.geometry.type === 'PlaneGeometry' && Math.abs(objAnak.rotation.x + Math.PI / 2) < 0.01) setPertahan.add(objAnak); });
  const hasilKumpul = {};
  hasilKumpul.keepSet = setPertahan; hasilKumpul.wheelsByKey = rodaPerKunci; hasilKumpul.barPartList = daftarBagianBar;
  hasilKumpul.baseBoxMesh = meshKotakDasar; hasilKumpul.refBarMesh = meshBarRef;
  return hasilKumpul; }
export function applyNpcPoliceGlb(veh) { try {
    if (!veh || veh.glbSwapped) return;
    const vehRoot = veh.mesh || veh;
    if (!vehRoot || !vehRoot.children || !vehRoot.userData) return;
    veh.glbSwapped = true;
    if (vehRoot !== veh) vehRoot.userData.glbSwapped = true;
    loadHeroAsset('npcPolice').then((loadedWrap) => { try {
        if (!loadedWrap) { veh.glbSwapped = false; if (vehRoot !== veh) vehRoot.userData.glbSwapped = false; return; }
        const ud = vehRoot.userData;
        // --- ref yang tetap terlihat --------------------------------
        const kumpul = kumpulkanSetPertahanPolisi(vehRoot, ud, veh.wheels);
        const keepSet = kumpul.keepSet, wheelsByKey = kumpul.wheelsByKey, barPartList = kumpul.barPartList;
        const baseBoxMesh = kumpul.baseBoxMesh, refBarMesh = kumpul.refBarMesh;
        // --- sembunyikan mesh badan prosedural (sembunyi, jangan buang) ----
        [...grp.children].forEach((childObj) => { if (!keepSet.has(childObj)) childObj.visible = false; });
        // --- lekatkan klon GLB (pembungkus cache dipakai bersama) -----
        const glbClone = loadedWrap.clone ? loadedWrap.clone(true) : loadedWrap;
        glbClone.position.set(0, 0, 0);
        vehRoot.add(glbClone);
        ud.npcPoliceGlb = glbClone;
        // --- pindahkan roda yang dipertahankan ke lengkung roda GLB --------
        // Gugus roda GLB: z lokal +0.27 di depan / -0.32 belakang
        // pada badan 4.85 -> z +1.31 / -1.55, x +/-0.80. Depan
        // versus belakang diputuskan oleh tanda z roda saat ini.
        Object.values(wheelsByKey).forEach((wheelObj) => {
          if (!wheelObj || !wheelObj.position) return;
          const frontFlag = wheelObj.position.z >= 0;
          wheelObj.position.z = frontFlag ? 1.31 : -1.55;
          wheelObj.position.x = wheelObj.position.x < 0 ? -0.80 : 0.80;
        });
        // --- pindahkan rakitan lightbar ke atap GLB (y 1.42) ---
        // Geser seluruh rakitan supaya dasarnya duduk dekat y 1.40;
        // material kedip / perilaku tak disentuh, ref tailMat/headMat
        // dibiarkan persis seperti adanya.
        const assemblyList = baseBoxMesh ? [baseBoxMesh, ...barPartList] : barPartList;
        if (assemblyList.length) {
          let shiftY;
          if (baseBoxMesh) shiftY = 1.40 - baseBoxMesh.position.y;
          else if (refBarMesh) shiftY = 1.48 - refBarMesh.position.y;
          else shiftY = 0;
          if (shiftY) assemblyList.forEach((partObj) => { if (partObj && partObj.position) partObj.position.y += shiftY; }); }
      } catch (e) { /* visual prosedural tetap */ }
    }).catch(() => { veh.glbSwapped = false; });
  } catch (e) { /* visual prosedural tetap */ } }
// --- nada luminans: tekstur panggang yang disimpan hanya sebagai detail -------------
// GLB npc-sedan tiba terbungkus tekstur biru elektrik jenuh. Pembantu
// ini membuang rona itu: luminans tiap fragmen (detailnya — kaca
// gelap tetap gelap, krom/lampu terang tetap terang) diwarnai ulang
// oleh satu nada per instans, jadi tak ada jejak biru asli yang
// bertahan pada instans mana pun. Ia tak pernah melempar sendiri —
// pemanggil membungkusnya seperti pertukaran GLB lain.
export function applyLuminanceTint(tintRoot, tintVal) {
  if (!tintRoot) return;
  tintRoot.traverse((nodeObj) => {
    if (!nodeObj.isMesh || !nodeObj.material) return;
    const retintOne = (srcMat) => {
      const matClone = srcMat.clone();
      matClone.onBeforeCompile = (shaderObj) => {
        shaderObj.uniforms.uTint = { value: new THREE.Color(tintVal) };
        shaderObj.fragmentShader = shaderObj.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint;').replace('#include <map_fragment>', ['#include <map_fragment>', 'float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));', 'diffuseColor.rgb = uTint * (0.22 + 1.05 * lum);'].join('\n')); };
      matClone.customProgramCacheKey = () => 'npc-luminance-tint';
      return matClone; };
    nodeObj.material = Array.isArray(nodeObj.material) ? nodeObj.material.map(retintOne) : retintOne(nodeObj.material); }); }
// === Sedan NPC: visual GLB npc-sedan untuk sedan lalu lintas ==========
// Mencerminkan applyNpcPoliceGlb di atas. PANJANG model BERJALAN
// SEPANJANG X (hidung di +X, batas x +/-0.5, y 0..0.334, z +/-0.24),
// jadi pembungkus diputar -90 derajat terhadap Y untuk memetakan
// hidung +X ke +Z maju (loader menanahkan y pada 0 dan memusatkan
// x/z, jadi berputar terhadap pusat mobil aman). targetSize registri
// dinyatakan dalam sumbu LOKAL model. Tekstur biru elektrik panggang
// diperlakukan sebagai luminans/detail saja via applyLuminanceTint
// dengan nada realistis per instans. Badan prosedural tetap
// tersembunyi sebagai fallback: bila GLB gagal dimuat, loadHeroAsset
// menyelesaikan null dan tak ada yang disentuh. Roda prosedural yang
// dipertahankan didudukkan ulang ke lengkung GLB dan terus berputar.
// Tak pernah melempar.
export function applyNpcSedanGlb(veh, tintVal) { try {
    if (!veh || veh.glbSwapped) return;
    const vehRoot = veh.mesh || veh;
    if (!vehRoot || !vehRoot.children || !vehRoot.userData) return;
    veh.glbSwapped = true;
    if (vehRoot !== veh) vehRoot.userData.glbSwapped = true;
    loadHeroAsset('npcSedan').then((loadedWrap) => { try {
        if (!loadedWrap) { veh.glbSwapped = false; if (vehRoot !== veh) vehRoot.userData.glbSwapped = false; return; }
        const ud = vehRoot.userData;
        // --- ref yang tetap terlihat (set yang dipertahankan sama seperti polisi) -
        const keepSet = new Set();
        const wheelsByKey = ud.wheels || veh.wheels || {};
        Object.values(wheelsByKey).forEach((wheelObj) => { if (wheelObj) keepSet.add(wheelObj); });
        // Sprite pijar plus bidang tanah rata (underglow / bayangan
        // blob: PlaneGeometry yang berbaring rata).
        vehRoot.children.forEach((childObj) => {
          if (childObj.isSprite) keepSet.add(childObj);
          else if (childObj.isMesh && childObj.geometry && childObj.geometry.type === 'PlaneGeometry' && Math.abs(childObj.rotation.x + Math.PI / 2) < 0.01) keepSet.add(childObj); });
        // --- sembunyikan mesh badan prosedural (sembunyi, jangan buang) ----
        [...grp.children].forEach((childObj) => { if (!keepSet.has(childObj)) childObj.visible = false; });
        // --- lekatkan klon GLB (pembungkus cache dipakai bersama) -----
        const glbClone = loadedWrap.clone ? loadedWrap.clone(true) : loadedWrap;
        glbClone.position.set(0, 0, 0);
        glbClone.rotation.y = -Math.PI / 2;
        applyLuminanceTint(glbClone, tintVal);
        glbClone.traverse((nodeObj) => { if (nodeObj && nodeObj.isMesh) nodeObj.castShadow = true; });
        vehRoot.add(glbClone);
        ud.npcSedanGlb = glbClone;
        // --- pindahkan roda yang dipertahankan ke lengkung roda GLB --------
        // Begitu rotasi -90 derajat diterapkan, gugus roda model
        // (x lokal +0.25 di depan / -0.35 belakang, diskalakan oleh
        // panjang 4.75) mendarat pada z game +1.19 depan / -1.66
        // belakang, x +/-0.80. Depan versus belakang menurut tanda z
        // saat ini; y tak disentuh (radius roda / perilaku putar tak berubah).
        Object.values(wheelsByKey).forEach((wheelObj) => {
          if (!wheelObj || !wheelObj.position) return;
          const frontFlag = wheelObj.position.z >= 0;
          wheelObj.position.z = frontFlag ? 1.19 : -1.66;
          wheelObj.position.x = wheelObj.position.x < 0 ? -0.80 : 0.80;
        });
      } catch (e) { /* visual prosedural tetap */ }
    }).catch(() => { veh.glbSwapped = false; });
  } catch (e) { /* visual prosedural tetap */ } }
// === Taksi NPC: visual GLB npc-taxi untuk taksi lalu lintas =============
// Mencerminkan pembantu sedan di atas DIKURANGI nada: tekstur
// panggang GLB taksi sudah membawa kuning taksi yang benar (tanda
// atap termasuk), jadi klon masuk apa adanya — tanpa pewarnaan ulang
// luminans. Hidung model sudah menunjuk +Z (batas x +/-0.261, y
// 0..0.43 termasuk tanda atap, z +/-0.5), jadi TIDAK ada rotasi yang
// diterapkan juga. Badan prosedural tetap tersembunyi sebagai
// fallback: bila GLB gagal dimuat, loadHeroAsset menyelesaikan null
// dan tak ada yang disentuh (fallback lalu tampil dalam kuning taksi
// spec 0xf2b21b). Roda prosedural yang dipertahankan didudukkan ulang
// ke lengkung GLB dan terus berputar sepanjang waktu. Tak pernah melempar.
export function applyNpcTaxiGlb(veh) { try {
    if (!veh || veh.glbSwapped) return;
    const vehRoot = veh.mesh || veh;
    if (!vehRoot || !vehRoot.children || !vehRoot.userData) return;
    veh.glbSwapped = true;
    if (vehRoot !== veh) vehRoot.userData.glbSwapped = true;
    loadHeroAsset('npcTaxi').then((loadedWrap) => { try {
        if (!loadedWrap) { veh.glbSwapped = false; if (vehRoot !== veh) vehRoot.userData.glbSwapped = false; return; }
        const ud = vehRoot.userData;
        // --- ref yang tetap terlihat (set yang dipertahankan sama seperti sedan) --
        const keepSet = new Set();
        const wheelsByKey = ud.wheels || veh.wheels || {};
        Object.values(wheelsByKey).forEach((wheelObj) => { if (wheelObj) keepSet.add(wheelObj); });
        // Sprite pijar plus bidang tanah rata (underglow / bayangan
        // blob: PlaneGeometry yang berbaring rata).
        vehRoot.children.forEach((childObj) => {
          if (childObj.isSprite) keepSet.add(childObj);
          else if (childObj.isMesh && childObj.geometry && childObj.geometry.type === 'PlaneGeometry' && Math.abs(childObj.rotation.x + Math.PI / 2) < 0.01) keepSet.add(childObj); });
        // --- sembunyikan mesh badan prosedural (sembunyi, jangan buang) ----
        [...grp.children].forEach((childObj) => { if (!keepSet.has(childObj)) childObj.visible = false; });
        // --- lekatkan klon GLB (pembungkus cache dipakai bersama) -----
        const glbClone = loadedWrap.clone ? loadedWrap.clone(true) : loadedWrap;
        glbClone.position.set(0, 0, 0);
        glbClone.traverse((nodeObj) => { if (nodeObj && nodeObj.isMesh) nodeObj.castShadow = true; });
        vehRoot.add(glbClone);
        ud.npcTaxiGlb = glbClone;
        // --- pindahkan roda yang dipertahankan ke lengkung roda GLB --------
        // Gugus roda model: z lokal +0.25 di depan / -0.28
        // belakang, diskalakan oleh panjang 4.80 -> z game +1.20
        // depan / -1.34 belakang, x +/-0.80. Depan versus belakang
        // menurut tanda z saat ini; y tak disentuh (radius roda /
        // perilaku putar tak berubah).
        Object.values(wheelsByKey).forEach((wheelObj) => {
          if (!wheelObj || !wheelObj.position) return;
          const frontFlag = wheelObj.position.z >= 0;
          wheelObj.position.z = frontFlag ? 1.20 : -1.34;
          wheelObj.position.x = wheelObj.position.x < 0 ? -0.80 : 0.80;
        });
      } catch (e) { /* visual prosedural tetap */ }
    }).catch(() => { veh.glbSwapped = false; });
  } catch (e) { /* visual prosedural tetap */ } }
// Hiasan tanah bersama untuk tiap visual mobil (prosedural atau hero
// GLB): bidang underglow aditif (bila spec/opts membawa warna pijar)
// dan bayangan blob. Disimpan di satu tempat supaya kedua visual
// duduk secara identik.
function addUnderglow(carGroup, spec, opts) {
  const glowTint = opts && opts.glow !== undefined ? opts.glow : spec.glow;
  if (!glowTint) return;
  const sheet = document.createElement('canvas'); sheet.width = sheet.height = 128;
  const brush = sheet.getContext('2d');
  const grad = brush.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  brush.fillStyle = grad; brush.fillRect(0, 0, 128, 128);
  // Ukuran dibatasi secara wajar — bidang lama wid/len + 1.6 terbaca
  // sebagai kubah berwarna raksasa (6-8 m) dari kamera rendah di HQ.
  // Pijar kini memeluk tapak mobil sendiri, diskalakan 1.25 pada
  // kedua sumbu (sumbu panjang = panjang spec x 1.25, lebar
  // proporsional pada lebar spec x 1.25), pada opacity 0.25
  // (<= 0.45), rata di tanah pada y 0.06. Pembantu tunggal ini
  // melayani tiap jalur: makeCarMesh prosedural dan jalur populate
  // GLB untuk kendaraan hero heroCar / gtr35 / lamboSvj.
  const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid * 1.25, spec.len * 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sheet), color: glowTint, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowMesh.rotation.x = -Math.PI / 2; glowMesh.position.y = 0.06; carGroup.add(glowMesh); }
function addBlobShadow(carGroup, spec) {
  const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(spec.wid + 0.5, spec.len + 0.5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = 0.03; carGroup.add(shadowMesh); }
// === mobil hero: visual GLB Tripo untuk nameplate Taiyo Supra ====
// Spec 'taiyo' dan 'hero-supra' mengemudikan GLB asli
// (assets/hero-car.glb via assets.js) begitu ia selesai; sampai
// saat itu — dan selamanya bila ia gagal — mereka mengemudikan mesh
// prosedural persis dari makeCarMesh. Roda GLB terpanggang (satu
// mesh), jadi visual membawa empat pivot roda KOSONG pada posisi
// poros semata supaya kode spin+steer drive.js / traffic berjalan
// tanpa bahaya, dan tailMat / headMat ialah null (drive.js
// men-null-guard tailMat; tak ada yang mendereferensi headMat) —
// dorongan lampu rem sekadar dilewati. Satu pemuatan dimulai pada
// init modul; tiap spawn mengklon pembungkus.
const HERO_SPEC_IDS = new Set(['taiyo', 'hero-supra']);
let heroTemplate = null, heroLoadDone = false;
const heroWaitQueue = [];
const populateGlbCar = (carGroup, spec, opts) => {
  carGroup.add(heroTemplate.clone(true));
  addUnderglow(carGroup, spec, opts); addBlobShadow(carGroup, spec);
  const pivotMap = {};
  [['fl', -1, 1], ['fr', 1, 1], ['rl', -1, -1], ['rr', 1, -1]].forEach(([wheelKey, sideSign, endSign]) => {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(sideSign * 0.80, 0.34, endSign * 1.42);
    carGroup.add(pivotGrp);
    pivotMap[wheelKey] = pivotGrp; });
  carGroup.userData.wheels = pivotMap; carGroup.userData.wheelR = 0.34;
  carGroup.userData.tailMat = null; carGroup.userData.headMat = null; carGroup.userData.visualMode = 'glb';
  return carGroup; };
const buildGlbCarMesh = (spec, opts) => populateGlbCar(new THREE.Group(), spec, opts);
// Tukar mobil hero prosedural yang masih hidup ke visual GLB di
// tempat: grup mesh luar, posisi/rotasi dan SEMUA status kendaraan
// dipertahankan. Hanya anak yang dibuat makeCarMesh saat spawn
// (dipotret dalam v._procChildren) yang dibuang, jadi apa pun yang
// ditambahkan kemudian — figur pengemudi duduk, spotlight pemain,
// pijar malam — selamat dari pertukaran. Tak pernah melempar.
const swapHeroCarToGlb = (queueEntry) => { try {
    const veh = queueEntry.v;
    if (!veh || !veh.mesh || !veh.mesh.parent) return;
    if (veh.mesh.userData.visualMode === 'glb') return;
    if (!veh._procChildren) {
      while (veh.mesh.children.length) veh.mesh.remove(veh.mesh.children[0]);
    } else {
      [...veh.mesh.children].forEach((childObj) => { if (veh._procChildren.has(childObj)) veh.mesh.remove(childObj); }); }
    populateGlbCar(veh.mesh, queueEntry.spec, { glow: queueEntry.glow });
    veh.wheels = veh.mesh.userData.wheels;
    veh._procChildren = null;
  } catch (e) { /* visual prosedural tetap */ } };
try { loadHeroAsset('heroCar').then((loadedWrap) => { try {
      heroLoadDone = true;
      if (!loadedWrap) { heroWaitQueue.length = 0; return; }
      heroTemplate = loadedWrap;
      heroWaitQueue.splice(0).forEach((queueEntry) => swapHeroCarToGlb(queueEntry));
    } catch (e) { /* visual prosedural tetap */ }
  }).catch(() => { heroLoadDone = true; heroWaitQueue.length = 0; });
} catch (e) { heroLoadDone = true; }
// === mobil hero rival: GLB GT-R R35 (assets/gtr35.glb) + livery Bosku ==
// Spec 'gtr35' mengikuti pola mobil hero di atas dengan persis: GLB
// asli begitu ia selesai, mesh prosedural makeCarMesh persis sebagai
// fallback sampai saat itu / pada kegagalan. Livery-nya (atas perak /
// kit bawah hitam / garis merah pada tepi atas kit) disuntikkan per
// klon via pewarnaan pita tinggi onBeforeCompile dalam Y model LOKAL
// (y model membentang 0..0.311, sebelum penskalaan pembungkus).
function applyGtrPaint(gtrRoot) {
  if (!gtrRoot) return;
  gtrRoot.traverse((nodeObj) => {
    if (!nodeObj.isMesh || !nodeObj.material) return;
    const paintOne = (srcMat) => {
      const matClone = srcMat.clone();
      matClone.onBeforeCompile = (shaderObj) => {
        shaderObj.vertexShader = shaderObj.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
        shaderObj.fragmentShader = shaderObj.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;').replace('#include <map_fragment>', ['#include <map_fragment>', 'vec3 gtrBase = diffuseColor.rgb;', 'vec3 gtrKit = mix(gtrBase * 0.25, vec3(0.012, 0.012, 0.014), 0.75);', 'vec3 gtrStripe = vec3(0.85, 0.04, 0.05);', 'vec3 gtrUpper = gtrBase * 1.18;', 'float gtrToStripe = smoothstep(0.095 - 0.006, 0.095 + 0.006, vLocalY);', 'float gtrToUpper = smoothstep(0.125 - 0.006, 0.125 + 0.006, vLocalY);', 'diffuseColor.rgb = mix(mix(gtrKit, gtrStripe, gtrToStripe), gtrUpper, gtrToUpper);'].join('\n')); };
      matClone.customProgramCacheKey = () => 'gtr35-livery';
      return matClone; };
    nodeObj.material = Array.isArray(nodeObj.material) ? nodeObj.material.map(paintOne) : paintOne(nodeObj.material); }); }
const GTR_SPEC_IDS = new Set(['gtr35']);
let gtrTemplate = null, gtrLoadDone = false;
const gtrWaitQueue = [];
const populateGtrCar = (carGroup, spec, opts) => {
  const glbClone = gtrTemplate.clone(true);
  // Hidung GT-R ditetapkan oleh data vertex (game/assets/gtr35.glb,
  // aksesor POSITION, satuan lokal): rata-rata vertex Y untuk paruh
  // z>0.25 ialah 0.110111 (n=18392); untuk paruh z<-0.25 = 0.134280
  // (n=19024). Paruh z+ LEBIH RENDAH — itu kap/depan; paruh z- yang
  // lebih tinggi ialah dek belakang + sayap. Jadi hidung sudah
  // menunjuk +Z (maju kendaraan) dan TIDAK ada rotasi yang
  // diterapkan. Ini mengembalikan putaran PI yang lebih awal, yang
  // membuat mobil mengemudi ekor-dulu.
  glbClone.rotation.y = 0;
  applyGtrPaint(glbClone);
  carGroup.add(glbClone);
  addUnderglow(carGroup, spec, opts); addBlobShadow(carGroup, spec);
  const pivotMap = {};
  [['fl', -0.80, 1.41], ['fr', 0.80, 1.41], ['rl', -0.80, -1.55], ['rr', 0.80, -1.55]].forEach(([wheelKey, px, pz]) => {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(px, 0.35, pz);
    carGroup.add(pivotGrp);
    pivotMap[wheelKey] = pivotGrp; });
  carGroup.userData.wheels = pivotMap; carGroup.userData.wheelR = 0.35;
  carGroup.userData.tailMat = null; carGroup.userData.headMat = null; carGroup.userData.visualMode = 'glb';
  return carGroup; };
const buildGtrCarMesh = (spec, opts) => populateGtrCar(new THREE.Group(), spec, opts);
const swapGtrCarToGlb = (queueEntry) => { try {
    const veh = queueEntry.v;
    if (!veh || !veh.mesh || !veh.mesh.parent) return;
    if (veh.mesh.userData.visualMode === 'glb') return;
    if (!veh._procChildren) {
      while (veh.mesh.children.length) veh.mesh.remove(veh.mesh.children[0]);
    } else {
      [...veh.mesh.children].forEach((childObj) => { if (veh._procChildren.has(childObj)) veh.mesh.remove(childObj); }); }
    populateGtrCar(veh.mesh, queueEntry.spec, { glow: queueEntry.glow });
    veh.wheels = veh.mesh.userData.wheels;
    veh._procChildren = null;
  } catch (e) { /* visual prosedural tetap */ } };
try { loadHeroAsset('gtr35').then((loadedWrap) => { try {
      gtrLoadDone = true;
      if (!loadedWrap) { gtrWaitQueue.length = 0; return; }
      gtrTemplate = loadedWrap;
      gtrWaitQueue.splice(0).forEach((queueEntry) => swapGtrCarToGlb(queueEntry));
    } catch (e) { /* visual prosedural tetap */ }
  }).catch(() => { gtrLoadDone = true; gtrWaitQueue.length = 0; });
} catch (e) { gtrLoadDone = true; }
// === mobil impian: GLB Lamborghini SVJ (assets/lambo-svj.glb) =======
// Spec 'svj' ialah slot hero ketiga dan mengikuti pola yang sama
// seperti dua di atas: GLB asli begitu ia selesai, mesh prosedural
// makeCarMesh persis sampai saat itu dan selamanya pada kegagalan.
// Batas model berjalan x +/-0.259, y 0..0.275, z +/-0.5 dengan HIDUNG
// di +Z (baji melandai turun menuju +z; dek belakang tinggi dan
// sayap besar di -z), jadi ia tak butuh rotasi. Bosku memeriksa model
// mentah dan memandatkan tiga perbaikan cacat, diterapkan per klon
// di dalam applySvjFixes: (1) kaca depan hilang -> kanopi kaca
// berwarna di atas kabin, (2) lampu belakang hilang -> unit LED
// berbentuk Y khas (didaftarkan sebagai tailMat kendaraan supaya
// jalur dorongan rem dapat mencerahkannya) plus strip DRL depan,
// (3) tekstur noise terfragmentasi -> perlakuan cat hitam matte
// (tekstur disimpan hanya sebagai detail berpengaruh rendah di atas
// basis hampir hitam, specular satin) plus cakram rem merah yang
// ditonjolkan di belakang tiap roda.
function buildSvjTailTexture() { const sheet = document.createElement('canvas'); sheet.width = 256; sheet.height = 84;
  const brush = sheet.getContext('2d');
  brush.clearRect(0, 0, 256, 84);
  brush.strokeStyle = '#ff1e1e'; brush.lineWidth = 15; brush.lineCap = 'round'; brush.lineJoin = 'round';
  brush.shadowColor = '#ff1e1e'; brush.shadowBlur = 8;
  brush.beginPath();
  brush.moveTo(28, 8); brush.lineTo(128, 46);
  brush.moveTo(228, 8); brush.lineTo(128, 46);
  brush.moveTo(128, 46); brush.lineTo(128, 76);
  brush.stroke();
  const tex = new THREE.CanvasTexture(sheet); tex.colorSpace = THREE.SRGBColorSpace; return tex; }
function applySvjFixes(wrapArg, vehArg, hostArg) {
  const resultObj = { tailMat: null, drlMat: null };
  if (!wrapArg) return resultObj;
  // SEMUA geometri perlakuan di bawah ditulis dalam satuan GAME dan
  // harus hidup pada grup KENDARAAN (hostArg, diteruskan oleh
  // populateSvjCar — satu-satunya pemanggil grup), tak pernah pada
  // pembungkus GLB yang diskalakan: skala targetSize pembungkus
  // (~4.05 x / 4.15 y / 4.94 z) akan menggelembungkan tiap ukuran dan
  // melempar tiap posisi bermeter-meter dari mobil (penyakit sprite
  // pijar yang lebih awal). Pembungkus menyimpan HANYA klon GLB itu
  // sendiri; cat hitam matte di (a) tetap melintasi pembungkus karena
  // ia harus mengikuti mesh GLB di dalamnya. Kembali ke pembungkus
  // hanya bila tak ada grup kendaraan yang diteruskan.
  const hostGrp = hostArg || wrapArg;
  // (a) CAT — hitam matte: tekstur panggang bertahan hanya sebagai
  // detail halus (kekuatan 30%, dicampur 78% menuju hampir hitam),
  // akhiran satin.
  wrapArg.traverse((nodeObj) => {
    if (!nodeObj.isMesh || !nodeObj.material) return;
    const paintOne = (srcMat) => {
      const matClone = srcMat.clone();
      matClone.roughness = 0.58; matClone.metalness = 0.30;
      matClone.onBeforeCompile = (shaderObj) => {
        shaderObj.fragmentShader = shaderObj.fragmentShader.replace('#include <map_fragment>', ['#include <map_fragment>', 'diffuseColor.rgb = mix(diffuseColor.rgb * 0.30, vec3(0.016, 0.016, 0.018), 0.78);'].join('\n')); };
      matClone.customProgramCacheKey = () => 'svj-matte';
      return matClone; };
    nodeObj.material = Array.isArray(nodeObj.material) ? nodeObj.material.map(paintOne) : paintOne(nodeObj.material); });
  // (b) KANOPI KACA — profil samping terekstrusi (bidang z-y, satuan
  // GAME) mengikuti siluet kabin (z kabin lokal -0.2..+0.1, puncak
  // atap y 0.275 -> z game -0.99..+0.49, atap y 1.14). Dasarnya
  // tenggelam ke y 0.74, di dalam badan, jadi hanya kubah berwarna yang tampil.
  const profileShape = new THREE.Shape();
  profileShape.moveTo(0.55, 0.80);
  profileShape.lineTo(-0.35, 1.10);
  profileShape.lineTo(-1.05, 1.08);
  profileShape.lineTo(-1.45, 0.82);
  profileShape.lineTo(-1.45, 0.74);
  profileShape.lineTo(0.55, 0.74);
  profileShape.closePath();
  const canopyGeo = new THREE.ExtrudeGeometry(profileShape, { depth: 1.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, steps: 1 });
  canopyGeo.rotateY(-Math.PI / 2);
  canopyGeo.translate(0.62, 0, 0);
  const canopyMesh = new THREE.Mesh(canopyGeo, new THREE.MeshPhongMaterial({ color: 0x0d1216, specular: 0xbdd3e0, shininess: 90, transparent: true, opacity: 0.97 }));
  hostGrp.add(canopyMesh);
  // (c) LAMPU BELAKANG — dua unit Y-LED dipasang pada muka belakang
  // (z = -2.46). Material mereka didaftarkan sebagai tailMat
  // kendaraan: path menulis emissiveIntensity pada tailMat, jadi
  // basis ialah 1.1 (unit Y diperbesar) dan pengereman mencerahkan
  // Y-nya. Sprite pijar merah kecil di belakang tiap unit.
  const tailTex = buildSvjTailTexture();
  const svjTailMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tailTex, map: tailTex, transparent: true, emissiveIntensity: 1.1 });
  [-1, 1].forEach((sideSign) => {
    const unitMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.28), svjTailMat);
    unitMesh.position.set(sideSign * 0.56, 0.80, -2.46);
    unitMesh.rotation.y = Math.PI;
    hostGrp.add(unitMesh);
    const glowSpr = glowSprite(0xff2a22, 1.1);
    glowSpr.position.set(sideSign * 0.56, 0.80, -2.52);
    // Indukkan ke grup KENDARAAN (satuan game), tak pernah pembungkus
    // GLB yang diskalakan — skala targetSize pembungkus (~4.05 x /
    // 4.15 y / 4.94 z) melipatgandakan sprite ini menjadi kubah merah
    // ~4.5-5.4 m dengan posisinya terlempar bermeter-meter dari muka
    // belakang, pada opacity tetap 0.85 di siang bolong. Pada grup
    // kendaraan ia tetap 1.1 m (<= batas SVJ 1.6 m) pada muka
    // belakang; kehadiran foto rem yang dipentaskan datang dari
    // tailMat, bukan dari pijar yang kebesaran.
    // hostGrp ialah grup kendaraan yang sama itu, kini dipakai untuk
    // tiap penambahan perlakuan.
    hostGrp.add(glowSpr); });
  resultObj.tailMat = svjTailMat;
  // DRL depan — strip putih emisif tipis pada hidung; sistem
  // damage-fx melapisi pijar/kerucut lampu depannya di atas pada malam.
  const svjDrlMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf4f8ff, emissiveIntensity: 1.2, roughness: 0.3 });
  [-1, 1].forEach((sideSign) => {
    const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.07), svjDrlMat);
    stripMesh.position.set(sideSign * 0.55, 0.52, 2.44);
    hostGrp.add(stripMesh); });
  resultObj.drlMat = svjDrlMat;
  // (d) CAKRAM REM — merah terang, satu terselip di belakang tiap pivot roda.
  const discGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.06, 20); discGeo.rotateZ(Math.PI / 2);
  const discMat = new THREE.MeshStandardMaterial({ color: 0xe02020, metalness: 0.2, roughness: 0.35 });
  [[-0.86, 1.40], [0.86, 1.40], [-0.86, -1.75], [0.86, -1.75]].forEach(([discX, discZ]) => {
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.position.set(discX, 0.36, discZ);
    hostGrp.add(discMesh); });
  if (vehArg) vehArg.svjTreatment = resultObj;
  return resultObj; }
const SVJ_SPEC_IDS = new Set(['svj']);
let svjTemplate = null, svjLoadDone = false;
const svjWaitQueue = [];
const populateSvjCar = (carGroup, spec, opts) => {
  const glbClone = svjTemplate.clone(true);
  const fixResult = applySvjFixes(glbClone, null, carGroup);
  carGroup.add(glbClone);
  addUnderglow(carGroup, spec, opts); addBlobShadow(carGroup, spec);
  const pivotMap = {};
  [['fl', -0.88, 1.40], ['fr', 0.88, 1.40], ['rl', -0.88, -1.75], ['rr', 0.88, -1.75]].forEach(([wheelKey, px, pz]) => {
    const pivotGrp = new THREE.Group();
    pivotGrp.position.set(px, 0.36, pz);
    carGroup.add(pivotGrp);
    pivotMap[wheelKey] = pivotGrp; });
  carGroup.userData.wheels = pivotMap; carGroup.userData.wheelR = 0.36;
  carGroup.userData.tailMat = fixResult.tailMat; carGroup.userData.headMat = fixResult.drlMat; carGroup.userData.visualMode = 'glb';
  return carGroup; };
const buildSvjCarMesh = (spec, opts) => populateSvjCar(new THREE.Group(), spec, opts);
const swapSvjCarToGlb = (queueEntry) => { try {
    const veh = queueEntry.v;
    if (!veh || !veh.mesh || !veh.mesh.parent) return;
    if (veh.mesh.userData.visualMode === 'glb') return;
    if (!veh._procChildren) {
      while (veh.mesh.children.length) veh.mesh.remove(veh.mesh.children[0]);
    } else {
      [...veh.mesh.children].forEach((childObj) => { if (veh._procChildren.has(childObj)) veh.mesh.remove(childObj); }); }
    populateSvjCar(veh.mesh, queueEntry.spec, { glow: queueEntry.glow });
    veh.wheels = veh.mesh.userData.wheels;
    veh._procChildren = null;
    // Pementasan foto (shots.js 'svjrear') dapat mempersenjatai
    // dorongan rem lebih dulu; karena pertukaran asinkron, terapkan
    // di sini begitu tailMat asli ada.
    if (veh._brakeStaged && veh.mesh.userData.tailMat) veh.mesh.userData.tailMat.emissiveIntensity = 2.4;
  } catch (e) { /* visual prosedural tetap */ } };
try { loadHeroAsset('lamboSvj').then((loadedWrap) => { try {
      svjLoadDone = true;
      if (!loadedWrap) { svjWaitQueue.length = 0; return; }
      svjTemplate = loadedWrap;
      svjWaitQueue.splice(0).forEach((queueEntry) => swapSvjCarToGlb(queueEntry));
    } catch (e) { /* visual prosedural tetap */ }
  }).catch(() => { svjLoadDone = true; svjWaitQueue.length = 0; });
} catch (e) { svjLoadDone = true; }
// Palet berat pastel untuk kendaraan yang DIPENTASKAN / DIPARKIR.
// Brief pesisir neon ingin baris parkir di sepanjang bulevar terbaca
// pastel melawan siang terang lapang — lalu lintas sudah memilih
// dari blok pastel TRAFFIC_COLORS yang diperlebar, tapi spawn parkir
// dulu kembali ke warna panggang tunggal tiap spec, jadi seluruh
// baris pentas mengulang nada yang sama sedikit. spawnVehicle (di
// bawah) melempar palet ini ~70% waktu untuk spawn driver:'parked'
// yang tak membawa warna eksplisit dan tak ada livery; ~30% sisanya
// mempertahankan warna spec untuk variasi. Tiga entri terakhir ialah
// lilac bubuk, lemon pucat, dan koral lembut.
const PARKED_PASTELS = [
  0xffb7d5, 0xb8e6c9, 0xfff3d6, 0xaed6f7, 0xffcf9f, 0xd5f5e3, 0xfdebd0,
  0xd6eaf8, 0xd9c7ec, 0xfdf6b2, 0xf5a58d,
];
export function spawnVehicle(G, specId, spawnX, spawnZ, spawnAngle, opts) {
  opts = opts || {};
  // Bias pastel parkir: hanya untuk spawn parkir tanpa warna
  // pemanggil dan tanpa livery — livery polisi, pentasan hero yang
  // meneruskan warna eksplisit, lalu lintas dan pengemudi misi semua tak tersentuh.
  // Menetapkan opts.color di sini (sebelum bangun mesh + rekaman di
  // bawah) menjaga nada mesh dan v.color tetap sepakat.
  if (opts.driver === 'parked' && opts.color == null && !opts.livery && rnd() < 0.7) opts.color = pick(PARKED_PASTELS);
  const fullSpec = { ...CARS[specId], id: specId };
  const heroFlag = HERO_SPEC_IDS.has(specId), gtrFlag = GTR_SPEC_IDS.has(specId), svjFlag = SVJ_SPEC_IDS.has(specId);
  const carMesh = svjFlag && svjTemplate ? buildSvjCarMesh(fullSpec, opts)
    : gtrFlag && gtrTemplate ? buildGtrCarMesh(fullSpec, opts)
    : heroFlag && heroTemplate ? buildGlbCarMesh(fullSpec, opts)
    : makeCarMesh(fullSpec, opts.color, opts);
  // Bayangan lembut panjang — tiap mesh badan mobil melempar. Bidang
  // tanah rata (underglow / bayangan blob) dikecualikan: mereka
  // berbaring di jalan dan akan mencap persegi gelap alih-alih bayangan.
  carMesh.traverse((nodeObj) => {
    if (nodeObj && nodeObj.isMesh && !(nodeObj.geometry && nodeObj.geometry.type === 'PlaneGeometry' && Math.abs(nodeObj.rotation.x + Math.PI / 2) < 0.01)) nodeObj.castShadow = true; });
  carMesh.position.set(spawnX, groundH(spawnX, spawnZ) + 0.02, spawnZ);
  carMesh.rotation.y = spawnAngle || 0;
  G.scene.add(carMesh);
  const vehRec = {};
  vehRec.spec = fullSpec; vehRec.specId = specId; vehRec.mesh = carMesh; vehRec.angle = spawnAngle || 0;
  vehRec.speed = 0; vehRec.health = 100; vehRec.driver = opts.driver || 'parked';
  vehRec.color = opts.color != null ? opts.color : fullSpec.color; vehRec.wheels = carMesh.userData.wheels;
  vehRec.steerVis = 0; vehRec.x = spawnX; vehRec.z = spawnZ; vehRec.target = null;
  vehRec.lane = opts.lane || 0; vehRec.smokeT = 0;
  armFxHook(G);
  if (heroFlag && !heroTemplate && !heroLoadDone) {
    vehRec._procChildren = new Set(carMesh.children);
    heroWaitQueue.push({ v: vehRec, spec: fullSpec, glow: opts.glow }); }
  if (gtrFlag && !gtrTemplate && !gtrLoadDone) {
    vehRec._procChildren = new Set(carMesh.children);
    gtrWaitQueue.push({ v: vehRec, spec: fullSpec, glow: opts.glow }); }
  if (svjFlag && !svjTemplate && !svjLoadDone) {
    vehRec._procChildren = new Set(carMesh.children);
    svjWaitQueue.push({ v: vehRec, spec: fullSpec, glow: opts.glow }); }
  if (!G.vehicles) G.vehicles = [];
  G.vehicles.push(vehRec);
  return vehRec; }
// === lalu lintas: pemunculan dan arus ======================================
const TRAFFIC_SPEC_IDS = [
  'sedan', 'hatch', 'suv', 'wagon', 'kei', 'hachi', 'van', 'sora15', 'roadster',
  'taxi', 'sedan', 'hatch', 'suv', 'taxi',
];
// Palet realistis plus blok pastel (suasana pesisir neon — pink
// lembut / mint / krem / biru bayi / persik). Blok pastel diperlebar
// menjadi 10 dari 20 entri, jadi ~1/2 pilihan warna lalu lintas
// terbaca pastel melawan bulevar terang.
const TRAFFIC_PAINTS = [
  0xb9c0c7, 0x3f8cff, 0xd95555, 0x44484e, 0xf2f2f2, 0x5a7d4f, 0xffd23f, 0x707880,
  0x8a4fd0, 0x2a9d8f, 0xffb7d5, 0xb8e6c9, 0xfff3d6, 0xaed6f7, 0xffcf9f, 0xd5f5e3,
  0xfdebd0, 0xd6eaf8, 0xf5c6e0, 0xe8daef,
];
// Nada realistis per instans untuk sedan lalu lintas GLB (pewarnaan
// ulang luminans — biru elektrik panggang GLB tak pernah bertahan).
// Mereka berputar secara deterministik menurut indeks spawn sedan.
const SEDAN_TINT_LIST = [0xc0c4c8, 0xe9e9e6, 0x3a3d42, 0x6e1420, 0x44586e, 0x77694f, 0xe8a7bf, 0x9fc3e8];
let sedanSpawnIdx = 0;
export function spawnTraffic(G, count) {
  if (!G.traffic) G.traffic = [];
  // Kepadatan lalu lintas: ronde lebih awal mengangkat hitungan
  // pemanggil sebesar ~50% (main.js meminta 14 -> 21 di jalan).
  // Ronde kepadatan menaikkan target di jalan menjadi 32, jadi
  // permintaan diskalakan oleh 16/7 (14 * 16 / 7 = 32). Kelas
  // kendaraan / aturan spawn / perilaku respawn yang sama seperti sebelumnya.
  const totalCount = Math.round(count * 16 / 7);
  for (let spawnIdx = 0; spawnIdx < totalCount; ++spawnIdx) {
    let alongXRoad = rnd() < 0.5;
    let roadLine = pick(alongXRoad ? G.roadX : G.roadZ);
    // Pembobotan rute: rute ialah jelajah bebas (mobil memilih garis
    // jalan dan boleh berbelok di persimpangan), jadi pembobotan
    // mendarat pada waktu spawn — kira-kira 45% mobil mulai pada
    // bulevar Coral (z=495) atau jalan utama x=0 / z=0, yang menjaga
    // jalan yang dipentaskan terlihat sibuk.
    if (rnd() < 0.45) {
      const mainChoices = ['blvd', 'blvd', 'x0', 'z0'];
      const mainChoice = pick(mainChoices);
      if (mainChoice === 'blvd' && Array.isArray(G.roadZ) && G.roadZ.includes(495)) { alongXRoad = false; roadLine = 495; }
      else if (mainChoice === 'x0' && Array.isArray(G.roadX) && G.roadX.includes(0)) { alongXRoad = true; roadLine = 0; }
      else if (mainChoice === 'z0' && Array.isArray(G.roadZ) && G.roadZ.includes(0)) { alongXRoad = false; roadLine = 0; } }
    const alongPos = rr(-600, 600);
    const travelSign = rnd() < 0.5 ? 1 : -1;
    const laneOffset = 5 * travelSign;
    const startX = alongXRoad ? roadLine + laneOffset : alongPos;
    const startZ = alongXRoad ? alongPos : roadLine - laneOffset;
    const startHeading = alongXRoad ? (travelSign > 0 ? 0 : Math.PI) : (travelSign > 0 ? Math.PI / 2 : -Math.PI / 2);
    const chosenSpecId = pick(TRAFFIC_SPEC_IDS);
    const veh = spawnVehicle(G, chosenSpecId, startX, startZ, startHeading, { color: chosenSpecId === 'taxi' ? CARS.taxi.color : pick(TRAFFIC_PAINTS), driver: 'traffic' });
    if (chosenSpecId === 'sedan') {
      const tintVal = SEDAN_TINT_LIST[sedanSpawnIdx % SEDAN_TINT_LIST.length];
      ++sedanSpawnIdx;
      applyNpcSedanGlb(veh, tintVal); }
    if (chosenSpecId === 'taxi') applyNpcTaxiGlb(veh);
    veh.onX = alongXRoad; veh.line = roadLine; veh.dirSign = travelSign;
    veh.cruise = rr(22, 38) / 3.6;
    veh.speed = veh.cruise;
    G.traffic.push(veh); } }
function putarRodaLaluLintas(vehRef, langkahPutar, dtRef) {
  ['fl', 'fr', 'rl', 'rr'].forEach((kunciRoda) => { const objRoda = vehRef.wheels[kunciRoda]; if (objRoda) objRoda.rotation.x += langkahPutar / dtRef * dtRef; });
  ['fl', 'fr', 'rl', 'rr'].forEach((kunciRoda) => { const objRoda = vehRef.wheels[kunciRoda]; if (objRoda) objRoda.rotation.x = (objRoda.rotation.x || 0) + 0; });
  // Putaran roda, diakumulasi dengan benar kali ini.
  ['fl', 'fr', 'rl', 'rr'].forEach((kunciRoda) => { const objRoda = vehRef.wheels[kunciRoda]; if (objRoda) { objRoda.userData.spin = (objRoda.userData.spin || 0) + (vehRef.speed * dtRef) / 0.33; objRoda.rotation.set(objRoda.userData.spin, 0, 0); } }); }
export function updateTraffic(G, dt) {
  if (!G.traffic) return;
  const playerX = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const playerZ = G.car ? G.car.z : (G.player ? G.player.z : 0);
  const nightFlag = G.timeOfDay > 18.5 || G.timeOfDay < 5.5;
  for (const mobil of G.traffic) {
    if (mobil.driver !== 'traffic') continue;
    const jarakPemain = Math.hypot(mobil.x - playerX, mobil.z - playerZ);
    if (jarakPemain > 500) {
      const lahirSepanjangX = rnd() < 0.5;
      const jalanLahir = pick(lahirSepanjangX ? G.roadX : G.roadZ);
      mobil.onX = lahirSepanjangX; mobil.line = jalanLahir;
      mobil.dirSign = rnd() < 0.5 ? 1 : -1;
      const nilaiJangkar = lahirSepanjangX ? playerZ : playerX;
      const lahirSepanjang = Math.max(-640, Math.min(640, nilaiJangkar + rr(-260, 260)));
      mobil.x = lahirSepanjangX ? jalanLahir + (5 * mobil.dirSign) : lahirSepanjang;
      mobil.z = lahirSepanjangX ? lahirSepanjang : jalanLahir - (5 * mobil.dirSign);
      mobil.speed = mobil.cruise; }
    // Berhenti untuk kendaraan di depan (dalam lajur yang sama, kira-kira).
    let terhalangFlag = false;
    for (const mobilLain of G.traffic) { if (mobilLain === mobil) continue; const selisihX = mobilLain.x - mobil.x, selisihZ = mobilLain.z - mobil.z; const majuX = Math.sin(mobil.angle), majuZ = Math.cos(mobil.angle); const jarakDepan = (selisihX * majuX) + (selisihZ * majuZ); const jarakSamping = Math.abs((selisihX * majuZ) - (selisihZ * majuX)); if (jarakDepan > 0 && jarakDepan < 9 && jarakSamping < 2.2) { terhalangFlag = true; break; } }
    if (G.car && G.car !== mobil) { const selisihX = G.car.x - mobil.x, selisihZ = G.car.z - mobil.z; const jarakDepan = (selisihX * Math.sin(mobil.angle)) + (selisihZ * Math.cos(mobil.angle)); const jarakSamping = Math.abs((selisihX * Math.cos(mobil.angle)) - (selisihZ * Math.sin(mobil.angle))); if (jarakDepan > 0 && jarakDepan < 9 && jarakSamping < 2.4) terhalangFlag = true; }
    // NPC yang hancur (health < 35) melaju pada 72%, seperti pemain.
    const kecepatanSasaran = terhalangFlag ? 0 : mobil.cruise * (mobil.health < 35 ? 0.72 : 1);
    mobil.speed += Math.max(-8 * dt, Math.min(3 * dt, kecepatanSasaran - mobil.speed));
    // Maju sepanjang sumbu saat ini; pada persimpangan, mungkin berbelok.
    mobil.x += Math.sin(mobil.angle) * mobil.speed * dt;
    mobil.z += Math.cos(mobil.angle) * mobil.speed * dt;
    const jalanMelintang = mobil.onX ? G.roadZ : G.roadX;
    const nilaiSepanjang = mobil.onX ? mobil.z : mobil.x;
    for (const nilaiSilang of jalanMelintang) {
      if (Math.abs(nilaiSepanjang - nilaiSilang) < 1.2 && Math.abs(mobil.speed) > 1 && rnd() < 0.35) {
        // Berbelok ke jalan yang melintang.
        if (mobil.onX) { mobil.z = nilaiSilang; mobil.line = nilaiSilang; } else { mobil.x = nilaiSilang; mobil.line = nilaiSilang; }
        mobil.onX = !mobil.onX;
        mobil.dirSign = rnd() < 0.5 ? 1 : -1;
        if (mobil.onX) { mobil.x = mobil.line + (5 * mobil.dirSign); mobil.angle = mobil.dirSign > 0 ? 0 : Math.PI; }
        else { mobil.z = mobil.line - (5 * mobil.dirSign); mobil.angle = mobil.dirSign > 0 ? Math.PI / 2 : -Math.PI / 2; }
        break; } }
    // Pelunakan offset lajur dan pantulan batas.
    if (mobil.onX) mobil.x += ((mobil.line + (5 * mobil.dirSign)) - mobil.x) * Math.min(1, dt * 2); else mobil.z += ((mobil.line - (5 * mobil.dirSign)) - mobil.z) * Math.min(1, dt * 2);
    if (Math.abs(mobil.x) > 655 || Math.abs(mobil.z) > 655) { mobil.angle += Math.PI; mobil.dirSign *= -1; mobil.x = Math.max(-650, Math.min(650, mobil.x)); mobil.z = Math.max(-650, Math.min(650, mobil.z)); }
    mobil.mesh.position.set(mobil.x, groundH(mobil.x, mobil.z) + 0.02, mobil.z);
    mobil.mesh.rotation.y = mobil.angle;
    const langkahPutar = (mobil.speed * dt) / (mobil.mesh.userData.wheelR || 0.33);
    putarRodaLaluLintas(mobil, langkahPutar, dt);
    if (nightFlag && !mobil.nightGlow) { const sprPijar = glowSprite(0xffe9a0, 2.2); sprPijar.position.set(0, 0.7, (mobil.spec.len / 2) + 0.4); mobil.mesh.add(sprPijar); mobil.nightGlow = sprPijar; }
    if (!nightFlag && mobil.nightGlow) { mobil.mesh.remove(mobil.nightGlow); mobil.nightGlow = null; } }
  // Asap kerusakan kap datang dari updateDamageFx, secara terpusat (di bawah).
}
export function damageVehicle(G, veh, amount) {
  veh.health = Math.max(0, veh.health - amount);
  armFxHook(G);
  // Semburan benturan datang dari kap, bukan pusat mobil.
  const impactPos = hoodPosWorld(veh, new THREE.Vector3());
  spawnSmokeAt(G, impactPos, 3, veh.health < 25);
  for (let puffIdx = 0; puffIdx < 3; puffIdx++) spawnDamagePuff(G, veh, false); }
// --- asap kerusakan + lampu depan malam --------------------------------
// Faktor kegelapan D (0 siang .. 1 malam): sinyal yang sama yang
// dipakai pembaruan dunia untuk pijar tandanya — dayAmt =
// clamp(sin((t-6)/12*PI),0,1) dan malam = 1 - dayAmt. Ia dihitung
// ulang di sini dari G.timeOfDay jadi file ini tak butuh impor baru.
export function darknessFactor(G) {
  const todVal = (G && typeof G.timeOfDay === 'number') ? G.timeOfDay : 10.5;
  const dayLevel = Math.max(0, Math.min(1, Math.sin(((todVal - 6) / 12) * Math.PI)));
  return 1 - dayLevel; }
const hoodPosWorld = (veh, outVec) => {
  const specRef = veh.spec || {};
  const hoodH = specRef.hood != null ? 0.62 + specRef.hood * 0.28 : 0.85;
  outVec.set(0, hoodH, (specRef.len || 4.4) * 0.32);
  if (veh.mesh && veh.mesh.localToWorld) { veh.mesh.updateMatrixWorld(true); veh.mesh.localToWorld(outVec); } else outVec.add(veh.mesh.position);
  return outVec; };
// Pita kerusakan: laju emisi (puff/detik), nada, ukuran awal, ukuran
// tumbuh, nilai opacity.
const bandForHealth = (healthVal) => {
  // Tiga pita yang sama yang dihasilkan rantai if lama, dipilih di
  // sini dengan ternary bersarang: asap berat di bawah 15, sedang di
  // bawah 40, wisps ringan dari 40..70.
  let bandPick;
  if (healthVal < 15) bandPick = { rate: 12, color: 0x232528, s0: 0.9, s1: 3.2, op: 0.65 };
  else if (healthVal < 40) bandPick = { rate: 6, color: 0x777c83, s0: 0.7, s1: 2.4, op: 0.45 };
  else bandPick = { rate: 2, color: 0xb8bcc0, s0: 0.5, s1: 1.6, op: 0.28 };
  return bandPick; };
const hoodScratchVec = new THREE.Vector3();
export function spawnDamagePuff(G, veh, prewarm, ageOverride) {
  buildSmokePool(G);
  if (!smokePool) return;
  const band = bandForHealth(veh.health);
  for (const puff of smokePool) {
    if (puff.life > 0) continue;
    hoodPosWorld(veh, hoodScratchVec);
    const startAge = typeof ageOverride === 'number' ? ageOverride : (prewarm ? rr(0, 1.1) : 0);
    puff.kind = 'dmg'; puff.fire = false; puff.max = 1.4; puff.life = 1.4 - startAge;
    puff.s0 = band.s0; puff.s1 = band.s1; puff.op = band.op;
    puff.s.material.color.set(band.color);
    puff.s.position.set(hoodScratchVec.x + rr(-0.15, 0.15) + 0.3 * startAge, hoodScratchVec.y + 1.2 * startAge, hoodScratchVec.z + rr(-0.15, 0.15));
    puff.vx = 0.3 + rr(-0.08, 0.08); puff.vy = 1.2 + rr(-0.2, 0.2); puff.vz = rr(-0.08, 0.08);
    const startScale = puff.s0 + (puff.s1 - puff.s0) * (startAge / 1.4);
    puff.s.scale.set(startScale, startScale, 1);
    puff.s.visible = true;
    return; } }
// Bentuk lebih dulu gumpalan di atas mobil rusak (pementasan foto).
// Pra-usia tersebar secara deterministik melintasi 0..1.2 dtk (puff
// tertua lebih dulu) supaya kolom penuh — bukan gumpalan acak — ada pada waktu frame.
export function primeDamageSmoke(G, veh, count) {
  const totalCount = count || 10;
  for (let puffIdx = 0; puffIdx < totalCount; puffIdx++) spawnDamagePuff(G, veh, true, totalCount > 1 ? (puffIdx / (totalCount - 1)) * 1.2 : 0); }
// === lampu depan ======================================================
// Sprite pijar ialah anak THREE.Sprite: tiap pembantu pertukaran
// GLB dalam file ini mempertahankan anak isSprite tetap terlihat,
// jadi pijar selamat dari pertukaran tanpa disentuh. Kerucut ialah
// Mesh (pembantu AKAN menyembunyikannya bila ia berjalan sesudah
// mereka ditambahkan), jadi updateDamageFx menegaskan ulang
// visibilitas kerucut tiap frame — pertukaran dapat menyembunyikan
// kerucut selama paling banyak satu frame. Pertukaran Hero/GTR hanya
// membuang potret _procChildren yang diambil saat spawn, jadi anak
// kemudian ini tak pernah dibuang di sana juga.
const headConeGeo = new THREE.ConeGeometry(1.15, 7, 20, 1, true);
headConeGeo.translate(0, -3.5, 0);
const headConeMat = new THREE.MeshBasicMaterial({
  color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
  depthWrite: false, side: THREE.DoubleSide, fog: false,
});
function buildHeadlights(veh) {
  if (veh._hl || !veh.mesh || !veh.spec) return;
  const specRef = veh.spec, specWid = specRef.wid, specLen = specRef.len;
  const makeGlowSpr = (tintVal, scaleVal, gx, gy, gz) => { const spr = glowSprite(tintVal, scaleVal); spr.position.set(gx, gy, gz); spr.userData.s25Light = true; veh.mesh.add(spr); return spr; };
  const hlSet = {};
  hlSet.glowL = makeGlowSpr(0xffe9a0, 1.25, -specWid * 0.32, 0.62, specLen / 2 + 0.12);
  hlSet.glowR = makeGlowSpr(0xffe9a0, 1.25, specWid * 0.32, 0.62, specLen / 2 + 0.12);
  hlSet.tailL = makeGlowSpr(0xff2a22, 0.85, -specWid * 0.32, 0.72, -specLen / 2 - 0.1);
  hlSet.tailR = makeGlowSpr(0xff2a22, 0.85, specWid * 0.32, 0.72, -specLen / 2 - 0.1);
  hlSet.cones = [];
  [-1, 1].forEach((sideSign) => {
    const coneMesh = new THREE.Mesh(headConeGeo, headConeMat.clone());
    coneMesh.position.set(sideSign * specWid * 0.32, 0.58, specLen / 2);
    coneMesh.rotation.x = -Math.PI / 2 + 0.07;
    coneMesh.visible = false;
    coneMesh.userData.s25Light = true;
    veh.mesh.add(coneMesh);
    hlSet.cones.push(coneMesh); });
  veh._hl = hlSet; }
function buildPlayerSpot(veh) {
  if (veh._hlSpot || !veh.mesh) return;
  const specLen = veh.spec.len;
  const spotLight = new THREE.SpotLight(0xffe6b8, 0, 40, 0.5, 0.6);
  spotLight.position.set(0, 0.7, specLen / 2);
  spotLight.target.position.set(0, 0, specLen / 2 + 18);
  spotLight.userData.s25Light = true;
  veh.mesh.add(spotLight); veh.mesh.add(spotLight.target);
  veh._hlSpot = spotLight; }
let fxHookArmed = false;
const armFxHook = (G) => {
  if (fxHookArmed || !G || !Array.isArray(G.updaters)) return;
  fxHookArmed = true;
  G.updaters.push((G2, dt) => { try { updateDamageFx(G2, dt || 0.016); } catch (e) {} }); };
export function updateDamageFx(G, dt) {
  if (!G || !Array.isArray(G.vehicles)) return;
  const darkAmt = darknessFactor(G);
  const playerRefX = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const playerRefZ = G.car ? G.car.z : (G.player ? G.player.z : 0);
  // Pemancar asap: 10 kendaraan rusak terdekat kepada pemain.
  const damagedList = [];
  G.vehicles.forEach((veh) => { if (veh && veh.health < 70 && veh.mesh) damagedList.push(veh); });
  damagedList.sort((vehA, vehB) => ((vehA.x - playerRefX) ** 2 + (vehA.z - playerRefZ) ** 2) - ((vehB.x - playerRefX) ** 2 + (vehB.z - playerRefZ) ** 2));
  const emitterSet = new Set(damagedList.slice(0, 10));
  const lightsOn = darkAmt > 0.25;
  for (const veh of G.vehicles) {
    if (!veh || !veh.mesh) continue;
    buildHeadlights(veh);
    const hlSet = veh._hl;
    if (!hlSet) continue;
    const brakingFlag = veh._prevSpeed != null && dt > 0 && (veh._prevSpeed - (veh.speed || 0)) / dt > 2;
    veh._prevSpeed = veh.speed || 0;
    [hlSet.glowL, hlSet.glowR].forEach((glowSpr) => { glowSpr.visible = lightsOn; glowSpr.material.opacity = 0.85 * darkAmt; });
    [hlSet.tailL, hlSet.tailR].forEach((glowSpr) => { glowSpr.visible = lightsOn; glowSpr.material.opacity = (brakingFlag ? 0.95 : 0.4) * darkAmt; });
    hlSet.cones.forEach((coneMesh) => { coneMesh.visible = lightsOn; coneMesh.material.opacity = 0.10 * darkAmt; });
    if (emitterSet.has(veh)) {
      veh._smokeAcc = (veh._smokeAcc || 0) + bandForHealth(veh.health).rate * dt;
      while (veh._smokeAcc >= 1) { veh._smokeAcc -= 1; spawnDamagePuff(G, veh, false); } } }
  // Spotlight asli khusus pemain (pasangan warisan duduk pada 60, matahari pada 1.52).
  if (G.car && G.car.mesh) {
    buildPlayerSpot(G.car);
    if (G.car._hlSpot) G.car._hlSpot.intensity = 55 * darkAmt; } }
// === kolam asap ==================================================
let smokePool = null;
function buildSmokePool(G) {
  if (smokePool) return;
  smokePool = [];
  const sheet = document.createElement('canvas'); sheet.width = sheet.height = 64;
  const brush = sheet.getContext('2d');
  const grad = brush.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  brush.fillStyle = grad; brush.fillRect(0, 0, 64, 64);
  const puffTex = new THREE.CanvasTexture(sheet);
  for (let poolIdx = 0; poolIdx < 120; ++poolIdx) {
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, opacity: 0, depthWrite: false }));
    spr.visible = false;
    G.scene.add(spr);
    const puffRec = {};
    puffRec.s = spr; puffRec.life = 0; puffRec.max = 1; puffRec.fire = false; puffRec.kind = 'legacy';
    puffRec.vx = 0; puffRec.vy = 0; puffRec.vz = 0; puffRec.s0 = 0.7; puffRec.s1 = 2.9; puffRec.op = 0.5;
    smokePool.push(puffRec); } }
export function spawnSmokeAt(G, pos, count, isFire) {
  buildSmokePool(G);
  let spawnedCount = 0;
  for (const puff of smokePool) {
    if (spawnedCount >= count) break;
    if (puff.life > 0) continue;
    puff.life = puff.max = rr(0.6, 1.3);
    puff.fire = !!isFire;
    puff.kind = 'legacy';
    puff.s.position.set(pos.x + rr(-0.4, 0.4), pos.y + rr(0.5, 1), pos.z + rr(-0.4, 0.4));
    puff.s.material.color.set(isFire ? 0xff7a2a : 0x8a8f96);
    puff.s.scale.set(0.7, 0.7, 1);
    puff.s.visible = true;
    puff.vx = rr(-0.3, 0.3); puff.vy = rr(1, 2); puff.vz = rr(-0.3, 0.3);
    ++spawnedCount; } }
export function updateSmoke(G, dt) {
  if (smokePool) for (const puff of smokePool) {
    if (puff.life <= 0) continue;
    puff.life -= dt;
    if (puff.life <= 0) {
      puff.s.visible = false;
      puff.s.material.opacity = 0;
      continue; }
    const lifeFrac = 1 - puff.life / puff.max;
    puff.s.position.x += puff.vx * dt;
    puff.s.position.y += puff.vy * dt;
    puff.s.position.z += puff.vz * dt;
    if (puff.kind === 'dmg') {
      const grownScale = puff.s0 + (puff.s1 - puff.s0) * lifeFrac;
      puff.s.scale.set(grownScale, grownScale, 1);
      puff.s.material.opacity = puff.op * (1 - lifeFrac);
      continue; }
    const grownScale = 0.7 + lifeFrac * (puff.fire ? 1.2 : 2.2);
    puff.s.scale.set(grownScale, grownScale, 1);
    puff.s.material.opacity = (puff.fire ? 0.75 : 0.5) * (1 - lifeFrac) * (puff.fire ? (0.7 + rnd() * 0.5) : 1);
    if (puff.fire) puff.s.material.color.setHSL(0.06 + rnd() * 0.03, 1, 0.5); } }
export { hexCss };
