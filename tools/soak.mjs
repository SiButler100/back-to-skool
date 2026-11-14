#!/usr/bin/env node
// ============================================================================
// SOAK TEST (many school days at once, with a player who presses anything)
// ----------------------------------------------------------------------------
// Runs the engine without a screen for a long time under many random seeds.
// Eric is driven by a "monkey" that holds and taps keys at random, and is
// handed the pistol, stinkbombs, mice and the bike now and then so that the
// rarer parts of the game are reached. After every tick a list of things that
// must always be true is checked: nobody off the map or stuck in mid-air,
// nobody frozen for hours, numbers that are numbers, lessons that advance.
//
//   node tools/soak.mjs [seeds] [ticks per seed]     (default 50 and 40000)
//
// Exit code 0 means nothing was found.
// ============================================================================

import { Game } from '../src/engine/game.js';
import { FakeInput } from '../src/ui/input.js';
import { measureText, fontHas } from './node-font.mjs';

const SEEDS = Number(process.argv[2] || 50);
const TICKS = Number(process.argv[3] || 40000);

// A small repeatable random number generator for the monkey (the game has its own).
function rngFor(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

const problems = new Map();     // problem text -> { count, first }
function report(text, where) {
  const p = problems.get(text) || { count: 0, first: where };
  p.count++; problems.set(text, p);
}

// Errors thrown inside event listeners are caught by the event bus and sent to
// console.error; count those too.
const realError = console.error;
// A routing warning means somebody was told to walk somewhere they cannot reach.
const realWarn = console.warn;
let lastWarn = null;
console.warn = (...args) => { lastWarn = String(args[0]); };
console.error = (...args) => { report(`console.error: ${String(args[0]).slice(0, 120)} ${args[1] && args[1].message ? args[1].message : ''}`, 'during a run'); };

const FLOOR_ROWS = new Set([3, 10, 14, 17]);
const HOLDS = ['left', 'right', 'up', 'down'];
const TAPS = ['fire', 'act', 'jump', 'drop', 'down', 'up'];

let totalTicks = 0, restarts = 0, lessonsSeen = 0;
for (let seed = 1; seed <= SEEDS; seed++) {
  const rnd = rngFor(seed);
  const input = new FakeInput();
  const game = new Game({ input, seed, config: { freezeOnMessages: seed % 2 === 0 }, measureText, fontHas });
  game.start();
  const eric = game.cast.eric;
  const monkey = seed % 5 !== 0;          // one seed in five leaves Eric standing where he starts
  let holding = null, holdLeft = 0;
  const offFloor = new Map();             // id -> ticks spent off every floor and staircase
  const still = new Map();                // id -> { key, ticks }
  let lastLesson = game.timetable.index, lessonStall = 0;
  const where = () => `seed ${seed}, tick ${game.tickCount}`;

  for (let t = 0; t < TICKS; t++) {
    // ---- The monkey ---------------------------------------------------------
    if (monkey) {
      if (holdLeft > 0) { holdLeft--; if (holdLeft === 0 && holding) { input.unhold(holding); holding = null; } }
      else if (rnd() < 0.08) { holding = HOLDS[Math.floor(rnd() * HOLDS.length)]; input.hold(holding); input.tap(holding); holdLeft = 1 + Math.floor(rnd() * 60); }
      if (rnd() < 0.04) input.tap(TAPS[Math.floor(rnd() * TAPS.length)]);
      if (eric.writing && rnd() < 0.3) input.type(rnd() < 0.1 ? '\n' : 'abc123 XYZ'[Math.floor(rnd() * 10)]);
      if (rnd() < 0.0008) { eric.inventory.add('WATER_PISTOL'); eric.inventoryChanged(); }
      if (rnd() < 0.0005) { eric.inventory.add('STINKBOMBS3'); eric.inventoryChanged(); }
      if (rnd() < 0.0005) { eric.mice += 2; eric.inventoryChanged(); }
      if (rnd() < 0.0003 && game.cast.bike.chained) game.cast.unchainBike();
      if (rnd() < 0.0002) { eric.inventory.add('SAFE_KEY'); eric.inventory.add('STOREROOM_KEY'); eric.inventoryChanged(); }
    }
    game.setVisibleColumns(Math.max(0, eric.x - 16), Math.min(191, eric.x + 16));

    // ---- One tick -----------------------------------------------------------
    try { game.tick(); } catch (err) { report(`exception: ${err.message}`, `${where()}\n${String(err.stack).split('\n').slice(1, 4).join('\n')}`); game.start(); restarts++; continue; }
    totalTicks++;
    if (lastWarn) { report(`warning: ${lastWarn.replace(/\(\d+,\d+\)/g, '(x,y)').replace(/^[A-Z .-]+ at/, 'someone at')}`, `${where()}: ${lastWarn}`); lastWarn = null; }

    // ---- What must always be true ---------------------------------------------
    if (!Number.isFinite(game.score) || game.score < 0) report(`score is ${game.score}`, where());
    if (!Number.isFinite(game.lines) || game.lines < 0) report(`lines is ${game.lines}`, where());
    if (game.messageQueue.length > 60) report('more than 60 message boxes are waiting', where());

    for (const c of game.cast.characterList) {
      if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) { report(`${c.name} has a position that is not a whole number (${c.x},${c.y})`, where()); continue; }
      if (!c.visible) continue;
      if (c.x < 0 || c.x > 191 || c.y < 0 || c.y > 20) report(`${c.name} is off the map`, `${where()} at (${c.x},${c.y})`);
      if (typeof c.animatoryState !== 'string') report(`${c.name} has no pose`, where());
      // Eric may also stand on a plant pot, a grown plant, a knocked-out boy or
      // the bike's saddle, and is carried by scripted moves (a jump, a fall).
      // (Girls stand on chairs, or hop, for as long as a mouse is about: that is their script, not a fault.)
      const supported = game.world.onFloor(c) || game.world.onStaircase(c) || !!game.world.staircase(c)
        || c.commandList.stack.some((command) => command.constructor.name === 'EvadeMouse')
        || (c === eric && (eric.isSupported() || !!eric.controller || !!eric.bike));
      const n = supported ? 0 : (offFloor.get(c.id) || 0) + 1;
      offFloor.set(c.id, n);
      // Jumps, plants, chairs (mice!) and falls take people off the floor for a moment; ten seconds is not a moment.
      if (n === 200) report(`${c.name} has been off every floor and staircase for 200 ticks`, `${where()} at (${c.x},${c.y}) ${c.animatoryState}`);
      if (c !== eric) {
        const key = `${c.x},${c.y},${c.animatoryState},${c.direction}`;
        const s = still.get(c.id) || { key: '', ticks: 0 };
        if (s.key === key) s.ticks++; else { s.key = key; s.ticks = 0; }
        still.set(c.id, s);
        // A lesson is 2,400 ticks or so; nobody stands in one pose through three of them.
        if (s.ticks === 7500) report(`${c.name} has not moved a muscle for 7,500 ticks`, `${where()} at (${c.x},${c.y}) ${c.animatoryState}, script ${c.commandList.template ? c.commandList.template.map((x) => x[0]).slice(0, 6).join('>') : '?'}`);
      }
    }
    for (const m of game.cast.mice) {
      if (m.visible && !FLOOR_ROWS.has(m.y)) report('a mouse is running in mid-air', `${where()} at (${m.x},${m.y})`);
      if (m.visible && (m.x < -1 || m.x > 191)) report('a mouse has left the map', `${where()} at (${m.x},${m.y})`);
    }
    for (const p of game.cast.pellets) if (p.visible && (p.x < -1 || p.x > 192)) report('a pellet has left the map', `${where()} at (${p.x},${p.y})`);
    const frog = game.cast.frog;
    if (frog.visible && !frog.trapped && !frog.falling && (frog.x < 0 || frog.x > 191)) report('the frog has left the map', `${where()} at (${frog.x},${frog.y})`);

    // Lessons must keep coming (unless Eric is being expelled, when the clock is stopped on purpose).
    if (game.timetable.index !== lastLesson) { lastLesson = game.timetable.index; lessonStall = 0; lessonsSeen++; }
    else if (!eric.expelled && !game.gameOver && ++lessonStall === 12000) report('no bell for 12,000 ticks', where());

    // Expelled, or up a year: start again, as the player would, and carry on.
    if (game.gameOver) { game.start(); restarts++; lessonStall = 0; lastLesson = game.timetable.index; offFloor.clear(); still.clear(); if (holding) { input.unhold(holding); holding = null; holdLeft = 0; } }
  }
}

console.error = realError; console.warn = realWarn;
console.log(`${SEEDS} seeds, ${totalTicks.toLocaleString('en-GB')} ticks, ${lessonsSeen} lessons, ${restarts} games ended and restarted.`);
if (!problems.size) { console.log('Nothing found.'); process.exit(0); }
console.log(`\n${problems.size} kind(s) of problem:`);
for (const [text, p] of [...problems].sort((a, b) => b[1].count - a[1].count)) console.log(`\n  ${text}\n    seen ${p.count} time(s); first: ${p.first}`);
process.exit(1);
