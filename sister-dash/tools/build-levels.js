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
    // a one-tile-thick branch (treetops) or floating floor
    branch(a, b, yb) { for (let c = a; c < b; c++) m.at(c, yb, '#'); },
    // a tree trunk `w` wide from the bottom up to row `top`, with an optional hole [y0, y1] to run through
    trunk(c, top, w = 2, hole = null) {
      for (let x = c; x < c + w; x++) for (let y = 0; y <= top; y++) if (!hole || y < hole[0] || y > hole[1]) m.at(x, y, '#');
    },
    station: [], // space station corridors: [first, last] columns
    spaceWalk: [], // space walk zones (even lower gravity): [first, last] columns
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
    m.at(a + 13, 2, 'd'); // magic candy shortly after the start
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

  // Checkpoint with a carrot and a magic candy right after it.
  checkpoint: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 2, 2, 'k');
    m.at(a + 6, 2, 'c');
    m.coins(a + 8, 4, 3);
    m.at(a + 10, 2, 'd');
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

  // Secret room: cracked-box floor that only a big (or Dad) player can break from below.
  secret: (ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.stack(a + 2, 5, 3);
    m.stack(a + 8, 5, 3);
    m.row(a + 3, 4, 'XXXXX');
    m.row(a + 2, 8, 'BBBBBBB');
    m.coins(a + 3, 5, 5);
    m.coins(a + 3, 6, 5);
    m.ents(a, ents);
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

  // Checkpoint right before a boss arena, with a carrot surprise box and a candy surprise box
  // next to it (both refilled on every respawn here).
  bossCheckpoint: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 2, 2, 'k');
    m.at(a + 6, 5, 'C');
    m.at(a + 9, 5, 'D');
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
    // (Drumbeak's platforms are leaves, Fuzzmo's floating metal: drawn by the arena)
    const py = boss === 'octavia' ? 6 : boss === 'duke' ? 3 : 4; // underwater the rocks float higher; Duke's ledges are low
    const tile = boss === 'grumble' ? '~' : '#'; // Grumblecloud's arena has thin clouds to jump up onto
    for (const [c, w] of plats) for (let k = 0; k < w; k++) m.at(c + k, py, tile);
    m.at(a + 26, 2, 'F');
    m.x += 32;
  },

  // Mom bonus: a box staircase, then a 7-tile gap only her long jump can clear, to a
  // high ledge with coins. Ground runs underneath, so missing the jump costs nothing.
  momBonus: () => (m) => {
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
  // gap holds Mom bonus coins (swimmers can't climb out of the water to reach them).
  beach: () => (m) => {
    m.ground(0, 14, 12);
    m.at(3, 13, 'P');
    m.at(8, 13, 'c');
    m.coins(10, 13, 3);
    m.at(13, 13, 'd'); // magic candy at the cliff edge, shortly after the start
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

  // Checkpoint on the sea floor with a carrot and a magic candy right after it.
  checkpointW: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 2, 2, 'k');
    m.at(a + 6, 2, 'c');
    m.coins(a + 8, 5, 3);
    m.at(a + 10, 2, 'd');
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
  crystals: (ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + 14);
    m.stack(a + 3, 1);
    for (let k = 5; k <= 10; k++) m.at(a + k, 4, '#');
    m.at(a + 6, 5, '$');
    m.at(a + 9, 5, '$');
    m.ents(a, ents);
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
  spring: (ents = []) => (m) => {
    const a = m.x;
    m.ground(a, a + 16);
    m.at(a + 4, 1, '^');
    for (let k = 7; k <= 12; k++) m.at(a + k, 9, '#');
    m.coins(a + 7, 10, 6);
    m.coins(a + 8, 11, 4);
    m.ents(a, ents);
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
    for (let c = a + 3; c < a + 3 + w; c++) m.at(c, 1, 'T');
    m.coins(a + 4, 2, w - 2);
    m.ground(a + 3 + w, a + 6 + w);
    m.x += w + 6;
  },

  // ---- Treetop Heights: one-tile-thick branches high above the forest floor (falling = a life).
  // yb is the branch row; the player stands in row yb + 1.

  // Start on a wide branch next to the trunk of the first tree.
  tStart: (yb = 4) => (m) => {
    const a = m.x;
    m.trunk(a, 13);
    m.branch(a + 2, a + 16, yb);
    m.at(a + 4, yb + 1, 'P');
    m.at(a + 8, yb + 1, 'c');
    m.coins(a + 11, yb + 3, 4);
    m.at(a + 13, yb + 1, 'd'); // magic candy shortly after the start
    m.x += 16;
  },

  // A branch `n` long at row yb. ents: [ch, offset, dy] (dy rows above the standing row).
  tRun: (n, yb, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.branch(a, a + n, yb);
    m.ents(a, ents.map(([ch, off, dy = 0]) => [ch, off, yb + 1 + dy]));
    if (coins) m.coins(a + coins[0], yb + 1 + coins[1], coins[2]);
    m.x += n;
  },

  // A gap between branches, with a coin trail showing the jump (landing branch may be dyb higher).
  tGap: (w, yb) => (m) => {
    m.arc(m.x - 1, w + 2, yb + 3, 2);
    m.x += w;
  },

  // A tree trunk to run through (a hole at path height) or, with hole = false, a short stump to
  // climb over using branch stubs on its side.
  tTrunk: (yb, hole = true) => (m) => {
    const a = m.x;
    m.branch(a, a + 6, yb);
    if (hole) {
      m.trunk(a + 2, 14, 2, [yb + 1, yb + 3]);
      m.coins(a + 2, yb + 1, 2);
    } else {
      m.trunk(a + 2, yb + 3, 2);
      m.at(a + 1, yb + 2, '#'); // a branch stub to step up on
      m.coins(a + 2, yb + 5, 2);
    }
    m.x += 6;
  },

  // Bending leaf platforms across a gap: 'LL' leaves with `gap`-wide holes between them.
  tLeaves: (count, yb, gap = 3) => (m) => {
    let c = m.x;
    for (let i = 0; i < count; i++) {
      c += gap;
      m.row(c, yb, 'LL');
      m.coins(c, yb + 2, 2);
      c += 2;
    }
    m.x = c + gap;
  },

  // A gap too wide to jump, with a vine hanging from a branch above it: swing across.
  tVine: (yb) => (m) => {
    const a = m.x;
    m.branch(a + 2, a + 6, yb + 7); // the branch the vine hangs from
    m.at(a + 4, yb + 6, 'V');
    m.arc(a, 8, yb + 4, 2);
    m.x += 8;
  },

  // A swaying rope bridge across a gap.
  tBridge: (w, yb, ents = []) => (m) => {
    const a = m.x;
    m.row(a, yb, 'H'.repeat(w));
    for (let k = 1; k < w - 1; k += 2) m.coin(a + k, yb + 2);
    m.ents(a, ents.map(([ch, off, dy = 0]) => [ch, off, yb + 1 + dy]));
    m.x += w;
  },

  // A branch with another branch above it, from which pinecones drop.
  tPinecones: (n, yb, offs, ents = []) => (m) => {
    const a = m.x;
    m.branch(a, a + n, yb);
    m.branch(a + 1, a + n - 1, yb + 6);
    for (const off of offs) m.at(a + off, yb + 5, '*');
    for (let k = 2; k < n - 2; k += 2) m.coin(a + k, yb + 1);
    m.ents(a, ents.map(([ch, off, dy = 0]) => [ch, off, yb + 1 + dy]));
    m.x += n;
  },

  // A tree house with coins and a candy box inside, reached by a short ladder of branch stubs.
  tTreeHouse: (yb) => (m) => {
    const a = m.x;
    m.branch(a, a + 16, yb);
    m.branch(a + 2, a + 4, yb + 2); // ladder stubs
    m.branch(a + 5, a + 13, yb + 4); // floor
    m.at(a + 12, yb + 5, 'B'); // back wall
    m.at(a + 12, yb + 6, 'B');
    m.row(a + 5, yb + 7, 'BBC?D?BB'); // roof with a candy box, a carrot box and a coin box
    m.coins(a + 6, yb + 5, 5);
    m.x += 16;
  },

  // Checkpoint on a branch, with a carrot and a magic candy right after it.
  tCheckpoint: (yb) => (m) => {
    const a = m.x;
    m.branch(a, a + 12, yb);
    m.at(a + 2, yb + 1, 'k');
    m.at(a + 6, yb + 1, 'c');
    m.coins(a + 8, yb + 3, 3);
    m.at(a + 10, yb + 1, 'd');
    m.x += 12;
  },

  // Mom bonus in the trees: a box staircase, then a 7-tile gap only her long jump clears, to a high
  // branch with coins. The branch runs on underneath, so missing the jump costs nothing.
  tMomBonus: (yb) => (m) => {
    const a = m.x;
    m.branch(a, a + 22, yb);
    [1, 2, 3, 4, 5, 5, 5].forEach((h, i) => { for (let k = 0; k < h; k++) m.at(a + 1 + i, yb + 1 + k, 'B'); });
    m.branch(a + 15, a + 19, yb + 5);
    m.coins(a + 16, yb + 6, 2);
    m.coins(a + 15, yb + 7, 4);
    m.x += 22;
  },

  // Climb down from the treetops to the big tree's wide branch (the ground row) before the boss.
  tDescend: (yb) => (m) => {
    const a = m.x;
    m.branch(a, a + 4, yb);
    m.ground(a + 4, a + 10);
    m.coins(a + 5, 3, 4);
    m.x += 10;
  },

  // ---- Starlight Station (low gravity: jumps are about 1.5x higher and longer)

  // Moon-rock start with the landed rocket.
  sStart: () => (m) => {
    const a = m.x;
    m.ground(a, a + 18);
    m.at(a + 5, 2, 'P');
    m.at(a + 9, 2, 'c');
    m.coins(a + 11, 5, 4);
    m.at(a + 15, 2, 'd'); // magic candy shortly after the start
    m.x += 18;
  },

  // A pit (low gravity allows wider ones), with a high coin arc.
  sPit: (w, well = false) => (m) => {
    m.arc(m.x - 1, w + 2, 4, 3);
    if (well) m.at(m.x + Math.floor(w / 2), 1, '&'); // a gravity well down in the pit
    m.x += w;
  },

  // An asteroid field over a pit: asteroids '@@' at heights `ybs`, each drifting across the open
  // space to its right (spaced `gap` apart).
  sAsteroids: (ybs, gap = 7) => (m) => {
    let c = m.x + 2;
    ybs.forEach((yb) => {
      m.row(c, yb, '@@');
      m.coins(c, yb + 2, 2);
      c += gap;
    });
    m.x = c + 1;
  },

  // A space station corridor: metal floor, a low ceiling, and laser gates at `lasers` offsets.
  sCorridor: (n, lasers, ents = [], coins = true) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.ceiling(a, a + n, 6);
    for (const off of lasers) for (let y = 2; y <= 5; y++) m.at(a + off, y, '!');
    if (coins) m.coins(a + 1, 2, n - 2);
    m.ents(a, ents);
    m.station.push([a, a + n - 1]);
    m.x += n;
  },

  // A boost pad that launches the player up a cliff too tall to jump (`h` rows of moon rock).
  sBoost: (h = 8) => (m) => {
    const a = m.x;
    m.ground(a, a + 7);
    m.at(a + 4, 1, 'I');
    m.ground(a + 7, a + 15, 1 + h);
    m.coins(a + 4, 4, 1);
    m.coins(a + 4, 7, 1);
    m.coins(a + 8, 2 + h, 6);
    m.ground(a + 15, a + 18, 1 + h);
    m.x += 18;
  },

  // A stretch of moon under a meteor shower: target marks show where each meteor lands.
  sMeteors: (n, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.row(a + 2, 13, 'M'.repeat(n - 4));
    if (coins) m.coins(a + coins[0], coins[1], coins[2]);
    m.ents(a, ents);
    m.x += n;
  },

  // Moon ground with enemies and a coin row.
  sRun: (n, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    m.ents(a, ents);
    if (coins) m.coins(a + coins[0], coins[1], coins[2]);
    m.x += n;
  },

  // A space walk zone (even lower gravity, a star-shaped border): wide gaps between floating rocks.
  sSpaceWalk: (parts) => (m) => {
    const a = m.x;
    for (const p of parts) p(m);
    m.spaceWalk.push([a, m.x - 1]);
  },

  // Mom bonus in space: low gravity stretches everyone's jumps, so her gap is 10 tiles wide and the
  // ledge is 8 rows up (too high to jump to from the ground underneath).
  sMomBonus: () => (m) => {
    const a = m.x;
    m.ground(a, a + 29);
    [1, 2, 3, 4, 5, 6, 7, 8, 8].forEach((h, i) => m.stack(a + 1 + i, h));
    for (let k = 0; k < 4; k++) m.at(a + 20 + k, 9, '#');
    m.coins(a + 21, 10, 2);
    m.coins(a + 20, 11, 4);
    m.x += 29;
  },

  // Hidden: a boost pad next to a floating ledge high up, with a magic candy on it.
  sSecret: () => (m) => {
    const a = m.x;
    m.ground(a, a + 14);
    m.at(a + 3, 1, 'I');
    for (let k = 6; k <= 10; k++) m.at(a + k, 11, '#');
    m.at(a + 8, 12, 'd');
    m.coins(a + 6, 13, 2);
    m.coins(a + 9, 13, 2);
    m.x += 14;
  },

  // ---- Cement City (the street is the top of yb 1; roads and crosswalks sit in that row)

  // Pavement with a pedestrian crossing: `lanes` road lanes, each `laneW` tiles ('_' road at both
  // ends around 'Z' zebra stripes), with 2-tile traffic islands between them. All lanes of one
  // crossing share one traffic light; cars drive along a lane only while it is red.
  crossing: (lanes, laneW = 5, ents = [], pre = 6, post = 5) => (m) => {
    const a = m.x;
    const end = a + pre + lanes * laneW + (lanes - 1) * 2 + post;
    m.ground(a, end);
    let c = a + pre;
    for (let i = 0; i < lanes; i++) {
      m.at(c, 1, '_');
      for (let k = 1; k < laneW - 1; k++) m.at(c + k, 1, 'Z');
      m.at(c + laneW - 1, 1, '_');
      m.coins(c + 1, 2, laneW - 2);
      c += laneW + 2;
    }
    m.ents(a, ents);
    m.x = end;
  },

  // A patch of wet cement `pw` wide in `n` tiles of pavement, with coins at walking height across it
  // (so collecting them means wading through).
  cement: (n, pw, ents = [], off = 4) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (let c = a + off; c < a + off + pw; c++) m.at(c, 1, 'x');
    m.coins(a + off + 1, 2, pw - 2);
    m.ents(a, ents);
    m.x += n;
  },

  // Manhole covers in `n` tiles of pavement (they pop up every few seconds).
  manholes: (n, offs, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (const off of offs) m.at(a + off, 1, 'O');
    if (coins) m.coins(a + coins[0], coins[1], coins[2]);
    m.ents(a, ents);
    m.x += n;
  },

  // Hidden: a candy box high above a manhole. Only riding the popping cover up reaches it.
  manholeSecret: () => (m) => {
    const a = m.x;
    m.ground(a, a + 12);
    m.at(a + 6, 1, 'O');
    m.at(a + 6, 8, 'D');
    m.coins(a + 5, 6, 3);
    m.x += 12;
  },

  // Scaffolding over the pavement: cement bags hang at yb 6 and drop when the player walks under.
  scaffold: (n, bags, ents = [], coins = null) => (m) => {
    const a = m.x;
    m.ground(a, a + n);
    for (const off of bags) m.at(a + off, 6, 'A');
    if (coins) m.coins(a + coins[0], coins[1], coins[2]);
    m.ents(a, ents);
    m.x += n;
  },

  // A building-site pit (falling in costs a life) crossed on a 3-wide crane girder that swings
  // 8 tiles to the right and back. The pit is 11 columns wide.
  girderPit: (ents = [], yb = 3) => (m) => {
    const a = m.x;
    m.row(a, yb, 'GGG');
    m.arc(a + 2, 8, yb + 2, 1);
    m.ents(a, ents);
    m.x += 11;
  },

  // A crane girder blocked by a building wall: it lifts the player 5 tiles up to the roof (h 5).
  girderLift: () => (m) => {
    const a = m.x;
    m.ground(a, a + 4);
    m.row(a + 4, 2, 'GGG');
    m.coins(a + 1, 2, 3);
    m.x += 7;
  },

  // Rooftops: [height, width, gapAfter, ents] per building; ents [ch, offset, dy] stand on the roof.
  // The gaps between buildings are open alleys (falling in costs a life), with a coin arc over each.
  roofs: (list) => (m) => {
    let c = m.x;
    for (const [h, w, gap, ents = []] of list) {
      m.ground(c, c + w, 1 + h);
      m.ents(c, ents.map(([ch, off, dy = 0]) => [ch, off, 2 + h + dy]));
      c += w;
      if (gap) m.arc(c - 1, gap + 2, 3 + h, 2);
      c += gap;
    }
    m.x = c;
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
  if (extra) { extra.dark = m.dark; extra.station = m.station; extra.spaceWalk = m.spaceWalk; }
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
  seg.momBonus(),
  // hidden magic candy: a candy box above the high ledge
  seg.high([['D', 8, 9]]),
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
  C(9, seg.run(14, [['m', 8]])),
  C(10, seg.slope()),
  C(10, seg.checkpoint()),
  seg.dark(C(8, seg.run(20, [['m', 14]], [2, 3, 6]), [['b', 8], ['|', 12]])),
  C(9, seg.run(3)),
  C(9, seg.cartPit(8)),
  C(9, seg.run(12, [['m', 4], ['m', 9]])),
  C(8, seg.boxes('?B?', 9)),
  seg.dark(C(8, seg.run(16, [['m', 10]]), [['b', 5], ['|', 12]])),
  C(9, seg.pit(2)),
  // hidden magic candy: in the crystal side pocket
  C(9, seg.crystals([['d', 7, 5]])),
  C(12, seg.momBonus()),
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

// ---------------------------------------------------------------- Level 5: Cloud Kingdom (medium–harder)
const clouds = build([
  seg.start(),
  seg.run(10, [['l', 7, 5]]),
  seg.pit(3),
  seg.thin(),
  seg.run(8, [['y', 5]]),
  seg.rainClouds(3),
  // w/u at yb 3 fly at head height: duck under them
  seg.run(10, [['u', 6, 7], ['u', 9, 3]]),
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
  // hidden magic candy: up on the spring cloud's high cloud
  seg.spring([['d', 12, 11]]),
  seg.pit(3),
  seg.momBonus(),
  seg.checkpoint(),
  seg.boxes('?C?', 9),
  seg.rainClouds(4),
  seg.lift(),
  seg.run(8, [['l', 5, 6], ['u', 7, 3]]),
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
  // w/u at yb 3 fly at head height: duck under them
  seg.run(8, [['w', 4, 6], ['w', 7, 3]]),
  seg.stairs([2, 2, 3, 3], 2, 3, false),
  seg.pit(4),
  seg.boxes('B?B?B', 11, false, [['f', 8]]),
  seg.plateau(2, 10, [['f', 5]], false),
  seg.run(6),
  seg.checkpoint(),
  seg.run(10, [['f', 6], ['w', 8, 6]]),
  seg.momBonus(),
  seg.floaters([['f', 10]]),
  seg.pit(4),
  seg.stairs([1, 2, 3, 4, 4], 2, 3, false),
  seg.run(10, [['f', 4], ['f', 8]]),
  seg.boxes('?B?C?', 11, false),
  seg.platforms(3),
  seg.run(10, [['w', 5, 6]]),
  // hidden magic candy: a candy box above the high ledge
  seg.high([['D', 8, 9]]),
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
  seg.run(10, [['w', 5, 6], ['w', 9, 3]]),
  seg.bossCheckpoint(),
  seg.arena('croakia'),
]);

// ---------------------------------------------------------------- Level 6: Snowy Mountain (harder)
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
  seg.run(10, [['h', 3], ['w', 7, 6], ['w', 9, 3]]),
  seg.momBonus(),
  seg.high([['f', 10]]),
  seg.pit(4),
  seg.spikes(),
  // hidden magic candy: a candy box high above the box row (jump up from the boxes)
  seg.boxes('B?C?B', 11, false, [['h', 7], ['D', 4, 8]]),
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
  // w/u at yb 3 fly at head height: duck under them
  seg.run(10, [['w', 5, 6], ['w', 9, 3]]),
  seg.bossCheckpoint(),
  seg.arena('frostbeak'),
]);

