// swimming.js – underwater physics, air meter, currents

const AIR = {
  max: 30, // seconds of air (shown as 10 bubbles)
  warnAt: 9, // 3 bubbles left: meter blinks and a warning sound plays
};

const SWIM = {
  gravity: 280, // much weaker than on land: a slow sink
  sink: 80, // resting sink speed
  diveAccel: 900, // holding down sinks faster
  diveMax: 240,
  stroke: 240, // each tap of jump is a stroke upward
  riseMax: 260,
  speed: 0.7, // left/right at 70% of normal speed
  accel: 700,
  decel: 260, // a little drift when changing direction
  current: 110, // push from < and > current tiles
};

function swimStep(p, dt, level, scene, control, move) {
  const maxSpeed = p.cfg.speed * SWIM.speed * (p.inkSlow ? 0.5 : 1);
  if (move !== 0) {
    p.facing = move;
    p.vx += move * SWIM.accel * dt;
    if (Math.abs(p.vx) > maxSpeed) p.vx = Math.sign(p.vx) * maxSpeed;
  } else {
    const d = SWIM.decel * dt;
    p.vx = Math.abs(p.vx) <= d ? 0 : p.vx - Math.sign(p.vx) * d;
  }

  if (control && Input.pressed('jump')) {
    p.vy = Math.max(-SWIM.riseMax, Math.min(p.vy, 40) - SWIM.stroke);
    p.onGround = false;
    Sound.play('swim');
  }
  if (control && Input.isDown('down')) {
    p.vy = Math.min(p.vy + SWIM.diveAccel * dt, SWIM.diveMax);
  } else {
    p.vy += SWIM.gravity * dt;
    if (p.vy > SWIM.sink) p.vy = Math.max(SWIM.sink, p.vy - 600 * dt);
  }

  const push = level.currentAt(p.cx, p.y + p.h / 2) * SWIM.current + p.push;
  p.prevBottom = p.y + p.h;
  if (level.moveX(p, (p.vx + push) * dt)) p.vx = 0;
  const r = level.moveY(p, p.vy * dt);
  p.onGround = false;
  if (r.hit) {
    if (p.vy > 0) p.onGround = true;
    else if (p.vy < 0 && scene) scene.onHeadBump(r, p);
    p.vy = 0;
  }

  // the top of the level is the water surface: she can't leave the water
  const minY = level.surfaceY - p.h * 0.3;
  if (p.y < minY) {
    p.y = minY;
    if (p.vy < 0) p.vy = 0;
  }

  // air meter
  const atVent = level.ventAt(p);
  if (p.airPaused) {
    if (atVent) p.air = AIR.max;
    return;
  }
  const before = p.air;
  p.air -= dt;
  if (atVent) {
    if (p.air < AIR.max - 1) Sound.play('appear');
    p.air = AIR.max;
  }
  if (before > AIR.warnAt && p.air <= AIR.warnAt) Sound.play('airwarn');
  if (p.air <= 0) {
    p.air = 0;
    if (scene) scene.killPlayer('air');
  }
}
