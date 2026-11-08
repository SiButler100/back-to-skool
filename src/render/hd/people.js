// ============================================================================
// PEOPLE (HD pixel-art bodies, built from parts)
// ----------------------------------------------------------------------------
// A person is composed from layers: back arm, legs, (gown), torso, head, hat
// or glasses, front arm, and any prop (catapult, water pistol). Each pose in
// POSES lists its parts; each body type supplies its own versions:
//
//   kid    boys, Eric, Boy Wander, Angelface, Einstein   rows 16-63
//   girl   the seven girls and Hayley (a dress)          rows 16-63
//   adult  the four masters and Albert                   rows 0-63
//   woman  Miss Take (a dress and a bun)                 rows 0-63
//
// Colours come from the slots in pixelart.js (t top, p bottoms, h hair, k
// socks, o shoes, e accent), so one set of pictures dresses the whole school;
// the per-character "look" fields in data/cast.js add glasses, beards, hats.
//
// Frame: 48 x 64, facing right. Feet are always on row 63.
// ============================================================================

import { layer, Grid } from './pixelart.js';
import { ADULTS, PEOPLE } from './palette.js';

// ---- Heads -------------------------------------------------------------------------

// 14 wide, 16 tall: hair, face with an eye, nose, mouth and ear, then the neck.
const HEAD = `
  ....hhhhhhh...
  ..hhhhhhhhhhh.
  .hhhhhhhhhhhhh
  .hhhhhhhhhhhhh
  .hhhhhhhhhhhhh
  .hhiTSSShhhSSS
  .hhiTSSSSSSSSS
  .hhiTSSSSKKSSS
  .hTiTSSSSKKSSS
  .hTiTSSSSSSSTS
  ..hiTSSSSSSSSS
  ...TSSSSSKKSSS
  ....TSSSSSSSS.
  .....TTTTTTT..
  ......SSSS....
  ......SSSS....
`;
// A longer, squarer face for grown-ups.
const HEAD_ADULT = `
  ....hhhhhhh...
  ..hhhhhhhhhhh.
  .hhhhhhhhhhhhh
  .hhhhhhhhhhhhh
  .hhiTSSSSSSSSS
  .hhiTSSSSSSSSS
  .hhiTSSSSSSSSS
  .hhiTSSSSKKSSS
  .hTiTSSSSKKSSS
  .hTiTSSSSSSSTS
  ..hiTSSSSSSSSS
  ..hiTSSSSSSSSS
  ...TSSSSSKKSSS
  ....TSSSSSSSS.
  .....TTTTTTT..
  ......SSSS....
`;
const KID_HEAD = layer(17, 16, HEAD, 'kid head');
const ADULT_HEAD = layer(17, 2, HEAD_ADULT, 'adult head');

// Accessories sit on the head; positions are for the kid head (y 16) and are
// shifted by the body's head offset for adults.
const ACCESSORY = {
  glasses: layer(21, 22, `
    KKKKKKKKK
    ....K...K
    ....K...K
    ....KKKKK
  `, 'glasses'),
  beard: layer(20, 26, `
    .hhhhhhhhhh
    hhhhhhhhhhh
    .hhhhhhhhh.
    ..hhhhhhh..
    ...hhhhh...
  `, 'beard'),
  mortarboard: layer(11, 14, `
    KKKKKKKKKKKKKKKKKKKKKKK
    KKKKKKKKKKKKKKKKKKKKKKX
    .....KKKKKKKKKKKKK....X
    .....KKKKKKKKKKKKK....X
    ......................X
  `, 'mortarboard'),
  cap: layer(16, 15, `
    ...DDDDDDDDDDD..
    .DDDDDDDDDDDDDD.
    DDDDDDDDDDDDDDDD
    ..........DDDDDDD
  `.replace(/^\s+/gm, (m) => m).split('\n').filter((l) => l.trim()).map((l) => l.trim().padEnd(17, '.')), 'cap'),
  bun: layer(12, 20, `
    .hhh
    hhhh
    hhhh
    .hhh
  `, 'bun'),
  scruffy: layer(18, 14, `
    .h..h..h..h.
    hh.hh.hh.hh.
  `, 'scruffy'),
};

