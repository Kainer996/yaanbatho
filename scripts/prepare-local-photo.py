#!/usr/bin/env python3
"""Provision pinned free models; runtime inference never downloads anything.

Run with the isolated photo venv. --cache permits an entirely offline install
using previously downloaded source files. Models stay outside the web root.
"""
import argparse
import hashlib
import json
import re
import shutil
import tempfile
from pathlib import Path
from urllib.request import urlopen

HF = 'https://huggingface.co/'
BIRDER = HF+'birder-project/rope_vit_reg4_b14_capi-intermediate-eu-common/resolve/04624a2fbbb5a50346ef553dc1b65dcfe707692c/'
BIO = HF+'imageomics/bioclip-2.5-vith14/resolve/6e3d04e3d6522012c88181085c5ae666e14c45cd/'
TAXA = HF+'datasets/imageomics/TreeOfLife-200M/resolve/5f2dc493b3dc0e544438a04038ab15faa646b749/embeddings/'
FILES = {
    'birder.json': ('model-config.json', BIRDER+'rope_vit_reg4_b14_capi-intermediate-eu-common.json', '8e7afdd172cd2380153d4ff84b865304d6c4dbe9c2aac7402fb07cd61a2f7461'),
    'birder.pt': ('rope_vit_reg4_b14_capi-intermediate-eu-common.pt', BIRDER+'rope_vit_reg4_b14_capi-intermediate-eu-common.pt', '5f9529dbb354ac755ee7c584fdc9227f469233ca35a09998ddf57afa54199e44'),
    'bio25.safetensors': ('bio25.safetensors', BIO+'open_clip_model.safetensors', 'ac2e37c2f89ef8e6b889176a9a3f418970ad9db15a218bd29e3321e95c46ae97'),
    'detector.pth': ('fasterrcnn_resnet50_fpn_v2_coco-dd69338a.pth', 'https://download.pytorch.org/models/fasterrcnn_resnet50_fpn_v2_coco-dd69338a.pth', 'dd69338a24b8d7381807e247652bdc356325bcbaf1cd3e092e00e0a1a58706bf'),
    # Preserve the previously checked common-name joins, then intersect exact
    # scientific identities with the new taxonomy. Renamed English labels must
    # not silently disable a cross-check (e.g. European Herring Gull -> Herring gull).
    'prior-taxon-names.json': ('taxon-names.json', TAXA+'txt_emb_bioclip-2.json', '4648928b006f85d83d28e5a27074ca9363465d82e778d708b369c5eaf54b8ef5'),
    'taxon-names.json': ('bio25-names.json', TAXA+'txt_emb_bioclip-2.5-vith14.json', 'af0cb41ffbfb31e6a2e2d5e3a402529ec8245a4268f42ce45ee4e977b7127443'),
    'taxon-embeddings.npy': ('bio25-vectors.npy', TAXA+'txt_emb_bioclip-2.5-vith14.npy', 'd1cc734330d17ea26e6f713b289b2138b4adc90d4f524349cd16fab42d5c3358'),
}

# Explicit current name for a species otherwise sharing the old broad English
# label with L. smithsonianus. Scientific identity and every other label stay put.
CANONICAL_NAMES = {'Larus argentatus': 'European herring gull'}
PHOTO_STYLE_PROMPTS = [
    ['a wildlife photograph of a real bird.', 'a photograph of a bird in nature.',
     'a close-up photograph of a real bird.', 'a phone camera photograph of a live bird.'],
    ['an illustration of a bird.', 'a drawing of a bird.', 'a cartoon bird.',
     'a painted bird character in a video game.'],
]

