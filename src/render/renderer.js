// ============================================================================
// RENDERER (camera + drawing every frame)
// ----------------------------------------------------------------------------
// Draws the visible slice of the school onto the game canvas:
//   1. the pre-painted backdrop
//   2. live furniture: doors, windows, cups, chalk on blackboards, the safe
//   3. everyone and everything in the cast
//   4. speech bubbles, then any message box
//
// The camera follows Eric. "Smooth motion" (render/motion.js) turns the
// engine's cell-sized steps into steady movement; switch it off for the
// original's chunky 8-pixel steps.
// ============================================================================

import { SKOOL } from '../data/skool.js';
import { buildBackdrop } from './backdrop.js';
import { getSprite, clearSpriteCache } from './sprites.js';
import { drawText, drawTextCentred, measureText, LINE_HEIGHT } from './font.js';
import { THEMES } from './theme.js';
import { OriginalPainter, originalMeasure, originalFontHas } from './original.js';
import { ModernPainter } from './hd/painter.js';
import { IllustratedPainter } from './art/illustrated.js';
import { ArtAssets } from './art/assets.js';
import { Motion } from './motion.js';
import { Effects } from './fx.js';
export { originalMeasure, originalFontHas };

const C = SKOOL.cell;
const SPRITE_W = 24, SPRITE_H = 32;   // a sprite frame in game pixels (3 x 4 cells)
const CLOSE_ROWS = 14;                // rows of cells the close camera shows: two storeys
const LANE_STEP = 0.75;               // game pixels between depth lanes on a floor
const FLOOR_ROWS = new Set(SKOOL.floors.map((f) => f.y));
const laneHash = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

export class Renderer {
  constructor(canvas, game, options = {}) {
    this.canvas = canvas;
    this.game = game;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.options = { theme: 'modern', smoothMotion: true, retroScroll: false, viewportColumns: 48, retroStatus: false, originalGraphics: false, artwork: 'illustrated', camera: 'whole', onResize: null, ...options };
    this.original = new OriginalPainter();   // the 1985 artwork, used when originalGraphics is on
    this.scale = 1;                          // canvas pixels per game pixel (the HD painter asks for 2)
    this.setTheme(this.options.theme);
    this.cameraX = 0;               // left edge of the view, in pixels
    this.cameraY = 0;               // top edge of the view, in pixels (only the close camera moves it)
    this.cameraTargetY = 0;
    this.motion = new Motion();     // where everything appears to be between the engine's steps
    this.positions = this.motion.tracks;   // (older scripts clear this map to snap everything)
    this.lastDraw = 0;              // time of the previous frame, for time-based easing
    this.fx = new Effects(game, (thing) => this.spritePos(thing));   // splashes, stars, floating numbers (HD views only)
    this.onFootstep = null;         // called when Eric's foot lands, for the sound of it
    this.guide = [];                // aiming help: spots to stand on, set each tick by features/aim-guide.js
    this.lastStepFrame = -1;
    this.tint = document.createElement('canvas'); this.tint.width = 24; this.tint.height = 32;
    this.resize(this.options.viewportColumns);
  }

  setTheme(name) {
    this.theme = THEMES[name] || THEMES.modern;
    this.options.theme = name;
    this.backdrop = buildBackdrop(this.theme);
    clearSpriteCache();
    if (!this.painters) {
      // Two painters for the modern view: hand-made pixel art, and the
      // illustrated artwork loaded from assets/illustrated (which falls back
      // to the pixel art while loading or for anything it lacks).
      this.assets = new ArtAssets();
      this.painters = { pixel: new ModernPainter(this.theme), illustrated: new IllustratedPainter(this.theme, this.assets) };
      this.assets.load();
    } else {
      this.painters.pixel.setTheme(this.theme); this.painters.illustrated.setTheme(this.theme);
    }
    this.hd = this.painters.pixel;   // the preview page and tests look here
  }

  // The painter the artwork option asks for.
  get painter() { return this.options.artwork === 'illustrated' ? this.painters.illustrated : this.painters.pixel; }

  // The view's width in game pixels (the canvas may be a multiple of this).
  get viewW() { return this.columns * C; }

  // The world's height in game pixels: 21 rows of cells, plus the strip of
  // ground an HD painter may show below them.
  get worldH() { return SKOOL.height * C + (this.margin || 0); }

