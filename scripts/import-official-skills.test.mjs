import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEntry, namesSomeone, authorText } from './import-official-skills.mjs';

const skill = (over = {}) => ({
  name: 'apple-notes', description: 'Manage Apple Notes via memo CLI.',
  overview: 'Use `memo` to manage Apple Notes from the terminal.',
  category: 'apple', source: 'built-in', tags: ['Notes'], platforms: ['macos'],
  author: 'Hermes Agent', commands: ['memo'], envVars: [],
  docsPath: 'bundled/apple/apple-apple-notes',
  installCmd: 'hermes skills install NousResearch/hermes-agent/skills/apple/apple-notes',
  ...over
});

test('a placeholder in the author field is not a credit', () => {
  // Eight official skills list "community", which names nobody. Shipping that in an
  // author field reads as attribution to a person who does not exist.
  for (const placeholder of ['Hermes Agent', 'community', 'Community', '  unknown ', 'n/a'])
    assert.equal(namesSomeone(placeholder), false, placeholder);
  for (const real of ['Teknium (teknium1), Hermes Agent', 'Ben Barclay (benbarclay)', '宝玉 (JimLiu)'])
    assert.equal(namesSomeone(real), true, real);

  assert.equal(buildEntry(skill(), '2026-10-05').author, undefined);
  assert.equal(buildEntry(skill({ author: 'Nous Research' }), '2026-10-05').author, 'Nous Research');
});

test('acronyms and product names survive the title case', () => {
  // These are card titles. "Har Derived Api Client" looks like nobody checked.
  const title = name => buildEntry(skill({ name }), '2026-10-05').title;
  assert.equal(title('har-derived-api-client'), 'HAR Derived API Client');
  assert.equal(title('docx'), 'DOCX');
  assert.equal(title('powerpoint'), 'PowerPoint');
  assert.equal(title('mcp-oauth-remote-gateway'), 'MCP OAuth Remote Gateway');
  assert.equal(title('apple-notes'), 'Apple Notes');
});

test('an entry carries its official link, install command and provenance', () => {
  const entry = buildEntry(skill(), '2026-10-05');
  assert.equal(entry.source, 'docs');
  assert.equal(entry.url, 'https://hermes-agent.nousresearch.com/docs/user-guide/skills/bundled/apple/apple-apple-notes');
  assert.match(entry.snippet, /^hermes skills install /);
  assert.ok(entry.tags.includes('built-in'), 'the bundled set is distinguishable from optional');
  assert.match(entry.detail, /Platforms: macos\./);
  assert.match(entry.detail, /Needs: memo\./);
});

test('only skills Hermes publishes itself were imported', async () => {
  /* The same catalogue carries 79,491 ClawHub listings and 20,000 from skills.sh.
     Catalogue presence is not a recommendation, and none of it may reach a shelf. */
  const record = JSON.parse(await readFile(new URL('./imported-official-skills.json', import.meta.url), 'utf8'));
  assert.ok(record.passes.length >= 1, 'the record keeps every pass, not just the last');
  assert.equal(record.totalImported, record.passes.reduce((n, p) => n + p.imported.length, 0));
  for (const pass of record.passes) {
    assert.equal(pass.counts.imported, pass.imported.length);
    for (const entry of pass.imported) {
      if (pass.what === 'official')
        assert.match(entry.url, /^https:\/\/hermes-agent\.nousresearch\.com\/docs\/user-guide\/skills\//, `${entry.id} must link to the official documentation`);
      else
        assert.match(entry.url, /^https:\/\/github\.com\/anthropics\/skills\/tree\/main\/skills\//, `${entry.id} must link to its source tree`);
    }
  }
});

test('co-authors listed as an array become one credit string', () => {
  // Two catalogue skills shipped `author: ["a","b"]`; the credit code calls .trim() on it.
  assert.equal(authorText(['kshitijk4poor', 'alt-glitch', 'purzbeats']), 'kshitijk4poor, alt-glitch, purzbeats');
  assert.equal(namesSomeone(['SHL0MS', 'alt-glitch']), true);
  const entry = buildEntry(skill({ author: ['SHL0MS', 'alt-glitch'] }), '2026-10-10');
  assert.equal(typeof entry.author, 'string');
  assert.equal(entry.author, 'SHL0MS, alt-glitch');
});
