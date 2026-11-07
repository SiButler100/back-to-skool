// ============================================================================
// RENDERER (camera + drawing every frame)
// ----------------------------------------------------------------------------
// Draws the visible slice of the school onto the game canvas:
//   1. the pre-painted backdrop
//   2. live furniture: doors, windows, cups, chalk on blackboards, the safe
//   3. everyone and everything in the cast
//   4. speech bubbles, then any message box
//
// The camera follows Eric. "Smooth motion" eases each sprite towards its true
// cell position so walking looks fluid; switch it off for the original's
// chunky 8-pixel steps.
// ============================================================================

import { SKOOL } from '../data/skool.js';
import { buildBackdrop } from './backdrop.js';
import { getSprite, clearSpriteCache } from './sprites.js';
import { drawText, drawTextCentred, measureText, LINE_HEIGHT } from './font.js';
import { THEMES } from './theme.js';

const C = SKOOL.cell;

export class Renderer {
  constructor(canvas, game, options = {}) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.options = { theme: 'modern', smoothMotion: true, retroScroll: false, viewportColumns: 48, retroStatus: false, ...options };
    this.setTheme(this.options.theme);
    this.cameraX = 0;               // left edge of the view, in pixels
    this.positions = new Map();     // id -> {x, y} eased pixel positions
    this.tint = document.createElement('canvas'); this.tint.width = 24; this.tint.height = 32;
    this.resize(this.options.viewportColumns);
  }

  setTheme(name) {
    this.theme = THEMES[name] || THEMES.modern;
    this.options.theme = name;
    this.backdrop = buildBackdrop(this.theme);
    clearSpriteCache();
  }

  // retroStatus adds the original's three status rows under the play area.
  resize(columns, retroStatus = this.options.retroStatus) {
    this.columns = columns;
    this.options.retroStatus = retroStatus;
    this.canvas.width = columns * C;
    this.canvas.height = (SKOOL.height + (retroStatus ? 3 : 0)) * C;
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---- Camera ----------------------------------------------------------------
  updateCamera() {
    const eric = this.game.cast.eric;
    const viewW = this.canvas.width;
    const maxX = SKOOL.width * C - viewW;
    let target = eric.x * C + 12 - viewW / 2;
    target = Math.max(0, Math.min(maxX, target));
    if (this.options.retroScroll) {
      // Original behaviour: jump the view by 8 columns when Eric nears an edge.
      const col = Math.floor(this.cameraX / C);
      const offset = eric.x - col;
      if (offset >= this.columns - 10) this.cameraX = Math.min(maxX, (col + 8) * C);
      else if (offset <= 9 && col > 0) this.cameraX = Math.max(0, (col - 8) * C);
      if (Math.abs(this.cameraX - target) > viewW) this.cameraX = target;
    } else {
      this.cameraX += (target - this.cameraX) * 0.12;
      if (Math.abs(this.cameraX - target) < 0.5) this.cameraX = target;
    }
    const from = Math.floor(this.cameraX / C), to = from + this.columns;
    this.game.setVisibleColumns(from, to);
  }

  // Eased screen position for a sprite.
  spritePos(thing) {
    let tx = thing.x * C, ty = thing.y * C;
    const p = this.positions.get(thing.id);
    if (!this.options.smoothMotion || !p || !thing.visible || Math.abs(p.x - tx) > 4 * C || Math.abs(p.y - ty) > 4 * C) {
      this.positions.set(thing.id, { x: tx, y: ty });
      return [tx, ty];
    }
    p.x += (tx - p.x) * 0.35; p.y += (ty - p.y) * 0.35;
    if (Math.abs(p.x - tx) < 0.3) p.x = tx;
    if (Math.abs(p.y - ty) < 0.3) p.y = ty;
    return [p.x, p.y];
  }

  // ---- The frame -------------------------------------------------------------
  draw() {
    const { ctx, game, theme } = this;
    this.updateCamera();
    const cam = Math.round(this.cameraX);
    ctx.save();
    ctx.translate(-cam, 0);
    const viewFrom = cam - 32, viewTo = cam + this.canvas.width + 32;

    const playH = SKOOL.height * C;
    ctx.drawImage(this.backdrop, cam, 0, this.canvas.width, playH, cam, 0, this.canvas.width, playH);
    this.drawFurniture(viewFrom, viewTo);

    // Characters and things
    const drawables = game.cast.drawables.filter((d) => d.visible && d.x * C + 24 >= viewFrom && d.x * C <= viewTo);
    for (const d of drawables) {
      const [x, y] = this.spritePos(d);
      let sprite = getSprite(d.group, d.animatoryState, d.direction, d.look);
      if (this.theme.shadow !== 'rgba(0,0,0,0)' && d.group !== 'OBJ' && d.isStanding?.()) {
        ctx.fillStyle = theme.shadow; ctx.fillRect(Math.round(x) + 6, Math.round(y) + 31, 12, 1);
      }
      if (theme.monoSprites && d.group !== 'OBJ') sprite = this.tinted(sprite, theme.monoSprites);
      ctx.drawImage(sprite, Math.round(x), Math.round(y));
    }

    // Speech bubbles
    for (const c of game.cast.characterList) if (c.bubble) this.drawBubble(c);

    ctx.restore();

    // Message box (screen space)
    if (game.messageBox) this.drawMessageBox(game.messageBox, cam);
    if (this.options.retroStatus) this.drawStatus();
  }

  // Recolour a sprite to a single ink, the way an 8-bit machine drew people.
  tinted(sprite, colour) {
    const t = this.tint.getContext('2d');
    t.clearRect(0, 0, 24, 32);
    t.globalCompositeOperation = 'source-over';
    t.drawImage(sprite, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = colour; t.fillRect(0, 0, 24, 32);
    return this.tint;
  }

  // The original's bottom three rows: score box, mice, inventory, lesson box, logo.
  drawStatus() {
    const { ctx, game, theme } = this;
    const top = SKOOL.height * C;
    const w = this.canvas.width;
    const rect = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
    rect(0, top, w, 3 * C, theme.statusPaper);
    // Score box: columns 0-7
    rect(0, top, 8 * C, 3 * C, theme.statusBox);
    const num = (n) => String(n).padStart(5, ' ');
    drawText(ctx, `Score${num(game.score)}`, 2, top + 1, theme.statusInk);
    drawText(ctx, `Lines${num(game.lines)}`, 2, top + 9, theme.statusLinesInk);
    drawText(ctx, `Hi-Sc${num(game.hiScore)}`, 2, top + 17, theme.statusInk);
    // Mice and pockets: columns 8-15
    const eric = game.cast.eric;
    if (eric.mice > 0) drawText(ctx, `${eric.mice} mice`, 8 * C + 2, top + 1, theme.statusInk);
    let ix = 8 * C + 2;
    for (const item of eric.inventory) { drawIcon(ctx, item, ix, top + 2 * C, theme); ix += 9; }
    // Lesson box: columns 16-23
    rect(16 * C, top, 8 * C, 3 * C, theme.statusBox);
    rect(16 * C + 1, top + 1, 8 * C - 2, 3 * C - 2, theme.lessonPaper);
    const { teacher, room } = game.lessonDescription();
    drawTextCentred(ctx, teacher, 20 * C, top + 4, theme.lessonInk);
    drawTextCentred(ctx, room, 20 * C, top + 13, theme.lessonInk);
    // Logo: columns 24-31 (or whatever is left)
    if (w >= 32 * C) {
      drawTextCentred(ctx, 'BACK TO', 28 * C, top + 3, theme.logoInk);
      drawTextCentred(ctx, 'SKOOL', 28 * C, top + 13, theme.logoInk2);
    }
  }

  drawFurniture(viewFrom, viewTo) {
    const { ctx, game, theme } = this;
    const rect = (x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); };
    // Doors
    for (const door of game.world.doors.values()) {
      if (door.id === 'DrinksCabinet') continue;
      const [cx, cy] = door.coords; const [w, h] = door.size;
      const x = cx * C, y = cy * C;
      if (door.id === 'SkoolGate') {
        // iron gate: bars when shut, swung open (thin) when open
        if (door.shut) { for (let i = 0; i < w * C; i += 4) rect(x + 4 + i, y, 2, h * C + 4, theme.gate); rect(x + 4, y + 2, w * C, 2, theme.gate); rect(x + 4, y + h * C - 4, w * C, 2, theme.gate); }
        else { rect(x + 2, y, 3, h * C + 4, theme.gate); }
        continue;
      }
      if (door.shut) {
        rect(x + 1, y, w * C - 2, h * C + 4, theme.door);
        rect(x + 3, y + 3, w * C - 6, h * C - 10, theme.doorDark);
        rect(x + w * C - 7, y + (h * C) / 2, 2, 2, '#e0c060');   // handle
      } else {
        rect(x + 1, y, 3, h * C + 4, theme.doorOpen);             // door edge seen side-on
      }
    }
    // Windows
    for (const win of game.world.windows.values()) {
      const [cx, cy] = win.coords; const [w, h] = win.size;
      const x = cx * C, y = cy * C;
      rect(x, y, w * C, h * C, theme.windowFrame);
      if (win.shut) { rect(x + 2, y + 2, w * C - 4, h * C - 4, theme.windowGlass); rect(x + w * C / 2 - 1, y, 2, h * C, theme.windowFrame); rect(x, y + h * C / 2 - 1, w * C, 2, theme.windowFrame); }
      else { rect(x + 2, y + 2, w * C - 4, h * C - 4, theme.sky[1]); rect(x + 2, y + 2, 3, h * C - 4, theme.windowGlass); }
    }
    // Drinks cabinet
    const cabinet = game.world.doors.get('DrinksCabinet');
    if (cabinet) {
      const x = cabinet.coords[0] * C, y = cabinet.coords[1] * C;
      rect(x - 2, y - 2, 20, 18, theme.deskDark);
      if (cabinet.shut) { rect(x, y, 16, 14, theme.desk); rect(x + 7, y, 2, 14, theme.deskDark); }
      else { rect(x, y, 16, 14, '#2a1a0a'); rect(x + 4, y + 3, 3, 9, '#b5651d'); rect(x + 10, y + 5, 3, 7, '#d4a24c'); }
    }
    // The safe
    const s = game.world.safe;
    rect(s.x * C - 2, s.y * C - 4, 20, 14, theme.safe);
    rect(s.x * C + 2, s.y * C - 1, 12, 8, '#3a3a44'); rect(s.x * C + 6, s.y * C + 2, 3, 3, '#c0c0c0');
    // Cups
    for (const cup of game.world.cups.values()) {
      const x = cup.x * C, y = cup.y * C;
      rect(x + 1, y + 2, 7, 5, theme.cup); rect(x + 8, y + 3, 1, 3, theme.cup);
      if (cup.contents === 'WATER') rect(x + 2, y + 1, 5, 2, theme.cupWater);
      else if (cup.contents === 'SHERRY') rect(x + 2, y + 1, 5, 2, theme.cupSherry);
      else if (cup.frogs.length) rect(x + 2, y, 5, 3, '#3e9b3e');
    }
    // Chalk on blackboards
    for (const room of game.world.rooms.values()) {
      const b = room.blackboard;
      if (!b || !b.lines.length) continue;
      const x = b.x * C, y = b.y * C;
      b.lines.forEach((line, i) => drawText(ctx, line, x + 2, y + 2 + i * LINE_HEIGHT, theme.chalk));
      // partially wiped columns
      for (const col of b.wipedColumns) rect(x + col * C, y, C, b.height * C, theme.blackboard);
    }
    // Conker in the tree (when not falling)
    if (!game.cast.conker.visible) { rect(100 * C + 6, 3 * C + 2, 4, 4, '#6b3a1a'); rect(100 * C + 7, 3 * C + 2, 1, 1, '#d2a06a'); }
    // Chained bike leaning on the tree
    if (game.cast.bike.chained) { rect(97 * C, 20 * C - 2, 16, 4, '#444'); rect(97 * C + 2, 20 * C - 1, 12, 2, '#9a9a9a'); rect(96 * C + 4, 18 * C + 2, 2, 12, '#888'); }
  }

  drawBubble(c) {
    const { ctx, theme } = this;
    const b = c.bubble;
    const x = b.x * C, y = b.y * C;
    const w = 8 * C, h = 3 * C;
    const r = (xx, yy, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(xx, yy, ww, hh); };
    r(x + 1, y, w - 2, h - 4, theme.bubbleFill); r(x, y + 1, w, h - 6, theme.bubbleFill);
    // lip
    const lipX = x + b.lipPos * C + 2;
    r(lipX, y + h - 4, 4, 2, theme.bubbleFill); r(lipX + 1, y + h - 2, 2, 2, theme.bubbleFill);
    // scrolling text window: 11 chars visible, moving left one char per step
    const visible = 11;
    const start = b.shift;
    let text = '';
    for (let i = 0; i < visible; i++) { const idx = start + i; text += idx >= 0 && idx < b.words.length ? b.words[idx] : ' '; }
    ctx.save(); ctx.beginPath(); ctx.rect(x + 3, y + 2, w - 6, h - 8); ctx.clip();
    drawText(ctx, text, x + 4, y + (h - 8) / 2 - 3 + 2, theme.bubbleInk);
    ctx.restore();
  }

  drawMessageBox(box, cam) {
    const { ctx, theme } = this;
    const lines = box.lines;
    const w = Math.max(8 * C, ...lines.map((l) => measureText(l) + 8));
    const h = lines.length * LINE_HEIGHT + 6;
    let x = box.x * C - cam + 4 - w / 2;
    let y = box.y * C - h - 2;
    x = Math.max(0, Math.min(this.canvas.width - w, x));
    y = Math.max(0, y);
    const paper = box.paper === 'eric' ? theme.boxEric : box.paper === 'other' ? theme.boxOther : box.paper === 'alarm' ? theme.boxAlarm : theme.boxSecret;
    const ink = box.paper === 'alarm' ? theme.boxInkAlarm : theme.boxInk;
    ctx.fillStyle = paper; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(x), Math.round(y), w, 1);
    lines.forEach((l, i) => drawTextCentred(ctx, l, Math.round(x + w / 2), Math.round(y + 3 + i * LINE_HEIGHT), ink));
  }
}

