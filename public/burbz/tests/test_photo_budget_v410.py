import concurrent.futures
import importlib.util
import io
import json
from pathlib import Path
import sys
import threading
from datetime import datetime
from zoneinfo import ZoneInfo
import pytest
from PIL import Image

ROOT=Path(__file__).parents[1]
sys.path.insert(0,str(ROOT))
from photo_budget import Ledger, BudgetError, MONTH_LIMIT, ATTEMPT_LIMIT, CALL_LIMIT, cost_for_usage, next_month, month_at
from photo_gemini import Recognizer

@pytest.fixture
def ledger(tmp_path):
    now=[datetime(2026,9,14,12,tzinfo=ZoneInfo('Europe/London')).timestamp()]
    path=tmp_path/'budget.db';Ledger.initialise(path,now[0])
    return Ledger(path,lambda:now[0]),now

def acquire(l,n='a',owner=None,caller=None):
    return l.acquire(owner or 'owner'+n,n,'digest'+n,caller or 'caller'+n)[0]

def usage(prompt=2000,output=200):
    return dict(promptTokenCount=prompt,candidatesTokenCount=output,totalTokenCount=prompt+output)

def test_reserves_whole_attempt_before_work(ledger):
    l,_=ledger;job=acquire(l)
    assert l.status()['reservedAndChargedNanoGBP']==ATTEMPT_LIMIT
    l.begin_call(job,0);l.finish_call(job,0,usage());result=l.finish(job,{'found':False})
    assert result['attemptCostNanoGBP']==7_031_250
    assert l.status()['reservedAndChargedNanoGBP']==7_031_250

def test_missing_ledger_never_recreates(tmp_path):
    with pytest.raises(BudgetError):Ledger(tmp_path/'gone.db')
    assert not (tmp_path/'gone.db').exists()

def test_init_preserves_existing_charges(ledger):
    l,_=ledger;acquire(l);Ledger.initialise(l.path)
    assert l.status()['reservedAndChargedNanoGBP']==ATTEMPT_LIMIT

def test_restart_and_unknown_call_keep_maximum(ledger):
    l,now=ledger;job=acquire(l);l.begin_call(job,0)
    l2=Ledger(l.path,lambda:now[0])
    assert l2.status()['reservedAndChargedNanoGBP']==ATTEMPT_LIMIT
    assert not l2.finish_call(job,0,{})
    l2.finish(job,{'found':False})
    assert l2.status()['reservedAndChargedNanoGBP']==CALL_LIMIT

def test_unknown_worker_crash_never_refunds(ledger):
    l,now=ledger;acquire(l);now[0]+=121
    with pytest.raises(BudgetError,match='request-interrupted'):acquire(l)
    assert l.status()['reservedAndChargedNanoGBP']==ATTEMPT_LIMIT

def test_replay_and_owner_boundary(ledger):
    l,_=ledger;job=acquire(l);l.finish(job,{'found':True,'species':'Robin'})
    assert l.acquire('ownera','a','digesta','callera')[1]['species']=='Robin'
    assert l.acquire('ownera','different-id','digesta','callera')[1]['species']=='Robin'
    assert l.acquire('another-owner','a','digesta','another-caller')[1] is None
    with pytest.raises(BudgetError,match='request-conflict'):l.acquire('ownera','a','other-image','callera')

def test_paid_stages_cannot_repeat_or_exceed_two(ledger):
    l,_=ledger;job=acquire(l);l.begin_call(job,0)
    with pytest.raises(Exception):l.begin_call(job,0)
    with pytest.raises(BudgetError):l.begin_call(job,2)

def test_global_cap_shared_atomic_near_limit(ledger):
    l,now=ledger
    with l.connection() as c:
        c.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?)',('spent','owner','d','c',month_at(now[0]),now[0]-1000,'done',MONTH_LIMIT-ATTEMPT_LIMIT,'{}'))
    barrier=threading.Barrier(12)
    def attempt(n):
        barrier.wait()
        try:return acquire(Ledger(l.path,lambda:now[0]),str(n))
        except BudgetError:return None
    with concurrent.futures.ThreadPoolExecutor(12) as pool:answers=list(pool.map(attempt,range(12)))
    assert sum(a is not None for a in answers)==1
    assert l.status()['reservedAndChargedNanoGBP']==MONTH_LIMIT

def test_rate_limits_survive_instance_change(ledger):
    l,now=ledger
    for n in range(3):l.finish(acquire(l,str(n),caller='same'),{'found':False})
    with pytest.raises(BudgetError,match='photo-rate-limit'):acquire(Ledger(l.path,lambda:now[0]),'4',caller='same')

