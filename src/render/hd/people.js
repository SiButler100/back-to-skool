// ============================================================================
// PEOPLE (HD pixel-art bodies, built from parts)
// ----------------------------------------------------------------------------
// A person is composed from layers: back arm, legs, torso, head, hat or
// glasses, front arm, and any prop (catapult, water pistol). Each pose in
// POSES lists its parts; each body type (kid, girl, adult, woman) supplies its
// own versions of the parts. Colours come from the slots in pixelart.js, so one
// set of pictures dresses the whole school.
//
// Frame: 48 x 64, facing right. Kids stand in rows 16-63, adults in 0-63.
// Feet are always on row 63. All coordinates below are frame pixels.
// ============================================================================

import { layer, Grid } from './pixelart.js';
import { ADULTS, PEOPLE } from './palette.js';

// ---- Kid body ------------------------------------------------------------------

const KID_HEAD = layer(17, 16, `
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
`, 'kid head');

// Shirt, 18 wide, with a collar/tie accent at the top. `height` rows of body.
function shirt(height, width = 18) {
  const g = new Grid(width, height);
  g.rect(4, 0, width - 8, 1, 't');
  g.rect(2, 1, width - 4, 1, 't');
  g.rect(1, 2, width - 2, height - 3, 't');
  g.vline(1, 2, height - 3, 'u');                 // shaded back edge
  g.rect(2, height - 1, width - 4, 1, 'u');        // hem
  g.rect(Math.floor(width / 2) - 1, 1, 2, 2, 'e'); // tie knot / collar accent
  return g.rows();
}
const KID_TORSO = layer(15, 32, shirt(16), 'kid torso');
const KID_TORSO_BIG = layer(14, 32, shirt(16, 20), 'kid torso big');
const KID_TORSO_SHORT = layer(15, 32, shirt(12), 'kid torso short');

// Legs: shorts over two legs. `spread` slants the back leg left and the front
// leg right (walking); 0 stands straight. Layer is 32 wide at x=8 so slanted
// feet fit, with the shorts centred under the torso (frame x 16-31).
function kidLegs(spread) {
  const g = new Grid(32, 16);
  g.rect(8, 0, 16, 3, 'p'); g.rect(8, 3, 16, 1, 'q');              // shorts
  for (let r = 0; r < 8; r++) {                                      // thighs/shins rows 4-11
    const t = Math.round((r / 7) * spread);
    const bx = 9 - t, fx = 18 + t;                                   // back leg x9-13, front x18-22
    const c = r >= 6 ? 'k' : 'S';
    g.rect(bx, 4 + r, 5, 1, c); if (c === 'S') g.set(bx, 4 + r, 'T');
    g.rect(fx, 4 + r, 5, 1, c); if (c === 'S') g.set(fx, 4 + r, 'T');
  }
  const bs = 8 - spread, fs = 17 + spread;                           // shoes (7 wide)
  g.rect(bs, 12, 7, 3, 'o'); g.vline(bs, 12, 3, 'K'); g.rect(bs, 15, 7, 1, 'K');
  g.rect(fs, 12, 7, 3, 'o'); g.vline(fs, 12, 3, 'K'); g.rect(fs, 15, 7, 1, 'K');
  return layer(8, 48, g.rows(), `kid legs ${spread}`);
}
const KID_LEGS = { stand: kidLegs(0), walk1: kidLegs(6), walk3: kidLegs(4) };

// Sitting on a chair: thighs forward, shins down to the floor.
const KID_LEGS_CHAIR = layer(16, 44, new Grid(22, 20)
  .rect(0, 0, 18, 5, 'p').rect(0, 5, 18, 1, 'q')                     // thighs
  .rect(13, 6, 5, 6, 'S').vline(13, 6, 6, 'T')                        // shins
  .rect(13, 12, 5, 2, 'k')
  .rect(12, 14, 8, 5, 'o').vline(12, 14, 5, 'K').rect(12, 19, 8, 1, 'K')
  .rows(), 'kid legs chair');

