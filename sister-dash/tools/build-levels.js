// Builds js/levels.js by chaining reusable level segments left to right.
// yb = row counted from the bottom (0 = lowest row); the ground surface is the top of yb 1,
// so things standing on the ground sit at yb 2.
//
// Run from the project root with macOS's built-in JavaScriptCore shell:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tools/build-levels.js
// Note: this overwrites js/levels.js, so hand edits made there are lost.
const OUT = 'js/levels.js';
const H = 17;
const MAX_W = 800;

function newMap() {
  const g = Array.from({ length: H }, () => Array(MAX_W).fill('.'));
  const m = {
    x: 0, // cursor: first free column
    dark: [], // [first, last] column ranges of darker cave tunnels
    get(c, yb) { return g[H - 1 - yb][c]; },
    at(c, yb, ch) { g[H - 1 - yb][c] = ch; },
    coin(c, yb) { if (m.get(c, yb) === '.') m.at(c, yb, 'o'); },
    coins(c, yb, n) { for (let i = 0; i < n; i++) m.coin(c + i, yb); },
    ground(a, b, top = 1) { for (let c = a; c < b; c++) for (let y = 0; y <= top; y++) m.at(c, y, '#'); },
    row(c, yb, s) { [...s].forEach((ch, i) => { if (ch !== ' ') m.at(c + i, yb, ch); }); },
    stack(c, h, base = 1, ch = 'B') { for (let i = 0; i < h; i++) m.at(c, base + 1 + i, ch); },
    // coin arc over `len` columns starting at c
    arc(c, len, base = 3, amp = 2) {
      for (let i = 0; i < len; i++) m.coin(c + i, base + Math.round(amp * Math.sin((Math.PI * (i + 1)) / (len + 1))));
    },
    ents(a, list) { for (const [ch, off, yb = 2] of list) m.at(a + off, yb, ch); },
    // solid rock from row yb up to the top of the map (cave ceilings)
    ceiling(a, b, yb) { for (let c = a; c < b; c++) for (let y = yb; y < H; y++) m.at(c, y, '#'); },
    out() { return g.map((r) => r.slice(0, m.x).join('')); },
  };
  return m;
}

// ---------------------------------------------------------------- segments
// Each segment is a function (m) that draws from m.x and advances m.x.

