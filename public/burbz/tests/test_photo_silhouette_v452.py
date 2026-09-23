"""Shape-identifiable silhouettes pass the same evidence rules as other photos."""
import hashlib
import io
import pytest
from test_photo_budget_v410 import ledger, jpeg, Provider
from photo_gemini import Recognizer, _normalise_species_result, POLICY


def raven() -> dict:
    # Matches the shape/confidence evidence observed in the screenshot-region probe;
    # generated jpeg pixels below are only a deterministic image-quality fixture.
    return dict(found=True, species="Common Raven", scientificName="Corvus corax",
                confidence=.88, alternatives=[dict(species="American Crow",
                scientificName="Corvus brachyrhynchos", confidence=.05)],
                evidence=dict(liveBird=True, quality="silhouette", diagnosticDetailsVisible=True,
                diagnosticFeatures=["Distinct wedge-shaped tail profile",
                "Long broad wings with deeply fingered primaries"], subjectBox=[20,20,980,980]))


def test_supported_raven_silhouette_is_verified_in_two_views(ledger):
    l,_=ledger; p=Provider(raven())
    r=Recognizer(l,p).identify(jpeg(),"owner_01234567890","request_01234567890","caller")
    assert r["accepted"] and r["verified"] and r["scientificName"]=="Corvus corax"
    assert r["confidence"]==.88 and len(r["receiptId"])==64
    assert len([a for a,b in p.calls if a=="generateContent"])==2


@pytest.mark.parametrize("change", ["nonbird", "no-details", "no-features", "low-score", "confuser", "tiny"])
def test_silhouette_is_not_a_blanket_acceptance(change):
    raw=raven()
    if change=="nonbird":raw["evidence"]["liveBird"]=False
    if change=="no-details":raw["evidence"]["diagnosticDetailsVisible"]=False
    if change=="no-features":raw["evidence"]["diagnosticFeatures"]=[]
    if change=="low-score":raw["confidence"]=.79
    if change=="confuser":raw["alternatives"][0]["confidence"]=.8
    if change=="tiny":raw["evidence"]["subjectBox"]=[0,0,1,1]
    assert not _normalise_species_result(raw,io.BytesIO(jpeg()))["accepted"]


def test_new_rules_do_not_replay_cached_silhouette_rejection(ledger):
    l,_=ledger; data=jpeg()
    old_digest=hashlib.sha256(POLICY.encode()+b"\0"+data).hexdigest()
    job,_=l.acquire("owner_01234567890","old_request_012345",old_digest,"caller")
    l.finish(job,{"found":False,"accepted":False,"reason":"unclear-subject"})
    p=Provider(raven())
    result=Recognizer(l,p).identify(data,"owner_01234567890","new_request_012345","caller")
    assert result["accepted"] and result["verified"] and len(p.calls)==4
