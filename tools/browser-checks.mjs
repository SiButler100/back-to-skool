#!/usr/bin/env node
// ============================================================================
// BROWSER CHECKS (the game as a person plays it: a real page, real key presses)
// ----------------------------------------------------------------------------
// tools/scenarios.mjs drives the engine directly with a perfect fake keyboard.
// That misses anything to do with how long a key is really held, what the
// page does with it, and what the menus and switches do. This script opens
// the real page in a headless browser and presses real keys.
//
//   node tools/browser-checks.mjs            run everything
//   node tools/browser-checks.mjs controls   run only the sections named
//
// Sections: controls, screens, soak.
// It needs Playwright (not a dependency of the game itself). Exit code 0 means
// every check passed.
// ============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); } catch (e) {
  ({ chromium } = (await import('/opt/node-tools/node_modules/playwright/index.js')).default);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
const wanted = (name) => !only.length || only.includes(name);

// ---- A tiny web server for the game's own folder -----------------------------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---- Reporting ---------------------------------------------------------------
let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  (' + detail + ')' : ''}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();

// Open the game with fresh settings and start a new game. `settings` are
// applied before the game starts (as if chosen in Options).
async function openGame({ settings = null, width = 1500, height = 900, keepStorage = false } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}/index.html`);
  if (!keepStorage) { await page.evaluate(() => localStorage.clear()); await page.reload(); }
  await page.waitForFunction(() => window.bts && document.querySelector('.overlay'), null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  if (settings) await apply(page, settings);
  await page.click('text=New game');
  await page.waitForTimeout(400);
  return { page, errors };
}
// Change settings the way the Options screen does.
async function apply(page, patch) {
  for (const [key, value] of Object.entries(patch)) {
    await page.evaluate(([key, value]) => { window.bts.settings[key] = value; window.bts.menu.onApply(window.bts.settings, key); }, [key, value]);
  }
  await page.waitForTimeout(250);
}
// Everyone but Eric stands still, and nobody hands out lines, so one control
// can be tried at a time without the school interfering.
const quietSchool = (page) => page.evaluate(() => {
  const g = window.bts.game;
  for (const c of g.cast.characters) { c.setCommandListTemplate([['SitStill']]); c.x = 100 + (c.x % 20); c.y = 17; }
  g.config.freezeOnMessages = false;
});
// Put Eric somewhere, standing, with nothing in hand. (Staging only: every
// action after this is a real key press.)
const put = (page, x, y, direction) => page.evaluate(([x, y, direction]) => {
  const e = window.bts.game.cast.eric;
  if (e.writing) { e.writing = false; window.bts.input.finishWriting(); }
  e.controller = null; e.turnPause = 0; e.bike = null; e.floorTimer = 0; e.visible = true;
  e.x = x; e.y = y; e.direction = direction; e.animatoryState = 'WALK0';
  window.bts.input.flush();
}, [x, y, direction]);
const eric = (page) => page.evaluate(() => {
  const g = window.bts.game, e = g.cast.eric;
  return { x: e.x, y: e.y, dir: e.direction, as: e.animatoryState, ctl: e.controller ? e.controller.constructor.name : null, writing: e.writing, inv: [...e.inventory], tick: g.tickCount, visible: e.visible };
});
// One key press of a given length, then time for Eric to finish what it began.
async function tap(page, key, ms = 80, settle = 600) { await page.keyboard.press(key, { delay: ms }); await page.waitForTimeout(settle); }
// Watch for something that only shows for a moment (a pellet, a raised fist).
const watch = (page, name, fn) => page.evaluate(([name, src]) => {
  const test = new Function('g', 'e', `return (${src})(g, e);`);
  window.__seen = window.__seen || {}; window.__seen[name] = false;
  const g = window.bts.game;
  const off = g.events.on('tick', () => { try { if (test(g, g.cast.eric)) window.__seen[name] = true; } catch (err) { /* ignore */ } });
  window.__watchOff = window.__watchOff || {}; window.__watchOff[name] = off;
}, [name, fn.toString()]);
const seen = (page, name) => page.evaluate((name) => !!(window.__seen && window.__seen[name]), name);

const TAPS = [30, 90, 160];          // short, ordinary and leisurely taps, in milliseconds

// =============================================================================
// CONTROLS: each key, pressed as a person presses it
// =============================================================================
if (wanted('controls')) {
  console.log('\n-- Controls --');
  const { page, errors } = await openGame();
  await quietSchool(page);
  await page.waitForTimeout(300);

  // Walking and turning on the flat.
  for (const ms of TAPS) {
    const steps = [], turns = [];
    for (let n = 0; n < 6; n++) {
      await put(page, 40, 17, 1); await page.waitForTimeout(90 + n * 23);
      await tap(page, 'ArrowRight', ms); steps.push((await eric(page)).x - 40);
      await put(page, 40, 17, 1); await page.waitForTimeout(90 + n * 23);
      await tap(page, 'ArrowLeft', ms); const s = await eric(page); turns.push(s.dir === -1 && s.x === 40 ? 'turned' : `dir ${s.dir} x ${s.x}`);
    }
    check(`A ${ms} ms tap of → walks one step`, steps.every((d) => d === 1), steps.join(','));
    check(`A ${ms} ms tap of ← turns Eric round on the spot`, turns.every((t) => t === 'turned'), [...new Set(turns)].join(' | '));
  }
  await put(page, 40, 17, 1);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(400);
  { const s = await eric(page); check('Holding → for a second walks about five steps', s.x >= 44 && s.x <= 46, `x=${s.x}`); }

  // Stairs.
  for (const ms of TAPS) {
    await put(page, 22, 17, -1); await tap(page, 'ArrowUp', ms);
    let s = await eric(page); check(`Foot of the stairs, facing them: a ${ms} ms tap of ↑ climbs one step`, s.x === 21 && s.y === 16, `(${s.x},${s.y})`);
    await put(page, 22, 17, 1); await tap(page, 'ArrowUp', ms);
    s = await eric(page); check(`Foot of the stairs, back to them: a ${ms} ms tap of ↑ turns Eric to face them`, s.dir === -1 && s.x === 22 && s.y === 17, `dir ${s.dir} (${s.x},${s.y})`);
    await put(page, 15, 10, 1); await tap(page, 'ArrowDown', ms);
    s = await eric(page); check(`Head of the stairs: a ${ms} ms tap of ↓ goes down one step`, s.x === 16 && s.y === 11, `(${s.x},${s.y}) ${s.as}`);
    await put(page, 18, 13, -1); await tap(page, 'ArrowRight', ms);
    s = await eric(page); check(`On the stairs: a ${ms} ms tap of → turns Eric round without moving him`, s.dir === 1 && s.x === 18 && s.y === 13, `dir ${s.dir} (${s.x},${s.y})`);
    await put(page, 18, 13, -1); await tap(page, 'ArrowDown', ms);
    s = await eric(page); check(`On the stairs: a ${ms} ms tap of ↓ turns Eric to face down them`, s.dir === 1 && s.x === 18 && s.y === 13, `dir ${s.dir} (${s.x},${s.y})`);
  }
  await put(page, 22, 17, -1);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(2200); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(400);
  { const s = await eric(page); check('Holding ↑ climbs the whole staircase and stops on the landing', s.y === 10, `(${s.x},${s.y})`); }

  // Sitting, the desk, standing.
  for (const ms of TAPS) {
    await put(page, 40, 17, 1); await tap(page, 'ArrowDown', ms);
    let s = await eric(page); const sat = s.as === 'SITTING_ON_FLOOR';
    await tap(page, 'ArrowUp', ms); s = await eric(page);
    check(`A ${ms} ms tap of ↓ sits Eric on the floor and ↑ stands him up`, sat && s.as === 'WALK0', `sat ${sat}, then ${s.as}`);
  }
  await page.evaluate(() => { const d = window.bts.game.world.getRoom('BlueRoom').desks.find((d) => d.x === 21); d.empty(); d.insert('WATER_PISTOL'); });
  await put(page, 21, 3, -1); await tap(page, 'ArrowDown', 80);
  { const s = await eric(page); check('↓ at a chair sits Eric on it', s.as === 'SITTING_ON_CHAIR', s.as); }
  await tap(page, 'ArrowDown', 80, 1500);
  { const s = await eric(page); check('↓ again lifts the desk lid and Eric takes what is inside', s.inv.includes('WATER_PISTOL'), s.inv.join(',')); }
  await tap(page, 'ArrowUp', 80);
  { const s = await eric(page); check('↑ stands him up from the chair', s.as === 'WALK0', s.as); }
  await page.evaluate(() => { const e = window.bts.game.cast.eric; e.inventory.clear(); e.inventoryChanged(); });

  // Jump, fire, punch, drop.
  for (const ms of TAPS) {
    await put(page, 40, 17, 1);
    await watch(page, 'jump', (g, e) => e.y < 17);
    await tap(page, 'Space', ms, 900);
    let s = await eric(page); check(`A ${ms} ms tap of Space jumps and lands`, (await seen(page, 'jump')) && s.y === 17 && s.as === 'WALK0', `(${s.x},${s.y}) ${s.as}`);
    await put(page, 40, 17, 1);
    await watch(page, 'pellet', (g, e) => e.pellet.visible);
    await tap(page, 'KeyX', ms, 1200);
    s = await eric(page); check(`A ${ms} ms tap of X fires the catapult and Eric lowers it`, (await seen(page, 'pellet')) && s.as === 'WALK0' && !s.ctl, `${s.as} ${s.ctl}`);
    await put(page, 40, 17, 1);
    await watch(page, 'fist', (g, e) => e.animatoryState === 'HITTING1');
    await tap(page, 'KeyC', ms, 900);
    s = await eric(page); check(`A ${ms} ms tap of C throws a punch`, (await seen(page, 'fist')) && s.as === 'WALK0' && !s.ctl, `${s.as} ${s.ctl}`);
  }
  await put(page, 40, 17, 1);
  await page.evaluate(() => { const e = window.bts.game.cast.eric; e.inventory.add('STINKBOMBS3'); e.inventoryChanged(); });
  await watch(page, 'stink', (g) => g.cast.stinkbomb.visible);
  await tap(page, 'KeyV', 80, 900);
  { const s = await eric(page); check('V drops a stinkbomb and uses one up', (await seen(page, 'stink')) && s.inv.includes('STINKBOMBS2') && s.as === 'WALK0', `${s.inv.join(',')} ${s.as}`); }
  await page.evaluate(() => { const e = window.bts.game.cast.eric; e.inventory.clear(); e.inventoryChanged(); window.bts.game.cast.stinkbomb.hide(); });

  // Keys pressed while another action is under way are not lost.
  await put(page, 40, 17, 1);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300);
  await watch(page, 'pellet2', (g, e) => e.pellet.visible);
  await page.keyboard.press('KeyX', { delay: 40 }); await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowRight'); await page.waitForTimeout(400);
  { const s = await eric(page); check('X tapped while walking fires, and Eric then walks on', (await seen(page, 'pellet2')) && s.x > 43, `x=${s.x}`); }

  // Writing on a blackboard.
  await page.evaluate(() => window.bts.game.world.getRoom('BlueRoom').blackboard.wipeAll?.());
  await put(page, 5, 3, 1);
  await tap(page, 'KeyC', 80, 400);
  { const s = await eric(page); check('C beside a blackboard starts writing', s.writing, `${s.as} ${s.ctl}`); }
  await watch(page, 'strayPellet', (g, e) => e.pellet.visible);
  await watch(page, 'strayJump', (g, e) => e.y < 3);
  await page.keyboard.type('xc z1', { delay: 90 }); await page.waitForTimeout(500);
  { const text = await page.evaluate(() => window.bts.game.world.getRoom('BlueRoom').blackboard.lines.join('|'));
    check('Letters typed at the board are written, not acted on', /xc z1/i.test(text) && !(await seen(page, 'strayPellet')) && !(await seen(page, 'strayJump')), JSON.stringify(text)); }
  await tap(page, 'Enter', 60, 500);
  { const s = await eric(page); check('Enter finishes the writing', !s.writing && s.as === 'WALK0', `${s.writing} ${s.as} ${s.ctl}`); }
  await put(page, 5, 3, 1); await page.evaluate(() => { const b = window.bts.game.world.getRoom('BlueRoom').blackboard; b.lines = ['', '']; b.clear?.(); });
  await tap(page, 'KeyC', 80, 400); await page.keyboard.type('ab', { delay: 90 });
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(400);
  { const s = await eric(page); check('A cursor key ends the writing and walks Eric away', !s.writing && s.x > 5, `writing ${s.writing} x=${s.x}`); }

  // The bike.
  await page.evaluate(() => window.bts.game.cast.unchainBike());
  { const bx = await page.evaluate(() => window.bts.game.cast.bike.x);
    // As in 1985, Eric topples off within half a second unless he starts pedalling.
    await put(page, bx, 17, 1); await tap(page, 'KeyC', 80, 60);
    let s = await eric(page); check('C beside the bike mounts it', s.ctl === 'RideBike', `${s.as} ${s.ctl}`);
    for (let i = 0; i < 12; i++) await tap(page, i % 2 ? 'ArrowLeft' : 'ArrowRight', 50, 110);
    s = await eric(page); check('Tapping → and ← in turn pedals the bike along', s.x > bx + 3 && s.ctl === 'RideBike', `x ${bx} -> ${s.x} ${s.ctl}`);
    for (let i = 0; i < 8; i++) await tap(page, i % 2 ? 'ArrowLeft' : 'ArrowRight', 50, 110);
    await tap(page, 'ArrowUp', 60, 250);
    s = await eric(page); const stood = s.y === 16;
    await tap(page, 'Space', 60, 3500);
    s = await eric(page); check('↑ stands Eric on the saddle, Space jumps off, and he ends on his feet', stood && s.y === 17 && !s.ctl && (s.as === 'WALK0' || s.as === 'SITTING_ON_FLOOR'), `stood ${stood}; (${s.x},${s.y}) ${s.as} ${s.ctl}`);
    await page.waitForTimeout(2500); await tap(page, 'ArrowUp', 60, 500);
    s = await eric(page); check('After the tumble Eric is standing and answers the keys', s.as === 'WALK0', s.as);
  }
  await page.evaluate(() => window.bts.game.cast.unchainBike());
  { const bx = await page.evaluate(() => window.bts.game.cast.bike.x);
    await put(page, bx, 17, 1); await tap(page, 'KeyC', 80, 60); await tap(page, 'ArrowDown', 60, 600);
    const s = await eric(page); check('↓ on the saddle gets off the bike', !s.ctl && s.as === 'WALK0', `${s.as} ${s.ctl}`); }

  // Knocked down: gets up by himself, or at once with ↑.
  await put(page, 40, 17, 1); await page.evaluate(() => window.bts.game.cast.eric.deck());
  await tap(page, 'ArrowUp', 80, 500);
  { const s = await eric(page); check('↑ gets Eric up after he is knocked down', s.as === 'WALK0', s.as); }
  await put(page, 40, 17, 1); await page.evaluate(() => window.bts.game.cast.eric.deck());
  await page.waitForTimeout(4500);
  { const s = await eric(page); check('Left alone, he gets up by himself', s.as === 'WALK0', s.as); }

  // The page itself: keys must not scroll it, and losing focus must let go of them.
  await put(page, 40, 17, 1);
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const key of ['ArrowDown', 'Space', 'ArrowUp', 'ArrowDown']) await tap(page, key, 60, 150);
  check('The arrow keys and Space do not scroll the page', (await page.evaluate(() => window.scrollY)) === 0, `scrollY ${await page.evaluate(() => window.scrollY)}`);
  await tap(page, 'ArrowUp', 60, 400);
  await put(page, 40, 17, 1);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForTimeout(300); const x1 = (await eric(page)).x; await page.waitForTimeout(600); const x2 = (await eric(page)).x;
  await page.keyboard.up('ArrowRight');
  check('If the window loses focus, a held key is let go', x1 === x2, `${x1} -> ${x2}`);

  check('No errors on the page during the controls checks', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll browser checks passed');
process.exit(failures ? 1 : 0);