const seg = {
  // Start area with a magic carrot close by.
  start: () => (m) => {
    const a = m.x;
    m.ground(a, a + 16);
    m.at(a + 3, 2, 'P');
    m.at(a + 8, 2, 'c');
    m.coins(a + 11, 4, 4);
    m.x += 16;
  },

  // Flat ground with optional enemies [[ch, offset, yb?]] and a coin row [offset, yb, count].
  run: (n, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.ents(a, ents);
    if (coins) m.coins(a + coins[0], coins[1], coins[2]);
    m.x += n;
  },

  // A pit `w` tiles wide with a coin arc over the jump.
  pit: (w) => (m) => {
    m.arc(m.x - 1, w + 2);
    m.x += w;
  },

  // Box row at yb 5 (e.g. '?B?C?'), optionally with a coin trail underneath.
  boxes: (pat, n, under = true, ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.row(a + 2, 5, pat);
    if (under) m.coins(a + 2, 2, pat.length);
    m.ents(a, ents);
    m.x += n;
  },

  // Box staircase with a coin trail one tile above every step.
  stairs: (hs, pre = 2, post = 3, trail = true) => (m) => {
    const a = m.x;
    const n = pre + hs.length + post;
    m.ground(a, a + n);
    hs.forEach((h, i) => {
      m.stack(a + pre + i, h);
      if (trail) m.coin(a + pre + i, 2 + h);
    });
    m.x += n;
  },

  // Raised ground `dh` tiles high and `len` wide, coins on top.
  plateau: (dh, len, ents = [], coins = true) => (m) => {
    const a = m.x;
    m.ground(a, a + 3);
    m.ground(a + 3, a + 3 + len, 1 + dh);
    m.ground(a + 3 + len, a + 6 + len);
    if (coins) m.coins(a + 4, 2 + dh, len - 2);
    m.ents(a, ents.map(([ch, off]) => [ch, off, 2 + dh]));
    m.x += len + 6;
  },

  // Pit with `count` floating platforms (each `pw` wide, gaps `gap` wide).
  platforms: (count, pw = 2, gap = 2, yb = 3) => (m) => {
    let c = m.x;
    for (let i = 0; i < count; i++) {
      m.arc(c, gap, yb + 1, 1);
      c += gap;
      for (let k = 0; k < pw; k++) m.at(c + k, yb, '#');
      m.coins(c, yb + 1, pw);
      c += pw;
    }
    m.arc(c, gap, yb + 1, 1);
    m.x = c + gap;
  },

  // Stairs up to a high floating ledge holding a bonus coin cluster.
  high: (ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + 16);
    [1, 2, 3].forEach((h, i) => { m.stack(a + 2 + i, h); m.coin(a + 2 + i, 2 + h); });
    for (let k = 0; k < 4; k++) m.at(a + 7 + k, 6, '#');
    m.coins(a + 7, 7, 4);
    m.coins(a + 7, 8, 4);
    m.ents(a, ents);
    m.x += 16;
  },

  // Climb of floating platforms at rising heights.
  floaters: (ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + 20);
    for (let k = 0; k < 4; k++) m.at(a + 3 + k, 4, '#');
    for (let k = 0; k < 4; k++) m.at(a + 9 + k, 6, '#');
    for (let k = 0; k < 3; k++) m.at(a + 15 + k, 8, '#');
    m.coins(a + 3, 5, 4);
    m.coins(a + 9, 7, 4);
    m.coins(a + 15, 9, 3);
    m.coins(a + 15, 10, 3);
    m.ents(a, ents);
    m.x += 20;
  },

  // Checkpoint with a carrot right after it.
  checkpoint: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 2, 2, 'k');
    m.at(a + 6, 2, 'c');
    m.coins(a + 8, 4, 3);
    m.x += 12;
  },

  // Two spiky plants with coin arcs showing the jump over each.
  spikes: () => (m) => {
    const a = m.x;
    m.ground(a, a + 14);
    m.at(a + 4, 2, 's');
    m.at(a + 10, 2, 's');
    m.arc(a + 3, 3, 4, 1);
    m.arc(a + 9, 3, 4, 1);
    m.x += 14;
  },

  // Secret room: cracked-box floor that only a big (or grown-up) player can break from below.
  secret: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.stack(a + 2, 5, 3);
    m.stack(a + 8, 5, 3);
    m.row(a + 3, 4, 'XXXXX');
    m.row(a + 2, 8, 'BBBBBBB');
    m.coins(a + 3, 5, 5);
    m.coins(a + 3, 6, 5);
    m.x += 12;
  },

  // Quicksand pool `pw` wide (two tiles deep) inside `n` tiles of ground, with a coin arc over it.
  sand: (n, pw, ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (let c = a + 4; c < a + 4 + pw; c++) { m.at(c, 0, 'q'); m.at(c, 1, 'q'); }
    m.arc(a + 3, pw + 2);
    m.ents(a, ents);
    m.x += n;
  },

  // Pit crossed on `count` crumbling platforms (2 wide) separated by `gap`-wide holes.
  crumbles: (count, gap = 3, yb = 3) => (m) => {
    let c = m.x;
    for (let i = 0; i < count; i++) {
      c += gap;
      m.row(c, yb, '--');
      m.coins(c, yb + 1, 2);
      c += 2;
    }
    m.x = c + gap;
  },

  // Narrow floating ledge between two pits (good spot for scorpions with a vulture overhead).
  ledge: (w, ents = []) => (m) => {
    const a = m.x;
    for (let k = 0; k < w; k++) m.at(a + 3 + k, 3, '#');
    m.coins(a + 4, 4, w - 2);
    m.ents(a, ents);
    m.x += w + 6;
  },

  // Checkpoint right before a boss arena, with a carrot surprise box next to it.
  bossCheckpoint: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 2, 2, 'k');
    m.at(a + 6, 5, 'C');
    m.coins(a + 8, 4, 3);
    m.x += 12;
  },

  // Boss arena: K marks the left wall; the goal flag rises after the fight.
  // Platform layout depends on the boss (one low platform for Big Bristle, two for the others).
  arena: (boss) => (m) => {
    const a = m.x;
    m.ground(a, a + 32);
    m.at(a + 1, 2, 'K');
    const plats = boss === 'bristle' ? [[a + 13, 5]] : boss === 'duke' ? [[a + 6, 3], [a + 21, 3]] : [[a + 7, 4], [a + 20, 4]];
    const py = boss === 'octavia' ? 6 : boss === 'duke' ? 3 : 4; // underwater the rocks float higher; Duke's ledges are low
    const tile = boss === 'grumble' ? '~' : '#'; // Grumblecloud's arena has thin clouds to jump up onto
    for (const [c, w] of plats) for (let k = 0; k < w; k++) m.at(c + k, py, tile);
    m.at(a + 26, 2, 'F');
    m.x += 32;
  },

  // Fire Woman bonus: a box staircase, then a 7-tile gap only her long jump can clear, to a
  // high ledge with coins. Ground runs underneath, so missing the jump costs nothing.
  fwBonus: () => (m) => {
    const a = m.x;
    m.ground(a, a + 22);
    [1, 2, 3, 4, 5, 5, 5].forEach((h, i) => m.stack(a + 1 + i, h));
    for (let k = 0; k < 4; k++) m.at(a + 15 + k, 6, '#');
    m.coins(a + 16, 7, 2);
    m.coins(a + 15, 8, 4);
    m.x += 22;
  },

  // ---- Coral Reef (underwater). Surface row 4 = yb 12; water fills yb 2..12 above the sea floor.

  // Beach at the start: the player dives off the cliff. A ledge at the surface across a 7-tile
  // gap holds Fire Woman bonus coins (swimmers can't climb out of the water to reach them).
  beach: () => (m) => {
    m.ground(0, 14, 12);
    m.at(3, 13, 'P');
    m.at(8, 13, 'c');
    m.coins(10, 13, 3);
    m.ground(14, 30);
    for (let c = 21; c <= 26; c++) m.at(c, 12, '#');
    m.coins(21, 14, 6);
    m.coins(16, 8, 4);
    m.x = 30;
  },

  // Open water over the sea floor. ents: [ch, offset, yb].
  sea: (n, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.ents(a, ents);
    if (coins) m.coins(a + coins[0], coins[1], coins[2]);
    m.x += n;
  },

  // Rock pillars rising from the sea floor, with coins over each one.
  rocks: (n, pillars, ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (const [off, h] of pillars) { m.stack(a + off, h, 1, '#'); m.coin(a + off, 3 + h); }
    m.ents(a, ents);
    m.x += n;
  },

  // Narrow coral tunnel: rock below and above, a 4-tile passage, often with jellyfish in it.
  tunnel: (n, ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (let c = a; c < a + n; c++) {
      for (let y = 2; y <= 4; y++) m.at(c, y, '#');
      for (let y = 9; y <= 12; y++) m.at(c, y, '#');
    }
    for (let c = a + 1; c < a + n - 1; c += 3) m.at(c, 5, '%');
    m.coins(a + 2, 7, n - 4);
    m.ents(a, ents);
    m.x += n;
  },

  // A water current (dir +1 pushes right, -1 pushes left) across the middle of the water.
  current: (n, dir, ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (let c = a + 1; c < a + n - 1; c++) for (let y = 5; y <= 9; y++) m.at(c, y, dir > 0 ? '>' : '<');
    m.coins(a + 3, 7, n - 6);
    m.ents(a, ents);
    m.x += n;
  },

  // An air bubble vent on the sea floor, with seaweed around it.
  vent: (n = 8) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.at(a + Math.floor(n / 2), 2, 'a');
    m.at(a + 1, 2, '%');
    m.at(a + n - 2, 2, '%');
    m.x += n;
  },

  // Surprise boxes floating mid-water (hit them by swimming up into them).
  boxesW: (pat, n, ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.row(a + 2, 7, pat);
    m.coins(a + 2, 4, pat.length);
    m.ents(a, ents);
    m.x += n;
  },

  // Sunken ship: a wooden hull with a low, 4-tile passage inside, pillars to weave around,
  // and eels hiding in holes beside them.
  ship: (n) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (let c = a; c < a + n; c++) {
      m.at(c, 2, 'B');
      for (let y = 7; y <= 12; y++) m.at(c, y, 'B');
    }
    for (let off = 6; off < n - 4; off += 6) {
      if ((off / 6) % 2 === 1) { m.at(a + off, 3, 'B'); m.at(a + off - 1, 3, 'e'); }
      else m.at(a + off, 6, 'B');
    }
    m.coins(a + 2, 5, n - 4);
    m.x += n;
  },

  // Checkpoint on the sea floor with a carrot right after it.
  checkpointW: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 2, 2, 'k');
    m.at(a + 6, 2, 'c');
    m.coins(a + 8, 5, 3);
    m.x += 12;
  },

  // ---- Crystal Caves

  // Wraps any segment in a cave: rock ceiling from row `ceil` up. top: things hanging just under
  // the ceiling, [ch, offset] (cave bats 'b', loose stalactites '|').
  cave: (ceil, part, top = []) => (m) => {
    const a = m.x;
    part(m);
    m.ceiling(a, m.x, ceil);
    for (const [ch, off] of top) m.at(a + off, ceil - 1, ch);
  },

  // Marks the wrapped segment as a darker tunnel (a circle of light around the player).
  dark: (part) => (m) => {
    const a = m.x;
    part(m);
    m.dark.push([a, m.x - 1]);
  },

  // A pit crossed on a mine cart that rolls back and forth on rails.
  cartPit: (w) => (m) => {
    const a = m.x;
    m.row(a, 1, 'nn');
    m.arc(a - 1, w + 2, 4, 1);
    m.x += w;
  },

  // Steps up to a ledge where a rolling rock waits; it rumbles and rolls down toward the player.
  slope: (ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + 3);
    m.ground(a + 3, a + 6, 2);
    m.ground(a + 6, a + 9, 3);
    m.ground(a + 9, a + 18, 4);
    m.at(a + 16, 5, 'R');
    m.coins(a + 10, 6, 5);
    m.ents(a, ents);
    m.x += 18;
  },

  // A side pocket above the tunnel with crystal coins (worth 5), reached from a box step.
  crystals: () => (m) => {
    const a = m.x;
    m.ground(a, a + 14);
    m.stack(a + 3, 1);
    for (let k = 5; k <= 10; k++) m.at(a + k, 4, '#');
    m.at(a + 6, 5, '*');
    m.at(a + 9, 5, '*');
    m.x += 14;
  },

  // ---- Cloud Kingdom (pits are open sky: falling off the clouds costs a life)

  // Thin clouds you can jump up through, stepping up and down across a gap.
  thin: () => (m) => {
    const a = m.x;
    m.ground(a, a + 2);
    for (const [off, yb] of [[3, 3], [7, 5], [11, 3]]) { m.row(a + off, yb, '~~~'); m.coins(a + off, yb + 1, 3); }
    m.ground(a + 15, a + 17);
    m.x += 17;
  },

  // Rain clouds (grey) that start raining 1 s after you land, then vanish for 3 s.
  rainClouds: (count) => (m) => {
    let c = m.x;
    for (let i = 0; i < count; i++) {
      c += 2;
      m.row(c, 1, 'gg');
      m.coins(c, 2, 2);
      c += 2;
    }
    m.x = c + 2;
  },

  // A spring cloud that launches you up to a high cloud with coins (optional).
  spring: () => (m) => {
    const a = m.x;
    m.ground(a, a + 16);
    m.at(a + 4, 1, '^');
    for (let k = 7; k <= 12; k++) m.at(a + k, 9, '#');
    m.coins(a + 7, 10, 6);
    m.coins(a + 8, 11, 4);
    m.x += 16;
  },

  // A cloud that drifts back and forth across a gap.
  drift: (w) => (m) => {
    const a = m.x;
    m.row(a, 1, '===');
    m.arc(a - 1, w + 2, 4, 1);
    m.x += w;
  },

  // A cloud lift: blocked on the right by a tall cloud, so it goes up and down instead.
  lift: () => (m) => {
    const a = m.x;
    m.ground(a, a + 5);
    m.row(a + 5, 2, '===');
    m.ground(a + 8, a + 18, 6);
    m.coins(a + 10, 7, 6);
    m.ground(a + 18, a + 22);
    m.x += 22;
  },

  // A gap to jump against the wind: W tiles push to the left.
  wind: () => (m) => {
    const a = m.x;
    m.ground(a, a + 5);
    m.ground(a + 8, a + 14);
    for (let c = a + 3; c < a + 11; c++) for (let y = 2; y <= 8; y++) m.at(c, y, 'W');
    m.coins(a + 5, 4, 3);
    m.x += 14;
  },

  // A rainbow bridge: a long solid platform over a wide gap, with coins along the top.
  rainbow: (w) => (m) => {
    const a = m.x;
    m.ground(a, a + 3);
    for (let c = a + 3; c < a + 3 + w; c++) m.at(c, 1, 'H');
    m.coins(a + 4, 2, w - 2);
    m.ground(a + 3 + w, a + 6 + w);
    m.x += w + 6;
  },

  // Final staircase and the goal flag.
  finish: (top = 4) => (m) => {
    const a = m.x;
    m.ground(a, a + 28);
    const hs = [];
    for (let h = 1; h <= top; h++) hs.push(h);
    hs.push(top);
    hs.forEach((h, i) => { m.stack(a + 4 + i, h); m.coin(a + 4 + i, 2 + h); });
    m.coins(a + 12, 2, 4);
    m.at(a + 20, 2, 'F');
    m.x += 28;
  },
};

