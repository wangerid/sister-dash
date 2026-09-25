# Sister Dash – Game Specification

A 2D side-scrolling platform game that runs in the browser. You play as one of four characters (an older sister, a younger sister, a grown-up or a brown-haired girl called the Fire Girl) and run from left to right: jump over boxes, get past the opposition, collect coins, and grab the flag at the end of each level.

---

## 1. Technical constraints

| Item | Decision |
|---|---|
| Platform | Desktop web browser (Chrome, Safari, Edge) |
| Tech | Plain HTML5 Canvas + JavaScript. No frameworks, no build step |
| Files | `index.html`, `style.css`, `js/*.js` loaded with plain `<script>` tags (no ES modules), so the game works by double-clicking `index.html` |
| Graphics | All art is drawn in code (canvas shapes). No external image files in v1 |
| Sound | Optional in v1. Short beeps made with the Web Audio API, with a mute toggle |
| Resolution | Logical canvas 960×540 (16:9), scaled to fit the window, crisp pixels |
| Frame rate | 60 fps with a fixed-timestep update loop |
| Persistence | Best score per level stored in `localStorage` (wrapped in try/catch) |

---

## 2. Game flow

```
Title screen → Character select → Level select → Play level → Level complete / Game over → back to Level select
```

- **Title screen:** game name and "Press Enter / Click to start".
- **Character select:** all four characters shown side by side, with a one-line description of each one's special ability. Choose with ←/→ and confirm with Enter, or click one.
- **Level select:** four level cards showing name, difficulty, best coin score, best time, and a checkmark if completed. All four levels are unlocked from the start. Level 4 is marked **"Very hard!"** with a small skull-and-sun icon, and gets a crown icon once the boss has been beaten.
- **Time challenge toggle:** on the level select screen the player can switch **Time challenge** ON or OFF (press T or click the stopwatch button). It is OFF by default. See 5.7.
- **Pause:** press P or Esc. Options are Resume, Restart level, and Back to level select.

---

## 3. Characters

Both sisters have **blonde hair**. The grown-up and the Fire Girl have **brown hair**. The four characters look clearly different and play slightly differently.

| | Older sister | Younger sister | Grown-up | Fire Girl |
|---|---|---|---|---|
| Look | Long blonde hair in a ponytail, blue top | Blonde pigtails, **pink t-shirt, black pants** | Tallest, short brown hair, green jacket, jeans | Long brown hair with a red hair band, orange top, dark blue pants |
| Height (small form) | Medium | Shortest | Tallest (still fits under 2-tile gaps) | Medium |
| Run speed | Slightly faster (+10%) | Standard | Standard | Standard |
| Jump | Standard | Slightly higher (+10%) | Slightly lower (−5%) | Standard |
| Special | – | – | Can break cracked boxes even when small | **Shoots fireballs while big** (after eating a magic carrot), see 5.8 |

The differences should be noticeable but small. Every level must be completable with any of the four characters.

### Animations (simple, code-drawn)

Idle, run (legs cycle), jump (arms up), hurt (flash), grow/shrink (quick scale pulse), victory (arms up by the flag).

---

## 4. Controls

| Action | Keys |
|---|---|
| Move left / right | ← / → or A / D |
| Jump | Space, ↑ or W. Holding the key gives a higher jump, a quick tap gives a short hop |
| Shoot fireball (Fire Girl only, while big) | X, Shift or J |
| Pause | P / Esc |
| Confirm in menus | Enter / click |

Movement feel:

- Short acceleration and deceleration, with no ice-like sliding.
- "Coyote time": the player can still jump for 0.1 s after walking off a ledge.
- Jump buffering: a jump pressed 0.1 s before landing still counts.

---

## 5. Core mechanics

### 5.1 Small and big (magic carrot)

- The player **starts small** in every level.
- The rules below apply to all four characters.
- Collecting a **magic carrot** makes the player **big**. She grows to about 1.5× height with a short grow animation and a sparkle.
- Big-only benefits:
  - She can break **cracked boxes** by jumping into them from below.
  - She survives one hit.
- When a big player is hit, she **shrinks back to small** and flashes, invulnerable for 1.5 seconds.
- When a small player is hit, she **loses a life**.
- Carrots appear on the ground or pop out of **surprise boxes** (boxes marked "?").
- Carrots are fairly common: there is one near the start of each level and one right after each checkpoint, plus extras in each level (see section 6).
- Collecting a carrot while already big gives a **+10 coin bonus** instead.

