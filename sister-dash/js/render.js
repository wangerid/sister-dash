// render.js – drawing helpers for characters, tiles, backgrounds, enemies and HUD

const FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';

const THEMES = {
  meadow: {
    skyTop: '#5cb8ff', skyBottom: '#d4f0ff',
    far: '#9ad68f', mid: '#6cbf5f', near: '#3f9a43', nearLight: '#58b456',
    grass: '#5ccb4c', grassLight: '#8ee67a', dirt: '#b9773f', dirtDark: '#935a2a',
    hud: 'rgba(20, 60, 30, 0.45)',
  },
  forest: {
    skyTop: '#16352f', skyBottom: '#5f8f6c',
    far: '#2a5646', mid: '#1f4636', near: '#16362a', nearLight: '#24503b',
    grass: '#3d8c38', grassLight: '#63b24f', dirt: '#6b4a33', dirtDark: '#4f3524',
    hud: 'rgba(5, 20, 12, 0.5)',
  },
  snow: {
    skyTop: '#7fa9df', skyBottom: '#e6f1ff',
    far: '#bcd0ec', mid: '#93aed3', near: '#2f5a5a', nearLight: '#3d6d6b',
    grass: '#ffffff', grassLight: '#ffffff', dirt: '#7b8ea8', dirtDark: '#5f718a',
    hud: 'rgba(20, 40, 80, 0.4)',
  },
  reef: {
    skyTop: '#7fd0ff', skyBottom: '#1a4f8f',
    far: '#1d4d7a', mid: '#236089', near: '#e0668a', nearLight: '#ff9a6a',
    grass: '#f2dca0', grassLight: '#fbecc0', dirt: '#8a7a6a', dirtDark: '#6e5f52',
    hud: 'rgba(5, 25, 60, 0.5)',
  },
  desert: {
    skyTop: '#ff8a3d', skyBottom: '#ffd89a',
    far: '#e7a55e', mid: '#e9b56c', near: '#d7924b', nearLight: '#e8aa62',
    grass: '#f4d38c', grassLight: '#fde6ae', dirt: '#dba35e', dirtDark: '#b9803f',
    hud: 'rgba(90, 40, 10, 0.45)',
  },
};

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawText(ctx, text, x, y, size, color = '#fff', align = 'center', outline = 'rgba(0,0,0,0.55)') {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineWidth = Math.max(3, size / 6);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = outline;
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ---------------------------------------------------------------- backgrounds

function silhouette(ctx, color, fn) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W + 12; x += 12) ctx.lineTo(x, fn(x));
  ctx.lineTo(VIEW_W + 12, VIEW_H);
  ctx.closePath();
  ctx.fill();
}

// Calls cb(screenX, index) for objects repeated every `spacing` px on a layer scrolled by `off`.
function repeatLayer(off, spacing, cb) {
  const first = Math.floor(off / spacing) - 1;
  for (let i = first; i * spacing - off < VIEW_W + spacing; i++) cb(i * spacing - off, i);
}

function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  circle(ctx, x, y, 18 * s);
  circle(ctx, x + 20 * s, y - 10 * s, 22 * s);
  circle(ctx, x + 44 * s, y - 2 * s, 17 * s);
  ctx.fillRect(x, y - 2 * s, 44 * s, 18 * s);
  circle(ctx, x + 60 * s, y + 6 * s, 12 * s);
}

function drawBackground(ctx, themeName, camX, t) {
  const th = THEMES[themeName];
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, th.skyTop);
  g.addColorStop(1, th.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (themeName === 'meadow') drawMeadowBg(ctx, th, camX, t);
  else if (themeName === 'forest') drawForestBg(ctx, th, camX, t);
  else if (themeName === 'desert') drawDesertBg(ctx, th, camX, t);
  else if (themeName === 'reef') drawReefBg(ctx, th, camX, t);
  else drawSnowBg(ctx, th, camX, t);
}

const REEF_SURFACE_SCREEN = 124; // water surface on screen (surface row 4, camera y 4)

