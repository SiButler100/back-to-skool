// ============================================================================
// OBJECTS (HD pixel art for things that are not people)
// ----------------------------------------------------------------------------
// Pellets, water, drops, the conker, the mouse, the frog, the stinkbomb cloud,
// the desk lid, the bike and the plants. The engine tells these apart only by
// their animatory state, so this is a table from state to layers, all inside
// the usual 48 x 64 frame. The positions match the painted stand-ins (which
// in turn match the original game's hit points): the pellet sits in cell
// (1,1), falling drops near the bottom of the frame, the frog on the feet line.
// ============================================================================

import { layer, Grid } from './pixelart.js';

const pellet = layer(16, 16, `
  .KK.
  KMKK
  KKKK
  .KK.
`, 'pellet');

// Water jet: a few droplets per frame of flight (positions from the stand-in, doubled).
const DROPS = {
  WATER0: [[8, 28], [16, 24]],
  WATER1: [[4, 24], [12, 20], [20, 16]],
  WATER2: [[4, 16], [16, 14], [28, 16]],
  WATER3: [[12, 16], [20, 20]],
  WATER4: [[16, 20], [16, 28], [18, 36]],
};
function droplets(points) {
  const g = new Grid(48, 64);
  for (const [x, y] of points) { g.rect(x, y, 4, 4, 'C'); g.set(x + 1, y + 1, 'L'); g.set(x, y, '.'); g.set(x + 3, y, '.'); g.set(x, y + 3, '.'); g.set(x + 3, y + 3, '.'); }
  return layer(0, 0, g.rows(), 'water');
}

function drop(colour) {
  return layer(16, 48, `
    .${colour}${colour}.
    ${colour}${colour}${colour}${colour}
    ${colour}L${colour}${colour}
    ${colour}${colour}${colour}${colour}
    .${colour}${colour}.
  `, 'drop');
}

const conker = layer(16, 48, `
  .OOOO.
  OOLOOO
  OOOOOO
  OOOOOJ
  OOOOJJ
  .JJJJ.
`, 'conker');

const mouse = layer(10, 50, `
  ................P....
  ...............PGP...
  ...............GGG...
  ......GGGGGGGGGGGGG..
  ...GGGGGGGGGGGGGGGGK.
  GGGGGGGGGGGGGGGGGGGPP
  ..GG.GGGGGGGGGGGGG...
  ....K.GG..K..GG......
  ......K..........K...
`, 'mouse');

// The frog: sitting, and two heights of hop.
function frog(lift) {
  const g = new Grid(24, 16);
  const y = 12 - lift;
  g.rect(2, y - 4, 14, 6, 'A').rect(2, y - 4, 14, 1, 'Z');                 // body
  g.rect(12, y - 8, 10, 6, 'A').rect(12, y - 8, 10, 1, 'Z');              // head
  g.rect(18, y - 10, 3, 3, 'A').set(19, y - 9, 'K');                      // eye
  g.rect(14, y - 3, 6, 1, 'Z');                                           // mouth
  g.rect(0, y + 2, 6, 2, 'A').rect(16, y + 2, 6, 2, 'A');                 // legs
  if (lift) { g.rect(0, y + 4, 4, 2, 'Z'); g.rect(18, y + 4, 4, 2, 'Z'); } else g.rect(0, 14, 22, 2, 'Z');
  return layer(12, 48, g.rows(), `frog ${lift}`);
}

const stinkbomb = layer(4, 30, new Grid(40, 34)
  .rect(8, 2, 14, 7, 'F').rect(4, 7, 22, 8, 'F').rect(18, 10, 18, 8, 'F').rect(2, 14, 30, 8, 'F').rect(12, 20, 20, 6, 'F').rect(6, 24, 12, 5, 'F')
  .rect(18, 28, 6, 6, 'K').rect(19, 27, 4, 1, 'K').set(20, 29, 'D')
  .rows(), 'stinkbomb');

