import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchiveServer } from './serve.mjs';

test('local preview serves runtime files and refuses private files, traversal and symlinks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'hermes-serve-test-'));
  let server;
  t.after(async () => {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    await rm(root, {recursive:true, force:true});
  });
  for (const dir of ['data', 'assets', '.git', 'scripts']) await mkdir(join(root, dir));
  const files = {'index.html':'<h1>Archive</h1>', 'assets/app.js':'export const ready=true;',
    'data/index.json': JSON.stringify({sections:[{id:'computed'}, {id:'stories',file:'stories.json'}]}),
    'data/stories.json':'{"items":[]}', '.env':'TEST_SENTINEL_NOT_A_REAL_SECRET',
    '.git/config':'private config', 'scripts/private.json':'private input', 'data/research.json':'private research'};
  for (const [path, body] of Object.entries(files)) await writeFile(join(root,path),body);
  await symlink(join(root,'.env'), join(root,'assets','alias.txt'));
  server = await createArchiveServer(root);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/', '/assets/app.js', '/data/index.json', '/data/stories.json']) {
    const res = await fetch(base+path);
    assert.equal(res.status,200,path);
    assert.match(res.headers.get('cache-control'),/no-store/);
    assert.equal(res.headers.get('x-content-type-options'),'nosniff');
  }
  for (const path of ['/.env','/%2eenv','/.git/config','/scripts/private.json','/data/research.json',
    '/assets/alias.txt','/assets/%2e%2e%2f.env','/assets/%5c..%5c.env','/%ZZ']) {
    const res = await fetch(base+path);
    assert.equal(res.status,404,path);
    assert.equal(await res.text(),'Not found');
  }
  assert.equal((await fetch(base, {method:'POST'})).status,405);
  const head = await fetch(base,{method:'HEAD'});
  assert.equal(head.status,200); assert.equal(await head.text(),'');
});
