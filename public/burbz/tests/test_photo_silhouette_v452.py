"""Shape-identifiable silhouettes pass the same evidence rules as other photos.

v486 keeps the v452 rule: a silhouette is a picture quality, not a rejection.
The worker reports it; the adapter decides from the ranking and the evidence.
"""
import hashlib
import io
import pytest
from test_photo_budget_v410 import ledger, jpeg, Provider
from photo_gemini import Recognizer, reading, POLICY
import photo_id


def raven() -> dict:
    # Matches the shape/confidence evidence observed in the screenshot-region probe;
    # generated jpeg pixels below are only a deterministic image-quality fixture.
    return dict(liveBird=True, quality="silhouette", subjectBox=[20, 20, 980, 980],
                fieldMarks=["Distinct wedge-shaped tail profile", "Long broad wings with deeply fingered primaries"],
                candidates=[dict(species="Common Raven", scientificName="Corvus corax", probability=.88),
                            dict(species="American Crow", scientificName="Corvus brachyrhynchos", probability=.05)],
                otherProbability=.07)


def decided(raw):
    worker = reading(raw, io.BytesIO(jpeg()))
    worker.update(retryable=False, receiptId="d" * 64)
    clean, problem = photo_id._validate_reading(worker)
    return problem or photo_id.decide(clean)


def test_supported_raven_silhouette_is_found_from_one_reading(ledger):
    l, _ = ledger; p = Provider(raven())
    r = Recognizer(l, p).identify(jpeg(), "owner_01234567890", "request_01234567890", "caller")
    assert r["found"] and r["quality"] == "silhouette" and len(r["receiptId"]) == 64
    assert len([a for a, b in p.calls if a == "generateContent"]) == 1
    result = decided(raven())
    assert result["accepted"] and result["verified"] and result["scientificName"] == "Corvus corax"
    assert result["confidence"] == .88


@pytest.mark.parametrize("change", ["nonbird", "no-features", "low-score", "confuser", "tiny"])
def test_silhouette_is_not_a_blanket_acceptance(change):
    raw = raven()
    if change == "nonbird": raw["liveBird"] = False
    if change == "no-features": raw["fieldMarks"] = []
    if change == "low-score": raw["candidates"][0]["probability"] = .79
    if change == "confuser": raw["candidates"][0]["probability"] = .5; raw["candidates"][1]["probability"] = .45
    if change == "tiny": raw["subjectBox"] = [0, 0, 1, 1]
    assert not decided(raw).get("accepted")


def test_new_rules_do_not_replay_cached_silhouette_rejection(ledger):
    l, _ = ledger; data = jpeg()
    old_digest = hashlib.sha256(b"photo-gemini-v425\0" + data).hexdigest()
    job, _ = l.acquire("owner_01234567890", "old_request_012345", old_digest, "caller")
    l.finish(job, {"found": False, "accepted": False, "reason": "unclear-subject"})
    p = Provider(raven())
    result = Recognizer(l, p).identify(data, "owner_01234567890", "new_request_012345", "caller")
    assert result["found"] and result["policy"] == POLICY and len(p.calls) == 2
