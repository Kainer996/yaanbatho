#!/usr/bin/env python3
"""Read-only HTTP proof of the existing sound recognizer after a restart."""
import argparse, io, json
from pathlib import Path
import numpy as np
import requests
import soundfile as sf

EXPECTED = {
    'provider': 'birdnetv3', 'configuredProvider': 'birdnetv3',
    'fallbackUsed': False, 'providerVerified': True,
    'modelSha256': '69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24',
    'labelsSha256': '8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0',
    'geoModelSha256': '2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017',
    'geoLabelsSha256': 'c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784',
    'scoreBlacklistSha256': 'a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366',
    'policyVersion': 'burbz-v3-temporal-20260729.2', 'serverIntegrationVersion': 4,
}

def main():
    p=argparse.ArgumentParser();p.add_argument('--origin',required=True);p.add_argument('--root',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    endpoint=a.origin.rstrip('/')+'/api/identify/sound';audio=Path(a.root)/'assets/audio';rows=[]
    data,rate=sf.read(audio/'bird-tawny-owl.ogg',dtype='float32',always_2d=True)
    block=np.concatenate([data.mean(axis=1),np.zeros(int(rate*.8),dtype=np.float32)])
    repeated=np.tile(block,int(np.ceil(rate*12/len(block))))[:rate*12]
    def wav(samples,sample_rate):
        stream=io.BytesIO();sf.write(stream,samples,sample_rate,format='WAV',subtype='PCM_16');return stream.getvalue()
    def post(name,blob=None):
        response=requests.post(endpoint,files={'audio':('proof.wav',blob,'audio/wav')} if blob is not None else None,data={'lat':'53.228','lon':'-2.598'},timeout=90)
        result=response.json();rows.append({'fixture':name,'status':response.status_code,'result':result});return result
    def provenance(result):return all(result.get(k)==v for k,v in EXPECTED.items())
    def names(result):return json.dumps([result.get('bird'),result.get('scientificName'),result.get('birdnetName'),result.get('allDetections')]).lower()
    owl=post('tawny-owl-12s',wav(repeated,rate));rows[-1]['passed']=provenance(owl) and owl.get('found') is True and ('strix aluco' in names(owl) or 'tawny owl' in names(owl))
    blackbird=post('blackbird-confuser',(audio/'bird-blackbird.ogg').read_bytes());n=names(blackbird)
    rows[-1]['passed']=provenance(blackbird) and not any(s in n for s in ['mistle thrush','turdus viscivorus','american robin','turdus migratorius']) and (blackbird.get('found') is False or 'turdus merula' in n or 'common blackbird' in n)
    silent=post('silence-12s',wav(np.zeros(32000*12,dtype=np.float32),32000));rows[-1]['passed']=silent.get('found') is False and silent.get('serverIntegrationVersion')==4
    malformed=post('missing-audio');rows[-1]['passed']=malformed.get('provider') is None and malformed.get('providerVerified') is False and malformed.get('serverIntegrationVersion')==4
    Path(a.output).write_text(json.dumps(rows,indent=2))
    for row in rows: print(json.dumps({'fixture':row['fixture'],'passed':row['passed'],'status':row['status']}),flush=True)
    return 0 if all(r['passed'] for r in rows) else 1

if __name__=='__main__':raise SystemExit(main())
