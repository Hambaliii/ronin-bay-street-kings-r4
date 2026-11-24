import { CLUB_RANKS, CAST, DISTRICTS, CFG, MISSIONS } from './config.js'; import { roadRoute } from './world.js'; import { districtAt } from './police.js';
const elById = (idN) => { return document.getElementById (idN); };
const cashRound = (rawC) => { return Math.round (rawC || 0); };
const cashStr = (rawS) => { let partsS = []; partsS.push ('$'); partsS.push (cashRound (rawS).toLocaleString ('en-US')); return partsS.join (''); };
export const initHUD = (G) => { const elsH = { };
  function bindEl (idB) { elsH [idB] = elById (idB); }
  let bindIds = []; bindIds.push ('objective'); bindIds.push ('money'); bindIds.push ('rep'); bindIds.push ('rank'); bindIds.push ('stars'); bindIds.push ('healthBar'); bindIds.push ('carBar'); bindIds.push ('cardPortrait'); bindIds.push ('cardGiver'); bindIds.push ('cardText'); bindIds.push ('cardProg'); bindIds.push ('copPanel'); bindIds.push ('copRows'); bindIds.push ('briefing'); bindIds.push ('banner'); bindIds.push ('toast'); bindIds.push ('pauseMenu'); bindIds.push ('bigmap'); bindIds.push ('mapLegend'); bindIds.push ('minimap'); bindIds.push ('wasted'); bindIds.push ('busted'); bindIds.push ('garagePanel'); bindIds.push ('mapWrap'); bindIds.forEach (bindEl);
  elsH.card = elById ('missionCard');
  elsH.speedo = elById ('speedoCanvas');
  let radioNode = elById ('radioChip');
  if (! radioNode && 'undefined' !== typeof document && document.body) {
    radioNode = document.createElement ('div');
    radioNode.id = 'radioChip';
    radioNode.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;padding:5px 14px;border-radius:999px;background:rgba(10,12,18,0.72);border:1px solid rgba(255,122,26,0.65);color:#ffd9ae;font:bold 13px Arial,sans-serif;letter-spacing:1px;white-space:nowrap;';
    document.body.appendChild (radioNode); }
  elsH.radioChip = radioNode;
  if (G.playerHealth == null) G.playerHealth = 100; if (G.bustMeter == null) G.bustMeter = 0;
  if (G._lastDamageAt == null) { G._lastDamageAt = - 99; }
  let dispNode = elById ('dispatchLine');
  if (! dispNode && 'undefined' !== typeof document && document.body) {
    dispNode = document.createElement ('div');
    dispNode.id = 'dispatchLine';
    dispNode.style.cssText = 'position:fixed;top:172px;left:16px;z-index:30;pointer-events:none;display:none;max-width:430px;padding:4px 10px;background:rgba(8,10,14,0.66);border-left:3px solid #57b7ff;color:#cfe6ff;font:12px "Courier New",monospace;letter-spacing:0.4px;white-space:nowrap;overflow:hidden;';
    document.body.appendChild (dispNode); }
  elsH.dispatch = dispNode;
  let bustNode = elById ('bustWrap');
  if (! bustNode && 'undefined' !== typeof document && document.body) {
    bustNode = document.createElement ('div');
    bustNode.id = 'bustWrap';
    bustNode.style.cssText = 'position:fixed;top:64px;right:16px;z-index:30;pointer-events:none;display:none;width:190px;';
    bustNode.innerHTML = '<div id="bustLabel" style="color:#ffd23f;font:bold 13px Arial,sans-serif;letter-spacing:3px;text-align:right;text-shadow:0 1px 3px #000;">BUSTED</div>' + '<div style="height:7px;margin-top:3px;background:rgba(255,255,255,0.18);border:1px solid rgba(0,0,0,0.6);"><div id="bustFill" style="height:100%;width:0%;background:#57b7ff;"></div></div>';
    document.body.appendChild (bustNode); }
  elsH.bustWrap = bustNode;
  elsH.bustLabel = bustNode ? bustNode.querySelector ('#bustLabel') : null;
  elsH.bustFill = bustNode ? bustNode.querySelector ('#bustFill') : null;
  let dispLeft = 0;
  G.dispatch = function (spoken) { G.lastDispatch = spoken;
    if (! elsH.dispatch) return;
    elsH.dispatch.textContent = spoken;
    elsH.dispatch.style.display = 'block';
    elsH.dispatch.style.opacity = '1';
    dispLeft = 5; };
  const styleOverlayShell = (nodeO, bgQ) => {
    nodeO.innerHTML = '';
    nodeO.style.cssText = 'position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;flex-direction:column;background:' + bgQ + ';pointer-events:none;'; };
  const makeOverlayTitle = (nodeT, titleT, colQ) => {
    let elT; elT = document.createElement ('div');
    elT.className = 's26Title';
    elT.textContent = titleT;
    elT.style.cssText = 'color:' + colQ + ';font:bold 104px Arial,sans-serif;letter-spacing:22px;text-shadow:0 4px 22px rgba(0,0,0,0.85);';
    nodeT.appendChild (elT);
    return elT; };
  const makeOverlaySub = (nodeSu) => {
    let elSu; elSu = document.createElement ('div');
    elSu.className = 's26Sub';
    elSu.style.cssText = 'color:#e8e8e8;font:17px Arial,sans-serif;letter-spacing:2px;margin-top:16px;text-shadow:0 2px 8px #000;';
    nodeSu.appendChild (elSu);
    return elSu; };
  const overlayParts = (nodeP, titleP, bgP, colP) => {
    if (! nodeP) return null;
    styleOverlayShell (nodeP, bgP);
    let partsP = { }; partsP.title = makeOverlayTitle (nodeP, titleP, colP); partsP.sub = makeOverlaySub (nodeP); return partsP; };
  const wastedP = overlayParts (elsH.wasted, 'WASTED', 'radial-gradient(ellipse at center, rgba(74,4,4,0.55) 0%, rgba(16,0,0,0.94) 100%)', '#c9c9c9');
  const bustedP = overlayParts (elsH.busted, 'BUSTED', 'radial-gradient(ellipse at center, rgba(24,38,58,0.55) 0%, rgba(4,8,16,0.94) 100%)', '#dfe9f5');
  let endPend = null;
  function isStaging () { return ! ! (G.shot || G.shotMode); }
  const dropCarAt = (carD, pxD, pzD, healthD) => {
    if (! carD) return;
    carD.x = pxD;
    carD.z = pzD;
    if (carD.mesh) { carD.mesh.position.set (pxD, carD.mesh.position.y, pzD); carD.mesh.rotation.y = 0; }
    carD.speed = 0 + 0;
    carD.angle = 0;
    carD.health = healthD; };
  const dropFigureAt = (pxF, pzF) => {
    let figNode; figNode = G.player;
    if (! figNode) return;
    figNode.x = pxF;
    figNode.z = pzF;
    if (figNode.fig) { figNode.fig.visible = true; figNode.fig.position.set (pxF, figNode.fig.position.y, pzF); } };
  const finishEndFlow = (kindE) => {
    void kindE;
    G.wanted = 0; G.bustMeter = 0;
    G.playerHealth = 100; G.frozen = false;
    endPend = null;
    G.saveGame?.(); };
  const resolveWasted = (carW) => {
    G.money = Math.max (0, ((G.money || 0) - 150));
    let gxW; gxW = (G.hq && G.hq.garage && G.hq.garage.x) || - 412.5;
    let gzW; gzW = (G.hq && G.hq.garage && G.hq.garage.z) || 452;
    dropCarAt (carW, gxW, gzW, 60);
    dropFigureAt (330, - 330); G.timeOfDay = ((G.timeOfDay || 12) + 2) % 24;
    G.flags.wasted = false; G.toast?.('Wasted — hospital bill $150'); };
  const resolveBusted = (carB) => {
    G.money = Math.max (0, ((G.money || 0) - 200));
    dropCarAt (carB, - 408.5, 456, 50);
    dropFigureAt (- 412.5, 452); G.timeOfDay = ((G.timeOfDay || 12) + 1) % 24;
    G.flags.busted = false; G.toast?.('Busted — RBPD fine $200, ride impounded to HQ'); };
  const resolveEnd = () => { const kindR = endPend.kind;
    void (kindR === 'wasted');
    let carR; carR = endPend.car;
    if (G.car) try { G.exitCar?.(); } catch (err) { }
    let handlersR = { }; handlersR.wasted = resolveWasted; handlersR.busted = resolveBusted;
    handlersR [kindR] (carR);
    finishEndFlow (kindR); };
  G.hud = G.hud || { }; G.hud.showWasted = function (zoneQ) {
    if (G.flags.wasted) { return; }
    let srcW; srcW = G.car ? G.car : null;
    let hereXQ; if (srcW) { hereXQ = srcW.x; } else { hereXQ = (G.player?.x || 0); }
    let hereZQ; if (srcW) { hereZQ = srcW.z; } else { hereZQ = (G.player?.z || 0); }
    G.flags.wasted = true; if (wastedP) wastedP.sub.textContent = 'You were flatlined in ' + (zoneQ || districtAt (hereXQ, hereZQ)) + '';
    let pendW = { }; pendW.kind = 'wasted'; pendW.t = 2.8; pendW.car = G.car || null; pendW.staging = isStaging (); endPend = pendW;
    if (! endPend.staging) G.frozen = true; };
  G.hud.showBusted = function () { if (G.flags.busted) return;
    G.flags.busted = true; if (bustedP) bustedP.sub.textContent = 'RBPD impounded your ride';
    let pendB = { }; pendB.kind = 'busted'; pendB.t = 2.8; pendB.car = G.car || null; pendB.staging = isStaging (); endPend = pendB;
    if (! endPend.staging) G.frozen = true; };
  G.damagePlayer = function (hitD) {
    if (! (hitD > 0) || isStaging () || endPend || G.flags.wasted || G.flags.busted) return;
    G.playerHealth = Math.max (0, (G.playerHealth ?? 100) - hitD); G._lastDamageAt = G.elapsed || 0;
    if (! (G.playerHealth > 0)) G.hud.showWasted (); };
  const miniCx = elsH.minimap ? elsH.minimap.getContext ('2d') : null;
  const bigCx = elsH.bigmap ? elsH.bigmap.getContext ('2d') : null;
  const dialCx = elsH.speedo ? elsH.speedo.getContext ('2d') : null;
  if (G.flags.mapZoom && elsH.mapWrap) {
    elsH.mapWrap.style.transform = 'scale(1.45)';
    elsH.mapWrap.style.transformOrigin = 'top left'; }
  if (elsH.bigmap) {
    elsH.bigmap.style.maxWidth = '94vw';
    elsH.bigmap.style.width = 'auto';
    elsH.bigmap.style.height = 'min(578px, calc(100vh - 150px))'; }
  const crewMap = { driver : { initials : 'RT', name : 'Ren Takagi', role : 'DRIVER', color : '#ff7a1a' }, mechanic : { initials : 'AS', name : 'Ako Sato', role : 'MECHANIC', color : '#3f6d8e' }, lookout : { initials : 'MC', name : 'Mika Chen', role : 'LOOKOUT', color : '#7a4fd0' } };
  let crewCards = document.querySelectorAll ('.crewCard');
  let iterCrew = crewCards [Symbol.iterator] (); let stepCrew = iterCrew.next ();
  while (! stepCrew.done) {
    const cardC = stepCrew.value; stepCrew = iterCrew.next ();
    const infoC = crewMap [cardC.dataset.role];
    if (! infoC) continue;
    const faceC = cardC.querySelector ('.crewFace');
    const nameC = cardC.querySelector ('.crewName');
    const roleC = cardC.querySelector ('.crewRole');
    if (faceC) { faceC.textContent = infoC.initials; faceC.style.background = infoC.color; }
    if (nameC) nameC.textContent = infoC.name;
    if (roleC) roleC.textContent = infoC.role; }
  let toastT = 0;
  let bannerT = 0;
  let briefT = 0;
  G.toast = function (msgT) {
    if (! elsH.toast) return;
    elsH.toast.textContent = msgT;
    elsH.toast.style.display = 'block';
    elsH.toast.style.opacity = '1';
    clearTimeout (toastT);
    toastT = setTimeout (() => { elsH.toast.style.display = 'none'; }, 3000); };
  G.banner = function (msgB) {
    if (! elsH.banner) return;
    elsH.banner.textContent = msgB;
    elsH.banner.style.display = 'block';
    clearTimeout (bannerT);
    bannerT = setTimeout (() => { elsH.banner.style.display = 'none'; }, 2500); };
  const personInitials = (personI, giverI) => {
    let labelI; labelI = personI?.name || giverI || '?';
    let lettersI; lettersI = [];
    let wordsI; wordsI = labelI.trim ().split (/\s+/);
    let iterWordI = wordsI [Symbol.iterator] (); let stepWordI = iterWordI.next ();
    while (! stepWordI.done) { const wordI = stepWordI.value; stepWordI = iterWordI.next (); lettersI.push (wordI [0]); }
    return lettersI.join ('').slice (0, 2).toUpperCase (); };
  const personChipColor = (personC) => {
    if (personC?.outfit?.topColor) return '#' + personC.outfit.topColor.toString (16).padStart (6, '0');
    return '#444'; };
  G.showBriefing = function (giverB, lineB) {
    if (! elsH.briefing) return;
    let personB; personB = CAST [giverB];
    let chipB; chipB = elsH.briefing.querySelector ('.giverChip');
    let nameB; nameB = elsH.briefing.querySelector ('.giver');
    let lineElB; lineElB = elsH.briefing.querySelector ('.line');
    if (chipB) { chipB.textContent = personInitials (personB, giverB); chipB.style.background = personChipColor (personB); }
    if (nameB) nameB.textContent = personB?.name || giverB || '';
    if (lineElB) lineElB.textContent = lineB || '';
    elsH.briefing.style.display = 'block';
    clearTimeout (briefT);
    briefT = setTimeout (() => { elsH.briefing.style.display = 'none'; }, 5000); };
  let viewQ = { }; viewQ.zoom = 1; viewQ.cx = 0; viewQ.cz = 0;
  function viewHome () { viewQ.zoom = 1; viewQ.cx = 0 + 0; viewQ.cz = 0 + 0; }
  G.togglePause = function () { if (! elsH.pauseMenu) return;
    if (G.paused) { viewHome (); elsH.pauseMenu.style.display = 'block'; bigMap (); fillLegend (); }
    else elsH.pauseMenu.style.display = 'none'; };
  const fillLegend = () => { if (! elsH.mapLegend || elsH.mapLegend.dataset.filled) return;
    elsH.mapLegend.dataset.filled = '1';
    let chipsL; chipsL = [];
    function pushL (htmlL) { chipsL.push (htmlL); }
    pushL ('<span class="lgChip"><b style="color:#fff">➤</b> You</span>');
    pushL ('<span class="lgChip"><b style="color:#ffd23f">■</b> Objective</span>');
    pushL ('<span class="lgChip"><b>G</b> Garage</span>');
    pushL ('<span class="lgChip"><b style="color:#ff8c1a">M</b> RONIN MART</span>');
    pushL ('<span class="lgChip"><b>⌂</b> HQ / Safehouse</span>');
    pushL ('<span class="lgChip"><b style="color:#57b7ff">●</b> RBPD</span>');
    pushL ('<span class="lgChip"><b style="color:#ff4fd8">━</b> Route</span>');
    pushL ('<span class="lgChip">Scroll zoom · drag pan</span>');
    elsH.mapLegend.innerHTML = chipsL.join (' '); };
  if (elsH.bigmap && ! elsH.bigmap.dataset.panzoom) {
    elsH.bigmap.dataset.panzoom = '1';
    let canvasZ; canvasZ = elsH.bigmap;
    canvasZ.style.cursor = 'grab';
    canvasZ.style.touchAction = 'none';
    const clampViewZ = () => {
      let halfSpanZ; halfSpanZ = CFG.world / (2 * viewQ.zoom);
      let limitZ; limitZ = Math.max (0, CFG.half - halfSpanZ);
      viewQ.cx = Math.max (- limitZ, Math.min (limitZ, viewQ.cx));
      viewQ.cz = Math.max (- limitZ, Math.min (limitZ, viewQ.cz)); };
    canvasZ.addEventListener ('wheel', (ev) => {
      if (! G.paused) { return; }
      ev.preventDefault (); const rectZ = canvasZ.getBoundingClientRect ();
      const curZX = (ev.clientX - rectZ.left) * (canvasZ.width / rectZ.width);
      const curZY = (ev.clientY - rectZ.top) * (canvasZ.height / rectZ.height);
      const margZ = 46;
      const scaleBef = Math.min ((canvasZ.width - margZ * 2) / CFG.world, (canvasZ.height - margZ * 2) / CFG.world) * viewQ.zoom;
      const worldZX = viewQ.cx + ((curZX - canvasZ.width / 2) / scaleBef);
      const worldZZ = viewQ.cz + ((curZY - canvasZ.height / 2) / scaleBef);
      let factorZ; if (ev.deltaY < 0) { factorZ = 1.18; } else { factorZ = 1 / 1.18; }
      viewQ.zoom = Math.max (1, Math.min (5, viewQ.zoom * factorZ));
      const scaleAft = Math.min ((canvasZ.width - margZ * 2) / CFG.world, (canvasZ.height - margZ * 2) / CFG.world) * viewQ.zoom;
      viewQ.cx = worldZX - ((curZX - canvasZ.width / 2) / scaleAft);
      viewQ.cz = worldZZ - ((curZY - canvasZ.height / 2) / scaleAft);
      clampViewZ (); bigMap (); }, { passive : false });
    let dragZ = null;
    canvasZ.addEventListener ('pointerdown', (ev) => {
      if (! (G.paused)) return;
      let dragNew = { }; dragNew.x = ev.clientX; dragNew.y = ev.clientY; dragZ = dragNew;
      canvasZ.style.cursor = 'grabbing';
      try { canvasZ.setPointerCapture (ev.pointerId); } catch (err) { } });
    canvasZ.addEventListener ('pointermove', (ev) => {
      if (! dragZ || ! G.paused) return;
      const rectMv = canvasZ.getBoundingClientRect ();
      const margMv = 46;
      const scaleNowZ = Math.min ((canvasZ.width - margMv * 2) / CFG.world, (canvasZ.height - margMv * 2) / CFG.world) * viewQ.zoom;
      viewQ.cx -= (ev.clientX - dragZ.x) * (canvasZ.width / rectMv.width) / scaleNowZ;
      viewQ.cz -= (ev.clientY - dragZ.y) * (canvasZ.height / rectMv.height) / scaleNowZ;
      let dragNext = { }; dragNext.x = ev.clientX; dragNext.y = ev.clientY; dragZ = dragNext;
      clampViewZ (); bigMap (); });
    function endDragZ () { dragZ = null; canvasZ.style.cursor = 'grab'; }
    canvasZ.addEventListener ('pointerup', endDragZ);
    canvasZ.addEventListener ('pointercancel', endDragZ); }
  const mainXSet = new Set (); mainXSet.add (0); mainXSet.add (330);
  const mainZSet = new Set (); mainZSet.add (0); mainZSet.add (495);
  const fillProjectedRect = (ctxR, projR, x0Q, z0Q, x1Q, z1K) => {
    const [sx0K, sy0K] = projR (x0Q, z0Q);
    const [sx1K, sy1K] = projR (x1Q, z1K);
    ctxR.fillRect (Math.min (sx0K, sx1K), Math.min (sy0K, sy1K), Math.abs (sx1K - sx0K), Math.abs (sy1K - sy0K)); };
  const paintWaves = (ctxWv, wWv, hWv) => {
    ctxWv.strokeStyle = 'rgba(255,255,255,0.10)';
    ctxWv.lineWidth = 1.5;
    let waveW = 0;
    while (waveW < 14) {
      const yW = (waveW / 14) * hWv + ((waveW * 37) % 23);
      ctxWv.beginPath ();
      let pxW = 0;
      while (! (pxW > wWv)) { ctxWv.lineTo (pxW, yW + Math.sin (pxW * 0.05 + waveW) * 2.5); pxW += 32; }
      ctxWv.stroke (); waveW++; } };
  const blockFill = (midXB, midZB) => {
    let greenSide; greenSide = (- 165 > midXB && - 165 > midZB);
    if (greenSide) return '#b3c184';
    return '#cfc096'; };
  const paintBlocks = (ctxBl, wBl, hBl, projBl) => {
    let halfRoadBl; halfRoadBl = CFG.roadW / 2;
    let iBl = 0;
    while (iBl < G.roadX.length - 1) {
      let jBl = 0;
      while (jBl < G.roadZ.length - 1) {
        const [axBl, ayBl] = projBl (G.roadX [iBl] + halfRoadBl, G.roadZ [jBl] + halfRoadBl);
        const [bxBl, byBl] = projBl (G.roadX [iBl + 1] - halfRoadBl, G.roadZ [jBl + 1] - halfRoadBl);
        const rxBl = Math.min (axBl, bxBl), ryBl = Math.min (ayBl, byBl);
        const rwBl = Math.abs (bxBl - axBl), rhBl = Math.abs (byBl - ayBl);
        if (! (rxBl + rwBl < 0 || ryBl + rhBl < 0 || rxBl > wBl || ryBl > hBl)) {
          ctxBl.fillStyle = blockFill ((G.roadX [iBl] + G.roadX [iBl + 1]) / 2, (G.roadZ [jBl] + G.roadZ [jBl + 1]) / 2);
          ctxBl.fillRect (rxBl, ryBl, rwBl, rhBl); }
        jBl++; }
      iBl++; } };
  const strokeRoadSet = (ctxRd, projRd, wRd, hRd, mainsRd, colRd, widthRd) => {
    ctxRd.strokeStyle = colRd;
    ctxRd.lineWidth = widthRd;
    ctxRd.beginPath ();
    let iterXRd = G.roadX [Symbol.iterator] (); let stepXRd = iterXRd.next ();
    while (! stepXRd.done) {
      const lxRd = stepXRd.value; stepXRd = iterXRd.next ();
      if (mainXSet.has (lxRd) !== mainsRd) continue;
      const [mxRd] = projRd (lxRd, 0);
      if (mxRd < - widthRd || mxRd > wRd + widthRd) continue;
      const [, topYRd] = projRd (lxRd, - CFG.half);
      const [, botYRd] = projRd (lxRd, CFG.half);
      ctxRd.moveTo (mxRd, topYRd);
      ctxRd.lineTo (mxRd, botYRd); }
    let iterZRd = G.roadZ [Symbol.iterator] (); let stepZRd = iterZRd.next ();
    while (! stepZRd.done) {
      const lzRd = stepZRd.value; stepZRd = iterZRd.next ();
      if (mainZSet.has (lzRd) !== mainsRd) continue;
      const [, myRd] = projRd (0, lzRd);
      if (myRd < - widthRd || myRd > hRd + widthRd) continue;
      const [leftXRd] = projRd (- CFG.half, lzRd);
      const [rightXRd] = projRd (CFG.half, lzRd);
      ctxRd.moveTo (leftXRd, myRd);
      ctxRd.lineTo (rightXRd, myRd); }
    ctxRd.stroke (); };
  const tracePath = (ctxTp, projTp, ptsTp) => {
    ptsTp.forEach ((ptTp, idxTp) => { const [mxTp, myTp] = projTp (ptTp.x, ptTp.z); if (idxTp === 0) ctxTp.moveTo (mxTp, myTp); else ctxTp.lineTo (mxTp, myTp); }); };
  const paintRoute = (ctxRt, projRt, fromRt, pauseRt) => {
    try {
      let routeRt; routeRt = roadRoute (G, fromRt, G.objective) || [];
      if (! (routeRt.length > 1)) return;
      ctxRt.lineJoin = 'round';
      ctxRt.lineCap = 'round';
      let passesRt = [0, 1];
      let iterRt = passesRt [Symbol.iterator] (); let stepRt = iterRt.next ();
      while (! stepRt.done) {
        const passRt = stepRt.value; stepRt = iterRt.next ();
        if (passRt === 0) { ctxRt.strokeStyle = 'rgba(255,255,255,0.9)'; } else { ctxRt.strokeStyle = '#ff2fd6'; }
        if (passRt === 0) { ctxRt.lineWidth = pauseRt ? 7 : 5; } else { ctxRt.lineWidth = pauseRt ? 4.5 : 3.2; }
        ctxRt.beginPath ();
        tracePath (ctxRt, projRt, routeRt);
        ctxRt.stroke (); }
    } catch (err) { } };
  const paintMapBase = (ctxMb, wMb, hMb, projMb, viewMb, optsMb) => {
    void viewMb;
    let unitPxMb; unitPxMb = Math.abs (projMb (1, 0) [0] - projMb (0, 0) [0]);
    let pauseMb; pauseMb = ! ! optsMb.labels;
    ctxMb.fillStyle = '#3a7bd5';
    ctxMb.fillRect (0, 0, wMb, hMb);
    if (optsMb.waves) paintWaves (ctxMb, wMb, hMb);
    ctxMb.fillStyle = '#eed9a4';
    fillProjectedRect (ctxMb, projMb, - CFG.half - 60, 600, CFG.half + 60, 668);
    ctxMb.fillStyle = '#ddd3ae';
    fillProjectedRect (ctxMb, projMb, - CFG.half, - CFG.half, CFG.half, 612);
    let iterDistMb = DISTRICTS [Symbol.iterator] (); let stepDistMb = iterDistMb.next ();
    while (! stepDistMb.done) {
      const distMb = stepDistMb.value; stepDistMb = iterDistMb.next ();
      ctxMb.fillStyle = distMb.accent;
      ctxMb.globalAlpha = optsMb.washAlpha;
      fillProjectedRect (ctxMb, projMb, distMb.cx - 330, distMb.cz - 330, distMb.cx + 330, distMb.cz + 330);
      ctxMb.globalAlpha = 1; }
    ctxMb.fillStyle = 'rgba(233,201,133,0.55)';
    fillProjectedRect (ctxMb, projMb, - CFG.half, 505, CFG.half, 600);
    ctxMb.fillStyle = '#a9bd7a';
    [[200, 380, 300, 470], [- 520, - 300, - 430, - 210]].forEach ((parkMb) => { fillProjectedRect (ctxMb, projMb, parkMb [0], parkMb [1], parkMb [2], parkMb [3]); });
    paintBlocks (ctxMb, wMb, hMb, projMb);
    let roadPxMb; roadPxMb = CFG.roadW * unitPxMb;
    ctxMb.lineCap = 'butt';
    strokeRoadSet (ctxMb, projMb, wMb, hMb, false, '#b9b2a0', Math.max (1.5, roadPxMb * 0.62));
    strokeRoadSet (ctxMb, projMb, wMb, hMb, false, '#e3ddcb', Math.max (1.2, roadPxMb * 0.5));
    strokeRoadSet (ctxMb, projMb, wMb, hMb, true, '#8f8a7c', roadPxMb + 2);
    strokeRoadSet (ctxMb, projMb, wMb, hMb, true, '#f4efe0', roadPxMb);
    if (pauseMb) {
      const [, shoreY] = projMb (0, 556);
      if (shoreY > - 6 && shoreY < hMb + 6) {
        ctxMb.strokeStyle = '#d9b878';
        ctxMb.lineWidth = Math.max (2, 8 * unitPxMb);
        ctxMb.beginPath ();
        const [sx0] = projMb (- CFG.half, 556);
        const [sx1] = projMb (CFG.half, 556);
        ctxMb.moveTo (sx0, shoreY);
        ctxMb.lineTo (sx1, shoreY);
        ctxMb.stroke (); } }
    if (G.touge && (G.touge.length > 1)) {
      ctxMb.lineJoin = 'round';
      ctxMb.lineCap = 'round';
      let passesMb = [0, 1];
      let iterMb = passesMb [Symbol.iterator] (); let stepMb = iterMb.next ();
      while (! stepMb.done) {
        const passMb = stepMb.value; stepMb = iterMb.next ();
        if (passMb === 0) { ctxMb.strokeStyle = '#8f8a7c'; } else { ctxMb.strokeStyle = '#f4efe0'; }
        if (passMb === 0) { ctxMb.lineWidth = 5; } else { ctxMb.lineWidth = 3.5; }
        ctxMb.beginPath ();
        tracePath (ctxMb, projMb, G.touge);
        ctxMb.closePath ();
        ctxMb.stroke (); } }
    if (G.objective && optsMb.routeFrom) paintRoute (ctxMb, projMb, optsMb.routeFrom, pauseMb);
    if (optsMb.labels) {
      const labelsMb = (G.landmarks && G.landmarks.districts) || DISTRICTS.map ((distLbl) => { let lblRec = { }; lblRec.name = distLbl.name; lblRec.x = distLbl.cx; lblRec.z = distLbl.cz; return lblRec; });
      ctxMb.textAlign = 'center';
      ctxMb.textBaseline = 'middle';
      let iterLblMb = labelsMb [Symbol.iterator] (); let stepLblMb = iterLblMb.next ();
      while (! stepLblMb.done) {
        const labelMb = stepLblMb.value; stepLblMb = iterLblMb.next ();
        const [txMb, tyMb] = projMb (labelMb.x, labelMb.z);
        if (txMb < - 90 || tyMb < - 20 || txMb > wMb + 90 || tyMb > hMb + 20) continue;
        const tagMb = labelMb.name.toUpperCase ();
        ctxMb.font = '600 21px Arial, sans-serif';
        try { ctxMb.letterSpacing = '3px'; } catch (err) { }
        ctxMb.shadowColor = 'rgba(255,255,255,0.9)';
        ctxMb.shadowBlur = 5;
        ctxMb.lineWidth = 4;
        ctxMb.strokeStyle = 'rgba(250,246,230,0.85)';
        ctxMb.strokeText (tagMb, txMb, tyMb);
        ctxMb.shadowBlur = 0;
        ctxMb.fillStyle = '#54452c';
        ctxMb.fillText (tagMb, txMb, tyMb);
        try { ctxMb.letterSpacing = '0px'; } catch (err) { } }
      drawMapLegend (ctxMb, wMb, hMb);
      ctxMb.font = '11px Arial, sans-serif';
      ctxMb.textAlign = 'right';
      ctxMb.textBaseline = 'bottom';
      ctxMb.fillStyle = 'rgba(20,16,10,0.55)';
      ctxMb.fillText ('' + viewQ.zoom.toFixed (1) + 'x — scroll to zoom · drag to pan', wMb - 12, hMb - 10); } };
  const drawMapLegend = (ctxLg, wLg, hLg) => {
    void wLg;
    let rowsLg; rowsLg = [];
    rowsLg.push (['#ffffff', '➤', 'You']);
    rowsLg.push (['#ffd23f', '■', 'Objective / mission']);
    rowsLg.push (['#2b2f36', 'G', 'Garage — RONIN KAI HQ']);
    rowsLg.push (['#ff8c1a', 'M', 'RONIN MART supermarket']);
    rowsLg.push (['#ffffff', '⌂', 'Safehouse (HQ)']);
    rowsLg.push (['#2e6fb7', '●', 'RBPD police']);
    rowsLg.push (['#ff2fd6', '━', 'GPS route']);
    let panelWLg; panelWLg = 218;
    let panelHLg; panelHLg = 16 + rowsLg.length * 19 + 8;
    let panelXLg; panelXLg = 12;
    let panelYLg; panelYLg = hLg - panelHLg - 12;
    ctxLg.save ();
    ctxLg.fillStyle = 'rgba(8,10,16,0.72)';
    ctxLg.beginPath ();
    if (ctxLg.roundRect) ctxLg.roundRect (panelXLg, panelYLg, panelWLg, panelHLg, 8);
    else ctxLg.rect (panelXLg, panelYLg, panelWLg, panelHLg);
    ctxLg.fill ();
    ctxLg.strokeStyle = 'rgba(255,255,255,0.25)';
    ctxLg.lineWidth = 1;
    ctxLg.stroke ();
    ctxLg.textAlign = 'left';
    ctxLg.textBaseline = 'middle';
    ctxLg.font = 'bold 11px Arial, sans-serif';
    ctxLg.fillStyle = '#ffd9ae';
    ctxLg.fillText ('LEGEND', panelXLg + 12, panelYLg + 13);
    ctxLg.font = '12px Arial, sans-serif';
    rowsLg.forEach ((rowQ, idxQ) => {
      const rowY = panelYLg + 16 + 10 + idxQ * 19; ctxLg.fillStyle = rowQ [0]; ctxLg.font = 'bold 12px Arial, sans-serif'; ctxLg.fillText (rowQ [1], panelXLg + 12, rowY); ctxLg.font = '12px Arial, sans-serif'; ctxLg.fillStyle = '#e8eef4'; ctxLg.fillText (rowQ [2], panelXLg + 34, rowY); });
    ctxLg.restore (); };
  const drawChip = (ctxCh, pxCh, pyCh, sizeQ, bgCh, glyphCh, fgCh) => {
    ctxCh.fillStyle = bgCh;
    let halfQ; halfQ = sizeQ; ctxCh.beginPath ();
    if (ctxCh.roundRect) ctxCh.roundRect (pxCh - halfQ / 2, pyCh - halfQ / 2, halfQ, halfQ, 3);
    else ctxCh.rect (pxCh - halfQ / 2, pyCh - halfQ / 2, halfQ, halfQ);
    ctxCh.fill ();
    ctxCh.fillStyle = fgCh || '#14100a';
    ctxCh.font = 'bold ' + Math.round (halfQ * 0.72) + 'px Arial, sans-serif';
    ctxCh.textAlign = 'center';
    ctxCh.textBaseline = 'middle';
    ctxCh.fillText (glyphCh, pxCh, pyCh + 1); };
  const drawTagUnder = (ctxTu, pxTu, pyTu, sizeQ, txtTu, dxTu, optsTu) => {
    if (! optsTu.tags) return;
    let baseXTu; baseXTu = pxTu + (dxTu || 0);
    let baseYTu; baseYTu = pyTu + sizeQ / 2 + 2;
    ctxTu.font = 'bold 10px Arial, sans-serif';
    ctxTu.textAlign = 'center';
    ctxTu.textBaseline = 'top';
    ctxTu.lineWidth = 3;
    ctxTu.strokeStyle = 'rgba(250,246,230,0.9)';
    ctxTu.strokeText (txtTu, baseXTu, baseYTu);
    ctxTu.fillStyle = '#3a2f1c';
    ctxTu.fillText (txtTu, baseXTu, baseYTu); };
  const paintMarketBlip = (ctxMk, projMk, optsMk) => {
    if (! (G.landmarks && G.landmarks.market)) { return; }
    let marketMk; marketMk = G.landmarks.market;
    const [mxMk, myMk] = projMk (marketMk.x, marketMk.z);
    if (optsMk.tags) {
      drawChip (ctxMk, mxMk, myMk, optsMk.chipSize, '#ff8c1a', 'M', '#ffffff');
      drawTagUnder (ctxMk, mxMk, myMk, optsMk.chipSize, 'RONIN MART', undefined, optsMk);
    } else if (mxMk > - 14 && myMk > - 14 && mxMk < 234 && myMk < 234) {
      ctxMk.beginPath ();
      ctxMk.arc (mxMk, myMk, 6.5, 0, Math.PI * 2);
      ctxMk.fillStyle = '#ff8c1a';
      ctxMk.fill ();
      ctxMk.lineWidth = 2;
      ctxMk.strokeStyle = '#ffffff';
      ctxMk.stroke ();
      ctxMk.fillStyle = '#ffffff';
      ctxMk.font = 'bold 9px Arial, sans-serif';
      ctxMk.textAlign = 'center';
      ctxMk.textBaseline = 'middle';
      ctxMk.fillText ('M', mxMk, myMk + 0.5); } };
  const paintCopBlips = (ctxCp, projCp, nowCp) => {
    if (! G.cops) { return; }
    let iterCp = G.cops [Symbol.iterator] (); let stepCp = iterCp.next ();
    while (! stepCp.done) {
      const copCp = stepCp.value; stepCp = iterCp.next ();
      const [cxCp, cyCp] = projCp (copCp.x, copCp.z);
      ctxCp.beginPath ();
      ctxCp.arc (cxCp, cyCp, 4, 0, Math.PI * 2);
      ctxCp.fillStyle = '#2e6fb7';
      ctxCp.fill ();
      let flashQ; flashQ = 0.35 + (0.65 * Math.abs (Math.sin (nowCp * 5)));
      ctxCp.beginPath ();
      ctxCp.arc (cxCp, cyCp, 6.5, 0, Math.PI * 2);
      ctxCp.strokeStyle = 'rgba(255,60,60,' + flashQ.toFixed (2) + ')';
      ctxCp.lineWidth = 2;
      ctxCp.stroke (); } };
  const paintBlips = (ctxBp, projBp, nowBp, optsBp) => {
    let heroBp = { }; if (G.car) { heroBp.x = G.car.x; heroBp.z = G.car.z; } else { heroBp.x = G.player.x; heroBp.z = G.player.z; }
    const [hqXBp, hqYBp] = projBp (G.hq.x, G.hq.z);
    drawChip (ctxBp, hqXBp, hqYBp, optsBp.chipSize, '#ffffff', '⌂');
    drawTagUnder (ctxBp, hqXBp, hqYBp, optsBp.chipSize, 'SAFEHOUSE', - 16, optsBp);
    const [garXBp, garYBp] = projBp (G.hq.garage.x, G.hq.garage.z);
    drawChip (ctxBp, garXBp, garYBp, optsBp.chipSize, '#2b2f36', 'G', '#ffffff');
    drawTagUnder (ctxBp, garXBp, garYBp, optsBp.chipSize, 'RONIN KAI HQ', 18, optsBp);
    paintMarketBlip (ctxBp, projBp, optsBp);
    paintCopBlips (ctxBp, projBp, nowBp);
    if (G.heli && G.heli.group) {
      const spotBp = G.heli.group.position;
      const [hxBp, hyBp] = projBp (spotBp.x, spotBp.z);
      ctxBp.beginPath ();
      ctxBp.arc (hxBp, hyBp, 5, 0, Math.PI * 2);
      ctxBp.fillStyle = '#2e6fb7';
      ctxBp.fill ();
      ctxBp.fillStyle = '#ffffff';
      ctxBp.font = 'bold 8px Arial, sans-serif';
      ctxBp.textAlign = 'center';
      ctxBp.textBaseline = 'middle';
      ctxBp.fillText ('H', hxBp, hyBp + 0.5); }
    if (G.objective) { const [oxBp, oyBp] = projBp (G.objective.x, G.objective.z);
      drawChip (ctxBp, oxBp, oyBp, optsBp.chipSize + 2, '#ffd23f', G.objective.letter || '!'); }
    const [pxBp, pyBp] = projBp (heroBp.x, heroBp.z);
    let headingBp; if (G.car) { headingBp = G.car.angle; } else { headingBp = G.player.angle; }
    ctxBp.save ();
    ctxBp.translate (pxBp, pyBp);
    ctxBp.rotate (((Math.PI - headingBp) + (Math.PI * 2)) % (Math.PI * 2));
    ctxBp.beginPath ();
    let arrowBp; arrowBp = optsBp.arrowSize;
    ctxBp.moveTo (0, - arrowBp);
    ctxBp.lineTo (arrowBp * 0.62, arrowBp * 0.75);
    ctxBp.lineTo (0, arrowBp * 0.35);
    ctxBp.lineTo (- arrowBp * 0.62, arrowBp * 0.75);
    ctxBp.closePath ();
    ctxBp.fillStyle = '#ffffff';
    ctxBp.fill ();
    ctxBp.lineWidth = 2;
    ctxBp.strokeStyle = '#14100a';
    ctxBp.stroke ();
    ctxBp.restore (); };
  let cachedMini = null;
  const staticMini = () => { if (cachedMini) return cachedMini;
    let sizeMini; sizeMini = 1320;
    let canvasMini; canvasMini = document.createElement ('canvas');
    canvasMini.width = sizeMini;
    canvasMini.height = sizeMini;
    let ctxMini; ctxMini = canvasMini.getContext ('2d');
    const projMini = (pxMn, pzMn) => [pxMn + CFG.half, pzMn + CFG.half];
    let optsMini = { }; optsMini.washAlpha = 0.07; optsMini.labels = false; optsMini.waves = false; optsMini.routeFrom = null;
    paintMapBase (ctxMini, sizeMini, sizeMini, projMini, CFG.world, optsMini);
    cachedMini = canvasMini;
    return canvasMini; };
  const hubRad = 13;
  const hubBack = 'rgba(10,12,16,0.55)';
  const hubLine = 'rgba(255,255,255,0.85)';
  const hubLineW = 2;
  const paintMiniRoute = (ctxMr, projMr, heroMr) => {
    try {
      let routeMr; routeMr = roadRoute (G, heroMr, G.objective) || [];
      if (! (routeMr.length > 1)) return;
      ctxMr.lineJoin = 'round';
      ctxMr.lineCap = 'round';
      let passesMr = [0, 1];
      let iterMr = passesMr [Symbol.iterator] (); let stepMr = iterMr.next ();
      while (! stepMr.done) {
        const passMr = stepMr.value; stepMr = iterMr.next ();
        if (passMr === 0) { ctxMr.strokeStyle = 'rgba(255,255,255,0.9)'; } else { ctxMr.strokeStyle = '#ff2fd6'; }
        if (passMr === 0) { ctxMr.lineWidth = 6.5; } else { ctxMr.lineWidth = 4.16; }
        ctxMr.beginPath ();
        tracePath (ctxMr, projMr, routeMr);
        ctxMr.stroke (); }
    } catch (err) { } };
  const drawMini = (nowMn) => {
    if (! miniCx || ! elsH.minimap) return;
    let wMn; wMn = elsH.minimap.width;
    let hMn; hMn = elsH.minimap.height;
    let heroMn = { }; if (G.car) { heroMn.x = G.car.x; heroMn.z = G.car.z; } else { heroMn.x = G.player.x; heroMn.z = G.player.z; }
    let spanMn; spanMn = 340;
    let unitPxMn; unitPxMn = wMn / spanMn;
    const projMn = (pxMnB, pzMnB) => [wMn / 2 + ((pxMnB - heroMn.x) * unitPxMn), hMn / 2 + ((pzMnB - heroMn.z) * unitPxMn)];
    miniCx.save ();
    miniCx.beginPath ();
    miniCx.arc (wMn / 2, hMn / 2, wMn / 2, 0, Math.PI * 2);
    miniCx.clip ();
    miniCx.fillStyle = '#3a7bd5';
    miniCx.fillRect (0, 0, wMn, hMn);
    let imgMn; imgMn = staticMini ();
    miniCx.imageSmoothingEnabled = true;
    miniCx.drawImage (imgMn, heroMn.x - spanMn / 2 + CFG.half, heroMn.z - spanMn / 2 + CFG.half, spanMn, spanMn, 0, 0, wMn, hMn);
    if (G.objective) paintMiniRoute (miniCx, projMn, heroMn);
    miniCx.beginPath ();
    miniCx.arc (wMn / 2, hMn / 2, hubRad, 0, Math.PI * 2);
    miniCx.fillStyle = hubBack;
    miniCx.fill ();
    miniCx.lineWidth = hubLineW;
    miniCx.strokeStyle = hubLine;
    miniCx.stroke ();
    let optsMn = { }; optsMn.chipSize = 13 * 1.3; optsMn.arrowSize = 8 * 1.3;
    paintBlips (miniCx, projMn, nowMn, optsMn);
    miniCx.restore ();
    miniCx.beginPath ();
    miniCx.arc (wMn / 2, hMn / 2, wMn / 2 - 1.5, 0, Math.PI * 2);
    miniCx.lineWidth = 3;
    miniCx.strokeStyle = 'rgba(10,12,16,0.85)';
    miniCx.stroke ();
    miniCx.fillStyle = '#ffffff';
    miniCx.font = 'bold 13px Arial, sans-serif';
    miniCx.textAlign = 'center';
    miniCx.textBaseline = 'top';
    miniCx.shadowColor = 'rgba(0,0,0,0.8)';
    miniCx.shadowBlur = 3;
    miniCx.fillText ('N', wMn / 2, 7);
    miniCx.shadowBlur = 0; };
  const bigMap = () => { if (! bigCx || ! elsH.bigmap) return;
    let wBm; wBm = elsH.bigmap.width;
    let hBm; hBm = elsH.bigmap.height;
    let margBm; margBm = 46;
    let scaleBm; scaleBm = Math.min ((wBm - margBm * 2) / CFG.world, (hBm - margBm * 2) / CFG.world) * viewQ.zoom;
    const projBm = (pxBm, pzBm) => [wBm / 2 + ((pxBm - viewQ.cx) * scaleBm), hBm / 2 + ((pzBm - viewQ.cz) * scaleBm)];
    let heroBm = { }; if (G.car) { heroBm.x = G.car.x; heroBm.z = G.car.z; } else { heroBm.x = G.player.x; heroBm.z = G.player.z; }
    bigCx.save ();
    bigCx.beginPath ();
    bigCx.rect (0, 0, wBm, hBm);
    bigCx.clip ();
    let optsBm = { }; optsBm.washAlpha = 0.12; optsBm.labels = true; optsBm.waves = true; optsBm.routeFrom = heroBm;
    paintMapBase (bigCx, wBm, hBm, projBm, CFG.world / viewQ.zoom, optsBm);
    let nowBm; nowBm = performance.now () / 1000;
    let optsBlipBm = { }; optsBlipBm.chipSize = 20; optsBlipBm.arrowSize = 13; optsBlipBm.tags = true;
    paintBlips (bigCx, projBm, nowBm, optsBlipBm);
    bigCx.restore ();
    bigCx.fillStyle = '#2c2114';
    bigCx.font = 'bold 34px Arial, sans-serif';
    bigCx.textAlign = 'left';
    bigCx.textBaseline = 'top';
    try { bigCx.letterSpacing = '6px'; } catch (err) { }
    bigCx.fillText ('STREET SAMURAI', 22, 16);
    try { bigCx.letterSpacing = '0px'; } catch (err) { } };
  let nosLvl = 1;
  const paintDialTicks = (maxKmT, sweepStartT, sweepEndT, cxT, cyT, rT) => {
    dialCx.fillStyle = '#e8e8e8';
    dialCx.font = '9px Arial, sans-serif';
    dialCx.textAlign = 'center';
    dialCx.textBaseline = 'middle';
    let tickT = 0;
    while (! (tickT > maxKmT)) {
      const angT = sweepStartT + ((tickT / maxKmT) * (sweepEndT - sweepStartT));
      const cosT = Math.cos (angT), sinT = Math.sin (angT);
      dialCx.beginPath ();
      dialCx.moveTo (cxT + (cosT * (rT - 4)), cyT + (sinT * (rT - 4)));
      dialCx.lineTo (cxT + (cosT * rT), cyT + (sinT * rT));
      dialCx.strokeStyle = tickT > 220 ? '#e33b3b' : '#cfcfcf';
      dialCx.lineWidth = 2;
      dialCx.stroke ();
      if (tickT % 40 === 0) dialCx.fillText (String (tickT), cxT + (cosT * (rT - 13)), cyT + (sinT * (rT - 13)));
      tickT += 20; } };
  const drawDial = (dtDl) => {
    if (! dialCx || ! elsH.speedo) return;
    let wDl; wDl = elsH.speedo.width;
    let hDl; hDl = elsH.speedo.height;
    dialCx.clearRect (0, 0, wDl, hDl);
    let cxDl; cxDl = wDl / 2;
    let cyDl; cyDl = 74;
    let rDl; rDl = 56;
    let maxKmDl; maxKmDl = 280;
    let sweepStartDl; sweepStartDl = Math.PI * 0.75;
    let sweepEndDl; sweepEndDl = Math.PI * 0.75 + Math.PI * 1.5;
    dialCx.beginPath ();
    dialCx.arc (cxDl, cyDl, rDl + 8, 0, Math.PI * 2);
    dialCx.fillStyle = 'rgba(10,12,18,0.72)';
    dialCx.fill ();
    dialCx.beginPath ();
    dialCx.arc (cxDl, cyDl, rDl, sweepStartDl + (220 / maxKmDl) * (sweepEndDl - sweepStartDl), sweepEndDl);
    dialCx.strokeStyle = '#e33b3b';
    dialCx.lineWidth = 5;
    dialCx.stroke ();
    paintDialTicks (maxKmDl, sweepStartDl, sweepEndDl, cxDl, cyDl, rDl);
    let kmhDl; kmhDl = Math.min (maxKmDl, Math.abs (G.speedKmh || 0));
    let needleDl; needleDl = sweepStartDl + ((kmhDl / maxKmDl) * (sweepEndDl - sweepStartDl));
    dialCx.beginPath ();
    dialCx.moveTo (cxDl - Math.cos (needleDl) * 8, cyDl - Math.sin (needleDl) * 8);
    dialCx.lineTo (cxDl + Math.cos (needleDl) * (rDl - 8), cyDl + Math.sin (needleDl) * (rDl - 8));
    dialCx.strokeStyle = '#ff7a1a';
    dialCx.lineWidth = 3;
    dialCx.stroke ();
    dialCx.beginPath ();
    dialCx.arc (cxDl, cyDl, 4.5, 0, Math.PI * 2);
    dialCx.fillStyle = '#f2f2f2';
    dialCx.fill ();
    dialCx.fillStyle = '#ffffff';
    dialCx.font = 'bold 19px Arial, sans-serif';
    dialCx.fillText (String (Math.round (kmhDl)), cxDl, cyDl + 26);
    dialCx.font = '8px Arial, sans-serif';
    dialCx.fillStyle = '#aab';
    dialCx.fillText ('km/h', cxDl, cyDl + 38);
    nosLvl = G.flags.nosActive ? Math.max (0, nosLvl - dtDl * 0.45) : Math.min (1, nosLvl + dtDl * 0.12);
    let nosWDl; nosWDl = 74;
    let nosXDl; nosXDl = cxDl - nosWDl / 2;
    let nosYDl; nosYDl = hDl - 14;
    dialCx.fillStyle = 'rgba(255,255,255,0.18)';
    dialCx.fillRect (nosXDl, nosYDl, nosWDl, 6);
    dialCx.fillStyle = '#37c8ff';
    dialCx.fillRect (nosXDl, nosYDl, nosWDl * nosLvl, 6);
    dialCx.fillStyle = '#9adfff';
    dialCx.font = 'bold 8px Arial, sans-serif';
    dialCx.fillText ('NOS', cxDl, nosYDl - 6);
    if (G.flags.drifting) { dialCx.beginPath ();
      dialCx.arc (wDl - 16, 14, 5, 0, Math.PI * 2);
      dialCx.fillStyle = '#e879ff';
      dialCx.fill ();
      dialCx.fillStyle = '#e879ff';
      dialCx.font = 'bold 8px Arial, sans-serif';
      dialCx.fillText ('DRIFT', wDl - 16, 26); } };
  let garageVis = false;
  let garageLeft = 0;
  const garageRowHtml = (rowQ, idxQ) => { let priceQ; if (rowQ.owned) { priceQ = 'OWNED'; } else { priceQ = cashStr (rowQ.price); }
    let markQ; if (rowQ.current) { markQ = ' ▶'; } else { markQ = ''; } let clsQ; if (rowQ.current) { clsQ = ' current'; } else { clsQ = ''; }
    return '<div class="garageRow' + clsQ + '"><span>' + (idxQ + 1) + '. ' + rowQ.name + '' + markQ + '</span><span>' + priceQ + '</span></div>'; };
  const drawGarage = () => { if (! elsH.garagePanel) return;
    let htmlG = '<div class="garageTitle">HQ GARAGE — RONIN BAY</div>';
    (G.garageList || []).slice (0, 9).forEach ((rowG, idxG) => { htmlG += garageRowHtml (rowG, idxG); });
    htmlG += '<div class="garageFoot">1-9 select · E close</div>';
    elsH.garagePanel.innerHTML = htmlG;
    elsH.garagePanel.style.display = 'block'; };
  const memoMap = { };
  const memoWrite = (nodeM, keyM, valM) => {
    if (! nodeM) return;
    if (memoMap [keyM] === valM) return;
    memoMap [keyM] = valM;
    nodeM.textContent = valM; };
  let slowTick = 0;
  const paintBustMeter = (nowPb) => {
    if (! elsH.bustWrap) return;
    let meterQ; meterQ = Math.min (1, Math.max (0, G.bustMeter || 0));
    if (meterQ > 0) { elsH.bustWrap.style.display = 'block'; } else { elsH.bustWrap.style.display = 'none'; }
    if (! (meterQ > 0)) { return; }
    if (elsH.bustFill) elsH.bustFill.style.width = '' + Math.round (meterQ * 100) + '%';
    if (elsH.bustLabel) {
      let blinkPb; if (Math.sin (nowPb * 10) > 0) { blinkPb = '1'; } else { blinkPb = '0.25'; }
      if (meterQ > 0.7) { elsH.bustLabel.style.opacity = blinkPb; } else { elsH.bustLabel.style.opacity = '1'; } } };
  const tickEndFlow = (dtEf, nowEf) => {
    if (! endPend) {
      let heroEf; heroEf = G.car || G.player;
      if (heroEf && (Math.abs (heroEf.x) > 668 || Math.abs (heroEf.z) > 668)) { G.damagePlayer (22 * dtEf); } else {
        let sinceEf; sinceEf = (G.elapsed || 0) - (G._lastDamageAt ?? - 99);
        if ((G.playerHealth ?? 100) < 100 && sinceEf > 8) G.playerHealth = Math.min (100, (G.playerHealth ?? 100) + (0.8 * dtEf)); }
    } else if (! endPend.staging) {
      endPend.t -= dtEf;
      let partsEf; if (endPend.kind === 'wasted') { partsEf = wastedP; } else { partsEf = bustedP; }
      if (partsEf) {
        let growQ; growQ = 1 - Math.max (0, endPend.t) / 2.8;
        partsEf.title.style.transform = 'scale(' + (1 + growQ * 0.16).toFixed (3) + ')'; }
      if (! (endPend.t > 0)) resolveEnd (); }
    if (dispLeft > 0 && elsH.dispatch) {
      dispLeft -= dtEf;
      if (! (dispLeft > 0)) elsH.dispatch.style.display = 'none';
      else if (dispLeft < 1) elsH.dispatch.style.opacity = dispLeft.toFixed (2); }
    paintBustMeter (nowEf); };
  const currentStationName = () => { try {
      let curSt; curSt = G.audio && G.audio.radio && G.audio.radio.current ? G.audio.radio.current () : null;
      return curSt ? curSt.name : null;
    } catch (err) { return null; } };
  const tickRadio = () => { if (! elsH.radioChip) return;
    let stationQ = G.radioName || null; if (! stationQ) stationQ = currentStationName ();
    let showChipR; showChipR = ! ! ((G.flags.inCar || ! ! (G.shotMode && G.car)) && stationQ);
    if (showChipR) { elsH.radioChip.style.display = 'block'; } else { elsH.radioChip.style.display = 'none'; }
    if (showChipR) memoWrite (elsH.radioChip, 'radio', '♪ ' + stationQ + ''); };
  const tickCard = (nextDefQ) => { if (! elsH.card) return;
    let visibleC; visibleC = ! ! (nextDefQ || G.missionProg);
    if (visibleC) { elsH.card.style.display = 'block'; } else { elsH.card.style.display = 'none'; }
    if (visibleC && nextDefQ) {
      let personCd; personCd = CAST [nextDefQ.giver];
      if (elsH.cardPortrait) {
        let wordsCd; wordsCd = (personCd?.name || '?').trim ().split (/\s+/);
        let lettersCd; lettersCd = [];
        let iterCd = wordsCd [Symbol.iterator] (); let stepCd = iterCd.next ();
        while (! stepCd.done) { const wordCd = stepCd.value; stepCd = iterCd.next (); lettersCd.push (wordCd [0]); }
        elsH.cardPortrait.textContent = lettersCd.join ('').slice (0, 2).toUpperCase ();
        if (personCd?.outfit?.topColor) { elsH.cardPortrait.style.background = '#' + personCd.outfit.topColor.toString (16).padStart (6, '0'); } else { elsH.cardPortrait.style.background = '#555'; } }
      memoWrite (elsH.cardGiver, 'giver', personCd?.name || nextDefQ.giver || '');
      memoWrite (elsH.cardText, 'cardText', '' + nextDefQ.title + ' — ' + nextDefQ.blurb + ''); }
    memoWrite (elsH.cardProg, 'prog', G.missionProg || 'Go to the blip'); };
  const crewStatusMap = (nextDefQ) => { let drivingC; drivingC = G.car && G.flags.inCar;
    let statusC = { driver : drivingC ? (G.car.spec?.name || G.car.specId || 'Driving') : 'On foot', mechanic : ! drivingC ? '—' : ((G.car.health ?? 100) > 70 ? 'Ready' : (G.car.health ?? 100) >= 30 ? 'Damaged' : 'Wrecked'), lookout : (G.wanted || 0) > 0 ? 'RBPD ACTIVE' : (nextDefQ ? 'Next: ' + nextDefQ.title + '' : 'Clear') };
    return statusC; };
  const tickCrew = (nextDefC) => {
    let statusTc; statusTc = crewStatusMap (nextDefC);
    let cardsTc = document.querySelectorAll ('.crewCard');
    let iterTc = cardsTc [Symbol.iterator] (); let stepTc = iterTc.next ();
    while (! stepTc.done) {
      const cardTc = stepTc.value; stepTc = iterTc.next ();
      const nodeTc = cardTc.querySelector ('.crewStatus');
      if (nodeTc && statusTc [cardTc.dataset.role] !== undefined) nodeTc.textContent = statusTc [cardTc.dataset.role]; } };
  const copUnitList = (heroCu) => {
    let unitsCu; unitsCu = [];
    let copsCu = (G.cops || []);
    let iterCu = copsCu [Symbol.iterator] (); let stepCu = iterCu.next ();
    while (! stepCu.done) {
      const unitCu = stepCu.value; stepCu = iterCu.next ();
      let recCu = { }; recCu.name = unitCu.specId === 'police-suv' ? 'RBPD Enforcer' : 'RBPD Interceptor'; recCu.d = Math.hypot (unitCu.x - heroCu.x, unitCu.z - heroCu.z); recCu.v = unitCu; unitsCu.push (recCu); }
    if (G.heli?.group != null) {
      let spotCu; spotCu = G.heli.group.position;
      let recHeliCu = { }; recHeliCu.name = 'RBPD Air Unit'; recHeliCu.d = Math.hypot (spotCu.x - heroCu.x, spotCu.z - heroCu.z); recHeliCu.heli = true; unitsCu.push (recHeliCu); }
    unitsCu.sort ((aCu, bCu) => aCu.d - bCu.d);
    return unitsCu; };
  const copTacticQ = (unitCt, heroCt) => {
    let tacticCt = 'PURSUIT';
    if (unitCt.heli) tacticCt = 'TRACKING';
    else if (unitCt.v) {
      let dotCt; dotCt = Math.cos ((unitCt.v.angle || 0) - (heroCt.angle || 0));
      let bearCt; bearCt = Math.atan2 (heroCt.x - unitCt.v.x, heroCt.z - unitCt.v.z);
      let relCt; relCt = ((bearCt - (unitCt.v.angle || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (unitCt.d < 14 && Math.abs (relCt) > 2.4 && (unitCt.v.speed || 0) > 12) tacticCt = 'RAMMING';
      else if (dotCt > 0.3 && unitCt.d < 60) tacticCt = 'INTERCEPT'; }
    return tacticCt; };
  const tickCopPanel = () => { if (! (elsH.copPanel && elsH.copRows)) return;
    let visibleCp; visibleCp = (G.wanted || 0) >= 1;
    if (visibleCp) { elsH.copPanel.style.display = 'block'; } else { elsH.copPanel.style.display = 'none'; }
    if (! visibleCp) return;
    let heroQ = { }; if (! G.car) { heroQ.x = G.player.x; heroQ.z = G.player.z; heroQ.angle = G.player.angle; } else { heroQ.x = G.car.x; heroQ.z = G.car.z; heroQ.angle = G.car.angle; }
    let unitsQ; unitsQ = copUnitList (heroQ); let headCp = '<div class="copHead">RBPD RESPONSE — ' + unitsQ.length + ' UNITS</div>';
    elsH.copRows.innerHTML = headCp + unitsQ.slice (0, 4).map ((unitQ) => '<div class="copRow"><span>' + unitQ.name + '</span><span>' + Math.round (unitQ.d) + 'm</span><span>' + copTacticQ (unitQ, heroQ) + '</span></div>').join (''); };
  if (G.flags.openPauseMap && elsH.pauseMenu) { viewHome (); elsH.pauseMenu.style.display = 'block'; bigMap (); fillLegend (); }
  G.updaters.push ((frameU, dtU) => {
    void frameU;
    let nowU; nowU = performance.now () / 1000;
    if (isStaging ()) G.bustMeter = 0;
    memoWrite (elsH.money, 'money', cashStr (G.money));
    memoWrite (elsH.rep, 'rep', String (Math.round (G.rep || 0)));
    memoWrite (elsH.rank, 'rank', CLUB_RANKS [G.rankIdx || 0] || 'Rookie');
    if (elsH.stars) {
      let starU; starU = Math.round (G.wanted || 0);
      if (starU > 0) { elsH.stars.style.display = 'block'; } else { elsH.stars.style.display = 'none'; }
      memoWrite (elsH.stars, 'stars', '★'.repeat (starU)); }
    if (elsH.healthBar) {
      let hpQ; hpQ = Math.max (0, Math.min (100, G.playerHealth ?? 100)); elsH.healthBar.style.width = '' + hpQ + '%';
      if (hpQ < 30) { elsH.healthBar.style.backgroundColor = '#e33b3b'; } else { elsH.healthBar.style.backgroundColor = ''; } }
    if (elsH.carBar) {
      let carHpQ; carHpQ = G.car ? (G.car.health ?? 100) : 100; elsH.carBar.style.width = '' + Math.max (0, Math.min (100, carHpQ)) + '%'; }
    if (elsH.objective) {
      let heroOb; heroOb = G.car ? G.car : G.player;
      if (G.objective) { let distQ; distQ = Math.round (Math.hypot (G.objective.x - heroOb.x, G.objective.z - heroOb.z));
        memoWrite (elsH.objective, 'obj', '' + G.objective.label + ' — ' + distQ + 'm');
      } else memoWrite (elsH.objective, 'obj', 'Free roam — find a letter blip'); }
    if (elsH.wasted) { if (G.flags.wasted) { elsH.wasted.style.display = 'flex'; } else { elsH.wasted.style.display = 'none'; } }
    if (elsH.busted) { if (G.flags.busted) { elsH.busted.style.display = 'flex'; } else { elsH.busted.style.display = 'none'; } }
    tickEndFlow (dtU, nowU); tickRadio ();
    drawMini (nowU);
    drawDial (dtU);
    if (G.paused && elsH.pauseMenu && elsH.pauseMenu.style.display !== 'none') bigMap ();
    if (G.flags.garageOpen && ! garageVis) drawGarage ();
    if (! G.flags.garageOpen && garageVis && elsH.garagePanel) elsH.garagePanel.style.display = 'none';
    garageVis = ! ! G.flags.garageOpen;
    if (G.flags.garageOpen) { garageLeft -= dtU;
      if (! (garageLeft > 0)) { garageLeft = 0.5; drawGarage (); } }
    slowTick -= dtU;
    if (! (slowTick > 0)) {
      slowTick = 0.25;
      let nextDefU; nextDefU = ('number' === typeof G.missionIndex && G.missionIndex < MISSIONS.length) ? MISSIONS [G.missionIndex] : null;
      tickCard (nextDefU);
      tickCrew (nextDefU);
      tickCopPanel (); } });
};
