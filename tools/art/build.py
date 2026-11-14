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
from PIL import Image, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from artlib import (ASSETS, BOX_H, BOX_W, EXPECTED, JOBS, ROOT, WORK, align, bbox, key, load_json, pack, save_json,
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


# How each furniture cut-out fills its rectangle: things that fill an opening
# are stretched to it; free-standing things keep their shape and sit at the
# bottom (or hang from the top) of it.
FIT = {'door:shut': 'stretch', 'window3x3:shut': 'stretch', 'window3x3:open': 'stretch', 'window2x4:shut': 'stretch', 'window2x4:open': 'stretch',
       'cabinet:shut': 'stretch', 'cabinet:open': 'stretch', 'blackboard': 'stretch', 'gate:shut': 'stretch', 'railing': 'stretch',
       'safe': 'bottom', 'desk': 'bottom', 'bike': 'bottom', 'tree': 'bottom', 'conker': 'top',
       'cup:EMPTY': 'top', 'cup:WATER': 'top', 'cup:SHERRY': 'top', 'cup:FROG': 'top'}


def fit_into(img, w, h, mode):
    """Return an RGBA image exactly w x h holding `img` as `mode` says."""
    if mode == 'stretch':
        return img.resize((w, h), Image.LANCZOS)
    f = min(w / img.size[0], h / img.size[1])
    sw, sh = max(1, round(img.size[0] * f)), max(1, round(img.size[1] * f))
    small = img.resize((sw, sh), Image.LANCZOS)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(small, ((w - sw) // 2, 0 if mode == 'top' else h - sh), small)
    return out


def build_furniture(job, manifest, sizes):
    """One sheet of cut-outs (or a single picture) -> frames in furniture/items.png."""
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return {}
    img = Image.open(src).convert('RGBA')
    grid = job['grid']
    cells = slice_components(img, grid['rows'], grid['cols']) if grid['rows'] * grid['cols'] > 1 else [img.crop(bbox(img))]
    frames = {}
    for key, cell in zip(job['items'], cells):
        if not key or cell is None or key not in sizes:
            continue
        d = os.path.join(WORK, 'furniture'); os.makedirs(d, exist_ok=True)
        cell.save(os.path.join(d, key.replace(':', '_') + '.raw.png'))
        frames[key] = fit_into(cell, sizes[key]['w'], sizes[key]['h'], FIT.get(key, 'bottom'))
    return frames


def derive_open(frames, sizes):
    """An open door or gate is the shut one seen edge-on: a narrow, darker slab
    at the left of the opening, as the pixel art draws it."""
    for shut, open_, slab in (('door:shut', 'door:open', 24), ('gate:shut', 'gate:open', 16)):
        if shut in frames and open_ in sizes and open_ not in frames:
            w, h = sizes[open_]['w'], sizes[open_]['h']
            edge = ImageEnhance.Brightness(frames[shut].resize((slab, h), Image.LANCZOS)).enhance(0.8)
            out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); out.paste(edge, (4, 0), edge)
            frames[open_] = out


def build_all_furniture(jobs, manifest):
    expected = load_json(EXPECTED) or {}
    sizes = expected.get('furniture', {})
    frames = {}
    for job in jobs:
        frames.update(build_furniture(job, manifest, sizes))
    if not frames:
        return
    derive_open(frames, sizes)
    sheet, placed = pack({k: (v, 0, 0) for k, v in frames.items()})
    rel = 'furniture/items.png'
    os.makedirs(os.path.join(ASSETS, 'furniture'), exist_ok=True)
    sheet.save(os.path.join(ASSETS, rel), optimize=True)
    manifest['furniture'] = {k: {'image': rel, 'x': p['x'], 'y': p['y'], 'w': p['w'], 'h': p['h']} for k, p in placed.items()}
    print(f"  furniture: {len(frames)} pieces, sheet {sheet.size[0]}x{sheet.size[1]} -> {rel}")


def build_room(job, manifest):
    """A room painting, saved as JPEG at a sensible size; the game fits it to
    the wall (see src/render/art/backdrop.js), so only the floor line matters:
    it must be the picture's bottom edge. 'cropTop'/'cropBottom' trim a job."""
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return
    img = Image.open(src).convert('RGB')
    w, h = img.size
    img = img.crop((0, int(job.get('cropTop', 0) * h), w, h - int(job.get('cropBottom', 0) * h)))
    # Rooms are 224 HD pixels tall; keep twice that for crispness when scaled.
    f = 448 / img.size[1]
    img = img.resize((round(img.size[0] * f), 448), Image.LANCZOS)
    rel = f"rooms/{job['zone']}.jpg"
    os.makedirs(os.path.join(ASSETS, 'rooms'), exist_ok=True)
    img.save(os.path.join(ASSETS, rel), quality=86, optimize=True, progressive=True)
    manifest.setdefault('rooms', {})[job['zone']] = {'image': rel, 'w': img.size[0], 'h': img.size[1]}
    print(f"  {job['id']}: {img.size[0]}x{img.size[1]} -> {rel}")


# Where an object sits inside its pixel-art footprint: on the floor, or
# centred (things that fly or float).
OBJECT_ANCHOR = {'FLY': 'centre', 'WATER0': 'centre', 'WATER1': 'centre', 'WATER2': 'centre', 'WATER3': 'centre', 'WATER4': 'centre',
                 'WATER_DROP': 'centre', 'SHERRY_DROP': 'centre', 'STINKBOMB': 'centre', 'CONKER': 'centre'}


def build_objects(job, manifest, footprints, extra=None):
    """A sheet of object pictures -> frames placed where the pixel art puts
    them (expected.json footprints, doubled to HD pixels) inside the 96x128
    box, trimmed and packed into objects.png."""
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return {}
    img = Image.open(src).convert('RGBA')
    grid = job['grid']
    cells = slice_components(img, grid['rows'], grid['cols'])
    frames = {}
    for state, cell in zip(job['items'], cells):
        if not state or cell is None or state not in footprints:
            continue
        d = os.path.join(WORK, 'objects'); os.makedirs(d, exist_ok=True)
        cell.save(os.path.join(d, f'{state}.raw.png'))
        frames[state] = place_object(cell, footprints[state], OBJECT_ANCHOR.get(state, 'bottom'))
    return frames


def place_object(cell, fp, anchor):
    """Fit a cut-out into its doubled footprint inside the box; return
    (trimmed image, ox, oy) in the manifest's frame convention."""
    rx, ry, rw, rh = fp['x'] * 2, fp['y'] * 2, fp['w'] * 2, fp['h'] * 2
    f = min(rw / cell.size[0], rh / cell.size[1])
    sw, sh = max(1, round(cell.size[0] * f)), max(1, round(cell.size[1] * f))
    small = cell.resize((sw, sh), Image.LANCZOS)
    box = Image.new('RGBA', (BOX_W, BOX_H), (0, 0, 0, 0))
    px = rx + (rw - sw) // 2
    py = ry + ((rh - sh) // 2 if anchor == 'centre' else rh - sh)
    box.paste(small, (px, py), small)
    bb = bbox(box) or (0, 0, BOX_W, BOX_H)
    return (box.crop(bb), -bb[0], -bb[1])


def build_all_objects(jobs, manifest):
    expected = load_json(EXPECTED) or {}
    footprints = expected.get('objects', {})
    frames = {}
    for job in jobs:
        frames.update(build_objects(job, manifest, footprints))
    if not frames:
        return
    # The upright bike is the furniture bike, where the pixel art stands it.
    bike_raw = os.path.join(WORK, 'furniture', 'bike.raw.png')
    if 'BIKE_UPRIGHT' in footprints and os.path.exists(bike_raw):
        frames['BIKE_UPRIGHT'] = place_object(Image.open(bike_raw).convert('RGBA'), footprints['BIKE_UPRIGHT'], 'bottom')
    sheet, placed = pack(frames)
    rel = 'objects.png'
    sheet.save(os.path.join(ASSETS, rel), optimize=True)
    manifest['objects'] = {'image': rel, 'frames': placed}
    print(f"  objects: {len(frames)} frames, sheet {sheet.size[0]}x{sheet.size[1]} -> {rel}")


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
    furniture_jobs, object_jobs = [], []
    for job in jobs:
        if args and job['id'] not in args:
            continue
        kind = job.get('kind', 'characters')
        if kind == 'characters':
            build_characters(job, manifest)
        elif kind == 'furniture':
            furniture_jobs.append(job)
        elif kind == 'room':
            build_room(job, manifest)
        elif kind == 'objects':
            object_jobs.append(job)
    # Furniture is always rebuilt as a whole so the sheet holds every piece.
    if furniture_jobs:
        build_all_furniture([j for j in jobs if j.get('kind') == 'furniture'], manifest)
    if object_jobs:
        build_all_objects([j for j in jobs if j.get('kind') == 'objects'], manifest)
    save_json(MANIFEST, manifest)
    report(manifest)


if __name__ == '__main__':
    main()