// ---------------------------------------------------------------- Level 7: Coral Reef (underwater)
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
  // hidden magic candy: high above the tallest rock pillar
  seg.rocks(16, [[3, 4], [9, 5], [13, 3]], [['j', 6, 8], ['d', 9, 10]]),
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

// ---------------------------------------------------------------- Level 9: Scorching Desert (very hard)
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
  seg.momBonus(),
  seg.pit(5),
  seg.run(3),
  seg.crumbles(4, 3, 4),
  // hidden magic candy: a candy box above the high ledge
  seg.high([['v', 8, 11], ['D', 9, 9]]),
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

// ---------------------------------------------------------------- Level 4: Treetop Heights (medium+)
const treesInfo = {};
const trees = build([
  seg.tStart(4),
  seg.tRun(8, 4, [['Q', 5]]),
  seg.tGap(3, 4),
  seg.tRun(10, 4, [['E', 4]], [2, 2, 5]),
  seg.tTrunk(4),
  seg.tRun(6, 4),
  seg.tGap(3, 4),
  // a bee hive in the row above her head: its bees fly at head height (duck under them)
  seg.tRun(8, 6, [['Y', 4, 1]]),
  seg.tBridge(10, 6, [['Q', 5]]),
  seg.tRun(6, 6),
  seg.tLeaves(3, 5),
  seg.tRun(8, 5, [['E', 5]]),
  seg.tCheckpoint(5),
  seg.tPinecones(14, 5, [4, 8, 11]),
  seg.tGap(3, 5),
  seg.tRun(6, 5),
  seg.tVine(5),
  seg.tRun(8, 5, [['Q', 5]]),
  seg.tTrunk(5, false),
  seg.tRun(6, 5),
  seg.tMomBonus(5),
  seg.tGap(3, 5),
  // hidden magic candy: in the tree house's roof
  seg.tTreeHouse(5),
  seg.tGap(3, 5),
  seg.tRun(8, 5, [['Y', 4, 4]]),
  seg.tBridge(12, 5, [['E', 6]]),
  seg.tRun(6, 5),
  seg.tLeaves(2, 4),
  seg.tRun(6, 4),
  seg.tCheckpoint(4),
  seg.tVine(4),
  seg.tRun(8, 4, [['Q', 4]]),
  seg.tPinecones(12, 4, [3, 7, 9], [['E', 10]]),
  seg.tGap(3, 4),
  seg.tRun(6, 6, [['Y', 3, 1]]),
  seg.tTrunk(6),
  seg.tLeaves(3, 6),
  seg.tRun(8, 6, [['Q', 4]]),
  seg.tBridge(10, 6),
  seg.tRun(6, 6),
  seg.tVine(6),
  seg.tRun(8, 6, [['E', 4]]),
  seg.tGap(3, 6),
  seg.tRun(6, 4),
  seg.tDescend(4),
  seg.bossCheckpoint(),
  seg.arena('drumbeak'),
], treesInfo);

