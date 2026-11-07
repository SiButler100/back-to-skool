// ============================================================================
// COMMANDS (the building blocks of character behaviour)
// ----------------------------------------------------------------------------
// A character's script (see data/commandLists.js) is a list of commands. Each
// tick, the character's CommandList asks the command on top of its stack to
// `execute()`. A command returns:
//
//   - nothing (undefined)  -> "I'm still busy, ask me again next tick"
//   - itself               -> "I'm finished, pop me off the stack"
//   - another command      -> "do this first, then come back to me"
//
// That's the whole trick. GoTo returns nothing until it arrives; MoveAboutUntil
// returns a fresh WalkAround each time it's asked; ConductClass hands over to
// the lesson logic, and so on.
//
// To add a new behaviour: write a class with an `execute()` method, add it to
// the COMMANDS registry at the bottom, then use its name in a command list.
// ============================================================================

// ---- The command list executor ---------------------------------------------

export class CommandList {
  constructor(character) {
    this.character = character;
    this.stack = [];
    this.commands = [];
    this.index = 0;
    this.restartIndex = 0;
    this.template = null;        // array of [name, ...args]
    this.controllingCommand = null;
    this.controllingCommandTimer = 0;
    this.subcommand = null;
  }

  // Build fresh command instances from the template, starting at `start`.
  build(start) {
    return (this.template || []).slice(start).map(([name, ...args]) => {
      const Cls = COMMANDS[name];
      if (!Cls) throw new Error(`Unknown command "${name}" for ${this.character.id}`);
      return new Cls(...args);
    });
  }

  // Run one step of the character's script.
  command() {
    if (this.stack.length && this.isInterruptible() && this.controllingCommand && !this.stack.includes(this.controllingCommand)) {
      this.addCommand(this.controllingCommand);
    }
    if (this.subcommand && !this.stack.includes(this.subcommand) && this.isInterruptible()) {
      this.addCommand(this.subcommand);
    }
    let guard = 0;
    while (guard++ < 50) {
      if (this.stack.length) {
        const command = this.stack[this.stack.length - 1];
        const result = command.execute();
        if (result === undefined || result === null) break;
        if (result !== command) this.addCommand(result);
        else if (this.stack.length) this.stack.pop();
      } else {
        if (this.controllingCommand) {
          this.controllingCommandTimer -= 1;
          if (this.controllingCommandTimer < 0) {
            if (this.stack.includes(this.controllingCommand)) this.controllingCommand.finish();
            this.controllingCommand = null;
          }
        }
        if (this.index >= this.commands.length) break;   // script finished: stand still
        this.addCommand(this.commands[this.index]);
        this.index += 1;
      }
    }
  }

  restart(index) {
    this.index = index || 0;
    this.commands = this.build(this.restartIndex);
  }

  addCommand(command) {
    command.character = this.character;
    this.stack.push(command);
  }

  // Swap in a new script (e.g. when the bell rings). Interruptible commands
  // are dropped; uninterruptible ones (mid-punch, mid-write) get to finish.
  setTemplate(template) {
    this.template = template;
    this.subcommand = null;
    while (this.stack.length && this.stack[0].isInterruptible()) {
      this.stack[0].finish();
      this.stack.shift();
    }
    this.restartIndex = 0;
    this.restart();
  }

  setControllingCommand(command) {
    command.character = this.character;
    this.controllingCommand = command;
    this.controllingCommandTimer = 1;
  }

  setRestartPoint() {
    this.restartIndex = this.index;
    this.restart();
  }

  jump(offset) { this.restart(this.index + offset); }

  isGoToing() { return this.stack.length > 0 && this.stack[0].isGoTo(); }
  getGoToDestination() { return this.isGoToing() ? this.stack[0].destination : null; }
  setGoToDestination(dest) { if (dest && this.isGoToing()) this.stack[0].destination = dest; }
  isInterruptible() { return this.stack.every((c) => c.isInterruptible()); }

  setSubcommand(name, args) {
    const Cls = COMMANDS[name];
    this.subcommand = new Cls(...args);
    this.subcommand.character = this.character;
  }
}

// ---- Base classes ------------------------------------------------------------

export class Command {
  isInterruptible() { return true; }
  isGoTo() { return false; }
  execute() { return this; }
  finish() {}
}

// A fixed sequence of steps, each a method name. A step returning `false`
// means "not done yet, call me again".
export class ComplexCommand extends Command {
  constructor() {
    super();
    this.index = 0;
    this.commands = this.getCommands();
  }
  execute() {
    const val = this[this.commands[this.index]]();
    if (val !== false) this.index = (this.index + 1) % this.commands.length;
    return val || undefined;
  }
  restart() { this.index = -1; }
  done() { return this; }
}

// ---- Movement ----------------------------------------------------------------

