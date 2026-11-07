// ============================================================================
// AI ROUTINES ("command lists")
// ----------------------------------------------------------------------------
// Every character who isn't Eric follows a little script each lesson. A script
// is a list of commands, run top to bottom. When a script reaches the end it
// simply stops (the character stands still) unless it ends with 'Restart'.
//
// Each entry is [CommandName, ...arguments]. The command names map to classes
// in engine/commands.js. To invent a new behaviour, add a class there and use
// its name here.
//
// A few special commands:
//   SetControllingCommand  runs a second command "in the background" (e.g.
//                          "fire the catapult now and then" while walking).
//   SetSubcommand          like the above but survives GoTo etc. (Miss Take
//                          watching for Eric).
//   SetRestartPoint        'Restart' goes back to HERE instead of the top.
//   JumpIfShut / JumpIfOpen skip forwards/backwards by N commands.
// ============================================================================

export const COMMAND_LISTS = {
  // ----- Pupils going to class ---------------------------------------------
  'UpperRoom-Girl':  [['GoTo', 'UpperRoom'], ['MoveAboutUntil', 'UpperRoomReady'], ['FindSeat'], ['SitStill']],
  'MiddleRoom-Girl': [['GoTo', 'MiddleRoom'], ['MoveAboutUntil', 'MiddleRoomReady'], ['FindSeat'], ['SitStill']],
  'BlueRoom-Boy':    [['GoTo', 'BlueRoom:1'], ['MoveAboutUntil', 'BlueRoomReady'], ['FindSeat'], ['SitStill']],
  'YellowRoom-Boy':  [['GoTo', 'YellowRoom:1'], ['MoveAboutUntil', 'YellowRoomReady'], ['FindSeat'], ['SitStill']],
  'ScienceLab-Boy':  [['GoTo', 'ScienceLab:1'], ['MoveAboutUntil', 'ScienceLabReady'], ['FindSeat'], ['SitStill']],
  'Kitchen-Girl':    [['GoTo', 'Kitchen'], ['MoveAboutUntil', 'EndOfLesson']],
  'DinnerHall-Girl': [['GoTo', 'GirlsDinnerHall'], ['MoveAboutUntil', 'EndOfLesson']],
  'RevisionLibrary-Boy': [['GoTo', 'RevisionLibrary:1'], ['MoveAboutUntil', 'EndOfLesson']],
  'Dinner-Boy':      [['GoTo', 'BoysDinnerHall:1'], ['MoveAboutUntil', 'EndOfLesson']],
  'PlaytimeWalkabout-Boy/Girl': [['GoToRandomLocation'], ['WalkAround', 10], ['Restart']],
  'Assembly-Boy-1':  [['GoTo', 'AssemblyHall:0'], ['MoveAboutUntil', 'AssemblyStarted'], ['SitForAssembly', 'AssemblyFinished', 1], ['GoToRandomLocation'], ['MoveAboutUntil', 'EndOfLesson']],
  'Assembly-Boy-2':  [['GoTo', 'AssemblyHall:2'], ['MoveAboutUntil', 'AssemblyStarted'], ['SitForAssembly', 'AssemblyFinished', 1], ['GoToRandomLocation'], ['MoveAboutUntil', 'EndOfLesson']],

  // ----- Miss Take ----------------------------------------------------------
  // She checks the school door: if it's shut (boys are inside), she opens her
  // drinks cabinet; if it's open she shuts it and waits.
  'UpperRoom-Teacher': [
    ['SetSubcommand', 'MonitorEric', 'ChaseEricOut-Take', 160],
    ['GoTo', 'TakesStudyDoorway'], ['GoTo', 'DrinksCabinet'],
    ['JumpIfShut', 'SkoolDoor', 2], ['ShutDoor', 'DrinksCabinet'], ['JumpIfOpen', 'SkoolDoor', -5], ['OpenDoor', 'DrinksCabinet'],
    ['SetRestartPoint'],
    ['GoTo', 'TakesStudyDoorway'], ['GoTo', 'UpperRoomDoorway'], ['StartLessonIfReady', 'UpperRoomReady'],
    ['GoTo', 'UpperRoomBlackboard:Edge'], ['ConductClass', 'SwotReadyForLesson'],
  ],
  'MiddleRoom-Teacher': [
    ['SetSubcommand', 'MonitorEric', 'ChaseEricOut-Take', 160],
    ['GoTo', 'TakesStudyDoorway'], ['GoTo', 'DrinksCabinet'],
    ['JumpIfShut', 'SkoolDoor', 2], ['ShutDoor', 'DrinksCabinet'], ['JumpIfOpen', 'SkoolDoor', -5], ['OpenDoor', 'DrinksCabinet'],
    ['SetRestartPoint'],
    ['GoTo', 'GirlsMiddleFloorWindow'], ['GoTo', 'MiddleRoomDoorway'], ['StartLessonIfReady', 'MiddleRoomReady'],
    ['GoTo', 'MiddleRoomBlackboard:Edge'], ['ConductClass', 'SwotReadyForLesson'],
  ],
  'Kitchen-Teacher': [
    ['SetSubcommand', 'MonitorEric', 'ChaseEricOut-Take', 160],
    ['GoTo', 'DrinksCabinet'], ['ShutDoor', 'DrinksCabinet'], ['GoTo', 'Kitchen'], ['MoveAboutUntil', 'EndOfLesson'],
  ],
  'GirlsSkoolWalkabout-Teacher': [['GoTo', 'DrinksCabinet'], ['ShutDoor', 'DrinksCabinet'], ['SetRestartPoint'], ['GoToRandomLocation'], ['Restart']],
  'ChaseEricOut-Take': [['ChaseEricOut', 137]],

  // ----- Dinner duty --------------------------------------------------------
  'DinnerDuty': [
    ['GoTo', 'BoysDinnerHall:End2'], ['GoTo', 'BoysDinnerHall:End1'], ['StartDinnerIfReady'], ['SetRestartPoint'],
    ['GoTo', 'BoysDinnerHall:End2'], ['FindEricIfMissing'], ['GoTo', 'BoysDinnerHall:End1'], ['FindEricIfMissing'], ['Restart'],
  ],

  // ----- Boy Wander (the tearaway) -----------------------------------------
  'ScienceLab-Tearaway': [
    ['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'ScienceLabBlackboard:Middle'], ['WriteOnBoardUnless', 'ScienceLabReady'],
    ['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'ScienceLab:0'],
    ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'ScienceLabReady'], ['FindSeat'], ['SitStill'],
  ],
  'BlueRoom-Tearaway': [
    ['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'BlueRoomBlackboard:Middle'], ['WriteOnBoardUnless', 'BlueRoomReady'],
    ['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'BlueRoom:0'],
    ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'BlueRoomReady'], ['FindSeat'], ['SitStill'],
  ],
  'YellowRoom-Tearaway': [
    ['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'YellowRoomBlackboard:Middle'], ['WriteOnBoardUnless', 'YellowRoomReady'],
    ['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'YellowRoom:0'],
    ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'YellowRoomReady'], ['FindSeat'], ['SitStill'],
  ],
  'RevisionLibrary-Tearaway': [['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'RevisionLibrary:0'], ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'EndOfLesson']],
  'Dinner-Tearaway': [['SetControllingCommand', 'FireNowAndThen'], ['GoTo', 'BoysDinnerHall:0'], ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'EndOfLesson']],
  'Assembly-Tearaway': [['GoTo', 'AssemblyHall:1'], ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'AssemblyStarted'], ['SitForAssembly', 'AssemblyFinished', 1], ['GoToRandomLocation'], ['MoveAboutUntil', 'EndOfLesson']],
  'Walkabout-Tearaway': [['SetControllingCommand', 'FireNowAndThen'], ['GoToRandomLocation'], ['SetControllingCommand', 'FireNowAndThen'], ['WalkAround', 9], ['Restart']],
  'WriteOnBoardsInBoysSkool-Tearaway': [
    ['GoTo', 'BlueRoomBlackboard:Middle'], ['WriteOnBoardUnless', 'EndOfLesson'],
    ['GoTo', 'YellowRoomBlackboard:Middle'], ['WriteOnBoardUnless', 'EndOfLesson'],
    ['GoTo', 'ScienceLabBlackboard:Middle'], ['WriteOnBoardUnless', 'EndOfLesson'],
    ['SetControllingCommand', 'FireNowAndThen'], ['GoToRandomLocation'], ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'EndOfLesson'],
  ],
  'WriteOnBoardsInGirlsSkool-Tearaway': [
    ['GoTo', 'UpperRoomBlackboard:Middle'], ['WriteOnBoardUnless', 'EndOfLesson'],
    ['GoTo', 'MiddleRoomBlackboard:Middle'], ['WriteOnBoardUnless', 'EndOfLesson'],
    ['SetControllingCommand', 'FireNowAndThen'], ['GoToRandomLocation'], ['SetControllingCommand', 'FireNowAndThen'], ['MoveAboutUntil', 'EndOfLesson'],
  ],

  // ----- Angelface (the bully) ---------------------------------------------
  'ScienceLab-Bully': [['SetControllingCommand', 'HitNowAndThen'], ['GoTo', 'ScienceLab:0'], ['SetControllingCommand', 'HitNowAndThen'], ['MoveAboutUntil', 'ScienceLabReady'], ['FindSeat'], ['SitStill']],
  'BlueRoom-Bully':   [['SetControllingCommand', 'HitNowAndThen'], ['GoTo', 'BlueRoom:0'], ['SetControllingCommand', 'HitNowAndThen'], ['MoveAboutUntil', 'BlueRoomReady'], ['FindSeat'], ['SitStill']],
  'YellowRoom-Bully': [['SetControllingCommand', 'HitNowAndThen'], ['GoTo', 'YellowRoom:0'], ['SetControllingCommand', 'HitNowAndThen'], ['MoveAboutUntil', 'YellowRoomReady'], ['FindSeat'], ['SitStill']],
  'RevisionLibrary-Bully': [['SetControllingCommand', 'HitNowAndThen'], ['GoTo', 'RevisionLibrary:0'], ['SetControllingCommand', 'HitNowAndThen'], ['MoveAboutUntil', 'EndOfLesson']],
  'Dinner-Bully': [['SetControllingCommand', 'HitNowAndThen'], ['GoTo', 'BoysDinnerHall:0'], ['SetControllingCommand', 'HitNowAndThen'], ['MoveAboutUntil', 'EndOfLesson']],
  'Assembly-Bully': [['GoTo', 'AssemblyHall:1'], ['SetControllingCommand', 'HitNowAndThen'], ['MoveAboutUntil', 'AssemblyStarted'], ['SitForAssembly', 'AssemblyFinished', 1], ['GoToRandomLocation'], ['MoveAboutUntil', 'EndOfLesson']],
  'Walkabout-Bully': [['SetControllingCommand', 'HitNowAndThen'], ['GoToRandomLocation'], ['SetControllingCommand', 'HitNowAndThen'], ['WalkAround', 9], ['Restart']],
  'StalkHeroine-Bully': [['SetControllingCommand', 'StalkAndHit', 'HEROINE'], ['GoTo', 'Location:HEROINE'], ['SetControllingCommand', 'StalkAndHit', 'HEROINE'], ['WalkAround', 9], ['Restart']],

  // ----- Teachers -----------------------------------------------------------
  'BlueRoom-Teacher':   [['GoTo', 'RevisionLibrary'], ['GoTo', 'BlueRoomDoorway'], ['StartLessonIfReady', 'BlueRoomReady'], ['GoTo', 'BlueRoomBlackboard:Edge'], ['ConductClass', 'SwotReadyForLesson']],
  'YellowRoom-Teacher': [['GoTo', 'RevisionLibrary'], ['GoTo', 'YellowRoomDoorway'], ['StartLessonIfReady', 'YellowRoomReady'], ['GoTo', 'YellowRoomBlackboard:Edge'], ['ConductClass', 'SwotReadyForLesson']],
  'ScienceLab-Teacher': [['GoTo', 'JustOutsideToilets'], ['GoTo', 'ScienceLabDoorway'], ['StartLessonIfReady', 'ScienceLabReady'], ['GoTo', 'ScienceLabBlackboard:Edge'], ['ConductClass', 'SwotReadyForLesson']],
  'Walkabout1-Teacher': [['GoTo', 'AssemblyHallStage:Edge'], ['GoTo', 'RevisionLibrary'], ['Restart']],
  'Walkabout2-Teacher': [['GoToRandomLocation'], ['Restart']],
  'Assembly-Teacher':   [['GoTo', 'AssemblyHall:WayBack'], ['GoTo', 'AssemblyHall:Back'], ['WaitUntil', 'AssemblyFinished'], ['MoveAboutUntil', 'EndOfLesson']],
  'AssemblyDuty':       [['GoTo', 'AssemblyHall:WayBack'], ['GoTo', 'AssemblyHall:Back'], ['DoAssemblyDuty', 'AssemblyStarted', 'AssemblyFinished'], ['MoveAboutUntil', 'EndOfLesson']],

  // ----- Mr Wacker ----------------------------------------------------------
  'Walkabout1-Wacker': [['GoTo', 'HeadsStudy:Window'], ['GoToRandomLocation'], ['Restart']],
  'Walkabout2-Wacker': [['GoTo', 'HeadsStudy:Window'], ['GoTo', 'AssemblyHallStage:Middle'], ['GoTo', 'CloakRoom'], ['GoTo', 'AssemblyHallStage:Middle'], ['Restart']],
  'Assembly-Wacker': [
    ['GoTo', 'HeadsStudy:Window'], ['GoTo', 'TopOfStairsDownToStage'], ['StartAssemblyIfReady', 'AssemblyStarted'],
    ['GoTo', 'AssemblyHallStage:Edge'], ['ConductAssembly'], ['Signal', 'AssemblyFinished'], ['SetClock', 100],
    ['GoTo', 'HeadsStudy:0'], ['MoveAboutUntil', 'EndOfLesson'],
  ],
  'HeadsStudy': [['GoTo', 'HeadsStudy:0'], ['MoveAboutUntil', 'EndOfLesson']],

  // ----- Albert the caretaker ----------------------------------------------
  'ShutGateAndDoor-Albert': [
    ['GoTo', 'BoysPlayground:Middle'],
    ['JumpIfShut', 'SkoolGate', 3], ['GoTo', 'SkoolGate:ToShut'], ['WaitAtDoor', 'SkoolGate'], ['ShutDoor', 'SkoolGate'],
    ['JumpIfShut', 'SkoolDoor', 3], ['GoTo', 'BoysSkoolDoor'], ['WaitAtDoor', 'SkoolDoor'], ['ShutDoor', 'SkoolDoor'],
    ['GoTo', 'JustRightOfTree'],
    ['SetControllingCommand', 'WatchForEric', 'WACKER', 'ShadowEric', "$WACKER^HE'S ESCAPING", 96, [2, 6]],
    ['MoveAboutUntil', 'EndOfLesson'],
  ],
  'OpenGateAndDoor-Albert': [['GoTo', 'BoysSkoolDoor'], ['OpenDoor', 'SkoolDoor'], ['GoTo', 'SkoolGate:ToOpen'], ['OpenDoor', 'SkoolGate'], ['SetRestartPoint'], ['GoToRandomLocation'], ['Restart']],
  'ShadowEric': [['ShadowEric']],

  // ----- Einstein (the swot) -----------------------------------------------
  'BlueRoom-Swot':   [['GoTo', 'BlueRoom:0'], ['MoveAboutUntil', 'BlueRoomReady'], ['FindSeat'], ['Signal', 'SwotReadyForLesson'], ['GrassAndAnswerQuestions']],
  'YellowRoom-Swot': [['GoTo', 'YellowRoom:1'], ['MoveAboutUntil', 'YellowRoomReady'], ['FindSeat'], ['Signal', 'SwotReadyForLesson'], ['GrassAndAnswerQuestions']],
  'ScienceLab-Swot': [['GoTo', 'ScienceLab:2'], ['MoveAboutUntil', 'ScienceLabReady'], ['FindSeat'], ['Signal', 'SwotReadyForLesson'], ['GrassAndAnswerQuestions']],

  // ----- Expulsions ---------------------------------------------------------
  'ExpelEric:TooManyLines': [['FindEric'], ['TellEric', "YOU HAVE 10000 LINES $HERO         YOU'RE EXPELLED"], ['EndGame']],
  'ExpelEric:NotABird':     [['FindEric'], ['TellEric', "YOU ARE NOT A BIRD $HERO         YOU'RE EXPELLED"], ['EndGame']],
};