// Sitting on the floor: legs straight out along the ground.
const KID_LEGS_FLOOR = layer(18, 52, new Grid(28, 12)
  .rect(0, 0, 14, 5, 'p').rect(0, 5, 14, 1, 'q')
  .rect(14, 1, 8, 5, 'S').hline(14, 1, 8, 'T')
  .rect(22, 1, 3, 5, 'k')
  .rect(24, 0, 4, 8, 'o').vline(27, 0, 8, 'K').hline(24, 7, 4, 'K')
  .rows(), 'kid legs floor');

// Arms. Back arms are drawn before the torso, front arms after.
const SLEEVE_ROWS = 10;
function armDown() { const g = new Grid(4, 14); g.rect(0, 0, 4, SLEEVE_ROWS, 't').vline(0, 0, SLEEVE_ROWS, 'u'); g.rect(1, SLEEVE_ROWS, 2, 4, 'S').vline(1, SLEEVE_ROWS, 4, 'T'); return g.rows(); }
function armSwing(dir) {   // dir +1 swings forward (right), -1 back (left)
  const g = new Grid(10, 14);
  for (let r = 0; r < SLEEVE_ROWS; r++) { const x = dir > 0 ? Math.floor(r / 2) : 6 - Math.floor(r / 2); g.rect(x, r, 4, 1, 't'); g.set(x, r, 'u'); }
  const hx = dir > 0 ? 6 : 1;
  g.rect(hx, SLEEVE_ROWS, 2, 4, 'S').vline(hx, SLEEVE_ROWS, 4, 'T');
  return g.rows();
}
const ARM = {
  down: layer(12, 33, armDown(), 'arm down'),
  fwd: layer(31, 33, armSwing(1), 'arm fwd'),
  back: layer(6, 33, armSwing(-1), 'arm back'),
  up: layer(32, 16, new Grid(4, 18).rect(1, 0, 2, 3, 'S').rect(0, 3, 4, 15, 't').vline(0, 3, 15, 'u').rows(), 'arm up'),
  out: layer(31, 34, new Grid(16, 4).rect(0, 0, 12, 4, 't').hline(0, 3, 12, 'u').rect(12, 0, 4, 4, 'S').hline(12, 3, 4, 'T').rows(), 'arm out'),
  half: layer(31, 30, new Grid(12, 8)
    .rect(0, 4, 4, 4, 't').vline(0, 4, 4, 'u')
    .rect(2, 3, 4, 2, 't').rect(4, 2, 4, 2, 't').rect(6, 1, 2, 2, 't')
    .rect(8, 0, 3, 3, 'S').set(8, 2, 'T')
    .rows(), 'arm half'),
};
// Where a front arm attaches; the back arm uses the same picture shifted left.
const FRONT_X = 31, BACK_X = 12;

// Props held in the hand (drawn last).
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

// Lying flat, knocked out (kids). One picture: head on the left, feet right.
const KID_KNOCKED = layer(0, 46, new Grid(48, 18)
  .set(5, 0, 'X').set(10, 2, 'X').set(2, 3, 'X')                      // stars
  .rect(0, 7, 12, 10, 'h').rect(3, 9, 9, 7, 'S').rect(3, 9, 9, 1, 'T')  // head
  .set(7, 12, 'K').set(7, 13, 'K')                                      // closed eye
  .rect(12, 8, 16, 9, 't').rect(12, 8, 16, 1, 'u').rect(12, 15, 16, 2, 'u')
  .rect(28, 9, 8, 7, 'p').rect(28, 15, 8, 1, 'q')
  .rect(36, 10, 6, 5, 'S').rect(36, 13, 6, 2, 'k')
  .rect(42, 9, 6, 7, 'o').vline(47, 9, 7, 'K').hline(42, 15, 6, 'K')
  .rows(), 'kid knocked out');

// Bending over: torso tilted forward, arm reaching down.
const KID_TORSO_BEND = layer(15, 38, new Grid(22, 10)
  .rect(1, 4, 14, 6, 't').vline(1, 4, 6, 'u')
  .rect(8, 2, 10, 4, 't').rect(12, 0, 8, 4, 't').rect(14, 0, 6, 2, 'u')
  .rows(), 'kid torso bend');
const ARM_REACH = layer(34, 44, new Grid(4, 18).rect(0, 0, 4, 8, 't').vline(0, 0, 8, 'u').rect(1, 8, 2, 10, 'S').vline(1, 8, 10, 'T').rows(), 'arm reach');

