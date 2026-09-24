// bosses.js – the five bosses and their attacks (engine in boss.js)

// ---------------------------------------------------------------- Boss 1: Big Bristle (Sunny Meadow)
// A giant grumpy hedgehog. Curls up and rolls into the wall, then is dizzy for 2.5 s.
// After losing 2 HP it also shakes loose spines that land on marked spots.

class BigBristle extends Boss {
  constructor(arena) {
    super(arena, BOSS_TYPES.bristle);
    this.x = arena.right - 150 - this.w;
    this.startY = arena.floorY - this.h - 320;
    this.y = this.startY;
    this.curled = false;
    this.landed = false;
  }

  // jumps in from above
  intro(dt, k, scene) {
    const j = Math.min(1, k / 0.6);
    this.y = this.startY + (this.arena.floorY - this.h - this.startY) * j * j;
    if (j >= 1 && !this.landed) { this.landed = true; scene.shake = 0.4; Sound.play('crash'); }
  }

  nextAttack(p, scene) {
    const spines = this.hp <= 1 && this.attackIdx % 2 === 1;
    this.attackIdx++;
    this.facePlayer(p);
    if (spines) {
      this.setState('shake', 1);
      Sound.play('appear');
    } else {
      this.curled = true;
      this.setState('curl', 1.5);
      Sound.play('stamp');
    }
  }

  think(dt, scene, p) {
    const a = this.arena;
    switch (this.state) {
      case 'curl':
        this.t -= dt;
        if (this.t <= 0) { this.setState('roll'); this.vx = this.dir * 280; }
        break;
      case 'roll': {
        this.x += this.vx * dt;
        let hit = false;
        if (this.x <= a.left) { this.x = a.left; hit = true; }
        if (this.x + this.w >= a.right) { this.x = a.right - this.w; hit = true; }
        if (Math.random() < 0.3) scene.particles.dust(this.cx - this.dir * 30, a.floorY);
        if (hit) {
          this.curled = false;
          Sound.play('crash');
          scene.particles.poof(this.dir > 0 ? a.right : a.left, a.floorY - 30);
          this.goWeak(scene);
        }
        break;
      }
      case 'shake':
        this.t -= dt;
        if (this.t <= 0) {
          for (const off of [0, -140, 140]) {
            const tx = a.clampX(p.cx + off);
            a.hazards.push(new Lob(a, this.cx, this.y + 10, tx, 1.4, 'spine'));
          }
          this.setState('spinesWait', 1.5);
        }
        break;
      case 'spinesWait':
        this.t -= dt;
        if (this.t <= 0) this.rest();
        break;
    }
  }

  draw(ctx, t) { drawBristle(ctx, this, t); }
}

// ---------------------------------------------------------------- Boss 2: Queen Croakia (Whispering Forest)
// A giant frog. Leaps onto the player's spot (shadow warning), sending a shock wave both ways,
// then is stuck in the mud for 2 s. Phase 2 adds a tongue grab and calls in two small frogs.

class Tongue {
  constructor(boss, arena) {
    this.dir = boss.dir;
    this.h = 8;
    this.y = arena.floorY - 24;
    this.x0 = this.dir > 0 ? boss.x + boss.w - 14 : boss.x + 14;
    // reaches across most of the arena, but short-lived enough to jump over
    this.maxLen = Math.min(560, this.dir > 0 ? arena.right - this.x0 : this.x0 - arena.left);
    this.len = 0;
    this.mode = 'out';
    this.hold = 0.1;
    this.done = false;
  }

  get hurts() { return this.len > 24; }
  get rect() { return this.dir > 0 ? { x: this.x0, y: this.y, w: this.len, h: this.h } : { x: this.x0 - this.len, y: this.y, w: this.len, h: this.h }; }

