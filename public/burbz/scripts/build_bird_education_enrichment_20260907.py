import json, pathlib, re, hashlib, argparse
parser=argparse.ArgumentParser(description='Build bounded, attributed education accounts from retrieved MediaWiki records.')
parser.add_argument('--records',type=pathlib.Path,required=True)
parser.add_argument('--output',type=pathlib.Path,required=True)
args=parser.parse_args()
records=json.loads(args.records.read_text())
supplements=json.loads((pathlib.Path(__file__).resolve().parent/'fixtures/bird-education-supplements-v366.json').read_text())
out=args.output
notes={
 'Feral Pigeon':'Feral pigeons descend from domestic Rock Doves (Columba livia). They are a feral form of that species, with variable plumage, rather than a separate wild species.',
 'Lesser Redpoll':'Lesser Redpoll is a traditional name for the cabaret form. The linked current account includes it within Redpoll (Acanthis flammea), so the longer account covers the combined species. BTO also now treats redpolls as one species.',
 'Arctic Redpoll':'Arctic or Hoary Redpoll is a traditional name for the pale northern redpoll forms. The linked current account includes them within Redpoll (Acanthis flammea), so the longer account covers the combined species. BTO also now treats redpolls as one species.',
 "Stejneger's Stonechat":"The name Stejneger's or Amur Stonechat refers here to stejnegeri. The linked account treats it as Saxicola maurus stejnegeri within Siberian Stonechat; other taxonomic treatments, including the cited BTO list, have treated it as a separate species. Its stated breeding range is eastern Siberia to Japan and Korea, with wintering in southern China and Indochina. The longer account covers Siberian Stonechat more broadly.",
 'Island Thrush':'The older name Island Thrush covered a much larger species complex. The stored scientific identity Turdus poliocephalus now refers specifically to the extinct Tasman Sea Island Thrush of Lord Howe and Norfolk Islands. This is a historical taxon account, not a description of a bird that can be found alive today.',
 'Purple Swamphen':'Purple Swamphen was formerly a broad species complex. This account follows the stored scientific identity Porphyrio porphyrio, now Western Swamphen. Other birds formerly included under Purple Swamphen have separate modern accounts.',
 'Eclectus Parrot':'This entry follows the stored scientific identity Eclectus polychloros, now called Papuan or Red-sided Eclectus. The broader Eclectus Parrot name has been used for several related species.',
 'Northern Goshawk':'This account follows Astur gentilis, the Eurasian Goshawk, previously included under Northern Goshawk. The American Goshawk now has a separate species account.',
 "Cabot's Tern":"The linked source spells this bird's scientific name Thalasseus acuflavidus. The older catalogue spelling acuflavida refers to the same named tern here.",
 'Musk Lorikeet':'The linked account uses Trichoglossus concinnus for Musk Lorikeet, formerly placed in Glossopsitta as G. concinna.',
 'White-winged Chough':'The source uses the scientific spelling Corcorax melanorhamphos; the older catalogue spelling melanoramphos is retained only as an education lookup reference.',
}
scientific={
 'Lesser Redpoll':'Acanthis flammea cabaret',
 'Arctic Redpoll':'Acanthis flammea (hornemanni and exilipes forms)',
 "Stejneger's Stonechat":'Saxicola maurus stejnegeri',
 "Cabot's Tern":'Thalasseus acuflavidus',
 'Musk Lorikeet':'Trichoglossus concinnus',
 'Chinese Goshawk':'Tachyspiza soloensis',
 'Chestnut-rumped Heathwren':'Hylacola pyrrhopygia',
 "Victoria's Riflebird":'Ptiloris victoriae',
 'White-lined Honeyeater':'Meliphaga albilineata',
 'Plum-headed Finch':'Emblema modestum',
 'Star Finch':'Emblema ruficauda',
 'White-winged Chough':'Corcorax melanorhamphos',
}
def tidy(text):
    text=re.sub(r'\(\s*;?\s*\)','',text)
    text=re.sub(r' +([,.;:])',r'\1',text)
    text=re.sub(r' {2,}',' ',text)
    return text.strip()
def bounded_overview(text):
    intro=re.split(r'\n\s*==',text,maxsplit=1)[0].strip()
    sentences=re.split(r'(?<=[.!?])\s+(?=[A-Z])',intro)
    selected=[]
    for sentence in sentences:
        if selected and len(' '.join(selected+[sentence]))>1400:break
        if len(sentence)>2200:continue
        selected.append(sentence)
        if len(' '.join(selected).split())>=120:break
    return tidy(' '.join(selected)) or tidy(intro.split('\n\n')[0])
