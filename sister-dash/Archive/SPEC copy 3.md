# Sister Dash – Game Specification

A 2D side-scrolling platform game that runs in the browser. You play as one of four characters (an older sister, a younger sister, a grown-up or the Fire Woman) and run from left to right: jump over boxes, get past the opposition, collect coins, beat the boss and grab the flag at the end of each level.

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
- **Character select:** all four characters shown side by side, with a one-line description of each one's special ability and what they shoot. Choose with ←/→ and confirm with Enter, or click one.
- **Level select:** five level cards showing name, difficulty, best coin score, best time, and a checkmark if completed. All five levels are unlocked from the start. Every card shows the level's boss, and gets a crown icon once that boss has been beaten. Level 5 is marked **"Very hard!"** with a small skull-and-sun icon.
- **Time challenge toggle:** on the level select screen the player can switch **Time challenge** ON or OFF (press T or click the stopwatch button). It is OFF by default. See 5.7.
- **Pause:** press P or Esc. Options are Resume, Restart level, and Back to level select.

---

## 3. Characters

Both sisters have **blonde hair**. The grown-up and the Fire Woman have **brown hair**. The four characters look clearly different and play slightly differently.

| | Older sister | Younger sister | Grown-up | Fire Woman |
|---|---|---|---|---|
| Look | Long blonde hair in a ponytail, blue top | Blonde pigtails, **pink t-shirt, black pants** | Tall, short brown hair, green jacket, jeans | Adult woman, tall, long brown hair with a red hair band, orange jacket, dark blue jeans |
| Height (small form) | Medium | Shortest | Tallest (still fits under 2-tile gaps) | Tall (same as the grown-up) |
| Run speed | Slightly faster (+10%) | Standard | Standard | Standard |
| Jump | Standard | Slightly higher (+10%) | Slightly lower (−5%) | **Jumps further than everyone else** (see below) |
| Special | – | – | Can break cracked boxes even when small | **Long jump** |
| Shoots (while big) | Sparkle stars | Bubbles | Boomerang | Fireballs |

**Fire Woman's long jump:** her jumps carry about **25% further** horizontally than the other characters' (faster air speed and slightly longer hang time), at normal height. Each level has 1–2 optional **bonus coin areas** across wide gaps that only she can reach. These are always optional: the main path must be completable by every character.

The differences should be noticeable but small. Every level must be completable with any of the four characters.

### Animations (simple, code-drawn)

Idle, run (legs cycle), jump (arms up), swim (arm strokes, level 4), throw/shoot, hurt (flash), grow/shrink (quick scale pulse), victory (arms up by the flag).

---

## 4. Controls

| Action | Keys |
|---|---|
| Move left / right | ← / → or A / D |
| Jump | Space, ↑ or W. Holding the key gives a higher jump, a quick tap gives a short hop |
| Swim (underwater level) | Tap Space, ↑ or W repeatedly to swim upward. ↓ or S swims down faster |
| Shoot (all characters, while big) | X, Shift or J |
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
  - She can **shoot** (see 5.8).
  - She can break **cracked boxes** by jumping into them from below.
  - She survives one hit.
- When a big player is hit, she **shrinks back to small** and flashes, invulnerable for 1.5 seconds. She can't shoot until she eats another carrot.
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

| Enemy | Level | Behaviour | How to defeat |
|---|---|---|---|
| Grumpy hedgehog | 1+ | Walks back and forth and turns at walls and edges | Jump on top of it |
| Bouncing frog | 1+ | Hops in place or toward the player | Jump on top of it |
| Swooping crow | 2+ | Flies in a wave pattern | Avoid it, or jump on it |
| Spiky plant | 3 | Stationary and cannot be stomped | Avoid it, or shoot it |
| Crab | 4 | Walks sideways along the sea floor, snapping its claws | Swim down on top of it |
| Jellyfish | 4 | Bobs slowly up and down. Its top stings, so it cannot be stomped | Avoid it, or shoot it |
| Pufferfish | 4 | Swims slowly, and puffs up into a spiky ball for 2 s when the player comes close | Stomp it while it is not puffed up, or shoot it |
| Eel | 4 | Hides in a rock hole and darts out when the player passes (bubbles at the hole warn 1 s before) | Avoid it, or shoot it when it is out |
| Cactus | 5 | Same as the spiky plant, drawn as a cactus | Avoid it, or shoot it |
| Desert scorpion | 5 | Walks fast, and dashes toward the player when she is on the same row | Jump on top of it |
| Vulture | 5 | Circles high up, then dives at the player's position (a shadow on the ground warns 1 s before) | Avoid it, or jump on it |
| Tumbleweed | 5 | Rolls quickly across the screen with big bounces | Cannot be stomped. Jump over it, or shoot it |