  // How much of that height the view shows. The close camera shows two
  // storeys (14 rows) and follows Eric up and down; otherwise everything.
  get viewH() { return this.closeCamera() ? CLOSE_ROWS * C + (this.margin || 0) : this.worldH; }
  closeCamera() { return this.options.camera === 'close' && this.useHd(); }

  // retroStatus adds the original's three status rows under the play area.
  resize(columns, retroStatus = this.options.retroStatus, scale = this.scale) {
    this.columns = columns;
    this.options.retroStatus = retroStatus;
    this.scale = scale;
    // An HD painter may show a strip of ground below the last row of cells.
    this.margin = this.useHd() ? (this.painter.marginBottom || 0) : 0;
    this.close = this.closeCamera();
    this.canvas.width = columns * C * scale;
    this.canvas.height = (this.viewH + (retroStatus ? 3 * C : 0)) * scale;
    this.ctx.imageSmoothingEnabled = false;
    if (this.options.onResize) this.options.onResize();
  }

  // The HD path runs at the painter's scale, the others at 1. The right scale
  // can change mid-session (the tape loads, an option is toggled), so this is
  // checked every frame.
  ensureScale() {
    const want = this.useOriginal() ? 1 : this.useHd() ? this.painter.scale : 1;
    const margin = this.useHd() ? (this.painter.marginBottom || 0) : 0;
    if (want !== this.scale || margin !== this.margin || this.closeCamera() !== this.close) this.resize(this.columns, this.options.retroStatus, want);
  }

  // ---- Camera ----------------------------------------------------------------
  // `dt` is the time since the last frame in milliseconds, so the camera
  // moves at the same speed whatever the screen's refresh rate.
  // Where the camera should look: at Eric, or, for the moment he is hidden
  // inside a kiss (the engine parks him off the map), at where he was standing.
  ericAnchor(smooth = true) {
    const eric = this.game.cast.eric;
    if (!eric.visible && eric.hideCoords) return [eric.hideCoords[0] * C, eric.hideCoords[1] * C];
    return smooth ? this.spritePos(eric) : [eric.x * C, eric.y * C];
  }

  updateCamera(dt) {
    const viewW = this.viewW;
    const maxX = SKOOL.width * C - viewW;
    const clamp = (v) => Math.max(0, Math.min(maxX, v));
    if (this.options.retroScroll) {
      // Original behaviour: jump the view by 8 columns when Eric nears an edge.
      const ericX = Math.round(this.ericAnchor(false)[0] / C);
      const target = clamp(ericX * C + 12 - viewW / 2);
      const col = Math.floor(this.cameraX / C);
      const offset = ericX - col;
      if (offset >= this.columns - 10) this.cameraX = Math.min(maxX, (col + 8) * C);
      else if (offset <= 9 && col > 0) this.cameraX = Math.max(0, (col - 8) * C);
      if (Math.abs(this.cameraX - target) > viewW) this.cameraX = target;
    } else if (this.options.attract) {
      // Behind the title screen: drift slowly along the school and back.
      this.cameraX = maxX * (0.5 - 0.5 * Math.cos(performance.now() / 90000 * Math.PI * 2 + 2.2));
    } else {
      // Follow where Eric is DRAWN (which glides), not his cell (which jumps).
      const [ex] = this.ericAnchor();
      const target = clamp(ex + 12 - viewW / 2);
      if (Math.abs(this.cameraX - target) > viewW) this.cameraX = target;        // a new game or a big jump: cut
      else this.cameraX += (target - this.cameraX) * (1 - Math.exp(-dt / 150));
      if (Math.abs(this.cameraX - target) < 0.05) this.cameraX = target;
    }
    const from = Math.floor(this.cameraX / C), to = from + this.columns;
    this.game.setVisibleColumns(from, to);
    this.updateCameraY(dt);
  }