// Small 8x8 pictures for the pockets row of the retro status bar.
function drawIcon(ctx, item, x, y, theme) {
  const p = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + dx, y + dy, w, h); };
  switch (item) {
    case 'SAFE_KEY': p(0, 3, 5, 2, '#f5d300'); p(4, 2, 3, 4, '#f5d300'); p(1, 5, 1, 2, '#f5d300'); p(3, 5, 1, 1, '#f5d300'); break;
    case 'STOREROOM_KEY': p(0, 3, 5, 2, theme.statusInk); p(4, 2, 3, 4, theme.statusInk); p(1, 5, 1, 2, theme.statusInk); break;
    case 'FROG': p(1, 3, 6, 4, '#00d700'); p(1, 2, 2, 1, '#00d700'); p(5, 2, 2, 1, '#00d700'); p(0, 7, 2, 1, '#00d700'); p(6, 7, 2, 1, '#00d700'); break;
    case 'WATER_PISTOL': p(0, 2, 7, 2, '#00d7d7'); p(1, 4, 2, 3, '#00d7d7'); break;
    case 'SHERRY_PISTOL': p(0, 2, 7, 2, '#d70000'); p(1, 4, 2, 3, '#d70000'); break;
    case 'STINKBOMBS3': p(0, 4, 2, 3, theme.statusInk); p(3, 4, 2, 3, theme.statusInk); p(6, 4, 2, 3, theme.statusInk); break;
    case 'STINKBOMBS2': p(0, 4, 2, 3, theme.statusInk); p(3, 4, 2, 3, theme.statusInk); break;
    case 'STINKBOMBS1': p(0, 4, 2, 3, theme.statusInk); break;
    default: break;
  }
}
