// scenes.js – title, character select, level select, play, results, game over

function drawPanel(ctx, x, y, w, h, fill = 'rgba(255,255,255,0.92)', stroke = '#2b2d42') {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x + 4, y + 6, w, h, 18);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawHint(ctx, text) {
  drawText(ctx, text, VIEW_W / 2, VIEW_H - 22, 16, '#ffffff');
  drawText(ctx, Sound.muted ? 'M: sound off' : 'M: sound on', VIEW_W - 14, 20, 14, '#ffffff', 'right');
}

// Vertical list of buttons used by the pause and game over menus.
class MenuList {
  constructor(items, cx, y, w = 320, h = 50, gap = 14) {
    this.items = items;
    this.sel = 0;
    this.cx = cx;
    this.y = y;
    this.w = w;
    this.h = h;
    this.gap = gap;
  }

  rect(i) {
    return { x: this.cx - this.w / 2, y: this.y + i * (this.h + this.gap), w: this.w, h: this.h };
  }

  // Returns the chosen index, or -1.
  update() {
    if (Input.pressed('down')) { this.sel = (this.sel + 1) % this.items.length; Sound.play('select'); }
    if (Input.pressed('up')) { this.sel = (this.sel + this.items.length - 1) % this.items.length; Sound.play('select'); }
    if (Input.mouseMoved) {
      this.items.forEach((_, i) => {
        const r = this.rect(i);
        if (pointInRect(Input.mouse, r.x, r.y, r.w, r.h)) this.sel = i;
      });
    }
    const c = Input.clicked();
    if (c) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.rect(i);
        if (pointInRect(c, r.x, r.y, r.w, r.h)) { this.sel = i; return i; }
      }
    }
    if (Input.pressed('confirm')) return this.sel;
    return -1;
  }

  draw(ctx) {
    this.items.forEach((label, i) => {
      const r = this.rect(i);
      const on = i === this.sel;
      ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.9)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 12);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = on ? '#b07c14' : '#2b2d42';
      ctx.stroke();
      drawText(ctx, label, this.cx, r.y + r.h / 2 + 1, 22, '#2b2d42', 'center', null);
    });
  }
}

// ---------------------------------------------------------------- title

class TitleScene {
  constructor() {
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (Input.pressed('confirm') || Input.clicked()) {
      Sound.play('confirm');
      Game.setScene(new CharacterSelectScene());
    }
  }

  render(ctx) {
    const cam = this.t * 70;
    drawBackground(ctx, 'meadow', cam, this.t);
    drawGroundBand(ctx, 'meadow', cam, 440);
    const phase = this.t * 13;
    drawSister(ctx, 'grownup', 330, 440, 2.4, 1, 'run', phase + 0.7, this.t);
    drawSister(ctx, 'firegirl', 430, 440, 2.4, 1, 'run', phase + 2.1, this.t);
    drawSister(ctx, 'older', 530, 440, 2.4, 1, 'run', phase, this.t);
    drawSister(ctx, 'younger', 625, 440, 2.4, 1, 'run', phase + 1.4, this.t);
    const y = 150 + Math.sin(this.t * 2) * 6;
    ctx.save();
    ctx.translate(VIEW_W / 2, y);
    ctx.rotate(-0.03);
    drawText(ctx, 'Sister Dash', 4, 6, 96, 'rgba(0,0,0,0.25)', 'center', null);
    drawText(ctx, 'Sister Dash', 0, 0, 96, '#ffd23f', 'center', '#b0431f');
    ctx.restore();
    drawText(ctx, 'Run, jump and grab the flag!', VIEW_W / 2, 225, 24, '#ffffff', 'center', 'rgba(20,60,120,0.6)');
    if (Math.floor(this.t * 2) % 2 === 0) drawText(ctx, 'Press Enter / Click to start', VIEW_W / 2, 300, 30, '#ffffff');
    drawHint(ctx, 'Arrows / A D to move  •  Space / W / ↑ to jump  •  P / Esc to pause');
  }
}

// ---------------------------------------------------------------- character select

class CharacterSelectScene {
  constructor() {
    this.t = 0;
    this.kinds = ['older', 'younger', 'grownup', 'firegirl'];
    this.sel = Math.max(0, this.kinds.indexOf(Game.character));
  }

