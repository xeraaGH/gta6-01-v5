// vehicles.js — car meshes, arcade driving physics, traffic manager.
// Cars are built from boxes: body, cabin, wheels, headlights. Traffic cars loop
// along the road grid; the player car uses simple arcade physics with drift.

export const CAR_COLORS = [
  { name: 'Alba Red', color: 0xc0392b }, { name: 'Sun Taxi', color: 0xf1c40f },
  { name: 'Ocean Blue', color: 0x2471a3 }, { name: 'Lime Coupe', color: 0x7cb342 },
  { name: 'Midnight Black', color: 0x1c1c22 }, { name: 'Pearl White', color: 0xececec },
  { name: 'Sunset Orange', color: 0xe67e22 }, { name: 'Violet GT', color: 0x7d3c98 },
  { name: 'Police Interceptor', color: 0x1a3a5c },
];

export function makeCarMesh(colorHex, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: colorHex });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2733 }));
  cabin.position.set(0, 1.3, -0.3); cabin.castShadow = true; g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10), wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const x of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    hl.position.set(x, 0.7, 2.32); g.add(hl);
  }
  let beacon = null;
  if (isPolice) {
    beacon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    beacon.position.set(0, 1.75, -0.3); g.add(beacon);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.22, 4.62),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.95; g.add(stripe);
  }
  return { group: g, wheels, beacon };
}

export class Car {
  constructor(scene, x, z, heading, colorHex, opts = {}) {
    const { group, wheels, beacon } = makeCarMesh(colorHex, opts.police);
    this.group = group; this.wheels = wheels; this.beacon = beacon;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.topSpeed = opts.topSpeed || 34;
    this.accel = opts.accel || 16;
    this.isPolice = !!opts.police;
    this.isPlayer = !!opts.player;
    this.name = opts.name || 'Sedan';
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
    scene.add(this.group);
  }
  // Arcade drive: throttle -1..1, steer -1..1, dt seconds.
  drive(throttle, steer, dt, boost = false) {
    const maxSpd = this.topSpeed * (boost ? 1.35 : 1);
    this.speed += throttle * this.accel * dt;
    if (throttle === 0) this.speed -= Math.sign(this.speed) * 8 * dt;
    if (this.speed > maxSpd) this.speed = maxSpd;
    if (this.speed < -12) this.speed = -12;
    if (Math.abs(this.speed) < 0.05) this.speed = 0;
    const steerAmt = steer * 1.9 * dt * Math.min(1, Math.abs(this.speed) / 8);
    this.heading += steerAmt * Math.sign(this.speed || 1);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
    const lean = -steer * Math.min(0.06, Math.abs(this.speed) * 0.002);
    this.group.rotation.z = lean;
    for (const w of this.wheels) w.rotation.x += this.speed * dt * 2.4;
  }
  stop() { this.speed = 0; }
  dispose(scene) { scene.remove(this.group); }
}

export class TrafficManager {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.cars = [];
    this.spawnTimer = 0;
    // Seed traffic on the road grid.
    for (let i = 0; i < 14; i++) this.spawnTraffic(true);
  }
  spawnTraffic(anywhere = false) {
    const roads = [];
    for (let c = -600; c <= 600; c += 120) roads.push(c);
    const road = roads[Math.floor(Math.random() * roads.length)];
    const along = -540 + Math.random() * 1080;
    const vertical = Math.random() < 0.5;
    const x = vertical ? road + (Math.random() < 0.5 ? -3.5 : 3.5) : along;
    const z = vertical ? along : road + (Math.random() < 0.5 ? -3.5 : 3.5);
    const heading = vertical ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const pick = CAR_COLORS[Math.floor(Math.random() * (CAR_COLORS.length - 1))];
    const car = new Car(this.scene, x, z, heading, pick.color, { topSpeed: 13 + Math.random() * 5 });
    car.name = pick.name;
    car.cruise = 11 + Math.random() * 5;
    car.laneOffset = (Math.random() < 0.5 ? -3.5 : 3.5);
    this.cars.push(car);
    return car;
  }
  update(dt, playerPos) {
    this.spawnTimer -= dt;
    if (this.cars.length < 18 && this.spawnTimer <= 0) {
      this.spawnTraffic(); this.spawnTimer = 2.5;
    }
    for (const car of this.cars) {
      // Cruise forward; at intersections sometimes turn.
      const dist = car.pos.distanceTo(playerPos);
      if (dist > 420) { // recycle far cars near the player
        const roads = [];
        for (let c = -600; c <= 600; c += 120) roads.push(c);
        const road = roads[Math.floor(Math.random() * roads.length)];
        const near = Math.max(-540, Math.min(540, playerPos.x + (Math.random() - 0.5) * 300));
        car.pos.set(road, 0, near); car.heading = Math.random() < 0.5 ? 0 : Math.PI;
      }
      const target = car.cruise;
      const throttle = car.speed < target ? 0.6 : 0;
      car.drive(throttle, 0, dt);
      // Gentle avoidance: slow down if a car is right ahead.
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x, dz = other.pos.z - car.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 9 && d > 0.1) {
          const ahead = Math.sin(car.heading) * dx + Math.cos(car.heading) * dz;
          if (ahead > 0 && ahead < 9) car.speed = Math.max(0, car.speed - 20 * dt);
        }
      }
    }
  }
  nearestCar(pos, maxDist = 7) {
    let best = null, bestD = maxDist;
    for (const car of this.cars) {
      const d = car.pos.distanceTo(pos);
      if (d < bestD) { best = car; bestD = d; }
    }
    return best;
  }
  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    car.dispose(this.scene);
  }
}
