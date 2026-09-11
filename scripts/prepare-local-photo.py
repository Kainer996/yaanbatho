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
BIO = HF+'imageomics/bioclip-2/resolve/2957b322090f9cb17ae72c71981c7218a28d81e0/'
TAXA = HF+'datasets/imageomics/TreeOfLife-200M/resolve/5f2dc493b3dc0e544438a04038ab15faa646b749/embeddings/'
FILES = {
    'birder.json': ('model-config.json', BIRDER+'rope_vit_reg4_b14_capi-intermediate-eu-common.json', '8e7afdd172cd2380153d4ff84b865304d6c4dbe9c2aac7402fb07cd61a2f7461'),
    'birder.pt': ('rope_vit_reg4_b14_capi-intermediate-eu-common.pt', BIRDER+'rope_vit_reg4_b14_capi-intermediate-eu-common.pt', '5f9529dbb354ac755ee7c584fdc9227f469233ca35a09998ddf57afa54199e44'),
    'bioclip2.safetensors': ('bioclip2.safetensors', BIO+'open_clip_model.safetensors', 'b7b2bf6fbc95799e42630e394cf95803892ab447c1a8ab629dbc82fbeaf7dfef'),
    'detector.pth': ('fasterrcnn_resnet50_fpn_v2_coco-dd69338a.pth', 'https://download.pytorch.org/models/fasterrcnn_resnet50_fpn_v2_coco-dd69338a.pth', 'dd69338a24b8d7381807e247652bdc356325bcbaf1cd3e092e00e0a1a58706bf'),
    'taxon-names.json': ('taxon-names.json', TAXA+'txt_emb_bioclip-2.json', '4648928b006f85d83d28e5a27074ca9363465d82e778d708b369c5eaf54b8ef5'),
    'taxon-embeddings.npy': ('taxon-embeddings.npy', TAXA+'txt_emb_bioclip-2.npy', 'c72442de7b0cb7fcb55ab7ca08099d0f42fbd6769efe16ca64c1daa7a8b87db2'),
}

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
        names = json.loads((stage/'taxon-names.json').read_text())
        indices = [i for i, n in enumerate(names) if n[0][2] == 'Aves']
        vectors = np.load(stage/'taxon-embeddings.npy', mmap_mode='r', allow_pickle=False)
        birds = [names[i] for i in indices]
        np.save(stage/'bird-embeddings.npy', np.array(vectors[:, indices]), allow_pickle=False)
        (stage/'bird-names.json').write_text(json.dumps(birds))
        normal = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
        by_name = {}
        for taxon, common in birds:
            if common:
                by_name.setdefault(normal(common), set()).add(taxon[5]+' '+taxon[6])
        labels = torch.load(stage/'birder.pt', map_location='cpu', weights_only=True)['class_to_idx']
        mapping = {}
        for name, index in labels.items():
            identities = by_name.get(normal(name), set())
            if len(identities) == 1:
                mapping.setdefault(next(iter(identities)), []).append(index)
        runtime_files = ['birder.json','birder.pt','bioclip2.safetensors','detector.pth','bird-names.json','bird-embeddings.npy']
        bundle = stage/'bundle'; bundle.mkdir()
        for name in runtime_files:
            (stage/name).replace(bundle/name)
            (bundle/name).chmod(0o644)
        manifest = {'id':'photo-local-v393','sha256':{n:digest(bundle/n) for n in runtime_files},
                    'birder_species':mapping,'bird_count':len(birds),
                    'notes':'Exact unambiguous common-name joins only; unmapped species use the global classifier.'}
        (bundle/'manifest.json').write_text(json.dumps(manifest, indent=2))
        bundle.replace(args.destination)
    print(f'Prepared {len(birds)} worldwide bird taxa, {len(mapping)} cross-model matches at {args.destination}')

if __name__ == '__main__':
    main()
