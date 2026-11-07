// ============================================================================
// THE CAST
// ----------------------------------------------------------------------------
// Every character in the school. To rename someone, change their outfit colour,
// or add a brand-new pupil, edit this file.
//
// Flags (a string of letters) switch behaviours on and off:
//   A  adult (teacher or caretaker)         B  boy (belongs on the boys' side)
//   C  can be knocked over by the conker     D  can open doors
//   F  can be punched                        G  girl (belongs on the girls' side)
//   K  carries the safe key                  L  can give lines
//   M  is scared of mice                     N  can smell stinkbombs (opens windows)
//   P  can be hit by a catapult pellet       R  can be given lines
//   U  their lines count towards Eric's total
//   V  their lines are added to Eric's SCORE  W  never runs (no W = sometimes runs)
//   X  knows one digit of the bike combination
//   Y  knows one letter of the storeroom combination
//   Z  the conker knocks them out cold (Albert)
//
// "look" is purely visual: the procedural sprite painter reads it.
// ============================================================================

export const CHARACTERS = [
  // --- Girls -------------------------------------------------------------
  { id: 'GIRL01', name: 'JESSICA',    group: 'GIRL', dir: -1, x: 117, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#5b3a1e', dress: '#2f7df6' } },
  { id: 'GIRL02', name: 'HYACINTH',   group: 'GIRL', dir: 1,  x: 114, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#1c1c1c', dress: '#2f7df6' } },
  { id: 'GIRL03', name: 'PENELOPE',   group: 'GIRL', dir: -1, x: 120, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#c98a2c', dress: '#2f7df6' } },
  { id: 'GIRL04', name: 'VIOLET',     group: 'GIRL', dir: 1,  x: 160, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#7a2a1a', dress: '#2f7df6' } },
  { id: 'GIRL05', name: 'AMELIA',     group: 'GIRL', dir: -1, x: 163, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#f0d36b', dress: '#2f7df6' } },
  { id: 'GIRL06', name: 'SARAH-JANE', group: 'GIRL', dir: 1,  x: 166, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#3b2a1a', dress: '#2f7df6' } },
  { id: 'GIRL07', name: 'PHILIPPA',   group: 'GIRL', dir: -1, x: 165, y: 17, headXY: [1, 1], flags: 'FGM', look: { hair: '#a04a2a', dress: '#2f7df6' } },

  // --- Boys ---------------------------------------------------------------
  { id: 'BOY01', name: 'PERKINS', group: 'BOY', dir: -1, x: 5,   y: 10, headXY: [1, 1], flags: 'BF', look: { hair: '#4a2e14' } },
  { id: 'BOY02', name: 'GIBSON',  group: 'BOY', dir: 1,  x: 7,   y: 10, headXY: [1, 1], flags: 'BF', look: { hair: '#1c1c1c' } },
  { id: 'BOY03', name: 'FANSHAW', group: 'BOY', dir: -1, x: 10,  y: 10, headXY: [1, 1], flags: 'BF', look: { hair: '#d8a640' } },
  { id: 'BOY04', name: 'SMITH',   group: 'BOY', dir: 1,  x: 72,  y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#6a3f1c' } },
  { id: 'BOY05', name: 'HARRIS',  group: 'BOY', dir: -1, x: 74,  y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#8a2a1a' } },
  { id: 'BOY06', name: 'MILLER',  group: 'BOY', dir: 1,  x: 104, y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#2a2a2a' } },
  { id: 'BOY07', name: 'JONES',   group: 'BOY', dir: -1, x: 107, y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#4a2e14' } },
  { id: 'BOY08', name: 'VICKERS', group: 'BOY', dir: 1,  x: 110, y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#c08030' } },
  { id: 'BOY09', name: 'BUTLER',  group: 'BOY', dir: -1, x: 123, y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#3a2a1a' } },
  { id: 'BOY10', name: 'COOK',    group: 'BOY', dir: 1,  x: 126, y: 17, headXY: [1, 1], flags: 'BF', look: { hair: '#1c1c1c' } },

  // --- Staff --------------------------------------------------------------
  { id: 'WACKER',  name: 'MR WACKER',  title: 'Sir',  group: 'WACKER',  dir: -1, x: 76,  y: 3,  headXY: [1, 0], flags: 'ABCDLNPWXY', look: { hair: '#dddddd', suit: '#1b1b1b', gown: true, mortarboard: true } },
  { id: 'WITHIT',  name: 'MR WITHIT',  title: 'Sir',  group: 'WITHIT',  dir: 1,  x: 15,  y: 17, headXY: [1, 0], flags: 'ABCDLPWXY',  look: { hair: '#2a1a0a', suit: '#4b6b3a', beard: true } },
  { id: 'ROCKITT', name: 'MR ROCKITT', title: 'Sir',  group: 'ROCKITT', dir: -1, x: 37,  y: 10, headXY: [1, 0], flags: 'ABCDLPWXY',  look: { hair: '#c8c8c8', suit: '#f4f4f4', labcoat: true } },
  { id: 'CREAK',   name: 'MR CREAK',   title: 'Sir',  group: 'CREAK',   dir: 1,  x: 43,  y: 17, headXY: [1, 0], flags: 'ABCDLPWXY',  look: { hair: '#e8e8e8', suit: '#5a4a3a', stoop: true } },
  { id: 'TAKE',    name: 'MISS TAKE',  title: 'Miss', group: 'TAKE',    dir: -1, x: 188, y: 3,  headXY: [1, 0], flags: 'ACDGKLMPW',  look: { hair: '#8a5a2a', dress: '#7a2a7a', bun: true } },
  { id: 'ALBERT',  name: 'ALBERT',                    group: 'ALBERT',  dir: -1, x: 136, y: 17, headXY: [1, 0], flags: 'ADWZ',       look: { hair: '#7a7a7a', suit: '#6a5a3a', cap: true } },

  // --- The named kids -----------------------------------------------------
  { id: 'TEARAWAY', name: 'BOY WANDER', group: 'TEARAWAY', dir: 1,  x: 122, y: 17, headXY: [1, 1], flags: 'BCFPR',   look: { hair: '#e0a030', scruffy: true } },
  { id: 'BULLY',    name: 'ANGELFACE',  group: 'BULLY',    dir: -1, x: 116, y: 17, headXY: [1, 1], flags: 'BCFPRV',  look: { hair: '#1c1c1c', big: true } },
  { id: 'SWOT',     name: 'EINSTEIN',   group: 'SWOT',     dir: -1, x: 24,  y: 3,  headXY: [1, 1], flags: 'BCFPRV',  look: { hair: '#6a3f1c', glasses: true } },
  { id: 'HEROINE',  name: 'HAYLEY',     group: 'HEROINE',  dir: -1, x: 136, y: 17, headXY: [1, 1], flags: 'CGFMPRU', look: { hair: '#f0d36b', dress: '#e04070' } },
];

// Eric: the player.
export const ERIC = {
  id: 'HERO', name: 'ERIC', group: 'ERIC', dir: -1, x: 133, y: 17, headXY: [1, 1], flags: 'BFPR',
  bendOverHandXY: [0, 3],
  look: { hair: '#c07030' },
};

// Where each character wanders to at random (playtime, walkabouts).
export const RANDOM_LOCATIONS = {
  GIRL01: [[129, 17], [144, 17], [136, 17], [189, 17]],
  GIRL02: [[129, 17], [144, 17], [136, 17], [189, 17]],
  GIRL03: [[129, 17], [144, 17], [136, 17], [189, 17]],
  GIRL04: [[189, 17], [189, 10], [170, 17], [182, 3]],
  GIRL05: [[189, 17], [189, 10], [170, 17], [182, 3]],
  GIRL06: [[189, 17], [189, 10], [170, 17], [182, 3]],
  GIRL07: [[189, 17], [189, 10], [170, 17], [182, 3]],
  BOY01: [[38, 3], [10, 10], [10, 17], [66, 17]],
  BOY02: [[38, 3], [10, 10], [10, 17], [66, 17]],
  BOY03: [[38, 3], [10, 10], [10, 17], [66, 17]],
  BOY04: [[38, 3], [10, 17], [109, 17], [75, 17]],
  BOY05: [[38, 3], [10, 17], [109, 17], [75, 17]],
  BOY06: [[38, 3], [10, 17], [109, 17], [75, 17]],
  BOY07: [[38, 3], [10, 17], [109, 17], [75, 17]],
  BOY08: [[38, 3], [10, 17], [109, 17], [75, 17]],
  BOY09: [[112, 17], [145, 17], [158, 17], [37, 3]],
  BOY10: [[112, 17], [145, 17], [158, 17], [37, 3]],
  WACKER: [[157, 17], [38, 3], [10, 17], [92, 17]],
  WITHIT: [[157, 17], [38, 3], [10, 17], [92, 17]],
  ROCKITT: [[38, 3], [90, 3], [10, 17], [90, 17]],
  CREAK: [[38, 3], [90, 3], [10, 17], [90, 17]],
  TAKE: [[189, 17], [189, 10], [170, 17], [182, 3]],
  ALBERT: [[112, 17], [145, 17], [158, 17], [37, 3]],
  TEARAWAY: [[189, 10], [183, 17], [137, 17], [72, 17]],
  BULLY: [[189, 10], [183, 17], [137, 17], [72, 17]],
  SWOT: [[112, 17], [145, 17], [158, 17], [37, 3]],
  HEROINE: [[129, 17], [144, 17], [136, 17], [189, 17]],
};

// Which animation states each sprite group can show. The painter in
// render/sprites.js knows how to draw each state; a group without a state
// simply can't do that action (e.g. girls can't fire catapults).
export const SPRITE_GROUPS = {
  ERIC:     ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT', 'ARM_UP', 'HITTING0', 'HITTING1', 'CATAPULT0', 'CATAPULT1', 'RIDING_BIKE0', 'RIDING_BIKE1', 'WATERPISTOL', 'BENDING_OVER'],
  BOY:      ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT'],
  GIRL:     ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT'],
  SWOT:     ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT'],
  BULLY:    ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT', 'HITTING0', 'HITTING1'],
  TEARAWAY: ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT', 'ARM_UP', 'CATAPULT0', 'CATAPULT1'],
  HEROINE:  ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'SITTING_ON_CHAIR', 'SITTING_ON_FLOOR', 'KNOCKED_OUT', 'ARM_UP', 'KISSING_ERIC'],
  WACKER:   ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'KNOCKED_OVER', 'ARM_UP'],
  WITHIT:   ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'KNOCKED_OVER', 'ARM_UP'],
  ROCKITT:  ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'KNOCKED_OVER', 'ARM_UP'],
  CREAK:    ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'KNOCKED_OVER', 'ARM_UP'],
  TAKE:     ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'KNOCKED_OVER', 'ARM_UP'],
  ALBERT:   ['WALK0', 'WALK1', 'WALK2', 'WALK3', 'KNOCKED_OVER', 'ARM_UP'],
};