@pytest.mark.parametrize('stamp,expected',[
 ('2026-03-31T23:30:00+00:00','2026-04'),('2026-10-31T23:30:00+00:00','2026-10'),
 ('2026-12-31T23:59:00+00:00','2026-12')])
def test_month_uses_london_dst(stamp,expected):
    now=datetime.fromisoformat(stamp).timestamp()
    assert month_at(now)==expected
    assert datetime.fromtimestamp(next_month(now),ZoneInfo('Europe/London')).day==1

def test_rollover_never_resends_against_old_reservation(ledger):
    l,now=ledger;job=acquire(l);l.begin_call(job,0)
    oldmonth=l.status()['month'];now[0]=next_month(now[0])+1
    with pytest.raises(BudgetError,match='month-changed'):l.begin_call(job,1)
    l.finish_call(job,0,usage());l.finish(job,{'found':False})
    assert l.status()['reservedAndChargedNanoGBP']==0
    with l.connection() as c:assert c.execute('SELECT held FROM jobs WHERE month=?',(oldmonth,)).fetchone()[0]==cost_for_usage(usage())

def test_expired_prices_block_without_spending(ledger):
    l,now=ledger;now[0]+=33*86400
    with pytest.raises(BudgetError,match='pricing-review-required'):acquire(l)
    assert l.status()['reservedAndChargedNanoGBP']==0

@pytest.mark.parametrize('u',[{},usage(-1),usage(40000),usage(1,9999),{'promptTokenCount':True,'totalTokenCount':1},
 {'promptTokenCount':100,'totalTokenCount':99},{'promptTokenCount':1,'totalTokenCount':2,'thoughtsTokenCount':20}])
def test_invalid_or_excess_usage_cannot_release_reservation(u):
    with pytest.raises(ValueError):cost_for_usage(u)

def jpeg():
    out=io.BytesIO();Image.effect_noise((300,300),100).convert('RGB').save(out,format='JPEG');return out.getvalue()

class Provider:
    def __init__(self, response=None,fail=False):self.calls=[];self.response=response or {'found':False};self.fail=fail
    def request(self,action,body,timeout):
        self.calls.append((action,body))
        if action=='countTokens':return {'totalTokens':2000}
        if self.fail:raise OSError('unknown transport outcome')
        return {'usageMetadata':usage(), 'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':json.dumps(self.response)}]}}]}

def test_worker_does_not_call_provider_when_budget_unavailable(ledger):
    l,now=ledger
    with l.connection() as c:c.execute("UPDATE meta SET value='maintenance' WHERE key='disabled'")
    p=Provider();r=Recognizer(l,p).identify(jpeg(),'owner_01234567890','request_01234567890','caller')
    assert not r['found'] and not p.calls

def test_negative_uses_one_paid_request_and_replay_uses_none(ledger):
    l,_=ledger;p=Provider();r=Recognizer(l,p);data=jpeg()
    first=r.identify(data,'owner_01234567890','request_01234567890','caller')
    assert not first['found'] and not first['retryable']
    assert [c[0] for c in p.calls]==['countTokens','generateContent']
    assert r.identify(data,'owner_01234567890','request_01234567890','caller')==first
    assert len(p.calls)==2

def test_transport_failure_keeps_charge_and_no_provider_retry(ledger):
    l,_=ledger;p=Provider(fail=True)
    r=Recognizer(l,p).identify(jpeg(),'owner_01234567890','request_01234567890','caller')
    assert not r['found'] and r['retryable']
    assert r['attemptCostNanoGBP']==CALL_LIMIT
    assert len(p.calls)==2

def test_one_ranked_reading_is_bounded_and_charged_once(ledger):
    l,_=ledger
    raw=dict(liveBird=True,quality='clear',subjectBox=[20,20,980,980],
      fieldMarks=['Orange face and breast','Distinctive rounded brown wings'],
      candidates=[{'species':'European Robin','scientificName':'Erithacus rubecula','probability':.98},
                  {'species':'Stonechat','scientificName':'Saxicola rubicola','probability':.01}],otherProbability=.01)
    p=Provider(raw);result=Recognizer(l,p).identify(jpeg(),'owner_01234567890','request_01234567890','caller')
    assert result['found'] and not result['verified'] and result['candidates'][0]['scientificName']=='Erithacus rubecula'
    paid=[b for a,b in p.calls if a=='generateContent'];assert len(paid)==1
    assert all(b['generationConfig']['maxOutputTokens']==8192 and b['generationConfig']['thinkingConfig']['thinkingLevel'] == 'medium' for b in paid)
    assert result['attemptCostNanoGBP']==cost_for_usage(usage())

