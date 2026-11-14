# Back to Skool (browser remake)

A faithful, from-scratch remake of the 1985 ZX Spectrum game *Back to Skool* (Microsphere; David Reidy and Keith Warrington), built so that the look can be modernised and new features bolted on without touching the core rules.

It runs in any modern browser. No install, no build step for playing.

## Play it

- **Hosted:** open the published page (link in the chat where this was delivered).
- **Locally, no server needed:** double-click `dist/back-to-skool.html`. Everything is inlined into that one file.
- **Locally, from source:** open the folder in VS Code and use the *Live Server* extension (or any static server) and visit `index.html`. Opening `index.html` directly from the filing system will not work because browsers block JavaScript modules on `file://` addresses.

## Controls

The cursor keys to move and four action keys in a row under the left hand. The game works out which tool fits what is in front of Eric.

| Key | Action |
| --- | --- |
| ← → | Walk (and pedal the bike, alternating) |
| ↑ | Up stairs; stand up |
| ↓ | Down stairs; sit down; open the desk when seated |
| Space or Z | Jump (also jump off the bike saddle) |
| X | Fire: the water pistol when a cup or plant pot is in range, otherwise the catapult |
| C | Act: write on a blackboard, catch a frog or mouse, mount the bike, kiss, punch |
| V | Drop a stinkbomb; with none left, release the mice |
| Esc | Pause / menu |
| Tab | Switch between the original (1985) and modern views |

Eric gets up by himself after being knocked down. Writing on a blackboard: stand beside it, press C, type, then press Enter (or just walk off with a cursor key). Bike: alternate ← and → to pedal, ↑ to stand on the saddle, ↓ to dismount. The plan under the game lists the eleven steps of the caper, ticks them off as you go, and gives a hint when you hover over one.

The *How to play* screen inside the game has the School Rules and your brother's invisible-ink notes, which explain the whole caper.

## What is in the box

```
index.html, styles.css      the page and its styling
src/main.js                 boots everything and runs the loop
src/config.js               tuning numbers (speeds, delays, probabilities, scores)
src/data/                   THE GAME AS DATA: map, cast, timetable, AI scripts, words
src/engine/                 the rules: world, characters, commands, lessons, game loop
src/render/                 drawing: font, painted stand-ins, renderer, themes, original view, tape extractor
src/render/hd/              HD pixel art: the format, people, objects, furniture, building, font, icons (also the fallback)
src/render/art/             the illustrated view: loads assets/illustrated/ and draws it, falling back to pixel art
src/render/motion.js        turns the engine's cell steps into steady movement and walk cycles
src/render/fx.js            splashes, stars, floating numbers and screen shake, driven by the engine's events
assets/illustrated/         the illustrated artwork itself (sprite sheets and a manifest saying which frame is where)
tools/art/                  the art pipeline: prompts, a record of every generation, and the scripts that cut and pack sheets
src/data/decor.js           how each room looks in the HD view (decoration only; the engine never reads it)
src/ui/                     HUD, menus, keyboard, sound
src/features/               plug-in extras (quest tracker, minimap, teacher radar) — add yours here
tools/                      headless test runs, the sprite preview page and the single-file build
dist/                       the built single-file game
```

`ARCHITECTURE.md` explains how the pieces fit, with a diagram. `FEATURES.md` lists what is faithful to the original, what is new, what is not done yet, and how to add things.

## The modern view

The modern view is the same game drawn as a modern one. The engine underneath is untouched: everything below happens on the drawing side, and the original view ignores all of it.

**Artwork.** Advanced → Artwork chooses between three sets. *Illustrated* (the default) draws hand-painted-style people with human proportions, a painting for every room, the playground, furniture cut-outs and objects from `assets/illustrated/`, at six times the Spectrum's resolution. The pictures were generated with an image model from the prompts in `tools/art/` and processed by the scripts there; the manifest records where each frame's feet are so it stands exactly where the engine says. Floors, stairs, walls, door frames and room signs are drawn by code from painted material swatches, so they line up with the map. Anything the manifest lacks is drawn by the pixel-art painter instead, so the game is always complete. *HD pixel art* is drawn entirely by code at twice the Spectrum's resolution (`src/render/hd/`). *Painted stand-ins* are the simple shapes the project started with.

