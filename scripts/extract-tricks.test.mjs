import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseMessages, sourceMessage, searchPages, verifyCandidate, run, mergeEntries } from './extract-tricks.mjs';
import { packCorpus, refreshCorpus } from './trick-docs.mjs';

const commit = 'a'.repeat(40), sourceCommit = 'b'.repeat(40);
const sourceText = '# public channel\n\n[2026-04-23T02:32:15+00:00] writer (id=123)\n    A serial getty connects the custom shell.\n\n[2026-04-24T00:00:00+00:00] other (id=456)\n    Unrelated advice.\n';
const source = sourceMessage(sourceText, '123');
const corpus = { version: 1, commit, pages: { 'website/docs/user-guide/cli.md': '# CLI\n\nThe CLI supports chat.' } };
const candidate = {
  id: 'trick-serial', title: 'A serial bridge', summary: 'A custom shell connects a serial device.',
  storyId: 'story-serial', author: '@writer', date: '2026-04-23', quote: 'A serial getty connects the custom shell.',
  explanation: 'Community-reported integration.', limitations: 'Requires custom hardware.', tags: ['creative'],
  url: `https://github.com/teknium1/nous-discord-archive/blob/${sourceCommit}/archives/channel.txt#L${source.start}-L${source.end}`,
  source: { repo: 'teknium1/nous-discord-archive', commit: sourceCommit, path: 'archives/channel.txt', messageId: '123' },
  searches: [['serial getty'], ['custom shell']],
  review: { commit, reason: 'Specific device bridge, not generic chat.', closestDocs: [{ path: 'website/docs/user-guide/cli.md', excerpt: 'The CLI supports chat.', distinction: 'Chat alone does not describe a serial bridge.' }] }
};
const stories = [{ id: 'story-serial', author: '@writer' }];
const pages = [{ url: 'https://hermes-agent.nousresearch.com/docs/user-guide/cli', path: 'website/docs/user-guide/cli.md', text: corpus.pages['website/docs/user-guide/cli.md'] }];
const context = { corpus, pages, stories, source };

test('Discord parser preserves message identity and line ranges without borrowing the next author', () => {
  const parsed = parseMessages(sourceText);
  assert.equal(parsed.length, 2);
  assert.equal(source.start, 3);
  assert.equal(source.end, 4);
  assert.equal(source.author, 'writer');
  assert.equal(source.text, candidate.quote);
  assert.throws(() => sourceMessage(sourceText, '999'), /Missing/);
  assert.throws(() => parseMessages('unexpected markup'), /shape changed/);
  assert.throws(() => sourceMessage(sourceText + sourceText.replace('custom shell', 'different shell'), '123'), /ambiguous/);
});

test('search checks prose and code, folds typography and catches combined concepts within paragraphs', () => {
  const docs = [{ ...pages[0], text: 'Use a **SERIAL**\ngetty with the `custom shell`.\n\nOther paragraph.' }];
  assert.equal(searchPages(docs, ['serial', 'custom shell']).length, 1);
  assert.equal(searchPages(docs, ['getty', 'other paragraph']).length, 0);
  assert.equal(searchPages([{ ...pages[0], text: 'target_type and budgeting' }], ['getty']).length, 0);
  assert.throws(() => searchPages(docs, ['']), /Empty search/);
});

test('a quote by another author, a wrong permalink or a documented mechanism cannot qualify', () => {
  assert.equal(verifyCandidate(candidate, context).searches.length, 2);
  assert.throws(() => verifyCandidate({ ...candidate, url: 'https://example.com/' }, context), /permalink/);
  assert.throws(() => verifyCandidate({ ...candidate, quote: 'Unrelated advice.' }, context), /Quote missing/);
  assert.throws(() => verifyCandidate(candidate, { ...context, source: { ...source, author: 'other' } }), /attribution/);
  assert.throws(() => verifyCandidate(candidate, { ...context, pages: [{ ...pages[0], text: candidate.quote }] }), /Documented/);
  assert.throws(() => verifyCandidate({ ...candidate, review: { ...candidate.review, commit: sourceCommit } }, context), /editorial review/);
  assert.throws(() => verifyCandidate({ ...candidate, review: { ...candidate.review, closestDocs: [{ ...candidate.review.closestDocs[0], excerpt: 'invented excerpt' }] } }, context), /Closest-doc/);
});

