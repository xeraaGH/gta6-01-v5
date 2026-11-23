// missions.js — 10 story missions, 3 street races, taxi fares and 20 hidden packages.
// Missions are data: each step is goto / collect / race / combat / survive / deliver.
// The manager drives the objective HUD text, the world marker and the payouts.

export const MISSIONS = [
  { id: 1, title: 'FIRST WHEELS', lead: 'Dante', brief: 'Mara needs wheels. Steal any car and bring it to the Marina hideout.',
    reward: 400, steps: [
      { type: 'goto', text: 'Steal a car (press E near one)', needCar: true, pos: [0, 0], radius: 999 },
      { type: 'goto', text: 'Drive to the Marina hideout', pos: [-480, -480], radius: 14 }] },
  { id: 2, title: 'THE PICKUP', lead: 'Mara', brief: 'Mara is waiting at the Neon Strip. Pick her up and lose the tail.',
    reward: 600, steps: [
      { type: 'goto', text: 'Pick up Mara at the Neon Strip', pos: [300, 480], radius: 12 },
      { type: 'goto', text: 'Drive Mara to the Old Town safehouse', pos: [480, -480], radius: 14 }] },
  { id: 3, title: 'HOT CARGO', lead: 'Dante', brief: 'Three crates are stashed around La Colina. Grab them all — the PD patrols the hills.',
    reward: 900, steps: [
      { type: 'collect', text: 'Collect the crates in La Colina (0/3)', pos: [-480, 300], radius: 10, count: 3,
        spots: [[-480, 300], [-360, 420], [-240, 180]] }] },
  { id: 4, title: 'STREET HEAT', lead: 'Dante', brief: 'Race 1: beat the Alba street crew through the Neon Strip checkpoints.',
    reward: 1200, steps: [
      { type: 'race', text: 'Race! Hit every checkpoint before the rivals', pos: [120, 420], radius: 12,
        checkpoints: [[120, 420], [360, 420], [480, 240], [360, 60], [120, 60]] }] },
  { id: 5, title: 'PAYBACK', lead: 'Mara', brief: 'The Vipers jumped our lookout. Take out 4 of them in the Portside yard.',
    reward: 1100, steps: [
      { type: 'combat', text: 'Take out the Vipers (0/4)', pos: [360, 120], radius: 30, count: 4 }] },
  { id: 6, title: 'THE VAULT RUN', lead: 'Dante', brief: 'Timed run: cross the city from the port to the lighthouse in 90 seconds.',
    reward: 1500, steps: [
      { type: 'goto', text: 'Reach the lighthouse before time runs out', pos: [-540, -540], radius: 16, time: 90 }] },
  { id: 7, title: 'MIDNIGHT FERRY', lead: 'Mara', brief: 'Night job. Slip past the helicopter patrol and deliver the package to the pier.',
    reward: 1600, night: true, steps: [
      { type: 'goto', text: 'Reach the pier without getting busted', pos: [540, -480], radius: 14, heat: 60 }] },
  { id: 8, title: 'ALBA GRAND PRIX', lead: 'Dante', brief: 'Race 2: the big one — a full lap of Puerto Alba against the best in the city.',
    reward: 2200, steps: [
      { type: 'race', text: 'Grand Prix! Full lap of the city', pos: [-480, -480], radius: 14,
        checkpoints: [[-480, -480], [480, -480], [480, 480], [-480, 480], [-480, -480]] }] },
  { id: 9, title: 'DISTRICT WAR', lead: 'Mara', brief: 'Take the Neon Strip. Win the race, then hold the plaza against the Vipers.',
    reward: 2000, steps: [
      { type: 'race', text: 'Race the Vipers through the Strip', pos: [120, 360], radius: 12,
        checkpoints: [[120, 360], [360, 360], [480, 480], [240, 480]] },
      { type: 'combat', text: 'Clear the plaza (0/3)', pos: [300, 420], radius: 34, count: 3 }] },
  { id: 10, title: 'THE ALBA HEIST', lead: 'Dante', brief: 'The vault under the Portside docks. Grab the gold, outrun a 5-star response, reach the hideout.',
    reward: 5000, steps: [
      { type: 'goto', text: 'Break into the dock vault', pos: [420, 60], radius: 12 },
      { type: 'survive', text: 'Escape the 5-star dragnet — reach the Marina hideout', pos: [-480, -480], radius: 16, time: 150 }] },
];

export const RACES = [
  { name: 'Neon Sprint', checkpoints: [[120, 420], [360, 420], [480, 240], [360, 60]], prize: 800 },
  { name: 'Coast Run', checkpoints: [[-480, 420], [-240, 480], [120, 480], [480, 420]], prize: 900 },
  { name: 'Port Loop', checkpoints: [[120, -480], [360, -480], [480, -240], [240, -120]], prize: 1000 },
];