// The bike, with the rider's legs; the rider's body uses the ordinary parts.
const BIKE_FRAME = layer(0, 40, new Grid(48, 24)
  // wheels
  .rect(2, 14, 12, 10, 'D').rect(4, 16, 8, 6, 'G').rect(6, 18, 4, 2, 'D')
  .rect(34, 14, 12, 10, 'D').rect(36, 16, 8, 6, 'G').rect(38, 18, 4, 2, 'D')
  // frame
  .rect(8, 10, 26, 2, 'R').rect(22, 4, 2, 8, 'R').rect(34, 4, 2, 8, 'R')
  .rect(14, 10, 2, 8, 'R').rect(32, 10, 2, 8, 'R')
  .rect(18, 2, 8, 2, 'K')                        // saddle
  .rect(32, 2, 8, 2, 'D').rect(38, 0, 2, 4, 'D')  // handlebars
  .rows(), 'bike');
const RIDE_LEGS = {
  0: layer(20, 42, new Grid(14, 14).rect(2, 0, 6, 6, 'p').rect(6, 6, 4, 4, 'S').rect(6, 10, 4, 2, 'k').rect(5, 12, 7, 2, 'o').rows(), 'ride legs 0'),
  1: layer(16, 42, new Grid(14, 14).rect(6, 0, 6, 5, 'p').rect(2, 5, 4, 4, 'S').rect(2, 9, 4, 2, 'k').rect(1, 11, 7, 2, 'o').rows(), 'ride legs 1'),
};

// ---- Body types --------------------------------------------------------------------

const KID = {
  head: KID_HEAD, torso: KID_TORSO, torsoBig: KID_TORSO_BIG, torsoShort: KID_TORSO_SHORT, torsoBend: KID_TORSO_BEND,
  legs: KID_LEGS, legsChair: KID_LEGS_CHAIR, legsFloor: KID_LEGS_FLOOR, knocked: KID_KNOCKED,
};

function bodyFor(group, look) {
  if (ADULTS.has(group)) return null;          // adults arrive in the next milestone
  if (look.dress) return null;                 // girls too
  return KID;
}

// Walking: back arm and front arm swing opposite ways.
function standing(b, look, phase, frontArm) {
  const torso = look.big ? b.torsoBig : b.torso;
  const legs = phase === 1 ? b.legs.walk1 : phase === 3 ? b.legs.walk3 : b.legs.stand;
  const back = phase === 1 ? [ARM.fwd, BACK_X - FRONT_X, 0] : phase === 3 ? [ARM.back, 0, 0] : [ARM.down, 0, 0];
  const front = frontArm ? ARM[frontArm] : phase === 1 ? [ARM.back, 20, 0] : phase === 3 ? ARM.fwd : [ARM.down, FRONT_X - BACK_X, 0];
  const bob = phase === 1 || phase === 3 ? -1 : 0;
  return [back, legs, torso, [b.head, 0, bob], front];
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
  SITTING_ON_CHAIR: (b) => [b.legsChair, [b.torsoShort, 0, 4], [b.head, 0, 4], [ARM.fwd, 0, 4]],
  SITTING_ON_FLOOR: (b) => [b.legsFloor, [b.torsoShort, 0, 12], [b.head, 0, 12], [ARM.down, FRONT_X - BACK_X, 12]],
  KNOCKED_OUT: (b) => [b.knocked],
  BENDING_OVER: (b) => [b.legs.stand, b.torsoBend, [b.head, 13, 12], ARM_REACH],
  RIDING_BIKE0: (b) => [BIKE_FRAME, RIDE_LEGS[0], [b.torsoShort, 2, -2], [b.head, 2, -2], [ARM.fwd, 2, -2]],
  RIDING_BIKE1: (b) => [BIKE_FRAME, RIDE_LEGS[1], [b.torsoShort, 2, -2], [b.head, 2, -2], [ARM.fwd, 2, -2]],
};

// The layers for this person in this state, or null when there is no HD art
// yet (the renderer then shows the painted stand-in).
export function personLayers(group, state, look = {}) {
  if (!PEOPLE.has(group)) return null;
  const body = bodyFor(group, look);
  if (!body) return null;
  const pose = POSES[state] || POSES.WALK0;
  return pose(body, look);
}

export const PERSON_STATES = Object.keys(POSES);
