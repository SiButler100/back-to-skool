// ============================================================================
// 3D PROTOTYPE (three staged spots in the school, to judge the look)
// ----------------------------------------------------------------------------
// Not the game: a still picture. It starts a real game, stands the cast in
// chosen places, and draws one frame of the 3D view, so that the look can be
// judged before the 3D view is wired into the game proper.
//
//   tools/spike3d/index.html?spot=cups|class|gate   (&day=0..1 for the sun)
// ============================================================================

import { Game } from '../../src/engine/game.js';
import { FakeInput } from '../../src/ui/input.js';
import { THEMES } from '../../src/render/theme.js';
import { ArtAssets } from '../../src/render/art/assets.js';
import { World3D } from '../../src/render/world3d/world3d.js';
import { ACTION_Z } from '../../src/render/world3d/camera.js';
import { stage } from './staging.js';

const params = new URLSearchParams(location.search);
const spot = params.get('spot') || 'cups';
const day = Number(params.get('day') || 0.3);

const game = new Game({ input: new FakeInput(), seed: 7 });
game.start();
const view = stage(game, spot);

const assets = new ArtAssets(new URL('../../assets/illustrated/', import.meta.url).href);
await assets.load();

const world = new World3D();
world.build(assets, THEMES.modern);
document.body.appendChild(world.canvas);
world.canvas.id = 'spike';

// Everyone as the flat view would show them standing still: their pose, or the
// middle of the walk cycle for anyone caught in mid-stride.
const lanes = (id) => { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return (h % 3) - 1; };
const actors = [];
game.cast.drawables.forEach((d, order) => {
  if (!d.visible || d.trapped) return;
  const person = d.group !== 'OBJ';
  let state = d.animatoryState;
  if (person && (state === 'WALK1' || state === 'WALK3') && assets.frame(d.group, 'CYCLE2', d.look?.variant)) state = state === 'WALK1' ? 'CYCLE2' : 'CYCLE6';
  const f = person ? assets.frame(d.group, state, d.look?.variant) : assets.object(state);
  const onFloor = [3, 10, 17].includes(d.y) && !state.startsWith('SITTING');
  const lane = !person || !onFloor ? 0 : d === game.cast.eric ? 1 : d.isAdult() ? 0 : lanes(d.id);
  actors.push({ id: d.id, x: d.x, y: d.y, z: ACTION_Z + lane * 0.22, order, shadow: person, layers: [{ f, flip: d.direction < 0, alpha: 1 }] });
});

const frame = (when, shift = 0) => world.render({ view: { x0: view.x0 + shift, y0: view.y0, w: 32, h: 14.5 }, size: [1536, 696], actors, game, seconds: when / 1000, day });
// A soft darkening towards the corners, as a lens gives (the finished view would do this in the 3D picture itself).
const shade = document.createElement('div');
shade.style.cssText = 'position:absolute;left:0;top:0;width:1536px;height:696px;pointer-events:none;background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(20,12,4,0.30) 100%)';
document.body.appendChild(shade);
frame(0); frame(16);          // twice: the first frame uploads the pictures
window.spikeReady = true;
window.spike = { world, game, frame };