- Stomping an enemy makes it disappear with a "poof" and gives the player a small bounce.
- Touching an enemy from the side or below counts as a hit (see 5.1).
- Falling into a pit costs a life, whatever size the player is.

### 5.5 Lives and checkpoints

- The player starts with 3 lives. The HUD shows hearts.
- Each level has **three checkpoints**: at about one third, at about two thirds, and right before the boss arena (small flags that light up). The player respawns at the last one reached after losing a life.
- At 0 lives: Game over screen with Retry level or Back to level select.

### 5.6 Goal flag

- Each level ends with a boss fight (see 6.3). When the boss is beaten, a **flagpole** rises. Touching it triggers the victory animation.
- A "Level complete!" screen shows coins collected / total coins in level and time taken. In Time challenge mode it also shows the time left.
- The best coin score and best time per level are saved.

### 5.7 Time challenge mode

An optional mode, switched on from the level select screen, where each level must be finished within a time limit.

| Level | Time limit |
|---|---|
| 1 Sunny Meadow | 3:00 (including the boss) |
| 2 Whispering Forest | 3:45 (including the boss) |
| 3 Snowy Mountain | 4:15 (including the boss) |
| 4 Coral Reef | 4:45 (including the boss) |
| 5 Scorching Desert | 5:00 (including the boss) |

The limits are tuned so a normal run finishes with 20–40 seconds to spare. Keep them as easy-to-edit values in `levels.js` so they can be adjusted after playtesting.

- A countdown timer replaces the elapsed-time display in the HUD.
- In the last 10 seconds the timer turns red and pulses, with a tick sound each second.
- **When the timer reaches 0:** a "Time's up!" message is shown, the player **loses one life**, and the player keeps going from where she is with a **1:00 extra-time** countdown. If time runs out again, she loses another life and gets another 1:00.
- If that lost life was the last one, it is Game over.
- Losing a life for other reasons (enemy, pit, running out of air) does not reset the timer.
- With Time challenge OFF, the game works exactly as before, with no time limit.

### 5.8 Shooting (all characters)

Every character can shoot while she is **big** (after eating a magic carrot), and each one shoots something different. While big, the character glows faintly in her shot's color so the player can see the power is active. Press X, Shift or J to shoot in the direction she is facing.

| Character | Shot | How it moves | On screen at once | Cooldown |
|---|---|---|---|---|
| Older sister | **Sparkle stars** (small spinning yellow stars) | Fly fast in a straight line, about 1.5 screen widths | 3 | 0.25 s |
| Younger sister | **Bubbles** (big shiny soap bubbles) | Float slowly forward and gently upward. An enemy that is hit gets trapped in the bubble and floats off the screen | 3 | 0.4 s |
| Grown-up | **Boomerang** | Flies forward about 5 tiles, then curves back to the thrower, hitting enemies both ways | 1 | Can throw again when it's caught |
| Fire Woman | **Fireballs** | Bounce along the ground in small hops, about one screen width | 2 | 0.3 s |

Shared rules for all shots:

- A shot defeats **any** enemy it touches, including enemies that can't be stomped (spiky plant, jellyfish, cactus, tumbleweed), and gives +1 coin per enemy defeated.
- Shots disappear when they hit a wall or leave the screen (the boomerang flies back through walls to the thrower instead).
- Shots do not break boxes.
- **Underwater (level 4):** all shots move at half speed and in a straight line. Fireballs turn into hot steam bubbles and bubbles float faster, but they work the same.
- **Bosses:** 3 shot hits = 1 boss hit point, for every character (see 6.3).

---

## 6. Levels

Levels are tile-based (tile = 32×32 px) and defined as **ASCII maps** in `js/levels.js`, so they are easy to edit. Each level is roughly 300–500 tiles wide (about 2–4 minutes of play) and scrolls horizontally, with the camera following the player.