  cardRect(i) {
    return { x: 30 + i * 230, y: 110, w: 210, h: 340 };
  }

  choose() {
    Game.character = this.kinds[this.sel];
    Sound.play('confirm');
    Game.setScene(new LevelSelectScene());
  }

  update(dt) {
    this.t += dt;
    const n = this.kinds.length;
    if (Input.pressed('left') && this.sel > 0) { this.sel--; Sound.play('select'); }
    if (Input.pressed('right') && this.sel < n - 1) { this.sel++; Sound.play('select'); }
    if (Input.mouseMoved) {
      for (let i = 0; i < n; i++) {
        const r = this.cardRect(i);
        if (pointInRect(Input.mouse, r.x, r.y, r.w, r.h)) this.sel = i;
      }
    }
    const c = Input.clicked();
    if (c) {
      for (let i = 0; i < n; i++) {
        const r = this.cardRect(i);
        if (pointInRect(c, r.x, r.y, r.w, r.h)) { this.sel = i; this.choose(); return; }
      }
    }
    if (Input.pressed('confirm')) this.choose();
    else if (Input.pressed('back')) Game.setScene(new TitleScene());
  }

  render(ctx) {
    drawBackground(ctx, 'meadow', this.t * 20, this.t);
    drawText(ctx, 'Choose your character', VIEW_W / 2, 60, 44, '#ffffff', 'center', 'rgba(20,60,120,0.6)');
    const tint = { older: 'rgba(59,130,230,0.18)', younger: 'rgba(255,111,174,0.2)', grownup: 'rgba(63,145,80,0.2)', firegirl: 'rgba(255,140,42,0.22)' };
    for (let i = 0; i < this.kinds.length; i++) {
      const r = this.cardRect(i);
      const kind = this.kinds[i];
      const cfg = SISTERS[kind];
      const on = i === this.sel;
      const y = r.y + (on ? -8 + Math.sin(this.t * 4) * 2 : 0);
      const cx = r.x + r.w / 2;
      drawPanel(ctx, r.x, y, r.w, r.h, on ? '#fff8dc' : 'rgba(255,255,255,0.8)', on ? '#ff8a1f' : '#2b2d42');
      ctx.fillStyle = tint[kind];
      roundRect(ctx, r.x + 18, y + 18, r.w - 36, 204, 14);
      ctx.fill();
      if (kind === 'firegirl' && on) drawFireGlow(ctx, cx, y + 140, 80, this.t);
      drawSister(ctx, kind, cx, y + 212, 4.2, 1, on ? 'run' : 'idle', this.t * 11, this.t);
      drawText(ctx, cfg.name, cx, y + 250, 25, '#2b2d42', 'center', null);
      drawText(ctx, cfg.perk, cx, y + 284, 17, '#555a70', 'center', null);
      drawText(ctx, cfg.look, cx, y + 310, 14, '#7a7f95', 'center', null);
    }
    drawHint(ctx, '← → to choose  •  Enter / Click to confirm  •  Esc: back');
  }
}

// ---------------------------------------------------------------- level select

const LEVEL_INFO = [
  { difficulty: 'Easy' },
  { difficulty: 'Medium' },
  { difficulty: 'Harder' },
  { difficulty: 'Very hard!', badge: true },
];

class LevelSelectScene {
  constructor() {
    this.t = 0;
    this.sel = Game.levelIndex;
  }

  cardRect(i) {
    return { x: 30 + i * 230, y: 110, w: 210, h: 294 };
  }

  toggle(key) {
    SaveData.data[key] = !SaveData.data[key];
    SaveData.save();
    Sound.play('select');
  }

  start() {
    Game.levelIndex = this.sel;
    Sound.play('confirm');
    Game.setScene(new PlayScene(this.sel));
  }

