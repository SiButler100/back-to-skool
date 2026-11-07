// ============================================================================
// THE TIMETABLE
// ----------------------------------------------------------------------------
// The school day is a loop of 64 periods. Each period names a "lesson"; each
// lesson says which teacher (if any) is teaching Eric, in which room, and
// which AI routine every other character follows for that period.
//
// Lesson ids: "Creak-BlueRoom-1" means Mr Creak teaches Eric in the Blue Room
// (variant 1: the other characters' routines differ between variants).
// "RevisionLibrary-1" is unsupervised; "Playtime-N" is playtime; "Assembly" and
// "Dinner-X" are whole-school periods.
//
// To make the day shorter for testing, trim the TIMETABLE array.
// ============================================================================

export const TIMETABLE = [
  'Playtime-5', 'Creak-YellowRoom-2', 'Assembly', 'Rockitt-ScienceLab-2', 'RevisionLibrary-2',
  'Playtime-3', 'Rockitt-ScienceLab-3', 'Creak-BlueRoom-1', 'Playtime-4', 'Rockitt-ScienceLab-2',
  'RevisionLibrary-2', 'Dinner-Withit', 'Playtime-4', 'Rockitt-ScienceLab-1', 'Assembly',
  'Creak-YellowRoom-1', 'Playtime-5', 'RevisionLibrary-1', 'Rockitt-ScienceLab-3', 'Assembly',
  'Playtime-4', 'Withit-BlueRoom-1', 'RevisionLibrary-2', 'Rockitt-ScienceLab-1', 'Playtime-1',
  'Rockitt-ScienceLab-2', 'Creak-YellowRoom-2', 'RevisionLibrary-2', 'Playtime-2', 'Withit-ScienceLab-1',
  'Assembly', 'Withit-YellowRoom-2', 'Playtime-5', 'Rockitt-ScienceLab-3', 'Creak-BlueRoom-1',
  'Assembly', 'Playtime-5', 'Withit-BlueRoom-2', 'RevisionLibrary-1', 'Creak-YellowRoom-2',
  'Playtime-3', 'Withit-ScienceLab-2', 'Rockitt-ScienceLab-2', 'RevisionLibrary-1', 'Playtime-4',
  'Creak-YellowRoom-1', 'Assembly', 'Rockitt-ScienceLab-3', 'Playtime-5', 'Creak-BlueRoom-1',
  'Assembly', 'Withit-BlueRoom-1', 'Rockitt-ScienceLab-1', 'Playtime-4', 'Withit-ScienceLab-1',
  'RevisionLibrary-1', 'Playtime-2', 'Creak-BlueRoom-2', 'RevisionLibrary-2', 'Dinner-Wacker',
  'Playtime-1', 'Creak-YellowRoom-1', 'Assembly', 'Withit-ScienceLab-2',
];

// Shorthand used below so the big table stays readable.
const G = (room) => `${room}-Girl`;          // girl goes to a room
const B = (room) => `${room}-Boy`;           // boy goes to a room
const T = (room) => `${room}-Teacher`;       // teacher teaches in a room
const K = 'Kitchen-Girl', D = 'DinnerHall-Girl', R = 'RevisionLibrary-Boy';
const W = 'PlaytimeWalkabout-Boy/Girl';

// Build a lesson record. "cast" maps character id -> command list id.
function lesson(teacher, room, cast) {
  return { teacher, room, cast };
}

// Helper: assign the seven girls and ten boys in one go.
function kids(girls, boys) {
  const out = {};
  girls.forEach((cl, i) => { out[`GIRL0${i + 1}`] = cl; });
  boys.forEach((cl, i) => { out[`BOY${String(i + 1).padStart(2, '0')}`] = cl; });
  return out;
}

const UR = G('UpperRoom'), MR = G('MiddleRoom');
const BR = B('BlueRoom'), YR = B('YellowRoom'), SL = B('ScienceLab');

