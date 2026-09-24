// level.js – ASCII parsing, tile collision, box bumps, crumbling platforms and quicksand

// '-' crumbling sandstone, 'W' boss arena wall (placed at runtime). 'q' quicksand is a tile but not solid.
const SOLID = { '#': true, 'B': true, '?': true, 'C': true, 'X': true, 'U': true, '-': true, 'W': true };
const ENTITY_CHARS = 'ocfhwskFPzvtKrjpe';
// Non-solid tiles kept in the grid: quicksand, water currents, air vents, seaweed/coral.
const OPEN_TILES = 'q<>a%';
const CRUMBLE = { shake: 0.5, gone: 3 };

class Level {
  constructor(index) {
    const def = LEVELS[index];
    this.index = index;
    this.name = def.name;
    this.themeName = def.theme;
    this.theme = THEMES[def.theme];
    this.rows = def.map.length;
    this.cols = Math.max(...def.map.map((r) => r.length));
    this.tiles = [];
    this.spawns = [];
    for (let ty = 0; ty < this.rows; ty++) {
      const row = [];
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = def.map[ty][tx] || '.';
        if (SOLID[ch] || OPEN_TILES.includes(ch)) {
          row.push(ch);
        } else {
          row.push('.');
          if (ENTITY_CHARS.includes(ch)) this.spawns.push({ type: ch, tx, ty });
        }
      }
      this.tiles.push(row);
    }
    this.width = this.cols * TILE;
    this.height = this.rows * TILE;
    // underwater levels: everything below the surface row is water
    this.underwater = !!def.underwater;
    this.surfaceY = (def.surfaceRow || 0) * TILE;
    this.vents = [];
    this.tiles.forEach((row, ty) => row.forEach((ch, tx) => { if (ch === 'a') this.vents.push({ tx, ty }); }));
    this.bumps = new Map();
    this.crumbles = new Map();
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.tiles[ty][tx] === '-') this.crumbles.set(tx + ',' + ty, { tx, ty, state: 'idle', t: 0, fall: 0 });
      }
    }
  }

  // Coins available in a level: placed coins, coin surprise boxes and cracked boxes (each hides one coin).
  // Boss levels add the coins that burst out of the defeated boss.
  static countCoins(def) {
    let n = def.boss ? BOSS_TYPES[def.boss].coins : 0;
    for (const row of def.map) for (const ch of row) if (ch === 'o' || ch === '?' || ch === 'X') n++;
    return n;
  }

  get(tx, ty) {
    if (ty < 0 || ty >= this.rows || tx < 0 || tx >= this.cols) return '.';
    return this.tiles[ty][tx];
  }

  set(tx, ty, ch) {
    if (ty < 0 || ty >= this.rows || tx < 0 || tx >= this.cols) return;
    this.tiles[ty][tx] = ch;
  }

  // Left and right map edges act as walls; above and below the map is open.
  // sandSolid: quicksand counts as solid (enemies, carrots and fireballs walk over it).
  isSolid(tx, ty, sandSolid = false) {
    if (tx < 0 || tx >= this.cols) return true;
    if (ty < 0 || ty >= this.rows) return false;
    const ch = this.tiles[ty][tx];
    return SOLID[ch] === true || (sandSolid && ch === 'q');
  }

  rectSolid(x, y, w, h) {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }

  // Moves a body {x,y,w,h} horizontally; returns true if it hit a wall.
  moveX(b, dx) {
    if (!dx) return false;
    b.x += dx;
    const top = Math.floor(b.y / TILE);
    const bottom = Math.floor((b.y + b.h - 0.001) / TILE);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - 0.001) / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (this.isSolid(tx, ty, b.sandSolid)) { b.x = tx * TILE - b.w; return true; }
      }
    } else {
      const tx = Math.floor(b.x / TILE);
      for (let ty = top; ty <= bottom; ty++) {
        if (this.isSolid(tx, ty, b.sandSolid)) { b.x = (tx + 1) * TILE; return true; }
      }
    }
    return false;
  }

  // Moves a body vertically; returns { hit, ty, tiles } where tiles are the columns that were hit.
  moveY(b, dy) {
    const res = { hit: false, ty: 0, tiles: [] };
    if (!dy) return res;
    b.y += dy;
    const left = Math.floor(b.x / TILE);
    const right = Math.floor((b.x + b.w - 0.001) / TILE);
    const ty = dy > 0 ? Math.floor((b.y + b.h - 0.001) / TILE) : Math.floor(b.y / TILE);
    for (let tx = left; tx <= right; tx++) {
      if (this.isSolid(tx, ty, b.sandSolid)) { res.hit = true; res.tiles.push(tx); }
    }
    if (res.hit) {
      res.ty = ty;
      b.y = dy > 0 ? ty * TILE - b.h : (ty + 1) * TILE;
    }
    return res;
  }

  isOnGround(b) {
    const ty = Math.floor((b.y + b.h + 1) / TILE);
    const left = Math.floor(b.x / TILE), right = Math.floor((b.x + b.w - 0.001) / TILE);
    for (let tx = left; tx <= right; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }

  inWater(x, y) {
    return this.underwater && y > this.surfaceY;
  }

  // -1 / 0 / +1: water current at a point
  currentAt(x, y) {
    const ch = this.get(Math.floor(x / TILE), Math.floor(y / TILE));
    return ch === '<' ? -1 : ch === '>' ? 1 : 0;
  }

  // Air vents send up a column of bubbles 5 tiles tall.
  ventAt(b) {
    for (const v of this.vents) {
      const r = { x: v.tx * TILE - 4, y: (v.ty - 5) * TILE, w: TILE + 8, h: 6 * TILE };
      if (overlaps(b, r)) return true;
    }
    return false;
  }

  // Pixel y of the quicksand surface in the column at px, or null when (px, py) is not in quicksand.
  quicksandSurface(px, py) {
    const tx = Math.floor(px / TILE);
    let ty = Math.floor(py / TILE);
    if (this.get(tx, ty) !== 'q') return null;
    while (this.get(tx, ty - 1) === 'q') ty--;
    return ty * TILE;
  }

  // A crumbling platform starts shaking when stood on.
  touchCrumble(tx, ty) {
    const c = this.crumbles.get(tx + ',' + ty);
    if (c && c.state === 'idle') { c.state = 'shaking'; c.t = CRUMBLE.shake; }
  }

  crumbleShake(tx, ty) {
    const c = this.crumbles.get(tx + ',' + ty);
    return c && c.state === 'shaking' ? Math.sin(c.t * 90) * 1.8 : 0;
  }

  bump(tx, ty) {
    this.bumps.set(tx + ',' + ty, 0.16);
  }

  bumpOffset(tx, ty) {
    const t = this.bumps.get(tx + ',' + ty);
    if (t === undefined) return 0;
    return -Math.sin((1 - t / 0.16) * Math.PI) * 7;
  }

  // blocker: a rect (the player) that must be clear before a fallen platform reappears
  update(dt, blocker) {
    for (const [k, t] of this.bumps) {
      if (t - dt <= 0) this.bumps.delete(k);
      else this.bumps.set(k, t - dt);
    }
    for (const c of this.crumbles.values()) {
      if (c.state === 'shaking') {
        c.t -= dt;
        if (c.t <= 0) { c.state = 'gone'; c.t = CRUMBLE.gone; c.fall = 0; c.vy = 0; this.set(c.tx, c.ty, '.'); }
      } else if (c.state === 'gone') {
        c.t -= dt;
        c.vy += 1400 * dt;
        c.fall += c.vy * dt;
        if (c.t <= 0) {
          const r = { x: c.tx * TILE, y: c.ty * TILE, w: TILE, h: TILE };
          if (blocker && overlaps(blocker, r)) c.t = 0.1;
          else { c.state = 'idle'; this.set(c.tx, c.ty, '-'); }
        }
      }
    }
  }
}
