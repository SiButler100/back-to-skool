// ============================================================================
// SPRITES (painted, not loaded)
// ----------------------------------------------------------------------------
// Every character picture is drawn with rectangles on a 24x32 pixel grid and
// cached. That means no copyrighted artwork, and you can restyle the whole
// cast by changing a few colours in data/cast.js (the "look" fields) or the
// painting routines below.
//
// A sprite is 3 cells wide (24px) and 4 cells tall (32px). Adults fill the
// full height; children occupy the bottom 3 cells. All poses are painted
// facing RIGHT and flipped when the character faces left.
// ============================================================================

const SKIN = '#f1c6a0';
const SKIN_DARK = '#c9956e';
const INK = '#1a1a1a';

const cache = new Map();

// Group-level defaults: what each kind of character wears.
const WARDROBE = {
  ERIC:     { top: '#d8322a', bottoms: '#2b2b48', socks: '#f5f5f5', shoes: '#222' },
  BOY:      { top: '#2a4a9a', bottoms: '#3a3a3a', socks: '#dddddd', shoes: '#222' },
  SWOT:     { top: '#2f8f4f', bottoms: '#3a3a3a', socks: '#dddddd', shoes: '#222' },
  BULLY:    { top: '#6b3f1e', bottoms: '#2b2b2b', socks: '#dddddd', shoes: '#222' },
  TEARAWAY: { top: '#e0a030', bottoms: '#4a3a2a', socks: '#dddddd', shoes: '#222' },
  GIRL:     { top: '#2f7df6', bottoms: '#2f7df6', socks: '#ffffff', shoes: '#222' },
  HEROINE:  { top: '#e04070', bottoms: '#e04070', socks: '#ffffff', shoes: '#222' },
  WACKER:   { top: '#1b1b1b', bottoms: '#1b1b1b', socks: '#1b1b1b', shoes: '#000' },
  WITHIT:   { top: '#4b6b3a', bottoms: '#3a4a2a', socks: '#3a4a2a', shoes: '#222' },
  ROCKITT:  { top: '#f4f4f4', bottoms: '#4a4a5a', socks: '#4a4a5a', shoes: '#222' },
  CREAK:    { top: '#5a4a3a', bottoms: '#3a3028', socks: '#3a3028', shoes: '#222' },
  TAKE:     { top: '#7a2a7a', bottoms: '#7a2a7a', socks: '#f5f5f5', shoes: '#222' },
  ALBERT:   { top: '#6a5a3a', bottoms: '#4a4030', socks: '#4a4030', shoes: '#222' },
};

function px(ctx, x, y, w = 1, h = 1, colour) { ctx.fillStyle = colour; ctx.fillRect(x, y, w, h); }

// ---- Body parts --------------------------------------------------------------
// All coordinates are relative to the 24x32 box, figure facing right.

function head(ctx, x, y, look, adult) {
  // x,y = top-left of a 6-wide, 7-tall head
  const hair = look.hair || '#3a2a1a';
  px(ctx, x, y, 6, 2, hair);
  px(ctx, x, y + 2, 6, 5, SKIN);
  px(ctx, x, y + 2, 1, 3, hair);                    // hair down the back
  if (look.bun) px(ctx, x - 2, y + 1, 2, 3, hair);
  if (look.glasses) { px(ctx, x + 3, y + 3, 3, 1, INK); px(ctx, x + 3, y + 4, 1, 1, INK); px(ctx, x + 5, y + 4, 1, 1, INK); }
  else px(ctx, x + 4, y + 3, 1, 1, INK);            // eye
  if (look.beard) px(ctx, x + 2, y + 6, 4, 2, hair);
  if (look.mortarboard) { px(ctx, x - 2, y - 1, 10, 1, INK); px(ctx, x - 1, y, 8, 1, INK); px(ctx, x + 7, y - 1, 1, 3, INK); }
  if (look.cap) { px(ctx, x - 1, y, 8, 1, '#3a3a3a'); px(ctx, x + 5, y + 1, 3, 1, '#3a3a3a'); }
  if (look.scruffy) { px(ctx, x + 1, y - 1, 1, 1, hair); px(ctx, x + 4, y - 1, 1, 1, hair); }
  if (adult && look.hair === '#dddddd') px(ctx, x + 1, y, 4, 1, SKIN); // balding head
}

