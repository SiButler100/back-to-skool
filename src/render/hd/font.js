// ============================================================================
// HD FONT
// ----------------------------------------------------------------------------
// Text in the HD view: the game's 5x7 font drawn at twice the size, plus a
// proper lowercase alphabet (with descenders) in place of the small capitals.
//
// The important rule: every glyph keeps exactly the width of the 1x font, so
// measureHd(text) is always 2 * measureText(text). Blackboard wrapping and
// speech-bubble timing in the engine use the 1x measurements and therefore
// behave the same whether HD is on or off.
// ============================================================================

import { glyph, glyphWidth, measureText, LINE_HEIGHT } from '../font.js';
import { makeCanvas } from './pixelart.js';

export const HD_LINE_HEIGHT = LINE_HEIGHT * 2;   // 16

// Lowercase at 1x: up to 5 columns (the capital's width), 7 rows on the line
// and up to 2 more below it for descenders.
const LOWER = {
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##.', '.#...', '####.', '.#...', '.#...', '.#...', '.#...'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.####'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
};
// Guard: a lowercase glyph must be exactly as wide as its capital.
for (const [ch, rows] of Object.entries(LOWER)) {
  if (rows[0].length !== glyphWidth(ch)) throw new Error(`HD font: "${ch}" is ${rows[0].length} wide, its capital is ${glyphWidth(ch)}`);
}

export function hdGlyph(ch) { return LOWER[ch] || glyph(ch); }
export function measureHd(text) { return measureText(text) * 2; }

// Glyphs are rasterised once per colour and reused.
const cache = new Map();
function glyphImage(ch, colour) {
  const key = `${ch}|${colour}`;
  let img = cache.get(key);
  if (img) return img;
  const rows = hdGlyph(ch);
  img = makeCanvas(rows[0].length * 2, rows.length * 2);
  const ctx = img.getContext('2d');
  ctx.fillStyle = colour;
  rows.forEach((line, r) => { for (let c = 0; c < line.length; c++) if (line[c] === '#') ctx.fillRect(c * 2, r * 2, 2, 2); });
  cache.set(key, img);
  return img;
}

// Draw text with its top-left at (x, y) in HD pixels. Returns the width drawn.
export function drawHdText(ctx, text, x, y, colour) {
  let cx = x;
  for (const ch of text) {
    const img = glyphImage(ch, colour);
    ctx.drawImage(img, cx, y);
    cx += (glyphWidth(ch) + 1) * 2;
  }
  return cx - x - 2;
}

export function drawHdTextCentred(ctx, text, cx, y, colour) {
  return drawHdText(ctx, text, Math.round(cx - measureHd(text) / 2), y, colour);
}
