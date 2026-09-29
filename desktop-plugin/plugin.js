import { createElement as h, useState, useRef, useCallback, useEffect } from 'react';
import { host, Button, Codicon, ROUTES_AREA, SIDEBAR_NAV_AREA, PALETTE_AREA } from '@hermes/plugin-sdk';

/**
 * Hermes Agent Archive, inside Hermes Desktop.
 *
 * The plugin is this one file. It holds no data, has no backend of its own, and stores
 * nothing but the address it was told to open. Both of its imports are supplied by the
 * Hermes Desktop runtime at load time, so the archive stays a zero-dependency project.
 *
 * Unlike a plugin that frames something on your own machine, this one needs no install
 * beyond itself: the archive is published, so the default address works for everybody the
 * moment the file lands. Pointing it at your own copy is the setting below, which is the
 * whole answer to "can everyone use it and still keep their own".
 */

export const PAGE_PATH = '/archive';
export const ARCHIVE_URL = 'https://hermes-agent-archive.vercel.app';
export const SETTING = 'hermes-archive:url';

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

/**
 * The address to open: whatever is configured, when it is one we are willing to frame.
 *
 * A framed page keeps its own origin, so the risk is not to Hermes but to the reader, who
 * would have no way of telling a swapped-in page from the archive. Two shapes are allowed
 * and nothing else: any https address, so a fork on someone else's host works, and plain
 * http only on loopback, because that is the local preview server and `npm start` does not
 * offer TLS. A javascript:, data: or file: setting is discarded rather than honoured.
 */
export function archiveUrl(store = globalThis.localStorage) {
  let raw;
  try {
    raw = typeof store?.getItem === 'function' ? store.getItem(SETTING) : store?.[SETTING];
  } catch {
    return ARCHIVE_URL;                        // private mode, or storage blocked
  }
  if (!raw || typeof raw !== 'string') return ARCHIVE_URL;
  try {
    const url = new URL(raw.trim());
    if (url.protocol === 'https:') return url.href;
    if (url.protocol === 'http:' && LOOPBACK.has(url.hostname)) return url.href;
    return ARCHIVE_URL;
  } catch {
    return ARCHIVE_URL;
  }
}

/** Deep-link to one shelf. The archive routes on the hash, so this is all it takes. */
export function shelfUrl(shelf, url = archiveUrl()) {
  const base = url.split('#')[0];
  return shelf ? `${base}#${shelf}` : base;
}

/** True when the address is on this machine, which changes the advice we can give. */
export function isLocal(url) {
  try { return LOOPBACK.has(new URL(url).hostname); } catch { return false; }
}

export function Unreachable({ url, onReload }) {
  const local = isLocal(url);
  const text = { margin: '0 0 8px', fontSize: '13px', lineHeight: 1.6 };
  return h('div', { role: 'alert', style: { padding: '20px 18px', color: 'var(--ui-text-primary)', maxWidth: '62ch' } },
    h('p', { style: { ...text, fontWeight: 600 } }, `The archive did not load from ${url}.`),
    local
      ? h('div', null,
          h('p', { style: text }, 'That is a local address, so something has to be serving it. From a clone of the archive:'),
          h('pre', { style: { ...text, fontFamily: 'ui-monospace, monospace', fontSize: '12px', whiteSpace: 'pre-wrap' } },
            'git clone https://github.com/BkashJEE/hermes-agent-archive\ncd hermes-agent-archive\nnpm start'),
          h('p', { style: { ...text, fontSize: '12px' } },
            'No install step: the archive has no dependencies and no build.'))
      : h('p', { style: text },
          'Check the connection, or clear the ' + SETTING + ' setting in this window’s local storage to go back to the published archive.'),
    h(Button, { variant: 'outline', size: 'sm', onClick: onReload }, 'Reload'));
}

