// ============================================================================
// THE SCHOOL CLOCK
// ----------------------------------------------------------------------------
// Counts down each period and knows which lesson is on. The bell rings when
// the counter drops below zero; the game then moves to the next period.
// ============================================================================

import { TIMETABLE, LESSONS, HIDE_TEACHER } from '../data/timetable.js';

export class Timetable {
  constructor(config) {
    this.config = config;
    this.lessons = TIMETABLE;
    this.index = -1;
    this.lessonId = null;
    this.counter = 0;
    this.ticking = true;
  }

  get details() { return LESSONS[this.lessonId]; }
  get lessonLength() { return this.config.lessonLength; }

  isAssembly() { return this.lessonId?.startsWith('Assembly'); }
  isPlaytime() { return this.lessonId?.startsWith('Playtime'); }

  // Move on to the next period and reset the clock.
  nextLesson() {
    this.ticking = true;
    this.counter = this.lessonLength;
    this.index = (this.index + 1) % this.lessons.length;
    this.lessonId = this.lessons[this.index];
  }

  // After a game ends, jump to the next playtime so a new game starts outside.
  reinitialise() {
    this.counter = 0;
    this.ticking = true;
    let guard = 0;
    while (!this.isPlaytime() && guard++ < this.lessons.length) {
      this.index = (this.index + 1) % this.lessons.length;
      this.lessonId = this.lessons[this.index];
    }
    this.index -= 1;
  }

  // The id of the teacher supervising Eric this period ('' if none).
  teacherId() { return this.details?.teacher || ''; }
  // The room Eric must turn up in (or a period name like PLAYTIME).
  roomId() { return this.details?.room || ''; }
  hideTeacher() { return HIDE_TEACHER.has(this.lessonId); }

  // One tick of the clock. Returns true when the bell should ring.
  tick() {
    if (this.ticking) this.counter -= 1;
    return this.counter < 0;
  }

  isTime(ticks) { return this.counter + ticks < this.lessonLength; }
  isTimeRemaining(ticks) { return this.counter <= ticks; }
  isTimeToGetAlong() { return this.isTime(this.config.getAlongTime); }
  isTimeToStartLesson() { return this.isTime(this.config.lessonStartTime); }

  upAYear() { this.counter = Math.floor(this.lessonLength / 2); }
  stop() { this.ticking = false; }
  resume(ticks) { this.counter = ticks; this.ticking = true; }
  rewind(ticks) { this.counter += ticks; }

  // 0..1 progress through the period (for the HUD clock bar).
  progress() { return 1 - Math.max(0, this.counter) / this.lessonLength; }
}
