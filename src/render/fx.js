// ============================================================================
// EFFECTS (the little flourishes that make hits, splashes and tellings-off land)
// ----------------------------------------------------------------------------
// The engine announces what happens on its event bus ("splash", "decked",
// "lines", "stinkbomb"...). This layer listens and answers each one with
// something to see: droplets, stars, a puff of green gas, a number floating
// up, a shake of the screen. None of it changes the game; switch the modern
// view off and the engine carries on exactly the same.
//
// Particles live in game pixels (the engine's own units, fractions allowed)
// and are drawn by the renderer inside the world, so they scroll with it.
// ============================================================================

import { UI_FONT } from './art/text.js';

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export class Effects {
  constructor(game, whereIs) {
    this.game = game;
    this.whereIs = whereIs;        // (thing) -> [x, y] in game pixels: where it is drawn right now
    this.parts = [];               // live particles
    this.shake = 0;                // game pixels of screen shake still to play out
    this.flash = null;             // { colour, t, life }: a tint over the whole view
    this.lastScore = 0;
    this.enabled = true;
    const on = (name, fn) => game.events.on(name, (p) => { if (this.enabled) fn(p || {}); });
    on('start', () => { this.parts.length = 0; this.shake = 0; this.flash = null; this.lastScore = 0; });
    on('splash', ({ victim, liquid }) => victim && this.splash(this.head(victim), liquid === 'SHERRY' ? '#d98a2b' : '#7fc4ff', 16));
    on('cup', ({ cup, contents }) => { if (cup && contents) this.splash([cup.x * 8 + 4, cup.y * 8 + 6], contents === 'SHERRY' ? '#d98a2b' : '#7fc4ff', 8); });
    on('cupEmpty', ({ cup }) => { if (cup) { this.ring([cup.x * 8 + 4, cup.y * 8 + 4]); this.text([cup.x * 8 + 4, cup.y * 8 + 4], 'EMPTY', '#59606e', 6); } });
    on('decked', ({ character }) => { if (character) { this.stars(this.head(character), 7); this.ring(this.head(character)); this.shake = Math.max(this.shake, character === game.cast.eric ? 2.2 : 1.2); } });
    on('conked', ({ victim }) => { if (victim) { this.stars(this.head(victim), 9); this.ring(this.head(victim)); this.shake = Math.max(this.shake, 1.6); } });
    on('stinkbomb', ({ x, y }) => this.stink([x * 8 + 12, y * 8 + 26]));
    on('kiss', () => this.hearts(this.head(game.cast.eric)));
    on('found', () => this.sparkle(this.chest(game.cast.eric)));
    on('upAYear', () => this.confetti());
    on('lines', ({ recipient, amount }) => {
      if (!recipient) return;
      const eric = recipient === game.cast.eric;
      this.text(this.head(recipient), `${amount} LINES`, eric ? '#e5383b' : '#59606e', eric ? 9 : 7);
      if (eric) { this.shake = Math.max(this.shake, 1.8); this.flash = { colour: '229,56,59', t: 0, life: 380 }; }
    });
    on('score', ({ score }) => {
      const gain = score - this.lastScore; this.lastScore = score;
      if (gain > 0 && gain < 5000) this.text(this.head(game.cast.eric), `+${gain}`, '#c98a12', 8);
    });
  }

  // Drop everything in the air (the view has changed, or effects were switched).
  reset() { this.parts.length = 0; this.shake = 0; this.flash = null; this.lastScore = this.game.score || 0; }

  // Where to aim an effect on a character, in game pixels.
  head(c) { const [x, y] = this.whereIs(c); return [x + 12, y + (c.isAdult?.() ? 3 : 10)]; }
  chest(c) { const [x, y] = this.whereIs(c); return [x + 12, y + 18]; }

  add(p) { if (this.parts.length < 400) this.parts.push({ age: 0, vx: 0, vy: 0, g: 0, drag: 0, spin: 0, rot: 0, ...p }); }

  splash([x, y], colour, n) {
    for (let i = 0; i < n; i++) { const a = rand(-Math.PI, 0); const v = rand(18, 52); this.add({ kind: 'drop', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, g: 150, life: rand(420, 700), size: rand(0.7, 1.5), colour }); }
  }
  stars([x, y], n) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU); const v = rand(14, 34); this.add({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 14, g: 40, drag: 1.6, life: rand(500, 900), size: rand(1.6, 2.6), colour: '#ffd34d', spin: rand(-6, 6) }); }
  }
  ring([x, y]) { this.add({ kind: 'ring', x, y, life: 260, size: 9, colour: '255,255,255' }); }
  stink([x, y]) {
    for (let i = 0; i < 14; i++) this.add({ kind: 'puff', x: x + rand(-6, 6), y: y + rand(-2, 3), vx: rand(-7, 7), vy: rand(-16, -5), drag: 0.5, life: rand(1400, 2600), size: rand(4, 8), colour: '168,196,78', delay: i * 60 });
  }
  hearts([x, y]) { for (let i = 0; i < 6; i++) this.add({ kind: 'heart', x: x + rand(-5, 5), y, vx: rand(-6, 6), vy: rand(-22, -12), life: rand(900, 1400), size: rand(2, 3.2), colour: '#ff6f91', delay: i * 90 }); }
  sparkle([x, y]) { for (let i = 0; i < 12; i++) { const a = rand(0, TAU); const v = rand(10, 30); this.add({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.2, life: rand(500, 900), size: rand(1.2, 2.2), colour: '#fff1a8', spin: rand(-8, 8) }); } }
  confetti() {
    const [x, y] = this.head(this.game.cast.eric);
    const colours = ['#e5383b', '#ffd34d', '#4aa3ff', '#62c370', '#ff6f91', '#ffffff'];
    for (let i = 0; i < 90; i++) this.add({ kind: 'bit', x: x + rand(-90, 90), y: y - rand(30, 60), vx: rand(-20, 20), vy: rand(0, 30), g: 46, drag: 0.8, life: rand(1800, 3200), size: rand(1.2, 2.2), colour: colours[i % colours.length], spin: rand(-10, 10), delay: rand(0, 600) });
  }
  text([x, y], words, colour, size) { this.add({ kind: 'text', x, y: y - 6, vy: -13, drag: 1.2, life: 1500, size, colour, words }); }

  update(dt) {
    const s = dt / 1000;
    this.shake = Math.max(0, this.shake - dt * 0.008);
    if (this.flash) { this.flash.t += dt; if (this.flash.t >= this.flash.life) this.flash = null; }
    for (const p of this.parts) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      p.vy += p.g * s; p.vx -= p.vx * p.drag * s; p.vy -= p.vy * p.drag * s;
      p.x += p.vx * s; p.y += p.vy * s; p.rot += p.spin * s;
    }
    this.parts = this.parts.filter((p) => p.age < p.life);
    // A full cup drips now and then, so it can be told from an empty one at a glance.
    this.dripClock = (this.dripClock || 0) + dt;
    if (this.dripClock > 1300) {
      this.dripClock = 0;
      for (const cup of this.game.world.cups.values()) {
        if (cup.contents) this.add({ kind: 'drop', x: cup.x * 8 + 6.5, y: cup.y * 8 + 5, vy: 4, g: 120, life: 520, size: 0.9, colour: cup.contents === 'SHERRY' ? '#d98a2b' : '#7fc4ff' });
      }
    }
  }

  // A small random offset for the whole view while a shake plays out.
  shakeOffset() { return this.shake > 0.05 ? [rand(-1, 1) * this.shake, rand(-1, 1) * this.shake] : [0, 0]; }

  // Draw the particles. The context is already moved to world space; `S` is
  // canvas pixels per game pixel.
  draw(ctx, S) {
    ctx.save();
    for (const p of this.parts) {
      if (p.delay > 0) continue;
      const k = p.age / p.life, x = p.x * S, y = p.y * S, r = p.size * S;
      ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 2));
      if (p.kind === 'drop') {
        ctx.fillStyle = p.colour; ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r * 1.2, Math.atan2(p.vy, p.vx) + Math.PI / 2, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 0.3, r * 0.25, 0, TAU); ctx.fill();
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.colour; ctx.translate(x, y); ctx.rotate(p.rot);
        ctx.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r; const a = (i / 10) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill();
        ctx.rotate(-p.rot); ctx.translate(-x, -y);
      } else if (p.kind === 'ring') {
        ctx.globalAlpha = 1; ctx.strokeStyle = `rgba(${p.colour},${(1 - k) * 0.9})`; ctx.lineWidth = Math.max(1, (1 - k) * 1.2 * S);
        ctx.beginPath(); ctx.arc(x, y, r * (0.3 + k), 0, TAU); ctx.stroke();
      } else if (p.kind === 'puff') {
        const rr = r * (0.6 + k * 1.6);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
        g.addColorStop(0, `rgba(${p.colour},${0.5 * (1 - k)})`); g.addColorStop(1, `rgba(${p.colour},0)`);
        ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
      } else if (p.kind === 'heart') {
        ctx.fillStyle = p.colour; ctx.beginPath();
        ctx.moveTo(x, y + r * 0.9); ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.4); ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9); ctx.fill();
      } else if (p.kind === 'bit') {
        ctx.fillStyle = p.colour; ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillRect(-r, -r * 0.5, r * 2, r); ctx.rotate(-p.rot); ctx.translate(-x, -y);
      } else if (p.kind === 'text') {
        ctx.font = `400 ${Math.round(p.size * S * 0.62)}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, 0.7 * S); ctx.strokeStyle = 'rgba(255,253,246,0.95)'; ctx.lineJoin = 'round';
        ctx.strokeText(p.words, x, y); ctx.fillStyle = p.colour; ctx.fillText(p.words, x, y);
      }
    }
    ctx.restore();
  }

  // A tint over the whole view (screen space), e.g. red when Eric gets lines.
  drawFlash(ctx, w, h) {
    if (!this.flash) return;
    const k = this.flash.t / this.flash.life, a = 0.34 * (1 - k);
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, `rgba(${this.flash.colour},0)`); g.addColorStop(1, `rgba(${this.flash.colour},${a})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
}
