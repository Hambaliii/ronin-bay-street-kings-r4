// Progress persists in browser storage between sessions
// Each storage access is wrapped so a denied or full store
// degrades into a clean start instead of a failed launch
const STORAGE_SLOT_LABEL = 'roninbay-r4-save-v1';
const STARTER_CAR_ID = 'hachi';
function matchesType(valueIn, typeLabel) {
  return typeof valueIn === typeLabel; }
function asRecord(valueIn) {
  const recordReady = (valueIn !== null) && matchesType(valueIn, 'object');
  return recordReady ? valueIn : null; }
function whenNumeric(valueIn, applyFn) {
  if (matchesType(valueIn, 'number')) applyFn(valueIn); }
function restoreRecord(targetState, sourceRecord) {
  whenNumeric(sourceRecord.money, (heldMoney) => { targetState.money = heldMoney; });
  whenNumeric(sourceRecord.rep, (heldRep) => { targetState.rep = heldRep; });
  whenNumeric(sourceRecord.rankIdx, (heldRank) => { targetState.rankIdx = heldRank; });
  whenNumeric(sourceRecord.missionIndex, (heldMission) => { targetState.missionIndex = heldMission; });
  const garageHeld = sourceRecord.garage;
  const garageReady = garageHeld && Array.isArray(garageHeld) && garageHeld.length;
  if (garageReady) targetState.garage = garageHeld.slice();
  const districtsHeld = asRecord(sourceRecord.districtState);
  if (districtsHeld) targetState.districtState = districtsHeld; }
function garageHasCars(targetState) {
  return Array.isArray(targetState.garage) && (targetState.garage.length > 0); }
function guaranteeGarage(targetState) {
  if (!garageHasCars(targetState)) targetState.garage = [STARTER_CAR_ID];
  const mirroredCars = targetState.garage.slice();
  targetState.ownedCars = mirroredCars; }
function makePersistFn(targetState) {
  const persistFn = () => { try {
      if (Array.isArray(targetState.garage)) targetState.ownedCars = targetState.garage.slice();
      const snapshotHeld = { money: targetState.money, rep: targetState.rep, rankIdx: targetState.rankIdx, missionIndex: targetState.missionIndex, garage: targetState.garage, districtState: targetState.districtState };
      localStorage.setItem(STORAGE_SLOT_LABEL, JSON.stringify(snapshotHeld));
    } catch (ignoredErr) { /* a blocked store must never take the game down */ } };
  return persistFn; }
export function initSave(targetState) {
  try {
    const rawText = localStorage.getItem(STORAGE_SLOT_LABEL);
    const parsedRecord = rawText ? asRecord(JSON.parse(rawText)) : null;
    if (parsedRecord) restoreRecord(targetState, parsedRecord);
  } catch (ignoredErr) { /* a corrupt save is treated as no save at all */ }
  guaranteeGarage(targetState);
  targetState.saveGame = makePersistFn(targetState); }
