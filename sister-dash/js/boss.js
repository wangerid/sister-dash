// boss.js – shared boss engine: arena lock, intro, health bar data, hazards, phases, victory
// The four bosses themselves live in bosses.js.

const ARENA_TILES = 30; // one screen wide, walls included
const WALL_ROWS = 9;
const BOSS_INTRO = 2; // seconds of entrance, player frozen and safe
const BOSS_HIT_INVULN = 1; // seconds of invulnerability after each hit

// ---------------------------------------------------------------- base boss

class Boss {
  // cfg: { name, hp, w, h, coins, weakTime, rest: [by phase], phaseOf(hp) }
  constructor(arena, cfg) {
    this.arena = arena;
    this.cfg = cfg;
    this.name = cfg.name;
    this.maxHp = cfg.hp;
    this.hp = cfg.hp;
    this.w = cfg.w;
    this.h = cfg.h;
    this.x = arena.right - 180 - this.w;
    this.y = arena.floorY - this.h;
    this.vx = 0;
    this.vy = 0;
    this.dir = -1;
    this.state = 'intro';
    this.t = 0;
    this.anim = 0;
    this.invuln = 0;
    this.flash = 0;
    this.fireHits = 0;
    this.attackIdx = 0;
    this.scale = 1;
  }

  get phase() { return this.cfg.phaseOf ? this.cfg.phaseOf(this.hp) : 1; }
  get alive() { return this.state !== 'defeated' && this.state !== 'flee' && this.state !== 'gone'; }
  get weak() { return this.state === 'weak'; }
  get harmful() { return this.alive && this.state !== 'intro' && !this.weak; }
  get cx() { return this.x + this.w / 2; }
  get hitbox() { return { x: this.x + 8, y: this.y + 8, w: this.w - 16, h: this.h - 8 }; }

  setState(state, t = 0) {
    this.state = state;
    this.t = t;
  }

  facePlayer(p) {
    this.dir = p.cx < this.cx ? -1 : 1;
  }

  rest() {
    this.setState('idle', this.cfg.rest[this.phase - 1]);
  }

  // Entrance animation; k goes 0 → 1 over the intro.
  intro(dt, k, scene) {}

  // Fight starts after the intro.
  begin(p) {
    this.rest();
  }

  goWeak(scene) {
    this.setState('weak', this.cfg.weakTime || 2);
    this.vx = 0;
    scene.shake = Math.max(scene.shake, 0.3);
  }

  // Picks the next attack; subclasses override.
  nextAttack(p, scene) {
    this.rest();
  }

  // Returns true if the hit removed a hit point.
  damage(scene) {
    if (this.invuln > 0 || !this.alive || this.state === 'intro') return false;
    const before = this.phase;
    this.hp--;
    this.flash = 0.4;
    this.invuln = BOSS_HIT_INVULN;
    this.fireHits = 0;
    Sound.play('stomp');
    if (this.hp <= 0) {
      this.setState('defeated', 1.2);
      this.arena.onDefeated(scene);
      return true;
    }
    if (this.phase !== before) {
      Sound.play('roar');
      scene.shake = 0.4;
      this.onPhaseChange(scene);
      this.setState('roar', 1);
    } else {
      this.rest();
    }
    return true;
  }

  onPhaseChange(scene) {}

  fireballHit(scene) {
    if (this.invuln > 0 || !this.alive || this.state === 'intro') return;
    this.fireHits++;
    this.flash = 0.12;
    if (this.fireHits >= 3) this.damage(scene);
  }

  update(dt, scene) {
    this.anim += dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.flash > 0) this.flash -= dt;
    const p = scene.player;
    switch (this.state) {
      case 'intro':
        return;
      case 'idle':
      case 'roar':
        this.t -= dt;
        if (this.state === 'idle') this.facePlayer(p);
        if (this.t <= 0) this.nextAttack(p, scene);
        return;
      case 'weak':
        this.t -= dt;
        if (this.t <= 0) this.recover(scene);
        return;
      case 'defeated':
        this.t -= dt;
        this.scale = 0.3 + 0.7 * Math.max(0, this.t / 1.2);
        if (this.t <= 0) { this.setState('flee'); this.dir = 1; }
        return;
      case 'flee':
        this.flee(dt);
        return;
    }
    this.think(dt, scene, p);
  }

  // Leaving the weak moment.
  recover(scene) {
    this.rest();
  }

  // Boss-specific attack states.
  think(dt, scene, p) {}

  // Small, harmless version runs away.
  flee(dt) {
    this.x += 170 * dt;
    this.y = Math.min(this.y + 300 * dt, this.arena.floorY - this.h * this.scale);
    if (this.x > this.arena.right + 80) this.setState('gone');
  }

  draw(ctx, t) {}
}

