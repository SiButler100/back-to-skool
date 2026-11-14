// ============================================================================
// SOUND (everything synthesised in the browser: no audio files)
// ----------------------------------------------------------------------------
// The 1985 game had a one-channel beeper. This keeps the no-files spirit but
// uses the Web Audio API properly: each sound is a small recipe built from
// two ingredients, a pitched TONE (which can slide) and a burst of filtered
// NOISE (for splashes, thuds and footsteps). On top of the effects there are
// footsteps under Eric, birdsong while he is outdoors, and a quiet tune.
//
// Add a sound by adding a recipe to RECIPES and calling
// game.playSound('MY_SOUND') in the engine.
// ============================================================================

const N = (name) => 440 * 2 ** ((NOTES[name] - 57) / 12);     // 'A4' -> 440 Hz
const NOTES = {};
['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((n, i) => { for (let o = 1; o <= 7; o++) NOTES[`${n}${o}`] = o * 12 + i; });

// Each recipe is a function (s, t) that schedules sounds on synth `s` from time `t`.
const jingle = (names, step = 0.09, last = 0.28) => (s, t) => names.forEach((n, i) => s.tone(t + i * step, N(n), i === names.length - 1 ? last : step * 1.6, { vol: 0.5 }));
const RECIPES = {
  // An electric school bell: a hammer rattling on a gong for a second and a half.
  BELL: (s, t) => { for (let i = 0; i < 34; i++) { const at = t + i * 0.044; s.tone(at, 1975, 0.1, { type: 'sine', vol: 0.34 }); s.tone(at, 2962, 0.07, { type: 'sine', vol: 0.16 }); s.tone(at, 1318, 0.12, { type: 'triangle', vol: 0.10 }); } },
  LINES1: (s, t) => { s.tone(t, 247, 0.16, { type: 'sawtooth', vol: 0.3, slide: 185, lowpass: 1200 }); s.tone(t + 0.17, 196, 0.3, { type: 'sawtooth', vol: 0.3, slide: 131, lowpass: 1000 }); },
  LINES2: (s, t) => { s.tone(t, 330, 0.12, { type: 'sawtooth', vol: 0.26, slide: 262, lowpass: 1400 }); s.tone(t + 0.13, 262, 0.22, { type: 'sawtooth', vol: 0.26, slide: 196, lowpass: 1200 }); },
  ALARM: (s, t) => { for (let i = 0; i < 4; i++) s.tone(t + i * 0.11, i % 2 ? 660 : 880, 0.1, { type: 'sawtooth', vol: 0.3, lowpass: 2400 }); },
  CATAPULT: (s, t) => { s.tone(t, 760, 0.14, { vol: 0.4, slide: 190 }); s.noise(t, 0.03, { vol: 0.25, band: 3000 }); },
  WATER_PISTOL: (s, t) => { s.noise(t, 0.16, { vol: 0.32, band: 2200, bandTo: 4200, q: 3 }); },
  KNOCKED_OUT: (s, t) => { s.tone(t, 150, 0.24, { type: 'sine', vol: 0.7, slide: 48 }); s.noise(t, 0.09, { vol: 0.4, lowpass: 500 }); },
  HIT: (s, t) => { s.noise(t, 0.06, { vol: 0.5, band: 900, q: 1 }); s.tone(t, 210, 0.1, { type: 'sine', vol: 0.5, slide: 90 }); },
  JUMP: (s, t) => { s.tone(t, 330, 0.13, { vol: 0.32, slide: 640 }); },
  SIT: (s, t) => { s.tone(t, 180, 0.07, { type: 'sine', vol: 0.4, slide: 120 }); },
  DESK: jingle(['E5', 'A5', 'C#6'], 0.08, 0.2),
  FROG: (s, t) => { for (let i = 0; i < 2; i++) s.tone(t + i * 0.13, 210, 0.09, { type: 'square', vol: 0.22, slide: 140, lowpass: 900 }); },
  MOUSE: (s, t) => { for (let i = 0; i < 3; i++) s.tone(t + i * 0.07, 2600, 0.05, { type: 'sine', vol: 0.2, slide: 3400 }); },
  BIKE: jingle(['E5', 'G5', 'B5', 'E6']),
  STOREROOM_KEY: jingle(['D5', 'F#5', 'A5', 'D6']),
  SAFE_KEY: jingle(['C5', 'E5', 'G5', 'C6'], 0.11, 0.4),
  SHERRY: jingle(['G4', 'B4', 'D5'], 0.11, 0.3),
  CONKER: (s, t) => { s.tone(t, 520, 0.05, { type: 'sine', vol: 0.5, slide: 300 }); s.noise(t, 0.04, { vol: 0.3, lowpass: 900 }); },
  KISS: (s, t) => { s.tone(t, 880, 0.09, { type: 'sine', vol: 0.3, slide: 1320 }); s.tone(t + 0.12, 1175, 0.2, { type: 'sine', vol: 0.3 }); },
  UP_A_YEAR: jingle(['C5', 'E5', 'G5', 'C6', 'G5', 'C6'], 0.15, 0.6),
};

// The tune: an original sixteen-bar playground melody in C, four notes to the bar
// ('-' holds the note before). The bass plays the root of each bar.
const MELODY = ('E5 G5 E5 C5|D5 F5 D5 B4|C5 E5 G5 E5|D5 - G4 -|E5 G5 E5 C5|D5 F5 D5 B4|C5 D5 E5 D5|C5 - - -|'
  + 'A5 A5 G5 E5|F5 F5 E5 C5|D5 E5 F5 A5|G5 - - -|E5 G5 E5 C5|D5 F5 D5 B4|C5 E5 D5 B4|C5 - C6 -').split('|').map((bar) => bar.split(' '));
const BASS = 'C3 G2 C3 G2 C3 G2 C3 C3 F2 C3 G2 G2 C3 G2 G2 C3'.split(' ');
const BEAT = 60 / 126;      // seconds per note of the melody

export class Sound {
  constructor() {
    this.enabled = true;          // effects, footsteps and birdsong
    this.musicEnabled = true;
    this.active = false;          // false while the game is paused or on the title screen
    this.outdoors = false;
    this.ctx = null;
    this.musicAt = 0; this.musicIndex = 0;
    this.nextBird = 0;
  }

  // Browsers only allow audio after a user gesture, so the context is made lazily.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      // Everything passes through one volume control and a gentle limiter.
      const limiter = this.ctx.createDynamicsCompressor();
      limiter.threshold.value = -14; limiter.ratio.value = 6;
      this.master = this.ctx.createGain(); this.master.gain.value = 0.5;
      this.master.connect(limiter).connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
      // A second of white noise, reused for every splash, thud and footstep.
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      setInterval(() => this.pump(), 120);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  // ---- The two ingredients ------------------------------------------------------
  // A pitched note with a soft start, fading out; `slide` glides to another pitch.
  tone(t, freq, dur, { type = 'triangle', vol = 0.4, slide = 0, lowpass = 0, out = null } = {}) {
    const ctx = this.ctx, osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc.connect(gain);
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; node = node.connect(f); }
    node.connect(out || this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  // A burst of noise through a filter: `band` for hissy, `lowpass` for thuddy.
  noise(t, dur, { vol = 0.3, band = 0, bandTo = 0, lowpass = 0, q = 1.5 } = {}) {
    const ctx = this.ctx, src = ctx.createBufferSource(), gain = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = this.noiseBuffer; src.loop = true;
    f.type = band ? 'bandpass' : 'lowpass'; f.frequency.setValueAtTime(band || lowpass || 800, t); f.Q.value = q;
    if (bandTo) f.frequency.exponentialRampToValueAtTime(bandTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  // ---- Effects --------------------------------------------------------------------
  play(id) {
    if (!this.enabled || !this.active) return;
    const recipe = RECIPES[id];
    if (!recipe || !this.ensure()) return;
    recipe(this, this.ctx.currentTime + 0.005);
  }

  // One of Eric's footsteps: a soft tap, crisper on the playground tarmac.
  step() {
    if (!this.enabled || !this.active || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.stepFlip = !this.stepFlip;
    if (this.outdoors) this.noise(t, 0.045, { vol: 0.09, band: this.stepFlip ? 1500 : 1250, q: 1.2 });
    else this.noise(t, 0.05, { vol: 0.11, lowpass: this.stepFlip ? 520 : 440 });
  }

  // ---- Things that run on their own: the tune and the birds --------------------------
  setActive(on) { this.active = on; }
  setOutdoors(on) { this.outdoors = on; }

  // Called a few times a second: schedules the next notes a little ahead of time.
  pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const wantMusic = this.active && this.musicEnabled ? 0.16 : 0;
    this.musicBus.gain.setTargetAtTime(wantMusic, now, 0.4);
    if (wantMusic) {
      if (this.musicAt < now) this.musicAt = now + 0.05;
      while (this.musicAt < now + 0.4) {
        const bar = Math.floor(this.musicIndex / 4) % MELODY.length, beat = this.musicIndex % 4;
        const note = MELODY[bar][beat];
        if (note !== '-') {
          let hold = 1;                                              // a '-' after a note lengthens it
          for (let k = beat + 1; k < 4 && MELODY[bar][k] === '-'; k++) hold++;
          this.tone(this.musicAt, N(note), BEAT * hold * 0.95, { type: 'triangle', vol: 0.5, out: this.musicBus });
          this.tone(this.musicAt, N(note) * 2, BEAT * 0.3, { type: 'sine', vol: 0.12, out: this.musicBus });   // a little sparkle on top
        }
        if (beat % 2 === 0) this.tone(this.musicAt, N(BASS[bar]) * (beat ? 1.5 : 1), BEAT * 1.7, { type: 'sine', vol: 0.55, out: this.musicBus });
        this.musicAt += BEAT; this.musicIndex++;
      }
    }
    // Birdsong outdoors: a few quick chirps every now and then.
    if (this.active && this.enabled && this.outdoors && now >= this.nextBird) {
      const base = 2300 + Math.random() * 1700, chirps = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < chirps; i++) this.tone(now + 0.05 + i * 0.09, base * (1 + Math.random() * 0.2), 0.06, { type: 'sine', vol: 0.05, slide: base * (1.2 + Math.random() * 0.5) });
      this.nextBird = now + 0.9 + Math.random() * 3.2;
    }
  }
}
