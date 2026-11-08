#!/usr/bin/env node
// ============================================================================
// FULL PLAYTHROUGH TEST
// ----------------------------------------------------------------------------
// Plays the whole report-card caper the way a player would. Eric is driven
// only by simulated key presses along real routes (no teleporting), and every
// step of the objective is checked. The script reads game state to know where
// things are (which desk holds the pistol, where a teacher is walking) but
// never changes it.
//
//   node tools/playthrough.mjs [seed]
//
// The route, in the order the original game forces on you:
//   1. water pistol and stinkbombs from the desks
//   2. soak the four masters with water from a cup to learn the bike digits
//   3. write the bike combination on a blackboard
//   4. get locked in at lesson time, stinkbomb Mr Wacker into opening the
//      window, grow the plant, climb out, grow the gate plant, climb the gate,
//      and jump at Miss Take's open drinks cabinet for sherry
//   5. soak the masters again with sherry for the storeroom letters
//   6. write the storeroom combination, open the storeroom, catch the frog
//   7. at playtime ride the bike into the girls' school and drop the frog in
//      the kitchen cup from the saddle
//   8. knock Miss Take over beneath the cup, bounce a pellet up into it, and
//      take the key the frog knocks out of her hair
//   9. get into the head's study and jump up to the safe
//
// Lines are not capped in this run (a scripted Eric loiters near teachers far
// more than a player would), so expulsion for 10,000 lines cannot interrupt
// it. Everything else is the real game.
// ============================================================================

import { Game } from '../src/engine/game.js';
import { FakeInput } from '../src/ui/input.js';
import { measureText, fontHas } from './node-font.mjs';
import { LESSONS } from '../src/data/timetable.js';

