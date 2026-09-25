import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, copyFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'hermes-stories-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'scripts')); await mkdir(join(root,'data'));
  await copyFile(new URL('./import-hermes-stories.mjs',import.meta.url),join(root,'scripts/import.mjs'));
  await writeFile(join(root,'scripts/env.mjs'),'');
  const original=JSON.stringify({items:[{id:'archived-story',title:'Retained historical entry',cardPoints:['Keep editorial work']}]})+'\n';
  await writeFile(join(root,'data/use-cases.json'),original);
  return {root,original,target:join(root,'data/use-cases.json')};
}
const tile=i=>`<a class="tile_test" href="https://example.com/${i}"><span class="sourceBadge_test">Reddit</span><span class="catTag_test">Research</span><h3 class="headline_test">Example ${i}</h3><p class="quote_test">A quoted workflow.</p><span class="author_test">u/example · 2026-09-25</span></a>`;
async function run(root,html) {
  await writeFile(join(root,'mock.mjs'),`globalThis.fetch=async()=>({ok:true,text:async()=>${JSON.stringify(html)}});`);
  return spawnSync(process.execPath,['--import',join(root,'mock.mjs'),join(root,'scripts/import.mjs')],{encoding:'utf8'});
}
test('stories importer runs and retains historical records when refreshing',async t=>{
  const {root,target}=await fixture(t);
  const html=Array.from({length:50},(_,i)=>tile(i)).join('').replace('Example 0','Example 0 (794 upvotes)');
  const result=await run(root,html);
  assert.equal(result.status,0,result.stderr);
  const first=JSON.parse(await readFile(target,'utf8')).items;
  assert.equal(first.length,51); assert.deepEqual(first[0].cardPoints,['Keep editorial work']);
  assert.match(first[1].credit,/Nous Research/); assert.equal(first[1].metric,undefined);
  assert.equal(first[1].author,'u/example'); assert.equal(first[1].url,'https://example.com/0');
  assert.equal((await run(root,html)).status,0);
  assert.deepEqual(JSON.parse(await readFile(target,'utf8')).items,first);
});
test('a malformed tile or archive aborts without changing the last good file',async t=>{
  const {root,target,original}=await fixture(t);
  const html=Array.from({length:50},(_,i)=>tile(i)).join('');
  let result=await run(root,html+'<a class="tile_changed" href="https://example.com/broken"></a>');
  assert.notEqual(result.status,0); assert.equal(await readFile(target,'utf8'),original);
  await writeFile(target,'{"items":null}');
  result=await run(root,html);
  assert.notEqual(result.status,0); assert.equal(await readFile(target,'utf8'),'{"items":null}');
});
