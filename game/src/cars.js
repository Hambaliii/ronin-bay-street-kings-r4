// Wave-8 pass: procedural car bodies, liveries and the GLB swap helpers.
// The assembly order and every painted detail below match the prior build.
import * as THREE from 'three'; import {
  CARS }
from './config.js'; import {
  rnd, rr, ri, pick }
from './random.js'; import {
  groundH, glowSprite }
from './world.js'; import {
  loadHeroAsset }
from './assets.js'; const zW8JUMLAH_DIGIT_HEX = 6;

const hexCss = (zW8NilaiWarna) => '#' + zW8NilaiWarna.toString(16).padStart(zW8JUMLAH_DIGIT_HEX, '0');

  function zW8TinggiKelasAtap(zW8KelasBadan) {
    const zW8TabelKelas = {
    'suv' : 1.55, 'truck' : 1.5, 'kei' : 1.4
  }; if (zW8KelasBadan === 'van') return zW8TabelKelas.suv; return zW8TabelKelas[zW8KelasBadan]; }
  function zW8TinggiBadanUntuk(zW8SpecMasukan) {
  const zW8KelasBadanQ = zW8SpecMasukan.body; const zW8TinggiTetap = zW8TinggiKelasAtap(zW8KelasBadanQ); if (zW8TinggiTetap !== undefined) return zW8TinggiTetap;
  const zW8BonusSedanWagon = (zW8KelasBadanQ === 'sedan' || zW8KelasBadanQ === 'wagon') ? 0.18 : 0; return 1.05 + zW8BonusSedanWagon; }
  function zW8BodyOutline(zW8SpecMasukanQ) {
  const zW8LenPenuh = zW8SpecMasukanQ.len, zW8LenParuh = zW8LenPenuh / 2; const zW8TinggiBdn = zW8TinggiBadanUntuk(zW8SpecMasukanQ);
  const zW8KapGaris = (zW8SpecMasukanQ.hood * 0.28) + 0.62, zW8SabukGaris = 0.72 * zW8TinggiBdn; const zW8Siluet = new THREE.Shape();
  zW8Siluet.moveTo(0.12 - (zW8LenParuh), 0.18); zW8Siluet.quadraticCurveTo(- 0.02 - (zW8LenParuh), 0.3, - zW8LenParuh, zW8SabukGaris * 0.8);
  const zW8AtapRataFlag = zW8SpecMasukanQ.roof === 'wagon' || zW8SpecMasukanQ.body === 'van' || zW8SpecMasukanQ.body === 'suv'; const zW8LukisAtapRata = () => {
    zW8Siluet.quadraticCurveTo(- zW8LenParuh, zW8TinggiBdn * 0.97, 0.3 - (zW8LenParuh), zW8TinggiBdn);
    zW8Siluet.lineTo(zW8LenParuh * ((zW8SpecMasukanQ.cabin * 0.2) + 0.2), zW8TinggiBdn);
    zW8Siluet.quadraticCurveTo(zW8LenParuh * 0.75, zW8TinggiBdn * 0.96, zW8LenParuh * 0.88, zW8KapGaris + 0.1);
  }; const zW8LukisHatch = () => {
    zW8Siluet.quadraticCurveTo(0.05 - (zW8LenParuh), zW8TinggiBdn * 0.92, 0.35 - (zW8LenParuh), zW8TinggiBdn * 0.98);
    zW8Siluet.quadraticCurveTo((zW8LenPenuh * 0.28) - (zW8LenParuh), zW8TinggiBdn, (zW8LenPenuh * ((zW8SpecMasukanQ.cabin * 0.18) + 0.32)) - (zW8LenParuh), zW8TinggiBdn * 0.99);
    zW8Siluet.quadraticCurveTo(zW8LenParuh * 0.72, zW8TinggiBdn * 0.9, zW8LenParuh * 0.86, zW8KapGaris + 0.08);
  }; const zW8LukisFastback = () => {
    zW8Siluet.bezierCurveTo(0.1 - (zW8LenParuh), zW8SabukGaris, (zW8LenPenuh * 0.3) - (zW8LenParuh), zW8TinggiBdn * 0.99, (zW8LenPenuh * ((zW8SpecMasukanQ.cabin * 0.16) + 0.34)) - (zW8LenParuh), zW8TinggiBdn);
    zW8Siluet.quadraticCurveTo(zW8LenParuh * 0.55, zW8TinggiBdn * 0.97, zW8LenParuh * 0.84, zW8KapGaris + 0.06);
  }; const zW8LukisBiasa = () => {
    zW8Siluet.quadraticCurveTo((zW8LenPenuh * 0.18) - (zW8LenParuh), zW8TinggiBdn * 0.99, (zW8LenPenuh * ((zW8SpecMasukanQ.cabin * 0.16) + 0.3)) - (zW8LenParuh), zW8TinggiBdn);
    zW8Siluet.quadraticCurveTo(zW8LenParuh * 0.45, zW8TinggiBdn * 0.98, zW8LenParuh * 0.8, zW8KapGaris + 0.1);
    if (zW8SpecMasukanQ.body === 'sedan' || zW8SpecMasukanQ.body === 'roadster') zW8Siluet.quadraticCurveTo(zW8LenParuh * 0.9, zW8KapGaris + 0.04, zW8LenParuh * 0.94, zW8KapGaris);
  };
  const zW8LukisDipilih = zW8AtapRataFlag ? zW8LukisAtapRata : zW8SpecMasukanQ.roof === 'hatch' ? zW8LukisHatch : zW8SpecMasukanQ.roof === 'fastback' ? zW8LukisFastback : zW8LukisBiasa;
  zW8LukisDipilih(); zW8Siluet.quadraticCurveTo(0.04 + zW8LenParuh, zW8KapGaris * 0.72, zW8LenParuh, 0.42);
  zW8Siluet.quadraticCurveTo(- 0.02 + zW8LenParuh, 0.2, zW8LenParuh - (0.3), 0.18); zW8Siluet.lineTo(0.12 - (zW8LenParuh), 0.18); const zW8RekDimensi = {
  }; zW8RekDimensi.tall = zW8TinggiBdn; zW8RekDimensi.hoodY = zW8KapGaris; zW8RekDimensi.beltY = zW8SabukGaris; zW8Siluet.userData = zW8RekDimensi; return zW8Siluet; }

  function zW8GlassOutline(zW8SpecMasukanQQ) {
  const zW8LenPenuhQ = zW8SpecMasukanQQ.len, zW8LenParuhQ = zW8LenPenuhQ / 2; const zW8BadanKaca = zW8SpecMasukanQQ.body;
  const zW8TinggiBdnQ = (zW8BadanKaca === 'suv' || zW8BadanKaca === 'van') ? 1.55 : zW8BadanKaca === 'truck' ? 1.5 : zW8BadanKaca === 'kei' ? 1.4 : ((zW8BadanKaca === 'sedan' || zW8BadanKaca === 'wagon') ? 0.18 : 0) + 1.05;
  const zW8SabukGarisQ = 0.72 * zW8TinggiBdnQ;
  const zW8KelasAtapDatar = zW8SpecMasukanQQ.roof === 'wagon' || zW8SpecMasukanQQ.body === 'van' || zW8SpecMasukanQQ.body === 'suv';
  const zW8TepiBelakangX = zW8KelasAtapDatar ? 0.35 - (zW8LenParuhQ) : zW8SpecMasukanQQ.roof === 'hatch' ? 0.55 - (zW8LenParuhQ) : (zW8LenPenuhQ * ((zW8SpecMasukanQQ.cabin * 0.14) + 0.30)) - (zW8LenParuhQ);
  const zW8TepiDepanX = (zW8SpecMasukanQQ.roof === 'flat' && zW8SpecMasukanQQ.body !== 'kei') ? zW8LenParuhQ * 0.52 : zW8LenParuhQ * ((zW8SpecMasukanQQ.cabin * 0.15) + 0.35);
  const zW8SiluetKaca = new THREE.Shape(); zW8SiluetKaca.moveTo(zW8TepiBelakangX, zW8SabukGarisQ);
  zW8SiluetKaca.quadraticCurveTo(0.25 + zW8TepiBelakangX, zW8TinggiBdnQ * 0.99, (zW8LenPenuhQ * 0.18) + zW8TepiBelakangX, zW8TinggiBdnQ * 0.985);
  zW8SiluetKaca.quadraticCurveTo(zW8TepiDepanX - (0.2), zW8TinggiBdnQ * 0.97, zW8TepiDepanX, zW8SabukGarisQ + 0.04);
  zW8SiluetKaca.lineTo(zW8TepiBelakangX, zW8SabukGarisQ); return zW8SiluetKaca; }

  const zW8ExtrudeProfile = (zW8SiluetProfil, zW8LebarNilai, zW8BevelTebal, zW8BevelUkuran) => {
  const zW8DalamEkstrusi = Math.max(0.2, zW8LebarNilai + (zW8BevelUkuran * - 2)); const zW8OpsiEkstrusi = {
    depth : zW8DalamEkstrusi, bevelEnabled : true, bevelThickness : zW8BevelTebal, bevelSize : zW8BevelUkuran, bevelSegments : 3, steps : 1, curveSegments : 12
  }; const zW8GeoEkstrusi = new THREE.ExtrudeGeometry(zW8SiluetProfil, zW8OpsiEkstrusi); zW8GeoEkstrusi.translate(0, 0, zW8BevelUkuran - (zW8LebarNilai / 2));
  zW8GeoEkstrusi.rotateY(Math.PI / 2); return zW8GeoEkstrusi; };

  function zW8BuildLiveryTexture(zW8JenisLivery, zW8HexCatCadangan) {
  const zW8KanvasLivery = document.createElement('canvas'); zW8KanvasLivery.width = 512; zW8KanvasLivery.height = 128;
  const zW8KuasLivery = zW8KanvasLivery.getContext('2d'); zW8KuasLivery.clearRect(0, 0, 512, 128); const zW8LukisPolisi = () => {
    zW8KuasLivery.fillStyle = '#f4f6f8'; zW8KuasLivery.fillRect(90, 18, 330, 78); zW8KuasLivery.fillStyle = '#1c4f9c'; zW8KuasLivery.fillRect(0, 78, 512, 16);
    zW8KuasLivery.fillStyle = '#14161a'; zW8KuasLivery.font = 'bold 52px sans-serif'; zW8KuasLivery.textAlign = 'center'; zW8KuasLivery.fillText('RBPD', 256, 72);
    zW8KuasLivery.fillStyle = '#c8a028'; zW8KuasLivery.beginPath(); zW8KuasLivery.arc(120, 56, 20, 0, 6.3); zW8KuasLivery.fill();
  }; const zW8LukisTaksi = () => {
    // Checker band: walk the strip in fixed steps, alternating the two tones.
    for (let zW8SelX = 0; zW8SelX < 512; zW8SelX += 24) {
        for (let zW8SelY = 0; zW8SelY < 2; ++ zW8SelY) {
        zW8KuasLivery.fillStyle = ! (((zW8SelX / 24) + zW8SelY) % 2) ? '#f4f6f8' : '#14161a'; zW8KuasLivery.fillRect(zW8SelX, (zW8SelY * 14) + 52, 24, 14); }
      }
  }; const zW8LukisSupra = () => {
    zW8KuasLivery.fillStyle = '#14161a'; zW8KuasLivery.font = 'bold 26px sans-serif'; zW8KuasLivery.textAlign = 'center'; zW8KuasLivery.fillText('TEN-SECOND', 256, 66);
  }; const zW8LukisGtr = () => {
    zW8KuasLivery.fillStyle = '#c8ccd2'; zW8KuasLivery.fillRect(0, 56, 512, 14); zW8KuasLivery.fillStyle = '#14161a'; zW8KuasLivery.font = 'bold 24px sans-serif';
    zW8KuasLivery.textAlign = 'center'; zW8KuasLivery.fillText('BAYSIDE GHOST', 256, 46);
  }; const zW8PetaLukis = new Map(); zW8PetaLukis.set ('police', zW8LukisPolisi); zW8PetaLukis.set ('taxi', zW8LukisTaksi);
  zW8PetaLukis.set ('hero-supra', zW8LukisSupra); zW8PetaLukis.set ('hero-gtr', zW8LukisGtr); if (zW8PetaLukis.has(zW8JenisLivery)) zW8PetaLukis.get (zW8JenisLivery)();
  void zW8HexCatCadangan; const zW8TexLivery = new THREE.CanvasTexture(zW8KanvasLivery); zW8TexLivery.colorSpace = THREE.SRGBColorSpace; return zW8TexLivery; }
  export function makeCarMesh(zW8Spec, zW8PaintHex, zW8Opts) {
    const zW8OpsiRakit = zW8Opts || {
  }; const zW8CatDipakai = zW8PaintHex != null ? zW8PaintHex : zW8Spec.color; const zW8GrupRakit = new THREE.Group();
  const zW8LenSpec = zW8Spec.len, zW8WidSpec = zW8Spec.wid; const zW8IalahTruk = zW8Spec.body === 'truck'; const zW8SpecKabin = zW8IalahTruk ? {
    ... zW8Spec, len : 2.2
  } : zW8Spec; const zW8GeoBadanUtama = zW8ExtrudeProfile(zW8BodyOutline(zW8SpecKabin), zW8WidSpec, 0.09, 0.07); const zW8MatCatUtama = new THREE.MeshStandardMaterial({
    color : zW8CatDipakai, metalness : 0.55, roughness : 0.35
  }); const zW8MeshBadanUtama = new THREE.Mesh(zW8GeoBadanUtama, zW8MatCatUtama); zW8GrupRakit.add(zW8MeshBadanUtama); if (zW8Spec.twoTone) {
      const zW8MeshTrimDua = new THREE.Mesh(new THREE.BoxGeometry(zW8WidSpec * 0.99, 0.34, zW8LenSpec * 0.98), new THREE.MeshStandardMaterial({
      color : 0x14161a, metalness : 0.4, roughness : 0.5
    })); zW8MeshTrimDua.position.y = 0.3; zW8GrupRakit.add(zW8MeshTrimDua); }
    if (zW8IalahTruk) {
      const zW8MatKargoTruk = new THREE.MeshStandardMaterial({
      color : 0xd8d8d8, roughness : 0.7 });

    const zW8MeshKargoTruk = new THREE.Mesh(new THREE.BoxGeometry(zW8WidSpec, 2.1, 3.9), zW8MatKargoTruk); zW8MeshKargoTruk.position.set (0, 1.45, - 1.15);
    zW8GrupRakit.add(zW8MeshKargoTruk); const zW8MeshGarisTruk = new THREE.Mesh(new THREE.PlaneGeometry(zW8WidSpec * 0.7, 1.6), new THREE.MeshBasicMaterial({
      color : 0x888888, transparent : true, opacity : 0.5
    })); zW8MeshGarisTruk.position.set (0, 1.45, - 3.11); zW8MeshGarisTruk.rotation.y = Math.PI; zW8GrupRakit.add(zW8MeshGarisTruk);
    zW8MeshBadanUtama.position.z = (zW8LenSpec / 2) - (1.1); }

    const zW8MatKacaGelap = new THREE.MeshStandardMaterial({
    color : 0x10151c, metalness : 0.9, roughness : 0.12
  }); const zW8MeshKacaGelap = new THREE.Mesh(zW8ExtrudeProfile(zW8GlassOutline(zW8SpecKabin), zW8WidSpec * 0.86, 0.05, 0.04), zW8MatKacaGelap);
  if (zW8IalahTruk) zW8MeshKacaGelap.position.z = (zW8LenSpec / 2) - (1.1); zW8GrupRakit.add(zW8MeshKacaGelap);

    const zW8MatTrimGelap = new THREE.MeshStandardMaterial({
    color : 0x17181c, roughness : 0.7
  }); const zW8RakitBemperSkirt = (zW8TandaSisi) => {
    const zW8MeshBemperBaru = new THREE.Mesh(new THREE.BoxGeometry(zW8WidSpec * 0.94, 0.2, 0.28), zW8MatTrimGelap);
    zW8MeshBemperBaru.position.set (0, 0.3, zW8TandaSisi * ((zW8LenSpec / 2) - (0.02))); zW8GrupRakit.add(zW8MeshBemperBaru);
    const zW8MeshSkirtBaru = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, zW8LenSpec * 0.55), zW8MatTrimGelap);
    zW8MeshSkirtBaru.position.set (zW8TandaSisi * ((zW8WidSpec / 2) - (0.01)), 0.24, 0); zW8GrupRakit.add(zW8MeshSkirtBaru);
  }; [- 1, 1].forEach(zW8RakitBemperSkirt);

    const zW8RakitSpion = (zW8TandaSisiQ) => {
    const zW8MeshTangkaiBaru = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.03), zW8MatTrimGelap);
    zW8MeshTangkaiBaru.position.set (zW8TandaSisiQ * ((zW8WidSpec / 2) + 0.04), 1.0, zW8LenSpec * 0.18); zW8GrupRakit.add(zW8MeshTangkaiBaru);
    const zW8MeshCerminBaru = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.16), zW8MatCatUtama);
    zW8MeshCerminBaru.position.set (zW8TandaSisiQ * ((zW8WidSpec / 2) + 0.11), 1.02, zW8LenSpec * 0.18); zW8GrupRakit.add(zW8MeshCerminBaru);
  }; [- 1, 1].forEach(zW8RakitSpion);

  const zW8BadanRoda = zW8Spec.body;
  const zW8RadiusBan = (zW8BadanRoda === 'suv' || zW8BadanRoda === 'truck' || zW8BadanRoda === 'van') ? 0.42 : zW8BadanRoda === 'kei' ? 0.28 : (zW8BadanRoda === 'sedan' || zW8BadanRoda === 'wagon') ? 0.34 : 0.33;
  const zW8JarakPoros = zW8LenSpec * 0.62; const zW8GeoBanSil = new THREE.CylinderGeometry(zW8RadiusBan, zW8RadiusBan, 0.24, 20); zW8GeoBanSil.rotateZ(Math.PI / 2);
  const zW8GeoHubSil = new THREE.CylinderGeometry(zW8RadiusBan * 0.62, zW8RadiusBan * 0.62, 0.26, 12); zW8GeoHubSil.rotateZ(Math.PI / 2);
    const zW8MatBanGelap = new THREE.MeshStandardMaterial({
    color : 0x14161a, roughness : 0.9
  }); const zW8MatHubKilap = new THREE.MeshStandardMaterial({
    color : zW8Spec.wheels || 0xc0c0c0, metalness : 0.85, roughness : 0.3
  }); const zW8MatJariHub = zW8MatHubKilap; const zW8PetaPivotRoda = {
  }; const zW8GeoLengkungRoda = new THREE.TorusGeometry(zW8RadiusBan + 0.06, 0.045, 6, 14, Math.PI); const zW8MatLengkungRoda = new THREE.MeshStandardMaterial({
    color : 0x0c0d0f, roughness : 0.8
  }); const zW8RakitSatuRoda = (zW8KunciRoda, zW8SisiX, zW8SisiZ) => {
    const zW8PivotBaru = new THREE.Group(); zW8PivotBaru.position.set (zW8SisiX * ((zW8WidSpec / 2) - (0.02)), zW8RadiusBan, zW8SisiZ * (zW8JarakPoros / 2));
    zW8GrupRakit.add(zW8PivotBaru); zW8PivotBaru.add(new THREE.Mesh(zW8GeoBanSil, zW8MatBanGelap)); zW8PivotBaru.add(new THREE.Mesh(zW8GeoHubSil, zW8MatHubKilap));
      for (let zW8UrutJari = 0; ! (zW8UrutJari >= 5); ++ zW8UrutJari) {
      const zW8MeshJariBaru = new THREE.Mesh(new THREE.BoxGeometry(0.27, zW8RadiusBan * 0.16, zW8RadiusBan * 0.9), zW8MatJariHub);
      zW8MeshJariBaru.rotation.x = (zW8UrutJari / 5) * Math.PI; zW8PivotBaru.add(zW8MeshJariBaru); }
    const zW8MeshLengkungBaru = new THREE.Mesh(zW8GeoLengkungRoda, zW8MatLengkungRoda);
    zW8MeshLengkungBaru.position.set (zW8SisiX * ((zW8WidSpec / 2) + 0.03), zW8RadiusBan, zW8SisiZ * (zW8JarakPoros / 2)); zW8MeshLengkungBaru.rotation.y = Math.PI / 2;
    zW8GrupRakit.add(zW8MeshLengkungBaru); zW8PetaPivotRoda[zW8KunciRoda] = zW8PivotBaru; return zW8PivotBaru;
  }; const zW8DaftarPosisiRoda = [['fl', - 1, 1], ['fr', 1, 1], ['rl', - 1, - 1], ['rr', 1, - 1]];
  zW8DaftarPosisiRoda.forEach(([zW8KunciRodaQ, zW8SisiXQ, zW8SisiZQ]) => zW8RakitSatuRoda(zW8KunciRodaQ, zW8SisiXQ, zW8SisiZQ));

    const zW8MatLampuMuka = new THREE.MeshStandardMaterial({
    color : 0xfff2c0, emissive : 0xffe9a0, emissiveIntensity : 0.7, roughness : 0.2
  }); const zW8SisiPasang = [- 1, 1]; if (zW8Spec.popups) {
      [- 1, 1].forEach((zW8TandaSisiQQ) => {
      const zW8MeshPopupBaru = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.22), zW8MatLampuMuka);
      zW8MeshPopupBaru.position.set (zW8TandaSisiQQ * zW8WidSpec * 0.28, 0.86, (zW8LenSpec / 2) - (0.32)); zW8MeshPopupBaru.rotation.x = - 0.25;
      zW8GrupRakit.add(zW8MeshPopupBaru); }); } else {
      [- 1, 1].forEach((zW8TandaSisiQQQ) => {
      const zW8MeshLampuBaru = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), zW8MatLampuMuka); zW8MeshLampuBaru.scale.set (1.5, 0.55, 0.5);
      zW8MeshLampuBaru.position.set (zW8TandaSisiQQQ * zW8WidSpec * 0.3, 0.72, (zW8LenSpec / 2) - (0.05)); zW8GrupRakit.add(zW8MeshLampuBaru); }); }

    const zW8MatLampuEkor = new THREE.MeshStandardMaterial({
    color : 0x881111, emissive : 0xff2222, emissiveIntensity : 0.8
  }); if (zW8Spec.roundTail) {
    const zW8JumlahUnitEkor = zW8Spec.tail === 'quadWing' ? 4 : 2; let zW8IdxUnitEkor = 0;
      while (zW8IdxUnitEkor < zW8JumlahUnitEkor) {
      const zW8GeoSilEkor = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 12); zW8GeoSilEkor.rotateX(Math.PI / 2);
      const zW8MeshUnitEkor = new THREE.Mesh(zW8GeoSilEkor, zW8MatLampuEkor);
      zW8MeshUnitEkor.position.set ((zW8IdxUnitEkor - ((zW8JumlahUnitEkor - 1) / 2)) * 0.24, 0.78, (- zW8LenSpec / 2) - (0.02)); zW8GrupRakit.add(zW8MeshUnitEkor);
      ++ zW8IdxUnitEkor; } } else {
    const zW8MeshBatangEkorBaru = new THREE.Mesh(new THREE.BoxGeometry(zW8WidSpec * 0.7, 0.09, 0.05), zW8MatLampuEkor);
    zW8MeshBatangEkorBaru.position.set (0, 0.78, (- zW8LenSpec / 2) - (0.02)); zW8GrupRakit.add(zW8MeshBatangEkorBaru); }
  zW8GrupRakit.userData.tailMat = zW8MatLampuEkor; zW8GrupRakit.userData.headMat = zW8MatLampuMuka;

  const zW8JenisEkor = zW8Spec.tail; const zW8EkorBersayap = zW8JenisEkor === 'roundWing' || zW8JenisEkor === 'quadWing' || zW8JenisEkor === 'wing';
    if (zW8EkorBersayap) {
    const zW8GeoBilahEkor = zW8JenisEkor === 'roundWing' ? new THREE.TorusGeometry(zW8WidSpec * 0.42, 0.045, 6, 16, Math.PI) : new THREE.BoxGeometry(zW8WidSpec * 0.88, 0.05, 0.3);
    const zW8MeshBilahEkor = new THREE.Mesh(zW8GeoBilahEkor, zW8MatTrimGelap); if (zW8JenisEkor === 'roundWing') {
      zW8MeshBilahEkor.rotation.z = 0; zW8MeshBilahEkor.rotation.y = Math.PI / 2; zW8MeshBilahEkor.rotation.x = Math.PI; zW8MeshBilahEkor.scale.set (1, 1, 0.4);
      zW8MeshBilahEkor.position.set (0, 1.12, (- zW8LenSpec / 2) + 0.1); } else {
      zW8MeshBilahEkor.position.set (0, 1.18, (- zW8LenSpec / 2) + 0.08); zW8MeshBilahEkor.rotation.x = - 0.12; }
    zW8GrupRakit.add(zW8MeshBilahEkor); [- 1, 1].forEach((zW8TandaSisiQQQQ) => {
      const zW8MeshStrutBaru = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), zW8MatTrimGelap);
      zW8MeshStrutBaru.position.set (zW8TandaSisiQQQQ * zW8WidSpec * 0.3, 1.0, (- zW8LenSpec / 2) + 0.1); zW8GrupRakit.add(zW8MeshStrutBaru); });
    } else if (zW8JenisEkor === 'ducktail' || zW8JenisEkor === 'lip') {
    const zW8MeshBibirEkor = new THREE.Mesh(new THREE.BoxGeometry(zW8WidSpec * 0.8, 0.06, zW8JenisEkor === 'ducktail' ? 0.28 : 0.14), zW8MatCatUtama);
    zW8MeshBibirEkor.position.set (0, 0.98, (- zW8LenSpec / 2) + 0.08); zW8MeshBibirEkor.rotation.x = zW8JenisEkor === 'ducktail' ? - 0.35 : - 0.15;
    zW8GrupRakit.add(zW8MeshBibirEkor); }

  const zW8LiveryDipakai = zW8OpsiRakit.livery || zW8Spec.livery; if (zW8LiveryDipakai) {
    const zW8TexLiverySisi = zW8BuildLiveryTexture((zW8LiveryDipakai === 'hero-supra' || zW8LiveryDipakai === 'hero-gtr') ? zW8LiveryDipakai : zW8LiveryDipakai, zW8CatDipakai);
      zW8SisiPasang.forEach((zW8TandaSisiQQQQQ) => {
        const zW8MeshStikerBaru = new THREE.Mesh(new THREE.PlaneGeometry(zW8LenSpec * 0.72, 0.55), new THREE.MeshBasicMaterial({
        map : zW8TexLiverySisi, transparent : true
      })); zW8MeshStikerBaru.position.set (zW8TandaSisiQQQQQ * ((zW8WidSpec / 2) + 0.085), 0.62, 0);
      zW8MeshStikerBaru.rotation.y = zW8TandaSisiQQQQQ > 0 ? Math.PI / 2 : - Math.PI / 2; zW8GrupRakit.add(zW8MeshStikerBaru);
    }); if (zW8Spec.id === 'hero-supra' || zW8LiveryDipakai === 'hero-supra') {
      const zW8MeshPanelKapBaru = new THREE.Mesh(new THREE.BoxGeometry(zW8WidSpec * 0.9, 0.03, zW8LenSpec * 0.3), zW8MatTrimGelap);
      zW8MeshPanelKapBaru.position.set (0, 0.93, zW8LenSpec * 0.28); zW8GrupRakit.add(zW8MeshPanelKapBaru); } }
    if (zW8Spec.lightbar) {
    const zW8MeshDasarBarBaru = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.07, 0.3), zW8MatTrimGelap); zW8MeshDasarBarBaru.position.set (0, 1.32, 0.1);
    zW8GrupRakit.add(zW8MeshDasarBarBaru); const zW8MeshBarMerah = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28), new THREE.MeshStandardMaterial({
      color : 0xff2222, emissive : 0xff2222, emissiveIntensity : 1.4
    })); zW8MeshBarMerah.position.set (- 0.28, 1.4, 0.1); zW8GrupRakit.add(zW8MeshBarMerah);
      const zW8MeshBarBiru = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.28), new THREE.MeshStandardMaterial({
      color : 0x2255ff, emissive : 0x2255ff, emissiveIntensity : 1.4
    })); zW8MeshBarBiru.position.set (0.28, 1.4, 0.1); zW8GrupRakit.add(zW8MeshBarBiru); const zW8PijarBarMerah = glowSprite(0xff3344, 2.4);
    zW8PijarBarMerah.position.set (- 0.28, 1.45, 0.1); zW8GrupRakit.add(zW8PijarBarMerah); const zW8PijarBarBiru = glowSprite(0x3366ff, 2.4);
    zW8PijarBarBiru.position.set (0.28, 1.45, 0.1); zW8GrupRakit.add(zW8PijarBarBiru); const zW8RekBar = {
    }; zW8RekBar.red = zW8MeshBarMerah; zW8RekBar.blue = zW8MeshBarBiru; zW8RekBar.gr = zW8PijarBarMerah; zW8RekBar.gb = zW8PijarBarBiru;
    zW8GrupRakit.userData.lightbar = zW8RekBar; }
    if (zW8LiveryDipakai === 'taxi') {
      const zW8MeshTandaTaksiBaru = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), new THREE.MeshStandardMaterial({
      color : 0xfff2c0, emissive : 0xffe9a0, emissiveIntensity : 0.9
    })); zW8MeshTandaTaksiBaru.position.set (0, 1.36, 0.1); zW8GrupRakit.add(zW8MeshTandaTaksiBaru); }
  zW8AddUnderglow(zW8GrupRakit, zW8Spec, zW8OpsiRakit); zW8AddBlobShadow(zW8GrupRakit, zW8Spec); zW8GrupRakit.userData.wheels = zW8PetaPivotRoda;
  zW8GrupRakit.userData.wheelR = zW8RadiusBan; return zW8GrupRakit; }

  function zW8KumpulkanSetPertahanPolisi(zW8AkarVeh, zW8DataPengguna, zW8RodaCadangan) {
  const zW8SetSimpan = new Set(); const zW8RodaMenurutKunci = zW8DataPengguna.wheels || zW8RodaCadangan || {
  }; Object.values(zW8RodaMenurutKunci).forEach((zW8ObjRoda) => {
    if (zW8ObjRoda) zW8SetSimpan.add(zW8ObjRoda);
  }); const zW8BagianBarList = []; const zW8BarObj = zW8DataPengguna.lightbar || null; if (zW8BarObj)['red', 'blue', 'gr', 'gb'].forEach((zW8KunciBagian) => {
    if (zW8BarObj[zW8KunciBagian]) zW8BagianBarList.push(zW8BarObj[zW8KunciBagian]);
  }); if (zW8DataPengguna.barRed) zW8BagianBarList.push(zW8DataPengguna.barRed); if (zW8DataPengguna.barBlue) zW8BagianBarList.push(zW8DataPengguna.barBlue);
  zW8BagianBarList.forEach((zW8ObjBagian) => zW8SetSimpan.add(zW8ObjBagian)); let zW8KotakDasarMesh = null;
  const zW8BarMeshAcuan = zW8BagianBarList.find((zW8ObjBagianQ) => zW8ObjBagianQ && zW8ObjBagianQ.position && zW8ObjBagianQ.geometry && zW8ObjBagianQ.geometry.type === 'BoxGeometry') || zW8BagianBarList[0];
    if (zW8BarMeshAcuan) {
      for (const zW8AnakObj of zW8AkarVeh.children) {
      if (zW8SetSimpan.has(zW8AnakObj) || ! zW8AnakObj.isMesh || ! zW8AnakObj.position) continue;
      const zW8CocokZ = Math.abs(zW8AnakObj.position.z - (zW8BarMeshAcuan.position.z)) < 0.01;
      const zW8DiBawahBar = zW8AnakObj.position.y < zW8BarMeshAcuan.position.y && (zW8BarMeshAcuan.position.y - (zW8AnakObj.position.y)) < 0.2;
        if (zW8CocokZ && zW8DiBawahBar) {
        zW8KotakDasarMesh = zW8AnakObj; break; } } }
  if (zW8KotakDasarMesh) zW8SetSimpan.add(zW8KotakDasarMesh); zW8AkarVeh.children.forEach((zW8AnakObjQ) => {
    if (zW8AnakObjQ.isSprite) zW8SetSimpan.add(zW8AnakObjQ);
    else if (zW8AnakObjQ.isMesh && zW8AnakObjQ.geometry && zW8AnakObjQ.geometry.type === 'PlaneGeometry' && Math.abs(zW8AnakObjQ.rotation.x + Math.PI / 2) < 0.01) zW8SetSimpan.add(zW8AnakObjQ);
  }); const zW8RekKumpul = {
  }; zW8RekKumpul.keepSet = zW8SetSimpan; zW8RekKumpul.wheelsByKey = zW8RodaMenurutKunci; zW8RekKumpul.barPartList = zW8BagianBarList;
  zW8RekKumpul.baseBoxMesh = zW8KotakDasarMesh; zW8RekKumpul.refBarMesh = zW8BarMeshAcuan; return zW8RekKumpul; }
  export function applyNpcPoliceGlb(zW8Veh) {
    try {
    if (! zW8Veh || zW8Veh.glbSwapped) return; const zW8AkarVehQ = zW8Veh.mesh || zW8Veh; if (! zW8AkarVehQ || ! zW8AkarVehQ.children || ! zW8AkarVehQ.userData) return;
    zW8Veh.glbSwapped = true; if (zW8AkarVehQ !== zW8Veh) zW8AkarVehQ.userData.glbSwapped = true; loadHeroAsset('npcPolice').then((zW8BungkusMuat) => {
        try {
          if (! zW8BungkusMuat) {
          zW8Veh.glbSwapped = false; if (zW8AkarVehQ !== zW8Veh) zW8AkarVehQ.userData.glbSwapped = false; return; }
        const zW8DataU = zW8AkarVehQ.userData;

        const zW8HasilKumpul = zW8KumpulkanSetPertahanPolisi(zW8AkarVehQ, zW8DataU, zW8Veh.wheels);
        const zW8SetSimpanQ = zW8HasilKumpul.keepSet, zW8RodaMenurutKunciQ = zW8HasilKumpul.wheelsByKey, zW8BagianBarListQ = zW8HasilKumpul.barPartList;
        const zW8KotakDasarMeshQ = zW8HasilKumpul.baseBoxMesh, zW8BarMeshAcuanQ = zW8HasilKumpul.refBarMesh;

          [... grp.children].forEach((zW8AnakObjQQ) => {
          if (! zW8SetSimpanQ.has(zW8AnakObjQQ)) zW8AnakObjQQ.visible = false; });

        const zW8KlonGlb = zW8BungkusMuat.clone ? zW8BungkusMuat.clone(true) : zW8BungkusMuat; zW8KlonGlb.position.set (0, 0, 0); zW8AkarVehQ.add(zW8KlonGlb);
        zW8DataU.npcPoliceGlb = zW8KlonGlb;

          Object.values(zW8RodaMenurutKunciQ).forEach((zW8ObjRodaQ) => {
          if (! zW8ObjRodaQ || ! zW8ObjRodaQ.position) return; const zW8IalahDepan = ! (zW8ObjRodaQ.position.z < 0);
          zW8ObjRodaQ.position.z = zW8IalahDepan ? 1.31 : - 1.55; zW8ObjRodaQ.position.x = zW8ObjRodaQ.position.x < 0 ? - 0.80 : 0.80; });

        const zW8RakitanBarList = zW8KotakDasarMeshQ ? [zW8KotakDasarMeshQ, ... zW8BagianBarListQ] : zW8BagianBarListQ; if (zW8RakitanBarList.length) {
          let zW8GeserY; if (zW8KotakDasarMeshQ) zW8GeserY = 1.40 - (zW8KotakDasarMeshQ.position.y);
          else if (zW8BarMeshAcuanQ) zW8GeserY = 1.48 - (zW8BarMeshAcuanQ.position.y);
          else zW8GeserY = 0; if (zW8GeserY) zW8RakitanBarList.forEach((zW8ObjBagianQQ) => {
            if (zW8ObjBagianQQ && zW8ObjBagianQQ.position) zW8ObjBagianQQ.position.y += zW8GeserY; }); } } catch (e) {
 }
      }).catch (() => {
      zW8Veh.glbSwapped = false; }); } catch (e) {
 } }

  export function applyLuminanceTint(zW8AkarNada, zW8NilaiNada) {
  if (! zW8AkarNada) return; const zW8WarnaiSatuMat = (zW8MatSumber) => {
    const zW8KlonMat = zW8MatSumber.clone(); zW8KlonMat.onBeforeCompile = (zW8ObjShader) => {
        zW8ObjShader.uniforms.uTint = {
        value : new THREE.Color(zW8NilaiNada) };
      zW8ObjShader.fragmentShader = zW8ObjShader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uTint;').replace('#include <map_fragment>', ['#include <map_fragment>', 'float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));', 'diffuseColor.rgb = uTint * (0.22 + 1.05 * lum);'].join('\n'));
    }; zW8KlonMat.customProgramCacheKey = () => 'npc-luminance-tint'; return zW8KlonMat;
  }; zW8AkarNada.traverse((zW8ObjNode) => {
    if (! zW8ObjNode.isMesh || ! zW8ObjNode.material) return;
    zW8ObjNode.material = Array.isArray(zW8ObjNode.material) ? zW8ObjNode.material.map(zW8WarnaiSatuMat) : zW8WarnaiSatuMat(zW8ObjNode.material); }); }

  export function applyNpcSedanGlb(zW8VehQ, zW8NilaiNadaQ) {
    try {
    if (! zW8VehQ || zW8VehQ.glbSwapped) return; const zW8AkarVehQQ = zW8VehQ.mesh || zW8VehQ;
    if (! zW8AkarVehQQ || ! zW8AkarVehQQ.children || ! zW8AkarVehQQ.userData) return; zW8VehQ.glbSwapped = true;
    if (zW8AkarVehQQ !== zW8VehQ) zW8AkarVehQQ.userData.glbSwapped = true; loadHeroAsset('npcSedan').then((zW8BungkusMuatQ) => {
        try {
          if (! zW8BungkusMuatQ) {
          zW8VehQ.glbSwapped = false; if (zW8AkarVehQQ !== zW8VehQ) zW8AkarVehQQ.userData.glbSwapped = false; return; }
        const zW8DataUQ = zW8AkarVehQQ.userData;

        const zW8SetSimpanQQ = new Set(); const zW8RodaMenurutKunciQQ = zW8DataUQ.wheels || zW8VehQ.wheels || {
        }; Object.values(zW8RodaMenurutKunciQQ).forEach((zW8ObjRodaQQ) => {
          if (zW8ObjRodaQQ) zW8SetSimpanQQ.add(zW8ObjRodaQQ); });

          zW8AkarVehQQ.children.forEach((zW8AnakObjQQQ) => {
          if (zW8AnakObjQQQ.isSprite) zW8SetSimpanQQ.add(zW8AnakObjQQQ);
          else if (zW8AnakObjQQQ.isMesh && zW8AnakObjQQQ.geometry && zW8AnakObjQQQ.geometry.type === 'PlaneGeometry' && Math.abs(zW8AnakObjQQQ.rotation.x + Math.PI / 2) < 0.01) zW8SetSimpanQQ.add(zW8AnakObjQQQ);
        });

          [... grp.children].forEach((zW8AnakObjQQQQ) => {
          if (! zW8SetSimpanQQ.has(zW8AnakObjQQQQ)) zW8AnakObjQQQQ.visible = false; });

        const zW8KlonGlbQ = zW8BungkusMuatQ.clone ? zW8BungkusMuatQ.clone(true) : zW8BungkusMuatQ; zW8KlonGlbQ.position.set (0, 0, 0);
        zW8KlonGlbQ.rotation.y = - Math.PI / 2; applyLuminanceTint(zW8KlonGlbQ, zW8NilaiNadaQ); zW8KlonGlbQ.traverse((zW8ObjNodeQ) => {
          if (zW8ObjNodeQ && zW8ObjNodeQ.isMesh) zW8ObjNodeQ.castShadow = true;
        }); zW8AkarVehQQ.add(zW8KlonGlbQ); zW8DataUQ.npcSedanGlb = zW8KlonGlbQ;

          Object.values(zW8RodaMenurutKunciQQ).forEach((zW8ObjRodaQQQ) => {
          if (! zW8ObjRodaQQQ || ! zW8ObjRodaQQQ.position) return; const zW8IalahDepanQ = ! (zW8ObjRodaQQQ.position.z < 0);
          zW8ObjRodaQQQ.position.z = zW8IalahDepanQ ? 1.19 : - 1.66; zW8ObjRodaQQQ.position.x = zW8ObjRodaQQQ.position.x < 0 ? - 0.80 : 0.80; }); } catch (e) {
 }
      }).catch (() => {
      zW8VehQ.glbSwapped = false; }); } catch (e) {
 } }

  export function applyNpcTaxiGlb(zW8VehQQ) {
    try {
    if (! zW8VehQQ || zW8VehQQ.glbSwapped) return; const zW8AkarVehQQQ = zW8VehQQ.mesh || zW8VehQQ;
    if (! zW8AkarVehQQQ || ! zW8AkarVehQQQ.children || ! zW8AkarVehQQQ.userData) return; zW8VehQQ.glbSwapped = true;
    if (zW8AkarVehQQQ !== zW8VehQQ) zW8AkarVehQQQ.userData.glbSwapped = true; loadHeroAsset('npcTaxi').then((zW8BungkusMuatQQ) => {
        try {
          if (! zW8BungkusMuatQQ) {
          zW8VehQQ.glbSwapped = false; if (zW8AkarVehQQQ !== zW8VehQQ) zW8AkarVehQQQ.userData.glbSwapped = false; return; }
        const zW8DataUQQ = zW8AkarVehQQQ.userData;

        const zW8SetSimpanQQQ = new Set(); const zW8RodaMenurutKunciQQQ = zW8DataUQQ.wheels || zW8VehQQ.wheels || {
        }; Object.values(zW8RodaMenurutKunciQQQ).forEach((zW8ObjRodaQQQQ) => {
          if (zW8ObjRodaQQQQ) zW8SetSimpanQQQ.add(zW8ObjRodaQQQQ); });

          zW8AkarVehQQQ.children.forEach((zW8AnakObjQQQQQ) => {
          if (zW8AnakObjQQQQQ.isSprite) zW8SetSimpanQQQ.add(zW8AnakObjQQQQQ);
          else if (zW8AnakObjQQQQQ.isMesh && zW8AnakObjQQQQQ.geometry && zW8AnakObjQQQQQ.geometry.type === 'PlaneGeometry' && Math.abs(zW8AnakObjQQQQQ.rotation.x + Math.PI / 2) < 0.01) zW8SetSimpanQQQ.add(zW8AnakObjQQQQQ);
        });

          [... grp.children].forEach((zW8AnakObjQQQQQQ) => {
          if (! zW8SetSimpanQQQ.has(zW8AnakObjQQQQQQ)) zW8AnakObjQQQQQQ.visible = false; });

        const zW8KlonGlbQQ = zW8BungkusMuatQQ.clone ? zW8BungkusMuatQQ.clone(true) : zW8BungkusMuatQQ; zW8KlonGlbQQ.position.set (0, 0, 0);
          zW8KlonGlbQQ.traverse((zW8ObjNodeQQ) => {
          if (zW8ObjNodeQQ && zW8ObjNodeQQ.isMesh) zW8ObjNodeQQ.castShadow = true;
        }); zW8AkarVehQQQ.add(zW8KlonGlbQQ); zW8DataUQQ.npcTaxiGlb = zW8KlonGlbQQ;

          Object.values(zW8RodaMenurutKunciQQQ).forEach((zW8ObjRodaQQQQQ) => {
          if (! zW8ObjRodaQQQQQ || ! zW8ObjRodaQQQQQ.position) return; const zW8IalahDepanQQ = ! (zW8ObjRodaQQQQQ.position.z < 0);
          zW8ObjRodaQQQQQ.position.z = zW8IalahDepanQQ ? 1.20 : - 1.34; zW8ObjRodaQQQQQ.position.x = zW8ObjRodaQQQQQ.position.x < 0 ? - 0.80 : 0.80; }); } catch (e) {
 }
      }).catch (() => {
      zW8VehQQ.glbSwapped = false; }); } catch (e) {
 } }

  function zW8AddUnderglow(zW8GrupMobilRef, zW8SpecQ, zW8OptsQ) {
  const zW8NadaPijar = zW8OptsQ && zW8OptsQ.glow !== undefined ? zW8OptsQ.glow : zW8SpecQ.glow; if (! zW8NadaPijar) return;
  const zW8LembarPijar = document.createElement('canvas'); zW8LembarPijar.height = 128; zW8LembarPijar.width = zW8LembarPijar.height;
  const zW8KuasPijar = zW8LembarPijar.getContext('2d'); const zW8RadialPijar = zW8KuasPijar.createRadialGradient(64, 64, 4, 64, 64, 64);
  zW8RadialPijar.addColorStop(0, 'rgba(255,255,255,.9)'); zW8RadialPijar.addColorStop(1, 'rgba(255,255,255,0)'); zW8KuasPijar.fillStyle = zW8RadialPijar;
  zW8KuasPijar.fillRect(0, 0, 128, 128);

    const zW8MeshPijarBawah = new THREE.Mesh(new THREE.PlaneGeometry(zW8SpecQ.wid * 1.25, zW8SpecQ.len * 1.25), new THREE.MeshBasicMaterial({
    map : new THREE.CanvasTexture(zW8LembarPijar), color : zW8NadaPijar, transparent : true, opacity : 0.25, blending : THREE.AdditiveBlending, depthWrite : false
  })); zW8MeshPijarBawah.rotation.x = - Math.PI / 2; zW8MeshPijarBawah.position.y = 0.06; zW8GrupMobilRef.add(zW8MeshPijarBawah); }
  function zW8AddBlobShadow(zW8GrupMobilRefQ, zW8SpecQQ) {
    const zW8MeshBayangBlob = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + zW8SpecQQ.wid, 0.5 + zW8SpecQQ.len), new THREE.MeshBasicMaterial({
    color : 0x000000, transparent : true, opacity : 0.32, depthWrite : false
  })); zW8MeshBayangBlob.rotation.x = - Math.PI / 2; zW8MeshBayangBlob.position.y = 0.03; zW8GrupMobilRefQ.add(zW8MeshBayangBlob); }

