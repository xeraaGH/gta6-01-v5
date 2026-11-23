// player.js — on-foot character, entering/stealing cars, hand-to-hand and shooting.
// The player is a simple articulated figure (torso, head, limbs) animated by code.

import { clampToCity, collides } from './city.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0xff6b35 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), shirt);
    this.torso.position.y = 1.35; this.torso.castShadow = true; this.group.add(this.torso);
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
    this.head.position.y = 2.2; this.head.castShadow = true; this.group.add(this.head);
    this.cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x111111 }));
    this.cap.position.y = 2.5; this.group.add(this.cap);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), shirt);
    this.armL.position.set(-0.62, 1.35, 0); this.group.add(this.armL);
    this.armR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.9, 0.28), shirt);
    this.armR.position.set(0.62, 1.35, 0); this.group.add(this.armR);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), pants);
    this.legL.position.set(-0.24, 0.45, 0); this.group.add(this.legL);
    this.legR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), pants);
    this.legR.position.set(0.24, 0.45, 0); this.group.add(this.legR);
    this.pos = new THREE.Vector3(0, 0, -40);
    this.heading = 0;
    this.speed = 0;
    this.health = 100;
    this.inCar = null;
    this.walkPhase = 0;
    this.punchTimer = 0;
    this.shootCooldown = 0;
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }
  setLead(name) {
    // Mara wears teal; Dante wears orange.
    const col = name === 'Mara' ? 0x14b8a6 : 0xff6b35;
    this.torso.material = new THREE.MeshLambertMaterial({ color: col });
    this.armL.material = this.torso.material;
    this.armR.material = this.torso.material;
  }
  update(dt, input, city) {
    if (this.inCar) return;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    const run = input.shift ? 9 : 5.2;
    let mx = 0, mz = 0;
    if (input.forward) mz += 1;
    if (input.back) mz -= 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      // Camera-relative movement: forward is away from the camera.
      const camYaw = input.camYaw || 0;
      const wx = mx * Math.cos(camYaw) + mz * Math.sin(camYaw);
      const wz = -mx * Math.sin(camYaw) + mz * Math.cos(camYaw);
      const nx = this.pos.x + wx * run * dt;
      const nz = this.pos.z + wz * run * dt;
      const clamped = clampToCity(nx, nz);
      if (!collides(city.colliders, clamped.x, this.pos.z, 1)) this.pos.x = clamped.x;
      if (!collides(city.colliders, this.pos.x, clamped.z, 1)) this.pos.z = clamped.z;
      this.heading = Math.atan2(wx, wz);
      this.walkPhase += dt * run * 1.6;
      this.speed = run;
    } else {
      this.speed = 0;
      this.walkPhase *= 0.8;
    }
    const swing = moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing; this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8; this.armR.rotation.x = swing * 0.8;
    if (this.punchTimer > 0) this.armR.rotation.x = -1.6;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }
  punch() { this.punchTimer = 0.35; }
  canShoot() { return this.shootCooldown <= 0; }
  shoot() { this.shootCooldown = 0.28; }
  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }
  heal(amount) { this.health = Math.min(100, this.health + amount); }
}