function torso(ctx, x, y, w, h, colour) { px(ctx, x, y, w, h, colour); }

function arm(ctx, x, y, pose, colour) {
  // pose: 'down' | 'back' | 'fwd' | 'up' | 'out' (horizontal) | 'half'
  switch (pose) {
    case 'down': px(ctx, x, y, 2, 7, colour); px(ctx, x, y + 7, 2, 2, SKIN); break;
    case 'back': px(ctx, x - 1, y, 2, 5, colour); px(ctx, x - 2, y + 4, 2, 3, colour); px(ctx, x - 2, y + 7, 2, 2, SKIN); break;
    case 'fwd': px(ctx, x, y, 2, 4, colour); px(ctx, x + 1, y + 3, 2, 4, colour); px(ctx, x + 2, y + 7, 2, 2, SKIN); break;
    case 'up': px(ctx, x + 1, y - 6, 2, 7, colour); px(ctx, x + 1, y - 8, 2, 2, SKIN); break;
    case 'out': px(ctx, x + 1, y + 1, 6, 2, colour); px(ctx, x + 7, y + 1, 2, 2, SKIN); break;
    case 'half': px(ctx, x + 1, y, 2, 3, colour); px(ctx, x + 3, y - 1, 3, 2, colour); px(ctx, x + 6, y - 1, 2, 2, SKIN); break;
    default: break;
  }
}

function legs(ctx, x, y, pose, w, h, colours) {
  // Two legs starting at (x, y); each leg 3 wide. pose: 'together' | 'apart' | 'apart2' | 'sit' | 'floor'
  const { bottoms, socks, shoes } = colours;
  const sockH = 2;
  if (pose === 'together') {
    px(ctx, x, y, 3, h - sockH - 2, bottoms); px(ctx, x + 4, y, 3, h - sockH - 2, bottoms);
    px(ctx, x, y + h - sockH - 2, 3, sockH, socks); px(ctx, x + 4, y + h - sockH - 2, 3, sockH, socks);
    px(ctx, x - 1, y + h - 2, 4, 2, shoes); px(ctx, x + 4, y + h - 2, 4, 2, shoes);
  } else if (pose === 'apart' || pose === 'apart2') {
    const spread = pose === 'apart' ? 3 : 2;
    // back leg slants left, front leg slants right
    for (let i = 0; i < h - 2; i++) {
      const t = i / (h - 2);
      const bx = x - Math.round(t * spread), fx = x + 4 + Math.round(t * spread);
      const c = i >= h - sockH - 2 ? socks : bottoms;
      px(ctx, bx, y + i, 3, 1, c); px(ctx, fx, y + i, 3, 1, c);
    }
    px(ctx, x - spread - 1, y + h - 2, 4, 2, shoes); px(ctx, x + 4 + spread, y + h - 2, 4, 2, shoes);
  }
}

// Draw a seated lower body: thighs forward, shins down.
function seated(ctx, x, y, colours) {
  const { bottoms, socks, shoes } = colours;
  px(ctx, x, y, 8, 3, bottoms);             // thighs
  px(ctx, x + 5, y + 3, 3, 3, bottoms);     // shins
  px(ctx, x + 5, y + 6, 3, 2, socks);
  px(ctx, x + 5, y + 8, 4, 2, shoes);
}

// ---- Poses -------------------------------------------------------------------

