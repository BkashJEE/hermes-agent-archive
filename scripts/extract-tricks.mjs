#!/usr/bin/env node
/** Reviewed extraction, never classifier routing. See docs/HIDDEN_TRICKS.md. */
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serialise } from './json-format.mjs';
import { digest, unpackCorpus, packCorpus, docUrl, refreshCorpus, githubJson, DOC_REPO } from './trick-docs.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const normalise = text => text.normalize('NFKC').toLowerCase().replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[*`]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

/** Discord export headers bind a quote to one author and message, not a whole file. */
export function parseMessages(text) {
  const headers = [...text.matchAll(/^\[([^\]\n]+)\] (.+) \(id=(\d+)\)\r?$/gm)];
  requireThat(headers.length, 'Source export has no message headers — shape changed');
  let at = 0, line = 1;
  return headers.map((h, i) => {
    line += (text.slice(at, h.index).match(/\n/g) ?? []).length;
    const start = line;
    const chunk = text.slice(h.index, headers[i + 1]?.index ?? text.length);
    at = h.index;
    return {
      id: h[3], author: h[2], date: h[1].slice(0, 10),
      start,
      end: start + (chunk.trimEnd().match(/\n/g) ?? []).length,
      text: text.slice(h.index + h[0].length, headers[i + 1]?.index ?? text.length)
        .split('\n').map(l => l.replace(/^ {4}/, '')).join('\n').trim()
    };
  });
}
export function sourceMessage(text, id) {
  const found = parseMessages(text).filter(m => m.id === id);
  requireThat(found.length && found.every(m => m.author === found[0].author && m.text === found[0].text), `Missing or ambiguous source message ${id}`);
  return found[0];
}
export function referencePages(corpus, prompts) {
  requireThat(prompts.source === 'hermes-agent.nousresearch.com' && Object.keys(prompts.pages ?? {}).length, 'Prompt prose/code corpus is missing');
  const pages = Object.entries(corpus.pages).map(([path, text]) => ({ url: docUrl(path), path, text }));
  for (const [url, p] of Object.entries(prompts.pages)) {
    requireThat(url.startsWith('https://hermes-agent.nousresearch.com/docs/') && Array.isArray(p.sections) && Array.isArray(p.blocks), `Malformed prompt page ${url}`);
    const text = [...p.sections, ...p.blocks].map(s => s.text).join('\n\n');
    requireThat(text.trim(), `Empty prompt excerpts: ${url}`);
    pages.push({ url, path: 'scripts/prompt-excerpts.json', text });
  }
  return pages;
}
/** Each query is a conjunction of reviewed terms in one paragraph; queries are ORed.
 * This detects literal evidence, NOT semantic absence. Editorial review is also mandatory.
 */
