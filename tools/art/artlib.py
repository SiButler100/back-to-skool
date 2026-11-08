"""
Shared helpers for the illustrated-artwork pipeline (tools/art).

The flow for a character sheet is: a generated PNG with poses laid out in a
grid on a flat key colour  ->  key()   makes the background transparent
                              ->  slice() cuts the grid into one image per pose
                              ->  align() scales the group once (from its
                                  standing pose) and puts every pose's lowest
                                  opaque row on the character box's bottom edge
                              ->  pack() packs the poses into one sheet and
                                  writes the frame map the game reads.

Coordinates in the frame map are HD pixels at scale 4: a cell is 32 px and a
character box is 96 x 128. (ox, oy) is the offset of a frame's top-left from
the box's top-left, so the game draws a frame at (boxX - ox, boxY - oy).
"""
import json
import os
from PIL import Image, ImageFilter
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
JOBS = os.path.join(HERE, 'jobs.json')
EXPECTED = os.path.join(HERE, 'expected.json')
ASSETS = os.path.join(ROOT, 'assets', 'illustrated')
WORK = os.path.join(ROOT, 'art-work')
CELL = 32
BOX_W, BOX_H = 96, 128


def load_json(path, default=None):
    if not os.path.exists(path):
        return default
    with open(path) as f:
        return json.load(f)


def save_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


# ---- Keying -----------------------------------------------------------------------