test('merge updates by id and preserves historical entries', () => {
  assert.deepEqual(mergeEntries([{ id: 'historical' }, { id: 'new', value: 1 }], [{ id: 'new', value: 2 }]), [{ id: 'historical' }, { id: 'new', value: 2 }]);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'hermes-tricks-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts')); await mkdir(join(root, 'data'));
  const json = (p, v) => writeFile(join(root, p), JSON.stringify(v, null, 2) + '\n');
  await json('scripts/trick-candidates.json', { version: 1, accepted: [candidate], rejected: [] });
  await writeFile(join(root, 'scripts/trick-docs.json.gz'), packCorpus(corpus));
  await json('scripts/prompt-excerpts.json', { source: 'hermes-agent.nousresearch.com', pages: { [pages[0].url]: { sections: [{ text: 'Ordinary chat instructions.' }], blocks: [] } } });
  await json('data/use-cases.json', { items: stories });
  await json('data/tricks.json', { note: 'Keep historical entries.', items: [] });
  const fetcher = async url => url.includes('/commits/main')
    ? { ok: true, json: async () => ({ sha: commit }) }
    : { ok: true, text: async () => sourceText };
  await run({ root, fetcher });
  return { root, json, fetcher };
}
const outputs = async root => Promise.all(['data/tricks.json', 'scripts/trick-evidence.json'].map(p => readFile(join(root, p), 'utf8')));

test('offline verification makes no network calls or writes and report mode is read-only', async t => {
  const { root, fetcher } = await fixture(t);
  const before = await outputs(root);
  await run({ root, offline: true, fetcher: () => assert.fail('Offline made a network call') });
  await run({ root, report: true, fetcher });
  assert.deepEqual(await outputs(root), before);
});

test('URL corruption, source failures and changed docs leave both last-good outputs untouched', async t => {
  const { root, json } = await fixture(t);
  const before = await outputs(root);
  await json('scripts/trick-candidates.json', { version: 1, accepted: [{ ...candidate, url: 'https://example.com/wrong' }], rejected: [] });
  await assert.rejects(run({ root, offline: true }), /permalink/);
  assert.deepEqual(await outputs(root), before);
  await json('scripts/trick-candidates.json', { version: 1, accepted: [candidate], rejected: [] });
  await assert.rejects(run({ root, fetcher: async () => ({ ok: false, status: 401 }) }), /401/);
  await assert.rejects(run({ root, fetcher: async () => ({ ok: true, json: async () => ({ sha: sourceCommit }) }) }), /revision changed/);
  await assert.rejects(run({ root, fetcher: async url => url.includes('/commits/main') ? { ok: true, json: async () => ({ sha: commit }) } : { ok: false, status: 404 } }), /Source HTTP 404/);
  assert.deepEqual(await outputs(root), before);
});

test('empty selections and missing historical provenance cannot erase a shelf', async t => {
  const { root, json } = await fixture(t);
  const before = await outputs(root);
  await json('scripts/trick-candidates.json', { version: 1, accepted: [], rejected: [] });
  await assert.rejects(run({ root, offline: true }), /No reviewed/);
  assert.deepEqual(await outputs(root), before);
  await json('scripts/trick-candidates.json', { version: 1, accepted: [candidate], rejected: [] });
  const shelf = JSON.parse(before[0]);
  shelf.items.push({ ...shelf.items[0], id: 'trick-historical' });
  await json('data/tricks.json', shelf);
  const historical = await outputs(root);
  await assert.rejects(run({ root, offline: true }), /Stored trick lacks reviewed provenance/);
  assert.deepEqual(await outputs(root), historical);
});

test('CLI exits non-zero for corrupted absence evidence and preserves bytes', async t => {
  const { root, json } = await fixture(t);
  const evidence = JSON.parse((await outputs(root))[1]);
  evidence.entries[0].searches[0].matches = [{ page: pages[0].url, excerpt: 'contradiction' }];
  await json('scripts/trick-evidence.json', evidence);
  const before = await outputs(root);
  for (const name of ['extract-tricks.mjs', 'trick-docs.mjs', 'json-format.mjs'])
    await cp(fileURLToPath(new URL(name, import.meta.url)), join(root, 'scripts', name));
  await writeFile(join(root, 'scripts/env.mjs'), '// No credentials in fixtures.\n');
  const result = spawnSync(process.execPath, [join(root, 'scripts/extract-tricks.mjs'), '--offline'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /evidence drifted/);
  assert.deepEqual(await outputs(root), before);
});

test('importing the extractor cannot fetch, load credentials, or rewrite shelves', async t => {
  const { root } = await fixture(t);
  const before = await outputs(root);
  for (const name of ['extract-tricks.mjs', 'trick-docs.mjs', 'json-format.mjs'])
    await cp(fileURLToPath(new URL(name, import.meta.url)), join(root, 'scripts', name));
  await writeFile(join(root, 'scripts/env.mjs'), "throw Error('credentials loaded during import');\n");
  const script = `globalThis.fetch = () => { throw Error('network during import'); }; await import(${JSON.stringify(join(root, 'scripts/extract-tricks.mjs'))});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await outputs(root), before);
});

test('a truncated upstream tree cannot create an incomplete absence corpus', async () => {
  await assert.rejects(refreshCorpus(corpus, async url => ({ ok: true, json: async () => url.includes('/commits/main') ? { sha: commit } : { truncated: true, tree: [] } })), /Incomplete/);
});

test('every shipped trick matches its attributed source and recomputed absence evidence offline', async () => {
  await run({ offline: true, fetcher: () => assert.fail('Shipped evidence verification must stay offline') });
});
