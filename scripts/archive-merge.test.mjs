import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeLive } from '../assets/js/archive.js';

/**
 * A GitHub entry is either the repository or something inside it, and the live merge
 * once treated both the same: the first Anthropic skill shelved from anthropics/skills
 * rendered as "anthropics/skills", linked to the repo root, and wore a "Python" pill.
 */
const live = { github: [
  { repo: 'anthropics/skills', stars: 180053, forks: 21317, url: 'https://github.com/anthropics/skills', language: 'Python', description: 'Skills by Anthropic.' },
  { repo: 'obra/superpowers',  stars: 250000, forks: 9000,  url: 'https://github.com/obra/superpowers',  language: 'TypeScript', description: 'Superpowers.' }
]};
const reviews = {
  'anthropics/skills': { url: 'https://hermes-agent.nousresearch.com/docs/skills/', note: 'catalogue', reviewedAt: '2026-10-09' },
  'obra/superpowers':  { url: 'https://github.com/obra/superpowers', note: 'documents Hermes', reviewedAt: '2026-09-25' }
};

test('a skill inside a repository keeps its own name, link and no language pill', () => {
  const data = { skills: [{
    id: 'skill-pack-anthropic-academy-guide', title: 'Academy Guide', summary: 'Check Academy first.',
    detail: 'Longer.', source: 'github', repo: 'anthropics/skills', author: 'Anthropic',
    url: 'https://github.com/anthropics/skills/tree/main/skills/academy-guide'
  }]};
  mergeLive(data, live, reviews);
  const it = data.skills[0];
  assert.equal(it.title, 'Academy Guide');
  assert.equal(it.url, 'https://github.com/anthropics/skills/tree/main/skills/academy-guide');
  assert.equal(it.lang, undefined, 'the repo language says nothing about one skill');
  assert.deepEqual(it.metric, { kind: 'stars', value: 180053 }, 'the floor and the figure still come from the repo');
  assert.ok(it.hermesSupport, 'documented support still attaches');
});

test('a repository entry still follows renames and links to the root', () => {
  const data = { skills: [{
    id: 'skill-superpowers', title: 'obra/superpowers', summary: 'x', source: 'github',
    repo: 'obra/superpowers', author: 'obra', url: 'https://github.com/obra/superpowers'
  }]};
  mergeLive(data, live, reviews);
  const it = data.skills[0];
  assert.equal(it.title, 'obra/superpowers');
  assert.equal(it.url, 'https://github.com/obra/superpowers');
  assert.equal(it.lang, 'TypeScript');
});
