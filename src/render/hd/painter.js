// ============================================================================
// MODERN PAINTER (the HD pixel-art view)
// ----------------------------------------------------------------------------
// The counterpart of OriginalPainter for the modern view. The renderer asks
// it to draw the backdrop, the furniture and each sprite; coordinates arrive
// in ordinary game pixels (8 per cell) and the painter applies the HD scale.
// drawSprite returns false when there is no HD picture yet, so the renderer
// can fall back to the painted stand-in.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { SCALE, FRAME_W, FRAME_H, compose, flipped } from './pixelart.js';
import { dressFor, lookKey } from './palette.js';
import { personLayers } from './people.js';
import { objectLayers } from './objects.js';
import { buildHdBackdrop } from './backdrop.js';

export class ModernPainter {
  constructor(theme) {
    this.scale = SCALE;
    this.theme = theme;
    this.cache = new Map();       // group|state|direction|look -> canvas
    this.backdrop = null;         // built on first use
  }

  setTheme(theme) { this.theme = theme; this.cache.clear(); this.backdrop = null; }

  get hd() { return this.theme.hd || {}; }

  ensureBackdrop() { if (!this.backdrop) this.backdrop = buildHdBackdrop(this.theme, this.scale); return this.backdrop; }

  // The visible slice of the building. cam/viewW in game pixels.
  drawBackdrop(ctx, cam, viewW) {
    const S = this.scale, b = this.ensureBackdrop();
    const h = SKOOL.height * SKOOL.cell * S;
    ctx.drawImage(b, cam * S, 0, viewW * S, h, cam * S, 0, viewW * S, h);
  }

  // A soft ellipse under a standing character's feet.
  drawShadow(ctx, x, y) {
    const S = this.scale;
    ctx.fillStyle = this.hd.shadow || 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(Math.round((x + 12) * S), (y + 32) * S - 1, 9 * S, 1.5 * S, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The cached HD sprite for a character or object, or null if there is none.
  sprite(group, state, direction, look) {
    const key = `${group}|${state}|${direction}|${lookKey(look)}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const layers = group === 'OBJ' ? objectLayers(state) : personLayers(group, state, look);
    let canvas = null;
    if (layers) {
      canvas = compose(layers, dressFor(group, look), FRAME_W, FRAME_H);
      if (direction < 0) canvas = flipped(canvas);
    }
    this.cache.set(key, canvas);
    return canvas;
  }

  // Returns true if the sprite was drawn (false: caller should fall back).
  drawSprite(ctx, group, state, direction, look, x, y) {
    const s = this.sprite(group, state, direction, look);
    if (!s) return false;
    const S = this.scale;
    ctx.drawImage(s, Math.round(x * S), Math.round(y * S));
    return true;
  }
}