// ---------------------------------------------------------------- Level 8: Starlight Station (space, hard+)
const spaceInfo = {};
const space = build([
  seg.sStart(),
  seg.sRun(8, [['J', 5]]),
  seg.sPit(5),
  seg.sRun(10, [['U', 5, 8]], [2, 4, 5]),
  seg.sCorridor(16, [5, 11]),
  seg.sRun(6),
  seg.sAsteroids([3, 4, 3], 7),
  seg.sRun(8, [['+', 4, 5]]),
  seg.sMeteors(18, [['J', 9]], [4, 4, 8]),
  seg.sPit(6, true),
  seg.sRun(4),
  seg.checkpoint(),
  seg.boxes('?C?', 9),
  seg.sBoost(),
  seg.sRun(5),
  seg.sCorridor(20, [4, 10, 16], [['J', 7]]),
  seg.sMomBonus(),
  seg.sRun(8, [['U', 3, 8]]),
  // a space walk outside the station: even lower gravity (kept away from Mom's bonus ledge)
  seg.sSpaceWalk([seg.sRun(4), seg.sAsteroids([4, 5, 4, 6], 8), seg.sRun(4)]),
  // hidden magic candy: up on a floating ledge only the boost pad reaches
  seg.sSecret(),
  seg.sPit(5, true),
  seg.sRun(8, [['J', 4]]),
  seg.checkpoint(),
  seg.sCorridor(18, [5, 12], [['+', 9, 3]]),
  seg.sMeteors(20, [['U', 10, 9]], [3, 4, 10]),
  seg.sAsteroids([3, 5, 4], 7),
  seg.sRun(8, [['J', 5]]),
  seg.sPit(6),
  seg.sRun(6, [['+', 3, 5]]),
  seg.sSpaceWalk([seg.sAsteroids([5, 3, 6], 8)]),
  seg.sRun(8, [['U', 4, 8]]),
  seg.sCorridor(14, [4, 9]),
  seg.bossCheckpoint(),
  seg.arena('fuzzmo'),
], spaceInfo);

