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
    assert result['attemptCostNanoGBP']==1_718_750
    assert l.status()['reservedAndChargedNanoGBP']==1_718_750

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

def test_two_verified_views_are_bounded_and_both_charged(ledger):
    l,_=ledger
    raw=dict(found=True,species='European Robin',scientificName='Erithacus rubecula',confidence=.98,
      alternatives=[{'species':'Stonechat','confidence':.1}],evidence=dict(liveBird=True,quality='clear',diagnosticDetailsVisible=True,
      diagnosticFeatures=['Orange face and breast','Distinctive rounded brown wings'],subjectBox=[20,20,980,980]))
    p=Provider(raw);result=Recognizer(l,p).identify(jpeg(),'owner_01234567890','request_01234567890','caller')
    assert result['found'] and result['verified']
    paid=[b for a,b in p.calls if a=='generateContent'];assert len(paid)==2
    assert all(b['generationConfig']['maxOutputTokens']==4096 and b['generationConfig']['thinkingConfig']['thinkingBudget']==1024 for b in paid)
    assert result['attemptCostNanoGBP']==2*cost_for_usage(usage())
