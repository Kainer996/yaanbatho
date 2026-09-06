"""Explicit free-village CTA launches combat instead of merely visiting."""
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
def fn(name):
 s=HTML.index('function '+name+'(');return HTML[s:HTML.index('\n}',s)+2]
def run(code):
 return json.loads(subprocess.run(['node','-e',code],text=True,capture_output=True,check=True).stdout)
def test_frontier_cta_preserves_real_target_and_launches_merlin_with_ready_companions():
 out=run(fn('beginVillageLiberation')+fn('startVillageLiberationBattle')+fn('openEmpireFrontier')+"""
const empire={liberationVictories:{},pendingLiberation:null},ensureEmpireState=()=>empire;
const village={seed:12,name:'Pinefall',lat:51,lon:-1},empireFrontierVillages=[village];
const window={BurbzEmpireMapCore:{validClaim:v=>v.lat===51&&v.lon===-1}};
const normaliseVillageCoordinate=x=>x,saveState=()=>{},showToast=()=>{},renderBattleSelect=()=>{};
let screens=[],starts=0,visits=0,battleSelectedIds=[];
const switchScreen=s=>screens.push(s),enterVillage=()=>visits++,empireOwnsVillage=()=>false,empireHasLiberationVictory=()=>false;
const getBattleFlock=()=>[{id:'merlin',power:1},{id:'ready',power:4},{id:'hungry',power:9},{id:'busy',power:10}];
const birdBattleAvailable=b=>b.id!=='busy',birdBattleReady=b=>b.id!=='hungry',isMerlinCompanion=b=>b.id==='merlin';
const startPerchBattle=()=>starts++;
openEmpireFrontier(12);openEmpireFrontier(999);
console.log(JSON.stringify({screens,starts,visits,team:battleSelectedIds,pending:empire.pendingLiberation,victories:empire.liberationVictories}));
""")
 assert out['screens']==['battle'] and out['starts']==1 and out['visits']==0
 assert out['team']==['merlin','ready'] and out['victories']=={}
 assert {k:out['pending'][k] for k in ('seed','name','lat','lon')}=={'seed':12,'name':'Pinefall','lat':51,'lon':-1}
def test_invalid_or_already_free_target_cannot_launch_or_award_victory():
 out=run(fn('beginVillageLiberation')+fn('startVillageLiberationBattle')+"""
const empire={liberationVictories:{},pendingLiberation:null},ensureEmpireState=()=>empire;
const window={BurbzEmpireMapCore:{validClaim:()=>false}},showToast=()=>{};
let owned=false,visits=0,starts=0;const empireOwnsVillage=()=>owned,empireHasLiberationVictory=()=>false,enterVillage=()=>visits++,startPerchBattle=()=>starts++;
const invalid=startVillageLiberationBattle({seed:12});owned=true;const free=startVillageLiberationBattle({seed:12});
console.log(JSON.stringify({invalid,free,visits,starts,empire}));
""")
 assert out=={'invalid':False,'free':False,'visits':1,'starts':0,'empire':{'liberationVictories':{},'pendingLiberation':None}}
def test_player_quest_go_reuses_the_liberation_path():
 assert "if (q.id === 'pq_liberate') { startVillageLiberationBattle(currentVillage()); return; }" in fn('playerQuestGo')
 assert 'completeEmpireLiberationVictory' not in fn('startVillageLiberationBattle')
 assert 'updateQuestProgress' not in fn('startVillageLiberationBattle')