### Tile legend

```
.  empty          #  ground         B  wooden box      ?  surprise box (coin)
C  surprise box (carrot)            X  cracked box     o  coin
c  magic carrot   h  hedgehog       f  frog            w  crow
s  spiky plant    k  checkpoint     F  goal flag       P  player start
r  crab           j  jellyfish      p  pufferfish      e  eel hole
a  air bubble vent                  <  water current (pushes left)
>  water current (pushes right)     %  seaweed / coral (decoration)
z  scorpion       v  vulture        t  tumbleweed      q  quicksand
-  crumbling sandstone platform     K  boss arena start (boss spawns here)
```

In level 5, `s` is drawn as a cactus. Level 4 has an `underwater: true` flag in `levels.js` that switches on the swimming rules in 6.1.

### The five levels

| # | Name | Theme | Difficulty | Length | Carrots | Coins | Content |
|---|---|---|---|---|---|---|---|
| 1 | Sunny Meadow | Green hills, blue sky, clouds | Easy | ~300 tiles + boss arena | 4 | ~120 | Low boxes, a few hedgehogs, small gaps, **boss: Big Bristle** |
| 2 | Whispering Forest | Dark green trees, mushrooms | Medium | ~375 tiles + boss arena | 5 | ~160 | Stacked boxes, frogs and crows, wider pits, floating platforms, **boss: Queen Croakia** |
| 3 | Snowy Mountain | White and blue, snowy peaks | Harder | ~450 tiles + boss arena | 6 | ~200 | Tall box staircases, all enemy types so far, spiky plants, cracked-box secret area, **boss: Frostbeak** |
| 4 | Coral Reef | Deep blue sea, colourful coral, seaweed, light rays from above, a sunken ship | Hard | ~450 tiles + boss arena | 5 | ~200 | Swimming, crabs, jellyfish, pufferfish, eels, water currents, air bubbles, **boss: Admiral Octavia** |
| 5 | Scorching Desert | Sand dunes, pyramids far away, orange sky, heat shimmer | **Very hard** | ~500 tiles + boss arena | 4 | ~220 | Scorpions, vultures, tumbleweeds, cacti, quicksand, crumbling platforms, long jumps over pits, **boss: King Sandclaw** |

Each level has a different background color palette and simple parallax layers (far hills or trees, near bushes; in level 4, far rocks and near coral).

### 6.1 Level 4: Coral Reef (underwater)

The whole level takes place under the sea. The player dives in from a small beach at the start and swims the rest of the way.

**Swimming rules**

- Gravity is much weaker: the player slowly sinks when no key is pressed.
- Each tap of the jump key is a swim stroke upward. Holding ↓ or S sinks faster.
- Left/right movement is about 70% of normal speed, with a little drift when changing direction.
- The player can stand and walk on the sea floor and on rocks, and swim onto enemies from above to stomp them.
- The top of the level is the water surface, and the player can't leave the water.

**Air meter**

- An air meter (a row of 10 bubbles) is shown in the HUD. It empties over **30 seconds**.
- Swimming through an **air bubble vent** (`a`, a stream of rising bubbles) refills it completely. Vents are placed at least every 20 seconds of normal swimming.
- When 3 bubbles are left, the meter blinks and a warning sound plays.
- If the air runs out, the player loses a life.

**Other hazards**

- **Water currents** (`<` and `>`): areas with visible streaming lines that push the player sideways. Some help her along, others must be fought against.
- **Narrow coral tunnels** with jellyfish bobbing through them, so timing matters.
- **Sunken ship section:** a short part inside a shipwreck with low ceilings and eels in the walls.

**Boss:** Admiral Octavia (see 6.3).

### 6.2 Level 5: Scorching Desert (very hard)

This is the hardest level in the game and should feel like a real challenge for a player who has beaten levels 1–4.

**Desert hazards**

- **Quicksand:** the player slowly sinks while standing in it. She can escape by jumping repeatedly. After being fully sunk for 3 seconds she loses a life.
- **Crumbling sandstone platforms:** they shake for 0.5 s after the player lands, then fall. They reappear after 3 seconds.
- **Long pits:** several jumps need a full run-up and a held jump button.
- **Enemy combinations:** for example scorpions on a narrow ledge while a vulture dives, or tumbleweeds rolling toward the player during a staircase of boxes.