export class GoTo extends Command {
  constructor(locationId, destination = null, goOneStep = false) {
    super();
    this.locationId = locationId;
    this.destination = destination;
    this.goOneStep = goOneStep;
    this.doneFlag = false;
  }
  isGoTo() { return true; }
  execute() {
    const c = this.character;
    if (!this.destination) {
      this.destination = c.resolveLocationId(this.locationId);
      if (!this.destination) { console.warn(`Cannot resolve location "${this.locationId}" for ${c.name}`); return this; }
    }
    if ((c.x === this.destination.x && c.y === this.destination.y) || this.doneFlag) return this;
    if (c.onStairs()) { c.walk(true); return; }
    if (c.isSitting()) { c.getUp(); return; }
    const next = c.getNextStaircase(this.destination);
    let nextX;
    if (next) nextX = c.y === next.bottom.y ? next.bottom.x : next.top.x;
    else nextX = this.destination.x;
    if (c.x < nextX) { this.doneFlag = this.goOneStep; return c.right(); }
    if (c.x > nextX) { this.doneFlag = this.goOneStep; return c.left(); }
    if (next) {
      if (next.contains(c)) c.walk(true);
      else c.turn();
    } else {
      // No route: give up rather than loop forever.
      console.warn(`${c.name} at (${c.x},${c.y}) cannot find a route to (${this.destination.x},${this.destination.y})`);
      return this;
    }
    this.doneFlag = this.goOneStep;
  }
}

export class GoToRandomLocation extends GoTo {
  constructor() { super(null); }
  execute() {
    if (!this.destination) this.destination = this.character.getRandomDestination();
    return super.execute();
  }
}

export class GoToXY extends GoTo {
  constructor(x, y) { super(null, { x, y }); }
}

export class GoTowardsXY extends GoTo {
  constructor(x, y) { super(null, { x, y }, true); }
}

export class Restart extends Command {
  execute() { this.character.restartCommandList(); return this; }
}

export class FindSeat extends Command {
  constructor(goToBack = true, moveAlong = true) { super(); this.goToBack = goToBack; this.moveAlong = moveAlong; }
  execute() {
    const c = this.character;
    const [chair, dir] = c.getNextChair(this.moveAlong, this.goToBack);
    if (!chair) return this;
    this.moveAlong = false;
    if (c.x === chair.x) {
      if (c.direction === dir) { c.sit(); return this; }
      c.turn();
      return;
    }
    return new GoToXY(chair.x, c.y);
  }
}

export class MoveAboutUntil extends Command {
  constructor(signal, range = [1, 7]) { super(); this.signal = signal; this.range = range; }
  execute() {
    if (this.character.gotSignal(this.signal)) return this;
    return new WalkAround(1, this.range);
  }
}

export class WalkAround extends Command {
  constructor(walkabouts, range = [1, 7]) { super(); this.count = walkabouts; this.range = range; this.origin = null; }
  execute() {
    const c = this.character;
    if (this.count === 0) return this;
    if (c.onStairs()) { c.walk(true); return; }
    if (this.origin === null) this.origin = Math.max(1, c.x);
    if (c.x === this.origin) return new GoToXY(Math.max(0, c.x - c.rng.int(this.range[0], this.range[1])), c.y);
    this.count -= 1;
    return new GoToXY(this.origin, c.y);
  }
}

export class SitStill extends Command {
  execute() { return; }
}

export class WalkFast extends Command {
  execute() { this.character.goFast(); return this; }
  finish() { this.character.triggerSpeedChange(); }
}

// ---- Lessons -----------------------------------------------------------------

export class GrassAndAnswerQuestions extends Command {
  constructor() { super(); this.ready = false; }
  execute() {
    const c = this.character;
    if (!c.isSittingOnChair()) return new FindSeat(false, false);
    c.keepSeat();
    if (!this.ready) { this.ready = true; c.startLesson(); }
    return c.nextSwotAction();
  }
}

export class WaitUntil extends Command {
  constructor(signal) { super(); this.signal = signal; }
  execute() { if (this.character.gotSignal(this.signal)) return this; }
}

export class DoAssemblyDuty extends Command {
  constructor(started, finished) { super(); this.started = started; this.finished = finished; this.fetchedEric = false; }
  execute() {
    const c = this.character;
    if (this.fetchedEric) { c.restartCommandList(); return this; }
    if (c.gotSignal(this.finished)) return this;
    if (!c.gotSignal(this.started)) return;
    if (c.isEricAbsent()) { this.fetchedEric = true; return new FetchEric(); }
  }
}

export class StartAssemblyIfReady extends Command {
  constructor(signal) { super(); this.signal = signal; }
  execute() {
    const c = this.character;
    if (c.isTimeToStartLesson()) { c.setHomeRoom(); c.signal(this.signal); }
    else c.restartCommandList();
    return this;
  }
}

export class ConductAssembly extends Command {
  constructor() { super(); this.spoken = false; }
  execute() {
    if (this.spoken) { this.character.unsetHomeRoom(); return this; }
    this.spoken = true;
    return new Say(this.character.getAssemblyMessage());
  }
}

export class StartLessonIfReady extends Command {
  constructor(signal) { super(); this.signal = signal; this.ready = false; }
  execute() {
    const c = this.character;
    if (!this.ready) {
      if (c.isTimeToStartLesson()) {
        this.ready = true;
        c.signal(this.signal);
        return new TellKidsToSitDown();
      }
      c.restartCommandList();
    }
    return this;
  }
}

