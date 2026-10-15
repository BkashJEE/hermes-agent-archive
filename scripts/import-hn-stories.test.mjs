import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleOf, entryFor } from './import-hn-stories.mjs';

test('the title is the comment\'s own first sentence, untouched when it says enough', () => {
  assert.equal(titleOf('I run Hermes on a Raspberry Pi to tag my whole photo library nightly. It works.'),
    'I run Hermes on a Raspberry Pi to tag my whole photo library nightly');
});

test('a long opening is cut at a word boundary and marked as cut', () => {
  const t = titleOf('So, one of the first things that I have put my Hermes agent to work doing is populating my home lab inventory and documentation in Netbox');
  assert.ok(t.endsWith('…'));
  assert.ok(t.length <= 97);
  assert.ok(!t.includes('Netbox…'), 'cut mid-word');
});

test('an entry quotes the comment verbatim and spells out where it came from', () => {
  const e = entryFor({ objectID: '50070852', author: 'bleevht', created_at: '2026-10-13T01:02:03.000Z', kind: 'comment',
    storyTitle: 'Hermes Agent – Open-source AI agent', text: 'I put Hermes to work populating my Netbox inventory. It reads the switch configs nightly.' });
  assert.equal(e.id, 'hn-50070852');
  assert.equal(e.source, 'hn');
  assert.equal(e.url, 'https://news.ycombinator.com/item?id=50070852');
  assert.equal(e.author, 'bleevht');
  assert.equal(e.date, '2026-10-13');
  assert.ok(e.detail.startsWith('I put Hermes to work populating my Netbox inventory.'));
  assert.ok(e.detail.includes('— bleevht, 2026-10-13, in the Hacker News thread “Hermes Agent – Open-source AI agent”.'));
  assert.deepEqual(e.tags, ['user-story', 'hn-comment']);
});

test('a one-word opener takes the next sentence with it, and quoted lines are never the author\'s', () => {
  assert.equal(titleOf('Author here. This is a weekend project that grew into a WhatsApp bot. More.'),
    'Author here. This is a weekend project that grew into a WhatsApp bot');
  assert.equal(titleOf('> someone else said this at length and it is not mine\nI run Hermes as a sysadmin for my homelab cluster.'),
    'I run Hermes as a sysadmin for my homelab cluster');
});

test('a Show HN story keeps its own headline', () => {
  const e = entryFor({ objectID: '1', author: 'a', created_at: '2026-01-01T00:00:00Z', kind: 'story', title: 'Show HN: Grafana for Hermes', text: 'x'.repeat(200) });
  assert.equal(e.title, 'Show HN: Grafana for Hermes');
  assert.deepEqual(e.tags, ['user-story', 'hn-story']);
});
