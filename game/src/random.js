// Seeded draws for the whole game flow through this one module
// A lone cell carries the chain forward between successive calls
let cellHeld = 1;
export function srand(seedGiven) {
  const maskedGiven = (seedGiven >>> 0);
  cellHeld = maskedGiven ? maskedGiven : 1; }
function advanceCell() {
  cellHeld = (cellHeld | 0);
  const steppedCell = ((cellHeld + 0x6D2B79F5) | 0);
  cellHeld = steppedCell;
  return steppedCell; }
function mixWord(wordGiven) {
  const pairLeft = (wordGiven | 1);
  const pairRight = (wordGiven ^ (wordGiven >>> 15));
  const prodFirst = Math.imul(pairLeft, pairRight);
  const prodSecond = Math.imul((prodFirst | 61), (prodFirst ^ (prodFirst >>> 7)));
  const foldedMix = ((prodFirst + prodSecond) ^ prodFirst);
  const cleanedMix = ((foldedMix ^ (foldedMix >>> 14)) >>> 0);
  return cleanedMix; }
export function rnd() {
  const mixedNow = mixWord(advanceCell());
  const unitNow = (mixedNow / 4294967296);
  return unitNow; }
function drawBetween(loGiven, hiGiven, wholeFlag) {
  const spanBase = (hiGiven + (-loGiven));
  const reachNow = wholeFlag ? (spanBase + 1) : spanBase;
  const placedNow = (loGiven + (rnd() * reachNow));
  const resultNow = wholeFlag ? Math.floor(placedNow) : placedNow;
  return resultNow; }
export function rr(loGiven, hiGiven) {
  const drawnNow = drawBetween(loGiven, hiGiven, false);
  return drawnNow; }
export function ri(loGiven, hiGiven) {
  const drawnNow = drawBetween(loGiven, hiGiven, true);
  return drawnNow; }
export function pick(listGiven) {
  const listMissing = (!listGiven);
  const listEmpty = listMissing ? true : !(listGiven.length > 0);
  if (listMissing || listEmpty) return undefined;
  const idxRaw = Math.floor(rnd() * listGiven.length);
  const idxSafe = (idxRaw % listGiven.length);
  const pickedNow = listGiven[idxSafe];
  return pickedNow; }
export function chance(oddsGiven) {
  const [drawnNow] = [rnd()];
  const beatenNow = (oddsGiven > drawnNow);
  return beatenNow; }
