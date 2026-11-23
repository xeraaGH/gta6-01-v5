// main.js — Puerto Alba: boot, game loop, camera, combat, packages, taxi,
// street races, save/load, menus and the ?shot= presets used for screenshots.
// Everything the game does runs through this file; the world is built by city.js,
// cars by vehicles.js, the law by police.js and the story by missions.js.

import { buildCity, districtAt, clampToCity, collides } from './city.js';
import { Car, TrafficManager, CAR_COLORS } from './vehicles.js';
import { Player } from './player.js';
import { PoliceManager } from './police.js';
import { MissionManager, MISSIONS, RACES, PACKAGE_SPOTS } from './missions.js';
import { PedManager } from './peds.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { CrewManager, StandingManager } from './crew.js';
import { ParticleSystem, MarkerBeacon, DayCycle } from './effects.js';

window.addEventListener('error', (e) => {
  const el = document.getElementById('err');
  if (el) el.textContent = `ERROR: ${e.message} @ ${e.filename}:${e.lineno}`;
});

// ---------- state ----------
const state = {
  mode: 'title', // title | playing | paused | over
  cash: 500,
  lead: 'Dante',
  missionsDone: 0,
  packagesFound: 0,
  kills: 0,
  raceWins: 0,
  taxiFares: 0,
  hour: 12,
  nightForced: false,
  camYaw: 0,
  camPitch: 0.32,
  camDist: 13,
  shot: new URLSearchParams(location.search).get('shot'),
  quickRace: null,
  missionKills: 0,
};

// ---------- three setup ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x9fc9e8, 200, 1100);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 2000);
camera.position.set(-60, 30, -60);

const sun = new THREE.DirectionalLight(0xfff2d8, 1.6);
sun.position.set(300, 420, 180);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -700; sun.shadow.camera.right = 700;
sun.shadow.camera.top = 700; sun.shadow.camera.bottom = -700;
sun.shadow.camera.far = 1600;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.5;
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.85);
scene.add(hemi);

// ---------- world ----------
const city = buildCity(scene);
const traffic = new TrafficManager(scene, city);
const player = new Player(scene);
const police = new PoliceManager(scene, city);
const missions = new MissionManager();
const peds = new PedManager(scene, city);
const audio = new AudioEngine();
const hud = new HUD();
const crew = new CrewManager();
const standing = new StandingManager();
const particles = new ParticleSystem(scene);
const beacon = new MarkerBeacon(scene);
const dayCycle = new DayCycle(scene, sun, hemi, city.lamps);

// Parked cars the player can take without stealing.
const parkedCars = [];
function spawnParkedCars() {
  // Parked on road lanes (just off the centreline), never inside a block.
  const spots = [[-116, -60], [116, -72], [-236, 60], [236, -180], [-356, -60], [116, 300], [476, 180], [-476, 420]];
  spots.forEach(([x, z], i) => {
    const pick = CAR_COLORS[i % CAR_COLORS.length];
    const car = new Car(scene, x, z, Math.PI / 2, pick.color, { topSpeed: 32 + (i % 4) * 2 });
    car.name = pick.name;
    car.parked = true;
    parkedCars.push(car);
  });
}
spawnParkedCars();

// Hidden packages: gold glowing crates.
const packageMeshes = [];
function spawnPackages() {
  const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  for (const [x, z] of PACKAGE_SPOTS) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 1.2, z);
    scene.add(m);
    packageMeshes.push({ mesh: m, x, z, found: false, spin: Math.random() * 6 });
  }
}
spawnPackages();

