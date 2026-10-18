import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankPrompts, thisWeek, promptText } from '../assets/js/leaderboard.js';

const items = [
  { id: 'a', title: 'Alpha', ranking: { usefulness: 2.1 } },
  { id: 'b', title: 'Beta', ranking: { usefulness: 3.4 } },
  { id: 'c', title: 'Charlie' },
  { id: 'd', title: 'Delta', ranking: { usefulness: 3.4 } },
  { id: 'e', title: 'Echo' }
];

test('all time is usefulness first, ties alphabetical, unclassified last and alphabetical', () => {
  assert.deepEqual(rankPrompts(items).map(i => i.id), ['b', 'd', 'a', 'c', 'e']);
});

test('this week is the same order over the last seven arrival days only', () => {
  const added = { a: '2026-10-12', b: '2026-10-18', c: '2026-10-17', d: '2026-10-11', e: '2026-10-01' };
  const week = thisWeek(items, added, '2026-10-18T12:00:00Z');
  assert.deepEqual(week.map(i => i.id), ['b', 'a', 'c'], 'Oct 12–18 inclusive; Delta on the 11th is out');
});

test('no arrival data means an empty week, not a guessed one', () => {
  assert.deepEqual(thisWeek(items, null), []);
});

test('the copied text is the prompt itself when there is one', () => {
  assert.equal(promptText({ snippet: '  Act as a reviewer.  ', summary: 'A review prompt' }), 'Act as a reviewer.');
  assert.equal(promptText({ summary: 'A review prompt' }), 'A review prompt');
});
