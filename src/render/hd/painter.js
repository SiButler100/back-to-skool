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
import { drawFurniture, clearFurnitureCache } from './furniture.js';
import { drawHdText, drawHdTextCentred, measureHd, HD_LINE_HEIGHT } from './font.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

export class ModernPainter {
  constructor(theme) {
    this.scale = SCALE;
    this.theme = theme;
    this.cache = new Map();       // group|state|direction|look -> canvas
    this.backdrop = null;         // built on first use
  }

  setTheme(theme) { this.theme = theme; this.cache.clear(); clearFurnitureCache(); this.backdrop = null; }

  get hd() { return this.theme.hd || {}; }

  ensureBackdrop() { if (!this.backdrop) this.backdrop = buildHdBackdrop(this.theme, this.scale); return this.backdrop; }

  // The visible slice of the building. cam/viewW in game pixels.
  drawBackdrop(ctx, cam, viewW) {
    const S = this.scale, b = this.ensureBackdrop();
    const h = SKOOL.height * SKOOL.cell * S;
    ctx.drawImage(b, cam * S, 0, viewW * S, h, cam * S, 0, viewW * S, h);
  }

  // Doors, windows, cups and the rest of the live furniture, then the chalk.
  drawFurniture(ctx, game) { drawFurniture(ctx, game, this.scale, () => this.drawChalk(ctx, game)); }

  // Chalk on the blackboards. A column a teacher has wiped is restored from
  // the clean board in the backdrop.
  drawChalk(ctx, game) {
    const S = this.scale, C = SKOOL.cell * S, b = this.ensureBackdrop();
    for (const room of game.world.rooms.values()) {
      const board = room.blackboard;
      if (!board || !board.lines.length) continue;
      const x = board.x * C, y = board.y * C;
      board.lines.forEach((line, i) => drawHdText(ctx, line, x + 4, y + 4 + i * HD_LINE_HEIGHT, this.theme.chalk));
      for (const col of board.wipedColumns) ctx.drawImage(b, x + col * C, y, C, board.height * C, x + col * C, y, C, board.height * C);
    }
  }

  // A speech bubble: a rounded panel with a lip, the words scrolling through
  // it in 8-pixel steps exactly as the original did (the engine's timing).
  drawBubble(ctx, c) {
    const S = this.scale, C = SKOOL.cell * S, b = c.bubble, hd = this.hd;
    const x = b.x * C, y = b.y * C, w = 8 * C, h = 3 * C;
    ctx.fillStyle = hd.bubbleShadow; roundRect(ctx, x + 2, y + 3, w, h - 8, 6); ctx.fill();
    ctx.fillStyle = hd.bubbleEdge; roundRect(ctx, x, y, w, h - 8, 6); ctx.fill();
    ctx.fillStyle = hd.bubbleFill; roundRect(ctx, x + 2, y + 2, w - 4, h - 12, 5); ctx.fill();
    const lipX = x + b.lipPos * C + 4;                                                  // the lip points at the speaker
    ctx.fillStyle = hd.bubbleEdge; ctx.beginPath(); ctx.moveTo(lipX - 2, y + h - 10); ctx.lineTo(lipX + 12, y + h - 10); ctx.lineTo(lipX + 2, y + h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hd.bubbleFill; ctx.beginPath(); ctx.moveTo(lipX + 1, y + h - 11); ctx.lineTo(lipX + 8, y + h - 11); ctx.lineTo(lipX + 3, y + h - 4); ctx.closePath(); ctx.fill();
    const textWidth = measureHd(b.words);
    const insetX = (4 - 8 * Math.min(0, b.shift)) * S;
    const textX = Math.max(0, b.shift) * 8 * S;
    const width = Math.min((4 + 56) * S - insetX, textWidth - textX);
    if (width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + insetX, y + 4 * S, width, 8 * S); ctx.clip();
      drawHdText(ctx, b.words, x + insetX - textX, y + 5 * S, hd.bubbleInk);
      ctx.restore();
    }
  }

  // A reprimand or a secret: a rounded box in the colour of its kind, in
  // screen space (cam/viewW in game pixels).
  drawMessageBox(ctx, box, cam, viewW) {
    const S = this.scale, C = SKOOL.cell * S, hd = this.hd, theme = this.theme;
    const lines = box.lines;
    const w = Math.max(8 * C, ...lines.map((l) => measureHd(l) + 12 * S));
    const h = lines.length * HD_LINE_HEIGHT + 10 * S;
    let x = (box.x * SKOOL.cell - cam + 4) * S - w / 2;
    let y = box.y * C - h - 2 * S;
    x = Math.max(2, Math.min(viewW * S - w - 2, x)); y = Math.max(2, y);
    x = Math.round(x); y = Math.round(y);
    const paper = box.paper === 'eric' ? theme.boxEric : box.paper === 'other' ? theme.boxOther : box.paper === 'alarm' ? theme.boxAlarm : theme.boxSecret;
    const ink = box.paper === 'alarm' ? theme.boxInkAlarm : theme.boxInk;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; roundRect(ctx, x + 3, y + 4, w, h, 8); ctx.fill();
    ctx.fillStyle = hd.boxEdge; roundRect(ctx, x, y, w, h, 8); ctx.fill();
    ctx.fillStyle = paper; roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; roundRect(ctx, x + 2, y + 2, w - 4, 6, 6); ctx.fill();
    lines.forEach((l, i) => drawHdTextCentred(ctx, l, x + w / 2, y + 5 * S + i * HD_LINE_HEIGHT, ink));
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
