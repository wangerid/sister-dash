// Headless tests for Sister Dash: scene smoke tests plus a physics-based check that every level
// can be finished with all four characters, small and big, plus Time challenge, shooting, swimming and boss checks.
//
// Run from the project root with macOS's built-in JavaScriptCore shell:
//   /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tools/test.js
var window = { addEventListener() {}, innerWidth: 960, innerHeight: 540, devicePixelRatio: 1 };
var performance = { now: () => Date.now() };
var localStorage = { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); } };
var ROOT = 'js/';
var DESERT = 6, REEF = 5, SNOW = 4, CAVES = 1, CLOUDS = 3;
['input', 'audio', 'storage', 'render', 'levels', 'level', 'entities', 'enemies', 'projectiles', 'swimming', 'timer', 'boss', 'bosses', 'player', 'scenes', 'main'].forEach((f) => load(ROOT + f + '.js'));

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
    for (const kind of ['older', 'younger', 'grownup', 'firewoman']) {
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
    Game.setScene(new PlayScene(SNOW));
    const gs = Game.scene;
    let xt = null;
    for (let ty = 0; ty < gs.level.rows && !xt; ty++) for (let tx = 0; tx < gs.level.cols; tx++) if (gs.level.get(tx, ty) === 'X') { xt = [tx, ty]; break; }
    gs.hitBox(xt[0], xt[1]);
    const broke = gs.level.get(xt[0], xt[1]) === '.';
    check(broke === (kind === 'grownup'), `${kind} small breaking cracked box: ${broke}`);
  }
  // Shooting: every character shoots while big. Different looks, same bouncing behaviour.
  const SHOT_OF = { older: 'star', younger: 'bubble', grownup: 'boomerang', firewoman: 'fireball' };
  const EFFECT = { older: (e) => e.killed, younger: (e) => e.trapped, grownup: (e) => e.spinning, firewoman: (e) => e.killed };
  for (const kind of ['older', 'younger', 'grownup', 'firewoman']) {
    Game.character = kind;
    Game.setScene(new PlayScene(SNOW));
    const fs = Game.scene;
    const pl = fs.player;
    check(pl.cfg.shot === SHOT_OF[kind], `${kind} shoots ${SHOTS[SHOT_OF[kind]].name}`);
    keys.pressed.add('fire'); step(1);
    check(fs.shots.length === 0, `${kind}: can't shoot while small`);
    pl.setBig(true); pl.growT = 0;
    keys.pressed.add('fire'); step(1);
    check(fs.shots.length === 1 && fs.shots[0].kind === SHOT_OF[kind], `${kind}: shoots while big`);
    keys.pressed.add('fire'); step(1);
    check(fs.shots.length === 1, `${kind}: 0.3 s cooldown between shots`);
    for (let i = 0; i < 12; i++) { keys.pressed.add('fire'); step(8); }
    check(fs.shots.length <= SHOT.max, `${kind}: at most ${SHOT.max} on screen (${fs.shots.length})`);
    // the shot bounces along the ground in small hops
    fs.shots = [];
    pl.update = function () {};
    const floorY = fs.level.height - 2 * TILE;
    fs.camX = 0;
    fs.shots.push(new Shot(SHOT_OF[kind], 200, floorY - 20, 1, false));
    let lows = 0, highs = 0, maxHop = 0;
    for (let i = 0; i < 90 && fs.shots.length; i++) {
      fs.updateShots(STEP);
      const sh = fs.shots[0];
      if (!sh) break;
      const above = floorY - (sh.y + sh.h);
      maxHop = Math.max(maxHop, above);
      if (above < 2) lows++; else highs++;
    }
    check(lows > 0 && highs > 0 && maxHop > 20 && maxHop < 50, `${kind}: shot bounces in hops about 1 tile high (${Math.round(maxHop)} px)`);
    fs.shots = [];
    // defeats an enemy that can't be stomped, for +1 coin, with its own effect
    const plant = fs.enemies.find((e) => e instanceof SpikyPlant && !e.killed);
    plant.active = true;
    fs.camX = plant.x - 300;
    const coins = fs.coins;
    fs.shots = [new Shot(SHOT_OF[kind], plant.x - 30, plant.y + plant.h - 8, 1, false)];
    for (let i = 0; i < 30; i++) fs.updateShots(STEP);
    check(EFFECT[kind](plant) && fs.coins === coins + 1, `${kind}: shot defeats a spiky plant, +1 coin (${SHOTS[SHOT_OF[kind]].defeat})`);
    if (kind === 'younger' || kind === 'grownup') {
      delete pl.update;
      pl.update = function () {};
      step(200);
      check(plant.killed, `${kind}: defeated enemy leaves the screen`);
    }
    delete pl.update;
  }
  // shots don't break boxes; shrinking loses the power
  {
    Game.character = 'older';
    Game.setScene(new PlayScene(SNOW));
    const fs = Game.scene;
    const pl = fs.player;
    let bx, by;
    for (let ty = 0; ty < fs.level.rows && bx === undefined; ty++) for (let tx = 0; tx < fs.level.cols; tx++) if (fs.level.get(tx, ty) === 'X') { bx = tx; by = ty; break; }
    fs.shots = [new Shot('star', bx * TILE - 10, by * TILE + 16, 1, false)];
    for (let i = 0; i < 10; i++) fs.updateShots(STEP);
    check(fs.level.get(bx, by) === 'X' && fs.shots.length === 0, 'shots do not break boxes');
    pl.setBig(true); pl.growT = 0; pl.invuln = 0;
    check(pl.canShoot, 'big player can shoot');
    fs.hurtPlayer();
    check(!pl.canShoot, 'shrinking loses the shooting power');
  }
  // underwater shots: half speed, slow floaty hops
  {
    const land = new Shot('fireball', 100, 100, 1, false);
    const sea = new Shot('fireball', 100, 100, 1, true);
    check(Math.abs(sea.vx) === Math.abs(land.vx) / 2, 'underwater shots move at half speed');
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
  Game.setScene(new PlayScene(DESERT));
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
  Game.setScene(new PlayScene(DESERT));
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
  Game.setScene(new PlayScene(DESERT));
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
  Game.setScene(new PlayScene(DESERT));
  d = Game.scene;
  const tw = d.enemies.find((e) => e instanceof Tumbleweed);
  tw.active = true;
  d.player.x = tw.x; d.player.y = tw.y - d.player.h + 4; d.player.vy = 300; d.player.prevBottom = tw.y - 2;
  d.checkCollisions();
  check(!tw.killed && d.player.state === 'dead', 'tumbleweed: stomping hurts instead');
  check(d.enemies.filter((e) => e.cactus).length > 0, 'cacti in the desert');
  // vulture: shadow warning 1 s before the dive
  Game.setScene(new PlayScene(DESERT));
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
  Game.setScene(new PlayScene(DESERT));
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
  octavia: ['slamming', 'weak', 'shift', 'puff', 'grab'],
  duke: ['dive', 'tunnel', 'rumble', 'pop', 'weak', 'scoop', 'stamp'],
  grumble: ['crackle', 'sink', 'weak', 'rise', 'frown', 'puff', 'gusting', 'storming'],
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
    check(bs.level.get(a.leftCol, a.wallBottomRow - 3) === '&' && bs.level.get(a.rightCol, a.wallBottomRow - 3) === '&', `${tag} walls rise`);
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
    b.shotHit(bs); b.shotHit(bs);
    check(b.hp === hp0, `${tag} 2 shot hits do not remove HP`);
    b.shotHit(bs);
    check(b.hp === hp0 - 1, `${tag} 3 shot hits remove 1 HP`);
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
  Game.setScene(new PlayScene(SNOW));
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
{
  // tougher level by level: more hit points, or as many with more phases
  const toughness = LEVELS.map((d) => { const b = BOSS_TYPES[d.boss]; return b.hp * 10 + [5, 4, 3, 2, 1].filter((h) => b.phaseOf(h) !== b.phaseOf(h + 1)).length; });
  check(toughness.every((v, i) => i === 0 || v > toughness[i - 1]), `bosses get tougher level by level (${toughness.join(' < ')})`);
}

function shellsNear(a, p) {
  return a.hazards.some((h) => h instanceof SpinShell && Math.sign(h.x - p.cx) === -h.dir && Math.abs(h.x - p.cx) < 260);
}

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
  const platRow = a.wallBottomRow - (a.kind === 'duke' ? 1 : 2); // Digger Duke's ledges are lower
  const underPlatform = (p) => {
    // (thin clouds don't count: you can jump up through them)
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
  let deaths = 0, prev = 'play', hold = 0, f = 0, blockedFor = 0, lastX = null;
  for (; f < 60 * 240 && !a.won; f++) {
    keys.held.clear(); keys.pressed.clear();
    const p = sc.player, b = a.boss;
    if (p.state === 'dead' && prev !== 'dead') {
      deaths++;
      if (typeof BOT_LOG !== 'undefined') print(`   death: boss=${b ? b.state : '-'} hp=${b ? b.hp : '-'} px=${Math.round(p.cx - a.left)} bx=${b ? Math.round(b.cx - a.left) : '-'} by=${b ? Math.round(a.floorY - b.y - b.h) : '-'} hazards=${a.hazards.map((h) => h.kind || h.constructor.name).join(',')}`);
    }
    prev = p.state;
    let move = 0, jump = false, hop = 30;
    if (a.kind === 'octavia') {
      // swimming fight: pick a horizontal move and a target height, then stroke/dive toward it
      let targetBottom = a.floorY - 110, dive = false;
      if (!b || a.state === 'waiting' || a.state === 'intro') { move = 1; targetBottom = a.floorY; }
      else if (b.alive) {
        const dx = b.cx - p.cx, dist = Math.abs(dx);
        const headY = b.hitbox.y;
        // floating rocks at the arena's platform row: pass over them, never into their sides
        const rockRow = a.wallBottomRow - 4;
        const nearRock = [-1, 0, 1].some((k) => sc.level.isSolid(Math.floor((p.cx + k * 40) / TILE), rockRow));
        const rockTop = (rockRow) * TILE; // y of the rocks' top edge
        if (b.weak) {
          if (dist > 14) { move = Math.sign(dx); targetBottom = nearRock && dist > 60 ? rockTop - 10 : headY - 20; }
          else dive = true; // right above her head: swim down onto it
        } else {
          // hover just above her head; sidestep the bubbles of a tentacle slam
          targetBottom = headY - 36;
          const danger = a.hazards.find((h) => h.shadowX !== undefined && h.shadowX !== null && Math.abs(h.shadowX - p.cx) < 56);
          const mid = (a.left + a.right) / 2;
          if (danger) move = danger.shadowX < p.cx ? 1 : -1;
          else if (a.inInk(p.cx) && !a.inInk(b.cx)) move = a.ink.side < 0 ? 1 : -1;
          else if (Math.abs(dx) > 12) move = Math.sign(dx);
          if (move < 0 && p.x < a.left + 20) move = 1;
          if (move > 0 && p.x + p.w > a.right - 20) move = -1;
          if (shellsNear(a, p)) targetBottom = a.floorY - 215; // above the top shell
          if (nearRock && Math.abs(dx) > 60) targetBottom = Math.min(targetBottom, rockTop - 10);
          void mid;
        }
      }
      if (dive || p.bottom < targetBottom - 24) keys.held.add('down');
      else if (p.bottom > targetBottom + 8 ? f % 8 === 0 : f % 22 === 0) keys.pressed.add('jump');
      if (move > 0) keys.held.add('right');
      if (move < 0) keys.held.add('left');
      Game.time += STEP;
      sc.update(STEP);
      Input.endStep();
      continue;
    }
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
      } else if (a.kind === 'duke' && (st === 'dive' || st === 'tunnel')) {
        // Digger Duke tunnels toward us: run from the dirt mound (walking over it is safe)
        const md = (b.moundX !== null && b.moundX !== undefined ? b.moundX : b.cx) - p.cx;
        move = -Math.sign(md) || 1;
        // don't get cornered: near a wall, double back over the mound (safe while he's underground)
        if ((move < 0 && p.x < a.left + 140) || (move > 0 && p.x + p.w > a.right - 140)) move = -move;
      } else if (a.kind === 'duke' && (st === 'rumble' || st === 'pop')) {
        const md = (b.moundX !== null && b.moundX !== undefined ? b.moundX : b.cx) - p.cx;
        if (Math.abs(md) < b.w / 2 + 40) {
          move = -Math.sign(md) || 1; // just clear of where he bursts up
          // cornered against a wall: run over the mound to the other side instead
          if ((move < 0 && p.x < a.left + 60) || (move > 0 && p.x + p.w > a.right - 60)) move = -move;
        }
      } else if ((st === 'rise' || st === 'wake') && b.y + b.h > a.floorY - 150) {
        if (dist < b.w / 2 + 40) move = -Math.sign(dx) || 1; // it's getting up: back off, don't jump into it
        if ((move < 0 && p.x < a.left + 30) || (move > 0 && p.x + p.w > a.right - 30)) move = -move;
      } else if (a.kind === 'grumble' && st === 'gusting') {
        move = a.wind ? -Math.sign(a.wind) : 0; // Grumblecloud's gust: run against it
      } else if (a.rain && a.inRain(p.cx) && !a.hazards.some((h) => h.shadowX !== undefined && h.shadowX !== null && Math.abs(h.shadowX - p.cx) < 60)) {
        move = a.rain.side < 0 ? 1 : -1; // get out of the downpour
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
        // Frostbeak's diagonal swoop: stand where her path passes high enough overhead
        if ((st === 'hover' || st === 'dive') && b.target !== null && b.target !== undefined && a.kind === 'frostbeak') {
          const sx = b.cx, sy = a.floorY - (b.y + b.h), tx2 = b.target;
          const between = (p.cx - tx2) * (sx - p.cx) > 0;
          const hAt = between ? sy * Math.abs(p.cx - tx2) / Math.max(1, Math.abs(sx - tx2)) : 999;
          if (hAt < p.h + 30) move = Math.sign(sx - p.cx) || 1; // move toward where she starts: the path is higher there
          else if (Math.abs(tx2 - p.cx) >= keepAway) move = 0;
        }
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
    // blocked by a ledge or wall while running (not just slow to start on ice): hop up onto / over it
    const stuckHere = Math.abs(p.x - (lastX === null ? p.x + 99 : lastX)) < 0.05;
    lastX = p.x;
    if (move && p.onGround && !jump && stuckHere && (blockedFor = (blockedFor || 0) + 1) > 6) { jump = true; hop = 30; blockedFor = 0; }
    if (!move || !stuckHere) blockedFor = 0;
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
  for (const kind of ['older', 'younger', 'grownup', 'firewoman']) {
    const r = bossBot(li, kind);
    print(`boss bot L${li + 1} ${BOSS_TYPES[def.boss].name.padEnd(14)} ${kind.padEnd(8)}: ${r.won ? 'BEATEN' : 'not beaten'} in ${formatTime(r.seconds)}, ${r.deaths} lives lost (stomps only, small)`);
    check(r.won, `${BOSS_TYPES[def.boss].name} not beaten by stomps with ${kind}`);
  }
});


// ---- Fire Woman's long jump: about 25% further at normal height
function longestJump(kind) {
  const level = new Level(0);
  for (let tx = 20; tx < 80; tx++) for (let ty = 0; ty < level.rows - 2; ty++) level.set(tx, ty, '.');
  for (let tx = 20; tx < 80; tx++) { level.set(tx, level.rows - 2, '#'); level.set(tx, level.rows - 1, '#'); }
  const p = new Player(kind, 22 * TILE, (level.rows - 2) * TILE);
  p.onGround = true;
  let takeoff = null, peak = 0, dist = 0;
  const floor = (level.rows - 2) * TILE;
  for (let f = 0; f < 400; f++) {
    keys.held.clear(); keys.pressed.clear();
    keys.held.add('right');
    if (f === 60) keys.pressed.add('jump');
    if (f >= 60) keys.held.add('jump');
    const was = p.onGround;
    p.update(STEP, level, { onHeadBump() {}, particles: { dust() {} }, killPlayer() {} });
    if (was && !p.onGround && takeoff === null) takeoff = p.x;
    if (takeoff !== null) peak = Math.max(peak, floor - p.bottom);
    if (takeoff !== null && p.onGround) { dist = p.x - takeoff; break; }
  }
  keys.held.clear();
  return { dist, peak };
}
{
  const j = {};
  for (const k of ['older', 'younger', 'grownup', 'firewoman']) j[k] = longestJump(k);
  const others = ['older', 'younger', 'grownup'];
  const avg = others.reduce((a, k) => a + j[k].dist, 0) / 3;
  const ratio = j.firewoman.dist / avg;
  print(`jumps: ${Object.entries(j).map(([k, v]) => `${k} ${Math.round(v.dist)}px/${Math.round(v.peak)}px high`).join(', ')}; Fire Woman ${Math.round((ratio - 1) * 100)}% further`);
  check(ratio > 1.2 && ratio < 1.4, 'Fire Woman jumps about 25% further');
  check(Math.abs(j.firewoman.peak - j.older.peak) / j.older.peak < 0.08, 'Fire Woman jumps to normal height');
  check(others.every((k) => j.firewoman.dist > j[k].dist * 1.12), 'Fire Woman out-jumps everyone');
}

// ---- Swimming (Coral Reef)
try {
  Game.character = 'older';
  Game.setScene(new PlayScene(REEF));
  const sw = Game.scene;
  const pl = sw.player;
  const lvl = sw.level;
  check(lvl.underwater && lvl.surfaceY > 0, 'reef is an underwater level');
  // walk off the beach into the sea
  keys.held.add('right');
  for (let f = 0; f < 240 && !pl.swimming; f++) step(1, false);
  keys.held.clear();
  check(pl.swimming, 'diving in from the beach starts swimming');
  // slow sink when idle, strokes rise, down sinks faster
  placeOn(sw, 60, lvl.surfaceY + 5 * TILE); pl.onGround = false; pl.vy = 0;
  step(40, false);
  check(pl.vy > 0 && pl.vy <= SWIM.sink + 1, 'slowly sinks when no key is pressed');
  const y0 = pl.y;
  for (let f = 0; f < 40; f++) { if (f % 8 === 0) keys.pressed.add('jump'); step(1, false); }
  check(pl.y < y0 - 30, 'tapping jump swims upward');
  keys.held.add('down'); step(20, false); keys.held.clear();
  check(pl.vy > SWIM.sink + 50, 'holding down sinks faster');
  // can't leave the water
  for (let f = 0; f < 120; f++) { if (f % 6 === 0) keys.pressed.add('jump'); step(1, false); }
  check(pl.y >= lvl.surfaceY - pl.h * 0.3 - 1, "can't swim above the surface");
  // 70% speed
  keys.held.add('right'); step(90, false); keys.held.clear();
  check(Math.abs(pl.vx - pl.cfg.speed * 0.7) < 2, 'swims left/right at 70% speed');
  // air meter: 30 s, vent refills, running out costs a life
  pl.update = pl.update; // (real physics)
  const vent = lvl.vents[0];
  pl.air = 5;
  placeOn(sw, vent.tx, (vent.ty - 2) * TILE); pl.onGround = false;
  step(2, false);
  check(pl.air > AIR.max - 1, 'air vent refills the air meter');
  placeOn(sw, vent.tx + 6, lvl.surfaceY + 4 * TILE); pl.onGround = false;
  pl.air = AIR.max;
  for (let f = 0; f < 60 * 29 && sw.lives === 3; f++) { if (f % 20 === 0) keys.pressed.add('jump'); step(1, false); }
  check(sw.lives === 3, 'air lasts 30 seconds');
  for (let f = 0; f < 60 * 3 && sw.lives === 3; f++) { if (f % 20 === 0) keys.pressed.add('jump'); step(1, false); }
  check(sw.lives === 2, 'running out of air costs a life');
  // currents push
  Game.setScene(new PlayScene(REEF));
  const cs2 = Game.scene;
  let cx0 = -1, cy0 = -1;
  cs2.level.tiles.forEach((r, ty) => r.forEach((ch, tx) => { if (ch === '>' && cx0 < 0) { cx0 = tx; cy0 = ty; } }));
  placeOn(cs2, cx0 + 1, (cy0 + 1) * TILE); cs2.player.onGround = false;
  const px0 = cs2.player.x;
  step(30, false);
  check(cs2.player.x > px0 + 30, 'a > current pushes the player right');
} catch (e) {
  failures++;
  print('EXCEPTION (swimming): ' + e + '\n' + e.stack);
}

// ---- Sea creatures
try {
  Game.character = 'older';
  Game.setScene(new PlayScene(REEF));
  const sea = Game.scene;
  const find = (cls) => sea.enemies.find((e) => e instanceof cls);
  const stomp = (e) => {
    const p = sea.player;
    e.active = true;
    const hb = e.hitbox;
    p.x = hb.x + hb.w / 2 - p.w / 2; p.y = hb.y - p.h + 4; p.vy = 100; p.prevBottom = hb.y - 1; p.invuln = 0;
    sea.checkCollisions();
  };
  const crab = find(Crab);
  stomp(crab);
  check(crab.killed, 'crab: stomped from above');
  const jelly = find(Jellyfish);
  stomp(jelly);
  check(!jelly.killed && sea.player.state === 'dead', "jellyfish: its top stings, can't be stomped");
  Game.setScene(new PlayScene(REEF));
  const sea2 = Game.scene;
  const puff = sea2.enemies.find((e) => e instanceof Pufferfish);
  puff.active = true;
  const near = { cx: puff.x + 40, y: puff.y, h: 20, state: 'play' };
  puff.update(STEP, sea2.level, near);
  check(puff.puffed, 'pufferfish puffs up when the player comes close');
  const hb = puff.hitbox;
  check(!puff.stompable && hb.w >= 40, 'puffed pufferfish is a big spiky ball');
  for (let f = 0; f < 125; f++) puff.update(STEP, sea2.level, { cx: 99999, y: 0, h: 20, state: 'play' });
  check(!puff.puffed && puff.stompable, 'pufferfish deflates after 2 s');
  const eel = sea2.enemies.find((e) => e instanceof Eel);
  eel.active = true;
  let warnF = -1, outF = -1;
  for (let f = 0; f < 120 && outF < 0; f++) {
    eel.update(STEP, sea2.level, { cx: (eel.holeTx + 0.5) * TILE + eel.dir * 3 * TILE - (eel.dirSet ? 0 : 0) + (f === 0 ? 0 : 0), y: eel.holeTy * TILE, h: 30, state: 'play', get cxv() { return 0; } });
    if (f === 0) { /* first frame sets direction */ }
    if (eel.mode === 'warn' && warnF < 0) warnF = f;
    if (eel.mode === 'out' && outF < 0) outF = f;
  }
  check(eel.hitbox === null || warnF >= 0, 'eel hides until the player passes');
  check(warnF >= 0 && Math.abs(outF - warnF - 60) <= 2, `eel: bubbles warn 1 s before it darts out (${outF - warnF} frames)`);
} catch (e) {
  failures++;
  print('EXCEPTION (sea creatures): ' + e + '\n' + e.stack);
}

// ---- Crystal Caves and Cloud Kingdom mechanics
function findChar(level, ch) {
  for (let tx = 0; tx < level.cols; tx++) for (let ty = 0; ty < level.rows; ty++) if (level.get(tx, ty) === ch) return [tx, ty];
  return null;
}
try {
  Game.character = 'older';
  // thin clouds: jump up through from below, land on top, ↓ drops through
  Game.setScene(new PlayScene(CLOUDS));
  let cs = Game.scene;
  let [tx, ty] = findChar(cs.level, '~');
  placeOn(cs, tx, (ty + 3) * TILE); cs.player.onGround = true;
  keys.pressed.add('jump'); keys.held.add('jump');
  let above = false;
  for (let f = 0; f < 90; f++) { step(1, false); if (cs.player.bottom <= ty * TILE && cs.player.onGround) { above = true; break; } }
  keys.held.clear();
  check(above, 'thin cloud: jump up through it and land on top');
  keys.held.add('down'); step(3, false); keys.held.clear();
  step(10, false);
  check(cs.player.bottom > ty * TILE + 4, 'thin cloud: ↓ drops through it');
  // spring cloud: about 3x the height of a normal jump
  Game.setScene(new PlayScene(CLOUDS));
  cs = Game.scene;
  [tx, ty] = findChar(cs.level, '^');
  const floor = ty * TILE;
  placeOn(cs, tx, floor); cs.player.onGround = true;
  let peak = 0;
  for (let f = 0; f < 90; f++) { step(1, false); peak = Math.max(peak, floor - cs.player.bottom); }
  check(peak > 124 * 2.6 && peak < 124 * 3.4, `spring cloud: launches about 3x a normal jump (${Math.round(peak)} px)`);
  // rain cloud: rains 1 s after landing, then vanishes; back after 3 s
  Game.setScene(new PlayScene(CLOUDS));
  cs = Game.scene;
  [tx, ty] = findChar(cs.level, 'g');
  placeOn(cs, tx, ty * TILE); cs.player.onGround = true;
  step(50, false);
  check(cs.level.get(tx, ty) === 'g', 'rain cloud: still there after 0.8 s');
  step(15, false);
  check(cs.level.get(tx, ty) === '.', 'rain cloud: gone after 1 s');
  cs.player.update = function () {}; cs.player.y = 0;
  step(60 * 3 + 10, false);
  check(cs.level.get(tx, ty) === 'g', 'rain cloud: comes back after 3 s');
  // wind zone pushes sideways (to the left)
  Game.setScene(new PlayScene(CLOUDS));
  cs = Game.scene;
  [tx, ty] = findChar(cs.level, 'W');
  placeOn(cs, tx, (ty + 2) * TILE); cs.player.onGround = false; cs.player.vy = 0;
  const wx = cs.player.x;
  cs.player.y = ty * TILE; step(10, false);
  check(cs.player.x < wx - 10, 'wind zone pushes the player sideways');
  // mine cart carries the player
  Game.setScene(new PlayScene(CAVES));
  let cv = Game.scene;
  const cart = cv.level.movers.find((m) => m.kind === 'cart');
  check(!!cart && cart.ax > 0, 'mine carts roll back and forth on rails');
  cv.level.time = 0; cv.level.placeMovers(0);
  cv.player.x = cart.x + 8; cv.player.y = cart.y - cv.player.h - 1; cv.player.vy = 0;
  step(3, false);
  const onX = cv.player.x;
  step(40, false);
  check(cv.player.state === 'play' && cv.player.x > onX + 40 && Math.abs(cv.player.bottom - cart.y) < 3, 'riding a mine cart');
  // crystal coins are worth 5
  Game.setScene(new PlayScene(CAVES));
  cv = Game.scene;
  const cr = cv.coinList.find((c) => c instanceof CrystalCoin);
  cv.player.x = cr.x; cv.player.y = cr.y; const c0 = cv.coins;
  cv.checkCollisions();
  check(cv.coins === c0 + 5, 'crystal coin is worth 5 coins');
  check(cv.level.dark.length > 0, 'the caves have darker tunnels');
  // stalactite shakes 0.7 s when you walk underneath, then drops
  const st = cv.enemies.find((e) => e instanceof Stalactite);
  st.active = true;
  const under = { cx: st.x + st.w / 2, y: st.y + 100, h: 30, state: 'play' };
  st.update(STEP, cv.level, under);
  let fellAt = -1;
  for (let f = 0; f < 80 && fellAt < 0; f++) { st.update(STEP, cv.level, under); if (st.mode === 'fall') fellAt = f; }
  check(Math.abs(fellAt - 42) <= 2, `stalactite drops 0.7 s after shaking starts (${fellAt} frames)`);
  // mole: dirt shakes 0.5 s, up for 2 s, stompable while up
  const mole = cv.enemies.find((e) => e instanceof Mole);
  mole.active = true; mole.cooldown = 0;
  const near = { cx: mole.x, y: mole.y, h: 30, state: 'play' };
  let upAt = -1, downAt = -1;
  for (let f = 0; f < 240; f++) { mole.update(STEP, cv.level, near); if (mole.mode === 'up' && upAt < 0) upAt = f; if (upAt >= 0 && mole.mode === 'hidden' && downAt < 0) downAt = f; }
  check(Math.abs(upAt - 30) <= 2 && Math.abs(downAt - upAt - 120) <= 2, `mole: shakes 0.5 s, up for 2 s (${upAt}, ${downAt - upAt})`);
  check(mole.stompable, 'mole can be stomped while it is up');
  // cave bat swoops when the player walks underneath
  const bat = cv.enemies.find((e) => e instanceof CaveBat);
  bat.active = true;
  bat.update(STEP, cv.level, { cx: bat.x + 20, y: bat.y + 150, h: 30, state: 'play' });
  let dip = 0;
  for (let f = 0; f < 90; f++) { bat.update(STEP, cv.level, { cx: 0, y: 0, h: 30, state: 'play' }); dip = Math.max(dip, bat.y - bat.hy); }
  check(dip > 60, 'cave bat swoops down in an arc');
  // unstompable ones
  const rock = cv.enemies.find((e) => e instanceof RollingRock);
  check(rock && !rock.stompable, "rolling rocks can't be stomped");
  Game.setScene(new PlayScene(CLOUDS));
  cs = Game.scene;
  const spark = cs.enemies.find((e) => e instanceof Spark);
  check(spark && !spark.stompable, "sparks can't be stomped");
  // spark hops over a gap
  spark.active = true;
  let hopped = false;
  for (let f = 0; f < 60 * 8 && !hopped; f++) { spark.update(STEP, cs.level, cs.player); if (spark.vy < -400) hopped = true; }
  check(hopped, 'spark hops over gaps');
  const cl = cs.enemies.find((e) => e instanceof Cloudling);
  cl.active = true;
  const d0 = Math.abs(cl.x - cs.player.x);
  for (let f = 0; f < 60; f++) cl.update(STEP, cs.level, cs.player);
  check(Math.abs(cl.x - cs.player.x) < d0 && cl.stompable, 'cloudling drifts toward the player and can be stomped');
  const gull = cs.enemies.find((e) => e instanceof SkyGull);
  gull.active = true;
  const gy = gull.y, gx0 = gull.x;
  for (let f = 0; f < 60; f++) gull.update(STEP, cs.level, cs.player, 0);
  check(gull.x < gx0 - 100 && gull.y === gy, 'sky gull flies straight across');
  // falling off the clouds costs a life
  Game.setScene(new PlayScene(CLOUDS));
  cs = Game.scene;
  let gapX = -1;
  for (let x = 20; x < cs.level.cols && gapX < 0; x++) { let solid = false; for (let y = 0; y < cs.level.rows; y++) if (cs.level.isFloor(x, y)) solid = true; if (!solid) gapX = x; }
  cs.player.x = gapX * TILE; cs.player.y = 200; cs.player.onGround = false;
  step(120, false);
  check(cs.lives === 2, 'falling off the clouds costs a life');
} catch (e) {
  failures++;
  print('EXCEPTION (caves/clouds): ' + e + '\n' + e.stack);
}

// Level order: easiest to hardest, 7 levels, Cloud Kingdom boss is Grumblecloud
check(LEVELS.length === 7, 'seven levels');
check(LEVELS.map((d) => d.name).join('|') === 'Sunny Meadow|Crystal Caves|Whispering Forest|Cloud Kingdom|Snowy Mountain|Coral Reef|Scorching Desert', 'levels ordered easiest to hardest');
check(LEVELS[CLOUDS].boss === 'grumble' && BOSS_TYPES.grumble.name === 'Grumblecloud', 'Cloud Kingdom boss is Grumblecloud');
check(LEVELS.map((d) => d.timeLimit).join(',') === '180,210,225,240,255,285,300', 'time limits per level');

// ---- Saved scores move to level names (old saves stored the desert at index 3)
{
  const saved = SaveData.data;
  SaveData.data = { levels: { 0: { best: 11, completed: true, bestTime: 90 }, 3: { best: 99, completed: true, bestTime: 200 } }, muted: false };
  SaveData.migrate({ version: undefined });
  check(SaveData.getLevel(0).best === 11 && SaveData.getLevel(DESERT).best === 99 && !SaveData.getLevel(REEF).completed, 'old saves keep the desert score on the desert');
  SaveData.data = saved;
}

// ---- reachability: can each sister (small and big) get from P to the flag with real physics?
const stubScene = { dead: false, onHeadBump() {}, particles: { dust() {} }, killPlayer() { this.dead = true; } };

// Min-heap of [time, ...] entries.
function Heap() {
  const a = [];
  return {
    get size() { return a.length; },
    push(v) {
      a.push(v);
      let i = a.length - 1;
      while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    },
    pop() {
      const top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < a.length && a[l][0] < a[m][0]) m = l;
          if (r < a.length && a[r][0] < a[m][0]) m = r;
          if (m === i) break;
          [a[m], a[i]] = [a[i], a[m]];
          i = m;
        }
      }
      return top;
    },
  };
}

