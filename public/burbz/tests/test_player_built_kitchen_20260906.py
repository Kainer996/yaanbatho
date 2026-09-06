"""Fresh construction, legacy ownership, one-time funding and real completion."""
import json
import re
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()

def function(name):
    start=HTML.index('function '+name+'(')
    return HTML[start:HTML.index('\n}',start)+2]

def run(code):
    return json.loads(subprocess.run(['node','-e',code],cwd=ROOT,text=True,capture_output=True,check=True).stdout)

def harness():
    return """
const rooms=require('./academy_treehouse_core.js').getAcademyRooms();
const ACADEMY_BUILDINGS=Object.fromEntries(rooms.map(r=>[r.id,{...r,room:r.id}]));
const ACADEMY_ROOMS=Object.fromEntries(rooms.map(r=>[r.id,{buildingId:r.id}]));
let gameState={player:{level:1,coins:0,branches:0},academyBuildings:{outdoors:{built:true}},academyBuilderVersion:8,flock:[],tutorialFlow:{}};
let academySelectedRoom='outdoors',events=[],saved=0;
const FIRST_RECRUIT_MAX_COST=110,SFX={build(){}};
const setTimeout=()=>{},showToast=()=>{},saveState=()=>saved++,updateHeader=()=>{},renderAcademy=()=>{},updateQuestProgress=()=>{},queueCompletionNotice=()=>{},showResourceQuestPrompt=()=>{},goalWithThe=x=>x;
const playerBranches=()=>gameState.player.branches,addCoins=x=>gameState.player.coins+=x,addBranches=x=>gameState.player.branches+=x;
const burbzTutorialAction=event=>events.push({event,built:!!gameState.academyBuildings.kitchen?.built});
"""+'\n'.join(function(n) for n in ['isAcademyBuildingBuilt','isAcademyRoomBuilt','ensureAcademyBuildings','academyBuildingProgressLock','academyBuildBuilding','tutorialFlowState','maybeGrantMerlinKitchenGift'])

def test_new_default_stays_unbuilt_and_legacy_kitchens_keep_ownership():
    defaults=re.search(r"  academyBuildings: (.*), // New players",HTML).group(1)
    version=re.search(r"  academyBuilderVersion: (\d+)",HTML).group(1)
    result=run(harness()+f"\ngameState.academyBuildings={defaults};gameState.academyBuilderVersion={version};"+"""
ensureAcademyBuildings();const fresh=!isAcademyBuildingBuilt('kitchen');
gameState.academyBuilderVersion=6;ensureAcademyBuildings();const legacy=isAcademyBuildingBuilt('kitchen');
gameState.academyBuildings.kitchen={built:true,builtAt:'player-date',x:17,y:29};gameState.academyBuilderVersion=7;ensureAcademyBuildings();
const snapshot=JSON.stringify(gameState);ensureAcademyBuildings();console.log(JSON.stringify({fresh,legacy,owned:gameState.academyBuildings.kitchen,stable:snapshot===JSON.stringify(gameState)}));
""")
    assert result=={'fresh':True,'legacy':True,'owned':{'built':True,'builtAt':'player-date','x':17,'y':29},'stable':True}

def test_gift_and_real_construction_are_once_only_and_require_barracks():
    result=run(harness()+"""
maybeGrantMerlinKitchenGift();const beforeBarracks={...gameState.player};
const early=academyBuildBuilding('kitchen');
gameState.academyBuildings.tavern={built:true};maybeGrantMerlinKitchenGift();maybeGrantMerlinKitchenGift();
const funded={...gameState.player};const built=academyBuildBuilding('kitchen',{position:{x:40,y:52}});const spent={...gameState.player};
maybeGrantMerlinKitchenGift();academyBuildBuilding('kitchen',{position:{x:60,y:52}});
console.log(JSON.stringify({beforeBarracks,early,funded,built,spent,after:gameState.player,events,position:gameState.academyBuildings.kitchen.x}));
""")
    assert result['early'] is False and result['beforeBarracks']=={'level':1,'coins':0,'branches':0}
    assert result['funded']=={'level':1,'coins':130,'branches':25}
    assert result['built'] is True and result['spent']=={'level':1,'coins':0,'branches':0}
    assert result['after']==result['spent'] and result['position']==60
    assert result['events']==[{'event':'kitchen-built','built':True}]

def test_unaffordable_build_emits_no_completion_and_spends_nothing():
    result=run(harness()+"""
gameState.academyBuildings.tavern={built:true};gameState.player.coins=129;gameState.player.branches=25;
const before=JSON.stringify(gameState);const built=academyBuildBuilding('kitchen');console.log(JSON.stringify({built,unchanged:before===JSON.stringify(gameState),events}));
""")
    assert result=={'built':False,'unchanged':True,'events':[]}

def test_kitchen_quest_precedes_recruitment_and_measures_actual_build():
    assert HTML.index("{ id:'pq_build_barracks'") < HTML.index("{ id:'pq_build_kitchen'") < HTML.index("{ id:'pq_recruit'")
    pos=HTML.index("{ id:'pq_build_kitchen'")
    assert "measure:() => isAcademyBuildingBuilt('kitchen') ? 1 : 0" in HTML[pos:pos+400]
    assert "id:'kitchen-build-v354'" in HTML
    assert "step.action?.event === 'kitchen-built'" in function('merlinTutShowStep')

def test_construction_lesson_cannot_advance_before_actual_build():
    result=run(function('merlinTutAdvance')+"""
let merlinTutActive=true,merlinTutAwaitingAction=null,merlinTutStep=0,merlinTutSequence=[0,1],built=false,next=0;
const merlinTutCurrentStep=()=>({action:{event:'kitchen-built'}}),isAcademyBuildingBuilt=()=>built,SFX={tap(){}},merlinTutClearAction=()=>{},merlinTutShowStep=()=>next++,$=()=>({style:{display:''}});
merlinTutAdvance();const before=next;built=true;merlinTutAdvance();console.log(JSON.stringify({before,after:next}));
""")
    assert result=={'before':0,'after':1}