export const PACKAGE_SPOTS = [
  [-480, -480], [-240, -480], [0, -480], [240, -480], [480, -480],
  [-480, -240], [-240, -240], [0, -240], [240, -240], [480, -240],
  [-480, 0], [-240, 0], [0, 0], [240, 0], [480, 0],
  [-480, 240], [-240, 240], [0, 240], [240, 240], [480, 240],
];

export class MissionManager {
  constructor() {
    this.current = null; // active mission object
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.collected = 0;
    this.kills = 0;
    this.raceIndex = 0;
    this.raceTime = 0;
    this.completedCount = 0;
    this.taxi = null; // active taxi fare {from, to, fare, timer}
    this.packagesFound = 0;
    this.raceWins = 0;
  }
  startMission(index) {
    this.current = MISSIONS[index];
    this.stepIndex = 0;
    this.collected = 0; this.kills = 0; this.raceIndex = 0; this.raceTime = 0;
    const step = this.current.steps[0];
    this.stepTimer = step.time || 0;
    return this.current;
  }
  currentStep() {
    return this.current ? this.current.steps[this.stepIndex] : null;
  }
  // Returns 'done' | 'failed' | null. pos is the player's Vector3, inCar bool.
  update(dt, pos, inCar, kills) {
    if (!this.current) return null;
    const step = this.currentStep();
    if (!step) return 'done';
    if (step.time) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) return 'failed';
    }
    if (step.type === 'goto') {
      if (step.needCar && !inCar) return null;
      const d = Math.hypot(pos.x - step.pos[0], pos.z - step.pos[1]);
      if (d < step.radius) return this.advance();
    } else if (step.type === 'collect') {
      const spot = step.spots[this.collected];
      if (spot) {
        const d = Math.hypot(pos.x - spot[0], pos.z - spot[1]);
        if (d < step.radius) {
          this.collected++;
          if (this.collected >= step.count) return this.advance();
        }
      }
    } else if (step.type === 'race') {
      this.raceTime += dt;
      const cp = step.checkpoints[this.raceIndex];
      if (cp) {
        const d = Math.hypot(pos.x - cp[0], pos.z - cp[1]);
        if (d < step.radius) {
          this.raceIndex++;
          if (this.raceIndex >= step.checkpoints.length) return this.advance();
        }
      }
    } else if (step.type === 'combat') {
      if (kills >= step.count) return this.advance();
    } else if (step.type === 'survive') {
      const d = Math.hypot(pos.x - step.pos[0], pos.z - step.pos[1]);
      if (d < step.radius) return this.advance();
    } else if (step.type === 'deliver') {
      const d = Math.hypot(pos.x - step.pos[0], pos.z - step.pos[1]);
      if (d < step.radius) return this.advance();
    }
    return null;
  }
  advance() {
    this.stepIndex++;
    this.collected = 0; this.kills = 0; this.raceIndex = 0;
    if (this.stepIndex >= this.current.steps.length) {
      const done = this.current;
      this.current = null;
      this.completedCount++;
      return 'done';
    }
    const step = this.currentStep();
    this.stepTimer = step.time || 0;
    return 'advanced';
  }
  objectiveText() {
    if (!this.current) return null;
    const step = this.currentStep();
    if (!step) return null;
    let text = step.text;
    if (step.type === 'collect') text = text.replace(/\(\d+\/\d+\)/, `(${this.collected}/${step.count})`);
    if (step.type === 'combat') text = text.replace(/\(\d+\/\d+\)/, `(${Math.min(this.kills, step.count)}/${step.count})`);
    if (step.type === 'race') text = `${text} — checkpoint ${this.raceIndex + 1}/${step.checkpoints.length}`;
    if (step.time) text += ` — ${Math.max(0, Math.ceil(this.stepTimer))}s left`;
    return { title: `MISSION ${this.current.id}: ${this.current.title}`, text };
  }
  markerPos() {
    if (!this.current) return null;
    const step = this.currentStep();
    if (!step) return null;
    if (step.type === 'collect' && step.spots) return step.spots[this.collected] || null;
    if (step.type === 'race') return step.checkpoints[this.raceIndex] || null;
    return step.pos || null;
  }
  startTaxi(from) {
    const spots = [[-480, -480], [480, -480], [300, 480], [-480, 300], [540, 120], [120, -540]];
    const to = spots[Math.floor(Math.random() * spots.length)];
    this.taxi = { from: [from.x, from.z], to, fare: 150 + Math.floor(Math.random() * 250), timer: 75 };
    return this.taxi;
  }
  updateTaxi(dt, pos) {
    if (!this.taxi) return null;
    this.taxi.timer -= dt;
    if (this.taxi.timer <= 0) { this.taxi = null; return 'expired'; }
    const d = Math.hypot(pos.x - this.taxi.to[0], pos.z - this.taxi.to[1]);
    if (d < 14) { const fare = this.taxi.fare; this.taxi = null; return { done: true, fare }; }
    return null;
  }
}