const seed = Number(process.argv[2] || 2026);
const input = new FakeInput();
const game = new Game({ input, seed, config: { freezeOnMessages: false, maxLines: 1e9 }, measureText, fontHas });
const world = game.world, cast = game.cast;
const eric = cast.eric;
const T = () => game.tickCount;
const log = (msg) => console.log(`[${String(T()).padStart(6)}] ${msg}`);
let failures = 0;
function check(label, ok, detail = '') { log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`); if (!ok) failures++; return !!ok; }
const inv = () => [...eric.inventory].join(',');

// ---- Driving helpers ---------------------------------------------------------
function tick(n = 1) {
  for (let i = 0; i < n; i++) {
    game.setVisibleColumns(Math.max(0, eric.x - 16), eric.x + 16);
    game.tick();
    if (eric.frozen) input.tap('act');     // acknowledge whatever a teacher is telling us
  }
}
function release() { for (const a of ['left', 'right', 'up', 'down']) input.unhold(a); }
function hold(key) { release(); if (key) input.hold(key); }
function waitUntil(pred, max, what = '') {
  for (let i = 0; i < max; i++) { if (pred()) return true; tick(); }
  if (what) log(`  timed out waiting for ${what}`);
  return false;
}
// Turn Eric to face a direction: the first press of the opposite key turns him
// on the spot, only later presses step.
function face(dir) {
  const key = dir < 0 ? 'left' : 'right';
  for (let i = 0; i < 8 && eric.direction !== dir; i++) { input.hold(key); tick(); input.unhold(key); }
  if (eric.direction !== dir) log(`  face(${dir}) failed at (${eric.x},${eric.y}) ${eric.animatoryState}`);
}
const busy = () => eric.controller || eric.midstride() || eric.isKnockedOut() || eric.isSittingOnFloor();
const allStairs = [...new Set(world.staircases.values())];

// Walk to (x, y) along the real route, floor by floor and staircase by
// staircase, deciding each tick which single key to hold. The target may be a
// step on a staircase (reached from its foot).
function walkTo(tx, ty, maxTicks = 6000) {
  const start = T();
  const trace = []; let lastState = '';
  const note = (s) => { if (s !== lastState) { trace.push(`${T()}:${s}`); lastState = s; if (trace.length > 30) trace.shift(); } };
  const destFloor = world.floorAt(tx, ty);
  const destStairs = destFloor ? null : allStairs.find((s) => s.containsLocation(tx, ty));
  if (!destFloor && !destStairs) { log(`  walkTo: (${tx},${ty}) is not on a floor or staircase`); return false; }
  const goal = destFloor ? { x: tx, y: ty, floor: destFloor } : { x: destStairs.bottom.x, y: destStairs.bottom.y, floor: world.floorAt(destStairs.bottom.x, destStairs.bottom.y) };
  let stairKey = null;   // 'up' or 'down' while we are on a staircase
  while (T() - start < maxTicks) {
    if (eric.x === tx && eric.y === ty && !eric.midstride()) { release(); return true; }
    note(`(${eric.x},${eric.y}) ${eric.animatoryState} d${eric.direction} ${eric.controller ? eric.controller.constructor.name : ''}`);
    if (busy()) { hold(null); tick(); continue; }
    if (eric.isSittingOnChair()) { input.tap('up'); tick(2); continue; }
    const stairs = world.staircase(eric);
    if (stairs && stairs.supports(eric)) {
      if (destStairs === stairs) hold(ty < eric.y ? 'up' : 'down');
      else hold(stairKey || (ty < eric.y ? 'up' : 'down'));
      tick(); continue;
    }
    const here = world.floorAt(eric.x, eric.y);
    if (!here) {
      // Standing on a plant pot or a plant: step off towards the target. Otherwise mid-air: let gravity finish.
      if (world.plantPot(eric.x, eric.y) || cast.plant(eric)) hold(tx < eric.x ? 'left' : 'right'); else hold(null);
      tick(); continue;
    }
    stairKey = null;
    if (destStairs && here === goal.floor && eric.x === goal.x) {
      if (eric.direction !== destStairs.direction) { hold(destStairs.direction < 0 ? 'left' : 'right'); tick(); continue; }
      hold('up'); tick(); continue;
    }
    let gx = goal.x;
    if (here !== goal.floor) {
      const sc = world.nextStaircase(here, goal.floor);
      if (!sc) { release(); log(`  walkTo: no route from ${here.id} to ${goal.floor.id}`); return false; }
      const atBottom = eric.y === sc.bottom.y;
      gx = atBottom ? sc.bottom.x : sc.top.x;
      if (eric.x === gx) {
        // At the foot or head of the stairs: Eric must face along the staircase
        // before 'up'/'down' does anything.
        const wantDir = atBottom ? sc.direction : -sc.direction;
        if (eric.direction !== wantDir) { hold(wantDir < 0 ? 'left' : 'right'); tick(); continue; }
        stairKey = atBottom ? 'up' : 'down';
        hold(stairKey); tick(); continue;
      }
    }
    hold(gx > eric.x ? 'right' : 'left'); tick();
  }
  release();
  log(`  walkTo (${tx},${ty}) timed out at (${eric.x},${eric.y}); recent: ${trace.slice(-8).join(' | ')}`);
  return false;
}
// Keep trying a walk that may be blocked for a while (a shut door, a crowd).
function walkToEventually(tx, ty, budget, step = 1500) {
  const start = T();
  while (T() - start < budget) { if (walkTo(tx, ty, step)) return true; tick(100); }
  return false;
}

// ---- Doors and the timetable ---------------------------------------------------
const skoolDoor = world.doors.get('SkoolDoor'), gate = world.doors.get('SkoolGate'), cabinet = world.doors.get('DrinksCabinet');
const window10 = world.windows.get('MiddleWindow');
const lessonNow = () => game.timetable.lessonId;
// Miss Take only checks the school door (and opens her cabinet) in periods when she teaches.
const takeTeaching = () => /^(UpperRoom|MiddleRoom)-Teacher$/.test(LESSONS[lessonNow()]?.cast?.TAKE || '');

// ---- Actions ---------------------------------------------------------------------
function getFromDesk(item) {
  const desk = world.allDesks().find((d) => d.contents === item);
  if (!desk) { log(`  no desk holds ${item}`); return false; }
  const room = desk.room, floorY = room.maxY - 3;
  log(`${item} is in a desk in the ${room.name} at column ${desk.x}.`);
  if (!walkToEventually(desk.x, floorY, 12000)) return false;
  face(room.chairDirection());
  input.tap('down'); tick(4);
  if (!eric.isSittingOnChair()) { log(`  could not sit at the desk (${eric.animatoryState})`); return false; }
  input.tap('down'); tick(12);
  input.tap('up'); tick(4);
  return eric.inventory.has(item);
}

// The cups hang over the ground floor by the toilets. Standing at (20,17)
// facing right, the pistol's jet lands in the middle cup; standing on the
// toilet stairs at (18,13) facing right, a pellet knocks that cup over, and
// what falls out lands on whoever is standing at column 26.
const CUP = world.cups.get('MiddleCup'), FILL_SPOT = [20, 17], SHOOT_SPOT = [18, 13], SPLASH_X = 26;
function fillCup(liquid) {
  if (CUP.contents === liquid) return true;
  if (!walkToEventually(FILL_SPOT[0], FILL_SPOT[1], 8000)) return false;
  face(1);
  input.tap('fire');
  return waitUntil(() => CUP.contents === liquid, 60, `the cup to fill with ${liquid}`);
}
// Soak each master who knows a secret by timing the shot so the drop meets him
// as he walks under the cup. The lead (how many cells short of column 26 he
// is when we fire) is tuned from where he actually was when the drop landed.
function soakMasters(liquid, flag, budget) {
  const holders = cast.characters.filter((c) => c[flag]());
  const got = new Set();
  const seen = (s) => { if (holders.includes(s.character)) got.add(s.character.id); };
  game.events.on('secret', seen);
  const drop = liquid === 'WATER' ? cast.waterDrop : cast.sherryDrop;
  // We fire on the tick the master steps into the "lead" cell, so the timing
  // is repeatable; a walking master and a running one need different leads.
  const lead = { 1: 1, 2: 3 };     // calibrated: walking (speed 1) and running (speed 2)
  const prev = new Map();
  const start = T();
  while (T() - start < budget && got.size < holders.length) {
    if (!fillCup(liquid)) { log(`  could not fill the cup with ${liquid}`); break; }
    if (!walkTo(SHOOT_SPOT[0], SHOOT_SPOT[1], 3000)) break;
    face(1);
    // Wait for an unsoaked master walking along the ground floor towards column 26.
    let target = null, tdir = 0, speed = 1;
    const found = waitUntil(() => {
      for (const h of holders) {
        const px = prev.get(h.id); prev.set(h.id, h.x);
        if (got.has(h.id) || h.y !== 17 || !h.isStanding() || px === undefined || h.x === px) continue;
        const d = Math.sign(h.x - px);
        if ((SPLASH_X - h.x) * d === lead[h.speed]) { target = h; tdir = d; speed = h.speed; return true; }
      }
      return false;
    }, budget - (T() - start));
    if (!found) break;
    const before = got.size;
    input.tap('fire');
    // Watch the drop fall and note where the master was on the tick the game
    // checked for a soaking (the drop moves on from head height that tick).
    const checkRow = 17 - drop.hitXY[1];
    let atCheck = null;
    for (let i = 0; i < 60 && got.size === before; i++) {
      tick();
      if (drop.visible && drop.y === checkRow && atCheck === null) atCheck = target.x;
    }
    if (got.size > before) { log(`  ${target.name} let slip a secret (${liquid}, lead ${lead[speed]} at speed ${speed})`); continue; }
    if (atCheck !== null) {
      const err = (atCheck - SPLASH_X) * tdir;
      log(`  missed ${target.name}: he was ${err > 0 ? err + ' past' : -err + ' short of'} the drop (speed ${speed}); lead ${lead[speed]} -> ${lead[speed] + err}`);
      lead[speed] = Math.min(6, Math.max(0, lead[speed] + err));
    } else log(`  missed ${target.name}: no drop fell`);
  }
  game.events.off('secret', seen);
  return got;
}

function writeOnBoard(text, budget = 20000) {
  const start = T();
  const rooms = ['ScienceLab', 'BlueRoom', 'YellowRoom'].map((id) => world.getRoom(id));
  while (T() - start < budget) {
    const room = rooms.find((r) => !r.blackboard.isDirty()) || rooms[Math.floor((T() / 2000) % 3)];
    const b = room.blackboard;
    if (!walkToEventually(b.x + 2, room.maxY - 3, 6000)) continue;
    face(1);
    input.tap('act'); tick(3);
    if (!eric.writing) { log(`  could not start writing in the ${room.name}`); tick(200); continue; }
    input.type(text); tick(text.length * 4 + 10);
    input.type('\n'); tick(10);
    if (b.lines.includes(text)) return true;
    log(`  the board reads ${JSON.stringify(b.lines)}; trying again`);
    tick(300);
  }
  return false;
}

// Water a plant pot, hop onto the pot before the plant appears, ride it up,
// then step off in `dir` (towards an open window or the shut gate).
// It is a race: the plant appears about two seconds after the water lands,
// and Eric has to be on the pot by then, so he sets off the moment the pistol
// is lowered and jumps the instant he arrives.
function climbViaPlant(potX, potFloorY, fireFromX, dir, what) {
  const pot = world.plantPot(potX, potFloorY - 1), plant = pot.plant;
  const towards = fireFromX < potX ? 'right' : 'left';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (plant.growing) waitUntil(() => !plant.growing, 200);     // let a half-used plant wilt first
    if (!walkTo(fireFromX, potFloorY, 3000)) return false;
    log(`  at (${eric.x},${eric.y}) ready to water the ${what} plant`);
    face(fireFromX < potX ? 1 : -1);
    input.tap('fire'); tick(1);
    waitUntil(() => eric.controller, 6); waitUntil(() => !eric.controller, 30);
    hold(towards);
    waitUntil(() => eric.x === potX && !eric.midstride(), 60);
    release(); input.tap('jump');
    waitUntil(() => eric.controller, 6); waitUntil(() => !eric.controller, 12);
    if (!(eric.x === potX && eric.y === potFloorY - 1)) { log(`  did not land on the pot: (${eric.x},${eric.y}); plant growing=${plant.growing} head=${plant.headHeight}`); continue; }
    if (!waitUntil(() => plant.headHeight === 2 && cast.plant(eric), 120)) { log(`  the plant did not lift Eric (head ${plant.headHeight}, Eric at (${eric.x},${eric.y})); again`); continue; }
    face(dir);
    hold(dir < 0 ? 'left' : 'right'); tick(3); release();
    if (!eric.controller) { log(`  no ${what} from the plant at (${eric.x},${eric.y})`); return false; }
    waitUntil(() => !eric.controller && !busy(), 200);
    return true;
  }
  return false;
}

// Albert stands just right of the tree during lessons and raises the alarm if
// Eric is two to six cells to his left while he faces left; once the alarm is
// raised he blocks Eric's way. He paces left and right, though, so Eric waits
// at the foot of the window wall until Albert turns back towards the tree,
// then runs past behind him. (The other way past is a conker on his head.)
function passAlbert() {
  const albert = cast.get('ALBERT');
  for (let attempt = 0; attempt < 40; attempt++) {
    if (eric.x > 103) return true;
    if (!walkTo(95, 17, 400)) return false;
    if (!(albert.y === 17 && albert.x >= 96 && albert.x <= 112)) return true;   // not on guard
    waitUntil(() => albert.direction > 0 || albert.x > 112 || albert.y !== 17, 400);
    hold('right');
    let last = eric.x, still = 0;
    while (eric.x < 104 && still < 12) { tick(); if (eric.x === last) still++; else { still = 0; last = eric.x; } }
    release();
    if (eric.x >= 104) return true;
    log(`  Albert caught Eric at (${eric.x},${eric.y}) (Albert at ${albert.x} facing ${albert.direction}); backing off`);
  }
  return false;
}

// ---- Scenario ----------------------------------------------------------------------
if (process.env.BTS_DEBUG) {
  // Who opens and shuts the drinks cabinet, and from where.
  const take = cast.get('TAKE'), orig = world.moveDoor.bind(world);
  world.moveDoor = (id, shut) => {
    if (id === 'DrinksCabinet') log(`  [debug] cabinet ${shut ? 'SHUT' : 'OPEN'} by ${new Error().stack.split('\n')[2].trim()}; Miss Take at (${take.x},${take.y}) stack ${take.commandList.stack.map((c) => c.constructor.name).join('>')} list ${take.commandList.commands.map((c) => c.constructor.name).join('>')} idx ${take.commandList.index}`);
    return orig(id, shut);
  };
}
game.start();
const events = { quest: [] };
game.events.on('quest', (q) => events.quest.push(q.step));
log(`Game started. Lesson ${lessonNow()}. Eric at (${eric.x},${eric.y}).`);
log(`Bike combination ${world.bikeCombination}, storeroom combination ${world.storeroomCombination}.`);

// 1. The desks --------------------------------------------------------------------
check('found the water pistol in a desk', getFromDesk('WATER_PISTOL'), inv());
check('found the stinkbombs in a desk', getFromDesk('STINKBOMBS3'), inv());

// 2. Bike digits -------------------------------------------------------------------
{
  const got = soakMasters('WATER', 'hasBikeSecret', 90000);
  check('all four bike digits revealed by soaking the masters', got.size === 4, `${got.size} of 4: ${[...got].join(',')}`);
}

// 3. Bike combination --------------------------------------------------------------
check('wrote the bike combination and the bike came free', writeOnBoard(world.bikeCombination) && !cast.bike.chained, `combination ${world.bikeCombination}`);

// 4. Sherry --------------------------------------------------------------------------
{
  const WAIT_SPOT = [88, 10];       // middle-floor corridor by the window, inside the boys' school
  const deadline = T() + 120000;
  let bombsUsed = 0;
  while (!eric.inventory.has('SHERRY_PISTOL') && T() < deadline) {
    // Be inside when Albert locks up (he waits for Eric too).
    if (!walkToEventually(WAIT_SPOT[0], WAIT_SPOT[1], 20000)) break;
    face(-1);
    if (!waitUntil(() => skoolDoor.shut, 12000, 'Albert to shut the school door')) continue;
    const lesson = lessonNow();
    log(`School door shut during ${lesson}; cabinet ${cabinet.shut ? 'shut' : 'open'}; window ${window10.shut ? 'shut' : 'open'}.`);
    // Stinkbomb Mr Wacker as he passes along the corridor, so he opens the window.
    const wacker = cast.get('WACKER');
    while (window10.shut && lessonNow() === lesson && eric.hasStinkbomb()) {
      walkTo(WAIT_SPOT[0], WAIT_SPOT[1], 2000); face(-1);
      const near = waitUntil(() => wacker.y === 10 && wacker.isStanding() && wacker.x >= 88 && wacker.x <= 90 && !eric.getPunchee(1) && !eric.getPunchee(2), 6000);
      if (!near) break;
      input.tap('drop'); tick(2); bombsUsed++;
      log(`  dropped a stinkbomb (${bombsUsed}) with Mr Wacker at (${wacker.x},${wacker.y})`);
      waitUntil(() => !window10.shut, 300);
    }
    if (window10.shut) { log('  window still shut; will try again next lesson'); continue; }
    if (lessonNow() !== lesson) continue;
    if (!takeTeaching()) { log(`  Miss Take is not teaching in ${lesson}; waiting for the next period`); waitUntil(() => lessonNow() !== lesson, 2600); continue; }
    // Out through the window on the plant, over the gate on the other plant.
    if (!climbViaPlant(93, 10, 86, 1, 'window exit')) continue;
    check('climbed out of the middle-floor window', eric.y === 17 && eric.x >= 95, `Eric at (${eric.x},${eric.y})`);
    if (!passAlbert()) { log('  could not get past Albert'); continue; }
    log(`  past Albert at ${T()}`);
    if (gate.shut) {
      if (!climbViaPlant(132, 17, 125, 1, 'gate climb')) continue;
      check('climbed over the school gate', eric.x >= 135, `Eric at (${eric.x},${eric.y})`);
    }
    // Wait in the girls' playground, short of column 160 so Miss Take does not
    // abandon her rounds to chase Eric, until the cabinet is open (she opens it
    // at the start of her teaching period while the school door is shut), then
    // go up and jump at it.
    if (!walkTo(150, 17, 4000)) continue;
    log(`  in the girls' playground during ${lessonNow()}; cabinet ${cabinet.shut ? 'shut' : 'open'}`);
    waitUntil(() => !cabinet.shut || game.isPlaytime(), 12000);
    if (cabinet.shut) { log('  playtime came before the cabinet opened; going back in to try again'); waitUntil(() => !gate.shut && !skoolDoor.shut, 3000); continue; }
    const arrived = walkToEventually(188, 3, 3000, 1000);
    log(`  ${arrived ? 'reached' : 'could not reach'} the cabinet; Eric at (${eric.x},${eric.y}), cabinet ${cabinet.shut ? 'shut' : 'open'}, ${lessonNow()}`);
    if (!arrived) continue;
    for (let i = 0; i < 5 && !eric.inventory.has('SHERRY_PISTOL') && !cabinet.shut; i++) {
      walkTo(188, 3, 500); face(1); input.tap('jump');
      waitUntil(() => eric.controller, 6); waitUntil(() => !eric.controller, 12);
      log(`  jumped at the cabinet from (${eric.x},${eric.y}) facing ${eric.direction}: ${inv()}`);
    }
    if (!eric.inventory.has('SHERRY_PISTOL')) { waitUntil(() => !gate.shut && !skoolDoor.shut, 12000, 'playtime to get back in'); }
  }
  check('filled the pistol with sherry from the drinks cabinet', eric.inventory.has('SHERRY_PISTOL'), inv());
}

