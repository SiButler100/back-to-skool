// ============================================================================
// FEATURE: Aiming help (where to stand to fill a cup or knock it down)
// ----------------------------------------------------------------------------
// The 1985 game is exact about this and tells you nothing. A cup can be filled
// with the pistol from one spot on the floor each side of it, and knocked with
// the catapult from one single step of the stairs, facing the cups. Miss the
// spot by a step and the shot simply does nothing.
//
// The rules are left alone. This feature works out where those spots are and
// hands them to the renderer, which marks them in the modern view:
//   a soft marker on the floor or the step, with an arrow for the way to face
//   a ring round the cup (or plant pot) once Eric is on the spot and his aim
//   is true.
//
// Nothing is typed in by hand: the spots are found by tracing a pellet and a
// jet of water from every place Eric can stand, with the same sums the engine
// uses when he really fires (MovePellet and MoveWater in engine/commands.js).
// tools/scenarios.mjs checks that the two agree.
// ============================================================================

// Every place Eric can stand: each cell of each floor and each step of each
// staircase, as the top-left corner of his 3 by 4 cell box.
export function standingPlaces(world) {
  const places = [];
  const seen = new Set();
  const add = (x, y) => { const k = `${x},${y}`; if (!seen.has(k)) { seen.add(k); places.push([x, y]); } };
  for (const f of world.floors) for (let x = f.minX; x <= f.maxX; x++) add(x, f.y);
  for (const s of new Set(world.staircases.values())) {
    for (let i = 0; i <= s.bottom.y - s.top.y; i++) add(s.bottom.x + i * s.direction, s.bottom.y - i);
  }
  return places;
}

// The cups a catapult pellet passes through if Eric fires it standing at
// (x, y) facing d, nearest first. (The real pellet knocks the first one that
// has something in it and flies through the empty ones.)
export function pelletCups(world, pellet, x, y, d) {
  const cups = [];
  // A stand-in for the pellet, so the engine's own wall test can be asked.
  const probe = { x: x + d, y, direction: d, width: 1, impeded: (bottomY, topY) => topY <= y + 1 && y + 1 <= bottomY };
  for (let count = pellet.range - 1; count > 0; count--) {
    if (world.barrier(probe)) break;
    if (count <= pellet.hitZone) {
      const cup = world.cup(probe.x + pellet.hitXY[0], probe.y + pellet.hitXY[1]);
      if (cup) cups.push(cup);
    }
    probe.x += d;
  }
  return cups;
}

// What a jet from the water pistol lands in if Eric fires it standing at
// (x, y) facing d: { cup } or { pot }, or null. Mirrors Eric.waterTargetAhead.
export function waterTarget(world, x, y, d) {
  const phases = world.animationPhases.Water;
  let wx = x + 2 * d, wy = y - 2;
  for (let i = 0; i < 12; i++) {
    const [, xInc, yInc, hit] = phases[Math.min(i, phases.length - 1)];
    if (hit === 1) { const cup = world.cup(wx - (d < 0 ? 1 : -3), wy); if (cup) return { cup }; }
    if (hit === 2) { const pot = world.plantPot(wx, wy); if (pot) return { pot }; }
    if (world.floorAt(wx, wy)) return null;
    wx += d * xInc; wy += yInc;
  }
  return null;
}

// All the spots in the school, worked out once.
export function findSpots(world, pellet) {
  const catapult = [], pistol = [];
  for (const [x, y] of standingPlaces(world)) {
    for (const d of [-1, 1]) {
      const cups = pelletCups(world, pellet, x, y, d);
      if (cups.length) catapult.push({ x, y, d, cups });
      const target = waterTarget(world, x, y, d);
      if (target) pistol.push({ x, y, d, ...target });
    }
  }
  return { catapult, pistol };
}

export default {
  id: 'aim-guide',
  name: 'Aiming help',
  description: 'Marks where to stand to fill a cup or knock it down, and rings the cup when the aim is true.',
  defaultOn: true,
  setup({ game, renderer }) {
    const world = game.world;
    let spots = null;

    // Which spots matter right now depends on what Eric is carrying and what
    // is in the cups, so the list is rebuilt every tick (it is short).
    game.events.on('tick', () => {
      const eric = game.cast.eric;
      if (!spots) spots = findSpots(world, eric.pellet);
      const marks = [];
      const still = eric.isStanding() && !eric.midstride() && !eric.controller;
      const here = (s) => still && eric.x === s.x && eric.y === s.y && eric.direction === s.d;

      // Catapult: worth marking once a cup on the pellet's path has something in it.
      for (const s of spots.catapult) {
        const cup = s.cups.find((c) => !c.isEmpty());
        if (!cup) continue;
        marks.push({ x: s.x, y: s.y, d: s.d, kind: 'catapult', lit: here(s), target: [cup.x * 8 + 4, cup.y * 8 + 4] });
      }

      // Pistol: only while Eric is carrying one. A cup is worth filling unless
      // it already holds what is in the pistol; a pot is worth watering until
      // its plant comes up (only water makes a plant grow).
      if (eric.hasWaterPistol()) {
        const liquid = eric.inventory.has('SHERRY_PISTOL') ? 'SHERRY' : 'WATER';
        for (const s of spots.pistol) {
          let target = null;
          if (s.cup && s.cup.contents !== liquid) target = [s.cup.x * 8 + 4, s.cup.y * 8 + 4];
          if (s.pot && liquid === 'WATER' && s.pot.plant && !s.pot.plant.growing && s.pot.plant.headHeight === 0) target = [s.pot.x * 8 + 12, s.pot.plantY * 8 + 26];
          if (target) marks.push({ x: s.x, y: s.y, d: s.d, kind: 'pistol', lit: here(s), target });
        }
      }
      renderer.guide = marks;
    });
    game.events.on('start', () => { renderer.guide = []; });
  },
};
