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
import { DESK_UNIT } from './backdrop.js';
import { GROUND_MARGIN, playgroundSpan } from './structure.js';
import { loadFonts, drawSpeech, drawCard, drawChalkLines } from './text.js';
import { drawIllustratedFurniture } from './furniture.js';

const PIXEL_SCALE = 2;    // the pixel-art painter's scale; ours is three times that

export class IllustratedPainter extends ModernPainter {
  constructor(theme, assets) {
    super(theme);
    this.scale = ART_SCALE;
    this.smooth = true;             // the renderer turns image smoothing on for us
    this.marginBottom = GROUND_MARGIN;   // game pixels of ground shown below the last row
    this.assets = assets;
    this.flips = new Map();         // frame key -> flipped copy
    this.stats = { drawn: 0, fallback: 0 };
    assets.onReady(() => { this.backdrop = null; this.layers = null; });
    this.view = { x0: 0, x1: 0, y0: 0, y1: 0 };   // the visible strip in canvas pixels, noted each frame
    loadFonts();
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

  // True when this character has a picture for `state` (used for the in-between poses).
  hasFrame(group, state, look) { return group !== 'OBJ' && !!this.assets.frame(group, state, look?.variant); }

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
  drawBackdrop(ctx, cam, viewW, camY = 0, viewH = SKOOL.height * SKOOL.cell + GROUND_MARGIN) {
    const S = this.scale, b = this.ensureBackdrop();
    const h = Math.min(viewH * S, b.height - camY * S);
    this.view = { x0: cam * S, x1: (cam + viewW) * S, y0: camY * S, y1: camY * S + h };
    ctx.drawImage(b, cam * S, camY * S, viewW * S, h, cam * S, camY * S, viewW * S, h);
  }

  // ---- Parallax ---------------------------------------------------------------------
  // Out in the playground the far things move more slowly than the near
  // ones as the view scrolls: the sky hardly at all, the rooftops a little,
  // the boundary wall with the ground. The backdrop has a hole where the
  // playground is; the sky and the skyline are drawn through it here, each
  // shifted by a fraction of how far the view is from the playground's
  // middle. Clouds also drift slowly by themselves.
  drawParallax(ctx, cam, viewW, camY, viewH, now) {
    const sky = this.assets.scene('sky'), line = this.assets.scene('skyline'), wall = this.assets.scene('wall');
    if (!sky || !line || !wall) return;
    const S = this.scale, C = SKOOL.cell * S, u = S / 6, span = playgroundSpan(C);
    const vx0 = Math.max(span.x0, cam * S), vx1 = Math.min(span.x0 + span.w, (cam + viewW) * S);
    if (vx1 <= vx0) return;                                   // the playground is off screen
    const H = (SKOOL.height * SKOOL.cell + GROUND_MARGIN) * S;
    const wallTop = H - wall.img.height * (span.w / wall.img.width);
    const away = (cam + viewW / 2) * S - (span.x0 + span.w / 2);   // how far the view's middle is from the playground's
    ctx.save();
    ctx.beginPath(); ctx.rect(vx0, camY * S, vx1 - vx0, viewH * S); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    // Each layer is scaled to its drawn size once and kept, so a frame only copies pixels.
    if (!this.layers) {
      const scaled = (img, k) => { const c = makeCanvas(Math.round(img.width * k), Math.round(img.height * k)); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height); return c; };
      this.layers = { sky: scaled(sky.img, 1.3 * u), line: scaled(line.img, 0.9 * u) };
    }
    const L = this.layers;
    mirrorTile(ctx, L.sky, Math.round(span.x0 + away * 0.5 + (now / 1000) * 5 * u), Math.round(wallTop + 60 * u - L.sky.height), L.sky.width, L.sky.height, vx0, vx1);
    // The skyline is narrower than the playground, so a mirrored copy fills
    // in beside it. It is anchored by its right-hand end, which keeps that
    // copy (and a second church spire) out of sight.
    const lineShift = 0.16, reach = lineShift * (span.w / 2 + (viewW * S) / 2);
    mirrorTile(ctx, L.line, Math.round(span.x0 + span.w - L.line.width + reach + away * lineShift), Math.round(wallTop + 22 * u - L.line.height), L.line.width, L.line.height, vx0, vx1);
    ctx.restore();
  }

