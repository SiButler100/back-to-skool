// ============================================================================
// PIXEL ART IN CODE (the HD modern view's picture format)
// ----------------------------------------------------------------------------
// Every picture in the HD view is text: rows of characters, one character per
// screen pixel. That keeps the artwork in the repository, readable, and easy
// to tweak in any editor. No image files are involved.
//
// The alphabet
//   '.'      transparent
//   A-Z      fixed colours from PALETTE below (K = ink/outline, S = skin, ...)
//   a-z      "slots": colours chosen per character when the picture is drawn
//            (t top/shirt, u its shade, p bottoms, q its shade, h hair,
//             i hair shade, k socks, o shoes, e accent such as a tie)
//
// A LAYER is one such bitmap plus where it sits inside a sprite frame. A
// sprite (48 x 64 pixels, i.e. 3 x 4 cells at twice the Spectrum's size) is
// composed from several layers: legs, torso, arms, head, hat... Composing from
// parts means a new pose is a short list, and a new character is just colours.
//
// Everything is drawn facing RIGHT; a left-facing sprite is the whole frame
// flipped, exactly as the original game did.
// ============================================================================

export const SCALE = 2;               // HD pixels per Spectrum pixel
export const FRAME_W = 24 * SCALE;    // 48
export const FRAME_H = 32 * SCALE;    // 64

// Fixed colours. Keep this list short: most colour comes from the slots.
export const PALETTE = {
  K: '#1b1626',   // ink / outlines / eyes
  S: '#f3c9a4',   // skin
  T: '#d9a07a',   // skin shade
  W: '#ffffff',   // white
  V: '#efe9dc',   // off-white
  G: '#9a9aa6',   // grey
  D: '#4a4a58',   // dark grey
  Y: '#e8c14a',   // brass / yellow
  R: '#d8322a',   // red
  B: '#2f6fd6',   // blue
  N: '#8a5a2a',   // wood brown
  M: '#b8bcc8',   // metal
  L: '#ffe9c7',   // highlight
  A: '#3fa33f',   // leaf green
  Z: '#1f6b2f',   // dark green
  P: '#ff6b9d',   // pink (flowers, hearts)
  C: '#4aa3ff',   // water
  O: '#b5651d',   // sherry / conker
  X: '#f5d300',   // gold (stars, keys)
};

export const SLOT_LETTERS = 'tupqhikoe';

// Turn a template string into trimmed rows; blank lines at the ends are dropped
// and indentation is removed, so pictures can be written inside code neatly.
export function rows(art) {
  const lines = art.split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent));
}

// A layer: a bitmap placed at (x, y) inside the frame.
export function layer(x, y, art, name = '') {
  const r = Array.isArray(art) ? art : rows(art);
  const w = r[0] ? r[0].length : 0;
  for (const line of r) {
    if (line.length !== w) throw new Error(`Pixel art ${name || ''}: rows must be the same length (${line.length} vs ${w})`);
    for (const ch of line) if (!(ch === '.' || PALETTE[ch] || SLOT_LETTERS.includes(ch))) throw new Error(`Pixel art ${name || ''}: unknown character "${ch}"`);
  }
  return { x, y, rows: r, w, h: r.length, name };
}

// A little drawing board for pictures that are easier to describe as shapes
// (legs that slant, sleeves, planks) than to type pixel by pixel.
export class Grid {
  constructor(w, h) { this.w = w; this.h = h; this.cells = Array.from({ length: h }, () => Array(w).fill('.')); }
  set(x, y, ch) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y][x] = ch; return this; }
  rect(x, y, w, h, ch) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch); return this; }
  hline(x, y, w, ch) { return this.rect(x, y, w, 1, ch); }
  vline(x, y, h, ch) { return this.rect(x, y, 1, h, ch); }
  // Paste another set of rows at (x, y), skipping transparent pixels.
  paste(x, y, r) { r.forEach((line, dy) => { for (let dx = 0; dx < line.length; dx++) if (line[dx] !== '.') this.set(x + dx, y + dy, line[dx]); }); return this; }
  rows() { return this.cells.map((row) => row.join('')); }
}

// ---- Rasterising ---------------------------------------------------------------

const rgbaCache = new Map();
function rgba(hex) {
  if (rgbaCache.has(hex)) return rgbaCache.get(hex);
  let out;
  if (hex.startsWith('#')) {
    const h = hex.length === 4 ? hex.slice(1).split('').map((c) => c + c).join('') : hex.slice(1);
    out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255];
  } else {
    const m = hex.match(/rgba?\(([^)]+)\)/);
    const p = m ? m[1].split(',').map(Number) : [0, 0, 0, 1];
    out = [p[0], p[1], p[2], Math.round((p[3] ?? 1) * 255)];
  }
  rgbaCache.set(hex, out);
  return out;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Paint layers into a fresh frame. `colours` maps slot letters to colours.
// Each entry of `layers` is a layer or [layer, dx, dy] (an extra offset).
export function compose(layers, colours, w = FRAME_W, h = FRAME_H) {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (const entry of layers) {
    if (!entry) continue;
    const [lay, dx = 0, dy = 0] = Array.isArray(entry) ? entry : [entry];
    const ox = lay.x + dx, oy = lay.y + dy;
    for (let yy = 0; yy < lay.h; yy++) {
      const py = oy + yy;
      if (py < 0 || py >= h) continue;
      const line = lay.rows[yy];
      for (let xx = 0; xx < lay.w; xx++) {
        const ch = line[xx];
        if (ch === '.') continue;
        const px = ox + xx;
        if (px < 0 || px >= w) continue;
        const colour = PALETTE[ch] || colours[ch];
        if (!colour) continue;
        const [r, g, b, a] = rgba(colour);
        const i = (py * w + px) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// A mirrored copy (for characters facing left).
export function flipped(canvas) {
  const out = makeCanvas(canvas.width, canvas.height);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width, 0); ctx.scale(-1, 1);
  ctx.drawImage(canvas, 0, 0);
  return out;
}

// Darken a hex colour (for shaded sides of clothes and hair).
export function shade(hex, factor = 0.72) {
  const [r, g, b] = rgba(hex);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
