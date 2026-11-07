// ============================================================================
// CHARACTER (anyone who walks about: pupils, teachers, Albert)
// ----------------------------------------------------------------------------
// A character has a position (x, y in cells), a direction (-1 left, 1 right),
// an "animatory state" (which picture to draw: WALK0..3, SITTING_ON_CHAIR,
// ARM_UP, ...) and a CommandList that decides what to do each tick.
//
// Movement is deliberately chunky, like the original: a character takes two
// "half steps" per cell. States WALK1 and WALK3 are the in-between
// ("midstride") poses where the x position hasn't changed yet.
//
// Eric (the player) extends this class in eric.js and replaces the command
// list with keyboard control.
// ============================================================================

import { CommandList, OpenDoor, GoToXY, KnockedOver, Floored, FindSeat, EvadeMouse, Pause } from './commands.js';
import { SPRITE_GROUPS } from '../data/cast.js';
import { MESSAGES } from '../data/messages.js';

export const WALK_STATES = ['WALK0', 'WALK1', 'WALK2', 'WALK3'];

export class Character {
  constructor(spec, services) {
    const { world, cast, game, config, rng } = services;
    this.world = world; this.cast = cast; this.game = game; this.config = config; this.rng = rng;

    this.id = spec.id; this.name = spec.name; this.title = spec.title || null;
    this.group = spec.group; this.flags = spec.flags || '';
    this.look = spec.look || {};
    this.headXY = spec.headXY || [1, 1];
    this.states = new Set(SPRITE_GROUPS[this.group] || WALK_STATES);
    this.width = 3; this.height = 4;

    this.initialX = spec.x; this.initialY = spec.y; this.initialDirection = spec.dir || -1;
    this.x = spec.x; this.y = spec.y; this.direction = this.initialDirection;
    this.animatoryState = 'WALK0';
    this.previousAs = 'WALK0';
    this.verticalDirection = 0;
    this.visible = true;

    // Timing
    this.speed = 1; this.fixedSpeed = false; this.speedChangeDelay = 1;
    this.walkDelay = 1; this.actionDelay = 0; this.action = 0;
    this.alwaysRuns = false;
    this.slowDelay = config.goSlow; this.fastDelay = config.goFast; this.fasterDelay = config.goFaster;

    // Behaviour
    this.commandList = new CommandList(this);
    this.lessonCommandLists = {};
    this.randomLocations = spec.randomLocations || [];
    this.bubble = null;
    this.linesMessage = null;
    this.messageBoxCoords = null;
    this.wipingBoard = false;
    this.changesSeats = true;
    this.kisses = config.kissCounter;
    this.paused = false;
    this.stopEric = false;
    this.comeAlongIndex = 0;
    this.comeAlongMessages = ['COME_ALONG_1', 'COME_ALONG_2'];
    this.pellet = null;
    this.qaGenerator = null;
    this.bikeSecret = null;
    this.storeroomSecret = null;
    this.lesson = null;

    // Cached surroundings, refreshed every move
    this.room = null; this.floor = null; this.staircase = null; this.barrier = null;
  }

  reinitialise() {
    this.x = this.initialX; this.y = this.initialY; this.direction = this.initialDirection;
    this.animatoryState = 'WALK0'; this.previousAs = 'WALK0';
    this.bubble = null; this.linesMessage = null; this.lesson = null;
    this.speed = 1; this.fixedSpeed = false; this.speedChangeDelay = 1; this.walkDelay = 1;
    this.kisses = this.config.kissCounter; this.changesSeats = true; this.paused = false; this.stopEric = false;
    this.commandList = new CommandList(this);
  }