export class StartDinnerIfReady extends Command {
  execute() {
    const c = this.character;
    if (c.isTimeToStartLesson()) c.setHomeRoom();
    else c.restartCommandList();
    return this;
  }
}

export class TellKidsToSitDown extends Command {
  constructor() { super(); this.spoken = false; }
  execute() {
    if (this.spoken) return this;
    this.spoken = true;
    return new Say(this.character.getSitDownMessage());
  }
}

export class ConductClass extends Command {
  constructor(signal = null, qaGroup = null) { super(); this.signal = signal; this.qaGroup = qaGroup; }
  execute() {
    const c = this.character;
    if (c.isTeachingEric()) {
      if (c.gotSignal(this.signal)) return new ConductClassWithEric(this.qaGroup);
      return;
    }
    return new ConductClassWithoutEric();
  }
}

export class ConductClassWithoutEric extends Command {
  constructor() { super(); this.wiped = false; this.walked = false; this.wrote = false; this.told = false; }
  execute() {
    const c = this.character;
    if (c.getBlackboard()) {
      if (!this.wiped) { this.wiped = true; return new WipeBoard(); }
      if (!this.walked) { this.walked = true; return new GoToXY(c.x - c.getBlackboardBacktrack() * c.direction, c.y); }
      if (!this.wrote) {
        this.wrote = true;
        if (c.willWriteOnBoard()) return new WriteOnBoard(c.getBlackboardMessage());
      }
    }
    if (!this.told) { this.told = true; return new TellClassWhatToDo(); }
    return new WalkUpOrDown();
  }
}

export class TellClassWhatToDo extends Command {
  constructor() { super(); this.doneFlag = false; }
  execute() {
    if (this.doneFlag) return this;
    this.doneFlag = true;
    return new Say(this.character.getLessonMessage());
  }
}

export class WalkUpOrDown extends Command {
  constructor() { super(); this.doneFlag = false; }
  execute() {
    if (this.doneFlag) return this;
    this.doneFlag = true;
    const c = this.character;
    return new GoToXY(c.x - c.getBlackboardPaceDistance() * c.direction, c.y);
  }
}

export class WriteOnBoard extends Command {
  constructor(message) { super(); this.message = message; this.index = 1; this.armDown = true; }
  isInterruptible() { return false; }
  execute() {
    const c = this.character;
    if (!(this.message && c.getBlackboard())) return this;
    if (c.isSitting()) { c.getUp(); return; }
    if (c.writeOnBoard(this.message, this.index)) { c.lowerArm(); return this; }
    if (this.armDown) c.raiseArm(); else c.lowerArm();
    this.armDown = !this.armDown;
    this.index += 1;
  }
}

export class ConductClassWithEric extends Command {
  constructor(qaGroup = null) { super(); this.joined = false; this.qaGroup = qaGroup; }
  execute() {
    const c = this.character;
    if (!this.joined) {
      if (!c.joinLesson(this.qaGroup)) return;   // wait for the swot to start the lesson
      this.joined = true;
    }
    return c.nextTeacherAction();
  }
}

export class WipeBoard extends ComplexCommand {
  constructor() { super(); this.column = 0; this.blackboard = null; }
  getCommands() { return ['walk', 'wipe', 'lowerArm', 'done']; }
  isInterruptible() { return false; }
  walk() {
    const c = this.character;
    c.wipingBoard = true;
    let x;
    if (this.column === 0) {
      this.blackboard = c.getBlackboard();
      if (!this.blackboard) return this;
      x = c.x < this.blackboard.x - 2 ? this.blackboard.x - 2 : this.blackboard.rightX;
    } else {
      x = c.x + c.direction;
    }
    return new GoToXY(x, c.y);
  }
  wipe() {
    const c = this.character;
    c.raiseArm();
    const col = c.direction > 0 ? this.column : this.blackboard.width - 1 - this.column;
    c.wipeBoard(col);
  }
  lowerArm() {
    this.column += 1;
    this.character.lowerArm();
    if (this.column < this.blackboard.width) this.restart();
    else this.character.wipingBoard = false;
  }
}

export class WriteOnBoardUnless extends Command {
  constructor(signal) { super(); this.signal = signal; this.wrote = false; }
  execute() {
    const c = this.character;
    if (!c.room) return this;
    if (c.gotSignal(this.signal) || c.room.blackboardDirty()) return this;
    if (this.wrote) return this;
    this.wrote = true;
    return new WriteOnBoard(c.getBlackboardMessage());
  }
}

// ---- Speech ------------------------------------------------------------------

export class Say extends Command {
  constructor(words, notify = false) { super(); this.words = words; this.notify = notify; this.shift = -4; }
  execute() {
    const c = this.character;
    if (!this.words) return this;
    if (c.say(this.words, this.shift)) {
      c.removeBubble();
      if (this.notify) c.finishedSpeaking();
      return this;
    }
    this.shift += 1;
  }
  finish() { this.character.removeBubble(); }
}

