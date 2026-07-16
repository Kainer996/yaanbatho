import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SW = ROOT / "sw.js"


def test_activation_deletes_only_old_burbz_owned_caches():
    script = r'''
const fs=require('fs'), vm=require('vm');
const listeners={}; const deleted=[];
const expansion={art:{}};
const self={
  BURBZ_UK_BIRD_EXPANSION_50:expansion,
  BURBZ_UK_BIRD_EXPANSION_26:expansion,
  BURBZ_AU_BIRD_EXPANSION:expansion,
  BURBZ_UK_BIRD_EXPANSION_FINAL:expansion,
  BURBZ_AU_BIRD_EXPANSION_50:expansion,
  BURBZ_NATIONAL_BIRD_COMPLETION_20260715:expansion,
  addEventListener:(name,fn)=>listeners[name]=fn,
  clients:{claim:async()=>{}}, skipWaiting:async()=>{}, location:{origin:'https://yaanbatho.com'}
};
const caches={
  keys:async()=>['burbz-old-v78','burbz-national-completion-v79-20260715','burbz-buzzard-history-v80-20260716','burbz-village-variety-v81-20260716','good-news-v4','quarry-pro-v2'],
  delete:async key=>{deleted.push(key);return true},
  open:async()=>({add:async()=>{},put:async()=>{}}), match:async()=>null
};
const sandbox={self,caches,importScripts:()=>{},console,URL,Response,fetch:async()=>new Response('ok')};
vm.runInNewContext(fs.readFileSync('sw.js','utf8'),sandbox,{filename:'sw.js'});
let work; listeners.activate({waitUntil:p=>work=p});
Promise.resolve(work).then(()=>console.log(JSON.stringify(deleted))).catch(e=>{console.error(e);process.exit(1)});
'''
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == ["burbz-old-v78", "burbz-national-completion-v79-20260715", "burbz-buzzard-history-v80-20260716"]


def test_spain_boundary_is_part_of_the_offline_app_shell():
    source = SW.read_text(encoding="utf-8")
    assert "./spain_boundary_20260715.js?v=spain-mainland-balearics-20260715" in source