  // ---- Flags -----------------------------------------------------------------
  has(flag) { return this.flags.includes(flag); }
  isAdult() { return this.has('A'); }
  isConkerable() { return this.has('C'); }
  canOpenDoors() { return this.has('D'); }
  isPunchable() { return this.has('F'); }
  hasSafeKey() { return this.has('K'); }
  canGiveLines() { return this.has('L'); }
  isScaredOfMice() { return this.has('M'); }
  canSmellStinkbombs() { return this.has('N'); }
  isPelletable() { return this.has('P'); }
  canReceiveLines() { return this.has('R'); }
  addsToLinesTotal() { return this.has('U'); }
  addsToScore() { return this.has('V'); }
  sometimesRuns() { return !this.has('W'); }
  hasBikeSecret() { return this.has('X'); }
  hasStoreroomSecret() { return this.has('Y'); }
  isVeryConkerable() { return this.has('Z'); }
  isEric() { return false; }
  isHome(x) {
    if (this.has('G')) return this.x > x;
    if (this.has('B')) return this.x < x - 1;
    return true;
  }

  // ---- State queries ---------------------------------------------------------
  isStanding() { return WALK_STATES.includes(this.animatoryState); }
  isSitting() { return this.animatoryState === 'SITTING_ON_FLOOR' || this.animatoryState === 'SITTING_ON_CHAIR'; }
  isSittingOnFloor() { return this.animatoryState === 'SITTING_ON_FLOOR' && !!this.getFloor(); }
  isSittingOnChair() { return this.animatoryState === 'SITTING_ON_CHAIR' && !!this.chair(); }
  isSittingOnStairs() { return this.animatoryState === 'SITTING_ON_CHAIR' && !this.chair(); }
  isKnockedOver() { return this.animatoryState === 'KNOCKED_OVER'; }
  isKnockedOut() { return this.animatoryState === 'KNOCKED_OUT'; }
  hasArmRaised() { return this.animatoryState === 'ARM_UP'; }
  isRaisingCatapult() { return this.animatoryState === 'CATAPULT0'; }
  isLoweringCatapult() { return this.animatoryState === 'CATAPULT0'; }
  isRaisingFist() { return this.animatoryState === 'HITTING0'; }
  isLoweringFist() { return this.animatoryState === 'HITTING0'; }
  isRidingBike() { return this.animatoryState === 'RIDING_BIKE0' || this.animatoryState === 'RIDING_BIKE1'; }
  midstride() { return this.animatoryState === 'WALK1' || this.animatoryState === 'WALK3'; }
  walkStateIndex() { return WALK_STATES.indexOf(this.animatoryState); }
  isInterruptible() { return this.commandList.isInterruptible(); }
  isFacing(thing) { return this.direction * (thing.x - this.x) >= 0; }
  // A character can act as a "barrier" (Albert blocking Eric), so answer the
  // same questions a wall or door would.
  isDoor() { return false; }
  isShut() { return true; }

  // ---- Simple pose changes ---------------------------------------------------
  turn() { this.direction *= -1; }
  getUp() { if (this.isSittingOnChair()) this.chair().vacate(); this.animatoryState = this.previousAs; }
  standUp() { this.animatoryState = 'WALK0'; this.resetWalkDelay(); }
  sitOnFloor() { this.animatoryState = 'SITTING_ON_FLOOR'; }
  raiseArm() { this.animatoryState = 'ARM_UP'; }
  lowerArm() { this.animatoryState = 'WALK0'; }
  knockOver() {
    this.previousAs = this.animatoryState;
    this.animatoryState = this.isAdult() ? 'KNOCKED_OVER' : 'KNOCKED_OUT';
    this.action = 1;
  }
  raiseFist() { this.previousAs = this.animatoryState; this.animatoryState = 'HITTING0'; this.action = 3; }
  punch() { this.animatoryState = 'HITTING1'; }
  lowerFist() { this.animatoryState = 'HITTING0'; }
  raiseCatapult() { this.previousAs = this.animatoryState; this.animatoryState = 'CATAPULT0'; this.action = 3; }
  aimCatapult() { this.animatoryState = 'CATAPULT1'; }
  lowerCatapult() { this.animatoryState = 'CATAPULT0'; }
  aimWaterPistol() { this.previousAs = this.animatoryState; this.animatoryState = 'WATERPISTOL'; this.action = 3; }
  completeAction() { this.animatoryState = 'WALK0'; this.action = 0; }
  hide() { this.x = -3; this.visible = false; }
  unhide() { this.visible = true; }