const zW8HERO_SPEC_IDS = new Set(['taiyo', 'hero-supra']); let zW8HeroTemplate = null, zW8HeroLoadDone = false; const zW8HeroWaitQueue = [];
  const zW8PopulateGlbCar = (zW8GrupMobilRefQQ, zW8SpecQQQ, zW8OptsQQ) => {
  zW8GrupMobilRefQQ.add(zW8HeroTemplate.clone(true)); zW8AddUnderglow(zW8GrupMobilRefQQ, zW8SpecQQQ, zW8OptsQQ); zW8AddBlobShadow(zW8GrupMobilRefQQ, zW8SpecQQQ);
    const zW8PetaPivotHero = {
  }; [['fl', - 1, 1], ['fr', 1, 1], ['rl', - 1, - 1], ['rr', 1, - 1]].forEach(([zW8KunciRodaQQ, zW8TandaX, zW8TandaZ]) => {
    const zW8PivotKosong = new THREE.Group(); zW8PivotKosong.position.set (zW8TandaX * 0.80, 0.34, zW8TandaZ * 1.42); zW8GrupMobilRefQQ.add(zW8PivotKosong);
    zW8PetaPivotHero[zW8KunciRodaQQ] = zW8PivotKosong;
  }); zW8GrupMobilRefQQ.userData.wheels = zW8PetaPivotHero; zW8GrupMobilRefQQ.userData.wheelR = 0.34; zW8GrupMobilRefQQ.userData.tailMat = null;
  zW8GrupMobilRefQQ.userData.headMat = null; zW8GrupMobilRefQQ.userData.visualMode = 'glb'; return zW8GrupMobilRefQQ;
}; const zW8BuildGlbCarMesh = (zW8SpecQQQQ, zW8OptsQQQ) => zW8PopulateGlbCar(new THREE.Group(), zW8SpecQQQQ, zW8OptsQQQ);

  const zW8SwapHeroCarToGlb = (zW8EntriAntre) => {
    try {
    const zW8VehRef = zW8EntriAntre.v; if (! zW8VehRef || ! zW8VehRef.mesh || ! zW8VehRef.mesh.parent) return; if (zW8VehRef.mesh.userData.visualMode === 'glb') return;
      if (! zW8VehRef._procChildren) {
      while (zW8VehRef.mesh.children.length) zW8VehRef.mesh.remove(zW8VehRef.mesh.children[0]); } else {
        [... zW8VehRef.mesh.children].forEach((zW8AnakObjQQQQQQQ) => {
        if (zW8VehRef._procChildren.has(zW8AnakObjQQQQQQQ)) zW8VehRef.mesh.remove(zW8AnakObjQQQQQQQ); }); }
      zW8PopulateGlbCar(zW8VehRef.mesh, zW8EntriAntre.spec, {
      glow : zW8EntriAntre.glow
    }); zW8VehRef.wheels = zW8VehRef.mesh.userData.wheels; zW8VehRef._procChildren = null; } catch (e) {
 }
}; try {
    loadHeroAsset('heroCar').then((zW8BungkusMuatQQQ) => {
      try {
      zW8HeroLoadDone = true; if (! zW8BungkusMuatQQQ) {
        zW8HeroWaitQueue.length = 0; return; }
      zW8HeroTemplate = zW8BungkusMuatQQQ; zW8HeroWaitQueue.splice(0).forEach((zW8EntriAntreQ) => zW8SwapHeroCarToGlb(zW8EntriAntreQ)); } catch (e) {
 }
    }).catch (() => {
    zW8HeroLoadDone = true; zW8HeroWaitQueue.length = 0; }); } catch (e) {
  zW8HeroLoadDone = true; }

  function zW8ApplyGtrPaint(zW8AkarGtr) {
  if (! zW8AkarGtr) return; const zW8CatSatuMat = (zW8MatSumberQ) => {
    const zW8KlonMatQ = zW8MatSumberQ.clone(); zW8KlonMatQ.onBeforeCompile = (zW8ObjShaderQ) => {
      zW8ObjShaderQ.vertexShader = zW8ObjShaderQ.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = position.y;');
      zW8ObjShaderQ.fragmentShader = zW8ObjShaderQ.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLocalY;').replace('#include <map_fragment>', ['#include <map_fragment>', 'vec3 gtrBase = diffuseColor.rgb;', 'vec3 gtrKit = mix(gtrBase * 0.25, vec3(0.012, 0.012, 0.014), 0.75);', 'vec3 gtrStripe = vec3(0.85, 0.04, 0.05);', 'vec3 gtrUpper = gtrBase * 1.18;', 'float gtrToStripe = smoothstep(0.095 - 0.006, 0.095 + 0.006, vLocalY);', 'float gtrToUpper = smoothstep(0.125 - 0.006, 0.125 + 0.006, vLocalY);', 'diffuseColor.rgb = mix(mix(gtrKit, gtrStripe, gtrToStripe), gtrUpper, gtrToUpper);'].join('\n'));
    }; zW8KlonMatQ.customProgramCacheKey = () => 'gtr35-livery'; return zW8KlonMatQ;
  }; zW8AkarGtr.traverse((zW8ObjNodeQQQ) => {
    if (! zW8ObjNodeQQQ.isMesh || ! zW8ObjNodeQQQ.material) return;
    zW8ObjNodeQQQ.material = Array.isArray(zW8ObjNodeQQQ.material) ? zW8ObjNodeQQQ.material.map(zW8CatSatuMat) : zW8CatSatuMat(zW8ObjNodeQQQ.material); }); }
