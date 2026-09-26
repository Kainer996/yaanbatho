"""Merlin-style photo ID v494: place, week, one taxonomy and a ranked choice."""
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
    ('railor4', 'Trichoglossus haematodus', 'Coconut Lorikeet'),
    ('railor5', 'Trichoglossus moluccanus', 'Rainbow Lorikeet'),
    ('categr2', 'Ardea coromanda', 'Eastern Cattle-Egret'),
    ('azwmag2', 'Cyanopica cyanus', 'Azure-winged Magpie'),
    ('azwmag3', 'Cyanopica cooki', 'Iberian Magpie'),
    ('eurmag1', 'Pica pica', 'Eurasian Magpie'),
    ('amecro', 'Corvus brachyrhynchos', 'American Crow'),
    ('redjun', 'Gallus gallus', 'Red Junglefowl'),
    ('rinphe', 'Phasianus colchicus', 'Ring-necked Pheasant'),
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


CLITHEROE.update({'Eurasian Magpie': 0, 'Pica pica': .992, 'Gallus gallus': .0016, 'Phasianus colchicus': .994})
SYDNEY = {'Trichoglossus haematodus': .0013, 'Trichoglossus moluccanus': .99, 'Ardea ibis': 0.0,
          'Ardea coromanda': .7, 'Tyto alba': 0.0}
MADRID = {'Cyanopica cyanus': 0.0, 'Cyanopica cooki': .9, 'Pica pica': .99}
SEATTLE = {'Corvus brachyrhynchos': .97}


def place(taxonomy, table=CLITHEROE, lat=53.9, lon=-2.4, week=36):
    return photo_id.Place(lat, lon, week, [table.get(s, 0.0) for _, s, _ in ROWS], taxonomy)


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


