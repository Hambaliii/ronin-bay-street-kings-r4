// Browser storage persistence for this build
// Each storage access is guarded, so a blocked store
// degrades to a fresh start instead of an exception
const STORAGE_LABEL = 'roninbay-r4-save-v1';
const STARTER_CAR = 'hachi';
function recordShaped(valueIn) { return typeof valueIn === 'object' && valueIn !== null; }
function numberShaped(valueIn) { return typeof valueIn === 'number'; }
function applyNumericFields(G, savedObj) {
  if (numberShaped(savedObj.money)) G.money = savedObj.money;
  if (numberShaped(savedObj.rep)) G.rep = savedObj.rep;
  if (numberShaped(savedObj.rankIdx)) G.rankIdx = savedObj.rankIdx;
  if (numberShaped(savedObj.missionIndex)) G.missionIndex = savedObj.missionIndex; }
export function initSave(G) {
  try {
    const storedText = localStorage.getItem(STORAGE_LABEL);
    if (storedText) {
      const parsedObj = JSON.parse(storedText);
      if (recordShaped(parsedObj)) {
        applyNumericFields(G, parsedObj);
        const savedGarage = parsedObj.garage;
        if (savedGarage && Array.isArray(savedGarage) && savedGarage.length) G.garage = savedGarage.slice();
        if (recordShaped(parsedObj.districtState)) G.districtState = parsedObj.districtState; } }
  } catch (err) { /* an unreadable save simply means starting over */ }
  // Owned cars mirror the garage, both seeded from the same list
  const garageUsable = Array.isArray(G.garage) && !(G.garage.length === 0);
  G.garage = garageUsable ? G.garage : [STARTER_CAR];
  G.ownedCars = G.garage.slice();
  G.saveGame = () => { try {
      if (Array.isArray(G.garage)) G.ownedCars = G.garage.slice();
      const snapshotObj = {};
      snapshotObj.money = G.money; snapshotObj.rep = G.rep;
      snapshotObj.rankIdx = G.rankIdx; snapshotObj.missionIndex = G.missionIndex;
      snapshotObj.garage = G.garage; snapshotObj.districtState = G.districtState;
      localStorage.setItem(STORAGE_LABEL, JSON.stringify(snapshotObj));
    } catch (err) { /* full or blocked storage must stay survivable */ } }; }