**Fairness rules** (hard, but not unfair)

- Every danger is visible or warned about before it hits (vulture shadows, platforms shaking, tumbleweed dust clouds at the screen edge).
- There are no blind jumps: the camera always shows where the player will land.
- Fewer carrots than level 3 (4 in total), but one is always placed just before the boss arena.

**Boss:** King Sandclaw (see 6.3).

### 6.3 Bosses

**Every level ends with a boss fight.** The bosses get harder level by level, so the first one is a gentle introduction and King Sandclaw in the desert is the final, toughest challenge.

#### Shared boss rules (all five bosses)

- **No flagpole until the boss is beaten.** The level map ends in a boss arena instead.
- **Checkpoint before the arena:** every level has a checkpoint right before the arena, plus a carrot surprise box next to it.
- **Arena:** when the player passes the `K` tile, the camera locks and walls rise on both sides. The arena is one screen wide, with 1–2 floating platforms (their positions depend on the boss).
- **Intro:** the boss appears with a short 2-second entrance (roar or jump in) and its name on screen. The player can't move during the intro and can't be hurt.
- **Health bar:** a boss health bar with the boss's name replaces the level name at the top of the screen.
- **Telegraphed attacks:** every attack has a clear warning (animation, sound, shadow or shake) before it hits.
- **Weak moment:** each boss has a moment after one of its attacks when it is **dizzy or tired for 2 seconds** (stars circle its head). Jumping on its head then removes **1 hit point**.
- **Shots:** 3 shot hits from any character = 1 hit point. This works at any time.
- **Contact:** touching the boss at any other moment counts as a normal hit to the player.
- **After a hit:** the boss flashes and is invulnerable for 1 second, and the player bounces off.
- **Losing a life in the arena:** the player respawns at the checkpoint before the arena, and the boss is back to full health.
- **Victory:** the boss turns into a small, harmless version of itself and runs away. Coins burst out, the walls sink, and the **goal flagpole rises** from the ground. The player touches the flag to finish.
- **Stomps alone:** every boss must be beatable by every character using stomps only (no shooting needed).
- **Crowns:** a crown icon on the level select card shows that the boss has been beaten.

#### Overview

| Level | Boss | Difficulty | HP | Phases | Victory coins |
|---|---|---|---|---|---|
| 1 Sunny Meadow | Big Bristle, a giant grumpy hedgehog | Easy | 3 | 1 | 20 |
| 2 Whispering Forest | Queen Croakia, a giant frog with a leaf crown | Medium | 4 | 2 | 30 |
| 3 Snowy Mountain | Frostbeak, a giant snow owl | Hard | 5 | 2 | 40 |
| 4 Coral Reef | Admiral Octavia, a giant purple octopus in an admiral's hat | Hard+ | 5 | 3 | 45 |
| 5 Scorching Desert | King Sandclaw, a giant sand scorpion with a golden crown | Very hard | 6 | 3 | 50 |

#### Boss 1: Big Bristle (Sunny Meadow)

A round, grumpy hedgehog the size of a small car. Slow and easy to read, it teaches the player how boss fights work.

| Attack | Warning | What happens | How to avoid |
|---|---|---|---|
| Spiky roll | Curls into a ball and wobbles for 1.5 s | Rolls across the arena and bumps into the wall | Jump over it, or onto the platform |
| Spine shake (after 2 HP lost) | Shakes and puffs up | 3 slow spines fly up in an arc and land | Step away from the landing spots (shadows) |

- **Weak moment:** after bumping into the wall at the end of a roll, it is dizzy for 2.5 seconds (a little longer than the other bosses).
- **Arena:** one low platform in the middle.

#### Boss 2: Queen Croakia (Whispering Forest)

A huge green frog with a crown of leaves who lives in a pond clearing.

| Attack | Warning | What happens | How to avoid |
|---|---|---|---|
| Big jump | Crouches and puffs her cheeks for 1 s | Leaps high and lands where the player is (a shadow shows where) | Move away from the shadow |
| Ground shock | Always follows a big jump | A small shockwave runs along the floor on both sides | Jump over it |
| Tongue grab (phase 2) | Opens her mouth and her eyes glow | Her tongue shoots straight out across the arena at the player's height | Jump over it, or stand on a platform |
| Tadpole call (phase 2) | Croaks loudly | 2 small frogs hop into the arena | Stomp them, or avoid them |

