# Illustrated artwork

Pictures for the modern view's illustrated artwork. Nothing here is from the
1985 game: every image was generated for this project with an image model
(Higgsfield, model `gpt_image_2_6`) from the prompts recorded in
`tools/art/`, then cut, scaled and packed by `tools/art/build.py`.

- `manifest.json` says which picture holds each character's pose, where the
  frame is in the sheet (`x, y, w, h`) and how far its top-left corner sits
  from the top-left of the character's 96×128 box (`ox, oy`). An `alias`
  entry reuses another pose's frame. The game reads only this file and the
  images it names, so artwork can be replaced without touching code.
- `characters/` one sheet per sprite group; the plain boys and girls have
  three looks each (`boy-a.png`, `boy-b.png`, `boy-c.png`), chosen by each
  pupil's `look.variant` in `src/data/cast.js`.
- `objects.png` the frog, mouse, conker, plants, stinkbomb, water, pellet,
  desk lids and fallen bike, each placed where the pixel art puts it.
- `furniture/items.png` doors, windows, gate, cabinet, safe, cups, blackboard,
  desk and chair, railings, bike, conker in the tree, and the tree.
- `rooms/` one JPEG per room zone (see `src/data/decor.js`), fitted to the
  wall by `src/render/art/backdrop.js`; the floor line is the bottom edge.

The raw generations (`art-src/`) and intermediate cut-outs (`art-work/`) are
not committed. `tools/art/jobs.json` records every generation (model, job id,
download URL, grid, pose order) so any sheet can be fetched and rebuilt.
