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
  objects: Object.keys(OBJECT_ART),
  zones: DECOR.zones.map((z) => ({ id: z.id, x0: z.x0, x1: z.x1, storey: z.storey })),
  // Fixed-size pictures the furniture painter needs, in HD pixels (scale 4).
  furniture: {
    'door:shut': { w: 96, h: 176 }, 'door:open': { w: 96, h: 176 },
    'gate:shut': { w: 128, h: 144 }, 'gate:open': { w: 128, h: 144 },
    'window3x3:shut': { w: 96, h: 96 }, 'window3x3:open': { w: 96, h: 96 },
    'window2x4:shut': { w: 64, h: 128 }, 'window2x4:open': { w: 64, h: 128 },
    'cabinet:shut': { w: 80, h: 72 }, 'cabinet:open': { w: 80, h: 72 },
    safe: { w: 80, h: 56 },
    'cup:EMPTY': { w: 40, h: 32 }, 'cup:WATER': { w: 40, h: 32 }, 'cup:SHERRY': { w: 40, h: 32 }, 'cup:FROG': { w: 40, h: 32 },
    blackboard: { w: 280, h: 104 }, desk: { w: 112, h: 96 }, tree: { w: 448, h: 640 }, railing: { w: 32, h: 144 },
    conker: { w: 16, h: 16 }, bike: { w: 96, h: 64 },
  },
};
writeFileSync(join(here, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
console.log(`expected.json: ${Object.keys(expected.groups).length} groups, ${expected.objects.length} objects, ${expected.zones.length} zones, ${Object.keys(expected.furniture).length} furniture pictures`);