  update(dt) {
    if (this.mode === 'out') {
      this.len = Math.min(this.maxLen, this.len + 1400 * dt);
      if (this.len >= this.maxLen) this.mode = 'hold';
    } else if (this.mode === 'hold') {
      this.hold -= dt;
      if (this.hold <= 0) this.mode = 'in';
    } else {
      this.len -= 2200 * dt;
      if (this.len <= 0) this.done = true;
    }
  }

  draw(ctx, t) { drawTongue(ctx, this, t); }
}

class QueenCroakia extends Boss {
  constructor(arena) {
    super(arena, BOSS_TYPES.croakia);
    this.startY = arena.floorY - this.h - 420;
    this.y = this.startY;
    this.shadowX = null;
    this.landed = false;
  }

  intro(dt, k, scene) {
    const j = Math.min(1, k / 0.55);
    this.y = this.startY + (this.arena.floorY - this.h - this.startY) * j * j;
    if (j >= 1 && !this.landed) { this.landed = true; scene.shake = 0.5; Sound.play('crash'); }
  }

  nextAttack(p, scene) {
    const pattern = this.phase === 1 ? ['jump'] : ['jump', 'tongue', 'jump', 'call'];
    const attack = pattern[this.attackIdx % pattern.length];
    this.attackIdx++;
    this.facePlayer(p);
    if (attack === 'jump') {
      this.setState('crouch', this.phase === 1 ? 1 : 0.7);
    } else if (attack === 'tongue') {
      this.setState('mouth', 0.9);
      Sound.play('appear');
    } else {
      this.setState('croak', 0.8);
      Sound.play('roar');
    }
  }

  think(dt, scene, p) {
    const a = this.arena;
    switch (this.state) {
      case 'crouch':
        this.t -= dt;
        if (this.t <= 0) {
          this.shadowX = a.freeSpot(p.cx, this.w / 2);
          this.x0 = this.x;
          this.leapTime = this.phase === 1 ? 1 : 0.8;
          this.leapT = 0;
          this.setState('leap');
          Sound.play('jump');
        }
        break;
      case 'leap': {
        this.leapT += dt;
        const k = Math.min(1, this.leapT / this.leapTime);
        this.x = this.x0 + (this.shadowX - this.w / 2 - this.x0) * k;
        this.y = a.floorY - this.h - 320 * Math.sin(Math.PI * k);
        if (k >= 1) {
          this.y = a.floorY - this.h;
          this.shadowX = null;
          Sound.play('crash');
          // small and short-lived: slower than the player and fades out after 120 px
          a.hazards.push(new Wave(this.x - 30, a.floorY, -1, 200, 32, 14, 'shock', 120));
          a.hazards.push(new Wave(this.x + this.w - 2, a.floorY, 1, 200, 32, 14, 'shock', 120));
          this.goWeak(scene); // stuck in the mud
        }
        break;
      }
      case 'mouth':
        this.t -= dt;
        if (this.t <= 0) {
          a.hazards.push(new Tongue(this, a));
          this.setState('tongueOut', 1);
        }
        break;
      case 'tongueOut':
        this.t -= dt;
        if (this.t <= 0) this.rest();
        break;
      case 'croak':
        this.t -= dt;
        if (this.t <= 0) {
          const alive = scene.enemies.filter((e) => e.bossMinion && !e.killed).length;
          if (alive < 2) a.spawnMinion(scene, a.left + 60);
          if (alive < 1) a.spawnMinion(scene, a.right - 60);
          this.rest();
        }
        break;
    }
  }

  draw(ctx, t) { drawCroakia(ctx, this, t); }
}

// ---------------------------------------------------------------- Boss 3: Frostbeak (Snowy Mountain)
// A giant snow owl. Drops snowballs (shadow warnings) and swoops down from the screen edge
// into a snowdrift, where she is stuck for 2 s. Phase 2 adds an icy wind. The floor is ice.

class Frostbeak extends Boss {
  constructor(arena) {
    super(arena, BOSS_TYPES.frostbeak);
    this.homeY = arena.floorY - 330;
    this.x = (arena.left + arena.right) / 2 - this.w / 2;
    this.y = arena.floorY - 900;
    this.target = null;
  }

