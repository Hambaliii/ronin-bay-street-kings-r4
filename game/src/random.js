// One shared generator feeds every random draw in the game
// The running state sits in a single module level word
let stateWord = 1;
export function srand(incomingSeed) {
  const maskedSeed = incomingSeed >>> 0;
  stateWord = maskedSeed || 1; }
function foldProducts(firstProduct) {
  const secondProduct = Math.imul(firstProduct | 61, firstProduct ^ (firstProduct >>> 7));
  return (firstProduct + secondProduct) ^ firstProduct; }
function scrambleWord(inputWord) {
  const firstProduct = Math.imul(inputWord | 1, inputWord ^ (inputWord >>> 15));
  const foldedWord = foldProducts(firstProduct);
  const cleanedWord = (foldedWord ^ (foldedWord >>> 14)) >>> 0;
  return cleanedWord; }
export function rnd() {
  stateWord = ((stateWord | 0) + 0x6D2B79F5) | 0;
  return scrambleWord(stateWord) / 4294967296; }
function scaledDraw(lowEdge, highEdge, wantWhole) {
  const plainReach = highEdge + (-lowEdge);
  const reachUsed = wantWhole ? (plainReach + 1) : plainReach;
  const placedValue = lowEdge + (rnd() * reachUsed);
  return wantWhole ? Math.floor(placedValue) : placedValue; }
export function rr(lowEdge, highEdge) {
  return scaledDraw(lowEdge, highEdge, false); }
export function ri(lowEdge, highEdge) {
  return scaledDraw(lowEdge, highEdge, true); }
export function pick(poolIn) {
  const poolReady = poolIn && (poolIn.length > 0);
  if (!poolReady) return undefined;
  const chosenIndex = Math.floor(rnd() * poolIn.length) % poolIn.length;
  return poolIn[chosenIndex]; }
export function chance(thresholdIn) {
  return thresholdIn > rnd(); }
