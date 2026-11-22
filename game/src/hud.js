import { CLUB_RANKS, CAST, DISTRICTS, CFG, MISSIONS } from './config.js';
import { roadRoute } from './world.js';

// ------------------------------------------------------------------- hud.js
// DOM HUD: stats, mission card, crew + cop panels, GTA-style minimap,
// pause big map, speedometer, garage panel, briefing / toast / banner.

function el(id) { return document.getElementById(id); }
function fmtMoney(n) { return '$' + Math.round(n || 0).toLocaleString('en-US'); }

export function initHUD(G) {
  const E = {
    objective: el('objective'), money: el('money'), rep: el('rep'), rank: el('rank'),
    stars: el('stars'), healthBar: el('healthBar'), carBar: el('carBar'),
    card: el('missionCard'), cardPortrait: el('cardPortrait'), cardGiver: el('cardGiver'),
    cardText: el('cardText'), cardProg: el('cardProg'),
    copPanel: el('copPanel'), copRows: el('copRows'),
    briefing: el('briefing'), banner: el('banner'), toast: el('toast'),
    pauseMenu: el('pauseMenu'), bigmap: el('bigmap'), mapLegend: el('mapLegend'),
    minimap: el('minimap'), speedo: el('speedoCanvas'),
    wasted: el('wasted'), busted: el('busted'),
    garagePanel: el('garagePanel'), mapWrap: el('mapWrap'),
  };
  // --- S24 radio chip -------------------------------------------------------
  // Created here (no static element in the page): a small pill top-center,
  // below the banner zone and clear of the bottom-right minimap / speedo /
  // weapon cluster. Shown only while in a car (or staged in one for a shot)
  // with the radio on; text is set through the setText cache in the updater.
  let radioChip = el('radioChip');
  if (!radioChip && typeof document !== 'undefined' && document.body) {
    radioChip = document.createElement('div');
    radioChip.id = 'radioChip';
    radioChip.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:30;pointer-events:none;display:none;padding:5px 14px;border-radius:999px;background:rgba(10,12,18,0.72);border:1px solid rgba(255,122,26,0.65);color:#ffd9ae;font:bold 13px Arial,sans-serif;letter-spacing:1px;white-space:nowrap;';
    document.body.appendChild(radioChip);
  }
  E.radioChip = radioChip;
  const mm = E.minimap ? E.minimap.getContext('2d') : null;
  const bm = E.bigmap ? E.bigmap.getContext('2d') : null;
  const sp = E.speedo ? E.speedo.getContext('2d') : null;

  if (G.flags.mapZoom && E.mapWrap) {
    E.mapWrap.style.transform = 'scale(1.9)';
    E.mapWrap.style.transformOrigin = 'bottom right';
  }

  // --- crew panel (fill once) ------------------------------------------------
  const CREW = {
    driver: { initials: 'RT', name: 'Ren Takagi', role: 'DRIVER', color: '#ff7a1a' },
    mechanic: { initials: 'AS', name: 'Ako Sato', role: 'MECHANIC', color: '#3f6d8e' },
    lookout: { initials: 'MC', name: 'Mika Chen', role: 'LOOKOUT', color: '#7a4fd0' },
  };
  document.querySelectorAll('.crewCard').forEach((card) => {
    const c = CREW[card.dataset.role];
    if (!c) return;
    const face = card.querySelector('.crewFace');
    const name = card.querySelector('.crewName');
    const role = card.querySelector('.crewRole');
    if (face) { face.textContent = c.initials; face.style.background = c.color; }
    if (name) name.textContent = c.name;
    if (role) role.textContent = c.role;
  });

  // --- helpers on G -----------------------------------------------------------
  let toastTimer = 0, bannerTimer = 0, briefTimer = 0;
  G.toast = (msg) => {
    if (!E.toast) return;
    E.toast.textContent = msg;
    E.toast.style.display = 'block';
    E.toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { E.toast.style.display = 'none'; }, 3000);
  };
  G.banner = (text) => {
    if (!E.banner) return;
    E.banner.textContent = text;
    E.banner.style.display = 'block';
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => { E.banner.style.display = 'none'; }, 2500);
  };
  G.showBriefing = (giverId, line) => {
    if (!E.briefing) return;
    const giver = CAST[giverId];
    const chip = E.briefing.querySelector('.giverChip');
    const nameEl = E.briefing.querySelector('.giver');
    const lineEl = E.briefing.querySelector('.line');
    if (chip) {
      chip.textContent = (giver?.name || giverId || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      chip.style.background = giver?.outfit?.topColor ? '#' + giver.outfit.topColor.toString(16).padStart(6, '0') : '#444';
    }
    if (nameEl) nameEl.textContent = giver?.name || giverId || '';
    if (lineEl) lineEl.textContent = line || '';
    E.briefing.style.display = 'block';
    clearTimeout(briefTimer);
    briefTimer = setTimeout(() => { E.briefing.style.display = 'none'; }, 5000);
  };

  // --- pause / big map ----------------------------------------------------------
  G.togglePause = () => {
    if (!E.pauseMenu) return;
    if (G.paused) {
      E.pauseMenu.style.display = 'block';
      drawBigMap();
      fillLegend();
    } else {
      E.pauseMenu.style.display = 'none';
    }
  };
  function fillLegend() {
    if (!E.mapLegend || E.mapLegend.dataset.filled) return;
    E.mapLegend.dataset.filled = '1';
    E.mapLegend.innerHTML = [
      '<span class="lgChip"><b style="color:#fff">➤</b> You</span>',
      '<span class="lgChip"><b style="color:#ffd23f">■</b> Objective</span>',
      '<span class="lgChip"><b>G</b> Garage</span>',
      '<span class="lgChip"><b>⌂</b> HQ</span>',
      '<span class="lgChip"><b style="color:#57b7ff">●</b> RBPD</span>',
      '<span class="lgChip"><b style="color:#ff4fd8">━</b> Route</span>',
    ].join(' ');
  }
  if (G.flags.openPauseMap && E.pauseMenu) {
    E.pauseMenu.style.display = 'block';
    drawBigMap();
    fillLegend();
  }

  // --- shared map drawing ---------------------------------------------------------
  function drawMapBase(ctx, W, H, toMap, view, opts) {
    // (1) water
    ctx.fillStyle = '#2f6fb4';
    ctx.fillRect(0, 0, W, H);
    if (opts.waves) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const y = (i / 14) * H + ((i * 37) % 23);
        ctx.beginPath();
        for (let x = 0; x <= W; x += 32) ctx.lineTo(x, y + Math.sin(x * 0.05 + i) * 2.5);
        ctx.stroke();
      }
    }
    // (2) land island
    const [lx0, ly0] = toMap(-CFG.half, -CFG.half);
    const [lx1, ly1] = toMap(CFG.half, CFG.half);
    ctx.fillStyle = '#d9c9a3';
    ctx.fillRect(Math.min(lx0, lx1), Math.min(ly0, ly1), Math.abs(lx1 - lx0), Math.abs(ly1 - ly0));
    // (3) beach band at the island south edge (z 560..660)
    const [bx0, by0] = toMap(-CFG.half, 560);
    const [bx1, by1] = toMap(CFG.half, 660);
    ctx.fillStyle = '#e8d9ab';
    ctx.fillRect(Math.min(bx0, bx1), Math.min(by0, by1), Math.abs(bx1 - bx0), Math.abs(by1 - by0));
    // (4) district washes
    for (const d of DISTRICTS) {
      const [dx0, dy0] = toMap(d.cx - 330, d.cz - 330);
      const [dx1, dy1] = toMap(d.cx + 330, d.cz + 330);
      ctx.fillStyle = d.accent;
      ctx.globalAlpha = opts.washAlpha;
      ctx.fillRect(Math.min(dx0, dx1), Math.min(dy0, dy1), Math.abs(dx1 - dx0), Math.abs(dy1 - dy0));
      ctx.globalAlpha = 1;
      if (opts.labels) {
        const [cx, cy] = toMap(d.cx, d.cz);
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        const label = d.name.toUpperCase();
        ctx.strokeText(label, cx, cy);
        ctx.fillStyle = '#4a3b28';
        ctx.fillText(label, cx, cy);
      }
    }
    // (5) parks
    ctx.fillStyle = '#a9bd7a';
    for (const pr of [[200, 380, 300, 470], [-520, -300, -430, -210]]) {
      const [px0, py0] = toMap(pr[0], pr[1]);
      const [px1, py1] = toMap(pr[2], pr[3]);
      ctx.fillRect(Math.min(px0, px1), Math.min(py0, py1), Math.abs(px1 - px0), Math.abs(py1 - py0));
    }
    // (6) blocks between adjacent road lines
    ctx.fillStyle = '#cdbb92';
    const xs = G.roadX, zs = G.roadZ, hw = CFG.roadW / 2;
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < zs.length - 1; j++) {
        const [ax, ay] = toMap(xs[i] + hw, zs[j] + hw);
        const [bx2, by2] = toMap(xs[i + 1] - hw, zs[j + 1] - hw);
        const x0 = Math.min(ax, bx2), y0 = Math.min(ay, by2);
        const w = Math.abs(bx2 - ax), h = Math.abs(by2 - ay);
        if (x0 + w < 0 || y0 + h < 0 || x0 > W || y0 > H) continue;
        ctx.fillRect(x0, y0, w, h);
      }
    }
    // (7) roads: casing then surface
    const scale = Math.abs(toMap(1, 0)[0] - toMap(0, 0)[0]);
    const roadPx = CFG.roadW * scale;
    ctx.lineCap = 'butt';
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? '#8f8a7c' : '#e9e4d8';
      ctx.lineWidth = pass === 0 ? roadPx + 2 : roadPx;
      ctx.beginPath();
      for (const x of xs) {
        const [mx] = toMap(x, 0);
        if (mx < -roadPx || mx > W + roadPx) continue;
        const [, ty] = toMap(x, -CFG.half);
        const [, by] = toMap(x, CFG.half);
        ctx.moveTo(mx, ty); ctx.lineTo(mx, by);
      }
      for (const z of zs) {
        const [, my] = toMap(0, z);
        if (my < -roadPx || my > H + roadPx) continue;
        const [tx2] = toMap(-CFG.half, z);
        const [bx3] = toMap(CFG.half, z);
        ctx.moveTo(tx2, my); ctx.lineTo(bx3, my);
      }
      ctx.stroke();
    }
    // (8) touge polyline
    if (G.touge && G.touge.length > 1) {
      ctx.strokeStyle = '#e9e4d8';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      G.touge.forEach((pt, i) => {
        const [mx, my] = toMap(pt.x, pt.z);
        if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
      });
      ctx.closePath();
      ctx.stroke();
    }
    // (9) GPS route to objective
    if (G.objective && opts.routeFrom) {
      try {
        const route = roadRoute(G, opts.routeFrom, G.objective) || [];
        if (route.length > 1) {
          ctx.strokeStyle = '#ff4fd8';
          ctx.lineWidth = 3;
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.beginPath();
          route.forEach((pt, i) => {
            const [mx, my] = toMap(pt.x, pt.z);
            if (i === 0) ctx.moveTo(mx, my); else ctx.lineTo(mx, my);
          });
          ctx.stroke();
        }
      } catch (e) { /* route optional */ }
    }
  }

  function chip(ctx, x, y, size, bg, letter, fg) {
    ctx.fillStyle = bg;
    const s = size;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - s / 2, y - s / 2, s, s, 3); else ctx.rect(x - s / 2, y - s / 2, s, s);
    ctx.fill();
    ctx.fillStyle = fg || '#14100a';
    ctx.font = `bold ${Math.round(s * 0.72)}px Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(letter, x, y + 1);
  }

  function drawBlips(ctx, toMap, t, opts) {
    const p = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    // HQ
    {
      const [hx, hy] = toMap(G.hq.x, G.hq.z);
      chip(ctx, hx, hy, opts.chipSize, '#ffffff', '⌂');
    }
    // Garage
    {
      const [gx, gy] = toMap(G.hq.garage.x, G.hq.garage.z);
      chip(ctx, gx, gy, opts.chipSize, '#2b2f36', 'G', '#ffffff');
    }
    // Cops
    if (G.cops) {
      for (const v of G.cops) {
        const [cx, cy] = toMap(v.x, v.z);
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2e6fb7'; ctx.fill();
        const flash = 0.35 + 0.65 * Math.abs(Math.sin(t * 5));
        ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,60,60,${flash.toFixed(2)})`;
        ctx.lineWidth = 2; ctx.stroke();
      }
    }
    if (G.heli?.group) {
      const hp = G.heli.group.position;
      const [hx, hy] = toMap(hp.x, hp.z);
      ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#2e6fb7'; ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', hx, hy + 0.5);
    }
    // Objective
    if (G.objective) {
      const [ox, oy] = toMap(G.objective.x, G.objective.z);
      chip(ctx, ox, oy, opts.chipSize + 2, '#ffd23f', G.objective.letter || '!');
    }
    // Player arrow (topmost)
    const [px, py] = toMap(p.x, p.z);
    const ang = G.car ? G.car.angle : G.player.angle;
    ctx.save();
    ctx.translate(px, py);
    // Arrow geometry points up (-y) = north (-z) at rotation 0. World heading
    // (sin a, cos a) maps to screen (sin a, cos a) with y down, so the canvas
    // rotation is PI - a (a=0 facing +z/south -> PI, pointing down. Correct.)
    ctx.rotate(Math.PI - ang);
    ctx.beginPath();
    const s = opts.arrowSize;
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, s * 0.75); ctx.lineTo(0, s * 0.35); ctx.lineTo(-s * 0.62, s * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#14100a'; ctx.stroke();
    ctx.restore();
  }

  function drawMinimap(t) {
    if (!mm || !E.minimap) return;
    const W = E.minimap.width, H = E.minimap.height;
    const p = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    const view = 340; // metres across
    const s = W / view;
    const toMap = (x, z) => [W / 2 + (x - p.x) * s, H / 2 + (z - p.z) * s];
    mm.save();
    mm.beginPath();
    if (mm.roundRect) mm.roundRect(0, 0, W, H, 18); else mm.rect(0, 0, W, H);
    mm.clip();
    drawMapBase(mm, W, H, toMap, view, { washAlpha: 0.07, labels: false, waves: false, routeFrom: p });
    drawBlips(mm, toMap, t, { chipSize: 13, arrowSize: 8 });
    mm.restore();
    // Frame + north label (outside clip so the corner stays crisp).
    mm.beginPath();
    if (mm.roundRect) mm.roundRect(0, 0, W, H, 18); else mm.rect(0, 0, W, H);
    mm.lineWidth = 3; mm.strokeStyle = 'rgba(10,12,16,0.85)'; mm.stroke();
    mm.fillStyle = '#ffffff';
    mm.font = 'bold 13px Arial, sans-serif';
    mm.textAlign = 'right'; mm.textBaseline = 'top';
    mm.fillText('N', W - 8, 6);
  }

  function drawBigMap() {
    if (!bm || !E.bigmap) return;
    const W = E.bigmap.width, H = E.bigmap.height;
    const margin = 46;
    const s = Math.min((W - margin * 2) / CFG.world, (H - margin * 2) / CFG.world);
    const ox = W / 2, oy = H / 2;
    const toMap = (x, z) => [ox + x * s, oy + z * s];
    const p = G.car ? { x: G.car.x, z: G.car.z } : { x: G.player.x, z: G.player.z };
    drawMapBase(bm, W, H, toMap, CFG.world, { washAlpha: 0.12, labels: true, waves: true, routeFrom: p });
    const t = performance.now() / 1000;
    drawBlips(bm, toMap, t, { chipSize: 20, arrowSize: 13 });
    // Next-mission giver letter (in addition to the objective chip).
    // Title.
    bm.fillStyle = '#2c2114';
    bm.font = 'bold 34px Arial, sans-serif';
    bm.textAlign = 'left'; bm.textBaseline = 'top';
    try { bm.letterSpacing = '6px'; } catch (e) {}
    bm.fillText('RONIN BAY', 22, 16);
    try { bm.letterSpacing = '0px'; } catch (e) {}
  }

  // --- speedometer -----------------------------------------------------------------
  let nosVal = 1;
  function drawSpeedo(dt) {
    if (!sp || !E.speedo) return;
    const W = E.speedo.width, H = E.speedo.height;
    sp.clearRect(0, 0, W, H);
    const cx = W / 2, cy = 74, R = 56;
    const maxKmh = 280;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 0.75 + Math.PI * 1.5; // 240° sweep
    // Dial face.
    sp.beginPath(); sp.arc(cx, cy, R + 8, 0, Math.PI * 2);
    sp.fillStyle = 'rgba(10,12,18,0.72)'; sp.fill();
    // Redline zone >220.
    sp.beginPath();
    sp.arc(cx, cy, R, a0 + (220 / maxKmh) * (a1 - a0), a1);
    sp.strokeStyle = '#e33b3b'; sp.lineWidth = 5; sp.stroke();
    // Ticks every 20.
    sp.fillStyle = '#e8e8e8';
    sp.font = '9px Arial, sans-serif';
    sp.textAlign = 'center'; sp.textBaseline = 'middle';
    for (let v = 0; v <= maxKmh; v += 20) {
      const a = a0 + (v / maxKmh) * (a1 - a0);
      const x1 = cx + Math.cos(a) * (R - 4), y1 = cy + Math.sin(a) * (R - 4);
      const x2 = cx + Math.cos(a) * R, y2 = cy + Math.sin(a) * R;
      sp.beginPath(); sp.moveTo(x1, y1); sp.lineTo(x2, y2);
      sp.strokeStyle = v > 220 ? '#e33b3b' : '#cfcfcf'; sp.lineWidth = 2; sp.stroke();
      if (v % 40 === 0) {
        const tx = cx + Math.cos(a) * (R - 13), ty = cy + Math.sin(a) * (R - 13);
        sp.fillText(String(v), tx, ty);
      }
    }
    // Needle.
    const kmh = Math.min(maxKmh, Math.abs(G.speedKmh || 0));
    const na = a0 + (kmh / maxKmh) * (a1 - a0);
    sp.beginPath();
    sp.moveTo(cx - Math.cos(na) * 8, cy - Math.sin(na) * 8);
    sp.lineTo(cx + Math.cos(na) * (R - 8), cy + Math.sin(na) * (R - 8));
    sp.strokeStyle = '#ff7a1a'; sp.lineWidth = 3; sp.stroke();
    sp.beginPath(); sp.arc(cx, cy, 4.5, 0, Math.PI * 2);
    sp.fillStyle = '#f2f2f2'; sp.fill();
    // Digital readout.
    sp.fillStyle = '#ffffff';
    sp.font = 'bold 19px Arial, sans-serif';
    sp.fillText(String(Math.round(kmh)), cx, cy + 26);
    sp.font = '8px Arial, sans-serif';
    sp.fillStyle = '#aab';
    sp.fillText('km/h', cx, cy + 38);
    // NOS bar.
    if (G.flags.nosActive) nosVal = Math.max(0, nosVal - dt * 0.45);
    else nosVal = Math.min(1, nosVal + dt * 0.12);
    const bw = 74, bx = cx - bw / 2, by = H - 14;
    sp.fillStyle = 'rgba(255,255,255,0.18)';
    sp.fillRect(bx, by, bw, 6);
    sp.fillStyle = '#37c8ff';
    sp.fillRect(bx, by, bw * nosVal, 6);
    sp.fillStyle = '#9adfff';
    sp.font = 'bold 8px Arial, sans-serif';
    sp.fillText('NOS', cx, by - 6);
    // DRIFT indicator.
    if (G.flags.drifting) {
      sp.beginPath(); sp.arc(W - 16, 14, 5, 0, Math.PI * 2);
      sp.fillStyle = '#e879ff'; sp.fill();
      sp.fillStyle = '#e879ff';
      sp.font = 'bold 8px Arial, sans-serif';
      sp.fillText('DRIFT', W - 16, 26);
    }
  }

  // --- garage panel ---------------------------------------------------------------------
  let garageWasOpen = false, garageRefresh = 0;
  function renderGarage() {
    if (!E.garagePanel) return;
    const list = G.garageList || [];
    let html = '<div class="garageTitle">HQ GARAGE — RONIN BAY</div>';
    list.slice(0, 9).forEach((item, i) => {
      const price = item.owned ? 'OWNED' : fmtMoney(item.price);
      const cur = item.current ? ' ▶' : '';
      html += `<div class="garageRow${item.current ? ' current' : ''}"><span>${i + 1}. ${item.name}${cur}</span><span>${price}</span></div>`;
    });
    html += '<div class="garageFoot">1-9 select · E close</div>';
    E.garagePanel.innerHTML = html;
    E.garagePanel.style.display = 'block';
  }

  // --- per-frame + slow updates -------------------------------------------------------------
  const cache = {};
  function setText(elm, key, val) {
    if (!elm) return;
    if (cache[key] !== val) { cache[key] = val; elm.textContent = val; }
  }
  let slowT = 0;

  G.updaters.push((G2, dt) => {
    const t = performance.now() / 1000;
    // Stats.
    setText(E.money, 'money', fmtMoney(G.money));
    setText(E.rep, 'rep', String(Math.round(G.rep || 0)));
    setText(E.rank, 'rank', CLUB_RANKS[G.rankIdx || 0] || 'Rookie');
    if (E.stars) {
      const n = Math.round(G.wanted || 0);
      E.stars.style.display = n > 0 ? 'block' : 'none';
      setText(E.stars, 'stars', '★'.repeat(n));
    }
    if (E.healthBar) E.healthBar.style.width = '100%';
    if (E.carBar) E.carBar.style.width = `${Math.max(0, Math.min(100, G.car ? (G.car.health ?? 100) : 100))}%`;
    // Objective line.
    if (E.objective) {
      const p = G.car ? G.car : G.player;
      if (G.objective) {
        const d = Math.round(Math.hypot(G.objective.x - p.x, G.objective.z - p.z));
        setText(E.objective, 'obj', `${G.objective.label} — ${d}m`);
      } else {
        setText(E.objective, 'obj', 'Free roam — find a letter blip');
      }
    }
    // Wasted / busted overlays.
    if (E.wasted) E.wasted.style.display = G.flags.wasted ? 'block' : 'none';
    if (E.busted) E.busted.style.display = G.flags.busted ? 'block' : 'none';
    // S24 radio chip: in car + radio on. A shot mode staging the player in
    // a car (G.shotMode set, G.car present) counts as in-car for the chip
    // even if flags.inCar was never raised by enterCar.
    if (E.radioChip) {
      let rName = G.radioName || null;
      if (!rName) {
        try {
          const cur = G.audio && G.audio.radio && G.audio.radio.current ? G.audio.radio.current() : null;
          if (cur) rName = cur.name;
        } catch (e) { /* chip stays hidden */ }
      }
      const staged = !!(G.shotMode && G.car);
      const showRadio = !!((G.flags.inCar || staged) && rName);
      E.radioChip.style.display = showRadio ? 'block' : 'none';
      if (showRadio) setText(E.radioChip, 'radio', `♪ ${rName}`);
    }

    drawMinimap(t);
    drawSpeedo(dt);
    if (G.paused && E.pauseMenu && E.pauseMenu.style.display !== 'none') drawBigMap();

    // Garage panel on flip + refresh while open.
    if (G.flags.garageOpen && !garageWasOpen) renderGarage();
    if (!G.flags.garageOpen && garageWasOpen && E.garagePanel) E.garagePanel.style.display = 'none';
    garageWasOpen = !!G.flags.garageOpen;
    if (G.flags.garageOpen) {
      garageRefresh -= dt;
      if (garageRefresh <= 0) { garageRefresh = 0.5; renderGarage(); }
    }

    // Slow (4x/sec) panels.
    slowT -= dt;
    if (slowT <= 0) {
      slowT = 0.25;
      // Mission card.
      const next = (typeof G.missionIndex === 'number' && G.missionIndex < MISSIONS.length) ? MISSIONS[G.missionIndex] : null;
      if (E.card) {
        const showCard = !!(next || G.missionProg);
        E.card.style.display = showCard ? 'block' : 'none';
        if (showCard && next) {
          const giver = CAST[next.giver];
          if (E.cardPortrait) {
            E.cardPortrait.textContent = (giver?.name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
            E.cardPortrait.style.background = giver?.outfit?.topColor ? '#' + giver.outfit.topColor.toString(16).padStart(6, '0') : '#555';
          }
          setText(E.cardGiver, 'giver', giver?.name || next.giver || '');
          setText(E.cardText, 'cardText', `${next.title} — ${next.blurb}`);
        }
        setText(E.cardProg, 'prog', G.missionProg || 'Go to the blip');
      }
      // Crew statuses.
      const statuses = {
        driver: G.car && G.flags.inCar ? (G.car.spec?.name || G.car.specId || 'Driving') : 'On foot',
        mechanic: !G.car || !G.flags.inCar ? '—' : ((G.car.health ?? 100) > 70 ? 'Ready' : (G.car.health ?? 100) >= 30 ? 'Damaged' : 'Wrecked'),
        lookout: (G.wanted || 0) > 0 ? 'RBPD ACTIVE' : (next ? `Next: ${next.title}` : 'Clear'),
      };
      document.querySelectorAll('.crewCard').forEach((card) => {
        const st = card.querySelector('.crewStatus');
        if (st && statuses[card.dataset.role] !== undefined) st.textContent = statuses[card.dataset.role];
      });
      // Cop panel.
      if (E.copPanel && E.copRows) {
        const show = (G.wanted || 0) >= 1;
        E.copPanel.style.display = show ? 'block' : 'none';
        if (show) {
          const p = G.car ? { x: G.car.x, z: G.car.z, angle: G.car.angle } : { x: G.player.x, z: G.player.z, angle: G.player.angle };
          const units = [];
          for (const v of G.cops || []) {
            units.push({
              name: v.specId === 'police-suv' ? 'RBPD Enforcer' : 'RBPD Interceptor',
              d: Math.hypot(v.x - p.x, v.z - p.z),
              v,
            });
          }
          if (G.heli?.group) {
            const hp = G.heli.group.position;
            units.push({ name: 'RBPD Air Unit', d: Math.hypot(hp.x - p.x, hp.z - p.z), heli: true });
          }
          units.sort((a, b) => a.d - b.d);
          const header = `<div class="copHead">RBPD RESPONSE — ${units.length} UNITS</div>`;
          const rows = units.slice(0, 4).map((u) => {
            let tactic = 'PURSUIT';
            if (u.heli) tactic = 'TRACKING';
            else if (u.v) {
              const ahead = Math.cos((u.v.angle || 0) - (p.angle || 0));
              const toPlayer = Math.atan2(p.x - u.v.x, p.z - u.v.z);
              const closing = Math.abs(((toPlayer - (u.v.angle || 0) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 2.4 && (u.v.speed || 0) > 12;
              if (u.d < 14 && closing) tactic = 'RAMMING';
              else if (ahead > 0.3 && u.d < 60) tactic = 'INTERCEPT';
            }
            return `<div class="copRow"><span>${u.name}</span><span>${Math.round(u.d)}m</span><span>${tactic}</span></div>`;
          }).join('');
          E.copRows.innerHTML = header + rows;
        }
      }
    }
  });
}