function paintStanding(ctx, look, group, adult, walkPhase, armPose) {
  const wd = WARDROBE[group] || WARDROBE.BOY;
  const colours = { bottoms: wd.bottoms, socks: wd.socks, shoes: wd.shoes };
  const top = look.suit || look.dress || wd.top;
  const female = !!look.dress;
  if (adult) {
    head(ctx, 9, 1, look, true);
    px(ctx, 11, 8, 2, 1, SKIN);                           // neck
    if (look.gown) px(ctx, 6, 9, 12, 13, top);            // academic gown
    torso(ctx, 8, 9, 8, 11, top);
    if (look.labcoat) { px(ctx, 11, 9, 1, 11, '#cfcfcf'); px(ctx, 8, 9, 8, 13, '#f4f4f4'); px(ctx, 11, 9, 1, 13, '#cfcfcf'); }
    if (look.stoop) px(ctx, 9, 8, 6, 2, top);
    if (female) px(ctx, 7, 18, 10, 6, top);               // skirt
    // arms
    arm(ctx, 6, 10, walkPhase === 1 ? 'fwd' : (walkPhase === 3 ? 'back' : 'down'), top);
    arm(ctx, 16, 10, armPose || (walkPhase === 1 ? 'back' : (walkPhase === 3 ? 'fwd' : 'down')), top);
    const legPose = walkPhase === 1 ? 'apart' : (walkPhase === 3 ? 'apart2' : 'together');
    legs(ctx, 9, female ? 24 : 20, legPose, 3, female ? 8 : 12, colours);
  } else {
    head(ctx, 9, 9, look, false);
    px(ctx, 11, 16, 2, 1, SKIN);
    torso(ctx, 8, 17, 8, 7, top);
    if (female) { px(ctx, 7, 21, 10, 4, top); }
    if (look.big) { px(ctx, 7, 17, 10, 7, top); }
    arm(ctx, 6, 18, walkPhase === 1 ? 'fwd' : (walkPhase === 3 ? 'back' : 'down'), top);
    arm(ctx, 16, 18, armPose || (walkPhase === 1 ? 'back' : (walkPhase === 3 ? 'fwd' : 'down')), top);
    const legPose = walkPhase === 1 ? 'apart' : (walkPhase === 3 ? 'apart2' : 'together');
    legs(ctx, 9, female ? 25 : 24, legPose, 3, female ? 7 : 8, colours);
    if (!female) px(ctx, 8, 24, 8, 1, wd.bottoms); // shorts line
  }
}

function paintSittingOnChair(ctx, look, group, adult) {
  const wd = WARDROBE[group] || WARDROBE.BOY;
  const top = look.suit || look.dress || wd.top;
  const dy = adult ? 0 : 4;
  head(ctx, 9, 13 - dy + (adult ? 0 : 0), look, adult);
  px(ctx, 11, 20 - dy, 2, 1, SKIN);
  torso(ctx, 8, 21 - dy, 8, 5, top);
  arm(ctx, 16, 22 - dy, 'fwd', top);
  seated(ctx, 9, 22, { bottoms: wd.bottoms, socks: wd.socks, shoes: wd.shoes });
}

function paintSittingOnFloor(ctx, look, group, adult) {
  const wd = WARDROBE[group] || WARDROBE.BOY;
  const top = look.suit || look.dress || wd.top;
  head(ctx, 8, 14, look, adult);
  px(ctx, 10, 21, 2, 1, SKIN);
  torso(ctx, 7, 22, 8, 6, top);
  arm(ctx, 5, 23, 'down', top);
  px(ctx, 13, 26, 9, 3, wd.bottoms);     // legs out along the floor
  px(ctx, 20, 25, 3, 2, wd.socks);
  px(ctx, 21, 27, 3, 3, wd.shoes);
}

function paintKnockedOut(ctx, look, group, adult) {
  const wd = WARDROBE[group] || WARDROBE.BOY;
  const top = look.suit || look.dress || wd.top;
  if (adult) {
    // Adults sit up, dazed, legs splayed
    head(ctx, 7, 12, look, true);
    px(ctx, 9, 19, 2, 1, SKIN);
    torso(ctx, 6, 20, 8, 7, top);
    px(ctx, 13, 25, 10, 3, wd.bottoms);
    px(ctx, 21, 24, 3, 4, wd.shoes);
    px(ctx, 3, 9, 1, 1, '#ffd700'); px(ctx, 13, 9, 1, 1, '#ffd700'); px(ctx, 8, 7, 1, 1, '#ffd700'); // stars
  } else {
    // Kids lie flat
    px(ctx, 0, 26, 6, 5, look.hair || '#3a2a1a');
    px(ctx, 1, 27, 5, 4, SKIN);
    px(ctx, 6, 26, 9, 5, top);
    px(ctx, 15, 27, 5, 4, wd.bottoms);
    px(ctx, 20, 28, 4, 3, wd.shoes);
    px(ctx, 3, 24, 1, 1, '#ffd700'); px(ctx, 6, 22, 1, 1, '#ffd700');
  }
}

