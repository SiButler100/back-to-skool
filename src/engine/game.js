// ============================================================================
// THE GAME
// ----------------------------------------------------------------------------
// Owns the world, the cast, the clock, the score and the lines total, and
// advances everything one "tick" at a time. The renderer and HUD read from
// here; features subscribe to `game.events`.
//
// The flow of one tick:
//   1. If a message box (lines!) is on screen, wait (the original froze too).
//   2. Tick the clock; ring the bell and change lesson if it ran out.
//   3. Move everyone (Eric first, then the cast, then the objects).
//   4. Shut any doors whose timers ran out.
// ============================================================================

import { World } from './world.js';
import { Cast } from './cast.js';
import { Timetable } from './timetable.js';
import { EventBus } from './events.js';
import { RNG } from './rng.js';
import { CONFIG } from '../config.js';
import { MESSAGES } from '../data/messages.js';
import { COMMAND_LISTS } from '../data/commandLists.js';

export class Game {
  constructor({ input, config = {}, seed = null, measureText = (s) => s.length * 6, fontHas = () => true } = {}) {
    this.config = { ...CONFIG, ...config };
    this.rng = new RNG(seed || undefined);
    this.events = new EventBus();
    this.measureText = measureText;
    this.fontHas = fontHas;

    this.world = new World();
    this.timetable = new Timetable(this.config);
    const services = { world: this.world, game: this, config: this.config, rng: this.rng, cast: null };
    this.cast = new Cast(services, input);
    this.input = input;

    this.score = 0; this.lines = 0; this.hiScore = Number(globalThis.localStorage?.getItem('bts.hiScore') || 0);
    this.tickCount = 0;
    this.messageQueue = [];      // pending message boxes
    this.messageBox = null;      // the one currently showing
    this.messageTicks = 0;
    this.gameOver = false;
    this.upAYearPending = false;
    this.visibleColumns = [0, this.config.viewportColumns];
    this.started = false;
  }

  // ---- Starting and restarting -----------------------------------------------
  start() {
    this.score = 0; this.lines = 0; this.gameOver = false; this.tickCount = 0;
    this.messageQueue = []; this.messageBox = null; this.messageTicks = 0;
    this.world.clearSignals(); this.world.unsetHomeRoom();
    this.cast.reinitialise();
    this.timetable.reinitialise();
    this.nextLesson(false);
    this.started = true;
    this.events.emit('start', {});
    this.events.emit('score', { score: this.score, hiScore: this.hiScore });
    this.events.emit('linesTotal', { lines: this.lines });
    this.cast.eric.inventoryChanged();
  }

  nextLesson(ringBell = true) {
    this.timetable.nextLesson();
    this.cast.setLesson(this.timetable.lessonId);
    this.world.clearSignals();
    this.world.unsetHomeRoom();
    if (ringBell) this.playSound('BELL');
    this.events.emit('lesson', this.lessonDescription());
  }

  // What the lesson box shows: [teacher name, room name].
  lessonDescription() {
    const tt = this.timetable;
    const teacherId = tt.hideTeacher() ? '' : tt.teacherId();
    const room = this.world.getRoom(tt.roomId());
    const teacher = this.cast.get(teacherId);
    let line1 = teacher ? teacher.name : teacherId;
    let line2 = room ? room.name : tt.roomId();
    if (!line1) {
      const parts = line2.split(' ');
      if (parts.length > 1) { line1 = parts[0]; line2 = parts.slice(1).join(' '); }
    }
    return { teacher: line1, room: line2, lessonId: tt.lessonId, index: tt.index };
  }

  // ---- The tick --------------------------------------------------------------
  tick() {
    if (!this.started) return;
    this.tickCount += 1;
    // Message boxes freeze the action (authentic), unless configured otherwise.
    if (this.messageBox) {
      this.messageTicks -= 1;
      if (this.messageTicks <= 0) this.messageBox = null;
      if (this.config.freezeOnMessages) { this.input.flush(); return; }
    }
    if (!this.messageBox && this.messageQueue.length) {
      this.messageBox = this.messageQueue.shift();
      this.messageTicks = this.config.messageBoxTicks;
      if (this.messageBox.sound) this.playSound(this.messageBox.sound);
      this.events.emit('messageBox', this.messageBox);
      if (this.config.freezeOnMessages) { this.input.flush(); return; }
    }
    if (this.gameOver) { this.input.flush(); return; }
    if (this.upAYearPending) return;

    if (this.timetable.tick()) this.nextLesson(true);
    this.cast.move();
    this.world.autoShutDoors();
    this.events.emit('tick', { tick: this.tickCount });
  }

