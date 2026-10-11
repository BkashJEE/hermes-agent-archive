# Verification against the shipped Hermes Desktop

Recorded 2026-10-11 against the host installed on the maintainer's machine. This is
artifact evidence — what the shipped build contains — not a claim that the plugin was
observed running. The runtime smoke test in README.md is a separate record.

## The host

| | |
|---|---|
| Package | `hermes-desktop 2026.8.31-3` (pacman, "Native desktop shell for Hermes Agent"), installed 2026-09-09 |
| App | `hermes 0.17.0`, main `dist/electron-main.mjs` (from `app.asar` `package.json`) |
| Electron | 40.10.2 (`/opt/hermes-desktop/version`) |
| `app.asar` SHA-256 | `516490cc7d6f5b40d9b8a264744647ec4a38f021555929d833325174a5ccf35d` |
| Method | The ASAR header and files read with Node's built-in `fs` only; the unpacked tree at `resources/app.asar.unpacked` read in place. Nothing from the artifact was executed. |

Evidence IDs below are `file@byte-offset` inside `resources/app.asar.unpacked/dist/`.

## What the shipped host does with a desktop plugin

| Observation | Evidence |
|---|---|
| Plugins are discovered under `<hermesHome>/desktop-plugins/` (or `<hermesHome>/profiles/<profile>/desktop-plugins/` when a non-default profile is active); the folder is created if missing | `electron-main.mjs@200938` (`localPluginsRoot`) |
| The entry file is `plugin.js` at the plugin root, else `desktop/plugin.js` | `electron-main.mjs@173954` (`findDesktopEntry`) |
| `plugin.json` is read only for the agent-side (portable) component; a desktop-only plugin needs none | `electron-main.mjs@173700` (`detectPluginComponents`) |
| Install from git goes through `hermes:plugin:installDesktop` → `installDesktopPluginFromGit`, which refuses an existing folder unless forced | `electron-main.mjs@179379`, `@201924` |
| A plugin may import only `@hermes/plugin-sdk`, `react`, `react/jsx-runtime` and `react/jsx-dev-runtime`; those bare imports are rewritten to Blob shims over `globalThis.__HERMES_PLUGIN_SDK__` / `__HERMES_REACT__` …; any other bare import throws `unsupported import … runtime plugins may only import @hermes/plugin-sdk and react` | `assets/session-list-density-D_lREnla.js@117200`, `@118150` |
| An optional `integrity` value (`algo-hash`) is checked before the module is loaded | `session-list-density@118150` |
| The default export must be `{ id, register() }`; an `id` that collides with a bundled plugin is skipped with a console notice | `session-list-density@118150` |
| The SDK global exposes **152 named exports**, including the areas `ROUTES_AREA`, `SIDEBAR_NAV_AREA`, `PALETTE_AREA`, `PANES_AREA`, `KEYBINDS_AREA`, `CHAT_EMPTY_AREA`, `THEMES_AREA`, `TRANSCRIPT_DIRECTIVE_AREA`, `COMPOSER_AREAS`, `STATUSBAR_AREAS`, `TITLEBAR_AREAS`. No export names a version. | `session-list-density@101715` (`kp`), `@116977` (`nm`, `Object.assign(globalThis, tm)`) |
| `register(ctx)` receives `source`, `register`, `registerMany`, `onDispose`, `rest`, `socket`, `os` (`notify`, `openExternal`, `pickOpenPath`, `pickSavePath`, `revealPath`, `writeClipboard` — each routed through the preload bridge `window.hermesDesktop`), `storage` (namespaced `hermes.plugin.<id>.<key>`), `i18n` | `session-list-density@115300` (`em`, `$p`, `Qp`) |
| The renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webviewTag: true`, `webSecurity: true` | `electron-main.mjs@627448`, `@423130` |
| The command palette has `plugins.reload` — "Reload desktop plugins" | `assets/index-DU3kXw10.js@2886956` |
| The host's own embedded iframes use `sandbox="allow-scripts allow-same-origin"` | `assets/index-DU3kXw10.js@344244`, `assets/skills-Dj_YD9E1.js@76259` |

The official SDK page (pinned documentation corpus, revision `1f2b9e0`) states the same
disk path, the same unified-package path, the same import allow-list, `register(ctx)`,
the same area constants and the reload command. The artifact additionally shows the
integrity check and the bundled-id collision rule.

## This plugin against that contract

| Check | Result |
|---|---|
| Entry at plugin root `plugin.js` | yes |
| Bare imports limited to `@hermes/plugin-sdk` and `react` | yes — exactly those two |
| Every named SDK import exists in this host's 152 exports (`host`, `Button`, `Codicon`, `ROUTES_AREA`, `SIDEBAR_NAV_AREA`, `PALETTE_AREA`) | yes — none missing |
| Default export `{ id: 'hermes-archive', register(ctx) }` | yes |
| Registers into `ROUTES_AREA`, `SIDEBAR_NAV_AREA`, `'statusBar.left'`, the palette | areas all defined by the host |
| Opens sources through `ctx.os.openExternal` | provided by the host context |
| No `plugin.json` | not required for a desktop-only plugin |

## What a reader should take from this

The plugin's code is compatible with the contract this build of Hermes Desktop enforces
at load time. The plugin's iframe asks for `allow-scripts allow-same-origin allow-popups
allow-popups-to-escape-sandbox`, which is the plugin's own choice and broader than the
host's own embedded frames; the README's warning stands: plugin code runs in the
renderer with the preload bridge, not as Node.

## The build the plugin actually runs in

The maintainer's running Hermes Desktop is not the installed package: it is a dev build
from the source checkout, `Hermes 0.0.0` at `d94b70f` (2026-10-08), Electron 40.10.2,
`app.asar` SHA-256 `783913d8…`, at `~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/`.
The same checks were re-run against it with the same method:

| | 2026.8.31-3 (installed) | dev `d94b70f` (running) |
|---|---|---|
| SDK named exports | 152 | **190** (adds `APPEARANCE_AREAS`, `SETTINGS_PLUGINS_AREA`, `SIDEBAR_NAV_PREFS_AREA`, `WORKSPACE_PAGE_HEADER_AREA` and others) |
| Plugin's six imports present | all | all |
| Import allow-list (`@hermes/plugin-sdk`, `react`) | same text, `assets/session-list-density-*.js@118150` | same text, `assets/sdk-Cz4StWqA.js@266847` |
| Entry rule `plugin.js` then `desktop/plugin.js` | `electron-main.mjs@173954` | identical, `electron-main.mjs` |
| SDK global mapping `__HERMES_PLUGIN_SDK__` | `@116874` | `@262326` |

## Runtime observation: attempted 2026-10-11, not obtained

What was tried, and why each route stopped, so the next attempt starts further along:

- A second instance in a disposable `HERMES_HOME` exited at once: the host takes
  `app.requestSingleInstanceLock()` (`electron-main.mjs@32593`), so a smoke test in a
  disposable home needs the running app closed first. It had been up for 3h40m; it was
  not closed.
- The GUI driver (cua-driver 0.34.0) enumerates no top-level windows on this Wayland
  compositor, and the X11 route sees none because the app runs native Wayland.
- AT-SPI is enabled on the session and lists a `Hermes` application, but the window
  frame exposes no descendants: this Electron build does not publish its renderer tree
  until accessibility is forced on, which means a restart with that flag.
- Full-display capture would show every other window on the desktop and needs the
  owner's explicit approval; it was not requested silently.

So the record stands at: **statically verified against both builds; runtime not yet
observed.** The README checklist remains pending.

## Unknown

- Neither build exposes an SDK version constant, so "SDK version" cannot be stated from
  the artifact; the pins are the app, package and commit identities above.
- Whether the plugin **renders** in either host: static evidence cannot show execution.
