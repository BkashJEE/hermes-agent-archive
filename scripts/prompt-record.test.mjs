import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('failed prompt verification preserves the last good evidence record', async t => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-prompt-record-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts')); await mkdir(join(root, 'data'));
  await copyFile(new URL('./extract-prompts.mjs', import.meta.url), join(root, 'scripts/extract.mjs'));
  await writeFile(join(root, 'scripts/env.mjs'), '');
  const url = 'https://hermes-agent.nousresearch.com/docs/example';
  const target = join(root, 'scripts/prompt-excerpts.json');
  const original = JSON.stringify({ pages: { [url]: { anchors: ['example'], blocks: [{ anchor: 'example', text: 'Keep this prompt' }] } } });
  await writeFile(target, original);
  await writeFile(join(root, 'data/prompts.json'), JSON.stringify({ items: [{ id: 'example', url: url + '#example', snippet: 'Keep this prompt' }] }));
  const html = '<h2 id="example">Example</h2><p>The source no longer contains the prompt.</p>';
  for (const mock of [
    `globalThis.fetch=async()=>({ok:true,text:async()=>${JSON.stringify(html)}});`,
    'globalThis.fetch=async()=>{throw new Error("Unavailable")};'
  ]) {
    await writeFile(join(root, 'mock.mjs'), mock);
    const result = spawnSync(process.execPath, ['--import', join(root, 'mock.mjs'), join(root, 'scripts/extract.mjs')], { encoding: 'utf8' });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(await readFile(target, 'utf8'), original);
  }
});