// ---- Clothes -----------------------------------------------------------------------

// A shirt or jacket, `width` wide and `height` tall, with a collar accent.
function shirt(height, width = 18, { lapels = false, buttons = false, coat = false } = {}) {
  const g = new Grid(width, height);
  const body = coat ? 'W' : 't', edge = coat ? 'G' : 'u';
  g.rect(4, 0, width - 8, 1, body);
  g.rect(2, 1, width - 4, 1, body);
  g.rect(1, 2, width - 2, height - 3, body);
  g.vline(1, 2, height - 3, edge);
  g.rect(2, height - 1, width - 4, 1, edge);
  const mid = Math.floor(width / 2);
  if (lapels || coat) {
    // an open front showing the shirt and tie
    g.rect(mid - 2, 1, 4, 2, 'W'); g.rect(mid - 1, 3, 2, 5, 'W');
    g.rect(mid - 1, 2, 2, 1, 'e'); g.rect(mid - 1, 3, 1, 6, 'e');
    if (coat) { g.rect(mid - 1, 3, 2, height - 4, 't'); g.vline(mid, 3, height - 4, 'e'); }
    else if (buttons) for (let y = 10; y < height - 2; y += 4) g.set(mid, y, 'e');
  } else {
    g.rect(mid - 1, 1, 2, 2, 'e');
  }
  return g.rows();
}
const KID_TORSO = layer(15, 32, shirt(16), 'kid torso');
const KID_TORSO_BIG = layer(14, 32, shirt(16, 20), 'kid torso big');
const KID_TORSO_SHORT = layer(15, 32, shirt(12), 'kid torso short');
const ADULT_TORSO = layer(15, 16, shirt(24, 18, { lapels: true, buttons: true }), 'adult torso');
const ADULT_TORSO_COAT = layer(14, 16, shirt(26, 20, { coat: true }), 'adult lab coat');
const ADULT_TORSO_SHORT = layer(15, 16, shirt(14, 18, { lapels: true }), 'adult torso short');
// Mr Wacker's gown: a wide cape behind the body.
const GOWN = layer(9, 16, new Grid(30, 28)
  .rect(6, 0, 18, 2, 'u').rect(4, 2, 22, 6, 't').rect(2, 8, 26, 8, 't').rect(0, 16, 30, 10, 't').rect(0, 26, 30, 2, 'u')
  .vline(0, 16, 12, 'u').vline(2, 8, 20, 'u')
  .rows(), 'gown');
// Mr Creak's hunched shoulders.
const HUMP = layer(13, 14, new Grid(8, 6).rect(2, 0, 4, 2, 't').rect(0, 2, 8, 4, 't').vline(0, 2, 4, 'u').rows(), 'hump');
// Dresses: a bodice then a flared skirt.
function dressTop(height, width = 18) {
  const g = new Grid(width, height);
  g.rect(4, 0, width - 8, 1, 't'); g.rect(2, 1, width - 4, 1, 't'); g.rect(1, 2, width - 2, height - 2, 't');
  g.vline(1, 2, height - 2, 'u');
  g.rect(Math.floor(width / 2) - 2, 1, 4, 1, 'e');       // collar
  return g.rows();
}
function skirt(height, top = 18, flare = 3) {
  const w = top + 2 * flare;
  const g = new Grid(w, height);
  for (let r = 0; r < height; r++) { const f = Math.round((r / (height - 1)) * flare); g.rect(flare - f, r, top + 2 * f, 1, 't'); g.set(flare - f, r, 'u'); }
  g.rect(0, height - 1, w, 1, 'u');
  return g.rows();
}
const GIRL_TOP = layer(15, 32, dressTop(12), 'girl bodice');
const GIRL_SKIRT = layer(12, 43, skirt(9), 'girl skirt');
const WOMAN_TOP = layer(15, 16, dressTop(22), 'woman bodice');
const WOMAN_SKIRT = layer(11, 37, skirt(19, 18, 4), 'woman skirt');

