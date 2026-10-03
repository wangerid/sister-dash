// audio.js – short Web Audio beeps and a mute toggle

const Sound = {
  ctx: null,
  muted: false,

  init() {
    this.muted = !!SaveData.data.muted;
  },

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    SaveData.data.muted = this.muted;
    SaveData.save();
    if (!this.muted) this.play('select');
  },

  tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
    const ac = this.ctx;
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  play(name) {
    if (this.muted || !this.ctx) return;
    switch (name) {
      case 'jump': this.tone(330, 0.16, 'square', 0.07, 660); break;
      case 'coin':
        this.tone(988, 0.07, 'square', 0.07);
        this.tone(1319, 0.2, 'square', 0.07, null, 0.07);
        break;
      case 'stomp': this.tone(220, 0.12, 'triangle', 0.2, 90); break;
      case 'bump': this.tone(140, 0.08, 'triangle', 0.2, 90); break;
      case 'break':
        this.tone(200, 0.15, 'sawtooth', 0.09, 60);
        this.tone(120, 0.2, 'triangle', 0.15, 50, 0.03);
        break;
      case 'appear': this.tone(392, 0.25, 'triangle', 0.14, 784); break;
      case 'powerup':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, null, i * 0.07));
        break;
      case 'shrink':
        [784, 587, 440, 330].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, null, i * 0.07));
        break;
      case 'die':
        [494, 440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.16, null, i * 0.12));
        break;
      case 'checkpoint':
        this.tone(660, 0.1, 'square', 0.07);
        this.tone(880, 0.18, 'square', 0.07, null, 0.1);
        break;
      case 'flag':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'square', 0.07, null, i * 0.12));
        break;
      case 'oneup':
        [660, 784, 1319, 1047, 1175, 1568].forEach((f, i) => this.tone(f, 0.09, 'square', 0.06, null, i * 0.08));
        break;
      case 'fire': this.tone(880, 0.1, 'sawtooth', 0.05, 220); break;
      case 'tick': this.tone(1200, 0.04, 'square', 0.05); break;
      case 'timeup':
        [880, 660, 880, 660].forEach((f, i) => this.tone(f, 0.12, 'square', 0.07, null, i * 0.13));
        break;
      case 'roar':
        this.tone(160, 0.6, 'sawtooth', 0.12, 70);
        this.tone(110, 0.6, 'square', 0.06, 60, 0.05);
        break;
      case 'crash': this.tone(90, 0.3, 'triangle', 0.25, 40); break;
      case 'stamp':
        [0, 0.25, 0.5, 0.75].forEach((d) => this.tone(120, 0.08, 'triangle', 0.18, 80, d));
        break;
      case 'crumble': this.tone(300, 0.12, 'sawtooth', 0.05, 120); break;
      case 'swim': this.tone(260, 0.09, 'sine', 0.08, 420); break;
      case 'airwarn':
        [880, 660, 880].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, null, i * 0.14));
        break;
      case 'spring': this.tone(300, 0.25, 'sine', 0.12, 900); break;
      case 'rumble': this.tone(70, 0.6, 'sawtooth', 0.08, 50); break;
      case 'zap':
        this.tone(1500, 0.08, 'sawtooth', 0.06, 300);
        this.tone(90, 0.3, 'square', 0.1, 50, 0.05);
        break;
      case 'select': this.tone(660, 0.07, 'square', 0.06); break;
      case 'confirm':
        this.tone(660, 0.07, 'square', 0.06);
        this.tone(990, 0.12, 'square', 0.06, null, 0.07);
        break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, null, i * 0.22));
        break;
    }
  },
};