def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--destination', required=True, type=Path)
    parser.add_argument('--cache', type=Path, help='Offline source cache; no network fallback')
    args = parser.parse_args()
    if args.destination.exists():
        raise SystemExit('Destination exists; choose a new directory, never overwrite a running model bundle.')
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='photo-stage-', dir=args.destination.parent) as directory:
        stage = Path(directory)
        for name, (cached_name, url, expected) in FILES.items():
            if args.cache:
                source = args.cache/cached_name
                if digest(source) != expected:
                    raise ValueError('Cached model checksum mismatch: '+name)
                shutil.copyfile(source, stage/name)
            else:
                print('Downloading '+name, flush=True)
                with urlopen(url, timeout=60) as response, (stage/name).open('wb') as target:
                    shutil.copyfileobj(response, target, length=1024*1024)
            if digest(stage/name) != expected:
                raise ValueError('Model checksum mismatch: '+name)
        import numpy as np
        import torch
        import open_clip
        from safetensors.torch import load_file, save_file
        torch.set_num_threads(2)
        torch.set_num_interop_threads(1)
        names = json.loads((stage/'taxon-names.json').read_text())
        indices = [i for i, n in enumerate(names) if n[0][2] == 'Aves']
        vectors = np.load(stage/'taxon-embeddings.npy', mmap_mode='r', allow_pickle=False)
        birds = [names[i] for i in indices]
        if vectors.shape[0] != 1024 or vectors.shape[1] != len(names):
            raise ValueError('BioCLIP 2.5 text embedding/taxonomy mismatch')
        bird_vectors = np.array(vectors[:, indices])
        # Text inference is never used at runtime. Preserve every visual tensor
        # byte and its learned scale, avoiding the unused text model allocation.
        state = load_file(stage/'bio25.safetensors')
        model = open_clip.create_model('ViT-H-14', device='meta')
        model.load_state_dict(state, assign=True)
        model.attn_mask = torch.full((model.context_length, model.context_length), float('-inf')).triu_(1)
        model.eval()
        tokenizer = open_clip.get_tokenizer('ViT-H-14')
        def embed(prompts):
            with torch.inference_mode():
                features = model.encode_text(tokenizer(prompts), normalize=True)
                return torch.nn.functional.normalize(features.mean(0), dim=0)
        controls = {}
        for species, common in CANONICAL_NAMES.items():
            matches = [i for i,n in enumerate(birds) if ' '.join(n[0][5:7]) == species]
            if len(matches) != 1:
                raise ValueError('Ambiguous canonical text label: '+species)
            i = matches[0]
            name = ' '.join(birds[i][0])+' with common name '+birds[i][1]
            # Exact author recipe uses one template; verify it before editing a
            # common name. A different tokenizer/model/template must fail closed.
            original = embed(['an image of '+name+'.'])
            controls[species] = float(original @ torch.from_numpy(bird_vectors[:,i]))
            if abs(controls[species]-1) > .00001:
                raise ValueError('Published text embedding reproduction failed')
            name = ' '.join(birds[i][0])+' with common name '+common
            bird_vectors[:,i] = embed(['an image of '+name+'.']).numpy()
            birds[i][1] = common
        np.save(stage/'bird-embeddings.npy', bird_vectors, allow_pickle=False)
        (stage/'bird-names.json').write_text(json.dumps(birds))
        np.save(stage/'photo-style.npy', torch.stack([embed(p) for p in PHOTO_STYLE_PROMPTS], dim=1).numpy(), allow_pickle=False)
        visual = {k:v for k,v in state.items() if k.startswith('visual.') or k == 'logit_scale'}
        if 'visual.proj' not in visual or 'logit_scale' not in visual:
            raise ValueError('Incomplete BioCLIP visual checkpoint')
        save_file(visual, stage/'bio25-vision.safetensors')
        del state, visual, model
        normal = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
        by_name = {}
        prior_names = json.loads((stage/'prior-taxon-names.json').read_text())
        for taxon, common in prior_names:
            if taxon[2] != 'Aves':
                continue
            if common:
                by_name.setdefault(normal(common), set()).add(taxon[5]+' '+taxon[6])
        labels = torch.load(stage/'birder.pt', map_location='cpu', weights_only=True)['class_to_idx']
        mapping = {}
        current_species = {taxon[5]+' '+taxon[6] for taxon, _ in birds}
        for name, index in labels.items():
            identities = by_name.get(normal(name), set())
            if len(identities) == 1 and identities <= current_species:
                mapping.setdefault(next(iter(identities)), []).append(index)
        runtime_files = ['birder.json','birder.pt','bio25-vision.safetensors','detector.pth','bird-names.json','bird-embeddings.npy','photo-style.npy']
        bundle = stage/'bundle'; bundle.mkdir()
        for name in runtime_files:
            (stage/name).replace(bundle/name)
            (bundle/name).chmod(0o644)
        manifest = {'id':'photo-models-v407','sha256':{n:digest(bundle/n) for n in runtime_files},
                    'birder_species':mapping,'bird_count':len(birds),
                    'source_sha256':{name:expected for name,(_,_,expected) in FILES.items()},
                    'canonical_names':CANONICAL_NAMES,'label_reproduction_cosines':controls,
                    'photo_style_prompts':PHOTO_STYLE_PROMPTS,
                    'notes':'BioCLIP2.5 visual tensors unchanged; matching 1024-dimensional bird embeddings. Prior exact scientific Birder joins retained where the current taxonomy includes that species.'}
        (bundle/'manifest.json').write_text(json.dumps(manifest, indent=2))
        bundle.replace(args.destination)
    print(f'Prepared {len(birds)} worldwide bird taxa, {len(mapping)} cross-model matches at {args.destination}')

if __name__ == '__main__':
    main()
