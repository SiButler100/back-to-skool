# Back to Skool (browser remake)

A faithful, from-scratch remake of the 1985 ZX Spectrum game *Back to Skool* (Microsphere; David Reidy and Keith Warrington), built so that the look can be modernised and new features bolted on without touching the core rules.

It runs in any modern browser. No install, no build step for playing.

## Play it

- **Hosted:** open the published page (link in the chat where this was delivered).
- **Locally, no server needed:** double-click `dist/back-to-skool.html`. Everything is inlined into that one file.
- **Locally, from source:** open the folder in VS Code and use the *Live Server* extension (or any static server) and visit `index.html`. Opening `index.html` directly from the filing system will not work because browsers block JavaScript modules on `file://` addresses.

## Controls

| Key | Action |
| --- | --- |
| Arrow keys (or Q A O P) | Walk, go up or down stairs |
| Space or J | Jump |
| S | Sit down / stand up |
| F | Fire catapult |
| H | Punch |
| W | Write on a blackboard (type, then Enter) |
| C | Catch a mouse or frog |
| D | Drop a stinkbomb |
| G | Fire the water pistol |
| M | Mount the bike (left/right to pedal, up to stand on the saddle, down to dismount) |
| E or O | Open the desk you are sitting at |
| R | Release mice |
| T | Throw away the water pistol |
| K | Kiss |
| U | Acknowledge a message |
| Esc | Pause / menu |

The *How to play* screen inside the game has the School Rules and your brother's invisible-ink notes, which explain the whole caper.

## What is in the box

```
index.html, styles.css      the page and its styling
src/main.js                 boots everything and runs the loop
src/config.js               tuning numbers (speeds, delays, probabilities, scores)
src/data/                   THE GAME AS DATA: map, cast, timetable, AI scripts, words
src/engine/                 the rules: world, characters, commands, lessons, game loop
src/render/                 drawing: font, sprites, backdrop, renderer, themes
src/ui/                     HUD, menus, keyboard, sound
src/features/               plug-in extras (quest tracker, minimap, teacher radar) — add yours here
tools/                      headless test runs and the single-file build
dist/                       the built single-file game
```

`ARCHITECTURE.md` explains how the pieces fit, with a diagram. `FEATURES.md` lists what is faithful to the original, what is new, what is not done yet, and how to add things.

## Tests

The engine runs without a browser, so the rules can be checked automatically:

```
node tools/scenarios.mjs     # walks Eric through the quest mechanics and checks each step
node tools/headless.mjs      # runs the whole school for a few thousand ticks and prints what happened
node tools/build-single-file.mjs   # rebuilds dist/back-to-skool.html
```

## Credits and licence

The original game is © 1985 Microsphere. This is unofficial fan work; it contains none of the original code or artwork. The school layout, timetable, character behaviour and messages were transcribed from Richard Dymond's GPL-licensed [Pyskool](https://pyskool.ca) and [SkoolKit](https://skoolkit.ca) documentation, so this project is released under the GNU GPL v3 (see `LICENSE`).
