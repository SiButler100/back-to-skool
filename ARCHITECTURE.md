# Architecture

This is a plain-English map of the project: what each file does and how the pieces connect. There is no framework and no build step; the browser loads the JavaScript modules directly.

## The big idea

The game is split into three layers that only talk downwards:

1. **Data** describes the school: the map, the people, the timetable, the AI scripts and every line of dialogue. It is just JavaScript objects. Change a number here and the game changes.
2. **Engine** is the rulebook. It knows nothing about pixels. It can run headless in Node, which is how the tests work.
3. **Presentation** draws the engine's state (renderer, HUD, menus, sound) and feeds it keyboard input. The renderer has four painters: illustrated artwork (`src/render/art/`, hand-painted-style pictures loaded from `assets/illustrated/`), the HD pixel-art view (`src/render/hd/`, which also stands in for any illustrated picture that is missing), the genuine 1985 graphics (`original.js`), and simple painted stand-ins; the engine is the same underneath all four.

**Features** sit beside the presentation layer. They subscribe to the engine's events and add panels or behaviour without editing anything else.

```mermaid
flowchart TD
  subgraph Data["src/data — the game as data"]
    skool[skool.js<br/>map: floors, stairs, rooms, doors, cups]
    cast[cast.js<br/>who everyone is]
    tt[timetable.js<br/>64 periods + who does what]
    cl[commandLists.js<br/>AI scripts]
    msg[messages.js<br/>every word spoken or written]
    decor[decor.js<br/>how rooms look in HD]
  end

  subgraph Engine["src/engine — the rules (no graphics)"]
    world[world.js<br/>World: geometry questions, doors, boards, signals]
    timetable[timetable.js<br/>Timetable: the clock and current period]
    commands[commands.js<br/>CommandList + ~90 Command classes]
    character[character.js<br/>Character: movement, poses, lines]
    eric[eric.js<br/>Eric: keyboard-driven Character]
    objects[objects.js<br/>pellets, water, frog, mouse, bike, plants]
    lesson[lesson.js<br/>teacher ↔ swot choreography, Q&A]
    castE[cast.js<br/>Cast: everyone together, proximity queries]
    game[game.js<br/>Game: tick(), score, lines, message boxes, events]
  end

  subgraph Render["src/render — drawing"]
    font[font.js 5x7 bitmap font]
    sprites[sprites.js painted stand-ins]
    backdrop[backdrop.js painted building]
    renderer[renderer.js camera + frame]
    motion[motion.js steps → steady movement]
    fx[fx.js splashes, stars, shake]
    theme[theme.js palettes]
    original[original.js 1985 painter]
    extract[extract.js tape → graphics]
    subgraph HD["src/render/hd — HD pixel art"]
      pixelart[pixelart.js the text bitmap format]
      palette[palette.js wardrobe + slots]
      people[people.js bodies from parts]
      hdobjects[objects.js things]
      furniture[furniture.js doors, cups, safe]
      hdbackdrop[backdrop.js the building]
      hdfont[font.js 2x face + lowercase]
      icons[icons.js HUD pictures]
      painter[painter.js ModernPainter]
    end
    subgraph Art["src/render/art — illustrated artwork"]
      artassets[assets.js loads manifest + images]
      illustrated[illustrated.js IllustratedPainter]
      artbackdrop[backdrop.js sky, rooms, fixtures]
      artstructure[structure.js floors, stairs, walls, playground]
      arttext[text.js speech, cards, chalk]
      artfurniture[furniture.js cut-outs per piece]
    end
  end

  subgraph Assets["assets/illustrated — pictures"]
    manifest[manifest.json which picture is where]
    sheets[characters, objects, furniture, rooms, scenes, textures]
  end

  subgraph ArtTools["tools/art — the art pipeline"]
    jobs[jobs.json every generation, recorded]
    build[build.py slice, align, pack]
  end

  subgraph UI["src/ui"]
    input[input.js keyboard]
    hud[hud.js score, lesson box, log]
    menu[menu.js title, pause, options]
    sound[sound.js synthesised beeps]
  end

  subgraph Features["src/features — plug-ins"]
    fidx[index.js registry]
    quest[quest-tracker.js]
    mini[minimap.js]
    radar[teacher-radar.js]
    aim[aim-guide.js where to stand to fill or hit a cup]
  end

  subgraph Tests["tools — the tests"]
    scen[scenarios.mjs each rule, without a screen]
    play[playthrough.mjs the whole quest by key presses]
    soak[soak.mjs many school days, random player]
    bchk[browser-checks.mjs the real page, real keys]
  end

  main[src/main.js<br/>boot + fixed-step loop]

  skool --> world
  cast --> castE
  tt --> timetable
  tt --> castE
  cl --> commands
  msg --> character
  msg --> lesson
  world --> character
  commands --> character
  character --> eric
  character --> castE
  eric --> castE
  objects --> castE
  lesson --> castE
  castE --> game
  timetable --> game
  world --> game
  game --> renderer
  game --> hud
  game --> fidx
  input --> eric
  font --> renderer
  sprites --> renderer
  backdrop --> renderer
  theme --> renderer
  original --> renderer
  extract --> original
  painter --> renderer
  painter --> illustrated
  artassets --> illustrated
  artassets --> artbackdrop
  artstructure --> artbackdrop
  arttext --> illustrated
  motion --> renderer
  fx --> renderer
  game --> fx
  artbackdrop --> illustrated
  artfurniture --> illustrated
  hdbackdrop --> artbackdrop
  furniture --> artfurniture
  illustrated --> renderer
  manifest --> artassets
  sheets --> artassets
  jobs --> build
  build --> manifest
  build --> sheets
  pixelart --> people
  pixelart --> hdobjects
  pixelart --> furniture
  palette --> painter
  people --> painter
  hdobjects --> painter
  furniture --> painter
  hdbackdrop --> painter
  hdfont --> painter
  decor --> hdbackdrop
  font --> hdfont
  icons --> hud
  main --> game
  main --> renderer
  main --> hud
  main --> menu
  main --> sound
  main --> fidx
  fidx --> quest
  fidx --> mini
  fidx --> radar
  fidx --> aim
  aim --> renderer
  scen --> game
  play --> game
  soak --> game
  bchk --> main
```

