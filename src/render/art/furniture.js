// ============================================================================
// ILLUSTRATED FURNITURE (doors, windows, cups and the rest, piece by piece)
// ----------------------------------------------------------------------------
// The pixel-art furniture module lists every live piece with a state key and
// its rectangle; this swaps in the illustrated cut-out for each key the
// manifest has and draws the enlarged pixel picture for the rest.
// ============================================================================

import { furniturePieces } from '../hd/furniture.js';

// Every live piece with the illustrated cut-out that stands in for it (or null
// where there is none) and the rectangle it occupies, in canvas pixels at
// scale S. The 2D view draws this list; the 3D view stands the same pieces up
// as cut-outs.
export function illustratedPieces(game, S, assets) {
  return furniturePieces(game, S).map((p) => {
    const f = assets.furniture(p.key);
    // A picture bigger than its piece (the open doorway) is lined up by its
    // right and bottom edges and keeps its own size.
    if (f && f.place) return { key: p.key, f, pixel: p, x: p.x + p.w + f.right - f.w, y: p.y + p.h + f.bottom - f.h, w: f.w, h: f.h };
    return { key: p.key, f, pixel: p, x: p.x, y: p.y, w: p.w, h: p.h };
  });
}

export function drawIllustratedFurniture(ctx, game, S, assets, stats) {
  for (const q of illustratedPieces(game, S, assets)) {
    const { f, pixel: p } = q;
    if (f) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(q.x), Math.round(q.y), Math.round(q.w), Math.round(q.h));
      if (stats) stats.drawn++;
    } else if (p.key === 'chain' && assets.furniture('bike')) {
      // The illustrated bike has no separate chain picture; draw nothing rather than a pixel-art one.
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
      if (stats && p.key !== 'chain') stats.fallback++;
    }
  }
}
