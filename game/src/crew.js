// crew.js — the crew and district standing systems.
// Finish missions to recruit crew members; each one grants a passive bonus.
// Standing rises per district as you complete work there; loved districts pay more.

export const CREW_POOL = [
  { id: 'fixer', name: 'Rolo the Fixer', unlockMission: 2, bonus: 'Cars repair themselves slowly' },
  { id: 'hacker', name: 'Iris the Hacker', unlockMission: 4, bonus: 'Wanted heat decays 25% faster' },
  { id: 'lookout', name: 'Tito the Lookout', unlockMission: 6, bonus: 'Police spawn one star later' },
];

export class CrewManager {
  constructor() {
    this.members = ['Dante'];
    this.recruited = new Set();
  }
  // Call after a mission completes; returns newly recruited members.
  onMissionComplete(missionId) {
    const gained = [];
    for (const c of CREW_POOL) {
      if (c.unlockMission === missionId && !this.recruited.has(c.id)) {
        this.recruited.add(c.id);
        this.members.push(c.name.split(' ')[0]);
        gained.push(c);
      }
    }
    return gained;
  }
  has(id) { return this.recruited.has(id); }
  names() { return this.members; }
  heatDecayMultiplier() { return this.has('hacker') ? 1.25 : 1; }
}

export class StandingManager {
  constructor() {
    this.map = { Marina: 0, 'Old Town': 0, 'La Colina': 0, Portside: 0, 'Neon Strip': 0 };
  }
  add(districtName, amount) {
    if (districtName in this.map) {
      this.map[districtName] = Math.max(0, Math.min(100, this.map[districtName] + amount));
    }
    return this.map[districtName] || 0;
  }
  get(districtName) { return this.map[districtName] || 0; }
  toJSON() { return { ...this.map }; }
  fromJSON(data) { if (data) for (const k of Object.keys(this.map)) if (k in data) this.map[k] = data[k]; }
}