// Dijkstra over "rest" states using the real player physics. On land a state is a standing spot;
// underwater, swim actions end anywhere in the water. Enemies are ignored; air is tracked.
function reach(li, kind, big, breakTile) {
  const level = new Level(li);
  if (breakTile) level.set(breakTile[0], breakTile[1], '.');
  let start, flag;
  for (const s of level.spawns) {
    if (s.type === 'P') start = { cx: s.tx * TILE + 16, bottom: (s.ty + 1) * TILE };
    if (s.type === 'F') flag = new GoalFlag(s.tx, s.ty);
  }
  const coinTiles = new Set(level.spawns.filter((s) => s.type === 'o' || s.type === '*').map((s) => s.tx + ',' + s.ty));
  const got = new Set();
  // moving platforms follow the level clock; states near their paths also remember the phase
  const moverZones = level.movers.map((m) => [m.x0 - 3 * TILE, m.x0 + m.ax + m.w + 3 * TILE]);
  const phaseOf = (x, frames) => (moverZones.some(([a, b]) => x > a && x < b) ? '|' + Math.floor(((frames / 60) % MOVER_PERIOD) / 0.25) : '');
  const clock = (frames) => { level.time = frames / 60; level.placeMovers(level.time); };
  const mk = (x, y, air) => {
    const p = new Player(kind, 0, 0);
    if (big) { p.setBig(true); p.growT = 0; }
    p.x = x; p.y = y; p.onGround = true; p.air = air;
    return p;
  };
  const landActions = [];
  for (const dir of [-1, 0, 1]) {
    for (const j of [0, 3, 8, 14, 999]) {
      for (const hold of j === 999 ? [0] : [1, 5, 10, 16, 40]) landActions.push({ dir, j, hold, delay: 0 });
    }
    if (dir) for (const delay of [8, 16]) landActions.push({ dir, j: 0, hold: 40, delay });
    landActions.push({ dir, j: 999, hold: 0, delay: 0, drop: true }); // ↓ through a thin cloud
  }
  const swimActions = [];
  for (const dir of [-1, 0, 1]) for (const v of ['up', 'hover', 'down']) swimActions.push({ swim: true, dir, v });
  const bucket = level.underwater ? 16 : 6;
  const key = (p, frames) => Math.round(p.x / bucket) + ',' + Math.round(p.y / (level.underwater ? bucket : 1)) + phaseOf(p.x, frames);
  const probe = mk(0, 0, AIR.max);
  const s0 = mk(start.cx - probe.w / 2, start.bottom - probe.h, AIR.max);
  const bestT = new Map([[key(s0, 0), 0]]);
  const queue = Heap();
  queue.push([0, s0.x, s0.y, AIR.max]);
  let reached = false, maxX = 0, finish = Infinity, minAir = AIR.max;
  while (queue.size) {
    const [t0, sx, sy, air0] = queue.pop();
    if (t0 >= finish) break;
    if (t0 > bestT.get(Math.round(sx / bucket) + ',' + Math.round(sy / (level.underwater ? bucket : 1)) + phaseOf(sx, t0))) continue;
    clock(t0);
    const probeP = mk(sx, sy, air0);
    const wet = level.inWater(probeP.cx, probeP.y + probeP.h / 2);
    const under = level.get(Math.floor((probeP.cx) / TILE), Math.floor((probeP.bottom + 1) / TILE));
    const onCrumble = under === '-', onRain = under === 'g';
    for (const a of wet ? swimActions.concat(landActions.filter((x) => x.j < 999)) : landActions) {
      if (onCrumble && a.j > 14) continue; // must leave a crumbling platform before it falls
      if (onRain && a.j > 40) continue; // and a rain cloud within 1 s
      if (a.drop && under !== '~') continue;
      clock(t0); clock(t0); // no leftover platform motion at the start of an action
      const p = mk(sx, sy, air0);
      stubScene.dead = false;
      let airborne = false;
      const frames = a.swim ? 24 : 150;
      for (let f = 0; f < frames; f++) {
        keys.held.clear(); keys.pressed.clear();
        if (a.swim) {
          if (a.dir) keys.held.add(a.dir > 0 ? 'right' : 'left');
          if (a.v === 'up' && f % 8 === 0) keys.pressed.add('jump');
          if (a.v === 'hover' && f % 20 === 0) keys.pressed.add('jump');
          if (a.v === 'down') keys.held.add('down');
        } else {
          const walkLimit = a.j === 999 ? 18 : 999;
          if (a.drop && f < 10) keys.held.add('down');
          if (f >= a.delay && f < walkLimit && a.dir) keys.held.add(a.dir > 0 ? 'right' : 'left');
          if (f === a.j) keys.pressed.add('jump');
          if (f >= a.j && f < a.j + a.hold) keys.held.add('jump');
        }
        clock(t0 + f + 1);
        p.update(STEP, level, stubScene);
        if (stubScene.dead) break;
        const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.01) / TILE);
        const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h - 0.01) / TILE);
        for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (coinTiles.has(tx + ',' + ty)) got.add(tx + ',' + ty);
        if (overlaps(p, flag)) { reached = true; if (t0 + f + 1 < finish) { finish = t0 + f + 1; } break; }
        if (!p.onGround) airborne = true;
        let settled;
        if (a.swim) settled = f === frames - 1;
        else settled = (p.onGround && (a.j === 999 ? f > 18 && p.vx === 0 && !(a.drop && !airborne) : airborne)) || (p.swimming && f > 12 && !wet);
        if (settled) {
          maxX = Math.max(maxX, p.x);
          const t1 = t0 + f + 1;
          const k = key(p, t1);
          if (!bestT.has(k) || t1 < bestT.get(k)) { bestT.set(k, t1); queue.push([t1, p.x, p.y, p.air]); }
          break;
        }
      }
    }
  }
  const missing = [...coinTiles].filter((c) => !got.has(c));
  return { reached, maxTile: Math.floor(maxX / TILE), states: bestT.size, missing, got, seconds: finish / 60 };
}

