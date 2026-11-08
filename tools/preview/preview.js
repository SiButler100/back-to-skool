// ============================================================================
// SPRITE PREVIEW (developer page, not part of the game)
// ----------------------------------------------------------------------------
// Open http://127.0.0.1:8765/tools/preview/index.html (with the repo served by
// any static server) to see every HD sprite the painter can produce, plus the
// objects, the furniture and the whole backdrop. Used to review artwork
// quickly; nothing here is imported by the game.
// ============================================================================

import { ModernPainter } from '../../src/render/hd/painter.js';
import { THEMES } from '../../src/render/theme.js';
import { SPRITE_GROUPS, CHARACTERS, ERIC } from '../../src/data/cast.js';
import { FRAME_W, FRAME_H } from '../../src/render/hd/pixelart.js';

const zoom = Number(new URLSearchParams(location.search).get('zoom') || 3);
const painter = new ModernPainter(THEMES.modern);
const out = document.getElementById('out');

// The look of one representative character per group (first in the data).
const lookFor = (group) => group === 'ERIC' ? ERIC.look : (CHARACTERS.find((c) => c.group === group) || {}).look || {};

function section(title) { const h = document.createElement('h2'); h.textContent = title; out.appendChild(h); }

const missing = [];
for (const [group, states] of Object.entries(SPRITE_GROUPS)) {
  section(group);
  const cols = states.length;
  const canvas = document.createElement('canvas');
  const cellW = FRAME_W * zoom + 8, cellH = FRAME_H * zoom + 22;
  canvas.width = cols * cellW; canvas.height = 2 * cellH;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  states.forEach((state, i) => {
    [1, -1].forEach((dir, r) => {
      const x = i * cellW, y = r * cellH;
      const s = painter.sprite(group, state, dir, lookFor(group));
      ctx.fillStyle = '#2f343b'; ctx.fillRect(x, y + 16, FRAME_W * zoom, FRAME_H * zoom);
      // cell grid (8 px cells at the sprite's scale)
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let g = 1; g < 3; g++) { ctx.beginPath(); ctx.moveTo(x + g * 16 * zoom + 0.5, y + 16); ctx.lineTo(x + g * 16 * zoom + 0.5, y + 16 + FRAME_H * zoom); ctx.stroke(); }
      for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(x, y + 16 + g * 16 * zoom + 0.5); ctx.lineTo(x + FRAME_W * zoom, y + 16 + g * 16 * zoom + 0.5); ctx.stroke(); }
      if (s) ctx.drawImage(s, x, y + 16, FRAME_W * zoom, FRAME_H * zoom);
      else { ctx.strokeStyle = '#ff2fd0'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 17, FRAME_W * zoom - 2, FRAME_H * zoom - 2); if (r === 0) missing.push(`${group}/${state}`); }
      ctx.fillStyle = '#cfd6de'; ctx.font = '11px Ubuntu, sans-serif'; ctx.fillText(state, x, y + 11);
    });
  });
  out.appendChild(canvas);
}

section('Missing HD art');
const p = document.createElement('p'); p.className = 'note';
p.textContent = missing.length ? `${missing.length} states still use the painted stand-in: ${missing.join(', ')}` : 'None: every state has HD art.';
out.appendChild(p);

section('Backdrop');
const b = painter.ensureBackdrop();
const bc = document.createElement('canvas'); bc.width = Math.min(b.width, 3072); bc.height = b.height;
bc.style.width = '100%'; bc.style.height = 'auto';
bc.getContext('2d').drawImage(b, 0, 0);
out.appendChild(bc);
window.preview = { painter, missing };
