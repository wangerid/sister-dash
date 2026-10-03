// timer.js – elapsed time and the Time challenge countdown

const EXTRA_TIME = 60; // seconds granted each time the countdown runs out
const WARNING_TIME = 10; // last seconds shown in red with a tick sound

class LevelTimer {
  // limit: seconds for Time challenge, or null for no limit
  constructor(limit) {
    this.challenge = limit != null;
    this.elapsed = 0;
    this.remaining = limit;
    this.timeUps = 0;
  }

  get warning() {
    return this.challenge && this.remaining <= WARNING_TIME;
  }

  // Advances the clock. Returns 'timeup', 'tick' or null.
  update(dt) {
    this.elapsed += dt;
    if (!this.challenge) return null;
    const before = this.remaining;
    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.timeUps++;
      this.remaining = EXTRA_TIME;
      return 'timeup';
    }
    if (this.remaining <= WARNING_TIME && Math.ceil(this.remaining) !== Math.ceil(before)) return 'tick';
    return null;
  }
}
