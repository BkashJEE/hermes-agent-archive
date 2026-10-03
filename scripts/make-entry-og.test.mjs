import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, generate, entryHTML } from './make-entry-og.mjs';
import { agentFor, snippetLabel } from '../assets/js/directory.js';

function png() {
  const data = Buffer.alloc(1100);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(data);
  data.writeUInt32BE(1200, 16); data.writeUInt32BE(630, 20);
  return data;
}
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'entry-og-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const folder of ['data', 'assets/css', 'out']) await mkdir(join(root, folder), { recursive: true });
  await writeFile(join(root, 'data/index.json'), JSON.stringify({ sections: [{ id: 'prompts', label: 'Prompts', file: 'prompts.json' }] }));
  await writeFile(join(root, 'data/prompts.json'), JSON.stringify({ items: ['one', 'two'].map(id => ({ id, title: id, source: 'x', author: '@person' })) }));
  await writeFile(join(root, 'assets/css/style.css'), ':root { --bg: black; }');
  await writeFile(join(root, 'assets/entry-og-template.html'), '<!--TOKENS--><!--TITLE-->');
  return { root, outDir: join(root, 'out'), ids: ['one', 'two'], missing: false };
}

test('OG CLI requires deliberate scope and refuses paths/unknown options', () => {
  assert.throws(() => parseArgs([]), /Supply entry ids/);
  for (const arg of ['../../secret', '--all', 'id/file']) assert.throws(() => parseArgs([arg]), /Invalid/);
  assert.throws(() => parseArgs(['--missing', '--out-dir']), /needs a path/);
  assert.deepEqual(parseArgs(['one', 'one', '--missing']).ids, ['one']);
});

test('unknown id fails before rendering or overwriting earlier requested cards', async t => {
  const f = await fixture(t);
  await writeFile(join(f.outDir, 'one.png'), 'keep me');
  await assert.rejects(generate({ ...f, ids: ['one', 'absent'] }, { root: f.root, render: () => assert.fail('must not render') }), /Unknown entry/);
  assert.equal(await readFile(join(f.outDir, 'one.png'), 'utf8'), 'keep me');
});

test('a failed later render preserves every existing card and cleans staging', async t => {
  const f = await fixture(t);
  await writeFile(join(f.outDir, 'one.png'), 'previous version');
  let calls = 0;
  await assert.rejects(generate(f, { root: f.root, render: async (_, output) => {
    if (++calls === 2) throw new Error('Chromium failed');
    await writeFile(output, png());
  } }), /Chromium failed/);
  assert.equal(await readFile(join(f.outDir, 'one.png'), 'utf8'), 'previous version');
  assert.deepEqual(await readdir(f.outDir), ['one.png']);
});

test('--missing skips valid outputs and repairs malformed ones', async t => {
  const f = await fixture(t);
  await writeFile(join(f.outDir, 'one.png'), png());
  await writeFile(join(f.outDir, 'two.png'), 'broken');
  const outputs = [];
  await generate({ ...f, missing: true }, { root: f.root, render: async (_, output) => { outputs.push(output); await writeFile(output, png()); } });
  assert.equal(outputs.length, 1);
  assert.match(outputs[0], /two.png$/);
  assert.deepEqual(await readFile(join(f.outDir, 'one.png')), png());
});

test('dry run reports the complete corpus without creating output', async t => {
  const f = await fixture(t);
  const result = await generate({ ...f, ids: [], missing: true, dryRun: true }, { root: f.root, render: () => assert.fail('must not render') });
  assert.equal(result.count, 2);
  assert.deepEqual(await readdir(f.outDir), []);
});

test('OG content is escaped and identity is independent of the visual system', () => {
  const item = { title: '<script>alert(1)</script><!--AGENT-->', author: 'A & B', source: 'docs', agent: 'Another agent' };
  const html = entryHTML('<!--TITLE-->|<!--CREDIT-->|<!--AGENT-->|<!--SHELF-->', '', { item, section: { id: 'prompts', label: 'Prompts' } });
  assert.equal(html, '&lt;script&gt;alert(1)&lt;/script&gt;&lt;!--AGENT--&gt;|By A &amp; B|Another agent|Prompts');
  assert.equal(agentFor({}), 'Hermes');
  assert.equal(agentFor(item), 'Another agent');
  assert.equal(snippetLabel({ snippet: '  ' }), null);
  assert.equal(snippetLabel({ snippet: 'text', tags: ['prompt'] }), 'Copyable prompt');
});
