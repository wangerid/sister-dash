# Sister Dash – Game Specification

A 2D side-scrolling platform game that runs in the browser. You play as one of two sisters and run from left to right: jump over boxes, get past the opposition, collect coins, and grab the flag at the end of each level.

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
- **Character select:** both sisters shown side by side. Choose with ←/→ and confirm with Enter, or click one.
- **Level select:** three level cards showing name, best coin score, and a checkmark if completed. All three levels are unlocked from the start.
- **Pause:** press P or Esc. Options are Resume, Restart level, and Back to level select.

---

## 3. Characters

Both sisters have **blonde hair**. They look clearly different and play slightly differently.

| | Older sister | Younger sister |
|---|---|---|
| Look | Taller, long blonde hair in a ponytail, blue top | Shorter, blonde pigtails, pink top |
| Run speed | Slightly faster (+10%) | Standard |
| Jump | Standard | Slightly higher (+10%) |

The difference between them should be noticeable but small. Every level must be completable with either sister.

### Animations (simple, code-drawn)

Idle, run (legs cycle), jump (arms up), hurt (flash), grow/shrink (quick scale pulse), victory (arms up by the flag).

---

## 4. Controls

| Action | Keys |
|---|---|
| Move left / right | ← / → or A / D |
| Jump | Space, ↑ or W. Holding the key gives a higher jump, a quick tap gives a short hop |
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
- Collecting a **magic carrot** makes the player **big**. She grows to about 1.5× height with a short grow animation and a sparkle.
- Big-only benefits:
  - She can break **cracked boxes** by jumping into them from below.
  - She survives one hit.
- When a big player is hit, she **shrinks back to small** and flashes, invulnerable for 1.5 seconds.
- When a small player is hit, she **loses a life**.
- Carrots appear on the ground or pop out of **surprise boxes** (boxes marked "?").

### 5.2 Boxes

| Type | Behaviour |
|---|---|
| Wooden box | Solid obstacle to jump over or stand on |
| Surprise box "?" | Hit from below to release a coin or a carrot, then it turns plain |
| Cracked box | Only a big sister can break it by hitting it from below. It may hide coins |

### 5.3 Coins

- Spinning gold coins placed in the level, plus coins that come out of surprise boxes.
- A HUD counter shows the number of coins in this level.
- Every **50 coins** gives an extra life. This is optional and off by default.

### 5.4 Opposition (enemies)

All enemies are original, friendly-looking cartoon creatures.

| Enemy | Behaviour | How to defeat |
|---|---|---|
| Grumpy hedgehog | Walks back and forth and turns at walls and edges | Jump on top of it |
| Bouncing frog | Hops in place or toward the player | Jump on top of it |
| Swooping crow (level 2+) | Flies in a wave pattern | Avoid it, or jump on it |
| Spiky plant (level 3) | Stationary and cannot be stomped | Avoid it |

- Stomping an enemy makes it disappear with a "poof" and gives the player a small bounce.
- Touching an enemy from the side or below counts as a hit (see 5.1).
- Falling into a pit costs a life, whatever size the player is.

### 5.5 Lives and checkpoints

- The player starts with 3 lives. The HUD shows hearts.
- Each level has one **checkpoint** at the midpoint (a small flag that lights up). The player respawns there after losing a life.
- At 0 lives: Game over screen with Retry level or Back to level select.

### 5.6 Goal flag

- Each level ends with a **flagpole**. Touching it triggers the victory animation.
- A "Level complete!" screen shows coins collected / total coins in level and time taken.
- The best coin score per level is saved.

---

## 6. Levels

Levels are tile-based (tile = 32×32 px) and defined as **ASCII maps** in `js/levels.js`, so they are easy to edit. Each level is roughly 150–250 tiles wide and scrolls horizontally, with the camera following the player.

### Tile legend

```
.  empty          #  ground         B  wooden box      ?  surprise box (coin)
C  surprise box (carrot)            X  cracked box     o  coin
c  magic carrot   h  hedgehog       f  frog            w  crow
s  spiky plant    k  checkpoint     F  goal flag       P  player start
```

### The three levels

| # | Name | Theme | Difficulty | Content |
|---|---|---|---|---|
| 1 | Sunny Meadow | Green hills, blue sky, clouds | Easy | Low boxes, a few hedgehogs, small gaps, 1 carrot, about 40 coins |
| 2 | Whispering Forest | Dark green trees, mushrooms | Medium | Stacked boxes, frogs and crows, wider pits, platforms, 2 carrots, about 60 coins |
| 3 | Snowy Mountain | White and blue, snowy peaks | Harder | Tall box staircases, all enemy types, spiky plants, cracked-box secret area, 2 carrots, about 80 coins |

Each level has a different background color palette and simple parallax layers (far hills or trees, near bushes).

---

## 7. HUD

Top bar:

- **Left:** hearts (lives).
- **Center:** level name.
- **Right:** coin icon with count, and elapsed time.

A small icon shows whether the sister is currently big (carrot icon).

---

## 8. Code structure

```
index.html
style.css
js/
  main.js        – boot, game loop, scene manager
  input.js       – keyboard state
  scenes.js      – title, character select, level select, play, results, game over
  player.js      – physics, states, small/big
  enemies.js     – enemy types and AI
  level.js       – ASCII parsing, tile collision, camera
  levels.js      – the three level maps
  entities.js    – coins, carrots, boxes, checkpoint, flag
  render.js      – drawing helpers for characters, tiles, backgrounds
  audio.js       – simple sound effects and mute
  storage.js     – best scores
```

---

## 9. Build milestones (for Claude Code)

Build and verify one milestone at a time.

1. **Skeleton:** canvas, game loop, keyboard input, and a rectangle that runs and jumps on flat ground.
2. **Level engine:** ASCII level parsing, tile collision, a scrolling camera, and level 1 playable start to flag.
3. **Characters:** both sisters drawn with blonde hair and animations, plus the character select screen.
4. **Collectibles:** coins, surprise boxes, HUD.
5. **Magic carrot:** small/big states, cracked boxes, hit/shrink logic, invulnerability.
6. **Enemies:** hedgehog and frog first, then crow and spiky plant.
7. **Lives and checkpoints:** game over and results screens.
8. **Levels 2 and 3:** level select screen and best-score saving.
9. **Polish:** parallax backgrounds, sounds, pause menu, balancing.

---

## 10. Acceptance criteria

- [ ] The game starts by opening `index.html` in a browser, with no install and no server.
- [ ] The player can pick either sister, and both have blonde hair and look distinct.
- [ ] The player can pick any of the 3 levels from the level select screen.
- [ ] The player can run, jump (variable height) and land on boxes and platforms.
- [ ] Coins can be collected and the count is shown in the HUD.
- [ ] A magic carrot makes the player big. Getting hit while big makes her small, and getting hit while small costs a life.
- [ ] Enemies can be defeated by stomping (except the spiky plant) and hurt the player on side contact.
- [ ] Touching the flag completes the level and shows the coin score.
- [ ] Every level can be completed with both sisters.
- [ ] Runs smoothly at 60 fps on a normal laptop.

---

## 11. Out of scope for v1 (possible later)

- Two-player mode (both sisters at once)
- Touch controls for iPad or phone
- Level editor
- Music tracks
- More power-ups (for example a golden carrot that gives temporary invincibility)
