#!/usr/bin/env node
/**
 * Install the Hermes Desktop plugin for this archive.
 *
 *   npm run plugin            # install, then say what to do next
 *   npm run plugin -- --dry   # print where it would go, write nothing
 *   npm run plugin -- --local # point it at your own copy on http://127.0.0.1:4179
 *   npm run plugin -- --remove
 *
 * Hermes scans one directory for desktop plugins on every platform, so this is a copy and
 * a message rather than a build. The plugin frames the published archive by default, which
 * means installing it is the whole install: there is no server to run and nothing to keep
 * alive afterwards.
 *
 * It refuses to write the `.hermes-package.json` marker beside the file. That marker tells
 * Hermes the folder belongs to an installed agent package, which loads the plugin disabled
 * and lets Hermes delete the folder later.
 */

import { readFile, writeFile, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'desktop-plugin', 'plugin.js');
const PLUGIN_ID = 'hermes-archive';
const LOCAL_URL = 'http://127.0.0.1:4179/';

/** Where Hermes keeps its home, honouring an explicit override. */
export function hermesHome(env = process.env, home = homedir()) {
  const configured = env.HERMES_HOME?.trim();
  return configured || join(home, '.hermes');
}

/** The one directory Hermes scans for desktop plugins, on every platform. */
export function pluginTarget(home = hermesHome()) {
  return join(home, 'desktop-plugins', PLUGIN_ID, 'plugin.js');
}

const flag = name => process.argv.includes(`--${name}`);

async function main() {
  const target = pluginTarget();
  const folder = dirname(target);

  if (flag('remove')) {
    await rm(folder, { recursive: true, force: true });
    console.log(`Removed ${folder}`);
    console.log('Restart Hermes Desktop: plugins on disk are scanned at startup, not on reload.');
    return;
  }

  const source = await readFile(SOURCE, 'utf8').catch(() => null);
  if (!source) throw new Error(`Cannot read ${SOURCE}. Run this from a clone of the archive.`);

  if (flag('dry')) {
    console.log(`Would write ${source.length} bytes to:\n  ${target}`);
    return;
  }

  await mkdir(folder, { recursive: true });
  await writeFile(target, source);

  /* Never leave the package marker behind: it disables the plugin and marks the folder
     as disposable. Checked rather than assumed, in case an older install wrote one. */
  const marker = join(folder, '.hermes-package.json');
  if (await stat(marker).then(() => true).catch(() => false)) {
    await rm(marker, { force: true });
    console.log('Removed a stale .hermes-package.json, which would have loaded the plugin disabled.');
  }

  console.log(`Installed the archive plugin:\n  ${target}\n`);
  console.log('Restart Hermes Desktop. Plugins on disk are scanned at startup, not on reload.');
  console.log('Then: "Archive" in the sidebar, or the command palette — Archive: Open.\n');

  if (flag('local')) {
    console.log('To read your own copy instead of the published one, run this in the');
    console.log("Hermes Desktop window's console, then reload the page:\n");
    console.log(`  localStorage.setItem('hermes-archive:url', '${LOCAL_URL}')\n`);
    console.log('and serve it with `npm start` from your clone.');
  } else {
    console.log('It opens the published archive. To read your own copy instead, see');
    console.log('desktop-plugin/README.md.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
