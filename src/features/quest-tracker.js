// ============================================================================
// FEATURE: Quest tracker
// ----------------------------------------------------------------------------
// The original told you nothing; you had to work the puzzle out from the
// scrawled notes. This strip under the game lists the eleven steps of the
// report-card caper, ticks each one off as Eric completes it, and gives a
// hint when you hover over a step. It also remembers the combination digits
// and letters the masters have let slip.
//
// It is shown in both views (it sits above the key strip, not in the sidebar).
// ============================================================================

// Each step: id, short label, hint. The hint may use {digits} / {letters},
// replaced with what Eric has learnt so far.
const STEPS = [
  ['waterPistol', 'Water pistol',
    'It is hidden in one of the desks. Sit at a desk (↓), then press ↓ again to lift the lid. Keep trying desks until you find it.'],
  ['stinkbombs', 'Stinkbombs',
    'Also in a desk, in any room. You get three. You will need one later to make Mr Wacker open a window.'],
  ['bikeDigits', 'Four bike digits',
    'Fill a cup by the toilets with the pistol (X from the ground floor), then knock the cup with the catapult (X from the stairs beside it) as a master walks under it. Each master you soak mutters a digit. Known so far: {digits}'],
  ['bikeUnchained', 'Bike combination',
    'Stand beside a clean blackboard, press C, type the four digits in any order, then Enter. The bike appears by the tree.'],
  ['sherry', 'Sherry in the pistol',
    'Miss Take opens her drinks cabinet only while the boys\' school door is shut. Be inside when Albert locks up, drop a stinkbomb (V) as Mr Wacker passes the middle-floor window, water the plant below the window, jump onto its pot and let it lift you, step out of the window, grow the plant by the gate the same way and climb over, then jump (Space) at the open cabinet upstairs in the girls\' school.'],
  ['storeroomLetters', 'Four storeroom letters',
    'The same trick as the digits, with sherry in the cup. Known so far: {letters}'],
  ['storeroomKey', 'Storeroom combination',
    'Write the four letters on a clean blackboard (any order). The key opens the door at the right-hand end of the science lab.'],
  ['frog', 'Catch the frog',
    'The frog is in the storeroom. Stand one cell from it, facing it, and press C the moment it sits still. It is skittish when you are close, so wait rather than chase.'],
  ['frogInCup', 'Frog in the kitchen cup',
    'At playtime, mount the bike (C) and pedal with ← and → alternately through the open gate. In the girls\' school, stand on the saddle (↑) and jump (Space) as the kitchen cup passes above your hand.'],
  ['safeKey', 'The safe key',
    'Knock Miss Take over with the catapult when she is standing right under the cup, then fire again straight away: the pellet bounces off her into the cup, the frog lands on her head and the key falls out of her hair.'],
  ['safeOpened', 'The safe',
    'Wait by the head\'s study door, slip in when Mr Wacker opens it, stand under the safe and jump (Space). That is the year done.'],
];

export default {
  id: 'quest-tracker',
  name: 'Quest tracker',
  description: 'The steps of the report-card caper, ticked off as you go, with a hint on hover.',
  defaultOn: true,
  setup({ game }) {
    const el = document.getElementById('quest');
    if (!el) return;
    const done = new Set();
    const digits = [], letters = [];
    const known = (list) => (list.length ? list.map((d) => `${d.value} (${d.who})`).join(', ') : 'nothing yet');

    const render = () => {
      const items = STEPS.map(([id, label, hint], i) => {
        const text = hint.replace('{digits}', known(digits)).replace('{letters}', known(letters));
        const isDone = done.has(id);
        const next = !isDone && STEPS.slice(0, i).every(([pid]) => done.has(pid));
        return `<li class="step ${isDone ? 'done' : ''} ${next ? 'next' : ''}" tabindex="0" data-hint="${text.replace(/"/g, '&quot;')}">
          <span class="tick">${isDone ? '✓' : i + 1}</span><span class="label">${label}</span></li>`;
      });
      el.innerHTML = `<span class="title">The plan</span><ol>${items.join('')}</ol>`;
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
