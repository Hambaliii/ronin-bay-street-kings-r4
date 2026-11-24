// Seeded sequence source shared by the whole game
// A single module word advances every draw
let seqWord = 1;
function loadSeedWord(incomingSeed) {
  seqWord = (incomingSeed >>> 0) || 1; }
export function srand(seedValue) { loadSeedWord(seedValue); }
export function rnd() {
  seqWord |= 0;
  seqWord = (seqWord + 0x6D2B79F5) | 0;
  const firstMix = Math.imul(seqWord | 1, seqWord ^ (seqWord >>> 15));
  let mixedWord = firstMix;
  const secondMix = Math.imul(mixedWord | 61, mixedWord ^ (mixedWord >>> 7));
  mixedWord = (mixedWord + secondMix) ^ mixedWord;
  const topSlice = (mixedWord ^ (mixedWord >>> 14)) >>> 0;
  return topSlice / 4294967296; }
export function rr(lowEnd, highEnd) {
  const spanWidth = highEnd - lowEnd;
  return lowEnd + (rnd() * spanWidth); }
export function ri(lowEnd, highEnd) {
  const spanCount = (highEnd - lowEnd) + 1;
  return lowEnd + Math.floor(spanCount * rnd()); }
export function pick(listIn) {
  // Empty or missing input yields undefined
  // Any real list spends exactly one draw
  if (!listIn || !(listIn.length > 0)) return undefined;
  const chosenIdx = Math.floor(rnd() * listIn.length) % listIn.length;
  return listIn[chosenIdx]; }
export function chance(probValue) {
  const drawnValue = rnd();
  return probValue > drawnValue; }
