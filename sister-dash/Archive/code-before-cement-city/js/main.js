// main.js – boot, fixed-timestep game loop, scene manager

const VIEW_W = 960;
const VIEW_H = 540;
const TILE = 32;
const STEP = 1 / 60;
const MAX_STEPS = 5;

const Game = {
  canvas: null,
  ctx: null,
  ratio: 1,
  scene: null,
  character: 'older',
  levelIndex: 0,
  time: 0,

  setScene(scene) {
    this.scene = scene;
    if (scene.enter) scene.enter();
  },

  // Fit the 960x540 logical canvas to the window, rendering at device resolution so shapes stay crisp.
  resize() {
    const s = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    const dpr = window.devicePixelRatio || 1;
    const cssW = Math.max(1, Math.floor(VIEW_W * s));
    const cssH = Math.max(1, Math.floor(VIEW_H * s));
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ratio = this.canvas.width / VIEW_W;
  },
};

function boot() {
  Game.canvas = document.getElementById('game');
  Game.ctx = Game.canvas.getContext('2d');
  SaveData.load();
  Sound.init();
  Input.init(Game.canvas);
  Game.resize();
  window.addEventListener('resize', () => Game.resize());
  Game.setScene(new TitleScene());

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      if (Input.pressed('mute')) Sound.toggleMute();
      Game.time += STEP;
      Game.scene.update(STEP);
      Input.endStep();
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    const ctx = Game.ctx;
    ctx.setTransform(Game.ratio, 0, 0, Game.ratio, 0, 0);
    Game.scene.render(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('load', boot);
