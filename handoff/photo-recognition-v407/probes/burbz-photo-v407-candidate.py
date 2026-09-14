"""Candidate benchmark: unchanged production detector/gates with BioCLIP2.5 vision."""
import pathlib,json,importlib.util,time,gc,resource
root=pathlib.Path('/root/burbz-photo-diagnostic-v407')
live=pathlib.Path('/opt/burbz-photo/models')
source='/opt/burbz-photo/releases/85282a97bcf53725fb55552403eec29f9407375ef04d486fd97283966b3b0628/photo_local.py'
spec=importlib.util.spec_from_file_location('photo',source);photo=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo)
import torch,numpy as np,birder,open_clip
from safetensors.torch import load_file
from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2
torch.set_num_threads(2);torch.set_num_interop_threads(1)
r=photo.Recognizer.__new__(photo.Recognizer);r.torch=torch;r.manifest=photo.check_manifest(live)
r.detector=fasterrcnn_resnet50_fpn_v2(weights=None,weights_backbone=None).eval();r.detector.load_state_dict(torch.load(live/'detector.pth',map_location='cpu',weights_only=True))
r.birder,cfg=birder.load_model_with_cfg(live/'birder.json',live/'birder.pt');r.birder.eval();r.birder_transform=birder.classification_transform((336,336),cfg['rgb_stats'])
all_names=json.loads((root/'bio25-names.json').read_text());indices=[i for i,n in enumerate(all_names) if n[0][2]=='Aves'];r.names=[all_names[i] for i in indices];del all_names
full=np.load(root/'bio25-vectors.npy',mmap_mode='r',allow_pickle=False);r.vectors=torch.from_numpy(np.array(full[:,indices]));del full;gc.collect()
r.common_names={n[0][5]+' '+n[0][6]:n[1] for n in r.names}
started=time.monotonic()
model,_,r.bio_transform=open_clip.create_model_and_transforms('ViT-H-14',device='meta')
state=load_file(root/'bio25.safetensors');scale=state['logit_scale'];visual_state={k[7:]:v for k,v in state.items() if k.startswith('visual.')}
visual=model.visual;del model,state
visual.load_state_dict(visual_state,assign=True);del visual_state;visual.eval();gc.collect()
assert not any(p.is_meta for p in visual.parameters())
class Encoder:
    logit_scale=scale
    def encode_image(self,image,normalize=False):
        features=visual(image)
        return torch.nn.functional.normalize(features,dim=-1) if normalize else features
r.bio=Encoder();print('Ready',round(time.monotonic()-started,2),'seconds, peak KiB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss,flush=True)
fixtures=[]
for n in ['hillewaert-adult','sharp-nonbreeding']:fixtures.append((n,pathlib.Path('/root/burbz-gull-diagnostic-v395')/(n+'.jpg'),'Larus argentatus',False))
for f in json.loads((root/'lookalikes.json').read_text()):fixtures.append((f['name'],root/f['filename'],f['expected'],False))
for n,s in {'robin-clear':'Erithacus rubecula','great-tit-clear':'Parus major','raven-perched':'Corvus corax','carrion-crow':'Corvus corone','raven-flight':'Corvus corax','distant-blob':None,'blurred-bird':None,'empty-scene':None,'nonbird-shapes':None}.items():fixtures.append((n,pathlib.Path('/root/burbz-photo-accuracy-v393/public/burbz/tests/fixtures/photo-v350')/(n+'.jpg'),s,n=='raven-flight'))
for f in json.loads(pathlib.Path('/root/burbz-local-photo-evidence/extra-results.json').read_text()):fixtures.append((pathlib.Path(f['file']).stem,pathlib.Path(f['file']),f['result'].get('scientificName'),False))
rows=[]
for name,path,expected,may_abstain in fixtures:
    started=time.monotonic();result=r.identify(path.read_bytes())
    passed=(not result['found']) if expected is None else ((may_abstain and not result['found']) or (result['found'] and result.get('scientificName')==expected and result.get('confidence',0)>=.9))
    row={'name':name,'expected':expected,'passed':passed,'seconds':round(time.monotonic()-started,3),'result':result};rows.append(row)
    print(json.dumps(row),flush=True);(root/'candidate-results.json').write_text(json.dumps({'rows':rows,'peakRssKiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss},indent=2))
