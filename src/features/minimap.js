// ============================================================================
// FEATURE: Minimap
// ----------------------------------------------------------------------------
// A bird's-eye strip of the whole school with a dot for everyone. Eric is
// red, teachers are black, pupils are blue, Albert is brown. The pale box is
// what the main view is currently showing.
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
    hud.addPanel('Where everyone is', canvas);
    const ctx = canvas.getContext('2d');

    const colourFor = (c) => c.isEric() ? '#d8322a' : c.id === 'ALBERT' ? '#8a5a2a' : c.isAdult() ? '#111' : (c.has('G') ? '#e04070' : '#2a6fd6');

    const draw = () => {
      ctx.fillStyle = '#eef3f8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      // buildings
      ctx.fillStyle = '#f3d9cf'; ctx.fillRect(0, 0, 96 * scale, SKOOL.height * scale);
      ctx.fillStyle = '#f1e6cf'; ctx.fillRect(159 * scale, 0, 33 * scale, SKOOL.height * scale);
      ctx.fillStyle = '#9a9a9a';
      for (const f of SKOOL.floors) ctx.fillRect(f.minX * scale, (f.y + 4) * scale - 1, (f.maxX - f.minX + 3) * scale, 1);
      for (const s of SKOOL.staircases) {
        const steps = s.bottom[1] - s.top[1]; const dir = s.top[0] > s.bottom[0] ? 1 : -1;
        for (let i = 0; i <= steps; i++) ctx.fillRect((s.bottom[0] + dir * i) * scale, (s.bottom[1] - i + 4) * scale - 1, scale, 1);
      }
      // view box
      const [from, to] = game.visibleColumns;
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(from * scale, 0, (to - from) * scale, canvas.height);
      ctx.strokeStyle = '#6b5a48'; ctx.lineWidth = 1; ctx.strokeRect(from * scale + 0.5, 0.5, (to - from) * scale - 1, canvas.height - 1);
      // people
      for (const c of game.cast.characterList) {
        if (!c.visible) continue;
        ctx.fillStyle = colourFor(c);
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
