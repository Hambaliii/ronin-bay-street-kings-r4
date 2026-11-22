// audio.js — STREET SAMURAI WebAudio synth engine.
// Everything is synthesized (no external files): engine, skid, siren, UI
// blips and a lookahead-scheduled synthwave loop. Fully defensive — a
// headless screenshot context (no AudioContext, suspended context, missing
// game state) must never throw. No Math.random: noise comes from a seeded
// LCG so behaviour is deterministic.

function clamp01(v) {
  v = Number(v);
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function nowSec() {
  try {
    if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
  } catch (e) { /* fall through */ }
  return Date.now() / 1000;
}

// Position of a game object, whatever shape S1/S2 gave it.
function posOf(o) {
  if (!o || typeof o !== 'object') return null;
  const cands = [o.position, o.pos, o.group && o.group.position, o.mesh && o.mesh.position, o];
  for (const c of cands) {
    if (c && Number.isFinite(c.x) && Number.isFinite(c.z)) return c;
  }
  return null;
}

export function initAudio(G) {
  try {
    if (!G || typeof G !== 'object') return;
    if (G.__audioInit) return;
    G.__audioInit = true;

    const S = {
      ctx: null,
      master: null,
      musicBus: null,
      noiseBuf: null,
      // engine
      engOsc1: null, engOsc2: null, engFilter: null, engGain: null,
      engOn: false, engRpm: 0, engRpmCur: 0, engGainCur: 0, lastSetEngine: -10,
      // skid / screech (S24): explicit screech() wins over the drifting poll
      skidSrc: null, skidFilter: null, skidGain: null, skidCur: 0,
      screechOn: false, screechInt: 0, lastScreech: -10,
      // crash (S24): last scaled-thud time (ctx clock) for the 120 ms debounce
      lastCrashAt: -10,
      // radio (S24)
      radioBus: null, radioFilter: null,
      radioOn: false, radioIdx: 0, radioStep: 0, radioNextAt: 0, radioTimer: null,
      // siren
      sirOsc: null, sirGain: null, sirCur: 0,
      // music
      musicStarted: false, step: 0, nextStepAt: 0,
      // poll state
      prevCrash: 0,
      // horn (S23): start/stop pair so drive.js can sustain while H is held
      hornOsc1: null, hornOsc2: null, hornFilter: null, hornGain: null,
      hornOn: false, hornTimer: null,
    };

    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;

    function makeNoiseBuffer(ctx) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (seed / 0x40000000) - 1;
      }
      return buf;
    }

    function ensureCtx() {
      if (S.ctx) return S.ctx;
      if (!AC) return null;
      try {
        const ctx = new AC();
        S.ctx = ctx;
        S.master = ctx.createGain();
        S.master.gain.value = api.muted ? 0 : 0.5;
        S.master.connect(ctx.destination);
        S.musicBus = ctx.createGain();
        S.musicBus.gain.value = 0.05;
        S.musicBus.connect(S.master);
        // S24 radio bus: modest master level + a shared lowpass that the
        // bass voices of every station are routed through.
        S.radioBus = ctx.createGain();
        S.radioBus.gain.value = 0.16;
        S.radioBus.connect(S.master);
        S.radioFilter = ctx.createBiquadFilter();
        S.radioFilter.type = 'lowpass';
        S.radioFilter.frequency.value = 950;
        S.radioFilter.Q.value = 1;
        S.radioFilter.connect(S.radioBus);
        S.noiseBuf = makeNoiseBuffer(ctx);
        buildEngine(ctx);
        buildSkid(ctx);
        buildSiren(ctx);
        return ctx;
      } catch (e) {
        S.ctx = null;
        return null;
      }
    }

    function buildEngine(ctx) {
      try {
        S.engOsc1 = ctx.createOscillator();
        S.engOsc1.type = 'sawtooth';
        S.engOsc2 = ctx.createOscillator();
        S.engOsc2.type = 'square';
        S.engOsc2.detune.value = 9;
        S.engFilter = ctx.createBiquadFilter();
        S.engFilter.type = 'lowpass';
        S.engFilter.frequency.value = 400;
        S.engFilter.Q.value = 2;
        S.engGain = ctx.createGain();
        S.engGain.gain.value = 0;
        S.engOsc1.connect(S.engFilter);
        S.engOsc2.connect(S.engFilter);
        S.engFilter.connect(S.engGain);
        S.engGain.connect(S.master);
        S.engOsc1.frequency.value = 60;
        S.engOsc2.frequency.value = 60;
        S.engOsc1.start();
        S.engOsc2.start();
      } catch (e) { /* engine stays silent */ }
    }

    function buildSkid(ctx) {
      try {
        S.skidSrc = ctx.createBufferSource();
        S.skidSrc.buffer = S.noiseBuf;
        S.skidSrc.loop = true;
        S.skidFilter = ctx.createBiquadFilter();
        S.skidFilter.type = 'bandpass';
        S.skidFilter.frequency.value = 900; // S24 screech centre
        S.skidFilter.Q.value = 2;
        S.skidGain = ctx.createGain();
        S.skidGain.gain.value = 0;
        S.skidSrc.connect(S.skidFilter);
        S.skidFilter.connect(S.skidGain);
        S.skidGain.connect(S.master);
        S.skidSrc.start();
      } catch (e) { /* skid stays silent */ }
    }

    function buildSiren(ctx) {
      try {
        S.sirOsc = ctx.createOscillator();
        S.sirOsc.type = 'square';
        S.sirOsc.frequency.value = 720;
        S.sirGain = ctx.createGain();
        S.sirGain.gain.value = 0;
        S.sirOsc.connect(S.sirGain);
        S.sirGain.connect(S.master);
        S.sirOsc.start();
      } catch (e) { /* siren stays silent */ }
    }

    // One enveloped tone. f0->f1 glide over dur, starting at `when`.
    function tone(type, f0, f1, when, dur, vol, dest) {
      const ctx = S.ctx;
      if (!ctx) return;
      try {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(Math.max(20, f0), when);
        if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), when + dur);
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(vol, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        o.connect(g);
        g.connect(dest || S.master);
        o.start(when);
        o.stop(when + dur + 0.05);
      } catch (e) { /* ignore */ }
    }

    function noiseHit(when, dur, vol, filterFreq, type) {
      const ctx = S.ctx;
      if (!ctx || !S.noiseBuf) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = S.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = type || 'lowpass';
        f.frequency.value = filterFreq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        src.connect(f);
        f.connect(g);
        g.connect(S.master);
        src.start(when);
        src.stop(when + dur + 0.05);
      } catch (e) { /* ignore */ }
    }

    // Noise burst routed to an explicit destination (radio bus voices).
    function noiseTo(when, dur, vol, filterFreq, type, dest) {
      const ctx = S.ctx;
      if (!ctx || !S.noiseBuf) return;
      try {
        const src = ctx.createBufferSource();
        src.buffer = S.noiseBuf;
        src.playbackRate.value = 0.7 + ((when * 7) % 1) * 0.6; // deterministic variety
        const f = ctx.createBiquadFilter();
        f.type = type || 'lowpass';
        f.frequency.value = filterFreq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(vol, when);
        g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
        src.connect(f);
        f.connect(g);
        g.connect(dest || S.master);
        src.start(when);
        src.stop(when + dur + 0.05);
      } catch (e) { /* ignore */ }
    }

    // ---- S24 scaled crash thud -----------------------------------------
    // Sine pitch drop 90 -> 35 Hz + a lowpassed noise burst, both scaled
    // by intensity01. Shared 120 ms debounce (ctx clock) so the crashTimer
    // poll in update() and an explicit drive.js crash() call for the same
    // impact can never double up.
    function crashSound(intensity01) {
      try {
        const ctx = ensureCtx();
        if (!ctx) return;
        const inten = Math.max(0.15, clamp01(intensity01));
        const t = ctx.currentTime;
        if (t - S.lastCrashAt < 0.12) return;
        S.lastCrashAt = t;
        const at = t + 0.005;
        noiseHit(at, 0.26, 0.5 * inten, 300 + 260 * inten, 'lowpass');
        tone('sine', 90, 35, at, 0.32, 0.48 * inten);
      } catch (e) { /* never throw */ }
    }
    function crash(intensity01) { crashSound(intensity01); }

    // ---- S24 tire screech ------------------------------------------------
    // Explicit control for the bandpassed-noise skid voice (900 Hz, Q 2).
    // drive.js calls this per frame while drifting / handbrake-sliding;
    // update() falls back to flags.drifting when calls go silent (>300 ms).
    function screech(active, intensity01) {
      try {
        S.screechOn = !!active;
        S.screechInt = clamp01(intensity01);
        S.lastScreech = nowSec();
        if (active) {
          const ctx = ensureCtx();
          if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        }
      } catch (e) { /* never throw */ }
    }

    function play(name) {
      try {
        const ctx = ensureCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
        const t = ctx.currentTime + 0.01;
        switch (name) {
          case 'click':
            tone('square', 880, 660, t, 0.06, 0.07);
            break;
          case 'cash':
            tone('sine', 988, 988, t, 0.08, 0.12);
            tone('sine', 1319, 1319, t + 0.08, 0.14, 0.12);
            break;
          case 'win': {
            const notes = [523, 659, 784, 1047];
            for (let i = 0; i < notes.length; i++) tone('triangle', notes[i], notes[i], t + i * 0.09, 0.16, 0.13);
            break;
          }
          case 'fail': {
            const notes = [392, 330, 262];
            for (let i = 0; i < notes.length; i++) tone('sawtooth', notes[i], notes[i], t + i * 0.13, 0.16, 0.07);
            break;
          }
          case 'busted':
            tone('sawtooth', 900, 280, t, 0.8, 0.1);
            tone('sawtooth', 905, 285, t, 0.8, 0.05);
            break;
          case 'pickup':
            tone('sine', 660, 990, t, 0.09, 0.1);
            break;
          case 'crash':
            crashSound(0.75);
            break;
          case 'shot': // pistol: noise burst + square blip pitch drop, ~120ms
            noiseHit(t, 0.12, 0.3, 900, 'lowpass');
            tone('square', 220, 55, t, 0.12, 0.16);
            break;
          case 'smg': // shorter burst, ~70ms
            noiseHit(t, 0.07, 0.22, 1100, 'lowpass');
            tone('square', 260, 70, t, 0.07, 0.12);
            break;
          case 'dry': // empty click
            tone('square', 1200, 900, t, 0.03, 0.06);
            break;
          case 'reload': // two clicks
            tone('square', 700, 500, t, 0.04, 0.09);
            tone('square', 950, 650, t + 0.13, 0.04, 0.09);
            break;
          case 'swing': // filtered noise whoosh
            noiseHit(t, 0.18, 0.12, 700, 'bandpass');
            break;
          case 'thud': // low sine thump
            tone('sine', 90, 40, t, 0.15, 0.3);
            break;
          default:
            break;
        }
      } catch (e) { /* never throw */ }
    }

    // ---- S23 car horn -------------------------------------------------
    // Classic dual-tone horn: two detuned oscillators (~370 Hz + ~440 Hz)
    // through a lowpass + gain envelope (attack 0.01, sustain while held,
    // release 0.08). hornStart/hornStop is the primary API (long-press);
    // horn(dur) is a one-shot convenience that auto-stops after dur secs.
    function hornStart() {
      try {
        if (S.hornOn) return;
        const ctx = ensureCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }
        if (S.hornTimer) { clearTimeout(S.hornTimer); S.hornTimer = null; }
        const t = ctx.currentTime;
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 370;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 440; o2.detune.value = 4;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.Q.value = 1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.01);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(S.master);
        o1.start(t); o2.start(t);
        S.hornOsc1 = o1; S.hornOsc2 = o2; S.hornFilter = f; S.hornGain = g;
        S.hornOn = true;
      } catch (e) { /* never throw */ }
    }
    function hornStop() {
      try {
        if (!S.hornOn) return;
        S.hornOn = false;
        if (S.hornTimer) { clearTimeout(S.hornTimer); S.hornTimer = null; }
        const ctx = S.ctx;
        const o1 = S.hornOsc1, o2 = S.hornOsc2, g = S.hornGain;
        S.hornOsc1 = null; S.hornOsc2 = null; S.hornFilter = null; S.hornGain = null;
        if (!ctx || !g) { try { o1 && o1.stop(); } catch (e) {} try { o2 && o2.stop(); } catch (e) {} return; }
        const t = ctx.currentTime;
        try {
          g.gain.cancelScheduledValues(t);
          g.gain.setValueAtTime(g.gain.value, t);
          g.gain.linearRampToValueAtTime(0, t + 0.08);
          if (o1) o1.stop(t + 0.1);
          if (o2) o2.stop(t + 0.1);
        } catch (e) { /* ignore */ }
      } catch (e) { /* never throw */ }
    }
    function horn(dur) {
      try {
        const d = Number.isFinite(dur) && dur > 0 ? Math.min(dur, 1.2) : 0.35;
        hornStart();
        if (S.hornTimer) clearTimeout(S.hornTimer);
        S.hornTimer = setTimeout(() => { S.hornTimer = null; hornStop(); }, d * 1000);
      } catch (e) { /* never throw */ }
    }

    function setEngine(on, rpm01) {
      try {
        S.engOn = !!on;
        S.engRpm = clamp01(rpm01);
        S.lastSetEngine = nowSec();
        if (on) {
          const ctx = ensureCtx();
          if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        }
      } catch (e) { /* never throw */ }
    }

    function resume() {
      try {
        const ctx = ensureCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      } catch (e) { /* never throw */ }
    }

    function toggleMute() {
      try {
        api.muted = !api.muted;
        const ctx = ensureCtx();
        if (ctx && S.master) {
          const t = ctx.currentTime;
          S.master.gain.cancelScheduledValues(t);
          S.master.gain.setTargetAtTime(api.muted ? 0 : 0.5, t, 0.05);
        }
      } catch (e) { /* never throw */ }
      return api.muted;
    }

    // ------------------------------------------------------------- music
    // Synthwave loop, 100 BPM, 8th-note steps, 4 bars of 8 steps:
    // Am - F - C - G. Bass roots (MIDI), pad chords (MIDI).
    const STEP_DUR = 60 / 100 / 2;
    const ROOTS = [33, 29, 36, 31]; // A1 F1 C2 G1
    const CHORDS = [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
    ];
    const mf = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

    function scheduleStep(step, when) {
      const bar = Math.floor(step / 8) % 4;
      const s = step % 8;
      const root = ROOTS[bar];
      // bass: driving 8ths, octave pop on step 4
      if (s % 2 === 0) {
        const m = s === 4 ? root + 12 : root;
        tone('sawtooth', mf(m), mf(m), when, 0.22, 0.16, S.musicBus);
      } else if (s === 7) {
        tone('sawtooth', mf(root + 7), mf(root + 7), when, 0.14, 0.1, S.musicBus);
      }
      // pad: whole-bar chord at bar start
      if (s === 0) {
        for (const m of CHORDS[bar]) {
          const ctx = S.ctx;
          try {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = mf(m);
            g.gain.setValueAtTime(0, when);
            g.gain.linearRampToValueAtTime(0.05, when + 0.4);
            g.gain.setValueAtTime(0.05, when + STEP_DUR * 8 - 0.4);
            g.gain.linearRampToValueAtTime(0, when + STEP_DUR * 8);
            o.connect(g);
            g.connect(S.musicBus);
            o.start(when);
            o.stop(when + STEP_DUR * 8 + 0.05);
          } catch (e) { /* ignore */ }
        }
      }
      // hats: offbeat noise ticks
      if (s % 2 === 1) {
        try {
          const ctx = S.ctx;
          const src = ctx.createBufferSource();
          src.buffer = S.noiseBuf;
          const f = ctx.createBiquadFilter();
          f.type = 'highpass';
          f.frequency.value = 6000;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.25, when);
          g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
          src.connect(f);
          f.connect(g);
          g.connect(S.musicBus);
          src.start(when);
          src.stop(when + 0.06);
        } catch (e) { /* ignore */ }
      }
    }

    // ------------------------------------------------------------- radio (S24)
    // Car radio: a lightweight 16th-note step sequencer on the WebAudio
    // clock. A 100 ms interval schedules 200 ms ahead (lookahead), the
    // same discipline as pumpMusic's per-frame pump. Three stations, each
    // a procedural loop from compact pattern data (MIDI note tables) plus
    // shared voice helpers (kick / hat / pad / bass below). State is kept
    // even when no AudioContext exists (headless capture) so current()
    // still reports the station for the HUD chip.
    const RADIO_STATIONS = [
      { name: 'WAVEFORM FM', bpm: 100, kind: 'wave' },
      { name: 'LOFI BAY', bpm: 76, kind: 'lofi' },
      { name: 'EUROBEAT KAI', bpm: 150, kind: 'euro' },
    ];
    // Lo-fi progression: Fmaj7 - Dm7 - Cmaj7 - Em7 (chord tones + roots).
    const LOFI_CHORDS = [
      [53, 57, 60, 64], [50, 53, 57, 60], [48, 52, 55, 59], [52, 55, 59, 62],
    ];
    const LOFI_ROOTS = [29, 26, 24, 28];
    // Eurobeat: Am - Am - F - G roots, and a catchy 2-bar saw lead phrase
    // (MIDI, 0 = rest), replayed over bars 0-1 then 2-3.
    const EURO_ROOTS = [33, 33, 29, 31];
    const EURO_LEAD = [
      69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 76, 0, 79, 0, 76, 0,
      69, 0, 72, 0, 76, 0, 81, 0, 79, 76, 74, 0, 72, 0, 0, 0,
    ];

    function radioKick(when, vol) { tone('sine', 130, 45, when, 0.14, vol, S.radioBus); }
    function radioHat(when, vol, dur) { noiseTo(when, dur || 0.04, vol, 6500, 'highpass', S.radioBus); }
    function radioBass(when, midi, dur, vol) { tone('sawtooth', mf(midi), mf(midi), when, dur, vol, S.radioFilter); }
    // Pad chord: detuned triangle pair per note, slow attack, whole length.
    function radioPad(when, midis, dur, vol, detuneCents) {
      const ctx = S.ctx;
      if (!ctx) return;
      for (const m of midis) {
        for (const det of [-1, 1]) {
          try {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = 'triangle';
            o.frequency.value = mf(m);
            o.detune.value = det * (detuneCents || 6);
            g.gain.setValueAtTime(0, when);
            g.gain.linearRampToValueAtTime(vol, when + Math.min(0.4, dur * 0.3));
            g.gain.setValueAtTime(vol, when + Math.max(0, dur - 0.35));
            g.gain.linearRampToValueAtTime(0, when + dur);
            o.connect(g);
            g.connect(S.radioBus);
            o.start(when);
            o.stop(when + dur + 0.05);
          } catch (e) { /* ignore */ }
        }
      }
    }

    function scheduleRadioStep(step, when) {
      const st = RADIO_STATIONS[S.radioIdx];
      if (!st || !S.ctx) return;
      const stepDur = 60 / st.bpm / 4; // 16ths
      const barDur = stepDur * 16;
      const bar = Math.floor(step / 16);
      const s = step % 16;
      if (st.kind === 'wave') {
        const b4 = bar % 4;
        const root = ROOTS[b4];
        if (s % 2 === 0) radioBass(when, s === 8 ? root + 12 : root, 0.22, 0.5); // 8th pulse
        if (s === 0) radioPad(when, CHORDS[b4], barDur, 0.055, 7); // whole-note pads
        const arpNotes = CHORDS[b4];
        const am = arpNotes[s % 3] + 12 + (s % 8 === 6 ? 7 : 0); // 16th sparkle
        tone('square', mf(am), mf(am), when, 0.09, 0.07, S.radioBus);
        if (s % 4 === 2) radioHat(when, 0.1);
      } else if (st.kind === 'lofi') {
        const b4 = bar % 4;
        if (s === 0) {
          // jazzy 7ths, slight detune LFO (per-bar phase, deterministic)
          radioPad(when, LOFI_CHORDS[b4], barDur, 0.085, 5 + Math.sin(bar * 1.7) * 4);
          tone('triangle', mf(LOFI_ROOTS[b4] + 12), mf(LOFI_ROOTS[b4] + 12), when, barDur * 0.9, 0.22, S.radioBus);
        }
        if (s === 0 || s === 10) radioKick(when, 0.32); // soft, laid-back kick
        if (s === 4 || s === 12) noiseTo(when, 0.09, 0.09, 1800, 'bandpass', S.radioBus); // brush snare
        if (s % 4 === 2) radioHat(when, 0.045);
        if (s % 2 === 0) noiseTo(when, 0.02, 0.014, 1600, 'lowpass', S.radioBus); // vinyl crackle
      } else { // euro
        const b4 = bar % 4;
        const root = EURO_ROOTS[b4];
        if (s % 4 === 0) radioKick(when, 0.5); // four on the floor
        if (s % 4 === 2) radioBass(when, root + 12, 0.16, 0.42); // offbeat bass
        if (s % 4 === 2) radioHat(when, 0.13, 0.07); // open offbeat hat
        else if (s % 2 === 0) radioHat(when, 0.04);
        if (s === 0) radioPad(when, CHORDS[b4 === 1 ? 0 : b4], stepDur * 4, 0.04, 5); // stab
        const lead = EURO_LEAD[(bar % 2) * 16 + s];
        if (lead) tone('sawtooth', mf(lead), mf(lead), when, 0.17, 0.16, S.radioBus);
      }
    }

    function pumpRadio() {
      const ctx = S.ctx;
      if (!ctx || !S.radioOn) return;
      if (ctx.state !== 'running') return;
      const st = RADIO_STATIONS[S.radioIdx];
      const stepDur = 60 / st.bpm / 4;
      if (S.radioNextAt < ctx.currentTime) S.radioNextAt = ctx.currentTime + 0.05;
      while (S.radioNextAt < ctx.currentTime + 0.2) {
        scheduleRadioStep(S.radioStep, S.radioNextAt);
        S.radioStep++;
        S.radioNextAt += stepDur;
      }
    }

    function radioStart(idx) {
      try {
        const n = RADIO_STATIONS.length;
        S.radioIdx = ((Math.floor(Number(idx) || 0) % n) + n) % n;
        S.radioOn = true;
        S.radioStep = 0;
        // Creating/resuming the context here keeps start() inside the
        // caller's user-gesture chain (R key handler / enterCar click).
        const ctx = ensureCtx();
        if (ctx) {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          S.radioNextAt = ctx.currentTime + 0.06;
          if (!S.radioTimer) S.radioTimer = setInterval(pumpRadio, 100);
          pumpRadio();
        }
      } catch (e) { /* never throw */ }
      return radioCurrent();
    }
    function radioStop() {
      try {
        S.radioOn = false;
        if (S.radioTimer) { clearInterval(S.radioTimer); S.radioTimer = null; }
        S.musicStarted = false; // ambient loop restarts cleanly, no catch-up burst
      } catch (e) { /* never throw */ }
    }
    function radioNext() {
      try {
        if (!S.radioOn) return radioStart(0);
        if (S.radioIdx < RADIO_STATIONS.length - 1) return radioStart(S.radioIdx + 1);
        radioStop(); // after the last station: OFF
      } catch (e) { /* never throw */ }
      return radioCurrent();
    }
    function radioCurrent() {
      return S.radioOn ? { name: RADIO_STATIONS[S.radioIdx].name, index: S.radioIdx } : null;
    }
    const radio = { start: radioStart, stop: radioStop, next: radioNext, current: radioCurrent };

    function pumpMusic() {
      const ctx = S.ctx;
      if (!ctx || ctx.state !== 'running') return;
      if (S.radioOn) return; // S24: the car radio replaces the ambient loop
      if (!S.musicStarted) {
        S.musicStarted = true;
        S.step = 0;
        S.nextStepAt = ctx.currentTime + 0.06;
      }
      while (S.nextStepAt < ctx.currentTime + 0.15) {
        scheduleStep(S.step, S.nextStepAt);
        S.step++;
        S.nextStepAt += STEP_DUR;
      }
    }

    // ------------------------------------------------------------- poll
    function update(dtRaw) {
      try {
        const dt = Number.isFinite(dtRaw) && dtRaw > 0 && dtRaw < 1 ? dtRaw : 1 / 60;
        const ctx = S.ctx;
        if (!ctx) return;
        const t = nowSec();
        const flags = G.flags || {};

        // engine: explicit setEngine wins; poll takes over after 300ms silence
        if (t - S.lastSetEngine > 0.3) {
          if (flags.inCar && G.car) {
            let rpm = 0;
            try {
              const top = G.car.spec && G.car.spec.topSpeed;
              rpm = top ? Math.abs(G.car.speed || 0) / (top / 3.6) : Math.abs(G.car.speed || 0) / 50;
            } catch (e) { rpm = 0; }
            S.engOn = true;
            S.engRpm = Math.max(0.07, clamp01(rpm)); // idle floor
          } else {
            S.engOn = false;
          }
        }
        // smooth engine params (no zipper noise)
        const k = Math.min(1, dt * 9);
        S.engRpmCur += (S.engRpm - S.engRpmCur) * k;
        const gTarget = S.engOn ? 0.05 + S.engRpmCur * 0.1 : 0;
        S.engGainCur += (gTarget - S.engGainCur) * k;
        if (S.engOsc1 && S.engGain) {
          const f = 60 + S.engRpmCur * 220;
          S.engOsc1.frequency.value = f;
          S.engOsc2.frequency.value = f;
          S.engFilter.frequency.value = 350 + S.engRpmCur * 1600;
          S.engGain.gain.value = S.engGainCur;
        }

        // skid / screech: an explicit screech() call from drive.js (fresh
        // within 300 ms) wins, scaled by slip intensity; otherwise fall
        // back to the drifting flag like before.
        let skidTarget = flags.drifting ? 0.06 : 0;
        if (t - S.lastScreech < 0.3) {
          skidTarget = S.screechOn ? 0.03 + 0.11 * S.screechInt : 0;
          if (S.skidFilter) S.skidFilter.frequency.value = 750 + 350 * S.screechInt;
        }
        S.skidCur += (skidTarget - S.skidCur) * Math.min(1, dt * 12);
        if (S.skidGain) S.skidGain.gain.value = S.skidCur;

        // crash edge -> thud
        const ct = flags.crashTimer;
        const ctNum = typeof ct === 'number' ? ct : (ct ? 1 : 0);
        if ((ctNum > 0 && S.prevCrash <= 0) || ctNum > S.prevCrash + 0.001) {
          if (S.prevCrash !== ctNum) play('crash');
        }
        S.prevCrash = ctNum;

        // siren: wanted >= 2 and a cop within 60m
        let sirenOn = false;
        try {
          if ((G.wanted || 0) >= 2 && Array.isArray(G.cops) && G.cops.length) {
            const me = posOf(flags.inCar && G.car ? G.car : G.player) || posOf(G.car) || posOf(G.player);
            if (me) {
              for (const cop of G.cops) {
                const cp = posOf(cop);
                if (!cp) continue;
                const dx = cp.x - me.x;
                const dz = cp.z - me.z;
                if (dx * dx + dz * dz <= 3600) { sirenOn = true; break; }
              }
            }
          }
        } catch (e) { sirenOn = false; }
        S.sirCur += ((sirenOn ? 0.04 : 0) - S.sirCur) * Math.min(1, dt * 8);
        if (S.sirGain && S.sirOsc) {
          S.sirGain.gain.value = S.sirCur;
          if (sirenOn) S.sirOsc.frequency.value = (Math.floor(t * 2.8) % 2 === 0) ? 720 : 960;
        }

        pumpMusic();
      } catch (e) { /* never throw */ }
    }

    const api = {
      muted: false,
      play,
      toggleMute,
      setEngine,
      resume,
      horn,
      hornStart,
      hornStop,
      // S24 vehicle + radio surface
      screech,
      setScreech: screech,
      crash,
      radio,
    };
    G.audio = api;

    try {
      if (Array.isArray(G.updaters)) G.updaters.push(update);
      else if (G.updaters && typeof G.updaters.add === 'function') G.updaters.add(update);
      else if (G.updaters == null) G.updaters = [update];
    } catch (e) { /* polling is best-effort */ }
  } catch (e) {
    // Last resort: a silent stub so callers never crash.
    try {
      if (G && !G.audio) {
        G.audio = { muted: true, play() {}, toggleMute() {}, setEngine() {}, resume() {}, horn() {}, hornStart() {}, hornStop() {}, screech() {}, setScreech() {}, crash() {}, radio: { start() {}, stop() {}, next() {}, current() { return null; } } };
      }
    } catch (e2) { /* give up silently */ }
  }
}