  // ---- Surroundings ----------------------------------------------------------
  getFloor(thing = null) { return this.world.floor(thing || this); }
  onStairs() { return this.staircase ? (this.x !== this.staircase.bottom.x && this.x !== this.staircase.top.x) : false; }
  getNextStaircase(dest) { return this.world.nextStaircase(this.getFloor(), this.world.floorAt(dest.x, dest.y) || this.world.floor(dest)); }
  chair(checkDir = true) { return this.world.chair(this, checkDir); }
  impeded(bottomY, topY) { return topY - this.height < this.y && this.y <= bottomY; }
  canOpenDoor() { return this.canOpenDoors(); }
  openDoor() { return new OpenDoor(this.barrier.id); }
  getLocation() {
    const s = this.world.staircase(this);
    if (s && s.supports(this)) {
      if (s.bottom.y - this.y < this.y - s.top.y) return { x: s.bottom.x, y: s.bottom.y };
      return { x: s.top.x, y: s.top.y };
    }
    const below = this.world.floorBelow(this);
    return { x: this.x, y: below ? below.y : this.y };
  }
  getRandomDestination() {
    const locs = this.randomLocations;
    if (!locs.length) return { x: this.x, y: this.y };
    if (locs.length === 1) return { x: locs[0][0], y: locs[0][1] };
    let dest;
    let guard = 0;
    do { const l = this.rng.choice(locs); dest = { x: l[0], y: l[1] }; } while (dest.x === this.x && dest.y === this.y && guard++ < 10);
    return dest;
  }
  resolveLocationId(id) {
    if (typeof id !== 'string') return null;
    if (id.startsWith('Location:')) {
      const other = this.cast.get(id.slice(9));
      return other ? other.getLocation() : null;
    }
    return this.world.resolveLocationId(id);
  }
  getNextChair(moveAlong, goToBack) {
    if (this.room) return this.room.getNextChair(this, moveAlong && this.changesSeats, goToBack);
    return [null, 1];
  }
  getBlackboard() { return this.room ? this.room.blackboard : null; }
  getBlackboardBacktrack() { return this.config.blackboardBacktrack; }
  getBlackboardPaceDistance() { return this.config.blackboardPaceDistance; }

  // ---- Timing ----------------------------------------------------------------
  goFast() { this.speed = 2; this.fixedSpeed = true; }
  goSlow() { this.speed = 1; this.fixedSpeed = true; }
  triggerSpeedChange() { this.fixedSpeed = false; this.speedChangeDelay = 1; }
  resetWalkDelay() { this.walkDelay = this.speed === 2 ? this.fastDelay : this.slowDelay; }
  isTimeToMove() {
    if (this.bubble) { this.actionDelay = (this.actionDelay + 1) % this.fastDelay; return this.actionDelay === 0; }
    if (this.action === 1 || this.action === 2) { this.actionDelay = (this.actionDelay + 1) % this.slowDelay; return this.actionDelay === 0; }
    if (this.action === 3) { this.actionDelay = (this.actionDelay + 1) % this.fasterDelay; return this.actionDelay === 0; }
    this.walkDelay -= 1;
    if (this.walkDelay > 0) return false;
    this.speedChangeDelay -= 1;
    if (this.speedChangeDelay === 0) {
      this.speedChangeDelay = this.rng.int(...this.config.speedChangeDelayRange);
      if (!this.fixedSpeed) {
        if (this.alwaysRuns) this.speed = 2;
        else if (this.sometimesRuns()) this.speed = this.rng.int(1, 2);
        else this.speed = 1;
      }
    }
    this.resetWalkDelay();
    return true;
  }

  // ---- The per-tick update ---------------------------------------------------
  move() {
    this.giveLinesNow();
    if (!this.isTimeToMove()) return;
    if (this.midstride()) return this.walk();
    this.staircase = this.world.staircase(this);
    this.barrier = this.world.barrier(this);
    this.room = this.world.room(this);
    this.floor = this.getFloor();
    this.commandList.command();
  }

