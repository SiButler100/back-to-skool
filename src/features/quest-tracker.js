// ============================================================================
// FEATURE: Quest tracker
// ----------------------------------------------------------------------------
// The original told you nothing; you had to work the puzzle out from the
// scrawled notes. This panel keeps a checklist of what Eric has achieved and
// remembers the combination digits and letters teachers have let slip.
// ============================================================================

const STEPS = [
  ['waterPistol', 'Find the water pistol (open desks while seated)'],
  ['stinkbombs', 'Find the stinkbombs'],
  ['bikeDigits', 'Learn the 4 bike digits (soak teachers with water)'],
  ['bikeUnchained', 'Write the bike combination on a board'],
  ['sherry', 'Fill the pistol with sherry (Miss Take\'s cabinet)'],
  ['storeroomLetters', 'Learn the 4 storeroom letters (sherry on teachers)'],
  ['storeroomKey', 'Write the storeroom combination on a board'],
  ['frog', 'Catch the frog in the storeroom'],
  ['frogInCup', 'Put the frog in the girls\' kitchen cup (from the bike saddle)'],
  ['safeKey', 'Drop the frog on Miss Take to get the safe key'],
  ['safeOpened', 'Jump up to the safe in the head\'s study'],
];

export default {
  id: 'quest-tracker',
  name: 'Quest tracker',
  description: 'A checklist of the report-card caper, plus the digits and letters you have been told.',
  defaultOn: true,
  setup({ game, hud }) {
    const el = document.createElement('div');
    el.className = 'quest';
    hud.addPanel('The plan', el);
    const done = new Set();
    const digits = [], letters = [];

    const render = () => {
      el.innerHTML = `
        <ol>${STEPS.map(([id, text]) => `<li class="${done.has(id) ? 'done' : ''}">${text}</li>`).join('')}</ol>
        <div class="combos">
          <div><span>Bike digits</span><strong>${digits.map((d) => d.value).join(' ') || '—'}</strong><small>${digits.map((d) => d.who).join(', ')}</small></div>
          <div><span>Storeroom letters</span><strong>${letters.map((d) => d.value).join(' ') || '—'}</strong><small>${letters.map((d) => d.who).join(', ')}</small></div>
        </div>`;
    };

    game.events.on('start', () => { done.clear(); digits.length = 0; letters.length = 0; render(); });
    game.events.on('found', ({ item }) => {
      if (item === 'WATER_PISTOL') done.add('waterPistol');
      if (item === 'STINKBOMBS3') done.add('stinkbombs');
      if (item === 'SHERRY_PISTOL') done.add('sherry');
      if (item === 'FROG') done.add('frog');
      render();
    });
    game.events.on('secret', ({ character, secret }) => {
      const who = character.name.split(' ').pop();
      const list = /\d/.test(secret) ? digits : letters;
      if (!list.some((d) => d.who === who)) list.push({ who, value: secret });
      if (digits.length >= 4) done.add('bikeDigits');
      if (letters.length >= 4) done.add('storeroomLetters');
      render();
    });
    game.events.on('quest', ({ step }) => { done.add(step); render(); });
    render();
  },
};
