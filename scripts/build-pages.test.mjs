import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { entryPage, shelfPage } from './build-pages.mjs';

const ROOT = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, ROOT), 'utf8');
const json = async p => JSON.parse(await read(p));

const section = { id: 'skills', label: 'Skills', title: 'SKILLS WORTH INSTALLING', blurb: 'Packaged capabilities.' };

test('every current entry has a page, and no page outlives its entry', async () => {
  /* The pages are generated, so they can fall behind the data silently — a shelf gains an
     entry nobody can find, or an id is renamed and the old page keeps answering as if it
     were current. Both are invisible without this check. */
  const index = await json('data/index.json');
  const ids = new Set();
  for (const s of index.sections) {
    if (!s.file) continue;
    for (const item of (await json(`data/${s.file}`)).items) ids.add(item.id);
  }
  const pages = new Set((await readdir(new URL('entry/', ROOT))).map(f => f.replace(/\.html$/, '')));

  const missing = [...ids].filter(id => !pages.has(id));
  const orphans = [...pages].filter(id => !ids.has(id));
  assert.deepEqual(missing, [], 'entries with no page — run npm run pages');
  assert.deepEqual(orphans, [], 'pages whose entry is gone — run npm run pages');
});

test('the sitemap lists exactly what exists', async () => {
  const sitemap = await read('sitemap.xml');
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const pages = (await readdir(new URL('entry/', ROOT))).length
              + (await readdir(new URL('shelf/', ROOT))).length;
  assert.equal(locs.length, pages + 1, 'one url per page, plus the root');
  assert.ok(locs.every(u => u.startsWith('https://hermes-agent-archive.vercel.app/')), 'absolute, canonical host');
  assert.equal(new Set(locs).size, locs.length, 'no duplicate urls');
  // A <lastmod> here would be a date nobody measured: `date` is when the described thing
  // was published, not when this page changed.
  assert.ok(!/<lastmod>/.test(sitemap));
});

test('a page escapes everything it prints', async () => {
  const nasty = {
    id: 'x', title: 'Title <script>alert(1)</script>', summary: 'A & B "quoted"',
    detail: 'Line <b>one</b>\n\nLine two', snippet: '<img src=x onerror=alert(1)>',
    tags: ['<svg>'], url: 'https://example.com/?a=1&b=2', author: "O'Brien <hi>"
  };
  const html = entryPage(nasty, section, 'Reddit');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x onerror'));
  assert.ok(html.includes('&lt;script&gt;'), 'the title is escaped, not dropped');
  assert.ok(html.includes('O&#39;Brien'), 'the credit survives escaping');
  assert.match(html, /https:\/\/example\.com\/\?a=1&amp;b=2/, 'the source link is escaped but intact');
});

test('a page carries its canonical url, its source and a way back', async () => {
  const item = { id: 'demo-entry', title: 'Demo', summary: 'A demo entry.', detail: 'Detail.', tags: ['t'], url: 'https://example.com/post', author: 'Someone' };
  const html = entryPage(item, section, 'Reddit');
  assert.match(html, /<link rel="canonical" href="https:\/\/hermes-agent-archive\.vercel\.app\/entry\/demo-entry">/);
  assert.match(html, /href="https:\/\/example\.com\/post"/, 'links to the original');
  assert.match(html, /href="\/#skills\?item=demo-entry"/, 'links back into the app at the card');
  assert.match(html, /By Someone/, 'credits the author');
  // Internal references must be host-relative, or a preview deployment loads production.
  assert.ok(!/(href|src)="https:\/\/hermes-agent-archive\.vercel\.app\/assets/.test(html));
});

test('no metric is baked into a static page', async () => {
  /* A star count written into a file is a number that was true once and is then asserted
     forever. The live figure belongs on the card, where it is fetched. */
  for (const name of (await readdir(new URL('entry/', ROOT))).slice(0, 80)) {
    const html = await read(`entry/${name}`);
    assert.ok(!/\b\d[\d,]{2,}\s*(stars?|upvotes?|points?|impressions?)\b/i.test(html),
      `${name} prints a metric`);
  }
});

test('a shelf page lists its entries and links to each one', async () => {
  const items = [{ id: 'a', title: 'First', summary: 'One.' }, { id: 'b', title: 'Second', summary: 'Two.' }];
  const html = shelfPage(section, items);
  assert.match(html, /href="\/entry\/a"/);
  assert.match(html, /href="\/entry\/b"/);
  assert.match(html, /2 entries/);
});