const zW8GTR_SPEC_IDS = new Set(['gtr35']); let zW8GtrTemplate = null, zW8GtrLoadDone = false; const zW8GtrWaitQueue = [];
  const zW8PopulateGtrCar = (zW8GrupMobilRefQQQ, zW8SpecQQQQQ, zW8OptsQQQQ) => {
  const zW8KlonGtr = zW8GtrTemplate.clone(true);

  zW8KlonGtr.rotation.y = 0; zW8ApplyGtrPaint(zW8KlonGtr); zW8GrupMobilRefQQQ.add(zW8KlonGtr); zW8AddUnderglow(zW8GrupMobilRefQQQ, zW8SpecQQQQQ, zW8OptsQQQQ);
  zW8AddBlobShadow(zW8GrupMobilRefQQQ, zW8SpecQQQQQ); const zW8PetaPivotGtr = {
  }; [['fl', - 0.80, 1.41], ['fr', 0.80, 1.41], ['rl', - 0.80, - 1.55], ['rr', 0.80, - 1.55]].forEach(([zW8KunciRodaQQQ, zW8PosisiX, zW8PosisiZ]) => {
    const zW8PivotBaruQ = new THREE.Group(); zW8PivotBaruQ.position.set (zW8PosisiX, 0.35, zW8PosisiZ); zW8GrupMobilRefQQQ.add(zW8PivotBaruQ);
    zW8PetaPivotGtr[zW8KunciRodaQQQ] = zW8PivotBaruQ;
  }); zW8GrupMobilRefQQQ.userData.wheels = zW8PetaPivotGtr; zW8GrupMobilRefQQQ.userData.wheelR = 0.35; zW8GrupMobilRefQQQ.userData.tailMat = null;
  zW8GrupMobilRefQQQ.userData.headMat = null; zW8GrupMobilRefQQQ.userData.visualMode = 'glb'; return zW8GrupMobilRefQQQ;
}; const zW8BuildGtrCarMesh = (zW8SpecQQQQQQ, zW8OptsQQQQQ) => zW8PopulateGtrCar(new THREE.Group(), zW8SpecQQQQQQ, zW8OptsQQQQQ);
  const zW8SwapGtrCarToGlb = (zW8EntriAntreQQ) => {
    try {
    const zW8VehRefQ = zW8EntriAntreQQ.v; if (! zW8VehRefQ || ! zW8VehRefQ.mesh || ! zW8VehRefQ.mesh.parent) return;
    if (zW8VehRefQ.mesh.userData.visualMode === 'glb') return; if (! zW8VehRefQ._procChildren) {
      while (zW8VehRefQ.mesh.children.length) zW8VehRefQ.mesh.remove(zW8VehRefQ.mesh.children[0]); } else {
        [... zW8VehRefQ.mesh.children].forEach((zW8AnakObjQQQQQQQQ) => {
        if (zW8VehRefQ._procChildren.has(zW8AnakObjQQQQQQQQ)) zW8VehRefQ.mesh.remove(zW8AnakObjQQQQQQQQ); }); }
      zW8PopulateGtrCar(zW8VehRefQ.mesh, zW8EntriAntreQQ.spec, {
      glow : zW8EntriAntreQQ.glow
    }); zW8VehRefQ.wheels = zW8VehRefQ.mesh.userData.wheels; zW8VehRefQ._procChildren = null; } catch (e) {
 }
}; try {
    loadHeroAsset('gtr35').then((zW8BungkusMuatQQQQ) => {
      try {
      zW8GtrLoadDone = true; if (! zW8BungkusMuatQQQQ) {
        zW8GtrWaitQueue.length = 0; return; }
      zW8GtrTemplate = zW8BungkusMuatQQQQ; zW8GtrWaitQueue.splice(0).forEach((zW8EntriAntreQQQ) => zW8SwapGtrCarToGlb(zW8EntriAntreQQQ)); } catch (e) {
 }
    }).catch (() => {
    zW8GtrLoadDone = true; zW8GtrWaitQueue.length = 0; }); } catch (e) {
  zW8GtrLoadDone = true; }

  function zW8BuildSvjTailTexture() {
  const zW8LembarEkor = document.createElement('canvas'); zW8LembarEkor.width = 256; zW8LembarEkor.height = 84; const zW8KuasEkor = zW8LembarEkor.getContext('2d');
  zW8KuasEkor.clearRect(0, 0, 256, 84); zW8KuasEkor.strokeStyle = '#ff1e1e'; zW8KuasEkor.lineWidth = 15; zW8KuasEkor.lineCap = 'round'; zW8KuasEkor.lineJoin = 'round';
  zW8KuasEkor.shadowColor = '#ff1e1e'; zW8KuasEkor.shadowBlur = 8; zW8KuasEkor.beginPath(); zW8KuasEkor.moveTo(28, 8); zW8KuasEkor.lineTo(128, 46);
  zW8KuasEkor.moveTo(228, 8); zW8KuasEkor.lineTo(128, 46); zW8KuasEkor.moveTo(128, 46); zW8KuasEkor.lineTo(128, 76); zW8KuasEkor.stroke();
  const zW8TexEkor = new THREE.CanvasTexture(zW8LembarEkor); zW8TexEkor.colorSpace = THREE.SRGBColorSpace; return zW8TexEkor; }
  function zW8ApplySvjFixes(zW8BungkusArg, zW8VehArg, zW8IndukArg) {
    const zW8RekHasil = {
    tailMat : null, drlMat : null
  }; if (! zW8BungkusArg) return zW8RekHasil;

  const zW8GrupInduk = zW8IndukArg || zW8BungkusArg;

    zW8BungkusArg.traverse((zW8ObjNodeQQQQ) => {
    if (! zW8ObjNodeQQQQ.isMesh || ! zW8ObjNodeQQQQ.material) return; const zW8CatSatuMatQ = (zW8MatSumberQQ) => {
      const zW8KlonMatQQ = zW8MatSumberQQ.clone(); zW8KlonMatQQ.roughness = 0.58; zW8KlonMatQQ.metalness = 0.30; zW8KlonMatQQ.onBeforeCompile = (zW8ObjShaderQQ) => {
        zW8ObjShaderQQ.fragmentShader = zW8ObjShaderQQ.fragmentShader.replace('#include <map_fragment>', ['#include <map_fragment>', 'diffuseColor.rgb = mix(diffuseColor.rgb * 0.30, vec3(0.016, 0.016, 0.018), 0.78);'].join('\n'));
      }; zW8KlonMatQQ.customProgramCacheKey = () => 'svj-matte'; return zW8KlonMatQQ;
    }; zW8ObjNodeQQQQ.material = Array.isArray(zW8ObjNodeQQQQ.material) ? zW8ObjNodeQQQQ.material.map(zW8CatSatuMatQ) : zW8CatSatuMatQ(zW8ObjNodeQQQQ.material); });

  const zW8SiluetKanopi = new THREE.Shape(); zW8SiluetKanopi.moveTo(0.55, 0.80); zW8SiluetKanopi.lineTo(- 0.35, 1.10); zW8SiluetKanopi.lineTo(- 1.05, 1.08);
  zW8SiluetKanopi.lineTo(- 1.45, 0.82); zW8SiluetKanopi.lineTo(- 1.45, 0.74); zW8SiluetKanopi.lineTo(0.55, 0.74); zW8SiluetKanopi.closePath();
    const zW8GeoKanopi = new THREE.ExtrudeGeometry(zW8SiluetKanopi, {
    depth : 1.24, bevelEnabled : true, bevelThickness : 0.03, bevelSize : 0.03, bevelSegments : 2, steps : 1
  }); zW8GeoKanopi.rotateY(- Math.PI / 2); zW8GeoKanopi.translate(0.62, 0, 0); const zW8MeshKanopi = new THREE.Mesh(zW8GeoKanopi, new THREE.MeshPhongMaterial({
    color : 0x0d1216, specular : 0xbdd3e0, shininess : 90, transparent : true, opacity : 0.97
  })); zW8GrupInduk.add(zW8MeshKanopi);

  const zW8TexEkorSvj = zW8BuildSvjTailTexture(); const zW8MatEkorSvj = new THREE.MeshStandardMaterial({
    color : 0x000000, emissive : 0xffffff, emissiveMap : zW8TexEkorSvj, map : zW8TexEkorSvj, transparent : true, emissiveIntensity : 1.1
  }); [- 1, 1].forEach((zW8TandaSisiQQQQQQ) => {
    const zW8MeshUnitEkorQ = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.28), zW8MatEkorSvj); zW8MeshUnitEkorQ.position.set (zW8TandaSisiQQQQQQ * 0.56, 0.80, - 2.46);
    zW8MeshUnitEkorQ.rotation.y = Math.PI; zW8GrupInduk.add(zW8MeshUnitEkorQ); const zW8SprPijarEkor = glowSprite(0xff2a22, 1.1);
    zW8SprPijarEkor.position.set (zW8TandaSisiQQQQQQ * 0.56, 0.80, - 2.52);

    zW8GrupInduk.add(zW8SprPijarEkor);
  }); zW8RekHasil.tailMat = zW8MatEkorSvj;

    const zW8MatDrlSvj = new THREE.MeshStandardMaterial({
    color : 0x111111, emissive : 0xf4f8ff, emissiveIntensity : 1.2, roughness : 0.3
  }); [- 1, 1].forEach((zW8TandaSisiQQQQQQQ) => {
    const zW8MeshStripDrl = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.07), zW8MatDrlSvj); zW8MeshStripDrl.position.set (zW8TandaSisiQQQQQQQ * 0.55, 0.52, 2.44);
    zW8GrupInduk.add(zW8MeshStripDrl);
  }); zW8RekHasil.drlMat = zW8MatDrlSvj;

  const zW8GeoCakram = new THREE.CylinderGeometry(0.20, 0.20, 0.06, 20); zW8GeoCakram.rotateZ(Math.PI / 2); const zW8MatCakram = new THREE.MeshStandardMaterial({
    color : 0xe02020, metalness : 0.2, roughness : 0.35
  }); [[- 0.86, 1.40], [0.86, 1.40], [- 0.86, - 1.75], [0.86, - 1.75]].forEach(([zW8CakramX, zW8CakramZ]) => {
    const zW8MeshCakram = new THREE.Mesh(zW8GeoCakram, zW8MatCakram); zW8MeshCakram.position.set (zW8CakramX, 0.36, zW8CakramZ); zW8GrupInduk.add(zW8MeshCakram);
  }); if (zW8VehArg) zW8VehArg.svjTreatment = zW8RekHasil; return zW8RekHasil; }