// ---------------------------------------------------------------- Level 10: Cement City (extremely hard)
const city = build([
  seg.start(),
  seg.run(8, [['N', 6]]),
  seg.crossing(1),
  // pigeons sit on lamp posts (i in the air) and flutter down at the player
  seg.run(10, [['i', 5, 6], ['N', 8]], [2, 4, 3]),
  seg.cement(12, 5),
  seg.boxes('?B?', 9, false, [['i', 6, 7]]),
  // a shopping cart rolls between a crate and the kerb while the player waits for green
  seg.crossing(2, 5, [['B', 0], ['S', 3]], 7),
  seg.manholes(14, [4, 9], [['N', 12]], [3, 5, 8]),
  seg.scaffold(14, [5, 10], [], [2, 2, 3]),
  seg.girderPit([['i', 6, 9]]),
  seg.run(6),
  seg.crossing(1, 6, [['N', 2]]),
  seg.cement(12, 4, [['i', 9, 6]]),
  seg.run(8, [['S', 4]]),
  seg.checkpoint(),
  seg.crossing(3),
  seg.cement(14, 6, [['N', 12]]),
  seg.momBonus(),
  seg.run(6, [['i', 3, 7]]),
  seg.scaffold(14, [4, 9], [['N', 12]], [1, 4, 3]),
  // hidden magic candy: a candy box high above a manhole
  seg.manholeSecret(),
  seg.crossing(2, 5, [['B', 0], ['S', 3], ['i', 18, 6]], 7),
  seg.manholes(12, [3, 8], [], [2, 5, 6]),
  seg.scaffold(12, [4, 8], [['N', 10]], [1, 4, 3]),
  seg.girderPit([['i', 5, 9]]),
  seg.run(4),
  seg.crossing(1, 6, [['i', 3, 6]]),
  seg.run(4),
  seg.checkpoint(),
  seg.crossing(3, 5, [['B', 0], ['S', 3]], 7),
  // rooftop run: the last third of the level is on the roofs
  seg.girderLift(),
  seg.roofs([
    [5, 10, 4, [['B', 6], ['N', 3]]],
    [5, 9, 4, [['i', 4, 3]]],
    [6, 10, 5, [['B', 3], ['B', 7], ['B', 7, 1]]],
    [6, 8, 4, [['N', 5]]],
    [5, 11, 5, [['B', 4], ['i', 8, 3]]],
    [4, 10, 4, [['S', 4], ['B', 8]]],
    [5, 9, 5, [['i', 5, 3]]],
    [6, 12, 4, [['B', 3], ['B', 4], ['B', 4, 1], ['N', 9]]],
    [5, 10, 4, [['i', 6, 3]]],
    [6, 9, 5, [['B', 5], ['N', 2]]],
    [5, 12, 0, [['S', 5], ['i', 9, 3]]],
  ]),
  seg.run(8, [['N', 5]]),
  seg.bossCheckpoint(),
  seg.arena('brutus'),
]);

