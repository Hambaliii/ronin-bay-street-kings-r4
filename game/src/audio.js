// No samples are played anywhere in this module: each sound is
// synthesized live from WebAudio oscillators and filtered noise.
// The engine loop, the skid, the siren, the interface blips and
// the two music sequencers all live below, and every public
// entry point is guarded so a missing context can never throw.
function clampUnit(inVal) {
  const asNum = Number(inVal);
  if (!Number.isFinite(asNum)) return 0;
  if (0 > asNum) return 0;
  const capOut = (asNum > 1) ? 1 : asNum;
  return capOut; }
const MS_IN_SEC = 1000;
function secsNow() {
  try { const perfLive = ('undefined' !== typeof performance) && performance.now;
    if (perfLive) return (performance.now() / MS_IN_SEC); } catch (muteErr) {}
  return (Date.now() / MS_IN_SEC); }
// Callers hand us entities in many shapes; find one with x/z.
function findCarrier(entArg) {
  if (!entArg || ('object' !== typeof entArg)) return null;
  const carrierList = [];
  carrierList.push(entArg.position, entArg.pos, entArg.group && entArg.group.position, entArg.mesh && entArg.mesh.position, entArg);
  let probeIdx = 0;
  while (carrierList.length > probeIdx) { const probeNode = carrierList[probeIdx]; probeIdx = (probeIdx + 1);
    if (probeNode && Number.isFinite(probeNode.x) && Number.isFinite(probeNode.z)) return probeNode; }
  return null; }