### 5.2 Boxes

| Type | Behaviour |
|---|---|
| Wooden box | Solid obstacle to jump over or stand on |
| Surprise box "?" | Hit from below to release a coin or a carrot, then it turns plain |
| Cracked box | Only a big player (or the grown-up at any size) can break it by hitting it from below. It may hide coins |

### 5.3 Coins

- Spinning gold coins placed in the level, plus coins that come out of surprise boxes.
- A HUD counter shows the number of coins in this level.
- Coins are plentiful: rows and arcs of coins over jumps, coin trails that hint at the right path, and bonus clusters in hard-to-reach spots.
- Every **100 coins** gives an extra life. This is optional and off by default.

### 5.4 Opposition (enemies)

All enemies are original, friendly-looking cartoon creatures.

| Enemy | Behaviour | How to defeat |
|---|---|---|
| Grumpy hedgehog | Walks back and forth and turns at walls and edges | Jump on top of it |
| Bouncing frog | Hops in place or toward the player | Jump on top of it |
| Swooping crow (level 2+) | Flies in a wave pattern | Avoid it, or jump on it |
| Spiky plant (level 3) | Stationary and cannot be stomped | Avoid it |
| Cactus (level 4) | Same as the spiky plant, drawn as a cactus | Avoid it |
| Desert scorpion (level 4) | Walks fast, and dashes toward the player when she is on the same row | Jump on top of it |
| Vulture (level 4) | Circles high up, then dives at the player's position (a shadow on the ground warns 1 s before) | Avoid it, or jump on it |
| Tumbleweed (level 4) | Rolls quickly across the screen with big bounces | Cannot be stomped. Jump over it, or use a fireball |

- Stomping an enemy makes it disappear with a "poof" and gives the player a small bounce.
- Touching an enemy from the side or below counts as a hit (see 5.1).
- Falling into a pit costs a life, whatever size the player is.

### 5.5 Lives and checkpoints

- The player starts with 3 lives. The HUD shows hearts.
- Each level has **two checkpoints**, at about one third and two thirds of the way (small flags that light up). The player respawns at the last one reached after losing a life.
- At 0 lives: Game over screen with Retry level or Back to level select.

### 5.6 Goal flag

- Each level ends with a **flagpole**. Touching it triggers the victory animation.
- A "Level complete!" screen shows coins collected / total coins in level and time taken. In Time challenge mode it also shows the time left.
- The best coin score and best time per level are saved.

### 5.7 Time challenge mode

An optional mode, switched on from the level select screen, where each level must be finished within a time limit.

| Level | Time limit |
|---|---|
| 1 Sunny Meadow | 2:30 |
| 2 Whispering Forest | 3:00 |
| 3 Snowy Mountain | 3:30 |
| 4 Scorching Desert | 5:00 (including the boss) |

The limits are tuned so a normal run finishes with 20–40 seconds to spare. Keep them as easy-to-edit values in `levels.js` so they can be adjusted after playtesting.

- A countdown timer replaces the elapsed-time display in the HUD.
- In the last 10 seconds the timer turns red and pulses, with a tick sound each second.
- **When the timer reaches 0:** a "Time's up!" message is shown, the player **loses one life**, and the player keeps going from where she is with a **1:00 extra-time** countdown. If time runs out again, she loses another life and gets another 1:00.
- If that lost life was the last one, it is Game over.
- Losing a life for other reasons (enemy, pit) does not reset the timer.
- With Time challenge OFF, the game works exactly as before, with no time limit.

### 5.8 Fireballs (Fire Girl)

- Only the Fire Girl can shoot, and only while she is **big** (after eating a magic carrot). Her big form glows slightly orange so the player can see the power is active.
- Press X, Shift or J to throw a fireball in the direction she is facing.
- Fireballs bounce along the ground in small hops, travel about one screen width, and disappear when they hit a wall or leave the screen.
- At most **2 fireballs** can be on screen at once, with a short cooldown (0.3 s) between shots.
- A fireball defeats **any** enemy it touches, including the spiky plant, and gives +1 coin per enemy defeated.
- Fireballs do not break boxes.
- When she is hit and shrinks back to small, she loses the fireball power until she eats another carrot.

---

## 6. Levels

Levels are tile-based (tile = 32×32 px) and defined as **ASCII maps** in `js/levels.js`, so they are easy to edit. Each level is roughly 300–450 tiles wide (about 2–4 minutes of play) and scrolls horizontally, with the camera following the player.