export class Signal extends Command {
  constructor(signal) { super(); this.signal = signal; }
  execute() { this.character.signal(this.signal); return this; }
}

export class Unsignal extends Command {
  constructor(signal) { super(); this.signal = signal; }
  execute() { this.character.unsignal(this.signal); return this; }
}

export class SetControllingCommand extends Command {
  constructor(name, ...params) { super(); this.name = name; this.params = params; }
  execute() {
    const Cls = COMMANDS[this.name];
    this.character.setControllingCommand(new Cls(...this.params));
    return this;
  }
}

export class SetSubcommand extends Command {
  constructor(name, ...args) { super(); this.name = name; this.args = args; }
  execute() { this.character.setSubcommand(this.name, this.args); return this; }
}

// ---- Mischief: catapults and fists ------------------------------------------

export class HitOrFireNowAndThen extends Command {
  ready() {
    const c = this.character;
    if (c.onStairs() || c.getNearbyAdults().length) return false;
    return c.isStanding();
  }
  execute() {
    if (!this.ready()) return this;
    return this.getCommand();
  }
}

export class FireNowAndThen extends HitOrFireNowAndThen {
  ready() {
    const c = this.character;
    if (!super.ready()) return false;
    if (c.x % 4 !== 0) return false;
    if (!c.pellet || c.pellet.visible) return false;
    return c.willFireCatapult();
  }
  getCommand() { return new FireCatapult(); }
}

export class HitNowAndThen extends HitOrFireNowAndThen {
  ready() {
    const c = this.character;
    if (!super.ready()) return false;
    if (!c.getPunchee(1)) return false;
    return c.willHit();
  }
  getCommand() { return new Hit(); }
}

export class StalkAndHit extends HitNowAndThen {
  constructor(characterId) { super(); this.characterId = characterId; }
  execute() {
    this.character.stalk(this.characterId);
    return super.execute();
  }
}

export class FireCatapult extends ComplexCommand {
  getCommands() { return ['aim', 'fire', 'lower', 'done']; }
  isInterruptible() { return false; }
  aim() {
    const c = this.character;
    if (c.isRaisingCatapult()) c.aimCatapult();
    else { c.raiseCatapult(); return false; }
  }
  fire() { this.character.fireCatapult(); }
  lower() {
    const c = this.character;
    if (c.isLoweringCatapult()) c.completeAction();
    else { c.lowerCatapult(); return false; }
  }
}

export class Hit extends ComplexCommand {
  getCommands() { return ['aim', 'hit', 'lower', 'done']; }
  isInterruptible() { return false; }
  aim() {
    const c = this.character;
    if (c.isRaisingFist()) c.punch();
    else { c.raiseFist(); return false; }
  }
  hit() {
    const victim = this.character.getPunchee(2);
    if (victim) victim.deck();
  }
  lower() {
    const c = this.character;
    if (c.isLoweringFist()) c.completeAction();
    else { c.lowerFist(); return false; }
  }
}

export class Floored extends Command {
  constructor(count) { super(); this.count = count; }
  isInterruptible() { return false; }
  execute() {
    const c = this.character;
    if (c.isStanding()) return this;
    this.count -= 1;
    if (this.count < 0) c.standUp();
  }
}

export class KnockedOver extends Floored {
  constructor(delay, reprimandDelay, sleep) { super(delay); this.delay = delay; this.reprimandDelay = reprimandDelay; this.sleep = sleep; }
  execute() {
    const c = this.character;
    if (this.sleep) {
      if (c.isTimeToWake()) { this.sleep = false; this.count = 0; }
      else { c.actionDelay = -1; return; }
    }
    if (super.execute() === this) return this;
    if (this.count === this.delay - this.reprimandDelay) c.reprimand();
  }
}

// ---- Doors -------------------------------------------------------------------

export class MoveDoor extends ComplexCommand {
  constructor(barrierId, shut) { super(); this.barrierId = barrierId; this.shut = shut; }
  getCommands() { return ['raiseArm', 'moveDoor', 'lowerArm', 'done']; }
  isInterruptible() { return false; }
  raiseArm() {
    if (this.character.checkDoorStatus(this.barrierId, this.shut)) return this;
    this.character.raiseArm();
  }
  moveDoor() { this.character.moveDoor(this.barrierId, this.shut); }
  lowerArm() { this.character.lowerArm(); }
}
export class OpenDoor extends MoveDoor { constructor(id) { super(id, false); } }
export class ShutDoor extends MoveDoor { constructor(id) { super(id, true); } }

export class SetRestartPoint extends Command {
  execute() { this.character.setRestartPoint(); return this; }
}

export class JumpIfShut extends Command {
  constructor(doorId, offset) { super(); this.doorId = doorId; this.offset = offset; }
  execute() { this.character.jumpIfShut(this.doorId, this.offset); return this; }
}

export class JumpIfOpen extends Command {
  constructor(doorId, offset) { super(); this.doorId = doorId; this.offset = offset; }
  execute() { this.character.jumpIfOpen(this.doorId, this.offset); return this; }
}

