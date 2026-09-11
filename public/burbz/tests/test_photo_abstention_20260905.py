import copy
import importlib.util
import json
import os
import sys
import types
from pathlib import Path
import pytest
from PIL import Image, ImageDraw

spec=importlib.util.spec_from_file_location('photo_v350',os.environ.get('PHOTO_TEST_MODULE',str(Path(__file__).parents[1]/'photo_id.py')))
photo=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo)

@pytest.fixture
def clear(tmp_path):
    # A pixel-quality fixture, not a recognition assertion; model fields below
    # are deliberately injected to exercise the independent acceptance gate.
    path=tmp_path/'texture.jpg';im=Image.new('RGB',(500,500),'grey');d=ImageDraw.Draw(im)
    for i in range(60,440,10):d.line((i,50,i,450),fill='black' if i%20 else 'white',width=4)
    im.save(path);return str(path)

def answer():
    return {'found':True,'species':'European Robin','scientificName':'Erithacus rubecula','confidence':.98,
            'alternatives':[{'species':'Common Redstart','confidence':.04}],
            'evidence':{'liveBird':True,'quality':'clear','diagnosticDetailsVisible':True,
                        'diagnosticFeatures':['Orange face and breast','Fine dark pointed bill'],'subjectBox':[100,100,900,900]}}

def rejected(raw,path):
    r=photo._normalise_species_result(raw,path)
    assert r['found'] is False and r['accepted'] is False
    assert r['message'].startswith('Bird not found.')
    assert 'species' not in r and 'allDetections' not in r

@pytest.mark.parametrize('confidence',[0,.5,.899,None,True,float('nan'),float('inf'),1.1])
def test_low_or_invalid_confidence_abstains(clear,confidence):
    a=answer();a['confidence']=confidence;rejected(a,clear)

@pytest.mark.parametrize('quality',['blurred','silhouette','too-small','obscured','nonbird'])
def test_unclear_and_nonbird_evidence_abstains(clear,quality):
    a=answer();a['evidence']['quality']=quality;rejected(a,clear)

@pytest.mark.parametrize('box',[[490,490,510,510],[0,0,20,800],[0,0,0,0],[900,900,100,100],[True,0,900,900],None])
def test_small_blobs_and_invalid_boxes_abstain(clear,box):
    a=answer();a['evidence']['subjectBox']=box;rejected(a,clear)

def test_ambiguous_species_and_missing_diagnostic_details_abstain(clear):
    a=answer();a['alternatives'][0]['confidence']=.85;rejected(a,clear)
    a=answer();a['evidence']['diagnosticFeatures']=['bird'];rejected(a,clear)
    a=answer();a['evidence']['liveBird']=False;rejected(a,clear)
    a=answer();a['found']='true';rejected(a,clear)

def test_blank_pixels_reject_even_an_overconfident_model(tmp_path):
    path=tmp_path/'blank.jpg';Image.new('RGB',(500,500),'white').save(path)
    rejected(answer(),str(path))

def test_clear_evidence_retains_true_species_without_location_relabelling(clear):
    r=photo._normalise_species_result(answer(),clear,'fixture-model')
    assert r['found'] is True and r['accepted'] is True and r['confidence']==.98
    assert r['species']=='European Robin' and r['scientificName']=='Erithacus rubecula'
    assert r['policy']=='photo-evidence-v393'

def test_no_key_or_weak_local_mode_fails_closed(clear,monkeypatch):
    monkeypatch.delenv('GEMINI_API_KEY',raising=False)
    for mode in ['', 'mobilenet', 'local', 'off']:
        monkeypatch.setenv('BURBZ_PHOTO_MODEL',mode)
        r=photo.identify_bird_from_image(clear,51.5,-.1)
        assert r['found'] is False and 'species' not in r

def test_valid_normalisation_strips_metadata_and_bounds_size(tmp_path):
    src=tmp_path/'source.png';dest=tmp_path/'normal.jpg'
    Image.new('RGB',(3000,1200),'grey').save(src);photo.normalise_image_file(str(src),str(dest))
    with Image.open(dest) as im:assert im.format=='JPEG' and max(im.size)==2560 and not im.getexif()

