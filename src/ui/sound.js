// ============================================================================
// SOUND (synthesised beeps, no audio files)
// ----------------------------------------------------------------------------
// The original had a one-channel beeper. We recreate that spirit with the Web
// Audio API: each sound id maps to a short recipe of notes. Add new sounds by
// adding a recipe to RECIPES and emitting game.playSound('MY_SOUND').
// ============================================================================

// A note is [frequencyHz, durationSeconds, type?]. Notes play back to back.
const RECIPES = {
  BELL: [[1760, 0.12, 'square'], [1480, 0.12, 'square'], [1760, 0.12, 'square'], [1480, 0.25, 'square']],
  LINES1: [[220, 0.08], [196, 0.08], [174, 0.08], [164, 0.12]],
  LINES2: [[330, 0.06], [294, 0.06], [262, 0.06], [247, 0.1]],
  ALARM: [[880, 0.1, 'sawtooth'], [660, 0.1, 'sawtooth'], [880, 0.1, 'sawtooth'], [660, 0.1, 'sawtooth']],
  CATAPULT: [[1200, 0.03, 'sawtooth'], [600, 0.04, 'sawtooth']],
  WATER_PISTOL: [[900, 0.04, 'triangle'], [1400, 0.05, 'triangle']],
  KNOCKED_OUT: [[120, 0.12, 'square'], [80, 0.15, 'square']],
  HIT: [[300, 0.03, 'square'], [150, 0.05, 'square']],
  JUMP: [[440, 0.05, 'triangle'], [660, 0.05, 'triangle']],
  SIT: [[330, 0.04, 'triangle']],
  DESK: [[660, 0.08], [880, 0.08], [1100, 0.12]],
  FROG: [[520, 0.08], [700, 0.08], [520, 0.08]],
  MOUSE: [[1400, 0.05], [1800, 0.05], [1400, 0.05]],
  BIKE: [[660, 0.08], [880, 0.08], [1100, 0.08], [1320, 0.16]],
  STOREROOM_KEY: [[660, 0.08], [880, 0.08], [1100, 0.08], [1320, 0.16]],
  SAFE_KEY: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.3]],
  SHERRY: [[392, 0.1], [494, 0.1], [587, 0.2]],
  CONKER: [[200, 0.1, 'square'], [100, 0.2, 'square']],
  KISS: [[880, 0.08], [1175, 0.16]],
  UP_A_YEAR: [[523, 0.15], [659, 0.15], [784, 0.15], [1047, 0.3], [784, 0.15], [1047, 0.5]],
};

export class Sound {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.volume = 0.15;
  }

  // Browsers only allow audio after a user gesture, so we create the context lazily.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  play(id) {
    if (!this.enabled) return;
    const recipe = RECIPES[id];
    if (!recipe) return;
    const ctx = this.ensure();
    if (!ctx) return;
    let t = ctx.currentTime;
    for (const [freq, dur, type = 'square'] of recipe) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(this.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t); osc.stop(t + dur);
      t += dur;
    }
  }
}