  get grounded() { return this.y + this.h >= this.arena.floorY - 2; }

  intro(dt, k) {
    this.y = this.arena.floorY - 900 + (this.homeY - (this.arena.floorY - 900)) * Math.min(1, k / 0.8);
  }

  rest() {
    if (this.grounded) { this.setState('rise'); return; }
    super.rest();
  }

  // flutters in the snowdrift for a moment before taking off again
  recover(scene) {
    this.setState('wake', 0.4);
  }

  nextAttack(p, scene) {
    if (this.grounded) { this.setState('rise'); return; }
    const pattern = this.phase === 1 ? ['snow', 'swoop'] : ['snow', 'swoop', 'wind', 'swoop'];
    const attack = pattern[this.attackIdx % pattern.length];
    this.attackIdx++;
    const a = this.arena;
    if (attack === 'snow') {
      this.setState('hoot', 0.9);
      Sound.play('appear');
    } else if (attack === 'swoop') {
      const goRight = p.cx < (a.left + a.right) / 2; // hover on the side away from the player
      this.edge = { x: goRight ? a.right - this.w - 10 : a.left + 10, y: a.floorY - 340 };
      this.setState('toEdge');
    } else {
      this.facePlayer(p);
      this.setState('spread', 0.8);
      Sound.play('roar');
    }
  }

  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= speed * dt) { this.x = tx; this.y = ty; return true; }
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    if (Math.abs(dx) > 2) this.dir = Math.sign(dx);
    return false;
  }

  update(dt, scene) {
    // gentle hover bob while idle in the air
    if (this.state === 'idle' && !this.grounded) this.y = this.homeY + Math.sin(this.anim * 2) * 8;
    super.update(dt, scene);
  }

  think(dt, scene, p) {
    const a = this.arena;
    switch (this.state) {
      case 'hoot':
        this.t -= dt;
        if (this.t <= 0) {
          for (const x of a.dropSpots(this.phase === 1 ? 3 : 4, p)) a.hazards.push(new Drop(a, x, 'snowball'));
          this.setState('hootWait', 1.5);
        }
        break;
      case 'hootWait':
        this.t -= dt;
        if (this.t <= 0) this.rest();
        break;
      case 'toEdge':
        if (this.moveToward(this.edge.x, this.edge.y, 450, dt)) {
          this.target = a.freeSpot(p.cx, this.w / 2); // aim where the player is now (never under a platform)
          this.dir = this.target < this.cx ? -1 : 1;
          this.setState('hover', 1);
          Sound.play('stamp');
        }
        break;
      case 'hover':
        this.t -= dt;
        if (this.t <= 0) this.setState('dive');
        break;
      case 'dive':
        if (this.moveToward(this.target - this.w / 2, a.floorY - this.h, this.phase === 1 ? 520 : 650, dt)) {
          this.target = null;
          Sound.play('crash');
          scene.particles.poof(this.cx, a.floorY - 10);
          this.goWeak(scene); // stuck in the snowdrift
        }
        break;
      case 'wake':
        this.t -= dt;
        if (this.t <= 0) this.setState('rise');
        break;
      case 'rise':
        if (this.moveToward(a.clampX(this.cx, this.w) - this.w / 2, this.homeY, 260, dt)) super.rest();
        break;
      case 'spread':
        this.t -= dt;
        if (this.t <= 0) {
          a.wind = (p.cx < this.cx ? -1 : 1) * 130; // blow the player away toward the edge
          this.setState('blow', 3);
        }
        break;
      case 'blow':
        this.t -= dt;
        if (Math.random() < 0.5) scene.particles.list.push({ type: 'star', x: this.cx, y: a.floorY - 20 - Math.random() * 120, vx: Math.sign(a.wind) * 420, vy: 0, life: 1, max: 1, size: 3, color: '#ffffff' });
        if (this.t <= 0) { a.wind = 0; this.rest(); }
        break;
    }
  }

  flee(dt) {
    this.x += 150 * dt;
    this.y -= 220 * dt;
    if (this.y < this.arena.floorY - 800) this.setState('gone');
  }

  draw(ctx, t) { drawFrostbeak(ctx, this, t); }
}

