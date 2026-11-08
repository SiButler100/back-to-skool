// ============================================================================
// WARDROBE (who wears what, in the HD view)
// ----------------------------------------------------------------------------
// The pixel art uses colour "slots" (see pixelart.js). This file decides the
// actual colours for a character: the group's uniform here, overridden by the
// per-character "look" fields in data/cast.js (hair, suit, dress), with shaded
// variants worked out automatically.
// ============================================================================

import { shade } from './pixelart.js';

// t = top, p = bottoms, k = socks, o = shoes, e = accent (tie, collar).
export const WARDROBE = {
  ERIC:     { t: '#d8322a', p: '#2b2b48', k: '#f5f5f5', o: '#23232b', e: '#2b2b48' },
  BOY:      { t: '#2a4a9a', p: '#3a3a3a', k: '#dddddd', o: '#23232b', e: '#d8322a' },
  SWOT:     { t: '#2f8f4f', p: '#3a3a3a', k: '#dddddd', o: '#23232b', e: '#f5d300' },
  BULLY:    { t: '#6b3f1e', p: '#2b2b2b', k: '#dddddd', o: '#23232b', e: '#2b2b2b' },
  TEARAWAY: { t: '#e0a030', p: '#4a3a2a', k: '#dddddd', o: '#23232b', e: '#4a3a2a' },
  GIRL:     { t: '#2f7df6', p: '#2f7df6', k: '#ffffff', o: '#23232b', e: '#ffffff' },
  HEROINE:  { t: '#e04070', p: '#e04070', k: '#ffffff', o: '#23232b', e: '#ffffff' },
  WACKER:   { t: '#1b1b1b', p: '#1b1b1b', k: '#1b1b1b', o: '#000000', e: '#ffffff' },
  WITHIT:   { t: '#4b6b3a', p: '#3a4a2a', k: '#3a4a2a', o: '#23232b', e: '#d8322a' },
  ROCKITT:  { t: '#f4f4f4', p: '#4a4a5a', k: '#4a4a5a', o: '#23232b', e: '#2f6fd6' },
  CREAK:    { t: '#5a4a3a', p: '#3a3028', k: '#3a3028', o: '#23232b', e: '#8a2a2a' },
  TAKE:     { t: '#7a2a7a', p: '#7a2a7a', k: '#f5f5f5', o: '#23232b', e: '#ffffff' },
  ALBERT:   { t: '#6a5a3a', p: '#4a4030', k: '#4a4030', o: '#23232b', e: '#4a4030' },
};

export const ADULTS = new Set(['WACKER', 'WITHIT', 'ROCKITT', 'CREAK', 'TAKE', 'ALBERT']);
export const PEOPLE = new Set(Object.keys(WARDROBE));

const dressCache = new WeakMap();   // look object -> colours (looks are long-lived objects on characters)

// The colours for every slot letter, for this character.
export function dressFor(group, look = {}) {
  let byGroup = dressCache.get(look);
  if (!byGroup) { byGroup = new Map(); dressCache.set(look, byGroup); }
  if (byGroup.has(group)) return byGroup.get(group);
  const wd = WARDROBE[group] || WARDROBE.BOY;
  const t = look.suit || look.dress || wd.t;
  const p = look.dress || wd.p;
  const h = look.hair || '#3a2a1a';
  const colours = {
    t, u: shade(t), p, q: shade(p), h, i: shade(h, 0.65), k: wd.k, o: wd.o, e: wd.e,
  };
  byGroup.set(group, colours);
  return colours;
}

// A short string that identifies a look for cache keys (computed once per look).
const keyCache = new WeakMap();
export function lookKey(look = {}) {
  let k = keyCache.get(look);
  if (!k) { k = JSON.stringify(look); keyCache.set(look, k); }
  return k;
}