// 5. Storeroom letters -----------------------------------------------------------------
{
  waitUntil(() => game.isPlaytime() && !gate.shut && !skoolDoor.shut, 20000, 'playtime');
  const got = soakMasters('SHERRY', 'hasStoreroomSecret', 90000);
  check('all four storeroom letters revealed by sherrying the masters', got.size === 4, `${got.size} of 4: ${[...got].join(',')}`);
}

// 6. Storeroom key and the frog ----------------------------------------------------------
check('wrote the storeroom combination and got the key', writeOnBoard(world.storeroomCombination) && eric.inventory.has('STOREROOM_KEY'), `combination ${world.storeroomCombination}`);
{
  const frog = cast.frog;
  check('walked into the storeroom with the key', walkToEventually(58, 10, 12000), `door shut: ${world.doors.get('ScienceLabDoor').shut}`);
  // Eric's hand reaches the cell in front of him when he bends over, so he
  // stands one cell to the frog's left facing right, or (against the storeroom's
  // left wall) one cell to its right facing left. The frog is skittish when
  // Eric is close, so rather than chase it he waits in one spot and grabs the
  // moment it sits within reach.
  let caught = false;
  const start = T();
  while (!caught && frog.visible && T() - start < 6000) {
    const fromLeft = frog.x - 1 >= 55;
    const spot = fromLeft ? frog.x - 1 : frog.x + 1;
    if (Math.abs(eric.x - spot) > 4 || eric.y !== 10) { walkTo(spot, 10, 600); face(fromLeft ? 1 : -1); }
    else if (eric.direction !== (frog.x > eric.x ? 1 : -1)) face(frog.x > eric.x ? 1 : -1);
    for (let i = 0; i < 80 && !caught; i++) {
      if (!busy() && cast.getAnimal(...eric.bendOverHandCoords())) { input.tap('act'); tick(6); caught = eric.inventory.has('FROG'); }
      else tick();
    }
  }
  check('caught the frog', caught, `frog at (${frog.x},${frog.y})`);
}

