// ============================================================================
// FEATURE: Teacher radar
// ----------------------------------------------------------------------------
// Lists the staff with how far away they are and which way they face. A
// teacher who is close AND facing Eric is highlighted, because that is when
// lines happen. Also shows who is meant to be teaching Eric this period.
//
// This is a template for the kind of "quality of life" addition the original
// never had. Copy it to make your own.
// ============================================================================

export default {
  id: 'teacher-radar',
  name: 'Teacher radar',
  description: 'Who is nearby, which way they are looking, and who is teaching you.',
  defaultOn: true,
  setup({ game, hud }) {
    const el = document.createElement('ul');
    el.className = 'radar';
    hud.addPanel('Staff room', el);
    const staff = ['WACKER', 'WITHIT', 'ROCKITT', 'CREAK', 'TAKE', 'ALBERT'].map((id) => game.cast.get(id));

    const render = () => {
      const eric = game.cast.eric;
      const teacherId = game.timetable.teacherId();
      el.innerHTML = staff.map((t) => {
        const dx = t.x - eric.x, dy = t.y - eric.y;
        const dist = Math.abs(dx);
        const sameFloor = dy === 0;
        const facingEric = t.direction * (eric.x - t.x) >= 0;
        const watching = sameFloor && dist <= 10 && facingEric && t.canGiveLines();
        const where = sameFloor ? `${dist} cells ${dx < 0 ? 'left' : 'right'}` : `${dy < 0 ? 'upstairs' : 'downstairs'}`;
        return `<li class="${watching ? 'watching' : ''} ${t.id === teacherId ? 'mine' : ''}">
          <span class="name">${t.name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')}</span>
          <span class="where">${where}, facing ${t.direction < 0 ? 'left' : 'right'}</span>
          ${t.id === teacherId ? '<span class="tag">your teacher</span>' : ''}
          ${watching ? '<span class="tag warn">can see you</span>' : ''}
        </li>`;
      }).join('');
    };
    let frame = 0;
    game.events.on('tick', () => { if (++frame % 10 === 0) render(); });
    game.events.on('start', render);
    render();
  },
};
