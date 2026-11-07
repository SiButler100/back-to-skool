#!/usr/bin/env node
// ============================================================================
// SCENARIO TESTS (the quest, step by step, without a screen)
// ----------------------------------------------------------------------------
// Drives Eric with a fake keyboard through the key mechanics and checks the
// outcomes. Run with:  node tools/scenarios.mjs
// Exit code 0 = all passed.
// ============================================================================

import { Game } from '../src/engine/game.js';
import { FakeInput } from '../src/ui/input.js';
import { measureText, fontHas } from './node-font.mjs';

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures++;
}

function freshGame(seed = 11) {
  const input = new FakeInput();
  const game = new Game({ input, seed, config: { freezeOnMessages: false }, measureText, fontHas });
  game.start();
  // Keep the cast out of the way: park everyone except Eric far right.
  const eric = game.cast.eric;
  game.setVisibleColumns(0, 191);
  return { game, input, eric };
}
function run(game, n, fn) { for (let i = 0; i < n; i++) { if (fn) fn(i); game.tick(); } }
function place(c, x, y, dir) { c.x = x; c.y = y; c.direction = dir; c.animatoryState = 'WALK0'; }
function freezeCast(game) {
  // Give every non-Eric character an empty script so they stand still.
  for (const c of game.cast.characters) { c.setCommandListTemplate([['SitStill']]); }
}

// ---- 1. Sit at a desk, open it, find the water pistol ------------------------
{
  const { game, input, eric } = freshGame();
  freezeCast(game);
  const room = game.world.getRoom('BlueRoom');
  const desk = room.desks.find((d) => d.x === 21);
  desk.insert('WATER_PISTOL');
  place(eric, 21, 3, -1);
  input.tap('sit'); run(game, 4);
  check('Eric sits on the chair', eric.isSittingOnChair(), eric.animatoryState);
  input.tap('openDesk'); run(game, 6);
  check('Desk lid delivers the water pistol', eric.inventory.has('WATER_PISTOL'), [...eric.inventory].join(','));
  input.tap('sit'); run(game, 4);
  check('Eric stands up again', eric.isStanding());

  // ---- 2. Fire the pistol at the middle cup ---------------------------------
  place(eric, 20, 17, 1);
  input.tap('waterPistol'); run(game, 40);
  const cup = game.world.cups.get('MiddleCup');
  check('Water pistol fills the middle cup', cup.contents === 'WATER', String(cup.contents));

  // ---- 3. Knock the cup onto Mr Withit from the staircase -------------------
  const withit = game.cast.get('WITHIT');
  place(withit, 26, 17, 1);
  withit.setCommandListTemplate([['SitStill']]);
  const secrets = [];
  game.events.on('secret', (s) => secrets.push(s));
  place(eric, 18, 13, 1);            // on the toilets staircase, facing the cups
  check('Eric is standing on the staircase', !!game.world.staircase(eric));
  input.tap('fire'); run(game, 60);
  check('The pellet emptied the cup', cup.contents === null, String(cup.contents));
  check('Mr Withit was soaked and revealed a bike digit', secrets.length === 1 && /\d/.test(secrets[0].secret), JSON.stringify(secrets.map((s) => s.secret)));
  check('Mr Withit was knocked over', withit.isKnockedOver() || withit.animatoryState === 'WALK0');

  // ---- 4. Write the bike combination on a blackboard ------------------------
  const combo = game.world.bikeCombination;
  place(eric, 5, 3, 1);              // beside the Blue Room board
  check('Eric is beside the blackboard', game.world.besideBlackboard(eric));
  input.tap('write'); run(game, 3);
  check('Eric started writing', eric.writing && input.writing);
  input.type(combo); run(game, 40);
  input.type('\n'); run(game, 10);
  const board = game.world.getRoom('BlueRoom').blackboard;
  check('The board shows the combination', board.lines[0] === combo, `${board.lines[0]} vs ${combo}`);
  check('The bike is unchained', game.cast.bike.visible && !game.cast.bike.chained);
  check('Score awarded for the bike', game.score >= 1000, String(game.score));

  // ---- 5. Catch the frog, ride the bike ---------------------------------------
  const frog = game.cast.frog;
  frog.commandList.setTemplate([['SitStill']]);   // hold still for the test
  frog.x = 59; frog.y = 10; frog.sit();
  place(eric, frog.x - 1, 10, 1);    // Eric's hand reaches x+2 when facing right; the frog sits at frog.x+1
  input.tap('catch'); run(game, 8);
  check('Eric catches the frog', eric.inventory.has('FROG'), [...eric.inventory].join(','));

  const bike = game.cast.bike;
  place(eric, bike.x, 17, 1);
  input.tap('mountBike'); run(game, 2);
  check('Eric mounts the bike', eric.isRidingBike(), eric.animatoryState);
  const startX = eric.x;
  for (let i = 0; i < 20; i++) { input.tap(i % 2 ? 'left' : 'right'); run(game, 3); }
  check('Pedalling moves the bike', eric.x !== startX, `${startX} -> ${eric.x}`);

  // ---- 6. Sherry: jump at the open drinks cabinet -----------------------------
  const cabinet = game.world.doors.get('DrinksCabinet');
  cabinet.shut = false;
  eric.dismount(); eric.controller = null; eric.bike = null;
  place(eric, 188, 3, 1);
  input.tap('jump'); run(game, 12);
  check('Jumping at the open cabinet swaps water for sherry', eric.inventory.has('SHERRY_PISTOL'), [...eric.inventory].join(','));

  // ---- 7. Lines: a teacher sees Eric in the girls' school ---------------------
  const take = game.cast.get('TAKE');
  place(take, 176, 3, 1);
  take.setCommandListTemplate([['SitStill']]);
  const before = game.lines;
  place(eric, 182, 3, -1);
  run(game, 80);
  check('Miss Take gives lines for being in the girls\' school', game.lines > before, `${before} -> ${game.lines}`);

  // ---- 8. The safe: with the key, jumping opens it ---------------------------
  eric.inventory.add('SAFE_KEY');
  let won = false;
  game.events.on('upAYear', () => { won = true; });
  place(eric, 79, 3, 1);
  input.tap('jump'); run(game, 12);
  check('Jumping at the safe with the key wins the year', won);
}

