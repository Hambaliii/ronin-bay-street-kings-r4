// All sound here is synthesized live with WebAudio; nothing loads
// from disk. Engine, skid, siren, UI tones and the scheduled music
// loops are oscillators plus shaped noise, and every entry point
// stays defensive so a context-less capture can never throw.
function clampUnit(rawVal) {
  const numericVal = Number(rawVal);
  if (!(Number.isFinite(numericVal))) return 0;
  if (numericVal < 0) return 0;
  return (1 < numericVal) ? 1 : numericVal;
}
const MS_IN_SEC = 1000;
function nowSecs() {
  try {
    if (('undefined' !== typeof performance) && performance.now) return performance.now() / MS_IN_SEC;
  } catch (ignoredErr) {}
  return Date.now() / MS_IN_SEC;
}
// Game objects arrive in several shapes; find one carrying x/z.
function locateObj(objRef) {
  if (!(objRef) || ('object' !== typeof objRef)) return null;
  const shapeCandidates = [];
  shapeCandidates.push(objRef.position, objRef.pos, objRef.group && objRef.group.position, objRef.mesh && objRef.mesh.position, objRef);
  for (const shapeItem of shapeCandidates) {
    if (shapeItem && Number.isFinite(shapeItem.x) && Number.isFinite(shapeItem.z)) return shapeItem;
  }
  return null;
}
export function initAudio(game) {
  try {
    if (!(game) || ('object' !== typeof game)) return;
    if (game.__audioInit) return;
    game.__audioInit = true;
    const S = {};
    S.ctx = null; S.master = null; S.musicBus = null; S.noiseBuf = null;
    S.engOsc1 = null; S.engOsc2 = null; S.engFilter = null; S.engGain = null;
    S.engOn = false;
    S.engRpm = 0; S.engRpmCur = 0; S.engGainCur = 0;
    S.lastSetEngine = -10;
    S.skidSrc = null; S.skidFilter = null; S.skidGain = null;
    S.skidCur = 0;
    S.screechOn = false;
    S.screechInt = 0;
    S.lastScreech = -10;
    S.lastCrashAt = -10;
    S.radioBus = null; S.radioFilter = null;
    S.radioOn = false;
    S.radioIdx = 0; S.radioStep = 0; S.radioNextAt = 0;
    S.radioTimer = null;
    S.sirOsc = null; S.sirGain = null;
    S.sirCur = 0;
    S.musicStarted = false;
    S.step = 0; S.nextStepAt = 0; S.prevCrash = 0;
    S.hornOsc1 = null; S.hornOsc2 = null; S.hornFilter = null; S.hornGain = null;
    S.hornOn = false;
    S.hornTimer = null;
    const Ctor = (('undefined' !== typeof window) && (window.AudioContext || window.webkitAudioContext)) || null;
    function buildNoise(ctxRef) {
      const totalSamples = ctxRef.sampleRate;
      const bufferObj = ctxRef.createBuffer(1, totalSamples, ctxRef.sampleRate);
      const channelData = bufferObj.getChannelData(0);
      let lcgSeed = 22222;
      let sampleCursor = 0;
      while (sampleCursor < totalSamples) {
        lcgSeed = ((lcgSeed * 1103515245) + 12345) & 0x7fffffff;
        channelData[sampleCursor] = (lcgSeed / 0x40000000) - 1;
        sampleCursor = (sampleCursor + 1);
      }
      return bufferObj;
    }
    function buildEngine(ctxRef) {
      try { S.engOsc1 = ctxRef.createOscillator();
        S.engOsc1.type = 'sawtooth';
        S.engOsc2 = ctxRef.createOscillator();
        S.engOsc2.type = 'square';
        S.engOsc2.detune.value = 9;
        S.engFilter = ctxRef.createBiquadFilter();
        S.engFilter.type = 'lowpass';
        S.engFilter.frequency.value = 400;
        S.engFilter.Q.value = 2;
        S.engGain = ctxRef.createGain();
        S.engGain.gain.value = 0;
        S.engOsc1.connect(S.engFilter);
        S.engOsc2.connect(S.engFilter);
        S.engFilter.connect(S.engGain);
        S.engGain.connect(S.master);
        S.engOsc1.frequency.value = 60;
        S.engOsc2.frequency.value = 60;
        S.engOsc1.start();
        S.engOsc2.start();
      } catch (ignoredErr) {}
    }
    function buildSkid(ctxRef) {
      try { S.skidSrc = ctxRef.createBufferSource();
        S.skidSrc.buffer = S.noiseBuf;
        S.skidSrc.loop = true;
        S.skidFilter = ctxRef.createBiquadFilter();
        S.skidFilter.type = 'bandpass';
        S.skidFilter.frequency.value = 900;
        S.skidFilter.Q.value = 2;
        S.skidGain = ctxRef.createGain();
        S.skidGain.gain.value = 0;
        S.skidSrc.connect(S.skidFilter);
        S.skidFilter.connect(S.skidGain);
        S.skidGain.connect(S.master);
        S.skidSrc.start();
      } catch (ignoredErr) {}
    }
    function buildSiren(ctxRef) {
      try { S.sirOsc = ctxRef.createOscillator();
        S.sirOsc.type = 'square';
        S.sirOsc.frequency.value = 720;
        S.sirGain = ctxRef.createGain();
        S.sirGain.gain.value = 0;
        S.sirOsc.connect(S.sirGain);
        S.sirGain.connect(S.master);
        S.sirOsc.start();
      } catch (ignoredErr) {}
    }
    function getCtx() {
      if (S.ctx) return S.ctx;
      if (!(Ctor)) return null;
      try {
        const freshCtx = new Ctor();
        S.ctx = freshCtx;
        S.master = freshCtx.createGain();
        S.master.gain.value = soundApi.muted ? 0 : 0.5;
        S.master.connect(freshCtx.destination);
        S.musicBus = freshCtx.createGain();
        S.musicBus.gain.value = 0.05;
        S.musicBus.connect(S.master);
        S.radioBus = freshCtx.createGain();
        S.radioBus.gain.value = 0.16;
        S.radioBus.connect(S.master);
        S.radioFilter = freshCtx.createBiquadFilter();
        S.radioFilter.type = 'lowpass';
        S.radioFilter.frequency.value = 950;
        S.radioFilter.Q.value = 1;
        S.radioFilter.connect(S.radioBus);
        S.noiseBuf = buildNoise(freshCtx);
        buildEngine(freshCtx);
        buildSkid(freshCtx);
        buildSiren(freshCtx);
        return freshCtx;
      } catch (ignoredErr) { S.ctx = null; return null; }
    }
    // One enveloped oscillator tone, gliding when asked.
    function tone(kindName, freqStart, freqEnd, whenAt, durSecs, volLevel, destBus) {
      const ctxRef = S.ctx;
      if (!(ctxRef)) return;
      try { const oscNode = ctxRef.createOscillator();
        const ampNode = ctxRef.createGain();
        oscNode.type = kindName;
        oscNode.frequency.setValueAtTime(Math.max(20, freqStart), whenAt);
        if (freqEnd && (freqStart !== freqEnd)) oscNode.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), whenAt + durSecs);
        ampNode.gain.setValueAtTime(0, whenAt);
        ampNode.gain.linearRampToValueAtTime(volLevel, whenAt + 0.012);
        ampNode.gain.exponentialRampToValueAtTime(0.0001, whenAt + durSecs);
        oscNode.connect(ampNode);
        ampNode.connect(destBus || S.master);
        oscNode.start(whenAt);
        oscNode.stop(whenAt + (durSecs + 0.05));
      } catch (ignoredErr) {}
    }
    function noiseBurst(whenAt, durSecs, volLevel, freqVal, kindName, destBus, rateVal) {
      const ctxRef = S.ctx;
      if (!(ctxRef) || !(S.noiseBuf)) return;
      try {
        const srcNode = ctxRef.createBufferSource();
        srcNode.buffer = S.noiseBuf;
        if (rateVal !== undefined) srcNode.playbackRate.value = rateVal;
        const filtNode = ctxRef.createBiquadFilter();
        filtNode.type = kindName || 'lowpass';
        filtNode.frequency.value = freqVal;
        const ampNode = ctxRef.createGain();
        ampNode.gain.setValueAtTime(volLevel, whenAt);
        ampNode.gain.exponentialRampToValueAtTime(0.0001, whenAt + durSecs);
        srcNode.connect(filtNode);
        filtNode.connect(ampNode);
        ampNode.connect(destBus || S.master);
        srcNode.start(whenAt);
        srcNode.stop(whenAt + (durSecs + 0.05));
      } catch (ignoredErr) {}
    }
    function noiseHit(whenAt, durSecs, volLevel, freqVal, kindName) {
      noiseBurst(whenAt, durSecs, volLevel, freqVal, kindName, undefined, undefined);
    }
    function noiseHitTo(whenAt, durSecs, volLevel, freqVal, kindName, destBus) {
      const ctxRef = S.ctx;
      if (!(ctxRef) || !(S.noiseBuf)) return;
      try {
        const srcNode = ctxRef.createBufferSource();
        srcNode.buffer = S.noiseBuf;
        srcNode.playbackRate.value = (0.7 + (((whenAt * 7) % 1) * 0.6));
        const filtNode = ctxRef.createBiquadFilter();
        filtNode.type = kindName || 'lowpass';
        filtNode.frequency.value = freqVal;
        const ampNode = ctxRef.createGain();
        ampNode.gain.setValueAtTime(volLevel, whenAt);
        ampNode.gain.exponentialRampToValueAtTime(0.0001, whenAt + durSecs);
        srcNode.connect(filtNode);
        filtNode.connect(ampNode);
        ampNode.connect(destBus || S.master);
        srcNode.start(whenAt);
        srcNode.stop(whenAt + (durSecs + 0.05));
      } catch (ignoredErr) {}
    }
    // Crash thud with a shared debounce on the context clock.
    function fireCrash(intensityVal) {
      try { const ctxRef = getCtx();
        if (!(ctxRef)) return;
        const impactLevel = Math.max(0.15, clampUnit(intensityVal));
        const clockNow = ctxRef.currentTime;
        if ((clockNow - S.lastCrashAt) < 0.12) return;
        S.lastCrashAt = clockNow;
        const startAt = (clockNow + 0.005);
        noiseHit(startAt, 0.26, 0.5 * impactLevel, 300 + (260 * impactLevel), 'lowpass');
        tone('sine', 90, 35, startAt, 0.32, 0.48 * impactLevel);
      } catch (ignoredErr) {}
    }
    function crashCall(intensityVal) {
      fireCrash(intensityVal);
    }
    function setScreech(activeFlag, intensityVal) {
      try { S.screechOn = !(!(activeFlag));
        S.screechInt = clampUnit(intensityVal);
        S.lastScreech = nowSecs();
        if (activeFlag) {
          const ctxRef = getCtx();
          if (ctxRef && ('suspended' === ctxRef.state)) ctxRef.resume().catch(() => {});
        }
      } catch (ignoredErr) {}
    }
    function playSfx(nameVal) {
      try { const ctxRef = getCtx();
        if (!(ctxRef)) return;
        if ('suspended' === ctxRef.state) ctxRef.resume().catch(() => {});
        const startBase = (ctxRef.currentTime + 0.01);
        switch (nameVal) {
          case 'click': tone('square', 880, 660, startBase, 0.06, 0.07); break;
          case 'cash':
            tone('sine', 988, 988, startBase, 0.08, 0.12);
            tone('sine', 1319, 1319, startBase + 0.08, 0.14, 0.12);
            break;
          case 'win': {
            const winNotes = [523, 659, 784, 1047];
            for (let noteIdx = 0; noteIdx < winNotes.length; noteIdx = (noteIdx + 1)) tone('triangle', winNotes[noteIdx], winNotes[noteIdx], startBase + (noteIdx * 0.09), 0.16, 0.13);
            break; }
          case 'fail': {
            const failNotes = [392, 330, 262];
            for (let noteIdx = 0; noteIdx < failNotes.length; noteIdx = (noteIdx + 1)) tone('sawtooth', failNotes[noteIdx], failNotes[noteIdx], startBase + (noteIdx * 0.13), 0.16, 0.07);
            break; }
          case 'busted':
            tone('sawtooth', 900, 280, startBase, 0.8, 0.1);
            tone('sawtooth', 905, 285, startBase, 0.8, 0.05);
            break;
          case 'pickup': tone('sine', 660, 990, startBase, 0.09, 0.1); break;
          case 'crash': fireCrash(0.75); break;
          case 'shot':
            noiseHit(startBase, 0.12, 0.3, 900, 'lowpass');
            tone('square', 220, 55, startBase, 0.12, 0.16);
            break;
          case 'smg':
            noiseHit(startBase, 0.07, 0.22, 1100, 'lowpass');
            tone('square', 260, 70, startBase, 0.07, 0.12);
            break;
          case 'dry': tone('square', 1200, 900, startBase, 0.03, 0.06); break;
          case 'reload':
            tone('square', 700, 500, startBase, 0.04, 0.09);
            tone('square', 950, 650, startBase + 0.13, 0.04, 0.09);
            break;
          case 'swing': noiseHit(startBase, 0.18, 0.12, 700, 'bandpass'); break;
          case 'thud': tone('sine', 90, 40, startBase, 0.15, 0.3); break;
          default: break;
        }
      } catch (ignoredErr) {}
    }
    // Dual tone horn: start, stop and one-shot helpers.
    function hornStartFn() {
      try { if (S.hornOn) return;
        const ctxRef = getCtx();
        if (!(ctxRef)) return;
        if ('suspended' === ctxRef.state) ctxRef.resume().catch(() => {});
        if (S.hornTimer) { clearTimeout(S.hornTimer); S.hornTimer = null; }
        const clockNow = ctxRef.currentTime;
        const oscLow = ctxRef.createOscillator();
        oscLow.type = 'sawtooth';
        oscLow.frequency.value = 370;
        const oscHigh = ctxRef.createOscillator();
        oscHigh.type = 'sawtooth';
        oscHigh.frequency.value = 440;
        oscHigh.detune.value = 4;
        const filtNode = ctxRef.createBiquadFilter();
        filtNode.type = 'lowpass';
        filtNode.frequency.value = 1200;
        filtNode.Q.value = 1;
        const ampNode = ctxRef.createGain();
        ampNode.gain.setValueAtTime(0, clockNow);
        ampNode.gain.linearRampToValueAtTime(0.16, clockNow + 0.01);
        oscLow.connect(filtNode);
        oscHigh.connect(filtNode);
        filtNode.connect(ampNode);
        ampNode.connect(S.master);
        oscLow.start(clockNow);
        oscHigh.start(clockNow);
        S.hornOsc1 = oscLow; S.hornOsc2 = oscHigh; S.hornFilter = filtNode; S.hornGain = ampNode;
        S.hornOn = true;
      } catch (ignoredErr) {}
    }
    function hornStopFn() {
      try { if (!(S.hornOn)) return;
        S.hornOn = false;
        if (S.hornTimer) { clearTimeout(S.hornTimer); S.hornTimer = null; }
        const ctxRef = S.ctx;
        const oscLow = S.hornOsc1;
        const oscHigh = S.hornOsc2;
        const ampNode = S.hornGain;
        S.hornOsc1 = null; S.hornOsc2 = null; S.hornFilter = null; S.hornGain = null;
        if (!(ctxRef) || !(ampNode)) {
          try { oscLow && oscLow.stop(); } catch (ignoredErr) {}
          try { oscHigh && oscHigh.stop(); } catch (ignoredErr) {}
          return;
        }
        const clockNow = ctxRef.currentTime;
        try {
          ampNode.gain.cancelScheduledValues(clockNow);
          ampNode.gain.setValueAtTime(ampNode.gain.value, clockNow);
          ampNode.gain.linearRampToValueAtTime(0, clockNow + 0.08);
          if (oscLow) oscLow.stop(clockNow + 0.1);
          if (oscHigh) oscHigh.stop(clockNow + 0.1);
        } catch (ignoredErr) {}
      } catch (ignoredErr) {}
    }
    function hornOnceFn(durVal) {
      try {
        const holdSecs = (Number.isFinite(durVal) && (0 < durVal)) ? Math.min(durVal, 1.2) : 0.35;
        hornStartFn();
        if (S.hornTimer) clearTimeout(S.hornTimer);
        S.hornTimer = setTimeout(() => { S.hornTimer = null; hornStopFn(); }, holdSecs * 1000);
      } catch (ignoredErr) {}
    }
    function setEngine(onFlag, rpmVal) {
      try {
        S.engOn = !(!(onFlag));
        S.engRpm = clampUnit(rpmVal);
        S.lastSetEngine = nowSecs();
        if (onFlag) {
          const ctxRef = getCtx();
          if (ctxRef && ('suspended' === ctxRef.state)) ctxRef.resume().catch(() => {});
        }
      } catch (ignoredErr) {}
    }
    function resumeFn() {
      try {
        const ctxRef = getCtx();
        if (ctxRef && ('suspended' === ctxRef.state)) ctxRef.resume().catch(() => {});
      } catch (ignoredErr) {}
    }
    function toggleMuteFn() {
      try {
        soundApi.muted = !(soundApi.muted);
        const ctxRef = getCtx();
        if (ctxRef && S.master) {
          const clockNow = ctxRef.currentTime;
          S.master.gain.cancelScheduledValues(clockNow);
          S.master.gain.setTargetAtTime(soundApi.muted ? 0 : 0.5, clockNow, 0.05);
        }
      } catch (ignoredErr) {}
      return soundApi.muted;
    }
    // Synthwave loop constants: tempo steps and chord data.
    const STEP_SECS = 60 / 100 / 2;
    const BASS_ROOTS = [33, 29, 36, 31];
    const PAD_CHORDS = [];
    PAD_CHORDS.push([57, 60, 64], [53, 57, 60]);
    PAD_CHORDS.push([48, 52, 55], [55, 59, 62]);
    function midiHz(midiVal) {
      const exponentVal = (midiVal - 69) / 12;
      return 440 * Math.pow(2, exponentVal);
    }
    function padVoice(noteVal, whenAt) {
      const ctxRef = S.ctx;
      try {
        const oscNode = ctxRef.createOscillator();
        const ampNode = ctxRef.createGain();
        oscNode.type = 'triangle';
        oscNode.frequency.value = midiHz(noteVal);
        ampNode.gain.setValueAtTime(0, whenAt);
        ampNode.gain.linearRampToValueAtTime(0.05, whenAt + 0.4);
        ampNode.gain.setValueAtTime(0.05, whenAt + (STEP_SECS * 8) - 0.4);
        ampNode.gain.linearRampToValueAtTime(0, whenAt + (STEP_SECS * 8));
        oscNode.connect(ampNode);
        ampNode.connect(S.musicBus);
        oscNode.start(whenAt);
        oscNode.stop(whenAt + (STEP_SECS * 8) + 0.05);
      } catch (ignoredErr) {}
    }
    function hatVoice(whenAt) {
      try {
        const ctxRef = S.ctx;
        const srcNode = ctxRef.createBufferSource();
        srcNode.buffer = S.noiseBuf;
        const filtNode = ctxRef.createBiquadFilter();
        filtNode.type = 'highpass';
        filtNode.frequency.value = 6000;
        const ampNode = ctxRef.createGain();
        ampNode.gain.setValueAtTime(0.25, whenAt);
        ampNode.gain.exponentialRampToValueAtTime(0.001, whenAt + 0.04);
        srcNode.connect(filtNode);
        filtNode.connect(ampNode);
        ampNode.connect(S.musicBus);
        srcNode.start(whenAt);
        srcNode.stop(whenAt + 0.06);
      } catch (ignoredErr) {}
    }
    function musicStep(stepIdx, whenAt) {
      const barIdx = Math.floor(stepIdx / 8) % 4;
      const inBarIdx = stepIdx % 8;
      const rootNote = BASS_ROOTS[barIdx];
      if (0 === (inBarIdx % 2)) {
        const bassNote = (4 === inBarIdx) ? (rootNote + 12) : rootNote;
        tone('sawtooth', midiHz(bassNote), midiHz(bassNote), whenAt, 0.22, 0.16, S.musicBus);
      } else if (7 === inBarIdx) {
        tone('sawtooth', midiHz(rootNote + 7), midiHz(rootNote + 7), whenAt, 0.14, 0.1, S.musicBus);
      }
      if (0 === inBarIdx) {
        for (const chordNote of PAD_CHORDS[barIdx]) padVoice(chordNote, whenAt);
      }
      if (1 === (inBarIdx % 2)) hatVoice(whenAt);
    }
    // Radio stations and their pattern tables.
    const STATION_LIST = [];
    STATION_LIST.push({ name: 'WAVEFORM FM', bpm: 100, kind: 'wave' });
    STATION_LIST.push({ name: 'LOFI BAY', bpm: 76, kind: 'lofi' });
    STATION_LIST.push({ name: 'EUROBEAT KAI', bpm: 150, kind: 'euro' });
    const LOFI_CHORDS = [];
    LOFI_CHORDS.push([53, 57, 60, 64], [50, 53, 57, 60]);
    LOFI_CHORDS.push([48, 52, 55, 59], [52, 55, 59, 62]);
    const LOFI_ROOTS = [29, 26, 24, 28];
    const EURO_ROOTS = [33, 33, 29, 31];
    const EURO_LEAD = [
      69, 0, 72, 0, 76, 0, 72, 0, 74, 0, 76, 0, 79, 0, 76, 0,
      69, 0, 72, 0, 76, 0, 81, 0, 79, 76, 74, 0, 72, 0, 0, 0,
    ];
    function kickHit(whenAt, volLevel) {
      tone('sine', 130, 45, whenAt, 0.14, volLevel, S.radioBus);
    }
    function hatTick(whenAt, volLevel, durVal) {
      noiseHitTo(whenAt, durVal || 0.04, volLevel, 6500, 'highpass', S.radioBus);
    }
    function radioBass(whenAt, midiVal, durSecs, volLevel) {
      tone('sawtooth', midiHz(midiVal), midiHz(midiVal), whenAt, durSecs, volLevel, S.radioFilter);
    }
    function radioPad(whenAt, midiList, durSecs, volLevel, detuneVal) {
      const ctxRef = S.ctx;
      if (!(ctxRef)) return;
      for (const noteVal of midiList) {
        for (const signVal of [-1, 1]) {
          try {
            const oscNode = ctxRef.createOscillator();
            const ampNode = ctxRef.createGain();
            oscNode.type = 'triangle';
            oscNode.frequency.value = midiHz(noteVal);
            oscNode.detune.value = signVal * (detuneVal || 6);
            ampNode.gain.setValueAtTime(0, whenAt);
            ampNode.gain.linearRampToValueAtTime(volLevel, whenAt + Math.min(0.4, durSecs * 0.3));
            ampNode.gain.setValueAtTime(volLevel, whenAt + Math.max(0, durSecs - 0.35));
            ampNode.gain.linearRampToValueAtTime(0, whenAt + durSecs);
            oscNode.connect(ampNode);
            ampNode.connect(S.radioBus);
            oscNode.start(whenAt);
            oscNode.stop(whenAt + (durSecs + 0.05));
          } catch (ignoredErr) {}
        }
      }
    }
    function stationStep(stepIdx, whenAt) {
      const stationObj = STATION_LIST[S.radioIdx];
      if (!(stationObj) || !(S.ctx)) return;
      const stepDur = 60 / stationObj.bpm / 4;
      const barDur = 16 * stepDur;
      const barIdx = Math.floor(stepIdx / 16);
      const stepInBar = stepIdx % 16;
      if ('wave' === stationObj.kind) {
        const barOfFour = barIdx % 4;
        const rootNote = BASS_ROOTS[barOfFour];
        if (0 === (stepInBar % 2)) radioBass(whenAt, (8 === stepInBar) ? (rootNote + 12) : rootNote, 0.22, 0.5);
        if (0 === stepInBar) radioPad(whenAt, PAD_CHORDS[barOfFour], barDur, 0.055, 7);
        const arpPool = PAD_CHORDS[barOfFour];
        const arpNoteVal = arpPool[stepInBar % 3] + 12 + ((6 === (stepInBar % 8)) ? 7 : 0);
        tone('square', midiHz(arpNoteVal), midiHz(arpNoteVal), whenAt, 0.09, 0.07, S.radioBus);
        if (2 === (stepInBar % 4)) hatTick(whenAt, 0.1);
      } else if ('lofi' === stationObj.kind) {
        const barOfFour = barIdx % 4;
        if (0 === stepInBar) {
          radioPad(whenAt, LOFI_CHORDS[barOfFour], barDur, 0.085, 5 + (Math.sin(barIdx * 1.7) * 4));
          tone('triangle', midiHz(LOFI_ROOTS[barOfFour] + 12), midiHz(LOFI_ROOTS[barOfFour] + 12), whenAt, barDur * 0.9, 0.22, S.radioBus);
        }
        if ((0 === stepInBar) || (10 === stepInBar)) kickHit(whenAt, 0.32);
        if ((4 === stepInBar) || (12 === stepInBar)) noiseHitTo(whenAt, 0.09, 0.09, 1800, 'bandpass', S.radioBus);
        if (2 === (stepInBar % 4)) hatTick(whenAt, 0.045);
        if (0 === (stepInBar % 2)) noiseHitTo(whenAt, 0.02, 0.014, 1600, 'lowpass', S.radioBus);
      } else {
        const barOfFour = barIdx % 4;
        const rootNote = EURO_ROOTS[barOfFour];
        if (0 === (stepInBar % 4)) kickHit(whenAt, 0.5);
        if (2 === (stepInBar % 4)) radioBass(whenAt, rootNote + 12, 0.16, 0.42);
        if (2 === (stepInBar % 4)) hatTick(whenAt, 0.13, 0.07);
        else if (0 === (stepInBar % 2)) hatTick(whenAt, 0.04);
        if (0 === stepInBar) radioPad(whenAt, PAD_CHORDS[(1 === barOfFour) ? 0 : barOfFour], stepDur * 4, 0.04, 5);
        const leadNoteVal = EURO_LEAD[((barIdx % 2) * 16) + stepInBar];
        if (leadNoteVal) tone('sawtooth', midiHz(leadNoteVal), midiHz(leadNoteVal), whenAt, 0.17, 0.16, S.radioBus);
      }
    }
    function pumpRadio() {
      const ctxRef = S.ctx;
      if (!(ctxRef) || !(S.radioOn)) return;
      if ('running' !== ctxRef.state) return;
      const stationObj = STATION_LIST[S.radioIdx];
      const stepDur = 60 / stationObj.bpm / 4;
      if (S.radioNextAt < ctxRef.currentTime) S.radioNextAt = ctxRef.currentTime + 0.05;
      while (S.radioNextAt < (ctxRef.currentTime + 0.2)) {
        stationStep(S.radioStep, S.radioNextAt);
        S.radioStep = (S.radioStep + 1);
        S.radioNextAt = (S.radioNextAt + stepDur);
      }
    }
    function stationNow() {
      return S.radioOn ? { name: STATION_LIST[S.radioIdx].name, index: S.radioIdx } : null;
    }
    function startStationAt(idxVal) {
      try {
        const stationCount = STATION_LIST.length;
        S.radioIdx = (((Math.floor(Number(idxVal) || 0) % stationCount) + stationCount) % stationCount);
        S.radioOn = true;
        S.radioStep = 0;
        const ctxRef = getCtx();
        if (ctxRef) {
          if ('suspended' === ctxRef.state) ctxRef.resume().catch(() => {});
          S.radioNextAt = ctxRef.currentTime + 0.06;
          if (!(S.radioTimer)) S.radioTimer = setInterval(pumpRadio, 100);
          pumpRadio();
        }
      } catch (ignoredErr) {}
      return stationNow();
    }
    function stopStationFn() {
      try {
        S.radioOn = false;
        if (S.radioTimer) { clearInterval(S.radioTimer); S.radioTimer = null; }
        S.musicStarted = false;
      } catch (ignoredErr) {}
    }
    function nextStationFn() {
      try {
        const lastIdx = STATION_LIST.length - 1;
        if (!(S.radioOn)) return startStationAt(0);
        if (S.radioIdx < lastIdx) return startStationAt(S.radioIdx + 1);
        stopStationFn();
      } catch (ignoredErr) {}
      return stationNow();
    }
    const radioApi = {};
    radioApi.start = startStationAt;
    radioApi.stop = stopStationFn;
    radioApi.next = nextStationFn;
    radioApi.current = stationNow;
    function pumpMusic() {
      const ctxRef = S.ctx;
      if (!(ctxRef) || ('running' !== ctxRef.state)) return;
      if (S.radioOn) return;
      if (!(S.musicStarted)) { S.musicStarted = true; S.step = 0; S.nextStepAt = ctxRef.currentTime + 0.06; }
      while (S.nextStepAt < (ctxRef.currentTime + 0.15)) {
        musicStep(S.step, S.nextStepAt);
        S.step = (S.step + 1);
        S.nextStepAt = (S.nextStepAt + STEP_SECS);
      }
    }
    // Per-frame poll: engine, skid, crash edge, siren, music pump.
    function frameTick(dtRaw) {
      try {
        const dtVal = (Number.isFinite(dtRaw) && (0 < dtRaw) && (dtRaw < 1)) ? dtRaw : 1 / 60;
        const ctxRef = S.ctx;
        if (!(ctxRef)) return;
        const clockNow = nowSecs();
        const flagsObj = game.flags || {};
        if (0.3 < (clockNow - S.lastSetEngine)) {
          if (flagsObj.inCar && game.car) {
            let rpmFraction = 0;
            try {
              const topSpeedVal = game.car.spec && game.car.spec.topSpeed;
              rpmFraction = topSpeedVal ? Math.abs(game.car.speed || 0) / (topSpeedVal / 3.6) : Math.abs(game.car.speed || 0) / 50;
            } catch (ignoredErr) { rpmFraction = 0; }
            S.engOn = true;
            S.engRpm = Math.max(0.07, clampUnit(rpmFraction));
          } else { S.engOn = false; }
        }
        const easeFactor = Math.min(1, dtVal * 9);
        S.engRpmCur = S.engRpmCur + ((S.engRpm - S.engRpmCur) * easeFactor);
        const gainTarget = S.engOn ? (0.05 + (S.engRpmCur * 0.1)) : 0;
        S.engGainCur = S.engGainCur + ((gainTarget - S.engGainCur) * easeFactor);
        if (S.engOsc1 && S.engGain) {
          const freqCurrent = 60 + (S.engRpmCur * 220);
          S.engOsc1.frequency.value = freqCurrent;
          S.engOsc2.frequency.value = freqCurrent;
          S.engFilter.frequency.value = 350 + (S.engRpmCur * 1600);
          S.engGain.gain.value = S.engGainCur;
        }
        let skidTarget = flagsObj.drifting ? 0.06 : 0;
        if ((clockNow - S.lastScreech) < 0.3) {
          skidTarget = S.screechOn ? (0.03 + (0.11 * S.screechInt)) : 0;
          if (S.skidFilter) S.skidFilter.frequency.value = 750 + (350 * S.screechInt);
        }
        S.skidCur = S.skidCur + ((skidTarget - S.skidCur) * Math.min(1, dtVal * 12));
        if (S.skidGain) S.skidGain.gain.value = S.skidCur;
        const crashRaw = flagsObj.crashTimer;
        const crashVal = ('number' === typeof crashRaw) ? ct : (crashRaw ? 1 : 0);
        if (((0 < crashVal) && !(S.prevCrash > 0)) || ((S.prevCrash + 0.001) < crashVal)) {
          if (crashVal !== S.prevCrash) playSfx('crash');
        }
        S.prevCrash = crashVal;
        let sirenActive = false;
        try {
          if ((2 <= (game.wanted || 0)) && Array.isArray(game.cops) && game.cops.length) {
            const selfPos = locateObj((flagsObj.inCar && game.car) ? game.car : game.player) || locateObj(game.car) || locateObj(game.player);
            if (selfPos) {
              for (const copUnit of game.cops) {
                const copPos = locateObj(copUnit);
                if (!(copPos)) continue;
                const deltaX = copPos.x - selfPos.x;
                const deltaZ = copPos.z - selfPos.z;
                if (!(3600 < ((deltaX * deltaX) + (deltaZ * deltaZ)))) { sirenActive = true; break; }
              }
            }
          }
        } catch (ignoredErr) { sirenActive = false; }
        S.sirCur = S.sirCur + (((sirenActive ? 0.04 : 0) - S.sirCur) * Math.min(1, dtVal * 8));
        if (S.sirGain && S.sirOsc) {
          S.sirGain.gain.value = S.sirCur;
          if (sirenActive) S.sirOsc.frequency.value = (0 === (Math.floor(clockNow * 2.8) % 2)) ? 720 : 960;
        }
        pumpMusic();
      } catch (ignoredErr) {}
    }
    const soundApi = {};
    soundApi.muted = false;
    soundApi.play = playSfx;
    soundApi.toggleMute = toggleMuteFn;
    soundApi.setEngine = setEngine;
    soundApi.resume = resumeFn;
    soundApi.horn = hornOnceFn;
    soundApi.hornStart = hornStartFn;
    soundApi.hornStop = hornStopFn;
    soundApi.screech = setScreech;
    soundApi.setScreech = setScreech;
    soundApi.crash = crashCall;
    soundApi.radio = radioApi;
    game.audio = soundApi;
    try {
      if (Array.isArray(game.updaters)) game.updaters.push(frameTick);
      else if (game.updaters && ('function' === typeof game.updaters.add)) game.updaters.add(frameTick);
      else if (null == game.updaters) game.updaters = [frameTick];
    } catch (ignoredErr) {}
  } catch (outerErr) {
    try {
      if (game && !(game.audio)) {
        game.audio = { muted: true, play() {}, toggleMute() {}, setEngine() {}, resume() {}, horn() {}, hornStart() {}, hornStop() {}, screech() {}, setScreech() {}, crash() {}, radio: { start() {}, stop() {}, next() {}, current() { return null; } } };
      }
    } catch (ignoredErr) {}
  }
}
