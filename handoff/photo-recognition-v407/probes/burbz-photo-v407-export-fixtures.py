import pathlib,json,importlib.util,hashlib
root=pathlib.Path('/root/burbz-photo-diagnostic-v407');dest=root/'fixtures-v407';dest.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('adapter','/home/ubuntu/yaanbatho/burbz/photo_id.py');adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
sources=[]
for r in json.loads(pathlib.Path('/root/burbz-gull-diagnostic-v395/results.json').read_text()):
    sources.append({'name':'herring-european-'+('adult' if r['name']=='hillewaert-adult' else 'winter'),'original':'/root/burbz-gull-diagnostic-v395/'+r['name']+'.jpg','expected':'Larus argentatus','source':r['source'],'author':r['author'],'license':r['license']})
for r in json.loads((root/'lookalikes.json').read_text()):
    if r['expected']=='Larus smithsonianus':sources.append({'name':'herring-'+r['name'],'original':str(root/r['filename']),'expected':r['expected'],'source':r['source'],'author':r['author'],'license':r['license']})
sources.append({'name':'illustrated-crow','original':'/home/ubuntu/yaanbatho/burbz/bird-art-cache/carrion_crow_burbz_manga_20260624_v2.png','expected':None,'source':'https://yaanbatho.com/burbz/bird-art-cache/carrion_crow_burbz_manga_20260624_v2.png','author':'Burbz generated game artwork','license':'Existing project artwork; see project LICENSING.md'})
for r in sources:
    path=dest/(r['name']+'.jpg');source=pathlib.Path(r.pop('original'));adapter.normalise_image_file(str(source),str(path));r['originalSha256']=hashlib.sha256(source.read_bytes()).hexdigest();r['sha256']=hashlib.sha256(path.read_bytes()).hexdigest();r['file']=path.name;r['transformation']='Unchanged camera normalization: EXIF orientation, RGB, longest side <=2560, JPEG quality90.'
(dest/'manifest.json').write_text(json.dumps(sources,indent=2));print([(r['file'],(dest/r['file']).stat().st_size) for r in sources])
