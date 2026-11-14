#!/usr/bin/env node
// ============================================================================
// Writes tools/art/expected.json: everything the illustrated artwork should
// contain, taken from the game's own data so it can never drift. The Python
// scripts read it to report what is still missing.
// ============================================================================
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SPRITE_GROUPS } from '../../src/data/cast.js';
import { DECOR } from '../../src/data/decor.js';
import { OBJECT_ART } from '../../src/render/hd/objects.js';

const here = dirname(fileURLToPath(import.meta.url));
const expected = {
  groups: SPRITE_GROUPS,
  // Each object's pixel-art footprint inside its 48x64 (scale 2) frame, so the
  // illustrated cut-out can be placed exactly where the engine expects it.
  objects: Object.fromEntries(Object.entries(OBJECT_ART).map(([state, layers]) => {
    const x0 = Math.min(...layers.map((l) => l.x)), y0 = Math.min(...layers.map((l) => l.y));
    const x1 = Math.max(...layers.map((l) => l.x + l.w)), y1 = Math.max(...layers.map((l) => l.y + l.h));
    return [state, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }];
  })),
  zones: DECOR.zones.map((z) => ({ id: z.id, x0: z.x0, x1: z.x1, storey: z.storey })),
  // Fixed-size pictures the furniture painter needs, in HD pixels (scale 4).
  furniture: {
    'door:shut': { w: 96, h: 176 }, 'door:open': { w: 137, h: 185 },
    'gate:shut': { w: 128, h: 144 }, 'gate:open': { w: 128, h: 144 },
    'window3x3:shut': { w: 96, h: 96 }, 'window3x3:open': { w: 96, h: 96 },
    'window2x4:shut': { w: 64, h: 128 }, 'window2x4:open': { w: 64, h: 128 },
    'cabinet:shut': { w: 80, h: 72 }, 'cabinet:open': { w: 80, h: 72 },
    safe: { w: 80, h: 56 },
    'cup:EMPTY': { w: 40, h: 32 }, 'cup:WATER': { w: 40, h: 32 }, 'cup:SHERRY': { w: 40, h: 32 }, 'cup:FROG': { w: 40, h: 32 },
    blackboard: { w: 280, h: 104 }, desk: { w: 62, h: 50 }, chair: { w: 62, h: 50 }, tree: { w: 448, h: 640 }, railing: { w: 160, h: 144 },
    conker: { w: 16, h: 16 }, bike: { w: 96, h: 64 },
    // Scenery placed by the illustrated backdrop (art/structure.js).
    pier: { w: 52, h: 200 }, lamp: { w: 72, h: 300 }, stage: { w: 192, h: 116 },
  },
};
writeFileSync(join(here, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
console.log(`expected.json: ${Object.keys(expected.groups).length} groups, ${Object.keys(expected.objects).length} objects, ${expected.zones.length} zones, ${Object.keys(expected.furniture).length} furniture pictures`);