  update(dt) {
    this.t += dt;
    const n = LEVELS.length;
    if (Input.pressed('left')) { this.sel = (this.sel + n - 1) % n; Sound.play('select'); }
    if (Input.pressed('right')) { this.sel = (this.sel + 1) % n; Sound.play('select'); }
    if (Input.pressed('option')) this.toggle('extraLife');
    if (Input.pressed('timeChallenge')) this.toggle('timeChallenge');
    if (Input.mouseMoved) {
      for (let i = 0; i < LEVELS.length; i++) {
        const r = this.cardRect(i);
        if (pointInRect(Input.mouse, r.x, r.y, r.w, r.h)) this.sel = i;
      }
    }
    const c = Input.clicked();
    if (c) {
      for (let i = 0; i < LEVELS.length; i++) {
        const r = this.cardRect(i);
        if (pointInRect(c, r.x, r.y, r.w, r.h)) { this.sel = i; this.start(); return; }
      }
      if (pointInRect(c, 120, 420, 350, 40)) this.toggle('extraLife');
      if (pointInRect(c, 490, 420, 350, 40)) this.toggle('timeChallenge');
    }
    if (Input.pressed('confirm')) this.start();
    else if (Input.pressed('back')) Game.setScene(new CharacterSelectScene());
  }

  render(ctx) {
    const theme = LEVELS[this.sel].theme;
    drawBackground(ctx, theme, this.t * 25, this.t);
    drawText(ctx, 'Choose a level', VIEW_W / 2, 60, 44, '#ffffff', 'center', 'rgba(0,0,0,0.5)');
    for (let i = 0; i < LEVELS.length; i++) {
      const r = this.cardRect(i);
      const def = LEVELS[i];
      const rec = SaveData.getLevel(i);
      const on = i === this.sel;
      const lift = on ? -8 : 0;
      const y = r.y + lift;
      drawPanel(ctx, r.x, y, r.w, r.h, on ? '#fff8dc' : 'rgba(255,255,255,0.85)', on ? '#ff8a1f' : '#2b2d42');
      // miniature preview
      ctx.save();
      roundRect(ctx, r.x + 16, y + 16, r.w - 32, 120, 12);
      ctx.clip();
      ctx.translate(r.x + 16, y + 16);
      ctx.scale((r.w - 32) / VIEW_W, 120 / VIEW_H * 1.0);
      drawBackground(ctx, def.theme, this.t * 40 + i * 300, this.t);
      drawGroundBand(ctx, def.theme, this.t * 40 + i * 300, 440);
      ctx.restore();
      const info = LEVEL_INFO[i];
      drawText(ctx, `${i + 1}. ${def.name}`, r.x + r.w / 2, y + 160, 19, '#2b2d42', 'center', null);
      if (info.badge) {
        drawSkullSun(ctx, r.x + r.w / 2 - 50, y + 190, 0.8);
        drawText(ctx, info.difficulty, r.x + r.w / 2 + 10, y + 190, 17, '#d8322a', 'center', null);
      } else {
        drawText(ctx, info.difficulty, r.x + r.w / 2, y + 190, 17, '#6a6f85', 'center', null);
      }
      const total = Level.countCoins(def);
      drawCoin(ctx, r.x + 34, y + 224, 10, this.t);
      drawText(ctx, `Best: ${rec.best} / ${total}`, r.x + 52, y + 225, 18, '#2b2d42', 'left', null);
      drawStopwatch(ctx, r.x + 34, y + 252, 0.7, '#2b2d42');
      drawText(ctx, `Best time: ${rec.bestTime !== null ? formatTime(rec.bestTime) : '–'}`, r.x + 52, y + 253, 16, '#2b2d42', 'left', null);
      // every level ends with a boss: show it, and a crown once it has been beaten
      if (def.boss) {
        drawBossPortrait(ctx, def.boss, r.x + r.w - 40, y + 108, 0.42, this.t);
        const label = `Boss: ${BOSS_TYPES[def.boss].name}`;
        ctx.font = `bold 12px ${FONT}`;
        const lw = ctx.measureText(label).width + 12;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        roundRect(ctx, r.x + 20, y + 112, lw, 20, 8);
        ctx.fill();
        drawText(ctx, label, r.x + 26, y + 123, 12, '#ffe680', 'left', null);
        if (rec.completed) drawCrown(ctx, r.x + 30, y + 30, 1.3);
      }
      if (SaveData.data.timeChallenge) {
        drawText(ctx, `Time limit ${formatTime(def.timeLimit)}`, r.x + r.w / 2, y + 276, 15, '#d9661a', 'center', null);
      } else if (!rec.completed) {
        drawText(ctx, 'Not completed yet', r.x + r.w / 2, y + 276, 15, '#8a8fa5', 'center', null);
      }
      if (rec.completed) {
        ctx.fillStyle = '#39b54a';
        circle(ctx, r.x + r.w - 28, y + 28, 18);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(r.x + r.w - 37, y + 28);
        ctx.lineTo(r.x + r.w - 30, y + 36);
        ctx.lineTo(r.x + r.w - 18, y + 20);
        ctx.stroke();
      }
    }
    this.drawToggle(ctx, 120, 'Extra life every 100 coins', 'E', SaveData.data.extraLife, false);
    this.drawToggle(ctx, 490, 'Time challenge', 'T', SaveData.data.timeChallenge, true);
    const who = Game.character === 'firegirl' ? 'Fire Girl' : `the ${SISTERS[Game.character].name.toLowerCase()}`;
    drawText(ctx, `Playing as ${who}`, VIEW_W / 2, 486, 16, '#ffffff');
    drawHint(ctx, '← → to choose  •  Enter / Click to play  •  Esc: change character');
  }
}

