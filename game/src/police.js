// police.js — wanted stars 1-5, police pursuit cars (PIT at 3+), roadblocks at 4+,
// and the police helicopter at 4-5 stars with a searchlight. Heat decays when the
// player breaks line of sight; Mara's lead bonus decays it faster.

import { Car } from './vehicles.js';

export class PoliceManager {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.wanted = 0;
    this.heat = 0; // 0..100, drives the star level
    this.cars = [];
    this.heli = null;
    this.heliActive = false;
    this.roadblocks = [];
    this.spawnTimer = 0;
    this.decayTimer = 0;
    this.sirenTimer = 0;
    this.bustedTimer = 0;
    this.beaconPhase = 0;
  }
  addHeat(amount, reason) {
    this.heat = Math.min(100, this.heat + amount);
    const stars = this.heat <= 0 ? 0 : this.heat < 18 ? 1 : this.heat < 38 ? 2
      : this.heat < 58 ? 3 : this.heat < 80 ? 4 : 5;
    if (stars > this.wanted) this.onStarsUp(stars);
    this.wanted = stars;
    return this.wanted;
  }
  onStarsUp(stars) {
    if (stars >= 4 && !this.heliActive) this.spawnHelicopter();
    if (stars >= 4) this.spawnRoadblock();
  }
  spawnHelicopter() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6),
      new THREE.MeshLambertMaterial({ color: 0x22303e }));
    body.castShadow = true; g.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5),
      new THREE.MeshLambertMaterial({ color: 0x22303e }));
    tail.position.set(0, 0.2, -5); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    rotor.position.y = 1; g.add(rotor);
    this.heliRotor = rotor;
    const spot = new THREE.SpotLight(0xfff2b0, 900, 160, 0.35, 0.5, 1.2);
    spot.position.set(0, -0.8, 1); g.add(spot); g.add(spot.target);
    this.heliSpot = spot;
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.y = -0.9; g.add(beacon);
    g.position.set(0, 60, 0);
    this.scene.add(g);
    this.heli = g; this.heliActive = true;
  }
  spawnRoadblock() {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x1a3a5c });
    for (let i = -1; i <= 1; i++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.8, 4.4), mat);
      car.position.set(i * 5, 0.6, 0); group.add(car);
    }
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf1c40f }));
    barrier.position.y = 0.8; group.add(barrier);
    const roads = [];
    for (let c = -480; c <= 480; c += 120) roads.push(c);
    const road = roads[Math.floor(Math.random() * roads.length)];
    const vertical = Math.random() < 0.5;
    const x = vertical ? road : -480 + Math.random() * 960;
    const z = vertical ? -480 + Math.random() * 960 : road;
    group.position.set(x, 0, z);
    group.rotation.y = vertical ? 0 : Math.PI / 2;
    this.scene.add(group);
    this.roadblocks.push({ group, x, z });
  }
  spawnPoliceCar(playerPos) {
    const angle = Math.random() * Math.PI * 2;
    const x = playerPos.x + Math.cos(angle) * 90;
    const z = playerPos.z + Math.sin(angle) * 90;
    const car = new Car(this.scene, x, z, angle, 0x1a3a5c,
      { police: true, topSpeed: 36 + this.wanted * 1.5, accel: 20 });
    car.name = 'Police Interceptor';
    this.cars.push(car);
    return car;
  }
  update(dt, playerPos, playerInCar, leadName) {
    this.beaconPhase += dt * 8;
    this.sirenTimer -= dt;
    // Spawn pursuit cars up to the wanted level.
    const want = Math.min(this.wanted, 5);
    this.spawnTimer -= dt;
    if (want > 0 && this.cars.length < want + 1 && this.spawnTimer <= 0) {
      this.spawnPoliceCar(playerPos);
      this.spawnTimer = 2.2;
    }
    // Pursuit steering: chase the player, each car aiming at a slightly
    // different offset so the pack spreads out instead of stacking. Ram at 3+.
    for (let ci = 0; ci < this.cars.length; ci++) {
      const car = this.cars[ci];
      const pdx = playerPos.x - car.pos.x, pdz = playerPos.z - car.pos.z;
      const pdist = Math.hypot(pdx, pdz) || 1;
      const off = (ci % 3 - 1) * 9;
      const tx = playerPos.x + (pdz / pdist) * off;
      const tz = playerPos.z - (pdx / pdist) * off;
      const dx = tx - car.pos.x, dz = tz - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.4));
      const pit = this.wanted >= 3 && dist < 7;
      car.drive(pit ? 1 : 0.85, steer, dt);
      if (car.beacon) car.beacon.material.color.setHex(Math.sin(this.beaconPhase) > 0 ? 0xff2222 : 0x2244ff);
      // Ram damage when touching the player (once per second per car).
      if (pdist < 3.4 && this.onRam && (!car.lastRam || performance.now() - car.lastRam > 1200)) {
        car.lastRam = performance.now();
        this.onRam(dt);
      }
    }
    // Helicopter circles overhead and keeps the spotlight on the player.
    if (this.heliActive && this.heli) {
      const t = performance.now() / 1000;
      this.heli.position.set(playerPos.x + Math.cos(t * 0.35) * 45, 55 + Math.sin(t * 0.5) * 5,
        playerPos.z + Math.sin(t * 0.35) * 45);
      this.heli.lookAt(playerPos.x, 0, playerPos.z);
      this.heliRotor.rotation.y += dt * 22;
      this.heliSpot.target.position.set(playerPos.x, 0, playerPos.z);
      this.heliSpot.target.updateMatrixWorld();
      if (this.wanted < 4) { this.scene.remove(this.heli); this.heli = null; this.heliActive = false; }
    }
    // Heat decay: faster on foot hiding, faster for Mara.
    this.decayTimer -= dt;
    if (this.decayTimer <= 0) {
      this.decayTimer = 1;
      const inSight = this.cars.some((c) => c.pos.distanceTo(playerPos) < 60)
        || (this.heliActive && this.wanted >= 4);
      if (!inSight && this.heat > 0) {
        this.heat = Math.max(0, this.heat - (leadName === 'Mara' ? 6 : 3.5));
        this.wanted = this.heat <= 0 ? 0 : this.heat < 18 ? 1 : this.heat < 38 ? 2
          : this.heat < 58 ? 3 : this.heat < 80 ? 4 : 5;
        if (this.wanted < 4 && this.heliActive && this.heli) {
          this.scene.remove(this.heli); this.heli = null; this.heliActive = false;
        }
      }
    }
    // Clear roadblocks once the heat is gone.
    if (this.wanted === 0 && this.roadblocks.length) {
      for (const rb of this.roadblocks) this.scene.remove(rb.group);
      this.roadblocks = [];
    }
  }
  clearAll() {
    for (const car of this.cars) car.dispose(this.scene);
    this.cars = [];
    if (this.heli) { this.scene.remove(this.heli); this.heli = null; this.heliActive = false; }
    for (const rb of this.roadblocks) this.scene.remove(rb.group);
    this.roadblocks = [];
    this.wanted = 0; this.heat = 0;
  }
}