// ---------------------------------------------------------------- Boss 4: Admiral Octavia (Coral Reef)
// A giant octopus in an admiral's hat. Tentacle slams burst up from the sea floor where bubbles rise;
// the tentacle then sticks in the sand and she is dizzy for 2 s. Phase 2 adds an ink cloud,
// phase 3 two slams at once and spinning shells. Swimming rules apply; the air meter is paused.

class TentacleSlam {
  constructor(arena, x, warn) {
    this.kind = 'tentacle';
    this.x = x;
    this.w = 28;
    this.floorY = arena.floorY;
    this.warn = warn;
    this.maxWarn = warn;
    this.state = 'warn';
    this.len = 0;
    this.maxLen = 230;
    this.hold = 0.35;
    this.done = false;
  }

  get shadowX() { return this.state === 'warn' || this.state === 'up' || this.state === 'hold' ? this.x : null; }
  get hurts() { return this.state === 'up' || this.state === 'hold'; }
  get stuck() { return this.state === 'stuck'; }
  get rect() { return { x: this.x - this.w / 2, y: this.floorY - this.len, w: this.w, h: this.len }; }

  release() {
    if (this.state === 'stuck') this.state = 'down';
  }

  update(dt, arena, scene) {
    if (this.state === 'warn') {
      this.warn -= dt;
      if (this.warn <= 0) { this.state = 'up'; Sound.play('crash'); }
    } else if (this.state === 'up') {
      this.len = Math.min(this.maxLen, this.len + 1400 * dt);
      if (this.len >= this.maxLen) this.state = 'hold';
    } else if (this.state === 'hold') {
      this.hold -= dt;
      if (this.hold <= 0) { this.state = 'stuck'; scene.particles.dust(this.x, this.floorY); }
    } else if (this.state === 'stuck') {
      this.len = Math.max(60, this.len - 900 * dt); // stuck in the sand: harmless
    } else {
      this.len -= 600 * dt;
      if (this.len <= 0) this.done = true;
    }
  }

  draw(ctx, t) { drawTentacle(ctx, this, t); }
}

class SpinShell {
  constructor(x, y, dir) {
    this.kind = 'shell';
    this.x = x;
    this.y = y;
    this.w = 26;
    this.h = 20;
    this.dir = dir;
    this.done = false;
  }

  get hurts() { return true; }
  get rect() { return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 }; }

  update(dt, arena) {
    this.x += this.dir * 130 * dt;
    if (this.x + this.w < arena.left || this.x > arena.right) this.done = true;
  }

  draw(ctx, t) { drawSpinShell(ctx, this, t); }
}

class AdmiralOctavia extends Boss {
  constructor(arena) {
    super(arena, BOSS_TYPES.octavia);
    // resting spots near the walls, clear of the floating rocks so there's room above her head
    this.sides = [arena.left + 20, arena.right - 20 - this.w];
    this.side = 1;
    this.x = this.sides[1];
    this.restY = arena.floorY - this.h;
    this.y = arena.floorY + 20;
    this.slams = [];
  }

  // rises out of the sand
  intro(dt, k, scene) {
    this.y = this.arena.floorY + 20 - (this.h + 20) * Math.min(1, k / 0.7);
    if (Math.random() < 0.3) scene.particles.dust(this.cx + (Math.random() - 0.5) * this.w, this.arena.floorY);
  }

  get hitbox() { return { x: this.x + 14, y: this.y + 8, w: this.w - 28, h: this.h - 12 }; }

