import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { install, pluginTarget } from './install-plugin.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'archive-plugin-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, 'hermes'), target = pluginTarget(home);
  return { root, home, target, folder: dirname(target) };
}

test('fresh install and repeat install need no credentials or changes elsewhere', async t => {
  const { home, target, folder } = await fixture(t);
  await install({ home, args: [] });
  const source = await readFile(new URL('../desktop-plugin/plugin.js', import.meta.url));
  assert.deepEqual(await readFile(target), source);
  await install({ home, args: [] });
  assert.deepEqual(await readdir(folder), ['plugin.js']);
});

test('dry install and dry removal leave files untouched', async t => {
  const { home, target, folder } = await fixture(t);
  await install({ home, args: ['--dry'] });
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  await install({ home, args: [] });
  const before = await readFile(target);
  await install({ home, args: ['--remove', '--dry'] });
  assert.deepEqual(await readFile(target), before);
  assert.deepEqual(await readdir(folder), ['plugin.js']);
});

test('updates refuse silent overwrite and explicit replacement preserves a backup', async t => {
  const { home, target, folder } = await fixture(t);
  await mkdir(folder, { recursive: true });
  await writeFile(target, '// my customized plugin');
  await assert.rejects(install({ home, args: [] }), /different plugin/);
  assert.equal(await readFile(target, 'utf8'), '// my customized plugin');
  await install({ home, args: ['--replace'] });
  const backup = (await readdir(folder)).find(f => f.startsWith('plugin.js.backup-'));
  assert.equal(await readFile(join(folder, backup), 'utf8'), '// my customized plugin');
});

test('removal backs up only the plugin and retains unrelated files', async t => {
  const { home, target, folder } = await fixture(t);
  await install({ home, args: [] });
  const before = await readFile(target);
  await writeFile(join(folder, 'notes.txt'), 'keep');
  await install({ home, args: ['--remove'] });
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  assert.equal(await readFile(join(folder, 'notes.txt'), 'utf8'), 'keep');
  const backup = (await readdir(folder)).find(f => f.startsWith('plugin.js.backup-'));
  assert.deepEqual(await readFile(join(folder, backup)), before);
});

test('package-managed installs and symlink destinations are preserved', async t => {
  const { home, target, folder, root } = await fixture(t);
  await mkdir(folder, { recursive: true });
  const marker = join(folder, '.hermes-package.json');
  await writeFile(marker, '{}');
  await assert.rejects(install({ home, args: [] }), /managed by Hermes/);
  await assert.rejects(install({ home, args: ['--remove'] }), /managed by Hermes/);
  assert.equal(await readFile(marker, 'utf8'), '{}');
  await rm(marker);
  const other = join(root, 'other.js');
  await writeFile(other, 'keep');
  await symlink(other, target);
  await assert.rejects(install({ home, args: ['--replace'] }), /symlinked/);
  await assert.rejects(install({ home, args: ['--remove'] }), /symlinked/);
  assert.equal(await readFile(other, 'utf8'), 'keep');
});

test('unknown CLI flags exit nonzero without installing anything', async t => {
  const { home, target } = await fixture(t);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./install-plugin.mjs', import.meta.url)), '--typo'], { env: { ...process.env, HERMES_HOME: home }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
});
