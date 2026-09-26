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

let requestedShelf = null;

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
export function archiveUrl(store) {
  let raw;
  try {
    if (store === undefined) store = globalThis.localStorage;
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

export function ArchivePage({ url = shelfUrl(requestedShelf), failed: initiallyFailed = false }) {
  const [nonce, setNonce] = useState(0);
  const [failed, setFailed] = useState(initiallyFailed);
  const frame = useRef(null);

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
    failed
      ? h(Unreachable, { url, onReload: reload })
      : h('iframe', {
          key: nonce,
          ref: frame,
          src: url,
          title: 'Hermes Agent Archive',
          onError: () => setFailed(true),
          referrerPolicy: 'no-referrer',
          /* A read-only catalogue. It needs scripts and its own origin to fetch its JSON,
             and it needs to open links: following a source to the original post is the
             entire point of the archive, and every one of those is target="_blank".
             allow-popups on its own would open them still sandboxed, so the escape clause
             hands them to the real browser as ordinary pages. Downloads and top-level
             navigation stay refused, so a framed page cannot move the host or drop a file
             on the reader. */
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
  ['tricks', 'Hidden Tricks', ['tricks', 'discoveries']],
  ['toolkit', 'Works With', ['integrations', 'tools']],
  ['builds', 'People Build', ['projects', 'builds']],
  ['my-work', 'My Work', ['posts', 'maintainer']],
  ['trending', 'Trending GitHub', ['trending', 'stars', 'growth']]
];

const openShelf = shelf => {
  // Retain the selection before navigation: the route may not be mounted yet.
  requestedShelf = shelf;
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
      { id: 'page', area: ROUTES_AREA, data: { path: PAGE_PATH }, render: () => h(ArchivePage, {}) },
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
          run: () => globalThis.open?.(
            'https://github.com/BkashJEE/hermes-agent-archive/issues/new?template=submit-entry.yml',
            '_blank', 'noopener,noreferrer')
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