def test_unknown_usage_trips_global_breaker_and_blocks_already_reserved_stage(ledger):
    l,_=ledger
    first=acquire(l,'first');other=acquire(l,'other')
    l.begin_call(first,0)
    assert not l.finish_call(first,0,{})
    assert l.status()['disabled'] is True
    with pytest.raises(BudgetError,match='pricing-review-required'):l.begin_call(other,0)
    with pytest.raises(BudgetError,match='pricing-review-required'):acquire(l,'third')
    result=l.finish(first,{'found':False})
    assert result['attemptCostNanoGBP']==CALL_LIMIT

def test_measurable_provider_overrun_is_retained_above_reserved_ceiling(ledger):
    l,_=ledger;job=acquire(l);l.begin_call(job,0)
    excess=usage(50000,6000)
    assert not l.finish_call(job,0,excess)
    result=l.finish(job,{'found':False})
    assert result['attemptCostNanoGBP']==cost_for_usage(excess,enforce_bounds=False)>CALL_LIMIT
    assert l.status()['disabled'] is True
    assert l.status()['reservedAndChargedNanoGBP']==result['attemptCostNanoGBP']

def test_thinking_and_unclassified_output_are_charged_at_output_price():
    with_thoughts={'promptTokenCount':2000,'candidatesTokenCount':200,'thoughtsTokenCount':900,'totalTokenCount':3200}
    assert cost_for_usage(with_thoughts)==cost_for_usage(usage(2000,1200))

def test_cached_accepted_receipt_survives_global_pause(ledger):
    l,_=ledger;job=acquire(l);result=l.finish(job,{'found':True,'species':'Robin'})
    with l.connection() as c:c.execute("UPDATE meta SET value='paused' WHERE key='disabled'")
    replay=l.acquire('ownera','different-request','digesta','callera')[1]
    assert replay==result and replay['receiptId']==job

@pytest.mark.parametrize('count',[0,32769,True,None])
def test_bad_token_count_never_sends_paid_request(ledger,count):
    class InvalidCounter(Provider):
        def request(self,action,body,timeout):
            self.calls.append(action)
            if action=='countTokens':return {'totalTokens':count}
            pytest.fail('GenerateContent must remain unsent')
    l,_=ledger;p=InvalidCounter()
    result=Recognizer(l,p).identify(jpeg(),'owner_01234567890','request_01234567890','caller')
    assert result['found'] is False and result['attemptCostNanoGBP']==0
    assert p.calls==['countTokens']

def test_near_rollover_never_sends_even_unbilled_image(ledger):
    l,now=ledger;reset=next_month(now[0]);now[0]=reset-44
    p=Provider()
    result=Recognizer(l,p).identify(jpeg(),'owner_01234567890','request_01234567890','caller')
    assert result['reason']=='month-changed' and result['retryAt']==reset+1
    assert not p.calls and l.status()['reservedAndChargedNanoGBP']==0
    now[0]=reset+1
    assert acquire(l)

def test_already_reserved_attempt_cannot_connect_near_rollover(ledger):
    l,now=ledger;reset=next_month(now[0]);now[0]=reset-60
    job=acquire(l);l.begin_call(job,0);l.finish_call(job,0,usage())
    now[0]=reset-44
    with pytest.raises(BudgetError,match='month-changed') as error:l.begin_call(job,1)
    assert error.value.retry_at==reset+1
    result=l.finish(job,{'found':False})
    assert result['attemptCostNanoGBP']==cost_for_usage(usage())

def test_ledger_persists_no_photo_bytes_or_base64(ledger):
    import base64
    l,_=ledger;data=jpeg()
    Recognizer(l,Provider()).identify(data,'owner_01234567890','request_01234567890','caller')
    with l.connection() as c:
        persisted='\n'.join(c.iterdump())
        columns={row['name'] for table in ('jobs','calls','meta') for row in c.execute('PRAGMA table_info('+table+')')}
    assert not {'image','photo','blob','base64'} & columns
    assert base64.b64encode(data).decode() not in persisted
    assert data[:100] not in l.path.read_bytes()


def test_new_policy_does_not_replay_previous_model_result(ledger):
    import hashlib
    l,_=ledger;data=jpeg()
    job,_=l.acquire('owner_01234567890','old_request_012345',hashlib.sha256(data).hexdigest(),'caller')
    l.finish(job,{'found':True,'species':'Wrong cached species','policy':'photo-gemini-v410'})
    p=Provider();r=Recognizer(l,p).identify(data,'owner_01234567890','new_request_012345','caller')
    assert not r['found'] and len(p.calls)==2 and r['policy']=='photo-gemini-v487'
