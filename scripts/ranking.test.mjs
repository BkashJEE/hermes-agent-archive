import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mergeLive } from '../assets/js/archive.js';
import { MODEL, RANKING_VERSION, attachRankings, compareRankings, inputKey, validAssessment } from '../assets/js/ranking.js';

const item = (id, usefulness, popularity = 'unknown') => ({ id, title: id, source: 'reddit',
  ranking: { usefulness, popularity } });

test('API merging preserves seeded write-ups across all shelves, including unresolved repos', () => {
  const data = { toolkit: [{ id: 'tool', repo: 'org/tool', title: 'Tool', summary: 'Curated explanation', detail: 'Setup steps', url: 'https://github.com/org/tool' }],
    builds: [{ id: 'missing', repo: 'org/missing', title: 'Unresolved tool', metric: { kind: 'stars', value: 999 } }] };
  mergeLive(data, { github: [{ repo: 'org/tool', description: 'API one-liner', stars: 51, forks: 2, url: 'https://github.com/org/tool' }],
    routed: { builds: [{ id: 'duplicate', url: 'https://github.com/org/tool' }] } });
  assert.equal(data.toolkit[0].summary, 'Curated explanation');
  assert.equal(data.toolkit[0].metric.value, 51);
  assert.equal(data.builds.length, 1);
  assert.equal(data.builds[0].id, 'missing');
  assert.equal(data.builds[0].metric, undefined);
});

test('GitHub cutoff excludes 0–50 stars across seeds, URL entries and routed shelves', () => {
  const data = { builds: [], toolkit: [
    { id: 'zero', repo: 'org/zero' }, { id: 'fifty', repo: 'org/fifty' },
    { id: 'url-only', url: 'https://github.com/ORG/fifty/issues/1' },
    { id: 'qualifies', repo: 'org/qualifies' }, { id: 'unknown', repo: 'org/unknown' }
  ] };
  const live = { github: [
    { repo: 'org/zero', stars: 0 }, { repo: 'org/fifty', stars: 50 },
    { repo: 'org/qualifies', stars: 51 }
  ], routed: { builds: [
    { id: 'routed-low', source: 'github', url: 'https://github.com/org/low', metric: { kind: 'stars', value: 49 } },
    { id: 'routed-fifty', source: 'github', metric: { kind: 'stars', value: 50 } },
    { id: 'routed-high', source: 'github', metric: { kind: 'stars', value: 51 } },
    { id: 'routed-unknown', source: 'github' },
    { id: 'routed-null', source: 'github', metric: { kind: 'stars', value: null } },
    { id: 'reddit', source: 'reddit', metric: { kind: 'upvotes', value: 5 } }
  ] } };
  const stored = structuredClone(data), snapshot = structuredClone(live);
  mergeLive(data, live);
  assert.deepEqual(data.toolkit.map(x => x.id), ['qualifies', 'unknown']);
  assert.deepEqual(data.builds.map(x => x.id), ['routed-high', 'routed-unknown', 'routed-null', 'reddit']);
  assert.deepEqual(live, snapshot);
  live.github.find(x => x.repo === 'org/fifty').stars = 51;
  mergeLive(stored, live);
  assert.ok(stored.toolkit.some(x => x.id === 'fifty'));
  assert.ok(stored.toolkit.some(x => x.id === 'url-only'));
});

test('unrouted GitHub discoveries obey the same cutoff', () => {
  const data = { builds: [] };
  mergeLive(data, { github: [0, 50, 51].map(stars => ({
    repo: `org/repo-${stars}`, stars, discovered: true, url: `https://github.com/org/repo-${stars}`
  })) });
  assert.deepEqual(data.builds.map(x => x.metric.value), [51]);
});

test('unavailable API snapshots cannot expose curated engagement figures', () => {
  const data = { builds: [{ id: 'a', metric: { kind: 'views', value: 100 }, metric2: { kind: 'likes', value: 10 } }] };
  mergeLive(data, null);
  assert.equal(data.builds[0].metric, undefined);
  assert.equal(data.builds[0].metric2, undefined);
});

