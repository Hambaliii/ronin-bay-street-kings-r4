// audio.js — RONIN BAY: Street Kings WebAudio synth engine.
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
      // skid
      skidSrc: null, skidFilter: null, skidGain: null, skidCur: 0,
      // siren
      sirOsc: null, sirGain: null, sirCur: 0,
      // music
      musicStarted: false, step: 0, nextStepAt: 0,
      // poll state
      prevCrash: 0,
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
        S.skidFilter.frequency.value = 800;
        S.skidFilter.Q.value = 1.2;
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
            noiseHit(t, 0.28, 0.5, 320, 'lowpass');
            tone('sine', 95, 38, t, 0.3, 0.4);
            break;
          default:
            break;
        }
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

    function pumpMusic() {
      const ctx = S.ctx;
      if (!ctx || ctx.state !== 'running') return;
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

        // skid follows drifting
        const skidTarget = flags.drifting ? 0.06 : 0;
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
        G.audio = { muted: true, play() {}, toggleMute() {}, setEngine() {}, resume() {} };
      }
    } catch (e2) { /* give up silently */ }
  }
}
