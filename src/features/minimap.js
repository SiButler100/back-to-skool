// ============================================================================
// FEATURE: Minimap
// ----------------------------------------------------------------------------
// A bird's-eye strip of the whole school with a dot for everyone. Eric is
// red, teachers are black (white on the dark in-picture map), pupils are
// blue, girls pink, Albert is brown. The box is what the main view is
// showing: in the modern view the map sits in the corner of the picture and
// the box follows the close camera up and down as well as along.
// ============================================================================

import { SKOOL } from '../data/skool.js';

export default {
  id: 'minimap',
  name: 'Minimap',
  description: 'Shows where everybody is across the whole school.',
  defaultOn: true,
  setup({ game, renderer, hud }) {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = SKOOL.width * scale; canvas.height = (SKOOL.height + 1) * scale;
    canvas.className = 'minimap';
    hud.addPanel('Where everyone is', canvas, 'minimap');
    const ctx = canvas.getContext('2d');

    const LIGHT = { ground: '#eef3f8', boys: '#f3d9cf', girls: '#f1e6cf', floor: '#9a9a9a', view: 'rgba(255,255,255,0.6)', box: '#6b5a48', eric: '#d8322a', albert: '#8a5a2a', adult: '#111', girl: '#e04070', boy: '#2a6fd6' };
    const DARK = { ground: null, boys: 'rgba(255,255,255,0.20)', girls: 'rgba(255,255,255,0.20)', floor: 'rgba(255,255,255,0.60)', view: 'rgba(255,211,77,0.16)', box: '#ffd34d', eric: '#ff5a5f', albert: '#d9a066', adult: '#ffffff', girl: '#ff9ac1', boy: '#7fb6ff' };

    const draw = () => {
      const modern = document.documentElement.classList.contains('view-modern');
      const pal = modern ? DARK : LIGHT;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (pal.ground) { ctx.fillStyle = pal.ground; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      // buildings
      ctx.fillStyle = pal.boys; ctx.fillRect(0, 0, 96 * scale, SKOOL.height * scale);
      ctx.fillStyle = pal.girls; ctx.fillRect(159 * scale, 0, 33 * scale, SKOOL.height * scale);
      ctx.fillStyle = pal.floor;
      for (const f of SKOOL.floors) ctx.fillRect(f.minX * scale, (f.y + 4) * scale - 1, (f.maxX - f.minX + 3) * scale, 1);
      for (const s of SKOOL.staircases) {
        const steps = s.bottom[1] - s.top[1]; const dir = s.top[0] > s.bottom[0] ? 1 : -1;
        for (let i = 0; i <= steps; i++) ctx.fillRect((s.bottom[0] + dir * i) * scale, (s.bottom[1] - i + 4) * scale - 1, scale, 1);
      }
      // view box: the columns on screen, and the rows too when the close camera shows only two storeys
      const [from, to] = game.visibleColumns;
      const top = Math.max(0, ((renderer.cameraY || 0) / SKOOL.cell) * scale);
      const height = Math.min(canvas.height - top, ((renderer.viewH || SKOOL.height * SKOOL.cell) / SKOOL.cell) * scale);
      ctx.fillStyle = pal.view; ctx.fillRect(from * scale, top, (to - from) * scale, height);
      ctx.strokeStyle = pal.box; ctx.lineWidth = 1; ctx.strokeRect(from * scale + 0.5, top + 0.5, (to - from) * scale - 1, height - 1);
      // people
      for (const c of game.cast.characterList) {
        if (!c.visible) continue;
        ctx.fillStyle = c.isEric() ? pal.eric : c.id === 'ALBERT' ? pal.albert : c.isAdult() ? pal.adult : (c.has('G') ? pal.girl : pal.boy);
        const size = c.isEric() ? 4 : 3;
        ctx.fillRect((c.x + 1) * scale - 1, (c.y + 4) * scale - size, size, size);
      }
    };
    let frame = 0;
    game.events.on('tick', () => { if (++frame % 4 === 0) draw(); });
    game.events.on('start', draw);
    draw();
  },
};
