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
from artlib import (ASSETS, BOX_H, BOX_W, EXPECTED, JOBS, ROOT, SCALE, U, WORK, align, bbox, key, load_json, pack, save_json,
                    slice_auto, slice_components, slice_grid)

MANIFEST = os.path.join(ASSETS, 'manifest.json')
DEFAULT_MANIFEST = {'schema': 1, 'scale': SCALE, 'box': {'w': BOX_W, 'h': BOX_H}, 'characters': {}, 'objects': {'frames': {}}, 'rooms': {}, 'furniture': {}, 'textures': {}}
# Standing heights in HD pixels: children fit the lower three cells, adults the box.
TARGET_HEIGHT = {3: round(23 * SCALE), 4: round(30.5 * SCALE)}


def character_frames(job):
    """One sheet -> {pose: (image, ox, oy)}, each job scaled by its own factor
    (sheets of the same character are drawn at different sizes)."""
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return {}
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
    d = os.path.join(WORK, job['group'], job.get('variant', 'A'))
    os.makedirs(d, exist_ok=True)
    for name, cell in named.items():
        cell.save(os.path.join(d, f'{name}.raw.png'))
    frames, factor = align(named, standing=job.get('standing', 'WALK0'), target_height=TARGET_HEIGHT[job.get('heightCells', 3)],
                           nudges=job.get('nudge'), height_from=job.get('heightFrom', 'standing'))
    print(f"  {job['id']}: {len(frames)} frames, scale factor {factor:.3f}")
    return frames


def build_character_set(group, variant, jobs, manifest):
    """Every sheet of one character (poses, walk cycle...) packed into one image."""
    frames = {}
    for job in jobs:
        frames.update(character_frames(job))
    if not frames:
        return
    sheet, placed = pack(frames)
    rel = f"characters/{group.lower()}{('-' + variant.lower()) if variant else ''}.png"
    os.makedirs(os.path.dirname(os.path.join(ASSETS, rel)), exist_ok=True)
    sheet.save(os.path.join(ASSETS, rel), optimize=True)
    # The engine's four walk states: two distinct frames unless the sheet has more.
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
    print(f"    {group}{'/' + variant if variant else ''}: {len(frames)} frames, sheet {sheet.size[0]}x{sheet.size[1]} -> {rel}")


# How each furniture cut-out fills its rectangle: things that fill an opening
# are stretched to it; free-standing things keep their shape and sit at the
# bottom (or hang from the top) of it.
FIT = {'door:shut': 'stretch', 'window3x3:shut': 'stretch', 'window3x3:open': 'stretch', 'window2x4:shut': 'stretch', 'window2x4:open': 'stretch',
       'cabinet:shut': 'stretch', 'cabinet:open': 'stretch', 'blackboard': 'stretch', 'gate:shut': 'stretch', 'railing': 'stretch',
       'door:open': 'stretch', 'pier': 'stretch', 'stage': 'stretch', 'lamp': 'bottom',
       'safe': 'bottom', 'desk': 'bottom', 'bike': 'bottom', 'tree': 'bottom', 'conker': 'top',
       'cup:EMPTY': 'top', 'cup:WATER': 'top', 'cup:SHERRY': 'top', 'cup:FROG': 'top'}


# The open door is a whole doorway (frame, dark corridor, the door swung to
# the left): it lines up with the opening by its right and bottom edges
# (offsets at scale 4, see art/furniture.js).
PLACE = {'door:open': (9, 0)}


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
        if key == 'desk':
            frames.update(split_desk(cell, round(sizes[key]['w'] * U), round(sizes[key]['h'] * U)))
            continue
        frames[key] = fit_into(cell, round(sizes[key]['w'] * U), round(sizes[key]['h'] * U), FIT.get(key, 'bottom'))
    return frames


def split_desk(cell, w, h):
    """The desk-and-chair picture becomes two layers the same size: the chair
    (drawn behind a seated pupil) and the desk (drawn in front). The desk is
    everything left of the chair: the left 60% above seat height, and the left
    53% below it, where the chair's front leg tucks under the desk top."""
    import numpy as np
    a = np.array(cell)
    H, W = a.shape[:2]
    xs, ys = np.meshgrid(np.arange(W), np.arange(H))
    is_desk = (xs < 0.60 * W) & ((ys < 0.46 * H) | (xs < 0.535 * W))
    desk, chair = a.copy(), a.copy()
    desk[..., 3] = np.where(is_desk, a[..., 3], 0)
    chair[..., 3] = np.where(is_desk, 0, a[..., 3])
    return {'desk': Image.fromarray(desk).resize((w, h), Image.LANCZOS), 'chair': Image.fromarray(chair).resize((w, h), Image.LANCZOS)}


def derive_open(frames, sizes):
    """An open door or gate is the shut one seen edge-on: a narrow, darker slab
    at the left of the opening, as the pixel art draws it."""
    for shut, open_, slab in (('door:shut', 'door:open', round(24 * U)), ('gate:shut', 'gate:open', round(16 * U))):
        if shut in frames and open_ in sizes and open_ not in frames:
            w, h = round(sizes[open_]['w'] * U), round(sizes[open_]['h'] * U)
            edge = ImageEnhance.Brightness(frames[shut].resize((slab, h), Image.LANCZOS)).enhance(0.8)
            out = Image.new('RGBA', (w, h), (0, 0, 0, 0)); out.paste(edge, (round(4 * U), 0), edge)
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
    # A picture that is not simply stretched over its piece's rectangle says
    # where it goes instead: its bottom-right corner relative to the rectangle's.
    for k, (dr, db) in PLACE.items():
        if k in manifest['furniture']:
            manifest['furniture'][k].update({'place': True, 'right': round(dr * U), 'bottom': round(db * U)})
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
    # A storey is 7 cells tall; keep about a third more for crispness. The wide
    # pictures (a long wall with plain wall above a picture rail) are cropped
    # from the top by the game, so they keep their full height.
    if not job.get('fullHeight'):
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
        frames[state] = place_object(cell, footprints[state], OBJECT_ANCHOR.get(state, 'bottom'), state)
    return frames