  // ---- Walking ---------------------------------------------------------------
  left() {
    if (this.direction > 0) { this.turn(); return; }
    if (this.barrier && this.barrier.x <= this.x) {
      if (this.barrier.isDoor() && this.canOpenDoor(this.barrier)) return this.openDoor();
      return new GoToXY(this.x + 1, this.y);
    }
    let onStairs = false;
    if (this.staircase) {
      if (this.staircase.direction < 0) onStairs = this.x !== this.staircase.bottom.x || this.staircase.force;
      else onStairs = this.x !== this.staircase.top.x || this.staircase.force;
    }
    this.walk(onStairs);
  }
  right() {
    if (this.direction < 0) { this.turn(); return; }
    if (this.barrier && this.x < this.barrier.x) {
      if (this.barrier.isDoor() && this.canOpenDoor(this.barrier)) return this.openDoor();
      return new GoToXY(this.x - 1, this.y);
    }
    let onStairs = false;
    if (this.staircase) {
      if (this.staircase.direction > 0) onStairs = this.x !== this.staircase.bottom.x || this.staircase.force;
      else onStairs = this.x !== this.staircase.top.x || this.staircase.force;
    }
    this.walk(onStairs);
  }
  up() {
    if (this.staircase) {
      if (this.direction === this.staircase.direction || (this.x === this.staircase.top.x && this.staircase.force)) return this.walk(true);
      if (this.x !== this.staircase.top.x) return this.turn();
    }
    return this.direction > 0 ? this.right() : this.left();
  }
  down() {
    if (this.staircase) {
      if (this.direction !== this.staircase.direction || (this.x === this.staircase.bottom.x && this.staircase.force)) return this.walk(true);
      if (this.x !== this.staircase.bottom.x) return this.turn();
    }
    return this.direction > 0 ? this.right() : this.left();
  }
  walk(onStairs = false) {
    if (onStairs && this.staircase) {
      if (this.direction === this.staircase.direction) { if (!this.midstride()) this.y -= 1; }
      else this.verticalDirection = 1;
    }
    let walkState = (this.walkStateIndex() + 1) % 4;
    if (walkState % 2 === 0) {
      this.x += this.direction;
      this.y += this.verticalDirection;
      if (this.wipingBoard) walkState = 0;
      this.verticalDirection = 0;
    }
    this.animatoryState = WALK_STATES[walkState];
    this.action = 0;
  }
  sit() {
    if (this.isSitting()) { this.getUp(); return true; }
    this.previousAs = this.animatoryState;
    const chair = this.chair();
    if (chair) {
      this.animatoryState = 'SITTING_ON_CHAIR';
      const occupant = chair.occupant;
      chair.seat(this);
      if (occupant && occupant !== this) occupant.dethrone();
    } else {
      const s = this.world.staircase(this);
      if (s && s.supports(this)) {
        if (this.canSitOnStairs() && this.direction * s.direction < 0) this.animatoryState = 'SITTING_ON_CHAIR';
      } else {
        this.sitOnFloor();
      }
    }
    this.action = 1;
    return this.animatoryState !== this.previousAs;
  }
  canSitOnStairs() { return true; }
  dethrone() {
    this.sitOnFloor();
    this.addCommand(new FindSeat(false));
    this.addCommand(new Floored(this.config.dethronedDelay));
  }
  keepSeat() { this.changesSeats = false; }

