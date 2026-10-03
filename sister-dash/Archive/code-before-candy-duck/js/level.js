// level.js – ASCII parsing, tile collision, box bumps, timed platforms, moving platforms,
// quicksand, water and wind

// '-' crumbling sandstone, 'g' rain cloud, '^' spring cloud, 'H' rainbow bridge,
// '&' boss arena wall (placed at runtime). '~' thin clouds are one-way (see moveY).
const SOLID = { '#': true, 'B': true, '?': true, 'C': true, 'X': true, 'U': true, '-': true, '&': true, 'g': true, '^': true, 'H': true };
const ENTITY_CHARS = 'ocfhwskFPzvtKrjpembRluy|*';
// Non-solid tiles kept in the grid: quicksand, water currents, air vents, seaweed/coral,
// thin clouds and wind zones.
const OPEN_TILES = 'q<>a%~W';
// Platforms that vanish after being stood on: shake/rain time, then gone for a while.
const TIMED = { '-': { warn: 0.5, gone: 3 }, g: { warn: 1, gone: 3 } };
const MOVER_PERIOD = 4; // seconds for a moving platform to go there and back
const WIND_PUSH = 100; // px/s from wind zones (W), blowing to the left
const SPRING_BOOST = Math.sqrt(3); // spring clouds launch about 3x as high as a normal jump

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
    const raw = (tx, ty) => (def.map[ty] && def.map[ty][tx]) || '.';
    for (let ty = 0; ty < this.rows; ty++) {
      const row = [];
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = raw(tx, ty);
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
    this.time = 0;
    // underwater levels: everything below the surface row is water
    this.underwater = !!def.underwater;
    this.surfaceY = (def.surfaceRow || 0) * TILE;
    // darker cave tunnels: [firstColumn, lastColumn] ranges
    this.dark = def.dark || [];
    this.vents = [];
    this.tiles.forEach((row, ty) => row.forEach((ch, tx) => { if (ch === 'a') this.vents.push({ tx, ty }); }));
    this.bumps = new Map();
    this.crumbles = new Map();
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = this.tiles[ty][tx];
        if (TIMED[ch]) this.crumbles.set(tx + ',' + ty, { tx, ty, ch, state: 'idle', t: 0, fall: 0 });
      }
    }
    // moving platforms: a run of 'n' (mine cart on rails) or '=' (moving cloud) is one platform
    this.movers = [];
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = raw(tx, ty);
        if ((ch !== 'n' && ch !== '=') || raw(tx - 1, ty) === ch) continue;
        let len = 1;
        while (raw(tx + len, ty) === ch) len++;
        // it travels right over the open cells after it; if blocked there, it goes up and down
        let span = 0;
        while (span < 8 && raw(tx + len + span, ty) === '.') span++;
        let vspan = 0;
        if (span === 0) {
          const clear = (y) => { for (let k = 0; k < len; k++) if (raw(tx + k, y) !== '.') return false; return true; };
          while (vspan < 5 && clear(ty - 1 - vspan)) vspan++;
        }
        this.movers.push({
          kind: ch === 'n' ? 'cart' : 'cloud',
          x0: tx * TILE, y0: ty * TILE + (ch === 'n' ? 10 : 6),
          w: len * TILE, h: ch === 'n' ? 22 : 24,
          ax: span * TILE, ay: -vspan * TILE,
          dx: 0, dy: 0,
        });
      }
    }
    this.placeMovers(0);
  }

  // Coins available in a level: placed coins, crystal coins (worth 5), coin surprise boxes and
  // cracked boxes (each hides one coin). Boss levels add the coins that burst out of the boss.
  static countCoins(def) {
    let n = def.boss ? BOSS_TYPES[def.boss].coins : 0;
    for (const row of def.map) {
      for (const ch of row) {
        if (ch === 'o' || ch === '?' || ch === 'X') n++;
        else if (ch === '*') n += CRYSTAL_VALUE;
      }
    }
    return n;
  }

  // Moving platforms follow a triangle wave of the level clock, so their positions are
  // predictable (the tests rely on this too).
  placeMovers(time) {
    const u = (((time % MOVER_PERIOD) + MOVER_PERIOD) % MOVER_PERIOD) / MOVER_PERIOD;
    const k = u < 0.5 ? u * 2 : 2 - u * 2;
    for (const m of this.movers) {
      const nx = m.x0 + m.ax * k, ny = m.y0 + m.ay * k;
      m.dx = nx - (m.x === undefined ? nx : m.x);
      m.dy = ny - (m.y === undefined ? ny : m.y);
      m.x = nx;
      m.y = ny;
    }
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
  // sandSolid: quicksand counts as solid (enemies, carrots and shots walk over it).
  isSolid(tx, ty, sandSolid = false) {
    if (tx < 0 || tx >= this.cols) return true;
    if (ty < 0 || ty >= this.rows) return false;
    const ch = this.tiles[ty][tx];
    return SOLID[ch] === true || (sandSolid && ch === 'q');
  }

  // Something to stand on: solid ground or a thin cloud.
  isFloor(tx, ty) {
    return this.isSolid(tx, ty) || this.get(tx, ty) === '~';
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

  // Moves a body vertically; returns { hit, ty, tiles, mover } where tiles are the columns hit.
  // Falling bodies also land on thin clouds (unless dropping through) and on moving platforms
  // (bodies with `rides` set).
  moveY(b, dy) {
    const res = { hit: false, ty: 0, tiles: [], mover: null };
    if (!dy) return res;
    const prevBottom = b.y + b.h;
    b.y += dy;
    const left = Math.floor(b.x / TILE);
    const right = Math.floor((b.x + b.w - 0.001) / TILE);
    const ty = dy > 0 ? Math.floor((b.y + b.h - 0.001) / TILE) : Math.floor(b.y / TILE);
    const oneWay = dy > 0 && !b.dropThrough && prevBottom <= ty * TILE + 1;
    for (let tx = left; tx <= right; tx++) {
      if (this.isSolid(tx, ty, b.sandSolid) || (oneWay && this.get(tx, ty) === '~')) { res.hit = true; res.tiles.push(tx); }
    }
    if (res.hit) {
      res.ty = ty;
      b.y = dy > 0 ? ty * TILE - b.h : (ty + 1) * TILE;
      return res;
    }
    if (dy > 0 && b.rides) {
      for (const m of this.movers) {
        if (b.x + b.w <= m.x || b.x >= m.x + m.w) continue;
        if (prevBottom <= m.y + 2 + Math.max(0, -m.dy) && b.y + b.h >= m.y) {
          b.y = m.y - b.h;
          res.hit = true;
          res.mover = m;
          return res;
        }
      }
    }
    return res;
  }

  isOnGround(b) {
    const ty = Math.floor((b.y + b.h + 1) / TILE);
    const left = Math.floor(b.x / TILE), right = Math.floor((b.x + b.w - 0.001) / TILE);
    for (let tx = left; tx <= right; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }

  // Tile directly under a standing body's feet (centre), for springs and thin clouds.
  tileUnder(b) {
    return this.get(Math.floor((b.x + b.w / 2) / TILE), Math.floor((b.y + b.h + 1) / TILE));
  }

  inWater(x, y) {
    return this.underwater && y > this.surfaceY;
  }

  // -1 / 0 / +1: water current at a point
  currentAt(x, y) {
    const ch = this.get(Math.floor(x / TILE), Math.floor(y / TILE));
    return ch === '<' ? -1 : ch === '>' ? 1 : 0;
  }

  // Wind zones push to the left (px/s) wherever the body overlaps a W tile.
  windAt(b) {
    const y0 = Math.floor(b.y / TILE), y1 = Math.floor((b.y + b.h - 0.001) / TILE);
    const tx = Math.floor((b.x + b.w / 2) / TILE);
    for (let ty = y0; ty <= y1; ty++) if (this.get(tx, ty) === 'W') return -WIND_PUSH;
    return 0;
  }

  // Air vents send up a column of bubbles 5 tiles tall.
  ventAt(b) {
    for (const v of this.vents) {
      const r = { x: v.tx * TILE - 4, y: (v.ty - 5) * TILE, w: TILE + 8, h: 6 * TILE };
      if (overlaps(b, r)) return true;
    }
    return false;
  }

  inDark(x) {
    const tx = x / TILE;
    return this.dark.some(([a, b]) => tx >= a && tx <= b + 1);
  }

  // Pixel y of the quicksand surface in the column at px, or null when (px, py) is not in quicksand.
  quicksandSurface(px, py) {
    const tx = Math.floor(px / TILE);
    let ty = Math.floor(py / TILE);
    if (this.get(tx, ty) !== 'q') return null;
    while (this.get(tx, ty - 1) === 'q') ty--;
    return ty * TILE;
  }

  // A crumbling platform or rain cloud starts its countdown when stood on.
  touchCrumble(tx, ty) {
    const c = this.crumbles.get(tx + ',' + ty);
    if (c && c.state === 'idle') { c.state = 'shaking'; c.t = TIMED[c.ch].warn; }
  }

  crumbleShake(tx, ty) {
    const c = this.crumbles.get(tx + ',' + ty);
    return c && c.state === 'shaking' && c.ch === '-' ? Math.sin(c.t * 90) * 1.8 : 0;
  }

  bump(tx, ty) {
    this.bumps.set(tx + ',' + ty, 0.16);
  }

  bumpOffset(tx, ty) {
    const t = this.bumps.get(tx + ',' + ty);
    if (t === undefined) return 0;
    return -Math.sin((1 - t / 0.16) * Math.PI) * 7;
  }

  // blocker: a rect (the player) that must be clear before a vanished platform reappears
  update(dt, blocker) {
    this.time += dt;
    this.placeMovers(this.time);
    for (const [k, t] of this.bumps) {
      if (t - dt <= 0) this.bumps.delete(k);
      else this.bumps.set(k, t - dt);
    }
    for (const c of this.crumbles.values()) {
      if (c.state === 'shaking') {
        c.t -= dt;
        if (c.t <= 0) { c.state = 'gone'; c.t = TIMED[c.ch].gone; c.fall = 0; c.vy = 0; this.set(c.tx, c.ty, '.'); }
      } else if (c.state === 'gone') {
        c.t -= dt;
        c.vy += 1400 * dt;
        c.fall += c.vy * dt;
        if (c.t <= 0) {
          const r = { x: c.tx * TILE, y: c.ty * TILE, w: TILE, h: TILE };
          if (blocker && overlaps(blocker, r)) c.t = 0.1;
          else { c.state = 'idle'; this.set(c.tx, c.ty, c.ch); }
        }
      }
    }
  }
}
