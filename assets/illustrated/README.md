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
- `characters/` one sheet per sprite group (`boy-a.png` is variant A of the
  plain boys; more variants can be added as `boy-b.png` and so on).
- `rooms/`, `furniture/`, `textures/` are filled by later passes.

The raw generations (`art-src/`) and intermediate cut-outs (`art-work/`) are
not committed. `tools/art/jobs.json` records every generation (model, job id,
download URL, grid, pose order) so any sheet can be fetched and rebuilt.
