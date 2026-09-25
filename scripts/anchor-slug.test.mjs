/**
 * The anchor slugger, against the headings that were actually getting it wrong.
 *
 * Three CLI entries shipped pointing at headings that do not exist, because the id
 * slugger was reused for URLs. It collapses every run of punctuation to one hyphen;
 * Docusaurus runs github-slugger, which removes punctuation in place and turns each
 * remaining space into its own hyphen. The em dash in "--format stream-json — structured
 * JSONL output" therefore leaves a doubled hyphen behind, and the collapsed guess missed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeAnchorSlugger } from './import-hermes-cli.mjs';

test('an em dash leaves the doubled hyphen its spaces produce', () => {
  const slug = makeAnchorSlugger();
  assert.equal(slug('--format stream-json — structured JSONL output'),
               '--format-stream-json--structured-jsonl-output');
});

test('leading hyphens on a flag survive', () => {
  assert.equal(makeAnchorSlugger()('--usage-file — JSON usage report for pipelines'),
               '--usage-file--json-usage-report-for-pipelines');
});

test('angle brackets vanish without leaving a separator', () => {
  assert.equal(makeAnchorSlugger()('hermes -z <prompt> — scripted one-shot'),
               'hermes--z-prompt--scripted-one-shot');
});

test('a slash between two commands leaves two spaces, so two hyphens', () => {
  assert.equal(makeAnchorSlugger()('hermes login / hermes logout (Deprecated)'),
               'hermes-login--hermes-logout-deprecated');
});

test('an ordinary heading is unremarkable', () => {
  assert.equal(makeAnchorSlugger()('Pattern: Parallel Research'), 'pattern-parallel-research');
});

test('repeated headings take the suffix the page gives them', () => {
  const slug = makeAnchorSlugger();
  assert.deepEqual(['Examples', 'Options', 'Examples', 'Examples'].map(slug),
                   ['examples', 'options', 'examples-1', 'examples-2']);
});

test('each page gets its own numbering', () => {
  assert.equal(makeAnchorSlugger()('Examples'), 'examples');
  assert.equal(makeAnchorSlugger()('Examples'), 'examples', 'a fresh slugger must not inherit a count');
});