  nextAttack(p, scene) {
    const pattern = this.phase === 1 ? ['slam'] : this.phase === 2 ? ['slam', 'ink'] : ['slam', 'ink', 'shells'];
    const attack = pattern[this.attackIdx % pattern.length];
    this.attackIdx++;
    this.facePlayer(p);
    const a = this.arena;
    if (attack === 'slam') {
      const warn = [1, 0.8, 0.7][this.phase - 1];
      const x1 = a.clampX(p.cx, 20);
      this.slams = [new TentacleSlam(a, x1, warn)];
      if (this.phase === 3) {
        const x2 = a.clampX(x1 + (x1 < (a.left + a.right) / 2 ? 170 : -170), 20);
        this.slams.push(new TentacleSlam(a, x2, warn));
      }
      for (const s of this.slams) a.hazards.push(s);
      this.setState('slamming');
      Sound.play('appear');
    } else if (attack === 'ink') {
      this.setState('puff', 0.8);
      Sound.play('roar');
    } else {
      this.setState('grab', 0.8);
      Sound.play('stamp');
    }
  }

  recover(scene) {
    for (const s of this.slams) s.release();
    this.slams = [];
    // swim over to the other side of the arena
    this.side = 1 - this.side;
    this.setState('shift');
  }

  think(dt, scene, p) {
    const a = this.arena;
    switch (this.state) {
      case 'slamming':
        if (this.slams.every((s) => s.stuck)) this.goWeak(scene); // tentacle stuck in the sand: dizzy
        break;
      case 'puff':
        this.t -= dt;
        if (this.t <= 0) {
          a.ink = { side: p.cx < (a.left + a.right) / 2 ? -1 : 1, t: 4 }; // the half the player is in
          this.rest();
        }
        break;
      case 'grab':
        this.t -= dt;
        if (this.t <= 0) {
          const dir = p.cx < this.cx ? -1 : 1;
          const x0 = dir > 0 ? this.x + this.w : this.x - 26;
          for (const dy of [30, 110, 190]) a.hazards.push(new SpinShell(x0, a.floorY - dy, dir));
          this.setState('grabWait', 1.2);
        }
        break;
      case 'grabWait':
        this.t -= dt;
        if (this.t <= 0) this.rest();
        break;
      case 'shift': {
        const tx = this.sides[this.side];
        const d = tx - this.x;
        this.dir = Math.sign(d) || this.dir;
        if (Math.abs(d) < 3) { this.x = tx; this.rest(); }
        else this.x += Math.sign(d) * Math.min(Math.abs(d), 140 * dt);
        break;
      }
    }
  }

  damage(scene) {
    const hit = super.damage(scene);
    if (hit) { for (const s of this.slams) s.release(); this.slams = []; }
    return hit;
  }

  flee(dt) {
    this.x += 120 * dt;
    this.y -= 160 * dt;
    if (this.y < this.arena.level.surfaceY - 40 || this.x > this.arena.right + 80) this.setState('gone');
  }

  draw(ctx, t) { drawOctavia(ctx, this, t); }
}

// ---------------------------------------------------------------- Boss 5: King Sandclaw (Scorching Desert)
// A huge crowned sand scorpion. Claw charge into the wall (then dizzy 2 s), stinger rain,
// and in phase 3 a sand wave.

class KingSandclaw extends Boss {
  constructor(arena) {
    super(arena, BOSS_TYPES.sandclaw);
    this.x = arena.right - 160 - this.w;
    this.startY = arena.floorY - this.h - 460;
    this.y = this.startY;
    this.landed = false;
  }

  intro(dt, k, scene) {
    const j = Math.min(1, k / 0.5);
    this.y = this.startY + (this.arena.floorY - this.h - this.startY) * j * j;
    if (j >= 1 && !this.landed) { this.landed = true; scene.shake = 0.5; Sound.play('crash'); }
  }

