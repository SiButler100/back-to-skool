// ============================================================================
// HUD (score, lines, lesson box, inventory, event log, key strip)
// ----------------------------------------------------------------------------
// Plain HTML around the game canvas. It listens to game events and updates
// the DOM; it never touches game state. Features (src/features/) can add
// their own panels with hud.addPanel(title, element).
//
// The key strip under the canvas is always visible, in both views.
// ============================================================================

const ITEM_ICONS = {
  SAFE_KEY: ['🗝️', 'Safe key'],
  STOREROOM_KEY: ['🔑', 'Storeroom key'],
  FROG: ['🐸', 'Frog'],
  WATER_PISTOL: ['🔫', 'Water pistol (water)'],
  SHERRY_PISTOL: ['🍷', 'Water pistol (sherry)'],
  STINKBOMBS3: ['💣💣💣', 'Three stinkbombs'],
  STINKBOMBS2: ['💣💣', 'Two stinkbombs'],
  STINKBOMBS1: ['💣', 'One stinkbomb'],
};

export class HUD {
  constructor(root, game, bindings) {
    this.root = root;
    this.game = game;
    this.bindings = bindings;
    this.logLimit = 8;
    this.menuHandlers = []; this.viewHandlers = [];
    this.build();
    this.bind();
  }

  build() {
    this.root.innerHTML = `
      <header class="hud-top">
        <div class="lesson-box" title="Where Eric is meant to be this period">
          <div class="lesson-teacher" id="hud-teacher">&nbsp;</div>
          <div class="lesson-room" id="hud-room">&nbsp;</div>
          <div class="lesson-bar"><div class="lesson-bar-fill" id="hud-clock"></div></div>
        </div>
        <div class="stats">
          <div class="stat"><span class="stat-label">Score</span><span class="stat-value" id="hud-score">0</span></div>
          <div class="stat stat-lines"><span class="stat-label">Lines</span><span class="stat-value" id="hud-lines">0</span></div>
          <div class="stat"><span class="stat-label">Hi-score</span><span class="stat-value" id="hud-hiscore">0</span></div>
        </div>
        <div class="inventory" id="hud-inventory" title="What Eric is carrying"></div>
        <button class="menu-button" id="hud-menu" type="button" title="Menu (Esc)">Menu</button>
      </header>`;
    this.el = {
      teacher: this.root.querySelector('#hud-teacher'),
      room: this.root.querySelector('#hud-room'),
      clock: this.root.querySelector('#hud-clock'),
      score: this.root.querySelector('#hud-score'),
      lines: this.root.querySelector('#hud-lines'),
      hiscore: this.root.querySelector('#hud-hiscore'),
      inventory: this.root.querySelector('#hud-inventory'),
      menu: this.root.querySelector('#hud-menu'),
    };
    this.el.menu.addEventListener('click', () => this.menuHandlers.forEach((h) => h()));
    this.sidebar = document.getElementById('sidebar');
    this.logEl = this.addPanel('What just happened', document.createElement('ul'));
    this.logEl.className = 'event-log';
    this.buildKeyStrip();
  }

  // The permanent reminder of the controls, under the canvas.
  buildKeyStrip() {
    const strip = document.getElementById('keys');
    const key = (action) => {
      const codes = this.bindings[action];
      return codes.map(pretty).join('/');
    };
    strip.innerHTML = `
      <span class="k"><kbd>${key('left')}</kbd><kbd>${key('right')}</kbd> walk</span>
      <span class="k"><kbd>${key('up')}</kbd> up stairs · stand</span>
      <span class="k"><kbd>${key('down')}</kbd> down stairs · sit · open desk</span>
      <span class="k"><kbd>${key('jump')}</kbd> jump</span>
      <span class="k"><kbd>${key('fire')}</kbd> fire</span>
      <span class="k"><kbd>${key('act')}</kbd> act</span>
      <span class="k ui"><kbd>Esc</kbd> menu</span>
      <button type="button" class="k ui view-toggle" id="view-toggle" title="Switch view (V)"></button>
      <span class="gfx-status" id="gfx-status" hidden></span>`;
    strip.querySelector('#view-toggle').addEventListener('click', () => this.viewHandlers.forEach((h) => h()));
    this.viewToggle = strip.querySelector('#view-toggle');
  }

