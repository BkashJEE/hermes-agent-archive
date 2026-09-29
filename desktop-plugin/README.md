# Hermes Agent Archive — Desktop plugin

Puts the archive inside Hermes Desktop: a sidebar entry, a status-bar launcher, and
command-palette actions for each shelf and for suggesting an entry.

The plugin is one file. It holds no data, has no backend of its own, and stores nothing
but the address it was told to open.

## Install

From a clone of the archive:

```bash
npm run plugin
```

Then restart Hermes Desktop — plugins on disk are scanned at startup, not on reload.
That is the whole install. There is no server to run and nothing to keep alive, because
the plugin opens the published archive.

By hand, if you prefer: copy `desktop-plugin/plugin.js` to
`~/.hermes/desktop-plugins/hermes-archive/plugin.js`. Set `HERMES_HOME` if yours is
somewhere else. Do not put a `.hermes-package.json` beside it — that marker tells Hermes
the folder belongs to an installed agent package, which loads the plugin disabled and lets
Hermes delete the folder later.

```bash
npm run plugin -- --dry      # show where it would go
npm run plugin -- --remove   # take it out again
```

## Read your own copy instead

Everyone gets the published archive by default. To read your own — a fork you have
deployed, or a local clone — set the address in the Hermes Desktop window's console and
reload the page:

```js
localStorage.setItem('hermes-archive:url', 'https://your-fork.example.com/')
```

For a local clone, serve it first with `npm start` and point at that:

```js
localStorage.setItem('hermes-archive:url', 'http://127.0.0.1:4179/')
```

Clear the setting to go back to the published archive:

```js
localStorage.removeItem('hermes-archive:url')
```

Two shapes of address are accepted and nothing else: **any `https:` address**, so a fork
on someone else's host works, and **plain `http:` only on loopback**, because that is the
local preview server and `npm start` does not offer TLS. A `javascript:`, `data:` or
`file:` setting is discarded and the published archive is opened instead. A framed page
keeps its own origin, so the risk of a loose rule here is not to Hermes but to you: you
would have no way of telling a swapped-in page from the archive.

## What it adds

| Where | What |
| --- | --- |
| Sidebar | **Archive** |
| Status bar | **Archive**, to the left |
| Palette | `Archive: Open`, `Archive: Reload`, `Archive: Suggest an entry` |
| Palette | One per shelf — Use Cases, Skills, Prompts, Commands, Settings, Trending GitHub |

Suggesting an entry costs the same keystroke as reading one, which is the point: the
archive is only worth having if the people using it can add to it.

## How it works

`react` and `@hermes/plugin-sdk` are supplied by the Hermes Desktop runtime at load time,
so neither is a dependency of this repository and the archive stays dependency-free. The
tests resolve both specifiers to a stub in `test-stubs.mjs` rather than installing React to
exercise one file.

The framed page needs scripts and its own origin to fetch its JSON. Its existing sandbox
permissions are preserved, but Hermes separately denies popup requests, including ordinary
`target="_blank"` links. Downloads and top-level navigation remain refused.

**Read workflow** opens the detail drawer inside the archive. **Read the original**
shows the destination above the frame; choose **Open source** to open it in your browser.
The plugin verifies the message's frame and origin, accepts only HTTP(S) links, and calls
Hermes's `ctx.os.openExternal` API only after that confirmation. A frame message alone
cannot open a browser. If the host API is unavailable or refuses the link, an error and a
copyable address remain visible. **Open archive in browser** offers a direct fallback.

This requires both the updated website (`assets/js/desktop-bridge.js`) and the updated
plugin. After updating your clone, rerun `npm run plugin` and restart Hermes Desktop.
Self-hosted copies must also update their served website. Standalone website links keep
their normal browser behavior. The plugin does not change Hermes's popup security policy.

## Tests

```bash
npm test          # the plugin's tests run with the rest
```

`scripts/desktop-plugin.test.mjs` covers the address policy, the shelf deep links, the
registered contributions, the sandbox, the unreachable states and source-link validation.
`scripts/desktop-bridge.test.mjs` covers the frame handshake and click interception without
network access. Native Desktop behavior still needs a manual smoke test after installation.
