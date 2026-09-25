/**
 * The prompt verifier's parser, tested against fixture markup.
 *
 * No network here. These prove the parser reads Docusaurus output correctly; running
 * `node scripts/extract-prompts.mjs` is what proves the stored prompts match the live
 * pages. A test that reached the internet would fail on a plane and pass on a lie.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { codeBlocks, proseSections } from './extract-prompts.mjs';

/* Shaped like the real thing: hashed class names, one div per line, entities encoded. */
const line = t => `<div class="token-line" style="color:#F8F8F2"><span class="token plain">${t}</span><br></div>`;
const pre = (lang, ...lines) =>
  `<pre tabindex="0" class="prism-code language-${lang} codeBlock_bY9V thin-scrollbar"><code class="codeBlockLines_e6Vv">${lines.map(line).join('')}</code></pre>`;

const PAGE = `<!doctype html><html><body>
<h2 id="first-pattern">First Pattern</h2>
<p>Some prose before the block.</p>
${pre('text', 'Research these topics:', '1. One &amp; two', '2. Three')}
<h2 id="second-pattern">Second Pattern</h2>
<p>Say &quot;save what you just did as a skill called <code>deploy-staging</code>.&quot; Next time, type it.</p>
${pre('bash', 'hermes --resume')}
<h3 id="nested">Nested Heading</h3>
<p>Trailing prose with a &#8220;curly quote&#8221; inside.</p>
</body></html>`;

test('code blocks carry their language and the heading they sit under', () => {
  const blocks = codeBlocks(PAGE);
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map(b => b.language), ['text', 'bash']);
  assert.deepEqual(blocks.map(b => b.anchor), ['first-pattern', 'second-pattern']);
  assert.equal(blocks[0].heading, 'First Pattern');
});

test('block text is the text a reader would copy, entities resolved', () => {
  const [first] = codeBlocks(PAGE);
  assert.equal(first.text, 'Research these topics:\n1. One & two\n2. Three');
});

test('a block is attributed to the nearest heading above it, not the first one', () => {
  const blocks = codeBlocks(PAGE);
  assert.equal(blocks[1].anchor, 'second-pattern');
});

test('markup that no longer matches yields nothing rather than guessing', () => {
  assert.deepEqual(codeBlocks('<pre class="something-else"><code>hi</code></pre>'), []);
});

test('every heading anchor on the page is collected', () => {
  const { anchors } = proseSections(PAGE);
  assert.ok(anchors.has('first-pattern') && anchors.has('second-pattern') && anchors.has('nested'));
});

test('prose sections let a quoted, unfenced prompt be found under its heading', () => {
  const { sections } = proseSections(PAGE);
  const second = sections.find(s => s.anchor === 'second-pattern');
  assert.match(second.text, /save what you just did as a skill called deploy-staging/);
});

test('a section stops at the next heading', () => {
  const { sections } = proseSections(PAGE);
  const first = sections.find(s => s.anchor === 'first-pattern');
  assert.ok(!first.text.includes('save what you just did'), 'first section leaked into the second');
});

test('curly quotes are folded so a straight-quoted snippet still matches', () => {
  const { sections } = proseSections(PAGE);
  assert.match(sections.find(s => s.anchor === 'nested').text, /"curly quote"/);
});
