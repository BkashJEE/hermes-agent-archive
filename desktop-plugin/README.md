# Hermes Agent Archive — Desktop plugin preview

Browse the sourced archive inside Hermes Desktop. The wrapper adds an **Archive**
sidebar entry, a status-bar launcher and command-palette shelf shortcuts. It opens
the published archive by default; no local server, API key or archive account is needed.
Internet access is required for the hosted copy.

**Release status:** code and installer tests pass against SDK stand-ins. A versioned
smoke test inside the real Hermes Desktop app is still pending. This is an early
preview, not a catalog-listed or cross-platform-certified plugin. Installing the
file successfully does not establish that Hermes loaded it.

## Install from a clone

Requires Git, Node.js 20+ and Hermes **Desktop** with the desktop plugin SDK. This
is not a plugin for `hermes dashboard` or an agent-side Python plugin. See the
[official SDK and delivery modes](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk).

```bash
git clone https://github.com/BkashJEE/hermes-agent-archive.git
cd hermes-agent-archive
npm run plugin -- --dry
npm run plugin
```

Review `desktop-plugin/plugin.js` first. The installer writes only to
`$HERMES_HOME/desktop-plugins/hermes-archive/plugin.js`, defaulting to your home
folder's `.hermes` directory. There is no dependency install or build.

In Hermes Desktop, check **Capabilities → Plugins** and enable Archive if necessary.
Current versions watch plugin files and support **Reload desktop plugins** in the
command palette. Restart older versions if it does not appear. Then select **Archive**
in the sidebar or **Archive: Open** in the command palette.

If your directory has `.hermes-package.json`, use Hermes to manage that installation.
The installer refuses to overwrite it or delete its ownership marker. Symlinked
installation paths are also refused; choose a real directory through `HERMES_HOME`.

## Update and remove safely

After reviewing an update and pulling it into your clone:

```bash
npm run plugin -- --replace --dry
npm run plugin -- --replace
```

A different installed file is never overwritten silently. `--replace` saves its exact
bytes as `plugin.js.backup-<unique-id>` in the same directory before replacing it.
An identical installation is left alone. Backups are not uploaded anywhere.

```bash
npm run plugin -- --remove --dry
npm run plugin -- --remove
```

Removal first backs up `plugin.js`, then removes that file only. Other files and all
backups stay in place. To restore, copy the chosen backup back to `plugin.js` and reload
desktop plugins. Do not use the installer to remove a package managed by Hermes.

## What is available

- Sidebar page and status-bar launcher.
- Palette actions: open, reload, suggest an entry and all nine content shelves plus Trending.
- Source attribution, filters and browsing through the embedded website.
- Optional address setting for your own fork or local archive.

Chat search, "send to chat", agent tools, personal favourites and offline snapshot
bundling are **not implemented**. Suggestions open a public GitHub issue form. They
never edit the shared archive directly.

## Read a fork or local copy

For a local copy, run `npm start`. In the Hermes Desktop window's developer console:

```js
try {
  localStorage.setItem('hermes-archive:url', 'http://127.0.0.1:4179/');
} catch {
  console.warn('Desktop storage is unavailable; the published archive will be used.');
}
```

Reload the archive route or the Desktop window after changing the setting. Use your
own `https://` URL for a deployed fork. HTTP is allowed only for loopback addresses;
`javascript:`, `data:`, `file:` and other schemes are refused.

To restore the default:

```js
try { localStorage.removeItem('hermes-archive:url'); } catch {}
```

`--local` prints guidance only; it does not change Desktop preferences. Custom hosts
must permit framing. Some failed frame loads do not trigger browser error events;
if you see a blank page, open the configured URL in your browser and check the host's
frame policy and your connection.

## Permissions and privacy

Hermes supplies `react` and `@hermes/plugin-sdk`; this repository installs neither.
The wrapper uses navigation and local browser storage, and opens source/contribution
links. It makes no gateway RPC calls and does not send chat history or local files.

The website frame permits scripts, its own origin and source-link popups. It does
not permit top-level navigation or downloads. **That does not sandbox the plugin:**
Hermes desktop plugin code runs with the app's authority. Only install reviewed code
and configure hosts you trust. See [privacy](../docs/PRIVACY.md) and [security](../SECURITY.md).

## Desktop smoke test

Record the archive commit, OS and exact Hermes Desktop version with the result:

1. Install into a disposable Hermes home/profile and confirm Archive loads without errors.
2. Open Archive from the sidebar and status bar.
3. From another Hermes page, select **Archive: Hidden Tricks** in the command palette;
   it should open that shelf on the first attempt. Repeat while Archive is already open.
4. Search, filter, open and close a card; verify keyboard focus returns to the card.
5. Open an original source and the suggestion form; confirm each opens outside the frame.
6. Check the hosted URL and a local clone. Disconnect the local server and record whether
   a blank frame or the fallback is shown; reconnect and reload.
7. Disable/re-enable the plugin. Test update, backup recovery and removal in the disposable
   installation; retain unrelated files.

Do not claim this checklist passed merely because `npm test` is green. Host-app testing
remains pending until someone records the version and observed result in the PR.