function paintBending(ctx, look, group) {
  const wd = WARDROBE[group] || WARDROBE.BOY;
  const top = wd.top;
  // body tilted forward, head low at the front, hand reaching to the floor
  px(ctx, 8, 21, 8, 4, top);
  px(ctx, 12, 19, 6, 3, top);
  head(ctx, 15, 14, look, false);
  px(ctx, 17, 22, 2, 6, top); px(ctx, 18, 28, 2, 3, SKIN);
  legs(ctx, 8, 24, 'together', 3, 8, { bottoms: wd.bottoms, socks: wd.socks, shoes: wd.shoes });
}

function paintRidingBike(ctx, look, group, phase) {
  const wd = WARDROBE[group] || WARDROBE.BOY;
  // Bike frame
  px(ctx, 3, 27, 2, 5, '#444'); px(ctx, 2, 28, 4, 3, '#444'); px(ctx, 18, 27, 2, 5, '#444'); px(ctx, 17, 28, 4, 3, '#444');
  px(ctx, 4, 29, 1, 1, '#aaa'); px(ctx, 19, 29, 1, 1, '#aaa');
  px(ctx, 5, 25, 13, 1, '#c33'); px(ctx, 11, 22, 1, 4, '#c33'); px(ctx, 17, 22, 1, 4, '#c33'); px(ctx, 16, 21, 4, 1, '#333');
  px(ctx, 9, 21, 4, 1, '#222');   // saddle
  // Rider
  head(ctx, 10, 7, look, false);
  px(ctx, 12, 14, 2, 1, SKIN);
  px(ctx, 9, 15, 8, 6, wd.top);
  px(ctx, 16, 16, 3, 2, wd.top); px(ctx, 18, 18, 2, 3, wd.top); px(ctx, 18, 21, 2, 1, SKIN);
  // pedalling legs
  if (phase === 0) { px(ctx, 11, 21, 3, 4, wd.bottoms); px(ctx, 13, 24, 2, 3, wd.socks); px(ctx, 12, 27, 4, 2, wd.shoes); }
  else { px(ctx, 11, 21, 3, 3, wd.bottoms); px(ctx, 9, 23, 3, 3, wd.socks); px(ctx, 8, 25, 4, 2, wd.shoes); }
}

function paintKissing(ctx, look, group) {
  // Hayley and Eric together
  const wd = WARDROBE.HEROINE;
  head(ctx, 3, 9, look, false); px(ctx, 5, 16, 2, 1, SKIN);
  px(ctx, 2, 17, 8, 7, wd.top); px(ctx, 1, 21, 10, 4, wd.top);
  legs(ctx, 3, 25, 'together', 3, 7, { bottoms: wd.bottoms, socks: wd.socks, shoes: wd.shoes });
  const ew = WARDROBE.ERIC;
  head(ctx, 15, 9, { hair: '#c07030' }, false); px(ctx, 17, 16, 2, 1, SKIN);
  px(ctx, 14, 17, 8, 7, ew.top);
  legs(ctx, 15, 24, 'together', 3, 8, { bottoms: ew.bottoms, socks: ew.socks, shoes: ew.shoes });
  px(ctx, 11, 7, 1, 1, '#ff2d55'); px(ctx, 12, 6, 1, 1, '#ff2d55'); px(ctx, 13, 7, 1, 1, '#ff2d55'); px(ctx, 12, 8, 1, 1, '#ff2d55');
}

