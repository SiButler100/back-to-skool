// ============================================================================
// LESSONS, QUESTIONS AND ASSEMBLY RANTS
// ----------------------------------------------------------------------------
// A Lesson choreographs the teacher and the swot (Einstein) once a class has
// started: the swot grasses on Eric for being absent, for hitting him, or for
// writing on the board; the teacher dishes out lines, wipes the board, maybe
// writes a topic, then either paces up and down or quizzes the swot.
//
// It works as a two-actor state machine: `actor` is whoever's turn it is, and
// `swotAction` / `teacherAction` are the names of the methods to run next.
// ============================================================================

import * as cmd from './commands.js';
import { MESSAGES } from '../data/messages.js';

export class Lesson {
  constructor(cast, swot, room, config, rng) {
    this.cast = cast; this.swot = swot; this.room = room; this.config = config; this.rng = rng;
    this.hitterId = null; this.writerId = null;
    this.teacher = null; this.qaGenerator = null; this.qaGroup = null; this.answer = null;
    this.actor = null;
    this.swotAction = 'checkEricInitial';
    this.teacherAction = null;
    this.baseAction = 'tellClassWhatToDo';
    this.baseLocation = null; this.baseDirection = null;
    this.grassed = false;
    this.absenceMessageIds = ['BE_PUNCTUAL', 'STAY_IN_CLASS'];
    this.absenceIndex = 0;
  }

  // The teacher arrives at the board and joins in.
  join(teacher, qaGenerator, qaGroup) {
    this.teacher = teacher;
    this.qaGenerator = null;
    if (this.rng.random() < this.config.qaSessionProbability) {
      this.qaGenerator = qaGenerator;
      this.qaGroup = qaGroup;
      this.baseAction = 'askQuestion';
    }
    this.actor = this.swot;
    this.baseLocation = { x: teacher.x, y: teacher.y };
    this.baseDirection = teacher.direction;
  }

  nextSwotAction() {
    let guard = 0;
    while (this.actor === this.swot && guard++ < 20) {
      const next = this[this.swotAction]();
      if (next) return next;
    }
    return undefined;
  }

  nextTeacherAction() {
    let guard = 0;
    while (this.actor === this.teacher && guard++ < 20) {
      const next = this[this.teacherAction]();
      if (next) return next;
    }
    return undefined;
  }

  // --- Swot's moves ----------------------------------------------------------
  checkEricInitial() {
    this.teacher.setHomeRoom();
    this.swotAction = 'grassForHitting';
    if (this.isEricAbsent()) {
      this.teacherAction = 'fetchEric';
      return new cmd.Say(this.cast.getAbsentTale(this.teacher), true);
    }
  }
  grassForHitting() {
    this.swotAction = 'grassForWriting';
    this.teacherAction = 'giveLinesForHitting';
    if (this.rng.random() < this.config.grassForHittingProbability) {
      const [hitterId, tale] = this.cast.getHitTale(this.teacher);
      this.hitterId = hitterId;
      return new cmd.Say(tale, true);
    }
    this.switch();
  }
  grassForWriting() {
    this.grassed = true;
    this.teacherAction = 'giveLinesForWriting';
    const writer = this.room.getBlackboardWriter();
    if (writer) {
      const [writerId, tale] = this.cast.getWriteTale(writer.id, this.teacher);
      this.writerId = writerId;
      if (tale) return new cmd.Say(tale, true);
    }
    this.switch();
  }
  checkEric() {
    if (this.isEricAbsent()) {
      this.teacherAction = 'fetchEric';
      return new cmd.Say(this.cast.getAbsentTale(this.teacher), true);
    }
    this.switch(this.baseAction);
  }
  answerQuestion() {
    this.swotAction = 'checkEric';
    return new cmd.Say(this.cast.expandTitle(this.answer, this.teacher));
  }

