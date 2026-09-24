// enemies.js – enemy types and AI

const ENEMY_GRAVITY = 1800;

class Enemy {
  constructor(tx, ty, w, h) {
    this.w = w;
    this.h = h;
    this.homeX = tx * TILE + (TILE - w) / 2;
    this.homeY = (ty + 1) * TILE - h;
    this.killed = false;
    this.stompable = true;
    this.phase = hash(tx * 3 + ty) * 6;
    this.reset();
  }

  reset() {
    this.x = this.homeX;
    this.y = this.homeY;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.t = 0;
    this.active = false;
    this.onGround = false;
  }

  // Enemies wake up when they come near the right edge of the screen.
  shouldActivate(camX) {
    return this.x < camX + VIEW_W + 64;
  }

  // Hitbox used for touching the player (slightly forgiving).
  get hitbox() {
    return { x: this.x + 2, y: this.y + 3, w: this.w - 4, h: this.h - 3 };
  }

  fall(dt, level) {
    this.vy = Math.min(this.vy + ENEMY_GRAVITY * dt, 900);
    const r = level.moveY(this, this.vy * dt);
    this.onGround = false;
    if (r.hit) {
      if (this.vy > 0) this.onGround = true;
      this.vy = 0;
    }
  }

  update(dt, level, player) {
    this.t += dt;
  }
}

// Walks back and forth, turning at walls and ledges.
class Hedgehog extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 26, 22);
  }

  update(dt, level, player) {
    this.t += dt;
    this.fall(dt, level);
    if (level.moveX(this, this.dir * 45 * dt)) this.dir = -this.dir;
    if (this.onGround) {
      const frontX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      const belowY = this.y + this.h + 2;
      if (!level.isSolid(Math.floor(frontX / TILE), Math.floor(belowY / TILE))) this.dir = -this.dir;
    }
  }

  draw(ctx, t) { drawHedgehog(ctx, this, t); }
}

// Hops in place, or toward the player when she is near (never into a pit).
class Frog extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 26, 22);
  }

  reset() {
    super.reset();
    this.timer = 1 + hash(this.homeX) * 0.8;
  }

  update(dt, level, player) {
    this.t += dt;
    const wasAir = !this.onGround;
    this.fall(dt, level);
    if (this.onGround) {
      if (wasAir) this.vx = 0;
      const dx = player.x + player.w / 2 - (this.x + this.w / 2);
      if (Math.abs(dx) < 300) this.dir = Math.sign(dx) || this.dir;
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 1.2 + Math.random() * 0.7;
        let hopDir = 0;
        if (Math.abs(dx) < 260) {
          const landX = this.x + this.w / 2 + this.dir * 56;
          const footTy = Math.floor((this.y + this.h + 2) / TILE);
          let safe = false;
          for (let k = 0; k < 3; k++) if (level.isSolid(Math.floor(landX / TILE), footTy + k)) safe = true;
          if (safe) hopDir = this.dir;
        }
        this.vx = hopDir * 95;
        this.vy = hopDir ? -470 : -400;
        this.onGround = false;
      }
    } else if (level.moveX(this, this.vx * dt)) {
      this.vx = 0;
    }
  }

  draw(ctx, t) { drawFrog(ctx, this, t); }
}

// Flies back and forth in a wave pattern, ignoring tiles.
class Crow extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 20);
    this.homeY = ty * TILE + (TILE - this.h) / 2;
    this.range = 5 * TILE;
    this.reset();
  }

  update(dt, level, player) {
    this.t += dt;
    this.x += this.dir * 75 * dt;
    if (this.x < this.homeX - this.range) { this.x = this.homeX - this.range; this.dir = 1; }
    if (this.x > this.homeX + this.range * 0.4) { this.x = this.homeX + this.range * 0.4; this.dir = -1; }
    this.y = this.homeY + Math.sin(this.t * 2.6 + this.phase) * 30;
  }

  draw(ctx, t) { drawCrow(ctx, this, t); }
}

// Stationary; cannot be stomped. Drawn as a cactus in the desert.
class SpikyPlant extends Enemy {
  constructor(tx, ty, cactus) {
    super(tx, ty, 26, 32);
    this.stompable = false;
    this.cactus = cactus;
  }

  get hitbox() {
    return { x: this.x + 4, y: this.y + 6, w: this.w - 8, h: this.h - 6 };
  }

  draw(ctx, t) {
    if (this.cactus) drawCactus(ctx, this, t);
    else drawSpikyPlant(ctx, this, t);
  }
}