  // The close camera shows two of the three storeys. It only moves when it
  // has to: on the ground floor it shows the bottom two storeys, on the top
  // floor the top two, and on the middle floor it stays wherever it was, so
  // climbing one flight does not always drag the view with it.
  updateCameraY(dt) {
    const maxY = this.worldH - this.viewH;
    if (maxY <= 0) { this.cameraY = this.cameraTargetY = 0; return; }
    if (this.options.attract) { this.cameraY = this.cameraTargetY = maxY; return; }   // the title screen shows the ground floor
    const [, ey] = this.ericAnchor();
    const lowest = ey + SPRITE_H + (this.margin || 0) - this.viewH;    // any higher than this cuts off Eric's feet
    const highest = ey - 3 * C;                                         // any lower than this cuts off the space above his head
    this.cameraTargetY = Math.max(0, Math.min(maxY, Math.max(lowest, Math.min(highest, this.cameraTargetY))));
    if (Math.abs(this.cameraY - this.cameraTargetY) > this.viewH) this.cameraY = this.cameraTargetY;
    else this.cameraY += (this.cameraTargetY - this.cameraY) * (1 - Math.exp(-dt / 260));
    if (Math.abs(this.cameraY - this.cameraTargetY) < 0.05) this.cameraY = this.cameraTargetY;
  }

  // Depth on a flat floor. Everyone in the game stands on the same line, so a
  // crowd used to pile into one blob. Walkers are given one of three lanes a
  // little apart (-1 back, 0 middle, 1 front; the further lanes drawn first),
  // which separates feet and shadows; Eric takes the front lane so he is never
  // hidden. Anyone sitting, lying or on the stairs keeps to the middle line,
  // where chairs and steps are.
  laneOf(d, m, dt) {
    const onFloor = Number.isInteger(d.y) && FLOOR_ROWS.has(d.y);
    let want = 0;
    if (m.walkState && onFloor && !d.staircase) {
      want = d === this.game.cast.eric ? 1 : (d.isAdult?.() ? 0 : (laneHash(d.id) % 3) - 1);
    }
    const tr = this.motion.tracks.get(d.id);
    if (tr.lane === undefined) tr.lane = want;
    tr.lane += (want - tr.lane) * (1 - Math.exp(-dt / 140));
    if (Math.abs(tr.lane - want) < 0.02) tr.lane = want;
    return tr.lane;
  }

  // Where a thing is drawn this frame, in game pixels (see render/motion.js).
  spritePos(thing) {
    const m = this.motion.sample(thing, this.options.smoothMotion);
    return [m.x * C, m.y * C];
  }

  // True when the view should use the genuine Spectrum graphics.
  useOriginal() { return this.options.originalGraphics && this.original.ready; }
  // True when the view should use the HD painters (modern palette only).
  useHd() { return !this.useOriginal() && this.options.artwork !== 'painted' && !!this.theme.hd; }

  // ---- The frame -------------------------------------------------------------
  draw(now = performance.now()) {
    const { ctx, game, theme } = this;
    const dt = Math.max(0, Math.min(100, now - this.lastDraw));
    this.lastDraw = now; this.frameDt = dt;
    // How long a tick lasts on screen: the speed setting stretches or squeezes
    // it, except behind the title screen, where the school always runs at 1x.
    this.motion.begin(now, 1000 / (game.config.ticksPerSecond * (this.options.attract ? 1 : (this.options.gameSpeed || 1))));
    this.updateCamera(dt);
    this.ensureScale();
    // Effects belong to the HD views. In the others nothing draws or ages
    // them, so they are switched off there: otherwise they pile up unseen and
    // all burst out at once when the view is changed.
    const wantFx = !this.useOriginal() && this.useHd();
    if (this.fx.enabled !== wantFx) { this.fx.enabled = wantFx; this.fx.reset(); }
    const cam = Math.round(this.cameraX);
    if (this.useOriginal()) return this.drawOriginal(cam);
    if (this.useHd()) return this.drawHd();
    ctx.save();
    ctx.translate(-cam, 0);
    const viewFrom = cam - 32, viewTo = cam + this.canvas.width + 32;

    const playH = SKOOL.height * C;
    ctx.drawImage(this.backdrop, cam, 0, this.canvas.width, playH, cam, 0, this.canvas.width, playH);
    this.drawFurniture(viewFrom, viewTo);
    if (this.options.guides) this.drawGuideSpots(ctx, 1);

    // Characters and things
    const drawables = game.cast.drawables.filter((d) => d.visible && d.x * C + 24 >= viewFrom && d.x * C <= viewTo);
    for (const d of drawables) {
      const [x, y] = this.spritePos(d);
      let sprite = getSprite(d.group, d.animatoryState, d.direction, d.look);
      if (this.theme.shadow !== 'rgba(0,0,0,0)' && d.group !== 'OBJ' && d.isStanding?.()) {
        ctx.fillStyle = theme.shadow; ctx.fillRect(Math.round(x) + 6, Math.round(y) + 31, 12, 1);
      }
      if (theme.monoSprites && d.group !== 'OBJ') sprite = this.tinted(sprite, theme.monoSprites);
      ctx.drawImage(sprite, Math.round(x), Math.round(y));
    }

    if (this.options.guides) this.drawGuideTargets(ctx, 1);
    // Speech bubbles
    for (const c of game.cast.characterList) if (c.bubble) this.drawBubble(c);

    ctx.restore();

    // Message box (screen space)
    if (game.messageBox) this.drawMessageBox(game.messageBox, cam);
    if (this.options.retroStatus) this.drawStatus();
  }

