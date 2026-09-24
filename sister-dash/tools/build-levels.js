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
    const plats = boss === 'bristle' ? [[a + 13, 5]] : [[a + 7, 4], [a + 20, 4]];
    for (const [c, w] of plats) for (let k = 0; k < w; k++) m.at(c + k, 4, '#');
    m.at(a + 26, 2, 'F');
    m.x += 32;
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

function build(parts) {
  const m = newMap();
  for (const p of parts) p(m);
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
  seg.platforms(2),
  seg.run(8),
  seg.checkpoint(),
  seg.run(10, [['h', 5], ['w', 7, 6]]),
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

// ---------------------------------------------------------------- Level 4: Scorching Desert (very hard)
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
  // timeLimit: seconds allowed in Time challenge mode (boss included)
  { name: 'Sunny Meadow', theme: 'meadow', timeLimit: 180, boss: 'bristle', map: level1 },
  { name: 'Whispering Forest', theme: 'forest', timeLimit: 225, boss: 'croakia', map: level2 },
  { name: 'Snowy Mountain', theme: 'snow', timeLimit: 255, boss: 'frostbeak', map: level3 },
  { name: 'Scorching Desert', theme: 'desert', timeLimit: 300, boss: 'sandclaw', map: level4 },
];
// Victory coins per boss (must match BOSS_TYPES in js/bosses.js).
const BOSS_COINS = { bristle: 20, croakia: 30, frostbeak: 40, sandclaw: 50 };
const BOSS_NAMES = { bristle: 'Big Bristle', croakia: 'Queen Croakia', frostbeak: 'Frostbeak', sandclaw: 'King Sandclaw' };

for (const l of levels) {
  const s = l.map.join('');
  const n = (ch) => [...s].filter((c) => c === ch).length;
  const w = l.map[0].length;
  const cps = [];
  l.map.forEach((r) => [...r].forEach((ch, i) => { if (ch === 'k') cps.push(`${i} (${Math.round((i / w) * 100)}%)`); }));
  // sanity check: no stretch wider than 5 columns without anything solid to land on
  let run = 0;
  for (let c = 0; c < w; c++) {
    const solid = l.map.some((r) => '#B?CXU-'.includes(r[c]));
    run = solid ? 0 : run + 1;
    if (run === 6) print(`  WARNING ${l.name}: gap wider than 5 tiles ending near column ${c}`);
  }
  print(`${l.name}: width ${w}, coins total=${n('o') + n('?') + n('X') + BOSS_COINS[l.boss]} (o=${n('o')} ?=${n('?')} X=${n('X')} boss=${BOSS_COINS[l.boss]}), carrots=${n('C') + n('c')} (C=${n('C')} c=${n('c')}), checkpoints at ${cps.join(', ')}, h=${n('h')} f=${n('f')} w=${n('w')} s=${n('s')} z=${n('z')} v=${n('v')} t=${n('t')} q=${n('q')} -=${n('-')}`);
}

function formatLimit(t) {
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

let out = `// levels.js – the three level maps (tile = 32×32 px)
// Generated by tools/build-levels.js; edit there, or edit these maps directly.
//
// Legend:
//   .  empty          #  ground         B  wooden box      ?  surprise box (coin)
//   C  surprise box (carrot)            X  cracked box (hides a coin)       o  coin
//   c  magic carrot   h  hedgehog       f  frog            w  crow
//   s  spiky plant    k  checkpoint     F  goal flag       P  player start
//   z  scorpion       v  vulture        t  tumbleweed      q  quicksand
//   -  crumbling sandstone platform     K  boss arena start (boss spawns here)
//   In the desert, s is drawn as a cactus.
//
// Every row of a map must have the same length. The bottom row is the lowest row of the world.
// timeLimit is the Time challenge limit in seconds, boss included (tune after playtesting).
// boss is the boss waiting in the arena at the end (see js/bosses.js).

const LEVELS = [\n`;
for (const l of levels) {
  out += `  {\n    name: '${l.name}',\n    theme: '${l.theme}',\n    timeLimit: ${l.timeLimit}, // ${formatLimit(l.timeLimit)}\n    boss: '${l.boss}', // ${BOSS_NAMES[l.boss]}\n    map: [\n`;
  out += l.map.map((r) => `      '${r}',`).join('\n');
  out += `\n    ],\n  },\n`;
}
out += '];\n';
writeFile(OUT, out);