// Walks fast; crouches briefly, then dashes at the player when she is on the same row.
class Scorpion extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 18);
  }

  reset() {
    super.reset();
    this.mode = 'walk';
    this.modeT = 0;
    this.cooldown = 0.5;
  }

  edgeAhead(level) {
    const frontX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
    return !level.isSolid(Math.floor(frontX / TILE), Math.floor((this.y + this.h + 2) / TILE));
  }

  update(dt, level, player) {
    this.t += dt;
    this.fall(dt, level);
    this.cooldown -= dt;
    const dx = player.cx - (this.x + this.w / 2);
    if (this.mode === 'walk') {
      if (level.moveX(this, this.dir * 85 * dt)) this.dir = -this.dir;
      if (this.onGround && this.edgeAhead(level)) this.dir = -this.dir;
      const sameRow = Math.abs(player.bottom - (this.y + this.h)) < 14;
      if (this.onGround && this.cooldown <= 0 && sameRow && Math.abs(dx) < 260 && player.state === 'play') {
        this.dir = Math.sign(dx) || this.dir;
        this.mode = 'crouch';
        this.modeT = 0.35;
      }
    } else if (this.mode === 'crouch') {
      this.modeT -= dt;
      if (this.modeT <= 0) { this.mode = 'dash'; this.modeT = 0.9; }
    } else {
      this.modeT -= dt;
      const hitWall = level.moveX(this, this.dir * 240 * dt);
      if (hitWall || this.modeT <= 0 || (this.onGround && this.edgeAhead(level))) {
        this.mode = 'walk';
        this.cooldown = 1.5;
      }
    }
  }

  draw(ctx, t) { drawScorpion(ctx, this, t); }
}

// Circles high up; marks the player's spot with a shadow for 1 s, then dives at it.
class Vulture extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 34, 22);
    this.homeY = ty * TILE + (TILE - this.h) / 2;
    this.reset();
  }

  reset() {
    super.reset();
    this.mode = 'circle';
    this.angle = this.phase;
    this.cx0 = this.homeX;
    this.cooldown = 1;
    this.target = null;
  }

  update(dt, level, player) {
    this.t += dt;
    if (this.mode === 'circle' || this.mode === 'warn') {
      this.angle += dt * (this.mode === 'warn' ? 1 : 1.8);
      this.x = this.cx0 + Math.cos(this.angle) * 70;
      this.y = this.homeY + Math.sin(this.angle) * 20;
      this.dir = -Math.sin(this.angle) >= 0 ? 1 : -1;
      this.cooldown -= dt;
      if (this.mode === 'circle' && this.cooldown <= 0 && player.state === 'play' && Math.abs(player.cx - (this.x + this.w / 2)) < 320) {
        let gy = player.bottom;
        const tx = Math.floor(player.cx / TILE);
        for (let ty = Math.floor((player.bottom - 1) / TILE); ty < level.rows; ty++) {
          if (level.isSolid(tx, ty, true)) { gy = ty * TILE; break; }
        }
        this.target = { x: player.cx, y: gy };
        this.mode = 'warn';
        this.modeT = 1;
      } else if (this.mode === 'warn') {
        this.modeT -= dt;
        if (this.modeT <= 0) {
          this.mode = 'dive';
          const ddx = this.target.x - (this.x + this.w / 2), ddy = this.target.y - this.h - this.y;
          const d = Math.max(1, Math.hypot(ddx, ddy));
          this.vx = (ddx / d) * 520;
          this.vy = (ddy / d) * 520;
          this.dir = Math.sign(ddx) || this.dir;
        }
      }
    } else if (this.mode === 'dive') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y + this.h >= this.target.y - 2) {
        this.mode = 'rise';
        this.vx = Math.sign(this.vx || 1) * 140;
        this.vy = -300;
      }
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y <= this.homeY) {
        this.mode = 'circle';
        this.cx0 = this.x - Math.cos(this.angle) * 70;
        this.cooldown = 2.2;
        this.target = null;
      }
    }
  }

  draw(ctx, t) { drawVulture(ctx, this, t); }
}

// Rolls in from off-screen right with big bounces. Cannot be stomped.
// A dust cloud at the screen edge warns before it appears; it rolls in again after leaving.
class Tumbleweed extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 28, 28);
    this.stompable = false;
    this.sandSolid = true;
    this.warning = false;
  }

  shouldActivate(camX) {
    return this.x > camX + VIEW_W && this.x < camX + VIEW_W + 380;
  }

  get hitbox() {
    return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 };
  }

  update(dt, level, player, camX) {
    this.t += dt;
    this.vx = -230;
    this.vy = Math.min(this.vy + 1400 * dt, 900);
    if (level.moveX(this, this.vx * dt)) this.vy = -520;
    const r = level.moveY(this, this.vy * dt);
    if (r.hit && this.vy > 0) this.vy = -(380 + hash(this.t * 10) * 140);
    else if (r.hit) this.vy = 0;
    this.warning = this.x > camX + VIEW_W - 8;
    if (this.x + this.w < camX - 120 || this.y > level.height) this.reset();
  }

  draw(ctx, t, camX) { drawTumbleweed(ctx, this, t, camX); }
}

function createEnemy(ch, tx, ty, themeName) {
  switch (ch) {
    case 'h': return new Hedgehog(tx, ty);
    case 'f': return new Frog(tx, ty);
    case 'w': return new Crow(tx, ty);
    case 's': return new SpikyPlant(tx, ty, themeName === 'desert');
    case 'z': return new Scorpion(tx, ty);
    case 'v': return new Vulture(tx, ty);
    case 't': return new Tumbleweed(tx, ty);
  }
  return null;
}