  // ---- Being hit -------------------------------------------------------------
  isDeckable() {
    if (!this.world.onFloor(this)) return false;
    if (this.isAdult()) return this.isStanding() || this.hasArmRaised();
    return this.isStanding() || this.isSittingOnChair();
  }
  isPunchableNow() { return this.isPunchable() && this.isDeckable(); }
  deck(paralyse = false) {
    this.knockOver();
    this.kisses = Math.max(0, this.kisses - this.config.kissCounterDeckrement);
    if (this.isAdult()) {
      this.addCommand(new KnockedOver(this.config.knockedOverDelay, this.config.reprimandDelay, paralyse));
      if (paralyse) { this.game.playSound('CONKER'); this.game.rewindClock(this.config.conkerClockTicks); }
    } else {
      if (this.previousAs === 'SITTING_ON_CHAIR') { this.chair()?.vacate(); this.addCommand(new FindSeat(false, false)); }
      this.addCommand(new Floored(this.config.knockedOutDelay));
    }
    this.game.playSound('KNOCKED_OUT');
    this.game.events.emit('decked', { character: this });
  }
  isTimeToWake() { return this.game.isTimeRemaining(this.config.conkerWakeTime); }
  canGiveLinesNow() {
    if (this.world.onFloor(this) || this.world.onStaircase(this)) return this.isStanding() || this.hasArmRaised();
    return false;
  }
  getPunchee(offset) { return this.cast.getPunchee(this, offset); }
  getNearbyAdults() { return this.cast.getNearbyAdults(this); }
  hasLineOfSightTo(c) { return this.world.lineOfSightBetween(this, c); }
  willHit() { return this.rng.random() < this.config.hitProbability; }
  willWriteOnBoard() { return this.rng.random() < this.config.writeOnBoardProbability; }
  willFireCatapult() { return this.rng.random() < this.config.fireCatapultProbability; }
  canFireCatapult() { return this.states.has('CATAPULT0') && this.pellet && !this.pellet.visible; }
  fireCatapult() { this.pellet.launch(this.x + this.direction, this.y, this.direction); }
  canFireWaterPistol() { return this.states.has('WATERPISTOL') && this.cast.water && !this.cast.water.visible; }
  fireWaterPistol(liquid = 'WATER') { this.cast.water.launch(this.x + 2 * this.direction, this.y - 2, this.direction, liquid); }
  canDropStinkbomb() { return this.states.has('ARM_UP') && this.cast.stinkbomb && !this.cast.stinkbomb.visible; }
  dropStinkbomb() { this.cast.stinkbomb.drop(this.x + this.direction, this.y); }

  // Head position: used by falling things (water, frog, conker).
  headCoords() {
    let hx = this.x + this.headXY[0], hy = this.y + this.headXY[1];
    if (this.isAdult() && this.isKnockedOver()) hy += 1;
    return [hx, hy];
  }
  headAt(x, y) { const [hx, hy] = this.headCoords(); return hx === x && hy === y; }

  // ---- Mice and stinkbombs ---------------------------------------------------
  checkMouse(mouse) {
    if (!(this.isScaredOfMice() && this.isInterruptible() && !this.bubble)) return;
    if (this.y === mouse.y && 0 <= (mouse.x - this.x) * this.direction && (mouse.x - this.x) * this.direction <= this.config.mouseProximity) {
      this.addCommand(new EvadeMouse(this.config.evadeMouseDelay));
    }
  }
  canSmellStinkbomb(bomb) {
    if (this.canSmellStinkbombs() && this.isStanding() && this.y === bomb.y) return Math.abs(bomb.x - this.x) <= bomb.stinkRange;
    return false;
  }
  openWindow(window) {
    if (!this.commandList.isGoToing()) this.addCommand(new GoToXY(this.x, this.y));
    this.addCommand(new OpenDoor(window.id));
    this.addCommand(new GoToXY(window.openerCoords[0], window.openerCoords[1]));
  }

  // ---- Doors -----------------------------------------------------------------
  checkDoorStatus(id, shut) { return this.world.isDoorShut(id) === shut; }
  moveDoor(id, shut) {
    if (shut) this.cast.moveBikeAway(id);
    this.world.moveDoor(id, shut);
    this.game.events.emit('door', { id, shut });
  }
  waitAtDoor(doorId) { return this.cast.isHome(this.world.getDoor(doorId).x); }

  // ---- Command list plumbing -------------------------------------------------
  addCommand(command) { this.commandList.addCommand(command); }
  restartCommandList() { this.commandList.restart(); }
  setRestartPoint() { this.commandList.setRestartPoint(); }
  setControllingCommand(command) { this.commandList.setControllingCommand(command); }
  setSubcommand(name, args) { this.commandList.setSubcommand(name, args); }
  jumpIfShut(doorId, offset) { if (this.world.isDoorShut(doorId)) this.commandList.jump(offset); }
  jumpIfOpen(doorId, offset) { if (!this.world.isDoorShut(doorId)) this.commandList.jump(offset); }
  changeCommandList(id) { this.cast.changeCommandList(this.id, id); }
  setCommandListTemplate(template) { this.commandList.setTemplate(template); }
  stalk(characterId) { this.commandList.setGoToDestination(this.getDestination(characterId)); }
  getDestination(characterId) { const c = this.cast.get(characterId); return c ? c.commandList.getGoToDestination() : null; }
  getCommandListId(lessonId) { return this.lessonCommandLists[lessonId]; }

