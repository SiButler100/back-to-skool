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
src/render/                 drawing: font, sprites, backdrop, renderer, themes, original view, tape extractor
src/ui/                     HUD, menus, keyboard, sound
src/features/               plug-in extras (quest tracker, minimap, teacher radar) — add yours here
tools/                      headless test runs and the single-file build
dist/                       the built single-file game
```

`ARCHITECTURE.md` explains how the pieces fit, with a diagram. `FEATURES.md` lists what is faithful to the original, what is new, what is not done yet, and how to add things.

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

The playthrough is the strongest check: a scripted Eric walks the real routes (no teleporting), finds the pistol and stinkbombs, soaks the masters, writes the combinations, stinkbombs Mr Wacker into opening the window, climbs out on the plant, slips past Albert, climbs the gate, gets the sherry, catches the frog, rides the bike into the girls' school, drops the frog in the cup, knocks Miss Take over beneath it, takes the key and jumps up to the safe. It takes about half an hour of game time and a few minutes of real time. The only concession is that lines are uncapped during the run, because a scripted Eric loiters near teachers far more than a player would.

## Credits and licence

The original game is © 1985 Microsphere. This is unofficial fan work and contains none of the original code or artwork. The original view can look exactly as it did in 1985 because it extracts the graphics from *your own* copy of the game (a `.tzx` tape image or `.z80`/`.sna` snapshot) in the browser, the way Pyskool does; those graphics stay on your machine and are never part of this repository. The school layout, timetable, character behaviour and messages were transcribed from Richard Dymond's GPL-licensed [Pyskool](https://pyskool.ca) and [SkoolKit](https://skoolkit.ca) documentation, so this project is released under the GNU GPL v3 (see `LICENSE`).
