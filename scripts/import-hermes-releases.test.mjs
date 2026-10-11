import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryFor, plainNotes, releaseId } from './import-hermes-releases.mjs';

const r = { tag_name: 'v0.21.6', name: 'Hermes Agent v0.21.6', html_url: 'https://github.com/NousResearch/hermes-agent/releases/tag/v0.21.6',
  published_at: '2026-10-08T11:51:57Z',
  body: '# Hermes Agent v0.21.6\n\n**Release Date:** October 8, 2026\n\n> Patch release. This tag rolls up the ~2,100 PRs merged since v0.21.5 into a stable tagged release.\n\n<!-- HERMES_BUILDS_TABLE -->\n\n## About this release\n\n- one\n- two with `stt.streaming`' };

test('a release becomes one card that quotes the notes and links them in full', () => {
  const e = entryFor(r);
  assert.equal(e.id, 'release-v0-21-6');
  assert.equal(e.title, 'Hermes Agent v0.21.6');
  assert.equal(e.date, '2026-10-08');
  assert.match(e.summary, /^Patch release\./);
  assert.ok(!e.detail.startsWith('Hermes Agent v0.21.6'), 'the title is not repeated in the body');
  assert.ok(!/Release Date:/.test(e.detail), 'the date line is not repeated');
  assert.match(e.detail, /`stt\.streaming`/, 'config keys keep their backticks');
  assert.ok(!/HERMES_BUILDS_TABLE/.test(e.detail), 'html comments are dropped');
  assert.match(e.detail, /Full release notes: https:\/\/github\.com\/NousResearch/);
  assert.equal(e.source, 'github');
  assert.equal(e.author, 'Nous Research');
});

test('markdown reduces to the paragraphs the drawer renders', () => {
  assert.equal(plainNotes('## Head\n\n- a\n* b\n\n**bold** text'), 'Head\n\n• a\n• b\n\nbold text');
  assert.equal(releaseId('v2026.9.24'), 'release-v2026-9-24');
});
