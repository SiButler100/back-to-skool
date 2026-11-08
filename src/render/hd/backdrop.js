// ============================================================================
// HD BACKDROP (the school building in pixel art, painted once)
// ----------------------------------------------------------------------------
// Paints everything that never changes onto an offscreen canvas at the HD
// scale: sky, the two buildings, the rooms (colours and decoration from
// data/decor.js), floors, interior walls, staircases, blackboard frames,
// desks and chairs (positions from data/skool.js), the playground, the tree,
// the wall and the railings. Anything that changes during play (doors, cups,
// chalk, plants...) is drawn on top every frame by the painter.
//
// Measurements: one cell is 16 pixels here. A floor's walking surface for
// people standing at row y is at (y + 4) * 16: a 64-pixel sprite's feet.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { DECOR } from '../../data/decor.js';
import { makeCanvas, shade, layer, compose } from './pixelart.js';
import { drawHdText, measureHd } from './font.js';

const FLOOR_Y = { top: 3, middle: 10, ground: 17 };
const STOREY_TOP = { top: 0, middle: 7, ground: 14 };

export function buildHdBackdrop(theme, S) {
  const C = SKOOL.cell * S;                       // 16
  const W = SKOOL.width * C, H = SKOOL.height * C;
  const hd = theme.hd;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rect = (x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const feet = (row) => (row + 4) * C;            // walking surface for a sprite row

  // ---- Sky, distant rooftops and ground ------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, hd.sky[0]); sky.addColorStop(1, hd.sky[1]);
  rect(0, 0, W, H, sky);
  for (let x = 0; x < W; x += 180) { rect(x + 20, 190 + ((x / 180) % 3) * 10, 70, 60, hd.skyline); rect(x + 110, 210 + ((x / 180) % 2) * 14, 50, 50, hd.skyline); }
  rect(0, feet(17) + 4, W, H - feet(17) - 4, hd.ground);
  rect(0, feet(17), W, 4, hd.groundEdge);

  // ---- Buildings: brick shells, then the rooms -----------------------------
  for (const b of DECOR.buildings) paintShell(ctx, hd, b, C, W, H);
  for (const z of DECOR.zones) paintZone(ctx, hd, z, C);

  // ---- Floors: boards with a shadow beneath ---------------------------------
  for (const f of SKOOL.floors) {
    if (f.id === 'Stage') continue;
    const y = feet(f.y) - 6, x0 = f.minX * C, x1 = (f.maxX + 3) * C;
    rect(x0, y, x1 - x0, 8, hd.floorboard);
    rect(x0, y, x1 - x0, 2, hd.floorboardLight);
    rect(x0, y + 6, x1 - x0, 2, hd.floorboardDark);
    for (let x = x0 + 24; x < x1; x += 48) rect(x, y + 2, 2, 4, hd.floorboardDark);
    if (f.y < 17) { const g = ctx.createLinearGradient(0, y + 8, 0, y + 22); g.addColorStop(0, hd.floorShadow); g.addColorStop(1, 'rgba(0,0,0,0)'); rect(x0, y + 8, x1 - x0, 14, g); }
  }

  // ---- Interior walls and door frames ------------------------------------------
  for (const w of SKOOL.walls) {
    if (w.x === 0 || w.x === 191) continue;
    rect(w.x * C + 4, w.topY * C, 8, (w.bottomY - w.topY + 1) * C, hd.wall);
    rect(w.x * C + 4, w.topY * C, 2, (w.bottomY - w.topY + 1) * C, hd.wallLight);
  }
  for (const d of SKOOL.doors) {
    if (d.id === 'DrinksCabinet') continue;
    const [cx, cy] = d.coords, [w, h] = d.size;
    const x = cx * C - 4, y = cy * C - 4, ww = w * C + 8, hh = h * C + 12;
    rect(x, y, ww, hh, hd.doorFrame); rect(x + 2, y + 2, ww - 4, hh - 2, hd.doorway);
  }
  // Outer walls where the buildings meet the open air
  rect(95 * C + 8, 0, 8, feet(17) + 4, hd.brick.boysDark);
  rect(159 * C, 0, 8, feet(17) + 4, hd.brick.girlsDark);

  // ---- Staircases --------------------------------------------------------------
  for (const s of SKOOL.staircases) paintStaircase(ctx, hd, s, C);

  // ---- Blackboards, desks and chairs ------------------------------------------------
  for (const b of SKOOL.blackboards) {
    const x = b.topLeft[0] * C, y = b.topLeft[1] * C, w = b.size[0] * C, h = b.size[1] * C;
    rect(x - 6, y - 6, w + 12, h + 12, hd.boardFrame); rect(x - 6, y - 6, w + 12, 2, hd.boardFrameLight); rect(x - 6, y - 6, 2, h + 12, hd.boardFrameLight);
    rect(x, y, w, h, theme.blackboard);
    rect(x - 6, y + h + 6, w + 12, 4, hd.boardFrame); rect(x - 4, y + h + 7, 8, 2, '#f5f5dc');   // tray with a stick of chalk
  }
  for (const [roomId, xs] of Object.entries(SKOOL.desks)) {
    const room = SKOOL.rooms.find((r) => r.id === roomId);
    const floor = (room.bottomRight[1] + 1) * C;
    for (const x of xs) paintDesk(ctx, hd, x * C, floor);
  }

  // ---- Cup hooks and the safe's shelf -------------------------------------------------
  for (const cup of SKOOL.cups) { rect(cup.x * C + 6, cup.y * C - 2, 4, 4, hd.wall); }
  rect(SKOOL.safe.x * C - 6, SKOOL.safe.y * C + 20, 44, 4, hd.wall);

  // ---- The playground: tree, low wall, posts, gate posts, railings ---------------------
  paintPlayground(ctx, hd, C, feet(17));

  // ---- Room plaques ---------------------------------------------------------------------
  for (const z of DECOR.zones) {
    if (!z.plaque) continue;
    const cx = ((z.x0 + z.x1) / 2) * C, y = STOREY_TOP[z.storey] * C + 8;
    const w = measureHd(z.plaque) + 16;
    rect(cx - w / 2, y - 4, w, 22, hd.plaque);
    drawHdText(ctx, z.plaque, Math.round(cx - measureHd(z.plaque) / 2), y, hd.plaqueInk);
  }
  return canvas;
}

// The brick outside of a building, visible above the roofline and at the ends.
function paintShell(ctx, hd, b, C, W, H) {
  const x0 = b.x0 * C, x1 = Math.min(W, b.x1 * C);
  const brick = hd.brick[b.brick], dark = hd.brick[`${b.brick}Dark`];
  ctx.fillStyle = brick; ctx.fillRect(x0, 0, x1 - x0, H);
  for (let y = 0; y < H; y += 8) {
    ctx.fillStyle = dark;
    ctx.fillRect(x0, y + 6, x1 - x0, 2);
    for (let x = x0 + ((y / 8) % 2) * 16; x < x1; x += 32) ctx.fillRect(x, y, 2, 6);
  }
}

// One room: wall colour, skirting, a ceiling shadow and its decorations.
function paintZone(ctx, hd, z, C) {
  const x0 = z.x0 * C, x1 = z.x1 * C, top = STOREY_TOP[z.storey] * C, floor = (FLOOR_Y[z.storey] + 4) * C;
  const wall = hd.plaster[z.wall] || hd.plaster.cream;
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  rect(x0, top, x1 - x0, floor - top, wall);
  if (z.wall === 'tiles') {                                   // tiled walls: a grid of grout lines
    for (let y = top; y < floor; y += 16) rect(x0, y, x1 - x0, 1, hd.grout);
    for (let x = x0; x < x1; x += 16) rect(x, top, 1, floor - top, hd.grout);
  } else if (z.wall === 'hall') {                             // panelled lower half
    rect(x0, floor - 40, x1 - x0, 34, shade(wall, 0.9)); rect(x0, floor - 40, x1 - x0, 2, shade(wall, 0.75));
  }
  const g = ctx.createLinearGradient(0, top, 0, top + 20); g.addColorStop(0, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  rect(x0, top, x1 - x0, 20, g);
  rect(x0, floor - 8, x1 - x0, 4, shade(wall, 0.8));           // skirting
  rect(x0, floor - 4, x1 - x0, 4, shade(wall, 0.65));
  for (const [kind, col, w = 1] of z.props || []) paintProp(ctx, hd, kind, col * C, w * C, top, floor, C);
}

function paintProp(ctx, hd, kind, x, w, top, floor, C) {
  const rect = (xx, y, ww, h, c) => { ctx.fillStyle = c; ctx.fillRect(xx, y, ww, h); };
  switch (kind) {
    case 'window': {                                              // a painted-on window with the sky behind
      const h = Math.min(56, floor - top - 40), y = top + 24;
      rect(x, y, w, h, '#ffffff'); rect(x + 4, y + 4, w - 8, h - 8, hd.sky[0]);
      rect(x + 4, y + 4, w - 8, Math.floor(h / 2) - 6, shade(hd.sky[0], 1.08));
      rect(x + Math.floor(w / 2) - 2, y + 2, 4, h - 4, '#ffffff'); rect(x + 2, y + Math.floor(h / 2) - 2, w - 4, 4, '#ffffff');
      rect(x - 2, y + h, w + 4, 4, hd.woodLight);                 // sill
      break;
    }
    case 'bookcase': {
      const y = top + 20, h = floor - 8 - y;
      rect(x, y, w, h, hd.wood); rect(x + 2, y + 2, w - 4, h - 4, hd.woodDark);
      const books = ['#b23b3b', '#3b6fb2', '#3ba05a', '#d8a640', '#7a4a9a', '#e8e8e8', '#b2663b'];
      for (let s = 0; s < 3; s++) {
        const sy = y + 6 + s * Math.floor((h - 8) / 3), sh = Math.floor((h - 8) / 3) - 6;
        rect(x + 2, sy + sh, w - 4, 2, hd.wood);
        let bx = x + 5, i = s * 2;
        while (bx < x + w - 8) { const bw = 4 + ((i * 7) % 3) * 2, bh = sh - ((i * 5) % 3) * 3; rect(bx, sy + sh - bh, bw, bh, books[i % books.length]); bx += bw + 1; i++; }
      }
      break;
    }
    case 'shelf': {
      const y = top + 36;
      rect(x, y, w, 4, hd.wood); rect(x, y + 4, w, 2, hd.woodDark);
      rect(x + 6, y - 16, 6, 16, '#b5651d'); rect(x + 16, y - 20, 6, 20, '#e8c14a'); rect(x + 26, y - 14, 8, 14, '#c0c0c0');
      break;
    }
    case 'picture': {
      const y = top + 26;
      rect(x + 2, y, 12, 14, hd.woodDark); rect(x + 4, y + 2, 8, 10, '#dcd0b8'); rect(x + 5, y + 5, 6, 5, '#6b4a2a'); rect(x + 6, y + 3, 4, 3, '#f1c6a0');
      break;
    }
    case 'cubicles': {                                             // toilets: doors and basins
      for (let cx = x; cx + 28 <= x + w; cx += 48) {
        rect(cx, top + 22, 28, floor - top - 30, hd.woodLight); rect(cx + 2, top + 24, 24, floor - top - 34, hd.wood); rect(cx + 20, top + 60, 4, 4, '#e8c14a');
        if (cx + 48 <= x + w) { rect(cx + 32, floor - 44, 14, 6, '#ffffff'); rect(cx + 34, floor - 38, 10, 8, '#d8d8d8'); rect(cx + 38, floor - 30, 2, 22, '#c8c8c8'); }
      }
      break;
    }
    case 'labbench': {
      const y = floor - 36;
      rect(x, y, w, 6, hd.woodDark); rect(x, y + 6, w, 26, hd.wood); rect(x + 4, y + 10, w - 8, 18, hd.woodDark);
      for (let i = 0; i < 4; i++) { const fx = x + 10 + i * Math.floor(w / 4); rect(fx, y - 12, 4, 12, i % 2 ? '#4aa3ff' : '#3fa33f'); rect(fx - 2, y - 6, 8, 6, i % 2 ? '#4aa3ff' : '#3fa33f'); rect(fx + 1, y - 14, 2, 2, '#ffffff'); }
      break;
    }
    case 'shelves': {
      for (let s = 0; s < 3; s++) {
        const y = top + 24 + s * 26; rect(x, y + 12, w, 4, hd.wood);
        for (let jx = x + 4; jx < x + w - 10; jx += 14) rect(jx, y, 8, 12, ['#c0c0c0', '#e8c14a', '#b5651d', '#4aa3ff'][(jx / 14 + s) % 4 | 0]);
      }
      break;
    }
    case 'tallwindows': {                                        // the hall's high windows
      for (let wx = x + 8; wx + 24 <= x + w; wx += 32) { rect(wx, top + 10, 24, 80, '#ffffff'); rect(wx + 3, top + 13, 18, 74, hd.sky[0]); rect(wx + 11, top + 10, 2, 80, '#ffffff'); rect(wx, top + 48, 24, 2, '#ffffff'); }
      break;
    }
    case 'pegs': {
      const y = top + 30;
      rect(x, y, w, 4, hd.wood);
      const coats = ['#2a4a9a', '#6b3f1e', '#3a3a3a', '#8a2a2a', '#2f6b2f'];
      for (let px = x + 10, i = 0; px < x + w - 10; px += 32, i++) { rect(px, y + 4, 2, 6, hd.wallLight); if (i % 2 === 0) { rect(px - 5, y + 10, 12, 30, coats[i % coats.length]); rect(px - 3, y + 8, 8, 4, coats[i % coats.length]); } }
      break;
    }
    case 'bench': {
      rect(x, floor - 24, w, 6, hd.woodLight); rect(x, floor - 18, w, 2, hd.woodDark); rect(x + 6, floor - 18, 4, 14, hd.woodDark); rect(x + w - 10, floor - 18, 4, 14, hd.woodDark);
      break;
    }
    case 'table': {
      rect(x, floor - 28, w, 6, '#f4f1ea'); rect(x, floor - 22, w, 2, '#c9c2b2'); rect(x + 6, floor - 20, 4, 16, hd.woodDark); rect(x + w - 10, floor - 20, 4, 16, hd.woodDark);
      for (let px = x + 12; px < x + w - 12; px += 28) { rect(px, floor - 34, 10, 6, '#ffffff'); rect(px + 2, floor - 32, 6, 2, '#4aa3ff'); }
      break;
    }
    case 'hatch': {
      rect(x, top + 30, w, 44, hd.woodDark); rect(x + 4, top + 34, w - 8, 36, '#2b2b33'); rect(x + 6, top + 56, w - 12, 10, '#c0c0c0'); rect(x + 10, top + 50, 8, 6, '#e8c14a');
      break;
    }
    case 'curtain': {
      rect(x, top + 8, w, floor - top - 16, '#8a1a2a'); for (let cy = top + 8; cy < floor - 8; cy += 4) rect(x + 4, cy, 2, 2, '#b23b4b');
      break;
    }
    case 'stage': {
      rect(x, floor - 48, w + 8, 48, hd.woodLight); rect(x, floor - 48, w + 8, 4, hd.wood); rect(x, floor - 44, w + 8, 2, '#ffffff');
      for (let px = x + 8; px < x + w; px += 24) rect(px, floor - 40, 2, 40, hd.woodDark);
      break;
    }
    case 'cooker': {
      rect(x, floor - 40, w, 32, '#e6e6e6'); rect(x + 2, floor - 38, w - 4, 6, '#2b2b33'); rect(x + 6, floor - 30, w - 12, 14, '#3a3a44'); rect(x + 4, floor - 36, 4, 2, '#d8322a'); rect(x + 12, floor - 36, 4, 2, '#d8322a');
      break;
    }
    case 'sink': {
      rect(x, floor - 40, w, 32, '#e6e6e6'); rect(x + 4, floor - 38, w - 8, 8, '#c0c0c0'); rect(x + w / 2 - 2, floor - 50, 4, 12, '#9a9aa6'); rect(x + w / 2 - 8, floor - 50, 12, 3, '#9a9aa6');
      break;
    }
    case 'cupboards': {
      rect(x, top + 20, w, 40, '#f0f0f0'); rect(x + 2, top + 22, w / 2 - 3, 36, '#dcdcdc'); rect(x + w / 2 + 1, top + 22, w / 2 - 3, 36, '#dcdcdc');
      rect(x, floor - 40, w, 32, '#f0f0f0'); rect(x + 2, floor - 38, w / 2 - 3, 28, '#dcdcdc'); rect(x + w / 2 + 1, floor - 38, w / 2 - 3, 28, '#dcdcdc');
      break;
    }
    default: break;
  }
}

function paintStaircase(ctx, hd, s, C) {
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const [bx, by] = s.bottom, [tx, ty] = s.top;
  const dir = tx > bx ? 1 : -1, steps = by - ty;
  const feet = (y) => (y + 4) * C - 4;
  const x0 = bx * C + 8 + (dir > 0 ? 0 : C), x1 = tx * C + 8 + (dir > 0 ? C : 0);
  ctx.fillStyle = hd.stairs;
  ctx.beginPath(); ctx.moveTo(x0, feet(by)); ctx.lineTo(x1, feet(ty)); ctx.lineTo(x1, feet(ty) + 20); ctx.lineTo(x0, feet(by) + 20); ctx.closePath(); ctx.fill();
  for (let i = 0; i <= steps; i++) {
    const x = bx + dir * i, y = by - i, px = x * C + 8, py = feet(y);
    rect(px, py, C, 4, hd.stairsLight); rect(px, py + 4, C, 12, hd.stairs); rect(px, py + 14, C, 2, hd.stairsDark);
    rect(px + (dir > 0 ? C - 2 : 0), py, 2, 16, hd.stairsDark);
  }
  ctx.strokeStyle = hd.wall; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x0, feet(by) - 30); ctx.lineTo(x1, feet(ty) - 30); ctx.stroke();
  for (let i = 0; i <= steps; i += 2) { const x = bx + dir * i, y = by - i; rect(x * C + 8 + (dir > 0 ? C - 4 : 2), feet(y) - 30, 2, 30, hd.wall); }
}

function paintDesk(ctx, hd, x, floor) {
  const rect = (xx, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(xx, y, w, h); };
  // Chair (the pupil sits here facing left towards the board)
  rect(x + 16, floor - 28, 20, 4, hd.chair); rect(x + 32, floor - 46, 4, 22, hd.chair); rect(x + 30, floor - 48, 6, 2, hd.chairLight);
  rect(x + 18, floor - 24, 2, 24, hd.chairDark); rect(x + 32, floor - 24, 2, 24, hd.chairDark);
  // Desk in front, to the left
  rect(x - 20, floor - 34, 30, 4, hd.woodLight); rect(x - 20, floor - 30, 30, 14, hd.wood); rect(x - 18, floor - 28, 26, 2, hd.woodDark); rect(x + 2, floor - 30, 2, 14, hd.woodDark);
  rect(x - 18, floor - 16, 3, 16, hd.woodDark); rect(x + 5, floor - 16, 3, 16, hd.woodDark);
}

// A leaf cluster, stamped around the tree's crown.
const LEAF = layer(0, 0, `
  ......AAAAAAA.......
  ....AAAAAAAAAAA.....
  ..AAAAZAAAAAAAAAA...
  .AAAAZZAAAAAAAAAAA..
  AAAAZZAAAAAAAAAAAAA.
  AAAZZAAAAAAAAAAAAAAA
  AAAZAAAAAAAAAAAAAAAA
  AAZZAAAAAAAAAAAAAZAA
  .AZAAAAAAAAAAAAAZZA.
  .AAAAAAAAAAAAAAZZAA.
  ..AAAAAAAAAAAAZZAA..
  ...AAAAAAAAAAZZZA...
  .....AAAAAAAZZA.....
  .......AAAZZA.......
`, 'leaves');

function paintPlayground(ctx, hd, C, ground) {
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const p = DECOR.playground;
  // tarmac strip in front of the buildings, grass further off
  rect(p.x0 * C, ground - 2, (p.x1 - p.x0) * C, 6, hd.tarmac);
  // the low wall at the back of the playground, with its posts and the gate posts
  const wallY = p.wallTopRow * C + 8;
  rect(p.x0 * C, wallY, (p.gate[0] - p.x0) * C, 6, hd.wallStone); rect(p.x0 * C, wallY, (p.gate[0] - p.x0) * C, 2, '#ffffff');
  for (const post of p.posts) { rect(post * C + 6, 4 * C, 6, wallY - 4 * C + 6, hd.iron); rect(post * C + 6, 4 * C, 2, wallY - 4 * C, hd.ironLight); }
  for (const gx of p.gate) { rect(gx * C + 6, 14 * C, 8, 6 * C + 8, hd.iron); rect(gx * C + 6, 14 * C, 2, 6 * C + 8, hd.ironLight); rect(gx * C + 4, 14 * C - 4, 12, 4, hd.iron); }
  // railings from the gate to the girls' school
  for (let x = p.gate[1] * C + 20; x < p.x1 * C; x += 16) rect(x, 16 * C, 4, 4 * C + 8, hd.iron);
  rect(p.gate[1] * C + 16, 16 * C, (p.x1 - p.gate[1]) * C - 16, 4, hd.iron); rect(p.gate[1] * C + 16, 19 * C, (p.x1 - p.gate[1]) * C - 16, 4, hd.iron);
  // the tree: trunk, boughs, crown
  const tx = p.treeX * C + 8;
  rect(tx - 8, 2 * C, 16, ground - 2 * C, hd.trunk); rect(tx - 8, 2 * C, 4, ground - 2 * C, hd.trunkLight); rect(tx - 14, ground - 8, 28, 8, hd.trunk);
  rect(tx - 40, 5 * C, 34, 6, hd.trunk); rect(tx + 6, 6 * C, 40, 6, hd.trunk); rect(tx - 24, 3 * C, 20, 6, hd.trunk);
  const leaves = compose([[LEAF, 0, 0]], {}, LEAF.w * 2, LEAF.h * 2);   // doubled leaves read better at this size
  const big = makeCanvas(LEAF.w * 2, LEAF.h * 2); const bctx = big.getContext('2d'); bctx.imageSmoothingEnabled = false; bctx.drawImage(leaves, 0, 0, LEAF.w, LEAF.h, 0, 0, LEAF.w * 2, LEAF.h * 2);
  for (const [dx, dy] of [[-72, -8], [-36, -30], [4, -34], [40, -26], [-90, 18], [66, 10], [-50, 34], [-8, 20], [30, 36], [-28, 60], [20, 66], [-64, 56], [-100, 44], [80, 40], [-80, 80], [50, 80], [-20, 90], [10, 4], [-56, 6], [36, 2]]) ctx.drawImage(big, tx + dx - 20, 2 * C + dy);
}
