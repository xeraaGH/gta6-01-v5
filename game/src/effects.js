// effects.js — particles (dust, sparks, muzzle flash), the mission marker beacon,
// and the day/night cycle that drives sun, sky colour and street-light glow.

export class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    const geo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
    this.geo = geo;
  }
  burst(pos, color, count = 12, speed = 6) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ color }));
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.8 + 1, (Math.random() - 0.5) * speed),
        life: 0.5 + Math.random() * 0.5,
      });
    }
  }
  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6; p.mesh.rotation.y += dt * 5;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
      }
    }
  }
}

export class MarkerBeacon {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffb020, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
    });
    this.beam = new THREE.Mesh(geo, mat);
    this.beam.visible = false;
    scene.add(this.beam);
    const ringGeo = new THREE.RingGeometry(6, 9, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffb020, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }
  set(x, z) {
    this.beam.visible = true; this.ring.visible = true;
    this.beam.position.set(x, 30, z);
    this.ring.position.set(x, 0.15, z);
  }
  hide() { this.beam.visible = false; this.ring.visible = false; }
  update(dt) {
    if (!this.beam.visible) return;
    const t = performance.now() / 400;
    this.beam.material.opacity = 0.25 + Math.sin(t) * 0.12;
    this.beam.rotation.y += dt;
    const s = 1 + Math.sin(t) * 0.12;
    this.ring.scale.set(s, s, 1);
  }
}

export class DayCycle {
  constructor(scene, sun, hemi, lamps) {
    this.scene = scene; this.sun = sun; this.hemi = hemi; this.lamps = lamps;
    this.hour = 12;
  }
  // hour 0..24; returns true when it is night (for mission 7 and the helicopter shot).
  update(dt, nightForced = false) {
    this.hour = (this.hour + dt * 0.15) % 24;
    const h = this.hour;
    const day = !nightForced && h >= 6.5 && h < 18.5;
    const sunset = !nightForced && h >= 17 && h < 19.5;
    const night = nightForced || !day;
    if (night) {
      this.sun.intensity = 0.25;
      this.sun.color.setHex(0x8fa8ff);
      this.sun.position.set(200, 120, -300);
      this.hemi.intensity = 0.35;
      this.scene.background = new THREE.Color(0x0b1026);
      this.scene.fog = new THREE.Fog(0x0b1026, 120, 700);
    } else if (sunset) {
      this.sun.intensity = 1.1;
      this.sun.color.setHex(0xff8c42);
      this.sun.position.set(-500, 90, 200);
      this.hemi.intensity = 0.55;
      this.scene.background = new THREE.Color(0xff9e5e);
      this.scene.fog = new THREE.Fog(0xff9e5e, 150, 900);
    } else {
      this.sun.intensity = 1.8;
      this.sun.color.setHex(0xfff2d8);
      this.sun.position.set(300, 420, 180);
      this.hemi.intensity = 1.05;
      this.scene.background = new THREE.Color(0x87ceeb);
      this.scene.fog = new THREE.Fog(0x9fc9e8, 200, 1100);
    }
    for (const lamp of this.lamps) lamp.material.color.setHex(night ? 0xfff2b0 : 0x8a8a7a);
    return night;
  }
  setHour(h) { this.hour = h; }
}
