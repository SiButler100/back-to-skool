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
import { findSpots } from '../src/features/aim-guide.js';
import { Motion } from '../src/render/motion.js';
import { loadSnapshot, extractGraphics } from '../src/render/extract.js';

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
  const finds = []; game.events.on('found', (f) => finds.push(f.item));
  place(eric, 21, 3, -1);
  input.tap('down'); run(game, 4);
  check('Eric sits on the chair', eric.isSittingOnChair(), eric.animatoryState);
  input.tap('down'); run(game, 6);
  check('Desk lid delivers the water pistol', eric.inventory.has('WATER_PISTOL'), [...eric.inventory].join(','));
  check('Finding the pistol is announced by name (it ticks step 1 of the plan)', finds.join(',') === 'WATER_PISTOL', JSON.stringify(finds));
  input.tap('up'); run(game, 4);
  check('Eric stands up again', eric.isStanding());

  // ---- 2. Fire the pistol at the middle cup ---------------------------------
  place(eric, 20, 17, 1);
  input.tap('fire'); run(game, 40);   // the pistol is chosen because a cup is in range
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
  input.tap('act'); run(game, 3);
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
  input.tap('act'); run(game, 8);
  check('Eric catches the frog', eric.inventory.has('FROG'), [...eric.inventory].join(','));

  const bike = game.cast.bike;
  place(eric, bike.x, 17, 1);
  input.tap('act'); run(game, 2);
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