function build(parts, extra) {
  const m = newMap();
  for (const p of parts) p(m);
  if (extra) extra.dark = m.dark;
  return m.out();
}

// ---------------------------------------------------------------- Level 1: Sunny Meadow (easy)
const level1 = build([
  seg.start(),
  seg.run(10, [['h', 6]]),
  seg.boxes('?B?B?', 11, false),
  seg.pit(2),
  seg.run(8),
  seg.stairs([1, 2], 2, 4),
  seg.pit(2),
  seg.plateau(2, 10, [['h', 6]]),
  seg.run(10, [['h', 5]]),
  seg.boxes('B???B', 11, false),
  seg.pit(3),
  seg.run(6),
  seg.checkpoint(),
  seg.run(10, [['h', 6]]),
  seg.fwBonus(),
  seg.high(),
  seg.pit(3),
  seg.boxes('?B?', 9, false),
  seg.stairs([1, 2, 3, 3, 2, 1], 2, 3),
  seg.run(12, [['h', 4], ['h', 9]]),
  seg.pit(2),
  seg.plateau(3, 12, [['h', 6]], false),
  seg.run(8),
  seg.boxes('?B?B?', 11, false),
  seg.checkpoint(),
  seg.run(10, [['h', 6]]),
  seg.pit(3),
  seg.boxes('?B?B?', 11, false, [['h', 8]]),
  seg.stairs([1, 2, 3], 2, 3, false),
  seg.pit(2),
  seg.high(),
  seg.run(10, [['h', 5]]),
  seg.pit(3),
  seg.run(10),
  seg.bossCheckpoint(),
  seg.arena('bristle'),
]);

