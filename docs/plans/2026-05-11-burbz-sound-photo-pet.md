# Burbz Sound ID, Live Photo Capture, and Pet Companion Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Burbz captures honest and delightful: real sound ID, camera-only photo ID, and one chosen bird as a Tamagotchi-style screen companion.

**Architecture:** Keep the current Flask backend on port 5055 behind nginx at `/burbz/api/`. Use BirdNET for sound ID first because it is already installed and now externally reachable. For photo ID, use camera-only browser capture and a server-side vision classifier; do not accept gallery/hard-drive uploads in the UI. For the pet companion, store `activePetId` in localStorage and render a lightweight animated DOM sprite using the bird's existing art URL.

**Tech Stack:** Flask, birdnetlib/BirdNET, localStorage, browser MediaRecorder, browser Camera API, vanilla JS/CSS, local SD image cache.

---

## Current State Confirmed

- `/home/ubuntu/yaanbatho/burbz/server.py` already exposes `POST /api/identify/sound` using BirdNET.
- nginx now proxies `https://yaanbatho.com/burbz/api/` to `http://127.0.0.1:5055/api/`.
- `resampy` is installed in `/home/ubuntu/yaanbatho/burbz/venv`, fixing BirdNET/librosa audio read failures.
- The frontend now uses relative API URLs like `api/identify/sound`, so it works under `/burbz/`.
- Demo fallback captures have been removed from sound/photo failure paths; failed recognition no longer grants random birds.
- Image mode now says “Camera only — live bird capture required”; the hidden file input is disabled.

---

## Task 1: Harden Sound ID Response Handling

**Objective:** Make sound capture reliably add a bird only when BirdNET returns a real detection.

**Files:**
- Modify: `/home/ubuntu/yaanbatho/burbz/index.html`
- Modify: `/home/ubuntu/yaanbatho/burbz/server.py`

**Steps:**
1. Keep the frontend normalizer in `uploadRecording(blob)` so `{found:true,bird:{...}}` becomes `{species, scientificName, confidence}`.
2. Add server exception handling around `recording.analyze()` so any audio parsing failure returns JSON instead of Flask 500:
   - `{'found': false, 'message': 'Could not read that audio — try a clearer recording.'}`, status 422.
3. Keep `min_conf` at 0.25 for testing; later tune to 0.35–0.45 if false positives happen.
4. Test silence:
   - `curl -sS -X POST https://yaanbatho.com/burbz/api/identify/sound -F audio=@/tmp/silence.wav`
   - Expected: `found:false`, no 500.
5. Test with a known bird recording sample if available.

---

## Task 2: Build Camera-Only Photo Capture Properly

**Objective:** Prevent gallery uploads and only submit frames captured from the live camera view.

**Files:**
- Modify: `/home/ubuntu/yaanbatho/burbz/index.html`

**Steps:**
1. Keep `imageInput` disabled or remove it entirely.
2. `scanImageBtn` calls `startCamera()` immediately.
3. `captureBtn` only captures from `cameraVideo.srcObject`.
4. If camera is unavailable, show a toast and do not call `identifyImage()`.
5. Add a `captureSource: 'camera'` field to the image form data.
6. Never call `demoIdentify()` from photo ID failure paths.
7. Verify in browser console:
   - `document.getElementById('imageInput').disabled === true`
   - image tab shows camera area and no upload wording.

---

## Task 3: Add Photo ID Backend

**Objective:** Recognise the bird species from a live camera frame.

**Files:**
- Modify: `/home/ubuntu/yaanbatho/burbz/server.py`
- Create: `/home/ubuntu/yaanbatho/burbz/photo_id.py`
- Optional: `/home/ubuntu/yaanbatho/burbz/test_photo_id.py`

**Recommended Approach:** Start with a pragmatic model/API adapter behind one function: `identify_bird_from_image(path) -> {species, scientificName, confidence}`. Keep it swappable so we can begin with an external vision model if configured, then replace with a local fine-tuned classifier later.

**Anti-cheat constraints:**
- Server accepts `image` only when `captureSource=camera` is present.
- Reject huge images over 10MB.
- Strip EXIF and save only temporary files.
- Later add lightweight liveness checks: recent capture timestamp, camera dimensions, and possibly multiple-frame motion.

**Steps:**
1. Implement `photo_id.py` with a stub returning `found:false` until a classifier is chosen.
2. Change `/api/identify/image` from 501 to JSON 422 with a friendly message while model is absent.
3. Add the real classifier adapter.
4. Return frontend-compatible JSON:
   - success: `{found:true, species:'European Robin', scientificName:'Erithacus rubecula', confidence:0.87}`
   - no match: `{found:false, message:'No bird confidently recognised.'}`
5. Verify with real camera photos only.

---

## Task 4: Add “Choose Pet” to Bird Cards

**Objective:** Let the player choose one collected bird as their active companion.

**Files:**
- Modify: `/home/ubuntu/yaanbatho/burbz/index.html`

**Steps:**
1. Extend `DEFAULT_STATE` with `activePetId: null`.
2. During `loadState()`, ensure missing `activePetId` is added.
3. Add a button on the back of each bird card: `Make Pet` / `Current Pet`.
4. Button sets `gameState.activePetId = bird.id`, saves state, and calls `renderPetCompanion()`.
5. Do not trigger card flip when tapping the pet button; use `event.stopPropagation()`.
6. Verify selection persists after refresh.

---

## Task 5: Render the Tamagotchi-Style Pet Companion

**Objective:** Show the chosen bird walking/idling around the app without blocking gameplay.

**Files:**
- Modify: `/home/ubuntu/yaanbatho/burbz/index.html`

**Steps:**
1. Add a fixed `.pet-companion` element above the bottom nav.
2. Use the bird’s `artUrl` if present, otherwise emoji.
3. Add idle/walk animations with CSS transform and bobbing.
4. Every 8–15 seconds, move the pet to a new safe x-position.
5. Tap pet to show a speech bubble: bird name, level, mood.
6. Store simple pet data later: mood, lastFed, affection.
7. Verify it does not cover scan/capture/battle buttons.

---

## Task 6: Verification Checklist

**Sound ID:**
- `/burbz/api/identify/sound` is reachable publicly.
- Silence returns `found:false`, not 500.
- Real bird audio returns a detection or a friendly no-detection message.
- No random bird is awarded on failure.

**Photo ID:**
- UI does not allow file/gallery upload.
- Camera permission failure does not award a bird.
- Captured frame posts to `/burbz/api/identify/image`.
- No random bird is awarded on failure.

**Pet:**
- Player can select a bird as pet.
- Pet appears, animates, and persists after refresh.
- Pet does not interfere with navigation or capture controls.

---

## Notes

The most important design rule: every bird added to the Birdex must come from a real successful recognition path. Demo mode is useful for development, but it must never be used as a fallback in the live game capture flow.