const zW8SVJ_SPEC_IDS = new Set(['svj']); let zW8SvjTemplate = null, zW8SvjLoadDone = false; const zW8SvjWaitQueue = [];
  const zW8PopulateSvjCar = (zW8GrupMobilRefQQQQ, zW8SpecQQQQQQQ, zW8OptsQQQQQQ) => {
  const zW8KlonSvj = zW8SvjTemplate.clone(true); const zW8HasilPerlakuan = zW8ApplySvjFixes(zW8KlonSvj, null, zW8GrupMobilRefQQQQ); zW8GrupMobilRefQQQQ.add(zW8KlonSvj);
  zW8AddUnderglow(zW8GrupMobilRefQQQQ, zW8SpecQQQQQQQ, zW8OptsQQQQQQ); zW8AddBlobShadow(zW8GrupMobilRefQQQQ, zW8SpecQQQQQQQ); const zW8PetaPivotSvj = {
  }; [['fl', - 0.88, 1.40], ['fr', 0.88, 1.40], ['rl', - 0.88, - 1.75], ['rr', 0.88, - 1.75]].forEach(([zW8KunciRodaQQQQ, zW8PosisiXQ, zW8PosisiZQ]) => {
    const zW8PivotBaruQQ = new THREE.Group(); zW8PivotBaruQQ.position.set (zW8PosisiXQ, 0.36, zW8PosisiZQ); zW8GrupMobilRefQQQQ.add(zW8PivotBaruQQ);
    zW8PetaPivotSvj[zW8KunciRodaQQQQ] = zW8PivotBaruQQ;
  }); zW8GrupMobilRefQQQQ.userData.wheels = zW8PetaPivotSvj; zW8GrupMobilRefQQQQ.userData.wheelR = 0.36; zW8GrupMobilRefQQQQ.userData.tailMat = zW8HasilPerlakuan.tailMat;
  zW8GrupMobilRefQQQQ.userData.headMat = zW8HasilPerlakuan.drlMat; zW8GrupMobilRefQQQQ.userData.visualMode = 'glb'; return zW8GrupMobilRefQQQQ;
}; const zW8BuildSvjCarMesh = (zW8SpecQQQQQQQQ, zW8OptsQQQQQQQ) => zW8PopulateSvjCar(new THREE.Group(), zW8SpecQQQQQQQQ, zW8OptsQQQQQQQ);
  const zW8SwapSvjCarToGlb = (zW8EntriAntreQQQQ) => {
    try {
    const zW8VehRefQQ = zW8EntriAntreQQQQ.v; if (! zW8VehRefQQ || ! zW8VehRefQQ.mesh || ! zW8VehRefQQ.mesh.parent) return;
    if (zW8VehRefQQ.mesh.userData.visualMode === 'glb') return; if (! zW8VehRefQQ._procChildren) {
      while (zW8VehRefQQ.mesh.children.length) zW8VehRefQQ.mesh.remove(zW8VehRefQQ.mesh.children[0]); } else {
        [... zW8VehRefQQ.mesh.children].forEach((zW8AnakObjQQQQQQQQQ) => {
        if (zW8VehRefQQ._procChildren.has(zW8AnakObjQQQQQQQQQ)) zW8VehRefQQ.mesh.remove(zW8AnakObjQQQQQQQQQ); }); }
      zW8PopulateSvjCar(zW8VehRefQQ.mesh, zW8EntriAntreQQQQ.spec, {
      glow : zW8EntriAntreQQQQ.glow
    }); zW8VehRefQQ.wheels = zW8VehRefQQ.mesh.userData.wheels; zW8VehRefQQ._procChildren = null;

    if (zW8VehRefQQ._brakeStaged && zW8VehRefQQ.mesh.userData.tailMat) zW8VehRefQQ.mesh.userData.tailMat.emissiveIntensity = 2.4; } catch (e) {
 }
}; try {
    loadHeroAsset('lamboSvj').then((zW8BungkusMuatQQQQQ) => {
      try {
      zW8SvjLoadDone = true; if (! zW8BungkusMuatQQQQQ) {
        zW8SvjWaitQueue.length = 0; return; }
      zW8SvjTemplate = zW8BungkusMuatQQQQQ; zW8SvjWaitQueue.splice(0).forEach((zW8EntriAntreQQQQQ) => zW8SwapSvjCarToGlb(zW8EntriAntreQQQQQ)); } catch (e) {
 }
    }).catch (() => {
    zW8SvjLoadDone = true; zW8SvjWaitQueue.length = 0; }); } catch (e) {
  zW8SvjLoadDone = true; }