  // ---- Signals, clock, home room (all delegated) ----------------------------
  signal(s) { this.world.signal(s); }
  unsignal(s) { this.world.unsignal(s); }
  gotSignal(s) { return this.world.gotSignal(s); }
  isTimeToStartLesson() { return this.game.isTimeToStartLesson(); }
  stopClock() { this.game.stopClock(); }
  startClock(ticks) { this.game.startClock(ticks); }
  setHomeRoom() { this.game.setHomeRoom(); }
  unsetHomeRoom() { this.world.unsetHomeRoom(); }
  endGame() { this.game.endGame(); }
  addLines(n) { this.game.addLines(n); }

  // ---- Speech ----------------------------------------------------------------
  say(words, shift) {
    if (!this.bubble) {
      const lipPos = (this.x + 1) % 8;
      this.bubble = {
        x: this.x + 1 - lipPos,
        y: this.y - (this.isAdult() || this.isStanding() ? 3 : 2),
        lipPos, words, shift,
      };
    }
    this.bubble.shift = shift;
    // Finished once the text has scrolled fully out of the bubble (8 px per step).
    return Math.max(0, shift) * 8 > this.game.measureText(words);
  }
  removeBubble() { this.bubble = null; }

  // ---- Lines -----------------------------------------------------------------
  giveLines(recipientId, messageId, now = false) {
    this.linesMessage = [recipientId, messageId];
    if (now) this.giveLinesNow();
  }
  giveLinesNow() {
    if (this.linesMessage) { this.printLinesMessage(...this.linesMessage); this.linesMessage = null; }
  }
  printLinesMessage(recipientId, messageId) {
    if (!this.game.isOnScreen(this)) return;
    const recipient = this.cast.get(recipientId);
    const admonition = MESSAGES.lines[messageId];
    if (!(recipient && admonition)) return;
    if (recipient.isEric() && recipient.expelled) return;
    const numLines = 100 * this.rng.int(...this.config.linesRange);
    const lines1 = MESSAGES.linesTemplate.replace('$n', String(numLines)).replace('$r', recipient.name).split('^');
    let paper;
    if (recipient.isEric()) { paper = 'eric'; this.game.addLines(numLines); }
    else {
      paper = 'other';
      if (recipient.addsToScore()) this.game.addToScore(numLines);
      else if (recipient.addsToLinesTotal()) this.game.addLines(numLines);
    }
    this.game.events.emit('lines', { giver: this, recipient, amount: numLines, messageId, text: admonition.replace('^', ' ') });
    const coords = this.headCoords();
    this.game.showMessageBox({ x: coords[0], y: coords[1], lines: lines1, paper, sound: 'LINES1' });
    this.game.showMessageBox({ x: coords[0], y: coords[1], lines: admonition.split('^'), paper, sound: 'LINES2' });
  }
  canGiveLinesMessage(id) { return !!MESSAGES.lines[id]; }
  reprimand() {
    const recipient = this.cast.getNearestLinesRecipient(this);
    if (recipient) this.giveLines(recipient.id, 'NEVER_AGAIN');
  }
  getComeAlongMessageId() {
    const id = this.comeAlongMessages[this.comeAlongIndex];
    this.comeAlongIndex = (this.comeAlongIndex + 1) % this.comeAlongMessages.length;
    return id;
  }
  resetComeAlongIndex() { this.comeAlongIndex = 0; }
  printSecret(secret) {
    const [hx, hy] = this.headCoords();
    this.game.showMessageBox({ x: hx, y: hy, lines: [secret], paper: 'secret', sound: 'LINES2' });
    this.game.events.emit('secret', { character: this, secret });
  }
  revealBikeSecret() { if (this.bikeSecret && this.game.isOnScreen(this)) this.printSecret(this.bikeSecret); }
  revealStoreroomSecret() { if (this.storeroomSecret && this.game.isOnScreen(this)) this.printSecret(this.storeroomSecret); }