// ---------------------------------------------------------------- Crystal Caves (easy–medium)
const C = seg.cave;
const cavesInfo = {};
const caves = build([
  C(10, seg.start()),
  C(9, seg.run(12, [['m', 7]]), [['|', 4]]),
  C(9, seg.boxes('?B?', 9)),
  C(9, seg.pit(2)),
  C(8, seg.run(10, [], [2, 4, 5]), [['b', 5]]),
  C(6, seg.run(14, [], [2, 3, 4]), [['|', 6], ['|', 10]]),
  C(9, seg.run(3)),
  C(9, seg.cartPit(7)),
  C(9, seg.run(10, [['m', 5]])),
  C(9, seg.crystals()),
  C(10, seg.slope()),
  C(10, seg.checkpoint()),
  seg.dark(C(8, seg.run(20, [['m', 14]], [2, 3, 6]), [['b', 8], ['|', 12]])),
  C(9, seg.run(3)),
  C(9, seg.cartPit(8)),
  C(9, seg.run(12, [['m', 4], ['m', 9]])),
  C(8, seg.boxes('?B?', 9)),
  seg.dark(C(8, seg.run(16, [['m', 10]]), [['b', 5], ['|', 12]])),
  C(9, seg.pit(2)),
  C(9, seg.run(10, [['m', 5]])),
  C(12, seg.fwBonus()),
  C(10, seg.checkpoint()),
  C(9, seg.boxes('?C?', 9)),
  C(9, seg.pit(3)),
  C(8, seg.run(12, [], [3, 4, 6]), [['b', 4], ['|', 8]]),
  C(10, seg.slope([['m', 1]])),
  C(9, seg.crystals()),
  C(9, seg.run(10, [['m', 6]])),
  seg.dark(C(8, seg.run(14, [], [2, 3, 4]), [['b', 6], ['|', 10]])),
  C(10, seg.bossCheckpoint()),
  C(12, seg.arena('duke')),
], cavesInfo);