  // The frame from one of the HD painters (pixel art or illustrated).
  // Anything a painter cannot draw falls back to the painted stand-in,
  // enlarged, so nothing is ever missing from the screen.
  drawHd() {
    const p = this.painter, S = p.scale, { ctx, game } = this, viewW = this.viewW;
    const dt0 = this.frameDt || 0;
    // The camera may sit between game pixels: at scale S there are S canvas
    // pixels to each one, so scrolling is S times finer than the old view.
    const cam = Math.round(this.cameraX * S) / S, camY = Math.round(this.cameraY * S) / S, viewH = this.viewH;
    ctx.imageSmoothingEnabled = !!p.smooth;     // smooth for illustrations, crisp for pixel art
    this.fx.update(dt0);
    const [shakeX, shakeY] = this.options.smoothMotion ? this.fx.shakeOffset() : [0, 0];
    if (shakeX || shakeY) {
      // A shaken frame is drawn a pixel or two off, which would leave a sliver
      // of the previous frame along one edge: lay the unshaken scene underneath first.
      ctx.save(); ctx.translate(Math.round(-cam * S), Math.round(-camY * S));
      if (p.drawParallax) p.drawParallax(ctx, cam, viewW, camY, viewH, this.lastDraw);
      p.drawBackdrop(ctx, cam, viewW, camY, viewH);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(Math.round((-cam + shakeX) * S), Math.round((-camY + shakeY) * S));
    if (p.drawParallax) p.drawParallax(ctx, cam, viewW, camY, viewH, this.lastDraw);   // far scenery, behind the backdrop
    p.drawBackdrop(ctx, cam, viewW, camY, viewH);
    p.drawFurniture(ctx, game);
    if (this.options.guides) this.drawGuideSpots(ctx, S);     // on the floor, under everybody's feet
    const viewFrom = cam - 48, viewTo = cam + viewW + 48;
    const cycles = !!p.hasCycle;                // only the illustrated painter has walk cycles
    const dt = dt0;

    // People first, back lane to front lane, then whatever stands in front of
    // them (desks), then objects (pellets, water, the frog...) on top.
    const people = [], objects = [];
    for (const d of game.cast.drawables) {
      if (!d.visible || d.x * C + SPRITE_W < viewFrom || d.x * C > viewTo) continue;
      if (d.trapped) continue;                  // a frog in a cup is part of the cup's own picture
      const m = this.motion.sample(d, this.options.smoothMotion);
      if (d.group === 'OBJ') objects.push({ d, m, lane: 0 });
      else people.push({ d, m, lane: p.smooth ? this.laneOf(d, m, dt) : 0 });
    }
    people.sort((a, b) => a.lane - b.lane);     // stable: equal lanes keep the engine's order (Eric last)
    const drawOne = ({ d, m, lane }) => {
      const x = m.x * C, y = m.y * C + lane * LANE_STEP;
      if (d.group !== 'OBJ' && d.isStanding?.() && !m.air) p.drawShadow(ctx, x, y);
      // Which picture: the walk cycle while gliding, the standing pose at
      // rest, otherwise whatever pose the engine says.
      let state = d.animatoryState;
      if (cycles && m.walkState && p.hasCycle(d.group, d.look)) state = m.walking ? `CYCLE${m.cycle}` : 'WALK0';
      // In mid-air on a scripted flight: leaping on the way up, flailing on the way down.
      if (m.air && p.hasFrame && p.hasFrame(d.group, 'DROP_A', d.look)) state = m.air === 'up' ? 'LEAP' : (Math.floor(this.lastDraw / 120) % 2 ? 'DROP_B' : 'DROP_A');
      if (m.seq && p.hasFrame && p.hasFrame(d.group, m.seq.needs, d.look)) {
        // A change of pose with in-between pictures: show the current one and,
        // in the second half of its time, bring the next one in over it.
        p.drawSprite(ctx, d.group, m.seq.a || state, m.seq.dirA, d.look, x, y);
        if (m.seq.k > 0.5) {
          ctx.globalAlpha = (m.seq.k - 0.5) * 2;
          p.drawSprite(ctx, d.group, m.seq.b || state, m.seq.dirB, d.look, x, y);
          ctx.globalAlpha = 1;
        }
        return;
      }
      if (m.fade && p.smooth) {
        // No in-between pictures: blend out of the previous pose over a few frames.
        ctx.globalAlpha = 1 - m.fade.k;
        p.drawSprite(ctx, d.group, m.fade.state, m.fade.direction, d.look, x, y);
        ctx.globalAlpha = Math.min(1, m.fade.k * 1.6);
      }
      if (!p.drawSprite(ctx, d.group, state, d.direction, d.look, x, y)) {
        ctx.drawImage(getSprite(d.group, d.animatoryState, d.direction, d.look), Math.round(x * S), Math.round(y * S), SPRITE_W * S, SPRITE_H * S);
      }
      ctx.globalAlpha = 1;
    };
    people.forEach(drawOne);
    if (p.drawForeground) p.drawForeground(ctx, game);
    objects.forEach(drawOne);
    if (this.options.guides) this.drawGuideTargets(ctx, S);   // the ring round the cup, over everything
    this.fx.draw(ctx, S);
    // Speech bubbles, for speakers who are in the picture. (A bubble is kept
    // inside the view, so one for somebody out of sight would be pinned to the
    // edge with nobody under it.)
    for (const c of game.cast.characterList) {
      if (!c.bubble) continue;
      const [bx, by] = this.spritePos(c);
      if (bx + SPRITE_W < cam || bx > cam + viewW || by + SPRITE_H < camY || by > camY + viewH) continue;
      p.drawBubble(ctx, c, [bx, by]);
    }
    // A footstep sounds when Eric's walk cycle reaches a frame where a foot lands.
    const em = this.motion.sample(game.cast.eric, this.options.smoothMotion);
    const stepFrame = em.walking && (em.cycle === 3 || em.cycle === 7) ? em.cycle : -1;
    if (stepFrame !== this.lastStepFrame) { this.lastStepFrame = stepFrame; if (stepFrame >= 0 && this.onFootstep) this.onFootstep(); }
    ctx.restore();
    this.fx.drawFlash(ctx, this.canvas.width, this.canvas.height);
    if (game.messageBox) p.drawMessageBox(ctx, game.messageBox, cam, viewW, camY, viewH);
    if (this.options.retroStatus) { ctx.save(); ctx.scale(S, S); this.drawStatus(); ctx.restore(); }
  }

  // ---- Aiming help (modern view) ----------------------------------------------
  // features/aim-guide.js works out where Eric must stand to fill a cup with
  // the pistol (blue) or knock it with the catapult (amber). Each spot gets a
  // soft pool of light where his feet go and a small arrow for the way to
  // face. Sizes are in game pixels, multiplied by S like everything else.
  drawGuideSpots(ctx, S) {
    if (!this.guide || !this.guide.length) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.lastDraw / 320);
    ctx.save();
    for (const g of this.guide) {
      const rgb = g.kind === 'pistol' ? '74,163,255' : '255,183,3';
      const cx = (g.x * C + 12) * S, cy = ((g.y + 4) * C - 1) * S;      // middle of his feet, on the floor line
      const strength = g.lit ? 0.9 : 0.35 + 0.25 * pulse;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12 * S);
      glow.addColorStop(0, `rgba(${rgb},${strength})`);
      glow.addColorStop(1, `rgba(${rgb},0)`);
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(1, 0.3); ctx.translate(-cx, -cy);   // squash the circle into a pool on the floor
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, 12 * S, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // The arrow: a chevron just beyond his toes, pointing the way to face.
      const ax = cx + g.d * 13 * S, ay = cy - 1.5 * S, w = 3 * S, h = 2.6 * S;
      ctx.strokeStyle = `rgba(${rgb},${g.lit ? 1 : 0.55 + 0.3 * pulse})`;
      ctx.lineWidth = Math.max(1, 1.1 * S); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(ax - g.d * w, ay - h); ctx.lineTo(ax, ay); ctx.lineTo(ax - g.d * w, ay + h); ctx.stroke();
    }
    ctx.restore();
  }
  // Once Eric is on a spot and facing the right way, ring what his shot will hit.
  drawGuideTargets(ctx, S) {
    if (!this.guide) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.lastDraw / 160);
    for (const g of this.guide) {
      if (!g.lit || !g.target) continue;
      const rgb = g.kind === 'pistol' ? '74,163,255' : '255,183,3';
      const [tx, ty] = g.target;
      ctx.save();
      ctx.strokeStyle = `rgba(${rgb},${0.65 + 0.35 * pulse})`;
      ctx.lineWidth = Math.max(1, 1.2 * S);
      ctx.beginPath(); ctx.arc(tx * S, ty * S, (7 + 1.5 * pulse) * S, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  // The same frame, drawn entirely with the original artwork.
  drawOriginal(cam) {
    const { ctx, game } = this;
    const o = this.original;
    const w = this.viewW;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, this.canvas.height);
    ctx.save();
    ctx.translate(-cam, 0);
    o.drawBackdrop(ctx, cam, w);
    o.drawFurniture(ctx, game);
    const viewFrom = cam - 32, viewTo = cam + w + 32;
    for (const d of game.cast.drawables) {
      if (!d.visible || d.x * C + 24 < viewFrom || d.x * C > viewTo) continue;
      const [x, y] = this.spritePos(d);
      if (!o.drawSprite(ctx, d.group, d.animatoryState, d.direction, Math.round(x), Math.round(y))) {
        ctx.drawImage(getSprite(d.group, d.animatoryState, d.direction, d.look), Math.round(x), Math.round(y));
      }
    }
    for (const c of game.cast.characterList) if (c.bubble) o.drawBubble(ctx, c);
    ctx.restore();
    if (game.messageBox) o.drawMessageBox(ctx, game.messageBox, cam, w);
    if (this.options.retroStatus) o.drawStatus(ctx, game, w);
  }

  // Recolour a sprite to a single ink, the way an 8-bit machine drew people.
  tinted(sprite, colour) {
    const t = this.tint.getContext('2d');
    t.clearRect(0, 0, 24, 32);
    t.globalCompositeOperation = 'source-over';
    t.drawImage(sprite, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = colour; t.fillRect(0, 0, 24, 32);
    return this.tint;
  }

  // The original's bottom three rows: score box, mice, inventory, lesson box, logo.
  drawStatus() {
    const { ctx, game, theme } = this;
    const top = this.viewH;          // directly under the picture, however tall the camera makes it
    const w = this.viewW;
    const rect = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, ww, hh); };
    rect(0, top, w, 3 * C, theme.statusPaper);
    // Score box: columns 0-7
    rect(0, top, 8 * C, 3 * C, theme.statusBox);
    const num = (n) => String(n).padStart(5, ' ');
    drawText(ctx, `Score${num(game.score)}`, 2, top + 1, theme.statusInk);
    drawText(ctx, `Lines${num(game.lines)}`, 2, top + 9, theme.statusLinesInk);
    drawText(ctx, `Hi-Sc${num(game.hiScore)}`, 2, top + 17, theme.statusInk);
    // Mice and pockets: columns 8-15
    const eric = game.cast.eric;
    if (eric.mice > 0) drawText(ctx, `${eric.mice} mice`, 8 * C + 2, top + 1, theme.statusInk);
    let ix = 8 * C + 2;
    for (const item of eric.inventory) { drawIcon(ctx, item, ix, top + 2 * C, theme); ix += 9; }
    // Lesson box: columns 16-23
    rect(16 * C, top, 8 * C, 3 * C, theme.statusBox);
    rect(16 * C + 1, top + 1, 8 * C - 2, 3 * C - 2, theme.lessonPaper);
    const { teacher, room } = game.lessonDescription();
    drawTextCentred(ctx, teacher, 20 * C, top + 4, theme.lessonInk);
    drawTextCentred(ctx, room, 20 * C, top + 13, theme.lessonInk);
    // Logo: columns 24-31 (or whatever is left)
    if (w >= 32 * C) {
      drawTextCentred(ctx, 'BACK TO', 28 * C, top + 3, theme.logoInk);
      drawTextCentred(ctx, 'SKOOL', 28 * C, top + 13, theme.logoInk2);
    }
  }

  drawFurniture(viewFrom, viewTo) {
    const { ctx, game, theme } = this;
    const rect = (x, y, w, h, colour) => { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); };
    // Doors
    for (const door of game.world.doors.values()) {
      if (door.id === 'DrinksCabinet') continue;
      const [cx, cy] = door.coords; const [w, h] = door.size;
      const x = cx * C, y = cy * C;
      if (door.id === 'SkoolGate') {
        // iron gate: bars when shut, swung open (thin) when open
        if (door.shut) { for (let i = 0; i < w * C; i += 4) rect(x + 4 + i, y, 2, h * C + 4, theme.gate); rect(x + 4, y + 2, w * C, 2, theme.gate); rect(x + 4, y + h * C - 4, w * C, 2, theme.gate); }
        else { rect(x + 2, y, 3, h * C + 4, theme.gate); }
        continue;
      }
      if (door.shut) {
        rect(x + 1, y, w * C - 2, h * C + 4, theme.door);
        rect(x + 3, y + 3, w * C - 6, h * C - 10, theme.doorDark);
        rect(x + w * C - 7, y + (h * C) / 2, 2, 2, '#e0c060');   // handle
      } else {
        rect(x + 1, y, 3, h * C + 4, theme.doorOpen);             // door edge seen side-on
      }
    }
    // Windows
    for (const win of game.world.windows.values()) {
      const [cx, cy] = win.coords; const [w, h] = win.size;
      const x = cx * C, y = cy * C;
      rect(x, y, w * C, h * C, theme.windowFrame);
      if (win.shut) { rect(x + 2, y + 2, w * C - 4, h * C - 4, theme.windowGlass); rect(x + w * C / 2 - 1, y, 2, h * C, theme.windowFrame); rect(x, y + h * C / 2 - 1, w * C, 2, theme.windowFrame); }
      else { rect(x + 2, y + 2, w * C - 4, h * C - 4, theme.sky[1]); rect(x + 2, y + 2, 3, h * C - 4, theme.windowGlass); }
    }
    // Drinks cabinet
    const cabinet = game.world.doors.get('DrinksCabinet');
    if (cabinet) {
      const x = cabinet.coords[0] * C, y = cabinet.coords[1] * C;
      rect(x - 2, y - 2, 20, 18, theme.deskDark);
      if (cabinet.shut) { rect(x, y, 16, 14, theme.desk); rect(x + 7, y, 2, 14, theme.deskDark); }
      else { rect(x, y, 16, 14, '#2a1a0a'); rect(x + 4, y + 3, 3, 9, '#b5651d'); rect(x + 10, y + 5, 3, 7, '#d4a24c'); }
    }
    // The safe
    const s = game.world.safe;
    rect(s.x * C - 2, s.y * C - 4, 20, 14, theme.safe);
    rect(s.x * C + 2, s.y * C - 1, 12, 8, '#3a3a44'); rect(s.x * C + 6, s.y * C + 2, 3, 3, '#c0c0c0');
    // Cups
    for (const cup of game.world.cups.values()) {
      const x = cup.x * C, y = cup.y * C;
      rect(x + 1, y + 2, 7, 5, theme.cup); rect(x + 8, y + 3, 1, 3, theme.cup);
      if (cup.contents === 'WATER') rect(x + 2, y + 1, 5, 2, theme.cupWater);
      else if (cup.contents === 'SHERRY') rect(x + 2, y + 1, 5, 2, theme.cupSherry);
      else if (cup.frogs.length) rect(x + 2, y, 5, 3, '#3e9b3e');
    }
    this.drawChalk();
    // Conker in the tree (when not falling)
    if (!game.cast.conker.visible) { rect(100 * C + 6, 3 * C + 2, 4, 4, '#6b3a1a'); rect(100 * C + 7, 3 * C + 2, 1, 1, '#d2a06a'); }
    // Chained bike leaning on the tree
    if (game.cast.bike.chained) { rect(97 * C, 20 * C - 2, 16, 4, '#444'); rect(97 * C + 2, 20 * C - 1, 12, 2, '#9a9a9a'); rect(96 * C + 4, 18 * C + 2, 2, 12, '#888'); }
  }

  // Chalk on the blackboards, and the columns a teacher has wiped so far.
  drawChalk() {
    const { ctx, game, theme } = this;
    for (const room of game.world.rooms.values()) {
      const b = room.blackboard;
      if (!b || !b.lines.length) continue;
      const x = b.x * C, y = b.y * C;
      // Clipped to the board: the stand-in font is wider than the Spectrum's, and a long word would run onto the wall.
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, b.width * C, b.height * C); ctx.clip();
      b.lines.forEach((line, i) => drawText(ctx, line, x + 2, y + 2 + i * LINE_HEIGHT, theme.chalk));
      ctx.restore();
      ctx.fillStyle = theme.blackboard;
      for (const col of b.wipedColumns) ctx.fillRect(x + col * C, y, C, b.height * C);
    }
  }

  drawBubble(c) {
    const { ctx, theme } = this;
    const b = c.bubble;
    const x = b.x * C, y = b.y * C;
    const w = 8 * C, h = 3 * C;
    const r = (xx, yy, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(xx, yy, ww, hh); };
    r(x + 1, y, w - 2, h - 4, theme.bubbleFill); r(x, y + 1, w, h - 6, theme.bubbleFill);
    // lip
    const lipX = x + b.lipPos * C + 2;
    r(lipX, y + h - 4, 4, 2, theme.bubbleFill); r(lipX + 1, y + h - 2, 2, 2, theme.bubbleFill);
    // Text scrolls leftwards in 8-pixel steps, exactly as the original did.
    const textWidth = measureText(b.words);
    const insetX = 4 - 8 * Math.min(0, b.shift);
    const textX = Math.max(0, b.shift) * 8;
    const width = Math.min(4 + 56 - insetX, textWidth - textX);
    if (width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(x + insetX, y + 4, width, 8); ctx.clip();
      drawText(ctx, b.words, x + insetX - textX, y + 5, theme.bubbleInk);
      ctx.restore();
    }
  }

  drawMessageBox(box, cam) {
    const { ctx, theme } = this;
    const lines = box.lines;
    const w = Math.max(8 * C, ...lines.map((l) => measureText(l) + 8));
    const h = lines.length * LINE_HEIGHT + 6;
    let x = box.x * C - cam + 4 - w / 2;
    let y = box.y * C - h - 2;
    x = Math.max(0, Math.min(this.viewW - w, x));
    y = Math.max(0, y);
    const paper = box.paper === 'eric' ? theme.boxEric : box.paper === 'other' ? theme.boxOther : box.paper === 'alarm' ? theme.boxAlarm : theme.boxSecret;
    const ink = box.paper === 'alarm' ? theme.boxInkAlarm : theme.boxInk;
    ctx.fillStyle = paper; ctx.fillRect(Math.round(x), Math.round(y), w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.round(x), Math.round(y), w, 1);
    lines.forEach((l, i) => drawTextCentred(ctx, l, Math.round(x + w / 2), Math.round(y + 3 + i * LINE_HEIGHT), ink));
  }
}

