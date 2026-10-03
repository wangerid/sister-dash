// storage.js – best scores and settings in localStorage (all access wrapped in try/catch)

const SaveData = {
  KEY: 'sisterDash.v1',
  // levels are keyed by level name, so adding levels never mixes up saved scores
  data: { levels: {}, muted: false, extraLife: false, timeChallenge: false, version: 2 },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = Object.assign(this.data, parsed);
          if (!this.data.levels || typeof this.data.levels !== 'object') this.data.levels = {};
          this.migrate(parsed);
        }
      }
    } catch (e) {
      // storage unavailable: play without saving
    }
  },

  // Version 1 stored levels by index (0-2 as today, 3 was the desert before the reef was added).
  migrate(parsed) {
    if (parsed.version >= 2) return;
    const oldNames = ['Sunny Meadow', 'Whispering Forest', 'Snowy Mountain', 'Scorching Desert'];
    const levels = {};
    for (const [k, v] of Object.entries(this.data.levels)) {
      const name = /^\d+$/.test(k) ? oldNames[+k] : k;
      if (name) levels[name] = v;
    }
    this.data.levels = levels;
    this.data.version = 2;
    this.save();
  },

  key(index) {
    return LEVELS[index].name;
  },

  save() {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {
      // ignore
    }
  },

  getLevel(index) {
    return this.data.levels[this.key(index)] || { best: 0, completed: false, bestTime: null };
  },

  // Records a completed level. Returns true if the coin score is a new best.
  recordResult(index, coins, time) {
    const rec = Object.assign({}, this.getLevel(index));
    const newBest = !rec.completed || coins > rec.best;
    rec.best = Math.max(rec.best, coins);
    rec.completed = true;
    if (rec.bestTime === null || time < rec.bestTime) rec.bestTime = time;
    this.data.levels[this.key(index)] = rec;
    this.save();
    return newBest;
  },
};
