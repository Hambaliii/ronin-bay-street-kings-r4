const clampUnit = (vU) => {
  let nU; nU = Number (vU);
  if (! Number.isFinite (nU)) return 0;
  if (nU < 0) return 0;
  if (1 < nU) { return 1; }
  return nU; };
let msInSecA; msInSecA = 1000; const MS_IN_SEC = msInSecA;
const secsNow = () => {
  try {
    if (('undefined' !== typeof performance) && performance.now) { return (performance.now () / MS_IN_SEC); }
  } catch (err) { }
  return (Date.now () / MS_IN_SEC); };
const findCarrier = (entF) => {
  if (! entF || ('object' !== typeof entF)) return null;
  let carrList; carrList = [];
  carrList.push (entF.position); carrList.push (entF.pos); carrList.push (entF.group && entF.group.position); carrList.push (entF.mesh && entF.mesh.position); carrList.push (entF);
  let iF = 0;
  while (iF < carrList.length) {
    const itemF = carrList [iF];
    if (itemF && Number.isFinite (itemF.x) && Number.isFinite (itemF.z)) return itemF;
    iF = (iF + 1); }
  return null; };
export const initAudio = (gmA) => { try {
    if (! gmA || ('object' !== typeof gmA)) return;
    if (gmA.__audioInit) return;
    gmA.__audioInit = true;
    let mixA; mixA = { };
    let bankOne = { };
    bankOne.ctx = null; bankOne.master = null; bankOne.musicBus = null; bankOne.noiseBuf = null;
    bankOne.engOsc2 = null;
    bankOne.engOsc1 = null;
    bankOne.engGain = null;
    bankOne.engFilter = null;
    bankOne.engOn = false;
    bankOne.engRpmCur = 0;
    bankOne.engRpm = 0;
    bankOne.engGainCur = 0;
    bankOne.lastSetEngine = - 10;
    let bankTwo = { };
    bankTwo.skidSrc = null; bankTwo.skidFilter = null; bankTwo.skidGain = null; bankTwo.skidCur = 0;
    bankTwo.screechInt = 0;
    bankTwo.screechOn = false;
    bankTwo.lastCrashAt = - 10;
    bankTwo.lastScreech = - 10;
    bankTwo.radioFilter = null;
    bankTwo.radioBus = null;
    bankTwo.radioIdx = 0;
    bankTwo.radioOn = false;
    bankTwo.radioStep = 0;
    bankTwo.radioNextAt = 0;
    bankTwo.radioTimer = null;
    bankTwo.sirGain = null;
    bankTwo.sirOsc = null;
    bankTwo.sirCur = 0;
    bankTwo.step = 0;
    bankTwo.musicStarted = false;
    bankTwo.prevCrash = 0;
    bankTwo.nextStepAt = 0;
    bankTwo.hornOsc2 = null;
    bankTwo.hornOsc1 = null;
    bankTwo.hornFilter = null;
    bankTwo.hornGain = null;
    bankTwo.hornOn = false;
    bankTwo.hornTimer = null;
    Object.assign (mixA, bankOne, bankTwo);
    const ACtor = (('undefined' !== typeof window) && (window.AudioContext || window.webkitAudioContext)) || null;
    const lcgNext = (stL) => { return ((stL * 1103515245) + 12345) & 0x7fffffff; };
    const noiseBufferOf = (acN) => {
      let lenN; lenN = acN.sampleRate;
      let bufN; bufN = acN.createBuffer (1, lenN, acN.sampleRate);
      let chanN; chanN = bufN.getChannelData (0);
      let stN = 22222;
      let iN = 0;
      while (iN < lenN) { stN = lcgNext (stN); chanN [iN] = (stN / 0x40000000) - 1; iN = (iN + 1); }
      return bufN; };
    const engineChainOf = (acE) => {
      try {
        let filtE; filtE = acE.createBiquadFilter ();
        filtE.type = 'lowpass';
        filtE.frequency.value = 400;
        filtE.Q.value = 2;
        let gainE; gainE = acE.createGain ();
        gainE.gain.value = 0;
        let oscEa; oscEa = acE.createOscillator ();
        oscEa.type = 'sawtooth';
        let oscEb; oscEb = acE.createOscillator ();
        oscEb.type = 'square';
        oscEb.detune.value = 9;
        oscEa.connect (filtE);
        oscEb.connect (filtE);
        filtE.connect (gainE);
        gainE.connect (mixA.master);
        oscEb.frequency.value = 60;
        oscEa.frequency.value = 60;
        oscEa.start ();
        oscEb.start ();
        mixA.engOsc1 = oscEa;
        mixA.engOsc2 = oscEb;
        mixA.engFilter = filtE;
        mixA.engGain = gainE;
      } catch (err) { } };
    const skidChainOf = (acSk) => {
      try {
        let srcSk; srcSk = acSk.createBufferSource ();
        srcSk.buffer = mixA.noiseBuf;
        srcSk.loop = true;
        let filtSk; filtSk = acSk.createBiquadFilter ();
        filtSk.type = 'bandpass';
        filtSk.frequency.value = 900;
        filtSk.Q.value = 2;
        let gainSk; gainSk = acSk.createGain ();
        gainSk.gain.value = 0;
        srcSk.connect (filtSk);
        filtSk.connect (gainSk);
        gainSk.connect (mixA.master);
        srcSk.start ();
        mixA.skidSrc = srcSk;
        mixA.skidFilter = filtSk;
        mixA.skidGain = gainSk;
      } catch (err) { } };
    const sirenChainOf = (acSi) => {
      try {
        let oscSi; oscSi = acSi.createOscillator ();
        oscSi.type = 'square';
        oscSi.frequency.value = 720;
        let gainSi; gainSi = acSi.createGain ();
        gainSi.gain.value = 0;
        oscSi.connect (gainSi);
        gainSi.connect (mixA.master);
        oscSi.start ();
        mixA.sirOsc = oscSi;
        mixA.sirGain = gainSi;
      } catch (err) { } };
    const busOf = (acB, lvlB) => {
      let nodeB; nodeB = acB.createGain ();
      nodeB.gain.value = lvlB;
      nodeB.connect (mixA.master);
      return nodeB; };
    const radioFilterOf = (acRf) => {
      let filtRf; filtRf = acRf.createBiquadFilter ();
      filtRf.type = 'lowpass';
      filtRf.frequency.value = 950;
      filtRf.Q.value = 1;
      filtRf.connect (mixA.radioBus);
      mixA.radioFilter = filtRf; };
    const ctxOf = () => { if (mixA.ctx) return mixA.ctx;
      if (! ACtor) return null;
      try {
        let acC; acC = new ACtor ();
        mixA.ctx = acC;
        mixA.master = acC.createGain ();
        if (pubApi.muted) { mixA.master.gain.value = 0; } else { mixA.master.gain.value = 0.5; }
        mixA.master.connect (acC.destination);
        mixA.musicBus = busOf (acC, 0.05);
        mixA.radioBus = busOf (acC, 0.16);
        radioFilterOf (acC);
        mixA.noiseBuf = noiseBufferOf (acC);
        engineChainOf (acC);
        skidChainOf (acC);
        sirenChainOf (acC);
        return acC;
      } catch (err) { mixA.ctx = null; return null; } };
    const toneHit = (waveT, startT, endT, whenT, lenT, lvlT, destT) => {
      let acT; acT = mixA.ctx;
      if (! acT) return;
      try {
        let oscT; oscT = acT.createOscillator ();
        let gainT; gainT = acT.createGain ();
        oscT.type = waveT;
        oscT.frequency.setValueAtTime (Math.max (20, startT), whenT);
        if (! ! endT && (startT !== endT)) oscT.frequency.exponentialRampToValueAtTime (Math.max (20, endT), (lenT + whenT));
        gainT.gain.setValueAtTime (0, whenT);
        gainT.gain.linearRampToValueAtTime (lvlT, (0.012 + whenT));
        gainT.gain.exponentialRampToValueAtTime (0.0001, (lenT + whenT));
        oscT.connect (gainT);
        gainT.connect (destT || mixA.master);
        oscT.start (whenT);
        oscT.stop (((lenT + 0.05) + whenT));
      } catch (err) { } };
    const noiseShot = (whenNs, lenNs, lvlNs, freqNs, kindNs, destNs, rateNs) => {
      let acNs; acNs = mixA.ctx;
      if (! acNs || ! mixA.noiseBuf) return;
      try {
        let srcNs; srcNs = acNs.createBufferSource ();
        srcNs.buffer = mixA.noiseBuf;
        if (rateNs !== undefined) srcNs.playbackRate.value = rateNs;
        let filtNs; filtNs = acNs.createBiquadFilter ();
        filtNs.type = kindNs || 'lowpass';
        filtNs.frequency.value = freqNs;
        let gainNs; gainNs = acNs.createGain ();
        gainNs.gain.setValueAtTime (lvlNs, whenNs);
        gainNs.gain.exponentialRampToValueAtTime (0.0001, (lenNs + whenNs));
        srcNs.connect (filtNs);
        filtNs.connect (gainNs);
        gainNs.connect (destNs || mixA.master);
        srcNs.start (whenNs);
        srcNs.stop (((lenNs + 0.05) + whenNs));
      } catch (err) { } };
    const noisePlain = (whenNp, lenNp, lvlNp, freqNp, kindNp) => { noiseShot (whenNp, lenNp, lvlNp, freqNp, kindNp, undefined, undefined); };
    const noiseToBus = (whenNb, lenNb, lvlNb, freqNb, kindNb, destNb) => {
      let acNb; acNb = mixA.ctx;
      if (! acNb || ! mixA.noiseBuf) return;
      try {
        let srcNb; srcNb = acNb.createBufferSource ();
        srcNb.buffer = mixA.noiseBuf;
        srcNb.playbackRate.value = ((((whenNb * 7) % 1) * 0.6) + 0.7);
        let filtNb; filtNb = acNb.createBiquadFilter ();
        filtNb.type = kindNb || 'lowpass';
        filtNb.frequency.value = freqNb;
        let gainNb; gainNb = acNb.createGain ();
        gainNb.gain.setValueAtTime (lvlNb, whenNb);
        gainNb.gain.exponentialRampToValueAtTime (0.0001, (lenNb + whenNb));
        srcNb.connect (filtNb);
        filtNb.connect (gainNb);
        gainNb.connect (destNb || mixA.master);
        srcNb.start (whenNb);
        srcNb.stop (((lenNb + 0.05) + whenNb));
      } catch (err) { } };
    const crashFire = (powC) => {
      try {
        let acCf; acCf = ctxOf ();
        if (! acCf) return;
        let amtC; amtC = Math.max (0.15, clampUnit (powC));
        let clockC; clockC = acCf.currentTime;
        if ((clockC - mixA.lastCrashAt) < 0.12) return;
        mixA.lastCrashAt = clockC;
        let whenC; whenC = (0.005 + clockC);
        noisePlain (whenC, 0.26, (0.5 * amtC), ((260 * amtC) + 300), 'lowpass');
        toneHit ('sine', 90, 35, whenC, 0.32, (0.48 * amtC));
      } catch (err) { } };
    const screechSet = (onSc, powSc) => {
      try {
        mixA.screechOn = ! ! (onSc);
        mixA.screechInt = clampUnit (powSc);
        mixA.lastScreech = secsNow ();
        if (onSc) { const acSc = ctxOf (); if (acSc && ('suspended' === acSc.state)) acSc.resume ().catch (() => { }); }
      } catch (err) { } };
    const noteSeqPlay = (notesSq, waveSq, beginSq, gapSq, lenSq, lvlSq) => {
      notesSq.forEach ((hzSq, iSq) => { toneHit (waveSq, hzSq, hzSq, ((iSq * gapSq) + beginSq), lenSq, lvlSq); }); };
    const sfxPlay = (keyFx) => {
      try {
        let acFx; acFx = ctxOf ();
        if (! acFx) return;
        if ('suspended' === acFx.state) acFx.resume ().catch (() => { });
        let whenFx; whenFx = (0.01 + acFx.currentTime);
        switch (keyFx) {
          case 'click' : { toneHit ('square', 880, 660, whenFx, 0.06, 0.07); break; }
          case 'cash' : { toneHit ('sine', 988, 988, whenFx, 0.08, 0.12); toneHit ('sine', 1319, 1319, (0.08 + whenFx), 0.14, 0.12); break; }
          case 'win' : { let winNotes = []; winNotes.push (523); winNotes.push (659); winNotes.push (784); winNotes.push (1047); noteSeqPlay (winNotes, 'triangle', whenFx, 0.09, 0.16, 0.13); break; }
          case 'fail' : { let failNotes = []; failNotes.push (392); failNotes.push (330); failNotes.push (262); failNotes.forEach ((hzFx, posFx) => { toneHit ('sawtooth', hzFx, hzFx, ((posFx * 0.13) + whenFx), 0.16, 0.07); }); break; }
          case 'busted' : { toneHit ('sawtooth', 900, 280, whenFx, 0.8, 0.1); toneHit ('sawtooth', 905, 285, whenFx, 0.8, 0.05); break; }
          case 'pickup' : { toneHit ('sine', 660, 990, whenFx, 0.09, 0.1); break; }
          case 'crash' : { crashFire (0.75); break; }
          case 'shot' : { noisePlain (whenFx, 0.12, 0.3, 900, 'lowpass'); toneHit ('square', 220, 55, whenFx, 0.12, 0.16); break; }
          case 'smg' : { noisePlain (whenFx, 0.07, 0.22, 1100, 'lowpass'); toneHit ('square', 260, 70, whenFx, 0.07, 0.12); break; }
          case 'dry' : { toneHit ('square', 1200, 900, whenFx, 0.03, 0.06); break; }
          case 'reload' : { toneHit ('square', 700, 500, whenFx, 0.04, 0.09); toneHit ('square', 950, 650, (0.13 + whenFx), 0.04, 0.09); break; }
          case 'swing' : { noisePlain (whenFx, 0.18, 0.12, 700, 'bandpass'); break; }
          case 'thud' : { toneHit ('sine', 90, 40, whenFx, 0.15, 0.3); break; }
          default : { break; } }
      } catch (err) { } };
    const hornBegin = () => { try {
        if (mixA.hornOn) return;
        let acHb; acHb = ctxOf ();
        if (! acHb) return;
        if ('suspended' === acHb.state) acHb.resume ().catch (() => { });
        if (mixA.hornTimer) { clearTimeout (mixA.hornTimer); mixA.hornTimer = null; }
        let whenHb; whenHb = acHb.currentTime;
        let oscLow; oscLow = acHb.createOscillator ();
        oscLow.type = 'sawtooth';
        oscLow.frequency.value = 370;
        let oscHigh; oscHigh = acHb.createOscillator ();
        oscHigh.type = 'sawtooth';
        oscHigh.frequency.value = 440;
        oscHigh.detune.value = 4;
        let filtHb; filtHb = acHb.createBiquadFilter ();
        filtHb.type = 'lowpass';
        filtHb.frequency.value = 1200;
        filtHb.Q.value = 1;
        let gainHb; gainHb = acHb.createGain ();
        gainHb.gain.setValueAtTime (0, whenHb);
        gainHb.gain.linearRampToValueAtTime (0.16, (0.01 + whenHb));
        oscLow.connect (filtHb);
        oscHigh.connect (filtHb);
        filtHb.connect (gainHb);
        gainHb.connect (mixA.master);
        oscLow.start (whenHb);
        oscHigh.start (whenHb);
        mixA.hornOsc1 = oscLow;
        mixA.hornOsc2 = oscHigh;
        mixA.hornFilter = filtHb;
        mixA.hornGain = gainHb;
        mixA.hornOn = true;
      } catch (err) { } };
    const hornEnd = () => { try {
        if (! mixA.hornOn) return;
        mixA.hornOn = false;
        if (mixA.hornTimer) { clearTimeout (mixA.hornTimer); mixA.hornTimer = null; }
        let acHe; acHe = mixA.ctx;
        let oscLowE; oscLowE = mixA.hornOsc1; let oscHighE; oscHighE = mixA.hornOsc2; let gainHe; gainHe = mixA.hornGain;
        mixA.hornOsc1 = null;
        mixA.hornOsc2 = null;
        mixA.hornFilter = null;
        mixA.hornGain = null;
        if (! acHe || ! gainHe) {
          try { oscLowE && oscLowE.stop (); } catch (err) { }
          try { oscHighE && oscHighE.stop (); } catch (err) { }
          return; }
        let whenHe; whenHe = acHe.currentTime;
        try {
          gainHe.gain.cancelScheduledValues (whenHe);
          gainHe.gain.setValueAtTime (gainHe.gain.value, whenHe);
          gainHe.gain.linearRampToValueAtTime (0, (0.08 + whenHe));
          if (oscLowE) oscLowE.stop ((0.1 + whenHe));
          if (oscHighE) oscHighE.stop ((0.1 + whenHe));
        } catch (err) { }
      } catch (err) { } };
    const hornBlast = (holdHb) => {
      try {
        let durHb; if (Number.isFinite (holdHb) && (0 < holdHb)) { durHb = Math.min (holdHb, 1.2); } else { durHb = 0.35; } hornBegin ();
        if (mixA.hornTimer) clearTimeout (mixA.hornTimer);
        mixA.hornTimer = setTimeout (() => { mixA.hornTimer = null; hornEnd (); }, (durHb * 1000));
      } catch (err) { } };
    const engineSet = (onEn, rpmEn) => {
      try {
        mixA.engOn = ! ! (onEn);
        mixA.engRpm = clampUnit (rpmEn);
        mixA.lastSetEngine = secsNow ();
        if (onEn) { const acEn = ctxOf (); if (acEn && ('suspended' === acEn.state)) acEn.resume ().catch (() => { }); }
      } catch (err) { } };
    const resumeCtx = () => { try { const acRc = ctxOf (); if (acRc && ('suspended' === acRc.state)) acRc.resume ().catch (() => { }); } catch (err) { } };
    const muteToggle = () => { try {
        if (pubApi.muted) { pubApi.muted = false; } else { pubApi.muted = true; }
        let acMt; acMt = ctxOf ();
        if (acMt && mixA.master) {
          let whenMt; whenMt = acMt.currentTime;
          mixA.master.gain.cancelScheduledValues (whenMt);
          let muteLvl; if (pubApi.muted) { muteLvl = 0; } else { muteLvl = 0.5; }
          mixA.master.gain.setTargetAtTime (muteLvl, whenMt, 0.05); }
      } catch (err) { }
      return pubApi.muted; };
    const STEP_SPAN = (60 / 100) / 2; const BASS_ROOTS = []; BASS_ROOTS.push (33); BASS_ROOTS.push (29); BASS_ROOTS.push (36); BASS_ROOTS.push (31);
    const PAD_SETS = []; PAD_SETS.push ([57, 60, 64]); PAD_SETS.push ([53, 57, 60]); PAD_SETS.push ([48, 52, 55]); PAD_SETS.push ([55, 59, 62]);
    const hzFromMidi = (noteHz) => { return (Math.pow (2, ((noteHz - 69) / 12)) * 440); };
    const padNote = (noteP, atP) => {
      let acPn; acPn = mixA.ctx;
      try {
        let oscP; oscP = acPn.createOscillator ();
        let gainP; gainP = acPn.createGain ();
        oscP.type = 'triangle';
        oscP.frequency.value = hzFromMidi (noteP);
        gainP.gain.setValueAtTime (0, atP);
        gainP.gain.linearRampToValueAtTime (0.05, (0.4 + atP));
        gainP.gain.setValueAtTime (0.05, ((STEP_SPAN * 8) + atP) - 0.4);
        gainP.gain.linearRampToValueAtTime (0, ((8 * STEP_SPAN) + atP));
        oscP.connect (gainP);
        gainP.connect (mixA.musicBus);
        oscP.start (atP);
        oscP.stop ((((STEP_SPAN * 8) + 0.05) + atP));
      } catch (err) { } };
    const hatHit = (atH) => {
      try {
        let acHh; acHh = mixA.ctx;
        let srcH; srcH = acHh.createBufferSource ();
        srcH.buffer = mixA.noiseBuf;
        let filtHat; filtHat = acHh.createBiquadFilter ();
        filtHat.type = 'highpass';
        filtHat.frequency.value = 6000;
        let gainHat; gainHat = acHh.createGain ();
        gainHat.gain.setValueAtTime (0.25, atH);
        gainHat.gain.exponentialRampToValueAtTime (0.001, (0.04 + atH));
        srcH.connect (filtHat);
        filtHat.connect (gainHat);
        gainHat.connect (mixA.musicBus);
        srcH.start (atH);
        srcH.stop ((0.06 + atH));
      } catch (err) { } };
    const seqStep = (countSq, whenSq) => {
      let barSq; barSq = Math.floor (countSq / 8) % 4;
      let posSq; posSq = countSq % 8;
      let rootSq; rootSq = BASS_ROOTS [barSq];
      if (0 === (posSq % 2)) { let bassSq; if (4 === posSq) { bassSq = (12 + rootSq); } else { bassSq = rootSq; } toneHit ('sawtooth', hzFromMidi (bassSq), hzFromMidi (bassSq), whenSq, 0.22, 0.16, mixA.musicBus); }
      else if (7 === posSq) toneHit ('sawtooth', hzFromMidi ((7 + rootSq)), hzFromMidi ((7 + rootSq)), whenSq, 0.14, 0.1, mixA.musicBus);
      if (0 === posSq) PAD_SETS [barSq].forEach ((noteSq) => padNote (noteSq, whenSq));
      if (1 === (posSq % 2)) hatHit (whenSq); };
    const STATION_ROWS = [];
    let stationRowA = { }; stationRowA.name = 'WAVEFORM FM'; stationRowA.bpm = 100; stationRowA.kind = 'wave'; STATION_ROWS.push (stationRowA);
    let stationRowB = { }; stationRowB.name = 'LOFI BAY'; stationRowB.bpm = 76; stationRowB.kind = 'lofi'; STATION_ROWS.push (stationRowB);
    let stationRowC = { }; stationRowC.name = 'EUROBEAT KAI'; stationRowC.bpm = 150; stationRowC.kind = 'euro'; STATION_ROWS.push (stationRowC);
    const LOFI_SETS = []; LOFI_SETS.push ([53, 57, 60, 64]); LOFI_SETS.push ([50, 53, 57, 60]); LOFI_SETS.push ([48, 52, 55, 59]); LOFI_SETS.push ([52, 55, 59, 62]);
    const LOFI_BASS = []; LOFI_BASS.push (29); LOFI_BASS.push (26); LOFI_BASS.push (24); LOFI_BASS.push (28);
    const EURO_BASS = []; EURO_BASS.push (33); EURO_BASS.push (33); EURO_BASS.push (29); EURO_BASS.push (31);
    const EURO_MELODY = []; EURO_MELODY.push (69); EURO_MELODY.push (0); EURO_MELODY.push (72); EURO_MELODY.push (0); EURO_MELODY.push (76); EURO_MELODY.push (0); EURO_MELODY.push (72); EURO_MELODY.push (0); EURO_MELODY.push (74); EURO_MELODY.push (0); EURO_MELODY.push (76); EURO_MELODY.push (0); EURO_MELODY.push (79); EURO_MELODY.push (0); EURO_MELODY.push (76); EURO_MELODY.push (0); EURO_MELODY.push (69); EURO_MELODY.push (0); EURO_MELODY.push (72); EURO_MELODY.push (0); EURO_MELODY.push (76); EURO_MELODY.push (0); EURO_MELODY.push (81); EURO_MELODY.push (0); EURO_MELODY.push (79); EURO_MELODY.push (76); EURO_MELODY.push (74); EURO_MELODY.push (0); EURO_MELODY.push (72); EURO_MELODY.push (0); EURO_MELODY.push (0); EURO_MELODY.push (0);
    const kickDrum = (whenK, lvlK) => { toneHit ('sine', 130, 45, whenK, 0.14, lvlK, mixA.radioBus); };
    const tickHat = (whenTh, lvlTh, lenTh) => { noiseToBus (whenTh, (lenTh || 0.04), lvlTh, 6500, 'highpass', mixA.radioBus); };
    const bassRadio = (whenBr, midiBr, lenBr, lvlBr) => { toneHit ('sawtooth', hzFromMidi (midiBr), hzFromMidi (midiBr), whenBr, lenBr, lvlBr, mixA.radioFilter); };
    const padRadio = (whenPr, midisPr, lenPr, lvlPr, detunePr) => {
      let acPr; acPr = mixA.ctx;
      if (! acPr) return;
      let signsPr = [- 1, 1];
      let iterNotePr; iterNotePr = midisPr [Symbol.iterator] (); let stepNotePr; stepNotePr = iterNotePr.next ();
      while (! stepNotePr.done) {
        const notePr = stepNotePr.value; stepNotePr = iterNotePr.next ();
        let iterSignPr; iterSignPr = signsPr [Symbol.iterator] (); let stepSignPr; stepSignPr = iterSignPr.next ();
        while (! stepSignPr.done) {
          const signPr = stepSignPr.value; stepSignPr = iterSignPr.next ();
          try {
            let oscPr; oscPr = acPr.createOscillator ();
            let gainPr; gainPr = acPr.createGain ();
            oscPr.type = 'triangle';
            oscPr.frequency.value = hzFromMidi (notePr);
            oscPr.detune.value = (signPr * (detunePr || 6));
            gainPr.gain.setValueAtTime (0, whenPr);
            gainPr.gain.linearRampToValueAtTime (lvlPr, (Math.min (0.4, (lenPr * 0.3)) + whenPr));
            gainPr.gain.setValueAtTime (lvlPr, (Math.max (0, (lenPr - 0.35)) + whenPr));
            gainPr.gain.linearRampToValueAtTime (0, (lenPr + whenPr));
            oscPr.connect (gainPr);
            gainPr.connect (mixA.radioBus);
            oscPr.start (whenPr);
            oscPr.stop (((lenPr + 0.05) + whenPr));
          } catch (err) { }
        } } };
    const radioStepPlay = (countRs, whenRs) => {
      let stationRs; stationRs = STATION_ROWS [mixA.radioIdx];
      if (! stationRs || ! mixA.ctx) return;
      let stepDurRs; stepDurRs = (60 / stationRs.bpm) / 4;
      let barSecsRs; barSecsRs = (16 * stepDurRs);
      let barPosRs; barPosRs = Math.floor (countRs / 16);
      let inBarRs; inBarRs = countRs % 16;
      if ('wave' === stationRs.kind) { const cycW = barPosRs % 4;
          const rootW = BASS_ROOTS [cycW];
          if (0 === (inBarRs % 2)) { let bassNoteW; if (8 === inBarRs) { bassNoteW = (12 + rootW); } else { bassNoteW = rootW; } bassRadio (whenRs, bassNoteW, 0.22, 0.5); }
          if (0 === inBarRs) padRadio (whenRs, PAD_SETS [cycW], barSecsRs, 0.055, 7);
          let arpBonusW; if (6 === (inBarRs % 8)) { arpBonusW = 7; } else { arpBonusW = 0; }
          const arpW = (12 + PAD_SETS [cycW] [inBarRs % 3]) + arpBonusW;
          toneHit ('square', hzFromMidi (arpW), hzFromMidi (arpW), whenRs, 0.09, 0.07, mixA.radioBus);
          if (2 === (inBarRs % 4)) tickHat (whenRs, 0.1); }
      else if ('lofi' === stationRs.kind) { const cycL = barPosRs % 4;
          if (0 === inBarRs) {
            padRadio (whenRs, LOFI_SETS [cycL], barSecsRs, 0.085, ((Math.sin (barPosRs * 1.7) * 4) + 5));
            toneHit ('triangle', hzFromMidi ((12 + LOFI_BASS [cycL])), hzFromMidi ((12 + LOFI_BASS [cycL])), whenRs, (0.9 * barSecsRs), 0.22, mixA.radioBus); }
          if ((0 === inBarRs) || (10 === inBarRs)) kickDrum (whenRs, 0.32);
          if ((4 === inBarRs) || (12 === inBarRs)) noiseToBus (whenRs, 0.09, 0.09, 1800, 'bandpass', mixA.radioBus);
          if (2 === (inBarRs % 4)) tickHat (whenRs, 0.045);
          if (0 === (inBarRs % 2)) noiseToBus (whenRs, 0.02, 0.014, 1600, 'lowpass', mixA.radioBus); }
      else { const cycE = barPosRs % 4;
          const rootE = EURO_BASS [cycE];
          if (0 === (inBarRs % 4)) kickDrum (whenRs, 0.5);
          if (2 === (inBarRs % 4)) bassRadio (whenRs, (12 + rootE), 0.16, 0.42);
          if (2 === (inBarRs % 4)) tickHat (whenRs, 0.13, 0.07);
          else if (0 === (inBarRs % 2)) tickHat (whenRs, 0.04);
          let padIdxE; if (1 === cycE) { padIdxE = 0; } else { padIdxE = cycE; }
          if (0 === inBarRs) padRadio (whenRs, PAD_SETS [padIdxE], (4 * stepDurRs), 0.04, 5);
          const leadE = EURO_MELODY [(((barPosRs % 2) * 16) + inBarRs)];
          if (leadE) toneHit ('sawtooth', hzFromMidi (leadE), hzFromMidi (leadE), whenRs, 0.17, 0.16, mixA.radioBus); } };
    const radioPump = () => { const acRp = mixA.ctx;
      if (! acRp || ! mixA.radioOn) return;
      if ('running' !== acRp.state) return;
      let stepDurRp; stepDurRp = (60 / STATION_ROWS [mixA.radioIdx].bpm) / 4;
      if (acRp.currentTime > mixA.radioNextAt) mixA.radioNextAt = (0.05 + acRp.currentTime);
      for (; (0.2 + acRp.currentTime) > mixA.radioNextAt; ) {
        radioStepPlay (mixA.radioStep, mixA.radioNextAt);
        mixA.radioStep = (1 + mixA.radioStep);
        mixA.radioNextAt = (stepDurRp + mixA.radioNextAt); } };
    const stationCurrent = () => { if (! mixA.radioOn) { return null; } let curNow = { }; curNow.name = STATION_ROWS [mixA.radioIdx].name; curNow.index = mixA.radioIdx; return curNow; };
    const stationStart = (idxSt) => {
      try {
        let totalSt; totalSt = STATION_ROWS.length;
        mixA.radioIdx = (((Math.floor (Number (idxSt) || 0) % totalSt) + totalSt) % totalSt);
        mixA.radioOn = true;
        mixA.radioStep = 0;
        let acSt; acSt = ctxOf ();
        if (acSt) {
          if ('suspended' === acSt.state) acSt.resume ().catch (() => { });
          mixA.radioNextAt = (0.06 + acSt.currentTime);
          if (! mixA.radioTimer) mixA.radioTimer = setInterval (radioPump, 100);
          radioPump (); }
      } catch (err) { }
      return stationCurrent (); };
    const stationStop = () => { try {
        mixA.radioOn = false;
        if (mixA.radioTimer) { clearInterval (mixA.radioTimer); mixA.radioTimer = null; }
        mixA.musicStarted = false;
      } catch (err) { } };
    const stationNext = () => { try {
        if (mixA.radioOn) {
          if (mixA.radioIdx < (STATION_ROWS.length - 1)) return stationStart ((1 + mixA.radioIdx));
          stationStop ();
        } else return stationStart (0);
      } catch (err) { }
      return stationCurrent (); };
    let radioApi = { }; radioApi.start = stationStart; radioApi.stop = stationStop; radioApi.next = stationNext; radioApi.current = stationCurrent;
    const musicPump = () => {
      let acMp; acMp = mixA.ctx;
      if (! acMp || ('running' !== acMp.state)) return;
      if (mixA.radioOn) return;
      if (! mixA.musicStarted) { mixA.musicStarted = true; mixA.step = 0; mixA.nextStepAt = (0.06 + acMp.currentTime); }
      for (; (acMp.currentTime + 0.15) > mixA.nextStepAt; ) {
        seqStep (mixA.step, mixA.nextStepAt);
        mixA.step = (1 + mixA.step);
        mixA.nextStepAt = (STEP_SPAN + mixA.nextStepAt); } };
    const tickEngine = (dtEn, clockEn, flagsEn) => {
      if ((clockEn - mixA.lastSetEngine) > 0.3) {
        if (flagsEn.inCar && gmA.car) {
          let shareEn = 0;
          try {
            let topEn; topEn = gmA.car.spec && gmA.car.spec.topSpeed;
            if (topEn) { shareEn = (Math.abs (gmA.car.speed || 0) / (topEn / 3.6)); } else { shareEn = (Math.abs (gmA.car.speed || 0) / 50); }
          } catch (err) { shareEn = 0; }
          mixA.engOn = true;
          mixA.engRpm = Math.max (0.07, clampUnit (shareEn));
        } else mixA.engOn = false; }
      let easeEn; easeEn = Math.min (1, (9 * dtEn));
      mixA.engRpmCur = (((mixA.engRpm - mixA.engRpmCur) * easeEn) + mixA.engRpmCur);
      let goalEn; if (mixA.engOn) { goalEn = ((mixA.engRpmCur * 0.1) + 0.05); } else { goalEn = 0; }
      mixA.engGainCur = (((goalEn - mixA.engGainCur) * easeEn) + mixA.engGainCur);
      if (mixA.engOsc1 && mixA.engGain) {
        let pitchEn; pitchEn = ((mixA.engRpmCur * 220) + 60);
        mixA.engOsc1.frequency.value = pitchEn;
        mixA.engOsc2.frequency.value = pitchEn;
        mixA.engFilter.frequency.value = ((mixA.engRpmCur * 1600) + 350);
        mixA.engGain.gain.value = mixA.engGainCur; } };
    const tickSkid = (dtSk, clockSk, flagsSk) => {
      let goalSk; if (flagsSk.drifting) { goalSk = 0.06; } else { goalSk = 0; }
      if (0.3 > (clockSk - mixA.lastScreech)) {
        if (mixA.screechOn) { goalSk = ((mixA.screechInt * 0.11) + 0.03); } else { goalSk = 0; }
        if (mixA.skidFilter) mixA.skidFilter.frequency.value = ((mixA.screechInt * 350) + 750); }
      mixA.skidCur = (((goalSk - mixA.skidCur) * Math.min (1, (12 * dtSk))) + mixA.skidCur);
      if (mixA.skidGain) mixA.skidGain.gain.value = mixA.skidCur; };
    const tickCrashSiren = (dtCs, clockCs, flagsCs) => {
      let rawCs; rawCs = flagsCs.crashTimer;
      let levelCs = 0;
      if ('number' === typeof rawCs) { levelCs = ct; } else if (rawCs) { levelCs = 1; }
      let risingCs; risingCs = ((levelCs > 0) && ! (mixA.prevCrash > 0)) || ((mixA.prevCrash + 0.001) < levelCs);
      if (risingCs && (levelCs !== mixA.prevCrash)) sfxPlay ('crash');
      mixA.prevCrash = levelCs;
      let sirenCs = false;
      try {
        if (((gmA.wanted || 0) >= 2) && Array.isArray (gmA.cops) && gmA.cops.length) {
          let selfCs; selfCs = findCarrier ((flagsCs.inCar && gmA.car) ? gmA.car : gmA.player) || findCarrier (gmA.car) || findCarrier (gmA.player);
          if (selfCs) {
            let iCs = 0;
            while (iCs < gmA.cops.length) {
              const placeCs = findCarrier (gmA.cops [iCs]); iCs = (iCs + 1);
              if (! placeCs) continue;
              const gxCs = (placeCs.x - selfCs.x), gzCs = (placeCs.z - selfCs.z);
              if (! (((gxCs * gxCs) + (gzCs * gzCs)) > 3600)) { sirenCs = true; break; } } } }
      } catch (err) { sirenCs = false; }
      let sirGoalCs; if (sirenCs) { sirGoalCs = 0.04; } else { sirGoalCs = 0; }
      mixA.sirCur = (((sirGoalCs - mixA.sirCur) * Math.min (1, (8 * dtCs))) + mixA.sirCur);
      if (mixA.sirGain && mixA.sirOsc) {
        mixA.sirGain.gain.value = mixA.sirCur;
        if (sirenCs) { if (0 === (Math.floor (clockCs * 2.8) % 2)) { mixA.sirOsc.frequency.value = 720; } else { mixA.sirOsc.frequency.value = 960; } } } };
    const tickFrame = (dtValF) => {
      try {
        let dtF; if (Number.isFinite (dtValF) && (dtValF > 0) && (dtValF < 1)) { dtF = dtValF; } else { dtF = (1 / 60); }
        if (! mixA.ctx) return;
        let clockF; clockF = secsNow ();
        let flagsF; flagsF = gmA.flags || { };
        tickEngine (dtF, clockF, flagsF);
        tickSkid (dtF, clockF, flagsF);
        tickCrashSiren (dtF, clockF, flagsF); musicPump ();
      } catch (err) { } };
    let pubApi = { }; pubApi.muted = false; pubApi.play = sfxPlay; pubApi.toggleMute = muteToggle; pubApi.setEngine = engineSet; pubApi.resume = resumeCtx; pubApi.horn = hornBlast; pubApi.hornStart = hornBegin; pubApi.hornStop = hornEnd; pubApi.screech = screechSet; pubApi.setScreech = screechSet; pubApi.crash = crashFire; pubApi.radio = radioApi; gmA.audio = pubApi;
    try {
      if (Array.isArray (gmA.updaters)) gmA.updaters.push (tickFrame);
      else if (gmA.updaters && ('function' === typeof gmA.updaters.add)) gmA.updaters.add (tickFrame);
      else if (null == gmA.updaters) gmA.updaters = [tickFrame];
    } catch (err) { }
  } catch (outer) {
    try {
      if (gmA && ! gmA.audio) {
        const safe = { muted : true, radio : { start () { }, stop () { }, next () { }, current () { return null; } } }; safe.play = () => { };
        safe.toggleMute = () => { }; safe.setEngine = () => { };
        safe.resume = () => { }; safe.horn = () => { };
        safe.hornStart = () => { }; safe.hornStop = () => { };
        safe.screech = () => { }; safe.setScreech = () => { };
        safe.crash = () => { }; void safe;
        gmA.audio = safe; }
    } catch (err) { } } };
