// ============================================================================
// SMOOTH TEXT (speech bubbles, reprimand boxes and chalk for the illustrated view)
// ----------------------------------------------------------------------------
// The engine still thinks in the Spectrum's 8-pixel font: it wraps blackboard
// lines to fit the board and times a speech bubble by scrolling its words
// through an eight-cell window. That timing is left alone. What changes here
// is only what is DRAWN: the whole sentence at once in a proper bubble above
// the speaker, revealed as the engine's scroll advances, in real type.
//
// Speech keeps its capitals, as comic lettering does.
// ============================================================================

export const UI_FONT = '"Ubuntu", system-ui, sans-serif';
export const CHALK_FONT = '"Patrick Hand", "Ubuntu", system-ui, sans-serif';

// Ask the browser to fetch the faces now, so the first bubble is not drawn in
// a fallback font. Harmless if a face is missing: the next in the list is used.
export function loadFonts() {
  if (typeof document === 'undefined' || !document.fonts) return;
  for (const f of [`400 20px ${UI_FONT}`, `300 20px ${UI_FONT}`, `400 20px ${CHALK_FONT}`]) document.fonts.load(f).catch(() => {});
}

// Break `text` into lines no wider than maxW for the context's current font.
export function wrapText(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// A speech bubble. `u` is the unit (canvas pixels per sixth of a Spectrum
// pixel: 1 at scale 6), `mouth` the point the tail aims at, `view` the visible
// strip {x0, x1} in canvas pixels, `progress` 0..1 how far the engine has
// scrolled the words (they are fully shown by 55% so there is time to read).
export function drawSpeech(ctx, text, mouth, view, progress, u) {
  const size = Math.round(23 * u), lh = Math.round(29 * u), padX = Math.round(16 * u), padY = Math.round(11 * u);
  ctx.save();
  ctx.font = `400 ${size}px ${UI_FONT}`;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  try { ctx.letterSpacing = `${(0.4 * u).toFixed(1)}px`; } catch (e) { /* older browsers */ }
  const lines = wrapText(ctx, text, 560 * u);
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), 40 * u) + padX * 2;
  const h = lines.length * lh + padY * 2 - Math.round(4 * u);
  const tail = Math.round(14 * u);
  let x = Math.max(view.x0 + 8 * u, Math.min(view.x1 - w - 8 * u, mouth.x - w / 2));
  let y = Math.max(view.y0 + 6 * u, mouth.y - tail - h);
  x = Math.round(x); y = Math.round(y);
  const tipX = Math.max(x + 22 * u, Math.min(x + w - 22 * u, mouth.x));
  const path = () => {
    roundedRect(ctx, x, y, w, h, 16 * u);
    ctx.moveTo(tipX - 10 * u, y + h - 1); ctx.lineTo(tipX + 2 * u * Math.sign(mouth.x - tipX || 1), y + h + tail); ctx.lineTo(tipX + 10 * u, y + h - 1); ctx.closePath();
  };
  ctx.fillStyle = 'rgba(20,24,34,0.28)'; ctx.translate(0, 4 * u); path(); ctx.fill(); ctx.translate(0, -4 * u);
  ctx.fillStyle = '#fffdf6'; path(); ctx.fill();
  ctx.lineWidth = Math.max(1, 1.5 * u); ctx.strokeStyle = 'rgba(38,44,60,0.75)'; ctx.lineJoin = 'round'; path(); ctx.stroke();
  ctx.fillStyle = '#fffdf6'; ctx.fillRect(tipX - 9 * u, y + h - 2.5 * u, 18 * u, 3 * u);     // hide the outline where the tail joins
  // The words, revealed as the engine's scroll advances.
  const total = lines.reduce((n, l) => n + l.length, 0);
  let budget = Math.ceil(total * Math.min(1, progress / 0.55));
  ctx.fillStyle = '#1d2330';
  lines.forEach((l, i) => {
    if (budget <= 0) return;
    ctx.fillText(l.slice(0, budget), x + padX, y + padY + size * 0.82 + i * lh);
    budget -= l.length;
  });
  ctx.restore();
}

// A reprimand ("100 LINES ERIC") or a secret: a card in the colour of its kind.
export function drawCard(ctx, lines, centre, view, colours, u) {
  const size = Math.round(24 * u), lh = Math.round(31 * u), padX = Math.round(20 * u), padY = Math.round(12 * u);
  ctx.save();
  ctx.font = `400 ${size}px ${UI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  try { ctx.letterSpacing = `${(0.8 * u).toFixed(1)}px`; } catch (e) { /* older browsers */ }
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width), 120 * u) + padX * 2;
  const h = lines.length * lh + padY * 2 - Math.round(5 * u);
  const x = Math.round(Math.max(view.x0 + 8 * u, Math.min(view.x1 - w - 8 * u, centre.x - w / 2)));
  const y = Math.round(Math.max(view.y0 + 8 * u, Math.min((view.y1 ?? Infinity) - h - 12 * u, centre.y - h)));
  ctx.fillStyle = 'rgba(20,24,34,0.35)'; roundedRect(ctx, x + 3 * u, y + 5 * u, w, h, 12 * u); ctx.fill();
  ctx.fillStyle = colours.paper; roundedRect(ctx, x, y, w, h, 12 * u); ctx.fill();
  ctx.lineWidth = Math.max(1, 2 * u); ctx.strokeStyle = colours.edge; roundedRect(ctx, x, y, w, h, 12 * u); ctx.stroke();
  ctx.fillStyle = colours.ink;
  lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + padY + size * 0.82 + i * lh));
  ctx.restore();
}

// Chalk on a blackboard: each line the engine has written so far, in a hand,
// squeezed if need be into the width the engine measured for it.
export function drawChalkLines(ctx, lines, x, y, lineH, maxW, colour, u) {
  ctx.save();
  ctx.font = `400 ${Math.round(lineH * 0.86)}px ${CHALK_FONT}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = colour; ctx.globalAlpha = 0.92;
  lines.forEach((line, i) => ctx.fillText(line, x, y + lineH * (i + 0.8), maxW));
  ctx.restore();
}
