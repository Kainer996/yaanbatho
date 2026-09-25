# Calm sound v492

Build: `asmr-sound-v492-20260925`.
Status: pushed to `claude/burbz-sound-design-xknxx2`, no PR yet.

## What Yaan asked for

Push hard on the ambient sound. Learn what makes ASMR work and use it through the whole game. The music is far too loud. The taps are harsh, and their tails get cut off. Make it really relaxing.

## What was wrong

- **iPhones ignore `audio.volume`.** Every sound played through an `<audio>` element came out at the level it was mastered at. The music file sits at -15 LUFS and the wooden tap peaks at -1.7 dB. On a phone both played at full blast, whatever `BURBZ_MUSIC_BASE_VOLUME` said. That is why the music was so loud.
- **The tap file was bright and short.** `ui-wood.mp3` is 0.34 s with a hard click on top. Stops cut it dead.
- **The ambience was thin.** Rain, wind and a fire, only in first person, and quieter than the music.
- **Garden birds were the loudest files in the game** (about -18 LUFS) on their own context, straight to the speaker.

## What makes a sound feel like ASMR

The research on ASMR triggers agrees on a short list. This release uses each one.

| Trigger | Where it lives now |
| --- | --- |
| Soft tapping on wood | Every button tap: a fingertip knock, made on the phone |
| Paper and page turning | Tabs and screens: a soft paper sweep |
| Crinkle and rustle | Leaves brushing past, outdoors and now and then at Home |
| Water | Drips from leaves while it rains, and for 90 s after |
| Fire crackle and rain | The campfire and rain beds, now properly audible |
| Movement across the ears | Rustles, drips, chimes and paper pan as they play |
| No sharp edges | Every sound fades in and fades to silence; a warm shelf takes the glassy top off |
| Slow, uneven rhythm | Events come at random gaps, never on a beat |
| Low level | The bed sits under the music, and the music sits under the world |

## What changed

- **One calm bus.** `audio_core.js` now builds one `AudioContext` for the whole game. A gain in it works on every phone. The chain is: sounds → master → warm high shelf (-5 dB at 5.2 kHz) → gentle compressor → speaker. A short, dark room reverb gives taps and chimes a tail that dies on its own.
- **Music is quieter and further away.** It plays through the bus at 0.045 (was 0.067, and full level on iPhones), low-passed at 3.6 kHz so it sounds like the next room. It still rests for three minutes between plays.
- **Soft interface sounds, made not sampled.** Tap, page, unlock, coins and error are now built on the phone (`SOFT_SOUNDS`). Each has an envelope that always reaches silence. They sit in the mids a phone speaker can carry, with no bright click.
- **No more cut tails.** Every file on the bus fades in over 4 ms and out over its last stretch. Stopping a sound is a 40 ms fade, never a cut. When all six voices are busy, the oldest fades out, so quick taps never swallow the chime that follows.
- **Rewards swell instead of shout.** Victory, level up and quest complete sit at 0.45 on the bus, with a touch of room.
- **The fire and the rain can be heard.** Campfire 0.95, rain 0.8 on the bus.
- **A living soundscape everywhere** (`asmr_soundscape.js`):
  - *Air*: a breathing band of pink noise. Darker indoors and at night, opening with the wind outside.
  - *Leaves*: rustles made of tiny noise grains under a smooth swell, panned as they pass. Every few seconds outdoors, now and then at Home.
  - *Drips*: bubble-like drops while it rains, and for 90 seconds after.
  - *Chimes*: a far wind chime in D major pentatonic every half minute to a minute, rarer at night.
- **Garden birds join the bus** at a lower level, so they sit in the same room as everything else.
- The birdsong listener shares the bus's context (`getAudioCtx`).

## Kept safe

- **Merlin's wand never hears the game.** The soundscape stops while the microphone listens, like the garden birds.
- Sound off stops it all. Danger (`tense` mood) hushes the soundscape and the fire.
- Callers that pass their own `Audio` (all older tests) keep the element path and its tables unchanged. Browsers without Web Audio fall back to it too.

## Levels, measured

Rendered offline in Chromium through the full bus:

| Sound | Peak | Ends |
| --- | --- | --- |
| tap | -21.7 dBFS | fades to silence, no step |
| page | -26 dBFS | fades to silence |
| unlock | -22.2 dBFS | fades to silence |
| coins | -25.6 dBFS | fades to silence |
| error | -21.3 dBFS | fades to silence |
| soundscape bed, outdoors | about -44.5 dBFS RMS | continuous |
| music (file -15 LUFS × 0.045) | about -42 LUFS | rests 3 min between plays |

## Checks

- `node --test tests/test_asmr_sound_v492.cjs`
- Browser: `PLAYWRIGHT_MODULE=… node tests/run_asmr_sound_v492.cjs` (real game page, Chromium audio, no phone listen)

## Not done

- No listen on a real iPhone yet. Yaan's ears are the final check.
- Watch for: iOS can treat Web Audio as "ambient" sound, which the silent switch mutes. The garden birds have always worked this way. If the game goes quiet on silent mode, `navigator.audioSession.type = 'playback'` is the lever, but it would also pause the player's own music apps, so it needs Yaan's say.
