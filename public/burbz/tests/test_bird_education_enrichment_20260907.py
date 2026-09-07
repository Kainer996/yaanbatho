"""Coverage, source attribution and taxonomic boundary regression checks."""
import json
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'data/bird-education-enrichment-v366.json').read_text())
PRIMARY = json.loads((ROOT / 'data/bird-facts-v366.json').read_text())['species']
GAPS = json.loads((Path(__file__).parent / 'fixtures/bird-education-gaps-20260907.json').read_text())


def test_every_original_missing_entry_and_post_filter_swift_has_an_account():
    assert len(GAPS['missingNames']) == 56
    assert not set(GAPS['missingNames']) - DATA.keys()
    assert 'Fork-tailed Swift' in DATA


def test_imports_do_not_claim_primary_verification_or_replace_priority_names():
    assert len(DATA) == 372
    assert not {r['name'] for r in PRIMARY} & DATA.keys()
    assert all(r.get('encyclopediaImport') is True and not r.get('verifiedPrimary') for r in DATA.values())


def test_accounts_are_bounded_factual_text_with_reproducible_attribution():
    for name, row in DATA.items():
        assert row['title'] == name
        assert len(' '.join(row.get(k,'') for k in ('summary','identification','habitat','voice','behaviour')).split()) >= 40, name
        assert 20 <= len(row['wikipediaExtract'].split()), name
        if name not in GAPS['shortAccountNames']:
            assert len(row['wikipediaExtract'].split()) >= 150, name
        assert len(row['wikipediaExtract']) <= 5500, name
        assert '<script' not in row['summary'].lower()
        assert 'game stats' not in row['summary'].lower()
        assert 'burbz' not in row['wikipediaExtract'].lower()
        assert 'may also refer to' not in row['summary'].lower(), name
        attribution = row['wikipediaAttribution']
        assert attribution['pageid'] > 0 and attribution['revisionId'] > 0
        assert attribution['authors'] == 'Wikipedia contributors'
        assert attribution['license'] == 'CC BY-SA 4.0'
        assert attribution['changes']
        assert attribution['revisionUrl'].endswith(str(attribution['revisionId']))
        assert row['sourceTitle'] == attribution['pageTitle']
        assert any(s['url'] == attribution['source'] for s in row['sources'])
        assert all(urlparse(s['url']).scheme == 'https' for s in row['sources'])


def test_form_and_split_accounts_are_explicit_and_do_not_alias_other_species():
    assert DATA['Lesser Redpoll']['scientificName'] == 'Acanthis flammea cabaret'
    assert 'combined species' in DATA['Lesser Redpoll']['summary']
    assert 'combined species' in DATA['Arctic Redpoll']['summary']
    assert DATA["Stejneger's Stonechat"]['scientificName'] == 'Saxicola maurus stejnegeri'
    assert 'more broadly' in DATA["Stejneger's Stonechat"]['summary']
    assert 'extinct' in DATA['Island Thrush']['summary']
    assert 'Western Swamphen' in DATA['Purple Swamphen']['summary']
    assert 'feral form' in DATA['Feral Pigeon']['summary']
    assert DATA['Eclectus Parrot']['scientificName'] == 'Eclectus polychloros'
    assert not any('aliases' in row for row in DATA.values())


def test_bad_group_and_disambiguation_imports_are_replaced_by_species_subjects():
    expected = {'Capercaillie':'Western capercaillie', 'Pied Flycatcher':'European pied flycatcher', 'Curlew':'Eurasian curlew', 'Ruff':'Ruff (bird)', 'Woodcock':'Eurasian woodcock', 'Wild Turkey':'Wild turkey', 'Northern Goshawk':'Eurasian goshawk'}
    for name, subject in expected.items():
        assert DATA[name]['sourceTitle'] == subject


def test_short_legacy_accounts_now_have_substantial_source_information():
    assert len(GAPS["shortAccountNames"]) == 231
    assert not set(GAPS["shortAccountNames"]) - DATA.keys()
    for name in GAPS["shortAccountNames"]:
        row = DATA[name]
        assert len(' '.join(row.get(k,'') for k in ('summary','identification','habitat','voice','behaviour')).split()) >= 40, name
        assert len(row['wikipediaExtract'].split()) >= 20, name


def test_tiny_encyclopedia_stubs_have_independently_sourced_field_notes():
    for name in ("Mountain Thornbill", "Sandstone Shrike-thrush", "Silver-crowned Friarbird", "Slaty-backed Thornbill", "Spotted Quail-thrush", "Western Shrike-tit"):
        row = DATA[name]
        provenance = row["fieldNotesProvenance"]
        assert provenance["fields"]
        assert all(row[field].strip() for field in provenance["fields"])
        assert any(s["url"] == provenance["source"] for s in row["sources"])