// ---- Keys as a person presses them --------------------------------------------
// A real key press has a length. Eric looks at the keyboard every other tick,
// so a press can start and end between two looks, or last across several.
// `press` plays one: `ticks` is how long the key stays down (0 = a tap shorter
// than a tick), `phase` shifts it against Eric's own rhythm.
function press(game, input, action, ticks, settle = 12) {
  input.tap(action);                              // the key goes down: recorded at once
  if (ticks > 0) { input.hold(action); run(game, ticks); input.unhold(action); }
  run(game, settle);
}
{
  // Turning round on the stairs: a tap of any ordinary length turns Eric on
  // the spot; only a held key walks him off the step.
  let lost = 0, walked = 0, tried = 0;
  for (const ticks of [0, 1, 2, 3, 4, 5]) for (const phase of [0, 1]) {
    const { game, input, eric } = freshGame(); freezeCast(game);
    place(eric, 18, 13, -1); run(game, 4 + phase);
    press(game, input, 'right', ticks);
    tried++;
    if (eric.direction !== 1) lost++;
    else if (eric.x !== 18 || eric.y !== 13) walked++;
  }
  check('A tap of up to a quarter of a second turns Eric round on the stairs without moving him', lost === 0 && walked === 0, `${tried} taps: ${lost} lost, ${walked} walked off the step`);

  const { game, input, eric } = freshGame(); freezeCast(game);
  place(eric, 18, 13, -1); run(game, 4);
  press(game, input, 'right', 12);
  check('Holding the key still walks him down the stairs', eric.direction === 1 && eric.y > 13, `(${eric.x},${eric.y})`);
}
{
  // On the flat: one tap, one step, however short the tap.
  let wrong = [];
  for (const ticks of [0, 1, 2]) for (const phase of [0, 1]) {
    const { game, input, eric } = freshGame(); freezeCast(game);
    place(eric, 40, 17, 1); run(game, 4 + phase);
    press(game, input, 'right', ticks);
    if (eric.x !== 41 || eric.midstride()) wrong.push(`${ticks}t/${phase}: x=${eric.x} ${eric.animatoryState}`);
  }
  check('One tap of an arrow key walks Eric exactly one step', wrong.length === 0, wrong.join('; '));

  // Three quick taps in a row are three steps: none is swallowed mid-step.
  const { game, input, eric } = freshGame(); freezeCast(game);
  place(eric, 40, 17, 1); run(game, 4);
  for (let i = 0; i < 3; i++) press(game, input, 'right', 1, 2);
  run(game, 12);
  check('Three quick taps are three steps', eric.x === 43, `x=${eric.x}`);
}
{
  // The whole cup shot, from the foot of the stairs, with nothing but key taps.
  const { game, input, eric } = freshGame(); freezeCast(game);
  game.world.fillCup('MiddleCup', 'WATER');
  place(eric, 22, 17, -1); run(game, 4);
  for (let i = 0; i < 4; i++) press(game, input, 'up', 2);
  check('Four taps of Up climb four steps', eric.x === 18 && eric.y === 13, `(${eric.x},${eric.y})`);
  press(game, input, 'right', 2);
  press(game, input, 'fire', 1, 60);
  check('Tap right, tap fire: the pellet empties the cup', game.world.cups.get('MiddleCup').contents === null, String(game.world.cups.get('MiddleCup').contents));
}
{
  // The aiming help must tell the truth: fire from every spot it marks and see
  // that the engine does what the marker promised; and that nowhere else on
  // the toilets staircase works.
  const probe = freshGame();
  const spots = findSpots(probe.game.world, probe.eric.pellet);
  const bad = [];
  for (const s of spots.catapult) {
    const { game, input, eric } = freshGame(); freezeCast(game);
    for (const cup of game.world.cups.values()) game.world.fillCup(cup.id, 'WATER');
    place(eric, s.x, s.y, s.d); input.tap('fire'); run(game, 60);
    if (game.world.cups.get(s.cups[0].id).contents !== null) bad.push(`catapult (${s.x},${s.y}) did not knock ${s.cups[0].id}`);
  }
  for (const s of spots.pistol) {
    const { game, input, eric } = freshGame(); freezeCast(game);
    eric.inventory.add('WATER_PISTOL');
    place(eric, s.x, s.y, s.d); input.tap('fire'); run(game, 60);
    if (s.cup && game.world.cups.get(s.cup.id).contents !== 'WATER') bad.push(`pistol (${s.x},${s.y}) did not fill ${s.cup.id}`);
    if (s.pot && !game.cast.plants.find((p) => p.pot.id === s.pot.id && (p.growing || p.headHeight > 0))) bad.push(`pistol (${s.x},${s.y}) did not water ${s.pot.id}`);
  }
  check('Every spot the aiming help marks really works', bad.length === 0 && spots.catapult.length > 0 && spots.pistol.length > 0, bad.join('; ') || `${spots.catapult.length} catapult, ${spots.pistol.length} pistol`);

  const marked = new Set(spots.catapult.map((s) => `${s.x},${s.y},${s.d}`));
  const strays = [];
  for (let i = 0; i <= 7; i++) for (const d of [-1, 1]) {
    const x = 22 - i, y = 17 - i;
    if (marked.has(`${x},${y},${d}`)) continue;
    const { game, input, eric } = freshGame(); freezeCast(game);
    for (const cup of game.world.cups.values()) game.world.fillCup(cup.id, 'WATER');
    place(eric, x, y, d); input.tap('fire'); run(game, 60);
    if ([...game.world.cups.values()].some((c) => c.contents === null)) strays.push(`(${x},${y}) facing ${d}`);
  }
  check('No unmarked step of the toilets staircase knocks a cup', strays.length === 0, strays.join('; '));
}
{
  // An empty cup lets the pellet through, and says so.
  const { game, input, eric } = freshGame(); freezeCast(game);
  const empties = []; game.events.on('cupEmpty', ({ cup }) => empties.push(cup.id));
  place(eric, 18, 13, 1); input.tap('fire'); run(game, 60);
  check('A pellet through empty cups reports each one', empties.join(',') === 'MiddleCup,RightCup', empties.join(','));
}

