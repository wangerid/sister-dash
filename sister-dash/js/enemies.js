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
      if (!level.isFloor(Math.floor(frontX / TILE), Math.floor(belowY / TILE))) this.dir = -this.dir;
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
          for (let k = 0; k < 3; k++) if (level.isFloor(Math.floor(landX / TILE), footTy + k)) safe = true;
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
    return !level.isFloor(Math.floor(frontX / TILE), Math.floor((this.y + this.h + 2) / TILE));
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

// ---------------------------------------------------------------- sea creatures (Coral Reef)

// Walks sideways along the sea floor, snapping its claws. Stomp it from above.
class Crab extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 20);
  }

  update(dt, level, player) {
    this.t += dt;
    this.fall(dt, level);
    if (level.moveX(this, this.dir * 50 * dt)) this.dir = -this.dir;
    if (this.onGround) {
      const frontX = this.dir > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!level.isFloor(Math.floor(frontX / TILE), Math.floor((this.y + this.h + 2) / TILE))) this.dir = -this.dir;
    }
  }

  draw(ctx, t) { drawCrab(ctx, this, t); }
}

// Bobs slowly up and down. Its top stings, so it can't be stomped.
class Jellyfish extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 26, 30);
    this.stompable = false;
  }

  update(dt) {
    this.t += dt;
    this.y = this.homeY + Math.sin(this.t * 1.4 + this.phase) * 44;
  }

  draw(ctx, t) { drawJellyfish(ctx, this, t); }
}

// Swims slowly; puffs up into a spiky ball for 2 s when the player comes close.
class Pufferfish extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 26, 22);
    this.homeY = ty * TILE + (TILE - this.h) / 2;
    this.reset();
  }

  reset() {
    super.reset();
    this.puffT = 0;
    this.cooldown = 0;
  }

  get puffed() { return this.puffT > 0; }
  get stompable() { return !this.puffed; }
  set stompable(v) {}

  get hitbox() {
    if (!this.puffed) return { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 };
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    return { x: cx - 20, y: cy - 20, w: 40, h: 40 };
  }

  update(dt, level, player) {
    this.t += dt;
    if (this.puffT > 0) {
      this.puffT -= dt;
      if (this.puffT <= 0) this.cooldown = 1.5;
    } else {
      this.cooldown -= dt;
      this.x += this.dir * 40 * dt;
      if (this.x < this.homeX - 3 * TILE) this.dir = 1;
      if (this.x > this.homeX + 3 * TILE) this.dir = -1;
      const d = Math.hypot(player.cx - (this.x + this.w / 2), player.y + player.h / 2 - (this.y + this.h / 2));
      if (this.cooldown <= 0 && d < 90 && player.state === 'play') { this.puffT = 2; Sound.play('appear'); }
    }
    this.y = this.homeY + Math.sin(this.t * 2 + this.phase) * 6;
  }

  draw(ctx, t) { drawPufferfish(ctx, this, t); }
}

// Hides in a hole in the rock and darts out when the player passes.
// Bubbles at the hole warn 1 s before. Can only be hit (or shot) while it's out.
class Eel extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 18);
    this.stompable = false;
    this.holeTx = tx;
    this.holeTy = ty;
  }

  reset() {
    super.reset();
    this.mode = 'hidden';
    this.len = 0;
    this.modeT = 0;
    this.cooldown = 0;
    this.dirSet = false;
  }

  get hitbox() {
    if (this.len < 10) return null;
    const y = this.holeTy * TILE + 8;
    const x0 = this.dir > 0 ? this.holeTx * TILE : (this.holeTx + 1) * TILE - this.len;
    return { x: x0, y, w: this.len, h: 16 };
  }

  update(dt, level, player) {
    this.t += dt;
    if (!this.dirSet) {
      // it darts out toward the open water
      this.dir = level.isSolid(this.holeTx - 1, this.holeTy) ? 1 : -1;
      this.dirSet = true;
    }
    const hx = (this.holeTx + 0.5) * TILE, hy = (this.holeTy + 0.5) * TILE;
    const ahead = (player.cx - hx) * this.dir;
    if (this.mode === 'hidden') {
      this.cooldown -= dt;
      if (this.cooldown <= 0 && ahead > 0 && ahead < 5 * TILE && Math.abs(player.y + player.h / 2 - hy) < 60 && player.state === 'play') {
        this.mode = 'warn';
        this.modeT = 1;
      }
    } else if (this.mode === 'warn') {
      this.modeT -= dt;
      if (this.modeT <= 0) { this.mode = 'out'; this.modeT = 0.6; }
    } else if (this.mode === 'out') {
      this.len = Math.min(3 * TILE, this.len + 600 * dt);
      if (this.len >= 3 * TILE) { this.modeT -= dt; if (this.modeT <= 0) this.mode = 'in'; }
    } else {
      this.len -= 300 * dt;
      if (this.len <= 0) { this.len = 0; this.mode = 'hidden'; this.cooldown = 1.5; }
    }
  }

  draw(ctx, t) { drawEel(ctx, this, t); }
}

