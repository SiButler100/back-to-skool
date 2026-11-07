// Node has no canvas, so re-export the font measuring helpers (they are pure
// functions) for the headless tools.
export { measureText, fontHas } from '../src/render/font.js';