- **Weak moment:** after a big jump she is stuck in the mud for 2 seconds.
- **Phases:** phase 1 at 4–3 HP, phase 2 at 2–1 HP (faster jumps, adds tongue grab and tadpole call).
- **Arena:** two lily-pad platforms.

#### Boss 3: Frostbeak (Snowy Mountain)

A giant white snow owl that flies above an icy mountain top. Parts of the arena floor are slippery ice.

| Attack | Warning | What happens | How to avoid |
|---|---|---|---|
| Snowball drop | Hoots and flaps hard | Drops 3–4 snowballs (shadows show where) | Stand away from the shadows |
| Dive swoop | Screeches, then hovers still for 1 s at the edge of the screen | Swoops diagonally down across the arena and lands in a snowdrift | Jump or step out of the way |
| Icy wind (phase 2) | Spreads her wings wide | Blows the player slowly toward the edge of the arena for 3 seconds | Run against the wind |

- **Weak moment:** after a dive swoop she is stuck in the snowdrift for 2 seconds.
- **Phases:** phase 1 at 5–3 HP, phase 2 at 2–1 HP (faster swoops, more snowballs, adds icy wind).
- **Arena:** two floating ice platforms. The floor is slippery ice, so the player slides a bit more than normal.

#### Boss 4: Admiral Octavia (Coral Reef)

A giant purple octopus wearing a small admiral's hat, living in the wreck of an old ship. The arena is underwater, so the swimming rules apply. The air meter is paused during the fight so the player can concentrate on the boss.

| Attack | Warning | What happens | How to avoid |
|---|---|---|---|
| Tentacle slam | A line of bubbles rises from the sea floor for 1 s | A tentacle shoots up from below where the bubbles were | Swim away from the bubbles |
| Ink cloud (phase 2+) | She puffs up and turns dark | Sprays a cloud of ink that darkens half the arena for 4 seconds | Stay on the clear side |
| Shell spin (phase 3) | She grabs shells with 3 tentacles | Throws 3 spinning shells that travel slowly across the arena | Swim over or under them |

- **Weak moment:** after a tentacle slam, the tentacle gets stuck in the sand and she is dizzy for 2 seconds. Swimming down onto her head then removes 1 hit point.
- **Phases:** phase 1 at 5–4 HP, phase 2 at 3–2 HP (faster slams, adds ink cloud), phase 3 at 1 HP (two tentacle slams at once, adds shell spin).
- **Arena:** two floating rock platforms and a current that slowly pushes toward the middle.

#### Boss 5: King Sandclaw (Scorching Desert)

A huge sand scorpion with a golden crown. He is the final and hardest boss in the game. The arena has two floating stone platforms and sand walls.

| Attack | Warning | What happens | How to avoid |
|---|---|---|---|
| Claw charge | He stamps and scrapes his feet for 1 s | Charges across the arena and crashes into the wall | Jump onto a platform or over him |
| Stinger rain | He raises his tail and it glows | Stingers fall from the sky in 3–5 spots | Stand where there is no shadow on the ground |
| Sand wave (phase 3 only) | He slams the ground and it shakes | A low sand wave rolls across the floor | Jump over it |

- **Weak moment:** after a claw charge he crashes into the wall and is dizzy for 2 seconds.
- **Phases:**
  - Phase 1 (6–5 HP): slow claw charges and stinger rain.
  - Phase 2 (4–3 HP): faster, with more stingers.
  - Phase 3 (2–1 HP): fastest, and adds the sand wave.
  - He flashes and roars at each phase change.

---

## 7. HUD

Top bar:

- **Left:** hearts (lives).
- **Center:** level name (replaced by the boss health bar during the boss fight).
- **Right:** coin icon with count, and elapsed time (or the countdown in Time challenge mode).

A small carrot icon shows when the player is currently big, next to an icon of her shot (star, bubble, boomerang or flame) to show that shooting is available. In level 4, the **air meter** (10 bubbles) is shown under the hearts.

---

## 8. Code structure