// ---------------------------------------------------------------- Crystal Caves

// Pops up out of its hole for 2 s (the dirt shakes 0.5 s before), then hides again.
class Mole extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 28, 24);
  }

  reset() {
    super.reset();
    this.mode = 'hidden';
    this.modeT = 0;
    this.cooldown = 0.5;
    this.rise = 0;
  }

  get hitbox() {
    if (this.rise < 0.5) return null;
    const h = this.h * this.rise;
    return { x: this.x + 3, y: this.y + this.h - h, w: this.w - 6, h };
  }

  update(dt, level, player) {
    this.t += dt;
    if (this.mode === 'hidden') {
      this.cooldown -= dt;
      this.rise = Math.max(0, this.rise - dt * 6);
      if (this.cooldown <= 0 && Math.abs(player.cx - (this.x + this.w / 2)) < 6 * TILE) { this.mode = 'shake'; this.modeT = 0.5; }
    } else if (this.mode === 'shake') {
      this.modeT -= dt;
      if (this.modeT <= 0) { this.mode = 'up'; this.modeT = 2; }
    } else {
      this.rise = Math.min(1, this.rise + dt * 6);
      this.modeT -= dt;
      if (this.modeT <= 0) { this.mode = 'hidden'; this.cooldown = 1.5; }
    }
  }

  draw(ctx, t) { drawMole(ctx, this, t); }
}

// Hangs from the ceiling and swoops down in an arc when the player walks underneath.
class CaveBat extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 26, 18);
    this.homeY = ty * TILE + 2;
    this.reset();
  }

  reset() {
    super.reset();
    this.mode = 'hang';
    this.cooldown = 0;
    this.hx = this.homeX;
    this.hy = this.homeY;
  }

  update(dt, level, player) {
    this.t += dt;
    if (this.mode === 'hang') {
      this.cooldown -= dt;
      const dx = player.cx - (this.x + this.w / 2);
      if (this.cooldown <= 0 && Math.abs(dx) < 3 * TILE && player.y > this.y && player.state === 'play') {
        this.mode = 'swoop';
        this.k = 0;
        this.dir = Math.sign(dx) || 1;
        this.depth = Math.min(160, Math.max(40, player.y + player.h / 2 - this.hy));
        Sound.play('appear');
      }
    } else {
      // an arc down past the player and up again on the other side
      this.k += dt / 1.3;
      const k = Math.min(1, this.k);
      this.x = this.hx + this.dir * k * 6 * TILE;
      this.y = this.hy + Math.sin(Math.PI * k) * this.depth;
      if (k >= 1) { this.mode = 'hang'; this.hx = this.x; this.cooldown = 2; }
    }
  }

  draw(ctx, t) { drawBat(ctx, this, t); }
}

// Rolls in from the right along the tunnel floor (a rumble warns first). Can't be stomped.
class RollingRock extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 30);
    this.stompable = false;
  }

  shouldActivate(camX) {
    return this.x < camX + VIEW_W + 300;
  }

  update(dt, level, player, camX) {
    if (this.t === 0) Sound.play('rumble');
    this.t += dt;
    this.vx = -190;
    this.fall(dt, level);
    if (this.onGround && this.vy === 0 && Math.random() < 0.02) this.vy = -180;
    if (level.moveX(this, this.vx * dt)) this.vy = -350; // bumps up and over small steps
    this.warning = this.x > camX + VIEW_W - 8;
    if (this.x + this.w < camX - 150) this.killed = true;
  }

  draw(ctx, t, camX) { drawRollingRock(ctx, this, t, camX); }
}

