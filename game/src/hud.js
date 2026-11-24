// Heads-up layer: every 2D readout sits here — wallet and rank,
// heat stars, map pair, dial, garage list, briefs and popups.
import { CLUB_RANKS, CAST, DISTRICTS, CFG, MISSIONS } from './config.js';
import { roadRoute } from './world.js';
import { districtAt } from './police.js';
function grabW(nodeIdW) { return document.getElementById(nodeIdW); }
const LOCALE_W = 'en-US';
function moneyTextW(amountW) { const wholeW = Math.round(amountW || 0); const partsW = ['$']; partsW.push(wholeW.toLocaleString(LOCALE_W)); return partsW.join(''); }
export function initHUD(G) {
  const E = {};
  E.objective = grabW('objective'); E.money = grabW('money');
  E.rep = grabW('rep'); E.rank = grabW('rank'); E.stars = grabW('stars');
  E.healthBar = grabW('healthBar'); E.carBar = grabW('carBar');
  E.card = grabW('missionCard'); E.cardPortrait = grabW('cardPortrait');
  E.cardGiver = grabW('cardGiver'); E.cardText = grabW('cardText');
  E.cardProg = grabW('cardProg'); E.copPanel = grabW('copPanel');
  E.copRows = grabW('copRows'); E.briefing = grabW('briefing');
  E.banner = grabW('banner'); E.toast = grabW('toast');
  E.pauseMenu = grabW('pauseMenu'); E.bigmap = grabW('bigmap');
  E.mapLegend = grabW('mapLegend'); E.minimap = grabW('minimap');
  E.speedo = grabW('speedoCanvas'); E.wasted = grabW('wasted');
  E.busted = grabW('busted'); E.garagePanel = grabW('garagePanel');
  E.mapWrap = grabW('mapWrap');
  // No radio node ships in the markup; build one lazily and only
  // reveal it while the player drives with a station playing.
  let radioW = grabW('radioChip');
  if (!radioW && typeof document !== 'undefined' && document.body) {
    radioW = document.createElement('div'); radioW.id = 'radioChip';
    radioW.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;padding:5px 14px;border-radius:999px;background:rgba(10,12,18,0.72);border:1px solid rgba(255,122,26,0.65);color:#ffd9ae;font:bold 13px Arial,sans-serif;letter-spacing:1px;white-space:nowrap;';
    document.body.appendChild(radioW); }
  E.radioChip = radioW;
  if (G.playerHealth == null) G.playerHealth = 100;
  if (G.bustMeter == null) G.bustMeter = 0;
  if (G._lastDamageAt == null) G._lastDamageAt = -99;
  let dispatchW = grabW('dispatchLine');
  if (!dispatchW && typeof document !== 'undefined' && document.body) {
    dispatchW = document.createElement('div'); dispatchW.id = 'dispatchLine';
    dispatchW.style.cssText = 'position:fixed;top:172px;left:16px;z-index:30;pointer-events:none;display:none;max-width:430px;padding:4px 10px;background:rgba(8,10,14,0.66);border-left:3px solid #57b7ff;color:#cfe6ff;font:12px "Courier New",monospace;letter-spacing:0.4px;white-space:nowrap;overflow:hidden;';
    document.body.appendChild(dispatchW); }
  E.dispatch = dispatchW;
  let bustWrapW = grabW('bustWrap');
  if (!bustWrapW && typeof document !== 'undefined' && document.body) {
    bustWrapW = document.createElement('div'); bustWrapW.id = 'bustWrap';
    bustWrapW.style.cssText = 'position:fixed;top:64px;right:16px;z-index:30;pointer-events:none;display:none;width:190px;';
    const bustHeadW = '<div id="bustLabel" style="color:#ffd23f;font:bold 13px Arial,sans-serif;letter-spacing:3px;text-align:right;text-shadow:0 1px 3px #000;">BUSTED</div>';
    bustWrapW.innerHTML = bustHeadW + '<div style="height:7px;margin-top:3px;background:rgba(255,255,255,0.18);border:1px solid rgba(0,0,0,0.6);"><div id="bustFill" style="height:100%;width:0%;background:#57b7ff;"></div></div>';
    document.body.appendChild(bustWrapW); }
  E.bustWrap = bustWrapW;
  E.bustFill = bustWrapW ? bustWrapW.querySelector('#bustFill') : null;
  E.bustLabel = bustWrapW ? bustWrapW.querySelector('#bustLabel') : null;
  let dispatchSecsW = 0;
  G.dispatch = (lineW) => { G.lastDispatch = lineW; if (!E.dispatch) return; E.dispatch.textContent = lineW; E.dispatch.style.display = 'block'; E.dispatch.style.opacity = '1'; dispatchSecsW = 5; };
  function overlayHeadW(nodeW, titleW, colW) {
    const headW = document.createElement('div'); headW.className = 's26Title'; headW.textContent = titleW;
    headW.style.cssText = `color:${colW};font:bold 104px Arial,sans-serif;letter-spacing:22px;text-shadow:0 4px 22px rgba(0,0,0,0.85);`;
    nodeW.appendChild(headW); return headW; }
  function overlaySubW(nodeW) {
    const subW = document.createElement('div'); subW.className = 's26Sub';
    subW.style.cssText = 'color:#e8e8e8;font:17px Arial,sans-serif;letter-spacing:2px;margin-top:16px;text-shadow:0 2px 8px #000;';
    nodeW.appendChild(subW); return subW; }
  function overlayBuildW(nodeW, titleW, bgW, colW) {
    if (!nodeW) return null;
    nodeW.innerHTML = '';
    nodeW.style.cssText = `position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;flex-direction:column;background:${bgW};pointer-events:none;`;
    const outW = {}; outW.title = overlayHeadW(nodeW, titleW, colW); outW.sub = overlaySubW(nodeW); return outW; }
  const wastedOvW = overlayBuildW(E.wasted, 'WASTED', 'radial-gradient(ellipse at center, rgba(74,4,4,0.55) 0%, rgba(16,0,0,0.94) 100%)', '#c9c9c9');
  const bustedOvW = overlayBuildW(E.busted, 'BUSTED', 'radial-gradient(ellipse at center, rgba(24,38,58,0.55) 0%, rgba(4,8,16,0.94) 100%)', '#dfe9f5');
  let flowW = null;
  function stagedW() { return !!(G.shot || G.shotMode); }
  function heroPtW() { const srcW = G.car ? G.car : null; const outW = {}; outW.x = srcW ? srcW.x : (G.player?.x || 0); outW.z = srcW ? srcW.z : (G.player?.z || 0); return outW; }
  function parkCarPosW(carW, pxW, pzW) { carW.x = pxW; carW.z = pzW; if (carW.mesh) { carW.mesh.position.set(pxW, carW.mesh.position.y, pzW); carW.mesh.rotation.y = 0; } }
  function parkCarStateW(carW, healthW) { carW.speed = 0; carW.angle = 0; carW.health = healthW; }
  function parkCarW(carW, pxW, pzW, healthW) { if (!carW) return; parkCarPosW(carW, pxW, pzW); parkCarStateW(carW, healthW); }
  function parkFigW(pxW, pzW) {
    const figW = G.player; if (!figW) return;
    figW.x = pxW; figW.z = pzW;
    if (figW.fig) { figW.fig.visible = true; figW.fig.position.set(pxW, figW.fig.position.y, pzW); } }
  function settleTailW(kindW) { G.wanted = 0; G.bustMeter = 0; G.playerHealth = 100; G.frozen = false; flowW = null; G.saveGame?.(); void kindW; }
  function settleWastedW(keptCarW) {
    G.money = Math.max(0, (G.money || 0) + (-150));
    parkCarW(keptCarW, (G.hq && G.hq.garage && G.hq.garage.x) || -412.5, (G.hq && G.hq.garage && G.hq.garage.z) || 452, 60);
    parkFigW(330, -330);
    G.timeOfDay = ((G.timeOfDay || 12) + 2) % 24; G.flags.wasted = false; G.toast?.('Wasted — hospital bill $150'); }
  function settleBustedW(keptCarW) {
    G.money = Math.max(0, (G.money || 0) + (-200));
    parkCarW(keptCarW, -408.5, 456, 50);
    parkFigW(-412.5, 452);
    G.timeOfDay = ((G.timeOfDay || 12) + 1) % 24; G.flags.busted = false; G.toast?.('Busted — RBPD fine $200, ride impounded to HQ'); }
  function settleW() {
    const kindW = flowW.kind; const keptCarW = flowW.car;
    if (G.car) { try { G.exitCar?.(); } catch (errW) {} }
    const wastedCaseW = kindW === 'wasted'; void wastedCaseW;
    const dispatchW2 = { wasted: settleWastedW, busted: settleBustedW };
    dispatchW2[kindW](keptCarW);
    settleTailW(kindW); }
  G.hud = G.hud || {};
  G.hud.showWasted = (zoneW) => {
    if (G.flags.wasted) return;
    const hereW = heroPtW(); G.flags.wasted = true;
    if (wastedOvW) wastedOvW.sub.textContent = `You were flatlined in ${zoneW || districtAt(hereW.x, hereW.z)}`;
    flowW = { kind: 'wasted', t: 2.8, car: G.car || null, staging: stagedW() };
    if (!flowW.staging) G.frozen = true; };
  G.hud.showBusted = () => {
    if (G.flags.busted) return;
    G.flags.busted = true;
    if (bustedOvW) bustedOvW.sub.textContent = 'RBPD impounded your ride';
    flowW = { kind: 'busted', t: 2.8, car: G.car || null, staging: stagedW() };
    if (!flowW.staging) G.frozen = true; };
  G.damagePlayer = (hitW) => {
    if (!(hitW > 0) || stagedW() || flowW || G.flags.wasted || G.flags.busted) return;
    G.playerHealth = Math.max(0, (G.playerHealth ?? 100) + (-hitW)); G._lastDamageAt = G.elapsed || 0;
    if (!(G.playerHealth > 0)) G.hud.showWasted(); };
  const mmCtxW = E.minimap ? E.minimap.getContext('2d') : null;
  const bmCtxW = E.bigmap ? E.bigmap.getContext('2d') : null;
  const spCtxW = E.speedo ? E.speedo.getContext('2d') : null;
  if (G.flags.mapZoom && E.mapWrap) {
    // Zooming the disc by 1.45 keeps it clear of the health
    // readout: at 150px wide from top:198px it ends near
    // 415.5px, while 1.9 used to reach 483px and collide.
    E.mapWrap.style.transform = 'scale(1.45)'; E.mapWrap.style.transformOrigin = 'top left'; }
  if (E.bigmap) { E.bigmap.style.height = 'min(578px, calc(100vh - 150px))'; E.bigmap.style.width = 'auto'; E.bigmap.style.maxWidth = '94vw'; }
  const CREW_W = {}; CREW_W.driver = { initials: 'RT', name: 'Ren Takagi', role: 'DRIVER', color: '#ff7a1a' }; CREW_W.mechanic = { initials: 'AS', name: 'Ako Sato', role: 'MECHANIC', color: '#3f6d8e' }; CREW_W.lookout = { initials: 'MC', name: 'Mika Chen', role: 'LOOKOUT', color: '#7a4fd0' };
  const crewCardsW = document.querySelectorAll('.crewCard');
  for (const cardW of crewCardsW) {
    const infoW = CREW_W[cardW.dataset.role]; if (!infoW) continue;
    const faceW = cardW.querySelector('.crewFace'); const nameW = cardW.querySelector('.crewName'); const roleW = cardW.querySelector('.crewRole');
    if (faceW) { faceW.textContent = infoW.initials; faceW.style.background = infoW.color; }
    if (nameW) nameW.textContent = infoW.name;
    if (roleW) roleW.textContent = infoW.role; }
  let toastSecsW = 0, bannerSecsW = 0, briefSecsW = 0;
  G.toast = (msgW) => { if (!E.toast) return; E.toast.textContent = msgW; E.toast.style.display = 'block'; E.toast.style.opacity = '1'; clearTimeout(toastSecsW); toastSecsW = setTimeout(() => { E.toast.style.display = 'none'; }, 3000); };
  G.banner = (msgW) => { if (!E.banner) return; E.banner.textContent = msgW; E.banner.style.display = 'block'; clearTimeout(bannerSecsW); bannerSecsW = setTimeout(() => { E.banner.style.display = 'none'; }, 2500); };
  function initialsOfW(personW, giverW) {
    const wordsW = (personW?.name || giverW || '?').trim().split(/\s+/);
    const lettersW = [];
    for (const wordW of wordsW) lettersW.push(wordW[0]);
    return lettersW.join('').slice(0, 2).toUpperCase(); }
  function chipColorW(personW) { return personW?.outfit?.topColor ? '#' + personW.outfit.topColor.toString(16).padStart(6, '0') : '#444'; }
  G.showBriefing = (giverW, lineW) => {
    if (!E.briefing) return;
    const personW = CAST[giverW];
    const chipW = E.briefing.querySelector('.giverChip'); const nameW = E.briefing.querySelector('.giver'); const lineNodeW = E.briefing.querySelector('.line');
    if (chipW) { chipW.textContent = initialsOfW(personW, giverW); chipW.style.background = chipColorW(personW); }
    if (nameW) nameW.textContent = personW?.name || giverW || '';
    if (lineNodeW) lineNodeW.textContent = lineW || '';
    E.briefing.style.display = 'block'; clearTimeout(briefSecsW);
    briefSecsW = setTimeout(() => { E.briefing.style.display = 'none'; }, 5000); };
  const viewW = { zoom: 1, cx: 0, cz: 0 };
  function resetViewW() { viewW.zoom = 1; viewW.cx = 0; viewW.cz = 0; }
  G.togglePause = () => {
    if (!E.pauseMenu) return;
    if (G.paused) { resetViewW(); E.pauseMenu.style.display = 'block'; bigMapW(); legendFillW(); }
    else E.pauseMenu.style.display = 'none'; };
  function legendFillW() {
    if (!E.mapLegend || E.mapLegend.dataset.filled) return;
    E.mapLegend.dataset.filled = '1';
    const chipsW = [];
    chipsW.push('<span class="lgChip"><b style="color:#fff">➤</b> You</span>');
    chipsW.push('<span class="lgChip"><b style="color:#ffd23f">■</b> Objective</span>');
    chipsW.push('<span class="lgChip"><b>G</b> Garage</span>');
    chipsW.push('<span class="lgChip"><b style="color:#ff8c1a">M</b> RONIN MART</span>');
    chipsW.push('<span class="lgChip"><b>⌂</b> HQ / Safehouse</span>');
    chipsW.push('<span class="lgChip"><b style="color:#57b7ff">●</b> RBPD</span>');
    chipsW.push('<span class="lgChip"><b style="color:#ff4fd8">━</b> Route</span>');
    chipsW.push('<span class="lgChip">Scroll zoom · drag pan</span>');
    E.mapLegend.innerHTML = chipsW.join(' '); }
  if (E.bigmap && !E.bigmap.dataset.panzoom) {
    E.bigmap.dataset.panzoom = '1';
    const cvW = E.bigmap; cvW.style.cursor = 'grab'; cvW.style.touchAction = 'none';
    function clampViewW() { const halfSpanW = CFG.world / (2 * viewW.zoom); const limitW = Math.max(0, CFG.half + (-halfSpanW)); viewW.cx = Math.max(-limitW, Math.min(limitW, viewW.cx)); viewW.cz = Math.max(-limitW, Math.min(limitW, viewW.cz)); }
    cvW.addEventListener('wheel', (evW) => {
      if (!G.paused) return;
      evW.preventDefault();
      const rectW = cvW.getBoundingClientRect();
      const curXW = (evW.clientX - rectW.left) * (cvW.width / rectW.width); const curYW = (evW.clientY - rectW.top) * (cvW.height / rectW.height);
      const margW = 46;
      const scaleBeforeW = Math.min((cvW.width - margW * 2) / CFG.world, (cvW.height - margW * 2) / CFG.world) * viewW.zoom;
      const worldXW = viewW.cx + ((curXW - cvW.width / 2) / scaleBeforeW); const worldZW = viewW.cz + ((curYW - cvW.height / 2) / scaleBeforeW);
      viewW.zoom = Math.max(1, Math.min(5, viewW.zoom * (evW.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const scaleAfterW = Math.min((cvW.width - margW * 2) / CFG.world, (cvW.height - margW * 2) / CFG.world) * viewW.zoom;
      viewW.cx = worldXW + (-((curXW - cvW.width / 2) / scaleAfterW)); viewW.cz = worldZW + (-((curYW - cvW.height / 2) / scaleAfterW));
      clampViewW(); bigMapW();
    }, { passive: false });
    let dragW = null;
    cvW.addEventListener('pointerdown', (evW) => { if (!G.paused) return; dragW = { x: evW.clientX, y: evW.clientY }; cvW.style.cursor = 'grabbing'; try { cvW.setPointerCapture(evW.pointerId); } catch (errW) {} });
    cvW.addEventListener('pointermove', (evW) => {
      if (!dragW || !G.paused) return;
      const rectW = cvW.getBoundingClientRect(); const margW = 46;
      const scaleNowW = Math.min((cvW.width - margW * 2) / CFG.world, (cvW.height - margW * 2) / CFG.world) * viewW.zoom;
      viewW.cx = viewW.cx - ((evW.clientX - dragW.x) * (cvW.width / rectW.width) / scaleNowW);
      viewW.cz = viewW.cz - ((evW.clientY - dragW.y) * (cvW.height / rectW.height) / scaleNowW);
      dragW = { x: evW.clientX, y: evW.clientY }; clampViewW(); bigMapW(); });
    const finishDragW = () => { dragW = null; cvW.style.cursor = 'grab'; };
    cvW.addEventListener('pointerup', finishDragW); cvW.addEventListener('pointercancel', finishDragW); }
  if (G.flags.openPauseMap && E.pauseMenu) { resetViewW(); E.pauseMenu.style.display = 'block'; bigMapW(); legendFillW(); }
  const MAIN_X_W = new Set(); MAIN_X_W.add(0); MAIN_X_W.add(330); const MAIN_Z_W = new Set(); MAIN_Z_W.add(0); MAIN_Z_W.add(495);
  function rectProjW(ctxW, projW, x0W, z0W, x1W, z1W) {
    const [sx0W, sy0W] = projW(x0W, z0W); const [sx1W, sy1W] = projW(x1W, z1W);
    ctxW.fillRect(Math.min(sx0W, sx1W), Math.min(sy0W, sy1W), Math.abs(sx1W - sx0W), Math.abs(sy1W - sy0W)); }
  function wavesDrawW(ctxW, cvWW, cvHW) {
    ctxW.strokeStyle = 'rgba(255,255,255,0.10)'; ctxW.lineWidth = 1.5;
    let waveW = 0;
    while (14 > waveW) { const waveYW = (waveW / 14) * cvHW + ((waveW * 37) % 23); ctxW.beginPath(); let pxW = 0; while (!(pxW > cvWW)) { ctxW.lineTo(pxW, waveYW + Math.sin(pxW * 0.05 + waveW) * 2.5); pxW += 32; } ctxW.stroke(); waveW++; } }
  function blocksDrawW(ctxW, cvWW, cvHW, projW) {
    const roadsXW = G.roadX, roadsZW = G.roadZ, halfRoadW = CFG.roadW / 2;
    let blockIW = 0;
    while (blockIW < roadsXW.length - 1) {
      let blockJW = 0;
      while (blockJW < roadsZW.length - 1) {
        const [axW, ayW] = projW(roadsXW[blockIW] + halfRoadW, roadsZW[blockJW] + halfRoadW); const [bxW, byW] = projW(roadsXW[blockIW + 1] - halfRoadW, roadsZW[blockJW + 1] - halfRoadW);
        const rectXW = Math.min(axW, bxW), rectYW = Math.min(ayW, byW); const rectWW = Math.abs(bxW - axW), rectHW = Math.abs(byW - ayW);
        if (!(rectXW + rectWW < 0 || rectYW + rectHW < 0 || rectXW > cvWW || rectYW > cvHW)) {
          const midXW = (roadsXW[blockIW] + roadsXW[blockIW + 1]) / 2, midZW = (roadsZW[blockJW] + roadsZW[blockJW + 1]) / 2;
          ctxW.fillStyle = (-165 > midXW && -165 > midZW) ? '#b3c184' : '#cfc096'; ctxW.fillRect(rectXW, rectYW, rectWW, rectHW); }
        blockJW++; }
      blockIW++; } }
  function mapBaseW(ctxW, cvWW, cvHW, projW, viewValW, optsW) {
    const pxPerUnitW = Math.abs(projW(1, 0)[0] - projW(0, 0)[0]); const pauseModeW = !!optsW.labels;
    ctxW.fillStyle = '#3a7bd5'; ctxW.fillRect(0, 0, cvWW, cvHW);
    if (optsW.waves) wavesDrawW(ctxW, cvWW, cvHW);
    ctxW.fillStyle = '#eed9a4'; rectProjW(ctxW, projW, -CFG.half - 60, 600, CFG.half + 60, 668);
    ctxW.fillStyle = '#ddd3ae'; rectProjW(ctxW, projW, -CFG.half, -CFG.half, CFG.half, 612);
    for (const distW of DISTRICTS) { ctxW.fillStyle = distW.accent; ctxW.globalAlpha = optsW.washAlpha; rectProjW(ctxW, projW, distW.cx - 330, distW.cz - 330, distW.cx + 330, distW.cz + 330); ctxW.globalAlpha = 1; }
    ctxW.fillStyle = 'rgba(233,201,133,0.55)'; rectProjW(ctxW, projW, -CFG.half, 505, CFG.half, 600);
    ctxW.fillStyle = '#a9bd7a';
    const parksW = [[200, 380, 300, 470], [-520, -300, -430, -210]];
    for (const parkW of parksW) rectProjW(ctxW, projW, parkW[0], parkW[1], parkW[2], parkW[3]);
    blocksDrawW(ctxW, cvWW, cvHW, projW);
    const roadsXW = G.roadX, roadsZW = G.roadZ;
    const roadPxW = CFG.roadW * pxPerUnitW; ctxW.lineCap = 'butt';
    function strokeSetW(mainsOnlyW, colW, widthW) {
      ctxW.strokeStyle = colW; ctxW.lineWidth = widthW; ctxW.beginPath();
      for (const lineXW of roadsXW) { if (MAIN_X_W.has(lineXW) !== mainsOnlyW) continue; const [mxW] = projW(lineXW, 0); if (mxW < -widthW || mxW > cvWW + widthW) continue; const [, topYW] = projW(lineXW, -CFG.half); const [, botYW] = projW(lineXW, CFG.half); ctxW.moveTo(mxW, topYW); ctxW.lineTo(mxW, botYW); }
      for (const lineZW of roadsZW) { if (MAIN_Z_W.has(lineZW) !== mainsOnlyW) continue; const [, myW] = projW(0, lineZW); if (myW < -widthW || myW > cvHW + widthW) continue; const [leftXW] = projW(-CFG.half, lineZW); const [rightXW] = projW(CFG.half, lineZW); ctxW.moveTo(leftXW, myW); ctxW.lineTo(rightXW, myW); }
      ctxW.stroke(); }
    strokeSetW(false, '#b9b2a0', Math.max(1.5, roadPxW * 0.62));
    strokeSetW(false, '#e3ddcb', Math.max(1.2, roadPxW * 0.5));
    strokeSetW(true, '#8f8a7c', roadPxW + 2);
    strokeSetW(true, '#f4efe0', roadPxW);
    if (pauseModeW) {
      const [, shoreYW] = projW(0, 556);
      if (shoreYW > -6 && shoreYW < cvHW + 6) { ctxW.strokeStyle = '#d9b878'; ctxW.lineWidth = Math.max(2, 8 * pxPerUnitW); ctxW.beginPath(); const [shoreX0W] = projW(-CFG.half, 556); const [shoreX1W] = projW(CFG.half, 556); ctxW.moveTo(shoreX0W, shoreYW); ctxW.lineTo(shoreX1W, shoreYW); ctxW.stroke(); } }
    if (G.touge && G.touge.length > 1) {
      ctxW.lineJoin = 'round'; ctxW.lineCap = 'round';
      for (const passW of [0, 1]) { ctxW.strokeStyle = passW === 0 ? '#8f8a7c' : '#f4efe0'; ctxW.lineWidth = passW === 0 ? 5 : 3.5; ctxW.beginPath(); G.touge.forEach((ptW, idxW) => { const [mxW, myW] = projW(ptW.x, ptW.z); if (idxW === 0) ctxW.moveTo(mxW, myW); else ctxW.lineTo(mxW, myW); }); ctxW.closePath(); ctxW.stroke(); } }
    if (G.objective && optsW.routeFrom) {
      try {
        const routeW = roadRoute(G, optsW.routeFrom, G.objective) || [];
        if (routeW.length > 1) {
          ctxW.lineJoin = 'round'; ctxW.lineCap = 'round';
          for (const passW of [0, 1]) { ctxW.strokeStyle = passW === 0 ? 'rgba(255,255,255,0.9)' : '#ff2fd6'; ctxW.lineWidth = passW === 0 ? (pauseModeW ? 7 : 5) : (pauseModeW ? 4.5 : 3.2); ctxW.beginPath(); routeW.forEach((ptW, idxW) => { const [mxW, myW] = projW(ptW.x, ptW.z); if (idxW === 0) ctxW.moveTo(mxW, myW); else ctxW.lineTo(mxW, myW); }); ctxW.stroke(); } }
      } catch (errW) { /* route optional */ } }
    if (optsW.labels) {
      const labelsW = (G.landmarks && G.landmarks.districts) || DISTRICTS.map((distW) => ({ name: distW.name, x: distW.cx, z: distW.cz }));
      ctxW.textAlign = 'center'; ctxW.textBaseline = 'middle';
      for (const labelW of labelsW) {
        const [txtXW, txtYW] = projW(labelW.x, labelW.z);
        if (txtXW < -90 || txtYW < -20 || txtXW > cvWW + 90 || txtYW > cvHW + 20) continue;
        const tagW = labelW.name.toUpperCase();
        ctxW.font = '600 21px Arial, sans-serif';
        try { ctxW.letterSpacing = '3px'; } catch (errW) {}
        ctxW.shadowColor = 'rgba(255,255,255,0.9)'; ctxW.shadowBlur = 5; ctxW.lineWidth = 4; ctxW.strokeStyle = 'rgba(250,246,230,0.85)'; ctxW.strokeText(tagW, txtXW, txtYW);
        ctxW.shadowBlur = 0; ctxW.fillStyle = '#54452c'; ctxW.fillText(tagW, txtXW, txtYW);
        try { ctxW.letterSpacing = '0px'; } catch (errW) {} }
      mapLegendW(ctxW, cvWW, cvHW);
      ctxW.font = '11px Arial, sans-serif'; ctxW.textAlign = 'right'; ctxW.textBaseline = 'bottom'; ctxW.fillStyle = 'rgba(20,16,10,0.55)';
      ctxW.fillText(`${viewW.zoom.toFixed(1)}x — scroll to zoom · drag to pan`, cvWW - 12, cvHW - 10); } }
  function mapLegendW(ctxW, cvWW, cvHW) {
    const rowsW = []; rowsW.push(['#ffffff', '➤', 'You']); rowsW.push(['#ffd23f', '■', 'Objective / mission']); rowsW.push(['#2b2f36', 'G', 'Garage — RONIN KAI HQ']); rowsW.push(['#ff8c1a', 'M', 'RONIN MART supermarket']); rowsW.push(['#ffffff', '⌂', 'Safehouse (HQ)']); rowsW.push(['#2e6fb7', '●', 'RBPD police']); rowsW.push(['#ff2fd6', '━', 'GPS route']);
    const panelWW = 218, panelHW = 16 + rowsW.length * 19 + 8, panelXW = 12, panelYW = cvHW - panelHW - 12;
    ctxW.save();
    ctxW.fillStyle = 'rgba(8,10,16,0.72)'; ctxW.beginPath();
    if (ctxW.roundRect) ctxW.roundRect(panelXW, panelYW, panelWW, panelHW, 8); else ctxW.rect(panelXW, panelYW, panelWW, panelHW);
    ctxW.fill(); ctxW.strokeStyle = 'rgba(255,255,255,0.25)'; ctxW.lineWidth = 1; ctxW.stroke();
    ctxW.textAlign = 'left'; ctxW.textBaseline = 'middle'; ctxW.font = 'bold 11px Arial, sans-serif'; ctxW.fillStyle = '#ffd9ae'; ctxW.fillText('LEGEND', panelXW + 12, panelYW + 13);
    ctxW.font = '12px Arial, sans-serif';
    rowsW.forEach((rowW, idxW) => { const rowYW = panelYW + 16 + 10 + idxW * 19; ctxW.fillStyle = rowW[0]; ctxW.font = 'bold 12px Arial, sans-serif'; ctxW.fillText(rowW[1], panelXW + 12, rowYW); ctxW.font = '12px Arial, sans-serif'; ctxW.fillStyle = '#e8eef4'; ctxW.fillText(rowW[2], panelXW + 34, rowYW); });
    ctxW.restore(); }
  function chipDrawW(ctxW, pxW, pyW, sizeW, bgW, glyphW, fgW) {
    ctxW.fillStyle = bgW; const halfW = sizeW;
    ctxW.beginPath();
    if (ctxW.roundRect) ctxW.roundRect(pxW - halfW / 2, pyW - halfW / 2, halfW, halfW, 3); else ctxW.rect(pxW - halfW / 2, pyW - halfW / 2, halfW, halfW);
    ctxW.fill(); ctxW.fillStyle = fgW || '#14100a'; ctxW.font = `bold ${Math.round(halfW * 0.72)}px Arial, sans-serif`; ctxW.textAlign = 'center'; ctxW.textBaseline = 'middle'; ctxW.fillText(glyphW, pxW, pyW + 1); }
  function tagUnderW(ctxW, pxW, pyW, sizeW, txtW, dxW, optsW) {
    if (!optsW.tags) return;
    ctxW.font = 'bold 10px Arial, sans-serif'; ctxW.textAlign = 'center'; ctxW.textBaseline = 'top'; ctxW.lineWidth = 3; ctxW.strokeStyle = 'rgba(250,246,230,0.9)';
    ctxW.strokeText(txtW, pxW + (dxW || 0), pyW + sizeW / 2 + 2); ctxW.fillStyle = '#3a2f1c'; ctxW.fillText(txtW, pxW + (dxW || 0), pyW + sizeW / 2 + 2); }
  function blipsW(ctxW, projW, nowW, optsW) {
    const heroW = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    { const [hqXW, hqYW] = projW(G.hq.x, G.hq.z); chipDrawW(ctxW, hqXW, hqYW, optsW.chipSize, '#ffffff', '⌂'); tagUnderW(ctxW, hqXW, hqYW, optsW.chipSize, 'SAFEHOUSE', -16, optsW); }
    { const [garXW, garYW] = projW(G.hq.garage.x, G.hq.garage.z); chipDrawW(ctxW, garXW, garYW, optsW.chipSize, '#2b2f36', 'G', '#ffffff'); tagUnderW(ctxW, garXW, garYW, optsW.chipSize, 'RONIN KAI HQ', 18, optsW); }
    if (G.landmarks && G.landmarks.market) {
      const marketW = G.landmarks.market; const [mktXW, mktYW] = projW(marketW.x, marketW.z);
      if (optsW.tags) { chipDrawW(ctxW, mktXW, mktYW, optsW.chipSize, '#ff8c1a', 'M', '#ffffff'); tagUnderW(ctxW, mktXW, mktYW, optsW.chipSize, 'RONIN MART', undefined, optsW); }
      else if (mktXW > -14 && mktYW > -14 && mktXW < 234 && mktYW < 234) {
        ctxW.beginPath(); ctxW.arc(mktXW, mktYW, 6.5, 0, Math.PI * 2); ctxW.fillStyle = '#ff8c1a'; ctxW.fill();
        ctxW.lineWidth = 2; ctxW.strokeStyle = '#ffffff'; ctxW.stroke(); ctxW.fillStyle = '#ffffff'; ctxW.font = 'bold 9px Arial, sans-serif'; ctxW.textAlign = 'center'; ctxW.textBaseline = 'middle'; ctxW.fillText('M', mktXW, mktYW + 0.5); } }
    if (G.cops) {
      for (const copW of G.cops) {
        const [copXW, copYW] = projW(copW.x, copW.z);
        ctxW.beginPath(); ctxW.arc(copXW, copYW, 4, 0, Math.PI * 2); ctxW.fillStyle = '#2e6fb7'; ctxW.fill();
        const flashW = 0.35 + (0.65 * Math.abs(Math.sin(nowW * 5)));
        ctxW.beginPath(); ctxW.arc(copXW, copYW, 6.5, 0, Math.PI * 2); ctxW.strokeStyle = `rgba(255,60,60,${flashW.toFixed(2)})`; ctxW.lineWidth = 2; ctxW.stroke(); } }
    if (G.heli?.group) {
      const spotW = G.heli.group.position; const [heliXW, heliYW] = projW(spotW.x, spotW.z);
      ctxW.beginPath(); ctxW.arc(heliXW, heliYW, 5, 0, Math.PI * 2); ctxW.fillStyle = '#2e6fb7'; ctxW.fill();
      ctxW.fillStyle = '#ffffff'; ctxW.font = 'bold 8px Arial, sans-serif'; ctxW.textAlign = 'center'; ctxW.textBaseline = 'middle'; ctxW.fillText('H', heliXW, heliYW + 0.5); }
    if (G.objective) { const [objXW, objYW] = projW(G.objective.x, G.objective.z); chipDrawW(ctxW, objXW, objYW, optsW.chipSize + 2, '#ffd23f', G.objective.letter || '!'); }
    const [heroPxW, heroPyW] = projW(heroW.x, heroW.z); const headingW = G.car ? G.car.angle : G.player.angle;
    ctxW.save(); ctxW.translate(heroPxW, heroPyW);
    ctxW.rotate(Math.PI - headingW); ctxW.beginPath();
    const arrowW = optsW.arrowSize;
    ctxW.moveTo(0, -arrowW); ctxW.lineTo(arrowW * 0.62, arrowW * 0.75); ctxW.lineTo(0, arrowW * 0.35); ctxW.lineTo(-arrowW * 0.62, arrowW * 0.75); ctxW.closePath();
    ctxW.fillStyle = '#ffffff'; ctxW.fill(); ctxW.lineWidth = 2; ctxW.strokeStyle = '#14100a'; ctxW.stroke(); ctxW.restore(); }
  let cachedStaticW = null;
  function staticMiniW() {
    if (cachedStaticW) return cachedStaticW;
    const SIZE_W = 1320;
    const cvW = document.createElement('canvas'); cvW.width = SIZE_W; cvW.height = SIZE_W;
    const ctxW = cvW.getContext('2d'); const projW = (pxW, pzW) => [pxW + CFG.half, pzW + CFG.half];
    mapBaseW(ctxW, SIZE_W, SIZE_W, projW, CFG.world, { washAlpha: 0.07, labels: false, waves: false, routeFrom: null });
    cachedStaticW = cvW; return cvW; }
  const HUB_R_W = 13; const HUB_BG_W = 'rgba(10,12,16,0.55)'; const HUB_EDGE_W = 'rgba(255,255,255,0.85)'; const HUB_W_W = 2;
  function routeStrokeW(ctxW, projW, heroW) {
    try {
      const routeW = roadRoute(G, heroW, G.objective) || [];
      if (routeW.length > 1) {
        ctxW.lineJoin = 'round'; ctxW.lineCap = 'round';
        const passesW = [0, 1];
        for (const passW of passesW) { ctxW.strokeStyle = passW === 0 ? 'rgba(255,255,255,0.9)' : '#ff2fd6'; ctxW.lineWidth = passW === 0 ? 6.5 : 4.16; ctxW.beginPath(); routeW.forEach((ptW, idxW) => { const [mxW, myW] = projW(ptW.x, ptW.z); if (idxW === 0) ctxW.moveTo(mxW, myW); else ctxW.lineTo(mxW, myW); }); ctxW.stroke(); } }
    } catch (errW) { /* route optional */ } }
  function miniDrawW(nowW) {
    if (!mmCtxW || !E.minimap) return;
    const cvWW = E.minimap.width, cvHW = E.minimap.height;
    const heroW = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    const spanW = 340;
    const pxPerUnitW = cvWW / spanW; const projW = (pxW, pzW) => [cvWW / 2 + ((pxW - heroW.x) * pxPerUnitW), cvHW / 2 + ((pzW - heroW.z) * pxPerUnitW)];
    mmCtxW.save();
    mmCtxW.beginPath(); mmCtxW.arc(cvWW / 2, cvHW / 2, cvWW / 2, 0, Math.PI * 2); mmCtxW.clip();
    mmCtxW.fillStyle = '#3a7bd5'; mmCtxW.fillRect(0, 0, cvWW, cvHW);
    const imgW = staticMiniW();
    mmCtxW.imageSmoothingEnabled = true;
    mmCtxW.drawImage(imgW, heroW.x - spanW / 2 + CFG.half, heroW.z - spanW / 2 + CFG.half, spanW, spanW, 0, 0, cvWW, cvHW);
    if (G.objective) routeStrokeW(mmCtxW, projW, heroW);
    mmCtxW.beginPath(); mmCtxW.arc(cvWW / 2, cvHW / 2, HUB_R_W, 0, Math.PI * 2); mmCtxW.fillStyle = HUB_BG_W; mmCtxW.fill(); mmCtxW.lineWidth = HUB_W_W; mmCtxW.strokeStyle = HUB_EDGE_W; mmCtxW.stroke();
    blipsW(mmCtxW, projW, nowW, { chipSize: 13 * 1.3, arrowSize: 8 * 1.3 });
    mmCtxW.restore();
    mmCtxW.beginPath(); mmCtxW.arc(cvWW / 2, cvHW / 2, cvWW / 2 - 1.5, 0, Math.PI * 2); mmCtxW.lineWidth = 3; mmCtxW.strokeStyle = 'rgba(10,12,16,0.85)'; mmCtxW.stroke();
    mmCtxW.fillStyle = '#ffffff'; mmCtxW.font = 'bold 13px Arial, sans-serif'; mmCtxW.textAlign = 'center'; mmCtxW.textBaseline = 'top'; mmCtxW.shadowColor = 'rgba(0,0,0,0.8)'; mmCtxW.shadowBlur = 3; mmCtxW.fillText('N', cvWW / 2, 7); mmCtxW.shadowBlur = 0; }
  function bigMapW() {
    if (!bmCtxW || !E.bigmap) return;
    const cvWW = E.bigmap.width, cvHW = E.bigmap.height; const margW = 46;
    const scaleW = Math.min((cvWW - margW * 2) / CFG.world, (cvHW - margW * 2) / CFG.world) * viewW.zoom;
    const orgXW = cvWW / 2, orgYW = cvHW / 2; const projW = (pxW, pzW) => [orgXW + ((pxW - viewW.cx) * scaleW), orgYW + ((pzW - viewW.cz) * scaleW)];
    const heroW = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    bmCtxW.save(); bmCtxW.beginPath(); bmCtxW.rect(0, 0, cvWW, cvHW); bmCtxW.clip();
    mapBaseW(bmCtxW, cvWW, cvHW, projW, CFG.world / viewW.zoom, { washAlpha: 0.12, labels: true, waves: true, routeFrom: heroW });
    const nowW = performance.now() / 1000;
    blipsW(bmCtxW, projW, nowW, { chipSize: 20, arrowSize: 13, tags: true });
    bmCtxW.restore();
    bmCtxW.fillStyle = '#2c2114'; bmCtxW.font = 'bold 34px Arial, sans-serif'; bmCtxW.textAlign = 'left'; bmCtxW.textBaseline = 'top';
    try { bmCtxW.letterSpacing = '6px'; } catch (errW) {}
    bmCtxW.fillText('STREET SAMURAI', 22, 16);
    try { bmCtxW.letterSpacing = '0px'; } catch (errW) {} }
  let nosLevelW = 1;
  function speedoTicksW(maxKmhW, sweepStartW, sweepEndW, dialXW, dialYW, dialRW) {
    spCtxW.fillStyle = '#e8e8e8'; spCtxW.font = '9px Arial, sans-serif'; spCtxW.textAlign = 'center'; spCtxW.textBaseline = 'middle';
    let tickW = 0;
    while (!(tickW > maxKmhW)) {
      const tickAngW = sweepStartW + ((tickW / maxKmhW) * (sweepEndW - sweepStartW));
      const cosW = Math.cos(tickAngW); const sinW = Math.sin(tickAngW);
      const innerXW = dialXW + (cosW * (dialRW - 4)), innerYW = dialYW + (sinW * (dialRW - 4));
      const outerXW = dialXW + (cosW * dialRW), outerYW = dialYW + (sinW * dialRW);
      spCtxW.beginPath(); spCtxW.moveTo(innerXW, innerYW); spCtxW.lineTo(outerXW, outerYW); spCtxW.strokeStyle = tickW > 220 ? '#e33b3b' : '#cfcfcf'; spCtxW.lineWidth = 2; spCtxW.stroke();
      if (tickW % 40 === 0) { const labXW = dialXW + (cosW * (dialRW - 13)), labYW = dialYW + (sinW * (dialRW - 13)); spCtxW.fillText(String(tickW), labXW, labYW); }
      tickW += 20; } }
  function speedoDrawW(dtW) {
    if (!spCtxW || !E.speedo) return;
    const cvWW = E.speedo.width, cvHW = E.speedo.height;
    spCtxW.clearRect(0, 0, cvWW, cvHW);
    const dialXW = cvWW / 2, dialYW = 74, dialRW = 56; const maxKmhW = 280;
    const sweepStartW = Math.PI * 0.75, sweepEndW = Math.PI * 0.75 + Math.PI * 1.5;
    spCtxW.beginPath(); spCtxW.arc(dialXW, dialYW, dialRW + 8, 0, Math.PI * 2); spCtxW.fillStyle = 'rgba(10,12,18,0.72)'; spCtxW.fill();
    spCtxW.beginPath(); spCtxW.arc(dialXW, dialYW, dialRW, sweepStartW + (220 / maxKmhW) * (sweepEndW - sweepStartW), sweepEndW); spCtxW.strokeStyle = '#e33b3b'; spCtxW.lineWidth = 5; spCtxW.stroke();
    speedoTicksW(maxKmhW, sweepStartW, sweepEndW, dialXW, dialYW, dialRW);
    const kmhW = Math.min(maxKmhW, Math.abs(G.speedKmh || 0)); const needleW = sweepStartW + ((kmhW / maxKmhW) * (sweepEndW - sweepStartW));
    spCtxW.beginPath(); spCtxW.moveTo(dialXW - Math.cos(needleW) * 8, dialYW - Math.sin(needleW) * 8); spCtxW.lineTo(dialXW + Math.cos(needleW) * (dialRW - 8), dialYW + Math.sin(needleW) * (dialRW - 8)); spCtxW.strokeStyle = '#ff7a1a'; spCtxW.lineWidth = 3; spCtxW.stroke();
    spCtxW.beginPath(); spCtxW.arc(dialXW, dialYW, 4.5, 0, Math.PI * 2); spCtxW.fillStyle = '#f2f2f2'; spCtxW.fill();
    spCtxW.fillStyle = '#ffffff'; spCtxW.font = 'bold 19px Arial, sans-serif'; spCtxW.fillText(String(Math.round(kmhW)), dialXW, dialYW + 26);
    spCtxW.font = '8px Arial, sans-serif'; spCtxW.fillStyle = '#aab'; spCtxW.fillText('km/h', dialXW, dialYW + 38);
    if (G.flags.nosActive) nosLevelW = Math.max(0, nosLevelW - dtW * 0.45); else nosLevelW = Math.min(1, nosLevelW + dtW * 0.12);
    const nosWW = 74, nosXW = dialXW - nosWW / 2, nosYW = cvHW - 14;
    spCtxW.fillStyle = 'rgba(255,255,255,0.18)'; spCtxW.fillRect(nosXW, nosYW, nosWW, 6);
    spCtxW.fillStyle = '#37c8ff'; spCtxW.fillRect(nosXW, nosYW, nosWW * nosLevelW, 6);
    spCtxW.fillStyle = '#9adfff'; spCtxW.font = 'bold 8px Arial, sans-serif'; spCtxW.fillText('NOS', dialXW, nosYW - 6);
    if (G.flags.drifting) {
      spCtxW.beginPath(); spCtxW.arc(cvWW - 16, 14, 5, 0, Math.PI * 2); spCtxW.fillStyle = '#e879ff'; spCtxW.fill();
      spCtxW.fillStyle = '#e879ff'; spCtxW.font = 'bold 8px Arial, sans-serif'; spCtxW.fillText('DRIFT', cvWW - 16, 26); } }
  let garageShownW = false, garageTickW = 0;
  function garageDrawW() {
    if (!E.garagePanel) return;
    const rowsW = G.garageList || []; let htmlW = '<div class="garageTitle">HQ GARAGE — RONIN BAY</div>';
    const shownW = rowsW.slice(0, 9);
    shownW.forEach((rowW, idxW) => { const priceW = rowW.owned ? 'OWNED' : moneyTextW(rowW.price); const markW = rowW.current ? ' ▶' : ''; htmlW = htmlW + `<div class="garageRow${rowW.current ? ' current' : ''}"><span>${idxW + 1}. ${rowW.name}${markW}</span><span>${priceW}</span></div>`; });
    htmlW = htmlW + '<div class="garageFoot">1-9 select · E close</div>';
    E.garagePanel.innerHTML = htmlW; E.garagePanel.style.display = 'block'; }
  const memoW = {};
  function memoSetW(nodeW, keyW, valW) { if (!nodeW) return; if (memoW[keyW] !== valW) { memoW[keyW] = valW; nodeW.textContent = valW; } }
  let slowSecsW = 0;
  function flowTickW(dtW, nowSecsW) {
    const elapsedW = G.elapsed || 0;
    if (!flowW) {
      const heroW = G.car || G.player;
      if (heroW && (Math.abs(heroW.x) > 668 || Math.abs(heroW.z) > 668)) G.damagePlayer(22 * dtW);
      else if ((G.playerHealth ?? 100) < 100 && elapsedW - (G._lastDamageAt ?? -99) > 8) G.playerHealth = Math.min(100, (G.playerHealth ?? 100) + (0.8 * dtW));
    } else if (!flowW.staging) {
      flowW.t = flowW.t - dtW;
      const ovW = flowW.kind === 'wasted' ? wastedOvW : bustedOvW;
      if (ovW) { const growW = 1 - Math.max(0, flowW.t) / 2.8; ovW.title.style.transform = `scale(${(1 + growW * 0.16).toFixed(3)})`; }
      if (!(flowW.t > 0)) settleW(); }
    if (dispatchSecsW > 0 && E.dispatch) { dispatchSecsW = dispatchSecsW - dtW; if (!(dispatchSecsW > 0)) E.dispatch.style.display = 'none'; else if (dispatchSecsW < 1) E.dispatch.style.opacity = dispatchSecsW.toFixed(2); }
    if (E.bustWrap) {
      const meterW = Math.max(0, Math.min(1, G.bustMeter || 0));
      E.bustWrap.style.display = meterW > 0 ? 'block' : 'none';
      if (meterW > 0) { if (E.bustFill) E.bustFill.style.width = `${Math.round(meterW * 100)}%`; if (E.bustLabel) E.bustLabel.style.opacity = meterW > 0.7 ? (Math.sin(nowSecsW * 10) > 0 ? '1' : '0.25') : '1'; } } }
  function radioTickW() {
    if (!E.radioChip) return;
    let stationW = G.radioName || null;
    if (!stationW) {
      try { const curW = G.audio && G.audio.radio && G.audio.radio.current ? G.audio.radio.current() : null; if (curW) stationW = curW.name; } catch (errW) { /* chip stays hidden */ } }
    const stagedSeatW = !!(G.shotMode && G.car); const showChipW = !!((G.flags.inCar || stagedSeatW) && stationW);
    E.radioChip.style.display = showChipW ? 'block' : 'none';
    if (showChipW) memoSetW(E.radioChip, 'radio', `♪ ${stationW}`); }
  function cardTickW(nextDefW) {
    if (!E.card) return;
    const cardVisibleW = !!(nextDefW || G.missionProg);
    E.card.style.display = cardVisibleW ? 'block' : 'none';
    if (cardVisibleW && nextDefW) {
      const personW = CAST[nextDefW.giver];
      if (E.cardPortrait) {
        const wordsW = (personW?.name || '?').trim().split(/\s+/);
        const lettersW = []; for (const wordW of wordsW) lettersW.push(wordW[0]);
        E.cardPortrait.textContent = lettersW.join('').slice(0, 2).toUpperCase();
        E.cardPortrait.style.background = personW?.outfit?.topColor ? '#' + personW.outfit.topColor.toString(16).padStart(6, '0') : '#555'; }
      memoSetW(E.cardGiver, 'giver', personW?.name || nextDefW.giver || '');
      memoSetW(E.cardText, 'cardText', `${nextDefW.title} — ${nextDefW.blurb}`); }
    memoSetW(E.cardProg, 'prog', G.missionProg || 'Go to the blip'); }
  function crewStatusW(nextDefW) {
    const statusW = {}; statusW.driver = G.car && G.flags.inCar ? (G.car.spec?.name || G.car.specId || 'Driving') : 'On foot'; statusW.mechanic = !G.car || !G.flags.inCar ? '—' : ((G.car.health ?? 100) > 70 ? 'Ready' : (G.car.health ?? 100) >= 30 ? 'Damaged' : 'Wrecked'); statusW.lookout = (G.wanted || 0) > 0 ? 'RBPD ACTIVE' : (nextDefW ? `Next: ${nextDefW.title}` : 'Clear');
    const cardsW = document.querySelectorAll('.crewCard');
    for (const cardW of cardsW) { const statusNodeW = cardW.querySelector('.crewStatus'); if (statusNodeW && statusW[cardW.dataset.role] !== undefined) statusNodeW.textContent = statusW[cardW.dataset.role]; } }
  function copPanelTickW() {
    if (!(E.copPanel && E.copRows)) return;
    const panelVisibleW = (G.wanted || 0) >= 1;
    E.copPanel.style.display = panelVisibleW ? 'block' : 'none';
    if (!panelVisibleW) return;
    const heroW = G.car ? { x: G.car.x, z: G.car.z, angle: G.car.angle } : { x: G.player.x, z: G.player.z, angle: G.player.angle };
    const unitsW = [];
    for (const unitW of (G.cops || [])) unitsW.push({ name: unitW.specId === 'police-suv' ? 'RBPD Enforcer' : 'RBPD Interceptor', d: Math.hypot(unitW.x - heroW.x, unitW.z - heroW.z), v: unitW });
    if (G.heli?.group) { const spotW = G.heli.group.position; unitsW.push({ name: 'RBPD Air Unit', d: Math.hypot(spotW.x - heroW.x, spotW.z - heroW.z), heli: true }); }
    unitsW.sort((aW, bW) => aW.d - bW.d);
    const headW = `<div class="copHead">RBPD RESPONSE — ${unitsW.length} UNITS</div>`;
    const rowsTxtW = unitsW.slice(0, 4).map((unitW) => {
      let tacticW = 'PURSUIT';
      if (unitW.heli) tacticW = 'TRACKING';
      else if (unitW.v) {
        const dotW = Math.cos((unitW.v.angle || 0) - (heroW.angle || 0));
        const bearW = Math.atan2(heroW.x - unitW.v.x, heroW.z - unitW.v.z);
        const closingW = Math.abs(((bearW - (unitW.v.angle || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 2.4 && (unitW.v.speed || 0) > 12;
        if (unitW.d < 14 && closingW) tacticW = 'RAMMING';
        else if (dotW > 0.3 && unitW.d < 60) tacticW = 'INTERCEPT'; }
      return `<div class="copRow"><span>${unitW.name}</span><span>${Math.round(unitW.d)}m</span><span>${tacticW}</span></div>`; }).join('');
    E.copRows.innerHTML = headW + rowsTxtW; }
  G.updaters.push((frameW, dt) => {
    const nowSecsW = performance.now() / 1000;
    if (stagedW()) G.bustMeter = 0;
    memoSetW(E.money, 'money', moneyTextW(G.money));
    memoSetW(E.rep, 'rep', String(Math.round(G.rep || 0)));
    memoSetW(E.rank, 'rank', CLUB_RANKS[G.rankIdx || 0] || 'Rookie');
    if (E.stars) { const starW = Math.round(G.wanted || 0); E.stars.style.display = starW > 0 ? 'block' : 'none'; memoSetW(E.stars, 'stars', '★'.repeat(starW)); }
    if (E.healthBar) { const hpW = Math.max(0, Math.min(100, G.playerHealth ?? 100)); E.healthBar.style.width = `${hpW}%`; E.healthBar.style.backgroundColor = hpW < 30 ? '#e33b3b' : ''; }
    if (E.carBar) E.carBar.style.width = `${Math.max(0, Math.min(100, G.car ? (G.car.health ?? 100) : 100))}%`;
    if (E.objective) {
      const heroW = G.car ? G.car : G.player;
      if (G.objective) { const distW = Math.round(Math.hypot(G.objective.x - heroW.x, G.objective.z - heroW.z)); memoSetW(E.objective, 'obj', `${G.objective.label} — ${distW}m`); }
      else memoSetW(E.objective, 'obj', 'Free roam — find a letter blip'); }
    if (E.wasted) E.wasted.style.display = G.flags.wasted ? 'flex' : 'none';
    if (E.busted) E.busted.style.display = G.flags.busted ? 'flex' : 'none';
    flowTickW(dt, nowSecsW);
    radioTickW();
    miniDrawW(nowSecsW); speedoDrawW(dt);
    if (G.paused && E.pauseMenu && E.pauseMenu.style.display !== 'none') bigMapW();
    if (G.flags.garageOpen && !garageShownW) garageDrawW();
    if (!G.flags.garageOpen && garageShownW && E.garagePanel) E.garagePanel.style.display = 'none';
    garageShownW = !!G.flags.garageOpen;
    if (G.flags.garageOpen) { garageTickW = garageTickW - dt; if (!(garageTickW > 0)) { garageTickW = 0.5; garageDrawW(); } }
    slowSecsW = slowSecsW - dt;
    if (!(slowSecsW > 0)) {
      slowSecsW = 0.25;
      const nextDefW = (typeof G.missionIndex === 'number' && G.missionIndex < MISSIONS.length) ? MISSIONS[G.missionIndex] : null;
      cardTickW(nextDefW);
      crewStatusW(nextDefW);
      copPanelTickW(); }
  });
}