// ---- Legs ------------------------------------------------------------------------------

// Two legs under a waistband. `spread` slants the back leg left and the front
// leg right; `legRows` is the bare/trouser length; `trousers` draws them in the
// bottoms colour instead of skin. The layer is 32 wide at x=8 so slanted feet fit.
function legsLayer({ y, spread, waistRows, legRows, trousers = false, socks = true, name }) {
  const h = waistRows + legRows + 4;
  const g = new Grid(32, h);
  if (waistRows) { g.rect(8, 0, 16, waistRows - 1, 'p'); g.rect(8, waistRows - 1, 16, 1, 'q'); }
  for (let r = 0; r < legRows; r++) {
    const t = Math.round((r / Math.max(1, legRows - 1)) * spread);
    const bx = 9 - t, fx = 18 + t;
    const sock = socks && r >= legRows - 2;
    const c = sock ? 'k' : trousers ? 'p' : 'S';
    const shadeC = trousers ? 'q' : 'T';
    g.rect(bx, waistRows + r, 5, 1, c); if (!sock) g.set(bx, waistRows + r, shadeC);
    g.rect(fx, waistRows + r, 5, 1, c); if (!sock) g.set(fx, waistRows + r, shadeC);
  }
  const sy = waistRows + legRows, bs = 8 - spread, fs = 17 + spread;
  for (const x of [bs, fs]) { g.rect(x, sy, 7, 3, 'o'); g.vline(x, sy, 3, 'K'); g.rect(x, sy + 3, 7, 1, 'K'); }
  return layer(8, y, g.rows(), name);
}
const KID_LEGS = {
  stand: legsLayer({ y: 48, spread: 0, waistRows: 4, legRows: 8, name: 'kid legs' }),
  walk1: legsLayer({ y: 48, spread: 6, waistRows: 4, legRows: 8, name: 'kid legs 1' }),
  walk3: legsLayer({ y: 48, spread: 4, waistRows: 4, legRows: 8, name: 'kid legs 3' }),
};
const GIRL_LEGS = {
  stand: legsLayer({ y: 52, spread: 0, waistRows: 0, legRows: 8, name: 'girl legs' }),
  walk1: legsLayer({ y: 52, spread: 4, waistRows: 0, legRows: 8, name: 'girl legs 1' }),
  walk3: legsLayer({ y: 52, spread: 3, waistRows: 0, legRows: 8, name: 'girl legs 3' }),
};
const ADULT_LEGS = {
  stand: legsLayer({ y: 40, spread: 0, waistRows: 2, legRows: 18, trousers: true, socks: false, name: 'adult legs' }),
  walk1: legsLayer({ y: 40, spread: 6, waistRows: 2, legRows: 18, trousers: true, socks: false, name: 'adult legs 1' }),
  walk3: legsLayer({ y: 40, spread: 4, waistRows: 2, legRows: 18, trousers: true, socks: false, name: 'adult legs 3' }),
};
const WOMAN_LEGS = {
  stand: legsLayer({ y: 56, spread: 0, waistRows: 0, legRows: 4, socks: false, name: 'woman legs' }),
  walk1: legsLayer({ y: 56, spread: 3, waistRows: 0, legRows: 4, socks: false, name: 'woman legs 1' }),
  walk3: legsLayer({ y: 56, spread: 2, waistRows: 0, legRows: 4, socks: false, name: 'woman legs 3' }),
};