export function searchPages(pages, terms) {
  requireThat(Array.isArray(terms) && terms.length && terms.every(t => typeof t === 'string' && normalise(t)), 'Empty search terms');
  const patterns = terms.map(t => new RegExp(`(?<![\\p{L}\\p{N}])${normalise(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'u'));
  return pages.flatMap(page => page.text.split(/\n\s*\n/).filter(p => patterns.every(re => re.test(normalise(p))))
    .map(p => ({ page: page.url, corpus: page.path, excerpt: p.trim() })));
}
export function verifyCandidate(c, context) {
  const { corpus, pages, stories, source } = context;
  requireThat(c.id?.startsWith('trick-') && c.title && c.summary && c.author && c.quote && c.limitations, `Incomplete candidate ${c.id}`);
  const origin = stories.find(s => s.id === c.storyId);
  requireThat(origin && origin.author === c.author, `Story/author mismatch: ${c.id}`);
  requireThat(c.source?.repo === 'teknium1/nous-discord-archive' && /^[a-f0-9]{40}$/.test(c.source.commit) && /^archives\/.+\.txt$/.test(c.source.path), `Invalid source location: ${c.id}`);
  requireThat(!c.source.path.includes('..') && /^\d+$/.test(c.source.messageId), `Invalid source path/message: ${c.id}`);
  const expected = `https://github.com/${c.source.repo}/blob/${c.source.commit}/${c.source.path}#L${source.start}-L${source.end}`;
  requireThat(c.url === expected, `Source permalink mismatch: ${c.id}`);
  requireThat(source.id === c.source.messageId && `@${source.author}` === c.author && source.date === c.date, `Source attribution mismatch: ${c.id}`);
  // Exact text, with whitespace folding only. No quote assembled from unrelated messages.
  const spaced = t => t.replace(/\s+/g, ' ').trim();
  requireThat(spaced(source.text).includes(spaced(c.quote)), `Quote missing from attributed message: ${c.id}`);
  requireThat(c.review?.commit === corpus.commit && c.review.reason && c.review.closestDocs?.length && c.searches?.length >= 2, `Missing/current editorial review: ${c.id}`);
  for (const review of c.review.closestDocs) {
    requireThat(corpus.pages[review.path]?.includes(review.excerpt) && review.distinction, `Closest-doc review changed: ${c.id} ${review.path}`);
  }
  const searches = c.searches.map(terms => ({ terms, matches: searchPages(pages, terms) }));
  requireThat(searches.every(s => !s.matches.length), `Documented behaviour/search hit: ${c.id}`);
  return {
    id: c.id, author: c.author, url: c.url, quote: c.quote,
    pagesSearched: [...new Set(pages.map(p => p.url))].sort(),
    searches, absence: 'no matches in the pinned reference corpus and prompt excerpts',
    review: c.review,
    source: { ...c.source, ...source }
  };
}
export function entryFor(c, commit) {
  return { id: c.id, title: c.title, summary: c.summary,
    detail: `${c.quote}\n\n— ${c.author}, ${c.date}, via the public Nous Discord archive.\n\n${c.explanation}\n\nLimitations: ${c.limitations}\n\nDocumentation check: this specific community technique was not found in the official English reference snapshot (${commit.slice(0, 7)}) or the cached prompt guides. Related built-in features are documented. This is a bounded source review, not a claim about every document or independent execution testing.`,
    tags: c.tags, source: 'discord', url: c.url, author: c.author, date: c.date };
}
export function mergeEntries(existing, additions) {
  const byId = new Map(existing.map(e => [e.id, e]));
  for (const item of additions) byId.set(item.id, item);
  return [...byId.values()];
}

/** Stage all outputs; rollback originals if a write/rename fails. */
export async function commitFiles(files) {
  const staged = [], committed = [];
  try {
    for (const f of files) { await writeFile(`${f.path}.tmp`, f.next); staged.push(f); }
    for (const f of staged) { await rename(`${f.path}.tmp`, f.path); committed.push(f); }
  } catch (error) {
    for (const f of committed.reverse()) {
      if (f.before === null) await unlink(f.path);
      else { await writeFile(`${f.path}.tmp`, f.before); await rename(`${f.path}.tmp`, f.path); }
    }
    throw error;
  } finally {
    for (const f of staged) await unlink(`${f.path}.tmp`).catch(e => { if (e.code !== 'ENOENT') throw e; });
  }
}
export async function run({ root = ROOT, offline = false, report = false, refreshDocs = false, fetcher = fetch } = {}) {
  const read = p => readFile(join(root, p), 'utf8');
  const candidateRaw = await read('scripts/trick-candidates.json');
  const plan = JSON.parse(candidateRaw);
  const promptRaw = await read('scripts/prompt-excerpts.json');
  const corpusBytes = await readFile(join(root, 'scripts/trick-docs.json.gz'));
  let corpus = unpackCorpus(corpusBytes);
  if (refreshDocs) {
    requireThat(!offline && !report, '--refresh-docs cannot be combined with --offline/--report');
    const updated = await refreshCorpus(corpus, fetcher);
    // Corpus refresh cannot publish entries or silently renew editorial review.
    await commitFiles([{ path: join(root, 'scripts/trick-docs.json.gz'), before: corpusBytes, next: packCorpus(updated) }]);
    console.log(`Cached ${Object.keys(updated.pages).length} reference pages at ${updated.commit}. Review candidates before extraction.`);
    return;
  }
  const pages = referencePages(corpus, JSON.parse(promptRaw));
  const stories = JSON.parse(await read('data/use-cases.json')).items;
  const shelfRaw = await read('data/tricks.json');
  const shelf = JSON.parse(shelfRaw);
  const evidencePath = join(root, 'scripts/trick-evidence.json');
  let evidenceRaw = null;
  try { evidenceRaw = await readFile(evidencePath, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const previous = evidenceRaw ? JSON.parse(evidenceRaw) : null;
  requireThat(plan.version === 1 && plan.accepted?.length && Array.isArray(plan.rejected), 'No reviewed candidates; existing data untouched');
  requireThat(new Set(plan.accepted.map(c => c.id)).size === plan.accepted.length, 'Duplicate candidate ids');
  requireThat(shelf.items.every(e => plan.accepted.some(c => c.id === e.id)), 'Stored trick lacks reviewed provenance; refusing to delete or skip it');
  if (!offline) {
    const head = await githubJson(`${DOC_REPO}/commits/main`, fetcher);
    requireThat(head.sha === corpus.commit, 'Upstream revision changed; run --refresh-docs, review and reverify. Existing shelf untouched.');
  }
  const texts = new Map(), results = [];
  for (const c of plan.accepted) {
    let source;
    if (offline) source = previous?.entries?.find(e => e.id === c.id)?.source;
    else {
      requireThat(c.source?.repo === 'teknium1/nous-discord-archive' && /^[a-f0-9]{40}$/.test(c.source.commit) && /^archives\/(?!.*\.\.).+\.txt$/.test(c.source.path), 'Invalid source fetch location');
      const rawUrl = `https://raw.githubusercontent.com/${c.source.repo}/${c.source.commit}/${c.source.path}`;
      if (!texts.has(rawUrl)) {
        const res = await fetcher(rawUrl, { signal: AbortSignal.timeout(30000) });
        requireThat(res.ok, `Source HTTP ${res.status}: ${rawUrl}`);
        texts.set(rawUrl, await res.text());
      }
      source = sourceMessage(texts.get(rawUrl), c.source.messageId);
      const quoteText = c.quote.replace(/\s+/g, ' ').trim();
      const paragraph = source.text.split(/\n\s*\n/).find(p => p.replace(/\s+/g, ' ').includes(quoteText));
      requireThat(paragraph, `Quote missing from a source paragraph: ${c.id}`);
      // Retain the attributed paragraph, not the whole conversation or attachment URLs.
      source = { ...source, messageSha256: digest(source.text), text: paragraph };
    }
    requireThat(source?.text, `Missing stored source evidence: ${c.id}`);
    results.push(verifyCandidate(c, { corpus, pages, stories, source }));
  }
  const record = { version: 1, scope: 'Official English website/docs reference Markdown, excluding user-stories.mdx (testimonials, not reference instructions), plus all cached prompt prose and code blocks. Literal absence requires separate editorial semantic review.',
    corpus: { commit: corpus.commit, sha256: digest(corpusBytes), promptSha256: digest(promptRaw), candidatesSha256: digest(candidateRaw), pageCount: pages.length },
    entries: results, rejected: plan.rejected };
  const additions = plan.accepted.map(c => entryFor(c, corpus.commit));
  if (offline) {
    requireThat(JSON.stringify(record) === JSON.stringify(previous), 'Absence/provenance evidence drifted; live review required');
    requireThat(additions.every(e => JSON.stringify(shelf.items.find(x => x.id === e.id)) === JSON.stringify(e)), 'Stored trick differs from reviewed extraction');
  }
  if (!offline && !report) {
    const next = { ...shelf, note: 'Reviewed community techniques with verbatim attribution and a bounded official-documentation absence check. Reproduce with npm run tricks; offline evidence in scripts/trick-evidence.json. Historical entries are preserved.', items: mergeEntries(shelf.items, additions) };
    await commitFiles([
      { path: evidencePath, before: evidenceRaw, next: serialise(evidenceRaw ?? '\n', record) },
      { path: join(root, 'data/tricks.json'), before: shelfRaw, next: serialise(shelfRaw, next) }
    ]);
  }
  console.log(`${results.length} verified; ${plan.rejected.length} rejected; searched ${pages.length} reference/excerpt records. ${offline || report ? 'No writes.' : 'Merged by id.'}`);
  return record;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Credentials are loaded only for the command, never when imported by tests.
  await import('./env.mjs');
  run({ offline: process.argv.includes('--offline'), report: process.argv.includes('--report'), refreshDocs: process.argv.includes('--refresh-docs') })
    .catch(e => { console.error(e.message); process.exitCode = 1; });
}
