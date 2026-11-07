// ============================================================================
// ORIGINAL GRAPHICS (the 1985 artwork, pixel for pixel)
// ----------------------------------------------------------------------------
// The "original" view draws with the ZX Spectrum game's own graphics, lifted
// from the game's memory map (see assets/original/ and tools/pack-original-
// assets.mjs). This module knows where everything is on those sheets:
//
//   skool.png      the whole school backdrop, 1536 x 168
//   sprites.png    128 character/object pictures, 16 per row, 24 x 32 each,
//                  all facing LEFT (we flip them to face right)
//   mutables.png   doors, windows, cups and the bike, which change during play
//   font.png       the proportional game font, 8 px tall
//   bubble.png, message_box.png, lesson_box.png, scorebox.png, logo.png,
//   inventory.png  the status-area furniture
//
// Images decode asynchronously; `ready` turns true when all are usable. Until
// then the renderer falls back to the painted graphics.
// ============================================================================

import { ORIGINAL_ASSETS } from './original-assets.js';
import { SKOOL } from '../data/skool.js';

const C = 8;

// Sprite sheet index for every character state (from the game's own tables).
const WALK = (b) => ({ WALK0: b, WALK1: b + 1, WALK2: b + 2, WALK3: b + 3 });
const KID = (b) => ({ ...WALK(b), SITTING_ON_CHAIR: b + 4, SITTING_ON_FLOOR: b + 5, KNOCKED_OUT: b + 6 });
const ADULT = (b) => ({ ...WALK(b), KNOCKED_OVER: b + 6, ARM_UP: b + 7 });
export const SPRITE_INDEX = {
  ERIC: { ...KID(0), ARM_UP: 7, HITTING0: 8, HITTING1: 9, CATAPULT0: 10, CATAPULT1: 11, RIDING_BIKE0: 12, RIDING_BIKE1: 13, WATERPISTOL: 14, BENDING_OVER: 39 },
  TEARAWAY: { ...KID(16), ARM_UP: 23, CATAPULT0: 26, CATAPULT1: 27 },
  BULLY: { ...KID(32), HITTING0: 40, HITTING1: 41 },
  SWOT: KID(48),
  HEROINE: { ...KID(56), ARM_UP: 63, KISSING_ERIC: 15 },
  BOY: KID(64),
  GIRL: KID(72),
  WACKER: ADULT(80), WITHIT: ADULT(88), ROCKITT: ADULT(96), CREAK: ADULT(104), TAKE: ADULT(112), ALBERT: ADULT(120),
  OBJ: {
    FLY: 79, RUN: 47, SIT: 28, HOP1: 29, HOP2: 30,
    WATER0: 84, WATER1: 92, WATER2: 108, WATER3: 116, WATER4: 124,
    STINKBOMB: 71, DESK_EMPTY: 44, DESK_STINKBOMBS: 45, DESK_WATER_PISTOL: 46,
    BIKE_ON_FLOOR: 24, BIKE_UPRIGHT: 25, PLANT_GROWING: 42, PLANT_GROWN: 43,
    WATER_DROP: 31, SHERRY_DROP: 31, CONKER: 55,
  },
};

// Where each changeable thing lives on mutables.png, in cells. Open/water/
// sherry/chained variants sit immediately to the right of the first image.
const MUTABLES = {
  StudyBackDoor: { at: [0, 0], size: [3, 5], coords: [71, 2] },
  StudyDoor: { at: [6, 0], size: [3, 5], coords: [84, 2] },
  ScienceLabDoor: { at: [12, 0], size: [3, 5], coords: [54, 9] },
  SkoolDoor: { at: [0, 5], size: [3, 5], coords: [93, 16] },
  SkoolGate: { at: [6, 5], size: [4, 4], coords: [132, 17] },
  DrinksCabinet: { at: [14, 5], size: [2, 2], coords: [190, 2] },
  UpperWindow: { at: [0, 10], size: [3, 3], coords: [92, 2] },
  MiddleWindow: { at: [6, 10], size: [2, 4], coords: [94, 8] },
  LeftCup: { at: [14, 7], size: [1, 1], coords: [25, 14] },
  MiddleCup: { at: [14, 8], size: [1, 1], coords: [27, 14] },
  RightCup: { at: [14, 7], size: [1, 1], coords: [30, 14] },
  GirlsCup: { at: [14, 9], size: [1, 1], coords: [186, 14] },
  Bike: { at: [10, 10], size: [3, 3], coords: [100, 18] },
};

