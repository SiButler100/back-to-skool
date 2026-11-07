// ============================================================================
// SCHOOL MAP DATA
// ----------------------------------------------------------------------------
// Everything about the physical school lives here: where the floors are, where
// the stairs go, which walls block you, where the rooms, blackboards, desks,
// doors, windows and cups are.
//
// All coordinates are in "cells". One cell is 8 screen pixels. The school is
// 192 cells wide (x = 0..191) and 21 cells tall (y = 0..20). A character's
// (x, y) is the TOP-LEFT cell of its 3-cell-wide, 4-cell-tall sprite, so a
// character "standing on" the bottom floor (y = 17) has its feet in row 20.
//
// Floors are at y = 17 (ground), 10 (middle) and 3 (top).
//
// If you want to move a room, add a desk, or add a new staircase, this is the
// file to edit. The engine reads this data; it has no built-in knowledge of the
// school layout.
// ============================================================================

export const SKOOL = {
  width: 192,   // cells
  height: 21,   // cells
  cell: 8,      // pixels per cell

  // The playground: x range where Eric counts as being "outside".
  playground: [96, 158],

  // Walls block movement AND sight. (id, x, bottomY, topY)
  // A wall at column x stops a character whose top row y satisfies
  // topY - 4 < y <= bottomY from crossing from x-1 to x.
  walls: [
    { id: 'FarLeftWall',     x: 0,   bottomY: 20, topY: 0 },
    { id: 'FarRightWall',    x: 191, bottomY: 20, topY: 0 },
    { id: 'ScienceLabWall',  x: 64,  bottomY: 13, topY: 7 },
    { id: 'TopRightWall',    x: 93,  bottomY: 6,  topY: 5 },
    { id: 'MiddleRightWall', x: 95,  bottomY: 13, topY: 12 },
    { id: 'TopLeftWall',     x: 160, bottomY: 6,  topY: 0 },
    { id: 'MiddleLeftWall',  x: 160, bottomY: 13, topY: 7 },
  ],

  // Rooms: a rectangle of cells. "getAlong" means a teacher will tell Eric to
  // get along if he's found here when the timetable says he should be elsewhere.
  rooms: [
    { id: 'BlueRoom',     name: 'BLUE ROOM',   topLeft: [0, 0],    bottomRight: [23, 6],   getAlong: true },
    { id: 'YellowRoom',   name: 'YELLOW ROOM', topLeft: [40, 0],   bottomRight: [63, 6],   getAlong: true },
    { id: 'ScienceLab',   name: 'SCIENCE LAB', topLeft: [30, 7],   bottomRight: [54, 13],  getAlong: true },
    { id: 'MiddleRoom',   name: 'MIDDLE ROOM', topLeft: [159, 7],  bottomRight: [179, 13], getAlong: true },
    { id: 'UpperRoom',    name: 'UPPER ROOM',  topLeft: [159, 0],  bottomRight: [180, 6],  getAlong: true },
    { id: 'DinnerHall',   name: 'DINNER',      topLeft: [42, 14],  bottomRight: [62, 20],  getAlong: false },
    { id: 'AssemblyHall', name: 'ASSEMBLY',    topLeft: [63, 14],  bottomRight: [76, 20],  getAlong: false },
  ],

  // Blackboards: 8 cells wide, 2 tall. Characters write on them.
  blackboards: [
    { room: 'BlueRoom',   topLeft: [3, 3],   size: [8, 2] },
    { room: 'YellowRoom', topLeft: [41, 3],  size: [8, 2] },
    { room: 'ScienceLab', topLeft: [32, 9],  size: [8, 2] },
    { room: 'UpperRoom',  topLeft: [161, 3], size: [8, 2] },
    { room: 'MiddleRoom', topLeft: [161, 9], size: [8, 2] },
  ],

  // Chairs (and desks, which sit at the same x) per room. The first chair in
  // each list is the FRONT seat (nearest the blackboard).
  chairs: {
    BlueRoom:   [11, 13, 15, 17, 19, 21],
    YellowRoom: [50, 52, 54, 56, 58, 60],
    ScienceLab: [40, 42, 44, 46, 48, 50, 52],
    MiddleRoom: [167, 169, 171, 173, 175, 177],
    UpperRoom:  [168, 170, 172, 174, 176, 178],
  },
  desks: {
    BlueRoom:   [11, 13, 15, 17, 19, 21],
    YellowRoom: [50, 52, 54, 56, 58, 60],
    ScienceLab: [40, 42, 44, 46, 48, 50, 52],
    MiddleRoom: [167, 169, 171, 173, 175, 177],
    UpperRoom:  [168, 170, 172, 174, 176, 178],
  },

  // Doors. autoShutDelay > 0 means the door closes itself that many ticks after
  // being opened. "coords" is where the door is drawn. climb/fly name animation
  // sequences Eric uses to get over the gate.
  doors: [
    { id: 'StudyBackDoor',  x: 73,  bottomY: 6,  topY: 0,  shut: true,  autoShutDelay: 40, coords: [71, 2],   size: [3, 5] },
    { id: 'StudyDoor',      x: 84,  bottomY: 6,  topY: 0,  shut: true,  autoShutDelay: 40, coords: [84, 2],   size: [3, 5] },
    { id: 'ScienceLabDoor', x: 54,  bottomY: 13, topY: 7,  shut: true,  autoShutDelay: 40, coords: [54, 9],   size: [3, 5] },
    { id: 'SkoolDoor',      x: 95,  bottomY: 20, topY: 14, shut: false, autoShutDelay: 0,  coords: [93, 16],  size: [3, 5] },
    { id: 'SkoolGate',      x: 134, bottomY: 20, topY: 14, shut: false, autoShutDelay: 0,  coords: [132, 17], size: [4, 4], climb: 'ClimbSkoolGate', fly: 'FlyOverSkoolGate' },
    // The drinks cabinet is modelled as a "door" that never blocks anyone.
    { id: 'DrinksCabinet',  x: 0,   bottomY: 0,  topY: 0,  shut: true,  autoShutDelay: 0,  coords: [190, 2],  size: [2, 2] },
  ],

  // Windows Eric can climb out of once opened. "openerCoords" is where a
  // teacher stands to open it. "notABird" means jumping out expels Eric.
  windows: [
    { id: 'UpperWindow',  x: 93, bottomY: 4,  topY: 2, shut: true, openerCoords: [90, 3],  coords: [92, 2], size: [3, 3], descent: 'DescentUpperWindow',  notABird: 'ExpelEric:NotABird' },
    { id: 'MiddleWindow', x: 95, bottomY: 11, topY: 8, shut: true, openerCoords: [92, 10], coords: [94, 8], size: [2, 4], descent: 'DescentMiddleWindow' },
  ],

  // Floors: horizontal strips a character can stand on.
  floors: [
    { id: 'Bottom',      minX: 0,   maxX: 191, y: 17 },
    { id: 'Stage',       minX: 77,  maxX: 81,  y: 14 },
    { id: 'LeftMiddle',  minX: 0,   maxX: 64,  y: 10 },
    { id: 'RightMiddle', minX: 85,  maxX: 94,  y: 10 },
    { id: 'GirlsMiddle', minX: 159, maxX: 191, y: 10 },
    { id: 'LeftTop',     minX: 0,   maxX: 73,  y: 3 },
    { id: 'RightTop',    minX: 74,  maxX: 94,  y: 3 },
    { id: 'GirlsTop',    minX: 159, maxX: 191, y: 3 },
  ],

  // Staircases: a diagonal from "bottom" to "top", one cell across per cell up.
  // "force" means you can't walk past the end without going up/down it.
  staircases: [
    { id: 'UpToToilets',     alias: 'DownFromToilets', bottom: [22, 17],  top: [15, 10] },
    { id: 'UpToStage',       alias: 'DownFromStage',   bottom: [83, 17],  top: [80, 14] },
    { id: 'GirlsSkoolLower',                           bottom: [176, 17], top: [183, 10] },
    { id: 'UpFromStage',     alias: 'DownToStage',     bottom: [81, 14],  top: [85, 10], force: true },
    { id: 'UpToLibrary',     alias: 'DownFromLibrary', bottom: [19, 10],  top: [26, 3] },
    { id: 'UpToStudy',       alias: 'DownFromStudy',   bottom: [91, 10],  top: [84, 3] },
    { id: 'GirlsSkoolUpper',                           bottom: [186, 10], top: [179, 3] },
  ],

  // Routes: from a floor, which staircase takes you towards a destination
  // floor. '*' is the default for any floor not listed.
  routes: {
    Bottom:      { LeftMiddle: 'UpToToilets', LeftTop: 'UpToToilets', GirlsMiddle: 'GirlsSkoolLower', GirlsTop: 'GirlsSkoolLower', '*': 'UpToStage' },
    Stage:       { RightMiddle: 'UpFromStage', RightTop: 'UpFromStage', '*': 'UpToStage' },
    LeftMiddle:  { LeftTop: 'UpToLibrary', '*': 'UpToToilets' },
    RightMiddle: { RightTop: 'UpToStudy', '*': 'UpFromStage' },
    GirlsMiddle: { GirlsTop: 'GirlsSkoolUpper', '*': 'GirlsSkoolLower' },
    LeftTop:     { '*': 'UpToLibrary' },
    RightTop:    { '*': 'UpToStudy' },
    GirlsTop:    { '*': 'GirlsSkoolUpper' },
  },

  // Places Eric must never be (a teacher who sees him there gives lines).
  noGoZones: [
    { id: 'GirlsSkool',          minX: 159, maxX: 195, bottomY: 17, topY: 0 },
    { id: 'AroundStage',         minX: 77,  maxX: 94,  bottomY: 16, topY: 4 },
    { id: 'HeadsArea',           minX: 63,  maxX: 93,  bottomY: 3,  topY: 0 },
    { id: 'ScienceLabStoreroom', minX: 54,  maxX: 63,  bottomY: 10, topY: 4 },
  ],

  // The safe in the head's study (Eric jumps up to it with the key).
  safe: { x: 81, y: 2 },

  // Cups on the walls. Eric fills them with the water pistol; a catapult pellet
  // knocks the contents onto whoever is underneath.
  cups: [
    { id: 'LeftCup',   x: 25,  y: 14 },
    { id: 'MiddleCup', x: 27,  y: 14 },
    { id: 'RightCup',  x: 30,  y: 14 },
    { id: 'GirlsCup',  x: 186, y: 14 },
  ],

  // Plant pots. Water makes the plant grow; Eric can stand on a grown plant.
  plants: [
    { id: 'TopFloorPlant',    x: 91,  y: 3 },
    { id: 'MiddleFloorPlant', x: 93,  y: 10 },
    { id: 'LeftGatePlant',    x: 132, y: 17 },
    { id: 'RightGatePlant',   x: 135, y: 17 },
  ],

  // The conker in the tree: a pellet landing in this box knocks it down.
  conker: { minX: 98, maxX: 102, minY: 2, maxY: 3 },

  // Where the bike appears once unchained, and its physics.
  bike: { x: 100, y: 17, moveDelay: 3, pedalMomentum: 2, maxMomentum: 50 },

  // The frog starts in the science lab storeroom.
  frog: { x: 59, y: 10, ericProximity: 4 },

  // Where the mouse may turn up.
  mouseLocations: [[10, 3], [88, 3], [170, 3], [10, 10], [88, 10], [170, 10], [10, 17], [88, 17], [170, 17]],

  // Named locations the AI command lists refer to.
  locations: {
    'AssemblyHall:0': [71, 17], 'AssemblyHall:1': [73, 17], 'AssemblyHall:2': [75, 17],
    'AssemblyHall:Back': [65, 17], 'AssemblyHall:WayBack': [62, 17],
    'AssemblyHallStage:Edge': [77, 14], 'AssemblyHallStage:Middle': [79, 14],
    'BlueRoom:0': [21, 3], 'BlueRoom:1': [22, 3],
    'BlueRoomBlackboard:Edge': [11, 3], 'BlueRoomBlackboard:Middle': [6, 3], 'BlueRoomDoorway': [23, 3],
    'BoysDinnerHall:0': [53, 17], 'BoysDinnerHall:1': [54, 17], 'BoysDinnerHall:End1': [40, 17], 'BoysDinnerHall:End2': [61, 17],
    'BoysPlayground:Middle': [112, 17], 'BoysSkoolDoor': [95, 17], 'CloakRoom': [3, 17],
    'DrinksCabinet': [188, 3], 'GirlsDinnerHall': [174, 17], 'GirlsMiddleFloorWindow': [188, 10],
    'HeadsStudy:0': [81, 3], 'HeadsStudy:Window': [76, 3], 'JustOutsideToilets': [18, 10], 'JustRightOfTree': [104, 17],
    'Kitchen': [189, 17], 'MiddleRoom': [174, 10],
    'MiddleRoomBlackboard:Edge': [169, 10], 'MiddleRoomBlackboard:Middle': [164, 10], 'MiddleRoomDoorway': [179, 10],
    'RevisionLibrary': [31, 3], 'RevisionLibrary:0': [36, 3], 'RevisionLibrary:1': [37, 3],
    'ScienceLab:0': [48, 10], 'ScienceLab:1': [50, 10], 'ScienceLab:2': [51, 10],
    'ScienceLabBlackboard:Edge': [40, 10], 'ScienceLabBlackboard:Middle': [35, 10], 'ScienceLabDoorway': [28, 10],
    'SkoolGate:ToOpen': [132, 17], 'SkoolGate:ToShut': [130, 17], 'TakesStudyDoorway': [183, 3],
    'TopOfStairsDownToStage': [85, 10], 'UpperRoom': [177, 3],
    'UpperRoomBlackboard:Edge': [169, 3], 'UpperRoomBlackboard:Middle': [164, 3], 'UpperRoomDoorway': [180, 3],
    'YellowRoom:0': [55, 3], 'YellowRoom:1': [56, 3],
    'YellowRoomBlackboard:Edge': [49, 3], 'YellowRoomBlackboard:Middle': [44, 3], 'YellowRoomDoorway': [38, 3],
  },

  // Animation sequences for special movements. Each step is [xInc, yInc, state].
  animationPhases: {
    DescentMiddleWindow: [
      [0, 0, 'WALK1'], [1, 0, 'WALK2'], [0, 0, 'WALK3'], [1, 0, 'WALK0'],
      [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'],
      [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'],
    ],
    DescentUpperWindow: [
      [0, 0, 'WALK1'], [1, 0, 'WALK2'], [0, 0, 'WALK3'], [1, 0, 'WALK0'],
      [1, 1, 'WALK0'], [1, 1, 'WALK0'], [1, 1, 'WALK0'], [1, 1, 'WALK0'],
      [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'], [0, 1, 'WALK0'],
      [0, 1, 'SITTING_ON_CHAIR'], [0, 1, 'SITTING_ON_CHAIR'], [0, 1, 'SITTING_ON_CHAIR'],
      [0, 1, 'SITTING_ON_FLOOR'], [0, 1, 'SITTING_ON_FLOOR'], [0, 1, 'SITTING_ON_FLOOR'], [0, 1, 'KNOCKED_OUT'],
    ],
    ClimbSkoolGate: [
      [0, 0, 'WALK1'], [1, 0, 'WALK2'], [0, 0, 'WALK3'], [1, 0, 'WALK0'], [0, 0, 'WALK1'], [1, 0, 'WALK2'],
      [0, 1, 'WALK2'], [0, 1, 'WALK2'], [0, 1, 'WALK2'],
    ],
    FlyOverSkoolGate: [
      [1, -1, 'WALK0'], [1, -1, 'WALK0'], [1, -1, 'WALK0'], [1, 1, 'WALK0'], [1, 1, 'SITTING_ON_CHAIR'],
      [1, 0, 'SITTING_ON_FLOOR'], [1, 1, 'SITTING_ON_FLOOR'], [1, 1, 'SITTING_ON_FLOOR'],
    ],
    // Water pistol jet: [state, xInc, yInc, hitCheck] (1 = check cups, 2 = check plants)
    Water: [
      ['WATER1', 2, -1, 0], ['WATER2', 2, 0, 1], ['WATER3', 1, 0, 0], ['WATER4', 0, 1, 0], ['WATER4', 0, 1, 2],
    ],
    // Frog hops: [state, xInc, directionChange]
    FrogTurnRound: [['HOP1', 0, 1], ['SIT', 0, -1]],
    FrogShortHop:  [['HOP1', 1, 1], ['SIT', 0, 1]],
    FrogLongHop:   [['HOP1', 1, 1], ['HOP2', 1, 1], ['HOP1', 1, 1], ['SIT', 0, 1]],
  },
};
