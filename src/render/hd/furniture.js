// ============================================================================
// FURNITURE (HD pixel art for the parts of the school that change)
// ----------------------------------------------------------------------------
// Doors, the gate, windows, the drinks cabinet, the safe, the cups, the conker
// in its tree and the chained bike are drawn every frame because they open,
// fill or disappear during play. Each has a picture per state here; the
// painter stamps them at the positions the engine gives (data/skool.js).
// Chalk on the blackboards is text, drawn with the font.
// ============================================================================

import { layer, Grid, compose } from './pixelart.js';
import { BIKE } from './objects.js';

const C = 16;   // an HD cell

// A panelled wooden door, `w` x `h` cells (plus the sill), shut or open.
function door(wCells, hCells, shut) {
  const w = wCells * C, h = hCells * C + 8;
  const g = new Grid(w, h);
  if (shut) {
    g.rect(1, 0, w - 2, h, 'N').rect(1, 0, w - 2, 1, 'I').vline(1, 0, h, 'I').vline(w - 2, 0, h, 'J').rect(1, h - 1, w - 2, 1, 'J');
    const panel = (x, y, pw, ph) => { g.rect(x, y, pw, ph, 'J'); g.rect(x + 2, y + 2, pw - 4, ph - 4, 'N'); g.hline(x + 2, y + 2, pw - 4, 'I'); g.vline(x + 2, y + 2, ph - 4, 'I'); };
    panel(6, 6, w - 12, Math.floor(h * 0.38));
    panel(6, Math.floor(h * 0.52), w - 12, Math.floor(h * 0.4));
    g.rect(w - 12, Math.floor(h / 2) - 1, 4, 3, 'Y'); g.set(w - 12, Math.floor(h / 2) - 1, 'X');   // handle
  } else {
    g.rect(2, 0, 6, h, 'J').vline(2, 0, h, 'K').vline(7, 0, h, 'N');     // the door's edge, seen side-on
  }
  return layer(0, 0, g.rows(), `door ${shut ? 'shut' : 'open'}`);
}

// The iron gate: bars when shut, a single post when open.
function gate(shut) {
  const w = 4 * C, h = 4 * C + 8;
  const g = new Grid(w, h);
  if (shut) {
    for (let x = 8; x < w; x += 8) { g.rect(x, 0, 3, h, 'E'); g.vline(x + 2, 0, h, 'D'); g.rect(x, 0, 3, 2, 'K'); }
    g.rect(6, 4, w - 6, 3, 'E').rect(6, h - 10, w - 6, 3, 'E').rect(6, Math.floor(h / 2), w - 6, 2, 'E');
    g.rect(6, 4, w - 6, 1, 'D').rect(6, h - 10, w - 6, 1, 'D');
  } else {
    g.rect(4, 0, 6, h, 'E').vline(4, 0, h, 'K').vline(9, 0, h, 'D');
  }
  return layer(0, 0, g.rows(), `gate ${shut ? 'shut' : 'open'}`);
}

// A window `w` x `h` cells: panes when shut, the sky when open.
function windowArt(wCells, hCells, shut) {
  const w = wCells * C, h = hCells * C;
  const g = new Grid(w, h);
  g.rect(0, 0, w, h, 'W').rect(1, 1, w - 2, h - 2, 'V');
  g.rect(3, 3, w - 6, h - 6, shut ? 'U' : 'H');
  if (shut) {
    g.rect(Math.floor(w / 2) - 1, 2, 3, h - 4, 'W'); g.rect(2, Math.floor(h / 2) - 1, w - 4, 3, 'W');
    g.rect(4, 4, 3, Math.floor(h / 2) - 7, 'L'); g.rect(4, 4, Math.floor(w / 2) - 7, 2, 'L');          // a glint
  } else {
    g.rect(3, 3, 6, h - 6, 'U'); g.vline(8, 3, h - 6, 'W');                                            // the open casement, side-on
  }
  return layer(0, 0, g.rows(), `window ${shut ? 'shut' : 'open'}`);
}

// Miss Take's drinks cabinet (two cells wide, two tall).
function cabinet(shut) {
  const g = new Grid(40, 36);
  g.rect(0, 0, 40, 36, 'J').rect(2, 2, 36, 32, 'N').rect(2, 2, 36, 1, 'I').vline(2, 2, 32, 'I');
  if (shut) {
    g.rect(4, 4, 15, 28, 'I').rect(21, 4, 15, 28, 'I').rect(5, 5, 13, 26, 'N').rect(22, 5, 13, 26, 'N');
    g.rect(16, 16, 2, 4, 'Y').rect(22, 16, 2, 4, 'Y');
  } else {
    g.rect(4, 4, 32, 28, 'K').rect(4, 18, 32, 2, 'J');
    g.rect(9, 8, 6, 10, 'O').rect(10, 5, 4, 3, 'O').set(10, 9, 'L');            // bottles
    g.rect(19, 10, 6, 8, 'Y').rect(20, 6, 4, 4, 'Y').set(20, 11, 'L');
    g.rect(27, 22, 6, 8, 'O').rect(28, 20, 4, 2, 'O');
    g.rect(9, 24, 10, 6, 'M').rect(11, 22, 6, 2, 'M');                          // glasses
  }
  return layer(0, 0, g.rows(), `cabinet ${shut ? 'shut' : 'open'}`);
}