const levels = [
  // timeLimit: seconds allowed in Time challenge mode (boss included). Ordered easiest to hardest.
  { name: 'Sunny Meadow', theme: 'meadow', timeLimit: 180, boss: 'bristle', map: level1 },
  { name: 'Crystal Caves', theme: 'caves', timeLimit: 210, boss: 'duke', dark: cavesInfo.dark, map: caves },
  { name: 'Whispering Forest', theme: 'forest', timeLimit: 225, boss: 'croakia', map: level2 },
  { name: 'Treetop Heights', theme: 'trees', timeLimit: 240, boss: 'drumbeak', map: trees },
  { name: 'Cloud Kingdom', theme: 'clouds', timeLimit: 250, boss: 'grumble', map: clouds },
  { name: 'Snowy Mountain', theme: 'snow', timeLimit: 255, boss: 'frostbeak', map: level3 },
  { name: 'Coral Reef', theme: 'reef', timeLimit: 285, boss: 'octavia', underwater: true, surfaceRow: 4, map: reef },
  { name: 'Starlight Station', theme: 'space', timeLimit: 300, boss: 'fuzzmo', lowGravity: true, station: spaceInfo.station, spaceWalk: spaceInfo.spaceWalk, map: space },
  { name: 'Scorching Desert', theme: 'desert', timeLimit: 315, boss: 'sandclaw', map: level4 },
  { name: 'Cement City', theme: 'city', timeLimit: 330, boss: 'brutus', map: city },
];
// Victory coins per boss (must match BOSS_TYPES in js/bosses.js).
const BOSS_COINS = { bristle: 20, duke: 25, croakia: 30, drumbeak: 32, grumble: 35, frostbeak: 40, octavia: 45, fuzzmo: 50, sandclaw: 55, brutus: 60 };
const BOSS_NAMES = { bristle: 'Big Bristle', duke: 'Digger Duke', croakia: 'Queen Croakia', drumbeak: 'Drumbeak', grumble: 'Grumblecloud', frostbeak: 'Frostbeak', octavia: 'Admiral Octavia', fuzzmo: 'Fuzzmo', sandclaw: 'King Sandclaw', brutus: 'Brutus Block' };