// ---------- enemies (Viper gang) ----------
const enemies = [];
function spawnEnemies(cx, cz, count) {
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x8e1f2f }));
    body.position.y = 1.35; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshLambertMaterial({ color: 0xc98d64 }));
    head.position.y = 2.2; g.add(head);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    gun.position.set(0.5, 1.5, 0.5); g.add(gun);
    const x = cx + (Math.random() - 0.5) * 40;
    const z = cz + (Math.random() - 0.5) * 40;
    g.position.set(x, 0, z);
    scene.add(g);
    enemies.push({ group: g, pos: new THREE.Vector3(x, 0, z), hp: 3, shootTimer: 1 + Math.random() });
  }
}
function clearEnemies() {
  for (const e of enemies) scene.remove(e.group);
  enemies.length = 0;
}

// ---------- input ----------
const input = { forward: false, back: false, left: false, right: false, shift: false, camYaw: 0 };
const KEYMAP = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
addEventListener('keydown', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = true;
  if (KEYMAP[e.code]) { input[e.code] = true; input[KEYMAP[e.code]] = true; }
  if (e.code === 'KeyE') tryEnterCar();
  if (e.code === 'KeyF') doPunch();
  if (e.code === 'KeyR') { const n = audio.nextStation(); hud.setRadio(n); hud.toast(`RADIO: ${n}`); }
  if (e.code === 'KeyC') switchLead();
  if (e.code === 'KeyM') startNextMission();
  if (e.code === 'KeyT') startTaxi();
  if (e.code === 'KeyG') startQuickRace();
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyH') showHelp();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.shift = false;
  if (KEYMAP[e.code]) input[KEYMAP[e.code]] = false;
});
let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', (e) => {
  if (!dragging) return;
  state.camYaw -= (e.clientX - lastX) * 0.005;
  state.camPitch = Math.max(0.08, Math.min(0.9, state.camPitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX; lastY = e.clientY;
});
canvas.addEventListener('click', (e) => {
  if (state.mode !== 'playing' || player.inCar) return;
  shootAt(e.clientX, e.clientY);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- actions ----------
function switchLead() {
  if (state.mode !== 'playing') return;
  state.lead = state.lead === 'Dante' ? 'Mara' : 'Dante';
  player.setLead(state.lead);
  hud.toast(`Now playing as ${state.lead === 'Dante' ? 'DANTE REYES — faster driving' : 'MARA SOLÍS — loses cops faster'}`);
  hud.setCrew([state.lead, ...crew.names().filter((n) => n !== 'Dante' && n !== 'Mara')]);
  audio.blip(660, 0.1);
}

function tryEnterCar() {
  if (state.mode !== 'playing') return;
  if (player.inCar) {
    const car = player.inCar;
    player.inCar = null;
    player.pos.set(car.pos.x + 3, 0, car.pos.z + 3);
    player.group.position.copy(player.pos);
    player.group.visible = true;
    hud.setSpeed(0, 'ON FOOT');
    return;
  }
  const allCars = [...parkedCars, ...traffic.cars, ...police.cars];
  let best = null, bestD = 8;
  for (const car of allCars) {
    const d = car.pos.distanceTo(player.pos);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) { hud.toast('No car nearby — walk to one and press E'); return; }
  if (best.isPolice) { hud.toast('That is a police car!'); return; }
  if (best.parked) {
    player.inCar = best;
    best.parked = false;
    parkedCars.splice(parkedCars.indexOf(best), 1);
    hud.toast(`You took the ${best.name}`);
  } else {
    // Stealing a moving car: the owner fights back with heat.
    player.inCar = best;
    const ti = traffic.cars.indexOf(best);
    if (ti >= 0) traffic.cars.splice(ti, 1); // keep the mesh: the player now drives it
    police.addHeat(12, 'stole car');
    hud.toast(`STOLEN: ${best.name} — the PD noticed!`);
    audio.blip(440, 0.2, 'sawtooth', 0.2);
  }
  player.group.visible = false;
  audio.init(); audio.resume();
}

function doPunch() {
  if (state.mode !== 'playing' || player.inCar) return;
  player.punch();
  audio.blip(180, 0.08, 'square', 0.15);
  // Punch the nearest enemy or ped in front.
  for (const e of enemies) {
    if (e.hp > 0 && e.pos.distanceTo(player.pos) < 3) { damageEnemy(e, 1); return; }
  }
  const ped = peds.nearest(player.pos, 3);
  if (ped) { police.addHeat(6, 'assault'); hud.toast('The police saw that!'); }
}

function shootAt(cx, cy) {
  if (!player.canShoot()) return;
  player.shoot();
  audio.gunshot();
  police.addHeat(4, 'gunfire');
  peds.update(0.01, player.pos, player.pos, true);
  const ndc = new THREE.Vector2((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(ndc, camera);
  let hitEnemy = null, hitDist = 120;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d = ray.ray.distanceToPoint(e.pos.clone().setY(1.4));
    const along = ray.ray.direction.dot(e.pos.clone().setY(1.4).sub(ray.ray.origin));
    if (d < 2.2 && along > 0 && along < hitDist) { hitEnemy = e; hitDist = along; }
  }
  const muzzle = player.pos.clone().setY(1.6);
  if (hitEnemy) {
    particles.burst(hitEnemy.pos.clone().setY(1.4), 0xff5533, 10, 5);
    damageEnemy(hitEnemy, 1);
  } else {
    const end = ray.ray.origin.clone().addScaledVector(ray.ray.direction, 60);
    particles.burst(end, 0xffcc66, 4, 2);
  }
  particles.burst(muzzle, 0xffe066, 5, 3);
}

function damageEnemy(e, amount) {
  e.hp -= amount;
  if (e.hp <= 0) {
    scene.remove(e.group);
    particles.burst(e.pos.clone().setY(1), 0xff2222, 16, 7);
    state.kills++;
    state.missionKills++;
    missions.kills = state.missionKills;
    state.cash += 50;
    audio.coin();
    hud.toast('Viper down! +$50');
  }
}

function startNextMission() {
  if (state.mode !== 'playing') return;
  if (missions.current) { hud.toast('Finish the current mission first (or wait for it to fail)'); return; }
  if (state.missionsDone >= MISSIONS.length) { hud.toast('Story complete! Free roam, races and taxi fares remain.'); return; }
  const m = missions.startMission(state.missionsDone);
  state.missionKills = 0;
  missions.kills = 0;
  hud.banner(`MISSION ${m.id}`, m.title);
  hud.toast(m.brief, 5000);
  audio.blip(880, 0.15); setTimeout(() => audio.blip(1174, 0.2), 150);
  if (m.night) { state.nightForced = true; dayCycle.setHour(22); police.addHeat(60, 'night job'); }
  if (m.id === 5 || m.id === 9) spawnEnemies(360, 120, m.id === 5 ? 4 : 3);
  const d = districtAt(player.pos.x, player.pos.z);
  standing.add(d.name, 2);
}

function completeMission(m) {
  state.cash += m.reward;
  state.missionsDone++;
  const gained = crew.onMissionComplete(m.id);
  const d = districtAt(player.pos.x, player.pos.z);
  standing.add(d.name, 12);
  hud.banner('MISSION PASSED', `+$${m.reward.toLocaleString('en-US')} — ${m.title}`);
  hud.toast(gained.length ? `Crew recruited: ${gained.map((g) => g.name).join(', ')}` : 'Cash banked. Next mission: press M', 4200);
  audio.coin();
  state.nightForced = false;
  clearEnemies();
  saveGame(snapshot());
}

function failMission(reason) {
  const m = missions.current;
  missions.current = null;
  state.nightForced = false;
  clearEnemies();
  hud.banner('MISSION FAILED', reason);
  hud.toast('Press M to retry the mission');
}

function startTaxi() {
  if (state.mode !== 'playing') return;
  if (!player.inCar) { hud.toast('You need a car for a taxi fare — press E near one'); return; }
  if (missions.taxi) { hud.toast('Fare already running — follow the yellow marker'); return; }
  const fare = missions.startTaxi(player.pos);
  hud.toast(`TAXI FARE: take the passenger to the marker — $${fare.fare}`);
  audio.blip(990, 0.12);
}

function startQuickRace() {
  if (state.mode !== 'playing') return;
  if (!player.inCar) { hud.toast('Races need a car — press E near one'); return; }
  if (state.quickRace) return;
  const race = RACES[state.raceWins % RACES.length];
  state.quickRace = { race, index: 0, time: 0 };
  hud.banner('STREET RACE', `${race.name} — $${race.prize}`);
  hud.toast('Hit every checkpoint — first through the last one wins');
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    document.getElementById('pause-screen').classList.remove('hidden');
    document.getElementById('pause-stats').textContent =
      `Cash $${state.cash.toLocaleString('en-US')} · Missions ${state.missionsDone}/10 · Packages ${state.packagesFound}/20 · Races won ${state.raceWins} · Lead ${state.lead}`;
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    document.getElementById('pause-screen').classList.add('hidden');
  }
}

function showHelp() {
  document.getElementById('help-screen').classList.remove('hidden');
}

function gameOver(title, text) {
  state.mode = 'over';
  document.getElementById('gameover-title').textContent = title;
  document.getElementById('gameover-text').textContent = text;
  document.getElementById('gameover-screen').classList.remove('hidden');
  saveGame(snapshot());
}

function snapshot() {
  return {
    cash: state.cash, missionsDone: state.missionsDone, packagesFound: state.packagesFound,
    crew: crew.names(), standing: standing.toJSON(), lead: state.lead, hour: dayCycle.hour,
    pos: player.pos,
  };
}

function applySave(data) {
  state.cash = data.cash;
  state.missionsDone = data.missionsDone;
  state.packagesFound = data.packagesFound;
  state.lead = data.lead || 'Dante';
  player.setLead(state.lead);
  dayCycle.setHour(data.hour || 12);
  if (data.pos) player.pos.set(data.pos[0], 0, data.pos[1]);
  if (data.standing) standing.fromJSON(data.standing);
  if (data.crew) crew.members = data.crew;
  // Mark already-found packages as collected.
  for (let i = 0; i < state.packagesFound && i < packageMeshes.length; i++) {
    packageMeshes[i].found = true;
    packageMeshes[i].mesh.visible = false;
  }
}

// ---------- menus ----------
function startGame(fresh) {
  audio.init(); audio.resume();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  if (fresh) {
    state.cash = 500; state.missionsDone = 0; state.packagesFound = 0;
    player.pos.set(0, 0, -40); player.health = 100;
    for (const p of packageMeshes) { p.found = false; p.mesh.visible = true; }
  } else {
    const data = loadGame();
    if (data) applySave(data);
  }
  state.mode = 'playing';
  hud.setCash(state.cash);
  hud.setCrew([state.lead, ...crew.names().filter((n) => n !== state.lead)]);
  hud.toast(fresh ? 'Welcome to Puerto Alba — press M for your first mission' : 'Welcome back to Puerto Alba', 4200);
}
document.getElementById('btn-new').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-how').addEventListener('click', showHelp);
document.getElementById('btn-help-close').addEventListener('click', () => {
  document.getElementById('help-screen').classList.add('hidden');
});
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-save').addEventListener('click', () => {
  if (saveGame(snapshot())) hud.toast('Game saved');
});
document.getElementById('btn-quit').addEventListener('click', () => {
  saveGame(snapshot());
  state.mode = 'title';
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
});
document.getElementById('btn-retry').addEventListener('click', () => {
  player.health = 100;
  player.pos.set(0, 0, -40);
  police.clearAll();
  document.getElementById('gameover-screen').classList.add('hidden');
  state.mode = 'playing';
});
if (!hasSave()) document.getElementById('btn-continue').style.opacity = '0.4';

