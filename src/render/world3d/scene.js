// ============================================================================
// THE SCHOOL AS A MODEL (built once, from the same map the game plays on)
// ----------------------------------------------------------------------------
// A doll's house, open at the front:
//   depth 0            the back walls, with the painted room pictures on them
//   depth 0 to 1.25    solid things people walk in front of: stairs, the
//                      stage, the walls between rooms, the end walls of the
//                      buildings
//   the action depth   where everybody stands (camera.js: ACTION_Z = 1.6)
//   depth 2.3          the front edge of every floor
// Out in the playground there is no back wall. Instead the boundary wall, the
// rooftops and the sky stand at real distances, so they slide past one another
// as the view moves.
//
// Nothing here is typed in by hand: floors, stairs, walls and desks come from
// data/skool.js, and the room pictures from the same code the flat illustrated
// view uses (art/backdrop.js), so the two views cannot disagree about where
// anything is.
// ============================================================================

import * as THREE from './three.js';
import { SKOOL } from '../../data/skool.js';
import { DECOR } from '../../data/decor.js';
import { buildIllustratedBackdrop, DESK_UNIT } from '../art/backdrop.js';
import { illustratedPieces } from '../art/furniture.js';
import { ACTION_Z, placeAtDepth, orderFor } from './camera.js';
import { U, rect, block, cutout, wholeImage, uvOf, textureOf } from './parts.js';

const ROWS = SKOOL.height;            // 21 rows of cells
const FLOOR_FRONT = ACTION_Z + 0.7;   // depth of the front edge of the floors: just in front of the people
const SOLID_FRONT = ACTION_Z - 0.35;  // solid things stop here, just behind the people
const PX = 48;                        // picture-pixels per cell in the illustrated artwork

// How many cells one repeat of each material swatch covers (the picture holds
// a mirrored 2 x 2 block of it; the sizes match the flat view's structure.js).
const TILE = { floorboards: 220 * U, darkwood: 340 * U, brickRed: 300 * U, brickBuff: 300 * U, tarmac: 380 * U, stone: 192 * U };
const FALLBACK = { floorboards: 0xb9813f, darkwood: 0x4a241a, brickRed: 0xa9523d, brickBuff: 0xb08a4c, tarmac: 0x6f7072, stone: 0xb9b4a6 };
const TINT = { darkwood: 'rgba(46,30,16,0.50)' };   // the swatch is a rich mahogany; trim and stairs want it browner