// Small 8x8 pictures for the pockets row of the retro status bar.
function drawIcon(ctx, item, x, y, theme) {
  const p = (dx, dy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x + dx, y + dy, w, h); };
  switch (item) {
    case 'SAFE_KEY': p(0, 3, 5, 2, '#f5d300'); p(4, 2, 3, 4, '#f5d300'); p(1, 5, 1, 2, '#f5d300'); p(3, 5, 1, 1, '#f5d300'); break;
    case 'STOREROOM_KEY': p(0, 3, 5, 2, theme.statusInk); p(4, 2, 3, 4, theme.statusInk); p(1, 5, 1, 2, theme.statusInk); break;
    case 'FROG': p(1, 3, 6, 4, '#00d700'); p(1, 2, 2, 1, '#00d700'); p(5, 2, 2, 1, '#00d700'); p(0, 7, 2, 1, '#00d700'); p(6, 7, 2, 1, '#00d700'); break;
    case 'WATER_PISTOL': p(0, 2, 7, 2, '#00d7d7'); p(1, 4, 2, 3, '#00d7d7'); break;
    case 'SHERRY_PISTOL': p(0, 2, 7, 2, '#d70000'); p(1, 4, 2, 3, '#d70000'); break;
    case 'STINKBOMBS3': p(0, 4, 2, 3, theme.statusInk); p(3, 4, 2, 3, theme.statusInk); p(6, 4, 2, 3, theme.statusInk); break;
    case 'STINKBOMBS2': p(0, 4, 2, 3, theme.statusInk); p(3, 4, 2, 3, theme.statusInk); break;
    case 'STINKBOMBS1': p(0, 4, 2, 3, theme.statusInk); break;
    default: break;
  }
}
