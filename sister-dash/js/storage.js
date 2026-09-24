// storage.js – best scores and settings in localStorage (all access wrapped in try/catch)

const SaveData = {
  KEY: 'sisterDash.v1',
  data: { levels: {}, muted: false, extraLife: false, timeChallenge: false },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = Object.assign(this.data, parsed);
          if (!this.data.levels || typeof this.data.levels !== 'object') this.data.levels = {};
        }
      }
    } catch (e) {
      // storage unavailable: play without saving
    }
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {
      // ignore
    }
  },

  getLevel(index) {
    return this.data.levels[index] || { best: 0, completed: false, bestTime: null };
  },

  // Records a completed level. Returns true if the coin score is a new best.
  recordResult(index, coins, time) {
    const rec = Object.assign({}, this.getLevel(index));
    const newBest = !rec.completed || coins > rec.best;
    rec.best = Math.max(rec.best, coins);
    rec.completed = true;
    if (rec.bestTime === null || time < rec.bestTime) rec.bestTime = time;
    this.data.levels[index] = rec;
    this.save();
    return newBest;
  },
};
