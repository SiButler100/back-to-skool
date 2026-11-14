// ============================================================================
// MOTION (turning the engine's cell-sized steps into steady movement)
// ----------------------------------------------------------------------------
// The engine is a faithful port of the 1985 game: people stand on a grid of
// 8-pixel cells and jump from one to the next a few times a second. Drawn as
// it is, that looks like lurch-stop-lurch. This module sits between the
// engine and the painters and works out, for every frame, where each thing
// should APPEAR to be:
//
//   * a walker glides at a constant speed, because we know how many ticks the
//     engine will wait before its next step (its walkDelay) and spread the
//     move over exactly that long;
//   * halfway through a stride (the engine's WALK1 and WALK3 states) the
//     engine has not moved yet but certainly will, so we already head for the
//     half-way point: the picture starts moving the moment a key is pressed;
//   * which walk-cycle picture to show comes from the distance covered, so
//     feet stay planted instead of sliding;
//   * a change of pose (sitting down, a punch, a fall) is played through one
//     or two in-between pictures (crouching on the way to a chair, tipping
//     over on the way to the floor); where a character has no such pictures
//     the old pose is reported for a moment so the painter can blend the two;
//   * Eric's jump rises fast and slows at the top, like a real one.
//
// Nothing here changes the game: the engine never reads these numbers.
// ============================================================================

const WALK_STATES = new Set(['WALK0', 'WALK1', 'WALK2', 'WALK3']);
const CYCLE_FRAMES = 8;        // pictures in one walk cycle (two steps)
const CYCLE_CELLS = 2;         // cells covered by one cycle: the engine's own four walk states
const FADE_MS = 110;           // how long a change of pose is blended
const SNAP_CELLS = 2.5;        // further than this in one go is a teleport, not a walk
const SLACK_MS = 28;           // aim to arrive a frame or two late: steps then join without a pause even when a tick lands a frame late

// ---- In-between poses -------------------------------------------------------------
// For a change from one pose to another, the pictures to pass through on the
// way. 'STAND' means any of the engine's four walk states. The names on the
// right are extra frames in each character's sheet (assets/illustrated).
const SEQUENCES = {
  'STAND>SITTING_ON_CHAIR': ['SIT_A', 'SIT_B'],
  'SITTING_ON_CHAIR>STAND': ['SIT_B', 'SIT_A'],
  'STAND>SITTING_ON_FLOOR': ['SIT_A', 'SIT_B'],
  'SITTING_ON_FLOOR>STAND': ['RISE', 'SIT_A'],
  'STAND>KNOCKED_OUT': ['FALL_A', 'FALL_B'],
  'SITTING_ON_CHAIR>KNOCKED_OUT': ['FALL_B'],
  'SITTING_ON_FLOOR>KNOCKED_OUT': ['FALL_B'],
  'KNOCKED_OUT>STAND': ['SITTING_ON_FLOOR', 'RISE'],
  'STAND>KNOCKED_OVER': ['FALL_A', 'FALL_B'],
  'KNOCKED_OVER>STAND': ['FALL_B', 'FALL_A'],
  'STAND>HITTING0': ['HITTING_A'],
  'HITTING0>HITTING1': ['HITTING_B'],
  'HITTING1>STAND': ['HITTING_B'],
  'STAND>ARM_UP': ['ARM_UP_A'],
  'ARM_UP>STAND': ['ARM_UP_A'],
  'STAND>CATAPULT0': ['CATAPULT_A'],
  'CATAPULT1>STAND': ['CATAPULT_A'],
  'STAND>BENDING_OVER': ['BENDING_A'],
  'BENDING_OVER>STAND': ['BENDING_A'],
  'STAND>WATERPISTOL': ['WATERPISTOL_A'],
  'WATERPISTOL>STAND': ['WATERPISTOL_A'],
};
// How long each picture of a sequence is held: falls and sitting are
// unhurried, a punch or a raised arm is over in a blink.
const STEP_MS = 72, QUICK_STEP_MS = 44;
const QUICK = /HITTING|ARM_UP|CATAPULT|WATERPISTOL|BENDING/;
const poseKind = (state) => (WALK_STATES.has(state) ? 'STAND' : state);

const easeOut = (k) => 1 - (1 - k) * (1 - k);
const easeIn = (k) => k * k;

export class Motion {
  constructor() {
    this.tracks = new Map();    // thing id -> what we remember about it
    this.now = 0; this.tickMs = 50;
  }

  // Call once per frame before sampling anything.
  begin(now, tickMs) { this.now = now; this.tickMs = tickMs; }

  clear() { this.tracks.clear(); }

