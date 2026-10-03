// projectiles.js – shared bouncing-shot logic, with a different look per character.
// Every shot is thrown slightly downward and bounces along the ground in small hops.

const SHOT = {
  speed: 430,
  gravity: 1500,
  hop: 330, // upward speed after each bounce: hops about 1 tile high
  range: 960, // about one screen width
  max: 2, // on screen at once
  cooldown: 0.3,
};

// Looks (and what happens to a defeated enemy) per character's shot.
const SHOTS = {
  star: { name: 'sparkle stars', color: '#ffe066', defeat: 'sparkles' },
  bubble: { name: 'bubbles', color: '#8fe3ff', defeat: 'trap' },
  boomerang: { name: 'boomerangs', color: '#d9a05b', defeat: 'spin' },
  fireball: { name: 'fireballs', color: '#ff8a2a', defeat: 'smoke' },
};

class Shot {
  // water: underwater shots move at half speed in slow, floaty hops
  constructor(kind, x, y, dir, water) {
    this.kind = kind;
    this.dir = dir;
    this.water = water;
    this.w = kind === 'bubble' ? 16 : 12;
    this.h = this.w;
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
    this.vx = dir * SHOT.speed * (water ? 0.5 : 1);
    this.vy = water ? 60 : 150;
    this.traveled = 0;
    this.t = 0;
    this.sandSolid = true;
    this.done = false;
    this.trail = [];
  }

  get rect() { return this; }

  update(dt, level, camX) {
    this.t += dt;
    const g = this.water ? 400 : SHOT.gravity;
    const hop = this.water ? 170 : SHOT.hop;
    this.vy = Math.min(this.vy + g * dt, this.water ? 200 : 700);
    const dx = this.vx * dt;
    if (level.moveX(this, dx)) { this.done = true; return; }
    this.traveled += Math.abs(dx);
    const r = level.moveY(this, this.vy * dt);
    if (r.hit) this.vy = this.vy > 0 ? -hop : 0;
    if (Math.floor(this.t * 30) !== Math.floor((this.t - dt) * 30)) {
      this.trail.push({ x: this.x + this.w / 2, y: this.y + this.h / 2 });
      if (this.trail.length > 5) this.trail.shift();
    }
    const offScreen = this.x + this.w < camX - 40 || this.x > camX + VIEW_W + 40 || this.y > level.height;
    if (this.traveled > SHOT.range || offScreen) this.done = true;
  }

  draw(ctx, t) {
    if (this.kind === 'star') drawStarShot(ctx, this, t);
    else if (this.kind === 'bubble') drawBubbleShot(ctx, this, t);
    else if (this.kind === 'boomerang') drawBoomerang(ctx, this, t);
    else drawFireball(ctx, this, t);
  }
}
