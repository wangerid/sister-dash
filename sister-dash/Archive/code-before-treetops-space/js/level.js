// level.js – ASCII parsing, tile collision, box bumps, timed platforms, moving platforms,
// quicksand, water, wind, and Cement City's roads, traffic lights, manholes and wet cement

// '-' crumbling sandstone, 'g' rain cloud, '^' spring cloud, 'H' rainbow bridge,
// '&' boss arena wall (placed at runtime), '_' road, 'Z' crosswalk, 'x' wet cement, 'O' manhole.
// '~' thin clouds are one-way (see moveY).
const SOLID = { '#': true, 'B': true, '?': true, 'C': true, 'D': true, 'X': true, 'U': true, '-': true, '&': true, 'g': true, '^': true, 'H': true, '_': true, 'Z': true, 'x': true, 'O': true };
const ENTITY_CHARS = 'ocdfhwskFPzvtKrjpembRluy|*AiNS';
// Non-solid tiles kept in the grid: quicksand, water currents, air vents, seaweed/coral,
// thin clouds and wind zones.
const OPEN_TILES = 'q<>a%~W';
// Platforms that vanish after being stood on: shake/rain time, then gone for a while.
const TIMED = { '-': { warn: 0.5, gone: 3 }, g: { warn: 1, gone: 3 } };
const MOVER_PERIOD = 4; // seconds for a moving platform to go there and back
const WIND_PUSH = 100; // px/s from wind zones (W), blowing to the left
const SPRING_BOOST = Math.sqrt(3); // spring clouds launch about 3x as high as a normal jump

// Wet cement: half speed and much lower jumps while standing in it.
const CEMENT = { speed: 0.5, jump: 0.65, sink: 6 };

// Manhole covers pop every few seconds: rest, then a steam warning, then the pop.
// Standing on one as it pops launches the player like a spring cloud.
const MANHOLE = { period: 3.4, warn: 0.7, pop: 0.45, lift: 44 };

