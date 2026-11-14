# Features: what is in, what is new, what is next

## Faithful to the original (implemented)

- The whole school: boys' school (Blue Room, Yellow Room, Science Lab with storeroom, Revision Library, Dinner Hall, Assembly Hall with stage, head's study), playground with the conker tree, bike shed and gate, and the girls' school (Upper Room, Middle Room, kitchen, Miss Take's study with the drinks cabinet). All seven staircases, every door and window, the four cups, the safe.
- All 30 characters with their original names and behaviours: four masters, Miss Take, Albert, Boy Wander (catapult), Angelface (fists), Einstein (tells tales), Hayley (kisses), ten boys and seven girls.
- The 64-period timetable, the lesson clock and bell, assembly (with the detention rant), dinner duty, playtime, revision library.
- Lessons: teachers tell the class to sit, wipe and write on the board, pace, run question-and-answer sessions with Einstein; Einstein grasses on Eric for absence, hitting and board-writing; teachers fetch a truant Eric and nag him back.
- Lines for every original offence (wrong place, standing in class, on the floor, catapults, hitting, writing on boards, stinkbombs, water pistols, plants, bikes, the girls' school, no-go zones) with the original messages; 10,000 lines means expulsion by Mr Wacker.
- The quest, end to end: water pistol and stinkbombs hidden in desks; filling cups; knocking cups with the catapult (including the bounce off a knocked-over master's head); masters revealing bike digits when soaked and storeroom letters when sherried; writing combinations on blackboards (any order); the bike (pedal, stand on the saddle, jump to the cup, fly over the shut gate); the storeroom key and the frog; the frog in the girls' kitchen cup; the safe key on Miss Take; jumping up to the safe to go up a year.
- Also: the conker that knocks Albert out, Albert raising the alarm when Eric escapes, Miss Take chasing Eric out of the girls' school, stinkbombs making Mr Wacker open the window, climbing out of the windows (the top one expels you), plants that grow when watered, the mouse (catch it, release it to scare the girls and Miss Take), kissing Hayley to shed lines.
- Scoring as the original: 100 per mouse, 1,000 per combination, 2,000 for the key, 2,000 for the year.

## New in this remake

- A **modern HUD**: lesson box with a progress bar, score/lines/hi-score, pocket inventory, and an event log in plain English.
- Two plug-in **features** on by default: the plan, a strip under the game in both views that lists the eleven steps of the caper, ticks them off as they happen, gives a hint on hover and remembers the digits and letters you've been told; and a minimap of the whole school. A third (a "staff room" radar showing who can see you) is kept in the code, switched off, as a template.
- **Two views, one key apart (Tab)**: *Original* is the 1985 screen drawn with the game's own graphics (the school backdrop, all 128 sprites, doors, cups, bike, font, speech bubble, score and lesson boxes and logo), extracted from the player's own copy of the game: 32 columns, 8-pixel steps, scrolling in jumps, status rows under the play area. *Modern* is wide and smooth with the HUD and sidebar. Advanced options let you mix the two.
- **Four-action controls**: the original's fourteen keys are folded into the cursor keys plus jump, fire, act and drop (Z X C V); fire picks the water pistol when a cup or plant is in range, act does whatever is in front of Eric, drop is for stinkbombs and mice. Eric gets up by himself after being floored. The key strip under the canvas is always visible.
- **Options**: view preset, game speed, sound; advanced: palette, view width (32 to 96 columns), status rows on canvas, smooth motion, retro scrolling, freeze-on-lines.
- **Modern motion**: walkers glide at constant speed between the engine's cell steps, with an eight-frame walk cycle per character driven by distance covered, pose changes played through in-between pictures (sitting down, getting up, falling over, punching, raising an arm, drawing the catapult, bending, lifting the pistol, getting on and off the bike, standing on the saddle, the kiss), leaping and flailing pictures during the scripted flights over the gate and out of windows, a cross-fade where there are none, and a curved jump (`src/render/motion.js`); the camera follows where Eric is drawn, eases by elapsed time and scrolls in canvas pixels. Switchable; the original view never uses it.
- **Close camera**: two storeys at a time, as wide as the 1985 screen, moving vertically only when Eric's floor would leave the view; the whole-school camera is an option.
- **Parallax**: in the playground the sky, the skyline and the boundary wall are separate layers scrolling at different speeds, with drifting clouds.
- **In-picture HUD**: the plan (numbered pips, the next step written out, hints on hover) and the key legend (tucks away, H to toggle) are overlays on the game picture in the modern view; pocket icons are illustrated. The event log is a fading feed under the plan, the minimap is a corner map whose box follows the close camera, and the teacher radar is an optional list under it (Options switches for both).
- **Staging**: pupils sit at desks with the desk in front of them; three depth lanes on every floor; whole-sentence speech bubbles above the speaker, reprimand cards, and chalk in a hand, all keeping the engine's timing and line widths.
- **Effects and sound**: droplets, stars, stink clouds, hearts, floating line and score numbers, a red flash and a shake when Eric gets lines (`src/render/fx.js`); synthesised effects, footsteps, birdsong outdoors, a room tone and crowd murmur indoors, an electric bell and an original sixteen-bar tune (`src/ui/sound.js`). A title screen with the school running behind it.
- **Keys that forgive**: a tap of an arrow key is never lost, however short; a tap turns Eric round on the spot and only a held key walks him on (the 1985 game, sampled ten times a second, lost short taps and walked him off the step he was aiming from); a key pressed in mid-step is acted on when the step ends.
- **Aiming help** (modern view): the few exact spots from which a cup can be filled or knocked down are found by tracing the engine's own pellet and water flights and marked with a glow on the floor; the cup is ringed when the aim is true, a pellet through an empty cup says EMPTY, and a full cup drips. The rules themselves are untouched.
- Hi-score saved in the browser.
- **Illustrated characters in the modern view**: every member of the cast (Eric, the three other named boys, Hayley, the four masters, Miss Take, Albert, and the plain boys and girls) as hand-painted-style figures with human proportions, generated from one shared style description so they match, cut and aligned by the scripts in `tools/art/` and drawn at six times the Spectrum's resolution. Frames may overhang their 3×4-cell box (a raised arm, a lying figure); the manifest keeps the feet on the floor. Three looks each for the plain boys and girls. Every room is a painted picture fitted to its wall (twenty-four, the long ones painted as long walls so nothing repeats), the playground is one wide painting with a gateway through its boundary wall, with doors, windows, the gate, Miss Take's cabinet, the safe, the cups, blackboards, desks, railings, the bike and a horse chestnut tree as cut-outs, and the frog, mouse, conker, plants, stinkbomb, water, pellet and desk lids as objects. The floors, stairs, interior walls, door frames and room signs are drawn by code from painted material swatches, placed from the map so everything lines up; any missing picture falls back to pixel art automatically.
- **HD pixel art in the modern view**, drawn entirely by code: sprites at twice the Spectrum's detail built from shared body parts in each character's colours, objects and furniture as pixel pictures, a building painted from the map data with an accurate floor plan (library, toilets, lab and storeroom, assembly hall and stage, cloakroom, dinner halls, the head's and Miss Take's studies, the girls' kitchen), a doubled font with a real lowercase, rounded speech bubbles and reprimand boxes, and pixel pocket icons in a game-style HUD bar. A developer preview page (`tools/preview/`) shows it all. The painted stand-ins remain behind an option (Advanced → Artwork). The original view uses the 1985 artwork extracted in the browser from the player's own tape image or snapshot (`src/render/extract.js`, a port of Pyskool's extractor); no copyrighted graphics are in the repository or the build.
- **A bug sweep** (November 2026): three independent code reviews (engine, menus and keyboard, renderer; the engine one checked against the Pyskool source), a soak test of millions of ticks, and a real-keyboard test of every control and menu found and fixed some fifty faults, among them: the cups could not be hit in practice, the conker could never be shot from the tree, pellets flew through shut doors, a new game begun mid-step dropped Eric through the floor, restarting from a blackboard killed the keyboard, and finding the water pistol was never ticked off the plan. Each has a check in `tools/` so it cannot return.
- Headless engine with two kinds of test: `tools/scenarios.mjs` checks each mechanic in isolation, and `tools/playthrough.mjs` plays the entire game from the first playtime to the safe by simulated key presses along the real routes. The playthrough found and fixed three faults in the port: plant pots were one row too low (Eric could never jump onto one, so the window and gate climbs were impossible), plants grew and wilted three times too fast, and the plant pot on the girls' side of the gate was missing from the map.

## Not done yet (honest list)

- **Original view, measured against the real thing**: the game was run in a Z80 emulator (SkoolKit) from the rebuilt snapshot and its first screen compared pixel for pixel with this remake at the same scroll position. Backdrop, score box and logo are identical; the play area is 99.83% identical, the only difference being a few pixels of Eric's hair on the very first frame (the real game appears to draw his starting pose slightly differently). Sprites take the ink and paper colours of the wall cells behind them exactly as the Spectrum's attribute system did. Not reproduced: the loading screen, the countdown, demo mode and the tune.

- **Save and load** mid-game. Settings and hi-score persist; a game in progress does not.
- **Touch controls** for phones and tablets. The page lays out responsively but there are no on-screen buttons.
- **Lowercase blackboard text** is small capitals in the original view's stand-ins; the HD view has a real lowercase.
- **Special playtimes** (the original's occasional variant playtimes, e.g. the mumps) are not in the timetable data.
- **Speech bubbles** scroll a single line, as the original did; a "show the whole sentence" modern mode would be a nice option.
- **Modern presentation, still to do**: pedalling the bike is two pictures; sound is synthesised and has been tested for running, not tuned by ear.
- **Sound** is minimal beeps. The original tune and the up-a-year tune are not transcribed.
- **Key rebinding UI**: bindings live in `src/ui/input.js` and are easy to edit, but there is no screen for it yet.
- **Throwing the water pistol away** (the original's T key, which put a fresh water pistol back in a desk) is not mapped. Practical consequence: collect the four bike digits with water before you fill the pistol with sherry.

## How to add a feature

1. Copy `src/features/teacher-radar.js` to `src/features/my-thing.js`.
2. Give it an `id`, `name`, `description`, and write the `setup({ game, renderer, hud, input, settings })` function. Use `hud.addPanel(title, element)` for a sidebar panel and `game.events.on(...)` to react to the game.
3. Import it in `src/features/index.js` and add it to the `FEATURES` array.
4. If you want the renderer to draw something extra on the canvas, wrap `renderer.draw`:

   ```js
   const original = renderer.draw.bind(renderer);
   renderer.draw = () => { original(); /* draw on renderer.ctx here */ };
   ```

## Ideas for later

- A level editor that writes `src/data/skool.js`.
- Alternative casts (your own school) as a drop-in data pack.
- Achievements fed by the events stream.
- A "director's commentary" mode that explains what each character's command list is doing, live.