function drawReefBg(ctx, th, camX, t) {
  const sy = REEF_SURFACE_SCREEN;
  const g = ctx.createLinearGradient(0, sy, 0, VIEW_H);
  g.addColorStop(0, '#2e8fd0');
  g.addColorStop(0.5, '#1a5e9e');
  g.addColorStop(1, '#0d2e5c');
  ctx.fillStyle = g;
  ctx.fillRect(0, sy, VIEW_W, VIEW_H - sy);
  // light rays from above
  ctx.fillStyle = 'rgba(200, 240, 255, 0.08)';
  for (let i = 0; i < 5; i++) {
    const x = ((i * 230 - camX * 0.05 + Math.sin(t * 0.3 + i) * 20) % 1150 + 1150) % 1150 - 100;
    ctx.beginPath();
    ctx.moveTo(x, sy);
    ctx.lineTo(x + 50, sy);
    ctx.lineTo(x + 170, VIEW_H);
    ctx.lineTo(x + 90, VIEW_H);
    ctx.fill();
  }
  // far rocks
  const o = camX * 0.15;
  silhouette(ctx, th.far, (x) => 400 + Math.sin((x + o) * 0.006) * 40 + Math.sin((x + o) * 0.017 + 1) * 16);
  // sunken ship far away
  repeatLayer(camX * 0.2, 1400, (x) => {
    ctx.fillStyle = '#163d63';
    ctx.beginPath();
    ctx.moveTo(x + 40, 400);
    ctx.lineTo(x + 260, 380);
    ctx.lineTo(x + 230, 430);
    ctx.lineTo(x + 70, 440);
    ctx.fill();
    ctx.fillRect(x + 140, 300, 6, 90);
    ctx.fillRect(x + 110, 320, 60, 4);
  });
  silhouette(ctx, th.mid, (x) => 450 + Math.sin((x + camX * 0.3) * 0.009 + 2) * 22);
  // near coral
  repeatLayer(camX * 0.55, 130, (x, i) => {
    const c = ['#e0668a', '#ff9a6a', '#9b6ad6', '#f2c14e'][i % 4 < 0 ? -(i % 4) : i % 4];
    ctx.fillStyle = c;
    for (let k = 0; k < 3; k++) {
      const bx = x + k * 14, h = 26 + hash(i * 3 + k) * 30;
      roundRect(ctx, bx, 488 - h, 8, h, 4);
      ctx.fill();
      circle(ctx, bx + 4, 488 - h, 6);
    }
  });
  // drifting bubbles
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    let x = (hash(i) * VIEW_W - camX * 0.3 + Math.sin(t + i) * 12) % VIEW_W;
    if (x < 0) x += VIEW_W;
    const span = VIEW_H - sy;
    const y = VIEW_H - ((hash(i + 40) * span + t * (20 + hash(i + 7) * 30)) % span);
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + hash(i + 3) * 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Blue tint over the water, and the rippling surface line.
function drawWaterTint(ctx, level, camY, t) {
  const sy = level.surfaceY - camY;
  ctx.fillStyle = 'rgba(30, 110, 200, 0.12)';
  ctx.fillRect(0, sy, VIEW_W, VIEW_H - sy);
  ctx.strokeStyle = 'rgba(220, 245, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= VIEW_W; x += 12) {
    const y = sy + Math.sin(x * 0.04 + t * 3) * 2;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawDesertBg(ctx, th, camX, t) {
  ctx.fillStyle = 'rgba(255, 240, 180, 0.35)';
  circle(ctx, 760, 150, 90);
  ctx.fillStyle = '#fff1b8';
  circle(ctx, 760, 150, 58);
  // pyramids far away
  repeatLayer(camX * 0.06, 520, (x, i) => {
    const s = 0.7 + hash(i) * 0.5;
    for (let k = 0; k < 2; k++) {
      const px = x + k * 120 * s, h = (110 - k * 35) * s;
      ctx.fillStyle = '#d58f4c';
      ctx.beginPath();
      ctx.moveTo(px - h, 400);
      ctx.lineTo(px, 400 - h);
      ctx.lineTo(px + h, 400);
      ctx.fill();
      ctx.fillStyle = '#c07a3c';
      ctx.beginPath();
      ctx.moveTo(px, 400 - h);
      ctx.lineTo(px + h, 400);
      ctx.lineTo(px + h * 0.25, 400);
      ctx.fill();
    }
  });
  let o = camX * 0.15;
  silhouette(ctx, th.far, (x) => 390 + Math.sin((x + o) * 0.005) * 22 + Math.sin((x + o) * 0.013 + 2) * 10);
  // heat shimmer
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const y0 = 360 + k * 16;
    ctx.beginPath();
    for (let x = 0; x <= VIEW_W; x += 16) {
      const y = y0 + Math.sin(x * 0.03 + t * 3 + k * 1.7) * 3;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  o = camX * 0.3;
  silhouette(ctx, th.mid, (x) => 430 + Math.sin((x + o) * 0.008 + 1) * 26 + Math.sin((x + o) * 0.021) * 8);
  repeatLayer(camX * 0.55, 190, (x, i) => {
    ctx.fillStyle = th.near;
    ctx.beginPath();
    ctx.ellipse(x, 486, 70 + hash(i) * 40, 26, 0, Math.PI, 0);
    ctx.fill();
    if (hash(i + 4) > 0.45) {
      const cx = x + 30, s = 0.8 + hash(i + 8) * 0.5;
      ctx.fillStyle = '#b39a5e'; // muted, so background cacti don't read as hazards
      roundRect(ctx, cx - 5 * s, 486 - 44 * s, 10 * s, 44 * s, 5 * s);
      ctx.fill();
      roundRect(ctx, cx - 16 * s, 486 - 32 * s, 6 * s, 16 * s, 3 * s);
      ctx.fill();
      ctx.fillRect(cx - 16 * s, 486 - 20 * s, 12 * s, 5 * s);
    }
  });
}

function drawMeadowBg(ctx, th, camX, t) {
  ctx.fillStyle = 'rgba(255, 245, 170, 0.35)';
  circle(ctx, 820, 96, 62);
  ctx.fillStyle = '#fff4a3';
  circle(ctx, 820, 96, 42);
  repeatLayer(camX * 0.08 + t * 8, 300, (x, i) => drawCloud(ctx, x, 70 + hash(i) * 90, 0.8 + hash(i + 5) * 0.5));
  let o = camX * 0.15;
  silhouette(ctx, th.far, (x) => 330 + Math.sin((x + o) * 0.0045) * 40 + Math.sin((x + o) * 0.013) * 14);
  o = camX * 0.3;
  silhouette(ctx, th.mid, (x) => 395 + Math.sin((x + o) * 0.007 + 1) * 30 + Math.sin((x + o) * 0.019) * 10);
  repeatLayer(camX * 0.55, 150, (x, i) => {
    const r = 20 + hash(i) * 16;
    ctx.fillStyle = th.near;
    circle(ctx, x, 478, r);
    circle(ctx, x + r * 0.9, 470, r * 1.1);
    circle(ctx, x + r * 1.9, 480, r * 0.8);
    ctx.fillStyle = th.nearLight;
    circle(ctx, x + r * 0.7, 462, r * 0.4);
  });
}

function drawForestBg(ctx, th, camX, t) {
  ctx.fillStyle = 'rgba(230, 255, 220, 0.12)';
  for (let i = 0; i < 4; i++) {
    const x = 120 + i * 240 - ((camX * 0.05) % 240);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 60, 0);
    ctx.lineTo(x + 180, VIEW_H);
    ctx.lineTo(x + 100, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
  repeatLayer(camX * 0.15, 46, (x, i) => {
    const h = 140 + hash(i) * 110;
    ctx.fillStyle = th.far;
    ctx.beginPath();
    ctx.moveTo(x - 30, 440);
    ctx.lineTo(x, 440 - h);
    ctx.lineTo(x + 30, 440);
    ctx.fill();
  });
  ctx.fillStyle = th.far;
  ctx.fillRect(0, 430, VIEW_W, VIEW_H);
  repeatLayer(camX * 0.35, 110, (x, i) => {
    const h = 150 + hash(i + 3) * 90;
    ctx.fillStyle = '#3b2a1e';
    ctx.fillRect(x - 7, 480 - h * 0.5, 14, h * 0.5);
    ctx.fillStyle = th.mid;
    circle(ctx, x, 480 - h * 0.55, 42);
    circle(ctx, x - 26, 480 - h * 0.42, 30);
    circle(ctx, x + 26, 480 - h * 0.42, 30);
    circle(ctx, x, 480 - h * 0.8, 30);
  });
  repeatLayer(camX * 0.6, 170, (x, i) => {
    ctx.fillStyle = th.near;
    circle(ctx, x, 482, 26);
    circle(ctx, x + 28, 476, 30);
    circle(ctx, x + 56, 484, 22);
    if (hash(i + 9) > 0.4) drawMushroom(ctx, x + 90, 484, 1.4);
  });
  for (let i = 0; i < 24; i++) {
    const x = (hash(i) * 1400 - camX * 0.4 + Math.sin(t * 0.7 + i) * 30) % 1400;
    const sx = x < 0 ? x + 1400 : x;
    const y = 120 + hash(i + 40) * 300 + Math.sin(t * 1.3 + i * 2) * 16;
    const a = 0.45 + 0.45 * Math.sin(t * 3 + i);
    ctx.fillStyle = `rgba(255, 245, 140, ${a * 0.3})`;
    circle(ctx, sx, y, 6);
    ctx.fillStyle = `rgba(255, 250, 190, ${a})`;
    circle(ctx, sx, y, 2);
  }
}

function drawMushroom(ctx, x, y, s) {
  ctx.fillStyle = '#f3e7d0';
  ctx.fillRect(x - 2.5 * s, y - 7 * s, 5 * s, 7 * s);
  ctx.fillStyle = '#d8403a';
  ctx.beginPath();
  ctx.ellipse(x, y - 7 * s, 7 * s, 5 * s, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#fff';
  circle(ctx, x - 3 * s, y - 9 * s, 1.2 * s);
  circle(ctx, x + 2.5 * s, y - 10 * s, 1 * s);
}

function drawSnowBg(ctx, th, camX, t) {
  repeatLayer(camX * 0.08, 260, (x, i) => {
    const h = 200 + hash(i) * 90;
    const w = 190 + hash(i + 2) * 80;
    ctx.fillStyle = th.far;
    ctx.beginPath();
    ctx.moveTo(x - w, 460);
    ctx.lineTo(x, 460 - h);
    ctx.lineTo(x + w, 460);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.28, 460 - h * 0.72);
    ctx.lineTo(x, 460 - h);
    ctx.lineTo(x + w * 0.28, 460 - h * 0.72);
    ctx.lineTo(x + w * 0.12, 460 - h * 0.66);
    ctx.lineTo(x, 460 - h * 0.74);
    ctx.lineTo(x - w * 0.14, 460 - h * 0.65);
    ctx.fill();
  });
  repeatLayer(camX * 0.25, 190, (x, i) => {
    const h = 130 + hash(i + 7) * 70;
    ctx.fillStyle = th.mid;
    ctx.beginPath();
    ctx.moveTo(x - 150, 480);
    ctx.lineTo(x, 480 - h);
    ctx.lineTo(x + 150, 480);
    ctx.fill();
    ctx.fillStyle = '#f4f8ff';
    ctx.beginPath();
    ctx.moveTo(x - 40, 480 - h * 0.73);
    ctx.lineTo(x, 480 - h);
    ctx.lineTo(x + 40, 480 - h * 0.73);
    ctx.lineTo(x + 12, 480 - h * 0.78);
    ctx.lineTo(x - 10, 480 - h * 0.7);
    ctx.fill();
  });
  repeatLayer(camX * 0.5, 80, (x, i) => {
    const s = 0.8 + hash(i + 11) * 0.5;
    drawPine(ctx, x, 486, s, th);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 70; i++) {
    const speed = 25 + hash(i + 3) * 35;
    let x = (hash(i) * VIEW_W + Math.sin(t + i) * 20 - camX * 0.6 + t * 12) % VIEW_W;
    if (x < 0) x += VIEW_W;
    const y = (hash(i + 70) * VIEW_H + t * speed) % VIEW_H;
    circle(ctx, x, y, 1 + hash(i + 9) * 1.8);
  }
}

function drawPine(ctx, x, y, s, th) {
  ctx.fillStyle = '#4a3526';
  ctx.fillRect(x - 4 * s, y - 14 * s, 8 * s, 14 * s);
  for (let k = 0; k < 3; k++) {
    const by = y - 12 * s - k * 22 * s;
    const w = (30 - k * 7) * s;
    ctx.fillStyle = th.near;
    ctx.beginPath();
    ctx.moveTo(x - w, by);
    ctx.lineTo(x, by - 34 * s);
    ctx.lineTo(x + w, by);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, by - 19 * s);
    ctx.lineTo(x, by - 34 * s);
    ctx.lineTo(x + w * 0.45, by - 19 * s);
    ctx.lineTo(x, by - 23 * s);
    ctx.fill();
  }
}

// A flat strip of ground for menu screens.
function drawGroundBand(ctx, themeName, camX, y) {
  const th = THEMES[themeName];
  ctx.fillStyle = th.dirt;
  ctx.fillRect(0, y, VIEW_W, VIEW_H - y);
  ctx.fillStyle = th.dirtDark;
  repeatLayer(camX, 32, (x, i) => {
    ctx.fillRect(x + 4 + hash(i) * 18, y + 18 + hash(i + 1) * 10, 4, 3);
    ctx.fillRect(x + 20 - hash(i) * 10, y + 40 + hash(i + 2) * 12, 3, 3);
  });
  ctx.fillStyle = th.grass;
  ctx.fillRect(0, y, VIEW_W, 9);
  repeatLayer(camX, 8, (x) => {
    ctx.beginPath();
    ctx.arc(x + 4, y + 9, 4, 0, Math.PI);
    ctx.fill();
  });
  ctx.fillStyle = th.grassLight;
  ctx.fillRect(0, y, VIEW_W, 3);
}

// ---------------------------------------------------------------- tiles

function drawTiles(ctx, level, camX, t) {
  const th = level.theme;
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const x1 = Math.min(level.cols - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
  // fallen crumbling platforms tumble down
  for (const c of level.crumbles.values()) {
    if (c.state === 'gone' && c.fall < 400 && c.tx >= x0 && c.tx <= x1) {
      ctx.globalAlpha = Math.max(0, 1 - c.fall / 400);
      drawCrumbleTile(ctx, c.tx * TILE, c.ty * TILE + c.fall, c);
      ctx.globalAlpha = 1;
    }
  }
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const ch = level.tiles[ty][tx];
      if (ch === '.') continue;
      const x = tx * TILE;
      const y = ty * TILE + level.bumpOffset(tx, ty);
      if (ch === '#') drawGroundTile(ctx, level, tx, ty, x, y, th);
      else if (ch === 'q') continue; // drawn over the player by drawQuicksand
      else if (ch === '<' || ch === '>') drawCurrentTile(ctx, x, y, ch === '>' ? 1 : -1, t);
      else if (ch === 'a') drawVent(ctx, x, y, t);
      else if (ch === '%') drawSeaweed(ctx, x, y, tx, t);
      else if (ch === '-') drawCrumbleTile(ctx, x + level.crumbleShake(tx, ty), y, level.crumbles.get(tx + ',' + ty));
      else if (ch === 'W') drawSandWall(ctx, level, tx, ty, x, y);
      else if (ch === 'B' && level.themeName === 'reef') drawShipPlank(ctx, level, tx, ty, x, y);
      else drawBoxTile(ctx, ch, x, y, t);
    }
  }
}

function drawGroundTile(ctx, level, tx, ty, x, y, th) {
  ctx.fillStyle = th.dirt;
  ctx.fillRect(x, y, TILE + 0.6, TILE + 0.6);
  ctx.fillStyle = th.dirtDark;
  const h1 = hash(tx * 31 + ty * 17);
  ctx.fillRect(x + 4 + h1 * 18, y + 12 + hash(tx + ty * 7) * 12, 4, 3);
  ctx.fillRect(x + 22 - h1 * 12, y + 22 + hash(tx * 3 + ty) * 6, 3, 3);
  if (tx > 0 && level.get(tx - 1, ty) !== '#') ctx.fillRect(x, y, 3, TILE);
  if (tx < level.cols - 1 && level.get(tx + 1, ty) !== '#') ctx.fillRect(x + TILE - 3, y, 3, TILE);
  if (level.get(tx, ty - 1) === '#') return;
  ctx.fillStyle = th.grass;
  ctx.fillRect(x, y, TILE + 0.6, 9);
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x + 4 + i * 8, y + 9, 4, 0, Math.PI);
    ctx.fill();
  }
  if (level.themeName === 'snow') {
    ctx.fillStyle = '#d5e4f5';
    ctx.fillRect(x, y + 6, TILE + 0.6, 2);
  } else {
    ctx.fillStyle = th.grassLight;
    ctx.fillRect(x, y, TILE + 0.6, 3);
  }
  if (level.get(tx, ty - 1) !== '.') return;
  const d = hash(tx * 13 + ty * 5);
  if (level.themeName === 'meadow' && d > 0.72) {
    const fx = x + 6 + d * 18;
    ctx.strokeStyle = '#3f8f35';
    ctx.lineWidth = 1.5;
    line(ctx, fx, y, fx, y - 7);
    ctx.fillStyle = d > 0.86 ? '#ff7ab8' : '#ffffff';
    for (let k = 0; k < 5; k++) circle(ctx, fx + Math.cos(k * 1.26) * 2.6, y - 8 + Math.sin(k * 1.26) * 2.6, 1.8);
    ctx.fillStyle = '#ffd23f';
    circle(ctx, fx, y - 8, 1.5);
  } else if (level.themeName === 'forest' && d > 0.8) {
    drawMushroom(ctx, x + 8 + d * 14, y + 1, 0.9);
  } else if (level.themeName === 'desert' && d > 0.8) {
    ctx.fillStyle = '#a88a6a';
    ellipse(ctx, x + 8 + d * 14, y + 1, 3.5, 2.2);
    ctx.fillStyle = '#c4a584';
    ellipse(ctx, x + 12 + d * 10, y + 1.5, 2.2, 1.5);
  } else if (level.themeName === 'forest' && d > 0.55) {
    ctx.fillStyle = th.grassLight;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const gx = x + 6 + d * 10 + k * 4;
      ctx.moveTo(gx - 2, y + 1);
      ctx.lineTo(gx, y - 6 - k);
      ctx.lineTo(gx + 2, y + 1);
      ctx.fill();
    }
  }
}

// In the reef, wooden tiles are the planks of the sunken ship's hull.
function drawShipPlank(ctx, level, tx, ty, x, y) {
  ctx.fillStyle = '#4a3322';
  ctx.fillRect(x, y, TILE + 0.6, TILE + 0.6);
  ctx.fillStyle = '#6b4a30';
  ctx.fillRect(x, y + 2, TILE + 0.6, 12);
  ctx.fillRect(x, y + 17, TILE + 0.6, 12);
  ctx.fillStyle = '#3a2618';
  if ((tx + ty) % 2 === 0) ctx.fillRect(x + 20, y + 2, 2, 12);
  else ctx.fillRect(x + 8, y + 17, 2, 12);
  ctx.fillStyle = 'rgba(90, 160, 90, 0.35)';
  if ((tx * 7 + ty) % 5 === 0) ellipse(ctx, x + 10, y + 26, 7, 3); // a little algae
}

function drawCurrentTile(ctx, x, y, dir, t) {
  ctx.strokeStyle = 'rgba(210, 240, 255, 0.35)';
  ctx.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) {
    const off = ((t * 120 * dir + k * 11 + x) % TILE + TILE) % TILE;
    const ly = y + 6 + k * 10;
    line(ctx, x + off - 6, ly, x + off + 6, ly);
  }
}

function drawVent(ctx, x, y, t) {
  ctx.fillStyle = '#5a6a7a';
  ctx.beginPath();
  ctx.ellipse(x + 16, y + TILE - 4, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b3440';
  ellipse(ctx, x + 16, y + TILE - 5, 6, 2.5);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    const k = ((t * 0.7 + i / 9) % 1);
    const by = y + TILE - 6 - k * 5 * TILE;
    const bx = x + 16 + Math.sin(t * 4 + i * 2) * 6;
    ctx.beginPath();
    ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawSeaweed(ctx, x, y, tx, t) {
  const coral = tx % 3 === 0;
  if (coral) {
    ctx.fillStyle = ['#ff7a9a', '#ffb45a', '#b98aff'][tx % 9 === 0 ? 1 : tx % 2];
    for (let k = 0; k < 3; k++) {
      roundRect(ctx, x + 6 + k * 8, y + 10 + (k % 2) * 6, 6, TILE - 10 - (k % 2) * 6, 3);
      ctx.fill();
    }
    return;
  }
  ctx.strokeStyle = '#3aa35a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x + 10 + k * 12, y + TILE);
    for (let j = 1; j <= 4; j++) ctx.lineTo(x + 10 + k * 12 + Math.sin(t * 2 + j + k + tx) * 4, y + TILE - j * 8);
    ctx.stroke();
  }
}

function drawCrumbleTile(ctx, x, y, c) {
  const S = TILE;
  ctx.fillStyle = '#9c6a3a';
  ctx.fillRect(x, y, S, S);
  ctx.fillStyle = '#e0b073';
  ctx.fillRect(x + 1, y + 1, S - 2, S - 2);
  ctx.fillStyle = '#c9955a';
  ctx.fillRect(x + 1, y + 16, S - 2, 2);
  ctx.fillStyle = '#f1c98f';
  ctx.fillRect(x + 1, y + 1, S - 2, 3);
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 1);
  ctx.lineTo(x + 11, y + 7);
  ctx.lineTo(x + 9, y + 12);
  ctx.moveTo(x + 22, y + 2);
  ctx.lineTo(x + 19, y + 8);
  ctx.lineTo(x + 24, y + 22);
  ctx.lineTo(x + 20, y + 30);
  ctx.stroke();
  if (c && c.state === 'shaking') {
    ctx.fillStyle = 'rgba(230, 190, 130, 0.8)';
    circle(ctx, x + 6 + Math.random() * 20, y + 34 + Math.random() * 6, 1.5);
  }
}