const GOT = {}; // coins each character reached, per level
for (let li = 0; li < (typeof QUICK !== 'undefined' ? 0 : LEVELS.length); li++) {
  GOT[li] = {};
  for (const kind of ['older', 'younger', 'grownup', 'firewoman']) {
    GOT[li][kind] = new Set();
    for (const big of [false, true]) {
      // underwater the search is slow: big runs only for the two tallest characters (tunnels, ship)
      if (LEVELS[li].underwater && big && (kind === 'older' || kind === 'younger')) continue;
      const r = reach(li, kind, big);
      for (const c of r.got) GOT[li][kind].add(c);
      print(`reach L${li + 1} ${kind.padEnd(8)} ${big ? 'big  ' : 'small'}: ${r.reached ? 'OK   ' : 'STUCK'} fastest ${r.reached ? formatTime(r.seconds) : '-'} / limit ${formatTime(LEVELS[li].timeLimit)} (furthest tile ${r.maxTile}) coins unreached: ${r.missing.length ? r.missing.length : 'none'}`);
      if (r.reached && LEVELS[li].timeLimit - r.seconds < 40) print(`  warning: fastest route leaves only ${Math.round(LEVELS[li].timeLimit - r.seconds)} s`);
      check(r.reached, `L${li + 1} ${kind} ${big ? 'big' : 'small'} cannot reach flag`);
    }
  }
}

