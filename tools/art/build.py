#!/usr/bin/env python3
"""
Build illustrated assets from generated sheets.

    python3 -I tools/art/build.py            every job in jobs.json
    python3 -I tools/art/build.py eric-1     one job
    python3 -I tools/art/build.py --report   what the manifest still lacks

Each job in tools/art/jobs.json says where its source image is (art-src/, not
committed), how it is keyed and cut, and which pose each cell holds. The
results go to assets/illustrated/ and manifest.json is updated in place.
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from artlib import (ASSETS, EXPECTED, JOBS, ROOT, WORK, align, key, load_json, pack, save_json,
                    slice_auto, slice_components, slice_grid)

MANIFEST = os.path.join(ASSETS, 'manifest.json')
DEFAULT_MANIFEST = {'schema': 1, 'scale': 4, 'box': {'w': 96, 'h': 128}, 'characters': {}, 'objects': {'frames': {}}, 'rooms': {}, 'furniture': {}, 'textures': {}}
# Standing heights in HD pixels: children fit the lower three cells, adults the box.
TARGET_HEIGHT = {3: 92, 4: 122}


def build_characters(job, manifest):
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return False
    img = Image.open(src)
    keyed = key(img, job.get('key', '#FF00FF'), job.get('tolerance', 80), erode=job.get('erode', 1)) if job.get('key') else img.convert('RGBA')
    grid = job.get('grid')
    # 'components' (default) keeps whole shapes together even when a raised hand crosses
    # a grid line; 'grid' cuts along hard lines, for sheets where poses touch.
    if grid and job.get('slice', 'components') == 'grid':
        cells = slice_grid(keyed, grid['rows'], grid['cols'])
    elif grid:
        cells = slice_components(keyed, grid['rows'], grid['cols'])
    else:
        cells = slice_auto(keyed)
    poses = job['poses']
    if len(cells) < len([p for p in poses if p]):
        print(f"  {job['id']}: found {len(cells)} cells for {len(poses)} poses; check the grid")
    named = {}
    for i, name in enumerate(poses):
        if name and i < len(cells) and cells[i] is not None:
            named[name] = cells[i]
    for name, cell in named.items():
        d = os.path.join(WORK, job['group'], job.get('variant', 'A'))
        os.makedirs(d, exist_ok=True)
        cell.save(os.path.join(d, f'{name}.raw.png'))
    frames, factor = align(named, standing=job.get('standing', 'WALK0'), target_height=TARGET_HEIGHT[job.get('heightCells', 3)], nudges=job.get('nudge'))
    sheet, placed = pack(frames)
    group, variant = job['group'], job.get('variant')
    rel = f"characters/{group.lower()}{('-' + variant.lower()) if variant else ''}.png"
    os.makedirs(os.path.dirname(os.path.join(ASSETS, rel)), exist_ok=True)
    sheet.save(os.path.join(ASSETS, rel), optimize=True)
    # Two-frame walk until a distinct WALK3 exists.
    if 'WALK2' not in placed:
        placed['WALK2'] = {'alias': 'WALK0'}
    if 'WALK3' not in placed:
        placed['WALK3'] = {'alias': 'WALK1'}
    entry = {'image': rel, 'frames': placed}
    chars = manifest.setdefault('characters', {})
    if variant:
        g = chars.setdefault(group, {})
        g.pop('image', None); g.pop('frames', None)
        g.setdefault('variants', {})[variant] = entry
    else:
        chars[group] = entry
    print(f"  {job['id']}: {len(frames)} frames, scale factor {factor:.3f}, sheet {sheet.size[0]}x{sheet.size[1]} -> {rel}")
    return True


def report(manifest):
    expected = load_json(EXPECTED)
    if not expected:
        print('No tools/art/expected.json: run `node tools/art/expected.mjs` first.')
        return 1
    missing = []
    for group, states in expected['groups'].items():
        g = manifest.get('characters', {}).get(group)
        sets = list(g['variants'].values()) if g and g.get('variants') else ([g] if g else [])
        if not sets:
            missing.append(f'{group}: whole group')
            continue
        for s in states:
            if not all(s in st['frames'] for st in sets):
                missing.append(f'{group}/{s}')
    for s in expected['objects']:
        if s not in manifest.get('objects', {}).get('frames', {}):
            missing.append(f'OBJ/{s}')
    for z in expected['zones']:
        if z['id'] not in manifest.get('rooms', {}):
            missing.append(f"room {z['id']}")
    for k in expected['furniture']:
        if k not in manifest.get('furniture', {}):
            missing.append(f'furniture {k}')
    people = [m for m in missing if not (m.startswith('OBJ/') or m.startswith('room ') or m.startswith('furniture '))]
    print(f"Missing people frames: {len(people)}; objects/rooms/furniture missing: {len(missing) - len(people)}")
    for m in missing:
        print('  -', m)
    return 1 if (people and '--strict' in sys.argv) else 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    manifest = load_json(MANIFEST, DEFAULT_MANIFEST)
    if '--report' in sys.argv:
        sys.exit(report(manifest))
    jobs = load_json(JOBS, {'jobs': []})['jobs']
    for job in jobs:
        if args and job['id'] not in args:
            continue
        if job.get('kind', 'characters') == 'characters':
            build_characters(job, manifest)
    save_json(MANIFEST, manifest)
    report(manifest)


if __name__ == '__main__':
    main()
