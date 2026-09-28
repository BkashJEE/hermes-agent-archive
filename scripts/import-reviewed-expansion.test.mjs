import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {planExpansion,importExpansion} from './import-reviewed-expansion.mjs';
const url='https://hermes-agent.nousresearch.com/docs/example#workflow';
const selection={shelf:'commands',item:{id:'test-command',title:'A command recipe',summary:'A useful recipe',detail:'Setup and limitations',author:'Nous Research',source:'docs',url,snippet:'hermes example'},evidence:['Run hermes example after setup.']};
const record={pages:{[url.split('#')[0]]:{fetchedAt:'2026-09-28T00:00:00Z',sections:[{anchor:'workflow',text:'Run hermes example after setup.'}],blocks:[{anchor:'workflow',text:'hermes example'}]}}};
const existing={commands:{items:[{id:'old',title:'Historical entry',url:'https://example.com',detail:'Preserved'}]}};
test('reviewed expansion is additive and preserves editorial changes on rerun',()=>{
 const result=planExpansion([selection],record,existing);assert.equal(existing.commands.items.length,1);assert.equal(result.shelves.commands.items.length,2);
 result.shelves.commands.items[1].detail='Reviewed local improvement';
 const repeated=planExpansion([selection],record,result.shelves);assert.deepEqual(repeated.added,{});assert.equal(repeated.shelves.commands.items[1].detail,'Reviewed local improvement');
});
test('reject missing evidence, changed links, duplicate titles, invented metrics and trick routing',()=>{
 for(const mutate of [s=>s.evidence=['A claim not found in the source.'],s=>s.item.url=url.replace('#workflow','#missing'),s=>s.item.snippet='invented command',s=>s.shelf='tricks',s=>s.item.metric={kind:'stars',value:123},s=>s.item.author='',s=>s.item.title='Historical entry']) {
  const s=structuredClone(selection);mutate(s);assert.throws(()=>planExpansion([s],record,existing));
 }
 assert.throws(()=>planExpansion([],record,existing));assert.throws(()=>planExpansion([selection,selection],record,existing));
});
test('a failed refresh or invalid selection leaves every data file unchanged',async t=>{
 const root=await mkdtemp(join(tmpdir(),'hermes-reviewed-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(join(root,'scripts'));await mkdir(join(root,'data'));
 await writeFile(join(root,'scripts/reviewed-expansion.json'),JSON.stringify({entries:[selection]}));await writeFile(join(root,'scripts/expansion-excerpts.json'),JSON.stringify(record));
 await writeFile(join(root,'data/index.json'),JSON.stringify({sections:[{id:'dashboard'},{id:'commands',file:'commands.json'}]}));
 const target=join(root,'data/commands.json'),original=JSON.stringify(existing.commands);await writeFile(target,original);
 await assert.rejects(importExpansion(root,{refresh:true,fetcher:async()=>({ok:false,status:503})}));assert.equal(await readFile(target,'utf8'),original);
 const broken=structuredClone(selection);broken.evidence=['Corrupted absence or provenance evidence'];await writeFile(join(root,'scripts/reviewed-expansion.json'),JSON.stringify({entries:[broken]}));
 await assert.rejects(importExpansion(root));assert.equal(await readFile(target,'utf8'),original);
});
test('all shipped expansion entries have valid cached source evidence',async()=>{
 const manifest=JSON.parse(await readFile(new URL('./reviewed-expansion.json',import.meta.url)));
 const evidence=JSON.parse(await readFile(new URL('./expansion-excerpts.json',import.meta.url)));
 const shelves=Object.fromEntries([...new Set(manifest.entries.map(x=>x.shelf))].map(s=>[s,{items:[]}]));
 assert.equal(Object.values(planExpansion(manifest.entries,evidence,shelves).added).reduce((a,b)=>a+b,0),manifest.entries.length);
});
test('a community report must retain its exact author, quote and comment URL',()=>{
 const url='https://www.reddit.com/r/hermesagent/comments/abc/comment/def/';
 const quote='I built a local dashboard with Hermes.';
 const item={id:'report',title:'Local dashboard',summary:'A community build',detail:quote,author:'u/builder',source:'reddit',url};
 const selection={shelf:'builds',item,evidence:[quote]};
 const record={pages:{[url]:{kind:'reviewed-public-comment',url,author:'u/builder',fetchedAt:'2026-09-28',sections:[{text:quote}],blocks:[]}}};
 assert.equal(planExpansion([selection],record,{builds:{items:[]}}).added.builds,1);
 for(const mutate of [x=>x.item.author='u/someoneelse',x=>x.item.url=url.replace('/def/','/other/'),x=>x.item.repo='org/repo',x=>x.item.detail='A claim without the attributed quote']) {
  const changed=structuredClone(selection);mutate(changed);assert.throws(()=>planExpansion([changed],record,{builds:{items:[]}}));
 }
});
