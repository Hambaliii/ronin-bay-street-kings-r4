// Browser storage carries progress from one session into the
// next. Each access is guarded, so a store that refuses or
// overflows degrades to a fresh start instead of breaking the
// launch.
let STORAGE_KEY;
STORAGE_KEY = 'roninbay-r4-save-v1';
let STARTER_CAR;
STARTER_CAR = 'hachi';
const typeMatches = (valGiven, nameGiven) => {
  const typeSeen = typeof valGiven; return typeSeen === nameGiven; };
const recordOrNull = (valGiven) => {
  const isNull = valGiven === null;
  let outVal;
  if (isNull) outVal = null; else if (typeMatches(valGiven, 'object')) outVal = valGiven; else outVal = null;
  return outVal; };
const copyNum = (valGiven, sinkGiven) => { typeMatches(valGiven, 'number') ? sinkGiven(valGiven) : undefined; };
const restoreSaved = (stateGiven, savedGiven) => {
  copyNum(savedGiven.rep, (numGot) => { stateGiven.rep = numGot; });
  copyNum(savedGiven.money, (numGot) => { stateGiven.money = numGot; });
  copyNum(savedGiven.rankIdx, (numGot) => { stateGiven.rankIdx = numGot; });
  copyNum(savedGiven.missionIndex, (numGot) => { stateGiven.missionIndex = numGot; });
  const garageSaved = savedGiven.garage;
  const garageOk = garageSaved && Array.isArray(garageSaved) && garageSaved.length;
  garageOk ? (stateGiven.garage = garageSaved.slice()) : undefined;
  const districtsSaved = recordOrNull(savedGiven.districtState);
  districtsSaved ? (stateGiven.districtState = districtsSaved) : undefined; };
const garageFilled = (stateGiven) => {
  const arrOk = Array.isArray(stateGiven.garage); return arrOk && (stateGiven.garage.length > 0); };
const ensureGarage = (stateGiven) => {
  garageFilled(stateGiven) ? undefined : (stateGiven.garage = [STARTER_CAR]);
  stateGiven.ownedCars = stateGiven.garage.slice(); };
const buildPersistFn = (stateGiven) => {
  function persistOut() {
    try {
      Array.isArray(stateGiven.garage) ? (stateGiven.ownedCars = stateGiven.garage.slice()) : undefined;
      const snapOut = {};
      snapOut.money = stateGiven.money;
      snapOut.rep = stateGiven.rep;
      snapOut.rankIdx = stateGiven.rankIdx;
      snapOut.missionIndex = stateGiven.missionIndex;
      snapOut.garage = stateGiven.garage;
      snapOut.districtState = stateGiven.districtState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapOut));
    } catch (swallowed) { /* a blocked store must never take the game down */ }
  }
  return persistOut; };
export const initSave = (stateGiven) => {
  try {
    const rawSaved = localStorage.getItem(STORAGE_KEY);
    let parsedSaved;
    if (rawSaved) parsedSaved = recordOrNull(JSON.parse(rawSaved)); else parsedSaved = null;
    parsedSaved ? restoreSaved(stateGiven, parsedSaved) : undefined;
  } catch (swallowed) { /* a corrupt save counts as no save at all */ }
  ensureGarage(stateGiven); stateGiven.saveGame = buildPersistFn(stateGiven); };
