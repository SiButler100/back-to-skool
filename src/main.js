// ============================================================================
// MAIN (boots everything and runs the loop)
// ----------------------------------------------------------------------------
// 1. Build the Game (pure logic), the Renderer (canvas), the HUD and menus.
// 2. Load saved settings and apply them.
// 3. Start the features from src/features/.
// 4. Run a fixed-step loop: the game logic ticks a set number of times per
//    second whatever the screen refresh rate; the renderer draws every frame.
// ============================================================================

import { Game } from './engine/game.js';
import { Renderer, originalMeasure, originalFontHas } from './render/renderer.js';
import { Input, DEFAULT_BINDINGS } from './ui/input.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { Sound } from './ui/sound.js';
import { TapeLoader } from './ui/tape-loader.js';
import { measureText, fontHas } from './render/font.js';
import { setupFeatures } from './features/index.js';
import { CONFIG } from './config.js';
import { SKOOL } from './data/skool.js';

// Two presets. "original" is the 1985 screen: 32 columns, Spectrum colours,
// 8-pixel steps, scrolling in jumps, status rows on the canvas. "modern" is
// the wide, smooth, HUD-and-sidebar version. The advanced options let you mix.
// The close camera shows the same width as the 1985 screen (32 columns) and
// two storeys; the whole-school camera is wider and shows all three.
const CLOSE_COLUMNS = 32, WHOLE_COLUMNS = CONFIG.viewportColumns;
export const VIEW_PRESETS = {
  original: { theme: 'spectrum', columns: 32, smoothMotion: false, retroScroll: true, freezeOnMessages: true, retroStatus: true, originalGraphics: true, artwork: 'painted', camera: 'whole' },
  modern: { theme: 'modern', columns: CLOSE_COLUMNS, camera: 'close', smoothMotion: true, retroScroll: false, freezeOnMessages: true, retroStatus: false, originalGraphics: false, artwork: 'illustrated' },
};

const SETTINGS_VERSION = 6;      // 5: the map and radar switches; 6: aiming help (defaults are filled in from DEFAULT_SETTINGS)
const DEFAULT_SETTINGS = { view: 'modern', speed: 1, sound: true, music: true, minimap: true, radar: false, guides: true, settingsVersion: SETTINGS_VERSION, ...VIEW_PRESETS.modern };

