#!/usr/bin/env node
/** Copy the reviewed desktop plugin; preserve existing files and package ownership. */
import { readFile, writeFile, mkdir, unlink, rename, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'desktop-plugin', 'plugin.js');
const PLUGIN_ID = 'hermes-archive';

export function hermesHome(env = process.env, home = homedir()) {
  return env.HERMES_HOME?.trim() || join(home, '.hermes');
}
export function pluginTarget(home = hermesHome()) {
  return join(home, 'desktop-plugins', PLUGIN_ID, 'plugin.js');
}
const exists = async path => lstat(path).catch(e => {
  if (e.code === 'ENOENT') return null;
  throw e;
});

export async function install({ home = hermesHome(), args = process.argv.slice(2) } = {}) {
  const allowed = new Set(['--dry', '--local', '--remove', '--replace']);
  if (args.some(a => !allowed.has(a)) || (args.includes('--remove') && (args.includes('--local') || args.includes('--replace'))))
    throw new Error('Use --dry, --local, --replace, or --remove; removal cannot be combined with --local/--replace.');
  const dry = args.includes('--dry'), remove = args.includes('--remove');
  const target = resolve(pluginTarget(home)), folder = dirname(target);
  // Refuse symlinked components rather than write/remove another installation's files.
  for (let path = target; ; path = dirname(path)) {
    const info = await exists(path);
    if (info?.isSymbolicLink()) throw new Error(`Refusing a symlinked installation path: ${path}`);
    if (path === resolve(home) || path === dirname(path)) break;
  }
  if (await exists(join(folder, '.hermes-package.json')))
    throw new Error('This directory is managed by Hermes. Update or uninstall it through Hermes; its package marker was preserved.');
  const previous = await readFile(target).catch(e => {
    if (e.code === 'ENOENT') return null;
    throw e;
  });
  const source = remove ? null : await readFile(SOURCE);
  if (!remove && !source.length) throw new Error('Plugin source is empty; installation untouched.');
  if (remove && !previous) { console.log('Archive plugin is not installed.'); return; }
  if (!remove && previous?.equals(source)) { console.log('The current Archive plugin is already installed.'); return; }
  if (!remove && previous && !args.includes('--replace'))
    throw new Error('A different plugin file is installed. Review it first, then use --replace to back it up and update.');
  if (dry) { console.log(`Would ${remove ? 'back up and remove' : previous ? 'back up and replace' : 'install'} ${target}. No files changed.`); return; }

  await mkdir(folder, { recursive: true });
  if (previous) {
    const backup = `${target}.backup-${randomUUID()}`;
    await writeFile(backup, previous, { flag: 'wx', mode: 0o600 });
    console.log(`Previous plugin preserved at ${backup}`);
  }
  if (remove) {
    await unlink(target); // Only our entry file, never the whole directory.
    console.log('Removed plugin.js; backups and other files are preserved.');
  } else {
    const staged = `${target}.tmp-${randomUUID()}`;
    try {
      await writeFile(staged, source, { flag: 'wx', mode: 0o600 });
      await rename(staged, target);
    } finally {
      await unlink(staged).catch(e => { if (e.code !== 'ENOENT') throw e; });
    }
    console.log(`Installed the archive plugin: ${target}`);
    if (args.includes('--local'))
      console.log('For a local copy, run npm start and configure hermes-archive:url as described in desktop-plugin/README.md. This flag does not change Desktop settings.');
  }
  console.log('In Hermes Desktop: Reload desktop plugins in the command palette, then check Capabilities → Plugins. Restart older versions if needed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  install().catch(e => { console.error(e.message); process.exitCode = 1; });
