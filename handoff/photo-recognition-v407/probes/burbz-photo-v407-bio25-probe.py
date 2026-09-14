"""Isolated candidate benchmark. No live service or model bundle is changed."""
import pathlib, urllib.request, hashlib, json, time, gc, resource, math
root=pathlib.Path('/root/burbz-photo-diagnostic-v407');root.mkdir(exist_ok=True)
bio='https://huggingface.co/imageomics/bioclip-2.5-vith14/resolve/6e3d04e3d6522012c88181085c5ae666e14c45cd/'
taxa='https://huggingface.co/datasets/imageomics/TreeOfLife-200M/resolve/5f2dc493b3dc0e544438a04038ab15faa646b749/embeddings/'
files=[('bio25.safetensors',bio+'open_clip_model.safetensors','ac2e37c2f89ef8e6b889176a9a3f418970ad9db15a218bd29e3321e95c46ae97'),
('bio25-names.json',taxa+'txt_emb_bioclip-2.5-vith14.json','af0cb41ffbfb31e6a2e2d5e3a402529ec8245a4268f42ce45ee4e977b7127443'),
('bio25-vectors.npy',taxa+'txt_emb_bioclip-2.5-vith14.npy','d1cc734330d17ea26e6f713b289b2138b4adc90d4f524349cd16fab42d5c3358')]
for name,url,expected in files:
    path=root/name
    if not path.exists():
        print('Downloading',name,flush=True)
        with urllib.request.urlopen(url,timeout=90) as src,(root/(name+'.partial')).open('wb') as dest:
            while data:=src.read(1024*1024):dest.write(data)
        (root/(name+'.partial')).replace(path)
    with path.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
    assert digest==expected,(name,digest)
    print('Verified',name,flush=True)
import numpy as np,torch,open_clip
torch.set_num_threads(2);torch.set_num_interop_threads(1)
all_names=json.loads((root/'bio25-names.json').read_text());indices=[i for i,n in enumerate(all_names) if n[0][2]=='Aves'];names=[all_names[i] for i in indices]
del all_names
full=np.load(root/'bio25-vectors.npy',mmap_mode='r',allow_pickle=False)
vectors=torch.from_numpy(np.array(full[:,indices]));del full;gc.collect()
print('Bird taxa',len(names),'vectors',list(vectors.shape),flush=True)
started=time.monotonic()
net,_,transform=open_clip.create_model_and_transforms('ViT-H-14',pretrained=str(root/'bio25.safetensors'));net.eval()
print('Loaded model seconds',time.monotonic()-started,flush=True)
from PIL import Image,ImageOps
report=[];prior=json.loads(pathlib.Path('/root/burbz-gull-diagnostic-v395/results.json').read_text())
for source in prior:
    image=ImageOps.exif_transpose(Image.open('/root/burbz-gull-diagnostic-v395/'+source['name']+'.jpg')).convert('RGB');image.thumbnail((2560,2560))
    box=next(d['box'] for d in source['detections'] if d['label']==16 and d['score']>=.9)
    row={'name':source['name'],'views':[]}
    for padding in [.12,.30]:
        x0,y0,x1,y1=box;pad=max(x1-x0,y1-y0)*padding
        view=image.crop((max(0,math.floor(x0-pad)),max(0,math.floor(y0-pad)),min(image.width,math.ceil(x1+pad)),min(image.height,math.ceil(y1+pad))))
        start=time.monotonic()
        with torch.inference_mode():
            features=net.encode_image(transform(view).unsqueeze(0),normalize=True)
            scores=(net.logit_scale.exp()*features@vectors).softmax(-1)[0];values,ids=scores.topk(5)
        row['views'].append({'padding':padding,'seconds':time.monotonic()-start,'top':[{'scientific':' '.join(names[int(i)][0][5:7]),'common':names[int(i)][1],'score':float(v)} for i,v in zip(ids,values)]})
    report.append(row);print(json.dumps(row),flush=True)
(root/'bio25-gull-results.json').write_text(json.dumps({'rows':report,'peakRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},indent=2))