def key(img, key_hex='#FF00FF', tol=80, soft=0.4, erode=1):
    """Make pixels close to the key colour transparent, with a soft edge and
    the key's spill removed from the edge pixels. Returns an RGBA image."""
    rgba = np.array(img.convert('RGBA')).astype(np.float32)
    rgb, a = rgba[..., :3], rgba[..., 3]
    kr, kg, kb = hex_rgb(key_hex)
    dist = np.sqrt((rgb[..., 0] - kr) ** 2 + (rgb[..., 1] - kg) ** 2 + (rgb[..., 2] - kb) ** 2)
    inner, outer = tol * (1 - soft), tol
    alpha = np.clip((dist - inner) / max(1e-6, outer - inner), 0, 1)
    a = a / 255.0 * alpha
    # Despill: along the edge, the key's dominant channels bleed in; pull them back.
    edge = (a > 0) & (a < 1)
    if kr > 128 and kb > 128 and kg < 128:          # magenta: red and blue too strong
        cap = rgb[..., 1] + 25
        rgb[..., 0] = np.where(edge, np.minimum(rgb[..., 0], cap), rgb[..., 0])
        rgb[..., 2] = np.where(edge, np.minimum(rgb[..., 2], cap), rgb[..., 2])
    elif kg > 128 and kr < 128 and kb < 128:       # green
        cap = np.maximum(rgb[..., 0], rgb[..., 2]) + 25
        rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], cap), rgb[..., 1])
    out = Image.fromarray(np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    if erode:
        r, g, b, al = out.split()
        al = al.filter(ImageFilter.MinFilter(2 * erode + 1))
        out = Image.merge('RGBA', (r, g, b, al))
    return out


# ---- Slicing ------------------------------------------------------------------------

def bbox(img, threshold=20):
    """Bounding box of pixels with alpha above the threshold, or None."""
    a = np.array(img.split()[-1])
    ys, xs = np.nonzero(a > threshold)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def slice_grid(img, rows, cols, margin=0.02):
    """Cut an RGBA sheet into rows x cols cells (reading order), each trimmed
    to its own content. Returns a list of images (None for empty cells)."""
    W, H = img.size
    cw, ch = W / cols, H / rows
    mx, my = int(cw * margin), int(ch * margin)
    cells = []
    for r in range(rows):
        for c in range(cols):
            cell = img.crop((int(c * cw) + mx, int(r * ch) + my, int((c + 1) * cw) - mx, int((r + 1) * ch) - my))
            bb = bbox(cell)
            cells.append(cell.crop(bb) if bb else None)
    return cells


def label_components(mask):
    """Number the connected blobs in a boolean mask (4-connected), without
    SciPy. Returns (labels, count) where labels is an int array, 0 = empty.
    A simple two-pass union-find: fine for sheets of a few megapixels."""
    H, W = mask.shape
    labels = np.zeros((H, W), dtype=np.int32)
    parent = [0]

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    # Pass 1: give each run of pixels in a row a label, joining with the row above.
    for y in range(H):
        row = mask[y]
        above = labels[y - 1] if y else None
        x = 0
        while x < W:
            if not row[x]:
                x += 1
                continue
            x0 = x
            while x < W and row[x]:
                x += 1
            lab = 0
            if above is not None:
                touching = np.unique(above[x0:x])
                touching = touching[touching > 0]
                if len(touching):
                    lab = int(touching.min())
                    for t in touching:
                        union(lab, int(t))
            if not lab:
                parent.append(len(parent))
                lab = len(parent) - 1
            labels[y, x0:x] = lab
    # Pass 2: flatten the unions and renumber compactly.
    roots = np.array([find(i) for i in range(len(parent))], dtype=np.int32)
    flat = roots[labels]
    uniq, inverse = np.unique(flat, return_inverse=True)
    labels = inverse.reshape(H, W).astype(np.int32)
    return labels, len(uniq) - 1


def slice_components(img, rows, cols, threshold=20, min_area_ratio=0.0005):
    """Cut a sheet into rows x cols cells by whole connected shapes rather
    than by hard grid lines: a hand that crosses a grid line stays with its
    body, and nothing from a neighbour leaks in. Each blob is assigned to the
    grid cell holding its centre; tiny specks are dropped. Returns trimmed
    images in reading order (None for empty cells)."""
    W, H = img.size
    rgba = np.array(img.convert('RGBA'))
    mask = rgba[..., 3] > threshold
    labels, n = label_components(mask)
    cw, ch = W / cols, H / rows
    min_area = W * H * min_area_ratio
    buckets = {}
    ys, xs = np.nonzero(labels)
    labs = labels[ys, xs]
    order = np.argsort(labs)
    ys, xs, labs = ys[order], xs[order], labs[order]
    starts = np.searchsorted(labs, np.arange(1, n + 1))
    ends = np.append(starts[1:], len(labs))
    for i in range(n):
        if ends[i] <= starts[i]:
            continue
        py, px = ys[starts[i]:ends[i]], xs[starts[i]:ends[i]]
        if len(py) < min_area:
            continue
        r, c = min(rows - 1, int(py.mean() / ch)), min(cols - 1, int(px.mean() / cw))
        buckets.setdefault((r, c), []).append(i + 1)
    cells = []
    for r in range(rows):
        for c in range(cols):
            ids = buckets.get((r, c))
            if not ids:
                cells.append(None)
                continue
            keep = np.isin(labels, ids)
            out = rgba.copy()
            out[..., 3] = np.where(keep, out[..., 3], 0)
            ys2, xs2 = np.nonzero(keep)
            cell = Image.fromarray(out).crop((xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1))
            cells.append(cell)
    return cells


def slice_auto(img, min_gap=0.015):
    """Cut a sheet by the empty gaps between poses: first into rows, then each
    row into columns. Returns trimmed images in reading order."""
    a = np.array(img.split()[-1]) > 20
    H, W = a.shape

    def runs(mask, min_len):
        out, start = [], None
        for i, v in enumerate(mask):
            if v and start is None:
                start = i
            elif not v and start is not None:
                if i - start >= min_len:
                    out.append((start, i))
                start = None
        if start is not None and len(mask) - start >= min_len:
            out.append((start, len(mask)))
        return out

    cells = []
    for y0, y1 in runs(a.any(axis=1), int(H * min_gap)):
        band = a[y0:y1]
        for x0, x1 in runs(band.any(axis=0), int(W * min_gap)):
            piece = img.crop((x0, y0, x1, y1))
            bb = bbox(piece)
            cells.append(piece.crop(bb) if bb else None)
    return cells


# ---- Aligning -----------------------------------------------------------------------

def feet_row(img, min_px=3):
    """The lowest row with at least min_px solid pixels: where the figure
    touches the ground (or, lying down, the body's underside)."""
    a = np.array(img.split()[-1]) > 128
    rows = np.nonzero(a.sum(axis=1) >= min_px)[0]
    return int(rows.max()) if len(rows) else img.size[1] - 1


def align(poses, standing='WALK0', target_height=92, nudges=None):
    """Scale every pose by one factor (so the standing pose is target_height
    tall), then work out each frame's offset so its lowest solid row sits on
    the box's bottom edge and it is centred on the box. Returns
    {pose: (image, ox, oy)}."""
    nudges = nudges or {}
    ref = poses.get(standing) or next(p for p in poses.values() if p is not None)
    factor = target_height / ref.size[1]
    out = {}
    for name, img in poses.items():
        if img is None:
            continue
        w, h = max(1, round(img.size[0] * factor)), max(1, round(img.size[1] * factor))
        scaled = img.resize((w, h), Image.LANCZOS)
        bb = bbox(scaled) or (0, 0, w, h)
        fr = feet_row(scaled)
        cx = (bb[0] + bb[2]) / 2
        n = nudges.get(name, {})
        ox = int(round(cx - BOX_W / 2)) - int(n.get('dx', 0))
        oy = int(round(fr - (BOX_H - 1))) - int(n.get('dy', 0))
        out[name] = (scaled, ox, oy)
    return out, factor


# ---- Packing ------------------------------------------------------------------------

def pack(frames, max_width=2048, gutter=2):
    """Shelf-pack {name: (image, ox, oy)} into one RGBA sheet. Returns
    (sheet, {name: {x, y, w, h, ox, oy}})."""
    items = sorted(frames.items(), key=lambda kv: -kv[1][0].size[1])
    placed, x, y, shelf_h, sheet_w = {}, gutter, gutter, 0, 0
    for name, (img, ox, oy) in items:
        w, h = img.size
        if x + w + gutter > max_width:
            x, y, shelf_h = gutter, y + shelf_h + gutter, 0
        placed[name] = {'x': x, 'y': y, 'w': w, 'h': h, 'ox': ox, 'oy': oy}
        x += w + gutter
        shelf_h = max(shelf_h, h)
        sheet_w = max(sheet_w, x)
    sheet = Image.new('RGBA', (sheet_w, y + shelf_h + gutter), (0, 0, 0, 0))
    for name, (img, _, _) in items:
        p = placed[name]
        sheet.paste(img, (p['x'], p['y']))
    return sheet, placed