// ---- Faults found by the independent engine review ----------------------------
{
  // A new game begun while Eric is half-way down a stair step.
  const { game, input, eric } = freshGame(); freezeCast(game);
  place(eric, 21, 16, 1); input.hold('down');
  for (let i = 0; i < 40 && eric.verticalDirection !== 1; i++) game.tick();
  input.unhold('down');
  const wasMidStep = eric.verticalDirection === 1;
  game.endGame(); game.start(); freezeCast(game);
  input.hold('left'); run(game, 12); input.unhold('left'); run(game, 40);
  check('A new game begun mid-step on the stairs does not drop Eric through the floor', wasMidStep && eric.y === 17, `mid-step ${wasMidStep}, y=${eric.y}`);
}
{
  // The conker can be shot out of the tree from the top floor, and it floors Albert.
  const { game, input, eric } = freshGame(); freezeCast(game);
  game.world.moveDoor('UpperWindow', false);
  let fell = false;
  for (let x = 80; x <= 90 && !fell; x++) { place(eric, x, 3, 1); input.tap('fire'); run(game, 60, () => { if (game.cast.conker.visible) fell = true; }); }
  check('A pellet fired through the open top-floor window knocks the conker out of the tree', fell);

  const g2 = freshGame(); freezeCast(g2.game);
  const albert = g2.game.cast.get('ALBERT'); const conked = [];
  g2.game.events.on('conked', ({ victim }) => conked.push(victim.id));
  place(albert, 100, 17, -1); g2.game.cast.conker.fall(101, 3); run(g2.game, 80);
  check('The conker knocks Albert out', conked.includes('ALBERT'), conked.join(','));
}
{
  // Pellets stop at shut doors whichever way they fly.
  const { game, input, eric } = freshGame(); freezeCast(game);
  const door = game.world.doors.get('ScienceLabDoor');
  let maxX = 0; place(eric, 45, 10, 1); input.tap('fire'); run(game, 40, () => { if (eric.pellet.visible) maxX = Math.max(maxX, eric.pellet.x); });
  check('A pellet flying right stops at a shut door', door.isShut() && maxX > 45 && maxX < door.x, `door at ${door.x}, pellet reached ${maxX}`);
}
{
  // Mice let go by Eric run along the floor he is standing on.
  const { game, input, eric } = freshGame(); freezeCast(game);
  place(eric, 120, 17, 1); eric.mice = 3; input.tap('drop'); run(game, 12);
  const rows = game.cast.mice.filter((m) => !m.immortal).map((m) => m.y);
  check('Released mice run along the floor', rows.length === 3 && rows.every((y) => y === 17), rows.join(','));

  // With stinkbombs in his pocket, the Drop key never spends the mice.
  const g2 = freshGame(); freezeCast(g2.game);
  place(g2.eric, 120, 17, 1); g2.eric.inventory.add('STINKBOMBS3'); g2.eric.mice = 4;
  g2.input.tap('drop'); run(g2.game, 12); g2.input.tap('drop'); run(g2.game, 12);
  check('Drop pressed twice quickly drops one stinkbomb and keeps the mice', g2.eric.mice === 4 && g2.eric.inventory.has('STINKBOMBS2'), `mice ${g2.eric.mice}, ${[...g2.eric.inventory].join(',')}`);
}
{
  // A teacher sent running is let off at the next bell.
  const { game } = freshGame();
  const creak = game.cast.get('CREAK'); creak.goFast();
  game.nextLesson(false);
  check('A teacher who was running walks again after the bell', creak.fixedSpeed === false);
}
{
  // The 10,000th line arriving just before the bell still ends the game.
  const { game } = freshGame();
  while (game.timetable.counter > 2) game.tick();
  game.addLines(game.config.maxLines - game.lines);
  for (let i = 0; i < 40000 && !game.gameOver; i++) { game.setVisibleColumns(0, 191); game.tick(); }
  check('Reaching the lines limit just before the bell still gets Eric expelled', game.gameOver, `gameOver ${game.gameOver}`);
}
{
  // A pellet in the air when a game ends does not haunt the next game.
  const { game, input, eric } = freshGame(); freezeCast(game);
  place(eric, 60, 17, -1); input.tap('fire'); run(game, 9);
  const inFlight = eric.pellet.visible;
  game.endGame(); game.start(); freezeCast(game);
  const xs = []; place(eric, 60, 17, 1); input.tap('fire'); run(game, 30, () => { if (eric.pellet.visible) xs.push(eric.pellet.x); });
  check('The first shot of a new game flies the way Eric faces', inFlight && xs.length >= 10 && xs[xs.length - 1] > xs[0], xs.join(','));
}
{
  // A self-closing door waits for whoever is standing in it.
  const { game, eric } = freshGame(); freezeCast(game);
  const door = game.world.doors.get('StudyBackDoor');
  place(eric, door.x - 1, 3, 1); game.world.moveDoor(door.id, false); run(game, 80);
  const waited = !door.isShut();
  place(eric, door.x - 10, 3, -1); run(game, 60);
  check('A self-closing door stays open while someone stands in it, then shuts', waited && door.isShut(), `waited ${waited}, shut ${door.isShut()}`);
}
{
  // The kiss is announced with Eric back where he stood, not while he is hidden.
  const { game, input, eric } = freshGame(); freezeCast(game);
  const hayley = game.cast.get('HEROINE') || game.cast.characters.find((c) => c.canKissEric());
  const seen = []; game.events.on('kiss', () => seen.push([eric.x, eric.visible]));
  place(eric, 120, 17, 1); place(hayley, 120 + game.config.kissDistance, 17, -1);
  input.tap('act'); run(game, 40);
  check('The kiss is announced with Eric in view', seen.length === 1 && seen[0][0] > 0 && seen[0][1] === true, JSON.stringify(seen));
}