## Between ticks: why the modern view moves smoothly

The engine only knows whole cells: a walker is at column 40, then 41. Twenty times a second it may move someone on. The screen redraws sixty times a second or more. `motion.js` fills the gap. For each thing it remembers where it was drawn last frame and where the engine says it is heading, and slides it there over exactly as long as the engine will wait before the next step (the character's own walk delay), so consecutive steps join into a steady glide. The engine's two "mid-stride" walk states mean a step has begun but the cell has not changed yet, so the picture already heads for the half-way point; that is why Eric starts moving the instant a key is pressed. The walk-cycle frame comes from the position itself (two cells per cycle), not from a clock. None of this feeds back into the engine, and the original view switches it off.

## One tick, start to finish

`main.js` runs a fixed-step loop: twenty engine ticks per second (adjustable), and a screen redraw on every animation frame.

1. `Game.tick()` first checks whether a **message box** (a reprimand) is on screen. If so the world freezes while it shows, exactly as the original did. Then it ticks the **Timetable**; if the period's counter has run out, the bell rings and `Cast.setLesson()` hands every character the script for the new period.
2. `Cast.move()` moves Eric first, then every character, then every object. A character only acts when its personal delay runs out (walking speed, running speed, "doing something" speed).
3. A character acting means `CommandList.command()`: run the command on top of the stack. Commands return *nothing* (still busy), *themselves* (finished) or *another command* (do this first). That tiny protocol expresses everything from "go to the Blue Room" to "wipe the board, write a topic, pace up and down".
4. Eric's version of a command list is the keyboard. `Eric.move()` reads it, works out whether a nearby teacher should be giving him lines, and either walks or hands control to a short controller command (jump, fire, write) until it finishes.
5. Doors with timers shut themselves. The engine emits a `tick` event for features.

## How the game is tested

Four test programs, from the fastest and narrowest to the slowest and broadest. Each prints PASS or FAIL lines and exits with a failure code if anything failed.

| Test | What it drives | What it catches |
| --- | --- | --- |
| `node tools/scenarios.mjs` | The engine alone, one rule at a time, with a fake keyboard | A rule that has stopped working: a cup that will not fill, a door that shuts on Eric, a pellet through a wall. Every bug fixed gets a check here so it cannot return |
| `node tools/playthrough.mjs [seed]` | The engine alone, the whole quest from the first playtime to the safe, by key presses along the real routes | A step of the quest that has become impossible |
| `node tools/soak.mjs [seeds] [ticks]` | The engine alone for millions of ticks under many random seeds, with a player who presses anything | Things that only go wrong rarely: someone stranded in mid-air, a game that cannot end, an error thrown once in a million ticks |
| `node tools/browser-checks.mjs [controls] [screens] [quest]` | The real page in a headless browser (it needs Playwright), with real key presses of realistic lengths | Everything the others cannot see: a tap too short to register, a menu that takes the keyboard away, a page that scrolls, a missing picture, an error in the picture or the HUD at any point in the quest |

Why four: the first three know nothing of the page, so they are fast and exact, but they press keys perfectly. The fault that started this (the cups could not be hit because a tap of a key was either lost or walked Eric off the step) was invisible to them. `browser-checks.mjs` exists to press keys the way a hand does.

Two rules of thumb. A check should say in plain words what the player would see (`A 90 ms tap of ← turns Eric round on the spot`). And a fix is not finished until a check fails without it.

## Where to change things

| I want to… | Edit |
| --- | --- |
| Change walking speed, lesson length, lines amounts | `src/config.js` |
| Move a room, add a desk, add a staircase | `src/data/skool.js` |
| Rename a character, change hair/clothes, add a pupil | `src/data/cast.js` (and `RANDOM_LOCATIONS`), then add them to each lesson in `src/data/timetable.js` |
| Change what teachers write or say | `src/data/messages.js` |
| Give a character a new routine | `src/data/commandLists.js`; new verbs go in `src/engine/commands.js` |
| Change the look of the building | illustrated view: the room descriptions in `tools/art/rooms.json` (regenerate a room and run `python3 tools/art/build.py room-<Zone>`); the floors, stairs and walls come from the map and `src/render/hd/backdrop.js`. Pixel view: `src/data/decor.js` (which room is where, its wall colour, its props) and the same backdrop file; colours in `theme.js` under `hd` |
| Change how a character looks in the illustrated view | regenerate their sheet: the prompt is in `tools/art/characters.json`, the generation record in `tools/art/jobs.json`; drop the new picture in `art-src/` and run `python3 tools/art/build.py <job>` (see `tools/art/prompts.md`) |
| Change how people look in pixel art | `src/render/hd/palette.js` (each group's colours) and `src/render/hd/people.js` (the body parts, drawn as text bitmaps); the original view draws the game's own sprites from the player's tape via `src/render/extract.js` and `src/render/original.js` |
| Draw a new object or icon | `src/render/hd/objects.js`, `src/render/hd/icons.js`; the bitmap alphabet is explained at the top of `src/render/hd/pixelart.js` |
| Change how the keys feel (how long Eric pauses after turning round) | `turnPause` and `turnPauseOnStairs` in `src/config.js`; a tap is recorded in `src/ui/input.js` and acted on in `Eric.move` in `src/engine/eric.js` |
| Change the atmosphere (wall shadows, the light of the hour, the lens darkening) | `daylight` and `drawAtmosphere` in `src/render/renderer.js`; the shadow outlines are made by `silhouette` and `drawWallShadow` in `src/render/art/illustrated.js` |
| Change the aiming help (the glowing spots and the ring round a cup) | `src/features/aim-guide.js` finds the spots by tracing the engine's own flights; `drawGuideSpots` and `drawGuideTargets` in `src/render/renderer.js` draw them |
| Change how movement feels (glide, walk cycle, pose blend, jump) | `src/render/motion.js`; the camera is in `src/render/renderer.js` (`updateCamera`, `updateCameraY`) |
| Add or change a visual effect | `src/render/fx.js`: listen for an engine event and add particles |
| Change floors, stairs, walls, the playground or room signs in the illustrated view | `src/render/art/structure.js` (drawn by code from the swatches in `assets/illustrated/textures/`) |
| Change speech bubbles, reprimand cards or chalk | `src/render/art/text.js` |
| Add or change a sound, the tune, footsteps or birdsong | `src/ui/sound.js` |
| Change where the plan, keys, feed, map or radar sit in the picture | `styles.css` (the rules under `html.view-modern .screen > ...`); `HUD.placeStrips` in `src/ui/hud.js` moves them in and out of the picture |
| Add a panel, an overlay, a new rule | a new file in `src/features/`, registered in `src/features/index.js` |
| Change the HUD or menus | `src/ui/hud.js`, `src/ui/menu.js`, `styles.css` |

## Coordinates, briefly

Everything in the engine is measured in **cells** of 8 pixels. The school is 192 cells wide and 21 tall. A character's `(x, y)` is the top-left of a 3-wide, 4-tall sprite, so someone standing on the ground floor has `y = 17` (their feet are in row 20). Floors are at `y = 17, 10, 3`. Staircases are diagonals: one cell across for each cell up. A plant pot counts as standing room one row *above* its floor (Eric jumps up onto it, and the growing plant lifts him two rows more), which is why `world.plantPots` stores `y - 1`. The renderer multiplies by 8 and the page scales the canvas up from there.

## Events the engine emits

`start`, `tick`, `lesson`, `lines`, `linesTotal`, `score`, `inventory`, `decked`, `secret`, `found`, `quest`, `cup`, `door`, `splash`, `conked`, `stinkbomb`, `kiss`, `messageBox`, `expelling`, `gameOver`, `upAYear`, `sound`. Subscribe with `game.events.on(name, handler)`.

## Why it is organised like this

The original is a simulation first and a game second: thirty characters follow timetables whether or not you watch. Keeping that simulation pure (no DOM, no canvas) means it can be tested in seconds (`tools/scenarios.mjs` for single mechanics) or played right through by a script (`tools/playthrough.mjs`, which drives Eric with a fake keyboard along the real routes and checks every step of the quest) and re-skinned at will. The data layer is deliberately boring JavaScript objects rather than JSON so that it can carry comments and small helpers, and so that a mistake shows up as a clear error at load time.
