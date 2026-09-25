// input.js – keyboard state (held + pressed this step) and mouse clicks in logical coordinates

const Input = {
  bindings: {
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    jump: ['Space', 'ArrowUp', 'KeyW'],
    pause: ['KeyP', 'Escape'],
    confirm: ['Enter', 'NumpadEnter', 'Space'],
    back: ['Escape', 'Backspace'],
    mute: ['KeyM'],
    option: ['KeyE'],
    fire: ['KeyX', 'ShiftLeft', 'ShiftRight', 'KeyJ'],
    timeChallenge: ['KeyT'],
  },
  held: new Set(),
  justPressed: new Set(),
  clicks: [],
  mouse: { x: -1, y: -1 },
  mouseMoved: false,
  canvas: null,

  init(canvas) {
    this.canvas = canvas;
    const blocked = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Backspace']);
    window.addEventListener('keydown', (e) => {
      if (blocked.has(e.code)) e.preventDefault();
      Sound.unlock();
      if (!e.repeat) this.justPressed.add(e.code);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => this.held.clear());
    canvas.addEventListener('mousedown', (e) => {
      Sound.unlock();
      const p = this.toLogical(e);
      this.clicks.push(p);
      e.preventDefault();
    });
    canvas.addEventListener('mousemove', (e) => {
      const p = this.toLogical(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouseMoved = true;
    });
  },

  toLogical(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * VIEW_W,
      y: ((e.clientY - r.top) / r.height) * VIEW_H,
    };
  },

  isDown(action) {
    return this.bindings[action].some((c) => this.held.has(c));
  },

  pressed(action) {
    return this.bindings[action].some((c) => this.justPressed.has(c));
  },

  clicked() {
    return this.clicks.length ? this.clicks[0] : null;
  },

  // Called after every fixed update step.
  endStep() {
    this.justPressed.clear();
    this.clicks.length = 0;
    this.mouseMoved = false;
  },
};

function pointInRect(p, x, y, w, h) {
  return p && p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
}
