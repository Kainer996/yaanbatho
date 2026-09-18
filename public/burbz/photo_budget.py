# Gemini photo recognition. Gemini 3.8 Flash Standard full rates $1.50/$7.50 per million (conservative versus current $0.75/$3.75 promotion). https://ai.google.dev/gemini-api/docs/pricing checked 2026-09-18. Existing £5 ledger/cap unchanged.
"""Persistent photo-only spending reservations. No network, keys or photo storage.

Amounts are integer nano-pounds. GBP charging deliberately overestimates the
published USD tariff: GBP 1.25/USD, plus another 25% for billing/tax uncertainty.
This is a ceiling assumption, not a live currency conversion or a Google invoice.
A dated price review must remain valid; unknown accounting always fails closed.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

MONTH_LIMIT = 5_000_000_000
INPUT_LIMIT = 32768
OUTPUT_LIMIT = 8192  # Includes any thinking tokens; also reserved separately below.
# maxOutputTokens includes thoughts; reserve an extra 1024-token margin.
# Any over-bound or missing usage fails closed and retains its reservation.
BILLED_OUTPUT_LIMIT = OUTPUT_LIMIT + 1024
CALL_LIMIT = ((INPUT_LIMIT * 1500 + BILLED_OUTPUT_LIMIT * 7500) * 25 + 15) // 16
ATTEMPT_LIMIT = 2 * CALL_LIMIT
LONDON = ZoneInfo('Europe/London')

class BudgetError(Exception):
    def __init__(self, reason, retry_at=0):
        self.reason, self.retry_at = reason, retry_at
        super().__init__(reason)

def month_at(now):
    d = datetime.fromtimestamp(now, LONDON)
    return d.strftime('%Y-%m')

def next_month(now):
    d = datetime.fromtimestamp(now, LONDON)
    y, m = (d.year+1, 1) if d.month == 12 else (d.year, d.month+1)
    return datetime(y, m, 1, tzinfo=LONDON).timestamp()

def cost_for_usage(usage, enforce_bounds=True):
    if not isinstance(usage, dict):
        raise ValueError('Missing usage')
    def number(key, default=None):
        value = usage.get(key, default)
        if type(value) is not int or value < 0:
            raise ValueError('Invalid usage')
        return value
    prompt = number('promptTokenCount')
    candidates = number('candidatesTokenCount', 0)
    thoughts = number('thoughtsTokenCount', 0)
    total = number('totalTokenCount')
    if total < prompt or total < prompt + candidates + thoughts:
        raise ValueError('Incomplete usage')
    output = max(total-prompt, candidates+thoughts)
    if enforce_bounds and (prompt > INPUT_LIMIT or output > BILLED_OUTPUT_LIMIT):
        raise ValueError('Usage exceeded reservation')
    return ((prompt*1500 + output*7500)*25 + 15)//16

class Ledger:
    def __init__(self, filename, clock=time.time):
        self.path, self.clock = Path(filename), clock
        if not self.path.is_file():
            raise BudgetError('accounting-unavailable')

    @staticmethod
    def initialise(filename, now=None):
        """Explicit installation only. Existing ledger is never reset or replaced."""
        path = Path(filename)
        if path.exists():
            Ledger(path).status()
            return
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
        c = sqlite3.connect(path)
        try:
            c.executescript('''
              PRAGMA journal_mode=WAL;
              CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
              CREATE TABLE jobs(id TEXT PRIMARY KEY,owner TEXT NOT NULL,digest TEXT NOT NULL,
                caller TEXT NOT NULL,month TEXT NOT NULL,started REAL NOT NULL,
                state TEXT NOT NULL,held INTEGER NOT NULL,result TEXT);
              CREATE INDEX jobs_month ON jobs(month);
              CREATE INDEX jobs_rate ON jobs(caller,started);
              CREATE INDEX jobs_owner ON jobs(owner,started);
              CREATE INDEX jobs_image ON jobs(owner,digest,state);
              CREATE TABLE calls(job TEXT NOT NULL,stage INTEGER NOT NULL,cost INTEGER NOT NULL,
                usage TEXT,PRIMARY KEY(job,stage));
            ''')
            started = time.time() if now is None else now
            values = [('schema','1'),('salt',secrets.token_hex(32)),
                      ('pricing_expires',str(min(started+32*86400, datetime(2026,10,16,tzinfo=timezone.utc).timestamp()))),('disabled','')]
            c.executemany('INSERT INTO meta VALUES(?,?)',values)
            c.commit()
        finally:
            c.close()

    def connection(self):
        # mode=rw prevents SQLite silently creating an empty replacement ledger.
        c = sqlite3.connect(self.path.resolve().as_uri()+'?mode=rw', uri=True, timeout=5)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA busy_timeout=5000')
        c.execute('PRAGMA synchronous=FULL')
        return c

    def status(self):
        now = self.clock()
        with self.connection() as c:
            meta = dict(c.execute('SELECT key,value FROM meta').fetchall())
            if meta.get('schema') != '1':
                raise BudgetError('accounting-unavailable')
            spent = c.execute('SELECT COALESCE(SUM(held),0) FROM jobs WHERE month=?',(month_at(now),)).fetchone()[0]
            return {'month':month_at(now), 'limitNanoGBP':MONTH_LIMIT, 'reservedAndChargedNanoGBP':spent,
                    'availableNanoGBP':max(0,MONTH_LIMIT-spent),'resetAt':next_month(now),
                    'pricingValid':now < float(meta['pricing_expires']), 'disabled':bool(meta['disabled'])}

    def acquire(self, owner, request_id, digest, caller):
        now=self.clock()
        with self.connection() as c:
            c.execute('BEGIN IMMEDIATE')
            meta=dict(c.execute('SELECT key,value FROM meta').fetchall())
            if meta.get('schema') != '1': raise BudgetError('accounting-unavailable')
            def key(value):
                return hmac.new(bytes.fromhex(meta['salt']),value.encode(),hashlib.sha256).hexdigest()
            who, client = key('owner:'+owner), key('caller:'+caller)
            job = key('job:'+owner+':'+request_id)
            row=c.execute('SELECT * FROM jobs WHERE id=?',(job,)).fetchone()
            if row:
                if row['digest'] != digest:
                    raise BudgetError('request-conflict')
                if row['result']:
                    return job,json.loads(row['result'])
                if now-row['started'] > 120:
                    raise BudgetError('request-interrupted')
                raise BudgetError('photo-busy',now+15)
            cached=c.execute("SELECT result FROM jobs WHERE owner=? AND digest=? AND state='accepted' ORDER BY started DESC LIMIT 1",(who,digest)).fetchone()
            if cached:
                return job,json.loads(cached['result'])
            if meta.get('disabled') or now >= float(meta['pricing_expires']):
                raise BudgetError('pricing-review-required')
            # The worker's whole attempt is at most 38 seconds. Keep all new
            # network work clear of rollover, including connect/TLS before POST.
            if next_month(now)-now < 45:
                raise BudgetError('month-changed',next_month(now)+1)
            # Cross-process persistent abuse limits; a changed browser owner
            # cannot bypass the shared caller and whole-service limits.
            for field,value,window,limit in [('caller',client,60,3),('owner',who,86400,30)]:
                n=c.execute(f'SELECT COUNT(*) FROM jobs WHERE {field}=? AND started>?',(value,now-window)).fetchone()[0]
                if n >= limit:
                    raise BudgetError('photo-rate-limit',now+window)
            if c.execute('SELECT COUNT(*) FROM jobs WHERE started>?',(now-60,)).fetchone()[0] >= 12:
                raise BudgetError('photo-rate-limit',now+60)
            if c.execute("SELECT COUNT(*) FROM jobs WHERE state='running' AND started>?",(now-120,)).fetchone()[0] >= 2:
                raise BudgetError('photo-busy',now+15)
            spent=c.execute('SELECT COALESCE(SUM(held),0) FROM jobs WHERE month=?',(month_at(now),)).fetchone()[0]
            if spent+ATTEMPT_LIMIT > MONTH_LIMIT:
                raise BudgetError('photo-budget-exhausted',next_month(now))
            c.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,NULL)',(job,who,digest,client,month_at(now),now,'running',ATTEMPT_LIMIT))
            return job,None

    def begin_call(self, job, stage):
        with self.connection() as c:
            c.execute('BEGIN IMMEDIATE')
            now=self.clock()
            meta=dict(c.execute('SELECT key,value FROM meta').fetchall())
            if meta.get('disabled') or now >= float(meta['pricing_expires']):
                raise BudgetError('pricing-review-required')
            row=c.execute('SELECT * FROM jobs WHERE id=?',(job,)).fetchone()
            if not row or row['state']!='running' or stage not in (0,1):
                raise BudgetError('accounting-unavailable')
            # A request started just before rollover cannot spend the new month
            # against the old reservation. Unsent work stops; paid replies are
            # accounted to the month in which the paid request was sent.
            if row['month'] != month_at(now):
                raise BudgetError('month-changed',now+1)
            if next_month(now)-now < 45:
                raise BudgetError('month-changed',next_month(now)+1)
            c.execute('INSERT INTO calls VALUES(?,?,?,NULL)',(job,stage,CALL_LIMIT))

    def finish_call(self, job, stage, usage):
        try:
            cost=cost_for_usage(usage)
        except ValueError:
            # Stop ALL new egress on unexpected accounting. Preserve real excess
            # when measurable; unknown usage retains the entire call ceiling.
            with self.connection() as c:
                c.execute('BEGIN IMMEDIATE')
                c.execute("UPDATE meta SET value='unexpected-provider-usage' WHERE key='disabled'")
                try: cost=max(CALL_LIMIT,cost_for_usage(usage,enforce_bounds=False))
                except ValueError: cost=CALL_LIMIT
                c.execute('UPDATE calls SET cost=? WHERE job=? AND stage=?',(cost,job,stage))
            return False
        with self.connection() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT month FROM jobs WHERE id=?',(job,)).fetchone()
            if not row:
                raise BudgetError('accounting-unavailable')
            c.execute('UPDATE calls SET cost=?,usage=? WHERE job=? AND stage=?',(cost,json.dumps(usage),job,stage))
        return True

    def finish(self, job, result):
        with self.connection() as c:
            c.execute('BEGIN IMMEDIATE')
            row=c.execute('SELECT * FROM jobs WHERE id=?',(job,)).fetchone()
            if not row or row['state']!='running':
                raise BudgetError('accounting-unavailable')
            cost=c.execute('SELECT COALESCE(SUM(cost),0) FROM calls WHERE job=?',(job,)).fetchone()[0]
            result=dict(result)
            result['attemptCostNanoGBP']=cost
            result['receiptId']=job
            c.execute('UPDATE jobs SET held=?,state=?,result=? WHERE id=?',
                      (cost,'accepted' if result.get('found') is True else 'done',json.dumps(result,allow_nan=False),job))
            return result