// ---------- screenshot presets (?shot=chase|foot|mission|night) ----------
function applyShotPreset() {
  const shot = state.shot;
  if (!shot) return;
  state.mode = 'playing';
  document.getElementById('start-screen').classList.add('hidden');
  audio.init();
  if (shot === 'chase') {
    const car = new Car(scene, -120, -300, 0, 0xc0392b, { topSpeed: 36, player: true });
    car.name = 'Alba Red';
    player.inCar = car;
    player.group.visible = false;
    car.speed = 26;
    police.addHeat(58, 'chase');
    police.spawnPoliceCar(car.pos); police.spawnPoliceCar(car.pos);
    // One interceptor cruises ahead of the chase so it reads in the cover shot.
    const blocker = new Car(scene, -116, car.pos.z + 90, 0, 0x1a3a5c,
      { police: true, topSpeed: 25, accel: 16 });
    blocker.name = 'Police Interceptor';
    police.cars.push(blocker);
    missions.startMission(0);
    state.camYaw = 0;
  } else if (shot === 'foot') {
    player.pos.set(-480, 0, 260);
    player.heading = 0;
    player.group.rotation.y = 0;
    state.camYaw = 0;
    missions.startMission(2);
  } else if (shot === 'mission') {
    const car = new Car(scene, 120, 300, 0, 0x2471a3, { topSpeed: 36, player: true });
    car.name = 'Ocean Blue';
    player.inCar = car; player.group.visible = false; car.speed = 18;
    missions.startMission(3);
    spawnEnemies(360, 120, 3);
    police.addHeat(20, 'mission');
    state.camYaw = 0;
  } else if (shot === 'night') {
    const car = new Car(scene, 240, 240, Math.PI, 0x1c1c22, { topSpeed: 36, player: true });
    car.name = 'Midnight Black';
    player.inCar = car; player.group.visible = false; car.speed = 22;
    state.nightForced = true;
    dayCycle.setHour(22);
    police.addHeat(80, 'night');
    police.spawnPoliceCar(car.pos);
    missions.startMission(6);
    state.camYaw = 0;
  }
  hud.setCash(state.cash);
}
applyShotPreset();