LevelSelectScene.prototype.drawToggle = function (ctx, x, label, key, on, stopwatch) {
  const y = 420, w = 350, h = 40;
  ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.88)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = on ? '#b07c14' : '#2b2d42';
  ctx.stroke();
  let tx = x + 18;
  if (stopwatch) {
    drawStopwatch(ctx, x + 26, y + h / 2 + 1, 0.8, '#2b2d42');
    tx = x + 44;
  }
  drawText(ctx, `${label} (${key})`, tx, y + h / 2 + 1, 17, '#2b2d42', 'left', null);
  drawText(ctx, on ? 'ON' : 'OFF', x + w - 16, y + h / 2 + 1, 18, on ? '#2e7d32' : '#8a8fa5', 'right', null);
};

// ---------------------------------------------------------------- play

class PlayScene {
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
  }

  enter() {
    const def = LEVELS[this.levelIndex];
    this.level = new Level(this.levelIndex);
    this.kind = Game.character;
    this.lives = 3;
    this.coins = 0;
    this.timer = new LevelTimer(SaveData.data.timeChallenge ? def.timeLimit : null);
    this.fireballs = [];
    this.fireCooldown = 0;
    this.banner = null;
    this.shake = 0;
    this.arena = null;
    this.t = 0;
    this.totalCoins = Level.countCoins(def);
    this.coinList = [];
    this.carrots = [];
    this.enemies = [];
    this.popCoins = [];
    this.particles = new Particles();
    this.checkpoints = [];
    this.flag = null;
    this.start = { cx: 3 * TILE, bottom: 15 * TILE };
    for (const s of this.level.spawns) {
      switch (s.type) {
        case 'P': this.start = { cx: s.tx * TILE + TILE / 2, bottom: (s.ty + 1) * TILE }; break;
        case 'o': this.coinList.push(new Coin(s.tx, s.ty)); break;
        case 'c': this.carrots.push(new Carrot(s.tx, s.ty, false)); break;
        case 'k': this.checkpoints.push(new Checkpoint(s.tx, s.ty)); break;
        case 'F': this.flagTile = s; break;
        case 'K': this.arena = new BossArena(this.level, s.tx, s.ty, def.boss); break;
        default: {
          const e = createEnemy(s.type, s.tx, s.ty, this.level.themeName);
          if (e) this.enemies.push(e);
        }
      }
    }
    // on boss levels the flag stays hidden until the boss is defeated
    if (this.flagTile) this.flag = new GoalFlag(this.flagTile.tx, this.flagTile.ty, !!this.arena);
    // carrot boxes, so the one by the arena checkpoint can be refilled for every boss attempt
    this.carrotBoxes = [];
    this.level.tiles.forEach((row, ty) => row.forEach((ch, tx) => { if (ch === 'C') this.carrotBoxes.push({ tx, ty }); }));
    this.groundCarrots = this.carrots.slice();
    this.paused = false;
    this.pauseMenu = new MenuList(['Resume', 'Restart level', 'Back to level select'], VIEW_W / 2, 200);
    this.deathT = 0;
    this.victoryT = 0;
    this.spawnPlayer(this.start);
  }

  spawnPlayer(pos) {
    this.player = new Player(this.kind, pos.cx, pos.bottom);
    this.camY = this.level.height - VIEW_H;
    this.camX = this.cameraTarget();
  }

  cameraTarget() {
    if (this.arena && this.arena.locked) return this.arena.camX;
    const tx = this.player.cx - VIEW_W * 0.4;
    return Math.max(0, Math.min(this.level.width - VIEW_W, tx));
  }

  addCoin(n = 1, quiet = false) {
    const before = this.coins;
    this.coins += n;
    if (!quiet) Sound.play('coin');
    // optional extra life every 100 coins
    if (SaveData.data.extraLife && Math.floor(this.coins / 100) > Math.floor(before / 100)) {
      this.lives++;
      Sound.play('oneup');
    }
  }

  onHeadBump(res, p) {
    let best = res.tiles[0], bestD = Infinity;
    for (const tx of res.tiles) {
      const d = Math.abs(tx * TILE + TILE / 2 - p.cx);
      if (d < bestD) { bestD = d; best = tx; }
    }
    this.hitBox(best, res.ty);
  }

  hitBox(tx, ty) {
    const lvl = this.level;
    const ch = lvl.get(tx, ty);
    const cx = tx * TILE + TILE / 2;
    if (ch === '?') {
      lvl.set(tx, ty, 'U');
      lvl.bump(tx, ty);
      this.popCoins.push(new PopCoin(cx, ty * TILE - 8));
      this.addCoin();
    } else if (ch === 'C') {
      lvl.set(tx, ty, 'U');
      lvl.bump(tx, ty);
      this.carrots.push(new Carrot(tx, ty, true));
      Sound.play('appear');
    } else if (ch === 'X') {
      if (this.player.big || this.player.cfg.breaksCracked) {
        lvl.set(tx, ty, '.');
        this.particles.debris(cx, ty * TILE + TILE / 2);
        this.popCoins.push(new PopCoin(cx, ty * TILE));
        this.addCoin();
        Sound.play('break');
      } else {
        lvl.bump(tx, ty);
        Sound.play('bump');
      }
    } else {
      if (ch === 'B' || ch === 'U') lvl.bump(tx, ty);
      Sound.play('bump');
    }
    // Enemies standing on a bumped box get knocked out.
    for (const e of this.enemies) {
      if (e.killed || !e.active) continue;
      if (Math.abs(e.y + e.h - ty * TILE) < 4 && e.x + e.w > tx * TILE && e.x < (tx + 1) * TILE) this.defeat(e);
    }
  }

  defeat(e) {
    e.killed = true;
    this.particles.poof(e.x + e.w / 2, e.y + e.h / 2);
    Sound.play('stomp');
  }

  hurtPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.state !== 'play') return;
    if (this.arena && this.arena.inIntro) return; // safe during the boss entrance
    if (p.big) {
      p.setBig(false);
      p.invuln = 1.5;
      Sound.play('shrink');
    } else {
      this.killPlayer('hit');
    }
  }

  killPlayer(cause) {
    const p = this.player;
    if (p.state !== 'play') return;
    p.die(cause);
    this.lives--;
    this.deathT = 0;
    Sound.play('die');
  }

  afterDeath() {
    if (this.lives <= 0) {
      Sound.play('gameover');
      Game.setScene(new GameOverScene(this.levelIndex));
      return;
    }
    // respawn at the furthest checkpoint reached
    let pos = this.start;
    for (const cp of this.checkpoints) if (cp.active) pos = cp.respawnPoint();
    this.spawnPlayer(pos);
    this.player.invuln = 1;
    for (const e of this.enemies) if (!e.killed) e.reset();
    // losing a life during the boss fight resets the fight (boss back to full health)
    if (this.arena && this.arena.locked && !this.arena.won) this.arena.reset(this);
    for (const b of this.carrotBoxes) {
      const bx = b.tx * TILE;
      if (bx > pos.cx - TILE && bx < pos.cx + 14 * TILE && this.level.get(b.tx, b.ty) === 'U') this.level.set(b.tx, b.ty, 'C');
    }
    this.fireballs = [];
    this.carrots = this.carrots.filter((c) => !c.lost);
    // ground carrots ahead of the respawn point come back, so a fresh life can grow again
    for (const c of this.groundCarrots) {
      if (c.taken && c.x > pos.cx) { c.taken = false; this.carrots.push(c); }
    }
  }

  update(dt) {
    if (this.paused) {
      if (Input.pressed('pause')) { this.paused = false; return; }
      const choice = this.pauseMenu.update();
      if (choice === 0) this.paused = false;
      else if (choice === 1) { Sound.play('confirm'); Game.setScene(new PlayScene(this.levelIndex)); }
      else if (choice === 2) { Sound.play('confirm'); Game.setScene(new LevelSelectScene()); }
      return;
    }
    if (Input.pressed('pause') && this.player.state === 'play') {
      this.paused = true;
      this.pauseMenu.sel = 0;
      Sound.play('select');
      return;
    }

    this.t += dt;
    const p = this.player;
    const lvl = this.level;
    if (p.state === 'play') this.updateTimer(dt);
    lvl.update(dt, p);
    const ar = this.arena;
    p.frozen = !!(ar && ar.inIntro);
    p.push = ar && ar.state === 'fight' ? ar.wind : 0;
    p.onIce = !!(ar && ar.icy && ar.locked && p.onGround && Math.abs(p.bottom - ar.floorY) < 1 && p.cx > ar.left && p.cx < ar.right);
    p.update(dt, lvl, this);
    if (p.onGround) this.touchCrumbles(p);
    if (this.arena) this.arena.update(dt, this);
    this.updateFireballs(dt);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.shake > 0) this.shake -= dt;

    for (const e of this.enemies) {
      if (e.killed) continue;
      if (!e.active && e.shouldActivate(this.camX)) e.active = true;
      if (e.active) e.update(dt, lvl, p, this.camX);
      if (e.y > lvl.height + 64) e.killed = true;
    }
    for (const c of this.carrots) c.update(dt, lvl);
    for (const pc of this.popCoins) pc.update(dt, this.particles);
    this.popCoins = this.popCoins.filter((pc) => !pc.done);
    if (this.flag) this.flag.update(dt);
    this.particles.update(dt);

    if (p.state === 'play') this.checkCollisions();

    if (p.state === 'dead') {
      this.deathT += dt;
      if (this.deathT > 1.7) this.afterDeath();
    } else if (p.state === 'victory') {
      this.victoryT += dt;
      if (Math.floor((this.victoryT - dt) * 3) !== Math.floor(this.victoryT * 3) && this.victoryT < 2) {
        this.particles.confetti(this.flag.poleX, this.flag.flagY + 10);
      }
      if (this.victoryT > 3) this.finish();
    }

    if (p.state !== 'dead') {
      const target = this.cameraTarget();
      this.camX += (target - this.camX) * Math.min(1, dt * 10);
    }
  }

  touchCrumbles(p) {
    const ty = Math.floor((p.bottom + 1) / TILE);
    for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w - 0.01) / TILE); tx++) {
      if (this.level.get(tx, ty) === '-') {
        const c = this.level.crumbles.get(tx + ',' + ty);
        if (c && c.state === 'idle') Sound.play('crumble');
        this.level.touchCrumble(tx, ty);
      }
    }
  }

  updateTimer(dt) {
    const ev = this.timer.update(dt);
    if (ev === 'tick') Sound.play('tick');
    if (ev !== 'timeup') return;
    // Time's up: lose a life and keep going from here with extra time.
    this.banner = { text: "Time's up!", sub: `+${formatTime(EXTRA_TIME)} extra time`, t: 2.2 };
    Sound.play('timeup');
    if (this.lives <= 1) {
      this.banner.sub = '';
      this.killPlayer('time');
    } else {
      this.lives--;
    }
  }

  updateFireballs(dt) {
    const p = this.player;
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (p.canShoot && Input.pressed('fire') && this.fireCooldown <= 0 && this.fireballs.length < FIREBALL.max) {
      const hx = p.facing > 0 ? p.x + p.w + 4 : p.x - 4;
      this.fireballs.push(new Fireball(hx, p.y + p.h * 0.4, p.facing));
      this.fireCooldown = FIREBALL.cooldown;
      p.throwT = 0.18;
      Sound.play('fire');
    }
    for (const fb of this.fireballs) {
      fb.update(dt, this.level, this.camX);
      if (fb.done) continue;
      const boss = this.arena && this.arena.boss;
      if (boss && boss.alive && overlaps(fb, boss.hitbox)) {
        boss.fireballHit(this); // 3 fireball hits = 1 hit point
        fb.done = true;
      }
      for (const e of this.enemies) {
        if (fb.done) break;
        if (e.killed || !e.active || !overlaps(fb, e.hitbox)) continue;
        this.defeat(e); // fireballs defeat any enemy, spiky plants included
        this.addCoin(1);
        fb.done = true;
        break;
      }
      if (fb.done) this.particles.poof(fb.x + fb.w / 2, fb.y + fb.h / 2);
    }
    this.fireballs = this.fireballs.filter((fb) => !fb.done);
  }

  checkCollisions() {
    const p = this.player;
    for (const c of this.coinList) {
      if (!c.taken && overlaps(p, c)) {
        c.taken = true;
        this.addCoin();
        this.particles.sparkle(c.x + c.w / 2, c.y + c.h / 2, 5, '#fff3a0');
      }
    }
    for (const c of this.carrots) {
      if (!c.taken && c.ready && overlaps(p, c)) {
        c.taken = true;
        this.particles.sparkle(p.cx, p.y + p.h / 2, 16, '#ffe36e');
        if (p.big) {
          this.addCoin(10); // already big: coin bonus instead
          this.popCoins.push(new PopCoin(p.cx, p.y - 10));
        } else {
          p.setBig(true);
          Sound.play('powerup');
        }
      }
    }
    this.carrots = this.carrots.filter((c) => !c.taken);

    for (const e of this.enemies) {
      if (e.killed || !e.active) continue;
      if (!overlaps(p, e.hitbox)) continue;
      const fromAbove = p.vy > 0 && p.prevBottom <= e.y + Math.max(10, e.h * 0.5);
      if (e.stompable && fromAbove) {
        this.defeat(e);
        p.bounce();
      } else {
        this.hurtPlayer();
        if (p.state !== 'play') return;
      }
    }

    for (const cp of this.checkpoints) {
      if (!cp.active && p.cx >= cp.x) {
        cp.active = true;
        this.particles.sparkle(cp.x + 10, cp.y - 40, 12, '#b6ffb0');
        Sound.play('checkpoint');
      }
    }

    if (this.flag && this.flag.touchable && overlaps(p, this.flag)) {
      p.state = 'victory';
      p.vx = 0;
      p.facing = 1;
      p.invuln = 0;
      this.flag.raised = true;
      this.victoryT = 0;
      this.particles.sparkle(this.flag.poleX, p.y, 20, '#ffe36e');
      Sound.play('flag');
    }
  }

  finish() {
    const newBest = SaveData.recordResult(this.levelIndex, this.coins, this.timer.elapsed);
    Game.setScene(new ResultsScene(this, newBest));
  }

  renderWorld(ctx) {
    const lvl = this.level;
    const t = Game.time;
    drawBackground(ctx, lvl.themeName, this.camX, t);
    ctx.save();
    const r = Game.ratio;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    ctx.translate(-Math.round((this.camX + sx) * r) / r, -this.camY + sy);
    const vis = (x) => x > this.camX - 80 && x < this.camX + VIEW_W + 80;
    if (this.flag && this.flag.visible && vis(this.flag.poleX)) drawGoalFlag(ctx, this.flag, t);
    drawTiles(ctx, lvl, this.camX, t);
    for (const cp of this.checkpoints) if (vis(cp.x)) drawCheckpoint(ctx, cp, t);
    for (const c of this.coinList) if (!c.taken && vis(c.x)) c.draw(ctx, t);
    for (const c of this.carrots) if (vis(c.x)) c.draw(ctx, t);
    for (const e of this.enemies) {
      if (!e.killed && (vis(e.x) || e.warning)) e.draw(ctx, t, this.camX);
    }
    if (this.arena) this.arena.draw(ctx, t);
    for (const pc of this.popCoins) pc.draw(ctx, t);
    for (const fb of this.fireballs) fb.draw(ctx, t);
    this.player.draw(ctx, t);
    drawQuicksand(ctx, lvl, this.camX, t); // drawn over the player so she sinks into it
    this.particles.draw(ctx);
    ctx.restore();
  }

  render(ctx) {
    this.renderWorld(ctx);
    drawHUD(ctx, this);
    if (this.banner) {
      const k = Math.min(1, (2.2 - this.banner.t) * 6);
      ctx.save();
      ctx.translate(VIEW_W / 2, 200);
      ctx.scale(k, k);
      drawText(ctx, this.banner.text, 0, 0, 60, this.banner.color || '#ff5f6d', 'center', '#3a0a14');
      if (this.banner.sub) drawText(ctx, this.banner.sub, 0, 50, 24, '#ffffff');
      ctx.restore();
    }
    if (this.paused) {
      ctx.fillStyle = 'rgba(10, 15, 30, 0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(ctx, 'Paused', VIEW_W / 2, 140, 52, '#ffffff');
      this.pauseMenu.draw(ctx);
      drawHint(ctx, '↑ ↓ to choose  •  Enter / Click to confirm  •  P / Esc: resume');
    }
  }
}

