# Merlin flight art (v3)

`merlin-flight-v3.webp` holds twelve side-view poses of Merlin, each in a 328×304 cell:

- `flap` 0–7: one full wing beat (up, downstroke, level, down, lowest, folded, rising, up)
- `reach`: braking, talons swung forward
- `grab`: talons closed on a pebble
- `lift`: climbing away with the pebble
- `flare`: landing, wings up, feet forward

`atlas-config.js` gives each cell's rectangle and its grip point (where the talons or a held pebble sit). Every pose is registered on Merlin's eye, so his body never jumps between frames. The pivot is his body centre. `bodyLength` is the beak-to-tail length in atlas pixels; the game draws him at 96 CSS px, the size of the perched Merlin.

## Source

The two sheets in `source/` were painted with ElevenLabs (gpt-image-2) from Merlin's perched artwork, on flat magenta. `source/build_atlas.py` keys out the magenta, cuts the frames, finds each eye and talon, and writes the atlas and config. Run it from `source/` with Pillow, numpy and scipy.

Prompts, in short: "a 4×2 sprite sheet of the falcon in the reference, pure side profile flying right, one looping wing-beat cycle" and "glide, braking to grab with talons open, grabbing a pebble, lifting away, carrying, landing flare".