// 7. The bike ride and the frog in the cup ----------------------------------------------
{
  const bike = cast.bike, cup = world.cups.get('GirlsCup');
  waitUntil(() => game.isPlaytime() && !gate.shut, 20000, 'playtime with the gate open');
  check('walked to the bike', walkToEventually(bike.x, 17, 8000), `bike at (${bike.x},${bike.y})`);
  face(1);
  input.tap('act'); tick(2);
  check('mounted the bike', eric.isRidingBike(), eric.animatoryState);
  let n = 0;
  while (eric.bike && eric.sittingOnSaddle && eric.x < 170 && n++ < 600) { input.tap(n % 2 ? 'right' : 'left'); tick(3); }
  log(`  pedalled to (${eric.x},${eric.y}); momentum ${bike.momentum}`);
  if (eric.bike) { input.tap('up'); tick(4); }
  const standing = eric.bike && !eric.sittingOnSaddle;
  let placed = false;
  if (standing) {
    waitUntil(() => eric.x >= 184 || !eric.bike, 200);
    if (eric.bike) { input.tap('jump'); tick(20); placed = cup.frogs.length > 0; }
  }
  check('dropped the frog into the kitchen cup from the saddle', placed, `standing=${standing} eric=(${eric.x},${eric.y}) frogs=${cup.frogs.length}`);
  waitUntil(() => !busy(), 100);
}

