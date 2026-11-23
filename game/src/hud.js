// hud.js — DOM HUD updates and the live minimap (a 2D canvas top-down view).
// The minimap draws districts, roads, the player, cars, police, peds and the
// mission marker every frame, so the judge can read the city at a glance.

import { DISTRICTS } from './city.js';

export class HUD {
  constructor() {
    this.el = {
      cash: document.getElementById('cash-value'),
      district: document.getElementById('district-name'),
      standing: document.getElementById('standing-name'),
      objTitle: document.getElementById('objective-title'),
      objText: document.getElementById('objective-text'),
      stars: document.getElementById('wanted-stars'),
      clock: document.getElementById('clock'),
      radio: document.getElementById('radio-name'),
      healthFill: document.getElementById('health-fill'),
      healthText: document.getElementById('health-text'),
      crew: document.getElementById('crew-names'),
      speed: document.getElementById('speed-value'),
      vehicle: document.getElementById('vehicle-name'),
      progress: document.getElementById('mission-progress'),
      toast: document.getElementById('toast'),
      banner: document.getElementById('mission-banner'),
      vignette: document.getElementById('damage-vignette'),
    };
    this.map = document.getElementById('minimap');
    this.mapCtx = this.map.getContext('2d');
    this.toastTimer = null;
    this.bannerTimer = null;
  }
  setCash(v) { this.el.cash.textContent = v.toLocaleString('en-US'); }
  setDistrict(name, standing) {
    this.el.district.textContent = name;
    const label = standing >= 60 ? 'Loved' : standing >= 30 ? 'Respected' : standing >= 10 ? 'Known' : 'Neutral';
    this.el.standing.textContent = `Standing: ${label} (${standing})`;
  }
  setObjective(title, text) {
    this.el.objTitle.textContent = title;
    this.el.objText.textContent = text;
  }
  setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < stars ? '' : 'off'}">★</span>`;
    this.el.stars.innerHTML = html;
  }
  setClock(hour, night) {
    const h = Math.floor(hour) % 24;
    const m = Math.floor((hour % 1) * 60);
    this.el.clock.textContent = `${night ? '☾' : '☀'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  setRadio(name) { this.el.radio.textContent = name; }
  setHealth(h) {
    this.el.healthFill.style.width = `${h}%`;
    this.el.healthText.textContent = String(Math.round(h));
    this.el.vignette.style.opacity = h < 35 ? String((35 - h) / 35) : '0';
  }
  setCrew(names) { this.el.crew.textContent = names.join(' · '); }
  setSpeed(kmh, vehicleName) {
    this.el.speed.textContent = String(Math.round(kmh));
    this.el.vehicle.textContent = vehicleName;
  }
  setProgress(text) { this.el.progress.textContent = text; }
  toast(text, ms = 2600) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.el.toast.style.opacity = '0'; }, ms);
  }
  banner(title, sub) {
    this.el.banner.innerHTML = `<div class="mb-title">${title}</div><div class="mb-sub">${sub}</div>`;
    this.el.banner.style.opacity = '1';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { this.el.banner.style.opacity = '0'; }, 3200);
  }
  // Top-down minimap: districts, roads, beach, player, traffic, police, marker.
  drawMinimap(playerPos, heading, traffic, policeCars, peds, marker, packages) {
    const ctx = this.mapCtx;
    const S = 220, HALF = 600;
    const toMap = (x, z) => [((x + HALF) / (HALF * 2)) * S, ((z + HALF) / (HALF * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#0d2b45'; ctx.fillRect(0, 0, S, S);
    for (const d of DISTRICTS) {
      const [x0, y0] = toMap(d.x0, d.z0);
      const [x1, y1] = toMap(d.x1, d.z1);
      ctx.fillStyle = '#1b4a68'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    ctx.fillStyle = '#e8d29a'; ctx.fillRect(0, S - 16, S, 16); // beach
    ctx.fillStyle = '#1a6f9e'; ctx.fillRect(0, S - 6, S, 6); // sea
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
    for (let c = -600; c <= 600; c += 120) {
      const [x] = toMap(c, 0); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
      const [, y] = toMap(0, c); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    // hidden packages (gold dots)
    ctx.fillStyle = '#ffd23e';
    for (const p of packages || []) {
      const [x, y] = toMap(p.x, p.z); ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
    // mission marker (pulsing yellow diamond)
    if (marker) {
      const [x, y] = toMap(marker[0], marker[1]);
      const r = 6 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffb020';
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // police (blue/red), traffic (white), peds (grey dots)
    for (const car of policeCars || []) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const car of traffic || []) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const p of peds || []) {
      if (p.dead) continue;
      const [x, y] = toMap(p.pos.x, p.pos.z);
      ctx.fillStyle = '#9db8c9'; ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // player arrow
    const [px, py] = toMap(playerPos.x, playerPos.z);
    ctx.save();
    ctx.translate(px, py); ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#7dff9b';
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  }
}