def bounded_account(text):
    pieces=re.split(r'\n\s*(={2,})\s*([^=\n]+?)\s*\1\s*\n',text)
    intro=pieces[0].strip()
    sections=[]
    for i in range(1,len(pieces),3):
        heading=pieces[i+1].strip();body=pieces[i+2].strip()
        if re.search(r'references|external links|further reading|gallery|bibliography|notes|see also|citations|sources|footnotes',heading,re.I):continue
        if not body:continue
        rank=0 if re.search(r'description|appearance|identification',heading,re.I) else 1 if re.search(r'distribution|habitat|range',heading,re.I) else 2 if re.search(r'behavio|ecology|diet|feeding|food|breeding|reproduction|vocal|call|migration',heading,re.I) else 4 if re.search(r'taxonomy|systematic|subspecies',heading,re.I) else 3
        sections.append((rank,heading,body))
    intro_paragraphs=[tidy(p) for p in re.split(r'\n\s*\n',intro) if tidy(p)]
    chosen=[];size=0
    for p in intro_paragraphs:
        if size+len(p)>2100:break
        chosen.append(p);size+=len(p)+2
    if not chosen:chosen=[bounded_overview(text)];size=len(chosen[0])
    for _,heading,body in sorted(sections,key=lambda x:x[0]):
        paras=[];section_size=0
        for p in re.split(r'\n\s*\n',body):
            p=tidy(p)
            if not p:continue
            addition=len(p)+len(heading)+10
            if size+addition>5500 or (section_size and section_size+len(p)>1300):break
            if len(p)>2400:continue
            paras.append(p);size+=addition;section_size+=len(p)
        if paras:chosen.append('== '+heading+' ==\n'+'\n\n'.join(paras))
    result='\n\n'.join(chosen)
    assert len(result)<=5500,len(result)
    return result
data={}
for name,r in sorted(records.items()):
    extract=tidy(r['extract'])
    account=bounded_account(extract)
    overview=bounded_overview(extract)
    if len(overview.split()) < 40:
        for preferred in ('Description', 'Distribution and habitat', 'Behaviour', 'Ecology'):
            match=re.search(r'={2,}\s*'+preferred+r'\s*={2,}\s*\n([\s\S]*?)(?=\n\s*==|\Z)',extract,re.I)
            if match:
                paragraph=tidy(match.group(1).split('\n\n')[0])
                if paragraph and len(paragraph)<2000: overview+='\n\n'+paragraph
                if len(overview.split())>=40: break
    if len(overview.split()) < 40:
        for paragraph in re.split(r'\n\s*\n',account):
            paragraph=re.sub(r'^==[^\n]+==\n','',paragraph).strip()
            if paragraph and re.sub(r'\s+',' ',paragraph) not in re.sub(r'\s+',' ',overview) and len(paragraph)<1800:
                overview+='\n\n'+paragraph
            if len(overview.split())>=40:break
    note=notes.get(name)
    if note:overview=note+'\n\n'+overview
    revision='https://en.wikipedia.org/w/index.php?oldid='+str(r['revisionId'])
    sources=[{'label':'Wikipedia — '+r['pageTitle'],'url':r['url']},{'label':'Wikipedia revision · '+r['revisionTimestamp'][:10],'url':revision}]
    if name in ('Lesser Redpoll','Arctic Redpoll'):sources.append({'label':'BTO — Redpoll taxonomy','url':'https://www.bto.org/learn/about-birds/birdfacts/redpoll'})
    if name=="Stejneger's Stonechat":sources.append({'label':'BTO — British List taxonomy','url':'https://www.bto.org/learn/about-birds/british-list'})
    data[name]={'title':name,'scientificName':scientific.get(name,r['scientificName']),'requestedScientificName':r['scientificName'],'sourceTitle':r['pageTitle'],'summary':overview,'wikipediaExtract':account,'encyclopediaImport':True,'sources':sources,'wikipediaAttribution':{'source':r['url'],'pageTitle':r['pageTitle'],'pageid':r['pageid'],'revisionId':r['revisionId'],'revisionTimestamp':r['revisionTimestamp'],'revisionUrl':revision,'retrieved':r['retrieved'],'authors':'Wikipedia contributors','license':'CC BY-SA 4.0','licenseUrl':r['licenseUrl'],'changes':'Selected complete paragraphs and source sections; section order adjusted for field-guide reading; empty pronunciation marks removed. Summary is an excerpt, preceded by a taxonomy note where stated.'},'enrichmentReason':r['reasons']}
    if note:data[name]['taxonomyNote']=note
    if name in supplements:
        supplement=supplements[name]
        data[name].update(supplement['fields'])
        data[name]['sources'].append(supplement['source'])
        data[name]['fieldNotesProvenance']={'source':supplement['source']['url'],'fields':list(supplement['fields']),'reviewed':'2026-09-07','method':'Original concise paraphrases; these supplementary fields are separate from the Wikipedia excerpts.'}
    if r['scientificName'] != data[name]['scientificName'] and not note:
        note='The linked account uses '+data[name]['scientificName']+'; the stored catalogue name is '+str(r['scientificName'])+'. This education entry follows the same named bird in that source.'
        data[name]['taxonomyNote']=note
        data[name]['summary']=note+'\n\n'+data[name]['summary']
out.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'rows':len(data),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'maxAccountChars':max(len(r['wikipediaExtract']) for r in data.values()),'minAccountWords':min(len(r['wikipediaExtract'].split()) for r in data.values())}))