// ---------------------------------------------------------------- Cloud Kingdom (medium–harder)
const clouds = build([
  seg.start(),
  seg.run(10, [['l', 7, 5]]),
  seg.pit(3),
  seg.thin(),
  seg.run(8, [['y', 5]]),
  seg.rainClouds(3),
  seg.run(10, [['u', 6, 7]]),
  seg.spring(),
  seg.pit(2),
  seg.drift(8),
  seg.run(8, [['l', 5, 6], ['y', 6]]),
  seg.checkpoint(),
  seg.wind(),
  seg.rainbow(10),
  seg.thin(),
  seg.run(10, [['u', 5, 6], ['y', 7]]),
  seg.thin(),
  seg.run(8, [['l', 5, 6]]),
  seg.spring(),
  seg.pit(3),
  seg.fwBonus(),
  seg.checkpoint(),
  seg.boxes('?C?', 9),
  seg.rainClouds(4),
  seg.lift(),
  seg.run(8, [['l', 5, 6]]),
  seg.pit(3),
  seg.wind(),
  seg.rainbow(12),
  seg.drift(8),
  seg.run(10, [['y', 6], ['u', 4, 7]]),
  seg.bossCheckpoint(),
  seg.arena('grumble'),
]);

// ---------------------------------------------------------------- Level 2: Whispering Forest (medium)
const level2 = build([
  seg.start(),
  seg.run(10, [['f', 6]]),
  seg.stairs([1, 2, 3, 2, 1], 2, 3, false),
  seg.pit(3),
  seg.boxes('???', 9, false, [['w', 4, 6]]),
  seg.run(10, [['f', 5]]),
  seg.platforms(2),
  seg.run(8, [['w', 4, 6]]),
  seg.stairs([2, 2, 3, 3], 2, 3, false),
  seg.pit(4),
  seg.boxes('B?B?B', 11, false, [['f', 8]]),
  seg.plateau(2, 10, [['f', 5]], false),
  seg.run(6),
  seg.checkpoint(),
  seg.run(10, [['f', 6], ['w', 8, 6]]),
  seg.fwBonus(),
  seg.floaters([['f', 10]]),
  seg.pit(4),
  seg.stairs([1, 2, 3, 4, 4], 2, 3, false),
  seg.run(10, [['f', 4], ['f', 8]]),
  seg.boxes('?B?C?', 11, false),
  seg.platforms(3),
  seg.run(10, [['w', 5, 6]]),
  seg.high(),
  seg.pit(4),
  seg.run(4),
  seg.checkpoint(),
  seg.run(10, [['f', 6]]),
  seg.stairs([2, 2, 2], 2, 3, false),
  seg.pit(4),
  seg.run(4),
  seg.platforms(2),
  seg.boxes('?B?B?', 11, false, [['f', 7]]),
  seg.run(10, [['w', 5, 6], ['f', 8]]),
  seg.plateau(3, 12, [['f', 6]]),
  seg.pit(3),
  seg.high(),
  seg.run(4),
  seg.run(10, [['w', 5, 6]]),
  seg.bossCheckpoint(),
  seg.arena('croakia'),
]);

