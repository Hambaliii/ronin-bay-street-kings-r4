// Every random draw the game makes feeds through one generator,
// and its whole state fits in a single module level word.
let seedCell;
seedCell = 1;
export const srand = (seedGiven) => { seedCell = (seedGiven >>> 0) || 1; };
const scrambleStep = (prodGiven) => {
  let foldMate;
  foldMate = Math.imul(prodGiven | 61, prodGiven ^ (prodGiven >>> 7));
  let foldedSum;
  foldedSum = prodGiven + foldMate;
  return foldedSum ^ prodGiven; };
const digestWord = (wordGiven) => {
  let leadProd;
  leadProd = Math.imul(wordGiven | 1, wordGiven ^ (wordGiven >>> 15));
  let stirred;
  stirred = scrambleStep(leadProd);
  return (stirred ^ (stirred >>> 14)) >>> 0; };
export const rnd = () => { let nextCell = (seedCell | 0);
  nextCell += 0x6D2B79F5;
  seedCell = nextCell | 0;
  return digestWord(seedCell) / 4294967296; };
const spanDraw = (loGiven, hiGiven, wholeFlag) => {
  let rawSpan;
  rawSpan = hiGiven - loGiven;
  let spanUsed;
  if (wholeFlag) spanUsed = rawSpan + 1; else spanUsed = rawSpan;
  let rolled;
  rolled = loGiven + (rnd() * spanUsed);
  if (wholeFlag) return Math.floor(rolled); else return rolled; };
export const rr = (loGiven, hiGiven) => spanDraw(loGiven, hiGiven, false);
export const ri = (loGiven, hiGiven) => spanDraw(loGiven, hiGiven, true);
export const pick = (listGiven) => {
  const listEmpty = !listGiven || !(listGiven.length > 0);
  const slotPicked = listEmpty ? undefined : Math.floor(rnd() * listGiven.length) % listGiven.length;
  return listEmpty ? undefined : listGiven[slotPicked]; };
export const chance = (capGiven) => rnd() < capGiven;
