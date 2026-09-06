"""Resuming removed tutorial steps and interacting with locked dock slots."""
import json
import re
import subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text()

def function(name):
    start = HTML.index('function '+name+'(')
    return HTML[start:HTML.index('\n}', start)+2]

def run(code):
    result = subprocess.run(['node', '-e', code], text=True, capture_output=True, check=True)
    return json.loads(result.stdout)

def prelude():
    start = HTML.index('const MERLIN_LEGACY_STEP_CHAPTERS')
    end = HTML.index('\nfunction merlinChapterStepIndices', start)
    return HTML[start:end] + '\n' + function('merlinTutorialResumePosition')

def test_removed_rest_and_play_resume_at_quests_without_replaying_food():
    out = run(prelude() + """
const sequence = MERLIN_TUTORIAL_STEPS.map((s,i)=>s.chapterId==='story'?i:-1).filter(i=>i>=0);
const results = [7,8,9,10,11,12].map(currentStep => {
 const saved={status:'in_progress',mode:'story',careLessonVersion:1,currentStep};
 const snapshot=JSON.stringify(saved);
 const position=merlinTutorialResumePosition(saved,'story',sequence);
 return {id:MERLIN_TUTORIAL_STEPS[sequence[position]].id,unchanged:snapshot===JSON.stringify(saved)};
});console.log(JSON.stringify(results));
""")
    assert all(x == {'id':'lesson-12','unchanged':True} for x in out)

def test_stable_ids_resume_exactly_in_every_chapter_and_full_replay():
    out=run(prelude()+"""
const modes=['full',...new Set(MERLIN_TUTORIAL_STEPS.map(s=>s.chapterId))];
let checked=0,ok=true;
for(const mode of modes){
 const seq=MERLIN_TUTORIAL_STEPS.map((s,i)=>mode==='full'||s.chapterId===mode?i:-1).filter(i=>i>=0);
 seq.forEach((index,position)=>{checked++;ok &&= merlinTutorialResumePosition({status:'in_progress',mode,stepId:MERLIN_TUTORIAL_STEPS[index].id,currentStep:999,careLessonVersion:2},mode,seq)===position;});
}console.log(JSON.stringify({ok,checked}));
""")
    assert out['ok'] and out['checked'] >= 70

def test_every_legacy_position_reaches_next_surviving_lesson():
    out=run(prelude()+"""
const modes=['full',...new Set(MERLIN_LEGACY_STEP_CHAPTERS)];let ok=true,checked=0;
for(const mode of modes){
 const seq=MERLIN_TUTORIAL_STEPS.map((s,i)=>mode==='full'||s.chapterId===mode?i:-1).filter(i=>i>=0);
 const old=MERLIN_LEGACY_STEP_CHAPTERS.map((s,i)=>({s,i})).filter(x=>mode==='full'||x.s===mode);
 old.forEach((row,position)=>{checked++;const r=merlinTutorialResumePosition({status:'in_progress',mode,currentStep:position,careLessonVersion:1},mode,seq);const expected=seq.findIndex(i=>Number(MERLIN_TUTORIAL_STEPS[i].id.slice(7))>=row.i);ok &&= r===(expected<0?seq.length-1:expected);});
}console.log(JSON.stringify({ok,checked}));
""")
    assert out == {'ok':True,'checked':106}

def test_legacy_pre_care_insertion_save_also_moves_forward():
    out=run(prelude()+"""
const seq=MERLIN_TUTORIAL_STEPS.map((s,i)=>s.chapterId==='story'?i:-1).filter(i=>i>=0);
console.log(JSON.stringify(MERLIN_TUTORIAL_STEPS[seq[merlinTutorialResumePosition({status:'in_progress',mode:'story',currentStep:8},'story',seq)]].id));
""")
    assert out=='lesson-12'

def test_current_lesson_data_is_concise_and_has_no_rest_requirement():
    data=run(prelude()+'\nconsole.log(JSON.stringify(MERLIN_TUTORIAL_STEPS));')
    assert len(data)==36
    assert sum(len(x['text'].split()) for x in data)<=485
    assert all(len(x['text'].split())<=24 for x in data)
    assert not any(x.get('action',{}).get('event')=='merlin-rested' for x in data)
    assert not any(x.get('target')=='#merlinRestBtn' for x in data)

def test_locked_click_is_consumed_before_routes_for_pointer_and_keyboard():
    out=run(function('guardLockedDockClick')+"""
let unlocked=false,toasts=[],routes=0;const featureGateOpen=()=>unlocked;
const featureUnlockHint=k=>'Unlock '+k;const showToast=x=>toasts.push(x);
function click(kind,key){let stopped=false,prevented=false;const item={dataset:key==='kitchen'?{quickDestination:key}:{screen:key}};guardLockedDockClick({target:{closest:()=>item},detail:kind==='keyboard'?0:1,preventDefault(){prevented=true},stopImmediatePropagation(){stopped=true}});if(!stopped)routes++;return {stopped,prevented};}
const locked=[click('pointer','forge'),click('keyboard','forge'),click('pointer','kitchen')];unlocked=true;const open=click('keyboard','forge');console.log(JSON.stringify({locked,open,routes,toasts}));
""")
    assert all(x=={'stopped':True,'prevented':True} for x in out['locked'])
    assert out['open']=={'stopped':False,'prevented':False}
    assert out['routes']==1 and len(out['toasts'])==3

def test_rest_save_completes_story_on_quests_action_without_rest_event():
    out=run(prelude()+'\n'+function('burbzTutorialAction')+"""
const merlinTutSequence=MERLIN_TUTORIAL_STEPS.map((s,i)=>s.chapterId==='story'?i:-1).filter(i=>i>=0);
let merlinTutStep=merlinTutorialResumePosition({status:'in_progress',mode:'story',currentStep:9,careLessonVersion:1},'story',merlinTutSequence);
let merlinTutActive=true,merlinTutAwaitingAction=MERLIN_TUTORIAL_STEPS[merlinTutSequence[merlinTutStep]].action,completed=false;
const SFX={tap(){}};const setTimeout=fn=>fn();
function merlinTutClearAction(){merlinTutAwaitingAction=null;}
function endMerlinTutorial(value){completed=value;merlinTutActive=false;}
function merlinTutShowStep(){throw Error('Should complete the story');}
burbzTutorialAction('merlin-rested');const wrongEventDidNothing=!completed;
burbzTutorialAction('tab:quests');
console.log(JSON.stringify({wrongEventDidNothing,completed,active:merlinTutActive}));
""")
    assert out=={'wrongEventDidNothing':True,'completed':True,'active':False}
