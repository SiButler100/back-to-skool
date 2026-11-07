#!/usr/bin/env node
// ============================================================================
// HEADLESS TEST RUN
// ----------------------------------------------------------------------------
// Runs the game engine without any graphics for a number of ticks and prints
// what happened. Handy for catching crashes and watching the AI work.
//
//   node tools/headless.mjs [ticks] [seed]
// ============================================================================

import { Game } from '../src/engine/game.js';
import { FakeInput } from '../src/ui/input.js';

const ticks = Number(process.argv[2] || 3000);
const seed = Number(process.argv[3] || 42);

const input = new FakeInput();
const game = new Game({ input, seed, config: { freezeOnMessages: false } });
const log = [];
game.events.on('lesson', (l) => log.push(`[${game.tickCount}] LESSON ${l.lessonId}: ${l.teacher} / ${l.room}`));
game.events.on('lines', (l) => log.push(`[${game.tickCount}] LINES ${l.amount} to ${l.recipient.name} from ${l.giver.name} (${l.messageId}) at (${l.recipient.x},${l.recipient.y})`));
game.events.on('decked', (d) => log.push(`[${game.tickCount}] DECKED ${d.character.name} at (${d.character.x},${d.character.y})`));
game.events.on('secret', (s) => log.push(`[${game.tickCount}] SECRET ${s.character.name} says ${s.secret}`));
game.events.on('messageBox', (m) => log.push(`[${game.tickCount}] BOX ${m.lines.join(' / ')}`));

game.start();

// Simple scripted Eric: walk left into the school, get up whenever he's
// knocked down, and loiter where he shouldn't.
let lastSpeech = new Map();
const eric = game.cast.eric;
for (let t = 0; t < ticks; t++) {
  if (t === 20) input.hold('left');
  if (t === 1500) input.unhold('left');
  if (t === 1600) input.hold('right');
  if (t === 2200) input.unhold('right');
  if (eric.isKnockedOut() && t % 10 === 0) input.tap('sit');
  // The camera follows Eric: pretend 48 columns around him are visible.
  game.setVisibleColumns(Math.max(0, eric.x - 24), Math.min(191, eric.x + 24));
  game.tick();
  // Record speech bubbles (once per utterance)
  for (const c of game.cast.characters) {
    if (c.bubble && lastSpeech.get(c.id) !== c.bubble.words) { lastSpeech.set(c.id, c.bubble.words); log.push(`[${t}] ${c.name}: "${c.bubble.words}"`); }
    if (!c.bubble) lastSpeech.delete(c.id);
  }
}

console.log(log.slice(0, 200).join('\n'));
console.log('...');
console.log('Final:', JSON.stringify(game.describe()));
// Where is everyone?
const summary = game.cast.characterList.map((c) => `${c.name.padEnd(11)} (${String(c.x).padStart(3)},${String(c.y).padStart(2)}) ${c.animatoryState}`);
console.log(summary.join('\n'));
// Sanity: nobody off a floor or staircase
const lost = game.cast.characterList.filter((c) => c.visible && !game.world.floor(c) && !game.world.onStaircase(c) && !c.isEric());
if (lost.length) { console.log('LOST CHARACTERS:', lost.map((c) => `${c.name}@(${c.x},${c.y})`).join(', ')); process.exitCode = 1; }
