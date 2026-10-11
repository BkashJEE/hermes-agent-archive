import { test } from 'node:test';
import assert from 'node:assert/strict';
import { problemsIn } from './deploy-manifest-check.mjs';
import { verify } from './verify-live.mjs';

const need = { files: ['index.html', 'data/index.json', 'data/skills.json', 'sitemap.xml'], entries: 2 };

test('a deploy missing its data is refused before upload', () => {
  // The `.vercelignore` trailing-slash incident: the site shipped with no data files.
  const list = ['index.html', 'sitemap.xml', 'entry/a.html', 'entry/b.html'];
  const p = problemsIn(list, need);
  assert.ok(p.includes('missing: data/index.json'));
  assert.ok(p.includes('missing: data/skills.json'));
});

test('a deploy that would ship a script or secret is refused', () => {
  const list = [...need.files, 'entry/a.html', 'entry/b.html', 'scripts/fetch-signals.mjs', '.env', 'data/research/x.json'];
  const p = problemsIn(list, need);
  assert.ok(p.some(x => x.includes('scripts/fetch-signals.mjs')));
  assert.ok(p.some(x => x.includes('.env')));
  assert.ok(p.some(x => x.includes('data/research')));
  assert.deepEqual(problemsIn([...need.files, 'entry/a.html', 'entry/b.html'], need), [], 'a correct list passes');
});

test('the live check fails when production serves fewer entries than the checkout', async () => {
  const want = { shelves: { 'skills.json': 3 }, sitemapUrls: 2, sampleEntry: 'a' };
  const serve = shelfCount => async url => {
    const path = new URL(url).pathname;
    if (path === '/data/skills.json') return new Response(JSON.stringify({ items: Array(shelfCount).fill({}) }));
    if (path === '/sitemap.xml') return new Response('<loc>x</loc><loc>y</loc>');
    return new Response('ok');
  };
  const quiet = { attempts: 1, waitMs: 0, log: () => {} };
  assert.deepEqual(await verify('https://site', want, { fetcher: serve(3), ...quiet }), []);
  const p = await verify('https://site', want, { fetcher: serve(1), ...quiet });
  assert.match(p[0], /1 entries live, 3 in the checkout/);
});