test('usefulness leads by default; public popularity breaks band ties', () => {
  const useful = item('Useful', 4), popular = item('Popular', 2, 'widespread');
  assert.ok(compareRankings(useful, popular) < 0);
  assert.ok(compareRankings(useful, popular, 'popular') > 0);
  assert.ok(compareRankings(item('A', 3.9), item('B', 3.7, 'strong')) > 0);
});

test('unknown popularity and unclassified entries are explicit, stable fallbacks', () => {
  assert.ok(compareRankings(item('A', 4), item('B', 2, 'limited'), 'popular') > 0);
  const a = { id: 'a', title: 'Alpha', date: '2000-01-01' };
  const b = { id: 'b', title: 'Beta', date: '2099-01-01' };
  assert.ok(compareRankings(a, b) < 0);
  assert.ok(compareRankings(a, item('Z', 0)) > 0);
  assert.ok(compareRankings({ ...item('Alpha', 3), date: b.date }, { ...item('Beta', 3), date: a.date }) < 0);
});

test('dates and imported attribution cannot affect cache keys', async () => {
  const a = { id: 'a', title: 'Workflow', source: 'reddit', author: 'alice', date: '2020-01-01', detail: 'Useful steps.\n\n— alice, 2020-01-01, via Reddit.' };
  const b = { ...a, date: '2099-01-01', detail: a.detail.replace('2020', '2099') };
  assert.equal(await inputKey(a), await inputKey(b));
  assert.notEqual(await inputKey(a), await inputKey({ ...a, summary: 'Changed substance' }));
  assert.notEqual(await inputKey(a), await inputKey({ ...a, metric: { kind: 'upvotes', value: 10 } }));
});

test('missing, malformed, or stale classifications are never attached', async () => {
  const a = { id: 'a', title: 'Alpha', source: 'reddit' };
  const r = { input: await inputKey(a), usefulness: 3, popularity: 'unknown', confidence: 0.9 };
  const file = { model: MODEL, version: RANKING_VERSION, results: { a: r } };
  await attachRankings([a], file);
  assert.equal(a.ranking, r);
  a.title = 'Changed';
  await attachRankings([a], file);
  assert.equal(a.ranking, undefined);
  await attachRankings([a], null);
  assert.equal(a.ranking, undefined);
  for (const bad of [{ usefulness: 5 }, { popularity: 'viral' }, { confidence: NaN }, { input: '' }])
    assert.equal(Boolean(validAssessment({ ...r, ...bad })), false);
});

test('every shipped classification matches the rendered archive and its public evidence', async () => {
  const read = async file => JSON.parse(await readFile(new URL(`../data/${file}`, import.meta.url), 'utf8'));
  const cfg = await read('index.json'), data = {};
  for (const section of cfg.sections.filter(s => s.file)) {
    data[section.id] = (await read(section.file)).items;
    for (const entry of data[section.id]) { delete entry.metric; delete entry.metric2; }
  }
  mergeLive(data, await read('live.json'));
  const entries = Object.values(data).flat();
  await attachRankings(entries, await read('rankings.json'));
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(entry.ranking, `Missing or stale: ${entry.id}`);
    if (!entry.metric && !entry.metric2) assert.equal(entry.ranking.popularity, 'unknown', entry.id);
  }
});

test('auth failures and malformed API responses preserve the last good rankings', async () => {
  const file = new URL('../data/rankings.json', import.meta.url);
  const before = await readFile(file, 'utf8');
  const temp = await mkdtemp(join(tmpdir(), 'hermes-ranking-test-'));
  try {
    const mock = join(temp, 'mock.mjs');
    for (const response of ['new Response("", {status:401})', 'Response.json({answers:{}})']) {
      await writeFile(mock, `globalThis.fetch = async () => ${response};`);
      const run = spawnSync(process.execPath, ['--import', pathToFileURL(mock).href,
        new URL('./rank-archive.mjs', import.meta.url).pathname, '--force'],
      { encoding: 'utf8', env: { ...process.env, TYPESAFE_API_KEY: 'test-only-placeholder' } });
      assert.equal(run.status, 1, run.stderr);
      assert.match(run.stderr, /Existing rankings are untouched/);
      assert.equal(await readFile(file, 'utf8'), before);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
