// save.js — localStorage save/load for Puerto Alba: cash, missions, packages,
// crew, district standing, lead, position and the time of day.

const KEY = 'puerto-alba-save-v1';

export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      missionsDone: state.missionsDone,
      packagesFound: state.packagesFound,
      crew: state.crew,
      standing: state.standing,
      lead: state.lead,
      hour: state.hour,
      pos: [state.pos.x, state.pos.z],
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || !Array.isArray(data.crew)) return null;
    return data;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