// Inventory icons on inventory.png: [cell, width in cells].
const INVENTORY = { SAFE_KEY: [0, 1], STOREROOM_KEY: [1, 1], FROG: [2, 1], WATER_PISTOL: [3, 2], SHERRY_PISTOL: [5, 2], STINKBOMBS3: [7, 1], STINKBOMBS2: [8, 1], STINKBOMBS1: [9, 1], MOUSE: [10, 1] };
const INVENTORY_ORDER = ['SAFE_KEY', 'STOREROOM_KEY', 'FROG', 'WATER_PISTOL', 'SHERRY_PISTOL', 'STINKBOMBS3', 'STINKBOMBS2', 'STINKBOMBS1'];

// The proportional font: character -> [x offset in font.png, width].
const FONT_SPEC = ' ,0,4|!,4,2|",6,4|#,10,6|$,16,6|%,22,4|&,26,6|\',32,3|(,35,3|),38,3|*,41,6|+,47,6|,,53,3|-,56,5|.,61,3|/,64,4|0,68,5|1,73,4|2,77,5|3,82,5|4,87,5|5,92,5|6,97,5|7,102,5|8,107,5|9,112,5|:,117,3|;,120,3|<,123,5|=,128,5|>,133,5|?,138,5|@,143,6|A,149,5|B,154,5|C,159,5|D,164,5|E,169,5|F,174,5|G,179,5|H,184,5|I,189,4|J,193,5|K,198,5|L,203,5|M,208,6|N,214,5|O,219,5|P,224,5|Q,229,6|R,235,5|S,240,5|T,245,6|U,251,5|V,256,6|W,262,6|X,268,6|Y,274,6|Z,280,6|[,286,3|\\,289,4|],293,3|^,296,6|_,302,6|`,308,5|a,313,5|b,318,5|c,323,5|d,328,5|e,333,5|f,338,5|g,343,5|h,348,5|i,353,2|j,355,4|k,359,5|l,364,2|m,366,6|n,372,5|o,377,5|p,382,5|q,387,5|r,392,5|s,397,5|t,402,4|u,406,5|v,411,4|w,415,6|x,421,6|y,427,5|z,432,5|{,437,4|~,447,5';
export const FONT = {};
for (const entry of FONT_SPEC.split('|')) {
  const ch = entry[0];
  const [off, w] = entry.slice(2).split(',').map(Number);
  FONT[ch] = [off, w];
}
FONT['|'] = [441, 2]; FONT['}'] = [443, 4];

export function originalFontHas(ch) { return ch in FONT; }
export function originalMeasure(text) { let w = 0; for (const ch of text) w += (FONT[ch] || FONT['?'])[1]; return w; }

// Colours the original used for text and boxes.
const INK = { bubble: '#000000', box: '#cdc6cd', lesson: '#ffffff', chalk: '#ffffff', score: '#cdc6cd' };
const PAPER = { eric: '#c50000', other: '#00c600', secret: '#000000', alarm: '#c5c600', lesson: '#ff0000', score: '#c500c5' };

export class OriginalPainter {
  constructor() {
    this.ready = false;
    this.images = {};
    this.spriteCache = new Map();
    this.fontCache = new Map();
    this.load();
  }

