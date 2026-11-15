// ============================================================================
// SMALL PARTS (the few shapes the whole 3D school is made from)
// ----------------------------------------------------------------------------
// Everything in the model is a flat rectangle: a wall, a floor, a face of a
// stair, a painted figure standing up like a card. These helpers make such
// rectangles and put pictures on them.
//
// Sizes are in cells (8 Spectrum pixels). The illustrated artwork is drawn 48
// picture-pixels to the cell, so one picture-pixel is U = 1/48 of a cell.
// ============================================================================

import * as THREE from './three.js';
import { orderFor } from './camera.js';

export const U = 1 / 48;

// One GPU texture per picture, however many shapes use it.
const textures = new Map();
export function textureOf(image) {
  let t = textures.get(image);
  if (!t) {
    t = new THREE.Texture(image);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;                 // keeps floors sharp when seen at a shallow angle
    t.needsUpdate = true;
    textures.set(image, t);
  }
  return t;
}
export function forgetTextures() { for (const t of textures.values()) t.dispose(); textures.clear(); }

// The part of a picture sheet a frame occupies, as the four numbers a shape
// needs: left, bottom, right, top, each 0..1 across the sheet.
export function uvOf(f) {
  const W = f.img.width, H = f.img.height;
  return [f.x / W, 1 - (f.y + f.h) / H, (f.x + f.w) / W, 1 - f.y / H];
}
// A whole picture as a frame.
export const wholeImage = (img) => ({ img, x: 0, y: 0, w: img.width, h: img.height });

// A rectangle: one corner `o`, and its two edges `a` and `b` from that corner.
// It faces the way a x b points. `uv` is [left, bottom, right, top].
export function rect(o, a, b, uv = [0, 0, 1, 1]) {
  const g = new THREE.BufferGeometry();
  const p1 = [o[0] + a[0], o[1] + a[1], o[2] + a[2]];
  const p2 = [p1[0] + b[0], p1[1] + b[1], p1[2] + b[2]];
  const p3 = [o[0] + b[0], o[1] + b[1], o[2] + b[2]];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...o, ...p1, ...p2, ...p3], 3));
  const [u0, v0, u1, v1] = uv;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v0, u1, v0, u1, v1, u0, v1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

// A solid block seen from the front and above: its front, top and two ends.
// (Nobody ever sees the back or the underside.) `mat` gives a material for
// each face, and `tile` how many cells one repeat of its picture covers.
export function block(parent, x0, x1, y0, y1, z0, z1, mat, tile = 4) {
  const w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const add = (geometry, material) => {
    if (!material) return;
    const m = new THREE.Mesh(geometry, material);
    m.receiveShadow = true;
    parent.add(m);
  };
  add(rect([x0, y0, z1], [w, 0, 0], [0, h, 0], [0, 0, w / tile, h / tile]), mat.front);
  add(rect([x0, y1, z1], [w, 0, 0], [0, 0, -d], [0, 0, w / tile, d / tile]), mat.top);
  add(rect([x0, y0, z0], [0, 0, d], [0, h, 0], [0, 0, d / tile, h / tile]), mat.side || mat.front);
  add(rect([x1, y0, z1], [0, 0, -d], [0, h, 0], [0, 0, d / tile, h / tile]), mat.side || mat.front);
}

// A picture standing upright, facing the viewer: a cut-out. `left` and
// `bottom` are where its lower-left corner goes; its size defaults to the
// picture's own. See-through edges are kept soft, so cut-outs are drawn back
// to front (renderOrder) and do not hide what is behind their empty parts.
export function cutout(parent, f, left, bottom, z, { w = f.w * U, h = f.h * U, uv = uvOf(f), shadow = false, opaque = false } = {}) {
  const map = textureOf(f.img);
  const material = new THREE.MeshBasicMaterial({ map, transparent: !opaque, depthWrite: opaque });
  const m = new THREE.Mesh(rect([left, bottom, z], [w, 0, 0], [0, h, 0], uv), material);
  m.renderOrder = orderFor(z);
  if (shadow) castsShadow(m);
  parent.add(m);
  return m;
}

// Make a cut-out cast a shadow in the shape of its picture, not of its card.
export function castsShadow(mesh) {
  mesh.castShadow = true;
  // "Ignore anything fainter than this": with it set, the library cuts the
  // shadow to the picture's outline by itself.
  mesh.material.alphaTest = 0.35;
  // A card has only a front. The library normally draws shadows from the
  // backs of things (it avoids speckles on solid shapes), which for a card
  // facing the sun means no shadow at all: so both sides are used.
  mesh.material.shadowSide = THREE.DoubleSide;
}