// Sitting on a chair: thighs forward, shins down to the floor.
function chairLegs(thighColour) {
  return layer(16, 44, new Grid(22, 20)
    .rect(0, 0, 18, 5, thighColour).rect(0, 5, 18, 1, thighColour === 'p' ? 'q' : 'u')
    .rect(13, 6, 5, 6, 'S').vline(13, 6, 6, 'T')
    .rect(13, 12, 5, 2, 'k')
    .rect(12, 14, 8, 5, 'o').vline(12, 14, 5, 'K').rect(12, 19, 8, 1, 'K')
    .rows(), 'legs chair');
}
// Sitting on the floor: legs straight out along the ground.
function floorLegs(thighColour, long = false) {
  const w = long ? 22 : 14;
  return layer(18, 52, new Grid(w + 14, 12)
    .rect(0, 0, w, 5, thighColour).rect(0, 5, w, 1, thighColour === 'p' ? 'q' : 'u')
    .rect(w, 1, 8, 5, 'S').hline(w, 1, 8, 'T')
    .rect(w + 8, 1, 3, 5, 'k')
    .rect(w + 10, 0, 4, 8, 'o').vline(w + 13, 0, 8, 'K').hline(w + 10, 7, 4, 'K')
    .rows(), 'legs floor');
}

// ---- Arms -------------------------------------------------------------------------------

// Arm pictures for a body whose shoulder is at `shoulderY`, with `sleeve` rows of sleeve.
function armsFor(shoulderY, sleeve) {
  const len = sleeve + 4;
  const down = new Grid(4, len).rect(0, 0, 4, sleeve, 't').vline(0, 0, sleeve, 'u').rect(1, sleeve, 2, 4, 'S').vline(1, sleeve, 4, 'T').rows();
  const swing = (dir) => {
    const g = new Grid(12, len);
    for (let r = 0; r < sleeve; r++) { const x = dir > 0 ? Math.floor(r / 2) : 7 - Math.floor(r / 2); g.rect(x, r, 4, 1, 't'); g.set(x, r, 'u'); }
    const hx = dir > 0 ? 1 + Math.floor((sleeve - 1) / 2) : 8 - Math.floor((sleeve - 1) / 2);
    g.rect(hx, sleeve, 2, 4, 'S').vline(hx, sleeve, 4, 'T');
    return g.rows();
  };
  const upLen = Math.min(shoulderY - 1, sleeve + 3);
  return {
    down: layer(12, shoulderY, down, 'arm down'),
    fwd: layer(31, shoulderY, swing(1), 'arm fwd'),
    back: layer(5, shoulderY, swing(-1), 'arm back'),
    up: layer(32, shoulderY - upLen + 1, new Grid(4, upLen).rect(1, 0, 2, 3, 'S').rect(0, 3, 4, upLen - 3, 't').vline(0, 3, upLen - 3, 'u').rows(), 'arm up'),
    out: layer(31, shoulderY + 1, new Grid(16, 4).rect(0, 0, 12, 4, 't').hline(0, 3, 12, 'u').rect(12, 0, 4, 4, 'S').hline(12, 3, 4, 'T').rows(), 'arm out'),
    half: layer(31, shoulderY - 3, new Grid(12, 8)
      .rect(0, 4, 4, 4, 't').vline(0, 4, 4, 'u')
      .rect(2, 3, 4, 2, 't').rect(4, 2, 4, 2, 't').rect(6, 1, 2, 2, 't')
      .rect(8, 0, 3, 3, 'S').set(8, 2, 'T')
      .rows(), 'arm half'),
    reach: layer(34, shoulderY + 11, new Grid(4, 18).rect(0, 0, 4, 8, 't').vline(0, 0, 8, 'u').rect(1, 8, 2, 10, 'S').vline(1, 8, 10, 'T').rows(), 'arm reach'),
  };
}
const FRONT_X = 31, BACK_X = 12;   // where the front and back arms attach

// ---- Props and specials --------------------------------------------------------------------

const PROPS = {
  catapultLow: layer(40, 30, `
    ..N
    ..N
    .NN
    N.N
    N..
    NN.
    .N.
  `, 'catapult low'),
  catapultOut: layer(44, 28, `
    N..N
    N..N
    N..N
    .NN.
    .N..
    .N..
    .N..
    .N..
  `, 'catapult out'),
  pistol: layer(45, 32, `
    CCC
    CCC
    BBC
    .BB
    .BB
  `, 'water pistol'),
};