  // ---- Messages --------------------------------------------------------------
  getTitle() { return this.title || this.name; }
  getAssemblyMessage() { return this.cast.assemblyMessages.generate(); }
  getSitDownMessage() { const m = MESSAGES.sitDown[this.id]; return m ? this.expandNames(this.rng.choice(m)) : null; }
  getBlackboardMessage() { const m = MESSAGES.blackboard[this.id]; return m ? this.expandNames(this.rng.choice(m)) : null; }
  getLessonMessage() { return this.rng.choice(MESSAGES.lesson); }
  expandNames(message) { return this.cast.expandNames(message); }

  // ---- Lesson hooks ----------------------------------------------------------
  isTeachingEric() { return this.game.isTeachingEric(this); }
  startLesson() { this.cast.createLesson(this, this.room); }   // called by the swot
  joinLesson(qaGroup) {
    if (!this.cast.lesson) return false;    // the swot hasn't sat down yet
    this.lesson = this.cast.lesson;
    this.lesson.join(this, this.qaGenerator, qaGroup);
    return true;
  }
  nextSwotAction() { return this.cast.lesson?.nextSwotAction(); }
  nextTeacherAction() { return this.lesson?.nextTeacherAction(); }
  finishedSpeaking() { (this.lesson || this.cast.lesson)?.finishedSpeaking(); }
  writeOnBoard(message, index) {
    this.action = 2;
    const board = this.getBlackboard();
    if (board) {
      const ch = message[index - 1];
      if (ch === '^') board.newline(); else board.write(ch, this.game.measureText);
      board.writer = this;
    }
    return index === message.length;
  }
  wipeBoard(column) { const b = this.getBlackboard(); if (b) b.wipe(column); }

  // ---- Eric-related ----------------------------------------------------------
  isFacingEric() { return this.isFacing(this.cast.eric); }
  isBesideEric() { return this.cast.isBesideEric(this); }
  isEricAbsent() { return this.cast.eric.isAbsent(); }
  isEricExpelled() { return this.cast.eric.expelled; }
  isTouchingEric() { return this.cast.isTouchingEric(this); }
  freezeEric() { return this.cast.eric.freeze(); }
  unfreezeEric() { this.cast.eric.unfreeze(); }
  ericUnderstood() { return this.cast.eric.understood; }
  getLocationOfEric() { return this.cast.eric.getLocation(); }
  getTellEricDelay() { return this.config.tellEricDelay; }
  shouldStopEric(escapeX, dangerZone) {
    const { x: ex, y: ey } = this.getLocationOfEric();
    if (ey !== this.y || this.direction > 0) return false;
    return ex >= escapeX && this.x - dangerZone[1] <= ex && ex <= this.x - dangerZone[0];
  }
  raiseAlarm(message, alerteeId, commandListId) {
    const [hx, hy] = this.headCoords();
    this.game.showMessageBox({ x: hx, y: hy, lines: this.expandNames(message).split('^'), paper: 'alarm', sound: 'ALARM' });
    if (!this.isEricExpelled()) this.cast.changeCommandList(alerteeId, commandListId);
  }
  shouldChaseEric(chaseX) {
    if (this.game.isPlaytime()) return false;
    const { x: ex, y: ey } = this.getLocationOfEric();
    return ex >= chaseX && ey === this.y;
  }

  // ---- Kissing ---------------------------------------------------------------
  canKissEric() { return this.states.has('KISSING_ERIC'); }
  willKissEric() { return this.kisses > 0; }
  pause() { this.paused = true; this.addCommand(new Pause()); }
  resume() { this.paused = false; }
  kissEric() {
    this.previousAs = this.animatoryState;
    this.animatoryState = 'KISSING_ERIC';
    this.x += this.direction;
    this.direction *= -1;
    this.kisses = Math.max(this.kisses - this.config.kissCounterDecrement, 0);
  }
  isKissingEric() { return this.animatoryState === 'KISSING_ERIC'; }
  finishKiss() { this.animatoryState = this.previousAs; this.direction *= -1; }

  // ---- Plants ----------------------------------------------------------------
  fallOffPlant() { this.y += 1; }
}
