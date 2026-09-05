import copy
import importlib.util
import json
from pathlib import Path
import pytest
from PIL import Image, ImageDraw

spec=importlib.util.spec_from_file_location('photo_v350',Path(__file__).parents[1]/'photo_id.py')
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
    assert r['policy']=='photo-evidence-v350'

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
