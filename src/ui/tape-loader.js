// ============================================================================
// TAPE LOADER (bring your own copy of the game)
// ----------------------------------------------------------------------------
// A small panel that appears in the original view while no original graphics
// are loaded. The player picks their Back to Skool tape image (.tzx) or a
// snapshot (.z80 / .sna); the graphics are extracted in the browser and kept
// in local storage. Nothing is uploaded anywhere.
// ============================================================================

import { loadSnapshot, extractGraphics } from '../render/extract.js';

export class TapeLoader {
  constructor(container, renderer, onChange = () => {}) {
    this.container = container;
    this.renderer = renderer;
    this.onChange = onChange;
    this.build();
  }

  build() {
    this.container.innerHTML = `
      <div class="tape-loader" id="tape-loader">
        <div class="tape-text">
          <strong>Original graphics not loaded.</strong> This view is using painted stand-ins. To see the 1985 artwork, load your own copy of
          Back to Skool: a tape image (<code>.tzx</code>) or a snapshot (<code>.z80</code>, <code>.sna</code>). It stays in your browser; nothing is sent anywhere.
        </div>
        <label class="tape-button">Choose file<input type="file" id="tape-file" accept=".tzx,.z80,.sna" hidden></label>
        <span class="tape-status" id="tape-status"></span>
      </div>`;
    this.el = this.container.querySelector('#tape-loader');
    this.status = this.container.querySelector('#tape-status');
    this.container.querySelector('#tape-file').addEventListener('change', (e) => this.load(e.target.files[0]));
  }

  async load(file) {
    if (!file) return;
    this.status.textContent = 'Reading…';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mem = loadSnapshot(bytes, file.name);
      const gfx = extractGraphics(mem);
      this.renderer.original.installGraphics(gfx);
      this.status.textContent = 'Loaded. Enjoy 1985.';
      this.onChange(true);
    } catch (err) {
      this.status.textContent = `Could not use that file: ${err.message}`;
    }
  }

  forget() { this.renderer.original.forget(); this.onChange(false); }

  // Show the panel only when the original view wants graphics it hasn't got.
  update(view) {
    const needed = view === 'original' && !this.renderer.original.ready;
    this.el.hidden = !needed;
  }
}
