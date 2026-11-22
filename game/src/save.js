// ------------------------------------------------------------------ save.js
// localStorage persistence for RONIN BAY r4. Headless-safe: every access is
// wrapped so a missing/blocked localStorage never breaks the game.

const KEY = 'roninbay-r4-save-v1';

export function initSave(G) {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (typeof data.money === 'number') G.money = data.money;
        if (typeof data.rep === 'number') G.rep = data.rep;
        if (typeof data.rankIdx === 'number') G.rankIdx = data.rankIdx;
        if (typeof data.missionIndex === 'number') G.missionIndex = data.missionIndex;
        if (Array.isArray(data.garage) && data.garage.length) {
          G.garage = data.garage.slice();
        }
        if (data.districtState && typeof data.districtState === 'object') {
          G.districtState = data.districtState;
        }
      }
    }
  } catch (e) { /* no save or storage unavailable — fresh start */ }

  if (!Array.isArray(G.garage) || !G.garage.length) G.garage = ['hachi'];
  // Keep the two ownership lists identical, as S1 requires.
  G.ownedCars = G.garage.slice();

  G.saveGame = () => {
    try {
      // Re-sync before writing so the save can never split the lists.
      if (Array.isArray(G.garage)) G.ownedCars = G.garage.slice();
      localStorage.setItem(KEY, JSON.stringify({
        money: G.money,
        rep: G.rep,
        rankIdx: G.rankIdx,
        missionIndex: G.missionIndex,
        garage: G.garage,
        districtState: G.districtState,
      }));
    } catch (e) { /* storage full/blocked — ignore */ }
  };
}
