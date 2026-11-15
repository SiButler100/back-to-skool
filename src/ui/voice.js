// ============================================================================
// VOICES (the masters, Einstein and Albert speak their lines aloud)
// ----------------------------------------------------------------------------
// Every sentence a master can say was recorded once, in the voice cast for
// him (tools/voice/ has the list, the recordings' record and the cutting
// tool). The clips live in assets/voice/ with a manifest that says which file
// holds which words.
//
// This module listens to the game:
//   'speech'      someone has started a speech bubble
//   'messageBox'  a reprimand box has appeared (the box says who is speaking)
// looks the words up in the manifest and plays the clip. The bubbles and
// boxes stay exactly as they are; they are the subtitles.
//
// A speaker further from Eric is quieter, a speaker out of the picture is
// silent, and the tune is turned down while anyone is talking. If there is no
// clip for a sentence, nothing happens: the game never waits for a voice.
// ============================================================================

// How a sentence is looked up: the game's line breaks ('^') and runs of spaces
// become single spaces, and everything is in capitals.
//   "DON'T HIT^YOUR MATES" -> "DON'T HIT YOUR MATES"
export const voiceKey = (words) => String(words).replace(/\^/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();

const REPRIMAND_DELAY = 0.3;      // seconds: lets the buzz of the lines box finish first
const FAR = 26;                   // cells: a speaker this far from Eric is at his quietest
const QUIETEST = 0.35;            // how loud that is, against 1 for someone beside him
const AT_ONCE = 3;                // no more than this many voices talking over each other

export class Voice {
  constructor({ game, sound, folder = 'assets/voice/' }) {
    this.game = game;
    this.sound = sound;           // voices share the game's volume control and limiter
    this.folder = folder;
    this.enabled = true;          // the "Voices" switch in Options
    this.manifest = null;         // { SPEAKER: { 'THE WORDS': 'file-name' } }, fetched the first time it is needed
    this.manifestAsked = null;
    this.clips = new Map();       // file name -> a promise of its decoded sound (or null if it could not be had)
    this.playing = [];            // { character, source, gain }
    this.started = 0;             // how many clips have been started (the tests read this)
    this.last = null;             // { speaker, file } of the most recent one

    game.events.on('speech', ({ character, words }) => this.say(character, words));
    game.events.on('messageBox', (box) => { if (box.speaker) this.say(box.speaker, box.words, REPRIMAND_DELAY); });
    // Someone knocked flat stops talking mid-sentence.
    game.events.on('tick', () => { for (const p of this.playing.slice()) if (p.character.isKnockedOver()) this.stop(p); });
    game.events.on('start', () => this.hush());
  }

  // The list of clips. Asked for once; if it cannot be had, there are no voices.
  loadManifest() {
    if (!this.manifestAsked) {
      this.manifestAsked = fetch(`${this.folder}manifest.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => { this.manifest = m || {}; })
        .catch(() => { this.manifest = {}; });
    }
    return this.manifestAsked;
  }

  // One clip, fetched and decoded the first time it is wanted and kept after that.
  loadClip(file) {
    if (!this.clips.has(file)) {
      const ctx = this.sound.ctx;
      this.clips.set(file, fetch(`${this.folder}${file}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`no clip ${file}`))))
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => null));
    }
    return this.clips.get(file);
  }

  async say(character, words, delay = 0) {
    const ctx = this.sound.ctx;
    if (!this.enabled || !this.sound.active || !ctx || !this.game.isOnScreen(character)) return;
    const asked = ctx.currentTime;
    if (!this.manifest) await this.loadManifest();
    const file = (this.manifest[character.id] || {})[voiceKey(words)];
    if (!file) return;
    const clip = await this.loadClip(file);
    // The first use of a clip has to wait for it to arrive. If that took too
    // long the moment has passed, and a late voice is worse than none.
    if (!clip || !this.enabled || !this.sound.active || ctx.currentTime - asked > 1.5) return;

    // One mouth, one sentence: a new line from the same speaker replaces the old.
    for (const p of this.playing.slice()) if (p.character === character) this.stop(p);
    while (this.playing.length >= AT_ONCE) this.stop(this.playing[0]);

    const eric = this.game.cast.eric;
    const distance = Math.min(1, Math.abs(character.x - eric.x) / FAR);
    const gain = ctx.createGain();
    gain.gain.value = 1 - (1 - QUIETEST) * distance;
    const source = ctx.createBufferSource();
    source.buffer = clip;
    source.connect(gain).connect(this.sound.master);
    const entry = { character, source, gain };
    source.onended = () => this.forget(entry);
    source.start(ctx.currentTime + Math.max(0, delay - (ctx.currentTime - asked)));
    this.playing.push(entry);
    this.sound.speaking = true;                  // Sound turns the tune down while this is set
    this.started += 1;
    this.last = { speaker: character.id, file };
  }

  // Stop one voice, fading over a twentieth of a second so there is no click.
  stop(entry) {
    const ctx = this.sound.ctx;
    try {
      entry.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      entry.source.stop(ctx.currentTime + 0.06);
    } catch (err) { /* already stopped */ }
    this.forget(entry);
  }
  forget(entry) {
    const i = this.playing.indexOf(entry);
    if (i >= 0) this.playing.splice(i, 1);
    this.sound.speaking = this.playing.length > 0;
  }

  // Everyone stops: the game was paused, restarted, or the switch was turned off.
  hush() { for (const p of this.playing.slice()) this.stop(p); }
  setEnabled(on) { this.enabled = on; if (!on) this.hush(); }
}
