import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose } from './whats-new-post.mjs';

const sections = [{ id: 'skills', label: 'Skills' }, { id: 'use-cases', label: 'Use Cases' }];
const now = Date.parse('2026-10-10T12:00:00Z');

test('a post counts only what arrived in the window, from arrival dates', () => {
  const added = { a: '2026-10-10', b: '2026-10-09', c: '2026-09-01' };
  const items = [
    { id: 'a', title: 'Snyk', shelf: 'skills', ranking: { usefulness: 2 } },
    { id: 'b', title: 'A story', shelf: 'use-cases', ranking: { usefulness: 3 } },
    { id: 'c', title: 'Old', shelf: 'skills' }
  ];
  const post = compose({ added, items, sections, days: 2, now });
  assert.match(post, /^2 new entries/);
  assert.match(post, /• 1 Skills/);
  assert.match(post, /• 1 Use Cases/);
  assert.ok(!post.includes('Old'), 'outside the window');
  assert.ok(post.indexOf('A story') < post.indexOf('Snyk'), 'highest-ranked title first');
  assert.match(post, /whats-new$/m);
});

test('nothing arrived means no post, not an empty one', () => {
  assert.equal(compose({ added: { a: '2026-01-01' }, items: [{ id: 'a', title: 'x', shelf: 'skills' }], sections, days: 2, now }), null);
});
