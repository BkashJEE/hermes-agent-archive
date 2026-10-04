import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mentionsHermesInProse } from './discover-hermes-topic.mjs';

/**
 * This filter decides which README lines become evidence, and two bugs have already
 * travelled through it. Both are pinned here.
 */

test('markup carrying hermes in a filename is not evidence', () => {
  // Ranked a repository sixth in review order on two image tags.
  assert.equal(mentionsHermesInProse(
    '<a href="https://github.com/x/y"><img src="hermes.png" alt="Third-party agents: Cl"></a>'), false);
  assert.equal(mentionsHermesInProse('![badge](https://img.shields.io/hermes-agent)'), false);
  assert.equal(mentionsHermesInProse(
    '<img alt="Hermes Agent" src="https://img.shields.io/badge/Hermes%20Agent-NousResearch-6f42c1">'), false);
});

test('an install path in code is evidence, and stays', () => {
  // The strongest signal a README can carry. An earlier revision stripped inline code and
  // would have thrown away exactly the lines worth finding.
  assert.equal(mentionsHermesInProse('git clone https://github.com/a/b ~/.hermes/skills/internet-court'), true);
  assert.equal(mentionsHermesInProse('# or as a tap:  hermes skills tap add internet-court/skill'), true);
  assert.equal(mentionsHermesInProse('./scripts/install.sh --tool hermes         # Hermes Agent (NousResearch)'), true);
  assert.equal(mentionsHermesInProse('atomic-agent import <hermes|openclaw|claude-code>'), true);
});

test('prose survives the markup around it', () => {
  assert.equal(mentionsHermesInProse(
    '| <img src=".github/hermes-agent.png" alt="Hermes Agent" /> | Hermes Agent | `~/.hermes/state.db` | ok'), true);
  assert.equal(mentionsHermesInProse(
    '[Hermes Agent](https://hermes-agent.nousresearch.com/) is an autonomous agent'), true);
  assert.equal(mentionsHermesInProse('> - **Hermes:** sessions, cron jobs, and provider keys'), true);
});

test('a bare mention too short to assess is not evidence', () => {
  assert.equal(mentionsHermesInProse('hermes'), false);
  assert.equal(mentionsHermesInProse('## Hermes'), false);
});
