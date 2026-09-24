// Headless tests for Sister Dash: scene smoke tests plus a physics-based check that every level
// can be finished with all four characters, small and big, plus Time challenge and fireball checks.
//
// Run from the project root with macOS's built-in JavaScriptCore shell:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tools/test.js
var window = { addEventListener() {}, innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 };
var performance = { now: () => Date.now() };
var localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } };
var ROOT = 'js/';
['input', 'audio', 'storage', 'render', 'levels', 'level', 'entities', 'enemies', 'fireballs', 'timer', 'boss', 'bosses', 'player', 'scenes', 'main'].forEach((f) => load(ROOT + f + '.js'));

// ---- mock canvas context
function mockCtx() {
  const target = { createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), measureText: (s) => ({ width: String(s).length * 7 }) };
  return new Proxy(target, {
    get(t, k) { if (k in t) return t[k]; return function () {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

// ---- scriptable input
const keys = { held: new Set(), pressed: new Set() };
Input.isDown = (a) => keys.held.has(a);
Input.pressed = (a) => keys.pressed.has(a);
Input.clicked = () => null;
Input.endStep = () => keys.pressed.clear();

let failures = 0;
function check(cond, msg) { if (!cond) { failures++; print('FAIL: ' + msg); } }

// ---- smoke test: every scene updates and renders
Game.canvas = { style: {} };
Game.ratio = 1;
const ctx = mockCtx();
function step(n, render = true) {
  for (let i = 0; i < n; i++) {
    Game.time += STEP;
    Game.scene.update(STEP);
    Input.endStep();
    if (render && i % 5 === 0) Game.scene.render(ctx);
  }
}
try {
  Game.setScene(new TitleScene()); step(30);
  keys.pressed.add('confirm'); step(1);
  check(Game.scene instanceof CharacterSelectScene, 'title -> character select');
  keys.pressed.add('right'); step(1); keys.pressed.add('confirm'); step(1);
  check(Game.character === 'younger', 'picked younger sister');
  check(Game.scene instanceof LevelSelectScene, 'char select -> level select');
  step(20);
  for (let li = 0; li < LEVELS.length; li++) {
    for (const kind of ['older', 'younger', 'grownup', 'firegirl']) {
      Game.character = kind;
      Game.setScene(new PlayScene(li));
      const ps = Game.scene;
      // run right, jumping a lot, for 40 s of game time
      keys.held.add('right');
      for (let f = 0; f < 2400 && Game.scene === ps; f++) {
        if (f % 40 === 0) keys.pressed.add('jump');
        if (f % 40 < 25) keys.held.add('jump'); else keys.held.delete('jump');
        step(1, f % 7 === 0);
      }
      keys.held.clear();
      // pause menu
      if (Game.scene === ps && ps.player.state === 'play') {
        keys.pressed.add('pause'); step(1);
        check(ps.paused, 'pause opens');
        step(5);
        keys.pressed.add('pause'); step(1);
        check(!ps.paused, 'pause closes');
      }
      print(`smoke L${li + 1} ${kind}: scene=${Game.scene.constructor.name} x=${Math.round(ps.player.x)} coins=${ps.coins} lives=${ps.lives}`);
    }
  }
  // force carrot / big / hurt logic
  Game.setScene(new PlayScene(0));
  const ps = Game.scene;
  ps.player.setBig(true);
  check(ps.player.big && ps.player.h === Math.round(SISTERS[Game.character].smallH * 1.5), 'grows big');
  ps.hurtPlayer();
  check(!ps.player.big && ps.player.invuln > 1.4 && ps.player.state === 'play', 'big hit shrinks + invulnerable');
  ps.player.invuln = 0;
  ps.hurtPlayer();
  check(ps.player.state === 'dead' && ps.lives === 2, 'small hit costs a life');
  step(120);
  check(ps.player.state === 'play', 'respawned');
  ps.lives = 1; ps.killPlayer('pit'); step(120);
  check(Game.scene instanceof GameOverScene, 'game over at 0 lives');
  step(40);
  keys.pressed.add('confirm'); step(1);
  check(Game.scene instanceof PlayScene, 'retry from game over');
  // carrot while big gives +10 coins; extra life every 100 coins (when enabled)
  {
    Game.setScene(new PlayScene(0));
    const cs = Game.scene;
    cs.player.setBig(true);
    const car = cs.carrots[0];
    cs.player.x = car.x; cs.player.y = car.y + car.h - cs.player.h;
    const before = cs.coins;
    step(2);
    check(cs.coins === before + 10 && cs.player.big, 'carrot while big gives +10 coins');
    SaveData.data.extraLife = true;
    cs.coins = 95; const lives = cs.lives;
    cs.addCoin(10);
    check(cs.lives === lives + 1, 'extra life at 100 coins');
    cs.addCoin(1);
    check(cs.lives === lives + 1, 'only one extra life per 100');
    SaveData.data.extraLife = false;
    // two checkpoints; respawn at the last one reached
    check(cs.checkpoints.length === 3, 'three checkpoints');
    const cp = cs.checkpoints[1];
    cs.player.x = cp.x + 4; cs.player.y = cp.y - cs.player.h;
    step(2);
    check(cs.checkpoints[0].active && cs.checkpoints[1].active && !cs.checkpoints[2].active, 'passing checkpoint 2 lights the first two');
    cs.player.invuln = 0; cs.player.setBig(false); cs.hurtPlayer();
    step(120);
    check(Math.abs(cs.player.cx - cp.x) < 40, 'respawn at last checkpoint');
  }
  // grown-up breaks cracked boxes while small, sisters do not
  for (const kind of ['grownup', 'older']) {
    Game.character = kind;
    Game.setScene(new PlayScene(2));
    const gs = Game.scene;
    let xt = null;
    for (let ty = 0; ty < gs.level.rows && !xt; ty++) for (let tx = 0; tx < gs.level.cols; tx++) if (gs.level.get(tx, ty) === 'X') { xt = [tx, ty]; break; }
    gs.hitBox(xt[0], xt[1]);
    const broke = gs.level.get(xt[0], xt[1]) === '.';
    check(broke === (kind === 'grownup'), `${kind} small breaking cracked box: ${broke}`);
  }
  // Fire Girl: fireballs only while big, max 2 at once, cooldown, defeat any enemy for +1 coin
  {
    Game.character = 'firegirl';
    Game.setScene(new PlayScene(2));
    const fs = Game.scene;
    const pl = fs.player;
    keys.pressed.add('fire'); step(1);
    check(fs.fireballs.length === 0, 'small Fire Girl cannot shoot');
    pl.setBig(true);
    keys.pressed.add('fire'); step(1);
    check(fs.fireballs.length === 1, 'big Fire Girl shoots');
    keys.pressed.add('fire'); step(1);
    check(fs.fireballs.length === 1, 'cooldown blocks rapid fire');
    step(20); keys.pressed.add('fire'); step(1);
    step(20); keys.pressed.add('fire'); step(1);
    check(fs.fireballs.length <= 2, 'at most 2 fireballs');
    step(200);
    check(fs.fireballs.length === 0, 'fireballs expire');
    const plant = fs.enemies.find((e) => e instanceof SpikyPlant);
    plant.active = true;
    fs.camX = plant.x - 300;
    const coins = fs.coins;
    const fb = new Fireball(plant.x - 20, plant.y + plant.h / 2, 1);
    fs.fireballs.push(fb);
    for (let i = 0; i < 20 && !plant.killed; i++) fs.updateFireballs(STEP);
    check(plant.killed && fs.coins === coins + 1, 'fireball defeats spiky plant, +1 coin');
    let bx, by;
    for (let ty = 0; ty < fs.level.rows && bx === undefined; ty++) for (let tx = 0; tx < fs.level.cols; tx++) if (fs.level.get(tx, ty) === 'X') { bx = tx; by = ty; break; }
    const fb2 = new Fireball(bx * TILE - 10, by * TILE + 16, 1);
    fb2.vy = 0;
    fs.fireballs = [fb2];
    for (let i = 0; i < 10; i++) fs.updateFireballs(STEP);
    check(fs.level.get(bx, by) === 'X' && fs.fireballs.length === 0, 'fireballs do not break boxes');
    pl.invuln = 0; fs.hurtPlayer();
    check(!pl.canShoot, 'shrinking loses fireball power');
  }
  // Time challenge: time's up costs a life and grants 1:00; last life -> game over; OFF -> no limit
  {
    SaveData.data.timeChallenge = true;
    Game.character = 'older';
    Game.setScene(new PlayScene(0));
    const ts = Game.scene;
    check(ts.timer.challenge && ts.timer.remaining === LEVELS[0].timeLimit, 'countdown starts at level limit');
    const x0 = ts.player.x;
    ts.timer.remaining = 0.5;
    step(40);
    check(ts.lives === 2 && ts.player.state === 'play' && Math.abs(ts.timer.remaining - (60 - 40 / 60 + 0.5)) < 0.05, "time's up: -1 life, +1:00, keeps playing");
    check(Math.abs(ts.player.x - x0) < 40, "time's up: continues from same place");
    ts.player.invuln = 0; ts.hurtPlayer(); step(120);
    check(Math.abs(ts.timer.remaining - (60 - 160 / 60 + 0.5)) < 2.5, 'other deaths do not reset the timer');
    ts.lives = 1; ts.timer.remaining = 0.1; step(150);
    check(Game.scene instanceof GameOverScene, "time's up on last life -> game over");
    SaveData.data.timeChallenge = false;
    Game.setScene(new PlayScene(0));
    const off = Game.scene;
    check(!off.timer.challenge, 'challenge off: no countdown');
    off.timer.elapsed = 10000; step(5);
    check(off.lives === 3 && off.player.state === 'play', 'challenge off: no time limit');
  }
  Game.character = 'younger';
  // victory -> results -> saved best
  Game.setScene(new PlayScene(0));
  const vs = Game.scene;
  vs.flag.rise = 1; // as if the boss were already beaten
  vs.coins = 7;
  vs.player.x = vs.flag.poleX - 10; vs.player.y = vs.flag.bottom - vs.player.h;
  step(200);
  check(Game.scene instanceof ResultsScene, 'flag -> results');
  check(SaveData.getLevel(0).completed && SaveData.getLevel(0).best === 7, 'best score saved');
  step(40); keys.pressed.add('confirm'); step(1);
  check(Game.scene instanceof LevelSelectScene, 'results -> level select');
} catch (e) {
  failures++;
  print('EXCEPTION: ' + e + '\n' + e.stack);
}

// ---- Level 4: desert hazards and enemies
function placeOn(sc, tx, surfaceY) {
  const p = sc.player;
  p.x = tx * TILE + TILE / 2 - p.w / 2;
  p.y = surfaceY - p.h;
  p.vx = 0; p.vy = 0;
}
function findTile(level, ch, rowFrom = 0) {
  for (let tx = 0; tx < level.cols; tx++) for (let ty = rowFrom; ty < level.rows; ty++) if (level.get(tx, ty) === ch) return [tx, ty];
  return null;
}
try {
  Game.character = 'older';
  SaveData.data.timeChallenge = false;
  // quicksand: sinks slowly, drowns after 3 s fully sunk
  Game.setScene(new PlayScene(3));
  let d = Game.scene;
  let [qx, qy] = findTile(d.level, 'q');
  placeOn(d, qx + 1, qy * TILE - 1);
  step(30, false);
  check(d.player.inSand && d.player.state === 'play', 'quicksand: player sinks in');
  const y1 = d.player.y;
  step(30, false);
  check(d.player.y > y1 && d.player.y - y1 < 40, 'quicksand: sinking is slow');
  step(60 * 6, false);
  check(d.lives === 2, 'quicksand: fully sunk for 3 s costs a life');
  // quicksand: escape by jumping repeatedly
  Game.setScene(new PlayScene(3));
  d = Game.scene;
  placeOn(d, qx + 1, qy * TILE - 1);
  step(40, false);
  for (let f = 0; f < 240 && (d.player.inSand || d.player.x < (qx + 4) * TILE); f++) {
    keys.held.add('right');
    if (f % 18 === 0) keys.pressed.add('jump');
    if (f % 18 < 12) keys.held.add('jump'); else keys.held.delete('jump');
    step(1, false);
  }
  keys.held.clear();
  check(d.lives === 3 && !d.player.inSand, 'quicksand: escape by jumping repeatedly');
  // crumbling platform: shakes 0.5 s after landing, falls, returns after 3 s
  Game.setScene(new PlayScene(3));
  d = Game.scene;
  const [cx, cy] = findTile(d.level, '-');
  placeOn(d, cx, cy * TILE);
  d.player.onGround = true;
  step(20, false);
  check(d.level.get(cx, cy) === '-', 'crumble: still there at 0.33 s');
  step(20, false);
  check(d.level.get(cx, cy) === '.', 'crumble: falls after 0.5 s');
  step(60 * 3 + 20, false);
  check(d.level.get(cx, cy) === '-', 'crumble: reappears after 3 s');
  // tumbleweed cannot be stomped; fireballs defeat it
  Game.setScene(new PlayScene(3));
  d = Game.scene;
  const tw = d.enemies.find((e) => e instanceof Tumbleweed);
  tw.active = true;
  d.player.x = tw.x; d.player.y = tw.y - d.player.h + 4; d.player.vy = 300; d.player.prevBottom = tw.y - 2;
  d.checkCollisions();
  check(!tw.killed && d.player.state === 'dead', 'tumbleweed: stomping hurts instead');
  check(d.enemies.filter((e) => e.cactus).length > 0, 'cacti in the desert');
  // vulture: shadow warning 1 s before the dive
  Game.setScene(new PlayScene(3));
  d = Game.scene;
  const vu = d.enemies.find((e) => e instanceof Vulture);
  vu.active = true; vu.cooldown = 0;
  d.player.x = vu.x; d.player.update = function () {};
  let warnF = -1, diveF = -1;
  for (let f = 0; f < 200 && diveF < 0; f++) {
    vu.update(STEP, d.level, d.player);
    if (vu.mode === 'warn' && warnF < 0) warnF = f;
    if (vu.mode === 'dive') diveF = f;
  }
  check(warnF >= 0 && Math.abs(diveF - warnF - 60) <= 2, `vulture: dives ${diveF - warnF} frames after the warning`);
  // scorpion: dashes at the player on the same row
  Game.setScene(new PlayScene(3));
  d = Game.scene;
  const sc = d.enemies.find((e) => e instanceof Scorpion);
  sc.active = true;
  for (let f = 0; f < 30; f++) sc.update(STEP, d.level, d.player);
  const fake = { cx: sc.x - 150, bottom: sc.y + sc.h, state: 'play' };
  let dashed = false;
  for (let f = 0; f < 90; f++) { sc.update(STEP, d.level, fake); if (sc.mode === 'dash') dashed = true; }
  check(dashed, 'scorpion: dashes when the player is on its row');
} catch (e) {
  failures++;
  print('EXCEPTION (level 4): ' + e + '\n' + e.stack);
}

// ---- Bosses: shared rules and each boss's attacks
function enterArena(sc) {
  const cp = sc.checkpoints[sc.checkpoints.length - 1];
  cp.active = true;
  const a = sc.arena;
  placeOn(sc, a.kx + 4, a.floorY);
  sc.camX = sc.cameraTarget();
  step(2, false);
}
const BOSS_ATTACK_STATES = {
  bristle: ['curl', 'roll', 'weak', 'shake'],
  croakia: ['crouch', 'leap', 'weak', 'mouth', 'croak'],
  frostbeak: ['hoot', 'toEdge', 'hover', 'dive', 'weak', 'spread'],
  sandclaw: ['stamp', 'charge', 'weak', 'tail', 'slam'],
};
LEVELS.forEach((def, li) => {
  try {
    const kind = def.boss;
    const cfg = BOSS_TYPES[kind];
    Game.character = 'older';
    Game.setScene(new PlayScene(li));
    const bs = Game.scene;
    const a = bs.arena;
    const tag = `boss ${cfg.name}:`;
    check(a && a.kind === kind, `${tag} level ${li + 1} ends in its arena`);
    check(bs.flag && !bs.flag.visible && !bs.flag.touchable, `${tag} no flag before the fight`);
    check(bs.checkpoints.length === 3 && bs.checkpoints[2].x < a.left && a.left - bs.checkpoints[2].x < 16 * TILE, `${tag} checkpoint right before the arena`);
    enterArena(bs);
    check(a.state === 'intro' && bs.player.frozen === true, `${tag} intro freezes the player`);
    bs.player.invuln = 0;
    bs.hurtPlayer();
    check(bs.player.state === 'play' && bs.lives === 3, `${tag} player can't be hurt during the intro`);
    check(bs.banner && bs.banner.text === cfg.name, `${tag} name shown on screen`);
    step(125, false);
    check(a.state === 'fight' && a.boss.hp === cfg.hp && !bs.player.frozen, `${tag} fight starts after 2 s with ${cfg.hp} HP`);
    check(bs.level.get(a.leftCol, a.wallBottomRow - 3) === 'W' && bs.level.get(a.rightCol, a.wallBottomRow - 3) === 'W', `${tag} walls rise`);
    check(Math.abs(bs.camX - a.camX) < 2, `${tag} camera locks`);
    const b = a.boss;
    // let it attack with the player parked (and unhittable) and record what it does
    const pl = bs.player;
    pl.update = function () { this.invuln = 99; };
    const seen = {};
    const hazardKinds = {};
    const runFor = (frames) => {
      for (let f = 0; f < frames; f++) {
        step(1, false);
        seen[b.state] = true;
        for (const h of a.hazards) hazardKinds[h.kind || h.constructor.name] = true;
      }
    };
    runFor(60 * 14);
    b.hp = 1; b.invuln = 0; b.rest(); // last phase
    runFor(60 * 30);
    const missing = BOSS_ATTACK_STATES[kind].filter((st) => !seen[st]);
    check(missing.length === 0, `${tag} uses all its attacks (missing: ${missing.join(', ')})`);
    if (kind === 'bristle') check(hazardKinds.spine, `${tag} spines land on marked spots`);
    if (kind === 'croakia') {
      check(hazardKinds.shock && hazardKinds.Tongue, `${tag} ground shock and tongue grab`);
      check(bs.enemies.some((e) => e.bossMinion), `${tag} calls in small frogs`);
    }
    if (kind === 'frostbeak') check(hazardKinds.snowball, `${tag} drops snowballs`);
    if (kind === 'sandclaw') check(hazardKinds.stinger && hazardKinds.sand, `${tag} stinger rain and sand wave`);
    delete pl.update;
    pl.invuln = 0;
    // weak moment: stomp removes 1 HP, side contact is harmless, boss invulnerable 1 s after
    b.hp = cfg.hp; b.invuln = 0;
    b.x = a.left + 300; b.y = a.floorY - b.h; b.vx = 0;
    a.hazards = [];
    b.goWeak(bs);
    pl.update = function () {};
    pl.x = b.x - pl.w + 12; pl.y = a.floorY - pl.h; pl.vy = 0; pl.prevBottom = a.floorY;
    a.checkPlayer(bs);
    check(pl.state === 'play' && bs.lives === 3, `${tag} touching the weak boss is harmless`);
    pl.x = b.cx - pl.w / 2; pl.y = b.hitbox.y - pl.h + 8; pl.vy = 300; pl.prevBottom = b.hitbox.y - 1;
    a.checkPlayer(bs);
    check(b.hp === cfg.hp - 1 && b.invuln > 0.9 && !b.weak, `${tag} stomp while weak removes 1 HP, then 1 s invulnerable`);
    // not weak: contact hurts
    b.invuln = 0; b.setState('idle', 10); a.stompGrace = 0;
    pl.x = b.cx - pl.w / 2; pl.y = b.hitbox.y - pl.h + 8; pl.vy = 300; pl.prevBottom = b.hitbox.y - 1;
    a.checkPlayer(bs);
    check(pl.state === 'dead' && b.hp === cfg.hp - 1, `${tag} touching it outside the weak moment hurts`);
    // fireballs: 3 hits = 1 HP
    b.invuln = 0;
    const hp0 = b.hp;
    b.fireballHit(bs); b.fireballHit(bs);
    check(b.hp === hp0, `${tag} 2 fireballs do not remove HP`);
    b.fireballHit(bs);
    check(b.hp === hp0 - 1, `${tag} 3 fireballs remove 1 HP`);
    // losing a life resets the fight
    delete pl.update;
    step(120, false);
    check(a.state === 'waiting' && !a.boss && !bs.enemies.some((e) => e.bossMinion), `${tag} losing a life resets the arena`);
    check(Math.abs(bs.player.cx - bs.checkpoints[2].x) < 40, `${tag} respawn at the checkpoint before the arena`);
    enterArena(bs);
    step(125, false);
    check(a.boss && a.boss.hp === cfg.hp, `${tag} back to full health after a lost life`);
    // victory
    const coins = bs.coins;
    a.boss.hp = 1; a.boss.invuln = 0; a.boss.goWeak(bs);
    a.boss.damage(bs);
    check(a.won && a.boss.state === 'defeated', `${tag} defeated at 0 HP`);
    bs.player.update = function () {};
    step(60 * 6, false);
    check(bs.coins === coins + cfg.coins, `${tag} ${cfg.coins} coins burst out (${bs.coins - coins})`);
    check(bs.level.get(a.leftCol, a.wallBottomRow) === '.' && bs.level.get(a.rightCol, a.wallBottomRow) === '.', `${tag} walls sink`);
    check(bs.flag.touchable, `${tag} flag rises`);
    delete bs.player.update;
    placeOn(bs, Math.floor(bs.flag.poleX / TILE), bs.flag.bottom);
    step(240, false);
    check(Game.scene instanceof ResultsScene, `${tag} touching the flag completes the level`);
  } catch (e) {
    failures++;
    print(`EXCEPTION (boss ${def.boss}): ${e}\n${e.stack}`);
  }
});
// Frostbeak's floor is slippery ice and her wind pushes the player
{
  Game.character = 'older';
  Game.setScene(new PlayScene(2));
  const fs = Game.scene;
  enterArena(fs);
  step(125, false);
  const pl = fs.player;
  placeOn(fs, fs.arena.kx + 14, fs.arena.floorY);
  pl.onGround = true;
  keys.held.add('right'); step(40, false); keys.held.clear();
  step(1, false);
  check(pl.onIce, 'frostbeak: floor is ice');
  let slide = 0;
  for (let f = 0; f < 60 && Math.abs(pl.vx) > 0; f++) { const x0 = pl.x; step(1, false); slide += pl.x - x0; }
  check(slide > 40, `frostbeak: player slides on the ice (${Math.round(slide)} px)`);
  fs.arena.wind = 130;
  const x1 = pl.x;
  fs.arena.boss.setState('blow', 99);
  step(30, false);
  check(pl.x > x1 + 30, 'frostbeak: icy wind pushes the player');
  fs.arena.wind = 0;
}
// Level select shows each level's boss
check(LEVELS.every((d) => BOSS_TYPES[d.boss]), 'every level has a boss');
check(LEVELS.map((d) => BOSS_TYPES[d.boss].hp).every((hp, i, arr) => i === 0 || hp > arr[i - 1]), 'bosses get tougher level by level');

// ---- Boss bot: beat every boss with stomps only, for every character (starting small)
function bossBot(li, kind) {
  Game.character = kind;
  Game.setScene(new PlayScene(li));
  const sc = Game.scene;
  sc.lives = 99;
  const cp = sc.checkpoints[2];
  cp.active = true;
  placeOn(sc, Math.floor(cp.x / TILE), cp.y);
  sc.camX = sc.cameraTarget();
  const a = sc.arena;
  const platRow = a.wallBottomRow - 2;
  const underPlatform = (p) => {
    for (let tx = Math.floor(p.x / TILE); tx <= Math.floor((p.x + p.w) / TILE); tx++) if (sc.level.isSolid(tx, platRow)) return true;
    return false;
  };
  const mid = (a.left + a.right) / 2;
  // direction to the nearest edge of the platform overhead
  const exitDir = (p) => {
    let l = Math.floor(p.cx / TILE), r = l;
    while (sc.level.isSolid(l - 1, platRow)) l--;
    while (sc.level.isSolid(r + 1, platRow)) r++;
    return p.cx - l * TILE < (r + 1) * TILE - p.cx ? -1 : 1;
  };
  let deaths = 0, prev = 'play', hold = 0, f = 0;
  for (; f < 60 * 240 && !a.won; f++) {
    keys.held.clear(); keys.pressed.clear();
    const p = sc.player, b = a.boss;
    if (p.state === 'dead' && prev !== 'dead') {
      deaths++;
      if (typeof BOT_LOG !== 'undefined') print(`   death: boss=${b ? b.state : '-'} hp=${b ? b.hp : '-'} px=${Math.round(p.cx - a.left)} bx=${b ? Math.round(b.cx - a.left) : '-'} by=${b ? Math.round(a.floorY - b.y - b.h) : '-'} hazards=${a.hazards.map((h) => h.kind || h.constructor.name).join(',')}`);
    }
    prev = p.state;
    let move = 0, jump = false, hop = 30;
    const clampMove = () => {
      if (p.x < a.left + 30 && move < 0) move = 0;
      if (p.x + p.w > a.right - 30 && move > 0) move = 0;
    };
    if (!b || a.state === 'waiting') move = 1;
    else if (b.alive && a.state === 'fight') {
      const dx = b.cx - p.cx, dist = Math.abs(dx);
      const st = b.state;
      const between = (p.cx < b.cx && b.x < a.left + 60 && p.cx < b.x) || (p.cx > b.cx && b.x + b.w > a.right - 60 && p.cx > b.x + b.w);
      const dangerShadow = a.hazards.find((h) => h.shadowX !== undefined && h.shadowX !== null && Math.abs(h.shadowX - p.cx) < 34);
      if (b.weak) {
        if (dist > 6) move = Math.sign(dx);
        const onFloor = p.bottom >= a.floorY - 2; // from a platform, just drop onto it
        // touching it while weak is harmless, so walk up close if a platform is overhead
        if (dist < b.w / 2 + 34 && p.onGround && onFloor && !underPlatform(p)) { jump = true; hop = kind === 'younger' ? 10 : 12; }
      } else if (kind === 'x') {
      } else if ((st === 'stamp' || st === 'curl') && underPlatform(p) && p.onGround) {
        move = -Math.sign(dx) || 1;
      } else if (st === 'stamp' || st === 'curl') {
        move = -Math.sign(dx) || 1; // wait by the wall it will crash into
        clampMove();
      } else if (st === 'charge' || st === 'roll') {
        const toward = Math.sign(b.vx) === Math.sign(-dx);
        const gap = dist - b.w / 2 - p.w / 2;
        if (toward && gap < Math.abs(b.vx) * 0.12 + 10 && p.onGround) jump = true;
        if (!p.onGround && toward) move = Math.sign(dx);
        if (!toward) move = Math.sign(b.vx);
      } else if (st === 'crouch' || st === 'leap' || st === 'hover' || st === 'dive' || st === 'toEdge') {
        // stay clear of where it will land
        const target = st === 'leap' ? b.shadowX : st === 'hover' || st === 'dive' ? b.target : p.cx;
        const keepAway = st === 'leap' || st === 'crouch' ? b.w / 2 + 150 : b.w / 2 + 70; // just outside the ground shock's reach
        if (target !== null && target !== undefined && Math.abs(target - p.cx) < keepAway) {
          move = target < p.cx ? 1 : -1;
          // cornered: run the other way, underneath it while it's in the air
          if ((move < 0 && p.x < a.left + 150) || (move > 0 && p.x + p.w > a.right - 150)) move = -move;
        }
        if (st === 'crouch' || st === 'toEdge') move = 0;
      } else if (st === 'mouth' || st === 'tongueOut') {
        const tg = a.hazards.find((h) => h instanceof Tongue);
        if (tg) {
          const tip = tg.dir > 0 ? tg.x0 + tg.len : tg.x0 - tg.len;
          if (Math.abs(tip - p.cx) < 110 && tg.mode === 'out' && p.onGround) jump = true;
        } else {
          move = -Math.sign(dx) || 1;
          clampMove();
        }
      } else if (st === 'blow' || st === 'spread') {
        move = a.wind ? -Math.sign(a.wind) : 0;
      } else if (dangerShadow) {
        move = dangerShadow.shadowX < p.cx ? 1 : -1;
        if ((move < 0 && p.x < a.left + 30) || (move > 0 && p.x + p.w > a.right - 30)) move = -move;
      } else if (between) {
        move = Math.sign(dx);
        if (p.onGround && dist < 110) jump = true;
      } else {
        const atWall = b.x < a.left + 60 || b.x + b.w > a.right - 60;
        if (dist < 230) move = atWall ? Math.sign(mid - b.cx) : -Math.sign(dx) || 1;
        clampMove();
      }
      if (dangerShadow && !b.weak && !(st === 'charge' || st === 'roll')) {
        move = dangerShadow.shadowX < p.cx ? 1 : -1;
        if ((move < 0 && p.x < a.left + 30) || (move > 0 && p.x + p.w > a.right - 30)) move = -move;
      }
      // waves take priority: get out from under a platform, then jump toward the wave
      for (const w of a.hazards) {
        if (!(w instanceof Wave)) continue;
        const wd = w.x + w.w / 2 - p.cx;
        if (Math.sign(wd) !== -w.dir || Math.abs(wd) > 200) continue;
        // under a platform a hop bumps its head: is the time spent above the wave long enough?
        const r = w.rect;
        const headroom = 64 - p.h - (a.floorY - (r.y)) ;
        const airTime = headroom > 0 ? Math.sqrt((2 * headroom) / 2000) : 0;
        const needTime = (r.w + p.w) / (w.speed + 210);
        if (underPlatform(p) && airTime > needTime * 1.15) {
          move = -w.dir; // run at it and hop over, low under the platform
          if (Math.abs(wd) < 45 && p.onGround) { jump = true; hop = 4; }
        } else if (b.weak && !underPlatform(p)) {
          if (Math.abs(wd) < 60 && p.onGround) jump = true; // keep advancing on the weak boss, hop the wave
        } else if (underPlatform(p) && p.onGround) move = exitDir(p); // step out from under the platform first
        else {
          move = 0; // jump straight up and let it pass underneath
          if (Math.abs(wd) < 60 && p.onGround) jump = true;
        }
      }
      // small frogs: hop onto them
      for (const e of sc.enemies) {
        if (!e.bossMinion || e.killed || !e.active) continue;
        const ed = e.x + e.w / 2 - p.cx;
        if (Math.abs(ed) < 80 && p.onGround) { jump = true; move = Math.sign(ed); }
      }
    }
    if (jump) { keys.pressed.add('jump'); hold = hop; }
    if (hold > 0) { keys.held.add('jump'); hold--; }
    if (move > 0) keys.held.add('right');
    if (move < 0) keys.held.add('left');
    Game.time += STEP;
    sc.update(STEP);
    Input.endStep();
  }
  keys.held.clear();
  return { won: a.won, deaths, seconds: f / 60 };
}
LEVELS.forEach((def, li) => {
  for (const kind of ['older', 'younger', 'grownup', 'firegirl']) {
    const r = bossBot(li, kind);
    print(`boss bot L${li + 1} ${BOSS_TYPES[def.boss].name.padEnd(14)} ${kind.padEnd(8)}: ${r.won ? 'BEATEN' : 'not beaten'} in ${formatTime(r.seconds)}, ${r.deaths} lives lost (stomps only, small)`);
    check(r.won, `${BOSS_TYPES[def.boss].name} not beaten by stomps with ${kind}`);
  }
});


// ---- reachability: can each sister (small and big) get from P to the flag with real physics?
const stubScene = { dead: false, onHeadBump() {}, particles: { dust() {} }, killPlayer() { this.dead = true; } };

function reach(li, kind, big, breakTile) {
  const level = new Level(li);
  if (breakTile) level.set(breakTile[0], breakTile[1], '.');
  let start, flag;
  for (const s of level.spawns) {
    if (s.type === 'P') start = { cx: s.tx * TILE + 16, bottom: (s.ty + 1) * TILE };
    if (s.type === 'F') flag = new GoalFlag(s.tx, s.ty);
  }
  const coinTiles = new Set(level.spawns.filter((s) => s.type === 'o').map((s) => s.tx + ',' + s.ty));
  const got = new Set();
  const mk = (x, y) => {
    const p = new Player(kind, 0, 0);
    if (big) { p.setBig(true); p.growT = 0; }
    p.x = x; p.y = y; p.onGround = true;
    return p;
  };
  const actions = [];
  for (const dir of [-1, 0, 1]) {
    for (const j of [0, 3, 8, 14, 999]) {
      for (const hold of j === 999 ? [0] : [1, 5, 10, 16, 40]) actions.push({ dir, j, hold, delay: 0 });
    }
    if (dir) for (const delay of [8, 16]) actions.push({ dir, j: 0, hold: 40, delay });
  }
  const key = (p) => Math.round(p.x / 6) + ',' + Math.round(p.y);
  const probe = mk(0, 0);
  const s0 = mk(start.cx - probe.w / 2, start.bottom - probe.h);
  // Dijkstra on elapsed frames: finds the fastest route this move set allows.
  const bestT = new Map([[key(s0), 0]]);
  const queue = [[0, s0.x, s0.y]];
  const push = (item) => {
    let lo = 0, hi = queue.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (queue[mid][0] <= item[0]) lo = mid + 1; else hi = mid; }
    queue.splice(lo, 0, item);
  };
  let reached = false, maxX = 0, finish = Infinity;
  while (queue.length) {
    const [t0, sx, sy] = queue.shift();
    if (t0 >= finish) break;
    if (t0 > bestT.get(Math.round(sx / 6) + ',' + Math.round(sy))) continue;
    const probeP = mk(sx, sy);
    const onCrumble = level.get(Math.floor((probeP.cx) / TILE), Math.floor((probeP.bottom + 1) / TILE)) === '-';
    for (const a of actions) {
      if (onCrumble && a.j > 14) continue; // must leave a crumbling platform before it falls
      const p = mk(sx, sy);
      stubScene.dead = false;
      let airborne = false;
      for (let f = 0; f < 150; f++) {
        keys.held.clear(); keys.pressed.clear();
        const walkLimit = a.j === 999 ? 18 : 999;
        if (f >= a.delay && f < walkLimit && a.dir) keys.held.add(a.dir > 0 ? 'right' : 'left');
        if (f === a.j) keys.pressed.add('jump');
        if (f >= a.j && f < a.j + a.hold) keys.held.add('jump');
        p.update(STEP, level, stubScene);
        if (stubScene.dead) break;
        const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE);
        const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.01) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (coinTiles.has(tx + ',' + ty)) got.add(tx + ',' + ty);
        if (overlaps(p, flag)) { reached = true; finish = Math.min(finish, t0 + f + 1); break; }
        if (!p.onGround) airborne = true;
        const settled = p.onGround && (a.j === 999 ? f > 18 && p.vx === 0 : airborne);
        if (settled) {
          maxX = Math.max(maxX, p.x);
          const k = key(p);
          const t1 = t0 + f + 1;
          if (!bestT.has(k) || t1 < bestT.get(k)) { bestT.set(k, t1); push([t1, p.x, p.y]); }
          break;
        }
      }
    }
  }
  const missing = [...coinTiles].filter((c) => !got.has(c));
  return { reached, maxTile: Math.floor(maxX / TILE), states: bestT.size, missing, seconds: finish / 60 };
}

for (let li = 0; li < (typeof QUICK !== 'undefined' ? 0 : LEVELS.length); li++) {
  for (const kind of ['older', 'younger', 'grownup', 'firegirl']) {
    for (const big of [false, true]) {
      const r = reach(li, kind, big);
      print(`reach L${li + 1} ${kind.padEnd(8)} ${big ? 'big  ' : 'small'}: ${r.reached ? 'OK   ' : 'STUCK'} fastest ${r.reached ? formatTime(r.seconds) : '-'} / limit ${formatTime(LEVELS[li].timeLimit)} (furthest tile ${r.maxTile}) coins unreached: ${r.missing.length ? r.missing.length : 'none'}`);
      if (r.reached && LEVELS[li].timeLimit - r.seconds < 40) print(`  warning: fastest route leaves only ${Math.round(LEVELS[li].timeLimit - r.seconds)} s`);
      check(r.reached, `L${li + 1} ${kind} ${big ? 'big' : 'small'} cannot reach flag`);
    }
  }
}

for (const kind of ['older', 'younger', 'grownup', 'firegirl']) {
  let bx = -1;
  new Level(2).tiles[12].forEach((ch, i) => { if (ch === 'X' && bx < 0) bx = i + 2; });
  const r = reach(2, kind, kind !== 'grownup', [bx, 12]);
  const room = r.missing.filter((c) => +c.split(',')[0] >= bx - 2 && +c.split(',')[0] <= bx + 2);
  print(`secret room (${kind}, one cracked box broken): unreached room coins: ${room.length ? room.join(' ') : 'none'}`);
  check(room.length === 0, 'secret room not enterable for ' + kind);
}
const SPEC = [{ carrots: 4, coins: 120, cps: 3 }, { carrots: 5, coins: 160, cps: 3 }, { carrots: 6, coins: 200, cps: 3 }, { carrots: 4, coins: 220, cps: 3 }];
LEVELS.forEach((def, i) => {
  const all = def.map.join('');
  const carrots = [...all].filter((c) => c === 'c' || c === 'C').length;
  const coins = Level.countCoins(def);
  print(`L${i + 1}: width ${def.map[0].length}, carrots ${carrots}, coins ${coins}`);
  check(carrots === SPEC[i].carrots, `L${i + 1} carrots ${carrots} != ${SPEC[i].carrots}`);
  const cps = [...all].filter((c) => c === 'k').length;
  check(cps === SPEC[i].cps, `L${i + 1} checkpoints ${cps} != ${SPEC[i].cps}`);
  check(Math.abs(coins - SPEC[i].coins) <= SPEC[i].coins * 0.1, `L${i + 1} coins ${coins} not ~${SPEC[i].coins}`);
});
print(failures ? `\n${failures} FAILURE(S)` : '\nALL TESTS PASSED');