// ---------------------------------------------------------------- Level 3: Snowy Mountain (harder)
const level3 = build([
  seg.start(),
  seg.run(10, [['s', 6]]),
  seg.boxes('?C?', 9, false, [['h', 6]]),
  seg.pit(4),
  seg.stairs([1, 2, 3, 4, 5, 5, 3, 2], 2, 4, false),
  seg.run(12, [['s', 4], ['w', 8, 6], ['h', 10]]),
  seg.secret(),
  seg.pit(4),
  seg.run(10, [['f', 5], ['s', 8]]),
  seg.boxes('?B?B?', 11, false, [['h', 6]]),
  seg.spikes(),
  seg.stairs([1, 2, 3, 4, 5, 6, 6, 3], 2, 4, false),
  seg.pit(4),
  seg.run(8),
  seg.checkpoint(),
  seg.run(10, [['h', 5], ['w', 7, 6]]),
  seg.fwBonus(),
  seg.high([['f', 10]]),
  seg.pit(4),
  seg.spikes(),
  seg.boxes('B?C?B', 11, false, [['h', 7]]),
  seg.stairs([1, 2, 3, 4, 5, 5], 2, 4, false),
  seg.pit(4),
  seg.run(10, [['f', 4], ['w', 6, 6], ['s', 8]]),
  seg.platforms(3),
  seg.plateau(3, 14, [['h', 6], ['s', 11]], false),
  seg.pit(4),
  seg.high([['h', 12]]),
  seg.run(4),
  seg.checkpoint(),
  seg.run(10, [['f', 6]]),
  seg.spikes(),
  seg.high([['h', 10]]),
  seg.boxes('???', 9, false, [['w', 4, 6]]),
  seg.pit(4),
  seg.stairs([1, 2, 3, 4, 5, 6, 6], 2, 3, false),
  seg.pit(4),
  seg.run(10, [['h', 3], ['f', 6], ['s', 8]]),
  seg.platforms(2),
  seg.boxes('?B?B?', 11, false, [['f', 7]]),
  seg.spikes(),
  seg.run(10, [['w', 5, 6]]),
  seg.bossCheckpoint(),
  seg.arena('frostbeak'),
]);

// ---------------------------------------------------------------- Level 4: Coral Reef (underwater)
const reef = build([
  seg.beach(),
  seg.sea(14, [['r', 8, 2]], [3, 6, 6]),
  seg.vent(),
  seg.rocks(18, [[3, 3], [8, 4], [13, 2]], [['p', 10, 8]]),
  seg.sea(12, [['p', 6, 7]], [2, 9, 6]),
  seg.vent(),
  seg.current(20, 1),
  seg.boxesW('?C?', 9),
  seg.tunnel(22, [['j', 7, 7], ['j', 15, 6]]),
  seg.vent(),
  seg.sea(8, [['r', 4, 2]]),
  seg.checkpointW(),
  seg.sea(12, [['r', 5, 2], ['r', 9, 2]], [2, 5, 6]),
  seg.current(18, -1),
  seg.rocks(16, [[3, 4], [9, 5], [13, 3]], [['j', 6, 8]]),
  seg.vent(),
  seg.ship(30),
  seg.sea(10, [['p', 5, 8]], [2, 7, 5]),
  seg.vent(),
  seg.tunnel(22, [['j', 6, 6], ['j', 12, 7], ['j', 18, 6]]),
  seg.current(16, 1),
  seg.vent(),
  seg.boxesW('?B?', 9, [['r', 5, 2]]),
  seg.checkpointW(),
  seg.sea(12, [['r', 6, 2], ['p', 8, 7]], [2, 6, 6]),
  seg.vent(),
  seg.rocks(18, [[3, 5], [8, 3], [13, 5]], [['j', 5, 9], ['j', 11, 7]]),
  seg.current(18, -1, [['p', 9, 7]]),
  seg.vent(),
  seg.tunnel(20, [['j', 6, 7], ['j', 14, 6]]),
  seg.sea(14, [['r', 5, 2], ['r', 10, 2]], [2, 8, 8]),
  seg.vent(),
  seg.bossCheckpoint(),
  seg.arena('octavia'),
]);

