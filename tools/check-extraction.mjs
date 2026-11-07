#!/usr/bin/env node
// ============================================================================
// CHECK THE IN-BROWSER GRAPHICS EXTRACTOR AGAINST A KNOWN-GOOD EXTRACTION
// ----------------------------------------------------------------------------
//   node tools/check-extraction.mjs <snapshot.z80|.tzx|.sna> <dir-of-reference-pngs>
//
// Runs src/render/extract.js on the snapshot and writes each bitmap as a raw
// RGBA file next to this script's output folder, then (if Python with Pillow
// is available) compares them with the reference PNGs pixel by pixel.
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { loadSnapshot, extractGraphics } from '../src/render/extract.js';

const [snapshotPath, refDir] = process.argv.slice(2);
if (!snapshotPath) { console.error('usage: check-extraction.mjs <snapshot> [reference-png-dir]'); process.exit(2); }
const mem = loadSnapshot(readFileSync(snapshotPath), snapshotPath);
const t0 = Date.now();
const gfx = extractGraphics(mem);
console.log(`extracted in ${Date.now() - t0} ms`);
const outDir = '/tmp/bts-extract-check';
mkdirSync(outDir, { recursive: true });
for (const [name, bm] of Object.entries(gfx)) {
  if (name === 'attributes') { writeFileSync(`${outDir}/attributes.json`, JSON.stringify(Array.from(bm))); continue; }
  writeFileSync(`${outDir}/${name}.rgba`, Buffer.from(bm.data.buffer));
  writeFileSync(`${outDir}/${name}.size`, `${bm.width}x${bm.height}`);
  console.log(`${name}: ${bm.width}x${bm.height}`);
}
if (!refDir) process.exit(0);
const py = `
import json, sys
from PIL import Image
out='${outDir}'; ref='${refDir}'
fails = 0
for name in ['skool','sprites','mutables','font','bubble','inventory','scorebox','logo']:
    w,h = map(int, open(f'{out}/{name}.size').read().split('x'))
    mine = Image.frombytes('RGBA', (w,h), open(f'{out}/{name}.rgba','rb').read())
    r = Image.open(f'{ref}/{name}.png').convert('RGBA')
    key = {'sprites':(0,254,0),'bubble':(0,254,0),'inventory':(0,0,0),'font':(255,254,253)}.get(name)
    rp, mp = r.load(), mine.load(); diff = 0
    for y in range(h):
        for x in range(w):
            R = rp[x,y]; M = mp[x,y]
            if key and R[:3]==key: ok = (M[3]==0)
            elif name=='font': ok = (M[3]==255 and M[:3]==(255,255,255))
            elif name=='sprites': ok = (M[3]==255 and ((R[:3]==(0,0,0))==(M[:3]==(0,0,0))))
            else: ok = (M[3]==255 and M[:3]==R[:3])
            diff += 0 if ok else 1
    print(f'{name:10s} {w}x{h}  differing pixels: {diff}'); fails += diff
attrs = json.load(open(f'{out}/attributes.json')); ref_attrs = json.load(open(f'{ref}/attributes.json'))
d = sum(a!=b for a,b in zip(attrs, ref_attrs)); print(f'attributes differing cells: {d}'); fails += d
sys.exit(1 if fails else 0)
`;
try { execSync(`python3 -c "${py.replace(/"/g, '\\"')}"`, { stdio: 'inherit' }); console.log('Extraction matches the reference.'); }
catch (e) { console.log('Extraction differs from the reference.'); process.exitCode = 1; }
