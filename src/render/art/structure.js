// ============================================================================
// ILLUSTRATED STRUCTURE (floors, stairs, walls and the playground, painted)
// ----------------------------------------------------------------------------
// The rooms are paintings, but the parts of the building people walk on and
// bump into must sit exactly where the engine's map says, so they are drawn
// by code. To match the paintings they are filled with painted material
// swatches (assets/illustrated/textures: floorboards, dark wood, two bricks,
// tarmac, stone) and shaded with soft gradients, instead of pixel art.
//
// Everything here is measured in "u": one sixth of a Spectrum pixel, which is
// one canvas pixel at the illustrated scale of 6. A cell is 48u.
//
// Draw order (see art/backdrop.js): base() first, then the room pictures,
// then structure(), then the fixtures.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { DECOR } from '../../data/decor.js';
import { zoneRect } from '../hd/backdrop.js';
import { UI_FONT, roundedRect } from './text.js';

// Game pixels of floor shown below the bottom row of cells, so the ground
// floor has a floor to stand on (the Spectrum screen simply ended there).
export const GROUND_MARGIN = 4;

// How big one repeat of each swatch is drawn, in u.
const TILE = { floorboards: 110, darkwood: 170, brickRed: 150, brickBuff: 150, tarmac: 190, stone: 96 };
// The dark wood swatch is a rich mahogany; trim and stairs want it browner.
const TINT = { darkwood: 'rgba(46,30,16,0.50)' };
const FALLBACK = { floorboards: '#b9813f', darkwood: '#4a241a', brickRed: '#a9523d', brickBuff: '#b08a4c', tarmac: '#6f7072', stone: '#b9b4a6' };

// The stretch of the world the playground scenery covers, in canvas pixels
// (a cell beyond the playground each side, tucked behind the school walls).
export function playgroundSpan(C) {
  const p = DECOR.playground;
  return { x0: (p.x0 - 1) * C, w: (p.x1 - p.x0 + 2) * C };
}

export class StructurePainter {
  constructor(ctx, theme, S, assets) {
    this.ctx = ctx; this.theme = theme; this.S = S; this.u = S / 6; this.C = SKOOL.cell * S; this.assets = assets;
    this.W = SKOOL.width * this.C; this.H = (SKOOL.height * SKOOL.cell + GROUND_MARGIN) * S;
    this.patterns = new Map();
  }

  // The walking surface for a character whose box starts at row y.
  feet(y) { return (y + 4) * this.C; }

  // A repeating fill made from a swatch, or a flat colour while it is missing.
  material(name) {
    if (this.patterns.has(name)) return this.patterns.get(name);
    let img = this.assets.texture(name);
    let fill = FALLBACK[name];
    if (img) {
      if (TINT[name]) {                                     // darken a swatch once, on a copy
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const cx = c.getContext('2d'); cx.drawImage(img, 0, 0); cx.fillStyle = TINT[name]; cx.fillRect(0, 0, c.width, c.height);
        img = c;
      }
      fill = this.ctx.createPattern(img, 'repeat');
      const k = (TILE[name] * this.u * 2) / img.width;      // the image holds a mirrored 2 x 2 block
      if (fill.setTransform) fill.setTransform(new DOMMatrix().scale(k, k));
    }
    this.patterns.set(name, fill);
    return fill;
  }
  fill(style, x, y, w, h) { this.ctx.fillStyle = style; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  // A vertical or horizontal fade laid over whatever is there (shading).
  shade(x, y, w, h, from, to, horizontal = false) {
    const g = horizontal ? this.ctx.createLinearGradient(x, 0, x + w, 0) : this.ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, from); g.addColorStop(1, to);
    this.fill(g, x, y, w, h);
  }

