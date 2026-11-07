// ============================================================================
// MENUS (title screen, pause, options, controls, how to play, game over)
// ----------------------------------------------------------------------------
// One overlay element, several "screens". The options screen reads and writes
// a settings object; main.js applies the settings to the game and renderer.
// ============================================================================

import { ACTION_LABELS } from './input.js';

const RULES = [
  'Boys shall attend lessons as shown in the timetable at the top of the screen.',
  'Boys do not score points by attending lessons, but may be given lines if caught in the wrong place.',
  'Boys who acquire over 10,000 lines shall be expelled immediately from the school.',
  'Boys are not allowed to enter the staffroom, the head\'s study, or the girls\' school. Take care.',
  'At playtime, boys are supposed to be playing and not in any of the classrooms.',
  'Boys shall not hit their schoolmates. Boys shall not fire catapults.',
  'School dinners are compulsory. Boys will be neat and polite at all times.',
];

const NOTES = [
  'Key to safe round nek of gurls hedmistris. She hates frogs.',
  'Put frog in cup in gurls kitchin so you can nock it down onto her hed. Remmember the bike.',
  'Frogs ar kept in loked siense lab stor room. Combernasion letters held by masters - get them drunk.',
  'Sherry in hedmistris\'s cubord - only unloked wen sheez shure all the boys ar back in skool.',
  'Fill water pistle by jumping up to botel. Put sherry in skool cups and use catopult to nock cups onto masters.',
  'Stink boms - Hed will open window if you drop one wen heez near.',
  'Cairtaker - if you nock him out with a conker by firing catopult from top window of skool, yool be able to get passed him.',
  'Bike - chaned to conker tree - 4 number combernasion has to be ritten on blackbord to relees it. Each master nose 1 number - soke them with water by nocking water-filled cups with catopult wilst they ar under.',
  'Water pistle and stink boms - hidden in desks. Remmember ther ar desks in the gurls skool too.',
  'Water makes flours grow. Catching mice is fun. Letting them go in the gurls skool is even funier.',
  'If you get lots of lines to do, try being ekstra nice to your gurlfrend!',
  'Only the Hed can open the study dore - yool have to jump up to reech the safe.',
];

