/**
 * The documentation importer, against fixture markup.
 *
 * No network. These prove the shaping rules; `node scripts/check-links.mjs` is what proves
 * the anchors it writes resolve on the live pages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { entriesFromPage } from './import-hermes-docs.mjs';

const line = t => `<div class="token-line"><span class="token plain">${t}</span><br></div>`;
const pre = (...l) => `<pre tabindex="0" class="prism-code language-bash codeBlock_x"><code>${l.map(line).join('')}</code></pre>`;
const long = 'Sentence number one is comfortably past thirty characters. ' .repeat(5);

const PAGE = `<html><body>
<h2 id="a-real-section">A Real Section​</h2>
<p>${long}</p>
<h2 id="overview">Overview​</h2>
<p>${long}</p>
<h2 id="short-with-code">Short With Code​</h2>
<p>A brief line that on its own would not clear the prose bar at all, but it has a command.</p>
${pre('hermes profile create research --no-skills')}
<h2 id="too-short">Too Short​</h2>
<p>Three words only.</p>
</body></html>`;

const PAGE_META = { shelf: 'skills', tags: ['skills'] };
const run = (html = PAGE, meta = PAGE_META) => entriesFromPage(html, 'user-guide/features/skills', meta, '2026-09-25');

test('a section with real prose becomes an entry', () => {
  const ids = run().map(e => e.title);
  assert.ok(ids.includes('A Real Section'));
});

test('the zero-width space Docusaurus appends to headings is stripped', () => {
  assert.ok(run().every(e => !/​/.test(e.title)), 'a heading kept its anchor glyph');
});

test('page furniture is not shelved', () => {
  assert.ok(!run().some(e => e.title === 'Overview'), 'Overview was imported as a card');
});

test('a thin section with a command still earns its card', () => {
  const entry = run().find(e => e.title === 'Short With Code');
  assert.ok(entry, 'a paste-and-run section was dropped for being short');
  assert.match(entry.snippet, /hermes profile create research/);
});

test('a section with neither prose nor a command is skipped', () => {
  assert.ok(!run().some(e => e.title === 'Too Short'));
});

test('code does not leak into the summary', () => {
  const entry = run().find(e => e.title === 'Short With Code');
  assert.ok(!entry.summary.includes('hermes profile create'), 'a fenced command ended up in the summary');
});

test('the url points at the heading anchor on the right page', () => {
  const entry = run().find(e => e.title === 'A Real Section');
  assert.equal(entry.url,
    'https://hermes-agent.nousresearch.com/docs/user-guide/features/skills#a-real-section');
});

test('entries carry the manifest shelf, tags and docs source', () => {
  const entry = run().find(e => e.title === 'A Real Section');
  assert.equal(entry.shelf, 'skills');
  assert.equal(entry.source, 'docs');
  assert.deepEqual(entry.tags, ['skills', 'docs']);
});

test('shelves reserved for reviewed extraction are refused outright', () => {
  for (const shelf of ['tricks', 'prompts'])
    assert.throws(() => run(PAGE, { shelf, tags: [] }), /reviewed extraction/,
      `${shelf} accepted an automated import`);
});
