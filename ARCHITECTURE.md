# Architecture

This is a plain-English map of the project: what each file does and how the pieces connect. There is no framework and no build step; the browser loads the JavaScript modules directly.

## The big idea

The game is split into three layers that only talk downwards:

1. **Data** describes the school: the map, the people, the timetable, the AI scripts and every line of dialogue. It is just JavaScript objects. Change a number here and the game changes.
2. **Engine** is the rulebook. It knows nothing about pixels. It can run headless in Node, which is how the tests work.
3. **Presentation** draws the engine's state (renderer, HUD, menus, sound) and feeds it keyboard input. Swap this layer to change the look completely.

**Features** sit beside the presentation layer. They subscribe to the engine's events and add panels or behaviour without editing anything else.

```mermaid
flowchart TD
  subgraph Data["src/data — the game as data"]
    skool[skool.js<br/>map: floors, stairs, rooms, doors, cups]
    cast[cast.js<br/>who everyone is]
    tt[timetable.js<br/>64 periods + who does what]
    cl[commandLists.js<br/>AI scripts]
    msg[messages.js<br/>every word spoken or written]
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
    sprites[sprites.js painted sprites]
    backdrop[backdrop.js the building]
    renderer[renderer.js camera + frame]
    theme[theme.js palettes]
    original[original.js 1985 painter]
    extract[extract.js tape → graphics]
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
  main --> game
  main --> renderer
  main --> hud
  main --> menu
  main --> sound
  main --> fidx
  fidx --> quest
  fidx --> mini
  fidx --> radar
```

## One tick, start to finish

`main.js` runs a fixed-step loop: twenty engine ticks per second (adjustable), and a screen redraw on every animation frame.

1. `Game.tick()` first checks whether a **message box** (a reprimand) is on screen. If so the world freezes while it shows, exactly as the original did. Then it ticks the **Timetable**; if the period's counter has run out, the bell rings and `Cast.setLesson()` hands every character the script for the new period.
2. `Cast.move()` moves Eric first, then every character, then every object. A character only acts when its personal delay runs out (walking speed, running speed, "doing something" speed).
3. A character acting means `CommandList.command()`: run the command on top of the stack. Commands return *nothing* (still busy), *themselves* (finished) or *another command* (do this first). That tiny protocol expresses everything from "go to the Blue Room" to "wipe the board, write a topic, pace up and down".
4. Eric's version of a command list is the keyboard. `Eric.move()` reads it, works out whether a nearby teacher should be giving him lines, and either walks or hands control to a short controller command (jump, fire, write) until it finishes.
5. Doors with timers shut themselves. The engine emits a `tick` event for features.

## Where to change things

| I want to… | Edit |
| --- | --- |
| Change walking speed, lesson length, lines amounts | `src/config.js` |
| Move a room, add a desk, add a staircase | `src/data/skool.js` |
| Rename a character, change hair/clothes, add a pupil | `src/data/cast.js` (and `RANDOM_LOCATIONS`), then add them to each lesson in `src/data/timetable.js` |
| Change what teachers write or say | `src/data/messages.js` |
| Give a character a new routine | `src/data/commandLists.js`; new verbs go in `src/engine/commands.js` |
| Change the look of the building | `src/render/backdrop.js` and `src/render/theme.js` |
| Change how people look | `src/render/sprites.js` (modern view); the original view draws the game's own sprites from the player's tape via `src/render/extract.js` and `src/render/original.js` |
| Add a panel, an overlay, a new rule | a new file in `src/features/`, registered in `src/features/index.js` |
| Change the HUD or menus | `src/ui/hud.js`, `src/ui/menu.js`, `styles.css` |

## Coordinates, briefly

Everything in the engine is measured in **cells** of 8 pixels. The school is 192 cells wide and 21 tall. A character's `(x, y)` is the top-left of a 3-wide, 4-tall sprite, so someone standing on the ground floor has `y = 17` (their feet are in row 20). Floors are at `y = 17, 10, 3`. Staircases are diagonals: one cell across for each cell up. A plant pot counts as standing room one row *above* its floor (Eric jumps up onto it, and the growing plant lifts him two rows more), which is why `world.plantPots` stores `y - 1`. The renderer multiplies by 8 and the page scales the canvas up from there.

## Events the engine emits

`start`, `tick`, `lesson`, `lines`, `linesTotal`, `score`, `inventory`, `decked`, `secret`, `found`, `quest`, `cup`, `door`, `splash`, `conked`, `stinkbomb`, `kiss`, `messageBox`, `expelling`, `gameOver`, `upAYear`, `sound`. Subscribe with `game.events.on(name, handler)`.

## Why it is organised like this

The original is a simulation first and a game second: thirty characters follow timetables whether or not you watch. Keeping that simulation pure (no DOM, no canvas) means it can be tested in seconds (`tools/scenarios.mjs` for single mechanics) or played right through by a script (`tools/playthrough.mjs`, which drives Eric with a fake keyboard along the real routes and checks every step of the quest) and re-skinned at will. The data layer is deliberately boring JavaScript objects rather than JSON so that it can carry comments and small helpers, and so that a mistake shows up as a clear error at load time.
