// Saved progress lives in browser storage for this build
// Every storage touch sits behind a guard so a blocked store
// falls back to a fresh start rather than breaking the boot
const STORAGE_KEY = 'roninbay-r4-save-v1';
const STARTER_CAR = 'hachi';
function looksLikeRecord(candidateGiven) {
  const presentGiven = (candidateGiven !== null);
  const objectGiven = (typeof candidateGiven === 'object');
  return (objectGiven && presentGiven); }
function looksLikeNumber(candidateGiven) {
  const numberGiven = (typeof candidateGiven === 'number');
  return numberGiven; }
function copySavedNumbers(stateGiven, recordGiven) {
  const appliersNow = [
    () => { if (looksLikeNumber(recordGiven.money)) stateGiven.money = recordGiven.money; },
    () => { if (looksLikeNumber(recordGiven.rep)) stateGiven.rep = recordGiven.rep; },
    () => { if (looksLikeNumber(recordGiven.rankIdx)) stateGiven.rankIdx = recordGiven.rankIdx; },
    () => { if (looksLikeNumber(recordGiven.missionIndex)) stateGiven.missionIndex = recordGiven.missionIndex; }];
  appliersNow.forEach((applyNow) => applyNow()); }
function copySavedGarage(stateGiven, recordGiven) {
  const garageGiven = recordGiven.garage;
  const garageUsable = garageGiven && Array.isArray(garageGiven) && garageGiven.length;
  if (!garageUsable) return;
  stateGiven.garage = garageGiven.slice(); }
function copySavedDistricts(stateGiven, recordGiven) {
  const { districtState: districtsGiven } = recordGiven;
  if (looksLikeRecord(districtsGiven)) stateGiven.districtState = districtsGiven; }
export function initSave(stateGiven) {
  try {
    const storedRaw = localStorage.getItem(STORAGE_KEY);
    if (storedRaw) {
      const decodedNow = JSON.parse(storedRaw);
      if (looksLikeRecord(decodedNow)) {
        copySavedNumbers(stateGiven, decodedNow);
        copySavedGarage(stateGiven, decodedNow);
        copySavedDistricts(stateGiven, decodedNow); } }
  } catch (ignoredFault) { /* an unreadable save simply means starting over */ }
  const garageIsList = Array.isArray(stateGiven.garage);
  const garageEmpty = garageIsList && (stateGiven.garage.length === 0);
  const garageMissing = !garageIsList;
  if (garageMissing || garageEmpty) stateGiven.garage = [STARTER_CAR];
  stateGiven.ownedCars = stateGiven.garage.slice();
  stateGiven.saveGame = () => { try {
      if (Array.isArray(stateGiven.garage)) stateGiven.ownedCars = stateGiven.garage.slice();
      const recordOut = {};
      recordOut.money = stateGiven.money; recordOut.rep = stateGiven.rep;
      recordOut.rankIdx = stateGiven.rankIdx; recordOut.missionIndex = stateGiven.missionIndex;
      recordOut.garage = stateGiven.garage; recordOut.districtState = stateGiven.districtState;
      const encodedNow = JSON.stringify(recordOut);
      localStorage.setItem(STORAGE_KEY, encodedNow);
    } catch (ignoredFault) { /* full or blocked storage must stay survivable */ } }; }
