// ============================================================================
// ILLUSTRATED ARTWORK: the asset loader
// ----------------------------------------------------------------------------
// The illustrated view draws from PNG files in assets/illustrated/ described
// by manifest.json (which frame of which sheet is which pose, where rooms and
// furniture pictures live). This class fetches the manifest, loads every
// image it names, and answers lookups. Until it is ready, or for anything the
// manifest does not have, callers fall back to the pixel art.
//
// Frame records: { x, y, w, h, ox, oy } = where the frame is in its sheet and
// the offset of the frame's top-left from the character's 3x4-cell box, so
// feet land on the box's bottom row. { alias: 'WALK0' } reuses another frame.
// ============================================================================

export const ART_BASE = (typeof window !== 'undefined' && window.BTS_ART_BASE)
  || (typeof document !== 'undefined' ? new URL('assets/illustrated/', document.baseURI).href : 'assets/illustrated/');

export class ArtAssets {
  constructor(base = ART_BASE) {
    this.base = base;
    this.manifest = null;
    this.images = new Map();     // path -> HTMLImageElement
    this.ready = false;          // manifest and images loaded (some images may still be missing)
    this.failed = false;         // no manifest at all
    this.listeners = [];
  }

  onReady(cb) { if (this.ready || this.failed) cb(this); else this.listeners.push(cb); }

  async load() {
    try {
      const inline = typeof window !== 'undefined' ? window.BTS_ART_MANIFEST : null;
      this.manifest = inline || await (await fetch(`${this.base}manifest.json`, { cache: 'no-cache' })).json();
      await Promise.all([...this.imagePaths()].map((p) => this.loadImage(p)));
      this.ready = true;
    } catch (err) {
      this.failed = true;
      console.warn('Illustrated artwork not available; showing pixel art.', err.message);
    }
    this.listeners.splice(0).forEach((cb) => cb(this));
  }

  // Every image path the manifest refers to.
  imagePaths() {
    const m = this.manifest || {}, out = new Set();
    for (const g of Object.values(m.characters || {})) {
      if (g.image) out.add(g.image);
      for (const v of Object.values(g.variants || {})) if (v.image) out.add(v.image);
    }
    if (m.objects?.image) out.add(m.objects.image);
    for (const r of Object.values(m.rooms || {})) if (r.image) out.add(r.image);
    for (const f of Object.values(m.furniture || {})) if (f.image) out.add(f.image);
    for (const t of Object.values(m.textures || {})) if (typeof t === 'string') out.add(t); else if (t?.image) out.add(t.image);
    return out;
  }

  loadImage(path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.images.set(path, img); resolve(img); };
      img.onerror = () => { console.warn('Illustrated artwork: could not load', path); resolve(null); };
      img.src = this.base + path;
    });
  }

  image(path) { return (path && this.images.get(path)) || null; }

  // The frame for a character pose, honouring aliases and variants
  // (a missing variant falls back to A, then to whatever exists).
  frame(group, state, variant) {
    const g = this.manifest?.characters?.[group];
    if (!g) return null;
    let set = g;
    if (g.variants) set = g.variants[variant] || g.variants.A || Object.values(g.variants)[0];
    if (!set?.frames) return null;
    let f = set.frames[state];
    for (let guard = 0; f && f.alias && guard < 5; guard++) f = set.frames[f.alias];
    const img = this.image(set.image);
    return f && img ? { img, ...f } : null;
  }

  object(state) {
    const o = this.manifest?.objects;
    let f = o?.frames?.[state];
    for (let guard = 0; f && f.alias && guard < 5; guard++) f = o.frames[f.alias];
    const img = this.image(o?.image);
    return f && img ? { img, ...f } : null;
  }

  furniture(key) {
    const f = this.manifest?.furniture?.[key];
    const img = this.image(f?.image);
    return f && img ? { img, ...f } : null;
  }

  room(zoneId) {
    const r = this.manifest?.rooms?.[zoneId];
    const img = this.image(r?.image);
    return r && img ? { img, ...r } : null;
  }

  texture(name) {
    const t = this.manifest?.textures?.[name];
    const path = typeof t === 'string' ? t : t?.image;
    return this.image(path);
  }
}
