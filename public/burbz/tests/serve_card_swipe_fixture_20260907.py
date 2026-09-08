#!/usr/bin/env python3
"""Disposable localhost-only real-game fixture. Never opens an existing save.

Optional BURBZ_ART_ORIGIN supplies public assets absent from a sparse checkout.
No APIs, cookies, authorization headers or live state are proxied.
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
from urllib.request import urlopen
import mimetypes
import os

ROOT = Path(__file__).resolve().parents[1]
ART_ORIGIN = os.environ.get('BURBZ_ART_ORIGIN', '').rstrip('/')
SEED = """
const qaParams=new URLSearchParams(location.search);
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.removeItem(BURBZ_TUTORIAL_STATE_KEY);
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
const qaState=JSON.parse(JSON.stringify(DEFAULT_STATE));
qaState.settings={music:false,sfx:false,vibration:true};
Object.assign(qaState.player,{level:20,coins:12345,branches:4321,stone:123});
qaState.academyBuilderVersion=8;
qaState.academyBuildings=Object.fromEntries(TREEHOUSE_ROOM_CATALOG.map(room=>[room.id,{built:true,builtAt:'2026-09-06T12:00:00Z'}]));
qaState.flock=['Great Spotted Woodpecker','Carrion Crow','Hooded Crow','Common Kestrel'].map((sp,i)=>({id:'qa-'+i,species:sp,commonName:sp,rarity:'common',hp:400,maxHp:400,atk:45,def:45,spd:40+i*6,int:50,cha:50,stamina:70,level:5,hunger:100,energy:100,mood:100,health:100}));
localStorage.setItem('burbz_state',JSON.stringify(qaState));
Object.defineProperty(navigator,'vibrate',{configurable:true,value:ms=>{(window.qaHaptics ||= []).push(ms);return true;}});
"""
AFTER = """
setTimeout(()=>{
if(merlinTutActive)endMerlinTutorial(false);
switchScreen('birdex');
gameState.flock=gameState.flock.filter(b=>b.id.startsWith('qa-'));
openBirdEquip(gameState.flock[0].id);
BurbzAppearanceCore.apply(qaParams.get('theme'),document);
window.qaHaptics=[];
window.__testEval=code=>eval(code);
Object.assign(window,{$,renderBirdEquip,birdEquipNeighbour,gameState,birdEquipSwipe});
Object.defineProperty(window,'birdEquipState',{get:()=>birdEquipState});
Object.defineProperty(window,'birdEquipSwipeAnimating',{get:()=>birdEquipSwipeAnimating});
Object.defineProperty(window,'getBirdArtUrl',{get:()=>getBirdArtUrl,set:v=>getBirdArtUrl=v});
document.body.dataset.qaReady='true';
},1800);
"""

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        request_path = unquote(urlsplit(self.path).path)
        if request_path == '/burbz/after.html':
            html = (ROOT / 'index.html').read_text()
            marker = '\ninit();'
            assert marker in html
            data = html.replace(marker, SEED + '\n' + marker + '\n' + AFTER).encode()
            mime = 'text/html'
        elif request_path.startswith('/burbz/') and not request_path.endswith('/sw.js'):
            file = (ROOT / request_path.removeprefix('/burbz/')).resolve()
            if not file.is_relative_to(ROOT):
                self.send_error(404)
                return
            data = file.read_bytes() if file.is_file() else b''
            mime = mimetypes.guess_type(str(file))[0] or 'application/octet-stream'
            if not data or data.startswith(b'version https://git-lfs'):
                if ART_ORIGIN and any(x in request_path for x in ('/bird-art-cache/', '/assets/', '/vendor/')):
                    try:
                        with urlopen(ART_ORIGIN + request_path, timeout=20) as response:
                            data = response.read()
                            mime = response.headers.get('Content-Type', mime)
                    except Exception:
                        self.send_error(404)
                        return
                else:
                    self.send_error(404)
                    return
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass

if __name__ == '__main__':
    ThreadingHTTPServer(('127.0.0.1', int(os.environ.get('BURBZ_TEST_PORT', '8792'))), Handler).serve_forever()
