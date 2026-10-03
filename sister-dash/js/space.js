// space.js – Starlight Station: low gravity, gravity wells, laser gates, meteor showers
// (everything follows the level clock, so it is predictable and testable)

const SPACE = {
  gravity: 0.62, // gravity multiplier with lowGravity (jumps about 1.5x higher)
  walkGravity: 0.42, // even lower in the space walk zones
  jump: 0.95, // jump speed multiplier, so the jump is ~1.5x as high
  fallMax: 0.6, // slower top falling speed
  airControl: 0.7, // weaker left/right control in the air
  boost: 1.35, // boost pads: launch speed vs a normal jump
};

const LASER = { off: 2, on: 2, flicker: 0.5 };
LASER.period = LASER.off + LASER.on;

const METEOR = { every: 1.25, warn: 1, fall: 0.6, impact: 0.18, radius: 24 };

const WELL = { radius: 128, pull: 85, core: 13 };

// Gravity multiplier at a body's position (1 outside space levels).
function gravityAt(level, b) {
  if (!level.lowGravity) return 1;
  const tx = (b.x + b.w / 2) / TILE;
  return level.spaceWalk.some(([a, z]) => tx >= a && tx <= z + 1) ? SPACE.walkGravity : SPACE.gravity;
}

// Laser gates (vertical runs of '!'), meteor shower zones (runs of 'M') and gravity wells ('&').
function findSpaceHazards(level) {
  level.lasers = [];
  level.meteorZones = [];
  for (let tx = 0; tx < level.cols; tx++) {
    for (let ty = 0; ty < level.rows; ty++) {
      if (level.get(tx, ty) !== '!' || level.get(tx, ty - 1) === '!') continue;
      let len = 1;
      while (level.get(tx, ty + len) === '!') len++;
      level.lasers.push({ tx, ty, len, offset: hash(tx * 1.7) * LASER.period, rect: { x: tx * TILE + 12, y: ty * TILE, w: 8, h: len * TILE } });
    }
  }
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = 0; tx < level.cols; tx++) {
      if (level.get(tx, ty) !== 'M' || level.get(tx - 1, ty) === 'M') continue;
      let len = 1;
      while (level.get(tx + len, ty) === 'M') len++;
      level.meteorZones.push({ x0: tx * TILE, x1: (tx + len) * TILE, top: ty * TILE, offset: hash(tx * 3.3) * METEOR.every });
    }
  }
  level.wells = level.spawns.filter((s) => s.type === '&').map((s) => ({ x: (s.tx + 0.5) * TILE, y: (s.ty + 0.5) * TILE }));
}

// 'off' | 'flicker' (about to switch on) | 'on'
function laserState(level, g, time = level.time) {
  const u = (((time + g.offset) % LASER.period) + LASER.period) % LASER.period;
  if (u >= LASER.off) return 'on';
  return u >= LASER.off - LASER.flicker ? 'flicker' : 'off';
}

// The meteors of a zone right now: each lands at a spot shown by a target mark 1 s before.
// state: 'warn' (mark only), 'fall' (in the air), 'impact' (just landed).
function meteorsIn(level, z, time = level.time) {
  const out = [];
  const k0 = Math.floor((time - z.offset - METEOR.impact) / METEOR.every);
  for (let k = k0; k <= k0 + Math.ceil(METEOR.warn / METEOR.every) + 1; k++) {
    const land = k * METEOR.every + z.offset;
    const until = land - time;
    if (until > METEOR.warn || until < -METEOR.impact) continue;
    const x = z.x0 + 20 + hash(k * 7.31 + z.x0 * 0.013) * (z.x1 - z.x0 - 40);
    let gy = level.height;
    const tx = Math.floor(x / TILE);
    for (let ty = Math.floor(z.top / TILE) + 1; ty < level.rows; ty++) if (level.isFloor(tx, ty)) { gy = ty * TILE; break; }
    const m = { x, groundY: gy, until, state: until > METEOR.fall ? 'warn' : until > 0 ? 'fall' : 'impact' };
    if (m.state === 'fall') {
      // comes in at an angle from the upper right
      const k = until / METEOR.fall;
      m.mx = x + 220 * k;
      m.my = gy - 10 - (gy - z.top) * k;
    }
    out.push(m);
  }
  return out;
}

// Does a meteor hit the rect?
function meteorHits(m, r) {
  if (m.state === 'fall') return overlaps(r, { x: m.mx - 9, y: m.my - 9, w: 18, h: 18 });
  if (m.state === 'impact') return overlaps(r, { x: m.x - METEOR.radius, y: m.groundY - METEOR.radius, w: METEOR.radius * 2, h: METEOR.radius });
  return false;
}

// Horizontal and vertical pull (px/s) of the gravity wells on a body, and whether it touches a core.
function wellPull(level, b) {
  let px = 0, py = 0, core = false;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  for (const w of level.wells || []) {
    const dx = w.x - cx, dy = w.y - cy, d = Math.hypot(dx, dy);
    if (d < WELL.core + Math.min(b.w, b.h) / 2) core = true;
    if (d > WELL.radius || d < 1) continue;
    const k = WELL.pull * (1 - d / WELL.radius);
    px += (dx / d) * k;
    py += (dy / d) * k;
  }
  return { px, py, core };
}
