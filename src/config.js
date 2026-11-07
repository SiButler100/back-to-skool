// ============================================================================
// TUNING KNOBS
// ----------------------------------------------------------------------------
// Numbers that change how the game feels. Timings are in "ticks". The game
// logic runs at TICKS_PER_SECOND ticks per second regardless of how fast your
// screen refreshes, so speeding the game up is as simple as raising that one
// number (there is also a speed slider in the options menu).
// ============================================================================

export const CONFIG = {
  ticksPerSecond: 20,          // the original ran its logic about this fast

  // Lesson timing (in ticks)
  lessonLength: 2400,          // 2 minutes at 20 ticks/s
  lessonStartTime: 600,        // teachers start the lesson this long after the bell
  getAlongTime: 200,           // grace period to leave the previous classroom

  // Movement delays (ticks between steps). Lower = faster.
  ericWalkDelay: 2,
  goSlow: 5,                   // walking characters
  goFast: 3,                   // running characters
  goFaster: 2,                 // hitting / firing animations
  jumpDelay: 4,
  bendOverDelay: 4,
  speedChangeDelayRange: [16, 31],

  // How long people stay on the floor
  knockedOutDelay: 10,         // kids
  knockedOverDelay: 15,        // adults
  dethronedDelay: 3,
  reprimandDelay: 8,

  // Lines
  linesRange: [1, 8],          // lines given = 100 x random(1..8)
  linesGivingRange: [10, 3],   // a teacher must be within 10 cells across, 3 down
  minimumLinesDelay: 60,
  maxLines: 10000,             // expelled at this many
  kissLines: 1000,             // a kiss from Hayley knocks this many off
  kissCounter: 40, kissCounterDecrement: 7, kissCounterDeckrement: 1, kissDistance: 2,

  // Probabilities
  fireCatapultProbability: 0.5,
  hitProbability: 0.5,
  writeOnBoardProbability: 0.375,
  ericsTeacherWriteOnBoardProbability: 0.28125,
  grassForHittingProbability: 0.140625,
  linesForTalesProbability: 0.328125,
  qaSessionProbability: 0.90625,

  // Scores
  mouseCatchScore: 100,
  bikeCombinationScore: 1000,
  storeroomCombinationScore: 1000,
  safeKeyScore: 2000,
  upAYearScore: 2000,

  // Misc
  besideEricXRange: 4,
  mouseProximity: 5,
  evadeMouseDelay: 21,
  windowProximity: 16,
  conkerClockTicks: 1200,
  conkerWakeTime: 200,
  maxMiceRelease: 5,
  tellEricDelay: 20,
  blackboardBacktrack: 3,
  blackboardPaceDistance: 3,
  assemblySitDirection: 1,

  // Presentation
  messageBoxTicks: 24,         // how long a lines box stays up (game pauses)
  freezeOnMessages: true,      // pause the world while a lines box shows (authentic)
  viewportColumns: 48,         // how many cells wide the camera window is (original: 32)
  scale: 3,                    // screen pixels per game pixel
};