// Pedestrian traffic lights: green, then flashing green, then red (cars drive while it's red).
const LIGHT = { green: 4, flash: 1.2, red: 3.6 };
LIGHT.period = LIGHT.green + LIGHT.flash + LIGHT.red;
const CAR_TYPES = [
  { kind: 'car', w: 72, h: 34 },
  { kind: 'bus', w: 120, h: 54 },
  { kind: 'truck', w: 104, h: 50 },
];
const CAR_SPEED = 330;

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
    // moving platforms: a run of 'n' (mine cart on rails), '=' (moving cloud) or 'G' (crane
    // girder) is one platform
    this.movers = [];
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        const ch = raw(tx, ty);
        if ((ch !== 'n' && ch !== '=' && ch !== 'G') || raw(tx - 1, ty) === ch) continue;
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
          kind: ch === 'n' ? 'cart' : ch === 'G' ? 'girder' : 'cloud',
          x0: tx * TILE, y0: ty * TILE + (ch === 'n' ? 10 : ch === 'G' ? 8 : 6),
          w: len * TILE, h: ch === 'n' ? 22 : ch === 'G' ? 16 : 24,
          ax: span * TILE, ay: -vspan * TILE,
          dx: 0, dy: 0,
        });
      }
    }
    this.placeMovers(0);
    this.findManholes();
    this.findLanes();
  }

  // Manhole covers, each popping on its own beat.
  findManholes() {
    this.manholes = [];
    this.tiles.forEach((row, ty) => row.forEach((ch, tx) => {
      if (ch === 'O') this.manholes.push({ tx, ty, offset: hash(tx * 5.3) * MANHOLE.period });
    }));
  }

  // Seconds into a manhole's cycle (the pop is the last MANHOLE.pop seconds).
  manholePhase(m, time = this.time) {
    return (((time + m.offset) % MANHOLE.period) + MANHOLE.period) % MANHOLE.period;
  }

  manholeAt(tx, ty) {
    return this.manholes.find((m) => m.tx === tx && m.ty === ty) || null;
  }

  // 'rest' | 'warn' (steam puffs, rumbling) | 'pop'
  manholeState(m, time = this.time) {
    const u = this.manholePhase(m, time);
    const popAt = MANHOLE.period - MANHOLE.pop;
    if (u >= popAt) return 'pop';
    if (u >= popAt - MANHOLE.warn) return 'warn';
    return 'rest';
  }

  // How high (px) the cover is in the air.
  manholeLift(m, time = this.time) {
    const k = (this.manholePhase(m, time) - (MANHOLE.period - MANHOLE.pop)) / MANHOLE.pop;
    return k > 0 ? Math.sin(Math.PI * k) * MANHOLE.lift : 0;
  }

  // The flying cover's rect while it's up (touching it from the side hurts), or null.
  manholeCover(m, time = this.time) {
    const lift = this.manholeLift(m, time);
    if (lift < 3) return null;
    return { x: m.tx * TILE + 2, y: m.ty * TILE - lift - 7, w: TILE - 4, h: 8 };
  }

  // Launch moment: the first part of the pop, while the cover is going up.
  manholeLaunches(tx, ty) {
    const m = this.manholeAt(tx, ty);
    if (!m) return false;
    const k = (this.manholePhase(m) - (MANHOLE.period - MANHOLE.pop)) / MANHOLE.pop;
    return k > 0 && k < 0.4;
  }

  // Road lanes: runs of '_' / 'Z' tiles. Lanes less than 4 tiles apart form one crossing with
  // one shared traffic light; each crossing has its own offset in the light cycle.
  findLanes() {
    this.lanes = [];
    this.crossings = [];
    const road = (ch) => ch === '_' || ch === 'Z';
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (!road(this.tiles[ty][tx]) || road(this.get(tx - 1, ty))) continue;
        let len = 1;
        while (road(this.get(tx + len, ty))) len++;
        this.lanes.push({ tx, ty, len, x0: tx * TILE, x1: (tx + len) * TILE, y: ty * TILE });
      }
    }
    this.lanes.sort((a, b) => a.x0 - b.x0);
    for (const lane of this.lanes) {
      let cr = this.crossings[this.crossings.length - 1];
      if (!cr || lane.tx - cr.lanes[cr.lanes.length - 1].tx - cr.lanes[cr.lanes.length - 1].len >= 4) {
        cr = { lanes: [], offset: hash(this.crossings.length * 3.7 + 1) * LIGHT.period };
        this.crossings.push(cr);
      }
      lane.crossing = cr;
      lane.dir = cr.lanes.length % 2 === 0 ? -1 : 1; // lanes alternate direction
      lane.index = this.lanes.indexOf(lane);
      cr.lanes.push(lane);
    }
    for (const cr of this.crossings) {
      cr.x0 = cr.lanes[0].x0;
      cr.x1 = cr.lanes[cr.lanes.length - 1].x1;
      cr.y = cr.lanes[0].y;
    }
  }

  // Seconds into a crossing's light cycle, and its light: 'green' | 'flash' | 'red'.
  lightPhase(cr, time = this.time) {
    return (((time + cr.offset) % LIGHT.period) + LIGHT.period) % LIGHT.period;
  }

  light(cr, time = this.time) {
    const u = this.lightPhase(cr, time);
    return u < LIGHT.green ? 'green' : u < LIGHT.green + LIGHT.flash ? 'flash' : 'red';
  }

  // Cars on a lane right now: three per red phase, entering at one end and leaving at the other.
  // Everything follows the level clock, so traffic is predictable (and testable).
  carsOn(lane, time = this.time) {
    const cars = [];
    const u = this.lightPhase(lane.crossing, time) - LIGHT.green - LIGHT.flash; // seconds into red
    if (u < 0) return cars;
    const width = lane.x1 - lane.x0;
    for (let i = 0; i < 3; i++) {
      const type = CAR_TYPES[Math.floor(hash(lane.index * 7.1 + i * 2.3 + Math.floor((time + lane.crossing.offset) / LIGHT.period) * 0.37) * 3)];
      const t0 = 0.15 + i * 1.05;
      const d = (u - t0) * CAR_SPEED; // distance driven so far (front of the car)
      if (d <= 0 || d > width + type.w) continue;
      const x = lane.dir < 0 ? lane.x1 - d : lane.x0 + d - type.w;
      cars.push({ kind: type.kind, w: type.w, h: type.h, x, y: lane.y - type.h, dir: lane.dir, lane });
    }
    return cars;
  }

  // The part of a car that is on its lane (cars appear from and disappear into the side streets).
  static carRect(car) {
    const x0 = Math.max(car.x, car.lane.x0), x1 = Math.min(car.x + car.w, car.lane.x1);
    return x1 > x0 ? { x: x0 + 2, y: car.y + 6, w: x1 - x0 - 4, h: car.h - 6 } : null;
  }

  // Wet cement under a standing body (feet centre).
  inCement(b) {
    return this.tileUnder(b) === 'x';
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