// ---------------------------------------------------------------- hazards

// Falls from the sky after a shadow warning on the ground (stingers, snowballs).
class Drop {
  constructor(arena, x, kind, warn = 0.9) {
    this.kind = kind;
    this.w = kind === 'snowball' ? 22 : 12;
    this.h = kind === 'snowball' ? 22 : 26;
    this.x = x - this.w / 2;
    this.groundY = arena.surfaceBelow(x, arena.floorY - 16 * TILE);
    this.y = this.groundY - 520;
    this.warn = warn;
    this.maxWarn = warn;
    this.state = 'warn';
    this.vy = 0;
    this.stuck = 0;
    this.done = false;
  }

  get hurts() { return this.state === 'fall'; }
  get shadowX() { return this.state === 'warn' || this.state === 'fall' ? this.x + this.w / 2 : null; }

  update(dt, arena, scene) {
    if (this.state === 'warn') {
      this.warn -= dt;
      if (this.warn <= 0) { this.state = 'fall'; this.vy = 950; }
    } else if (this.state === 'fall') {
      this.y += this.vy * dt;
      if (this.y + this.h >= this.groundY) {
        this.y = this.groundY - this.h + (this.kind === 'snowball' ? 0 : 6);
        this.state = 'stuck';
        this.stuck = 0.4;
        scene.particles.dust(this.x + this.w / 2, this.groundY);
      }
    } else {
      this.stuck -= dt;
      if (this.stuck <= 0) this.done = true;
    }
  }

  draw(ctx, t) {
    if (this.state !== 'stuck') drawShadow(ctx, this.x + this.w / 2, this.groundY, this.state === 'warn' ? 1 - this.warn / this.maxWarn : 1);
    if (this.state === 'warn') return;
    if (this.kind === 'snowball') drawSnowball(ctx, this, t);
    else drawStinger(ctx, this, t);
  }
}

// A low wave rolling along the floor (sand wave, ground shock). Jump over it.
class Wave {
  // range: how far it travels before fading out (Infinity = to the wall)
  constructor(x, floorY, dir, speed, w, h, kind, range = Infinity) {
    this.range = range;
    this.traveled = 0;
    this.x = x;
    this.y = floorY - h;
    this.w = w;
    this.h = h;
    this.dir = dir;
    this.speed = speed;
    this.kind = kind;
    this.done = false;
  }

  get hurts() { return true; }
  get rect() { return { x: this.x + 6, y: this.y + 4, w: this.w - 12, h: this.h - 4 }; }

  update(dt, arena) {
    this.x += this.dir * this.speed * dt;
    this.traveled += this.speed * dt;
    if (this.x + this.w < arena.left || this.x > arena.right || this.traveled > this.range) this.done = true;
  }

  draw(ctx, t) {
    if (this.kind === 'shock') drawShockWave(ctx, this, t);
    else drawSandWave(ctx, this, t);
  }
}

// A projectile lobbed in an arc to a marked landing spot (Big Bristle's spines).
class Lob {
  constructor(arena, x0, y0, tx, time, kind) {
    this.kind = kind;
    this.w = 12;
    this.h = 12;
    this.x0 = x0;
    this.y0 = y0;
    this.tx = tx;
    this.groundY = arena.surfaceBelow(tx, arena.floorY - 16 * TILE);
    this.time = time;
    this.t = 0;
    this.x = x0;
    this.y = y0;
    this.stuck = 0;
    this.done = false;
  }

  get hurts() { return this.t < this.time; }
  get shadowX() { return this.t < this.time ? this.tx : null; }

  update(dt, arena, scene) {
    if (this.t < this.time) {
      this.t = Math.min(this.time, this.t + dt);
      const k = this.t / this.time;
      this.x = this.x0 + (this.tx - this.x0) * k - this.w / 2;
      this.y = this.y0 + (this.groundY - this.y0) * k - 260 * Math.sin(Math.PI * k) - this.h;
      if (this.t >= this.time) { this.stuck = 0.5; scene.particles.dust(this.tx, this.groundY); }
    } else {
      this.stuck -= dt;
      if (this.stuck <= 0) this.done = true;
    }
  }

