import test from 'node:test';
import assert from 'node:assert/strict';
import { installDesktopBridge } from '../assets/js/desktop-bridge.js';

function fixture() {
  const messages = [], listeners = {}, clicks = {};
  const parent = { postMessage: (data, origin) => messages.push({ data, origin }) };
  const win = { parent, addEventListener: (t, f) => { listeners[t] = f; }, removeEventListener: t => delete listeners[t] };
  const doc = { addEventListener: (t, f) => { clicks[t] = f; }, removeEventListener: t => delete clicks[t] };
  const stop = installDesktopBridge(win, doc);
  const click = (changes = {}) => {
    let prevented = false;
    clicks.click({ isTrusted: true, button: 0, target: { closest: () => ({ href: 'https://example.com/source' }) }, preventDefault: () => { prevented = true; }, ...changes });
    return prevented;
  };
  return { parent, win, messages, listeners, clicks, click, stop };
}

test('standalone browsing installs no interception', () => {
  const win = {}; win.parent = win;
  assert.doesNotThrow(() => installDesktopBridge(win, {})());
});

test('embedded clicks retain normal behavior until the actual parent acknowledges', () => {
  const f = fixture();
  assert.equal(f.messages[0].data.type, 'hermes-archive:frame-ready');
  assert.equal(f.click(), false);
  f.listeners.message({ source: {}, origin: 'https://wrong.test', data: { type: 'hermes-archive:host-ready' } });
  assert.equal(f.click(), false);
  f.listeners.message({ source: f.parent, origin: 'null', data: { type: 'hermes-archive:host-ready' } });
  assert.equal(f.click(), true);
  assert.deepEqual(f.messages.at(-1), { data: { type: 'hermes-archive:open-source', url: 'https://example.com/source' }, origin: '*' });
  f.stop(); assert.equal(f.listeners.message, undefined); assert.equal(f.clicks.click, undefined);
});

test('only ordinary trusted web-link clicks become source requests', () => {
  const f = fixture();
  f.listeners.message({ source: f.parent, origin: 'https://host.test', data: { type: 'hermes-archive:host-ready' } });
  for (const change of [{ isTrusted: false }, { ctrlKey: true }, { metaKey: true }, { defaultPrevented: true }, { target: { closest: () => null } }, { target: { closest: () => ({ href: 'javascript:alert(1)' }) } }])
    assert.equal(f.click(change), false);
  assert.equal(f.messages.length, 1);
  assert.equal(f.click(), true);
  assert.equal(f.messages.at(-1).origin, 'https://host.test');
});
