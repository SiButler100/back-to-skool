// ============================================================================
// THE CAMERA (a shift lens, as used for photographing buildings)
// ----------------------------------------------------------------------------
// The school is modelled like a doll's house: open at the front, the rooms'
// back walls at depth 0, and the people standing a little way out from them
// at the "action depth". Depth is measured in cells towards the viewer.
//
// An ordinary camera tilted down to see the floors would make uprights lean
// and would stretch the picture, so nothing would sit where the game's rules
// say it is. Instead the lens sits above the view and looks straight ahead,
// and the picture is taken off-centre (which is what a shift lens does).
// Two things follow, and the whole 3D view relies on them:
//   1. floors are seen from slightly above, so the model has real depth;
//   2. everything AT THE ACTION DEPTH lands exactly where the flat view would
//      put it. A cell is a cell. Speech bubbles, effects and the aiming help
//      can therefore be drawn on a flat canvas laid over the 3D picture.
// Things nearer or further than the action depth shift a little towards or
// away from the point under the lens: that shift is the depth you see.
// ============================================================================

export const ACTION_Z = 2.0;        // how far out from the back wall the people stand, in cells
export const LENS_DISTANCE = 56;    // cells from the action depth to the lens (long, so depth is gentle)
export const LENS_LIFT = 6;         // cells the lens sits above the top edge of the view

// Point the camera so that the rectangle `view` (x0 = left column, y0 = top
// row, w and h in cells, measured at the action depth) exactly fills the picture.
// Rows count downwards in the game and upwards in 3D, so row r is height -r.
export function frameShiftLens(camera, view) {
  const lens = { x: view.x0 + view.w / 2, y: -view.y0 + LENS_LIFT };
  camera.position.set(lens.x, lens.y, ACTION_Z + LENS_DISTANCE);
  camera.rotation.set(0, 0, 0);
  camera.updateMatrix();
  camera.updateMatrixWorld(true);
  const near = 8, far = 4000, k = near / LENS_DISTANCE;
  const top = -view.y0;
  camera.projectionMatrix.makePerspective((view.x0 - lens.x) * k, (view.x0 + view.w - lens.x) * k, (top - lens.y) * k, (top - view.h - lens.y) * k, near, far);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return lens;
}

// Something at depth z looks smaller (further) or bigger (nearer) than it
// would at the action depth, by this factor.
export const depthScale = (z) => (LENS_DISTANCE + ACTION_Z - z) / LENS_DISTANCE;

// Where to put something at depth z so that it APPEARS at column `col`, row
// `row` (as measured at the action depth) through a lens at `lens`. Used for
// the far scenery, which is placed by where it should be seen.
export function placeAtDepth(col, row, z, lens) {
  const k = depthScale(z);
  return { x: lens.x + (col - lens.x) * k, y: lens.y + (-row - lens.y) * k, k };
}

// Draw order for see-through things: further back first. (Solid things sort
// themselves out; see-through ones must be drawn back to front.)
export const orderFor = (z, i = 0) => Math.round(z * 100) * 100 + i;