// Candy positions as % of the level width.
function candyAt(map) {
  const xs = [];
  map.forEach((r) => [...r].forEach((ch, i) => { if (ch === 'd' || ch === 'D') xs.push(i); }));
  return xs.sort((p, q) => p - q).map((i) => `${Math.round((i / map[0].length) * 100)}%`);
}

for (const l of levels) {
  const s = l.map.join('');
  const n = (ch) => [...s].filter((c) => c === ch).length;
  const w = l.map[0].length;
  const cps = [];
  l.map.forEach((r) => [...r].forEach((ch, i) => { if (ch === 'k') cps.push(`${i} (${Math.round((i / w) * 100)}%)`); }));
  // sanity check: no stretch wider than 5 columns (8 in low gravity) without anything solid to land on
  // (moving platforms count over the 8 open cells they travel across)
  const moverCols = new Set();
  l.map.forEach((r) => [...r].forEach((ch, i) => {
    if ('n=G@'.includes(ch)) for (let k = 0; k <= 8 && (k === 0 || r[i + k] === '.'); k++) moverCols.add(i + k);
  }));
  let run = 0;
  for (let c = 0; c < w; c++) {
    const solid = moverCols.has(c) || l.map.some((r) => '#B?CDX-g^T~n=_ZxOGHLI@'.includes(r[c]));
    run = solid ? 0 : run + 1;
    if (run === (l.lowGravity ? 9 : 6)) print(`  WARNING ${l.name}: gap wider than 5 tiles ending near column ${c}`);
  }
  if (l.underwater) {
    const vents = [];
    l.map.forEach((r) => [...r].forEach((ch, i) => { if (ch === 'a') vents.push(i); }));
    const gaps = vents.map((v, i) => v - (i ? vents[i - 1] : 14));
    print(`  ${l.name} vents at ${vents.join(', ')}; biggest gap ${Math.max(...gaps)} tiles`);
  }
  print(`${l.name}: width ${w}, coins total=${n('o') + n('?') + n('X') + 5 * n('$') + BOSS_COINS[l.boss]} (o=${n('o')} ?=${n('?')} X=${n('X')} crystal=${n('$')} boss=${BOSS_COINS[l.boss]}), carrots=${n('C') + n('c')} (C=${n('C')} c=${n('c')}), candies=${n('D') + n('d')} at ${candyAt(l.map).join(' ')}, checkpoints at ${cps.join(', ')}, enemies h=${n('h')} f=${n('f')} w=${n('w')} s=${n('s')} m=${n('m')} b=${n('b')} R=${n('R')} |=${n('|')} l=${n('l')} u=${n('u')} y=${n('y')} z=${n('z')} v=${n('v')} t=${n('t')} r=${n('r')} j=${n('j')} p=${n('p')} e=${n('e')} Q=${n('Q')} E=${n('E')} Y=${n('Y')} *=${n('*')} V=${n('V')} J=${n('J')} U=${n('U')} +=${n('+')} &=${n('&')} !=${n('!')} i=${n('i')} N=${n('N')} S=${n('S')} A=${n('A')} O=${n('O')} lanes=${(s.match(/_Z+_/g) || []).length}`);
}