const zW8PARKED_PASTELS = [0xffb7d5, 0xb8e6c9, 0xfff3d6, 0xaed6f7, 0xffcf9f, 0xd5f5e3, 0xfdebd0, 0xd6eaf8, 0xd9c7ec, 0xfdf6b2, 0xf5a58d,];
  export function spawnVehicle(G, zW8SpecId, zW8SpawnX, zW8SpawnZ, zW8SpawnAngle, zW8OptsMasukan) {
    const zW8OptsQQQQQQQQ = zW8OptsMasukan || { };

  if (zW8OptsQQQQQQQQ.driver === 'parked' && zW8OptsQQQQQQQQ.color == null && ! zW8OptsQQQQQQQQ.livery && rnd() < 0.7) zW8OptsQQQQQQQQ.color = pick(zW8PARKED_PASTELS);
    const zW8SpecLengkap = {
    ... CARS[zW8SpecId], id : zW8SpecId
  }; const zW8IalahHero = zW8HERO_SPEC_IDS.has(zW8SpecId), zW8IalahGtr = zW8GTR_SPEC_IDS.has(zW8SpecId), zW8IalahSvj = zW8SVJ_SPEC_IDS.has(zW8SpecId);
  const zW8MeshMobilBaru = zW8IalahSvj && zW8SvjTemplate ? zW8BuildSvjCarMesh(zW8SpecLengkap, zW8OptsQQQQQQQQ) : zW8IalahGtr && zW8GtrTemplate ? zW8BuildGtrCarMesh(zW8SpecLengkap, zW8OptsQQQQQQQQ) : zW8IalahHero && zW8HeroTemplate ? zW8BuildGlbCarMesh(zW8SpecLengkap, zW8OptsQQQQQQQQ) : makeCarMesh(zW8SpecLengkap, zW8OptsQQQQQQQQ.color, zW8OptsQQQQQQQQ);

    zW8MeshMobilBaru.traverse((zW8ObjNodeQQQQQ) => {
    if (zW8ObjNodeQQQQQ && zW8ObjNodeQQQQQ.isMesh && ! (zW8ObjNodeQQQQQ.geometry && zW8ObjNodeQQQQQ.geometry.type === 'PlaneGeometry' && Math.abs(zW8ObjNodeQQQQQ.rotation.x + Math.PI / 2) < 0.01)) zW8ObjNodeQQQQQ.castShadow = true;
  }); zW8MeshMobilBaru.position.set (zW8SpawnX, 0.02 + groundH(zW8SpawnX, zW8SpawnZ), zW8SpawnZ); zW8MeshMobilBaru.rotation.y = zW8SpawnAngle || 0;
  G.scene.add(zW8MeshMobilBaru); const zW8RekVeh = {
  }; zW8RekVeh.spec = zW8SpecLengkap; zW8RekVeh.specId = zW8SpecId; zW8RekVeh.mesh = zW8MeshMobilBaru; zW8RekVeh.angle = zW8SpawnAngle || 0; zW8RekVeh.speed = 0;
  zW8RekVeh.health = 100; zW8RekVeh.driver = zW8OptsQQQQQQQQ.driver || 'parked';
  zW8RekVeh.color = zW8OptsQQQQQQQQ.color != null ? zW8OptsQQQQQQQQ.color : zW8SpecLengkap.color; zW8RekVeh.wheels = zW8MeshMobilBaru.userData.wheels;
  zW8RekVeh.steerVis = 0; zW8RekVeh.x = zW8SpawnX; zW8RekVeh.z = zW8SpawnZ; zW8RekVeh.target = null; zW8RekVeh.lane = zW8OptsQQQQQQQQ.lane || 0; zW8RekVeh.smokeT = 0;
  zW8ArmFxHook(G); const zW8AntreBilaPerlu = (zW8FlagJenis, zW8TemplatJenis, zW8SelesaiJenis, zW8AntreJenis) => {
      if (zW8FlagJenis && ! zW8TemplatJenis && ! zW8SelesaiJenis) {
      zW8RekVeh._procChildren = new Set(zW8MeshMobilBaru.children); zW8AntreJenis.push({
        v : zW8RekVeh, spec : zW8SpecLengkap, glow : zW8OptsQQQQQQQQ.glow }); }
  }; zW8AntreBilaPerlu(zW8IalahHero, zW8HeroTemplate, zW8HeroLoadDone, zW8HeroWaitQueue); zW8AntreBilaPerlu(zW8IalahGtr, zW8GtrTemplate, zW8GtrLoadDone, zW8GtrWaitQueue);
  zW8AntreBilaPerlu(zW8IalahSvj, zW8SvjTemplate, zW8SvjLoadDone, zW8SvjWaitQueue); if (! G.vehicles) G.vehicles = []; G.vehicles.push(zW8RekVeh); return zW8RekVeh; }