// ---- Objects -----------------------------------------------------------------
function paintObject(ctx, group, state) {
  switch (state) {
    case 'FLY': px(ctx, 8, 8, 2, 2, '#222'); break;                            // pellet at hit point (1,1) cell
    case 'WATER0': case 'WATER1': case 'WATER2': case 'WATER3': case 'WATER4': {
      const drops = { WATER0: [[4, 14], [8, 12]], WATER1: [[2, 12], [6, 10], [10, 8]], WATER2: [[2, 8], [8, 7], [14, 8]], WATER3: [[6, 8], [10, 10]], WATER4: [[8, 10], [8, 14], [9, 18]] };
      for (const [x, y] of drops[state]) px(ctx, x, y, 2, 2, '#4aa3ff');
      break;
    }
    case 'WATER_DROP': px(ctx, 8, 25, 2, 3, '#4aa3ff'); px(ctx, 9, 24, 1, 1, '#4aa3ff'); break;
    case 'SHERRY_DROP': px(ctx, 8, 25, 2, 3, '#b5651d'); px(ctx, 9, 24, 1, 1, '#b5651d'); break;
    case 'CONKER': px(ctx, 8, 24, 3, 3, '#6b3a1a'); px(ctx, 9, 24, 1, 1, '#d2a06a'); break;
    case 'RUN': px(ctx, 8, 27, 7, 3, '#8a8a8a'); px(ctx, 14, 26, 3, 3, '#8a8a8a'); px(ctx, 15, 25, 1, 1, '#f0a0a0'); px(ctx, 16, 27, 1, 1, '#000'); px(ctx, 4, 28, 4, 1, '#8a8a8a'); break;
    case 'SIT': px(ctx, 8, 26, 8, 4, '#3e9b3e'); px(ctx, 13, 24, 4, 3, '#3e9b3e'); px(ctx, 15, 24, 1, 1, '#000'); px(ctx, 6, 29, 3, 2, '#3e9b3e'); break;
    case 'HOP1': px(ctx, 8, 23, 8, 4, '#3e9b3e'); px(ctx, 14, 21, 4, 3, '#3e9b3e'); px(ctx, 16, 21, 1, 1, '#000'); px(ctx, 5, 27, 4, 2, '#3e9b3e'); px(ctx, 15, 27, 3, 3, '#3e9b3e'); break;
    case 'HOP2': px(ctx, 8, 20, 8, 4, '#3e9b3e'); px(ctx, 14, 18, 4, 3, '#3e9b3e'); px(ctx, 16, 18, 1, 1, '#000'); px(ctx, 4, 25, 5, 2, '#3e9b3e'); px(ctx, 16, 25, 3, 3, '#3e9b3e'); break;
    case 'STINKBOMB': {
      for (const [x, y, w] of [[6, 20, 4], [10, 17, 6], [15, 19, 5], [8, 23, 9], [4, 25, 4], [16, 24, 5]]) px(ctx, x, y, w, 3, 'rgba(120,160,60,0.75)');
      px(ctx, 11, 28, 3, 3, '#333');
      break;
    }
    case 'DESK_EMPTY': case 'DESK_WATER_PISTOL': case 'DESK_STINKBOMBS':
      px(ctx, 4, 20, 14, 2, '#9a6a3c'); px(ctx, 5, 14, 2, 7, '#9a6a3c'); px(ctx, 4, 13, 14, 1, '#6a4524'); // lid up
      if (state === 'DESK_WATER_PISTOL') { px(ctx, 9, 17, 6, 2, '#2a6fd6'); px(ctx, 9, 19, 2, 2, '#2a6fd6'); }
      if (state === 'DESK_STINKBOMBS') { px(ctx, 8, 17, 3, 3, '#333'); px(ctx, 12, 17, 3, 3, '#333'); }
      break;
    case 'BIKE_ON_FLOOR':
      px(ctx, 2, 26, 8, 5, '#444'); px(ctx, 3, 27, 6, 3, '#9a9a9a'); px(ctx, 14, 26, 8, 5, '#444'); px(ctx, 15, 27, 6, 3, '#9a9a9a'); px(ctx, 8, 28, 8, 1, '#c33'); px(ctx, 10, 25, 4, 1, '#222');
      break;
    case 'BIKE_UPRIGHT':
      px(ctx, 3, 27, 2, 5, '#444'); px(ctx, 2, 28, 4, 3, '#444'); px(ctx, 18, 27, 2, 5, '#444'); px(ctx, 17, 28, 4, 3, '#444');
      px(ctx, 5, 25, 13, 1, '#c33'); px(ctx, 11, 22, 1, 4, '#c33'); px(ctx, 17, 22, 1, 4, '#c33'); px(ctx, 16, 21, 4, 1, '#333'); px(ctx, 9, 21, 4, 1, '#222');
      break;
    case 'PLANT_GROWING': px(ctx, 10, 24, 4, 7, '#2f8f2f'); px(ctx, 7, 22, 5, 3, '#3fa33f'); px(ctx, 12, 20, 5, 3, '#3fa33f'); break;
    case 'PLANT_GROWN': px(ctx, 10, 8, 4, 23, '#2f8f2f'); px(ctx, 5, 10, 6, 4, '#3fa33f'); px(ctx, 13, 6, 6, 4, '#3fa33f'); px(ctx, 6, 18, 5, 3, '#3fa33f'); px(ctx, 13, 15, 6, 3, '#3fa33f'); px(ctx, 9, 4, 6, 4, '#ff6b9d'); break;
    default: break;
  }
}