/** Messages can propose an HTTP(S) link; only the host's visible button opens it. */
export function requestedSource(event, source, origin) {
  if (!source || event.source !== source || event.origin !== origin ||
      event.data?.type !== 'hermes-archive:open-source' || typeof event.data.url !== 'string' ||
      event.data.url.length > 4096) return null;
  try {
    const url = new URL(event.data.url);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function openSource(url, openExternal) {
  try { return typeof openExternal === 'function' && await openExternal(url) === true; }
  catch { return false; }
}

export function ArchivePage({ url = archiveUrl(), failed: initiallyFailed = false, openExternal }) {
  const [nonce, setNonce] = useState(0);
  const [failed, setFailed] = useState(initiallyFailed);
  const frame = useRef(null);
  const [pendingSource, setPendingSource] = useState(null);
  const [linkError, setLinkError] = useState('');
  const sourceBusy = useRef(false);
  const origin = new URL(url).origin;
  const ready = () => frame.current?.contentWindow?.postMessage({ type: 'hermes-archive:host-ready' }, origin);
  useEffect(() => {
    const receive = event => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return;
      if (event.data?.type === 'hermes-archive:frame-ready') { ready(); return; }
      const requested = requestedSource(event, frame.current?.contentWindow, origin);
      if (requested && !sourceBusy.current) {
        sourceBusy.current = true; // Later frame messages cannot swap the displayed destination.
        setLinkError(''); setPendingSource(requested);
      }
    };
    globalThis.addEventListener?.('message', receive);
    return () => globalThis.removeEventListener?.('message', receive);
  }, [origin]);
  const dismissSource = () => { sourceBusy.current = false; setPendingSource(null); setLinkError(''); };
  const confirmSource = async () => {
    if (await openSource(pendingSource, openExternal)) dismissSource();
    else setLinkError('Hermes could not open the browser. Copy the address below into your browser.');
  };

  const reload = useCallback(() => { setFailed(false); setNonce(n => n + 1); }, []);

  /* Palette actions reach the mounted page through these events rather than by changing
     src on a live frame, which would reload it underneath the reader. */
  useEffect(() => {
    const onReload = () => reload();
    const onShelf = event => {
      const target = frame.current;
      if (target) target.src = shelfUrl(event?.detail, url);
    };
    globalThis.addEventListener?.('hermes-archive:reload', onReload);
    globalThis.addEventListener?.('hermes-archive:shelf', onShelf);
    return () => {
      globalThis.removeEventListener?.('hermes-archive:reload', onReload);
      globalThis.removeEventListener?.('hermes-archive:shelf', onShelf);
    };
  }, [reload, url]);

  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--ui-bg-base)' } },
    h('div', { style: { padding: '8px 12px', color: 'var(--ui-text-primary)' } },
      h(Button, { variant: 'outline', size: 'sm', onClick: async () => {
        setLinkError('');
        if (!await openSource(url, openExternal)) setLinkError(`Hermes could not open the browser. Copy this address into your browser: ${url}`);
      } }, 'Open archive in browser'),
      pendingSource ? h('div', { role: 'region', 'aria-label': 'Open original source', style: { paddingTop: '8px' } },
        h('p', null, 'Open this source in your browser?'),
        h('input', { 'aria-label': 'Source address', readOnly: true, value: pendingSource, style: { width: '100%', color: 'var(--ui-text-primary)', background: 'var(--ui-bg-base)' } }),
        h(Button, { autoFocus: true, onClick: confirmSource }, 'Open source'),
        h(Button, { onClick: dismissSource }, 'Cancel')) : null,
      linkError ? h('p', { role: 'status' }, linkError) : null),
    failed
      ? h(Unreachable, { url, onReload: reload })
      : h('iframe', {
          key: nonce,
          ref: frame,
          src: url,
          title: 'Hermes Agent Archive',
          onError: () => setFailed(true),
          onLoad: ready,
          referrerPolicy: 'no-referrer',
          /* Scripts and the page's own origin are needed to fetch archive JSON.
             Keep the existing sandbox permissions; Hermes separately denies popups.
             Source links use the confirmed host API above, never that popup path.
             Downloads and top-level navigation remain refused. */
          sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
          style: { flex: 1, width: '100%', border: 0, background: 'var(--ui-bg-base)' }
        }));
}