export class WaitAtDoor extends Command {
  constructor(doorId) { super(); this.doorId = doorId; }
  execute() { if (this.character.waitAtDoor(this.doorId)) return this; }
}

// ---- Assembly ----------------------------------------------------------------

export class SitForAssembly extends ComplexCommand {
  constructor(finished, sitDirection, sitRange = [1, 4]) {
    super();
    this.finished = finished; this.sitDirection = sitDirection; this.sitRange = sitRange;
  }
  getCommands() { return ['findSpot', 'sitDown', 'getUp', 'done']; }
  findSpot() {
    const c = this.character;
    if (c.gotSignal(this.finished)) return this;
    return new GoToXY(Math.max(0, c.x - c.rng.int(this.sitRange[0], this.sitRange[1])), c.y);
  }
  sitDown() {
    const c = this.character;
    if (c.gotSignal(this.finished)) return this;
    if (c.direction !== this.sitDirection) { c.turn(); return false; }
    c.sit();
  }
  getUp() {
    const c = this.character;
    if (!c.gotSignal(this.finished)) return false;
    c.getUp();
  }
}

// ---- Eric-related (used by teachers) ----------------------------------------

export class FindEric extends Command {
  execute() {
    const c = this.character;
    c.stopClock();
    c.goFast();
    if (c.isBesideEric()) {
      if (c.freezeEric()) { c.triggerSpeedChange(); return this; }
      return;
    }
    const { x, y } = c.getLocationOfEric();
    return new GoTowardsXY(x, y);
  }
}

export class Freeze extends Command {
  execute() { this.character.checkUnderstanding(); }
}

export class TellEric extends Command {
  constructor(message) { super(); this.told = false; this.message = message; }
  execute() {
    const c = this.character;
    if (this.told) { c.unfreezeEric(); return this; }
    this.told = true;
    return new Say(c.expandNames(this.message));
  }
}

export class TellEricAndWait extends Command {
  constructor(message) { super(); this.told = 0; this.delay = null; this.message = message; }
  execute() {
    const c = this.character;
    if (this.told === 0) { this.told = 1; this.delay = c.getTellEricDelay(); return new Say(c.expandNames(this.message)); }
    if (c.ericUnderstood()) { c.unfreezeEric(); return this; }
    this.delay -= 1;
    if (this.delay < 0) { this.delay = c.getTellEricDelay(); this.told = 0; }
  }
}

export class SetClock extends Command {
  constructor(ticks) { super(); this.ticks = ticks; }
  execute() { this.character.startClock(this.ticks); return this; }
}

export class EndGame extends Command {
  execute() { this.character.endGame(); }
}

export class AddLines extends Command {
  constructor(lines) { super(); this.lines = lines; }
  isInterruptible() { return false; }
  execute() { this.character.addLines(this.lines); return this; }
}

export class FetchEric extends Command {
  execute() {
    const c = this.character;
    c.goFast();
    if (!c.isEricAbsent() || c.isEricExpelled()) { c.triggerSpeedChange(); return this; }
    if (!c.isBesideEric()) { const { x, y } = c.getLocationOfEric(); return new GoTowardsXY(x, y); }
    if (!c.isFacingEric()) c.turn();
  }
}

export class FindEricIfMissing extends Command {
  execute() {
    const c = this.character;
    if (!c.isEricExpelled() && c.isEricAbsent()) return new FetchEric();
    return this;
  }
}

export class Follow extends Command {
  constructor(characterId) { super(); this.targetId = characterId; this.doneFlag = false; }
  execute() {
    if (this.doneFlag) return this;
    this.doneFlag = true;
    return new GoTo(null, this.character.getDestination(this.targetId));
  }
}

export class WatchForEric extends Command {
  constructor(alerteeId, commandListId, alertMessage, escapeX, dangerZone) {
    super();
    Object.assign(this, { alerteeId, commandListId, alertMessage, escapeX, dangerZone });
  }
  execute() {
    const c = this.character;
    if (c.shouldStopEric(this.escapeX, this.dangerZone)) {
      c.raiseArm();
      c.stopEric = true;
      return new StopEric(this.alerteeId, this.commandListId, this.alertMessage, this.escapeX, this.dangerZone);
    }
    return this;
  }
}

export class StopEric extends Command {
  constructor(alerteeId, commandListId, alertMessage, escapeX, dangerZone) {
    super();
    this.raisedAlarm = false;
    Object.assign(this, { alerteeId, commandListId, alertMessage, escapeX, dangerZone });
  }
  execute() {
    const c = this.character;
    if (!this.raisedAlarm) { this.raisedAlarm = true; c.raiseAlarm(this.alertMessage, this.alerteeId, this.commandListId); }
    if (!c.shouldStopEric(this.escapeX, this.dangerZone)) { c.lowerArm(); c.stopEric = false; return this; }
  }
}

export class ShadowEric extends Command {
  execute() {
    const c = this.character;
    c.goFast();
    if (!c.isBesideEric()) { const { x, y } = c.getLocationOfEric(); return new GoTowardsXY(x, y); }
    if (!c.isFacingEric()) c.turn();
  }
}

