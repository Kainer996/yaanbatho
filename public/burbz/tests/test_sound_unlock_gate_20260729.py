"""Behavioural proof for the continuous BirdNET V3 Birdex unlock gate.

The recogniser is the accuracy authority. A verified BirdNET V3 response has
already applied the geographic range model (the player's location and the week
of the year) and its temporal, precision-first confirmation before it names a
species, so a sound result mutates the Birdex whenever — and only when — that
exact production V3 provenance is verified. These tests execute the functions
extracted from ``index.html`` in Node rather than reimplementing the policy in
Python.
"""

import json
import subprocess
from functools import lru_cache
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    if html[max(0, start - 6):start] == "async ":
        start -= 6
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def gate_constants(html: str) -> str:
    start = html.index("const SOUND_SESSION_MAX_PER_WINDOW")
    end = html.index("\n\nfunction normaliseAcceptedBirdCandidates", start)
    return html[start:end]


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def shared_candidate_stubs() -> str:
    return r"""
global.window = global;
function speciesKey(name) {
  return String(name || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
function canonicalSpeciesName(name) {
  const clean = String(name || '').trim();
  if (clean === 'Common Chaffinch') return 'Chaffinch';
  if (clean === 'European Robin') return 'Robin';
  return clean;
}
function createBirdEntry(name, scientificName, confidence) {
  const canonical = canonicalSpeciesName(name);
  return {
    species: canonical,
    commonName: canonical,
    scientificName: scientificName || '',
    confidence: Number(confidence) || 0
  };
}
function exactV3(overrides) {
  return Object.assign({
    provider: 'birdnetv3',
    configuredProvider: 'birdnetv3',
    providerVerified: true,
    fallbackUsed: false,
    providerVersion: '3.0-preview3.1',
    modelName: 'BirdNET+ V3.0-preview3.1 Global 11K FP16 pruned',
    modelSha256: '69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24',
    labelsSha256: '8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0',
    scoreBlacklistSha256: 'a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366',
    geoModelSha256: '2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017',
    geoLabelsSha256: 'c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784',
    policyVersion: SOUND_REQUIRED_POLICY,
    serverIntegrationVersion: 4
  }, overrides || {});
}
function acceptedBirds(score, support, name, scientific) {
  name = name || 'Great Tit';
  scientific = scientific || 'Parus major';
  return normaliseAcceptedBirdCandidates(
    { species:name, scientificName:scientific, confidence:score },
    [{
      common_name:name,
      scientific_name:scientific,
      confidence:score,
      n:support
    }]
  );
}
function names(items) {
  return (items || []).map(item => item.commonName || item.species);
}
"""