// The desk lid, open, with whatever is inside.
function deskLid(contents) {
  const g = new Grid(32, 20);
  g.rect(0, 14, 28, 4, 'N').rect(0, 14, 28, 1, 'I').rect(0, 17, 28, 1, 'J');    // desk top
  g.rect(2, 0, 4, 15, 'N').rect(2, 0, 4, 1, 'I').rect(2, 0, 1, 15, 'J');       // lid, up
  g.rect(0, 0, 28, 2, 'J').rect(0, 0, 28, 1, 'I');
  g.rect(6, 2, 22, 12, 'J');                                                    // inside
  if (contents === 'pistol') { g.rect(10, 7, 12, 4, 'C').rect(10, 11, 4, 4, 'B').rect(20, 6, 4, 2, 'B'); }
  if (contents === 'bombs') { for (const x of [9, 15, 21]) { g.rect(x, 8, 5, 5, 'K'); g.set(x + 1, 9, 'D'); g.rect(x + 2, 6, 1, 2, 'G'); } }
  return layer(8, 26, g.rows(), 'desk lid');
}

// The bike. BIKE is also used under Eric when he rides it (people.js).
export const BIKE = layer(0, 40, new Grid(48, 24)
  .rect(2, 14, 12, 10, 'E').rect(4, 16, 8, 6, 'M').rect(6, 18, 4, 2, 'E')
  .rect(34, 14, 12, 10, 'E').rect(36, 16, 8, 6, 'M').rect(38, 18, 4, 2, 'E')
  .rect(8, 10, 26, 2, 'R').rect(22, 4, 2, 8, 'R').rect(34, 4, 2, 8, 'R')
  .rect(14, 10, 2, 8, 'R').rect(32, 10, 2, 8, 'R')
  .rect(18, 2, 8, 2, 'K')
  .rect(32, 2, 8, 2, 'E').rect(38, 0, 2, 4, 'E')
  .rows(), 'bike');
const bikeOnFloor = layer(0, 48, new Grid(48, 16)
  .rect(4, 4, 16, 10, 'E').rect(6, 6, 12, 6, 'M').rect(9, 8, 6, 2, 'E')
  .rect(28, 4, 16, 10, 'E').rect(30, 6, 12, 6, 'M').rect(33, 8, 6, 2, 'E')
  .rect(16, 8, 16, 2, 'R').rect(20, 2, 8, 2, 'K').rect(22, 4, 2, 4, 'R')
  .rows(), 'bike on floor');

// Plants: half grown, and fully grown with a flower.
const plantGrowing = layer(12, 44, new Grid(24, 20)
  .rect(8, 4, 8, 16, 'Z').rect(10, 4, 4, 16, 'A')
  .rect(2, 2, 10, 5, 'A').rect(2, 6, 8, 1, 'Z').rect(12, 0, 10, 5, 'A').rect(14, 4, 8, 1, 'Z')
  .rows(), 'plant growing');
const plantGrown = layer(8, 6, new Grid(32, 58)
  .rect(12, 10, 8, 48, 'Z').rect(14, 10, 4, 48, 'A')
  .rect(0, 14, 12, 8, 'A').rect(0, 20, 10, 2, 'Z').rect(20, 6, 12, 8, 'A').rect(22, 12, 10, 2, 'Z')
  .rect(2, 30, 12, 6, 'A').rect(2, 34, 10, 2, 'Z').rect(20, 26, 12, 6, 'A').rect(22, 30, 10, 2, 'Z')
  .rect(8, 0, 16, 12, 'P').rect(12, 2, 8, 8, 'X').rect(14, 4, 4, 4, 'P').rect(8, 0, 2, 2, '.').rect(22, 0, 2, 2, '.').rect(8, 10, 2, 2, '.').rect(22, 10, 2, 2, '.')
  .rows(), 'plant grown');

export const OBJECT_ART = {
  FLY: [pellet],
  WATER0: [droplets(DROPS.WATER0)], WATER1: [droplets(DROPS.WATER1)], WATER2: [droplets(DROPS.WATER2)],
  WATER3: [droplets(DROPS.WATER3)], WATER4: [droplets(DROPS.WATER4)],
  WATER_DROP: [drop('C')], SHERRY_DROP: [drop('O')],
  CONKER: [conker],
  RUN: [mouse],
  SIT: [frog(0)], HOP1: [frog(4)], HOP2: [frog(8)],
  STINKBOMB: [stinkbomb],
  DESK_EMPTY: [deskLid(null)], DESK_WATER_PISTOL: [deskLid('pistol')], DESK_STINKBOMBS: [deskLid('bombs')],
  BIKE_ON_FLOOR: [bikeOnFloor], BIKE_UPRIGHT: [BIKE],
  PLANT_GROWING: [plantGrowing], PLANT_GROWN: [plantGrown],
};

export function objectLayers(state) {
  return OBJECT_ART[state] || null;
}