export class MonitorEric extends Command {
  constructor(commandListId, chaseX) { super(); this.commandListId = commandListId; this.chaseX = chaseX; }
  execute() {
    if (this.character.shouldChaseEric(this.chaseX)) this.character.changeCommandList(this.commandListId);
    return this;
  }
}

export class ChaseEricOut extends Command {
  constructor(minX) { super(); this.minX = minX; }
  execute() {
    const c = this.character;
    c.goFast();
    if (c.x >= this.minX) {
      if (!c.isBesideEric()) { const { x, y } = c.getLocationOfEric(); return new GoTowardsXY(x, y); }
      if (!c.isFacingEric()) c.turn();
    }
  }
}

export class Pause extends Command {
  execute() { if (!this.character.paused) return this; }
}

// ---- Eric's own actions ------------------------------------------------------

export class Jump extends ComplexCommand {
  getCommands() { return ['up', 'down', 'done']; }
  up() { this.character.jump(); }
  down() { this.character.descend(); }
}

export class Write extends Command {
  constructor() { super(); this.finished = false; }
  execute() {
    if (this.finished) { this.character.lowerArm(); return this; }
    this.finished = this.character.write();
  }
}

export class FireWaterPistol extends ComplexCommand {
  getCommands() { return ['aim', 'fire', 'lower', 'done']; }
  isInterruptible() { return false; }
  aim() { this.character.aimWaterPistol(); }
  fire() { this.character.fireWaterPistol(); }
  lower() { this.character.completeAction(); }
}

export class DumpWaterPistol extends ComplexCommand {
  getCommands() { return ['dump', 'standUp']; }
  dump() { this.character.dumpWaterPistol(); }
  standUp() { this.character.standUp(); return this; }
}

export class DropStinkbomb extends ComplexCommand {
  getCommands() { return ['raiseArm', 'drop', 'lower', 'done']; }
  isInterruptible() { return false; }
  raiseArm() { this.character.raiseArm(); }
  drop() { this.character.dropStinkbomb(); }
  lower() { this.character.completeAction(); }
}

export class Catch extends ComplexCommand {
  getCommands() { return ['catchAnimal', 'standUp']; }
  catchAnimal() { this.character.catchAnimal(); }
  standUp() { this.character.standUp(); return this; }
}

export class ReleaseMice extends ComplexCommand {
  getCommands() { return ['release', 'standUp']; }
  release() { this.character.releaseMice(); }
  standUp() { this.character.standUp(); return this; }
}

export class Kiss extends ComplexCommand {
  constructor() { super(); this.kissee = null; }
  getCommands() { return ['startKiss', 'finishKiss', 'done']; }
  startKiss() {
    const c = this.character;
    this.kissee = c.kissee();
    if (this.kissee) {
      this.kissee.pause();
      if (this.kissee.willKissEric()) { c.x += c.direction; c.hide(); this.kissee.kissEric(); }
      else this.kissee.raiseArm();
    } else {
      c.walk();
      c.walkDelay = 4;
    }
  }
  finishKiss() {
    const c = this.character;
    if (this.kissee) {
      if (this.kissee.isKissingEric()) { c.kiss(); c.unhide(); this.kissee.finishKiss(); }
      else { this.kissee.lowerArm(); c.deck(); }
      this.kissee.resume();
    } else {
      c.standUp();
    }
  }
}

export class FallToFloor extends Command {
  execute() {
    const c = this.character;
    if (c.floor) { c.fallToFloor(); return this; }
    c.y += 1;
  }
}

export class Flight extends Command {
  constructor(phases, commandListId = null) { super(); this.index = 0; this.phases = phases; this.commandListId = commandListId; }
  execute() {
    const c = this.character;
    if (this.index < this.phases.length) {
      const [xInc, yInc, state] = this.phases[this.index];
      this.index += 1;
      c.fly(xInc, yInc);
      c.animatoryState = state;
      if (this.index === this.phases.length) c.endFlight();
      return;
    }
    if (this.commandListId) c.paralyse(this.commandListId);
    return this;
  }
}

export class RideBike extends Command {
  constructor(bike) { super(); this.bike = bike; bike.prepare(); }
  execute() {
    const c = this.character, bike = this.bike;
    c.walkDelay = bike.moveDelay;
    c.checkBikeKeys();
    const barrier = c.hitBarrier(bike);
    if (barrier) {
      bike.momentum = 0;
    } else if (c.pedalled()) {
      bike.pedal();
      return;
    } else if (c.dismounted()) {
      c.standUp(); bike.startWheeling(c); c.dismount();
      return this;
    } else if (c.sittingOnSaddle) {
      if (c.stoodOnSaddle()) { bike.startWheeling(c); c.standOnSaddle(); }
    } else if (c.gotBackOnSaddle()) {
      c.getBackOnSaddle(); bike.hide();
    } else if (c.jumpedOffSaddle()) {
      c.dismount();
      return new JumpOffSaddle();
    } else {
      c.x += c.direction;   // standing on the saddle: carried along
    }
    bike.momentum -= 1;
    if (bike.momentum <= 0) {
      c.dismount();
      if (c.sittingOnSaddle) bike.fall(c);
      else {
        bike.fall();
        if (barrier && barrier.flyPhases) return new Flight(c.world.animationPhases[barrier.flyPhases]);
      }
      return new FallToFloor();
    }
  }
}