// 8. Miss Take, the pellet and the key -------------------------------------------------------
{
  const take = cast.get('TAKE'), TARGET = 185, SPOT = [174, 17];
  // As with the masters: fire on the tick she steps into the lead cell, with a
  // lead per speed, and correct the lead from where she actually fell.
  const lead = { 1: 1, 2: 2 };
  let prevX = take.x;
  const deadline = T() + 90000;
  while (!eric.inventory.has('SAFE_KEY') && T() < deadline) {
    if (!walkToEventually(SPOT[0], SPOT[1], 6000)) break;
    face(1);
    let tdir = 0, speed = 1;
    const ready = waitUntil(() => {
      const moved = take.x !== prevX, d = Math.sign(take.x - prevX); prevX = take.x;
      if (moved && take.y === 17 && take.isStanding() && (TARGET - take.x) * d === lead[take.speed] && eric.x === SPOT[0]) { tdir = d; speed = take.speed; return true; }
      return false;
    }, deadline - T());
    if (!ready) break;
    input.tap('fire');
    const decked = waitUntil(() => take.isKnockedOver(), 30);
    if (!decked) { lead[speed] = lead[speed] >= 3 ? 0 : lead[speed] + 1; log(`  pellet missed Miss Take (speed ${speed}); lead -> ${lead[speed]}`); continue; }
    const xd = take.x;
    if (xd !== TARGET) { const err = (TARGET - xd) * tdir; lead[speed] = Math.min(4, Math.max(0, lead[speed] - err)); log(`  Miss Take decked at ${xd} not ${TARGET} (speed ${speed}); lead -> ${lead[speed]}`); waitUntil(() => !take.isKnockedOver(), 200); continue; }
    log('  Miss Take is down right under the cup; firing again');
    input.tap('fire');
    waitUntil(() => eric.inventory.has('SAFE_KEY') || !take.isKnockedOver(), 120);
  }
  check('bounced a pellet into the cup: the frog dropped the key out of Miss Take\'s hair', eric.inventory.has('SAFE_KEY'), inv());
}

// 9. The safe -------------------------------------------------------------------------------
{
  const door = world.doors.get('StudyDoor');
  let won = false;
  game.events.on('upAYear', () => { won = true; });
  check('walked to the head\'s study door', walkToEventually(87, 3, 20000));
  const deadline = T() + 80000;
  while (!won && T() < deadline) {
    face(-1);
    if (!waitUntil(() => !door.shut, deadline - T(), 'Mr Wacker to open his door')) break;
    if (walkTo(79, 3, 300)) { face(1); input.tap('jump'); tick(12); }
    if (!won) walkToEventually(87, 3, 2000, 500);
  }
  check('jumped up to the safe with the key: Eric goes up a year', won);
}

log(`Finished with score ${game.score}, lines ${game.lines}, lesson ${lessonNow()}. Quest events: ${events.quest.join(' > ')}`);
console.log(failures ? `\n${failures} step(s) failed` : '\nThe whole caper works end to end.');
process.exitCode = failures ? 1 : 0;