function ArchiveStatus() {
  return h('button', {
    className: 'inline-flex items-center gap-1 rounded px-1.5 text-xs text-(--ui-text-secondary) hover:bg-(--ui-bg-hover)',
    'aria-label': 'Open the Hermes Agent Archive', title: 'Hermes Agent Archive',
    onClick: () => host.navigate(PAGE_PATH)
  }, h(Codicon, { name: 'archive' }), 'Archive');
}

/* The shelves worth a keystroke. Deep links are the archive's own hash routes. */
export const SHELVES = [
  ['use-cases', 'Use Cases', ['stories', 'workflows', 'community']],
  ['skills', 'Skills', ['skill', 'install', 'capability']],
  ['prompts', 'Prompts', ['prompt', 'copy', 'example']],
  ['commands', 'Commands', ['command', 'cli', 'slash']],
  ['settings', 'Settings', ['setting', 'config', 'option']],
  ['trending', 'Trending GitHub', ['trending', 'stars', 'growth']]
];

const openShelf = shelf => {
  host.navigate(PAGE_PATH);
  globalThis.dispatchEvent?.(new CustomEvent('hermes-archive:shelf', { detail: shelf }));
};

export default {
  id: 'hermes-archive',
  name: 'Hermes Agent Archive',
  defaultEnabled: true,
  description: 'Sourced Hermes Agent workflows, prompts, skills and commands, inside Hermes Desktop.',
  register(ctx) {
    const contributions = [
      { id: 'page', area: ROUTES_AREA, data: { path: PAGE_PATH }, render: () => h(ArchivePage, { openExternal: link => ctx.os?.openExternal?.(link) }) },
      { id: 'nav', area: SIDEBAR_NAV_AREA, order: 56, data: { codicon: 'archive', label: 'Archive', path: PAGE_PATH } },
      { id: 'status', area: 'statusBar.left', render: () => h(ArchiveStatus, {}) },
      { id: 'open', area: PALETTE_AREA, data: {
          id: 'hermes-archive.open', label: 'Archive: Open',
          keywords: ['archive', 'hermes', 'workflows', 'prompts', 'skills'],
          run: () => host.navigate(PAGE_PATH)
        } },
      { id: 'reload', area: PALETTE_AREA, data: {
          id: 'hermes-archive.reload', label: 'Archive: Reload',
          keywords: ['archive', 'reload', 'refresh'],
          run: () => { host.navigate(PAGE_PATH); globalThis.dispatchEvent?.(new CustomEvent('hermes-archive:reload')); }
        } },
      /* Reading it and adding to it should cost the same effort. */
      { id: 'submit', area: PALETTE_AREA, data: {
          id: 'hermes-archive.submit', label: 'Archive: Suggest an entry',
          keywords: ['archive', 'submit', 'contribute', 'suggest', 'add'],
          run: async () => {
            const opened = await openSource('https://github.com/BkashJEE/hermes-agent-archive/issues/new?template=submit-entry.yml', link => ctx.os?.openExternal?.(link));
            if (!opened) host.notify?.({ kind: 'error', message: 'Could not open your browser. Visit the archive repository to suggest an entry.' });
          }
        } },
      ...SHELVES.map(([shelf, label, keywords]) => ({
        id: `shelf-${shelf}`, area: PALETTE_AREA, data: {
          id: `hermes-archive.${shelf}`, label: `Archive: ${label}`,
          keywords: ['archive', ...keywords],
          run: () => openShelf(shelf)
        }
      }))
    ];
    return ctx.registerMany ? ctx.registerMany(contributions) : contributions.map(c => ctx.register(c));
  }
};
