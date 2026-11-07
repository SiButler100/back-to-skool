// ============================================================================
// THE BACKDROP (the school building, drawn from the map data)
// ----------------------------------------------------------------------------
// Paints the static parts of the school once onto an offscreen canvas: sky,
// ground, brickwork, floors, staircases, room interiors, blackboard frames,
// desks and chairs, the tree, the bike shed and the gate posts.
//
// Anything that changes during play (doors, windows, cups, chalk on boards,
// plants, the safe, the conker) is drawn by the renderer on top of this.
//
// Everything is derived from data/skool.js, so if you move a room the picture
// follows. The look is governed by the theme (render/theme.js).
// ============================================================================

import { SKOOL } from '../data/skool.js';
import { drawText, measureText } from './font.js';

const C = SKOOL.cell;   // 8 px

export function buildBackdrop(theme) {
  const width = SKOOL.width * C, height = SKOOL.height * C;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const rect = (x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); };

  // --- Sky and ground -----------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, theme.sky[0]); sky.addColorStop(1, theme.sky[1]);
  rect(0, 0, width, height, sky);
  rect(0, 20 * C + 4, width, 4, theme.groundLine);

  // --- Buildings ------------------------------------------------------------
  // Boys' school: x 0..95 (the wall at 95 is the outside wall). Girls': 159..191.
  const boysRight = 96 * C, girlsLeft = 159 * C;
  paintBuilding(ctx, theme, 0, boysRight, true);
  paintBuilding(ctx, theme, girlsLeft, width, false);

  // --- Floors (walkable strips) ---------------------------------------------
  for (const f of SKOOL.floors) {
    const y = (f.y + 4) * C - 2;   // feet level (sprite is 4 cells tall)
    rect(f.minX * C, y, (f.maxX - f.minX + 3) * C, 2, theme.floor);
    rect(f.minX * C, y - 1, (f.maxX - f.minX + 3) * C, 1, theme.floorLight);
  }
  // Playground surface
  rect(96 * C, 20 * C + 4, 63 * C, 4, theme.ground);

  // --- Interior walls (from the wall list) ----------------------------------
  for (const w of SKOOL.walls) {
    if (w.x === 0 || w.x === 191) continue;
    rect(w.x * C + 3, w.topY * C, 3, (w.bottomY - w.topY + 1) * C, theme.wall);
  }
  // Outer walls of each building
  rect(95 * C + 5, 0, 3, 14 * C + 4, theme.boysBrickDark);
  rect(159 * C, 0, 3, 21 * C, theme.girlsBrickDark);

  // --- Staircases -----------------------------------------------------------
  for (const s of SKOOL.staircases) paintStaircase(ctx, theme, s);

  // --- Rooms: labels, blackboards, desks ------------------------------------
  for (const r of SKOOL.rooms) {
    const label = r.name;
    const cx = ((r.topLeft[0] + r.bottomRight[0]) / 2 + 1.5) * C;
    const ly = r.topLeft[1] * C + 3;
    drawText(ctx, label, Math.round(cx - measureText(label) / 2), ly, theme.label);
  }
  for (const b of SKOOL.blackboards) {
    const x = b.topLeft[0] * C, y = b.topLeft[1] * C;
    rect(x - 2, y - 2, b.size[0] * C + 4, b.size[1] * C + 4, theme.blackboardFrame);
    rect(x, y, b.size[0] * C, b.size[1] * C, theme.blackboard);
    // chalk tray
    rect(x - 2, y + b.size[1] * C + 2, b.size[0] * C + 4, 2, theme.blackboardFrame);
  }
  for (const [roomId, xs] of Object.entries(SKOOL.desks)) {
    const room = SKOOL.rooms.find((r) => r.id === roomId);
    const floorY = (room.bottomRight[1] + 1) * C;  // bottom of room, i.e. feet level
    for (const x of xs) paintDesk(ctx, theme, x * C, floorY);
  }

  // --- Playground furniture: tree, bike shed, gate posts, bench -------------
  paintTree(ctx, theme, 100 * C, 20 * C + 4);
  paintBikeShed(ctx, theme, 112 * C, 20 * C + 4);
  // Gate posts either side of the gate (gate itself is drawn live)
  rect(133 * C + 4, 14 * C, 4, 6 * C + 4, theme.gate);
  rect(138 * C + 4, 14 * C, 4, 6 * C + 4, theme.gate);
  // Railings along the playground boundary
  for (let x = 139 * C + 8; x < 159 * C; x += 8) rect(x, 16 * C, 2, 4 * C + 4, theme.gate);
  rect(139 * C + 8, 16 * C, 20 * C - 8, 2, theme.gate);
  for (let x = 96 * C + 8; x < 133 * C; x += 8) if (x < 98 * C || x > 103 * C) rect(x, 17 * C + 4, 2, 3 * C, theme.gate);
  rect(96 * C, 17 * C + 4, 37 * C, 2, theme.gate);

  // --- The stage in the assembly hall --------------------------------------
  rect(77 * C, 18 * C - 2, 5 * C + 6, 3 * C + 2, theme.floorLight);
  rect(77 * C, 18 * C - 2, 5 * C + 6, 2, theme.floor);

  // Cup hooks (cups drawn live)
  for (const cup of SKOOL.cups) rect(cup.x * C + 3, cup.y * C + 1, 2, 2, theme.wall);

  // Safe shelf and drinks cabinet shelf
  rect(SKOOL.safe.x * C - 2, SKOOL.safe.y * C + 9, 20, 2, theme.wall);

  return canvas;
}