def test_a_named_bird_that_lives_here_is_never_rewritten(taxonomy):
    # Taiga v Tundra Bean Goose, Scopoli's v Cory's: a full name that is
    # plausible here stays, and two rivals are never merged into one.
    raw = worker_reading([('European Herring Gull', 'Larus argentatus', .45),
                          ('American Herring Gull', 'Larus smithsonianus', .40)], other=.15, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    names = [c['scientificName'] for c in result['candidates']]
    assert names == ['Larus argentatus', 'Larus smithsonianus'] and result['found'] is False
    assert result['candidates'][1]['local'] == 'rare' or result['candidates'][1]['local'] == 'unexpected'


def test_a_named_bird_absent_here_gives_way_to_its_sister(taxonomy):
    maine = place(taxonomy, MAINE, 44.0, -69.0)
    raw = worker_reading([('European Herring Gull', 'Larus argentatus', .45),
                          ('American Herring Gull', 'Larus smithsonianus', .40)], other=.15, quality='clear')
    result = decide(raw, maine, taxonomy)
    assert [c['scientificName'] for c in result['candidates']] == ['Larus smithsonianus']


def test_a_place_chosen_daughter_takes_its_own_name(taxonomy):
    raw = worker_reading([('Herring Gull', 'Larus argentatus', .9)], other=.1, quality='clear')
    result = decide(raw, place(taxonomy, MAINE, 44.0, -69.0), taxonomy)
    assert result['candidates'][0]['species'] == 'American Herring Gull'
    assert result['candidates'][0]['scientificName'] == 'Larus smithsonianus'
    jackdaw = decide(worker_reading([('Western Jackdaw', 'Corvus monedula', .9)], other=.1), place(taxonomy), taxonomy)
    assert jackdaw['candidates'][0]['species'] == 'Western Jackdaw'       # a synonym keeps the familiar name


def test_the_english_name_beats_a_stale_binomial(taxonomy):
    # Sydney: "Rainbow Lorikeet, Trichoglossus haematodus" is not the Coconut Lorikeet.
    raw = worker_reading([('Rainbow Lorikeet', 'Trichoglossus haematodus', .85)], other=.15, quality='clear')
    result = decide(raw, place(taxonomy, SYDNEY, -33.9, 151.2), taxonomy)
    assert result['found'] and result['scientificName'] == 'Trichoglossus moluccanus'
    assert result['species'] == 'Rainbow Lorikeet'


def test_split_sisters_come_from_the_shared_code_and_the_place(taxonomy):
    sydney = place(taxonomy, SYDNEY, -33.9, 151.2)
    egret = decide(worker_reading([('Cattle Egret', 'Bubulcus ibis', .9)], other=.1, quality='clear'), sydney, taxonomy)
    assert egret['scientificName'] == 'Ardea coromanda' and egret['candidates'][0]['species'] == 'Eastern Cattle-Egret'
    assert egret['candidates'][0]['modelSpecies'] == 'Cattle Egret'
    magpie = decide(worker_reading([('Azure-winged Magpie', 'Cyanopica cyanus', .9)], other=.1, quality='clear'),
                    place(taxonomy, MADRID, 40.4, -3.7), taxonomy)
    assert magpie['scientificName'] == 'Cyanopica cooki'


def test_merged_species_take_the_parent(taxonomy):
    crow = decide(worker_reading([('Northwestern Crow', 'Corvus caurinus', .9)], other=.1, quality='clear'),
                  place(taxonomy, SEATTLE, 47.6, -122.3), taxonomy)
    assert crow['found'] and crow['scientificName'] == 'Corvus brachyrhynchos' and crow['species'] == 'American Crow'
    assert crow['candidates'][0]['modelSpecies'] == 'Northwestern Crow'


def test_kept_and_domestic_birds_are_not_punished_by_range(taxonomy):
    raw = worker_reading([('Domestic Chicken', 'Gallus gallus', .9), ('Ring-necked Pheasant', 'Phasianus colchicus', .05)],
                         other=.05, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['candidates'][0]['scientificName'] == 'Gallus gallus'
    assert result['candidates'][0]['local'] == 'unknown' and result['found'] is False   # the player confirms


def test_the_range_only_lowers_scores_and_never_inflates_a_survivor(taxonomy):
    # The reading Yaan actually got on 25 September: no raven in it at all.
    raw = worker_reading([('Anhinga', 'Anhinga anhinga', .5), ('Great Blue Heron', 'Ardea herodias', .3),
                          ('Grey Heron', 'Ardea cinerea', .15)], other=.05)
    result = decide(raw, place(taxonomy), taxonomy)
    top = result['candidates'][0]
    assert top['scientificName'] == 'Ardea cinerea' and top['score'] == .15 and result['found'] is False
    for c in result['candidates']:
        assert c['score'] <= next(x[2] for x in [('Anhinga', 'Anhinga anhinga', .5), ('Great Blue Heron', 'Ardea herodias', .3),
                                                  ('Grey Heron', 'Ardea cinerea', .15)] if x[1] == c['scientificName'])


def test_a_bird_the_model_rates_stays_pickable_far_from_home(taxonomy):
    raw = worker_reading([('Rainbow Lorikeet', 'Trichoglossus moluccanus', .4), ('Common Raven', 'Corvus corax', .45),
                          ('Eurasian Jackdaw', 'Coloeus monedula', .1)], other=.05)
    names = [c['scientificName'] for c in decide(raw, place(taxonomy), taxonomy)['candidates']]
    assert 'Trichoglossus moluccanus' in names                # 0.4 x floor, still offered


def test_a_reading_made_without_the_local_list_is_not_reused_with_one(ledger):
    book, _ = ledger
    data = jpeg()
    provider = Provider(RAVEN_JSON)
    recognizer = photo_gemini.Recognizer(book, provider)
    recognizer.identify(data, 'owner_012345678901', 'request_aaaaaaaaaaaa', 'caller')          # cold GPS
    context = place(photo_id.Taxonomy(ROWS)).context()
    recognizer.identify(data, 'owner_012345678901', 'request_bbbbbbbbbbbb', 'caller', context)
    assert len([a for a, _ in provider.calls if a == 'generateContent']) == 2
    recognizer.identify(data, 'owner_012345678901', 'request_cccccccccccc', 'caller', context)
    assert len([a for a, _ in provider.calls if a == 'generateContent']) == 2        # now reused


def test_two_species_sharing_an_old_binomial_both_survive():
    raw = {'liveBird': True, 'candidates': [
        {'species': 'Carrion Crow', 'scientificName': 'Corvus corone', 'probability': .5},
        {'species': 'Hooded Crow', 'scientificName': 'Corvus corone cornix', 'probability': .4}]}
    worker = photo_gemini.reading(raw, io.BytesIO(jpeg()))
    assert [c['species'] for c in worker['candidates']] == ['Carrion Crow', 'Hooded Crow']
    tax = photo_id.Taxonomy(ROWS + [('hoocro1', 'Corvus cornix', 'Hooded Crow')])
    assert tax.match('Corvus corone', 'Hooded Crow')[1] == 'Corvus cornix'


def test_lumped_species_keep_their_name_and_borrow_the_range(taxonomy):
    position, scientific, _, split = taxonomy.match('Acanthis cabaret', 'Lesser Redpoll', place(taxonomy))
    assert split is False
    assert scientific == 'Acanthis cabaret' and taxonomy.rows[position][0] == 'Acanthis flammea'
    raw = worker_reading([('Lesser Redpoll', 'Acanthis cabaret', .9)], other=.1, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['scientificName'] == 'Acanthis cabaret' and result['candidates'][0]['local'] == 'likely'


def test_uk_stonechat_under_its_old_name_is_found_not_floored(taxonomy):
    raw = worker_reading([('Stonechat', 'Saxicola torquatus', .9)], other=.1, quality='clear')
    result = decide(raw, place(taxonomy), taxonomy)
    assert result['found'] and result['scientificName'] == 'Saxicola rubicola'


def test_numeric_label_birds_sharing_a_bird_genus_count_as_birds():
    rows = ROWS + [('465888', 'Ptyonoprogne obsoleta', 'Pale Crag-Martin'), ('crgmar1', 'Ptyonoprogne rupestris', 'Eurasian Crag-Martin'),
                   ('99999', 'Vulpes vulpes', 'Red Fox')]
    tax = photo_id.Taxonomy(rows)
    assert tax.match('Ptyonoprogne obsoleta', 'Pale Crag-Martin')[1] == 'Ptyonoprogne obsoleta'
    assert tax.match('Vulpes vulpes', 'Red Fox') is None


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


def test_gemini_list_reveals_only_the_region_and_season_it_is_sent_with(taxonomy):
    fine = [CLITHEROE.get(s, 0.0) for _, s, _ in ROWS]
    coarse = [0.0 if s == 'Corvus corax' else p for (_, s, _), p in zip(ROWS, fine)]
    where = photo_id.Place(53.9, -2.4, 36, fine, taxonomy, coarse)
    names = [s for _, s in where.context()['checklist']]
    assert 'Corvus corax' not in names                          # the list is the coarse run
    assert where.occurrence(0) == CLITHEROE['Corvus corax']     # the ranking is the fine run
    assert photo_id._season_week(34) == photo_id._season_week(35) == 34   # both "mid September"
    assert [photo_id._season_week(w) for w in (33, 36, 1, 48)] == [33, 36, 1, 48]


@pytest.mark.parametrize('week,season', [(1, 'early January'), (2, 'mid January'), (4, 'late January'),
                                         (36, 'late September'), (48, 'late December')])
def test_birdnet_weeks_read_as_plain_seasons(taxonomy, week, season):
    assert place(taxonomy, week=week).context()['season'] == season


# ---------------------------------------------------------------- adapter I/O

FORM = {'photoOwner': 'owner_01234567890', 'photoRequestId': 'request_01234567890', 'photoContract': 'merlin-v494'}


class GeoProvider:
    def __init__(self):
        self.asked = []

    def _birdnet_week(self, _):
        return 36

    def _geo_probabilities(self, lat, lon, week):
        self.asked.append((lat, lon, week))
        return [CLITHEROE.get(s, 0.0) for _, s, _ in ROWS]


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
    # 0.1 degree and the exact week weigh the ranking here; Gemini's list comes
    # from the half-degree cell and the season's week it is told.
    assert geo.asked == [(53.9, -2.4, 36), (54.0, -2.5, 36)]
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
                             {'species': 'Common Raven', 'scientificName': 'Corvus corax', 'probability': .05},
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
    # Gemini keeps its own everyday names; forcing the list's names turned
    # Australian Wood Duck into "Maned Duck", a name Burbz does not know.
    assert 'use exactly its listed' not in prompt
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
    assert result['policy'] == 'photo-gemini-v494' and len(provider.calls) == 2


@pytest.mark.parametrize('raw,reason', [
    ({'liveBird': False, 'candidates': [{'species': 'Crow', 'scientificName': 'Corvus corone', 'probability': .9}]}, 'no-bird'),
    ({'liveBird': True, 'candidates': []}, 'no-species'),
    ({'liveBird': True, 'candidates': [{'species': 'X', 'scientificName': 'bad', 'probability': .9}]}, 'no-species'),
])
def test_worker_readings_without_a_species_name_nothing(raw, reason):
    result = photo_gemini.reading(raw, io.BytesIO(jpeg()))
    assert result['found'] is False and result['reason'] == reason and 'candidates' not in result


@pytest.mark.parametrize('raw', [[], 'text', [{'liveBird': True}, {'liveBird': True}], None])
def test_malformed_model_json_is_a_retryable_service_fault_not_a_verdict(raw):
    with pytest.raises(photo_gemini.ProviderError):
        photo_gemini.reading(raw, io.BytesIO(jpeg()))


def test_a_one_object_list_is_unwrapped():
    result = photo_gemini.reading([RAVEN_JSON], io.BytesIO(jpeg()))
    assert result['found'] and result['candidates'][0]['scientificName'] == 'Corvus corax'


@pytest.mark.parametrize('probabilities', [(.7, .2, .15), (.8, .15, .15), (.34, .33, .33, .05), (.9, .6)])
def test_stored_probabilities_never_add_up_to_more_than_one(probabilities):
    names = ['Corvus corone', 'Corvus frugilegus', 'Corvus corax', 'Coloeus monedula']
    raw = {'liveBird': True, 'candidates': [{'species': 'x', 'scientificName': n, 'probability': p}
                                           for n, p in zip(names, probabilities)]}
    worker = photo_gemini.reading(raw, io.BytesIO(jpeg()))
    assert sum(c['probability'] for c in worker['candidates']) <= 1
    worker.update(retryable=False, receiptId='e' * 64)
    clean, problem = photo_id._validate_reading(json.loads(json.dumps(worker)))
    assert problem is None and clean['candidates']


def test_adapter_accepts_a_tiny_rounding_overshoot_already_in_the_ledger():
    raw = worker_reading([('Carrion Crow', 'Corvus corone', .6667), ('Rook', 'Corvus frugilegus', .1905),
                          ('Common Raven', 'Corvus corax', .1429)])
    clean, problem = photo_id._validate_reading(raw)
    assert problem is None and abs(sum(c['probability'] for c in clean['candidates']) - 1) < 1e-9
    clean, problem = photo_id._validate_reading(worker_reading([('A', 'Corvus corone', .7), ('B', 'Corvus corax', .4)]))
    assert clean is None and problem['reason'] == 'invalid-worker-result'


@pytest.mark.parametrize('value,expected', [('First-winter', 'first winter'), ('1st winter', 'first winter'),
                                            ('non-breeding adult', 'non breeding adult'), ('unknown', None),
                                            ('<b>x</b>', None), (7, None)])
def test_plumage_becomes_plain_words(value, expected):
    assert photo_gemini._plumage(value) == expected


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
    spec = importlib.util.spec_from_file_location('photo_proof_v494', ROOT.parents[1] / 'scripts/verify-photo-id.py')
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
