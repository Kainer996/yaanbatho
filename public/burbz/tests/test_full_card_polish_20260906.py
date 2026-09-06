"""Rendered full-card identity, gear selection and bond controls remain real."""
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
def fn(name):
 i=HTML.index('function '+name+'(');return HTML[i:HTML.index('\n}',i)+2]
def test_renderer_keeps_item_art_stats_picker_and_preen_gating():
 code=fn('birdEquipPlaceholderIcon')+fn('renderBirdEquip')+"""
const L=require('./loot_crafting_core.js'),window={BurbzLootCore:L},lootCore=()=>L;
const body={innerHTML:''},$=()=>body;
const bird={id:'robin',commonName:'Robin',species:'Robin',scientificName:'Erithacus rubecula',level:3,xp:40,power:162,rarity:'common',maxHp:70,atk:26,mag:68,def:44,spd:50,bond:{}};
const gameState={flock:[bird],inventory:{gear:{thorn_talons:1}}};
const birdEquipState={birdId:'robin',slotPicker:'weapon'},loadout={weapon:'thorn_talons'};
const birdLoadout=()=>loadout,birdGearBonuses=()=>({atk:12}),RARITY_COLORS={common:'#aaa'},getBirdArtUrl=()=>'/original-robin.png';
const escapeHtml=s=>s,birdIsFavourite=()=>false,birdDisplayName=b=>b.commonName,birdSpeciesLabel=b=>b.species,XP_PER_LEVEL=()=>200;
let canPreen=true;const birdBondCore=()=>({MAX_BOND_LEVEL:5,bondProgress:()=>({level:1,pct:20,xp:20,next:100,title:'New friend'}),canPreen:()=>({ok:canPreen,remainingMs:20}),describeWait:()=> '20 min'});
const ensureBirdBond=()=>{},EQUIP_SLOT_ORDER=['weapon','armour','trinket','spell','potion'];
const FORGE_SLOT_META=Object.fromEntries(EQUIP_SLOT_ORDER.map(s=>[s,{label:s,hint:'Choose gear',empty:'OLD'}]));
const gearIconHTML=i=>'<img data-equipped="'+i.id+'">',forgeGearStatLine=()=>'+12 ATK',birdEquipRoster=()=>[bird];
renderBirdEquip();const ready=body.innerHTML;canPreen=false;renderBirdEquip();console.log(JSON.stringify({ready,waiting:body.innerHTML}));
"""
 out=json.loads(subprocess.run(['node','-e',code],cwd=ROOT,text=True,capture_output=True,check=True).stdout)
 assert '/original-robin.png' in out['ready'] and 'Erithacus rubecula' in out['ready']
 assert 'data-equipped="thorn_talons"' in out['ready']
 assert 'assets/bird-card/weapon.webp' not in out['ready']
 for slot in ['armour','trinket','spell','potion','preen']:
  assert 'assets/bird-card/'+slot+'.webp' in out['ready']
 assert "birdEquipSet('weapon','thorn_talons')" in out['ready'] and "birdEquipClear('weapon')" in out['ready']
 assert 'aria-expanded="true"' in out['ready'] and 'id="birdEquipSlotPicker"' in out['ready']
 assert 'onclick="birdEquipPreen()"' in out['ready']
 assert 'onclick="birdEquipPreen()"' not in out['waiting'] and 'disabled' in out['waiting']
 assert '26 <span class="bes-boost">+12</span>' in out['ready']
 assert 'aria-valuenow="20"' in out['ready']