// ---------------------------------------------------------------- Level 5: Scorching Desert (very hard)
const level4 = build([
  seg.start(),
  seg.run(10, [['z', 7]]),
  seg.pit(4),
  seg.sand(12, 3),
  seg.boxes('?B?B?', 11, false, [['s', 8]]),
  seg.pit(5),
  seg.run(12, [['z', 4], ['v', 8, 11]]),
  seg.crumbles(3),
  seg.stairs([1, 2, 3, 4], 2, 4),
  seg.run(14, [['t', 12]]),
  seg.pit(5),
  seg.run(4),
  seg.ledge(6, [['z', 5], ['v', 6, 11]]),
  seg.run(8, [['s', 4]]),
  seg.sand(12, 4),
  seg.spikes(),
  seg.checkpoint(),
  seg.run(10, [['z', 5], ['z', 8]]),
  seg.fwBonus(),
  seg.pit(5),
  seg.run(3),
  seg.crumbles(4, 3, 4),
  seg.high([['v', 8, 11]]),
  seg.sand(14, 4, [['z', 11]]),
  seg.stairs([1, 2, 3, 4, 5, 5], 2, 4, false),
  seg.run(14, [['t', 13]]),
  seg.pit(5),
  seg.run(4),
  seg.ledge(6, [['z', 4], ['z', 7], ['v', 6, 11]]),
  seg.boxes('?B?', 9, false, [['s', 6]]),
  seg.pit(4),
  seg.high([['v', 10, 12]]),
  seg.run(4),
  seg.run(8, [['z', 5]]),
  seg.checkpoint(),
  seg.run(10, [['s', 5]]),
  seg.pit(5),
  seg.run(3),
  seg.crumbles(3),
  seg.sand(12, 4),
  seg.spikes(),
  seg.run(12, [['t', 11], ['z', 5]]),
  seg.stairs([1, 2, 3, 4, 5, 5], 2, 4, false),
  seg.pit(5),
  seg.run(4),
  seg.ledge(6, [['z', 5], ['v', 6, 11]]),
  seg.run(10, [['z', 4], ['v', 6, 11]]),
  seg.pit(5),
  seg.run(3),
  seg.crumbles(3),
  seg.run(10, [['s', 6]]),
  seg.bossCheckpoint(),
  seg.arena('sandclaw'),
]);

const levels = [
  // timeLimit: seconds allowed in Time challenge mode (boss included). Ordered easiest to hardest.
  { name: 'Sunny Meadow', theme: 'meadow', timeLimit: 180, boss: 'bristle', map: level1 },
  { name: 'Crystal Caves', theme: 'caves', timeLimit: 210, boss: 'duke', dark: cavesInfo.dark, map: caves },
  { name: 'Whispering Forest', theme: 'forest', timeLimit: 225, boss: 'croakia', map: level2 },
  { name: 'Cloud Kingdom', theme: 'clouds', timeLimit: 240, boss: 'grumble', map: clouds },
  { name: 'Snowy Mountain', theme: 'snow', timeLimit: 255, boss: 'frostbeak', map: level3 },
  { name: 'Coral Reef', theme: 'reef', timeLimit: 285, boss: 'octavia', underwater: true, surfaceRow: 4, map: reef },
  { name: 'Scorching Desert', theme: 'desert', timeLimit: 300, boss: 'sandclaw', map: level4 },
];
// Victory coins per boss (must match BOSS_TYPES in js/bosses.js).
const BOSS_COINS = { bristle: 20, duke: 25, croakia: 30, grumble: 35, frostbeak: 40, octavia: 45, sandclaw: 50 };
const BOSS_NAMES = { bristle: 'Big Bristle', duke: 'Digger Duke', croakia: 'Queen Croakia', grumble: 'Grumblecloud', frostbeak: 'Frostbeak', octavia: 'Admiral Octavia', sandclaw: 'King Sandclaw' };