### Tile legend

```
.  empty          #  ground         B  wooden box      ?  surprise box (coin)
C  surprise box (carrot)            X  cracked box     o  coin
c  magic carrot   h  hedgehog       f  frog            w  crow
s  spiky plant    k  checkpoint     F  goal flag       P  player start
z  scorpion       v  vulture        t  tumbleweed      q  quicksand
-  crumbling sandstone platform     K  boss arena start (boss spawns here)
```

In level 4, `s` is drawn as a cactus.

### The four levels

| # | Name | Theme | Difficulty | Length | Carrots | Coins | Content |
|---|---|---|---|---|---|---|---|
| 1 | Sunny Meadow | Green hills, blue sky, clouds | Easy | ~300 tiles | 4 | ~120 | Low boxes, a few hedgehogs, small gaps |
| 2 | Whispering Forest | Dark green trees, mushrooms | Medium | ~375 tiles | 5 | ~160 | Stacked boxes, frogs and crows, wider pits, floating platforms |
| 3 | Snowy Mountain | White and blue, snowy peaks | Harder | ~450 tiles | 6 | ~200 | Tall box staircases, all enemy types, spiky plants, cracked-box secret area |
| 4 | Scorching Desert | Sand dunes, pyramids far away, orange sky, heat shimmer | **Very hard** | ~500 tiles + boss arena | 4 | ~220 | Scorpions, vultures, tumbleweeds, cacti, quicksand, crumbling platforms, long jumps over pits, **boss fight at the end** |

Each level has a different background color palette and simple parallax layers (far hills or trees, near bushes).

### 6.1 Level 4: Scorching Desert (very hard)

This is the hardest level in the game and should feel like a real challenge for a player who has beaten levels 1–3.

**Desert hazards**

- **Quicksand:** the player slowly sinks while standing in it. She can escape by jumping repeatedly. After being fully sunk for 3 seconds she loses a life.
- **Crumbling sandstone platforms:** they shake for 0.5 s after the player lands, then fall. They reappear after 3 seconds.
- **Long pits:** several jumps need a full run-up and a held jump button.
- **Enemy combinations:** for example scorpions on a narrow ledge while a vulture dives, or tumbleweeds rolling toward the player during a staircase of boxes.

**Fairness rules** (hard, but not unfair)

- Every danger is visible or warned about before it hits (vulture shadows, platforms shaking, tumbleweed dust clouds at the screen edge).
- There are no blind jumps: the camera always shows where the player will land.
- There are **three checkpoints**: at about one third, at about two thirds, and **right before the boss arena**.
- Fewer carrots than level 3 (4 in total), but one is always placed just before the boss arena.

**Boss: King Sandclaw**

A huge sand scorpion with a golden crown that waits at the end of the level. There is no flagpole until he is defeated.

- **Arena:** when the player passes the `K` tile, the camera locks and sand walls rise on both sides. The arena is one screen wide, with two floating stone platforms to escape to.
- **Health:** 6 hit points, shown as a boss health bar at the top of the screen with his name.
- **Attacks** (each one is telegraphed so the player can react):

| Attack | Warning | What happens | How to avoid |
|---|---|---|---|
| Claw charge | He stamps and scrapes his feet for 1 s | Charges across the arena and crashes into the wall | Jump onto a platform or over him |
| Stinger rain | He raises his tail and it glows | Stingers fall from the sky in 3–5 spots | Stand where there is no shadow on the ground |
| Sand wave (phase 3 only) | He slams the ground and it shakes | A low sand wave rolls across the floor | Jump over it |

- **How to damage him:**
  - After a **claw charge** he crashes into the wall and is **dizzy for 2 seconds** (stars circle his head). Jumping on his head then removes **1 hit point**.
  - The Fire Girl's **fireballs** also hurt him: **3 fireball hits = 1 hit point**. This is always possible, not only when he is dizzy.
  - Touching him in any other way counts as a normal hit to the player.
- **Phases:**
  - Phase 1 (6–5 HP): slow claw charges and stinger rain.
  - Phase 2 (4–3 HP): faster, with more stingers.
  - Phase 3 (2–1 HP): fastest, and adds the sand wave.
  - He flashes and roars at each phase change, with 1 second of invulnerability.