  // Where `thing` should be drawn this frame. Positions are in cells
  // (fractions allowed). `smooth` off gives the engine's own position.
  sample(thing, smooth = true) {
    const now = this.now;
    const state = thing.animatoryState;
    const walkState = WALK_STATES.has(state);
    let tr = this.tracks.get(thing.id);
    if (!tr) {
      tr = { x: thing.x, y: thing.y, fromX: thing.x, fromY: thing.y, toX: thing.x, toY: thing.y, t0: now, dur: 1, ease: null,
        strideX: thing.x, strideY: thing.y, state, prevState: null, prevDir: thing.direction, stateT: -1e9, seen: now, frame: -1, out: null };
      this.tracks.set(thing.id, tr);
    }
    if (tr.frame === now && tr.out) return tr.out;      // already worked out this frame

    // ---- Where the engine says it is, or is about to be -----------------------
    let tx = thing.x, ty = thing.y;
    const midstride = walkState && (state === 'WALK1' || state === 'WALK3');
    if (midstride && smooth) {
      // The stride will end one cell on (and a step up or down on stairs).
      const endX = thing.x + thing.direction, endY = thing.y + (thing.verticalDirection || 0);
      tx = (tr.strideX + endX) / 2; ty = (tr.strideY + endY) / 2;
    } else {
      tr.strideX = thing.x; tr.strideY = thing.y;
    }

    // ---- Glide towards it ------------------------------------------------------
    const far = Math.abs(tr.x - tx) > SNAP_CELLS || Math.abs(tr.y - ty) > SNAP_CELLS;
    if (!smooth || !thing.visible || far || now - tr.seen > 500) {
      tr.x = tr.fromX = tr.toX = tx; tr.y = tr.fromY = tr.toY = ty; tr.t0 = now; tr.dur = 1;
      if (far || now - tr.seen > 500) { tr.strideX = thing.x; tr.strideY = thing.y; }
    } else {
      if (tx !== tr.toX || ty !== tr.toY) {
        // The engine moved some time between the last frame and this one, so
        // the new leg starts at the last frame: this frame already advances.
        const start = Math.max(tr.seen, now - 34);
        const sinceLast = start - tr.t0;
        tr.fromX = tr.x; tr.fromY = tr.y; tr.toX = tx; tr.toY = ty; tr.t0 = start;
        if (walkState) {
          tr.dur = Math.max(1, thing.walkDelay || 1) * this.tickMs + SLACK_MS; tr.ease = null;
        } else {
          // Not walking: spread the move over the gap since the last one (a
          // flying pellet moves every tick, a bike every few).
          tr.dur = Math.min(4 * this.tickMs, Math.max(this.tickMs, sinceLast)) + SLACK_MS;
          const straightUpOrDown = tx === tr.fromX && thing.group !== 'OBJ';
          tr.ease = straightUpOrDown ? (ty < tr.fromY ? easeOut : easeIn) : null;
          if (tr.ease) tr.dur = 3 * this.tickMs;
        }
      }
      let k = Math.min(1, (now - tr.t0) / tr.dur);
      if (tr.ease) k = tr.ease(k);
      tr.x = tr.fromX + (tr.toX - tr.fromX) * k;
      tr.y = tr.fromY + (tr.toY - tr.fromY) * k;
    }
    tr.seen = now;

    // ---- Pose changes ----------------------------------------------------------
    if (state !== tr.state) {
      const bothWalking = walkState && WALK_STATES.has(tr.state);
      if (!bothWalking && thing.visible) {
        tr.prevState = tr.state; tr.prevDir = tr.dir ?? thing.direction; tr.stateT = now;
        // Is there a run of in-between pictures for this change?
        const mids = smooth ? SEQUENCES[`${poseKind(tr.state)}>${poseKind(state)}`] : null;
        tr.seq = mids ? { frames: [WALK_STATES.has(tr.state) ? 'WALK0' : tr.state, ...mids, null], t0: now, step: QUICK.test(mids[0]) ? QUICK_STEP_MS : STEP_MS, needs: mids[0] } : null;
      }
      tr.state = state;
    }
    // Where we are in that run: picture `a`, turning into picture `b` (null
    // means "whatever pose the engine says now") by fraction `k`.
    let seq = null;
    if (tr.seq) {
      const at = (now - tr.seq.t0) / tr.seq.step, i = Math.floor(at);
      if (i >= tr.seq.frames.length - 1) tr.seq = null;
      else seq = { a: tr.seq.frames[i], b: tr.seq.frames[i + 1], k: at - i, needs: tr.seq.needs };
    }
    tr.dir = thing.direction;
    const fadeK = (now - tr.stateT) / FADE_MS;
    const fade = smooth && fadeK < 1 && tr.prevState ? { state: tr.prevState, direction: tr.prevDir, k: Math.max(0, fadeK) } : null;

    // ---- Walk cycle ------------------------------------------------------------
    const moving = tr.x !== tr.toX || tr.y !== tr.toY || midstride;
    const phase = ((((tr.x * thing.direction) % CYCLE_CELLS) + CYCLE_CELLS) % CYCLE_CELLS) / CYCLE_CELLS;
    const cycle = Math.round(phase * CYCLE_FRAMES) % CYCLE_FRAMES;

    tr.frame = now;
    tr.out = { x: tr.x, y: tr.y, walkState, moving, walking: walkState && moving, cycle, fade, seq };
    return tr.out;
  }
}
