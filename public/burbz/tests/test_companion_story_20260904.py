"""Personal history uses recorded facts and preserves ordinary companions."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')


def function(name):
    start = HTML.index('function ' + name + '(')
    return HTML[start:HTML.index('\nfunction ', start + 10)]


def render(bird, record=None, owned=True):
    script = """
const bond=require('./bird_bond_core.js');
const bird=%s,record=%s;
const gameState={flock:%s?[bird]:[]};
const getDiscoveredRecordForSpecies=()=>record;
const birdBondCore=()=>bond;
const ensureBirdBond=b=>bond.sanitizeBond(b.bond);
const birdDisplayName=b=>b.customName||b.commonName;
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
%s
console.log(JSON.stringify({html:birdPersonalStoryHTML(bird),bird}));
""" % (json.dumps(bird), json.dumps(record), json.dumps(owned), function('birdPersonalStoryHTML'))
    result = subprocess.run(['node', '-e', script], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)


def test_ordinary_birds_keep_their_own_identity_and_recorded_history():
    for species in ['European Robin', 'Wood Pigeon', 'House Sparrow']:
        bird = {'id':'bird-1', 'commonName':species, 'customName':'Bramble', 'recruitedAt':'2026-08-03T12:00:00Z', 'bond':{'level':3,'xp':14}}
        out = render(bird, {'discoveredAt':'2026-08-01T12:00:00Z','sightingCount':4})
        assert 'Bramble' in out['html'] and 'Close Friend' in out['html']
        assert 'First discovered' in out['html'] and '4 sightings recorded' in out['html']
        assert 'Joined your flock' in out['html'] and 'Share a meal' in out['html']
        assert out['bird'] == bird


def test_old_companions_do_not_acquire_invented_dates_or_encounters():
    out = render({'id':'old-bird','commonName':'Robin','captureDate':'2020-01-01','recruitedAt':'broken'})
    assert 'New Friend' in out['html']
    assert 'First discovered' not in out['html'] and 'Joined your flock' not in out['html']
    assert 'Invalid Date' not in out['html'] and '2020' not in out['html']


def test_discovery_preview_cannot_claim_a_companion_bond():
    out = render({'id':'preview:Robin','commonName':'Robin','previewOnly':True}, {'discoveredAt':'2026-08-01','sightingCount':1}, owned=False)
    assert 'Your discovery' in out['html']
    assert 'Share a meal' not in out['html'] and 'Your story together' not in out['html']
    assert render({'id':'preview:Robin','commonName':'Robin','previewOnly':True}, owned=False)['html'] == ''


def test_names_and_ids_cannot_inject_markup_or_event_code():
    out = render({'id':"bird'\" onclick=alert(1)", 'commonName':'Robin','customName':'<svg onload=alert(1)>'})
    assert '<svg' not in out['html'] and '&lt;svg' in out['html']
    assert 'data-bird-id="bird&#39;&quot; onclick=alert(1)"' in out['html']
    assert 'openFeedSheet(this.dataset.birdId)' in out['html']