const zW8TRAFFIC_SPEC_IDS = ['sedan', 'hatch', 'suv', 'wagon', 'kei', 'hachi', 'van', 'sora15', 'roadster', 'taxi', 'sedan', 'hatch', 'suv', 'taxi',];

const zW8TRAFFIC_PAINTS = [0xb9c0c7, 0x3f8cff, 0xd95555, 0x44484e, 0xf2f2f2, 0x5a7d4f, 0xffd23f, 0x707880, 0x8a4fd0, 0x2a9d8f, 0xffb7d5, 0xb8e6c9, 0xfff3d6, 0xaed6f7, 0xffcf9f, 0xd5f5e3, 0xfdebd0, 0xd6eaf8, 0xf5c6e0, 0xe8daef,];

const zW8SEDAN_TINT_LIST = [0xc0c4c8, 0xe9e9e6, 0x3a3d42, 0x6e1420, 0x44586e, 0x77694f, 0xe8a7bf, 0x9fc3e8]; let zW8SedanSpawnIdx = 0;
  export function spawnTraffic(G, zW8JumlahMinta) {
  if (! G.traffic) G.traffic = [];

  const zW8JumlahTotal = Math.round((zW8JumlahMinta * 16) / 7); let zW8IdxSpawn = 0;
    while (zW8IdxSpawn < zW8JumlahTotal) {
    let zW8JalanSepanjangX = rnd() < 0.5; let zW8GarisJalan = pick(zW8JalanSepanjangX ? G.roadX : G.roadZ);

      if (rnd() < 0.45) {
      const zW8PilihanUtama = ['blvd', 'blvd', 'x0', 'z0']; const zW8PilihanJatuh = pick(zW8PilihanUtama);
        if (zW8PilihanJatuh === 'blvd' && Array.isArray(G.roadZ) && G.roadZ.includes(495)) {
        zW8JalanSepanjangX = false; zW8GarisJalan = 495;
        } else if (zW8PilihanJatuh === 'x0' && Array.isArray(G.roadX) && G.roadX.includes(0)) {
        zW8JalanSepanjangX = true; zW8GarisJalan = 0;
        } else if (zW8PilihanJatuh === 'z0' && Array.isArray(G.roadZ) && G.roadZ.includes(0)) {
        zW8JalanSepanjangX = false; zW8GarisJalan = 0; } }
    const zW8PosisiSepanjang = rr(- 600, 600); const zW8TandaArah = rnd() < 0.5 ? 1 : - 1; const zW8GeserLajur = zW8TandaArah * 5;
    const zW8LahirX = zW8JalanSepanjangX ? zW8GarisJalan + zW8GeserLajur : zW8PosisiSepanjang;
    const zW8LahirZ = zW8JalanSepanjangX ? zW8PosisiSepanjang : zW8GarisJalan - (zW8GeserLajur);
    const zW8ArahLahir = zW8JalanSepanjangX ? (zW8TandaArah > 0 ? 0 : Math.PI) : (zW8TandaArah > 0 ? Math.PI / 2 : - Math.PI / 2);
    const zW8SpecTerpilih = pick(zW8TRAFFIC_SPEC_IDS); const zW8VehBaru = spawnVehicle(G, zW8SpecTerpilih, zW8LahirX, zW8LahirZ, zW8ArahLahir, {
      color : zW8SpecTerpilih === 'taxi' ? CARS.taxi.color : pick(zW8TRAFFIC_PAINTS), driver : 'traffic'
    }); if (zW8SpecTerpilih === 'sedan') {
      const zW8NadaSedan = zW8SEDAN_TINT_LIST[zW8SedanSpawnIdx % zW8SEDAN_TINT_LIST.length]; ++ zW8SedanSpawnIdx; applyNpcSedanGlb(zW8VehBaru, zW8NadaSedan); }
    if (zW8SpecTerpilih === 'taxi') applyNpcTaxiGlb(zW8VehBaru); zW8VehBaru.onX = zW8JalanSepanjangX; zW8VehBaru.line = zW8GarisJalan; zW8VehBaru.dirSign = zW8TandaArah;
    zW8VehBaru.cruise = rr(22, 38) / 3.6; zW8VehBaru.speed = zW8VehBaru.cruise; G.traffic.push(zW8VehBaru); ++ zW8IdxSpawn; } }
  function zW8PutarRodaLaluLintas(zW8VehRefQQQ, zW8LangkahPutar, zW8DtRef) {
    ['fl', 'fr', 'rl', 'rr'].forEach((zW8KunciRodaQQQQQ) => {
    const zW8ObjRodaQQQQQQ = zW8VehRefQQQ.wheels[zW8KunciRodaQQQQQ]; if (zW8ObjRodaQQQQQQ) zW8ObjRodaQQQQQQ.rotation.x += (zW8LangkahPutar / zW8DtRef) * zW8DtRef;
  }); ['fl', 'fr', 'rl', 'rr'].forEach((zW8KunciRodaQQQQQQ) => {
    const zW8ObjRodaQQQQQQQ = zW8VehRefQQQ.wheels[zW8KunciRodaQQQQQQ]; if (zW8ObjRodaQQQQQQQ) zW8ObjRodaQQQQQQQ.rotation.x = (zW8ObjRodaQQQQQQQ.rotation.x || 0) + 0; });

    ['fl', 'fr', 'rl', 'rr'].forEach((zW8KunciRodaQQQQQQQ) => {
    const zW8ObjRodaQQQQQQQQ = zW8VehRefQQQ.wheels[zW8KunciRodaQQQQQQQ]; if (zW8ObjRodaQQQQQQQQ) {
      zW8ObjRodaQQQQQQQQ.userData.spin = (zW8ObjRodaQQQQQQQQ.userData.spin || 0) + ((zW8VehRefQQQ.speed * zW8DtRef) / 0.33);
      zW8ObjRodaQQQQQQQQ.rotation.set (zW8ObjRodaQQQQQQQQ.userData.spin, 0, 0); } }); }
  export function updateTraffic(G, zW8Dt) {
  if (! G.traffic) return; const zW8AcuanPemainX = G.car ? G.car.x : (G.player ? G.player.x : 0); const zW8AcuanPemainZ = G.car ? G.car.z : (G.player ? G.player.z : 0);
  const zW8IalahMalam = G.timeOfDay > 18.5 || G.timeOfDay < 5.5; for (const zW8Mobil of G.traffic) {
    if (zW8Mobil.driver !== 'traffic') continue; const zW8JarakKePemain = Math.hypot(zW8Mobil.x - (zW8AcuanPemainX), zW8Mobil.z - (zW8AcuanPemainZ));
      if (zW8JarakKePemain > 500) {
      const zW8LahirSepanjangX = rnd() < 0.5; const zW8JalanLahir = pick(zW8LahirSepanjangX ? G.roadX : G.roadZ); zW8Mobil.onX = zW8LahirSepanjangX;
      zW8Mobil.line = zW8JalanLahir; zW8Mobil.dirSign = rnd() < 0.5 ? 1 : - 1; const zW8NilaiJangkar = zW8LahirSepanjangX ? zW8AcuanPemainZ : zW8AcuanPemainX;
      const zW8LahirSepanjang = Math.max(- 640, Math.min(640, zW8NilaiJangkar + rr(- 260, 260)));
      zW8Mobil.x = zW8LahirSepanjangX ? zW8JalanLahir + (zW8Mobil.dirSign * 5) : zW8LahirSepanjang;
      zW8Mobil.z = zW8LahirSepanjangX ? zW8LahirSepanjang : zW8JalanLahir + (- (zW8Mobil.dirSign * 5)); zW8Mobil.speed = zW8Mobil.cruise; }

    let zW8AdaHalangan = false; for (const zW8MobilLain of G.traffic) {
      if (zW8MobilLain === zW8Mobil) continue; const zW8BedaX = zW8MobilLain.x - (zW8Mobil.x), zW8BedaZ = zW8MobilLain.z - (zW8Mobil.z);
      const zW8VektorMajuX = Math.sin(zW8Mobil.angle), zW8VektorMajuZ = Math.cos(zW8Mobil.angle);
      const zW8ProyeksiDepan = (zW8BedaX * zW8VektorMajuX) + (zW8BedaZ * zW8VektorMajuZ);
      const zW8ProyeksiSamping = Math.abs((zW8BedaX * zW8VektorMajuZ) + (- (zW8BedaZ * zW8VektorMajuX)));
        if (zW8ProyeksiDepan > 0 && zW8ProyeksiDepan < 9 && zW8ProyeksiSamping < 2.2) {
        zW8AdaHalangan = true; break; } }
      if (G.car && G.car !== zW8Mobil) {
      const zW8BedaXQ = G.car.x - (zW8Mobil.x), zW8BedaZQ = G.car.z - (zW8Mobil.z);
      const zW8ProyeksiDepanQ = (zW8BedaXQ * Math.sin(zW8Mobil.angle)) + (zW8BedaZQ * Math.cos(zW8Mobil.angle));
      const zW8ProyeksiSampingQ = Math.abs((zW8BedaXQ * Math.cos(zW8Mobil.angle)) + (- (zW8BedaZQ * Math.sin(zW8Mobil.angle))));
      if (zW8ProyeksiDepanQ > 0 && zW8ProyeksiDepanQ < 9 && zW8ProyeksiSampingQ < 2.4) zW8AdaHalangan = true; }

    const zW8TargetLaju = zW8AdaHalangan ? 0 : zW8Mobil.cruise * (zW8Mobil.health < 35 ? 0.72 : 1);
    zW8Mobil.speed += Math.max(- 8 * zW8Dt, Math.min(3 * zW8Dt, zW8TargetLaju - (zW8Mobil.speed)));

    zW8Mobil.x += (Math.sin(zW8Mobil.angle) * zW8Mobil.speed) * zW8Dt; zW8Mobil.z += (Math.cos(zW8Mobil.angle) * zW8Mobil.speed) * zW8Dt;
    const zW8DaftarJalanSilang = zW8Mobil.onX ? G.roadZ : G.roadX; const zW8PosisiSepanjangQ = zW8Mobil.onX ? zW8Mobil.z : zW8Mobil.x;
      for (const zW8NilaiSilang of zW8DaftarJalanSilang) {
        if (Math.abs(zW8PosisiSepanjangQ - (zW8NilaiSilang)) < 1.2 && Math.abs(zW8Mobil.speed) > 1 && rnd() < 0.35) {

          if (zW8Mobil.onX) {
          zW8Mobil.z = zW8NilaiSilang; zW8Mobil.line = zW8NilaiSilang; } else {
          zW8Mobil.x = zW8NilaiSilang; zW8Mobil.line = zW8NilaiSilang; }
        zW8Mobil.onX = ! zW8Mobil.onX; zW8Mobil.dirSign = rnd() < 0.5 ? 1 : - 1; if (zW8Mobil.onX) {
          zW8Mobil.x = zW8Mobil.line + (zW8Mobil.dirSign * 5); zW8Mobil.angle = zW8Mobil.dirSign > 0 ? 0 : Math.PI; } else {
          zW8Mobil.z = zW8Mobil.line + (- (zW8Mobil.dirSign * 5)); zW8Mobil.angle = zW8Mobil.dirSign > 0 ? Math.PI / 2 : - Math.PI / 2; }
        break; } }

    if (zW8Mobil.onX) zW8Mobil.x += ((zW8Mobil.line + (zW8Mobil.dirSign * 5)) - (zW8Mobil.x)) * Math.min(1, zW8Dt * 2);
    else zW8Mobil.z += ((zW8Mobil.line + (- (zW8Mobil.dirSign * 5))) - (zW8Mobil.z)) * Math.min(1, zW8Dt * 2);
      if (Math.abs(zW8Mobil.x) > 655 || Math.abs(zW8Mobil.z) > 655) {
      zW8Mobil.angle += Math.PI; zW8Mobil.dirSign *= - 1; zW8Mobil.x = Math.max(- 650, Math.min(650, zW8Mobil.x));
      zW8Mobil.z = Math.max(- 650, Math.min(650, zW8Mobil.z)); }
    zW8Mobil.mesh.position.set (zW8Mobil.x, 0.02 + groundH(zW8Mobil.x, zW8Mobil.z), zW8Mobil.z); zW8Mobil.mesh.rotation.y = zW8Mobil.angle;
    const zW8LangkahPutarRoda = (zW8Mobil.speed * zW8Dt) / (zW8Mobil.mesh.userData.wheelR || 0.33); zW8PutarRodaLaluLintas(zW8Mobil, zW8LangkahPutarRoda, zW8Dt);
      if (zW8IalahMalam && ! zW8Mobil.nightGlow) {
      const zW8SprPijarMalam = glowSprite(0xffe9a0, 2.2); zW8SprPijarMalam.position.set (0, 0.7, (zW8Mobil.spec.len / 2) + 0.4); zW8Mobil.mesh.add(zW8SprPijarMalam);
      zW8Mobil.nightGlow = zW8SprPijarMalam; }
      if (! zW8IalahMalam && zW8Mobil.nightGlow) {
      zW8Mobil.mesh.remove(zW8Mobil.nightGlow); zW8Mobil.nightGlow = null; } }
 }
  export function damageVehicle(G, zW8VehQQQ, zW8JumlahRusak) {
  zW8VehQQQ.health = Math.max(0, zW8VehQQQ.health - (zW8JumlahRusak)); zW8ArmFxHook(G);

  const zW8PosisiBenturan = zW8HoodPosWorld(zW8VehQQQ, new THREE.Vector3()); spawnSmokeAt(G, zW8PosisiBenturan, 3, zW8VehQQQ.health < 25); let zW8IdxSembur = 0;
    while (zW8IdxSembur < 3) {
    spawnDamagePuff(G, zW8VehQQQ, false); ++ zW8IdxSembur; } }

  export function darknessFactor(G) {
  const zW8JamNilai = (G && typeof G.timeOfDay === 'number') ? G.timeOfDay : 10.5;
  const zW8LevelSiang = Math.max(0, Math.min(1, Math.sin(((zW8JamNilai - (6)) / 12) * Math.PI))); return 1 - (zW8LevelSiang); }
  const zW8HoodPosWorld = (zW8VehQQQQ, zW8VektorKeluar) => {
    const zW8SpecVeh = zW8VehQQQQ.spec || {
  }; const zW8TinggiKap = zW8SpecVeh.hood != null ? (zW8SpecVeh.hood * 0.28) + 0.62 : 0.85; zW8VektorKeluar.set (0, zW8TinggiKap, (zW8SpecVeh.len || 4.4) * 0.32);
    if (zW8VehQQQQ.mesh && zW8VehQQQQ.mesh.localToWorld) {
    zW8VehQQQQ.mesh.updateMatrixWorld(true); zW8VehQQQQ.mesh.localToWorld(zW8VektorKeluar);
  } else zW8VektorKeluar.add(zW8VehQQQQ.mesh.position); return zW8VektorKeluar; };

  const zW8BandForHealth = (zW8NilaiHealth) => {

    const zW8TabelPita = [{
      batas : 15, pita : {
      rate : 12, color : 0x232528, s0 : 0.9, s1 : 3.2, op : 0.65 } }, {
      batas : 40, pita : {
      rate : 6, color : 0x777c83, s0 : 0.7, s1 : 2.4, op : 0.45 }
  },]; const zW8EntriCocok = zW8TabelPita.find((zW8EntriPita) => zW8NilaiHealth < zW8EntriPita.batas); return zW8EntriCocok ? zW8EntriCocok.pita : {
    rate : 2, color : 0xb8bcc0, s0 : 0.5, s1 : 1.6, op : 0.28 };
}; const zW8HoodScratchVec = new THREE.Vector3(); export function spawnDamagePuff(G, zW8VehQQQQQ, zW8PraHangat, zW8UsiaPaksa) {
  zW8BuildSmokePool(G); if (! zW8SmokePool) return; const zW8PitaAktif = zW8BandForHealth(zW8VehQQQQQ.health); for (const zW8Gumpal of zW8SmokePool) {
    if (zW8Gumpal.life > 0) continue; zW8HoodPosWorld(zW8VehQQQQQ, zW8HoodScratchVec);
    const zW8UsiaAwal = typeof zW8UsiaPaksa === 'number' ? zW8UsiaPaksa : (zW8PraHangat ? rr(0, 1.1) : 0); zW8Gumpal.kind = 'dmg'; zW8Gumpal.fire = false;
    zW8Gumpal.max = 1.4; zW8Gumpal.life = 1.4 - (zW8UsiaAwal); zW8Gumpal.s0 = zW8PitaAktif.s0; zW8Gumpal.s1 = zW8PitaAktif.s1; zW8Gumpal.op = zW8PitaAktif.op;
    zW8Gumpal.s.material.color.set (zW8PitaAktif.color);
    zW8Gumpal.s.position.set ((zW8HoodScratchVec.x + rr(- 0.15, 0.15)) + (zW8UsiaAwal * 0.3), zW8HoodScratchVec.y + (zW8UsiaAwal * 1.2), zW8HoodScratchVec.z + rr(- 0.15, 0.15));
    zW8Gumpal.vx = rr(- 0.08, 0.08) + 0.3; zW8Gumpal.vy = rr(- 0.2, 0.2) + 1.2; zW8Gumpal.vz = rr(- 0.08, 0.08);
    const zW8SkalaAwal = zW8Gumpal.s0 + ((zW8Gumpal.s1 - (zW8Gumpal.s0)) * (zW8UsiaAwal / 1.4)); zW8Gumpal.s.scale.set (zW8SkalaAwal, zW8SkalaAwal, 1);
    zW8Gumpal.s.visible = true; return; } }

  export function primeDamageSmoke(G, zW8VehQQQQQQ, zW8JumlahMintaQ) {
  const zW8JumlahTotalQ = zW8JumlahMintaQ || 10; let zW8IdxGumpal = 0;
    while (zW8IdxGumpal < zW8JumlahTotalQ) {
    spawnDamagePuff(G, zW8VehQQQQQQ, true, zW8JumlahTotalQ > 1 ? (zW8IdxGumpal / (zW8JumlahTotalQ - 1)) * 1.2 : 0); ++ zW8IdxGumpal; } }