// Boss arena walls, styled per level.
const WALL_STYLE = {
  meadow: { base: '#5f6e4f', brick: '#98ab7a', top: '#6fcf5a' },
  forest: { base: '#4a2f1c', brick: '#85572f', top: '#4f9a3f' },
  snow: { base: '#6f97bd', brick: '#d3e9fb', top: '#ffffff' },
  desert: { base: '#a8703a', brick: '#d99f5c', top: '#f4d38c' },
  reef: { base: '#4a3a6a', brick: '#7a64a8', top: '#ff8aa8' },
};

function drawSandWall(ctx, level, tx, ty, x, y) {
  const st = WALL_STYLE[level.themeName] || WALL_STYLE.desert;
  ctx.fillStyle = st.base;
  ctx.fillRect(x, y, TILE, TILE + 0.6);
  ctx.fillStyle = st.brick;
  ctx.fillRect(x + 2, y + 2, TILE - 4, 13);
  ctx.fillRect(x + 2, y + 17, 12, 13);
  ctx.fillRect(x + 16, y + 17, 14, 13);
  if (level.get(tx, ty - 1) !== 'W') {
    ctx.fillStyle = st.top;
    ctx.fillRect(x - 2, y - 3, TILE + 4, 6);
  }
}

// Quicksand pools, drawn after the player so a sinking player disappears into them.
function drawQuicksand(ctx, level, camX, t) {
  const x0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const x1 = Math.min(level.cols - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
  for (let ty = 0; ty < level.rows; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (level.tiles[ty][tx] !== 'q') continue;
      const x = tx * TILE, y = ty * TILE;
      const top = level.get(tx, ty - 1) !== 'q';
      ctx.fillStyle = '#c99a57';
      ctx.fillRect(x, y + (top ? 4 : 0), TILE + 0.6, TILE + 0.6 - (top ? 4 : 0));
      ctx.strokeStyle = 'rgba(140, 95, 45, 0.55)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 2; k++) {
        const r = ((t * 10 + tx * 13 + k * 16 + ty * 7) % 32);
        ctx.beginPath();
        ctx.ellipse(x + 16, y + 12 + k * 10, r * 0.5 + 2, (r * 0.5 + 2) * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (top) {
        ctx.fillStyle = '#b8864a';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(x + 4 + i * 8, y + 5 + Math.sin(t * 3 + tx + i) * 1.2, 4, Math.PI, 0);
          ctx.fill();
        }
      }
    }
  }
}

function drawBoxTile(ctx, ch, x, y, t) {
  const S = TILE;
  if (ch === 'B') {
    ctx.fillStyle = '#6e4119';
    ctx.fillRect(x, y, S, S);
    ctx.fillStyle = '#c98a45';
    ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
    ctx.fillStyle = '#d99c57';
    ctx.fillRect(x + 2, y + 2, S - 4, 3);
    ctx.strokeStyle = '#8f5a28';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 6, y + 6, S - 12, S - 12);
    line(ctx, x + 7, y + 7, x + S - 7, y + S - 7);
    ctx.fillStyle = '#5a3514';
    ctx.fillRect(x + 3, y + 3, 2, 2);
    ctx.fillRect(x + S - 5, y + 3, 2, 2);
    ctx.fillRect(x + 3, y + S - 5, 2, 2);
    ctx.fillRect(x + S - 5, y + S - 5, 2, 2);
  } else if (ch === '?' || ch === 'C') {
    const glow = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.fillStyle = '#9c6a0c';
    ctx.fillRect(x, y, S, S);
    ctx.fillStyle = `rgb(${245 + glow * 10}, ${190 + glow * 30}, ${40 + glow * 30})`;
    ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + 2, y + 2, S - 4, 3);
    ctx.fillStyle = '#b07c14';
    ctx.fillRect(x + 4, y + 4, 2, 2);
    ctx.fillRect(x + S - 6, y + 4, 2, 2);
    ctx.fillRect(x + 4, y + S - 6, 2, 2);
    ctx.fillRect(x + S - 6, y + S - 6, 2, 2);
    drawText(ctx, '?', x + S / 2, y + S / 2 + 1, 22, '#ffffff', 'center', '#a36d0b');
  } else if (ch === 'U') {
    ctx.fillStyle = '#5e4c3a';
    ctx.fillRect(x, y, S, S);
    ctx.fillStyle = '#a0866a';
    ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
    ctx.fillStyle = '#6f5b47';
    ctx.fillRect(x + 4, y + 4, 3, 3);
    ctx.fillRect(x + S - 7, y + 4, 3, 3);
    ctx.fillRect(x + 4, y + S - 7, 3, 3);
    ctx.fillRect(x + S - 7, y + S - 7, 3, 3);
  } else if (ch === 'X') {
    ctx.fillStyle = '#58524b';
    ctx.fillRect(x, y, S, S);
    ctx.fillStyle = '#aaa39a';
    ctx.fillRect(x + 2, y + 2, S - 4, S - 4);
    ctx.fillStyle = '#bdb7ae';
    ctx.fillRect(x + 2, y + 2, S - 4, 3);
    ctx.strokeStyle = '#3f3a35';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 9);
    ctx.lineTo(x + 12, y + 14);
    ctx.lineTo(x + 10, y + 21);
    ctx.lineTo(x + 18, y + 27);
    ctx.moveTo(x + 12, y + 14);
    ctx.lineTo(x + 21, y + 11);
    ctx.lineTo(x + 28, y + 16);
    ctx.moveTo(x + 21, y + 11);
    ctx.lineTo(x + 23, y + 4);
    ctx.moveTo(x + 18, y + 27);
    ctx.lineTo(x + 27, y + 24);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- sisters

const SISTER_LOOKS = {
  older: {
    top: '#3b82e6', topDark: '#2862bd', legs: '#2d3a5e', shoe: '#6b3a1e',
    hair: '#f7d14e', hairDark: '#d6a524', skin: '#ffd7b5',
    legLen: 10, bodyH: 11, headR: 6.3, style: 'ponytail',
  },
  younger: {
    top: '#ff6fae', topDark: '#e04f8f', legs: '#26262e', shoe: '#c43d7a',
    hair: '#f9d85a', hairDark: '#dcaa26', skin: '#ffd9b8',
    legLen: 7, bodyH: 9, headR: 6.2, style: 'pigtails',
  },
  grownup: {
    top: '#3f9150', topDark: '#2d6b3a', legs: '#3d5f95', shoe: '#4a3020',
    hair: '#7a4a26', hairDark: '#553218', skin: '#f3cba4',
    legLen: 13, bodyH: 14, headR: 6.4, style: 'short',
  },
  firewoman: {
    top: '#ff8c2a', topDark: '#d9661a', legs: '#2c4a80', shoe: '#5a2a1a',
    hair: '#7b4524', hairDark: '#552e16', skin: '#f6d0ab', shirt: '#fff3e0',
    legLen: 13, bodyH: 14, headR: 6.4, style: 'long', jacket: true,
  },
};

