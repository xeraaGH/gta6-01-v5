// city.js — builds Puerto Alba: roads, districts, buildings, beach, palms, props.
// The city is a 1200x1200 grid. Roads run every 120 units; blocks hold procedural
// buildings. Five districts: Marina, Old Town, La Colina, Portside, Neon Strip.
// The south edge is a beach and sea; the north edge is the port.

const CITY = 1200;
const HALF = CITY / 2;
const ROAD = 120;

export const DISTRICTS = [
  { name: 'Marina', x0: -600, z0: -600, x1: 0, z1: 0, color: 0x2e86c1, standing: 0 },
  { name: 'Old Town', x0: 0, z0: -600, x1: 600, z1: 0, color: 0xd4a017, standing: 0 },
  { name: 'La Colina', x0: -600, z0: 0, x1: 0, z1: 600, color: 0x58a05c, standing: 0 },
  { name: 'Portside', x0: 0, z0: 0, x1: 600, z1: 300, color: 0x8a6d3b, standing: 0 },
  { name: 'Neon Strip', x0: 0, z0: 300, x1: 600, z1: 600, color: 0xc13b8a, standing: 0 },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[0];
}

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCity(scene) {
  const rand = mulberry(20261124);
  const colliders = []; // {x0,z0,x1,z1} building footprints for collision
  const roadPoints = []; // road centreline points for traffic routing
  const buildingMeshes = [];

  // --- ground, beach and sea ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 400, CITY + 400),
    new THREE.MeshLambertMaterial({ color: 0x3d3a33 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0; ground.receiveShadow = true;
  scene.add(ground);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 400, 130),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }),
  );
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.05, HALF + 140); beach.receiveShadow = true;
  scene.add(beach);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY + 800, 500),
    new THREE.MeshLambertMaterial({ color: 0x1a6f9e, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.02, HALF + 420);
  scene.add(sea);

  // --- roads: dark strips + centre dashes ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x55555f });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (let c = -HALF; c <= HALF; c += ROAD) {
    for (const [w, l, x, z] of [[16, CITY, c, 0], [CITY, 16, 0, c]]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, z);
      scene.add(r);
    }
    for (let d = -HALF + 30; d < HALF; d += 60) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(2, 14), dashMat);
      dash.rotation.x = -Math.PI / 2; dash.position.set(c, 0.12, d); scene.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(14, 2), dashMat);
      dash2.rotation.x = -Math.PI / 2; dash2.position.set(d, 0.12, c); scene.add(dash2);
    }
  }
  // road centrelines for traffic
  for (let c = -HALF; c <= HALF; c += ROAD) {
    roadPoints.push({ x: c, z: -HALF, dir: 0 });
    roadPoints.push({ x: c, z: HALF, dir: 0 });
    roadPoints.push({ x: -HALF, z: c, dir: 1 });
    roadPoints.push({ x: HALF, z: c, dir: 1 });
  }

  // --- sidewalks: lighter blocks between roads (centres sit BETWEEN road lines) ---
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x8f8a7c });
  for (let gx = -HALF + ROAD / 2; gx < HALF; gx += ROAD) {
    for (let gz = -HALF + ROAD / 2; gz < HALF; gz += ROAD) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(ROAD - 18, ROAD - 18), walkMat);
      s.rotation.x = -Math.PI / 2; s.position.set(gx, 0.06, gz); s.receiveShadow = true;
      scene.add(s);
    }
  }

  // --- buildings: one or two boxes per block, coloured by district ---
  const palette = [0xe8b04b, 0xc96f4a, 0x7fb3d5, 0xf2e6c9, 0x9b8ec4, 0x5dade2, 0xe59866, 0xa9cce3, 0xf5cba7, 0x82b8a0];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4238 });
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
  for (let gx = -HALF + ROAD / 2; gx < HALF; gx += ROAD) {
    for (let gz = -HALF + ROAD / 2; gz < HALF; gz += ROAD) {
      if (gz > 480 && gx > 0) continue; // keep the Neon Strip plaza open
      if (gz === -540) continue; // the north edge is the open port (cranes, docks, lighthouse)
      if (gx === -540 && gz === -540) continue; // lighthouse block stays clear
      const d = districtAt(gx, gz);
      const n = rand() < 0.55 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = 22 + rand() * 26, dep = 22 + rand() * 26;
        const h = d.name === 'Old Town' ? 12 + rand() * 18
          : d.name === 'Portside' ? 14 + rand() * 22
          : d.name === 'Neon Strip' ? 30 + rand() * 55
          : 18 + rand() * 55;
        const ox = gx + (i === 0 ? -18 : 18) + (rand() - 0.5) * 8;
        const oz = gz + (rand() - 0.5) * 16;
        const col = palette[Math.floor(rand() * palette.length)];
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, dep),
          new THREE.MeshLambertMaterial({ color: col }),
        );
        b.position.set(ox, h / 2, oz); b.castShadow = true; b.receiveShadow = true;
        scene.add(b); buildingMeshes.push(b);
        colliders.push({ x0: ox - w / 2 - 1, z0: oz - dep / 2 - 1, x1: ox + w / 2 + 1, z1: oz + dep / 2 + 1 });
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 1.2, dep + 1), roofMat);
        roof.position.set(ox, h + 0.6, oz); scene.add(roof);
        // lit windows on taller buildings
        if (h > 30) {
          const floors = Math.floor(h / 9);
          for (let f = 0; f < floors; f++) {
            for (let k = 0; k < 3; k++) {
              if (rand() < 0.45) continue;
              const win = new THREE.Mesh(new THREE.PlaneGeometry(3, 4), winMat);
              win.position.set(ox - w / 2 + 4 + k * (w / 3), 6 + f * 9, oz + dep / 2 + 0.1);
              scene.add(win);
            }
          }
        }
        if (d.name === 'Neon Strip' && rand() < 0.6) {
          const neon = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 1.6, 0.4), neonMat);
          neon.position.set(ox, h * 0.75, oz + dep / 2 + 0.3); scene.add(neon);
        }
      }
    }
  }

  // --- landmarks: lighthouse at the marina, port cranes, plaza fountain ---
  const light = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 6, 46, 10),
    new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
  );
  light.position.set(-540, 23, -540); light.castShadow = true; scene.add(light);
  const lightTop = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5, 6, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
  );
  lightTop.position.set(-540, 48, -540); scene.add(lightTop);
  colliders.push({ x0: -547, z0: -547, x1: -533, z1: -533 });

  for (const cx of [180, 360, 540]) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(4, 60, 4),
      new THREE.MeshLambertMaterial({ color: 0xd35400 }));
    mast.position.y = 30; crane.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(46, 3, 3),
      new THREE.MeshLambertMaterial({ color: 0xe67e22 }));
    arm.position.set(12, 56, 0); crane.add(arm);
    crane.position.set(cx, 0, -540); scene.add(crane);
    colliders.push({ x0: cx - 3, z0: -543, x1: cx + 3, z1: -537 });
  }

  // --- palm trees along the beach and the Neon Strip ---
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6d3b });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  function palm(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 12, 6), trunkMat);
    trunk.position.y = 6; trunk.castShadow = true; g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.2, 7, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 2.4, 12.5, Math.sin(a) * 2.4);
      leaf.rotation.z = Math.cos(a) * 1.1; leaf.rotation.x = -Math.sin(a) * 1.1;
      g.add(leaf);
    }
    g.position.set(x, 0, z); scene.add(g);
    colliders.push({ x0: x - 1.2, z0: z - 1.2, x1: x + 1.2, z1: z + 1.2 });
  }
  for (let x = -560; x <= 560; x += 70) palm(x, 640);
  for (let x = -560; x <= 560; x += 90) palm(x, 540 + (rand() - 0.5) * 10);
  for (let z = 340; z <= 560; z += 55) palm(300 + (rand() - 0.5) * 8, z);

  // --- street lamps ---
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const lamps = [];
  for (let c = -HALF + ROAD; c < HALF; c += ROAD) {
    for (let d = -HALF + 60; d < HALF; d += 240) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 6), lampMat);
      pole.position.set(c + 9, 4.5, d); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), lampGlow);
      bulb.position.set(c + 9, 9.2, d); scene.add(bulb);
      lamps.push(bulb);
    }
  }

  return { CITY, HALF, ROAD, colliders, roadPoints, buildingMeshes, lamps };
}

export function clampToCity(x, z, margin = 20) {
  return {
    x: Math.max(-HALF - margin, Math.min(HALF + margin, x)),
    z: Math.max(-HALF - margin, Math.min(HALF + 160, z)),
  };
}

export function collides(colliders, x, z, r = 1.5) {
  for (const c of colliders) {
    if (x + r > c.x0 && x - r < c.x1 && z + r > c.z0 && z - r < c.z1) return true;
  }
  return false;
}