export class JumpOffSaddle extends ComplexCommand {
  getCommands() { return ['rise', 'reach', 'checkCup', 'fall', 'done']; }
  rise() { this.character.y -= 1; }
  reach() { this.character.y -= 1; this.character.raiseArm(); }
  checkCup() { this.character.checkCup(); this.character.sitOnFloor(); }
  fall() {
    const c = this.character;
    c.y += 1;
    if (c.landed()) { c.fallToFloor(); return; }
    return false;
  }
}

// ---- Objects (things that move but aren't people) ---------------------------

export class MovePellet extends Command {
  constructor() { super(); this.count = 0; this.xInc = 0; this.yInc = 0; }
  isInterruptible() { return false; }
  execute() {
    const p = this.character;
    if (!p.visible) return;
    if (this.count <= 0) { this.count = p.range; this.xInc = p.direction; this.yInc = 0; }
    this.count -= 1;
    if (this.count === 0 || p.barrier) { this.endFlight(); return; }
    if (this.yInc < 0 || this.count <= p.hitZone) {
      if (p.hitCup() || p.hitConker()) { this.endFlight(); return; }
    }
    if (this.yInc === 0 && this.count <= p.hitZone) {
      const victim = p.getVictim();
      if (victim) {
        if (victim.isDeckable()) { victim.deck(); this.endFlight(); return; }
        if (victim.isAdult() && victim.isKnockedOver()) { this.xInc = 0; this.yInc = -1; this.count = 5; }
      }
    }
    p.x += this.xInc; p.y += this.yInc;
  }
  endFlight() { this.count = 0; this.character.hide(); }
}

export class MoveWater extends Command {
  constructor() { super(); this.phase = 0; }
  isInterruptible() { return false; }
  execute() {
    const w = this.character;
    if (!w.visible) return;
    const [state, xInc, yInc, hit] = w.phases[this.phase];
    if (hit === 1 && w.hitCup()) return this.endFlight();
    if (hit === 2 && w.hitPlant()) return this.endFlight();
    if (w.hitFloor()) return this.endFlight();
    w.x += w.direction * xInc; w.y += yInc;
    w.animatoryState = state;
    this.phase = Math.min(this.phase + 1, w.phases.length - 1);
  }
  endFlight() { this.phase = 0; this.character.hide(); }
}

export class Stink extends Command {
  constructor(delay) { super(); this.delay = delay; this.count = delay; }
  execute() {
    const bomb = this.character;
    if (!bomb.visible) return;
    this.count -= 1;
    if (this.count <= 0) { this.count = this.delay; bomb.hide(); return; }
    bomb.moveCloud();
  }
}

export class MoveDeskLid extends Command {
  constructor(delay) { super(); this.delay = delay; this.count = delay; }
  execute() {
    const lid = this.character;
    if (!lid.visible) return;
    if (this.count >= this.delay) lid.deliverContents();
    this.count -= 1;
    if (this.count <= 0) { this.count = this.delay; lid.hide(); }
  }
}

export class MoveMouse extends Command {
  constructor(hideRange, sprints, sprintRange, lifeRange) {
    super();
    this.hideRange = hideRange; this.sprints = sprints; this.sprintRange = sprintRange; this.lifeRange = lifeRange;
    this.sprintCount = 0; this.sprintDistance = 0; this.hideX = -1; this.hideDelay = 0; this.life = null;
  }
  isInterruptible() { return false; }
  execute() {
    const mouse = this.character;
    if (this.life === null) { this.life = mouse.rng.int(...this.lifeRange); this.resetSprints(); }
    if (this.hideX >= 0) {
      if (this.hideDelay > 0) { this.hideDelay -= 1; return; }
      if (!mouse.immortal) { this.life -= 1; if (this.life <= 0) { mouse.die(); return; } }
      mouse.x = this.hideX; this.hideX = -1; mouse.visible = true;
      this.resetSprints();
    } else if (this.sprintDistance > 0) {
      this.sprintDistance -= 1; this.move();
    } else if (this.sprintCount > 0) {
      this.sprintCount -= 1; this.sprintDistance = mouse.rng.int(...this.sprintRange);
      mouse.direction = mouse.rng.choice([-1, 1]); this.move();
    } else {
      this.hideX = mouse.x; this.hideDelay = mouse.rng.int(...this.hideRange); mouse.hide();
    }
  }
  resetSprints() { this.sprintCount = this.character.rng.int(...this.sprints); this.sprintDistance = this.character.rng.int(...this.sprintRange); }
  move() {
    const mouse = this.character;
    if (mouse.isBlocked()) mouse.turn();
    mouse.x += mouse.direction;
    mouse.scarePeople();
  }
}