// Lying flat, knocked out (children). Head on the left, feet on the right.
const KID_KNOCKED = layer(0, 46, new Grid(48, 18)
  .set(5, 0, 'X').set(10, 2, 'X').set(2, 3, 'X')
  .rect(0, 7, 12, 10, 'h').rect(3, 9, 9, 7, 'S').rect(3, 9, 9, 1, 'T')
  .set(7, 12, 'K').set(7, 13, 'K')
  .rect(12, 8, 16, 9, 't').rect(12, 8, 16, 1, 'u').rect(12, 15, 16, 2, 'u')
  .rect(28, 9, 8, 7, 'p').rect(28, 15, 8, 1, 'q')
  .rect(36, 10, 6, 5, 'S').rect(36, 13, 6, 2, 'k')
  .rect(42, 9, 6, 7, 'o').vline(47, 9, 7, 'K').hline(42, 15, 6, 'K')
  .rows(), 'kid knocked out');
// Grown-ups sit up dazed instead of lying flat.
const STARS = layer(4, 14, new Grid(24, 8).set(1, 5, 'X').set(2, 5, 'X').set(10, 1, 'X').set(20, 4, 'X').set(21, 4, 'X').set(14, 7, 'X').rows(), 'stars');
const ADULT_FLOOR_LEGS = layer(22, 48, new Grid(26, 16).rect(0, 4, 18, 6, 'p').rect(0, 9, 18, 1, 'q').rect(18, 2, 6, 11, 'o').vline(23, 2, 11, 'K').hline(18, 12, 6, 'K').rows(), 'adult floor legs');

// Bending over: torso tilted forward.
const KID_TORSO_BEND = layer(15, 38, new Grid(22, 10)
  .rect(1, 4, 14, 6, 't').vline(1, 4, 6, 'u')
  .rect(8, 2, 10, 4, 't').rect(12, 0, 8, 4, 't').rect(14, 0, 6, 2, 'u')
  .rows(), 'kid torso bend');

// The bike, with pedalling legs; the rider's body uses the ordinary parts.
const BIKE_FRAME = layer(0, 40, new Grid(48, 24)
  .rect(2, 14, 12, 10, 'D').rect(4, 16, 8, 6, 'G').rect(6, 18, 4, 2, 'D')
  .rect(34, 14, 12, 10, 'D').rect(36, 16, 8, 6, 'G').rect(38, 18, 4, 2, 'D')
  .rect(8, 10, 26, 2, 'R').rect(22, 4, 2, 8, 'R').rect(34, 4, 2, 8, 'R')
  .rect(14, 10, 2, 8, 'R').rect(32, 10, 2, 8, 'R')
  .rect(18, 2, 8, 2, 'K')
  .rect(32, 2, 8, 2, 'D').rect(38, 0, 2, 4, 'D')
  .rows(), 'bike');
const RIDE_LEGS = {
  0: layer(20, 42, new Grid(14, 14).rect(2, 0, 6, 6, 'p').rect(6, 6, 4, 4, 'S').rect(6, 10, 4, 2, 'k').rect(5, 12, 7, 2, 'o').rows(), 'ride legs 0'),
  1: layer(16, 42, new Grid(14, 14).rect(6, 0, 6, 5, 'p').rect(2, 5, 4, 4, 'S').rect(2, 9, 4, 2, 'k').rect(1, 11, 7, 2, 'o').rows(), 'ride legs 1'),
};