function formatLimit(t) {
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

let out = `// levels.js – the ten level maps, easiest to hardest (tile = 32×32 px)
// Generated by tools/build-levels.js; edit there, or edit these maps directly.
//
// Legend:
//   .  empty          #  ground         B  wooden box      ?  surprise box (coin)
//   C  surprise box (carrot)            X  cracked box (hides a coin)       o  coin
//   D  surprise box (magic candy)       d  magic candy
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
//   $  crystal coin (worth 5)           T  rainbow bridge (solid)
//   -  crumbling sandstone platform     K  boss arena start (boss spawns here)
//   L  leaf platform (bends down)       V  hanging vine (swing on it)
//   H  rope bridge (one-way, sways)     *  pinecone drop spot
//   Q  squirrel       E  caterpillar    Y  bee hive (bees fly around it)
//   @  floating asteroid (drifting platform)                !  laser gate
//   I  boost pad      M  meteor shower zone                 &  gravity well
//   J  blob alien     U  mini UFO       +  space urchin
//   _  road (cars drive here)           Z  crosswalk with pedestrian traffic light
//   x  wet cement     O  manhole cover  G  crane girder (moving platform)
//   A  falling cement bag               i  city pigeon
//   N  hopping traffic cone             S  runaway shopping cart
//   In Crystal Caves # is cave rock, in Cloud Kingdom # is a solid white cloud,
//   in the desert s is drawn as a cactus, and in Cement City # is grey pavement and cement
//   (buildings above street level) and B is a cement block or crate.
//   A road lane is a run of _ and Z in the street row; lanes less than 4 tiles apart share one
//   traffic light.
//   Crows (w) and sky gulls (u) placed in the row just above where the player stands fly at head
//   height, so she can duck under them.
//   Moving platforms (a run of n, =, G or @) travel right over the open cells after them; if blocked
//   there they move up and down instead.
//
// Every row of a map must have the same length. The bottom row is the lowest row of the world.
// timeLimit is the Time challenge limit in seconds, boss included (tune after playtesting).
// boss is the boss waiting in the arena at the end (see js/bosses.js).

const LEVELS = [\n`;
for (const l of levels) {
  out += `  {\n    name: '${l.name}',\n    theme: '${l.theme}',\n    timeLimit: ${l.timeLimit}, // ${formatLimit(l.timeLimit)}\n    boss: '${l.boss}', // ${BOSS_NAMES[l.boss]}\n${l.dark && l.dark.length ? `    dark: ${JSON.stringify(l.dark)}, // darker tunnels: [first, last] columns\n` : ''}${l.underwater ? `    underwater: true, // swimming rules (see js/swimming.js)\n    surfaceRow: ${l.surfaceRow}, // water surface: the player can't swim above this row\n` : ''}${l.lowGravity ? `    lowGravity: true, // space rules (see js/space.js)\n    station: ${JSON.stringify(l.station)}, // space station corridors: [first, last] columns\n    spaceWalk: ${JSON.stringify(l.spaceWalk)}, // space walk zones (even lower gravity)\n` : ''}    map: [\n`;
  out += l.map.map((r) => `      '${r}',`).join('\n');
  out += `\n    ],\n  },\n`;
}
out += '];\n';
writeFile(OUT, out);