const zW8HeadConeGeo = new THREE.ConeGeometry(1.15, 7, 20, 1, true); zW8HeadConeGeo.translate(0, - 3.5, 0); const zW8HeadConeMat = new THREE.MeshBasicMaterial({
  color : 0xffe2a8, transparent : true, opacity : 0, blending : THREE.AdditiveBlending, depthWrite : false, side : THREE.DoubleSide, fog : false,
}); function zW8BuildHeadlights(zW8VehQQQQQQQ) {
  if (zW8VehQQQQQQQ._hl || ! zW8VehQQQQQQQ.mesh || ! zW8VehQQQQQQQ.spec) return;
  const zW8SpecVehQ = zW8VehQQQQQQQ.spec, zW8WidVeh = zW8SpecVehQ.wid, zW8LenVeh = zW8SpecVehQ.len;
    const zW8BuatSprPijar = (zW8NadaSpr, zW8SkalaSpr, zW8PosX, zW8PosY, zW8PosZ) => {
    const zW8SprBaru = glowSprite(zW8NadaSpr, zW8SkalaSpr); zW8SprBaru.position.set (zW8PosX, zW8PosY, zW8PosZ); zW8SprBaru.userData.s25Light = true;
    zW8VehQQQQQQQ.mesh.add(zW8SprBaru); return zW8SprBaru;
  }; const zW8SetLampu = {
  }; zW8SetLampu.glowL = zW8BuatSprPijar(0xffe9a0, 1.25, zW8WidVeh * - 0.32, 0.62, (zW8LenVeh / 2) + 0.12);
  zW8SetLampu.glowR = zW8BuatSprPijar(0xffe9a0, 1.25, zW8WidVeh * 0.32, 0.62, (zW8LenVeh / 2) + 0.12);
  zW8SetLampu.tailL = zW8BuatSprPijar(0xff2a22, 0.85, zW8WidVeh * - 0.32, 0.72, (zW8LenVeh / - 2) - (0.1));
  zW8SetLampu.tailR = zW8BuatSprPijar(0xff2a22, 0.85, zW8WidVeh * 0.32, 0.72, (zW8LenVeh / - 2) - (0.1)); zW8SetLampu.cones = [];
    [- 1, 1].forEach((zW8TandaSisiQQQQQQQQ) => {
    const zW8MeshKerucut = new THREE.Mesh(zW8HeadConeGeo, zW8HeadConeMat.clone());
    zW8MeshKerucut.position.set (zW8TandaSisiQQQQQQQQ * zW8WidVeh * 0.32, 0.58, zW8LenVeh / 2); zW8MeshKerucut.rotation.x = (- Math.PI / 2) + 0.07;
    zW8MeshKerucut.visible = false; zW8MeshKerucut.userData.s25Light = true; zW8VehQQQQQQQ.mesh.add(zW8MeshKerucut); zW8SetLampu.cones.push(zW8MeshKerucut);
  }); zW8VehQQQQQQQ._hl = zW8SetLampu; }
  function zW8BuildPlayerSpot(zW8VehQQQQQQQQ) {
  if (zW8VehQQQQQQQQ._hlSpot || ! zW8VehQQQQQQQQ.mesh) return; const zW8LenVehQ = zW8VehQQQQQQQQ.spec.len;
  const zW8LampuSorot = new THREE.SpotLight(0xffe6b8, 0, 40, 0.5, 0.6); zW8LampuSorot.position.set (0, 0.7, zW8LenVehQ / 2);
  zW8LampuSorot.target.position.set (0, 0, (zW8LenVehQ / 2) + 18); zW8LampuSorot.userData.s25Light = true; zW8VehQQQQQQQQ.mesh.add(zW8LampuSorot);
  zW8VehQQQQQQQQ.mesh.add(zW8LampuSorot.target); zW8VehQQQQQQQQ._hlSpot = zW8LampuSorot; }