def build_gate_harness() -> str:
    html = HTML.read_text(encoding="utf-8")
    constants = gate_constants(html)
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "normaliseAcceptedBirdCandidates",
            "soundUnlockProvenanceVerified",
            "soundCandidatesReadyToUnlock",
            "stopContinuousSoundListening",
        )
    )
    driver = r"""
const out = {};
const provenance = exactV3();

// A verified V3 response is trusted immediately: the server has already
// weighed the player's location and the week of the year and confirmed the
// bird temporally. A mid-range score with a single supporting window — a
// mewing buzzard — still unlocks. This is the regression the policy fixes.
soundUnlockEvidence.clear();
out.buzzardMidRange = names(soundCandidatesReadyToUnlock(
  acceptedBirds(0.42, 1, 'Common Buzzard', 'Buteo buteo'),
  provenance, {sequence:1, endedAt:1000}, 1000
));
out.buzzardEvidence = soundUnlockEvidence.size;

soundUnlockEvidence.clear();
out.high = names(soundCandidatesReadyToUnlock(
  acceptedBirds(0.98, 3), provenance, {sequence:2, endedAt:2000}, 2000
));

// Every catalogue bird the verified server named in one window unlocks
// together, not only the loudest, and none leave pending cross-window state.
soundUnlockEvidence.clear();
out.multiple = names(soundCandidatesReadyToUnlock(
  normaliseAcceptedBirdCandidates(
    { species:'Great Tit', scientificName:'Parus major', confidence:0.55 },
    [
      { common_name:'Great Tit', scientific_name:'Parus major', confidence:0.55, n:1 },
      { common_name:'Common Chaffinch', scientific_name:'Fringilla coelebs', confidence:0.61, n:2 }
    ]
  ),
  provenance, {sequence:3, endedAt:3000}, 3000
));
out.multipleEvidence = soundUnlockEvidence.size;

function blockedBy(overrides) {
  soundUnlockEvidence.clear();
  return names(soundCandidatesReadyToUnlock(
    acceptedBirds(0.999, 5),
    exactV3(overrides),
    {sequence:70, endedAt:70000},
    70000
  ));
}
out.badProvenance = {
  unverified: blockedBy({providerVerified:false}),
  v2: blockedBy({
    provider:'birdnetv2',
    configuredProvider:'birdnetv2',
    providerVersion:'2.4'
  }),
  fallback: blockedBy({
    provider:'perch',
    configuredProvider:'birdnetv3',
    fallbackUsed:true,
    providerVersion:'2.0'
  }),
  wrongModel: blockedBy({modelSha256:'unreviewed-model'}),
  wrongLabels: blockedBy({labelsSha256:'unreviewed-labels'}),
  wrongScoreBlacklist: blockedBy({scoreBlacklistSha256:'unreviewed-blacklist'}),
  missingScoreBlacklist: blockedBy({scoreBlacklistSha256:null}),
  wrongGeoModel: blockedBy({geoModelSha256:'unreviewed-geo-model'}),
  wrongGeoLabels: blockedBy({geoLabelsSha256:'unreviewed-geo-labels'}),
  wrongPolicy: blockedBy({policyVersion:'burbz-v3-temporal-stale'}),
  wrongIntegration: blockedBy({serverIntegrationVersion:3})
};

let soundListenerGeneration = 9;
let continuousSoundScanWanted = true;
let soundAnalysisAbortController = null;
let soundScanChunkTimer = null;
let mediaRecorder = null;
let listenerTrack = null;
let mediaStream = null;
let isRecording = false;
let listenerSourceNode = null;
let analyserNode = null;
let animFrameId = null;
const soundAnalysisQueue = { clear() {} };
const resetBirdPickup = () => {};
const setBurbzMusicSuppressed = () => {};
const setMerlinListenerState = () => {};
const soundDiscoveryHistory = { reset() {} };
const soundDiscoveryFlippedKeys = { clear() {} };
const renderSoundSessionDiscoveries = () => {};
soundUnlockEvidence.set('great_tit', {hits:1, sequence:99, at:99000});
stopContinuousSoundListening();
out.afterStop = {
  evidenceSize:soundUnlockEvidence.size,
  wanted:continuousSoundScanWanted,
  generation:soundListenerGeneration
};

console.log(JSON.stringify(out));
"""
    return (
        shared_candidate_stubs()
        + "\n"
        + constants
        + "\n"
        + functions
        + "\n"
        + driver
    )


@lru_cache(maxsize=1)
def gate_results() -> dict:
    return run_node(build_gate_harness())


def test_verified_v3_trusts_server_and_unlocks_confident_detections():
    out = gate_results()
    # The buzzard regression: a mid-range pooled score with a single supporting
    # window unlocks, because a verified V3 response has already confirmed the
    # bird for the player's location and season.
    assert out["buzzardMidRange"] == ["Common Buzzard"]
    assert out["buzzardEvidence"] == 0
    assert out["high"] == ["Great Tit"]
    # All catalogue birds the server named in one window unlock together.
    assert out["multiple"] == ["Great Tit", "Chaffinch"]
    assert out["multipleEvidence"] == 0


def test_unverified_legacy_fallback_and_mismatched_policy_can_never_unlock():
    blocked = gate_results()["badProvenance"]
    assert blocked == {
        "unverified": [],
        "v2": [],
        "fallback": [],
        "wrongModel": [],
        "wrongLabels": [],
        "wrongScoreBlacklist": [],
        "missingScoreBlacklist": [],
        "wrongGeoModel": [],
        "wrongGeoLabels": [],
        "wrongPolicy": [],
        "wrongIntegration": [],
    }