- **After losing a life** in the arena, the player respawns at the checkpoint just before it and the boss's health is reset to 6.
- **Victory:** he shrinks down into a small, harmless scorpion and scuttles away, 50 coins burst out, the walls sink, and the **goal flagpole rises from the sand**. The player touches the flag to finish the level.
- He must be beatable by every character using stomps alone (no fireballs needed).

---

## 7. HUD

Top bar:

- **Left:** hearts (lives).
- **Center:** level name (replaced by the boss health bar during the boss fight).
- **Right:** coin icon with count, and elapsed time (or the countdown in Time challenge mode).

A small carrot icon shows when the player is currently big. For the Fire Girl, a flame icon shows that fireballs are available.

---

## 8. Code structure

```
index.html
style.css
js/
  main.js        – boot, game loop, scene manager
  input.js       – keyboard state
  scenes.js      – title, character select, level select, play, results, game over
  player.js      – physics, states, small/big, character stats
  fireballs.js   – Fire Girl projectiles
  enemies.js     – enemy types and AI
  boss.js        – King Sandclaw: arena, attacks, phases, health bar
  level.js       – ASCII parsing, tile collision, camera
  levels.js      – the four level maps and time limits
  entities.js    – coins, carrots, boxes, checkpoint, flag, quicksand, crumbling platforms
  render.js      – drawing helpers for characters, tiles, backgrounds
  audio.js       – simple sound effects and mute
  storage.js     – best scores and best times
  timer.js       – elapsed time and Time challenge countdown
```

---

## 9. Build milestones (for Claude Code)

Build and verify one milestone at a time.

1. **Skeleton:** canvas, game loop, keyboard input, and a rectangle that runs and jumps on flat ground.
2. **Level engine:** ASCII level parsing, tile collision, a scrolling camera, and level 1 playable start to flag.
3. **Characters:** both sisters (blonde), the grown-up and the Fire Girl (both brown hair) drawn with animations, plus the character select screen.
4. **Collectibles:** coins, surprise boxes, HUD.
5. **Magic carrot:** small/big states, cracked boxes, hit/shrink logic, invulnerability.
6. **Enemies:** hedgehog and frog first, then crow and spiky plant.
7. **Fireballs:** Fire Girl shooting while big, projectile physics, enemy hits.
8. **Lives and checkpoints:** game over and results screens.
9. **Levels 2 and 3:** level select screen and best-score saving.
10. **Time challenge:** toggle on level select, countdown HUD, time's-up life loss and extra time, best times.
11. **Level 4 – Scorching Desert:** desert enemies, quicksand, crumbling platforms and the level map (with a temporary flag at the end).
12. **Boss – King Sandclaw:** arena lock, attacks, phases, health bar, victory sequence with the rising flagpole.
13. **Polish:** parallax backgrounds, sounds, pause menu, balancing.

---

## 10. Acceptance criteria

- [ ] The game starts by opening `index.html` in a browser, with no install and no server.
- [ ] The player can pick one of four characters: two blonde sisters, a brown-haired grown-up and the brown-haired Fire Girl, all visibly distinct.
- [ ] The younger sister wears a pink t-shirt and black pants.
- [ ] The player can pick any of the 4 levels from the level select screen.
- [ ] The player can run, jump (variable height) and land on boxes and platforms.
- [ ] Coins can be collected and the count is shown in the HUD.
- [ ] A magic carrot makes the player big. Getting hit while big makes her small, and getting hit while small costs a life.
- [ ] Enemies can be defeated by stomping (except the spiky plant) and hurt the player on side contact.
- [ ] The Fire Girl can shoot fireballs only while big, and they defeat any enemy.
- [ ] With Time challenge ON, running out of time costs one life and gives 1:00 extra time. With it OFF, there is no time limit.
- [ ] Touching the flag completes the level and shows the coin score.
- [ ] Every level can be completed with all four characters, with and without Time challenge.
- [ ] Level 4 is a desert level that is clearly harder than level 3, and ends with the King Sandclaw boss fight.
- [ ] The boss has 6 hit points, three phases, telegraphed attacks, and can be beaten by stomping alone.
- [ ] The goal flag in level 4 only appears after the boss is defeated.
- [ ] Each level has the number of carrots and roughly the number of coins listed in section 6.
- [ ] Runs smoothly at 60 fps on a normal laptop.

---

## 11. Out of scope for v1 (possible later)

- Two-player mode (two characters at once)
- Touch controls for iPad or phone
- Level editor
- Music tracks
- More power-ups (for example a golden carrot that gives temporary invincibility)
