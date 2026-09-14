import pathlib,json,importlib.util,time,resource
root=pathlib.Path('/root/burbz-photo-diagnostic-v407')
spec=importlib.util.spec_from_file_location('photo',root/'photo_local.py');photo=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo)
r=photo.Recognizer(root/'prepared-models')
print('Actual packaged worker ready',flush=True)
fixtures=[]
for n in ['hillewaert-adult','sharp-nonbreeding']:fixtures.append((n,pathlib.Path('/root/burbz-gull-diagnostic-v395')/(n+'.jpg'),'Larus argentatus',False))
for f in json.loads((root/'lookalikes.json').read_text()):fixtures.append((f['name'],root/f['filename'],f['expected'],False))
for n,s in {'robin-clear':'Erithacus rubecula','great-tit-clear':'Parus major','raven-perched':'Corvus corax','carrion-crow':'Corvus corone','raven-flight':'Corvus corax','distant-blob':None,'blurred-bird':None,'empty-scene':None,'nonbird-shapes':None}.items():fixtures.append((n,pathlib.Path('/root/burbz-photo-accuracy-v393/public/burbz/tests/fixtures/photo-v350')/(n+'.jpg'),s,n=='raven-flight'))
for f in json.loads(pathlib.Path('/root/burbz-local-photo-evidence/extra-results.json').read_text()):fixtures.append((pathlib.Path(f['file']).stem,pathlib.Path(f['file']),f['result'].get('scientificName'),False))
import hashlib
for f in json.loads((root/'heldout-manifest.json').read_text()):
    p=root/f['filename'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['normalizedSha256']
    fixtures.append((f['name'],p,None if f['acceptanceMode']=='abstain' else f['expected'],f['acceptanceMode']=='correct-or-abstain'))
rows=[]
for name,path,expected,may_abstain in fixtures:
    started=time.monotonic();result=r.identify(path.read_bytes())
    passed=(not result['found']) if expected is None else ((may_abstain and not result['found']) or (result['found'] and result.get('scientificName')==expected and result.get('confidence',0)>=.9))
    row={'name':name,'expected':expected,'passed':passed,'seconds':round(time.monotonic()-started,3),'result':result};rows.append(row)
    print(json.dumps(row),flush=True);(root/'worker-results.json').write_text(json.dumps({'sourceHash':photo.SOURCE_HASH,'bundle':r.manifest['id'],'rows':rows,'peakRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},indent=2))

raise SystemExit(0 if all(r["passed"] for r in rows) else 1)