// Hayley kissing Eric: she wears her own colours (slots); Eric is drawn in his.
const KISS = (() => {
  const g = new Grid(48, 48);
  // Eric, on the right (R shirt, D shorts, his own hair colour)
  g.rect(28, 2, 12, 12, 'Q').rect(30, 6, 10, 9, 'S').set(31, 9, 'K').set(31, 10, 'K');
  g.rect(27, 16, 14, 14, 'R').rect(27, 30, 14, 4, 'D').rect(29, 34, 4, 6, 'S').rect(35, 34, 4, 6, 'S');
  g.rect(29, 40, 4, 2, 'W').rect(35, 40, 4, 2, 'W').rect(27, 42, 7, 4, 'K').rect(34, 42, 7, 4, 'K').rect(27, 46, 14, 2, 'K');
  g.rect(23, 18, 4, 4, 'R').rect(22, 22, 4, 8, 'R').rect(22, 30, 3, 3, 'S');       // Eric's arm round her
  // Hayley, on the left, facing him
  g.rect(6, 2, 12, 12, 'h').rect(8, 6, 10, 9, 'S').set(15, 9, 'K').set(15, 10, 'K').set(16, 12, 'P');
  g.rect(5, 16, 14, 12, 't').rect(5, 16, 14, 1, 'u').rect(3, 28, 18, 8, 't').rect(3, 35, 18, 1, 'u');
  g.rect(7, 36, 4, 4, 'S').rect(13, 36, 4, 4, 'S').rect(7, 40, 4, 2, 'k').rect(13, 40, 4, 2, 'k');
  g.rect(5, 42, 7, 4, 'o').rect(12, 42, 7, 4, 'o').rect(5, 46, 14, 2, 'K');
  // hearts
  g.set(20, 4, 'P').set(22, 4, 'P').rect(19, 5, 5, 2, 'P').rect(20, 7, 3, 1, 'P').set(21, 8, 'P');
  g.set(24, 0, 'P').set(26, 0, 'P').rect(23, 1, 5, 1, 'P').rect(24, 2, 3, 1, 'P').set(25, 3, 'P');
  return layer(0, 16, g.rows(), 'kissing');
})();

// ---- Body types ---------------------------------------------------------------------------

const KID = {
  head: KID_HEAD, headDy: 0, arms: armsFor(33, 10),
  torso: KID_TORSO, torsoBig: KID_TORSO_BIG, torsoShort: KID_TORSO_SHORT, torsoBend: KID_TORSO_BEND,
  legs: KID_LEGS, legsChair: chairLegs('p'), legsFloor: floorLegs('p'), knocked: KID_KNOCKED,
};
const GIRL = {
  head: KID_HEAD, headDy: 0, arms: armsFor(33, 10),
  torso: GIRL_TOP, skirt: GIRL_SKIRT, torsoShort: GIRL_TOP,
  legs: GIRL_LEGS, legsChair: chairLegs('t'), legsFloor: floorLegs('t'), knocked: KID_KNOCKED,
};
const ADULT = {
  head: ADULT_HEAD, headDy: -14, arms: armsFor(17, 14),
  torso: ADULT_TORSO, torsoCoat: ADULT_TORSO_COAT, torsoShort: ADULT_TORSO_SHORT,
  legs: ADULT_LEGS, legsFloor: ADULT_FLOOR_LEGS,
};
const WOMAN = {
  head: ADULT_HEAD, headDy: -14, arms: armsFor(17, 14),
  torso: WOMAN_TOP, skirt: WOMAN_SKIRT, torsoShort: ADULT_TORSO_SHORT,
  legs: WOMAN_LEGS, legsFloor: ADULT_FLOOR_LEGS,
};

function bodyFor(group, look) {
  if (ADULTS.has(group)) return look.dress ? WOMAN : ADULT;
  return look.dress ? GIRL : KID;
}

// The head plus whatever the look adds to it, offset by (dx, dy).
function headLayers(b, look, dx = 0, dy = 0) {
  const sx = dx + (look.stoop ? 2 : 0), sy = dy + (look.stoop ? 3 : 0);
  const at = (lay) => [lay, sx, sy + b.headDy];     // accessories are drawn for the kid head and shifted for adults
  const out = [[b.head, sx, sy]];
  if (look.scruffy) out.push(at(ACCESSORY.scruffy));
  if (look.bun) out.push(at(ACCESSORY.bun));
  if (look.glasses) out.push(at(ACCESSORY.glasses));
  if (look.beard) out.push(at(ACCESSORY.beard));
  if (look.mortarboard) out.push(at(ACCESSORY.mortarboard));
  if (look.cap) out.push(at(ACCESSORY.cap));
  return out;
}
function torsoLayers(b, look) {
  const out = [];
  if (look.gown) out.push(GOWN);
  out.push(look.labcoat && b.torsoCoat ? b.torsoCoat : look.big && b.torsoBig ? b.torsoBig : b.torso);
  if (look.stoop) out.push(HUMP);
  if (b.skirt) out.push(b.skirt);
  return out;
}

