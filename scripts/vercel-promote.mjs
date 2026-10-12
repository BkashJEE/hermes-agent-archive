#!/usr/bin/env node
/**
 * Read and move production through Vercel's REST API, with a team-scoped token.
 *
 *   node scripts/vercel-promote.mjs live              # print the deployment serving the domain
 *   node scripts/vercel-promote.mjs promote <url|id>  # point production at it, wait until it does
 *
 * The CLI's `promote` and `inspect` look up "the current user" first, and a token scoped to
 * a team cannot answer that: the first real run of deploy.yml staged a build and then failed
 * with "User not found (404)", and could not record the live deployment it would have
 * rolled back to. These endpoints take the team id directly (Vercel's OpenAPI spec:
 * getAlias, getDeployment, requestPromote).
 *
 * Reads VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID from the environment and never
 * prints the token.
 */
import { pathToFileURL } from 'node:url';

const API = 'https://api.vercel.com';
const DOMAIN = 'hermes-agent-archive.vercel.app';

export function client({ token, team, fetcher = fetch }) {
  const call = async (method, path) => {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetcher(`${API}${path}${sep}teamId=${encodeURIComponent(team)}`, {
      method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30000)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} → ${res.status}${body?.error?.message ? `: ${body.error.message}` : ''}`);
    return { status: res.status, body };
  };
  return {
    /** The deployment the domain points at right now. */
    live: async (domain = DOMAIN) => (await call('GET', `/v4/aliases/${encodeURIComponent(domain)}`)).body.deploymentId,
    /** A deployment by id or by hostname (an https:// prefix is accepted and dropped). */
    deployment: async ref => (await call('GET', `/v13/deployments/${encodeURIComponent(String(ref).replace(/^https?:\/\//, '').replace(/\/$/, ''))}`)).body,
    promote: async (project, id) => (await call('POST', `/v10/projects/${encodeURIComponent(project)}/promote/${encodeURIComponent(id)}`)).status
  };
}

/** Promote, then wait until the domain actually serves it: a 202 means the switch is queued. */
export async function promoteAndWait(api, project, ref, { attempts = 20, waitMs = 3000, log = console.log } = {}) {
  const d = await api.deployment(ref);
  if (!d?.id) throw new Error(`no deployment found for ${ref}`);
  if (d.readyState && d.readyState !== 'READY') throw new Error(`${d.id} is ${d.readyState}, not READY; refusing to promote it`);
  const status = await api.promote(project, d.id);
  log(`promote requested for ${d.id} (HTTP ${status})`);
  for (let i = 1; i <= attempts; i++) {
    if (await api.live() === d.id) { log(`production now serves ${d.id}`); return d.id; }
    await new Promise(r => setTimeout(r, waitMs));
  }
  throw new Error(`the domain still does not serve ${d.id} after ${Math.round(attempts * waitMs / 1000)}s`);
}

async function main() {
  const { VERCEL_TOKEN: token, VERCEL_ORG_ID: team, VERCEL_PROJECT_ID: project } = process.env;
  if (!token || !team || !project) throw new Error('VERCEL_TOKEN, VERCEL_ORG_ID and VERCEL_PROJECT_ID must be set');
  const api = client({ token, team });
  const [cmd, ref] = process.argv.slice(2);
  if (cmd === 'live') { console.log(await api.live()); return; }
  if (cmd === 'promote' && ref) { await promoteAndWait(api, project, ref); return; }
  throw new Error('usage: vercel-promote.mjs live | promote <url|id>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main().catch(e => { console.error(`✗ ${e.message}`); process.exitCode = 1; });
