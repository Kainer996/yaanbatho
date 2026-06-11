# Burbz - Prototype 2 (Real Sound ID)

**Burbz** is a web app inspired by Merlin Bird ID but with game mechanics: collect birds, then battle other people's birds like Pokemon Go.

## Phase 2: Real Bird Sound Recognition

The sound scanner now uses **[BirdNET-Analyzer](https://github.com/kahst/BirdNET-Analyzer)** (Cornell Lab of Ornithology) via the [`birdnetlib`](https://github.com/joeweiss/birdnetlib) Python package — the same engine behind Merlin's sound ID. It recognises **6,522 species** worldwide.

## Running it

```bash
# one-time setup (already done on this server)
python3 -m venv venv
source venv/bin/activate
pip install birdnetlib flask flask-cors librosa tensorflow

# each time
source venv/bin/activate
python3 server.py
# open http://localhost:5055
```

Open the **Sound** tab, tap the mic, record 5 seconds. The app:
1. Records mic audio in-browser (MediaRecorder)
2. Decodes + re-encodes to 48kHz mono WAV (BirdNET's expected format)
3. POSTs to `/api/identify/sound` with optional geolocation (narrows species list)
4. Backend runs BirdNET inference (TFLite) and returns the top detection
5. The bird is added to your flock with power/rarity derived from its species

## Architecture

```
┌───────────────┐    audio (WAV)     ┌──────────────────┐
│  index.html   │ ─────────────────▶ │  server.py       │
│  (MediaRec.)  │ ◀─ JSON detections ─│  Flask+BirdNET  │
└───────────────┘                    └──────────────────┘
      │                                       │
  localStorage                          TFLite model
  (flock)                               (6522 species)
```

- **Frontend:** single `index.html`, no build step. localStorage keeps the flock.
- **Backend:** Flask on port 5055, serves both the static HTML and the API.
- **Species → game bird mapping:** deterministic hash of scientific name → basePower 10–89, rarity tier, emoji. So the same species always has the same stats.

## What's mocked vs real

| Feature | Status |
|---|---|
| Sound ID | ✅ **Real** (BirdNET, 6522 species) |
| Image ID | ⏳ Mocked — next phase |
| PvP battles | ⏳ Mocked (random wild bird) — next phase |
| Location filtering | ✅ Real (passes lat/lon to BirdNET for regional species list) |

## Licensing caveat

The BirdNET **code** (birdnetlib, BirdNET-Analyzer) is MIT. The **pretrained model weights** shipped by Cornell are **CC BY-NC-SA 4.0** (non-commercial). For a commercial launch you'd need to either:
- Train custom weights on open datasets (Xeno-Canto, Macaulay), or
- License the model from Cornell directly.

For the prototype / non-commercial phase, the default weights are fine.

## Next phases

1. **Image ID** — TensorFlow.js in-browser with MobileNetV2 fine-tuned on CUB-200-2011, or a Keras backend endpoint with EfficientNet.
2. **PvP** — WebSocket matchmaking; store flocks server-side.
3. **Geo tagging** — remember where each bird was captured; map view.
4. **Quests** — "capture 3 species this week", streaks, daily rotation.