export function initAudio(game) {
  try { if (!game || ('object' !== typeof game)) return;
    if (game.__audioInit) return;
    game.__audioInit = true;
    const mix = {};
    const seedBankA = { ctx: null, master: null, musicBus: null, noiseBuf: null };
    seedBankA.engOsc1 = null; seedBankA.engOsc2 = null;
    seedBankA.engFilter = null; seedBankA.engGain = null;
    seedBankA.engOn = false; seedBankA.engRpm = 0;
    seedBankA.engRpmCur = 0; seedBankA.engGainCur = 0;
    seedBankA.lastSetEngine = -10;
    const seedBankB = { skidSrc: null, skidFilter: null, skidGain: null, skidCur: 0 };
    seedBankB.screechOn = false; seedBankB.screechInt = 0;
    seedBankB.lastScreech = -10; seedBankB.lastCrashAt = -10;
    seedBankB.radioBus = null; seedBankB.radioFilter = null;
    seedBankB.radioOn = false; seedBankB.radioIdx = 0;
    seedBankB.radioStep = 0; seedBankB.radioNextAt = 0; seedBankB.radioTimer = null;
    seedBankB.sirOsc = null; seedBankB.sirGain = null; seedBankB.sirCur = 0;
    seedBankB.musicStarted = false; seedBankB.step = 0; seedBankB.nextStepAt = 0;
    seedBankB.prevCrash = 0;
    seedBankB.hornOsc1 = null; seedBankB.hornOsc2 = null;
    seedBankB.hornFilter = null; seedBankB.hornGain = null;
    seedBankB.hornOn = false; seedBankB.hornTimer = null;
    Object.assign(mix, seedBankA, seedBankB);
    const winLive = ('undefined' !== typeof window);
    const AudioCtor = (winLive && (window.AudioContext || window.webkitAudioContext)) || null;
    function lcgNext(stateVal) {
      return ((stateVal * 1103515245) + 12345) & 0x7fffffff; }
    function noiseBufferOf(acIn) {
      const lenSamples = acIn.sampleRate;
      const bufNode = acIn.createBuffer(1, lenSamples, acIn.sampleRate);
      const chanData = bufNode.getChannelData(0);
      let lcgSeed = 22222; let samplePos = 0;
      while (lenSamples > samplePos) { lcgSeed = lcgNext(lcgSeed);
        chanData[samplePos] = (lcgSeed / 0x40000000) + -1;
        samplePos = (samplePos + 1); }
      return bufNode; }
    function engineChainOf(acIn) {
      try { const engFilterNode = acIn.createBiquadFilter();
        engFilterNode.type = 'lowpass'; engFilterNode.frequency.value = 400; engFilterNode.Q.value = 2;
        const engGainOut = acIn.createGain(); engGainOut.gain.value = 0;
        const engOscA = acIn.createOscillator(); engOscA.type = 'sawtooth';
        const engOscB = acIn.createOscillator(); engOscB.type = 'square'; engOscB.detune.value = 9;
        engOscA.connect(engFilterNode); engOscB.connect(engFilterNode);
        engFilterNode.connect(engGainOut); engGainOut.connect(mix.master);
        engOscA.frequency.value = 60; engOscB.frequency.value = 60;
        engOscA.start(); engOscB.start();
        mix.engOsc1 = engOscA; mix.engOsc2 = engOscB;
        mix.engFilter = engFilterNode; mix.engGain = engGainOut; } catch (muteErr) {} }
    function skidChainOf(acIn) {
      try { const skidSrcNode = acIn.createBufferSource();
        skidSrcNode.buffer = mix.noiseBuf; skidSrcNode.loop = true;
        const skidFilterNode = acIn.createBiquadFilter();
        skidFilterNode.type = 'bandpass'; skidFilterNode.frequency.value = 900; skidFilterNode.Q.value = 2;
        const skidGainOut = acIn.createGain(); skidGainOut.gain.value = 0;
        skidSrcNode.connect(skidFilterNode); skidFilterNode.connect(skidGainOut);
        skidGainOut.connect(mix.master); skidSrcNode.start();
        mix.skidSrc = skidSrcNode; mix.skidFilter = skidFilterNode; mix.skidGain = skidGainOut; } catch (muteErr) {} }
    function sirenChainOf(acIn) {
      try { const sirOscOut = acIn.createOscillator();
        sirOscOut.type = 'square'; sirOscOut.frequency.value = 720;
        const sirGainOut = acIn.createGain(); sirGainOut.gain.value = 0;
        sirOscOut.connect(sirGainOut); sirGainOut.connect(mix.master);
        sirOscOut.start();
        mix.sirOsc = sirOscOut; mix.sirGain = sirGainOut; } catch (muteErr) {} }
    function busOf(acIn, busLvl) {
      const busGainNode = acIn.createGain(); busGainNode.gain.value = busLvl;
      busGainNode.connect(mix.master);
      return busGainNode; }
    function radioFilterOf(acIn) {
      const radioFilterNode = acIn.createBiquadFilter();
      radioFilterNode.type = 'lowpass'; radioFilterNode.frequency.value = 950; radioFilterNode.Q.value = 1;
      radioFilterNode.connect(mix.radioBus); mix.radioFilter = radioFilterNode; }
    function ctxOf() {
      if (mix.ctx) return mix.ctx;
      if (!AudioCtor) return null;
      try { const freshCtx = new AudioCtor();
        mix.ctx = freshCtx;
        mix.master = freshCtx.createGain();
        mix.master.gain.value = pubApi.muted ? 0 : 0.5;
        mix.master.connect(freshCtx.destination);
        mix.musicBus = busOf(freshCtx, 0.05);
        mix.radioBus = busOf(freshCtx, 0.16);
        radioFilterOf(freshCtx);
        mix.noiseBuf = noiseBufferOf(freshCtx);
        engineChainOf(freshCtx); skidChainOf(freshCtx); sirenChainOf(freshCtx);
        return freshCtx; } catch (muteErr) { mix.ctx = null; return null; } }
    // One enveloped tone; the pitch glide folded into it only
    // runs when the start and end pitches actually differ.
    function toneHit(waveKind, startHz, endHz, whenAt, lenSecs, lvlVal, destBus) {
      const ctxLive = mix.ctx;
      if (!ctxLive) return;
      try { const oscOut = ctxLive.createOscillator();
        const gainOut = ctxLive.createGain();
        oscOut.type = waveKind;
        oscOut.frequency.setValueAtTime(Math.max(20, startHz), whenAt);
        const glideFlag = !(!endHz) && (startHz !== endHz);
        if (glideFlag) oscOut.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), (lenSecs + whenAt));
        gainOut.gain.setValueAtTime(0, whenAt);
        gainOut.gain.linearRampToValueAtTime(lvlVal, (0.012 + whenAt));
        gainOut.gain.exponentialRampToValueAtTime(0.0001, (lenSecs + whenAt));
        oscOut.connect(gainOut); gainOut.connect(destBus || mix.master);
        oscOut.start(whenAt); oscOut.stop(((lenSecs + 0.05) + whenAt)); } catch (muteErr) {} }
    function noiseShot(whenAt, lenSecs, lvlVal, freqHz, kindName, destBus, rateNum) {
      const ctxLive = mix.ctx;
      if (!ctxLive || !mix.noiseBuf) return;
      try { const shotSrc = ctxLive.createBufferSource();
        shotSrc.buffer = mix.noiseBuf;
        if (rateNum !== undefined) shotSrc.playbackRate.value = rateNum;
        const shotFilterNode = ctxLive.createBiquadFilter();
        shotFilterNode.type = kindName || 'lowpass'; shotFilterNode.frequency.value = freqHz;
        const shotGainNode = ctxLive.createGain();
        shotGainNode.gain.setValueAtTime(lvlVal, whenAt);
        shotGainNode.gain.exponentialRampToValueAtTime(0.0001, (lenSecs + whenAt));
        shotSrc.connect(shotFilterNode); shotFilterNode.connect(shotGainNode);
        shotGainNode.connect(destBus || mix.master);
        shotSrc.start(whenAt); shotSrc.stop(((lenSecs + 0.05) + whenAt)); } catch (muteErr) {} }
    function noisePlain(whenAt, lenSecs, lvlVal, freqHz, kindName) {
      noiseShot(whenAt, lenSecs, lvlVal, freqHz, kindName, undefined, undefined); }
    function noiseToBus(whenAt, lenSecs, lvlVal, freqHz, kindName, destBus) {
      const ctxLive = mix.ctx;
      if (!ctxLive || !mix.noiseBuf) return;
      try { const busSrc = ctxLive.createBufferSource();
        busSrc.buffer = mix.noiseBuf;
        busSrc.playbackRate.value = ((((whenAt * 7) % 1) * 0.6) + 0.7);
        const busFilterNode = ctxLive.createBiquadFilter();
        busFilterNode.type = kindName || 'lowpass'; busFilterNode.frequency.value = freqHz;
        const busGainOut = ctxLive.createGain();
        busGainOut.gain.setValueAtTime(lvlVal, whenAt);
        busGainOut.gain.exponentialRampToValueAtTime(0.0001, (lenSecs + whenAt));
        busSrc.connect(busFilterNode); busFilterNode.connect(busGainOut);
        busGainOut.connect(destBus || mix.master);
        busSrc.start(whenAt); busSrc.stop(((lenSecs + 0.05) + whenAt)); } catch (muteErr) {} }
    // The impact thud, debounced against the context clock.
    function crashFire(powerVal) {
      try { const ctxLive = ctxOf();
        if (!ctxLive) return;
        const impactAmt = Math.max(0.15, clampUnit(powerVal));
        const crashClock = ctxLive.currentTime;
        if ((crashClock + -mix.lastCrashAt) < 0.12) return;
        mix.lastCrashAt = crashClock;
        const hitWhen = (0.005 + crashClock);
        noisePlain(hitWhen, 0.26, (0.5 * impactAmt), ((260 * impactAmt) + 300), 'lowpass');
        toneHit('sine', 90, 35, hitWhen, 0.32, (0.48 * impactAmt)); } catch (muteErr) {} }
    function screechSet(flagOn, powVal) {
      try { mix.screechOn = !(!(flagOn));
        mix.screechInt = clampUnit(powVal);
        mix.lastScreech = secsNow();
        if (flagOn) { const ctxLive = ctxOf();
          if (ctxLive && ('suspended' === ctxLive.state)) ctxLive.resume().catch(() => {}); } } catch (muteErr) {} }
    function noteSeqPlay(seqNotes, waveKind, beginAt, gapVal, lenSecs, lvlVal) {
      seqNotes.forEach((seqHz, seqIdx) => {
        toneHit(waveKind, seqHz, seqHz, ((seqIdx * gapVal) + beginAt), lenSecs, lvlVal); }); }
    function sfxPlay(sfxKey) {
      try { const ctxLive = ctxOf();
        if (!ctxLive) return;
        if ('suspended' === ctxLive.state) ctxLive.resume().catch(() => {});
        const sfxWhen = (0.01 + ctxLive.currentTime);
        // The old switch dispatch is a plain if-chain now; the
        // names, order and sounds are exactly what they were.
        if ('click' === sfxKey) toneHit('square', 880, 660, sfxWhen, 0.06, 0.07);
        else if ('cash' === sfxKey) { toneHit('sine', 988, 988, sfxWhen, 0.08, 0.12);
          toneHit('sine', 1319, 1319, (0.08 + sfxWhen), 0.14, 0.12); }
        else if ('win' === sfxKey) noteSeqPlay([523, 659, 784, 1047], 'triangle', sfxWhen, 0.09, 0.16, 0.13);
        else if ('fail' === sfxKey) { const failNotes = [392, 330, 262];
          failNotes.forEach((failHzVal, failIdx) => {
            toneHit('sawtooth', failHzVal, failHzVal, ((failIdx * 0.13) + sfxWhen), 0.16, 0.07); }); }
        else if ('busted' === sfxKey) { toneHit('sawtooth', 900, 280, sfxWhen, 0.8, 0.1);
          toneHit('sawtooth', 905, 285, sfxWhen, 0.8, 0.05); }
        else if ('pickup' === sfxKey) toneHit('sine', 660, 990, sfxWhen, 0.09, 0.1);
        else if ('crash' === sfxKey) crashFire(0.75);
        else if ('shot' === sfxKey) { noisePlain(sfxWhen, 0.12, 0.3, 900, 'lowpass');
          toneHit('square', 220, 55, sfxWhen, 0.12, 0.16); }
        else if ('smg' === sfxKey) { noisePlain(sfxWhen, 0.07, 0.22, 1100, 'lowpass');
          toneHit('square', 260, 70, sfxWhen, 0.07, 0.12); }
        else if ('dry' === sfxKey) toneHit('square', 1200, 900, sfxWhen, 0.03, 0.06);
        else if ('reload' === sfxKey) { toneHit('square', 700, 500, sfxWhen, 0.04, 0.09);
          toneHit('square', 950, 650, (0.13 + sfxWhen), 0.04, 0.09); }
        else if ('swing' === sfxKey) noisePlain(sfxWhen, 0.18, 0.12, 700, 'bandpass');
        else if ('thud' === sfxKey) toneHit('sine', 90, 40, sfxWhen, 0.15, 0.3); } catch (muteErr) {} }
    // The twin oscillator horn: begin, end, and a timed blast.
    function hornBegin() {
      try { if (mix.hornOn) return;
        const ctxLive = ctxOf();
        if (!ctxLive) return;
        if ('suspended' === ctxLive.state) ctxLive.resume().catch(() => {});
        if (mix.hornTimer) { clearTimeout(mix.hornTimer); mix.hornTimer = null; }
        const hornWhen = ctxLive.currentTime;
        const hornLow = ctxLive.createOscillator();
        hornLow.type = 'sawtooth'; hornLow.frequency.value = 370;
        const hornHigh = ctxLive.createOscillator();
        hornHigh.type = 'sawtooth'; hornHigh.frequency.value = 440; hornHigh.detune.value = 4;
        const hornFilterOut = ctxLive.createBiquadFilter();
        hornFilterOut.type = 'lowpass'; hornFilterOut.frequency.value = 1200; hornFilterOut.Q.value = 1;
        const hornGainOut = ctxLive.createGain();
        hornGainOut.gain.setValueAtTime(0, hornWhen);
        hornGainOut.gain.linearRampToValueAtTime(0.16, (0.01 + hornWhen));
        hornLow.connect(hornFilterOut); hornHigh.connect(hornFilterOut);
        hornFilterOut.connect(hornGainOut); hornGainOut.connect(mix.master);
        hornLow.start(hornWhen); hornHigh.start(hornWhen);
        mix.hornOsc1 = hornLow; mix.hornOsc2 = hornHigh;
        mix.hornFilter = hornFilterOut; mix.hornGain = hornGainOut;
        mix.hornOn = true; } catch (muteErr) {} }
    function hornEnd() {
      try { if (!mix.hornOn) return;
        mix.hornOn = false;
        if (mix.hornTimer) { clearTimeout(mix.hornTimer); mix.hornTimer = null; }
        const ctxLive = mix.ctx;
        const hornLow = mix.hornOsc1; const hornHigh = mix.hornOsc2;
        const hornGainOut = mix.hornGain;
        mix.hornOsc1 = null; mix.hornOsc2 = null;
        mix.hornFilter = null; mix.hornGain = null;
        if (!ctxLive || !hornGainOut) { try { hornLow && hornLow.stop(); } catch (muteErr) {}
          try { hornHigh && hornHigh.stop(); } catch (muteErr) {}
          return; }
        const hornWhen = ctxLive.currentTime;
        try { hornGainOut.gain.cancelScheduledValues(hornWhen);
          hornGainOut.gain.setValueAtTime(hornGainOut.gain.value, hornWhen);
          hornGainOut.gain.linearRampToValueAtTime(0, (0.08 + hornWhen));
          if (hornLow) hornLow.stop((0.1 + hornWhen));
          if (hornHigh) hornHigh.stop((0.1 + hornWhen)); } catch (muteErr) {} } catch (muteErr) {} }
    function hornBlast(holdVal) {
      try { const holdLen = (Number.isFinite(holdVal) && (0 < holdVal)) ? Math.min(holdVal, 1.2) : 0.35;
        hornBegin();
        if (mix.hornTimer) clearTimeout(mix.hornTimer);
        mix.hornTimer = setTimeout(() => { mix.hornTimer = null; hornEnd(); }, (holdLen * 1000)); } catch (muteErr) {} }
    function engineSet(engFlag, rpmIn) {
      try { mix.engOn = !(!(engFlag));
        mix.engRpm = clampUnit(rpmIn);
        mix.lastSetEngine = secsNow();
        if (engFlag) { const ctxLive = ctxOf();
          if (ctxLive && ('suspended' === ctxLive.state)) ctxLive.resume().catch(() => {}); } } catch (muteErr) {} }
    function resumeCtx() {
      try { const ctxLive = ctxOf();
        if (ctxLive && ('suspended' === ctxLive.state)) ctxLive.resume().catch(() => {}); } catch (muteErr) {} }
    function muteToggle() {
      try { pubApi.muted = !(pubApi.muted);
        const ctxLive = ctxOf();
        if (ctxLive && mix.master) { const muteWhen = ctxLive.currentTime;
          mix.master.gain.cancelScheduledValues(muteWhen);
          mix.master.gain.setTargetAtTime(pubApi.muted ? 0 : 0.5, muteWhen, 0.05); } } catch (muteErr) {}
      return pubApi.muted; }
    // Synthwave sequencer data: the step span, the rotating
    // bass roots and the cycle of pad chords.
    const STEP_SPAN = (60 / 100) / 2;
    const BASS_ROOTS = [33, 29, 36, 31];
    const PAD_SETS = [[57, 60, 64], [53, 57, 60],
      [48, 52, 55], [55, 59, 62]];
    function hzFromMidi(midiIn) {
      const expAmt = ((midiIn + -69) / 12);
      return (Math.pow(2, expAmt) * 440); }
    function padNote(noteIn, padWhen) {
      const ctxLive = mix.ctx;
      try { const padOscNode = ctxLive.createOscillator();
        const padGainNode = ctxLive.createGain();
        padOscNode.type = 'triangle'; padOscNode.frequency.value = hzFromMidi(noteIn);
        padGainNode.gain.setValueAtTime(0, padWhen);
        padGainNode.gain.linearRampToValueAtTime(0.05, (0.4 + padWhen));
        padGainNode.gain.setValueAtTime(0.05, ((STEP_SPAN * 8) + padWhen) - 0.4);
        padGainNode.gain.linearRampToValueAtTime(0, ((8 * STEP_SPAN) + padWhen));
        padOscNode.connect(padGainNode); padGainNode.connect(mix.musicBus);
        padOscNode.start(padWhen); padOscNode.stop((((STEP_SPAN * 8) + 0.05) + padWhen)); } catch (muteErr) {} }
    function hatHit(hatWhen) {
      try { const ctxLive = mix.ctx;
        const hatSrc = ctxLive.createBufferSource(); hatSrc.buffer = mix.noiseBuf;
        const hatFilterNode = ctxLive.createBiquadFilter();
        hatFilterNode.type = 'highpass'; hatFilterNode.frequency.value = 6000;
        const hatGainNode = ctxLive.createGain();
        hatGainNode.gain.setValueAtTime(0.25, hatWhen);
        hatGainNode.gain.exponentialRampToValueAtTime(0.001, (0.04 + hatWhen));
        hatSrc.connect(hatFilterNode); hatFilterNode.connect(hatGainNode); hatGainNode.connect(mix.musicBus);
        hatSrc.start(hatWhen); hatSrc.stop((0.06 + hatWhen)); } catch (muteErr) {} }
    function seqStep(stepIdx, stepWhen) {
      const barIdx = Math.floor(stepIdx / 8) % 4;
      const posIdx = stepIdx % 8;
      const rootNote = BASS_ROOTS[barIdx];
      if (0 === (posIdx % 2)) { const bassNote = (4 === posIdx) ? (12 + rootNote) : rootNote;
        toneHit('sawtooth', hzFromMidi(bassNote), hzFromMidi(bassNote), stepWhen, 0.22, 0.16, mix.musicBus);
      } else if (7 === posIdx) { toneHit('sawtooth', hzFromMidi((7 + rootNote)), hzFromMidi((7 + rootNote)), stepWhen, 0.14, 0.1, mix.musicBus); }
      if (0 === posIdx) { const chordArr = PAD_SETS[barIdx];
        chordArr.forEach((chordNote) => padNote(chordNote, stepWhen)); }
      if (1 === (posIdx % 2)) hatHit(stepWhen); }
    // The station roster plus the per-genre pattern tables.
    const STATION_ROWS = [{ name: 'WAVEFORM FM', bpm: 100, kind: 'wave' },
      { name: 'LOFI BAY', bpm: 76, kind: 'lofi' }, { name: 'EUROBEAT KAI', bpm: 150, kind: 'euro' }];
    const LOFI_SETS = [[53, 57, 60, 64], [50, 53, 57, 60], [48, 52, 55, 59], [52, 55, 59, 62]];
    const LOFI_BASS = [29, 26, 24, 28];
    const EURO_BASS = [33, 33, 29, 31];
    const EURO_MELODY = [69, 0, 72, 0, 76, 0, 72, 0,
      74, 0, 76, 0, 79, 0, 76, 0,
      69, 0, 72, 0, 76, 0, 81, 0,
      79, 76, 74, 0, 72, 0, 0, 0];
    function kickDrum(tWhen, lvlVal) {
      toneHit('sine', 130, 45, tWhen, 0.14, lvlVal, mix.radioBus); }
    function tickHat(tWhen, lvlVal, lenVal) {
      noiseToBus(tWhen, (lenVal || 0.04), lvlVal, 6500, 'highpass', mix.radioBus); }
    function bassRadio(tWhen, midiVal, lenSecs, lvlVal) {
      toneHit('sawtooth', hzFromMidi(midiVal), hzFromMidi(midiVal), tWhen, lenSecs, lvlVal, mix.radioFilter); }
    function padRadio(tWhen, midiList, lenSecs, lvlVal, detuneVal) {
      const ctxLive = mix.ctx;
      if (!ctxLive) return;
      midiList.forEach((padNoteVal) => {
        [-1, 1].forEach((signVal) => {
          try { const radioOsc = ctxLive.createOscillator();
            const radioGain = ctxLive.createGain();
            radioOsc.type = 'triangle'; radioOsc.frequency.value = hzFromMidi(padNoteVal);
            radioOsc.detune.value = (signVal * (detuneVal || 6));
            radioGain.gain.setValueAtTime(0, tWhen);
            radioGain.gain.linearRampToValueAtTime(lvlVal, (Math.min(0.4, (lenSecs * 0.3)) + tWhen));
            radioGain.gain.setValueAtTime(lvlVal, (Math.max(0, (lenSecs + -0.35)) + tWhen));
            radioGain.gain.linearRampToValueAtTime(0, (lenSecs + tWhen));
            radioOsc.connect(radioGain); radioGain.connect(mix.radioBus);
            radioOsc.start(tWhen); radioOsc.stop(((lenSecs + 0.05) + tWhen)); } catch (muteErr) {} }); }); }
    function radioStepPlay(stepIdx, tWhen) {
      const stationNow = STATION_ROWS[mix.radioIdx];
      if (!stationNow || !mix.ctx) return;
      const stepSecs = (60 / stationNow.bpm) / 4;
      const barSecs = (16 * stepSecs);
      const barPos = Math.floor(stepIdx / 16);
      const stepPos = stepIdx % 16;
      switch (stationNow.kind) {
        case 'wave': { const cycleIdx = barPos % 4;
          const rootNoteVal = BASS_ROOTS[cycleIdx];
          if (0 === (stepPos % 2)) bassRadio(tWhen, (8 === stepPos) ? (12 + rootNoteVal) : rootNoteVal, 0.22, 0.5);
          if (0 === stepPos) padRadio(tWhen, PAD_SETS[cycleIdx], barSecs, 0.055, 7);
          const arpArr = PAD_SETS[cycleIdx];
          const arpNote = (12 + arpArr[stepPos % 3]) + ((6 === (stepPos % 8)) ? 7 : 0);
          toneHit('square', hzFromMidi(arpNote), hzFromMidi(arpNote), tWhen, 0.09, 0.07, mix.radioBus);
          if (2 === (stepPos % 4)) tickHat(tWhen, 0.1);
          break; }
        case 'lofi': { const cycleIdx = barPos % 4;
          if (0 === stepPos) { padRadio(tWhen, LOFI_SETS[cycleIdx], barSecs, 0.085, ((Math.sin(barPos * 1.7) * 4) + 5));
            toneHit('triangle', hzFromMidi((12 + LOFI_BASS[cycleIdx])), hzFromMidi((12 + LOFI_BASS[cycleIdx])), tWhen, (0.9 * barSecs), 0.22, mix.radioBus); }
          if ((0 === stepPos) || (10 === stepPos)) kickDrum(tWhen, 0.32);
          if ((4 === stepPos) || (12 === stepPos)) noiseToBus(tWhen, 0.09, 0.09, 1800, 'bandpass', mix.radioBus);
          if (2 === (stepPos % 4)) tickHat(tWhen, 0.045);
          if (0 === (stepPos % 2)) noiseToBus(tWhen, 0.02, 0.014, 1600, 'lowpass', mix.radioBus);
          break; }
        default: { const cycleIdx = barPos % 4;
          const rootNoteVal = EURO_BASS[cycleIdx];
          if (0 === (stepPos % 4)) kickDrum(tWhen, 0.5);
          if (2 === (stepPos % 4)) bassRadio(tWhen, (12 + rootNoteVal), 0.16, 0.42);
          if (2 === (stepPos % 4)) tickHat(tWhen, 0.13, 0.07);
          else if (0 === (stepPos % 2)) tickHat(tWhen, 0.04);
          if (0 === stepPos) padRadio(tWhen, PAD_SETS[(1 === cycleIdx) ? 0 : cycleIdx], (4 * stepSecs), 0.04, 5);
          const leadNote = EURO_MELODY[(((barPos % 2) * 16) + stepPos)];
          if (leadNote) toneHit('sawtooth', hzFromMidi(leadNote), hzFromMidi(leadNote), tWhen, 0.17, 0.16, mix.radioBus);
          break; } } }
    function radioPump() {
      const ctxLive = mix.ctx;
      if (!ctxLive || !mix.radioOn) return;
      if ('running' !== ctxLive.state) return;
      const stationNow = STATION_ROWS[mix.radioIdx];
      const stepSecs = (60 / stationNow.bpm) / 4;
      if (ctxLive.currentTime > mix.radioNextAt) mix.radioNextAt = (0.05 + ctxLive.currentTime);
      while ((0.2 + ctxLive.currentTime) > mix.radioNextAt) { radioStepPlay(mix.radioStep, mix.radioNextAt);
        mix.radioStep = (1 + mix.radioStep);
        mix.radioNextAt = (stepSecs + mix.radioNextAt); } }
    function stationCurrent() {
      return mix.radioOn ? { name: STATION_ROWS[mix.radioIdx].name, index: mix.radioIdx } : null; }
    function stationStart(idxIn) {
      try { const stationTotal = STATION_ROWS.length;
        mix.radioIdx = (((Math.floor(Number(idxIn) || 0) % stationTotal) + stationTotal) % stationTotal);
        mix.radioOn = true; mix.radioStep = 0;
        const ctxLive = ctxOf();
        if (ctxLive) { if ('suspended' === ctxLive.state) ctxLive.resume().catch(() => {});
          mix.radioNextAt = (0.06 + ctxLive.currentTime);
          if (!mix.radioTimer) mix.radioTimer = setInterval(radioPump, 100);
          radioPump(); } } catch (muteErr) {}
      return stationCurrent(); }
    function stationStop() {
      try { mix.radioOn = false;
        if (mix.radioTimer) { clearInterval(mix.radioTimer); mix.radioTimer = null; }
        mix.musicStarted = false; } catch (muteErr) {} }
    function stationNext() {
      try { const lastIdx = (STATION_ROWS.length + -1);
        if (!mix.radioOn) return stationStart(0);
        if (mix.radioIdx < lastIdx) return stationStart((1 + mix.radioIdx));
        stationStop(); } catch (muteErr) {}
      return stationCurrent(); }
    const radioApi = { start: stationStart, stop: stationStop, next: stationNext, current: stationCurrent };
    function musicPump() {
      const ctxLive = mix.ctx;
      if (!ctxLive || ('running' !== ctxLive.state)) return;
      if (mix.radioOn) return;
      if (!mix.musicStarted) { mix.musicStarted = true;
        mix.step = 0; mix.nextStepAt = (0.06 + ctxLive.currentTime); }
      while ((ctxLive.currentTime + 0.15) > mix.nextStepAt) { seqStep(mix.step, mix.nextStepAt);
        mix.step = (1 + mix.step);
        mix.nextStepAt = (STEP_SPAN + mix.nextStepAt); } }
    // The per-frame poll used to be one long routine; it is now
    // three section helpers the frame tick calls in the same
    // order: engine blend, skid level, then crash and siren.
    function tickEngine(dtUse, wallClock, flagsIn) {
      if ((wallClock + -mix.lastSetEngine) > 0.3) {
        if (flagsIn.inCar && game.car) { let rpmShare = 0;
          try { const topSpeedIn = game.car.spec && game.car.spec.topSpeed;
            rpmShare = topSpeedIn ? (Math.abs(game.car.speed || 0) / (topSpeedIn / 3.6)) : (Math.abs(game.car.speed || 0) / 50); } catch (muteErr) { rpmShare = 0; }
          mix.engOn = true;
          mix.engRpm = Math.max(0.07, clampUnit(rpmShare));
        } else { mix.engOn = false; } }
      const easeK = Math.min(1, (9 * dtUse));
      mix.engRpmCur = (((mix.engRpm + -mix.engRpmCur) * easeK) + mix.engRpmCur);
      const gainGoal = mix.engOn ? ((mix.engRpmCur * 0.1) + 0.05) : 0;
      mix.engGainCur = (((gainGoal + -mix.engGainCur) * easeK) + mix.engGainCur);
      if (mix.engOsc1 && mix.engGain) { const pitchHz = ((mix.engRpmCur * 220) + 60);
        mix.engOsc1.frequency.value = pitchHz;
        mix.engOsc2.frequency.value = pitchHz;
        mix.engFilter.frequency.value = ((mix.engRpmCur * 1600) + 350);
        mix.engGain.gain.value = mix.engGainCur; } }
    function tickSkid(dtUse, wallClock, flagsIn) {
      let skidGoal = flagsIn.drifting ? 0.06 : 0;
      if (0.3 > (wallClock + -mix.lastScreech)) { skidGoal = mix.screechOn ? ((mix.screechInt * 0.11) + 0.03) : 0;
        if (mix.skidFilter) mix.skidFilter.frequency.value = ((mix.screechInt * 350) + 750); }
      mix.skidCur = (((skidGoal + -mix.skidCur) * Math.min(1, (12 * dtUse))) + mix.skidCur);
      if (mix.skidGain) mix.skidGain.gain.value = mix.skidCur; }
    function tickCrashSiren(dtUse, wallClock, flagsIn) {
      const crashRaw = flagsIn.crashTimer;
      let crashLevel = 0;
      switch (typeof crashRaw) {
        case 'number': crashLevel = ct; break;
        default: if (crashRaw) crashLevel = 1; break; }
      const crashRising = ((crashLevel > 0) && !(mix.prevCrash > 0)) || ((mix.prevCrash + 0.001) < crashLevel);
      if (crashRising && (crashLevel !== mix.prevCrash)) sfxPlay('crash');
      mix.prevCrash = crashLevel;
      let sirenFlag = false;
      try { if (((game.wanted || 0) >= 2) && Array.isArray(game.cops) && game.cops.length) {
          const selfPos = findCarrier((flagsIn.inCar && game.car) ? game.car : game.player) || findCarrier(game.car) || findCarrier(game.player);
          if (selfPos) { let copIdx = 0;
            while (game.cops.length > copIdx) { const copCar = game.cops[copIdx]; copIdx = (copIdx + 1);
              const copPlace = findCarrier(copCar);
              if (!copPlace) continue;
              const gapXVal = (copPlace.x + -selfPos.x); const gapZVal = (copPlace.z + -selfPos.z);
              if (!(((gapXVal * gapXVal) + (gapZVal * gapZVal)) > 3600)) { sirenFlag = true; break; } } } } } catch (muteErr) { sirenFlag = false; }
      mix.sirCur = ((((sirenFlag ? 0.04 : 0) + -mix.sirCur) * Math.min(1, (8 * dtUse))) + mix.sirCur);
      if (mix.sirGain && mix.sirOsc) { mix.sirGain.gain.value = mix.sirCur;
        if (sirenFlag) mix.sirOsc.frequency.value = (0 === (Math.floor(wallClock * 2.8) % 2)) ? 720 : 960; } }
    function tickFrame(dtVal) {
      try { const dtUse = (Number.isFinite(dtVal) && (dtVal > 0) && (1 > dtVal)) ? dtVal : (1 / 60);
        const frameCtx = mix.ctx;
        if (!frameCtx) return;
        const wallClock = secsNow();
        const flagsIn = game.flags || {};
        tickEngine(dtUse, wallClock, flagsIn);
        tickSkid(dtUse, wallClock, flagsIn);
        tickCrashSiren(dtUse, wallClock, flagsIn);
        musicPump(); } catch (muteErr) {} }
    const pubApi = { muted: false, play: sfxPlay, toggleMute: muteToggle, setEngine: engineSet, resume: resumeCtx,
      horn: hornBlast, hornStart: hornBegin, hornStop: hornEnd, screech: screechSet, setScreech: screechSet,
      crash: crashFire, radio: radioApi };
    game.audio = pubApi;
    try { if (Array.isArray(game.updaters)) game.updaters.push(tickFrame);
      else if (game.updaters && ('function' === typeof game.updaters.add)) game.updaters.add(tickFrame);
      else if (null == game.updaters) game.updaters = [tickFrame]; } catch (muteErr) {}
  } catch (outerFail) {
    try { if (game && !game.audio) { const safeApi = { muted: true, radio: { start() {}, stop() {}, next() {}, current() { return null; } } };
        safeApi.play = function () {};
        safeApi.toggleMute = function () {};
        safeApi.setEngine = function () {};
        safeApi.resume = function () {};
        safeApi.horn = function () {};
        safeApi.hornStart = function () {};
        safeApi.hornStop = function () {};
        safeApi.screech = function () {};
        safeApi.setScreech = function () {};
        safeApi.crash = function () {};
        game.audio = safeApi; } } catch (muteErr) {} }
}