export class EvadeMouse extends Command {
  constructor(delay) { super(); this.count = delay; this.inTheAir = false; this.onAChair = false; this.oldAs = null; this.wasSeated = false; }
  isInterruptible() { return false; }
  execute() {
    const c = this.character;
    if (this.oldAs === null) {
      this.oldAs = c.animatoryState;
      this.wasSeated = c.isSittingOnChair();
      if (c.isSitting()) { c.getUp(); return; }
    }
    this.count -= 1;
    if (this.count <= 0) {
      if (this.inTheAir || this.onAChair) { c.y += 1; this.inTheAir = this.onAChair = false; return; }
      if (this.wasSeated) c.sit(); else c.animatoryState = this.oldAs;
      c.triggerSpeedChange();
      return this;
    }
    c.goSlow();
    if (this.inTheAir) { c.y += 1; this.inTheAir = false; }
    else if (!this.onAChair) {
      if (c.chair(false)) this.onAChair = true;
      c.y -= 1;
      this.inTheAir = !this.onAChair;
    }
  }
}

export class MoveFrog extends Command {
  constructor(pHop, pTurn, pShort) { super(); this.pHop = pHop; this.pTurn = pTurn; this.pShort = pShort; }
  isInterruptible() { return false; }
  execute() {
    const frog = this.character;
    if (frog.trapped || !frog.visible) return;
    if (frog.falling) {
      if (frog.checkHeads()) frog.bounceOffHead();
      else { frog.y += 1; if (frog.getFloor()) { frog.falling = false; frog.sit(); } }
      return;
    }
    if (!frog.isEricNearby() && frog.rng.random() < this.pHop) return;
    let phases;
    if (frog.rng.random() < this.pTurn) phases = frog.turnRound;
    else if (frog.rng.random() < this.pShort) phases = frog.isBlocked(1) ? frog.turnRound : frog.shortHop;
    else phases = frog.isBlocked(3) ? frog.turnRound : frog.longHop;
    return new Hop(phases);
  }
}

export class Hop extends Command {
  constructor(phases) { super(); this.phases = phases; this.index = 0; }
  isInterruptible() { return false; }
  execute() {
    const frog = this.character;
    if (this.index >= this.phases.length) return this;
    const [state, xInc, dirChange] = this.phases[this.index];
    frog.animatoryState = state;
    frog.x += xInc * frog.direction;
    frog.direction *= dirChange;
    this.index += 1;
  }
}

export class Grow extends Command {
  constructor(half, full, die) { super(); this.half = half; this.full = full; this.die = die; this.count = 0; }
  isInterruptible() { return false; }
  execute() {
    const plant = this.character;
    if (!plant.growing) return;
    this.count += 1;
    if (this.count === this.half) plant.appear();
    else if (this.count === this.full) plant.finishGrowing();
    else if (this.count >= this.die) { plant.die(); this.count = 0; }
  }
}

export class Fall extends Command {
  isInterruptible() { return false; }
  execute() {
    const thing = this.character;
    if (!thing.visible) return;
    if (thing.getFloor() || thing.hitVictim()) thing.hide();
    thing.y += 1;
  }
}

export class MoveBike extends Command {
  isInterruptible() { return false; }
  execute() {
    const bike = this.character;
    if (bike.momentum <= 0 || !bike.visible) return;
    bike.wheel();
    if (bike.momentum <= 0) bike.fall();
  }
}

// ---- Registry: name -> class (used by data/commandLists.js) -----------------

export const COMMANDS = {
  GoTo, GoToRandomLocation, GoToXY, GoTowardsXY, Restart, FindSeat, MoveAboutUntil, WalkAround, SitStill, WalkFast,
  GrassAndAnswerQuestions, WaitUntil, DoAssemblyDuty, StartAssemblyIfReady, ConductAssembly, StartLessonIfReady,
  StartDinnerIfReady, TellKidsToSitDown, ConductClass, ConductClassWithoutEric, TellClassWhatToDo, WalkUpOrDown,
  WriteOnBoard, ConductClassWithEric, WipeBoard, WriteOnBoardUnless, Say, Signal, Unsignal, SetControllingCommand,
  SetSubcommand, FireNowAndThen, HitNowAndThen, StalkAndHit, FireCatapult, Hit, Floored, KnockedOver,
  OpenDoor, ShutDoor, SetRestartPoint, JumpIfShut, JumpIfOpen, WaitAtDoor, SitForAssembly,
  FindEric, Freeze, TellEric, TellEricAndWait, SetClock, EndGame, AddLines, FetchEric, FindEricIfMissing, Follow,
  WatchForEric, StopEric, ShadowEric, MonitorEric, ChaseEricOut, Pause,
  Jump, Write, FireWaterPistol, DumpWaterPistol, DropStinkbomb, Catch, ReleaseMice, Kiss, FallToFloor, Flight,
  RideBike, JumpOffSaddle, MovePellet, MoveWater, Stink, MoveDeskLid, MoveMouse, EvadeMouse, MoveFrog, Hop, Grow,
  Fall, MoveBike,
};
