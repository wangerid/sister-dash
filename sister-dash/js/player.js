// player.js – physics, states, small/big, character stats, long jump (swimming lives in swimming.js)

const SISTERS = {
  // jump is a velocity factor: jump height scales with its square (+10% height = sqrt(1.1)).
  older: { name: 'Older sister', speed: 231, jump: 1.0, smallH: 32, w: 20, shot: 'star', perk: 'Runs a little faster' },
  younger: { name: 'Younger sister', speed: 210, jump: Math.sqrt(1.1), smallH: 28, w: 20, shot: 'bubble', perk: 'Jumps a little higher' },
  grownup: { name: 'Grown-up', speed: 210, jump: Math.sqrt(0.95), smallH: 40, w: 22, shot: 'boomerang', breaksCracked: true, perk: 'Smashes cracked boxes' },
  // Long jump: 30% faster in the air and slightly lower gravity (with a matching jump speed, so the
  // jump height stays normal) – about 25% further than the others.
  firewoman: { name: 'Fire Woman', speed: 210, jump: Math.sqrt(0.9), gravity: 0.9, airSpeed: 1.3, smallH: 40, w: 22, shot: 'fireball', perk: 'Long jump' },
};

const PHYS = {
  gravity: 2000,
  fallMax: 900,
  jumpV: 720,
  cutGravity: 3, // gravity multiplier while rising without holding jump (short hop)
  accel: 1500,
  turnAccel: 3200,
  decel: 2200,
  airAccel: 1200,
  airDecel: 500,
  coyote: 0.1,
  buffer: 0.1,
  stompBounce: 560,
  bigScale: 1.5,
  growTime: 0.6,
};

const SAND = {
  sink: 32, // px/s sinking speed in quicksand
  speed: 0.35, // run speed multiplier while in quicksand
  jump: 0.6, // jump strength multiplier while in quicksand
  drownTime: 3, // seconds fully sunk before losing a life
};

class Player {
  constructor(kind, cx, bottom) {
    this.kind = kind;
    this.cfg = SISTERS[kind];
    this.big = false;
    this.w = this.cfg.w;
    this.h = this.cfg.smallH;
    this.x = cx - this.w / 2;
    this.y = bottom - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.invuln = 0;
    this.growT = 0;
    this.growFrom = 1;
    this.state = 'play'; // play | dead | victory
    this.runPhase = 0;
    this.throwT = 0;
    this.inSand = false;
    this.sunkT = 0;
    this.frozen = false; // boss intro: no control
    this.push = 0; // external horizontal push in px/s (icy wind, arena current)
    this.onIce = false; // slippery floor
    this.swimming = false;
    this.air = AIR.max;
    this.airPaused = false; // boss fights pause the air meter
    this.inkSlow = false;
    this.rainSlow = false; // Grumblecloud's downpour: slower moves and jumps
    this.rides = true; // can stand on moving platforms
    this.mover = null; // the moving platform she stands on
    this.dropThrough = 0; // seconds left of falling through thin clouds
    this.springT = 0; // a spring launch always goes full height, jump key held or not
    this.t = 0;
    this.prevBottom = this.y + this.h;
  }

  get cx() { return this.x + this.w / 2; }
  get canShoot() { return this.big && this.state === 'play'; }
  get bottom() { return this.y + this.h; }

  setBig(big) {
    if (big === this.big) return;
    const cx = this.cx, bottom = this.bottom;
    this.growFrom = this.big ? PHYS.bigScale : 1;
    this.big = big;
    this.w = big ? this.cfg.w + 4 : this.cfg.w;
    this.h = big ? Math.round(this.cfg.smallH * PHYS.bigScale) : this.cfg.smallH;
    this.x = cx - this.w / 2;
    this.y = bottom - this.h;
    this.growT = PHYS.growTime;
  }

  die(cause) {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.vx = 0;
    this.vy = cause === 'pit' ? 0 : cause === 'air' || this.swimming ? -200 : -640;
    this.invuln = 0;
  }

  update(dt, level, scene) {
    this.t += dt;
    if (this.growT > 0) this.growT = Math.max(0, this.growT - dt);
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.throwT > 0) this.throwT = Math.max(0, this.throwT - dt);

    if (this.state === 'dead') {
      this.vy = Math.min(this.vy + (this.swimming ? 400 : PHYS.gravity) * dt, PHYS.fallMax);
      this.y += this.vy * dt;
      return;
    }

    const control = this.state === 'play' && !this.frozen;
    const move = control ? (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0) : 0;

    if (level.underwater && level.inWater(this.cx, this.y + this.h * 0.5)) {
      if (!this.swimming) { this.swimming = true; this.vy = Math.min(this.vy, 120); if (scene) scene.particles.dust(this.cx, level.surfaceY); }
      swimStep(this, dt, level, scene, control, move);
      if (Math.abs(this.vx) > 5 || !this.onGround) this.runPhase += dt * (this.onGround ? Math.abs(this.vx) * 0.075 : 5);
      return;
    }
    this.swimming = false;
    this.air = AIR.max;

