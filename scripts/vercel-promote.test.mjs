import { test } from 'node:test';
import assert from 'node:assert/strict';
import { client, promoteAndWait } from './vercel-promote.mjs';

/** A fake Vercel: one live deployment, promotion switches it after one poll. */
function fakeVercel({ ready = 'READY', switchAfter = 1 } = {}) {
  let live = 'dpl_old', polls = 0, promoted = null; const seen = [];
  const fetcher = async (url, init) => {
    const u = new URL(url); seen.push(`${init.method} ${u.pathname} team=${u.searchParams.get('teamId')}`);
    const json = (status, body) => new Response(JSON.stringify(body), { status });
    if (u.pathname.startsWith('/v4/aliases/')) { if (promoted && ++polls >= switchAfter) live = promoted; return json(200, { deploymentId: live }); }
    if (u.pathname.startsWith('/v13/deployments/')) return json(200, { id: 'dpl_new', readyState: ready });
    if (u.pathname.includes('/promote/')) { promoted = u.pathname.split('/').pop(); return json(202, {}); }
    return json(404, { error: { message: 'unknown' } });
  };
  return { fetcher, seen };
}
const quiet = { waitMs: 0, log: () => {} };

test('every call carries the team id, so no user lookup is needed', async () => {
  const v = fakeVercel(); const api = client({ token: 't', team: 'team_x', fetcher: v.fetcher });
  assert.equal(await api.live(), 'dpl_old');
  assert.ok(v.seen.every(s => s.endsWith('team=team_x')));
});

test('promote resolves a staged URL, asks once, and waits until the domain serves it', async () => {
  const v = fakeVercel({ switchAfter: 2 }); const api = client({ token: 't', team: 'team_x', fetcher: v.fetcher });
  assert.equal(await promoteAndWait(api, 'prj', 'https://hermes-agent-archive-abc-x.vercel.app', quiet), 'dpl_new');
  assert.equal(v.seen.filter(s => s.startsWith('POST')).length, 1);
  assert.ok(v.seen.some(s => s.includes('/v13/deployments/hermes-agent-archive-abc-x.vercel.app')), 'the https:// prefix is dropped');
});

test('a deployment that is not READY is never promoted', async () => {
  const v = fakeVercel({ ready: 'ERROR' }); const api = client({ token: 't', team: 'team_x', fetcher: v.fetcher });
  await assert.rejects(promoteAndWait(api, 'prj', 'x', quiet), /not READY/);
  assert.ok(!v.seen.some(s => s.startsWith('POST')));
});

test('a promotion that never takes effect fails instead of passing silently', async () => {
  const v = fakeVercel({ switchAfter: 99 }); const api = client({ token: 't', team: 'team_x', fetcher: v.fetcher });
  await assert.rejects(promoteAndWait(api, 'prj', 'x', { ...quiet, attempts: 3 }), /still does not serve dpl_new/);
});
