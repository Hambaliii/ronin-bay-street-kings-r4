// hud.js — the whole 2D layer over the 3D world: figure readouts, the
// job panel, crew and cop panels, the GTA-style mini-map, the paused
// large map, the speed dial, the workshop panel, briefings, toasts
// and banners.
import { CLUB_RANKS, CAST, DISTRICTS, CFG, MISSIONS } from './config.js';
import { roadRoute } from './world.js';
import { districtAt } from './police.js';
const grabEl = (id) => document.getElementById(id);
const GROUP_LOCALE = 'en-US';
function moneyText(amount) { const wholeAmt = Math.round(amount || 0); const pieces = ['$', wholeAmt.toLocaleString(GROUP_LOCALE)]; return pieces.join(''); }
export function initHUD(G) {
  const els = {};
  els.objective = grabEl('objective'); els.money = grabEl('money'); els.rep = grabEl('rep'); els.rank = grabEl('rank');
  els.stars = grabEl('stars'); els.healthBar = grabEl('healthBar'); els.carBar = grabEl('carBar'); els.card = grabEl('missionCard');
  els.cardPortrait = grabEl('cardPortrait'); els.cardGiver = grabEl('cardGiver'); els.cardText = grabEl('cardText'); els.cardProg = grabEl('cardProg');
  els.copPanel = grabEl('copPanel'); els.copRows = grabEl('copRows'); els.briefing = grabEl('briefing'); els.banner = grabEl('banner');
  els.toast = grabEl('toast'); els.pauseMenu = grabEl('pauseMenu'); els.bigmap = grabEl('bigmap'); els.mapLegend = grabEl('mapLegend');
  els.minimap = grabEl('minimap'); els.speedo = grabEl('speedoCanvas'); els.wasted = grabEl('wasted'); els.busted = grabEl('busted');
  els.garagePanel = grabEl('garagePanel'); els.mapWrap = grabEl('mapWrap');
  // Radio chip: created here because the page carries no static node
  // for it — a pill near the top centre, under the banner strip and
  // clear of the mini-map (top-left) and the speedo cluster
  // (bottom-right). It appears only while seated in a car with the
  // radio playing, and its label goes through the text memo helper.
  let chipEl = grabEl('radioChip');
  if (!chipEl && typeof document !== 'undefined' && document.body) {
    chipEl = document.createElement('div'); chipEl.id = 'radioChip';
    chipEl.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;padding:5px 14px;border-radius:999px;background:rgba(10,12,18,0.72);border:1px solid rgba(255,122,26,0.65);color:#ffd9ae;font:bold 13px Arial,sans-serif;letter-spacing:1px;white-space:nowrap;';
    document.body.appendChild(chipEl);
  }
  els.radioChip = chipEl;
  // Vitality and dispatch UI. G.playerHealth is the single real
  // health value. Neither the ticker nor the bust bar exists in the
  // page, so both are created here just like the radio chip.
  if (G.playerHealth == null) G.playerHealth = 100; if (G.bustMeter == null) G.bustMeter = 0; if (G._lastDamageAt == null) G._lastDamageAt = -99;
  let dispEl = grabEl('dispatchLine');
  if (!dispEl && typeof document !== 'undefined' && document.body) {
    dispEl = document.createElement('div'); dispEl.id = 'dispatchLine';
    dispEl.style.cssText = 'position:fixed;top:172px;left:16px;z-index:30;pointer-events:none;display:none;max-width:430px;padding:4px 10px;background:rgba(8,10,14,0.66);border-left:3px solid #57b7ff;color:#cfe6ff;font:12px "Courier New",monospace;letter-spacing:0.4px;white-space:nowrap;overflow:hidden;';
    document.body.appendChild(dispEl);
  }
  els.dispatch = dispEl;
  let bustWrapEl = grabEl('bustWrap');
  if (!bustWrapEl && typeof document !== 'undefined' && document.body) {
    bustWrapEl = document.createElement('div'); bustWrapEl.id = 'bustWrap';
    bustWrapEl.style.cssText = 'position:fixed;top:64px;right:16px;z-index:30;pointer-events:none;display:none;width:190px;';
    bustWrapEl.innerHTML = '<div id="bustLabel" style="color:#ffd23f;font:bold 13px Arial,sans-serif;letter-spacing:3px;text-align:right;text-shadow:0 1px 3px #000;">BUSTED</div>' + '<div style="height:7px;margin-top:3px;background:rgba(255,255,255,0.18);border:1px solid rgba(0,0,0,0.6);"><div id="bustFill" style="height:100%;width:0%;background:#57b7ff;"></div></div>';
    document.body.appendChild(bustWrapEl);
  }
  els.bustWrap = bustWrapEl;
  els.bustFill = bustWrapEl ? bustWrapEl.querySelector('#bustFill') : null;
  els.bustLabel = bustWrapEl ? bustWrapEl.querySelector('#bustLabel') : null;
  let dispTimer = 0;
  G.dispatch = (line) => { G.lastDispatch = line; if (!els.dispatch) return; els.dispatch.textContent = line; els.dispatch.style.display = 'block'; els.dispatch.style.opacity = '1'; dispTimer = 5; };
  // WASTED / BUSTED overlays: every element is rebuilt with the
  // classic full-screen framing — vignette, huge letterspaced title,
  // and a sub-line underneath.
  function makeOverlayScreen(node, title, bg, titleCol) {
    if (!node) return null;
    node.innerHTML = '';
    node.style.cssText = `position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;flex-direction:column;background:${bg};pointer-events:none;`;
    const headEl = document.createElement('div'); headEl.className = 's26Title'; headEl.textContent = title;
    headEl.style.cssText = `color:${titleCol};font:bold 104px Arial,sans-serif;letter-spacing:22px;text-shadow:0 4px 22px rgba(0,0,0,0.85);`;
    const subEl = document.createElement('div'); subEl.className = 's26Sub';
    subEl.style.cssText = 'color:#e8e8e8;font:17px Arial,sans-serif;letter-spacing:2px;margin-top:16px;text-shadow:0 2px 8px #000;';
    node.appendChild(headEl); node.appendChild(subEl);
    const pairObj = { title: headEl, sub: subEl };
    return pairObj;
  }
  const ovWasted = makeOverlayScreen(els.wasted, 'WASTED', 'radial-gradient(ellipse at center, rgba(74,4,4,0.55) 0%, rgba(16,0,0,0.94) 100%)', '#c9c9c9');
  const ovBusted = makeOverlayScreen(els.busted, 'BUSTED', 'radial-gradient(ellipse at center, rgba(24,38,58,0.55) 0%, rgba(4,8,16,0.94) 100%)', '#dfe9f5');
  // Overlay flow state. staging = shot mode: display only, with NO
  // respawn timer and NO freeze, so a staged dossier frame stays
  // exactly as it was set up.
  let flowState = null;
  const isStagedShot = () => !!(G.shot || G.shotMode);
  function actorXY() { const ptObj = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player?.x || 0, z: G.player?.z || 0 }; return ptObj; }
  function moveCarTo(car, px, pz, health) {
    if (!car) return;
    car.x = px; car.z = pz; car.speed = 0; car.angle = 0; car.health = health;
    if (car.mesh) { car.mesh.position.set(px, car.mesh.position.y, pz); car.mesh.rotation.y = 0; }
  }
  function movePlayerTo(px, pz) {
    const fig = G.player; if (!fig) return;
    fig.x = px; fig.z = pz;
    if (fig.fig) { fig.fig.visible = true; fig.fig.position.set(px, fig.fig.position.y, pz); }
  }
  function resolveOverlay() {
    const kind = flowState.kind; const savedCar = flowState.car;
    if (G.car) { try { G.exitCar?.(); } catch (err) {} }
    if (kind === 'wasted') {
      G.money = Math.max(0, (G.money || 0) - 150);
      moveCarTo(savedCar, (G.hq && G.hq.garage && G.hq.garage.x) || -412.5, (G.hq && G.hq.garage && G.hq.garage.z) || 452, 60);
      movePlayerTo(330, -330);
      G.timeOfDay = ((G.timeOfDay || 12) + 2) % 24; G.flags.wasted = false; G.toast?.('Wasted — hospital bill $150');
    } else {
      G.money = Math.max(0, (G.money || 0) - 200);
      moveCarTo(savedCar, -408.5, 456, 50);
      movePlayerTo(-412.5, 452);
      G.timeOfDay = ((G.timeOfDay || 12) + 1) % 24; G.flags.busted = false; G.toast?.('Busted — RBPD fine $200, ride impounded to HQ');
    }
    G.wanted = 0; G.bustMeter = 0; G.playerHealth = 100; G.frozen = false; flowState = null; G.saveGame?.();
  }
  G.hud = G.hud || {};
  G.hud.showWasted = (zone) => {
    if (G.flags.wasted) return;
    const here = actorXY(); G.flags.wasted = true;
    if (ovWasted) ovWasted.sub.textContent = `You were flatlined in ${zone || districtAt(here.x, here.z)}`;
    flowState = { kind: 'wasted', t: 2.8, car: G.car || null, staging: isStagedShot() };
    if (!flowState.staging) G.frozen = true;
  };
  G.hud.showBusted = () => {
    if (G.flags.busted) return;
    G.flags.busted = true;
    if (ovBusted) ovBusted.sub.textContent = 'RBPD impounded your ride';
    flowState = { kind: 'busted', t: 2.8, car: G.car || null, staging: isStagedShot() };
    if (!flowState.staging) G.frozen = true;
  };
  // The one damage entry point (drive.js impacts call this). It is
  // ignored while an overlay is up, so the death frame can neither
  // re-trigger nor stack damage.
  G.damagePlayer = (hit) => {
    if (!(hit > 0) || isStagedShot() || flowState || G.flags.wasted || G.flags.busted) return;
    G.playerHealth = Math.max(0, (G.playerHealth ?? 100) - hit); G._lastDamageAt = G.elapsed || 0;
    if (!(G.playerHealth > 0)) G.hud.showWasted();
  };
  const mmPen = els.minimap ? els.minimap.getContext('2d') : null;
  const bmPen = els.bigmap ? els.bigmap.getContext('2d') : null;
  const spPen = els.speedo ? els.speedo.getContext('2d') : null;
  if (G.flags.mapZoom && els.mapWrap) {
    // Why 1.45 rather than the old 1.9: the wrap measures 150px wide
    // and is anchored at top:198px (index.html #mapWrap). At 1.9 the
    // disc grew to 285px and its lower edge reached 483px; on a 540p
    // frame that overruns the health panel (top near 431px) by about
    // 52px. At 1.45 the disc is 217.5px and ends at 415.5px, clearing
    // the panel by 15.5px at 540p (195.5px at 720p). The origin is
    // the top-left corner, matching the wrap's own anchor, so growth
    // spills from that corner instead of bottom-right.
    els.mapWrap.style.transform = 'scale(1.45)'; els.mapWrap.style.transformOrigin = 'top left';
  }
  // Keep the paused map on screen: natively it is 1024x720, and the
  // whole paused column (header, canvas, legend, hint) used to push
  // the southern shore and legend off a 720p frame. Only the CSS
  // size changes; the bitmap, and the wheel/pan maths reading bitmap
  // pixels through getBoundingClientRect, behave as before.
  if (els.bigmap) { els.bigmap.style.height = 'min(578px, calc(100vh - 150px))'; els.bigmap.style.width = 'auto'; els.bigmap.style.maxWidth = '94vw'; }
  // The crew panel, filled a single time.
  const CREW_INFO = { driver: { initials: 'RT', name: 'Ren Takagi', role: 'DRIVER', color: '#ff7a1a' }, mechanic: { initials: 'AS', name: 'Ako Sato', role: 'MECHANIC', color: '#3f6d8e' }, lookout: { initials: 'MC', name: 'Mika Chen', role: 'LOOKOUT', color: '#7a4fd0' } };
  document.querySelectorAll('.crewCard').forEach((card) => {
    const info = CREW_INFO[card.dataset.role]; if (!info) return;
    const faceEl = card.querySelector('.crewFace'); const nameEl = card.querySelector('.crewName'); const roleEl = card.querySelector('.crewRole');
    if (faceEl) { faceEl.textContent = info.initials; faceEl.style.background = info.color; }
    if (nameEl) nameEl.textContent = info.name;
    if (roleEl) roleEl.textContent = info.role;
  });
  // Helpers exposed on G.
  let toastTimer = 0, bannerTimer = 0, briefTimer = 0;
  G.toast = (msg) => { if (!els.toast) return; els.toast.textContent = msg; els.toast.style.display = 'block'; els.toast.style.opacity = '1'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { els.toast.style.display = 'none'; }, 3000); };
  G.banner = (txt) => { if (!els.banner) return; els.banner.textContent = txt; els.banner.style.display = 'block'; clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { els.banner.style.display = 'none'; }, 2500); };
  G.showBriefing = (giver, line) => {
    if (!els.briefing) return;
    const info = CAST[giver];
    const cEl = els.briefing.querySelector('.giverChip'); const nEl = els.briefing.querySelector('.giver'); const lEl = els.briefing.querySelector('.line');
    if (cEl) {
      const nameWords = (info?.name || giver || '?').trim().split(/\s+/);
      const initialsTxt = nameWords.map((word) => word[0]).join('').slice(0, 2).toUpperCase();
      cEl.textContent = initialsTxt;
      cEl.style.background = info?.outfit?.topColor ? '#' + info.outfit.topColor.toString(16).padStart(6, '0') : '#444';
    }
    if (nEl) nEl.textContent = info?.name || giver || '';
    if (lEl) lEl.textContent = line || '';
    els.briefing.style.display = 'block'; clearTimeout(briefTimer);
    briefTimer = setTimeout(() => { els.briefing.style.display = 'none'; }, 5000);
  };
  // Pause menu and the large map. Its view state — zoom (wheel,
  // centred on the cursor) plus pan (drag) — resets to the full-city
  // view whenever the map (re)opens.
  const bmView = { zoom: 1, cx: 0, cz: 0 };
  function resetBigView() { bmView.zoom = 1; bmView.cx = 0; bmView.cz = 0; }
  G.togglePause = () => {
    if (!els.pauseMenu) return;
    if (G.paused) { resetBigView(); els.pauseMenu.style.display = 'block'; drawBigMap(); fillLegend(); }
    else els.pauseMenu.style.display = 'none';
  };
  function fillLegend() {
    if (!els.mapLegend || els.mapLegend.dataset.filled) return;
    els.mapLegend.dataset.filled = '1';
    const chipsHtml = ['<span class="lgChip"><b style="color:#fff">➤</b> You</span>', '<span class="lgChip"><b style="color:#ffd23f">■</b> Objective</span>', '<span class="lgChip"><b>G</b> Garage</span>', '<span class="lgChip"><b style="color:#ff8c1a">M</b> RONIN MART</span>', '<span class="lgChip"><b>⌂</b> HQ / Safehouse</span>', '<span class="lgChip"><b style="color:#57b7ff">●</b> RBPD</span>', '<span class="lgChip"><b style="color:#ff4fd8">━</b> Route</span>', '<span class="lgChip">Scroll zoom · drag pan</span>'].join(' ');
    els.mapLegend.innerHTML = chipsHtml;
  }
  // Wheel zoom and drag pan, wired exactly once. Both handlers bail
  // unless the pause menu is open, so no other menu or HUD element
  // ever receives these events; the wheel is only swallowed while it
  // is over the map canvas itself.
  if (els.bigmap && !els.bigmap.dataset.panzoom) {
    els.bigmap.dataset.panzoom = '1';
    const cv = els.bigmap; cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
    const clampView = () => { const halfView = CFG.world / (2 * bmView.zoom); const limit = Math.max(0, CFG.half - halfView); bmView.cx = Math.max(-limit, Math.min(limit, bmView.cx)); bmView.cz = Math.max(-limit, Math.min(limit, bmView.cz)); };
    cv.addEventListener('wheel', (ev) => {
      if (!G.paused) return;
      ev.preventDefault();
      const rect = cv.getBoundingClientRect();
      const curX = (ev.clientX - rect.left) * (cv.width / rect.width); const curY = (ev.clientY - rect.top) * (cv.height / rect.height);
      const marg = 46;
      const scaleOld = Math.min((cv.width - marg * 2) / CFG.world, (cv.height - marg * 2) / CFG.world) * bmView.zoom;
      const wx = bmView.cx + ((curX - cv.width / 2) / scaleOld); const wz = bmView.cz + ((curY - cv.height / 2) / scaleOld);
      bmView.zoom = Math.max(1, Math.min(5, bmView.zoom * (ev.deltaY < 0 ? 1.18 : 1 / 1.18)));
      const scaleNew = Math.min((cv.width - marg * 2) / CFG.world, (cv.height - marg * 2) / CFG.world) * bmView.zoom;
      bmView.cx = wx - ((curX - cv.width / 2) / scaleNew); bmView.cz = wz - ((curY - cv.height / 2) / scaleNew);
      clampView(); drawBigMap();
    }, { passive: false });
    let dragState = null;
    cv.addEventListener('pointerdown', (ev) => { if (!G.paused) return; dragState = { x: ev.clientX, y: ev.clientY }; cv.style.cursor = 'grabbing'; try { cv.setPointerCapture(ev.pointerId); } catch (err) {} });
    cv.addEventListener('pointermove', (ev) => {
      if (!dragState || !G.paused) return;
      const rect = cv.getBoundingClientRect(); const marg = 46;
      const scale = Math.min((cv.width - marg * 2) / CFG.world, (cv.height - marg * 2) / CFG.world) * bmView.zoom;
      bmView.cx = bmView.cx - ((ev.clientX - dragState.x) * (cv.width / rect.width) / scale);
      bmView.cz = bmView.cz - ((ev.clientY - dragState.y) * (cv.height / rect.height) / scale);
      dragState = { x: ev.clientX, y: ev.clientY }; clampView(); drawBigMap();
    });
    const endDrag = () => { dragState = null; cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  }
  if (G.flags.openPauseMap && els.pauseMenu) { resetBigView(); els.pauseMenu.style.display = 'block'; drawBigMap(); fillLegend(); }
  // One layered GTA-style map painter backs both map views. The
  // stacking order is deliberate: district names go on last, above
  // blocks and roads alike, so nothing can cover them, while the GPS
  // route is painted over the tarmac yet under the blip layer.
  const BIG_ROAD_X = new Set([0, 330]); const BIG_ROAD_Z = new Set([0, 495]);
  const isMainX = (px) => BIG_ROAD_X.has(px); const isMainZ = (pz) => BIG_ROAD_Z.has(pz);
  function drawMapBase(pen, cvW, cvH, proj, view, opts) {
    const pxPer = Math.abs(proj(1, 0)[0] - proj(0, 0)[0]); const isPause = !!opts.labels;
    pen.fillStyle = '#3a7bd5'; pen.fillRect(0, 0, cvW, cvH);
    if (opts.waves) {
      pen.strokeStyle = 'rgba(255,255,255,0.10)'; pen.lineWidth = 1.5;
      let waveIdx = 0;
      while (waveIdx < 14) { const wy = (waveIdx / 14) * cvH + ((waveIdx * 37) % 23); pen.beginPath(); for (let px = 0; px <= cvW; px += 32) pen.lineTo(px, wy + Math.sin(px * 0.05 + waveIdx) * 2.5); pen.stroke(); waveIdx++; }
    }
    { const [sx0, sy0] = proj(-CFG.half - 60, 600); const [sx1, sy1] = proj(CFG.half + 60, 668); pen.fillStyle = '#eed9a4'; pen.fillRect(Math.min(sx0, sx1), Math.min(sy0, sy1), Math.abs(sx1 - sx0), Math.abs(sy1 - sy0)); }
    const [ix0, iy0] = proj(-CFG.half, -CFG.half); const [ix1, iy1] = proj(CFG.half, 612);
    pen.fillStyle = '#ddd3ae'; pen.fillRect(Math.min(ix0, ix1), Math.min(iy0, iy1), Math.abs(ix1 - ix0), Math.abs(iy1 - iy0));
    DISTRICTS.forEach((dRec) => { const [wx0, wy0] = proj(dRec.cx - 330, dRec.cz - 330); const [wx1, wy1] = proj(dRec.cx + 330, dRec.cz + 330); pen.fillStyle = dRec.accent; pen.globalAlpha = opts.washAlpha; pen.fillRect(Math.min(wx0, wx1), Math.min(wy0, wy1), Math.abs(wx1 - wx0), Math.abs(wy1 - wy0)); pen.globalAlpha = 1; });
    { const [bx0, by0] = proj(-CFG.half, 505); const [bx1, by1] = proj(CFG.half, 600); pen.fillStyle = 'rgba(233,201,133,0.55)'; pen.fillRect(Math.min(bx0, bx1), Math.min(by0, by1), Math.abs(bx1 - bx0), Math.abs(by1 - by0)); }
    pen.fillStyle = '#a9bd7a';
    [[200, 380, 300, 470], [-520, -300, -430, -210]].forEach((rectP) => { const [px0, py0] = proj(rectP[0], rectP[1]); const [px1, py1] = proj(rectP[2], rectP[3]); pen.fillRect(Math.min(px0, px1), Math.min(py0, py1), Math.abs(px1 - px0), Math.abs(py1 - py0)); });
    const rX = G.roadX, rZ = G.roadZ, halfR = CFG.roadW / 2;
    let blockI = 0;
    while (blockI < rX.length - 1) {
      let blockJ = 0;
      while (blockJ < rZ.length - 1) {
        const [ax, ay] = proj(rX[blockI] + halfR, rZ[blockJ] + halfR); const [bx, by] = proj(rX[blockI + 1] - halfR, rZ[blockJ + 1] - halfR);
        const rx = Math.min(ax, bx), ry = Math.min(ay, by); const rw = Math.abs(bx - ax), rh = Math.abs(by - ay);
        if (!(rx + rw < 0 || ry + rh < 0 || rx > cvW || ry > cvH)) {
          const midX = (rX[blockI] + rX[blockI + 1]) / 2, midZ = (rZ[blockJ] + rZ[blockJ + 1]) / 2;
          pen.fillStyle = (midX < -165 && midZ < -165) ? '#b3c184' : '#cfc096'; pen.fillRect(rx, ry, rw, rh);
        }
        blockJ++;
      }
      blockI++;
    }
    const roadW = CFG.roadW * pxPer; pen.lineCap = 'butt';
    const strokeRoads = (mainsOnly, colIn, widIn) => {
      pen.strokeStyle = colIn; pen.lineWidth = widIn; pen.beginPath();
      rX.forEach((lx) => { if (isMainX(lx) !== mainsOnly) return; const [mx] = proj(lx, 0); if (mx < -widIn || mx > cvW + widIn) return; const [, ty] = proj(lx, -CFG.half); const [, by] = proj(lx, CFG.half); pen.moveTo(mx, ty); pen.lineTo(mx, by); });
      rZ.forEach((lz) => { if (isMainZ(lz) !== mainsOnly) return; const [, my] = proj(0, lz); if (my < -widIn || my > cvH + widIn) return; const [lx2] = proj(-CFG.half, lz); const [rx2] = proj(CFG.half, lz); pen.moveTo(lx2, my); pen.lineTo(rx2, my); });
      pen.stroke();
    };
    strokeRoads(false, '#b9b2a0', Math.max(1.5, roadW * 0.62));
    strokeRoads(false, '#e3ddcb', Math.max(1.2, roadW * 0.5));
    strokeRoads(true, '#8f8a7c', roadW + 2);
    strokeRoads(true, '#f4efe0', roadW);
    if (isPause) {
      const [, wy] = proj(0, 556);
      if (wy > -6 && wy < cvH + 6) { pen.strokeStyle = '#d9b878'; pen.lineWidth = Math.max(2, 8 * pxPer); pen.beginPath(); const [px0] = proj(-CFG.half, 556); const [px1] = proj(CFG.half, 556); pen.moveTo(px0, wy); pen.lineTo(px1, wy); pen.stroke(); }
    }
    if (G.touge && G.touge.length > 1) {
      pen.lineJoin = 'round'; pen.lineCap = 'round';
      [0, 1].forEach((passIdx) => { pen.strokeStyle = passIdx === 0 ? '#8f8a7c' : '#f4efe0'; pen.lineWidth = passIdx === 0 ? 5 : 3.5; pen.beginPath(); G.touge.forEach((pt, idx) => { const [mx, my] = proj(pt.x, pt.z); if (idx === 0) pen.moveTo(mx, my); else pen.lineTo(mx, my); }); pen.closePath(); pen.stroke(); });
    }
    if (G.objective && opts.routeFrom) {
      try {
        const routePts = roadRoute(G, opts.routeFrom, G.objective) || [];
        if (routePts.length > 1) {
          pen.lineJoin = 'round'; pen.lineCap = 'round';
          [0, 1].forEach((passIdx) => { pen.strokeStyle = passIdx === 0 ? 'rgba(255,255,255,0.9)' : '#ff2fd6'; pen.lineWidth = passIdx === 0 ? (isPause ? 7 : 5) : (isPause ? 4.5 : 3.2); pen.beginPath(); routePts.forEach((pt, idx) => { const [mx, my] = proj(pt.x, pt.z); if (idx === 0) pen.moveTo(mx, my); else pen.lineTo(mx, my); }); pen.stroke(); });
        }
      } catch (err) { /* the route is optional */ }
    }
    if (opts.labels) {
      const labels = (G.landmarks && G.landmarks.districts) || DISTRICTS.map((dRec) => ({ name: dRec.name, x: dRec.cx, z: dRec.cz }));
      pen.textAlign = 'center'; pen.textBaseline = 'middle';
      labels.forEach((labelRec) => {
        const [tx, ty] = proj(labelRec.x, labelRec.z);
        if (tx < -90 || ty < -20 || tx > cvW + 90 || ty > cvH + 20) return;
        const tag = labelRec.name.toUpperCase();
        pen.font = '600 21px Arial, sans-serif';
        try { pen.letterSpacing = '3px'; } catch (err) {}
        pen.shadowColor = 'rgba(255,255,255,0.9)'; pen.shadowBlur = 5; pen.lineWidth = 4; pen.strokeStyle = 'rgba(250,246,230,0.85)'; pen.strokeText(tag, tx, ty);
        pen.shadowBlur = 0; pen.fillStyle = '#54452c'; pen.fillText(tag, tx, ty);
        try { pen.letterSpacing = '0px'; } catch (err) {}
      });
      drawMapLegend(pen, cvW, cvH);
      pen.font = '11px Arial, sans-serif'; pen.textAlign = 'right'; pen.textBaseline = 'bottom'; pen.fillStyle = 'rgba(20,16,10,0.55)';
      pen.fillText(`${bmView.zoom.toFixed(1)}x — scroll to zoom · drag to pan`, cvW - 12, cvH - 10);
    }
  }
  function drawMapLegend(pen, cvW, cvH) {
    const rows = [['#ffffff', '➤', 'You'], ['#ffd23f', '■', 'Objective / mission'], ['#2b2f36', 'G', 'Garage — RONIN KAI HQ'], ['#ff8c1a', 'M', 'RONIN MART supermarket'], ['#ffffff', '⌂', 'Safehouse (HQ)'], ['#2e6fb7', '●', 'RBPD police'], ['#ff2fd6', '━', 'GPS route']];
    const pw = 218, ph = 16 + rows.length * 19 + 8, px = 12, py = cvH - ph - 12;
    pen.save();
    pen.fillStyle = 'rgba(8,10,16,0.72)'; pen.beginPath();
    if (pen.roundRect) pen.roundRect(px, py, pw, ph, 8); else pen.rect(px, py, pw, ph);
    pen.fill(); pen.strokeStyle = 'rgba(255,255,255,0.25)'; pen.lineWidth = 1; pen.stroke();
    pen.textAlign = 'left'; pen.textBaseline = 'middle'; pen.font = 'bold 11px Arial, sans-serif'; pen.fillStyle = '#ffd9ae'; pen.fillText('LEGEND', px + 12, py + 13);
    pen.font = '12px Arial, sans-serif';
    rows.forEach((row, idx) => { const ry = py + 16 + 10 + idx * 19; pen.fillStyle = row[0]; pen.font = 'bold 12px Arial, sans-serif'; pen.fillText(row[1], px + 12, ry); pen.font = '12px Arial, sans-serif'; pen.fillStyle = '#e8eef4'; pen.fillText(row[2], px + 34, ry); });
    pen.restore();
  }
  function drawGlyphChip(pen, px, py, size, bg, glyph, fg) {
    pen.fillStyle = bg; const half = size;
    pen.beginPath();
    if (pen.roundRect) pen.roundRect(px - half / 2, py - half / 2, half, half, 3); else pen.rect(px - half / 2, py - half / 2, half, half);
    pen.fill(); pen.fillStyle = fg || '#14100a'; pen.font = `bold ${Math.round(half * 0.72)}px Arial, sans-serif`; pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText(glyph, px, py + 1);
  }
  function drawBlips(pen, proj, tNow, opts) {
    const actor = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    const tagDraw = (px, py, size, txt, dx) => {
      if (!opts.tags) return;
      pen.font = 'bold 10px Arial, sans-serif'; pen.textAlign = 'center'; pen.textBaseline = 'top'; pen.lineWidth = 3; pen.strokeStyle = 'rgba(250,246,230,0.9)';
      pen.strokeText(txt, px + (dx || 0), py + size / 2 + 2); pen.fillStyle = '#3a2f1c'; pen.fillText(txt, px + (dx || 0), py + size / 2 + 2);
    };
    { const [hx, hy] = proj(G.hq.x, G.hq.z); drawGlyphChip(pen, hx, hy, opts.chipSize, '#ffffff', '⌂'); tagDraw(hx, hy, opts.chipSize, 'SAFEHOUSE', -16); }
    { const [gx, gy] = proj(G.hq.garage.x, G.hq.garage.z); drawGlyphChip(pen, gx, gy, opts.chipSize, '#2b2f36', 'G', '#ffffff'); tagDraw(gx, gy, opts.chipSize, 'RONIN KAI HQ', 18); }
    if (G.landmarks && G.landmarks.market) {
      const mkt = G.landmarks.market; const [mx, my] = proj(mkt.x, mkt.z);
      if (opts.tags) { drawGlyphChip(pen, mx, my, opts.chipSize, '#ff8c1a', 'M', '#ffffff'); tagDraw(mx, my, opts.chipSize, 'RONIN MART'); }
      else if (mx > -14 && my > -14 && mx < 234 && my < 234) {
        pen.beginPath(); pen.arc(mx, my, 6.5, 0, Math.PI * 2); pen.fillStyle = '#ff8c1a'; pen.fill();
        pen.lineWidth = 2; pen.strokeStyle = '#ffffff'; pen.stroke(); pen.fillStyle = '#ffffff'; pen.font = 'bold 9px Arial, sans-serif'; pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText('M', mx, my + 0.5);
      }
    }
    if (G.cops) {
      G.cops.forEach((cop) => {
        const [cx, cy] = proj(cop.x, cop.z);
        pen.beginPath(); pen.arc(cx, cy, 4, 0, Math.PI * 2); pen.fillStyle = '#2e6fb7'; pen.fill();
        const flash = 0.35 + (0.65 * Math.abs(Math.sin(tNow * 5)));
        pen.beginPath(); pen.arc(cx, cy, 6.5, 0, Math.PI * 2); pen.strokeStyle = `rgba(255,60,60,${flash.toFixed(2)})`; pen.lineWidth = 2; pen.stroke();
      });
    }
    if (G.heli?.group) {
      const spot = G.heli.group.position; const [hx, hy] = proj(spot.x, spot.z);
      pen.beginPath(); pen.arc(hx, hy, 5, 0, Math.PI * 2); pen.fillStyle = '#2e6fb7'; pen.fill();
      pen.fillStyle = '#ffffff'; pen.font = 'bold 8px Arial, sans-serif'; pen.textAlign = 'center'; pen.textBaseline = 'middle'; pen.fillText('H', hx, hy + 0.5);
    }
    if (G.objective) { const [ox, oy] = proj(G.objective.x, G.objective.z); drawGlyphChip(pen, ox, oy, opts.chipSize + 2, '#ffd23f', G.objective.letter || '!'); }
    const [ax, ay] = proj(actor.x, actor.z); const heading = G.car ? G.car.angle : G.player.angle;
    pen.save(); pen.translate(ax, ay);
    pen.rotate(Math.PI - heading); pen.beginPath();
    const arrowLen = opts.arrowSize;
    pen.moveTo(0, -arrowLen); pen.lineTo(arrowLen * 0.62, arrowLen * 0.75); pen.lineTo(0, arrowLen * 0.35); pen.lineTo(-arrowLen * 0.62, arrowLen * 0.75); pen.closePath();
    pen.fillStyle = '#ffffff'; pen.fill(); pen.lineWidth = 2; pen.strokeStyle = '#14100a'; pen.stroke(); pen.restore();
  }
  // The mini-map's static layer (land/water/roads/blocks at world
  // scale) is painted ONCE onto an offscreen canvas; each frame just
  // blits the window centred on the player, then redraws only the
  // cheap dynamic parts (route and blips) over it.
  let staticCv = null;
  function staticMinimap() {
    if (staticCv) return staticCv;
    const SIZE = 1320;
    const cv = document.createElement('canvas'); cv.width = SIZE; cv.height = SIZE;
    const pen = cv.getContext('2d'); const proj = (px, pz) => [px + CFG.half, pz + CFG.half];
    drawMapBase(pen, SIZE, SIZE, proj, CFG.world, { washAlpha: 0.07, labels: false, waves: false, routeFrom: null });
    staticCv = cv; return cv;
  }
  const HUB_RADIUS = 13; const HUB_FILL = 'rgba(10,12,16,0.55)'; const HUB_RING = 'rgba(255,255,255,0.85)'; const HUB_LINEW = 2;
  function drawMinimap(tNow) {
    if (!mmPen || !els.minimap) return;
    const cvW = els.minimap.width, cvH = els.minimap.height;
    const actor = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    const spanM = 340;
    const pxPer = cvW / spanM; const proj = (px, pz) => [cvW / 2 + ((px - actor.x) * pxPer), cvH / 2 + ((pz - actor.z) * pxPer)];
    mmPen.save();
    mmPen.beginPath(); mmPen.arc(cvW / 2, cvH / 2, cvW / 2, 0, Math.PI * 2); mmPen.clip();
    mmPen.fillStyle = '#3a7bd5'; mmPen.fillRect(0, 0, cvW, cvH);
    const img = staticMinimap();
    mmPen.imageSmoothingEnabled = true;
    mmPen.drawImage(img, actor.x - spanM / 2 + CFG.half, actor.z - spanM / 2 + CFG.half, spanM, spanM, 0, 0, cvW, cvH);
    if (G.objective) {
      try {
        const routePts = roadRoute(G, actor, G.objective) || [];
        if (routePts.length > 1) {
          mmPen.lineJoin = 'round'; mmPen.lineCap = 'round';
          [0, 1].forEach((passIdx) => { mmPen.strokeStyle = passIdx === 0 ? 'rgba(255,255,255,0.9)' : '#ff2fd6'; mmPen.lineWidth = passIdx === 0 ? 6.5 : 4.16; mmPen.beginPath(); routePts.forEach((pt, idx) => { const [mx, my] = proj(pt.x, pt.z); if (idx === 0) mmPen.moveTo(mx, my); else mmPen.lineTo(mx, my); }); mmPen.stroke(); });
        }
      } catch (err) { /* the route is optional */ }
    }
    mmPen.beginPath(); mmPen.arc(cvW / 2, cvH / 2, HUB_RADIUS, 0, Math.PI * 2); mmPen.fillStyle = HUB_FILL; mmPen.fill(); mmPen.lineWidth = HUB_LINEW; mmPen.strokeStyle = HUB_RING; mmPen.stroke();
    drawBlips(mmPen, proj, tNow, { chipSize: 13 * 1.3, arrowSize: 8 * 1.3 });
    mmPen.restore();
    mmPen.beginPath(); mmPen.arc(cvW / 2, cvH / 2, cvW / 2 - 1.5, 0, Math.PI * 2); mmPen.lineWidth = 3; mmPen.strokeStyle = 'rgba(10,12,16,0.85)'; mmPen.stroke();
    mmPen.fillStyle = '#ffffff'; mmPen.font = 'bold 13px Arial, sans-serif'; mmPen.textAlign = 'center'; mmPen.textBaseline = 'top'; mmPen.shadowColor = 'rgba(0,0,0,0.8)'; mmPen.shadowBlur = 3; mmPen.fillText('N', cvW / 2, 7); mmPen.shadowBlur = 0;
  }
  function drawBigMap() {
    if (!bmPen || !els.bigmap) return;
    const cvW = els.bigmap.width, cvH = els.bigmap.height; const marg = 46;
    const scale = Math.min((cvW - marg * 2) / CFG.world, (cvH - marg * 2) / CFG.world) * bmView.zoom;
    const orgX = cvW / 2, orgY = cvH / 2; const proj = (px, pz) => [orgX + ((px - bmView.cx) * scale), orgY + ((pz - bmView.cz) * scale)];
    const actor = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    bmPen.save(); bmPen.beginPath(); bmPen.rect(0, 0, cvW, cvH); bmPen.clip();
    drawMapBase(bmPen, cvW, cvH, proj, CFG.world / bmView.zoom, { washAlpha: 0.12, labels: true, waves: true, routeFrom: actor });
    const nowT = performance.now() / 1000;
    drawBlips(bmPen, proj, nowT, { chipSize: 20, arrowSize: 13, tags: true });
    bmPen.restore();
    bmPen.fillStyle = '#2c2114'; bmPen.font = 'bold 34px Arial, sans-serif'; bmPen.textAlign = 'left'; bmPen.textBaseline = 'top';
    try { bmPen.letterSpacing = '6px'; } catch (err) {}
    bmPen.fillText('STREET SAMURAI', 22, 16);
    try { bmPen.letterSpacing = '0px'; } catch (err) {}
  }
  // Speedometer dial.
  let nosAmt = 1;
  function drawSpeedo(dt) {
    if (!spPen || !els.speedo) return;
    const cvW = els.speedo.width, cvH = els.speedo.height;
    spPen.clearRect(0, 0, cvW, cvH);
    const cxDial = cvW / 2, cyDial = 74, radDial = 56; const topSpeed = 280;
    const angStart = Math.PI * 0.75, angEnd = Math.PI * 0.75 + Math.PI * 1.5;
    spPen.beginPath(); spPen.arc(cxDial, cyDial, radDial + 8, 0, Math.PI * 2); spPen.fillStyle = 'rgba(10,12,18,0.72)'; spPen.fill();
    spPen.beginPath(); spPen.arc(cxDial, cyDial, radDial, angStart + (220 / topSpeed) * (angEnd - angStart), angEnd); spPen.strokeStyle = '#e33b3b'; spPen.lineWidth = 5; spPen.stroke();
    spPen.fillStyle = '#e8e8e8'; spPen.font = '9px Arial, sans-serif'; spPen.textAlign = 'center'; spPen.textBaseline = 'middle';
    function paintOneTick(tickVal) {
      const angTick = angStart + ((tickVal / topSpeed) * (angEnd - angStart));
      const cosT = Math.cos(angTick); const sinT = Math.sin(angTick);
      const inX = cxDial + (cosT * (radDial - 4)), inY = cyDial + (sinT * (radDial - 4));
      const outX = cxDial + (cosT * radDial), outY = cyDial + (sinT * radDial);
      spPen.beginPath(); spPen.moveTo(inX, inY); spPen.lineTo(outX, outY); spPen.strokeStyle = tickVal > 220 ? '#e33b3b' : '#cfcfcf'; spPen.lineWidth = 2; spPen.stroke();
      if (tickVal % 40 === 0) { const labX = cxDial + (cosT * (radDial - 13)), labY = cyDial + (sinT * (radDial - 13)); spPen.fillText(String(tickVal), labX, labY); }
    }
    let tickVal = 0;
    while (tickVal <= topSpeed) { paintOneTick(tickVal); tickVal += 20; }
    const kmh = Math.min(topSpeed, Math.abs(G.speedKmh || 0)); const needleAng = angStart + ((kmh / topSpeed) * (angEnd - angStart));
    spPen.beginPath(); spPen.moveTo(cxDial - Math.cos(needleAng) * 8, cyDial - Math.sin(needleAng) * 8); spPen.lineTo(cxDial + Math.cos(needleAng) * (radDial - 8), cyDial + Math.sin(needleAng) * (radDial - 8)); spPen.strokeStyle = '#ff7a1a'; spPen.lineWidth = 3; spPen.stroke();
    spPen.beginPath(); spPen.arc(cxDial, cyDial, 4.5, 0, Math.PI * 2); spPen.fillStyle = '#f2f2f2'; spPen.fill();
    spPen.fillStyle = '#ffffff'; spPen.font = 'bold 19px Arial, sans-serif'; spPen.fillText(String(Math.round(kmh)), cxDial, cyDial + 26);
    spPen.font = '8px Arial, sans-serif'; spPen.fillStyle = '#aab'; spPen.fillText('km/h', cxDial, cyDial + 38);
    if (G.flags.nosActive) nosAmt = Math.max(0, nosAmt - dt * 0.45); else nosAmt = Math.min(1, nosAmt + dt * 0.12);
    const nosW = 74, nosX = cxDial - nosW / 2, nosY = cvH - 14;
    spPen.fillStyle = 'rgba(255,255,255,0.18)'; spPen.fillRect(nosX, nosY, nosW, 6);
    spPen.fillStyle = '#37c8ff'; spPen.fillRect(nosX, nosY, nosW * nosAmt, 6);
    spPen.fillStyle = '#9adfff'; spPen.font = 'bold 8px Arial, sans-serif'; spPen.fillText('NOS', cxDial, nosY - 6);
    if (G.flags.drifting) {
      spPen.beginPath(); spPen.arc(cvW - 16, 14, 5, 0, Math.PI * 2); spPen.fillStyle = '#e879ff'; spPen.fill();
      spPen.fillStyle = '#e879ff'; spPen.font = 'bold 8px Arial, sans-serif'; spPen.fillText('DRIFT', cvW - 16, 26);
    }
  }
  // Workshop (garage) panel.
  let garShown = false, garTick = 0;
  function drawGarage() {
    if (!els.garagePanel) return;
    const rows = G.garageList || []; let html = '<div class="garageTitle">HQ GARAGE — RONIN BAY</div>';
    rows.slice(0, 9).forEach((row, idx) => { const price = row.owned ? 'OWNED' : moneyText(row.price); const mark = row.current ? ' ▶' : ''; html = html + `<div class="garageRow${row.current ? ' current' : ''}"><span>${idx + 1}. ${row.name}${mark}</span><span>${price}</span></div>`; });
    html = html + '<div class="garageFoot">1-9 select · E close</div>';
    els.garagePanel.innerHTML = html; els.garagePanel.style.display = 'block';
  }
  // Per-frame updates plus the slower panel refreshes.
  const textCache = {};
  function memoText(node, key, val) { if (!node) return; if (textCache[key] !== val) { textCache[key] = val; node.textContent = val; } }
  let slowTimer = 0;
  G.updaters.push((frameG, dt) => {
    const nowSec = performance.now() / 1000;
    if (isStagedShot()) G.bustMeter = 0;
    memoText(els.money, 'money', moneyText(G.money));
    memoText(els.rep, 'rep', String(Math.round(G.rep || 0)));
    memoText(els.rank, 'rank', CLUB_RANKS[G.rankIdx || 0] || 'Rookie');
    if (els.stars) { const starCount = Math.round(G.wanted || 0); els.stars.style.display = starCount > 0 ? 'block' : 'none'; memoText(els.stars, 'stars', '★'.repeat(starCount)); }
    if (els.healthBar) { const hp = Math.max(0, Math.min(100, G.playerHealth ?? 100)); els.healthBar.style.width = `${hp}%`; els.healthBar.style.backgroundColor = hp < 30 ? '#e33b3b' : ''; }
    if (els.carBar) els.carBar.style.width = `${Math.max(0, Math.min(100, G.car ? (G.car.health ?? 100) : 100))}%`;
    if (els.objective) {
      const actor = G.car ? G.car : G.player;
      if (G.objective) { const distM = Math.round(Math.hypot(G.objective.x - actor.x, G.objective.z - actor.z)); memoText(els.objective, 'obj', `${G.objective.label} — ${distM}m`); }
      else memoText(els.objective, 'obj', 'Free roam — find a letter blip');
    }
    if (els.wasted) els.wasted.style.display = G.flags.wasted ? 'flex' : 'none';
    if (els.busted) els.busted.style.display = G.flags.busted ? 'flex' : 'none';
    {
      const elapsed = G.elapsed || 0;
      if (!flowState) {
        const actor = G.car || G.player;
        if (actor && (Math.abs(actor.x) > 668 || Math.abs(actor.z) > 668)) G.damagePlayer(22 * dt);
        else if ((G.playerHealth ?? 100) < 100 && elapsed - (G._lastDamageAt ?? -99) > 8) G.playerHealth = Math.min(100, (G.playerHealth ?? 100) + (0.8 * dt));
      } else if (!flowState.staging) {
        flowState.t = flowState.t - dt;
        const ov = flowState.kind === 'wasted' ? ovWasted : ovBusted;
        if (ov) { const grow = 1 - Math.max(0, flowState.t) / 2.8; ov.title.style.transform = `scale(${(1 + grow * 0.16).toFixed(3)})`; }
        if (!(flowState.t > 0)) resolveOverlay();
      }
      if (dispTimer > 0 && els.dispatch) { dispTimer = dispTimer - dt; if (!(dispTimer > 0)) els.dispatch.style.display = 'none'; else if (dispTimer < 1) els.dispatch.style.opacity = dispTimer.toFixed(2); }
      if (els.bustWrap) {
        const meter = Math.max(0, Math.min(1, G.bustMeter || 0));
        els.bustWrap.style.display = meter > 0 ? 'block' : 'none';
        if (meter > 0) { if (els.bustFill) els.bustFill.style.width = `${Math.round(meter * 100)}%`; if (els.bustLabel) els.bustLabel.style.opacity = meter > 0.7 ? (Math.sin(nowSec * 10) > 0 ? '1' : '0.25') : '1'; }
      }
    }
    if (els.radioChip) {
      let station = G.radioName || null;
      if (!station) {
        try { const cur = G.audio && G.audio.radio && G.audio.radio.current ? G.audio.radio.current() : null; if (cur) station = cur.name; } catch (err) { /* the chip stays hidden */ }
      }
      const stagedSeat = !!(G.shotMode && G.car); const showRadio = !!((G.flags.inCar || stagedSeat) && station);
      els.radioChip.style.display = showRadio ? 'block' : 'none';
      if (showRadio) memoText(els.radioChip, 'radio', `♪ ${station}`);
    }
    drawMinimap(nowSec); drawSpeedo(dt);
    if (G.paused && els.pauseMenu && els.pauseMenu.style.display !== 'none') drawBigMap();
    if (G.flags.garageOpen && !garShown) drawGarage();
    if (!G.flags.garageOpen && garShown && els.garagePanel) els.garagePanel.style.display = 'none';
    garShown = !!G.flags.garageOpen;
    if (G.flags.garageOpen) { garTick = garTick - dt; if (!(garTick > 0)) { garTick = 0.5; drawGarage(); } }
    slowTimer = slowTimer - dt;
    if (!(slowTimer > 0)) {
      slowTimer = 0.25;
      const next = (typeof G.missionIndex === 'number' && G.missionIndex < MISSIONS.length) ? MISSIONS[G.missionIndex] : null;
      if (els.card) {
        const showCard = !!(next || G.missionProg);
        els.card.style.display = showCard ? 'block' : 'none';
        if (showCard && next) {
          const person = CAST[next.giver];
          if (els.cardPortrait) {
            const nameWords = (person?.name || '?').trim().split(/\s+/);
            els.cardPortrait.textContent = nameWords.map((word) => word[0]).join('').slice(0, 2).toUpperCase();
            els.cardPortrait.style.background = person?.outfit?.topColor ? '#' + person.outfit.topColor.toString(16).padStart(6, '0') : '#555';
          }
          memoText(els.cardGiver, 'giver', person?.name || next.giver || '');
          memoText(els.cardText, 'cardText', `${next.title} — ${next.blurb}`);
        }
        memoText(els.cardProg, 'prog', G.missionProg || 'Go to the blip');
      }
      const statusMap = { driver: G.car && G.flags.inCar ? (G.car.spec?.name || G.car.specId || 'Driving') : 'On foot', mechanic: !G.car || !G.flags.inCar ? '—' : ((G.car.health ?? 100) > 70 ? 'Ready' : (G.car.health ?? 100) >= 30 ? 'Damaged' : 'Wrecked'), lookout: (G.wanted || 0) > 0 ? 'RBPD ACTIVE' : (next ? `Next: ${next.title}` : 'Clear') };
      document.querySelectorAll('.crewCard').forEach((card) => { const sEl = card.querySelector('.crewStatus'); if (sEl && statusMap[card.dataset.role] !== undefined) sEl.textContent = statusMap[card.dataset.role]; });
      if (els.copPanel && els.copRows) {
        const showPanel = (G.wanted || 0) >= 1;
        els.copPanel.style.display = showPanel ? 'block' : 'none';
        if (showPanel) {
          const actor = G.car ? { x: G.car.x, z: G.car.z, angle: G.car.angle } : { x: G.player.x, z: G.player.z, angle: G.player.angle };
          const units = [];
          (G.cops || []).forEach((unit) => { units.push({ name: unit.specId === 'police-suv' ? 'RBPD Enforcer' : 'RBPD Interceptor', d: Math.hypot(unit.x - actor.x, unit.z - actor.z), v: unit }); });
          if (G.heli?.group) { const spot = G.heli.group.position; units.push({ name: 'RBPD Air Unit', d: Math.hypot(spot.x - actor.x, spot.z - actor.z), heli: true }); }
          units.sort((a, b) => a.d - b.d);
          const headHtml = `<div class="copHead">RBPD RESPONSE — ${units.length} UNITS</div>`;
          const rowsHtml = units.slice(0, 4).map((rec) => {
            let tactic = 'PURSUIT';
            if (rec.heli) tactic = 'TRACKING';
            else if (rec.v) {
              const dot = Math.cos((rec.v.angle || 0) - (actor.angle || 0));
              const bearing = Math.atan2(actor.x - rec.v.x, actor.z - rec.v.z);
              const closing = Math.abs(((bearing - (rec.v.angle || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 2.4 && (rec.v.speed || 0) > 12;
              if (rec.d < 14 && closing) tactic = 'RAMMING';
              else if (dot > 0.3 && rec.d < 60) tactic = 'INTERCEPT';
            }
            return `<div class="copRow"><span>${rec.name}</span><span>${Math.round(rec.d)}m</span><span>${tactic}</span></div>`;
          }).join('');
          els.copRows.innerHTML = headHtml + rowsHtml;
        }
      }
    }
  });
}