// Draws a playable character with the feet centred at (cx, bottom).
// pose: idle | run | jump | hurt | victory | throw
function drawSister(ctx, kind, cx, bottom, scale, facing, pose, phase, t) {
  const L = SISTER_LOOKS[kind];
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(scale * facing, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const hipY = -L.legLen;
  const shoulderY = hipY - L.bodyH + 2.5;
  const headY = hipY - L.bodyH - L.headR + 1.5;
  const bob = pose === 'run' ? -Math.abs(Math.sin(phase)) * 1.2 : pose === 'idle' ? Math.sin(t * 3) * 0.4 : 0;
  const sway = pose === 'run' ? Math.sin(phase * 2) * 2 : Math.sin(t * 2.5) * 0.8;

  // feet positions
  let f1x = 2, f1y = 0, f2x = -2, f2y = 0;
  if (pose === 'run') {
    const s = Math.sin(phase);
    f1x = s * 5; f2x = -s * 5;
    f1y = -Math.max(0, Math.cos(phase)) * 3;
    f2y = -Math.max(0, -Math.cos(phase)) * 3;
  } else if (pose === 'jump') {
    f1x = 4; f1y = -3.5; f2x = -3; f2y = -1;
  } else if (pose === 'hurt') {
    f1x = 5; f1y = -2; f2x = -5; f2y = -2;
  } else if (pose === 'swim') {
    const k = Math.sin(t * 9);
    f1x = -3 + k * 2; f1y = -1 - k * 2; f2x = -5 - k * 2; f2y = -1 + k * 2;
  }

  // hands
  let h1x = 3, h1y = hipY + 1, h2x = -3, h2y = hipY + 1;
  if (pose === 'run') {
    const s = Math.sin(phase);
    h1x = -s * 5; h1y = hipY + Math.abs(s) * -1.5;
    h2x = s * 5; h2y = hipY + Math.abs(s) * -1.5;
  } else if (pose === 'jump') {
    h1x = 6; h1y = shoulderY - 9; h2x = -5; h2y = shoulderY - 8;
  } else if (pose === 'victory') {
    h1x = 6 + Math.sin(t * 10) * 1.5; h1y = shoulderY - 10; h2x = -6; h2y = shoulderY - 10 + Math.sin(t * 10 + 1) * 1.5;
  } else if (pose === 'hurt') {
    h1x = 8; h1y = shoulderY - 4; h2x = -8; h2y = shoulderY - 4;
  } else if (pose === 'throw') {
    h1x = 9; h1y = shoulderY - 1;
  } else if (pose === 'swim') {
    const a = t * 5;
    h1x = Math.cos(a) * 8; h1y = shoulderY - 2 + Math.sin(a) * 6;
    h2x = -Math.cos(a) * 8; h2y = shoulderY - 2 - Math.sin(a) * 6;
  }

  ctx.translate(0, bob);

  // back pigtail / ponytail
  ctx.fillStyle = L.hair;
  ctx.strokeStyle = L.hairDark;
  ctx.lineWidth = 0.8;
  if (L.style === 'ponytail') {
    ctx.beginPath();
    ctx.moveTo(-3.5, headY - 4.5);
    ctx.quadraticCurveTo(-14, headY - 4 + sway * 0.5, -11 + sway, headY + 11);
    ctx.quadraticCurveTo(-8, headY + 6, -4.5, headY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (L.style === 'pigtails') {
    ctx.beginPath();
    ctx.ellipse(-7.2, headY + 2 + sway * 0.3, 2.8, 5, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (L.style === 'long') {
    // long hair hanging down the back to below the shoulders
    ctx.beginPath();
    ctx.moveTo(-L.headR - 0.5, headY - 2);
    ctx.quadraticCurveTo(-L.headR - 2.5 + sway * 0.3, shoulderY + 2, -5 + sway * 0.6, shoulderY + 6);
    ctx.lineTo(1, shoulderY + 3);
    ctx.lineTo(1, headY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // back leg and arm
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = L.legs;
  line(ctx, -1.5, hipY, f2x, f2y - 1.5);
  ctx.fillStyle = L.shoe;
  ellipse(ctx, f2x + 1, f2y - 1.2, 2.6, 1.6);
  ctx.strokeStyle = L.skin;
  ctx.lineWidth = 2.6;
  line(ctx, -1, shoulderY, h2x, h2y);

  // front leg
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = L.legs;
  line(ctx, 1.5, hipY, f1x, f1y - 1.5);
  ctx.fillStyle = L.shoe;
  ellipse(ctx, f1x + 1, f1y - 1.2, 2.6, 1.6);

  // body
  if (L.style === 'ponytail') {
    ctx.fillStyle = L.top;
    roundRect(ctx, -5.2, shoulderY - 2.5, 10.4, hipY - shoulderY + 3.5, 3);
    ctx.fill();
    ctx.fillStyle = L.topDark;
    ctx.fillRect(-5.2, hipY - 1.5, 10.4, 2.2);
  } else if (L.style === 'short' || L.jacket) {
    // jacket, open at the front over a shirt
    ctx.fillStyle = L.top;
    roundRect(ctx, -6, shoulderY - 2.5, 12, hipY - shoulderY + 4.5, 3);
    ctx.fill();
    ctx.fillStyle = L.shirt || '#f4f4f0';
    ctx.fillRect(2.2, shoulderY - 2, 2.6, hipY - shoulderY + 2);
    ctx.fillStyle = L.topDark;
    ctx.fillRect(1.4, shoulderY - 2, 1, hipY - shoulderY + 3.5);
    ctx.fillRect(-6, hipY + 0.5, 12, 1.5);
  } else {
    // t-shirt (younger sister) or top (Fire Girl)
    ctx.fillStyle = L.top;
    roundRect(ctx, -5, shoulderY - 2.5, 10, hipY - shoulderY + 3.5, 2.5);
    ctx.fill();
    if (L.style === 'pigtails') {
      ctx.fillStyle = '#ffffff';
      circle(ctx, 1.3, shoulderY + 2.2, 1);
      circle(ctx, 2.9, shoulderY + 2.2, 1);
      ctx.beginPath();
      ctx.moveTo(0.4, shoulderY + 2.6);
      ctx.lineTo(3.8, shoulderY + 2.6);
      ctx.lineTo(2.1, shoulderY + 4.6);
      ctx.fill();
    } else {
      ctx.fillStyle = L.topDark;
      ctx.fillRect(-5, hipY - 1.2, 10, 1.8);
      ctx.fillStyle = '#ffd23f';
      circle(ctx, 2, shoulderY + 2.5, 1.2);
    }
  }

  // head
  ctx.fillStyle = L.skin;
  circle(ctx, 0, headY, L.headR);

  // hair cap
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.arc(0, headY, L.headR + 0.9, Math.PI * 0.92, Math.PI * 2.05);
  ctx.quadraticCurveTo(3, headY - 2, -1, headY - 1.5);
  ctx.quadraticCurveTo(-3, headY + 2, -L.headR - 0.6, headY + 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = L.hairDark;
  ctx.lineWidth = 0.8;
  ctx.stroke();
  if (L.style === 'ponytail') {
    ctx.fillStyle = L.topDark;
    circle(ctx, -4.8, headY - 3.5, 1.4);
  } else if (L.style === 'pigtails') {
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    ctx.ellipse(6.8, headY + 1.5 - sway * 0.3, 2.6, 4.6, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff3d8b';
    circle(ctx, 5.6, headY - 2.4, 1.4);
    circle(ctx, -6.2, headY - 2.4, 1.4);
  } else if (L.style === 'long') {
    // red hair band
    ctx.strokeStyle = '#e02a2a';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(0, headY + 0.5, L.headR + 0.7, Math.PI * 1.1, Math.PI * 1.75);
    ctx.stroke();
  }

  // face
  if (pose === 'hurt') {
    ctx.strokeStyle = '#3a2a2a';
    ctx.lineWidth = 0.9;
    line(ctx, 2, headY - 1.5, 4.2, headY + 0.5);
    line(ctx, 4.2, headY - 1.5, 2, headY + 0.5);
  } else {
    ctx.fillStyle = '#2b2233';
    circle(ctx, 3.2, headY - 0.3, 1.15);
    ctx.fillStyle = '#ffffff';
    circle(ctx, 3.6, headY - 0.7, 0.4);
  }
  ctx.fillStyle = 'rgba(255, 110, 130, 0.45)';
  circle(ctx, 3.4, headY + 2.3, 1.3);
  ctx.strokeStyle = '#9a4a3a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  if (pose === 'hurt') ctx.arc(4.4, headY + 4.2, 1.2, Math.PI * 1.1, Math.PI * 1.9);
  else ctx.arc(4.2, headY + 2.4, 1.3, 0.2, Math.PI * 0.8);
  ctx.stroke();

  // front arm with sleeve
  ctx.fillStyle = L.top;
  circle(ctx, 1, shoulderY, 2.2);
  ctx.strokeStyle = L.skin;
  ctx.lineWidth = 2.6;
  line(ctx, 1, shoulderY + 0.5, h1x, h1y);
  ctx.fillStyle = L.skin;
  circle(ctx, h1x, h1y, 1.5);

  ctx.restore();
}

// ---------------------------------------------------------------- enemies

function drawHedgehog(ctx, e, t) {
  const cx = e.x + e.w / 2, by = e.y + e.h, d = e.dir;
  const step = Math.sin(e.t * 12);
  ctx.fillStyle = '#3b2616';
  ellipse(ctx, cx - 6, by - 2 + Math.max(0, step) * -1.5, 3.5, 2.2);
  ellipse(ctx, cx + 6, by - 2 + Math.max(0, -step) * -1.5, 3.5, 2.2);
  ctx.fillStyle = '#5c3a1f';
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (1.05 + i * 0.12);
    const ax = -d * Math.cos(a) * 1;
    const bx = cx + ax * 12 - d * 2, byy = by - 10 + Math.sin(a) * 9;
    ctx.beginPath();
    ctx.moveTo(bx - 3.5, byy + 2);
    ctx.lineTo(cx - d * 2 + ax * 19, by - 10 + Math.sin(a) * 15);
    ctx.lineTo(bx + 3.5, byy + 2);
    ctx.fill();
  }
  ctx.fillStyle = '#8a5a33';
  ellipse(ctx, cx - d * 1, by - 9, 12.5, 8.5);
  ctx.fillStyle = '#f1d3a6';
  ellipse(ctx, cx + d * 7, by - 7.5, 6.5, 6);
  ctx.fillStyle = '#222';
  circle(ctx, cx + d * 13, by - 8, 2);
  circle(ctx, cx + d * 8, by - 9.5, 1.3);
  ctx.strokeStyle = '#3a2412';
  ctx.lineWidth = 1.6;
  line(ctx, cx + d * 5.5, by - 13.5, cx + d * 10, by - 11.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx + d * 9, by - 3.5, 1.8, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

function drawFrog(ctx, e, t) {
  const cx = e.x + e.w / 2, by = e.y + e.h, d = e.dir;
  const air = !e.onGround;
  const squash = e.onGround && e.timer < 0.25 ? 1.5 : 0;
  ctx.fillStyle = '#2f8f3a';
  if (air) {
    ctx.strokeStyle = '#2f8f3a';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    line(ctx, cx - 6, by - 6, cx - 11, by + 1);
    line(ctx, cx + 6, by - 6, cx + 11, by + 1);
  } else {
    ellipse(ctx, cx - 9, by - 3, 5, 3);
    ellipse(ctx, cx + 9, by - 3, 5, 3);
  }
  ctx.fillStyle = '#4cbf4a';
  ellipse(ctx, cx, by - 9 + squash, 12, 9 - squash);
  ctx.fillStyle = '#c9f0a8';
  ellipse(ctx, cx + d * 2, by - 6 + squash, 7, 4.5);
  ctx.fillStyle = '#4cbf4a';
  circle(ctx, cx - 5, by - 17 + squash, 4.8);
  circle(ctx, cx + 5, by - 17 + squash, 4.8);
  ctx.fillStyle = '#fff';
  circle(ctx, cx - 5, by - 17.5 + squash, 3.3);
  circle(ctx, cx + 5, by - 17.5 + squash, 3.3);
  ctx.fillStyle = '#1d1d1d';
  circle(ctx, cx - 5 + d * 1.2, by - 17.5 + squash, 1.6);
  circle(ctx, cx + 5 + d * 1.2, by - 17.5 + squash, 1.6);
  ctx.strokeStyle = '#1f5f26';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx + d * 2, by - 11 + squash, 5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,120,140,0.5)';
  circle(ctx, cx - 7, by - 10 + squash, 1.5);
  circle(ctx, cx + 7, by - 10 + squash, 1.5);
}

function drawCrow(ctx, e, t) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, d = e.dir;
  const flap = Math.sin(t * 14 + e.phase);
  ctx.fillStyle = '#2b2d42';
  ctx.beginPath();
  ctx.moveTo(cx - d * 11, cy);
  ctx.lineTo(cx - d * 20, cy - 4);
  ctx.lineTo(cx - d * 19, cy + 4);
  ctx.fill();
  ellipse(ctx, cx, cy + 1, 12, 8);
  circle(ctx, cx + d * 10, cy - 3, 6.5);
  ctx.fillStyle = '#ffae2b';
  ctx.beginPath();
  ctx.moveTo(cx + d * 15, cy - 5);
  ctx.lineTo(cx + d * 22, cy - 2);
  ctx.lineTo(cx + d * 15, cy);
  ctx.fill();
  ctx.fillStyle = '#fff';
  circle(ctx, cx + d * 11.5, cy - 4.5, 2.4);
  ctx.fillStyle = '#111';
  circle(ctx, cx + d * 12.2, cy - 4.5, 1.2);
  ctx.fillStyle = '#3d4060';
  ctx.beginPath();
  ctx.moveTo(cx - d * 6, cy - 1);
  ctx.lineTo(cx + d * 4, cy - 1);
  ctx.lineTo(cx - d * 3, cy - 1 - flap * 14);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffae2b';
  ctx.fillRect(cx - 3, cy + 8, 1.6, 3);
  ctx.fillRect(cx + 2, cy + 8, 1.6, 3);
}

function drawSpikyPlant(ctx, e, t) {
  const cx = e.x + e.w / 2, by = e.y + e.h;
  const sw = Math.sin(t * 2 + e.phase) * 1.5;
  ctx.fillStyle = '#2f7a3c';
  ctx.beginPath();
  ctx.ellipse(cx - 7, by - 3, 8, 3, -0.4, 0, Math.PI * 2);
  ctx.ellipse(cx + 7, by - 3, 8, 3, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2f7a3c';
  ctx.lineWidth = 3.5;
  line(ctx, cx, by - 2, cx + sw, by - 14);
  const hx = cx + sw, hy = by - 19;
  ctx.fillStyle = '#e8f5ff';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + t * 0.3;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a - 0.25) * 9, hy + Math.sin(a - 0.25) * 9);
    ctx.lineTo(hx + Math.cos(a) * 15, hy + Math.sin(a) * 15);
    ctx.lineTo(hx + Math.cos(a + 0.25) * 9, hy + Math.sin(a + 0.25) * 9);
    ctx.fill();
  }
  ctx.fillStyle = '#6f3fa8';
  circle(ctx, hx, hy, 10);
  ctx.fillStyle = '#9d6ad6';
  circle(ctx, hx - 2.5, hy - 2.5, 4);
  ctx.fillStyle = '#fff';
  circle(ctx, hx - 3.5, hy - 1, 2.4);
  circle(ctx, hx + 3.5, hy - 1, 2.4);
  ctx.fillStyle = '#111';
  circle(ctx, hx - 3.3, hy - 0.5, 1.2);
  circle(ctx, hx + 3.7, hy - 0.5, 1.2);
  ctx.strokeStyle = '#2a1745';
  ctx.lineWidth = 1.2;
  line(ctx, hx - 6, hy - 5, hx - 1.5, hy - 3.5);
  line(ctx, hx + 6, hy - 5, hx + 1.5, hy - 3.5);
}

function drawCactus(ctx, e, t) {
  const cx = e.x + e.w / 2, by = e.y + e.h;
  ctx.fillStyle = '#3f8f3a';
  roundRect(ctx, cx - 5, by - 32, 10, 32, 5);
  ctx.fill();
  roundRect(ctx, cx - 13, by - 24, 6, 13, 3);
  ctx.fill();
  ctx.fillRect(cx - 13, by - 14, 9, 5);
  roundRect(ctx, cx + 7, by - 28, 6, 14, 3);
  ctx.fill();
  ctx.fillRect(cx + 4, by - 17, 9, 5);
  ctx.fillStyle = '#5fb04f';
  ctx.fillRect(cx - 2, by - 30, 2, 28);
  ctx.strokeStyle = '#f5f0d8';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const yy = by - 28 + i * 5;
    line(ctx, cx - 5, yy, cx - 8, yy - 1);
    line(ctx, cx + 5, yy + 2, cx + 8, yy + 1);
  }
  ctx.fillStyle = '#ff6fae';
  circle(ctx, cx, by - 33, 2.6);
}

function drawScorpion(ctx, e, t) {
  const cx = e.x + e.w / 2, by = e.y + e.h, d = e.dir;
  const crouch = e.mode === 'crouch' ? 2 : 0;
  const step = Math.sin(e.t * (e.mode === 'dash' ? 30 : 16));
  ctx.strokeStyle = '#7a3f1c';
  ctx.lineWidth = 1.6;
  for (let i = -1; i <= 1; i++) line(ctx, cx + i * 6, by - 5, cx + i * 6 + step * 2 * (i % 2 ? 1 : -1), by);
  ctx.fillStyle = '#c2612a';
  ellipse(ctx, cx, by - 7 + crouch * 0.5, 11, 6 - crouch * 0.3);
  // tail curling up over the back
  ctx.strokeStyle = '#c2612a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - d * 9, by - 8);
  ctx.quadraticCurveTo(cx - d * 18, by - 22 - crouch * 2, cx - d * 6, by - 22 - crouch * 2);
  ctx.stroke();
  ctx.fillStyle = e.mode === 'crouch' ? '#ffd23f' : '#5a2a10';
  circle(ctx, cx - d * 5, by - 21 - crouch * 2, 2.6);
  // claws
  ctx.fillStyle = '#d9763a';
  ellipse(ctx, cx + d * 14, by - 8, 4.5, 3);
  ctx.fillStyle = '#c2612a';
  ctx.beginPath();
  ctx.moveTo(cx + d * 17, by - 10);
  ctx.lineTo(cx + d * 21, by - 12);
  ctx.lineTo(cx + d * 18, by - 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  circle(ctx, cx + d * 6, by - 10, 2);
  ctx.fillStyle = '#111';
  circle(ctx, cx + d * 6.6, by - 10, 1);
}

function drawVulture(ctx, e, t) {
  // warning shadow on the ground where it will dive
  if (e.target && (e.mode === 'warn' || e.mode === 'dive')) {
    const k = e.mode === 'warn' ? 1 - e.modeT : 1;
    ctx.fillStyle = `rgba(60, 20, 0, ${0.2 + 0.35 * k})`;
    ellipse(ctx, e.target.x, e.target.y - 2, 10 + 14 * k, 4 + 3 * k);
    ctx.strokeStyle = `rgba(200, 30, 20, ${0.4 + 0.4 * Math.abs(Math.sin(t * 12))})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.target.x, e.target.y - 2, 12 + 14 * k, 5 + 3 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, d = e.dir;
  const flap = e.mode === 'dive' ? -0.6 : Math.sin(t * 7 + e.phase);
  ctx.fillStyle = '#4a3326';
  ctx.beginPath();
  ctx.moveTo(cx - 8, cy - 2);
  ctx.lineTo(cx - 26, cy - 4 - flap * 14);
  ctx.lineTo(cx - 4, cy + 4);
  ctx.moveTo(cx + 8, cy - 2);
  ctx.lineTo(cx + 26, cy - 4 - flap * 14);
  ctx.lineTo(cx + 4, cy + 4);
  ctx.fill();
  ellipse(ctx, cx, cy + 2, 12, 8);
  ctx.fillStyle = '#f2e6d6';
  ellipse(ctx, cx + d * 7, cy - 5, 5, 4);
  ctx.fillStyle = '#d98ba0';
  circle(ctx, cx + d * 12, cy - 7, 4.5);
  ctx.fillStyle = '#f0c040';
  ctx.beginPath();
  ctx.moveTo(cx + d * 15, cy - 8);
  ctx.lineTo(cx + d * 21, cy - 5);
  ctx.lineTo(cx + d * 15, cy - 4);
  ctx.fill();
  ctx.fillStyle = '#111';
  circle(ctx, cx + d * 13, cy - 8.5, 1.2);
}

function drawTumbleweed(ctx, e, t, camX) {
  if (e.warning) {
    // dust cloud at the right screen edge before it rolls in
    const x = camX + VIEW_W - 24, y = e.y + e.h - 6;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(230, 190, 130, ${0.5 + 0.3 * Math.sin(t * 10 + i)})`;
      circle(ctx, x + Math.sin(t * 6 + i * 2) * 10, y - i * 5 + Math.cos(t * 7 + i) * 3, 9 - i);
    }
    return;
  }
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-e.t * 9);
  ctx.strokeStyle = '#a0763e';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 6 + (i % 3) * 2.5, (i / 7) * Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#c99a5a';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- sea creatures

function drawCrab(ctx, e, t) {
  const cx = e.x + e.w / 2, by = e.y + e.h;
  const snap = Math.abs(Math.sin(t * 6 + e.phase));
  ctx.strokeStyle = '#b8321f';
  ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    const k = Math.sin(e.t * 14 + i) * 2;
    line(ctx, cx - 8 + i * 3, by - 6, cx - 14 + i * 3 + k, by);
    line(ctx, cx + 8 + i * 3, by - 6, cx + 14 + i * 3 - k, by);
  }
  ctx.fillStyle = '#e8503a';
  ellipse(ctx, cx, by - 9, 13, 8);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#e8503a';
    ellipse(ctx, cx + s * 16, by - 14, 6, 5);
    ctx.fillStyle = '#b8321f';
    ctx.beginPath();
    ctx.moveTo(cx + s * 18, by - 16);
    ctx.lineTo(cx + s * 24, by - 20 - snap * 3);
    ctx.lineTo(cx + s * 21, by - 14);
    ctx.fill();
  }
  ctx.strokeStyle = '#b8321f';
  line(ctx, cx - 4, by - 16, cx - 5, by - 21);
  line(ctx, cx + 4, by - 16, cx + 5, by - 21);
  ctx.fillStyle = '#fff';
  circle(ctx, cx - 5, by - 22, 2.4);
  circle(ctx, cx + 5, by - 22, 2.4);
  ctx.fillStyle = '#111';
  circle(ctx, cx - 5, by - 22, 1.2);
  circle(ctx, cx + 5, by - 22, 1.2);
}

function drawJellyfish(ctx, e, t) {
  const cx = e.x + e.w / 2, top = e.y;
  ctx.strokeStyle = 'rgba(255, 170, 220, 0.8)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const x = cx - 10 + i * 5;
    ctx.beginPath();
    ctx.moveTo(x, top + 14);
    for (let j = 1; j <= 4; j++) ctx.lineTo(x + Math.sin(t * 4 + i + j) * 3, top + 14 + j * 5);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 140, 210, 0.85)';
  ctx.beginPath();
  ctx.ellipse(cx, top + 14, 14, 13, 0, Math.PI, 0);
  ctx.lineTo(cx - 14, top + 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ellipse(ctx, cx - 5, top + 6, 4, 3);
  ctx.fillStyle = '#5a1f4a';
  circle(ctx, cx - 4, top + 10, 1.5);
  circle(ctx, cx + 4, top + 10, 1.5);
}

function drawPufferfish(ctx, e, t) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, d = e.dir;
  const r = e.puffed ? 18 : 11;
  if (e.puffed) {
    ctx.fillStyle = '#c9a23a';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.15) * r, cy + Math.sin(a - 0.15) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7));
      ctx.lineTo(cx + Math.cos(a + 0.15) * r, cy + Math.sin(a + 0.15) * r);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#e8c35a';
    ctx.beginPath();
    ctx.moveTo(cx - d * 10, cy);
    ctx.lineTo(cx - d * 18, cy - 6 + Math.sin(t * 12) * 2);
    ctx.lineTo(cx - d * 18, cy + 6 + Math.sin(t * 12) * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f2d06a';
  circle(ctx, cx, cy, r);
  ctx.fillStyle = '#fff6d8';
  ellipse(ctx, cx, cy + r * 0.4, r * 0.7, r * 0.45);
  ctx.fillStyle = '#fff';
  circle(ctx, cx + d * r * 0.45, cy - r * 0.25, r * 0.28);
  ctx.fillStyle = '#111';
  circle(ctx, cx + d * r * 0.52, cy - r * 0.25, r * 0.14);
}

function drawEel(ctx, e, t) {
  const hx = (e.holeTx + 0.5) * TILE, hy = (e.holeTy + 0.5) * TILE, d = e.dir;
  // the hole in the rock
  ctx.fillStyle = '#1a1a2a';
  ellipse(ctx, hx - d * 12, hy, 9, 12);
  if (e.mode === 'warn') {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const k = (t * 1.5 + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(hx - d * 8 + Math.sin(t * 8 + i) * 4, hy - k * 30, 2 + (i % 2), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  if (e.len < 4) return;
  const x0 = hx - d * 12;
  ctx.strokeStyle = '#4f8a3a';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, hy);
  for (let i = 1; i <= 8; i++) ctx.lineTo(x0 + d * (e.len * i) / 8, hy + Math.sin(t * 10 + i) * 3);
  ctx.stroke();
  const tipX = x0 + d * e.len;
  ctx.fillStyle = '#5fa04a';
  ellipse(ctx, tipX, hy, 10, 7);
  ctx.fillStyle = '#ffe36e';
  circle(ctx, tipX + d * 3, hy - 3, 2.2);
  ctx.fillStyle = '#111';
  circle(ctx, tipX + d * 3.5, hy - 3, 1);
  ctx.strokeStyle = '#2a4a1e';
  ctx.lineWidth = 1.5;
  line(ctx, tipX + d * 4, hy + 2, tipX + d * 9, hy + 2);
}

// ---------------------------------------------------------------- Admiral Octavia

function drawOctavia(ctx, b, t) {
  const cx = b.x + b.w / 2, by = b.y + b.h, d = b.dir;
  const flash = b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0;
  const puff = b.state === 'puff';
  const body = flash ? '#fff0ff' : puff ? '#4a2a6a' : '#9b59c9';
  const dark = flash ? '#ffe0ff' : '#6a3a96';
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(b.scale, b.scale);
  // tentacles around the base
  ctx.strokeStyle = dark;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const bx = -46 + i * 18;
    ctx.beginPath();
    ctx.moveTo(bx, -18);
    ctx.quadraticCurveTo(bx + Math.sin(t * 3 + i) * 10, -6, bx + (i < 3 ? -10 : 10) + Math.sin(t * 2 + i) * 4, 0);
    ctx.stroke();
  }
  // grabbing shells
  if (b.state === 'grab') {
    ctx.fillStyle = '#f2d6b0';
    for (const sx of [-50, 0, 50]) circle(ctx, sx, -60 + Math.sin(t * 10 + sx) * 3, 8);
  }
  const s = puff ? 1.08 + Math.sin(t * 20) * 0.03 : 1;
  ctx.scale(s, s);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -44, 50, 40, 0, Math.PI, 0);
  ctx.quadraticCurveTo(50, -10, 30, -12);
  ctx.lineTo(-30, -12);
  ctx.quadraticCurveTo(-50, -10, -50, -44);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ellipse(ctx, -16, -66, 14, 8);
  // eyes
  const weak = b.state === 'weak';
  for (const ex of [-16, 16]) {
    ctx.fillStyle = '#fff';
    circle(ctx, ex, -40, 11);
    if (weak) {
      ctx.strokeStyle = '#2a1040';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, -40, 5, t * 10, t * 10 + Math.PI * 1.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1a0a2a';
      circle(ctx, ex + d * 3, -39, 5);
    }
  }
  ctx.strokeStyle = '#2a1040';
  ctx.lineWidth = 3;
  line(ctx, -28, -56, -8, -52);
  line(ctx, 28, -56, 8, -52);
  ctx.beginPath();
  ctx.arc(0, -24, 8, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // admiral's hat
  ctx.fillStyle = '#1f2a55';
  ctx.beginPath();
  ctx.moveTo(-34, -78);
  ctx.quadraticCurveTo(0, -112, 34, -78);
  ctx.quadraticCurveTo(0, -86, -34, -78);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(-30, -82, 60, 3);
  drawStar(ctx, 0, -92, 6, '#ffd23f');
  ctx.restore();
  if (weak) drawWeakStars(ctx, cx, b.y - 20, t);
}

function drawTentacle(ctx, g, t) {
  if (g.state === 'warn') {
    // a line of bubbles rises from the sea floor where it will burst out
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    const k = 1 - g.warn / g.maxWarn;
    for (let i = 0; i < 8; i++) {
      const p = (t * 1.6 + i / 8) % 1;
      ctx.beginPath();
      ctx.arc(g.x + Math.sin(t * 6 + i) * 6, g.floorY - p * 200 * (0.4 + k), 2 + (i % 3), 0, Math.PI * 2);
      ctx.stroke();
    }
    drawShadow(ctx, g.x, g.floorY, k);
    return;
  }
  if (g.len <= 0) return;
  const r = g.rect;
  ctx.fillStyle = g.stuck ? '#7a4aa6' : '#9b59c9';
  roundRect(ctx, r.x, r.y, r.w, r.h + 6, 12);
  ctx.fill();
  ctx.fillStyle = '#e8b8ff';
  for (let yy = r.y + 12; yy < r.y + r.h - 6; yy += 16) circle(ctx, r.x + r.w / 2 + 4, yy, 3.5);
  if (g.stuck) {
    ctx.fillStyle = '#c9b48a';
    ellipse(ctx, g.x, g.floorY - 2, 24, 7);
  }
}

function drawSpinShell(ctx, sh, t) {
  const cx = sh.x + sh.w / 2, cy = sh.y + sh.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 10 * sh.dir);
  ctx.fillStyle = '#f2d6b0';
  ctx.beginPath();
  ctx.moveTo(0, 10);
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.lineTo(Math.cos(a) * 13, Math.sin(a) * 11 + 4);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#b8906a';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    line(ctx, 0, 9, Math.cos(a) * 12, Math.sin(a) * 10 + 4);
  }
  ctx.restore();
}

