// fireballs.js – Fire Girl projectiles

const FIREBALL = {
  speed: 430,
  gravity: 1500,
  hop: 330, // upward speed after touching the ground
  range: 960, // about one screen width
  max: 2,
  cooldown: 0.3,
};

class Fireball {
  constructor(x, y, dir) {
    this.w = 12;
    this.h = 12;
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
    this.vx = dir * FIREBALL.speed;
    this.vy = 150;
    this.traveled = 0;
    this.sandSolid = true;
    this.done = false;
  }

  update(dt, level, camX) {
    this.vy = Math.min(this.vy + FIREBALL.gravity * dt, 700);
    const dx = this.vx * dt;
    if (level.moveX(this, dx)) { this.done = true; return; }
    this.traveled += Math.abs(dx);
    const r = level.moveY(this, this.vy * dt);
    if (r.hit) this.vy = this.vy > 0 ? -FIREBALL.hop : 0;
    const offScreen = this.x + this.w < camX || this.x > camX + VIEW_W || this.y > level.height;
    if (this.traveled > FIREBALL.range || offScreen) this.done = true;
  }

  draw(ctx, t) {
    drawFireball(ctx, this, t);
  }
}
