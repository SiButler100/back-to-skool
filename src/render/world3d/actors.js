// ============================================================================
// THE CAST AS CUT-OUTS (everyone and everything that moves)
// ----------------------------------------------------------------------------
// Each person and object is a flat card standing at the action depth, showing
// one picture from the illustrated sheets. Which picture, where, and facing
// which way is decided elsewhere (the renderer, with render/motion.js); this
// file only stands the cards up. A card is kept for each thing and re-used
// from frame to frame, with a second card behind it for the moments when one
// pose is turning into another and both pictures show at once.
// ============================================================================

import * as THREE from './three.js';
import { orderFor } from './camera.js';
import { U, textureOf, castsShadow } from './parts.js';

const BOX_W = 144;      // a character's 3-cell box in picture-pixels (frames are placed relative to it)

export class Actors {
  constructor(parent) {
    this.parent = parent;
    this.cards = new Map();       // thing id -> [front card, second card]
  }

  // `list` is everything to show this frame:
  //   { id, x, y, z, order, shadow, layers: [{ f, flip, alpha }, ...] }
  // x and y are the top-left of the thing's box in cells (fractions allowed),
  // z its depth, f a frame from the artwork manifest.
  sync(list) {
    const seen = new Set();
    for (const a of list) {
      seen.add(a.id);
      let pair = this.cards.get(a.id);
      if (!pair) { pair = [this.makeCard(), this.makeCard()]; this.cards.set(a.id, pair); }
      for (let i = 0; i < 2; i++) {
        const layer = a.layers[i];
        if (layer && layer.f) this.show(pair[i], a, layer, i); else pair[i].visible = false;
      }
    }
    for (const [id, pair] of this.cards) if (!seen.has(id)) { pair[0].visible = false; pair[1].visible = false; }
  }

  makeCard() {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    castsShadow(card);
    card.visible = false;
    this.parent.add(card);
    return card;
  }

  show(card, a, layer, i) {
    const f = layer.f, W = f.img.width, H = f.img.height;
    const map = textureOf(f.img);
    if (card.material.map !== map) {
      card.material.map = map; card.material.needsUpdate = true;
    }
    // Which part of the sheet: swapped left for right when facing left.
    let u0 = f.x / W, u1 = (f.x + f.w) / W;
    if (layer.flip) [u0, u1] = [u1, u0];
    const top = 1 - f.y / H, bottom = 1 - (f.y + f.h) / H;
    const uv = card.geometry.attributes.uv;      // corners in order: top-left, top-right, bottom-left, bottom-right
    uv.setXY(0, u0, top); uv.setXY(1, u1, top); uv.setXY(2, u0, bottom); uv.setXY(3, u1, bottom);
    uv.needsUpdate = true;
    // Where: a frame may overhang its box (a raised arm, a lying figure), and
    // says by how much. Mirrored, the overhang is on the other side.
    const w = f.w * U, h = f.h * U;
    const left = a.x + (layer.flip ? -(f.w - f.ox - BOX_W) : -f.ox) * U;
    const topRow = a.y - f.oy * U;
    card.position.set(left + w / 2, -topRow - h / 2, a.z + i * 0.002);
    card.scale.set(w, h, 1);
    card.material.opacity = layer.alpha;
    card.renderOrder = orderFor(a.z, (a.order || 0) * 2 + i);
    card.castShadow = !!a.shadow && layer.alpha > 0.6;
    card.visible = true;
  }
}