function paintBuilding(ctx, theme, x0, x1, boys) {
  const rect = (x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); };
  const brick = boys ? theme.boysBrick : theme.girlsBrick;
  const brickDark = boys ? theme.boysBrickDark : theme.girlsBrickDark;
  const interior = boys ? theme.boysInterior : theme.girlsInterior;
  const interiorAlt = boys ? theme.boysInteriorAlt : theme.girlsInteriorAlt;
  const height = SKOOL.height * C;
  rect(x0, 0, x1 - x0, height, brick);
  // brick courses
  for (let y = 0; y < height; y += 4) {
    for (let x = x0 + ((y / 4) % 2) * 6; x < x1; x += 12) rect(x, y, 1, 4, brickDark);
    rect(x0, y + 3, x1 - x0, 1, brickDark);
  }
  // Interiors: three storeys, each 7 cells (floor y at 3, 10, 17 => storey top at 0, 7, 14)
  for (const top of [0, 7, 14]) {
    const alt = (top / 7) % 2 === 1;
    rect(x0 + 4, top * C + 2, x1 - x0 - 8, 7 * C - 6, alt ? interiorAlt : interior);
    // skirting
    rect(x0 + 4, (top + 7) * C - 6, x1 - x0 - 8, 2, theme.floorLight);
  }
  // Roof line
  rect(x0, 0, x1 - x0, 2, brickDark);
}

function paintStaircase(ctx, theme, s) {
  const rect = (x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); };
  const [bx, by] = s.bottom, [tx, ty] = s.top;
  const dir = tx > bx ? 1 : -1;
  const steps = by - ty;
  const feetY = (y) => (y + 4) * C - 2;   // feet level of a character standing at row y
  // Solid flight: fill the wedge beneath the steps so they read as one staircase.
  ctx.fillStyle = theme.stairs;
  ctx.beginPath();
  const x0 = bx * C + 4 + (dir > 0 ? 0 : C), x1 = tx * C + 4 + (dir > 0 ? C : 0);
  ctx.moveTo(x0, feetY(by)); ctx.lineTo(x1, feetY(ty)); ctx.lineTo(x1, feetY(ty) + 10); ctx.lineTo(x0, feetY(by) + 10); ctx.closePath(); ctx.fill();
  for (let i = 0; i <= steps; i++) {
    const x = bx + dir * i, y = by - i;
    const px = x * C + 4, py = feetY(y);
    rect(px, py, C, 2, theme.stairsLight);
    rect(px, py + 2, C, 6, theme.stairs);
    rect(px + (dir > 0 ? C - 1 : 0), py, 1, 8, theme.wall);
  }
  // Handrail: a sloping line with posts.
  ctx.strokeStyle = theme.wall; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, feetY(by) - 14); ctx.lineTo(x1, feetY(ty) - 14); ctx.stroke();
  for (let i = 0; i <= steps; i += 2) {
    const x = bx + dir * i, y = by - i;
    rect(x * C + 4 + (dir > 0 ? C - 2 : 1), feetY(y) - 14, 1, 14, theme.wall);
  }
}

function paintDesk(ctx, theme, x, floorY) {
  const rect = (x0, y0, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x0, y0, w, h); };
  // Chair (behind the desk, character sits here facing left)
  rect(x + 2, floorY - 14, 9, 2, theme.chair);          // seat
  rect(x + 9, floorY - 22, 2, 10, theme.chair);         // back
  rect(x + 3, floorY - 12, 1, 12, theme.chair); rect(x + 9, floorY - 12, 1, 12, theme.chair);
  // Desk in front (to the left, since kids face the board on the left)
  rect(x - 10, floorY - 16, 12, 3, theme.desk);
  rect(x - 10, floorY - 13, 12, 6, theme.deskDark);
  rect(x - 9, floorY - 7, 1, 7, theme.deskDark); rect(x, floorY - 7, 1, 7, theme.deskDark);
}

function paintTree(ctx, theme, x, groundY) {
  const rect = (x0, y0, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x0, y0, w, h); };
  rect(x - 3, groundY - 110, 6, 110, theme.trunk);
  rect(x - 8, groundY - 80, 6, 4, theme.trunk); rect(x + 2, groundY - 70, 8, 4, theme.trunk);
  const blobs = [[-26, -150, 26], [-6, -160, 28], [12, -148, 24], [-34, -126, 22], [20, -124, 24], [-14, -118, 26], [4, -104, 20]];
  for (const [dx, dy, r] of blobs) { ctx.fillStyle = theme.tree; ctx.beginPath(); ctx.arc(x + dx + r / 2, groundY + dy + r / 2, r / 2, 0, Math.PI * 2); ctx.fill(); }
  for (const [dx, dy, r] of blobs.slice(0, 4)) { ctx.fillStyle = theme.treeLight; ctx.beginPath(); ctx.arc(x + dx + r / 2 - 3, groundY + dy + r / 2 - 4, r / 3, 0, Math.PI * 2); ctx.fill(); }
}

function paintBikeShed(ctx, theme, x, groundY) {
  const rect = (x0, y0, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x0, y0, w, h); };
  rect(x, groundY - 30, 2, 30, theme.wall); rect(x + 46, groundY - 30, 2, 30, theme.wall);
  rect(x - 4, groundY - 34, 56, 4, theme.floor);
  rect(x - 2, groundY - 32, 52, 2, theme.floorLight);
}
