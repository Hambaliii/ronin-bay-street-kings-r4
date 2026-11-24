// Every sound in the game is manufactured live out of WebAudio
// oscillators and filtered noise; no sample files exist. The
// engine, the skid, the siren, the interface blips and the two
// music sequencers all sit below, and each public entry point
// is written so a missing audio context can never throw.
function clampUnit(limIn) {
  const limNum = Number(limIn);
  if (!Number.isFinite(limNum)) return 0;
  if (!(limNum >= 0)) return 0;
  return (1 < limNum) ? 1 : limNum;
}
const MS_PER_SEC = 1000;
function nowSecs() {
  try {
    if (('undefined' !== typeof performance) && performance.now) return performance.now() / MS_PER_SEC;
  } catch (swallowed) {}
  return Date.now() / MS_PER_SEC;
}
// Entities reach us in many shapes; hunt down one carrying x/z.
function locateObj(seekArg) {
  if (!seekArg || ('object' !== typeof seekArg)) return null;
  const carrierArr = [seekArg.position, seekArg.pos, seekArg.group && seekArg.group.position, seekArg.mesh && seekArg.mesh.position, seekArg];
  let hitSpot = null;
  carrierArr.forEach((probeItem) => {
    if (!hitSpot && probeItem && Number.isFinite(probeItem.x) && Number.isFinite(probeItem.z)) hitSpot = probeItem;
  });
  return hitSpot;
}
export function initAudio(gmObj) {
  try {
    if (!gmObj || ('object' !== typeof gmObj)) return;
    if (gmObj.__audioInit) return;
    gmObj.__audioInit = true;
    const au = {};
    const seedState = {
      ctx: null, master: null, musicBus: null, noiseBuf: null,
      engOsc1: null, engOsc2: null, engFilter: null, engGain: null,
      engOn: false, engRpm: 0, engRpmCur: 0, engGainCur: 0, lastSetEngine: -10,
      skidSrc: null, skidFilter: null, skidGain: null, skidCur: 0,
      screechOn: false, screechInt: 0, lastScreech: -10, lastCrashAt: -10,
      radioBus: null, radioFilter: null, radioOn: false,
      radioIdx: 0, radioStep: 0, radioNextAt: 0, radioTimer: null,
      sirOsc: null, sirGain: null, sirCur: 0, musicStarted: false,
      step: 0, nextStepAt: 0, prevCrash: 0,
      hornOsc1: null, hornOsc2: null, hornFilter: null, hornGain: null,
      hornOn: false, hornTimer: null,
    };
    Object.assign(au, seedState);
    const hasWindow = ('undefined' !== typeof window);
    const AudioClass = (hasWindow && (window.AudioContext || window.webkitAudioContext)) || null;
    function buildNoise(acIn) {
      const sampleCount = acIn.sampleRate;
      const noiseBuffer = acIn.createBuffer(1, sampleCount, acIn.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let lcgVal = 22222;
      let writeIdx = 0;
      while (sampleCount > writeIdx) {
        lcgVal = ((lcgVal * 1103515245) + 12345) & 0x7fffffff;
        samples[writeIdx] = (lcgVal / 0x40000000) + -1;
        writeIdx = (1 + writeIdx);
      }
      return noiseBuffer;
    }
    function buildEngine(acIn) {
      try {
        au.engOsc1 = acIn.createOscillator();
        au.engOsc1.type = 'sawtooth';
        au.engOsc2 = acIn.createOscillator();
        au.engOsc2.type = 'square';
        au.engOsc2.detune.value = 9;
        au.engFilter = acIn.createBiquadFilter();
        au.engFilter.type = 'lowpass';
        au.engFilter.frequency.value = 400;
        au.engFilter.Q.value = 2;
        au.engGain = acIn.createGain();
        au.engGain.gain.value = 0;
        au.engOsc1.connect(au.engFilter);
        au.engOsc2.connect(au.engFilter);
        au.engFilter.connect(au.engGain);
        au.engGain.connect(au.master);
        au.engOsc1.frequency.value = 60;
        au.engOsc2.frequency.value = 60;
        au.engOsc1.start();
        au.engOsc2.start();
      } catch (swallowed) {}
    }
    function buildSkid(acIn) {
      try {
        au.skidSrc = acIn.createBufferSource();
        au.skidSrc.buffer = au.noiseBuf;
        au.skidSrc.loop = true;
        au.skidFilter = acIn.createBiquadFilter();
        au.skidFilter.type = 'bandpass';
        au.skidFilter.frequency.value = 900;
        au.skidFilter.Q.value = 2;
        au.skidGain = acIn.createGain();
        au.skidGain.gain.value = 0;
        au.skidSrc.connect(au.skidFilter);
        au.skidFilter.connect(au.skidGain);
        au.skidGain.connect(au.master);
        au.skidSrc.start();
      } catch (swallowed) {}
    }
    function buildSiren(acIn) {
      try {
        au.sirOsc = acIn.createOscillator();
        au.sirOsc.type = 'square';
        au.sirOsc.frequency.value = 720;
        au.sirGain = acIn.createGain();
        au.sirGain.gain.value = 0;
        au.sirOsc.connect(au.sirGain);
        au.sirGain.connect(au.master);
        au.sirOsc.start();
      } catch (swallowed) {}
    }
    function makeBus(acIn, busLvl) {
      const busGain = acIn.createGain();
      busGain.gain.value = busLvl;
      busGain.connect(au.master);
      return busGain;
    }
    function wireRadioChain(acIn) {
      au.radioFilter = acIn.createBiquadFilter();
      au.radioFilter.type = 'lowpass';
      au.radioFilter.frequency.value = 950;
      au.radioFilter.Q.value = 1;
      au.radioFilter.connect(au.radioBus);
    }
    function getCtx() {
      if (au.ctx) return au.ctx;
      if (!AudioClass) return null;
      try {
        const liveCtx = new AudioClass();
        au.ctx = liveCtx;
        au.master = liveCtx.createGain();
        au.master.gain.value = apiObj.muted ? 0 : 0.5;
        au.master.connect(liveCtx.destination);
        au.musicBus = makeBus(liveCtx, 0.05);
        au.radioBus = makeBus(liveCtx, 0.16);
        wireRadioChain(liveCtx);
        au.noiseBuf = buildNoise(liveCtx);
        buildEngine(liveCtx);
        buildSkid(liveCtx);
        buildSiren(liveCtx);
        return liveCtx;
      } catch (swallowed) { au.ctx = null; return null; }
    }
    // One enveloped tone; the pitch glide is folded in here and
    // only runs when start and end frequencies actually differ.
    function tone(waveType, startHz, endHz, whenAt, lenSecs, lvlVal, destBus) {
      const acLive = au.ctx;
      if (!acLive) return;
      try {
        const toneOsc = acLive.createOscillator();
        const toneGain = acLive.createGain();
        toneOsc.type = waveType;
        toneOsc.frequency.setValueAtTime(Math.max(20, startHz), whenAt);
        if (endHz && (startHz !== endHz)) toneOsc.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), whenAt + lenSecs);
        toneGain.gain.setValueAtTime(0, whenAt);
        toneGain.gain.linearRampToValueAtTime(lvlVal, whenAt + 0.012);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, whenAt + lenSecs);
        toneOsc.connect(toneGain);
        toneGain.connect(destBus || au.master);
        toneOsc.start(whenAt);
        toneOsc.stop(whenAt + (lenSecs + 0.05));
      } catch (swallowed) {}
    }
    function noiseBurst(whenAt, lenSecs, lvlVal, freqHz, kindName, destBus, rateNum) {
      const acLive = au.ctx;
      if (!acLive || !au.noiseBuf) return;
      try {
        const noiseSrc = acLive.createBufferSource();
        noiseSrc.buffer = au.noiseBuf;
        if (rateNum !== undefined) noiseSrc.playbackRate.value = rateNum;
        const noiseFilter = acLive.createBiquadFilter();
        noiseFilter.type = kindName || 'lowpass';
        noiseFilter.frequency.value = freqHz;
        const noiseGain = acLive.createGain();
        noiseGain.gain.setValueAtTime(lvlVal, whenAt);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, whenAt + lenSecs);
        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(destBus || au.master);
        noiseSrc.start(whenAt);
        noiseSrc.stop(whenAt + (lenSecs + 0.05));
      } catch (swallowed) {}
    }
    function noiseHit(whenAt, lenSecs, lvlVal, freqHz, kindName) {
      noiseBurst(whenAt, lenSecs, lvlVal, freqHz, kindName, undefined, undefined);
    }
    function noiseHitTo(whenAt, lenSecs, lvlVal, freqHz, kindName, destBus) {
      const acLive = au.ctx;
      if (!acLive || !au.noiseBuf) return;
      try {
        const hitSrc = acLive.createBufferSource();
        hitSrc.buffer = au.noiseBuf;
        hitSrc.playbackRate.value = (0.7 + (((whenAt * 7) % 1) * 0.6));
        const hitFilter = acLive.createBiquadFilter();
        hitFilter.type = kindName || 'lowpass';
        hitFilter.frequency.value = freqHz;
        const hitGain = acLive.createGain();
        hitGain.gain.setValueAtTime(lvlVal, whenAt);
        hitGain.gain.exponentialRampToValueAtTime(0.0001, whenAt + lenSecs);
        hitSrc.connect(hitFilter);
        hitFilter.connect(hitGain);
        hitGain.connect(destBus || au.master);
        hitSrc.start(whenAt);
        hitSrc.stop(whenAt + (lenSecs + 0.05));
      } catch (swallowed) {}
    }
    // Impact thud, debounced against the context clock.
    function fireCrash(hitPower) {
      try {
        const acLive = getCtx();
        if (!acLive) return;
        const impactScale = Math.max(0.15, clampUnit(hitPower));
        const ctxClock = acLive.currentTime;
        if (0.12 > (ctxClock - au.lastCrashAt)) return;
        au.lastCrashAt = ctxClock;
        const hitAt = (0.005 + ctxClock);
        const noiseLvl = 0.5 * impactScale;
        const toneLvl = 0.48 * impactScale;
        noiseHit(hitAt, 0.26, noiseLvl, 300 + (260 * impactScale), 'lowpass');
        tone('sine', 90, 35, hitAt, 0.32, toneLvl);
      } catch (swallowed) {}
    }
    function crashCall(hitPower) {
      fireCrash(hitPower);
    }
    function setScreech(onVal, powerVal) {
      try {
        au.screechOn = !(!(onVal));
        au.screechInt = clampUnit(powerVal);
        au.lastScreech = nowSecs();
        if (onVal) {
          const acLive = getCtx();
          if (acLive && ('suspended' === acLive.state)) acLive.resume().catch(() => {});
        }
      } catch (swallowed) {}
    }
    function playNoteSeq(notesArr, waveType, beginAt, gapVal, lenSecs, lvlVal) {
      let noteIdx = 0;
      while (notesArr.length > noteIdx) {
        tone(waveType, notesArr[noteIdx], notesArr[noteIdx], beginAt + (noteIdx * gapVal), lenSecs, lvlVal);
        noteIdx = (noteIdx + 1);
      }
    }
    function playSfx(sfxName) {
      try {
        const acLive = getCtx();
        if (!acLive) return;
        if ('suspended' === acLive.state) acLive.resume().catch(() => {});
        const sfxAt = (acLive.currentTime + 0.01);
        switch (sfxName) {
          case 'click': tone('square', 880, 660, sfxAt, 0.06, 0.07); break;
          case 'cash': {
            tone('sine', 988, 988, sfxAt, 0.08, 0.12);
            tone('sine', 1319, 1319, sfxAt + 0.08, 0.14, 0.12);
            break;
          }
          case 'win': playNoteSeq([523, 659, 784, 1047], 'triangle', sfxAt, 0.09, 0.16, 0.13); break;
          case 'fail': {
            const failSeq = [392, 330, 262];
            let failIdx = 0;
            while (failSeq.length > failIdx) {
              tone('sawtooth', failSeq[failIdx], failSeq[failIdx], sfxAt + (failIdx * 0.13), 0.16, 0.07);
              failIdx = (failIdx + 1);
            }
            break;
          }
          case 'busted': {
            tone('sawtooth', 900, 280, sfxAt, 0.8, 0.1);
            tone('sawtooth', 905, 285, sfxAt, 0.8, 0.05);
            break;
          }
          case 'pickup': tone('sine', 660, 990, sfxAt, 0.09, 0.1); break;
          case 'crash': fireCrash(0.75); break;
          case 'shot': {
            noiseHit(sfxAt, 0.12, 0.3, 900, 'lowpass');
            tone('square', 220, 55, sfxAt, 0.12, 0.16);
            break;
          }
          case 'smg': {
            noiseHit(sfxAt, 0.07, 0.22, 1100, 'lowpass');
            tone('square', 260, 70, sfxAt, 0.07, 0.12);
            break;
          }
          case 'dry': tone('square', 1200, 900, sfxAt, 0.03, 0.06); break;
          case 'reload': {
            tone('square', 700, 500, sfxAt, 0.04, 0.09);
            tone('square', 950, 650, sfxAt + 0.13, 0.04, 0.09);
            break;
          }
          case 'swing': noiseHit(sfxAt, 0.18, 0.12, 700, 'bandpass'); break;
          case 'thud': tone('sine', 90, 40, sfxAt, 0.15, 0.3); break;
          default: break;
        }
      } catch (swallowed) {}
    }
    // Twin oscillator horn, with start, stop and timed one-shot.
    function hornStartFn() {
      try {
        if (au.hornOn) return;
        const acLive = getCtx();
        if (!acLive) return;
        if ('suspended' === acLive.state) acLive.resume().catch(() => {});
        if (au.hornTimer) { clearTimeout(au.hornTimer); au.hornTimer = null; }
        const hornClock = acLive.currentTime;
        const hornLow = acLive.createOscillator();
        hornLow.type = 'sawtooth';
        hornLow.frequency.value = 370;
        const hornHigh = acLive.createOscillator();
        hornHigh.type = 'sawtooth';
        hornHigh.frequency.value = 440;
        hornHigh.detune.value = 4;
        const hornFilter = acLive.createBiquadFilter();
        hornFilter.type = 'lowpass';
        hornFilter.frequency.value = 1200;
        hornFilter.Q.value = 1;
        const hornGain = acLive.createGain();
        hornGain.gain.setValueAtTime(0, hornClock);
        hornGain.gain.linearRampToValueAtTime(0.16, hornClock + 0.01);
        hornLow.connect(hornFilter);
        hornHigh.connect(hornFilter);
        hornFilter.connect(hornGain);
        hornGain.connect(au.master);
        hornLow.start(hornClock);
        hornHigh.start(hornClock);
        au.hornOsc1 = hornLow;
        au.hornOsc2 = hornHigh;
        au.hornFilter = hornFilter;
        au.hornGain = hornGain;
        au.hornOn = true;
      } catch (swallowed) {}
    }
    function hornStopFn() {
      try {
        if (!au.hornOn) return;
        au.hornOn = false;
        if (au.hornTimer) { clearTimeout(au.hornTimer); au.hornTimer = null; }
        const acLive = au.ctx;
        const hornLow = au.hornOsc1;
        const hornHigh = au.hornOsc2;
        const hornGainNode = au.hornGain;
        au.hornOsc1 = null;
        au.hornOsc2 = null;
        au.hornFilter = null;
        au.hornGain = null;
        if (!acLive || !hornGainNode) {
          try { hornLow && hornLow.stop(); } catch (swallowed) {}
          try { hornHigh && hornHigh.stop(); } catch (swallowed) {}
          return;
        }
        const hornClock = acLive.currentTime;
        try {
          hornGainNode.gain.cancelScheduledValues(hornClock);
          hornGainNode.gain.setValueAtTime(hornGainNode.gain.value, hornClock);
          hornGainNode.gain.linearRampToValueAtTime(0, hornClock + 0.08);
          if (hornLow) hornLow.stop(hornClock + 0.1);
          if (hornHigh) hornHigh.stop(hornClock + 0.1);
        } catch (swallowed) {}
      } catch (swallowed) {}
    }
    function hornOnceFn(holdVal) {
      try {
        const holdLen = (Number.isFinite(holdVal) && (holdVal > 0)) ? Math.min(holdVal, 1.2) : 0.35;
        hornStartFn();
        if (au.hornTimer) clearTimeout(au.hornTimer);
        au.hornTimer = setTimeout(() => { au.hornTimer = null; hornStopFn(); }, holdLen * 1000);
      } catch (swallowed) {}
    }
    function setEngine(onVal, rpmIn) {
      try {
        au.engOn = !(!(onVal));
        au.engRpm = clampUnit(rpmIn);
        au.lastSetEngine = nowSecs();
        if (onVal) {
          const acLive = getCtx();
          if (acLive && ('suspended' === acLive.state)) acLive.resume().catch(() => {});
        }
      } catch (swallowed) {}
    }
    function resumeFn() {
      try {
        const acLive = getCtx();
        if (acLive && ('suspended' === acLive.state)) acLive.resume().catch(() => {});
      } catch (swallowed) {}
    }
    function toggleMuteFn() {
      try {
        apiObj.muted = !(apiObj.muted);
        const acLive = getCtx();
        if (acLive && au.master) {
          const muteClock = acLive.currentTime;
          au.master.gain.cancelScheduledValues(muteClock);
          au.master.gain.setTargetAtTime(apiObj.muted ? 0 : 0.5, muteClock, 0.05);
        }
      } catch (swallowed) {}
      return apiObj.muted;
    }
    // Synthwave sequencer data: step length, rotating bass roots
    // and the pad chord cycle.
    const STEP_LEN = (60 / 100) / 2;
    const BASS_LINE = [33, 29, 36, 31];
    const PAD_SETS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    function midiHz(midiIn) {
      const expPart = (midiIn + -69) / 12;
      return 440 * Math.pow(2, expPart);
    }
    function padVoice(noteIn, whenAt) {
      const acLive = au.ctx;
      try {
        const padOsc = acLive.createOscillator();
        const padGain = acLive.createGain();
        padOsc.type = 'triangle';
        padOsc.frequency.value = midiHz(noteIn);
        padGain.gain.setValueAtTime(0, whenAt);
        padGain.gain.linearRampToValueAtTime(0.05, whenAt + 0.4);
        padGain.gain.setValueAtTime(0.05, whenAt + (STEP_LEN * 8) - 0.4);
        padGain.gain.linearRampToValueAtTime(0, whenAt + (STEP_LEN * 8));
        padOsc.connect(padGain);
        padGain.connect(au.musicBus);
        padOsc.start(whenAt);
        padOsc.stop(whenAt + (STEP_LEN * 8) + 0.05);
      } catch (swallowed) {}
    }
    function hatVoice(whenAt) {
      try {
        const acLive = au.ctx;
        const hatSrc = acLive.createBufferSource();
        hatSrc.buffer = au.noiseBuf;
        const hatFilter = acLive.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.value = 6000;
        const hatGain = acLive.createGain();
        hatGain.gain.setValueAtTime(0.25, whenAt);
        hatGain.gain.exponentialRampToValueAtTime(0.001, whenAt + 0.04);
        hatSrc.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(au.musicBus);
        hatSrc.start(whenAt);
        hatSrc.stop(whenAt + 0.06);
      } catch (swallowed) {}
    }
    function musicStep(stepIdx, whenAt) {
      const barIdx = Math.floor(stepIdx / 8) % 4;
      const barPos = stepIdx % 8;
      const rootMidi = BASS_LINE[barIdx];
      if (0 === (barPos % 2)) {
        const bassMidi = (4 === barPos) ? (12 + rootMidi) : rootMidi;
        tone('sawtooth', midiHz(bassMidi), midiHz(bassMidi), whenAt, 0.22, 0.16, au.musicBus);
      } else if (7 === barPos) {
        tone('sawtooth', midiHz(rootMidi + 7), midiHz(rootMidi + 7), whenAt, 0.14, 0.1, au.musicBus);
      }
      if (0 === barPos) PAD_SETS[barIdx].forEach((chordMidi) => padVoice(chordMidi, whenAt));
      if (1 === (barPos % 2)) hatVoice(whenAt);
    }
    // Station roster and the per-genre pattern tables.
    const STATIONS = [
      { name: 'WAVEFORM FM', bpm: 100, kind: 'wave' },
      { name: 'LOFI BAY', bpm: 76, kind: 'lofi' },
      { name: 'EUROBEAT KAI', bpm: 150, kind: 'euro' },
    ];
    const LOFI_SETS = [[53, 57, 60, 64], [50, 53, 57, 60], [48, 52, 55, 59], [52, 55, 59, 62]];
    const LOFI_BASS = [29, 26, 24, 28];
    const EURO_BASS = [33, 33, 29, 31];
    const EURO_MELODY = [
      69, 0, 72, 0, 76, 0, 72, 0,
      74, 0, 76, 0, 79, 0, 76, 0,
      69, 0, 72, 0, 76, 0, 81, 0,
      79, 76, 74, 0, 72, 0, 0, 0,
    ];
    function kickHit(whenAt, lvlVal) {
      tone('sine', 130, 45, whenAt, 0.14, lvlVal, au.radioBus);
    }
    function hatTick(whenAt, lvlVal, lenVal) {
      noiseHitTo(whenAt, lenVal || 0.04, lvlVal, 6500, 'highpass', au.radioBus);
    }
    function radioBass(whenAt, midiIn, lenSecs, lvlVal) {
      tone('sawtooth', midiHz(midiIn), midiHz(midiIn), whenAt, lenSecs, lvlVal, au.radioFilter);
    }
    function radioPad(whenAt, midiArr, lenSecs, lvlVal, detuneAmt) {
      const acLive = au.ctx;
      if (!acLive) return;
      midiArr.forEach((noteIn) => {
        [-1, 1].forEach((signAmt) => {
          try {
            const padOsc = acLive.createOscillator();
            const padGain = acLive.createGain();
            padOsc.type = 'triangle';
            padOsc.frequency.value = midiHz(noteIn);
            padOsc.detune.value = signAmt * (detuneAmt || 6);
            padGain.gain.setValueAtTime(0, whenAt);
            padGain.gain.linearRampToValueAtTime(lvlVal, whenAt + Math.min(0.4, lenSecs * 0.3));
            padGain.gain.setValueAtTime(lvlVal, whenAt + Math.max(0, lenSecs - 0.35));
            padGain.gain.linearRampToValueAtTime(0, whenAt + lenSecs);
            padOsc.connect(padGain);
            padGain.connect(au.radioBus);
            padOsc.start(whenAt);
            padOsc.stop(whenAt + (lenSecs + 0.05));
          } catch (swallowed) {}
        });
      });
    }
    function stationStep(stepIdx, whenAt) {
      const stationCur = STATIONS[au.radioIdx];
      if (!stationCur || !au.ctx) return;
      const stepLen = (60 / stationCur.bpm) / 4;
      const barLen = 16 * stepLen;
      const barIdx = Math.floor(stepIdx / 16);
      const barPos = stepIdx % 16;
      switch (stationCur.kind) {
        case 'wave': {
          const cyclePos = barIdx % 4;
          const rootMidi = BASS_LINE[cyclePos];
          if (0 === (barPos % 2)) radioBass(whenAt, (8 === barPos) ? (12 + rootMidi) : rootMidi, 0.22, 0.5);
          if (0 === barPos) radioPad(whenAt, PAD_SETS[cyclePos], barLen, 0.055, 7);
          const arpSet = PAD_SETS[cyclePos];
          const arpMidi = arpSet[barPos % 3] + 12 + ((6 === (barPos % 8)) ? 7 : 0);
          tone('square', midiHz(arpMidi), midiHz(arpMidi), whenAt, 0.09, 0.07, au.radioBus);
          if (2 === (barPos % 4)) hatTick(whenAt, 0.1);
          break;
        }
        case 'lofi': {
          const cyclePos = barIdx % 4;
          if (0 === barPos) {
            radioPad(whenAt, LOFI_SETS[cyclePos], barLen, 0.085, 5 + (Math.sin(barIdx * 1.7) * 4));
            tone('triangle', midiHz(LOFI_BASS[cyclePos] + 12), midiHz(LOFI_BASS[cyclePos] + 12), whenAt, barLen * 0.9, 0.22, au.radioBus);
          }
          if ((0 === barPos) || (10 === barPos)) kickHit(whenAt, 0.32);
          if ((4 === barPos) || (12 === barPos)) noiseHitTo(whenAt, 0.09, 0.09, 1800, 'bandpass', au.radioBus);
          if (2 === (barPos % 4)) hatTick(whenAt, 0.045);
          if (0 === (barPos % 2)) noiseHitTo(whenAt, 0.02, 0.014, 1600, 'lowpass', au.radioBus);
          break;
        }
        default: {
          const cyclePos = barIdx % 4;
          const rootMidi = EURO_BASS[cyclePos];
          if (0 === (barPos % 4)) kickHit(whenAt, 0.5);
          if (2 === (barPos % 4)) radioBass(whenAt, rootMidi + 12, 0.16, 0.42);
          if (2 === (barPos % 4)) hatTick(whenAt, 0.13, 0.07);
          else if (0 === (barPos % 2)) hatTick(whenAt, 0.04);
          if (0 === barPos) radioPad(whenAt, PAD_SETS[(1 === cyclePos) ? 0 : cyclePos], stepLen * 4, 0.04, 5);
          const leadMidi = EURO_MELODY[((barIdx % 2) * 16) + barPos];
          if (leadMidi) tone('sawtooth', midiHz(leadMidi), midiHz(leadMidi), whenAt, 0.17, 0.16, au.radioBus);
          break;
        }
      }
    }
    function pumpRadio() {
      const acLive = au.ctx;
      if (!acLive || !au.radioOn) return;
      if ('running' !== acLive.state) return;
      const stationCur = STATIONS[au.radioIdx];
      const stepLen = (60 / stationCur.bpm) / 4;
      if (acLive.currentTime > au.radioNextAt) au.radioNextAt = acLive.currentTime + 0.05;
      while ((acLive.currentTime + 0.2) > au.radioNextAt) {
        stationStep(au.radioStep, au.radioNextAt);
        au.radioStep = (1 + au.radioStep);
        au.radioNextAt = (stepLen + au.radioNextAt);
      }
    }
    function stationNow() {
      return au.radioOn ? { name: STATIONS[au.radioIdx].name, index: au.radioIdx } : null;
    }
    function startStationAt(idxIn) {
      try {
        const stationCount = STATIONS.length;
        au.radioIdx = (((Math.floor(Number(idxIn) || 0) % stationCount) + stationCount) % stationCount);
        au.radioOn = true;
        au.radioStep = 0;
        const acLive = getCtx();
        if (acLive) {
          if ('suspended' === acLive.state) acLive.resume().catch(() => {});
          au.radioNextAt = acLive.currentTime + 0.06;
          if (!au.radioTimer) au.radioTimer = setInterval(pumpRadio, 100);
          pumpRadio();
        }
      } catch (swallowed) {}
      return stationNow();
    }
    function stopStationFn() {
      try {
        au.radioOn = false;
        if (au.radioTimer) { clearInterval(au.radioTimer); au.radioTimer = null; }
        au.musicStarted = false;
      } catch (swallowed) {}
    }
    function nextStationFn() {
      try {
        const lastPos = STATIONS.length - 1;
        if (!au.radioOn) return startStationAt(0);
        if (lastPos > au.radioIdx) return startStationAt(au.radioIdx + 1);
        stopStationFn();
      } catch (swallowed) {}
      return stationNow();
    }
    const radioApi = {
      start: startStationAt,
      stop: stopStationFn,
      next: nextStationFn,
      current: stationNow,
    };
    function pumpMusic() {
      const acLive = au.ctx;
      if (!acLive || ('running' !== acLive.state)) return;
      if (au.radioOn) return;
      if (!au.musicStarted) {
        au.musicStarted = true;
        au.step = 0;
        au.nextStepAt = acLive.currentTime + 0.06;
      }
      while (au.nextStepAt < (acLive.currentTime + 0.15)) {
        musicStep(au.step, au.nextStepAt);
        au.step = (1 + au.step);
        au.nextStepAt = (STEP_LEN + au.nextStepAt);
      }
    }
    // Frame poll: engine blend, skid level, the crash edge, the
    // siren proximity sweep and the music scheduler.
    function frameTick(dtIn) {
      try {
        const dtStep = (Number.isFinite(dtIn) && (dtIn > 0) && (1 > dtIn)) ? dtIn : 1 / 60;
        const acLive = au.ctx;
        if (!acLive) return;
        const wallNow = nowSecs();
        const flagsObj = gmObj.flags || {};
        if ((wallNow - au.lastSetEngine) > 0.3) {
          if (flagsObj.inCar && gmObj.car) {
            let rpmPart = 0;
            try {
              const topSpeedIn = gmObj.car.spec && gmObj.car.spec.topSpeed;
              rpmPart = topSpeedIn ? Math.abs(gmObj.car.speed || 0) / (topSpeedIn / 3.6) : Math.abs(gmObj.car.speed || 0) / 50;
            } catch (swallowed) { rpmPart = 0; }
            au.engOn = true;
            au.engRpm = Math.max(0.07, clampUnit(rpmPart));
          } else { au.engOn = false; }
        }
        const easeAmt = Math.min(1, dtStep * 9);
        au.engRpmCur = au.engRpmCur + ((au.engRpm - au.engRpmCur) * easeAmt);
        const gainTarget = au.engOn ? (0.05 + (au.engRpmCur * 0.1)) : 0;
        au.engGainCur = au.engGainCur + ((gainTarget - au.engGainCur) * easeAmt);
        if (au.engOsc1 && au.engGain) {
          const pitchNow = 60 + (au.engRpmCur * 220);
          au.engOsc1.frequency.value = pitchNow;
          au.engOsc2.frequency.value = pitchNow;
          au.engFilter.frequency.value = 350 + (au.engRpmCur * 1600);
          au.engGain.gain.value = au.engGainCur;
        }
        let skidTarget = flagsObj.drifting ? 0.06 : 0;
        if (0.3 > (wallNow - au.lastScreech)) {
          skidTarget = au.screechOn ? (0.03 + (0.11 * au.screechInt)) : 0;
          if (au.skidFilter) au.skidFilter.frequency.value = 750 + (350 * au.screechInt);
        }
        au.skidCur = au.skidCur + ((skidTarget - au.skidCur) * Math.min(1, dtStep * 12));
        if (au.skidGain) au.skidGain.gain.value = au.skidCur;
        const crashIn = flagsObj.crashTimer;
        let crashLvl = 0;
        if ('number' === typeof crashIn) crashLvl = ct;
        else if (crashIn) crashLvl = 1;
        if (((crashLvl > 0) && !(au.prevCrash > 0)) || ((au.prevCrash + 0.001) < crashLvl)) {
          if (crashLvl !== au.prevCrash) playSfx('crash');
        }
        au.prevCrash = crashLvl;
        let sirenOn = false;
        try {
          if (((gmObj.wanted || 0) >= 2) && Array.isArray(gmObj.cops) && gmObj.cops.length) {
            const selfSpot = locateObj((flagsObj.inCar && gmObj.car) ? gmObj.car : gmObj.player) || locateObj(gmObj.car) || locateObj(gmObj.player);
            if (selfSpot) {
              gmObj.cops.some((copUnit) => {
                const copSpot = locateObj(copUnit);
                if (!copSpot) return false;
                const gapX = copSpot.x - selfSpot.x;
                const gapZ = copSpot.z - selfSpot.z;
                if (!(((gapX * gapX) + (gapZ * gapZ)) > 3600)) { sirenOn = true; return true; }
                return false;
              });
            }
          }
        } catch (swallowed) { sirenOn = false; }
        au.sirCur = au.sirCur + (((sirenOn ? 0.04 : 0) - au.sirCur) * Math.min(1, dtStep * 8));
        if (au.sirGain && au.sirOsc) {
          au.sirGain.gain.value = au.sirCur;
          if (sirenOn) au.sirOsc.frequency.value = (0 === (Math.floor(wallNow * 2.8) % 2)) ? 720 : 960;
        }
        pumpMusic();
      } catch (swallowed) {}
    }
    const apiObj = {
      muted: false,
      play: playSfx,
      toggleMute: toggleMuteFn,
      setEngine: setEngine,
      resume: resumeFn,
      horn: hornOnceFn,
      hornStart: hornStartFn,
      hornStop: hornStopFn,
      screech: setScreech,
      setScreech: setScreech,
      crash: crashCall,
      radio: radioApi,
    };
    gmObj.audio = apiObj;
    try {
      if (Array.isArray(gmObj.updaters)) gmObj.updaters.push(frameTick);
      else if (gmObj.updaters && ('function' === typeof gmObj.updaters.add)) gmObj.updaters.add(frameTick);
      else if (null == gmObj.updaters) gmObj.updaters = [frameTick];
    } catch (swallowed) {}
  } catch (outerErr) {
    try {
      if (gmObj && !gmObj.audio) {
        const fallbackApi = { muted: true, radio: { start() {}, stop() {}, next() {}, current() { return null; } } };
        fallbackApi.play = function () {};
        fallbackApi.toggleMute = function () {};
        fallbackApi.setEngine = function () {};
        fallbackApi.resume = function () {};
        fallbackApi.horn = function () {};
        fallbackApi.hornStart = function () {};
        fallbackApi.hornStop = function () {};
        fallbackApi.screech = function () {};
        fallbackApi.setScreech = function () {};
        fallbackApi.crash = function () {};
        gmObj.audio = fallbackApi;
      }
    } catch (swallowed) {}
  }
}