// ---- Public API --------------------------------------------------------------

// Returns a cached 24x32 canvas for this character/state/direction.
export function getSprite(group, state, direction, look = {}) {
  const key = `${group}|${state}|${direction}|${JSON.stringify(look)}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 24; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (direction < 0) { ctx.translate(24, 0); ctx.scale(-1, 1); }
  paint(ctx, group, state, look);
  cache.set(key, canvas);
  return canvas;
}

const PEOPLE = new Set(Object.keys(WARDROBE));
const ADULTS = new Set(['WACKER', 'WITHIT', 'ROCKITT', 'CREAK', 'TAKE', 'ALBERT']);

function paint(ctx, group, state, look) {
  if (!PEOPLE.has(group)) return paintObject(ctx, group, state);
  const adult = ADULTS.has(group);
  switch (state) {
    case 'WALK0': return paintStanding(ctx, look, group, adult, 0);
    case 'WALK1': return paintStanding(ctx, look, group, adult, 1);
    case 'WALK2': return paintStanding(ctx, look, group, adult, 2);
    case 'WALK3': return paintStanding(ctx, look, group, adult, 3);
    case 'ARM_UP': return paintStanding(ctx, look, group, adult, 0, 'up');
    case 'HITTING0': return paintStanding(ctx, look, group, adult, 0, 'half');
    case 'HITTING1': return paintStanding(ctx, look, group, adult, 0, 'out');
    case 'CATAPULT0': paintStanding(ctx, look, group, adult, 0, 'half'); px(ctx, 22, 17, 1, 3, '#8a5a2a'); return;
    case 'CATAPULT1': paintStanding(ctx, look, group, adult, 0, 'out'); px(ctx, 23, 16, 1, 5, '#8a5a2a'); px(ctx, 22, 17, 1, 1, '#8a5a2a'); return;
    case 'WATERPISTOL': paintStanding(ctx, look, group, adult, 0, 'out'); px(ctx, 22, 17, 2, 2, '#2a6fd6'); px(ctx, 23, 19, 1, 2, '#2a6fd6'); return;
    case 'SITTING_ON_CHAIR': return paintSittingOnChair(ctx, look, group, adult);
    case 'SITTING_ON_FLOOR': return paintSittingOnFloor(ctx, look, group, adult);
    case 'KNOCKED_OUT': case 'KNOCKED_OVER': return paintKnockedOut(ctx, look, group, adult);
    case 'BENDING_OVER': return paintBending(ctx, look, group);
    case 'RIDING_BIKE0': return paintRidingBike(ctx, look, group, 0);
    case 'RIDING_BIKE1': return paintRidingBike(ctx, look, group, 1);
    case 'KISSING_ERIC': return paintKissing(ctx, look, group);
    default: return paintStanding(ctx, look, group, adult, 0);
  }
}

export function clearSpriteCache() { cache.clear(); }