  onMenu(h) { this.menuHandlers.push(h); }
  onToggleView(h) { this.viewHandlers.push(h); }
  setView(view) {
    this.viewToggle.innerHTML = view === 'original' ? '<kbd>V</kbd> modern view' : '<kbd>V</kbd> original view';
  }
  // The chip in the key strip: are the 1985 graphics loaded?
  setGraphicsStatus(view, loaded) {
    const el = document.getElementById('gfx-status');
    el.hidden = view !== 'original';
    el.textContent = loaded ? '1985 graphics: loaded' : '1985 graphics: NOT loaded (painted stand-ins shown)';
    el.className = `gfx-status ${loaded ? 'on' : 'off'}`;
  }

  // Add a titled panel to the sidebar. Returns the content element.
  addPanel(title, contentEl) {
    const section = document.createElement('section');
    section.className = 'panel';
    const h = document.createElement('h2');
    h.textContent = title;
    section.append(h, contentEl);
    this.sidebar.appendChild(section);
    return contentEl;
  }

  bind() {
    const g = this.game;
    g.events.on('score', ({ score, hiScore }) => { this.el.score.textContent = score.toLocaleString('en-GB'); this.el.hiscore.textContent = hiScore.toLocaleString('en-GB'); });
    g.events.on('linesTotal', ({ lines }) => {
      this.el.lines.textContent = lines.toLocaleString('en-GB');
      this.el.lines.parentElement.classList.toggle('danger', lines >= g.config.maxLines * 0.8);
    });
    g.events.on('lesson', ({ teacher, room }) => { this.el.teacher.textContent = teacher || ' '; this.el.room.textContent = room; this.log(`Bell: ${teacher ? teacher + ' in the ' : ''}${room.toLowerCase()}`); });
    g.events.on('inventory', ({ items, mice }) => this.renderInventory(items, mice));
    g.events.on('lines', ({ giver, recipient, amount, text }) => this.log(`${title(giver.name)} gave ${title(recipient.name)} ${amount} lines: "${sentence(text)}"`));
    g.events.on('decked', ({ character }) => this.log(`${title(character.name)} was knocked ${character.isAdult() ? 'over' : 'out'}`));
    g.events.on('secret', ({ character, secret }) => this.log(`${title(character.name)} let slip: ${secret}`, true));
    g.events.on('found', ({ item }) => this.log(`Eric found: ${describeItem(item)}`, true));
    g.events.on('quest', ({ step }) => this.log(QUEST_TEXT[step] || step, true));
    g.events.on('expelling', () => this.log('Mr Wacker is coming to expel Eric...', true));
    g.events.on('gameOver', ({ upAYear }) => this.log(upAYear ? 'Eric goes up a year!' : 'Eric has been expelled.', true));
    g.events.on('start', () => { this.logEl.innerHTML = ''; this.log('A new term begins. Eric starts in the playground.'); });
  }

  renderInventory(items, mice) {
    const parts = items.map((id) => { const [icon, label] = ITEM_ICONS[id] || ['❔', id]; return `<span class="item" title="${label}">${icon}</span>`; });
    if (mice > 0) parts.push(`<span class="item" title="${mice} mice">🐭×${mice}</span>`);
    this.el.inventory.innerHTML = parts.join('') || '<span class="item empty">pockets empty</span>';
  }

  log(text, highlight = false) {
    const li = document.createElement('li');
    li.textContent = text;
    if (highlight) li.className = 'highlight';
    this.logEl.prepend(li);
    while (this.logEl.children.length > this.logLimit) this.logEl.lastChild.remove();
  }

  // Called every frame for things that change continuously.
  update() {
    this.el.clock.style.width = `${(this.game.timetable.progress() * 100).toFixed(1)}%`;
  }
}

const QUEST_TEXT = {
  bikeUnchained: 'The bike is unchained from the tree!',
  storeroomKey: 'Eric has the key to the science lab storeroom.',
  frogInCup: 'The frog is in the cup. Now get Miss Take underneath it...',
  safeKey: 'Eric has the safe key. Get to the head\'s study!',
  safeOpened: 'The report is back in the safe. Onto the next year!',
};

function describeItem(item) {
  const map = { WATER_PISTOL: 'a water pistol', SHERRY_PISTOL: 'a pistol full of sherry', STINKBOMBS3: 'three stinkbombs', FROG: 'a frog', MOUSE: 'a mouse', SAFE_KEY: 'the safe key', STOREROOM_KEY: 'the storeroom key' };
  return map[item] || item.toLowerCase();
}
function title(name) { return name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' '); }
function sentence(text) { return text[0] + text.slice(1).toLowerCase(); }
function pretty(code) {
  return code.replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓')
    .replace('Key', '').replace('Escape', 'Esc');
}
