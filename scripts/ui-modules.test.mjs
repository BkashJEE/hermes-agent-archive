import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTopicTag, PROVENANCE_TAGS } from '../assets/js/tags.js';
import { ageLabel, daysSince, STALE_AFTER_DAYS } from '../assets/js/relative-time.js';

test('provenance labels are not topics', () => {
  // The watchlist led with user-story · cli · reference · docs: importer labels, not subjects.
  for (const t of ['user-story', 'cli', 'reference', 'docs', 'DOCS', 'sourced']) assert.equal(isTopicTag(t), false, t);
  for (const t of ['memory', 'voice-mode', 'dev-workflow', 'skills']) assert.equal(isTopicTag(t), true, t);
  assert.ok(PROVENANCE_TAGS.size >= 6);
});

test('the updated badge speaks relatively and goes quiet past a fortnight', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  const at = d => new Date(now - d * 86_400_000).toISOString();
  assert.equal(ageLabel(at(0), now), 'today');
  assert.equal(ageLabel(at(1), now), 'yesterday');
  assert.equal(ageLabel(at(3), now), '3 days ago');
  assert.equal(ageLabel(at(8), now), '1 week ago');
  assert.equal(ageLabel(at(STALE_AFTER_DAYS), now), null, 'stale: nothing is better than a gap');
  assert.equal(ageLabel('not a date', now), null);
  assert.equal(daysSince(at(2.5), now), 2);
});