  draw(ctx, t) {
    if (this.t < this.time) drawShadow(ctx, this.tx, this.groundY, this.t / this.time);
    drawSpine(ctx, this, t);
  }
}

// A coin flying out of the defeated boss; collected automatically when it settles.
class BurstCoin {
  constructor(x, y, i) {
    this.x = x;
    this.y = y;
    const a = -Math.PI * (0.1 + 0.8 * hash(i * 3.1));
    const sp = 250 + hash(i * 7.7) * 300;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp - 150;
    this.life = 1 + hash(i * 1.3) * 0.8;
    this.done = false;
  }

  update(dt, arena) {
    this.vy += 1300 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > arena.floorY - 10) { this.y = arena.floorY - 10; this.vy *= -0.5; this.vx *= 0.7; }
    if (this.x < arena.left + 10 || this.x > arena.right - 10) this.vx = -this.vx;
    this.life -= dt;
    if (this.life <= 0) this.done = true;
  }
}

// ---------------------------------------------------------------- arena

class BossArena {
  // (kx, ky): tile of the K marker; the arena's left wall stands on that column.
  constructor(level, kx, ky, kind) {
    this.level = level;
    this.kind = kind;
    this.type = BOSS_TYPES[kind];
    this.kx = kx;
    this.floorY = (ky + 1) * TILE;
    this.wallBottomRow = ky;
    this.leftCol = kx;
    this.rightCol = kx + ARENA_TILES - 1;
    this.left = (kx + 1) * TILE;
    this.right = this.rightCol * TILE;
    this.camX = kx * TILE;
    this.icy = !!this.type.icy;
    this.won = false;
    this.reset();
  }

  // Back to the untriggered state (used when the player loses a life during the fight).
  reset(scene) {
    this.setWallRows(0);
    this.wallRows = 0;
    this.wallTimer = 0;
    this.wantWalls = 0;
    this.state = 'waiting';
    this.boss = null;
    this.hazards = [];
    this.burst = [];
    this.coinSound = 0;
    this.stompGrace = 0;
    this.introT = 0;
    this.wind = 0;
    if (scene) scene.enemies = scene.enemies.filter((e) => !e.bossMinion);
  }

  get locked() { return this.state !== 'waiting'; }
  get inIntro() { return this.state === 'intro'; }
  get fighting() { return (this.state === 'intro' || this.state === 'fight') && this.boss && this.boss.alive; }

  setWallRows(n) {
    for (let i = 0; i < WALL_ROWS; i++) {
      const ch = i < n ? 'W' : '.';
      this.level.set(this.leftCol, this.wallBottomRow - i, ch);
      this.level.set(this.rightCol, this.wallBottomRow - i, ch);
    }
  }

  // First solid surface at or below y in the column at x.
  surfaceBelow(x, y) {
    const tx = Math.floor(x / TILE);
    for (let ty = Math.max(0, Math.floor(y / TILE)); ty < this.level.rows; ty++) {
      if (this.level.isSolid(tx, ty)) return ty * TILE;
    }
    return this.floorY;
  }

  clampX(x, margin = 30) {
    return Math.max(this.left + margin, Math.min(this.right - margin, x));
  }

  // Nearest landing x (centre) where a body of half-width hw is not under a floating platform,
  // so a landed boss always has room above its head to be stomped.
  freeSpot(x, hw) {
    const blocked = (cx) => {
      for (let tx = Math.floor((cx - hw) / TILE); tx <= Math.floor((cx + hw) / TILE); tx++) {
        for (let ty = this.wallBottomRow - 4; ty <= this.wallBottomRow; ty++) if (this.level.isSolid(tx, ty) && tx > this.leftCol && tx < this.rightCol) return true;
      }
      return false;
    };
    x = this.clampX(x, hw + 4);
    for (let d = 0; d < this.right - this.left; d += 8) {
      for (const c of [x - d, x + d]) {
        if (c - hw >= this.left + 4 && c + hw <= this.right - 4 && !blocked(c)) return c;
      }
    }
    return x;
  }

  // Spots for falling hazards: always one on the player, the rest spread out.
  dropSpots(n, p) {
    const xs = [this.clampX(p.cx, 20)];
    let tries = 0;
    while (xs.length < n && tries++ < 200) {
      const x = this.left + 30 + Math.random() * (this.right - this.left - 60);
      if (xs.every((o) => Math.abs(o - x) > 80)) xs.push(x);
    }
    return xs;
  }

