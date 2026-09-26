/** Pinned official reference corpus for offline Hidden Tricks review. Built-ins only. */
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const DOC_REPO = 'NousResearch/hermes-agent';
export const DOC_PREFIX = 'website/docs/';
export const DOC_EXCLUSIONS = ['website/docs/user-stories.mdx'];
export const digest = value => createHash('sha256').update(value).digest('hex');
export const referencePath = path => path.startsWith(DOC_PREFIX) && /\.mdx?$/.test(path) && !DOC_EXCLUSIONS.includes(path);
export const docUrl = path => `https://hermes-agent.nousresearch.com/docs/${path.slice(DOC_PREFIX.length).replace(/\.mdx?$/, '').replace(/\/index$/, '')}`;
export const packCorpus = corpus => gzipSync(Buffer.from(JSON.stringify(corpus)), { level: 9 });
export function unpackCorpus(bytes) {
  const corpus = JSON.parse(gunzipSync(bytes).toString('utf8'));
  if (corpus.version !== 1 || !/^[a-f0-9]{40}$/.test(corpus.commit) || !Object.keys(corpus.pages ?? {}).length)
    throw new Error('Missing or malformed official documentation corpus');
  for (const [path, text] of Object.entries(corpus.pages))
    if (!referencePath(path) || typeof text !== 'string' || !text.trim()) throw new Error(`Malformed reference page: ${path}`);
  return corpus;
}
export async function githubJson(path, fetcher = fetch) {
  const headers = { 'user-agent': 'hermes-agent-archive', accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetcher(`https://api.github.com/repos/${path}`, { headers, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status} reading ${path}; no files changed`);
  return res.json();
}
export async function refreshCorpus(previous, fetcher = fetch) {
  const commit = (await githubJson(`${DOC_REPO}/commits/main`, fetcher)).sha;
  const tree = await githubJson(`${DOC_REPO}/git/trees/${commit}?recursive=1`, fetcher);
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('Incomplete upstream documentation tree');
  const files = tree.tree.filter(x => x.type === 'blob' && referencePath(x.path));
  if (!files.length || Object.keys(previous?.pages ?? {}).some(p => !files.some(f => f.path === p)))
    throw new Error('Documentation coverage shrank; review removed paths before replacing the corpus');
  const pages = {};
  // Sequential requests fail immediately on authentication/rate-limit errors.
  for (const file of files) {
    const blob = await githubJson(`${DOC_REPO}/git/blobs/${file.sha}`, fetcher);
    if (blob.encoding !== 'base64' || !blob.content) throw new Error(`Unreadable documentation blob: ${file.path}`);
    pages[file.path] = Buffer.from(blob.content.replace(/\s/g, ''), 'base64').toString('utf8');
  }
  return unpackCorpus(packCorpus({ version: 1, commit, pages: Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b))) }));
}
