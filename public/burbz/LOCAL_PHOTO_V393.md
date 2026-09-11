# Free local photo recognition v393

Prepared locally in `/root/burbz-photo-accuracy-v393`. This supersedes the Gemini
experiment in `PHOTO_ACCURACY_V393.md`; the earlier crop/progress fixes remain.
The live game has not been changed by this preparation.

`photo_id.py` now sends the normalised camera JPEG over a local Unix socket.
It has no Google import, key requirement, paid fallback or remote inference.
Old `BURBZ_PHOTO_MODEL=gemini` configuration cannot reactivate Google. The
separate `photo_local.py` worker keeps PyTorch dependencies out of BirdNET’s
Python environment. The client requires `photo-local-v393`, accepted/verified
booleans, a finite score >=0.90 and the existing discovery/save funnel.

The worker uses the official Faster R-CNN ResNet50 FPN v2 detector, BioCLIP 2
with 11,131 worldwide bird taxa, and Birder’s European 707-class model.
628 species have an exact unambiguous name join for cross-model verification.
Unsupported common-name joins are never guessed or fuzzily matched.

Acceptance requires exactly one >=0.90 bird detection, sufficient original
subject pixels/contrast/detail, and matching species on two padded views.
Where both species models cover the taxon, both must agree on both views;
each reading needs >=0.60 score and >=0.20 lead over the runner-up, with one
model reaching >=0.90 on BOTH views. Else the worldwide model alone must meet
>=0.90 and >=0.20 margin on both views. The returned score is the lower of the
chosen primary model’s two scores. Different classifiers’ scores are not
interchangeable, and these are conservative heuristic gates, not calibrated
probabilities or a measured field accuracy. No location-based relabelling,
repeated voting until success, generative sharpening, or claimed diagnostic
features are used. `verified` means these checks passed, not expert validation.

The worker loads pinned, checksummed model files once and performs no runtime
downloads. One recognition runs at a time with two CPU threads, at most two
waiting requests and a three-second queue wait. Busy responses drain the
bounded upload before closing the socket, preventing a connection reset from
hiding the busy message. Models run under a separate systemd service with
CPUQuota=200%, MemoryMax=6G, no Internet network namespace and an owner-only
Unix socket. There is no daily quota or per-request provider fee. More traffic
still needs more computing capacity; this is not unlimited throughput.

## Evidence and limits

Evidence: `/root/burbz-local-photo-evidence/`. The nine real camera-route controls
confirm perched Common Raven, Carrion Crow, European Robin and Great Tit;
the ambiguous flying Raven abstains, as do blurred bird, distant blob, empty
scene and geometric nonbird. Separate checks confirm Australian Magpie and
reject a real dog and two bird illustrations. Initial accepted calls took
9–11 seconds; the HTTP trial under concurrent test activity took about
10–13 seconds. The actual camera handler is extracted unchanged from the
running server for staging; only catalogue/report helpers are isolated from
real records. Five simultaneous requests completed as one confirmed Raven and four explicit busy responses in 0.14–9.90 seconds; no connection reset or misidentification passed. Production sound is untouched.

These are a small regression sample, not an independent accuracy benchmark;
public training-image overlap is unknown, and Yaan’s own raven photos were
not supplied. Phone-camera field accuracy, liveness/photographs of screens,
all species, and sustained production capacity are unmeasured. The models can
still be wrong. Do not lower thresholds just to turn a failed fixture green.

26 focused Python checks and eight Node client groups pass. The broad suite
has 2,130 passes, five skips and exactly the same 65 baseline failures, with no
new failure IDs. Browser proof covers native pinch beyond 8x, retained 24 MP
source pixels, large progress sheet, both themes/orientations, exact-JPEG retry,
cancelled late-response rejection and saved Raven after reload; those UI
responses are mocked and are kept separate from real model evidence.

## Provisioning and guarded release

Models and the Python environment belong outside the web root. The tested
environment is `/root/burbz-local-photo-evidence/venv`; an offline prepared bundle
is in `prepared-models`. `scripts/prepare-local-photo.py` reproduced its manifest
byte-for-byte from the pinned downloads. The model bundle is about 2.2 GiB.

For an approved deployment, provision an isolated environment:

```sh
python3 -m venv /opt/burbz-photo/venv
/opt/burbz-photo/venv/bin/pip install torch==2.14.0+cpu torchvision==0.29.0+cpu --index-url https://download.pytorch.org/whl/cpu
/opt/burbz-photo/venv/bin/pip install -r scripts/photo-local-requirements.txt
/opt/burbz-photo/venv/bin/python scripts/prepare-local-photo.py --destination /opt/burbz-photo/models --cache /root/burbz-local-photo-evidence
```

The cache option is offline-only and verifies all source digests. Without it,
the provisioner downloads pinned public weights/data. It refuses to overwrite
an existing destination. Keep original model and dataset licences with the
installation; source links are in `scripts/prepare-local-photo.py` and
`LICENSING.md`. Do not put weights in Git, Git LFS, the app worker cache or
the served website.

Publish through the existing GitHub/guarded-sync workflow. The extended
`install-photo-id.sh` takes `photo_local.py` as its optional sixth argument
(older five-argument sync scripts use the worker beside the staged adapter), installs the
checksummed worker source in an immutable release directory, verifies its
loaded source hash on the local socket, then replaces/restarts the adapter.
It requires the real nine-image HTTP proof AND unchanged BirdNET sound proof
before publishing the shell. Failed promotion restores both the previous
adapter and worker unit/activity; the previous shell is never copied first.
The updater and generated autodeploy script both pass the worker source.

After publication, verify public index/worker bytes and the installed PWA,
the actual camera endpoint and sound proof. Do not bypass the installer or
include the unrelated `videos/friend-shaped.mp4` worktree difference.
