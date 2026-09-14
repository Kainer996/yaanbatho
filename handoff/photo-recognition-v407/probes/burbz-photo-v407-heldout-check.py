import pathlib,json,importlib.util,time,resource,hashlib
root=pathlib.Path('/root/burbz-photo-diagnostic-v407')
spec=importlib.util.spec_from_file_location('photo',root/'photo_local.py');photo=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo)
r=photo.Recognizer(root/'prepared-models');rows=[]
for f in json.loads((root/'heldout-manifest.json').read_text()):
 p=root/f['filename'];assert hashlib.sha256(p.read_bytes()).hexdigest()==f['normalizedSha256']
 start=time.monotonic();result=r.identify(p.read_bytes());found=result.get('found');correct=found and result.get('scientificName')==f['expected'];mode=f['acceptanceMode']
 passed=(not found) if mode=='abstain' else correct if mode=='required-correct' else (not found or correct)
 row={'name':f['name'],'mode':mode,'expected':f['expected'],'passed':bool(passed),'seconds':time.monotonic()-start,'result':result};rows.append(row);print(json.dumps(row),flush=True)
 (root/'heldout-results.json').write_text(json.dumps({'rows':rows,'peakRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},indent=2))