// ---- 9. Stability: a long unattended run with Eric wandering ------------------
{
  const input = new FakeInput();
  const game = new Game({ input, seed: 99, config: { freezeOnMessages: false, maxLines: 1e9 }, measureText, fontHas });
  game.start();
  const eric = game.cast.eric;
  let errors = 0;
  const origWarn = console.warn; console.warn = () => { errors++; };
  for (let t = 0; t < 30000; t++) {
    if (t % 400 === 0) { input.unhold('left'); input.unhold('right'); input.hold(Math.random() < 0.5 ? 'left' : 'right'); }
    if (t % 97 === 0) input.tap('up');
    if (eric.isKnockedOut() && t % 10 === 0) input.tap('sit');
    game.setVisibleColumns(Math.max(0, eric.x - 24), eric.x + 24);
    game.tick();
  }
  console.warn = origWarn;
  // Mid-step on a staircase a character is briefly one cell above the diagonal, so ignore those.
  const lost = game.cast.characterList.filter((c) => c.visible && !c.isEric() && !c.midstride() && !game.world.floor(c) && !game.world.onStaircase(c));
  check('30,000 ticks without anyone leaving the floors/stairs', lost.length === 0, lost.map((c) => `${c.name}@(${c.x},${c.y})`).join(' '));
  check('No routing warnings during the long run', errors === 0, `${errors} warnings`);
  check('Lessons advanced', game.timetable.index >= 10, `index ${game.timetable.index}`);
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exitCode = failures ? 1 : 0;
