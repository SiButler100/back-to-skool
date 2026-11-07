// ============================================================================
// FEATURES (your extensions live here)
// ----------------------------------------------------------------------------
// A feature is a small module that plugs into the running game without
// editing the engine. Each one exports an object:
//
//   export default {
//     id: 'my-feature',           // unique, used for the on/off switch
//     name: 'My feature',         // shown in the sidebar
//     description: '...',
//     defaultOn: true,
//     setup(ctx) { ... }          // called once when the game boots
//   }
//
// `ctx` gives you: game (state + events), renderer, hud (addPanel), input,
// settings. Subscribe to events with ctx.game.events.on(name, fn):
//   'tick' 'lesson' 'lines' 'linesTotal' 'score' 'decked' 'secret' 'found'
//   'quest' 'cup' 'door' 'inventory' 'start' 'gameOver' 'messageBox' 'sound'
//
// Register new features by importing them and adding to the list below.
// ============================================================================

import questTracker from './quest-tracker.js';
import minimap from './minimap.js';
import teacherRadar from './teacher-radar.js';

export const FEATURES = [questTracker, minimap, teacherRadar];

export function setupFeatures(ctx, enabled = {}) {
  for (const f of FEATURES) {
    const on = enabled[f.id] ?? f.defaultOn ?? true;
    if (!on) continue;
    try { f.setup(ctx); } catch (err) { console.error(`Feature "${f.id}" failed to start`, err); }
  }
}
