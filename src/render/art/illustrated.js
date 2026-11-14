// ============================================================================
// ILLUSTRATED PAINTER (lifelike artwork for the modern view)
// ----------------------------------------------------------------------------
// Draws the modern view from the generated illustrations in assets/illustrated
// at six times the Spectrum's resolution (a cell is 48 pixels, a character
// box 144 x 192). It extends the pixel-art painter and falls back to it, frame
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
import { drawHdText, HD_LINE_HEIGHT } from '../hd/font.js';
import { buildIllustratedBackdrop } from './backdrop.js';
import { ART_SCALE } from './assets.js';
import { drawIllustratedFurniture } from './furniture.js';

const PIXEL_SCALE = 2;    // the pixel-art painter's scale; ours is three times that

export class IllustratedPainter extends ModernPainter {
  constructor(theme, assets) {
    super(theme);
    this.scale = ART_SCALE;
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

  // True when this character has walk-cycle pictures (CYCLE0..7).
  hasCycle(group, look) { return group !== 'OBJ' && !!this.assets.frame(group, 'CYCLE0', look?.variant); }

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
  // Painted rooms over the pixel-art structure (see art/backdrop.js); rebuilt
  // when the pictures finish loading.
  ensureBackdrop() {
    if (!this.backdrop) this.backdrop = buildIllustratedBackdrop(this.theme, this.scale, this.assets);
    return this.backdrop;
  }
  drawBackdrop(ctx, cam, viewW) {
    const S = this.scale, b = this.ensureBackdrop();
    const h = SKOOL.height * SKOOL.cell * S;
    ctx.drawImage(b, cam * S, 0, viewW * S, h, cam * S, 0, viewW * S, h);
  }

  // ---- Furniture, chalk, bubbles, boxes --------------------------------------------
  drawFurniture(ctx, game) {
    drawIllustratedFurniture(ctx, game, this.scale, this.assets, this.stats);
    this.drawChalk(ctx, game);
  }

  // Chalk is the 2x font drawn through the 2x scale; a wiped column is
  // restored from our own backdrop so the illustrated board comes back.
  drawChalk(ctx, game) {
    const S = this.scale, C = SKOOL.cell * S, b = this.ensureBackdrop();
    for (const room of game.world.rooms.values()) {
      const board = room.blackboard;
      if (!board || !board.lines.length) continue;
      this.atPixelScale(ctx, () => {
        const x = board.x * SKOOL.cell * PIXEL_SCALE, y = board.y * SKOOL.cell * PIXEL_SCALE;
        board.lines.forEach((line, i) => drawHdText(ctx, line, x + 4, y + 4 + i * HD_LINE_HEIGHT, this.theme.chalk));
      });
      const x = board.x * C, y = board.y * C;
      for (const col of board.wipedColumns) ctx.drawImage(b, x + col * C, y, C, board.height * C, x + col * C, y, C, board.height * C);
    }
  }
  drawBubble(ctx, c) { this.atPixelScale(ctx, () => super.drawBubble(ctx, c)); }
  drawMessageBox(ctx, box, cam, viewW) { this.atPixelScale(ctx, () => super.drawMessageBox(ctx, box, cam, viewW)); }
}
