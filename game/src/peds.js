// peds.js — pedestrians who stroll the sidewalks, flee from gunfire and cars,
// and react when the player bumps into them (small wanted heat).

import { clampToCity } from './city.js';

export class PedManager {
  constructor(scene, city) {
    this.scene = scene; this.city = city;
    this.peds = [];
    this.spawnTimer = 0;
    const colors = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8];
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: colors[i % colors.length] });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45), shirt);
      body.position.y = 1.35; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xc98d64 }));
      head.position.y = 2.15; g.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.85, 0.3),
        new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      legL.position.set(-0.2, 0.42, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.2; g.add(legR);
      const x = -540 + Math.random() * 1080;
      const z = -540 + Math.random() * 1080;
      g.position.set(x, 0, z);
      scene.add(g);
      this.peds.push({
        group: g, legL, legR, pos: new THREE.Vector3(x, 0, z),
        heading: Math.random() * Math.PI * 2, speed: 1.2 + Math.random() * 1.4,
        phase: Math.random() * 6, fleeing: 0, dead: false, color: colors[i % colors.length],
      });
    }
  }
  update(dt, playerPos, threatPos, threatActive) {
    for (const p of this.peds) {
      if (p.dead) continue;
      // Flee from gunfire / fast cars.
      if (threatActive && threatPos) {
        const d = Math.hypot(p.pos.x - threatPos.x, p.pos.z - threatPos.z);
        if (d < 40) { p.fleeing = 2.5; p.heading = Math.atan2(p.pos.x - threatPos.x, p.pos.z - threatPos.z); }
      }
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        p.pos.x += Math.sin(p.heading) * 5 * dt;
        p.pos.z += Math.cos(p.heading) * 5 * dt;
      } else {
        p.pos.x += Math.sin(p.heading) * p.speed * dt;
        p.pos.z += Math.cos(p.heading) * p.speed * dt;
        if (Math.random() < dt * 0.08) p.heading += (Math.random() - 0.5) * 1.6;
        // Keep peds on sidewalks: snap back inside the city and away from roads.
        if (Math.abs(p.pos.x) > 590 || Math.abs(p.pos.z) > 590) p.heading += Math.PI;
      }
      const c = clampToCity(p.pos.x, p.pos.z);
      p.pos.x = c.x; p.pos.z = c.z;
      p.phase += dt * p.speed * 4;
      const swing = Math.sin(p.phase) * 0.4;
      p.legL.rotation.x = swing; p.legR.rotation.x = -swing;
      p.group.position.copy(p.pos);
      p.group.rotation.y = p.heading;
    }
  }
  // A car hitting a ped at speed: the ped falls, the player gains heat.
  checkCarHits(cars) {
    let hits = 0;
    for (const p of this.peds) {
      if (p.dead) continue;
      for (const car of cars) {
        if (Math.abs(car.speed) < 6) continue;
        const d = Math.hypot(p.pos.x - car.pos.x, p.pos.z - car.pos.z);
        if (d < 2.6) {
          p.dead = true;
          p.group.rotation.x = -Math.PI / 2;
          p.group.position.y = 0.5;
          hits++;
          break;
        }
      }
    }
    return hits;
  }
  nearest(pos, maxDist = 30) {
    let best = null, bestD = maxDist;
    for (const p of this.peds) {
      if (p.dead) continue;
      const d = p.pos.distanceTo(pos);
      if (d < bestD) { best = p; bestD = d; }
    }
    return best;
  }
}
