#!/usr/bin/env python3
"""Verify real HTTP photo outcomes; fixtures never enter client discovery state."""
import argparse,hashlib,json,sys,time
from pathlib import Path
import requests

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--origin',default='http://127.0.0.1:5055');parser.add_argument('--fixtures',required=True);parser.add_argument('--extra-fixtures');parser.add_argument('--output');args=parser.parse_args()
    expected={'robin-clear':'Erithacus rubecula','great-tit-clear':'Parus major','raven-perched':'Corvus corax','carrion-crow':'Corvus corone','raven-flight':'Corvus corax','distant-blob':None,'blurred-bird':None,'empty-scene':None,'nonbird-shapes':None}
    cases=[(name,Path(args.fixtures)/(name+'.jpg'),species) for name,species in expected.items()]
    extra=Path(args.extra_fixtures) if args.extra_fixtures else Path(args.fixtures).parent/'photo-v407'
    extra_expected={'herring-european-adult':'Larus argentatus','herring-european-winter':'Larus argentatus',
                    'herring-american-maine':'Larus smithsonianus','herring-american-california':'Larus smithsonianus','illustrated-crow':None}
    manifest={r['name']:r for r in json.loads((extra/'manifest.json').read_text())}
    for name,species in extra_expected.items():
        path=extra/(name+'.jpg')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=manifest[name]['sha256']:
            raise ValueError('Camera fixture checksum mismatch: '+name)
        cases.append((name,path,species))
    rows=[]
    for name,path,species in cases:
        with path.open('rb') as stream:
            start=time.monotonic();response=requests.post(args.origin.rstrip('/')+'/api/identify/image',files={'image':('photo.jpg',stream,'image/jpeg')},data={'captureSource':'camera','lat':'51.5','lon':'-.1'},timeout=50)
        result=response.json();passed=result.get('policy')=='photo-local-v393' and result.get('model')=='bioclip25-birder-local'
        if species and not (name=='raven-flight' and result.get('found') is False):passed=passed and response.status_code==200 and result.get('accepted') is True and result.get('verified') is True and result.get('found') is True and result.get('scientificName')==species and result.get('confidence',0)>=.90
        else:passed=passed and response.status_code==422 and result.get('found') is False and result.get('accepted') is False and 'species' not in result and result.get('message','').startswith(('Bird not found.','Species not confirmed.'))
        row={'fixture':name,'status':response.status_code,'passed':bool(passed),'seconds':round(time.monotonic()-start,2),'result':result};rows.append(row);print(json.dumps(row),flush=True)
    if args.output:Path(args.output).write_text(json.dumps(rows,indent=2))
    return 0 if all(r['passed'] for r in rows) else 1
if __name__=='__main__':sys.exit(main())
