// ============================================================================
// ILLUSTRATED FURNITURE (doors, windows, cups and the rest, piece by piece)
// ----------------------------------------------------------------------------
// The pixel-art furniture module lists every live piece with a state key and
// its rectangle; this swaps in the illustrated cut-out for each key the
// manifest has and draws the enlarged pixel picture for the rest.
// ============================================================================

import { furniturePieces } from '../hd/furniture.js';

export function drawIllustratedFurniture(ctx, game, S, assets, stats) {
  for (const p of furniturePieces(game, S)) {
    const f = assets.furniture(p.key);
    if (f) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(p.x), Math.round(p.y), Math.round(p.w), Math.round(p.h));
      if (stats) stats.drawn++;
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(p.img, p.x, p.y, p.w, p.h);
      if (stats && p.key !== 'chain') stats.fallback++;
    }
  }
}
