import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKeys, usesFor, prose } from './link-story-uses.mjs';

const keys = buildKeys({
  commands: [{ id: 'cmd-send', title: 'hermes send', snippet: 'hermes send <msg>' }, { id: 'cmd-voice', title: '/voice on' }, { id: 'cmd-chat', title: 'hermes chat' }],
  skills: [{ id: 'sk-obsidian', title: 'Obsidian' }, { id: 'sk-github', title: 'GitHub' }, { id: 'sk-hermes', title: 'Hermes Agent' }, { id: 'sk-core', title: 'Core' }],
  settings: [{ id: 'set-tts', title: 'voice.tts_provider' }]
});

test('a story links to the entries it names, by their names in its own words', () => {
  const item = { id: 'story-1', detail: 'I keep notes in Obsidian and run /voice on in the evening. Set voice.tts_provider to edge.' };
  assert.deepEqual(usesFor(item, keys), ['cmd-voice', 'sk-obsidian', 'set-tts']);
});

test('a name inside a link is not a use', () => {
  // 54 stories "used the GitHub skill" because their source link was on github.com.
  const item = { id: 'story-2', detail: 'Source: https://github.com/someone/repo and see example.com/x for more.' };
  assert.equal(prose(item).includes('github'), false);
  assert.deepEqual(usesFor(item, keys), []);
});

test('self-referential and generic names are never keys', () => {
  assert.ok(!keys.some(k => k.id === 'sk-hermes'), '"Hermes Agent" matches every story');
  assert.ok(!keys.some(k => k.id === 'sk-core'), 'a section label is not a thing a story uses');
  assert.ok(!keys.some(k => k.id === 'sk-github'), 'GitHub is in nearly every story as a link, not a skill');
  assert.ok(!keys.some(k => k.id === 'cmd-chat'), '"hermes chat" is how every story starts');
});

test('no more than four, and never itself', () => {
  const many = buildKeys({ skills: ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echoo'].map(t => ({ id: 'sk-' + t.toLowerCase(), title: t })) });
  const item = { id: 'sk-alpha', detail: 'Alpha Bravo Charlie Delta Echoo' };
  const uses = usesFor(item, many);
  assert.equal(uses.length, 4);
  assert.ok(!uses.includes('sk-alpha'));
});
