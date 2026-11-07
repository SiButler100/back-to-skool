// ============================================================================
// EVENT BUS
// ----------------------------------------------------------------------------
// A tiny publish/subscribe helper. The engine announces things ("lines given",
// "bell rang", "score changed") and anything can listen: the HUD, the sound
// player, or one of your own features in src/features/.
//
//   game.events.on('lines', ({ recipient, amount }) => { ... });
//   game.events.emit('lines', { recipient, amount });
// ============================================================================

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.off(name, fn);   // returns an "unsubscribe" function
  }

  off(name, fn) {
    this.listeners.get(name)?.delete(fn);
  }

  emit(name, payload) {
    const fns = this.listeners.get(name);
    if (!fns) return;
    for (const fn of fns) {
      try { fn(payload); } catch (err) { console.error(`Listener for "${name}" threw`, err); }
    }
  }
}