# The open desk replaces the closed desk picture exactly, so it gets its own
# rectangle (x, y, w, h in sixths of a Spectrum pixel inside the 3 x 4 cell
# box) instead of the pixel art's footprint. See art/backdrop.js DESK_UNIT.
OBJECT_RECT = {'DESK_EMPTY': (67, 96, 58, 96), 'DESK_WATER_PISTOL': (67, 96, 58, 96), 'DESK_STINKBOMBS': (67, 96, 58, 96)}


def place_object(cell, fp, anchor, state=None):
    """Fit a cut-out into its doubled footprint inside the box; return
    (trimmed image, ox, oy) in the manifest's frame convention."""
    k = SCALE // 2                                  # footprints are in pixel-art pixels (scale 2)
    rx, ry, rw, rh = fp['x'] * k, fp['y'] * k, fp['w'] * k, fp['h'] * k
    if state in OBJECT_RECT:
        rx, ry, rw, rh = (round(v * SCALE / 6) for v in OBJECT_RECT[state])
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


def build_scene(job, manifest):
    """A big backdrop painting (the playground), kept at full size as a JPEG."""
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return
    img = Image.open(src).convert('RGB')
    rel = f"scenes/{job['name']}.jpg"
    os.makedirs(os.path.join(ASSETS, 'scenes'), exist_ok=True)
    img.save(os.path.join(ASSETS, rel), quality=86, optimize=True, progressive=True)
    manifest.setdefault('scenes', {})[job['name']] = {'image': rel, 'w': img.size[0], 'h': img.size[1]}
    print(f"  {job['id']}: {img.size[0]}x{img.size[1]} -> {rel}")


def build_textures(job, manifest):
    """A sheet of square material swatches -> one tile each. Each swatch is
    mirrored into a 2 x 2 block so it repeats without a visible seam."""
    src = os.path.join(ROOT, job['source'])
    if not os.path.exists(src):
        print(f"  {job['id']}: source missing ({job['source']}); run fetch first")
        return
    img = Image.open(src).convert('RGB')
    rows, cols = job['grid']['rows'], job['grid']['cols']
    cw, ch = img.size[0] / cols, img.size[1] / rows
    os.makedirs(os.path.join(ASSETS, 'textures'), exist_ok=True)
    for i, name in enumerate(job['items']):
        if not name:
            continue
        r, c = divmod(i, cols)
        inset = 0.05                                    # skip the white gaps between swatches
        tile = img.crop((int((c + inset) * cw), int((r + inset) * ch), int((c + 1 - inset) * cw), int((r + 1 - inset) * ch)))
        side = min(tile.size); tile = tile.crop((0, 0, side, side)).resize((256, 256), Image.LANCZOS)
        block = Image.new('RGB', (512, 512))
        block.paste(tile, (0, 0)); block.paste(tile.transpose(Image.FLIP_LEFT_RIGHT), (256, 0))
        block.paste(tile.transpose(Image.FLIP_TOP_BOTTOM), (0, 256)); block.paste(tile.transpose(Image.ROTATE_180), (256, 256))
        rel = f'textures/{name}.jpg'
        block.save(os.path.join(ASSETS, rel), quality=88, optimize=True)
        manifest.setdefault('textures', {})[name] = rel
    print(f"  {job['id']}: {len([n for n in job['items'] if n])} textures")


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
    manifest['scale'] = SCALE; manifest['box'] = {'w': BOX_W, 'h': BOX_H}
    furniture_jobs, object_jobs, touched = [], [], []
    for job in jobs:
        if args and job['id'] not in args:
            continue
        kind = job.get('kind', 'characters')
        if kind == 'characters':
            if (job['group'], job.get('variant')) not in touched:
                touched.append((job['group'], job.get('variant')))
        elif kind == 'furniture':
            furniture_jobs.append(job)
        elif kind == 'room':
            build_room(job, manifest)
        elif kind == 'objects':
            object_jobs.append(job)
        elif kind == 'scene':
            build_scene(job, manifest)
        elif kind == 'textures':
            build_textures(job, manifest)
    # A character's sheets are always rebuilt together so one image holds every pose.
    for group, variant in touched:
        build_character_set(group, variant, [j for j in jobs if j.get('kind', 'characters') == 'characters' and j['group'] == group and j.get('variant') == variant], manifest)
    # Furniture is always rebuilt as a whole so the sheet holds every piece.
    if furniture_jobs:
        build_all_furniture([j for j in jobs if j.get('kind') == 'furniture'], manifest)
    if object_jobs:
        build_all_objects([j for j in jobs if j.get('kind') == 'objects'], manifest)
    save_json(MANIFEST, manifest)
    report(manifest)


if __name__ == '__main__':
    main()