    // ride along with a moving platform
    if (this.onGround && this.mover) {
      level.moveX(this, this.mover.dx);
      this.y += this.mover.dy;
    }
    // ↓ on a thin cloud drops through it
    if (this.dropThrough > 0) this.dropThrough -= dt;
    if (control && this.onGround && Input.isDown('down') && level.tileUnder(this) === '~') {
      this.dropThrough = 0.25;
      this.onGround = false;
      this.y += 2;
    }

    const sandTop = level.quicksandSurface(this.cx, this.y + this.h - 2);
    this.inSand = sandTop !== null;
    const airSpeed = this.onGround ? 1 : this.cfg.airSpeed || 1;
    const maxSpeed = this.cfg.speed * (this.inSand ? SAND.speed : 1) * airSpeed * (this.rainSlow ? 0.6 : 1);

    if (move !== 0) {
      this.facing = move;
      let a = this.onGround ? PHYS.accel : PHYS.airAccel;
      if (this.onGround && this.vx !== 0 && Math.sign(this.vx) !== move) a = PHYS.turnAccel;
      if (this.onIce) a *= 0.45;
      this.vx += move * a * dt;
      if (Math.abs(this.vx) > maxSpeed) this.vx = Math.sign(this.vx) * maxSpeed;
    } else {
      const d = (this.onGround ? PHYS.decel * (this.onIce ? 0.18 : 1) : PHYS.airDecel) * dt;
      this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
    }

    // Jump with buffering and coyote time.
    if (control && Input.pressed('jump')) this.jumpBuffer = PHYS.buffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround || this.inSand ? PHYS.coyote : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -PHYS.jumpV * this.cfg.jump * (this.inSand ? SAND.jump : 1) * (this.rainSlow ? 0.85 : 1);
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      Sound.play('jump');
    }

    let g = PHYS.gravity * (this.cfg.gravity || 1);
    if (this.springT > 0) this.springT -= dt;
    else if (this.vy < 0 && !(control && Input.isDown('jump'))) g *= PHYS.cutGravity;
    this.vy = Math.min(this.vy + g * dt, PHYS.fallMax);
    if (this.inSand && this.vy > SAND.sink) this.vy = SAND.sink;

    this.prevBottom = this.y + this.h;
    if (level.moveX(this, (this.vx + this.push + level.windAt(this)) * dt)) this.vx = 0;
    const wasGround = this.onGround;
    const falling = this.vy;
    const r = level.moveY(this, this.vy * dt);
    this.onGround = false;
    this.mover = null;
    if (r.hit) {
      if (this.vy >= 0) { this.onGround = true; this.mover = r.mover; }
      else if (this.vy < 0 && scene) scene.onHeadBump(r, this);
      this.vy = 0;
    }
    if (this.onGround && !wasGround && falling > 300 && scene) scene.particles.dust(this.cx, this.bottom);
    // spring clouds launch her about 3x as high as a normal jump
    if (this.onGround && level.tileUnder(this) === '^') {
      this.vy = -PHYS.jumpV * this.cfg.jump * SPRING_BOOST;
      this.springT = 0.7;
      this.onGround = false;
      Sound.play('spring');
    }

    if (this.inSand) {
      // quicksand pools rest on the bottom of the map: sink until fully under, then drown
      if (this.y + this.h > level.height) { this.y = level.height - this.h; this.vy = 0; }
      if (this.y >= sandTop) this.sunkT += dt;
      else this.sunkT = 0;
      if (this.sunkT >= SAND.drownTime && scene) scene.killPlayer('sand');
    } else {
      this.sunkT = 0;
    }

    if ((this.onGround || this.inSand) && Math.abs(this.vx) > 5) this.runPhase += Math.abs(this.vx) * dt * 0.075;
    if (this.y > level.height + 40 && scene) scene.killPlayer('pit');
  }

  bounce() {
    this.vy = -PHYS.stompBounce * (this.swimming ? 0.45 : 1);
    this.onGround = false;
    this.coyote = 0;
  }

  get pose() {
    if (this.state === 'dead') return 'hurt';
    if (this.state === 'victory' && this.onGround) return 'victory';
    if (this.throwT > 0) return 'throw';
    if (this.swimming && !this.onGround) return 'swim';
    if (this.inSand && this.vy >= 0) return Math.abs(this.vx) > 10 ? 'run' : 'idle';
    if (!this.onGround) return 'jump';
    if (Math.abs(this.vx) > 10) return 'run';
    return 'idle';
  }

  get drawScale() {
    const target = this.big ? PHYS.bigScale : 1;
    if (this.growT <= 0) return target;
    // quick pulse between old and new size
    const k = Math.floor((1 - this.growT / PHYS.growTime) * 7);
    return k % 2 === 0 ? this.growFrom : target;
  }

  draw(ctx, t) {
    // faint glow in the shot's colour while the shooting power is active
    if (this.canShoot) drawShotGlow(ctx, this.cx, this.y + this.h * 0.55, this.h * 0.85, t, SHOTS[this.cfg.shot].color);
    if (this.invuln > 0 && this.state === 'play' && Math.floor(this.invuln * 14) % 2 === 0) ctx.globalAlpha = 0.3;
    drawSister(ctx, this.kind, this.cx, this.bottom + 0.5, this.drawScale, this.facing, this.pose, this.runPhase, t);
    ctx.globalAlpha = 1;
  }
}