for (const kind of ['older', 'younger', 'grownup', 'firewoman']) {
  let bx = -1;
  new Level(SNOW).tiles[12].forEach((ch, i) => { if (ch === 'X' && bx < 0) bx = i + 2; });
  const r = reach(SNOW, kind, kind !== 'grownup', [bx, 12]);
  const room = r.missing.filter((c) => +c.split(',')[0] >= bx - 2 && +c.split(',')[0] <= bx + 2);
  print(`secret room (${kind}, one cracked box broken): unreached room coins: ${room.length ? room.join(' ') : 'none'}`);
  check(room.length === 0, 'secret room not enterable for ' + kind);
}
// Fire Woman bonus areas: coins only her long jump reaches
for (const li of Object.keys(GOT)) {
  const g = GOT[li];
  const fwOnly = [...g.firewoman].filter((c) => !g.older.has(c) && !g.younger.has(c) && !g.grownup.has(c));
  print(`L${+li + 1}: ${fwOnly.length} coins only the Fire Woman can reach`);
  check(fwOnly.length >= 6, `L${+li + 1} Fire Woman bonus area missing (${fwOnly.length})`);
}

const SPEC = [{ carrots: 4, coins: 120, cps: 3 }, { carrots: 5, coins: 140, cps: 3 }, { carrots: 5, coins: 160, cps: 3 }, { carrots: 5, coins: 180, cps: 3 }, { carrots: 6, coins: 200, cps: 3 }, { carrots: 5, coins: 200, cps: 3 }, { carrots: 4, coins: 220, cps: 3 }];
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
