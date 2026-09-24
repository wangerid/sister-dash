// projectiles.js – the four shot types: sparkle stars, bubbles, boomerang, fireballs

const SHOTS = {
  star: { name: 'sparkle stars', max: 3, cooldown: 0.25, color: '#ffe066' },
  bubble: { name: 'bubbles', max: 3, cooldown: 0.4, color: '#8fe3ff' },
  boomerang: { name: 'a boomerang', max: 1, cooldown: 0, color: '#d9a05b' },
  fireball: { name: 'fireballs', max: 2, cooldown: 0.3, color: '#ff8a2a' },
};

class Shot {
  // water: underwater shots move at half speed in a straight line
  constructor(kind, x, y, dir, water) {
    this.kind = kind;
    this.dir = dir;
    this.water = water;
    this.size = kind === 'bubble' ? 22 : kind === 'boomerang' ? 18 : 12;
    this.w = this.size;
    this.h = this.size;
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
    this.traveled = 0;
    this.t = 0;
    this.done = false;
    this.sandSolid = true;
    this.hit = new Set(); // things already hit (the boomerang can pass through several)
    const k = water ? 0.5 : 1;
    if (kind === 'star') { this.vx = dir * 620 * k; this.vy = 0; this.range = 1440; }
    else if (kind === 'bubble') { this.vx = dir * 170 * k; this.vy = water ? -70 : -30; this.range = 900; }
    else if (kind === 'boomerang') { this.vx = dir * 420 * k; this.vy = 0; this.range = 5 * TILE; this.mode = 'out'; }
    else { this.vx = dir * 430 * k; this.vy = water ? 0 : 150; this.range = 960; }
  }

  get pierces() { return this.kind === 'boomerang'; }
  get rect() { return this; }

  update(dt, level, camX, player) {
    this.t += dt;
    const offScreen = this.x + this.w < camX - 40 || this.x > camX + VIEW_W + 40 || this.y > level.height || this.y + this.h < -40;
    if (this.kind === 'boomerang') {
      if (this.mode === 'out') {
        const dx = this.vx * dt;
        const wall = level.moveX(this, dx);
        this.traveled += Math.abs(dx);
        if (wall || this.traveled >= this.range) this.mode = 'back';
      } else {
        // flies back to the thrower, straight through walls
        const tx = player.cx - this.w / 2, ty = player.y + player.h * 0.4 - this.h / 2;
        const ddx = tx - this.x, ddy = ty - this.y;
        const d = Math.max(1, Math.hypot(ddx, ddy));
        const sp = (this.water ? 230 : 460) * dt;
        if (d <= sp || overlaps(this, player)) { this.done = true; return; }
        this.x += (ddx / d) * sp;
        this.y += (ddy / d) * sp;
      }
      return;
    }
    if (this.kind === 'fireball' && !this.water) {
      this.vy = Math.min(this.vy + 1500 * dt, 700);
      const dx = this.vx * dt;
      if (level.moveX(this, dx)) { this.done = true; return; }
      this.traveled += Math.abs(dx);
      const r = level.moveY(this, this.vy * dt);
      if (r.hit) this.vy = this.vy > 0 ? -330 : 0; // small hops along the ground
    } else {
      const dx = this.vx * dt;
      if (level.moveX(this, dx)) { this.done = true; return; }
      this.traveled += Math.abs(dx);
      const wobble = this.kind === 'bubble' ? Math.sin(this.t * 6) * 20 : 0;
      if (level.moveY(this, (this.vy + wobble) * dt).hit) { this.done = true; return; }
    }
    if (this.traveled > this.range || offScreen) this.done = true;
  }

  draw(ctx, t) {
    if (this.kind === 'star') drawStarShot(ctx, this, t);
    else if (this.kind === 'bubble') drawBubbleShot(ctx, this, t);
    else if (this.kind === 'boomerang') drawBoomerang(ctx, this, t);
    else drawFireball(ctx, this, t);
  }
}