// Settings saved by an older version of the game get the new keys filled in.
function migrateSettings(s) {
  const v = s.settingsVersion || 1;
  if (v < 2) s.hdGraphics = s.view !== 'original';      // HD pixel art arrived in version 2
  if (v < 3) { s.artwork = s.hdGraphics === false ? 'painted' : 'illustrated'; delete s.hdGraphics; }   // illustrated artwork in version 3
  if (v < 4) { s.camera = s.view === 'original' ? 'whole' : 'close'; if (s.camera === 'close') s.columns = CLOSE_COLUMNS; }   // the close camera in version 4
  s.settingsVersion = SETTINGS_VERSION;
  return s;
}
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('bts.settings') || 'null');
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SETTINGS };
    // The saved version is read before the defaults are merged in: a save from
    // before versions existed has none, and must count as version 1, not the latest.
    return migrateSettings({ ...DEFAULT_SETTINGS, ...saved, settingsVersion: saved.settingsVersion || 1 });
  } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) { try { localStorage.setItem('bts.settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }

export function boot() {
  const settings = loadSettings();
  const input = new Input(DEFAULT_BINDINGS);
  input.attach(window);
  const game = new Game({ input, measureText, fontHas });
  const canvas = document.getElementById('game');
  const renderer = new Renderer(canvas, game, { theme: settings.theme, smoothMotion: settings.smoothMotion, retroScroll: settings.retroScroll, viewportColumns: settings.columns, retroStatus: settings.retroStatus, originalGraphics: settings.originalGraphics, artwork: settings.artwork, camera: settings.camera, onResize: () => fitCanvas() });
  const hud = new HUD(document.getElementById('hud'), game, DEFAULT_BINDINGS);
  const tapeLoader = new TapeLoader(document.getElementById('tape'), renderer, (loaded) => {
    tapeLoader.update(settings.view); hud.setGraphicsStatus(settings.view, renderer.original.ready);
    // The loader's own panel closes as soon as it succeeds, so the news goes in the event log.
    hud.log(loaded ? 'The 1985 graphics are loaded.' : 'The 1985 graphics have been put away.', true);
  });
  const sound = new Sound();
  game.events.on('sound', (id) => sound.play(id));
  game.events.on('cupEmpty', () => sound.play('CUP_EMPTY'));   // a pellet rattling through a cup with nothing in it
  renderer.onFootstep = () => sound.step();
  // Pocket icons: the illustrated ones when that artwork is showing, pixel art otherwise.
  hud.setIconSource((id) => (settings.view !== 'original' && settings.artwork === 'illustrated' ? renderer.assets.iconUrl(id) : null));
  renderer.assets.onReady(() => hud.setIconSource(hud.iconSource));
  // Birdsong while Eric is out in the playground.
  game.events.on('tick', () => {
    const e = game.cast.eric;
    sound.setOutdoors(e.y === 17 && e.x >= SKOOL.playground[0] && e.x <= SKOOL.playground[1]);
    // The murmur of a crowd: pupils on their feet near Eric on his floor (a class sitting down is quiet).
    let near = 0;
    for (const c of game.cast.characters) if (!c.isAdult() && c.isStanding() && Math.abs(c.x - e.x) < 14 && Math.abs(c.y - e.y) < 3) near++;
    sound.setCrowd(near / 6);
  });

  let paused = true;
  let gameOverShown = 0;           // counts new games and quits, so a late "game over" card is not shown over them
  // "Attract" mode: behind the title screen the school runs by itself (no
  // input, no sound) while the view pans across it.
  let attract = false;
  const setAttract = (on) => { attract = on; renderer.options.attract = on; if (on) { game.start(); input.enabled = false; } };
  const menu = new Menu(document.getElementById('overlay'), {
    settings,
    bindings: DEFAULT_BINDINGS,
    onApply: (s, changedKey) => {
      if (changedKey === 'view') Object.assign(s, VIEW_PRESETS[s.view]);
      if (changedKey === 'camera') s.columns = s.camera === 'close' ? CLOSE_COLUMNS : WHOLE_COLUMNS;   // each camera has its natural width
      applySettings(s); saveSettings(s);
    },
    onNewGame: () => { gameOverShown += 1; setAttract(false); input.reset(); game.start(); paused = false; input.enabled = true; sound.ensure(); },
    onResume: () => { paused = false; input.enabled = true; },
    onQuit: () => { gameOverShown += 1; paused = true; menu.show('title'); setAttract(true); },
  });

  function applySettings(s) {
    if (renderer.options.theme !== s.theme) renderer.setTheme(s.theme);
    renderer.options.smoothMotion = s.smoothMotion;
    renderer.options.gameSpeed = s.speed;       // the motion smoothing needs to know how long a tick lasts
    renderer.options.retroScroll = s.retroScroll;
    if (renderer.columns !== s.columns || renderer.options.retroStatus !== s.retroStatus) renderer.resize(s.columns, s.retroStatus);
    game.config.freezeOnMessages = s.freezeOnMessages;
    renderer.options.originalGraphics = !!s.originalGraphics;
    renderer.options.artwork = s.artwork || 'illustrated';
    renderer.options.camera = s.camera || 'whole';
    renderer.options.guides = s.view !== 'original' && s.guides !== false;   // aiming help belongs to the modern view only
    // Blackboard wrapping and bubble timing follow whichever font is on screen.
    game.measureText = s.originalGraphics ? originalMeasure : measureText;
    game.fontHas = s.originalGraphics ? originalFontHas : fontHas;
    sound.enabled = s.sound; sound.musicEnabled = s.music !== false;
    document.documentElement.classList.toggle('view-original', s.view === 'original');
    document.documentElement.classList.toggle('view-modern', s.view !== 'original');
    document.documentElement.classList.toggle('art-illustrated', s.view !== 'original' && s.artwork === 'illustrated');
    document.documentElement.classList.toggle('hide-minimap', s.minimap === false);
    document.documentElement.classList.toggle('show-radar', !!s.radar);
    hud.setView(s.view);
    tapeLoader.update(s.view);
    hud.setGraphicsStatus(s.view, renderer.original.ready);
    fitCanvas();
  }

  // Tab (or the button in the key strip) flips between the two presets.
  function toggleView() {
    settings.view = settings.view === 'original' ? 'modern' : 'original';
    Object.assign(settings, VIEW_PRESETS[settings.view]);
    applySettings(settings); saveSettings(settings);
    if (menu.isOpen && menu.screen === 'options') menu.show('options', menu.data);
  }
  input.onView(toggleView);
  hud.onToggleView(toggleView);

  // Scale the canvas as large as the window allows: the whole play screen
  // fills the first screenful, and the plan and the key strip sit below it
  // (scroll down to read them).
  function fitCanvas() {
    const stage = document.getElementById('stage');
    const border = settings.view === 'original' ? 48 : 0;   // the Spectrum's blue border
    const avail = (stage.clientWidth || window.innerWidth) - border;
    const illustrated = settings.view !== 'original' && settings.artwork === 'illustrated';
    // Pixel art wants even steps (half pixels at worst); illustrations scale freely.
    const step = (v) => (illustrated ? v : Math.floor(v * 2) / 2);
    let scale = Math.max(0.25, step(avail / canvas.width));
    // Height: everything above the stage (the HUD in the modern view) plus a small margin.
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const availH = window.innerHeight - top - border - 12;
    scale = Math.min(scale, Math.max(0.25, step(availH / canvas.height)));
    if (settings.view === 'original') scale = Math.max(1, Math.floor(scale));   // whole pixels for the original
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
    document.documentElement.style.setProperty('--screen-width', canvas.style.width);   // the HUD strip matches it
  }
  window.addEventListener('resize', fitCanvas);

  // Pause key / menu button
  const togglePause = () => {
    if (attract || !game.started || game.gameOver) return;
    if (menu.isOpen) { menu.hide(); paused = false; input.enabled = true; }
    else { paused = true; input.enabled = false; menu.show('pause'); }
  };
  input.onMenu(togglePause);
  hud.onMenu(() => { if (attract) return; if (game.started && !game.gameOver) togglePause(); else { gameOverShown += 1; menu.show('title'); setAttract(true); } });
  game.events.on('gameOver', (data) => {
    if (attract) { game.start(); return; }             // nobody is playing: just start the term again
    // The card follows the last moment of play by a beat, unless the player
    // has already gone to the title screen or started again in that time.
    const mine = gameOverShown;
    paused = true; input.enabled = false; setTimeout(() => { if (mine === gameOverShown && game.gameOver) menu.show('gameover', data); }, 600);
  });

  // Features
  setupFeatures({ game, renderer, hud, input, settings });

  applySettings(settings);
  menu.show('title');
  setAttract(true);
  let polls = 0;
  const poll = setInterval(() => { tapeLoader.update(settings.view); hud.setGraphicsStatus(settings.view, renderer.original.ready); if (++polls > 10) clearInterval(poll); }, 500);

  // A hidden tab stops drawing (and so stops the game), but timers carry on:
  // hush the sound at once and let go of any held key.
  document.addEventListener('visibilitychange', () => { if (document.hidden) { sound.setActive(false); input.held.clear(); } });

  // The loop
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    sound.setActive(!paused && !attract);
    if (!paused || attract) {
      acc += dt * (attract ? 1 : settings.speed);
      const step = 1 / game.config.ticksPerSecond;
      let guard = 0;
      while (acc >= step && guard++ < 10) { game.tick(); acc -= step; }
    }
    renderer.draw(now);
    hud.update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose for the console and for tests.
  window.bts = { game, renderer, hud, menu, settings, input, tapeLoader, sound };
  return window.bts;
}

boot();
