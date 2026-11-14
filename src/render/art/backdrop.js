// ============================================================================
// ILLUSTRATED BACKDROP (the school with painted rooms)
// ----------------------------------------------------------------------------
// Builds the modern view's building at scale 4 from three layers:
//   1. the pixel-art base (sky, ground, brick, plain room walls), enlarged;
//   2. a painted picture for each room, fitted into that room's wall;
//   3. the pixel-art structure (floors, walls, stairs, door frames, plaques),
//      enlarged and laid on top so every edge lines up with the engine's map;
// then the illustrated blackboards, desks, railings and tree where the
// manifest has them. Anything missing keeps its pixel-art version, so the
// building is always complete.
//
// Room pictures are generated at a fixed shape, so each is scaled to the
// room's height and either cropped (narrow rooms) or mirror-extended at the
// sides (wide rooms). The floor line of every picture is its bottom edge.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { DECOR } from '../../data/decor.js';
import { makeCanvas } from '../hd/pixelart.js';
import { paintBase, paintStructure, zoneRect } from '../hd/backdrop.js';

const PIXEL_SCALE = 2;

export function buildIllustratedBackdrop(theme, S, assets) {
  const C = SKOOL.cell * S, P = PIXEL_SCALE, up = S / P;
  const u = S / 4;                               // sizes below were first measured at scale 4
  const W = SKOOL.width * C, H = SKOOL.height * C;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const hasBoards = !!assets.furniture('blackboard'), hasDesks = !!assets.furniture('desk');
  const hasTree = !!assets.furniture('tree'), hasRailings = !!assets.furniture('railing');

  // 1. The pixel base, enlarged crisply.
  const base = makeCanvas(W / up, H / up);
  paintBase(base.getContext('2d'), theme, P);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, W, H);

  // 2. The painted rooms.
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  let painted = 0;
  for (const z of DECOR.zones) {
    const pic = assets.room(z.id);
    if (!pic) continue;
    const r = zoneRect(z);
    fitRoom(ctx, pic.img, r.x0 * C, r.top * C, (r.x1 - r.x0) * C, (r.floor - r.top) * C);
    painted++;
  }
  // The assembly hall is two pictures tall: a picture rail hides the join.
  if (assets.room('HallUpper') && assets.room('AssemblyHall')) {
    ctx.fillStyle = theme.hd.wall; ctx.fillRect(63 * C, 14 * C - 2 * up, 14 * C, 4 * up);
    ctx.fillStyle = theme.hd.wallLight; ctx.fillRect(63 * C, 14 * C - 2 * up, 14 * C, up);
  }

  // 3. The structure on top, enlarged crisply.
  const over = makeCanvas(W / up, H / up);
  paintStructure(over.getContext('2d'), theme, P, { boards: hasBoards, desks: hasDesks, tree: hasTree, railings: hasRailings });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(over, 0, 0, W, H);

  // 4. Illustrated fixtures at the engine's positions.
  ctx.imageSmoothingEnabled = true;
  const stamp = (f, x, y, w, h) => ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  if (hasBoards) {
    const f = assets.furniture('blackboard');
    for (const b of SKOOL.blackboards) {
      const x = b.topLeft[0] * C, y = b.topLeft[1] * C, w = b.size[0] * C, h = b.size[1] * C;
      stamp(f, x - 12 * u, y - 12 * u, w + 24 * u, h + 32 * u);
    }
  }
  if (hasDesks) {
    const f = assets.furniture('desk');
    for (const [roomId, xs] of Object.entries(SKOOL.desks)) {
      const room = SKOOL.rooms.find((r) => r.id === roomId);
      const floor = (room.bottomRight[1] + 1) * C;
      for (const x of xs) stamp(f, x * C - 40 * u, floor - 96 * u, 112 * u, 96 * u);
    }
  }
  if (hasRailings) {
    const f = assets.furniture('railing'), p = DECOR.playground;
    const y = 16 * C, x1 = p.x1 * C;
    ctx.save(); ctx.beginPath(); ctx.rect(p.gate[1] * C + C, y, x1 - p.gate[1] * C - C, f.h); ctx.clip();
    for (let x = p.gate[1] * C + C; x < x1; x += f.w) stamp(f, x, y, f.w, f.h);
    ctx.restore();
  }
  if (hasTree) {
    const f = assets.furniture('tree'), tx = DECOR.playground.treeX * C + C / 2;
    stamp(f, tx - f.w / 2, (SKOOL.height) * C - f.h, f.w, f.h);
  }
  canvas.painted = painted;
  return canvas;
}

// Fit a room picture into a wall rectangle: scale to the wall's height (up to
// 15% taller, cropped from the top, where the wall is plainest), then crop the
// sides if it is too wide or mirror it outwards if it is too narrow.
function fitRoom(ctx, img, x, y, w, h) {
  const scale = Math.max(h / img.height, Math.min(w / img.width, 1.15 * h / img.height));
  const sw = img.width * scale, sh = img.height * scale;
  const srcY = (sh - h) / scale;                      // rows cropped off the top
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (sw >= w) {
    const srcX = ((sw - w) / 2) / scale;
    ctx.drawImage(img, srcX, srcY, w / scale, h / scale, x, y, w, h);
  } else {
    const left = x + (w - sw) / 2;
    ctx.drawImage(img, 0, srcY, img.width, h / scale, left, y, sw, h);
    // mirrored copies either side until the wall is covered (odd copies flipped so edges meet)
    for (let i = 1; i <= 8 && (left - (i - 1) * sw > x || left + i * sw < x + w); i++) {
      drawMirrored(ctx, img, srcY, h / scale, left + i * sw, y, sw, h, i % 2 === 1);
      drawMirrored(ctx, img, srcY, h / scale, left - i * sw, y, sw, h, i % 2 === 1);
    }
  }
  ctx.restore();
}

function drawMirrored(ctx, img, srcY, srcH, dx, dy, dw, dh, mirror) {
  ctx.save();
  if (mirror) { ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, srcY, img.width, srcH, 0, 0, dw, dh); }
  else ctx.drawImage(img, 0, srcY, img.width, srcH, dx, dy, dw, dh);
  ctx.restore();
}