const SAFE = layer(0, 0, new Grid(40, 28)
  .rect(0, 0, 40, 28, 'D').rect(2, 2, 36, 24, 'G').rect(4, 4, 32, 20, 'D')
  .rect(12, 8, 12, 12, 'G').rect(14, 10, 8, 8, 'M').rect(17, 11, 2, 6, 'D').rect(15, 13, 6, 2, 'D')
  .rect(28, 10, 4, 8, 'Y').rect(28, 10, 4, 1, 'X')
  .rows(), 'safe');

// A cup on its hook, with whatever is in it.
function cup(contents) {
  const g = new Grid(20, 16);
  g.rect(2, 4, 14, 10, 'V').rect(2, 13, 14, 1, 'G').vline(2, 4, 10, 'W').rect(16, 6, 3, 6, 'V').rect(17, 7, 1, 4, '.');
  g.rect(8, 0, 4, 4, 'M').rect(9, 0, 2, 2, 'G');                                  // hook
  if (contents === 'WATER') g.rect(3, 3, 12, 3, 'C');
  else if (contents === 'SHERRY') g.rect(3, 3, 12, 3, 'O');
  else if (contents === 'FROG') { g.rect(3, 0, 12, 5, 'A'); g.rect(5, 0, 3, 2, 'A'); g.rect(10, 0, 3, 2, 'A'); g.set(6, 0, 'K'); g.set(11, 0, 'K'); }
  return layer(0, 0, g.rows(), `cup ${contents}`);
}

const CONKER_IN_TREE = layer(0, 0, `
  ..OOO..
  .OLOOO.
  .OOOOO.
  .OOOOJ.
  ..JJJ..
`, 'conker in tree');

const CHAIN = layer(0, 0, new Grid(14, 28).rect(0, 0, 14, 28, '.').rect(6, 0, 2, 28, 'M').rect(4, 4, 6, 2, 'D').rect(4, 12, 6, 2, 'D').rect(4, 20, 6, 2, 'D').rows(), 'chain');

// ---- Drawing ---------------------------------------------------------------------

const cache = new Map();
function image(key, lay) {
  if (!cache.has(key)) cache.set(key, compose([[lay, -lay.x, -lay.y]], {}, lay.w, lay.h));   // the picture alone, at its own size
  return cache.get(key);
}
const DOOR_KIND = { SkoolGate: 'gate', DrinksCabinet: 'cabinet' };

// Draw every piece of live furniture. `S` is the HD scale; positions come in cells.
export function drawFurniture(ctx, game, S, drawChalk) {
  const world = game.world;
  for (const d of world.doors.values()) {
    const kind = DOOR_KIND[d.id] || 'door';
    const [cx, cy] = d.coords, [w, h] = d.size;
    if (kind === 'cabinet') { ctx.drawImage(image(`cabinet ${d.shut}`, cabinet(d.shut)), cx * 8 * S - 4, cy * 8 * S - 4); continue; }
    const lay = kind === 'gate' ? gate(d.shut) : door(w, h, d.shut);
    ctx.drawImage(image(`${kind} ${w}x${h} ${d.shut}`, lay), cx * 8 * S, cy * 8 * S);
  }
  for (const win of world.windows.values()) {
    const [cx, cy] = win.coords, [w, h] = win.size;
    ctx.drawImage(image(`window ${w}x${h} ${win.shut}`, windowArt(w, h, win.shut)), cx * 8 * S, cy * 8 * S);
  }
  const s = world.safe;
  ctx.drawImage(image('safe', SAFE), s.x * 8 * S - 4, s.y * 8 * S - 8);
  for (const c of world.cups.values()) {
    const contents = c.frogs.length ? 'FROG' : c.contents;
    ctx.drawImage(image(`cup ${contents}`, cup(contents)), c.x * 8 * S - 2, c.y * 8 * S);
  }
  if (drawChalk) drawChalk(ctx);
  if (!game.cast.conker.visible) ctx.drawImage(image('conker tree', CONKER_IN_TREE), 100 * 8 * S + 12, 3 * 8 * S + 4);
  if (game.cast.bike.chained) {
    ctx.drawImage(image('bike', BIKE), 96 * 8 * S + BIKE.x, 17 * 8 * S + BIKE.y);
    ctx.drawImage(image('chain', CHAIN), 96 * 8 * S + 10, 17 * 8 * S + 30);
  }
}

export function clearFurnitureCache() { cache.clear(); }