export function buildSchool(assets, theme) {
  const root = new THREE.Group();

  // ---- Materials: a swatch that repeats, lit by the sun -------------------------
  const made = new Map();
  const material = (name) => {
    if (made.has(name)) return made.get(name);
    let img = assets.texture(name), m;
    if (img) {
      if (TINT[name]) {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const cx = c.getContext('2d'); cx.drawImage(img, 0, 0); cx.fillStyle = TINT[name]; cx.fillRect(0, 0, c.width, c.height);
        img = c;
      }
      const t = new THREE.Texture(img);
      t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true;
      m = new THREE.MeshLambertMaterial({ map: t });
    } else m = new THREE.MeshLambertMaterial({ color: FALLBACK[name] });
    made.set(name, m);
    return m;
  };
  const plain = (colour) => new THREE.MeshLambertMaterial({ color: colour });
  const solid = (x0, x1, y0, y1, z0, z1, name, extra = {}) => block(root, x0, x1, y0, y1, z0, z1, { front: material(name), top: material(name), ...extra }, TILE[name]);

  // ---- Back walls: the room paintings ----------------------------------------------
  // One long picture of every room's back wall is painted by the flat view's
  // own code, then cut into pieces small enough for any graphics card.
  const wall = buildIllustratedBackdrop(theme, PX / SKOOL.cell, assets, { wallsOnly: true });
  for (const b of DECOR.buildings) {
    for (let x0 = b.x0; x0 < b.x1; x0 += 32) {
      const w = Math.min(b.x1, x0 + 32) - x0;
      const piece = document.createElement('canvas'); piece.width = w * PX; piece.height = ROWS * PX;
      piece.getContext('2d').drawImage(wall, x0 * PX, 0, w * PX, ROWS * PX, 0, 0, w * PX, ROWS * PX);
      const t = new THREE.CanvasTexture(piece); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      root.add(new THREE.Mesh(rect([x0, -ROWS, 0], [w, 0, 0], [0, ROWS, 0]), new THREE.MeshBasicMaterial({ map: t })));
    }
    // The paintings keep their own colours (they are not lit), so shadows on
    // the wall are caught by an invisible sheet just in front of it.
    // One sheet per storey, stopping short of the ceiling: the foot of a
    // shadow from the storey above would otherwise show through the floor.
    for (const floorRow of [7, 14, 21]) {
      const catcher = new THREE.Mesh(rect([b.x0, -floorRow, 0.02], [b.x1 - b.x0, 0, 0], [0, 5.6, 0]), new THREE.ShadowMaterial({ opacity: 0.26 }));
      catcher.receiveShadow = true; catcher.renderOrder = orderFor(0.02);
      root.add(catcher);
    }
  }

  // ---- Floors -----------------------------------------------------------------------
  // A slab of boards from the wall to the front edge, wherever a building
  // stands (the ground floor is interrupted by the playground).
  const inside = (x) => DECOR.buildings.some((b) => x >= b.x0 && x < b.x1);
  const front = { front: material('darkwood'), top: material('floorboards'), side: material('darkwood') };
  for (const f of SKOOL.floors) {
    if (f.id === 'Stage') continue;
    let run = null;
    const flush = () => { if (run) block(root, run[0], run[1] + 1, -(f.y + 4) - 0.22, -(f.y + 4), 0, FLOOR_FRONT, front, TILE.floorboards); run = null; };
    for (let x = f.minX; x <= f.maxX + 2 && x < SKOOL.width; x++) {
      if (inside(x)) { if (!run) run = [x, x]; else run[1] = x; } else flush();
    }
    flush();
  }

  // ---- Walls between rooms, and the brick end walls -------------------------------------
  for (const w of SKOOL.walls) {
    if (w.x === 0 || w.x === SKOOL.width - 1) continue;
    const x = w.x + 8 * U, m = plain(0xcdbb97);
    block(root, x, x + 32 * U, -(w.bottomY + 1) + 10 * U, -w.topY, 0, SOLID_FRONT, { front: m, top: m, side: m });
  }
  // The far ends of the world: a thick brick wall, so that the view never sees round the end of a room.
  solid(-4, 0, -ROWS - 0.5, 0, 0, FLOOR_FRONT, 'brickRed');
  solid(SKOOL.width, SKOOL.width + 4, -ROWS - 0.5, 0, 0, FLOOR_FRONT, 'brickBuff');
  solid(95 + 20 * U, 95 + 52 * U, -ROWS - 0.5, 0, 0, SOLID_FRONT, 'brickRed');
  solid(159 - 4 * U, 159 + 28 * U, -ROWS - 0.5, 0, 0, SOLID_FRONT, 'brickBuff');

  // ---- Staircases ---------------------------------------------------------------------
  // Real steps. The tread for a climber at column x is under the middle of
  // their box, exactly as in the flat view, so feet land on it.
  const rail = plain(0x4a2a1a);
  for (const s of SKOOL.staircases) {
    const [bx, by] = s.bottom, [tx, ty] = s.top;
    const dir = tx > bx ? 1 : -1, steps = by - ty;
    const left = (i) => bx + dir * i + 1, top = (i) => -(by - i + 4);
    for (let i = 1; i <= steps; i++) {
      block(root, left(i) - 3 * U, left(i) + 1 + 3 * U, top(i) - 9 * U, top(i), 0.2, SOLID_FRONT, { front: material('floorboards'), top: material('floorboards') }, TILE.floorboards);
      solid(left(i), left(i) + 1, top(i) - 9 * U - 1.6, top(i) - 9 * U, 0.23, SOLID_FRONT - 0.03, 'darkwood');
    }
    // The handrail on the wall side: two newel posts, balusters, and the rail.
    const mid = (i) => left(i) + 0.5, up = 92 * U;
    for (const i of [0, steps]) block(root, mid(i) - 6 * U, mid(i) + 6 * U, top(i), top(i) + up + 12 * U, 0.22, 0.42, { front: material('darkwood'), top: rail });
    for (let i = 1; i < steps; i++) block(root, mid(i) - 1.5 * U, mid(i) + 1.5 * U, top(i), top(i) + up, 0.3, 0.34, { front: rail });
    const lo = dir > 0 ? 0 : steps, hi = dir > 0 ? steps : 0;      // the rail is drawn left to right
    const strip = new THREE.Mesh(rect([mid(lo), top(lo) + up - 4 * U, 0.43], [mid(hi) - mid(lo), top(hi) - top(lo), 0], [0, 8 * U, 0]), rail);
    root.add(strip);
  }

  // ---- The assembly-hall stage -----------------------------------------------------------
  {
    const x0 = 77 - 6 * U, x1 = x0 + 5.5 + 30 * U, top = -18;
    block(root, x0, x1, -ROWS, top, 0, SOLID_FRONT, { front: material('darkwood'), top: material('floorboards') }, TILE.floorboards);
    const f = assets.furniture('stage');
    if (f) {
      // The painted front of the stage. The picture includes a strip of the
      // stage's top (26 of its 182 units), which the real top replaces.
      const [u0, v0, u1, v1] = uvOf(f), cropped = v1 - (v1 - v0) * (26 / 182);
      cutout(root, f, x0, -ROWS - 12 * U, SOLID_FRONT + 0.01, { w: x1 - x0, h: 3 + 12 * U, uv: [u0, v0, u1, cropped] });
    }
  }

  // ---- Desks and chairs --------------------------------------------------------------------
  // A chair behind each pupil and a desk in front, at real depths either side of them.
  const chair = assets.furniture('chair'), desk = assets.furniture('desk');
  for (const [roomId, xs] of Object.entries(SKOOL.desks)) {
    const room = SKOOL.rooms.find((r) => r.id === roomId), floor = -(room.bottomRight[1] + 1);
    for (const x of xs) {
      if (chair) cutout(root, chair, x + DESK_UNIT.dx * U, floor, ACTION_Z - 0.3, { shadow: true });
      if (desk) cutout(root, desk, x + DESK_UNIT.dx * U, floor, ACTION_Z + 0.4, { shadow: true });
    }
  }

  // ---- The playground ----------------------------------------------------------------------
  const p = DECOR.playground, span = { x0: p.x0 - 1, w: p.x1 - p.x0 + 2 };
  const ground = -ROWS;
  // Tarmac up to the boundary wall, and a road leading away through the gateway.
  block(root, p.x0, p.x1, ground - 0.3, ground, -1.2, FLOOR_FRONT, { front: material('stone'), top: material('tarmac') }, TILE.tarmac);
  block(root, p.gate[0] + 0.5, p.gate[1] + 0.5, ground - 0.3, ground, -19, -1.2, { top: material('tarmac') }, TILE.tarmac);
  const far = [];
  const scene = (name) => { const s = assets.scene(name); return s ? wholeImage(s.img) : null; };
  const wallPic = scene('wall'), skyPic = scene('sky'), linePic = scene('skyline');
  let wallTopRow = 17;
  if (wallPic) {
    // The boundary wall, in two lengths with the gateway between them.
    const z = -1.2, h = wallPic.h * (span.w / wallPic.w) , gx0 = p.gate[0] + 0.5, gx1 = p.gate[1] + 0.5;
    wallTopRow = ROWS + 0.5 - h;
    const [u0, v0, u1, v1] = uvOf(wallPic), at = (x) => u0 + (u1 - u0) * ((x - span.x0) / span.w);
    cutout(root, wallPic, span.x0, ground - 0.5, z, { w: gx0 - span.x0, h, uv: [u0, v0, at(gx0), v1] });
    cutout(root, wallPic, gx1, ground - 0.5, z, { w: span.x0 + span.w - gx1, h, uv: [at(gx1), v0, u1, v1] });
  }
  // Rooftops and sky: placed every frame by where they should be SEEN, at the
  // slower speeds of things far away (the rates the flat view uses), but
  // standing at real distances so that everything nearer passes in front.
  const backdropPlane = (pic, z, opaque) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: textureOf(pic.img), transparent: !opaque, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = orderFor(z); m.frustumCulled = false;
    root.add(m);
    return m;
  };
  if (skyPic) {
    const w = skyPic.w * 1.3 * U, h = skyPic.h * 1.3 * U;
    for (let i = -2; i <= 2; i++) far.push({ mesh: backdropPlane(skyPic, -300, true), z: -300, w, h, rate: 0.5, col: span.x0 + (i + 0.5) * w, row: wallTopRow + 60 * U - h / 2, flip: i % 2 !== 0, drift: 5 * U });
  }
  if (linePic) {
    const w = linePic.w * 0.9 * U, h = linePic.h * 0.9 * U, right = span.x0 + span.w + 0.16 * (span.w / 2 + 16);
    for (let i = 0; i < 2; i++) far.push({ mesh: backdropPlane(linePic, -45, false), z: -45, w, h, rate: 0.16, col: right - (i + 0.5) * w, row: wallTopRow + 22 * U - h / 2, flip: i === 1, drift: 0 });
  }
  // The tree, the gate piers and the street lamps stand on the tarmac.
  const stand = (f, cx, sink, z, shadow = true) => { if (f) cutout(root, f, cx - (f.w * U) / 2, ground - sink * U, z, { shadow }); };
  stand(assets.furniture('tree'), p.treeX + 0.5, 8, ACTION_Z - 0.7);
  for (const gx of p.gate) stand(assets.furniture('pier'), gx + 0.5, 10, ACTION_Z - 0.5);
  for (const lx of p.lamps || []) stand(assets.furniture('lamp'), lx + 0.5, 6, -0.6);

  // ---- Live fixtures: doors, windows, cups, the safe, the cabinet, the bike ------------------
  // Rebuilt only when one of them changes state (a door opens, a cup fills).
  const fixtures = new THREE.Group();
  root.add(fixtures);
  let fixtureKey = '';
  // (Cups hang from the front edge of the floor above, where nothing hides them.)
  const depthOf = (key) => (key.startsWith('cup') ? FLOOR_FRONT + 0.04 : key.startsWith('gate') ? ACTION_Z - 0.45 : key === 'bike' || key === 'chain' ? ACTION_Z - 0.25 : key === 'conker' ? ACTION_Z - 0.68 : 0.05);
  const setFixtures = (game) => {
    const pieces = illustratedPieces(game, PX / SKOOL.cell, assets).filter((q) => q.f);
    const key = pieces.map((q) => q.key).join('|');
    if (key === fixtureKey) return;
    fixtureKey = key;
    for (const child of [...fixtures.children]) { fixtures.remove(child); child.geometry.dispose(); child.material.dispose(); }
    for (const q of pieces) cutout(fixtures, q.f, q.x / PX, -(q.y + q.h) / PX, depthOf(q.key), { w: q.w / PX, h: q.h / PX });
  };

  // ---- Every frame -----------------------------------------------------------------------------
  const centre = span.x0 + span.w / 2;
  const update = (lens, viewCentre, seconds) => {
    for (const layer of far) {
      const drift = layer.drift ? ((seconds * layer.drift) % (2 * layer.w)) : 0;
      const at = placeAtDepth(layer.col + (viewCentre - centre) * layer.rate + drift, layer.row, layer.z, lens);
      layer.mesh.position.set(at.x, at.y, layer.z);
      layer.mesh.scale.set(layer.w * at.k * (layer.flip ? -1 : 1), layer.h * at.k, 1);
    }
  };

  return { root, update, setFixtures };
}