def model_fixture(monkeypatch, replies):
    calls=[]
    class ServiceUnavailable(Exception):pass
    def generate(parts, **kwargs):
        calls.append((parts,kwargs))
        result=replies.pop(0)
        if isinstance(result,Exception):raise result
        return types.SimpleNamespace(text=json.dumps(result))
    genai=types.ModuleType('google.generativeai')
    genai.configure=lambda **kwargs:None
    genai.GenerativeModel=lambda name:types.SimpleNamespace(generate_content=generate)
    google=types.ModuleType('google');google.generativeai=genai
    core=types.ModuleType('google.api_core');exceptions=types.ModuleType('google.api_core.exceptions')
    exceptions.ServiceUnavailable=ServiceUnavailable;core.exceptions=exceptions;google.api_core=core
    for name,module in [('google',google),('google.generativeai',genai),('google.api_core',core),('google.api_core.exceptions',exceptions)]:
        monkeypatch.setitem(sys.modules,name,module)
    monkeypatch.setenv('GEMINI_API_KEY','test-only-not-a-real-key')
    monkeypatch.setenv('BURBZ_PHOTO_MODEL','gemini')
    return calls,ServiceUnavailable

def test_species_requires_two_blind_readings_and_keeps_lower_confidence(clear,monkeypatch):
    second=answer();second['confidence']=.94
    calls,_=model_fixture(monkeypatch,[answer(),second])
    result=photo.identify_bird_from_image(clear)
    assert result['accepted'] is True and result['verified'] is True and result['confidence']==.94
    assert len(calls)==2 and len(calls[1][0])==4
    assert 'European Robin' not in ' '.join(p for p in calls[1][0] if isinstance(p,str))
    assert calls[1][1]['request_options']['timeout']<=calls[0][1]['request_options']['timeout']<=35
    assert calls[0][1]['request_options']['retry'] is None

@pytest.mark.parametrize('kind',['different-species','abstain','low-confidence','unclear','invalid-json'])
def test_verifier_cannot_overrule_ambiguity_or_disagreement(clear,monkeypatch,kind):
    second=answer()
    if kind=='different-species':second.update(species='Common Raven',scientificName='Corvus corax')
    if kind=='abstain':second={'found':False}
    if kind=='low-confidence':second['confidence']=.89
    if kind=='unclear':second['evidence']['quality']='blurred'
    if kind=='invalid-json':second=[]
    calls,_=model_fixture(monkeypatch,[answer(),second])
    result=photo.identify_bird_from_image(clear)
    assert result['accepted'] is False and 'species' not in result and len(calls)==2

def test_inconclusive_reading_is_never_retried_until_it_guesses(clear,monkeypatch):
    calls,_=model_fixture(monkeypatch,[{'found':False}])
    assert photo.identify_bird_from_image(clear)['accepted'] is False
    assert len(calls)==1

def test_transient_failure_retries_within_shared_budget_but_never_bypasses_verifier(clear,monkeypatch):
    replies=[];calls,error=model_fixture(monkeypatch,replies)
    replies.extend([error('temporary'),answer(),answer()])
    assert photo.identify_bird_from_image(clear)['accepted'] is True
    assert len(calls)==3
    assert all(calls[i+1][1]['request_options']['timeout']<=calls[i][1]['request_options']['timeout'] for i in range(2))

def test_failed_verifier_never_returns_the_first_guess(clear,monkeypatch):
    calls,_=model_fixture(monkeypatch,[answer(),RuntimeError('provider unavailable')])
    result=photo.identify_bird_from_image(clear)
    assert result['accepted'] is False and 'species' not in result
    assert result['reason']=='photo-model-unavailable' and len(calls)==2

def test_provider_quota_is_not_reported_as_a_bad_photo(clear,monkeypatch):
    class ResourceExhausted(Exception):pass
    model_fixture(monkeypatch,[ResourceExhausted('quota')])
    result=photo.identify_bird_from_image(clear)
    assert result['reason']=='photo-service-limit' and 'service limit' in result['message']
    assert 'clearer' not in result['message'] and result['accepted'] is False

@pytest.mark.parametrize('times',[[0,0,36],[0,0,1,1,36]])
def test_model_response_after_shared_deadline_cannot_award(clear,monkeypatch,times):
    calls,_=model_fixture(monkeypatch,[answer(),answer()])
    clock=iter(times);monkeypatch.setattr(photo.time,'monotonic',lambda:next(clock))
    result=photo.identify_bird_from_image(clear)
    assert result['accepted'] is False and 'species' not in result
