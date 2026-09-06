"""Owned card art and body share the existing full card; controls stay independent."""
import json
import subprocess
from pathlib import Path
HTML=(Path(__file__).resolve().parents[1]/'index.html').read_text()
def test_real_card_handlers_open_one_full_card_and_preserve_dedicated_controls():
 start=HTML.index('function wireBirdexCardActions(');source=HTML[start:HTML.index('\n}',start)+2]
 code=source+"""
let opened=[],fed=[],flips=0;const handlers={};
const card={dataset:{birdId:'bird-1'},hasAttribute:()=>true,addEventListener:(k,f)=>handlers[k]=f,classList:{toggle(){flips++;}}};
const grid={querySelectorAll:()=>[card]},openBirdEquip=id=>opened.push(id),openFeedSheet=id=>fed.push(id);
wireBirdexCardActions(grid);
function click(action,control=false){let stopped=0;const target={closest:s=>s===`[data-action="${action}"]`?{dataset:{birdId:'bird-1',feedKey:'bird-1'}}:control&&s.startsWith('button,')?{}:null};handlers.click({target,stopPropagation(){stopped++}});return stopped;}
const body=click('body'),image=click('open-equip'),feed=click('feed-bird'),summary=click('body',true);
let prevented=0;handlers.keydown({target:card,key:'Enter',preventDefault(){prevented++},stopPropagation(){}});handlers.keydown({target:card,key:' ',preventDefault(){prevented++},stopPropagation(){}});handlers.keydown({target:{},key:'Enter'});
console.log(JSON.stringify({opened,fed,flips,body,image,feed,summary,prevented}));
"""
 out=json.loads(subprocess.run(['node','-e',code],capture_output=True,text=True,check=True).stdout)
 assert out=={'opened':['bird-1']*4,'fed':['bird-1'],'flips':0,'body':1,'image':1,'feed':1,'summary':0,'prevented':2}
 assert 'data-owned-bird-card tabindex="0" role="group"' in HTML