  // ---- 1. Under the rooms: sky, brick, the playground painting -------------------
  base(wallsOnly = false) {
    const { ctx, C, u, W, H } = this;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, this.theme.hd.sky[0]); sky.addColorStop(1, this.theme.hd.sky[1]);
    this.fill(sky, 0, 0, W, H);
    // The playground. Its sky and skyline are separate layers drawn every
    // frame BEHIND this backdrop so they can drift at their own speeds
    // (IllustratedPainter.drawParallax), so here the playground is left as a
    // hole, with only the boundary wall and tarmac along the bottom.
    const span = playgroundSpan(C), wall = this.assets.scene('wall');
    if (wallsOnly) ctx.clearRect(span.x0, 0, span.w, H);
    else if (wall && this.assets.scene('sky') && this.assets.scene('skyline')) {
      ctx.clearRect(span.x0, 0, span.w, H);
      const h = wall.img.height * (span.w / wall.img.width);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(wall.img, span.x0, H - h, span.w, h);
      this.sceneWallTop = H - h;                // where the wall's coping is
    }
    // Brick wherever a building stands (the rooms are painted over most of it).
    for (const b of DECOR.buildings) {
      const x0 = b.x0 * C, x1 = Math.min(W, b.x1 * C);
      this.fill(this.material(b.brick === 'girls' ? 'brickBuff' : 'brickRed'), x0, 0, x1 - x0, H);
      this.shade(x0, 0, x1 - x0, H, 'rgba(0,0,0,0.10)', 'rgba(0,0,0,0.22)');
    }
  }

  // ---- 3. On top of the rooms --------------------------------------------------
  structure() {
    this.floors();
    this.walls();
    this.doorFrames();
    for (const s of SKOOL.staircases) this.staircase(s);
    this.stage();
    this.outerWalls();
    this.playground();
    this.safeShelf();
    this.plaques();
  }

  // Floors: a strip of boards seen slightly from above, with a darker front
  // edge and a soft shadow on the storey below. People stand on the strip.
  floors() {
    const { u, C } = this;
    const inside = (x) => DECOR.buildings.some((b) => x >= b.x0 && x < b.x1);
    for (const f of SKOOL.floors) {
      if (f.id === 'Stage') continue;
      // Split the ground floor where the playground interrupts it.
      let run = null;
      const flush = () => { if (run) this.floorStrip(run[0] * C, (run[1] + 1) * C, this.feet(f.y), f.y < 17); run = null; };
      for (let x = f.minX; x <= f.maxX + 2 && x < SKOOL.width; x++) {
        if (inside(x)) { if (!run) run = [x, x]; else run[1] = x; } else flush();
      }
      flush();
    }
    void u;
  }
  floorStrip(x0, x1, y, shadowBelow) {
    const { u, ctx } = this, w = x1 - x0;
    this.fill(this.material('floorboards'), x0, y - 10 * u, w, 22 * u);
    this.shade(x0, y - 10 * u, w, 22 * u, 'rgba(60,30,10,0.38)', 'rgba(255,240,210,0.10)');
    this.fill('rgba(45,25,10,0.55)', x0, y - 10 * u, w, 1.5 * u);                    // where floor meets wall
    this.fill(this.material('darkwood'), x0, y + 12 * u, w, 9 * u);                  // the front edge
    this.shade(x0, y + 12 * u, w, 9 * u, 'rgba(255,225,190,0.30)', 'rgba(0,0,0,0.35)');
    if (shadowBelow) this.shade(x0, y + 21 * u, w, 40 * u, 'rgba(20,12,6,0.36)', 'rgba(20,12,6,0)');
    void ctx;
  }

  // Interior walls that block the way: a plastered pier with shaded sides.
  walls() {
    const { u, C } = this;
    for (const w of SKOOL.walls) {
      if (w.x === 0 || w.x === SKOOL.width - 1) continue;
      const x = w.x * C + 8 * u, y0 = w.topY * C, y1 = (w.bottomY + 1) * C - 10 * u, ww = 32 * u;
      this.shade(x + ww, y0, 16 * u, y1 - y0, 'rgba(30,18,8,0.30)', 'rgba(30,18,8,0)', true);   // its shadow on the wall behind
      this.fill('#cdbb97', x, y0, ww, y1 - y0);
      this.shade(x, y0, ww, y1 - y0, 'rgba(255,250,235,0.30)', 'rgba(70,45,20,0.40)', true);
      this.fill('rgba(50,32,16,0.55)', x, y0, 1.5 * u, y1 - y0); this.fill('rgba(50,32,16,0.55)', x + ww - 1.5 * u, y0, 1.5 * u, y1 - y0);
      this.fill(this.material('darkwood'), x - 3 * u, y1 - 14 * u, ww + 6 * u, 14 * u);          // skirting block
      this.fill(this.material('darkwood'), x - 3 * u, y0, ww + 6 * u, 8 * u);                    // capping
    }
  }

  // Door frames and the dark doorway behind each door (the door itself is
  // live furniture, drawn every frame).
  doorFrames() {
    const { u, C } = this;
    for (const d of SKOOL.doors) {
      if (d.id === 'DrinksCabinet' || d.id === 'SkoolGate') continue;
      const [cx, cy] = d.coords, [w, h] = d.size;
      const x = cx * C, y = cy * C, ww = w * C, hh = h * C + 24 * u;
      this.fill(this.material('darkwood'), x - 13 * u, y - 13 * u, ww + 26 * u, hh + 13 * u);
      this.shade(x - 13 * u, y - 13 * u, ww + 26 * u, hh + 13 * u, 'rgba(255,220,180,0.22)', 'rgba(0,0,0,0.25)', true);
      this.fill('#1b120c', x, y, ww, hh);
      this.shade(x, y, ww, hh, 'rgba(0,0,0,0.55)', 'rgba(90,60,35,0.35)');
    }
  }

  // A staircase seen from the side: a sawtooth of treads on a dark stringer,
  // with a handrail and balusters behind. The tread for a climber at column x
  // is under the middle of their box, so feet land on it.
  staircase(s) {
    const { ctx, u, C } = this;
    const [bx, by] = s.bottom, [tx, ty] = s.top;
    const dir = tx > bx ? 1 : -1, steps = by - ty;
    const left = (i) => (bx + dir * i) * C + C;            // left end of tread i
    const top = (i) => this.feet(by - i);
    // The body under the treads.
    ctx.beginPath();
    const first = dir > 0 ? 1 : steps, last = dir > 0 ? steps : 1, step = dir > 0 ? 1 : -1;
    // Trace the sawtooth from the low end to the high end, left to right.
    const order = [];
    for (let i = 0; i <= steps; i++) order.push(i);
    if (dir < 0) order.reverse();
    ctx.moveTo(left(order[0]), top(order[0]));
    for (const i of order) { ctx.lineTo(left(i), top(i)); ctx.lineTo(left(i) + C, top(i)); }
    const drop = 46 * u;
    const a = order[order.length - 1], b = order[0];
    ctx.lineTo(left(a) + C, top(a) + drop + (dir > 0 ? 0 : C)); ctx.lineTo(left(b), top(b) + drop + (dir > 0 ? C : 0));
    ctx.closePath();
    ctx.save(); ctx.clip();
    const x0 = Math.min(left(0), left(steps)), x1 = Math.max(left(0), left(steps)) + C;
    this.fill(this.material('darkwood'), x0, top(steps) - 2, x1 - x0, top(0) - top(steps) + drop + C + 4);
    this.shade(x0, top(steps), x1 - x0, top(0) - top(steps) + drop + C, 'rgba(255,220,180,0.12)', 'rgba(0,0,0,0.38)');
    ctx.restore();
    // Treads: a lighter board with a nosing and the riser's shadow beneath.
    for (let i = 1; i <= steps; i++) {
      this.fill(this.material('floorboards'), left(i) - 3 * u, top(i), C + 6 * u, 9 * u);
      this.shade(left(i) - 3 * u, top(i), C + 6 * u, 9 * u, 'rgba(255,245,220,0.25)', 'rgba(60,30,10,0.30)');
      this.shade(left(i), top(i) + 9 * u, C, 16 * u, 'rgba(0,0,0,0.40)', 'rgba(0,0,0,0)');
    }
    void first; void last; void step;
    // Handrail and balusters, on the wall side (so behind the people).
    const railUp = 92 * u, mid = (i) => left(i) + C / 2;
    ctx.strokeStyle = '#5a3320'; ctx.lineWidth = 3 * u;
    for (let i = 1; i < steps; i++) { ctx.beginPath(); ctx.moveTo(mid(i), top(i)); ctx.lineTo(mid(i), top(i) - railUp); ctx.stroke(); }
    for (const i of [0, steps]) {                           // newel posts
      this.fill(this.material('darkwood'), mid(i) - 6 * u, top(i) - railUp - 12 * u, 12 * u, railUp + 12 * u);
      this.fill('#3a2014', mid(i) - 8 * u, top(i) - railUp - 18 * u, 16 * u, 8 * u);
    }
    ctx.lineCap = 'round'; ctx.lineWidth = 8 * u; ctx.strokeStyle = '#4a2a1a';
    ctx.beginPath(); ctx.moveTo(mid(0), top(0) - railUp); ctx.lineTo(mid(steps), top(steps) - railUp); ctx.stroke();
    ctx.lineWidth = 2.5 * u; ctx.strokeStyle = 'rgba(255,215,170,0.45)';
    ctx.beginPath(); ctx.moveTo(mid(0), top(0) - railUp - 2 * u); ctx.lineTo(mid(steps), top(steps) - railUp - 2 * u); ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // The assembly-hall stage: a panelled platform (a cut-out) on the hall floor.
  stage() {
    const f = this.assets.furniture('stage');
    const { u, C, ctx } = this, topY = this.feet(14);
    const x = 77 * C - 6 * u, w = 5.5 * C + 30 * u;
    if (f) ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(x), Math.round(topY - 26 * u), Math.round(w), Math.round(this.feet(17) + 12 * u - (topY - 26 * u)));
    else { this.fill(this.material('floorboards'), x, topY - 10 * u, w, 22 * u); this.fill(this.material('darkwood'), x, topY + 12 * u, w, this.feet(17) - topY); }
  }

  // Where each school meets the open air: a brick end wall with a stone base.
  outerWalls() {
    const { u, C, H } = this;
    for (const [x, name] of [[95 * C + 20 * u, 'brickRed'], [159 * C - 4 * u, 'brickBuff']]) {
      this.fill(this.material(name), x, 0, 32 * u, H);
      this.shade(x, 0, 32 * u, H, 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.38)', true);
      this.fill('rgba(40,22,12,0.6)', x, 0, 1.5 * u, H); this.fill('rgba(40,22,12,0.6)', x + 30.5 * u, 0, 1.5 * u, H);
      this.fill(this.material('stone'), x - 4 * u, H - 40 * u, 40 * u, 40 * u);
    }
  }

  // Outdoors: the gateway through the painted boundary wall, its piers, and
  // the street lamps. (The tree and the gate itself are drawn elsewhere.)
  playground() {
    const { u, C, H, ctx } = this, p = DECOR.playground;
    const pier = this.assets.furniture('pier'), lamp = this.assets.furniture('lamp');
    const ground = this.feet(17);
    if (this.sceneWallTop) {
      // An opening in the wall between the piers: the tarmac runs on through it.
      const gx0 = p.gate[0] * C + C / 2, gx1 = p.gate[1] * C + C / 2, top = this.sceneWallTop;
      this.fill(this.material('tarmac'), gx0, top, gx1 - gx0, ground - 20 * u - top);
      this.shade(gx0, top, gx1 - gx0, ground - 20 * u - top, 'rgba(10,14,20,0.32)', 'rgba(255,255,255,0.08)');
    }
    const stand = (f, cx, sink = 10) => { if (f) ctx.drawImage(f.img, f.x, f.y, f.w, f.h, Math.round(cx - f.w / 2), Math.round(ground + sink * u - f.h), f.w, f.h); };
    for (const gx of p.gate) stand(pier, gx * C + C / 2);
    for (const lx of p.lamps || []) stand(lamp, lx * C + C / 2, 6);
    void H;
  }

  safeShelf() {
    const { u, C } = this, s = SKOOL.safe;
    this.fill(this.material('darkwood'), s.x * C - 12 * u, s.y * C + 60 * u, 120 * u, 9 * u);
    this.shade(s.x * C - 12 * u, s.y * C + 69 * u, 120 * u, 10 * u, 'rgba(0,0,0,0.28)', 'rgba(0,0,0,0)');
  }

  // Room names: an enamel sign on the wall near the ceiling.
  // (`lower` moves them down by that many units: in the 3D view the edge of
  // the floor above would otherwise hide them.)
  plaques(lower = 0) {
    const { ctx, u, C } = this;
    ctx.save();
    ctx.font = `400 ${Math.round(19 * u)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    try { ctx.letterSpacing = `${(2.2 * u).toFixed(1)}px`; } catch (e) { /* older browsers */ }
    for (const z of DECOR.zones) {
      if (!z.plaque) continue;
      const r = zoneRect(z), cx = ((r.x0 + r.x1) / 2) * C, y = r.top * C + (16 + lower) * u;
      const w = ctx.measureText(z.plaque).width + 34 * u, h = 34 * u;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; roundedRect(ctx, cx - w / 2 + 2 * u, y + 3 * u, w, h, 5 * u); ctx.fill();
      ctx.fillStyle = '#26402f'; roundedRect(ctx, cx - w / 2, y, w, h, 5 * u); ctx.fill();
      ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 1.5 * u; roundedRect(ctx, cx - w / 2 + 3 * u, y + 3 * u, w - 6 * u, h - 6 * u, 3 * u); ctx.stroke();
      ctx.fillStyle = '#f4ecd6'; ctx.fillText(z.plaque, cx, y + h / 2 + 1 * u);
    }
    ctx.restore();
  }
}