for (const l of levels) {
  const s = l.map.join('');
  const n = (ch) => [...s].filter((c) => c === ch).length;
  const w = l.map[0].length;
  const cps = [];
  l.map.forEach((r) => [...r].forEach((ch, i) => { if (ch === 'k') cps.push(`${i} (${Math.round((i / w) * 100)}%)`); }));
  // sanity check: no stretch wider than 5 columns without anything solid to land on
  let run = 0;
  for (let c = 0; c < w; c++) {
    const solid = l.map.some((r) => '#B?CXU-g^H~n='.includes(r[c]));
    run = solid ? 0 : run + 1;
    if (run === 6) print(`  WARNING ${l.name}: gap wider than 5 tiles ending near column ${c}`);
  }
  if (l.underwater) {
    const vents = [];
    l.map.forEach((r) => [...r].forEach((ch, i) => { if (ch === 'a') vents.push(i); }));
    const gaps = vents.map((v, i) => v - (i ? vents[i - 1] : 14));
    print(`  ${l.name} vents at ${vents.join(', ')}; biggest gap ${Math.max(...gaps)} tiles`);
  }
  print(`${l.name}: width ${w}, coins total=${n('o') + n('?') + n('X') + 5 * n('*') + BOSS_COINS[l.boss]} (o=${n('o')} ?=${n('?')} X=${n('X')} crystal=${n('*')} boss=${BOSS_COINS[l.boss]}), carrots=${n('C') + n('c')} (C=${n('C')} c=${n('c')}), checkpoints at ${cps.join(', ')}, enemies h=${n('h')} f=${n('f')} w=${n('w')} s=${n('s')} m=${n('m')} b=${n('b')} R=${n('R')} |=${n('|')} l=${n('l')} u=${n('u')} y=${n('y')} z=${n('z')} v=${n('v')} t=${n('t')} r=${n('r')} j=${n('j')} p=${n('p')} e=${n('e')}`);
}

function formatLimit(t) {
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

let out = `// levels.js – the seven level maps, easiest to hardest (tile = 32×32 px)
// Generated by tools/build-levels.js; edit there, or edit these maps directly.
//
// Legend:
//   .  empty          #  ground         B  wooden box      ?  surprise box (coin)
//   C  surprise box (carrot)            X  cracked box (hides a coin)       o  coin
//   c  magic carrot   h  hedgehog       f  frog            w  crow
//   s  spiky plant    k  checkpoint     F  goal flag       P  player start
//   z  scorpion       v  vulture        t  tumbleweed      q  quicksand
//   r  crab           j  jellyfish      p  pufferfish      e  eel hole
//   a  air bubble vent                  <  water current (pushes left)
//   >  water current (pushes right)     %  seaweed / coral (decoration)
//   m  mole hole      b  cave bat       R  rolling rock start
//   |  loose stalactite (falls)         n  mine cart platform (moves on rails)
//   ~  thin cloud (one-way)             g  rain cloud (vanishes)
//   ^  spring cloud   =  moving cloud   W  wind zone (blows left)
//   l  cloudling      u  sky gull       y  spark
//   *  crystal coin (worth 5)           H  rainbow bridge (solid)
//   -  crumbling sandstone platform     K  boss arena start (boss spawns here)
//   In Crystal Caves # is cave rock, in Cloud Kingdom # is a solid white cloud,
//   and in the desert s is drawn as a cactus.
//   Moving platforms (a run of n or =) travel right over the open cells after them; if blocked
//   there they move up and down instead.
//
// Every row of a map must have the same length. The bottom row is the lowest row of the world.
// timeLimit is the Time challenge limit in seconds, boss included (tune after playtesting).
// boss is the boss waiting in the arena at the end (see js/bosses.js).

const LEVELS = [\n`;
for (const l of levels) {
  out += `  {\n    name: '${l.name}',\n    theme: '${l.theme}',\n    timeLimit: ${l.timeLimit}, // ${formatLimit(l.timeLimit)}\n    boss: '${l.boss}', // ${BOSS_NAMES[l.boss]}\n${l.dark && l.dark.length ? `    dark: ${JSON.stringify(l.dark)}, // darker tunnels: [first, last] columns\n` : ''}${l.underwater ? `    underwater: true, // swimming rules (see js/swimming.js)\n    surfaceRow: ${l.surfaceRow}, // water surface: the player can't swim above this row\n` : ''}    map: [\n`;
  out += l.map.map((r) => `      '${r}',`).join('\n');
  out += `\n    ],\n  },\n`;
}
out += '];\n';
writeFile(OUT, out);
