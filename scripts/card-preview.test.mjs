import test from 'node:test';
import assert from 'node:assert/strict';
import { cardPoints } from '../assets/js/card-preview.js';

test('preview uses complete source steps rather than a truncated summary', () => {
  const item = { title: 'Apartment search', summary: 'The version that works…', tags: ['user-story'],
    detail: 'The version that works: 1. Create saved searches on Zillow and Trulia. 2. Send alerts to a dedicated inbox. 3. Read the alerts with a daily cron job.\n\n— Example author, 2026-01-01, via Reddit.' };
  assert.deepEqual(cardPoints(item), ['Create saved searches on Zillow and Trulia.', 'Send alerts to a dedicated inbox.', 'Read the alerts with a daily cron job.']);
});
test('version numbers, decimals and source attribution do not become invented steps', () => {
  const item = { title: 'Model routing', tags: ['user-story'], detail: 'Use Gemini 3.1 for routine work. Keep the more expensive model for difficult tasks.\n\n— Example author, 2026-01-01, via Reddit.' };
  assert.deepEqual(cardPoints(item), ['Use Gemini 3.1 for routine work.', 'Keep the more expensive model for difficult tasks.']);
});
test('sparse and missing content stays honest without extra bullets', () => {
  assert.deepEqual(cardPoints({ title: 'hermes chat', summary: 'Interactive or one-shot chat with the agent.' }), ['Interactive or one-shot chat with the agent.']);
  assert.deepEqual(cardPoints({ title: 'A documented workflow' }), ['A documented workflow']);
});
test('inline source bullets split while source omissions stay out of complete points', () => {
  const item = { tags: ['user-story'], detail: 'A dedicated VPS hosts the agent. * Deploy changes with Ansible. * Send updates through Telegram. … remainder omitted' };
  assert.deepEqual(cardPoints(item), ['A dedicated VPS hosts the agent.', 'Deploy changes with Ansible.', 'Send updates through Telegram.']);
});