export class Menu {
  constructor(root, { settings, onApply, onNewGame, onResume, onQuit, bindings }) {
    this.root = root;
    this.settings = settings;
    this.onApply = onApply; this.onNewGame = onNewGame; this.onResume = onResume; this.onQuit = onQuit;
    this.bindings = bindings;
    this.screen = null;
    this.root.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action) this.handle(action);
    });
    this.root.addEventListener('change', (e) => {
      const key = e.target.dataset.setting;
      if (!key) return;
      const v = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'range' ? Number(e.target.value) : e.target.value);
      this.settings[key] = v;
      this.onApply(this.settings, key);
      if (e.target.type === 'range') this.root.querySelector(`[data-out="${key}"]`).textContent = formatSetting(key, v);
      if (key === 'view') this.show('options', this.data);   // the preset changed the other controls
    });
    this.root.addEventListener('input', (e) => {
      const key = e.target.dataset.setting;
      if (key && e.target.type === 'range') this.root.querySelector(`[data-out="${key}"]`).textContent = formatSetting(key, Number(e.target.value));
    });
  }

  get isOpen() { return this.screen !== null; }

  show(screen, data = {}) {
    this.screen = screen;
    this.data = data;
    this.root.hidden = false;
    this.root.innerHTML = `<div class="menu-card">${this[`render_${screen}`](data)}</div>`;
    this.root.querySelector('button')?.focus();
  }

  hide() { this.screen = null; this.root.hidden = true; this.root.innerHTML = ''; }

  handle(action) {
    switch (action) {
      case 'new': this.hide(); this.onNewGame(); break;
      case 'resume': this.hide(); this.onResume(); break;
      case 'quit': this.hide(); this.onQuit(); break;
      case 'options': this.show('options', { back: this.data.back || this.screen }); break;
      case 'controls': this.show('controls', { back: this.data.back || this.screen }); break;
      case 'howto': this.show('howto', { back: this.data.back || this.screen }); break;
      case 'back': this.show(this.data.back || 'title'); break;
      default: break;
    }
  }

  render_title() {
    return `
      <p class="eyebrow">A faithful remake, rebuilt to be modified</p>
      <h1>Back to Skool</h1>
      <p class="lede">Eric has forged his report over the holidays. Now he has to get it back into the Head's safe before anyone notices.</p>
      <div class="menu-actions">
        <button type="button" data-action="new" class="primary">New game</button>
        <button type="button" data-action="howto">How to play</button>
        <button type="button" data-action="controls">Controls</button>
        <button type="button" data-action="options">Options</button>
      </div>
      <p class="small">Original game © 1985 Microsphere (David Reidy &amp; Keith Warrington). This remake is unofficial fan work.</p>`;
  }

  render_pause() {
    return `
      <h1>Paused</h1>
      <div class="menu-actions">
        <button type="button" data-action="resume" class="primary">Resume</button>
        <button type="button" data-action="howto">How to play</button>
        <button type="button" data-action="controls">Controls</button>
        <button type="button" data-action="options">Options</button>
        <button type="button" data-action="new">Restart</button>
        <button type="button" data-action="quit">Quit to title</button>
      </div>`;
  }

  render_gameover({ upAYear, score, lines }) {
    return `
      <p class="eyebrow">${upAYear ? 'Congratulations' : 'Oh dear'}</p>
      <h1>${upAYear ? 'Onto the next year!' : "You're expelled"}</h1>
      <p class="lede">${upAYear ? 'The report is safely back in the safe. Nobody will ever know.' : 'Ten thousand lines was always going to be too many.'}</p>
      <p>Score ${score.toLocaleString('en-GB')} · Lines ${lines.toLocaleString('en-GB')}</p>
      <div class="menu-actions">
        <button type="button" data-action="new" class="primary">Play again</button>
        <button type="button" data-action="quit">Back to title</button>
      </div>`;
  }

  render_options() {
    const s = this.settings;
    const check = (key, label, help) => `<label class="opt"><input type="checkbox" data-setting="${key}" ${s[key] ? 'checked' : ''}><span>${label}</span><small>${help}</small></label>`;
    return `
      <h1>Options</h1>
      <div class="options">
        <label class="opt"><span>View</span>
          <select data-setting="view"><option value="modern" ${s.view === 'modern' ? 'selected' : ''}>Modern</option><option value="original" ${s.view === 'original' ? 'selected' : ''}>Original (1985)</option></select>
          <small>Press V in the game to switch. Choosing a view resets the advanced options below to that view's defaults.</small></label>
        <label class="opt"><span>Game speed <output data-out="speed">${formatSetting('speed', s.speed)}</output></span><input type="range" min="0.5" max="2" step="0.1" value="${s.speed}" data-setting="speed"></label>
        ${check('sound', 'Sound', 'Synthesised beeps.')}
      </div>
      <h2>Advanced</h2>
      <div class="options">
        <label class="opt"><span>Palette</span>
          <select data-setting="theme"><option value="modern" ${s.theme === 'modern' ? 'selected' : ''}>Modern</option><option value="spectrum" ${s.theme === 'spectrum' ? 'selected' : ''}>Spectrum</option></select></label>
        <label class="opt"><span>View width <output data-out="columns">${formatSetting('columns', s.columns)}</output></span><input type="range" min="32" max="96" step="8" value="${s.columns}" data-setting="columns"><small>32 columns is what the original showed.</small></label>
        ${check('originalGraphics', 'Original 1985 graphics', 'The Spectrum game\'s own school, sprites and font, loaded from your own tape image or snapshot in the original view.')}
        ${check('retroStatus', 'Status rows on the canvas', 'Score, lines and lesson drawn under the play area, as in 1985.')}
        ${check('smoothMotion', 'Smooth motion', 'Ease sprites between steps instead of 8-pixel hops.')}
        ${check('retroScroll', 'Retro scrolling', 'Jump the view by 8 columns like the original.')}
        ${check('freezeOnMessages', 'Freeze while lines are given', 'The original froze the whole school for each reprimand.')}
      </div>
      <div class="menu-actions"><button type="button" data-action="back" class="primary">Back</button></div>`;
  }

  render_controls() {
    const rows = Object.entries(ACTION_LABELS).map(([action, label]) => `<tr><td>${this.bindings[action].map(pretty).join(' or ')}</td><td>${label}</td></tr>`).join('');
    return `
      <h1>Controls</h1>
      <p class="lede">Four directions and three actions. The game works out which tool fits what is in front of Eric.</p>
      <table class="keys"><tbody>${rows}</tbody></table>
      <p class="small">Writing on a blackboard: stand beside it, press the act key, type, then press Enter. Eric gets up by himself after being knocked down (or press up). Riding the bike: alternate left and right to pedal, up to stand on the saddle, down to dismount, jump from the saddle to reach a high cup. When Mr Wacker has something to tell you, press the act key to show you understood.</p>
      <div class="menu-actions"><button type="button" data-action="back" class="primary">Back</button></div>`;
  }

  render_howto() {
    return `
      <h1>How to play</h1>
      <h2>School rules</h2>
      <ul class="rules">${RULES.map((r) => `<li>${r}</li>`).join('')}</ul>
      <h2>Your brother's notes (in invisible ink)</h2>
      <ul class="rules notes">${NOTES.map((r) => `<li>${r}</li>`).join('')}</ul>
      <div class="menu-actions"><button type="button" data-action="back" class="primary">Back</button></div>`;
  }
}

function pretty(code) {
  return code.replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓')
    .replace('Key', '').replace('Escape', 'Esc');
}
function formatSetting(key, v) {
  if (key === 'speed') return `${v.toFixed(1)}×`;
  if (key === 'columns') return `${v} columns`;
  return String(v);
}
