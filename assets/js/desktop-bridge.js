/* Embedded source links become a request, never permission to open a browser. */
export function installDesktopBridge(win = window, doc = document) {
  if (win.parent === win) return () => {};
  let hostOrigin = null;
  const receive = event => {
    if (event.source === win.parent && event.data?.type === 'hermes-archive:host-ready')
      hostOrigin = event.origin === 'null' ? '*' : event.origin;
  };
  const click = event => {
    const link = event.target?.closest?.('a[target="_blank"]');
    if (!hostOrigin || !event.isTrusted || event.defaultPrevented || !link ||
        event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return;
    event.preventDefault();
    win.parent.postMessage({ type: 'hermes-archive:open-source', url: url.href }, hostOrigin);
  };
  win.addEventListener('message', receive);
  doc.addEventListener('click', click);
  win.parent.postMessage({ type: 'hermes-archive:frame-ready' }, '*');
  return () => { win.removeEventListener('message', receive); doc.removeEventListener('click', click); };
}