```
index.html
style.css
js/
  main.js        – boot, game loop, scene manager
  input.js       – keyboard state
  scenes.js      – title, character select, level select, play, results, game over
  player.js      – physics, states, small/big, character stats, long jump
  swimming.js    – underwater physics, air meter, currents
  projectiles.js – the four shot types (stars, bubbles, boomerang, fireballs)
  enemies.js     – enemy types and AI
  boss.js        – shared boss engine: arena lock, intro, health bar, phases, victory
  bosses.js      – the five bosses and their attacks
  level.js       – ASCII parsing, tile collision, camera
  levels.js      – the five level maps and time limits
  entities.js    – coins, carrots, boxes, checkpoint, flag, quicksand, crumbling platforms, air vents
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
3. **Characters:** both sisters (blonde), the grown-up and the Fire Woman (both brown hair) drawn with animations, the Fire Woman's long jump, plus the character select screen.
4. **Collectibles:** coins, surprise boxes, HUD.
5. **Magic carrot:** small/big states, cracked boxes, hit/shrink logic, invulnerability.
6. **Enemies:** hedgehog and frog first, then crow and spiky plant.
7. **Shooting:** all four shot types (sparkle stars, bubbles, boomerang, fireballs) while big, and enemy hits.
8. **Lives and checkpoints:** game over and results screens.
9. **Levels 2 and 3:** level select screen and best-score saving.
10. **Time challenge:** toggle on level select, countdown HUD, time's-up life loss and extra time, best times.
11. **Level 4 – Coral Reef:** swimming physics, air meter and vents, currents, sea enemies and the level map (with a temporary flag at the end).
12. **Level 5 – Scorching Desert:** desert enemies, quicksand, crumbling platforms and the level map (with a temporary flag at the end).
13. **Boss engine + Big Bristle:** arena lock, intro, health bar, weak moment, victory sequence with the rising flagpole, and the level 1 boss.
14. **Remaining bosses:** Queen Croakia, Frostbeak, Admiral Octavia and King Sandclaw, one at a time.
15. **Polish:** parallax backgrounds, sounds, pause menu, balancing, Fire Woman bonus coin areas.

---

## 10. Acceptance criteria

- [ ] The game starts by opening `index.html` in a browser, with no install and no server.
- [ ] The player can pick one of four characters: two blonde sisters, a brown-haired grown-up and the brown-haired Fire Woman (an adult woman), all visibly distinct.
- [ ] The younger sister wears a pink t-shirt and black pants.
- [ ] The Fire Woman jumps noticeably further than the other characters, and each level has optional bonus areas only she can reach.
- [ ] The player can pick any of the 5 levels from the level select screen.
- [ ] The player can run, jump (variable height) and land on boxes and platforms.
- [ ] Coins can be collected and the count is shown in the HUD.
- [ ] A magic carrot makes the player big. Getting hit while big makes her small, and getting hit while small costs a life.
- [ ] Enemies can be defeated by stomping (except the unstompable ones) and hurt the player on side contact.
- [ ] All four characters can shoot while big, each with their own shot (stars, bubbles, boomerang, fireballs), and shots defeat any enemy.
- [ ] Level 4 is an underwater level with swimming, an air meter and air bubble vents.
- [ ] With Time challenge ON, running out of time costs one life and gives 1:00 extra time. With it OFF, there is no time limit.
- [ ] Touching the flag completes the level and shows the coin score.
- [ ] Every level can be completed with all four characters, with and without Time challenge.
- [ ] Level 5 is a desert level that is clearly harder than level 4.
- [ ] Every level ends with its own boss (Big Bristle, Queen Croakia, Frostbeak, Admiral Octavia, King Sandclaw), and each boss is harder than the one before.
- [ ] Every boss has telegraphed attacks, a health bar, and can be beaten by stomping alone.
- [ ] The goal flag in each level only appears after that level's boss is defeated.
- [ ] Each level has the number of carrots and roughly the number of coins listed in section 6.
- [ ] Runs smoothly at 60 fps on a normal laptop.

---

## 11. Out of scope for v1 (possible later)

- Two-player mode (two characters at once)
- Touch controls for iPad or phone
- Level editor
- Music tracks
- More power-ups (for example a golden carrot that gives temporary invincibility)
