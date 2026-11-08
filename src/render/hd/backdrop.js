// ============================================================================
// HD BACKDROP
// ----------------------------------------------------------------------------
// The school building for the HD view, painted once to an offscreen canvas at
// the HD scale. Milestone 1 simply enlarges the painted (legacy) backdrop so
// the game is playable; milestone 4 replaces this with the pixel-art building
// drawn from data/skool.js and data/decor.js.
// ============================================================================

import { SKOOL } from '../../data/skool.js';
import { buildBackdrop } from '../backdrop.js';
import { makeCanvas } from './pixelart.js';

export function buildHdBackdrop(theme, scale) {
  const base = buildBackdrop(theme);
  const canvas = makeCanvas(SKOOL.width * SKOOL.cell * scale, SKOOL.height * SKOOL.cell * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  return canvas;
}