  // --- Teacher's moves -------------------------------------------------------
  fetchEric() {
    if (this.rng.random() < this.config.linesForTalesProbability) this.teacher.giveLines(this.swot.id, 'NO_TALES', true);
    if (this.isEricAbsent()) {
      this.teacherAction = 'returnToBase';
      this.teacher.resetComeAlongIndex();
      this.absenceIndex = 1;
      return new cmd.FetchEric();
    }
    const messageId = this.absenceMessageIds[this.absenceIndex];
    this.absenceIndex = 1;
    this.teacher.giveLines(this.cast.eric.id, messageId, true);
    this.switch();
  }
  returnToBase() {
    const t = this.teacher;
    if (t.x !== this.baseLocation.x || t.y !== this.baseLocation.y) return new cmd.GoToXY(this.baseLocation.x, this.baseLocation.y);
    if (this.room.hasBlackboard() && !this.grassed) {
      if (t.direction !== this.baseDirection) return new cmd.GoTowardsXY(t.x - t.direction, t.y);
      this.switch();
      return;
    }
    if (this.qaGenerator) {
      if (t.direction !== this.baseDirection) return new cmd.GoTowardsXY(t.x - t.direction, t.y);
      this.teacherAction = 'askQuestion';
    } else {
      this.teacherAction = 'walkUpOrDown';
      if (t.direction !== this.baseDirection) return new cmd.GoToXY(t.x + t.getBlackboardPaceDistance() * t.direction, t.y);
    }
  }
  giveLines(victimId, messageId) {
    if (victimId) {
      const victim = this.cast.get(victimId);
      const present = victim && this.room.contains(victim);
      const punishSwot = this.rng.random() < this.config.linesForTalesProbability;
      if (punishSwot || !present) { victimId = this.swot.id; messageId = 'NO_TALES'; }
      this.teacher.giveLines(victimId, messageId, true);
    }
  }
  giveLinesForHitting() { this.giveLines(this.hitterId, 'NO_HITTING'); this.switch(); }
  giveLinesForWriting() { this.giveLines(this.writerId, 'NO_WRITING'); this.teacherAction = 'wipeBoard'; }
  wipeBoard() {
    this.absenceIndex = 1;
    if (this.room.hasBlackboard()) { this.teacherAction = 'walkToBoard'; return new cmd.WipeBoard(); }
    this.teacherAction = this.baseAction;
  }
  walkToBoard() {
    this.teacherAction = 'writeOnBoard';
    const t = this.teacher;
    return new cmd.GoToXY(t.x - t.getBlackboardBacktrack() * t.direction, t.y);
  }
  writeOnBoard() {
    const t = this.teacher;
    this.baseLocation = { x: t.x, y: t.y };
    this.baseDirection = t.direction;
    this.teacherAction = this.baseAction;
    if (this.rng.random() < this.config.ericsTeacherWriteOnBoardProbability) return new cmd.WriteOnBoard(t.getBlackboardMessage());
  }
  askQuestion() {
    this.swotAction = 'answerQuestion';
    return new cmd.Say(this.getQuestion(), true);
  }
  tellClassWhatToDo() {
    this.baseAction = 'walkUpOrDown';
    this.teacherAction = 'walkUpOrDown';
    return new cmd.TellClassWhatToDo();
  }
  walkUpOrDown() {
    this.switch('checkEric');
    return new cmd.WalkUpOrDown();
  }
  getQuestion() {
    const [question, answer] = this.qaGenerator.prepareQA(this.qaGroup);
    this.answer = answer;
    return question;
  }

  // Swap turns between teacher and swot.
  switch(action = null) {
    if (this.actor === this.swot) { this.actor = this.teacher; this.teacherAction = action || this.teacherAction; }
    else { this.actor = this.swot; this.swotAction = action || this.swotAction; }
  }
  finishedSpeaking() { this.switch(); }
  isEricAbsent() { return !this.room.contains(this.cast.eric); }
}

// Produces questions and answers for one teacher.
export class QAGenerator {
  constructor(spec, rng) {
    this.spec = spec;   // { questions: {id: template}, answers: {id: template}, pairs: [[w1, w2], ...] }
    this.rng = rng;
    this.remaining = [];
  }
  expand(template, w1, w2) { return template.replace(/\$1/g, w1).replace(/\$2/g, w2); }
  prepareQA() {
    const ids = Object.keys(this.spec.questions);
    const qid = this.rng.choice(ids);
    if (!this.remaining.length) this.remaining = this.spec.pairs.map((_, i) => i);
    const idx = this.remaining.splice(this.rng.int(0, this.remaining.length - 1), 1)[0];
    const [w1, w2] = this.spec.pairs[idx];
    return [this.expand(this.spec.questions[qid], w1, w2), this.expand(this.spec.answers[qid], w1, w2)];
  }
}

// "You're all in detention until I find out who ATE the SCHOOL CAT".
export class AssemblyMessageGenerator {
  constructor(rng) { this.rng = rng; }
  generate() {
    const { template, VERB, NOUN } = MESSAGES.assembly;
    return template.replace('$VERB', this.rng.choice(VERB)).replace('$NOUN', this.rng.choice(NOUN));
  }
}
