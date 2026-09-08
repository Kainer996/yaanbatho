"""Winning from the atlas must reveal the sanctuary/merge path on return."""
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
def fn(name):
 start=HTML.index('function '+name+'(')
 return HTML[start:HTML.index('\n}',start)+2]
def test_battle_return_leaves_atlas_and_towns_for_the_village_claim_action():
 source=fn('returnToLiberatedVillage')+fn('empireDefaultPage')+"""
let empirePageName='realm',empireLedgerOnlyMode=true,villageVisitingWard=true,villageActive=null,currentScreen='battle';
let empire={pendingLiberation:{seed:3,name:'Third Village',lat:53.35,lon:-1.78},villages:{1:{},2:{}}},gameState={empire},events=[],saved;
const ensureEmpireState=()=>empire,pendingEmpireLiberation=()=>empire.pendingLiberation,empireVillages=()=>Object.values(empire.villages);
const showEmpirePage=name=>{empirePageName=name;gameState.empirePage=name;};
const switchScreen=name=>{currentScreen=name;showEmpirePage(empireLedgerOnlyMode?'realm':empireDefaultPage());};
const saveState=()=>{saved=JSON.parse(JSON.stringify(gameState));},renderVillage=()=>events.push('render'),renderBattleSelect=()=>events.push('battle');
const setTimeout=fn=>fn(),$=id=>({scrollIntoView(){events.push(id);}});
returnToLiberatedVillage();console.log(JSON.stringify({page:empirePageName,ledger:empireLedgerOnlyMode,ward:villageVisitingWard,currentScreen,seed:villageActive.seed,pending:empire.pendingLiberation,saved,events}));
"""
 result=json.loads(subprocess.run(['node','-e',source],text=True,capture_output=True,check=True).stdout)
 assert result['page']=='villages'
 assert result['ledger'] is False and result['ward'] is False
 assert result['seed']==3 and result['pending'] is None
 assert result['saved']['lastVillage']['seed']==3
 assert result['saved']['empirePage']=='villages'
 assert 'villageClaimBar' in result['events']