// ---------------------------------------------------------------- results

class ResultsScene {
  constructor(play, newBest) {
    this.play = play;
    this.newBest = newBest;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.play.particles.update(dt);
    if (this.t > 0.5 && (Input.pressed('confirm') || Input.clicked())) {
      Sound.play('confirm');
      Game.setScene(new LevelSelectScene());
    }
  }

  render(ctx) {
    const p = this.play;
    p.renderWorld(ctx);
    ctx.fillStyle = 'rgba(10, 15, 30, 0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawPanel(ctx, 250, 90, 460, 360);
    drawText(ctx, 'Level complete!', VIEW_W / 2, 140, 42, '#ff8a1f', 'center', '#7a3a08');
    drawText(ctx, p.level.name, VIEW_W / 2, 185, 22, '#555a70', 'center', null);
    drawSister(ctx, p.kind, 330, 330, 3, 1, 'victory', 0, Game.time);
    drawCoin(ctx, 420, 250, 14, Game.time);
    drawText(ctx, `${p.coins} / ${p.totalCoins}`, 445, 252, 32, '#2b2d42', 'left', null);
    drawText(ctx, `Time  ${formatTime(p.timer.elapsed)}`, 420, 298, 28, '#2b2d42', 'left', null);
    if (p.timer.challenge) drawText(ctx, `Time left  ${formatTime(Math.ceil(p.timer.remaining))}`, 420, 334, 22, '#d9661a', 'left', null);
    if (this.newBest) {
      const s = 1 + Math.sin(this.t * 6) * 0.05;
      ctx.save();
      ctx.translate(VIEW_W / 2, 370);
      ctx.scale(s, s);
      drawText(ctx, 'New best!', 0, 0, 28, '#ffd23f', 'center', '#b0431f');
      ctx.restore();
    }
    if (this.t > 0.5) drawText(ctx, 'Press Enter / Click to continue', VIEW_W / 2, 418, 18, '#555a70', 'center', null);
  }
}

// ---------------------------------------------------------------- game over

class GameOverScene {
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
    this.t = 0;
    this.menu = new MenuList(['Retry level', 'Back to level select'], VIEW_W / 2, 280);
  }

  update(dt) {
    this.t += dt;
    if (this.t < 0.4) return;
    const choice = this.menu.update();
    if (choice === 0) { Sound.play('confirm'); Game.setScene(new PlayScene(this.levelIndex)); }
    else if (choice === 1) { Sound.play('confirm'); Game.setScene(new LevelSelectScene()); }
  }

  render(ctx) {
    const def = LEVELS[this.levelIndex];
    drawBackground(ctx, def.theme, 0, this.t);
    ctx.fillStyle = 'rgba(10, 15, 30, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawText(ctx, 'Game over', VIEW_W / 2, 150 + Math.sin(this.t * 2) * 4, 64, '#ff5f6d', 'center', '#3a0a14');
    drawText(ctx, def.name, VIEW_W / 2, 215, 22, '#ffffff');
    this.menu.draw(ctx);
    drawHint(ctx, '↑ ↓ to choose  •  Enter / Click to confirm');
  }
}