function drawInk(ctx, arena, t) {
  const mid = (arena.left + arena.right) / 2;
  const x0 = arena.ink.side < 0 ? arena.left : mid;
  const fade = Math.min(1, arena.ink.t / 0.5);
  ctx.fillStyle = `rgba(15, 5, 30, ${0.82 * fade})`;
  ctx.fillRect(x0, arena.level.surfaceY, mid - arena.left, arena.floorY - arena.level.surfaceY + 64);
  ctx.fillStyle = `rgba(40, 15, 70, ${0.6 * fade})`;
  for (let i = 0; i < 8; i++) {
    circle(ctx, (arena.ink.side < 0 ? mid : mid) + Math.sin(t * 2 + i) * 20, arena.level.surfaceY + 40 + i * 50, 30);
  }
}

// King Sandclaw: a huge crowned sand scorpion.
function drawSandclaw(ctx, b, t) {
  const cx = b.x + b.w / 2, by = b.y + b.h;
  const d = b.dir;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(b.scale * d, b.scale);
  const stamp = b.state === 'stamp' ? Math.abs(Math.sin(t * 16)) * 3 : 0;
  const slam = b.state === 'slam' ? Math.sin(t * 30) * 2 : 0;
  const body = b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0 ? '#fff4d8' : '#d98c3a';
  const dark = b.flash > 0 ? '#ffe0a8' : '#a8612a';
  // legs
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const run = b.state === 'charge' ? Math.sin(t * 30) * 5 : b.state === 'stamp' ? Math.sin(t * 16) * 4 : 0;
  for (let i = 0; i < 4; i++) {
    const lx = -30 + i * 16;
    line(ctx, lx, -18, lx - 8 + (i % 2 ? run : -run), -stamp * (i % 2));
  }
  // tail: raised and glowing when about to rain stingers
  const raise = b.state === 'tail' ? 1 : b.state === 'tailWait' ? 0.6 : 0;
  ctx.strokeStyle = body;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-36, -26);
  ctx.quadraticCurveTo(-70, -60 - raise * 20, -40 + raise * 4, -78 - raise * 22);
  ctx.stroke();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const tt = 0.2 + k * 0.2;
    const px = (1 - tt) * (1 - tt) * -36 + 2 * (1 - tt) * tt * -70 + tt * tt * (-40 + raise * 4);
    const py = (1 - tt) * (1 - tt) * -26 + 2 * (1 - tt) * tt * (-60 - raise * 20) + tt * tt * (-78 - raise * 22);
    line(ctx, px - 5, py, px + 5, py);
  }
  const sx = -38 + raise * 4, sy = -84 - raise * 22;
  if (raise > 0) {
    ctx.fillStyle = `rgba(255, 80, 40, ${0.35 + 0.3 * Math.sin(t * 20)})`;
    circle(ctx, sx, sy, 16);
  }
  ctx.fillStyle = raise > 0 ? '#ff4a2a' : '#5a2a10';
  ctx.beginPath();
  ctx.moveTo(sx - 6, sy + 4);
  ctx.lineTo(sx + 10, sy - 6);
  ctx.lineTo(sx + 4, sy + 8);
  ctx.fill();
  // body segments
  ctx.fillStyle = body;
  ellipse(ctx, -20, -22 + slam, 24, 17);
  ellipse(ctx, 8, -24 + slam, 28, 20);
  ctx.fillStyle = dark;
  for (let k = 0; k < 3; k++) ctx.fillRect(-34 + k * 14, -36 + slam, 3, 20);
  // claws
  const clawOpen = b.state === 'stamp' || b.state === 'charge' ? Math.abs(Math.sin(t * 10)) * 0.5 : 0.15;
  for (const [ox, oy] of [[40, -20], [34, -34]]) {
    ctx.fillStyle = body;
    ellipse(ctx, ox, oy + slam, 13, 8);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(ox + 8, oy - 2 + slam);
    ctx.lineTo(ox + 24, oy - 8 - clawOpen * 14 + slam);
    ctx.lineTo(ox + 14, oy + slam);
    ctx.moveTo(ox + 8, oy + 3 + slam);
    ctx.lineTo(ox + 24, oy + 8 + clawOpen * 10 + slam);
    ctx.lineTo(ox + 14, oy + 2 + slam);
    ctx.fill();
  }
  // face
  const dizzy = b.state === 'weak';
  if (dizzy) {
    ctx.strokeStyle = '#2a1405';
    ctx.lineWidth = 2;
    for (const ex of [18, 30]) {
      ctx.beginPath();
      ctx.arc(ex, -30 + slam, 3.5, t * 10, t * 10 + Math.PI * 1.5);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#fff';
    circle(ctx, 18, -30 + slam, 5);
    circle(ctx, 30, -30 + slam, 5);
    ctx.fillStyle = '#1a0a00';
    circle(ctx, 19.5, -29.5 + slam, 2.4);
    circle(ctx, 31.5, -29.5 + slam, 2.4);
    ctx.strokeStyle = '#2a1405';
    ctx.lineWidth = 2.5;
    line(ctx, 12, -38 + slam, 22, -35 + slam);
    line(ctx, 36, -38 + slam, 26, -35 + slam);
  }
  // golden crown
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(10, -42 + slam);
  ctx.lineTo(12, -56 + slam);
  ctx.lineTo(18, -48 + slam);
  ctx.lineTo(24, -60 + slam);
  ctx.lineTo(30, -48 + slam);
  ctx.lineTo(36, -56 + slam);
  ctx.lineTo(38, -42 + slam);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e0303a';
  circle(ctx, 24, -47 + slam, 2.2);
  ctx.restore();
  // dizzy stars circle his head
  if (b.state === 'weak') drawWeakStars(ctx, cx + d * 24 * b.scale, b.y - 18, t);
}

