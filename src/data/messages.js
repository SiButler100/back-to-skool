// ============================================================================
// WORDS
// ----------------------------------------------------------------------------
// Everything anyone says or writes: lines messages, what teachers put on the
// blackboard, the swot's tales, assembly rants, and the question-and-answer
// sessions. The '^' character means "new line" inside a speech bubble or on a
// blackboard. $TITLE becomes "Sir" or "Miss"; $HERO becomes Eric's name;
// $WACKER etc. become that character's name.
//
// Want to add new jokes, new subjects, or new reprimands? Edit here.
// ============================================================================

export const MESSAGES = {
  linesTemplate: '$n LINES^$r',   // "100 LINES" / "ERIC"

  sitDown: {
    WITHIT:  ['SIT DOWN CHAPS'],
    ROCKITT: ['SIT DOWN MY CHERUBS'],
    CREAK:   ['SIT DOWN YOU LITTLE ANARCHISTS'],
    TAKE:    ['SIT DOWN'],
  },

  assembly: {
    template: "YOU'RE ALL IN DETENTION UNTIL I FIND OUT WHO $VERB THE $NOUN",
    VERB: ['KIDNAPPED', 'ATE', 'SET FIRE TO', 'BLEW UP', 'IS MAKING RUDE PHONE CALLS TO', 'IS BLACKMAILING', 'SQUASHED', 'POISONED'],
    NOUN: ['GOLDFISH', 'SCHOOL CAT', 'LATIN MASTER', 'LOLLIPOP LADY', 'PTA', "CARETAKER'S BUDGIE", 'MILK MONITOR', 'HEAD BOY'],
  },

  blackboard: {
    WITHIT:   ['ARTESIAN^WELLS', 'THE DOLDRUMS', 'TASTY^GEYSERS', 'THE GREEN^REVOLUTION', 'TREACLE^MINING', 'FROG FARMING'],
    ROCKITT:  ['HEAVY WATER', 'HOLOGRAMS &^LASERS', 'DNA', 'VAMPIRE^BATS', 'NUCLEAR^FUSION', 'BACTERIA^AS PETS'],
    CREAK:    ['ATTILA THE^HUN', 'ERIC THE RED', 'NOGGIN THE^NOG', 'IVAN THE^TERRIBLE', 'ETHELRED THE^UNREADY', 'THE LUDDITES'],
    TAKE:     ['IAMBIC^PENTAMETERS', 'ELOCUTION^AINT ARF FUN', 'SUGAR AND^SPICE', 'TONE POEMS', 'ELEMENTARY^ASTROPHYSICS', 'THE BARD OF^AVON'],
    TEARAWAY: ['i hate^girls', 'i hate^skool', 'i hate^mafs', 'i hate^$WACKER', 'i hate^groan-ups', "who's Sam^Cruise?"],
  },

  // Question-and-answer sessions between a teacher and the swot.
  // Each pair is [word1, word2]; $1 and $2 in the templates are replaced.
  qa: {
    CREAK: {
      questions: { Q1: 'WHEN DID $1 BECOME KING?', Q2: 'WHO BECAME KING IN $2?' },
      answers:   { Q1: 'Please $TITLE I cannot tell a lie . . it was in $2', Q2: 'Please $TITLE I cannot tell a lie . . it was KING $1' },
      pairs: [['JOHN', '1199'], ['STEPHEN', '1135'], ['JAMES I', '1603'], ['GEORGE V', '1910'], ['HENRY V', '1413'], ['HENRY VII', '1485'], ['GEORGE I', '1714'], ['CHARLES I', '1625']],
    },
    WITHIT: {
      questions: { Q1: 'WHERE IS MT. $1?', Q2: 'WHAT IS THE HIGHEST MOUNTAIN IN $2?' },
      answers:   { Q1: 'Please $TITLE I cannot tell a lie . . it is in $2', Q2: 'Please $TITLE I cannot tell a lie . . it is MT. $1' },
      pairs: [['KILIMANJARO', 'TANZANIA'], ['KOSCIUSKO', 'AUSTRALIA'], ['McKINLEY', 'ALASKA'], ['KOMMUNISMA', 'THE USSR'], ['HUASCARAN', 'PERU'], ['SAJAMA', 'BOLIVIA'], ['COOK', 'NEW ZEALAND'], ['SNOWDON', 'WALES']],
    },
    ROCKITT: {
      questions: { Q1: 'WHERE DOES A$1 LIVE?', Q2: 'WHAT LIVES IN A$2?' },
      answers:   { Q1: 'Please $TITLE I cannot tell a lie . . it is A$2', Q2: 'Please $TITLE I cannot tell a lie . . it is A$1' },
      pairs: [[' BADGER', ' SET'], [' SQUIRREL', ' DREY'], [' BEAVER', ' LODGE'], [' HARE', ' FORM'], ['N EAGLE', 'N EYRIE'], ['N OTTER', ' HOLT'], [' BEE', ' HIVE'], [' BUG', ' BAD PROGRAM']],
    },
  },

  // Reprimands. The id is what the engine uses; the text is what you see.
  lines: {
    GET_OUT:          'YOU ARE NOT^ALLOWED HERE',
    GET_ALONG:        'GET ALONG^NOW',
    SIT_DOWN:         'NOW^SIT DOWN',
    GET_UP:           'GET OFF^THE FLOOR',
    COME_ALONG_1:     'COME ALONG^YOU MONSTER',
    COME_ALONG_2:     "DON'T KEEP^ME WAITING",
    NEVER_AGAIN:      "NOW DON'T^DO IT AGAIN",
    NO_TALES:         "DON'T TELL^TALES",
    BE_PUNCTUAL:      "DON'T BE^LATE AGAIN",
    STAY_IN_CLASS:    'STAY TILL I^DISMISS YOU',
    NO_WRITING:       "DON'T TOUCH^BLACKBOARDS",
    NO_CATAPULTS:     'NO^CATAPULTS',
    NO_HITTING:       "DON'T HIT^YOUR MATES",
    GET_OFF_PLANT:    'GET OFF^THE PLANTS',
    NO_BIKES:         "DON'T RIDE^BIKES IN HERE",
    BACK_TO_SKOOL:    'GET BACK^TO SCHOOL',
    SIT_FACING_STAGE: 'SIT FACING^THE STAGE',
    NO_STINKBOMBS:    'NO^STINKBOMBS',
    NO_WATERPISTOLS:  'NO^WATERPISTOLS',
  },

  // What a teacher says to a class when there is no Q&A session.
  lesson: [
    'START REVISING FOR YOUR EXAMS',
    'START READING AT THE NEXT CHAPTER IN YOUR BOOKS',
    "WRITE AN ESSAY TITLED 'WHY I LOVE SCHOOL'",
  ],

  // The swot's tales.
  grass: {
    writers: ['HERO', 'TEARAWAY'],
    writeTale: 'Please $TITLE I cannot tell a lie . . $1 wrote on the blackboard',
    hitters: ['HERO', 'BULLY'],
    hitTale: 'Please $TITLE I cannot tell a lie . . $1 hit me',
    absentTale: 'Please $TITLE I cannot tell a lie . . $HERO is not here',
  },

  expelled: {
    tooManyLines: "YOU HAVE 10000 LINES $HERO         YOU'RE EXPELLED",
    notABird:     "YOU ARE NOT A BIRD $HERO         YOU'RE EXPELLED",
  },

  escaping: "$WACKER^HE'S ESCAPING",
  upAYear: 'ONTO THE^NEXT YEAR',
};
