// entities.js – coins, carrots, checkpoint, goal flag and particles
// (boxes are tiles; their hit logic lives in PlayScene.hitBox)

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class Coin {
  constructor(tx, ty) {
    this.x = tx * TILE + 7;
    this.y = ty * TILE + 6;
    this.w = 18;
    this.h = 20;
    this.taken = false;
    this.phase = hash(tx * 7 + ty) * 3;
  }

  draw(ctx, t) {
    drawCoin(ctx, this.x + 9, this.y + 10 + Math.sin(t * 3 + this.phase) * 1.5, 10, t + this.phase);
  }
}

// A coin that pops out of a box, spins upward and is collected automatically.
class PopCoin {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vy = -420;
    this.life = 0.55;
    this.done = false;
  }

  update(dt, particles) {
    this.vy += 1300 * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) {
      this.done = true;
      particles.sparkle(this.x, this.y, 6, '#fff3a0');
    }
  }

  draw(ctx, t) {
    drawCoin(ctx, this.x, this.y, 10, t * 3);
  }
}

// Magic carrot. Ground carrots bob in place; box carrots rise out of the box and then walk.
class Carrot {
  constructor(tx, ty, fromBox) {
    this.w = 18;
    this.h = 24;
    this.x = tx * TILE + (TILE - this.w) / 2;
    this.fromBox = fromBox;
    this.sandSolid = true;
    this.taken = false;
    this.lost = false;
    this.vx = 0;
    this.vy = 0;
    if (fromBox) {
      this.targetY = ty * TILE - this.h;
      this.y = ty * TILE + 2;
      this.emerging = true;
    } else {
      this.y = (ty + 1) * TILE - this.h;
      this.emerging = false;
    }
  }

  get ready() {
    return !this.emerging;
  }

  update(dt, level) {
    if (!this.fromBox || this.taken) return;
    if (this.emerging) {
      this.y -= 50 * dt;
      if (this.y <= this.targetY) {
        this.y = this.targetY;
        this.emerging = false;
        this.vx = 70;
      }
      return;
    }
    this.vy = Math.min(this.vy + 1600 * dt, 800);
    if (level.moveX(this, this.vx * dt)) this.vx = -this.vx;
    const r = level.moveY(this, this.vy * dt);
    if (r.hit) this.vy = 0;
    if (this.y > level.height + 40) this.lost = true;
  }

  draw(ctx, t) {
    const bob = this.fromBox ? 0 : Math.sin(t * 3) * 2;
    if (this.emerging) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x - 10, this.targetY - 20, this.w + 20, this.h + 20);
      ctx.clip();
    }
    ctx.fillStyle = 'rgba(255, 240, 150, 0.25)';
    circle(ctx, this.x + this.w / 2, this.y + this.h / 2 + bob, 15 + Math.sin(t * 6) * 2);
    drawCarrot(ctx, this.x + this.w / 2, this.y + this.h + bob, 1, t);
    if (this.emerging) ctx.restore();
  }
}

class Checkpoint {
  constructor(tx, ty) {
    this.x = tx * TILE + TILE / 2;
    this.y = (ty + 1) * TILE;
    this.active = false;
  }

  respawnPoint() {
    return { cx: this.x, bottom: this.y };
  }
}

class GoalFlag {
  // hidden: the flag stays under the sand until it is told to rise (boss levels)
  constructor(tx, ty, hidden = false) {
    this.poleX = tx * TILE + 14;
    this.bottom = (ty + 1) * TILE;
    this.top = this.bottom - 8 * TILE;
    this.flagY = this.top + 70;
    this.raised = false;
    this.rise = hidden ? 0 : 1;
    this.rising = false;
    this.x = this.poleX - 6;
    this.y = this.top;
    this.w = 16;
    this.h = this.bottom - this.top;
  }

  get visible() {
    return this.rise > 0;
  }

  get touchable() {
    return this.rise >= 1;
  }

  update(dt) {
    if (this.rising && this.rise < 1) this.rise = Math.min(1, this.rise + dt / 2);
    if (this.raised && this.flagY > this.top + 4) this.flagY = Math.max(this.top + 4, this.flagY - 120 * dt);
  }
}

class Particles {
  constructor() {
    this.list = [];
  }

  poof(x, y) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      this.list.push({ type: 'puff', x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 50 - 20, life: 0.45, max: 0.45, size: 6 + (i % 3) * 2 });
    }
  }

  sparkle(x, y, n = 10, color = '#fff7a8') {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = 60 + Math.random() * 90;
      this.list.push({ type: 'star', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.6, max: 0.6, size: 4 + Math.random() * 3, color });
    }
  }

  debris(x, y) {
    const d = [[-1, -1], [1, -1], [-1, 0.2], [1, 0.2]];
    for (const [sx, sy] of d) {
      this.list.push({ type: 'chunk', x: x + sx * 8, y: y + sy * 8, vx: sx * 120, vy: -380 + sy * 200, life: 1, max: 1, size: 9, rot: 0, color: '#aaa39a' });
    }
  }

  dust(x, y) {
    for (let i = 0; i < 4; i++) {
      this.list.push({ type: 'puff', x: x + (i - 1.5) * 5, y, vx: (i - 1.5) * 30, vy: -20, life: 0.3, max: 0.3, size: 3 });
    }
  }

  confetti(x, y) {
    const colors = ['#ff5fa2', '#ffd23f', '#5cb8ff', '#6fdc6f', '#b983ff'];
    for (let i = 0; i < 14; i++) {
      this.list.push({ type: 'chunk', x, y, vx: (Math.random() - 0.5) * 360, vy: -300 - Math.random() * 250, life: 1.4, max: 1.4, size: 5, rot: Math.random() * 6, color: colors[i % colors.length] });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'chunk') {
        p.vy += 1200 * dt;
        p.rot += dt * 10;
      } else {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx) {
    for (const p of this.list) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      if (p.type === 'puff') {
        ctx.fillStyle = '#ffffff';
        circle(ctx, p.x, p.y, p.size * (1.4 - k * 0.6));
      } else if (p.type === 'star') {
        drawStar(ctx, p.x, p.y, p.size * k + 1, p.color);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