let zW8FxHookArmed = false; const zW8ArmFxHook = (G) => {
  if (zW8FxHookArmed || ! G || ! Array.isArray(G.updaters)) return; zW8FxHookArmed = true; G.updaters.push((zW8G2, zW8DtQ) => {
      try {
      updateDamageFx(zW8G2, zW8DtQ || 0.016); } catch (e) { } });
}; export function updateDamageFx(G, zW8DtQQ) {
  if (! G || ! Array.isArray(G.vehicles)) return; const zW8JumlahGelap = darknessFactor(G); const zW8AcuanX = G.car ? G.car.x : (G.player ? G.player.x : 0);
  const zW8AcuanZ = G.car ? G.car.z : (G.player ? G.player.z : 0);

  const zW8DaftarRusak = []; G.vehicles.forEach((zW8VehQQQQQQQQQ) => {
    if (zW8VehQQQQQQQQQ && zW8VehQQQQQQQQQ.health < 70 && zW8VehQQQQQQQQQ.mesh) zW8DaftarRusak.push(zW8VehQQQQQQQQQ); });
  zW8DaftarRusak.sort((zW8VehA, zW8VehB) => (((zW8VehA.x - (zW8AcuanX)) ** 2) + ((zW8VehA.z - (zW8AcuanZ)) ** 2)) + (- (((zW8VehB.x - (zW8AcuanX)) ** 2) + ((zW8VehB.z - (zW8AcuanZ)) ** 2))));
  const zW8SetPemancar = new Set(zW8DaftarRusak.slice(0, 10)); const zW8LampuNyala = zW8JumlahGelap > 0.25; for (const zW8VehQQQQQQQQQQ of G.vehicles) {
    if (! zW8VehQQQQQQQQQQ || ! zW8VehQQQQQQQQQQ.mesh) continue; zW8BuildHeadlights(zW8VehQQQQQQQQQQ); const zW8SetLampuQ = zW8VehQQQQQQQQQQ._hl;
    if (! zW8SetLampuQ) continue;
    const zW8SedangMengerem = zW8VehQQQQQQQQQQ._prevSpeed != null && zW8DtQQ > 0 && ((zW8VehQQQQQQQQQQ._prevSpeed + (- (zW8VehQQQQQQQQQQ.speed || 0))) / zW8DtQQ) > 2;
    zW8VehQQQQQQQQQQ._prevSpeed = zW8VehQQQQQQQQQQ.speed || 0; [zW8SetLampuQ.glowL, zW8SetLampuQ.glowR].forEach((zW8SprPijar) => {
      zW8SprPijar.visible = zW8LampuNyala; zW8SprPijar.material.opacity = zW8JumlahGelap * 0.85;
    }); [zW8SetLampuQ.tailL, zW8SetLampuQ.tailR].forEach((zW8SprPijarQ) => {
      zW8SprPijarQ.visible = zW8LampuNyala; zW8SprPijarQ.material.opacity = (zW8SedangMengerem ? 0.95 : 0.4) * zW8JumlahGelap;
    }); zW8SetLampuQ.cones.forEach((zW8MeshKerucutQ) => {
      zW8MeshKerucutQ.visible = zW8LampuNyala; zW8MeshKerucutQ.material.opacity = zW8JumlahGelap * 0.10;
    }); if (zW8SetPemancar.has(zW8VehQQQQQQQQQQ)) {
      zW8VehQQQQQQQQQQ._smokeAcc = (zW8VehQQQQQQQQQQ._smokeAcc || 0) + (zW8BandForHealth(zW8VehQQQQQQQQQQ.health).rate * zW8DtQQ);
        while (! (zW8VehQQQQQQQQQQ._smokeAcc < 1)) {
        zW8VehQQQQQQQQQQ._smokeAcc -= 1; spawnDamagePuff(G, zW8VehQQQQQQQQQQ, false); } } }

    if (G.car && G.car.mesh) {
    zW8BuildPlayerSpot(G.car); if (G.car._hlSpot) G.car._hlSpot.intensity = zW8JumlahGelap * 55; } }

let zW8SmokePool = null; function zW8BuildSmokePool(G) {
  if (zW8SmokePool) return; zW8SmokePool = []; const zW8LembarAsap = document.createElement('canvas'); zW8LembarAsap.height = 64;
  zW8LembarAsap.width = zW8LembarAsap.height; const zW8KuasAsap = zW8LembarAsap.getContext('2d');
  const zW8RadialAsap = zW8KuasAsap.createRadialGradient(32, 32, 2, 32, 32, 32); zW8RadialAsap.addColorStop(0, 'rgba(255,255,255,.85)');
  zW8RadialAsap.addColorStop(1, 'rgba(255,255,255,0)'); zW8KuasAsap.fillStyle = zW8RadialAsap; zW8KuasAsap.fillRect(0, 0, 64, 64);
  const zW8TexGumpal = new THREE.CanvasTexture(zW8LembarAsap); let zW8IdxKolam = 0;
    while (zW8IdxKolam < 120) {
      const zW8SprGumpal = new THREE.Sprite(new THREE.SpriteMaterial({
      map : zW8TexGumpal, transparent : true, opacity : 0, depthWrite : false
    })); zW8SprGumpal.visible = false; G.scene.add(zW8SprGumpal); const zW8RekGumpal = {
    }; zW8RekGumpal.s = zW8SprGumpal; zW8RekGumpal.life = 0; zW8RekGumpal.max = 1; zW8RekGumpal.fire = false; zW8RekGumpal.kind = 'legacy'; zW8RekGumpal.vx = 0;
    zW8RekGumpal.vy = 0; zW8RekGumpal.vz = 0; zW8RekGumpal.s0 = 0.7; zW8RekGumpal.s1 = 2.9; zW8RekGumpal.op = 0.5; zW8SmokePool.push(zW8RekGumpal); ++ zW8IdxKolam; } }
  export function spawnSmokeAt(G, zW8PosisiAsap, zW8JumlahMintaQQ, zW8IalahApi) {
  zW8BuildSmokePool(G); let zW8JumlahTerbentuk = 0; for (const zW8GumpalQ of zW8SmokePool) {
    if (zW8JumlahTerbentuk >= zW8JumlahMintaQQ) break; if (zW8GumpalQ.life > 0) continue; zW8GumpalQ.life = zW8GumpalQ.max = rr(0.6, 1.3);
    zW8GumpalQ.fire = ! ! zW8IalahApi; zW8GumpalQ.kind = 'legacy';
    zW8GumpalQ.s.position.set (zW8PosisiAsap.x + rr(- 0.4, 0.4), zW8PosisiAsap.y + rr(0.5, 1), zW8PosisiAsap.z + rr(- 0.4, 0.4));
    zW8GumpalQ.s.material.color.set (zW8IalahApi ? 0xff7a2a : 0x8a8f96); zW8GumpalQ.s.scale.set (0.7, 0.7, 1); zW8GumpalQ.s.visible = true;
    zW8GumpalQ.vx = rr(- 0.3, 0.3); zW8GumpalQ.vy = rr(1, 2); zW8GumpalQ.vz = rr(- 0.3, 0.3); ++ zW8JumlahTerbentuk; } }
  export function updateSmoke(G, zW8DtQQQ) {
    if (zW8SmokePool) for (const zW8GumpalQQ of zW8SmokePool) {
    if (! (zW8GumpalQQ.life > 0)) continue; zW8GumpalQQ.life -= zW8DtQQQ; if (! (zW8GumpalQQ.life > 0)) {
      zW8GumpalQQ.s.visible = false; zW8GumpalQQ.s.material.opacity = 0; continue; }
    const zW8FraksiHidup = 1 + (- (zW8GumpalQQ.life / zW8GumpalQQ.max)); zW8GumpalQQ.s.position.x += zW8GumpalQQ.vx * zW8DtQQQ;
    zW8GumpalQQ.s.position.y += zW8GumpalQQ.vy * zW8DtQQQ; zW8GumpalQQ.s.position.z += zW8GumpalQQ.vz * zW8DtQQQ; if (zW8GumpalQQ.kind === 'dmg') {
      const zW8SkalaTumbuhQ = zW8GumpalQQ.s0 + ((zW8GumpalQQ.s1 - (zW8GumpalQQ.s0)) * zW8FraksiHidup); zW8GumpalQQ.s.scale.set (zW8SkalaTumbuhQ, zW8SkalaTumbuhQ, 1);
      zW8GumpalQQ.s.material.opacity = zW8GumpalQQ.op * (1 - (zW8FraksiHidup)); continue; }
    const zW8SkalaTumbuh = (zW8GumpalQQ.fire ? 1.2 : 2.2) * zW8FraksiHidup + 0.7; zW8GumpalQQ.s.scale.set (zW8SkalaTumbuh, zW8SkalaTumbuh, 1);
    zW8GumpalQQ.s.material.opacity = (zW8GumpalQQ.fire ? 0.75 : 0.5) * (1 - (zW8FraksiHidup)) * (zW8GumpalQQ.fire ? (rnd() * 0.5) + 0.7 : 1);
    if (zW8GumpalQQ.fire) zW8GumpalQQ.s.material.color.setHSL((rnd() * 0.03) + 0.06, 1, 0.5); } }
  export {
  hexCss };