  // ---- Score and lines -------------------------------------------------------
  addToScore(n) {
    this.score += n;
    if (this.score > this.hiScore) { this.hiScore = this.score; try { localStorage.setItem('bts.hiScore', String(this.hiScore)); } catch (e) { /* no storage */ } }
    this.events.emit('score', { score: this.score, hiScore: this.hiScore });
  }
  addLines(n) {
    this.lines = Math.max(0, this.lines + n);
    this.events.emit('linesTotal', { lines: this.lines });
    if (this.lines >= this.config.maxLines && !this.cast.eric.expelled) {
      this.cast.eric.expelled = true;
      this.expelEric('ExpelEric:TooManyLines');
    }
  }
  expelEric(commandListId) {
    const expeller = this.cast.get('WACKER');
    if (expeller && COMMAND_LISTS[commandListId]) expeller.setCommandListTemplate(COMMAND_LISTS[commandListId]);
    this.events.emit('expelling', { reason: commandListId });
  }
  endGame(upAYear = false) {
    this.gameOver = true;
    this.events.emit('gameOver', { upAYear, score: this.score, lines: this.lines });
  }
  upAYear() {
    this.addToScore(this.config.upAYearScore);
    this.playSound('UP_A_YEAR');
    this.upAYearPending = true;
    this.events.emit('upAYear', { score: this.score });
    this.events.emit('quest', { step: 'safeOpened' });
    // After the fanfare, the game is won and restarts on request.
    setTimeout(() => { this.upAYearPending = false; this.endGame(true); }, 2500);
  }

  // ---- Message boxes ---------------------------------------------------------
  showMessageBox(box) { this.messageQueue.push(box); }

  // ---- Clock and timetable helpers used by characters ------------------------
  isTimeToStartLesson() { return this.timetable.isTimeToStartLesson(); }
  isTimeRemaining(t) { return this.timetable.isTimeRemaining(t); }
  stopClock() { this.timetable.stop(); }
  startClock(t) { this.timetable.resume(t); }
  rewindClock(t) { this.timetable.rewind(t); }
  isPlaytime() { return this.timetable.isPlaytime(); }
  isAssembly() { return this.timetable.isAssembly(); }
  isTeachingEric(c) { return this.timetable.teacherId() === c.id; }
  getTeacher() { return this.cast.get(this.timetable.teacherId()); }
  setHomeRoom() { this.world.setHomeRoom(this.timetable.roomId()); }
  shouldGetAlong(eric) {
    const home = this.world.homeRoom;
    if (home) return !home.contains(eric);
    if (this.timetable.isTimeToGetAlong()) {
      const room = this.world.room(eric);
      if (room) {
        const dest = this.world.getRoom(this.timetable.roomId());
        return room !== dest && room.getAlong;
      }
      if (this.world.inPlayground(eric) && !this.timetable.isPlaytime()) return true;
    }
    return false;
  }

  // ---- Screen ----------------------------------------------------------------
  setVisibleColumns(from, to) { this.visibleColumns = [from, to]; }
  isOnScreen(c) { return c.x + 2 >= this.visibleColumns[0] && c.x <= this.visibleColumns[1]; }

  // ---- Sound -----------------------------------------------------------------
  playSound(id) { this.events.emit('sound', id); }

  // ---- Debug helpers (used by the test harness and the console) --------------
  describe() {
    const e = this.cast.eric;
    return { tick: this.tickCount, lesson: this.timetable.lessonId, counter: this.timetable.counter, eric: [e.x, e.y, e.animatoryState], score: this.score, lines: this.lines };
  }
}

export { MESSAGES };
