// ============================================================================
// OBJECTS (HD pixel art for things that are not people)
// ----------------------------------------------------------------------------
// Pellets, water, drops, the conker, the mouse, the frog, the stinkbomb cloud,
// the desk lid, the bike and the plants. The engine tells these apart only by
// their animatory state, so this is a table from state to layers.
//
// Milestone 1 has none yet: returning null makes the renderer show the painted
// stand-in. The pictures arrive in milestone 3.
// ============================================================================

export const OBJECT_ART = {};

export function objectLayers(state) {
  return OBJECT_ART[state] || null;
}
