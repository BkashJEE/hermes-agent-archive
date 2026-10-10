import { test } from 'node:test';
import assert from 'node:assert/strict';
import { officialEntry, communityEntry } from './import-official-plugins.mjs';

const official = { name: 'hermes-memory-wiki', tier: 'official', description: 'Memory Wiki dashboard tab.', installCommand: 'hermes plugins install hermes-memory-wiki', category: 'desktop', requiresHermes: '>=0.21', version: '1.0.0', capabilities: { providesTools: ['memory_wiki'] } };
const community = { name: 'mem0', tier: 'community', description: 'Mem0 memory provider.', installCommand: 'hermes plugins install mem0', category: 'memory', maintainer: 'mem0ai', repo: 'https://github.com/mem0ai/mem0', docsUrl: 'https://github.com/mem0ai/mem0/tree/main/integrations/hermes-plugin-mem0#readme' };

test('an official plugin is a documentation entry on the official site', () => {
  const e = officialEntry(official, '2026-10-10');
  assert.equal(e.source, 'docs');
  assert.equal(e.author, 'Nous Research');
  assert.equal(e.url, 'https://hermes-agent.nousresearch.com/docs/plugins/hermes-memory-wiki');
  assert.equal(e.title, 'Memory Wiki', 'the hermes- prefix is dropped from a first-party name');
  assert.equal(e.snippet, 'hermes plugins install hermes-memory-wiki');
  assert.ok(e.tags.includes('official-plugin'));
  assert.match(e.detail, /Requires Hermes >=0\.21\./);
  assert.match(e.detail, /Tools: memory_wiki\./);
  assert.equal(e.repo, undefined, 'no repo: the floor does not apply to first-party documentation');
});

test('a community plugin is a GitHub entry that the floor judges at render time', () => {
  const e = communityEntry(community, '2026-10-10');
  assert.equal(e.source, 'github');
  assert.equal(e.repo, 'mem0ai/mem0', 'carries the repository so the star floor applies');
  assert.equal(e.author, 'mem0ai');
  // The plugin's own README, never the repo root: the root is the product.
  assert.equal(e.url, 'https://github.com/mem0ai/mem0/tree/main/integrations/hermes-plugin-mem0#readme');
  assert.equal(e.title, 'Mem0');
  assert.ok(e.tags.includes('community-plugin'));
});