def test_stopping_listener_clears_cross_window_unlock_evidence():
    assert gate_results()["afterStop"] == {
        "evidenceSize": 0,
        "wanted": False,
        "generation": 10,
    }


def build_analysis_harness() -> str:
    html = HTML.read_text(encoding="utf-8")
    constants = gate_constants(html)
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "normaliseAcceptedBirdCandidates",
            "soundUnlockProvenanceVerified",
            "soundCandidatesReadyToUnlock",
            "analyseContinuousSoundWindow",
        )
    )
    driver = r"""
let soundListenerGeneration = 7;
let continuousSoundScanWanted = true;
let soundAnalysisAbortController = null;
let soundListenerState = 'listening';
const states = [];
const toasts = [];
const handled = [];
global.setTimeout = () => 1;
global.clearTimeout = () => {};
window.BurbzSoundListenerCore = {
  soundWindowAgeCue: () => 'sound recorded 12-0s ago'
};
function setMerlinListenerState(state, detail) {
  soundListenerState = state;
  states.push({state, detail});
}
function soundEngineLabel() { return 'BirdNET V3'; }
function showToast(message) { toasts.push(message); }
function handleBirdCandidates(primary, detections, opts) {
  handled.push({
    primary:primary.commonName || primary.species,
    detections:(detections || []).map(item => item.commonName || item.species),
    source:opts.source
  });
  return [primary].concat(detections || []);
}
let uploadResult = null;
function simultaneousResult(overrides) {
  return Object.assign(exactV3(overrides), {
    species:'Great Tit',
    scientificName:'Parus major',
    confidence:0.70,
    allDetections:[
      {
        common_name:'Great Tit',
        scientific_name:'Parus major',
        confidence:0.70,
        n:2
      },
      {
        common_name:'Common Chaffinch',
        scientific_name:'Fringilla coelebs',
        confidence:0.80,
        n:2
      }
    ]
  });
}
async function uploadRecording() {
  return uploadResult;
}

(async () => {
  uploadResult = simultaneousResult();
  await analyseContinuousSoundWindow({
    blob:{size:2048, type:'audio/webm'},
    generation:7,
    sequence:101,
    endedAt:100000,
    durationMs:12000
  });
  const exactMatch = states.filter(item => item.state === 'match').at(-1) || null;
  const exactToast = toasts.at(-1) || null;

  uploadResult = simultaneousResult({
    scoreBlacklistSha256:'stale-blacklist'
  });
  await analyseContinuousSoundWindow({
    blob:{size:2048, type:'audio/webm'},
    generation:7,
    sequence:102,
    endedAt:112000,
    durationMs:12000
  });
  console.log(JSON.stringify({
    handled,
    exactMatch,
    failedMatch:states.filter(item => item.state === 'match').at(-1) || null,
    exactToast,
    failedToast:toasts.at(-1) || null,
    evidence:Array.from(soundUnlockEvidence.entries())
  }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
"""
    return (
        shared_candidate_stubs()
        + "\n"
        + constants
        + "\n"
        + functions
        + "\n"
        + driver
    )


@lru_cache(maxsize=1)
def analysis_results() -> dict:
    return run_node(build_analysis_harness())


def test_analysis_displays_all_suggestions_but_mutates_only_unlock_ready_species():
    out = analysis_results()
    assert out["handled"] == [
        {"primary": "Great Tit", "detections": ["Chaffinch"], "source": "sound"}
    ]
    assert out["exactMatch"] is not None
    exact_detail = out["exactMatch"]["detail"]
    assert "Great Tit 70/100" in exact_detail
    assert "Chaffinch 80/100" in exact_detail
    assert "Birdex verified" in exact_detail
    assert "Great Tit + Chaffinch" in out["exactToast"]

    assert out["failedMatch"] is not None
    failed_detail = out["failedMatch"]["detail"]
    assert "Great Tit 70/100" in failed_detail
    assert "Chaffinch 80/100" in failed_detail
    assert "Birdex unchanged" in failed_detail
    assert "accuracy proof failed" in failed_detail
    assert "Great Tit + Chaffinch" in out["failedToast"]
    assert out["evidence"] == []
