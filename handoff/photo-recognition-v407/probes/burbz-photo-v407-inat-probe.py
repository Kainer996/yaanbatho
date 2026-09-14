import pathlib, urllib.request, hashlib, json, time
root=pathlib.Path('/root/burbz-photo-diagnostic-v407');root.mkdir(exist_ok=True)
model='rope_vit_reg4_b14_capi-inat21'
base='https://huggingface.co/birder-project/'+model+'/resolve/2706e935a8f09eefffc925b74f8af65c4fd17274/'
for suffix in ['.json','.pt']:
    path=root/(model+suffix)
    if not path.exists():
        with urllib.request.urlopen(base+model+suffix, timeout=90) as src,path.with_suffix(path.suffix+'.partial').open('wb') as dest:
            while data:=src.read(1024*1024): dest.write(data)
        path.with_suffix(path.suffix+'.partial').replace(path)
    if suffix=='.pt':
        with path.open('rb') as stream: digest=hashlib.file_digest(stream,'sha256').hexdigest()
        assert digest=='25befb5a460cc80a5a7961db61e747916461bf6967f3d39d9294ee474bd31304',digest
import torch,birder
torch.set_num_threads(2);torch.set_num_interop_threads(1)
checkpoint=torch.load(root/(model+'.pt'),map_location='cpu',weights_only=True)
labels={i:name for name,i in checkpoint['class_to_idx'].items()}
(root/'inat-labels.json').write_text(json.dumps(labels,indent=2))
print('GULL_LABELS',[(i,n) for i,n in labels.items() if 'Larus' in n],flush=True)
cfg=json.loads((root/(model+'.json')).read_text());cfg['registered_name']=cfg.get('alias');net,cfg=birder.load_model_with_cfg(cfg,root/(model+'.pt'));net.eval()
transform=birder.classification_transform((336,336),cfg['rgb_stats'])
from PIL import Image,ImageOps
report=[]
prior=json.loads(pathlib.Path('/root/burbz-gull-diagnostic-v395/results.json').read_text())
for source in prior:
    image=ImageOps.exif_transpose(Image.open('/root/burbz-gull-diagnostic-v395/'+source['name']+'.jpg')).convert('RGB');image.thumbnail((2560,2560))
    box=next(d['box'] for d in source['detections'] if d['label']==16 and d['score']>=.9)
    row={'name':source['name'],'views':[]}
    for padding in [.12,.30]:
        x0,y0,x1,y1=box;pad=max(x1-x0,y1-y0)*padding
        import math
        view=image.crop((max(0,math.floor(x0-pad)),max(0,math.floor(y0-pad)),min(image.width,math.ceil(x1+pad)),min(image.height,math.ceil(y1+pad))))
        start=time.monotonic()
        with torch.inference_mode():
            scores=net(transform(view).unsqueeze(0)).softmax(-1)[0];values,ids=scores.topk(5)
        row['views'].append({'padding':padding,'seconds':time.monotonic()-start,'top':[(labels[int(i)],float(v)) for i,v in zip(ids,values)]})
    report.append(row);print(json.dumps(row),flush=True)
(root/'inat-gull-results.json').write_text(json.dumps(report,indent=2))
