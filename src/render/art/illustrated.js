// ============================================================================
// ILLUSTRATED PAINTER (lifelike artwork for the modern view)
// ----------------------------------------------------------------------------
// Draws the modern view from the generated illustrations in assets/illustrated
// at four times the Spectrum's resolution (a cell is 32 pixels, a character
// box 96 x 128). It extends the pixel-art painter and falls back to it, frame
// by frame and piece by piece, whenever an illustration is missing or still
// loading, so the screen is always complete.
//
// Text (chalk, speech bubbles, reprimand boxes) keeps the game's 2x font: it
// is drawn through a 2x scale so its measurements, which the engine relies
// on, never change.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { ModernPainter } from '../hd/painter.js';
import { makeCanvas } from '../hd/pixelart.js';

const PIXEL_SCALE = 2;    // the pixel-art painter's scale; our scale is twice that

export class IllustratedPainter extends ModernPainter {
  constructor(theme, assets) {
    super(theme);
    this.scale = 4;
    this.smooth = true;             // the renderer turns image smoothing on for us
    this.assets = assets;
    this.flips = new Map();         // frame key -> flipped copy
    this.stats = { drawn: 0, fallback: 0 };
    assets.onReady(() => { this.backdrop = null; });
  }

  setTheme(theme) { super.setTheme(theme); this.flips.clear(); }

  // Run a pixel-art drawing routine at our size: scale the context by two
  // and let the inherited code think it is drawing at its own scale.
  atPixelScale(ctx, fn) {
    ctx.save(); ctx.scale(this.scale / PIXEL_SCALE, this.scale / PIXEL_SCALE);
    ctx.imageSmoothingEnabled = false;
    const s = this.scale; this.scale = PIXEL_SCALE;
    try { fn(); } finally { this.scale = s; ctx.restore(); }
  }

  // ---- Sprites --------------------------------------------------------------------
  drawSprite(ctx, group, state, direction, look, x, y) {
    const S = this.scale, bx = Math.round(x * S), by = Math.round(y * S);
    const f = group === 'OBJ' ? this.assets.object(state) : this.assets.frame(group, state, look?.variant);
    if (f) {
      if (direction < 0) {
        const img = this.flipped(f);
        ctx.drawImage(img, bx - (f.w - f.ox - 24 * S), by - f.oy);
      } else {
        ctx.drawImage(f.img, f.x, f.y, f.w, f.h, bx - f.ox, by - f.oy, f.w, f.h);
      }
      this.stats.drawn++;
      return true;
    }
    // No illustration: the pixel-art frame, enlarged crisply.
    const s = this.sprite(group, state, direction, look);
    if (!s) return false;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(s, bx, by, 24 * S, 32 * S);
    ctx.restore();
    this.stats.fallback++;
    return true;
  }

  flipped(f) {
    const key = `${f.img.src}|${f.x},${f.y},${f.w},${f.h}`;
    let c = this.flips.get(key);
    if (!c) {
      c = makeCanvas(f.w, f.h);
      const cx = c.getContext('2d');
      cx.translate(f.w, 0); cx.scale(-1, 1);
      cx.drawImage(f.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
      this.flips.set(key, c);
    }
    return c;
  }

  // ---- The building ----------------------------------------------------------------
  // Until the illustrated rooms arrive, the pixel-art building enlarged.
  ensureBackdrop() {
    if (!this.backdrop) {
      const s = this.scale; this.scale = PIXEL_SCALE;
      try { super.ensureBackdrop(); } finally { this.scale = s; }
    }
    return this.backdrop;
  }
  drawBackdrop(ctx, cam, viewW) {
    const S = this.scale, P = PIXEL_SCALE, b = this.ensureBackdrop();
    const h = SKOOL.height * SKOOL.cell;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(b, cam * P, 0, viewW * P, h * P, cam * S, 0, viewW * S, h * S);
    ctx.restore();
  }

  // ---- Furniture, chalk, bubbles, boxes --------------------------------------------
  drawFurniture(ctx, game) { this.atPixelScale(ctx, () => super.drawFurniture(ctx, game)); }
  drawChalk(ctx, game) { this.atPixelScale(ctx, () => super.drawChalk(ctx, game)); }
  drawBubble(ctx, c) { this.atPixelScale(ctx, () => super.drawBubble(ctx, c)); }
  drawMessageBox(ctx, box, cam, viewW) { this.atPixelScale(ctx, () => super.drawMessageBox(ctx, box, cam, viewW)); }
}
