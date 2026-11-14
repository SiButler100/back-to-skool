// ============================================================================
// ILLUSTRATED BACKDROP (the school with painted rooms)
// ----------------------------------------------------------------------------
// Builds the modern view's building in four layers:
//   1. what lies under the rooms: sky, brick, the playground painting;
//   2. a painted picture for each room, fitted into that room's wall;
//   3. the structure people walk on and bump into (floors, stairs, walls,
//      door frames, room signs), drawn by code from painted material
//      swatches so every edge lines up with the engine's map (structure.js);
//   4. fixtures at the engine's positions: blackboards, chairs, the tree.
// While the artwork is still loading, or if it cannot be loaded, layers 1 and
// 3 are the pixel-art versions enlarged, so the building is always complete.
//
// Room pictures are generated at a fixed shape, so each is scaled to the
// room's height and either cropped (narrow rooms) or mirror-extended at the
// sides (wide rooms). The floor line of every picture is its bottom edge.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { DECOR } from '../../data/decor.js';
import { makeCanvas } from '../hd/pixelart.js';
import { paintBase, paintStructure, zoneRect } from '../hd/backdrop.js';
import { StructurePainter, GROUND_MARGIN } from './structure.js';

const PIXEL_SCALE = 2;

// A desk and its chair are one picture cut into two layers of the same size
// (tools/art/build.py split_desk). `dx` is how far right of the pupil's box
// the picture starts, in sixths of a Spectrum pixel, chosen so the chair seat
// is under a seated pupil and the desk in front of their knees.
export const DESK_UNIT = { dx: 19 };

export function buildIllustratedBackdrop(theme, S, assets) {
  const C = SKOOL.cell * S, P = PIXEL_SCALE, up = S / P;
  const u = S / 6;                               // one canvas pixel at the illustrated scale
  const W = SKOOL.width * C, rowsH = SKOOL.height * C, H = rowsH + GROUND_MARGIN * S;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const hasBoards = !!assets.furniture('blackboard'), hasDesks = !!assets.furniture('chair');
  const hasTree = !!assets.furniture('tree');
  // The painted structure needs the material swatches; until the artwork has
  // loaded (or if it never does) the pixel-art structure stands in.
  const painted = assets.ready && !!assets.texture('floorboards');
  const sp = new StructurePainter(ctx, theme, S, assets);

  // 1. What lies under the rooms.
  if (painted) {
    sp.base();
  } else {
    const base = makeCanvas(W / up, rowsH / up);
    paintBase(base.getContext('2d'), theme, P);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, W, rowsH);
    ctx.fillStyle = theme.hd.floorboardDark; ctx.fillRect(0, rowsH, W, H - rowsH);
  }

  // 2. The painted rooms.
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  let rooms = 0;
  for (const z of DECOR.zones) {
    const pic = assets.room(z.id);
    const r = zoneRect(z);
    const x = r.x0 * C, y = r.top * C, w = (r.x1 - r.x0) * C, h = (r.floor - r.top) * C;
    if (pic) { fitRoom(ctx, pic.img, x, y, w, h); rooms++; } else if (painted) { ctx.fillStyle = theme.hd.plaster[z.wall] || theme.hd.plaster.cream; ctx.fillRect(x, y, w, h); }
  }
  // The assembly hall is two pictures tall: a picture rail hides the join.
  if (assets.room('HallUpper') && assets.room('AssemblyHall')) {
    ctx.fillStyle = theme.hd.wall; ctx.fillRect(63 * C, 14 * C - 3 * u, 14 * C, 6 * u);
    ctx.fillStyle = theme.hd.wallLight; ctx.fillRect(63 * C, 14 * C - 3 * u, 14 * C, 1.5 * u);
  }

  // 3. Floors, stairs, walls, door frames, the playground, room signs.
  if (painted) {
    sp.structure();
  } else {
    const over = makeCanvas(W / up, rowsH / up);
    paintStructure(over.getContext('2d'), theme, P, { boards: hasBoards, desks: hasDesks, tree: hasTree, railings: false });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(over, 0, 0, W, rowsH);
  }

  // 4. Illustrated fixtures at the engine's positions.
  ctx.imageSmoothingEnabled = true;
  const stamp = (f, x, y, w, h) => ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  if (hasBoards) {
    const f = assets.furniture('blackboard');
    for (const b of SKOOL.blackboards) {
      const x = b.topLeft[0] * C, y = b.topLeft[1] * C, w = b.size[0] * C, h = b.size[1] * C;
      stamp(f, x - 18 * u, y - 18 * u, w + 36 * u, h + 48 * u);
    }
  }
  if (hasDesks) {
    // Only the chairs: the desks are drawn each frame in front of the pupils
    // (IllustratedPainter.drawForeground).
    const f = assets.furniture('chair');
    for (const [roomId, xs] of Object.entries(SKOOL.desks)) {
      const room = SKOOL.rooms.find((r) => r.id === roomId);
      const floor = (room.bottomRight[1] + 1) * C;
      for (const x of xs) stamp(f, x * C + DESK_UNIT.dx * u, floor - f.h, f.w, f.h);
    }
  }
  if (hasTree) {
    const f = assets.furniture('tree'), tx = DECOR.playground.treeX * C + C / 2;
    stamp(f, tx - f.w / 2, rowsH + 8 * u - f.h, f.w, f.h);
  }
  canvas.painted = rooms;
  return canvas;
}

// Fit a room picture into a wall rectangle. Its floor line is its bottom edge,
// so it is always bottom-aligned: a long room is made to fill the width and
// loses the top of the picture (plain wall, by design, up to 45% of it); a
// short room is made to fill the height and loses the sides. Only a picture
// too narrow even then is mirrored outwards.
function fitRoom(ctx, img, x, y, w, h) {
  const scale = Math.max(h / img.height, Math.min(w / img.width, (h / img.height) / 0.55));
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