  spawnMinion(scene, x) {
    const e = createEnemy('f', Math.floor(x / TILE), this.wallBottomRow, this.level.themeName);
    e.bossMinion = true;
    e.active = true;
    e.y -= 200;
    scene.enemies.push(e);
  }

  onDefeated(scene) {
    this.state = 'victory';
    this.won = true;
    this.hazards = [];
    this.wind = 0;
    scene.enemies = scene.enemies.filter((e) => !e.bossMinion);
    const b = this.boss;
    for (let i = 0; i < this.type.coins; i++) this.burst.push(new BurstCoin(b.cx, b.y + 10, i));
    scene.particles.sparkle(b.cx, b.y + b.h / 2, 24, '#ffe36e');
    Sound.play('flag');
    this.victoryT = 0;
  }

  update(dt, scene) {
    const p = scene.player;
    // walls rise/sink one row at a time
    this.wallTimer -= dt;
    if (this.wallTimer <= 0 && this.wallRows !== this.wantWalls) {
      this.wallRows += this.wantWalls > this.wallRows ? 1 : -1;
      this.setWallRows(this.wallRows);
      this.wallTimer = 0.05;
    }

    if (this.state === 'waiting') {
      if (!this.won && p.state === 'play' && p.cx > (this.kx + 2) * TILE) {
        this.state = 'intro';
        this.introT = BOSS_INTRO;
        this.wantWalls = WALL_ROWS;
        this.boss = new this.type.cls(this);
        scene.banner = { text: this.boss.name, sub: '', t: BOSS_INTRO + 0.2, color: '#ffd23f' };
        Sound.play('roar');
      }
      return;
    }

    if (this.state === 'intro') {
      this.introT -= dt;
      this.boss.anim += dt;
      this.boss.intro(dt, 1 - Math.max(0, this.introT) / BOSS_INTRO, scene);
      if (this.introT <= 0) {
        this.state = 'fight';
        this.boss.begin(p);
      }
      return;
    }

    if (this.boss) this.boss.update(dt, scene);
    for (const h of this.hazards) h.update(dt, this, scene);
    this.hazards = this.hazards.filter((h) => !h.done);

    for (const c of this.burst) {
      c.update(dt, this);
      if (c.done) {
        scene.addCoin(1, this.coinSound++ % 4 !== 0);
        scene.particles.sparkle(c.x, c.y, 3, '#fff3a0');
      }
    }
    this.burst = this.burst.filter((c) => !c.done);

    if (this.state === 'victory') {
      this.victoryT += dt;
      if (this.victoryT > 1.3) this.wantWalls = 0;
      if (this.victoryT > 1.8 && scene.flag) scene.flag.rising = true;
    }

    if (this.stompGrace > 0) this.stompGrace -= dt;
    if (p.state === 'play') this.checkPlayer(scene);
  }

  checkPlayer(scene) {
    const p = scene.player;
    const b = this.boss;
    if (b && b.alive && b.state !== 'intro' && this.stompGrace <= 0 && overlaps(p, b.hitbox)) {
      const fromAbove = p.vy > 0 && p.prevBottom <= b.hitbox.y + 14;
      if (b.weak && fromAbove && b.invuln <= 0) {
        b.damage(scene);
        p.vy = -650;
        // bounce off, away from the boss, but never into a nearby wall
        const mid = (this.left + this.right) / 2;
        let dir = Math.sign(p.cx - b.cx) || Math.sign(mid - b.cx) || 1;
        if ((dir < 0 && p.x < this.left + 140) || (dir > 0 && p.x + p.w > this.right - 140)) dir = -dir;
        p.vx = dir * 260;
        p.onGround = false;
        this.stompGrace = BOSS_HIT_INVULN; // recoiling: harmless while invulnerable, so the bounce-off is safe
      } else if (b.harmful && p.invuln <= 0) {
        scene.hurtPlayer();
        if (p.state !== 'play') return;
      }
    }
    for (const h of this.hazards) {
      if (h.hurts && overlaps(p, h.rect || h)) scene.hurtPlayer();
    }
  }

  draw(ctx, t) {
    drawArenaDecor(ctx, this, t);
    for (const h of this.hazards) h.draw(ctx, t);
    if (this.boss && this.boss.state !== 'gone') this.boss.draw(ctx, t);
    for (const c of this.burst) drawCoin(ctx, c.x, c.y, 9, t * 2 + c.life);
  }
}