// Standing or walking: arms swing opposite ways; the head bobs mid-stride.
function standing(b, look, phase, frontArm) {
  const A = b.arms;
  const legs = phase === 1 ? b.legs.walk1 : phase === 3 ? b.legs.walk3 : b.legs.stand;
  const back = phase === 1 ? [A.fwd, BACK_X - FRONT_X, 0] : phase === 3 ? A.back : A.down;
  const front = frontArm ? A[frontArm] : phase === 1 ? [A.back, FRONT_X - 5 - 4, 0] : phase === 3 ? A.fwd : [A.down, FRONT_X - BACK_X, 0];
  const bob = phase === 1 || phase === 3 ? -1 : 0;
  return [back, legs, ...torsoLayers(b, look), ...headLayers(b, look, 0, bob), front];
}

// Each pose returns a list of layers (or [layer, dx, dy]) for a body type.
const POSES = {
  WALK0: (b, l) => standing(b, l, 0),
  WALK1: (b, l) => standing(b, l, 1),
  WALK2: (b, l) => standing(b, l, 0),
  WALK3: (b, l) => standing(b, l, 3),
  ARM_UP: (b, l) => standing(b, l, 0, 'up'),
  HITTING0: (b, l) => standing(b, l, 0, 'half'),
  HITTING1: (b, l) => standing(b, l, 0, 'out'),
  CATAPULT0: (b, l) => [...standing(b, l, 0, 'half'), PROPS.catapultLow],
  CATAPULT1: (b, l) => [...standing(b, l, 0, 'out'), PROPS.catapultOut],
  WATERPISTOL: (b, l) => [...standing(b, l, 0, 'out'), PROPS.pistol],
  SITTING_ON_CHAIR: (b, l) => [b.legsChair, [b.torsoShort, 0, 4], ...headLayers(b, l, 0, 4), [b.arms.fwd, 0, 4]],
  SITTING_ON_FLOOR: (b, l) => [b.legsFloor, [b.torsoShort, 0, 12], ...headLayers(b, l, 0, 12), [b.arms.down, FRONT_X - BACK_X, 12]],
  KNOCKED_OUT: (b, l) => b.knocked ? [b.knocked] : POSES.KNOCKED_OVER(b, l),
  // Grown-ups: sitting up on the floor, dazed, legs out.
  KNOCKED_OVER: (b, l) => [b.legsFloor, [b.torsoShort, -3, 24], ...headLayers(b, l, -3, 22), [b.arms.down, FRONT_X - BACK_X - 3, 8], STARS],
  BENDING_OVER: (b, l) => [b.legs.stand, b.torsoBend || b.torso, ...headLayers(b, l, 13, 12), b.arms.reach],
  RIDING_BIKE0: (b, l) => [BIKE_FRAME, RIDE_LEGS[0], [b.torsoShort, 2, -2], ...headLayers(b, l, 2, -2), [b.arms.fwd, 2, -2]],
  RIDING_BIKE1: (b, l) => [BIKE_FRAME, RIDE_LEGS[1], [b.torsoShort, 2, -2], ...headLayers(b, l, 2, -2), [b.arms.fwd, 2, -2]],
  KISSING_ERIC: () => [KISS],
};

// The layers for this person in this state, or null when there is no HD art.
export function personLayers(group, state, look = {}) {
  if (!PEOPLE.has(group)) return null;
  const body = bodyFor(group, look);
  const pose = POSES[state] || POSES.WALK0;
  return pose(body, look);
}

export const PERSON_STATES = Object.keys(POSES);
