// ============================================================================
// INPUT (keyboard, and a fake keyboard for tests)
// ----------------------------------------------------------------------------
// Maps physical keys to game actions. Eric asks two kinds of question:
//   pressed(action)     is the key held down right now? (walking)
//   wasPressed(action)  was it pressed since I last looked? (jump, fire, act)
// While Eric is writing on a blackboard, typed characters are collected in a
// queue instead of being treated as actions.
//
// The scheme is deliberately small: the cursor keys for direction and four
// action keys in a row under the left hand (Z X C V).
//   up     climb stairs; stand up when sitting or lying down
//   down   descend stairs; sit down; open the desk when seated
//   jump   jump (also jump off the bike saddle)                  Space or Z
//   fire   the water pistol when a cup or plant pot is in range,
//          otherwise the catapult                                 X
//   act    do the obvious thing in front of Eric: write on a board,
//          catch a mouse or frog, mount the bike, kiss, punch     C
//   drop   drop a stinkbomb; with none left, release the mice     V
// Change the key bindings in DEFAULT_BINDINGS.
// ============================================================================

export const DEFAULT_BINDINGS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  up: ['ArrowUp'],
  down: ['ArrowDown'],
  jump: ['Space', 'KeyZ'],
  fire: ['KeyX'],
  act: ['KeyC'],
  drop: ['KeyV'],
  // UI keys (not game actions)
  pause: ['Escape'],
  view: ['Tab'],
};

export const ACTION_LABELS = {
  left: 'Walk left', right: 'Walk right',
  up: 'Up stairs · stand up', down: 'Down stairs · sit · open desk',
  jump: 'Jump (also jump off the bike saddle)',
  fire: 'Fire: water pistol at a cup or plant pot, otherwise the catapult',
  act: 'Act: write on a board, catch a frog or mouse, mount the bike, kiss, punch',
  drop: 'Drop a stinkbomb (or release the mice when you have no stinkbombs)',
  pause: 'Pause / menu', view: 'Switch original / modern view',
};

export class Input {
  constructor(bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;
    this.held = new Set();        // key codes currently down
    this.edges = new Set();       // actions pressed since last flush
    this.writing = false;
    this.typed = [];              // characters typed while writing
    this.uiHandlers = { pause: [], view: [] };
    this.enabled = true;
  }

  attach(target = window) {
    target.addEventListener('keydown', (e) => this.onKeyDown(e));
    target.addEventListener('keyup', (e) => this.onKeyUp(e));
    target.addEventListener('blur', () => this.held.clear());
  }

  actionFor(code) {
    for (const [action, codes] of Object.entries(this.bindings)) if (codes.includes(code)) return action;
    return null;
  }

  onKeyDown(e) {
    if (e.repeat) return;
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName) && e.code !== 'Escape') return;
    const action = this.actionFor(e.code);
    if (action === 'pause' && !this.writing || (action === 'view' && !this.writing)) {
      this.uiHandlers[action].forEach((h) => h());
      e.preventDefault();
      return;
    }
    if (!this.enabled) return;
    if (this.writing) {
      // Typing goes on the board. Enter, Escape or any cursor key ends the
      // writing (a cursor key then moves Eric away as normal).
      if (e.key === 'Enter' || e.key === 'Escape' || e.key.startsWith('Arrow')) this.typed.push('\n');
      else if (e.key.length === 1) this.typed.push(e.key);
      if (!e.key.startsWith('Arrow')) { e.preventDefault(); return; }
    }
    if (action) {
      this.held.add(e.code);
      this.edges.add(action);
      e.preventDefault();
    }
  }

  onKeyUp(e) { this.held.delete(e.code); }

  onMenu(handler) { this.uiHandlers.pause.push(handler); }
  onView(handler) { this.uiHandlers.view.push(handler); }

  pressed(action) { return this.bindings[action].some((code) => this.held.has(code)); }
  wasPressed(action) { return this.edges.has(action); }
  flush() { this.edges.clear(); }
  startWriting() { this.writing = true; this.typed = []; }
  finishWriting() { this.writing = false; this.typed = []; }
  takeTyped() { const t = this.typed; this.typed = []; return t; }
  nextTyped() { return this.typed.shift(); }   // one character at a time, so fast typists lose nothing

  // Touch/on-screen buttons call these.
  press(action) { this.edges.add(action); this.held.add(`virtual:${action}`); }
  release(action) { this.held.delete(`virtual:${action}`); }
}

// A scriptable keyboard for headless tests: hold or tap actions directly.
export class FakeInput extends Input {
  constructor() { super(); this.heldActions = new Set(); }
  pressed(action) { return this.heldActions.has(action) || super.pressed(action); }
  hold(action) { this.heldActions.add(action); }
  unhold(action) { this.heldActions.delete(action); }
  tap(action) { this.edges.add(action); }
  type(text) { for (const ch of text) this.typed.push(ch); }
}
