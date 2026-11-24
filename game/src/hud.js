// Overlay layer for the screen: cash and rank readouts, heat
// stars, both maps, the speed dial, garage list, briefs, popups.
import { CLUB_RANKS, CAST, DISTRICTS, CFG, MISSIONS } from './config.js';
import { roadRoute } from './world.js';
import { districtAt } from './police.js';
function grabNodeQ(wantedIdQ) {
  const foundQ = document.getElementById(wantedIdQ);
  return foundQ;
}
function wholeCashQ(rawCashQ) {
  const safeCashQ = rawCashQ || 0;
  return Math.round(safeCashQ);
}
function cashLabelQ(rawCashQ) {
  const piecesQ = [];
  piecesQ.push('$');
  piecesQ.push(wholeCashQ(rawCashQ).toLocaleString('en-US'));
  const joinedQ = piecesQ.join('');
  return joinedQ;
}
export function initHUD(G) {
  const nodesQ = {};
  const bindSameQ = (idQ) => { nodesQ[idQ] = grabNodeQ(idQ); };
  bindSameQ('objective'); bindSameQ('money'); bindSameQ('rep');
  bindSameQ('rank'); bindSameQ('stars'); bindSameQ('healthBar');
  bindSameQ('carBar'); bindSameQ('cardPortrait');
  bindSameQ('cardGiver'); bindSameQ('cardText'); bindSameQ('cardProg');
  bindSameQ('copPanel'); bindSameQ('copRows'); bindSameQ('briefing');
  bindSameQ('banner'); bindSameQ('toast'); bindSameQ('pauseMenu');
  bindSameQ('bigmap'); bindSameQ('mapLegend'); bindSameQ('minimap');
  bindSameQ('wasted'); bindSameQ('busted');
  bindSameQ('garagePanel'); bindSameQ('mapWrap');
  nodesQ.card = grabNodeQ('missionCard');
  nodesQ.speedo = grabNodeQ('speedoCanvas');
  // No radio node ships in the markup, so build one lazily and
  // only reveal it while driving with a station playing.
  let radioNodeQ = grabNodeQ('radioChip');
  if (!radioNodeQ && typeof document !== 'undefined' && document.body) {
    radioNodeQ = document.createElement('div');
    radioNodeQ.id = 'radioChip';
    radioNodeQ.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;padding:5px 14px;border-radius:999px;background:rgba(10,12,18,0.72);border:1px solid rgba(255,122,26,0.65);color:#ffd9ae;font:bold 13px Arial,sans-serif;letter-spacing:1px;white-space:nowrap;';
    document.body.appendChild(radioNodeQ);
  }
  nodesQ.radioChip = radioNodeQ;
  if (G.playerHealth == null) G.playerHealth = 100;
  if (G.bustMeter == null) G.bustMeter = 0;
  if (G._lastDamageAt == null) G._lastDamageAt = -99;
  let dispatchNodeQ = grabNodeQ('dispatchLine');
  if (!dispatchNodeQ && typeof document !== 'undefined' && document.body) {
    dispatchNodeQ = document.createElement('div');
    dispatchNodeQ.id = 'dispatchLine';
    dispatchNodeQ.style.cssText = 'position:fixed;top:172px;left:16px;z-index:30;pointer-events:none;display:none;max-width:430px;padding:4px 10px;background:rgba(8,10,14,0.66);border-left:3px solid #57b7ff;color:#cfe6ff;font:12px "Courier New",monospace;letter-spacing:0.4px;white-space:nowrap;overflow:hidden;';
    document.body.appendChild(dispatchNodeQ);
  }
  nodesQ.dispatch = dispatchNodeQ;
  let bustBoxQ = grabNodeQ('bustWrap');
  if (!bustBoxQ && typeof document !== 'undefined' && document.body) {
    bustBoxQ = document.createElement('div');
    bustBoxQ.id = 'bustWrap';
    bustBoxQ.style.cssText = 'position:fixed;top:64px;right:16px;z-index:30;pointer-events:none;display:none;width:190px;';
    const headChunkQ = '<div id="bustLabel" style="color:#ffd23f;font:bold 13px Arial,sans-serif;letter-spacing:3px;text-align:right;text-shadow:0 1px 3px #000;">BUSTED</div>';
    const barChunkQ = '<div style="height:7px;margin-top:3px;background:rgba(255,255,255,0.18);border:1px solid rgba(0,0,0,0.6);"><div id="bustFill" style="height:100%;width:0%;background:#57b7ff;"></div></div>';
    bustBoxQ.innerHTML = headChunkQ + barChunkQ;
    document.body.appendChild(bustBoxQ);
  }
  nodesQ.bustWrap = bustBoxQ;
  nodesQ.bustFill = bustBoxQ ? bustBoxQ.querySelector('#bustFill') : null;
  nodesQ.bustLabel = bustBoxQ ? bustBoxQ.querySelector('#bustLabel') : null;
  let dispatchLeftQ = 0;
  G.dispatch = (spokenQ) => {
    G.lastDispatch = spokenQ;
    if (!nodesQ.dispatch) return;
    nodesQ.dispatch.textContent = spokenQ;
    nodesQ.dispatch.style.display = 'block';
    nodesQ.dispatch.style.opacity = '1';
    dispatchLeftQ = 5;
  };
  function styleOverlayShellQ(nodeQ, bgQ) {
    nodeQ.innerHTML = '';
    nodeQ.style.cssText = `position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;flex-direction:column;background:${bgQ};pointer-events:none;`;
  }
  function makeOverlayTitleQ(nodeQ, titleQ, colQ) {
    const titleNodeQ = document.createElement('div');
    titleNodeQ.className = 's26Title';
    titleNodeQ.textContent = titleQ;
    titleNodeQ.style.cssText = `color:${colQ};font:bold 104px Arial,sans-serif;letter-spacing:22px;text-shadow:0 4px 22px rgba(0,0,0,0.85);`;
    nodeQ.appendChild(titleNodeQ);
    return titleNodeQ;
  }
  function makeOverlaySubQ(nodeQ) {
    const subNodeQ = document.createElement('div');
    subNodeQ.className = 's26Sub';
    subNodeQ.style.cssText = 'color:#e8e8e8;font:17px Arial,sans-serif;letter-spacing:2px;margin-top:16px;text-shadow:0 2px 8px #000;';
    nodeQ.appendChild(subNodeQ);
    return subNodeQ;
  }
  function overlayPartsQ(nodeQ, titleQ, bgQ, colQ) {
    if (!nodeQ) return null;
    styleOverlayShellQ(nodeQ, bgQ);
    const builtQ = {};
    builtQ.title = makeOverlayTitleQ(nodeQ, titleQ, colQ);
    builtQ.sub = makeOverlaySubQ(nodeQ);
    return builtQ;
  }
  const wastedPartsQ = overlayPartsQ(nodesQ.wasted, 'WASTED', 'radial-gradient(ellipse at center, rgba(74,4,4,0.55) 0%, rgba(16,0,0,0.94) 100%)', '#c9c9c9');
  const bustedPartsQ = overlayPartsQ(nodesQ.busted, 'BUSTED', 'radial-gradient(ellipse at center, rgba(24,38,58,0.55) 0%, rgba(4,8,16,0.94) 100%)', '#dfe9f5');
  let pendingEndQ = null;
  const stagingActiveQ = () => !!(G.shot || G.shotMode);
  function dropCarAtQ(carQ, pxQ, pzQ, healthQ) {
    if (!carQ) return;
    carQ.x = pxQ;
    carQ.z = pzQ;
    if (carQ.mesh) {
      carQ.mesh.position.set(pxQ, carQ.mesh.position.y, pzQ);
      carQ.mesh.rotation.y = 0;
    }
    carQ.speed = 0 + 0;
    carQ.angle = 0;
    carQ.health = healthQ;
  }
  function dropFigureAtQ(pxQ, pzQ) {
    const figQ = G.player;
    if (!figQ) return;
    figQ.x = pxQ;
    figQ.z = pzQ;
    if (figQ.fig) {
      figQ.fig.visible = true;
      figQ.fig.position.set(pxQ, figQ.fig.position.y, pzQ);
    }
  }
  function finishEndFlowQ(kindQ) {
    void kindQ;
    G.wanted = 0;
    G.bustMeter = 0;
    G.playerHealth = 100;
    G.frozen = false;
    pendingEndQ = null;
    G.saveGame?.();
  }
  function resolveWastedQ(keptCarQ) {
    const afterFeeQ = (G.money || 0) + (-150);
    G.money = Math.max(0, afterFeeQ);
    const garageXQ = (G.hq && G.hq.garage && G.hq.garage.x) || -412.5;
    const garageZQ = (G.hq && G.hq.garage && G.hq.garage.z) || 452;
    dropCarAtQ(keptCarQ, garageXQ, garageZQ, 60);
    dropFigureAtQ(330, -330);
    G.timeOfDay = ((G.timeOfDay || 12) + 2) % 24;
    G.flags.wasted = false;
    G.toast?.('Wasted — hospital bill $150');
  }
  function resolveBustedQ(keptCarQ) {
    const afterFineQ = (G.money || 0) + (-200);
    G.money = Math.max(0, afterFineQ);
    dropCarAtQ(keptCarQ, -408.5, 456, 50);
    dropFigureAtQ(-412.5, 452);
    G.timeOfDay = ((G.timeOfDay || 12) + 1) % 24;
    G.flags.busted = false;
    G.toast?.('Busted — RBPD fine $200, ride impounded to HQ');
  }
  function resolveEndQ() {
    const kindQ = pendingEndQ.kind;
    const wastedCaseQ = kindQ === 'wasted';
    void wastedCaseQ;
    const keptCarQ = pendingEndQ.car;
    if (G.car) {
      try { G.exitCar?.(); } catch (ignoredQ) {}
    }
    const handlersQ = {};
    handlersQ.wasted = resolveWastedQ;
    handlersQ.busted = resolveBustedQ;
    handlersQ[kindQ](keptCarQ);
    finishEndFlowQ(kindQ);
  }
  G.hud = G.hud || {};
  G.hud.showWasted = (zoneQ) => {
    if (G.flags.wasted) return;
    const srcQ = G.car ? G.car : null;
    const hereXQ = srcQ ? srcQ.x : (G.player?.x || 0);
    const hereZQ = srcQ ? srcQ.z : (G.player?.z || 0);
    G.flags.wasted = true;
    if (wastedPartsQ) wastedPartsQ.sub.textContent = `You were flatlined in ${zoneQ || districtAt(hereXQ, hereZQ)}`;
    pendingEndQ = { kind: 'wasted', t: 2.8, car: G.car || null, staging: stagingActiveQ() };
    if (!pendingEndQ.staging) G.frozen = true;
  };
  G.hud.showBusted = () => {
    if (G.flags.busted) return;
    G.flags.busted = true;
    if (bustedPartsQ) bustedPartsQ.sub.textContent = 'RBPD impounded your ride';
    pendingEndQ = { kind: 'busted', t: 2.8, car: G.car || null, staging: stagingActiveQ() };
    if (!pendingEndQ.staging) G.frozen = true;
  };
  G.damagePlayer = (hitQ) => {
    const blockedQ = !(hitQ > 0) || stagingActiveQ() || pendingEndQ || G.flags.wasted || G.flags.busted;
    if (blockedQ) return;
    const nextHpQ = (G.playerHealth ?? 100) + (-hitQ);
    G.playerHealth = Math.max(0, nextHpQ);
    G._lastDamageAt = G.elapsed || 0;
    if (!(G.playerHealth > 0)) G.hud.showWasted();
  };
  const miniCtxQ = nodesQ.minimap ? nodesQ.minimap.getContext('2d') : null;
  const bigCtxQ = nodesQ.bigmap ? nodesQ.bigmap.getContext('2d') : null;
  const dialCtxQ = nodesQ.speedo ? nodesQ.speedo.getContext('2d') : null;
  if (G.flags.mapZoom && nodesQ.mapWrap) {
    // A 1.45 disc scale keeps clear of the health readout:
    // 150px from top:198px ends near 415.5px, while 1.9
    // stretched to 483px and collided with it.
    nodesQ.mapWrap.style.transform = 'scale(1.45)';
    nodesQ.mapWrap.style.transformOrigin = 'top left';
  }
  if (nodesQ.bigmap) {
    nodesQ.bigmap.style.height = 'min(578px, calc(100vh - 150px))';
    nodesQ.bigmap.style.width = 'auto';
    nodesQ.bigmap.style.maxWidth = '94vw';
  }
  const crewBookQ = {};
  crewBookQ.driver = { initials: 'RT', name: 'Ren Takagi', role: 'DRIVER', color: '#ff7a1a' };
  crewBookQ.mechanic = { initials: 'AS', name: 'Ako Sato', role: 'MECHANIC', color: '#3f6d8e' };
  crewBookQ.lookout = { initials: 'MC', name: 'Mika Chen', role: 'LOOKOUT', color: '#7a4fd0' };
  const crewCardsQ = document.querySelectorAll('.crewCard');
  for (const cardQ of crewCardsQ) {
    const infoQ = crewBookQ[cardQ.dataset.role];
    if (!infoQ) continue;
    const faceQ = cardQ.querySelector('.crewFace');
    const nameQ = cardQ.querySelector('.crewName');
    const roleQ = cardQ.querySelector('.crewRole');
    if (faceQ) {
      faceQ.textContent = infoQ.initials;
      faceQ.style.background = infoQ.color;
    }
    if (nameQ) nameQ.textContent = infoQ.name;
    if (roleQ) roleQ.textContent = infoQ.role;
  }
  let toastTimerQ = 0;
  let bannerTimerQ = 0;
  let briefTimerQ = 0;
  G.toast = (msgQ) => {
    if (!nodesQ.toast) return;
    nodesQ.toast.textContent = msgQ;
    nodesQ.toast.style.display = 'block';
    nodesQ.toast.style.opacity = '1';
    clearTimeout(toastTimerQ);
    toastTimerQ = setTimeout(() => { nodesQ.toast.style.display = 'none'; }, 3000);
  };
  G.banner = (msgQ) => {
    if (!nodesQ.banner) return;
    nodesQ.banner.textContent = msgQ;
    nodesQ.banner.style.display = 'block';
    clearTimeout(bannerTimerQ);
    bannerTimerQ = setTimeout(() => { nodesQ.banner.style.display = 'none'; }, 2500);
  };
  function personInitialsQ(personQ, giverQ) {
    const labelQ = personQ?.name || giverQ || '?';
    const wordsQ = labelQ.trim().split(/\s+/);
    const lettersQ = [];
    for (const wordQ of wordsQ) lettersQ.push(wordQ[0]);
    return lettersQ.join('').slice(0, 2).toUpperCase();
  }
  function personChipColorQ(personQ) {
    if (personQ?.outfit?.topColor) return '#' + personQ.outfit.topColor.toString(16).padStart(6, '0');
    return '#444';
  }
  G.showBriefing = (giverQ, lineQ) => {
    if (!nodesQ.briefing) return;
    const personQ = CAST[giverQ];
    const chipQ = nodesQ.briefing.querySelector('.giverChip');
    const nameNodeQ = nodesQ.briefing.querySelector('.giver');
    const lineNodeQ = nodesQ.briefing.querySelector('.line');
    if (chipQ) {
      chipQ.textContent = personInitialsQ(personQ, giverQ);
      chipQ.style.background = personChipColorQ(personQ);
    }
    if (nameNodeQ) nameNodeQ.textContent = personQ?.name || giverQ || '';
    if (lineNodeQ) lineNodeQ.textContent = lineQ || '';
    nodesQ.briefing.style.display = 'block';
    clearTimeout(briefTimerQ);
    briefTimerQ = setTimeout(() => { nodesQ.briefing.style.display = 'none'; }, 5000);
  };
  const viewQ = { zoom: 1, cx: 0, cz: 0 };
  function viewHomeQ() {
    viewQ.zoom = 1;
    viewQ.cx = 0 + 0;
    viewQ.cz = 0 + 0;
  }
  G.togglePause = () => {
    if (!nodesQ.pauseMenu) return;
    if (G.paused) {
      viewHomeQ();
      nodesQ.pauseMenu.style.display = 'block';
      bigMapQ();
      fillLegendQ();
    } else nodesQ.pauseMenu.style.display = 'none';
  };
  function fillLegendQ() {
    if (!nodesQ.mapLegend || nodesQ.mapLegend.dataset.filled) return;
    nodesQ.mapLegend.dataset.filled = '1';
    const chipsQ = [];
    const pushChipQ = (htmlQ) => chipsQ.push(htmlQ);
    pushChipQ('<span class="lgChip"><b style="color:#fff">➤</b> You</span>');
    pushChipQ('<span class="lgChip"><b style="color:#ffd23f">■</b> Objective</span>');
    pushChipQ('<span class="lgChip"><b>G</b> Garage</span>');
    pushChipQ('<span class="lgChip"><b style="color:#ff8c1a">M</b> RONIN MART</span>');
    pushChipQ('<span class="lgChip"><b>⌂</b> HQ / Safehouse</span>');
    pushChipQ('<span class="lgChip"><b style="color:#57b7ff">●</b> RBPD</span>');
    pushChipQ('<span class="lgChip"><b style="color:#ff4fd8">━</b> Route</span>');
    pushChipQ('<span class="lgChip">Scroll zoom · drag pan</span>');
    nodesQ.mapLegend.innerHTML = chipsQ.join(' ');
  }
  if (nodesQ.bigmap && !nodesQ.bigmap.dataset.panzoom) {
    nodesQ.bigmap.dataset.panzoom = '1';
    const canvasQ = nodesQ.bigmap;
    canvasQ.style.cursor = 'grab';
    canvasQ.style.touchAction = 'none';
    function clampViewQ() {
      const halfSpanQ = CFG.world / (2 * viewQ.zoom);
      const limitQ = Math.max(0, CFG.half + (-halfSpanQ));
      viewQ.cx = Math.max(-limitQ, Math.min(limitQ, viewQ.cx));
      viewQ.cz = Math.max(-limitQ, Math.min(limitQ, viewQ.cz));
    }
    canvasQ.addEventListener('wheel', (evQ) => {
      if (!G.paused) return;
      evQ.preventDefault();
      const rectQ = canvasQ.getBoundingClientRect();
      const curXQ = (evQ.clientX - rectQ.left) * (canvasQ.width / rectQ.width);
      const curYQ = (evQ.clientY - rectQ.top) * (canvasQ.height / rectQ.height);
      const margQ = 46;
      const scaleBeforeQ = Math.min((canvasQ.width - margQ * 2) / CFG.world, (canvasQ.height - margQ * 2) / CFG.world) * viewQ.zoom;
      const worldXQ = viewQ.cx + ((curXQ - canvasQ.width / 2) / scaleBeforeQ);
      const worldZQ = viewQ.cz + ((curYQ - canvasQ.height / 2) / scaleBeforeQ);
      const factorQ = evQ.deltaY < 0 ? 1.18 : 1 / 1.18;
      viewQ.zoom = Math.max(1, Math.min(5, viewQ.zoom * factorQ));
      const scaleAfterQ = Math.min((canvasQ.width - margQ * 2) / CFG.world, (canvasQ.height - margQ * 2) / CFG.world) * viewQ.zoom;
      viewQ.cx = worldXQ + (-((curXQ - canvasQ.width / 2) / scaleAfterQ));
      viewQ.cz = worldZQ + (-((curYQ - canvasQ.height / 2) / scaleAfterQ));
      clampViewQ();
      bigMapQ();
    }, { passive: false });
    let dragStateQ = null;
    canvasQ.addEventListener('pointerdown', (evQ) => {
      if (!G.paused) return;
      dragStateQ = { x: evQ.clientX, y: evQ.clientY };
      canvasQ.style.cursor = 'grabbing';
      try { canvasQ.setPointerCapture(evQ.pointerId); } catch (ignoredQ) {}
    });
    canvasQ.addEventListener('pointermove', (evQ) => {
      if (!dragStateQ || !G.paused) return;
      const rectQ = canvasQ.getBoundingClientRect();
      const margQ = 46;
      const scaleNowQ = Math.min((canvasQ.width - margQ * 2) / CFG.world, (canvasQ.height - margQ * 2) / CFG.world) * viewQ.zoom;
      const dxQ = (evQ.clientX - dragStateQ.x) * (canvasQ.width / rectQ.width) / scaleNowQ;
      const dyQ = (evQ.clientY - dragStateQ.y) * (canvasQ.height / rectQ.height) / scaleNowQ;
      viewQ.cx = viewQ.cx - dxQ;
      viewQ.cz = viewQ.cz - dyQ;
      dragStateQ = { x: evQ.clientX, y: evQ.clientY };
      clampViewQ();
      bigMapQ();
    });
    const endDragQ = () => {
      dragStateQ = null;
      canvasQ.style.cursor = 'grab';
    };
    canvasQ.addEventListener('pointerup', endDragQ);
    canvasQ.addEventListener('pointercancel', endDragQ);
  }
  if (G.flags.openPauseMap && nodesQ.pauseMenu) {
    viewHomeQ();
    nodesQ.pauseMenu.style.display = 'block';
    bigMapQ();
    fillLegendQ();
  }
  const mainXsQ = new Set([0, 330]);
  const mainZsQ = new Set([0, 495]);
  function fillProjectedRectQ(ctxQ, projQ, x0Q, z0Q, x1Q, z1Q) {
    const [sx0Q, sy0Q] = projQ(x0Q, z0Q);
    const [sx1Q, sy1Q] = projQ(x1Q, z1Q);
    ctxQ.fillRect(Math.min(sx0Q, sx1Q), Math.min(sy0Q, sy1Q), Math.abs(sx1Q - sx0Q), Math.abs(sy1Q - sy0Q));
  }
  function paintWavesQ(ctxQ, wQ, hQ) {
    ctxQ.strokeStyle = 'rgba(255,255,255,0.10)';
    ctxQ.lineWidth = 1.5;
    for (let waveQ = 0; 14 > waveQ; waveQ++) {
      const waveYQ = (waveQ / 14) * hQ + ((waveQ * 37) % 23);
      ctxQ.beginPath();
      for (let pxQ = 0; !(pxQ > wQ); pxQ += 32) ctxQ.lineTo(pxQ, waveYQ + Math.sin(pxQ * 0.05 + waveQ) * 2.5);
      ctxQ.stroke();
    }
  }
  function blockFillQ(midXQ, midZQ) {
    const farCornerQ = -165 > midXQ && -165 > midZQ;
    return farCornerQ ? '#b3c184' : '#cfc096';
  }
  function paintBlocksQ(ctxQ, wQ, hQ, projQ) {
    const roadsXQ = G.roadX;
    const roadsZQ = G.roadZ;
    const halfRoadQ = CFG.roadW / 2;
    for (let iQ = 0; iQ < roadsXQ.length - 1; iQ++) {
      for (let jQ = 0; jQ < roadsZQ.length - 1; jQ++) {
        const [axQ, ayQ] = projQ(roadsXQ[iQ] + halfRoadQ, roadsZQ[jQ] + halfRoadQ);
        const [bxQ, byQ] = projQ(roadsXQ[iQ + 1] - halfRoadQ, roadsZQ[jQ + 1] - halfRoadQ);
        const rectXQ = Math.min(axQ, bxQ);
        const rectYQ = Math.min(ayQ, byQ);
        const rectWQ = Math.abs(bxQ - axQ);
        const rectHQ = Math.abs(byQ - ayQ);
        const offscreenQ = rectXQ + rectWQ < 0 || rectYQ + rectHQ < 0 || rectXQ > wQ || rectYQ > hQ;
        if (offscreenQ) continue;
        const midXQ = (roadsXQ[iQ] + roadsXQ[iQ + 1]) / 2;
        const midZQ = (roadsZQ[jQ] + roadsZQ[jQ + 1]) / 2;
        ctxQ.fillStyle = blockFillQ(midXQ, midZQ);
        ctxQ.fillRect(rectXQ, rectYQ, rectWQ, rectHQ);
      }
    }
  }
  function strokeRoadSetQ(ctxQ, projQ, wQ, hQ, mainsOnlyQ, colQ, widthQ) {
    ctxQ.strokeStyle = colQ;
    ctxQ.lineWidth = widthQ;
    ctxQ.beginPath();
    for (const lineXQ of G.roadX) {
      if (mainXsQ.has(lineXQ) !== mainsOnlyQ) continue;
      const [mxQ] = projQ(lineXQ, 0);
      if (mxQ < -widthQ || mxQ > wQ + widthQ) continue;
      const [, topYQ] = projQ(lineXQ, -CFG.half);
      const [, botYQ] = projQ(lineXQ, CFG.half);
      ctxQ.moveTo(mxQ, topYQ);
      ctxQ.lineTo(mxQ, botYQ);
    }
    for (const lineZQ of G.roadZ) {
      if (mainZsQ.has(lineZQ) !== mainsOnlyQ) continue;
      const [, myQ] = projQ(0, lineZQ);
      if (myQ < -widthQ || myQ > hQ + widthQ) continue;
      const [leftXQ] = projQ(-CFG.half, lineZQ);
      const [rightXQ] = projQ(CFG.half, lineZQ);
      ctxQ.moveTo(leftXQ, myQ);
      ctxQ.lineTo(rightXQ, myQ);
    }
    ctxQ.stroke();
  }
  function tracePathQ(ctxQ, projQ, ptsQ) {
    ptsQ.forEach((ptQ, idxQ) => {
      const [mxQ, myQ] = projQ(ptQ.x, ptQ.z);
      if (idxQ === 0) ctxQ.moveTo(mxQ, myQ);
      else ctxQ.lineTo(mxQ, myQ);
    });
  }
  function paintRouteQ(ctxQ, projQ, fromQ, pauseModeQ) {
    try {
      const routeQ = roadRoute(G, fromQ, G.objective) || [];
      if (!(routeQ.length > 1)) return;
      ctxQ.lineJoin = 'round';
      ctxQ.lineCap = 'round';
      const passesQ = [0, 1];
      for (const passQ of passesQ) {
        ctxQ.strokeStyle = passQ === 0 ? 'rgba(255,255,255,0.9)' : '#ff2fd6';
        ctxQ.lineWidth = passQ === 0 ? (pauseModeQ ? 7 : 5) : (pauseModeQ ? 4.5 : 3.2);
        ctxQ.beginPath();
        tracePathQ(ctxQ, projQ, routeQ);
        ctxQ.stroke();
      }
    } catch (ignoredQ) { /* routing is best-effort */ }
  }
  function paintMapBaseQ(ctxQ, wQ, hQ, projQ, viewValQ, optsQ) {
    void viewValQ;
    const unitPxQ = Math.abs(projQ(1, 0)[0] - projQ(0, 0)[0]);
    const pauseModeQ = !!optsQ.labels;
    ctxQ.fillStyle = '#3a7bd5';
    ctxQ.fillRect(0, 0, wQ, hQ);
    if (optsQ.waves) paintWavesQ(ctxQ, wQ, hQ);
    ctxQ.fillStyle = '#eed9a4';
    fillProjectedRectQ(ctxQ, projQ, -CFG.half - 60, 600, CFG.half + 60, 668);
    ctxQ.fillStyle = '#ddd3ae';
    fillProjectedRectQ(ctxQ, projQ, -CFG.half, -CFG.half, CFG.half, 612);
    for (const distQ of DISTRICTS) {
      ctxQ.fillStyle = distQ.accent;
      ctxQ.globalAlpha = optsQ.washAlpha;
      fillProjectedRectQ(ctxQ, projQ, distQ.cx - 330, distQ.cz - 330, distQ.cx + 330, distQ.cz + 330);
      ctxQ.globalAlpha = 1;
    }
    ctxQ.fillStyle = 'rgba(233,201,133,0.55)';
    fillProjectedRectQ(ctxQ, projQ, -CFG.half, 505, CFG.half, 600);
    ctxQ.fillStyle = '#a9bd7a';
    const parksQ = [[200, 380, 300, 470], [-520, -300, -430, -210]];
    for (const parkQ of parksQ) fillProjectedRectQ(ctxQ, projQ, parkQ[0], parkQ[1], parkQ[2], parkQ[3]);
    paintBlocksQ(ctxQ, wQ, hQ, projQ);
    const roadPxQ = CFG.roadW * unitPxQ;
    ctxQ.lineCap = 'butt';
    strokeRoadSetQ(ctxQ, projQ, wQ, hQ, false, '#b9b2a0', Math.max(1.5, roadPxQ * 0.62));
    strokeRoadSetQ(ctxQ, projQ, wQ, hQ, false, '#e3ddcb', Math.max(1.2, roadPxQ * 0.5));
    strokeRoadSetQ(ctxQ, projQ, wQ, hQ, true, '#8f8a7c', roadPxQ + 2);
    strokeRoadSetQ(ctxQ, projQ, wQ, hQ, true, '#f4efe0', roadPxQ);
    if (pauseModeQ) {
      const [, shoreYQ] = projQ(0, 556);
      const shoreVisibleQ = shoreYQ > -6 && shoreYQ < hQ + 6;
      if (shoreVisibleQ) {
        ctxQ.strokeStyle = '#d9b878';
        ctxQ.lineWidth = Math.max(2, 8 * unitPxQ);
        ctxQ.beginPath();
        const [shoreX0Q] = projQ(-CFG.half, 556);
        const [shoreX1Q] = projQ(CFG.half, 556);
        ctxQ.moveTo(shoreX0Q, shoreYQ);
        ctxQ.lineTo(shoreX1Q, shoreYQ);
        ctxQ.stroke();
      }
    }
    if (G.touge && G.touge.length > 1) {
      ctxQ.lineJoin = 'round';
      ctxQ.lineCap = 'round';
      const tougePassesQ = [0, 1];
      for (const passQ of tougePassesQ) {
        ctxQ.strokeStyle = passQ === 0 ? '#8f8a7c' : '#f4efe0';
        ctxQ.lineWidth = passQ === 0 ? 5 : 3.5;
        ctxQ.beginPath();
        tracePathQ(ctxQ, projQ, G.touge);
        ctxQ.closePath();
        ctxQ.stroke();
      }
    }
    if (G.objective && optsQ.routeFrom) paintRouteQ(ctxQ, projQ, optsQ.routeFrom, pauseModeQ);
    if (optsQ.labels) {
      const fallbackLabelsQ = DISTRICTS.map((distQ) => ({ name: distQ.name, x: distQ.cx, z: distQ.cz }));
      const labelsQ = (G.landmarks && G.landmarks.districts) || fallbackLabelsQ;
      ctxQ.textAlign = 'center';
      ctxQ.textBaseline = 'middle';
      for (const labelQ of labelsQ) {
        const [txtXQ, txtYQ] = projQ(labelQ.x, labelQ.z);
        const offLabelQ = txtXQ < -90 || txtYQ < -20 || txtXQ > wQ + 90 || txtYQ > hQ + 20;
        if (offLabelQ) continue;
        const tagQ = labelQ.name.toUpperCase();
        ctxQ.font = '600 21px Arial, sans-serif';
        try { ctxQ.letterSpacing = '3px'; } catch (ignoredQ) {}
        ctxQ.shadowColor = 'rgba(255,255,255,0.9)';
        ctxQ.shadowBlur = 5;
        ctxQ.lineWidth = 4;
        ctxQ.strokeStyle = 'rgba(250,246,230,0.85)';
        ctxQ.strokeText(tagQ, txtXQ, txtYQ);
        ctxQ.shadowBlur = 0;
        ctxQ.fillStyle = '#54452c';
        ctxQ.fillText(tagQ, txtXQ, txtYQ);
        try { ctxQ.letterSpacing = '0px'; } catch (ignoredQ) {}
      }
      drawMapLegendQ(ctxQ, wQ, hQ);
      ctxQ.font = '11px Arial, sans-serif';
      ctxQ.textAlign = 'right';
      ctxQ.textBaseline = 'bottom';
      ctxQ.fillStyle = 'rgba(20,16,10,0.55)';
      ctxQ.fillText(`${viewQ.zoom.toFixed(1)}x — scroll to zoom · drag to pan`, wQ - 12, hQ - 10);
    }
  }
  function drawMapLegendQ(ctxQ, wQ, hQ) {
    void wQ;
    const rowsQ = [];
    rowsQ.push(['#ffffff', '➤', 'You']);
    rowsQ.push(['#ffd23f', '■', 'Objective / mission']);
    rowsQ.push(['#2b2f36', 'G', 'Garage — RONIN KAI HQ']);
    rowsQ.push(['#ff8c1a', 'M', 'RONIN MART supermarket']);
    rowsQ.push(['#ffffff', '⌂', 'Safehouse (HQ)']);
    rowsQ.push(['#2e6fb7', '●', 'RBPD police']);
    rowsQ.push(['#ff2fd6', '━', 'GPS route']);
    const panelWQ = 218;
    const panelHQ = 16 + rowsQ.length * 19 + 8;
    const panelXQ = 12;
    const panelYQ = hQ - panelHQ - 12;
    ctxQ.save();
    ctxQ.fillStyle = 'rgba(8,10,16,0.72)';
    ctxQ.beginPath();
    if (ctxQ.roundRect) ctxQ.roundRect(panelXQ, panelYQ, panelWQ, panelHQ, 8);
    else ctxQ.rect(panelXQ, panelYQ, panelWQ, panelHQ);
    ctxQ.fill();
    ctxQ.strokeStyle = 'rgba(255,255,255,0.25)';
    ctxQ.lineWidth = 1;
    ctxQ.stroke();
    ctxQ.textAlign = 'left';
    ctxQ.textBaseline = 'middle';
    ctxQ.font = 'bold 11px Arial, sans-serif';
    ctxQ.fillStyle = '#ffd9ae';
    ctxQ.fillText('LEGEND', panelXQ + 12, panelYQ + 13);
    ctxQ.font = '12px Arial, sans-serif';
    rowsQ.forEach((rowQ, idxQ) => {
      const rowYQ = panelYQ + 16 + 10 + idxQ * 19;
      ctxQ.fillStyle = rowQ[0];
      ctxQ.font = 'bold 12px Arial, sans-serif';
      ctxQ.fillText(rowQ[1], panelXQ + 12, rowYQ);
      ctxQ.font = '12px Arial, sans-serif';
      ctxQ.fillStyle = '#e8eef4';
      ctxQ.fillText(rowQ[2], panelXQ + 34, rowYQ);
    });
    ctxQ.restore();
  }
  function drawChipQ(ctxQ, pxQ, pyQ, sizeQ, bgQ, glyphQ, fgQ) {
    ctxQ.fillStyle = bgQ;
    const halfQ = sizeQ;
    ctxQ.beginPath();
    if (ctxQ.roundRect) ctxQ.roundRect(pxQ - halfQ / 2, pyQ - halfQ / 2, halfQ, halfQ, 3);
    else ctxQ.rect(pxQ - halfQ / 2, pyQ - halfQ / 2, halfQ, halfQ);
    ctxQ.fill();
    ctxQ.fillStyle = fgQ || '#14100a';
    ctxQ.font = `bold ${Math.round(halfQ * 0.72)}px Arial, sans-serif`;
    ctxQ.textAlign = 'center';
    ctxQ.textBaseline = 'middle';
    ctxQ.fillText(glyphQ, pxQ, pyQ + 1);
  }
  function drawTagUnderQ(ctxQ, pxQ, pyQ, sizeQ, txtQ, dxQ, optsQ) {
    if (!optsQ.tags) return;
    const baseXQ = pxQ + (dxQ || 0);
    const baseYQ = pyQ + sizeQ / 2 + 2;
    ctxQ.font = 'bold 10px Arial, sans-serif';
    ctxQ.textAlign = 'center';
    ctxQ.textBaseline = 'top';
    ctxQ.lineWidth = 3;
    ctxQ.strokeStyle = 'rgba(250,246,230,0.9)';
    ctxQ.strokeText(txtQ, baseXQ, baseYQ);
    ctxQ.fillStyle = '#3a2f1c';
    ctxQ.fillText(txtQ, baseXQ, baseYQ);
  }
  function paintMarketBlipQ(ctxQ, projQ, optsQ) {
    if (!(G.landmarks && G.landmarks.market)) return;
    const marketQ = G.landmarks.market;
    const [mktXQ, mktYQ] = projQ(marketQ.x, marketQ.z);
    if (optsQ.tags) {
      drawChipQ(ctxQ, mktXQ, mktYQ, optsQ.chipSize, '#ff8c1a', 'M', '#ffffff');
      drawTagUnderQ(ctxQ, mktXQ, mktYQ, optsQ.chipSize, 'RONIN MART', undefined, optsQ);
    } else if (mktXQ > -14 && mktYQ > -14 && mktXQ < 234 && mktYQ < 234) {
      ctxQ.beginPath();
      ctxQ.arc(mktXQ, mktYQ, 6.5, 0, Math.PI * 2);
      ctxQ.fillStyle = '#ff8c1a';
      ctxQ.fill();
      ctxQ.lineWidth = 2;
      ctxQ.strokeStyle = '#ffffff';
      ctxQ.stroke();
      ctxQ.fillStyle = '#ffffff';
      ctxQ.font = 'bold 9px Arial, sans-serif';
      ctxQ.textAlign = 'center';
      ctxQ.textBaseline = 'middle';
      ctxQ.fillText('M', mktXQ, mktYQ + 0.5);
    }
  }
  function paintCopBlipsQ(ctxQ, projQ, nowQ) {
    if (!G.cops) return;
    for (const copQ of G.cops) {
      const [copXQ, copYQ] = projQ(copQ.x, copQ.z);
      ctxQ.beginPath();
      ctxQ.arc(copXQ, copYQ, 4, 0, Math.PI * 2);
      ctxQ.fillStyle = '#2e6fb7';
      ctxQ.fill();
      const flashQ = 0.35 + (0.65 * Math.abs(Math.sin(nowQ * 5)));
      ctxQ.beginPath();
      ctxQ.arc(copXQ, copYQ, 6.5, 0, Math.PI * 2);
      ctxQ.strokeStyle = `rgba(255,60,60,${flashQ.toFixed(2)})`;
      ctxQ.lineWidth = 2;
      ctxQ.stroke();
    }
  }
  function paintBlipsQ(ctxQ, projQ, nowQ, optsQ) {
    const heroQ = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    const [hqXQ, hqYQ] = projQ(G.hq.x, G.hq.z);
    drawChipQ(ctxQ, hqXQ, hqYQ, optsQ.chipSize, '#ffffff', '⌂');
    drawTagUnderQ(ctxQ, hqXQ, hqYQ, optsQ.chipSize, 'SAFEHOUSE', -16, optsQ);
    const [garXQ, garYQ] = projQ(G.hq.garage.x, G.hq.garage.z);
    drawChipQ(ctxQ, garXQ, garYQ, optsQ.chipSize, '#2b2f36', 'G', '#ffffff');
    drawTagUnderQ(ctxQ, garXQ, garYQ, optsQ.chipSize, 'RONIN KAI HQ', 18, optsQ);
    paintMarketBlipQ(ctxQ, projQ, optsQ);
    paintCopBlipsQ(ctxQ, projQ, nowQ);
    if (G.heli?.group) {
      const spotQ = G.heli.group.position;
      const [heliXQ, heliYQ] = projQ(spotQ.x, spotQ.z);
      ctxQ.beginPath();
      ctxQ.arc(heliXQ, heliYQ, 5, 0, Math.PI * 2);
      ctxQ.fillStyle = '#2e6fb7';
      ctxQ.fill();
      ctxQ.fillStyle = '#ffffff';
      ctxQ.font = 'bold 8px Arial, sans-serif';
      ctxQ.textAlign = 'center';
      ctxQ.textBaseline = 'middle';
      ctxQ.fillText('H', heliXQ, heliYQ + 0.5);
    }
    if (G.objective) {
      const [objXQ, objYQ] = projQ(G.objective.x, G.objective.z);
      drawChipQ(ctxQ, objXQ, objYQ, optsQ.chipSize + 2, '#ffd23f', G.objective.letter || '!');
    }
    const [heroPxQ, heroPyQ] = projQ(heroQ.x, heroQ.z);
    const headingQ = G.car ? G.car.angle : G.player.angle;
    ctxQ.save();
    ctxQ.translate(heroPxQ, heroPyQ);
    ctxQ.rotate(((Math.PI - headingQ) + (Math.PI * 2)) % (Math.PI * 2));
    ctxQ.beginPath();
    const arrowQ = optsQ.arrowSize;
    ctxQ.moveTo(0, -arrowQ);
    ctxQ.lineTo(arrowQ * 0.62, arrowQ * 0.75);
    ctxQ.lineTo(0, arrowQ * 0.35);
    ctxQ.lineTo(-arrowQ * 0.62, arrowQ * 0.75);
    ctxQ.closePath();
    ctxQ.fillStyle = '#ffffff';
    ctxQ.fill();
    ctxQ.lineWidth = 2;
    ctxQ.strokeStyle = '#14100a';
    ctxQ.stroke();
    ctxQ.restore();
  }
  let cachedStaticQ = null;
  function staticMiniQ() {
    if (cachedStaticQ) return cachedStaticQ;
    const sizeQ = 1320;
    const canvasQ = document.createElement('canvas');
    canvasQ.width = sizeQ;
    canvasQ.height = sizeQ;
    const ctxQ = canvasQ.getContext('2d');
    const projQ = (pxQ, pzQ) => [pxQ + CFG.half, pzQ + CFG.half];
    paintMapBaseQ(ctxQ, sizeQ, sizeQ, projQ, CFG.world, { washAlpha: 0.07, labels: false, waves: false, routeFrom: null });
    cachedStaticQ = canvasQ;
    return canvasQ;
  }
  const hubRadiusQ = 13;
  const hubBgQ = 'rgba(10,12,16,0.55)';
  const hubEdgeQ = 'rgba(255,255,255,0.85)';
  const hubWidthQ = 2;
  function paintMiniRouteQ(ctxQ, projQ, heroQ) {
    try {
      const routeQ = roadRoute(G, heroQ, G.objective) || [];
      if (!(routeQ.length > 1)) return;
      ctxQ.lineJoin = 'round';
      ctxQ.lineCap = 'round';
      const passesQ = [0, 1];
      for (const passQ of passesQ) {
        ctxQ.strokeStyle = passQ === 0 ? 'rgba(255,255,255,0.9)' : '#ff2fd6';
        ctxQ.lineWidth = passQ === 0 ? 6.5 : 4.16;
        ctxQ.beginPath();
        tracePathQ(ctxQ, projQ, routeQ);
        ctxQ.stroke();
      }
    } catch (ignoredQ) { /* routing is best-effort */ }
  }
  function drawMiniQ(nowQ) {
    if (!miniCtxQ || !nodesQ.minimap) return;
    const wQ = nodesQ.minimap.width;
    const hQ = nodesQ.minimap.height;
    const heroQ = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    const spanQ = 340;
    const unitPxQ = wQ / spanQ;
    const projQ = (pxQ, pzQ) => [wQ / 2 + ((pxQ - heroQ.x) * unitPxQ), hQ / 2 + ((pzQ - heroQ.z) * unitPxQ)];
    miniCtxQ.save();
    miniCtxQ.beginPath();
    miniCtxQ.arc(wQ / 2, hQ / 2, wQ / 2, 0, Math.PI * 2);
    miniCtxQ.clip();
    miniCtxQ.fillStyle = '#3a7bd5';
    miniCtxQ.fillRect(0, 0, wQ, hQ);
    const imgQ = staticMiniQ();
    miniCtxQ.imageSmoothingEnabled = true;
    miniCtxQ.drawImage(imgQ, heroQ.x - spanQ / 2 + CFG.half, heroQ.z - spanQ / 2 + CFG.half, spanQ, spanQ, 0, 0, wQ, hQ);
    if (G.objective) paintMiniRouteQ(miniCtxQ, projQ, heroQ);
    miniCtxQ.beginPath();
    miniCtxQ.arc(wQ / 2, hQ / 2, hubRadiusQ, 0, Math.PI * 2);
    miniCtxQ.fillStyle = hubBgQ;
    miniCtxQ.fill();
    miniCtxQ.lineWidth = hubWidthQ;
    miniCtxQ.strokeStyle = hubEdgeQ;
    miniCtxQ.stroke();
    paintBlipsQ(miniCtxQ, projQ, nowQ, { chipSize: 13 * 1.3, arrowSize: 8 * 1.3 });
    miniCtxQ.restore();
    miniCtxQ.beginPath();
    miniCtxQ.arc(wQ / 2, hQ / 2, wQ / 2 - 1.5, 0, Math.PI * 2);
    miniCtxQ.lineWidth = 3;
    miniCtxQ.strokeStyle = 'rgba(10,12,16,0.85)';
    miniCtxQ.stroke();
    miniCtxQ.fillStyle = '#ffffff';
    miniCtxQ.font = 'bold 13px Arial, sans-serif';
    miniCtxQ.textAlign = 'center';
    miniCtxQ.textBaseline = 'top';
    miniCtxQ.shadowColor = 'rgba(0,0,0,0.8)';
    miniCtxQ.shadowBlur = 3;
    miniCtxQ.fillText('N', wQ / 2, 7);
    miniCtxQ.shadowBlur = 0;
  }
  function bigMapQ() {
    if (!bigCtxQ || !nodesQ.bigmap) return;
    const wQ = nodesQ.bigmap.width;
    const hQ = nodesQ.bigmap.height;
    const margQ = 46;
    const scaleQ = Math.min((wQ - margQ * 2) / CFG.world, (hQ - margQ * 2) / CFG.world) * viewQ.zoom;
    const projQ = (pxQ, pzQ) => [wQ / 2 + ((pxQ - viewQ.cx) * scaleQ), hQ / 2 + ((pzQ - viewQ.cz) * scaleQ)];
    const heroQ = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    bigCtxQ.save();
    bigCtxQ.beginPath();
    bigCtxQ.rect(0, 0, wQ, hQ);
    bigCtxQ.clip();
    paintMapBaseQ(bigCtxQ, wQ, hQ, projQ, CFG.world / viewQ.zoom, { washAlpha: 0.12, labels: true, waves: true, routeFrom: heroQ });
    const nowQ = performance.now() / 1000;
    paintBlipsQ(bigCtxQ, projQ, nowQ, { chipSize: 20, arrowSize: 13, tags: true });
    bigCtxQ.restore();
    bigCtxQ.fillStyle = '#2c2114';
    bigCtxQ.font = 'bold 34px Arial, sans-serif';
    bigCtxQ.textAlign = 'left';
    bigCtxQ.textBaseline = 'top';
    try { bigCtxQ.letterSpacing = '6px'; } catch (ignoredQ) {}
    bigCtxQ.fillText('STREET SAMURAI', 22, 16);
    try { bigCtxQ.letterSpacing = '0px'; } catch (ignoredQ) {}
  }
  let nosLevelQ = 1;
  function paintDialTicksQ(maxKmhQ, sweepStartQ, sweepEndQ, dialXQ, dialYQ, dialRQ) {
    dialCtxQ.fillStyle = '#e8e8e8';
    dialCtxQ.font = '9px Arial, sans-serif';
    dialCtxQ.textAlign = 'center';
    dialCtxQ.textBaseline = 'middle';
    for (let tickQ = 0; !(tickQ > maxKmhQ); tickQ += 20) {
      const tickAngQ = sweepStartQ + ((tickQ / maxKmhQ) * (sweepEndQ - sweepStartQ));
      const cosQ = Math.cos(tickAngQ);
      const sinQ = Math.sin(tickAngQ);
      const innerXQ = dialXQ + (cosQ * (dialRQ - 4));
      const innerYQ = dialYQ + (sinQ * (dialRQ - 4));
      const outerXQ = dialXQ + (cosQ * dialRQ);
      const outerYQ = dialYQ + (sinQ * dialRQ);
      dialCtxQ.beginPath();
      dialCtxQ.moveTo(innerXQ, innerYQ);
      dialCtxQ.lineTo(outerXQ, outerYQ);
      dialCtxQ.strokeStyle = tickQ > 220 ? '#e33b3b' : '#cfcfcf';
      dialCtxQ.lineWidth = 2;
      dialCtxQ.stroke();
      if (tickQ % 40 === 0) {
        const labXQ = dialXQ + (cosQ * (dialRQ - 13));
        const labYQ = dialYQ + (sinQ * (dialRQ - 13));
        dialCtxQ.fillText(String(tickQ), labXQ, labYQ);
      }
    }
  }
  function drawDialQ(dtQ) {
    if (!dialCtxQ || !nodesQ.speedo) return;
    const wQ = nodesQ.speedo.width;
    const hQ = nodesQ.speedo.height;
    dialCtxQ.clearRect(0, 0, wQ, hQ);
    const dialXQ = wQ / 2;
    const dialYQ = 74;
    const dialRQ = 56;
    const maxKmhQ = 280;
    const sweepStartQ = Math.PI * 0.75;
    const sweepEndQ = Math.PI * 0.75 + Math.PI * 1.5;
    dialCtxQ.beginPath();
    dialCtxQ.arc(dialXQ, dialYQ, dialRQ + 8, 0, Math.PI * 2);
    dialCtxQ.fillStyle = 'rgba(10,12,18,0.72)';
    dialCtxQ.fill();
    dialCtxQ.beginPath();
    dialCtxQ.arc(dialXQ, dialYQ, dialRQ, sweepStartQ + (220 / maxKmhQ) * (sweepEndQ - sweepStartQ), sweepEndQ);
    dialCtxQ.strokeStyle = '#e33b3b';
    dialCtxQ.lineWidth = 5;
    dialCtxQ.stroke();
    paintDialTicksQ(maxKmhQ, sweepStartQ, sweepEndQ, dialXQ, dialYQ, dialRQ);
    const kmhQ = Math.min(maxKmhQ, Math.abs(G.speedKmh || 0));
    const needleQ = sweepStartQ + ((kmhQ / maxKmhQ) * (sweepEndQ - sweepStartQ));
    dialCtxQ.beginPath();
    dialCtxQ.moveTo(dialXQ - Math.cos(needleQ) * 8, dialYQ - Math.sin(needleQ) * 8);
    dialCtxQ.lineTo(dialXQ + Math.cos(needleQ) * (dialRQ - 8), dialYQ + Math.sin(needleQ) * (dialRQ - 8));
    dialCtxQ.strokeStyle = '#ff7a1a';
    dialCtxQ.lineWidth = 3;
    dialCtxQ.stroke();
    dialCtxQ.beginPath();
    dialCtxQ.arc(dialXQ, dialYQ, 4.5, 0, Math.PI * 2);
    dialCtxQ.fillStyle = '#f2f2f2';
    dialCtxQ.fill();
    dialCtxQ.fillStyle = '#ffffff';
    dialCtxQ.font = 'bold 19px Arial, sans-serif';
    dialCtxQ.fillText(String(Math.round(kmhQ)), dialXQ, dialYQ + 26);
    dialCtxQ.font = '8px Arial, sans-serif';
    dialCtxQ.fillStyle = '#aab';
    dialCtxQ.fillText('km/h', dialXQ, dialYQ + 38);
    if (G.flags.nosActive) nosLevelQ = Math.max(0, nosLevelQ - dtQ * 0.45);
    else nosLevelQ = Math.min(1, nosLevelQ + dtQ * 0.12);
    const nosWQ = 74;
    const nosXQ = dialXQ - nosWQ / 2;
    const nosYQ = hQ - 14;
    dialCtxQ.fillStyle = 'rgba(255,255,255,0.18)';
    dialCtxQ.fillRect(nosXQ, nosYQ, nosWQ, 6);
    dialCtxQ.fillStyle = '#37c8ff';
    dialCtxQ.fillRect(nosXQ, nosYQ, nosWQ * nosLevelQ, 6);
    dialCtxQ.fillStyle = '#9adfff';
    dialCtxQ.font = 'bold 8px Arial, sans-serif';
    dialCtxQ.fillText('NOS', dialXQ, nosYQ - 6);
    if (G.flags.drifting) {
      dialCtxQ.beginPath();
      dialCtxQ.arc(wQ - 16, 14, 5, 0, Math.PI * 2);
      dialCtxQ.fillStyle = '#e879ff';
      dialCtxQ.fill();
      dialCtxQ.fillStyle = '#e879ff';
      dialCtxQ.font = 'bold 8px Arial, sans-serif';
      dialCtxQ.fillText('DRIFT', wQ - 16, 26);
    }
  }
  let garageShownQ = false;
  let garageTickLeftQ = 0;
  function garageRowHtmlQ(rowQ, idxQ) {
    const priceQ = rowQ.owned ? 'OWNED' : cashLabelQ(rowQ.price);
    const markQ = rowQ.current ? ' ▶' : '';
    const clsQ = rowQ.current ? ' current' : '';
    return `<div class="garageRow${clsQ}"><span>${idxQ + 1}. ${rowQ.name}${markQ}</span><span>${priceQ}</span></div>`;
  }
  function drawGarageQ() {
    if (!nodesQ.garagePanel) return;
    const rowsQ = G.garageList || [];
    let htmlQ = '<div class="garageTitle">HQ GARAGE — RONIN BAY</div>';
    const shownQ = rowsQ.slice(0, 9);
    shownQ.forEach((rowQ, idxQ) => { htmlQ = htmlQ + garageRowHtmlQ(rowQ, idxQ); });
    htmlQ = htmlQ + '<div class="garageFoot">1-9 select · E close</div>';
    nodesQ.garagePanel.innerHTML = htmlQ;
    nodesQ.garagePanel.style.display = 'block';
  }
  const memoBookQ = {};
  function memoWriteQ(nodeQ, keyQ, valQ) {
    if (!nodeQ) return;
    if (memoBookQ[keyQ] === valQ) return;
    memoBookQ[keyQ] = valQ;
    nodeQ.textContent = valQ;
  }
  let slowLeftQ = 0;
  function paintBustMeterQ(nowSecsQ) {
    if (!nodesQ.bustWrap) return;
    const meterQ = Math.max(0, Math.min(1, G.bustMeter || 0));
    nodesQ.bustWrap.style.display = meterQ > 0 ? 'block' : 'none';
    if (!(meterQ > 0)) return;
    if (nodesQ.bustFill) nodesQ.bustFill.style.width = `${Math.round(meterQ * 100)}%`;
    if (nodesQ.bustLabel) {
      const blinkQ = Math.sin(nowSecsQ * 10) > 0 ? '1' : '0.25';
      nodesQ.bustLabel.style.opacity = meterQ > 0.7 ? blinkQ : '1';
    }
  }
  function tickEndFlowQ(dtQ, nowSecsQ) {
    const elapsedQ = G.elapsed || 0;
    if (!pendingEndQ) {
      const heroQ = G.car || G.player;
      const outOfWorldQ = heroQ && (Math.abs(heroQ.x) > 668 || Math.abs(heroQ.z) > 668);
      if (outOfWorldQ) G.damagePlayer(22 * dtQ);
      else {
        const sinceHitQ = elapsedQ - (G._lastDamageAt ?? -99);
        if ((G.playerHealth ?? 100) < 100 && sinceHitQ > 8) G.playerHealth = Math.min(100, (G.playerHealth ?? 100) + (0.8 * dtQ));
      }
    } else if (!pendingEndQ.staging) {
      pendingEndQ.t = pendingEndQ.t - dtQ;
      const partsQ = pendingEndQ.kind === 'wasted' ? wastedPartsQ : bustedPartsQ;
      if (partsQ) {
        const growQ = 1 - Math.max(0, pendingEndQ.t) / 2.8;
        partsQ.title.style.transform = `scale(${(1 + growQ * 0.16).toFixed(3)})`;
      }
      if (!(pendingEndQ.t > 0)) resolveEndQ();
    }
    if (dispatchLeftQ > 0 && nodesQ.dispatch) {
      dispatchLeftQ = dispatchLeftQ - dtQ;
      if (!(dispatchLeftQ > 0)) nodesQ.dispatch.style.display = 'none';
      else if (dispatchLeftQ < 1) nodesQ.dispatch.style.opacity = dispatchLeftQ.toFixed(2);
    }
    paintBustMeterQ(nowSecsQ);
  }
  function currentStationNameQ() {
    try {
      const curQ = G.audio && G.audio.radio && G.audio.radio.current ? G.audio.radio.current() : null;
      return curQ ? curQ.name : null;
    } catch (ignoredQ) { return null; }
  }
  function tickRadioQ() {
    if (!nodesQ.radioChip) return;
    let stationQ = G.radioName || null;
    if (!stationQ) stationQ = currentStationNameQ();
    const stagedSeatQ = !!(G.shotMode && G.car);
    const showChipQ = !!((G.flags.inCar || stagedSeatQ) && stationQ);
    nodesQ.radioChip.style.display = showChipQ ? 'block' : 'none';
    if (showChipQ) memoWriteQ(nodesQ.radioChip, 'radio', `♪ ${stationQ}`);
  }
  function tickCardQ(nextDefQ) {
    if (!nodesQ.card) return;
    const cardVisibleQ = !!(nextDefQ || G.missionProg);
    nodesQ.card.style.display = cardVisibleQ ? 'block' : 'none';
    if (cardVisibleQ && nextDefQ) {
      const personQ = CAST[nextDefQ.giver];
      if (nodesQ.cardPortrait) {
        const wordsQ = (personQ?.name || '?').trim().split(/\s+/);
        const lettersQ = [];
        for (const wordQ of wordsQ) lettersQ.push(wordQ[0]);
        nodesQ.cardPortrait.textContent = lettersQ.join('').slice(0, 2).toUpperCase();
        nodesQ.cardPortrait.style.background = personQ?.outfit?.topColor ? '#' + personQ.outfit.topColor.toString(16).padStart(6, '0') : '#555';
      }
      memoWriteQ(nodesQ.cardGiver, 'giver', personQ?.name || nextDefQ.giver || '');
      memoWriteQ(nodesQ.cardText, 'cardText', `${nextDefQ.title} — ${nextDefQ.blurb}`);
    }
    memoWriteQ(nodesQ.cardProg, 'prog', G.missionProg || 'Go to the blip');
  }
  function crewStatusMapQ(nextDefQ) {
    const statusQ = {};
    const drivingQ = G.car && G.flags.inCar;
    statusQ.driver = drivingQ ? (G.car.spec?.name || G.car.specId || 'Driving') : 'On foot';
    if (!drivingQ) statusQ.mechanic = '—';
    else statusQ.mechanic = (G.car.health ?? 100) > 70 ? 'Ready' : (G.car.health ?? 100) >= 30 ? 'Damaged' : 'Wrecked';
    if ((G.wanted || 0) > 0) statusQ.lookout = 'RBPD ACTIVE';
    else statusQ.lookout = nextDefQ ? `Next: ${nextDefQ.title}` : 'Clear';
    return statusQ;
  }
  function tickCrewQ(nextDefQ) {
    const statusQ = crewStatusMapQ(nextDefQ);
    const cardsQ = document.querySelectorAll('.crewCard');
    for (const cardQ of cardsQ) {
      const statusNodeQ = cardQ.querySelector('.crewStatus');
      if (statusNodeQ && statusQ[cardQ.dataset.role] !== undefined) statusNodeQ.textContent = statusQ[cardQ.dataset.role];
    }
  }
  function copUnitListQ(heroQ) {
    const unitsQ = [];
    const sourcesQ = G.cops || [];
    for (const unitQ of sourcesQ) {
      const entryQ = { name: unitQ.specId === 'police-suv' ? 'RBPD Enforcer' : 'RBPD Interceptor', d: Math.hypot(unitQ.x - heroQ.x, unitQ.z - heroQ.z), v: unitQ };
      unitsQ.push(entryQ);
    }
    if (G.heli?.group) {
      const spotQ = G.heli.group.position;
      unitsQ.push({ name: 'RBPD Air Unit', d: Math.hypot(spotQ.x - heroQ.x, spotQ.z - heroQ.z), heli: true });
    }
    unitsQ.sort((aQ, bQ) => aQ.d - bQ.d);
    return unitsQ;
  }
  function copTacticQ(unitQ, heroQ) {
    let tacticQ = 'PURSUIT';
    if (unitQ.heli) tacticQ = 'TRACKING';
    else if (unitQ.v) {
      const dotQ = Math.cos((unitQ.v.angle || 0) - (heroQ.angle || 0));
      const bearQ = Math.atan2(heroQ.x - unitQ.v.x, heroQ.z - unitQ.v.z);
      const relQ = ((bearQ - (unitQ.v.angle || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const closingQ = Math.abs(relQ) > 2.4 && (unitQ.v.speed || 0) > 12;
      if (unitQ.d < 14 && closingQ) tacticQ = 'RAMMING';
      else if (dotQ > 0.3 && unitQ.d < 60) tacticQ = 'INTERCEPT';
    }
    return tacticQ;
  }
  function tickCopPanelQ() {
    if (!(nodesQ.copPanel && nodesQ.copRows)) return;
    const panelVisibleQ = (G.wanted || 0) >= 1;
    nodesQ.copPanel.style.display = panelVisibleQ ? 'block' : 'none';
    if (!panelVisibleQ) return;
    const heroQ = G.car ? { x: G.car.x, z: G.car.z, angle: G.car.angle } : { x: G.player.x, z: G.player.z, angle: G.player.angle };
    const unitsQ = copUnitListQ(heroQ);
    const headQ = `<div class="copHead">RBPD RESPONSE — ${unitsQ.length} UNITS</div>`;
    const rowsTxtQ = unitsQ.slice(0, 4).map((unitQ) => `<div class="copRow"><span>${unitQ.name}</span><span>${Math.round(unitQ.d)}m</span><span>${copTacticQ(unitQ, heroQ)}</span></div>`).join('');
    nodesQ.copRows.innerHTML = headQ + rowsTxtQ;
  }
  G.updaters.push((frameQ, dt) => {
    void frameQ;
    const nowSecsQ = performance.now() / 1000;
    if (stagingActiveQ()) G.bustMeter = 0;
    memoWriteQ(nodesQ.money, 'money', cashLabelQ(G.money));
    memoWriteQ(nodesQ.rep, 'rep', String(Math.round(G.rep || 0)));
    memoWriteQ(nodesQ.rank, 'rank', CLUB_RANKS[G.rankIdx || 0] || 'Rookie');
    if (nodesQ.stars) {
      const starQ = Math.round(G.wanted || 0);
      nodesQ.stars.style.display = starQ > 0 ? 'block' : 'none';
      memoWriteQ(nodesQ.stars, 'stars', '★'.repeat(starQ));
    }
    if (nodesQ.healthBar) {
      const hpQ = Math.max(0, Math.min(100, G.playerHealth ?? 100));
      nodesQ.healthBar.style.width = `${hpQ}%`;
      nodesQ.healthBar.style.backgroundColor = hpQ < 30 ? '#e33b3b' : '';
    }
    if (nodesQ.carBar) {
      const carHpQ = G.car ? (G.car.health ?? 100) : 100;
      nodesQ.carBar.style.width = `${Math.max(0, Math.min(100, carHpQ))}%`;
    }
    if (nodesQ.objective) {
      const heroQ = G.car ? G.car : G.player;
      if (G.objective) {
        const distQ = Math.round(Math.hypot(G.objective.x - heroQ.x, G.objective.z - heroQ.z));
        memoWriteQ(nodesQ.objective, 'obj', `${G.objective.label} — ${distQ}m`);
      } else memoWriteQ(nodesQ.objective, 'obj', 'Free roam — find a letter blip');
    }
    if (nodesQ.wasted) nodesQ.wasted.style.display = G.flags.wasted ? 'flex' : 'none';
    if (nodesQ.busted) nodesQ.busted.style.display = G.flags.busted ? 'flex' : 'none';
    tickEndFlowQ(dt, nowSecsQ);
    tickRadioQ();
    drawMiniQ(nowSecsQ);
    drawDialQ(dt);
    if (G.paused && nodesQ.pauseMenu && nodesQ.pauseMenu.style.display !== 'none') bigMapQ();
    if (G.flags.garageOpen && !garageShownQ) drawGarageQ();
    if (!G.flags.garageOpen && garageShownQ && nodesQ.garagePanel) nodesQ.garagePanel.style.display = 'none';
    garageShownQ = !!G.flags.garageOpen;
    if (G.flags.garageOpen) {
      garageTickLeftQ = garageTickLeftQ - dt;
      if (!(garageTickLeftQ > 0)) {
        garageTickLeftQ = 0.5;
        drawGarageQ();
      }
    }
    slowLeftQ = slowLeftQ - dt;
    if (!(slowLeftQ > 0)) {
      slowLeftQ = 0.25;
      const nextDefQ = (typeof G.missionIndex === 'number' && G.missionIndex < MISSIONS.length) ? MISSIONS[G.missionIndex] : null;
      tickCardQ(nextDefQ);
      tickCrewQ(nextDefQ);
      tickCopPanelQ();
    }
  });
}
