// ============================================================================
// INPUT (keyboard, and a fake keyboard for tests)
// ----------------------------------------------------------------------------
// Maps physical keys to game actions. Eric asks two kinds of question:
//   pressed(action)     is the key held down right now? (walking)
//   wasPressed(action)  was it pressed since I last looked? (jump, fire...)
// While Eric is writing on a blackboard, typed characters are collected in a
// queue instead of being treated as actions.
//
// Change the key bindings in DEFAULT_BINDINGS (or via the options menu).
// ============================================================================

export const DEFAULT_BINDINGS = {
  left: ['ArrowLeft', 'KeyO'],
  right: ['ArrowRight', 'KeyP'],
  up: ['ArrowUp', 'KeyQ'],
  down: ['ArrowDown', 'KeyA'],
  jump: ['Space', 'KeyJ'],
  sit: ['KeyS'],
  fire: ['KeyF'],
  hit: ['KeyH'],
  write: ['KeyW'],
  catch: ['KeyC'],
  stinkbomb: ['KeyD'],
  waterPistol: ['KeyG'],
  mountBike: ['KeyM'],
  openDesk: ['KeyO', 'KeyE'],
  releaseMice: ['KeyR'],
  dumpPistol: ['KeyT'],
  kiss: ['KeyK'],
  understood: ['KeyU'],
  pause: ['Escape', 'KeyP'],
};

export const ACTION_LABELS = {
  left: 'Walk left', right: 'Walk right', up: 'Up stairs / keep walking', down: 'Down stairs / keep walking',
  jump: 'Jump', sit: 'Sit / stand', fire: 'Fire catapult', hit: 'Punch', write: 'Write on blackboard (Enter to finish)',
  catch: 'Catch mouse / frog', stinkbomb: 'Drop stinkbomb', waterPistol: 'Fire water pistol', mountBike: 'Mount bike',
  openDesk: 'Open desk (while seated)', releaseMice: 'Release mice', dumpPistol: 'Throw away water pistol',
  kiss: 'Kiss', understood: 'Acknowledge a message', pause: 'Pause / menu',
};

export class Input {
  constructor(bindings = DEFAULT_BINDINGS) {
    this.bindings = bindings;
    this.held = new Set();        // key codes currently down
    this.edges = new Set();       // actions pressed since last flush
    this.writing = false;
    this.typed = [];              // characters typed while writing
    this.menuHandlers = [];
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
    const action = this.actionFor(e.code);
    if (action === 'pause') { this.menuHandlers.forEach((h) => h()); e.preventDefault(); return; }
    if (!this.enabled) return;
    if (this.writing) {
      if (e.key === 'Enter') this.typed.push('\n');
      else if (e.key.length === 1) this.typed.push(e.key);
      e.preventDefault();
      return;
    }
    if (action) {
      this.held.add(e.code);
      this.edges.add(action);
      e.preventDefault();
    }
  }

  onKeyUp(e) { this.held.delete(e.code); }

  onMenu(handler) { this.menuHandlers.push(handler); }

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

// A scriptable keyboard for headless tests: queue actions by tick.
export class FakeInput extends Input {
  constructor() { super(); this.script = new Map(); this.heldActions = new Set(); }
  pressed(action) { return this.heldActions.has(action) || super.pressed(action); }
  hold(action) { this.heldActions.add(action); }
  unhold(action) { this.heldActions.delete(action); }
  tap(action) { this.edges.add(action); }
  type(text) { for (const ch of text) this.typed.push(ch); }
}