// ---------- camera ----------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const focus = player.inCar ? player.inCar.pos : player.pos;
  const heading = player.inCar ? player.inCar.heading : player.heading;
  // Camera yaw follows the vehicle heading, blended with the drag orbit.
  const yaw = heading + Math.PI + state.camYaw * 0.35;
  const dist = player.inCar ? state.camDist + 4 : state.camDist;
  const h = player.inCar ? 7.5 : 6;
  const tx = focus.x + Math.sin(yaw) * dist;
  const tz = focus.z + Math.cos(yaw) * dist;
  const ty = h + Math.sin(state.camPitch) * 8;
  camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 5);
  camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 5);
  camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 5);
  camTarget.set(focus.x, (player.inCar ? 1.5 : 1.8), focus.z);
  camera.lookAt(camTarget);
  // Keep the sun's shadow box on the player.
  sun.position.set(focus.x + 300, 420, focus.z + 180);
  sun.target.position.set(focus.x, 0, focus.z);
  sun.target.updateMatrixWorld();
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let hudTimer = 0;
let lastRamSlow = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (state.mode === 'playing') {
    // --- input to motion ---
    input.camYaw = state.camYaw;
    // Screenshot presets auto-drive so the chase/race shots show motion.
    if (state.shot && player.inCar) input.forward = true;
    if (player.inCar) {
      const car = player.inCar;
      const throttle = (input.forward ? 1 : 0) - (input.back ? 0.7 : 0);
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      car.drive(throttle, steer, dt, input.shift && state.lead === 'Dante');
      // Collisions with buildings: stop and spark.
      if (collides(city.colliders, car.pos.x, car.pos.z, 2.2)) {
        car.pos.x -= Math.sin(car.heading) * car.speed * dt * 2;
        car.pos.z -= Math.cos(car.heading) * car.speed * dt * 2;
        if (Math.abs(car.speed) > 12) { particles.burst(car.pos.clone().setY(1), 0xffcc66, 8, 4); audio.crash(); }
        car.speed *= 0.3;
      }
      const clamped = clampToCity(car.pos.x, car.pos.z);
      car.pos.x = clamped.x; car.pos.z = clamped.z;
      car.group.position.copy(car.pos);
      // Speeding through the city draws heat.
      if (Math.abs(car.speed) > 26 && Math.random() < dt * 0.4) police.addHeat(1, 'speeding');
      audio.setEngine(Math.abs(car.speed) * 3.6, true);
    } else {
      player.update(dt, input, city);
      audio.setEngine(0, false);
    }
    // --- world updates ---
    const focus = player.inCar ? player.inCar.pos : player.pos;
    traffic.update(dt, focus);
    peds.update(dt, focus, player.pos, false);
    police.onRam = (d) => {
      if (player.inCar) {
        const now = performance.now();
        if (now - lastRamSlow > 1000) { lastRamSlow = now; player.inCar.speed *= 0.85; }
      }
      else if (player.damage(8 * d)) gameOver('WASTED', 'The Alba PD took you down. Your crew will remember you.');
    };
    police.update(dt, focus, !!player.inCar, state.lead);
    audio.setSiren(police.wanted);
    const night = dayCycle.update(dt, state.nightForced);
    particles.update(dt);
    beacon.update(dt);
    // --- enemies ---
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      const d = e.pos.distanceTo(focus);
      if (d < 45 && d > 4) {
        const h = Math.atan2(focus.x - e.pos.x, focus.z - e.pos.z);
        e.pos.x += Math.sin(h) * 3.2 * dt;
        e.pos.z += Math.cos(h) * 3.2 * dt;
        e.group.position.copy(e.pos);
        e.group.rotation.y = h;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < 38) {
          e.shootTimer = 1.6;
          particles.burst(e.pos.clone().setY(1.5), 0xffe066, 4, 3);
          audio.blip(300, 0.06, 'square', 0.08);
          if (player.inCar) { /* bullets ping off the car */ }
          else if (player.damage(6)) gameOver('WASTED', 'The Vipers got you. The Alba job is not over — retry.');
        }
      }
    }
    // --- peds hit by cars: only the player's car or police cars count against the player ---
    const hits = peds.checkCarHits([...(player.inCar ? [player.inCar] : []), ...police.cars]);
    if (hits > 0) police.addHeat(10 * hits, 'hit pedestrian');
    // --- hidden packages ---
    for (const p of packageMeshes) {
      if (p.found) continue;
      p.spin += dt;
      p.mesh.rotation.y = p.spin;
      p.mesh.position.y = 1.2 + Math.sin(p.spin * 2) * 0.25;
      if (focus.distanceTo(new THREE.Vector3(p.x, 0, p.z)) < 4) {
        p.found = true; p.mesh.visible = false;
        state.packagesFound++;
        state.cash += 100;
        audio.coin();
        hud.toast(`Hidden package found! ${state.packagesFound}/20 — +$100`);
        if (state.packagesFound === 20) { state.cash += 2000; hud.banner('ALL PACKAGES', 'All 20 hidden packages — bonus $2,000!'); }
      }
    }
    // --- missions ---
    const mres = missions.update(dt, focus, !!player.inCar, state.missionKills);
    if (mres === 'done' && missions.current === null) {
      // The mission that just finished was captured before advance cleared it.
    }
    if (mres === 'failed') failMission('Time ran out — the trail went cold.');
    // Detect completion: update() returns 'done' only when the last step advanced.
    if (mres === 'done') {
      const done = MISSIONS[state.missionsDone];
      if (done) completeMission(done);
    }
    const obj = missions.objectiveText();
    const marker = missions.markerPos();
    if (obj) hud.setObjective(obj.title, obj.text);
    else if (missions.taxi) hud.setObjective('TAXI FARE', `Deliver the passenger — $${missions.taxi.fare} — ${Math.ceil(missions.taxi.timer)}s left`);
    else hud.setObjective('FREE ROAM', 'Press M for the next story mission · T taxi · G street race · find gold packages');
    if (marker) beacon.set(marker[0], marker[1]);
    else if (missions.taxi) beacon.set(missions.taxi.to[0], missions.taxi.to[1]);
    else if (state.quickRace) beacon.set(state.quickRace.race.checkpoints[state.quickRace.index][0], state.quickRace.race.checkpoints[state.quickRace.index][1]);
    else beacon.hide();
    // --- taxi ---
    if (missions.taxi) {
      const tres = missions.updateTaxi(dt, focus);
      if (tres && tres.done) {
        state.cash += tres.fare; state.taxiFares++;
        hud.toast(`Fare complete! +$${tres.fare}`);
        audio.coin();
      } else if (tres === 'expired') hud.toast('The passenger gave up and left');
    }
    // --- quick race ---
    if (state.quickRace) {
      const q = state.quickRace;
      q.time += dt;
      const cp = q.race.checkpoints[q.index];
      if (cp && Math.hypot(focus.x - cp[0], focus.z - cp[1]) < 12) {
        q.index++;
        audio.blip(990, 0.1);
        if (q.index >= q.race.checkpoints.length) {
          state.cash += q.race.prize; state.raceWins++;
          hud.banner('RACE WON', `${q.race.name} — +$${q.race.prize} in ${q.time.toFixed(1)}s`);
          const d = districtAt(focus.x, focus.z);
          standing.add(d.name, 8);
          state.quickRace = null;
          saveGame(snapshot());
        }
      }
    }
    // --- busted check: police touch the player on foot at high wanted ---
    if (!player.inCar && police.wanted >= 3) {
      for (const c of police.cars) {
        if (c.pos.distanceTo(player.pos) < 3) {
          gameOver('BUSTED', 'The Alba PD caught you on foot. Bail is steep — retry the run.');
          break;
        }
      }
    }
    // --- HUD (throttled) ---
    hudTimer -= dt;
    if (hudTimer <= 0) {
      hudTimer = 0.12;
      hud.setCash(state.cash);
      const d = districtAt(focus.x, focus.z);
      hud.setDistrict(d.name, standing.get(d.name));
      hud.setWanted(police.wanted);
      hud.setClock(dayCycle.hour, night);
      hud.setRadio(audio.stationName());
      hud.setHealth(player.health);
      hud.setCrew([state.lead, ...crew.names().filter((n) => n !== state.lead)]);
      const kmh = player.inCar ? Math.abs(player.inCar.speed) * 3.6 : player.speed * 3.6;
      hud.setSpeed(kmh, player.inCar ? player.inCar.name.toUpperCase() : 'ON FOOT');
      const prog = missions.current
        ? `MISSION ${missions.current.id}/10 · $${missions.current.reward}`
        : `MISSIONS ${state.missionsDone}/10 · PACKAGES ${state.packagesFound}/20 · RACES ${state.raceWins}`;
      hud.setProgress(prog);
      const remainingPackages = packageMeshes.filter((p) => !p.found).map((p) => ({ x: p.x, z: p.z }));
      hud.drawMinimap(focus, player.inCar ? player.inCar.heading : player.heading,
        traffic.cars, police.cars, peds.peds, marker || (missions.taxi ? missions.taxi.to : null),
        remainingPackages);
    }
    updateCamera(dt);
  } else if (state.mode === 'title') {
    // Slow cinematic orbit behind the title screen.
    const t = performance.now() / 1000;
    camera.position.set(Math.cos(t * 0.05) * 320, 120, Math.sin(t * 0.05) * 320);
    camera.lookAt(0, 20, 0);
    dayCycle.update(dt, false);
  }
  renderer.render(scene, camera);
}
animate();
