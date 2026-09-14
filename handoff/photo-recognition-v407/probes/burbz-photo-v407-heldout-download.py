import pathlib,json,urllib.request,hashlib,importlib.util,time
p=pathlib.Path('/tmp/burbz-photo-v407-research');dest=p/'heldout';dest.mkdir(exist_ok=True)
spec=importlib.util.spec_from_file_location('photo','/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/photo-recognition-v407/public/burbz/photo_id.py');photo=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo)
metadata=json.loads((p/'heldout-metadata.json').read_text());rows=[]
for i,page in enumerate(metadata['query']['pages'].values()):
    info=page['imageinfo'][0];name='heldout-'+str(i+1);raw=dest/(name+'-original.jpg');normal=dest/(name+'.jpg');url=info['url'].split('?')[0]
    if not raw.exists():
        with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Burbz-photo-diagnostic/1.0 (local public-image regression)'}),timeout=40) as r:raw.write_bytes(r.read(18_000_000))
    photo.normalise_image_file(str(raw),str(normal))
    row={'name':name,'filename':normal.name,'expected':'Larus smithsonianus' if i in [1,3,5] else 'Larus argentatus','source':info['descriptionurl'],'title':page['title'],'url':url,'license':info['extmetadata']['LicenseShortName']['value'],'author':info['extmetadata']['Artist']['value'],'sourceSha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'normalizedSha256':hashlib.sha256(normal.read_bytes()).hexdigest(),'normalization':'Unchanged Burbz normalise_image_file, EXIF orientation, RGB JPEG90, maximum2560px; original retained.'};rows.append(row)
    (dest/'manifest.json').write_text(json.dumps(rows,indent=2));print(name,normal.stat().st_size,flush=True)
    time.sleep(2)