function drawWeakStars(ctx, cx, y, t) {
  for (let k = 0; k < 3; k++) {
    const a = t * 5 + (k * Math.PI * 2) / 3;
    drawStar(ctx, cx + Math.cos(a) * 22, y + Math.sin(a) * 6, 5, '#fff36e');
  }
}

// Warning shadow on the ground; k grows 0 → 1 as the danger approaches.
function drawShadow(ctx, x, y, k) {
  ctx.fillStyle = `rgba(40, 20, 10, ${0.2 + 0.4 * k})`;
  ellipse(ctx, x, y - 2, 8 + 12 * k, 3 + 2.5 * k);
  ctx.strokeStyle = `rgba(220, 40, 30, ${0.3 + 0.4 * Math.abs(Math.sin(k * 12))})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y - 2, 10 + 12 * k, 4 + 2.5 * k, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSnowball(ctx, s, t) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  ctx.fillStyle = '#ffffff';
  circle(ctx, cx, cy, s.w / 2);
  ctx.fillStyle = '#cfe0f2';
  circle(ctx, cx + 3, cy + 3, s.w / 2 - 4);
  ctx.fillStyle = '#ffffff';
  circle(ctx, cx - 2, cy - 2, s.w / 2 - 5);
}

function drawSpine(ctx, s, t) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  const a = s.t < s.time ? Math.atan2(s.groundY - s.y0 - 520 * Math.cos(Math.PI * s.t / s.time) * 0.5, s.tx - s.x0) : Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(s.t < s.time ? a : Math.PI / 2);
  ctx.fillStyle = '#5a3a1e';
  ctx.beginPath();
  ctx.moveTo(-10, -3);
  ctx.lineTo(12, 0);
  ctx.lineTo(-10, 3);
  ctx.fill();
  ctx.fillStyle = '#f1d3a6';
  ctx.fillRect(-12, -2, 4, 4);
  ctx.restore();
}

function drawShockWave(ctx, w, t) {
  ctx.globalAlpha = Math.max(0.2, 1 - w.traveled / w.range);
  ctx.fillStyle = 'rgba(110, 80, 40, 0.75)';
  ctx.beginPath();
  ctx.moveTo(w.x, w.y + w.h);
  ctx.quadraticCurveTo(w.x + w.w / 2, w.y - 6, w.x + w.w, w.y + w.h);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 200, 120, 0.8)';
  for (let i = 0; i < 3; i++) circle(ctx, w.x + 8 + i * 10, w.y + 4 + Math.sin(t * 20 + i) * 3, 2.2);
  ctx.globalAlpha = 1;
}

function drawTongue(ctx, g, t) {
  const r = g.rect;
  if (r.w <= 0) return;
  ctx.fillStyle = '#e8577a';
  roundRect(ctx, r.x, r.y, r.w, r.h, 5);
  ctx.fill();
  ctx.fillStyle = '#ff8aa8';
  const tipX = g.dir > 0 ? r.x + r.w : r.x;
  circle(ctx, tipX, r.y + r.h / 2, 8);
}

// Big Bristle: a round grumpy hedgehog, or a rolling spiky ball.
function drawBristle(ctx, b, t) {
  const cx = b.x + b.w / 2, by = b.y + b.h, d = b.dir;
  const flash = b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0;
  const body = flash ? '#fff4d8' : '#8a5a33';
  const spike = flash ? '#ffe7c0' : '#5c3a1f';
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(b.scale * d, b.scale);
  if (b.curled) {
    ctx.translate(0, -29);
    ctx.rotate(b.state === 'roll' ? b.x * 0.05 * d : Math.sin(t * 22) * 0.18);
    ctx.fillStyle = spike;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * 24, Math.sin(a - 0.2) * 24);
      ctx.lineTo(Math.cos(a) * 36, Math.sin(a) * 36);
      ctx.lineTo(Math.cos(a + 0.2) * 24, Math.sin(a + 0.2) * 24);
      ctx.fill();
    }
    ctx.fillStyle = body;
    circle(ctx, 0, 0, 26);
    ctx.fillStyle = '#f1d3a6';
    circle(ctx, 8, 6, 9);
    ctx.restore();
    return;
  }
  const puff = b.state === 'shake' ? 1 + Math.abs(Math.sin(t * 25)) * 0.08 : 1;
  ctx.scale(puff, puff);
  ctx.fillStyle = '#3b2616';
  ellipse(ctx, -22, -3, 9, 5);
  ellipse(ctx, 18, -3, 9, 5);
  ctx.fillStyle = spike;
  for (let i = 0; i < 13; i++) {
    const a = Math.PI * (0.95 + i * 0.085);
    const bx = -6 + Math.cos(a) * 38, byy = -26 + Math.sin(a) * 26;
    ctx.beginPath();
    ctx.moveTo(bx - 6 * Math.sin(a), byy + 6 * Math.cos(a));
    ctx.lineTo(-6 + Math.cos(a) * 58, -26 + Math.sin(a) * 44);
    ctx.lineTo(bx + 6 * Math.sin(a), byy - 6 * Math.cos(a));
    ctx.fill();
  }
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(-4, -24, 44, 26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f1d3a6';
  ellipse(ctx, 28, -20, 17, 15);
  ctx.fillStyle = '#222';
  circle(ctx, 44, -22, 4.5);
  if (b.state === 'weak') {
    ctx.strokeStyle = '#2a1405';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(26, -29, 4, t * 10, t * 10 + Math.PI * 1.5);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#fff';
    ellipse(ctx, 26, -29, 5, 5.5);
    ctx.fillStyle = '#111';
    circle(ctx, 27.5, -28.5, 2.6);
    ctx.strokeStyle = '#3a2412';
    ctx.lineWidth = 3;
    line(ctx, 18, -38, 32, -34);
  }
  ctx.strokeStyle = '#3a2412';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(32, -9, 4, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
  if (b.state === 'weak') drawWeakStars(ctx, cx + d * 28 * b.scale, b.y - 12, t);
}

// Queen Croakia: a giant frog with a leaf crown.
function drawCroakia(ctx, b, t) {
  if (b.shadowX !== null && b.shadowX !== undefined) {
    const k = Math.min(1, (b.leapT || 0) / (b.leapTime || 1));
    drawShadow(ctx, b.shadowX, b.arena.floorY, k);
    ctx.fillStyle = `rgba(40, 60, 20, ${0.15 + 0.25 * k})`;
    ellipse(ctx, b.shadowX, b.arena.floorY - 2, 30 + 20 * k, 6 + 3 * k);
  }
  const cx = b.x + b.w / 2, by = b.y + b.h, d = b.dir;
  const flash = b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0;
  const body = flash ? '#f4ffe8' : '#3fae45';
  const dark = flash ? '#e0ffd0' : '#2c8034';
  const crouch = b.state === 'crouch' ? 8 : 0;
  const air = b.state === 'leap';
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(b.scale * d, b.scale);
  // legs
  ctx.fillStyle = dark;
  if (air) {
    ctx.strokeStyle = dark;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    line(ctx, -26, -18, -40, 8);
    line(ctx, 26, -18, 40, 8);
  } else {
    ellipse(ctx, -34, -6, 18, 8);
    ellipse(ctx, 34, -6, 18, 8);
  }
  ctx.fillStyle = body;
  ellipse(ctx, 0, -28 + crouch * 0.6, 50, 30 - crouch * 0.4);
  ctx.fillStyle = '#c9f0a8';
  ellipse(ctx, 10, -18 + crouch * 0.5, 30, 16);
  // puffed cheeks while crouching
  if (b.state === 'crouch') {
    ctx.fillStyle = '#ffb3c6';
    circle(ctx, 38, -26, 10 + Math.sin(t * 20) * 2);
  }
  // eyes
  const glow = b.state === 'mouth';
  for (const ex of [-16, 20]) {
    ctx.fillStyle = body;
    circle(ctx, ex, -56 + crouch, 14);
    ctx.fillStyle = glow ? '#ffe36e' : '#fff';
    circle(ctx, ex, -58 + crouch, 10);
    if (b.state === 'weak') {
      ctx.strokeStyle = '#1d3a12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex, -58 + crouch, 5, t * 10, t * 10 + Math.PI * 1.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#111';
      circle(ctx, ex + 3, -58 + crouch, 4.5);
    }
  }
  // leaf crown
  ctx.fillStyle = '#6fcf3f';
  for (const [lx, rot] of [[-4, -0.5], [2, 0], [8, 0.5]]) {
    ctx.beginPath();
    ctx.ellipse(lx, -70 + crouch, 4, 10, rot, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ff7ab8';
  circle(ctx, 2, -64 + crouch, 3);
  // mouth
  if (b.state === 'mouth' || b.state === 'tongueOut') {
    ctx.fillStyle = '#7a1f2e';
    ellipse(ctx, 30, -26, 16, 8);
  } else {
    ctx.strokeStyle = '#1d5a22';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(14, -36 + crouch, 26, 0.35, Math.PI - 0.9);
    ctx.stroke();
  }
  ctx.restore();
  if (b.state === 'weak') {
    // stuck in the mud
    ctx.fillStyle = '#6b4a2b';
    ellipse(ctx, cx, by - 4, b.w * 0.7, 12);
    ctx.fillStyle = '#8a6440';
    for (let i = 0; i < 5; i++) circle(ctx, cx - 50 + i * 25, by - 12 + Math.sin(t * 6 + i) * 2, 5);
    drawWeakStars(ctx, cx, b.y - 20, t);
  }
}

// Frostbeak: a giant snow owl.
function drawFrostbeak(ctx, b, t) {
  if (b.target !== null && b.target !== undefined && (b.state === 'hover' || b.state === 'dive')) {
    drawShadow(ctx, b.target, b.arena.floorY, b.state === 'hover' ? 1 - b.t : 1);
  }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, d = b.dir;
  const flash = b.flash > 0 && Math.floor(b.flash * 20) % 2 === 0;
  const body = flash ? '#fffbe0' : '#f4f8ff';
  const shade = '#c9d8ea';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(b.scale, b.scale);
  // wings
  const spread = b.state === 'spread' || b.state === 'blow';
  const flapSpeed = b.state === 'hoot' ? 30 : 10;
  const flap = spread ? 0 : b.state === 'dive' ? -0.9 : Math.sin(t * flapSpeed) * 0.8;
  ctx.fillStyle = shade;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 18, -6);
    if (spread) {
      ctx.lineTo(s * 78, -18);
      ctx.lineTo(s * 70, 6);
      ctx.lineTo(s * 20, 12);
    } else {
      ctx.lineTo(s * 52, -10 - flap * 26);
      ctx.lineTo(s * 40, 10 - flap * 10);
      ctx.lineTo(s * 16, 14);
    }
    ctx.fill();
  }
  ctx.fillStyle = body;
  ellipse(ctx, 0, 2, 32, 30);
  // ear tufts
  ctx.beginPath();
  ctx.moveTo(-24, -18); ctx.lineTo(-20, -36); ctx.lineTo(-10, -24);
  ctx.moveTo(24, -18); ctx.lineTo(20, -36); ctx.lineTo(10, -24);
  ctx.fill();
  ctx.fillStyle = '#9fb3c8';
  for (let i = 0; i < 6; i++) circle(ctx, -14 + (i % 3) * 14, 10 + Math.floor(i / 3) * 8, 2);
  // eyes and beak
  const weak = b.state === 'weak';
  for (const ex of [-11, 11]) {
    ctx.fillStyle = '#ffd23f';
    circle(ctx, ex + d * 2, -10, 9);
    if (weak) {
      ctx.strokeStyle = '#1a1a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ex + d * 2, -10, 4.5, t * 10, t * 10 + Math.PI * 1.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#111';
      circle(ctx, ex + d * 4, -10, 4.5);
    }
  }
  ctx.strokeStyle = '#4a5a70';
  ctx.lineWidth = 2.5;
  line(ctx, -20, -22, -4, -17);
  line(ctx, 20, -22, 4, -17);
  ctx.fillStyle = '#ff9a2a';
  ctx.beginPath();
  ctx.moveTo(d * 2 - 4, -4);
  ctx.lineTo(d * 2 + 4, -4);
  ctx.lineTo(d * 2, 4);
  ctx.fill();
  ctx.fillStyle = '#ff9a2a';
  ctx.fillRect(-12, 28, 5, 5);
  ctx.fillRect(7, 28, 5, 5);
  ctx.restore();
  if (weak) {
    // stuck in the snowdrift
    const by = b.y + b.h;
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, cx, by - 6, b.w * 0.75, 20);
    ctx.fillStyle = '#e1ecf8';
    ellipse(ctx, cx + 10, by - 4, b.w * 0.5, 10);
    drawWeakStars(ctx, cx, b.y - 14, t);
  }
}

// Platform looks and icy floor inside a boss arena.
function drawArenaDecor(ctx, arena, t) {
  const lvl = arena.level;
  for (let ty = arena.wallBottomRow - 6; ty <= arena.wallBottomRow; ty++) {
    for (let tx = arena.leftCol + 1; tx < arena.rightCol; tx++) {
      if (lvl.get(tx, ty) !== '#') continue;
      const x = tx * TILE, y = ty * TILE;
      if (arena.kind === 'croakia') {
        ctx.fillStyle = '#2f7a3a';
        ctx.fillRect(x - 1, y, TILE + 2, TILE);
        ctx.fillStyle = '#5cbf4f';
        ellipse(ctx, x + 16, y + 6, 20, 8);
        ctx.fillStyle = '#2f7a3a';
        ctx.beginPath();
        ctx.moveTo(x + 16, y + 6);
        ctx.lineTo(x + 30, y + 2);
        ctx.lineTo(x + 30, y + 10);
        ctx.fill();
        if (tx % 3 === 0) { ctx.fillStyle = '#ff9ccf'; circle(ctx, x + 10, y + 2, 4); }
      } else if (arena.kind === 'frostbeak') {
        ctx.fillStyle = '#9cc7ea';
        ctx.fillRect(x, y, TILE + 0.6, TILE);
        ctx.fillStyle = '#d9efff';
        ctx.fillRect(x, y, TILE + 0.6, 8);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(x + 6, y + 12, 10, 2);
      } else if (arena.kind === 'octavia') {
        ctx.fillStyle = '#4a5a6a';
        ctx.fillRect(x, y, TILE + 0.6, TILE);
        ctx.fillStyle = '#6a7a8a';
        ctx.fillRect(x + 1, y + 1, TILE - 2, 9);
        ctx.fillStyle = '#e0668a';
        if (tx % 2 === 0) { roundRect(ctx, x + 8, y - 8, 5, 10, 2); ctx.fill(); }
      } else if (arena.kind === 'sandclaw') {
        ctx.fillStyle = '#8f8a82';
        ctx.fillRect(x, y, TILE + 0.6, TILE);
        ctx.fillStyle = '#bab4aa';
        ctx.fillRect(x + 1, y + 1, TILE - 2, 10);
        ctx.fillStyle = '#6f6a63';
        ctx.fillRect(x + 12, y + 16, 2, 10);
      }
    }
  }
  if (arena.icy) {
    const y = arena.floorY;
    for (let x = arena.left; x < arena.right; x += TILE) {
      ctx.fillStyle = '#cfe8fb';
      ctx.fillRect(x, y, TILE + 0.6, 9);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillRect(x + 4 + ((x / TILE) % 3) * 6, y + 3, 8, 1.5);
    }
  }
}

// Small boss picture for the level select cards.
function drawBossPortrait(ctx, kind, x, bottom, s, t) {
  const cfg = BOSS_TYPES[kind];
  const fake = { x: -cfg.w / 2, y: -cfg.h, w: cfg.w, h: cfg.h, dir: -1, state: 'idle', scale: 1, flash: 0, anim: t, hp: cfg.hp, curled: false, shadowX: null, target: null };
  ctx.save();
  ctx.translate(x, bottom);
  ctx.scale(s, s);
  if (kind === 'bristle') drawBristle(ctx, fake, t);
  else if (kind === 'croakia') drawCroakia(ctx, fake, t);
  else if (kind === 'frostbeak') { fake.y = -cfg.h - 6; drawFrostbeak(ctx, fake, t); }
  else if (kind === 'octavia') { fake.dir = 1; drawOctavia(ctx, fake, t); }
  else drawSandclaw(ctx, fake, t);
  ctx.restore();
}

function drawStinger(ctx, s, t) {
  ctx.fillStyle = '#5a2a10';
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(s.x + s.w, s.y);
  ctx.lineTo(s.x + s.w / 2, s.y + s.h);
  ctx.fill();
  ctx.fillStyle = '#ff6a3a';
  ctx.beginPath();
  ctx.moveTo(s.x + 3, s.y + 4);
  ctx.lineTo(s.x + s.w - 3, s.y + 4);
  ctx.lineTo(s.x + s.w / 2, s.y + s.h - 6);
  ctx.fill();
}

function drawSandWave(ctx, w, t) {
  ctx.fillStyle = '#e8b86a';
  ctx.beginPath();
  ctx.moveTo(w.x, w.y + w.h);
  for (let i = 0; i <= 8; i++) {
    const px = w.x + (i / 8) * w.w;
    const py = w.y + w.h - Math.sin((i / 8) * Math.PI) * w.h - Math.sin(t * 20 + i) * 2;
    ctx.lineTo(px, py);
  }
  ctx.lineTo(w.x + w.w, w.y + w.h);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 240, 200, 0.8)';
  for (let i = 0; i < 4; i++) circle(ctx, w.x + 8 + i * 10, w.y + 4 + Math.sin(t * 15 + i) * 3, 2);
}

function drawBossBar(ctx, boss) {
  const w = 300, x = VIEW_W / 2 - w / 2, y = 26;
  drawText(ctx, boss.name, VIEW_W / 2, 11, 15, '#ffe680');
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x - 3, y - 3, w + 6, 16, 6);
  ctx.fill();
  const seg = w / boss.maxHp;
  for (let i = 0; i < boss.maxHp; i++) {
    ctx.fillStyle = i < boss.hp ? (boss.flash > 0 ? '#fff' : '#e8403a') : 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + i * seg + 1, y, seg - 2, 10);
  }
}

// Skull under a sun: the "very hard" badge.
function drawSkullSun(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = '#ff9a1f';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    line(ctx, Math.cos(a) * 12, Math.sin(a) * 12 - 2, Math.cos(a) * 16, Math.sin(a) * 16 - 2);
  }
  ctx.fillStyle = '#ffb627';
  circle(ctx, 0, -2, 10);
  ctx.fillStyle = '#fff8ec';
  circle(ctx, 0, -3, 6.5);
  ctx.fillRect(-3.5, 1, 7, 4);
  ctx.fillStyle = '#2b2d42';
  circle(ctx, -2.5, -3.5, 1.7);
  circle(ctx, 2.5, -3.5, 1.7);
  ctx.fillRect(-1.5, 2, 1, 2);
  ctx.fillRect(0.5, 2, 1, 2);
  ctx.restore();
}

function drawCrown(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#b07c14';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-12, 7);
  ctx.lineTo(-13, -7);
  ctx.lineTo(-6, -1);
  ctx.lineTo(0, -10);
  ctx.lineTo(6, -1);
  ctx.lineTo(13, -7);
  ctx.lineTo(12, 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0303a';
  circle(ctx, 0, 2, 2.2);
  ctx.restore();
}

// ---------------------------------------------------------------- collectibles & props

function drawCoin(ctx, cx, cy, r, t) {
  const w = Math.max(0.15, Math.abs(Math.cos(t * 4)));
  ctx.fillStyle = '#b8860b';
  ellipse(ctx, cx, cy, r * w, r);
  ctx.fillStyle = '#ffd23f';
  ellipse(ctx, cx, cy, Math.max(0.5, r * w - 2), r - 2);
  ctx.fillStyle = '#fff3b0';
  if (w > 0.4) ctx.fillRect(cx - r * w * 0.25, cy - r * 0.5, Math.max(1, r * w * 0.2), r);
}

function drawCarrot(ctx, cx, bottom, s, t) {
  ctx.save();
  ctx.translate(cx, bottom);
  ctx.scale(s, s);
  ctx.fillStyle = '#3fae3a';
  const w = Math.sin(t * 5) * 1.5;
  ctx.beginPath();
  ctx.ellipse(-3 + w * 0.3, -20, 2, 5, -0.5, 0, Math.PI * 2);
  ctx.ellipse(0, -22, 2, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(3 - w * 0.3, -20, 2, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff8a1f';
  ctx.beginPath();
  ctx.moveTo(-6, -16);
  ctx.quadraticCurveTo(0, -19, 6, -16);
  ctx.lineTo(0.8, 0);
  ctx.lineTo(-0.8, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#d9670d';
  ctx.lineWidth = 1;
  line(ctx, -3, -11, 0, -10);
  line(ctx, 3, -7, 0, -6);
  line(ctx, -2, -4, 0, -3.5);
  ctx.restore();
}

function drawCheckpoint(ctx, cp, t) {
  const x = cp.x, by = cp.y;
  ctx.fillStyle = '#5b5b66';
  ctx.fillRect(x - 6, by - 4, 12, 4);
  ctx.fillStyle = '#d7d7df';
  ctx.fillRect(x - 1.5, by - 48, 3, 44);
  if (cp.active) {
    const w = Math.sin(t * 8) * 2;
    ctx.fillStyle = 'rgba(120, 255, 140, 0.35)';
    circle(ctx, x + 10, by - 40, 16);
    ctx.fillStyle = '#39d353';
    ctx.beginPath();
    ctx.moveTo(x + 1.5, by - 48);
    ctx.quadraticCurveTo(x + 12, by - 45 + w, x + 22, by - 41);
    ctx.quadraticCurveTo(x + 12, by - 37 - w, x + 1.5, by - 33);
    ctx.fill();
  } else {
    ctx.fillStyle = '#9a9aa5';
    ctx.beginPath();
    ctx.moveTo(x + 1.5, by - 22);
    ctx.lineTo(x + 18, by - 15);
    ctx.lineTo(x + 1.5, by - 8);
    ctx.fill();
  }
  ctx.fillStyle = cp.active ? '#fff58a' : '#b5b5bd';
  circle(ctx, x, by - 50, 3);
}

function drawGoalFlag(ctx, f, t) {
  ctx.save();
  ctx.translate(0, (1 - f.rise) * (f.bottom - f.top + 16)); // rises out of the ground
  drawGoalFlagAt(ctx, f, t);
  ctx.restore();
}

function drawGoalFlagAt(ctx, f, t) {
  const x = f.poleX, by = f.bottom, top = f.top;
  ctx.fillStyle = '#6b6b78';
  ctx.fillRect(x - 12, by - 8, 28, 8);
  ctx.fillStyle = '#8a8a98';
  ctx.fillRect(x - 12, by - 8, 28, 2);
  ctx.fillStyle = '#e8e8f0';
  ctx.fillRect(x, top, 4, by - top - 8);
  ctx.fillStyle = '#ffd23f';
  circle(ctx, x + 2, top - 3, 6);
  const fy = f.flagY;
  ctx.fillStyle = '#ff5fa2';
  ctx.beginPath();
  ctx.moveTo(x + 4, fy);
  for (let i = 0; i <= 10; i++) {
    const px = x + 4 + i * 4.4;
    ctx.lineTo(px, fy + Math.sin(t * 6 - i * 0.6) * 2.5 * (i / 10));
  }
  for (let i = 10; i >= 0; i--) {
    const px = x + 4 + i * 4.4;
    ctx.lineTo(px, fy + 30 + Math.sin(t * 6 - i * 0.6) * 2.5 * (i / 10));
  }
  ctx.closePath();
  ctx.fill();
  drawStar(ctx, x + 24, fy + 15 + Math.sin(t * 6 - 5 * 0.6) * 1.2, 7, '#fff5a8');
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawStopwatch(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.4;
  ctx.fillRect(-3, -14, 6, 3);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineCap = 'round';
  line(ctx, 0, 0, 0, -6);
  line(ctx, 0, 0, 4, 2);
  ctx.restore();
}

// Air meter: 10 bubbles under the hearts; blinks when 3 are left.
function drawAirMeter(ctx, p) {
  const n = Math.ceil((p.air / AIR.max) * 10);
  const low = p.air <= AIR.warnAt && !p.airPaused;
  if (low && Math.floor(Game.time * 6) % 2 === 0) return;
  ctx.fillStyle = 'rgba(5, 25, 60, 0.5)';
  roundRect(ctx, 10, 48, 232, 22, 10);
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const x = 24 + i * 22, y = 59;
    ctx.strokeStyle = i < n ? (low ? '#ff8080' : '#dff6ff') : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.stroke();
    if (i < n) {
      ctx.fillStyle = low ? 'rgba(255,120,120,0.35)' : 'rgba(160,230,255,0.35)';
      circle(ctx, x, y, 6);
      ctx.fillStyle = '#ffffff';
      circle(ctx, x - 2.5, y - 2.5, 1.6);
    }
  }
}

function drawHeart(ctx, x, y, s, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-10, -1, -7, -10, 0, -5);
  ctx.bezierCurveTo(7, -10, 10, -1, 0, 6);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff4d6d' : 'rgba(0,0,0,0.35)';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = filled ? '#8c1c33' : 'rgba(255,255,255,0.5)';
  ctx.stroke();
  if (filled) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ellipse(ctx, -3.5, -3, 1.6, 1.1, -0.6);
  }
  ctx.restore();
}

function drawFlame(ctx, x, y, s, t) {
  const f = Math.sin(t * 18) * 0.8;
  ctx.fillStyle = '#ff5a1f';
  ctx.beginPath();
  ctx.moveTo(x, y - 10 * s - f);
  ctx.quadraticCurveTo(x + 7 * s, y - 3 * s, x + 5 * s, y + 3 * s);
  ctx.quadraticCurveTo(x, y + 7 * s, x - 5 * s, y + 3 * s);
  ctx.quadraticCurveTo(x - 7 * s, y - 3 * s, x, y - 10 * s - f);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(x, y - 4 * s + f * 0.5);
  ctx.quadraticCurveTo(x + 3.5 * s, y + 1 * s, x, y + 4.5 * s);
  ctx.quadraticCurveTo(x - 3.5 * s, y + 1 * s, x, y - 4 * s + f * 0.5);
  ctx.fill();
}

function drawFireball(ctx, fb, t) {
  const cx = fb.x + fb.w / 2, cy = fb.y + fb.h / 2;
  if (fb.water) {
    // underwater the fireball turns into a hot steam bubble
    ctx.fillStyle = 'rgba(255, 180, 120, 0.35)';
    circle(ctx, cx, cy, 8);
    ctx.strokeStyle = 'rgba(255, 240, 220, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = 'rgba(255, 150, 40, 0.35)';
  circle(ctx, cx, cy, 10);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 14 * Math.sign(fb.vx || 1));
  ctx.fillStyle = '#ff5a1f';
  circle(ctx, 0, 0, 6);
  ctx.fillStyle = '#ffb627';
  circle(ctx, 1.5, -1.5, 3.8);
  ctx.fillStyle = '#fff3b0';
  circle(ctx, 2.2, -2.2, 1.6);
  ctx.restore();
}

// Faint glow in the shot's colour while the shooting power is active.
function drawShotGlow(ctx, cx, cy, r, t, color) {
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
  ctx.globalAlpha = 0.4 + Math.sin(t * 6) * 0.08;
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  circle(ctx, cx, cy, r);
  ctx.globalAlpha = 1;
}

function drawStarShot(ctx, s, t) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  ctx.fillStyle = 'rgba(255, 240, 150, 0.35)';
  circle(ctx, cx, cy, 10);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 16);
  drawStar(ctx, 0, 0, 8, '#ffe066');
  drawStar(ctx, 0, 0, 3.5, '#ffffff');
  ctx.restore();
}

function drawBubbleShot(ctx, s, t) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2, r = s.w / 2;
  ctx.fillStyle = 'rgba(160, 230, 255, 0.25)';
  circle(ctx, cx, cy, r);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `hsla(${(t * 200) % 360}, 90%, 75%, 0.7)`;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0.3, 1.6);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  circle(ctx, cx - r * 0.4, cy - r * 0.4, 2.5);
}

function drawBoomerang(ctx, s, t) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 18);
  ctx.strokeStyle = '#8a5a2c';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.lineTo(0, -4);
  ctx.lineTo(9, 6);
  ctx.stroke();
  ctx.strokeStyle = '#d9a05b';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

// An enemy caught in a bubble, floating away.
function drawTrapBubble(ctx, e, t) {
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2, r = Math.max(e.w, e.h) * 0.75;
  ctx.fillStyle = 'rgba(160, 230, 255, 0.25)';
  circle(ctx, cx, cy, r);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  circle(ctx, cx - r * 0.45, cy - r * 0.45, 3);
}

// HUD icon for each character's shot.
function drawShotIcon(ctx, kind, x, y, t) {
  if (kind === 'fireball') { drawFlame(ctx, x, y, 1.3, t); return; }
  const fake = { x: x - 9, y: y - 9, w: 18, h: 18 };
  if (kind === 'star') drawStarShot(ctx, fake, t);
  else if (kind === 'bubble') drawBubbleShot(ctx, fake, t);
  else drawBoomerang(ctx, fake, t);
}

// ---------------------------------------------------------------- HUD

function drawHUD(ctx, scene) {
  ctx.fillStyle = scene.level.theme.hud;
  ctx.fillRect(0, 0, VIEW_W, 44);
  const shown = Math.max(3, Math.min(scene.lives, 6));
  for (let i = 0; i < shown; i++) drawHeart(ctx, 26 + i * 30, 22, 1.25, i < scene.lives);
  let x = 26 + shown * 30;
  if (scene.lives > 6) {
    drawText(ctx, `×${scene.lives}`, x, 22, 18, '#fff', 'left');
    x += 44;
  }
  ctx.globalAlpha = scene.player.big ? 1 : 0.3;
  drawCarrot(ctx, x + 6, 36, 1.1, scene.player.big ? Game.time : 0);
  ctx.globalAlpha = 1;
  ctx.globalAlpha = scene.player.canShoot ? 1 : 0.25;
  drawShotIcon(ctx, scene.player.cfg.shot, x + 32, 22, scene.player.canShoot ? Game.time : 0);
  ctx.globalAlpha = 1;
  if (scene.level.underwater) drawAirMeter(ctx, scene.player);
  if (scene.arena && scene.arena.fighting) drawBossBar(ctx, scene.arena.boss);
  else drawText(ctx, scene.level.name, VIEW_W / 2, 22, 22, '#ffffff');
  drawCoin(ctx, 730, 22, 10, Game.time);
  drawText(ctx, `× ${scene.coins}`, 746, 23, 20, '#ffe680', 'left');
  const tm = scene.timer;
  if (tm.challenge) {
    const warn = tm.warning;
    const pulse = warn ? 1 + 0.12 * Math.max(0, Math.sin(Game.time * Math.PI * 2)) : 1;
    ctx.save();
    ctx.translate(935, 23);
    ctx.scale(pulse, pulse);
    drawStopwatch(ctx, -72, 0, 0.8, warn ? '#ff4d4d' : '#ffffff');
    drawText(ctx, formatTime(Math.ceil(tm.remaining)), 0, 0, 20, warn ? '#ff4d4d' : '#ffffff', 'right');
    ctx.restore();
  } else {
    drawText(ctx, formatTime(tm.elapsed), 935, 23, 20, '#ffffff', 'right');
  }
}