// A loose stalactite: shakes for 0.7 s when the player walks underneath, then drops.
class Stalactite extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 16, 28);
    this.homeY = ty * TILE;
    this.stompable = false;
    this.reset();
  }

  reset() {
    super.reset();
    this.mode = 'hang';
    this.modeT = 0;
  }

  get hitbox() {
    return this.mode === 'fall' ? { x: this.x + 3, y: this.y + 4, w: this.w - 6, h: this.h - 4 } : null;
  }

  update(dt, level, player, camX, scene) {
    this.t += dt;
    if (this.mode === 'hang') {
      if (Math.abs(player.cx - (this.x + this.w / 2)) < 1.6 * TILE && player.y > this.y) { this.mode = 'shake'; this.modeT = 0.7; }
    } else if (this.mode === 'shake') {
      this.modeT -= dt;
      if (this.modeT <= 0) { this.mode = 'fall'; this.vy = 0; }
    } else {
      this.vy = Math.min(this.vy + 1800 * dt, 900);
      if (level.moveY(this, this.vy * dt).hit) {
        this.killed = true;
        if (scene) { scene.particles.debris(this.x + this.w / 2, this.y + this.h - 6); Sound.play('break'); }
      }
    }
  }

  draw(ctx, t) { drawStalactite(ctx, this, t); }
}

// ---------------------------------------------------------------- Cloud Kingdom

// A small grumpy cloud that drifts slowly toward the player.
class Cloudling extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 22);
    this.homeY = ty * TILE + (TILE - this.h) / 2;
    this.reset();
  }

  update(dt, level, player) {
    this.t += dt;
    const dx = player.cx - (this.x + this.w / 2);
    const dy = player.y + player.h / 2 - (this.y + this.h / 2);
    this.dir = Math.sign(dx) || this.dir;
    this.x += Math.sign(dx) * Math.min(Math.abs(dx), 40 * dt);
    this.y += Math.sign(dy) * Math.min(Math.abs(dy), 18 * dt) + Math.sin(this.t * 2 + this.phase) * 0.3;
  }

  draw(ctx, t) { drawCloudling(ctx, this, t); }
}

// Flies straight across the screen from the right at its own height.
class SkyGull extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 30, 16);
    this.homeY = ty * TILE + 8;
    this.reset();
  }

  update(dt, level, player, camX) {
    this.t += dt;
    this.x -= 150 * dt;
    this.dir = -1;
    if (this.x + this.w < camX - 100) this.killed = true;
  }

  draw(ctx, t) { drawGull(ctx, this, t); }
}

// A little ball of lightning that rolls along the clouds and hops over gaps. Can't be stomped.
class Spark extends Enemy {
  constructor(tx, ty) {
    super(tx, ty, 18, 18);
    this.stompable = false;
  }

  update(dt, level, player) {
    this.t += dt;
    this.fall(dt, level);
    if (level.moveX(this, this.dir * 110 * dt)) this.dir = -this.dir;
    if (this.onGround) {
      const frontX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      if (!level.isFloor(Math.floor(frontX / TILE), Math.floor((this.y + this.h + 2) / TILE))) this.vy = -520; // hop the gap
    }
  }

  draw(ctx, t) { drawSpark(ctx, this, t); }
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
    case 'r': return new Crab(tx, ty);
    case 'j': return new Jellyfish(tx, ty);
    case 'p': return new Pufferfish(tx, ty);
    case 'e': return new Eel(tx, ty);
    case 'm': return new Mole(tx, ty);
    case 'b': return new CaveBat(tx, ty);
    case 'R': return new RollingRock(tx, ty);
    case '|': return new Stalactite(tx, ty);
    case 'l': return new Cloudling(tx, ty);
    case 'u': return new SkyGull(tx, ty);
    case 'y': return new Spark(tx, ty);
  }
  return null;
}
