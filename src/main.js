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

// Two presets. "original" is the 1985 screen: 32 columns, Spectrum colours,
// 8-pixel steps, scrolling in jumps, status rows on the canvas. "modern" is
// the wide, smooth, HUD-and-sidebar version. The advanced options let you mix.
export const VIEW_PRESETS = {
  original: { theme: 'spectrum', columns: 32, smoothMotion: false, retroScroll: true, freezeOnMessages: true, retroStatus: true, originalGraphics: true, artwork: 'painted' },
  modern: { theme: 'modern', columns: CONFIG.viewportColumns, smoothMotion: true, retroScroll: false, freezeOnMessages: true, retroStatus: false, originalGraphics: false, artwork: 'illustrated' },
};

const SETTINGS_VERSION = 3;
const DEFAULT_SETTINGS = { view: 'modern', speed: 1, sound: true, settingsVersion: SETTINGS_VERSION, ...VIEW_PRESETS.modern };

// Settings saved by an older version of the game get the new keys filled in.
function migrateSettings(s) {
  const v = s.settingsVersion || 1;
  if (v < 2) s.hdGraphics = s.view !== 'original';      // HD pixel art arrived in version 2
  if (v < 3) { s.artwork = s.hdGraphics === false ? 'painted' : 'illustrated'; delete s.hdGraphics; }   // illustrated artwork in version 3
  s.settingsVersion = SETTINGS_VERSION;
  return s;
}
function loadSettings() {
  try { return migrateSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('bts.settings') || '{}') }); } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) { try { localStorage.setItem('bts.settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }

export function boot() {
  const settings = loadSettings();
  const input = new Input(DEFAULT_BINDINGS);
  input.attach(window);
  const game = new Game({ input, measureText, fontHas });
  const canvas = document.getElementById('game');
  const renderer = new Renderer(canvas, game, { theme: settings.theme, smoothMotion: settings.smoothMotion, retroScroll: settings.retroScroll, viewportColumns: settings.columns, retroStatus: settings.retroStatus, originalGraphics: settings.originalGraphics, artwork: settings.artwork, onResize: () => fitCanvas() });
  const hud = new HUD(document.getElementById('hud'), game, DEFAULT_BINDINGS);
  const tapeLoader = new TapeLoader(document.getElementById('tape'), renderer, () => { tapeLoader.update(settings.view); hud.setGraphicsStatus(settings.view, renderer.original.ready); });
  const sound = new Sound();
  game.events.on('sound', (id) => sound.play(id));

  let paused = true;
  const menu = new Menu(document.getElementById('overlay'), {
    settings,
    bindings: DEFAULT_BINDINGS,
    onApply: (s, changedKey) => { if (changedKey === 'view') Object.assign(s, VIEW_PRESETS[s.view]); applySettings(s); saveSettings(s); },
    onNewGame: () => { game.start(); paused = false; input.enabled = true; sound.ensure(); },
    onResume: () => { paused = false; input.enabled = true; },
    onQuit: () => { paused = true; menu.show('title'); },
  });

  function applySettings(s) {
    if (renderer.options.theme !== s.theme) renderer.setTheme(s.theme);
    renderer.options.smoothMotion = s.smoothMotion;
    renderer.options.retroScroll = s.retroScroll;
    if (renderer.columns !== s.columns || renderer.options.retroStatus !== s.retroStatus) renderer.resize(s.columns, s.retroStatus);
    game.config.freezeOnMessages = s.freezeOnMessages;
    renderer.options.originalGraphics = !!s.originalGraphics;
    renderer.options.artwork = s.artwork || 'illustrated';
    // Blackboard wrapping and bubble timing follow whichever font is on screen.
    game.measureText = s.originalGraphics ? originalMeasure : measureText;
    game.fontHas = s.originalGraphics ? originalFontHas : fontHas;
    sound.enabled = s.sound;
    document.documentElement.classList.toggle('view-original', s.view === 'original');
    document.documentElement.classList.toggle('view-modern', s.view !== 'original');
    document.documentElement.classList.toggle('art-illustrated', s.view !== 'original' && s.artwork === 'illustrated');
    hud.setView(s.view);
    tapeLoader.update(s.view);
    hud.setGraphicsStatus(s.view, renderer.original.ready);
    fitCanvas();
  }

  // V (or the button in the key strip) flips between the two presets.
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
    if (!game.started || game.gameOver) return;
    if (menu.isOpen) { menu.hide(); paused = false; input.enabled = true; }
    else { paused = true; input.enabled = false; menu.show('pause'); }
  };
  input.onMenu(togglePause);
  hud.onMenu(() => { if (game.started && !game.gameOver) togglePause(); else menu.show('title'); });
  game.events.on('gameOver', (data) => { paused = true; input.enabled = false; setTimeout(() => menu.show('gameover', data), 600); });

  // Features
  setupFeatures({ game, renderer, hud, input, settings });

  applySettings(settings);
  menu.show('title');
  let polls = 0;
  const poll = setInterval(() => { tapeLoader.update(settings.view); hud.setGraphicsStatus(settings.view, renderer.original.ready); if (++polls > 10) clearInterval(poll); }, 500);

  // The loop
  let last = performance.now(), acc = 0;
  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (!paused) {
      acc += dt * settings.speed;
      const step = 1 / game.config.ticksPerSecond;
      let guard = 0;
      while (acc >= step && guard++ < 10) { game.tick(); acc -= step; }
    }
    renderer.draw();
    hud.update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Expose for the console and for tests.
  window.bts = { game, renderer, hud, menu, settings, input, tapeLoader };
  return window.bts;
}

boot();
