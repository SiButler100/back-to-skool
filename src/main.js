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
import { Renderer } from './render/renderer.js';
import { Input, DEFAULT_BINDINGS } from './ui/input.js';
import { HUD } from './ui/hud.js';
import { Menu } from './ui/menu.js';
import { Sound } from './ui/sound.js';
import { measureText, fontHas } from './render/font.js';
import { setupFeatures } from './features/index.js';
import { CONFIG } from './config.js';

const DEFAULT_SETTINGS = {
  theme: 'modern', speed: 1, columns: CONFIG.viewportColumns, smoothMotion: true, retroScroll: false,
  freezeOnMessages: true, sound: true,
};

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('bts.settings') || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
function saveSettings(s) { try { localStorage.setItem('bts.settings', JSON.stringify(s)); } catch (e) { /* ignore */ } }

export function boot() {
  const settings = loadSettings();
  const input = new Input(DEFAULT_BINDINGS);
  input.attach(window);
  const game = new Game({ input, measureText, fontHas });
  const canvas = document.getElementById('game');
  const renderer = new Renderer(canvas, game, { theme: settings.theme, smoothMotion: settings.smoothMotion, retroScroll: settings.retroScroll, viewportColumns: settings.columns });
  const hud = new HUD(document.getElementById('hud'), game);
  const sound = new Sound();
  game.events.on('sound', (id) => sound.play(id));

  let paused = true;
  const menu = new Menu(document.getElementById('overlay'), {
    settings,
    bindings: DEFAULT_BINDINGS,
    onApply: (s) => { applySettings(s); saveSettings(s); },
    onNewGame: () => { game.start(); paused = false; input.enabled = true; sound.ensure(); },
    onResume: () => { paused = false; input.enabled = true; },
    onQuit: () => { paused = true; menu.show('title'); },
  });

  function applySettings(s) {
    if (renderer.options.theme !== s.theme) renderer.setTheme(s.theme);
    renderer.options.smoothMotion = s.smoothMotion;
    renderer.options.retroScroll = s.retroScroll;
    if (renderer.columns !== s.columns) renderer.resize(s.columns);
    game.config.freezeOnMessages = s.freezeOnMessages;
    sound.enabled = s.sound;
    fitCanvas();
  }

  // Scale the canvas to the available width in whole pixels for crisp pixels.
  function fitCanvas() {
    const stage = document.getElementById('stage');
    const avail = stage.clientWidth || window.innerWidth;
    // Half-pixel steps keep pixels reasonably even while using the width well.
    const scale = Math.max(1, Math.floor((avail / canvas.width) * 2) / 2);
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
  }
  window.addEventListener('resize', fitCanvas);

  // Pause key / menu button
  const togglePause = () => {
    if (!game.started || game.gameOver) return;
    if (menu.isOpen) { menu.hide(); paused = false; input.enabled = true; }
    else { paused = true; input.enabled = false; menu.show('pause'); }
  };
  input.onMenu(togglePause);
  document.getElementById('hud-menu').addEventListener('click', () => { if (game.started && !game.gameOver) togglePause(); else menu.show('title'); });
  game.events.on('gameOver', (data) => { paused = true; input.enabled = false; setTimeout(() => menu.show('gameover', data), 600); });

  // Features
  setupFeatures({ game, renderer, hud, input, settings });

  applySettings(settings);
  menu.show('title');

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
  window.bts = { game, renderer, hud, menu, settings, input };
  return window.bts;
}

boot();
