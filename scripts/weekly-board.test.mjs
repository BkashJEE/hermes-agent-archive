import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isoWeek, scoreOrder, snapshot, movement } from '../assets/js/weekly-board.js';

test('ISO weeks start on Monday and the Thursday decides the year', () => {
  assert.equal(isoWeek(new Date('2026-10-18T23:00:00Z')), '2026-W42');   // Sunday, still week 42
  assert.equal(isoWeek(new Date('2026-10-19T00:00:00Z')), '2026-W43');   // Monday, week 43
  assert.equal(isoWeek(new Date('2027-01-01T12:00:00Z')), '2026-W53');   // a Friday that belongs to the old year
});

test('the score is usefulness bands, then popularity, then exact usefulness, then title', () => {
  const items = [
    { id: 'a', title: 'A', ranking: { usefulness: 3.2, popularity: 'unknown' } },
    { id: 'b', title: 'B', ranking: { usefulness: 3.4, popularity: 'high' } },
    { id: 'c', title: 'C', ranking: { usefulness: 2.9, popularity: 'viral' } },
    { id: 'd', title: 'D' }
  ];
  assert.deepEqual([...items].sort(scoreOrder).map(i => i.id), ['c', 'b', 'a', 'd'],
    'all three round to the same band, so measured popularity decides: viral, high, unknown; unclassified last');
});

test('a snapshot is the top N classified entries with the week and the date it was scored', () => {
  const items = Array.from({ length: 60 }, (_, i) => ({ id: `e${i}`, title: `E${i}`, shelf: 's', ranking: { usefulness: i / 20, popularity: 'unknown' } }));
  const snap = snapshot([...items, { id: 'x', title: 'X', shelf: 's' }], { week: '2026-W42', scoredAt: '2026-10-18T00:00:00Z' });
  assert.equal(snap.entries.length, 50);
  assert.equal(snap.of, 60, 'the unclassified entry is not counted');
  assert.equal(snap.entries[0].id, 'e59');
  assert.equal(snap.entries[0].rank, 1);
  assert.equal(snap.shelves.s.entries.length, 10, 'and each shelf keeps its own top ten');
  assert.equal(snap.shelves.s.of, 60);
});

test('a shelf that never reaches the overall top fifty still has a weekly board of its own', () => {
  const docs = Array.from({ length: 60 }, (_, i) => ({ id: `d${i}`, title: `D${i}`, shelf: 'commands', ranking: { usefulness: 3 + i / 100, popularity: 'unknown' } }));
  const stories = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, title: `S${i}`, shelf: 'use-cases', ranking: { usefulness: 1 + i / 10, popularity: 'unknown' } }));
  const snap = snapshot([...docs, ...stories], { week: '2026-W42', scoredAt: 'x' });
  assert.ok(snap.entries.every(e => e.shelf === 'commands'));
  assert.deepEqual(snap.shelves['use-cases'].entries.map(e => e.id), ['s4', 's3', 's2', 's1', 's0']);
});

test('movement is the difference between two written-down ranks, or new', () => {
  const prev = { entries: [{ id: 'a', rank: 1 }, { id: 'b', rank: 2 }, { id: 'c', rank: 3 }] };
  const cur = { entries: [{ id: 'b', rank: 1 }, { id: 'a', rank: 2 }, { id: 'd', rank: 3 }] };
  assert.deepEqual(movement(cur, prev), { b: 1, a: -1, d: 'new' });
  assert.deepEqual(movement(cur, null), { b: 'new', a: 'new', d: 'new' });
});
