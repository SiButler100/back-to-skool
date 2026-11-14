# Prompts for the illustrated artwork

Every generation reuses the same style anchor so the pictures match. Model:
Higgsfield `gpt_image_2_6`. The model returns a transparent background when
asked for one, so no keying is needed.

## Style anchor (verbatim in every prompt)

Hand-painted 2D adventure-game character art, realistic human proportions
(adults about seven heads tall, children about five and a half), soft painterly
shading with clean readable silhouettes, warm afternoon light from the upper
left, muted 1980s British colour palette, slightly stylised expressive faces,
fine pencil-weight outlines, consistent style in every panel.

## Technical paragraph (character sheets)

A sprite sheet: a grid of R rows by C columns of equal cells, isolated on a
plain transparent background with no backdrop, no gradient, no cell borders.
The same original character in every cell. One full-body pose per cell, feet
and shoes visible, standing on the same invisible ground line near the bottom
of each cell, side view facing RIGHT, generous margin inside each cell, no text,
no labels, no borders, no cast shadows on the ground, no props other than
those listed.

## Characters

See `characters.json`: one paragraph per group, written once and reused for
retries and extra poses.

## Pose wording

- standing relaxed, arms at the sides
- mid-stride walking to the right, left leg forward, arms swinging
- mid-stride walking to the right, right leg forward
- sitting on an unseen chair facing right, hands on the knees
- sitting on the floor, legs straight out in front
- lying flat on the back knocked out, head to the left, little stars above the head
- (grown-ups) sitting on the floor dazed, legs out in front, little stars circling the head
- standing with the right arm raised straight up, hand open
- standing with the fist pulled back ready to punch / punching straight forward
- holding a wooden catapult low / aiming a wooden catapult straight ahead, elastic drawn back
- holding a small blue water pistol out in front
- riding a red bicycle to the right, pedals level / pedals at the other position
- bending over forwards reaching down to the ground with one hand
- (Hayley) hugging and kissing a boy in a navy blazer and grey shorts on the cheek, little pink hearts

## Rooms (later milestone)

Style anchor + "Straight-on view of the back wall of a [room] in a 1980s
British [boys'|girls'] school, wide panoramic composition, the floor line
exactly along the bottom edge, ceiling cropped out, flat even lighting, no
cast shadows on the floor, no people, no doors, no stairs, no text."

## Walk cycles

Style anchor + a 2 by 4 grid, with the character's first sheet attached as a
reference image ("the character is exactly the person in the reference
image") and the eight frames described in order: passing, lift, contact,
push-off, then the same on the other leg. Every prompt is in `jobs.json`.

## Long rooms

A room wider than about two and a half times its height is generated as "one
very long wall ... seen from further back", with a picture rail a third of the
way down and nothing above it, and the first picture of the room attached as a
reference. The game crops such a picture from the top, so the plain wall above
the rail is what is lost.

## Playground, textures, fixtures

See the `playground-1`, `textures-1` and `furniture-3` entries in `jobs.json`.

## In-between poses

Same recipe as the walk cycles: the first sheet as a reference, and a grid
whose first cell is the character standing (used only to set the scale, then
dropped: its pose name starts with an underscore in `jobs.json`). "Comedy
slip" and "comedy tumble" are the wording for falling over.

## Playground layers and pocket icons

`sky-1` (sky only), `skyline-1` (a cut-out row of rooftops, with the first
playground painting as a reference) and `icons-1` in `jobs.json`.