**Motion.** The engine steps people from cell to cell a few times a second, as the 1985 game did. `src/render/motion.js` turns that into steady movement: walkers glide at constant speed, an eight-frame walk cycle is chosen from the distance covered so feet stay planted, a change of pose plays through in-between pictures (crouching on the way to a chair, tipping over on the way to the floor, winding up a punch, swinging a leg over the bike, stepping in for a kiss), Eric leaps and flails during the scripted flights over the gate and out of windows, and the camera follows where Eric is drawn rather than the cell he occupies.

**Staging.** The close camera shows two storeys at a time, as wide as the 1985 screen, and only moves up or down when Eric's floor would leave the view; Options → Camera switches back to the whole school. Pupils sit at desks (chairs behind them, desks in front), walkers are spread over three depth lanes so a crowd does not pile into one blob, speech appears as a whole sentence in a bubble above the speaker, and chalk is written in a hand. In the playground the sky, the skyline and the boundary wall are separate layers that scroll at different speeds, and the clouds drift. The plan and the key legend sit inside the picture: the plan as a row of numbered pips with the next step written out (hover a pip for its hint), the keys as a bar that tucks itself away after a few seconds (H brings it back). The other panels are in the picture too: what just happened is a feed of short lines under the plan that fade after a few seconds, and the map of the whole school sits in the top right corner with a box showing what the camera sees (Options → Map). The teacher radar is an optional list under the map (Options → Teacher radar, off by default because it makes the game easier). In the original view all of these go back underneath the screen or are hidden.

**Feel.** Splashes, stars, stink clouds, floating numbers and a shake of the screen answer the engine's events (`src/render/fx.js`). Sound is synthesised in the browser: effects, Eric's footsteps, birdsong outdoors, a room tone and the murmur of nearby pupils indoors, the bell and a quiet tune, with switches for effects and music in Options. Behind the title screen the school runs by itself while the view drifts across it.

Open `tools/preview/index.html` from a local server (add `?art=illustrated` for the illustrated frames) to see every sprite, walk cycle, object and the whole backdrop at once. The single-file download loads the pictures from this project's published site and falls back to pixel art offline.

## The original view

Press **V** for the 1985 screen. The first time, a panel under the game asks for your copy of Back to Skool (tape image `.tzx`, or snapshot `.z80`/`.sna`; World of Spectrum and TZX Vault distribute the tape with the authors' permission). The graphics are extracted in your browser, verified pixel for pixel against the real game, and remembered locally. Until you load a file, the original view uses painted stand-ins.

## Tests

The engine runs without a browser, so the rules can be checked automatically:

```
node tools/playthrough.mjs   # plays the whole game by simulated key presses, start to safe, and checks every step
node tools/scenarios.mjs     # checks each quest mechanic in isolation
node tools/headless.mjs      # runs the whole school for a few thousand ticks and prints what happened
node tools/build-single-file.mjs   # rebuilds dist/back-to-skool.html
node tools/check-extraction.mjs game.z80 [reference-png-dir]   # checks the in-browser graphics extractor
```

For the artwork, serve the folder (any static server) and open `tools/preview/index.html`: every character and state, every object, and the backdrop, with any state still on a painted stand-in outlined in magenta. Add `?art=illustrated` to see the illustrated frames over their 96×128 boxes; a magenta outline there means the frame is missing from the manifest and pixel art is standing in. `python3 tools/art/build.py --report` lists the same gaps from the command line.

The playthrough is the strongest check: a scripted Eric walks the real routes (no teleporting), finds the pistol and stinkbombs, soaks the masters, writes the combinations, stinkbombs Mr Wacker into opening the window, climbs out on the plant, slips past Albert, climbs the gate, gets the sherry, catches the frog, rides the bike into the girls' school, drops the frog in the cup, knocks Miss Take over beneath it, takes the key and jumps up to the safe. It takes about half an hour of game time and a few minutes of real time. The only concession is that lines are uncapped during the run, because a scripted Eric loiters near teachers far more than a player would.

## Credits and licence

The original game is © 1985 Microsphere. This is unofficial fan work and contains none of the original code or artwork. The original view can look exactly as it did in 1985 because it extracts the graphics from *your own* copy of the game (a `.tzx` tape image or `.z80`/`.sna` snapshot) in the browser, the way Pyskool does; those graphics stay on your machine and are never part of this repository. The school layout, timetable, character behaviour and messages were transcribed from Richard Dymond's GPL-licensed [Pyskool](https://pyskool.ca) and [SkoolKit](https://skoolkit.ca) documentation, so this project is released under the GNU GPL v3 (see `LICENSE`).
