// ============================================================================
// STAGING (stand the cast in chosen places, for comparison pictures)
// ----------------------------------------------------------------------------
// Used by the 3D prototype and by the script that photographs the same spots
// in the flat view, so both pictures show exactly the same moment.
// Returns the top-left corner of the view, in cells.
// ============================================================================

export function stage(game, spot) {
  const cast = game.cast;
  for (const c of cast.characters) c.setCommandListTemplate([['SitStill']]);
  const put = (id, x, y, direction, state = 'WALK0') => {
    const c = id === 'ERIC' ? cast.eric : cast.get(id);
    if (c) Object.assign(c, { x, y, direction, animatoryState: state });
  };
  // Everyone not placed below waits out of sight at the far end of the other school.
  const park = (ids) => ids.forEach((id, i) => put(id, 170 + (i % 10) * 2, i % 2 ? 3 : 10, 1));
  const all = cast.characters.map((c) => c.id);

  if (spot === 'cups') {
    // The corridor with the cups, the toilets stairs, and the science lab above.
    park(all);
    game.world.fillCup('MiddleCup', 'WATER'); game.world.fillCup('RightCup', 'SHERRY');
    put('ERIC', 18, 13, 1);                      // on the step the cups can be hit from
    put('WITHIT', 26, 17, -1); put('CREAK', 37, 17, -1);
    put('BOY01', 30, 17, 1, 'WALK1'); put('BOY02', 33, 17, -1); put('BOY03', 9, 17, 1); put('TEARAWAY', 13, 17, -1, 'WALK1');
    put('ROCKITT', 38, 10, -1); put('SWOT', 34, 10, 1); put('BOY04', 4, 10, 1); put('BOY05', 8, 10, -1); put('BULLY', 12, 10, 1);
    return { x0: 8, y0: 7 };
  }
  if (spot === 'class') {
    // A lesson in the Blue Room, with the middle floor below.
    park(all);
    const board = game.world.getRoom('BlueRoom').blackboard;
    for (const ch of 'THE DOLDRUMS') board.write(ch, null);
    put('WITHIT', 8, 3, 1, 'ARM_UP');
    ['BOY01', 'BOY02', 'SWOT', 'BOY03', 'TEARAWAY'].forEach((id, i) => put(id, [11, 13, 17, 19, 21][i], 3, -1, 'SITTING_ON_CHAIR'));
    put('ERIC', 15, 3, -1, 'SITTING_ON_CHAIR');
    put('BULLY', 26, 3, -1, 'WALK1'); put('WACKER', 30, 3, -1);
    put('BOY04', 5, 10, 1); put('BOY05', 9, 10, -1); put('ROCKITT', 22, 10, 1, 'WALK1'); put('BOY06', 27, 10, -1);
    return { x0: 0, y0: 0 };
  }
  // 'gate': playtime at the school gate.
  park(all);
  put('ERIC', 121, 17, 1); put('HEROINE', 125, 17, -1);
  put('ALBERT', 130, 17, -1);
  put('BOY01', 110, 17, 1, 'WALK1'); put('BOY02', 113, 17, -1); put('BULLY', 116, 17, 1); put('TEARAWAY', 105, 17, 1, 'WALK1');
  put('GIRL01', 139, 17, -1); put('GIRL02', 142, 17, 1, 'WALK1'); put('GIRL03', 145, 17, -1); put('TAKE', 148, 17, -1);
  return { x0: 108, y0: 7 };
}
