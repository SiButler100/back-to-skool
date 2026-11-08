// ============================================================================
// SPRITE PREVIEW (developer page, not part of the game)
// ----------------------------------------------------------------------------
// Open http://127.0.0.1:8765/tools/preview/index.html (with the repo served by
// any static server) to see every HD sprite the painter can produce, plus the
// objects, the furniture and the whole backdrop. Used to review artwork
// quickly; nothing here is imported by the game.
// ============================================================================

import { ModernPainter } from '../../src/render/hd/painter.js';
import { IllustratedPainter } from '../../src/render/art/illustrated.js';
import { ArtAssets } from '../../src/render/art/assets.js';
import { THEMES } from '../../src/render/theme.js';
import { SPRITE_GROUPS, CHARACTERS, ERIC } from '../../src/data/cast.js';

import { OBJECT_ART } from '../../src/render/hd/objects.js';

const params = new URLSearchParams(location.search);
const zoom = Number(params.get('zoom') || 3);
const art = params.get('art') || 'pixel';
// ?art=illustrated shows the generated artwork (loaded from ../../assets/illustrated) with pixel-art fallbacks.
let painter;
if (art === 'illustrated') {
  const assets = new ArtAssets(new URL('../../assets/illustrated/', location.href).href);
  await assets.load();
  painter = new IllustratedPainter(THEMES.modern, assets);
} else painter = new ModernPainter(THEMES.modern);
const FW = 24 * painter.scale, FH = 32 * painter.scale;   // the character box at this painter's scale
const out = document.getElementById('out');

// The look of one representative character per group (first in the data).
const lookFor = (group) => group === 'ERIC' ? ERIC.look : (CHARACTERS.find((c) => c.group === group) || {}).look || {};

function section(title) { const h = document.createElement('h2'); h.textContent = title; out.appendChild(h); }

const missing = [];
for (const [group, states] of Object.entries(SPRITE_GROUPS)) {
  section(group);
  const cols = states.length;
  const canvas = document.createElement('canvas');
  const cellW = FW * zoom + 8, cellH = FH * zoom + 22;
  canvas.width = cols * cellW; canvas.height = 2 * cellH;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  states.forEach((state, i) => {
    [1, -1].forEach((dir, r) => {
      const x = i * cellW, y = r * cellH;
      // Draw through the painter so illustrated frames (with their overhang) show as the game draws them.
      const S = painter.scale, cell = 8 * S;
      const frame = document.createElement('canvas'); frame.width = FW + 2 * cell; frame.height = FH + 2 * cell;
      const fctx = frame.getContext('2d'); fctx.imageSmoothingEnabled = !!painter.smooth;
      const before = painter.stats ? painter.stats.fallback : 0;
      const ok = painter.drawSprite(fctx, group, state, dir, lookFor(group), 8, 8);
      const usedFallback = painter.stats ? painter.stats.fallback > before : !ok;
      ctx.fillStyle = '#2f343b'; ctx.fillRect(x, y + 16, FW * zoom, FH * zoom);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      for (let g = 1; g < 3; g++) { ctx.beginPath(); ctx.moveTo(x + g * cell * zoom + 0.5, y + 16); ctx.lineTo(x + g * cell * zoom + 0.5, y + 16 + FH * zoom); ctx.stroke(); }
      for (let g = 1; g < 4; g++) { ctx.beginPath(); ctx.moveTo(x, y + 16 + g * cell * zoom + 0.5); ctx.lineTo(x + FW * zoom, y + 16 + g * cell * zoom + 0.5); ctx.stroke(); }
      ctx.imageSmoothingEnabled = !!painter.smooth;
      ctx.drawImage(frame, x - cell * zoom, y + 16 - cell * zoom, frame.width * zoom, frame.height * zoom);
      if (!ok || (art === 'illustrated' && usedFallback)) { ctx.strokeStyle = '#ff2fd0'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 17, FW * zoom - 2, FH * zoom - 2); if (r === 0) missing.push(`${group}/${state}`); }
      ctx.fillStyle = '#cfd6de'; ctx.font = '11px Ubuntu, sans-serif'; ctx.fillText(state, x, y + 11);
    });
  });
  out.appendChild(canvas);
}

// Objects: one frame per state.
section('Objects');
{
  const states = Object.keys(OBJECT_ART);
  const cellW = FW * zoom + 8, cellH = FH * zoom + 22;
  const canvas = document.createElement('canvas'); canvas.width = states.length * cellW; canvas.height = cellH;
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
  states.forEach((state, i) => {
    const x = i * cellW;
    ctx.fillStyle = '#2f343b'; ctx.fillRect(x, 16, FW * zoom, FH * zoom);
    const s = painter.sprite('OBJ', state, 1, {});
    if (s) ctx.drawImage(s, x, 16, FW * zoom, FH * zoom);
    ctx.fillStyle = '#cfd6de'; ctx.font = '11px Ubuntu, sans-serif'; ctx.fillText(state, x, 11);
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
