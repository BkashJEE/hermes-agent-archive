import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickFor, pool, dayNumber, THRESHOLD } from '../assets/js/daily-pick.js';

const items = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, usefulness: i % 2 ? 3 : 1 }));

test('only entries rated at or above the threshold are eligible', () => {
  assert.equal(pool(items).length, 20);
  assert.ok(pool(items).every(id => Number(id.slice(1)) % 2 === 1));
  assert.equal(pool([{ id: 'x' }]).length, 0, 'an unranked entry is never picked');
  assert.equal(THRESHOLD, 2.5);
});

test('the same day always gives the same pick; the pool is shown before any repeat', () => {
  const day = new Date(Date.UTC(2026, 9, 11, 3));
  assert.equal(pickFor(items, day), pickFor(items, new Date(Date.UTC(2026, 9, 11, 22))), 'stable across a UTC day');
  const seen = new Set();
  for (let d = 0; d < 20; d++) seen.add(pickFor(items, new Date(Date.UTC(2026, 9, 11 + d))));
  assert.equal(seen.size, 20, 'twenty days, twenty different picks');
});

test('the order does not depend on how the items were listed', () => {
  const shuffled = [...items].reverse();
  const day = new Date(Date.UTC(2026, 9, 11));
  assert.equal(pickFor(shuffled, day), pickFor(items, day));
  assert.equal(pickFor([], day), null);
  assert.equal(dayNumber(new Date(Date.UTC(2026, 0, 1))), 0);
});
