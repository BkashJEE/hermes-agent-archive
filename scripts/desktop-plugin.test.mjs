/**
 * The Hermes Desktop plugin.
 *
 * `react` and `@hermes/plugin-sdk` come from the Hermes runtime, not from this repository,
 * so the loader hook below points both at a stub. That keeps the archive dependency-free:
 * installing React to test one file would contradict the thing the project claims.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

const STUBS = new URL('../desktop-plugin/test-stubs.mjs', import.meta.url).href;

register(`data:text/javascript,
  export async function resolve(specifier, context, next) {
    if (specifier === 'react' || specifier === '@hermes/plugin-sdk')
      return { url: ${JSON.stringify(STUBS)}, shortCircuit: true };
    return next(specifier, context);
  }`, pathToFileURL('./'));

const plugin = await import('../desktop-plugin/plugin.js');
const { archiveUrl, shelfUrl, isLocal, ARCHIVE_URL, SETTING, SHELVES, PAGE_PATH } = plugin;

const store = value => ({ getItem: () => value });

test('with nothing configured it opens the published archive', () => {
  assert.equal(archiveUrl(store(null)), ARCHIVE_URL);
  assert.equal(archiveUrl(store('')), ARCHIVE_URL);
});

test('anyone can point it at their own copy over https', () => {
  assert.equal(archiveUrl(store('https://my-fork.example.com/')), 'https://my-fork.example.com/');
});

test('a local preview is allowed over plain http, because npm start offers no TLS', () => {
  for (const at of ['http://127.0.0.1:4179/', 'http://localhost:4179/', 'http://[::1]:4179/'])
    assert.equal(archiveUrl(store(at)), at, `${at} should be framed`);
});

test('plain http to somewhere else is refused', () => {
  assert.equal(archiveUrl(store('http://example.com/')), ARCHIVE_URL);
});

test('a scheme that could run as the page is discarded, not honoured', () => {
  for (const hostile of ['javascript:alert(1)', 'data:text/html,<h1>hi', 'file:///etc/passwd', 'not a url'])
    assert.equal(archiveUrl(store(hostile)), ARCHIVE_URL, `${hostile} must not be framed`);
});

test('storage that throws falls back rather than breaking the page', () => {
  assert.equal(archiveUrl({ getItem() { throw new Error('blocked in private mode'); } }), ARCHIVE_URL);
});

test('a shelf deep link replaces the hash rather than stacking onto it', () => {
  assert.equal(shelfUrl('skills', 'https://x.test/#use-cases'), 'https://x.test/#skills');
  assert.equal(shelfUrl(null, 'https://x.test/#skills'), 'https://x.test/');
});

test('local addresses are recognised, so the error text can say something useful', () => {
  assert.equal(isLocal('http://127.0.0.1:4179/'), true);
  assert.equal(isLocal(ARCHIVE_URL), false);
});

test('the plugin registers a page, a nav entry and its palette actions', () => {
  const registered = [];
  plugin.default.register({ register: c => registered.push(c) });
  const ids = registered.map(c => c.id);
  assert.ok(ids.includes('page') && ids.includes('nav') && ids.includes('status'));
  assert.ok(ids.includes('submit'), 'suggesting an entry should cost one keystroke too');
  for (const [shelf] of SHELVES) assert.ok(ids.includes(`shelf-${shelf}`), `${shelf} has no palette action`);
  assert.equal(registered.find(c => c.id === 'page').data.path, PAGE_PATH);
});

test('registerMany is used when the host offers it', () => {
  let batched = null;
  plugin.default.register({ registerMany: list => { batched = list; return list; } });
  assert.ok(Array.isArray(batched) && batched.length > 6);
});

test('the framed page is sandboxed and cannot navigate the host away', () => {
  const page = plugin.ArchivePage({ url: ARCHIVE_URL });
  const frame = page.children.find(c => c.type === 'iframe');
  assert.ok(frame, 'no iframe rendered');
  const sandbox = frame.props.sandbox.split(' ');
  assert.ok(sandbox.includes('allow-scripts'), 'the archive needs scripts to fetch its JSON');
  assert.ok(!sandbox.includes('allow-top-navigation'), 'a framed page must not move the host');
  assert.ok(!sandbox.includes('allow-downloads'), 'a read-only catalogue has nothing to download');
  /* Following a source to the original post is the point of the archive, and every one of
     those links is target="_blank". Without both of these they are simply dead. */
  assert.ok(sandbox.includes('allow-popups'), 'source links would not open at all');
  assert.ok(sandbox.includes('allow-popups-to-escape-sandbox'),
    'source links would open still sandboxed instead of as ordinary pages');
  assert.equal(frame.props.referrerPolicy, 'no-referrer');
});

test('a failed load stops framing the page and hands over to the explanation', () => {
  const failed = plugin.ArchivePage({ url: 'http://127.0.0.1:4179/', failed: true });
  const child = failed.children[0];
  assert.equal(child.type, plugin.Unreachable, 'a failed load should not still render an iframe');
});

test('an unreachable local address says how to serve it', () => {
  const text = JSON.stringify(plugin.Unreachable({ url: 'http://127.0.0.1:4179/', onReload() {} }));
  assert.ok(text.includes('npm start'), 'no instruction for starting the local server');
  assert.ok(text.includes('git clone'), 'no instruction for getting a copy');
});

test('an unreachable remote address names the setting to clear', () => {
  const text = JSON.stringify(plugin.Unreachable({ url: ARCHIVE_URL, onReload() {} }));
  assert.ok(text.includes(SETTING), 'the reader is not told which setting sent them there');
  assert.ok(!text.includes('npm start'), 'a published address should not tell people to run a server');
});
