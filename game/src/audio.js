// audio.js — all sound is synthesized with WebAudio: engine hum, sirens, gunshots,
// UI blips, and three procedural radio stations (ALBA FM, NEON 88, SURF 102).
// No audio files are loaded; everything is generated at runtime.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.station = 0;
    this.radioOn = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = null;
    this.beat = 0;
    this.stations = [
      { name: 'ALBA FM', tempo: 112, bass: [55, 0, 65.4, 0, 49, 0, 58.3, 0], lead: [220, 261.6, 329.6, 392] },
      { name: 'NEON 88', tempo: 128, bass: [41.2, 41.2, 49, 55], lead: [440, 523.3, 659.3, 587.3] },
      { name: 'SURF 102', tempo: 96, bass: [65.4, 0, 82.4, 0, 73.4, 0, 98, 0], lead: [329.6, 392, 493.9, 440] },
    ];
  }
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.startRadio();
    } catch (e) { /* audio unavailable: game stays silent */ }
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setEngine(speedKmh, inCar) {
    if (!this.ctx) return;
    this.engineGain.gain.value = inCar ? 0.05 + Math.min(0.09, speedKmh / 1400) : 0;
    this.engineOsc.frequency.value = 55 + speedKmh * 1.6;
  }
  setSiren(wanted) {
    if (!this.ctx) return;
    this.sirenGain.gain.value = wanted > 0 ? 0.035 : 0;
    if (wanted > 0) {
      const t = this.ctx.currentTime;
      this.sirenOsc.frequency.setValueAtTime(660, t);
      this.sirenOsc.frequency.linearRampToValueAtTime(990, t + 0.45);
      this.sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.9);
    }
  }
  blip(freq = 880, dur = 0.09, type = 'square', vol = 0.12) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  gunshot() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 0.14;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.35;
    src.connect(g); g.connect(this.master); src.start();
  }
  crash() { this.blip(70, 0.3, 'sawtooth', 0.3); }
  coin() { this.blip(1320, 0.12, 'sine', 0.15); setTimeout(() => this.blip(1760, 0.15, 'sine', 0.15), 90); }
  startRadio() {
    if (!this.ctx || this.musicTimer) return;
    const tick = () => {
      if (!this.radioOn || !this.ctx) return;
      const st = this.stations[this.station];
      const stepDur = 60 / st.tempo / 2;
      const bassNote = st.bass[this.beat % st.bass.length];
      if (bassNote) this.note(bassNote, stepDur * 1.8, 'triangle', 0.16);
      if (this.beat % 2 === 0) {
        const leadNote = st.lead[Math.floor(this.beat / 2) % st.lead.length];
        this.note(leadNote, stepDur * 1.5, 'square', 0.045);
      }
      if (this.beat % 4 === 0) this.note(1200 + (this.beat % 8) * 60, 0.05, 'sine', 0.05);
      this.beat++;
    };
    this.musicTimer = setInterval(tick, 240);
  }
  note(freq, dur, type, vol) {
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(this.ctx.currentTime + dur);
  }
  nextStation() {
    this.station = (this.station + 1) % this.stations.length;
    this.beat = 0;
    return this.stations[this.station].name;
  }
  stationName() { return this.stations[this.station].name; }
}