  load() {
    const names = Object.keys(ORIGINAL_ASSETS);
    let remaining = names.length;
    for (const name of names) {
      const img = new Image();
      img.onload = () => {
        this.images[name] = this.prepare(name, img);
        if (--remaining === 0) this.ready = true;
      };
      img.src = ORIGINAL_ASSETS[name];
    }
  }

  // Convert an image to a canvas and knock out its transparency key colour.
  prepare(name, img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const key = { sprites: [0, 254, 0], bubble: [0, 254, 0], inventory: [0, 0, 0], font: [255, 254, 253] }[name];
    if (key) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] === key[0] && px[i + 1] === key[1] && px[i + 2] === key[2]) px[i + 3] = 0;
        else if (name === 'font') { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }   // ink becomes white, tinted later
      }
      ctx.putImageData(data, 0, 0);
    }
    return canvas;
  }

  // ---- Sprites ---------------------------------------------------------------
  sprite(group, state, direction) {
    const index = (SPRITE_INDEX[group] || {})[state];
    if (index === undefined) return null;
    const key = `${index}|${direction}`;
    if (this.spriteCache.has(key)) return this.spriteCache.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 24; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (direction > 0) { ctx.translate(24, 0); ctx.scale(-1, 1); }
    ctx.drawImage(this.images.sprites, (index % 16) * 24, Math.floor(index / 16) * 32, 24, 32, 0, 0, 24, 32);
    this.spriteCache.set(key, canvas);
    return canvas;
  }

  // ---- Text ------------------------------------------------------------------
  fontIn(colour) {
    if (this.fontCache.has(colour)) return this.fontCache.get(colour);
    const src = this.images.font;
    const canvas = document.createElement('canvas');
    canvas.width = src.width; canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = colour; ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.fontCache.set(colour, canvas);
    return canvas;
  }
  drawText(ctx, text, x, y, colour) {
    const sheet = this.fontIn(colour);
    let cx = x;
    for (const ch of text) {
      const [off, w] = FONT[ch] || FONT['?'];
      ctx.drawImage(sheet, off, 0, w, 8, cx, y, w, 8);
      cx += w;
    }
    return cx - x;
  }
  drawTextCentred(ctx, text, cx, y, colour) { return this.drawText(ctx, text, Math.round(cx - originalMeasure(text) / 2), y, colour); }

  // ---- The school ------------------------------------------------------------
  drawBackdrop(ctx, cam, width) {
    ctx.drawImage(this.images.skool, cam, 0, width, 168, cam, 0, width, 168);
  }

  drawMutable(ctx, id, variant) {
    const m = MUTABLES[id];
    if (!m) return;
    const [ax, ay] = m.at, [w, h] = m.size, [cx, cy] = m.coords;
    ctx.drawImage(this.images.mutables, (ax + variant * w) * C, ay * C, w * C, h * C, cx * C, cy * C, w * C, h * C);
  }

  drawFurniture(ctx, game) {
    for (const door of game.world.doors.values()) if (MUTABLES[door.id]) this.drawMutable(ctx, door.id, door.shut ? 0 : 1);
    for (const win of game.world.windows.values()) this.drawMutable(ctx, win.id, win.shut ? 0 : 1);
    for (const cup of game.world.cups.values()) this.drawMutable(ctx, cup.id, cup.contents === 'WATER' ? 1 : cup.contents === 'SHERRY' ? 2 : 0);
    this.drawMutable(ctx, 'Bike', game.cast.bike.chained ? 1 : 0);
    // Chalk on blackboards
    for (const room of game.world.rooms.values()) {
      const b = room.blackboard;
      if (!b || !b.lines.length) continue;
      const x = b.x * C, y = b.y * C;
      b.lines.forEach((line, i) => this.drawText(ctx, line, x, y + i * 8, INK.chalk));
      for (const col of b.wipedColumns) ctx.drawImage(this.images.skool, x + col * C, y, C, b.height * C, x + col * C, y, C, b.height * C);
    }
  }

  // ---- Speech bubble (text scrolls in 8-pixel steps, as the original) ---------
  drawBubble(ctx, c) {
    const b = c.bubble;
    const x = b.x * C, y = b.y * C;
    const img = this.images.bubble;
    ctx.drawImage(img, 0, 0, 64, 16, x, y, 64, 16);
    const lipX = Math.min(b.lipPos, 7) * C;
    ctx.drawImage(img, 64, 0, 8, 8, x + lipX, y + 16, 8, 8);
    ctx.drawImage(img, 64, 0, 8, 1, x + lipX, y + 15, 8, 1);   // open the lip
    const textWidth = originalMeasure(b.words);
    const insetX = 4 - 8 * Math.min(0, b.shift);
    const textX = Math.max(0, b.shift) * 8;
    const width = Math.min(4 + 56 - insetX, textWidth - textX);
    if (width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + insetX, y + 4, width, 8); ctx.clip();
      this.drawText(ctx, b.words, x + insetX - textX, y + 4, INK.bubble);
      ctx.restore();
    }
  }

  // ---- Message box (lines, secrets, alarms) ----------------------------------
  drawMessageBox(ctx, box, cam, screenW) {
    const w = 64, h = 24;
    let x = box.x * C - cam + 4 - w / 2;
    let y = box.y * C - h;
    x = Math.max(0, Math.min(screenW - w, x)); y = Math.max(0, y);
    ctx.fillStyle = PAPER[box.paper] || PAPER.secret;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
    const ink = box.paper === 'alarm' ? PAPER.eric : INK.box;
    const top = y + (h - 8 * box.lines.length) / 2;
    box.lines.forEach((l, i) => this.drawTextCentred(ctx, l, Math.round(x + w / 2), Math.round(top + i * 8), ink));
  }

  // ---- The bottom three rows -------------------------------------------------
  drawStatus(ctx, game, screenW) {
    const top = 21 * C;
    ctx.fillStyle = '#000000'; ctx.fillRect(0, top, screenW, 3 * C);
    // Score box at (0,21): magenta, numbers right-aligned on rows 1, 9, 17.
    ctx.fillStyle = PAPER.score; ctx.fillRect(0, top, 64, 24);
    const rows = [['Score', game.score, 1], ['Lines', game.lines, 9], ['Hi-Sc', game.hiScore, 17]];
    for (const [label, value, dy] of rows) {
      this.drawText(ctx, label, 1, top + dy, INK.score);
      const s = String(value);
      this.drawText(ctx, s, 64 - 1 - originalMeasure(s), top + dy, INK.score);
    }
    // Mice at (8,21), pockets at (10,23)
    const eric = game.cast.eric;
    if (eric.mice > 0) {
      const [cell] = INVENTORY.MOUSE;
      if (eric.mice > 8) { ctx.drawImage(this.images.inventory, cell * C, 0, 8, 8, 64, top, 8, 8); this.drawText(ctx, `x${eric.mice}`, 72, top, INK.score); }
      else for (let i = 0; i < eric.mice; i++) ctx.drawImage(this.images.inventory, cell * C, 0, 8, 8, 64 + i * 8, top, 8, 8);
    }
    let ix = 80;
    for (const item of INVENTORY_ORDER) {
      if (!eric.inventory.has(item)) continue;
      const [cell, w] = INVENTORY[item];
      ctx.drawImage(this.images.inventory, cell * C, 0, w * C, 8, ix, top + 16, w * C, 8);
      ix += w * C;
    }
    // Lesson box at (16,21): red with two centred white lines
    ctx.fillStyle = PAPER.lesson; ctx.fillRect(128, top, 64, 24);
    const { teacher, room } = game.lessonDescription();
    this.drawTextCentred(ctx, teacher, 160, top + 4, INK.lesson);
    this.drawTextCentred(ctx, room, 160, top + 12, INK.lesson);
    // Logo at (24,21)
    if (screenW >= 256) ctx.drawImage(this.images.logo, 192, top);
  }
}
