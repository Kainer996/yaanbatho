"""Exploratory label/style test; never used by the live recognizer."""
import pathlib,json,torch,numpy as np,open_clip,importlib.util,time,gc
from safetensors.torch import load_file
from PIL import Image,ImageOps
from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2
from torchvision.transforms.functional import to_tensor
OPENA_AI_IMAGENET_TEMPLATE = [lambda c: f"an image of {c}."]
root=pathlib.Path('/root/burbz-photo-diagnostic-v407');live=pathlib.Path('/opt/burbz-photo/models')
spec=importlib.util.spec_from_file_location('photo','/opt/burbz-photo/releases/85282a97bcf53725fb55552403eec29f9407375ef04d486fd97283966b3b0628/photo_local.py');photo=importlib.util.module_from_spec(spec);spec.loader.exec_module(photo)
torch.set_num_threads(2);torch.set_num_interop_threads(1)
all_names=json.loads((root/'bio25-names.json').read_text());idx=[i for i,n in enumerate(all_names) if n[0][2]=='Aves'];names=[all_names[i] for i in idx];del all_names
full=np.load(root/'bio25-vectors.npy',mmap_mode='r');vectors=torch.from_numpy(np.array(full[:,idx]));del full;gc.collect()
model,_,transform=open_clip.create_model_and_transforms('ViT-H-14',device='meta')
model.load_state_dict(load_file(root/'bio25.safetensors'),assign=True)
model.attn_mask=torch.full((model.context_length,model.context_length),float('-inf')).triu_(1);model.eval()
tokenizer=open_clip.get_tokenizer('ViT-H-14')
def embed(prompts):
    chunks=[]
    with torch.inference_mode():
        for j in range(0,len(prompts),8):chunks.append(model.encode_text(tokenizer(prompts[j:j+8]),normalize=True))
    return torch.nn.functional.normalize(torch.cat(chunks).mean(0),dim=0)
changes={};cosines={}
for species,common in [('Larus argentatus','European herring gull'),('Larus smithsonianus','American herring gull')]:
    i=next(i for i,n in enumerate(names) if ' '.join(n[0][5:7])==species)
    original=' '.join(names[i][0])+' with common name '+names[i][1]
    control=embed([t(original) for t in OPENA_AI_IMAGENET_TEMPLATE]);cosines[species]=float(control@vectors[:,i])
    corrected=' '.join(names[i][0])+' with common name '+common
    new=embed([t(corrected) for t in OPENA_AI_IMAGENET_TEMPLATE])
    vectors[:,i]=new;changes[species]=i
    print('Taxonomy label',species,'control cosine',cosines[species],flush=True)
styles=[['a wildlife photograph of a real bird.','a photograph of a bird in nature.','a close-up photograph of a real bird.','a phone camera photograph of a live bird.'],['an illustration of a bird.','a drawing of a bird.','a cartoon bird.','a painted bird character in a video game.']]
style_vectors=torch.stack([embed(p) for p in styles],dim=1)
del model.visual;gc.collect()
features=np.load(root/'label-probe-features.npz')
rows=[]
for name in features.files:
    f=torch.from_numpy(features[name])
    with torch.inference_mode():
        p=(model.logit_scale.exp()*f@vectors).softmax(-1)[0];v,i=p.topk(3);stylescore=(model.logit_scale.exp()*f@style_vectors).softmax(-1)[0]
    row={'name':name,'top':[[' '.join(names[int(k)][0][5:7]),float(s)] for k,s in zip(i,v)],'photoStyle':float(stylescore[0])};rows.append(row);print(json.dumps(row),flush=True)
(root/'single-label-probe-results.json').write_text(json.dumps({'labelControlCosines':cosines,'rows':rows},indent=2))
