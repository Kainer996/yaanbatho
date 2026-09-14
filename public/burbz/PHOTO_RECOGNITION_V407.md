# Photo recognition v407

Prepared in `/root/burbz-photo-recognition-v407`, based on main/live
`8f2eed08394e2005ced837eb9f1bb3ad14bffc4a`. The owner authorized publication on
September 14. The final merge, live hashes and installed-PWA evidence are recorded
separately in `/root/burbz-photo-recognition-evidence/release/`.
The September 14 report describes two rejected clear photos: one gull and one
unknown bird. Production logs showed two recent HTTP 422 rejections, but uploads are
removed after analysis; the originals and exact model rejection reasons were
not retained. The user recalls the message "bird not recognised". These tests
reproduce related failures, not the user's two photos.

## What the other apps do

[Birdex's privacy policy, section 2.15](https://birdexprivacypolicy.carrd.co/)
says its server sends photos and optional context to Google Gemini, with OpenAI
as an alternative. It does not disclose the exact model or prompt.
[Cornell describes Merlin](https://support.ebird.org/en/support/solutions/articles/48001271537-merlin-photo-id-in-manage-media)
as bird detection followed by species classification, trained on millions of
Macaulay/eBird images. Its [Photo ID help](https://support.ebird.org/en/support/solutions/articles/48000966224-photo-id)
describes recropping and changing/removing location/date filters.
No public licensed Merlin photo model/API was found. This implementation uses
reusable local models; no Birdex or Merlin code/models were copied. The user's
previous free, self-hosted decision remains: no provider credentials, billing,
per-request fee or daily cloud quota.

## Change

The worldwide classifier is upgraded to the pinned, MIT-licensed
[BioCLIP 2.5 Huge](https://huggingface.co/imageomics/bioclip-2.5-vith14).
Two clear European herring gull controls are confidently labelled American
herring gull by the previous model; other clear photos abstain. The upgraded
model uses matching text vectors and distinct European/American herring gull
labels. Exactly one common-name vector is rebuilt with the author's original
recipe; the installer first reproduces the published vector and verifies its
cosine against the original. All other vectors and visual weights are unchanged.
Scientific identities remain distinct, and geography never changes a prediction.

The existing detector, two padded views, original-detail guards, 0.90 primary
score, 0.60 secondary floor, 0.20 margins and exact cross-model agreement remain.
628 exact shared taxa receive Birder verification. Scores are not calibrated
probabilities; agreement does not guarantee a correct identification. A two-view
illustration check rejects positively identified drawings, with uncertainty
alone insufficient for that veto. This is not proof of liveness.

The camera adds a separate **Use full photo** action, preserving the retained
photo's aspect ratio. The existing square framing remains available. Both actions
share request, cancel, retry and accepted-discovery/save rules. Neither can award
an uncertain prediction. Species uncertainty now says that a bird was detected
but its species was not confirmed, with advice to show head, wings and tail.
Service failures remain different from a rejected photo. The worker records
only outcome/reason/model/status, never the photo, species, filename, location,
account or uploaded metadata, so future rejection failures are diagnosable.

Detector/species processing still uses the tested, bounded 2560px JPEG route.
An attempted all-square internal crop/original-resolution change reduced
reliability and accepted an illustration; it is excluded. Experimental evidence
is retained separately, with no threshold tuning or weakened release fixtures.

## Validation and limits

Evidence lives in `/root/burbz-photo-recognition-evidence/`: source/bundle/input
hashes, old-model results, rejected experiments, final paired evaluation,
independently selected additional fixtures and real camera-route/browser proof.
The extra eight clear birds and one challenging gull were selected and visually
reviewed before predictions; their source/author/licence/hash manifests are in
`new-fixtures/`. Public training-image overlap is unknown. A clear frontal gull
still abstains. User-photo and physical-phone accuracy remain unmeasured.

The paired 33-case evaluation correctly identifies **18/19 clear birds** with
the new model versus **11/19** with live v393. Across all 24 bird photographs,
including challenging poses, correct identifications rise from 12 to 21; wrong
accepted identities fall from two to zero. All nine controls that must not unlock
a bird remain rejected. The separately selected eight clear photos and one
challenging gull are all correctly identified by the update; the live model
identifies five of those nine. These are small observed samples, not a measured
accuracy guarantee for player photos. Final model peak RSS was about 4.19 GiB,
within the existing 6 GiB worker limit; physical phone latency is unmeasured.

The tested installer requires 14 real camera outcomes (the original nine plus
four European/American gull positives and one illustration negative). A busy,
unavailable, timeout or malformed result cannot pass as a negative control.
It then requires the unchanged BirdNET sound proof. Installer tests exercise
actual temporary Unix-socket health with simulated systemd, including rollback
on photo/sound failures and stale worker/source/bundle/manifest prevention.

Final recorded checks:

- All 14 real staged HTTP photo controls pass through the unchanged production
  camera-route function and the new worker/adapter. Only catalogue/report helpers
  are isolated; no player records are written. Worker source/bundle hashes match
  the paired evaluation. Five concurrent uploads yield one correct Raven and
  four explicit busy results, with bounded waiting.
- The real phone-sized browser path uploads a European herring gull using
  **Use full photo**, identifies and saves it, rejects a dog without rewards,
  then restores the gull after reload. All three controls remain visible in six
  Normal/Comic portrait/landscape layouts, with zero page errors. This browser
  proof uses the staged HTTP model, not mocked identification responses; service
  workers are blocked, so installed-PWA migration remains a deployment check.
- 27 focused photo Python checks, 33 installer/proof checks, 13 Node client groups
  and six focused current-release assertions pass. The broad suite records
  2,041 passes, five skips and exactly the same 196 failing test IDs as baseline
  (2,007 passes). There are no new failure IDs; the whole suite is not green.
- All four existing read-only BirdNET sound controls pass against the unchanged
  live backend. Guarded publication must repeat sound proof after installation.
- The offline provisioner reproduces the model manifest byte-for-byte, and an
  independent final source review found no blocking defect. Evidence indexes:
  `model-comparison.json`, `pytest-comparison.json`, `http-proof.json`,
  `http-results.json`, `browser-results.json` and `sound-proof.json`.

## Guarded publication

The reproducible prepared bundle is
`/root/burbz-photo-recognition-evidence/rebuilt-models`. Its manifest matches the
recovered candidate byte-for-byte. The provisioner pins and checks every source;
`--cache` is strictly offline. Source cache:
`/root/burbz-photo-diagnostic-v407/source-cache`.

```sh
/opt/burbz-photo/venv/bin/python scripts/prepare-local-photo.py \
  --destination /opt/burbz-photo/models-v407 \
  --cache /root/burbz-photo-diagnostic-v407/source-cache
```

Never overwrite `/opt/burbz-photo/models`: it is the old worker's rollback bundle.
The installer selects `models-v407` from the staged literal BUNDLE contract;
loaded source, model, bundle and exact manifest hash must match even on the
no-op path. Worker source goes in an immutable release directory. The previous
unit and adapter are restored if readiness, photo or sound proof fails.
Provisioning/worker construction uses an actual `torch.device('meta')` context,
avoiding a full random CPU model allocation before loading checked weights.

Publish the reviewed branch through the normal GitHub/guarded sync workflow;
ensure its updated fixture list and installer are used. Do not bypass mandatory
proofs. The worker retains two CPU threads, one active inference, bounded
waiting, a 6 GiB memory limit and no Internet namespace. Capacity is finite.
After deployment verify live source/worker/bundle hashes, photo and sound proofs,
public index/service-worker bytes, and the returning installed PWA/save path.
The unrelated `videos/friend-shaped.mp4` worktree difference is excluded.

## Photo journal v407b follow-up

The real returning-PWA check verified v406b→v407 activation and accepted a gull
through the public API, then exposed an existing first-photo save defect. The
discovery and reward persisted, but `rememberPlayerBirdPhoto` ran before
`rememberDiscoveredBird` created the record, so it returned without saving the
JPEG. For a known bird missing its photo, the same ordering let the helper hold
an old record that the discovery update immediately replaced.

The v407b correction moves that call after the discovery updates. It preserves
the first stored photo, canonical discovery identity and one-time rewards.
Only inline app behavior and the global app/cache build change; recognition,
sound, model files, thresholds and module pins remain identical to tested v407.

The first PWA runner also tried tapping Home's camera button behind the
intentional results/settings drawer. Native Close and Choose a bird photo were
already usable; that test navigation was corrected without changing the drawer.
Original failure reports and separate continuation scopes remain in `release/`.
First-time storage must be verified using a genuinely undiscovered bird, with
actual IndexedDB JPEG dimensions/hash retained through online/offline reloads.

Five new behavioral regression groups execute the actual discovery, compression,
photo-store and save functions, with disposable browser/storage boundaries.
They pass on the correction and fail on released v407 for the new-photo and
replaced-record cases. Existing photo/discovery Node checks and 21 focused
Python checks also pass. Production follow-up receipts are recorded separately
from the original recognition deployment; the recognizer and its fourteen
live model controls are unchanged.