  nextAttack(p, scene) {
    const pattern = this.phase === 3 ? ['stamp', 'tail', 'slam'] : ['stamp', 'tail'];
    const attack = pattern[this.attackIdx % pattern.length];
    this.attackIdx++;
    this.facePlayer(p);
    if (attack === 'stamp') { this.setState('stamp', 1); Sound.play('stamp'); }
    else if (attack === 'tail') { this.setState('tail', 1); Sound.play('appear'); }
    else this.setState('slam', 0.8);
  }

  think(dt, scene, p) {
    const a = this.arena;
    switch (this.state) {
      case 'stamp':
        this.t -= dt;
        if (Math.floor(this.t * 8) !== Math.floor((this.t + dt) * 8)) scene.particles.dust(this.cx - this.dir * 30, a.floorY);
        if (this.t <= 0) {
          this.setState('charge');
          this.vx = this.dir * [320, 400, 480][this.phase - 1];
        }
        break;
      case 'charge': {
        this.x += this.vx * dt;
        let crashed = false;
        if (this.x <= a.left) { this.x = a.left; crashed = true; }
        if (this.x + this.w >= a.right) { this.x = a.right - this.w; crashed = true; }
        if (Math.random() < 0.3) scene.particles.dust(this.cx - this.dir * 40, a.floorY);
        if (crashed) {
          Sound.play('crash');
          scene.particles.poof(this.dir > 0 ? a.right : a.left, a.floorY - 30);
          scene.shake = 0.4;
          this.goWeak(scene); // dizzy
        }
        break;
      }
      case 'tail':
        this.t -= dt;
        if (this.t <= 0) {
          for (const x of a.dropSpots([3, 4, 5][this.phase - 1], p)) a.hazards.push(new Drop(a, x, 'stinger'));
          this.setState('tailWait', 1.7);
        }
        break;
      case 'tailWait':
        this.t -= dt;
        if (this.t <= 0) this.rest();
        break;
      case 'slam':
        this.t -= dt;
        scene.shake = Math.max(scene.shake, 0.1);
        if (this.t <= 0) {
          Sound.play('crash');
          const dir = p.cx < this.cx ? -1 : 1;
          a.hazards.push(new Wave(dir > 0 ? this.x + this.w : this.x - 44, a.floorY, dir, 300, 44, 22, 'sand'));
          this.rest();
        }
        break;
    }
  }

  draw(ctx, t) { drawSandclaw(ctx, this, t); }
}

// ---------------------------------------------------------------- registry

const BOSS_TYPES = {
  bristle: {
    cls: BigBristle, name: 'Big Bristle', blurb: 'a giant grumpy hedgehog',
    hp: 3, w: 90, h: 58, coins: 20, weakTime: 2.5, rest: [1], phaseOf: () => 1,
  },
  croakia: {
    cls: QueenCroakia, name: 'Queen Croakia', blurb: 'a giant frog with a leaf crown',
    hp: 4, w: 100, h: 66, coins: 30, weakTime: 2, rest: [1, 0.6], phaseOf: (hp) => (hp >= 3 ? 1 : 2),
  },
  frostbeak: {
    cls: Frostbeak, name: 'Frostbeak', blurb: 'a giant snow owl',
    hp: 5, w: 84, h: 60, coins: 40, weakTime: 2, rest: [1, 0.7], phaseOf: (hp) => (hp >= 3 ? 1 : 2), icy: true,
  },
  octavia: {
    cls: AdmiralOctavia, name: 'Admiral Octavia', blurb: 'a giant purple octopus in an admiral\'s hat',
    hp: 5, w: 120, h: 84, coins: 45, weakTime: 2, rest: [1, 0.8, 0.6], phaseOf: (hp) => (hp >= 4 ? 1 : hp >= 2 ? 2 : 3),
  },
  sandclaw: {
    cls: KingSandclaw, name: 'King Sandclaw', blurb: 'a giant sand scorpion with a golden crown',
    hp: 6, w: 96, h: 56, coins: 50, weakTime: 2, rest: [0.8, 0.55, 0.4], phaseOf: (hp) => (hp >= 5 ? 1 : hp >= 3 ? 2 : 3),
  },
};
