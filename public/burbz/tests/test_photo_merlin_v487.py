"""Merlin-style photo ID v487: place, week, one taxonomy and a ranked choice."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import sys

import pytest
from flask import Flask

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT))
import photo_gemini
import photo_id
from test_photo_budget_v410 import ledger, jpeg, Provider  # noqa: F401 (fixture)

# Real geomodel label rows (code, scientific, common) for the birds these tests
# need, plus one numeric GBIF id, which the geomodel uses for non-birds.
ROWS = [
    ('comrav', 'Corvus corax', 'Common Raven'),
    ('eurjac', 'Coloeus monedula', 'Eurasian Jackdaw'),
    ('daujac1', 'Coloeus dauuricus', 'Daurian Jackdaw'),
    ('y00743', 'Corvus corone', 'Carrion Crow'),
    ('rook1', 'Corvus frugilegus', 'Rook'),
    ('anhing', 'Anhinga anhinga', 'Anhinga'),
    ('grbher3', 'Ardea herodias', 'Great Blue Heron'),
    ('graher1', 'Ardea cinerea', 'Gray Heron'),
    ('blutit', 'Cyanistes caeruleus', 'Eurasian Blue Tit'),
    ('categr1', 'Ardea ibis', 'Western Cattle-Egret'),
    ('comhom1', 'Delichon urbicum', 'Western House-Martin'),
    ('whiwag', 'Motacilla alba', 'White Wagtail'),
    ('eurrob1', 'Erithacus rubecula', 'European Robin'),
    ('stonec4', 'Saxicola rubicola', 'European Stonechat'),
    ('afrsto1', 'Saxicola torquatus', 'African Stonechat'),
    ('euhgul1', 'Larus argentatus', 'European Herring Gull'),
    ('amhgul1', 'Larus smithsonianus', 'American Herring Gull'),
    ('redpol1', 'Acanthis flammea', 'Redpoll'),
    ('brnowl', 'Tyto alba', 'American Barn Owl'),
    ('1578502', 'Tyto furcata', 'American Barn Owl'),
    ('25250', 'Pseudophryne raveni', 'Copper-backed Brood Frog'),
]
# BirdNET Geomodel V3.0.2 at Clitheroe (53.9, -2.4), week 36, rounded.
CLITHEROE = {'Corvus corax': .9392, 'Coloeus monedula': .9956, 'Coloeus dauuricus': 0.0,
             'Corvus corone': .9977, 'Corvus frugilegus': .9915, 'Anhinga anhinga': 0.0,
             'Ardea herodias': .0002, 'Ardea cinerea': .9894, 'Cyanistes caeruleus': .996,
             'Ardea ibis': .02, 'Delichon urbicum': .6, 'Motacilla alba': .995,
             'Erithacus rubecula': .998, 'Saxicola rubicola': .91, 'Saxicola torquatus': 0.0,
             'Larus argentatus': .976, 'Larus smithsonianus': .001, 'Acanthis flammea': .4,
             'Tyto alba': .78, 'Tyto furcata': 0.0, 'Pseudophryne raveni': 0.0}
# The same labels on the coast of Maine: American birds, no European ones.
MAINE = dict(CLITHEROE, **{'Larus argentatus': .002, 'Larus smithsonianus': .99, 'Tyto alba': 0.0,
                           'Tyto furcata': .3, 'Saxicola rubicola': 0.0, 'Corvus corax': .6})


@pytest.fixture
def taxonomy():
    return photo_id.Taxonomy(ROWS)


def place(taxonomy, table=CLITHEROE, lat=53.9, lon=-2.4, week=36):
    return photo_id.Place(lat, lon, week, [table[s] for _, s, _ in ROWS], taxonomy)


def worker_reading(candidates, other=0.0, **updates):
    return dict(found=True, accepted=False, verified=False, policy=photo_id.PHOTO_POLICY,
                model='gemini-vision', modelName=photo_id.MODEL_NAME, reason='ranked', liveBird=True,
                quality='silhouette', subjectClear=True, retryable=False, receiptId='c' * 64,
                fieldMarks=['Wedge-shaped tail in flight', 'Long fingered primaries'],
                candidates=[{'species': n, 'scientificName': s, 'probability': p} for n, s, p in candidates],
                otherProbability=other) | updates


def decide(raw, where=None, taxonomy=None):
    reading, problem = photo_id._validate_reading(raw)
    assert problem is None, problem
    return photo_id.decide(reading, where, taxonomy)


# ---------------------------------------------------------------- taxonomy

@pytest.mark.parametrize('scientific,common,expected', [
    ('Corvus monedula', 'Western Jackdaw', 'Coloeus monedula'),
    ('Coloeus monedula', 'Jackdaw', 'Coloeus monedula'),
    ('Corvus corax', 'Northern Raven', 'Corvus corax'),
    ('Ardea cinerea', 'Grey Heron', 'Ardea cinerea'),
    ('Parus caeruleus', 'Blue Tit', 'Cyanistes caeruleus'),
    ('Bubulcus ibis', 'Cattle Egret', 'Ardea ibis'),
    ('Delichon urbica', 'House Martin', 'Delichon urbicum'),
    ('Fakeus avis', 'Grey Heron', 'Ardea cinerea'),
])
def test_one_taxonomy_maps_synonyms_and_genus_moves(taxonomy, scientific, common, expected):
    assert taxonomy.match(scientific, common)[1] == expected


def test_old_names_for_split_species_follow_the_place(taxonomy):
    here, maine = place(taxonomy), place(taxonomy, MAINE, 44.0, -69.0)
    assert taxonomy.match('Saxicola torquatus', 'Stonechat', here)[1] == 'Saxicola rubicola'
    assert taxonomy.match('Saxicola torquata', 'Common Stonechat', here)[1] == 'Saxicola rubicola'
    assert taxonomy.match('Larus argentatus', 'Herring Gull', maine)[1] == 'Larus smithsonianus'
    assert taxonomy.match('Larus argentatus', 'Herring Gull', here)[1] == 'Larus argentatus'
    assert taxonomy.match('Tyto alba', 'Barn Owl', maine)[1] == 'Tyto furcata'
    assert taxonomy.match('Tyto alba', 'Barn Owl', here)[2] == 'Western Barn Owl'
    # Without a place the model's own name stands.
    assert taxonomy.match('Larus argentatus', 'Herring Gull')[1] == 'Larus argentatus'
    assert taxonomy.match('Saxicola torquatus', 'Stonechat')[1] == 'Saxicola torquatus'


def test_lumped_species_keep_their_name_and_borrow_the_range(taxonomy):
    position, scientific, _ = taxonomy.match('Acanthis cabaret', 'Lesser Redpoll', place(taxonomy))
    assert scientific == 'Acanthis cabaret' and taxonomy.rows[position][0] == 'Acanthis flammea'
    raw = worker_reading([('Lesser Redpoll', 'Acanthis cabaret', .9)], other=.1, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['scientificName'] == 'Acanthis cabaret' and result['candidates'][0]['local'] == 'likely'


def test_uk_stonechat_under_its_old_name_is_found_not_floored(taxonomy):
    raw = worker_reading([('Stonechat', 'Saxicola torquatus', .9)], other=.1, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['found'] and result['scientificName'] == 'Saxicola rubicola'


def test_numeric_label_birds_count_as_birds(taxonomy):
    assert taxonomy.match('Tyto furcata', 'American Barn Owl')[1] == 'Tyto furcata'
    names = [s for _, s in place(taxonomy, MAINE, 44.0, -69.0).context()['checklist']]
    assert 'Tyto furcata' in names and 'Pseudophryne raveni' not in names


@pytest.mark.parametrize('scientific,common', [
    ('Fakeus birdus', 'Nonsense Bird'),
    ('Pseudophryne raveni', 'Frog'),        # non-bird geomodel classes are never birds
    ('Corvus dauuricus', 'Raven'),          # epithet alone never decides: the bird word must agree
])
def test_unknown_names_are_never_guessed(taxonomy, scientific, common):
    assert taxonomy.match(scientific, common) is None


# ---------------------------------------------------------------- ranking

def test_yaans_raven_can_no_longer_be_an_american_anhinga(taxonomy):
    # The 25 September result: a raven in flight over Lancashire came back as
    # "Anhinga or Great Blue Heron or Grey Heron". Neither American bird lives there.
    raw = worker_reading([('Anhinga', 'Anhinga anhinga', .40), ('Great Blue Heron', 'Ardea herodias', .30),
                          ('Common Raven', 'Corvus corax', .25)], other=.05)
    result = decide(raw, place(taxonomy), taxonomy)
    names = [c['scientificName'] for c in result['candidates']]
    assert names[0] == 'Corvus corax' and result['placeUsed'] is True
    # The model itself only gave the raven 25%, so the player confirms it.
    assert result['found'] is False and result['reason'] == 'pick-your-bird'
    assert result['candidates'][0]['local'] == 'likely'
    assert {'Anhinga anhinga', 'Ardea herodias'}.isdisjoint(names[:1])
    for c in result['candidates'][1:]:
        assert c['local'] == 'unexpected'


def test_raven_silhouette_that_the_model_is_sure_of_is_found(taxonomy):
    raw = worker_reading([('Common Raven', 'Corvus corax', .88), ('Carrion Crow', 'Corvus corone', .06)], other=.06)
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['found'] and result['verified'] and result['scientificName'] == 'Corvus corax'
    assert result['confidence'] >= .8


def test_split_jackdaw_names_are_one_bird_not_two_rivals(taxonomy):
    # Old gates compared raw strings, so Corvus/Coloeus monedula disagreed with itself.
    raw = worker_reading([('Western Jackdaw', 'Corvus monedula', .5), ('Eurasian Jackdaw', 'Coloeus monedula', .4),
                          ('Daurian Jackdaw', 'Coloeus dauuricus', .05)], other=.05, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['found'] and result['scientificName'] == 'Coloeus monedula'
    assert result['species'] == 'Western Jackdaw'
    assert [c['scientificName'] for c in result['candidates']] == ['Coloeus monedula']


def test_a_vagrant_stays_pickable_but_is_never_found_on_a_guess(taxonomy):
    raw = worker_reading([('Great Blue Heron', 'Ardea herodias', .95)], other=.05, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['found'] is False and result['reason'] == 'pick-your-bird'
    assert result['candidates'][0]['scientificName'] == 'Ardea herodias'
    assert result['candidates'][0]['local'] == 'unexpected'


def test_without_a_place_the_model_ranking_stands_and_carries_no_local_tags(taxonomy):
    raw = worker_reading([('Anhinga', 'Anhinga anhinga', .9)], other=.1)
    result = decide(raw, None, taxonomy)
    assert result['found'] and result['scientificName'] == 'Anhinga anhinga' and result['placeUsed'] is False
    assert 'local' not in result['candidates'][0]


def test_rare_local_birds_are_softened_not_removed(taxonomy):
    raw = worker_reading([('Cattle Egret', 'Bubulcus ibis', .7), ('Grey Heron', 'Ardea cinerea', .3)])
    result = decide(raw, place(taxonomy), taxonomy)
    by_name = {c['scientificName']: c for c in result['candidates']}
    assert by_name['Ardea ibis']['local'] == 'rare'
    assert by_name['Ardea cinerea']['score'] > by_name['Ardea ibis']['score'] > 0


def test_candidates_are_bounded_and_tiny_tails_are_hidden(taxonomy):
    raw = worker_reading([('Common Raven', 'Corvus corax', .6), ('Carrion Crow', 'Corvus corone', .3),
                          ('Rook', 'Corvus frugilegus', .09), ('Eurasian Jackdaw', 'Coloeus monedula', .005)], other=.005)
    result = decide(raw, place(taxonomy), taxonomy)
    assert [c['scientificName'] for c in result['candidates']] == ['Corvus corax', 'Corvus corone', 'Corvus frugilegus']
    assert all(0 <= c['score'] <= 1 for c in result['candidates'])


def test_place_context_is_coarse_and_lists_local_birds_most_likely_first(taxonomy):
    context = place(taxonomy, lat=53.87, lon=-2.39).context()
    assert context['region'] == 'near 54.0°N, 2.5°W' and context['season'] == 'late September'
    names = [s for _, s in context['checklist']]
    assert names[0] == 'Erithacus rubecula' and 'Anhinga anhinga' not in names
    assert 'Pseudophryne raveni' not in names and 'Ardea ibis' not in names  # below the list floor
    assert photo_gemini.clean_context(context) == context


@pytest.mark.parametrize('week,season', [(1, 'early January'), (2, 'mid January'), (4, 'late January'),
                                         (36, 'late September'), (48, 'late December')])
def test_birdnet_weeks_read_as_plain_seasons(taxonomy, week, season):
    assert place(taxonomy, week=week).context()['season'] == season


# ---------------------------------------------------------------- adapter I/O

FORM = {'photoOwner': 'owner_01234567890', 'photoRequestId': 'request_01234567890', 'photoContract': 'merlin-v487'}


class GeoProvider:
    def __init__(self):
        self.asked = []

    def _birdnet_week(self, _):
        return 36

    def _geo_probabilities(self, lat, lon, week):
        self.asked.append((lat, lon, week))
        return [CLITHEROE[s] for _, s, _ in ROWS]


def connection(calls, body):
    class Response:
        status = 200

        def read(self, _):
            return json.dumps(body).encode()

    class Connection:
        def request(self, *args, **kwargs):
            calls.append(json.loads(kwargs['body']))

        def getresponse(self):
            return Response()

        def close(self):
            pass
    return Connection


def identify(monkeypatch, tmp_path, form, geo=None, body=None):
    calls = []
    path = tmp_path / 'photo.jpg'
    path.write_bytes(b'validated-image-bytes')
    tax = photo_id.Taxonomy(ROWS)
    monkeypatch.setattr(photo_id, '_taxonomy_or_none', lambda: tax)
    monkeypatch.setattr(photo_id, '_geo_provider', lambda: geo)
    monkeypatch.setattr(photo_id, '_LocalConnection', connection(calls, body or worker_reading(
        [('Common Raven', 'Corvus corax', .5), ('Anhinga', 'Anhinga anhinga', .45)], other=.05)))
    with Flask(__name__).test_request_context('/burbz/api/identify/image', method='POST', data=form,
                                              environ_base={'REMOTE_ADDR': '203.0.113.5'}):
        return photo_id.identify_bird_from_image(str(path)), calls


def test_place_and_week_reach_the_prompt_and_the_ranking(monkeypatch, tmp_path):
    geo = GeoProvider()
    result, calls = identify(monkeypatch, tmp_path, FORM | {'lat': '53.8712', 'lon': '-2.3911', 'photoWeek': '36'}, geo)
    assert geo.asked == [(53.9, -2.4, 36)]            # 0.1 degree for the range model
    context = calls[0]['context']
    assert context['region'] == 'near 54.0°N, 2.5°W'   # half a degree for Google
    assert '53.87' not in json.dumps(calls[0]) and '2.39' not in json.dumps(calls[0])
    assert result['placeUsed'] is True and result['candidates'][0]['scientificName'] == 'Corvus corax'


@pytest.mark.parametrize('form', [FORM, FORM | {'lat': 'nan', 'lon': '1'}, FORM | {'lat': '95', 'lon': '1'},
                                  FORM | {'lat': '51.5'}])
def test_missing_or_bad_place_sends_no_context(monkeypatch, tmp_path, form):
    geo = GeoProvider()
    result, calls = identify(monkeypatch, tmp_path, form, geo)
    assert 'context' not in calls[0] and not geo.asked and result['placeUsed'] is False


def test_range_model_failure_never_blocks_a_photo(monkeypatch, tmp_path):
    class Broken(GeoProvider):
        def _geo_probabilities(self, *_):
            raise RuntimeError('onnx failed')
    result, calls = identify(monkeypatch, tmp_path, FORM | {'lat': '53.9', 'lon': '-2.4'}, Broken())
    assert 'context' not in calls[0] and result['placeUsed'] is False and result['candidates']


def test_old_worker_policy_is_refused(monkeypatch, tmp_path):
    result, _ = identify(monkeypatch, tmp_path, FORM, None, worker_reading([('Robin', 'Erithacus rubecula', 1)],
                                                                         policy='photo-gemini-v425'))
    assert result['reason'] == 'invalid-worker-result' and 'candidates' not in result


# ---------------------------------------------------------------- worker

RAVEN_JSON = {'liveBird': True, 'quality': 'silhouette', 'subjectBox': [20, 20, 980, 980],
              'fieldMarks': ['Wedge-shaped tail in flight', 'Deeply fingered primaries', 'x'],
              'candidates': [{'species': 'Common Raven', 'scientificName': 'Corvus corax corax', 'probability': .7,
                              'plumage': 'adult'},
                             {'species': 'Carrion Crow', 'scientificName': 'Corvus corone', 'probability': .2,
                              'plumage': 'unknown'},
                             {'species': 'Common Raven again', 'scientificName': 'Corvus corax', 'probability': .05},
                             {'species': 'Bad', 'scientificName': 'lowercase name', 'probability': .05}],
              'otherProbability': .05}


def test_worker_makes_one_medium_thinking_call_with_place_in_the_prompt(ledger):
    book, _ = ledger
    provider = Provider(RAVEN_JSON)
    context = place(photo_id.Taxonomy(ROWS)).context()
    result = photo_gemini.Recognizer(book, provider).identify(jpeg(), 'owner_012345678901', 'request_012345678901',
                                                               'caller', context)
    paid = [body for action, body in provider.calls if action == 'generateContent']
    assert len(paid) == 1 and len(provider.calls) == 2
    config = paid[0]['generationConfig']
    assert config['thinkingConfig'] == {'thinkingLevel': 'medium', 'includeThoughts': False}
    assert config['temperature'] == 1 and config['maxOutputTokens'] == 8192
    parts = paid[0]['contents'][0]['parts']
    assert 'inlineData' in parts[0]            # the picture first, then the question
    prompt = parts[1]['text']
    assert 'near 54.0°N, 2.5°W' in prompt and 'late September' in prompt and 'Common Raven (Corvus corax)' in prompt
    assert 'Anhinga' not in prompt and 'wedge-shaped' in prompt
    assert result['found'] is True and result['accepted'] is False and len(result['receiptId']) == 64
    assert [c['scientificName'] for c in result['candidates']] == ['Corvus corax', 'Corvus corone']
    assert result['candidates'][0]['plumage'] == 'adult' and 'plumage' not in result['candidates'][1]
    assert result['fieldMarks'] == RAVEN_JSON['fieldMarks'][:2] and result['subjectClear'] is True
    assert result['attemptCostNanoGBP'] > 0 and result['context'] is True


def test_worker_without_place_says_so(ledger):
    book, _ = ledger
    provider = Provider(RAVEN_JSON)
    photo_gemini.Recognizer(book, provider).identify(jpeg(), 'owner_012345678901', 'request_012345678901', 'caller')
    prompt = provider.calls[1][1]['contents'][0]['parts'][1]['text']
    assert 'location is unknown' in prompt and 'range model' not in prompt


def test_a_stored_reading_replays_under_any_place_and_the_adapter_reweighs_it(ledger):
    # A stable release-proof id must never hit request-conflict because the
    # range model was up on one deploy and down on the next.
    book, _ = ledger
    data = jpeg()
    context = place(photo_id.Taxonomy(ROWS)).context()
    provider = Provider(RAVEN_JSON)
    recognizer = photo_gemini.Recognizer(book, provider)
    first = recognizer.identify(data, 'owner_012345678901', 'request_012345678901', 'caller', context)
    assert recognizer.identify(data, 'owner_012345678901', 'request_012345678901', 'caller') == first
    assert recognizer.identify(data, 'owner_012345678901', 'request_012345678901', 'caller',
                               dict(context, region='near 40.5°N, 3.5°W')) == first
    assert len(provider.calls) == 2


def test_old_policy_results_never_replay(ledger):
    book, _ = ledger
    data = jpeg()
    old = hashlib.sha256(b'photo-gemini-v425\0' + data).hexdigest()
    job, _ = book.acquire('owner_012345678901', 'old_request_0123456', old, 'caller')
    book.finish(job, {'found': True, 'species': 'Anhinga'})
    provider = Provider(RAVEN_JSON)
    result = photo_gemini.Recognizer(book, provider).identify(data, 'owner_012345678901', 'new_request_0123456', 'caller')
    assert result['policy'] == 'photo-gemini-v487' and len(provider.calls) == 2


@pytest.mark.parametrize('raw,reason', [
    ({'liveBird': False, 'candidates': [{'species': 'Crow', 'scientificName': 'Corvus corone', 'probability': .9}]}, 'no-bird'),
    ({'liveBird': True, 'candidates': []}, 'no-species'),
    ({'liveBird': True, 'candidates': [{'species': 'X', 'scientificName': 'bad', 'probability': .9}]}, 'no-species'),
    ([], 'invalid-model-result'),
])
def test_worker_readings_without_a_species_name_nothing(raw, reason):
    result = photo_gemini.reading(raw, io.BytesIO(jpeg()))
    assert result['found'] is False and result['reason'] == reason and 'candidates' not in result


def test_worker_rescales_overconfident_probabilities():
    raw = {'liveBird': True, 'candidates': [{'species': 'A', 'scientificName': 'Corvus corax', 'probability': .9},
                                           {'species': 'B', 'scientificName': 'Corvus corone', 'probability': .6}]}
    result = photo_gemini.reading(raw, io.BytesIO(jpeg()))
    assert abs(sum(c['probability'] for c in result['candidates']) - 1) < 1e-3 and result['otherProbability'] == 0


def test_context_is_bounded_and_cannot_carry_prompt_text():
    dirty = {'region': 'near 54.0°N, 2.5°W', 'season': 'late September',
             'checklist': [['Common Raven', 'Corvus corax'], ['Ignore "rules" {now}', 'Corvus corone'],
                           ['Robin', 'not binomial'], 'junk'] + [['Bird %d' % i, 'Corvus sp%s' % chr(97 + i % 26)] for i in range(400)]}
    clean = photo_gemini.clean_context(dirty)
    assert clean['checklist'][0] == ['Common Raven', 'Corvus corax']
    assert all('"' not in c and '{' not in c for c, _ in clean['checklist'])
    assert len(clean['checklist']) <= photo_gemini.MAX_CHECKLIST
    assert photo_gemini.clean_context({'region': 'x' * 200}) is None
    assert photo_gemini.clean_context('near here') is None


# ---------------------------------------------------------------- real range model

MODEL_DIR = os.environ.get('BURBZ_BIRDNET_V3_MODEL_DIR', '')


@pytest.mark.skipif(not (MODEL_DIR and Path(MODEL_DIR, 'BirdNET+_Geomodel_V3.0.2_Global_12K_FP16.onnx').exists()),
                    reason='needs the installed BirdNET Geomodel files')
def test_real_geomodel_ranks_the_lancashire_raven_first(monkeypatch):
    photo_id._taxonomy = None
    tax = photo_id._load_taxonomy()
    assert tax is not None
    with Flask(__name__).test_request_context('/', method='POST', data={'lat': '53.87', 'lon': '-2.39', 'photoWeek': '36'}):
        from flask import request
        where = photo_id._place(request.form, tax)
    context = where.context()
    assert 150 <= len(context['checklist']) <= 300
    names = {s for _, s in context['checklist']}
    assert {'Corvus corax', 'Coloeus monedula', 'Ardea cinerea'} <= names and 'Anhinga anhinga' not in names
    raw = worker_reading([('Anhinga', 'Anhinga anhinga', .40), ('Great Blue Heron', 'Ardea herodias', .30),
                          ('Northern Raven', 'Corvus corax', .25)], other=.05)
    result = decide(raw, where, tax)
    assert result['candidates'][0]['scientificName'] == 'Corvus corax'
    jackdaw = decide(worker_reading([('Western Jackdaw', 'Corvus monedula', .9)], other=.1, quality='clear'), where, tax)
    assert jackdaw['found'] and jackdaw['scientificName'] == 'Coloeus monedula'


# ---------------------------------------------------------------- release proof, end to end

def load_proof():
    import importlib.util
    spec = importlib.util.spec_from_file_location('photo_proof_v487', ROOT.parents[1] / 'scripts/verify-photo-id.py')
    proof = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(proof)
    return proof


@pytest.mark.parametrize('name,species,model_json,with_place', [
    ('robin-clear', 'Erithacus rubecula', {'liveBird': True, 'quality': 'clear', 'subjectBox': [20, 20, 980, 980],
        'fieldMarks': ['Orange face and breast', 'Rounded olive-brown back'],
        'candidates': [{'species': 'European Robin', 'scientificName': 'Erithacus rubecula', 'probability': .97}]}, True),
    ('robin-clear', 'Erithacus rubecula', {'liveBird': True, 'quality': 'clear', 'subjectBox': [20, 20, 980, 980],
        'fieldMarks': ['Orange face and breast', 'Rounded olive-brown back'],
        'candidates': [{'species': 'European Robin', 'scientificName': 'Erithacus rubecula', 'probability': .97}]}, False),
    ('carrion-crow', 'Corvus corone', {'liveBird': True, 'quality': 'clear', 'subjectBox': [20, 20, 980, 980],
        'fieldMarks': ['All-black glossy plumage', 'Stout bill with feathered base'],
        'candidates': [{'species': 'Rook', 'scientificName': 'Corvus frugilegus', 'probability': .5},
                       {'species': 'Carrion Crow', 'scientificName': 'Corvus corone', 'probability': .45}]}, True),
    ('empty-scene', None, {'liveBird': False, 'candidates': []}, True),
])
def test_release_proof_passes_through_worker_ledger_adapter_and_route(ledger, monkeypatch, tmp_path,
                                                                      name, species, model_json, with_place):
    proof = load_proof()
    book, _ = ledger
    recognizer = photo_gemini.Recognizer(book, Provider(model_json))
    image = tmp_path / 'fixture.jpg'
    image.write_bytes(jpeg())

    class InProcess:
        def request(self, method, path, body, headers):
            sent = json.loads(body)
            self.result = recognizer.identify(base64.b64decode(sent['image']), sent['owner'], sent['requestId'],
                                              sent['caller'], sent.get('context'))

        def getresponse(self):
            outer = self

            class Response:
                status = 200

                def read(self, _):
                    return json.dumps(outer.result).encode()
            return Response()

        def close(self):
            pass
    tax = photo_id.Taxonomy(ROWS)
    monkeypatch.setattr(photo_id, '_taxonomy_or_none', lambda: tax)
    monkeypatch.setattr(photo_id, '_geo_provider', lambda: GeoProvider() if with_place else None)
    monkeypatch.setattr(photo_id, '_LocalConnection', InProcess)
    form = {'photoOwner': proof.VALIDATION_OWNER, 'photoRequestId': proof.request_identity(image),
            'photoContract': proof.CONTRACT, 'captureSource': 'camera', **proof.PROOF_PLACE}
    with Flask(__name__).test_request_context('/burbz/api/identify/image', method='POST', data=form,
                                              environ_base={'REMOTE_ADDR': '127.0.0.1'}):
        result = photo_id.identify_bird_from_image(str(image))
    status = 200 if result.get('found') is True else 422   # what the live route does
    assert proof.passes_merlin_case(name, species, status, result), result
    assert result['placeUsed'] is with_place