  // Desks are drawn AFTER the people, so a seated pupil's knees go under the
  // desk and anyone walking along the row passes behind it. (The chairs are
  // in the backdrop, behind everyone.)
  drawForeground(ctx) {
    const f = this.assets.furniture('desk');
    if (!f) return;
    const S = this.scale, C = SKOOL.cell * S, u = S / 6;
    for (const [roomId, xs] of Object.entries(SKOOL.desks)) {
      const room = SKOOL.rooms.find((r) => r.id === roomId);
      const floor = (room.bottomRight[1] + 1) * C;
      for (const x of xs) {
        const left = x * C + DESK_UNIT.dx * u;
        if (left + f.w < this.view.x0 || left > this.view.x1) continue;
        ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(left), floor - f.h, f.w, f.h);
      }
    }
  }

  // ---- Furniture, chalk, bubbles, boxes --------------------------------------------
  drawFurniture(ctx, game) {
    drawIllustratedFurniture(ctx, game, this.scale, this.assets, this.stats);
    this.drawChalk(ctx, game);
  }

  // Chalk in a hand. The engine wrapped each line to fit the board with the
  // Spectrum font, so the lines always fit; a wiped column is restored from
  // our own backdrop so the board shows through again.
  drawChalk(ctx, game) {
    const S = this.scale, C = SKOOL.cell * S, u = S / 6, b = this.ensureBackdrop();
    for (const room of game.world.rooms.values()) {
      const board = room.blackboard;
      if (!board || !board.lines.length) continue;
      const x = board.x * C, y = board.y * C;
      drawChalkLines(ctx, board.lines, x + 8 * u, y + 2 * u, C * 0.96, board.width * C - 16 * u, this.theme.chalk, u);
      for (const col of board.wipedColumns) ctx.drawImage(b, x + col * C, y, C, board.height * C, x + col * C, y, C, board.height * C);
    }
  }

  // The whole sentence in a bubble above the speaker (see art/text.js).
  // `pos` is where the speaker is drawn, in game pixels.
  drawBubble(ctx, c, pos) {
    const S = this.scale, u = S / 6, b = c.bubble;
    const [px, py] = pos || [c.x * SKOOL.cell, c.y * SKOOL.cell];
    const text = String(b.words).trim();
    if (!text) return;
    // How far the engine has scrolled the words through its own little window.
    const total = text.length * 6 + 64;                       // roughly: text width plus the window, in Spectrum pixels
    const progress = Math.max(0, Math.min(1, ((b.shift + 8) * 8) / total));
    const headTop = c.isAdult?.() ? 8 : (c.isSitting?.() ? 80 : 54);          // sixths of a pixel below the top of the box
    const mouth = { x: (px + 12 + 5 * c.direction) * S, y: py * S + (headTop - 6) * u };
    drawSpeech(ctx, text, mouth, this.view, progress, u);
  }

  drawMessageBox(ctx, box, cam, viewW, camY = 0) {
    const S = this.scale, C = SKOOL.cell * S, u = S / 6, t = this.theme;
    const paper = box.paper === 'eric' ? t.boxEric : box.paper === 'other' ? t.boxOther : box.paper === 'alarm' ? t.boxAlarm : t.boxSecret;
    const ink = box.paper === 'alarm' ? t.boxInkAlarm : t.boxInk;
    const view = { x0: 0, x1: viewW * S, y0: 0 };
    drawCard(ctx, box.lines, { x: (box.x * SKOOL.cell - cam + 4) * S, y: box.y * C - camY * S - 10 * u }, view, { paper, ink, edge: this.hd.boxEdge }, u);
  }
}

// Cover the strip from x0 to x1 with copies of a picture w wide starting at x,
// every other copy flipped so neighbouring edges always match.
function mirrorTile(ctx, img, x, y, w, h, x0, x1) {
  let k = Math.floor((x0 - x) / w);
  for (let tx = x + k * w; tx < x1; tx += w, k++) {
    if (((k % 2) + 2) % 2 === 0) ctx.drawImage(img, tx, y, w, h);
    else { ctx.save(); ctx.translate(tx + w, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); ctx.restore(); }
  }
}