export const LESSONS = {
  'Creak-BlueRoom-1': lesson('CREAK', 'BlueRoom', {
    ...kids([UR, UR, UR, UR, UR, K, K], [YR, BR, YR, YR, YR, YR, YR, YR, YR, BR]),
    WACKER: 'HeadsStudy', WITHIT: T('YellowRoom'), ROCKITT: 'Walkabout2-Teacher', CREAK: T('BlueRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'BlueRoom-Tearaway', BULLY: 'BlueRoom-Bully', SWOT: 'BlueRoom-Swot', HEROINE: UR,
  }),
  'Creak-BlueRoom-2': lesson('CREAK', 'BlueRoom', {
    ...kids([D, D, MR, MR, MR, MR, MR], [SL, SL, BR, SL, SL, SL, BR, BR, SL, BR]),
    WACKER: 'Walkabout2-Wacker', WITHIT: 'Walkabout1-Teacher', ROCKITT: T('ScienceLab'), CREAK: T('BlueRoom'), TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'ScienceLab-Tearaway', BULLY: 'BlueRoom-Bully', SWOT: 'BlueRoom-Swot', HEROINE: MR,
  }),
  'Creak-YellowRoom-1': lesson('CREAK', 'YellowRoom', {
    ...kids([UR, UR, UR, MR, MR, MR, UR], [BR, BR, YR, SL, YR, SL, YR, BR, SL, YR]),
    WACKER: 'HeadsStudy', WITHIT: T('BlueRoom'), ROCKITT: T('ScienceLab'), CREAK: T('YellowRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'YellowRoom-Tearaway', BULLY: 'YellowRoom-Bully', SWOT: 'YellowRoom-Swot', HEROINE: UR,
  }),
  'Creak-YellowRoom-2': lesson('CREAK', 'YellowRoom', {
    ...kids([K, K, K, MR, MR, MR, MR], [R, R, YR, R, YR, SL, BR, BR, SL, YR]),
    WACKER: 'Walkabout2-Wacker', WITHIT: T('BlueRoom'), ROCKITT: T('ScienceLab'), CREAK: T('YellowRoom'), TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'YellowRoom-Tearaway', BULLY: 'ScienceLab-Bully', SWOT: 'YellowRoom-Swot', HEROINE: K,
  }),
  'Withit-BlueRoom-1': lesson('WITHIT', 'BlueRoom', {
    ...kids([UR, UR, D, UR, UR, D, UR], [BR, BR, YR, BR, R, R, R, YR, YR, BR]),
    WACKER: 'HeadsStudy', WITHIT: T('BlueRoom'), ROCKITT: 'Walkabout2-Teacher', CREAK: T('YellowRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'BlueRoom-Tearaway', BULLY: 'YellowRoom-Bully', SWOT: 'BlueRoom-Swot', HEROINE: D,
  }),
  'Withit-BlueRoom-2': lesson('WITHIT', 'BlueRoom', {
    ...kids([UR, MR, MR, MR, MR, UR, UR], [YR, BR, BR, YR, BR, YR, YR, R, R, BR]),
    WACKER: 'Walkabout2-Wacker', WITHIT: T('BlueRoom'), ROCKITT: T('YellowRoom'), CREAK: 'Walkabout2-Teacher', TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'RevisionLibrary-Tearaway', BULLY: 'BlueRoom-Bully', SWOT: 'BlueRoom-Swot', HEROINE: UR,
  }),
  'Withit-YellowRoom-1': lesson('WITHIT', 'YellowRoom', {
    ...kids([MR, MR, UR, UR, MR, MR, MR], [BR, SL, YR, BR, SL, BR, SL, BR, SL, YR]),
    WACKER: 'HeadsStudy', WITHIT: T('YellowRoom'), ROCKITT: T('ScienceLab'), CREAK: T('BlueRoom'), TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'YellowRoom-Tearaway', BULLY: 'BlueRoom-Bully', SWOT: 'YellowRoom-Swot', HEROINE: MR,
  }),
  'Withit-YellowRoom-2': lesson('WITHIT', 'YellowRoom', {
    ...kids([UR, UR, UR, K, K, UR, UR], [R, BR, R, BR, YR, SL, SL, BR, SL, YR]),
    WACKER: 'Walkabout2-Wacker', WITHIT: T('YellowRoom'), ROCKITT: T('ScienceLab'), CREAK: T('BlueRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'YellowRoom-Tearaway', BULLY: 'RevisionLibrary-Bully', SWOT: 'YellowRoom-Swot', HEROINE: K,
  }),
  'Withit-ScienceLab-1': lesson('WITHIT', 'ScienceLab', {
    ...kids([UR, UR, MR, UR, UR, MR, MR], [SL, YR, YR, YR, YR, YR, R, R, YR, SL]),
    WACKER: 'HeadsStudy', WITHIT: T('ScienceLab'), ROCKITT: 'Walkabout2-Teacher', CREAK: T('YellowRoom'), TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'ScienceLab-Tearaway', BULLY: 'ScienceLab-Bully', SWOT: 'ScienceLab-Swot', HEROINE: D,
  }),
  'Withit-ScienceLab-2': lesson('WITHIT', 'ScienceLab', {
    ...kids([UR, UR, UR, UR, UR, UR, UR], [YR, SL, BR, R, YR, SL, BR, R, YR, SL]),
    WACKER: 'Walkabout2-Wacker', WITHIT: T('ScienceLab'), ROCKITT: T('YellowRoom'), CREAK: T('BlueRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'RevisionLibrary-Tearaway', BULLY: 'YellowRoom-Bully', SWOT: 'ScienceLab-Swot', HEROINE: UR,
  }),
  'Rockitt-ScienceLab-1': lesson('ROCKITT', 'ScienceLab', {
    ...kids([UR, UR, UR, MR, MR, MR, MR], [YR, BR, YR, BR, BR, BR, YR, YR, YR, SL]),
    WACKER: 'HeadsStudy', WITHIT: T('YellowRoom'), ROCKITT: T('ScienceLab'), CREAK: T('BlueRoom'), TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'ScienceLab-Tearaway', BULLY: 'ScienceLab-Bully', SWOT: 'ScienceLab-Swot', HEROINE: MR,
  }),
  'Rockitt-ScienceLab-2': lesson('ROCKITT', 'ScienceLab', {
    ...kids([MR, MR, MR, UR, UR, UR, UR], [SL, BR, SL, R, R, BR, BR, BR, BR, SL]),
    WACKER: 'Walkabout2-Wacker', WITHIT: 'Walkabout1-Teacher', ROCKITT: T('ScienceLab'), CREAK: T('BlueRoom'), TAKE: T('MiddleRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'BlueRoom-Tearaway', BULLY: 'ScienceLab-Bully', SWOT: 'ScienceLab-Swot', HEROINE: MR,
  }),
  'Rockitt-ScienceLab-3': lesson('ROCKITT', 'ScienceLab', {
    ...kids([D, D, K, K, D, UR, UR], [BR, YR, BR, YR, BR, YR, R, SL, BR, SL]),
    WACKER: 'HeadsStudy', WITHIT: T('BlueRoom'), ROCKITT: T('ScienceLab'), CREAK: T('YellowRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'ScienceLab-Tearaway', BULLY: 'RevisionLibrary-Bully', SWOT: 'ScienceLab-Swot', HEROINE: UR,
  }),
  'Dinner-Wacker': lesson('WACKER', 'DinnerHall', {
    ...kids([D, D, D, D, D, D, D], Array(10).fill('Dinner-Boy')),
    WACKER: 'DinnerDuty', WITHIT: 'Walkabout1-Teacher', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'Kitchen-Teacher',
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'Dinner-Tearaway', BULLY: 'Dinner-Bully', SWOT: 'Dinner-Boy', HEROINE: D,
  }),
  'Dinner-Withit': lesson('WITHIT', 'DinnerHall', {
    ...kids([D, D, D, D, D, D, D], Array(10).fill('Dinner-Boy')),
    WACKER: 'Walkabout2-Wacker', WITHIT: 'DinnerDuty', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'Kitchen-Teacher',
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'Dinner-Tearaway', BULLY: 'Dinner-Bully', SWOT: 'Dinner-Boy', HEROINE: D,
  }),
  'Assembly': lesson('WITHIT', 'AssemblyHall', {
    ...kids([D, D, D, D, D, D, D], ['Assembly-Boy-1', 'Assembly-Boy-1', 'Assembly-Boy-1', 'Assembly-Boy-1', 'Assembly-Boy-2', 'Assembly-Boy-2', 'Assembly-Boy-2', 'Assembly-Boy-2', 'Assembly-Boy-2', 'Assembly-Boy-1']),
    WACKER: 'Assembly-Wacker', WITHIT: 'AssemblyDuty', ROCKITT: 'Assembly-Teacher', CREAK: 'Assembly-Teacher', TAKE: 'Kitchen-Teacher',
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'Assembly-Tearaway', BULLY: 'Assembly-Bully', SWOT: 'Assembly-Boy-1', HEROINE: D,
  }),
  'RevisionLibrary-1': lesson(null, 'REVISION LIBRARY', {
    ...kids([UR, MR, UR, MR, MR, MR, UR], [YR, SL, R, YR, SL, R, SL, YR, YR, R]),
    WACKER: 'HeadsStudy', WITHIT: 'Walkabout1-Teacher', ROCKITT: T('ScienceLab'), CREAK: T('YellowRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'RevisionLibrary-Tearaway', BULLY: 'RevisionLibrary-Bully', SWOT: R, HEROINE: UR,
  }),
  'RevisionLibrary-2': lesson(null, 'REVISION LIBRARY', {
    ...kids([MR, MR, UR, UR, UR, UR, UR], [BR, BR, SL, SL, YR, YR, BR, YR, SL, R]),
    WACKER: 'Walkabout2-Wacker', WITHIT: T('BlueRoom'), ROCKITT: T('ScienceLab'), CREAK: T('YellowRoom'), TAKE: T('UpperRoom'),
    ALBERT: 'ShutGateAndDoor-Albert', TEARAWAY: 'BlueRoom-Tearaway', BULLY: 'RevisionLibrary-Bully', SWOT: R, HEROINE: UR,
  }),
  'Playtime-1': lesson(null, 'PLAYTIME', {
    ...kids([W, W, W, W, W, W, W], [R, R, R, W, W, W, W, W, W, W]),
    WACKER: 'Walkabout1-Wacker', WITHIT: 'Walkabout2-Teacher', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'Kitchen-Teacher',
    ALBERT: 'OpenGateAndDoor-Albert', TEARAWAY: 'WriteOnBoardsInBoysSkool-Tearaway', BULLY: 'StalkHeroine-Bully', SWOT: W, HEROINE: K,
  }),
  'Playtime-2': lesson(null, 'PLAYTIME', {
    ...kids([W, W, W, W, W, W, W], [W, W, W, W, W, W, W, W, W, W]),
    WACKER: 'Walkabout1-Wacker', WITHIT: 'Walkabout2-Teacher', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'GirlsSkoolWalkabout-Teacher',
    ALBERT: 'OpenGateAndDoor-Albert', TEARAWAY: 'WriteOnBoardsInBoysSkool-Tearaway', BULLY: 'Walkabout-Bully', SWOT: W, HEROINE: K,
  }),
  'Playtime-3': lesson(null, 'PLAYTIME', {
    ...kids([W, W, W, W, W, W, W], [W, W, W, W, W, W, W, W, W, W]),
    WACKER: 'Walkabout1-Wacker', WITHIT: 'Walkabout2-Teacher', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'Kitchen-Teacher',
    ALBERT: 'OpenGateAndDoor-Albert', TEARAWAY: 'WriteOnBoardsInGirlsSkool-Tearaway', BULLY: 'StalkHeroine-Bully', SWOT: W, HEROINE: W,
  }),
  'Playtime-4': lesson(null, 'PLAYTIME', {
    ...kids([W, W, W, W, W, W, W], [W, W, W, W, W, W, W, W, W, W]),
    WACKER: 'Walkabout1-Wacker', WITHIT: 'Walkabout2-Teacher', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'GirlsSkoolWalkabout-Teacher',
    ALBERT: 'OpenGateAndDoor-Albert', TEARAWAY: 'Walkabout-Tearaway', BULLY: 'Walkabout-Bully', SWOT: W, HEROINE: W,
  }),
  'Playtime-5': lesson(null, 'PLAYTIME', {
    ...kids([W, W, W, W, W, W, W], [W, W, W, W, W, W, W, W, W, W]),
    WACKER: 'Walkabout1-Wacker', WITHIT: 'Walkabout2-Teacher', ROCKITT: 'Walkabout2-Teacher', CREAK: 'Walkabout2-Teacher', TAKE: 'Kitchen-Teacher',
    ALBERT: 'OpenGateAndDoor-Albert', TEARAWAY: 'Walkabout-Tearaway', BULLY: 'StalkHeroine-Bully', SWOT: W, HEROINE: W,
  }),
};

// Periods whose teacher name is NOT shown in the lesson box (the teacher is
// only supervising, not teaching a class). Mirrors the '*' in the original data.
export const HIDE_TEACHER = new Set(['Dinner-Wacker', 'Dinner-Withit', 'Assembly']);
