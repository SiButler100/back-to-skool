// ============================================================================
// DECOR (how the rooms look; the engine never reads this)
// ----------------------------------------------------------------------------
// data/skool.js says where things ARE (walls, floors, doors, boards, desks).
// This file says what the rooms LOOK like in the HD view: which stretch of
// each storey is which room, what colour its walls are, and the furniture
// that is only decoration (bookcases, benches, windows that do not open).
// Columns are cells (8 Spectrum pixels; 192 across the school). Changing a
// number here moves a picture; it cannot change the game.
//
// Storeys: "top" is rows 0-6 (people stand with y = 3), "middle" rows 7-13
// (y = 10) and "ground" rows 14-20 (y = 17).
// Props are [kind, column, width-in-cells]; see render/hd/backdrop.js for kinds.
// ============================================================================

export const DECOR = {
  buildings: [
    { id: 'boys', x0: 0, x1: 96, brick: 'boys' },
    { id: 'girls', x0: 159, x1: 192, brick: 'girls' },
  ],
  zones: [
    // ---- Top storey ----------------------------------------------------------
    { id: 'BlueRoom', storey: 'top', x0: 0, x1: 24, wall: 'blue', plaque: 'BLUE ROOM', props: [['window', 1, 3], ['window', 14, 3], ['window', 18, 3]] },
    { id: 'Library', storey: 'top', x0: 24, x1: 40, wall: 'green', plaque: 'LIBRARY', props: [['bookcase', 24, 7], ['bookcase', 32, 7]] },
    { id: 'YellowRoom', storey: 'top', x0: 40, x1: 64, wall: 'yellow', plaque: 'YELLOW ROOM', props: [['window', 41, 3], ['window', 45, 3], ['window', 49, 3]] },
    { id: 'HeadsCorridor', storey: 'top', x0: 64, x1: 71, wall: 'cream', props: [['bookcase', 65, 4]] },
    { id: 'HeadsStudy', storey: 'top', x0: 74, x1: 84, wall: 'study', props: [['picture', 74, 1], ['window', 76, 3], ['picture', 79, 1], ['shelf', 80, 3]] },
    { id: 'Landing', storey: 'top', x0: 87, x1: 95, wall: 'yellow', props: [['bookcase', 87, 4]] },
    { id: 'UpperRoom', storey: 'top', x0: 159, x1: 181, wall: 'blue', plaque: 'UPPER ROOM', props: [['window', 160, 1]] },
    { id: 'TakesStudy', storey: 'top', x0: 181, x1: 192, wall: 'yellow', props: [['window', 184, 2], ['shelf', 188, 3]] },
    // ---- Middle storey -------------------------------------------------------
    { id: 'Toilets', storey: 'middle', x0: 0, x1: 15, wall: 'tiles', props: [['cubicles', 1, 13]] },
    { id: 'Corridor', storey: 'middle', x0: 15, x1: 30, wall: 'yellow', props: [['picture', 16, 1]] },
    { id: 'ScienceLab', storey: 'middle', x0: 30, x1: 55, wall: 'cream', plaque: 'SCIENCE LAB', props: [['labbench', 41, 11]] },
    { id: 'Storeroom', storey: 'middle', x0: 55, x1: 64, wall: 'cyan', props: [['shelves', 56, 7]] },
    { id: 'HallUpper', storey: 'middle', x0: 64, x1: 77, wall: 'hall', props: [['tallwindows', 64, 12]] },
    { id: 'StageUpper', storey: 'middle', x0: 77, x1: 95, wall: 'yellow' },
    { id: 'MiddleRoom', storey: 'middle', x0: 159, x1: 180, wall: 'yellow', plaque: 'MIDDLE ROOM', props: [['window', 160, 1]] },
    { id: 'GirlsCorridor', storey: 'middle', x0: 180, x1: 192, wall: 'cream', props: [['window', 188, 2]] },
    // ---- Ground storey -------------------------------------------------------
    { id: 'Cloakroom', storey: 'ground', x0: 0, x1: 23, wall: 'green', props: [['pegs', 1, 21], ['bench', 2, 12]] },
    { id: 'CupCorridor', storey: 'ground', x0: 23, x1: 42, wall: 'cream' },
    { id: 'DinnerHall', storey: 'ground', x0: 42, x1: 63, wall: 'cream', plaque: 'DINNER HALL', props: [['hatch', 43, 4], ['table', 47, 14]] },
    { id: 'AssemblyHall', storey: 'ground', x0: 63, x1: 77, wall: 'hall', plaque: 'ASSEMBLY HALL', props: [['curtain', 76, 1]] },
    { id: 'Stage', storey: 'ground', x0: 77, x1: 82, wall: 'yellow', props: [['stage', 77, 5]] },
    { id: 'UnderLanding', storey: 'ground', x0: 82, x1: 93, wall: 'yellow' },
    { id: 'GirlsDinner', storey: 'ground', x0: 159, x1: 181, wall: 'cream', props: [['table', 162, 15]] },
    { id: 'Kitchen', storey: 'ground', x0: 181, x1: 192, wall: 'tiles', props: [['cooker', 182, 2], ['sink', 184, 2], ['cupboards', 188, 3]] },
  ],
  // Outside: the tree, the low wall with its posts, the gate and the railings.
  playground: { x0: 96, x1: 159, treeX: 100, wallTopRow: 17, posts: [111, 131], gate: [133, 138] },
};