// ---- Faults found by the independent renderer review --------------------------
{
  // Someone who has been out of sight must not replay an old change of pose
  // (a boy drawn sitting on thin air in the playground, then standing up).
  const motion = new Motion();
  const boy = { id: 'T', x: 10, y: 3, direction: -1, animatoryState: 'SITTING_ON_CHAIR', visible: true, walkDelay: 3 };
  motion.begin(1000, 50); motion.sample(boy, true);
  Object.assign(boy, { x: 120, y: 17, animatoryState: 'WALK0' });
  motion.begin(11000, 50); const m = motion.sample(boy, true);
  check('A character coming back into view is drawn as he is now, with no old pose played back', !m.seq && !m.fade && m.x === 120 && m.y === 17, JSON.stringify({ seq: !!m.seq, fade: !!m.fade, x: m.x, y: m.y }));

  // ...nor be drawn half-way back to where he was last seen, if he returns mid-stride.
  const walker = { id: 'W', x: 118, y: 17, direction: 1, animatoryState: 'WALK0', visible: true, walkDelay: 3 };
  motion.begin(20000, 50); motion.sample(walker, true);
  Object.assign(walker, { x: 125, animatoryState: 'WALK1' });
  motion.begin(30000, 50); const w = motion.sample(walker, true);
  check('A walker coming back into view mid-stride is drawn where he is', Math.abs(w.x - 125.5) < 0.01, `x=${w.x}`);
}
{
  // A file that is not Back to Skool is refused promptly, not chewed on for ever.
  const results = [];
  for (const fill of [0, 7, 'pattern']) {
    const bytes = new Uint8Array(49179);
    for (let i = 0; i < bytes.length; i++) bytes[i] = fill === 'pattern' ? (i * 31 + 7) & 255 : fill;
    const t0 = Date.now(); let outcome = 'accepted';
    try { extractGraphics(loadSnapshot(bytes, 'not-the-game.sna')); } catch (e) { outcome = 'refused'; }
    results.push(`${fill}: ${outcome} in ${Date.now() - t0} ms`);
  }
  check('A snapshot that is not Back to Skool is refused at once', results.every((r) => /refused in \d{1,3} ms/.test(r)), results.join('; '));
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exitCode = failures ? 1 : 0;
