import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeSubmissions, importSubmissions } from './import-community-submissions.mjs';

const entry = {id:'community-test',title:'Command Center',summary:'Inspect Hermes activity',detail:'Uses the Hermes Desktop SDK.',author:'Cliff Wade',source:'github',url:'https://github.com/CliffWade/hermes-command-center'};
test('reviewed import is additive and idempotent, preserving archived wording', () => {
  const old = {items:[{id:'old',title:'Older entry',summary:'Keep me'}]};
  const manifest = {items:[entry]};
  const imported = mergeSubmissions(old,manifest);
  assert.equal(imported.items.length,2);
  assert.deepEqual(imported.items[0],old.items[0]);
  assert.equal(old.items.length,1);
  assert.deepEqual(mergeSubmissions(imported,{items:[{...entry,summary:'New wording'}]}),imported);
});
test('reviewed import rejects unknown repos, attribution gaps and invented metrics', () => {
  for(const bad of [{...entry,url:'https://github.com/CliffWade/other'}, {...entry,author:''}, {...entry,metric:{kind:'stars',value:100}}, {...entry,url:'javascript:alert(1)'}])
    assert.throws(()=>mergeSubmissions({items:[]},{items:[bad]}));
  assert.throws(()=>mergeSubmissions({items:[]},{items:[]}));
  assert.throws(()=>mergeSubmissions({items:[]},{items:[entry,entry]}));
});
test('a bad manifest preserves the existing file byte-for-byte', async () => {
  const dir=await mkdtemp(join(tmpdir(),'archive-submissions-'));
  try {
    await mkdir(join(dir,'data')); await mkdir(join(dir,'scripts'));
    const original='{"items":[]}\n';
    await writeFile(join(dir,'data/builds.json'),original);
    await writeFile(join(dir,'scripts/community-submissions.json'),JSON.stringify({items:[{...entry,url:'https://github.com/CliffWade/unapproved'}]}));
    await assert.rejects(importSubmissions(pathToFileURL(dir+'/')));
    assert.equal(await readFile(join(dir,'data/builds.json'),'utf8'),original);
  } finally {await rm(dir,{recursive:true,force:true});}
});
